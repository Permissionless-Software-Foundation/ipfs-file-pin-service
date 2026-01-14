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
    it('should start the timers', () => {
      const result = uut.startTimers()

      uut.stopTimers()

      assert.equal(result, true)
    })
  })

  describe('#pinCids', () => {
    it('should retrieve pin models from the database and try to pin them', async () => {
      // Mock dependencies and force desired code path
      sandbox.stub(uut.adapters.localdb.Pins, 'find').resolves([1])
      sandbox.stub(uut.useCases.ipfs, 'pinCidForTimerController').resolves()
      uut.useCases.ipfs.retryQueue = {
        validationQueue: {
          size: 1
        }
      }

      const result = await uut.pinCids()

      assert.equal(result, true)
    })

    it('should handle pin attemps ', async () => {
      // Mock dependencies and force desired code path
      sandbox.stub(uut.adapters.localdb.Pins, 'find').resolves([{ downloadTries: 7 }, { downloadTries: 2 }])
      sandbox.stub(uut.useCases.ipfs, 'pinCidForTimerController').resolves()
      uut.useCases.ipfs.retryQueue = {
        validationQueue: {
          size: 1
        }
      }

      const result = await uut.pinCids()

      assert.equal(result, true)
    })

    it('should return false on error', async () => {
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

  describe('#clearDownloadTries', () => {
    it('should clear the download tries', async () => {
      sandbox.stub(uut.adapters.localdb.Pins, 'find').resolves([{ downloadTries: 7, save: async () => { return true } }])
      const result = await uut.clearDownloadTries()

      assert.equal(result, true)
    })
  })
  it('should return false on error', async () => {
    sandbox.stub(uut.adapters.localdb.Pins, 'find').throws(new Error('test error'))
    const result = await uut.clearDownloadTries()

    assert.equal(result, false)
  })

  describe('#autoReboot', () => {
    it('should reboot the system', async () => {
      const spy = sandbox.stub(process, 'exit').resolves()

      await uut.autoReboot()
      assert.equal(spy.callCount, 1)
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
