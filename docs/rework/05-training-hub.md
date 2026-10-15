# 05 · Training Hub

> **Status: approved design, 2026-10-14 (D326, D328, D338).** The Observatory, Lineage Hall, Gym and Dojo: how a
> session works, which dish each unlock needs, the layer each scenario adds, the re-authored constellations, the
> Inspiration and Extra Stats maps, and facility slots and upgrades. Every number is a **draft** that the loop
> simulation ([12](12-economy-and-pacing.md) §12) tunes and then pins in tests.

The Training Hub is where an Uma's build is unlocked, one piece at a time. Every piece follows the same model (D326):
**one cooked dish pays for one timed unlock**. The four facilities differ only in what they unlock and which dish
family they take. Nothing here needs tokens, Constellation Level or a minigame, and racing is never blocked by it
(D328).

## 1. The four facilities

<!-- live:training-facilities -->
| Facility | Unlocks | Dish family | Rooms | Unlocks per Uma per tier |
|---|---|---|---|---|
| **Observatory** | Constellation card nodes | Vegetables | None | 28 |
| **Lineage Hall** | Inspiration: 2 parent slots, 4 grandparent slots, 6 inherited unique skills, 12 gold skills | Mushrooms | None | 24 |
| **Gym** | Extra Stats nodes | Fruits (Stamina), Herbs & Spices (Wit), Fish (Power), Sweets (Speed), Nuts & Seeds (Guts); Duos; Feasts | 5, one per stat: Stamina, Wit, Power, Speed, Guts | 37 |
| **Dojo** | Card bonds ([06](06-cards-and-bonds.md) owns the rules) | By card type: the five stat families, and Grains for Friend and Group | 6, one per card type: Speed, Stamina, Power, Guts, Wit, Friend & Group | 18 (a pacing assumption, not a cap) |
| **Tier** | | | | **107** |
<!-- /live -->

Each facility's slots per room, levels, speed and upgrades are §7's.

- **Observatory.** Opens the next card node of the Uma's constellation in breadth-first order (§4). It is the only
  place a node opens; there is no level-up sheet.
- **Lineage Hall.** Opens Inspiration slots, then the inherited unique skill and the natural gold skills of whoever
  fills them (§5). Choosing who fills a slot stays free and instant.
- **Gym.** One room per stat, in ring order: Stamina, Wit, Power, Speed, Guts. A room takes its own stat's single
  nodes, any Duo that includes its stat, and any Sun (§6). So the Power–Speed Duo can go in the Power room or the Speed
  room, and a Feast can go in any room.
- **Dojo.** One room per card type: Speed, Stamina, Power, Guts, Wit, and Friend & Group. A room takes bonds for its
  own card type only. What a bond is, its cost by era and how many to make are in [06](06-cards-and-bonds.md).

Dishes are named by [08](08-item-catalogue-and-recipes.md)'s ids: a family dish is uma-art's `dish-<family>-<grade>`
(`dish-vegetables-1` is Carrot Salad, `dish-vegetables-3` Cabbage Salad), a Duo `duo-<stat>-<stat>-<grade>`
(`duo-power-speed-3`) and a Feast `feast-<grade>`. [08](08-item-catalogue-and-recipes.md) owns the names and recipes.

## 2. Sessions

A **session** is one Uma at one facility slot, working through **1–10 unlocks one after another**. It is the Training
Hub's version of a Farm job ([07](07-farm.md)).

| Rule | Value |
|---|---|
| Unlocks in a session | 1–10, all at the same facility (and, at the Gym and Dojo, in the same room) |
| Dishes | **One exact dish per unlock** (family or kind, and grade), all of them **reserved when the session starts**. No substitutions: a higher-grade dish never pays for a lower-grade unlock |
| Time for one unlock of grade *g* | **180 + 15(*g*−1) minutes × *k*** (README; *k* = 1.2, D338), divided by the facility's speed |
| Order | The order shown on the sheet. An unlock may depend on an earlier one in the same session |
| Sessions per Uma | **One at a time.** While in a session she can race, but cannot take a Farm job (D328) |
| An Uma with Farm work | A **finished** job is collected in the same tap that starts her session ([07](07-farm.md)). A **running** job refuses the session until it is collected or recalled, with Recall on the sheet ([01](01-game-loop.md)) |
| Aptitudes | No effect: every Uma takes the same time |
| Speed Ticket | Takes 30 minutes off the session's remaining time ([09](09-racing-rewards-and-exchange.md)) |
| Recall | Pays every finished unlock, returns the dishes of every unfinished one (including the one in progress). Only time and any Speed Tickets spent are lost |

<!-- live:training-session-times -->
| Grade | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
|---|---|---|---|---|---|---|---|---|---|---|
| Base minutes, Lv 1–2 facility | 180 | 195 | 210 | 225 | 240 | 255 | 270 | 285 | 300 | 315 |
| Base minutes, Lv 3 facility (×1.25 speed) | 144 | 156 | 168 | 180 | 192 | 204 | 216 | 228 | 240 | 252 |
| Real minutes at *k* = 1.2, Lv 1–2 | 216 | 234 | 252 | 270 | 288 | 306 | 324 | 342 | 360 | 378 |
<!-- /live -->

The worked examples on these pages use the base minutes; the game multiplies every duration by *k*.

**Finishing.** Each unlock has its own finish time, computed from the session's start, the unlock times and any Speed
Tickets applied. Time runs offline. A finished unlock is **committed by Collect**: one operation with a receipt that
writes it into the Uma's unlocks ([13](13-removals-and-plan-changes.md) §6). Until then her build screens show a
**Collect** chip ("2 unlocks finished"), and starting a race collects her finished unlocks in the same tap
([01](01-game-loop.md)), so she never races without one she has earned. The unlock still in progress counts only once
it finishes. Collecting a finished session frees the slot and the Uma. Collect all, queues and Repeat are [02](02-check-ins-and-notifications.md)'s.

**Repeat** for a session starts a new one for the same Uma at the same facility and room, with the same number of
unlocks taken from the next ones in her unlock order, as far as the Warehouse covers their dishes. If it covers none,
Repeat skips that Uma and says why.

**Speed Tickets** act on the whole session timeline: each one moves every unfinished unlock's finish 30 minutes
earlier. The sheet offers **Finish now** for ⌈remaining ÷ 30⌉ tickets and says how many minutes the last ticket
wastes.

### Worked example: a night at the Observatory

Special Week is in scenario 1 with nodes 1–5 open. At the 22:30 check-in the session sheet suggests three nodes to fill
the night:

| Unlock | Grade | Dish | Minutes | Finishes |
|---|---|---|---|---|
| Node 6 | 1 | `dish-vegetables-1` Carrot Salad | 180 | 01:30 |
| Node 7 | 2 | `dish-vegetables-2` Potato Salad | 195 | 04:45 |
| Node 8 | 2 | `dish-vegetables-2` Potato Salad | 195 | 08:00 |

One Carrot Salad and two Potato Salads leave the Warehouse at 22:30. At the 08:00 check-in, Collect opens nodes 6–8.
If the owner had recalled her at 03:00 instead, node 6 would open and both Potato Salads would return. Had they
applied two Speed Tickets at 23:00, the three finishes would move to 00:30, 03:45 and 07:00.

## 3. Layers and grades

**Unlocks last for the Uma's whole tier**, and each scenario adds a **layer** (D328). The rules:

- **A layer opens when she enters its scenario.** She can unlock anything in her current layer or any earlier layer of
  her tier, never a later one. An Uma in scenario 2 who skipped node 11 can still open it; she cannot open node 17.
  A later layer shows its items locked with "Opens in scenario 3 · Trackblazer".
