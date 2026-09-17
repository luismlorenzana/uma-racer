# T014 — Scenario goals and Journey (Milestone 5, part 3)

**Goal:** close Milestone 5 by giving every newly started scenario three deterministic, private-content-backed race goals;
tracking them atomically with progression results; preserving honest completed/missed history; and integrating goal ribbons,
fanfare, Home tracking, and the Uma Profile Journey. Goal source facts are durable inputs for Milestone 6 badges/titles,
but this task does not create badge entities.

Depends on: `T013-parents-grandparents-and-inheritance.md`.

Read first: `AGENTS.md`, `docs/design/scenario-goals.md`, `docs/design/uma-progression.md`,
`docs/design/skills-and-inheritance.md`, `docs/design/racing.md`, `docs/design/ux.md` §§Home/Race Select/Pre-race/Results,
`docs/research/data-backlog.md`, `docs/technical/architecture.md` §§1 and 3, `docs/decisions.md`, T001, T005, T008,
T012, and T013.

## Scope and fixed choices

- Goal metadata comes from GameTora's versioned public `ura-objectives` dataset plus the already imported `races` data.
  Importers may record normalized references in private packs, caches/output remain ignored, and no source row, real id,
  race/Uma name, objective list, or downloaded data enters git or synthetic fixtures.
- Extend each normalized race with its source race-family id and each Uma outfit with the ordered distinct race-family ids
  referenced by that character's career objectives. All outfits sharing a character use that character's objective row.
  Ignore objective references that cannot resolve to at least one retained gameplay race and report aggregate warnings.
- Goals freeze one concrete `RaceTemplate.id` at scenario start. A future content update never silently rerolls an active
  or historical goal. Missing/retired target content shows its safe id and blocks the goal honestly until restored.
- Every tracked scenario has exactly three distinct targets: Aptitude, Identity, and Challenge. Generation uses only the
  post-inheritance saved aptitudes, private templates, tier, and stable ids; it is deterministic under input reordering and
  uses no `Math.random`.
- MVP grade escalation is exact: tier 1 uses Pre-OP for Aptitude and OP for Identity/Challenge, tier 2 uses G3, tier 3 uses
  G2, and tier 4+ uses G1. When a requested bucket is genuinely empty, fall back through the nearest weaker grades before
  stronger grades and expose the chosen actual grade; never fail a scenario start solely because a content subset is thin.
- Aptitude selects from the best combined saved surface+distance match. Identity prefers the Uma's normalized career-
  objective families with both relevant aptitudes B or better, then falls back to the next best aptitude candidate.
  Challenge selects a third aptitude-valid race and requires a win by at least 5 lengths. Candidate ties rotate by a stable
  hash of Uma id, tier, and slot after id sorting, so outfits/tiers vary without private constants in source.
- All goals require first place. Because result margins are stored behind the immediately preceding finisher, Challenge
  uses the second-place runner's `marginLengths` when the player wins; exactly 5.0 passes. Goals are optional and never
  gate race entry, promotion, Training, or Scenario Start. They pay no tickets,
  coupons, shards, stats, or SP.
- Goal completion counts only a committed progression result from the same Uma and active tier, with the exact target race.
  Replay, abandoned playback, preview, NPC result, historical result from another tier, or later content alias cannot count.
- On promotion/final completion, remaining active goals become missed before the journey closes. Completed/missed states
  never reopen. The next scenario's goals are generated after T013 pink sparks apply, inside the same atomic start commit.
- Save-v2 Umas that predate T014 get a one-time goal plan. Their current unfinished scenario receives deterministic goals
  and current-tier race history is replayed for completion. Earlier completed tiers become `legacy-untracked`, not false
  misses or retroactive wins. A current-max scenario already completed before T014 is also legacy-untracked.
- `goalPlanVersion` is set to 1 after bootstrap/start. Later generator changes require an explicit versioned migration and
  never reroll v1 plans in place.
