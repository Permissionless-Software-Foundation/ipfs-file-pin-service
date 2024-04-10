/*
  This is the JSON RPC router for the file-pin API
*/

// Public npm libraries
import jsonrpc from 'jsonrpc-lite'

// Local libraries
// import config from '../../../../config/index.js'

class FilePinRPC {
  constructor (localConfig) {
    // Encapsulate dependencies
    this.jsonrpc = jsonrpc

    // Bind 'this' object to all subfunctions
    this.filePinRouter = this.filePinRouter.bind(this)
    this.getFileMetadata = this.getFileMetadata.bind(this)
  }

  /**
   * @api {JSON} /file-pin File Pin Status
   * @apiPermission public
   * @apiName About
   * @apiGroup JSON About
   *
   * @apiExample Example usage:
   * {"jsonrpc":"2.0","id":"555","method":"about"}
   *
   * @apiDescription
   * This endpoint can be customized so that users can retrieve information about
   * your IPFS node and Service Provider application. This is a great place to
   * put a website URL, an IPFS hash, an other basic information.
   */

  // This is the top-level router for this library.
  // This is a bit different than other router libraries, because there is
  // only one response, which is a string about this node.
  async filePinRouter (rpcData) {
    console.log('debugging: aboutRouter from ipfs-service-provider triggered')

    let endpoint = 'unknown'
    try {
      // console.log('userRouter rpcData: ', rpcData)

      endpoint = rpcData.payload.params.endpoint
      // let user

      // Route the call based on the value of the method property.
      switch (endpoint) {
        case 'getFileMetadata':
          await this.rateLimit.limiter(rpcData.from)
          return await this.getFileMetadata(rpcData)
      }
    } catch (err) {
      console.error('Error in FilePinRPC/rpcRouter()')
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

      // const user = await this.userLib.getUser({ id: userId })
      const fileMetadata = {
        filename: 'test.txt',
        cid
      }

      return {
        fileMetadata,
        endpoint: 'getFileMetadata',
        success: true,
        status: 200,
        message: ''
      }
    } catch (err) {
      // console.error('Error in getUser()')
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
}

export default FilePinRPC
