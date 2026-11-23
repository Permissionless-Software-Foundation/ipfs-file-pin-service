# Pin Claim Processing

Below is a high-level description of how a new Pin Claim is processed.

**This service implements PS010 v2.0.0 (draft): BCH payments only.** There is no
PSF-token proof-of-burn path, no PS009 write-price history lookup, no token
fallback price and no mode flag — a v2.0.0 pin-service simply does not validate
v1.0.0 (token burn) claims. See `memory/life/projects/cash-flows/specs/ps010-bch-draft.md`
for the normative rules.

Primary implementation: `src/use-cases/ipfs.js` (`processPinClaim`, `pinCid`, `pinCidForTimerController`, `_tryToGetCid`), with the payment rules in
`src/use-cases/bch-payment.js` and the fee schedule in
`src/use-cases/required-sats.js`.
Periodic retries: `src/controllers/timer-controllers.js` (`pinCids`). See [periodic-pin-retry.md](./periodic-pin-retry.md) for a dedicated overview of the retry loop.

Entry points:
- REST: `POST /ipfs/pin-claim`
- REST: `GET /ipfs/payment-address` (client-facing payout details)
- JSON-RPC: `file-pin` method with endpoint `pinClaim`

## Configuration

| Env var | Config | Meaning |
| --- | --- | --- |
| `PAYOUT_ADDRESS` | `payoutAddress` | BCH address that receives pin payments. Defaults to the PSF `pinning` wallet (`bitcoincash:qrhmpdplkmr2lwf8ekusaxzqntx7c9hp9utzcvkjcr`). |
| `SATS_PER_MB` | `satsPerMb` | Price of pinning, in satoshis per MB per year. **Required** — unset means every claim is rejected (fail closed). |
| `ACCEPT_BCH_PAYMENT` | `acceptBchPayment` | `false` disables claim intake entirely (default `true`). |
| — | `maxPinSize` | Maximum file size in bytes (unchanged). |

Both `PAYOUT_ADDRESS` and `SATS_PER_MB` must be set for the service to accept
claims or to serve a payment address. There is no hardcoded fallback address and
no fallback rate.

## Payment flow (PS010 §6)

1. Client: `GET /ipfs/payment-address` → `{ address, satsPerMb }`
   (Phase 1 has no registry, so there is no `validFromHeight` / `registryTxid`).
   The endpoint responds **503** if the address or rate is unset, or if the
   configured address is not a usable CashAddr.
2. Client: `requiredSats = requiredSats({ fileSizeBytes, satsPerMb })`.
   The 100 KB minimum charge is inside that helper; clients must not add a floor
   of their own.
3. Client: send `requiredSats` (plus fee) to `address`.
4. Client: build the Pin Claim with the **payment txid** in claim field 2 and
   broadcast it, then notify `POST /ipfs/pin-claim` (wire format unchanged).

## Fee schedule (`src/use-cases/required-sats.js`)

```
requiredSats({ fileSizeBytes, satsPerMb }) =
    max( ceil( fileSizeBytes / 1e6 * satsPerMb ),
         ceil( 0.1 * satsPerMb ) )
```

- Files ≥ 100 KB are metered: `ceil(bytes / 1e6 * satsPerMb)`.
- Files < 100 KB pay the floor: `ceil(0.1 * satsPerMb)`.
- The floor is a pricing rule applied *before* the 98% tolerance.
- The helper uses integer math (`bytes * satsPerMb / 1e6`, `satsPerMb / 10`) so a
  file of exactly 100 KB does not ceil up to the floor + 1.

## High-Level Pin Claim Processing Workflow

### 1. **Initial Setup & Input Validation**
- The function receives a pin claim object containing:
  - `proofOfBurnTxid` - **payment txid** (field name retained for wire compatibility)
  - `cid` - IPFS Content Identifier of the file to be pinned
  - `claimTxid` - Transaction ID of the pin claim transaction
  - `filename` - Name of the file
  - `address` - Bitcoin Cash address making the claim
- Fail-closed config checks happen first: if `acceptBchPayment` is false, or
  `PAYOUT_ADDRESS` / `SATS_PER_MB` are unset, the claim is rejected with a
  distinct `details` string (F7).

