/*
  Pin Entity

  PS010 v2.0.0 (BCH payment model). A pin claim records the BCH payment that
  paid for it:
  - `proofOfBurnTxid` keeps its historical name and now holds the payment txid
    (PS010 §5.2, §7.5).
  - `pobTxDetails` keeps its historical name and now holds the payment TX data.
  - `paymentKind` is 'bch-payment' for every new record.
  - `satsPaid` is the satoshis paid to `payoutAddress` by that TX.
  No PSF-token fields are written for new records (PS010 §8.2).
*/

class Pin {
  validate (inObj = {}) {
    const {
      proofOfBurnTxid,
      cid,
      claimTxid,
      pobTxDetails,
      claimTxDetails,
      paymentKind,
      satsPaid,
      payoutAddress,
      filename,
      address
    } = inObj

    // Input Validation
    if (!proofOfBurnTxid || typeof proofOfBurnTxid !== 'string') {
      throw new Error("Property 'proofOfBurnTxid' must be a string!")
    }
    if (!cid || typeof cid !== 'string') {
      throw new Error("Property 'cid' must be a string!")
    }
    if (!claimTxid || typeof claimTxid !== 'string') {
      throw new Error("Property 'claimTxid' must be a string!")
    }
    if (!filename || typeof filename !== 'string') {
      throw new Error("Property 'filename' must be a string!")
    }
    if (!address || typeof address !== 'string') {
      throw new Error("Property 'address' must be a string!")
    }
    if (!payoutAddress || typeof payoutAddress !== 'string') {
      throw new Error("Property 'payoutAddress' must be a string!")
    }
    if (typeof satsPaid !== 'number' || !Number.isFinite(satsPaid) || satsPaid <= 0) {
      throw new Error("Property 'satsPaid' must be a number greater than 0!")
    }

    const now = new Date()
    const recordTime = now.getTime()

    const pinData = {
      proofOfBurnTxid,
      cid,
      filename,
      claimTxid,
      pobTxDetails,
      claimTxDetails,
      paymentKind: paymentKind || 'bch-payment',
      satsPaid,
      payoutAddress,
      address,
      validClaim: null,
      dataPinned: false,
      recordTime
    }

    return pinData
  }
}

export default Pin
