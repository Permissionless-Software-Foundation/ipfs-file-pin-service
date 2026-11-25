/*
  Unit tests for the PS010 v2.0.0 fee schedule helper (requiredSats).
*/

// Public npm libraries
import { assert } from 'chai'

// Local libraries
import { requiredSats, MIN_CHARGE_BYTES } from '../../../src/use-cases/required-sats.js'

describe('#requiredSats', () => {
  describe('100 KB floor (dust-bounded)', () => {
    it('should charge the dust-bounded floor for a 50 KB file at 2000 sats/MB', () => {
      // 50 KB meters at 100 sats; the 100 KB floor is 200 sats, but the
      // dust limit (546) dominates.
      const result = requiredSats({ fileSizeBytes: 50000, satsPerMb: 2000 })

      assert.equal(result, 546)
    })

    it('should charge the dust-bounded floor for a zero-byte file', () => {
      const result = requiredSats({ fileSizeBytes: 0, satsPerMb: 2000 })

      assert.equal(result, 546)
    })

    it('should meter a file of exactly 100 KB (no ceiling drift)', () => {
      // Exactly at the boundary: 100 KB is metered, and the metered amount must
      // equal the floor. A naive 0.1 * satsPerMb would ceil to 201 here; the
      // dust bound lifts the floor above that.
      const result = requiredSats({ fileSizeBytes: MIN_CHARGE_BYTES, satsPerMb: 2000 })

      assert.equal(result, 546)
    })

    it('should keep the 100 KB floor for a high rate where dust does not dominate', () => {
      // 6000 sats/MB → 100 KB floor = 600, above the 546 dust limit.
      const result = requiredSats({ fileSizeBytes: 50000, satsPerMb: 6000 })

      assert.equal(result, 600)
    })

    it('should charge the floor when the metered amount is below it (99 KB)', () => {
      const result = requiredSats({ fileSizeBytes: 99000, satsPerMb: 2000 })

      assert.equal(result, 546)
    })

    it('should floor the production rate (5084) at the dust limit', () => {
      // 100 KB floor at 5084 sats/MB = 509 sats, below the dust limit; the
      // dust bound must lift it to 546 so small pins are spendable.
      assert.equal(requiredSats({ fileSizeBytes: 100000, satsPerMb: 5084 }), 546)
      assert.equal(requiredSats({ fileSizeBytes: 1000, satsPerMb: 5084 }), 546)
    })
  })

  describe('metering', () => {
    it('should meter 1 MB at 2000 sats/MB', () => {
      const result = requiredSats({ fileSizeBytes: 1000000, satsPerMb: 2000 })

      assert.equal(result, 2000)
    })

    it('should round sub-satoshi amounts up (above the dust floor)', () => {
      // 100,001 bytes at 6000 sats/MB = 600.006 sats => 601, above the 546
      // dust floor. (At 2000 sats/MB the dust floor would dominate.)
      const result = requiredSats({ fileSizeBytes: 100001, satsPerMb: 6000 })

      assert.equal(result, 601)
    })

    it('should meter a large file', () => {
      // 100 MB at 2000 sats/MB per year = 200,000 sats.
      const result = requiredSats({ fileSizeBytes: 100000000, satsPerMb: 2000 })

      assert.equal(result, 200000)
    })

    it('should meter with a non-round rate', () => {
      // 1.5 MB at 3333 sats/MB = 4999.5 sats => 5000 sats.
      const result = requiredSats({ fileSizeBytes: 1500000, satsPerMb: 3333 })

      assert.equal(result, 5000)
    })

    it('should apply the floor with a rate that is not a multiple of 10', () => {
      // 1 KB at 12345 sats/MB: metered = 12.345 => 13; floor = 1234.5 => 1235.
      const result = requiredSats({ fileSizeBytes: 1000, satsPerMb: 12345 })

      assert.equal(result, 1235)
    })
  })

  describe('input validation', () => {
    it('should throw if fileSizeBytes is missing', () => {
      try {
        requiredSats({ satsPerMb: 2000 })

        assert.fail('Unexpected code path')
      } catch (err) {
        assert.include(err.message, 'fileSizeBytes')
      }
    })

    it('should throw if fileSizeBytes is negative', () => {
      try {
        requiredSats({ fileSizeBytes: -1, satsPerMb: 2000 })

        assert.fail('Unexpected code path')
      } catch (err) {
        assert.include(err.message, 'fileSizeBytes')
      }
    })

    it('should throw if satsPerMb is missing (fail closed)', () => {
      try {
        requiredSats({ fileSizeBytes: 1000 })

        assert.fail('Unexpected code path')
      } catch (err) {
        assert.include(err.message, 'satsPerMb')
      }
    })

    it('should throw if satsPerMb is zero or negative', () => {
      try {
        requiredSats({ fileSizeBytes: 1000, satsPerMb: 0 })

        assert.fail('Unexpected code path')
      } catch (err) {
        assert.include(err.message, 'satsPerMb')
      }
    })

    it('should throw if satsPerMb is not a number', () => {
      try {
        requiredSats({ fileSizeBytes: 1000, satsPerMb: '2000' })

        assert.fail('Unexpected code path')
      } catch (err) {
        assert.include(err.message, 'satsPerMb')
      }
    })
  })
})
