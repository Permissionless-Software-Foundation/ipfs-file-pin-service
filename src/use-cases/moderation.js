/*
  Use cases library for enforcing moderation rules on the Pin Claims.
*/

// Local libraries
import config from '../../config/index.js'

class ModerationUseCases {
  constructor (localConfig = {}) {
    // Dependency injection
    this.adapters = localConfig.adapters
    if (!this.adapters) {
      throw new Error(
        'Instance of adapters must be passed in when instantiating IPFS Use Cases library.'
      )
    }

    // Encapsulate dependencies
    this.config = config

    // Bind 'this' object to all subfunctions
    this.enforceModerationRules = this.enforceModerationRules.bind(this)
  }

  // This function is called by a Timer Controller. Any CIDs in the array are
  // un-pinned and deleted from the IPFS node.
  async enforceModerationRules () {
    try {
      if (this.config.useModeration) {
        // Dynamically import each moderation library
        const moderationLibs = this.config.moderationLibs
        this.moderationArray = [] // Default value

        // Combine all dynamically imported libraries into a single array.
        for (const libName of moderationLibs) {
          // Dynamic import. Each imported library is expected to be an array
          // of objects.
          const mod = await import(libName)
          this.moderationArray = this.moderationArray.concat(mod.default)
        }
        console.log('this.moderationArray', this.moderationArray)

        // Pins MongoDB model.
        const Pins = this.adapters.localdb.Pins

        // Loop through each file in the moderation array.
        for (let i = 0; i < this.moderationArray.length; i++) {
          const file = this.moderationArray[i]
          console.log('file', file)

          // See if we have the file in the database.
          const pin = await Pins.findOne({ filename: file.filename })
          if (pin) {
            console.log('pin', pin)
          } else {
            console.log('pin not found')
          }
        }
      }
    } catch (err) {
      console.error('Error in moderation.js/enforceModerationRules()')
      throw err
    }
  }
}

export default ModerationUseCases
