/*
  Unit tests for the Pin entity library.
*/

import { assert } from 'chai'

import sinon from 'sinon'
import User from '../../../src/entities/pin.js'

let sandbox
let uut

describe('#Pin-Entity', () => {
  before(async () => {})

  beforeEach(() => {
    uut = new User()

    sandbox = sinon.createSandbox()
  })

  afterEach(() => sandbox.restore())

  describe('#validate', () => {
    it('should throw an error if proofOfBurnTxid is not provided', () => {
      try {
        uut.validate()
      } catch (err) {
        assert.include(err.message, "Property 'proofOfBurnTxid' must be a string!")
      }
    })

    it('should throw an error if cid is not provided', () => {
      try {
        uut.validate({ proofOfBurnTxid: 'fake-txid' })
      } catch (err) {
        assert.include(err.message, "Property 'cid' must be a string!")
      }
    })

    it('should throw an error if claimTxid is not provided', () => {
      try {
        uut.validate({ proofOfBurnTxid: 'fake-txid', cid: 'test' })
      } catch (err) {
        assert.include(err.message, "Property 'claimTxid' must be a string!")
      }
    })

    it('should return a Pin object', () => {
      const inputData = {
        proofOfBurnTxid: 'fake-txid',
        cid: 'test',
        claimTxid: 'test-txid',
        filename: 'test.txt'
      }

      const result = uut.validate(inputData)

      assert.property(result, 'proofOfBurnTxid')
      assert.property(result, 'cid')
      assert.property(result, 'claimTxid')
      assert.property(result, 'pobTxDetails')
      assert.property(result, 'claimTxDetails')
      assert.property(result, 'tokensBurned')
      assert.property(result, 'validClaim')
      assert.property(result, 'dataPinned')
    })
  })
})
