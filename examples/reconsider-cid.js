/*
  This example can be used when a CID is not pinned by a single node, but it
  has been pinned by other nodes. This happens when the validation on that one
  node fails. This example can be used to target the specific node and have
  it re-validate the pin claim.
*/

// Global npm libraries
const axios = require('axios')

const CID = 'bafybeihpe6m4r5z5cqwi27wmjuj33wn3f3ipxbe4rcecksicr5k26aqbca'
const SERVER = 'http://localhost:5031'

async function start () {
  try {
    const resp1 = await axios.get(`${SERVER}/ipfs/pin-status/${CID}`)
    const cidStatus = resp1.data
    console.log('CID status: ', cidStatus)

    if (cidStatus.dataPinned) {
      console.log(`CID ${CID} has been pinned by the ipfs-file-pin-service server.`)
      return
    }

    console.log(`\n\nAttempting to repin CID: ${CID}`)
    const pinClaim = {
      proofOfBurnTxid: cidStatus.proofOfBurnTxid,
      cid: cidStatus.cid,
      claimTxid: cidStatus.claimTxid,
      filename: cidStatus.filename,
      address: cidStatus.address
    }

    const resp2 = await axios.post(`${SERVER}/ipfs/pin-claim`, pinClaim)
    console.log('resp2.data: ', resp2.data)
  } catch (err) {
    console.error(err)
  }
}
start()
