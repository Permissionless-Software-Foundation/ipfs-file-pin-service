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
        this.moderationModules = []

        for (const libName of moderationLibs) {
          // Dynamic import
          const mod = await import(libName)
          this.moderationModules.push(mod)
        }

        // Now you can use this.moderationModules as needed
        // Example: call a function on each module
        // for (const mod of this.moderationModules) {
        //   if (mod.default && typeof mod.default === 'function') {
        //     await mod.default()
        //   }
        // }
      }
    } catch (err) {
      console.error('Error in moderation.js/enforceModerationRules()')
      throw err
    }
  }
}

export default ModerationUseCases
