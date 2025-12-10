/*
  This library encapsulates code concerned with MongoDB and Mongoose models.
*/

// Load Mongoose models.
import Users from './models/users.js'
import Pins from './models/pins.js'
import LocalPins from './models/local-pins.js'

class LocalDB {
  constructor () {
    // Encapsulate dependencies
    this.Users = Users
    this.Pins = Pins
    this.LocalPins = LocalPins
  }
}

export default LocalDB
