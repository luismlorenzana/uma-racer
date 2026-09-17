# T007 — Position keeping and pack racing (Milestone 3, part 2)

**Goal:** replace independent fixed-lane runners with a deterministic pack. Strategy-specific position keeping, lateral
movement, blocking, and overtaking make Front Runners viable and supply the remaining runtime facts needed by launch uniques.

Depends on: `T006-basic-race-skills.md`.

Read first: `AGENTS.md`, `docs/design/racing.md`, `docs/research/race-mechanics.md`, the T006 findings, architecture,
decisions, and T006.

## Scope and fixed choices

- Research and document position-keeping thresholds, timers, and Wit checks before coding. Confirmed lane/block formulas
  from the research doc are used unless a documented finding supersedes them.
- Implement Front Runner Speed Up/Overtake and other strategies' Pace Up/Pace Down modes during sections 1–10.
- Implement continuous lateral position, target-lane selection, power-scaled movement, blocking caps, and overtaking.
- Extend the T006 condition context for launch-unique pack facts: gaps in lengths, nearby counts, blocked front/side time,
  overtaking, order changes, final-corner state, and the imported course's corner/straight ranges.
- Add no slopes, dueling, spot struggle, rushed behavior, or complex R5 skill interactions.
- Any new balance target or coefficient is first added to `docs/design/racing.md`, the pinning/balance tests, and decisions.

## Authored implementation contract

### Replay and tick ordering

- This task creates engine **v3**. `simulateRaceV1` and `simulateRaceV2` are explicit frozen entry points; a v3 result
  snapshots its clipped layout and compiled skills. The API/domain parsers accept all three exact shapes and reject hybrids.
- Pack RNG is derived per runner from race seed + gate and never consumes the base or skill streams. At each tick: expire
  effects; build one immutable rank/speed/lane snapshot; choose modes, blockers, targets, and lanes in runner-index order;
  evaluate skills; apply longitudinal acceleration/deceleration and block caps; move; resolve overlaps; record.
- Distance ties use lower input index. Target ties use gap, lateral distance, then lower input index. Lane candidates use
  lowest score, inside lane, then target index. Finished runners retain their final lane and do not make new decisions.

### Course and lane contract

- The race template supplies meter distance; imported course `distance` is only the source category code. Corners carry
  `start/end/number`; straights carry `start/end`; both are ordered, non-overlapping within their family, clipped, and exact.
- Empty/malformed layout is an error. The only fallback is an explicitly `straight` race with no usable source segments,
  which becomes one straight `[0, distance)`.
- The standard width is 11.25 m, one horse lane is 0.625 m, and initial position is `gate × horseLane`, clamped to the
  width. Source venue offsets and changing widths are unavailable and intentionally omitted from v3.

### Position-keeping and collision contract

- Checks, cooldowns, coefficients, thresholds, lane movement, vision, footprints, and blocking formulas are the exact
  pinned values in `docs/design/racing.md#pack-racing-r3`. The overall leader is the v3 pacemaker approximation.
- Speed layers are base/spurt × position coefficient, then target-speed skills; acceleration skills are added to base
  acceleration; front-block caps are applied after acceleration; current-speed modifiers produce actual travel speed.
- Type 21 is a duration-bound actual-speed modifier. Type 22 transfers its amount to current speed when it expires.
  Engine-v3 source duration is scaled by course distance / 1000; v2 timing remains unchanged.

### Launch-unique facts and telemetry

- R3 implements `bashin_diff_behind`, `bashin_diff_infront`, `blocked_front`, `blocked_side_continuetime`,
  `change_order_onetime`, `change_order_up_end_after`, `corner`, `distance_diff_rate`, `is_finalcorner`,
  `is_finalcorner_laterhalf`, `is_overtake`, `near_count`, and `temptation_count` with the units/edges in the design doc.
- Lane samples are meters from the inner rail. Pack events contain mode/target/value only—never private names or ids.
  Per-runner results expose non-normal mode time, blocked time, overtake attempts, and successful passes to the harness.
- The standard matrix target is 15–35% aggregate wins per strategy, no strategy above 60% in a row, and at least one Front
  win in every representative row. Existing player G1 targets and startup budget still apply.

## Deliverables

### 1. Technical design and course geometry

- Add a bounded typed course layout from the existing private course pack: ordered corners and straights clipped to the
  selected distance. Reject malformed or missing layouts explicitly and provide a documented straight-course fallback.
- Specify pack state, timers, tie breaks, lane coordinates, runner footprint, legal gaps, target selection, and RNG order.

### 2. Engine R3 state

- Track rank/order history, leader gap, nearby runners, position-keeping mode, mode expiry, lateral position/target, blocked
  duration, and overtake target per runner.
- Apply position-keeping target-speed modifiers before skills, then blocking caps; apply skill acceleration and lane movement
  in their documented layers. Keep all updates tick-based and deterministic.
- Extend timelines with compact lane samples plus `position-mode`, `blocked`, `overtake`, and `lane-change` events.
- Preserve engine-v1 replay and version the new input/timeline path.

### 3. Skill completion

- Implement every pack/course variable referenced by the 25 launch uniques, with documented units and edge behavior.
- Require 100% launch-unique compiler/runtime coverage. Unsupported non-launch R5 skills remain explicit and inactive.
- Add activation tests for final-corner, order-change, blocking, gap, nearby-runner, and overtaking conditions.

### 4. Renderer and HUD

- Drive vertical placement from simulated lanes, retaining gate identity separately.
- Show stable block/overtake/mode callouts without covering the player or skill popups. Reduced motion uses static labels.
- Keep interpolation allocation-free and delta-time based at 60/120 Hz.

### 5. Balance harness

- Expand `sim:balance` to report wins by strategy, mode time, blocked time, overtake success, HP exhaustion, and skill use
  across distance/tier/Form matrices.
- Establish and document a mixed-strategy viability band. Front Runner must no longer have zero representative wins, and no
  strategy may dominate outside the agreed band. Preserve the documented player G1 win-rate targets.

## Tests and validation

- Unit tests cover rank ties, mode transitions, lane bounds, target choice, blocker selection, collision avoidance, overtake
  completion, course boundaries, and deterministic RNG/event ordering.
- Property-style seed matrices assert finite state, monotonic distance, unique finish order, legal lanes, and completion.
- Replay/persistence tests cover the new compact lane timeline inputs without changing rewards or idempotency.
- Run lint/test/build, expanded simulations, and 390×844 playback inspection with 8- and 18-runner fields.

## Acceptance

- Front Runners are viable in the documented balance matrix because their strategy mechanics exist, not through a hidden
  stat bonus. Other strategies retain distinct behavior.
- Runners visibly form a pack, move lanes, block, and overtake from deterministic engine state.
- Every launch unique has implemented condition semantics and can activate in an appropriate synthetic scenario.
- Legacy and T006 replays remain stable and the startup bundle remains ≤180 KB gzip.

## Explicitly out of scope

- Slopes/downhill, dueling, spot struggle, rushed behavior, debuffs, R5 skill relationships, sound, haptics, and final
  start/finish presentation polish.
