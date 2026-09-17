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

## Implementation contract

### One outcome, two clocks

- `simulateRace` still runs once, in full, before playback. The result record, rewards, and append-log identity stay exactly
  as defined by T005–T007; T008 adds no persisted presentation state and does not increment the engine version.
- `RaceScene` owns a presentation clock in addition to the timeline clock. At normal motion the start pre-roll is **2.4 s**:
  field card `0.0–0.8`, staged gates `0.8–1.5`, Ready `1.5–2.0`, and Go/camera push `2.0–2.4`. Timeline second zero is
  not advanced until that sequence ends, so seeded engine start delays retain their meaning.
- With reduced motion, the equivalent Field / Ready / Go text is shown in a **0.6 s** pre-roll without scale, spring, camera,
  bob, streak, or finish-hold motion. A replay uses the same pre-roll. `seek(t)` enters running playback at timeline `t`;
  Skip from any stage jumps directly to the already-computed finish and commits or reveals the same result.
- Playback speed affects timeline playback, not the pre-roll or result UI. Backgrounding pauses both clocks through the Pixi
  ticker. Completion remains guarded by both the scene and the existing idempotent persistence transaction.

### Deterministic cues and course labels

- A pure presentation module derives all cues from immutable timeline events. It never reads wall-clock time, generates
  randomness, or mutates the timeline. The renderer asks for the active cue at the current timeline second.
- Player skill activations, the player's late start and last-spurt decision, and player pack transitions are eligible. Rival
  skills are grouped into half-second source buckets; one named rival is shown with a `+N rival skills` count. Rival late
  starts are one grouped cue. Repeated player pack cues of the same kind within three timeline seconds are suppressed.
- Simultaneous candidates sort by source tick and then player skill → player start/spurt → player pack → rival event, with
  runner index and source order as stable tie-breakers. Cues occupy one slot at a time (1.7 s for a skill, 1.25 s otherwise).
  A non-player or pack cue delayed more than 2.5 s by the queue is dropped; player skill/start/spurt cues are never dropped.
  This guarantees one popup region with no overlapping skill and pack chips.
- Skill cues carry their compiled effect kinds. Results group the player's activations by skill id, count repeats, and label
  recovery separately from speed/acceleration. Content names are resolved at render time; missing retired content shows the
  snapshotted id instead of hiding the activation.
- Course text uses snapshotted v3 layout: numbered corners, `Final corner`, and `Final straight`. Legacy layouts show only the
  engine phase. Presentation must remain valid for v1/v2 records with no lane/layout/skill data.

### Finish and result behavior

- A photo finish is the same boundary used by `formatMargin`: the runner-up is more than zero and less than **0.15 lengths**
  behind the winner (Nose or Head). At normal motion only, the final 0.8 timeline seconds play at 0.4× and the finish frame
  holds for 0.65 s with a `Photo finish` label. This is renderer time only. Reduced motion and Skip reveal the result directly.
- The finish HUD uses the timeline's final placement rather than an interpolated distance sort. Last-spurt emphasis uses only
  transform and opacity in DOM plus the existing Pixi speed lines.
- Results are a scroll-safe full-screen sheet. They show placement/time, complete field/margins, EXP, levels, tickets, shard,
  an EXP meter, start → current player and field Form, and the activation summary. A first-place result gets deterministic
  decorative confetti; all entrance motion becomes immediate under reduced motion.
- `Train`, `Race again`, and `Races` are enabled only after the result record exists. Save failure keeps the result visible,
  disables all exit actions, and offers Retry save so an earned result cannot be abandoned. At a promotion gate, Race again
  is disabled as `Promote first`; Train and Races remain available under the existing progression rules.
- Loading a completed attempt is read-only: it reconstructs the snapshot, shows results immediately, does not complete again,
  and still exposes the activation/Form summary. Old result formats get the existing skillless/layoutless fallbacks.

### Balance closure contract

- The checked-in harness stays synthetic and supports a quick default run plus a documented final mode. Final mode covers at
  least 3,000 deterministic race seeds across tiers 1/6/11; G3/G1; Sprint/Mile/Medium/Long; k=0/3/6/9; all four strategies;
  no-skill/baseline/recovery variants; 8/12/18-runner fields; and even/under-trained/fully-trained player builds.
- The report records aggregate and worst-row strategy shares, representative G1 player win rates at k=0 and k=9, HP-empty
  and max-spurt rates, skill activations, position-mode time, blocking, overtake attempts/success, finish time, and measured
  engine runtime. Inputs, seed ranges, command, machine caveat, and target verdicts are written into research docs.
- Acceptance targets are: mixed-field strategy shares 15–35% aggregate, every strategy wins representative rows, no row is
  above 60%; recovery improves Long HP-empty/finish behavior; and a fully trained, sensibly skilled G1 player trends around
  35% wins at k=0 and 65% at k=9 while under-training remains clearly losable. "Around" is reported as observed data, never
  converted into a hidden player bonus. A miss is documented; gameplay constants change only with the required design,
  pinning-test, and append-only decision updates.

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
- Desktop emulation at 390×844 and landscape can close implementation acceptance. Real Home Screen safe areas, 120 Hz feel,
  touch ergonomics, and the silent switch remain explicitly owner-only iPhone checks and are not claimed from emulation.

## Explicitly out of scope

- Slopes, dueling, spot struggle, rushed behavior, complex/debuff/full skills, sound/music/haptics, new art assets, goals,
  badges, titles, promotion, inheritance acquisition, and Cards/collection progression.

## Implementation result

Implemented on `feat/race-presentation-balance`. The renderer now has the specified pure two-clock playback and cue
projection, the result sheet contains complete progression/Form/activation feedback and guarded navigation, and legacy
replays remain unchanged. The final **6,992-race** synthetic matrix is recorded in
[Race Engine R3 — Milestone 3 balance closure](../research/race-engine-r3-final-balance.md): the standard strategy guard and
Long recovery checks pass, while the broad all-strategy G1 player fixture reaches 25.6%→35.0% rather than the aspirational
35%→65%. D89 records why T008 does not distort the pinned Form curve before Milestone 4 can supply a real mature loadout.

Automated validation covers the clock, cue collisions, reduced motion, replay projections, and idempotent persistence.
Desktop browser validation covers 390×844 portrait, 844×390 landscape, direct-route reload, Skip, 8-runner results, and an
API-offline completion whose three queued writes returned from `error · 3 pending` to `idle` after reconnection. The owner
iPhone feel/safe-area/120 Hz check remains explicitly listed in `docs/open-questions.md` and is not claimed here.
