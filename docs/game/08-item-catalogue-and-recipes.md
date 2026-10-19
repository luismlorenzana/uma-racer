# 08 · Item catalogue and recipes

> **Status: as built, phase 3 (generation 2, D361); first written 2026-10-13 (D326, D330, D331); meals and tonics
> since D375 (2026-10-18).** The catalogue, recipes, grade gate, step times and work values are the rules in
> `@racer/domain/items` (T126, D341), and the tables marked live are rendered from them. The loop simulation ([12](12-economy-and-pacing.md) §12) checks demand per family
> and per building, and its checks pin the recipes, times and side rotation.

Every item the Farm makes, every recipe, and where each meal and tonic goes. The catalogue is **uma-rpg's farming
half** (D330): its eight farming families, ten grades each, raw and crafted, and its dishes, with uma-art's icons and
names, plus this game's own tonics. uma-rpg's gathering half, gear and the Forge are not used. How jobs, timers and
Farm Level work is in [07](07-farm.md).

**The two Kitchen lines (D375).** As in uma-rpg, raw items become crafted ones, and crafted ones become either
consumables for stats or consumables for the rest of the build:
- **Meals** feed Extra Stats only: the five stat families' planet dishes, the Duos and the Feasts (§4–§4.4).
- **Tonics** feed constellation nodes and Inspiration slots: one crafted Vegetables, Mushrooms and Grains item at the
  grade (§4.5).
- **Nothing** is taken by a card bond, an inherited unique or a gold skill: those sessions are time only
  ([05](05-training-hub.md) §2, [06](06-cards-and-bonds.md) §2).

## 1. What's in the catalogue

<!-- live:item-catalogue -->
| Kind | Count | Ids |
|---|---|---|
| Raw ingredients | 80 (8 families × 10 grades) | uma-art `items` frames with `refined: false`, e.g. `honeycomb` |
| Crafted ingredients | 80 | uma-art `items` frames with `refined: true`, e.g. `honey` |
| Planet dishes | 80 (8 families × 10 grades; 30 retired, D375) | uma-art `dishes`: `dish-<family>-<grade>` |
| Duo dishes | 8 (4 stat Duos × grades 3 and 5) | `duo-<stat>-<stat>-<grade>`, drawn with uma-art `duo-…` frames (§4.3) |
| Feasts | 4 (grades 4, 6, 8, 10) | uma-art `feast-4` … `feast-10` |
| Tonics | 10 (grades 1–10) | `tonic-1` … `tonic-10`, no art yet (§4.5) |
| Speed Ticket | 1 | `speed-ticket` (§9) |
| **Total** | **263 definitions** | |
<!-- /live -->

uma-rpg calls the middle step "refined". This game says **crafted** on screen and keeps uma-art's ids and its
`refined` flag in the data.

**Retired dishes.** The Grains, Vegetables and Mushrooms planet dishes (breads, salads and soups) are no longer cooked
since D375. They stay in the catalogue as valid ids, so anything already cooked keeps paying: each sells at its work
value's third ([09](09-racing-rewards-and-exchange.md) §6), and a salad or soup stands in for the tonic of its grade
(§6).

**Not in the catalogue:** uma-rpg's gathering families (Hides & Scales, Essences, Ores, Crystals, Stones, Fibers,
Woods, Bones & Horns: 160 frames of the same atlas stay unused), gear, the Forge, Cooking and Mastery Tokens, Energy,
Inspiration tokens, Puzzle materials, Training Tickets and every RPG item.

## 2. Families and destinations

From the README: the five stats take five neighbours on uma-art's ring, so every stat-to-stat Duo already has art.

| Family (id) | uma-art Duo key | Site ([07](07-farm.md) §1) | Planet dish style | Its crafted items go to |
|---|---|---|---|---|
| Sweets (`sweets`) | `speed` | Sugar Grove | Cakes | **Speed** meals: the Gym's Speed room |
| Fruits (`fruits`) | `mp` | Orchard | Tarts | **Stamina** meals: the Gym's Stamina room |
| Fish (`fish`) | `atk` | Fishery | Grills | **Power** meals: the Gym's Power room |
| Nuts & Seeds (`nuts-seeds`) | `limit` | Nut Grove | Cookies | **Guts** meals: the Gym's Guts room |
| Herbs & Spices (`herbs-spices`) | `matk` | Herb Garden | Curries | **Wit** meals: the Gym's Wit room |
| Grains (`grains`) | `hp` | Fields | Breads (retired) | **Tonics**, and the Feasts' side |
| Vegetables (`vegetables`) | `def` | Vegetable Garden | Salads (retired) | **Tonics** |
| Mushrooms (`mushrooms`) | `mdef` | Mushroom Cave | Soups (retired) | **Tonics** |

The stat meals also feed the Duos and Feasts (§4.3, §4.4); a meal's side comes from another stat family (§4.2).

uma-art's index still carries uma-rpg's `effect` field (HP, MP, ATK …). This game ignores it; the table above is the
only mapping.

**The ring** (uma-art's Duo order): Grains – Vegetables – Mushrooms – Fruits – Herbs & Spices – Fish – Sweets – Nuts &
Seeds – back to Grains. The stats sit in a row: Stamina – Wit – Power – Speed – Guts. That gives **four stat Duos**;
Guts–Stamina are not neighbours and have none. The ring's other four bridges (`duo-hp-def`, `duo-def-mdef`,
`duo-mdef-mp`, `duo-limit-hp`, 8 frames) are not used.

## 3. Items by family

Every family has the same ladder. Times are the README's ([12](12-economy-and-pacing.md) §4); the Farm Level gate is
Lv 5*g* − 4 ([07](07-farm.md) §4).

<!-- live:item-ladder -->
| *g* | Farm Lv | Gather (min) | Craft (min) | Work in one crafted item | Cook (min) | Planet or Duo dish, whole chain | Feast, whole chain | Tonic, whole chain |
|---|---|---|---|---|---|---|---|---|
| 1 | 1 | 90 | 22.5 | 112.5 | 240 | 802.5 | | 577.5 |
| 2 | 6 | 95 | 23.75 | 118.75 | 250 | 837.5 | | 606.25 |
| 3 | 11 | 100 | 25 | 125 | 260 | 872.5 | | 635 |
| 4 | 16 | 105 | 26.25 | 131.25 | 270 | 913.75 | 1,045 | 663.75 |
| 5 | 21 | 110 | 27.5 | 137.5 | 280 | 955 | | 692.5 |
| 6 | 26 | 115 | 28.75 | 143.75 | 290 | 996.25 | 1,140 | 721.25 |
| 7 | 31 | 120 | 30 | 150 | 300 | 1,037.5 | | 750 |
| 8 | 36 | 125 | 31.25 | 156.25 | 310 | 1,078.75 | 1,235 | 778.75 |
| 9 | 41 | 130 | 32.5 | 162.5 | 320 | 1,120 | | 807.5 |
| 10 | 46 | 135 | 33.75 | 168.75 | 330 | 1,161.25 | 1,330 | 836.25 |
<!-- /live -->

