# T012 — Scenario promotion and save-v2 foundation (Milestone 5, part 1)

**Goal:** make scenario gates playable end to end. A gate-ready Uma can spend the documented Training Ticket cost, freeze
her completed-scenario parent snapshot, enter the next tier with the correct overflow, bonuses, resets, awakening skill,
and card era, and continue the Train → Race loop. This task also introduces the typed save-v2 foundation used by the
inheritance and goal tasks. T012 starts every promoted scenario with zero parents; zero-parent starts are a permanent
supported choice, not temporary data.

Depends on: `T011-select-coupons-and-collection.md`.

Read first: `AGENTS.md`, `docs/design/uma-progression.md`, `docs/design/scenarios.md`,
`docs/design/skills-and-inheritance.md`, `docs/design/support-cards.md`, `docs/design/economy.md`,
`docs/design/ux.md` §§Uma Profile/Scenario Start, `docs/technical/architecture.md` §1 and save model,
`docs/decisions.md`, T003, T005, T009, T010, and T011.

## Scope and fixed choices

- A current non-final tier is ready to promote as soon as its gate level is reached. It does **not** require a second full
  EXP bar. EXP already stored on the gate-level Uma is race-earned overflow toward the level after the next scenario's
  starting level; it remains capped at one level's requirement.
- Promotion costs `25 × fromTier` tickets. The mandatory gate → gate+1 transition itself pays no level-up tickets because
  it is bought by promotion, not earned by race EXP. If a completely full overflow bank immediately advances gate+1 →
  gate+2, that race-earned level pays the normal +5 tickets with the existing deterministic level ledger id.
- Promotion is one commit. Before confirmation, the full-screen Scenario Start route is only a draft/review and Back
  writes nothing. On confirmation it captures the old snapshot, spends tickets, applies the old deck's Initial Stats,
  moves the level, refreshes skills, resets Training Level/training progress, starts the new scenario with zero parents,
  and queues sync atomically.
- Stats and Skill Points carry forward. Add the documented +10 to each stat, then add each equipped card's generated
  `initialStats` value to that card type. Round each card's projected value to the nearest integer before summing; these
  start bonuses are not constrained by the new TL1 cap. The deck itself remains equipped and becomes eligible under the
  wider new-era rule.
- Training Level becomes 1, Training EXP and `trainingsThisScenario` become 0, and racing locks until the opening Training
  turn. The refreshed library contains the own unique plus every already-unlocked awakening skill. The old paid loadout is
  intersected with that refreshed library; removed skills cannot remain equipped.
- Completing tiers 1, 2, 3, and 4 unlocks `awakeningSkillIds[0]`, `[1]`, `[2]`, and `[3]` respectively. Missing positions
  unlock nothing; malformed or duplicate references are content errors. Once unlocked, awakening skills are permanent.
- A parent snapshot is captured from the **pre-refresh** completed scenario. It includes direct card-learned whites and the
  normal white counterpart of direct card-learned golds, never inherited or awakening skills. T012 snapshots have no
  parents; T013 fills and consumes the same contracts without another schema bump.
- When an Uma reaches the highest currently available level, the completing race captures the final-tier snapshot in the
  same race transaction at no ticket cost. It happens once. If a later app version adds another scenario, normal promotion
  replaces that snapshot from the then-current completed tier.
- Save v2 is a one-way, lossless migration. Existing v1 Umas are treated as already inside their current scenario with no
  parents; they are never forced through a retroactive start screen. No parent, goal, badge, or completion is invented.
- Static names, art, release facts, skill definitions, and other original-game data remain in private content only. This
  task adds a normalized skill relationship but no source row, id, name, value, pack, or cache to git.
- Keep the startup chunk at or below 180 KB gzip. Reuse the existing lazy routes, UI kit, Motion, and generated card-effect
  projection; add no dependency.

## Deliverables

### 1. Save-v2 contracts and one-way migration

