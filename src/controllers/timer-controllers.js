/*
  This Controller library is concerned with timer-based functions that are
  kicked off periodically.
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

    // Constants
    this.cleanUsageInterval = 60000 * 60 // 1 hour
    this.backupUsageInterval = 60000 * 10 // 10 minutes

    // Encapsulate dependencies
    this.config = config

    // Bind 'this' object to all subfunctions.
    this.pinCids = this.pinCids.bind(this)
    this.autoReboot = this.autoReboot.bind(this)
    this.reportQueueSize = this.reportQueueSize.bind(this)
    this.startTimers = this.startTimers.bind(this)
    this.stopTimers = this.stopTimers.bind(this)
    this.cleanUsage = this.cleanUsage.bind(this)
    this.clearDownloadTries = this.clearDownloadTries.bind(this)

    // Encapsulate constants
    this.FIRST_PIN_CID_DELAY = 60000 * 4 // 4 minutes
    this.PIN_CID_INTERVAL = 60000 * 10 // 10 minutes
    this.REBOOT_INTERVAL = 60000 * 60 * 6 // 6 hours
    this.CLEAR_DOWNLOAD_TRIES_INTERVAL = 60000 * 60 * 5.5 // 5.5 hours
    this.REPORT_QUEUE_SIZE_INTERVAL = 60000 * 2 // 2 minutes
    this.CLEAN_USAGE_INTERVAL = 60000 * 60 // 1 hour
    this.cleanUsage = this.cleanUsage.bind(this)
    this.backupUsage = this.backupUsage.bind(this)
  }

  // Start all the time-based controllers.
  startTimers () {
    // Any new timer control functions can be added here. They will be started
    // when the server starts.

    // Start the pinCids() function a few minutes after startup, once
    // the Helia node has had time to connect to the IPFS network.
    setTimeout(this.pinCids, this.FIRST_PIN_CID_DELAY)

    // Periodically report the number of files in the download queue
    setInterval(this.reportQueueSize, this.REPORT_QUEUE_SIZE_INTERVAL)

    // Clean up usage metrics
    this.cleanUsageHandle = setInterval(this.cleanUsage, this.CLEAN_USAGE_INTERVAL)

    // Clear the downloadTries property of each Pin object in the database.
    // This allows file downloads to be retried, but only after all files have
    // attempted to be downloaded at least 10 times.
    setTimeout(this.clearDownloadTries, this.CLEAR_DOWNLOAD_TRIES_INTERVAL)

    // Periodically reboot this app. Helia has a slight memory leak, and occasionally
    // runs into unrecoverable network issues. Rebooting is one way to overcome these
    // black-box issues.
    this.rebootHandle = setInterval(this.autoReboot, this.REBOOT_INTERVAL)
    this.cleanUsageHandle = setInterval(this.cleanUsage, this.cleanUsageInterval)
    this.backupUsageHandle = setInterval(this.backupUsage, this.backupUsageInterval)

    return true
  }

  stopTimers () {
    clearInterval(this.pinCidsHandle)
    clearInterval(this.cleanusageHandle)
  }

  reportQueueSize () {
    try {
      console.log('reportQueueSize() Timer Controller fired.')

      const queueSize = this.useCases.ipfs.retryQueue.validationQueue.size
      console.log(`There are ${queueSize} promises in the download queue.`)
      return queueSize
    } catch (err) {
      console.error('Error in timer-controllers.js/reportQueueSize(): ', err)
      // Do not throw an error. This is a top-level function.
      clearInterval(this.cleanUsageHandle)
      clearInterval(this.backupUsageHandle)

      return false
    }
  }

  // Clean the usage state so that stats reflect the last 24 hours.
  cleanUsage () {
    try {
      clearInterval(this.cleanUsageHandle)

      const now = new Date()
      console.log(`cleanUsage() Timer Controller executing at ${now.toLocaleString()}`)

      this.useCases.usage.cleanUsage()

      this.cleanUsageHandle = setInterval(this.cleanUsage, this.cleanUsageInterval)

      return true
    } catch (err) {
      console.error('Error in time-controller.js/cleanUsage(): ', err)

      this.cleanUsageHandle = setInterval(this.cleanUsage, this.cleanUsageInterval)

      // Note: Do not throw an error. This is a top-level function.
      return false
    }
  }

  // Periodically check the database of pins and create a download/pin request
  // if one has not already been created.
  async pinCids () {
    try {
      let now = new Date()
      console.log(`pinCids() Timer Controller STARTED at ${now.toLocaleString()}`)

      // Stop the timer interval from executing if a previous instance is still
      // executing.
      clearInterval(this.pinCidsHandle)

      const Pins = this.adapters.localdb.Pins

      let promiseQueueSize = this.useCases.ipfs.retryQueue.validationQueue.size
      console.log(`${promiseQueueSize} promises in queue at start of Timer Controller.`)

      // Get all pins in the database
      const pins = await Pins.find({})
      console.log(`There are ${pins.length} Pin Claims in the database.`)

      const downloadedPins = pins.filter(pin => pin.dataPinned)
      console.log(`${downloadedPins.length} Pin Claims have been downloaded and pinned.`)

      const numTrackedPins = this.useCases.ipfs.pinTrackerCnt
      console.log(`There are ${numTrackedPins} Pin Claims currently being tracked.`)

      // // Reverse the order of processing the pins. Start with the most-recent first.
      // for (let i = pins.length - 1; i >= 0; i--) {
      //   const thisPin = pins[i]

      //   // After 10 tries, stop trying to pin the file. It needs manual intervention.
      //   if (thisPin.downloadTries < 10) {
      //     await this.useCases.ipfs.pinCidForTimerController(thisPin)
      //   }
      // }

      // Order the pins in ascending order based on the downloadTries property.
      const orderedPins = pins.sort((a, b) => a.downloadTries - b.downloadTries)

      // Limit the number of pins to process in each round.
      let numberOfPinsToProcess = 30
      if (orderedPins.length < 30) numberOfPinsToProcess = orderedPins.length

      // Pin the files that have had the fewest tries first.
      for (let i = 0; i < numberOfPinsToProcess; i++) {
        const thisPin = orderedPins[i]
        if (thisPin.downloadTries < 5) {
          await this.useCases.ipfs.pinCidForTimerController(thisPin)
        }
      }

      promiseQueueSize = this.useCases.ipfs.retryQueue.validationQueue.size
      console.log(`${promiseQueueSize} promises in queue at end of Timer Controller.`)

      now = new Date()
      console.log(`pinCids() Timer Controller FINISHED at ${now.toLocaleString()}`)

      // Restart the timer interval after it completes.
      this.pinCidsHandle = setInterval(this.pinCids, this.PIN_CID_INTERVAL)

      return true
    } catch (err) {
      console.error('Error in timer-controllers.js/pinCids(): ', err)
      // Do not throw an error. This is a top-level function.
      return false
    }
  }

  // This function is intended to be called no more than once per day.
  // It clears the downloadTries property of each Pin object in the database.
  // This allows file downloads to be retried, but only after all files have
  // attempted to be downloaded at least 10 times.
  async clearDownloadTries () {
    try {
      const Pins = this.adapters.localdb.Pins
      const pins = await Pins.find({})
      for (let i = 0; i < pins.length; i++) {
        const thisPin = pins[i]
        thisPin.downloadTries = 0
        await thisPin.save()
      }

      return true
    } catch (err) {
      console.error('Error in timer-controllers.js/clearDownloadTries(): ', err)
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

  // Backup the usage stats to the database
  async backupUsage () {
    try {
      clearInterval(this.backupUsageHandle)

      console.log('backupUsage() Timer Controller executing at ', new Date().toLocaleString())

      // Clear the database of old usage data.
      await this.useCases.usage.clearUsage()

      // Save the current usage snapshot to the database.
      await this.useCases.usage.saveUsage()

      this.backupUsageHandle = setInterval(this.backupUsage, this.backupUsageInterval)

      return true
    } catch (err) {
      console.error('Error in time-controller.js/backupUsage(): ', err)

      this.backupUsageHandle = setInterval(this.backupUsage, this.backupUsageInterval)

      // Note: Do not throw an error. This is a top-level function.
      return false
    }
  }
}

export default TimerControllers
