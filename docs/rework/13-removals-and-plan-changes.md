# 13 · Removals and plan changes

> **Status: approved design, 2026-10-14; first written 2026-10-13 (D326–D335).** What leaves Uma Racer with the rework, what stays, and
> how the re-architecture plan ([docs/rearchitecture/](../rearchitecture/README.md), D321–D325) changes so the rework
> and the rebuild ship as one game, wiped once.

## 1. What leaves the game

The re-architecture already deletes the RPG, Spark Rival Circuit, the v1/v2 Farm and every migration, cutover and
preservation machine (D321, D322). The rework removes more. Every row below goes in the generation-2 cutover; no
feature flag, dormant code or compatibility reader stays behind (the D322 standard).

| System | What it was | Why it goes | Replaced by |
|---|---|---|---|
| **Constellation Level (CL)**, formerly Training Level | 1–10 per Uma and scenario; opened card nodes at CL1–8, raised SP to CL10; one shared level-up sheet (D211, D283, D287–D290) | The owner removes Training Levels entirely (D326) | Observatory sessions open card nodes one at a time ([05](05-training-hub.md)) |
| **Uma Puzzles** | The global five-party battle mode whose materials raised CL; PixiJS battle scene; its own preservation, bank, exchange and placeholder art (D267–D290) | It was CL's only source, and the owner removes all uma-puzzle wiring (D326) | Nothing: the Farm and Training Hub are the training loop |
| **Friendship Training** | The card minigame that earned card stars, one Training Ticket a run | Stars are gone (D329), so it has nothing to pay | Nothing |
| **Card stars and card ownership** | 0–3★ per card (D200, D255), Card Select Coupons as the only unlock (D198), the coupon at a card's first 3★ | Every card open and at full value (D329) | Bonds per Uma at the Dojo ([06](06-cards-and-bonds.md)) |
| **Inspiration tokens and Convert** | Scenario Slot and Skill tokens (D250), their exchange (D309), the advance and debt bank (D256), and D322's plan to pay them from career goals | Tokens are removed entirely (D326) | Lineage Hall sessions ([05](05-training-hub.md)) |
| **Permanent Uma Level 1–140** | One level across all fourteen scenarios, 10 per scenario (D121) | Tiers reset (D327) | Racing Level 1–50 per tier ([03](03-uma-progression.md)) |
| **Trained units** | Every unlocked scenario stayed a raceable build of its own (D190); the load-from-previous button (D288) | Unlocks last for the tier (D328), so one build per tier is enough | One build per Uma per tier, carried automatically between scenarios ([03](03-uma-progression.md)) |
| **Training Tickets** | +15 a day, cap 60; paid Friendship runs and scenario unlocks (`5 × tier`, D148) | Nothing left to buy | Advancing a scenario is free; Speed Tickets are bought with Prize Money |
| **Today's Farm** (the Stable Kitchen, M031) | Five districts × six stations, 1,169 items, 6-hour batch jobs, 12/24 Farm EXP, ingredient blocks of five scenarios, the 65-node meal-funded Extra map per block (D314, D315) | uma-rpg's farming half and uma-art's art replace it (D330) | Eight family sites, Pantry and Kitchen ([07](07-farm.md)); 253 items ([08](08-item-catalogue-and-recipes.md)); the Gym's Extra Stats map ([05](05-training-hub.md)) |
| **Energy** | A global item: 30 minutes off one running job | Renamed and bought, not granted | The Speed Ticket ([09](09-racing-rewards-and-exchange.md)) |
| **The Home list** | A scrolling column of cards | The Hub (D333) | Four Hub pages ([11](11-hub-and-places.md)) |
| **Owner gifts and dev grants in production** | Re-granted coupons (D209), the +tickets buttons | Already removed by D323 | Dev builds only |

### Achievements and badges that change

Badges and titles stay, scenario-linked as today (D122). Trainer achievements that count removed things retire:
- cards owned;
- stars earned;
- coupons redeemed;
- Puzzle and Friendship records.

[06](06-cards-and-bonds.md) lists the card ones and [04](04-tiers-and-promotion.md) the new tier and Expedition
titles. Past achievement rows don't survive the wipe, so nothing is migrated.

## 2. What stays

