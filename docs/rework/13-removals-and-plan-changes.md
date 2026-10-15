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

Every change is an **operation** re-run by the API with the domain package. The list is `OPERATIONS`
(`rework/check-in`), rendered here:

<!-- live:operations -->
| Operation | What it does | Rules |
|---|---|---|
| `start` | Starts a job or session in a slot, or restarts a stopped queue | 07 §2, 05 §2, 02 §4 |
| `queue` | Adds, removes or moves a queued request, or dismisses a stopped queue | 07 §2, 02 §3–§4 |
| `collect` | Pays one Uma's finished items or unlocks | 07 §2, 05 §2 |
| `collect-all` | Collects every finished slot, or one place's | 02 §2 |
| `repeat` | Restarts each Free Uma's last job or session | 02 §5 |
| `recall` | Stops her running entry and returns the unmade inputs | 07 §2 |
| `speed-up` | Speed Tickets on one running entry, or Speed up all | 07 §8, 02 §4 |
| `finish` | Ends her running entry with the Speed Tickets it takes | 07 §8 |
| `upgrade` | Raises a building one level for its Prize Money and crafted items | 07 §7, 05 §7 |
| `advance-scenario` | Moves an Uma at her gate, career won, to the next scenario | 03 §5 |
| `promote` | Promotes an Uma to the next tier | 04 §3–§5 |
| `induct` | Enters a tier-3 Uma into the Hall of Fame | 04 §10 |
| `buy` | Buys Speed Tickets or raw ingredients at the Exchange | 09 §5 |
| `sell` | Sells surplus items for Prize Money | 09 §6 |
| `unlock-uma` | Unlocks an Uma with an Uma Ticket | 04 §6 |
| `exchange-shards` | Turns five Uma Shards into an Uma Ticket | 04 §6 |
| `set-targets` | The planner's targets, up to five in order | 02 §6 |
| `set-check-in-times` | The check-in times, one to four | 02 §3 |
| `set-repeat-sizing` | Repeat's same size or fit to the next check-in | 02 §5 |
| `set-card-set` | A preset's card set | 06 §3 |
| `set-assignments` | A preset's node assignments | 05 §4 |
| `set-lineage` | A preset's lineage picks | 05 §5 |
| `set-active-nodes` | A preset's active Extra Stats nodes | 05 §6 |
| `set-loadout` | A preset's equipped skills | 03 §6 |
| `finish-race` | A race's commit: her finished unlocks, Racing EXP, goals, the gate's Shard, Prize Money and the purse | 09 §9, 01 §2 |
| `dev-grant` | Dev builds and a dev API only: items, Prize Money, Uma Tickets, finished work, a jump to her gate | M034 |
<!-- /live -->

M034's T138 adds `feature-uma` and `set-race-defaults`. A bond is an ordinary Dojo session, so it needs no operation of
its own. A retried operation returns its first receipt and is never applied twice. **Gone from the plan's save:**
`cards/{cardId}`, the `puzzle*` kinds, `farm/main`, `farmWorkers`, `farmRecipes`, `farmExtra` and the item families for
tokens, Puzzle materials and Energy.

### The save as built (T134)

`@racer/domain/save-g2` holds generation 2, pure, beside today's save until T143 makes it `@racer/domain/save`. It has
no migrations, no legacy constants and no cutover rows; the API (T135) and the web save layer (T136) build on it.

- **Rows.** An entity is `{ kind, id, generation: 2, schema: 1, version, savedAt, data }`. Its `version` starts at 1 and
  rises by one for each committed sync that changes it; `savedAt` is the server's time of that commit. A log row is
  `{ kind, id, generation: 2, schema: 1, at, savedAt, data }`, where `at` is when it happened in the device's time; it
  never changes once written. Every kind is at schema 1 ([rearchitecture/01](../rearchitecture/01-target-architecture.md) §5).

