/*
  BCH payment validation for PS010 v2.0.0 (Phase 1, single payout address).

  The pin-service is single-mode: a claim is valid only if the transaction named
  in the webhook's `proofOfBurnTxid` field is a real BCH transaction that pays
  the operator-configured payout address at least requiredSats() for the file
  size (within the 98% tolerance). There is no token path, no legacy
  proof-of-burn path and no mode flag (PS010 §7, §8.2).

  This module is pure: no wallet, no database, no config import. That keeps the
  rules unit-testable and keeps the F-code reasons (PS010 §7.3) checkable.
*/

// Local libraries
import { requiredSats } from './required-sats.js'

// CashAddr parameters (https://github.com/bitcoincashorg/bitcoincash.org/blob/master/spec/cashaddr.md)
const CHARSET = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l'
const GENERATORS = [0x98f2bc8e61, 0x79b76d99e2, 0xf33e5fb3c4, 0xae2eabe2a8, 0x1e4f43e470]
const CHECKSUM_LENGTH = 8

// Accepted network prefixes. PS010 Phase 1 operates on BCH mainnet.
const PREFIXES = ['bitcoincash', 'bchtest', 'bchreg']

// Token-aware (SLP) address forms. These are explicitly NOT accepted: PS010
// §7.1 step 3 says do not require or accept a token-aware form.
const TOKEN_PREFIXES = ['simpleledger', 'slp', 's']

// CashAddr address types. PS010 cares about the locking payload: P2PKH (0) and
// P2SH (1, covering both P2SH20 and P2SH32).
const ADDRESS_TYPES = { 0: 'P2PKH', 1: 'P2SH' }

// Satoshis in one BCH. bch-js' getTxData() reports vout values in BCH.
const SATS_PER_BCH = 100000000

// Percentage of the required amount that is accepted, as a rounding/overhead
// allowance (PS010 §7 step 4). This is not licence to underpay by design.
const TOLERANCE_PERCENT = 98

// CashAddr checksum, computed with BigInt so the 40-bit accumulator cannot
// overflow (the reference implementation needs 5x32 bits).
// The result is 1 for a valid address (the reference implementation xors with
// 1 before comparing against 0).
function polymod (values) {
  let chk = 1n

  for (const value of values) {
    const top = chk >> 35n
    chk = ((chk & 0x07ffffffffn) << 5n) ^ BigInt(value)

    for (let i = 0; i < 5; i++) {
      if ((top >> BigInt(i)) & 1n) chk ^= BigInt(GENERATORS[i])
    }
  }

  return chk
}

// Convert an array of 5-bit values into bytes. Leftover bits must be zero
// padding, as required by the CashAddr spec.
function fiveBitsToBytes (fiveBitValues) {
  const bytes = []
  let acc = 0
  let bits = 0

  for (const value of fiveBitValues) {
    acc = (acc << 5) | value
    bits += 5

    while (bits >= 8) {
      bits -= 8
      bytes.push((acc >> bits) & 0xff)
    }
  }

  // Any partial byte must be zero padding (CashAddr uses 0-4 padding bits).
  if (bits >= 5 || (acc & ((1 << bits) - 1)) !== 0) {
    throw new Error('Invalid CashAddr padding')
  }

  return bytes
}