**A dish's whole chain is also its Farm EXP**, split among the Umas who gathered, crafted and cooked it (1 EXP a listed
minute, [07](07-farm.md) §4). Grades 9 and 10 are uma-art's legendary tier and carry its glints.

Each table lists, per grade: the raw item, the crafted item it becomes at the Pantry, the family's planet dish
(retired for Grains, Vegetables and Mushrooms), and that dish's side (§4.2). Names and ids are uma-art's, checked against `packages/art/items/atlas.json` and
`dishes/atlas.json`.

#### Sweets (`sweets`) → Speed

<!-- live:items-sweets -->
| *g* | Raw | Crafted | Planet dish | Its side (crafted) |
|---|---|---|---|---|
| 1 | Honeycomb `honeycomb` | Honey `honey` | Honeycomb Cake `dish-sweets-1` | Peanut Butter (Nuts & Seeds 1) |
| 2 | Sugarcane `sugarcane` | Cane Sugar `cane-sugar` | Sugarcane Cake `dish-sweets-2` | Apple Preserve (Fruits 1) |
| 3 | Sugar Beet `sugar-beet` | Beet Sugar `beet-sugar` | Sugar Beet Cake `dish-sweets-3` | Dried Basil (Herbs & Spices 1) |
| 4 | Maple Sap `maple-sap` | Maple Syrup `maple-syrup` | Maple Sap Cake `dish-sweets-4` | Trout Fillet (Fish 2) |
| 5 | Cacao Pod `cacao-pod` | Chocolate `chocolate` | Cacao Pod Cake `dish-sweets-5` | Sesame Paste (Nuts & Seeds 3) |
| 6 | Vanilla Pod `vanilla-pod` | Vanilla Extract `vanilla-extract` | Vanilla Pod Cake `dish-sweets-6` | Walnut Paste (Nuts & Seeds 4) |
| 7 | Agave Heart `agave-heart` | Agave Syrup `agave-syrup` | Agave Heart Cake `dish-sweets-7` | Orange Marmalade (Fruits 5) |
| 8 | Palm Sap `palm-sap` | Palm Sugar `palm-sugar` | Palm Sap Cake `dish-sweets-8` | Ground Pepper (Herbs & Spices 6) |
| 9 | Fairy Honeycomb `fairy-honeycomb` | Fairy Honey `fairy-honey` | Fairy Honeycomb Cake `dish-sweets-9` | Eel Fillet (Fish 7) |
| 10 | Ambrosia Blossom `ambrosia-blossom` | Ambrosia `ambrosia` | Ambrosia Blossom Cake `dish-sweets-10` | Macadamia Butter (Nuts & Seeds 8) |
<!-- /live -->

#### Fruits (`fruits`) → Stamina

<!-- live:items-fruits -->
| *g* | Raw | Crafted | Planet dish | Its side (crafted) |
|---|---|---|---|---|
| 1 | Apple `apple` | Apple Preserve `apple-preserve` | Apple Tart `dish-fruits-1` | Dried Basil (Herbs & Spices 1) |
| 2 | Pear `pear` | Pear Preserve `pear-preserve` | Pear Tart `dish-fruits-2` | Carp Fillet (Fish 1) |
| 3 | Peach `peach` | Peach Preserve `peach-preserve` | Peach Tart `dish-fruits-3` | Honey (Sweets 1) |
| 4 | Plum `plum` | Plum Preserve `plum-preserve` | Plum Tart `dish-fruits-4` | Sunflower Oil (Nuts & Seeds 2) |
| 5 | Orange `orange` | Orange Marmalade `orange-marmalade` | Orange Tart `dish-fruits-5` | Dried Rosemary (Herbs & Spices 3) |
| 6 | Grape `grape` | Grape Jelly `grape-jelly` | Grape Tart `dish-fruits-6` | Dried Thyme (Herbs & Spices 4) |
| 7 | Mango `mango` | Mango Pulp `mango-pulp` | Mango Tart `dish-fruits-7` | Salmon Fillet (Fish 5) |
| 8 | Pomegranate `pomegranate` | Pomegranate Molasses `pomegranate-molasses` | Pomegranate Tart `dish-fruits-8` | Vanilla Extract (Sweets 6) |
| 9 | Starpeach `starpeach` | Starpeach Nectar `starpeach-nectar` | Starpeach Tart `dish-fruits-9` | Pistachio Paste (Nuts & Seeds 7) |
| 10 | Golden Apple `golden-apple` | Golden Apple Preserve `golden-apple-preserve` | Golden Apple Tart `dish-fruits-10` | Saffron Threads (Herbs & Spices 8) |
<!-- /live -->

#### Fish (`fish`) → Power

<!-- live:items-fish -->
| *g* | Raw | Crafted | Planet dish | Its side (crafted) |
|---|---|---|---|---|
| 1 | Carp `carp` | Carp Fillet `carp-fillet` | Carp Grill `dish-fish-1` | Honey (Sweets 1) |
| 2 | Trout `trout` | Trout Fillet `trout-fillet` | Trout Grill `dish-fish-2` | Peanut Butter (Nuts & Seeds 1) |
| 3 | Sardine `sardine` | Sardine Fillet `sardine-fillet` | Sardine Grill `dish-fish-3` | Apple Preserve (Fruits 1) |
| 4 | Mackerel `mackerel` | Mackerel Fillet `mackerel-fillet` | Mackerel Grill `dish-fish-4` | Dried Mint (Herbs & Spices 2) |
| 5 | Salmon `salmon` | Salmon Fillet `salmon-fillet` | Salmon Grill `dish-fish-5` | Beet Sugar (Sweets 3) |
| 6 | Sea Bream `sea-bream` | Sea Bream Fillet `sea-bream-fillet` | Sea Bream Grill `dish-fish-6` | Maple Syrup (Sweets 4) |
| 7 | Eel `eel` | Eel Fillet `eel-fillet` | Eel Grill `dish-fish-7` | Chestnut Paste (Nuts & Seeds 5) |
| 8 | Tuna `tuna` | Tuna Fillet `tuna-fillet` | Tuna Grill `dish-fish-8` | Grape Jelly (Fruits 6) |
| 9 | Silverfin `silverfin` | Silverfin Fillet `silverfin-fillet` | Silverfin Grill `dish-fish-9` | Ground Cinnamon (Herbs & Spices 7) |
| 10 | Rainbow Koi `rainbow-koi` | Rainbow Koi Fillet `rainbow-koi-fillet` | Rainbow Koi Grill `dish-fish-10` | Palm Sugar (Sweets 8) |
<!-- /live -->

