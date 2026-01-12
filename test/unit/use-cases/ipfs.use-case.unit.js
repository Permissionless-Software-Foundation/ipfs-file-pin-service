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
import config from '../../../config/index.js'
import PinDataModelMock from '../mocks/pin-model-mock.js'

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
    it('should handle unknow wallet interface', () => {
      sinon.stub(config, 'walletInterface').value('unknow')
      const uut = new IpfsUseCases({ adapters })
      assert.exists(uut.wallet)
    })
    it('should handle "web2" wallet interface', () => {
      sinon.stub(config, 'walletInterface').value('web2')
      const uut = new IpfsUseCases({ adapters })
      assert.exists(uut.wallet)
    })
  })

  describe('#getWritePrice', () => {
    it('should get the write price', async () => {
      sandbox.stub(uut.retryQueue, 'addToQueue').resolves([{ writePrice: 1, height: 1 }])
      const inObj = {
        claimTxDetails: { height: null }
      }
      const result = await uut.getWritePrice(inObj)
      assert.isNumber(result)
      assert.equal(result, 1)
    })
    it('should get default write price on error', async () => {
      sandbox.stub(uut.retryQueue, 'addToQueue').throws(new Error('test error'))
      const inObj = {
        claimTxDetails: { height: null }
      }
      const result = await uut.getWritePrice(inObj)
      assert.isNumber(result)
      assert.equal(result, 0.03570889)
    })
    it('should handle tx height', async () => {
      sandbox.stub(uut.retryQueue, 'addToQueue').resolves([{ writePrice: 5, height: 5 }, { writePrice: 2, height: 2 }])
      const inObj = {
        claimTxDetails: { height: 3 }
      }
      const result = await uut.getWritePrice(inObj)
      assert.isNumber(result)
      assert.equal(result, 2)
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
      sandbox.stub(uut, 'handleRenewal').resolves(true)

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
      sandbox.stub(uut.adapters.localdb.Pins, 'findOne').resolves({ validClaim: true })
      sandbox.stub(uut, 'pinCid').resolves()
      sandbox.stub(uut.wallet.bchjs.Util, 'sleep').resolves()
      sandbox.stub(uut, 'handleRenewal').resolves(true)

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
      assert.equal(result.details, 'CID already has valid pin claim and is awaiting download.')
    })
    it('should process a valid pin claim and  pinned cid', async () => {
      // Mock dependencies and force desired code path
      sandbox.stub(uut.wallet, 'getTxData')
        .onCall(0).resolves([mockData.pobValidTxDetails01])
        .onCall(1).resolves([mockData.claimValidTxDetails01])
      sandbox.stub(uut.adapters.localdb.Pins, 'findOne').resolves({ validClaim: true, dataPinned: true })
      sandbox.stub(uut, 'pinCid').resolves()
      sandbox.stub(uut.wallet.bchjs.Util, 'sleep').resolves()
      sandbox.stub(uut, 'handleRenewal').resolves(true)

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
      assert.equal(result.details, 'CID already has valid pin claim. It has already been downloaded and pinned.')
    })
    it('should process new pin claim', async () => {
      // Mock dependencies and force desired code path
      sandbox.stub(uut.wallet, 'getTxData')
        .onCall(0).resolves([mockData.pobValidTxDetails01])
        .onCall(1).resolves([mockData.claimValidTxDetails01])
      sandbox.stub(uut.adapters.localdb.Pins, 'findOne').resolves(null)
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
      assert.include(result.details, 'Pinned new file with CID')
    })
  })

  describe('#handleRenewal', () => {
    it('should throw error if the cid is not a string', async () => {
      try {
        const pinData = {
          cid: 123,
          address: 'fake-address',
          claimTxid: '09555a14fd2de71a54c0317a8a22ae17bc43512116b063e263e41b3fc94f8905',
          proofOfBurnTxid: '5bfcdca588830245dcd9353f45bb1d06640d7fada0000160ae2789a887b23766'
        }
        await uut.handleRenewal(pinData, mockData.claimValidTxDetails01, mockData.pobValidTxDetails01)
      } catch (err) {
        assert.include(err.message, 'cid must be a string')
      }
    })
    it('should throw error if the address is not a string', async () => {
      try {
        const pinData = {
          cid: 'bafybeicd455l7c6mxiogptqcg6md474qmzzmzobgzu4vfms4wnek2hxguy',
          address: 123,
          claimTxid: '09555a14fd2de71a54c0317a8a22ae17bc43512116b063e263e41b3fc94f8905',
          proofOfBurnTxid: '5bfcdca588830245dcd9353f45bb1d06640d7fada0000160ae2789a887b23766'
        }
        await uut.handleRenewal(pinData, mockData.claimValidTxDetails01, mockData.pobValidTxDetails01)
      } catch (err) {
        assert.include(err.message, 'address must be a string')
      }
    })
    it('should return false if the claim txid is the same as the existing claim txid', async () => {
      sandbox.stub(uut.adapters.localdb.Pins, 'findOne').resolves({ claimTxid: '09555a14fd2de71a54c0317a8a22ae17bc43512116b063e263e41b3fc94f8905', save: async () => { } })

      const pinData = {
        cid: 'bafybeicd455l7c6mxiogptqcg6md474qmzzmzobgzu4vfms4wnek2hxguy',
        address: 'fake-address',
        claimTxid: '09555a14fd2de71a54c0317a8a22ae17bc43512116b063e263e41b3fc94f8905',
        proofOfBurnTxid: '5bfcdca588830245dcd9353f45bb1d06640d7fada0000160ae2789a887b23766'
      }
      const result = await uut.handleRenewal(pinData, mockData.claimValidTxDetails01, mockData.pobValidTxDetails01)
      assert.equal(result, false)
    })
    it('should return false if the proof of burn txid is the same as the existing proof of burn txid', async () => {
      sandbox.stub(uut.adapters.localdb.Pins, 'findOne').resolves({ proofOfBurnTxid: '5bfcdca588830245dcd9353f45bb1d06640d7fada0000160ae2789a887b23766', save: async () => { } })

      const pinData = {
        cid: 'bafybeicd455l7c6mxiogptqcg6md474qmzzmzobgzu4vfms4wnek2hxguy',
        address: 'fake-address',
        claimTxid: '09555a14fd2de71a54c0317a8a22ae17bc43512116b063e263e41b3fc94f8905',
        proofOfBurnTxid: '5bfcdca588830245dcd9353f45bb1d06640d7fada0000160ae2789a887b23766'
      }
      const result = await uut.handleRenewal(pinData, mockData.claimValidTxDetails01, mockData.pobValidTxDetails01)
      assert.equal(result, false)
    })
    it('should return false if the claim txid is already handled', async () => {
      sandbox.stub(uut.adapters.localdb.Pins, 'findOne').resolves({ claimTxids: ['09555a14fd2de71a54c0317a8a22ae17bc43512116b063e263e41b3fc94f8905'], pobTxids: [], save: async () => { } })

      const pinData = {
        cid: 'bafybeicd455l7c6mxiogptqcg6md474qmzzmzobgzu4vfms4wnek2hxguy',
        address: 'fake-address',
        claimTxid: '09555a14fd2de71a54c0317a8a22ae17bc43512116b063e263e41b3fc94f8905',
        proofOfBurnTxid: '5bfcdca588830245dcd9353f45bb1d06640d7fada0000160ae2789a887b23766'
      }
      const result = await uut.handleRenewal(pinData, mockData.claimValidTxDetails01, mockData.pobValidTxDetails01)
      assert.equal(result, false)
    })
    it('should return false if the proof of burn txid is already handled', async () => {
      sandbox.stub(uut.adapters.localdb.Pins, 'findOne').resolves({ claimTxids: [], pobTxids: ['5bfcdca588830245dcd9353f45bb1d06640d7fada0000160ae2789a887b23766'], save: async () => { } })

      const pinData = {
        cid: 'bafybeicd455l7c6mxiogptqcg6md474qmzzmzobgzu4vfms4wnek2hxguy',
        address: 'fake-address',
        claimTxid: '09555a14fd2de71a54c0317a8a22ae17bc43512116b063e263e41b3fc94f8905',
        proofOfBurnTxid: '5bfcdca588830245dcd9353f45bb1d06640d7fada0000160ae2789a887b23766'
      }
      const result = await uut.handleRenewal(pinData, mockData.claimValidTxDetails01, mockData.pobValidTxDetails01)
      assert.equal(result, false)
    })

    it('should save renewal data', async () => {
      sandbox.stub(uut.adapters.localdb.Pins, 'findOne').resolves({ claimTxids: [], pobTxids: [], save: async () => { } })

      const pinData = {
        cid: 'bafybeicd455l7c6mxiogptqcg6md474qmzzmzobgzu4vfms4wnek2hxguy',
        address: 'fake-address',
        claimTxid: '09555a14fd2de71a54c0317a8a22ae17bc43512116b063e263e41b3fc94f8905',
        proofOfBurnTxid: '5bfcdca588830245dcd9353f45bb1d06640d7fada0000160ae2789a887b23766'
      }
      const result = await uut.handleRenewal(pinData, mockData.claimValidTxDetails01, mockData.pobValidTxDetails01)
      assert.equal(result, true)
    })
  })
  describe('#_getCid', () => {
    it('should get a file from the IPFS network', async () => {
      sandbox.stub(uut.adapters.ipfs.ipfs.blockstore, 'get').resolves(true)
      sandbox.stub(uut.adapters.ipfs.ipfs.fs, 'stat').resolves({ fileSize: 1000 })

      const result = await uut._getCid({ cid: 'fake-cid' })

      assert.equal(result, 1000)
    })
    it('should calculate file size', async () => {
      sandbox.stub(uut.adapters.ipfs.ipfs.blockstore, 'get').resolves(true)
      sandbox.stub(uut.adapters.ipfs.ipfs.fs, 'stat').resolves({ fileSize: undefined })
      // Mock an async iterable that yields file chunks
      sandbox.stub(uut.adapters.ipfs.ipfs.fs, 'ls').callsFake(async function * () {
        yield { size: 500 } // mock folder file
        yield { size: 500 } // mock folder file
      })

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
    it('should return false and remove pin model if file is too big', async () => {
      // Mock dependencies and force desired code path.
      sandbox.stub(uut, '_getCid').resolves([1, 2, 3, 4, 5])
      sandbox.stub(uut.CID, 'parse').returns('fake-cid')
      sandbox.stub(uut, 'validateSizeAndPayment').resolves(false)
      const spy = sandbox.stub(uut.adapters.localdb.Pins, 'findOne').resolves({ cid: 'fake-cid', remove: () => { } })
      uut.config.maxPinSize = 2

      const pin = {
        cid: 'bafybeidmxb6au63p6t7wxglks3t6rxgt6t26f3gx26ezamenznkjdnwqta',
        save: async () => { }
      }

      const result = await uut.pinCid(pin)

      assert.equal(result, false)
      assert.equal(spy.callCount, 1)
    })
    it('should skip model removal error if it fails', async () => {
      // Mock dependencies and force desired code path.
      sandbox.stub(uut, '_getCid').resolves([1, 2, 3, 4, 5])
      sandbox.stub(uut.CID, 'parse').returns('fake-cid')
      sandbox.stub(uut, 'validateSizeAndPayment').resolves(false)
      const spy = sandbox.stub(uut.adapters.localdb.Pins, 'findOne').resolves({ cid: 'fake-cid', remove: () => { throw new Error('test error') } })
      uut.config.maxPinSize = 2

      const pin = {
        cid: 'bafybeidmxb6au63p6t7wxglks3t6rxgt6t26f3gx26ezamenznkjdnwqta',
        save: async () => { }
      }

      const result = await uut.pinCid(pin)

      assert.equal(result, false)
      assert.equal(spy.callCount, 1)
    })

    it('should return true if file is successfully pinned', async () => {
      const cid = 'bafybeidmxb6au63p6t7wxglks3t6rxgt6t26f3gx26ezamenznkjdnwqta'

      // Mock dependencies
      sandbox.stub(uut, '_getCid').resolves(1000)
      sandbox.stub(uut, 'validateSizeAndPayment').resolves(true)
      uut.config.maxPinSize = 100

      const inObj = {
        cid,
        save: async () => { }
      }

      const result = await uut.pinCid(inObj)

      assert.equal(result, true)
    })

    it('should catch and throw errors', async () => {
      try {
        // Mock dependencies and force desired code path
        sandbox.stub(uut.retryQueue, 'addToQueue').throws(new Error('test error'))

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
        save: async () => { }
      }

      const result = await uut.pinCid(inObj)

      assert.equal(result, true)
    })

    it('should return true if file is already pinned', async () => {
      const cid = 'bafybeidmxb6au63p6t7wxglks3t6rxgt6t26f3gx26ezamenznkjdnwqta'

      // Mock dependencies
      uut.config.maxPinSize = 100
      sandbox.stub(uut, '_getCidWithTimeout').resolves(1000)
      sandbox.stub(uut, 'validateSizeAndPayment').resolves(true)
      sandbox.stub(uut.adapters.ipfs.ipfs.pins, 'add').throws(new Error('Already pinned'))

      const inObj = {
        cid,
        save: async () => { }
      }

      const result = await uut.pinCid(inObj)

      assert.equal(result, true)
    })
    it('should catch error if cid cannot be added to IPFS', async () => {
      try {
        const cid = 'bafybeidmxb6au63p6t7wxglks3t6rxgt6t26f3gx26ezamenznkjdnwqta'

        // Mock dependencies
        uut.config.maxPinSize = 100
        sandbox.stub(uut, '_getCidWithTimeout').resolves(1000)
        sandbox.stub(uut, 'validateSizeAndPayment').resolves(true)
        sandbox.stub(uut.adapters.ipfs.ipfs.pins, 'add').throws(new Error('IPFS add error'))

        const inObj = {
          cid,
          save: async () => { }
        }

        const result = await uut.pinCid(inObj)

        assert.equal(result, false)
      } catch (error) {
        assert.include(error.message, 'IPFS add error')
      }
    })
    it('should return false if fileSize cannot be retrieved', async () => {
      const cid = 'bafybeidmxb6au63p6t7wxglks3t6rxgt6t26f3gx26ezamenznkjdnwqta'

      // Mock dependencies
      uut.config.maxPinSize = 100
      sandbox.stub(uut, '_getCidWithTimeout').resolves(undefined)
      sandbox.stub(uut, 'validateSizeAndPayment').resolves(true)

      const inObj = {
        cid,
        save: async () => { }
      }

      const result = await uut.pinCid(inObj)

      assert.equal(result, false)
    })

    it('should throw error if adding pin throws an unexpected error', async () => {
      const cid = 'bafybeidmxb6au63p6t7wxglks3t6rxgt6t26f3gx26ezamenznkjdnwqta'

      // Mock dependencies
      uut.config.maxPinSize = 100
      sandbox.stub(uut.retryQueue, 'addToQueue').rejects('test error')
      sandbox.stub(uut, 'validateSizeAndPayment').resolves(true)

      const inObj = {
        cid,
        save: async () => { }
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

  describe('#downloadFile', () => {
    it('should throw error if CID is not provided', async () => {
      try {
        await uut.downloadFile({})

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

        await uut.downloadFile({ cid })

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

        await uut.downloadFile({ cid })

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
      // sandbox.stub(uut.adapters.ipfs.ipfs.fs, 'ls').resolves({})

      const result = await uut.downloadFile({ cid })
      // console.log('result: ', result)

      assert.property(result, 'filename')
      assert.property(result, 'readStream')

      assert.equal(result.filename, 'test.txt')
    })
    it('should handle directory download', async () => {
      const cid = 'bafybeidmxb6au63p6t7wxglks3t6rxgt6t26f3gx26ezamenznkjdnwqta'

      // Mock dependencies and force desired code path
      sandbox.stub(uut.adapters.localdb.Pins, 'find').resolves([{
        dataPinned: true,
        filename: 'test.txt'
      }])

      sandbox.stub(uut.adapters.ipfs.ipfs.fs, 'ls').callsFake(async function * () {
        yield { path: 'dir/file' } // mock folder file
        yield { path: 'dir/file' } // mock folder file
      })

      const result = await uut.downloadFile({ cid, listDir: true })
      // console.log('result: ', result)

      assert.property(result, 'filename')
      assert.property(result, 'readStream')

      assert.include(result.filename, 'html')
    })
    it('should download by name', async () => {
      const cid = 'bafybeidmxb6au63p6t7wxglks3t6rxgt6t26f3gx26ezamenznkjdnwqta'

      // Mock dependencies and force desired code path
      sandbox.stub(uut.adapters.localdb.Pins, 'find').resolves([{
        dataPinned: true,
        filename: 'test.txt'
      }])

      sandbox.stub(uut.adapters.ipfs.ipfs.fs, 'ls').callsFake(async function * () {
        yield { path: 'dir/file' } // mock folder file
        yield { path: 'dir/file' } // mock folder file
      })

      const result = await uut.downloadFile({ cid, name: 'test.txt', listDir: true })
      // console.log('result: ', result)

      assert.property(result, 'filename')
      assert.property(result, 'readStream')

      assert.equal(result.filename, 'test.txt')
    })
  })
  describe('#getUnprocessedPins', () => {
    it('should get unprocessed pins', async () => {
      sandbox.stub(uut.adapters.localdb.Pins, 'find').resolves([{ validClaim: null }])

      const result = await uut.getUnprocessedPins()
      assert.isArray(result)
    })
    it('should handle error', async () => {
      try {
        sandbox.stub(uut.adapters.localdb.Pins, 'find').throws(new Error('test error'))

        await uut.getUnprocessedPins()
        assert.fail('Unexpected code path')
      } catch (error) {
        assert.include(error.message, 'test error')
      }
    })
  })

  describe('#getPinClaims', () => {
    it('should return paginated pin claims', async () => {
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

      // Create a Pins model mock that includes both find() and countDocuments()
      const Pins = {
        find: () => {
          return {
            sort: () => ({
              skip: () => ({
                limit: () => pins.slice(0, 20)
              })
            })
          }
        },
        countDocuments: async () => pins.length
      }

      // Replace the Pins model in the adapters
      uut.adapters.localdb.Pins = Pins

      const result = await uut.getPinClaims({ page: 1 })

      // Test the pagination metadata
      assert.property(result, 'success')
      assert.property(result, 'pins')
      assert.property(result, 'pagination')

      // Test pagination object properties
      assert.equal(result.pagination.currentPage, 1)
      assert.equal(result.pagination.totalPages, 2)
      assert.equal(result.pagination.pageSize, 20)
      assert.equal(result.pagination.totalItems, 40)

      // Test the pins array
      assert.equal(result.success, true)
      assert.equal(result.pins.length, 20)

      // Test that the newest entry is first
      // assert.equal(result.pins[0].recordTime, 39)
    })
    it('should handle error', async () => {
      try {
        sandbox.stub(uut.adapters.localdb.Pins, 'countDocuments').throws(new Error('test error'))
        await uut.getPinClaims({ page: 1 })
      } catch (error) {
        assert.include(error.message, 'test error')
      }
    })
  })
  describe('#pinCidForTimerController', () => {
    it('should try to get cid', async () => {
      sandbox.stub(uut, '_tryToGetCid').resolves()
      const result = await uut.pinCidForTimerController({ cid: 'fake-cid' })
      assert.equal(result, true)
    })
    it('should catch error', async () => {
      try {
        sandbox.stub(uut, '_tryToGetCid').throws(new Error('test error'))
        await uut.pinCidForTimerController({ cid: 'fake-cid' })

        assert.fail('Unexpected code path')
      } catch (error) {
        assert.include(error.message, 'test error')
      }
    })
  })
  describe('#_tryToGetCid', () => {
    it('should return true if data is pinned', async () => {
      // Mock data
      const mockPinModel = Object.assign({}, PinDataModelMock.pinModelMock)
      mockPinModel.dataPinned = true

      const result = await uut._tryToGetCid({ pinData: mockPinModel })
      assert.equal(result, true)
    })
    it('should store downloadTries and return false if data is fileSize cannot be retrieved', async () => {
      //  Stub functions
      sandbox.stub(uut, '_getCidWithTimeout').resolves(undefined)

      // Mock data
      const mockPinModel = Object.assign({}, PinDataModelMock.pinModelMock)
      mockPinModel.dataPinned = false
      mockPinModel.downloadTries = 0
      mockPinModel.save = async () => { }

      // Call function
      const result = await uut._tryToGetCid({ pinData: mockPinModel })
      assert.equal(result, false)
      assert.equal(mockPinModel.downloadTries, 1)
    })
    it('should return true if data is pinned', async () => {
      // Mock data
      const mockPinModel = Object.assign({}, PinDataModelMock.pinModelMock)
      mockPinModel.dataPinned = true

      // Call function
      const result = await uut._tryToGetCid({ pinData: mockPinModel })
      assert.equal(result, true)
    })
    it('should pin a valid claim', async () => {
      // Stub functions
      sandbox.stub(uut, '_getCidWithTimeout').resolves(1000)
      sandbox.stub(uut, 'validateSizeAndPayment').resolves(true)
      sandbox.stub(uut.adapters.ipfs.ipfs.pins, 'add').resolves()

      // Mock data
      const mockPinModel = Object.assign({}, PinDataModelMock.pinModelMock)
      mockPinModel.dataPinned = false

      // Call function
      mockPinModel.save = async () => { }
      const result = await uut._tryToGetCid({ pinData: mockPinModel })
      assert.equal(result, true)
      assert.equal(mockPinModel.dataPinned, true)
    })
    it('should handle ipfs add "already pinned" error', async () => {
      // Stub functions
      sandbox.stub(uut, '_getCidWithTimeout').resolves(1000)
      sandbox.stub(uut, 'validateSizeAndPayment').resolves(true)
      sandbox.stub(uut.adapters.ipfs.ipfs.pins, 'add').throws(new Error('Already pinned'))

      // Mock data
      const mockPinModel = Object.assign({}, PinDataModelMock.pinModelMock)
      mockPinModel.dataPinned = false
      mockPinModel.save = async () => { }

      // Call function
      const result = await uut._tryToGetCid({ pinData: mockPinModel })
      assert.equal(result, true)
      assert.equal(mockPinModel.dataPinned, true)
    })
    it('should handle ipfs add error', async () => {
      try {
        // Stub functions
        sandbox.stub(uut, '_getCidWithTimeout').resolves(1000)
        sandbox.stub(uut, 'validateSizeAndPayment').resolves(true)
        sandbox.stub(uut.adapters.ipfs.ipfs.pins, 'add').throws(new Error('unknown error'))

        // Mock data
        const mockPinModel = Object.assign({}, PinDataModelMock.pinModelMock)
        mockPinModel.dataPinned = false

        // Call function
        await uut._tryToGetCid({ pinData: mockPinModel })

        assert.fail('Unexpected code path')
      } catch (error) {
        assert.include(error.message, 'unknown error')
      }
    })
    it('should remove pindata if is not a valid claim', async () => {
      // Mock function
      uut.adapters.localdb.Pins = {
        findOne: () => {
          return {
            dataPinned: false
          }
        }
      }

      // Mock data
      const mockPinModel = Object.assign({}, PinDataModelMock.pinModelMock)
      mockPinModel.dataPinned = false
      mockPinModel.remove = async () => { }

      // Stub functions
      sandbox.stub(uut, '_getCidWithTimeout').resolves(1000)
      sandbox.stub(uut, 'validateSizeAndPayment').resolves(false)
      sandbox.stub(uut.adapters.localdb.Pins, 'findOne').resolves(mockPinModel)

      // Call function
      const result = await uut._tryToGetCid({ pinData: mockPinModel })
      assert.equal(result, false)
    })
    it('should skip error on remove database model', async () => {
      // Mock function
      uut.adapters.localdb.Pins = {
        findOne: () => {
          return {
            dataPinned: false
          }
        }
      }

      // Mock data
      const mockPinModel = Object.assign({}, PinDataModelMock.pinModelMock)
      mockPinModel.dataPinned = false
      mockPinModel.remove = async () => { throw new Error('test error') }

      // Stub functions
      sandbox.stub(uut, '_getCidWithTimeout').resolves(1000)
      sandbox.stub(uut, 'validateSizeAndPayment').resolves(false)
      sandbox.stub(uut.adapters.localdb.Pins, 'findOne').resolves(mockPinModel)

      // Call function
      const result = await uut._tryToGetCid({ pinData: mockPinModel })
      assert.equal(result, false)
    })
  })
  describe('#validateSizeAndPayment', () => {
    it('should return false if file size is greater than max pin size', async () => {
      // Mock data
      uut.config.maxPinSize = 100000
      const mockPinModel = Object.assign({}, PinDataModelMock.pinModelMock)
      mockPinModel.fileSize = 123456

      const result = await uut.validateSizeAndPayment(mockPinModel)
      assert.equal(result, false)
    })
    it('should return false if tokens burned is less than the cost of the pin', async () => {
      // Mock data
      uut.config.maxPinSize = 1000000000
      const mockPinModel = Object.assign({}, PinDataModelMock.pinModelMock)
      mockPinModel.fileSize = 123456789
      mockPinModel.tokensBurned = 0.0001

      const result = await uut.validateSizeAndPayment(mockPinModel)
      assert.equal(result, false)
    })
    it('should return true on success validations', async () => {
      // Mock data
      const mockPinModel = Object.assign({}, PinDataModelMock.pinModelMock)
      uut.writePrice = null
      uut.config.maxPinSize = 1000000000
      mockPinModel.fileSize = 123456789
      mockPinModel.tokensBurned = 0.1
      sandbox.stub(uut, 'getWritePrice').resolves(0.00000001)

      const result = await uut.validateSizeAndPayment(mockPinModel)
      assert.equal(result, true)
    })
    it('should not get writePrice if it already eist', async () => {
      // Mock data
      const mockPinModel = Object.assign({}, PinDataModelMock.pinModelMock)
      uut.writePrice = 0.00000001
      uut.config.maxPinSize = 1000000000
      mockPinModel.fileSize = 123456789
      mockPinModel.tokensBurned = 0.1
      const spy = sandbox.stub(uut, 'getWritePrice').resolves(0.00000001)

      const result = await uut.validateSizeAndPayment(mockPinModel)
      assert.equal(result, true)
      assert.isTrue(spy.notCalled)
    })
    it('should handle error on getWritePrice', async () => {
      try {
        // Mock data
        const mockPinModel = Object.assign({}, PinDataModelMock.pinModelMock)
        uut.writePrice = null
        uut.config.maxPinSize = 1000000000
        mockPinModel.fileSize = 123456789
        mockPinModel.tokensBurned = 0.1

        // Stub function
        sandbox.stub(uut, 'getWritePrice').throws(new Error('test error'))

        // Call function
        const result = await uut.validateSizeAndPayment(mockPinModel)
        assert.equal(result, false)
      } catch (error) {
        assert.include(error.message, 'test error')
      }
    })
  })
  describe('#_getCidWithTimeout', () => {
    it('should handle timeout', async () => {
      try {
        // Call fake function
        sandbox.stub(uut, '_getCid').resolves(new Promise((resolve, reject) => {
          setTimeout(() => { resolve(1000) }, 60000 * 5)
        }))
        const clock = sandbox.useFakeTimers() // fake timer
        const uutPromise = uut._getCidWithTimeout({ cid: 'fake-cid' }) // instantiate promise and timeout
        clock.tick(60000 * 5) // force  to trigger timeout into the function
        await uutPromise

        assert.fail('Unexpected code path')
      } catch (error) {
        assert.include(error.message, 'Operation timed out after')
      }
    })
    it('should handle error', async () => {
      try {
        sandbox.stub(uut, '_getCid').rejects(new Error('test error'))
        await uut._getCidWithTimeout({ cid: 'fake-cid' })
        assert.fail('Unexpected code path')
      } catch (error) {
        assert.include(error.message, 'test error')
      }
    })
  })

  describe('#removePinFromTracker', () => {
    it('should remove pin from tracker', async () => {
      uut.pinTracker = { cid: { status: 'pinned' } }
      uut.pinTrackerCnt = 1
      const result = await uut.removePinFromTracker('cid')
      assert.equal(result, true)
      assert.equal(uut.pinTrackerCnt, 0)
      assert.equal(uut.pinTracker.cid, undefined)
    })
    it('should not remove pin from tracker if cid is not in tracker', async () => {
      uut.pinTracker = { cid: 'pinned' }
      uut.pinTrackerCnt = 1
      const result = await uut.removePinFromTracker('cid2')
      assert.equal(result, true)
      assert.equal(uut.pinTracker.cid, 'pinned')
    })
  })
  describe('#pinLocalFile', () => {
    it('should upload a file', async () => {
      const fileMock = {
        originalFilename: 'test.txt',
        size: 100,
        filepath: 'test.txt'
      }
      sandbox.stub(uut.fs, 'createReadStream').returns('content')
      const result = await uut.pinLocalFile({ file: fileMock })

      assert.isObject(result)
      assert.property(result, 'success')
      assert.property(result, 'cid')
    })

    // it('should handle error if file size is too large', async () => {
    //   try {
    //     const fileMock = {
    //       originalFilename: 'test.txt',
    //       size: 100000000 + 1,
    //       filepath: 'test.txt'
    //     }
    //     await uut.pinLocalFile({ file: fileMock })

    //     assert.fail('Unexpected code path')
    //   } catch (error) {
    //     assert.equal(error.message, 'File exceeds max file size of 100000000')
    //   }
    // })

    it('should handle ipfs addFile error', async () => {
      try {
        sandbox.stub(uut.fs, 'createReadStream').returns('content')
        sandbox.stub(uut.adapters.ipfs.ipfs.fs, 'addFile').throws(new Error('ipfs error'))
        const fileMock = {
          originalFilename: 'test.txt',
          size: 1000,
          filepath: 'test.txt'
        }
        await uut.pinLocalFile({ file: fileMock })

        assert.fail('Unexpected code path')
      } catch (error) {
        assert.equal(error.message, 'ipfs error')
      }
    })
    it('should skip error if file is already pinned', async () => {
      sandbox.stub(uut.fs, 'createReadStream').returns('content')
      sandbox.stub(uut.adapters.ipfs.ipfs.pins, 'add').throws(new Error('Already pinned'))
      const fileMock = {
        originalFilename: 'test.txt',
        size: 1000,
        filepath: 'test.txt'
      }
      const result = await uut.pinLocalFile({ file: fileMock })

      assert.isTrue(result.success)
    })
    it('should handle error if file is not pinned', async () => {
      try {
        sandbox.stub(uut.fs, 'createReadStream').returns('content')
        sandbox.stub(uut.adapters.ipfs.ipfs.pins, 'add').throws(new Error('ipfs error'))
        const fileMock = {
          originalFilename: 'test.txt',
          size: 1000,
          filepath: 'test.txt'
        }
        await uut.pinLocalFile({ file: fileMock })

        assert.fail('Unexpected code path')
      } catch (error) {
        assert.equal(error.message, 'ipfs error')
      }
    })
  })
  describe('#downloadCid', () => {
    it('should throw error if cid is not provided', async () => {
      try {
        await uut.downloadCid({})
        assert.fail('Unexpected code path')
      } catch (error) {
        assert.include(error.message, 'CID is undefined')
      }
    })
    it('should download a cid', async () => {
      const result = await uut.downloadCid({ cid: 'fake-cid' })
      assert.isObject(result)
      assert.property(result, 'readStream')
    })
  })
})
