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
    this.reportQueueSize = this.reportQueueSize.bind(this)
    this.startTimers = this.startTimers.bind(this)
    this.stopTimers = this.stopTimers.bind(this)
    this.cleanUsage = this.cleanUsage.bind(this)

    // Encapsulate constants (pin retry tunables from config)
    this.FIRST_PIN_CID_DELAY = 60000 * 4 // 4 minutes
    this.PIN_CID_INTERVAL = this.config.pinRetryIntervalMs
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

    this.cleanUsageHandle = setInterval(this.cleanUsage, this.cleanUsageInterval)
    this.backupUsageHandle = setInterval(this.backupUsage, this.backupUsageInterval)

    return true
  }

  stopTimers () {
    clearInterval(this.pinCidsHandle)
    clearInterval(this.cleanUsageHandle)
    clearInterval(this.backupUsageHandle)
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

  // Periodically check the database of unpinned claims and create download/pin
  // requests for candidates that are due for retry.
  async pinCids () {
    try {
      let now = new Date()
      console.log(`pinCids() Timer Controller STARTED at ${now.toLocaleString()}`)

      // Stop the timer interval from executing if a previous instance is still
      // executing.
      clearInterval(this.pinCidsHandle)

      const Pins = this.adapters.localdb.Pins
      const nowMs = Date.now()
      const batchSize = this.config.pinRetryBatchSize
      const maxTries = this.config.pinRetryMaxTries
      const quarantineBudget = this.config.pinRetryQuarantineBudget
      const quarantineCooldownMs = this.config.pinRetryQuarantineCooldownMs
      const concurrency = this.config.pinRetryDownloadConcurrency

      let promiseQueueSize = this.useCases.ipfs.retryQueue.validationQueue.size
      console.log(`${promiseQueueSize} promises in queue at start of Timer Controller.`)

      const inFlightCount = this.useCases.ipfs.pinTrackerCnt || 0
      console.log(`There are ${inFlightCount} Pin Claims currently in-flight.`)

      // Cap how many we enqueue based on available download capacity.
      const availableSlots = Math.max(0, concurrency - promiseQueueSize - inFlightCount)
      if (availableSlots === 0) {
        console.log('No available download slots. Skipping this pinCids round.')
        this.pinCidsHandle = setInterval(this.pinCids, this.PIN_CID_INTERVAL)
        return true
      }

      const hotPathLimit = Math.min(batchSize, availableSlots)

      // Hot path: unpinned, under max tries, due for retry.
      const hotPathPins = await Pins.find({
        dataPinned: false,
        downloadTries: { $lt: maxTries },
        nextRetryAt: { $lte: nowMs }
      })
        .sort({ downloadTries: 1, recordTime: -1 })
        .limit(hotPathLimit)

      console.log(`Selected ${hotPathPins.length} hot-path Pin Claims for retry.`)

      const candidates = [...hotPathPins]
      const remainingSlots = availableSlots - candidates.length

      // Soft quarantine: occasionally revive exhausted CIDs.
      if (remainingSlots > 0 && quarantineBudget > 0) {
        const quarantineLimit = Math.min(quarantineBudget, remainingSlots)
        const cooldownCutoff = nowMs - quarantineCooldownMs

        const quarantinePins = await Pins.find({
          dataPinned: false,
          downloadTries: { $gte: maxTries },
          $or: [
            { lastDownloadAttempt: { $exists: false } },
            { lastDownloadAttempt: null },
            { lastDownloadAttempt: { $lte: cooldownCutoff } }
          ]
        })
          .sort({ lastDownloadAttempt: 1 })
          .limit(quarantineLimit)

        console.log(`Selected ${quarantinePins.length} quarantine Pin Claims for revival.`)
        candidates.push(...quarantinePins)
      }

      // Enqueue candidates, skipping any already in-flight.
      let enqueued = 0
      for (const thisPin of candidates) {
        if (this.useCases.ipfs.pinIsBeingTracked(thisPin.cid)) {
          console.log(`Skipping in-flight CID ${thisPin.cid}`)
          continue
        }

        await this.useCases.ipfs.pinCidForTimerController(thisPin)
        enqueued++
      }

      promiseQueueSize = this.useCases.ipfs.retryQueue.validationQueue.size
      console.log(`Enqueued ${enqueued} Pin Claims. ${promiseQueueSize} promises in queue at end of Timer Controller.`)

      now = new Date()
      console.log(`pinCids() Timer Controller FINISHED at ${now.toLocaleString()}`)

      // Restart the timer interval after it completes.
      this.pinCidsHandle = setInterval(this.pinCids, this.PIN_CID_INTERVAL)

      return true
    } catch (err) {
      console.error('Error in timer-controllers.js/pinCids(): ', err)
      // Do not throw an error. This is a top-level function.
      this.pinCidsHandle = setInterval(this.pinCids, this.PIN_CID_INTERVAL)
      return false
    }
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
