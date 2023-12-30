/*
  Unit tests for the ipfs Use Case library.
*/

// Public npm libraries
import { assert } from 'chai'
import sinon from 'sinon'
import cloneDeep from 'lodash.clonedeep'

// Local libraries
import IpfsUseCases from '../../../src/use-cases/ipfs.js'
import adapters from '../mocks/adapters/index.js'
import mockDataLib from '../mocks/use-cases/ipfs-mock.js'

describe('#users-use-case', () => {
  let uut
  let sandbox
  let mockData

  before(async () => {
    // Delete all previous users in the database.
    // await testUtils.deleteAllUsers()
  })

  beforeEach(() => {
    sandbox = sinon.createSandbox()

    mockData = cloneDeep(mockDataLib)

    uut = new IpfsUseCases({ adapters })
  })

  afterEach(() => sandbox.restore())

  describe('#constructor', () => {
    it('should throw an error if adapters are not passed in', () => {
      try {
        uut = new IpfsUseCases()

        assert.fail('Unexpected code path')
      } catch (err) {
        assert.include(
          err.message,
          'Instance of adapters must be passed in when instantiating IPFS Use Cases library.'
        )
      }
    })
  })

  describe('#processPinClaim', () => {
    it('should process a valid pin claim', async () => {
      // Mock dependencies and force desired code path
      sandbox.stub(uut.wallet, 'getTxData')
        .onCall(0).resolves([mockData.pobValidTxDetails01])
        .onCall(1).resolves([mockData.claimValidTxDetails01])

      const inObj = {
        proofOfBurnTxid: '5bfcdca588830245dcd9353f45bb1d06640d7fada0000160ae2789a887b23766',
        cid: 'bafybeicd455l7c6mxiogptqcg6md474qmzzmzobgzu4vfms4wnek2hxguy',
        claimTxid: '09555a14fd2de71a54c0317a8a22ae17bc43512116b063e263e41b3fc94f8905'
      }

      const result = await uut.processPinClaim(inObj)
      // console.log('result: ', result)

      assert.equal(result.success, true)
    })

    it('should return false if PoB is not a valid SLP TX', async () => {
      // Mock dependencies and force desired code path
      mockData.pobValidTxDetails01.isValidSlp = false
      sandbox.stub(uut.wallet, 'getTxData')
        .onCall(0).resolves([mockData.pobValidTxDetails01])
        .onCall(1).resolves([mockData.claimValidTxDetails01])

      const inObj = {
        proofOfBurnTxid: '5bfcdca588830245dcd9353f45bb1d06640d7fada0000160ae2789a887b23766',
        cid: 'bafybeicd455l7c6mxiogptqcg6md474qmzzmzobgzu4vfms4wnek2hxguy',
        claimTxid: '09555a14fd2de71a54c0317a8a22ae17bc43512116b063e263e41b3fc94f8905'
      }

      const result = await uut.processPinClaim(inObj)
      // console.log('result: ', result)

      assert.equal(result.success, false)
    })

    it('should return false if wrong token is burned', async () => {
      // Mock dependencies and force desired code path
      mockData.pobValidTxDetails01.tokenId = 'fake-token-id'
      sandbox.stub(uut.wallet, 'getTxData')
        .onCall(0).resolves([mockData.pobValidTxDetails01])
        .onCall(1).resolves([mockData.claimValidTxDetails01])

      const inObj = {
        proofOfBurnTxid: '5bfcdca588830245dcd9353f45bb1d06640d7fada0000160ae2789a887b23766',
        cid: 'bafybeicd455l7c6mxiogptqcg6md474qmzzmzobgzu4vfms4wnek2hxguy',
        claimTxid: '09555a14fd2de71a54c0317a8a22ae17bc43512116b063e263e41b3fc94f8905'
      }

      const result = await uut.processPinClaim(inObj)
      // console.log('result: ', result)

      assert.equal(result.success, false)
    })

    it('should catch, report, and throw errors', async () => {
      try {
        // Mock dependencies and force desired code path
        sandbox.stub(uut.wallet, 'getTxData').rejects(new Error('test error'))

        const inObj = {
          proofOfBurnTxid: '5bfcdca588830245dcd9353f45bb1d06640d7fada0000160ae2789a887b23766',
          cid: 'bafybeicd455l7c6mxiogptqcg6md474qmzzmzobgzu4vfms4wnek2hxguy',
          claimTxid: '09555a14fd2de71a54c0317a8a22ae17bc43512116b063e263e41b3fc94f8905'
        }

        await uut.processPinClaim(inObj)

        assert.fail('Unexpected code path')
      } catch (err) {
        assert.include(err.message, 'test error')
      }
    })
  })

  describe('#_getCid', () => {
    it('should get a file from the IPFS network', async () => {
      sandbox.stub(uut.adapters.ipfs.ipfs.blockstore, 'get').resolves(true)

      const result = await uut._getCid({ cid: 'fake-cid' })

      assert.equal(result, true)
    })

    it('should throw an error if there is a file download issue', async () => {
      try {
        sandbox.stub(uut.adapters.ipfs.ipfs.blockstore, 'get').rejects(new Error('test error'))

        await uut._getCid({ cid: 'fake-cid' })

        assert.fail('Unexpected code path')
      } catch (err) {
        assert.include(err.message, 'test error')
      }
    })
  })

  describe('#_getTokenQtyDiff', () => {
    it('should throw error if TX data is not provided', () => {
      try {
        uut._getTokenQtyDiff()

        assert.fail('Unexpected code path')
      } catch (err) {
        assert.include(err.message, 'txInfo is required')
      }
    })

    it('should throw error if TX data does not have vin or vout arrays', () => {
      try {
        uut._getTokenQtyDiff({})

        assert.fail('Unexpected code path')
      } catch (err) {
        assert.include(err.message, 'txInfo must contain vin and vout array')
      }
    })

    it('should return the difference of a token burn', () => {
      const result = uut._getTokenQtyDiff(mockData.pobValidTxDetails01)
      // console.log('result: ', result)

      assert.equal(result, 0.08335232)
    })

    it('should handle TXs without a tokenQty', () => {
      mockData.pobValidTxDetails01.vin[0].tokenQty = null
      mockData.pobValidTxDetails01.vout[1].tokenQty = null

      const result = uut._getTokenQtyDiff(mockData.pobValidTxDetails01)
      // console.log('result: ', result)

      assert.equal(result, 0)
    })
  })

  describe('#pinCid', () => {
    // it('should return false if file is too big', async () => {
    //   // Mock dependencies and force desired code path.
    //   sandbox.stub(uut, '_getCid').resolves([1])
    //   // sandbox.stub(uut, 'validateCid').resolves(false)
    //
    //   const cid = 'bafybeidmxb6au63p6t7wxglks3t6rxgt6t26f3gx26ezamenznkjdnwqta'
    //
    //   const result = await uut.pinCid(cid)
    //
    //   assert.equal(result, false)
    // })

    it('should return true if file is successfully pinned', async () => {
      const cid = 'bafybeidmxb6au63p6t7wxglks3t6rxgt6t26f3gx26ezamenznkjdnwqta'

      // Mock dependencies
      sandbox.stub(uut.adapters.ipfs.ipfs.blockstore, 'get').resolves([1, 2, 3])
      // sandbox.stub(uut, 'validateCid').resolves(true)

      const result = await uut.pinCid(cid)

      assert.equal(result, true)
    })

    it('should catch and throw errors', async () => {
      try {
        // Mock dependencies and force desired code path
        // sandbox.stub(uut.adapters.ipfs.ipfs.blockstore, 'get').resolves([1, 2, 3])
        // sandbox.stub(uut, 'validateCid').rejects(new Error('test error'))
        sandbox.stub(uut.retryQueue, 'addToQueue').rejects(new Error('test error'))

        const cid = 'bafybeidmxb6au63p6t7wxglks3t6rxgt6t26f3gx26ezamenznkjdnwqta'
        await uut.pinCid(cid)

        assert.fail('Unexpected result')
      } catch (err) {
        assert.equal(err.message, 'test error')
      }
    })
  })
})
