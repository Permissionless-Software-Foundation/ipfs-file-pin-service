/*
  Use cases library for working with the IPFS node.

  OLD will be deleted:
  Dev Note about 'Pin Tracker':
  - The pin tracker tracks Pin Claims that have been validated.
  - All Pin Claims in the database are added to the tracker in the first
    iteration of the Timer Controller.
  - If they are valid in the database or get validated by the Timer Controller,
    they are removed from the tracker.
  - If they fail to download, they are added to the tracker.

  Dev Note about 'Pin Tracker':
  - The pin tracker tracks Pin Claims that still need to be downloaded, validated, and pinned.
  - If Pin Claims are reviewed at each iteration of the Timer Controller.
  - If a Pin Claim is already pinned, it is skipped and not added to the pin tracker.
  - ... ?
*/

// Global npm libraries
import Wallet from 'minimal-slp-wallet'
import { CID } from 'multiformats'
import RetryQueue from '@chris.troutner/retry-queue'
import Stream, { Duplex } from 'stream'
import PSFFPP from 'psffpp'
import fs from 'fs'
// Local libraries
import PinEntity from '../entities/pin.js'
import config from '../../config/index.js'
import LocalPinsEntity from '../entities/local-pins.js'

const PSF_TOKEN_ID = '38e97c5d7d3585a2cbf3f9580c82ca33985f9cb0845d4dcce220cb709f9538b0'

class IpfsUseCases {
  constructor (localConfig = {}) {
    // console.log('User localConfig: ', localConfig)
    this.adapters = localConfig.adapters
    if (!this.adapters) {
      throw new Error(
        'Instance of adapters must be passed in when instantiating IPFS Use Cases library.'
      )
    }

    // Encapsulate dependencies

    // Switch between web 2 and web 3 interface.
    if (config.walletInterface === 'web2') {
      this.wallet = new Wallet(undefined, {
        interface: 'rest-api',
        restURL: config.apiServer
      })
    } else {
      this.wallet = new Wallet(undefined, {
        interface: 'consumer-api',
        restURL: 'https://free-bch.fullstack.cash'
      })
    }
    this.fs = fs
    this.bchjs = this.wallet.bchjs
    this.retryQueue = new RetryQueue({
      concurrency: 20,
      attempts: 0,
      timeout: 60000 * 5 // Note: Timeout feature does not work is v1.0.10
    })
    this.pinEntity = new PinEntity()
    this.localPinsEntity = new LocalPinsEntity()
    this.CID = CID
    this.config = config

    // Bind 'this' object to all subfunctions
    this.processPinClaim = this.processPinClaim.bind(this)
    this.pinCid = this.pinCid.bind(this)
    this.pinCidForTimerController = this.pinCidForTimerController.bind(this)
    this._tryToGetCid = this._tryToGetCid.bind(this)
    this.validateSizeAndPayment = this.validateSizeAndPayment.bind(this)
    this._getCid = this._getCid.bind(this)
    this._getCidWithTimeout = this._getCidWithTimeout.bind(this)
    this._getTokenQtyDiff = this._getTokenQtyDiff.bind(this)
    this.trackPin = this.trackPin.bind(this)
    this.pinIsBeingTracked = this.pinIsBeingTracked.bind(this)
    this.removePinFromTracker = this.removePinFromTracker.bind(this)
    this.getPinStatus = this.getPinStatus.bind(this)
    this.downloadFile = this.downloadFile.bind(this)
    this.downloadCid = this.downloadCid.bind(this)
    this.getPinClaims = this.getPinClaims.bind(this)
    this.getUnprocessedPins = this.getUnprocessedPins.bind(this)
    this.pinLocalFile = this.pinLocalFile.bind(this)

    // State
    this.pinTracker = {} // track promises for pinning content
    this.pinTrackerCnt = 0 // See Dev Note at top of file.
    this.pinSuccess = 0
    this.writePrice = null
    this.psffpp = null // placeholder
    // this.promiseQueueSize = 0
  }

  // Get the cost to write 1MB per year of data to the PSFFPP network.
  async getWritePrice (inObj = {}) {
    try {
      const { claimTxDetails } = inObj
      console.log('getWritePrice() claimTxDetails: ', claimTxDetails)

      // Old code
      // if (!this.writePrice) {
      //   this.writePrice = await this.adapters.writePrice.getMcWritePrice()
      // }
      // return this.writePrice

      if (!this.psffpp) {
        this.psffpp = new PSFFPP({ wallet: this.wallet })
      }

      // this.writePrice = await this.retryQueue.addToQueue(this.psffpp.getMcWritePrice, {})
      // console.log('this.writePrice: ', this.writePrice)

      const writeHistory = await this.retryQueue.addToQueue(this.psffpp.getWritePriceHistory, {})
      console.log('claimTxDetails() writeHistory: ', writeHistory)

      const height = claimTxDetails.height

      if (!height) {
        // Return the current write price if this is an unconfirmed TX.
        this.writePrice = writeHistory[0].writePrice
      } else {
        // Return the price for the block height of the claim.
        const price = writeHistory.find(element => element.height <= height)
        this.writePrice = price.writePrice
      }

      return this.writePrice
    } catch (err) {
      this.writePrice = 0.03570889

      console.error(`Error in use-cases/ipfs.js/getWritePrice(). Returning hard-coded value of ${this.writePrice}.`)

      return this.writePrice
    }
  }