Bump `SAVE_SCHEMA_VERSION` to 2 and add `schemaVersion: 2` to every `UmaSave`. Keep cards unchanged. Define and strictly
parse the following concepts in `@racer/domain` (exact property names may follow surrounding code, but not the semantics):

```ts
interface SkillHistoryEntry extends SkillUnlock {
  tier: number
}

interface FrozenParent {
  umaId: string
  charaId: string
  completedTier: number
  takenAt: number
  inheritedUniqueSkillId: string | null
  inheritableWhiteSkillIds: string[]
  aptitudes: Aptitudes
}

interface ParentSnapshot extends FrozenParent {
  parents: FrozenParent[]             // 0–2; one frozen level only
}

type GoalSlot = 'aptitude' | 'identity' | 'challenge'
type GoalStatus = 'active' | 'completed' | 'missed'

interface ScenarioGoal {
  id: string                          // goal:<tier>:<slot>
  slot: GoalSlot
  raceId: string
  kind: 'win' | 'win-by-margin'
  minimumMarginLengths: number
  status: GoalStatus
  completedRaceResultId: string | null
  completedAt: number | null
}

interface ScenarioJourney {
  tier: number
  tracking: 'tracked' | 'legacy-untracked'
  state: 'active' | 'completed'
  completedAt: number | null
  goals: ScenarioGoal[]
}
```

Extend `UmaSave` with `scenarioStarted`, `skillHistory`, `currentParents`, `parentSnapshot`, `goalPlanVersion`, and
`scenarioJourneys`. Enforce unique tier+skill ids, parent identities, journey tiers, and goal ids; bounded parent counts;
finite timestamps; valid grades/tiers/status combinations; exactly three distinct slots for a tracked journey; no goals
for a legacy-untracked journey; and at most one active journey. `goalPlanVersion: 0` and an empty journey list are the
explicit pre-T014 state, not untyped placeholders.

- A new T012 Uma has `scenarioStarted: true`, current library entries copied into tier-1 `skillHistory`, no parents or
  snapshot, goal plan version 0, and no journeys. T013 changes only the new-Uma start behavior.
- Migrate every v1 Uma by adding schema 2, `scenarioStarted: true`, a history entry for each current library skill at the
  derived current tier, empty parents/journeys, null snapshot, and goal plan version 0. Preserve every existing mutable
  field, server version, log, and outbox row.
- Add a Dexie v3 upgrade for local rows and equivalent content-ready migration for v1 cloud bootstraps/conflicts. Queue the
  upgraded profile and changed Uma entities with their preserved base versions. Migration and queueing are one local
  transaction and are idempotent after interruption/reload.
- During rollout, API boundary parsers can read stored v1 and v2 shapes and accept the one-way v2 replacement. They must
  never accept a v1 Uma/profile write over an existing v2 entity. New clients write only v2; unknown future versions still
  produce “app update required” rather than reset.
- Update every constructor, synthetic fixture, coordinator adoption path, Zustand selector, sync conflict path, and strict
  API parser. A mixed/corrupt snapshot fails explicitly; no field is silently defaulted outside the defined v1→v2 migration.

### 2. Private skill-family normalization and snapshot derivation

- Extend `SkillTemplate` with `normalSkillId: string | null`. In the GameTora normalizer, a gold skill selects the first
  source `versions` reference, in source order, that resolves to a retained rarity-1 skill; other kinds use null. Missing
  counterparts remain null and produce aggregate importer diagnostics. Keep only the normalized id in private packs.
- Strictly validate that a non-null counterpart exists, is a white skill, and is not self-referential before promotion or
  inheritance code consumes it. Synthetic importer/domain tests cover one/multiple/no counterpart and malformed links.
- Add a pure snapshot builder. Direct card-origin white skills pass as themselves; direct card-origin gold skills pass as
  their `normalSkillId`; all other kinds/origins are excluded. Dedupe and id-sort the result. Resolve the own unique's
  `inheritedSkillId` into the frozen inherited-unique id, or null when the Uma has no valid inherited version.
