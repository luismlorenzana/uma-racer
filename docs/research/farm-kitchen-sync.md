# T119 — dormant Farm save/sync verification

2026-10-09. Implemented on `feat/t119-farm-kitchen-save-sync`, based on main `3ea02b2`, preserving D305's
Puzzle history fix. Rules/record/read-set details live in the
[standing contract](../technical/farm-kitchen-implementation.md#3-records-and-ownership), not the removed spec.
This is **not a Farm release or an owner migration**. Both application capabilities remain false; no UI,
new production host, cutover execution, private publication, infrastructure or account read/write is included.

## Checks

- `pnpm lint`: all six packages pass.
- `pnpm test --concurrency=1`: all 1,611 tests pass, with the existing assertions unchanged: domain 788,
  web 581, API 101, race 61, data 44 and assets 36. An earlier concurrent local run tripped the unchanged
  race precompute wall-time assertion under six-package contention (~528 ms versus 250 ms); the race suite
  passes in isolation and in the serial full run. A final default `pnpm test` also passes with five validated
  package caches and the web suite freshly run. CI's existing timing handling is unchanged.
- `pnpm build`: production web/API builds and PWA pass. Startup entry 154.35 KB gzip (limit 180 KB); the catalogue,
  coordinator and route dependencies remain lazy. No dependency was added.
- `node apps/api/scripts/sync-farm-adapter.mjs --check`: 15 production modules match pure source exactly.
- `node apps/api/scripts/sync-puzzle-adapter.mjs --check`: 83 modules match; additive shared save validation
  extends the dependency closure without repurposing legacy Farm helpers or changing preservation content.
- Both new Farm sims pass with T118's complete-report hashes unchanged:
  production `99fc49c3909c9ccb504789c17c0f3979e0b413a95d128c9473098c7f3b7fb144`;
  stats `965ab0db062d575ffcc864a3e2d90887691f7cb5d3fd249a4831610276f62c13`.
- Legacy Farm progression passes. Career coverage/win-rate regression passes against the existing gitignored
  reference packs (aggregate output only; no account data). Puzzle combat/economy/campaign, Puzzle preservation
  and RPG campaign sims pass their existing envelopes.
- `constellation-balance.ts --ladder-only` reproduces the already documented tier 1 hard stamina check failure,
  with 345/498/738/869/1093/1200 ladder stats; remaining tiers pass the hard ladder. This predates T118/T119 and
  remains untouched. See the [baseline note](rpg-inspiration-phone-proof.md#commands-and-known-baseline-issue).

Sims use installed `tsx` through `@racer/data-pipeline`, avoiding a new download. The career harness needs its
explicit existing `--content=<gitignored pack directory>` in an isolated worktree; the default relative directory
is absent there. No pack import or publication was performed.

## Synthetic transaction and restore evidence

The fixtures contain invented outfits/data only. Domain and API compare complete results, not reward counts.
Strict fake Firestore checks all reads precede writes, serializes competing devices and faults commits; local-file
replacement failures leave the save unchanged. AuthGuard still protects `/api/sync`.

IndexedDB fault injection visits every enqueue, claim-acknowledgement and map-purchase write, including shared
stock, station, worker, all-block milestones, terminal/purchase evidence, receipt and pending/outbox markers.
No injected failure leaves a partial debit, paid map, EXP or orphaned marker. Same-ID retries return exact receipts;
distinct-ID same-job/node retries return the first target result without spending, XP or new-preset activation.
An already-over-threshold worker opens all three blocks from a checked old-recipe claim.

Canonical rows stay unchanged when intent is enqueued, including output stock. Twenty offline moves can use
direct/transitive dependencies without widening each command's sixteen dependency slots. Rejected ancestors
block descendants; their intent remains recoverable. The owner chose existing trusted-device timing: a delayed
offline Start keeps its original deadline and a later Claim retains its already-waited readiness, while server
commit metadata is timestamped separately. This is deliberately not modified-client clock protection.

Dexie 31→32 proofs preserve every prior table's rows, histories, journals and outbox while adding empty stores.
GET/JSON/bootstrap round trips retain v3 records and logs. Unknown future schemas keep recovery evidence rather
than resetting it. Delayed snapshots/acknowledgements preserve newer Farm stock and unrelated Uma edits, including
when Puzzle's coordinator is present. Legacy harvest evidence never becomes new-generation Farm EXP.
Preparing/resetting guards reject new retired writes even when the client omits protocol opt-in; byte-identical
historic projections acknowledge their original version without rewriting them.

## Transport witnesses and boundaries

See [technical §5](../technical/farm-kitchen-implementation.md#5-api-mirror-protection-and-transport) for exact
ceilings and measurements. Four disjoint ten-input banquets use 101 references; thirty valid ready stations split
16+14, with at most 106 references/14,078 request bytes/781,378 response bytes. The 30-job projection is 18,373 bytes;
largest generated Start/Claim receipts are 47,742/40,656 bytes. Four preset builds at all 14 units produce a valid
290,445-byte Uma read, requiring the shared-record 900 KiB rather than the Farm projection 128 KiB ceiling.

Exact 200-reference/256 KiB/16-group boundaries pass; 201 references, oversized request bytes and 17 groups reject.
Near-900 KiB synthetic Uma references prove a full response too large to adopt rejects before any commit.
No semantic command is split, no sync limits are raised, and all-worker authority reads are absent.

## Remaining acceptance

T120 owns the protected archive/reset rehearsal; T121 owns host/views/retry UI; T122/T123 own mobile screens and
Extra/race integration; T124 alone enables the complete replacement. There is no new screen to screenshot here.
Owner iPhone, real offline jobs/second-device use and live generation checks remain for the integrated release;
these synthetic checks do not claim device or production gameplay sign-off.
