/*
  This Controller library is concerned with timer-based functions that are
  kicked off periodicially.
*/

import config from '../../config/index.js'

class TimerControllers {
  constructor (localConfig = {}) {
    // Dependency Injection.
    this.adapters = localConfig.adapters
    if (!this.adapters) {
      throw new Error(
        'Instance of Adapters library required when instantiating Timer Controller libraries.'
      )
    }
    this.useCases = localConfig.useCases
    if (!this.useCases) {
      throw new Error(
        'Instance of Use Cases library required when instantiating Timer Controller libraries.'
      )
    }

    this.debugLevel = localConfig.debugLevel

    // Encapsulate dependencies
    this.config = config

    // Bind 'this' object to all subfunctions.
    this.exampleTimerFunc = this.exampleTimerFunc.bind(this)
    this.pinCids = this.pinCids.bind(this)

    // this.startTimers()
  }

  // Start all the time-based controllers.
  startTimers () {
    // Any new timer control functions can be added here. They will be started
    // when the server starts.
    this.optimizeWalletHandle = setInterval(this.exampleTimerFunc, 60000 * 10)
    this.pinCidsHandle = setInterval(this.pinCids, 60000 * 10)

    return true
  }

  stopTimers () {
    clearInterval(this.optimizeWalletHandle)
    clearInterval(this.pinCidsHandle)
  }

  // Replace this example function with your own timer handler.
  exampleTimerFunc (negativeTest) {
    try {
      console.log('Example timer controller executed.')

      if (negativeTest) throw new Error('test error')

      return true
    } catch (err) {
      console.error('Error in exampleTimerFunc(): ', err)

      // Note: Do not throw an error. This is a top-level function.
      return false
    }
  }

  // Periodically check the database of pins and create a download/pin request
  // if one has not already been created.
  async pinCids () {
    try {
      const Pins = this.adapters.localdb.Pins

      // Get all pins in the database
      const pins = await Pins.find({})

      for (let i = 0; i < pins.length; i++) {
        const thisPin = pins[i]

        await this.useCases.ipfs.pinCid(thisPin)
      }

      return true
    } catch (err) {
      console.error('Error in timer-controllers.js/pinCids(): ', err)
      // Do not throw an error. This is a top-level function.
      return false
    }
  }
}

export default TimerControllers