- **Each unlock has a fixed grade.** Scenario *s* of the tier uses grades **2*s*−1 and 2*s*** (README): roughly its
  first half at the lower grade and its second half at the higher. Farm Levels come fast (all ten grades open within
  about a month of a tier, [07](07-farm.md) §4), so the grade isn't waiting on Farm Level: it's the layer's rule, which
  makes each scenario ask for its own two grades and spreads demand over the Farm. Bonds are the one exception: their
  grade follows the card's era ([06](06-cards-and-bonds.md)).
- **The grade is the dish's grade**, and it decides the session time. A higher-grade dish never stands in for a lower
  one: each unlock names one dish.

### The layer table, per facility

<!-- live:training-layer-grades -->
| Scenario of the tier | Grades | Observatory | Lineage Hall | Gym | Dojo (pacing) | Total |
|---|---|---|---|---|---|---|
| 1 | 1–2 | 12 nodes: 6 at g1, 6 at g2 | 2 parent slots at g1, 2 parent uniques at g2 | 5 singles at g1 | 6 bonds | **27** |
| 2 | 3–4 | 4 nodes: 2 at g3, 2 at g4 | 4 parent golds at g3, 2 grandparent slots at g4 | 5 singles and 4 Duos at g3, 1 Sun at g4 | 3 bonds | **23** |
| 3 | 5–6 | 4 nodes: 2 at g5, 2 at g6 | 2 grandparent slots at g5, 2 grandparent uniques at g6 | 5 singles and 4 Duos at g5, 1 Sun at g6 | 3 bonds | **21** |
| 4 | 7–8 | 4 nodes: 2 at g7, 2 at g8 | 2 grandparent uniques and 1 grandparent gold at g7, 3 grandparent golds at g8 | 5 singles at g7, 1 Sun at g8 | 3 bonds | **19** |
| 5 | 9–10 | 4 nodes: 2 at g9, 2 at g10 | 2 grandparent golds at g9, 2 grandparent golds at g10 | 5 singles at g9, 1 Sun at g10 | 3 bonds | **17** |
| **Tier** | | **28** | **24** (6 slots, 6 uniques, 12 golds) | **37** (25 singles, 8 Duos, 4 Suns) | **18** | **107** |
<!-- /live -->

### Constellation nodes: grade per node

Nodes are numbered breadth-first from the root, `n1` … `n28` (the root `n0` is always open and always empty, as today).

<!-- live:training-node-grades -->
| Scenario | Nodes | Lower grade | Higher grade |
|---|---|---|---|
| 1 | n1–n12 | n1–n6 at **g1** (`dish-vegetables-1`) | n7–n12 at **g2** (`dish-vegetables-2`) |
| 2 | n13–n16 | n13–n14 at **g3** (`dish-vegetables-3`) | n15–n16 at **g4** (`dish-vegetables-4`) |
| 3 | n17–n20 | n17–n18 at **g5** (`dish-vegetables-5`) | n19–n20 at **g6** (`dish-vegetables-6`) |
| 4 | n21–n24 | n21–n22 at **g7** (`dish-vegetables-7`) | n23–n24 at **g8** (`dish-vegetables-8`) |
| 5 | n25–n28 | n25–n26 at **g9** (`dish-vegetables-9`) | n27–n28 at **g10** (`dish-vegetables-10`) |
<!-- /live -->

**Order:** strictly breadth-first. The next node is always the lowest-numbered locked one, so an Observatory session
is "the next *N* nodes". The tree grows outward and never strands a node, as today.

### Inspiration: grade per unlock

The two parents are **A** (left) and **B** (right). A's grandparents are **A1** and **A2**, B's are **B1** and **B2**.
Each slot has two natural-gold positions, **gold 1** and **gold 2**, in awakening-gold order (D250).

<!-- live:training-inspiration-grades -->
| Scenario | Lower grade | Higher grade |
|---|---|---|
| 1 | Slots A and B at **g1** (`dish-mushrooms-1`) | A's and B's uniques at **g2** (`dish-mushrooms-2`) |
| 2 | A gold 1, A gold 2, B gold 1, B gold 2 at **g3** (`dish-mushrooms-3`) | Slots A1 and B1 at **g4** (`dish-mushrooms-4`) |
| 3 | Slots A2 and B2 at **g5** (`dish-mushrooms-5`) | A1's and B1's uniques at **g6** (`dish-mushrooms-6`) |
| 4 | A2's and B2's uniques, A1 gold 1 at **g7** (`dish-mushrooms-7`) | B1 gold 1, A2 gold 1, B2 gold 1 at **g8** (`dish-mushrooms-8`) |
| 5 | A1 gold 2, B1 gold 2 at **g9** (`dish-mushrooms-9`) | A2 gold 2, B2 gold 2 at **g10** (`dish-mushrooms-10`) |
<!-- /live -->

That's **24 unlocks**: 6 slots, 6 inherited uniques (one per slot) and 12 gold positions (two per slot). The split
across scenarios (4, 6, 4, 6, 4) is the one that keeps every scenario at about the same time
([12](12-economy-and-pacing.md) §5).

