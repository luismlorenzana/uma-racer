# 08 · Item catalogue and recipes

> **Status: design for owner review, 2026-10-13 (D326, D330, D331).** Nothing here is built. Recipes, times and the
> side rotation are **drafts**: the loop simulation ([12](12-economy-and-pacing.md) §12) checks demand per family and
> per building, and its checks pin them.

Every item the Farm makes, every recipe, and where each dish goes. The catalogue is **uma-rpg's farming half** (D330):
its eight farming families, ten grades each, raw and crafted, and its dishes, with uma-art's icons and names. uma-rpg's
gathering half, gear and the Forge are not used. How jobs, timers and Farm Level work is in [07](07-farm.md).

## 1. What's in the catalogue

| Kind | Count | Ids |
|---|---|---|
| Raw ingredients | 80 (8 families × 10 grades) | uma-art `items` frames with `refined: false`, e.g. `honeycomb` |
| Crafted ingredients | 80 | uma-art `items` frames with `refined: true`, e.g. `honey` |
| Planet dishes | 80 (8 families × 10 grades) | uma-art `dishes`: `dish-<family>-<grade>` |
| Duo dishes | 8 (4 stat Duos × grades 3 and 5) | `duo-<stat>-<stat>-<grade>`, drawn with uma-art `duo-…` frames (§4.3) |
| Feasts | 4 (grades 4, 6, 8, 10) | uma-art `feast-4` … `feast-10` |
| Speed Ticket | 1 | `speed-ticket` (§9) |
| **Total** | **253 definitions** | |

uma-rpg calls the middle step "refined". This game says **crafted** on screen and keeps uma-art's ids and its
`refined` flag in the data.

**Not in the catalogue:** uma-rpg's gathering families (Hides & Scales, Essences, Ores, Crystals, Stones, Fibers,
Woods, Bones & Horns: 160 frames of the same atlas stay unused), gear, the Forge, Cooking and Mastery Tokens, Energy,
Inspiration tokens, Puzzle materials, Training Tickets and every RPG item.

## 2. Families and destinations

From the README: the five stats take five neighbours on uma-art's ring, so every stat-to-stat Duo already has art.

| Family (id) | uma-art Duo key | Site ([07](07-farm.md) §1) | Planet dish style | Dish goes to |
|---|---|---|---|---|
| Sweets (`sweets`) | `speed` | Sugar Grove | Cakes | **Speed**: Gym room, Speed card bonds |
| Fruits (`fruits`) | `mp` | Orchard | Tarts | **Stamina**: Gym room, Stamina card bonds |
| Fish (`fish`) | `atk` | Fishery | Grills | **Power**: Gym room, Power card bonds |
| Nuts & Seeds (`nuts-seeds`) | `limit` | Nut Grove | Cookies | **Guts**: Gym room, Guts card bonds |
| Herbs & Spices (`herbs-spices`) | `matk` | Herb Garden | Curries | **Wit**: Gym room, Wit card bonds |
| Grains (`grains`) | `hp` | Fields | Breads | **Skill**: Friend and Group card bonds |
| Vegetables (`vegetables`) | `def` | Vegetable Garden | Salads | **Constellation**: Observatory node unlocks |
| Mushrooms (`mushrooms`) | `mdef` | Mushroom Cave | Soups | **Inspiration**: Lineage Hall slots and gold skills |

uma-art's index still carries uma-rpg's `effect` field (HP, MP, ATK …). This game ignores it; the table above is the
only mapping.

**The ring** (uma-art's Duo order): Grains – Vegetables – Mushrooms – Fruits – Herbs & Spices – Fish – Sweets – Nuts &
Seeds – back to Grains. The stats sit in a row: Stamina – Wit – Power – Speed – Guts. That gives **four stat Duos**;
Guts–Stamina are not neighbours and have none. The ring's other four bridges (`duo-hp-def`, `duo-def-mdef`,
`duo-mdef-mp`, `duo-limit-hp`, 8 frames) are not used.

## 3. Items by family

Every family has the same ladder. Times are the README's ([12](12-economy-and-pacing.md) §4); the Farm Level gate is
Lv 5*g* − 4 ([07](07-farm.md) §4).

| *g* | Farm Lv | Gather (min) | Craft (min) | Work in one crafted item | Cook (min) | Planet or Duo dish, whole chain | Feast, whole chain |
|---|---|---|---|---|---|---|---|
| 1 | 1 | 90 | 22.5 | 112.5 | 240 | 802.5 | |
| 2 | 6 | 95 | 23.75 | 118.75 | 250 | 837.5 | |
| 3 | 11 | 100 | 25 | 125 | 260 | 872.5 | |
| 4 | 16 | 105 | 26.25 | 131.25 | 270 | 913.75 | 1,045 |
| 5 | 21 | 110 | 27.5 | 137.5 | 280 | 955 | |
| 6 | 26 | 115 | 28.75 | 143.75 | 290 | 996.25 | 1,140 |
| 7 | 31 | 120 | 30 | 150 | 300 | 1,037.5 | |
| 8 | 36 | 125 | 31.25 | 156.25 | 310 | 1,078.75 | 1,235 |
| 9 | 41 | 130 | 32.5 | 162.5 | 320 | 1,120 | |
| 10 | 46 | 135 | 33.75 | 168.75 | 330 | 1,161.25 | 1,330 |