// Decode a CashAddr string into its type and locking payload.
// Throws on malformed addresses. Token-aware (SLP) forms are rejected.
export function decodeCashAddress (address) {
  if (typeof address !== 'string') {
    throw new Error('Address must be a string')
  }

  const trimmed = address.trim()
  if (!trimmed) throw new Error('Address is empty')

  // CashAddr must not mix upper and lower case.
  const hasLower = trimmed !== trimmed.toUpperCase()
  const hasUpper = trimmed !== trimmed.toLowerCase()
  if (hasLower && hasUpper) {
    throw new Error(`Address mixes upper and lower case: ${trimmed}`)
  }

  const parts = trimmed.toLowerCase().split(':')

  let prefix = 'bitcoincash'
  let payloadStr
  if (parts.length === 1) {
    payloadStr = parts[0]
  } else if (parts.length === 2) {
    prefix = parts[0]
    payloadStr = parts[1]
  } else {
    throw new Error(`Invalid address format: ${trimmed}`)
  }

  if (TOKEN_PREFIXES.includes(prefix)) {
    throw new Error(`Token-aware (SLP) addresses are not accepted: ${trimmed}`)
  }
  if (!PREFIXES.includes(prefix)) {
    throw new Error(`Unsupported address prefix "${prefix}" for address: ${trimmed}`)
  }
  if (payloadStr.length < CHECKSUM_LENGTH + 1) {
    throw new Error(`Address payload is too short: ${trimmed}`)
  }

  // Decode the base32 payload.
  const data = []
  for (const char of payloadStr) {
    const value = CHARSET.indexOf(char)
    if (value === -1) {
      throw new Error(`Invalid CashAddr character "${char}" in address: ${trimmed}`)
    }
    data.push(value)
  }

  // Verify the checksum: prefix (low 5 bits of each char) + separator 0 + payload.
  const prefixData = []
  for (const char of prefix) {
    prefixData.push(char.charCodeAt(0) & 0x1f)
  }
  prefixData.push(0)

  if (polymod(prefixData.concat(data)) !== 1n) {
    throw new Error(`Invalid CashAddr checksum: ${trimmed}`)
  }

  // Drop the checksum, then convert the payload bits to bytes:
  // [version byte][hash bytes][zero padding].
  const payloadValues = data.slice(0, data.length - CHECKSUM_LENGTH)
  const bytes = fiveBitsToBytes(payloadValues)

  if (bytes.length < 2) {
    throw new Error(`Address payload is too short: ${trimmed}`)
  }

  const versionByte = bytes[0]
  const type = (versionByte >> 3) & 0x0f
  const hash = Buffer.from(bytes.slice(1)).toString('hex')

  if (!Object.prototype.hasOwnProperty.call(ADDRESS_TYPES, type)) {
    throw new Error(`Unsupported address type ${type} in address: ${trimmed}`)
  }

  return {
    prefix,
    type,
    addressType: ADDRESS_TYPES[type],
    hash,
    // The comparable locking payload. Two addresses match if these are equal.
    lockingPayload: `${ADDRESS_TYPES[type]}:${hash}`
  }
}

// Return the canonical locking payload for an address, for comparison.
// Display strings are never compared (PS010 §7.1 step 3).
export function normalizeAddress (address) {
  return decodeCashAddress(address).lockingPayload
}

// Extract the address(es) an output pays. Different bits of the Cash Stack
// report this in different places (full-node verbose tx vs psf-slp-indexer).
function outputAddresses (vout) {
  if (!vout || typeof vout !== 'object') return []

  const addresses = []

  if (typeof vout.address === 'string') addresses.push(vout.address)

  const scriptPubKey = vout.scriptPubKey
  if (scriptPubKey && typeof scriptPubKey === 'object') {
    if (Array.isArray(scriptPubKey.addresses)) {
      for (const address of scriptPubKey.addresses) {
        if (typeof address === 'string') addresses.push(address)
      }
    }
    if (typeof scriptPubKey.address === 'string') addresses.push(scriptPubKey.address)
  }

  return addresses
}

// Convert a vout value (BCH units) to an integer number of satoshis.
function valueToSats (value) {
  const sats = Math.round(Number(value) * SATS_PER_BCH)
  if (!Number.isFinite(sats) || sats < 0) {
    throw new Error(`Output value is not a usable BCH amount: ${value}`)
  }
  return sats
}

