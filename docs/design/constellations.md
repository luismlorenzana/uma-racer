# Constellations

> All numbers are **draft values for tuning**. `packages/domain/src/constellation.test.ts` pins them.

A **constellation** is a scenario's skill tree. It is where an Uma's stats, skills, and aptitudes come from.
There is no turn-based training, no facility deal, no energy, and no per-turn RNG: you unlock nodes by playing
[minigames](minigames.md), then you decide what goes in them.

## The shape of the system

```
Uma  ─ has ─►  one ScenarioTraining per unlocked scenario
                 │
                 ├── trainingLevel 1–10        ← earned by the match-3 minigame
                 ├── cardSetIds[6]             ← the cards this scenario may use
                 └── node assignments          ← what fills each unlocked slot

Active scenario = the highest tier the Uma has unlocked. Only the active scenario's
constellation contributes to races (D121).
```

Everything an Uma *is* in a race — stats, skills, aptitudes — is **derived** from the active constellation
every time it is read. Nothing is accumulated into a stored number, so re-slotting a card takes effect
immediately and can always be undone.

## A scenario is a career run

Promotion is not a continuation, it is a **restart at a higher ceiling**. The new scenario opens with its own
Training Level 1, its own small set of unlocked nodes, its own six-card set, and its own goals, races, and
milestones. The Uma is temporarily weaker and rebuilds. This is deliberate and matches the original game,
where each scenario is a separate career.

Consequences, all of which the save must honour:

- **Races are scenario-linked** (D122). Winning the Arima Kinen in Trackblazer and winning it in Our Grand
  Concert are two different accomplishments, recorded separately.
- **Achievements, goals, and badges are scenario-scoped**, each scenario carrying its own milestone set.
- The previous scenario's constellation is **kept, readable, and frozen**. It no longer affects races.
- **Uma Level** stays permanent and account-facing: it is earned by racing and it is what unlocks the next
  scenario. It does not feed stats.

## Node kinds

| Kind | Fills with | Pays |
|---|---|---|
| **Card** | one of the six cards in this scenario's card set | stats, by the card's type |
| **Stat** | a stat you pick freely | that stat |
| **Parent** (2) | any owned Uma template | aptitude grades · that Uma's baseline skills |
| **Grandparent** (4) | any owned Uma template | aptitude grades · that Uma's baseline skills |

Card and stat nodes form **one tree rooted at a single root node**. The root is always unlocked and always
empty; it exists to anchor the graph. Parent nodes are **detached from that tree**, and each parent node is
linked to exactly **two grandparent nodes** of its own.

A card may occupy **any number of nodes**, including all of them. That is the central decision: stacking one
card concentrates its stat and hands you more of its skills.

## Unlock schedule

| Training Level | Unlocks |
|---|---|
| 1 | the baseline set (see below) |
| 2–8 | the remaining card and stat nodes, in template order |
| 9 | parent node A, plus its two grandparent nodes |
| 10 | parent node B, plus its two grandparent nodes |

With `N` = card nodes + stat nodes, the count unlocked at Training Level `TL ≤ 8` is:

```
unlockedNodes(TL) = ceil(N × TL / 8)
```

so Training Level 8 opens every card and stat node, and 9 and 10 are purely lineage. Which specific nodes open
is fixed by the template's ordering, which is a breadth-first walk from the root: the tree always grows
outward and never strands an unreachable node.

## Stat budget

Each scenario has a **cap profile**: five per-stat caps whose sum is that scenario's **cap budget**. Tiers 1–4
use the original game's real values, verified 2026-09-20 ([Scenarios](scenarios.md#cap-profiles)). Every early
scenario has the same 7000-point budget shaped differently, which is what makes a scenario an identity rather
than a number.

A **full constellation pays less than the cap budget**, so no configuration reaches every cap:

```
treeBudget(T)  = round(0.60 × capBudget(T))
nodeValue(T)   = treeBudget(T) / (cardNodes(T) + statNodes(T))
```

Tier 1 gives `4200 / 21 = 200` points per node. From tier 5 on every node is worth exactly **150**, and the
scenario's slot count is what grows. Per-scenario counts are in [Scenarios](scenarios.md#constellation-shapes).

### The invariance rule

> **The total depends on which cards occupy how many nodes — never on *which* nodes they occupy, nor on how
> the stats split.** Moving a card from one node to another cannot change your total, and neither can
> choosing a Speed card over a Guts one.

That is what keeps re-slotting a trade rather than a grind: you build for a Sprint race, rebuild for a Long
one, and you are redistributing, never farming. The ceiling is still `treeBudget(T)`, reached by a full tree
of **current-era, max-limit-break** cards.

What *can* change the total is **card quality** — era and limit break (D126, below). A better card is worth
more on the same node, which is what makes the collection matter. Two further exceptions, both visible in the
UI:

1. **Growth rates still apply.** Raw points are scaled per stat by the Uma's `growthRates` from her template,
   so an Uma with Speed +20% gets more absolute Speed out of the same raw point. That is her identity, and it
   is why two Umas with the same constellation are not the same Uma.
2. **The scenario slot pays SP, not stats** (below).

### What a card node pays

A card node distributes `nodeValue × lbMult(card)` across stats by the card's type. Every row sums to 1.0, so
the invariance rule holds regardless of which types you slot:

| Card type | Distribution |
|---|---|
| Speed | Speed 0.70 · Power 0.30 |
| Stamina | Stamina 0.70 · Guts 0.30 |
| Power | Power 0.70 · Stamina 0.30 |
| Guts | Guts 0.60 · Speed 0.20 · Power 0.20 |
| Wit | Wit 0.70 · Speed 0.30 |
| Friend / Group | 0.20 to each of the five |

A **stat node** puts 1.00 of its value into the stat you pick. Stat nodes are the release valve: they are how
you find the 200 Stamina a Mile race wants without slotting a Stamina card you would otherwise never bring.

### Card quality: era and limit break

A node pays `nodeValue(T) × lbPct × eraPct`, both percentages:

```
lbPct  = LB0 60 · LB1 70 · LB2 80 · LB3 90 · LB4 100
eraPct = max(40, 100 − 5 × (T − cardEra))
```

**Era is measured against the scenario, not in absolute terms.** A card from the scenario's own era is full
value; every era it predates costs five points, floored at 40. So Kitasan Black's Speed card and a newer Speed
card hand you the same kind of skills, and the newer one pays more stats — but a tier-1 card is never worthless,
and `treeBudget(T)` stays the real ceiling at every tier rather than drifting upward as eras pile up.

| Card age in tier `T` | current | 1 era old | 3 | 6 | 12+ |
|---|---|---|---|---|---|
| Pays | 100% | 95% | 85% | 70% | 40% |

