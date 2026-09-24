# Race Mechanics Research

Formulas from the original game's race simulation, as reverse-engineered and documented by the
community. This is the reference for building the race engine ([Racing](../design/racing.md)).

**Confidence markers**

- ✅ Read directly on a source page during research (2026-09-14).
- ⚠️ From memory of community docs, or conflicting between sources. **Verify before relying on it.**

Units: distance in m, speed in m/s, acceleration in m/s², HP as abstract points.

## Stats glossary

| Stat | Role in races |
|---|---|
| Speed | Target speed in the late race and last spurt |
| Stamina | Max HP |
| Power | Acceleration, lane changes, uphill, getting past blockers |
| Guts | Minimum speed, late-race HP efficiency, last-spurt speed, dueling |
| Wit | Skill activation, section speed randomness, spurt decision quality, rushed (kakari) resistance, downhill mode |

## Race structure ✅

- Every course is divided into **24 equal sections**.

| Phase | Sections | Fraction of race |
|---|---|---|
| 0 Opening leg (early race) | 1–4 | 0 – 1/6 |
| 1 Middle leg | 5–16 | 1/6 – 2/3 |
| 2 Final leg | 17–20 | 2/3 – 5/6 |
| 3 Last spurt | 21–24 | 5/6 – 1 |

- The "late race" is phases 2 and 3 together.
- Position keeping runs through **section 10**.
- Distance categories: Sprint ≤1400, Mile 1401–1800, Medium 1801–2400, Long ≥2401 ⚠️.

## Base speed ✅

```
BaseSpeed = 20.0 − (CourseDistance − 2000) / 1000
```

Starting speed: **3 m/s** ✅.

## Target speed ✅

```
TargetSpeed = (BaseTargetSpeed | LastSpurtSpeed) × PositionKeepCoef
              + ForceInMod + SkillMod + SlopeMod + MoveLaneMod

BaseTargetSpeed (phase 0–1) = BaseSpeed × StrategyPhaseCoef
BaseTargetSpeed (phase 2+)  = BaseSpeed × StrategyPhaseCoef
                              + sqrt(500 × Speed) × DistanceAptSpeedMod × 0.002

LastSpurtSpeedMax = (BaseTargetSpeed_phase2 + 0.01 × BaseSpeed) × 1.05
                    + sqrt(500 × Speed) × DistanceAptSpeedMod × 0.002
                    + (450 × Guts)^0.597 × 0.0001
```

### Strategy phase coefficients: speed ✅

| Strategy | Phase 0 | Phase 1 | Phase 2–3 |
|---|---|---|---|
| Runaway (Great Escape) | 1.063 | 0.962 | 0.95 |
| Front Runner | 1.0 | 0.98 | 0.962 |
| Pace Chaser | 0.978 | 0.991 | 0.975 |
| Late Surger | 0.938 | 0.998 | 0.994 |
| End Closer | 0.931 | 1.0 | 1.0 |

### Minimum speed ✅

```
MinSpeed = 0.85 × BaseSpeed + sqrt(200 × Guts) × 0.001
```

(One source renders it without the sqrt because of formatting; the sqrt form matches the other formulas ⚠️.)

## Acceleration ✅

```
Accel = BaseAccel × sqrt(500 × Power) × StrategyPhaseAccelCoef
        × SurfaceAptMod × DistanceAptAccelMod
        + SkillMod + StartDashMod

BaseAccel = 0.0006 (flat) | 0.0004 (uphill)
StartDashMod = +24.0 while speed < 0.85 × BaseSpeed (right after leaving the gate)
```

### Strategy phase coefficients: acceleration ✅

| Strategy | Phase 0 | Phase 1 | Phase 2–3 |
|---|---|---|---|
| Runaway | 1.17 | 0.94 | 0.956 |
| Front Runner | 1.0 | 1.0 | 0.996 |
| Pace Chaser | 0.985 | 1.0 | 0.996 |
| Late Surger | 0.975 | 1.0 | 1.0 |
| End Closer | 0.945 | 1.0 | 0.997 |

### Deceleration (when above target speed) ✅

| Situation | Decel |
|---|---|
| Phase 0 | −1.2 |
| Phase 1 | −0.8 |
| Phase 2+ | −1.0 |
| Pace Down mode | −0.5 |
| HP depleted | −1.2 |

## Aptitude modifiers ✅

