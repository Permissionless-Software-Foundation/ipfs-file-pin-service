
// Global npm libraries
import axios from 'axios'
import MultisigApproval from 'psf-multisig-approval'
import SlpWallet from 'minimal-slp-wallet'

// Local libraries
import config from '../../config/index.js'
// import WalletAdapter from './wallet.js'
import WritePriceModel from './localdb/models/write-price.js'

class WritePrice {
  constructor (localConfig = {}) {
    // Encapsulate dependencies

    // Switch between web 2 and web 3 interface.
    if (config.walletInterface === 'web2') {
      this.wallet = new SlpWallet(undefined, {
        interface: 'rest-api',
        restURL: config.apiServer
      })
    } else {
      this.wallet = new SlpWallet(undefined, {
        interface: 'consumer-api',
        restURL: 'https://free-bch.fullstack.cash'
      })
    }

    this.bchjs = undefined // placeholder
    this.ps009 = null // placeholder
    this.axios = axios
    this.config = config
    this.WritePriceModel = WritePriceModel

    // state
    this.currentRate = config.reqTokenQty
    this.currentRateInBch = null
    this.priceHistory = []
    this.filterTxids = [] // Tracks invalid approval TXs

    // Bind 'this' object to class subfunctions.
    this.initialize = this.initialize.bind(this)
    // this.getWriteCostInBch = this.getWriteCostInBch.bind(this)
    // this.getPsfPriceInBch = this.getPsfPriceInBch.bind(this)
    this.getMcWritePrice = this.getMcWritePrice.bind(this)
    // this.updateCurrentRateInBch = this.updateCurrentRateInBch.bind(this)
  }

  // Pass a wallet instance into this library. This function is required to prevent
  // circular dependencies at startup.
  async initialize (inObj = {}) {
    const { wallet } = inObj
    if (!wallet) {
      throw new Error('Wallet instance required when initializing the write-price adapter.')
    }

    // Wait for the BCH wallet to create the wallet.
    await this.wallet.walletInfoPromise

    this.bchjs = this.wallet.bchjs
    this.ps009 = new MultisigApproval({ wallet: this.wallet })

    return true
  }

  // This function calls getPsfPrice() to get the price of PSF tokens in BCH.
  // It then calculates and returns the cost to write to the P2WDB in BCH.
  // That includes a markup cost for the service of providing PSF tokens to
  // the user. The market cost is set in the config file.
  // async getWriteCostInBch () {
  //   // On the first call, wait to get the proper BCH write price.
  //   // On subsequent calls, update the write price in the background and use the cached value.
  //   if (!this.currentRateInBch) {
  //     await this.updateCurrentRateInBch()
  //   } else {
  //     this.updateCurrentRateInBch()
  //   }
  //
  //   return this.currentRateInBch
  // }

  // This function updates the current write price in BCH.
  // It's intended to be called without await, so that it updates the rate in the background.
  // async updateCurrentRateInBch () {
  //   try {
  //     // For debugging. Write the current balance of the wallet and token balance.
  //     const bchBalance = await this.wallet.bchWallet.getBalance()
  //     console.log('App wallet BCH balance: ', bchBalance)
  //
  //     const tokenBalance = await this.wallet.bchWallet.listTokens()
  //     console.log('App wallet SLP balance: ', tokenBalance)
  //
  //     const bchPerToken = await this.getPsfPriceInBch()
  //
  //     // Cost in BCH + markup.
  //     const costToUser = this.currentRate * bchPerToken * (1 + this.config.psfTradeMarkup)
  //
  //     // Round to 8 decimals.
  //     this.currentRateInBch = this.bchjs.Util.floor8(costToUser)
  //
  //     console.log(`Current write price in BCH: ${this.currentRateInBch}`)
  //
  //     return true
  //   } catch (err) {
  //     console.error('Error in adapters/write-price.js/updateCurrentRateInBch()')
  //     return false
  //
  //     // No need to throw an error here. It will be retried on the next request.
  //   }
  // }

