# Uma Racer rework: Race, Farm, Train

> **Status: design for owner review, 2026-10-13 (D326–D336).** The owner's requirements, with Claude's suggestions
> accepted by the owner on 2026-10-13. Nothing here is built. Every number is a **draft** that the loop simulation
> ([12](12-economy-and-pacing.md) §12) tunes and then pins in tests. When a page here disagrees with an older design
> doc, this folder wins. Older docs are rewritten "as built" when each part lands.

This folder says what Uma Racer becomes. [`docs/rearchitecture/`](../rearchitecture/README.md) says how the code is
rebuilt underneath it. The two meet in [13](13-removals-and-plan-changes.md): the generation-2 save from the
re-architecture's Phase 2 is designed for this game, so the full wipe happens once.

## The game in one paragraph

Uma Racer is a **racing game with a passive Farm**. Each Uma climbs a **tier** of five scenarios. In each scenario she
races her career (Racing Level), while the roster works the Farm on timers (Farm Level). The Farm grows ingredients,
the Pantry crafts them and the Kitchen cooks them into dishes. A dish is the entry ticket to a **Training Hub
session**, which unlocks one piece of an Uma's build:
- a constellation node;
- an Inspiration slot, inherited unique or gold skill;
- an Extra Stats node;
- a bond with one support card.

Races pay **Prize Money**, which the Exchange turns into **Speed Tickets** (timer skips) and other goods. So a free
evening spent racing speeds up everything passive. A tier ends with a **World Expedition**: an international racing
campaign. An Uma who completes it is **promoted** to the next tier, where she starts over against a harder world.

```
             ┌──────────────────────── Prize Money · Exchange · Speed Tickets ◀──────────────────────┐
             ▼                                                                                        │
Farm: ingredients ──▶ Pantry: crafted ──▶ Kitchen: dishes ──▶ Training Hub sessions ──▶ unlocks ──▶ Racing
 (Farm Level 1–50)                                            (Observatory, Lineage Hall, Gym, Dojo)  (Racing Level 1–50)
                                                                                                        │
                                       scenario 1 → 2 → 3 → 4 → 5 → World Expedition → promotion ◀─────┘
```

## Two ways to play, one game

The owner plays in two modes, and the design serves both:

- **Busy days: check-ins on a timer.** Two or three short visits a day, each under a minute:
  1. **Collect all.**
  2. **Repeat** to restart every job and session.
  3. Glance at what each Uma still needs.

  If the owner wants them, push notifications ported from uma-rpg say when work finishes
  ([02](02-check-ins-and-notifications.md)).
- **Free time: lots of racing.** Racing is never blocked by training or Farm work. Every race pays Prize Money, and
  Prize Money buys Speed Tickets, so a long racing session moves the whole roster forward ([09](09-racing-rewards-and-exchange.md)).

## Pages

| Page | What it covers |
|---|---|
| [01 · Game loop](01-game-loop.md) | The loop step by step, one Uma's scenario, the roster in rotation, activity rules, a week of play in both modes |
| [02 · Check-ins and notifications](02-check-ins-and-notifications.md) | Collect all, Repeat, queues, the check-in summary, the "what she still needs" planner, push notifications, offline time |
| [03 · Uma progression](03-uma-progression.md) | Racing Level 1–50, scenarios inside a tier, career goals, advancing a scenario, one build per tier, what an Uma is made of |
| [04 · Tiers and promotion](04-tiers-and-promotion.md) | Three tiers of five scenarios, what resets and what carries, Uma Tickets, promotion, tier scaling, the 15th scenario, buff changes |
| [05 · Training Hub](05-training-hub.md) | Observatory, Lineage Hall, Gym and Dojo: sessions, slots, layers per scenario, constellation sizes, Inspiration and Extra Stats maps |
| [06 · Cards and bonds](06-cards-and-bonds.md) | Every SSR open from the start, no stars, bonding a card to an Uma, era and bond cost, card sets and presets, the Card Library |
| [07 · Farm](07-farm.md) | Sites, Pantry and Kitchen; Farm Level 1–50; jobs, queues and Repeat; slots and building upgrades; worker rules |
| [08 · Item catalogue and recipes](08-item-catalogue-and-recipes.md) | uma-rpg's farming half reused: 8 families × 10 grades, crafted items, every dish recipe, destinations, art ids |
| [09 · Racing rewards and the Exchange](09-racing-rewards-and-exchange.md) | Racing EXP, Prize Money, the Exchange shop, Speed Tickets, selling surplus, anti-grind rules |
| [10 · World Expeditions](10-expeditions.md) | The tier finale: all regions every tier, the eight-win rule, tier mechanics and difficulty, courses to author, rewards |
| [11 · Hub and places](11-hub-and-places.md) | Town Hall, Training, Racing and Farm pages; every place; routes; art reused from uma-art and new drawings |
| [12 · Economy and pacing](12-economy-and-pacing.md) | Currencies, sources and sinks, the 25-Uma pacing target, the time model, the loop simulation |
| [13 · Removals and plan changes](13-removals-and-plan-changes.md) | What leaves the game and why, and how the re-architecture plan's decisions and phases change |