#### Nuts & Seeds (`nuts-seeds`) → Guts

<!-- live:items-nuts-seeds -->
| *g* | Raw | Crafted | Planet dish | Its side (crafted) |
|---|---|---|---|---|
| 1 | Peanut `peanut` | Peanut Butter `peanut-butter` | Peanut Cookies `dish-nuts-seeds-1` | Apple Preserve (Fruits 1) |
| 2 | Sunflower Seed `sunflower-seed` | Sunflower Oil `sunflower-oil` | Sunflower Seed Cookies `dish-nuts-seeds-2` | Dried Basil (Herbs & Spices 1) |
| 3 | Sesame `sesame` | Sesame Paste `sesame-paste` | Sesame Cookies `dish-nuts-seeds-3` | Carp Fillet (Fish 1) |
| 4 | Walnut `walnut` | Walnut Paste `walnut-paste` | Walnut Cookies `dish-nuts-seeds-4` | Cane Sugar (Sweets 2) |
| 5 | Chestnut `chestnut` | Chestnut Paste `chestnut-paste` | Chestnut Cookies `dish-nuts-seeds-5` | Peach Preserve (Fruits 3) |
| 6 | Almond `almond` | Almond Paste `almond-paste` | Almond Cookies `dish-nuts-seeds-6` | Plum Preserve (Fruits 4) |
| 7 | Pistachio `pistachio` | Pistachio Paste `pistachio-paste` | Pistachio Cookies `dish-nuts-seeds-7` | Ground Ginger (Herbs & Spices 5) |
| 8 | Macadamia `macadamia` | Macadamia Butter `macadamia-butter` | Macadamia Cookies `dish-nuts-seeds-8` | Sea Bream Fillet (Fish 6) |
| 9 | Thundernut `thundernut` | Thundernut Oil `thundernut-oil` | Thundernut Cookies `dish-nuts-seeds-9` | Agave Syrup (Sweets 7) |
| 10 | Worldseed `worldseed` | Worldseed Oil `worldseed-oil` | Worldseed Cookies `dish-nuts-seeds-10` | Pomegranate Molasses (Fruits 8) |
<!-- /live -->

#### Herbs & Spices (`herbs-spices`) → Wit

<!-- live:items-herbs-spices -->
| *g* | Raw | Crafted | Planet dish | Its side (crafted) |
|---|---|---|---|---|
| 1 | Basil `basil` | Dried Basil `dried-basil` | Basil Curry `dish-herbs-spices-1` | Carp Fillet (Fish 1) |
| 2 | Mint `mint` | Dried Mint `dried-mint` | Mint Curry `dish-herbs-spices-2` | Honey (Sweets 1) |
| 3 | Rosemary `rosemary` | Dried Rosemary `dried-rosemary` | Rosemary Curry `dish-herbs-spices-3` | Peanut Butter (Nuts & Seeds 1) |
| 4 | Thyme `thyme` | Dried Thyme `dried-thyme` | Thyme Curry `dish-herbs-spices-4` | Pear Preserve (Fruits 2) |
| 5 | Ginger `ginger` | Ground Ginger `ground-ginger` | Ginger Curry `dish-herbs-spices-5` | Sardine Fillet (Fish 3) |
| 6 | Peppercorn `peppercorn` | Ground Pepper `ground-pepper` | Peppercorn Curry `dish-herbs-spices-6` | Mackerel Fillet (Fish 4) |
| 7 | Cinnamon `cinnamon` | Ground Cinnamon `ground-cinnamon` | Cinnamon Curry `dish-herbs-spices-7` | Chocolate (Sweets 5) |
| 8 | Saffron `saffron` | Saffron Threads `saffron-threads` | Saffron Curry `dish-herbs-spices-8` | Almond Paste (Nuts & Seeds 6) |
| 9 | Mandrake `mandrake` | Mandrake Powder `mandrake-powder` | Mandrake Curry `dish-herbs-spices-9` | Mango Pulp (Fruits 7) |
| 10 | Phoenix Pepper `phoenix-pepper` | Phoenix Spice `phoenix-spice` | Phoenix Pepper Curry `dish-herbs-spices-10` | Tuna Fillet (Fish 8) |
<!-- /live -->

#### Grains (`grains`) → Tonics

<!-- live:items-grains -->
| *g* | Raw | Crafted | Planet dish | Its side (crafted) |
|---|---|---|---|---|
| 1 | Wheat `wheat` | Wheat Flour `wheat-flour` | Wheat Bread `dish-grains-1` (retired) | Apple Preserve (Fruits 1) |
| 2 | Oats `oats` | Rolled Oats `rolled-oats` | Oats Bread `dish-grains-2` (retired) | Dried Basil (Herbs & Spices 1) |
| 3 | Barley `barley` | Pearl Barley `pearl-barley` | Barley Bread `dish-grains-3` (retired) | Carp Fillet (Fish 1) |
| 4 | Rice `rice` | Polished Rice `polished-rice` | Rice Bread `dish-grains-4` (retired) | Cane Sugar (Sweets 2) |
| 5 | Corn `corn` | Cornmeal `cornmeal` | Corn Bread `dish-grains-5` (retired) | Sesame Paste (Nuts & Seeds 3) |
| 6 | Rye `rye` | Rye Flour `rye-flour` | Rye Bread `dish-grains-6` (retired) | Plum Preserve (Fruits 4) |
| 7 | Buckwheat `buckwheat` | Buckwheat Flour `buckwheat-flour` | Buckwheat Bread `dish-grains-7` (retired) | Ground Ginger (Herbs & Spices 5) |
| 8 | Wild Rice `wild-rice` | Hulled Wild Rice `hulled-wild-rice` | Wild Rice Bread `dish-grains-8` (retired) | Sea Bream Fillet (Fish 6) |
| 9 | Moonrice `moonrice` | Moonrice Flour `moonrice-flour` | Moonrice Bread `dish-grains-9` (retired) | Agave Syrup (Sweets 7) |
| 10 | Sunwheat `sunwheat` | Sunwheat Flour `sunwheat-flour` | Sunwheat Bread `dish-grains-10` (retired) | Macadamia Butter (Nuts & Seeds 8) |
<!-- /live -->

