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
