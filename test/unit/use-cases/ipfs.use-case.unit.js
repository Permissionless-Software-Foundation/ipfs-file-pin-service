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

describe('#ipfs-use-case', () => {
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
    it('should report if CID is already being tracked by DB', async () => {
      // Mock dependencies and force desired code path
      sandbox.stub(uut.wallet, 'getTxData')
        .onCall(0).resolves([mockData.pobValidTxDetails01])
        .onCall(1).resolves([mockData.claimValidTxDetails01])
      sandbox.stub(uut.adapters.localdb.Pins, 'find').resolves([1])
      sandbox.stub(uut.wallet.bchjs.Util, 'sleep').resolves()

      const inObj = {
        proofOfBurnTxid: '5bfcdca588830245dcd9353f45bb1d06640d7fada0000160ae2789a887b23766',
        cid: 'bafybeicd455l7c6mxiogptqcg6md474qmzzmzobgzu4vfms4wnek2hxguy',
        claimTxid: '09555a14fd2de71a54c0317a8a22ae17bc43512116b063e263e41b3fc94f8905',
        filename: 'test.txt',
        address: 'fake-address'
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
      sandbox.stub(uut.wallet.bchjs.Util, 'sleep').resolves()

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
      sandbox.stub(uut.wallet.bchjs.Util, 'sleep').resolves()

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
        sandbox.stub(uut.wallet.bchjs.Util, 'sleep').resolves()

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

    it('should process a valid pin claim', async () => {
      // Mock dependencies and force desired code path
      sandbox.stub(uut.wallet, 'getTxData')
        .onCall(0).resolves([mockData.pobValidTxDetails01])
        .onCall(1).resolves([mockData.claimValidTxDetails01])
      sandbox.stub(uut.adapters.localdb.Pins, 'find').resolves([])
      sandbox.stub(uut, 'pinCid').resolves()
      sandbox.stub(uut.wallet.bchjs.Util, 'sleep').resolves()

      const inObj = {
        proofOfBurnTxid: '5bfcdca588830245dcd9353f45bb1d06640d7fada0000160ae2789a887b23766',
        cid: 'bafybeicd455l7c6mxiogptqcg6md474qmzzmzobgzu4vfms4wnek2hxguy',
        claimTxid: '09555a14fd2de71a54c0317a8a22ae17bc43512116b063e263e41b3fc94f8905',
        filename: 'test.txt',
        address: 'fake-address'
      }

      const result = await uut.processPinClaim(inObj)
      // console.log('result: ', result)

      assert.equal(result.success, true)
    })
  })

  describe('#_getCid', () => {
    it('should get a file from the IPFS network', async () => {
      sandbox.stub(uut.adapters.ipfs.ipfs.blockstore, 'get').resolves(true)
      sandbox.stub(uut.adapters.ipfs.ipfs.fs, 'stat').resolves({ fileSize: 1000 })

      const result = await uut._getCid({ cid: 'fake-cid' })

      assert.equal(result, 1000)
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
    it('should return false if file is too big', async () => {
      // Mock dependencies and force desired code path.
      sandbox.stub(uut, '_getCid').resolves([1, 2, 3, 4, 5])
      sandbox.stub(uut.CID, 'parse').returns('fake-cid')
      sandbox.stub(uut, 'validateSizeAndPayment').resolves(false)
      uut.config.maxPinSize = 2

      const pin = {
        cid: 'bafybeidmxb6au63p6t7wxglks3t6rxgt6t26f3gx26ezamenznkjdnwqta',
        save: async () => {}
      }

      const result = await uut.pinCid(pin)

      assert.equal(result, false)
    })

    it('should return true if file is successfully pinned', async () => {
      const cid = 'bafybeidmxb6au63p6t7wxglks3t6rxgt6t26f3gx26ezamenznkjdnwqta'

      // Mock dependencies
      sandbox.stub(uut, '_getCid').resolves(1000)
      sandbox.stub(uut, 'validateSizeAndPayment').resolves(true)
      uut.config.maxPinSize = 100

      const inObj = {
        cid,
        save: async () => {}
      }

      const result = await uut.pinCid(inObj)

      assert.equal(result, true)
    })

    it('should catch and throw errors', async () => {
      try {
        // Mock dependencies and force desired code path
        sandbox.stub(uut.retryQueue, 'addToQueue').rejects(new Error('test error'))

        const cid = 'bafybeidmxb6au63p6t7wxglks3t6rxgt6t26f3gx26ezamenznkjdnwqta'
        await uut.pinCid({ cid })

        assert.fail('Unexpected result')
      } catch (err) {
        assert.include(err.message, 'test error')
      }
    })

    it('should return true if file is already being tracked and pinned', async () => {
      const cid = 'bafybeidmxb6au63p6t7wxglks3t6rxgt6t26f3gx26ezamenznkjdnwqta'

      // Mock dependencies
      sandbox.stub(uut, 'pinIsBeingTracked').returns(true)

      const inObj = {
        cid,
        save: async () => {}
      }

      const result = await uut.pinCid(inObj)

      assert.equal(result, true)
    })

    it('should return true if file is already pinned', async () => {
      const cid = 'bafybeidmxb6au63p6t7wxglks3t6rxgt6t26f3gx26ezamenznkjdnwqta'

      // Mock dependencies
      uut.config.maxPinSize = 100
      sandbox.stub(uut, '_getCid').resolves(1000)
      sandbox.stub(uut, 'validateSizeAndPayment').resolves(true)

      const inObj = {
        cid,
        save: async () => {}
      }

      const result = await uut.pinCid(inObj)

      assert.equal(result, true)
    })

    it('should throw error if adding pin throws an unexpected error', async () => {
      const cid = 'bafybeidmxb6au63p6t7wxglks3t6rxgt6t26f3gx26ezamenznkjdnwqta'

      // Mock dependencies
      uut.config.maxPinSize = 100
      sandbox.stub(uut.retryQueue, 'addToQueue').rejects('test error')
      sandbox.stub(uut, 'validateSizeAndPayment').resolves(true)

      const inObj = {
        cid,
        save: async () => {}
      }

      try {
        await uut.pinCid(inObj)

        assert.fail('Unexpected code path')
      } catch (err) {
        assert.include(err.message, '')
      }
    })
  })

  describe('#getPinStatus', () => {
    it('should throw error if CID is not provided', async () => {
      try {
        await uut.getPinStatus({})

        assert.fail('Unexpected code path')
      } catch (err) {
        assert.include(err.message, 'CID is undefined')
      }
    })

    it('should return the database model', async () => {
      const cid = 'bafybeidmxb6au63p6t7wxglks3t6rxgt6t26f3gx26ezamenznkjdnwqta'

      // Mock dependencies and force desired code path
      sandbox.stub(uut.adapters.localdb.Pins, 'find').resolves([{ cid }])

      const result = await uut.getPinStatus({ cid })
      // console.log('result: ', result)

      assert.equal(result.cid, cid)
    })
  })

  describe('#downloadCid', () => {
    it('should throw error if CID is not provided', async () => {
      try {
        await uut.downloadCid({})

        assert.fail('Unexpected code path')
      } catch (err) {
        assert.include(err.message, 'CID is undefined')
      }
    })

    it('should throw error if database model does not exist', async () => {
      try {
        const cid = 'bafybeidmxb6au63p6t7wxglks3t6rxgt6t26f3gx26ezamenznkjdnwqta'

        // Mock dependencies and force desired code path
        sandbox.stub(uut.adapters.localdb.Pins, 'find').resolves([])

        await uut.downloadCid({ cid })

        assert.fail('Unexpected code path')
      } catch (err) {
        assert.include(err.message, 'Database model for CID')
      }
    })

    it('should throw error if file has not been pinned', async () => {
      try {
        const cid = 'bafybeidmxb6au63p6t7wxglks3t6rxgt6t26f3gx26ezamenznkjdnwqta'

        // Mock dependencies and force desired code path
        sandbox.stub(uut.adapters.localdb.Pins, 'find').resolves([{
          dataPinned: false
        }])

        await uut.downloadCid({ cid })

        assert.fail('Unexpected code path')
      } catch (err) {
        assert.include(err.message, 'File has not been pinned. Not available.')
      }
    })

    it('should return a read stream if the file is pinned', async () => {
      const cid = 'bafybeidmxb6au63p6t7wxglks3t6rxgt6t26f3gx26ezamenznkjdnwqta'

      // Mock dependencies and force desired code path
      sandbox.stub(uut.adapters.localdb.Pins, 'find').resolves([{
        dataPinned: true,
        filename: 'test.txt'
      }])

      const result = await uut.downloadCid({ cid })
      // console.log('result: ', result)

      assert.property(result, 'filename')
      assert.property(result, 'readStream')

      assert.equal(result.filename, 'test.txt')
    })
  })

  describe('#validateSizeAndPayment', () => {
    it('should validate payment', async () => {
      const fileSize = 123456
      const tokensBurned = 0.09

      await uut.validateSizeAndPayment({ fileSize, tokensBurned })
    })
  })

  describe('#getPinClaims', () => {
    it('should return the last 20 pin claims', async () => {
      // Create mock data
      const pins = []
      for (let i = 0; i < 40; i++) {
        pins.push({
          recordTime: i,
          proofOfBurnTxid: 'fake-txid',
          cid: 'fake-cid',
          claimTxid: 'fake-txid',
          address: 'fake-address',
          filename: 'fake-filename',
          validClaim: true,
          dataPinned: true,
          tokensBurned: 0.08335232
        })
      }

      // Mock depenedencies and force desired code path.
      sandbox.stub(uut.adapters.localdb.Pins, 'find').resolves(pins)

      const result = await uut.getPinClaims()

      assert.property(result, 'success')
      assert.property(result, 'pins')

      assert.equal(result.success, true)
      assert.equal(result.pins.length, 20)

      // Assert that the newest entry is first.
      assert.equal(result.pins[0].recordTime, 39)
    })
  })
})