  // Process a new pin claim by adding it to the database.
  // This function is called by the REST API /ipfs/pin-claim controller.
  async processPinClaim (inObj = {}) {
    try {
      console.log('processPinClaim() this.wallet.bchjs.restURL: ', this.wallet.bchjs.restURL)
      console.log('processPinClaim() this.wallet.ar.interface: ', this.wallet.ar.interface)

      const now = new Date()

      console.log(`processPinClaim() inObj at ${now.toLocaleString()}: `, inObj)
      const { proofOfBurnTxid, cid, claimTxid, filename, address } = inObj

      // Wait a few seconds to ensure the TXs have syndicated and been processed
      // by the infrastructure.
      console.log('Waiting 3 seconds to let TXs get processed...')
      await this.wallet.bchjs.Util.sleep(3000)

      // Get TX details for the proof-of-burn TX.
      let pobTxDetails = await this.wallet.getTxData([proofOfBurnTxid])
      pobTxDetails = pobTxDetails[0]
      // console.log('pobTxDetails: ', pobTxDetails)

      // Get TX details for the pin claim.
      console.log('processPinClaim() claimTxid: ', claimTxid)
      let claimTxDetails = await this.wallet.getTxData([claimTxid])
      claimTxDetails = claimTxDetails[0]
      // console.log('claimTxDetails: ', claimTxDetails)

      // Return false if PoB TX is not a valid SLP TX.
      if (!pobTxDetails.isValidSlp) {
        return {
          success: false,
          details: 'Proof-of-burn not a valid SLP transaction.'
        }
      }

      // Return false if tokenId does not match.
      if (pobTxDetails.tokenId !== PSF_TOKEN_ID) {
        console.log(`PoB TX ${pobTxDetails.txid} does not consume a valid token.`)

        return {
          success: false,
          details: 'Proof-of-burn does not consume a valid token'
        }
      }

      // Get the difference, or the amount of PSF tokens burned.
      const tokensBurned = this._getTokenQtyDiff(pobTxDetails)
      console.log('PSF tokens burned: ', tokensBurned)

      const dbModelInput = this.pinEntity.validate({
        proofOfBurnTxid,
        cid,
        filename,
        claimTxid,
        pobTxDetails,
        claimTxDetails,
        tokensBurned,
        address
      })

      const Pins = this.adapters.localdb.Pins

      // Code below commented out because of the following corner cases:
      // - If CID was previously submitted with too small of PoB, the claim
      //   can be re-submitted with proper PoB.
      // - Same CID is re-submitted to renew the pinning for another year.
      // Check to see CID is not already in database.
      let dbModel = await Pins.findOne({ cid })
      if (dbModel) {
        console.log(`A database model for CID ${cid} already exists. Existing state:`)
        console.log(`validClaim: ${dbModel.validClaim}`)
        console.log(`dataPinned: ${dbModel.dataPinned}`)

        if (dbModel.validClaim && !dbModel.dataPinned) {
          console.log(`CID ${cid} already has valid pin claim and is awaiting download.`)
          return {
            success: true,
            details: 'CID already has valid pin claim and is awaiting download.'
          }
        } else if (dbModel.validClaim && dbModel.dataPinned) {
          console.log(`CID ${cid} already has valid pin claim. It has already been downloaded and pinned.`)
          return {
            success: true,
            details: 'CID already has valid pin claim. It has already been downloaded and pinned.'
          }
        }
      } else {
        // Create the database model for this pin claim.
        dbModel = new Pins(dbModelInput)
        await dbModel.save()
        console.log('Pin Claim added to database.')
      }

      // Do not await, so that the process is not blocked
      this.pinCid(dbModel)

      return {
        success: true,
        details: `Pinned new file with CID: ${cid}`
      }
    } catch (err) {
      console.error('Error in processPinClaim(): ', err)
      throw err
    }
  }