- Snapshot top-level identity and aptitude values are copied, not referenced. `parents` is built only from each selected
  current parent's top-level frozen contribution, so a saved snapshot is finite and never nests recursively.
- A missing current library or template reference blocks snapshot creation and promotion with an explicit content error;
  it never silently drops a skill from what the Uma can pass down.

### 3. Pure promotion and completion rules

- Add a pure promotion readiness/projection/result API shared by Profile, Stable, Home, and the commit path. Validate
  schema, gate/final tier, next scenario, ticket balance, EXP bank, deck/content, skill relationships, timestamps, and the
  zero-parent T012 selection.
- Return the exact cost, old/new scenario, snapshot, stat/Initial Stats deltas, refreshed library/loadout, awakening unlock,
  new level/EXP, any overflow-created level reward, and deterministic ledger descriptors.
- Capture the completed-tier snapshot before clearing the library. Add refreshed own/awakening entries to skill history at
  the new tier without duplicating a tier+skill pair. Preserve all old history.
- Promotion changes gate level `G` to `G + 1` and carries the bank as EXP toward the following level. When the bank equals
  `expToNext(G + 1)`, normalize immediately to `G + 2`, EXP 0, and one normal +5 level reward. No other multi-level advance
  is possible because the bank is capped at one level.
- Reuse `projectCardEffects` for Initial Stats so Card detail and promotion cannot disagree. Validate the pre-promotion deck
  through the existing shared deck validator and reject missing/corrupt equipped rows rather than partially applying cards.
- Add a pure/idempotent final-tier completion helper invoked by progression-race completion when the Uma first reaches the
  current global max. It captures the snapshot and history state but creates no promotion spend, bonus, reset, or new tier.
- Update the design docs and append a decision row for gate readiness/overflow, awakening order, Initial Stats rounding,
  final-tier completion, and the one-way save-v2 shape. Add every new numeric/curve choice to the domain pinning test.

### 4. Atomic local-first promotion

- Add `promoteUma(umaId, now)` through the lazy action/runtime layer. Re-read and strictly parse the profile, Uma, selected
  deck cards, private content, and relevant ledger rows inside the transaction. Use a per-Uma promotion lock.
- In one Dexie transaction update the profile and Uma, append `uma-promotion:<umaId>:<fromTier>` for the ticket spend,
  append any `uma-level-tickets:<umaId>:<overflowLevel>` reward, and coalesce profile/Uma outbox rows plus append logs.
  Publish Zustand only after commit, then refresh/schedule normal background sync.
- Matching ledger plus matching post-state is an idempotent success. A reused id with different data/state is corruption.
  Insufficient tickets, stale level/EXP/deck/content, already-promoted state, final tier, storage failure, and double tap write
  nothing. Memory-only mode runs the same pure result with the existing explicit non-persistent warning.
- Extend progression-race completion so the first current-max result captures the final snapshot in its existing atomic
  transaction. A retry returns the same result and does not recapture with a later timestamp.
- Server sync remains shape validation, not game-rule authority. No new endpoint is required.

### 5. Promotion and baseline Scenario Start UX

- Enable Promote on Home/Profile/Stable only for a ready non-final gate. Training, Race Select, pre-race, and result CTAs
  route a gated Uma to Promote instead of leaving a dead end. Max-tier completion has an explicit “Latest scenario complete”
  state with no false promotion action.
- Add a lazy full-screen `/scenario/:umaId/start` flow. In T012 it reviews the completed snapshot, cost/balance, overflow,
  five +10 promotion bonuses, per-card Initial Stats, awakening unlock, TL reset, skill refresh, new cap/era, and the explicit
  “Start without parents” choice. T013 expands this route rather than replacing its commit contract.
- Confirmation disables while committing and retains a retryable review on failure. Success uses a scenario title card,
  stat/skill summary, and Training CTA. Reload/back after commit reconstructs state from the save/ledger and cannot spend
  twice. Use Motion `m.*`, transforms/opacity only, a short reduced-motion path, safe areas, and ≥44 pt controls.
