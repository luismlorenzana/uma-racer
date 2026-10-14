# 11 · Hub and places

> **Status: approved design, 2026-10-14; first written 2026-10-13 (D333).** The Hub's four pages, every place on them, the routes, the
> two play modes as tap-by-tap flows, and the art: what uma-art already draws and what a uma-platform session draws
> new. Nothing here is built.

This page replaces the place list of the re-architecture's Hub plan ([rearchitecture/04](../rearchitecture/04-hub.md)
§3–§6). It keeps that plan's pattern whole: a place registry, pixel-art pages on a Phaser canvas with a DOM hit layer,
a Peek, Page and Counter per place, and routes `/:page/:place/*`. What changes is what's on the pages (D333).

## 1. The pattern (kept)

| Part | What it is | Lives in |
|---|---|---|
| **Place registry** | One table: id, page, name, one-line blurb, art frame, position on the page (fractions of width and height), which slots its pips show, lock rule, counter, `direct` flag, hidden flag | `@racer/domain/hub`: pure, tested, rendered into the live manual |
| **Pages** | Four pixel-art maps, swiped between | `scenes/hub/` (Phaser via `uma-scene/hub`) |
| **Hit layer** | One DOM button per place over its building: name pill, counter, lock, Ready badge, slot pips | `hub/PlaceTargets.tsx` |
| **Place UI** | Per place: a **Peek** (a bottom sheet), a **Page** (its full screen) and an optional **Counter**, all lazy | `places/registry.tsx` |
| **Routes** | `/:page`, `/:page?peek=:place`, `/:page/:place`, `/:page/:place/*` | `app/router.tsx` |
| **Shell** | Account bar on top, bottom bar, the ☰ menu listing every place, an overlay host for Peeks and sheets | `app/` |

Rules carried over from uma-rpg, unchanged:
- **The canvas draws and the DOM receives every tap.** No sprite is a tap target.
- **Every place is a link**, so Back and the iPhone's edge swipe work everywhere.
- **A locked place shows a lock and no placeholder text** (uma-rpg D95).
- **Explanations live behind an (i) button** on each Page, written from the registry blurb and the owning doc.
- **44 pt targets.** A place button covers its building, name pill and pips: at least 96 × 96 pt at 2×.
- **Swipe between pages** on the map (not inside sheets), in the bottom bar's order, without wrapping.

Two clarifications of the old plan:
- **Counter** is a number badge on the place's name pill and its menu row. The three currencies also sit in the account
  bar (§2.1), and tapping one opens the place that sells or spends it.
- **Tap once for the Peek, again (or Enter) for the Page.** A place flagged `direct` skips the Peek. Only the
  Racecourse is `direct`, because racing is the payoff and is already one button away (§2.2).

## 2. The shell

```text
┌──────────────────────────────────────────────────────────────┐
│ (L)   PM 12,340   Speed 46   Uma Tickets 3        Sync paused │  account bar
│                                                              │
│              page map (Phaser) + place buttons (DOM)         │
│                                         [ Collect all · 14 ] │  floating pill
├──────────────────────────────────────────────────────────────┤
│  Town Hall    Training    ( RACE )    Farm    ☰              │  bottom bar
└──────────────────────────────────────────────────────────────┘
```

### 2.1 The account bar

| Item | Shows | Tap opens | Hidden when |
|---|---|---|---|
| Trainer button | The trainer's initial | Account | Never |
| **Prize Money** | Balance, with its coin icon | Exchange | Never |
| **Speed Tickets** | Count, with the ticket icon | Exchange, at the Speed Tickets row | Never (shows 0) |
| **Uma Tickets** | Count, with the Uma Shards toward the next one ("2 · 3/5") | Stable, Locked tab | Never ([04](04-tiers-and-promotion.md) §6: Shards keep coming from every tier) |
| **Sync** | Offline, Sync paused, or **Sync** in amber or red (D157) | Account, at the sync row | Synced |

Numbers move with a CSS transition when they change (continuous HUD values never use springs). A race's prize flies
into the Prize Money chip on the result screen ([09](09-racing-rewards-and-exchange.md) §7).

### 2.2 The bottom bar

**Town Hall · Training · ( RACE ) · Farm · ☰**

