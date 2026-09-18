# T013 — Parents, grandparents, and inheritance (Milestone 5, part 2)

**Goal:** complete Scenario Start. A new or promoted Uma can choose zero, one, or two valid frozen parent snapshots, review
automatic parent skills, select the allowed grandparent uniques and whites, choose parent pink-spark aptitude upgrades,
and commit the entire new scenario atomically. The chosen frozen lineage drives the refreshed skill library and becomes
the next snapshot's one-level parent history.

Depends on: `T012-scenario-promotion-and-save-v2.md`.

Read first: `AGENTS.md`, `docs/design/skills-and-inheritance.md`, `docs/design/uma-progression.md`,
`docs/design/scenarios.md`, `docs/design/training.md` §Opening training, `docs/design/ux.md` §Scenario Start,
`docs/technical/architecture.md` §1 and save model, `docs/decisions.md`, T006, T010, T011, and T012.

## Scope and fixed choices

- Parent selection always reads the latest **completed** snapshot saved on each owned Uma. The draft carries snapshot
  identity (`umaId`, `completedTier`, `takenAt`); confirmation re-reads it and rejects a refreshed/stale selection rather
  than silently inheriting different data.
- Identity rules use frozen `charaId`, not outfit/template id. The two parents must be different characters; neither may be
  the child or another outfit of the child. Circular and duplicate grandparent exclusion also works at character level.
- Each selected parent's top-level contribution automatically grants her inherited unique when present and all frozen
  inheritable whites. The child's own unique/awakening library wins collisions. Between inherited duplicates, the closest
  parent wins; parent A wins a same-depth tie only for stable `sourceId` display. A skill enters the library once.
- Grandparents are the `parents` arrays copied inside the selected snapshots. Exclude the child and either chosen parent;
  merge duplicate-character grandparents using the copy with the newest `takenAt`, then higher `completedTier`, then
  id-stable Uma id as the deterministic tie break.
- The player may choose zero through two eligible grandparent inherited uniques and zero through
  `ceil(distinctEligibleWhitePool / 2)` whites. The pool already excludes permanent/current and automatic-parent skills.
  A unique/white chosen twice or over the cap is invalid; unavailable/malformed source content blocks confirmation.
- Every selected parent whose frozen A/S aptitudes contain at least one category where the child is below A grants exactly
  one chosen +1 grade. The choice may be surface, distance, or strategy; the result is capped at A. A parent with no
  effective option grants no upgrade and requires no choice. Parent order defines application order, so the second picker
  sees the first upgrade and cannot waste a second choice on an already-A category.
- Inherited unique skills use the already-normalized inherited-unique id and the race compiler's existing ×0.5 behavior.
  Every inherited skill has origin `inherited` and `sourceId` equal to the contributing frozen Uma id. Inherited skills
  never become inheritable in a later snapshot.
- Scenario Start remains a single commit. Parent/grandparent/spark choices live only in route state until Confirm. A failed,
  stale, cancelled, or abandoned draft spends nothing and mutates no Uma.
- Brand-new Umas now begin with `scenarioStarted: false`. This applies to first-save starter seeding and future coupon
  acquisitions. They use the same flow at tier 1 with no promotion cost/snapshot/bonus; Training and racing stay locked
  until setup is confirmed. T012-migrated or already-started Umas are not retroactively interrupted.
- Goals are still deferred to T014. T013 keeps goal plan version 0/empty journeys when applicable and does not invent goal
  data. Badges, affinity bonuses, blue sparks, borrowed parents, and probabilistic inheritance remain out of scope.
- Keep startup ≤180 KB gzip. The stepper and lineage tab are lazy, use existing UI/Motion/atlas primitives, and add no
  dependency.

## Deliverables

### 1. Pure parent eligibility and frozen-lineage projection

- Add a reusable domain projection over owned v2 Umas and current private Uma/skill content. It returns one row per Uma
  with a snapshot: eligibility code, frozen tier/time, private-art id, two frozen parent mini-ids, and counts of new
  automatic uniques/whites for this child. Missing live content is a diagnostic row, never a deleted snapshot.
- Structured parent issue codes cover: no snapshot, self/same character, already selected character, malformed snapshot,
  missing content/skill, unsafe id, and stale fingerprint. UI messages derive from these codes.
- Add a pure grandparent resolver that filters closest-position conflicts, merges duplicate characters with the fixed
  recency tie break, and returns eligible/ineligible contributors with reasons. It returns distinct unique and white pools,
  exact caps, source Uma ids, and whether each skill is already permanent/automatic/selected.
- Add a pure pink-spark projection for each parent in order. It lists only A/S frozen parent categories that produce a real
  child improvement, applies one grade step through the existing grade ordering, caps at A, and returns before/after grades.
