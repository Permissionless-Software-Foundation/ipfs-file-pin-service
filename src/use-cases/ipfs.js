/*
  Use cases library for working with the IPFS node.
*/

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
  }

  // Process a new pin claim. Validate it, and pin the content if validation succeeds.
  processPinClaim(inObj = {}) {
    try {
      console.log('processPinClaim() inObj: ', inObj)
      const {proofOfBurnTxid, cid, claimTxid} = inObj

      return true
    } catch(err) {
      console.error('Error in processPinClaim()')
      throw err
    }
  }
}

export default IpfsUseCases
