# T008 — Race presentation and balance closure (Milestone 3, part 3)

**Goal:** turn the T006/T007 mechanics into one finished mobile race flow: staged gates, readable event feedback, dramatic
close finishes, complete results feedback, and a documented balance report that closes Milestone 3.

Depends on: `T007-pack-racing.md`.

Read first: `AGENTS.md`, `docs/design/racing.md`, `docs/design/ux.md` §§Race/Results/Feedback, architecture, decisions,
T006, T007, and their balance findings.

## Scope and fixed choices

- Presentation consumes timeline events and stored results; it never invents gameplay state or changes race outcomes.
- Add a staged gate/start sequence, late-start feedback, skill/mode/block/overtake callouts, last-spurt emphasis, and a
  photo-finish treatment for documented close margins.
- Results build on T005: placement, field, EXP, levels, tickets, shard, updated Form edge, activation summary, and Race
  again/Train/Races actions. Rewards remain committed exactly once at finish/skip.
- Sound, music, haptics, final character art upgrades, and 120 Hz device tuning remain Milestone 7 unless already available
  without new assets. Reduced-motion behavior is required now.
- T008 may tune only numbers backed by the final simulation report and must update design, pinning tests, and decisions.

## Deliverables

### 1. Start-gate flow

- Add a short renderer-owned pre-roll: field card, runners staged by gate/lane, gate snap, and camera push. Simulation time
  starts at the gate event; individual seeded start delays remain engine-owned.
- Make late starts visible and ensure 1×/2×/Skip, wake lock, navigation, and replay behave correctly during pre-roll.

### 2. Event presentation

- Schedule skill activation bursts/name chips and pack callouts from timeline ticks, with collision/queue rules that keep
  the player readable during simultaneous events.
- Emphasize Last Spurt with transform/opacity effects and preserve the current progress rail, HP, phase, and place HUD.
- Add a close-finish freeze/brief slowdown for Nose/Head margins; Skip goes directly to the same stored result.

### 3. Results completion

- Animate the placement stamp, win confetti, EXP/level meter, +5 ticket movements, gate shard, and updated player/field
  Form comparison. Reduced motion uses immediate state with equivalent text.
- Show activated skills with counts and decisive recovery/speed effects. Missing retired content falls back to ids.
- Add `Train`, `Race again`, and `Races` CTAs with promotion-gate and commit-error behavior.

### 4. Milestone balance and documentation

- Run a reproducible multi-thousand-seed matrix over tiers, grades, distances, strategies, Form levels, skill/no-skill,
  recovery/no-recovery, 8/12/18 runners, and representative player builds.
- Report win share, player G1 win rate, HP exhaustion, max spurt, activations, block/overtake rates, finish times, and engine
  runtime. Compare against every documented target and explain any approved adjustment.
- Update README milestone status, racing/UX/architecture docs, research findings, decisions, and open questions.

## Tests and validation

- RaceScene tests/view-model tests cover event scheduling, pre-roll, skip, replay, simultaneous popups, close finishes, and
  reduced motion without introducing a component-test dependency.
- Persistence tests confirm presentation cannot double-complete or mutate replayed results.
- Run full lint/test/build, balance matrix, clean direct-route reload, offline completion/sync, and 390×844 plus landscape
  browser checks. Verify on the owner's iPhone before declaring feel/touch completion.

## Acceptance

- A progression race has a coherent start, readable skill/pack drama, deterministic finish, and complete reward/result flow.
- The final balance report shows recovery addressing Long stamina and position keeping making Front Runners viable while
  preserving losable races and the documented Form curve.
- Every historical result format remains readable, every new replay is exact, CI/deploy checks pass, and startup stays
  ≤180 KB gzip.

## Explicitly out of scope

- Slopes, dueling, spot struggle, rushed behavior, complex/debuff/full skills, sound/music/haptics, new art assets, goals,
  badges, titles, promotion, inheritance acquisition, and Cards/collection progression.
