# T126 — Items and recipes

**M033 · first wave, parallel with T125 and T129 · not started.** One pull request (or commit series), green before
T127, T128 and T130 build on it.

Read:
- [AGENTS.md](../../AGENTS.md) and [M033](M033-rework-rules.md), whose fixed choices bind this task.
- The rework [README](../rework/README.md), all of [rework/08](../rework/08-item-catalogue-and-recipes.md),
  [rework/07](../rework/07-farm.md) §1–§4 and [rework/12](../rework/12-economy-and-pacing.md) §2–§4.
- Decisions D330, D331, D336 and D338.
- Read-only, for ids and names: uma-platform `packages/art` 2.4.0 (README, `items/atlas.json`, `dishes/atlas.json`) and
  uma-rpg `packages/domain/src/items/{families,catalog}.ts` and `economy/{dishes,dish-id}.ts` (farming half only).

## Goal and fixed scope

The rework's whole Farm catalogue as pure data, with recipes, grade gates and work values. Nothing live changes, and
today's `farm/` catalogue is not touched.

| Deliverable | Source |
|---|---|
| **8 families**: id, name, destination and planet-dish style, in 08 §2's order (Sweets, Fruits, Fish, Nuts & Seeds, Herbs & Spices, Grains, Vegetables, Mushrooms); the ring and the stat cycle | README, 08 §2, §4.2, D330 |
| **160 raw and crafted items**: 8 families × 10 grades of each, with uma-art's ids and names, each raw paired with its crafted form | 08 §1, §3 |
| **80 planet dishes, 8 Duos, 4 Feasts and the Speed Ticket**: 253 definitions in all | 08 §1, §3, §4.3, §4.4, §9 |
| **Recipes**, exact items only. Crafted: 1 raw of its pair (Pantry). Planet: 4 crafted of its family at *g* + 1 crafted side at max(1, *g*−2). Duo: 2 + 2 crafted of its families at *g* + 1 side at *g*−2. Feast: 1 crafted of each stat family at *g* + 1 Grains side at *g*−2. Dishes cook at the Kitchen | 08 §4, §12 |
| **The side rotation**: 08 §4.2's rules 1–6 and its 80-cell table | 08 §4.2 |
| **Grade gates**: grade *g* opens at Farm Lv 5*g* − 4 (1, 6 … 46) | README, 07 §4, D330 |
| **Step times** in base minutes: gather 90 + 5(*g*−1), craft a quarter of that, cook 240 + 10(*g*−1) for every dish kind | README, 08 §3, 12 §4 |
| **Work values** in real time: base minutes × the time factor, inputs included | 08 §8, D338 |
| **Crafted demand**: any dish counts expanded through the recipes, checked on 08 §7's representative tier | 08 §7 |
| **The uma-art check**, with `@luismlorenzana/uma-art` **2.4.0** as an exact-pinned devDependency of `@racer/domain` | M033, 08 §10, §13 |

## Implementation contract

**Modules** live in `packages/domain/src/rework/items/`, each with a header comment linking rework/08. The area's
`index.ts` is what `@racer/domain/rework/items` resolves to under T125's `./rework/*` export.

| Module | Exports |
|---|---|
| `families.ts` | `FamilyId`, `FAMILY_IDS`, `FAMILIES` (`{ id, name, destination, dishStyle }`), `FAMILY_RING` (08 §2), `STAT_CYCLE` (Fruits → Herbs & Spices → Fish → Sweets → Nuts & Seeds, 08 §4.2), `familyFor(destination)` |
| `catalogue.ts` | `ItemGrade` (1–10), `ITEM_GRADES = 10`, `ItemDef`, `ITEMS`, `itemById(id)`, `rawItem(family, g)`, `craftedItem(family, g)`, `planetDish(family, g)`, `DUO_GRADES = [3, 5]`, `FEAST_GRADES = [4, 6, 8, 10]`, `SPEED_TICKET_ID = 'speed-ticket'` |
| `recipes.ts` | `Recipe = { at: 'pantry' \| 'kitchen'; inputs: readonly { item: ItemId; qty: number }[] }`, `recipeOf(id)`, `sideFamily(family, g)`, `DUO_SIDE_FAMILY` |
| `grades.ts` | `gradeOpensAtFarmLevel(g) = 5g − 4`, `highestOpenGrade(farmLevel) = min(10, ⌊(farmLevel + 4) / 5⌋)`, `canWorkGrade(farmLevel, g)` |
| `work.ts` | `gatherBaseMinutes`, `craftBaseMinutes`, `cookBaseMinutes`, `gatherSeconds`, `craftSeconds`, `cookSeconds` (each of `g`), `workValueBaseMinutes(id)`, `workValueSeconds(id)` |
| `demand.ts` | `craftedDemand(dishCounts)` |