#### Vegetables (`vegetables`) → Tonics

<!-- live:items-vegetables -->
| *g* | Raw | Crafted | Planet dish | Its side (crafted) |
|---|---|---|---|---|
| 1 | Carrot `carrot` | Chopped Carrot `chopped-carrot` | Carrot Salad `dish-vegetables-1` (retired) | Wheat Flour (Grains 1) |
| 2 | Potato `potato` | Diced Potato `diced-potato` | Potato Salad `dish-vegetables-2` (retired) | Wheat Flour (Grains 1) |
| 3 | Cabbage `cabbage` | Shredded Cabbage `shredded-cabbage` | Cabbage Salad `dish-vegetables-3` (retired) | Wheat Flour (Grains 1) |
| 4 | Onion `onion` | Diced Onion `diced-onion` | Onion Salad `dish-vegetables-4` (retired) | Rolled Oats (Grains 2) |
| 5 | Tomato `tomato` | Tomato Purée `tomato-puree` | Tomato Salad `dish-vegetables-5` (retired) | Pearl Barley (Grains 3) |
| 6 | Bell Pepper `bell-pepper` | Sliced Bell Pepper `sliced-bell-pepper` | Bell Pepper Salad `dish-vegetables-6` (retired) | Polished Rice (Grains 4) |
| 7 | Eggplant `eggplant` | Sliced Eggplant `sliced-eggplant` | Eggplant Salad `dish-vegetables-7` (retired) | Cornmeal (Grains 5) |
| 8 | Asparagus `asparagus` | Trimmed Asparagus `trimmed-asparagus` | Asparagus Salad `dish-vegetables-8` (retired) | Rye Flour (Grains 6) |
| 9 | Golden Carrot `golden-carrot` | Golden Carrot Purée `golden-carrot-puree` | Golden Carrot Salad `dish-vegetables-9` (retired) | Buckwheat Flour (Grains 7) |
| 10 | Emperor Pumpkin `emperor-pumpkin` | Pumpkin Purée `pumpkin-puree` | Emperor Pumpkin Salad `dish-vegetables-10` (retired) | Hulled Wild Rice (Grains 8) |
<!-- /live -->

#### Mushrooms (`mushrooms`) → Tonics

<!-- live:items-mushrooms -->
| *g* | Raw | Crafted | Planet dish | Its side (crafted) |
|---|---|---|---|---|
| 1 | Button Mushroom `button-mushroom` | Dried Button Mushroom `dried-button-mushroom` | Button Mushroom Soup `dish-mushrooms-1` (retired) | Wheat Flour (Grains 1) |
| 2 | Shiitake `shiitake` | Dried Shiitake `dried-shiitake` | Shiitake Soup `dish-mushrooms-2` (retired) | Wheat Flour (Grains 1) |
| 3 | Oyster Mushroom `oyster-mushroom` | Dried Oyster Mushroom `dried-oyster-mushroom` | Oyster Mushroom Soup `dish-mushrooms-3` (retired) | Wheat Flour (Grains 1) |
| 4 | Enoki `enoki` | Dried Enoki `dried-enoki` | Enoki Soup `dish-mushrooms-4` (retired) | Rolled Oats (Grains 2) |
| 5 | Chanterelle `chanterelle` | Dried Chanterelle `dried-chanterelle` | Chanterelle Soup `dish-mushrooms-5` (retired) | Pearl Barley (Grains 3) |
| 6 | Porcini `porcini` | Dried Porcini `dried-porcini` | Porcini Soup `dish-mushrooms-6` (retired) | Polished Rice (Grains 4) |
| 7 | Morel `morel` | Dried Morel `dried-morel` | Morel Soup `dish-mushrooms-7` (retired) | Cornmeal (Grains 5) |
| 8 | Truffle `truffle` | Shaved Truffle `shaved-truffle` | Truffle Soup `dish-mushrooms-8` (retired) | Rye Flour (Grains 6) |
| 9 | Glowcap `glowcap` | Glowcap Powder `glowcap-powder` | Glowcap Soup `dish-mushrooms-9` (retired) | Buckwheat Flour (Grains 7) |
| 10 | King Reishi `king-reishi` | Reishi Powder `reishi-powder` | King Reishi Soup `dish-mushrooms-10` (retired) | Hulled Wild Rice (Grains 8) |
<!-- /live -->

## 4. Recipes

| Output | Inputs | Where | Time per output |
|---|---|---|---|
| Crafted item, grade *g* | 1 raw item of its pair | Pantry | a quarter of gathering |
| Planet dish, grade *g* | **4 crafted of its family at *g*** + **1 crafted side** of another family at max(1, *g*−2) (README) | Kitchen | 240 + 10(*g*−1) |
| Duo, grade 3 or 5 | **2 + 2 crafted** of its two families at *g* + **1 crafted side** at *g*−2 | Kitchen | same cook formula |
| Feast, grade 4, 6, 8 or 10 | **1 crafted of each of the five stat families** at *g* + **1 Grains** side at *g*−2 | Kitchen | same cook formula |
| Tonic, grade *g* | **1 crafted Vegetables, 1 Mushrooms and 1 Grains** at *g*, no side (D375) | Kitchen | same cook formula |

Every recipe names **exact items**: no substitutions, no "any crafted Fish". A meal or tonic pays only an unlock that
names it (§6), and a higher grade doesn't stand in for a lower one, so the planner's counts stay exact. The one
exception is the retired salads and soups, each standing in for the tonic of its own grade.

### 4.1 Why five crafted items for a meal, and three for a tonic

A planet meal, a Duo and a Feast all buy one unlock worth the same 40 points of build at tier 1 (single +40, Duo
+20/+20, Sun +8 × 5, README, D338). So they cost about the same: a planet and a Duo exactly the same chain, a Feast one
crafted item more (+14%), which keeps it a special dish without making the Sun a chore.

A tonic buys a node or an Inspiration slot, a smaller step of the build, so it is three crafted items: one of each
tonic family, which keeps Grains, Vegetables and Mushrooms level with each other (§7).

