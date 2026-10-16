# Known Issues — Pin Recording & Retry

Two field-verified defects in the pin lifecycle, both in `src/use-cases/ipfs.js`. They were
found on the production PSFFPP pinning nodes in October 2026 by reconciling the file-service
container logs against the `ipfs-service-prod.pins` collection: files were downloading
successfully, but the database was not reflecting it.

Both defects are present in the source at the time of writing (HEAD `e3d9900`). The `src/` tree
is **identical** to the 2026-08-08 build (`a9ee341`); only the Dockerfile npm-mirror line
changed afterwards, so every deployed image since Aug 2026 contains both bugs.

| # | Symptom | Function | Trigger | Impact |
|---|---------|----------|---------|--------|
| **A** | Files download and pin locally, but the DB row never flips to `dataPinned: true`; log fills with `Error in pinCid(): AbortError` | `pinCid()` / `_tryToGetCid()` | `ipfs.routing.provide()` rejects because the DHT query is aborted | Content is held by the node but never recorded → re-downloaded every retry cycle forever |
| **B** | `Error in _recordDownloadFailure(): RangeError: Invalid time value`, repeating forever for the same CIDs; `downloadTries` frozen at `34` | `_recordDownloadFailure()` | Exponential backoff overflows the JavaScript `Date` range on the 35th failure | CID can never age out of the retry workflow; unbounded error spam |

---

## Issue A — `routing.provide()` failure aborts the pin before the DB is updated

### Location

`src/use-cases/ipfs.js`

- `pinCid()` — the submit-time path, lines **386–408**
- `_tryToGetCid()` — the timer path, lines **544–568**

Both contain a byte-identical block (line numbers from the current tree):

```js
      if (isValid) {
        try {
          // Pin the file
          await this.adapters.ipfs.ipfs.pins.add(cidClass)          // pinCid:389   _tryToGetCid:546

          // Make the file available to the DHT for improved file sharing.
          await this.adapters.ipfs.ipfs.routing.provide(cidClass)  // pinCid:392   _tryToGetCid:549
        } catch (err) {
          if (err.message.includes('Already pinned')) {
            console.log(`CID ${cid} already pinned.`)
          } else {
            throw err                                              // <-- rethrows everything else
          }
        }

        this.pinSuccess++
        console.log(`Pinned file ${cid}. ${this.pinSuccess} files successfully pinned.`)   // never reached

        pinData.dataPinned = true                                 // pinCid:404   _tryToGetCid:564
        pinData.validClaim = true
        pinData.fileSize = parseInt(fileSize)
        await pinData.save()                                      // pinCid:407   _tryToGetCid:567  <-- never reached
      }
```

### Root cause

`ipfs.routing.provide(cid)` is a libp2p Kad-DHT `ADD_PROVIDER` operation. On a node that is
not well-connected to the DHT — e.g. one behind a restrictive firewall with few peers — the
DHT query is **aborted** by libp2p and `provide()` rejects with:

```
AbortError: The operation was aborted
  code: 'ABORT_ERR', type: 'aborted'
    at raceSignal (.../race-signal/dist/src/index.js:29:19)
    at QueryManager.run (.../@libp2p/kad-dht/dist/src/query/manager.js:94:23)
    at PeerRouting.getClosestPeers (.../@libp2p/kad-dht/dist/src/peer-routing/index.js:183:26)
```

The `catch` block only tolerates errors whose message contains `'Already pinned'`. Every other
error — including `AbortError` — is **rethrown**, which unwinds the function *before*
`pinData.save()`. The consequences:

1. `pins.add(cid)` has **already resolved**, so the content *is* pinned in the local node.
2. `dataPinned` / `validClaim` / `fileSize` are never persisted.
3. The timer (`pinCids` → `_tryToGetCid`) sees the row as unpinned and downloads + provides it
   again on the next cycle → **the same abort happens again, forever**.
4. `Pinned file <cid>` is never logged, so there is no success signal in the logs at all.

