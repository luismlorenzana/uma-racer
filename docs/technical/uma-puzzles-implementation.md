# Uma Puzzles — implementation contract

**Status: T106–T111 foundations/content code/save/sync/real replay host implemented (D269–D274); gameplay/cutover not enabled.**
T109's [private pipeline/content client](puzzle-content.md) is implemented (D272), but real source/art acceptance is
pinned at the owner's request. DEV proofs use original labelled placeholders; T112's Hub/parties/maps are next. No gameplay/cutover is enabled.
Gameplay is [Uma Puzzles](../design/uma-puzzles.md) (D267).
[M030](../tasks/M030-uma-puzzles.md) assigns T106–T116. This page resolves ownership, transport and delivery boundaries
so downstream tasks do not each invent a different save or host. D268 records this engineering plan; numerical battle
and EXP candidates remain subject to the small simulations and AGENTS pinning rule.

## 1. Module and version boundaries

| Layer | Proposed home | Responsibility |
|---|---|---|
| Pure rules | `packages/domain/src/minigames/uma-puzzles/` | Identity, progression, materials, board/combat, maps, replay, parsers, settlement projections |
| Sim | `scripts/sim/puzzles-*.ts` | Public-API bots, combat envelope, progression/allocation and migration checks |
| Private pipeline | `scripts/data/`, `scripts/assets/`; ignored `content/` | Verified PAD cast, provenance, immutable art/pack objects |
| Content client | `apps/web/src/content/puzzles/` | Verified/cached/retained pack joins, no engine dependency on art |
| Persistent host | `apps/web/src/game/puzzles/` | Dexie transactions, journal, operations, resume, reconciliation and selectors |
| API boundary | `apps/api/src/save/puzzles-*` | Explicit parsers, conditional operation resolution, protected cutover/takeover |
| Screens | `apps/web/src/screens/puzzles/`, `scenes/puzzles/` | Lazy DOM navigation/HUD and Pixi input/event playback |
| Shared UI | `apps/web/src/ui/minigames/` and established item SVG system | Shell, guide, meters, material marks and spend sheet |

No new target in `MinigameHost`. No screen imports Dexie or writes Items. Do not copy the RPG's class/MP/save reset,
its twelve-level chapters or its missing-journal automatic restart. Reuse presentation primitives and truly generic
board/path helpers, not the old reward engine. Never renumber a deployed engine or migration in place.

New Puzzle payloads start at their own schema/engine version 1. Select actual next Dexie/Uma/profile/transport versions
from current main **when implementing**, not by reserving today's next integer here. Each boundary has a rejecting
parser and an explicit version dispatcher. API currently has independent runtime parsers, not a built `@racer/domain`
dependency; preserve that packaging unless a task separately proves a dependency-free compatible build. Cross-layer
synthetic parity tests must catch divergence. Do not make an untested source-TS import work only under Vitest.

### T106 implemented foundations (D269)

The narrow `packages/domain/src/minigames/uma-puzzles/index.ts` barrel is exported by `@racer/domain`. Nothing calls
these rules from an app at T106; T111 adds their gated real host. Modules have no I/O, clocks, unseeded randomness, rendering or save imports:

| Module | Actual public contracts |
|---|---|
| `identity.ts` / `types.ts` | `createPuzzleSource`, `parsePuzzleSource`, `eligiblePuzzleStyles`, `eligiblePuzzleElements`, `enrollPuzzleOutfit`, `parsePuzzleEnrollment`, `correctPuzzleElement`, `enterFirstPuzzleBattle` |
| `progression.ts` | `puzzleStats`, `nextPuzzleLevelExp`, `parsePuzzleProgress`, `puzzleWinExp`, `puzzleBattleExp`, `addPuzzleExp`, `puzzleLevelChanges` |
| `materials.ts` | `puzzleScenarioIdForTier`, `puzzleMaterialId`, `parsePuzzleMaterialId`, `puzzleMaterialCatalogue`, `validatePuzzleRegistry`, `previewPuzzleClSpend` / `resolvePuzzleClSpend`, `previewPuzzleExchange` / `resolvePuzzleExchange` |
| `bank.ts` | `parsePuzzleCohort`, `freezePuzzleCohort`, `parsePuzzleBank`, `preparePuzzleBank`, `repayPuzzleMaterial` |
| `legacy.ts` | `summarizePuzzleLegacyCredit`, `resolvePuzzleLegacyCredit`, `parsePuzzleLegacyCredit` |
| `rules.ts` / `validation.ts` | Initial pinned constants; `PuzzleRuleError` with `invalid`, `unknown`, `locked`, `stale`, `insufficient`, `overflow` codes |

Source, enrollment, cohort, bank and legacy-credit payloads each use schema **1**. Source/enrollment rules version is
**1**. Source freezes complete original aptitudes, base stats, fraction growths and catalogue version; enrollment
also stores the verified palette, chosen element, PL/remaining EXP and nullable first-battle id. This is a domain
value type, **not a change to Uma/profile/Dexie schema**. No current save field is renamed.

Parsers reject extra/prototype keys, duplicates, future versions, invalid grades, non-finite numbers and unsafe
integers. Growth units are explicit: fraction 0…1 or whole percent 0…100 normalized once, never auto-detected.
`parsePuzzleProgress` requires EXP below its next threshold. Stat arithmetic and totals reject overflow, not clamp.
An exact arithmetic-series binary search carries any safe EXP grant; there is no Lv50/140 cap. `addPuzzleExp` returns
before/after, total stat deltas and the full crossed-level range. `puzzleLevelChanges(source, gain, offset, limit)`
returns ordered per-level deltas plus `nextOffset`, at most 256 per call, so even a huge legal grant remains bounded
without hiding any crossed levels. Transport bounds are 120-character ids, 256 registry definitions and 4,096 units
per cohort/credit payload; T110/T115 must chunk larger authoritative work rather than reject a large account as a
gameplay restriction. Scalar safe-integer limits are representational, not level design caps.

CL and exchange previews are aliases of their resolve functions. Re-run them with fresh stocks/revision/source
inside the eventual transaction. Results contain exact debits or gross/repaid/net, stocks after, before/after CL or
bank after, and revision after. They create no assignments, nodes, evidence timestamps or persistent operation id;
receipt deduplication, ownership checks and the account preparing/activation gate belong to T110/T111.
Stocks at this boundary are the material/universal subset of Items, not the unrelated Farm/RPG inventory.
Registry order defines exchange adjacency; numeric racing tiers use a lookup, never `tier + 1`.

