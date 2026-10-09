# T121 — Real Farm host, local-first runtime and recovery

**M031 · after T120 merges · release off.** Read AGENTS/README/index, [M031](M031-farm-kitchen-rework.md),
[design §§3–5,12,15–16](../design/farm-kitchen-rework.md) and the complete
[technical contract](../technical/farm-kitchen-implementation.md). Inspect the actual T119/T120 protocol,
legacy FarmHost/runtime/store/persistence and Puzzle real-host prediction/acknowledgement tests.

## Goal

Implement `FarmKitchenHost` on actual Dexie/canonical sync, not a production test double. Every later screen
must call this one port. Offline operations retain exact inputs, job IDs/deadlines and dependencies; uncertain
replies retry unchanged. Pending stock/builds never silently become permanent Items or racing stats.

Capabilities stay false. Existing normal-account Farm/Extra flows keep their legacy host; isolated DEV tests
inject an invented active generation through the real adapter, never `GameRuntime.start` on the owner database.

## Port and runtime contract

Implement under `apps/web/src/game/farm/kitchen/`. Public methods: `read`, `assign`, `remove`, `start`, `claim`,
`collectAll`, `spendEnergy`, `grantEnergy`, `buyNode`, `setActive`, `retry`, `prepareUpgrade`, `exportRecovery`.
T119 typed commands/receipts are authoritative. Mutation input captures target, expected view revision and
one persisted intent ID; output includes operation ID, durable pending/applied/duplicate/rejected/blocked state,
actual receipt and latest view. All domain logic stays pure; I/O/time injection lives in the adapter.

- `GameRuntime` lazily selects the new host only when both capability and active canonical generation agree.
  A preparing generation offers upgrade/recovery, not a temporary empty Farm or fake old host. An active
  generation with incompatible/disabled client code is maintenance/read-only recovery, not a v2 downgrade.
- Read/route/guide/query creation is write-free. Acquisition's Farm worker default is Lv 1/0 without enrollment;
  no server reset, grant or auto-recipe just because an Uma is viewed.
- Keep canonical rows and pending overlays separate. The same-device projected inventory includes local
  reservations/outputs with a pending label; the global Item view retains the canonical nonnegative balance.
  A dependent craft can consume its own queued ancestor's output only through explicit topological dependencies.
- In one Dexie transaction re-read required rows/overlay, validate operation/version, persist command + prediction
  + outbox, then publish Zustand selectors. No React-only promise memory, whole-save snapshot writes or effects
  that recreate an operation on render. Double tap/Retry finds the same durable intent.
- Sync serializes Farm/Puzzle/ordinary economic lanes fairly. Partition queued Farm operations by 16/256 KiB/200
  and exact reference union, not output count. Accepted receipts adopt all canonical changes/evidence and clear
  the pending marker atomically. A later reply cannot roll back a newer version/related operation.
- Missing reply/network leaves Pending. Rejected ancestor blocks descendants and reconstructs the overlay from
  acknowledged state plus valid intent; preserve blocked/rejected payloads for explicit Retry/Discard recovery.
  Discard removes an unaccepted intent only after establishing it was not canonical, never a live job. Fresh
  spending payloads require fresh confirmation; immutable lost-ack retries keep IDs/bytes.
- Claims derive reward from stored jobs. `collectAll` snapshots ready job IDs and submits individual claims,
  reusing IDs on Retry; returns named succeeded/pending/failed totals. No automatic restart or one huge receipt.
- Expose separate `levelsCrossed`, shared recipe milestones and `firstPrepared` from accepted receipts, not
  guesses from current stock. Reopening historical receipt shows no repeated celebration/reward.
- Energy confirms one same running job, one stock debit and wasted minutes if applicable. Grant 50 respects
  the existing owner debug boundary and never consumes them. Keep legacy time-shift callable only on v2.
- Same clock/focus/visibility projection governs readiness; no interval network/DB writes. Backgrounding
  commits/reloads durable intent; foregrounding reads before enabling an action. Stop/unmount cleans subscriptions.
- No-storage/unavailable-DB mode exposes honest recovery/read-only or isolated demo; do not simulate a free
  production craft that loses inventory on reload. A corrupt/future row is visible, never an empty success.

## Store/joins and existing consumers

Add narrow Zustand selectors/read subscriptions for Farm control, stations, worker rows, recipe milestones,
global items and selected Extra map. Bound transaction authority to target worker/build/input rows; a UI roster
may read owned outfits, but Start must not read every outfit/card/scenario/checkpoint. Definitions/art are lazy
display joins through existing content APIs. Missing owned Uma art has a named silhouette, not a blocked Farm.

Extend new-row snapshot adoption, Settings aggregate diagnostics and recovery export without exposing account
rows/private food-source IDs in tool logs. Do not invoke owner Inspiration/Puzzle migrations from this adapter.
Keep profile/Training/race integrations explicit for T123; the host can buy/set-active now, but pending Farm
configuration contributes only to previews until canonical acknowledgement.

## Required real-storage tests

Use fake IndexedDB and a synthetic repository response adapter, not only a host mock:

1. Assign/start raw→refresh→ready→claim; worker remains assigned, same job ID/inputs/deadline, 12 EXP and 6 Items once.
2. Two-stage offline raw→workshop→kitchen chain with persisted dependencies; refresh/resume and later batch
   acknowledgement reproduce outputs. A middle rejection blocks all descendants without free canonical stock.
3. Missing Start/Claim/Energy/Buy replies, Retry after reload, duplicate same/different payload, simultaneous stale
   screens and two devices sharing last ingredients/one node. Only one canonical award/spend is possible.
4. Fault after each pending/canonical/evidence/outbox write; store publishes nothing partial. Observer and late
   response tests preserve an unrelated newer deck/RPG/Puzzle edit, no whole-account overwrite.
5. All 30 ready stations Collect all, only some succeed/acknowledge; failed names remain actionable and Retry pays
   no succeeded job twice. Repartition at bytes/docs/group limits; no queue starvation or increased constants.
6. Lv 5→6/Lv 8→9 shared milestones, new Lv 1 specialist, later same-block input, partial batch and wrong-block refusal.
7. Backward clock, ready wait, foreground refresh, unmount/reinstall/second-device active adoption, future schema,
   offline deferred cutover and archive export failure. No new attempt/time/reroll on navigation.
8. Capability-off normal boot remains a write-free old Farm; active/preparing generation cannot fall into v2.
   `getFarmKitchenHost` unavailable before readiness, real adapter after readiness, no installed test double.

## Verification / completion

Lint/test/build, both new Farm sims and affected old Farm/Puzzle/RPG sync regressions pass; startup ≤ 180 KB gzip,
runtime factory/catalogue lazy. Document actual host signatures/error/recovery semantics and tests in technical §§4–7.
Append next-free decision, update M031/index and remove this spec (D104). Complete/merge before T122.

No production screen entry, release flags/reset, owner account, infra/content publication, debt/economy changes
or race-engine work. This task must not hand the UI a port that only returns invented success summaries.
