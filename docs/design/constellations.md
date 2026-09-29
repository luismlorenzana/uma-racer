# Constellations

> All numbers are **draft values for tuning**. `packages/domain/src/constellation.test.ts` pins them.

A **constellation** is a scenario's skill tree. It is where an Uma's stats, skills, and aptitudes come from.
There is no turn-based training, no facility deal, no energy, and no per-turn RNG: you unlock nodes by playing
[minigames](minigames.md), then you decide what goes in them.

## The shape of the system

```
Uma  ─ has ─►  one ScenarioTraining per unlocked scenario
                 │
                 ├── trainingLevel 1–10        ← earned by Spark Rival Circuit
                 ├── cardSetIds[6]             ← the cards this scenario may use
                 └── node assignments          ← what fills each unlocked slot

Active scenario = the highest tier the Uma has unlocked: her career. Every unlocked scenario is a
trained unit that can race in its own context (D190).
```

Everything an Uma *is* in a race — stats, skills, aptitudes — is **derived** from the racing scenario's
constellation every time it is read. Nothing is accumulated into a stored number, so re-slotting a card takes effect
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
- The previous scenario's constellation is **kept as a trained unit** (D190): it still races, and can still be
  reconfigured and trained, in that scenario's context. It pays no Uma EXP, and its career is closed.
- **Uma Level** stays permanent and account-facing: it is earned by racing and it is what unlocks the next
  scenario. It does not feed stats.

## Node kinds

| Kind | Fills with | Pays |
|---|---|---|
| **Card** | one of the six cards in this scenario's card set | stats, by the card's type |
| **Stat** | a stat you pick freely | that stat |
| **Parent** (2) | any owned Uma template | aptitude grades · that Uma's baseline skills |
| **Grandparent** (4) | any owned Uma template | aptitude grades · that Uma's baseline skills |

**Planned, not yet executable:** [Stable Farm](farm.md) M025 builds scenario produce and global Item inventory. M026 then
renames these six Stat nodes to Produce nodes without moving or revaluing them: filling one consumes a scenario-matched
crop, whose stat receives the same 40 raw points (D205). Existing assignments migrate as contribution-preserving legacy
fills. Until M026 lands, every Stat rule in this document remains current.

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
statNodeValue(T) = 240 / 6 = 40                                         the stat-node pool, fixed, over six nodes
nodeValue(T)     = round((0.60 × capBudget(T) − 240) / cardNodes(T))    one card node
treeBudget(T)    = cardNodes(T) × nodeValue(T) + 240                    ≈ 0.60 × capBudget(T)
```

**Stat nodes share a fixed 240-point pool** at every tier (D134), and every tree has **six** of them (D162), so each
pays 40 and a build can spread its tweaks over several stats. They are for tweaks — the stamina a mile needs, one
more point of Speed — and cards carry the build. Card nodes
share the rest: **220** at tier 1, 163–172 from tier 5. Per-scenario counts are in
[Scenarios](scenarios.md#constellation-shapes).

| Tier | 1 | 2 | 3 | 4 | 5–7 | 8–11 | 12 | 13–14 |
|---|---|---|---|---|---|---|---|---|
| Card node | 220 | 198 | 233 | 189 | 163–164 | 167–169 | 172 | 171 |
| Stat node | 40 | 40 | 40 | 40 | 40 | 40 | 40 | 40 |
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

### Stats start at base

**Every stat starts at the Uma's base stat** (about 110), and everything the constellation pays adds on top (D152).
Nothing is added at the gate: the number on the profile is the number raced. A full tree of fully bonded cards
averages about 950 a stat in scenario 1 and 1,260 in scenario 14, and a new set of 0★ cards about 60% of that.

The original game adds 400 to every stat in career races, and D139 folded that in. It is gone: it made every Uma
read over 1,000 in every stat whatever her cards, and it hid what a build neglects. A stat left at base is a real
weakness now. Low guts makes the last spurt burn HP much faster (the original's spurt rule), so every distance
needs some stamina and guts from the tree ([the stamina ladder](#balance-targets-the-stamina-ladder)).

### The invariance rule

> **The total depends on which cards occupy how many nodes — never on *which* nodes they occupy, nor on how
> the stats split.** Moving a card from one node to another cannot change your total, and neither can
> choosing a Speed card over a Guts one.

That is what keeps re-slotting a trade rather than a grind: you build for a Sprint race, rebuild for a Long
one, and you are redistributing, never farming. The ceiling is still `treeBudget(T)`, reached by a full tree
of **current-era, 5★** cards.

What *can* change the total is **card quality** — era and stars (D126, D147, below). A better card is worth
more on the same node, which is what makes the collection matter. Two further exceptions, both visible in the
UI:

1. **Growth rates still apply.** Raw points are scaled per stat by the Uma's `growthRates` from her template,
   so an Uma with Speed +20% gets more absolute Speed out of the same raw point. That is her identity, and it
   is why two Umas with the same constellation are not the same Uma.
2. **Friend and Group cards pay SP, not stats** (below).
3. **Each scenario's buff** (D165, [Scenarios](scenarios.md#scenario-buffs)) may reward which cards you bring and how
   many nodes each fills, but never which node a card sits on, so moving a card still never changes a total.

### What a card node pays

A card node distributes `nodeValue × starPct(card)` across stats by the card's type. Every row sums to 1.0, so
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

### Card quality: era and stars

A node pays `nodeValue(T) × starPct × eraPct`, both percentages:

```
starPct = 0★ 60 · 1★ 68 · 2★ 76 · 3★ 84 · 4★ 92 · 5★ 100
eraPct  = max(40, 100 − 5 × (T − cardEra))
```

A card's stars are **also per scenario** (D127, D147), so both halves of card quality are measured against the
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
makes the [card minigame](minigames.md#friendship-training--card-stars) worth playing.

### Skill-point cards

**Friend and Group cards pay skill points instead of stats**, in whatever slot of the set they sit (D132). A node
filled with one pays **Skill Points** and **no stats at all**; every other card pays its stats, whichever slot it
is in:

```
spNodeValue(T)  = round(0.60 × spCap(T) / fairShare(T))        400 SP a node at tier 1, 500 at tier 14
SP              = min( spCap(T), baselineSP(T, TL) + Σ SP nodes × starPct × eraPct )
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
raw(s)     = Σ card nodes ( nodeValue × starPct × eraPct × share[type][s] ) + Σ stat nodes on s ( statNodeValue )
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

