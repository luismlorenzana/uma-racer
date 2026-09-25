# Milestone 21 — Turn-based races

**Outcome:** every race runs as a sequence of **one-second turns**. Phases start on fixed turns, skills fire and last
in whole turns, passing and blocking resolve each turn as explicit events, and the view plays the turns back to back
with pause, step and a slow speed. Stats decide races visibly: a better-trained Uma pulls away, closers come through
the field, and runners who run dry fade.

Decisions: D153 (generated rivals, the first part, landed) and D154 (the turn model). Owner: Claude. **Every number
below is a tuning draft**; T070's balance run sets them.

| Task | Scope |
|---|---|
| T066 | Generated rivals (D153) ✅ |
| T067 | The turn engine, engine v6 |
| T068 | Skills on turns |
| T069 | The turn view: pause, step, slow, turn counter |
| T070 | Balance and docs (`pnpm sim:turns`) |

## Fixed choices (owner, 2026-09-25)

- **One turn is one second of race time.** The original's per-second speed, acceleration and HP rules carry over
  with a one-second step.
- **A course has a fixed turn count** from its distance: `turns(D) = ceil(D / baseSpeed(D))` with
  `baseSpeed(D) = 20 − (D − 2000) / 1000`. That is 58 turns at 1,200 m, 79 at 1,600 m, 100 at 2,000 m, 123 at
  2,400 m and 171 at 3,200 m. A runner still out at the last turn keeps running until she finishes.
- **Phases begin on fixed turns, the same for every runner:** Opening from turn 1, Middle leg from `⌈T/6⌉ + 1`, Final
  leg from `⌈2T/3⌉ + 1`, Last spurt from `⌈5T/6⌉ + 1`.
- **Playback control only.** The race runs itself; the player can pause on any turn, step one turn, and slow the
  playback. There are no decisions during a race.
- **History is kept.** Records replay on the engine they ran with (v1–v5); new races run v6.

## T067 — The turn engine (engine v6)

Every turn, all runners resolve from the same start-of-turn state, in this order:

1. **Phase and section** from the turn number. The turns split into 24 sections; each section rolls Wit's section
   randomness, as in the original.
2. **Effects** that ended last turn expire.
3. **Skills** read the start-of-turn state (T068).
4. **Spurt plan** on the first final-leg turn: v5's plan, from the distance left and her HP.
5. **Target speed:** v5's formula (style coefficient by phase, Speed from the final leg, the spurt, section
   randomness, skills, hills, duels), times her style band (below).
6. **Speed** moves toward the target by one second of acceleration (Power, aptitudes, style) or deceleration. The
   start dash runs until she reaches 85% of base speed, as before.
7. **Proposed move:** `d + (v + v′) / 2`.
8. **HP** drains for the second at her average speed, with the guts factor from the final leg. At zero she slows to
   her minimum speed.
9. **Passing.** Runners resolve front to back by proposed distance. A runner whose proposal would end within one
   length of an already-resolved runner in her lane looks one lane out, then one lane in:
   - a lane is free: she moves into it and keeps her move, and each runner she ends ahead of is an **overtake** event;
   - no lane is free: she ends one length behind the blocker at the blocker's speed, a **blocked** event.

   An unblocked runner drifts one step toward the rail when that lane is free.
10. **Finishing.** A runner who crosses the line finishes on this turn, and the fraction of the turn at which she
    crossed sets her time, so photo finishes still resolve.

**Style bands** replace v5's position keeping. Through the opening and middle legs, each style holds a band behind
the leader, in lengths: Front 0–3, Pace 3–8, Late 8–14, End 12–20. Ahead of her band she eases (target × 0.985);
behind it she presses (× 1.015). From the final leg everyone races.

**Records:** a v6 timeline records one frame per turn (`tickRate` 1), so the existing arrays and playback
interpolation carry over. Race records gain `engineVersion: 6`; the domain parser and the API validator accept it.

## T068 — Skills on turns

- Conditions are checked once per turn for each runner.
- **Durations** are the original's seconds × distance / 1,000, rounded to whole turns, at least 1.
- **Phase-random triggers** (`phase_random`, `phase_laterhalf_random` and the like) pick a random turn inside the
  phase's turns. **Course-random triggers** (corners, straights, slopes) pick a random point there and fire when she
  reaches it, since they are places on the track.
- Timers (`blocked_front_continuetime`, `overtake_target_time` and the like) count turns.
- Speed and acceleration effects apply for their turns as in v5; T070 retunes their sizes.

## T069 — The turn view

- **Speeds:** 1× plays a turn in 0.5 s (a 2,400 m race in about a minute), 2× in 0.25 s, Slow in 1.5 s. **Pause**
  holds the current turn; **Step** moves one turn forward or back while paused; **Skip** jumps to the finish.
- **HUD:** "Turn 42 / 123 · Middle leg", beside the player's stamina bar.
- **Cues** on the turn they happen: the player overtaking or being blocked, rivals' and the player's skills.
- **Lanes at true scale**, replacing the exaggerated lane spread, so passing reads as passing.

## T070 — Balance (`pnpm sim:turns`)

Targets in generated 12-runner fields:

| Target | Draft |
|---|---|
| A runner at twice the field's stats | wins 95%+, by 3 s or more |
| +10% on every stat against an equal field | wins about 25–40% |
| Winner to last, 2,000 m | 2–6 s |
| Overtakes per race | 10–40 |
| Each style's win share | 15–35% |
| A winning closer | passes 4+ runners in the final leg |

The stamina ladder (`pnpm sim:constellation`) and careers (`pnpm sim:careers`) are re-measured on v6 and their docs
updated. Racing.md lists every effect with its turn-based value.

## Tests

- Turn counts and phase turns for each distance; phases are race-wide.
- Determinism: the same input gives the same timeline; v5 records still replay exactly on v5.
- Passing: a faster runner behind a slower one in a free field passes and records an overtake; boxed in on both
  sides, she is blocked and records it.
- Finishing inside a turn orders a photo finish correctly.
- Skills: durations in whole turns; a phase-random skill fires inside its phase's turns.
- The view: pause, step and speeds change only playback, never the result.

## Out of scope

- Decisions during a race (owner: playback control only).
- Debuffs, rushing and team effects (D141).