- All projections are deterministic under shuffled input and deep-copy frozen values. No path consults a parent's live
  library, aptitudes, parents, or content-backed unique in place of the chosen snapshot.

### 2. Scenario-start resolution and skill refresh

- Define a strict `ScenarioStartSelection` carrying ordered parent fingerprints, ordered grandparent unique/white ids, and
  one nullable pink-spark category per parent. Validate safe/unique ids, counts, eligibility, pool membership, and exact
  effective spark choices against freshly resolved state.
- Extend T012's pure promotion resolver to accept the full selection. It still captures the old scenario snapshot first,
  then performs cost/overflow/bonus/awakening/reset, then builds the new scenario from the selected frozen parents.
- Add a pure new-Uma start resolver for `scenarioStarted: false`. It applies no snapshot, ticket movement, level/stat/TL
  change, awakening, Initial Stats, or promotion bonus; it only commits parents, inherited skills, aptitudes, history, and
  `scenarioStarted: true` for the existing tier-1 instance.
- New libraries are ordered deterministically: own unique, unlocked awakenings in template order, automatic parent uniques,
  automatic parent whites, selected grandparent uniques, then selected grandparent whites. Dedupe by skill id using the
  precedence in Scope. Keep only old paid loadout ids still present after the refresh.
- Append one `SkillHistoryEntry` per newly present tier+skill, with inherited sources frozen from the resolver. Preserve
  earlier scenario history and never convert inherited origins to card origins.
- Persist exact copies of the chosen `ParentSnapshot`s as `currentParents`. On the next completion, T012's snapshot builder
  copies only their top-level `FrozenParent` contributions into the child's new `parentSnapshot.parents` array.
- Update all Training/race/deck action guards so `scenarioStarted: false` routes to setup and writes nothing. Deck editing
  may remain available before setup, but no Initial Stats are granted by the free tier-1 start.
- Update design/architecture docs and append a decision row for character-level lineage identity, collision precedence,
  duplicate-grandparent recency ties, required effective pink-spark choices, and new-Uma pending setup. These rules contain
  no new tunable coefficient; pin inherited ×0.5 and half-pool `ceil` in the existing domain design test.

### 3. Atomic local-first commit and conflict behavior

- Replace T012's zero-parent-only commit with `startScenario(umaId, selection, now)`, supporting either a gate promotion or
  pending tier-1 start. Re-read/parse the child, profile when spending, every selected parent row, content, deck, and
  matching ledger inside one Dexie transaction.
- Gate promotion writes the same profile/Uma/log/outbox set and deterministic ids as T012. A free new-Uma start updates only
  that Uma plus its coalesced outbox row; it has no ledger entry. Both publish after commit and schedule normal sync.
- Use one per-child scenario-start lock. Parents may be updated independently while the draft is open, but confirmation
  fails stale if a chosen snapshot's fingerprint changed. Unchosen parent updates are irrelevant.
- A matching already-committed selection/retry is success without rewriting or spending. An active Uma cannot start again,
  and a promoted Uma cannot replay the old transition. Same ledger id with a different selection/post-state is corruption.
- Memory-only mode uses identical validation/resolution and the existing non-persistent warning. Offline confirmation is
  fully playable and later syncs through the existing entity/log path; no API endpoint or server rule simulation is added.

### 4. Full-screen Scenario Start and Lineage UX

Expand `/scenario/:umaId/start` into the documented one-decision-per-step flow while preserving the T012 review/result:

1. **Parents:** carousel/list of snapshot candidates with private icon, completed scenario, age, frozen grandparent icons,
   eligibility, and exact “+N new” counts. Choose 0–2 ordered parents; Skip remains prominent.
2. **Automatic inheritance:** review parent unique/white chips and exclusions. Motion may fly chips into a local preview,
   but no save mutation occurs.
3. **Grandparents:** grouped eligible/ineligible contributions with reasons, 0/2 unique and `n / ceil(pool/2)` white
   counters, deduped sources, and disabled over-cap choices.
4. **Pink sparks:** one page per effective parent choice with all eligible aptitude before/after grades. Parents with no
   useful option show “No available upgrade” and advance without inventing a reward.
5. **Confirm:** exact cost/overflow/promotion bonuses (or Free tier-1 start), refreshed skill list, aptitude changes, parent
   tree, TL/race-lock state, and scenario title.

- Back between steps preserves the draft; leaving the route discards it. A stale snapshot error returns to Parents with the
  prior choices visible and the changed row marked for review. Confirm disables during commit and remains retryable.
