# T071 — Spark Rival engine, simulator and touch proof

**Goal:** prove that Rival Circuit is a deterministic game worth building and that its defining drag feels like a native
phone interaction. This task does not replace the production Spark Match route and uses synthetic presentation assets.

Read [M022](M022-spark-rival-circuit.md), [Minigames](../design/minigames.md#spark-match--rival-circuit), D169–D172 and
[Spark Rival Circuit research](../research/spark-rival-circuit.md). Branch from current `main`; open a PR; never push to
`main`. No original-game content belongs in this PR.

## Scope

1. A pure TypeScript Rival Circuit engine, co-located tests and frozen v1 action grammar.
2. `pnpm sim:spark`, with synthetic encounters and reproducible balance output.
3. A lazy, development-only PixiJS touch vertical slice driven by that engine.
4. Engine/design pinning updates: final constants in the minigame design, D169 if the approved draft must change, and
   `packages/domain/src/domain.test.ts` for the player-facing numbers required by AGENTS.md.

The legacy engine and production route remain intact in this task. T073 deletes/replaces them after content and journal
support exist.

## Engine location and boundary

Create a small module family under `apps/web/src/game/minigames/spark-rival/`:

```text
types.ts        data-only public contract and parsers
rng.ts          deterministic named streams or wrapper around an existing pure seeded RNG
board.ts        path validation, swaps, match groups, gravity and fill
combat.ts       advantage, aptitude, intent and reward rules
engine.ts       create/replay/reduce and terminal-state checks
fixtures.ts     small invented encounters for tests and the touch proof
*.test.ts       co-located tests
```

No module in that folder imports React, PixiJS, Dexie, browser globals or wall-clock APIs. The engine never calls
`Math.random`. Inputs and outputs use readonly data; reducers do not mutate earlier states or actions.

The public contract includes, by semantics rather than necessarily these exact names:

```ts
type SparkOrb = 'front' | 'pace' | 'late' | 'end' | 'spark' | 'recovery'
type SparkRivalAction =
  | { type: 'drag'; path: readonly Cell[]; movementMs: number }
  | { type: 'spark-shift' }

interface SparkRivalEncounterV1 {
  version: 1
  scenarioTier: number
  trainingLevel: number
  trainee: { templateId: string; strategyAptitudes: StrategyGrades }
  waves: readonly [RivalDefinition, RivalDefinition, RivalDefinition]
}

interface SparkRivalReplay {
  state: SparkRivalState
  turns: readonly TurnResolution[]
  outcome: SparkRivalOutcome | null
}
```

Encounter and action parsers reject unknown keys, unknown versions, non-finite/non-integer numbers, overlong ids, out-of-
bounds cells, non-adjacent path steps and unbounded scripts. Public parsed limits are explicit constants and unit-tested.

## Frozen v1 rules

### Board and actions

- Board is row-major 6 × 5. New boards are generated without an existing match; skyfalls may cascade after a drag.
- A drag requires at least one cell transition: path length is 2 through **256 cells**, revisits are legal, and each
  consecutive cell differs by at most one row and column and is not identical. Reaching 256 resolves immediately like
  timeout; this is a serialization/safety ceiling, not a target interaction.
- `movementMs` is an integer from 1 through 7,000. It records the accepted movement interval for exact replay/debugging;
  damage is independent of how much unused time remained.
- The engine applies every path swap before it scans for matches. A path that makes no match is still a player turn; this
  is an execution error with consequences, not a free invalid move.
- A starting board is a seeded shuffle with exactly five of each orb kind, rejected/retried until match-free. Refills are
  uniform seeded draws. Resolution is capped at **64 cascade steps**; exceeding it is a deterministic engine error and a
  simulator/test failure, never a silently truncated board.
- Horizontal and vertical runs of three or more clear. Overlapping runs of the same orb connected orthogonally are one
  match/combo. Different orb kinds never merge. All groups in a cascade clear simultaneously.
- Gravity falls toward row 4. Fill order and all future orbs come from a board RNG stream. Rival choices/conversions use a
  separate stream so presentation or a board-rule refactor cannot change an authored intent sequence accidentally.
- A terminal state rejects further actions. Spark Shift is legal only when full and when the board contains Spark orbs;
  it changes all of them to the trainee's best strategy with Front/Pace/Late/End tie-break, consumes the full base charge,
  costs no turn and does not resolve the board.

### Combat order

Each accepted drag emits immutable presentation steps in the design order: match marks, clears, falls/fills, totals,
Front/Pace/Late/End/Spark attacks, Recovery, Spark charge, intent/countdown, wave transition or terminal result. Those
steps contain facts already decided by the engine; the renderer never recomputes a number.

- Advantage ring and multipliers are exactly D169/design: Pace → Front → End → Late → Pace; 1.5 / 0.67 / 1.0.
- Strategy aptitude draft multipliers are S 1.10 / A 1.00 / B .95 / C .90 / D .85 / E .80 / F .75 / G .70.
- Shape bonus, combo multiplier, base style/Spark damage, recovery, Drive, Resolve, pressure, countdown, Spark charge and
  EXP curves are named checked-in constants. Start from the formulas in the design/research, then tune through the sim.
- Resolve never underflows below zero; Drive never leaves `[0, maxDrive]`; integer rounding happens once at each displayed
  damage/recovery application and is pinned.
- Defeating a rival skips its pending action and advances with current Drive/Spark/board intact. The next rival begins with
  its authored opening countdown/intent. There is no between-wave heal unless an explicit checked-in curve grants it.
- A wave loses at zero Drive or after its eighth completed drag without zeroing Resolve. Victory after attack wins before
  the eighth-turn bound. The result records one stable loss reason.

Use this explicit first simulator baseline; T071 may tune it only with the rule above and records the landed values in the
design doc/pinning test:

| Constant/formula | Starting value |
|---|---|
| Maximum Drive | 100 |
| Match shape | `1 + 0.25 × (orbs − 3)` |
| Whole-turn combo | `1 + 0.20 × (combos − 1)` |
| Style attack per match | `round(40 × shape × combo × aptitude × matchup)` |
| Spark attack per match | `round(30 × shape × combo)` |
| Recovery per match | `round(6 × orbs × combo)` |
| Spark charge | cleared Spark orb count; base ready at 9 |
| Delay | +3 remaining requirement, ready threshold capped at 15 |
| Difficulty factor | `1 + 0.01 × (tier − 1) + 0.015 × (TL − 1)` |
| Wave Resolve | `round([500, 650, 900][wave] × difficulty)` |
| Base Pressure | `round([12, 16, 24][wave] × difficulty)` before recipe modifiers |
| Wave EXP budgets | 500 / 650 / 800 |
| Clear bonuses | +50 clear, up to +100 extra-combo, up to +100 Drive remaining |
| Loss cap | 45% of the 1,950 wave-budget total |

Wave-progress EXP is `floor(waveBudget × ResolveRemoved / maxResolve)` for an uncleared wave; a clear pays that wave's
exact budget. Loss applies the cap after summing wave progress and receives no clear bonuses. Extra-combo bonus is
`min(100, 10 × max(0, totalCombos − completedDrags))`; Drive bonus is `round(100 × remainingDrive / maxDrive)`.
These formulas ensure damage already dealt cannot be farmed again and healing/stalling cannot create EXP.

### Intent vocabulary

Implement only Pressure, Guard, Convert, Delay, Enrage and Change style. Scripts are bounded deterministic state machines,
not executable callbacks.

- Guard declares reduction and combo threshold before the turn and expires after that turn's damage.
- Convert declares source/target orb and maximum count; chosen cells use the rival RNG stream in stable cell order.
- Delay increases remaining Spark requirement up to a named cap; it cannot subtract accumulated charge.
- Enrage declares trigger and multiplier/addition, fires at most once, and remains visible.
- Change style declares threshold and next strategy, fires at most once, and immediately changes advantage/resistance.

## Training EXP result

The engine returns reward facts, not a mutated save. Each wave has a computed EXP budget. Damage progress can earn only a
bounded share; clear pays the rest. A final clear/combo/remaining-Drive bonus is bounded separately. Pin these invariants:

- identical terminal replay produces identical integer EXP;
- zero-progress loss pays zero; any real Resolve progress pays at least one;
- stalling/healing cannot increase EXP;
- a full clear is worth more than any loss from the same encounter;
- no loss exceeds the documented fraction of the competent-clear target;
- expected competent clear is near 2,200, preserving roughly ten clears for 21,600 EXP.

## `pnpm sim:spark`

Add a checked-in Node script using synthetic encounter templates only. It prints constants plus rows for scenario tiers
1/7/14, TL 1/5/9, all four rival styles/archetypes and representative strategy-aptitude profiles. Each row uses a fixed
seed set and reports clear rate, loss reason, turns/wave, combos/turn, Drive at clear and EXP/run.

Provide at least three deterministic agents:

- **random legal:** bounded random paths, a floor/smoke detector rather than a balance target;
- **greedy:** samples a fixed number of plausible paths and picks immediate effective damage/recovery;
- **planner:** values advantage, survival, Shift setup and the visible next intent over at least the current turn.

Agent randomness has its own fixed stream and must never affect engine RNG. A `--update`-style explicit mode may rewrite
the expected table; normal CI compares against tolerances and exits nonzero on drift. Starting targets for the planner are
65–85% clear rate overall, median wave clear by turn 5–7, loss EXP materially below clear EXP and no strategy/style row
outside the documented band without an explanation in the PR. T074 may refine the targets with device play.

## Pixi touch vertical slice

Create a lazy development-only route (for example `/dev/spark-rival-proof`) that cannot appear in the production nav. Use
synthetic glyph orbs and a synthetic rival card. It must exercise the real v1 engine:

- one captured pointer, `touch-action: none`, second pointer ignored;
- deterministic cell interpolation for skipped pointer samples, tested separately from DOM events;
- held orb follows at a small upward finger offset; origin/next swap remains visible;
- cancel/lost capture restores the untouched pre-drag engine state;
- release and timeout send one action, lock input, then animate returned steps in order;
- no React state update on `pointermove`; inspectable counter remains zero during a drag;
- pooled 30 board sprites plus bounded effect pools, with live pool/frame debug readout in the proof only;
- reduced-motion toggle and background/foreground pause.

Use the app's existing PixiJS and Motion dependencies. Do not add a gesture or game-engine package.

## Tests

- Fixed-seed fixture pins initial board, first skyfall sequence, three actions and full state after replay.
- Path tests cover every direction, diagonal, revisit, invalid jump, repeated cell, bounds, max length/duration and no-match
  turn. The pointer interpolation fixtures cover horizontal, vertical, diagonal and large skipped samples.
- Match tests cover 3/4/5+, cross merge, simultaneous kinds and cascades; board inputs stay immutable.
- One test for every advantage relation, opposite neutrality and every aptitude grade.
- One test for every intent, threshold ordering, wave transition, Drive/Resolve clamps, eighth-turn victory/loss and Shift.
- Parser/property-style loops reject malformed bounded inputs without network or wall clock.
- Replay the same seed/actions repeatedly and after JSON round-trip; require exact equality.
- Simulator snapshot/tolerance test and a `Math.random` source scan for the new engine/sim paths.
- Touch controller unit tests plus browser proof at 390 × 844 and 375 × 667.

## Acceptance

- `pnpm sim:spark`, `pnpm lint`, `pnpm test` and `pnpm build` pass; PR records output and web startup gzip size.
- Mid-drag and cascade screenshots at 390 × 844 are attached to the PR.
- A local-LAN physical-iPhone note records drag acquisition, finger occlusion, edge gestures, cancellation and 30 seconds of
  frame pacing. If owner hardware is unavailable, the PR may merge only as an explicitly unaccepted proof and T072 must
  not start until the owner approves the interaction.
- Production `/minigames/spark-match/:umaId`, save, DB schema and private content are unchanged.

## Out of scope

Real Uma ids/art, content importer changes, ticket spending, Dexie journals, Training EXP persistence, route cutover,
production tutorial/results, audio/haptics and final balance.
