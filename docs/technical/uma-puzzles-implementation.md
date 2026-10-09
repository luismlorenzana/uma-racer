# Uma Puzzles — implementation contract

**Status: T116 release enabled (D289–D290), with private owner-export cutout art (D292).**
T106–T115 supply the pure rules, additive saves, real replay host, mobile UI, materials and protected preservation.
T109's owner-export upgrade is complete; the same private content pipeline verifies both the active edited-derivative
pack and retained original-placeholder pack. No synthetic host or missing-art fallback enters production.
See [release acceptance](../research/uma-puzzles-release-acceptance.md) for publication, build/deployment witnesses
and the separately pending owner gameplay/iPhone checks.
Gameplay is [Uma Puzzles](../design/uma-puzzles.md) (D267).
M030 assigned T106–T116 (completed specs remain in git history). This page resolves ownership, transport and delivery boundaries
so downstream tasks do not each invent a different save or host. D268 records this engineering plan; numerical battle
and EXP candidates are settled by the small simulations and AGENTS pinning rule.

### T116 release and backup (D289–D290)

Both checked-in API/web capabilities are **true**. The gate still requires verified compatible content **and**
an active protected account bank; a query parameter cannot bypass it. Home offers the lazy campaign entry.
Profile/Training/Constellation use the shared CL sheet after preservation, and old Spark entries redirect with
an explanation. Off-capability paths remain explicitly tested. Earlier task subsections below record what was
delivered behind a disabled gate at that time; their off-state evidence is historical, not today's release state.

Before the first protected preparation mutation, `backup.ts` parses the canonical **whole-account** save and
captures old device-local minigame journals in the existing device-only `puzzleArchives` table, under
`puzzle-preservation-backup-v1`. Pending writes, identity changes, malformed snapshots and archive failures block
preparation without a freeze/refund. The capture is immutable across retries and recorded as pre-cutover or
already-preparing. Settings/Hub/recovery offer a private JSON download; another device does not pretend it owns
this archive. No automatic import or partial restore exists. Forward receipt recovery is the normal path;
an owner-authorized whole-account restore requires all devices quiescent. Never clear app data for recovery.

The original source discriminator is `original-placeholder`, referencing the checked-in original SVG generator,
not an alleged PAD export. All 15 members, alpha frames and 392 chapter joins validate through the unchanged
publisher/client. Both Dark champion reward variants remain covered. A real verified-content→host integration
resumes the identical journal offline, commits five EXP awards once, repays debt, reconciles authority,
and spends an earned material on actual CL nodes without touching another mode or preset.

