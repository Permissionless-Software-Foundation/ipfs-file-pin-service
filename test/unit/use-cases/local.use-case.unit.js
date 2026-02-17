/*
  Unit tests for the use-cases/local.js business logic library.
*/

// Public npm libraries
import { assert } from 'chai'
import sinon from 'sinon'

// Local support libraries
import adapters from '../mocks/adapters/index.js'

// Unit under test (uut)
import LocalUseCases from '../../../src/use-cases/local.js'

describe('#local-use-case', () => {
  let uut
  let sandbox

  beforeEach(() => {
    sandbox = sinon.createSandbox()
    uut = new LocalUseCases({ adapters })
  })

  afterEach(() => sandbox.restore())

  describe('#constructor', () => {
    it('should throw an error if adapters are not passed in', () => {
      try {
        uut = new LocalUseCases()

        assert.fail('Unexpected code path')
      } catch (err) {
        assert.include(
          err.message,
          'Instance of adapters must be passed in when instantiating Local Use Cases library.'
        )
      }
    })
  })

  describe('#getAll', () => {
    it('should return all local pins', async () => {
      const mockPins = [
        { CID: 'bafytest1', filename: 'file1.txt', fileSize: 100 },
        { CID: 'bafytest2', filename: 'file2.txt', fileSize: 200 }
      ]

      sandbox.stub(adapters.localdb.LocalPins, 'find').resolves(mockPins)

      const result = await uut.getAll()

      assert.isArray(result)
      assert.equal(result.length, 2)
      assert.equal(result[0].CID, 'bafytest1')
    })

    it('should return an empty array if no pins exist', async () => {
      sandbox.stub(adapters.localdb.LocalPins, 'find').resolves([])

      const result = await uut.getAll()

      assert.isArray(result)
      assert.equal(result.length, 0)
    })

    it('should throw an error if database query fails', async () => {
      try {
        sandbox.stub(adapters.localdb.LocalPins, 'find').rejects(new Error('db error'))

        await uut.getAll()

        assert.fail('Unexpected code path')
      } catch (err) {
        assert.include(err.message, 'db error')
      }
    })
  })
})
