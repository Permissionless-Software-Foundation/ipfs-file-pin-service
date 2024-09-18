/*
  Use cases library for working with the IPFS node.
*/

// Global npm libraries
import Wallet from 'minimal-slp-wallet'
import { CID } from 'multiformats'
import RetryQueue from '@chris.troutner/retry-queue'
import Stream, { Duplex } from 'stream'

// Local libraries
import PinEntity from '../entities/pin.js'
import config from '../../config/index.js'

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

    this.bchjs = this.wallet.bchjs
    this.retryQueue = new RetryQueue({
      concurrency: 20,
      timeout: 60000 * 5 // 5 minute timeout
    })
    this.pinEntity = new PinEntity()
    this.CID = CID
    this.config = config

    // Bind 'this' object to all subfunctions
    this.processPinClaim = this.processPinClaim.bind(this)
    this.pinCid = this.pinCid.bind(this)
    this._getCid = this._getCid.bind(this)
    this._getTokenQtyDiff = this._getTokenQtyDiff.bind(this)
    this.getPinStatus = this.getPinStatus.bind(this)
    this.downloadCid = this.downloadCid.bind(this)
    this.validateSizeAndPayment = this.validateSizeAndPayment.bind(this)
    this.getPinClaims = this.getPinClaims.bind(this)
    this.pinCidForTimerController = this.pinCidForTimerController.bind(this)
    this._tryToGetCid = this._tryToGetCid.bind(this)

    // State
    this.pinTracker = {} // track promises for pinning content
    this.pinTrackerCnt = 0
    this.pinSuccess = 0
    // this.promiseQueueSize = 0
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
      console.log('Waiting 30 seconds to let TXs get processed...')
      await this.wallet.bchjs.Util.sleep(30000)

      // Get TX details for the proof-of-burn TX.
      let pobTxDetails = await this.wallet.getTxData([proofOfBurnTxid])
      pobTxDetails = pobTxDetails[0]
      // console.log('pobTxDetails: ', pobTxDetails)

      // Get TX details for the pin claim.
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

      const { cid, tokensBurned, filename } = pinData

      // console.log(`Attempting to pinning CID: ${cid}`)

      // Get the file so that we have it locally.
      // console.log(`Getting file ${cid}`)

      const cidClass = this.CID.parse(cid)
      // console.log('cidClass: ', cidClass)

      // console.log(`Starting download of ${cid} at ${now.toISOString()}`)

      // let fileSize = null

      // If the pin is already being tracked, then skip.
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
      const fileSize = await this.retryQueue.addToQueue(this._getCid, { cid: cidClass })

      if (!fileSize && fileSize !== 0) {
        console.log(`Download of ${filename} (${cid}) failed. Removing from tracker for retry.`)
        delete this.pinTracker[cid]
        this.pinTrackerCnt--

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
      const isValid = await this.validateSizeAndPayment({ fileSize, tokensBurned })

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

      const { cid } = pinData

      // console.log(`Attempting to pinning CID: ${cid}`)

      // Get the file so that we have it locally.
      // console.log(`Getting file ${cid}`)

      // const cidClass = this.CID.parse(cid)
      // console.log('cidClass: ', cidClass)

      // console.log(`Starting download of ${cid} at ${now.toISOString()}`)

      // let fileSize = null

      // If the pin is already being tracked, then skip.
      if (this.pinIsBeingTracked(cid)) {
        // console.log('This pin is already being tracked. Skipping.')
        return true
      }

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
      const { cid, tokensBurned, filename, dataPinned } = pinData
      const cidClass = this.CID.parse(cid)

      // Add the CID to the tracker, so that we don't try to download or pin
      // the same file twice.
      const tracker = this.trackPin(cid)

      // If the model in the database says the file is already pinned and
      // validated, then ensure the file is actually pinned and exit.
      if (dataPinned) {
        // Pin the file
        try {
          await this.adapters.ipfs.ipfs.pins.add(cidClass)
        } catch (err) {
          // if (err.message.includes('Already pinned')) {
          //   console.log(`CID ${cid} already pinned.`)
          // } else {
          //   throw err
          // }
        }
        return true
      }

      const fileSize = await this.retryQueue.addToQueue(this._getCid, { cid: cidClass })
      // const fileSize = await this._getCid({ cid: cidClass })

      // If filesize is undefined, then the download was not successful.
      //
      if (!fileSize && fileSize !== 0) {
        // console.log(`Download of ${filename} (${cid}) failed. Removing from tracker for retry.`)
        delete this.pinTracker[cid]
        this.pinTrackerCnt--

        return false
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
      const isValid = await this.validateSizeAndPayment({ fileSize, tokensBurned })

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
        await pinData.save()
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

        // pinData.dataPinned = false
        // pinData.validClaim = false
        // await pinData.save()

        return false
      }
    } catch (err) {
      console.error('Error in tryToGetCid(): ', err)
      throw err
    }
  }

  // This function returns true if the pin claim matches the following requirments:
  // - The file is less than the maximum file size set in the config.
  // - An appropriate amount of PSF tokens were burnt, relative to the size of the file.
  // Otherwise it returns false.
  async validateSizeAndPayment (inObj = {}) {
    try {
      const { fileSize, tokensBurned } = inObj
      console.log('tokensBurned: ', tokensBurned)

      // Return false if the file is larger than the configured max size.
      const fileSizeIsValid = fileSize < this.config.maxPinSize
      if (!fileSizeIsValid) {
        return false
      }

      // Get the cost in PSF tokens to store 1MB
      const writePrice = await this.adapters.writePrice.getMcWritePrice()
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
      await this.adapters.ipfs.ipfs.blockstore.get(cid)

      const stats = await this.adapters.ipfs.ipfs.fs.stat(cid)
      // console.log('file stats: ', stats)

      return Number(stats.fileSize)

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

  // This is called by the /ipfs/pin-status/:cid REST API endpoint.
  // It returns the pinning status of the file identied by the CID.
  async getPinStatus (inObj = {}) {
    try {
      const { cid } = inObj

      if (!cid) throw new Error('CID is undefined')

      const Pins = this.adapters.localdb.Pins
      const existingModel = await Pins.find({ cid })
      // console.log('existingModel: ', existingModel)

      return existingModel[0]
    } catch (err) {
      console.error('Error in use-cases/ipfs.js/getPinStatus()')
      throw err
    }
  }

  // Download a pinned file, given its CID.
  async downloadCid (inObj = {}) {
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
      console.log('returning stream. downloadCid() done.')

      return { filename, readStream }
    } catch (err) {
      console.error('Error in use-cases/ipfs.js/dowloadCid()')
      throw err
    }
  }

  // Get the last 20 pin claim entries added to the database.
  async getPinClaims (inObj = {}) {
    try {
      console.log('inObj: ', inObj)

      const Pins = this.adapters.localdb.Pins

      const unsortedPins = await Pins.find({})

      const sortedPins = unsortedPins.sort(function (a, b) {
        return b.recordTime - a.recordTime
      })

      let pinLen = 20
      if (sortedPins.length < 20) { pinLen = sortedPins.length }

      const pins = []
      for (let i = 0; i < pinLen; i++) {
        const thisPin = sortedPins[i]

        // Extract selected properties for export.
        const { proofOfBurnTxid, cid, claimTxid, address, filename, validClaim, dataPinned, tokensBurned, recordTime } = thisPin

        const downloadLink = `${this.config.domainName}/ipfs/download/${cid}`
        const viewLink = `${this.config.domainName}/ipfs/view/${cid}`

        const outObj = { proofOfBurnTxid, cid, claimTxid, address, filename, validClaim, dataPinned, tokensBurned, recordTime, downloadLink, viewLink }
        pins.push(outObj)
      }

      // console.log('pins: ', pins)

      return {
        success: true,
        pins
      }
    } catch (err) {
      console.error('Error in use-cases/ipfs.js/getPinClaims()')
      throw err
    }
  }
}

export default IpfsUseCases
