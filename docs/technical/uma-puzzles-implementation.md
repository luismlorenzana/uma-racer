# Uma Puzzles — implementation contract

**Status: T106–T107 pure foundations/battle v1 implemented (D269–D270); runtime/content/cutover planned, not enabled.**
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
these rules from an app yet. Modules have no I/O, clocks, unseeded randomness, rendering or save imports:

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
No app currently calls them. These are independent of Spark utilities; there is no shared-board replay change.

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
records unmet balance targets rather than claiming these fixtures validate production scaling. T108 extends it.

`PuzzleBattleResultV1` contains only engine version, battle/epoch identity, action count, hash, terminal outcome/
reason, accepted drags and ending HP. EXP/material claims are absent. The eventual commit checks journal identity
and derives rewards itself. No save/API/Dexie/host/private content/rendering/publication is part of T107.

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

These names describe semantic ownership; T110 must publish the exact parsers/field interfaces with no unused fields.

| Record | Identity / minimum fields | Sync |
|---|---|---|
| `puzzleOutfits` | outfit id; frozen enrollment; lifetime PL/remaining EXP; selected kit; first-entry fact; projection revision | Yes |
| `puzzlePresets` | five stable party ids; name; ordered five nullable outfit slots; slot loadouts; slot-1 leader passive; foreground chapter; revision | Yes |
| `puzzleCheckpoints` | party/scenario; reached/cleared nodes; first-clear facts; per-node next attempt; open encounter descriptor; revision | Yes |
| `puzzleResults` | one terminal receipt per battle id; input/hash/epoch identity; outcome; five exact EXP deltas; gross/repaid/net vector | Append-only |
| `puzzleOperations` | operation id + payload digest; typed operation; dependency ids; expected economic revision; resolved receipt/status | Append-only canonical receipts |
| `constellationBank` | account; preparing/active; immutable cohort/debit receipt; nonpositive scenario/style balances; cutover version/revision | Yes, protected creation |
| `puzzleJournals` | battle id/owner epoch; frozen input/version; bounded actions; prior count/hash; origin device | **Device-only** |
| local pending operations | ordered operation payloads + optimistic projection rollback/rebase metadata | Device-only queue |
| local archives/preferences | displaced journals; guide memory; chibi/plain-orb preference; last local view | Device-only |

Do not duplicate global item stacks in a puzzle inventory. New acquisitions/spends use `items` + `itemLedger` with
bounded source unions; gross grant evidence includes repayment. Positive stock never includes negative bank balances.
The bank's frozen cohort may need multiple bounded records if it cannot fit Firestore's document limit; the API must
refuse oversized work before writing, not discover a production limit after half the account changed.

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

T110 adds an optional, bounded **Puzzle operation group** to ordinary `/api/sync`, processed by the existing local-file
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
