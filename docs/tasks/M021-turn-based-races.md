# Milestone 21 — Turn-based races

**Outcome:** every race runs as a sequence of **one-second turns**. Phases start on fixed turns, skills fire and last
in whole turns, passing and blocking resolve each turn as explicit events, and the view plays the turns back to back
with pause, step and a slow speed. Stats decide races visibly: a better-trained Uma pulls away, closers come through
the field, and runners who run dry fade.

Decisions: D153 (generated rivals), D154 (the turn model) and D155 (how v6 is tuned). Owner: Claude. The engine and
view are live; what [Racing](../design/racing.md#engine-v6-turns-m021) describes is the built game, and this spec
keeps only what is still open.

| Task | Scope | State |
|---|---|---|
| T066 | Generated rivals (D153) | ✅ |
| T067 | The turn engine, engine v6 | ✅ |
| T068 | Skills on turns | ✅ |
| T069 | The turn view: pause, step, slow, turn counter | ✅ |
| T070 | Balance and docs (`pnpm sim:turns`) | In progress: finishing spread and distance balance |

## Landed

The owner's fixed choices (D154) are built: one-second turns, a turn count fixed by distance, race-wide phases on fixed
turns, playback control only (pause, step, Slow/1×/2×, skip), and records replaying on the engine they ran with.
[Racing — engine v6](../design/racing.md#engine-v6-turns-m021) describes the engine, the view and the tuning (D155);
`packages/race/src/turns.test.ts` covers turn counts, race-wide phases, finishing inside a turn, overtakes, blocking,
stats deciding a race, and skill durations and phase triggers in turns.

## T070 — Balance (`pnpm sim:turns`)

Targets in generated 12-runner fields, with the state measured 2026-09-25 (racing.md has the full table):

| Target | Draft | Now |
|---|---|---|
| A runner at twice the field's stats | wins 95%+, by 3 s or more | wins 100%, by about 2 s |
| +10% on every stat over the field's average | wins about 25–40% | 32–52% |
| Winner to last, 2,000 m | 2–6 s | 0.9 s: **open** |
| Overtakes per race | 10–40 | 55–83, most of them in the pack |
| Each style's win share | 15–35% | 12–40% from 2,000 m; fronts take half the sprints: **open** |
| G1 at TL10, fully bonded, by distance | even | 30–78% sprint and mile, 98–100% medium and long: **open** |

Next levers: more spread between rivals of a grade (their presets are shared), end closers' final-leg edge in
sprints, and Speed against stamina in the rivals' medium and long presets.

The stamina ladder (`pnpm sim:constellation`) and careers (`pnpm sim:careers`) are re-measured on v6 and their docs
updated. Racing.md lists every effect with its turn-based value.

## Out of scope

- Decisions during a race (owner: playback control only).
- Debuffs, rushing and team effects (D141).
