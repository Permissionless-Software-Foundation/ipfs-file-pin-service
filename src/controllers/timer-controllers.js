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
    this.pinCids = this.pinCids.bind(this)

    // Encapsulate constants
    this.PIN_CID_INTERVAL = 60000 * 10 // 10 minutes
  }

  // Start all the time-based controllers.
  startTimers () {
    // Any new timer control functions can be added here. They will be started
    // when the server starts.
    this.pinCidsHandle = setInterval(this.pinCids, this.PIN_CID_INTERVAL)

    return true
  }

  stopTimers () {
    clearInterval(this.pinCidsHandle)
  }

  // Periodically check the database of pins and create a download/pin request
  // if one has not already been created.
  async pinCids () {
    try {
      let now = new Date()
      console.log(`pinCids() Timer Controller started at ${now.toLocaleString()}`)

      // Stop the timer interval from executing if a previous instance is still
      // executing.
      clearInterval(this.pinCidsHandle)

      const Pins = this.adapters.localdb.Pins

      // Get all pins in the database
      const pins = await Pins.find({})
      console.log(`There are ${pins.length} Pin Claims in the database.`)

      for (let i = 0; i < pins.length; i++) {
        const thisPin = pins[i]

        await this.useCases.ipfs.pinCid(thisPin)
      }

      const promiseQueueSize = this.useCases.ipfs.promiseQueueSize
      console.log(`Download requested for ${promiseQueueSize} files.`)

      now = new Date()
      console.log(`pinCids() Timer Controller finished at ${now.toLocaleString()}`)

      // Restart the timer interval after it completes.
      this.pinCidsHandle = setInterval(this.pinCids, this.PIN_CID_INTERVAL)

      return true
    } catch (err) {
      console.error('Error in timer-controllers.js/pinCids(): ', err)
      // Do not throw an error. This is a top-level function.
      return false
    }
  }
}

export default TimerControllers
