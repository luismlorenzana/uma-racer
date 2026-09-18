# T015 — Accomplishment facts and badge-state foundation (Milestone 6, part 1)

**Goal:** create the durable, privacy-safe facts and versioned persistence foundation that every badge, title, trophy,
timeline entry, and Trainer achievement will consume. Existing saves receive an honest, idempotent baseline; all future
race, Training, Scenario Start, promotion, and final-completion actions capture the missing facts atomically. This task does
not award or display badges yet.

Depends on: `T014-scenario-goals-and-journey.md`.

Read first: `AGENTS.md`, `docs/design/badges.md`, `docs/design/collection.md`, `docs/design/racing.md`,
`docs/design/training.md`, `docs/design/scenarios.md`, `docs/design/scenario-goals.md`,
`docs/design/skills-and-inheritance.md`, `docs/design/ux.md`, `docs/technical/architecture.md`, `docs/decisions.md`, T001,
T003–T005, T008, and T012–T014.

## Scope and fixed choices

- Keep `SAVE_SCHEMA_VERSION = 2` for profile/Umas. The already-reserved `badges` entity collection gets its own strict
  `BADGE_STATE_VERSION = 1`; its discriminated union supports `uma:<umaId>` and a singleton `trainer`. T015 creates one Uma
  entity per owned Uma and defines the empty Trainer shell that T017 may initialize. Complete empty award/preference slots
  mean T016/T017 do not require another badge-state migration.
- Facts are bounded aggregates plus source watermarks, not a second unbounded event history. Typed append-only
  `raceResults` remain race truth. T016 adds append-only `flairEvents` as award truth.
- New results snapshot `accomplishmentFactsVersion: 1` and exact bounded facts in the same record as ordinary rewards and
  goal ids. Legacy results omit them and remain valid. This is award metadata, not race engine v4; v1/v2/v3 replay behavior
  and simulation inputs do not change.
- Never trust a UI-supplied accomplishment fact. Completion derives facts from the selected private race, authoritative
  saved inputs, and the deterministic timeline inside the existing transaction after re-simulation succeeds.
- Retroactive race facts use explicit v1/v2/v3 replay paths and current private content joins. When content or a replay
  dependency is missing, mark only the affected fact family `untracked`; do not fail all unrelated badge tracking and do
  not guess.
- Existing Training/lineage history is incomplete. Bootstrap records only evidenced lower bounds from current state,
  current/last snapshots, and current active lineage. The state labels those categories `since-tracking`; future actions
  become exact from the tracking timestamp onward.
- Race-set ids and main-venue membership are original-game-adjacent reference data. They live only in a gitignored private
  override and generated private packs. Checked-in code/docs/fixtures use semantic series tags and invented ids/names only.
- Atomicity is mandatory. A future fact update either commits with its race/training/start/promotion action and outbox work
  or does not exist. Zustand publishes only after IndexedDB commits. Memory-only mode performs the same pure transition
  with its existing warning.
- No badges, titles, trophies, Prestige, fanfare, page, pins, or Trainer achievements are awarded in T015. No currency or
  gameplay formula changes. Add no dependency and keep startup ≤180 KB gzip.

## Deliverables

### 1. Private accomplishment metadata

- Add a documented ignored input at `content/overrides/flair.json`. It contains:
  - a unique list of safe semantic series tags per normalized race-family id;
  - the unique normalized venue keys that constitute the `jra-main` Grand Tour set.
- Extend normalized `RaceTemplate` with a safe `venueKey`, unique sorted `venueTags`, and unique sorted `series` tags.
  Display `venue` remains private content. `venueTags` is empty or contains `jra-main`; `series` accepts only the catalog-v1
  semantic enum from `badges.md`.
- The importer validates every override reference against retained normalized races, requires each configured title set to
  contain its documented number of distinct families and the main-venue set to contain exactly 10 distinct retained keys,
  rejects duplicate/conflicting mappings, and emits only aggregate family/series/venue coverage diagnostics. Missing
  override input is an explicit warning and produces empty tags; it
  never writes a sample containing real references.
- Live implementation work may populate the ignored override and regenerate/upload private packs, but must confirm
  `git status --ignored` before commit. Unit fixtures contain a few invented families, venues, and series.
- Update `scripts/data/README.md`, T001's normalized field table, the data backlog, content validators/parsers, pack hashes,
  and every synthetic `RaceTemplate` fixture.

### 2. Race accomplishment facts

