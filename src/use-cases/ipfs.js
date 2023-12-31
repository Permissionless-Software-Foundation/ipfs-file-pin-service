/*
  Use cases library for working with the IPFS node.
*/

// Global npm libraries
import Wallet from 'minimal-slp-wallet'
import { CID } from 'multiformats'
import RetryQueue from '@chris.troutner/retry-queue'

// Local libraries
import PinEntity from '../entities/pin.js'

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
    this.wallet = new Wallet(undefined, {
      interface: 'consumer-api',
      restURL: 'https://free-bch.fullstack.cash'
    })
    this.bchjs = this.wallet.bchjs
    this.retryQueue = new RetryQueue({
      concurrency: 6
    })
    this.pinEntity = new PinEntity()

    // Bind 'this' object to all subfunctions
    this.processPinClaim = this.processPinClaim.bind(this)
    this.pinCid = this.pinCid.bind(this)
    this._getCid = this._getCid.bind(this)
    this._getTokenQtyDiff = this._getTokenQtyDiff.bind(this)

    // State
    this.promiseTracker = {} // track promises for pinning content
    this.promiseTrackerCnt = 0
    this.pinSuccess = 0
  }

  // Process a new pin claim by adding it to the database.
  // This function is called by the REST API /ipfs/pin-claim controller.
  async processPinClaim (inObj = {}) {
    try {
      console.log('processPinClaim() inObj: ', inObj)
      const { proofOfBurnTxid, cid, claimTxid } = inObj

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
        claimTxid,
        pobTxDetails,
        claimTxDetails,
        tokensBurned
      })

      const Pins = this.adapters.localdb.Pins

      // TODO: Check to see CID is not already in database.
      const existingModel = Pins.find({ cid })
      if (existingModel.length) {
        return {
          success: true,
          details: 'CID already being tracked by database'
        }
      }

      // Create the database model for this pin claim.
      const dbModel = new Pins(dbModelInput)
      await dbModel.save()
      console.log('Pin Claim added to database.')

      // TODO: Try to pin CID immediately
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
      console.log('pinData: ', pinData)

      const { cid } = pinData

      console.log(`Attempting to pinning CID: ${cid}`)

      // Get the file so that we have it locally.
      // console.log(`Getting file ${cid}`)

      const cidClass = CID.parse(cid)
      // console.log('cidClass: ', cidClass)

      let now = new Date()
      // console.log(`Starting download of ${cid} at ${now.toISOString()}`)

      let fileSize = null

      const queueSize = this.retryQueue.validationQueue.size
      console.log(`Download requested for ${queueSize} files.`)

      // If the pin is already being tracked, then skip.
      let tracker
      if (this.pinIsBeingTracked(cid)) {
        console.log('This pin is already being tracked. Skipping.')
        return true
      } else {
        tracker = this.trackPin(cid)
      }

      const file = await this.retryQueue.addToQueue(this._getCid, { cid: cidClass })
      // const file = await this.adapters.ipfs.ipfs.blockstore.get(cidClass)
      fileSize = file.length
      console.log(`CID ${cid} is ${fileSize} bytes big.`)

      now = new Date()
      console.log(`Finished download of ${cid} at ${now.toISOString()}`)

      // TODO: Replace this with a validation function.
      const isValid = true

      this.promiseTrackerCnt--
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
      } else {
        // If the file does meet the size requirements, then unpin it.
        console.log(`File ${cid} is bigger than max size of ${this.config.maxPinSize} bytes. Unpinning file.`)

        // Delete the file from the blockstore
        await this.adapters.ipfs.ipfs.blockstore.delete(cidClass)

        return false
      }

      return true
    } catch (err) {
      console.error('Error in pinCid(): ', err)
      throw err
    }
  }

  // This function wraps the IPFS get() function so that it can be called by
  // the retry queue.
  async _getCid (inObj = {}) {
    const { cid } = inObj

    try {
      const file = await this.adapters.ipfs.ipfs.blockstore.get(cid)
      return file
    } catch (err) {
      console.error('Error in _getCid(): ', err)
      throw err
    }
  }

  // Get the differential token qty between the inputs and outputs of a tx.
  // This determins if the tx was a proper token burn.
  // This function is consumed by _validateTx()
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

    this.promiseTracker[cid] = obj
    this.promiseTrackerCnt++

    console.log(`promiseTracker has ${this.promiseTrackerCnt} entries.`)

    return this.promiseTracker[cid]
  }

  // Returns true if the CID is already being tracked. Otherwise returns false.
  pinIsBeingTracked (cid) {
    const thisPromise = this.promiseTracker[cid]

    if (thisPromise) return true

    return false
  }
}

export default IpfsUseCases
