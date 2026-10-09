# Farm production/cooking — implementation contract

**T118 pure layer and T119 dormant persistence implemented · M031 · 2026-10-09.** Read
[the design](../design/farm-kitchen-rework.md), [AGENTS.md](../../AGENTS.md) and the current task first.
This standing contract must survive task deletion under D104. It specifies the new path; existing
[Farm](../design/farm.md) stays live until T124. Do not describe a capability-off merge as a playable release.

## 1. Fixed boundaries and current integration points

- Five districts × six immediately available stations; persistent outfit workers, independent Farm EXP,
  no account Farm Level/expansion/expertise. No ticket, combat seed or `MinigameHost` journal.
- Original food definitions and SVGs are code-owned. Reuse verified private Uma portraits/chibis, but no new
  external asset import, pack publication or private rows are required. All test saves/outfits/cards are invented.
- Global `items`/`itemLedger` remain the only inventory. RPG/Inspiration/Puzzle debts and rewards are untouched.
- Current domain: `packages/domain/src/farm/`, `extra-stats.ts`, `constellation.ts`, `save.ts`, `scenarios.ts`.
- Current web: `game/farm/host.ts`, `game/farm/view.ts`, `game/farm/useFarmView.ts`, `game/extra-stats.ts`,
  `game/db.ts`, `game/persistence.ts`, `game/runtime.ts`, `game/sync.ts`, `screens/FarmScreen.tsx`,
  `screens/ExtraStatsScreen.tsx`, Home, the global Item inventory and scenario/preset/race projections.
- Current API: `save.types.ts`, `save.repository.ts`, local/Firestore repositories, `puzzle-sync.ts` and the
  standalone `puzzle-domain/` mirror. Reuse the semantic-sync transaction pattern, not Puzzle's game rules.
- Read latest main before each task. Uma/profile save 16 is unchanged; T119 adds Dexie 32. **Do not reserve a
  guessed next global save/Dexie version now.** Independent Farm records below avoid a new Uma shape; additive
  Dexie migrations use the next actual free version when written and never rerun an RPG/Puzzle migration.

New modules live under `packages/domain/src/farm/kitchen/`, web `game/farm/kitchen/` and
`screens/farm/`. Preserve the legacy Farm modules until their last live caller/evidence parser is retired.
Add an explicit lazy domain export; do not pull the 1,169-definition catalogue into startup through a barrel.

## 2. Identity, catalogue and rules

Use the registered scenario order, with append-only stable indices. A scenario `s` belongs to
`b = 1 + floor((s − 1)/5)`. Its optional raw variants open at personal Lv`1 + 10 × (s − 1)`.
Processing/cooking require personal Lv`1 + 50 × (b − 1)` and the block's shared milestone. First worker
Lv`6 + 50 × (b − 1)` opens processing; Lv`9 + 50 × (b − 1)` opens cooking, permanently. Lower-level same-block
cooks may use later variants another worker produced. No prerequisite on racing scenario completion for gathering.
A checked Claim evaluates its resulting worker level against every registered block's milestones, regardless
of the claimed recipe's block. Read/update the bounded recipe-block set (three today), with generation-scoped
evidence; an over-level worker qualifies without having to cross the threshold again. No all-worker scan.

| Identity | Contract |
|---|---|
| Station | `garden-1..6`, `orchard-1..6`, `barn-1..6`, `workshop-1..6`, `kitchen-1..6` |
| Raw item | `farm:raw:<scenarioId>:<family>:<stat>`; seven families × five stats × registered scenarios |
| Processed item | `farm:processed:<scenarioId>:<family>:<stat>`; nine families × five stats × scenarios |
| Meal/recipe | `farm:meal:b<block>:<signature>`; five pure, ten unordered pairs, one `sun` |
| Energy | `farm:energy` |
| Worker | Owned outfit's template ID, not character ID |
| Job | `farm-job:<generation>:<stationId>:<attempt>`; monotonically increasing attempt per station |
| Purchase | `farm-buy:<generation>:<outfitId>:b<block>:<nodeId>`; one immutable spend identity |
| Item movement | Bounded deterministic hash of operation ID + item ID + debit/credit role; no random IDs |