### 4.2 The side rotation

A side spreads a meal's demand to another family, so no stat site carries its room alone. uma-rpg rotated its sides
for the same reason (its D86):
1. **Stat meals rotate through the stat cycle** Fruits → Herbs & Spices → Fish → Sweets → Nuts & Seeds → (Fruits): at
   grades 1, 5 and 6 the side is one family on, at 2 and 7 two on, at 3 and 8 three on, at 4 and 9 four on, and at 10
   one on again. Grades 5 and 10 took bread before D375; with Grains feeding tonics they step one family on instead.
2. **Duo sides** go to the two stat families that sit in only one Duo: Nuts & Seeds for Stamina–Wit and Wit–Power,
   Fruits for Power–Speed and Speed–Guts.
3. **Feast sides** are Grains.
4. **Tonics take no side.** Their three families are already one each.
5. **The retired dishes keep their sides** (salads and soups bread, breads the stat cycle), so their work values, and
   with them their sale prices, don't move.
6. **No dish ever takes a Vegetables or Mushrooms side.**

All 80 planet dishes' side families (the side's grade in brackets):

<!-- live:dish-sides -->
| *g* (side *g*) | Sweets | Fruits | Fish | Nuts & Seeds | Herbs & Spices | Grains | Vegetables | Mushrooms |
|---|---|---|---|---|---|---|---|---|
| 1 (1) | Nuts | Herbs | Sweets | Fruits | Fish | Fruits | Grains | Grains |
| 2 (1) | Fruits | Fish | Nuts | Herbs | Sweets | Herbs | Grains | Grains |
| 3 (1) | Herbs | Sweets | Fruits | Fish | Nuts | Fish | Grains | Grains |
| 4 (2) | Fish | Nuts | Herbs | Sweets | Fruits | Sweets | Grains | Grains |
| 5 (3) | Nuts | Herbs | Sweets | Fruits | Fish | Nuts | Grains | Grains |
| 6 (4) | Nuts | Herbs | Sweets | Fruits | Fish | Fruits | Grains | Grains |
| 7 (5) | Fruits | Fish | Nuts | Herbs | Sweets | Herbs | Grains | Grains |
| 8 (6) | Herbs | Sweets | Fruits | Fish | Nuts | Fish | Grains | Grains |
| 9 (7) | Fish | Nuts | Herbs | Sweets | Fruits | Sweets | Grains | Grains |
| 10 (8) | Nuts | Herbs | Sweets | Fruits | Fish | Nuts | Grains | Grains |
<!-- /live -->

The exact side item is in each family's table in §3.

### 4.3 Duos

Four stat Duos, each at grade 3 (scenario 2) and grade 5 (scenario 3), for the Gym's Duo nodes ([05](05-training-hub.md)).
Grade 3 uses uma-art's grade-3 frame and name; grade 5 uses its grade-7 **Deluxe** frame and name.

<!-- live:duo-recipes -->
| Id | Stats | Recipe | uma-art frame | Name |
|---|---|---|---|---|
| `duo-stamina-wit-3` | Stamina + Wit | 2 Peach Preserve + 2 Dried Rosemary + 1 Peanut Butter | `duo-mp-matk-3` | Fruit & Herb Platter |
| `duo-stamina-wit-5` | Stamina + Wit | 2 Orange Marmalade + 2 Ground Ginger + 1 Sesame Paste | `duo-mp-matk-7` | Fruit & Herb Platter Deluxe |
| `duo-wit-power-3` | Wit + Power | 2 Dried Rosemary + 2 Sardine Fillet + 1 Peanut Butter | `duo-matk-atk-3` | Herb & Fish Platter |
| `duo-wit-power-5` | Wit + Power | 2 Ground Ginger + 2 Salmon Fillet + 1 Sesame Paste | `duo-matk-atk-7` | Herb & Fish Platter Deluxe |
| `duo-power-speed-3` | Power + Speed | 2 Sardine Fillet + 2 Beet Sugar + 1 Apple Preserve | `duo-atk-speed-3` | Fish & Honey Platter |
| `duo-power-speed-5` | Power + Speed | 2 Salmon Fillet + 2 Chocolate + 1 Peach Preserve | `duo-atk-speed-7` | Fish & Honey Platter Deluxe |
| `duo-speed-guts-3` | Speed + Guts | 2 Beet Sugar + 2 Sesame Paste + 1 Apple Preserve | `duo-speed-limit-3` | Honey & Nut Platter |
| `duo-speed-guts-5` | Speed + Guts | 2 Chocolate + 2 Chestnut Paste + 1 Peach Preserve | `duo-speed-limit-7` | Honey & Nut Platter Deluxe |
<!-- /live -->

Duo ids are this game's own because a grade-5 dish drawn with a `-7` frame would mislead anyone reading the id. Every
other dish id is uma-art's frame id.

### 4.4 Feasts

One per scenario from scenario 2, for the Gym's Sun nodes. A Sun gives all five stats, so a Feast takes one of each
stat family, with bread.

### 4.5 Tonics

One per grade, brewed at the Kitchen as any dish is, on the same cook formula: one crafted item each of Vegetables,
Mushrooms and Grains at its grade, with no side (D375). A tonic pays one constellation node or one Inspiration slot of
its grade ([05](05-training-hub.md) §3); its grade opens at the same Farm Level as any item's (Lv 5*g* − 4).

<!-- live:tonic-recipes -->
| Id | Name | Grade | Recipe |
|---|---|---|---|
| `tonic-1` | Warm-Up Tonic | 1 | Chopped Carrot + Dried Button Mushroom + Wheat Flour |
| `tonic-2` | Practice Tonic | 2 | Diced Potato + Dried Shiitake + Rolled Oats |
| `tonic-3` | Paddock Tonic | 3 | Shredded Cabbage + Dried Oyster Mushroom + Pearl Barley |
| `tonic-4` | Gallop Tonic | 4 | Diced Onion + Dried Enoki + Polished Rice |
| `tonic-5` | Stride Tonic | 5 | Tomato Purée + Dried Chanterelle + Cornmeal |
| `tonic-6` | Stretch Tonic | 6 | Sliced Bell Pepper + Dried Porcini + Rye Flour |
| `tonic-7` | Spurt Tonic | 7 | Sliced Eggplant + Dried Morel + Buckwheat Flour |
| `tonic-8` | Derby Tonic | 8 | Trimmed Asparagus + Shaved Truffle + Hulled Wild Rice |
| `tonic-9` | Champion's Tonic | 9 | Golden Carrot Purée + Glowcap Powder + Moonrice Flour |
| `tonic-10` | Legend's Tonic | 10 | Pumpkin Purée + Reishi Powder + Sunwheat Flour |
<!-- /live -->