Note this is **network-topology dependent**, which is why the two nodes behaved differently:
the well-connected host (asus1) recorded pins normally and never logged an `AbortError`, while
the isolated host (cb09, behind the VLAN-20 firewall) produced `0` recorded pins from `571`
successful downloads.

### Field evidence (cb09, `10.0.20.100` — VLAN-20 isolated node, 2026-10-16)

`docker logs file-service` tallies:

```
Finished download of : 571     <-- files successfully fetched
bytes big            : 571
Pinned file          : 0       <-- never once reported success
Error in pinCid      : 551     <-- aborts on the submit-time path
Error in _tryToGetCid: 20
AbortError           : 1122
```

MongoDB was unchanged by those 571 downloads: `pinned` stayed flat while `dataPinned:false`
rows accumulated. Because the CLI reports success optimistically (it sees HTTP 200 from
`POST /ipfs/pin-claim` *before* the async pin completes), this bug is invisible from the client
side — the container log and the DB are the only ground truth.

### Fix options

Either is sufficient; doing both is best.

1. **Make `provide()` best-effort** — it is an optimisation (improves sharing), not a
   prerequisite for a successful pin:

```diff
       if (isValid) {
         try {
           // Pin the file
           await this.adapters.ipfs.ipfs.pins.add(cidClass)
-
-          // Make the file available to the DHT for improved file sharing.
-          await this.adapters.ipfs.ipfs.routing.provide(cidClass)
         } catch (err) {
           if (err.message.includes('Already pinned')) {
             console.log(`CID ${cid} already pinned.`)
           } else {
             throw err
           }
         }
+
+        // Make the file available to the DHT for improved file sharing.
+        // Best-effort: a DHT provide failure must not prevent recording the pin.
+        try {
+          await this.adapters.ipfs.ipfs.routing.provide(cidClass)
+        } catch (err) {
+          console.warn(`Could not provide CID ${cid} to the DHT: ${err.message}`)
+        }
```

2. **Record the pin before providing it** (make the DB write the first thing after
   `pins.add()` resolves), so a later failure cannot lose the record.

A retry of the provide can be added separately (it is idempotent).

---

## Issue B — Backoff overflow throws `RangeError` and freezes `downloadTries` at 34

### Location

`src/use-cases/ipfs.js` — `_recordDownloadFailure()`, lines **464–492**. The fatal statement is
line **475**:

```js
  async _recordDownloadFailure (pinData = {}) {
    try {
      const nowMs = Date.now()
      const tries = (pinData.downloadTries || 0) + 1
      const backoffBase = this.config.pinRetryBackoffBaseMs || (60000 * 10)

      pinData.downloadTries = tries
      pinData.lastDownloadAttempt = nowMs
      // nextRetryAt = now + base * 2^(tries-1)  — first failure waits base, then doubles
      pinData.nextRetryAt = nowMs + backoffBase * Math.pow(2, tries - 1)          // line 474

      console.log(`Recorded download failure for CID ${pinData.cid}: tries=${tries}, nextRetryAt=${new Date(pinData.nextRetryAt).toISOString()}`)   // line 475  <-- THROWS

      if (typeof pinData.save === 'function') {
        await pinData.save()                                                       // line 478  <-- never reached
      }
      ...
```

### Root cause

With the default `pinRetryBackoffBaseMs = 600000` (10 min, `config/env/common.js`), the
exponential backoff `600000 * 2^(tries-1)` eventually exceeds the maximum time value a
JavaScript `Date` can represent (8,640,000,000,000,000 ms). `new Date(<out of range>)` yields an
`Invalid Date`, and `.toISOString()` on it throws `RangeError: Invalid time value`.

Reproduce the arithmetic directly:

```console
$ node -e 'const b=600000; for (const t of [33,34,35,36]) { const v = Date.now() + b*2**(t-1); let s; try { s = new Date(v).toISOString() } catch (e) { s = e.constructor.name+": "+e.message } console.log("tries="+t, "nextRetryAt="+v, "->", s) }'
tries=33 nextRetryAt=2578741005600000 -> +083687-01-18T10:00:00.000Z
tries=34 nextRetryAt=5155721383200000 -> +165348-04-22T04:40:00.000Z   <- valid, stored
tries=35 nextRetryAt=10309682138400000 -> RangeError: Invalid time value
tries=36 nextRetryAt=20617603648800000 -> RangeError: Invalid time value
```

