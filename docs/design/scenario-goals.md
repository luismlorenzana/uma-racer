# Scenario Careers

Every scenario gives each Uma a **career**: a short, authored run of races she has to win, in three stages, that
loops with the scenario. A new scenario gets a new career. Targets are concrete private `RaceTemplate.id` values,
frozen when she arrives in the scenario, so content updates never silently reroll an active or historical career.

> **Status: built (generation 2).** Goal plan **v4** (D137, D138, D194): a career per scenario of a tier, frozen on
> arrival, with its level holds and the gate ([03](../game/03-uma-progression.md) §2, §4–§5). Careers show at the
> Racecourse, the Scenario Gate and the Uma profile ([Presentation](#presentation)).

## Three stages

| Stage | Racing Levels (into the scenario) | Goal | Releases |
|---|---|---|---|
| **Maiden** | 1–2 | Win one **G3** in her profile | Level 3 |
| **Trials** | 3–5 | Win two **G2**s, one at each of her two distances | Level 6 |
| **Main goals** | 6–10 | Win **three G1s**: this scenario's G1 set, topped up from her own career | The advance |

Every race stays open from her first scenario (see [Racing](racing.md#all-races-open-from-scenario-1-)), and a goal can
be won early: a G1 won at level 1 counts. Stages gate only **Racing Level** and the advance:

- **Holds.** While the Maiden goal is unwon, Racing EXP stops at level 2 of the scenario; while a Maiden or Trials goal
  is unwon, it stops at level 5. A held Uma banks EXP up to one short of her next level, so the race that wins the goal
  releases the bank at once. An Uma already past a hold is never pushed back.
- **The gate.** The scenario's last level is the gate. She **keeps racing at the gate** until every goal is won, and
  only then can she advance, for free ([03](../game/03-uma-progression.md) §5, `advance-scenario`). The gate banks up
  to 100 EXP, the next scenario's first step, which applies at the advance. A tier's last scenario has no advance: there
  the completed career leads to the World Expedition (phase 9, [rework/10](../rework/10-expeditions.md)), and until it
  ships she waits at the gate with racing open.
- **Retries** are free: losing a goal race costs only the race.

**Goals pay nothing of their own** ([03](../game/03-uma-progression.md) §4): a goal race pays its usual Racing EXP and
Prize Money, and a level-up pays nothing but the gate's Uma Shard. The holds pace her levels, nothing more.

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
selected preset's, after its lineage (her filled open Inspiration slots, D123, D252), at the moment the career is
frozen.

Each Uma keeps race defaults (`set-race-defaults`, [03](../game/03-uma-progression.md) §7): a preferred **distance**,
**surface** and **running style**. Before the owner chooses them, the automatic profile above is the recommendation. A
chosen distance selects one of the neighbouring bands that contains it, ranking the other distance by the usual
weaker/stronger grades and career tie-break; a chosen surface replaces the automatic surface choice. The new profile
applies when her next career is frozen. Editing a preference never refreezes the career she is in, lowers her Racing
Level, erases a goal win, or replays a reward. The running-style preference is the default selection on the pre-race
sheet, not a restriction: the owner can choose any style for an individual race. The profile's Racing tab shows all
three defaults and their editor.

The imported roster splits 127 Medium · Long, 90 Mile · Medium and 34 Sprint · Mile on turf, plus 17 dirt specialists.

## Choosing the races

Every pick is **in her profile and B or better** on surface and distance. Within a stage, candidates are ordered:

1. **her real career's races**, in career order;
2. **famous races** (any race that is a leg of a set);
3. everything else, in a fixed order hashed from her id.

The game's scenario *T* (1–14, [04](../game/04-tiers-and-promotion.md) §1) starts at the *T*-th entry of that order,
wrapping, so each scenario brings different races and her own career comes first. A race family is used once per
career; a family with several variants runs its best-fitting one.

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

Winning a set inside one scenario is also how its title is earned, so a career naturally collects titles.

### Guarantees

`pnpm sim:careers` freezes a career for every Uma at every scenario T = 1–14 with `freezeCareer`, from the
non-retired career catalog projected from the private pack, and prints only counts. That catalog keeps duplicate-name
source variants because their family ids carry Uma career identity; Race Select collapses them only after a frozen goal
variant has been preferred (D195). The sim fails if any career cannot be frozen, if a career race falls below her
B-or-better aptitudes, or if a stage's win rate falls under 25% (D152). Its win rates race full-layer builds against
generated fields on engine v9, best case across the distance's sets and the four running styles: the targets are every
Maiden G3 won, the Trials G2s at 90% or more and the Main G1s at 60–100%, and the measured table is
[03](../game/03-uma-progression.md) §9's ([Racing — difficulty target](racing.md#difficulty-target)).

The generator never fails a career over a thin catalog: a pool short of races relaxes to her profile at any aptitude,
then B or better anywhere, then anything of the stage's grade. Freezing a career throws before any write only when the
catalog has no race of a stage's grade at all, and its error reports counts, not private names. It uses no engine RNG,
clock or input order.

## Authoritative completion

Completion counts only a committed result from the exact Uma, her current scenario's career and the frozen target race,
won in **first place**. A set goal completes when its **last** leg is won inside the same scenario; each leg records its
own result id. Preview, another scenario, another Uma, or a different variant of the same race cannot count.

Goals settle **before** EXP inside `finish-race`
([Racing](racing.md#generation-2-the-race-on-finish-race-t141-d359)), so the race that wins a stage's goal also levels
through the hold it lifted. Every result records its `completedGoalIds` (including `[]`). A retried commit returns its
first receipt without awarding or animating again.

## Save shape

Careers use `ScenarioJourney` and `ScenarioGoal`, on `umas/{outfitId}` as her current `career` and the `closedCareers`
she left ([03](../game/03-uma-progression.md) §7). A career's goals are, in order, `goal:<T>:maiden`,
`goal:<T>:trials:1` and `:2`, then `goal:<T>:main:1` to `:4`, with slots `maiden`, `trials` and `main`. A set is one
`win-series` main goal whose legs carry their own completion; every other goal is `win`, and a career holds at most one
set. The goal plan is **v4** (`SCENARIO_GOAL_VERSION`). The save's parser checks careers with `parseScenarioJourney`,
and the API re-runs every operation with the domain package.

## Lifecycle

- **Frozen on arrival.** A career is frozen when she arrives in a scenario: on her unlock (tier 1, scenario 1), at the
  advance, or at promotion (scenario 1 of the next tier), from her selected preset's aptitudes
  ([03](../game/03-uma-progression.md) §4). It is never regenerated: content updates and preference edits shape only her
  next career.
- **Closed on leaving.** The advance, or promotion from a tier's last scenario, closes it into her history: won goals
  stay won and anything unwon is marked missed. Closed facts never reopen. Both need every goal won, so a closed career
  is complete.
- An active goal's exact race row stays runnable in Race Select even when it is hidden from regular play
  ([Racing — race catalog](racing.md#race-catalog)).
- Goal plans v1–v3 are history: generation 2's save started empty (D323), so every career is v4.

## Presentation

| Place | What it shows |
|---|---|
| **Racecourse** (race select) | Her career line (stage and goals won, or Complete), then **Next up**: the 5–10 races worth running now — this stage's goal races, then set legs and first-G1 trophies, then EXP races graded for her level, all in her profile. Race cards carry marks: a career goal, a set leg with its progress ("Triple Crown 2/3"), a first G1 win. **Won this scenario** and **every race** sit collapsed below, and everything stays runnable |
| **Scenario Gate** | Every Uma's career: stage, goal races (won ones struck through), the level a hold keeps her at, and who is ready to advance; one Uma's at `/racing/scenario-gate/:umaId`, with the Advance sheet ([11](../game/11-hub-and-places.md) §3.3) |
| **Uma profile** | The Overview's career, and the Racing tab's career record |
| **Pre-race sheet** | Every goal at stake, and which leg of a set this race is |
| **Result** | Goal ribbons with their pips after Racing EXP and Prize Money, and Honors when the career is complete |

One Goal Ribbon badge is persisted per completed goal, and one scenario Honors badge when she leaves a scenario with
every goal won. Trainer achievements count only tracked goal and Honors facts.
