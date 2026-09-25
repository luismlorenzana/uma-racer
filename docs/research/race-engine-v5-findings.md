# Race Engine v5 Findings

Research and verification for M018 (D139–D141). No private source rows, names, or ids are recorded here.

## Sources and how they were used

- [uma-skill-tools](https://github.com/alpha123/uma-skill-tools) — executable reimplementation of the original's race
  solver: `HpPolicy.ts`, `RaceSolver.ts`, `ActivationConditions.ts`, `CourseData.ts`.
- [torena-sim mechanics notes](https://github.com/jalbarrang/torena-sim/blob/main/docs/mechanics/README.md) — the
  community's full-field mechanics reference, including the dueling rules amended from replay data.

Both are GPL-3. They were **read to verify formulas** and every line in `packages/race` is our own implementation;
no code was copied. Formulas and constants are facts about the original game.

## Verified unchanged

Target speed and its strategy/phase coefficients, the distance-aptitude speed and acceleration modifiers, base
acceleration 0.0006, phase deceleration (−1.2 / −0.8 / −1.0), start dash (+24 m/s² until 0.85 × base speed), minimum
speed `0.85 × base + √(200 × Guts) × 0.001`, section randomness, max HP `0.8 × strategy coefficient × Stamina +
distance` with coefficients 0.95 / 0.89 / 1.0 / 0.995, HP drain `20 × (v − base + 12)² / 144`, the phase-2 guts
modifier `1 + 200 / √(600 × Guts)`, max spurt speed, the 60 m spurt buffer, and the Wit acceptance
`(15 + 0.05 × Wit)%`. Drain follows the runner's own velocity; skill current-speed modifiers move her without
draining more, as in both references. Our research doc's ⚠️ HP section is therefore confirmed.

## Changed in v5

| Area | Before (v4) | v5 |
|---|---|---|
| **Career-race stats (D139)** | Untrained floor `50 × TL`, 500 at TL10 | Every stat `base + 400`, the original's single-mode bonus ("in single mode, all uma gain 400 adjusted stats") |
| **Field by grade (D140)** | Flat factors G3 0.85, G2 0.92 | A grade's field is a typical Uma at its career stage's Training Level: G3 TL3, G2 TL6, G1 TL10 |
| **Last spurt** | Spurt from the final leg at the fastest speed HP holds the whole way | Each slower speed pairs with the latest start HP allows, holding the final-leg pace until then; pairs sorted by finish time; Wit accepts or passes each; a final-leg heal before the spurt re-plans |
| **Pace Down** | Phase deceleration | −0.5 m/s² |
| **Hills** | None | Uphill: target −(slope% × 200 / Power), base accel 0.0004. Downhill: each second a Wit × 0.04% chance of accel mode (+0.3 + slope%/10 m/s, HP drain ×0.4), 20% chance per second to end. Separate RNG per hill |
| **Duels** | None | Final straight, within 3 m and ¼ course width for 2 s, one of the pair in the top half, both ≥15% HP, speeds within 0.6 m/s → +`(200 × Guts)^0.708 × 0.0001` target speed, +`(160 × Guts)^0.59 × 0.0001` accel; ends below 5% HP or 5 m clear of every duelist; former duelists never duel again |
| **Gate skills** | Unsupported | Green stat boosts (effects 1–5) and start-delay multipliers (effect 10) resolve at the gate |
| **Conditions** | 42 variables | +41: random points on the course's corners, straights, phases and hills; the race clock; course facts; counters |
| **Rival effects (D141)** | Applied to the user | Imported with their target and never applied |

Downhill speed uses the slope's magnitude: torena-sim gives `0.3 + SlopePer/10` for a descent, while uma-skill-tools
adds the signed value (which would make a steeper descent slower). We follow the documented formula.

## Balance after v5 (`pnpm sim:constellation`, `pnpm sim:careers`)

- The stamina ladder's hard checks hold at tiers 1, 7 and 14, with the same outcomes as v4.
- G1 win rates at TL10 (best strategy, tier 1): sprint 63%, mile 62%, medium 53%, long 55%.
- Each career stage's race at its own Training Level (best of four strategies and the decks per distance):

  | Tier | Maiden G3 at TL3 | Trials G2 at TL6 | Main G1 at TL10 |
  |---|---|---|---|
  | 1 | 70–85% | 75–90% | 65–75% |
  | 7 | 65–70% | 75–85% | 55–85% |
  | 14 | 50–75% | 50–75% | 55–60% |

  Before D139 no stage race reached 35% below TL6 (T060).

## Out of scope (D141)

Debuffs, rushing (kakari), spot struggle, team effects, and conditions that depend on them (`is_temptation`,
`temptation_*`, popularity, `random_lot`, several continuity counters) stay unsupported. Vision (effect 8) and lane
speed (effect 28) are deferred.