- Define and strictly parse optional `RaceAccomplishmentFactsV1` on `RaceResultRecord`:
  - `version: 1`;
  - `familyId`, `grade`, `venueKey`, `venueTags`, `courseId`, `surface`, `distance`, `distanceCategory`, and `series`;
  - `playerStartDelay` in finite nonnegative seconds;
  - `playerFinalSpurtPlacement`, a valid placement or `null` when no final-spurt event exists;
  - `ledEverySectionCheckpoint`, a boolean computed from the authoritative timeline;
  - `inheritedUniqueActivated`, a boolean computed from player activation events and the compiled loadout/content kind.
- New records always include the facts object. Existing result shapes without it remain valid. Parsers require exact keys,
  safe ids, known enums, unique tags, distance/category agreement, and consistency with the result's stored player/course
  fields. `ledEverySectionCheckpoint` may be true only for a player win.
- Add pure extraction from the versioned timeline. A checkpoint is each completed section boundary after the gate through
  section 23; the player must have strictly greatest distance at every sample. Final-spurt placement is sampled on the
  player's first `last-spurt` event with stable gate-order tie breaking. Document/test how a finish before a later sample is
  treated (completed samples only).
- Extend attempt/retry equality so a matching stored attempt returns the stored facts, while a same-id facts mismatch is
  corruption. Cloud/API parsers accept legacy omission and reject malformed v1 facts.
- Provide a legacy projection helper that replays a strictly parsed result using its frozen engine path and joins the
  current private template. It returns per-family availability diagnostics instead of a half-valid fact object.

### 3. Versioned badge state

- Add pure types/parsers/constructors for a discriminated badge entity with these semantic sections:
  - shared identity/version: state version, scope, catalog version, tracking start, and source watermarks;
  - Uma identity/facts for `uma:<umaId>`; a `trainer` shell with empty aggregate/award slots and valid preference defaults;
  - history availability by `race`, `training`, `scenario-completion`, and `lineage`: `exact`, `since-tracking`, or
    `untracked`, plus safe diagnostic codes rather than private names;
  - bounded facts: starts/wins/placements, grade/surface/distance/strategy/venue/family counts, current/longest streak,
    course bests, detailed race-feat counts, stat peaks, level peak, distinct skill ids, goal/Honors totals, Training
    counters, scenario-completion facts, and Legacy/Dynasty evidence;
  - T016 award slots: earned badge stages, titles, trophies, and evaluator/catalog version (empty at T015);
  - T017 preference slots: active title, ordered showcase groups/pins, and saved views (safe empty defaults at T015).
- All maps serialize as sorted bounded arrays, not arbitrary object keys. Parsers cap ids/counts by documented game limits,
  reject duplicates, require monotonic/nonnegative counters and valid scenario tiers, and clone accepted data.
- Dynamic evidence keys identify their source action (for example child/tier for a parent use) so bootstrap and normal
  action retries cannot increment counters twice. Keep only bounded unique evidence required for idempotency.
- Add `flairEvents` to the shared log-kind vocabulary and define its strict envelope/id parser now, but T015 writes no
  events. This ensures T016 does not need a Dexie or API vocabulary migration.
- Dexie already has the `badges` table. Add typed read/write/adoption/outbox plumbing and strict API sync validation for
  `uma:*` badge entities and future `trainer` state. Unknown/newer badge state is a recoverable error, never silently reset.

### 4. Idempotent bootstrap

- During content-ready coordination, bootstrap every owned Uma missing badge state before the game becomes ready. Read and
  strictly parse the full relevant race history, current Uma, private catalog, and all owned Uma lineage state first.
- Process race rows in `(sequence, id)` order. Require the same uniqueness/sequence integrity as racing; aggregate exact
  catalog/result facts and derive detailed facts by versioned replay only when missing from the row.
- Seed exact facts available from current durable state: level/stat peaks (stats never decrease), placements/race counts,
  current race metadata, current/longest streak, course times, goal/Honors facts, and distinct skill history.
- Seed Training as a lower bound from the current `trainingsThisScenario`; current TL10 is evidence for the active tier.
  Do not invent past friendship turns, Full House, prior TL10, or completion deck/stat snapshots.
- Scan current active lineage and latest finite snapshots across owned Umas. Add unique direct-parent/grandparent evidence
  that is still provable, label lineage `since-tracking`, and never infer lost earlier selections.
- Write all new badge entities and coalesced outbox rows in one Dexie transaction, publish after commit, and retry without
  changing counters. Existing valid state is not rebuilt on every boot. A future catalog version is handled by T016's
  evaluator watermark, not by deleting facts.
- A malformed race row blocks bootstrap for its Uma with a recoverable diagnostic. Missing private content degrades only
  content-dependent race facts to `untracked`; it does not discard independently valid state.
