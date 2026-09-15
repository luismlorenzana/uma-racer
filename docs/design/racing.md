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

> *Example:* a scenario 1 G1 Medium race at Uma Level 1 (k = 0). NPC Speed = 600 × 1.00 × 1.00 × 0.80 = **480**, Stamina **432**.
> A fully trained Uma (600 in every stat) races at 600 × 0.80 = **480**, an even fight on stats. At k = 9 she races at 588 against the field's 534 Speed.

### Baseline enemy kit

- A fixed set of **4 strategy-neutral white skills**: one HP recovery, one mid-race speed, one final-straight speed, one acceleration.
  The exact skills are chosen once the skill data lands.
- Plus the NPC's **own unique skill**, at full strength.
- The kit doesn't grow per scenario. Difficulty scales through scenario caps, grade, and Race Form.

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

See [Uma Progression](uma-progression.md#uma-level-and-exp) for `winExp`. Every result goes into the Uma's
`raceHistory` and is checked by the goal, badge, and achievement engines.

## Presentation: straight-line real-time view

- The track is drawn as a **horizontal straight**. Runners move left to right in lanes, and the camera follows the pack.
- **Icons** (character icons) are the runners, with a gate number and the player's Uma highlighted.
- A **progress rail** shows every runner's position along the whole distance at a glance.
- **Phase banner:** Opening → Middle → Final Leg → **Last Spurt**, with course labels such as "Final corner" and "Final straight".
- **Stamina bar** for the player's Uma. **Skill activation popups**. Callouts for late start, dueling, spurt, blocked.
- **Finish:** a photo-finish freeze when the margin is within a nose or head. Margins are shown in lengths.

## Engine principles *(tentative until the technical design is written)*

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