  // Get's the cost of PSF tokens in BCH from the PSF token liquidity app.
  // This value is used to allow users to pay in BCH, and enables the P2WDB
  // to essentailly exchange a PSF tokens for BCH, in order to write to the DB.
  // async getPsfPriceInBch () {
  //   try {
  //     const response = await this.axios.get('https://psfoundation.cash/price')
  //     // console.log('response.data: ', response.data)
  //
  //     const usdPerBch = response.data.usdPerBCH
  //     const usdPerToken = response.data.usdPerToken
  //     const bchPerToken = this.bchjs.Util.floor8(usdPerToken / usdPerBch)
  //     // console.log('bchPerToken: ', bchPerToken)
  //
  //     return bchPerToken
  //   } catch (err) {
  //     console.error('Error in adapters/write-price.js/getPsfPrice(): ', err)
  //     throw err
  //   }
  // }

  // Get the write price set by the PSF Minting Council.
  // This function assumes that transaction history is retrieved from the Cash
  // Stack is sorted in descending order with the biggest (newest) block
  // in the first element in the transaction history array.
  async getMcWritePrice () {
    // Hard codeded value. 04/08/23
    // This value is returned if there are any issues returning the write price.
    // It should be higher than actual fee, so that any writes will propegate to
    // the P2WDB nodes that successfully retrieved the current write price.
    let writePrice = this.config.reqTokenQty

    try {
      const WRITE_PRICE_ADDR = 'bitcoincash:qrwe6kxhvu47ve6jvgrf2d93w0q38av7s5xm9xfehr'
      // Instance the wallet.
      // await this.instanceWallet()
      if (!this.wallet) {
        throw new Error('Call instanceWallet() before calling this function')
      }
      // Find the PS009 approval transaction the addresses tx history.
      console.log('\nSearching blockchain for updated write price...')
      const approvalObj = await this.ps009.getApprovalTx({
        address: WRITE_PRICE_ADDR,
        filterTxids: this.filterTxids
      })
      // console.log('approvalObj: ', JSON.stringify(approvalObj, null, 2))

      // Throw an error if no approval transaction can be found in the
      // transaction history.
      if (approvalObj === null) {
        throw new Error(`APPROVAL transaction could not be found in the TX history of ${WRITE_PRICE_ADDR}. Can not reach consensus on write price.`)
      }

      const { approvalTxid, updateTxid } = approvalObj
      const writePriceModel = await this.WritePriceModel.findOne({ txid: approvalTxid })
      // console.log('writePriceModel: ', writePriceModel)

      // If this approval TX is not in the database, then validate it.
      if (!writePriceModel) {
        console.log(`New approval txid found (${approvalTxid}), validating...`)
        // Get the CID from the update transaction.
        const updateObj = await this.ps009.getUpdateTx({ txid: updateTxid })
        // console.log(`updateObj: ${JSON.stringify(updateObj, null, 2)}`)
        const { cid } = updateObj

        // Resolve the CID into JSON data from the IPFS gateway.
        const updateData = await this.ps009.getCidData({ cid })
        // console.log(`updateData: ${JSON.stringify(updateData, null, 2)}`)

        // Validate the approval transaction
        const approvalIsValid = await this.ps009.validateApproval({
          approvalObj,
          updateObj,
          updateData
        })

        if (approvalIsValid) {
          console.log(`Approval TXID validated. Adding to database: ${approvalTxid}`)
          // If the validation passes, then save the transaction to the database,
          // so the expensive validation process does not need to be repeated.
          const newTx = new this.WritePriceModel({
            txid: approvalTxid,
            isApprovalTx: true,
            verified: true,
            writePrice: updateData.p2wdbWritePrice || updateData.writePrice
          })
          await newTx.save()
          // Return the write price from the update data.
          writePrice = updateData.p2wdbWritePrice || updateData.writePrice
        } else {
          // Approval transaction failed validation.
          console.log(`Approval TXID was found to be invalid: ${approvalTxid}`)
          // Add this invalid TXID to the filter array so that it is skipped.
          this.filterTxids.push(approvalTxid)
          // Continue looking for the correct approval transaction by recursivly
          // calling this function.
          writePrice = await this.getMcWritePrice()
        }
      } else {
        console.log('Previously validated approval transaction retrieved from database.')
        writePrice = writePriceModel.writePrice
      }
    } catch (err) {
      console.error('Error in getMcWritePrice(): ', err)
      console.log(`Using hard-coded, safety value of ${writePrice} PSF tokens per write.`)
    }
    // Save the curent write price to the state.
    this.currentRate = writePrice
    return writePrice
  }
}

export default WritePrice