  // Given a pin claim model from the database, this function tries to pin
  // the CID with the IPFS node attached to this app.
  // This function is called by the pinCids() in the Timer Controller.
  async pinCid (pinData = {}) {
    try {
      // console.log('pinData: ', pinData)

      const { cid, tokensBurned, filename, claimTxDetails } = pinData
      // console.log('pinCid() claimTxDetails: ', claimTxDetails)

      // console.log(`Attempting to pinning CID: ${cid}`)

      // Get the file so that we have it locally.
      // console.log(`Getting file ${cid}`)

      const cidClass = this.CID.parse(cid)
      // console.log('cidClass: ', cidClass)

      // console.log(`Starting download of ${cid} at ${now.toISOString()}`)

      // let fileSize = null

      // If the pin is already being tracked, then skip.
      // Dev Note: This code block needs to be above the download code, so that
      // multiple downloads do not stack up.
      let tracker
      if (this.pinIsBeingTracked(cid)) {
        console.log('This pin is already being tracked. Skipping.')
        return true
      } else {
        tracker = this.trackPin(cid)
      }

      let now = new Date()
      console.log(`Validating pin claim for ${filename} with CID ${pinData.cid} at ${now.toLocaleString()}`)

      // Download the file and return the size of the file.
      const fileSize = await this.retryQueue.addToQueue(this._getCidWithTimeout, { cid: cidClass })

      // If fileSize = undefined then download was unsuccessful.
      if (!fileSize && fileSize !== 0) {
        console.log(`Download of ${filename} (${cid}) failed. Removing from tracker for retry.`)
        // delete this.pinTracker[cid]
        // this.pinTrackerCnt--

        return false
      }

      // const file = await this.adapters.ipfs.ipfs.blockstore.get(cidClass)
      // console.log('pinCid() file: ', file)
      // fileSize = file.length
      console.log(`CID ${cid} is ${fileSize} bytes big.`)

      now = new Date()
      console.log(`Finished download of ${cid} at ${now.toISOString()}`)

      // Validate that the Pin Claim has appropriate payment, and is under max
      // size requirement.
      // const isValid = await this.validateSizeAndPayment({ fileSize, tokensBurned })
      const isValid = await this.retryQueue.addToQueue(this.validateSizeAndPayment, { fileSize, tokensBurned, claimTxDetails })
      console.log('pinCid() isValid: ', isValid)

      this.pinTrackerCnt--
      tracker.isValid = isValid
      tracker.completed = true

      if (isValid) {
        // Pin the file
        try {
          await this.adapters.ipfs.ipfs.pins.add(cidClass)
        } catch (err) {
          if (err.message.includes('Already pinned')) {
            console.log(`CID ${cid} already pinned.`)
          } else {
            throw err
          }
        }

        this.pinSuccess++
        console.log(`Pinned file ${cid}. ${this.pinSuccess} files successfully pinned.`)

        pinData.dataPinned = true
        pinData.validClaim = true
        pinData.fileSize = parseInt(fileSize)
        await pinData.save()
      } else {
        // If the file does meet the size requirements, then unpin it.
        console.log(`File ${cid} is bigger than max size of ${this.config.maxPinSize} bytes or did not include proper PoB. Unpinning file.`)

        // 9-24 CT: Commenting this out as I think it is causing the IPFS node
        // to hang and stop answering calls to download data.
        // Maybe try removing the 'await' call?
        //
        // Delete the file from the blockstore
        // await this.adapters.ipfs.ipfs.blockstore.delete(cidClass)

        try {
          // Remove pin from database, so that it does not keep getting downloaded
          // and pinning retried.
          const Pins = this.adapters.localdb.Pins
          const existingModel = await Pins.findOne({ cid })
          console.log('existingModel: ', existingModel)
          await existingModel.remove()
          console.log(`Database model for ${cid} deleted.`)
        } catch (err) {
          console.error(`Could not delete DB model for CID ${cid}. Error: `, err)
        }

        pinData.dataPinned = false
        pinData.validClaim = false
        await pinData.save()

        return false
      }

      // This is used by Timer Controller to report the number of outstanding
      // files to download.
      // this.promiseQueueSize = this.retryQueue.validationQueue.size
      // console.log(`Download requested for ${queueSize} files.`)

      return true
    } catch (err) {
      console.error('Error in pinCid(): ', err)
      throw err
    }
  }

  async pinCidForTimerController (pinData = {}) {
    try {
      // console.log('pinData: ', pinData)

      // const { cid } = pinData

      // console.log(`Attempting to pinning CID: ${cid}`)

      // Get the file so that we have it locally.
      // console.log(`Getting file ${cid}`)

      // const cidClass = this.CID.parse(cid)
      // console.log('cidClass: ', cidClass)

      // console.log(`Starting download of ${cid} at ${now.toISOString()}`)

      // let fileSize = null

      // If the pin is already being tracked, then skip.
      // if (this.pinIsBeingTracked(cid)) {
      //   // console.log('This pin is already being tracked. Skipping.')
      //   return true
      // }

      // const now = new Date()
      // console.log(`Pinning ${filename} with CID ${cid} at ${now.toLocaleString()}`)

      // Returns a promise, be do not await. Fire-and-forget.
      // this.retryQueue.addToQueue(this._tryToGetCid, { pinData })
      this._tryToGetCid({ pinData })

      // This is used by Timer Controller to report the number of outstanding
      // files to download.
      // this.promiseQueueSize = this.retryQueue.validationQueue.size
      // console.log(`Download requested for ${queueSize} files.`)

      return true
    } catch (err) {
      console.error('Error in pinCidForTimerController(): ', err)
      throw err
    }
  }