This is also the pressure that keeps a collection alive: as an Uma climbs tiers, the cards that carried her
fall behind, and the ones you pull matter again. An under-broken card underpays the same way, which is what
makes the [card minigame](minigames.md#bond-recall--card-limit-breaks) worth playing.

### The scenario slot

One of the six card-set slots is the scenario's **dedicated slot**. A card placed there pays
`nodeValue × lbMult × 0.25` **Skill Points** on every node it occupies and **no stats at all**.

Against tier 1's 300 SP cap, a max-broken card on four nodes yields 200 SP — a real loadout, bought by giving
up a stat card. The trade is explicit and reversible.

*(Chosen because our content packs carry no scenario→card link, so a designated slot delivers the same choice
without inventing data we do not have. D124.)*

### Applying the budget

```
raw(s)     = Σ over assigned nodes of ( nodeValue × lbPct × eraPct × share[type][s] )
derived(s) = min( capProfile(T)[s], round( baseStats[s] + raw(s) × (1 + growthRates[s]) ) )
```

Every factor is an integer percentage, so the engine accumulates exact integers and divides once. The
invariance rule is therefore asserted as exact equality in tests, not within a tolerance.

Caps clamp, never reduce. Because the tree budget is 60% of the cap budget, the clamp only bites on a
deliberately lopsided build — which is correct: it tells you that stat is full and the points belong elsewhere.

There is no 1200 soft-cap halving on gains any more. The halving stays where the original game puts it, in
race performance ([Racing](racing.md)).

## Skills

Two sources, both deterministic. No hint rolls.

1. **Card nodes.** Each node a card occupies unlocks the **next** skill from that card's `hintSkills`, ordered
   gold-first then white, then by skill id. A card on four nodes gives four of its skills. Stacking a card is
   therefore a skill decision as well as a stat one.
2. **Lineage nodes.** Each filled parent or grandparent node contributes that Uma template's four
   `awakeningSkillIds` — her baseline golds and whites — to the library. Uniques are **not** inherited (D123).

Everything lands in the scenario's **skill library**, deduplicated. **Skill Points are the only limit**: the
equipped loadout's total cost must be ≤ the Uma's current SP. Swapping is free and instant outside races.

The library is scoped to the scenario like everything else, and is recomputed from the constellation rather
than stored — so removing a card removes the skills it was paying for.

## Aptitudes

The six lineage slots are the only thing that moves an aptitude. For each of the ten individual aptitudes
(turf, dirt · sprint, mile, medium, long · front, pace, late, end):

```
steps(a)  = max(0, |{ filled lineage slots whose template grades a at A or S }| − 1)
result(a) = max( gradeIndex('A'), baseGrade(a) − steps(a) )
```

One formula, both of the owner's constraints:

| Base | All six slots at A/S | Why |
|---|---|---|
| **F** (6) | 6 − 1 = 5 steps → **A** | a perfect lineage can rescue an F |
| **G** (7) | 5 steps → **B** | a G can never reach A, ever |

Upgrades are capped at **A**; S is never granted. A single filled slot gives 0 steps, so lineage has to be
built up, and aptitudes recompute live as you change slots like everything else.

## Lineage eligibility

A parent or grandparent slot accepts **any Uma template the player owns**. There are no snapshots, no
"must have completed a scenario", and nothing is frozen — a lineage slot is a reference to a template, and
templates never change (D123).

- The Uma herself is never eligible.
- No two slots may hold the same character, including different outfits of that character.
- Slots may be changed whenever they are unlocked, like every other node.

*(This replaces parent snapshots, grandparent skill-picking, inheritable-white computation, pink sparks, and
the circular-lineage rules entirely. Owning more Umas is still what makes lineage good, which keeps the
collection load-bearing.)*

## Reconfiguration

Every unlocked node is editable at any time, outside a race. There is exactly one persisted configuration per
scenario — the current one. There are no saved presets and no configuration history: you change it, you race,
you change it back.

Reconfiguration never costs tickets, never touches Training Level, never touches card levels, and cannot fail.
The only thing that gates it is whether a node is unlocked.

## Templates

A constellation template is **static content**, authored per scenario, not generated:

| Field | Notes |
|---|---|
| `tier`, `scenarioId` | which scenario this is the tree for |
| `shape` | the constellation silhouette, e.g. `single-trunk`, `three-branch` |
| `cardNodes`, `statNodes` | counts; the sum decides `nodeValue` |
| `nodes[]` | id, kind, parent id, and layout position |
| `scenarioSlot` | which of the six card-set slots is the dedicated SP slot |
| `buff` | the scenario's mechanic (see [Scenarios](scenarios.md#scenario-buffs)) |

Templates are validated at import: the card/stat nodes must form one connected tree rooted at the root node,
parent nodes must be detached and have exactly two grandparent children each, and the counts must match.