**A dish's whole chain is also its Farm EXP**, split among the Umas who gathered, crafted and cooked it (1 EXP a listed
minute, [07](07-farm.md) §4). Grades 9 and 10 are uma-art's legendary tier and carry its glints.

Each table lists, per grade: the raw item, the crafted item it becomes at the Pantry, the family's planet dish, and
that dish's side (§4.2). Names and ids are uma-art's, checked against `packages/art/items/atlas.json` and
`dishes/atlas.json`.

#### Sweets (`sweets`) → Speed

| *g* | Raw | Crafted | Planet dish | Its side (crafted) |
|---|---|---|---|---|
| 1 | Honeycomb `honeycomb` | Honey `honey` | Honeycomb Cake `dish-sweets-1` | Peanut Butter (Nuts & Seeds 1) |
| 2 | Sugarcane `sugarcane` | Cane Sugar `cane-sugar` | Sugarcane Cake `dish-sweets-2` | Apple Preserve (Fruits 1) |
| 3 | Sugar Beet `sugar-beet` | Beet Sugar `beet-sugar` | Sugar Beet Cake `dish-sweets-3` | Dried Basil (Herbs & Spices 1) |
| 4 | Maple Sap `maple-sap` | Maple Syrup `maple-syrup` | Maple Sap Cake `dish-sweets-4` | Trout Fillet (Fish 2) |
| 5 | Cacao Pod `cacao-pod` | Chocolate `chocolate` | Cacao Pod Cake `dish-sweets-5` | Pearl Barley (Grains 3) |
| 6 | Vanilla Pod `vanilla-pod` | Vanilla Extract `vanilla-extract` | Vanilla Pod Cake `dish-sweets-6` | Walnut Paste (Nuts & Seeds 4) |
| 7 | Agave Heart `agave-heart` | Agave Syrup `agave-syrup` | Agave Heart Cake `dish-sweets-7` | Orange Marmalade (Fruits 5) |
| 8 | Palm Sap `palm-sap` | Palm Sugar `palm-sugar` | Palm Sap Cake `dish-sweets-8` | Ground Pepper (Herbs & Spices 6) |
| 9 | Fairy Honeycomb `fairy-honeycomb` | Fairy Honey `fairy-honey` | Fairy Honeycomb Cake `dish-sweets-9` | Eel Fillet (Fish 7) |
| 10 | Ambrosia Blossom `ambrosia-blossom` | Ambrosia `ambrosia` | Ambrosia Blossom Cake `dish-sweets-10` | Hulled Wild Rice (Grains 8) |

#### Fruits (`fruits`) → Stamina

| *g* | Raw | Crafted | Planet dish | Its side (crafted) |
|---|---|---|---|---|
| 1 | Apple `apple` | Apple Preserve `apple-preserve` | Apple Tart `dish-fruits-1` | Dried Basil (Herbs & Spices 1) |
| 2 | Pear `pear` | Pear Preserve `pear-preserve` | Pear Tart `dish-fruits-2` | Carp Fillet (Fish 1) |
| 3 | Peach `peach` | Peach Preserve `peach-preserve` | Peach Tart `dish-fruits-3` | Honey (Sweets 1) |
| 4 | Plum `plum` | Plum Preserve `plum-preserve` | Plum Tart `dish-fruits-4` | Sunflower Oil (Nuts & Seeds 2) |
| 5 | Orange `orange` | Orange Marmalade `orange-marmalade` | Orange Tart `dish-fruits-5` | Pearl Barley (Grains 3) |
| 6 | Grape `grape` | Grape Jelly `grape-jelly` | Grape Tart `dish-fruits-6` | Dried Thyme (Herbs & Spices 4) |
| 7 | Mango `mango` | Mango Pulp `mango-pulp` | Mango Tart `dish-fruits-7` | Salmon Fillet (Fish 5) |
| 8 | Pomegranate `pomegranate` | Pomegranate Molasses `pomegranate-molasses` | Pomegranate Tart `dish-fruits-8` | Vanilla Extract (Sweets 6) |
| 9 | Starpeach `starpeach` | Starpeach Nectar `starpeach-nectar` | Starpeach Tart `dish-fruits-9` | Pistachio Paste (Nuts & Seeds 7) |
| 10 | Golden Apple `golden-apple` | Golden Apple Preserve `golden-apple-preserve` | Golden Apple Tart `dish-fruits-10` | Hulled Wild Rice (Grains 8) |

#### Fish (`fish`) → Power