  // This function is consumed by pinCidForTimerController(). It returns a
  // promise that resolves once the file is downloaded and passes validity
  // checks.
  // This is designed to be a fire-and-forget call by the Timer Controller.
  async _tryToGetCid (inObj = {}) {
    try {
      const { pinData } = inObj
      const { cid, tokensBurned, filename, dataPinned, validClaim, claimTxDetails } = pinData
      const cidClass = this.CID.parse(cid)
      // console.log('_tryToGetCid() claimTxDetails: ', claimTxDetails)

      // Exit if the file is already pinned.
      if (dataPinned) return true

      console.log(`Processing CID ${cid}. validClaim: ${validClaim}, dataPinned: ${dataPinned}`)

      // Add the CID to the tracker, so that we don't try to download or pin
      // the same file twice.
      // const tracker = this.trackPin(cid)

      const fileSize = await this.retryQueue.addToQueue(this._getCidWithTimeout, { cid: cidClass })
      // const fileSize = await this._getCid({ cid: cidClass })
      console.log(`File size for ${cid}: `, fileSize)

      // If fileSize = undefined then download was unsuccessful.
      if (!fileSize) {
        // console.log(`Download of ${filename} (${cid}) failed. Removing from tracker for retry.`)
        // this.removePinFromTracker(cid)
        // Dev Note: File could not be downloaded, so do not remove from tracker.

        // If the download failed, increment the database model's downloadTries.
        let tries = pinData.downloadTries
        tries++
        pinData.downloadTries = tries
        await pinData.save()

        return false
      }

      // Dev Note: This call to pin content must come AFTER the CID is downloaded,
      // otherwise the Promise returned from pin.add() will never resolve.
      //
      // If the model in the database says the file is already pinned and
      // validated, then ensure the file is actually pinned and exit.
      /**
       *  DEV NOTE (05/02/25):
       *  This validation is already handled at the start of this function
       *  Maybe this validation should be removed?
       */
      if (dataPinned) {
        // Pin the file
        try {
          // console.log(`Pinning ${cid}...`)
          await this.adapters.ipfs.ipfs.pins.add(cidClass)
          // console.log(`...finished pinning ${cid}\n`)
        } catch (err) {
          if (err.message.includes('Already pinned')) {
            console.log(`CID ${cid} already pinned.`)
          } else {
            throw err
          }
        }

        // Remove the CID from the pin tracker.
        // this.removePinFromTracker(cid)
        return true
      }

      // const file = await this.adapters.ipfs.ipfs.blockstore.get(cidClass)
      // console.log('pinCid() file: ', file)
      // fileSize = file.length
      console.log(`CID ${cid} with filename ${filename} is ${fileSize} bytes big.`)

      const now = new Date()
      console.log(`Finished download of ${filename}, ${cid} at ${now.toISOString()}`)

      // TODO: Replace this with a validation function.
      // const isValid = true
      // let isValid = false
      // if (fileSize < this.config.maxPinSize) {
      //   isValid = true
      // }
      // const isValid = await this.validateSizeAndPayment({ fileSize, tokensBurned })
      const isValid = await this.retryQueue.addToQueue(this.validateSizeAndPayment, { fileSize, tokensBurned, claimTxDetails })
      console.log('_tryToGetCid() isValid: ', isValid)

      // tracker.isValid = isValid
      // tracker.completed = true

      if (isValid) {
        // Pin the file
        try {
          await this.adapters.ipfs.ipfs.pins.add(cidClass)
        } catch (err) {
          if (err.message.includes('Already pinned')) {
            console.log(`CID ${cid} already pinned.`)
          } else {
            throw err
          }
        }

        // this.removePinFromTracker(cid)

        this.pinSuccess++
        console.log(`Pinned file ${cid}. ${this.pinSuccess} files successfully pinned.\n`)

        pinData.dataPinned = true
        pinData.validClaim = true
        await pinData.save()
        return true
      } else {
        // If the file does meet the size requirements, then unpin it.
        console.log(`File ${cid} is bigger than max size of ${this.config.maxPinSize} bytes. Unpinning file.`)

        // 9/13/24 CT: Trying to delete the file causes the IPFS node to freeze.
        // For now I'll try deleting the DB model to prevent the timer controller
        // from continually trying to download and validate the file.

        // Delete the file from the blockstore
        // await this.adapters.ipfs.ipfs.blockstore.delete(cidClass)
        // console.log(`Deleted CID ${cid}`)

        try {
          // Remove pin from database, so that it does not keep getting downloaded
          // and pinning retried.
          const Pins = this.adapters.localdb.Pins
          const existingModel = await Pins.findOne({ cid })
          console.log('existingModel: ', existingModel)
          await existingModel.remove()
          console.log(`Database model for ${cid} deleted.`)
        } catch (err) {
          console.error(`Could not delete DB model for CID ${cid}. Error: `, err)
        }

        // Dev Note: Do not remove the CID from the pin tracker here, as we do not
        // want to try and re-download this big file.

        // pinData.dataPinned = false
        // pinData.validClaim = false
        // await pinData.save()

        return false
      }
    } catch (err) {
      console.error('Error in _tryToGetCid(): ', err)

      console.log('_tryToGetCid() inObj: ', inObj)

      throw err
    }
  }

