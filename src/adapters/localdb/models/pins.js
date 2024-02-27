/*
  Database model for tracking pinned IPFS files.
*/

// Global npm libraries
import mongoose from 'mongoose'

// Local libraries
// import config from '../../../../config/index.js'

const Pin = new mongoose.Schema({
  proofOfBurnTxid: { type: String },
  cid: { type: String },
  filename: { type: String },
  claimTxid: { type: String },
  pobTxDetails: { type: Object },
  claimTxDetails: { type: Object },
  tokensBurned: { type: Number },
  validClaim: { type: Boolean, default: null },
  dataPinned: { type: Boolean, default: false },
  address: { type: String, default: null }
})

export default mongoose.model('pin', Pin)