**Order:**
- A grandparent slot needs its **parent's slot open** (D250). It need not be filled.
- A **unique** needs **its own slot open**, and so does a gold position. Neither needs the slot filled: the position pays the gold of whoever
  fills the slot, now or later. The sheet warns when the Uma in the slot has no such gold ("this parent has one
  natural gold; gold 2 pays nothing until a parent with two fills slot A").
- Gold 2 does not need gold 1, and B does not need A. Both sides grow at the same pace, so a single-side grandparent's
  2× SP price (D250) is rarely forced on the owner.

### Extra Stats: grade per node

<!-- live:training-extra-grades -->
| Scenario | Singles | Duos | Sun |
|---|---|---|---|
| 1 | Each stat at **g1** | — | — |
| 2 | Each stat at **g3** | Stamina–Wit, Wit–Power, Power–Speed, Speed–Guts at **g3** | Spring Feast (`feast-4`) at **g4** |
| 3 | Each stat at **g5** | Stamina–Wit, Wit–Power, Power–Speed, Speed–Guts at **g5** | Summer Feast (`feast-6`) at **g6** |
| 4 | Each stat at **g7** | — | Harvest Feast (`feast-8`) at **g8** |
| 5 | Each stat at **g9** | — | Grand Feast (`feast-10`) at **g10** |
<!-- /live -->

Each stat has **one single per scenario, at the scenario's first grade** (D338): half of the first draft's track, each
node twice as strong (§6).

A single takes its stat's family dish at that grade: Speed grade 3 takes `dish-sweets-3`. A Duo takes its pair's Duo
dish at its grade (`duo-stamina-wit-3`, `duo-wit-power-5` …); a Sun takes that grade's Feast (`feast-4` … `feast-10`).
So scenario 2's Gym layer is 9 unlocks at grade 3 (five singles, four Duos) and 1 at grade 4 (the Sun).

**Order:**
- **Singles open scenario by scenario per stat.** Speed grade 3 needs Speed grade 1. Each stat is a track of five,
  and a session in the Speed room is "the next *N* Speed nodes".
- **A Duo needs both its stats' singles of the same grade.** The Power–Speed Duo at grade 3 needs Power grade 3 and
  Speed grade 3.
- **A Sun needs its scenario's five singles.** The Spring Feast's Sun at grade 4 needs Speed, Stamina, Power, Guts
  and Wit grade 3.

Why Suns come last: a Sun is the most flexible node (+4 to every stat fits any build), so it caps a finished grade
rather than standing in for the stat choices; it gives the planner a clear "scenario 2's Gym complete" goal; and the five
singles it needs are in its own layer anyway, so it never waits on a later scenario. Why singles go in order: the
grade already follows the scenario, so the order costs nothing, and one "next node" per stat keeps the session sheet
and the planner simple (uma-rpg's D119 does the same).

### Bonds

A bond's grade comes from the card's era: a card first eligible in scenario *p* of the tier needs grade 2*p*−1
(older eras count as *p* = 1). So most bonds are grade 1, and only the newest cards cost more. The full table, the
dish family by card type and the counts are in [06](06-cards-and-bonds.md). [12](12-economy-and-pacing.md) §5 prices
every bond at its layer's lower grade, which is an upper bound.

## 4. Constellations re-authored

Each tier's trees are **re-authored to 12, 16, 20, 24 and 28 card nodes** for its scenarios 1–5. Every scenario keeps
its silhouette motif ([Scenarios](../design/scenarios.md#constellation-shapes)) and the drawing rules
([Constellations](../design/constellations.md#silhouettes)): nodes on an even grid, straight uncrossed edges, ids and
unlock order numbered breadth-first, at least 40 pt between node centres on a 375 pt phone. The old rule that pruned the
last six tips (the former Produce nodes) goes: a drawing has exactly its card count. The trees are static content in
`@racer/domain/rework/constellation` (D342), and the table and drawings below are rendered from it.

<!-- live:constellation-trees -->
| # | Scenario | Tier · scenario | Nodes | Per-card cap | How the motif adapts |
|---|---|---|---|---|---|
| 1 | URA Finale | 1 · 1 | 12 | 3 | The fern: a trunk of 6 from the root, one leaflet on alternating sides at each trunk node |
| 2 | Unity Cup | 1 · 2 | 16 | 4 | A stem of 1 and three long branches of 5 |
| 3 | Trackblazer | 1 · 3 | 20 | 5 | The track's two halves, 8 nodes each, climb from the root at the open foot; four short spurs point outward |
| 4 | Our Grand Concert | 1 · 4 | 24 | 5 | The five-arm star: four arms of 5 and a foot arm of 4, the stage |
| 5 | Grand Masters | 1 · 5 | 28 | 6 | A bar of 6 through the root, two arcs of 9 hanging from its ends, a pendant of 4 between them |
| 6 | Project L'Arc | 2 · 1 | 12 | 3 | The arch: a lintel of 2 either side of the keystone root, two legs of 4 |
| 7 | U.A.F. Ready GO! | 2 · 2 | 16 | 4 | A stem of 1, three branches of 3, each with two feathers |
| 8 | Great Food Festival | 2 · 3 | 20 | 5 | A short trunk of 2 under a canopy of six boughs of 3 |
| 9 | Run! Mecha Umamusume | 2 · 4 | 24 | 5 | A spine of 6 with six ribs of 3, three a side, their ends dropping |
| 10 | The Twinkle Legends | 2 · 5 | 28 | 6 | A band of 7 rooted below its centre, seven crown points of 3 |
| 11 | Design Your Island | 3 · 1 | 12 | 3 | Four spokes of 1 from the island root, each carrying a ring arc of 2; the ring stays open at the foot |
| 12 | Yukoma Hot Springs | 3 · 2 | 16 | 4 | The square spiral from the root, cut to its first 16 nodes (seven legs, about one and a half turns) |
| 13 | Beyond Dreams | 3 · 3 | 20 | 5 | Twin trunks of 10 from the root, their tips almost touching at the foot |
| 14 | Tracen Diner | 3 · 4 | 24 | 5 | A counter of 8 under the root, eight pendants alternating 1 and 3 long |
| 15 | Japan's 15th scenario | 3 · 5 | 28 | 6 | Drawn when it ships; until then [04](04-tiers-and-promotion.md) says what tier 3 does |
<!-- /live -->

Every drawing, as the code holds it (`R` the root, `o` a card node; ids are numbered from the drawing, so none is
written in it):

<!-- live:constellation-art -->
**1 · URA Finale** · 12 card nodes

```text
  R
  |
o-o
  |
  o-o
  |
o-o
  |
  o-o
  |
o-o
  |
  o-o
```

**2 · Unity Cup** · 16 card nodes

```text
      R
      |
      o
     /|\
    o o o
   /  |  \
  o   o   o
 /    |    \
o     o     o
|     |     |
o     o     o
|     |     |
o     o     o
```

**3 · Trackblazer** · 20 card nodes

```text
    o   o
   /     \
  o       o
  |       |
o-o       o-o
  |       |
  o       o
  |       |
  o       o
  |       |
o-o       o-o
  |       |
  o       o
   \     /
    o   o
     \ /
      R
```

**4 · Our Grand Concert** · 24 card nodes

```text
o           o
|           |
o           o
|           |
o-o       o-o
   \     /
    o   o
     \ /
      R
     /|\
    o o o
   /  |  \
o-o   o   o-o
|     |     |
o     o     o
|     |     |
o     o     o
```

**5 · Grand Masters** · 28 card nodes

```text
o-o-o-R-o-o-o
|     |     |
o     o     o
|     |     |
o     o     o
|     |     |
o     o     o
|     |     |
o     o     o
|           |
o           o
|           |
o           o
|           |
o           o
 \         /
  o-o   o-o
```

**6 · Project L'Arc** · 12 card nodes

```text
o-o-R-o-o
|       |
o       o
|       |
o       o
|       |
o       o
|       |
o       o
```

**7 · U.A.F. Ready GO!** · 16 card nodes

```text
      R
      |
  o---o---o
 /|   |   |\
o |   |   | o
  |   |   |
  o   o   o
  |\  |  /|
  | o | o |
  |   |   |
  o   o   o
     /|\
    o | o
      |
      o
```

**8 · Great Food Festival** · 20 card nodes

```text
    o   o
    |   |
  o o   o o
  | |   | |
o o o   o o o
| |  \ /  | |
o o---o---o o
|     |     |
o-----o-----o
      |
      R
```

**9 · Run! Mecha Umamusume** · 24 card nodes

```text
      R
      |
  o-o-o-o-o
 /    |    \
o     o     o
      |
  o-o-o-o-o
 /    |    \
o     o     o
      |
  o-o-o-o-o
 /    |    \
o     o     o
```

**10 · The Twinkle Legends** · 28 card nodes

```text
  o   o   o
  |   |   |
  o   o   o
  |   |   |
  o   o   o
  |   |   |
o | o | o | o
| | | | | | |
o | o | o | o
| | | | | | |
o | o | o | o
| | | | | | |
o-o-o-o-o-o-o
      |
      R
```

**11 · Design Your Island** · 12 card nodes

```text
o-o   o-o
|\     /|
o \   / o
   \ /
o---R---o
|       |
o       o
|       |
o       o
```

**12 · Yukoma Hot Springs** · 16 card nodes

```text
  o-o-o-o
  |     |
  o R-o o
  |   | |
  o-o-o o
        |
o-o-o-o-o
```

**13 · Beyond Dreams** · 20 card nodes

```text
  o-o   o-o
 /   \ /   \
o     R     o
|           |
o           o
|           |
o           o
|           |
o           o
 \         /
  o       o
  |       |
  o       o
   \     /
    o   o
    |   |
    o   o
```

**14 · Tracen Diner** · 24 card nodes

```text
      R
      |
o-o-o-o-o-o-o-o
| | | | | | | |
o o o o o o o o
  |   |   |   |
  o   o   o   o
  |   |   |   |
  o   o   o   o
```
<!-- /live -->

- **Per-card cap** stays `ceil(N / 6) + 1` (D134).
- **Node value** keeps today's cap-budget formula; [04](04-tiers-and-promotion.md) owns the computed table. The one
  change this page asks for is the Extra Stats term (§6).
- **What a node pays, skills per node, the invariance rule and card-type splits** are unchanged
  ([Constellations](../design/constellations.md#stat-budget)); every card is at full value now ([06](06-cards-and-bonds.md)).

**The drawing rules, checked.** The root is `n0` and the card nodes are `n1` … `n`*N*, numbered breadth-first from the
root with today's tie rule (nearer rows, then columns), so the number is the unlock order. A validator refuses, with a
reason naming the nodes, any tree that breaks a rule: one root `n0`; exactly *N* card nodes; ids `n1` … `n`*N*, each
`n` + its order; every node hanging from the root or a node that opens before it, which makes one tree and keeps every
prefix `n0` … `n`*k* connected; ids equal to a breadth-first walk of the tree's own edges; every node inside today's tree
box (x 2–98, y 2–74 of the 100-unit canvas); 40 pt between every pair of nodes once the canvas stretches to the
351 × 525 pt graph box of a 375 × 812 phone; and no crossing edges. That allows at most 8 node columns and 9 node rows, so
long runs bend: Trackblazer's halves, Grand Masters' arcs and Beyond Dreams' trunks. The tree carries no lineage band:
Inspiration is the Lineage Hall's own map (§5), so today's parent and grandparent checks leave the validator.

Two readings of the table's words are fixed by the drawing rules. **Project L'Arc's** lintel is two nodes either side of
the keystone root, since four a side would make 16 nodes. **Tracen Diner's** root sits above its counter of 8, as in
today's drawing, since a counter of 8 through the root is nine nodes in a row, 37 pt apart. The 15th's drawing is
authored with its own decision entry when the platform publishes it ([04](04-tiers-and-promotion.md) §2); its size (28)
and cap (6) are known now.

**Advancing a scenario.** Her opened count carries: with *k* nodes open she has the first *k* nodes of the new, larger
tree. Node ids are fixed by breadth-first order, so every card assignment stays on the same id, and a breadth-first
prefix of a tree is always connected, so nothing is stranded. Only the new layer's 4 nodes (plus any she skipped)
need unlocking. On screen the tree changes silhouette; the build does not change. One build per tier is
[03](03-uma-progression.md)'s.

**A newly opened node** joins all four presets and is filled as [03](03-uma-progression.md) §6 recommends: in each
preset it takes the set's card holding the fewest nodes under its cap (ties to the earlier card), or stays empty if
every card is at its cap. This page adopts that rule, so a finished session needs no visit to the constellation. The
owner can move it any time, free.

**Skill Points without Constellation Level.** Today 40% of the SP cap came from CL (`0.40 × spCap × CL / 10`). With CL
gone, that baseline follows the opened tree: **baseline SP = 0.40 × spCap(T) × opened nodes ÷ N**, where *N* is her
current scenario's tree size, as [03](03-uma-progression.md) §8 also states. A full tree earns the same 40% CL10 did; Friend and Group cards still pay the rest
([Constellations](../design/constellations.md#skill-point-cards)). Advancing lowers the fraction (12 of 16) until the
new layer opens, while the new scenario's higher SP cap softens it.

## 5. The Inspiration map

The pick rules stay exactly as D250 left them; only the **tokens are replaced by Lineage Hall sessions**.

- **Six slots:** parents A and B, each linked to two grandparents. Detached from the card tree, drawn as today: parents
  above, grandparents below, natural golds as moons beside each slot.
- **Who can fill a slot:** any Uma the account **has ever owned**, in any tier (D327). Tier 2 has only promoted Umas
  as runners, but every tier-1 Uma can still be a parent there. The Uma herself is never eligible.
- **Repeat rules (D250):** the parents are different characters; a grandparent cannot be either parent or repeat a
  character on its own side; the same exact grandparent outfit may mirror once across sides.
- **What a filled open slot pays:** her aptitudes and her baseline whites. Her **unique** comes, in its inherited form,
  only once that slot's unique is opened, and her natural golds only through opened gold positions. So a lineage is
  built in three steps: the slot, its unique, its two golds. A single-side grandparent's inherited unique and golds cost 2× SP; a mirror pays
  normal SP and counts twice for aptitudes.
- **Aptitudes** use today's formula: steps = filled A/S slots − 1, capped at A, S never granted.
- **Changing who fills a slot is free and instant** outside a race, and opened slots and gold positions stay open
  through any change.
- **The layer order** (§3): scenario 1 opens the parents and their uniques, scenario 2 the parents' golds and the
  first two grandparents, scenario 3 the last two grandparents and two grandparent uniques, scenario 4 the other two
  uniques and the first golds, and scenario 5 the last golds. So aptitudes start moving in scenario 1, and a full
  six-slot lineage arrives in scenario 3, when races start asking for B-or-better aptitudes in more places.

The Twinkle Legends' **Legends** buff (a slot may hold any Uma, owned or not) is [04](04-tiers-and-promotion.md)'s.

## 6. The Extra Stats map

One map per Uma per tier: **37 nodes**, fresh at each promotion (D338). Columns follow the ring, so every Duo joins
two neighbouring columns and Guts–Stamina, the ends, has none:

```
scenario  grade   Stamina      Wit        Power      Speed      Guts       Sun
   1        1        o          o           o          o          o
   2        3        o ── D ─── o ── D ──── o ── D ─── o ── D ─── o
            4                                                             Spring Feast
   3        5        o ── D ─── o ── D ──── o ── D ─── o ── D ─── o
            6                                                             Summer Feast
   4        7        o          o           o          o          o
            8                                                             Harvest Feast
   5        9        o          o           o          o          o
           10                                                             Grand Feast
```

<!-- live:training-extra-nodes -->
| Node | Count | Pays at tier 1 | Tier 2 (×1.25) | Tier 3 (×1.5) |
|---|---|---|---|---|
| Single | 25 (5 stats × one per scenario, grades 1, 3, 5, 7, 9) | +40 to its stat | +50 | +60 |
| Duo | 8 (4 pairs × grades 3 and 5) | +20 to each of its two stats | +25 each | +30 each |
| Sun | 4 (Feasts at grades 4, 6, 8, 10) | +8 to all five stats | +10 | +12 |
<!-- /live -->

Every node pays **40 raw points at tier 1** whichever kind it is, so a Sun is flexible, not stronger. The derivation adds
exact values and rounds once at the end, as D314 does, and adds them **flat after growth**, so "+40 Speed" on the node
is +40 on the profile.

**Why half as many, twice as strong (D338).** In the first draft Extra Stats were 47% of all unlocks, each costing a
whole dish and session for +20 to one stat, while an Observatory node pays a card node: about 130–280 raw points. Half
the owner's sessions would have felt like the least rewarding half. Halving the singles and doubling every node keeps
the Extra Stats a build can have (the budget below is unchanged), makes each Gym session worth twice as much, and cuts
a tier from 132 unlocks to 107. The time factor *k* = 1.2 keeps each scenario at about four weeks.

**Active capacity** limits how many opened nodes pay at once:

<!-- live:training-extra-capacity -->
| Scenario of the tier | 1 | 2 | 3 | 4 | 5 |
|---|---|---|---|---|---|
| Nodes the layers so far hold | 5 | 15 | 25 | 31 | 37 |
| Active capacity (README) | 7 | 9 | 11 | 13 | 15 |
| Nodes that can pay | 5 | 9 | 11 | 13 | 15 |
<!-- /live -->

- **Active nodes belong to each distance preset** ([03](03-uma-progression.md)): Sprint can lean Speed while Long leans
  Stamina. Switching is free and instant outside a race. A race reads the preset of its distance (D254).
- **A newly opened node turns on in every preset with free capacity**, so in scenario 1 everything is on and nothing
  needs choosing. Choice starts in scenario 2, when 15 nodes compete for 9 places. When an advance raises the
  capacity, the new places fill with opened nodes that were off, oldest first ([03](03-uma-progression.md) §6).
- **No per-stat limit** beyond the map itself. D235's "four per stat" goes: at tier 1, scenario 5, a full Speed lean is
  5 singles, 4 Duos and 4 Suns, +312 Speed from 13 of 15 places. The cap profile clamps, and the stamina ladder
  ([Constellations](../design/constellations.md#balance-targets-the-stamina-ladder)) is re-measured with it (§12).

### The stat formula: the 240-point pool goes

**Recommendation for [04](04-tiers-and-promotion.md):** today's fixed 240-point Extra pool leaves the node-value
formula. In its place goes the Extra Stats an Uma can have paying in that scenario:

```
extraBudget(t, s) = nodesThatCanPay(s) × 40 × tierMultiplier(t)          (the table above × 1, 1.25 or 1.5)
nodeValue(t, s)   = round((0.60 × capBudget − extraBudget(t, s)) / cardNodes(s))
```

<!-- live:tier-extra-budget -->
| Scenario of the tier | 1 | 2 | 3 | 4 | 5 |
|---|---|---|---|---|---|
| Tier 1 | 200 | 360 | 440 | 520 | 600 |
| Tier 2 | 250 | 450 | 550 | 650 | 750 |
| Tier 3 | 300 | 540 | 660 | 780 | 900 |
<!-- /live -->

Why:
- **One ceiling.** A finished build stays at 60% of the cap budget, so no build reaches every cap, rivals and sims
  have one number, and the cap only bites on a deliberate lean.
- **The invariance rule extends to Extra Stats.** Every active node pays the same total, so the total depends on how
  many nodes are on, never which.
- **D314's reason no longer applies.** It protected card values from a Farm that sat outside training. Now both are
  sessions in one loop, and cards already pay their full value (D329), more than today's typical set.

### Compared with today's map and uma-rpg's

| | Today's Farm Extra map (D314, D315) | uma-rpg's Sun and planets | **This map** |
|---|---|---|---|
| Nodes | 65 per five-scenario block: 50 singles, 10 bridges (every pair), 5 Suns | 100 per tier: 80 moons (8 stats × 10), 16 bridges (8 × grades 3, 7), 4 Suns | **37 per tier**: 25 singles, 8 Duos (4 ring pairs × grades 3, 5), 4 Suns |
| Order | Any node first | In order per track (D119) | In order per stat; Duos after both singles; Suns after their scenario's five |
| Paid by | One meal, instant, permanent | Eating a dish, instant | **One dish and a Gym session** |
| Capacity | 18 + 2 per scenario, absolute (18–46) | 5 + ⌊Uma Level ÷ 2⌋ | **7–15 by scenario of the tier**, values scaled by tier |
| Value | 20 a node, flat after growth | 1 point a moon | 40 a node at tier 1, ×1.25, ×1.5 |

What changed and why:
- **Ten bridges become four Duo pairs at two grades.** uma-art's Duo dishes join ring neighbours only, and the five
  stats sit next to each other on the ring, so four pairs have art (README).
- **Five Suns become four,** one per Feast grade, as in uma-rpg.
- **"Any node first" becomes scenario order,** because grade now tracks the scenario; a free order would let a grade-1
  dish open any node and break the layer.
- **Fifty singles become twenty-five, each twice as strong** (D338), so a Gym session is worth an Observatory one.
- **Capacity restarts each tier,** because the map does; the tier multiplier carries the growth that today's absolute
  capacity carried.
- **uma-rpg's eight stats become racing's five.** Its three other families go to the Observatory, the Lineage Hall and
  Friend and Group bonds.

## 7. Slots and upgrades

**Demand.** The loop simulation's baseline (T132, D348; [12](12-economy-and-pacing.md) §12) measures each facility's
slot time over tier 1: a slot is held from a session's start until Collect, so the hours count the wait for the next
check-in too. Slots needed = hours ÷ (24 × 0.75), as in [12](12-economy-and-pacing.md) §7, and each use is the slot time
held over a tier-1 scenario's window:

<!-- live:loop-hub-slots -->
| Building | Slots Lv 1 / 2 / 3 | Hours a day held, tier 1 | Slots needed (÷ 18) | Use in 1·1 | Use in 1·2 | Use in 1·3 | Use in 1·4 | Use in 1·5 | Peak, all tiers |
|---|---|---|---|---|---|---|---|---|---|
| Observatory | 2 / 3 / 3 | 29.1 | 1.6 | 62% | 44% | 35% | 31% | 48% | 76% (3·1) |
| Lineage Hall | 2 / 3 / 3 | 26.3 | 1.5 | 26% | 48% | 38% | 48% | 48% | 54% (2·2) |
| Gym | 5 rooms × 1 / 2 / 2 | 45.6 | 2.5 | 13% | 24% | 30% | 20% | 20% | 31% (3·3) |
| Dojo | 6 rooms × 1 / 2 / 2 | 25.4 | 1.4 | 13% | 12% | 9% | 9% | 8% | 17% (2·1) |
<!-- /live -->

- **Lv 1 carries the 20-Uma start and Lv 2 carries 25**, the same rule as the Farm's buildings ([07](07-farm.md) §6).
  The sim's account buys every facility's Lv 2 around day 31, as the first careers pay.
- **The Observatory is the busiest facility in scenario 1**, which is front-loaded with 12 nodes while the whole
  roster is in scenario 1 together; after that it runs under half full. The founding cohort is promoted within a few
  days of itself, so each tier's first scenario brings the peak back, at about three-quarters of its slots.
- **The Lineage Hall** peaks in the scenarios with six Inspiration unlocks (D336), at about half its slots.
- **The Gym's rooms** carry about a third of their time even at their busiest: each room takes its own stat's single,
  either room of a Duo and any room for a Sun, so the load spreads.
- **The Dojo's rooms** are almost idle. Six rooms exist for theme and so that several Umas bond at once at the start of
  a tier, when everyone needs six bonds.

**Upgrades** follow uma-rpg's facility upgrades and [07](07-farm.md) §7's pattern: Lv 1–3, one more slot per room at Lv 2,
speed ×1.25 at Lv 3, paid in Prize Money and crafted items of the facility's families. Prices follow the anchor
(1 Prize Money ≈ 1 Uma-minute, D331). Lv 3 saves a fifth of the facility's session time, about 274 PM a day at the
Observatory, 252 at the Lineage Hall, 377 at the Gym and 176 at the Dojo, so it repays in **6–13 days**.

<!-- live:facility-slots-upgrades -->
| Facility | Lv 1 | Lv 2 | Lv 3 | To Lv 2 | To Lv 3 |
|---|---|---|---|---|---|
| Observatory | 2 slots | 3 slots | 3 slots, speed ×1.25 | 1,200 PM + 4 Vegetables crafted, grade 1 | 2,400 PM + 4 Vegetables crafted, grade 3 |
| Lineage Hall | 2 slots | 3 slots | 3 slots, speed ×1.25 | 1,000 PM + 4 Mushrooms crafted, grade 1 | 1,500 PM + 4 Mushrooms crafted, grade 3 |
| Gym | 5 rooms × 1 | 5 rooms × 2 | 5 × 2, speed ×1.25 | 2,400 PM + 1 crafted of each stat family, grade 1 | 4,800 PM + 2 crafted of each stat family, grade 3 |
| Dojo | 6 rooms × 1 | 6 rooms × 2 | 6 × 2, speed ×1.25 | 1,500 PM + 1 crafted of each of its six families, grade 1 | 2,000 PM + 1 crafted of each of its six families, grade 3 |
| **All four** | | | | **6,100 PM** | **10,700 PM** |
<!-- /live -->

- An upgrade is **instant** and applies to the whole facility. New slots appear at once. A speed upgrade applies to
  sessions started after it; running sessions keep their finish times, so a timeline never moves under the owner.
- Facilities are account buildings: they **carry at promotion** (D327) and serve every tier's Umas together.
- Lv 2 can be bought as soon as the Prize Money is there (grade-1 items); Lv 3 once someone reaches Farm Lv 11
  (grade 3, about day 4–6 of a tier, [07](07-farm.md) §7), as at the Farm.
- **Lv 3 keeps ×1.25 session speed**, the same rule as every Farm building. Sessions are about 20% of the roster's
  time ([12](12-economy-and-pacing.md) §3), so all four facilities at Lv 3 shorten a scenario by about 4%, roughly one
  day, on top of the Farm's Lv 3 ([07](07-farm.md) §7). That compounding is small, and it lands where it helps most:
  an Uma's own sessions are the one part of her layer nobody else can do for her, so they set how fast a late or newly
  bought Uma catches up ([01](01-game-loop.md)). The sim reports it; if later scenarios fall below
  [12](12-economy-and-pacing.md)'s floor, the time factor moves, not this rule.
- All eight upgrades cost 16,800 PM, about nine days of the target's racing ([12](12-economy-and-pacing.md) §3).

## 8. Screens

The Training page of the Hub holds the four facilities as places ([11](11-hub-and-places.md)).

**A facility's place page:**
- **Header:** name, level, slots in use ("2 / 3"), and **Upgrade** with its price and what it adds.
- **Slots** (the Gym and Dojo group them by room, each room with its stat or type icon): an empty slot shows **Start a
  session**. A busy one shows the Uma's bust, the current unlock ("Node 7 · `dish-vegetables-2`"), progress through the
  session ("2 of 3"), the next finish and the session's end as clock times, and **Speed up** and **Recall**. A finished
  one shows **Collect**.
- **Needs here:** from the planner ([02](02-check-ins-and-notifications.md)), each target Uma's remaining unlocks at
  this facility with the dish each needs and the Warehouse stock ("Special Week · 3 nodes · 2 `dish-vegetables-2` in stock,
  1 short"). A short dish links to its Kitchen recipe.

**The session sheet** (one sheet, opened from a slot, a locked item, the planner or a card's Bond button):
1. **Pick the Uma.** The Uma picker, filtered to Umas free of a job or session, each showing what she still needs here.
   A busy Uma is listed as "Busy until 14:20" and offers **Queue** where [02](02-check-ins-and-notifications.md)'s
   queues allow it.
2. **Pick unlocks.** Her unlockable items here, in unlock order, each with its dish, stock and minutes. Items that wait
   on another unlock name it ("needs Speed grade 1 first"). Items with no dish in stock are greyed with "0 in Warehouse
   · Cook". The sheet pre-selects as many as fit before the next check-in ([02](02-check-ins-and-notifications.md)).
3. **Confirm.** The dishes to be reserved, total minutes and each finish time, then **Start**.

**The Uma's build screens** (the Constellation, Inspiration and Extra Stats views of today's Training scene) show every
locked item with what it needs, for example:

| Item | Label |
|---|---|
| Next node | "Needs: `dish-vegetables-3` (Cabbage Salad) at the Observatory · 2 in stock" and an **Unlock** button that opens the session sheet with her and that node chosen |
| A node further on | "Opens after node 14" |
| A later layer | "Opens in scenario 3 · Trackblazer" |
| Inspiration slot B1 | "Needs: `dish-mushrooms-5` (Chanterelle Soup) at the Lineage Hall · slot B open" |
| Extra Stats Power–Speed Duo, grade 3 | "Needs: `duo-power-speed-3` at the Gym · Power grade 3 and Speed grade 3 first" |
| An item in a running session | "In session · opens 04:45" |
| A finished, uncollected item | "Finished · Collect" |

A locked item is never a dead end: it says what it needs and links to the step that gets it.

## 9. What is saved

| Where ([13](13-removals-and-plan-changes.md) §6) | What |
|---|---|
| `umas/{outfitId}` unlocks | `constellationOpened` (0–28: the count, since order is fixed); Inspiration `slots` (up to six ids), `uniques` (up to six slot ids, D336) and `golds` (up to twelve keys, `<slot>:gold0` for gold 1 and `<slot>:gold1` for gold 2, today's `inspirationGoldKey`); Extra Stats `nodes` (ids such as `speed-03`, `duo-power-speed-3`, `sun-4`); `active` Extra ids per preset; bonds ([06](06-cards-and-bonds.md)) |
| `work/{outfitId}` | Her session: facility, room, slot, start time, the ordered unlocks (kind, target id, grade, dish id, minutes), reserved dish ids, Speed Ticket minutes applied, the facility speed it started at |
| `buildings/{id}` | Each facility's level |
| `itemLedger` | Reserve and return rows for every dish, keyed by the session's operation id (the unlock itself is no item) |

Operations: `start`, `queue`, `collect`, `collect-all`, `repeat`, `recall`, `speed-up` and `set-active-nodes`, plus a
facility `upgrade`. Each is checked by the domain on the API and returns its first receipt on a retry.

## 10. Edge cases

- **Offline.** Sessions run from their start times. Opening the app later shows them finished, ready to collect.
- **A stale screen.** Start re-checks everything: the Uma is free, the slot is free, each unlock is still locked and
  allowed, each dish is in stock. If anything changed, the sheet reloads and says what; it never substitutes another
  unlock or dish.
- **Two devices.** Both see the same `work` entity; the second Start for the same slot or Uma gets a refusal naming the
  running session.
- **A 0-stock Warehouse.** The session sheet still opens and lists everything, greyed with "0 in Warehouse · Cook".
  Start stays disabled until at least one chosen unlock has its dish.
- **Advancing a scenario mid-session.** The session runs on. Its unlocks belong to earlier layers, which stay open.
- **Promotion mid-session.** Promotion needs her free ([04](04-tiers-and-promotion.md) §5), so the Promote sheet
  offers Recall (naming the dishes that return to the Warehouse, which carries) or Speed Tickets. Her unlocks then
  reset at promotion.
- **An Uma bought mid-tier** starts at scenario 1 of tier 1 with empty layers. Higher-grade dishes in the Warehouse
  wait for her later layers; her first ones need grades 1–2.
- **A lineage slot emptied during a gold session.** The gold position still opens; it pays when the slot is filled
  again.
- **A dish reserved by a session** is not stock: it cannot be sold or used elsewhere until a recall returns it.

## 11. Decided here

| Choice | Why |
|---|---|
| A session holds 1–10 unlocks of one facility (one room at the Gym and Dojo) | Mirrors a Farm job; one facility per session keeps the slot model simple |
| Finished unlocks commit on Collect, with a Collect chip on build screens and the pre-race sheet | One receipted operation per change ([13](13-removals-and-plan-changes.md)); a race never depends on the clock at the second |
| Repeat takes the next *N* unlocks at the same facility and room | "Restart everything" means the same as for Farm jobs |
| No aptitude effect on session time | Keeps sessions predictable; aptitudes already matter in races |
| Unlocks of a later layer cannot be done ahead | The layer is the pacing unit (D328); grades and node values are sized per scenario |
| Each layer splits half at grade 2*s*−1, half at 2*s*, with the grade per unlock fixed in §3's tables | Follows Farm Level ([12](12-economy-and-pacing.md) §6) |
| Inspiration order: A then B; parent golds; A1, B1 then A2, B2; grandparents' gold 1 in s4, gold 2 in s5 | Both sides grow together, so the 2× single-side price is rarely forced |
| A gold position needs its slot open, not filled | A session takes hours; refilling a slot must never waste it |
| Gym rooms: own stat's singles, Duos with its stat, any Sun | Five rooms by stat, without stranding Duos and Feasts |
| Duos need both same-grade singles; Suns need their scenario's five | Suns cap a finished scenario's Gym; the planner gets a clear goal |
| Half the singles at twice the value (D338) | Every Gym session is worth one at the Observatory; 107 unlocks a tier |
| A new Extra node turns on in every preset with room; no per-stat limit | No chores in scenario 1; the map itself bounds a lean |
| **The 240-point Extra pool is replaced by extraBudget** (§6) | One ceiling at 60% of the cap budget; [04](04-tiers-and-promotion.md) computes node values with it |
| Baseline SP = 0.40 × spCap × opened nodes ÷ *N* | Replaces CL's 40% with the thing CL used to open |
| Lv 1: Observatory 2, Lineage Hall 2, Gym 5 × 1, Dojo 6 × 1; Lv 2 adds a slot per room | Lv 1 carries 20 Umas, Lv 2 carries 25, as at the Farm; only the Observatory needs its Lv 2 for 25 (scenario 1 at 105%) |
| Upgrades Lv 2 (+slots, grade-1 items) and Lv 3 (×1.25 session speed, grade-3 items), instant, priced in §7 | uma-rpg's and [07](07-farm.md)'s pattern; Lv 3 repays in 6–13 days and shortens a scenario by ~4%, mostly helping late Umas |
| Each unlock names one exact dish id; no substitutions; a finished Farm job is collected when her session starts | Agrees with [07](07-farm.md) and [08](08-item-catalogue-and-recipes.md) |
| A running session must be recalled or finished before promotion ([04](04-tiers-and-promotion.md) §5) | Dishes carry; unlocks don't |
| Constellation motifs adapted as in §4's table: fourteen drawings now, every size and cap for fifteen; the 15th drawn when it ships, with its own decision entry | Keeps each scenario recognisable at its new size; the 15th's motif isn't known until it ships |
| Tree ids: the root `n0`, card nodes `n1` … `n`*N*, as §3 and [03](03-uma-progression.md) §6 write them | The number is the unlock order. Today's trees name the root `root` and number cards from `n0`; generation 2 starts empty, so no save maps between the two |
| Project L'Arc's lintel is two nodes either side of the keystone root | Four a side would make 16 nodes, not 12 |
| Tracen Diner's root sits above its counter of 8, as today | A counter of 8 through the root is nine nodes in a row, 37 pt apart; the 40 pt rule wins over the wording |
| No lineage band on the tree; today's tree box and the 351 × 525 pt graph box stay | Inspiration is the Lineage Hall's own map (§5); the 40 pt results compare with today's |
| The breadth-first walk and placement, fair share and the per-card cap are restated by drawing and by *N* in `rework/constellation`, each proven equal to today's by a parity test; the parser, tree box, card set size and shape ids are imported | Today's builder reads today's drawings and prunes six tips, and today's cap reads today's sizes by scenario (M033: reuse, don't copy) |
| Tree sizes and the per-card cap live in the leaf `rework/constellation/sizes.ts` | Tier rules need them before the Training Hub's module exists; it re-exports `perCardCap` rather than restating it |
| "[Scenario] Fully Trained" now means every unlock of that layer done (bonds counted at 6, 9, 12, 15, 18) | CL10 no longer exists; it matches [12](12-economy-and-pacing.md)'s "max a scenario" |
| **Sessions run on the Farm's work engine** ([07](07-farm.md) §2, T127): per-unlock timers, Collect (also part-way), Recall, queues of up to 3 at the same facility and room, and Speed Tickets, with ticket time clamped to the time remaining | One engine for every timed thing an Uma does; a Finish ends exactly when it's used, so nothing starts in the past |
| **A queued session takes the facility's speed and its dishes when it starts**, and is checked when it's added, counting her earlier entries as made | §7 applies speed to sessions started after an upgrade; an unlock may depend on one queued ahead of it |
| **Ties between queued starts go by [07](07-farm.md) §1's buildings, then the Observatory, Lineage Hall, Gym and Dojo, then room and slot** | [07](07-farm.md) §2 orders only the Farm buildings, but sessions queue too |
| **Collect never refuses, and Recall with nothing running acts as Collect** | [02](02-check-ins-and-notifications.md) §9: an action already done shows its result |
| The Training Hub's rules own [04](04-tiers-and-promotion.md) §8's reviewed buffs (D344) | They apply only in the derivation; rivals' typical values stay with the tier rules until the builds are re-measured against the field |
| Facility slots, levels, speed and prices are the Farm's buildings' (`rework/farm`); node value, E and Extra Stats values per tier are the tier rules' (D344) | One owner per number |
| Canonical unlock order: the Observatory by node; the Lineage Hall as §3's table; a Gym room by layer, grade, single, Duos in ring order, then the Sun; the Dojo has none, since a bond names its card (D344) | Repeat and the planner need a "next *N*"; a bond needs a chosen card ([02](02-check-ins-and-notifications.md) §6) |
| "Next *N*" passes over an item still waiting on something, so a Gym room's next may skip a Duo or Sun for its stat's next single (D344) | The room still gives a full session; the skipped item opens once its singles are done |
| Her work ahead of an unlock meets its dependency: every unlock of her started entries, made or not, and of her queued sessions ahead of it (D344) | A queued entry starts when the one before ends, finished but uncollected |
| A later layer refuses with "Opens in scenario *s* · *Name*", checked before what an unlock waits on; a bond's card past her scenario refuses the same way (D344) | The locked item names what opens it; one sentence for both |
| Reuse today's slot ids and gold keys (`parent0` … `parent1-gp1`; gold 1 is `inspirationGoldKey(slot, 0)`) (D344) | One id scheme with `lineage.ts` and `inspiration.ts`; §9's `slot:gold1/2` meant the same two positions |
| Inspiration lists stay in slot order; Extra Stats nodes stay in opening order (D344) | Opening order is what "oldest first" reads when an advance raises the capacity; slot order is today's |
| A session request names its unlocks only; its slot names the facility and room. One facility (`mixed-facility`), the slot's facility (`not-here`), and a room that takes every unlock (`wrong-room`) (D344) | The engine's slot already says where; a Duo may go in either of its rooms and a Sun in any |
| A session earns no Farm EXP; its seconds are `workSeconds(180 + 15(g − 1), speed)` at the facility's speed when it starts (D344) | Farm EXP is for Farm work (D336); speed is frozen into the entry as for jobs |
| Collect commits finished unlocks in order, and the collect receipt's `paid` lists every opening and newly bonded card (D344) | One receipted write; "ever bonded" is recorded from it ([06](06-cards-and-bonds.md) §7) |
| A new node joins every preset with the set's card holding the fewest nodes under its cap, ties to the earlier slot, or stays empty; a new Extra Stats node turns on in every preset with room (D344) | [03](03-uma-progression.md) §6's rule; no visit to the constellation after a session |
| `advanceScenario` is the tier rules' advance followed by the carry: sets, assignments, lineage and loadouts stay; raised capacity fills with opened nodes that were off, oldest first (D344) | The tier rules land first and can't import the Training Hub's |
| `layerDone(s)` is layer *s*'s fixed unlocks open and bonds at the pacing count by its end (6, 9, 12, 15, 18) (D344) | "Fully Trained" for that scenario; earlier layers' Duos, Suns and golds don't block it |
| The derivation counts cards that are in the set, bonded and of an era her scenario allows; anything else pays nothing (D344) | Pure and total, as today's `deriveStats`: a stale id never breaks a read |
| Team Spirit counts the filled open slots whose pick passes D250's repeat rules (D344) | The same slots that pay aptitudes |
| The stamina ladder runs full-layer builds whose active Extra Stats lean on the rung's stat, most first, then on its backup (Guts behind Stamina, Power behind Speed), up to the capacity (D349) | Today's six leaned four and two; the capacity takes every opened node that pays the stat before any other |

## 12. Done when

- The domain defines the four facilities, the layer tables in §3 and the unlock-order rules, and tests pin every
  unlock's grade, its dish and its dependencies.
- A session of *N* unlocks reserves *N* dishes at Start, finishes each at (180 + 15(*g*−1)) × *k* minutes ÷ facility speed in
  order, and Collect commits exactly the finished ones. Recall returns the rest. A retried operation returns its first
  receipt.
- An Uma in a session can start a race and cannot start a Farm job.
- An Uma cannot unlock an item of a later layer; the locked item says which scenario opens it.
- All 15 constellation templates (14 until the 15th ships) validate at 12/16/20/24/28 nodes with breadth-first ids, one
  tree, no crossings and 40 pt spacing; advancing keeps every assignment on its node id.
- The Extra Stats map has 37 nodes per tier, pays 40 a node at tier 1 (×1.25, ×1.5), respects 7/9/11/13/15 per preset,
  and `deriveStats` uses extraBudget in place of the 240 pool.
- The Observatory, Lineage Hall, Gym and Dojo start at 2, 2, 5 × 1 and 6 × 1 slots; upgrades charge §7's prices once
  and survive promotion.
- `pnpm sim:loop` reports every facility's average slot use at or below 90% in every scenario, including scenario 1 of
  a fresh account once the roster passes 20 and the Observatory is at Lv 2.
- Every locked item on the build screens names its dish, facility and blocker, and its Unlock button opens the session
  sheet pre-filled.
- `pnpm sim:rework-builds`' stamina ladder holds at every T on the re-authored trees with these Extra Stats, each rung
  as today's ladder defines it ([Constellations](../design/constellations.md#balance-targets-the-stamina-ladder)),
  and the command exits 0.

**The ladder, measured** (T133, D349). 30 races a check in 12-runner G1 fields at pace and late, on full-layer builds:
every card node open with current-era cards at 100%, the median Uma's base stats and no growth, Extra Stats at the
scenario's capacity leaning on the rung's stat. The rungs add a stamina source each, as today's: no stamina card, a
stamina card, Extra Stats on Stamina, the stamina card leaned a node, a Power card beside the lean, a second stamina card.

<!-- live:rework-ladder -->
| T | Scenario | Stamina, rung by rung | Hard checks | Soft checks that miss |
|---|---|---|---|---|
| 1 | URA Finale | 165 · 561 · 561 · 759 · 1,014 · 1,200 | **Accepted (D350):** Extra Stats into stamina run 1,800 m; **Accepted (D350):** a Power card runs 2,400 m | a lean alone runs 2,200 m |
| 2 | Unity Cup | 213 · 616 · 676 · 830 · 1,095 · 1,300 | hold | a lean alone runs 2,200 m; a Power card cannot run 3,000 m |
| 3 | Trackblazer | 281 · 625 · 785 · 911 · 1,181 · 1,300 | hold | a Power card cannot run 3,000 m |
| 4 | Our Grand Concert | 329 · 541 · 741 · 844 · 1,064 · 1,300 | hold | a lean alone runs 2,200 m |
| 5 | Grand Masters | 377 · 589 · 829 · 919 · 1,151 · 1,350 | hold | no stamina card cannot run 1,400 m; a Power card cannot run 3,000 m |
| 6 | Project L'Arc | 155 · 658 · 658 · 909 · 1,232 · 1,450 | **Accepted (D350):** Extra Stats into stamina run 1,800 m | a lean alone runs 2,200 m; a Power card cannot run 3,000 m |
| 7 | U.A.F. Ready GO! | 240 · 696 · 771 · 948 · 1,252 · 1,450 | hold | a sprint set cannot run 1,800 m; a Power card cannot run 3,000 m |
| 8 | Great Food Festival | 325 · 699 · 899 · 1,114 · 1,450 · 1,450 | hold | a sprint set cannot run 1,800 m; a lean alone cannot run 2,400 m; a Power card cannot run 3,000 m |
| 9 | Run! Mecha Umamusume | 385 · 619 · 869 · 991 · 1,276 · 1,500 | hold | no stamina card cannot run 1,400 m; a Power card cannot run 3,000 m |
| 10 | The Twinkle Legends | 445 · 670 · 970 · 1,075 · 1,345 · 1,600 | hold | no stamina card cannot run 1,400 m; a lean alone cannot run 2,400 m; a Power card cannot run 3,000 m |
| 11 | Design Your Island | 165 · 770 · 770 · 1,005 · 1,365 · 1,600 | hold | a sprint set cannot run 1,800 m; a Power card cannot run 3,000 m |
| 12 | Yukoma Hot Springs | 267 · 856 · 946 · 1,173 · 1,525 · 1,600 | hold | a sprint set cannot run 1,800 m; a lean alone cannot run 2,400 m; a Power card cannot run 3,000 m |
| 13 | Beyond Dreams | 369 · 793 · 1,033 · 1,199 · 1,554 · 1,650 | hold | no stamina card cannot run 1,400 m; a sprint set cannot run 1,800 m; a lean alone cannot run 2,400 m; a Power card cannot run 3,000 m |
| 14 | Tracen Diner | 481 · 738 · 1,038 · 1,177 · 1,476 · 1,750 | hold | no stamina card cannot run 1,400 m; a sprint set cannot run 1,800 m; a lean alone cannot run 2,400 m; a Power card cannot run 3,000 m |
<!-- /live -->

A tier's first Gym layer holds one single per stat, so its Extra Stats can't lean. At T = 1 and 6 the mile set is
therefore the sprint set and misses 1,800 m, and at T = 1 the Power card set misses 2,400 m: today's carried 240 Stamina
and 120 Guts from its Extra stats, the rework's first layer 60 of each. Design Your Island's fatter nodes hold. The
three are **accepted as the ladder's shape in a tier's first scenario** (D350): there a miler leans her stamina card
one more node, which runs 1,800 m in 30 of 30 races at T = 1 and 6, and at URA Finale a 2,400 m race takes the long set
(30 of 30). No rule changes. The sim reports the three as accepted and fails on any other miss.
