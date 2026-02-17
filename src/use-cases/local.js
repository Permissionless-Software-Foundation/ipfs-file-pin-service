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
  }

  // Get all local pin entries from the database.
  async getAll () {
    const localPins = await this.adapters.localdb.LocalPins.find({})

    return localPins
  }
}

export default LocalUseCases
