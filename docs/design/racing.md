# Racing

Racing is the **first system to be built** and the heart of the game. Races grant Uma EXP, complete
scenario goals, feed badges, and are where stats, skills, and cards finally pay off. **Races can be lost.**

## Race loop (player's view)

0. **Opening training first:** a scenario's races unlock after 1 training turn in that scenario (see [Training](training.md#opening-training)). Races cost no tickets.
1. **Pick a race** from the calendar or catalog. It shows grade, venue, surface, distance, rewards, and any scenario goals it counts toward.
2. **Pick the Uma, strategy, and skill loadout.** Aptitudes are shown for the race's surface, distance, and each strategy,
   along with the **Race Form** matchup (see below).
3. **Watch the race** in real time on a straight-line track. Speed controls are 1×, 2×, and skip.
4. **Results:** finishing order, margins, time, EXP gained, goal and badge progress, and new badges or titles with fanfare.

## Race catalog

Based on real JRA races (plus a few NAR dirt G1s), so names, venues, and distances are recognizable.

| Field | Example |
|---|---|
| `name` | Tokyo Yushun (Japanese Derby) |
| `grade` | Debut, Maiden, Pre-OP, OP, G3, G2, G1 |
| `venue` | Tokyo |
| `surface` | Turf / Dirt |
| `distance` | 2400 m. Category derived: Sprint ≤1400, Mile 1401–1800, Medium 1801–2400, Long ≥2401 |
| `series` | For example `triple-crown`, `triple-tiara`, `autumn-triple-crown`, used by goals and titles |
| `course` | Course layout data: sections, straights, corners, slopes. Later milestone |
| `fieldSize` | 8–18 |

### All races open from scenario 1 ✅

Every grade, **G1 included**, can be entered from scenario 1. Higher grades are harder because their fields are stronger
(`gradeFactor` below), not because they are locked.

## Difficulty: Race Form

**Goal:** races stay losable, but your Umas slowly get stronger than the field.

Both your Uma and the NPC field race with their stats multiplied by a **Form** value that depends on
**how many Uma Levels (from racing, not Training Level) your Uma is into her current scenario**:

```
k = (level − 1) mod 10                 → 0 at levels 1, 11, 21 … · 9 at levels 10, 20, 30 …

yourForm  = 0.80 + 0.02 × k            → starts at a 20% nerf, and each level removes 2%
fieldForm = 0.80 + 0.01 × k            → starts at a 20% nerf, and each level removes 1%

raceStat  = stat × form                (applied to the 5 stats before any race formula)
```

`stat` is the Uma's trained stat, which starts from her 5★ base stats (see [Uma Progression](uma-progression.md#uma-template-static-sourced-from-the-original-game)).

| Levels into scenario (k) | Your Form | Field Form | Your edge |
|---|---|---|---|
| 0 (level 1, 11, 21…) | 80% | 80% | ±0% |
| 3 | 86% | 83% | +3.6% |
| 6 | 92% | 86% | +7.0% |
| 9 (gate level) | 98% | 89% | +10.1% |

**Form resets each scenario ✅.** Without a reset, your Uma would reach 100% at level 11 and the field at
level 21, and after that the edge would disappear. With the reset, every tier opens as a fair fight at 80/80, and
your Uma finishes it about 10% ahead. After promotion the opponents are built to the new, higher caps.

## Opponents: the baseline enemy Uma ✅

Every NPC opponent uses **the same generic setup**. Only her identity (name, icon) and her **unique skill** differ.
Races get a clear NPC feel, and **every Uma in the game** can show up as an enemy.

### Field composition

- Drawn at random from **all Umas in the game**, owned or not.
- No duplicate characters, and never the same character as your Uma.
- Field size comes from the race (8–18).

### Baseline enemy setup

| Part | Setup |
|---|---|
| Stats | **Generic**, identical for every NPC in the race (below) |
| Aptitudes | **A** for the race's surface and distance, and in her strategy |
| Strategy | Her template's best strategy, so her unique skill triggers sensibly |
| Skills | **Baseline enemy kit** (the same for all NPCs) **plus her own unique skill** |
| Mood | Normal |

### Generic stats

```
npcStat[s]  = baselineStatCap(T) × gradeFactor[grade] × profile[distance][s] × fieldForm
gradeFactor = Debut/Maiden 0.80 · Pre-OP/OP 0.88 · G3 0.94 · G2 0.97 · G1 1.00
```

| Distance | Speed | Stamina | Power | Guts | Wit |
|---|---|---|---|---|---|
| Sprint | 1.00 | 0.70 | 1.00 | 0.80 | 0.85 |
| Mile | 1.00 | 0.80 | 0.95 | 0.80 | 0.85 |
| Medium | 1.00 | 0.90 | 0.90 | 0.80 | 0.85 |
| Long | 0.95 | 1.00 | 0.85 | 0.85 | 0.85 |

NPCs have no stat variation from each other. Races still vary through the simulation's own randomness (start delay,
Wit section randomness, skill activation).

