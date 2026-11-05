# Scenario Careers

Every scenario gives each Uma a **career**: a short, authored run of objective races she has to win, in three stages.
Targets are concrete private `RaceTemplate.id` values, frozen when her career starts, so content updates never
silently reroll an active or completed career.

> **Status: the generator as built (generation 3, M036; D137, D138, D194, D383).** `start-career` freezes a URA
> Finale career's objectives with `planScenarioCareer` at T = 1, on the career catalog's races that have a season of
> the year ([03](../game/03-careers.md) §1). The calendar, the seasons, retries and rewards are 03's, and the screens
> [11](../game/11-hub-and-places.md) §8. This page owns how the objectives are chosen.

## Three stages

| Stage | Goal | In the calendar |
|---|---|---|
| **Maiden** | Win one **G3** in her profile | Junior |
| **Trials** | Win two **G2**s, one at each of her two distances | Classic |
| **Main goals** | Win **three G1s**: this scenario's G1 set, topped up from her own career | The earliest in Classic, the others in Senior |

- **Each objective sits in its race's season** of the year, in its stage's year, and moves a year later when it would
  come before the objective ahead of it ([03](../game/03-careers.md) §2).
- **Each must be won before its season can end.** Retries are free: losing an objective race costs only the race.
- **An objective's first win pays** a Card Ticket and SP ([03](../game/03-careers.md) §6), and winning the scenario's
  finale completes the career.

## Her profile

A career is written for her **profile: her best two neighbouring distances on her better surface**.

| Band | Distances | Who gets it |
|---|---|---|
| Sprint · Mile | up to 1800 m | A sprinters |
| Mile · Medium | 1401–2400 m | Milers and middle-distance Umas with A or B in both |
| Medium · Long | 1801 m and up | A stayers |

A band ranks by its **weaker** grade, then its stronger one, so an Uma with A Medium and A Long is a stayer even if her
Mile is also A. Ties go to the band holding more of her real career's races (`signatureRaceFamilyIds`), then to
Mile · Medium. Her surface is the better of Turf and Dirt; a tie goes to her career, then Turf. Aptitudes are her
template's own grades when the career starts (aptitude points arrive with Summer Camp, release 4). There are no race
preferences: the profile above always decides, and the race sheet preselects her best running style without
restricting it.

The imported roster splits 127 Medium · Long, 90 Mile · Medium and 34 Sprint · Mile on turf, plus 17 dirt specialists.

## Choosing the races

Every pick is **in her profile and B or better** on surface and distance. Within a stage, candidates are ordered:

1. **her real career's races**, in career order;
2. **famous races** (any race that is a leg of a set);
3. everything else, in a fixed order hashed from her id.

The game's scenario *T* (1–15, [04](../game/04-tiers-and-scenarios.md) §1) starts at the *T*-th entry of that order,
wrapping, so each scenario brings different races and her own career comes first. A race family is used once per
career; a family with several variants runs its best-fitting one.

**Maiden:** one G3 from either of her distances. **Trials:** one G2 at each distance. A specialist whose second
distance is below B (a pure sprinter, say) runs both trials at her first.

### Main goals: the set rotation

Each scenario's main goal is one **G1 set** — the real series the private flair overlay maps (`race-series.ts`) — taken
in a fixed order, and every rotation ends with **her own G1s**:

| Order | Set | Legs |
|---|---|---|
| 1 | Triple Crown (colts) | Satsuki Sho · Tokyo Yushun · Kikuka Sho |
| 2 | Triple Tiara (fillies) | Oka Sho · Japanese Oaks · Shuka Sho |
| 3 | Spring Triple Crown | Osaka Hai · Tenno Sho (Spring) · Takarazuka Kinen |
| 4 | Autumn Triple Crown | Tenno Sho (Autumn) · Japan Cup · Arima Kinen |
| 5 | Grand Prix | Takarazuka Kinen · Arima Kinen |
| 6 | Sprint Crown | Takamatsunomiya Kinen · Sprinters Stakes |
| 7 | Mile Crown | Yasuda Kinen · Mile Championship |
| 8 | Dirt Crown | February Stakes · Champions Cup |
| last | **Her own G1s** | Three G1s in her profile, her real career first |

A set joins her rotation only when **every leg is in her profile at B or better**, and the classic sets follow the real
horse's sex. Scenario *T* takes the *T*-th entry of her rotation, wrapping. A two-leg set is topped up with one more
G1 from her own career, so main goals are always **three G1 wins**. In practice:

| Profile | Rotation |
|---|---|
| Medium · Long colt | Triple Crown → Spring Triple Crown → Autumn Triple Crown → Grand Prix → her own G1s → … |
| Medium · Long filly | Spring Triple Crown → Autumn Triple Crown → Grand Prix → her own G1s → … |
| Mile · Medium filly | Triple Tiara → Mile Crown → her own G1s → … |
| Mile · Medium colt | Mile Crown → her own G1s → … |
| Sprint · Mile | Sprint Crown → Mile Crown → her own G1s → … |
| Dirt | Dirt Crown → her own G1s → … |

Each leg of a set becomes one objective, in the set's own order where seasons tie ([03](../game/03-careers.md) §2).

### Guarantees

`pnpm sim:careers` starts a URA Finale career for every Uma from the career catalog projected from the private pack,
plays it once at grade A with a median and a strong deck, races its objectives and the URA Finals on engine v9, and
prints only aggregates. That catalog keeps duplicate-name source variants because their family ids carry Uma career
identity (D195). The sim fails when a first-try win rate or a pacing band misses its target: a median deck wins its
G3s, G2s and G1s at least 90%, 75% and 50% of first tries ([12](../game/12-pacing.md),
[Racing — difficulty target](racing.md#difficulty-target)).

The generator never fails a career over a thin catalog: a pool short of races relaxes to her profile at any aptitude,
then B or better anywhere, then anything of the stage's grade. Freezing a career throws before any write only when the
catalog has no race of a stage's grade at all, and its error reports counts, not private names. It uses no engine RNG,
clock or input order.

## Authoritative completion

An objective is won only by a committed `run-race` of that career's exact frozen race, finished in **first place**
([03](../game/03-careers.md) §4). Each leg of a set is its own objective. Another career, another Uma, or a different
variant of the same race cannot count. A retried operation returns its first receipt without paying again.

## Save shape

The generator writes `ScenarioJourney` and `ScenarioGoal` (`career-shapes.ts`); `start-career` places each goal's race
on the calendar as the career record's `objectives` (`careers/{umaId}:{T}`: each objective's race, stage, season,
status and when it was won). The goal plan is **v4** (`SCENARIO_GOAL_VERSION`). The save's parsers check every record,
and the API re-runs every operation with the domain package.

## Lifecycle

- **Frozen at the start.** `start-career` plans her objectives on her template's aptitudes and freezes them; they are
  never regenerated, so content updates shape only her next career.
- **Completed at the finale.** Winning the URA Finals' final completes the career and freezes her racing build on it.
  A completed career stays viewable; a second career in the same scenario is not built yet.

## Presentation

| Place | What it shows |
|---|---|
| **Start a career** | The objectives `start-career` will freeze, from the same generator, before it commits ([11](../game/11-hub-and-places.md) §8.1) |
| **Her career page** | The calendar strip with each objective's grade on its season, the season card's Race step, and her objectives in calendar order, Won or Open |
| **The race sheet and result** | The objective's race and field; then whether it was won and what it paid ([11](../game/11-hub-and-places.md) §8.4–§8.5) |
| **The Careers place** | Each career in progress with its next objective |
