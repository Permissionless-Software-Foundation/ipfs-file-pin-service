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

    it('should throw an error if filename is not provided', () => {
      try {
        uut.validate({ proofOfBurnTxid: 'fake-txid', cid: 'test', claimTxid: 'fake-txid' })
      } catch (err) {
        assert.include(err.message, "Property 'filename' must be a string!")
      }
    })

    it('should throw an error if address is not provided', () => {
      try {
        uut.validate({ proofOfBurnTxid: 'fake-txid', cid: 'test', claimTxid: 'fake-txid', filename: 'test.txt' })
      } catch (err) {
        assert.include(err.message, "Property 'address' must be a string!")
      }
    })

    it('should throw an error if payoutAddress is not provided', () => {
      try {
        uut.validate({ proofOfBurnTxid: 'fake-txid', cid: 'test', claimTxid: 'fake-txid', filename: 'test.txt', address: 'fake-address' })

        assert.fail('Unexpected code path')
      } catch (err) {
        assert.include(err.message, "Property 'payoutAddress' must be a string!")
      }
    })

    it('should throw an error if satsPaid is not a positive number', () => {
      try {
        uut.validate({ proofOfBurnTxid: 'fake-txid', cid: 'test', claimTxid: 'fake-txid', filename: 'test.txt', address: 'fake-address', payoutAddress: 'fake-payout' })

        assert.fail('Unexpected code path')
      } catch (err) {
        assert.include(err.message, "Property 'satsPaid' must be a number greater than 0!")
      }
    })

    it('should return a Pin object with BCH payment fields', () => {
      const inputData = {
        proofOfBurnTxid: 'fake-txid',
        cid: 'test',
        claimTxid: 'test-txid',
        filename: 'test.txt',
        address: 'fake-address',
        payoutAddress: 'bitcoincash:qrhmpdplkmr2lwf8ekusaxzqntx7c9hp9utzcvkjcr',
        satsPaid: 3000,
        paymentKind: 'bch-payment'
      }

      const result = uut.validate(inputData)

      assert.property(result, 'proofOfBurnTxid')
      assert.property(result, 'cid')
      assert.property(result, 'claimTxid')
      assert.property(result, 'pobTxDetails')
      assert.property(result, 'claimTxDetails')
      assert.property(result, 'validClaim')
      assert.property(result, 'dataPinned')
      assert.property(result, 'address')

      // PS010 v2.0.0 payment fields.
      assert.equal(result.paymentKind, 'bch-payment')
      assert.equal(result.satsPaid, 3000)
      assert.equal(result.payoutAddress, inputData.payoutAddress)

      // No legacy PSF-token field is written for new records.
      assert.notProperty(result, 'tokensBurned')
    })
  })
})
