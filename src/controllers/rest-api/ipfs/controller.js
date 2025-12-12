/*
  REST API Controller library for the /ipfs route
*/

// Global npm libraries
import mime from 'mime-types'

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
    this.mime = mime

    // Bind 'this' object to all subfunctions
    this.getStatus = this.getStatus.bind(this)
    this.getPeers = this.getPeers.bind(this)
    this.getRelays = this.getRelays.bind(this)
    this.handleError = this.handleError.bind(this)
    this.connect = this.connect.bind(this)
    this.pinClaim = this.pinClaim.bind(this)
    this.pinStatus = this.pinStatus.bind(this)
    this.downloadFile = this.downloadFile.bind(this)
    this.getThisNode = this.getThisNode.bind(this)
    this.viewFile = this.viewFile.bind(this)
    this.getPins = this.getPins.bind(this)
    this.getUnprocessedPins = this.getUnprocessedPins.bind(this)
    this.pinLocalFile = this.pinLocalFile.bind(this)
    this.downloadCid = this.downloadCid.bind(this)
  }

  /**
   * @api {get} /ipfs Get status on IPFS infrastructure
   * @apiPermission public
   * @apiName GetIpfsStatus
   * @apiGroup REST IPFS
   *
   * @apiExample Example usage:
   * curl -H "Content-Type: application/json" -X GET localhost:5031/ipfs
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

  /**
   * @api {post} /ipfs/pin-claim Submit a Pin Claim for evaluation
   * @apiName PinClaim
   * @apiGroup IPFS
   * @apiDescription This endpoint is called by psf-slp-indexer when it detects a new Pin Claim
   * on the blockchain. It passes the Claim information to this endpoint for
   * validation and processing.
   *
   * @apiExample Example usage:
   * curl -H "Content-Type: application/json" -X POST -d '{ "proofOfBurnTxid": "be4b63156c93f58ed311d403d9f756deda9abbc81d0fef8fbe5d769538b4261c", "cid": "bafybeied3zdwdiro7fqytyha2yfband4lwcrtozmf6shynylt3kexh26dq", "claimTxid": "c71e2f2cdf8658d90c61ac6183b8ffeeb359779807b317386044705d8352f0f2", "filename": "mutable-67ccefcca67097473e78ca10.json", "address": "bitcoincash:qqs2wrahl6azn9qdyrmp9ygeejqvzr8ruv7e9m30fr" }' http://localhost:5031/ipfs/pin-claim
   *
   * @apiParam {String} proofOfBurnTxid Proof of Burn Transaction ID.
   * @apiParam {String} cid CID of the file to be pinned.
   * @apiParam {String} claimTxid Claim Transaction ID.
   * @apiParam {String} filename Filename of the file to be pinned.
   * @apiParam {String} address Address of the user submitting the claim.
   *
   * @apiSuccessExample {json} Success-Response:
   *     HTTP/1.1 200 OK
   *     {
   *
   *        success:true
   *
   *     }
   *
   * @apiError UnprocessableEntity Missing required parameters
   *
   * @apiErrorExample {json} Error-Response:
   *     HTTP/1.1 422 Unprocessable Entity
   *     {
   *       "status": 422,
   *       "error": "Unprocessable Entity"
   *     }
   */
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
  async downloadFile (ctx) {
    try {
      const { cid, name } = ctx.params

      const { filename, readStream } = await this.useCases.ipfs.downloadFile({ cid, name })

      ctx.body = readStream
      ctx.attachment(filename)
    } catch (err) {
      wlogger.error('Error in ipfs/controller.js/downloadFile():', err)
      // ctx.throw(422, err.message)
      this.handleError(ctx, err)
    }
  }

  // Try to download a random CID.
  // This is used to try to download any random CID. It is not restricted to
  // Pin Claims. This can be used to download CIDs from other nodes on the
  // network that have a file privately pinned.
  async downloadCid (ctx) {
    try {
      const { cid } = ctx.params

      const { readStream } = await this.useCases.ipfs.downloadCid({ cid })

      ctx.body = readStream
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
   * @apiGroup REST IPFS
   *
   * @apiExample Example usage:
   * curl -H "Content-Type: application/json" -X GET localhost:5031/ipfs/node
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

  async viewFile (ctx) {
    try {
      const { cid, name } = ctx.params

      // const file = await this.adapters.ipfs.ipfs.blockstore.get(cid)
      // return file

      // const cid = ctx.params.cid

      const { filename, readStream } = await this.useCases.ipfs.downloadFile({ cid, name, listDir: true })

      // ctx.body = ctx.req.pipe(readStream)

      // Lookup the mime type from the filename.
      const contentType = mime.lookup(filename)

      ctx.set('Content-Type', contentType)
      ctx.set(
        'Content-Disposition',
        // 'inline; filename="' + filename + '"'
        `inline; filename="${filename}"`
      )
      ctx.body = readStream
    } catch (err) {
      // wlogger.error('Error in ipfs/controller.js/viewFile(): ', err)
      console.log('Error in ipfs/controller.js/viewFile(): ', err)
      this.handleError(ctx, err)
    }
  }

  /**
   * @api {get} /ipfs/pins/:page Get metadata on pinned items
   * @apiPermission public
   * @apiName GetPins
   * @apiGroup REST IPFS
   *
   * @apiExample Example usage:
   * curl -H "Content-Type: application/json" -X GET localhost:5031/ipfs/pins/1
   *
   */
  // Get a paginated list of the latest pin claims.
  async getPins (ctx) {
    try {
      const { page } = ctx.params

      const pins = await this.useCases.ipfs.getPinClaims({ page })

      ctx.body = pins
    } catch (err) {
      wlogger.error('Error in ipfs/controller.js/getPins(): ', err)
      this.handleError(ctx, err)
    }
  }

  /**
   * @api {get} /ipfs/unprocessed-pins Get unprocessed pin claims
   * @apiPermission public
   * @apiName GetUnprocessedPins
   * @apiGroup REST IPFS
   * @apiDescription Returns an array of pins that have a validClaim property of null.
   *
   * @apiExample Example usage:
   * curl -H "Content-Type: application/json" -X GET localhost:5031/ipfs/unprocessed-pins
   *
   */
  async getUnprocessedPins (ctx) {
    try {
      const pins = await this.useCases.ipfs.getUnprocessedPins()

      ctx.body = pins
    } catch (err) {
      wlogger.error('Error in ipfs/controller.js/getUnprocessedPins(): ', err)
      this.handleError(ctx, err)
    }
  }

  /**
   * @api {post} /ipfs/pin-local-file Upload and pin a file to the local IPFS node.
   * @apiPermission public
   * @apiName PinLocalFile
   * @apiGroup REST IPFS
   *
   * @apiDescription Upload and pin a file via HTTP multipart form data and add it to the localIPFS node. The file will be stored in the IPFS network and a CID (Content Identifier) will be returned.
   *
   * @apiParam {File} file File to upload (required, multipart form data)
   *
   * @apiExample Example usage:
   * curl -X POST -F "file=@/path/to/your/file.txt" localhost:5001/ipfs/pin-local-file
   *
   * @apiSuccess {String} cid Content Identifier (CID) of the uploaded file
   *
   * @apiSuccessExample {json} Success-Response:
   *     HTTP/1.1 200 OK
   *     {
   *       "cid": "bafybeidhiave6yci6gih6ixv5dp63p2qsgfxei4fwg77fov45qezewlpgq",
   *       "success": true
   *     }
   *
   * @apiError UnprocessableEntity Missing or invalid file parameter
   * @apiError InternalServerError Error uploading file to IPFS
   *
   * @apiErrorExample {json} Error-Response:
   *     HTTP/1.1 422 Unprocessable Entity
   *     {
   *       "status": 422,
   *       "error": "Unprocessable Entity"
   *     }
   */
  // Upload a file via HTTP and add it to the IPFS node.
  async pinLocalFile (ctx) {
    try {
      // console.log('ctx.request.files: ', ctx.request.files)

      const file = ctx.request.files.file
      // console.log('file: ', file)

      const result = await this.useCases.ipfs.pinLocalFile({ file })

      ctx.body = result
    } catch (err) {
      wlogger.error('Error in ipfs/controller.js/pinLocalFile(): ', err)
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