Identifiers/objects are parsed with exact key sets, known registries, safe integers and explicit byte/array bounds.
Operational IDs use a device identity plus a persisted monotonic sequence, never `Math.random` or an unreserved
wall-clock-only ID. Hashing has one canonical key/array order; same ID/different payload is an error.

T118/D304 pins the baseline: 24 EXP/level, 12 EXP/completion, six-hour duration, six raw units, processing six→six,
kitchen quantity 1–4, thirty-minute Energy and debug grant fifty. All job kinds give one EXP award regardless
of output quantity. Raw is free; processing/cooking spend concrete inputs at Start, not Claim. Every kitchen
input slot chooses one legal item, with quantity multiplied by batch size; coalesce identical IDs before debit.
There are at most ten ingredient slots. No mixed-block substitutions, split-stack slot allocations, cancel,
automatic repeats, spoilage or quality/yield rolls. Freeze rules version, recipe, quantity and exact inputs/output.

Extra map: stable ordered 65 IDs (50 pure, ten bridges, five Suns). Pure 20, dual 10+10, Sun 4 × 5; one matching
block meal buys one arbitrary node. Capacity is `min(65, 18 + 2 × (s − 1))` for defensive rendering, but validation
must **refuse an unreviewed registry extension whose formula exceeds 65**, rather than silently ship a clamped
new scenario. Current fourteen indices are valid. Four distance presets have independent active selections.

### T118 implemented pure layer (D304)

`@racer/domain/farm/kitchen` is the sole explicit entry; root/domain and legacy Farm barrels do not re-export it.
`catalogue.ts` materializes all1,169 original item definitions/1,168 recipes from the registered scenario order
and fourteen authored flavour rows. Appended scenarios need an explicit new row; unreviewed scenario25 capacity
fails rather than silently clamping. `progression.ts` derives lifetime levels/remainders and block/raw gates.

Concrete pure schemas: Farm3; worker1; recipe-block1; Extra-block1; frozen job rules1; node template1. These
are **not** a global Uma/save/Dexie bump. T119 wraps them in entity versions/update timestamps and economic
operations; its transport/storage implementation is described below. No new record is installed in a real account yet.

- `createFarmKitchen` creates sparse ordered assignments; `farmStation` projects any of the thirty spots.
  `assignFarmWorker`/`removeFarmWorker` check ownership and Busy/Ready locks, retaining per-station attempts.
- `startFarmJob` returns frozen job, exact debits, new Farm/inventory; no output/EXP. `claimFarmJob` returns
  new Farm, worker, inventory, all block recipe rows and a receipt with output/EXP/levels/milestones/first meals.
  Cookbook counts are **meals produced**, not cooking job count. Claims preserve assignment/attempt; applying
  the returned state leaves no job to claim again. Durable job/operation receipt idempotency belongs to T119.
- `farmJobRemaining` takes an explicit safe integer clock; backward time extends waiting, not a new start.
  `spendFarmEnergy` returns one deadline adjustment, exact item debit and used/wasted milliseconds. It never
  clears the job, changes another station or awards EXP. No cancel/automatic repeat/grant is installed.
- `resolveFarmInputs` validates known item IDs/stat/stage/block/exact slots and produces ASCII-ID-sorted debit
  entries. One concrete stack per slot; processing binds its source variant, cooking accepts any legal same-block
  item. Strict parsers re-derive frozen costs/output/deadline and reject future/corrupt shapes and overflow.
- `FARM_EXTRA_NODES` owns65 stable IDs/names/positions. `buyFarmExtraNode` returns stable target identity,
  actual node and item/map effects; an existing purchase never spends again or opportunistically activates.
  `setFarmActiveNodes` changes only one real owned scenario/distance list. `parseFarmExtraBlock` validates and
  canonicalizes bought/active IDs in template order; newly created maps/units have no active nodes.
