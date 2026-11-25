/*
  Fee schedule math for PS010 v2.0.0 (BCH payment model).

  requiredSats() is the single definition of how many satoshis a pin claim must
  pay, in the pin-service:

    requiredSats({ fileSizeBytes, satsPerMb }) =
        max( ceil( fileSizeBytes / 1e6 * satsPerMb ),
             ceil( 0.1 * satsPerMb ),
             546 )

  The second term is the locked 100 KB minimum charge (PS010 §3). The floor is a
  pricing rule that lives inside this helper; callers (client or validator) MUST
  NOT re-derive a floor of their own. The third term dust-bounds the floor: a
  quote below the BCH dust limit (546 sats) can never be paid, because relaying
  nodes reject the broadcast ("dust" error). Operators with a low satsPerMb
  therefore still get a spendable minimum quote.

  PS010 §3 also states that this function is defined once in the shared
  psffpp-payments library and imported by both announcer and pin-service. Until
  that library is published, this module is the pin-service copy of the same
  definition; the announcer must import it rather than reimplementing it.
*/

// Bytes in a megabyte, per PS010 §3 (decimal MB, not MiB).
const BYTES_PER_MB = 1000000

// The locked minimum charge, expressed in bytes: 100 KB (PS010 §3).
export const MIN_CHARGE_BYTES = 100000

// BCH standard dust limit. An output below this value is uneconomical to
// spend and relaying nodes refuse to broadcast it ("dust" rejection). See the
// header comment on requiredSats() for why the floor is bounded by this.
export const DUST_SATS = 546

// Compute the number of satoshis required for a pin claim.
//
// Both inputs are required. Throws on anything that is not a usable number, so
// that callers fail closed rather than validating against NaN/undefined.
export function requiredSats (inObj = {}) {
  const { fileSizeBytes, satsPerMb } = inObj

  // Input validation.
  if (typeof fileSizeBytes !== 'number' || !Number.isFinite(fileSizeBytes) || fileSizeBytes < 0) {
    throw new Error('requiredSats() fileSizeBytes must be a finite number >= 0')
  }
  if (typeof satsPerMb !== 'number' || !Number.isFinite(satsPerMb) || satsPerMb <= 0) {
    throw new Error('requiredSats() satsPerMb must be a finite number > 0')
  }

  // Metered charge. Integer multiplication first, to avoid floating point drift
  // (e.g. 100000 / 1e6 * 2000 = 200.00000000000003 in IEEE 754, which would
  // ceil to 201 and overcharge a file that is exactly 100 KB).
  const meteredSats = Math.ceil((fileSizeBytes * satsPerMb) / BYTES_PER_MB)

  // 100 KB minimum charge. Same trick: satsPerMb / 10 rather than 0.1 * satsPerMb.
  // The floor is additionally bounded below by the dust limit, so that the
  // validator never asks for (or accepts) an amount the network could not relay.
  const floorSats = Math.max(
    Math.ceil(satsPerMb / (BYTES_PER_MB / MIN_CHARGE_BYTES)),
    DUST_SATS
  )

  return Math.max(meteredSats, floorSats)
}

export default requiredSats
