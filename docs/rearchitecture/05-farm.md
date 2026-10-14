# 05 · Farm mechanics

> **Superseded by [rework/07](../rework/07-farm.md) and [rework/08](../rework/08-item-catalogue-and-recipes.md)
> (D330).** Today's Farm (M031) is deleted in phase 3 rather than carried through the rebuild. This page still
> describes the Farm as built until then.

The Farm (the "Stable Kitchen", M031, live since D315) keeps its rules through the rebuild. What changes is everything
around them:
- the legacy rules and every one-time reset and recovery machine are deleted;
- timers run on the shared idle math (`uma-idle`);
- writes become typed operations in the one sync lane;
- the screen becomes a pixel-art Farm scene reached from the Hub's Farm page.

New Farm content and pacing are for the owner's feature docs; §7 lists the hooks they plug into.

## 1. The Farm as built

The full design is [design/farm-kitchen-rework.md](../design/farm-kitchen-rework.md); its technical contract is
[technical/farm-kitchen-implementation.md](../technical/farm-kitchen-implementation.md). In short:

| Rule | As built |
|---|---|
| **Districts and stations** | Five districts of six stations, all 30 open from the start: Vegetable Garden, Orchard, Barnyard (raw), Workshop (processing), Kitchen (cooking) |
| **Workers** | An owned outfit, one station at most. Assigning doesn't lock her out of racing or Puzzles. Moving an idle worker is free; a busy one waits for her claim |
| **Jobs** | Every job takes **6 hours**. Raw jobs yield 6 and cost nothing; processing turns 6 raw into 6 processed; cooking makes 1–4 meals and spends its inputs at Start. A job's inputs, batch, worker, rules version and deadline are frozen when it starts; a ready job waits until claimed |
| **Farm Level** | Per outfit, uncapped: **12 Farm EXP per claimed job, 24 EXP a level** (two claims). Batches don't multiply EXP |
| **Ingredient blocks** | Scenarios group by five into blocks. A worker needs personal Lv 1, 51 or 101 for block 1, 2 or 3. The first worker to reach block-local Lv 6 opens processing for the account, Lv 9 opens cooking |
| **Catalogue** | 1,169 original item definitions: raw (7 families × 5 stats) and processed (9 × 5) per scenario; 16 meals per block (5 pure, 10 pair, 1 Sunrise Banquet) |
| **Extra Stats** | One meal buys one node on the outfit's 65-node map for that block: 50 single (+20), 10 dual (+10/+10), 5 Sun (+4 each). Any node can be bought first. Active nodes are chosen per scenario and per distance preset; capacity is 18 + 2 × (scenario index − 1). Farm stats apply after card growth and before caps |
| **Energy** | A global item: advances one running job by 30 minutes; never grants output or EXP by itself |
| **Collect all** | Claims every ready job, with a receipt each |
| **Pacing** | One full block map is 65 meals: about 87 jobs (40 raw, 20 Workshop, 27 Kitchen), 1,044 Farm EXP. One worker alone takes about 44 days at two claims a day; a crew in parallel is much faster |
| **Not in it** | No auto-repeat, queues, spoilage, quality rolls, seeds, upgrades or minigame. The Farm is not a minigame-kit run |

## 2. What the rebuild deletes

None of these change a rule a player can see. Each exists only to carry old data, and the wipe ([07](07-data-reset.md))
removes that data.

| Deleted | Why it existed |
|---|---|
| v1/v2 Farm rules, types, progression, reconciliation, legacy (`packages/domain/src/farm/{rules,progression,reconciliation,legacy}.ts`, legacy parts of `types.ts`), `FarmScreen.tsx`, `game/farm/host.ts`, `game/farm/view.ts`, `sim:farm:legacy` | The plot and crop Farm before M031 |
| The cutover: `farm/kitchen/cutover.ts`, `farmCutover`, `farmCutoverPages`, "Archive and prepare Farm", `/api/farm/prepare` | The one-time protected reset into M031 (T120, D307, D319) |
| Recovery: `farmRecovery`, `farmPending`, the whole-account archive and its export (`backup.ts`, `FarmKitchenRecovery.tsx`) | Protection during that reset |
| The Puzzles-bank guard on every Farm operation (D320) | Ordering between the Farm cutover and the Puzzle preservation |
| The farm sync lane and its exclusive sync window (D318) | Preparation flows |
| `FARM_KITCHEN_RELEASE_ENABLED`, `capability.ts`, the farm generation counter | Dormant-release gating (T118–T123) |
| The retired `extraStatsUnlocked` / `activeExtraStats` fields on Uma rows | The pre-M031 Extra Stats grid |

About 2,500 lines across the domain, web and API go, before counting the API's generated Farm copy (1,901 lines).

## 3. What carries over as it is

`farm/kitchen/catalogue.ts`, `production.ts`, `operations.ts`, `resolver.ts`, `extra-map.ts`, `types.ts`, `wire.ts`
and `extra-stats.ts` move into `@racer/domain/farm` unchanged in behaviour, with their tests. Their numbers (6 hours,
12/24 EXP, block gates, node values, capacity) stay pinned by those tests until the owner's docs change them.

## 4. The mechanical model

