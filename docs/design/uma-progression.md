# Uma Progression

> All numbers below are **draft values for tuning**, not final.

## Two layers of data

### Uma template (static, sourced from the original game)

| Field | Notes |
|---|---|
| `id`, `name`, `outfit` | **One template per outfit**. Badges roll up per character |
| `baseStats` | The original game's 5★ base stats, for every Uma ✅. The floor every constellation builds on |
| `growthRates` | Percentage bonus per stat, applied to raw constellation points. An Uma's identity |
| `aptitudes` | Surface · Distance · Strategy, graded S–G. The base that lineage improves |
| `uniqueSkill` | Innate unique skill, free and always equipped |
| `awakeningSkillIds` | Her four baseline golds and whites. What she pays when used as a **lineage slot** |
| `realHorseSex` | Male / Female. Decides the classic set in her [career](scenario-goals.md) and the Stable filter |
| `signatureRaceFamilyIds` | Ordered career-objective race families. Her [career](scenario-goals.md#choosing-the-races) picks these first |
| `starter` | Part of the 25-trainee starting roster (see [Collection](collection.md)) |
| `icon`, `portrait` | Local asset references only |

Templates are now load-bearing in a second way: a lineage slot is a **reference to a template**, so every Uma
you own is a usable parent the moment you own her (D123).

### Uma instance (persisted, belongs to the player)

| Field | Notes |
|---|---|
| `level`, `exp` | **Uma Level**: permanent, earned from races only. Unlocks scenarios; does not feed stats |
| `unlockedTier` | Highest scenario unlocked. The **active** scenario: her career, the only one that earns Uma EXP (D121). Every unlocked scenario still races as a trained unit (D190) |
| `scenarios[]` | **One `ScenarioTraining` per unlocked tier** (below). The heart of the save |
| `lifetimeSkills` | Every skill ever learned, with the scenario it was learned in. Badges and history |
| Badge/title/showcase state | Separate versioned `badges/uma:<umaId>` entity. See [Badges](badges.md) |

**Stats, skill points, aptitudes, the skill library and the loadout are no longer stored.** They are derived
from a `ScenarioTraining` whenever read, the active one unless another trained unit is racing
([Training](training.md#stats-are-derived), D190).

### ScenarioTraining (one per unlocked scenario)

| Field | Notes |
|---|---|
| `tier` | Which scenario this is |
| `trainingLevel`, `trainingExp` | 1–10, earned by [Spark Rival Circuit](minigames.md#spark-match--rival-circuit). Decides which nodes are open |
| `cardSetIds` | Up to 6 owned, era-eligible cards; no duplicate character |
| `assignments` | `nodeId → { card } | { lineage }`. The current configuration, and the only one |
| `extraStats` | The [Extra stats](constellations.md#extra-stats) grid: each stat's bought nodes (0–4) and the six at most that are on (D235) |
| `loadoutSkillIds` | The equipped subset of the derived library |
| `goals`, `journey` | This scenario's frozen [career](scenario-goals.md) and its outcomes |
| `raceHistory` | This scenario's races. **Races are scenario-linked** (D122) |
| `milestones` | This scenario's achievement facts |

A completed scenario's entry is kept in full as a **trained unit** (D190): it still races, reconfigures and trains in its
own context, without Uma EXP. Its career stays closed. See [Training — trained units](training.md#trained-units).

## Uma Level and EXP

- Uma Levels run 1 → `10 × scenarios` (140 today).
- **Only racing gives Uma EXP.** 2nd and 3rd place give 25% of win EXP.
- **Every Uma Level-up earns +1 training ticket** (D148).
- **Her career holds levels 2 and 5 of each scenario** until its Maiden and Trials goals are won. A held Uma banks
  EXP just short of the next level, and the race that wins the goal releases it
  ([Scenario Careers](scenario-goals.md#three-stages)).
- Draft curve: `expToNext(level) = 100 + 25 × (level − 1)`
- Draft EXP per win by grade, before card Race Bonus:

  | Debut/Maiden | Pre-OP/OP | G3 | G2 | G1 |
  |---|---|---|---|---|
  | 40 | 60 | 80 | 110 | 150 |

## Gate levels and unlocking the next scenario

1. **Reaching** a gate level (10, 20, 30…) grants **1 Uma Shard**, once per Uma per gate.
2. At the gate she **keeps racing until her career is complete**; a career frozen before goal plan v3 does not gate.
   Then the card shows **"Ready to advance"**. Advancing costs **5 × the completed tier** tickets and is
   **explicit** — the player chooses when.
3. On advancing:
   - Level becomes gate + 1. Banked overflow EXP applies immediately.
   - A **new `ScenarioTraining`** is created at Training Level 1 with the baseline nodes open, an empty card
     set, a fresh career, and an empty race record.
   - It becomes the **active** scenario at once and drives every race from then on.
   - The previous scenario's entry is kept as a trained unit that can still race (D190); its career is closed.
   - The Uma earns the **"<Scenario> Graduate"** badge.

There is no promotion stat bonus and no Initial Stats grant: stats are derived, so the new scenario's tree is
the only thing that pays them. **An Uma is temporarily weaker after advancing and rebuilds.** That is the
design — a scenario is a career run, not a continuation
([Constellations](constellations.md#a-scenario-is-a-career-run)).

At the highest available tier there is nothing further to unlock: her last career closes on its final win, and she
keeps racing and refining that scenario's constellation.

## Stats and caps

- Stats are **derived** from the active constellation, clamped by that scenario's
  [cap profile](scenarios.md#cap-profiles).
- A full constellation pays about 60% of the cap budget, so **no build reaches every cap**. Choosing where the
  points go is the game.
- As in the original game ✅, the part of a stat above 1200 counts about half **in races**. That halving lives
  in [Racing](racing.md) and no longer touches training.

## Getting stronger in races

Your Uma races with **the stats on her profile**: her base stats and what her constellation pays, with nothing added
or multiplied at the gate. Training Level makes her stronger by opening nodes, and stars by filling them. Rivals are
a typical trained Uma of her tier made weaker by the race's grade (D159); details in
[Racing — the grade handicap](racing.md#difficulty-the-grade-handicap).

## Aptitudes

- They start from the template.
- They improve **only through lineage nodes**, capped at A
  ([Skills & Lineage](skills-and-inheritance.md#aptitude-upgrades)).
- Because lineage is reconfigurable, aptitudes can move both ways as slots change. They are a property of the
  current build, not a permanent award.

## Strategy (running style)

- Chosen before each race from the strategies the Uma has. The aptitude grade affects race Wit.
- Winning with each strategy feeds strategy badges.
