/*
  Pin Entity
*/

class Pin {
  validate (inObj = {}) {
    const { proofOfBurnTxid, cid, claimTxid, pobTxDetails, claimTxDetails, tokensBurned, filename, address } = inObj

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

    const now = new Date()
    const recordTime = now.getTime()

    const pinData = {
      proofOfBurnTxid,
      cid,
      filename,
      claimTxid,
      pobTxDetails,
      claimTxDetails,
      tokensBurned,
      address,
      validClaim: null,
      dataPinned: false,
      recordTime
    }

    return pinData
  }
}

export default Pin
