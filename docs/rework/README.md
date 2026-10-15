# Uma Racer rework: Race, Farm, Train

> **Status: built, phase 3 (generation 2, D361).** The owner's rework (D326–D336, D338) is the game now. Phase 2
> built its rules (D340–D351) and phase 3 its screens and the generation-2 save (D352–D361), and the cutover moved
> its pages into [the manual](../game/README.md) as built. This folder keeps what isn't built yet and the plan that
> got here.

This folder said what Uma Racer would become; [`docs/rearchitecture/`](../rearchitecture/README.md) said how the code
is rebuilt underneath it. Both meet in [13](13-removals-and-plan-changes.md).

## Where each page is now

| Page | Where | What it covers |
|---|---|---|
| 01 · Game loop | [manual](../game/01-game-loop.md) | The loop step by step, one Uma's scenario, the roster in rotation, activity rules, a week of play in both modes |
| 02 · Check-ins and notifications | [manual](../game/02-check-ins-and-notifications.md) | Collect all, Repeat, queues, the check-in summary, the planner, offline time; push notifications not built (phase 4) |
| 03 · Uma progression | [manual](../game/03-uma-progression.md) | Racing Level 1–50, scenarios inside a tier, career goals, advancing a scenario, one build per tier |
| 04 · Tiers and promotion | [manual](../game/04-tiers-and-promotion.md) | Three tiers of five scenarios, what resets and what carries, Uma Tickets, promotion, tier scaling, the 15th scenario, buffs |
| 05 · Training Hub | [manual](../game/05-training-hub.md) | Observatory, Lineage Hall, Gym and Dojo: sessions, slots, layers, constellation sizes, Inspiration and Extra Stats maps |
| 06 · Cards and bonds | [manual](../game/06-cards-and-bonds.md) | Every SSR open, no stars, bonds per Uma, era and bond cost, card sets and presets, the Card Library |
| 07 · Farm | [manual](../game/07-farm.md) | Sites, Pantry and Kitchen; Farm Level 1–50; jobs, queues and Repeat; slots and building upgrades |
| 08 · Item catalogue and recipes | [manual](../game/08-item-catalogue-and-recipes.md) | 8 families × 10 grades, crafted items, every dish recipe, destinations, art ids |
| 09 · Racing rewards and the Exchange | [manual](../game/09-racing-rewards-and-exchange.md) | Racing EXP, Prize Money, the Daily Purse, featured races, the Exchange, Speed Tickets, selling |
| 10 · World Expeditions | [here](10-expeditions.md), **not built (phase 9)** | The tier finale: all regions every tier, the eight-win rule, tier mechanics and difficulty, courses to author, rewards |
| 11 · Hub and places | [manual](../game/11-hub-and-places.md) | Town Hall, Training, Racing and Farm pages; every place; routes; art |
| 12 · Economy and pacing | [manual](../game/12-economy-and-pacing.md) | Currencies, sources and sinks, the 25-Uma pacing target, the time model, the loop simulation |
| 13 · Removals and plan changes | [here](13-removals-and-plan-changes.md) | What left the game and why, the generation-2 save, and how the re-architecture's decisions and phases changed |

The game in one paragraph, the shared numbers (structure, grades, the eight families, unlocks per layer, the time
model, money) and the glossary that opened this page are [the manual's README](../game/README.md) now.

## Decisions

Logged in [decisions.md](../decisions.md). Each page explains its own.

| # | Decision |
|---|---|
| D326 | **Race, Farm, Train.** All of an Uma's training unlocks follow one model: a timed Training Hub session that a cooked dish pays for. Constellation Level (the old Training Level), Inspiration tokens and their Convert, Uma Puzzles, Friendship Training and every link to uma-rpg and uma-puzzle leave the game |
| D327 | **Three tiers of five scenarios.** Racing Level 1–50 and Farm Level 1–50 per tier. A tier ends in a World Expedition, and completing it promotes that Uma. At promotion everything on the Uma resets; the account's Warehouse, Prize Money, titles and buildings carry. Only promoted Umas exist in tiers 2 and 3. (Uma Tickets and Shards: see D336) |
| D328 | **Unlocks last for the whole tier**, and each scenario adds its own layer. **Racing is never blocked:** an Uma does one passive thing at a time (a Farm job or a session), but can always race |
| D329 | **Cards:** every SSR is open from the start, with no Card Coupons, no stars and no card levels; every card pays the old maximum. A card goes in an Uma's set only once it is **bonded** to her at the Dojo |
| D330 | **The Farm reuses uma-rpg's farming half:** 8 families × 10 grades, crafted at the Pantry, cooked at the Kitchen, with uma-art's icons, dishes and buildings. Mining, gathering and gear are not used. The families map to the eight places a dish can go |
| D331 | **Racing pays Prize Money.** The Exchange sells Speed Tickets, raw ingredients and building upgrades (Uma Tickets are not for sale, D336); surplus items sell back for Prize Money. Anchor: **1 Prize Money ≈ 1 minute of Uma work** |
| D332 | **World Expeditions** finish every tier. Every tier offers all regions; higher tiers add mechanics and stronger fields. Success is 8 distinct wins from the Expedition's race pool. The Expedition Map is a place on the Racing page |
| D333 | **The Hub has four pages:** Town Hall, Training, Racing (the raised Race button) and Farm. This replaces the re-architecture's Town/Training/Farm place list |
| D334 | **Pacing target:** a roster of **25 Umas** working in parallel maxes **one scenario in about 4 weeks**, so a tier takes the roster about 20 weeks. A loop simulation enforces it in CI |
| D335 | **Order of work:** the re-architecture's Phase 1 goes ahead. Phase 2's generation-2 save and wipe wait for this design and ship its save shape, so the owner starts the new game once |
| D336 | **The owner's review, 2026-10-13.** Inspiration is 24 unlocks a tier: 2 parent slots, 4 grandparent slots, 6 inherited unique skills and 12 gold skills (132 unlocks a tier). Farm Levels come at 2–3 a day, 4–5 when the Uma's running aptitude suits the family. Push notifications are optional and only a port of uma-rpg's. The grade handicaps stay as they were, and difficulty assumes a fully trained Uma. Uma Tickets aren't sold: Uma Shards stay the normal unlock |
| D338 | **The Gym halves, at double strength (owner, 2026-10-14).** One Extra Stats single per stat per scenario at +40, Duos +20/+20 and Suns +8 to all five, so every Gym node pays 40 at tier 1; active capacity halves to 7–15 and the Extra Stats budget is unchanged. A tier is **107 unlocks**, not 132. The time factor *k* becomes **1.2**, so a scenario still takes about four weeks |

Phase 2's rules are D340–D351 and phase 3's build is D352–D361; [the manual's architecture page](../game/architecture.md)
lists where each lives in the code.

## Read first

- [docs/rearchitecture/README.md](../rearchitecture/README.md): the technical rebuild this design rides on.
- [docs/research/world-expeditions.md](../research/world-expeditions.md): the 13 Expedition race pools.
- uma-rpg's [farm][uma-rpg-farm], [kitchen](https://github.com/luismlorenzana/uma-rpg/blob/main/docs/design/kitchen.md),
  [items](https://github.com/luismlorenzana/uma-rpg/blob/main/docs/design/items.md) and [loops](https://github.com/luismlorenzana/uma-rpg/blob/main/docs/game/loops.md) pages (sibling repo):
  the farming design and art this reuses.

[uma-rpg-farm]: https://github.com/luismlorenzana/uma-rpg/blob/main/docs/design/farm.md