- `farmExtraVector` sums unique known IDs. `previewFarmStats(uncappedPostGrowth, farm, caps)` returns before-cap,
  capped/base-capped, marginal gain and Farm-only waste. It does not call or mutate shipped `deriveStats`.

[Balance evidence](../research/farm-kitchen-balance.md) carries policies, hashes, material conservation and
remaining limitations; new domain/source tests and `domain.test.ts` pin the same contract. No React/I/O/RNG,
private rows, dependency, API/DB/UI/release-flag/infrastructure or live-stat change is part of this task.

## 3. Records and ownership

Use independently versioned synced rows. Normal projection creation is lazy; missing canonical rows are empty
views, not permission to write on route opening. Only accepted semantic commands/cutover create them.

| Collection / ID | Implemented data and authority (dormant T119) |
|---|---|
| `farm/main` | Schema 3, generation, ordered/sparse thirty station assignments, attempt floors and current frozen jobs; no lifetime worker/history arrays |
| `farmWorkers/<outfitId>` | Schema 1, generation, outfit ID and lifetime Farm EXP; level/remainder derived, ownership checked |
| `farmRecipes/b<block>` | Schema 1, generation, processing/cooking milestone evidence, sixteen first-preparation/meal-count records |
| `farmExtra/<outfitId>:b<block>` | Schema 1, generation, template/rules version, up to 65 bought IDs and active IDs keyed by registered scenario and four distances |
| `farmOperations/<operationId>` | Immutable accepted command/receipt; changes and economic evidence are stored once, never an aggregate history field; terminal/purchase guards use `ftg:<type>:<hash>` in the same collection |
| `farmCutover/main` | Schema1: generation, phase `preparing|resetting|active`, 64-hex `cohortDigest`/`archiveDigest`, `outfitCount`, `pageCount`, `nextOutfitIndex`, `createdAt`, nullable `activatedAt`; shapes only, T120 owns execution |
| `farmCutoverPages/<generation>:<index or legacy>` | Schema1 union: cohort `{index,outfits:[{outfitId,sourceVersion,tiers}]}` (sorted, ≤32/page, ≤128 pages); legacy `{stations:[{stationId,outfitId,attempt,cycle}]}` (≤18 original raw slots/cycles); both include generation/type |
| `items/<itemId>` | Existing nonnegative global stacks; Farm-owned IDs require Farm commands |
| `itemLedger/<movementId>` | Existing ledger plus an explicit Farm-command source/version; legacy reason unions remain parsable |

Device-only tables: `farmPending` (immutable commands, dependencies, projected changes/status), `farmRecovery`
(unfinished operation recovery; T120 adds the private whole-account archive), and `farmPreferences` (local
sequence/order and future guide preferences).
Do not reuse or overwrite Puzzle preservation backups, RPG fights or `minigameRuns`.

Dexie32 adds these nine stores without an `upgrade` callback: workers, recipes, Extra, cutover, pages,
operations, pending, recovery and preferences. Existing v31 rows, journals and outbox remain byte-identical.
Synced projections use `{id,data,version,updatedAt,deleted}` locally; tombstones retain their metadata.
Pending rows hold `{id,order,operation,prediction,status,reason,queuedAt}` with `pending|rejected|blocked` status;
recovery rows retain `{id,reason,data,createdAt}`. Preferences are device-only `{id,value}`.

All rows include the normal entity version and update timestamp. Worker EXP, job attempts, recipe quantities and
cookbook totals are safe integers. Arrays bound to thirty stations, 65 nodes, four presets and registered block
scenarios. Worker rows are separate so a large owned roster does not enlarge every command. A current job holds
at most ten concrete input entries and one output definition; farm/main holds no claimed jobs or ledger history.
The ceilings and generated stress witnesses below are enforced independently of roster size.