**Types.** `ItemDef` is a union on `kind`, so each kind carries only its own fields (08 §10's "one definition"):
- `raw` and `crafted`: `id`, `name`, `family`, `grade`, `refined` (uma-art's flag) and `pair` (the other form's id);
- `dish`, with `dish: 'planet'` (`family`, `grade`, the family's `destination`), `dish: 'duo'` (`grade` 3 or 5,
  `families`, and `stats` in the stat row's order) or `dish: 'feast'` (`grade` 4, 6, 8 or 10, `destination: 'sun'`);
- `ticket`: the Speed Ticket only.

Every kind has `art: { atlas: 'items' | 'dishes'; frame: string } | null`; only the Speed Ticket has `null` (uma-art
draws no ticket, 08 §9). `Destination` is a `StatKey` (today's `types.ts`) or `'skill' | 'constellation' |
'inspiration'`. The item grade is `ItemGrade`, never today's `Grade`, which is the aptitude letter.

**Data rules:**
- **Ids** of raw, crafted, planet and Feast items equal their uma-art frame ids. Duo ids are `duo-<stat>-<stat>-<g>`
  (`duo-stamina-wit-3` …), each naming its frame (`duo-mp-matk-3`, or `-7` at grade 5, 08 §4.3). Ids are data, never
  derived from a display name.
- **Names** are uma-rpg's, written as data like its `FAMILY_SPECS` (generated once, then frozen). Nothing reads uma-art
  at run time.
- **Order.** `ITEMS` is per family in `FAMILY_IDS` order (raw 1–10, then crafted 1–10), then planet dishes by family and
  grade, the Duos in 08 §4.3's order, the Feasts by grade, and the Speed Ticket last.
- **Lookups.** All data is frozen. `itemById` and `recipeOf` return `undefined` for an unknown id. `recipeOf` is `null`
  for raw items (gathered at their family's site, which T127 owns) and the ticket. There are no operations here.

**Sides.** `sideFamily(family, g)` is 08 §4.2 for planet dishes. Vegetables and Mushrooms take Grains. A stat family
takes Grains at grades 5 and 10, and otherwise the family ((*g* − 1) mod 5) + 1 steps on in `STAT_CYCLE`. Grains takes
`STAT_CYCLE[(g − 1) mod 5]`. `DUO_SIDE_FAMILY` gives Nuts & Seeds for Stamina–Wit and Wit–Power and Fruits for
Power–Speed and Speed–Guts. Feasts take Grains. The side is always that family's crafted item at max(1, *g*−2).

**Time and work.** Durations are integer seconds: each step's base minutes go through `rework/time.ts`'s one conversion
(× `TIME_FACTOR` × 60, rounded once, at speed 1). Nothing here multiplies by 1.2, and building speed is T127's.
`workValueSeconds` walks the recipe: raw = `gatherSeconds(g)`; crafted = its raw + `craftSeconds(g)`; dish = Σ qty ×
input + `cookSeconds(g)`; the ticket is `null`. Real minutes are seconds ÷ 60 and can end in .5 (142.5).
`workValueBaseMinutes` is the same walk in base minutes, for 08 §3's tables. Nothing here rounds a work value: rounding
a sale is T130's. (The names avoid T127's `workSeconds(baseMinutes, speed)` in `rework/time.ts`.)

**Demand.** `craftedDemand(counts)` expands any dish counts into crafted items through the recipes, and splits each
family into own-recipe use and side use. T128 and T132 feed it the dishes their layers and decks ask for.

**Imports.** `TIME_FACTOR` and its conversion from `rework/time.ts` (T125); `StatKey` and `STATS` from today's
`types.ts`; nothing else outside `rework/items/`. Only the test imports uma-art, so it never reaches the CJS build.

## Tests

Co-located `rework/items/*.test.ts`. Expected values are literal tables copied from rework/08, never recomputed by the
code under test.
- **Catalogue:** 253 unique definitions (80 raw, 80 crafted, 80 planet, 8 Duos, 4 Feasts, 1 ticket); 10 raw and 10
  crafted per family, 160 in all; mutual pairs of the same family and grade; every name as 08 §3, §4.3 and §4.4 give it.
- **uma-art check** (`art.test.ts`, reading the installed `items/atlas.json` and `dishes/atlas.json`):
  - raw and crafted ids are `items` frames on the `farming` side with the same family, grade, `refined` flag and name;
  - planet and Feast ids are `dishes` frames with the same kind, grade, family (planets) and name;
  - each Duo's frame is a `duo` frame of grade 3 (grade 3) or 7 (grade 5) with the Duo's name;
  - exactly 160 of 320 item frames and 92 of 100 dish frames are used; the 8 unused dish frames are the
    `duo-hp-def`, `duo-def-mdef`, `duo-mdef-mp` and `duo-limit-hp` pairs (08 §2);
  - no gathering-side id appears, the ticket is the only entry without a frame, and the `effect` field is never read.
- **Recipes:** each planet dish is 4 of its own crafted item plus 1 side; side families equal 08 §4.2's 80 cells and
  side items equal 08 §3's "Its side" column; Duos and Feasts equal 08 §4.3 and §4.4 item for item; no side is
  Vegetables, Mushrooms or the dish's own family; every input is crafted; the four Duos are exactly the stat-family
  neighbours on `FAMILY_RING`, so Guts–Stamina has none.
- **Gates:** `gradeOpensAtFarmLevel` gives 1, 6 … 46; `highestOpenGrade` gives 1 at Lv 1 and 5, 2 at Lv 6, 9 at Lv 45,
  and 10 at Lv 46 and 50.
- **Work in base minutes (08 §3):** gather 90 … 135, craft 22.5 … 33.75, one crafted item 112.5 … 168.75, cook
  240 … 330, a planet or Duo chain 802.5 … 1,161.25, and Feast chains 1,045, 1,140, 1,235 and 1,330.
- **Work in real minutes (08 §8):** raw 108 … 162, crafted 135 … 202.5, planet or Duo 963 … 1,393.5, and Feasts 1,254,
  1,368, 1,482 and 1,596. Every value is whole seconds; all families cost the same at a grade; a Duo costs the same as
  a planet dish of its grade.
- **Demand (08 §7):** a fixture copies §7's planet-dish table for the representative deck (107 dishes: 28 Vegetables,
  24 Mushrooms, 8 per stat family, 3 Grains, 8 Duos, 4 Feasts). `craftedDemand` of it matches §7's crafted table cell
  for cell: 539 items, 432 own and 107 sides, with each family's split (Grains 12 own + 63 sides).

## Live blocks

New `packages/domain/src/docs/render.ts` keys, all in rework/08. Keys must match `[a-z-]+`, the docs check's pattern.

| Key | Section of rework/08 |
|---|---|
| `item-catalogue` | §1, the counts table |
| `item-ladder` | §3, the grade ladder (Farm Lv, base minutes, chains) |
| `items-sweets`, `items-fruits`, `items-fish`, `items-nuts-seeds`, `items-herbs-spices`, `items-grains`, `items-vegetables`, `items-mushrooms` | §3, each family's table |
| `dish-sides`, `duo-recipes`, `feast-recipes` | §4.2, §4.3 and §4.4 |
| `work-values` | §8 |

§5 quotes session minutes (T128's), and §7's tables come from the layers and the deck, which T132 renders from its run.

The first `pnpm docs:update` after placing the markers may change formatting (alignment, bold totals) but no number,
id or name. A changed number means the page was wrong: report it, don't change the rule.

## Acceptance

- [ ] `rework/items/` exports the 253 definitions, recipes, gates and work values, and every test above passes.
- [ ] `packages/domain/package.json` pins `"@luismlorenzana/uma-art": "2.4.0"` in `devDependencies`, the lockfile is
  updated, and `docs/game/architecture.md`'s `dependencies` block is regenerated.
- [ ] The art check passes locally and in CI (installed with `NODE_AUTH_TOKEN`, as uma-data is, D337).
- [ ] rework/08 carries the live blocks above, and the docs check passes over `docs/rework/`.
- [ ] `pnpm lint && pnpm test && pnpm build` stay green and the 180 KB startup budget holds.
- [ ] Every existing test and sim gives the same output, and `git grep "rework/" apps` finds nothing.
- [ ] The choices below go into 08 §12 with one decisions.md entry, and this spec is deleted (D104).

## Out of scope

- Jobs, queues, slots, building speed, Speed Ticket use, Farm EXP, and the family → site and → aptitude maps: T127.
- Which unlock takes which dish at what grade, sessions, and 08 §5's "With its session" column: T128.
- 08 §7's tables, derived from the layers and a deck, and stock over time: T132.
- Prices, selling and the Speed Ticket's price: T130. Icons on screen and the ticket's new icon: phase 3 and rework/11.
- Any change to a number in rework/08.

## Decided here

1. **`rework/time.ts` and the docs check.** M033 gives T126 no dependency, yet `TIME_FACTOR` is in T125's
   `rework/time.ts`, and T125 extends the docs check to `docs/rework/`. If T126 lands first, it adds both exactly as
   M033 states, and T125 builds on them.
2. **§7 is checked here, owned by T132.** §7's dish counts come from the layers and the deck, which T126 doesn't have,
   and M033 has T132 rewrite 08's Farm tables from its run (T128's draft finds §7's bond grades can't all come from
   06's era rule). So T126 exports no demand constant and renders no §7 block. Its test checks only that the recipes
   turn §7's dish table into §7's crafted table. 08 §13's "from the layer definitions" lands in T132.
3. **Step times and grade gates live here.** 07 §2, §4 and 08 §3 all state them. Work values need them and T126 is
   upstream, so T126 owns them, and T127 imports them (rather than its own `farm/minutes.ts` and `level.ts` copies) and
   divides by building speed.
4. **08 §8's "A third" column** renders as work value ÷ 3 in `render.ts` (D331), since the sell rule comes later in
   T130, which then replaces the literal with its constant.