The Farm is described by a few pure concepts. The owner's feature docs change their **values and content**, not
their shape:

| Concept | Shape | Today's values |
|---|---|---|
| **Station** | District, index, worker (outfit id or none), current job | 5 × 6, all open |
| **Job** | Kind (raw, process, cook), recipe, frozen inputs, batch size, `startedAt`, duration, acceleration | 6 h, batches of 6 or 1–4 |
| **Recipe** | Block, kind, inputs, outputs, gate | The M031 cookbook |
| **Gate** | Personal Farm Level for the block; account milestone for processing and cooking | Lv 1/51/101; local Lv 6/9 |
| **Worker progress** | Farm EXP per claim → level | 12 per claim, 24 per level |
| **Time skip** | An item that moves one job's deadline | Energy, 30 min |
| **Sink** | What finished goods buy | Extra Stats nodes, one meal each |

**Timers on `uma-idle`.** The shared package ([02](02-platform-and-packages.md) §4) owns the math every passive
generator needs:
- when a job is ready (`startedAt + duration − acceleration`);
- its progress at a given time;
- how many outputs are claimable;
- applying a time skip;
- what's ready across many stations.

It supports both production styles in use:
- **One batch at the end** (the racer: six items when the six hours end).
- **Items one after another** (uma-rpg: each item takes its own minutes).

So either game can adopt the other's if its owner wants it. Rates and content stay in each game.

**Clock.** Elapsed timestamps, never a running simulation: closed and offline time counts, and readiness is
reconciled when the app comes to the foreground. The trusted-device clock policy stays as today.

## 5. The Farm on screen

- **The Hub's Farm page** ([04](04-hub.md) §3) shows the five districts with six slot pips each: the worker's face
  ringed by her job's progress, and a "Ready" badge.
- **A district** opens as a Phaser scene ([03](03-rendering-and-textures.md) §5.2):
  - its six stations as `uma-art` props in their state, each with its worker's chibi at work;
  - swipe to move between districts;
  - **Collect all** as a DOM button over the scene.
- **Tapping a station** opens its DOM sheet: assign or move a worker (the picker sorts by Farm Level, highest first,
  with free workers before busy ones), choose a recipe, start, use Energy, claim.
- **The Farmhouse** holds the Crew list, the Recipes and cookbook, and the Wishlist.
- **The Warehouse** (Town) is the one inventory, Farm goods included.
- **Extra Stats** stay with each Uma's training (Training Grounds), where meals are spent and nodes are switched on
  per preset.

The screens' content is today's (`FarmKitchenScreen`, `FarmExtraStatsScreen`, the sheets in `ui/farm/`), moved into
places; the 2×3 grid of cards becomes the scene.

## 6. Data and writes

| Row | Holds |
|---|---|
| `farm/main` | Stations: worker, current job (frozen inputs, batch, times, acceleration) |
| `farmWorkers/{outfitId}` | Total Farm EXP |
| `farmRecipes/b{n}` | Account milestones and cookbook counts for block *n* |
| `farmExtra/{outfitId}:b{n}` | Bought nodes, and active nodes per scenario and preset |
| `items/{itemId}`, `itemLedger` | Stacks and their movements (produce, meals, Energy) |
| `operations` (log) | One receipt per Farm operation |

Every change is an **operation** in the sync v2 lane ([01](01-target-architecture.md) §4.3). The kinds are:
`assign`, `move`, `start`, `claim`, `claim-all`, `skip-time`, `buy-node` and `set-active-nodes`. The server re-runs
each one with `@racer/domain/farm` before committing it, which replaces today's hand-kept API mirror. A retried
operation returns its first receipt and is never applied twice.

## 7. For the owner's feature docs

The plan keeps today's Farm rules, so the rebuild ships with a working Farm. The owner's docs decide what comes next.
Each item plugs into one row of §4 and needs no architecture change:

- **Timers and EXP:** the 6-hour job, 12 EXP a claim and 24 a level, the block gates.
- **Content:** families, recipes, meals, what meals buy; whether Extra Stats stay the sink.
- **Conveniences uma-rpg has:**
  - a queue per station and Repeat ×N;
  - farming targets that plan what a chosen Uma still needs (uma-rpg D100; the racer's Wishlist is its seed);
  - a push notification when jobs finish (uma-rpg's push module).
- **The Farm's place in the loop now the RPG is gone:**
  - Inspiration tokens don't come from the Farm in this plan ([06](06-rpg-decommission.md) §5);
  - a Farm source is an option for the owner's docs.
- **A fresh account has 20 Uma Tickets** ([07](07-data-reset.md)), so the crew starts at up to 20 workers for 30
  stations. That's intended ("open capacity, chosen crew"), but the early pacing is worth a look in the owner's
  rebalancing.

## 8. Done when

- The Farm's rule tests pass unchanged after the move to `@racer/domain/farm`.
- No Farm code reads a cutover, recovery, generation or Puzzles-bank row; the deleted files in §2 are gone.
- A synthetic account assigns, starts, skips, claims, cooks and buys a node through operations, and a second device
  sees the same state after one sync.
- `sim:farm` reproduces today's pacing table (one full map ≈ 87 jobs).