### 2. **BCH Payment Verification** (`src/use-cases/bch-payment.js`)
- **Wait Period**: 3-second delay to ensure the transactions have propagated
- **Fetch payment TX**: `wallet.getTxData([proofOfBurnTxid])`. If it cannot be
  fetched, the claim is rejected with an F4 reason.
- **Fetch claim TX**: `wallet.getTxData([claimTxid])`.
- **Address normalization**: the payout address and every payment output are
  decoded to their CashAddr *locking payload* (`P2PKH:<hash>` / `P2SH:<hash>`).
  Payloads are compared, not display strings, so prefixed/prefix-less forms of
  the same address match. Token-aware (`simpleledger:` / `S:`) forms and
  non-BCH prefixes are rejected; P2SH20 and P2SH32 payloads are never conflated.
- **Sats paid**: `satsPaid = Σ vout[i].value` over outputs whose normalized
  payload equals the payout address. Multiple payout outputs all count; change
  and other outputs never count.
- **Unconfirmed payments are accepted** (PS010 decision 9b): height and
  confirmation count are never inspected.
- If the payment TX pays nothing to the payout address, the claim is rejected
  (F2/F6) before any download is attempted.
- Failed checks return `{ success: false, details: ... }` rather than throwing.
  Unexpected errors (e.g. claim TX unfetchable) still throw and return HTTP 422.

### 3. **Database Management & Renewal**
- **Entity Validation**: `PinEntity` validates and structures the pin claim,
  including `paymentKind: 'bch-payment'`, `satsPaid` and `payoutAddress`.
- **Renewal Handling**: `handleRenewal()` runs when a CID already exists:
  - Renewal is a new claim with a new payment reference. Bookkeeping stays
    TXID-keyed: superseded claim/payment txids are pushed onto `claimTxids` /
    `pobTxids`, and a payment txid is *not* marked as globally consumed.
  - The new `satsPaid` / `payoutAddress` are recorded with the renewal.
- **Duplicate Check**: looks up an existing database record by CID
- **State Handling**:
  - If CID exists with `validClaim` and is awaiting download (`!dataPinned`) → returns success without reprocessing
  - If CID exists with `validClaim` and `dataPinned` → returns success without reprocessing
  - If CID doesn't exist → creates a new database record (`validClaim: null`, `dataPinned: false`)
  - If CID exists but has not validated yet, the freshly submitted payment
    (`satsPaid`, `paymentKind`, `payoutAddress`, `proofOfBurnTxid`) is adopted so
    the retry path validates the new payment

### 4. **Asynchronous Processing Initiation**
- **Non-blocking Call**: initiates `pinCid()` without awaiting (fire-and-forget)
- **Immediate Response**: returns success response to the API caller
- Long-running / failed downloads are also retried later by the Timer Controller (section 5b)

### 5a. **Submit-Time Pin Processing** (via `pinCid()`)
- **Duplicate Prevention**: Checks the in-memory pin tracker; skips if the CID is already being processed
- **File Download**: Downloads the file from IPFS using the retry queue with a 5-minute timeout (`_getCidWithTimeout`)
- **Size Validation**: Verifies file size is under `maxPinSize`
- **Payment Validation** (`validateSizeAndPayment` → `validatePayment`):
  - `required = requiredSats({ fileSizeBytes: fileSize, satsPerMb })` using the
    configured rate. **There is no price cache**: the old process-wide
    `writePrice` cache (primed at boot) is gone.
  - Pass if `satsPaid >= floor(required * 98 / 100)` (98% tolerance). No USD
    oracle, no historical price lookup, no fallback price.
  - Fail closed if `SATS_PER_MB` / `PAYOUT_ADDRESS` are unset or unusable, and
    on any unexpected error.
  - The rejection reason (F1/F2/F5/F6/F7/F8) is logged.
- **IPFS Pinning**: If validation passes, pins the file to the local IPFS node and announces it via `routing.provide()` (DHT)
- **Database Update**: Updates the database record with final status (`dataPinned: true`, `validClaim: true`, `fileSize`)
- **Download failures**: Timeouts, throws, and missing size call `_recordDownloadFailure` (bumps `downloadTries`, sets `nextRetryAt` backoff) and clear the pin tracker so the timer path can retry later