**Why it is permanent.** The throw on line 475 happens **before** `pinData.save()` on line 478.
So on the 35th failure the counter is incremented in memory only and never persisted. The row
stays at `downloadTries: 34`; every subsequent attempt recomputes `tries = 35`, throws again,
and saves nothing. The CID is stuck in the retry workflow permanently, and because
`_recordDownloadFailure()` is also called from the catch blocks of `pinCid()` and
`_tryToGetCid()`, each attempt emits 3–4 `RangeError` stack traces (cascade).

Related: the timer's hot-path query clamps candidates with `downloadTries < pinRetryMaxTries`,
but **`pinCid()` (submit path) does not** — a CID that is re-submitted can be pushed toward the
overflow too. The quarantine sweep then revives the frozen rows on every cooldown cycle
(default 6 h), which is what produces the endless error spam.

### Field evidence (asus1, 2026-08-08 build, `a9ee341`)

`downloadTries` distribution in `ipfs-service-prod.pins`:

```
downloadTries distribution (tries: count):
  0: 575
  1: 38
  2: 9
  3: 4
  5: 204      <-- at pinRetryMaxTries; handled by quarantine
  6: 2
  7: 5
  14: 9
  30: 6
  34: 10      <-- FROZEN. Never advances to 35.
total: 862
unprocessed (dataPinned != true): 227
downloadTries>=34: 10
```

The frozen rows carry the tell-tale `nextRetryAt` value produced at `tries = 34`
(~year 165,348):

```
bafybeicorjdgar5wzmig35jdmypr6oowestaunu5gsnwdricf42j526r4u tries=34 nextRetryAt=5155751671986017 pinned=false
bafkreiapfy7gj7z4v6bawrppv7ooqkj6yu5rjbp5cz4zxrz3rth2r2jzke tries=34 nextRetryAt=5155751672586018 pinned=false
bafybeih4idsjazmaolqxisukc2oihte7b4rifvca3mwv5bjyilnyb5hiza tries=34 nextRetryAt=5155751671385981 pinned=false
```

And the log signature (`ipfs.js:475`, `_recordDownloadFailure` inside `_tryToGetCid`):

```
File size for bafybeie2pgzjlt3kg5e2fuazfe3wmlhzde4nmlmbbibsthw3kmab4eg6w4:  undefined
Error in _recordDownloadFailure():  RangeError: Invalid time value
    at Date.toISOString (<anonymous>)
    at IpfsUseCases._recordDownloadFailure (file:///home/safeuser/ipfs-file-pin-service/src/use-cases/ipfs.js:475:130)
    at IpfsUseCases._tryToGetCid (file:///home/safeuser/ipfs-file-pin-service/src/use-cases/ipfs.js:531:20)
```

Counts on that node: **15,912** `RangeError: Invalid time value` lines, **10** CIDs frozen at
`downloadTries = 34`.

### Fix options

1. **Clamp the backoff** so the computed timestamp can never leave the valid `Date` range:

```diff
-      pinData.nextRetryAt = nowMs + backoffBase * Math.pow(2, tries - 1)
+      const MAX_BACKOFF_MS = 30 * 24 * 60 * 60 * 1000 // cap at 30 days
+      const backoffMs = Math.min(backoffBase * Math.pow(2, Math.min(tries - 1, 20)), MAX_BACKOFF_MS)
+      pinData.nextRetryAt = nowMs + backoffMs
```

2. **Make the accounting robust regardless of the value** — never let a log line abort a DB
   write. Persist first, and guard the formatting:

```diff
-      console.log(`Recorded download failure for CID ${pinData.cid}: tries=${tries}, nextRetryAt=${new Date(pinData.nextRetryAt).toISOString()}`)
-
       if (typeof pinData.save === 'function') {
         await pinData.save()
       }
+      console.log(`Recorded download failure for CID ${pinData.cid}: tries=${tries}, nextRetryAt=${new Date(pinData.nextRetryAt).toISOString()}`)
```

