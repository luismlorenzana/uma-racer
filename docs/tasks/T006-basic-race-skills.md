# T006 — Basic race skills and loadouts (Milestone 3, part 1)

**Goal:** make the supported portion of the imported skill catalog participate in deterministic races. Players can build one
legal active loadout, supported own uniques are active for free, NPCs receive their supported unique plus the private baseline
kit, and the R2.5 engine applies speed, acceleration, and recovery effects with visible activation events.

Depends on: `T005-progression-races-and-rewards.md`.

Read first: `AGENTS.md`, `docs/design/racing.md`, `docs/design/skills-and-inheritance.md`,
`docs/research/race-mechanics.md`, `docs/technical/architecture.md`, `docs/decisions.md`, and T005.

## Scope and fixed choices

- T006 implements the R2.5 subset: target/current speed, acceleration, and stamina recovery with numeric comparisons over
  phase, distance, remaining distance, order, order rate, HP, strategy, surface, and distance category. R5 owns debuffs,
  gold/white interactions, passive stat skills, field-of-view effects, and the rest of the source condition vocabulary.
- Raw GameTora expressions are never evaluated in the app. The importer parses their small `@` (OR), `&` (AND), and
  numeric-comparison grammar into a validated condition AST and reports unsupported variables/effects.
- A supported condition may activate only when every referenced variable has an implemented meaning. Unsupported skills
  remain in the library but are labelled unavailable for racing; they never silently become no-ops or unconditional buffs.
- T006 implements the non-pack trigger variables. T007 supplies blocking/overtaking/lane/order-change variables and is the
  milestone gate for every launch unique. The compiler must already accept all launch-unique expressions in T006.
- Effect values, durations, and cooldowns use the source fixed-point scale of 10,000. Activation rolls and random trigger
  points use stable per-runner/per-skill streams derived from the race seed, so skills do not perturb base race variance.
  Inherited uniques multiply effect magnitude by the documented 0.5.
- The own unique is free and implicit. `loadoutSkillIds` contains only paid library skills, whose non-null costs must sum to
  no more than current SP. One active loadout is implemented now; presets remain with the Cards/Scenarios milestones.
- The fixed four-skill NPC kit is selected deterministically from each private content version: course/strategy-neutral
  recovery, middle speed, late speed, and acceleration whites in stable id order. Source code and committed fixtures never
  contain real skill ids. Synthetic fixtures exercise the same shape.
- Existing T005 result rows are immutable legacy engine-v1 records. New results are versioned and snapshot their compiled
  race input so later content or engine changes cannot alter replay. The API and web accept both strict shapes.

## Deliverables

### 1. Skill content compiler

- Preserve source activation mode and compile condition groups into exact, bounded AST nodes.
- Normalize supported effects into explicit race operations with finite magnitudes, durations, and cooldowns.
- Produce a deterministic coverage report: supported/unsupported by kind, effect, and condition variable; separately assert
  that every launch unique parses and identify which await T007 runtime variables.
- Validate the private baseline kit: four distinct strategy- and course-neutral white skills, including one recovery, one
  mid-race speed, one late-race speed, and one acceleration skill.
- Extend private pack parsing without exposing raw content to git or startup bundles.

### 2. Domain loadout rules

- Add pure helpers for library joins, implicit own unique, cost totals, SP validation, course compatibility, and atomic
  loadout replacement. Reject unknown, duplicate, own-unique, unavailable, or over-cap ids.
- Persist a loadout edit locally with the Uma entity and coalesced outbox work before publishing Zustand state.
- Show supported status and why a skill cannot run on the selected course.

### 3. Deterministic R2.5 engine

- Extend `RaceRunnerInput` with immutable compiled skills and extend the course input with the facts required by supported
  conditions. Validate the entire input at the engine boundary.
- Track per-runner trigger preconditions, priority condition groups, active duration, and modifiers. Each basic skill resolves
  once per race; cooldown metadata remains in the immutable snapshot for later R5 repeat rules. Apply recovery once, combine
  temporary speed/acceleration modifiers deterministically, and expire them on tick boundaries.
- Emit `skill-activated` events with runner, skill id, tick, group, effect summary, and expiry where relevant.
- Preserve seeded determinism and fixed 15 Hz simulation. No global randomness or renderer-owned rule.

### 4. Progression integration and replay compatibility

- Build the player skill set from the supported own unique plus the saved legal loadout. Build each NPC from her supported
  unique plus the private baseline kit. Unsupported own uniques stay visible with a later-mechanics status; unsupported paid
  skills cannot enter a loadout and invalidate stale equipped state instead of silently becoming unconditional effects.
- Introduce a new strict race-result version that stores the exact compiled input needed for replay. Legacy T005 rows remain
  readable and use the frozen engine-v1 path. Same-id retries still compare and pay exactly once.
- Update local/cloud parsers, history, and direct result URLs for both versions.

### 5. Mobile loadout and activation UI

- Add a Skills section to Uma Profile with library chips, cost/support labels, an SP meter, and a 44 pt equip toggle.
- Add a pre-race loadout summary/editor showing which equipped skills can trigger on that course.
- Add race activation popups driven only by timeline events, with reduced-motion behavior and no impact on simulation.

## Tests and validation

- Synthetic compiler/importer tests cover grammar, AST limits, fixed-point conversion, private-kit validation, and coverage
  reporting.
- Domain tests cover loadout legality, implicit unique, SP boundaries, inherited scaling, and compatibility explanations.
- Engine tests cover every supported effect, duration, Wit/guaranteed activation, stacking, deterministic ordering,
  recovery before HP exhaustion, malformed input, and engine-v1 stability.
- Persistence tests cover atomic loadout saves, outbox coalescing, legacy/new result parsing, replay, retry, and corruption.
- Extend balance simulation with skill/no-skill Long fields and record results without changing design numbers silently.
- `pnpm lint && pnpm test && pnpm build` pass; startup remains ≤180 KB gzip; manual 390×844 flow is clean.

## Acceptance

- A player can equip a legal supported loadout and see deterministic skill effects and activations in a progression race.
- NPCs use their supported own unique and the configured baseline kit without real ids entering git; unsupported uniques are
  inert and remain visibly assigned for T007 rather than being approximated.
- A recovery skill materially improves Long-race stamina in the simulator without making stamina irrelevant.
- Existing T005 history remains readable/replayable and all new results are stable across content updates.

## Explicitly out of scope

- Pack-dependent trigger semantics (completed in T007), lanes, blocking, overtaking, position keeping, slopes, dueling,
  spot struggle, rushed behavior, debuffs, complex R5 effects, skill presets, inheritance acquisition, and sound.
