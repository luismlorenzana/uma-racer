# 11 · Hub and places

> **Status: approved design, 2026-10-14; first written 2026-10-13 (D333).** The Hub's four pages, every place on them, the routes, the
> two play modes as tap-by-tap flows, and the art: what uma-art already draws and what a uma-platform session draws
> new. Phase 3's frame is built beside today's app (T137, D353): the registry and Hub view in `@racer/domain/hub`, the
> routes, redirects and shell in `apps/web/src/g2/`, reachable at `/dev/g2/*` in development until T143; the place
> tasks (T138–T142) fill the Peeks, Pages and sheets.

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
| **Uma Tickets** | Count, with the Uma Shards toward the next one ("2 · 3/5"; held at 5/5 in gold once a ticket can be made, since the exchange is a tap) | Stable, Locked tab | Never ([04](04-tiers-and-promotion.md) §6: Shards keep coming from every tier) |
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
2. **Anything needs a tap** (the app badge's count: an Uma Ready or Free, [02](02-check-ins-and-notifications.md) §7):
   the **Farm page**, where a check-in happens.
3. **Otherwise the last page viewed**, kept per device (`uma-racer:g2:lastPage`), or Town Hall the first time.

A notification tap opens what it names: the summary, or the place itself for a one-Uma notice ([02](02-check-ins-and-notifications.md) §7).

## 3. The four pages

Page ids, routes and the order of swiping: `town`, `training`, `racing`, `farm`.

The place registry, `@racer/domain/hub`'s `PLACES` (T137), as it stands. A cell is a row and a column on the page's
three-column grid of phase 3 (§11); a **new** frame is one of §10.3's drawings, shown as a plain tile until released.

<!-- live:hub-places -->
| Page | Place | Id | Kind | Route | Counter | Frame | Pips | Cell |
|---|---|---|---|---|---|---|---|---|
| Town Hall | Stable | `stable` | town | `/town/stable` | `uma-tickets` | `stable` | — | 1, 1 |
| Town Hall | Warehouse | `warehouse` | town | `/town/warehouse` | — | `warehouse` | — | 3, 1 |
| Town Hall | Exchange | `exchange` | town | `/town/exchange` | — | `exchange` | — | 3, 3 |
| Town Hall | Card Library | `card-library` | town | `/town/card-library` | — | **new** | — | 1, 3 |
| Town Hall | Account (hidden) | `account` | town | `/town/account` | — | — | — | — |
| Training | Observatory | `observatory` | facility | `/training/observatory` | `finished-here` | `observatory` | yes | 1, 1 |
| Training | Lineage Hall | `lineage-hall` | facility | `/training/lineage-hall` | `finished-here` | `party-hall` | yes | 1, 3 |
| Training | Gym | `gym` | facility | `/training/gym` | `finished-here` | **new** | yes | 3, 1 |
| Training | Dojo | `dojo` | facility | `/training/dojo` | `finished-here` | `brawler-dojo` | yes | 3, 3 |
| Racing | Racecourse (direct) | `racecourse` | racing | `/racing/racecourse` | `featured-open` | **new** | — | 3, 2 |
| Racing | Scenario Gate | `scenario-gate` | racing | `/racing/scenario-gate` | `ready-to-advance` | `scenario-gate` | — | 1, 2 |
| Racing | Expedition Map | `expedition-map` | racing | `/racing/expedition-map` | `promotable` | `tier-finale` | — | 2, 3 |
| Racing | Trophy Hall | `trophy-hall` | racing | `/racing/trophy-hall` | `new-flair` | **new** | — | 2, 1 |
| Farm | Sugar Grove | `sugar-grove` | site | `/farm/sugar-grove` | `finished-here` | `sugar-grove` | yes | 3, 1 |
| Farm | Orchard | `orchard` | site | `/farm/orchard` | `finished-here` | `orchard` | yes | 2, 3 |
| Farm | Fishery | `fishery` | site | `/farm/fishery` | `finished-here` | `fishery` | yes | 4, 2 |
| Farm | Nut Grove | `nut-grove` | site | `/farm/nut-grove` | `finished-here` | `nut-grove` | yes | 2, 1 |
| Farm | Herb Garden | `herb-garden` | site | `/farm/herb-garden` | `finished-here` | `herb-garden` | yes | 3, 3 |
| Farm | Fields | `fields` | site | `/farm/fields` | `finished-here` | `fields` | yes | 1, 1 |
| Farm | Vegetable Garden | `vegetable-garden` | site | `/farm/vegetable-garden` | `finished-here` | `vegetable-garden` | yes | 1, 2 |
| Farm | Mushroom Cave | `mushroom-cave` | site | `/farm/mushroom-cave` | `finished-here` | `mushroom-cave` | yes | 1, 3 |
| Farm | Pantry | `pantry` | station | `/farm/pantry` | `finished-here` | `pantry` | yes | 2, 2 |
| Farm | Kitchen | `kitchen` | station | `/farm/kitchen` | `finished-here` | `kitchen` | yes | 3, 2 |
<!-- /live -->

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
| **Account** (`account`, hidden) | Trainer name; check-in times and Notifications ([02](02-check-ins-and-notifications.md)); sync status and Sync now (D157); reduced motion and default race speed; app build and content (02 §9 keeps "id" and "version" off the screen); sign-out; dev mode in dev builds only | — | — | Open; reached from the trainer button and the menu, not drawn on the map | `/settings` |

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
| **Observatory** (`observatory`) | Constellation node sessions; per Uma, her tree: open nodes, card assignments (lineage picks are the Lineage Hall's), the next node and its Vegetables dish | Slots with faces and finish times; Umas with nodes left in their layer; Vegetables dishes in stock | Umas with a finished session here | Open | `/constellation/:umaId` |
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
After that the owner picks her: **`feature-uma { outfitId }`** sets `profile.featuredUmaId` to any owned Uma (an Uma not
in the Stable is refused with `unknown-uma`'s words; the one already featured changes nothing), from the quick sheet's
picker or her profile's **Feature her** (T138, `rework/tiers/roster.ts`).

**As built in phase 3 (T138):** until the plaza's chibi (phase 6) she is still art in the plaza's cell, `FeaturedUmaCard`,
also the Stable Peek's first card. "What she's doing" is her work row settled to the clock: the place, the current
entry's finished items of its count and its end ("Kitchen · 2 of 4 · 16:40", "+N queued" behind), "Kitchen · Ready", or
"Free".

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
phase 3** and **is deleted with the next phase that ships** (phase 4 is optional), by when the installed app, bookmarks and notification links all use the new
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
| Redirects ship with phase 3 and leave with the next phase that ships | "One release" made concrete |
| Routes, registry and menu ship in phase 3 on DOM tiles; the canvas in phase 6 | Links change once; the new game is playable before its art |
| Reused frames: `stable`, `warehouse`, `exchange`, `observatory`, `party-hall` (Lineage Hall), `brawler-dojo` (Dojo), `scenario-gate`, `tier-finale` (Expedition Map), and the ten `farmlands` buildings | They read right at 48 px |
| New frames: `racecourse`, `trophy-hall`, `card-library`, `gym`, in the shared `buildings` atlas | Nothing existing reads right; one atlas for every Hub |
| New `racing` tiles | No existing page looks like a racecourse |
| The Farm ring follows the Duo ring | Map neighbours are Duo partners, which teaches the Duos |
| Pips: display only, up to 8, busy first, "+N" beyond | Fits the Kitchen's 8; keeps the 44 pt rule on the whole button |
| A row carries a grid `cell` from §3's sketches; phase 6 adds map positions (T137) | §1's fractions place buildings on a canvas, which phase 3 doesn't draw (§11) |
| No lock field: every place is open (T137) | §3 marks every place Open; grade locks live inside places |
| A pip is Ready when she has anything to collect, a running batch's finished items included; the Ready badge, the counter and VoiceOver's "ready" are that one number (T137) | It is `readyCount`'s rule (02 §2), so a tile, the pill and Collect here agree |
| A busy ring shows the current item's progress (new `itemProgress`) (T137) | §4 names the current output's or unlock's progress; `progress` is the whole entry's |
| The start rule counts Umas Ready or Free (`needsATap`) (T137) | 02 §7's count; §2.4's "Waiting" is no status in 01 §2 |
| One 30-second clock, stopped while hidden, for pips and labels (T137) | §4's 30 seconds; 02 §8's labels are cut to the minute anyway |
| The Uma Tickets chip shows Shards as n/5, held at 5/5 in gold once a ticket can be made (T137) | The exchange is the owner's tap in the Stable (04 §6), so Shards can pass 5 |
| "Sync paused" means signed out (T137) | Sync waits for a token; T136's own states are offline and error, and §2.1 names a paused chip |
| Currency icons: a new two-tone coin, today's ticket and Uma coupon icons (T137) | §10.3's marks aren't in 2.4.0; the visual system wants two-tone currencies |
| A Peek is a non-modal half sheet; the same tile again opens the Page (T137) | §1's "tap once, again for the Page" needs the tile in reach |
| Global sheets are `?sheet=` routes; Collect all's intent rides in navigation state (T137) | Back closes them, and a reload never collects again |
| T137 places the featured Uma (cell, still art, sheet route); her card, sheet and picker are T138's | Animation is phase 6 (§11); the profile, picker and `feature-uma` are the Stable's |
| Faces are today's `face` art, then the outfit icon, then her initial (T137) | `character-faces` is phase 5's release; today's content stays until then (M034) |
| Full screen is a slot's `fullScreen(rest)`; places take sub-page slots (T137) | §6's flows live inside place routes; the Needs views (T142) live under the Stable (T138) |
| The hub view's counts are every place's default Counter; `useCounter` overrides one; 0 is hidden (T137) | One rule per counter, and only T141's two need data outside the work engine |
| The dev mount is `g2.html` at `/dev/g2/*`, by a dev-only rewrite, over `rework/sim` seeds (T137) | M034: nothing in today's entry imports `g2/`; seeds stay synthetic |
| The g2 budget is checked from now, by a measure-only build (T137) | An overrun found at T143 would come too late |
| `g2/` imports only today's surviving generic pieces, held by a test (T137) | T143 deletes the rest in one change |
| The shell reads the game through `G2Game`; T136 plugs its store into `boot.ts` (T137) | T137 lands before T136 (M034: "Needs —") |
| uma-art goes in `dependencies`, exactly 2.4.0; the domain keeps its dev dependency (T137) | The web bundles its images; the domain only tests ids |
| The hidden Account has no frame and no cell; the four new drawings are the only drawn places without a frame (T137) | It is reached from the trainer chip and the menu, never drawn (§3.1) |
| A port's answer carries its operation's id beside `recheck`'s answer (T137) | The check-in sheet keeps Collect all's id in navigation state, so a reload shows the same receipt (T142) |
| `PENDING` also holds the two global sheets, the plaza and the reveal (T137) | T143's "every slot filled" then covers every slot T138–T142 own, not only the places |
| Global sheets open over any shell route, Peeks only over their page (T137) | The bar's menu button is on every Page too; a Peek belongs to the page its tile is on |
| A page's tiles read in grid order, row by row (T137) | VoiceOver and the keyboard meet the tiles as the eye does |
| The `busy` seed runs BASELINE's policies with the roster at its cap of 25 and opens 40 minutes after day 3's 08:00 check-in, done for three in five Farm Umas (T137) | BASELINE alone holds 20 Umas until Shards grow it, and at 08:00 itself every Uma is Ready: the offset shows Ready, Free, queued and busy rings together |
| The Trophy Hall's counter is flair earned since this device's last visit (`uma-racer:g2:trophy-hall-seen`); opening the Trophy Hall reconciles flair once and marks the visit (T141) | [01](01-game-loop.md) §4.2: device conveniences live in `uma-racer:g2:` keys |
| The Racecourse's counter loads its draw lazily, so the entry holds none; the Scenario Gate's and the Expedition Map's are the hub view's (`ready-to-advance`, `promotable`: 0 before phase 9) (T141) | One rule per counter; §3.3's Map counter is promotable Umas |
| The Scenario Gate's ceremony is a full-screen flow at `/racing/scenario-gate/:umaId/ceremony?op=:id`; the Advance and Promote sheets are `?sheet=advance` and `?sheet=promote` on her career (T141) | §6 lists the promotion ceremony; a sheet is a route, so Back closes it |
| The Trophy Hall's scopes are `?scope=` uma, stable or trainer at `/racing/trophy-hall` (the featured Uma's badges by default), one Uma's at `/uma/:umaId` and the trainer profile at `/trainer` (T141) | §7.1's three routes; a scope is a view of one page |
| In phase 3 the featured Uma is the Stable Peek's first card and `FeaturedUmaCard`, with §5's quick sheet (T138) | The plaza chibi is phase 6 (§11); her sheet's actions work now |
| The Locked tab's multi-select unlocks up to the tickets in hand, one `unlock-uma` each with its own id, then reveals them in turn with Next (2 of 5) and Skip all; the reveal's route carries the rest as `?then=` and the count as `?of=` (T138) | A new account picks 20 ([13](13-removals-and-plan-changes.md) §5); 20 single unlocks would take about 80 taps; `?of=` keeps "2 of 5" after a reload |
| A Stable tile reads "T2 · Lv 13" (never the lifetime number) with its tier crest, a Ready dot from `advanceReadiness` or `promotionReadiness`, the planner's crosshair, NEW and a gold frame for an inductee; a Locked tile is desaturated art behind a lock (T138) | 03 §2 keeps the lifetime number for order only; [04](04-tiers-and-promotion.md) §10 |
| Album preferences live in `uma-racer:g2:album:<album>` keys, bounded as today's (20 views, 4,000 seen ids), not the generation-2 database; a device with none sees what it owns as already seen (T138) | Device conveniences only (rearchitecture/01 §4.2); today's live in today's Dexie, which the wipe removes |
| No Hall of Fame place in phase 3; a gold frame and a profile chip show inductees (T138) | The registry has none ([04](04-tiers-and-promotion.md) §10 calls it a Town Hall place); no Uma can be inducted for months |
| The profile links to T141's Advance and Promote sheets (`/racing/scenario-gate/:umaId`) and hosts T142's Needs tab (its sub-page slot) and target toggle (`PROFILE_UI.TargetToggle`); its Needs route shows layer progress until T142 lands (T138) | One owner per sheet; the profile is their door |
| The profile's tabs are Overview, Needs (`/needs`), Skills (`/skills`) and Racing (`?tab=racing`); ‹ › and a swipe move through the Owned tab's current album order (T138) | §7.1 names two sub-routes; Racing needs no route of its own |
| Her latest results read the save's `raceResults` log through the port's `logs`; her title, Prestige frame and showcase pins are the Trophy Hall's, linked from the Racing tab (T138) | Badge state is the Trophy Hall's (T141) and isn't in the rework state |
| The Exchange's header shows T141's purse bar, drawn from its `purseBar` view at the device's day (T138) | The purse bar's words and bands are T141's; the Exchange only shows them (09 §5.5) |
| Deep links: Exchange `?row=speed-tickets` and `?family=&grade=` (the grade opens its quantity sheet); Account `?row=sync`. Counters hide at 0 (T138) | §2.1's chips open "at the row", and the planner's "Buy at the Exchange" needs one; §2.2 keeps the bar quiet |
| Bond opens the Uma picker: Umas who can bond it now first, each with the dish, its stock and the real time; a busy Uma reads "Busy until 14:20" and shows Queue only when her running session is in that card's Dojo room; the rest follow with their reason. A pick goes to T139's `/training/dojo?session=&room=&unlocks=bond:<cardId>&back=`, `&queue=1` for Queue; "0 in Warehouse" offers Cook, T140's Kitchen job sheet (T138) | [06](06-cards-and-bonds.md) §6, §10; the session sheet is T139's |
| Times on screen are real (× *k*), e.g. "4 h 48 m" (T138) | [05](05-training-hub.md) §2: the pages' examples are base minutes, the game multiplies by *k* |
| The one Uma picker (`g2/ui/UmaPicker`) is the Stable's album in a sheet with today's `UmaPickerSheet` props (caller sorts, `describe`, `disabledReason`, `candidateIds`, plus an `action` per row), through a portal so it opens over another sheet; T139 and T140 use it (T138) | D181; the Stable owns the album it browses |
| Taps and their words use T140's `g2/ui/work` (`useTap`, `TapNoteLine`) and `g2/ui/ItemIcon`; a 44 pt tab row (`g2/ui/Tabs`) stands in for today's 32 pt SegmentedControl (T138) | One set of pieces (M034); 44 pt targets |
| The dev seeds carry invented skills and card names and run `dev-grant`; Account's dev section loads a seed in place through the port's `fixtures` and `loadFixture` (T138) | A profile's Skills tab needs a library to equip and the Library names to search; M034's rehearsal reaches a gate in one tap |
| The session sheet opens over a facility page from its query (`?session=:umaId&room=:room&unlocks=<kind>:<target>,…&back=<path>`, plus `&queue=1` and a slot card's `&slot=n`); `back` is an in-app path only, `session=` empty opens T138's picker, and only the facility's own unlocks are read (T139) | Every place is a link (§1); the Library's Bond, the planner, a Needs line and the build views reach it without importing it |
| The four facilities share one Page (the facility page and each Uma's build view at `:umaId`) and one Peek; their Counter stays the hub view's `finished-here` (T139) | One reading for four places, as the Farm's ten share one (T140); §3.2's "Umas with a finished session here" is T137's one Ready number |
| The Observatory's and the Gym's build views are full screen, with their own back; the Lineage Hall's and the Dojo's stay in the shell (T139) | §6 names only the tree and the Extra Stats map |
| `g2/ui/TreeGraph` is new, on `rework/constellation`'s `Tree`: the 0–100 canvas on the validator's 351 × 525 pt box scaled to the screen's width, 36 pt nodes at its 40 pt spacing, pinch zoom and a drag once zoomed; a **List** of 44 pt rows carries every node's action and the next layer's nodes, which the tree can't draw (T139) | §12's 44 pt rule over [05](05-training-hub.md) §4's spacing; today's `ConstellationGraph` reads Constellation Level and today's templates |
| The Dojo's card choices mount T138's `CardLibrary` in pick mode: the session sheet's **Add a card** (the room's cards she can bond now), each set slot (her bonded cards) and **Bond more** (cards she can bond now, into the sheet with the card's room) (T139) | [06](06-cards-and-bonds.md) §6: no weaker parallel picker |
| A facility's Peek: its slots with faces and the next finish; how many Umas have unlocks left here (`layerProgress`) with the first three; its dishes in the Warehouse (Vegetables, Mushrooms, or the Gym's stat, Duo and Feast dishes), or at the Dojo the bonds left this layer (T139) | §3.2's Peek column |
| No Umas yet: free slots, and Needs here and the sheet read "No Umas yet · unlock them in the Stable" with the Stable's link; an id the Stable doesn't hold reads `unknown-uma`'s words (T139) | A locked place shows no placeholder (§1); the empty state says what opens it |

## 14. Done when

- The app opens per §2.4. Every screen is reachable from a place, and every place from the ☰ menu.
- Each "Today" path in §7.2 redirects to its "After" path in phase 3 (a router test walks the table), deleted paths
  land on `/`, and the redirects are gone with the next phase that ships.
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