- “Goal Ribbon” and “Honors crest” in T014 are Journey/result presentation derived from persisted goal facts. Badge rows,
  titles, trophy shelves, Album rollups, account achievements, and flair timelines remain Milestone 6 and can evaluate the
  same facts retroactively.
- Keep startup ≤180 KB gzip. Use existing route splitting, UI/Motion primitives, and private atlases; add no dependency.

## Deliverables

### 1. Objective metadata in private content packs

- Add `ura-objectives` to the existing manifest/version/cache fetch path. Never pin a remote dataset hash in source; use the
  fetched manifest version exactly like other datasets.
- Rename the currently unused `UmaTemplate.signatureRaces` field to `signatureRaceFamilyIds` and add
  `RaceTemplate.familyId`. Normalize both as safe decimal strings, unique and source-order-preserving for objectives.
- Join objective rows to Umas by `char_id`. Flatten objectives by their numeric order, then their nested `races` order.
  Resolve a nested objective race id against raw race `race_id`; retain a family only when at least one normalized gameplay
  race with that family survives T001's grade/venue filters. Do not copy objective names, turn numbers, conditions, fan
  counts, or nested race objects into the pack.
- Strict content parsers require safe family ids and unique lists. Import diagnostics report only aggregate row/outfit/
  resolved/unresolved counts—never ids or names in checked-in reports. The live import must cover all current launch
  outfits; missing characters are warnings surfaced to goal fallback, not invented mappings.
- Update `scripts/data/README.md`, T001's field notes, and the data backlog. Unit tests use a tiny invented objectives/races/
  outfits fixture and cover shared-character outfits, source order/dedup, filtered/missing families, malformed rows, and
  deterministic pack hashes.

### 2. Pure version-1 goal generator

- Add `SCENARIO_GOAL_VERSION = 1`, grade-bucket helpers, aptitude scoring, stable tie rotation, fallback ordering, and a
  pure `generateScenarioJourney` in `@racer/domain`.
- Validate started schema-v2 Uma state, known tier/scenario, complete template/race ids, race grade/surface/distance category,
  aptitudes, and sufficient distinct candidates. A complete normal catalog returns exactly one active journey with three
  distinct goal ids `goal:<tier>:<slot>` and target race ids.
- Aptitude score is the sum of the saved surface- and distance-grade indices (`S` best through `G` worst); lower is better.
  Identity first filters objective-family races to B-or-better in both categories. Challenge uses the same lowest-score
  candidate ordering as Aptitude after excluding prior targets; its stored kind/minimum margin distinguishes the stretch.
- Within an equally scored candidate set, sort by race id and select `stableHash(umaId:tier:slot) % count`. The stable hash
  must be a tested shared pure helper, not engine RNG or wall-clock state.
- Grade fallback starts at the slot's requested bucket, visits weaker buckets nearest-first, then stronger nearest-first.
  It must still honor distinct targets. If even the complete catalog cannot supply three distinct valid races, Scenario
  Start fails before writes with a content diagnostic listing counts only.
- Add a pure goal evaluator over a stored active journey, current Uma/tier, race template, committed result id/result, and
  timestamp. It returns newly completed ids and an updated journey. Winning margin comes from the ordered second-place
  result only after validating a first-place player; it never trusts UI-supplied placement/margin/course.
- Add pure scenario closure that marks active goals missed and sets journey completion time, plus derived 0–3 pips and
  Honors state. Fix the 5-length threshold and grade mapping in the design doc, decision log, and domain pinning test.

### 3. One-time bootstrap and scenario integration

- During content-ready save coordination, find schema-v2 Umas with `goalPlanVersion: 0`. Read and strictly parse their full
  local race history before writing. Do not mark the game ready with a partially upgraded goal plan.
- For every completed tier missing a journey, append `legacy-untracked`/completed with no goals and unknown completion time.
  For the current unfinished tier, generate one tracked active journey and replay only that Uma's results whose
  `tierOfLevel(startLevel)` matches it, ordered by sequence, through the pure evaluator. A previously final-completed tier is
  legacy-untracked instead. Set goal plan version 1.