### 5b. **Periodic Retry Processing** (Timer Controller → `pinCidForTimerController` → `_tryToGetCid`)

See [periodic-pin-retry.md](./periodic-pin-retry.md) for a full explanation. Summary:

- Starts ~4 minutes after server boot, then runs about every `pinRetryIntervalMs` (default 10 minutes)
- Selects **unpinned** candidates only (`dataPinned: false`), due for retry (`nextRetryAt <= now`), under `pinRetryMaxTries`
- Sorts by fewest `downloadTries`, then newest `recordTime`; respects download-slot backpressure and skips in-flight CIDs
- Soft-quarantine budget occasionally revives exhausted CIDs after a cooldown (no global `downloadTries` reset)
- On failed download (including timeout/throw): increments `downloadTries`, sets `lastDownloadAttempt` and exponential `nextRetryAt`
- On success: pins, DHT-provides, and sets `dataPinned: true`, `validClaim: true`
- Payment is re-checked on every retry with the same rule (2 MB file, 2000
  sats/MB → 4000 sats required, 3920 sats accepted).

### 6. **Error Handling & Cleanup**
- **Failed Downloads**: Both submit-time and timer paths record failures via `_recordDownloadFailure` so impossible CIDs age out of the hot path
- **Invalid Claims**: If size/payment validation fails, removes the database record to prevent retry loops
- **Already Pinned**: Handles cases where the file is already pinned on the IPFS node
- **In-flight Dedup**: Pin tracker prevents the same CID from being downloaded multiple times concurrently

### Failure codes (PS010 §7.3)

| Code | Meaning in Phase 1 |
| --- | --- |
| F1 | No validating address/rate resolves: `PAYOUT_ADDRESS` or `SATS_PER_MB` unset |
| F2 | Wrong address: the payment went somewhere other than the payout address |
| F3 | Not applicable in Phase 1 (no epochs) |
| F4 | Payment TX unfetchable (txid unknown, or the TX cannot be retrieved) |
| F5 | Insufficient sats: `satsPaid < floor(required * 0.98)` |
| F6 | Presented TX is not a BCH payment to the payout address |
| F7 | Misconfiguration (`SATS_PER_MB` / `PAYOUT_ADDRESS` unset, or payments disabled) |
| F8 | Address canonicalization failure (config address or payment output) |
| F9 | Not applicable in Phase 1 (no registry) |

## Pin record fields

Every new record carries:

- `paymentKind`: `'bch-payment'`
- `satsPaid`: integer satoshis paid to the payout address
- `payoutAddress`: the payout address the payment was validated against
- `proofOfBurnTxid`: the payment txid (field name retained, PS010 §7.5)
- `pobTxDetails`: the payment TX data (field name retained)

`tokensBurned` is not written for new records; the field is retained on the
schema so old documents still load. Phase 1 records hold the payout address in
`payoutAddress`; Phase 2 will add `poolAddress` from the epoch.

## Key Features:
- **Asynchronous Processing**: Submit returns immediately while pinning continues in the background
- **Dual Paths**: Immediate `pinCid()` on submit, plus Timer Controller retries via `_tryToGetCid`
- **Fair Retries**: Unpinned-only selection, exponential backoff, quarantine budget instead of blanket try resets
- **Economic Validation**: BCH payment to one configured payout address, priced in fixed sats/MB with a 100 KB floor and a 98% tolerance
- **Fail Closed**: missing payout address/rate, unusable addresses and unfetchable payment TXs all reject the claim
- **Renewals**: Same CID can be re-submitted with a new payment/claim TX; prior TXIDs stored in `claimTxids` / `pobTxids`
- **Duplicate Prevention**: In-memory pin tracker plus DB state (`validClaim` / `dataPinned` / `nextRetryAt`)
- **State Management**: Pin tracker (memory), Pin model fields (`downloadTries`, `lastDownloadAttempt`, `nextRetryAt`, `fileSize`, renewal TXID arrays)

This workflow validates pin claims economically and technically before files are permanently pinned, returns immediate feedback on submit, and continues background retries until download and validation succeed or the claim is rejected.
