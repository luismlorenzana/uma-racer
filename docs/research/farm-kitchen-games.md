# Farm production and cooking — research notes

**Researched 2026-10-08.** Planning for the owner's new [Farm/cooking definition](../design/farm-kitchen-rework.md).
This supplements the earlier [farming comparison](farming-games.md); it does not change shipped rules.
Only primary/developer sources are used below. No source art, extracted rows or recipe dataset was imported.

## Closest references

| Reference | Verified mechanics | What fits Uma Farm | What not to carry over |
|---|---|---|---|
| Hay Day | Production buildings have queue slots and earn building mastery through operating time | Legible raw → processed → finished chain, clear queues/output | Coins/building purchases, paid queue expansion and a mandatory mastery rotation loop |
| Story of Seasons: Grand Bazaar | Windmills process materials through timed production lines; kitchen uses a recipe book and permits recipe adjustments | Clear processing stations, explicit recipe inputs, a cookbook and bounded substitutions | Mandatory seasonal scheduling, daily animal/plant care, added ingredient quality as a stat multiplier |
| Farm Together 2 | Crops, trees and animals; time advances while absent; house activities include cooking recipes | Three distinct raw districts, cozy persistent assignments and offline deadlines | Terraforming/expansion economy and extra decoration systems before the reward loop works |
| Stardew Valley | Farming, orchards, animals, processing machines, skill progress and cooking recipes | Long-lived crew progress, planning raw stock versus processed stock, collection goals | A chores/energy tax, temporary food buffs replacing the owner's permanent Extra Stats purchases |
| Cooking Mama: Cuisine! / Let's cook! | Ingredient/tool choices, cooking minigames, a recorded cookbook; the latter also has fields and ranch gathering | Finished-dish identity, cookbook completion and optional tactile preparation presentation | Required gesture scores, burned/lost meals, ads or making every asynchronous claim another minigame |

Sources:

- [Supercell: Hay Day production buildings](https://support.supercell.com/hay-day/en/articles/production-building.html).
  Building mastery is a reference mechanic, not a requirement; the revised Uma Farm proposal drops expertise.
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

For this app, the interesting decisions are where to station each persistent worker, which ingredients to stock,
which recipes support a weak racing stat, and whether to specialize or broaden the active Extra Stats map.
Better timers and clear shopping tools offer more value than random crop rarity, equipment durability or loss
on absence. All **6/6/6/6/6** spots are open from the start. Progress comes through **crew levels, ingredient
tiers, cookbook records and meal-funded builds**, not station expansion or an aggregate account Farm Level.

## Small additions worth carrying into the draft

1. **Meal wishlist and shopping plan.** Pin meals, show exactly which inputs are short, and link to the right
   district. Running outputs are shown separately from spendable stock.
2. **Persistent crew roles.** Let workers stay growers/processors/cooks, with one personal Farm level;
   no five-track expertise grind, slot-unlock ladder or random innate aptitude.
3. **Recipe identity and permitted substitutions.** Same-stat raw/processed variants can add variety without
   doubling the recipe tree. The owner's revision gives every stat the same raw and processed options, including
   milk/cheese variants and direct Guts ingredients; do not impose nutritional logic or exceptional recipes.
4. **Cookbook completion.** First-preparation records and clear finished-item art give collection satisfaction
   without a new currency or hidden recipe lottery.
5. **Optional preparation flourish.** Short plating/chopping/stirring visuals and reduced-motion equivalents;
   a future hands-on practice can be cosmetic, never compulsory for yield or timing.
6. **A rewarding short check-in.** Ready jobs wait without spoiling. Collect all, a clear level/item reveal and
   deliberate Repeat make a large crew manageable; no automatic ingredient spending or absence penalty.

These are proposed Uma Farm features inspired by the references, not claims that each source game has the
same rules. The baseline remains an asynchronous planning/collection loop, not thirty mandatory Cooking Mama
gesture challenges. Its concrete payoff is a prepared meal buying a named Extra Stats node for a chosen outfit.

Defer seasons/weather, feed/fertilizer, cooking grades, restaurants/customers, decoration purchases, breeding,
multi-step automatic queues and a separate farm inventory. Each would create another balance/sync surface
before the ingredient → meal → Extra Stats chain is proven.

## Catalogue arithmetic witness

The revised draft's **own original recipes**, not any source game's recipes, were totaled with a small
in-memory JavaScript calculation. For 10 of each pure meal, 1 of each pair meal and 5 banquets, every stat has
identical demand: 10 vegetables for its pure meals; 4 fruit and cheese for its pair meals; 5 fruit and cheese
for banquets. Including cheese for pure meals, that is **19 cheese per stat**.

| Stat | Vegetables needed | Fruit needed | Milk for rounded cheese batches | Cheese used / made |
|---|---|---|---|---|
| Speed | 10 | 9 | 24 | 19 / 24 |
| Stamina | 10 | 9 | 24 | 19 / 24 |
| Power | 10 | 9 | 24 | 19 / 24 |
| Guts | 10 | 9 | 24 | 19 / 24 |
| Wit | 10 | 9 | 24 | 19 / 24 |

| Work | Jobs per stat | Jobs total | Output / consumed units |
|---|---|---|---|
| Vegetables (6/job) | 2 | 10 | 60 / 50 |
| Fruit (6/job) | 2 | 10 | 60 / 45 |
| Milk (6/job) | 4 | 20 | 120 / 120 |
| Cheese processing (6/job) | 4 | 20 | 120 / 95 |
| Cooking (chosen 1–4/job) | — | 27 | 65 / 65 |

Thus 40 raw + 20 processing + 27 cooking = **87 claims**, versus 98 claims for Lv1 → Lv50 at 24 EXP/level and
12 EXP/claim. This reaches Lv44 with 12 EXP banked, leaving **11 claims** of slack. Kitchen claims are 15 for
pure meals (4+4+2 of each), 10 for one of each pair, 2 for banquets (4+1). Forcing full four-meal batches would
change the bill: partial quantities are necessary for this exact witness. There are 25 raw and 25 processed
units left from rounding, equally distributed across stats. Earlier 149/170-job witnesses do not apply here.

This checks ingredient conservation and batch rounding for one canonical bill only. It is not a simulator,
a real-account probe or evidence that racing stat balance is settled. Fixed six-hour jobs give a no-idle
duration sum of 522 hours. Raw work can be front-loaded to meet input/recipe gates, but check-ins add idle time.

## Level timing and reduced stat budget

Lv1→50 needs 49 × 24 = 1,176 EXP, or **98 completed jobs**. A fixed two-completion/day routine takes **49 days**;
three takes 32⅔ days (finishes during day 33); one takes 98 days. No expertise remains in the recommendation.
The mathematical six-hour no-idle floor is 588 hours / 24.5 days, requiring overnight check-ins. Jobs do not
automatically restart while the owner is away. No Energy or helper-to-beneficiary EXP is assumed.

Thirty workers completing two jobs/day provide sixty **account** jobs/day, not sixty jobs' personal EXP to one
outfit. Account items can progress another outfit's Extra Stats in days while personal levels take weeks.

## Fixed capacity and pipeline balance

Keep **6/6/6/6/6** spots open from the start. Remove the prior draft's nine-spot start, local expansion counters
and thresholds. Available outfits, input stock and shared recipe milestones still determine how much of that
capacity is productive; every slot being open does not require thirty assignments or bypass recipe access.

At full capacity a production round is **108 raw → up to 36 processed → up to 24 meals**. The canonical mix needs
about 35 processed plus 35 direct raw per 24 meals, so six workshops and kitchens fit average demand with a
stock buffer. Six Barnyard milk jobs supply the 36 inputs for six cheese-first workshop jobs, while Garden/
Orchard cover direct ingredients. A smaller crew or different ingredient families can still leave a shortage;
total volume must not hide a family-specific shortage. Banquet-only bursts need advance stock.

With **thirty maps** pooled and exact partial kitchen batches, the job bill is Garden 250, Orchard 225,
Barnyard 475, Workshop 475, Kitchen 493. Each district's six workers would complete 588 jobs on their own road
to Lv50; the static material capacity fits without eighteen workshops/kitchens. This does not prove the
starter farm's calendar schedule. Recipe startup, staggered workers and supply timing need a small
simulation before release. Removing expertise alone cannot fix a yield/capacity mismatch.

Recommendation: remove expertise, keep thirty physical spots, and increase production per job. Also propose
shared recipe milestones at the first worker's local Lv6/9, retaining each outfit's personal ingredient-block
eligibility. Otherwise every new cook still has to do sixteen early jobs before her personal Lv9. These are
explicit reviewable changes, not assumptions that the owner already approved them.

## Reduced stat budget retained

The owner also questioned the first draft's 960→1,440 raw Farm budget over scenarios 1–5. The revised candidate
is **20 total points/node** and **18 + 2 × (scenario index − 1)** active nodes: **360→520**, with no extra growth/
Foundation multiplier. Shipped Extra Stats give 240 raw normally, or 360 with Foundation before outfit growth.
Those baseline values were checked in `packages/domain/src/extra-stats.ts` and `constellation.ts`; no owner data
was read. The reduced candidate still needs synthetic stat-source/racing checks before pinning.

## Assets and evidence boundaries

Take inspiration from these mechanics, not their art or extracted assets. Reuse the existing private verified
Uma portraits/chibis and author original SVG food/district/Energy icons. No extra external dataset is needed
to release the baseline. Names and stat tags in the definition are game-design choices, not nutrition advice.

Actual production-account content and saves were not read for this research. Phone layouts, stock transactions,
timed progression and racing-stat distributions still need implementation-time synthetic proof, followed by
the owner's real-device acceptance. This research does not authorize the requested future reset now.