  // This function returns true if the pin claim matches the following requirments:
  // - The file is less than the maximum file size set in the config.
  // - An appropriate amount of PSF tokens were burnt, relative to the size of the file.
  // Otherwise it returns false.
  async validateSizeAndPayment (inObj = {}) {
    try {
      const { fileSize, tokensBurned, claimTxDetails } = inObj
      console.log('tokensBurned: ', tokensBurned)
      // console.log('validateSizeAndPayment() claimTxDetails: ', claimTxDetails)

      // Return false if the file is larger than the configured max size.
      const fileSizeIsValid = fileSize < this.config.maxPinSize
      if (!fileSizeIsValid) {
        return false
      }

      // Get the cost in PSF tokens to store 1MB
      let writePrice
      if (!this.writePrice) {
        // this.writePrice = await this.adapters.writePrice.getMcWritePrice()
        this.writePrice = await this.getWritePrice({ claimTxDetails })
        writePrice = this.writePrice
      } else {
        writePrice = this.writePrice
      }
      console.log('writePrice: ', writePrice)

      // Calculate costs in PSF tokens for this pin request.
      // const minCost = writePrice
      // console.log('fileSize: ', fileSize)
      // const mbCost = fileSize / 1000000 * writePrice
      // console.log(`minCost: ${writePrice}, mbCost: ${mbCost}`)
      //
      // // Validate that enough PSF tokens were paid for this pin.
      // if (tokensBurned < minCost && tokensBurned < mbCost) {
      //   return false
      // }

      // Calculate costs in PSF tokens for this pin request.
      const mbCost = fileSize / 1000000 * writePrice
      const minCost = mbCost * 0.98
      console.log('minCost: ', minCost)

      // Validate that enough PSF tokens were paid for this pin.
      if (tokensBurned < minCost) {
        console.error(`Tokens burned were ${tokensBurned}, but required cost is ${mbCost}`)
        return false
      }

      return true
    } catch (err) {
      console.error('Error in validateSizeAndPayment()')
      throw err
    }
  }

  // This function wraps the IPFS get() function so that it can be called by
  // the retry queue.
  async _getCid (inObj = {}) {
    const { cid } = inObj

    try {
      console.log(`Trying to download CID ${cid}...`)

      // This command seems to be hanging and not downloading the files.
      await this.adapters.ipfs.ipfs.blockstore.get(cid)

      // This way throws a 'not a file' error when processing Token Tiger JSON files.
      // Trying alternate way to download file
      // const fs = this.adapters.ipfs.ipfs.fs
      // const chunks = []
      // for await (const buf of fs.cat(cid)) {
      //   // console.info(buf)
      //   chunks.push(buf)
      // }
      // console.log(`CID ${cid} downloaded successfully. chunks.length: ${chunks.length}`)

      // Get the file size and other stats on the file.
      const stats = await this.adapters.ipfs.ipfs.fs.stat(cid)
      // console.log('file stats: ', stats)

      let fileSize = Number(stats.fileSize)

      // Handle the case where the CID is a directory.
      // fileSize === undefined means it's a directory.
      // fileSize === 0 means the download failed.
      if (!fileSize) {
        // console.log(`cid ${cid} has a file size of: `, fileSize)

        // list cid content
        const contentArray = []
        for await (const file of this.adapters.ipfs.ipfs.fs.ls(cid)) {
          contentArray.push(file)
        }
        // console.log('_getCid() Handling directory corner case.contentArray: ', contentArray)

        // Get the size of each file in the directory.
        let totalSize = 0
        for (const file of contentArray) {
          const thisFileSize = file.size
          totalSize += Number(thisFileSize)
        }
        console.log(`Total size of directory ${cid} is: ${totalSize}`)
        fileSize = totalSize
      }

      return fileSize

      // const fs = this.adapters.ipfs.ipfs.fs
      // const chunks = []
      // for await (const buf of fs.cat(cid)) {
      //   // console.info(buf)
      //   chunks.push(buf)
      // }
      // console.log('File downloaded successfully.')
      //
      // const fileBuf = Buffer.from(chunks)
      // return fileBuf
    } catch (err) {
      console.error('Error in _getCid(): ', err)
      throw err
    }
  }

  // This function is a wrapper for _getCid(). If _getCid() does not resolve
  // within 5 minutes, then this function will reject the Promise with an error.
  // This prevents _getCid from blocking downloads of other CIDs for too long.
  async _getCidWithTimeout (inObj = {}) {
    return new Promise((resolve, reject) => {
      const { cid } = inObj

      // The Promise will reject after a period of time.
      const timeout = 60000 * 5 // 5 minutes
      const timer = setTimeout(() => {
        console.log(`CID ${cid} did not finish downloading after ${timeout / 60000} minutes`)
        reject(new Error(`Operation timed out after ${timeout} ms`))
      }, timeout)

      this._getCid(inObj)
        .then((result) => {
          console.log(`Finished downloading CID ${cid}`)
          // If the download is successful, then clear the timer and resolve with
          // the downloaded data.
          clearTimeout(timer)
          resolve(result)
        })
        .catch((err) => {
          // If there is an error, clear the timer and reject with that error.
          clearTimeout(timer)
          reject(err)
        })
    })
  }

