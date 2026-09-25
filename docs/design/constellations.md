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
statNodeValue(T) = 240 / statNodes(T)                                   the stat-node pool, fixed
nodeValue(T)     = round((0.60 × capBudget(T) − 240) / cardNodes(T))    one card node
treeBudget(T)    = cardNodes(T) × nodeValue(T) + 240                    ≈ 0.60 × capBudget(T)
```

**Stat nodes share a fixed 240-point pool** at every tier (D134): 80 a node at tier 1, down to 40 at tier 14.
They are for tweaks — the stamina a mile needs, one more point of Speed — and cards carry the build. Card nodes
share the rest: **220** at tier 1, 163–172 from tier 5. Per-scenario counts are in
[Scenarios](scenarios.md#constellation-shapes).

| Tier | 1 | 2 | 3 | 4 | 5–7 | 8–11 | 12 | 13–14 |
|---|---|---|---|---|---|---|---|---|
| Card node | 220 | 198 | 233 | 189 | 163–164 | 167–169 | 172 | 171 |
| Stat node | 80 | 60 | 80 | 60 | 60 | 48 | 40 | 40 |
| Per-card cap | 4 | 5 | 4 | 5 | 6 | 6 | 6 | 7 |

### Per-card cap

**No card may fill more than its fair share of the card nodes plus one** (D134):

```
fairShare(T) = ceil(cardNodes(T) / 6)        cardNodeCap(T) = fairShare(T) + 1
```

One Speed card cannot carry a Speed build — a high Speed stat needs two — and the +1 is the wiggle room: the same
six cards can lean one node towards Speed, Wit or Stamina for a given race. The node sheet shows `held / cap` for
each card and refuses a card that is full; a save that already holds more keeps only the first `cap` nodes in tree
order, and the rest pay nothing.

### The career-race bonus

**Every stat starts at its base + 400**, and everything the constellation pays adds on top (D139). The original game
adds 400 to every stat in career races; we fold it into derived stats, so the number on the profile is the number
raced. It lifts what a build neglects — a sprinter's stamina, a stayer's power — without inflating the stats it
trains, and it sits outside the tree, so the invariance rule is unchanged.

It replaces D134's untrained floor of `50 × Training Level`, which reached the same place (500) only at TL10: below
about TL6 it left stamina so far behind speed that no build could win a race.

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
2. **Friend and Group cards pay SP, not stats** (below).

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
| Friend / Group | **skill points instead** — see [Skill-point cards](#skill-point-cards) |

A **stat node** puts 1.00 of its value into the stat you pick. Stat nodes are the release valve: they are how
you find the 200 Stamina a Mile race wants without slotting a Stamina card you would otherwise never bring.

### Card quality: era and limit break

A node pays `nodeValue(T) × lbPct × eraPct`, both percentages:

```
lbPct  = LB0 60 · LB1 70 · LB2 80 · LB3 90 · LB4 100
eraPct = max(40, 100 − 5 × (T − cardEra))
```

A card's limit break is **also per scenario** (D127), so both halves of card quality are measured against the
scenario a node belongs to.

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

### Skill-point cards

**Friend and Group cards pay skill points instead of stats**, in whatever slot of the set they sit (D132). A node
filled with one pays **Skill Points** and **no stats at all**; every other card pays its stats, whichever slot it
is in:

```
spNodeValue(T)  = round(0.60 × spCap(T) / fairShare(T))        400 SP a node at tier 1, 500 at tier 14
SP              = min( spCap(T), baselineSP(T, TL) + Σ SP nodes × lbPct × eraPct )
baselineSP(T, TL) = 0.40 × spCap(T) × TL / 10                  800 at tier 1, TL10
```

So training alone earns 40% of the cap, and one max-bonded, current-era Friend or Group card on its fair share
earns the other 60% (D133). Caps are in [Skills](skills-and-inheritance.md#skill-points-are-the-only-limit).

These are the original game's non-trainee cards — Tazuna Hayakawa, Riko Kashimoto, Light Hello, Yayoi Akikawa,
Team Sirius and the rest — the ones its scenarios are built around, so they are the natural "scenario cards".

At tier 1 that is 2,000 SP — five or six golds with their white prerequisites — bought by giving up a stat card.
The trade is explicit and reversible. Two skill-point cards are allowed; SP past the cap is simply lost, which is
its own limit. A set with none still earns the 40% baseline.

*(Supersedes D124's sixth-slot rule: the owner slotted a Wit card sixth and got skill points and no Wit, while
Tazuna paid a thin 20% to every stat. A card's type is visible on the card; a slot position was not.)*

### Applying the budget

```
raw(s)     = Σ card nodes ( nodeValue × lbPct × eraPct × share[type][s] ) + Σ stat nodes on s ( statNodeValue )
derived(s) = min( capProfile(T)[s], round( max(baseStats[s], 50 × TL) + raw(s) × (1 + growthRates[s]) ) )
```

Every factor is an integer percentage, so the engine accumulates exact integers and divides once. The
invariance rule is therefore asserted as exact equality in tests, not within a tolerance.

Caps clamp, never reduce. Because the tree budget is 60% of the cap budget, the clamp only bites on a
deliberately lopsided build — which is correct: it tells you that stat is full and the points belong elsewhere.

There is no 1200 soft-cap halving on gains any more. The halving stays where the original game puts it, in
race performance ([Racing](racing.md)).

## Balance targets: the stamina ladder

Decks are chosen for a distance (D134). Measured with `pnpm sim:constellation` in 12-runner G1 fields — a pack burns
about 40% more HP than a solo run, which is what the original game's own stamina charts assume — at TL10 with a full
tree of max-bond current-era cards, median base stats and no growth, running pace and late:

| Distance | Deck | Stamina it needs to supply | Holds at |
|---|---|---|---|
| Sprint (1,400 m) | 2 Speed · Guts or Power · 2 Wit · Friend, nothing into stamina | base + 400 | every tier |
| Mile (1,800 m) | the same, stat nodes into Stamina | base + 400 + stat pool | every tier |
| Medium (2,200 m) | 2 Speed · Stamina · 2 Wit · Friend | base + 400 + one stamina card | every tier |
| Medium (2,400 m) | the same, stamina card leaned one node | base + 400 + stamina card at cap | every tier |
| Long (2,500–3,200 m) | stamina card at cap, stat nodes into Stamina, 1–2 gold heals | everything | every tier |

The sim fails its run if any of these stops holding. Soft checks say each step is also *needed* for the next: a
sprint set cannot run 1,800 m, stat nodes alone cannot run 2,400 m, one stamina card alone cannot run 3,000 m.
Those hold except where late scenarios' stronger cards make a step easier — the power creep that the stamina
contest ([Racing](racing.md#stamina-contest-engine-v4)) turns into speed.

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

## The screen

The constellation is the one screen that gets the dark **stage** surface, because that is what makes it read
as a constellation rather than a form.

- **Nodes** are circles on a 100×100 unit canvas that stretches to the screen's aspect, so a portrait phone
  spreads the tree down its long axis instead of wasting it. Locked nodes are faint and unlabelled, unlocked
  and empty ones are dashed outlines, and a filled node shows the card or Uma icon with its type colour on
  the rim.
- **Edges** are hairlines. An edge between two nodes holding the same card brightens to the accent, so a
  stacked card reads as one line of the constellation rather than as repetition.
- **A stat strip** above the graph carries the five derived stats and SP, each with a delta against the
  configuration as it was when the screen opened.
- **The aptitude line** below it names every grade lineage has moved, with the step count that produced it.
- **Pan and pinch-zoom**, with a Fit control. The view refits when the host resizes.

Node cells are 36 pt at fit. A 38-node tier-14 tree cannot show 44 pt cells on a 375 pt screen — 88 layout
units of width leaves about 26 pt per cell — so fit is the overview and pinching in is how you work on a
crowded tree.

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