| *g* | Raw | Crafted | Planet dish | Its side (crafted) |
|---|---|---|---|---|
| 1 | Carp `carp` | Carp Fillet `carp-fillet` | Carp Grill `dish-fish-1` | Honey (Sweets 1) |
| 2 | Trout `trout` | Trout Fillet `trout-fillet` | Trout Grill `dish-fish-2` | Peanut Butter (Nuts & Seeds 1) |
| 3 | Sardine `sardine` | Sardine Fillet `sardine-fillet` | Sardine Grill `dish-fish-3` | Apple Preserve (Fruits 1) |
| 4 | Mackerel `mackerel` | Mackerel Fillet `mackerel-fillet` | Mackerel Grill `dish-fish-4` | Dried Mint (Herbs & Spices 2) |
| 5 | Salmon `salmon` | Salmon Fillet `salmon-fillet` | Salmon Grill `dish-fish-5` | Pearl Barley (Grains 3) |
| 6 | Sea Bream `sea-bream` | Sea Bream Fillet `sea-bream-fillet` | Sea Bream Grill `dish-fish-6` | Maple Syrup (Sweets 4) |
| 7 | Eel `eel` | Eel Fillet `eel-fillet` | Eel Grill `dish-fish-7` | Chestnut Paste (Nuts & Seeds 5) |
| 8 | Tuna `tuna` | Tuna Fillet `tuna-fillet` | Tuna Grill `dish-fish-8` | Grape Jelly (Fruits 6) |
| 9 | Silverfin `silverfin` | Silverfin Fillet `silverfin-fillet` | Silverfin Grill `dish-fish-9` | Ground Cinnamon (Herbs & Spices 7) |
| 10 | Rainbow Koi `rainbow-koi` | Rainbow Koi Fillet `rainbow-koi-fillet` | Rainbow Koi Grill `dish-fish-10` | Hulled Wild Rice (Grains 8) |

#### Nuts & Seeds (`nuts-seeds`) → Guts

| *g* | Raw | Crafted | Planet dish | Its side (crafted) |
|---|---|---|---|---|
| 1 | Peanut `peanut` | Peanut Butter `peanut-butter` | Peanut Cookies `dish-nuts-seeds-1` | Apple Preserve (Fruits 1) |
| 2 | Sunflower Seed `sunflower-seed` | Sunflower Oil `sunflower-oil` | Sunflower Seed Cookies `dish-nuts-seeds-2` | Dried Basil (Herbs & Spices 1) |
| 3 | Sesame `sesame` | Sesame Paste `sesame-paste` | Sesame Cookies `dish-nuts-seeds-3` | Carp Fillet (Fish 1) |
| 4 | Walnut `walnut` | Walnut Paste `walnut-paste` | Walnut Cookies `dish-nuts-seeds-4` | Cane Sugar (Sweets 2) |
| 5 | Chestnut `chestnut` | Chestnut Paste `chestnut-paste` | Chestnut Cookies `dish-nuts-seeds-5` | Pearl Barley (Grains 3) |
| 6 | Almond `almond` | Almond Paste `almond-paste` | Almond Cookies `dish-nuts-seeds-6` | Plum Preserve (Fruits 4) |
| 7 | Pistachio `pistachio` | Pistachio Paste `pistachio-paste` | Pistachio Cookies `dish-nuts-seeds-7` | Ground Ginger (Herbs & Spices 5) |
| 8 | Macadamia `macadamia` | Macadamia Butter `macadamia-butter` | Macadamia Cookies `dish-nuts-seeds-8` | Sea Bream Fillet (Fish 6) |
| 9 | Thundernut `thundernut` | Thundernut Oil `thundernut-oil` | Thundernut Cookies `dish-nuts-seeds-9` | Agave Syrup (Sweets 7) |
| 10 | Worldseed `worldseed` | Worldseed Oil `worldseed-oil` | Worldseed Cookies `dish-nuts-seeds-10` | Hulled Wild Rice (Grains 8) |

#### Herbs & Spices (`herbs-spices`) → Wit

| *g* | Raw | Crafted | Planet dish | Its side (crafted) |
|---|---|---|---|---|
| 1 | Basil `basil` | Dried Basil `dried-basil` | Basil Curry `dish-herbs-spices-1` | Carp Fillet (Fish 1) |
| 2 | Mint `mint` | Dried Mint `dried-mint` | Mint Curry `dish-herbs-spices-2` | Honey (Sweets 1) |
| 3 | Rosemary `rosemary` | Dried Rosemary `dried-rosemary` | Rosemary Curry `dish-herbs-spices-3` | Peanut Butter (Nuts & Seeds 1) |
| 4 | Thyme `thyme` | Dried Thyme `dried-thyme` | Thyme Curry `dish-herbs-spices-4` | Pear Preserve (Fruits 2) |
| 5 | Ginger `ginger` | Ground Ginger `ground-ginger` | Ginger Curry `dish-herbs-spices-5` | Pearl Barley (Grains 3) |
| 6 | Peppercorn `peppercorn` | Ground Pepper `ground-pepper` | Peppercorn Curry `dish-herbs-spices-6` | Mackerel Fillet (Fish 4) |
| 7 | Cinnamon `cinnamon` | Ground Cinnamon `ground-cinnamon` | Cinnamon Curry `dish-herbs-spices-7` | Chocolate (Sweets 5) |
| 8 | Saffron `saffron` | Saffron Threads `saffron-threads` | Saffron Curry `dish-herbs-spices-8` | Almond Paste (Nuts & Seeds 6) |
| 9 | Mandrake `mandrake` | Mandrake Powder `mandrake-powder` | Mandrake Curry `dish-herbs-spices-9` | Mango Pulp (Fruits 7) |
| 10 | Phoenix Pepper `phoenix-pepper` | Phoenix Spice `phoenix-spice` | Phoenix Pepper Curry `dish-herbs-spices-10` | Hulled Wild Rice (Grains 8) |