**No Uma/profile schema bump is required for this choice.** The new map owns bought/active state separately.
After cutover, every old `extraStatsUnlocked` count and preset `activeExtraStats` array in every scenario unit is
zero/empty and remains retired. Existing unrelated Uma writers must retain that empty legacy shape. A runtime
adapter joins the new map into the correct scenario/distance derivation; do not stuff 65 IDs into the old parser.
Pending views and schema 3 do not pass through legacy `reconcileFarmEvidence` as if they were schema 2.

## 4. Semantic operation contract

Optional `/api/sync` fields: `farmProtocolVersion: 1`, `farmOperations: FarmOperationV1[]`; response accounts
for every submitted operation exactly once. Pure domain and the standalone API mirror use the same resolver.
No extra unauthenticated endpoint, infrastructure setting or domain I/O is introduced.

Envelope fields: `schemaVersion:1`, `operationId`, `generation`, canonical `payloadDigest`, ordered dependency
IDs, exact expected entity versions, validated integer `now` and a discriminated payload. The trusted client
clock determines readiness; the API verifies frozen deadline arithmetic, not a new anti-cheat clock policy.
The owner explicitly chose to retain today's Farm behaviour on2026-10-09: `PersistentFarmHost` already uses
device time for planting/harvesting/acceleration. Start, Claim, Energy and legacy Claim therefore use the frozen
operation `now`; server `now` timestamps entity/movement/receipt acknowledgement only. A delayed offline upload
does not restart a job or invalidate an already-waited deadline. This personal-game trust model is not protection
against modified client clocks; neither the new host nor a live account generation is enabled by T119.

| Payload | Reads / atomic effects |
|---|---|
| `assign` / `remove` | Farm plus target ownership; move one idle outfit after checking all thirty assignments; no busy/ready displacement |
| `start` | Farm, worker, owned Uma, block recipe row, up to 10 input stacks; increment attempt, spend exact inputs, freeze job, write debit evidence |
| `claim` | Same station/job, worker, all registered recipe-block rows, output stack and prior receipt; ready check, clear job but retain assignment, add output/12 EXP, milestone/cookbook evidence |
| `energy` | Same running job, Energy stack; debit 1, increase cumulative acceleration and clamp ready time at the operation's now |
| `buy-node` | Target owned outfit + real scenario unit, selected block map, matching meal stack, stable purchase identity; debit 1/buy once, optional explicit selected-preset activation only if capacity allows |
| `set-active` | Target outfit/unit/block map and purchased IDs; update only requested scenario/distance, zero Item movements |
| `grant-energy` | Existing owner-only debug boundary, Energy stack; credit 50 once per deliberate press |
| `claim-legacy` | Frozen legacy job + original cycle evidence/stack; one old output, no new Farm EXP, cookbook or recipe milestones |

Every command includes the control generation/phase guard. A complete identical receipt is returned **before**
current revision checks; same operation ID with altered bytes rejects. Claim also has a job-key uniqueness guard;
purchase a target-key uniqueness guard, so two distinct command IDs cannot pay the same job/node twice.
Receipts name actual output, input costs, worker EXP/levels crossed, recipe milestones, first preparations,
node ID/name and cap-aware selected-preset changes. The client cannot supply output quantity/EXP/stat awards.
For an already-bought target under a fresh ID, return the existing purchase identity/result with no new spend
or opportunistic activation; another node is never chosen automatically.

Local atomic commit writes the immutable command, predicted Farm/Item/build deltas and outbox together. Canonical
tables remain acknowledged facts; pending deltas live in `farmPending`, not ordinary stack uploads. UI can show
the predicted station/output, but calls it Pending. Global Items displays canonical balance, local reservations
and pending incoming separately; no permanent negative inventory. Accepted receipts update canonical tables,
ledger and pending/outbox markers in one transaction, then publish Zustand. Fault injection covers every write.

Same-device offline descendants may use their own pending output only with explicit dependency IDs and a
deterministic topological replay. A rejected ancestor blocks descendants; never credit their output/EXP. Retain
their frozen intent for visible recovery, then rebuild the overlay from acknowledged state plus valid pending
commands. No whole-save rollback and no automatic retry under a fresh spending ID. Another device sees only
canonical stock/jobs. A lost reply resends unchanged operations; adoption never replaces newer local unrelated
RPG/Puzzle/racing edits with an old whole-account snapshot.