Release scaling is [D290's table](../design/uma-puzzles.md#t116-release-scaling-and-small-sample-closure-d290):
ordinary HP6A/damage0.30H/open1, guardian32A/0.66H/open1, champion48A/0.58H/open2.
The countdown remains2. Replay input hashes change with these recipes (`dda881dc9f9aff8c` encounter,
`e7edcd59971f9921` initial host fixture); the historical T107 engine hashes/formulas remain unchanged.
640 campaign probes include no-active bosses and minimum HP, beside the unchanged288 engine battles and86,016
economic routes. Small counter-policy outliers and owner rewards/minute remain explicit acceptance limits.

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
70-module pure dependency closure into `apps/api/src/save/puzzle-domain/` (T115 adds preservation/save and old Spark replay validation). A test checks byte-for-byte parity. Edit
domain sources, regenerate, never hand-edit the adapter; no Docker, infra, dependency or source-TS runtime import change.

Authenticated `POST /api/puzzles/prepare` now parses T115's version2 request below; the earlier version1 scaffold
dispatches explicitly to version2 `advance`. The off capability returns `disabled` without database/content I/O. Authenticated
`POST /api/puzzles/takeover` parses `{schemaVersion:1,checkpointId,battleId,expectedEpoch,deviceId}`. It returns
`{status:'taken-over',checkpoint}`, `{status:'settled',result}` or `{status:'rejected',reason}`; the pure response parser
checks requested identity/owner. Taken-over increments epoch and changes only owner device/epoch/input hash, preserving
the exact cast, seed, battle and rewards. Settlement winning that race returns its result; superseded epochs reject.
T111 must additionally compare the returned input to its previously frozen descriptor, then archive/start the journal
only after acknowledgement. No timeout or disappearance silently grants a new board.

At T110 delivery API/web capabilities were **false**. No bank creation, training conversion, Home entry or Spark
retirement occurred in that task. T116's enabled state is above; production cannot enable it through a query/route.
The real replay host/journal is implemented below (T111); T109's owner-export inputs/private preview now verify (D292).

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
the account database. Production imports neither it nor invented fixtures. At T111 delivery both flags were false; no screen,
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
gameplay acceptance was claimed by T111. Later delivery and release evidence are recorded above.

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

Before bank active no Puzzle reward/exchange/CL spend may settle. Preparation requires
current authoritative owned rows and resolved outgoing old Spark progress. Provide a dry-run summary and recoverable
pre-cutover snapshot through the device-local T116 backup, without logging private rows or credentials in PR evidence.

Freeze once: existing owned outfit/scenario cohort, preserved CL, one eligible debt style per unit, catalogue version,
all unapplied unit EXP + account bank, existing universal stock, and retirement identities. Debt = CL−1 once per unit;
saved preferred source-A style first, else Front/Pace/Late/End first-A. Unknown source/row stops preparation visibly.
The frozen catalogue version is the verified Uma pack file's SHA-256 (D291): the importer's own pack version joins
source hashes with `+`, which is not id-safe, so the content address names the exact catalogue instead.

Use bounded resumable batches under an immutable cutover id. Each unit has an exact applied receipt; account final
legacy credit is issued only after all partial EXP is pooled. Full 1,250 chunks convert, final positive remainder
rounds once, at most one account ticket. Store the raw remainder/round-up fact for audit, not a spendable residual EXP
that will be converted again. Preserve existing universal stock; conversion is not a debt-paying reward.

Already-terminal/committed Spark results resolve before freeze. Unfinished paid runs close/refund original daily
Training Tickets once; completed histories remain. No result receives both uncommitted EXP and retirement refund.
Once the cohort freezes, conflicting Spark/EXP/universal writes pause; only after all preservation receipts and bank activation succeed does CL
material spending become available. API rejects old progress writes over this cutover; offline old clients get an explicit update/recovery
response on reconnect, not a silently adopted downgrade. New outfits/scenarios never join the frozen debt cohort.

### T115 implemented preservation v2 (D287)

**Delivered dormant in T115; activated by T116 only with verified content and backup.** `GameRuntime` lazily calls
`preparePuzzlesOnce` only behind the flag, after ordinary migrations/sync, RPG commands and Puzzle operations have
drained. It verifies the replacement pack and art, completes any supported terminal pending local Spark through the
old replay host, then drains its writes before freezing. The cheap startup store/panel exposes unavailable,
needs-sync, preparing (including read-only preview), active and recoverable-error; Retry never clears storage.
Racing/configuration, Farm, RPG, Friendship and global card stars remain independent.

**Explicit storage adaptation:** live/pre-cutover Uma/profile creation remains save15; the protected transaction
stamps preserved Uma/profile rows **save16**. The existing `trainingLevel` field stores CL1–10; `trainingExp` and
`trainingExpBank` remain required retired fields and must be exactly zero in16. This is a rejecting version dispatcher,
not dual-name aliases or an automatic local migration. New owned outfits inherit the profile stamp; future units
created during preparation are excluded from debt and stamped16 once active. Four distance presets, Inspiration,
Extra stats, sets, assignments, loadouts, race defaults, racing EXP/history, badges/flair, cards, Farm and RPG are kept.
Dexie **31** adds only `puzzlePreservation:id`; existing main's RPG29/30 migrations are neither changed nor repeated.

Protected requests are exact `{schemaVersion:2,cutoverId,expectedBankRevision,action:'preview'|'advance'}`.
The cutover identity must fit the standard save-id bound **with** its derived `puzzle-preservation:` ledger prefix;
request and stored-header parsers refuse an overflow before freeze, not during final credit.
Responses contain `status`, nullable `message`, nullable aggregate `summary`, canonical `entities` and `logs`.
Summary reports units/completed, per-material debt, raw unapplied EXP, original stock, credited universals and stock after.
Client adoption accepts only preservation-owned rows/logs and merges canonical CL/EXP/schema into concurrent physical
Uma configuration/racing edits. No client-authored cohort, source grades, EXP total or refund amount is accepted.
Lost freeze, batch or final replies reconcile preservation-owned fields from a parsed canonical save read, never the
initial full-snapshot replacement that could erase unrelated local work. Future zero-EXP outfits are stamped16 and
queued in the same adoption transaction, outside the debt cohort. While a reply is uncertain, legacy training remains
locked until Retry reconciles the receipt; capability-off play is unchanged.

`constellationBank/main` uses explicit **schema2/cutoverVersion2**; prior schema1 synthetic/protocol records remain
readable. Version2 can be preparing with all units complete (including an empty cohort): finalization is separate.
`puzzlePreservation/main` is an immutable-identity schema1 header with catalogue/full replacement hash, frozen
profile/stock versions and amounts, counts/cursor, transferred EXP and nullable final credit receipt. Immutable
`page-<index>` rows hold the exact original outfit/scenario/tier, Uma version, CL, partial EXP, preference, original
source and chosen debt style. Existing `puzzleCohort` rows remain the completed per-unit receipts, including zero debits.

Freeze reads authoritative migrated save15 owned rows. Source-A preference is `racePreferences.strategy`; without
an eligible preference choose Front/Pace/Late/End's first original A, once per unit, never per preset or per A grade.
Missing source/scenario, malformed rows and unsafe arithmetic stop without writes. Freeze writes bank/header/pages
atomically. Batches of **16 units** clear only their unapplied EXP and create CL−1 debt/receipts once; retries with an
old bank revision return canonical state without advancing. Frozen sources are never reread to choose new debts.
Every retry verifies the **retained frozen Puzzle content hash**, not a newly active pack; missing retention needs
content repair. Source catalogue changes do not resnapshot the cohort.

Transport preflight is **4,096 units, 32 units/page, 256KiB/record and 8MiB/freeze**, below Firestore document,
transaction and write-count limits (at most130 freeze writes). These are refusal-with-recovery transport ceilings,
not gameplay caps: a larger future account requires a reviewed segmented protocol, never truncation or an invented
cohort. Firestore reads before writes and retries the same pure reducer; local-file calls serialize and atomic-rename.
Failure before commit installs none of that step. Partial completion is forward-resumable, not rolled back locally.

Finalization checks all frozen unit EXP was transferred, and account bank/original universal stack still match.
It adds `floor(rawExp/1250)` plus one iff the final account remainder is positive, **once for the account**, on top
of untouched old universal stock. Profile bank clearing, item credit, bank activation and final receipt are atomic.
The stable item movement is `puzzle-preservation:<cutoverId>`, old `exp-bank`/`bank-settle` vocabulary retained for
historical parsing. No remaining spendable EXP survives; earlier converted overflow evidence is not counted again.
Receipt retains raw EXP, remainder, whole tickets, compensation0/1, credited count and stock after, even for zero.

**Legacy Spark:** protected `POST /api/puzzles/legacy-spark` parses schema1 `{disposition:'committed'|'unfinished',
localDay,run}`. `run` contains original canonical id/outfit/tier/attempt, save-derived seed, frozen version1 encounter
and `spark-rival-v1` action journal. Pure parser/replay distinguishes terminal from unfinished. Paid ledger evidence
determines the actual original cost (including pre-denomination5/10), never today's price. One protected
`spark:<hash(runId)>` receipt retains the full proof and compares identities to detect a collision or changed seed.
An unfinished refund uses existing **`<runId>:refund` / `minigame-refund`** evidence, returns original daily tickets
even above60 (D177), and atomically closes the device row only after acknowledgement. Valid existing refund evidence
is adopted without paying again. A committed receipt blocks a refund; a refunded receipt blocks terminal EXP.
Finished histories, outcomes and journals stay; malformed/unsupported rows need explicit recovery, not deletion.

Old Spark journals are **device-local**. Before enabling/freeze, the owner must reconnect/update every known device
and resolve terminal pending runs; the server cannot discover an unknown remote journal. An unfinished remote run
can later retire against its same receipt. A previously unknown terminal journal after freeze is kept with an explicit
**owner-assisted forward recovery** message, never guessed into EXP or a refund. This limitation is not an automatic
cross-device completion guarantee. A lost acknowledgement retries its stable identity; reopening local storage or
adopting a complete authoritative snapshot resumes receipts rather than minting another cohort.

While preparing, the server locks old Spark reservations/EXP/TL and universal stock/ledger writes, but accepts valid
protocol1 unrelated racing/configuration. Active bank2 requires save16/zero retired EXP on ordinary Uma/profile
writes; cached old clients get **Update required**, never a schema downgrade. Canonical receipt-owned CL is preserved
on new racing writes. Updated Spark entry checks bank before mounting the old screen and redirects to Hub with an
explanation; active Profile/Training/Constellation use CL and the shared material sheet. Historical engine/parser
dispatch remains lazy for retirement/restoration, and old completed results stay readable. Friendship is not retired.

### Synthetic rehearsal and recovery

Run `pnpm sim:puzzles:preservation`: it creates40 invented units in memory, prints aggregate debt/EXP/stock/refunds,
interrupts a batch, retries the same revision, finalizes once and restores synthetic pre-freeze/post-final snapshots.
It never reads owner saves or content. Repository tests repeat backup/restore with a temporary JSON file and strict
Firestore fake, including failed atomic freeze/batch/refund writes. Startup tests cover local reopening, malformed
acknowledgements/journals, concurrent racing/configuration and terminal-before-freeze ordering.

For an **owner-run rehearsal**, use only a disposable synthetic account/file or the in-memory command above:

1. With the capability off, retain a synthetic pre-freeze snapshot of **all entities and logs**, not just Uma rows.
2. Inject verified invented content into the test adapter, preview aggregates, then freeze once; retain the header,
   pages and cohort receipts with the backup. Interrupt after a batch and retry; original pages must not change.
3. Finish separately and retain a post-finalization snapshot; verify pooled remainder, stock after and stable ledger id.
4. Restore the synthetic pre-freeze snapshot **as a whole** in the disposable adapter: preview must match. Restore the
   post-finalization snapshot: Retry must make zero new credits. The tests automate both paths.
5. T115 itself performed no real-account mutation. T116's first updated online sync captures a whole-account backup
   before protected mutation as described above. Never put private rows in git, screenshots or logs.

Recovery: reconnect/drain pending sync; restore missing retained content; Retry a failed/lost step with the same id;
retain malformed rows for repair. An outdated device must update, retain its journal and reconcile canonical state
before edits; do not force-upload stale progression. Do not clear IndexedDB. Once debt/credit mutated, reverting the
frontend is **not a safe rollback**. Use forward recovery from receipts, or an explicitly owner-authorized whole-account
restore with all devices quiescent through existing tooling. Partial field restore can duplicate credit and is forbidden.
Browser proofs at390×844/375×667 are [recorded separately](../research/puzzle-preservation-phone-proof.md);
they do not claim production activation, real private pack acceptance or physical-iPhone sign-off.

## 9. Content, presentation and activation

**T109 complete (D272, D292):** the [standing content contract](puzzle-content.md) documents reviewed source/evidence v1,
all392 node joins, independent alpha-safe256 px atlases, immutable full-hash pack/catalog retention, aggregate validation,
pre-publication checks and lazy bearer-authenticated `PuzzleContentLibrary.acquire()` leases. Frozen pure cast tokens are
`puzzles-<full-pack-sha256>`; T111 must store/re-acquire the exact version/hash, not the next active pack. `/puzzles/content`
is a read-only lazy preflight, not Home/playable entry. Following D289's original-placeholder release, twenty owner
exports are retained privately and seventeen transparent AI-edited derivatives now cover all fourteen chapters;
three rejected optional forms are excluded. Exact derivative provenance and private previews are retained, with
aggregate [art acceptance](../research/puzzle-art-release-acceptance.md). Open fights keep their original pack/art.

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

### T112 implemented setup navigation (D275)

All campaign setup routes are lazy children of `PuzzleShell` under `/puzzles`: Hub (index), `roster`,
`roster/:outfitId`, `party/:partyId`, `chapters`, `party/:partyId/:scenarioId`, `exchange`, `items`.
The shell checks the off capability **before** mounting a component that can construct a host/read an account/acquire
content. Enabled entry additionally needs a persistent loaded game, active bank and verified presentation lease.
There is no Home launch yet; T113 supplies fight/result routes and T114 finishes the honest Exchange/Items destinations.
T113 replaces the original T112 DEV-only no-reservation notice with real host Begin under the existing parent gate.
No guessed route enables a bank,
creates a fight, retires Spark or changes release flags. Existing `/puzzles/content` remains read-only.

`PuzzleContext` owns a per-provider Zustand store subscribed through `liveQuery(host.account)`, separate from other
modes and the future board's per-pointer state. Equal parsed account reads publish nothing; journal appends do not
change the account projection. All edits call the T111 port, with an operation UUID retained for retry of the same
input/revision, a synchronous double-press guard and visible failure. The UI never writes gameplay Dexie rows.
`presentation.ts` supplies pure owned-roster/palette/picker/party/map/reward projections. Partial-party totals mirror
the engine's catalogue leader rule without fabricating a full battle input. Foreground is parsed from canonical
`pzc:<scenario>`, not treated as a raw scenario id. `navigation.ts` stores only selected party/chapter and independent
per-map viewed-node ids, validates each restored id and tolerates inaccessible/malformed localStorage. It stores no
seed/reward/release setting and never substitutes for synced checkpoints.

Roster/detail/enrollment, ordered party edits/slot 1 leader and confirmed moves, all 14 chapter launch bands and 28-node
maps follow [design §9](../design/uma-puzzles.md#9-screens-guides-and-visual-identity). Transfers keep both captured
revisions until confirmation; the port checks both plus open locks. Source becomes empty, destination receives its
kit and both keep checkpoints. An unsaved empty destination is explicitly saved before presenting a picker, so no
fabricated revision-zero transfer occurs. A moved or edited confirmation is rejected, not silently refreshed.

`PuzzleNodePreview` resolves the actual campaign recipe with a held verified pack. Its enemy portrait joins the
pack's name/frame/page by frozen cast id; absence is unavailable, never a production placeholder. Acquires release
on close/cancel/unmount, including late asynchronous completion. Existing open fights instead load through
`host.loadBattle`, retain their immutable identity and display their frozen enemies/rewards. Typed recovery remains
read-only; explicit takeover calls T111's online acknowledgement lane, then reloads the same frozen input/seed under
the new epoch. Missing pack/coverage has Retry/Return. Dark Champion starts unselected and cannot expose a concrete
reward vector until Pace/Late is chosen; open choice is frozen. Gross/repayment/net reads the current bank but states
that canonical settlement can adjust net. First higher Opening win explains its adjacent exchange edge.

Shared `MinigameShell/Header`, `PagedGuide`, `createGuideMemory`, Button, AtlasSprite, icons and focus/inert isolation
are reused. Setup has internal scroll and five-across 44 pt targets at 390×844/375×667; no new global tabs. Element
glyphs are original SVG (flame/drop/leaf/star/moon), accompanied by semantic orange-red/blue/green/ivory/violet colour
tokens and accessible names. Motion uses existing `m.*` press/guide transforms/opacity. T113 extends the same shell
with battle input, illustrated pages and account-free practice below.

`/dev/puzzles-ui-proof` shares these components via a different provider and **never** production boot. `main.tsx`
excludes AuthProvider/ContentProvider/GameProvider/service-worker registration for this DEV root and every nested
refresh. The proof adapter accepts only `puzzle-proof-*` database names, seeds an empty store through T111's isolated
adapter, retains its real local operations/journals across refresh and uses invented sources/portraits/enemies plus
an in-memory authority for explicit recovery. Reload authority restores pending canonical bases, not optimistic
projections, before adoption. Its local EXP/materials never touch the owner database/API. The proof is tree-shaken
from production. [Browser evidence](../research/puzzle-navigation-phone-proof.md) is synthetic, not private-content,
production gameplay or physical-iPhone acceptance. Later release evidence is recorded separately above.

### T113 implemented mobile battle (D276)

`battle/:battleId` is a lazy child of the same gated shell. Map Begin passes captured party/checkpoint revisions and
Dark reward choice to the real host, retains the operation id for retry, then releases the returned presentation
lease and navigates to the canonical battle id. Resume never reserves. `PuzzleBattleSession` reloads/replays before
unlocking and synchronously locks during append, animation and commit. Accepted actions are durable **before** scene
playback; terminal claims contain only battle id, owner epoch, count and state hash. Rejection reloads authority and
keeps input locked for Retry/Return. Queued background restores replay before unlock. Disposal releases held or late
leases; an accepted action interrupted by navigation is retained for the next resume, never undone by rendering.

`PuzzleBattleStage` shares real fight/practice presentation. DOM owns header/HP/foe targets/intent sheets, five portrait
active previews/explicit confirm, legend, preference and live region. `scenes/puzzles/load.ts` lazily imports Pixi.
`PuzzleBattleScene` owns 30 board tokens, 36 particles and eight text labels, decoded texture lifetime, monster
reactions and delta-time event playback. Verified retained pack frames supply monsters; only isolated proof uses
original invented graphics. Held private chibi art joins by frozen entrant colour, display-only; Heart stays distinct.
Plain/chibi and reduced motion never become an engine action or affect RNG.

Only `cellAtPoint` geometry is shared with Spark. Puzzles keeps domain's diagonal-first skipped-cell interpolation;
Spark keeps its old traversal/controller. One pointer is captured, second fingers ignored, revisits permitted and
first valid swap starts the monotonic seven-second clock. Late samples cannot extend an expired path; release/expiry
submits at most once within domain bounds. Capture loss, pointercancel, hidden tab, viewport/rotation, guide and
navigation discard an unaccepted gesture. Landscape blocks safely; resume replays before enabling. Native-event and
pure-controller tests pin invented drag hash `f8e3005a8dc47b16`; Spark before/after simulation output is byte-identical.

`PuzzleResultScreen` reads the receipt's five grants, before/after PL and carried EXP, derived stat changes and
catalogue unlocks, plus each material's gross/repaid/net. Pending versus canonical is visible; adoption re-reads the
saved receipt. Replay starts a new revision-checked attempt only after settlement, without auto-CL spend.
`PuzzleResultView.summary` is optional **device-only presentation**, not a new synced/save field: the host strictly
parses retained live/archive journal, checks input hash/epoch/count/terminal hash and replays it for combos/damage.
A different device without compatible local detail keeps exact rewards and says that combat detail is unavailable.

The eight-page illustrated `PagedGuide` uses resilient `createGuideMemory` v2 and domain numbers/catalogue. First setup
opens it once; battle opens drag context immediately. `/puzzles/practice` lives outside the account shell and bypasses
AuthProvider/ContentProvider/GameProvider/service-worker boot, but its own entry checks the off release capability.
When enabled it creates standalone invented pure input and uses the real stage/engine, no host/auth/Dexie/rewards.
Links crossing practice/account boot use full document navigation so the provider tree is recreated, not retained.
DEV `/dev/puzzles-practice` and `/dev/puzzles-battle-proof/:case` are tree-shaken; the latter shares the real host against
separate `puzzle-proof-t113-*` databases and synthetic authority. Pending receipts remain resumable on proof refresh.

[Phone browser evidence](../research/puzzle-battle-phone-proof.md) records both viewport sizes, saved win/debt/loss,
guide/active/phase/legend, pooling/drag profile and lazy chunk sizes. This is synthetic browser proof, not PAD source
acceptance, owner-account validation, production playability or iPhone60/120Hz/low-power sign-off. Both release flags,
save/schema/API/engine constants and startup cap are unchanged; T114 adds the material surfaces below.

### T114 implemented material surfaces (D283)

`game/items/view.ts` extends the existing global inventory join with a registry-driven `constellation` catalogue:
currently56 definitions, registry then Front/Pace/Late/End order, Owned positive stacks, All zeroes, intersecting
scenario/style facets and safe read-only orphan details. `ui/ConstellationMaterials` is shared by Farm Global Items
and the campaign's Items shortcut; there is no second stock table. Details separate matching nonpositive bank
balance from stock and link to earning chapters, adjacent exchange and eligible owned/unlocked racing recipients.
The Hub uses the same bank panel. Original SVG star-punched tickets reuse the race-position glyph, inset scenario
crest and accessible names; dark/light/grayscale phone proof covers24/32/48/64px treatments. Ticket styles are not
the combat element legend, and the single Wood-green rule remains unchanged.

`PuzzleExchangeScreen` selects one adjacent registry edge and one original style; a positive safe-integer batch
consumes one higher or two lower tickets. The higher Opening guardian must have an accepted account-wide clear.
Both directions use `previewExchange`/`confirmMaterial`, showing gross, debt repaid, net, after-stock and bank.
Intercepted output requires an explicit irreversible acknowledgement. No same-scenario style swap or skipped edge
is offered; invalid/insufficient/unsafe input disables confirmation. Changed revision/stock requires explicit
refresh/reconfirmation. Operation ids survive uncertain acknowledgement so an exact retry reads its own receipt.

`ui/puzzles/ClSpendSheet` is the **one** shared host-backed spend UI for Profile, Training and Constellation.
The thin lazy adapter checks the release capability before host/content/bank I/O and requires an active preserved
bank before replacing existing TL/Spark intent. Original literal-A scenario/style stocks plus separate preserved
universals build one explicit mixed spend vector, bounded to `10 − CL`. Ineligible tickets stay inspectable with
their reason. Actual `nodesUnlockedBetween` ids/labels, crossed levels, selected-preset stat/SP deltas and the
correct tier/node constellation links come from host previews/receipts. CL9/10 show SP-only; CL10 cannot overspend
or mint back EXP. Card sets, all four presets, lineage, Inspiration, Extra stats and global stars are never edited.
Confirmation is a fixed44pt+ safe-area thumb footer, with scrollable details above it.

The read-only account port additionally exposes validated racing units and durable material-operation statuses,
not a new save field. The same transaction revalidates ownership/source/scenario/revision/stock; no screen writes
Dexie. Local pending projections are clearly labelled; canonical rejection replaces predicted CL/exchange success
with a review state and current CL/stock/debt, removes unearned power and retains configuration. Irreversible completion facts
continue to use T111's accepted-only reconciliation. Retrying an uncertain CL9→10 acknowledgement keeps the same
operation id even at locally projected CL10. Exchange stock/bank result fields are parsed before display.

The DEV-only `puzzle-proof-t114-ui-v1` account contains invented stock/debt/CL9 examples. It now supplies verified
synthetic template content to the real host's stat/SP projection. `/dev/puzzles-material-icons` is an original-vector
proof with no account/content I/O. [Phone evidence](../research/puzzle-material-phone-proof.md) and real isolated-Dexie
tests cover battle→repayment→Items→exchange→CL, both exchange directions/interception, exact retries, stale economics,
preserved configuration/frozen inputs and rejected canonical CL. At T114 delivery both flags were off; no live bank, credit,
Training EXP conversion, Home launch, Spark retirement, private pack publication or physical-iPhone sign-off occurs
in that task. The later T116 release and completed owner-export art upgrade are recorded above.

## 10. Standing evidence

For every task update the implementation state here without claiming inactive code is live. Record fixed replay
hashes, simulator command/envelopes, exact parsers/versions and build sizes when they exist. T116's durable
[release acceptance record](../research/uma-puzzles-release-acceptance.md) carries content/build witnesses, migration/recovery notes and pending owner
device checks. The task folder is deleted as tasks merge; these contracts and the design remain the reference.
