/*
  Unit tests for the ipfs Use Case library.
*/

// Public npm libraries
// import { assert } from 'chai'
import sinon from 'sinon'

// Local libraries
import IpfsUseCases from '../../../src/use-cases/ipfs.js'
import adapters from '../mocks/adapters/index.js'

describe('#users-use-case', () => {
  let uut
  let sandbox

  before(async () => {
    // Delete all previous users in the database.
    // await testUtils.deleteAllUsers()
  })

  beforeEach(() => {
    sandbox = sinon.createSandbox()

    uut = new IpfsUseCases({ adapters })
  })

  afterEach(() => sandbox.restore())

  describe('#processPinClaim', () => {
    it('should process a valid pin claim', async () => {
      const inObj = {
        proofOfBurnTxid: '5bfcdca588830245dcd9353f45bb1d06640d7fada0000160ae2789a887b23766',
        cid: 'bafybeicd455l7c6mxiogptqcg6md474qmzzmzobgzu4vfms4wnek2hxguy',
        claimTxid: '09555a14fd2de71a54c0317a8a22ae17bc43512116b063e263e41b3fc94f8905'
      }

      const result = await uut.processPinClaim(inObj)
      console.log('result: ', result)
    })
  })
})