Stats start at base (D152), so every rung pays for its stamina, and each adds one source:

| Distance | Deck | Stamina (tier 1 · 14) | Holds at |
|---|---|---|---|
| Sprint (1,400 m) | 2 Speed · Stamina · 2 Wit · Friend, stat nodes into Speed | 567 · 823 | every tier |
| Mile (1,800 m) | the same, stat nodes into Stamina | 807 · 1,063 | every tier |
| Medium (2,200–2,400 m) | 2 Speed · Stamina leaned one node · Power · Wit · Friend, stat nodes into Stamina | 1,225 · 1,542 | every tier |
| Long (2,500–3,200 m) | 2 Speed · 2 Stamina · Wit · Friend, stat nodes into Stamina, 1–2 gold heals | 1,400 · 1,900 (both caps) | every tier |

"Holds" means a full spurt with HP lasting to within 60 m of the line, the stretch the original's spurt plan leaves out
(D158). The sim fails its run if any of these stops holding. Soft checks ask whether each step is also *needed*. One
holds at every tier: a set with no stamina card cannot run 1,400 m, however its stat nodes go. The rest are looser than
the table: a Power card set runs 3,000 m with a gold heal at every tier but 1, 10 and 11, a lean alone runs 2,400 m
at tiers 2, 13 and 14, and a sprint set runs 1,800 m at tiers 8, 12, 13 and 14. At tier 1 a lean alone falls short of
2,200 m, which is why the Medium row carries a Power card. Measured 2026-09-26 on engine v7, at the original's HP
rate (D158), against realistic generated rival fields (D159). v7's heals re-plan a spurt already under way, which is
what lets the Long row's two gold heals carry 3,200 m at tier 1.
Later scenarios' stronger cards loosen it further, the power creep that the stamina contest
([Racing](racing.md#stamina-contest-engine-v4)) turns into speed.

## Skills

Three sources, all deterministic. No hint rolls.

1. **Card nodes.** Each node a card occupies unlocks the **next of its golds**, while it has any left, and the **next
   of its whites** (D182). A card's whites are its `hintSkills`, in the pack's order; its golds are the golds among its
   `eventSkills`, in event order, because in the original a card's gold comes from its event chain and every hint skill
   is white. A card on four nodes pays four whites and up to four golds (most cards have one), so stacking a card is a
   skill decision as well as a stat one.
2. **Lineage nodes.** Each filled parent or grandparent node contributes that Uma template's four
   `awakeningSkillIds` — her baseline golds and whites — to the library, and her unique in its inherited form (D174).
3. **Her own kit** (D186). What she brings herself, as an original career does: her three **innate** skills and every
   skill her own **story events** teach (mostly whites), from her first scenario; and her four **awakening** skills in
   pairs, a white and a gold, the first pair from her first scenario and the second from her second. The Skills page
   shows a pair that is still closed, with the scenario it opens in, so nothing of hers is hidden.

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
as a constellation rather than a form. The stage is a lit panel: a soft radial light behind the tree, an inner
edge and shadow, and the tree drawn on it like a tech tree in a game menu (D143).

- **The root** sits where the silhouette puts it and carries the scenario's crest in a gold ring. Every path
  starts there, so the tree visibly grows from the scenario.
- **Nodes** are shaped by kind: card nodes are framed square tiles, stat nodes are gems (a tile turned 45°), and
  lineage nodes are portrait rounds. Each has four states:

  | State | Look |
  |---|---|
  | Locked | A dark recessed socket with a faint lock; lineage sockets name their Training Level |
  | Opens next | A dashed gold socket naming the Training Level that opens it (`TL3`) |
  | Open, empty | A lit frame with a **+**, gold on the tree and silver in lineage |
  | Filled | The card icon, the stat's colour and label, or the Uma's bust, framed and glowing in the card type's, stat's or lineage colour |

- **Paths** are drawn, not hairlines. A path into a locked node is a dark groove. An open path is a slate line
  in a dark outline. A path whose two ends are both filled **lights up**: gold, glowing, and in the card's own
  colour where both ends hold the same card, so a stacked card reads as one stroke of the constellation.
  Lineage paths light silver.
- **A stat strip** above the graph carries the five derived stats and SP, each with a delta against the
  configuration as it was when the screen opened.
- **The aptitude line** below it names every grade lineage has moved, with the step count that produced it.
- **Pan and pinch-zoom.** A **Fit** control appears once the view has moved; at fit it would only cover a
  corner node. The view refits when the host resizes.

Tiles are sized from the tightest spacing between two nodes on the actual screen: 72% of it, between 26 and
44 pt. Every silhouette keeps at least 40 pt between node centres on a 375 × 812 phone (whose graph box is
351 × 525 pt), so tiles land at 30–35 pt at fit and never overlap. On a crowded tree, fit is the overview and
pinching in is how you work.

## Templates

A constellation template is **static content**, authored per scenario, not generated:

| Field | Notes |
|---|---|
| `tier`, `scenarioId` | which scenario this is the tree for |
| `shape` | the constellation silhouette, e.g. `single-trunk`, `three-branch` |
| `cardNodes`, `statNodes` | counts; the sum decides `nodeValue` |
| `nodes[]` | id, kind, parent id, and layout position, built from the silhouette |
| `buff` | the scenario's mechanic (see [Scenarios](scenarios.md#scenario-buffs)) |

### Silhouettes

Each scenario's tree is **drawn on a grid** in `packages/domain/src/constellation-shapes.ts` (T052, D143):

```
      R          R  the root
      |          o  a card or stat node
o-o-o-o-o-o-o    -  |  join straight neighbours; a run may cross an empty position
|     |     |    /  \  join diagonal neighbours
o     o     o
```

Nodes sit on even columns and lines, connectors between them. So every edge is straight, and two edges can
never cross: a crossing would need two connectors in one character. The grid is scaled into the tree's band
(x 2–98, y 2–74 of the 100-unit canvas); lineage sits below it, parents at y 83 and grandparents at 94, with a
labelled divider between.

What each node *is* is not drawn. The template numbers the nodes **breadth-first from the root**, nearer rows
and then columns first. That number is the unlock order, so the tree opens outward from the root, and the last
`statNodes` numbers, the ends of the branches, are the stat nodes. Ids (`n0`…), kinds and order are therefore
fixed by the counts alone: redrawing a silhouette moves nodes on screen but never turns a saved card node into a
stat node. Adding stat nodes, as D162 did, appends new ids after every old one and only ever opens more nodes at a
Training Level, never fewer.

A template refuses to build if its drawing has the wrong node count, is not one tree, or has a connector that
leads nowhere. `validateTemplate` then checks the structure: the card and stat nodes form one connected tree
rooted at the root node, the parent nodes are detached with exactly two grandparent children each, and the counts
match. The domain tests also pin 40 pt between nodes on a 375 pt phone, no crossing edges, and breadth-first
order.
