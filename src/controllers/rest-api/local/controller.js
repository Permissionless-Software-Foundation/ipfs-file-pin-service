/*
  REST API Controller library for the /local route
*/

// Global npm libraries

// Local libraries
import wlogger from '../../../adapters/wlogger.js'

class LocalRESTControllerLib {
  constructor (localConfig = {}) {
    // Dependency Injection.
    this.adapters = localConfig.adapters
    if (!this.adapters) {
      throw new Error(
        'Instance of Adapters library required when instantiating /local REST Controller.'
      )
    }
    this.useCases = localConfig.useCases
    if (!this.useCases) {
      throw new Error(
        'Instance of Use Cases library required when instantiating /local REST Controller.'
      )
    }

    // Encapsulate dependencies

    // Bind 'this' object to all subfunctions
    this.getAll = this.getAll.bind(this)
    this.deleteByCid = this.deleteByCid.bind(this)
    this.handleError = this.handleError.bind(this)
  }

  /**
   * @api {get} /local Get all local pin entries
   * @apiPermission public
   * @apiName GetLocalPins
   * @apiGroup REST Local
   *
   * @apiExample Example usage:
   * curl -H "Content-Type: application/json" -X GET localhost:5020/local
   *
   * @apiSuccess {Array} localPins Array of local pin objects
   *
   * @apiSuccessExample {json} Success-Response:
   *     HTTP/1.1 200 OK
   *     {
   *       "localPins": [
   *         {
   *           "_id": "56bd1da600a526986cf65c80",
   *           "CID": "bafybeihdwdcefgh4dqkjv67uzcmw7ojee6xedzdetojuzjevtenosa7ala",
   *           "filename": "example.txt",
   *           "fileSize": 12345,
   *           "datePinned": "2025-01-01T00:00:00.000Z"
   *         }
   *       ]
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
  async getAll (ctx) {
    try {
      const localPins = await this.useCases.local.getAll()

      ctx.body = { localPins }
    } catch (err) {
      wlogger.error('Error in local/controller.js/getAll(): ')
      this.handleError(ctx, err)
    }
  }

  /**
   * @api {delete} /local/:cid Delete a local pin by CID
   * @apiPermission public
   * @apiName DeleteLocalPin
   * @apiGroup REST Local
   *
   * @apiParam {String} cid CID of the pin to delete (URL parameter)
   *
   * @apiExample Example usage:
   * curl -H "Content-Type: application/json" -X DELETE localhost:5020/local/bafybeihdwdcefgh4dqkjv67uzcmw7ojee6xedzdetojuzjevtenosa7ala
   *
   * @apiSuccess {Object} localPin The deleted local pin object
   *
   * @apiSuccessExample {json} Success-Response:
   *     HTTP/1.1 200 OK
   *     {
   *       "success": true
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
  async deleteByCid (ctx) {
    try {
      const cid = ctx.params.cid

      await this.useCases.local.deleteByCid({ cid })

      ctx.body = { success: true }
    } catch (err) {
      wlogger.error('Error in local/controller.js/deleteByCid(): ')
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

export default LocalRESTControllerLib