  // Get the differential token qty between the inputs and outputs of a tx.
  // This determins if the tx was a proper token burn.
  _getTokenQtyDiff (txInfo) {
    try {
      // Input validation
      if (!txInfo) {
        throw new Error('txInfo is required')
      }
      if (!txInfo.vin || !txInfo.vout) {
        throw new Error('txInfo must contain vin and vout array')
      }

      // Sum up all the token inputs
      let inputTokenQty = 0
      for (let i = 0; i < txInfo.vin.length; i++) {
        let tokenQty = 0
        if (!txInfo.vin[i].tokenQty) {
          tokenQty = 0
        } else {
          tokenQty = Number(txInfo.vin[i].tokenQty)
        }
        inputTokenQty += tokenQty
      }
      // console.log(`inputTokenQty: ${inputTokenQty}`)

      // Sum up all the token outputs
      let outputTokenQty = 0
      for (let i = 0; i < txInfo.vout.length; i++) {
        let tokenQty = 0
        if (!txInfo.vout[i].tokenQty) {
          tokenQty = 0
        } else {
          tokenQty = Number(txInfo.vout[i].tokenQty)
        }
        outputTokenQty += tokenQty
      }
      // console.log(`outputTokenQty: ${outputTokenQty}`)

      let diff = inputTokenQty - outputTokenQty
      diff = this.bchjs.Util.floor8(diff)
      // console.log(`token difference (burn): ${diff}`)

      return diff
    } catch (err) {
      console.error('Error in _getTokenQtyDiff: ', err.message)
      throw err
    }
  }

  // Update the state to indicate that a download attempt is in progress for
  // this CID.
  trackPin (cid) {
    const obj = {
      // cid,
      created: new Date(),
      completed: false,
      isValid: true // Assume valid
    }

    if (!this.pinTracker[cid]) {
      this.pinTracker[cid] = obj
      this.pinTrackerCnt++
    }

    // console.log(`pinTracker has ${this.pinTrackerCnt} entries.`)

    return this.pinTracker[cid]
  }

  // Returns true if the CID is already being tracked. Otherwise returns false.
  pinIsBeingTracked (cid) {
    const thisPromise = this.pinTracker[cid]

    if (thisPromise) return true

    return false
  }

  // Remove a pin from the tracker.
  removePinFromTracker (cid) {
    // TODO : verify that the cid is in the tracker
    delete this.pinTracker[cid]
    this.pinTrackerCnt-- // TODO : pin tracker count maybe can be handle with  the pin tracker object keys length

    return true
  }

  // This is called by the /ipfs/pin-status/:cid REST API endpoint.
  // It returns the pinning status of the file identied by the CID.
  async getPinStatus (inObj = {}) {
    try {
      const { cid } = inObj

      if (!cid) throw new Error('CID is undefined')

      const Pins = this.adapters.localdb.Pins
      const existingModel = await Pins.find({ cid })
      console.log(`existingModel for CID ${cid}: `, existingModel)

      return existingModel[0]
    } catch (err) {
      console.error('Error in use-cases/ipfs.js/getPinStatus()')
      throw err
    }
  }

