# Race Engine R3 — Milestone 3 balance closure

Date: 2026-09-16. Task: T008 (spec archived in git history). All checked-in inputs are invented,
shape-correct fixtures. No private content rows, original-game ids, or extracted values appear in the harness or this report.

## Method

The final command is `pnpm sim:balance -- --final` (the same script was invoked through the already-cached `tsx` binary
when this sandbox could not resolve npm). It simulated **6,992 deterministic races** and covered:

- tiers 1/6/11, G3/G1, 1,200/1,600/2,400/3,200 m, and Form positions k=0/3/6/9;
- Front/Pace/Late/End strategies, 8/12/18-runner fields, and no-skill/recovery/baseline-kit variants;
- under-trained, field-matched, and fully-trained player builds; and
- an isolated tier-1 Long recovery comparison with identical seeds and 8/12/18-runner fields.

The 48-row broad sensitivity matrix uses 40 seeds per cell so it can span every axis. The stricter strategy acceptance
guard separately repeats the established 12 standard G1 rows at 200 seeds per row. Player rows use a synthetic NPC
baseline kit plus unique and a representative player loadout with four additional supported card skills; this models the
shape of a mature loadout without copying private data. Runtime was measured inside `simulateRace`; wall-clock numbers are
host- and load-dependent and were collected while other local validation was active.

## Results

| Matrix | Races | Key result |
|---|---:|---|
| Broad strategy sensitivity | 1,920 | Front 27.9% · Pace 30.8% · Late 20.9% · End 20.5% |
| Standard strategy guard | 2,400 | Front 23.4% · Pace 31.8% · Late 21.2% · End 23.5% |
| Fully-trained G1 player | 1,280 | k=0: 25.6% (164/640) · k=9: 35.0% (224/640) |
| Paired player build/skill comparison | 1,152 | under 1.6% · field-matched 7.3% · full 17.7% |
| Long recovery isolation | 240 | HP empty 55.8% → 51.7% · average finish 167.3 s → 164.5 s |

The broad matrix produced 4.8% HP-empty, 93.8% max-spurt, 2.56 activations per runner, 17.8% non-normal-mode time,
25.2 blocked seconds per runner, 8.8% overtake success (65,438/746,907 attempts), and a 103.4-second mean finish.
Its aggregate shares are healthy, but the deliberately sparse extremes exposed a 72.5% Front cell in a tier-1 G3 Long
baseline-kit row and five zero-win strategy cells out of 192. Those are sensitivity signals, not failures of the 200-seed
standard acceptance guard.

The standard guard passed all three R3 requirements: every strategy's aggregate share was 15–35%, its worst row was 56.5%,
and every strategy won in every row. It recorded 6.0% HP-empty, 92.9% max-spurt, one activation per runner, 18.5%
non-normal-mode time, 27.5 blocked seconds per runner, 5.7% overtake success (61,444/1,083,208), and a 115.9-second mean
finish. This independently reproduces the T007 result rather than relying on the previous report.

The paired player comparison behaved monotonically by training: under-trained 1.6%, field-matched 7.3%, and fully-trained
17.7%. The deliberately mixed player skill comparison was no skills 6.3%, recovery only 7.6%, and the synthetic baseline
variant 13.1%. Across the representative target rows, the engine averaged 4.99 activations per runner, 9.0% HP-empty,
89.0% max-spurt, 24.7 blocked seconds per runner, 9.1% overtake success, and a 103.7-second mean finish.

Measured engine time was **447.8 seconds** total: 60.15 ms/race for the standard guard, 65.02 ms/race for broad
sensitivity, 63.28 ms/race for target rows, and 68.74 ms/race for the paired comparison. These batch numbers include event
and lane timeline allocation for full fields; the dedicated local single-race performance assertion remains under 250 ms.

## Target verdicts and decision

- **Strategy viability: pass.** Position keeping keeps Front viable without a hidden strategy bonus; the standard aggregate,
  worst-row, and representative-win guards all pass.
- **Long recovery: pass as a material mechanic, not a stamina eraser.** One neutral 5.5%-max-HP recovery improves both
  depletion incidence and finish time while leaving Stamina and additional recovery meaningful. Low-tier Long fields can
  still empty HP, by design.
- **Under-training remains losable: pass.** The paired under-trained build won only 1.6%.
- **Aspirational G1 player curve: review.** The broad all-strategy result rose from 25.6% at k=0 to 35.0% at k=9 instead of
  roughly 35%→65%. Sensitivity runs showed that averaging intentionally poor distance/strategy combinations obscures a
  "sensible loadout" target, while forcing the aggregate to 65% would require an implausible Form change or a hidden player
  modifier. T008 therefore keeps the pinned 80→98% player and 80→89% field Form curves. Milestone 4's actual deck building,
  card skill costs, and player-selectable mature loadouts are the correct point to define a representative strategy/loadout
  fixture and revisit this target.

No engine, Form, HP, recovery, or opponent constants changed in T008. This is recorded in D89 rather than presenting a
synthetic-loadout limitation as a gameplay correction.

## Milestone 4 follow-up

T010 revisited the player target with the actual generated card-effect model and a deliberately sensible medium/Pace
mature skill loadout. The 300-seed rows measured **30.3% at k=0 and 27.7% at k=9**, so the curve still does not approach
35%→65% and is not monotonic in this narrower matchup. Weak/mid/mature Training gains and full method are recorded in the
[support-deck balance follow-up](support-deck-balance.md). No hidden bonus or pinned Form change was added; scenario
promotion, inheritance, and complete player loadout calibration remain the appropriate later tuning point.
