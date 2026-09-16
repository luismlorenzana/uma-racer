# Race Engine R2.5 Findings — Basic Skills

Date: 2026-09-16. Command: `pnpm sim:balance` (200 seeds per row, 12-runner G1 fields). This report uses only
aggregate counts and synthetic skill inputs; no original-game rows or ids are stored here.

## Imported-skill coverage

- All 1,504 private skill rows parse through the bounded condition compiler.
- 456 are executable by T006; 1,048 remain explicitly unavailable because they need later variables or effects.
- By kind: white 172/598, gold 144/346, inherited unique 69/289, unique 68/249, upgraded unique 3/22.
- All 25 launch uniques parse. Three are fully executable in T006. The other 22 wait on T007 pack/course facts or effect
  22 (position boost); the aggregate missing-variable list is emitted by the private audit without names or ids.
- The deterministic private baseline selector resolves exactly four course/strategy-neutral whites: recovery, middle speed,
  late speed, and acceleration.

## Strategy and stamina baseline

The strategy-only matrix is intentionally still the pre-pack baseline. Front Runners won 0 of every 200-seed row, while
End Closers dominated Medium and high-stamina Long rows. T007 owns position keeping and must correct this through visible
pack mechanics rather than a hidden stat modifier.

| Tier | Distance | Field level | HP empty | Max spurt | Wins F / P / L / E | Avg winner |
|---:|---:|---:|---:|---:|---:|---:|
| 1 | 1200 | 1 | 0% | 100% | 0 / 83 / 53 / 64 | 56.4s |
| 1 | 1600 | 1 | 0% | 100% | 0 / 65 / 39 / 96 | 76.2s |
| 1 | 2400 | 1 | 25% | 100% | 0 / 9 / 21 / 170 | 118.1s |
| 1 | 3200 | 1 | 99% | 0% | 0 / 0 / 174 / 26 | 166.4s |
| 6 | 2400 | 1 | 0% | 100% | 0 / 8 / 17 / 175 | 117.4s |
| 11 | 3200 | 1 | 25% | 100% | 0 / 0 / 10 / 190 | 161.9s |

## Recovery comparison

The reproducible comparison gives every runner one synthetic guaranteed recovery equal to 5.5% of max HP at 70% HP in a
tier-1 3200m field. Across 2,400 runner results, HP exhaustion fell from **98.5% to 95.3%** and average finish time improved
from **167.0s to 164.4s**. Recovery therefore has a material outcome effect, but one white recovery does not erase Stamina's
importance or close the known Long-race exhaustion gap. T007/T008 should measure the real four-skill kit and player builds
before changing HP numbers.