Tonic ids are this game's own (`tonic-<grade>`). uma-art has no tonic frames yet, so a tonic draws as its name on a
plain tile until a ChatGPT packet adds them to the `items` atlas ([11](11-hub-and-places.md) §10).

<!-- live:feast-recipes -->
| Id | Name | Grade | Recipe |
|---|---|---|---|
| `feast-4` | Spring Feast | 4 | Maple Syrup, Plum Preserve, Mackerel Fillet, Walnut Paste, Dried Thyme + Rolled Oats |
| `feast-6` | Summer Feast | 6 | Vanilla Extract, Grape Jelly, Sea Bream Fillet, Almond Paste, Ground Pepper + Polished Rice |
| `feast-8` | Harvest Feast | 8 | Palm Sugar, Pomegranate Molasses, Tuna Fillet, Macadamia Butter, Saffron Threads + Rye Flour |
| `feast-10` | Grand Feast | 10 | Ambrosia, Golden Apple Preserve, Rainbow Koi Fillet, Worldseed Oil, Phoenix Spice + Hulled Wild Rice |
<!-- /live -->

## 5. Work and Farm EXP per meal and tonic

The §3 ladder in totals, in base minutes; in play each is × *k* = 1.8 (README, D375). All planet dishes of a grade
cost the same whatever their family or side family.

| Dish | Crafted inputs | Gathering | Crafting | Cooking | **Whole chain = Farm EXP** | With its session ([05](05-training-hub.md)) |
|---|---|---|---|---|---|---|
| Planet, grade 1 | 4 + 1 | 450 | 112.5 | 240 | **802.5** | 982.5 (16.4 h) |
| Planet, grade 4 | 4 + 1 at *g* 2 | 515 | 128.75 | 270 | **913.75** | 1,138.75 (19.0 h) |
| Planet, grade 10 | 4 + 1 at *g* 8 | 665 | 166.25 | 330 | **1,161.25** | 1,476.25 (24.6 h) |
| Duo, grade 3 | 2 + 2 + 1 at *g* 1 | 490 | 122.5 | 260 | **872.5** | 1,082.5 (18.0 h) |
| Duo, grade 5 | 2 + 2 + 1 at *g* 3 | 540 | 135 | 280 | **955** | 1,195 (19.9 h) |
| Feast, grade 4 | 5 + 1 at *g* 2 | 620 | 155 | 270 | **1,045** | 1,270 (21.2 h) |
| Feast, grade 10 | 5 + 1 at *g* 8 | 800 | 200 | 330 | **1,330** | 1,645 (27.4 h) |
| Tonic, grade 1 | 3 | 270 | 67.5 | 240 | **577.5** | 757.5 (12.6 h) |
| Tonic, grade 10 | 3 | 405 | 101.25 | 330 | **836.25** | 1,151.25 (19.2 h) |

Every other grade is in the §3 ladder. Gathering is 56% of a meal's chain, crafting 14% and cooking 30%; a tonic's is
47%, 12% and 42%, which is why the Kitchen is the busiest building ([07](07-farm.md) §6).

## 6. Which unlock takes which item

[05](05-training-hub.md) and [06](06-cards-and-bonds.md) own the exact cost of each unlock. The default, used for the
demand counts below: a scenario layer's first half takes grade 2*s*−1 and its second half grade 2*s* (README).

| Unlock | Item (D375) |
|---|---|
| A constellation node | The tonic of the layer's grade |
| An Inspiration slot | The tonic of the grade [05](05-training-hub.md) §3 lists |
| An inherited unique or gold skill | **None**: the session is time only |
| An Extra Stats single node (stat, grade *g*) | That stat's meal at *g* |
| A Duo node | Its Duo at grade 3 or 5 |
| A Sun node | The Feast of its grade (4, 6, 8, 10) |
| A card bond | **None**. The grade still follows the card's era (a card first eligible in the tier's scenario *p* bonds at grade 2*p* − 1, [06](06-cards-and-bonds.md) §2) and sets the session's length |

**Stand-ins.** A retired salad or soup pays for the tonic of its grade, the salad first, then the soup, then the tonic
itself: a session reserves the stand-ins before any tonic, and the planner counts them as tonics in stock. Nothing
else stands in for anything.

## 7. Demand over a tier

One Uma's tier is **107 unlocks** (README, D338): 28 constellation nodes, 24 Inspiration (6 slots, 6 inherited
uniques, 12 gold skills), 25 Extra Stats singles, 8 Duos, 4 Suns and 18 bonds. Since D375 they take **71 items**:
37 meals (the singles, Duos and Suns) and 34 tonics (the nodes and slots); the 18 uniques and golds and the 18 bonds
take none. Bonds no longer change the demand, so the **representative deck** (one card of each of six types in
scenario 1, a Speed, Stamina and Power card in scenarios 2 and 4, a Guts, Wit and Friend card in scenarios 3 and 5)
only sets the bonds' session times. These tables are live: the loop simulation's `tierDemand` lists every unlock's item
(T128) and expands them through the recipes (T126) (T132, D348).

### Meals and tonics, per Uma per tier

<!-- live:demand-dishes -->
| Meal or tonic | *g*1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | Total |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Sweets meals | 1 | 0 | 1 | 0 | 1 | 0 | 1 | 0 | 1 | 0 | **5** |
| Fruits meals | 1 | 0 | 1 | 0 | 1 | 0 | 1 | 0 | 1 | 0 | **5** |
| Fish meals | 1 | 0 | 1 | 0 | 1 | 0 | 1 | 0 | 1 | 0 | **5** |
| Nuts & Seeds meals | 1 | 0 | 1 | 0 | 1 | 0 | 1 | 0 | 1 | 0 | **5** |
| Herbs & Spices meals | 1 | 0 | 1 | 0 | 1 | 0 | 1 | 0 | 1 | 0 | **5** |
| Duos | | | 4 | | 4 | | | | | | **8** |
| Feasts | | | | 1 | | 1 | | 1 | | 1 | **4** |
| Tonics | 8 | 6 | 2 | 4 | 4 | 2 | 2 | 2 | 2 | 2 | **34** |
| **All** | | | | | | | | | | | **71** |
<!-- /live -->

