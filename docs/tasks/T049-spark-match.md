# T049 — Spark Match

The match-3 minigame that raises an Uma's Training Level. Full rules:
[Minigames — Spark Match](../design/minigames.md#spark-match--training-levels).

## Fixed choices

- **Board:** 7 columns × 8 rows. Six tile kinds.
- **Tiles:** five Uma character icons assigned to the scenario, plus **the trainee's own icon** as the sixth.
  The scenario tile set comes from content; until it exists, take the first five starter Umas by id and warn.
- **Input:** swap two orthogonally adjacent tiles. A swap that creates no match is rejected and does not
  count as a move.
- **Run length:** 25 moves. No timer.
- **Scoring:** match of 3 = 30, of 4 = 60, of 5+ = 120. Each cascade step multiplies the running total for
  that chain by 1.2, compounding. A match containing the trainee tile scores ×2. Round once, at the end of
  each chain.
- **Board generation:** seeded, guaranteed to start with no pre-existing match and at least one legal move.
  After every resolve, if no legal move exists, the board reshuffles deterministically from the same seed
  stream and the reshuffle is shown.
- **Cost:** 5 tickets, spent by `beginRun` before the first swap.
- **Outcome:** `commitRun` with the final score. The host applies Training EXP, resolves levels, and returns
  which nodes opened.

## Implementation contract

```
apps/web/src/game/minigames/spark-match.ts        pure engine, no React
apps/web/src/game/minigames/spark-match.test.ts   fixed-seed fixtures
apps/web/src/screens/minigames/SparkMatchScreen.tsx
```

The engine exposes a reducer-shaped API — `createBoard(seed)`, `legalMoves(board)`, `applySwap(board, a, b)`
returning the resolved board plus the chain of clears and the score — so the screen animates a sequence the
engine already decided. Rendering may use PixiJS (already lazy-loaded for races) or DOM; PixiJS is the
recommendation at 56 tiles with cascades.

**The post-run summary is the part that matters most.** It names the score, the levels crossed, and **each
node that opened, by name**, with a direct link into the constellation. A minigame that does not visibly move
the Uma forward is a minigame the owner will skip.

## Tests

- Fixed-seed board fixtures: same seed, same board, same first ten legal moves.
- Scoring: a 3-match, a 4-match, a 5-match, a two-step cascade, and a trainee-tile match each pin their exact
  score.
- A swap with no resulting match leaves the board unchanged and the move count unchanged.
- A board with no legal move reshuffles rather than ending the run.
- `commitRun` called twice with one `runId` yields one reward.

## Out of scope

Scenario-specific board rules, the scenario tile-set content file, power-ups, and any second training
minigame. Do not touch save schema, domain, or the constellation.
