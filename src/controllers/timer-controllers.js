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
    this.autoReboot = this.autoReboot.bind(this)
    this.reportQueueSize = this.reportQueueSize.bind(this)
    this.startTimers = this.startTimers.bind(this)
    this.stopTimers = this.stopTimers.bind(this)

    // Encapsulate constants
    this.PIN_CID_INTERVAL = 60000 * 32 // 32 minutes
    // this.PIN_CID_INTERVAL = 60000 * 12 // 12 minutes
    this.REBOOT_INTERVAL = 60000 * 60 * 4 // 4 hours
  }

  // Start all the time-based controllers.
  startTimers () {
    // Any new timer control functions can be added here. They will be started
    // when the server starts.
    // this.pinCidsHandle = setInterval(this.pinCids, this.PIN_CID_INTERVAL)

    // Periodically report the number of files in the download queue
    setInterval(this.reportQueueSize, 60000 * 10)

    this.rebootHandle = setInterval(this.autoReboot, this.REBOOT_INTERVAL)

    // Start the pinCids() function after a few minutes after startup, once
    // the Helia node has had time to connect to the IPFS network.
    setTimeout(this.pinCids, 60000 * 4)

    return true
  }

  stopTimers () {
    clearInterval(this.pinCidsHandle)
  }

  reportQueueSize () {
    try {
      const queueSize = this.useCases.ipfs.retryQueue.validationQueue.size
      console.log(`There are ${queueSize} promises in the download queue.`)
    } catch (err) {
      console.error('Error in timer-controllers.js/reportQueueSize(): ', err)
      // Do not throw an error. This is a top-level function.
      return false
    }
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

      let promiseQueueSize = this.useCases.ipfs.retryQueue.validationQueue.size
      console.log(`${promiseQueueSize} promises in queue at start of Timer Controller.`)

      // Get all pins in the database
      const pins = await Pins.find({})
      console.log(`There are ${pins.length} Pin Claims in the database.`)

      const numTrackedPins = this.useCases.ipfs.pinTrackerCnt
      console.log(`There are ${numTrackedPins} Pin Claims currently being tracked.`)

      for (let i = 0; i < pins.length; i++) {
        const thisPin = pins[i]

        await this.useCases.ipfs.pinCidForTimerController(thisPin)
      }

      promiseQueueSize = this.useCases.ipfs.retryQueue.validationQueue.size
      console.log(`${promiseQueueSize} promises in queue at end of Timer Controller.`)

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

  // This timer is used to auto-reboot the processes. If this is being run in Docker container
  // (the target for production), the Docker container should automatically restart the timer.
  // This is a temporary fix to the IPFS node stalling occasionally until a better fix can be
  // found.
  autoReboot () {
    console.log('Rebooting service.')
    process.exit(1)
  }
}

export default TimerControllers