`FarmOperationCoordinator` reserves `fop:<deviceId>:<sequence>` in a persisted transaction. It writes only
pending intent/receipt predictions and an `op:'farm'` outbox marker when enqueuing; canonical tables are unchanged.
Declared dependency ancestry is followed transitively, so a long offline chain does not need every ancestor in
one command's sixteen dependency slots. Predictions are replay views, not canonical ledger/Item writes.
Acknowledgements validate complete response accounting before a transaction, re-read current versions, install
canonical Farm facts/evidence once, settle markers and revalidate descendants. Rejected intent remains recoverable.
GET/JSON/cloud adoption uses the same strict record/log parsers, retains unknown/future errors and never feeds
v3 through legacy harvest-derived EXP. Delayed pulls preserve newer Farm stock and unrelated Uma edits even
when the existing Puzzle coordinator is also present. T121 still owns the real host, user-facing views and retry UI.

Farm-purchased/activated **pending** stats are previews only. Racing and historical/frozen parent snapshots
use acknowledged Farm configuration; UI explains when a pending purchase needs sync before it affects racing.
An existing acknowledged build remains usable offline. There is no second inventory or server-only Farm UI.

## 5. API mirror, protection and transport

T119 implements explicit parsers under API `save/farm-domain/`, with parity tests against pure domain outputs.
`node apps/api/scripts/sync-farm-adapter.mjs --check` verifies all15 production kitchen modules byte-for-byte;
four small facades use the unchanged shared scenario/types/legacy-cycle vocabulary. No fixtures enter the mirror.
Existing `puzzle-domain/farm/` remains a legacy dependency of the Puzzle parser;
do not replace it with incompatible v3 records or change Puzzle preservation content. Update root SaveSnapshot,
entity/log kinds, local file repository, Firestore repository, Dexie adoption/export and outbox acknowledgement.
The shared snapshot parser now understands additive Farm records, expanding the mechanically checked Puzzle
dependency closure from70 to83 modules; legacy Farm helpers and Puzzle preservation rules remain unchanged.

Farm requests do not mix semantic Puzzle operations in one transport batch. Ordinary/Puzzle/Farm queues flush
in a coordinated order without starvation. Apply protection guards to ordinary upserts/appends as well: active
Farm-owned stacks, rows and new evidence cannot be uploaded outside the Farm lane. Read `farmCutover/main`
implicitly even when a legacy request omits it. Existing ordinary crop/Extra writes reject during reset/after
active; identical already-stored history may be acknowledged but cannot mutate active projections. A stale
Uma write cannot resurrect retired Extra fields; unrelated valid build/race changes still reconcile normally.
Existing Puzzle bank guards compose with Farm guards, rather than one bypassing the other.

Use a static per-payload reference function including implicit control, worker/ownership, recipe, stacks,
receipt and newly written ledger/target guards. Validate against **unchanged** existing ceilings: at most 16
semantic operations, 256 KiB serialized operation batch and 200 combined read/write references per Farm batch.
Respect any smaller shared sync ceiling too; do not raise `PUZZLE_SYNC_LIMITS` or the generic limit.

Partition a30-claim Collect all by **all three limits**, not only operation count. Keep a single atomic operation
intact; if it alone is too large, fail visibly. Dependencies accepted in an earlier batch remain referenced by
receipt. Read all Firestore references before writing; all effects and receipt commit in one transaction.
The local file adapter uses the same pure resolve result and durable all-or-nothing replacement.

Concrete static reads always include `farmCutover/main` and `constellationBank/main`, the operation receipt and
direct dependency receipts. Station operations also read `farm/main` and the frozen legacy page. Ownership/worker
reads are bounded to the targeted outfit, never all workers. Start adds its block row, concrete debit stacks and
movement IDs; Claim adds allthree recipe rows, output stack/movement and terminal guard; Energy adds its one
stack/movement. Buy adds the outfit's block map, matching meal/movement and purchase guard; activation has no
item movement. Legacy Claim adds original-cycle evidence, old output/movement and cycle/station guards. Assign
reads the bounded eighteen legacy station guards to detect a held legacy job before moving a worker.

