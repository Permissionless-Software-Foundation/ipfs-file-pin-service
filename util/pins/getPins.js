import mongoose from 'mongoose'
import config from '../../config/index.js'
import Pins from '../../src/adapters/localdb/models/pins.js'

async function getPins () {
  // Connect to the Mongo Database.
  mongoose.Promise = global.Promise
  mongoose.set('useCreateIndex', true) // Stop deprecation warning.
  await mongoose.connect(
    config.database,
    // 'mongodb://172.17.0.1:5556/ipfs-service-prod',
    { useNewUrlParser: true, useUnifiedTopology: true }
  )

  const pins = await Pins.find({})
  console.log(`pins: ${JSON.stringify(pins, null, 2)}`)

  mongoose.connection.close()
}
getPins()