- Cover empty-cloud bootstrap, cloud adoption, offline boot, memory-only mode, interruption/retry, and stale server
  conflicts without creating duplicate evidence.

### 5. Atomic future fact capture

- **Training:** in the existing transaction, update lifetime turn/friendship counters, Full House evidence, TL10 scenario
  evidence, stat/level peaks, and distinct/current-tier skills from the authoritative `TrainingTurnResult` and preview.
- **Race:** in the existing completion transaction, append result facts and update ordered race counters/streaks/course
  bests/feat aggregates, level/stat peaks, goals/Honors, and skill facts. A result retry returns without double counting.
- **Scenario Start:** for each selected direct parent, update that owned Uma's Legacy evidence using child id+tier. Missing
  local parent badge state is initialized/re-read in the same transaction; stale parent selection still aborts everything.
- **Promotion/final completion:** before reset/bonuses, store one bounded completion fact with tier, timestamp, TL, stats,
  equipped card ids/eras, Training totals known in that tier, race count, Journey summary, and frozen lineage. Update each
  locally owned grandparent's Dynasty evidence using descendant id+tier. Promotion retry/final retry remains idempotent.
- Multi-Uma actions coalesce one outbox row per affected badge entity. A failure rolls back tickets, entities, logs, goals,
  snapshots, race results, and every fact update together.

### 6. Tests and documentation

- Fixtures are small and invented. No live family/venue/race/Uma/card id, name, override, pack, cache, or source row enters
  git. Tests make no network request.
- Import tests cover valid tags, missing override, duplicate/conflicting mappings, unknown references, aggregate-only
  diagnostics, deterministic sorting/hash, and no output leakage.
- Domain tests cover fact parsers, exact enums/bounds, checkpoint/last-spurt extraction, inherited-unique activation,
  history grades, counter/streak/course aggregation, bounded evidence, state construction, and every catalog/prestige
  constant newly frozen in `badges.md`.
- Persistence/API tests cover legacy/new race facts, strict badge/flair shapes, bootstrap/replay degradation, lower-bound
  migration, cloud adoption, memory-only behavior, multi-entity atomicity, rollback, retry, outbox coalescing, and publish
  only after commit.
- Update badges/racing/training/inheritance/architecture/data docs and append the governing decisions. Do not claim badges
  are implemented in README; mark only T015's foundation complete when it lands.
- Do not modify workflows, infrastructure, Firebase/environment files, or the API Dockerfile.

## Manual verification

1. Run the importer with and without the ignored flair override. Confirm only aggregate diagnostics print, tags are
   deterministic, generated packs remain ignored, and existing content still loads offline.
2. Boot a pre-T015 save with several races/Journeys. Confirm one state per Uma, exact race/goal facts, honest Training/
   lineage lower bounds, and no award/UI change. Reload and sync; no counters or outbox rows duplicate.
3. Complete one Training, race, new-Uma Scenario Start, promotion, and final-tier race. Inspect IndexedDB before/after and
   confirm each gameplay write and every affected badge entity commit together.
4. Force a missing legacy race template, replay failure, stale parent, and IndexedDB error. Confirm explicit degradation or
   full rollback as specified, never fabricated facts or a partially committed action.

## Acceptance

- Every owned Uma has one strict, independently versioned, syncable badge-state entity without changing core save v2.
- All future badge-relevant actions capture authoritative bounded facts exactly once and atomically with gameplay.
- Existing history is reconstructed where provable, lower-bounded where incomplete, and explicitly untracked where a
  dependency is missing; no historical accomplishment is invented.
- New race rows contain replay-safe accomplishment facts, old rows remain valid, and race engine versions are unchanged.
- Private race-set/venue classification remains ignored/private; checked-in fixtures are synthetic.
- `pnpm lint && pnpm test && pnpm build` pass and startup remains ≤180 KB gzip.

## Explicitly out of scope

- Award evaluation, badge/title/trophy creation, Prestige, flair logs, fanfare, and UI (T016).
- Badge page, pins, groups, saved views, active-title editing, trophy wall, and timeline (T017).
- Trainer achievements, records, profile, and Trainer scope (T018).
- Duelist/Upset/R4 mechanics, rewards, sound, haptics, bespoke art, and social/global features.

## Implementation status

Implemented. Badge-state v1, strict sync/Dexie plumbing, private flair metadata, race accomplishment snapshots/replay,
evidence-based bootstrap, and atomic Training/race/Scenario/collection fact capture are covered by synthetic tests.
