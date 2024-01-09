/*
  This library encapsulates code concerned with MongoDB and Mongoose models.
*/

// Load Mongoose models.
import Users from './models/users.js'
import Pins from './models/pins.js'

class LocalDB {
  constructor () {
    // Encapsulate dependencies
    this.Users = Users
    this.Pins = Pins
  }
}

export default LocalDB
