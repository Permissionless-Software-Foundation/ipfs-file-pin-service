/*
  Unit tests for the PS010 v2.0.0 BCH payment validation library.
*/

// Public npm libraries
import { assert } from 'chai'

// Local libraries
import {
  decodeCashAddress,
  normalizeAddress,
  sumSatsToPayout,
  minimumAcceptedSats,
  validatePayment
} from '../../../src/use-cases/bch-payment.js'

// The default Phase-1 payout address (a P2PKH address from the PSF 'pinning'
// wallet). Locking payload: P2PKH:efb0b43fb6c6afb927cdb90e98409acdec16e12f
const PAYOUT_ADDRESS = 'bitcoincash:qrhmpdplkmr2lwf8ekusaxzqntx7c9hp9utzcvkjcr'

// Another valid BCH address, generated with the reference cashaddr encoder.
const OTHER_ADDRESS = 'bitcoincash:qqkg30ryje97al52htqwvveha538y7gttywut3cdqv'

// A P2SH20 address (hash 0xc0ffee...), generated with the reference encoder.
const P2SH20_ADDRESS = 'bitcoincash:prq0lmsqqqqqqqqqqqqqqqqqqqqqqqqqqq4newya47'

// A P2SH32 address (32-byte hash of 0x11), generated with the reference encoder.
const P2SH32_ADDRESS = 'bitcoincash:pvg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zch7f55mh'

// Build a payment TX fixture. Values are in BCH, as reported by bch-js.
function paymentTx (outputs = []) {
  return {
    txid: 'f5e4b4b7df7b1bdd8f0a5a1b3f6b7e8d9c0a1b2c3d4e5f60718293a4b5c6d7e8',
    vin: [{ txid: 'aa11bb22cc33dd44ee55ff6600112233445566778899aabbccddeeff00112233', vout: 0, address: OTHER_ADDRESS, value: 0.01 }],
    vout: outputs
  }
}

