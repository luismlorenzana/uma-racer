# Scenario Careers

Every scenario gives each Uma a **career**: a short, authored run of races she has to win, in three stages, that
loops with the scenario. A new scenario gets a new career. Targets are concrete private `RaceTemplate.id` values,
frozen when the scenario starts, so ordinary content updates never silently reroll an active or historical career. An
explicit regular-catalog retirement may regenerate only an active career with no completed or missed goal (D194).

> **Status:** goal plan **v4** (D137, D138, D194) is live: career rules, level holds, save shape, migration, the Race tab,
> and the career on Home and the profile.

## Three stages

| Stage | Uma Levels (into the scenario) | Goal | Unlocks |
|---|---|---|---|
| **Maiden** | 1–2 | Win one **G3** in her profile | Level 3 |
| **Trials** | 3–5 | Win two **G2**s, one at each of her two distances | Level 6 |
| **Main goals** | 6–10 | Win **three G1s**: this scenario's G1 set, topped up from her own career | The next scenario |

Every race stays open from scenario 1 (see [Racing](racing.md#all-races-open-from-scenario-1-)), and a goal can be won
early: a G1 won at level 1 counts. Stages gate only **Uma Level** and the scenario advance:

- **Holds.** While the Maiden goal is unwon, race EXP stops at level 2 of the scenario; while a Maiden or Trials goal
  is unwon, it stops at level 5. A held Uma banks EXP up to one short of her next level, so the race that wins the goal
  releases the bank at once. An Uma already past a hold (her career was generated mid-scenario) is never pushed back.
- **The gate.** Level 10 was already the gate. With a career she **keeps racing at the gate** until every goal is won,
  and only then can she advance. At tier 14 the career closes on its last win.
- **Retries** are free: losing a goal race costs only the race.

Goals pay no tickets, coupons, shards, stats or SP of their own. Levels pay their usual tickets, so the holds are where
a career's rewards wait.

## Her profile

A career is written for her **profile: her best two neighbouring distances on her better surface**.

| Band | Distances | Who gets it |
|---|---|---|
| Sprint · Mile | up to 1800 m | A sprinters |
| Mile · Medium | 1401–2400 m | Milers and middle-distance Umas with A or B in both |
| Medium · Long | 1801 m and up | A stayers |

A band ranks by its **weaker** grade, then its stronger one, so an Uma with A Medium and A Long is a stayer even if her
Mile is also A. Ties go to the band holding more of her real career's races (`signatureRaceFamilyIds`), then to
Mile · Medium. Her surface is the better of Turf and Dirt; a tie goes to her career, then Turf. Aptitudes are the
constellation's (after lineage, D121) at the moment the career is frozen.

The imported roster splits 127 Medium · Long, 90 Mile · Medium and 34 Sprint · Mile on turf, plus 17 dirt specialists.

## Choosing the races

Every pick is **in her profile and B or better** on surface and distance. Within a stage, candidates are ordered:

1. **her real career's races**, in career order;
2. **famous races** (any race that is a leg of a set);
3. everything else, in a fixed order hashed from her id.

Tier *n* starts *n* places into that order, so each scenario brings different races and her own career comes first. A
race family is used once per career; a family with several variants runs its best-fitting one.

**Maiden:** one G3 from either of her distances. **Trials:** one G2 at each distance. A specialist whose second
distance is below B (a pure sprinter, say) runs both trials at her first.

### Main goals: the set rotation

Each scenario's main goal is one **G1 set** — the sets that earn [titles](badges.md#4-titles-and-g1-trophies) — taken in
a fixed order, and every rotation ends with **her own G1s**:

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
horse's sex. Tier *n* takes the *n*-th entry of her rotation, wrapping. A two-leg set is topped up with one more G1 from
her own career, so main goals are always **three G1 wins**. In practice:

| Profile | Rotation |
|---|---|
| Medium · Long colt | Triple Crown → Spring Triple Crown → Autumn Triple Crown → Grand Prix → her own G1s → … |
| Medium · Long filly | Spring Triple Crown → Autumn Triple Crown → Grand Prix → her own G1s → … |
| Mile · Medium filly | Triple Tiara → Mile Crown → her own G1s → … |
| Mile · Medium colt | Mile Crown → her own G1s → … |
| Sprint · Mile | Sprint Crown → Mile Crown → her own G1s → … |
| Dirt | Dirt Crown → her own G1s → … |

Winning a set inside one scenario is also how its title is earned, so a career naturally collects titles.

### Guarantees

`pnpm sim:careers` generates a career for every Uma at every tier from the non-retired career catalog projected from the
private pack. That catalog keeps duplicate-name source variants because their family ids carry Uma career identity; Race
Select collapses them only after a frozen goal variant has been preferred (D195). The sim fails if any career cannot
be generated, if any race falls outside her profile or below B, or if a stage's race is not winnable by Training Level
10 with the [constellation harness](constellations.md#balance-targets-the-stamina-ladder)'s builds. Today it produces 3,752 of 3,752
careers, every one with three main-goal G1s, and none needing a relaxed pick. Every stage is raced at TL10, the way
the owner plays (D152), against generated fields (D153) on engine v6 (D155): a fully bonded set wins every Maiden G3, the Trials G2s 93–100%
and the Main-goal G1s 30–100%, best case across strategies, and a new 0★ set 18–100% of its G3s and none of its
G1s
([Racing — difficulty target](racing.md#difficulty-target)).

The generator never fails a career over a thin catalog: an empty pool relaxes to her profile at any grade, then B or
better anywhere, then anything of the stage's grade. Scenario Start fails before writes only when the catalog has no
race of a stage's grade at all, and its error reports counts, not private names. It uses no engine RNG, clock or input
order.

## Authoritative completion

Completion counts only a committed result from the exact Uma, active tier and frozen target race, won in **first
place**. A set goal completes when its **last** leg is won inside the same scenario; each leg records its own result id.
Preview, abandoned playback, another tier, another Uma, or a different variant of the same race cannot count.

Goals settle **before** EXP inside the atomic race transaction, after deterministic re-simulation and before the result
is appended, so the race that wins a stage's goal also levels through the hold it lifted. New results always snapshot
`completedGoalIds` (including `[]`). A matching retry returns the stored ids without awarding or animating again.

## Save shape

Careers reuse `ScenarioJourney` and `ScenarioGoal`. A career's goals are, in order, `goal:<tier>:maiden`,
`goal:<tier>:trials:1` and `:2`, then `goal:<tier>:main:1` to `:4`, with slots `maiden`, `trials` and `main`. A set is
one `win-series` main goal whose legs carry their own completion; every other goal is `win`, and a career holds at most
one set. `UmaSave.goalPlanVersion` is **4**. The domain parser and the API validator (D128) check the same shape.

## Lifecycle and migration

- A career is frozen at Scenario Start or on advancing, from the new constellation's aptitudes. Advancing, or closing
  tier 14, closes the journey: won goals stay won and anything unwon is marked missed. Closed facts never reopen.
- **v2 → v3:** an active journey with **nothing won or missed** is regenerated as a career. One with progress keeps its
  frozen v2 plan until the Uma advances; its three goals stay optional, with no holds and no advance gate. Migration
  invents no wins, misses or rewards.
- **v3 → v4:** an active career with **nothing won or missed** is regenerated only when one of its targets is absent from
  the regular race catalog. A career with any progress remains byte-for-byte frozen apart from its version marker, so a
  catalog cleanup never deletes a win or changes the remaining steps of an underway career.
- Earlier plans are history. Goal plans v1–v2 gave three optional slots: Aptitude, Identity (her real career, then her
  sex's classic set) and Challenge (a 5-length win). Their journeys still parse and still count toward ribbons and
  Honors.
- Missing or retired target content in a progressed career shows its safe id and leaves the frozen goal honestly
  unavailable until restored.

## Presentation

| Place | What it shows |
|---|---|
| **Race tab** | A career tracker (stage, progress, and the level it holds), then **Next up**: the 5–10 races worth running now — this stage's goal races, then set legs and first-G1 trophies, then EXP races graded for her level, all in her profile. Race cards carry icons: a stage goal, a set leg with its progress ("Triple Crown 2/3"), a trophy for a first G1 win. **Won this scenario** and **All races** sit collapsed below, and everything stays runnable |
| **Uma Profile** | The career tracker, and one medallion per reached tier with its goals |
| **Home** | The featured Uma's stage and her next goal race |
| **Pre-race** | Every goal at stake, and which leg of a set this race is |
| **Results** | Goal Ribbon reveals after ordinary rewards, and the level a win just released |

One Goal Ribbon badge is persisted per completed goal, and one scenario Honors badge for a journey with every goal won.
Trainer achievements count only tracked goal and Honors facts.
