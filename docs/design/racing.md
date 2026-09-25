# Racing

Racing is the **first system to be built** and the heart of the game. Races grant Uma EXP, win
[career goals](scenario-goals.md), feed badges, and are where stats, skills, and cards finally pay off. **Races can be lost.**

## Race loop (player's view)

0. **Opening training first:** a scenario's races unlock after 1 training turn in that scenario (see [Training](training.md#opening-training)). Races cost no tickets.
1. **Pick a race** from the calendar or catalog. It shows grade, venue, surface, distance, rewards, and any career goal it counts toward.
2. **Pick the Uma, strategy, and skill loadout.** Aptitudes are shown for the race's surface, distance, and each strategy.
3. **Watch the race** turn by turn on its own course ([engine v6](#engine-v6-turns-m021)): 1× plays two one-second
   turns a second, and Slow, 2×, pause, step one turn and skip are always at hand.
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
(the grade handicap below), not because they are locked.

## Difficulty: the grade handicap

**Goal:** a fully trained Uma is favoured in every race, and the grade decides by how much (D152; retuned for the
turn engine, where stats decide races, in D155).

Your Uma races with **the stats on her profile**: her base stats plus what her constellation pays. Nothing is added
or multiplied at the gate. Rivals are built as **a typical fully trained Uma of your tier**, then handicapped by the
race's grade:

| Grade | Handicap | Rivals race at |
|---|---|---|
| Debut, Maiden | 35% | 65% of a trained Uma |
| Pre-OP, OP | 30% | 70% |
| G3 | 25% | 75% |
| G2 | 15% | 85% |
| G1 | 5% | 95% |

**A percentage, not a fixed amount.** Trained stats grow from about 950 a stat in scenario 1 to about 1,260 in
scenario 14, so a fixed cut of, say, 300 would take a third of a scenario-1 rival and a quarter of a scenario-14 one,
and the same grade would get harder as you climbed. A rival's stats are also uneven by distance, and a fixed cut
bites hardest on her weakest stat (a sprinter's stamina), changing how she runs rather than how strong she is. The
race formulas read stats in proportion, so a percentage is the same gap on the track at every tier.

**No Race Form.** Training Level is not a race modifier: it opens constellation nodes, and those are what make your
Uma stronger. An under-trained Uma is weaker because her tree is, not because of a multiplier. This replaces the
Race Form of D24–D25.

## Opponents: generated rivals ✅

Every race rolls a **fresh field** (D153): how many rivals run each style, which Umas run them, and every rival's
stats. No two rivals share a build, so the field spreads out, and a race is never a rerun of the last one. **Every Uma
in the game** can show up as a rival.

### Rolling a field

1. **Styles.** The rivals split across Front Runner, Pace Chaser, Late Surger and End Closer, **two to five of each**,
   every valid split equally likely: one race has two fronts and five closers, the next four and four. An 8-runner
   race's seven rivals have one to five of each, so every style still shows.
2. **Stats.** Each rival starts from her **preset**, her 100% (below), and **every stat is rolled between 80% and
   100%** of it. A lucky rival nears her preset; an unlucky one can come up short on Stamina and run dry before the
   line, which is part of the race.
3. **Who runs them.** Rivals are drawn at random from all Umas (no duplicate characters, never your Uma's), and each
   style goes to the Uma with the best aptitude for it among those drawn, rarer styles first, so front runners are
   Umas who front-run.
4. **Gates** are shuffled, so styles land anywhere in the gate order.

The roll uses the race's seed, so a replay shows the same field, and the race record keeps every rival's stats.

### Baseline enemy setup

| Part | Setup |
|---|---|
| Stats | Her style's preset for this scenario, distance and grade, each stat rolled 80–100% |
| Aptitudes | **A** for the race's surface and distance, and in her strategy |
| Strategy | Rolled with the field (above) |
| Skills | **Baseline enemy kit** (the same for all NPCs) **plus her own unique skill** |
| Mood | Rolled each race, like everyone's ([engine v6](#engine-v6-turns-m021)) |

### Presets

A preset is a rival's 100%: a trained Uma of your tier, handicapped by the grade, and shaped by the distance, her
running style and the scenario's caps. There is one for every scenario, distance and style, 224 in all.

```
preset[s]   = min(cap[s], trainedStat(T) × (1 − handicap[grade]) × shape[s] / mean(shape))
shape[s]    = distance[s] × style[s] × √(cap[s] / averageCap(T))
trainedStat = 110 + treeBudget(T) / 5      median base stat + a fifth of a full tree of 5★ current-era cards
handicap    = Debut/Maiden 0.35 · Pre-OP/OP 0.30 · G3 0.25 · G2 0.15 · G1 0.05
```

`trainedStat` is 950 in scenario 1 and about 1,259 in scenario 14. The scenario term makes rivals lean the way its caps
lean (Trackblazer's rivals carry more Stamina, Run! Mecha Umamusume's more Speed and Power), at the square root so no
stat runs away. Each profile row averages 1, so it shapes a build rather than shrinking it.

The distance profile is built the way a trained Uma is (D155): **Speed first**, as every real build stacks it, and
the Stamina the distance needs, set so a good roll holds a full spurt and a poor one can fall short on the longer
trips. Evenly spread rivals, as first drafted, lost every race to a Speed-stacked player once stats decided races.

| Distance | Speed | Stamina | Power | Guts | Wit |
|---|---|---|---|---|---|
| Sprint | 1.50 | 0.65 | 1.10 | 0.80 | 0.95 |
| Mile | 1.45 | 0.80 | 1.05 | 0.75 | 0.95 |
| Medium | 1.40 | 1.00 | 1.00 | 0.70 | 0.90 |
| Long | 1.30 | 1.25 | 0.90 | 0.75 | 0.80 |

| Style | Speed | Stamina | Power | Guts | Wit | Why |
|---|---|---|---|---|---|---|
| Front Runner | 1.05 | 1.00 | 0.90 | 1.00 | 1.05 | Holds the lead on Wit; burns the most HP per point of Stamina |
| Pace Chaser | 1.05 | 1.00 | 1.00 | 0.95 | 1.00 | Balanced |
| Late Surger | 1.05 | 0.95 | 1.10 | 0.95 | 0.95 | Power accelerates the late surge |
| End Closer | 1.05 | 0.90 | 1.15 | 1.00 | 0.90 | Most Power for the spurt; the most HP from her Stamina |

> *Example:* scenario 1, a G1 Medium race. Presets (Speed / Stamina / Power / Guts / Wit): Front Runner
> 1,323 / 900 / 810 / 630 / 850, End Closer 1,319 / 807 / 1,032 / 628 / 727; a G3 End Closer is
> 1,041 / 637 / 814 / 496 / 574. A rolled rival lands anywhere from 80% of her preset to all of it, stat by stat.

Supersedes the identical generic NPC of D24 and D136–D152: rivals no longer share stats or a strategy per gate.

### Baseline enemy kit

- A fixed set of **4 strategy- and course-neutral white skills**: one HP recovery, one mid-race speed, one late-race speed,
  and one acceleration. A shared selector chooses them deterministically by skill id from supported candidates; the private
  importer validates the selection and race preparation repeats it, so no original-game ids enter git and every client using
  the same content version gets the same kit.
- Plus the NPC's **own unique skill**, at full strength.
- The kit doesn't grow per scenario. Difficulty scales through scenario caps and the grade handicap.

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

### Pack racing (R3, engines v3–v5)

Engine v6 replaces this section's position keeping and blocking with [style bands and per-turn passing](#engine-v6-turns-m021);
v3–v5 records still replay under it.


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

The mixed-strategy balance target is **15–35% aggregate win share per strategy** over the standard tier/distance/grade matrix,
with no strategy above 60% in a row and every strategy recording representative wins. This is a harness target, not a hidden
per-strategy stat bonus; the G1 player targets below remain the player-facing acceptance criteria.

### Difficulty target

An under-trained Uma, or one racing off-aptitude, loses to the field. At Training Level 10 a **fully bonded** set
should be favoured in every grade, with G1 the hardest; a new set of 0★ cards should win G3s but not G1s, so stars
are what turn a trained Uma into a G1 winner (D152–D155). `pnpm sim:careers` measures it on engine v6 at TL10 with
each distance's [ladder](constellations.md#balance-targets-the-stamina-ladder) decks against generated fields, best of
four strategies, 12 runners. Measured 2026-09-25, sprint / mile / medium / long:

| Tier | Set | G3 | G2 | G1 |
|---|---|---|---|---|
| 1 | 0★ | 100 · 70 · 75 · 35% | 33 · 0 · 3 · 0% | 0 · 0 · 0 · 0% |
| 1 | 5★ | 100 · 100 · 100 · 100% | 93 · 100 · 100 · 100% | 30 · 53 · 98 · 100% |
| 7 | 0★ | 98 · 58 · 80 · 18% | 30 · 0 · 0 · 0% | 0 · 0 · 0 · 0% |
| 7 | 5★ | 100 · 100 · 100 · 100% | 98 · 100 · 100 · 100% | 53 · 78 · 100 · 100% |
| 14 | 0★ | 98 · 65 · 83 · 65% | 38 · 5 · 5 · 8% | 0 · 0 · 0 · 0% |
| 14 | 5★ | 100 · 100 · 100 · 100% | 95 · 100 · 100 · 100% | 50 · 68 · 98 · 100% |

Stats now decide races, so a set's stars decide its grade: a new set wins G3s, a bonded one G1s. G1 is a coin flip in
sprints and nearly certain at medium and long distances, where the stamina ladder's decks outlast Speed-stacked
rivals; evening that out by distance is part of T070 ([M021](../tasks/M021-turn-based-races.md)).

### Stamina contest (engine v4)

Stamina above 1,200 turns into last-spurt speed once a runner reaches max spurt, as in the original game since its
JP 2.5th anniversary (D135):

```
bonus [m/s] = √(stamina − 1200) × 0.0085 × distanceFactor × random(0.98–1.02)
distanceFactor = ≤2,100 m 0 · 2,101–2,200 m 0.5 · 2,201–2,400 m 1.0 · 2,401–2,600 m 1.5 · 2,601 m+ 1.8
```

The stamina used is the race-start stat and is **not** halved above 1,200. It gives late scenarios' stronger
stamina cards a use past the requirement. Races recorded under engine v3 replay under v3.

## Rewards

| Outcome | Uma EXP |
|---|---|
| 1st | `winExp[grade] × (1 + Σ raceBonus of equipped cards)` |
| 2nd–3rd | 25% of win EXP |
| Other | 0 |

See [Uma Progression](uma-progression.md#uma-level-and-exp) for `winExp`. Every result goes into the typed append-only
`raceResults` collection and will be checked by the later goal, badge, and achievement engines.

### Milestone 6 accomplishment facts

New results (badge-state v1) include bounded award facts derived inside authoritative completion: normalized family/grade/venue/
course/surface/distance/series metadata, player start delay, first-final-spurt placement, strict section-checkpoint lead,
and inherited-unique activation. These facts are private-id metadata, not renderer state, and do not change engine v1/v2/v3
simulation or replay. Legacy results remain valid and use their frozen replay path when detailed retroactive facts are
needed; missing content/replay dependencies are labeled untracked rather than guessed.

T016 evaluates facts only after the race result/ordinary rewards/T014 goals are determined, then commits the badge entity,
append-only flair events, and exact new event ids in that same transaction. This is implemented for persistent and
memory-only play. The first finish on a course establishes its baseline; only a strictly lower later time earns Course
Record, so ties and slower finishes do not. Race retries validate and return stored ids without reevaluation or fanfare.

## Presentation: the race on its own course

- The race is drawn on **its own course**: the snapshotted corners and straights laid out as a path (each numbered
  corner a quarter turn, in the course's direction), with mowing stripes, rails, the start gate, the finish line,
  remaining-distance boards every 100 m, and hills shaded (a climb darker, a descent lighter). Lanes are drawn 3.5×
  their true width so a pack reads on a phone: at true width a field's icons would sit on top of each other.
- **Turn playback** (engine v6): the HUD shows "Turn 42 / 123" beside the race-wide phase; the bottom card holds
  step back, pause/play and step forward (by one turn, while paused) and Slow, 1× and 2×; Skip stays in the header.
  1× plays two turns a second, Slow a turn in 1.5 s. Older replays keep real time and step a second at a time.
- The camera follows the pack and **turns with the course**, so runners always travel left to right and a corner
  visibly bends ahead of them. A **minimap** in the corner shows the whole course and every runner.
- Races recorded before engine v3 have no course snapshot and are drawn on a straight.
- **Icons** (character icons) are the runners, with a gate number and the player's Uma highlighted.
- A **progress rail** shows every runner's position along the whole distance at a glance.
- **Phase banner:** Opening → Middle → Final Leg → **Last Spurt**, with course labels such as "Final corner" and "Final straight".
- Before timeline second zero, the renderer shows a 2.4-second field → staged gates → Ready → Go sequence. The engine's
  seeded start delays begin only when the gate opens. Reduced motion keeps the same text in a shortened 0.6-second sequence.
- **Stamina bar** for the player's Uma. A deterministic single-slot queue shows player skills, late start, last spurt, and
  pack state ahead of grouped rival activations, so simultaneous events never cover each other.
- **Finish:** Nose/Head margins (runner-up gap greater than zero and below 0.15 lengths) slow the final 0.8 timeline seconds
  to 0.4× and hold the finish frame for 0.65 seconds. Skip and reduced motion go directly to the same computed result.
- Results show the full field, rewards, EXP/levels, and player activation effects. Save
  errors keep navigation locked behind Retry; after commit the actions are Races, Train, and Race again (disabled at a gate).
- Presentation state is never saved and never changes a simulation result. Replay derives it again from the immutable
  timeline; legacy results without skills, lanes, or layout retain readable fallbacks.

## Engine principles

- **Simulation is separate from rendering.** A pure, deterministic sim steps at a fixed tick: one-second turns in engine
  v6 (M021); 1/15 s, as the original game reportedly uses, in v1–v5, which still replay their own records.
- **Seeded RNG:** the same seed and the same inputs replay the same race.
- **Headless batch mode:** run thousands of races to tune opponents, EXP, and badges.

## Race engine milestones

Based on [Race Mechanics Research](../research/race-mechanics.md):

| Milestone | Mechanics |
|---|---|
| R1: Core | Phases and sections, base and target speed per strategy, accel/decel, start delay and start dash, HP and consumption, minimum speed, last-spurt calculation |
| R2: Variance | Wit section randomness, strategy/distance/surface aptitudes, mood, ground condition |
| R2.5: Basic skills | Speed, acceleration, and recovery skills with simple triggers (phase, distance, position). Unique and inherited unique skills. *Moved up because skills are now core* |
| R3: Pack | Lanes, position keeping, blocking, overtaking |
| R4: Drama (engine v5) | **Slopes and final-straight dueling** ✅. Spot struggle and rushing are out: in a one-Uma game they are randomness with no decision behind them (D141) |
| R5: Full skills (engine v5) | Random course points, the race clock, course facts, counters, green and gate skills ✅. Debuffs and team effects are out (D141) |
| Turns (engine v6, M021) | One-second turns, race-wide phases, per-turn passing, style bands, mood, and a Speed term that decides races ✅ |

### Engine v5 (M018)

Verified against uma-skill-tools and the torena-sim mechanics notes; see [Race Engine v5 Findings](../research/race-engine-v5-findings.md).

- **Last spurt plan.** At the final leg she spurts at max speed if her HP holds it. Otherwise each slower speed is
  paired with the latest point she can start it, holding her final-leg pace until then; the plans are tried fastest
  finish first and Wit decides whether she takes each. A heal in the final leg before her spurt re-plans it.
- **Hills.** Climbing costs `slope% × 200 / Power` m/s and uses base acceleration 0.0004. On a descent, each second
  has a `Wit × 0.04%` chance of downhill mode: +`0.3 + slope%/10` m/s and HP drain ×0.4, ending at 20% a second.
- **Duels** on the final straight: two runners within 3 m and a quarter of the course width for 2 s, one of them in
  the top half, both above 15% HP and within 0.6 m/s of each other. Both gain `(200 × Guts)^0.708 × 0.0001` target
  speed and `(160 × Guts)^0.59 × 0.0001` acceleration until below 5% HP or 5 m clear of every duelist.
- **Gate skills.** Green skills add their stat before the gates open; Concentration-style skills scale the start delay.
- **Only a runner's own effects apply** (D141): skills whose effects all target rivals or teammates read "Not in
  this game" and cannot be equipped.
- Ground condition, weather and mood read Good, sunny and normal until the game models them.
- v1–v4 results replay under their own rules.

### Engine v6: turns (M021)

A race is a fixed number of **one-second turns**, and everything happens on them (D154). v5's speed, acceleration,
HP, spurt plan, hills, duels and skills carry over with a one-second step; the pack, the Speed term and a few rates
are retuned so a race reads as a race and stats decide it (D155). v1–v5 results replay under their own rules.

**The clock.** `turns = ⌈distance / baseSpeed⌉`: 58 turns at 1,200 m, 79 at 1,600 m, 100 at 2,000 m, 123 at 2,400 m,
171 at 3,200 m. Phases start on fixed turns shared by the whole field: Opening at turn 1, Middle leg at `⌈T/6⌉ + 1`,
Final leg at `⌈2T/3⌉ + 1`, Last spurt at `⌈5T/6⌉ + 1`. The turns split into 24 sections for Wit's section roll.

**A turn**, for every runner from the same start-of-turn state: effects expire; skills check their conditions; on the
first final-leg turn she plans her spurt; her target speed is set (style coefficient, Speed, spurt, section roll,
skills, hills, duel, her style band); her speed moves toward it by one second of acceleration; she proposes a move of
`(v + v′) / 2`; passing resolves; HP drains for the ground she covered; and a runner over the line finishes at the
fraction of the turn where she crossed it.

**Passing**, front to back by where each runner started the turn. A runner whose move would end within a length of
one already placed in her lane swings out, up to three lanes, or one lane in, into the nearest free lane and keeps her
move, and each runner she ends ahead of is an **overtake**. With no lane free she is **blocked**: she ends a length
behind at that runner's speed. A runner with the way clear drifts a fifth of a lane toward the rail.

**Style bands** replace position keeping. Through the opening and middle legs each style runs in a band of lengths
behind the leader, set at 2,000 m and scaled with the course as the original scales position keeping
(`0.0008 × (distance − 1000) + 1`): Front 0–2, Pace 2–5, Late 5–8, End 7–11. Ahead of her band she eases (target
× 0.985); behind it she presses (× 1.015). From the final leg everyone races.

**Mood**, the original's motivation, is rolled for every runner each race from its seed: Awful, Bad, Normal, Good or
Great, equally likely, moving every stat by 2% a level. Skill conditions read it.

**Tuning** (`V6_TUNING`, set with `pnpm sim:turns`):

| Knob | Value | What it does |
|---|---|---|
| Speed term | `0.002 × √(500 × 600) + 0.005 × (√(500 × Speed) − √(500 × 600))`, from the middle leg | The original's term at Speed 600, with 2.5× its slope around it, so Speed counts from the middle leg and a better Uma pulls away |
| Acceleration | × 2 | Runners reach a new target in a few turns, so their speed shows before the line |
| HP rate | × 0.85 | Set so the stamina ladder's decks hold a full spurt at the new speeds |
| Swing | 3 lanes | How far a blocked runner may move out in a turn |
| Rail drift | 0.2 lane a turn | How fast a clear runner comes back to the rail |
| Section roll | 0.65% of base speed | The original's |
| Mood | 2% a level | The original's |

Measured with `pnpm sim:turns` in generated 12-runner G1 fields at tier 1, 2026-09-25:

| Distance | Turns | Winner → last | Spread, 60% in | Overtakes | Blocked a runner | Short of stamina | Wins F / P / L / E |
|---|---|---|---|---|---|---|---|
| 1,200 m | 58 | 0.5 s | 15 m | 55 | 0.6 s | 0% | 50 / 35 / 13 / 2% |
| 1,600 m | 79 | 0.7 s | 19 m | 62 | 0.6 s | 0% | 40 / 37 / 18 / 5% |
| 2,000 m | 100 | 0.9 s | 22 m | 72 | 0.7 s | 0% | 22 / 32 / 35 / 12% |
| 2,400 m | 123 | 1.1 s | 26 m | 79 | 0.7 s | 4% | 25 / 18 / 40 / 17% |
| 3,000 m | 158 | 1.6 s | 33 m | 83 | 0.6 s | 22% | 32 / 22 / 35 / 12% |

Stats decide: at 2,000 m a runner at twice the field's average wins every race by about 2 s, at +20% she wins 88–92%,
and at +10% 32–52%. At the field's average she almost never wins, since the luckiest rolls in a field of eleven beat
her. v5, for comparison, blocked a runner 17–26 s a race, and a runner at twice the field won half her races. Front
runners still lead sprints, as they do in the original, and the field still finishes within about a second at
2,000 m, under M021's 2–6 s target: rivals of one grade share presets. Both are open in T070.