The cohort freezes one normalized row per outfit/scenario, independent of its four presets. A retry with its same
receipt id adopts the frozen cohort, excluding later acquisitions. Missing/invalid/no-A sources leave an all-or-none
`preparing` bank with unresolved outfit ids and no debit. Resume uses that same cohort; active allocations freeze
source version/rules, eligible styles and chosen debt style. An active retry cannot recalculate even a repaid bank.
Bank parsing checks exact allocation/row order and debt bounds derived from CL−1, including retained zero rows.
`repayPuzzleMaterial` validates active state and returns `{gross, debtPaid, net, bankAfter}` without mutating input.

Legacy EXP adapters supply **unapplied** unit EXP, an `alreadyConverted` audit flag, remaining account bank EXP and
preserved universal stock. Applied levels are not accepted as EXP. Credit pools non-settled rows plus account EXP,
converts 1,250 chunks and rounds the final positive account fraction once. Its v1 receipt keeps every input, exact
pool, full chunks, remainder, round-up, compensation EXP and stock after. A same-id retry returns the original
receipt rather than recomputing later progress; a different receipt id is stale. It never invokes debt repayment.
T115 must clear transferred EXP and issue this credit in the same protected migration transaction.

Evidence: synthetic identity, progression, material, bank, legacy and source-boundary tests are co-located here;
`domain.test.ts` pins candidate coefficients and work limits. No battle hash/simulator, real-content verification,
account mutation, UI or phone sign-off exists for T106. Those remain the later task gates.

### T107 implemented battle v1 (D270)

The folder's `battle.ts` / `replay.ts` expose `createBattle`, `applyBattleAction`, `replayBattle`, `battleStateHash`
and `puzzleBattleResult`. To preserve the RPG engine's established root exports, the Puzzle/domain barrel aliases
the first four as `createPuzzleBattle`, `applyPuzzleBattleAction`, `replayPuzzleBattle`, `puzzleBattleStateHash`.
T107 landed without app callers; T111 adds its gated replay host. These are independent of Spark utilities; there is no shared-board replay change.

| Module | Actual responsibility |
|---|---|
| `battle-types.ts` / `battle-parse.ts` | Version1 input/action/state/result, strict detached rejecting parsers and derived party totals |
| `board.ts` / `rng.ts` | Opening, adjacent paths/interpolation, qualified groups, canonical gravity/refill/cascades/conversions and four named RNG cursors |
| `catalogue.ts` | Finite stable active/leader/pattern/enemy ids, source-A choices, default kit and exact PL5/10 equip gates |
| `combat.ts` / `enemies.ts` / `battle.ts` | Ordered hits/healing/focus/mitigation, finite intent/phase reducer, charge/status lifecycle and authoritative event transitions |
| `replay.ts` | Complete bounded replay, diagnostic canonical hashes, terminal result derived from replay state |
| `bots.ts` | Board-only novice/competent public actions; not a production auto-player |

`PuzzleBattleInputV1` has exact keys: `schemaVersion`, `engineVersion`, `rulesVersion` (all1), `battleId`,
`partyId` (`puzzle-party-1`…`5`), `checkpointId`, nonnegative `ownerEpoch`, `seed`, registered `scenarioId`,
`encounterLevel`, `kind`, five ordered `entrants`, `leaderId`, `enemies`, `rewards`, and
`content:{manifestVersion,recipeHash}`. An entrant freezes `outfitId`, full T106 `source`, positive `level`, eligible
`element`, `stats` exactly equal to `puzzleStats(source,level)`, and `kit:{activeId,patternId}`. No duplicate outfit
or formation id is accepted. `rewards` is up to four distinct `{style,quantity}` rows, frozen at entry and untouched
by phase changes; T108 produces their real quantities, and T111 grants them only after authoritative winning replay.
The engine never writes Items or calculates a production reward receipt.