  // Download a pinned file to a client, given its CID.
  // The 'file' is differentiated from a CID, in that the file has a pin claim
  // which has been validated, and the file has been downloaded and pinned already.
  async downloadFile (inObj = {}) {
    try {
      const { cid, name, listDir } = inObj
      if (!cid) throw new Error('CID is undefined')

      const Pins = this.adapters.localdb.Pins
      let existingModel = await Pins.find({ cid })
      existingModel = existingModel[0]
      // console.log('existingModel: ', existingModel)

      // Display summary debug data on the model.
      try {
        const { validClaim, dataPinned, address, proofOfBurnTxid, claimTxid, tokensBurned, recordTime } = existingModel
        const formattedModel = { validClaim, dataPinned, address, proofOfBurnTxid, claimTxid, tokensBurned, recordTime, cid, filename: existingModel.filename }
        console.log(`db model data: ${JSON.stringify(formattedModel, null, 2)}`)
      } catch (err) {}

      if (!existingModel) {
        throw new Error(`Database model for CID ${cid} does not exist.`)
      }

      if (!existingModel.dataPinned) {
        throw new Error('File has not been pinned. Not available.')
      }

      const helia = this.adapters.ipfs.ipfs

      // list cid content
      const contentArray = []
      for await (const file of helia.fs.ls(cid)) {
        contentArray.push(file)
      }
      // console.log('contentArray', contentArray)

      // If a name is not provided, detect if the provided cid is a directory or a single file.
      /**
      *  If the cid is a directory
       * The next block of code sends a html page with a list of links with the file names into the directory.
       * Skipping this code delivers directly the first file detected in the directory.
       */
      const isDir = contentArray[0].path.match('/') // TODO : looking for a better way to detect if is a directory
      console.log('isDir: ', isDir, contentArray[0])
      // 'listDir' is a flag to ignore this code on /download endpoint.
      if (isDir && !name && listDir) {
        console.log('This CID is a directory')
        const stream = new Stream.Readable({ read () { } })
        for (let i = 0; i < contentArray.length; i++) {
          const cont = contentArray[i]
          // List all paths excluding root path.
          if (cont.path !== cid) {
            // Add links to the gateway with the format  cid/:filename
            stream.push(`<a href='${this.config.domainName}/ipfs/view/${cid}/${cont.name}' >/${cont.name} ( CID:  ${cont.cid} )</a><hr />`)
          }
        }

        stream.push(null)
        // return fileName as html because the controller the library <mime.lookup> sends it as html
        return { filename: contentArray[0].name + '.html', readStream: stream }
      } else {
        console.log('This CID is not a directory.')
      }

      let fullCid = cid
      // if endpoint path does not have a provided name, looking into content array for
      // file names.
      if (!name) {
        console.log('Looking for filename.')
        for (let i = 0; i < contentArray.length; i++) {
          const cont = contentArray[i]
          // if a content name is different than the provided cid, possibly means the provided cid is a directory
          if (cont.name !== cid) {
            // Choose the first file found into ipfs node.
            fullCid = `${cid}/${cont.name}`
            break
          }
        }
      } else {
        console.log(`filename is ${name}`)
        // if the endpoint path its  /cid/:filename
        fullCid = `${cid}/${name}`
      }

      console.log('creating buffer')
      // Convert the file to a Buffer.
      const fileChunks = []
      for await (const chunk of helia.fs.cat(fullCid)) {
        fileChunks.push(chunk)
      }
      const fileBuf = Buffer.concat(fileChunks)
      console.log('buffer created')

      // Convert the Buffer into a readable stream
      console.log('converting buffer to stream')
      const bufferToStream = (myBuffer) => {
        const tmp = new Duplex()
        tmp.push(myBuffer)
        tmp.push(null)
        return tmp
      }
      const readStream = bufferToStream(fileBuf)

      const filename = existingModel.filename
      console.log('returning stream. downloadFile() done.')

      return { filename, readStream }
    } catch (err) {
      console.error('Error in use-cases/ipfs.js/dowloadFile()')
      throw err
    }
  }

  // Try to download a random CID.
  // This is used to try to download any random CID. It is not restricted to
  // Pin Claims. This can be used to download CIDs from other nodes on the
  // network that have a file privately pinned.
  async downloadCid (inObj = {}) {
    try {
      const { cid } = inObj
      if (!cid) throw new Error('CID is undefined')

      const helia = this.adapters.ipfs.ipfs

      console.log('Attemping to download CID: ', cid)

      // list cid content
      const contentArray = []
      for await (const file of helia.fs.ls(cid)) {
        console.log('file: ', file)
        contentArray.push(file)
      }
      // console.log('contentArray', contentArray)

      // If a name is not provided, detect if the provided cid is a directory or a single file.
      /**
      *  If the cid is a directory
       * The next block of code sends a html page with a list of links with the file names into the directory.
       * Skipping this code delivers directly the first file detected in the directory.
       */
      // const isDir = contentArray[0].path.match('/') // TODO : looking for a better way to detect if is a directory
      // console.log('isDir: ', isDir, contentArray[0])
      // // 'listDir' is a flag to ignore this code on /download endpoint.
      // if (isDir && !name && listDir) {
      //   console.log('This CID is a directory')
      //   const stream = new Stream.Readable({ read () { } })
      //   for (let i = 0; i < contentArray.length; i++) {
      //     const cont = contentArray[i]
      //     // List all paths excluding root path.
      //     if (cont.path !== cid) {
      //       // Add links to the gateway with the format  cid/:filename
      //       stream.push(`<a href='${this.config.domainName}/ipfs/view/${cid}/${cont.name}' >/${cont.name} ( CID:  ${cont.cid} )</a><hr />`)
      //     }
      //   }

      //   stream.push(null)
      //   // return fileName as html because the controller the library <mime.lookup> sends it as html
      //   return { filename: contentArray[0].name + '.html', readStream: stream }
      // } else {
      //   console.log('This CID is not a directory.')
      // }

      const fullCid = cid
      // // if endpoint path does not have a provided name, looking into content array for
      // // file names.
      // if (!name) {
      //   console.log('Looking for filename.')
      //   for (let i = 0; i < contentArray.length; i++) {
      //     const cont = contentArray[i]
      //     // if a content name is different than the provided cid, possibly means the provided cid is a directory
      //     if (cont.name !== cid) {
      //       // Choose the first file found into ipfs node.
      //       fullCid = `${cid}/${cont.name}`
      //       break
      //     }
      //   }
      // } else {
      //   console.log(`filename is ${name}`)
      //   // if the endpoint path its  /cid/:filename
      //   fullCid = `${cid}/${name}`
      // }

      console.log('creating buffer')
      // Convert the file to a Buffer.
      const fileChunks = []
      for await (const chunk of helia.fs.cat(fullCid)) {
        fileChunks.push(chunk)
      }
      const fileBuf = Buffer.concat(fileChunks)
      console.log('buffer created')

      // Convert the Buffer into a readable stream
      console.log('converting buffer to stream')
      const bufferToStream = (myBuffer) => {
        const tmp = new Duplex()
        tmp.push(myBuffer)
        tmp.push(null)
        return tmp
      }
      const readStream = bufferToStream(fileBuf)

      // const filename = existingModel.filename
      console.log('returning stream. downloadCid() done.')

      return { readStream }
    } catch (err) {
      console.error('Error in use-cases/ipfs.js/dowloadCid()')
      throw err
    }
  }