#### Grains (`grains`) → Skill (Friend and Group bonds)

| *g* | Raw | Crafted | Planet dish | Its side (crafted) |
|---|---|---|---|---|
| 1 | Wheat `wheat` | Wheat Flour `wheat-flour` | Wheat Bread `dish-grains-1` | Apple Preserve (Fruits 1) |
| 2 | Oats `oats` | Rolled Oats `rolled-oats` | Oats Bread `dish-grains-2` | Dried Basil (Herbs & Spices 1) |
| 3 | Barley `barley` | Pearl Barley `pearl-barley` | Barley Bread `dish-grains-3` | Carp Fillet (Fish 1) |
| 4 | Rice `rice` | Polished Rice `polished-rice` | Rice Bread `dish-grains-4` | Cane Sugar (Sweets 2) |
| 5 | Corn `corn` | Cornmeal `cornmeal` | Corn Bread `dish-grains-5` | Sesame Paste (Nuts & Seeds 3) |
| 6 | Rye `rye` | Rye Flour `rye-flour` | Rye Bread `dish-grains-6` | Plum Preserve (Fruits 4) |
| 7 | Buckwheat `buckwheat` | Buckwheat Flour `buckwheat-flour` | Buckwheat Bread `dish-grains-7` | Ground Ginger (Herbs & Spices 5) |
| 8 | Wild Rice `wild-rice` | Hulled Wild Rice `hulled-wild-rice` | Wild Rice Bread `dish-grains-8` | Sea Bream Fillet (Fish 6) |
| 9 | Moonrice `moonrice` | Moonrice Flour `moonrice-flour` | Moonrice Bread `dish-grains-9` | Agave Syrup (Sweets 7) |
| 10 | Sunwheat `sunwheat` | Sunwheat Flour `sunwheat-flour` | Sunwheat Bread `dish-grains-10` | Macadamia Butter (Nuts & Seeds 8) |

#### Vegetables (`vegetables`) → Constellation

| *g* | Raw | Crafted | Planet dish | Its side (crafted) |
|---|---|---|---|---|
| 1 | Carrot `carrot` | Chopped Carrot `chopped-carrot` | Carrot Salad `dish-vegetables-1` | Wheat Flour (Grains 1) |
| 2 | Potato `potato` | Diced Potato `diced-potato` | Potato Salad `dish-vegetables-2` | Wheat Flour (Grains 1) |
| 3 | Cabbage `cabbage` | Shredded Cabbage `shredded-cabbage` | Cabbage Salad `dish-vegetables-3` | Wheat Flour (Grains 1) |
| 4 | Onion `onion` | Diced Onion `diced-onion` | Onion Salad `dish-vegetables-4` | Rolled Oats (Grains 2) |
| 5 | Tomato `tomato` | Tomato Purée `tomato-puree` | Tomato Salad `dish-vegetables-5` | Pearl Barley (Grains 3) |
| 6 | Bell Pepper `bell-pepper` | Sliced Bell Pepper `sliced-bell-pepper` | Bell Pepper Salad `dish-vegetables-6` | Polished Rice (Grains 4) |
| 7 | Eggplant `eggplant` | Sliced Eggplant `sliced-eggplant` | Eggplant Salad `dish-vegetables-7` | Cornmeal (Grains 5) |
| 8 | Asparagus `asparagus` | Trimmed Asparagus `trimmed-asparagus` | Asparagus Salad `dish-vegetables-8` | Rye Flour (Grains 6) |
| 9 | Golden Carrot `golden-carrot` | Golden Carrot Purée `golden-carrot-puree` | Golden Carrot Salad `dish-vegetables-9` | Buckwheat Flour (Grains 7) |
| 10 | Emperor Pumpkin `emperor-pumpkin` | Pumpkin Purée `pumpkin-puree` | Emperor Pumpkin Salad `dish-vegetables-10` | Hulled Wild Rice (Grains 8) |

#### Mushrooms (`mushrooms`) → Inspiration