| Grade | S | A | B | C | D | E | F | G |
|---|---|---|---|---|---|---|---|---|
| Distance → target speed | 1.05 | 1.0 | 0.9 | 0.8 | 0.6 | 0.4 | 0.2 | 0.1 |
| Distance → acceleration | 1.0 | 1.0 | 1.0 | 1.0 | 1.0 | 0.6 | 0.5 | 0.4 |
| Surface → acceleration | 1.05 | 1.0 | 0.9 | 0.8 | 0.7 | 0.5 | 0.3 | 0.1 |
| Strategy → Wit | 1.1 | 1.0 | 0.85 ⚠️ | 0.75 ⚠️ | 0.6 ⚠️ | 0.4 ⚠️ | 0.2 ⚠️ | 0.1 |

## HP (stamina) ⚠️

These formulas were not found on the pages fetched. They come from memory of community docs and must be verified.

```
MaxHP = 0.8 × StrategyHPCoef × Stamina + CourseDistance

HPConsumptionPerSec = 20 × (CurrentSpeed − BaseSpeed + 12)² / 144
                      × StatusMod × GroundConditionMod
                      × (phase ≥ 2 ? GutsMod : 1)

GutsMod = 1 + 200 / sqrt(600 × Guts)
```

| Strategy | HP coef ⚠️ |
|---|---|
| Runaway | 0.86 |
| Front Runner | 0.95 |
| Pace Chaser | 0.89 |
| Late Surger | 1.0 |
| End Closer | 0.995 |

| Status | HP mod |
|---|---|
| Rushed (kakari) ⚠️ | ×1.6 |
| Pace Down mode ⚠️ | ×0.6 |
| Downhill accel mode ✅ | ×0.4 (−60%) |
| Uphill ✅ | Also lowers HP consumption, per one source; exact value unclear ⚠️ |

Ground condition HP modifiers ⚠️ (Firm / Good / Soft / Heavy): Turf 1.0 / 1.0 / 1.02 / 1.02, Dirt 1.0 / 1.0 / 1.01 / 1.02.

## Start ✅

- **Start delay:** random, 0–100 ms. A **late start** is flagged at 80 ms or more.
  A delay above 66 ms loses one frame of start-dash acceleration.
- Skills scale the delay: Concentration ×0.4, Focus ×0.9, Gatekept ×1.5.
- The simulation frame is reportedly 1/15 s ⚠️.

## Last spurt calculation ✅

At the start of phase 2:

1. Check whether HP is enough to run the remaining distance at `LastSpurtSpeedMax` (community docs mention a buffer of about 60 m ⚠️).
2. If yes, spurt at maximum from the start of phase 2.
3. If not, build a list of candidates (a lower target speed paired with a later spurt start).
   Candidates are tried from best to worst, and each is accepted with probability:

```
P(accept) = 15 + 0.05 × Wit   [%]
```

## Stamina contest ✅

Added to the original game at its JP 2.5th anniversary (2023-08-24). If race-start stamina — after mood and green
skills, **not halved above 1,200** — exceeds 1,200 when a runner reaches max spurt, her target speed rises for the
rest of the race:

```
bonus [m/s] = sqrt(stamina − 1200) × 0.0085 × distanceFactor × powerCoefficient(0.98–1.02)
```

| Distance | ≤2,100 m | 2,101–2,200 m | 2,201–2,400 m | 2,401–2,600 m | 2,601 m+ |
|---|---|---|---|---|---|
| Factor (after the 2024 balance update) | 0 | 0.5 | 1.0 | 1.5 (was 1.2) | 1.8 (was 1.5) |

It consumes no stamina of its own. The power-referenced coefficient's formula is unknown; engine v4 draws it from
the race seed. Sources: shimahokke's measurements (note.com) and Game8 JP, below.

### Stamina needed in a field

Measured with engine v4 in 12-runner G1 fields at tier 1 (Speed 1,372, Power 762, Guts 440), full spurt without
running out in 90% of races, no heals:

| Distance | 1,200 | 1,400 | 1,600 | 1,800 | 2,000 | 2,400 | 2,500 | 3,000 | 3,200 |
|---|---|---|---|---|---|---|---|---|---|
| Pace | 340 | 445 | 551 | 668 | 797 | 1,055 | 1,137 | 1,992 | 2,379 |
| Late | 305 | 410 | 504 | 609 | 715 | 961 | 1,008 | 1,688 | 1,816 |