The combined ordinary/semantic read/write union is ≤200, including implicit controls. The **complete request**,
not just the operations array, is ≤262,144 UTF-8 JSON bytes and ≤16 Farm groups. Farm projections/pages/reference
Items/bank wrappers are ≤131,072 bytes; the already-large shared Uma read wrapper and immutable receipt are
≤921,600 bytes. Full response arrays are ≤14,745,600 bytes. These lower Farm-local ceilings are pinned without
raising generic/Puzzle limits. Greedy sender partitioning also reserves full-request overhead and estimates
response size; a single oversized command is kept intact for visible recovery. Both adapters validate the final
full response before any write, so a reply too large to adopt cannot commit a hidden economic effect.

Generated synthetic stress maxima (UTF-8 JSON; witnesses, not permission to exceed any ceiling):

| Witness | Observed size / references |
|---|---|
| Four disjoint ten-input, quantity4 banquet Starts | 7,850-byte complete request;101 refs |
| Thirty ready, legally populated stations (including six ten-input banquets) | 16+14 commands; largest complete request14,078 bytes,106 refs, full response781,378 bytes |
| Farm projection with all30 frozen jobs | 18,373 bytes |
| Largest Start / Claim receipt in that full-station fixture | 47,742 /40,656 bytes |
| Four configured distance builds in every one of14 scenario units | Shared Uma reference290,445 bytes; proves a128 KiB Uma limit would reject a legitimate save |
| Exact/over request/reference/group boundaries |262,144 bytes accepted, next byte rejected;200 refs accepted,201 rejected;16 groups accepted,17 rejected |

Generated near-900 KiB valid shared Uma reads also prove oversized repeated authoritative responses reject
before commit. Two-device, lost-reply, distinct-ID terminal/purchase and all-write fault tests cover local-file,
strict fake Firestore and isolated IndexedDB. AuthGuard still guards the existing `/api/sync`; no endpoint,
credential, dependency, infrastructure or owner-account operation is added. Both Farm capabilities are false.

Required bounds tests: max-input four-banquet Start (ten distinct stacks), combined Energy/Claim retry, thirty
ready stations, two-device same-node purchase, all fourteen scenarios/four presets, many worker rows without
all-worker reads, batches split just under/over 200/256 KiB/16, mixed ordinary/Puzzle guard cases, malformed/future
schema, target evidence ID collision and receipt response byte size. Store histories outside projections; these
limits are not permission to make lifetime history finite or to delete it.

## 6. Protected cutover and recovery

T120 implements this **dormant**; T124 activates it. API and web have matching code-owned Farm rework capabilities,
false through T123. No environment/workflow/infra change. With capabilities off, existing Farm/Extra UI/host and
sync behave exactly as before; browser proofs opt into isolated synthetic repositories only.

1. New client, online persistent storage, drains legacy Farm/Extra and other economic queues. Wait for in-flight
   race/scenario/redemption/CL commits before preparation. Offline/uncertain legacy writes show a deferred Farm
   upgrade, never disappear. Other modes remain accessible where their current protocol permits it.
2. Capture and verify a **private device-local whole-account recovery archive** using existing backup conventions:
   canonical snapshot, local unresolved journals/intents, account identity/build/schema metadata and digest.
   Never put its JSON in git/screenshots/logs. Failed capture/write/exportability blocks destructive steps.
3. An authenticated resumable prepare request validates source versions and archive acknowledgement, freezes the
   authoritative owned-outfit/scenario/legacy-job cohort and creates one generation/control record. Stale source
   versions require a refreshed archive before resetting. Repeat returns the same frozen cohort; no resnapshot.
