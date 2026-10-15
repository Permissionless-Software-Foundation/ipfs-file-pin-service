/*
  Unit tests for the timer-controller.js Controller library
*/

// Public npm libraries
import { assert } from 'chai'
import sinon from 'sinon'

// Local libraries
import TimerControllers from '../../../src/controllers/timer-controllers.js'
import adapters from '../mocks/adapters/index.js'
import UseCasesMock from '../mocks/use-cases/index.js'

// Helper: mongoose-style chainable find().sort().limit() that resolves to docs.
function chainableFind (docs) {
  const query = {
    sort () { return this },
    limit () { return Promise.resolve(docs) }
  }
  return query
}

describe('#Timer-Controllers', () => {
  let uut
  let sandbox

  beforeEach(() => {
    sandbox = sinon.createSandbox()

    const useCases = new UseCasesMock()
    uut = new TimerControllers({ adapters, useCases })
  })

  afterEach(() => {
    sandbox.restore()

    uut.stopTimers()
  })

  describe('#constructor', () => {
    it('should throw an error if adapters are not passed in', () => {
      try {
        uut = new TimerControllers()

        assert.fail('Unexpected code path')
      } catch (err) {
        assert.include(
          err.message,
          'Instance of Adapters library required when instantiating Timer Controller libraries.'
        )
      }
    })

    it('should throw an error if useCases are not passed in', () => {
      try {
        uut = new TimerControllers({ adapters })

        assert.fail('Unexpected code path')
      } catch (err) {
        assert.include(
          err.message,
          'Instance of Use Cases library required when instantiating Timer Controller libraries.'
        )
      }
    })
  })

  describe('#startTimers', () => {
    it('should start the timers without clearDownloadTries or autoReboot', () => {
      const result = uut.startTimers()

      assert.equal(result, true)
      assert.equal(typeof uut.clearDownloadTries, 'undefined')
      assert.equal(typeof uut.autoReboot, 'undefined')
      assert.equal(typeof uut.rebootHandle, 'undefined')

      uut.stopTimers()
    })
  })

  describe('#pinCids', () => {
    it('should retrieve unpinned pin models and try to pin them', async () => {
      const hotPathPin = { cid: 'cid-hot', downloadTries: 0, dataPinned: false }

      sandbox.stub(uut.adapters.localdb.Pins, 'find')
        .onFirstCall().returns(chainableFind([hotPathPin]))
        .onSecondCall().returns(chainableFind([]))

      const pinSpy = sandbox.stub(uut.useCases.ipfs, 'pinCidForTimerController').resolves()
      uut.useCases.ipfs.retryQueue = {
        validationQueue: { size: 0 }
      }
      uut.useCases.ipfs.pinTrackerCnt = 0
      sandbox.stub(uut.useCases.ipfs, 'pinIsBeingTracked').returns(false)

      const result = await uut.pinCids()

      assert.equal(result, true)
      assert.equal(pinSpy.callCount, 1)
      assert.equal(pinSpy.firstCall.args[0].cid, 'cid-hot')
    })

    it('should skip in-flight CIDs', async () => {
      const hotPathPin = { cid: 'cid-inflight', downloadTries: 0, dataPinned: false }

      sandbox.stub(uut.adapters.localdb.Pins, 'find')
        .onFirstCall().returns(chainableFind([hotPathPin]))
        .onSecondCall().returns(chainableFind([]))

      const pinSpy = sandbox.stub(uut.useCases.ipfs, 'pinCidForTimerController').resolves()
      uut.useCases.ipfs.retryQueue = {
        validationQueue: { size: 0 }
      }
      uut.useCases.ipfs.pinTrackerCnt = 0
      sandbox.stub(uut.useCases.ipfs, 'pinIsBeingTracked').returns(true)

      const result = await uut.pinCids()

      assert.equal(result, true)
      assert.equal(pinSpy.callCount, 0)
    })

    it('should include quarantine pins when hot-path leaves slots', async () => {
      const quarantinePin = {
        cid: 'cid-quarantine',
        downloadTries: 7,
        dataPinned: false,
        lastDownloadAttempt: Date.now() - (60000 * 60 * 7)
      }

      sandbox.stub(uut.adapters.localdb.Pins, 'find')
        .onFirstCall().returns(chainableFind([]))
        .onSecondCall().returns(chainableFind([quarantinePin]))

      const pinSpy = sandbox.stub(uut.useCases.ipfs, 'pinCidForTimerController').resolves()
      uut.useCases.ipfs.retryQueue = {
        validationQueue: { size: 0 }
      }
      uut.useCases.ipfs.pinTrackerCnt = 0
      sandbox.stub(uut.useCases.ipfs, 'pinIsBeingTracked').returns(false)

      const result = await uut.pinCids()

      assert.equal(result, true)
      assert.equal(pinSpy.callCount, 1)
      assert.equal(pinSpy.firstCall.args[0].cid, 'cid-quarantine')
    })

    it('should skip enqueue when no download slots are available', async () => {
      const pinSpy = sandbox.stub(uut.useCases.ipfs, 'pinCidForTimerController').resolves()
      uut.useCases.ipfs.retryQueue = {
        validationQueue: { size: 100 }
      }
      uut.useCases.ipfs.pinTrackerCnt = 0
      const findSpy = sandbox.stub(uut.adapters.localdb.Pins, 'find')

      const result = await uut.pinCids()

      assert.equal(result, true)
      assert.equal(pinSpy.callCount, 0)
      assert.equal(findSpy.callCount, 0)
    })

    it('should return false on error', async () => {
      uut.useCases.ipfs.retryQueue = {
        validationQueue: { size: 0 }
      }
      sandbox.stub(uut.adapters.localdb.Pins, 'find').throws(new Error('test error'))

      const result = await uut.pinCids()

      assert.equal(result, false)
    })
  })

  describe('#cleanUsage', () => {
    it('should kick off the Use Case', async () => {
      const result = await uut.cleanUsage()

      assert.equal(result, true)
    })

    it('should return false on error', async () => {
      sandbox.stub(uut.useCases.usage, 'cleanUsage').throws(new Error('test error'))
      const result = await uut.cleanUsage()

      assert.equal(result, false)
    })
  })

  describe('#reportQueueSize', () => {
    it('should return the size of the validation queue', async () => {
      // Mock dependencies and force desired code path
      const mockSizeValue = 7
      uut.useCases.ipfs.retryQueue = {
        validationQueue: {
          size: mockSizeValue
        }
      }
      const result = await uut.reportQueueSize()

      assert.equal(result, mockSizeValue)
    })

    it('should return false on error', async () => {
      // Mock dependencies and force desired code path
      uut.useCases.ipfs.retryQueue = null
      const result = await uut.reportQueueSize()

      assert.isFalse(result)
    })
  })

  describe('#backupUsage', () => {
    it('should kick off the Use Case', async () => {
      const result = await uut.backupUsage()

      assert.equal(result, true)
    })

    it('should return false on error', async () => {
      sandbox.stub(uut.useCases.usage, 'clearUsage').throws(new Error('test error'))
      // sandbox.stub(uut.useCases.usage, 'saveUsage').throws(new Error('test error'))

      const result = await uut.backupUsage()

      assert.equal(result, false)
    })
  })
})
