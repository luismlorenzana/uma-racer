# Race engine R3 findings

Research and validation for [T007](../tasks/T007-pack-racing.md). No private source rows, names, or ids are recorded here.

## Sources and confidence

- [torena-sim mechanics reference](https://github.com/jalbarrang/torena-sim/blob/main/docs/mechanics/README.md) is the
  implementation source for position-keeping timers/coefficients, lane movement, vision, blocking, overlaps, nearby
  footprints, skill duration scaling, and current-speed type 21/22 behavior. It attributes the base mechanics to client
  reverse engineering and calls out uncertain/newer behavior.
- [uma-skill-tools](https://github.com/alpha123/uma-skill-tools) was inspected as executable primary source for course
  segment semantics and condition boundaries.
- [GameTora's condition viewer](https://gametora.com/umamusume/skill-condition-viewer) corroborates condition units such as
  `distance_diff_rate`; it is a community explanation, not treated as an independent engine implementation.

The exact post-1.5-anniversary pacemaker selector is not known. R3 deliberately uses the overall leader. Imported course
packs also do not contain changing course widths or venue lane offsets, so v3 uses the documented standard 11.25 m width and
`gate × horseLane` initial position. Both choices are explicit, deterministic, and frozen by engine version rather than
being presented as exact original-game behavior.

## Private-pack audit

- 119 course templates and all 321 race-to-course joins were checked locally; no race referenced a missing course and no
  consumed corner/straight segment had invalid bounds after clipping to the selected race distance.
- The imported course `distance` field is a category code 1–4, not meters. The race template is the authoritative meter length.
- All 25 launch uniques compile and run under R3. Their aggregate effects are recovery (3), natural current speed (1),
  target speed (20), and acceleration (8); condition coverage includes every pack/course variable listed in the T007 spec.
- Whole-catalog support rises from the R2.5 baseline of 456/1504 skills to **829/1504**. Remaining rows stay explicitly
  inactive because they require later slopes, rushed, random course triggers, debuffs, counters, or R5 relationships.

## Engine choices

- Engine v3 snapshots clipped corner/straight geometry and compiled field skills. v1 remains skillless; v2 retains T006
  timing and behavior. Pack RNG is per runner and separate from base and skill streams.
- Pack decisions use a start-of-tick field snapshot and stable distance/index ordering, then runner motion is applied. This
  avoids iteration-order advantages while keeping a compact fixed-tick simulation.
- Course and pack skill facts are evaluated from that same snapshot. Missing neighbors use a finite 999-length sentinel;
  a tied field has `distance_diff_rate = 0`; rushed is out of scope so `temptation_count = 0`.
- Type 21 is an actual-speed modifier for its scaled duration. Type 22 is the same modifier plus an equal current-speed
  transfer on expiry, producing natural deceleration. This corrects the intentionally simplified R2.5 handling only in v3.

## Balance and performance

The checked-in harness reports wins by strategy, non-normal mode time, blocked time, overtake success, HP exhaustion,
max spurts, skill activations, and finish time across sprint/mile/medium/long, tiers 1/6/11, and Form endpoints. In the final
200-seed-per-row run (2,400 races), aggregate wins were Front **23.4%**, Pace **31.8%**, Late **21.2%**, and End **23.5%**.
Every strategy won in every row; Front went from the pre-pack zero-win gap to 5.5–56.5% by row without a stat override, and
the maximum share for any strategy in any row was 56.5%, within the 60% guardrail. Non-normal mode time ranged 12.2–21.4%,
mean blocked time 12.5–39.3 seconds per runner, and overtake success 3–24%. The synthetic neutral recovery activated exactly
once per runner. At tier-1 3200 m, it changed HP exhaustion **54.6% → 51.7%** and average finish **167.3 s → 164.5 s**;
T008 owns the remaining Long-distance recovery/presentation pass.