4. Reset one bounded outfit step at a time with explicit receipts: clear that Uma's **all-scenario/all-distance**
   retired Extra unlocks/actives only, create/reset its v3 worker EXP to 0, ensure new generation maps start empty.
   Preserve every other field from the current authoritative Uma, not the frozen entire object. Include owned
   idle outfits and zero-progress outfits; future acquisition starts at 0 by ordinary default, not a second reset.
5. Finalize only after all frozen steps verify. Install Farm schema 3 with the old 18 assignments mapped to
   Garden/Orchard/Barnyard, legacy running jobs retained with exact original IDs/deadlines and Workshop/Kitchen
   empty. All thirty spots are available; old last-crop suggestions cannot become a free new recipe. Activate
   generation and zero shared recipe/cookbook/map projections. Receipts make finalization repeat-safe.
6. Adopt acknowledged changes locally transactionally, preserving unrelated edits. The new guide/Hub exposes
   what reset and the recovery export. Reinstall/second device adopts the same active generation without reset.

Use bounded freeze pages (maximum 32 outfits/page, no more than existing transport/document caps). Freeze a
small header plus pages, not every unit/owner row in one huge JSON document. Limit total cohort to 4096 outfits;
over-bound accounts fail before reset, not partial migration. Single-outfit steps must stay below the document
cap even with every currently registered scenario. An error keeps phase/evidence/backup for Retry/Export.

Keep all old Items, ledger/race/history, owned outfits/cards, card stars/sets, levels/CL/aptitudes/goals,
Inspiration/debts/tokens, RPG/Puzzles parties/progress and their backups. Old Produce/Extra/Farm evidence is
history only, never XP/unlock input for a new generation. A legacy job can be claimed once for its old output,
**zero new EXP**; it blocks a new job on that mapped station until claimed. Different IDs cannot double-pay
its old cycle. No automatic crop→meal conversion or starter gift.

Do not rerun startup Inspiration advances or Puzzle preservation as part of Farm upgrade. Do not bulk-delete
owner documents. After an active reset, rollback means a compatible read/recovery build or targeted forward
repair. Never redeploy a pre-v3 writer over active accounts or automatically restore old bonuses/account data.
Restoration from the archive needs a separately explicit owner request and a compatible reviewed protocol.

## 7. Real host, views and navigation

T121 installs a separate `FarmKitchenHost` through `GameRuntime`, not a test double. Extend the runtime lazily;
legacy `FarmHost` remains selected until the release capability and active generation both agree.

Port: `read`, `assign`, `remove`, `start`, `claim`, `collectAll`, `spendEnergy`, `grantEnergy`, `buyNode`,
`setActive`, `retry`, `prepareUpgrade`, `exportRecovery`; each mutation returns durable canonical/pending status
and the persisted receipt/operation ID. UI captures an intent once and reuses it on Retry/double-tap. Read/Help/
navigation never mutate, grant, reset or automatically select a recipe. No-storage mode is read-only recovery
or isolated DEV demo, never an apparent production craft with lost input/output.

Views join worker progress, scenario food labels, stock and verified art. Ready derives from the frozen deadline
plus cumulative Energy using an injected clock. One visibility-aware minute tick/focus refresh updates labels;
no Dexie/network writes on ticks. Sync/Error/Pending lives beside the affected job, not as false success copy.

| Route | Screen / back behaviour |
|---|---|
| `/farm` | Global Hub, five district cards, counts/next completion/wishlist; Back→Home |
| `/farm/district/:districtId` | Six tiles, district switch; Back→Hub |
| `/farm/workers` | Working/Available outfit roster, Farm-level-first/name/id; destinations link to stations |
| `/farm/recipes` | Sixteen recipes per block, scenario ingredient catalogue, wishlist and shopping sheets |
| `/farm/items` | Existing global inventory with Farm categories/legacy labels; no local duplicate |
| Existing Extra Stats route | Current outfit/scenario/distance, shared block map/list; Back uses existing Training context |