- Bootstrap all affected Umas and coalesced outbox rows in one Dexie transaction, preserve versions/unrelated state, publish
  after commit, and retry idempotently after interruption. Memory-only mode produces the same in-memory result and warning.
- Extend T013's free new-Uma and promotion confirmation so it generates the new active journey after parent/spark changes
  and commits it with the rest of Scenario Start. Before promotion, close the old tracked journey; final-tier race
  completion closes the active journey when it captures the final snapshot.
- `scenarioStarted: false` Umas have goal plan version 1 but no active journey until their free start confirmation. Every
  started non-final/non-completed Uma must have exactly one active journey for its current tier after T014.
- A generator/content failure aborts the entire new-Uma start or promotion, including ticket spend and snapshot replacement.
  It cannot leave a new tier without goals.

### 4. Atomic race completion and replay-safe result facts

- Extend new `RaceResultRecord`s with a strictly parsed optional `completedGoalIds` array. Legacy rows omit it. New rows
  always include it, including an empty array, so reload/result reconstruction never has to infer what that commit awarded.
  This is reward metadata, not a race-engine version change; v1/v2/v3 simulation replay inputs remain untouched.
- In the existing `completeRace` transaction, after deterministic re-simulation and ordinary EXP/rewards, evaluate the
  currently re-read active journey against the authoritative race/result. Update the Uma, append the result with exact new
  goal ids, and queue the same profile/Uma/result/ledger work atomically.
- If that result reaches the current global maximum, evaluate its goals first, then close remaining goals as missed and
  capture the final snapshot. A gate in any non-final tier leaves the journey active until promotion, allowing the race
  that reached the gate to complete goals but no further races at the gate.
- Matching race retries return the stored `completedGoalIds` and do not replay or duplicate fanfare/state. Same-id result
  mismatches remain corruption. A goal-update failure rolls back result, EXP, tickets, shard, and every entity/log write.
- Update domain/web/API history parsers, cloud adoption, sync, and replay/result adapters for old and new shapes. Server
  validation stays strict and does not independently evaluate goals.

### 5. Goal and Journey UX

- **Home:** add the featured Uma's active three-goal tracker with status pips, target/rule summary, and direct target-race
  action. Pending setup, legacy-untracked, current-max complete, missing target, and no-active-goal states are explicit.
- **Uma Profile:** replace the minimal strip with one medallion per reached tier. Tracked tiers show three filled/hollow/
  active pips; all-three complete derives an Honors crest; legacy-untracked uses a distinct “Not tracked” mark, never three
  hollow misses. Tapping opens goal details with race/result links and active/missed/completed explanations.
- **Race Select:** pin exact active goal targets above normal deterministic ordering, add goal ribbons and Goals-only
  filtering, and dedupe a race targeted by multiple goals. Existing grade/distance/surface data and unavailable reasons
  remain visible.
- **Pre-race:** show every active goal at stake for the selected race, including the 5-length Challenge requirement. Goal
  presence never changes simulation, loadout, or Start eligibility.
- **Results:** when `completedGoalIds` is nonempty, show a dedicated ribbon-unfurl sequence after ordinary placement/reward
  feedback, then updated pips/Honors. Multiple completions serialize in slot order. Skip/reduced motion shows the identical
  facts immediately; reload shows a completed summary without replaying an earn animation as a new reward.
- Use private content joins, safe id fallbacks, Motion `m.*`, transform/opacity only, safe areas, ≥44 pt controls, and no
  sound/haptic/new-art dependency. Milestone 6 later maps these source facts into Badge/Trophy/Flair surfaces.

### 6. Tests, documentation, and milestone closure

- Fixtures are invented and small. No real objective/race/Uma id, name, row, list, image, pack, or cache enters git. Tests
  make no network request.
- Domain tests cover import normalization; exact grade mapping/fallback; aptitude score; B-or-better identity filter;
  source-family preference; distinct targets; stable hash/order independence; exact 5.0 margin; wrong Uma/tier/race;
  completion/miss/Honors; goal/journey parser invariants; and generator errors.
