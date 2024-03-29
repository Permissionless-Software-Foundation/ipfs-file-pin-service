/*
  REST API Controller library for the /ipfs route
*/

// Global npm libraries

// Local libraries
import wlogger from '../../../adapters/wlogger.js'

class IpfsRESTControllerLib {
  constructor (localConfig = {}) {
    // Dependency Injection.
    this.adapters = localConfig.adapters
    if (!this.adapters) {
      throw new Error(
        'Instance of Adapters library required when instantiating /ipfs REST Controller.'
      )
    }
    this.useCases = localConfig.useCases
    if (!this.useCases) {
      throw new Error(
        'Instance of Use Cases library required when instantiating /ipfs REST Controller.'
      )
    }

    // Encapsulate dependencies
    // this.UserModel = this.adapters.localdb.Users
    // this.userUseCases = this.useCases.user

    // Bind 'this' object to all subfunctions
    this.getStatus = this.getStatus.bind(this)
    this.getPeers = this.getPeers.bind(this)
    this.getRelays = this.getRelays.bind(this)
    this.handleError = this.handleError.bind(this)
    this.connect = this.connect.bind(this)
    this.pinClaim = this.pinClaim.bind(this)
    this.pinStatus = this.pinStatus.bind(this)
    this.downloadCid = this.downloadCid.bind(this)
    this.getThisNode = this.getThisNode.bind(this)
    this.downloadFile = this.downloadFile.bind(this)
    this.getPins = this.getPins.bind(this)
  }

  /**
   * @api {get} /ipfs Get status on IPFS infrastructure
   * @apiPermission public
   * @apiName GetIpfsStatus
   * @apiGroup REST BCH
   *
   * @apiExample Example usage:
   * curl -H "Content-Type: application/json" -X GET localhost:5001/ipfs
   *
   */
  async getStatus (ctx) {
    try {
      const status = await this.adapters.ipfs.getStatus()

      ctx.body = { status }
    } catch (err) {
      wlogger.error('Error in ipfs/controller.js/getStatus(): ')
      // ctx.throw(422, err.message)
      this.handleError(ctx, err)
    }
  }

  // Return information on IPFS peers this node is connected to.
  async getPeers (ctx) {
    try {
      const showAll = ctx.request.body.showAll

      const peers = await this.adapters.ipfs.getPeers(showAll)

      ctx.body = { peers }
    } catch (err) {
      wlogger.error('Error in ipfs/controller.js/getPeers(): ')
      // ctx.throw(422, err.message)
      this.handleError(ctx, err)
    }
  }

  // Get data about the known Circuit Relays. Hydrate with data from peers list.
  async getRelays (ctx) {
    try {
      const relays = await this.adapters.ipfs.getRelays()

      ctx.body = { relays }
    } catch (err) {
      wlogger.error('Error in ipfs/controller.js/getRelays(): ')
      // ctx.throw(422, err.message)
      this.handleError(ctx, err)
    }
  }

  async connect (ctx) {
    try {
      const multiaddr = ctx.request.body.multiaddr
      const getDetails = ctx.request.body.getDetails

      // console.log('this.adapters.ipfs.ipfsCoordAdapter.ipfsCoord.adapters.ipfs: ', this.adapters.ipfs.ipfsCoordAdapter.ipfsCoord.adapters.ipfs)
      const result = await this.adapters.ipfs.ipfsCoordAdapter.ipfsCoord.adapters.ipfs.connectToPeer({ multiaddr, getDetails })
      // console.log('result: ', result)

      ctx.body = result
    } catch (err) {
      wlogger.error('Error in ipfs/controller.js/connect():', err)
      // ctx.throw(422, err.message)
      this.handleError(ctx, err)
    }
  }

  // This endpoint is called by psf-slp-indexer when it detects a new Pin Claim
  // on the blockchain. It passes the Claim information to this endpoint for
  // validation and processing.
  async pinClaim (ctx) {
    try {
      const body = ctx.request.body
      console.log('pinClaim() body: ', body)

      const result = await this.useCases.ipfs.processPinClaim(body)

      ctx.body = result
    } catch (err) {
      wlogger.error('Error in ipfs/controller.js/pinClaim():', err)
      // ctx.throw(422, err.message)
      this.handleError(ctx, err)
    }
  }

  // Check on the status of a pin request.
  async pinStatus (ctx) {
    try {
      const cid = ctx.params.cid

      const status = await this.useCases.ipfs.getPinStatus({ cid })

      ctx.body = status
    } catch (err) {
      wlogger.error('Error in ipfs/controller.js/pinStatus():', err)
      // ctx.throw(422, err.message)
      this.handleError(ctx, err)
    }
  }

  // Download a file identified by CID, which is pinned to this node.
  // This function will hopefully be phased out by an IPFS Gateway once such
  // functionality has been developed for Helia. At the moment, nothing exists,
  // so I had to create my own way for downloading pinned files of HTTP.
  async downloadCid (ctx) {
    try {
      const cid = ctx.params.cid

      const { filename, readStream } = await this.useCases.ipfs.downloadCid({ cid })

      ctx.body = readStream
      ctx.attachment(filename)
    } catch (err) {
      wlogger.error('Error in ipfs/controller.js/downloadCid():', err)
      // ctx.throw(422, err.message)
      this.handleError(ctx, err)
    }
  }

  /**
   * @api {get} /ipfs/node Get a copy of the thisNode object from helia-coord
   * @apiPermission public
   * @apiName GetThisNode
   * @apiGroup REST BCH
   *
   * @apiExample Example usage:
   * curl -H "Content-Type: application/json" -X GET localhost:5001/ipfs/node
   *
   */
  async getThisNode (ctx) {
    try {
      const thisNode = this.adapters.ipfs.ipfsCoordAdapter.ipfsCoord.thisNode

      ctx.body = { thisNode }
    } catch (err) {
      wlogger.error('Error in ipfs/controller.js/getThisNode(): ')
      this.handleError(ctx, err)
    }
  }

  async downloadFile (ctx) {
    try {
      const { cid } = ctx.params

      const file = await this.adapters.ipfs.ipfs.blockstore.get(cid)
      return file
    } catch (err) {
      wlogger.error('Error in ipfs/controller.js/downloadFile(): ', err)
      this.handleError(ctx, err)
    }
  }

  // Get a paginated list of the latest pin claims.
  async getPins (ctx) {
    try {
      const pins = await this.useCases.ipfs.getPinClaims()

      ctx.body = pins
    } catch (err) {
      wlogger.error('Error in ipfs/controller.js/getPins(): ', err)
      this.handleError(ctx, err)
    }
  }

  // DRY error handler
  handleError (ctx, err) {
    // If an HTTP status is specified by the buisiness logic, use that.
    if (err.status) {
      if (err.message) {
        ctx.throw(err.status, err.message)
      } else {
        ctx.throw(err.status)
      }
    } else {
      // By default use a 422 error if the HTTP status is not specified.
      ctx.throw(422, err.message)
    }
  }
}

// module.exports = IpfsRESTControllerLib
export default IpfsRESTControllerLib
