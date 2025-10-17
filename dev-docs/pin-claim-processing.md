# Pin Claim Processing

Below is a high-level description of how a new Pin Claim is processed.

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
- **Token Calculation**: Calculates the amount of PSF tokens burned by comparing input vs output token quantities

### 3. **Database Management**
- **Entity Validation**: Uses `PinEntity` to validate and structure the pin claim data
- **Duplicate Check**: Checks if a database record already exists for this CID
- **State Handling**: 
  - If CID exists and is already valid/pinned → returns success without processing
  - If CID doesn't exist → creates new database record
  - If CID exists but invalid → allows re-submission (for renewal or correction)

### 4. **Asynchronous Processing Initiation**
- **Non-blocking Call**: Initiates `pinCid()` function without awaiting (fire-and-forget)
- **Immediate Response**: Returns success response to the API caller

### 5. **Background Pin Processing** (via `pinCid()`)
- **Duplicate Prevention**: Checks if the CID is already being processed
- **File Download**: Downloads the file from IPFS using retry queue with 5-minute timeout
- **Size Validation**: Verifies file size is under the configured maximum
- **Payment Validation**: Ensures sufficient PSF tokens were burned based on:
  - Current write price per MB
  - File size in bytes
  - 98% tolerance threshold
- **IPFS Pinning**: If validation passes, pins the file to the local IPFS node
- **Database Update**: Updates the database record with final status (`dataPinned: true`, `validClaim: true`, `fileSize`)

### 6. **Error Handling & Cleanup**
- **Failed Downloads**: If download fails, increments retry counter
- **Invalid Claims**: If validation fails, removes the database record to prevent retry loops
- **Already Pinned**: Handles cases where file is already pinned

### Key Features:
- **Asynchronous Processing**: The main function returns immediately while processing happens in background
- **Retry Mechanism**: Uses a retry queue for robust file downloads
- **Economic Validation**: Ensures proper payment based on file size and current pricing
- **Duplicate Prevention**: Prevents multiple simultaneous processing of the same CID
- **State Management**: Tracks processing state in both memory (pin tracker) and database

This workflow ensures that pin claims are validated economically and technically before files are permanently pinned to the IPFS network, while providing immediate feedback to users and handling edge cases gracefully.