| *g* | Raw | Crafted | Planet dish | Its side (crafted) |
|---|---|---|---|---|
| 1 | Button Mushroom `button-mushroom` | Dried Button Mushroom `dried-button-mushroom` | Button Mushroom Soup `dish-mushrooms-1` | Wheat Flour (Grains 1) |
| 2 | Shiitake `shiitake` | Dried Shiitake `dried-shiitake` | Shiitake Soup `dish-mushrooms-2` | Wheat Flour (Grains 1) |
| 3 | Oyster Mushroom `oyster-mushroom` | Dried Oyster Mushroom `dried-oyster-mushroom` | Oyster Mushroom Soup `dish-mushrooms-3` | Wheat Flour (Grains 1) |
| 4 | Enoki `enoki` | Dried Enoki `dried-enoki` | Enoki Soup `dish-mushrooms-4` | Rolled Oats (Grains 2) |
| 5 | Chanterelle `chanterelle` | Dried Chanterelle `dried-chanterelle` | Chanterelle Soup `dish-mushrooms-5` | Pearl Barley (Grains 3) |
| 6 | Porcini `porcini` | Dried Porcini `dried-porcini` | Porcini Soup `dish-mushrooms-6` | Polished Rice (Grains 4) |
| 7 | Morel `morel` | Dried Morel `dried-morel` | Morel Soup `dish-mushrooms-7` | Cornmeal (Grains 5) |
| 8 | Truffle `truffle` | Shaved Truffle `shaved-truffle` | Truffle Soup `dish-mushrooms-8` | Rye Flour (Grains 6) |
| 9 | Glowcap `glowcap` | Glowcap Powder `glowcap-powder` | Glowcap Soup `dish-mushrooms-9` | Buckwheat Flour (Grains 7) |
| 10 | King Reishi `king-reishi` | Reishi Powder `reishi-powder` | King Reishi Soup `dish-mushrooms-10` | Hulled Wild Rice (Grains 8) |

## 4. Recipes

| Output | Inputs | Where | Time per output |
|---|---|---|---|
| Crafted item, grade *g* | 1 raw item of its pair | Pantry | a quarter of gathering |
| Planet dish, grade *g* | **4 crafted of its family at *g*** + **1 crafted side** of another family at max(1, *g*−2) (README) | Kitchen | 240 + 10(*g*−1) |
| Duo, grade 3 or 5 | **2 + 2 crafted** of its two families at *g* + **1 crafted side** at *g*−2 | Kitchen | same cook formula |
| Feast, grade 4, 6, 8 or 10 | **1 crafted of each of the five stat families** at *g* + **1 Grains** side at *g*−2 | Kitchen | same cook formula |

Every recipe names **exact items**: no substitutions, no "any crafted Fish". A dish pays only an unlock that names its
family and grade (§6); a higher grade doesn't stand in for a lower one, so the planner's counts stay exact.

### 4.1 Why five crafted items for every dish

A planet dish, a Duo and a Feast all buy one unlock worth the same 20 points of build at tier 1 (single +20, Duo
+10/+10, Sun +4 × 5, README). So they cost about the same: a planet and a Duo exactly the same chain, a Feast one
crafted item more (+14%), which keeps it a special dish without making the Sun a chore.

### 4.2 The side rotation

Without a rule for sides, demand follows destinations: Vegetables feed 28 unlocks a tier and Grains only the 2–4
Friend and Group bonds (§7). uma-rpg rotated its sides for the same reason (its D86). Here the sides go where demand
is missing:
1. **Salads and soups come with bread.** Every Vegetables and Mushrooms dish takes a **Grains** side.
2. **Stat dishes rotate through the stat cycle** Fruits → Herbs & Spices → Fish → Sweets → Nuts & Seeds → (Fruits): at
   grades 1 and 6 the side is one family on, at 2 and 7 two on, at 3 and 8 three on, at 4 and 9 four on. At **grades 5
   and 10 the side is Grains**.
3. **Grains dishes** take the stat cycle in order by grade: Fruits, Herbs & Spices, Fish, Sweets, Nuts & Seeds, then
   again.
4. **Duo sides** go to the two stat families that sit in only one Duo: Nuts & Seeds for Stamina–Wit and Wit–Power,
   Fruits for Power–Speed and Speed–Guts.
5. **Feast sides** are Grains.
6. **No dish ever takes a Vegetables or Mushrooms side.** Those two are already the busiest families.

All 80 planet dishes' side families (the side's grade in brackets):

| *g* (side *g*) | Sweets | Fruits | Fish | Nuts & Seeds | Herbs & Spices | Grains | Vegetables | Mushrooms |
|---|---|---|---|---|---|---|---|---|
| 1 (1) | Nuts | Herbs | Sweets | Fruits | Fish | Fruits | Grains | Grains |
| 2 (1) | Fruits | Fish | Nuts | Herbs | Sweets | Herbs | Grains | Grains |
| 3 (1) | Herbs | Sweets | Fruits | Fish | Nuts | Fish | Grains | Grains |
| 4 (2) | Fish | Nuts | Herbs | Sweets | Fruits | Sweets | Grains | Grains |
| 5 (3) | Grains | Grains | Grains | Grains | Grains | Nuts | Grains | Grains |
| 6 (4) | Nuts | Herbs | Sweets | Fruits | Fish | Fruits | Grains | Grains |
| 7 (5) | Fruits | Fish | Nuts | Herbs | Sweets | Herbs | Grains | Grains |
| 8 (6) | Herbs | Sweets | Fruits | Fish | Nuts | Fish | Grains | Grains |
| 9 (7) | Fish | Nuts | Herbs | Sweets | Fruits | Sweets | Grains | Grains |
| 10 (8) | Grains | Grains | Grains | Grains | Grains | Nuts | Grains | Grains |

The exact side item is in each family's table in §3.

### 4.3 Duos