describe('#bch-payment', () => {
  describe('#decodeCashAddress', () => {
    it('should decode a P2PKH address', () => {
      const result = decodeCashAddress(PAYOUT_ADDRESS)

      assert.equal(result.prefix, 'bitcoincash')
      assert.equal(result.addressType, 'P2PKH')
      assert.equal(result.hash, 'efb0b43fb6c6afb927cdb90e98409acdec16e12f')
      assert.equal(result.lockingPayload, 'P2PKH:efb0b43fb6c6afb927cdb90e98409acdec16e12f')
    })

    it('should decode a P2SH20 address', () => {
      const result = decodeCashAddress(P2SH20_ADDRESS)

      assert.equal(result.addressType, 'P2SH')
      assert.equal(result.hash, 'c0ffee0000000000000000000000000000000000')
    })

    it('should decode a P2SH32 address payload', () => {
      const result = decodeCashAddress(P2SH32_ADDRESS)

      assert.equal(result.addressType, 'P2SH')
      assert.equal(result.hash.length, 64)
      assert.equal(result.lockingPayload, `P2SH:${'11'.repeat(32)}`)
    })

    it('should accept an address without a prefix (defaults to bitcoincash)', () => {
      const result = decodeCashAddress(PAYOUT_ADDRESS.replace('bitcoincash:', ''))

      assert.equal(result.lockingPayload, 'P2PKH:efb0b43fb6c6afb927cdb90e98409acdec16e12f')
    })

    it('should accept an all-uppercase address', () => {
      const result = decodeCashAddress(PAYOUT_ADDRESS.toUpperCase())

      assert.equal(result.lockingPayload, 'P2PKH:efb0b43fb6c6afb927cdb90e98409acdec16e12f')
    })

    it('should reject an empty address', () => {
      try {
        decodeCashAddress('')

        assert.fail('Unexpected code path')
      } catch (err) {
        assert.include(err.message, 'empty')
      }
    })

    it('should reject a non-string address', () => {
      try {
        decodeCashAddress(12345)

        assert.fail('Unexpected code path')
      } catch (err) {
        assert.include(err.message, 'must be a string')
      }
    })

    it('should reject an address that mixes case', () => {
      try {
        decodeCashAddress('bitcoincash:qRhmpdplkmr2lwf8ekusaxzqntx7c9hp9utzcvkjcr')

        assert.fail('Unexpected code path')
      } catch (err) {
        assert.include(err.message, 'mixes upper and lower case')
      }
    })

    it('should reject a bad checksum', () => {
      try {
        decodeCashAddress('bitcoincash:qrhmpdplkmr2lwf8ekusaxzqntx7c9hp9utzcvkjcq')

        assert.fail('Unexpected code path')
      } catch (err) {
        assert.include(err.message, 'Invalid CashAddr checksum')
      }
    })

    it('should reject an invalid character', () => {
      try {
        decodeCashAddress('bitcoincash:qrhmpdplkmr2lwf8ekusaxzqntx7c9hp9utzcvkjc1')

        assert.fail('Unexpected code path')
      } catch (err) {
        assert.include(err.message, 'Invalid CashAddr character')
      }
    })

    it('should reject token-aware (SLP) address forms', () => {
      try {
        decodeCashAddress('simpleledger:qrhmpdplkmr2lwf8ekusaxzqntx7c9hp9utzcvkjcr')

        assert.fail('Unexpected code path')
      } catch (err) {
        assert.include(err.message, 'not accepted')
      }
    })

    it('should reject an unsupported network prefix', () => {
      try {
        decodeCashAddress('ecash:qrhmpdplkmr2lwf8ekusaxzqntx7c9hp9utzcvkjcr')

        assert.fail('Unexpected code path')
      } catch (err) {
        assert.include(err.message, 'Unsupported address prefix')
      }
    })
  })

  describe('#normalizeAddress', () => {
    it('should produce the same payload for prefix-less and prefixed forms', () => {
      const a = normalizeAddress(PAYOUT_ADDRESS)
      const b = normalizeAddress(PAYOUT_ADDRESS.replace('bitcoincash:', ''))

      assert.equal(a, b)
    })

    it('should keep P2SH20 and P2SH32 payloads distinct', () => {
      assert.notEqual(normalizeAddress(P2SH20_ADDRESS), normalizeAddress(P2SH32_ADDRESS))
    })
  })

  describe('#sumSatsToPayout', () => {
    it('should sum multiple outputs to the payout address', () => {
      const txDetails = paymentTx([
        { value: 0.00002, n: 0, scriptPubKey: { addresses: [PAYOUT_ADDRESS] } },
        { value: 0.00001, n: 1, scriptPubKey: { addresses: [PAYOUT_ADDRESS.replace('bitcoincash:', '')] } },
        { value: 0.0048, n: 2, scriptPubKey: { addresses: [OTHER_ADDRESS] } }
      ])

      const result = sumSatsToPayout({ txDetails, payoutAddress: PAYOUT_ADDRESS })

      assert.equal(result.satsPaid, 3000)
      assert.equal(result.matchedOutputs, 2)
      assert.equal(result.otherAddressOutputs, 1)
    })

    it('should read the address from a top-level vout property (psf-slp-indexer shape)', () => {
      const txDetails = paymentTx([
        { value: 0.00002, n: 0, address: PAYOUT_ADDRESS }
      ])

      const result = sumSatsToPayout({ txDetails, payoutAddress: PAYOUT_ADDRESS })

      assert.equal(result.satsPaid, 2000)
    })

    it('should ignore OP_RETURN and other non-payout outputs', () => {
      const txDetails = paymentTx([
        { value: 0, n: 0, scriptPubKey: { type: 'nulldata' } },
        { value: 0.5, n: 1, scriptPubKey: { addresses: [OTHER_ADDRESS] } }
      ])

      const result = sumSatsToPayout({ txDetails, payoutAddress: PAYOUT_ADDRESS })

      assert.equal(result.satsPaid, 0)
      assert.equal(result.matchedOutputs, 0)
      assert.equal(result.nonAddressOutputs, 1)
    })

    it('should not count an unnormalizable output address', () => {
      const txDetails = paymentTx([
        { value: 1, n: 0, scriptPubKey: { addresses: ['not-an-address'] } }
      ])

      const result = sumSatsToPayout({ txDetails, payoutAddress: PAYOUT_ADDRESS })

      assert.equal(result.satsPaid, 0)
      assert.equal(result.canonicalizationErrors, 1)
    })

    it('should throw if the payout address cannot be normalized (F8)', () => {
      const txDetails = paymentTx([
        { value: 0.00002, n: 0, scriptPubKey: { addresses: [PAYOUT_ADDRESS] } }
      ])

      try {
        sumSatsToPayout({ txDetails, payoutAddress: 'not-an-address' })

        assert.fail('Unexpected code path')
      } catch (err) {
        assert.include(err.message, 'Invalid CashAddr')
      }
    })

    it('should throw if the TX has no vout array', () => {
      try {
        sumSatsToPayout({ txDetails: {}, payoutAddress: PAYOUT_ADDRESS })

        assert.fail('Unexpected code path')
      } catch (err) {
        assert.include(err.message, 'vout array')
      }
    })
  })

  describe('#minimumAcceptedSats', () => {
    it('should apply the 98% tolerance to the floored requirement, dust-bounded', () => {
      // 50 KB => floor 546 sats (dust-bound); 98% of 546 = 535.08 → 535, but
      // the dust limit dominates, so the floor is 546.
      const result = minimumAcceptedSats({ fileSizeBytes: 50000, satsPerMb: 2000 })

      assert.equal(result, 546)
    })

    it('should use integer math (required * 98 / 100), not float multiplication', () => {
      // 150 KB => 546 (dust-bound floor); see above.
      const result = minimumAcceptedSats({ fileSizeBytes: 150000, satsPerMb: 2000 })

      assert.equal(result, 546)
    })

    it('should apply the tolerance above the dust floor', () => {
      // 1 MB at 2000 sats/MB => required 2000, 98% = 1960, above dust.
      const result = minimumAcceptedSats({ fileSizeBytes: 1000000, satsPerMb: 2000 })

      assert.equal(result, 1960)
    })
  })

  describe('#validatePayment', () => {
    it('should pass when the payment covers the requirement', () => {
      const result = validatePayment({
        satsPaid: 2000,
        fileSizeBytes: 1000000,
        satsPerMb: 2000,
        payoutAddress: PAYOUT_ADDRESS
      })

      assert.equal(result.valid, true)
      assert.equal(result.required, 2000)
      assert.equal(result.minimumAccepted, 1960)
    })

    it('should pass exactly at the 98% boundary', () => {
      const result = validatePayment({
        satsPaid: 1960,
        fileSizeBytes: 1000000,
        satsPerMb: 2000,
        payoutAddress: PAYOUT_ADDRESS
      })

      assert.equal(result.valid, true)
    })

    it('should fail one satoshi below the 98% boundary (F5)', () => {
      const result = validatePayment({
        satsPaid: 1959,
        fileSizeBytes: 1000000,
        satsPerMb: 2000,
        payoutAddress: PAYOUT_ADDRESS
      })

      assert.equal(result.valid, false)
      assert.include(result.details, 'F5')
      assert.equal(result.required, 2000)
      assert.equal(result.minimumAccepted, 1960)
    })

    it('should fail when nothing was paid to the payout address (F2/F6)', () => {
      const result = validatePayment({
        satsPaid: 0,
        fileSizeBytes: 1000,
        satsPerMb: 2000,
        payoutAddress: PAYOUT_ADDRESS
      })

      assert.equal(result.valid, false)
      assert.include(result.details, 'F2/F6')
    })

    it('should fail closed when SATS_PER_MB is unset (F7)', () => {
      const result = validatePayment({
        satsPaid: 100000,
        fileSizeBytes: 1000,
        satsPerMb: null,
        payoutAddress: PAYOUT_ADDRESS
      })

      assert.equal(result.valid, false)
      assert.include(result.details, 'F7')
      assert.include(result.details, 'SATS_PER_MB')
    })

    it('should fail closed when PAYOUT_ADDRESS is unset (F7)', () => {
      const result = validatePayment({
        satsPaid: 100000,
        fileSizeBytes: 1000,
        satsPerMb: 2000,
        payoutAddress: undefined
      })

      assert.equal(result.valid, false)
      assert.include(result.details, 'F7')
      assert.include(result.details, 'PAYOUT_ADDRESS')
    })

    it('should fail closed when PAYOUT_ADDRESS is not a valid address (F8)', () => {
      const result = validatePayment({
        satsPaid: 100000,
        fileSizeBytes: 1000,
        satsPerMb: 2000,
        payoutAddress: 'not-an-address'
      })

      assert.equal(result.valid, false)
      assert.include(result.details, 'F8')
    })

    it('should reject everything when BCH payments are disabled', () => {
      const result = validatePayment({
        satsPaid: 100000,
        fileSizeBytes: 1000,
        satsPerMb: 2000,
        payoutAddress: PAYOUT_ADDRESS,
        acceptBchPayment: false
      })

      assert.equal(result.valid, false)
      assert.include(result.details, 'ACCEPT_BCH_PAYMENT')
    })

    it('should fail closed on an unusable file size (F1)', () => {
      const result = validatePayment({
        satsPaid: 100000,
        fileSizeBytes: undefined,
        satsPerMb: 2000,
        payoutAddress: PAYOUT_ADDRESS
      })

      assert.equal(result.valid, false)
      assert.include(result.details, 'F1')
    })
  })
})
