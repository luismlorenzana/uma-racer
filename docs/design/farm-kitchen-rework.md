# Uma Farm — production and cooking rework

> **Owner-review draft · 2026-10-08 · not implemented.** This is the proposed replacement for
> [Stable Farm](farm.md) and its [Extra Stats grid](constellations.md#extra-stats), not a description of production.
> The owner's requirements are distinguished from recommendations below. Candidate numbers do not change the
> running game or its domain pins. Approve/revise this definition before assigning implementation task numbers.

> **Owner-review revision:** ingredients and recipe costs are now symmetric across all five stats, with no
> real-world nutrition rules or special Guts tax. The earlier 60-point/node proposal is replaced by a smaller
> 20-point/node candidate. See §10 for the old/new budget comparison and §11 for exact Lv1→50 timing.

> **Capacity/pacing revision:** start Garden/Orchard/Barnyard with one open spot each, Workshop/Kitchen with
> three each; expand every district independently to six. Two jobs now earn one outfit level. Removing expertise,
> a fixed six-hour timer, larger production batches and shared recipe access are the recommended rebalance,
> not implemented or owner-approved constants. §3 and §11 separate personal levels from account throughput.

## 1. Intent and boundaries

Farm becomes the third independent, global activity beside Uma RPG and Uma Puzzles. Its enjoyment comes from
managing a persistent outfit crew, growing each district, planning ingredients and completing a cookbook.
Its practical reward is enough configurable Extra Stats to support a balanced racing build when the available
card set does not cover every stat. It must not become another mandatory turn-based training session.

The main loop is **assign outfit → grow/gather → process → cook → spend meal → configure Extra Stats → race**.
Inputs and outputs always live in the existing global Items inventory. Farm remains accessible directly from
Home without first selecting an Uma. Farm Level is per **outfit**, unrelated to racing levels,
CL, card stars, RPG or Puzzle Level. Assigning an outfit to Farm does not make her unavailable in those modes.

### Requirements already specified by the owner

- Five districts, at most six stations each. Start Garden/Orchard/Barnyard with one spot each and Workshop/Kitchen
  with three each: **nine open spots initially**, thirty eventually. Use soft, independent district unlocks rather
  than the old sequential, steep aggregate Farm Level ladder; keep permanent worker assignments.
- Ingredients should be equally distributed across stats, not constrained by real-world food logic. The
  revised interpretation gives each raw district all five stat lanes, replacing the initial three-lane lists;
  milk/cheese and other flavour families have an equal variant for every stat. Factories consume ingredients;
  kitchens make the final unlock consumables. Only final meals unlock nodes.
- Processing preserves an ingredient's stat identity and doubles its contribution to a recipe.
- Each outfit retains independent Farm EXP/levels. **Two completed jobs per level-up**, as in the shipped curve.
  The owner is considering dropping expertise so workers can remain in a chosen job instead of rotating through
  every district; the recommended no-expertise design is below. No compulsory return at the deadline.
- A larger Extra Stats map with five stat clusters, single-stat and dual-stat nodes, and five central all-stat
  nodes. Five successive scenarios allow more active nodes; the next block uses new items and a new map.
- Meals buy permanent unlocks. Which unlocked nodes are active remains freely configurable within capacity.
- Production on the road to Farm Lv50 should fund the outfit's full first five-scenario map.
- Replace the global time-skip control with a single-worker thirty-minute Energy consumable. The debug button
  grants fifty Energy per press instead of shifting everyone's timestamps.
- On the eventual cutover, reset every old Extra Stats unlock/active configuration and every outfit's Farm
  Level. Do not migrate those bonuses or levels into equivalent new progress.
- Compact district screens: all six stations visible without page scrolling at 390 × 844.

### Recommended interpretations to review

| Topic | Draft choice | Why |
|---|---|---|
| Five-scenario map | Unlocks shared by outfit across scenarios 1–5; a new map for 6–10, then 11–15 | One purchase is not paid five times; each scenario still has its own active builds |
| Farm level gates | Personal block eligibility at Lv1/51/101…; the first eligible worker at local Lv6/9 unlocks processing/cooking recipes for that block account-wide | New workers can specialize without all repeating raw-work prerequisites |
| Ingredient symmetry | All five stat lanes in each raw district; identical costs/yields and mirrored recipes | No missing Guts source or stat-specific ingredient tax; food flavour is presentation |
| Processing's double value | One processed unit has two ingredient-potency units; not a direct racing-stat buff | Ingredients are only inputs, and activating a purchased node is not another meal consumption |
| District expansion | Local completed-job thresholds 4/12/24/40/60 for spots 2–6; Workshop/Kitchen already have the first three | All sections can expand in parallel, each through its own work |
| Expertise | Remove it; use a fixed six-hour job duration | No rotation tax or five extra XP tracks; three daily check-ins become practical |
| Production batches | Raw 6; workshop 6 raw → 6 processed; kitchen makes a chosen 1–4 meals | Increase downstream throughput instead of multiplying physical station count |
| Proposed progression | 24 EXP/level; 12 EXP/job, regardless of batch size | 98 jobs to Lv50: 49 days at two/day or about 33 at three/day |
| Proposed Extra Stats | 65 nodes; each active node distributes 20 raw points; capacity 18 + 2 × (scenario index − 1) | Starts at 360 total, rather than jumping from the old 240/360 to 960 |

These choices, including every new balance number, are **proposals**, not additional owner approvals.

## 2. What changes from production

| Current implementation | Rework |
|---|---|
| Eighteen plots; aggregate levels unlock them sequentially | Five independently expanding districts, nine spots initially, thirty eventually |
| Every plot grows any stat's scenario crop | District-specific raw goods, recipes and input-consuming jobs |
| 24 EXP/level; raw harvest pays 12 EXP and one crop | Keep two jobs/level; all job kinds pay 12 EXP, with larger yields |
| Crop access every ten levels, older rows faster | Five-scenario ingredient blocks; personal block eligibility, shared recipe access, fixed candidate timer |
| Per-scenario 20-node grid, six active, +40 each | Per-block 65-node map, scenario-specific active capacity, candidate +20 total/node |
| Direct crop purchases costing 1/2/3/4 | One matching cooked meal per physical node, no sequential purchase costs |
| Existing 240-point Extra Stats allowance subtracted from the card pool | Preserve current card-node values; add an independently budgeted Farm contribution |
| Debug action shifts all running jobs | Debug grants Energy; a deliberate spend advances one job |

The current guide also still describes older timer/Produce rules. Replace it as part of the new Farm UI rather
than carrying those instructions into the rework. Do not use its stale copy as a rules source.

## 3. Districts and station ownership

| District | Six station IDs | Jobs | Raw stat lanes |
|---|---|---|---|
| Vegetable Garden | `garden-1` … `garden-6` | Plant/harvest vegetables | All five, equally represented |
| Orchard | `orchard-1` … `orchard-6` | Tend/collect fruit and berries | All five, equally represented |
| Barnyard | `barn-1` … `barn-6` | Gather animal produce | All five, equally represented |
| Workshop | `workshop-1` … `workshop-6` | Can, juice and process raw goods | Preserves the raw ingredient's stat |
| Kitchen | `kitchen-1` … `kitchen-6` | Cook single/dual/all-stat meals | Recipe-defined unlock signatures |

A station has zero or one owned outfit. One outfit can hold at most one station across all five districts.
Open stations may be assigned from day one; assignment is not enrollment or a purchase. Recipe access is a
separate gate, shown on an idle station before eligible work exists. Locked spots cannot hold new jobs. Workers stay
assigned after collection, reload, navigation and sync. A worker picker shows Available and Working sections,
Farm Level and an explicit destination for a move. Moving an idle worker is free. Moving a busy
worker is blocked until the job is claimed; the UI offers a jump to that station, not silent cancellation.

An assigned idle station can be assigned a different eligible recipe without reselecting the outfit. A saved
last recipe is a convenience only: **Repeat** still requires a deliberate start and sufficient ingredients.
No offline auto-repeat, invisible ingredient reservations, farm currency, seeds to buy, paid station upgrades,
watering, animal feeding, disease, withering, spoilage or random crop quality in the first version.

Barn jobs represent a stylized supply activity, not a combat/animal-slaughter animation. A station can change
between milk/eggs/meat jobs while idle; livestock ownership and feed production are out of scope.

### Independent, soft district expansion

Each district counts **its own completed v2 jobs**, contributed by any worker. A claim increments its count
exactly once; outputs, batch size and Energy do not multiply the increment. Starting/assigning/waiting gives
no progress. Unlocks are permanent, cost no Items or EXP, and remain open across ingredient/scenario blocks.

| Spot | Garden / Orchard / Barnyard: jobs completed in that district | Workshop / Kitchen: jobs completed in that district |
|---|---|---|
| 1 | Open initially | Open initially |
| 2 | 4 | Open initially |
| 3 | 12 | Open initially |
| 4 | 24 | 24 |
| 5 | 40 | 40 |
| 6 | 60 | 60 |

These thresholds are a **candidate**, not a new aggregate Farm Level. All three raw districts use the same
curve; one never needs to finish Garden before starting Orchard/Barnyard. Workshop and Kitchen have a head
start, then use the same thresholds. "In parallel" does not mean a Garden claim automatically unlocks an
Orchard slot: every section has its own counter, and different usage can give different unlock dates.

With every open spot staffed and two completions/worker/day, a raw district reaches six spots in about ten
active days: roughly two days at each size. A production district starting with three reaches six in about
eight active days once supplied/staffed. Recipe access, available outfits, stock and staggered assignments
add startup time. Do not promise every new account has thirty productive workers on calendar day ten.

Show `3/6 spots · 18/24 jobs toward Spot 4` rather than an aggregate Farm Level. A result names its district's
new spots. Threshold progress is shared by the account, personal EXP stays with the actual worker.

## 4. Ingredient blocks and Farm Level

Use the scenario registry's stable order, not hard-coded English names, to resolve a block:

`block = 1 + floor((scenarioIndex − 1) / 5)`

| Block | Scenario indices | Personal eligibility / account recipe milestones |
|---|---|---|
| 1 | 1–5: URA Finale through Grand Masters | Worker Lv1; first worker Lv6 opens processing, Lv9 opens cooking |
| 2 | 6–10: Project L'Arc through Twinkle Legends | Worker Lv51; first worker Lv56 opens processing, Lv59 opens cooking |
| 3 | 11–15: Design Your Island onward; only four exist today | Worker Lv101; first worker Lv106 opens processing, Lv109 opens cooking |

Farm Level never resets or caps at 50. Total EXP is authoritative; level is `1 + floor(totalExp / 24)`.
A block starts at `1 + 50 × (block − 1)`. Personal levels determine which ingredient blocks an outfit can work
in. **Recommended change:** the first eligible outfit reaching local Lv6/9 opens that block's processing/cooking
recipes for the account permanently. Other workers only need that block's starting level, not their own Lv6/9.
Thus a new Lv1 outfit can work in Block 1's kitchen once the recipe milestone is earned, gaining her own EXP
without rotating through Garden first. A Lv1 outfit still cannot cook Block 2 food; she needs personal Lv51.

This shared recipe gate is a proposal to address specialization, not merely renaming the former personal gate.
Without it, removing expertise would still force every new kitchen worker through sixteen early raw/other jobs
to reach Lv9. Record the approved eligibility rule explicitly before implementation. At two completions/day,
the first outfit reaches Lv6 after five days and Lv9 after eight; open station spots may wait for those milestones.

**This is a deliberate recommendation:** do not repeat the same processing/cooking unlock every ten levels
inside a shared block. Doing so would contradict the idea that Scenario 1 can buy the full shared map, unless
later scenarios merely add optional flavours. If the owner wants five separate ten-level recipe ladders,
rewrite both access gates and the full-map production proof before implementation.

An outfit may farm unlocked ingredient blocks before reaching their racing scenario. Consumption requires a
real scenario unit in that block; Farm never creates scenarios or raises racing/CL. Display block labels as
scenario ranges with the actual registry names, so future scenarios do not require another hard-coded gate.

Every completed raw, factory or kitchen job gives its worker **12 Farm EXP**. Starting, waiting, assigning,
Energy use and purchasing Extra Stats give no Farm EXP. Two completions advance one level; excess EXP banks.
Batch output does not multiply EXP: one kitchen job making four meals is still one 12-EXP completion.
There is no diminishing EXP for old blocks: old ingredients remain useful for newly acquired outfits. A
max-level worker cooking for another outfit still gains her own EXP; the consumer does not inherit it.

## 5. Specialization and deadlines — recommended no-expertise version

Drop the five expertise XP/rank tracks. They encourage cycling every outfit through every job to get its best
timer, precisely the repetition the owner wants to avoid. A worker can remain a grower, processor or cook by
assignment, but that role is not a locked class or permanent efficiency penalty. Moving idle workers is free.

**Candidate timer: six hours for every raw, processing and cooking job**, with no rank-based reduction or
outfit-specific speed multiplier. Farm Level opens ingredient blocks, not a second timer curve. Shared recipe
milestones open job options; completed jobs grow their own district. Removing expertise simplifies assignment
but does **not** solve throughput by itself: the batches in §6–8 do that.

A recipe's block, job kind, worker, concrete inputs, batch quantity, rules version and deadline are frozen when
it starts. Level changes never retroactively change an existing deadline. A ready job waits indefinitely and
grants nothing until claimed. No automatic production queue is implied by cooking multiple meals in one job.

Use elapsed timestamps, not an always-running timer simulation; closed/offline time counts. Keep the existing
personal-game trusted-clock policy visible: clock movement can affect readiness. Save deadlines as integer
timestamps and reconcile them on foregrounding; no server anti-cheat or new clock service is proposed.

At two completions a day a level takes about one day. A six-hour timer supports a three-check-in routine, e.g.
morning/afternoon/evening, but a morning/evening routine still makes only two claims. Four daily jobs require
actual four check-ins, including overnight for uninterrupted six-hour slots; never claim they happen automatically.

## 6. Raw catalogue

Names are original recipe definitions, not extracted game content. The same family catalogue is namespaced by
ingredient block; a Block 1 carrot is not a Block 2 carrot. The icon can reuse its original silhouette with a
clear block badge. Raw harvests cost no inventory and yield **six units** per completed job.

| Stat | Garden vegetable | Orchard fruit | Barn milk variant |
|---|---|---|---|
| Speed | Carrot | Apple | Swift Milk |
| Stamina | Potato | Banana | Steady Milk |
| Power | Turnip | Pear | Strong Milk |
| Guts | Pumpkin | Peach | Brave Milk |
| Wit | Spinach | Berry | Bright Milk |

The labels are fantasy ingredient identities, **not nutrition claims**. Guts is as straightforward to source as
Speed; no recipe has to borrow Stamina/Power ingredients to make a Guts output. Each vegetable/fruit has the same
availability, yield, timer, EXP and processed options as its counterparts in the other four stats.

Barnyard also offers **Egg, Chicken, Beef and Pork**, each in the same five Swift/Steady/Strong/Brave/Bright variants.
Milk is the canonical first choice, not the only useful animal produce. Each stat therefore has seven raw
definitions per block: one vegetable, one fruit, and five barn families. The full catalogue has **35 raw
definitions**, equal counts for every stat. Use category silhouettes with explicit stat glyphs rather than
thirty-five bespoke animal portraits. All families open at the block's raw gate; no unequal flavour gates.

Symmetry means equal catalogue coverage and cost for equivalent stat roles. It does not mean the player must
produce every optional flavour in equal quantities: choosing milk instead of eggs is a preference, not a tax.

## 7. Workshop catalogue and processing value

A workshop job consumes **six units of one raw family at start**, then produces **six units of the corresponding
processed ingredient at claim**. Each processed unit has **two potency units** of its ingredient stat, versus one
for a raw unit. Processing adds value through work; it does not spend racing stats or double an active node.

| Process | Input family | Five equal output variants |
|---|---|---|
| Canned vegetables | Vegetable of the stat | Speed / Stamina / Power / Guts / Wit |
| Vegetable juice | Vegetable of the stat | Speed / Stamina / Power / Guts / Wit |
| Canned fruit | Fruit of the stat | Speed / Stamina / Power / Guts / Wit |
| Fruit juice | Fruit of the stat | Speed / Stamina / Power / Guts / Wit |
| Cheese | Milk of the stat | Swift / Steady / Strong / Brave / Bright Cheese |
| Mayonnaise | Egg of the stat | Speed / Stamina / Power / Guts / Wit |
| Chicken stock | Chicken of the stat | Speed / Stamina / Power / Guts / Wit |
| Beef stock | Beef of the stat | Speed / Stamina / Power / Guts / Wit |
| Cured ham | Pork of the stat | Speed / Stamina / Power / Guts / Wit |

This is **45 explicit processed definitions** (nine families × five stats), materialized from bounded family/stat
templates rather than a free-form ingredient editor. Cheese is no longer reserved for Wit or ham for Power.
Every stat has the same nine processed choices, and every choice has the same batch cost, potency and timer.
Swift Milk → Swift Cheese and Brave Milk → Brave Cheese are mechanically identical apart from the stat label.

Recipes use a processed **slot** for each required stat and allow any of its nine listed processed choices in
the same block. Cheese is the canonical default for all five stats and the arithmetic below; the player may
choose other flavours without changing output signature, yield, timer, EXP or node reward. A raw slot similarly
accepts the seven listed raw definitions of its stat; canonical choices keep shopping plans predictable.

No replacing a processed slot with raw food in v1: the workshop must remain part of the loop. No substitutions
between blocks or stat lanes. Display the chosen input item and exact quantity before starting and freeze them
in the job. Missing ingredients cannot become a negative stack or be borrowed from another running job.

## 8. Cookbook and kitchen jobs

One kitchen job makes a chosen batch of **one to four meals** of one recipe. Default to four when stock allows,
but make partial batches explicit for odd purchases and expensive banquets. A quantity of `n` spends exactly
`n` times the listed recipe ingredients and yields `n` meals; partial batches still take six hours and pay 12 EXP.
Choose the recipe, quantity and any permitted substitutions; do not ask the player to guess a hidden recipe
from a bag of ingredients. Every listed quantity below is **per meal**, not per maximum-size job.
Each recipe contains both raw and processed ingredients. A meal's explicit signature buys one matching node;
it is not a generic bundle of stat points to split across nodes.

### Five single-stat meals

Each single-stat meal has ten purchases to fund on the map.

| Meal | Unlock signature | Canonical raw + processed ingredients |
|---|---|---|
| Swift Bowl | Speed | Carrot + Swift Cheese |
| Steady Bowl | Stamina | Potato + Steady Cheese |
| Strong Bowl | Power | Turnip + Strong Cheese |
| Brave Bowl | Guts | Pumpkin + Brave Cheese |
| Bright Bowl | Wit | Spinach + Bright Cheese |

All five follow **one raw + one processed of the same stat**. No food-health logic, extra Guts ingredients,
rarer Power source or cheaper Speed alternative changes the cost. Preparation names express a build choice.

### Ten dual-stat meals

Each unordered stat pair has one bridge node on the map.

| Meal | Unlock signature | Canonical ingredients |
|---|---|---|
| Trail Bento | Speed + Stamina | Apple + Banana + Swift Cheese + Steady Cheese |
| Dash Bento | Speed + Power | Apple + Pear + Swift Cheese + Strong Cheese |
| Courage Bento | Speed + Guts | Apple + Peach + Swift Cheese + Brave Cheese |
| Orchard Bento | Speed + Wit | Apple + Berry + Swift Cheese + Bright Cheese |
| Protein Bento | Stamina + Power | Banana + Pear + Steady Cheese + Strong Cheese |
| Steady Bento | Stamina + Guts | Banana + Peach + Steady Cheese + Brave Cheese |
| Garden Bento | Stamina + Wit | Banana + Berry + Steady Cheese + Bright Cheese |
| Brave Bento | Power + Guts | Pear + Peach + Strong Cheese + Brave Cheese |
| Scholar's Bento | Power + Wit | Pear + Berry + Strong Cheese + Bright Cheese |
| Comfort Bento | Guts + Wit | Peach + Berry + Brave Cheese + Bright Cheese |

Every pair follows **one raw + one processed for each of its two stats**. Both stats pay the same quantities;
the ten-pair catalogue includes every stat exactly four times. Select the named recipe, never infer a different
meal from loose ingredient tags. More flexibility costs more ingredients, but not more active capacity/stat power.

### All-stat meal

**Sunrise Banquet**: one raw fruit and one cheese for **each** of Speed, Stamina, Power, Guts and Wit: Apple,
Banana, Pear, Peach, Berry + Swift, Steady, Strong, Brave and Bright Cheese. Ten units, equal cost for all five
stats. It buys one of the five central Sun nodes; Guts needs no exceptional combination or extra input.
The player needs five banquets for all five Sun nodes, not five different compulsory rare recipes.

The catalogue has **sixteen meal families** per block. Single-stat nodes share their stat's meal; the ten dual
recipes each match their pair. Later blocks initially reuse these readable recipes with tiered ingredients;
new original names/art can enrich them after balance, without multiplying the required shopping list.

### Planning tools, not chores

- Pin up to three desired meals. A shopping list recursively counts raw and processed shortages and subtracts
  outputs of known running jobs separately from stock; never pretend unclaimed stock can be spent.
- A missing input links to its district and eligible workers. Recipe sheets show batch size, readiness, Farm
  EXP, batch quantity, district-unlock progress and the exact node signature before confirmation.
- A cookbook records first successful preparation and total claims as modest collection goals. Every recipe
  is readable before its gate; first cooking does not randomly discover recipes or consume failed experiments.
- After collection, show **Repeat**, **Choose recipe**, or **View Items**. No default automatic spend.
- Harvest/Collect all can claim eligible ready jobs with individual idempotent receipts and an honest partial
  result if one fails. It must not restart jobs or hide a failed spend.

Cooking-game inspiration becomes a short preparation/plating presentation and a satisfying finished-item reveal.
Optional tap/stir practice can be added later, but **no required dexterity minigame, quality multiplier, burned meal
or lost ingredients** is part of the baseline. A kitchen should still work when the app is closed.

## 9. Extra Stats map and ownership

Each outfit has one bought-node set per five-scenario ingredient block. The map is available from the first
real scenario unit in that block, independent of CL. Later scenarios in the same block read the same bought set.
Different outfits must purchase their own nodes; items and recipes are global, unlocks are not account-wide.

Every block has a fresh **65-node** template:

- Fifty single-stat nodes: ten each for Speed, Stamina, Power, Guts and Wit, in five visible clusters.
- Ten dual-stat bridges: one for each unordered pair of the five stats. Their connectors show the pair, not
  a prerequisite path. Place non-adjacent bridges on a secondary ring without implying extra purchases.
- Five central all-stat Sun nodes.

Use stable IDs such as `speed-01` … `speed-10`, `dual-speed-stamina`, and `sun-01` … `sun-05`, with a versioned
template. Counts alone cannot represent named dual/Sun purchases. Node names are authored and returned from
the actual template in receipts; no invented result names or numerical fallbacks.

**Any node may be purchased first.** No sequential stat-row gate, adjacent-node prerequisite, CL gate, random
node, or requirement to activate the purchase immediately. Single, dual and Sun purchases consume exactly one
matching meal of the same block, permanently. A stale purchase revalidates stock and ownership atomically.
An already-bought node returns its existing receipt without spending again or selecting a different node.

Opening Scenario 6 does not clear Scenario 1–5's map: it creates a **new block map** with no purchases. Earlier
units remain usable with their older configurations. New-block unlocks need the new-block meals. Farm can
prepare these ingredients ahead of promotion once its outfit reaches the level gate.

## 10. Activation and proposed stat values

Bought nodes belong to the outfit/block; **active node IDs belong to each scenario's distance preset**. Sprint,
Mile, Medium and Long can therefore configure different builds without paying for the same node four times.
Race derivation must use the actual race-distance preset, not whichever tab was last viewed.

| Node kind | Contribution before caps | Active capacity cost |
|---|---|---|
| Single | +20 to its stat | 1 node |
| Dual | +10 to each of two stats | 1 node |
| Sun | +4 to each of all five stats | 1 node |

Every node contributes **20 total raw points**, so all-stat nodes are flexible rather than strictly stronger.
Ten pure nodes give +200 to one stat; its four pair bridges add up to +40 and the five Suns add +20, a maximum
+260 from the full map to one stat. That requires nineteen active nodes; the first scenario's eighteen-node
capacity yields a maximum +256 instead. These are targeted complements, not +600 boosts to every weak stat.

The old code pays **6 × 40 = 240 raw total**, or **360 with Foundation** before outfit growth. Depending on the
activated stats' growth, the visible Foundation contribution can be around 360–400 or higher. The first draft
proposed 960 raw in Scenario 1 and 1,440 in Scenario 5, plus separate Foundation help: that was a much larger
increase, not merely more build choices. The owner questioned it; this revision reduces node power and removes
the extra Foundation allowance. **A bigger map must not silently become a bigger order-of-magnitude budget.**

Revised candidate capacity is **`18 + 2 × (scenarioIndex − 1)`** for the present registry:

| Scenario range | Active capacities | Maximum total raw Farm contribution |
|---|---|---|
| 1–5 | 18 / 20 / 22 / 24 / 26 | 360 / 400 / 440 / 480 / 520 |
| 6–10 | 28 / 30 / 32 / 34 / 36 | 560 / 600 / 640 / 680 / 720 |
| 11–15 | 38 / 40 / 42 / 44 / 46 | 760 / 800 / 840 / 880 / 920 |

The block resets **purchases**, not the scenario progression slope. Capacity continues to grow by two nodes
per scenario. The new map can eventually use more nodes than the old map, but still needs its own production.
Only indices 1–14 exist today; Scenario 15 is an extension example, not a new authored scenario. The formula
must not silently exceed the physical template; before a future Scenario 25 would need 66 active nodes, extend
the template or deliberately re-author the capacity curve. This is not an infinite stat-growth promise.

Switching bought nodes on/off is free outside a race, changes no Items, and never raises CL. Display capacity,
each affected stat, marginal capped gain and cap waste before selecting. A purchase can auto-activate only in
the selected preset while capacity remains, with the resulting delta shown; otherwise it stays bought/idle.
New scenario units may copy valid active IDs from the previous scenario's matching preset **within the same
block** once at creation, then keep independent selections. New-block units start empty; no old IDs are remapped.

### Stat derivation: protect cards while adding a real Farm budget

The current code subtracts a 240-point Extra Stats allowance from the card pool. Simply increasing that constant
would reduce card-node value, undoing the reason for this rework. The implementation must instead:

1. Preserve current card-node values and their global-star/era/preset calculations. Name their historical
   240-point normalization explicitly; do not subtract the new Farm pool or quietly redistribute card nodes.
2. Calculate the purchased/active Farm vector separately, with no card-type, star or release-era scaling.
3. **Candidate:** add Farm as a flat contribution after the existing base/card growth calculation and before
   final stat caps. This makes its per-scenario progression genuinely linear and visible, without growth
   multiplying Farm again. Other pre-existing base/card/buff paths stay unchanged.
4. **Revised candidate:** Foundation, growth and other existing multipliers do not scale this separate Farm
   vector again. No flat +120 Foundation replacement is added. Its Scenario 1 Farm ceiling is already 360,
   matching the old Foundation raw ceiling; later ceilings rise linearly instead of dropping when Foundation
   disappears. Retain Foundation's existing non-Farm effects. This new boundary needs explicit balance
   approval, matching docs/pins and a decision before implementation.
5. Keep the existing final stat caps, race engine, skill SP, aptitudes and Inspiration calculations. Document
   the old combined-budget invariance as superseded only for Farm; card-only invariance must still hold.

The owner's 1600-Speed example cannot be a Scenario 1 acceptance target: its current Speed cap is 1200.
Use those example builds as **later-scenario directional targets**, not permission to raise existing caps.
Check the displayed result by source: base/cards, growth/buffs, Farm, then cap. The Farm page should explain
which missing stats a build can repair and which desired gains are already capped.

This conservative candidate **does not promise** that Farm alone raises a 200-stat cardless build to 900.
Measure the real stat-source arithmetic with synthetic decks before committing to the owner's directional
targets. If the gap remains, report it and consider a separate card/base-stat distribution proposal; do not
hide a thousand-point Farm increase or change card values/race rules under a recipe task.

## 11. Production arithmetic and pacing

For one full shared map the bill is **50 single meals + 10 dual meals + 5 Sunrise Banquets = 65 meals**.
Using the canonical recipes above and exact batch rounding:

| Work | Needed jobs | Output/detail |
|---|---|---|
| Raw gathering | 40 | 240 raw units; covers direct ingredients and processing inputs |
| Workshop | 20 | 120 processed units; 95 consumed by meals, 25 surplus from batch rounding |
| Kitchen | 27 | Exactly 65 meals with chosen partial batches |
| Total | **87** | **1,044 Farm EXP**, reaching Lv44 with 12 EXP banked |
| Road to Lv50 | **98** | 1,176 EXP; **11 jobs** of slack beyond the full-map bill |

The bill needs 215 raw units including rounded processing inputs, leaving 25 raw units from harvest rounding.
For **each stat**, the canonical bill needs 10 vegetables, 9 fruit and 24 milk; 19 cheese are used and 24 made.
Each stat therefore has exactly the same demand and batch rounding, not merely the same number of food names.
Cookbook substitutions may alter the per-family rounding; the actual selection must be simulated, not assumed
to have precisely this bill. Sixteen raw claims reach Lv9, so a solo producer can front-load necessary
ingredients and unlock both processing and cooking without deadlock. The canonical bill includes 40 raw claims.

Kitchen rounding is 3 jobs per pure recipe (4 + 4 + 2 meals) × 5 = 15; one partial single-meal job for each
of ten pairs = 10; two banquet jobs (4 + 1) = 2. A compulsory four-meal output would have a different ingredient
bill and surplus. Partial batches are intentional, not assumed free fractional jobs.

This proves **material/work sufficiency**, not that every possible player's order spends the stock correctly.
The promise assumes production is directed to the map instead of repeated wasteful recipes, giving items away,
or spending the same meals on other outfits. It is an account production chain: helper outfits can contribute,
but no hidden EXP credit is assigned to the beneficiary. One outfit can also rotate among districts and make
the entire bill herself. A long-term player can leave specialists permanently assigned for a faster crew loop.

At two claimed jobs per day, 87 claims take roughly 44 days for a **solo producer**, and Lv50 takes 49 days.
Six-hour jobs have a no-idle full-map duration sum of 522 hours (21.75 days). That is not the account's production
rate when a crew makes food in parallel, or a promise that one outfit never waits for a station/input.

### How long does one outfit take from Lv1 to Lv50?

Exactly **49 level-ups × 24 EXP = 1,176 EXP**, at **12 EXP per completed job = 98 jobs**, regardless of job kind.
Without Energy, stock/helper credit, automatic restarts or skipped collection time:

| Consistent completion rate for this outfit | Lv1→50 time |
|---|---|
| One job/day | 98 days |
| Two jobs/day, e.g. morning/evening | 49 days, seven weeks |
| Three jobs/day, e.g. morning/afternoon/evening | 32⅔ days, reaching Lv50 during day 33 |
| Four jobs/day, uninterrupted six-hour check-ins | 24½ days; impractical overnight schedule for many players |

Removing expertise removes a rotation tax, not the number of required claims. At a fixed two-check-in routine,
the six-hour timer still earns two completions, not four automatic ones. Multiple assigned outfits level in
parallel, but their work does not accelerate this outfit's personal level. The mathematical no-idle floor is
98 × 6 = 588 hours / 24.5 days; no additional mastery ramp is hidden in it.

**Account output is a different benchmark.** Thirty staffed spots at two completions/day give sixty jobs/day,
not thirty times the personal EXP to one outfit. Dividing personal days by thirty is an equivalent-work measure,
not an individual level time. Global ingredients/meals can benefit another outfit without giving her Farm EXP.

### Why six Workshop and Kitchen stations can be enough

| Stage at full capacity | Output per completed job | Output per round of all its workers |
|---|---|---|
| Eighteen raw stations across three districts | 6 raw | 108 raw |
| Six workshop stations | 6 processed for 6 raw | 36 processed |
| Six kitchen stations | Up to 4 meals | Up to 24 meals |

The full-map recipe mix uses 95 processed + 95 direct raw for 65 meals: about 1.46 of each per meal before
rounding. A full 24-meal cooking round therefore needs about 35 processed and 35 direct raw; one workshop round
makes 36 processed while consuming 36 raw. Three raw districts can supply the roughly 71 raw needed in total.
Batch outputs, not eighteen physical production spots, match the usual demand. These average rates require a
stock buffer and do not mean every arbitrary six-job combination is continuously supplied.

At startup, three raw stations make only 18 raw per round. Filling all three workshops and kitchens would
need more: the initial bottleneck is **raw supply**, not too few processing spots. Two spots per raw district
make 36 raw in total, but the cheese-first mix still needs more than Barnyard's 12 milk: aggregate volume alone
is not enough. At **three raw spots per district**, Barnyard supplies the 18 milk needed by three workshop
jobs, while Garden/Orchard cover direct ingredients. Those raw spots open after twelve local jobs, about four
active days at two completions/worker/day. Alternative processed families can distribute inputs differently;
the shopping planner must check the actual family supply, not only total raw units.

Banquet-only bursts need five processed items per meal, so they require advance preparation. The cookbook
should surface that stock requirement; do not claim the average covers every recipe. A permanent ×3 station
multiplier would also multiply the roster, taps and layout without guaranteeing every extreme mix is balanced.

For an **already expanded/staffed** farm, one map needs 27 cooking completions: about 2.25 active days at twelve
kitchen completions/day, **after inputs are available**. Raw preparation, recipe gates and cold-start pipeline
fill add time. This is the useful "few days of account food for one Uma" concept, not a few-day personal Lv50.

A pooled canonical workload funding **thirty outfits' maps**, with partial kitchen batches and shared leftover
stock, fits inside thirty workers' Lv1→50 workload at the full 6/6/6/6/6 distribution:

| District | Jobs for thirty maps | Jobs its six workers complete to reach Lv50 |
|---|---|---|
| Garden | 250 | 588 |
| Orchard | 225 | 588 |
| Barnyard | 475 | 588 |
| Workshop | 475 | 588 |
| Kitchen | 493 | 588 |

This is a **capacity/material witness**, not a fresh-account calendar simulation: fewer starting spots,
workers entering at different times, ingredient substitutions and choosing other maps change actual dates.
The intended loop is a cooperative crew with specialists, not a requirement that every worker personally
completes all five job kinds. Solo production remains feasible as the 87-job witness above shows.

### Required balance work before constants ship

- A small deterministic Farm progression sim: self-sufficient outfit; fixed multi-outfit specialists; two
  daily check-ins; perfect-readiness lower bound; input shortages; block 1 → 2 → 3; reset cohort; no Energy and
  fixed Energy budgets. Trace every consumed/produced unit, district unlock, recipe milestone and personal
  level, not just aggregate yield. Separate fresh 1/1/1/3/3 expansion from steady-state 6/6/6/6/6 throughput;
  verify same-stat worker groups, kitchen partial batches and banquet-only supply stress.
- Verify every raw/processed/meal definition and dependency graph: no missing source, cycles, cross-block
  substitution, wrong stat pair, unbounded crafting or recipes impossible under their worker gates.
- A synthetic racing-stat matrix with 2 Speed + 1 flex + 2 Wit cards, varying flex among Stamina/Power/Guts
  and neutral synthetic outfit growth profiles. Compare empty/partial/full Farm at each scenario, cap waste,
  Foundation's old/new paths, card-only equality and all four distance presets.
- Check current racing stamina/finish envelopes with repaired builds. Preserve card progression as a
  meaningful advantage; reject a Farm configuration that makes deck differences irrelevant. Report weak-stat
  floors and attainable balanced builds separately from universal max-stat builds, which are not the goal.
- Decide the candidate node values/capacity, Farm curve/yields and Foundation treatment together. Update the
  living design, `packages/domain/src/domain.test.ts` pins, affected sim envelopes and a new decision row.

The arithmetic above was recomputed while authoring; **these timed and race-stat sims have not been implemented
or run**. Existing `sim:farm` measures the shipped old model and cannot validate this proposed production chain.

## 12. Energy

Energy is a global Item with an original clock/lightning icon clearly distinct from training tickets. One Energy
advances **one chosen running job by thirty minutes**. The confirmation shows worker, district, current time
remaining and after-state; it changes that job's deadline, not all jobs owned by the outfit or account.

- Reduce remaining time to a minimum of zero. If less than thirty minutes remains, show the lost portion and
  require confirmation. No item spend on an idle/already-ready job.
- Atomically spend one item and record one adjustment receipt. Retry reuses that receipt; repeated genuine
  uses have distinct operation IDs. No free harvest, Farm EXP, district progress or output until claim.
- Record cumulative acceleration separately from the original frozen duration for replay/audit. Do not move
  an immutable start time backwards or make the timer inconsistent with its frozen duration/acceleration.
- The existing debug affordance becomes **Grant 50 Energy**; every deliberate press adds fifty to global
  inventory with a unique receipt. It does not automatically consume them. Show the resulting balance.
- Keep the affordance explicitly labeled debug/owner-only, with the same owner access boundary as the current
  hack. Normal production recipes do not require it, and it is not a monetization system.

## 13. Phone screens and interaction

### Home and Farm hub

Home opens Farm directly. The Farm hub shows the five districts, ready/busy counts, next completion, global
stock shortcuts, cookbook wishlist, each district's next spot and the worker list. No featured-Uma gate or
aggregate Farm Level meter.
Remember the last district locally; provide a consistent Hub/Back path. Do not replace the existing Home's
RPG/Puzzle/racing entry points as part of this work.

### Six-station district

At 390 × 844, reserve safe areas and the app's actual shell/header/navigation first. Use a **2-column × 3-row
grid**, a compact district title and a horizontal five-district switch. Target roughly 140–150 px per station
card and ≤ 500 px for the grid with gaps; verify actual available height, not six cards each 224 px tall.

Each station shows the outfit's small existing portrait, item icon, idle/growing/ready state, remaining time,
Farm Level and **one primary action**: Assign / Choose / Collect. Locked tiles show the local job requirement
and cannot assign a worker. Keep every tap
target ≥ 44 pt. Put worker move/remove, alternate recipe, stock detail and Energy in a sheet opened from the
card/menu; do not cram three inline action rows into each tile. Long names truncate visually, not accessibly.

Also prove six-card fit at 375 × 667, targeting roughly 120–124 px per station, by reducing decorative art/padding,
not touch targets or font readability. These are layout targets, not a claim of already-verified screenshots.
Sheets/catalogues may scroll, but the normal district page should not. Increased system text size can use an
accessible scrolling fallback rather than clipping; document that exception. Use `pb-safe` and test standalone
PWA bars separately from emulated browser height.

### Worker, recipe and result sheets

- Worker picker: portraits, own Farm Level, ingredient-block eligibility and Working destination.
  A new assignment persists. No unrelated race/RPG/Puzzle level in the primary farming row.
- Recipe sheet: personal block/shared recipe gate explanation, quantity chips for kitchen batches, exact
  output/inputs and available stock, duration, worker EXP and local spot progress. Disabled Start has an
  actionable reason, not only gray styling. A larger batch must not secretly change EXP or unlock counts.
- Claim result: output icon/count, worker EXP before/after, every level crossed, new shared recipe milestones
  and district spots opened. Links to Items or the pinned meal; never imply a race-stat gain before spending.
- Cookbook: sixteen signatures, stock, ready/running counts and shopping plans. One reasonable default
  substitution avoids forcing a picker on every Repeat; revalidate the concrete inputs before spending.

### Extra Stats

Keep the existing separation of Constellation / Inspiration / Extra Stats and selected distance preset. Show
`Block 1 · Scenarios 1–5`, shared bought count, selected scenario's capacity, stat totals and recipe inventory.
The five clusters and central sun form a readable constellation; use icon/shape labels as well as colour.

Tap any node for name, stat vector, meal cost/stock and Bought/Active state. Purchase and activate are separate
actions and receipts. A bought node may switch freely; another scenario/preset's active selection is never
silently overwritten. Supply an accessible list view of all nodes; a 65-dot canvas alone is not sufficient.
No full-page pan gesture that prevents vertical navigation; zoom/details must use explicit controls/sheets.

## 14. Guide and visual identity

Use the shared `PagedGuide` and guide-memory pattern, with a new guide version so the old Farm tour does not
count as having explained recipes. First-use guide: global districts/crew; ingredient blocks; raw → processed
→ cooked; personal levels vs district expansion; shared recipe gates/batches/timers; meal purchases vs free
activation; presets/capacity; Energy and debug distinction.
Reopen from a visible Help button. Teach equal stat-family costs, substitutions and why the sun is not a stronger node.

Reuse private owned Uma portraits/chibis through the verified existing asset pipeline. All new ingredient,
meal, district and Energy icons should be **original repo-native SVGs** in the existing icon style, not copied
from Hay Day, Story of Seasons, Stardew Valley or Cooking Mama. Stat mini-glyphs and block badges must remain
readable at item/portrait size; do not rely on two similar greens to distinguish districts or stat lanes.

Asset brief for implementation:

- Five district signs and empty/busy/ready station presentations; simple gardens, trees, barn, workshop, stove.
- Seven raw-family silhouettes (vegetable/fruit/milk/egg/chicken/beef/pork), vegetable/fruit shape accents and
  nine processed presentations; each has five readable stat variants. Reuse categories, not 80 bespoke paintings.
- Five single meals, ten visibly paired meals, one sun banquet, one Energy icon. Pair symbols cannot overlap
  into an unreadable five-colour blob. Reuse silhouettes across blocks with an explicit numbered crest.
- Worker portrait with a small Farm Level badge; local spot-progress marker, no expertise stars or costume art required.

Use shared `MinigameShell`/headers, sheets, stat glyphs and `m.*` under `LazyMotion strict`. Animate transform and
opacity only; reduce motion disables flourishes but not progress labels. Deadline progress is derived from
timestamps; cosmetic movement is delta-timed. Farm routes stay lazy; startup ≤ 180 KB gzip.

## 15. Save, transactions and second-device behaviour

The current Farm is one synced row plus Items/ledger and Uma writes. Its append-only harvest evidence is useful,
but derived XP from old evidence must not resurrect reset progress. New ingredient spends also cannot rely on
independent last-write-wins stock/Farm writes. The implementation needs an explicit **versioned Farm command
lane**, integrated with existing `/api/sync`, before enabling input-consuming jobs in production.

Command responsibilities:

| Command | All-or-nothing effects |
|---|---|
| Assign/move idle worker | Station ownership and one-station-per-outfit check |
| Start raw job | Worker/gate/slot checks; frozen job; next attempt index |
| Start processing/cooking | Above plus shared recipe/personal block checks, exact batch-sized multi-input spend, ledger evidence and frozen recipe/quantity |
| Claim job | Output stock, personal XP, exactly one district-progress increment, recipe/spot milestones and terminal receipt; station becomes idle |
| Spend Energy | One stock decrement, one deadline adjustment and receipt |
| Buy Extra node | One meal decrement, shared block purchase and receipt; optional selected-preset activation |
| Set active nodes | Owned-node/capacity validation for exactly one scenario/preset |
| Debug grant | Fifty Energy, scoped owner evidence, unique explicit operation |

Use a persistent operation ID chosen before mutation, and a stable job identity including generation, station
and attempt. An identical retry returns the original receipt; same ID/different payload rejects. No `Math.random`
for gameplay or ID generation. Pure domain modules do no I/O; explicit API parsers and their mirror validate
the same recipes, bounds and invariants. API routes remain authenticated. No new production infrastructure.

Local starts/spends commit the job, Items, XP/unlocks, receipt and outbox in one Dexie transaction. Sync validates
authoritative revisions and applies the whole command or rejects it, with no partial debit/output. Offline
predictions must remain marked pending until canonical acceptance; if a competing device spent the ingredients,
show rejected/pending jobs honestly instead of continuing a free canonical craft. Do not build descendants from
unacknowledged stock on another device. A lost acknowledgement retries the original command, not another job.

Different stations can progress concurrently; command references must be bounded to the economic/worker/build
entities actually read, not all outfits and every historical job. Test transport worst cases against current
sync ceilings; **do not raise limits to make the Farm fit**. Keep per-job receipts/evidence separately from a
large aggregate projection, and avoid loading all historical jobs into a single unbounded save document.
Shared recipe milestones derive from checked level-crossing receipts, not an unbounded read of every worker
on every Start. Section counts and unlock milestones include this reset generation; legacy claims do not count.

When a second device opens the account, it adopts the acknowledged job with its original recipe/worker/deadline
and does not restart time or choose new ingredients. Stale assignment or claim attempts reconcile without
paying twice. Uncertain offline work is visible and must resolve before an incompatible station move/reset.
There is no ticketed run journal, combat seed, `MinigameHost`, battle engine or active-party lock for Farm.

## 16. One-time cutover: intentionally reset, narrowly scoped

**Do not execute this reset while authoring the plan.** The requested reset is a future application migration,
not permission to edit the owner save manually, grant meals or remove other progression now.

At the eventual release, one server-acknowledged account generation performs the reset exactly once. Reinstall,
retry and a second device must adopt it, not reset progress again. Old clients/evidence cannot overwrite a new
generation or rederive new Farm EXP from old harvests. Use an explicit schema/generation marker and replay guard;
pick concrete schema/Dexie versions from latest main at implementation, not stale version numbers in this draft.

Reset scope:

- Every outfit's Farm Level to 1 and Farm EXP to 0, including idle workers not currently assigned to a plot.
  No expertise fields in the recommended version. New district counters start at zero, with spots 1/1/1/3/3
  open and only Block 1 raw recipes available. Old aggregate Farm Level no longer exists as progression.
- Every old Extra Stats purchase and active configuration for every outfit/scenario/distance preset to empty.
  New block maps start unbought. No free replacement meal, purchased node, inherited Produce bonus or Farm EXP.
- Old harvest/Extra purchase receipts remain historical evidence, namespaced away from the new generation.
  Their presence must never repopulate the reset projections.

Preserve owned outfits/cards and global card stars, card sets, all racing levels/EXP/records and scenario unlocks,
CL, Inspiration slots/golds/debt/tokens, RPG/Puzzle parties/progress/backups and unrelated global Items. Clearing
Extra Stats intentionally changes racing stats; it does not reset racing progression or alter goal completion.

**Recommended treatment of unrequested reset targets:** retain existing crop inventory as clearly labeled legacy
Items with no v2 node purchasing or automatic meal conversion. Retain old raw jobs through their original
deadline and allow one final legacy claim, paying only their old crop output and **no new Farm EXP, district
progress or recipe unlocks**. Map old slots 1–6 to Garden, 7–12 to Orchard, 13–18 to Barnyard. Keep assignments
only where a new spot starts open; workers from the other old plots return to the Available crew after their
legacy claim (or immediately if idle). Running jobs on now-locked spots appear in an explicit legacy-jobs list,
so they never become inaccessible or grant a free unlocked spot. Workshop/Kitchen start unassigned. This layout
mapping is a reviewable migration policy; do not silently discard jobs, owned outfits or inventory.

Before any release mutation, keep a device-local/exportable pre-cutover recovery archive through the existing
backup pattern. This is a safety archive, **not** normal preservation that restores old bonuses into the new
system. Interrupted migration must resume the same frozen reset cohort and receipts. A malformed or missing
snapshot blocks release cutover with an actionable error; no partial account clear. Test both cloud adoption
and local upgrade, old-client rejection, retries, offline boot and second-device adoption with synthetic saves.

## 17. Delivery sequence after approval

These are proposed delivery units, **not yet numbered task specs**. Each will need a full contract, fixtures,
acceptance tests and a PR; recheck the next free milestone/task numbers after owner review.

1. **Pure catalogue/progression and balance.** Original ingredient/recipe definitions, personal levels, local
   expansion/shared recipe gates, batches/deadlines, dependency arithmetic and modest Farm/stat sims. Settle
   and pin constants before consuming saves.
2. **Versioned Farm persistence/commands.** Strict domain/API formats, atomic raw/craft/claim/Energy receipts,
   offline reconciliation, bounded sync references and synthetic migration rehearsals. Keep release dormant.
3. **Thirty-station production UI.** Hub, five compact district screens, worker/recipe/cookbook/stock sheets,
   original SVGs, reusable guide, claim results and Energy/debug item flow on the real host.
4. **Shared-block Extra Stats.** Versioned 65-node template and bought sets, per-scenario/preset active selection,
   real meal purchases, readable map/list/details, cap-aware stat derivation and card-only regression fixtures.
5. **Cutover, release and owner device pass.** Verify exact reset/archive/legacy policies, all old entry points,
   lazy bundle and current regressions; deploy only the complete integrated loop. Owner verifies physical iPhone,
   real pacing, stats and second-device behaviour after release; record limitations and tune by evidence.

Do not ship the new Farm detached from its Extra Stats consumer, or reset the account while its replacement UI
is unavailable. No unrelated RPG/Puzzle rework, racing engine rebalance, Inspiration mechanics or private content
publication is required for the baseline. The already-owned Uma art can be reused without another import.

## 18. Definition review and eventual acceptance

The most important owner review points are shared block ownership/gates, the proposed production cadence, and
the independent Farm stat budget/Foundation treatment. [Open questions](../open-questions.md#farm-production-and-cooking--definition-review)
tracks them without pretending the draft numbers are settled.

Before implementation closes:

- An outfit can stay assigned, generate ingredients, process, cook, receive global Items, buy a named node
  and configure the correct distance preset. Stats change only where that scenario/preset reads them.
- Every district shows six tiles at both phone sizes, 1/1/1/3/3 open from a new/reset account, independently
  growing to 6/6/6/6/6 with no inaccessible jobs or cross-district unlock dependency; every
  touch action ≥ 44 pt, safe areas intact and VoiceOver/list/reduced-motion alternatives usable.
- Every job restores exact inputs/worker/deadline after refresh/background/offline. Duplicate claims/spends,
  stale stock, same-ID mismatches and second-device races cannot create free items or double rewards.
- Material arithmetic and synthetic progression meet full-map-by-Lv50 without Energy; card-node values are
  unchanged, Farm contributes meaningful balanced builds, and current caps/engine invariants still hold.
- The reset affects precisely the agreed Farm/Extra fields once, never old receipts rehydrating bonuses or
  unrelated game/account progress. Legacy goods/cycles are visibly identified and handled as approved.
- `pnpm lint`, `pnpm test`, `pnpm build`, relevant old/new sims pass; report startup gzip and Farm chunks.
  Isolated synthetic 390 × 844 and 375 × 667 screenshot evidence contains no owner save or extracted content.
- Owner iPhone timing/thumb/background and real-account stat/pacing checks remain explicitly pending until
  the owner performs them; browser proof cannot sign those off.