  // Get the last 20 pin claim entries added to the database.
  async getPinClaims (inObj = {}) {
    try {
      console.log('inObj: ', inObj)

      const PAGE_SIZE = 20
      const page = inObj.page || 1 // Default to first page if not specified
      const skip = (page - 1) * PAGE_SIZE

      const Pins = this.adapters.localdb.Pins

      // Get total count for pagination info
      const totalPins = await Pins.countDocuments({})
      const totalPages = Math.ceil(totalPins / PAGE_SIZE)

      // Get paginated results, pre-sorted by recordTime descending
      const sortedPins = await Pins.find({})
        .sort({ recordTime: -1 })
        .skip(skip)
        .limit(PAGE_SIZE)

      const pins = sortedPins.map(thisPin => {
        // Extract selected properties for export
        const {
          proofOfBurnTxid,
          cid,
          claimTxid,
          address,
          filename,
          validClaim,
          dataPinned,
          tokensBurned,
          recordTime,
          fileSize
        } = thisPin

        const downloadLink = `${this.config.domainName}/ipfs/download/${cid}`
        const viewLink = `${this.config.domainName}/ipfs/view/${cid}`

        return {
          proofOfBurnTxid,
          cid,
          claimTxid,
          address,
          filename,
          validClaim,
          dataPinned,
          tokensBurned,
          recordTime,
          downloadLink,
          viewLink,
          fileSize
        }
      })

      return {
        success: true,
        pagination: {
          currentPage: page,
          totalPages,
          pageSize: PAGE_SIZE,
          totalItems: totalPins
        },
        pins
      }
    } catch (err) {
      console.error('Error in use-cases/ipfs.js/getPinClaims()')
      throw err
    }
  }

  // Get an array of pins that have a validClaim property of null.
  async getUnprocessedPins () {
    try {
      const Pins = this.adapters.localdb.Pins
      const pins = await Pins.find({ validClaim: null })
      // console.log(`getUnprocessedPins(): ${JSON.stringify(pins, null, 2)}`)

      return pins
    } catch (err) {
      console.error('Error in use-cases/ipfs.js/getUnprocessedPins(): ', err)
      throw err
    }
  }

  async pinLocalFile (inObj = {}) {
    try {
      const { file } = inObj

      const filename = file.originalFilename
      const size = file.size
      console.log(`File ${filename} with size ${size} bytes recieved.`)

      // Reject if file is bigger than 100 MB.
      // const maxFileSize = 100000000
      // if (size > maxFileSize) {
      //   throw new Error(`File exceeds max file size of ${maxFileSize}`)
      // }

      const readStream = this.fs.createReadStream(file.filepath)
      // console.log('readStream: ', readStream)

      const fileObj = {
        path: filename,
        content: readStream
      }
      // console.log('fileObj: ', fileObj)

      const options = {
        cidVersion: 1,
        wrapWithDirectory: true
      }

      const fileData = await this.adapters.ipfs.ipfs.fs.addFile(fileObj, options)
      console.log('fileData: ', fileData)
      const cid = fileData.toString()

      try {
        // Pin the CID to the IPFS node.
        for await (const chunk of this.adapters.ipfs.ipfs.pins.add(fileData)) { console.log('ipfs add chunk: ', chunk) }
        // Validate the data and create a new LocalPins entity.
        const localPinsEntity = this.localPinsEntity.validate({
          CID: cid,
          fileSize: size,
          filename
        })
        console.log('localPinsEntity: ', localPinsEntity)
        // Create a new LocalPins model.
        const localPinsModel = new this.adapters.localdb.LocalPins(localPinsEntity)
        // Save the model to the database.
        await localPinsModel.save()
      } catch (err) {
        // If the CID is already pinned, log a message and continue.
        if (err.message.includes('Already pinned')) {
          console.log(`CID ${cid} already pinned.`)
        } else {
          // If the CID is not pinned, throw an error.
          throw err
        }
      }

      return {
        success: true,
        cid
      }
    } catch (err) {
      console.error('Error in ipfs-use-cases.js/pinLocalFile()')
      throw err
    }
  }
}

export default IpfsUseCases