## Decisions

Logged in [decisions.md](../decisions.md). Each page explains its own.

| # | Decision |
|---|---|
| D326 | **Race, Farm, Train.** All of an Uma's training unlocks follow one model: a timed Training Hub session that a cooked dish pays for. Constellation Level (the old Training Level), Inspiration tokens and their Convert, Uma Puzzles, Friendship Training and every link to uma-rpg and uma-puzzle leave the game |
| D327 | **Three tiers of five scenarios.** Racing Level 1–50 and Farm Level 1–50 per tier. A tier ends in a World Expedition, and completing it promotes that Uma. At promotion everything on the Uma resets; the account's Warehouse, Prize Money, titles and buildings carry. Only promoted Umas exist in tiers 2 and 3. (Uma Tickets and Shards: see D336) |
| D328 | **Unlocks last for the whole tier**, and each scenario adds its own layer. **Racing is never blocked:** an Uma does one passive thing at a time (a Farm job or a session), but can always race |
| D329 | **Cards:** every SSR is open from the start, with no Card Coupons, no stars and no card levels; every card pays today's maximum. A card goes in an Uma's set only once it is **bonded** to her at the Dojo |
| D330 | **The Farm reuses uma-rpg's farming half:** 8 families × 10 grades, crafted at the Pantry, cooked at the Kitchen, with uma-art's icons, dishes and buildings. Mining, gathering and gear are not used. The families map to the eight places a dish can go |
| D331 | **Racing pays Prize Money.** The Exchange sells Speed Tickets, raw ingredients and building upgrades (Uma Tickets are not for sale, D336); surplus items sell back for Prize Money. Anchor: **1 Prize Money ≈ 1 minute of Uma work** |
| D332 | **World Expeditions** finish every tier. Every tier offers all regions; higher tiers add mechanics and stronger fields. Success is 8 distinct wins from the Expedition's race pool. The Expedition Map is a place on the Racing page |
| D333 | **The Hub has four pages:** Town Hall, Training, Racing (the raised Race button) and Farm. This replaces the re-architecture's Town/Training/Farm place list |
| D334 | **Pacing target:** a roster of **25 Umas** working in parallel maxes **one scenario in about 4 weeks**, so a tier takes the roster about 20 weeks. A loop simulation enforces it in CI |
| D335 | **Order of work:** the re-architecture's Phase 1 goes ahead. Phase 2's generation-2 save and wipe wait for this design and ship its save shape, so the owner starts the new game once |
| D336 | **The owner's review, 2026-10-13.** Inspiration is 24 unlocks a tier: 2 parent slots, 4 grandparent slots, 6 inherited unique skills and 12 gold skills (132 unlocks a tier). Farm Levels come at 2–3 a day, 4–5 when the Uma's running aptitude suits the family. Push notifications are optional and only a port of uma-rpg's. The grade handicaps stay as today, and difficulty assumes a fully trained Uma. Uma Tickets aren't sold: Uma Shards stay the normal unlock |

## Shared numbers (drafts)

Every page uses these. The time model and how they were sized are in [12](12-economy-and-pacing.md).

### Structure

