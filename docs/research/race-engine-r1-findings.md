# Race Engine R1 — Balance Findings

First measurements from `@racer/race` (milestone R1) running the **original game's formulas** against our **design stat
ranges**. Reproduce with `pnpm sim:balance` (script: `scripts/sim/strategy-balance.ts`). Measured 2026-09-14.

## Setup

- 12 identical baseline enemy Umas per race (G1 `npcRaceStats`, Uma Level 1 → field Form 80%), strategies rotating by gate.
- `scale` multiplies every stat before the race, to test how far our stat ranges sit from what the original formulas expect.
- 200 seeds per row.

## Results

| Tier | Distance | Scale | Stamina | HP ran out | Max spurt | Wins front / pace / late / end |
|---|---|---|---|---|---|---|
| 1 | 1200 | 1.0 | 336 | 0% | 100% | 0 / 88 / 44 / 68 |
| 1 | 1600 | 1.0 | 384 | **90%** | 63% | 0 / 5 / 156 / 39 |
| 1 | 1600 | 1.5 | 576 | 0% | 100% | 0 / 56 / 44 / 100 |
| 1 | 2400 | 1.0 | 432 | **100%** | 0% | 0 / 0 / 89 / 111 |
| 1 | 2400 | 2.0 | 864 | 25% | 100% | 0 / 9 / 21 / 170 |
| 1 | 3200 | 2.0 | 960 | **99%** | 0% | 0 / 0 / 174 / 26 |
| 5 | 2400 | 1.0 | 720 | **99%** | 25% | 0 / 0 / 165 / 35 |
| 5 | 2400 | 1.5 | 1080 | 0% | 100% | 0 / 8 / 15 / 177 |
| 11 | 3200 | 1.0 | 1600 | 25% | 100% | 0 / 0 / 10 / 190 |

Performance: about **0.8 ms per 12-runner race** on the dev Mac. That's plenty for on-device simulation and batch balancing.

## Findings

1. **Our stat ranges are stamina-starved under the original HP formula.** Tier 1 caps (600 baseline, ×0.8 Form) leave Mile,
   Medium, and Long fields running out of HP almost every race. In the original game, recommended stamina is roughly 600–1000+
   for these distances, before recovery skills.
2. **Front Runners never win, and closers dominate.** This is expected for R1: the original game balances strategies through
   **position keeping** (Front Runner speed-up and overtake modes, Pace Up/Down), **lane blocking**, and **recovery skills**,
   none of which exist yet (R3, R2.5). Late Surgers and End Closers win here because their early-race coefficients burn less HP.
3. **Long races need more than stats.** Even at 2× scale, 3200 m fields run out of HP. The original game relies on recovery skills there.
4. **The engine itself behaves plausibly**: deterministic, sensible finish times (1200 m ≈ 57 s, 2400 m ≈ 118–123 s), and stronger stats win reliably (see tests).

## Recommendation (for the owner, morning of 2026-09-15)

Keep the design's readable stat caps, and add **one race stat scale** in `@racer/domain`, applied together with Race Form
just before the engine:

```
engineStat = trainedStat × raceStatScale × form        raceStatScale ≈ 1.75 (tune with pnpm sim:balance)
```

- It maps our 600 → 2000 cap ladder onto the magnitudes the original formulas were tuned for, without touching the design
  docs' numbers or the relative Race Form edge.
- **Strategy balance is not solved by scaling.** It comes with R3 position keeping, and with basic recovery skills pulled
  forward into R2.5 (already planned). Re-run this table after each of those milestones.

Alternative considered: raise every baseline cap about 1.75× in the design docs. Same effect, but it would rewrite many numbers
the owner already approved.