| Kept | Notes |
|---|---|
| The race engine (`packages/race`) | Deterministic, seeded, unchanged. Expedition mechanics may add inputs in a new engine version ([10](10-expeditions.md)) |
| Race skills, the race catalogue and course layouts | As today, with the platform's master data after its phase |
| Scenario careers and goals | G3, two G2s, three G1s, the holds and the gate (D137) |
| Cap profiles and scenario buffs | Revised where a buff named a removed system ([04](04-tiers-and-promotion.md)) |
| Constellation mechanics | Card nodes, the per-card cap, the node value formula, breadth-first unlock order, card-type splits (D180). Trees re-authored to 12–28 nodes ([05](05-training-hub.md)) |
| Inspiration's pick rules | Parents, grandparents, mirrors, aptitudes, inherited uniques and gold skills (D250's rules, without its tokens; the uniques become their own 6 unlocks, D336) |
| Card types, eras, skills, focus, Race Bonus | Every card at today's 3★ value |
| Four distance presets | Per tier now, not per scenario (D252's shape) |
| Badges, titles, flair, trophies | Scenario-linked records (D122); D107's flair overrides |
| The collection reveal | Unlocking an Uma with an Uma Ticket |
| **Uma Shards** | The normal unlock (D336): each scenario gate an Uma reaches pays 1 Shard, 5 make an Uma Ticket. Gates come once per scenario per tier now, and tickets unlock into tier 1 only ([04](04-tiers-and-promotion.md) §6) |

## 3. Changes to the re-architecture decisions

| Decision | Change |
|---|---|
| **D321** clean skeleton, rules ported | Stands. The "keep" list loses Puzzles battles, the Friendship minigame, card progression, CL spend and today's Farm rules. The rework's new rules are written fresh in the domain ([08 phases](#4-the-phases-revised), phase 2) |
| **D322** RPG deleted | Stands. Its **Inspiration-from-goal-wins** half is superseded by D326: there are no tokens. Its Convert moves nowhere; it is deleted with the tokens |
| **D323** generation 2, wipe, 20 Uma Tickets | Stands. The new account changes (§5) |
| **D324** Phaser 4 | Stands. The Puzzles are deleted in the cutover, so PixiJS is left only in the race scene until phase 8 ports it (M034) |
| **D325** uma-platform owns data, art, kit | Stands, and grows. uma-art's `items`, `dishes` and `farmlands` buildings now cover the whole Farm, so the planned new `farm` family shrinks to nothing. The `racer` buildings family is what [11](11-hub-and-places.md) lists as new. `uma-idle` adopts one-after-another production with queues, which both games now share |

And these older decisions are superseded:

| Older | Superseded by |
|---|---|
| D121 (permanent Uma Level, active scenario), D190 (trained units), D288 (load from previous) | D327, D328 |
| D130, D198 (card unlocking), D200, D255 (stars), D148 (ticket economy) | D329, D331 |
| D211, D212 (Training Levels and their bank), D283, D287–D290 (CL from Puzzles) | D326 |
| D235, D314, D315 (Extra stats from Farm crops and meals) | D326, D330 |
| D250 (tokens; its pick rules stay), D256 (advance), D309 (Convert) | D326 |
| D267 and every Puzzle decision after it | D326 |

## 4. The phases, revised

The re-architecture's phase 7 ("the owner's docs") is this folder, and its phase 8 ("the Puzzles' future") is decided:
they're deleted. The order becomes:

| Phase | Goal | Changes from [08](../rearchitecture/08-phases.md) |
|---|---|---|
| **1** | A sound base: the API on the workspace domain, budgets enforced, the live manual | Unchanged. **Can start now** (D335) |
| **2** | **The rework's rules in the domain**, pure and tested, plus `sim:loop` passing [12](12-economy-and-pacing.md)'s checks. No UI, no save change, so the live game is untouched | **New.** Tiers, layers, sessions, bonds, the Farm catalogue, recipes, Prize Money, the Exchange |
| **3** | **Clean slate and the new game.** Generation-2 save in the rework's shape, the wipe and purge, every deletion (RPG, Spark, Puzzles, Friendship, CL, stars, tokens, today's Farm), the new screens as plain DOM pages: Stable, Training Hub places, Farm places, Warehouse, Exchange, Card Library, Racecourse with Prize Money, Scenario Gate. Collect all, Repeat, queues and the planner ship here | Was phase 2; now carries the new game. **The owner starts playing here** |
| **4** | **Optional:** push notifications, a port of uma-rpg's D63/D65 setup with the racer's few changes ([02](02-check-ins-and-notifications.md) §7) | **New, and only if the owner asks** after playing the new game (D336). Nothing outside what uma-rpg already runs: the same Firestore collection, routes, Cloud Scheduler job and Secret Manager secret, set up with uma-rpg's script. About $0 |
| **5** | Platform master data and the first shared packages | Was phase 3 |
| **6** | The Hub: four pages, the place registry, art ([11](11-hub-and-places.md)) | Was phase 4, with the new place list |
| **7** | The Farm and Training Hub as pixel-art scenes on `uma-idle` | Was phase 5, now also the Training page |
| **8** | The race on Phaser | Was phase 6; PixiJS leaves the repo with it (M034) |
| **9** | **World Expeditions:** the 13 pools (136 race families), about 89 new course layouts in a private overlay, about 70 invented local champions, the Expedition Map, and `sim:expeditions` ([10](10-expeditions.md)) | **New.** All 13 must ship before the first Uma completes tier 1's last career, about **16–20 weeks after phase 3** |
| **9b** | **Race engine v10:** optional going, weather and mood-shift inputs, identical to v9 without them. Tier 3's Expedition mechanics need it. The original's ground penalties ([research/race-mechanics.md](../research/race-mechanics.md)) are researched first | **New.** Needed only before the first Uma reaches tier 3's Expedition, about a year in |

**Why the rules come before the wipe (phase 2 before 3).** The wipe should happen once, into the final save shape.
Building and simulating the rules first proves the pacing before the owner's fresh start depends on it. The domain
modules don't touch the live game, so they can land on `main` piece by piece.

**Why plain screens before the Hub.** The new game is playable as DOM pages (lists and sheets) on phase 3's day. The
canvas Hub and pixel-art scenes (phases 6–7) are presentation over the same places and routes, and the owner keeps
playing through them without another reset (the re-architecture's own argument for an early wipe).

**Expeditions have a deadline.** Nothing else in the plan has one. If phase 9 is late, the first tier-1 Umas wait at
the end of scenario 5 with racing open; nothing is lost, but it's the one step to watch. The Expedition content is
large: about 89 foreign course layouts, so it should start as soon as phase 3 ships, alongside phases 4–8.

## 5. The new account, revised

[07-data-reset](../rearchitecture/07-data-reset.md) §5 becomes:

| Field | Value | Re-architecture plan said |
|---|---|---|
| Uma Tickets | **20** | 20 |
| Uma Shards | 0; each scenario gate pays 1, and 5 make a ticket (D336) | Today's rule, renamed coupons |
| Umas | None; the owner picks 20 | Same |
| Cards | **No per-account card state.** Every SSR is open, and bonds live on each Uma | The starter set (94 cards) |
| Card Coupons | **Gone** | 3 |
| Training Tickets | **Gone** | 0, then +15 a day |
| Prize Money | 0 | — |
| Speed Tickets | 0 | — |
| Farm and Training Hub | All buildings at level 1 with their starting slots; no preparation step | Farm empty |
| Featured Uma | The first Uma unlocked | Same |

The starter card overlay ([02-platform-and-packages](../rearchitecture/02-platform-and-packages.md) §2.4) is no
longer needed: every card is open.

## 6. The save, revised

Generation 2 ([01-target-architecture](../rearchitecture/01-target-architecture.md) §5) keeps its shape: entities,
logs and operations in one sync lane. The kinds change:

| Kind | Holds |
|---|---|
| `profile/main` | Prize Money, Uma Tickets, Uma Shards, the Daily Purse (`purse`) and the Exchange's stock grade (`exchangeGrade`, [09](09-racing-rewards-and-exchange.md) §9), featured Uma, the planner's targets (up to five, in order), check-in times (up to four; default 08:00, 13:00, 22:30), Repeat's sizing setting, created at, `generation: 2` ([02](02-check-ins-and-notifications.md)) |
| `umas/{outfitId}` | Tier, scenario, Racing Level and EXP, Farm Level and EXP, career, unlocks (constellation count, Inspiration slots, uniques and golds, Extra Stats nodes, active Extra nodes per preset), bonds, four presets (card set, assignments, loadout), lineage picks, her Expedition state (runs, each run's frozen pool, wins by race family; [10](10-expeditions.md)), promotion history |
| `buildings/{id}` | Each Farm building's and Training facility's level (its slots follow from it; work rows hold them) |
| `work/{outfitId}` | Her running job or session and its queue: kind, place, recipe or unlocks, batch size, reserved inputs, start time, Speed Tickets applied, her last job for Repeat, and a dropped queue with its reason until the owner acts on it |
| `items/{itemId}`, `itemLedger` | The Warehouse |
| `badges/…` | Badge state, as today |
| Logs: `raceResults`, `ledger`, `flairEvents`, `operations` | Append-only, as today. An Expedition race's result carries a snapshot of the run (Expedition, tier, mechanics in effect) |

Every change is an **operation** re-run by the API with the domain package:
- `start` (also restarting a dropped queue), `queue` (add, remove, move, dismiss a dropped queue), `collect`,
  `collect-all`, `repeat`, `recall`, `speed-up` (one entry or all), `finish`, `upgrade`, `advance-scenario`;
- `set-targets`, `set-check-in-times` and `set-repeat-sizing` ([02](02-check-ins-and-notifications.md) §10);
- `finish-race` (a race's commit, [09](09-racing-rewards-and-exchange.md) §9), `exchange-shards`, `induct`, `feature-uma` and `set-race-defaults` (M034's specs);
- `set-active-nodes`, `set-lineage` and the preset edits (card set, assignments, loadout); a bond is an ordinary Dojo session, so it needs no operation of its own;
- `buy`, `sell`;
- `unlock-uma`, `promote`.

A retried operation returns its first receipt and is never applied twice. **Gone from the plan's save:** `cards/{cardId}`,
the `puzzle*` kinds, `farm/main`, `farmWorkers`, `farmRecipes`, `farmExtra` and the item families for tokens, Puzzle
materials and Energy.

## 7. Docs to retire or rewrite when phase 3 lands

| Doc | Fate |
|---|---|
| `docs/design/uma-puzzles.md`, `technical/uma-puzzles-implementation.md`, every `research/*puzzle*` page | Deleted (git keeps them) |
| `docs/design/minigames.md`, `minigame-kit.md` | Deleted: no minigames remain |
| `docs/design/farm.md`, `farm-kitchen-rework.md`, `technical/farm-kitchen-implementation.md` | Deleted; [07](07-farm.md) and [08](08-item-catalogue-and-recipes.md) become the Farm design |
| `docs/design/training.md`, `constellations.md`, `uma-progression.md`, `support-cards.md`, `collection.md`, `economy.md`, `scenarios.md` | Rewritten "as built" from this folder |
| `docs/design/ux.md` | Rewritten from [11](11-hub-and-places.md) |
| `docs/rearchitecture/04-hub.md`, `05-farm.md` | Marked superseded by [11](11-hub-and-places.md), [07](07-farm.md) and [08](08-item-catalogue-and-recipes.md) |
| `README.md`, `CLAUDE.md`, `AGENTS.md` | Status, doc map and commands updated |

## 8. Decided here

| Choice | Why |
|---|---|
| The rework's rules land in the domain before the wipe (new phase 2) | One wipe, into a save shape whose pacing the sim has already proved |
| The new game ships on plain DOM screens first | The owner plays the new game sooner; the canvas Hub and scenes follow without a reset |
| Push notifications are an optional port of uma-rpg's (phase 4) | The owner's rule (D336): nothing outside what uma-rpg already set up |
| Expeditions get their own phase with a deadline | The first Umas reach them about 20 weeks after the new game starts |
| PixiJS leaves with the race's port (phase 8); the cutover deletes every other PixiJS scene | Porting the race in the cutover would add risk to the riskiest phase (M034) |
| No per-account card state | Every card is open; bonds belong to Umas |

## 9. Done when

- The phase table in `docs/rearchitecture/08-phases.md` matches §4, and that folder's README points here.
- After phase 3, `git grep -i -E "puzzle|friendship|constellation level|training ticket|card coupon|inspiration token"`
  over `apps`, `packages` and `scripts` finds only the decisions log and this folder.
- The new account on the owner's iPhone matches §5, and the save holds only §6's kinds.
- After phase 8, `pixi.js` is not in any `package.json`; after phase 3, it is imported only under `scenes/race/`.