- **RACE** is raised in the middle and opens the **Racing page**, whose Racecourse opens in one more tap (it is
  `direct`). So a race starts four taps from anywhere: RACE, Racecourse, a race card, Start race.
- **Tab badges:** Farm shows Umas with finished Farm work; Training shows Umas with finished sessions. Town Hall and
  RACE carry none, so the bar stays quiet.
- **☰** opens the menu sheet: every place by page, with its lock and counter, then Account and the planner's roster
  view. It is the fallback route to everything when the canvas can't load.

### 2.3 The floating pill

On every Hub page, in the thumb zone just above the bottom bar on the right:
- **Collect all · N ready** when N Umas have something to collect ([02](02-check-ins-and-notifications.md) §2);
- **Check-in · N free** otherwise, which opens the same summary without collecting ([02](02-check-ins-and-notifications.md) §4);
- nothing, when nothing is ready and nobody is free.

It is account-wide on every page: one tap collects Farm jobs and Training sessions together.

### 2.4 Where the app opens

`/` decides once, at launch:
1. **A new account with no Umas** opens the Stable's Locked tab, to pick the first 20 with 20 Uma Tickets
   ([13](13-removals-and-plan-changes.md) §5).
2. **Anything needs a tap** (the app badge's count: an Uma Ready, Free or Waiting, [02](02-check-ins-and-notifications.md) §7):
   the **Farm page**, where a check-in happens.
3. **Otherwise the last page viewed**, kept per device (`uma-racer:g2:lastPage`), or Town Hall the first time.

A notification tap opens what it names: the summary, or the place itself for a one-Uma notice ([02](02-check-ins-and-notifications.md) §7).

## 3. The four pages

Page ids, routes and the order of swiping: `town`, `training`, `racing`, `farm`.

### 3.1 Town Hall (`/town`)

```text
   [ Stable ]                         [ Card Library ]
                 ( plaza: featured Uma )
   [ Warehouse ]                      [ Exchange ]
```

| Place (id) | Opens | Peek | Counter | Lock | Replaces |
|---|---|---|---|---|---|
| **Stable** (`stable`) | The roster: Owned and Locked tabs with counts, tier badges (T1, T2, T3) on every tile, a tier filter, the shared picker's sorts and filters (D181). An Uma's profile: tier, scenario, Racing Level, Farm Level, what she's doing, her build per facility, **Needs** ([02](02-check-ins-and-notifications.md) §6), Skills, Racing. A locked Uma: **Unlock · 1 Uma Ticket** (tier 1, [04](04-tiers-and-promotion.md)), then the collection reveal | The featured Uma; "23 Umas · T1 21 · T2 2"; Umas ready to advance or promote; Uma Tickets in hand | Uma Tickets in hand | Open | `/stable`, Uma profile, skills; Home's featured hero |
| **Warehouse** (`warehouse`) | Every item: Raw, Crafted, Dishes and Tickets shelves; family and grade filters; each row's reserved, coming and needed counts; the stock sheet with **Make more** and **Sell** ([07](07-farm.md) §10, [09](09-racing-rewards-and-exchange.md) §6) | The biggest stacks; what the planner is short of; "Surplus worth 1,240" | — | Open | `/farm/items` |
| **Exchange** (`exchange`) | Speed Tickets and raw ingredients ([09](09-racing-rewards-and-exchange.md) §5) | Prize Money, Speed Tickets held, the planner's top shortage with its price | — (its currencies are in the account bar) | Open | Nothing (new) |
| **Card Library** (`card-library`) | Every SSR, open (D329): lens and Uma controls, sorts, filters, the card page with its bond cost and bonded Umas, **Bond** into the Dojo's session sheet ([06](06-cards-and-bonds.md) §6) | The newest cards; bonds made this tier; cards the featured Uma could bond now | — | Open | `/cards`, `/cards/:cardId` |
| **Account** (`account`, hidden) | Trainer name; check-in times and Notifications ([02](02-check-ins-and-notifications.md)); sync status and Sync now (D157); reduced motion and default race speed; build id and content version; sign-out; dev mode in dev builds only | — | — | Open; reached from the trainer button and the menu, not drawn on the map | `/settings` |

### 3.2 Training (`/training`)

```text
   [ Observatory ]                    [ Lineage Hall ]
                 ( lawn, benches, hedges )
   [ Gym ]                            [ Dojo ]
```

Each facility's Page is [05](05-training-hub.md) §8's: header with level, slots and Upgrade; slots grouped by room;
**Needs here**; Collect here. Each also holds the **per-Uma build view** that today's Training scene shows as a tab, at
`/training/:facility/:umaId`.

| Place (id) | Opens | Peek | Counter | Lock | Replaces |
|---|---|---|---|---|---|
| **Observatory** (`observatory`) | Constellation node sessions; per Uma, her tree: open nodes, card and lineage assignments, the next node and its Vegetables dish | Slots with faces and finish times; Umas with nodes left in their layer; Vegetables dishes in stock | Umas with a finished session here | Open | `/constellation/:umaId` |
| **Lineage Hall** (`lineage-hall`) | Inspiration sessions; per Uma, her parents and grandparents (any Uma ever owned) and their golds | Same, with Mushrooms dishes | Same | Open | `/constellation/:umaId/inspiration` |
| **Gym** (`gym`) | Five stat rooms of Extra Stats sessions; per Uma, her Extra Stats map and active nodes per preset | Rooms with faces; Umas with nodes left by stat; stat, Duo and Feast dishes in stock | Same | Open | `/constellation/:umaId/extra-stats` |
| **Dojo** (`dojo`) | Six card-type rooms of bond sessions; per Uma, her bonds and her card set per preset ([06](06-cards-and-bonds.md) §3) | Rooms with faces; bonds left this layer | Same | Open | `/constellation/:umaId/cards`, `/stable/:umaId/deck` |

### 3.3 Racing (`/racing`)

```text
                 [ Scenario Gate ]
   [ Trophy Hall ]                  [ Expedition Map ]
                  [ Racecourse ]          (thumb zone)
```

The Racecourse sits lowest and central, nearest the raised RACE button and the thumb.

| Place (id) | Opens | Peek | Counter | Lock | Replaces |
|---|---|---|---|---|---|
| **Racecourse** (`racecourse`, `direct`) | Race select: the Uma strip, the Daily Purse bar, **Today's featured**, Next up, every race; then the pre-race sheet, the run (full screen) and the result ([09](09-racing-rewards-and-exchange.md) §3–§7) | None: it opens at once. Its header carries what a Peek would (featured races, purse) | Featured bonuses still open today (0–3) | Open | `/race`, `/race/run` |
| **Scenario Gate** (`scenario-gate`) | Every Uma's career: stage, goal races, holds; the **Advance** sheet ([03](03-uma-progression.md)); per Uma at `/:umaId` | Goals in progress for the featured Uma; Umas ready to advance | Umas ready to advance | Open | Home's career panel; `/scenario/:umaId/start` |
| **Expedition Map** (`expedition-map`) | The world map with seven region pins, the list view, each Expedition's page with her run, Start, Resume, Pause and **Promote** ([10](10-expeditions.md) "Places and screens") | Umas on Expeditions with their wins ("5/8"); Umas eligible to start | Umas whose run is complete and who can promote | **Open from day one.** Before anyone qualifies it opens on "No Uma has finished her tier yet" with each Uma's distance to entry ([10](10-expeditions.md)) | Nothing (new) |
| **Trophy Hall** (`trophy-hall`) | Badges in Uma, Stable and Trainer scopes, titles, showcases, the G1 trophy wall, records, Prestige, the trainer profile and achievements | Recent flair (today's Home panel) | New flair since the last visit | Open | `/badges`, `/trainer`; Home's flair panels |

The Expedition Map's sub-routes use [10](10-expeditions.md)'s checked-in Expedition ids:
`/racing/expedition-map/:expeditionId` for `us-speed`, `kr-sprint`, `us-dirt-classics`, `ae-dirt-classics`,
`hk-speed-mile`, `au-speed-mile`, `gb-speed-mile`, `gb-champions`, `hk-crown-cup`, `au-mile-championship`, `au-cups`,
`gb-classics-stayers` and `fr-arc-stayers`; `?uma=:umaId` picks the Uma, and `?view=list` the list view.

### 3.4 Farm (`/farm`)

The eight sites stand on a ring in uma-art's Duo order, so **map neighbours are Duo partners** (README ring:
Grains – Vegetables – Mushrooms – Fruits – Herbs & Spices – Fish – Sweets – Nuts & Seeds), with the Pantry and Kitchen
in the middle.

```text
   [ Fields ]        [ Vegetable Garden ]   [ Mushroom Cave ]
   [ Nut Grove ]     [ Pantry ]             [ Orchard ]
   [ Sugar Grove ]   [ Kitchen ]            [ Herb Garden ]
                     [ Fishery ]
```

| Place (id) | Opens | Peek | Counter | Lock | Replaces |
|---|---|---|---|---|---|
| **Fields, Orchard, Fishery, Herb Garden, Vegetable Garden, Mushroom Cave, Sugar Grove, Nut Grove** (their uma-art ids) | The building page: gather jobs of its family ([07](07-farm.md) §10) | Slots with faces and the next output's time; its family's stock by open grade; the planner's lines for it | Umas with finished outputs here | Open; grades inside lock by Farm Level ("Farm Lv 16") | `/farm/district/:districtId` |
| **Pantry** (`pantry`) | Craft jobs, every family | Same; crafted stock short for the targets | Same | Open | Today's Workshop |
| **Kitchen** (`kitchen`) | Cook jobs; recipe tabs by destination ([07](07-farm.md) §10) | Same; dishes short for the targets | Same | Open | Today's Kitchen; `/farm/recipes` |

There is no Farmhouse: Farm Level lives on each Uma's profile, recipes in the Kitchen's sheet, and the Wishlist became
the planner ([07](07-farm.md) §13).

## 4. Slot pips

On the **Farm** and **Training** pages every building shows its slots under its name pill, so the whole roster reads
at a glance.

| Pip | Looks like |
|---|---|
| **Busy** | The worker's face (release `character-faces`, falling back to her outfit icon) in a ring filled by the current output's or unlock's progress |
| **Ready** | The ring full and gold, a small bounce (none with reduced motion); the building gets a **Ready** badge with the count |
| **Queued behind** | A "+2" chip on the busy pip's shoulder |
| **Free** | A hollow ring |
| **Room** (Gym, Dojo) | The ring tinted by its room's stat or card type |

- **Up to 8 pips**, in two rows of four: busy first, then ready, then free. That fits the Kitchen at Lv 2 and 3 (8 slots,
  [07](07-farm.md) §6). Beyond 8 (the Gym at Lv 2 has 10, the Dojo 12, [05](05-training-hub.md) §7), the eighth pip
  becomes "+N".
- **Pips are display only.** The place button is the target; a pip at 20 pt would be under 44.
- **Progress is computed from start times** with the shared idle math, redrawn every 30 seconds and on foreground,
  never animated per frame.
- **VoiceOver** reads the button as one line: "Kitchen. 6 of 8 slots busy, 2 ready, 1 queued."

## 5. The featured Uma

She stands in the Town Hall plaza as a code-animated chibi (release `outfit-chibis`: bob, hop, squash; still with
reduced motion; her outfit icon if the chibi is missing). Tapping her opens a **quick sheet**:
- her name, tier crest, scenario, Racing Level and what she's doing ("Kitchen · 2 of 4 · 16:40");
- **Train**, which opens her profile's **Needs** tab, where each next session has a Start ([02](02-check-ins-and-notifications.md) §6);
- **Race**, the Racecourse with her picked;
- **Profile**;
- **Feature another Uma**, the Uma picker.

She replaces today's Home hero. The first Uma unlocked is featured on a new account ([13](13-removals-and-plan-changes.md) §5).

## 6. Full-screen flows

These hide the account bar and bottom bar, and return to where they came from:
- **the race run and its result** ([09](09-racing-rewards-and-exchange.md) §7);
- **the collection reveal** after unlocking an Uma;
- **an Uma's constellation tree and Extra Stats map**, which open full screen inside their facility's route;
- **the promotion ceremony** ([04](04-tiers-and-promotion.md)).

The Expedition world map stays inside the shell: it is a place Page, and its Uma picker sits above the bottom bar.

## 7. Routes

### 7.1 The new routes

| Route | Screen |
|---|---|
| `/` | The start rule (§2.4) |
| `/town`, `/training`, `/racing`, `/farm` | A page; `?peek=:place` opens a Peek over it |
| `/town/stable` | The roster; `?tab=owned` or `?tab=locked` |
| `/town/stable/outfit/:umaId` | Her profile; `/skills` and `/needs` are its sub-pages |
| `/town/stable/needs` | The planner's roster view ([02](02-check-ins-and-notifications.md) §6) |
| `/town/warehouse`, `/town/exchange`, `/town/account` | Those places |
| `/town/card-library`, `/town/card-library/card/:cardId` | The Library and a card page |
| `/training/:facility` | `observatory`, `lineage-hall`, `gym` or `dojo` |
| `/training/:facility/:umaId` | Her build view at that facility (tree, Inspiration, Extra Stats map, bonds and card set) |
| `/racing/racecourse` | Race select; `?uma=:umaId&race=:raceId` preselects |
| `/racing/racecourse/run` | The run and result, full screen |
| `/racing/scenario-gate`, `/racing/scenario-gate/:umaId` | Careers, and one Uma's career |
| `/racing/expedition-map`, `/racing/expedition-map/:expeditionId` | The Map and an Expedition's page (§3.3) |
| `/racing/trophy-hall`, `/racing/trophy-hall/trainer`, `/racing/trophy-hall/uma/:umaId` | Badges by scope |
| `/farm/:building` | One of the ten Farm buildings, by uma-art id |
| `/collection/reveal/uma/:umaId` | The reveal, full screen |

### 7.2 Today's routes

Every route in `apps/web/src/app/router.tsx` today:

| Today | After |
|---|---|
| `/` (Home) | `/` (§2.4) |
| `/stable` | `/town/stable` |
| `/stable/:umaId`, `/stable/:umaId/skills` | `/town/stable/outfit/:umaId`, `…/skills` |
| `/stable/:umaId/deck` (already a redirect) | `/training/dojo/:umaId` |
| `/scenario/:umaId/start` (already a redirect) | `/racing/scenario-gate/:umaId` |
| `/training/:umaId` (already a redirect, D120) | **Deleted, no redirect:** it has the same shape as `/training/:facility` and would shadow it |
| `/race`, `/race/run` | `/racing/racecourse`, `/racing/racecourse/run` |
| `/cards`, `/cards/:cardId` | `/town/card-library`, `/town/card-library/card/:cardId` |
| `/cards/redeem` (already a redirect) | Deleted: coupons are gone (D329) |
| `/badges`, `/trainer` | `/racing/trophy-hall`, `/racing/trophy-hall/trainer` |
| `/settings` | `/town/account` |
| `/constellation/:umaId` | `/training/observatory/:umaId` |
| `/constellation/:umaId/cards` | `/training/dojo/:umaId` |
| `/constellation/:umaId/inspiration` | `/training/lineage-hall/:umaId` |
| `/constellation/:umaId/extra-stats` | `/training/gym/:umaId` |
| `/farm` | `/farm` (now the Farm page) |
| `/farm/district/:districtId` | `/farm` |
| `/farm/crew` | `/town/stable` (Farm Level is on each profile) |
| `/farm/recipes` | `/farm/kitchen` |
| `/farm/wishlist` | `/town/stable/needs` |
| `/farm/items` | `/town/warehouse` |
| `/farm/section/:section`, `/farm/workers`, `/farm/crops` (old redirects), the Farm's `*` retry route | Deleted |
| `/minigames/spark-match/:umaId`, `/minigames/friendship-training/:cardId`, `/minigames/bond-recall/:cardId?` | Deleted: no minigames remain ([13](13-removals-and-plan-changes.md) §1) |
| `/rpg/*` (nine routes) | Deleted (D322) |
| `/puzzles`, `/puzzles/*`, `/puzzles/content`, `/puzzles/practice` | Deleted (D326) |
| `/collection/reveal/:kind/:id` | `/collection/reveal/uma/:umaId`; the `card` kind is deleted |
| `/dev/*` (thirteen proof routes) | Deleted with their systems. New dev proofs live under `/dev/` beside the places they prove |

**The redirect rule** (the re-architecture's, made concrete): each "After" path above is a redirect that **ships with
phase 3** and **is deleted with phase 4**, by when the installed app, bookmarks and notification links all use the new
paths. Saved data holds no paths, so nothing else changes. An unknown path goes to `/`.

## 8. Today's Home panels

| Today | After |
|---|---|
| Featured Uma hero with Train and Race | The plaza chibi and her quick sheet (§5); the raised RACE |
| Career goals panel | The Scenario Gate's Peek and counter |
| Training Tickets meter | Deleted (D331): the account bar shows Prize Money and Speed Tickets |
| Farm card | The Farm page |
| Puzzles card, `PuzzlePreparationNotice` | Deleted |
| RPG card | Deleted |
| Recent flair, Stable flair | The Trophy Hall's Peek and counter |
| `TopBar` pills (tickets, Card Coupons, Uma Coupons) | The account bar (§2.1) |
| `TabBar`: Home · Stable · Race · Cards · Badges | The bottom bar (§2.2) |

## 9. The two play modes, tap by tap

### 9.1 A check-in (busy day)

| Step | Where | Taps |
|---|---|---|
| Open the app; the badge said 9 | `/` lands on the **Farm page** (§2.4): the pips show who's done | — |
| **Collect all · 9 ready** | The floating pill; the summary sheet opens ([02](02-check-ins-and-notifications.md) §4) | 1 |
| **Repeat all (7)** | In the summary's thumb zone | 1 |
| **Start suggestions (2)** for the free Umas | In the summary | 1 |
| Close | Pips now show every slot busy | — |

Three taps and about 30 seconds ([02](02-check-ins-and-notifications.md) §1). A blocked queue adds one or two ("Buy 2 ·
190"). Swiping once to the Training page shows the sessions' pips, but the summary already covered them.

### 9.2 A racing session (free evening)

| Step | Where | Taps |
|---|---|---|
| **RACE** | The Racing page | 1 |
| **Racecourse** | Race select, on the first Uma in the strip with an unwon goal (strip order: open goals first, then D181's level order, finished careers last) | 1 |
| A race card: **Today's featured** or **Next up** | The pre-race sheet | 1 |
| **Start race** | The run, full screen | 1 |
| **Skip** (optional) | The result: Racing EXP, Prize Money with its band, goals, flair | 1 |
| **Next Uma** | Race select on the next Uma in the strip, Daily Purse bar updated | 1 |
| A race card, **Start race**, Skip, Next Uma … | Four taps a race | 4 |
| Back to the Hub | The Racing page; then the summary's **Speed up** or the Exchange to spend the evening's Prize Money | 1–2 |

Forty races is about 160 taps and, with Skip, under an hour: the heavy evening [09](09-racing-rewards-and-exchange.md)
§3 sizes the Daily Purse for.

## 10. Art

### 10.1 Buildings

All 48×48 with a ground line, from `@luismlorenzana/uma-art` `buildings/atlas.json` (checked: 36 frames on four
pages, `farmlands`, `wilds`, `learning` and `town`).

| Place | Frame | Source | Why it fits |
|---|---|---|---|
| Stable | `stable` | uma-art, `town` | A stable with a horse at the half-door |
| Warehouse | `warehouse` | uma-art, `town` | A big barn |
| Exchange | `exchange` | uma-art, `town` | A striped market stall |
| Card Library | `card-library` | **New** | No frame reads as a library: `mage-tower` and `arcane-armory` read as magic |
| Observatory | `observatory` | uma-art, `town` | A domed telescope: constellations |
| Lineage Hall | `party-hall` | uma-art, `town` | A timbered hall hung with heraldic banners: a family's hall |
| Gym | `gym` | **New** | Nothing reads as a gym: `rangers-lodge`'s archery target and `lancers-barracks`' spears read as combat |
| Dojo | `brawler-dojo` | uma-art, `learning` | A Japanese dojo with a tiled roof and lanterns, the right name and look |
| Racecourse | `racecourse` | **New** | The centrepiece must read as horse racing (grandstand, white rails, turf oval, finish post); the one stadium frame is the Expedition Map's |
| Scenario Gate | `scenario-gate` | uma-art, `town` | A white arch with a chequered banner over a track |
| Expedition Map | `tier-finale` | uma-art, `town` | A stadium ringed with flags of many colours, already uma-art's tier finale; the Expedition is ours ([10](10-expeditions.md)) |
| Trophy Hall | `trophy-hall` | **New** | A columned hall with a gold cup; `knights-bastion` reads as a castle |
| Eight sites, Pantry, Kitchen | their own ids | uma-art, `farmlands` | uma-rpg's Farmlands, reused whole ([07](07-farm.md) §1) |

**Not used**, because they would confuse: the eight other `learning` frames (`mage-tower`, `spell-blade-salle`,
`cleric-chapel`, `summoner-circle`, `rangers-lodge`, `lancers-barracks`, `arcane-armory`, `knights-bastion`), uma-rpg's
class halls, which read as magic, combat or worship; and the ten `wilds` frames (D330: no Mining, gathering or gear).

### 10.2 Tiles

| Page | Tiles | Notes |
|---|---|---|
| Town Hall | `town/*` | Ground, plaza paths, barrels, crates, flower pots, benches, lamps, trees |
| Training | `learning/*` | Hedges, benches, flower beds, lamps, banners: a campus |
| Racing | `racing/*`, **new** | Turf ground ×4; a dirt-track path set (`path-0…15`, the same edge masks, never closing a 2×2); props: white rail, furlong post (16×32), pennant (16×32), flower box |
| Farm | `farmlands/*` | As uma-rpg's Farmlands |

### 10.3 The uma-platform session's list

One minor release of `uma-art`, drawn by `scripts/pixel-art` (original, deterministic, in git):

| What | Ids | Size | For |
|---|---|---|---|
| Buildings | `racecourse`, `trophy-hall` (page `racing`), `card-library` (page `town`), `gym` (page `learning`) | 48×48, `anchorY` 44 | §10.1. Added to the shared `buildings` atlas, so the re-architecture's planned `racer` family is these four frames |
| Racing tiles | `racing/ground-0…3`, `racing/path-0…15`, `racing/rail`, `racing/furlong-post`, `racing/pennant`, `racing/flower-box` | 16, tall props 16×32 | §10.2 |
| Expedition world map | A composition like `world`'s islands: seven regions with pin spots | Map cells 16 | [10](10-expeditions.md) "The Expedition Map" |
| Region crests | Seven: United States, South Korea, Dubai, Hong Kong, Australia, Britain, France/Europe | 16×16 and 32×32 | The Map's pins, and local champions' face rings ([10](10-expeditions.md)) |
| Speed Ticket icon | `speed-ticket` in `items` | 32×32 | The Warehouse, job cards ([08](08-item-catalogue-and-recipes.md) §9: uma-art has no ticket icon) |
| Currency marks | `currency/prize-money`, `currency/speed-ticket`, `currency/uma-ticket` in `ui` | 16×16 | The account bar and prices |
| Tier crests | `tier/1`, `tier/2`, `tier/3` in `ui` | 12×12 | Stable badges, pips, the Map's chips |

Uma art stays the platform release's: outfit chibis for the plaza and busy buildings, character faces for pips,
outfit icons as the fallback ([rearchitecture/03](../rearchitecture/03-rendering-and-textures.md) §4). The tier-3 wet
course ([10](10-expeditions.md)) is a palette parameter of the code-drawn race course, not new art.

The racer pins the release and checks every registry frame against the index in a test, as uma-rpg's
`frames.test.ts` does. A frame the pinned release lacks fails CI, never a blank building.

## 11. When it ships

[13](13-removals-and-plan-changes.md) §4 puts the new game on plain DOM screens in phase 3 and the canvas Hub in phase 6.
So this page lands in two steps:

| Phase | What ships |
|---|---|
| **3** | The route scheme (§7), the place registry, the redirects, the account bar, the bottom bar, the menu, the floating pill and every Peek and Page. Each page renders as a **DOM grid of place tiles**: the uma-art frame as a CSS sprite at 2× (`image-rendering: pixelated`), the name pill, counter and pips. A place whose new drawing isn't released yet shows its name on a plain tile |
| **6** | The canvas maps: tiles, building positions, the plaza chibi, swipe on the map. The DOM hit layer reuses phase 3's tile contents positioned over the buildings |
| **7** | The Farm and Training places' own pixel-art scenes ([rearchitecture/03](../rearchitecture/03-rendering-and-textures.md) §5) |

Shipping the routes and registry in phase 3, not 6, means links change once.

## 12. Budgets and accessibility

- **Fit:** each page fits 390×844 at the largest whole-number scale, as uma-rpg's `hubGrid` does. The Farm's ten
  buildings at 2× take four rows, as uma-rpg's Farmlands holds the same ten; if a row of pips ever overflows, the page
  scrolls vertically on the same grid (uma-rpg H19).
- **Load:** the Hub chunk (Phaser, `uma-scene/hub`, one page's tiles and buildings) is lazy. The atlases are small
  (buildings 27 KB, tiles 9 KB). Faces load only for visible pips. Entry chunk ≤ 180 KB gzip.
- **One engine alive:** the Hub's game is destroyed when a full-screen flow opens and remounted on return
  ([rearchitecture/03](../rearchitecture/03-rendering-and-textures.md) §3).
- **VoiceOver** reads each place's name, lock, counter and pips (§4); the menu lists every place for anyone who can't
  use the map.
- **Reduced motion:** no chibi idle, no pip bounce, instant page changes.

## 13. Decided here

| Choice | Why |
|---|---|
| Page ids `town`, `training`, `racing`, `farm`; place ids as in §3 (Farm places use uma-art's ids) | Short routes; ids match the art |
| The Racecourse is `direct` (no Peek) | Racing is the payoff; two taps from anywhere to the race list |
| The floating pill (Collect all, or Check-in) on every page | A check-in works wherever the app opens |
| `/` opens the Farm page when anything needs a tap, else the last page | Most visits are check-ins, and the Farm page's pips are the glance |
| Counters on name pills and menu rows; currencies in the account bar | Clarifies the old plan's "Counter" |
| The Uma Tickets chip always shows, with the Shards toward the next ticket | Umas come from progress (D336); the chip says how close the next one is |
| The Expedition Map is open from day one | [10](10-expeditions.md)'s rule: it shows each Uma's distance to entry |
| Per-Uma build views live at their facility (`/training/:facility/:umaId`) | Today's four Training-scene tabs map one to one onto the four facilities |
| The planner's routes are `/town/stable/needs` and each profile's `/needs` | The planner is about Umas, so it lives with the Stable |
| `/training/:umaId` is dropped, not redirected | It would shadow `/training/:facility`; it was already a legacy redirect |
| Redirects ship with phase 3 and leave with phase 4 | "One release" made concrete |
| Routes, registry and menu ship in phase 3 on DOM tiles; the canvas in phase 6 | Links change once; the new game is playable before its art |
| Reused frames: `stable`, `warehouse`, `exchange`, `observatory`, `party-hall` (Lineage Hall), `brawler-dojo` (Dojo), `scenario-gate`, `tier-finale` (Expedition Map), and the ten `farmlands` buildings | They read right at 48 px |
| New frames: `racecourse`, `trophy-hall`, `card-library`, `gym`, in the shared `buildings` atlas | Nothing existing reads right; one atlas for every Hub |
| New `racing` tiles | No existing page looks like a racecourse |
| The Farm ring follows the Duo ring | Map neighbours are Duo partners, which teaches the Duos |
| Pips: display only, up to 8, busy first, "+N" beyond | Fits the Kitchen's 8; keeps the 44 pt rule on the whole button |

## 14. Done when

- The app opens per §2.4. Every screen is reachable from a place, and every place from the ☰ menu.
- Each "Today" path in §7.2 redirects to its "After" path in phase 3 (a router test walks the table), deleted paths
  land on `/`, and the redirects are gone after phase 4.
- The place registry is one table in `@racer/domain/hub`, and the live manual renders the same table.
- At 390×844 every place button is at least 44 pt, swipes and tabs agree, and VoiceOver reads each place's name, lock,
  counter and pips.
- On a synthetic account, every building's pips match the domain's view of its slots: faces, progress, Ready and
  queue counts. The Kitchen at Lv 2 shows eight pips; the Gym at Lv 2 shows seven and "+3".
- A check-in from a cold open is three taps (Collect all, Repeat all, Start suggestions); a race after the first is four.
- Every registry frame exists in the pinned uma-art index (a `frames.test` equivalent), and the four new buildings,
  `racing` tiles, world map, crests and icons are in its release.
- The Hub chunk loads in under a second on the owner's iPhone over a warm cache, and the entry chunk stays under
  180 KB gzip.
