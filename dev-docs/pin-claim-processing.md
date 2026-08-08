# Pin Claim Processing

Below is a high-level description of how a new Pin Claim is processed.

Primary implementation: `src/use-cases/ipfs.js` (`processPinClaim`, `pinCid`, `pinCidForTimerController`, `_tryToGetCid`).  
Periodic retries: `src/controllers/timer-controllers.js` (`pinCids`). See [periodic-pin-retry.md](./periodic-pin-retry.md) for a dedicated overview of the retry loop.

Entry points:
- REST: `POST /ipfs/pin-claim`
- JSON-RPC: `file-pin` method with endpoint `pinClaim`

## High-Level Pin Claim Processing Workflow

### 1. **Initial Setup & Input Validation**
- The function receives a pin claim object containing:
  - `proofOfBurnTxid` - Transaction ID of the proof-of-burn transaction
  - `cid` - IPFS Content Identifier of the file to be pinned
  - `claimTxid` - Transaction ID of the pin claim transaction
  - `filename` - Name of the file
  - `address` - Bitcoin Cash address making the claim

### 2. **Transaction Verification**
- **Wait Period**: 3-second delay to ensure transactions have been processed by the network
- **Fetch Transaction Data**: Retrieves details for both the proof-of-burn and claim transactions
- **SLP Validation**: Verifies the proof-of-burn transaction is a valid SLP (Simple Ledger Protocol) transaction
- **Token Validation**: Ensures the proof-of-burn consumes the correct PSF token (ID: `38e97c5d7d3585a2cbf3f9580c82ca33985f9cb0845d4dcce220cb709f9538b0`)
- **Token Calculation**: Calculates the amount of PSF tokens burned by comparing input vs output token quantities (`_getTokenQtyDiff`)
- Failed SLP/token checks return `{ success: false, details: ... }` rather than throwing

### 3. **Database Management & Renewal**
- **Entity Validation**: Uses `PinEntity` to validate and structure the pin claim data
- **Renewal Handling**: `handleRenewal()` runs when a CID already exists:
  - If claim/PoB TXIDs differ from the stored values (and are not already in `claimTxids` / `pobTxids`), archives the previous TXIDs and updates claim/PoB details and address
  - Supports re-pinning / year renewals with a fresh proof-of-burn
- **Duplicate Check**: Looks up an existing database record by CID
- **State Handling**:
  - If CID exists with `validClaim` and is awaiting download (`!dataPinned`) → returns success without reprocessing
  - If CID exists with `validClaim` and `dataPinned` → returns success without reprocessing
  - If CID doesn't exist → creates a new database record (`validClaim: null`, `dataPinned: false`)
  - If CID exists but is not yet a completed valid pin → falls through and continues processing the existing model
- Invalid claims are typically deleted from the DB (see section 6), so a corrected re-submission often creates a new record

### 4. **Asynchronous Processing Initiation**
- **Non-blocking Call**: Initiates `pinCid()` without awaiting (fire-and-forget)
- **Immediate Response**: Returns success response to the API caller
- Long-running / failed downloads are also retried later by the Timer Controller (section 5b)

### 5a. **Submit-Time Pin Processing** (via `pinCid()`)
- **Duplicate Prevention**: Checks the in-memory pin tracker; skips if the CID is already being processed
- **File Download**: Downloads the file from IPFS using the retry queue with a 5-minute timeout (`_getCidWithTimeout`)
- **Size Validation**: Verifies file size is under the configured maximum
- **Payment Validation**: Ensures sufficient PSF tokens were burned based on:
  - Write price for the claim TX block height (from `PSFFPP.getWritePriceHistory()`; current price if the TX is unconfirmed; hard-coded fallback on error)
  - File size in bytes
  - 98% tolerance threshold (`minCost = mbCost * 0.98`)
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

### 6. **Error Handling & Cleanup**
- **Failed Downloads**: Both submit-time and timer paths record failures via `_recordDownloadFailure` so impossible CIDs age out of the hot path
- **Invalid Claims**: If size/payment validation fails, removes the database record to prevent retry loops
- **Already Pinned**: Handles cases where the file is already pinned on the IPFS node
- **In-flight Dedup**: Pin tracker prevents the same CID from being downloaded multiple times concurrently

### Key Features:
- **Asynchronous Processing**: Submit returns immediately while pinning continues in the background
- **Dual Paths**: Immediate `pinCid()` on submit, plus Timer Controller retries via `_tryToGetCid`
- **Fair Retries**: Unpinned-only selection, exponential backoff, quarantine budget instead of blanket try resets
- **Economic Validation**: Payment checked against historical write price for the claim's block height (98% tolerance)
- **Renewals**: Same CID can be re-submitted with new PoB/claim TXs; prior TXIDs stored in `claimTxids` / `pobTxids`
- **Duplicate Prevention**: In-memory pin tracker plus DB state (`validClaim` / `dataPinned` / `nextRetryAt`)
- **State Management**: Pin tracker (memory), Pin model fields (`downloadTries`, `lastDownloadAttempt`, `nextRetryAt`, `fileSize`, renewal TXID arrays)

This workflow validates pin claims economically and technically before files are permanently pinned, returns immediate feedback on submit, and continues background retries until download and validation succeed or the claim is rejected.