Four stat Duos, each at grade 3 (scenario 2) and grade 5 (scenario 3), for the Gym's Duo nodes ([05](05-training-hub.md)).
Grade 3 uses uma-art's grade-3 frame and name; grade 5 uses its grade-7 **Deluxe** frame and name.

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

Duo ids are this game's own because a grade-5 dish drawn with a `-7` frame would mislead anyone reading the id. Every
other dish id is uma-art's frame id.

### 4.4 Feasts

One per scenario from scenario 2, for the Gym's Sun nodes. A Sun gives all five stats, so a Feast takes one of each
stat family, with bread.

| Id | Name | Grade | Recipe |
|---|---|---|---|
| `feast-4` | Spring Feast | 4 | Maple Syrup, Plum Preserve, Mackerel Fillet, Walnut Paste, Dried Thyme + Rolled Oats |
| `feast-6` | Summer Feast | 6 | Vanilla Extract, Grape Jelly, Sea Bream Fillet, Almond Paste, Ground Pepper + Polished Rice |
| `feast-8` | Harvest Feast | 8 | Palm Sugar, Pomegranate Molasses, Tuna Fillet, Macadamia Butter, Saffron Threads + Rye Flour |
| `feast-10` | Grand Feast | 10 | Ambrosia, Golden Apple Preserve, Rainbow Koi Fillet, Worldseed Oil, Phoenix Spice + Hulled Wild Rice |

## 5. Work and Farm EXP per dish

The §3 ladder in totals. All planet dishes of a grade cost the same whatever their family or side family.

| Dish | Crafted inputs | Gathering | Crafting | Cooking | **Whole chain = Farm EXP** | With its session ([05](05-training-hub.md)) |
|---|---|---|---|---|---|---|
| Planet, grade 1 | 4 + 1 | 450 | 112.5 | 240 | **802.5** | 982.5 (16.4 h) |
| Planet, grade 4 | 4 + 1 at *g* 2 | 515 | 128.75 | 270 | **913.75** | 1,138.75 (19.0 h) |
| Planet, grade 10 | 4 + 1 at *g* 8 | 665 | 166.25 | 330 | **1,161.25** | 1,476.25 (24.6 h) |
| Duo, grade 3 | 2 + 2 + 1 at *g* 1 | 490 | 122.5 | 260 | **872.5** | 1,082.5 (18.0 h) |
| Duo, grade 5 | 2 + 2 + 1 at *g* 3 | 540 | 135 | 280 | **955** | 1,195 (19.9 h) |
| Feast, grade 4 | 5 + 1 at *g* 2 | 620 | 155 | 270 | **1,045** | 1,270 (21.2 h) |
| Feast, grade 10 | 5 + 1 at *g* 8 | 800 | 200 | 330 | **1,330** | 1,645 (27.4 h) |

Every other grade is in the §3 ladder. Gathering is 56% of a chain, crafting 14% and cooking 30%, which is why the
Kitchen is the busiest building ([07](07-farm.md) §6).

## 6. Which unlock takes which dish

[05](05-training-hub.md) and [06](06-cards-and-bonds.md) own the exact cost of each unlock. The default, used for the
demand counts below: a scenario layer's first half takes grade 2*s*−1 and its second half grade 2*s* (README).

| Unlock | Dish |
|---|---|
| A constellation node | Vegetables planet dish of the layer's grade |
| An Inspiration slot or gold skill | Mushrooms planet dish |
| An Extra Stats single node (stat, grade *g*) | That stat's family planet dish at *g* |
| A Duo node | Its Duo at grade 3 or 5 |
| A Sun node | The Feast of its grade (4, 6, 8, 10) |
| A card bond | Its type's family: Speed → Sweets … Wit → Herbs & Spices; Friend and Group → Grains. The grade follows the layer, unless [06](06-cards-and-bonds.md) ties it to the card's era |

## 7. Demand over a tier

One Uma's tier is **126 unlocks** (README): 28 constellation nodes, 18 Inspiration, 50 Extra Stats singles, 8 Duos, 4
Suns and 18 bonds. Bonds depend on her deck; the **representative deck** here has 3 bonds of each type (Speed,
Stamina, Power, Guts, Wit, Friend/Group).

### Planet dishes, per Uma per tier

| Family | *g*1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | Total |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Vegetables | 6 | 6 | 2 | 2 | 2 | 2 | 2 | 2 | 2 | 2 | **28** |
| Mushrooms | 1 | 1 | 2 | 2 | 2 | 2 | 2 | 2 | 2 | 2 | **18** |
| Sweets | 2 | 1 | 2 | 1 | 1 | 1 | 2 | 1 | 1 | 1 | **13** |
| Fruits | 2 | 1 | 2 | 1 | 1 | 1 | 2 | 1 | 1 | 1 | **13** |
| Fish | 2 | 1 | 1 | 2 | 1 | 1 | 1 | 2 | 1 | 1 | **13** |
| Nuts & Seeds | 1 | 2 | 1 | 1 | 2 | 1 | 1 | 1 | 2 | 1 | **13** |
| Herbs & Spices | 1 | 2 | 1 | 1 | 1 | 2 | 1 | 1 | 1 | 2 | **13** |
| Grains | 0 | 1 | 0 | 0 | 0 | 1 | 0 | 0 | 0 | 1 | **3** |
| Duos | | | 4 | | 4 | | | | | | **8** |
| Feasts | | | | 1 | | 1 | | 1 | | 1 | **4** |
| **All** | | | | | | | | | | | **126** |

