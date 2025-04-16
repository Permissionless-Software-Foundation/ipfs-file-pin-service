/*
Unit tests for the json-rpc/about/index.js file.
*/

// Public npm libraries
import sinon from 'sinon'

import { assert } from 'chai'

// Local libraries
import FilePinRPC from '../../../../src/controllers/json-rpc/file-pin/index.js'

import adapters from '../../mocks/adapters/index.js'
import UseCasesMock from '../../mocks/use-cases/index.js'

describe('#FilePinRPC', () => {
  let uut
  let sandbox

  beforeEach(() => {
    sandbox = sinon.createSandbox()

    const useCases = new UseCasesMock()
    uut = new FilePinRPC({ adapters, useCases })
  })

  afterEach(() => sandbox.restore())

  describe('#constructor', () => {
    it('should throw an error if adapters are not passed in', () => {
      try {
        uut = new FilePinRPC()

        assert.fail('Unexpected code path')
      } catch (err) {
        assert.include(
          err.message,
          'Instance of Adapters library required when instantiating File Pin JSON RPC Controller.'
        )
      }
    })

    it('should throw an error if useCases are not passed in', () => {
      try {
        uut = new FilePinRPC({ adapters })

        assert.fail('Unexpected code path')
      } catch (err) {
        assert.include(
          err.message,
          'Instance of Use Cases library required when instantiating File Pin JSON RPC Controller.'
        )
      }
    })
  })

  describe('#filePinRouter', () => {
    it('should route the call to the getFileMetadata endpoint', async () => {
      const rpcData = {
        payload: {
          params: {
            endpoint: 'getFileMetadata'
          }
        }
      }
      sandbox.stub(uut, 'getFileMetadata').resolves(true)
      const result = await uut.filePinRouter(rpcData)
      assert.isTrue(result)
    })
    it('should route the call to the getPins endpoint', async () => {
      const rpcData = {
        payload: {
          params: {
            endpoint: 'getPins'
          }
        }
      }
      sandbox.stub(uut, 'getPins').resolves(true)
      const result = await uut.filePinRouter(rpcData)
      assert.isTrue(result)
    })
    it('should route the call to the getPins endpoint', async () => {
      const rpcData = {
        payload: {
          params: {
            endpoint: 'pinClaim'
          }
        }
      }
      sandbox.stub(uut, 'pinClaim').resolves(true)
      const result = await uut.filePinRouter(rpcData)
      assert.isTrue(result)
    })
    it('should handle error', async () => {
      const rpcData = {
        payload: {
          params: {
            endpoint: 'pinClaim'
          }
        }
      }
      sandbox.stub(uut, 'pinClaim').throws(new Error('pin claim error'))
      const result = await uut.filePinRouter(rpcData)
      assert.isFalse(result.success)
      assert.equal(result.status, 500)
      assert.equal(result.message, 'pin claim error')
      assert.equal(result.endpoint, 'pinClaim')
    })
  })

  describe('#getPins', () => {
    it('should get pins', async () => {
      const rpcData = {
        payload: {
          params: {
            page: 1
          }
        }
      }
      sandbox.stub(uut.useCases.ipfs, 'getPinClaims').resolves([])
      const result = await uut.getPins(rpcData)

      assert.equal(result.success, true)
      assert.equal(result.status, 200)
      assert.equal(result.message, 'pins property is an array of latest 20 pinned items')
      assert.equal(result.endpoint, 'getPins')
    })

    it('should handle error', async () => {
      const rpcData = {
        payload: {
          params: {
            page: 1
          }
        }
      }

      sandbox.stub(uut.useCases.ipfs, 'getPinClaims').throws(new Error('getPins error'))
      const result = await uut.getPins(rpcData)

      assert.equal(result.success, false)
      assert.equal(result.status, 422)
      assert.equal(result.message, 'getPins error')
      assert.equal(result.endpoint, 'getPins')
    })
  })

  describe('#getPins', () => {
    it('should get pins', async () => {
      const rpcData = {
        payload: {
          params: {
            page: 1
          }
        }
      }

      sandbox.stub(uut.useCases.ipfs, 'getPinClaims').resolves([])
      const result = await uut.getPins(rpcData)

      assert.equal(result.success, true)
      assert.equal(result.status, 200)
      assert.equal(result.message, 'pins property is an array of latest 20 pinned items')
      assert.equal(result.endpoint, 'getPins')
    })

    it('should handle error', async () => {
      const rpcData = {
        payload: {
          params: {
            page: 1
          }
        }
      }

      sandbox.stub(uut.useCases.ipfs, 'getPinClaims').throws(new Error('getPins error'))
      const result = await uut.getPins(rpcData)

      assert.equal(result.success, false)
      assert.equal(result.status, 422)
      assert.equal(result.message, 'getPins error')
      assert.equal(result.endpoint, 'getPins')
    })
  })

  describe('#getFileMetadata', () => {
    it('should get file metadatas', async () => {
      const rpcData = {
        payload: {
          params: {
            cid: 'bafybeied3zdwdiro7fqytyha2yfband4lwcrtozmf6shynylt3kexh26dq'
          }
        }
      }
      sandbox.stub(uut.adapters.localdb.Pins, 'find').resolves([{ _id: 'pin id' }])
      const result = await uut.getFileMetadata(rpcData)

      assert.equal(result.success, true)
      assert.equal(result.status, 200)
      assert.equal(result.message, 'pin status, filename, and other metadata for a given CID')
      assert.equal(result.endpoint, 'getFileMetadata')
      assert.property(result, 'fileMetadata')
      assert.isObject(result.fileMetadata)
      assert.property(result.fileMetadata, 'pobTxDetails')
      assert.property(result.fileMetadata, 'claimTxDetails')
    })
    it('should handle emtpy array of pins', async () => {
      const rpcData = {
        payload: {
          params: {
            cid: 'bafybeied3zdwdiro7fqytyha2yfband4lwcrtozmf6shynylt3kexh26dq'
          }
        }
      }
      sandbox.stub(uut.adapters.localdb.Pins, 'find').resolves([])
      const result = await uut.getFileMetadata(rpcData)

      assert.equal(result.success, true)
      assert.equal(result.status, 200)
      assert.equal(result.message, 'pin status, filename, and other metadata for a given CID')
      assert.equal(result.endpoint, 'getFileMetadata')
      assert.property(result, 'fileMetadata')
      assert.isObject(result.fileMetadata)
    })
    it('should handle error', async () => {
      const rpcData = {
        payload: {
          params: {
            cid: 'bafybeied3zdwdiro7fqytyha2yfband4lwcrtozmf6shynylt3kexh26dq'
          }
        }
      }
      sandbox.stub(uut.adapters.localdb.Pins, 'find').throws(new Error('getFileMetadata error'))
      const result = await uut.getFileMetadata(rpcData)

      assert.equal(result.success, false)
      assert.equal(result.status, 422)
      assert.equal(result.message, 'getFileMetadata error')
      assert.equal(result.endpoint, 'getFileMetadata')
    })
  })
  describe('#pinClaim', () => {
    it('should  process pin claim', async () => {
      const rpcData = {
        payload: {
          params: {
            proofOfBurnTxid: 'proofOfBurnTxid',
            cid: 'cid',
            claimTxid: 'claimTxid',
            filename: 'filename',
            address: 'address'
          }
        }
      }
      sandbox.stub(uut.useCases.ipfs, 'processPinClaim').resolves({ details: 'pin claim success' })
      const result = await uut.pinClaim(rpcData)

      assert.equal(result.success, true)
      assert.equal(result.status, 200)
      assert.equal(result.message, 'pin claim success')
      assert.equal(result.endpoint, 'pinClaim')
    })
    it('should handle error', async () => {
      const rpcData = {
        payload: {
          params: {
            proofOfBurnTxid: 'proofOfBurnTxid',
            cid: 'cid',
            claimTxid: 'claimTxid',
            filename: 'filename',
            address: 'address'
          }
        }
      }
      sandbox.stub(uut.useCases.ipfs, 'processPinClaim').throws(new Error('pin claim error'))
      const result = await uut.pinClaim(rpcData)

      assert.equal(result.success, false)
      assert.equal(result.status, 422)
      assert.equal(result.message, 'pin claim error')
      assert.equal(result.endpoint, 'pinClaim')
    })
  })
})
