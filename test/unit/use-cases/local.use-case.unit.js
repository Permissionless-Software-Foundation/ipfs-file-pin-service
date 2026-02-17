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

  describe('#deleteByCid', () => {
    it('should throw an error if cid is not provided', async () => {
      try {
        await uut.deleteByCid({})

        assert.fail('Unexpected code path')
      } catch (err) {
        assert.include(err.message, "Property 'cid' must be a string!")
      }
    })

    it('should throw an error if cid is not a string', async () => {
      try {
        await uut.deleteByCid({ cid: 123 })

        assert.fail('Unexpected code path')
      } catch (err) {
        assert.include(err.message, "Property 'cid' must be a string!")
      }
    })

    it('should throw an error if no local pin is found', async () => {
      try {
        sandbox.stub(adapters.localdb.LocalPins, 'findOne').resolves(null)

        await uut.deleteByCid({ cid: 'bafyNotFound' })

        assert.fail('Unexpected code path')
      } catch (err) {
        assert.include(err.message, 'No local pin found with CID: bafyNotFound')
      }
    })

    it('should unpin and delete a local pin by CID', async () => {
      const mockPin = {
        CID: 'bafytest1',
        filename: 'file1.txt',
        fileSize: 100,
        remove: sandbox.stub().resolves(true)
      }

      sandbox.stub(adapters.localdb.LocalPins, 'findOne').resolves(mockPin)

      const result = await uut.deleteByCid({ cid: 'bafytest1' })

      assert.equal(result.CID, 'bafytest1')
      assert.isTrue(mockPin.remove.calledOnce)
    })

    it('should throw an error if IPFS unpin fails', async () => {
      try {
        const mockPin = {
          CID: 'bafytest1',
          filename: 'file1.txt',
          fileSize: 100,
          remove: sandbox.stub().resolves(true)
        }

        sandbox.stub(adapters.localdb.LocalPins, 'findOne').resolves(mockPin)
        sandbox.stub(adapters.ipfs.ipfs.pins, 'rm').rejects(new Error('unpin failed'))

        await uut.deleteByCid({ cid: 'bafytest1' })

        assert.fail('Unexpected code path')
      } catch (err) {
        assert.include(err.message, 'unpin failed')
      }
    })

    it('should throw an error if database delete fails', async () => {
      try {
        const mockPin = {
          CID: 'bafytest1',
          filename: 'file1.txt',
          fileSize: 100,
          remove: sandbox.stub().rejects(new Error('delete failed'))
        }

        sandbox.stub(adapters.localdb.LocalPins, 'findOne').resolves(mockPin)

        await uut.deleteByCid({ cid: 'bafytest1' })

        assert.fail('Unexpected code path')
      } catch (err) {
        assert.include(err.message, 'delete failed')
      }
    })
  })
})