### Crafted items, per Uma per tier

| Family | *g*1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | **Total** | Own dishes, Duos, Feasts | Sides |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Vegetables | 24 | 24 | 8 | 8 | 8 | 8 | 8 | 8 | 8 | 8 | **112** | 112 | 0 |
| Herbs & Spices | 11 | 10 | 8 | 6 | 9 | 10 | 5 | 5 | 4 | 9 | **77** | 64 | 13 |
| Sweets | 14 | 5 | 12 | 6 | 9 | 6 | 10 | 5 | 4 | 5 | **76** | 64 | 12 |
| Fruits | 13 | 5 | 12 | 7 | 8 | 7 | 9 | 5 | 4 | 5 | **75** | 60 | 15 |
| Fish | 11 | 5 | 8 | 11 | 10 | 6 | 5 | 9 | 4 | 5 | **74** | 64 | 10 |
| Nuts & Seeds | 10 | 9 | 8 | 6 | 11 | 6 | 5 | 6 | 8 | 5 | **74** | 60 | 14 |
| Grains | 18 | 9 | 10 | 5 | 4 | 9 | 4 | 11 | 0 | 4 | **74** | 12 | 62 |
| Mushrooms | 4 | 4 | 8 | 8 | 8 | 8 | 8 | 8 | 8 | 8 | **72** | 72 | 0 |
| **All** | | | | | | | | | | | **634** | 508 | 126 |

**What the rotation does.** With the obvious rule, "the side is the next family on the ring", Mushrooms would need
100 a tier and Grains 37: a 3× spread between the busiest and the idlest site. With §4.2's rotation, seven families
land between 72 and 77. Grains goes from the coldest family to an ordinary one: 62 of the tier's 126 sides are bread.

**The flag: Vegetables.** At 112 a tier Vegetables is 1.5× any other family, and in scenario 1, where 12 of 30
unlocks are constellation nodes, it is **32% of all crafted demand** (48 of 150). Sides can't fix it: they only add
demand, and none goes to Vegetables. It is handled where it lands:
- the **Vegetable Garden has more slots** than the other sites (4 → 5, [07](07-farm.md) §6);
- the **Exchange sells raw Vegetables** for Prize Money ([09](09-racing-rewards-and-exchange.md)), a relief valve in a
  tight week;
- if the sim still shows scenario 1 waiting on Vegetables, the lever is [05](05-training-hub.md)'s scenario-1 tree size
  (12 nodes), not the recipes.

**By scenario.** Shares of crafted demand per scenario of the tier:

| Scenario | Crafted items | Vegetables | Mushrooms | Grains | Each stat family |
|---|---|---|---|---|---|
| 1 | 150 | 32% | 5% | 12% | 9–11% |
| 2 | 131 | 12% | 12% | 7% | 11–15% |
| 3 | 131 | 12% | 12% | 15% | 11–14% |
| 4 | 111 | 14% | 14% | 8% | 10–15% |
| 5 | 111 | 14% | 14% | 17% | 9–14% |

**Other decks.** A Speed-heavy deck (6 Speed, 1 Guts, 2 Friend/Group bonds) moves about 12 crafted items a tier from
Nuts & Seeds and Grains to Sweets: 2% of the tier's 634. A grade-9 Grains item (Moonrice Flour) is needed only when a
Friend or Group bond falls at grade 9; the Warehouse simply holds none until then.

## 8. Work values, for selling

An item's **work value** is the listed minutes of the work in it. Selling pays **a third** of it in Prize Money
(D331); [09](09-racing-rewards-and-exchange.md) owns rounding and the Exchange's buy prices.

| *g* | Raw | Crafted | Planet or Duo dish | Feast | A third: raw / crafted / dish |
|---|---|---|---|---|---|
| 1 | 90 | 112.5 | 802.5 | | 30 / 37.5 / 267.5 |
| 2 | 95 | 118.75 | 837.5 | | 31.7 / 39.6 / 279.2 |
| 3 | 100 | 125 | 872.5 | | 33.3 / 41.7 / 290.8 |
| 4 | 105 | 131.25 | 913.75 | 1,045 | 35 / 43.8 / 304.6 (Feast 348.3) |
| 5 | 110 | 137.5 | 955 | | 36.7 / 45.8 / 318.3 |
| 6 | 115 | 143.75 | 996.25 | 1,140 | 38.3 / 47.9 / 332.1 (Feast 380) |
| 7 | 120 | 150 | 1,037.5 | | 40 / 50 / 345.8 |
| 8 | 125 | 156.25 | 1,078.75 | 1,235 | 41.7 / 52.1 / 359.6 (Feast 411.7) |
| 9 | 130 | 162.5 | 1,120 | | 43.3 / 54.2 / 373.3 |
| 10 | 135 | 168.75 | 1,161.25 | 1,330 | 45 / 56.3 / 387.1 (Feast 443.3) |

