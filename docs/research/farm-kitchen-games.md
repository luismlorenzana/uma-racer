# Farm production and cooking — research notes

**Researched 2026-10-08.** Planning for the owner's new [Farm/cooking definition](../design/farm-kitchen-rework.md).
This supplements the earlier [farming comparison](farming-games.md); it does not change shipped rules.
Only primary/developer sources are used below. No source art, extracted rows or recipe dataset was imported.

## Closest references

| Reference | Verified mechanics | What fits Uma Farm | What not to carry over |
|---|---|---|---|
| Hay Day | Production buildings have queue slots and earn building mastery through operating time | Legible raw → processed → finished chain; visible mastery/time improvements | Coins/building purchases, paid queue expansion; our mastery belongs to outfits, not buildings |
| Story of Seasons: Grand Bazaar | Windmills process materials through timed production lines; kitchen uses a recipe book and permits recipe adjustments | Clear processing stations, explicit recipe inputs, a cookbook and bounded substitutions | Mandatory seasonal scheduling, daily animal/plant care, added ingredient quality as a stat multiplier |
| Farm Together 2 | Crops, trees and animals; time advances while absent; house activities include cooking recipes | Three distinct raw districts, cozy persistent assignments and offline deadlines | Terraforming/expansion economy and extra decoration systems before the reward loop works |
| Stardew Valley | Farming, orchards, animals, processing machines, skill progress and cooking recipes | Long-lived crew progress, planning raw stock versus processed stock, collection goals | A chores/energy tax, temporary food buffs replacing the owner's permanent Extra Stats purchases |
| Cooking Mama: Cuisine! / Let's cook! | Ingredient/tool choices, cooking minigames, a recorded cookbook; the latter also has fields and ranch gathering | Finished-dish identity, cookbook completion and optional tactile preparation presentation | Required gesture scores, burned/lost meals, ads or making every asynchronous claim another minigame |

Sources:

- [Supercell: Hay Day production buildings](https://support.supercell.com/hay-day/en/articles/production-building.html).
  The building's three mastery stars are distinct from Uma Farm's proposed five per-outfit district ranks.
- [Marvelous: Grand Bazaar official Farm Life manual](https://www.storyofseasons.com/grandbazaar/manuals/xbox/01/).
  Its cooking and processing sections support the recipe-book/ingredient-adjustment distinction.
- [Milkstone Studios: Farm Together 2](https://www.milkstonestudios.com/games/farm-together-2/).
  The developer explicitly describes absent-time progression and cooking activities.
- [ConcernedApe: Stardew Valley About](https://www.stardewvalley.net/about/).
  This is a broad systems comparison, not evidence for any particular machine duration or recipe cost.
- [Office Create: Cooking Mama Cuisine developer listing](https://apps.apple.com/us/app/cooking-mama-cuisine/id1563901930)
  and [Let's cook! developer listing](https://play.google.com/store/apps/details?hl=en-US&id=jp.co.ofcr.cm00).
  The developer descriptions, not user reviews, support the cooking/cookbook observations.

## Recommendation

**Hay Day's readable supply chain + Grand Bazaar's cookbook is the strongest structural fit.** Farm Together 2
contributes the asynchronous/no-pressure tone. Cooking Mama is a presentation reference, not a requirement to
play thirty short gesture games whenever the farm is ready. Stardew is useful for the pleasure of planning and
completing a collection, but its day-to-day chores are not needed here. These are design inferences from the
sources, not claims that those games implement the Uma outfit/Extra Stats system.

For this app, the interesting decisions are where to station each persistent worker, which expertise to grow,
which recipes support a weak racing stat, and whether to specialize or broaden the active Extra Stats map.
Better timers and clear shopping tools offer more value than random crop rarity, equipment durability or loss
on absence. The owner's entirely open farm already supplies the expansion fantasy through **crew development**,
so an aggregate account Farm Level is unnecessary.

## Small additions worth carrying into the draft

1. **Meal wishlist and shopping plan.** Pin meals, show exactly which inputs are short, and link to the right
   district. Running outputs are shown separately from spendable stock.
2. **Visible outfit specialization.** Five expertise meters, recorded per ingredient block, with exact next-rank
   progress and resulting duration. Do not randomly assign an innate farming aptitude.
3. **Recipe identity and permitted substitutions.** Same-stat raw/processed variants can add variety without
   doubling the recipe tree. Explain Guts meals through hearty Stamina/Power combinations.
4. **Cookbook completion.** First-preparation records and clear finished-item art give collection satisfaction
   without a new currency or hidden recipe lottery.
5. **Optional preparation flourish.** Short plating/chopping/stirring visuals and reduced-motion equivalents;
   a future hands-on practice can be cosmetic, never compulsory for yield or timing.

Defer seasons/weather, feed/fertilizer, cooking grades, restaurants/customers, decoration purchases, breeding,
multi-step automatic queues and a separate farm inventory. Each would create another balance/sync surface
before the ingredient → meal → Extra Stats chain is proven.

## Catalogue arithmetic witness

The draft's **own original recipes**, not any source game's recipes, were totaled with a small in-memory
JavaScript calculation. For 10 of each pure meal, 1 of each pair meal and 5 banquets:

| Processed family | Meal demand | Processing jobs (2 output/job) |
|---|---|---|
| Mayonnaise | 10 | 5 |
| Canned banana | 11 | 6 |
| Ham | 31 | 16 |
| Cheese | 19 | 10 |
| Canned potato | 2 | 1 |
| Canned spinach | 5 | 3 |
| Total | 78 | **41** |

| Raw family | Direct food + rounded processing inputs | Harvest jobs (4 output/job) |
|---|---|---|
| Carrot | 17 | 5 |
| Potato | 26 | 7 |
| Chicken | 11 | 3 |
| Berry | 10 | 3 |
| Egg | 11 | 3 |
| Apple | 1 | 1 |
| Banana | 18 | 5 |
| Beef | 1 | 1 |
| Pork | 32 | 8 |
| Milk | 20 | 5 |
| Spinach | 6 | 2 |
| Total | 153 | **43** |

Thus 43 raw + 41 processing + 65 cooking = **149 claims**, versus 196 claims for Lv1 → Lv50 at 48 EXP/level and
12 EXP/claim. This checks ingredient conservation and batch rounding for one canonical bill only. It is not
a simulator, a real-account probe or evidence that the racing stat balance is settled. District raw counts
are Garden 14, Orchard 9 and Barnyard 20. Applying the candidate expertise schedule to those counts, Workshop 41
and Kitchen 65 yields a no-idle duration sum of **955 hours**; dependencies/gates/check-in cadence still matter.

## Assets and evidence boundaries

Take inspiration from these mechanics, not their art or extracted assets. Reuse the existing private verified
Uma portraits/chibis and author original SVG food/district/Energy icons. No extra external dataset is needed
to release the baseline. Names and stat tags in the definition are game-design choices, not nutrition advice.

Actual production-account content and saves were not read for this research. Phone layouts, stock transactions,
timed progression and racing-stat distributions still need implementation-time synthetic proof, followed by
the owner's real-device acceptance. This research does not authorize the requested future reset now.