Enemy definitions freeze `id`, cosmetic `castId`, semantic `recipeId`, `element`, `maxHp`, `defense`,
`openingCountdown`, `intents`, `delayImmune` and nullable `phase`. Each cyclic intent has `type`/`countdown` plus
only its explicit parameters: attack `damage`; heal `amount`; guard/ward `reduction,durationDrags,comboThreshold`;
convert `from,to,count`. Each foe needs an attack and only specials allowed by its named recipe; unsupported
hazards/unknown recipes/future versions never fall back to a generic attack. Champion phase is
`{atHpPercent:50,damageMultiplier,countdown,element}` with optional element represented by null. Ordinary/guardian
foes admit at most one/two special families (rage counts as one); a champion encounter must contain a phased foe.
Exact timing, rounding, constraints and published finite ids are in [design §5](../design/uma-puzzles.md#implemented-battle-v1-rules-t107-d270).

State carries detached input/board, four nonzero32-bit RNG cursors, turn/action count, shared HP/maxHP/RCV/guard/
resilience, five `{charge,usedInGap}` records, formation-ordered enemy HP/element/countdown/intent-index/phase/delay/
barriers, pending shield and outcome/reason. Enemy barriers use `expiresAfterTurn` (inclusive covered drag, removed
at its end). Parser verifies derived totals, version/bounds, palette/loadouts, formation identity and terminal
consistency. A parsed snapshot is **not proof** of legitimate play; reservation restore/commit must replay its
frozen input/journal, never trust client HP or a result payload.

Actions are exact `drag:{path,elapsedMs,focusId}`, `use-active:{slot,focusId}` (zero-based slot) or `abandon`.
Null focus chooses the deterministic default; unknown focus rejects, known defeated focus retargets. The parser
rejects sparse/prototype-bearing/extra-property arrays, NaN, bad adjacency and extra keys. Invalid input/action,
not-ready/no-effect active, exhausted work bound and terminal mutation throw `PuzzleRuleError` without changing the
caller state or its RNG. The pure transition contains state plus ordered `drag`, `cascade`, `heal`, `hit`,
`retarget`, `active`, `conversion`, `shield`, `delay`, `phase`, `enemy-intent`, `barrier`, `charge`, `intents` and
`terminal` events. Cascade events include before/after board, groups, cleared indices, falls and refills; hit and
heal events include exact before/after HP. Enemy conversion does not cause an extra cascade until the next drag.
The screen plays these values; it must not choose targets, rolls, damage, phases or rewards.

Hash v1 is recursively lexicographic key-sorted JSON, preserving array order, over all rule state/frozen input.
It omits enemy `castId` and manifest art version while retaining them in the snapshot; `recipeHash`, source
provenance, reward vector and owner epoch remain covered. Hover and animation/elapsed duration are not state.
Two unsigned FNV-style32-bit lanes emit16 lower-case hex characters (diagnostic, **not a security signature**).
Seed names are `opening`, `refill`, `player-conversion`, `enemy-conversion`, derived by FNV-1a with a separator;
xorshift32 draws use rejection over its2³²−1 nonzero-state range for uniform integer buckets. Rejection is bounded,
not a modulo-biased fallback. Two literal complete journals pin the initial and every action hash and JSON events.
The 288-battle sim pins its measured envelope too; [design §11](../design/uma-puzzles.md#small-focused-validation-before-pinning)
records unmet balance targets rather than claiming these fixtures validate production scaling. T108 adds its own
600-battle campaign envelope without changing this historical fixture output.

`PuzzleBattleResultV1` contains only engine version, battle/epoch identity, action count, hash, terminal outcome/
reason, accepted drags and ending HP. EXP/material claims are absent. The eventual commit checks journal identity
and derives rewards itself. No save/API/Dexie/host/private content/rendering/publication is part of T107.

### T108 implemented campaign v1 (D271)

`campaign/` exports the following pure contracts through the Puzzle/domain barrel. None is a new persisted save row
or a trust boundary replacing journal replay. `fixtures.ts` / `test-helpers.ts` contain only invented test/sim inputs
and are **not** public barrel exports or production cast fallbacks.

| Module | Actual public contracts |
|---|---|
| `chapters.ts` | `puzzleChapter`, `puzzleCampaign`: registry-driven canonical28-node DAGs |
| `identity.ts` | `puzzleCampaignId`, `parsePuzzleCampaignId`: canonical chapter/node/checkpoint/attempt identities |
| `progress.ts` | `parsePuzzleChapter`, `parsePuzzleCheckpoint`, `createPuzzleCheckpoint`, `puzzleChapterStatus`, `puzzleEntryEligibility`, `parsePuzzleClearFact`, `applyPuzzleTerminal`, `puzzleExchangeOpeningClears` |
| `encounters.ts` | `parsePuzzleCast`, `resolvePuzzleEncounter`, `puzzleEncounterRewards`, `freezePuzzleEncounter` |
| `rewards.ts` | `puzzleBattleGrants`: once-account material vector, five frozen-entrant EXP rows and accepted-terminal fact |
| `allocation.ts` | `allocatePuzzleMaterials`, `planPuzzleTargetedWins`: integral planning reports, never inventory writes |

Maps and checkpoint projections use schema1. Cast input is exact
`{ schemaVersion:1, manifestVersion, members:[{id,elements,roles}] }`, with1–4,096 unique id/tag rows. Tags are
validated and ids sorted before deterministic selection; no names, asset URLs or original damage stats enter rules.
The private content adapter must validate provenance/coverage before supplying this contract. Missing element/role
coverage throws `unknown`; it is not silently replaced by synthetic rows.

Local node ids are `o1a`…`o10b`, `g1`…`g3`, `c-fire`/`c-water`/`c-wood`/`c-light`/`c-dark`.
Canonical encodings are `pzc:<scenario>` (chapter), `pzn:<scenario>:<local>` (node),
`pzp:<party>:<scenario>` (checkpoint), `pzb:<party>:<scenario>:<local>:<attempt>` (battle).
Scenario ids are registry-validated lowercase kebab-case≤64; party ids1…5 and nonnegative safe-integer ordinals are
canonical, without signs/leading zeroes. Maximum combined ids fit the120-character bound; no string concatenation
at a downstream call site invents a competing identity scheme.

`PuzzleCheckpointV1` projects `{schemaVersion,chapterId,partyId,cleared,attempts:[{nodeId,next}]}`. Clears must have
prerequisite closure in topological order and an accepted attempt. No forged later win can bootstrap itself; unknown,
duplicate, sparse, prototype-bearing or extra-key rows reject. `requires` is AND-of-OR groups: ordinary rows accept
either previous branch; Finals require all three individual guardians. Reached alternatives and won nodes remain
replayable. Any champion marks complete; all28 marks full. Entry requires five valid PLs and a reached node, returning
only a low-level warning, not a hard PL/racing-ownership/colour quota. The host still checks enrollment/ownership.

`freezePuzzleEncounter` calls that same preview resolver, then validates the complete T107 input with actual source,
kit and derived stats. Seed is the string `puzzle-seed-<puzzleSeed(accountSeed,'account')>-<puzzleSeed(battleId,'attempt')>`.
Reopening the same attempt reproduces it; only an accepted win/loss/abandon increments `next`. Dark variant, cast,
foe coefficients and reward vector freeze together. Recipe provenance is `puzzle-campaign-v1`; full numerical input
remains in the journal. Cosmetic manifest/cast changes do not change the canonical diagnostic battle hash.

The T107 create/action/parser/hash/replay/result functions now accept an optional **trusted canonical scenario
registry** (default current `SCENARIOS`). This supports an invented fifteenth scenario end-to-end, with unchanged
default-engine hashes/versions/math. An extra `registry` in an untrusted input is rejected, not installed from the
payload. Validate/adapt real registry changes at the host/content boundary.

Commit sequence: reconstruct terminal state from the accepted frozen journal; call `puzzleBattleGrants`; deduplicate
the battle receipt in the economic transaction **before** `applyPuzzleTerminal`; apply per-entrant awards to current
progress, not by overwriting it with frozen PL; repay matching debt and credit the single account vector. Loss/abandon
and partial kills pay0. The pure reducer rejects duplicate/out-of-order terminal ordinals. A structurally valid state
or `PuzzleClearFact` is not proof of a win. `puzzleExchangeOpeningClears` folds the trusted accepted ledger's higher
`g1` wins into an account-wide, ordered, immutable edge set; first chapter has no edge. T110–T111 own authenticated
receipts/storage/sync, preserving these facts independently of later party edits. No client-supplied unlock boolean.

Allocation accepts1–6 recipients needing0–9 tickets each only as a bounded reporting algorithm. Integer max flow
handles overlapping original-A styles; the four-family champion search returns the minimum extra wins, with
Front→Pace→Late→End tie-break. It does not select outfits, move Items or implement cross-style exchange. Design §11
publishes exact route vectors, EXP carry/catch-up, debt/exchange examples and combat outliers; regression envelopes
are checked by `pnpm sim:puzzles` (`--combat` / `--economy`). The finite skill kit remains PL1/5/10.

## 2. Stable identity and source snapshots

Elements are `fire | water | wood | light | dark`; ticket styles use existing `Strategy` values
`front | pace | late | end`. Heart is a **board kind**, not an outfit element or item style.
Use stable registered scenario ids and registry order; resolve today's numeric racing tiers through an explicit
adapter. Never parse a label or assume a future scenario can be reached with `tier + 1`.

`constellation:<scenarioId>:<style>` is the new material identity. Preserve `training:level-up-ticket` as the legacy
universal id; change its display name, not its historical ledger id. Party ids are `puzzle-party-1`…`puzzle-party-5`.
Chapter/checkpoint/node ids use one documented canonical encoder, with delimiter-safe validation and no ambiguous
string concatenation. Battle identity comprises preset + scenario + node + **persisted** attempt ordinal. Owner epoch
is separate from identity; takeover never changes the battle id or seed. Retry after terminal increments the ordinal.

Enrollment freezes outfit id, verified catalogue version, enrollment-rules version, normalized base/growth data,
original surface/style grades, eligible elements and selected element. Source-A eligibility is literal A, Dirt-A
override first. Racing preference, lineage or updated art cannot mutate this snapshot. The first battle reservation
locks element correction, including a later loss/abandon. Default skill choices follow an explicit Front/Pace/Late/End
order only among eligible A styles; an editor can choose another eligible archetype outside an open battle.

## 3. Additive account records

T110 implements the following additive schema-1 records. Exact exported interfaces and rejecting parsers live in
`packages/domain/src/minigames/uma-puzzles/records.ts` and `operations.ts`; no profile/Uma schema stamp changes.

| Record | Identity / minimum fields | Sync |
|---|---|---|
| `puzzleOutfits` | outfit id; frozen enrollment; lifetime PL/remaining EXP; selected kit; first-entry fact; projection revision | Yes |
| `puzzlePresets` | five stable party ids; name; ordered five nullable outfit slots; slot loadouts; slot-1 leader passive; foreground chapter; revision | Yes |
| `puzzleCheckpoints` | party/scenario; reached/cleared nodes; first-clear facts; per-node next attempt; open encounter descriptor; revision | Yes |
| `puzzleResults` | one terminal receipt per battle id; input/hash/epoch identity; outcome; five exact EXP deltas; gross/repaid/net vector | Append-only |
| `puzzleOperations` | operation id + payload digest; typed operation; dependency ids; expected economic revision; resolved receipt/status | Append-only canonical receipts |
| `constellationBank` | bounded account header; preparing/active; immutable cohort count/debit limits; nonpositive scenario/style balances; cutover version/id/revision | Yes, protected creation |
| `puzzleCohort` | one outfit/scenario's original TL/preferred style/source, resolved A-style/debit and completion evidence | Yes, protected creation |
| `puzzleJournals` | battle id/owner epoch/input hash; bounded actions and current state hash; update time (input/version/origin stay on descriptor) | **Device-only** |
| local pending operations | ordered operation payloads + optimistic projection rollback/rebase metadata | Device-only queue |
| local archives/preferences | displaced journals; guide memory; chibi/plain-orb preference; last local view | Device-only |

Do not duplicate global item stacks in a puzzle inventory. New acquisitions/spends use `items` + `itemLedger` with
bounded source unions; gross grant evidence includes repayment. Positive stock never includes negative bank balances.
The bank's frozen cohort may need multiple bounded records if it cannot fit Firestore's document limit; the API must
refuse oversized work before writing, not discover a production limit after half the account changed.

### T110 implemented persistence/protocol v1 (D273)

All ids use the existing safe 1–120-character alphabet. Every new record has `schemaVersion:1`; metadata keeps the
existing entity `{kind,id,version,data,deleted,updatedAt}` or log `{kind,id,data,createdAt}` envelope. Stored entity
versions start at1; a missing expected row is version0. Unsupported stamps, extra/prototype keys, sparse arrays,
duplicate ids, non-safe numeric values and inconsistent derived fields reject without resetting data.

| Kind / exact data fields | Id and local indexes |
|---|---|
| `PuzzleOutfitSaveV1`: `schemaVersion,outfitId,enrollment,kit,revision`; enrollment is T106's source/element/eligibleElements/level/exp/firstBattleId; kit is `{activeId,patternId}` | `puzzleOutfits/{outfitId}`, `id` |
| `PuzzlePresetSaveV1`: `schemaVersion,partyId,name,slots,leaderId,foregroundChapter,revision`; name is nonblank≤80 characters, exactly five nullable `{outfitId,kit}` slots; chapter is nullable canonical chapter id | `puzzlePresets/puzzle-party-{1..5}`, `id` |
| `PuzzleCheckpointSaveV1`: `schemaVersion,checkpointId,scenarioId,progress,reached,open,revision`; progress is T108's checkpoint, reached is its exact derived ordered node list | `puzzleCheckpoints/pzp:{partyId}:{scenarioId}`, `id` |
| `PuzzleOpenEncounterV1`: `schemaVersion,deviceId,ownerEpoch,input,inputHash,content`; `content:{version,contentHash}` freezes T109's immutable pack id and full64-hex hash | Nested on checkpoint; no separate synced journal |
| `ConstellationBankSaveV1`: `schemaVersion,cutoverVersion:1,cutoverId,phase,cohortCount,completedCount,debitLimits,balances,openingClears,revision` | `constellationBank/main`, `id` |
| `PuzzleCohortSaveV1`: `schemaVersion,cutoverId,outfitId,scenarioId,legacyLevel,preferredStyle,source,debtStyle,debit,completed` | `puzzleCohort/pcu:{puzzlePayloadHash([outfitId,scenarioId])}`, `id` |
| `PuzzleResultSaveV1`: `schemaVersion,battleId,input,inputHash,result,fact,exp,materials,createdAt`; five EXP entries `{outfitId,frozenLevel,amount,before,after}`; material entries `{itemId,gross,debtPaid,net}` | `puzzleResults/{canonicalBattleId}`, `id,createdAt` |
| `PuzzleOperationReceiptV1`: `schemaVersion,operation,createdAt,changes,logs`; changes `{kind,id,before,after}`, logs are exact result/material evidence | `puzzleOperations/{operationId}`, `id,createdAt` |

The bank header contains at most registry-size×4 material keys, not a roster. Keys in `debitLimits`/`balances` match;
each balance stays in `[-debitLimit,0]`, with summed limits≤9×cohortCount. Completed cohort rows resolve preferred
original A style or first A style, and debit exactly `legacyLevel-1`; pending rows hold nullable source/style and zero
debit. Activation requires completedCount=cohortCount, including an empty0/0 cohort; a complete header cannot remain
preparing. T115 must check full outfit/scenario identities before writing a hashed cohort key (collision is a visible
error, not a merged unit), create/freeze the cohort and conversion receipts, and implement resumable preparation.
This task only supplies validated scaffolding: it never creates or activates that header.

Frozen inputs must use recipe `puzzle-campaign-v1`, manifest `puzzles-{contentHash}`, matching party/chapter/attempt,
five current enrolled entrants and authored numeric foe/reward recipes. The account seed source is the immutable
save-derived `bank.cutoverId`, **not a uid, clock or new random seed**. T111 passes it as `accountSeed` to
`freezePuzzleEncounter`; reservation checks `puzzle-seed-{puzzleSeed(cutoverId,'account')}-{puzzleSeed(battleId,'attempt')}`.
`inputHash` and operation digest use the exported canonical sorted-key16-hex diagnostic hash. These are not security
signatures: receipt retries additionally compare the entire canonical operation, so a hash collision cannot authorize
a different payload. Full content SHA-256 remains independent.

Dexie **v28 is additive only**, retaining every v27 table/row/outbox entry. Synced tables above join snapshots; the
following do not, and must never become ordinary append/upsert rows:

| Local table / fields | Indexes / ownership |
|---|---|
| `pendingPuzzleOperations`: `id,order,operation,status,queuedAt,changes,prediction,reason`; status pending/rejected/blocked; prediction is the complete local receipt | `id,&order,status,queuedAt`; ordered rollback/replay and offline result summary |
| `puzzleJournals`: `id,schemaVersion:1,ownerEpoch,inputHash,actions,stateHash,updatedAt` | `id`; actions follow181-action engine limit; T111 validates append/replay |
| `puzzleArchives`: `id,reason,data,createdAt` | `id,createdAt`; rejected input/diagnostics, later displaced journals |
| `puzzleBases`: `id,record` (canonical entity or null) | `id` is `kind/id`; canonical bases of currently predicted fields |
| `puzzlePreferences`: `id,value` | `id`; guide/presentation/view memory |

Pending operations store predicted result/item evidence locally, **not** in canonical cloud log tables. T111 can reopen
that pending result without inventing rewards. Only acknowledged receipt adoption installs those logs. Uma/item
physical versions remain canonical; pending chain metadata carries virtual revisions. Repair of Umas restores only
receipt-owned CL/retired EXP, preserving racing progress, preferences, Inspiration, Extra stats and all four builds.
Constellation derivation excludes still-locked nodes after rollback; assignments remain available for recovery.
Snapshot adoption, canonical rows, pending replay and ordinary state install share one Dexie transaction. Ordinary
Racing sync temporarily restores canonical economic fields, installs its response, updates bases and replays pending
groups atomically; its unrelated Uma version bump does not stale an unchanged economic bank. Farm reconciliation
does not queue or overwrite Puzzle materials (or legacy universals after activation).

`PuzzleOperationCoordinator` in `apps/web/src/game/puzzles/operations.ts` exposes `enqueue`, `nextBatch`, `adopt`,
snapshot/ordinary reconciliation and status refresh. `GameRuntime.queuePuzzleOperation` persists, publishes then
schedules normal background sync. The separate Zustand `usePuzzleSync` exposes pending/message/recoveryIds.
Rejected inputs and dependents remain inspectable; they are not automatically resubmitted with new ids or revisions.

The optional sync request is:

```ts
{ upserts, appends, puzzleProtocolVersion?: 1, puzzleOperations?: PuzzleOperationV1[] }
// PuzzleOperationV1:
{ schemaVersion: 1, operationId, payloadDigest, dependencies, expected, payload }
// expected: { kind, id, version }[]
```

Semantic payloads (no arbitrary writable-entity vector) are:

- `enroll {source,element}`, `correct {outfitId,element}`, `equip-outfit {outfitId,kit}` (roster default for future
  party assignment; does not overwrite independently equipped party slots, and locks during an open battle);
- `save-party/equip-party {party}`, `transfer {outfitId,fromPartyId,toPartyId,slot}` (slot0…4);
- `open-chapter {partyId,scenarioId}` (may save/view an incomplete party, cannot battle);
- `reserve {encounter}`, `settle {checkpointId,inputHash,result}` (terminal engine result, never reward quantities);
- `cl-spend {outfitId,scenarioId,inputs,source?}`; an unenrolled outfit may supply a validated original source without
  being forced to enroll/pick a colour; an enrolled outfit's supplied source must match its frozen source;
- `exchange {from,to,quantity}` (positive input quantity, same-style adjacent edge; higher Opening win required).

Limits pinned in `domain.test.ts`: **16 groups**, **262,144 UTF-8 bytes** for the JSON operation array, **200 distinct
referenced records** including mixed ordinary references, **921,600 encoded bytes per receipt**. The existing400
total-operation request bound and HTTP5MiB bound also apply. Dependencies≤16, unique declared refs≤200, receipt
logs≤8. `partitionPuzzleOperations` keeps whole ordered groups; an oversized single group is a recoverable error.
References include bank, owned/source/party/checkpoint rows, affected stock/result/movement records, operation receipt
and dependencies. All five parties and their relevant scenario checkpoints are read to enforce uniqueness and locks.
Every write must lie within that read set; preflight bounds run before repository reads. Receipt-size preflight rejects
the whole group before any adapter writes.

Each response contains `puzzleOperations:[{operationId,status,receipt,reason,authoritative}]`, exactly once per request
operation. Status is applied/duplicate/rejected/blocked; applied/duplicate carry the original receipt and null reason,
rejected/blocked a reason and null receipt. `authoritative:[{kind,id,record|null}]` covers the exact entity read set and
reflects the **final** canonical batch state. The client rejects omitted/unknown/duplicate or mismatched responses
before adoption. Duplicate lookup precedes revision/dependency checks; changed complete payload under one id rejects.
Unrelated ordinary writes still complete beside a rejected Puzzle group, never beside a partial economic group.

CL/exchange compare bank/stack revisions. Settlement instead checks exact open battle/input/owner and absence of a
terminal result, adds the five frozen-level EXP amounts to current progress, intercepts matching debt and closes one
attempt. It cannot roll another accepted win back. The API checks recipe/seed/result/HP/reward/EXP boundaries, not
server-side pointer replay; T111's local host must replay first. Open encounters lock party/loadout/element correction;
first entry permanently locks colour correction. A loss/abandon grants zero. Ordinary raw Puzzle/material/receipt
writes are rejected. After active cutover, protocol1 Racing/config updates preserve canonical CL and zero retired EXP;
old clients, resurrected EXP and new ordinary universal-ticket movements get explicit update/recovery errors. Farm,
RPG and Inspiration keep their established unrelated paths, including D149 ordinary-log first-copy warnings.

Both adapters use the same semantic resolver. Firestore reads its complete deduplicated set before writes and
coalesces final projections; local-file requests serialize and atomic-rename their equivalent result. Production API
packaging remains standalone CommonJS: `node apps/api/scripts/sync-puzzle-adapter.mjs` mechanically mirrors the narrow
24-module pure dependency closure into `apps/api/src/save/puzzle-domain/`. A test checks byte-for-byte parity. Edit
domain sources, regenerate, never hand-edit the adapter; no Docker, infra, dependency or source-TS runtime import change.

Authenticated `POST /api/puzzles/prepare` parses `{schemaVersion:1,cutoverId,expectedBankRevision}` and currently
returns `{status:'disabled'}` (future enabled scaffold: not-ready); T115 implements its mutation. Authenticated
`POST /api/puzzles/takeover` parses `{schemaVersion:1,checkpointId,battleId,expectedEpoch,deviceId}`. It returns
`{status:'taken-over',checkpoint}`, `{status:'settled',result}` or `{status:'rejected',reason}`; the pure response parser
checks requested identity/owner. Taken-over increments epoch and changes only owner device/epoch/input hash, preserving
the exact cast, seed, battle and rewards. Settlement winning that race returns its result; superseded epochs reject.
T111 must additionally compare the returned input to its previously frozen descriptor, then archive/start the journal
only after acknowledgement. No timeout or disappearance silently grants a new board.

Checked-in API and web capabilities remain **false**. No bank creation, training conversion, Home entry or Spark
retirement occurs here. Synthetic tests inject enabled banks; production cannot enable this through a query/route.
The real replay host/journal is implemented below (T111); real PAD inputs/private preview still belong to deferred T109.

## 4. Battle input, action and result contract

Frozen input includes engine/rules version, seed, preset/checkpoint/battle ids, owner epoch, five ordered entrants and
their level/stats/elements/selected active, one leader passive, formation/intent/phase recipes, chapter/node level,
reward-style vector, private cast ids and immutable content/recipe hashes. Display names/art stay outside state hash;
the manifest/cast identity needed to restore art is retained alongside input. No current racing projection participates.

Minimum public engine API: `createBattle(input)`, `applyBattleAction(state, action)`, `replayBattle(input, actions)`,
`battleStateHash(state)`, parsers for input/action/result, and a typed step containing authoritative state plus ordered
presentation events. Illegal input returns a typed failure without a partial state/RNG advance. No I/O/clock/React/Pixi.

Persist **drag**, **use-active** and **abandon** actions. Target selection is free local planning, frozen into a drag
or targeted active. Do not journal every hover or target tap. Drag records a 2…256-cell adjacent path, focus id and
elapsed duration 0…7,000 ms; the renderer interpolates skipped cells deterministically and the engine validates them.
The 30-drag candidate limit allows up to five active uses between drags: a journal transport bound of **181 actions**
(`30 × (1 + 5) + 1`) covers the complete first-release lifecycle. This is not the old shared journal's 64-action cap.
Cascade transport bound is 64 passes. A cap failure is a recoverable error, never a truncated reward or a rerolled seed.
If turn-limit tuning changes, change the derived journal bound and its tests in the same PR.

Canonical hashing covers board, RNG cursors, turn/HP, enemy state/intents/phases, statuses, cooldowns, used-this-gap
flags and outcome in a defined key order. It excludes animation elapsed time, translated text and transient target
hover. At most one skill per member between drags, even with a malformed repeated action; only accepted drags charge.

Terminal result is derived by replay, not submitted damage/EXP claims. The host's claim carries battle id, owner epoch,
expected action count and hash only. A result receipt stores all before/after progress and gross/repaid/net rows needed
to reopen the result after a reload. Loss/abandon closes the attempt with no EXP/items and never erases previous wins.

## 5. Host port and atomicity

### T111 implemented real host/journal (D274)

`apps/web/src/game/puzzles/host.ts` exports `PuzzleHost`, implemented by `PersistentPuzzleHost`.
`GameRuntime.puzzleHost()` lazily constructs the real production adapter in `production.ts` after persistent save and
verified Uma content readiness. It never installs a double or enables the capability. The device id is a UUID retained
in device-only `puzzlePreferences/device-id`; it is **not** a board seed. The immutable bank cutover id remains the seed source.

| Port | Actual contract |
|---|---|
| `account`, `registration` | Five default party views, parsed enrolled outfits/checkpoints, readiness/debt/stock; owned verified source/palette/styles/PL1 preview |
| `enroll`, `correct`, `equip`, `saveParty`, `transfer` | Semantic operations with stable ids; correction/equip/party/transfer compare the screen's current revision before queueing; source A, uniqueness and open locks are revalidated by the shared resolver |
| `openChapter` | Creates/reuses only checkpoint/foreground; reopening the same foreground is write-free, including its suspended encounter |
| `begin` | Party/scenario/node/Dark variant + party/checkpoint revisions + operation id; existing open returns itself, never overwrites a journal or reselects a variant |
| `loadBattle` | `battle` with replayed state/actions/hash/last event step and held content lease, `result` with canonical/pending receipt, or typed visible `recovery` |
| `append` | Battle id/owner epoch/expected action count/action → authoritative transition; compare/replay/reduce/write precedes returned events |
| `commit` | Only battle id/epoch/count/hash → replay-derived stable terminal result; loss/abandon persist zero-reward receipts too |
| `previewCl`, `previewExchange`, `confirmMaterial` | Write-free exact mixed-input/stock/debt/CL preview, full canonical comparison string, economic revision and receipt; confirmation revalidates inside the same transaction |
| `takeover` | Explicit online dependency drain, parsed acknowledgement plus complete canonical economic snapshot, immutable-input comparison, then same-seed turn-zero journal under the acknowledged epoch |

Content acquisition is outside IndexedDB. Entry re-reads save/ownership/full party/PL/kits/revisions after verification,
freezes the exact retained content identity and numeric recipe, and persists reservation/prediction/queue/outbox plus
the empty journal in one transaction. No daily tickets, profile, racing EXP or other modes are written. `append` does
not access network content, schedule sync or publish state per pointer sample; only accepted actions reach it.

`journal.ts` strictly parses the existing schema1 row against the181-action engine limit, rejects extra/sparse/prototype
shapes and unsupported stamps, and replays the complete journal against the descriptor's input hash/epoch. The stored
state hash must match. Missing/corrupt/future rows produce recovery, **never an empty default**. A canceled gesture,
pause, target hover or guide opening has no journal action. Same-count stale tabs cannot both append.

The coordinator's new `enqueueInTransaction` has no publication/scheduling; the host composes it with journal or
archive writes. Its normal `enqueue` remains compatible. `afterCommit` and the runtime publisher run only after
durability; scheduling never consults a stale pending count. Terminal commit keeps the existing T110 ownership:
the pending receipt contains offline result/evidence, not raw canonical `puzzleResults`/`itemLedger` appends. Only
acknowledgement installs those logs. Commit retries read that durable receipt even after the journal is closed; a
different epoch/count/hash cannot pay it again. Canonical result adoption replaces repayment/net (and current-progress
before/after if another win intervened), never the frozen award amounts or gross vector. Archives retain the full
original descriptor/journal for accepted terminal or displaced-owner recovery.

CL results derive actual node ids/labels from `nodesUnlockedBetween(constellationTemplate(tier), before, after)` and
stat/SP deltas from the real saved builds/cards/Uma content. CL9/10 explicitly report SP-only; configuration is not
auto-filled. Results carry outfit/scenario and a Constellation link for the later shared spend surface. The universal
input is independent of new families and does not repay debt. Exchanges expose input, gross/repaid/net, irreversible
repayment, after-stocks/bank and paired movement evidence, all in the same receipt-backed transaction.

**Completion flair is canonical, not a rejectable prediction.** The spend transaction reconciles existing badge/trainer
facts against canonical CL and queues any legitimate changes atomically. Accepted CL responses reconcile the newly
confirmed completion facts inside the same adoption transaction. `canonicalTrainingUma` also protects boot and unrelated
Training/configuration badge hooks from pending CL. Local CL/power remains immediately usable; a stale rejected spend
cannot permanently award Fully Trained before rollback. Already-earned historical badges are never removed.

Takeover flushes dependencies/outbox and refuses unresolved/offline work. The response and fresh snapshot must confirm
the requested owner/epoch or a canonical terminal result, with the entire frozen input equal except epoch. A lost prior
acknowledgement can recover from that exact online canonical owner, not a timeout. A competing terminal wins and its
receipt-owned projections are adopted together without paying again. Retained content must verify before an acknowledged
restart archives/resets local actions; content failure retains the old journal for Retry. A second local mutation during
the request rejects local adoption. Foreign/superseded journals are archived and never settle from the displaced epoch.

`proof.ts` exports `createIsolatedPuzzleProof`: an explicitly named separate `puzzle-proof-*` database, invented rows
and injected readiness/cast, using the **same real host/domain API**. It refuses a nonempty proof store and cannot target
the account database. Production imports neither it nor invented fixtures. Both release flags remain false; no screen,
Home entry, live bank preparation, migration, Spark retirement or private publication is performed in T111.

Synthetic IndexedDB tests cover enrollment/locks/transfers, reachable/Dark reservations, exact reload/JSON replay,
stale tabs, invalid/canceled/terminal input, five frozen-level awards added to current PL, zero-reward terminal receipts,
duplicate commit, actual CL nodes/SP/universals, wrong debt family, −7/gross12 boss and exchange splits, canonical
adjustment, foreign/missing/corrupt/future journals and acknowledged/lost-ACK/terminal-first takeover. Recovery checks
also pin missing/corrupt same-device restore, changed-input/unconfirmed acknowledgements, post-ACK unavailable art and
local archive/journal failure followed by same-owner retry. Failure injection
after each of five outfit writes, checkpoint, stock/bank, result/movement receipt, pending/outbox, journal/archive and
CL badge boundary proves all-or-none writes and post-durability scheduling. Initial invented host replay hash is
`7771941afcb8fc1e`; pure engine hashes/math and `sim:puzzles` envelopes are unchanged. No physical-phone or real-account
gameplay acceptance is claimed; T112–T116 remain, alongside pinned T109 real content.

T111 verification: lint/test/build pass (1,342 tests, including70 new real-host tests); `sim:puzzles` retains its288
engine and600 campaign battles plus86,016 exact economic routes. Spark and Friendship Training simulations also pass.
Startup entry is152.30 KB gzip (limit180); the lazy production host is10.74 KB and the existing Spark screen18.09 KB.
There is no changed screen to screenshot and no claim of authenticated production play or physical-iPhone acceptance.

The screen-facing host provides:

- read account/checkpoint/battle/result; enroll/correct element; save/transfer preset; equip unlocked kit;
- open chapter; begin or resume encounter; append action under expected count and epoch; commit terminal battle;
- spend CL materials; exchange adjacent materials; read debt/stock preview;
- request explicit takeover; resume protected cutover/recovery.

Each mutator has an operation id and exact payload identity. Same id/same payload returns the original receipt;
same id/different payload is a conflict. Read expected revisions **inside** the transaction. Persist projections,
evidence, pending operation and outbox marker in one Dexie transaction; update Zustand selectors and schedule ordinary
background sync only after success. A simulated failure at each write boundary leaves no partial EXP/item/CL/debt.

Battle settlement adds EXP to the five frozen entrants exactly once, then applies matching debt to one account reward
vector, writes node clear/next-attempt and completion facts, and records the result. An entrant's later progression
cannot replace the frozen level used to compute its award. Canonical acceptance applies that fixed award to current
progress; it does not overwrite another accepted win. No count/quantity is taken from UI text.

CL spending revalidates owned unlocked scenario, immutable source-A styles, current CL and every selected stack.
It increments one shared scenario field, preserves four presets and every unrelated scenario/build, records exact
inputs and projects actual nodes/SP. Legacy universal stock is selectable separately. CL10 overspend fails, not a
clamp-and-refund trick. Open racing inputs remain frozen. Completion badges use real existing fact reconciliation.

Exchange validates registry adjacency, account-wide higher-Opening-guardian unlock, same style, safe-integer batch,
positive input stock and matching output debt. Its preview is gross/repaid/net; debt intercept makes inverse exchange
lossy and must be confirmed. Migration credit is not new acquisition and bypasses repayment exactly once.

## 6. Local-first sync without economic last-write-wins

**Why an extension is required:** today's `/api/sync` resolves each entity independently and appends first-copy logs.
That cannot atomically preserve a CL spend, its inventory debit and debt repayment across two offline devices. An
append accepted while its stack conflicts is not a valid settlement. Never rely on `max(CL)`, `max(PL)` or `max(debt)`
to repair combined economic mutations.

T110 implements an optional, bounded **Puzzle operation group** in ordinary `/api/sync`, processed by the existing local-file
and Firestore repositories. This is background transport, not a new Sync/Submit screen or server call per drag.
Keep existing unrelated request shapes compatible. A group has an operation id/digest, typed semantic input,
dependencies/expected economic revisions and bounded replay-derived result evidence where relevant. The server
accepts **all** affected economic writes + receipt + ledgers, or **none**. Client-owned raw upserts cannot bypass it.
Read every referenced record before writes in Firestore; deduplicate read sets and bound total request bytes/documents.

Required operation families: enrollment/correction and party edits with open-battle locks; encounter reservation;
terminal settlement; CL spend; exchange. Preparation and explicit takeover use protected account operations, not
ordinary mutable bank upserts. Economic projections become receipt-owned; ordinary race/configuration updates must
preserve receipt-owned CL fields and cannot resurrect old training EXP after cutover. Field-level protection must
not reject harmless later racing wins or wipe presets.

The API independently validates ids, versions, frozen inputs, legal reward vector/EXP formula and monotonic debt;
its transport/settlement adapter is parity-tested against domain fixtures. The local host replays the journal. This
personal game's API need not stream or replay every pointer action, and no journal is silently synced. Do not claim
server-side anti-cheat verification that is not implemented.

Offline operations apply an optimistic local projection and queue ordered dependencies. On reconnect:

1. Accepted/idempotent groups return canonical receipts and affected rows. Adopt them and replay still-valid pending
   local operations in order; do not acknowledge a partially described response.
2. A stale spend/party mutation rejects as a whole. Rebase from canonical rows, keep rejected evidence and show a
   recovery message. Restore CL/stock/EXP consistently without dropping unrelated farming/racing/inspiration edits.
3. Two claims for one battle id/epoch pay once. Canonical result wins; a mismatching claim is visible recovery, not a
   second append id. Dependents of a rejected reservation/result do not sync as fresh independent rewards.
4. A result's canonical repayment may differ from its optimistic preview because another accepted acquisition moved
   debt. Replace gross/repaid/net together and explain the pending-to-synced adjustment; never re-debit initial debt.

Conflicting pending CL/configuration edits are retained for review, not silently deleted. Do not let a rejected CL
increase continue granting locked-node power. T110/T111 must test this rebase with actual Dexie rows and repository
responses. If protocol/size constraints cannot meet these invariants, report the gate before UI implementation;
do not substitute optimistic last-write-wins and call it safe.

## 7. Same-device restore and explicit second-device takeover

Reload with a valid local journal replays the same input/seed/actions; no new reservation, ordinal or charge.
Missing, malformed or unsupported journal on the owning device shows Restore/Retry diagnostics, never silent reset.
A synced open descriptor from another device is read-only until explicit takeover. The original journal never syncs.

Takeover is deliberately **online and acknowledged**: flush/resolve dependencies, then atomically compare the current
owner epoch, ensure no terminal receipt, increment epoch and name the new owner. Only then create an empty local
journal for the **same** frozen input/seed/battle reward identity. This narrow recovery step may wait online; normal
single-device battles, EXP and material operations do not. No mandatory acknowledgment after every battle.

A claim from the superseded epoch cannot settle, even if produced offline before the device learned about takeover.
The original device archives its journal and presents the canonical owner/result. Concurrent takeover/commit uses
one server transaction: whichever is accepted first determines whether restart is still available. Lost/reinstalled
local journals follow this same explicit restore-from-turn-zero protocol; do not reward disappearance with a new seed.

## 8. Cutover is one protected, resumable account operation

Before T116 the gate is off; before bank active no Puzzle reward/exchange/CL spend may settle. Preparation requires
current authoritative owned rows and resolved outgoing old Spark progress. Provide a dry-run summary and recoverable
pre-cutover snapshot via existing owner save tooling, without logging private rows or credentials in PR evidence.

Freeze once: existing owned outfit/scenario cohort, preserved CL, one eligible debt style per unit, catalogue version,
all unapplied unit EXP + account bank, existing universal stock, and retirement identities. Debt = CL−1 once per unit;
saved preferred source-A style first, else Front/Pace/Late/End first-A. Unknown source/row stops preparation visibly.

Use bounded resumable batches under an immutable cutover id. Each unit has an exact applied receipt; account final
legacy credit is issued only after all partial EXP is pooled. Full 1,250 chunks convert, final positive remainder
rounds once, at most one account ticket. Store the raw remainder/round-up fact for audit, not a spendable residual EXP
that will be converted again. Preserve existing universal stock; conversion is not a debt-paying reward.

Already-terminal/committed Spark results resolve before freeze. Unfinished paid runs close/refund original daily
Training Tickets once; completed histories remain. No result receives both uncommitted EXP and retirement refund.
Only after all preservation receipts and bank activation succeed does the client retire Spark entry and activate CL
material rules. API rejects old progress writes over this cutover; offline old clients get an explicit update/recovery
response on reconnect, not a silently adopted downgrade. New outfits/scenarios never join the frozen debt cohort.

## 9. Content, presentation and activation

**T109 code delivered (D272):** the [standing content contract](puzzle-content.md) documents reviewed source/evidence v1,
all392 node joins, independent alpha-safe256 px atlases, immutable full-hash pack/catalog retention, aggregate validation,
pre-publication checks and lazy bearer-authenticated `PuzzleContentLibrary.acquire()` leases. Frozen pure cast tokens are
`puzzles-<full-pack-sha256>`; T111 must store/re-acquire the exact version/hash, not the next active pack. `/puzzles/content`
is a read-only lazy preflight, not Home/playable entry. The owner deferred real PAD originals and approved labelled DEV
SVG placeholders so subsequent work can proceed. T109 remains for real inputs/import/private preview; T116 still gates release.

Code generates semantic maps/enemy recipes for every scenario. Private PAD packs contain only verified original
identity/art/source variants and the recipe-to-cast joins. Keep all original rows/art/caches ignored; small invented
fixtures only. Requested Fandom page access was robots-blocked: obtain permitted owner-supplied material or verified
alternative provenance, never bypass access restrictions or invent working image URLs.

Minimum real cast covers all five attack elements, regular mixed trios and stronger guardian/champion presentations
for a complete opening chapter. Every generated chapter must have valid cast joins; initial families may be reused
with authored semantic variants rather than require fourteen unverified imports. Real content/art hashes and retained
versions are verified before Home entry. Separate monster atlas from Uma/PriConne, retain open battle objects, no
gameplay-time hotlinks or original PAD stat/script import. Missing pack is a visible unavailable screen.

Gate predicate is **enabled code capability AND verified compatible content AND active account cutover**. Loading
an enabled app with an unprepared account offers preparation/retry, not a rewarded synthetic fallback. T116 changes
the code capability only after prior tasks, publication and API compatibility are ready. No environment/workflow
edits are required. A missing pack never silently forces migration; existing training stays available until readiness.

All routes lazy. Pixi owns board/pointer/effects; DOM owns readable HUD and controls. Five Uma/chibi presentation
joins are display-only; chibi versus plain orb changes no replay state. Fire orange-red, Water blue, Wood green,
Light ivory-gold, Dark violet, Heart pink, always glyph + accessible label. Shared shell safe areas once, ≥44 pt
controls, no fight page scroll, delta-time transform/opacity animation, background gesture cancellation, contextual
guide and isolated practice. Browser proofs and physical-iPhone tests are separately labelled.

## 10. Standing evidence

For every task update the implementation state here without claiming inactive code is live. Record fixed replay
hashes, simulator command/envelopes, exact parsers/versions and build sizes when they exist. T116 creates a durable
release acceptance record with production content/build ids, smoke results, migration summary and pending owner
device checks. The task folder is deleted as tasks merge; these contracts and the design remain the reference.