- Persistence/runtime tests cover one-time goal bootstrap, legacy-untracked tiers, current-history replay, pending/final Umas,
  atomic start/promotion generation, race completion and multi-goal ids, gate/final ordering, retry/reload, rollback,
  offline/memory-only behavior, outbox coalescing, and publication only after commit.
- Pure web tests cover Home/Profile/Race Select/pre-race/results projections, pin/filter/dedup, pips/Honors/untracked marks,
  missing/retired content, multiple fanfares, and direct/reloaded result state. Do not add a component-testing dependency.
- Update `README.md` to mark Milestone 5 complete; update scenario-goals/progression/scenarios/UX/architecture/data-backlog
  docs and append a decision row for source objective metadata, deterministic goal v1, legacy-untracked migration, and
  result-snapshotted completion ids. Add owner iPhone Scenario Start/Journey checks to `docs/open-questions.md` when desktop
  emulation cannot verify physical feel.
- Do not modify workflows, infrastructure, Firebase/environment files, or the API Dockerfile.

## Manual verification

With refreshed private content and `pnpm dev`:

1. Run `pnpm data:import`. Confirm objective metadata participates in the content hash, all launch outfits have normalized
   source coverage or an aggregate warning, no ignored output is staged, and existing content still loads offline.
2. Start/promote several synthetic/private Umas with differing aptitudes/parents. Confirm three distinct reproducible goals,
   grade escalation, source-family Identity preference, post-spark selection, 5-length Challenge, and no reroll on reload.
3. Run target/non-target races, wins/losses, 4.99/5.0+ margins, replay, Skip, retry, and reload. Confirm only authoritative
   current-tier commits complete goals once and stored result ids drive the same summary.
4. Promote with 0–3 completions. Confirm active goals become missed, the old medallion stays honest, Honors derives only
   from 3/3, and the next post-inheritance tier gets new goals atomically. Test current-max closure too.
5. Load a pre-T014 save. Confirm earlier tiers say Not tracked, current-tier history alone is evaluated, the migration queues
   once, and no retroactive reward/miss is invented. Repeat with offline boot and a new-device cloud restore.
6. At 390×844 inspect Home tracker, Journey/detail, pinned/filterable race list, pre-race banner, multi-goal result fanfare,
   safe areas, ≥44 pt targets, reduced motion, missing-content fallback, no overflow, and no console errors.

## Acceptance

- Every started scenario has exactly three deterministic, frozen, private-content-backed goals with documented tier
  escalation; implementation contains no hard-coded original race/Uma data and imports only normalized references.
- Authoritative race completion updates goal facts and result metadata atomically/exactly once; promotion/final completion
  preserves completed versus missed history and cannot partially start a goalless new scenario.
- Existing saves migrate honestly with legacy-untracked history, current-tier replay, stable goal plan versioning, and no
  fabricated awards. Content updates do not reroll persisted plans.
- Home, Journey, Race Select, pre-race, and Results make goals prominent and mobile-ready while leaving Milestone 6 badge/
  title entities cleanly separate.
- Milestone 5 docs/status are complete; `pnpm lint && pnpm test && pnpm build` pass, the PWA builds, and startup remains
  ≤180 KB gzip.

## Explicitly out of scope

- Persisted Goal Ribbon/Honors/Graduate/Perfect/Speedrun badge entities, Triple Crown/Tiara titles, trophy shelves, Album
  crest counts, flair timelines, Stable Goals/Honors Collector/Destiny aggregates, pins, and retroactive badge evaluation
  (Milestone 6).
- Scenario-specific training modifiers, affinity, probabilistic inheritance, blue sparks, race-calendar deadlines/fans,
  mandatory career failure, original objective rewards, or source objective conditions other than normalized race identity.
- Sound, haptics, new goal/badge art, real icons replacing emoji, or other Milestone 7 polish.