> *Example:* a scenario 1 G1 Medium race at Uma Level 1 (k = 0). NPC Speed = 1200 × 1.00 × 1.00 × 0.80 = **960**, Stamina **864**.
> A fully trained Uma (1200 in every stat) races at 1200 × 0.80 = **960**, an even fight on stats. At k = 9 she races at 1176 against the field's 1068 Speed.

### Baseline enemy kit

- A fixed set of **4 strategy- and course-neutral white skills**: one HP recovery, one mid-race speed, one late-race speed,
  and one acceleration. A shared selector chooses them deterministically by skill id from supported candidates; the private
  importer validates the selection and race preparation repeats it, so no original-game ids enter git and every client using
  the same content version gets the same kit.
- Plus the NPC's **own unique skill**, at full strength.
- The kit doesn't grow per scenario. Difficulty scales through scenario caps, grade, and Race Form.

### Basic race skills (R2.5)

- Source values, durations, and cooldown metadata use a fixed-point scale of 10,000. Inherited unique magnitudes are ×0.5.
- Conditions are compiled into bounded OR-of-AND numeric comparisons; raw source expressions are never evaluated at runtime.
- `phase_random`, `phase_firsthalf_random`, and `phase_laterhalf_random` choose one seeded distance point in the requested
  whole/first-half/later-half phase. Other conditions in that group are checked at that point.
- A skill's condition groups are priority alternatives and the first matching group resolves the skill once per race.
  T006 retains cooldown metadata for replay and future R5 multi-activation rules, but does not repeat a resolved skill.
- Activation rolls and random trigger points use stable per-runner/per-skill streams derived from the race seed, keeping
  base start, section, and spurt randomness unchanged when a loadout changes.
- Wit-checked skills use `max(1 − 90 / effectiveWit, 0.20)`. Guaranteed source skills do not roll.
- Recovery restores the source fraction of max HP. Engine v3 scales source duration by `courseDistance / 1000`.
  Current-speed effects modify actual distance speed immediately for that duration; type 22 carries the same amount into
  current speed on expiry so it decelerates naturally. Target-speed and acceleration effects expire on a tick boundary.
- Unsupported variables or effects stay visible in the library but cannot be equipped into a race loadout. T007 adds the
  pack and course variables required by the remaining launch uniques.

### Pack racing (R3)

Engine v3 uses continuous lateral position measured from the inner rail. The standard course width is **11.25 m** and one
horse lane is `11.25 / 18 = 0.625 m`; lane values are clamped to `[0, 11.25]`. Imported corner and straight ranges are
sorted, clipped to the selected race distance, and snapshotted into the result. A course whose source geometry is empty is
rejected unless its race direction is explicitly `straight`, in which case `[0, distance)` is the straight fallback.

Position keeping runs through sections **1–10**. Normal mode checks every **2 s**; leaving a mode starts a **1 s** cooldown
before the next normal interval. A mode also ends after one section of travel. A separate seeded RNG stream per runner makes
these checks stable without changing start, section, spurt, or skill randomness.

| Mode | Entry / exit | Target-speed coefficient |
|---|---|---:|
| Front Speed Up | Leading by less than **4.5 m**, or **12.5 m** when the only Front Runner; Wit chance `20 × log10(0.1 × Wit)%`; exits over that lead | 1.04 |
| Front Overtake | Not first among Front Runners; same Wit chance; exits **10 m** ahead of the next Front Runner | 1.05 |
| Pace Up | Non-front gap from the pacemaker exceeds the strategy maximum; Wit chance `15 × log10(0.1 × Wit)%`; exits at a seeded point between thresholds | 1.04 |
| Pace Down | Gap is below the minimum and no positive speed effect is active; exits at a seeded point between thresholds or on a speed effect | 0.915 opening, 0.945 middle |
| Pace Up EX | A strategy expected to be farther back is ahead; highest priority; exits when that inversion ends | 2.0 |

For non-front strategies, `courseFactor = 0.0008 × (distance − 1000) + 1`. Pace thresholds are `3 m` / `5 × factor`,
Late `6.5 × factor` / `7 × factor`, and End `7.5 × factor` / `8 × factor`. The engine uses the overall leader as the
pacemaker because the post-1.5-anniversary selection algorithm is still unknown; that approximation is replay-versioned.
Pace Down uses `−0.5 m/s²` deceleration and **0.6× HP consumption**.

Lane target speed is `0.02 × (0.3 + 0.001 × Power)`, with the documented early lane-distance and late order modifiers;
lateral acceleration is **0.03 m/s²** and speed is capped at **0.6 m/s**. An overtake target must be visible and 1–20 m
ahead, catchable within 15 seconds at current relative speed, and slower in target speed; the closest front blocker is always
eligible. Passing candidates are one horse lane inside/outside the target and use stable inner-first/index tie breaks.

Front blocking requires `0 < gap < 2 m` and lane gap at most `(1 − 0.6 × gap / 2) × 0.75 horseLane`; speed is capped at
`(0.988 + 0.012 × gap / 2) × blockerSpeed`. Side blocking uses `|distance gap| < 1.05 m` and `< 2 horse lanes`.
Overlaps use `< 0.4 m` longitudinal and `< 0.4 horse lane` lateral gaps; the outer runner is moved out by 0.4 horse lane.
Nearby skill counts use `< 3 m` and `< 3 horse lanes`.