Remember density/filter/district/wishlist (up to 3 recipes with target quantities) in account-scoped device-only
preferences. Recipe/cookbook completion is synced; preference changes create no game progress. Reuse item deep
links. Redirect old `/farm/section/1..3` to their mapped raw districts; old crop catalogue to Recipes with legacy
stock access. Validate unknown routes/IDs with an actionable screen, not a fake missing-content error.

## 8. Extra Stats and racing

The new map is not a card constellation or Inspiration tree. Purchase one meal against a real unlocked scenario
in that block; all scenarios/distances of that outfit share bought IDs, not active IDs. Newly opened units have
empty active lists. No CL/Farm worker-level requirement for consumption and no scenario creation side effect.

Route/profile/training/racing/parent-snapshot projections join the same acknowledged map by **actual scenario
and distance**, not active UI tab. New-block maps are empty; existing older blocks remain valid. Pending stats
are preview-labelled; acknowledged configurations work offline. A corrupted/missing-template purchased row
is recovery, not silently ignored progress; missing row is legitimately empty.

Preserve card node values exactly by naming the historical 240 normalization separately from Farm's new pool.
Derive pre-cap base/card/buff/growth exactly as now **with legacy Extra disabled on active generation**, then add
Farm's flat vector once and cap/round consistently. Foundation retains its non-Farm effects but does not scale
Farm, nor does Shared Light choose its lowest stats based on the new Farm vector. SP/card skills/aptitudes unchanged.
Expose base/cards, Farm, before-cap/after-cap/marginal gain without misleading `rawTotal` invariance assertions.

Existing saved race inputs/replays/results never change. A new race freezes acknowledged stats through the
normal input builder; no race-engine version/coefficient change. Mid-race build edits follow existing locks and
must not rewrite frozen input. Current caps stay; 1,600-Speed examples are later-scenario direction, not tier 1 targets.
Run card-only exact-equality fixtures across every tier and 0–3 stars/eras/buffs, then the small mixed-deck stat matrix.
T118's fixtures and matrix already verify the pure post-growth boundary, including Foundation/Shared Light;
T123 still owns the actual acknowledged-map join and explicitly named historical240 normalization.

## 9. Delivery and evidence

Task PRs run lint/test/build and the relevant synthetic sims. New script names: `sim:farm:kitchen` (time/material
conservation) and `sim:farm:stats` (base/cards/Farm/cap matrix) are implemented by T118. Keep old `sim:farm` through dormant
merges, move its live-envelope assertions to the new model only at T124 while retaining legacy rule fixtures.
Their complete deterministic regression hashes/policies are in [the balance record](../research/farm-kitchen-balance.md).
The legacy constellation sim's previously recorded tier1 stamina failure remains explicit, not hidden by Farm tuning.

Each task carries its rules into this page/design, appends an actual next-free decision and deletes its own
spec in the same completing PR. Until T124, assertions are additive/capability-off and do not replace shipped
Farm documentation. At release update Farm/Constellations/architecture/minigame-kit/README together, remove
contradictory old live descriptions and retain versioned legacy parsers and historical decisions.

Synthetic browser evidence lives in `docs/research/farm-kitchen-phone-proof/`, no owner save/art in git. Verify
390 × 844 and 375 × 667,44 pt actions/safe areas, all six district tiles without page scroll, accessible sheet/list
fallback, reduced motion and persisted restore. Document system-text scrolling exceptions honestly.

T124 creates the standing release acceptance record: app/API commit, CI/deploy run, unauthenticated health/auth
smoke, startup gzip ≤ 180 KB, Farm/Extra lazy chunk sizes, synthetic integration/hash checks, recovery state and
pending owner checks. Existing [release runbook](infrastructure.md#release-runbook) is the deployment path;
no cloud credentials or infrastructure edits. Installed PWA update/build identity is a separate check from
Hosting success. No content republish is expected; do not rewrite existing private manifests just for food SVGs.

Physical iPhone, real-account reset visibility, actual check-in pacing and second-device play require the owner.
Those checks follow the completed production release, not a demand that the owner validate an inaccessible DEV
screen. Missing owner results remain explicitly pending; do not label the full device acceptance passed.