Running alone needs about 30% less: the pack's position keeping is most of the difference. These agree with the
original game's published chart (1,400 m ≈ 500–570, 1,800 m ≈ 720–800, 2,400 m ≈ 870–930 with one gold heal), which
is why the constellation's stamina ladder is sized against field runs rather than solo ones.

## Wit effects

```
SectionRandomMax = (Wit / 5500) × log10(Wit × 0.1)   [% of BaseSpeed]   ✅
SectionRandomMin = SectionRandomMax − 0.65           [%]                ✅
SkillActivationChance = max(100 − 9000 / Wit, 20)    [%]                ⚠️
RushedChance = (6.5 / log10(0.1 × Wit + 1))²         [%]                ⚠️
DownhillModeChance (per check) = Wit × 0.04          [%]                ✅
```

## Slopes ✅

```
UphillSpeedPenalty = SlopePer × 200 / Power                 (m/s)
DownhillSpeedBonus = 0.3 + SlopePer / 10                    (m/s, while in downhill mode)
Downhill mode: 20% chance per second to end; HP consumption −60%
```

## Lanes, blocking, overtaking ✅

```
MoveLaneMod     = sqrt(0.0002 × Power)                                   (m/s)
ForceInMod      = Random(0, 0.1) + StrategyForceIn                        (m/s)
                  StrategyForceIn: Front 0.02 · Pace 0.01 · Late 0.01 · End 0.03
Blocked if lane gap < (1.0 − 0.6 × DistanceGap²) × 0.75 × LaneWidth
Blocked speed cap = (0.988 + 0.012 × DistanceGap²) × BlockerSpeed
```

## Position keeping (sections 1–10) ✅

The R3 research pass is recorded in [Race Engine R3 Findings](race-engine-r3-findings.md), including exact thresholds,
timers, lane formulas, source confidence, and the explicit pacemaker/course-width approximations used by Uma Racer.

## Dueling (final straight) ✅

Conditions: runners close together with similar speeds, in the top 50% of the field, and HP above 15%.

```
TargetSpeed += (200 × Guts)^0.708 × 0.0001
Accel       += (160 × Guts)^0.59  × 0.0001
```

A runner cannot enter a duel again after leaving it.

## Stat processing

- Mood multiplies stats: ×(1 + 0.02 × mood), with mood ranging from −2 (Awful) to +2 (Great) ⚠️.
- **The stat cap was raised from 1200 to 2000. The part above 1200 counts about half in races, and training gains past 1200 are halved** ✅
  ([Game8 — Stat Cap Increase](https://game8.co/games/Umamusume-Pretty-Derby/archives/607279)).
- Ground condition applies flat stat penalties (for example Power −50 on some conditions). Table to research.

## Research backlog

- [ ] Verify the HP section (max HP, consumption, strategy coefficients).
- [x] Position keeping: exact thresholds, timers, and coefficients. See the R3 findings.
- [ ] Spot struggle (early competition between Front Runners).
- [ ] Rushed (kakari): chance, duration, and effects.
- [ ] Course data: sections, corners, straights, and slopes for each JRA course.
- [ ] Stat rank letters (G → UG / US) and thresholds, for the profile radar.
- [ ] Ground condition stat penalties.
- [ ] Skill types and activation conditions (for R5).

## Sources

- [uma.guide — Race Mechanics](https://uma.guide/guides/race-mechanics)
- [uma.guide — Target Speed](https://uma.guide/guides/target-speed)
- [uma.guide — Race Phases](https://uma.guide/guides/race-phases)
- [uma.guide — Stats](https://uma.guide/guides/stats)
- [uma.guide — Track Features](https://uma.guide/guides/race-track-features)
- [Umamusume Wiki — Game:Mechanics](https://umamusu.wiki/Game:Mechanics)
- [Umamusume Reference Guide — How do races work?](https://www.umareference.com/guide/races/how-do-they-work)
- [Umamusume Reference Guide — Required Stamina Chart](https://www.umareference.com/guide/stats/required-stamina-chart)
- [しまほっけ — スタミナ勝負とバランス調整の影響 (note.com)](https://note.com/shimahokke_uma/n/n44aeb7f26243)
- [Game8 JP — スタミナ勝負の効果と発動条件](https://game8.jp/umamusume/547536)