3. Optionally clamp `tries` itself (e.g. `Math.min(tries, 34)`) so the counter cannot run away.

**Cleaning up existing damage.** Rows already frozen at `downloadTries: 34` will not recover on
their own. After deploying a fix, reset them so the workflow can move again (they will then
retry, and either succeed or be quarantined properly):

```js
// mongosh / mongo shell on the pin node
db.pins.updateMany(
  { dataPinned: { $ne: true }, downloadTries: { $gte: 34 } },
  { $set: { downloadTries: 0, nextRetryAt: 0, lastDownloadAttempt: null } }
)
```

---

## Reproducing the issues

### Why the existing test suite misses Issue A

`test/unit/mocks/adapters/index.js` mocks the IPFS adapter with a `routing.provide` that never
fails:

```js
      routing: {
        provide: async () => {}
      },
```

So the happy-path test `#_tryToGetCid › should pin a valid claim` (which stubs `pins.add` but
not `provide`) always passes. No test exercises a rejecting `provide()`.

### A — Unit test for Issue A

Add to `test/unit/use-cases/ipfs.use-case.unit.js` inside `describe('#pinCid', ...)`:

```js
    it('REPRO A: must record the pin even if routing.provide() aborts', async () => {
      const cid = 'bafybeidmxb6au63p6t7wxglks3t6rxgt6t26f3gx26ezamenznkjdnwqta'

      // Deterministic download + validation
      sandbox.stub(uut.retryQueue, 'addToQueue').callsFake(async (fn, args) => fn(args))
      sandbox.stub(uut, '_getCidWithTimeout').resolves(1000)
      sandbox.stub(uut, 'validateSizeAndPayment').resolves(true)
      sandbox.stub(uut.adapters.ipfs.ipfs.pins, 'add').resolves()

      // Simulate the production DHT failure
      sandbox.stub(uut.adapters.ipfs.ipfs.routing, 'provide').rejects(
        Object.assign(new Error('The operation was aborted'), { code: 'ABORT_ERR', type: 'aborted' })
      )

      let saved = false
      const pin = {
        cid,
        tokensBurned: 1,
        filename: 'test.png',
        claimTxDetails: {},
        save: async () => { saved = true }
      }

      let threw = false
      try {
        await uut.pinCid(pin)
      } catch (err) {
        threw = true
        assert.equal(err.code, 'ABORT_ERR')
      }

      // On the buggy code: threw === true and saved === false.
      // After the fix: the pin is recorded and provide() failure is swallowed.
      assert.isFalse(threw, 'provide() failure should not propagate out of pinCid()')
      assert.isTrue(saved, 'pinData.save() must run even when provide() fails')
      assert.isTrue(pin.dataPinned)
    })
```

Run it:

```bash
npm run test:unit -- -g 'REPRO A'
```

Expected on the current code: **fails** at `assert.isFalse(threw)` (the `AbortError` escapes and
`save()` never runs).

### B — Unit test for Issue B

```js
  describe('#_recordDownloadFailure overflow', () => {
    it('REPRO B: 35th failure must not throw, and must still be persisted', async () => {
      const pin = {
        cid: 'bafybeicorjdgar5wzmig35jdmypr6oowestaunu5gsnwdricf42j526r4u',
        downloadTries: 34, // one more failure overflows 600000 * 2^33
        save: async () => {}
      }

      let saved = false
      pin.save = async () => { saved = true }

      await uut._recordDownloadFailure(pin)   // on current code this throws RangeError

      assert.isTrue(saved, 'the failure must still be persisted')
      assert.isFinite(pin.nextRetryAt)
      assert.isTrue(Number.isFinite(new Date(pin.nextRetryAt).getTime()))
      assert.equal(pin.downloadTries, 35)
    })
  })
```

Equivalent one-liner (no test harness), showing the raw arithmetic:

