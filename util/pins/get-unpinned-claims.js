/*
  Display and pin DB entries that have not been pinned.
*/

import mongoose from 'mongoose'
import config from '../../config/index.js'
import Pins from '../../src/adapters/localdb/models/pins.js'

async function getUnpinnedPins () {
  // Connect to the Mongo Database.
  mongoose.Promise = global.Promise
  mongoose.set('useCreateIndex', true) // Stop deprecation warning.
  await mongoose.connect(
    config.database,
    // 'mongodb://172.17.0.1:5556/ipfs-service-prod',
    { useNewUrlParser: true, useUnifiedTopology: true }
  )

  const pins = await Pins.find({ dataPinned: false })
  // console.log(`unpinnedPins: ${JSON.stringify(pins, null, 2)}`)

  // Remove pobTxDetails and claimTxDetails from the pin data.
  const reducedPins = []
  for(let i=0; i<pins.length; i++) {
    const pin = pins[i]
    
    const { validClaim, dataPinned, address, downloadTries, fileSize, proofOfBurnTxid, cid, claimTxid, filename } = pin

    const reducedPin = { validClaim, dataPinned, address, downloadTries, fileSize, proofOfBurnTxid, cid, claimTxid, filename }

    reducedPins.push(reducedPin)
  }

  console.log(`unpinnedPins: ${JSON.stringify(reducedPins, null, 2)}`)
  console.log(`unpinnedPins length: ${pins.length}`)


  mongoose.connection.close()
}
getUnpinnedPins()
