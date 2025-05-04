/*
  Use cases library for enforcing moderation rules on the Pin Claims.
*/

// Global libraries
import { CID } from 'multiformats'

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
    this.CID = CID

    // Bind 'this' object to all subfunctions
    this.enforceModerationRules = this.enforceModerationRules.bind(this)
  }

  // This function is called by a Timer Controller. Any CIDs in the array are
  // un-pinned and deleted from the IPFS node.
  async enforceModerationRules () {
    try {
      if (this.config.useModeration) {
        const now = new Date()
        console.log(`Started enforceModerationRules() at ${now.toLocaleString()}`)

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

        // Database model tracking all pinned files.
        const Pins = this.adapters.localdb.Pins

        // Loop through each file in the moderation array.
        for (let i = 0; i < this.moderationArray.length; i++) {
          const file = this.moderationArray[i]
          // console.log('file', file)

          // See if we have the file in the database.
          const pin = await Pins.findOne({ filename: file.filename })
          if (pin) {
            // console.log('pin', pin)

            // Convert the CID from a string to a CID Class object.
            const cidClass = this.CID.parse(pin.cid)

            if (pin.dataPinned) {
              // Delete the file from the IPFS node.
              await this.adapters.ipfs.ipfs.blockstore.delete(cidClass)
              console.log(`Deleted file ${pin.filename} with CID ${pin.cid} from IPFS node.`)
            }

            // Unpin the file from the IPFS node.
            await this.adapters.ipfs.ipfs.pins.rm(cidClass)
            console.log(`Unpinned file ${pin.filename} with CID ${pin.cid} from IPFS node.`)

            // Delete the pin from the database.
            await pin.remove()
          }
        }
      }
    } catch (err) {
      console.error('Error in moderation.js/enforceModerationRules()')
      throw err
    }

    const now = new Date()
    console.log(`Finished enforceModerationRules() at ${now.toLocaleString()}`)
  }
}

export default ModerationUseCases
