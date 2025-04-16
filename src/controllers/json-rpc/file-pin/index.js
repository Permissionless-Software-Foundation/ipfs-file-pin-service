/*
  This is the JSON RPC router for the file-pin API
*/

// Public npm libraries
import jsonrpc from 'jsonrpc-lite'

// Local libraries
// import config from '../../../../config/index.js'

class FilePinRPC {
  constructor (localConfig = {}) {
    // Dependency Injection.
    this.adapters = localConfig.adapters
    if (!this.adapters) {
      throw new Error(
        'Instance of Adapters library required when instantiating File Pin JSON RPC Controller.'
      )
    }
    this.useCases = localConfig.useCases
    if (!this.useCases) {
      throw new Error(
        'Instance of Use Cases library required when instantiating File Pin JSON RPC Controller.'
      )
    }

    // Encapsulate dependencies
    this.jsonrpc = jsonrpc

    // Bind 'this' object to all subfunctions
    this.filePinRouter = this.filePinRouter.bind(this)
    this.getFileMetadata = this.getFileMetadata.bind(this)
    this.getPins = this.getPins.bind(this)
    this.pinClaim = this.pinClaim.bind(this)
  }

  // This is the top-level router for this library.
  // This is a bit different than other router libraries, because there is
  // only one response, which is a string about this node.
  async filePinRouter (rpcData) {
    console.log('debugging: filePinRouter from ipfs-file-pin-service triggered')

    let endpoint = 'unknown'
    try {
      // console.log('userRouter rpcData: ', rpcData)

      endpoint = rpcData.payload.params.endpoint
      // let user

      // Route the call based on the value of the method property.
      switch (endpoint) {
        case 'getFileMetadata':
          // await this.rateLimit.limiter(rpcData.from)
          return await this.getFileMetadata(rpcData)
        case 'getPins':
          return await this.getPins(rpcData)
        case 'pinClaim':
          return await this.pinClaim(rpcData)
      }
    } catch (err) {
      console.error('Error in FilePinRPC/rpcRouter(): ', err)
      // throw err

      return {
        success: false,
        status: err.status || 500,
        message: err.message,
        endpoint
      }
    }
  }

  /**
   * @api {JSON} /getPins List latest pinned content
   * @apiPermission public
   * @apiName GetFileMetadata
   * @apiGroup JSON File Pin
   *
   * @apiExample Example usage:
   * {"jsonrpc":"2.0","id":"123","method":"file-pin","params":{ "endpoint": "getPins" }}
   *
   * @apiParam {string} endpoint      (required)
   *
   */
  // Get metadata of a file, given a CID.
  async getPins (rpcData) {
    try {
      const { page } = rpcData.payload.params

      const pins = await this.useCases.ipfs.getPinClaims({ page })

      return {
        pins,
        endpoint: 'getPins',
        success: true,
        status: 200,
        message: 'pins property is an array of latest 20 pinned items'
      }
    } catch (err) {
      console.error('Error in getPins(): ', err)
      // throw err

      // Return an error response
      return {
        success: false,
        status: 422,
        message: err.message,
        endpoint: 'getPins'
      }
    }
  }

  /**
   * @api {JSON} /file-pin Get File Metadata
   * @apiPermission public
   * @apiName GetFileMetadata
   * @apiGroup JSON File Pin
   *
   * @apiExample Example usage:
   * {"jsonrpc":"2.0","id":"123","method":"file-pin","params":{ "endpoint": "getFileMetadata", "cid": "bafkreigpum2rybhf6c242fo6r6s4wezdo7i2r4fq6mm3yrmahaa3dwp6p4"}}
   *
   * @apiParam {String} cid       (required)
   * @apiParam {string} endpoint      (required)
   *
   */
  // Get metadata of a file, given a CID.
  async getFileMetadata (rpcData) {
    try {
      // console.log('getUser rpcData: ', rpcData)

      // Throw error if rpcData does not include 'userId' property for target user.
      const cid = rpcData.payload.params.cid

      const Pins = this.adapters.localdb.Pins

      let fileMetadata = {}

      const pinModel = await Pins.find({ cid })
      if (pinModel.length > 0) {
        fileMetadata = pinModel[0]
        fileMetadata.pobTxDetails = {}
        fileMetadata.claimTxDetails = {}
      }
      console.log('fileMetadata: ', fileMetadata)

      return {
        fileMetadata,
        endpoint: 'getFileMetadata',
        success: true,
        status: 200,
        message: 'pin status, filename, and other metadata for a given CID'
      }
    } catch (err) {
      console.error('Error in getFileMetadata(): ', err)
      // throw err

      // Return an error response
      return {
        success: false,
        status: 422,
        message: err.message,
        endpoint: 'getFileMetadata'
      }
    }
  }

  /**
 * @api {JSON} /pinClaim Claim a file to be pinned
 * @apiPermission public
 * @apiName PinClaim
 * @apiGroup JSON File Pin
 *
 * @apiExample Example usage:
 * {"jsonrpc":"2.0","id":"123","method":"file-pin","params":{ "endpoint": "pinClaim" , "proofOfBurnTxid": "be4b63156c93f58ed311d403d9f756deda9abbc81d0fef8fbe5d769538b4261c", "cid": "bafybeied3zdwdiro7fqytyha2yfband4lwcrtozmf6shynylt3kexh26dq", "claimTxid": "c71e2f2cdf8658d90c61ac6183b8ffeeb359779807b317386044705d8352f0f2", "filename": "mutable-67ccefcca67097473e78ca10.json", "address": "bitcoincash:qqs2wrahl6azn9qdyrmp9ygeejqvzr8ruv7e9m30fr" }}
 *
 * @apiParam {string} endpoint      (required)
 *
 */
  // Process pin claim
  async pinClaim (rpcData) {
    try {
      const result = await this.useCases.ipfs.processPinClaim(rpcData.payload.params)

      return {
        endpoint: 'pinClaim',
        success: true,
        status: 200,
        message: result.details
      }
    } catch (err) {
      console.error('Error in pinClaim(): ', err)
      // Return an error response
      return {
        success: false,
        status: 422,
        message: err.message,
        endpoint: 'pinClaim'
      }
    }
  }
}

export default FilePinRPC