```bash
node -e 'const b=600000; for (const t of [34,35]) { const v=Date.now()+b*2**(t-1); try { console.log(t, v, new Date(v).toISOString()) } catch(e){ console.log(t, v, e.constructor.name+": "+e.message) } }'
```

### C — Live reproduction on a pin node

Read-only inspection (no credentials are needed on the box itself; use whatever SSH path the
host requires):

```bash
# 1. Success-vs-recorded mismatch (Issue A signature)
docker logs file-service 2>&1 | grep -c 'Finished download of'
docker logs file-service 2>&1 | grep -c 'Pinned file '
docker logs file-service 2>&1 | grep -c 'Error in pinCid'
docker logs file-service 2>&1 | grep -c 'AbortError'

# 2. First AbortError with stack (Issue A)
docker logs file-service 2>&1 | grep -A14 -m1 'AbortError'

# 3. Frozen counters (Issue B)
docker exec -i mongo-file-service mongo ipfs-service-prod --quiet --eval '
  print("frozen at 34: " + db.pins.countDocuments({ downloadTries: 34, dataPinned: { $ne: true } }));
  db.pins.find({ downloadTries: { $gte: 30 } }, { cid: 1, downloadTries: 1, nextRetryAt: 1, dataPinned: 1 }).limit(5).forEach(d => printjson(d));
'

# 4. RangeError signature + count (Issue B)
docker logs file-service 2>&1 | grep -c 'RangeError'
docker logs file-service 2>&1 | grep -B2 -m1 'RangeError: Invalid time value'
```

To force a live occurrence of Issue A: pick a CID whose content is present but not yet recorded
(the `dataPinned:false` rows), call the reprocess endpoint, then watch for `Finished download`
followed by `Error in pinCid(): AbortError` and **no** change to `dataPinned`. Node network
isolation determines whether `provide()` aborts — the more firewall-restricted the host, the
more reliably it reproduces.

To force a live occurrence of Issue B: set a row to the last valid value and let the timer (or a
manual reprocess) take it one step further:

```js
db.pins.updateOne({ cid: '<a-never-downloadable-cid>' }, { $set: { downloadTries: 34, dataPinned: false, nextRetryAt: 0 } })
```

---

## Current fleet state (2026-10-16)

| Host | Reachability | Image built | `src/` commit | `Finished download` | `Pinned file` | AbortError | RangeError | Stuck rows |
|------|--------------|-------------|---------------|--------------------:|--------------:|-----------:|-----------:|------------|
| asus1 (`192.168.0.140`) | well-connected | 2026-08-08 | `a9ee341` | 146 | 146 | 0 | **15,912** | 10 frozen at `downloadTries:34` (227 unprocessed) |
| cb09 (`10.0.20.100`) | VLAN-20 isolated | 2026-10-15 | `a9ee341`-equivalent | 571 | **0** | **1,122** | 0 | 628 unprocessed; 523 downloaded-but-unrecorded |

The two boxes are mirrors of each other: the isolated node shows Issue A (provide abort, nothing
recorded); the well-connected node shows Issue B (counter overflow). Both share the same source,
so both fixes are needed on both nodes.

## Files

| Piece | Location |
| --- | --- |
| Submit-time pin + provide | `src/use-cases/ipfs.js` `pinCid()` L332–441 |
| Timer-time pin + provide | `src/use-cases/ipfs.js` `_tryToGetCid()` L499–610 |
| Failure accounting (overflow) | `src/use-cases/ipfs.js` `_recordDownloadFailure()` L464–492 |
| Retry tunables | `config/env/common.js` `pinRetry*` |
| Pin document fields | `src/adapters/localdb/models/pins.js` `downloadTries`, `lastDownloadAttempt`, `nextRetryAt` |
| Retry loop overview | [periodic-pin-retry.md](./periodic-pin-retry.md) |
| Claim lifecycle | [pin-claim-processing.md](./pin-claim-processing.md) |
| Test mock that hides Issue A | `test/unit/mocks/adapters/index.js` (`routing.provide`) |