- Add the Profile Lineage tab using `currentParents` for the active scenario and `parentSnapshot` for the latest completed
  one. Show a finite child → parents → grandparents tree, frozen tier/time, skill counts, missing-content fallbacks, and no
  live-state leakage. An Uma with none gets a useful “Complete a scenario to become a parent” explanation.
- Profile/Home/collection reveal routes send `scenarioStarted: false` Umas to setup before Train/Race. Existing active Umas
  remain unchanged. All controls are ≥44 pt, safe-area aware, private-atlas only, and have instant reduced-motion behavior.

### 5. Tests and documentation

- Use invented templates/snapshots/skills only. No real lineage, id, name, values, image, pack row, or cache enters git;
  tests are offline.
- Domain tests cover every parent rule; outfit/character identity; stale fingerprints; fully frozen reads; circular and
  closest-position exclusion; duplicate-grandparent tie breaks; distinct pools; 0/1/2 unique and ceil-half white caps;
  collision precedence/order; inherited origins; 0–2 parents; spark eligibility/order/cap; and new-Uma vs promotion paths.
- Persistence tests cover atomic gate and free starts, exact T012 ledger reuse, parent refresh races, matching retry,
  mismatched corruption, invalid choices with zero writes, per-child concurrency, unrelated parent mutation, offline/
  memory-only operation, and state publication after commit.
- Pure web tests cover step projections, counts/reasons, draft backtracking, stale recovery, Lineage trees, missing private
  content, and pending-setup routing. Do not add a component-testing stack.
- Update `README.md`, skills/inheritance/progression/UX docs, architecture, and decisions. Do not modify infrastructure,
  workflows, Firebase/environment files, or the API Dockerfile.

## Manual verification

With several locally completed synthetic/private Umas and `pnpm dev`:

1. Start a fresh Uma with no available snapshots. Confirm Skip starts tier 1 for free, own skill/history are correct, races
   need one Training, reload is durable, and a repeated/direct confirmation writes nothing.
2. Promote with zero, one, and two parents. Verify candidate eligibility, alternate-outfit rejection, automatic skills,
   grandparent caps/exclusions, pink-spark before/after grades, T012 cost/bonuses, and exact frozen active lineage.
3. Build circular and duplicate lineages. Confirm child/parent exclusions, one closest contribution per character, most-
   recent duplicate selection, no recursive tree, and inherited skills never pass as direct skills later.
4. Refresh a chosen parent's snapshot while a child draft is open. Confirm stale rejection with no spend, marked review,
   and successful recomputation. Confirm unrelated snapshot changes do not invalidate the draft.
5. Stop the API, start/promote a scenario, Train once, reload, and reconnect. Confirm parents, aptitudes, skills, snapshot,
   cost, and outbox sync once with no lost unrelated state.
6. Inspect the five-step flow and Lineage at 390×844 with 0/1/2 parents, long skill pools, safe areas, ≥44 pt controls,
   reduced motion, no horizontal overflow, private art only, and no console errors.

## Acceptance

- Every new or promoted Uma can atomically start with 0–2 valid frozen parents, documented automatic inheritance,
  player-capped grandparent choices, and one effective pink-spark choice per eligible parent.
- Circular/duplicate/outfit lineages are finite and deterministic; snapshot refreshes cannot silently change an open draft;
  direct-only inheritance remains enforceable across generations.
- The saved active lineage, refreshed library/history/loadout, and permanent aptitudes survive reload, offline play, sync,
  retry, and later snapshot replacement without partial writes or duplicate promotion spend.
- Scenario Start and Lineage are complete mobile-first surfaces. `pnpm lint && pnpm test && pnpm build` pass and startup
  remains ≤180 KB gzip.

## Explicitly out of scope

- Scenario goal import/generation/tracking, race ribbons, Journey pips, Honors, and goal fanfare (T014).
- Parent affinity, probabilistic inheritance, blue/stat sparks, spark stars, mid-scenario inspiration, borrowed/friend
  parents, and more than two generations.
- Badge/title/trophy creation, Graduate/Perfect/Speedrun awards, collection aggregates, and retroactive flair (Milestone 6).
- Scenario modifiers, Friend/Group card gameplay, sound, haptics, or new original-game assets.

## Implementation status

Implemented on the T013 feature branch. The pure domain projection and resolver cover frozen candidate diagnostics,
character-level eligibility, stale fingerprints, closest/duplicate grandparent handling, deterministic library precedence,
capped picks, and sequential pink sparks. Fresh Umas now wait for a free setup; gate and free starts share one atomic
local-first runtime action, exact selected snapshots persist as active lineage, and Training/racing remain write-locked
until confirmation. The lazy five-step Scenario Start and finite Profile Lineage surfaces use private content joins with
missing-content fallbacks. Synthetic domain, API, IndexedDB, routing, and view-model tests cover the shipped path.
