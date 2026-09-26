# Milestone 21 — Turn-based races

**Outcome:** every race runs as a sequence of **one-second turns**. Phases start on fixed turns, skills fire and last
in whole turns, passing and blocking resolve each turn as explicit events, and the view plays the turns back to back
with pause, step and a slow speed. Stats decide races visibly: a better-trained Uma pulls away, closers come through
the field, and runners who run dry fade.

Decisions: D153 (generated rivals), D154 (the turn model), D155 (how v6 is tuned), D158 (engine v7, the original's
physics and field) and D159 (realistic rivals). Owner: Claude. The engine and view are live; what
[Racing](../design/racing.md#engine-v7-the-originals-physics-and-field) describes is the built game, and this spec keeps
only what is still open.

| Task | Scope | State |
|---|---|---|
| T066 | Generated rivals (D153) | ✅ |
| T067 | The turn engine, engine v6 | ✅ |
| T068 | Skills on turns | ✅ |
| T069 | The turn view: pause, step, slow, turn counter | ✅ |
| T070 | Balance and docs (`pnpm sim:turns`); engine v7 and realistic rivals landed | In progress: finishing spread |

## Landed

The owner's fixed choices (D154) are built: one-second turns, a turn count fixed by distance, race-wide phases on fixed
turns, playback control only (pause, step, Slow/1×/2×, skip), and records replaying on the engine they ran with.
[Racing — engine v6](../design/racing.md#engine-v6-turns-m021) describes the engine, the view and the tuning (D155);
`packages/race/src/turns.test.ts` covers turn counts, race-wide phases, finishing inside a turn, overtakes, blocking,
stats deciding a race, and skill durations and phase triggers in turns. Engine v7 (D158,
[Racing — engine v7](../design/racing.md#engine-v7-the-originals-physics-and-field)) keeps the clock and replaces the
physics and the pack; its tests cover skills beating Speed, every stat counting, the Stamina estimate against the
engine, Spot Struggle, the competitions' sections, Power's swing and the final-straight window.

## T070 — Balance (`pnpm sim:turns`)

Engine v7 (D158) and realistic rivals (D159) replaced v6's tuning: the original's physics, the original's position
keeping and field mechanics, and rivals built like a real trained Uma. Targets in generated 12-runner fields, measured
2026-09-26 (racing.md has the full tables):

| Target | Draft | Now |
|---|---|---|
| Several procing skills beat 400 more Speed | wins most races | 83–95% at 2,000 m, by 0.27–0.36 s (v6: never) |
| Every stat moves a result | each of the five | yes: +300 of any one stat moves a runner up at 2,400 m |
| A runner at twice the field's stats | wins 95%+ | wins 100%, by about 1 s |
| +10% on every stat over the field's average | wins about 25–40% | 15–40% |
| Winner to last, 2,000 m | 2–6 s | 1.0 s: accepted for evenly matched fields; the spreading lever changes difficulty and waits on the owner |
| Each style's win share | 15–35% | 10–40%; late surgers low in sprints and miles, end closers high from 2,000 m |
| G1 at TL10, fully bonded | favoured | 95–100% |
| G1 at TL10, a new 0★ set | underdog | 30–75%: easier than D152's aim; the handicaps are the owner's call |

Rivals now roll their own three to seven whites (D163), so fields differ in how many skills fire. Remaining levers, both
the owner's call because they change difficulty: correlated stat rolls within the 80–100% rule (a wider field, a
stronger top rival) and the G1 handicap.

The stamina ladder (`pnpm sim:constellation`) passes every hard check on v7, and careers (`pnpm sim:careers`) are
re-measured; their docs are updated.

## Out of scope

- Decisions during a race (owner: playback control only).
- Debuffs, rushing and team effects (D141).
