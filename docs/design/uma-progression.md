# Uma Progression

> All numbers below are **draft values for tuning**, not final.

## Two layers of data

### Uma template (static, sourced from the original game)

| Field | Notes |
|---|---|
| `id`, `name`, `outfit` | **One template per outfit**, like the original game's trainee cards. Badges also roll up per character |
| `baseStats` | Speed, Stamina, Power, Guts, Wit. **The original game's 5★ base stats, for every Uma** ✅, regardless of original rarity. Race Form nerfs are applied on top in races |
| `growthRates` | Percentage bonus to training gains per stat (for example Speed +10%, Wit +20%) |
| `aptitudes` | Surface: Turf/Dirt. Distance: Sprint/Mile/Medium/Long. Strategy: Front/Pace/Late/End. Graded S–G |
| `uniqueSkill` | Innate unique skill, which is also the source of the inherited version (see [Skills & Inheritance](skills-and-inheritance.md)) |
| `realHorseSex` | Male / Female. Drives identity goals such as Triple Crown or Triple Tiara (see [Scenario Goals](scenario-goals.md)) |
| `signatureRaces` | The real horse's famous wins, used as goal seeds |
| `starter` | Whether the Uma is part of the starting roster: the 25 launch trainees (see [Collection](collection.md)) |
| `icon`, `portrait` | Local asset references only |

### Uma instance (persisted, belongs to the player)

| Field | Notes |
|---|---|
| `level`, `exp` | **Uma Level**: permanent, earned from races only |
| `scenarioTier` | Derived: `ceil(level / 10)` |
| `trainingLevel`, `trainingExp` | **Training Level** 1–10: earned from training only, reset at each scenario start. Sets the stat and SP caps (see [Training](training.md#two-levels-uma-level-vs-training-level)) |
| `stats`, `skillPoints` | Current values. Permanent, and gains are limited by the current caps |
| `aptitudes` | Copied from the template. Raised only by parent pink sparks (see [Skills & Inheritance](skills-and-inheritance.md#pink-sparks-aptitude-upgrades)) |
| `deck` | Equipped support cards (see [Support Cards](support-cards.md)) |
| `skillLibrary`, `loadout` | Skills unlocked **in the current scenario** (with origin), and the equipped subset. The library is cleared to permanent skills at each scenario start |
| `lifetimeSkills` | Every skill ever learned, with the scenario it was learned in. For badges and history |
| `trainingsThisScenario` | Training turns done in the current scenario. Racing unlocks at 1 |
| `currentParents` | The 0–2 parent snapshots picked for the scenario in progress |
| `parentSnapshot` | Her latest fully frozen snapshot (her inheritable skills plus the parents she trained with), saved at scenario completion. It is what she passes on when picked as a parent (see [Skills & Inheritance](skills-and-inheritance.md#parent-snapshots)) |
| `goals` | Scenario goals and their status for every tier reached |
| `raceHistory` | Full result log for every race. It drives badges and can be replayed later to grant new badges retroactively |
| `badges`, `titles`, `pinnedBadges`, `activeTitle` | See [Badges](badges.md) |

## Uma Level and EXP

An Uma has **two levels**: the permanent **Uma Level** (covered here) and the per-scenario **Training Level**
(see [Training](training.md#two-levels-uma-level-vs-training-level)).

- Uma Levels run from 1 up to `10 × number of scenarios` (110 with the 11 scenarios known so far).
- **Only racing gives Uma EXP.** 2nd and 3rd place give 25% of win EXP.
- Uma Level decides the scenario gates and the **Race Form** nerf (below).
- **Every Uma Level-up earns +5 training tickets.**
- Draft EXP curve:

  ```
  expToNext(level) = 100 + 25 × (level − 1)
  ```

  | Level | EXP to next | Approx. G1 wins (150 EXP) |
  |---|---|---|
  | 1 | 100 | 1 |
  | 10 | 325 | 3 |
  | 50 | 1,325 | 9 |
  | 100 | 2,575 | 18 |

- Draft EXP per win by race grade (before card Race Bonus):

  | Debut/Maiden | Pre-OP/OP | G3 | G2 | G1 |
  |---|---|---|---|---|
  | 40 | 60 | 80 | 110 | 150 |

## Getting stronger in races: Race Form

Your Uma's race-time stats are multiplied by a **Race Form** that grows faster than the field's. Every
scenario starts as a fair fight and ends with your Uma about 10% ahead. Details are in [Racing — Race Form](racing.md#difficulty-race-form).

## Gate levels and promotion

1. **Reaching** a gate level (10, 20, 30…) grants **1 Uma Shard**, once per Uma per gate (see [Collection](collection.md)).
2. The Uma is **ready immediately on reaching the gate**; a second full EXP bar is not required. Later race EXP at the
   gate is **banked, up to one following level's requirement**, and applied after promotion.
3. The Uma card shows **"Ready to promote"**. Promotion costs **25 × the completed tier** training tickets (see [Economy](economy.md)).
4. On promotion, her **parent snapshot is saved**: her inheritable skills plus the parents she trained with in the completed scenario, frozen.
5. After promotion:
   - Level becomes gate + 1 (for example 10 → 11). A completely full overflow bank immediately earns the normal next
     level (11 → 12 in this example) and its +5 ticket reward; the purchased gate transition itself pays no level reward.
   - **Training Level resets to 1.** Caps become the new scenario's baseline × 80%, rising with Training Level.
   - The card era expands: the new scenario's cards become equippable.
   - **Skill library refresh:** cleared back to her own unique (plus any unlocked awakening skills).
   - **Scenario start:** pick 0–2 parents from the parent snapshots. The parents' uniques and whites are inherited
     automatically, and the player picks grandparent skills (see [Skills & Inheritance](skills-and-inheritance.md#scenario-start-flow)).
     A brand-new Uma goes through the same scenario start for tier 1, usually without parents.
   - **New scenario goals** are generated (see [Scenario Goals](scenario-goals.md)).
   - **Opening training:** 1 training turn in the new scenario unlocks racing (see [Training](training.md#opening-training)).
   - The Uma earns the **"<Scenario> Graduate"** badge.
   - A **promotion bonus**: +10 to each stat (not limited by caps).
   - Every equipped card applies its generated **Initial Stats** value once to its own stat type, rounded per card before
     summing and not limited by the new TL1 cap.

The completed-tier snapshot is captured from the pre-refresh library. At the latest available maximum level, the finishing
race captures the final snapshot in the same transaction without a promotion cost, stat bonus, or Training Level reset.

## Stats and caps

- Caps = the scenario's baseline cap × the Training Level multiplier (80% at TL1 → 100% at TL10). Baselines are in [Scenarios](scenarios.md), the curve in [Training](training.md#training-level-and-caps).
- Training can never push a stat or SP past the current cap, but **caps never reduce a stat**. A stat carried over above a new scenario's early cap simply waits until Training Level raises the cap past it.
- As in the original game ✅, the part of a stat above 1200 counts about half in races and gains half from training.

## Aptitudes

- They start from the template.
- They improve **only through parent pink sparks**: +1 grade per parent per scenario, chosen from the parent's A/S aptitudes,
  capped at A (see [Skills & Inheritance](skills-and-inheritance.md#pink-sparks-aptitude-upgrades)).

## Strategy (running style)

- Chosen before each race from the strategies the Uma has. The aptitude grade affects race Wit.
- Winning with each strategy feeds strategy badges.
