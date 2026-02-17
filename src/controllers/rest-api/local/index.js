/*
  REST API library for the /local route.
*/

// Public npm libraries.
import Router from 'koa-router'

// Local libraries.
import LocalRESTControllerLib from './controller.js'

class LocalRouter {
  constructor (localConfig = {}) {
    // Dependency Injection.
    this.adapters = localConfig.adapters
    if (!this.adapters) {
      throw new Error(
        'Instance of Adapters library required when instantiating Local REST Controller.'
      )
    }
    this.useCases = localConfig.useCases
    if (!this.useCases) {
      throw new Error(
        'Instance of Use Cases library required when instantiating Local REST Controller.'
      )
    }

    const dependencies = {
      adapters: this.adapters,
      useCases: this.useCases
    }

    this.localRESTController = new LocalRESTControllerLib(dependencies)

    // Instantiate the router and set the base route.
    const baseUrl = '/local'
    this.router = new Router({ prefix: baseUrl })
  }

  attach (app) {
    if (!app) {
      throw new Error(
        'Must pass app object when attaching REST API controllers.'
      )
    }

    // Define the routes and attach the controller.
    this.router.get('/', this.localRESTController.getAll)
    this.router.delete('/:cid', this.localRESTController.deleteByCid)

    // Attach the Controller routes to the Koa app.
    app.use(this.router.routes())
    app.use(this.router.allowedMethods())
  }
}

export default LocalRouter
