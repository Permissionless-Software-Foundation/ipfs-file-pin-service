/*
  Database model for tracking pinned IPFS files.
*/

// Global npm libraries
import mongoose from 'mongoose'

// Local libraries
// import config from '../../../../config/index.js'

const Pin = new mongoose.Schema({
  // PS010 v2.0.0: historical name, now holds the BCH payment txid (PS010 §7.5).
  proofOfBurnTxid: { type: String },
  cid: { type: String },
  filename: { type: String },
  claimTxid: { type: String },
  // Historical name, now holds the BCH payment TX data.
  pobTxDetails: { type: Object },
  claimTxDetails: { type: Object },
  // PS010 v2.0.0 payment fields.
  paymentKind: { type: String, default: 'bch-payment' },
  satsPaid: { type: Number, default: 0 }, // Satoshis paid to payoutAddress
  payoutAddress: { type: String }, // Payout address the payment was validated against
  // Legacy PSF-token field: retained so old documents still load. New records
  // never write it (PS010 §8.2).
  tokensBurned: { type: Number },
  validClaim: { type: Boolean, default: null },
  dataPinned: { type: Boolean, default: false },
  address: { type: String, default: null },
  recordTime: { type: Number },
  downloadTries: { type: Number, default: 0 },
  lastDownloadAttempt: { type: Number, default: null }, // ms epoch of last download attempt
  nextRetryAt: { type: Number, default: 0 }, // ms epoch; 0 = immediately eligible
  fileSize: { type: Number, default: null }, // Size in bytes
  claimTxids: { type: Array, default: [] },
  // Legacy name: now accumulates superseded BCH payment txids.
  pobTxids: { type: Array, default: [] }
})

export default mongoose.model('pin', Pin)