Launch-unique pack facts use these units: `bashin_diff_*` is the closest ahead/behind gap in 2.5 m lengths (999 when none),
`distance_diff_rate` is the runner's percentage between leader and tail (0 for a tied field), `change_order_onetime` is the
signed placement delta for the current tick, and `change_order_up_end_after` is cumulative places gained from phase 2.
`blocked_side_continuetime` is current continuous seconds, `is_overtake` means a live overtake target, and `near_count` uses
the nearby footprint above. `is_finalcorner` stays true from the final corner's start through the finish; its later-half flag
is true only within the second half of that corner. `temptation_count` is zero until R4 adds rushed behavior.

The mixed-strategy balance target is **15–35% aggregate win share per strategy** over the standard tier/distance/Form matrix,
with no strategy above 60% in a row and every strategy recording representative wins. This is a harness target, not a hidden
per-strategy stat bonus; the G1 player targets below remain the player-facing acceptance criteria.

### Difficulty target

An under-trained Uma, or one racing off-aptitude, loses to the field. A fully trained Uma with a good deck and loadout
should win a **G1** about **35% of the time at k = 0, rising to about 65% at k = 9**. Lower grades are easier.
Validate with headless batch simulation.

## Rewards

| Outcome | Uma EXP |
|---|---|
| 1st | `winExp[grade] × (1 + Σ raceBonus of equipped cards)` |
| 2nd–3rd | 25% of win EXP |
| Other | 0 |

See [Uma Progression](uma-progression.md#uma-level-and-exp) for `winExp`. Every result goes into the typed append-only
`raceResults` collection and will be checked by the later goal, badge, and achievement engines.

### Milestone 6 accomplishment facts

T015 extends new results with bounded award facts derived inside authoritative completion: normalized family/grade/venue/
course/surface/distance/series metadata, player start delay, first-final-spurt placement, strict section-checkpoint lead,
and inherited-unique activation. These facts are private-id metadata, not renderer state, and do not change engine v1/v2/v3
simulation or replay. Legacy results remain valid and use their frozen replay path when detailed retroactive facts are
needed; missing content/replay dependencies are labeled untracked rather than guessed.

T016 evaluates facts only after the race result/ordinary rewards/T014 goals are determined, then commits the badge entity,
append-only flair events, and exact new event ids in that same transaction. Course records compare exact stored course ids
and finish times. Race retries return stored ids and never reevaluate or replay fanfare.

## Presentation: straight-line real-time view

- The track is drawn as a **horizontal straight**. Runners move left to right in lanes, and the camera follows the pack.
- **Icons** (character icons) are the runners, with a gate number and the player's Uma highlighted.
- A **progress rail** shows every runner's position along the whole distance at a glance.
- **Phase banner:** Opening → Middle → Final Leg → **Last Spurt**, with course labels such as "Final corner" and "Final straight".
- Before timeline second zero, the renderer shows a 2.4-second field → staged gates → Ready → Go sequence. The engine's
  seeded start delays begin only when the gate opens. Reduced motion keeps the same text in a shortened 0.6-second sequence.
- **Stamina bar** for the player's Uma. A deterministic single-slot queue shows player skills, late start, last spurt, and
  pack state ahead of grouped rival activations, so simultaneous events never cover each other.
- **Finish:** Nose/Head margins (runner-up gap greater than zero and below 0.15 lengths) slow the final 0.8 timeline seconds
  to 0.4× and hold the finish frame for 0.65 seconds. Skip and reduced motion go directly to the same computed result.
- Results show the full field, rewards, EXP/levels, before→after player/field Form, and player activation effects. Save
  errors keep navigation locked behind Retry; after commit the actions are Races, Train, and Race again (disabled at a gate).
- Presentation state is never saved and never changes a simulation result. Replay derives it again from the immutable
  timeline; legacy results without skills, lanes, or layout retain readable fallbacks.

## Engine principles

- **Simulation is separate from rendering.** A pure, deterministic sim steps at a fixed tick (the original game reportedly uses 1/15 s).
- **Seeded RNG:** the same seed and the same inputs replay the same race.
- **Headless batch mode:** run thousands of races to tune Form, opponents, EXP, and badges.

## Race engine milestones

Based on [Race Mechanics Research](../research/race-mechanics.md):

| Milestone | Mechanics |
|---|---|
| R1: Core | Phases and sections, base and target speed per strategy, accel/decel, start delay and start dash, HP and consumption, minimum speed, last-spurt calculation, **Race Form** |
| R2: Variance | Wit section randomness, strategy/distance/surface aptitudes, mood, ground condition |
| R2.5: Basic skills | Speed, acceleration, and recovery skills with simple triggers (phase, distance, position). Unique and inherited unique skills. *Moved up because skills are now core* |
| R3: Pack | Lanes, position keeping, blocking, overtaking |
| R4: Drama | Dueling, spot struggle, rushed (kakari), slopes |
| R5: Full skills | Complex conditions, debuffs, gold skills interacting with their white versions |
