# Uma Progression

> All numbers below are **draft values for tuning**, not final.

## Two layers of data

**Active CL adaptation (D287, D290):** after protected bank2 activation, save16's existing `trainingLevel` stores
Constellation Level1–10 and `trainingExp` is required zero. Profile EXP bank is also zero. Before activation the
save15 remains readable for guarded preparation. All four distance presets, Inspiration/Extra unlocks, racing progression,
global card references and histories are preserved; future units start CL1 with no frozen legacy debt. No stat
formula or scenario gate changes. [Version/receipt contract](../technical/uma-puzzles-implementation.md#t115-implemented-preservation-v2-d287).

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
| `scenarios[]` | **One scenario unit per unlocked tier** (below). The heart of the save |
| `activePreset` | The [distance preset](#distance-presets) her profile shows and edits, and that every race-free use reads (D252) |
| `lifetimeSkills` | Every skill ever learned, with the scenario it was learned in. Badges and history |
| Badge/title/showcase state | Separate versioned `badges/uma:<umaId>` entity. See [Badges](badges.md) |

**Stats, skill points, aptitudes, the skill library and the loadout are no longer stored.** They are derived
from one scenario seen through one distance preset whenever read: the active scenario unless another trained unit is
racing ([Training](training.md#stats-are-derived), D190), through her selected preset unless a race names its distance
(D252).

### Scenario unit (one per unlocked scenario)

| Field | Notes |
|---|---|
| `tier` | Which scenario this is |
| `trainingLevel`, `trainingExp` | CL1–10, raised by [material spend](training.md#spending-materials); retired EXP is zero in16. Nodes are shared across every preset |
| `extraStatsUnlocked` | Each stat's [Extra stat](constellations.md#extra-stats) nodes bought with crops (0–4), for every preset (D235) |
| `inspiration` | Which lineage slots and natural golds are open (D250), for every preset |
| `presets` | Four builds, one per distance (below) |
| `goals`, `journey` | This scenario's frozen [career](scenario-goals.md) and its outcomes |
| `raceHistory` | This scenario's races. **Races are scenario-linked** (D122) |
| `milestones` | This scenario's achievement facts |

A completed scenario's entry is kept in full as a **trained unit** (D190): it still races, reconfigures and trains in its
own context, without Uma EXP. Its career stays closed. See [Training — scenario career](training.md#a-scenario-is-a-career-run).

### Distance presets

An Uma that races more than one distance needs more than one build. Each scenario unit holds **four presets**, Sprint,
Mile, Medium and Long, and each preset is a whole build of its own (D252):

| Per preset | Shared by the scenario's four presets |
|---|---|
| `cardSetIds`: up to 6 owned, era-eligible cards; no duplicate character | Constellation Level, and so which nodes are open |
| `assignments`: `nodeId → { card } | { lineage }`, the constellation's cards and the parents and grandparents | Extra stat nodes bought with crops |
| `activeExtraStats`: at most six of the bought Extra stat nodes | Inspiration's open slots and golds |
| `loadoutSkillIds`: the equipped skills; the SP budget comes from this preset's constellation | The career, scenario start and card stars |

Stats, aptitudes, the skill library and SP follow from the preset, so each preset races with its own numbers. Her
running style stays one per Uma. Her profile selects a preset (`activePreset`) and every training screen edits it; a
race uses the preset of its distance. Save v15 copied each scenario's one build into all four presets, so nothing changed
until one was edited; she started on her race-default distance, or Medium without one, and a new Uma starts on her best
base distance. A card is "in a set" when any of her presets holds it, and a constellation counts as full for Full House
when any one preset's tree is.

## Uma Level and EXP

- Uma Levels run 1 → `10 × scenarios` (140 today).
- **Only racing gives Uma EXP.** 2nd and 3rd place give 25% of win EXP.
- **Every Uma Level-up earns +1 training ticket** (D148).
- **Her career holds levels 2 and 5 of each scenario** until its Maiden and Trials goals are won. A held Uma banks
  EXP just short of the next level, and the race that wins the goal releases it
  ([Scenario Careers](scenario-goals.md#three-stages)).
- **Every scenario costs the same** (D241): `expToNext(level) = 100 + 25 × levelsIntoScenario(level)`, so a scenario's
  levels cost 100, 125 … 300 and its nine level-ups 1,800 EXP, from URA Finale to the fourteenth. A gate banks the next
  scenario's first level, 100. Uma Level is race EXP only; it has nothing to do with CL or Puzzle Level/materials.

  | Wins a scenario takes | G1 (150) | G1 with +33% Race Bonus (200) | G2 (110) |
  |---|---:|---:|---:|
  | Any scenario, 1,800 EXP | 12 | 9 | 17 |

  An Uma therefore runs about 12–16 races a scenario (her six career goals among them, with some 2nd and 3rd places at
  a quarter of the EXP), and roughly 170–220 to finish all fourteen. The curve before save v13 rose without end,
  `100 + 25 × (level − 1)`: scenario 2 cost 4,050 EXP (27 G1 wins), scenario 14 31,050 (207), and Lv140 about 230,000.
  Save v13 re-levelled each Uma through the EXP she had earned in her current scenario, with the tickets and gate shard of
  every level it reached paid under the race's own ledger ids.
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
   - A **new `ScenarioTraining`** is created at Constellation Level 1 with the baseline nodes open, an empty card
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
or multiplied at the gate. Constellation Level makes her stronger by opening nodes, and stars by filling them. Rivals are
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