// Sum the satoshis paid to the payout address by a payment transaction.
//
// satsPaid = Σ vout[i].value over the outputs whose locking payload equals the
// payout address' locking payload. Multiple outputs count; change and other
// outputs never count (PS010 §7 step 2).
//
// Throws if the payout address cannot be normalized (F8/misconfiguration) or
// if the transaction has no usable vout array.
export function sumSatsToPayout (inObj = {}) {
  const { txDetails, payoutAddress } = inObj

  if (!txDetails || typeof txDetails !== 'object' || !Array.isArray(txDetails.vout)) {
    throw new Error('sumSatsToPayout() requires txDetails with a vout array')
  }

  // F8: fail closed if the configured address is not comparable.
  const normalizedPayout = normalizeAddress(payoutAddress)

  let satsPaid = 0
  let matchedOutputs = 0
  let otherAddressOutputs = 0
  let nonAddressOutputs = 0
  let canonicalizationErrors = 0

  for (const vout of txDetails.vout) {
    const addresses = outputAddresses(vout)

    if (!addresses.length) {
      nonAddressOutputs++
      continue
    }

    let matches = false
    for (const address of addresses) {
      let normalized
      try {
        normalized = normalizeAddress(address)
      } catch (err) {
        // F8: an output address that cannot be normalized simply never matches.
        canonicalizationErrors++
        continue
      }

      if (normalized === normalizedPayout) matches = true
    }

    if (matches) {
      satsPaid += valueToSats(vout.value)
      matchedOutputs++
    } else {
      otherAddressOutputs++
    }
  }

  return {
    satsPaid,
    normalizedPayout,
    matchedOutputs,
    otherAddressOutputs,
    nonAddressOutputs,
    canonicalizationErrors
  }
}

// Compute the minimum acceptable payment for a file, with tolerance applied.
export function minimumAcceptedSats (inObj = {}) {
  const { fileSizeBytes, satsPerMb } = inObj

  const required = requiredSats({ fileSizeBytes, satsPerMb })

  // Integer math, so required=200 => 196 and not 195 due to 196.00000000000003.
  return Math.floor((required * TOLERANCE_PERCENT) / 100)
}

// Decide whether a recorded BCH payment satisfies PS010 §7 for a file.
//
// Returns { valid, details, required, minimumAccepted }. `details` carries a
// distinguishable F-code reason (PS010 §7.3) so failures are not collapsed into
// one generic error. Fails closed on misconfiguration.
export function validatePayment (inObj = {}) {
  const { satsPaid, fileSizeBytes, satsPerMb, payoutAddress, acceptBchPayment = true } = inObj

  // A disabled payment method accepts nothing.
  if (!acceptBchPayment) {
    return {
      valid: false,
      details: 'BCH payments are disabled (ACCEPT_BCH_PAYMENT=false). Rejecting claim.'
    }
  }

  // F7 (Phase 1): misconfiguration. Reject rather than guess an address or rate.
  if (!payoutAddress || typeof payoutAddress !== 'string') {
    return {
      valid: false,
      details: 'F7: PAYOUT_ADDRESS is not configured. Rejecting claim (fail closed).'
    }
  }
  if (typeof satsPerMb !== 'number' || !Number.isFinite(satsPerMb) || satsPerMb <= 0) {
    return {
      valid: false,
      details: 'F7: SATS_PER_MB is not configured. Rejecting claim (fail closed).'
    }
  }

  // F8: the configured payout address must be comparable.
  try {
    normalizeAddress(payoutAddress)
  } catch (err) {
    return {
      valid: false,
      details: `F8: PAYOUT_ADDRESS cannot be normalized (${err.message}). Rejecting claim.`
    }
  }

  // F1/F5: compute what this file should have paid.
  let required, minimumAccepted
  try {
    required = requiredSats({ fileSizeBytes, satsPerMb })
    minimumAccepted = minimumAcceptedSats({ fileSizeBytes, satsPerMb })
  } catch (err) {
    return {
      valid: false,
      details: `F1: cannot compute required sats (${err.message}). Rejecting claim.`
    }
  }

  // F2/F6: no BCH was paid to the validating address.
  if (typeof satsPaid !== 'number' || !Number.isFinite(satsPaid) || satsPaid <= 0) {
    return {
      valid: false,
      required,
      minimumAccepted,
      details: `F2/F6: no BCH payment to payout address ${payoutAddress} (paid ${satsPaid} sats).`
    }
  }

  // F5: insufficient sats.
  if (satsPaid < minimumAccepted) {
    return {
      valid: false,
      required,
      minimumAccepted,
      details: `F5: insufficient sats. Required ${required} sats (98% floor ${minimumAccepted}), paid ${satsPaid} sats.`
    }
  }

  return {
    valid: true,
    required,
    minimumAccepted,
    details: `BCH payment accepted: required ${required} sats (98% floor ${minimumAccepted}), paid ${satsPaid} sats to ${payoutAddress}.`
  }
}

export default { requiredSats, decodeCashAddress, normalizeAddress, sumSatsToPayout, minimumAcceptedSats, validatePayment }
