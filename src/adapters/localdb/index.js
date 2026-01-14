/*
  This library encapsulates code concerned with MongoDB and Mongoose models.
*/

// Load Mongoose models.
import Users from './models/users.js'
import Pins from './models/pins.js'
import LocalPins from './models/local-pins.js'
import Usage from './models/usage.js'

class LocalDB {
  constructor () {
    // Encapsulate dependencies
    this.Users = Users
    this.Pins = Pins
    this.LocalPins = LocalPins
    this.Usage = Usage
  }
}

export default LocalDB