| Kind | Id | `data` | Written by |
|---|---|---|---|
| `profile` | `main` | The whole `AccountProfile`: its eleven fields, `generation: 2` | Operations and the create |
| `umas` | Her outfit id | `UmaState` | Operations |
| `buildings` | A building id | `{ level }`, 1 to 3 | Operations and the create |
| `work` | Her outfit id | `WorkRow` | Operations |
| `items` | A catalogue item id, or `speed-ticket` | `{ count }`, a whole number from 0 | Operations |
| `badges` | `uma:{outfitId}` or `trainer` | Badge state, as today | The device |
| `ledger` | The row's id | `{ id, resource, delta, reason, at }`, the domain's `LedgerEntry` | Operations and the create |
| `itemLedger` | The row's id | `{ id, itemId, delta, reason, outfitId, opId, at }` | Operations |
| `raceResults` | The `finish-race` operation's id | `{ umaId, raceId, opId, at, tier, scenario, run, commit }`: the scenario she raced in, the race as it ran, and the operation's receipt | Operations |
| `flairEvents` | As today | A flair event, as today | The device |
| `operations` | The operation's id | `{ name, at, receipt }` | Operations |

- **Writers.** Only badges and flair events are written as rows by the device, as today. Every other kind changes by an
  operation, or by the create, which carries only `createdAt`: the server builds the new account's rows itself (§5).
- **No row is ever deleted.** A work row that empties is written as an empty row, and an item used up as a count of 0.
- **The state.** The rules run on the work engine's state with the whole profile. Read back from the rows, its ledger
  keeps only the rule rows (`initial-uma-tickets`, `unlock-uma`, `uma-gate-shard`, `uma-shard-exchange` and
  `promotion-uma-ticket`): the only rows a rule reads.