The value is the same for every family at a grade. Building speed and Speed Tickets don't change it.

## 9. Other items and currencies

| Thing | Kind | Rules |
|---|---|---|
| **Speed Ticket** (`speed-ticket`) | An item in the Warehouse | Bought at the Exchange for 30 Prize Money; takes 30 minutes off one running job or session ([07](07-farm.md) §8, [09](09-racing-rewards-and-exchange.md)). Today's Energy, renamed. uma-art has no ticket icon: a new one is on [11](11-hub-and-places.md)'s art list |
| **Uma Ticket** | A profile currency, not an item | Tier 1 only: 20 at the start, the Exchange, one per promotion ([04](04-tiers-and-promotion.md)) |
| **Prize Money** | A profile currency | Races and sales ([09](09-racing-rewards-and-exchange.md)) |

There are **no** tokens of any kind, no Energy, no Puzzle materials, no Training Tickets, no Card Coupons and no RPG
items ([13](13-removals-and-plan-changes.md)).

## 10. Ids, names and art

- **Ids** are explicit, stable keys in the domain catalogue, never derived from a display name. Raw, crafted, planet
  and Feast ids equal their uma-art frame ids; Duos map to a frame (§4.3); `speed-ticket` maps to the new icon.
- **One definition** per item: id, kind (raw, crafted, dish, ticket), family, grade, dish kind (planet, Duo, Feast),
  destination, name and art frame. [07](07-farm.md)'s screens and the Warehouse read nothing else.
- **Names** are uma-rpg's, kept as they are. They're food, they read well beside a racing game, and uma-art draws them.
  Grades 9 and 10 keep their fanciful names (Moonrice, Starpeach, Thundernut, Phoenix Pepper): they mark the
  legendary grades, as the glints do.
- **On screen** a dish shows its destination beside its name: "Carrot Salad · Constellation · grade 1".
- **Art:** `items/atlas.png` (32 × 32, ten grades across, one row per family side), `dishes/atlas.png` (one row per
  family, then Duos and Feasts). Uses 160 of 320 item frames and 92 of 100 dish frames.

## 11. What this replaces

Today's catalogue (M031, D304): 490 raw and 630 processed definitions across 14 scenario flavour rows, 48 meals (16
signatures × 3 blocks) and Energy, 1,169 in all, drawn as original SVG marks. All of it goes with today's Farm
([07](07-farm.md) §13, [13](13-removals-and-plan-changes.md)). The Speed Ticket replaces Energy.

## 12. Decided here

| Choice | Why |
|---|---|
| **Feast = one crafted of each stat family at *g* + a Grains side** | A Sun feeds the five stats; six inputs keep it within 14% of a planet dish; it adds nothing to the busiest families |
| **Duo = 2 + 2 of its families at *g* + one side** | The same chain as a planet dish for the same 20 points |
| **Side rotation** (§4.2): Grains for salads, soups and Feasts; stat dishes around the stat cycle with Grains at grades 5 and 10; Duo sides to Fruits and Nuts & Seeds | Seven families within 72–77 a tier, instead of a 3× spread |
| **No side is ever Vegetables or Mushrooms** | They are the destination-heavy families |
| **Every dish uses the same cook formula** | One rule; the Feast's extra input is its only premium |
| **Exact recipes, exact dishes**: no substitutions, no higher grade for a lower | The planner's counts stay exact, and every Repeat is predictable |
| **Duo ids `duo-<stat>-<stat>-<g>`**, drawn with uma-art's grade-3 and grade-7 frames | A grade-5 dish should not carry a `-7` id |
| **Keep uma-rpg's names; "crafted" on screen, `refined` in data** | No renaming drift from the art package |
| **Representative deck: 3 bonds of each type** | A neutral basis for the balance; other decks move ~2% |
| **Work value = listed minutes; selling a third** | One number per item for [09](09-racing-rewards-and-exchange.md), independent of speed |

## 13. Done when

- The domain catalogue holds exactly 253 definitions: 80 raw, 80 crafted, 80 planet dishes, 8 Duos, 4 Feasts and
  the Speed Ticket. A test checks every id against uma-art's `items` and `dishes` indexes (the Duos through their frame
  map) and that no gathering-side id appears.
- A test pins every recipe: four of the family plus the §4.2 side for each planet dish, the §4.3 Duos and §4.4 Feasts,
  no side from Vegetables or Mushrooms, no side of the dish's own family.
- A test computes §7's tables from the layer definitions and the representative deck, and fails if any family other
  than Vegetables leaves 70–80 crafted items a tier.
- `pnpm sim:loop` reports Warehouse stock by family and grade over a tier, and no site is the bottleneck for more than
  [12](12-economy-and-pacing.md) §12's tolerance.
- The live manual (`docs/game/`) renders §3's family tables and §4's matrix from the domain constants.
- In the app, every item, dish and the Speed Ticket shows its icon, name, grade and destination, at 32 × 32 and its
  whole-number scales.