### Crafted items, per Uma per tier

<!-- live:demand-crafted -->
| Family | *g*1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | **Total** | Own meals and tonics | Sides |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Grains | 8 | 7 | 2 | 5 | 4 | 3 | 2 | 3 | 2 | 2 | **38** | 34 | 4 |
| Sweets | 6 | 0 | 9 | 1 | 9 | 1 | 5 | 1 | 4 | 1 | **37** | 32 | 5 |
| Fruits | 8 | 0 | 9 | 1 | 7 | 1 | 5 | 1 | 4 | 1 | **37** | 28 | 9 |
| Fish | 6 | 0 | 9 | 1 | 9 | 1 | 5 | 1 | 4 | 1 | **37** | 32 | 5 |
| Nuts & Seeds | 8 | 0 | 9 | 1 | 7 | 1 | 5 | 1 | 4 | 1 | **37** | 28 | 9 |
| Herbs & Spices | 6 | 0 | 9 | 1 | 9 | 1 | 5 | 1 | 4 | 1 | **37** | 32 | 5 |
| Vegetables | 8 | 6 | 2 | 4 | 4 | 2 | 2 | 2 | 2 | 2 | **34** | 34 | 0 |
| Mushrooms | 8 | 6 | 2 | 4 | 4 | 2 | 2 | 2 | 2 | 2 | **34** | 34 | 0 |
| **All** | | | | | | | | | | | **291** | 254 | 37 |
<!-- /live -->

**What D375 does.** The tier's crafted demand falls from 539 to 291 and spreads almost evenly: Grains 38, each stat
family 37, Vegetables and Mushrooms 34 each. Before, the meals for nodes, slots, uniques and golds made Vegetables
the busiest family at 112 a tier (36% of scenario 1's crafted demand) and Mushrooms 96, while the stat families sat at
50–53; a bond took a whole dish for no build of its own. Now no family is a flag: scenario 1, mostly nodes and slots,
splits about a fifth to each tonic family, and the later scenarios, mostly the Gym's, about a seventh to each stat
family. The Vegetable Garden keeps its fifth slot ([07](07-farm.md) §6) and the Exchange still sells raw Vegetables as
a relief valve ([09](09-racing-rewards-and-exchange.md)).

**Fewer items, longer steps.** 71 items instead of 107 cut the Farm's work for a tier by more than 40%, so D375 raised
*k* from 1.2 to 1.8: every step is half as long again, the Kitchen has 6, 9 and 9 slots by level ([07](07-farm.md)
§6), and a tier of training keeps its weeks ([12](12-economy-and-pacing.md) §12).

**By scenario.** Shares of crafted demand per scenario of the tier:

<!-- live:demand-by-scenario -->
| Scenario | Unlocks | Crafted items | Vegetables | Mushrooms | Grains | Each stat family |
|---|---|---|---|---|---|---|
| 1 | 27 | 67 | 21% | 21% | 21% | 7%–7% |
| 2 | 23 | 69 | 9% | 9% | 10% | 14%–14% |
| 3 | 21 | 69 | 9% | 9% | 10% | 14%–14% |
| 4 | 19 | 43 | 9% | 9% | 12% | 14%–14% |
| 5 | 17 | 43 | 9% | 9% | 12% | 14%–14% |
<!-- /live -->

**Other decks.** A bond takes no item, so every deck's tier takes the same 71 items; a deck changes only how long
its bonds' sessions are.

## 8. Work values, for selling

An item's **work value** is the real minutes of the work in it: the base minutes × *k* (1.8, D375), so the anchor
"1 Prize Money ≈ 1 minute of Uma work" holds whatever *k* is. Selling pays **a third** of it in Prize Money (D331);
[09](09-racing-rewards-and-exchange.md) owns rounding and the Exchange's buy prices.

<!-- live:work-values -->
| *g* | Raw | Crafted | Planet or Duo dish | Feast | Tonic | A third: raw / crafted / dish / tonic |
|---|---|---|---|---|---|---|
| 1 | 162 | 202.5 | 1,444.5 | | 1,039.5 | 54 / 67.5 / 481.5 / 346.5 |
| 2 | 171 | 213.75 | 1,507.5 | | 1,091.25 | 57 / 71.25 / 502.5 / 363.75 |
| 3 | 180 | 225 | 1,570.5 | | 1,143 | 60 / 75 / 523.5 / 381 |
| 4 | 189 | 236.25 | 1,644.75 | 1,881 | 1,194.75 | 63 / 78.75 / 548.25 / 398.25 (Feast 627) |
| 5 | 198 | 247.5 | 1,719 | | 1,246.5 | 66 / 82.5 / 573 / 415.5 |
| 6 | 207 | 258.75 | 1,793.25 | 2,052 | 1,298.25 | 69 / 86.25 / 597.75 / 432.75 (Feast 684) |
| 7 | 216 | 270 | 1,867.5 | | 1,350 | 72 / 90 / 622.5 / 450 |
| 8 | 225 | 281.25 | 1,941.75 | 2,223 | 1,401.75 | 75 / 93.75 / 647.25 / 467.25 (Feast 741) |
| 9 | 234 | 292.5 | 2,016 | | 1,453.5 | 78 / 97.5 / 672 / 484.5 |
| 10 | 243 | 303.75 | 2,090.25 | 2,394 | 1,505.25 | 81 / 101.25 / 696.75 / 501.75 (Feast 798) |
<!-- /live -->

The value is the same for every family at a grade. Building speed and Speed Tickets don't change it.

## 9. Other items and currencies

| Thing | Kind | Rules |
|---|---|---|
| **Speed Ticket** (`speed-ticket`) | An item in the Warehouse | Bought at the Exchange for 30 Prize Money; takes 30 minutes off one running job or session ([07](07-farm.md) §8, [09](09-racing-rewards-and-exchange.md)). Today's Energy, renamed. uma-art has no ticket icon: a new one is on [11](11-hub-and-places.md)'s art list |
| **Uma Ticket** | A profile currency, not an item | Unlocks into tier 1 only: 20 at the start, 5 Uma Shards each (1 per scenario gate), one per promotion; never sold ([04](04-tiers-and-promotion.md) §6) |
| **Prize Money** | A profile currency | Races and sales ([09](09-racing-rewards-and-exchange.md)) |

There are **no** tokens of any kind, no Energy, no Puzzle materials, no Training Tickets, no Card Coupons and no RPG
items ([13](../rework/13-removals-and-plan-changes.md)).

## 10. Ids, names and art

- **Ids** are explicit, stable keys in the domain catalogue, never derived from a display name. Raw, crafted, planet
  and Feast ids equal their uma-art frame ids; Duos map to a frame (§4.3); `speed-ticket` maps to the new icon.
- **One definition** per item: id, kind (raw, crafted, dish, tonic, ticket), family, grade, dish kind (planet, Duo,
  Feast), destination, whether it is retired, name and art frame. [07](07-farm.md)'s screens and the Warehouse read
  nothing else.
- **Names** are uma-rpg's, kept as they are. They're food, they read well beside a racing game, and uma-art draws them.
  Grades 9 and 10 keep their fanciful names (Moonrice, Starpeach, Thundernut, Phoenix Pepper): they mark the
  legendary grades, as the glints do.
- **On screen** a meal shows its stat beside its name ("Honeycomb Cake · Speed · grade 1"), a tonic what it opens
  ("Warm-Up Tonic · Nodes & Inspiration slots · grade 1"), and a retired dish "Stands in for a tonic" or "Retired ·
  sell it".
- **Art:** `items/atlas.png` (32 × 32, ten grades across, one row per family side), `dishes/atlas.png` (one row per
  family, then Duos and Feasts). Uses 160 of 320 item frames and 92 of 100 dish frames. The tonics have none yet
  (§4.5).

## 11. What this replaces

Today's catalogue (M031, D304): 490 raw and 630 processed definitions across 14 scenario flavour rows, 48 meals (16
signatures × 3 blocks) and Energy, 1,169 in all, drawn as original SVG marks. All of it goes with today's Farm
([07](07-farm.md) §13, [13](../rework/13-removals-and-plan-changes.md)). The Speed Ticket replaces Energy.