- Profile's Journey remains honest: existing minimal tiers plus “Goals arrive in T014”; do not fabricate pips. Lineage can
  show the new self snapshot summary and “Parent selection arrives in T013” without a fake family tree.

### 6. Tests and documentation

- Fixtures are small and invented. No source id/name/value/image/row, downloaded pack, cache, or real relationship enters
  git; tests make no network request.
- Domain tests cover v1→v2 migration, strict v2 parsing/invariants, snapshot filtering and gold→white conversion, awakening
  order, readiness, exact costs, bonuses, Initial Stats rounding, EXP cases (empty/partial/full bank), overflow ticket reward,
  refresh/loadout/history behavior, max-tier completion, and every invalid precondition.
- Persistence/API tests cover local/cloud migration, queued upgraded rows, v1-over-v2 rejection, atomic promotion, exact
  ledger/outbox ids, idempotent retry, corruption, concurrency, memory-only/offline behavior, final-snapshot race integration,
  and publication only after commit.
- Pure web tests cover readiness/projection, CTA routing, missing references, result reconstruction, and max-tier display.
  Do not add a component-testing dependency.
- Update `README.md`, affected progression/scenario/skills/support-card/UX docs, architecture's save/runtime model, data
  backlog, and `docs/decisions.md`. Do not modify workflows, infrastructure, Firebase/environment files, or the API Dockerfile.

## Manual verification

With complete private local content and `pnpm dev`:

1. Migrate a synthetic/local v1 save. Confirm every old resource/entity/log/version survives, every Uma is playable in her
   current tier, v2 queues once, reload does not remigrate, and a fresh cloud restore behaves identically.
2. Reach a gate with empty, partial, and full overflow. Confirm the cost/review, gate+1 transition, full-bank gate+2/+5 edge,
   snapshot contents, awakening, TL1 reset, retained stats/SP/deck, refreshed skills/loadout, and racing locked until Training.
3. Equip cards with Initial Stats at several levels/LBs. Confirm the review and committed integer gains match Card detail's
   generated projection, exceed-cap values are retained, and stale/missing decks block with zero writes.
4. Double tap, reload the success route, stop/restart the API, and force a storage/sync conflict. Confirm one spend, durable
   local progress, exact ledger/outbox state, and no duplicate bonus, awakening, or snapshot.
5. Reach the current maximum level and confirm one final snapshot, no cost/reset/promotion CTA, and stable replay/retry.
6. Inspect Home, Stable, Profile, gate result, and Scenario Start at 390×844 for safe areas, no overflow, ≥44 pt controls,
   reduced motion, private art only, and no console errors.

## Acceptance

- Every non-final gate has a complete atomic, offline-capable zero-parent promotion path using the documented cost, overflow,
  bonuses, awakening, snapshot, era, reset, and opening-Training rules; current-max completion snapshots once without charge.
- Save v2 is strict and one-way, preserves every v1 value/version/log, survives local/cloud conflict paths, and provides the
  complete typed foundation for T013/T014 without original content in git.
- Snapshot and skill-history data are finite, direct-origin-only, deterministic, and sufficient for later parent selection;
  UI projections and committed results use the same pure rules.
- `pnpm lint && pnpm test && pnpm build` pass, the PWA builds, and startup remains ≤180 KB gzip.

## Explicitly out of scope

- Selecting parents, automatic inheritance, grandparent picks, pink sparks, and the full family-tree UI (T013).
- Goal generation/tracking, goal ribbons/fanfare, Honors, goal race pinning, and historical Journey pips (T014).
- Badge rows, Graduate/Perfect/Speedrun/Honors awards, titles, trophy shelves, trainer achievements, and flair aggregation
  (Milestone 6). T012 stores only the source facts those systems will later evaluate.
- Scenario-specific training modifiers, Friend/Group gameplay, presets, sound, haptics, or new original-game assets.
