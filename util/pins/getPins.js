import mongoose from 'mongoose'
import config from '../../config/index.js'
import Pins from '../../src/adapters/localdb/models/pins.js'

async function getPins () {
  // Connect to the Mongo Database.
  mongoose.Promise = global.Promise
  mongoose.set('useCreateIndex', true) // Stop deprecation warning.
  await mongoose.connect(
    config.database,
    { useNewUrlParser: true, useUnifiedTopology: true }
  )

  const pins = await Pins.find({})
  console.log(`pins: ${JSON.stringify(pins, null, 2)}`)

  mongoose.connection.close()
}
getPins()