## 12. Decided here

| Choice | Why |
|---|---|
| **Feast = one crafted of each stat family at *g* + a Grains side** | A Sun feeds the five stats; six inputs keep it within 14% of a planet dish; it adds nothing to the busiest families |
| **Duo = 2 + 2 of its families at *g* + one side** | The same chain as a planet dish for the same 40 points |
| **Meals for Extra Stats, tonics for nodes and slots, nothing for bonds, uniques and golds** (D375) | uma-rpg's split of crafted items into stat consumables and build consumables; a bond already costs a card and its session, and a dish per bond was dozens of cooked items for no build of their own |
| **Tonic = 1 crafted Vegetables + 1 Mushrooms + 1 Grains at *g*, no side, one per grade** | The three families freed by D375 share it evenly; a node or slot is a smaller step than 40 points of stats |
| **The 30 salads, soups and breads retire but stay valid ids**; a salad or soup stands in for its grade's tonic | What the owner already cooked keeps paying, and no save needs migrating |
| **Side rotation** (§4.2): stat meals around the stat cycle, one family on at grades 5 and 10 (bread before D375); Duo sides to Fruits and Nuts & Seeds; Feasts Grains; tonics none | Grains 38, the stat families 37 and the tonic families 34 a tier (§7) |
| **No side is ever Vegetables or Mushrooms** | The tonics already draw on them |
| **Every dish uses the same cook formula** | One rule; the Feast's extra input is its only premium |
| **Exact recipes, exact items**: no substitutions, no higher grade for a lower, the stand-ins the only exception | The planner's counts stay exact, and every Repeat is predictable |
| **Duo ids `duo-<stat>-<stat>-<g>`**, drawn with uma-art's grade-3 and grade-7 frames | A grade-5 dish should not carry a `-7` id |
| **Keep uma-rpg's names; "crafted" on screen, `refined` in data** | No renaming drift from the art package |
| **Representative deck: 3 bonds of each type** | A neutral basis for the bonds' session times; since D375 no deck changes the items |
| **Work value = real minutes (base × *k*, D338, *k* = 1.8 since D375); selling a third** | One number per item for [09](09-racing-rewards-and-exchange.md), independent of building speed |
| **Durations go through `state/time.ts`'s one conversion** (T126) | M033 gave the items no dependency on T125, which owned `TIME_FACTOR` and the docs check over the rework's pages. Phase 2's groundwork landed both first, so the item rules import `workSeconds` and add neither |
| **§7 is checked here and owned by `sim:loop`** (T126) | §7's dish counts come from the layers and the deck, which the item rules don't hold, and T132 rewrites this page's Farm tables from its run (T128's draft found §7's bond grades can't all come from [06](06-cards-and-bonds.md)'s era rule). So the items export no demand constant and render no §7 block; their test checks only that the recipes turn §7's dish table into §7's crafted table. §13's "from the layer definitions" lands with T132 |
| **Step times and the grade gate live with the items** (T126) | [07](07-farm.md) §2, §4 and §3 here all state them, work values need them and the items are upstream, so the Farm's jobs (T127) import them, rather than keeping their own copies, and divide by building speed |
| **§8's "A third" column renders as work value ÷ the Exchange's `SELL_DIVISOR`** (T126, T130) | D331's sell rule, owned by the Exchange; shown unrounded here, since [09](09-racing-rewards-and-exchange.md) §6 owns the rounding |

## 13. Done when

- The domain catalogue holds exactly 263 definitions: 80 raw, 80 crafted, 80 planet dishes (30 of them retired),
  8 Duos, 4 Feasts, 10 tonics and the Speed Ticket. A test checks every id against uma-art's `items` and `dishes`
  indexes (the Duos through their frame map, the tonics art-free) and that no gathering-side id appears.
- A test pins every recipe: four of the family plus the §4.2 side for each planet dish, the §4.3 Duos, §4.4 Feasts
  and §4.5 tonics, no side from Vegetables or Mushrooms, no side of the dish's own family; the Kitchen cooks no
  retired dish.
- A test computes §7's tables from the layer definitions and the representative deck and pins them: 71 meals and
  tonics and 291 crafted items a tier, Grains 38, the stat families 37, Vegetables and Mushrooms 34 (D375).
- `pnpm sim:loop` reports Warehouse stock by family and grade over a tier, and no site is the bottleneck for more than
  [12](12-economy-and-pacing.md) §12's tolerance.
- §3's family tables and §4's matrix are live blocks rendered from the domain constants
  ([the rework modules](architecture.md#the-rework-modules)).
- In the app, every item, dish and the Speed Ticket shows its icon, name, grade and destination, at 32 × 32 and its
  whole-number scales.
