/*
  Local ipfs pins
*/

// Global npm libraries
import mongoose from 'mongoose'

const localPins = new mongoose.Schema({
  CID: { type: String, required: true, unique: true },
  filename: { type: String, required: true },
  fileSize: { type: Number, required: true },
  datePinned: { type: Date, required: true, default: Date.now }
})

export default mongoose.model('localPins', localPins)
