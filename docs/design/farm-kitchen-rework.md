# Uma Farm — production and cooking rework

> **Owner-review draft · 2026-10-08 · not implemented.** This is the proposed replacement for
> [Stable Farm](farm.md) and its [Extra Stats grid](constellations.md#extra-stats), not a description of production.
> The owner's requirements are distinguished from recommendations below. Candidate numbers do not change the
> running game or its domain pins. Approve/revise this definition before assigning implementation task numbers.

## 1. Intent and boundaries

Farm becomes the third independent, global activity beside Uma RPG and Uma Puzzles. Its enjoyment comes from
managing a persistent outfit crew, planning ingredients, mastering production jobs and completing a cookbook.
Its practical reward is enough configurable Extra Stats to support a balanced racing build when the available
card set does not cover every stat. It must not become another mandatory turn-based training session.

The main loop is **assign outfit → grow/gather → process → cook → spend meal → configure Extra Stats → race**.
Inputs and outputs always live in the existing global Items inventory. Farm remains accessible directly from
Home without first selecting an Uma. Farm Level and expertise are per **outfit**, unrelated to racing levels,
CL, card stars, RPG or Puzzle Level. Assigning an outfit to Farm does not make her unavailable in those modes.

### Requirements already specified by the owner

- Five districts, six stations each, all thirty stations available immediately. Remove aggregate Farm Level
  and plot-unlock progression; keep permanent worker assignments.
- Vegetables and orchards provide Speed/Stamina/Wit ingredients. Barns provide Speed/Power/Wit ingredients.
  Factories consume ingredients; kitchens make the final unlock consumables. Only final meals unlock nodes.
- Processing preserves an ingredient's stat identity and doubles its contribution to a recipe.
- One outfit Farm Level gates work. Five separate district expertise tracks, each with five ranks; a rank
  takes one Farm level's worth of work and permanently removes thirty minutes from that tier's jobs.
- Base job time eight hours; mastered time five hours thirty minutes. No compulsory return at the deadline.
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
| Farm level gates | One 50-level ingredient block: raw work at local Lv1, factories at Lv6, kitchens at Lv9 | Makes early cooking possible; avoids unlocking the last scenario's kitchen only at Lv49 |
| Guts ingredients | No sixth raw lane; hearty recipes combine Stamina and Power ingredients to make Guts meals | Respects the owner's three stat types per raw district |
| Processing's double value | One processed unit has two ingredient-potency units; not a direct racing-stat buff | Ingredients are only inputs, and activating a purchased node is not another meal consumption |
| Expertise scope | Per outfit × district × five-scenario block; completed work earns Farm EXP and expertise together | A new tier offers mastery again, without erasing older mastery or spending level EXP |
| Proposed progression | 48 EXP/level; 12 EXP/job; raw yield 4, processed batch 2, meal yield 1 | Around two days/level at two claims/day; full-map production fits before Lv50 |
| Proposed Extra Stats | 65 nodes; each active node distributes 60 raw points; capacity 16 + 2 × (scenario index − 1) | Equal total value for single/dual/all nodes, with linear capacity growth |

These choices, including every new balance number, are **proposals**, not additional owner approvals.

## 2. What changes from production

| Current implementation | Rework |
|---|---|
| Eighteen plots; aggregate levels unlock them | Thirty fixed stations across five fully open districts |
| Every plot grows any stat's scenario crop | District-specific raw goods, recipes and input-consuming jobs |
| 24 EXP/level; raw harvest pays 12 EXP and one crop | Candidate 48 EXP/level; every completed job pays 12 EXP, with batch yields |
| Crop access every ten levels, older rows faster | Five-scenario ingredient blocks; local action gates and explicit expertise |
| Per-scenario 20-node grid, six active, +40 each | Per-block 65-node map, scenario-specific active capacity, candidate +60 total/node |
| Direct crop purchases costing 1/2/3/4 | One matching cooked meal per physical node, no sequential purchase costs |
| Existing 240-point Extra Stats allowance subtracted from the card pool | Preserve current card-node values; add an independently budgeted Farm contribution |
| Debug action shifts all running jobs | Debug grants Energy; a deliberate spend advances one job |

The current guide also still describes older timer/Produce rules. Replace it as part of the new Farm UI rather
than carrying those instructions into the rework. Do not use its stale copy as a rules source.

## 3. Districts and station ownership

| District | Six station IDs | Jobs | Raw stat lanes |
|---|---|---|---|
| Vegetable Garden | `garden-1` … `garden-6` | Plant/harvest vegetables | Speed, Stamina, Wit |
| Orchard | `orchard-1` … `orchard-6` | Tend/collect fruit and berries | Speed, Stamina, Wit |
| Barnyard | `barn-1` … `barn-6` | Gather animal produce | Speed, Power, Wit |
| Workshop | `workshop-1` … `workshop-6` | Can, juice and process raw goods | Preserves the raw ingredient's stat |
| Kitchen | `kitchen-1` … `kitchen-6` | Cook single/dual/all-stat meals | Recipe-defined unlock signatures |

A station has zero or one owned outfit. One outfit can hold at most one station across all five districts.
Empty stations are usable from day one; assignment is not enrollment, a purchase or a level unlock. Workers stay
assigned after collection, reload, navigation and sync. A worker picker shows Available and Working sections,
Farm Level and expertise, and an explicit destination for a move. Moving an idle worker is free. Moving a busy
worker is blocked until the job is claimed; the UI offers a jump to that station, not silent cancellation.

An assigned idle station can be assigned a different eligible recipe without reselecting the outfit. A saved
last recipe is a convenience only: **Repeat** still requires a deliberate start and sufficient ingredients.
No offline auto-repeat, invisible ingredient reservations, farm currency, seeds to buy, paid station upgrades,
watering, animal feeding, disease, withering, spoilage or random crop quality in the first version.

Barn jobs represent a stylized supply activity, not a combat/animal-slaughter animation. A station can change
between milk/eggs/meat jobs while idle; livestock ownership and feed production are out of scope.

## 4. Ingredient blocks and Farm Level

Use the scenario registry's stable order, not hard-coded English names, to resolve a block:

`block = 1 + floor((scenarioIndex − 1) / 5)`

| Block | Scenario indices | Lifetime Farm levels introducing its chain |
|---|---|---|
| 1 | 1–5: URA Finale through Grand Masters | 1 raw · 6 processing · 9 cooking |
| 2 | 6–10: Project L'Arc through Twinkle Legends | 51 raw · 56 processing · 59 cooking |
| 3 | 11–15: Design Your Island onward; only four exist today | 101 raw · 106 processing · 109 cooking |

Farm Level never resets or caps at 50. Total EXP is authoritative; level is `1 + floor(totalExp / 48)` in this
candidate curve. A block starts at `1 + 50 × (block − 1)`. The local levels 1–5, 6–8 and 9–10 introduce raw,
processed and cooked activities respectively. After that, those activities remain available through the block
and forever afterwards. An outfit at Lv51 can still cook Block 1 meals even though Block 2 cooking needs Lv59.

**This is a deliberate recommendation:** do not repeat the same processing/cooking unlock every ten levels
inside a shared block. Doing so would contradict the idea that Scenario 1 can buy the full shared map, unless
later scenarios merely add optional flavours. If the owner wants five separate ten-level recipe ladders,
rewrite both access gates and the full-map production proof before implementation.

An outfit may farm unlocked ingredient blocks before reaching their racing scenario. Consumption requires a
real scenario unit in that block; Farm never creates scenarios or raises racing/CL. Display block labels as
scenario ranges with the actual registry names, so future scenarios do not require another hard-coded gate.

Every completed raw, factory or kitchen job gives its worker **12 Farm EXP**. Starting, waiting, assigning,
Energy use and purchasing Extra Stats give no Farm EXP. Four completions advance one level; excess EXP banks.
There is no diminishing EXP for old blocks: old ingredients remain useful for newly acquired outfits. A
max-level worker cooking for another outfit still gains her own EXP; the consumer does not inherit it.

## 5. Expertise and deadlines

Each outfit has five independent expertise meters **in each ingredient block**, one per district. A completed
job adds 12 expertise EXP to its district as well as 12 Farm EXP. Every 48 expertise EXP earns a rank, up to five.
Farm EXP is not spent or divided among the tracks. Four garden harvests earn Garden rank 1; four workshop jobs
earn Workshop rank 1. Doing garden work does not train orchard or kitchen expertise.

| Rank at start | Duration of a new job |
|---|---|
| 0 | 8h |
| 1 | 7h 30m |
| 2 | 7h |
| 3 | 6h 30m |
| 4 | 6h |
| 5 | 5h 30m |

Rank is capped; excess expertise EXP does not shorten jobs below 5h30 or pretrain the next block. Earlier ranks
remain stored and useful on earlier recipes. Farm Level itself does not also shorten the timer. A recipe's
block, job kind, worker, expertise rank, rules version and deadline are frozen when it starts. Level/rank changes
never retroactively change an existing deadline. A ready job waits indefinitely and grants nothing until claimed.

Use elapsed timestamps, not an always-running timer simulation; closed/offline time counts. Keep the existing
personal-game trusted-clock policy visible: clock movement can affect readiness. Save deadlines as integer
timestamps and reconcile them on foregrounding; no server anti-cheat or new clock service is proposed.

At two completions a day a level takes about two days. Mastery permits three daily completions only if the owner
actually returns at those times; do not advertise automatic three-per-day yields or a guaranteed calendar date.

## 6. Raw catalogue

Names are original recipe definitions, not extracted game content. The same family catalogue is namespaced by
ingredient block; a Block 1 carrot is not a Block 2 carrot. The icon can reuse its original silhouette with a
clear block badge. Raw harvests cost no inventory and yield **four units** per completed job.

| District | Raw family | Ingredient stat | Job label |
|---|---|---|---|
| Garden | Carrot | Speed | Grow carrots |
| Garden | Potato | Stamina | Grow potatoes |
| Garden | Spinach | Wit | Grow spinach |
| Orchard | Apple | Speed | Pick apples |
| Orchard | Banana | Stamina | Pick bananas |
| Orchard | Berry | Wit | Gather berries |
| Barnyard | Egg | Speed | Gather eggs |
| Barnyard | Chicken | Power | Gather chicken portions |
| Barnyard | Beef | Power | Gather beef portions |
| Barnyard | Pork | Power | Gather pork portions |
| Barnyard | Milk | Wit | Gather milk |

No raw Guts ingredient is added. Its food identity is **hearty nourishment**, produced by combinations containing
Stamina and Power ingredients. These are recipe rules, not another invisible Farm aptitude or a sixth district.
All raw families in a block open together at its raw gate; choosing additional flavours is not another stat gate.

## 7. Workshop catalogue and processing value

A workshop job consumes **two units of one raw family at start**, then produces **two units of the corresponding
processed ingredient at claim**. Each processed unit has **two potency units** of its ingredient stat, versus one
for a raw unit. Processing adds value through work; it does not spend racing stats or double an active node.

| Process | Raw families accepted | Output identity |
|---|---|---|
| Canned vegetables | Carrot / Potato / Spinach | Canned carrot / potato / spinach; same stat |
| Canned fruit | Apple / Banana / Berry | Canned apple / banana / berry; same stat |
| Vegetable juice | Carrot / Spinach | Carrot juice (Speed) / green juice (Wit) |
| Fruit juice | Apple / Banana / Berry | Apple / banana / berry juice; same stat |
| Cheese | Milk | Cheese (Wit) |
| Mayonnaise | Egg | Mayonnaise (Speed) |
| Cured ham | Pork | Ham (Power) |

Use fourteen explicit processed definitions, not a free-form ingredient editor. The recipes below identify a
processed **slot** by stat and allow a bounded substitution list within that stat: e.g. canned banana and banana
juice both fill a Stamina processed slot. The canonical version is what the cookbook shows first and what the
production arithmetic uses. Substitution never changes the meal's signature, yield, timer, EXP or node reward.

No replacing a processed slot with raw food in v1: the workshop must remain part of the loop. No substitutions
between blocks or stat lanes. Display the chosen input item and exact quantity before starting and freeze them
in the job. Missing ingredients cannot become a negative stack or be borrowed from another running job.

## 8. Cookbook and kitchen jobs

One recipe makes **one meal** in one kitchen job. Choose the recipe first, then choose any permitted substitutions;
do not ask the player to guess a hidden recipe from a bag of ingredients. Every listed quantity is one unit.
Each recipe contains both raw and processed ingredients. A meal's explicit signature buys one matching node;
it is not a generic bundle of stat points to split across nodes.

### Five single-stat meals

Each single-stat meal has ten purchases to fund on the map.

| Meal | Unlock signature | Canonical raw + processed ingredients |
|---|---|---|
| Quick-Step Salad | Speed | Carrot + Mayonnaise |
| Endurance Mash | Stamina | Potato + Canned banana |
| Power Roast | Power | Chicken + Ham |
| Hearty Curry | Guts | Potato + Ham |
| Clear-Mind Parfait | Wit | Berry + Cheese |

Power Roast and Hearty Curry have different raw inputs and preparation; their names/recipes are not inferred
from a generic sum of stat tags. Meals express a build choice, not real-world nutrition claims.

### Ten dual-stat meals

Each unordered stat pair has one bridge node on the map.

| Meal | Unlock signature | Canonical ingredients |
|---|---|---|
| Trail Bento | Speed + Stamina | Carrot + Canned banana |
| Dash Omelette | Speed + Power | Egg + Ham |
| Courage Skillet | Speed + Guts | Carrot + Potato + Ham |
| Orchard Tart | Speed + Wit | Apple + Cheese |
| Protein Tray | Stamina + Power | Potato + Ham |
| Steady Stew | Stamina + Guts | Banana + Canned potato + Ham |
| Garden Gratin | Stamina + Wit | Potato + Cheese |
| Brave Roast | Power + Guts | Beef + Canned potato + Ham |
| Scholar's Bake | Power + Wit | Chicken + Cheese |
| Comfort Casserole | Guts + Wit | Potato + Ham + Cheese |

Protein Tray and Hearty Curry deliberately share ingredients, but are separate named preparations and outputs.
There is no ambiguity because a job starts from a selected recipe ID, never automatic ingredient inference.

### All-stat meal

**Sunrise Banquet**: Carrot + Banana + Ham + Cheese + Canned spinach. It buys one of the five central Sun nodes.
Its ingredients combine Speed, Stamina, Power and Wit; the hearty Stamina/Power combination supplies Guts identity.
The player needs five banquets for all five Sun nodes, not five different compulsory rare recipes.

The catalogue has **sixteen meal families** per block. Single-stat nodes share their stat's meal; the ten dual
recipes each match their pair. Later blocks initially reuse these readable recipes with tiered ingredients;
new original names/art can enrich them after balance, without multiplying the required shopping list.

### Planning tools, not chores

- Pin up to three desired meals. A shopping list recursively counts raw and processed shortages and subtracts
  outputs of known running jobs separately from stock; never pretend unclaimed stock can be spent.
- A missing input links to its district and eligible workers. Recipe sheets show batch size, readiness, Farm
  EXP, expertise progress and the exact node signature before confirmation.
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
| Single | +60 to its stat | 1 node |
| Dual | +30 to each of two stats | 1 node |
| Sun | +12 to each of all five stats | 1 node |

Every node contributes **60 total raw points**, so all-stat nodes are flexible rather than strictly stronger.
Ten pure nodes give +600 to one weak stat; its four pair bridges add up to +120 and the five Suns add +60, a
maximum +780 from the full map to one stat before other modifiers/caps. That does not guarantee every weak stat
can be maximized simultaneously: those purchases still compete for active capacity.

Candidate capacity is **`16 + 2 × (scenarioIndex − 1)`** for the present registry:

| Scenario range | Active capacities | Maximum total raw Farm contribution |
|---|---|---|
| 1–5 | 16 / 18 / 20 / 22 / 24 | 960 / 1,080 / 1,200 / 1,320 / 1,440 |
| 6–10 | 26 / 28 / 30 / 32 / 34 | 1,560 / 1,680 / 1,800 / 1,920 / 2,040 |
| 11–15 | 36 / 38 / 40 / 42 / 44 | 2,160 / 2,280 / 2,400 / 2,520 / 2,640 |

The block resets **purchases**, not the scenario progression slope. Capacity continues to grow by two nodes
per scenario. The new map can eventually use more nodes than the old map, but still needs its own production.
Only indices 1–14 exist today; Scenario 15 is an extension example, not a new authored scenario. The formula
must not silently exceed the physical template; before a future Scenario 26 would need 66 active nodes, extend
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
4. Foundation currently multiplies Extra Stats by 1.5. Do not apply that multiplier to the new 960-point pool
   unnoticed. **Candidate:** retain its maximum historical 120-point extra help as a bounded flat +24 to each
   stat in Scenario 1, gated on at least one active Farm node, outside growth scaling. This changes its shape
   and needs explicit balance approval, docs, pins and a decision before implementation.
5. Keep the existing final stat caps, race engine, skill SP, aptitudes and Inspiration calculations. Document
   the old combined-budget invariance as superseded only for Farm; card-only invariance must still hold.

The owner's 1600-Speed example cannot be a Scenario 1 acceptance target: its current Speed cap is 1200.
Use those example builds as **later-scenario directional targets**, not permission to raise existing caps.
Check the displayed result by source: base/cards, growth/buffs, Farm, then cap. The Farm page should explain
which missing stats a build can repair and which desired gains are already capped.

## 11. Production arithmetic and pacing

For one full shared map the bill is **50 single meals + 10 dual meals + 5 Sunrise Banquets = 65 meals**.
Using the canonical recipes above and exact batch rounding:

| Work | Needed jobs | Output/detail |
|---|---|---|
| Raw gathering | 43 | 172 raw units; covers direct ingredients and processing inputs |
| Workshop | 41 | 82 processed units; 78 consumed by meals, 4 surplus from batch rounding |
| Kitchen | 65 | Exactly the 65 unlock meals |
| Total | **149** | **1,788 Farm EXP**, reaching Lv38 with 12 EXP banked |
| Road to Lv50 | **196** | 2,352 EXP; **47 jobs** of slack beyond the full-map bill |

The bill needs 153 raw units including rounded processing inputs, leaving 19 raw units from harvest rounding.
Cookbook substitutions may alter the per-family rounding; the actual selection must be simulated, not assumed
to have precisely this bill. Thirty-two raw claims reach Lv9, so a solo producer can front-load necessary
ingredients and unlock both processing and cooking without deadlock. The canonical bill includes 43 raw claims.

This proves **material/work sufficiency**, not that every possible player's order spends the stock correctly.
The promise assumes production is directed to the map instead of repeated wasteful recipes, giving items away,
or spending the same meals on other outfits. It is an account production chain: helper outfits can contribute,
but no hidden EXP credit is assigned to the beneficiary. One outfit can also rotate among districts and make
the entire bill herself. A long-term player can leave specialists permanently assigned for a faster crew loop.

At two claimed jobs per day, 149 claims take roughly 75 days for a solo outfit, and Lv50 about 98 days. The
continuous/no-idle expertise lower bound for this bill is about 955 hours (40 days); real life, gate ordering
and station competition make it slower. Helpers reduce elapsed time, not the count of necessary jobs. Treat
these as reviewable pacing, not a reason to add unlimited automatic production or mandatory Energy use.

### Required balance work before constants ship

- A small deterministic Farm progression sim: self-sufficient outfit; fixed multi-outfit specialists; two
  daily check-ins; perfect-readiness lower bound; input shortages; block 1 → 2 → 3; reset cohort; no Energy and
  fixed Energy budgets. Trace every consumed/produced unit, unlock, rank and level, not just aggregate yield.
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
  uses have distinct operation IDs. No free harvest, Farm EXP, expertise or output until claim.
- Record cumulative acceleration separately from the original frozen duration for replay/audit. Do not move
  an immutable start time backwards or make the timer inconsistent with its displayed expertise rank.
- The existing debug affordance becomes **Grant 50 Energy**; every deliberate press adds fifty to global
  inventory with a unique receipt. It does not automatically consume them. Show the resulting balance.
- Keep the affordance explicitly labeled debug/owner-only, with the same owner access boundary as the current
  hack. Normal production recipes do not require it, and it is not a monetization system.

## 13. Phone screens and interaction

### Home and Farm hub

Home opens Farm directly. The Farm hub shows the five districts, ready/busy counts, next completion, global
stock shortcuts, cookbook wishlist and the worker list. No featured-Uma gate or aggregate Farm Level meter.
Remember the last district locally; provide a consistent Hub/Back path. Do not replace the existing Home's
RPG/Puzzle/racing entry points as part of this work.

### Six-station district

At 390 × 844, reserve safe areas and the app's actual shell/header/navigation first. Use a **2-column × 3-row
grid**, a compact district title and a horizontal five-district switch. Target roughly 140–150 px per station
card and ≤ 500 px for the grid with gaps; verify actual available height, not six cards each 224 px tall.

Each station shows the outfit's small existing portrait, item icon, idle/growing/ready state, remaining time,
Farm Level, a compact expertise marker and **one primary action**: Assign / Choose / Collect. Keep every tap
target ≥ 44 pt. Put worker move/remove, alternate recipe, stock detail and Energy in a sheet opened from the
card/menu; do not cram three inline action rows into each tile. Long names truncate visually, not accessibly.

Also prove six-card fit at 375 × 667, targeting roughly 120–124 px per station, by reducing decorative art/padding,
not touch targets or font readability. These are layout targets, not a claim of already-verified screenshots.
Sheets/catalogues may scroll, but the normal district page should not. Increased system text size can use an
accessible scrolling fallback rather than clipping; document that exception. Use `pb-safe` and test standalone
PWA bars separately from emulated browser height.

### Worker, recipe and result sheets

- Worker picker: portraits, own Farm Level, selected block's five expertise ranks and Working destination.
  A new assignment persists. No unrelated race/RPG/Puzzle level in the primary farming row.
- Recipe sheet: gate explanation, output/signature, selected exact inputs and available stock, job duration,
  worker EXP/rank progress. Disabled Start has an actionable reason, not only gray styling.
- Claim result: output icon/count, worker EXP before/after, every level crossed, expertise progress/ranks,
  and relevant new work access. Links to Items or the pinned meal; never imply a race-stat gain before spending.
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
→ cooked; expertise/timers; meal purchases vs free activation; presets/capacity; Energy and debug distinction.
Reopen from a visible Help button. Teach Guts' hearty recipe identity and why the sun is not a stronger node.

Reuse private owned Uma portraits/chibis through the verified existing asset pipeline. All new ingredient,
meal, district and Energy icons should be **original repo-native SVGs** in the existing icon style, not copied
from Hay Day, Story of Seasons, Stardew Valley or Cooking Mama. Stat mini-glyphs and block badges must remain
readable at item/portrait size; do not rely on two similar greens to distinguish districts or stat lanes.

Asset brief for implementation:

- Five district signs and empty/busy/ready station presentations; simple gardens, trees, barn, workshop, stove.
- Eleven raw-family icons; processed category silhouettes (can/bottle/cheese/mayo/ham) with source accents.
- Five single meals, ten visibly paired meals, one sun banquet, one Energy icon. Pair symbols cannot overlap
  into an unreadable five-colour blob. Reuse silhouettes across blocks with an explicit numbered crest.
- Worker portrait with a small Farm Level badge, five-rank expertise marker and no extra costume art required.

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
| Start processing/cooking | Above plus exact multi-input spend, ledger evidence and recipe snapshot |
| Claim job | Output stock, both XP tracks, terminal receipt, station becomes idle |
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

- Every outfit's Farm Level to 1, Farm EXP to 0 and all new expertise to 0, including idle workers not currently
  assigned to a plot. Old aggregate Farm Level no longer exists as progression.
- Every old Extra Stats purchase and active configuration for every outfit/scenario/distance preset to empty.
  New block maps start unbought. No free replacement meal, purchased node, inherited Produce bonus or Farm EXP.
- Old harvest/Extra purchase receipts remain historical evidence, namespaced away from the new generation.
  Their presence must never repopulate the reset projections.

Preserve owned outfits/cards and global card stars, card sets, all racing levels/EXP/records and scenario unlocks,
CL, Inspiration slots/golds/debt/tokens, RPG/Puzzle parties/progress/backups and unrelated global Items. Clearing
Extra Stats intentionally changes racing stats; it does not reset racing progression or alter goal completion.

**Recommended treatment of unrequested reset targets:** retain existing crop inventory as clearly labeled legacy
Items with no v2 node purchasing or automatic meal conversion. Retain old raw jobs through their original
deadline and allow one final legacy claim, paying only their old crop output and **no new Farm/expertise EXP**.
Keep existing workers by mapping old slots 1–6 to Garden, 7–12 to Orchard, 13–18 to Barnyard; Workshop/Kitchen start
empty. Legacy jobs block their mapped station until claimed, then use the new rules. This preserves assignments
and goods without migrating the levels/unlocks the owner explicitly wants reset. If the owner wants an empty
field too, obtain that separate choice rather than deleting ongoing jobs/inventory by inference.

Before any release mutation, keep a device-local/exportable pre-cutover recovery archive through the existing
backup pattern. This is a safety archive, **not** normal preservation that restores old bonuses into the new
system. Interrupted migration must resume the same frozen reset cohort and receipts. A malformed or missing
snapshot blocks release cutover with an actionable error; no partial account clear. Test both cloud adoption
and local upgrade, old-client rejection, retries, offline boot and second-device adoption with synthetic saves.

## 17. Delivery sequence after approval

These are proposed delivery units, **not yet numbered task specs**. Each will need a full contract, fixtures,
acceptance tests and a PR; recheck the next free milestone/task numbers after owner review.

1. **Pure catalogue/progression and balance.** Original ingredient/recipe definitions, expertise, worker gates,
   deadlines, dependency arithmetic and modest Farm/stat sims. Settle and pin constants before consuming saves.
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
- Every district shows six stations at both phone sizes, all thirty open from a new/reset account; every
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