| Thing | Value |
|---|---|
| Tiers | 3 |
| Scenarios per tier | 5: tier 1 = scenarios 1–5, tier 2 = 6–10, tier 3 = 11–15 (the 15th is Japan's next, [04](04-tiers-and-promotion.md)) |
| Racing Level | 1–50 per tier; scenario *s* of the tier covers levels 10(*s*−1)+1 … 10*s* |
| Racing EXP | 1,800 a scenario (180 a level), from races, as today |
| Career goals per scenario | G3 (Maiden), two G2s (Trials), three G1s (Main), with today's level holds |
| Farm Level | 1–50 per tier, from Farm work only; grade *g* opens at Farm Lv 5*g* − 4 (1, 6, 11 … 46) |
| Farm EXP | 1 per minute of Farm work (gathering, crafting, cooking) × her aptitude for that family (S ×1.8, A ×1.6, B ×1.2, C ×1, D ×0.9, E–G ×0.8). Level *L* → *L*+1 costs 480 + 5(*L*−1). Working without a break that's **2–3 levels a day, 4–5 at high aptitude**, as uma-rpg landed on |
| Roster | 20 Uma Tickets at the start. Then the normal unlock: every scenario gate an Uma reaches pays 1 Uma Shard, 5 Shards make 1 Uma Ticket, and a promotion pays 1. Tickets unlock Umas into tier 1 only. Target roster 25 |

### Grades follow scenarios

A tier has 10 grades and 5 scenarios, so **scenario *s* of a tier uses grades 2*s*−1 and 2*s***: roughly its first
half at grade 2*s*−1 and its second half at grade 2*s*. That's a rule of the layers, not of Farm Level. Farm Levels
come fast, and every grade is open within about a month of a tier ([07](07-farm.md) §4).

### The eight families and where their dishes go

uma-art's Duo dishes join neighbouring families on a fixed ring, so the five stats take five neighbours. Then
every stat-to-stat Duo already has art.

| Family (uma-art id) | Farm site (uma-art building) | Dish goes to | Aptitude that speeds its Farm Level |
|---|---|---|---|
| Sweets (`sweets`) | Sugar Grove (`sugar-grove`) | **Speed**: Gym room, Speed card bonds | Sprint |
| Fruits (`fruits`) | Orchard (`orchard`) | **Stamina**: Gym room, Stamina card bonds | Long |
| Fish (`fish`) | Fishery (`fishery`) | **Power**: Gym room, Power card bonds | Mile |
| Nuts & Seeds (`nuts-seeds`) | Nut Grove (`nut-grove`) | **Guts**: Gym room, Guts card bonds | End Closer |
| Herbs & Spices (`herbs-spices`) | Herb Garden (`herb-garden`) | **Wit**: Gym room, Wit card bonds | Medium |
| Grains (`grains`) | Fields (`fields`) | **Skill**: Friend and Group card bonds | Pace Chaser |
| Vegetables (`vegetables`) | Vegetable Garden (`vegetable-garden`) | **Constellation**: Observatory node unlocks | Front Runner |
| Mushrooms (`mushrooms`) | Mushroom Cave (`mushroom-cave`) | **Inspiration**: Lineage Hall slots, uniques and gold skills | Late Surger |

Ring order (uma-art's Duos): Grains – Vegetables – Mushrooms – Fruits – Herbs & Spices – Fish – Sweets – Nuts & Seeds –
Grains. The stat neighbours are Stamina–Wit, Wit–Power, Power–Speed and Speed–Guts. That gives **4 stat Duos**;
Guts–Stamina has no Duo.

### Unlocks per scenario layer (per Uma, per tier)

| Scenario of the tier | Constellation nodes | Inspiration | Extra Stats nodes | Card bonds | Total |
|---|---|---|---|---|---|
| 1 | 12 (tree of 12) | 2 parent slots, 2 parent uniques | 10 singles | 6 | **32** |
| 2 | 4 (tree of 16) | 4 parent golds, 2 grandparent slots | 10 singles + 4 Duo + 1 Sun | 3 | **28** |
| 3 | 4 (tree of 20) | 2 grandparent slots, 2 grandparent uniques | 10 singles + 4 Duo + 1 Sun | 3 | **26** |
| 4 | 4 (tree of 24) | 2 grandparent uniques, 4 grandparent golds | 10 singles + 1 Sun | 3 | **24** |
| 5 | 4 (tree of 28) | 4 grandparent golds | 10 singles + 1 Sun | 3 | **22** |
| **Tier** | **28** | **24** (6 slots, 6 uniques, 12 golds) | **62** (50 + 8 + 4) | **18** | **132** |

- **Constellation trees are re-authored** to 12, 16, 20, 24 and 28 card nodes for a tier's scenarios 1–5. Each
  scenario keeps its silhouette motif.
- **Extra Stats map per tier:**
  - a single node per stat and grade (5 × 10);
  - Duos at grades 3 and 5 (4 × 2);
  - a Sun node from each Feast at grades 4, 6, 8 and 10.
- **Active Extra Stats capacity** is 14, 18, 22, 26 and 30 nodes in scenarios 1–5. Scenario 1 has only 10 Extra
  Stats nodes, so all of them are on.
- **Node values at tier 1:** single +20, Duo +10/+10, Sun +4 to all five stats. Tier 2 multiplies them by 1.25 and
  tier 3 by 1.5.

### Time model

| Step | Minutes for grade *g* | Grade 1 | Grade 10 |
|---|---|---|---|
| Gather one raw ingredient | 90 + 5(*g*−1) | 90 | 135 |
| Craft one (Pantry) | a quarter of gathering | 22.5 | 33.75 |
| Cook one dish (Kitchen) | 240 + 10(*g*−1) | 240 | 330 |
| One Training Hub session (one unlock) | 180 + 15(*g*−1) | 180 | 315 |
| A planet dish's inputs | 4 crafted of its family at *g*, 1 crafted side of another family at max(1, *g*−2) | | |

One unlock is about 16 Uma-hours at grade 1 and 25 at grade 10: its dish chain plus its session. With 25 Umas each
working 75% of the day, every scenario takes the roster **29–30 days** ([12](12-economy-and-pacing.md) §5).

### Money

| Thing | Value |
|---|---|
| Prize Money anchor | 1 Prize Money ≈ 1 minute of Uma work |
| Speed Ticket | 30 Prize Money; takes 30 minutes off one running job or session |
| Prize for a win (draft) | Debut/Maiden 60 · Pre-OP 80 · OP 100 · G3 150 · G2 200 · G1 300; 2nd pays 40%, 3rd 20% |
| Selling | A third of an item's work value in Prize Money |

## Glossary

| Term | Meaning |
|---|---|
| **Tier** | Five scenarios and an Expedition. Each Uma is in exactly one tier |
| **Scenario layer** | What a scenario adds to an Uma's build: nodes, slots, Extra Stats and bonds to unlock |
| **Session** | Timed unlocks at one Training Hub facility for one Uma: 1–10 of them one after another, each paid for with one dish |
| **Job** | One timed Farm task: gather, craft or cook 1–10 items one after another |
| **Bond** | A card unlocked for one Uma, for the rest of her tier |
| **Racing Level / Farm Level** | An Uma's two levels inside a tier, each 1–50 |
| **Promotion** | Completing the tier's World Expedition; the Uma moves to the next tier and starts over |
| **Prize Money** | What races pay; spent at the Exchange |
| **Speed Ticket** | 30 minutes off one running job or session |

## Read first

- [docs/rearchitecture/README.md](../rearchitecture/README.md): the technical rebuild this design rides on.
- [docs/research/world-expeditions.md](../research/world-expeditions.md): the 13 Expedition race pools.
- uma-rpg's [farm](https://github.com/luismlorenzana/uma-rpg/blob/main/docs/design/farm.md), [kitchen](https://github.com/luismlorenzana/uma-rpg/blob/main/docs/design/kitchen.md),
  [items](https://github.com/luismlorenzana/uma-rpg/blob/main/docs/design/items.md) and [loops](https://github.com/luismlorenzana/uma-rpg/blob/main/docs/game/loops.md) pages (sibling repo):
  the farming design and art this reuses.