- **A commit.** An operation carries an id of 8–64 letters, digits, `_` or `-`, chosen before the tap is written, and the
  device's time as its `now`. Applied, it writes every entity whose data changed, and its logs: the new ledger rows; an
  item row for each of the receipt's own rows (a purchase, a sale, a dev grant) and for each Warehouse movement
  (`<id>:m<n>`, negative for a reserve, an upgrade's cost or a Speed Ticket, positive for a return or an output); a
  race's `raceResults` row; and the `operations` row. Repeated, it gives its first receipt and writes nothing. Refused,
  nothing changes and nothing is stored.
- **Sync v2.** Every request and response carries `protocol: 2` and `generation: 2`; anything else is 426
  ([rearchitecture/07](../rearchitecture/07-data-reset.md) §4). A request is the outbox in order: the create (at most
  one, and first), badge upserts (`baseVersion` 0 creates), flair appends (the first write wins) and operations. The
  response answers each change in order, and carries every row the sync wrote, the server's copy of each conflicted
  row, and every entity after `exists`. A pull walks profile, buildings, umas, work, items, badges, ledger, operations,
  flairEvents, itemLedger and raceResults, then `savedAt`, then id, a page at a time, and leaves out `operations` rows
  older than a week.
- **Bounds.** 100 changes a request and 2 MiB of JSON; 512 KiB a row or an operation's input; 1,000 rows and 4 MiB a
  page; ids of up to 160 characters of today's id alphabet.
- **Dev grants.** `dev-grant` runs only where the env says `dev: true`: a dev build, or an API started with
  `DEV_OPERATIONS=true`. Production refuses it (M034).

### The API as built (T135)

`apps/api/src/save-g2/` serves generation 2 beside today's `save/` module. `AppModule` doesn't import it until T143
mounts it and deletes today's. The server is the authority: it re-runs every operation with `commitOperation` on its own
rows, so the device's numbers and the server's come from one function.

- **Routes.** All three sit behind `AuthGuard`. Each runs the guard first, then the stamp, then T134's parser:

  | Route | Stamp | Answers |
  |---|---|---|
  | `GET /api/save` | In the query: `protocol=2&generation=2`, with `since` (whole ms, default 0) and `cursor` | 200 `SaveSnapshotV2` |
  | `POST /api/sync` | In the `SyncRequestV2` body | 200 `SyncResponseV2`, every change answered in order. 409 `{ code: 'no-save' }` with no save and no create. 503 `{ code: 'content-unavailable' }` when an operation's content can't load, with nothing written |
  | `POST /api/legacy/purge` | The body is exactly `{ protocol: 2, generation: 2 }` | 200 `PurgeResponse` |

  Without a token, every route is 401. Any stamp but 2 and 2 is 426 `{ code: 'upgrade-required', protocol: 2,
  generation: 2 }`, with nothing read or written. A body or query that T134's parsers refuse is 400, with developer text.
  The web turns every status into plain words (T136).
- **A sync reads only what it needs.**
  - A create or an operation reads every row of `profile`, `umas`, `buildings`, `work` and `items`, the ledger's rule
    rows, and `operations/{id}` for its operation ids. A create also reads `badges`, so its `exists` answers every entity.
  - Every request reads the badge and flair rows it names.
  - A request without a create or an operation also reads `profile/main`, so a missing save is still a 409.
- **A sync walks the changes in order on one state.**
  - A create is `exists`, or it writes `initialSave(createdAt)`.
  - A badge whose base matches (0 for a missing row) is written at its stored version + 1. Any other badge is a
    `conflict`, with the server's copy when there is one.
  - A flair event's first write wins.
  - An operation is `invalid` when its input is malformed or a rule throws, and the walk goes on. Otherwise it is
    `refused` with its plain words, `repeated` with its first receipt and no writes, or `applied`.

  Each document is written once a sync, with its final data and its version raised once. Every written row gets the
  server's `savedAt`.
- **A pull** returns the rows saved after `since`, and `operations` from the last week at most. They come in
  `KIND_ORDER`, then `savedAt`, then id, up to 1,000 rows and 4 MiB a page. The cursor is the page's last row, written
  `kind~savedAt~id`.
- **Firestore** keeps each row at `saves/{uid}/{kind}/{id}` through today's codec, which stores a work row's arrays of
  arrays as `dataJson` (D151). A sync is one transaction, with every read before the first write. A pull queries each
  kind by `savedAt` and then document id, outside a transaction.
- **Local dev** keeps one file, `.data/save-g2.json` (the default for `LOCAL_SAVE_FILE` here), shaped
  `{ [uid]: { rows: { 'kind/id': row }, purge? } }`. Writes are atomic and calls are serialized.
- **Content.** Operations run on the server's current `umas`, `races`, `cards` and `skills` packs. Each pack is verified
  by its hash, checked as the web checks it, and built with `buildOperationEnv`. The env is cached per manifest version,
  and the manifest is re-read at most once a minute. The env's `dev` is `DEV_OPERATIONS === 'true'`. No deploy sets
  that variable, so production refuses `dev-grant`.
- **The purge** ([rearchitecture/07](../rearchitecture/07-data-reset.md) §3):
  1. If `saves/{uid}/meta/purge` exists, it answers `already` with the first purge's record.
  2. Otherwise it counts `players/{uid}`'s subcollections and deletes the tree with `recursiveDelete`, counting each
     document through the bulk writer.
  3. It then `create()`s the marker `{ generation: 2, at, collections, documents }`. A device that loses the race to
     write the marker answers `already` with the stored record.

  Nothing else under `saves/` is touched. `meta` is not a save kind, so no pull returns it. The local repository clears
  the uid's entry from the old dev file at the fixed path `.data/save.json`, counting its rows by kind.

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
| A race commits as the operation `finish-race` (T134) | [09](09-racing-rewards-and-exchange.md) §9 allows it and requires one atomic commit of the result, the Uma, the purse and the ledger; server authority needs an operation for that |
| Only badges and flair events are device-written rows; every other kind changes by operation or the create | §6: every change is an operation. Badges and flair stay as today (M034) |
| The create carries only `createdAt`; the server builds the rows itself | Server authority: the device never uploads a balance |
| Rows carry `generation: 2` and `schema: 1` | [rearchitecture/01](../rearchitecture/01-target-architecture.md) §5's one schema version per kind, without today's sniffing |
| No row is ever deleted: an empty work row, a zero count | Versions never restart, and promotion's dropped work row still syncs |
| The state holds only the rule rows of the ledger | Rules read only those, and they grow with the roster, not with play time |
| `itemLedger` rows come from each receipt's movements, with ids `<opId>:m<n>`; there is no "consume" row | [07](07-farm.md) §12 lists every movement. A reserved dish has already left the Warehouse, so collecting it moves nothing ([05](05-training-hub.md) §9's "consume" is that reserve) |
| Ledger rows keep the domain's `LedgerEntry`, not 09 §9's first `{ currency, balanceAfter, ref }` | It is the built shape (T125, T130), and its id already names the cause |
| Operations carry no base version | [02](02-check-ins-and-notifications.md) §9: the server re-checks a tap against the latest state |
| Bond picks are not saved | §6 saves no picks, and 02 §11 left the choice to phase 3 |
| Operation ids have no colons and are at most 64 characters | Derived ids such as `race:<id>:featured` stay within 160 and parse cleanly |
| The server trusts the placement and the featured board, as it trusts the clock | 02 §8: there is no anti-cheat, and the purse and `featuredPaid` still bound the pay. The board's draw needs `@racer/race`'s seeded RNG, which the CommonJS API can't import |
| A race's id is its operation's id | One tap is one race, and `runOnce` already makes the id once-only, so the server needs no per-Uma race count |
| A pull carries a week of operation receipts | The summary needs only recent receipts (02 §10), and older ones stay on the server for retries |
| The bounds of §6 | Under Firestore's 1 MiB document and Cloud Run's response limits, with room for a 25-Uma Collect all |
| `dev-grant` gives items, Prize Money and Uma Tickets as `dev-grant` ledger and item rows, ends an Uma's running entry now without tickets, and jumps her to her gate with her career won and the gate's Shard paid once | M034's rehearsal reaches a gate on a fresh account. The rows keep 09 §9's audit, and the jump pays what reaching the gate pays, under the same once-only id |
| Every receipt that moves Warehouse stock lists it in `movements`, `finish-race` its collect's too; an item row is dated when its movement applied | One rule writes every item row, and a queued start that settled during a tap keeps its own time |
| `GET` carries its stamp as query parameters; the POSTs carry it in the body (T135) | [rearchitecture/07](../rearchitecture/07-data-reset.md) §4 stamps every request, and a GET has no body |
| The guard runs before the stamp | The release's smoke check expects 401 without a token ([rearchitecture/07](../rearchitecture/07-data-reset.md) §6) |
| A malformed operation input is that operation's `invalid`; a malformed request is a 400 | One bad tap never blocks the outbox behind it, and a broken request is a client bug |
| 409 only for a missing save; per-change conflicts come in a 200 | Today's pattern: one answer accounts for every change |
| 503 when content can't load, and only for requests with operations | No operation runs without its rules' content, and badges never need it |
| One version bump per document per sync | Several operations on one Uma in one batch are one write |
| An operation request reads the whole operation set | Collect all and Repeat read every Uma. At 25 Umas a sync is about 200 reads, so even 100 syncs a day stay under the free tier's 50,000 |
| The server runs on its current content, not the device's version | Server authority; the device adopts the server's rows |
| The purge counts with `listCollections` and the bulk writer, and writes its marker with `create()` | Exact counts, and two devices racing write one marker |
| The local purge clears the old dev file's entry for the uid, at a fixed path, never an env var | [rearchitecture/07](../rearchitecture/07-data-reset.md) §2: the dev store is deleted, and dev uses `.data/save-g2.json`. T143 points `LOCAL_SAVE_FILE` at the new file, so the old one can't share the variable |
| Content is cached per manifest version, re-read at most once a minute | One bucket read a minute at most, and a publish takes effect within a minute |
| A request with no create and no operation also reads `profile/main` | Its 409 for a missing save needs the profile, at the cost of one read |
| A create reads the `badges` too | Its `exists` answers every entity of the save (§6), and badges are entities |
| The POSTs answer 200, not Nest's default 201 | A sync or a purge creates nothing the client addresses, and per-change answers come in a 200 |
| The cursor is `kind~savedAt~id` | `~` is in no kind and no id, so it splits cleanly, and the cursor stays in T134's cursor alphabet |
| A failed pack load is tried again on the next call; the manifest still waits its minute | A brief bucket error costs one 503, not a minute of them |
| Rows are written as their JSON copy | Firestore refuses `undefined` fields, so Firestore, the dev file and the wire hold the same copy |
| The purge counts the parent document only if it existed | `recursiveDelete` deletes it either way, and the counts stay exact |

## 9. Done when

- The phase table in `docs/rearchitecture/08-phases.md` matches §4, and that folder's README points here.
- After phase 3, `git grep -i -E "puzzle|friendship|constellation level|training ticket|card coupon|inspiration token"`
  over `apps`, `packages` and `scripts` finds only the decisions log and this folder.
- The new account on the owner's iPhone matches §5, and the save holds only §6's kinds.
- After phase 8, `pixi.js` is not in any `package.json`; after phase 3, it is imported only under `scenes/race/`.
