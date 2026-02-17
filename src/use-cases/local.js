/*
  Use cases library for working with local pins.
*/

class LocalUseCases {
  constructor (localConfig = {}) {
    this.adapters = localConfig.adapters
    if (!this.adapters) {
      throw new Error(
        'Instance of adapters must be passed in when instantiating Local Use Cases library.'
      )
    }

    // Bind 'this' object to all subfunctions
    this.getAll = this.getAll.bind(this)
    this.deleteByCid = this.deleteByCid.bind(this)
  }

  // Get all local pin entries from the database.
  async getAll () {
    const localPins = await this.adapters.localdb.LocalPins.find({})

    return localPins
  }

  // Delete a local pin by CID. Unpins from the IPFS node and removes the
  // database model.
  async deleteByCid (inObj = {}) {
    const { cid } = inObj

    if (!cid || typeof cid !== 'string') {
      throw new Error("Property 'cid' must be a string!")
    }

    // Find the local pin model by CID.
    const localPin = await this.adapters.localdb.LocalPins.findOne({ CID: cid })
    if (!localPin) {
      throw new Error(`No local pin found with CID: ${cid}`)
    }

    // Unpin the CID from the IPFS node.
    await this.adapters.ipfs.ipfs.pins.rm(cid)

    // Delete the local pin model from the database.
    await localPin.remove()

    return localPin
  }
}

export default LocalUseCases
