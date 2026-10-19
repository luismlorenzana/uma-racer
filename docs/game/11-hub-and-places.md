# 11 · Hub and places

> **Status: as built, phase 3 (generation 2, D361) with phase 6's canvas Hub (T145, D363), the racer's own uma-art
> 2.7.0 (D364) and the shared uma-kit 0.7.1 (SB6, D373; the shared places, D372; the docked bar, D369; the plaza crowd, D371); first written 2026-10-13 (D333).** The Hub's four pages, every
> place on them, the menu, the routes, the two play modes as tap-by-tap flows, and the art. The registry and Hub view
> are `@racer/domain/hub` (T137, D353); the routes, redirects and boot `apps/web/src/app/`; the shell and the map are
> uma-kit's, fed by uma-racer's adapters in `hub/`; every Peek, Page and sheet `places/` (T138–T142). Each page is
> uma-rpg's Hub: a pixel-art map on a lazy Phaser canvas with DOM place links over it, swiped between, and the quick
> look in uma-rpg's side panel (§11), in light or dark (§12). Every building, the Racing page's ground,
> the currency marks and the tier crests are uma-art's own frames (§10.3). The place scenes are phase 7's and not built
> yet.

This page replaces the place list of the re-architecture's Hub plan ([rearchitecture/04](../rearchitecture/04-hub.md)
§3–§6). It keeps that plan's pattern whole: a place registry, pixel-art pages on a Phaser canvas with a DOM hit layer,
a Peek, Page and Counter per place, and routes `/:page/:place/*`. What changes is what's on the pages (D333).

## The menu tree at a glance

Every screen, from page to place to sub-page and sheet, as the code builds it. The place lines follow §3's live table
(route, kind, counter, pips); the routes are §7.1. On a page's map, a place's link opens its quick look in the side
panel (`/:page?peek=:place`, §2.6) and **Enter** opens its Page; the Racecourse is `direct` and opens its Page at once.
`…` stands for the place's own route.

```text
/                          the start rule (§2.4): the Stable's Locked tab, the Farm page, or the last page viewed
├─ Town Hall /town         bottom bar tab 1; the plaza's crowd, a tap opens ?sheet=featured&uma=:umaId (§5)
│  ├─ Stable               Peek; counter: Uma Tickets in hand
│  │  ├─ /town/stable                the roster album: ?tab=owned | locked; Locked's Select, the Unlock sheet, the reveal
│  │  ├─ …/outfit/:umaId             her profile, Overview; ?tab=racing for Racing; ‹ › through the Owned tab's order
│  │  │  ├─ …/outfit/:umaId/needs    her Needs tab: the planner's lines, each with its Start
│  │  │  └─ …/outfit/:umaId/skills   her Skills tab
│  │  └─ …/needs                     Needs of every Uma: the planner's roster view
│  ├─ Warehouse            Peek; shelves Raw, Crafted, Meals, Tonics, Tickets; a row's stock sheet (Make more, Sell)
│  ├─ Exchange             Peek; ?row=speed-tickets; ?family= picks a raw family, &grade= opens its quantity sheet
│  ├─ Card Library         Peek; the album; …/card/:cardId a card's page; Bond opens the Uma picker, then the Dojo
│  └─ Account (hidden)     no Peek, not on the map; the trainer chip and the menu open it; ?row=sync
├─ Training /training      bottom bar tab 2; its badge counts Umas with a finished session
│  ├─ Observatory          Peek, pips; ?session=… the session sheet; …/:umaId her tree (full screen)
│  ├─ Lineage Hall         Peek, pips; ?session=…; …/:umaId her parents, grandparents and golds
│  ├─ Gym                  Peek, pips; ?session=…; …/:umaId her Extra Stats map (full screen)
│  └─ Dojo                 Peek, pips; ?session=…; …/:umaId her bonds and card sets
├─ Racing /racing          bottom bar tab 3, the raised Race button
│  ├─ Racecourse           direct; race select; ?uma=:umaId picks her, &race=:raceId opens the pre-race sheet; ?goals=open filters to open careers
│  │  └─ …/run?result=:id            the run and its result (full screen)
│  ├─ Scenario Gate        Peek; every career; …/:umaId hers, with ?sheet=advance or ?sheet=promote
│  │  └─ …/:umaId/ceremony?op=:id    the advance or promotion ceremony (full screen)
│  ├─ Expedition Map       Peek; each Uma's distance to entry (phase 9's map isn't built; sub-routes go back here)
│  └─ Trophy Hall          Peek; ?scope=uma | stable | trainer; …/uma/:umaId her badges; …/trainer the trainer profile
└─ Farm /farm              bottom bar tab 4; its badge counts Umas with finished Farm work
   ├─ the eight sites      Fields, Vegetable Garden, Mushroom Cave, Orchard, Herb Garden, Fishery, Sugar Grove, Nut Grove
   │                       (the Duo ring, §3.4): Peek, pips; gather jobs of the site's family; ?job=… the job sheet,
   │                       on the Page or over the map from the Peek's "+" and targets (/farm?peek=:place&job=…)
   ├─ Pantry               Peek, pips; craft jobs, every family; ?job=…
   └─ Kitchen              Peek, pips; cook jobs under icon tabs by destination; ?job=…

On every shell route   ?sheet=menu (☰, §2.5) · ?sheet=featured (§5) · ?sheet=check-in (the pill, §2.3)
Outside the shell      /collection/reveal/uma/:umaId?then=…&of=…   the reveal after an unlock (full screen)
The old app's routes   redirected to their new places (§7.2); anything else goes to /
Dev builds only        /dev/seeds/* serves all of the above on synthetic accounts (§7.3)
```

The facility pages and the Farm's building pages each hold their slots, **Upgrade**, **Needs here** (the Farm's **For
your targets**) and **Collect here**; the Farm's also **Repeat here**. The session sheet's full query is
`?session=:umaId&room=&unlocks=<kind>:<target>,…&back=<path>` (plus `&queue=1` and `&slot=n`), and the job sheet's
`?job=:itemId&uma=&count=&queue=1&slot=&back=<path>`, on a building's Page or beside a Farm Peek's `?peek=` (D366);
`back` takes an in-app path only (§13). Every build view takes
`?preset=` to show another distance preset (view only). Sheets with no query (the Warehouse's stock sheet, the
Exchange's Speed Ticket buy, the Stable's Unlock, the Uma picker) live in their Page's state, so a reload closes them.

## 1. The pattern (kept)

| Part | What it is | Lives in |
|---|---|---|
| **Place registry** | One table: id, page, name, one-line blurb, art frame, position on the page (fractions of width and height), which slots its pips show, lock rule, counter, `direct` flag, hidden flag | `@racer/domain/hub`: pure, tested, rendered into the live manual |
| **Pages** | Four pixel-art maps on a lazy Phaser 4 canvas, uma-rpg's Hub (T145), shared since T147: seeded tile terrain, a road down the middle with a path to every door, props, uma-art's buildings, drifting clouds and chimney smoke; swiped between | uma-kit's `HubMap` (its canvas, scene, terrain, markers, palettes and grid), fed by `hub/HubPage.tsx` and `hub/racerHub.ts` (each page's tile page and palette) |
| **Hit layer** | One DOM link per place over its building, on the scene's own grid: its name pill with the counter, its slot pips and its Ready badge | uma-kit's place links and `Pips`, from `hub/HubPage.tsx`'s place models |
| **Place UI** | Per place: a **Peek** (its quick look, in uma-rpg's side panel), a **Page** (its full screen) and an optional **Counter**, all lazy | `places/registry.tsx` |
| **Routes** | `/:page`, `/:page?peek=:place`, `/:page/:place`, `/:page/:place/*` | `app/router.tsx`, `app/routes.tsx` |
| **Shell** | Account bar on top, bottom bar, the ☰ menu listing every place, the side panel for Peeks and a host for the global sheets | uma-kit's `AppFrame`, `AccountBar`, `BottomBar`, `PlaceMenu` and `PeekPanel` (T147), with uma-racer's words, chips, tabs and sheets passed in: `hub/RacerShell.tsx`, `hub/GlobalSheets.tsx` and `SheetHost.tsx`, `hub/PlacePeek.tsx`, `hub/nav.ts` (the global sheets and navigation state; the kit's `withParam`, `useLeave` and `peekPath` make the links and Back), `hub/counts.ts` (counters) |

Rules carried over from uma-rpg, unchanged:
- **The canvas draws and the DOM receives every tap.** No sprite is a tap target.
- **Every place is a link**, so Back and the iPhone's edge swipe work everywhere.
- **A locked place shows a lock and no placeholder text** (uma-rpg D95).
- **Explanations live behind an (i) button** on each Page, written from the registry blurb and the owning doc.
- **44 pt targets.** A place button covers its building, name pill and pips: at least 96 × 96 pt at 2×.
- **Swipe between pages** on the map (not inside sheets or the side panel), in the bottom bar's order, without
  wrapping: a mostly sideways drag of more than 60 pt, with the scene's camera fade. The bottom bar's tabs do the same.
- **No scroll or zoom on the map** (uma-rpg D113): each page is one screen.

Two clarifications of the old plan:
- **Counter** is a number badge on the place's name pill and its menu row. The three currencies also sit in the account
  bar (§2.1), and tapping one opens the place that sells or spends it.
- **Tap once for the Peek, then Enter for the Page** (uma-rpg D43). The Peek is uma-rpg's side panel: it slides in
  from the right over 88% of the screen with the map dimmed behind, so the map's links wait until it closes. A place
  flagged `direct` skips the Peek. Only the Racecourse is `direct`, because racing is the payoff and is already one
  button away (§2.2).

## 2. The shell

```text
┌──────────────────────────────────────────────────────────────┐
│ (L)          ◎ 12,340    ▭ 46    ◇ 3 · 2/5       Sync paused │  account bar
│                                                              │
│              page map (Phaser) + place links (DOM)           │
│                                         [ Collect all · 14 ] │  floating pill
├──────────────────────────────────────────────────────────────┤
│  Town Hall    Training    ( Race )    Farm    ☰ Menu         │  bottom bar
└──────────────────────────────────────────────────────────────┘
```

**The frame (T147, uma-kit):** the shell is uma-kit's `AppFrame`, the same in uma-racer and uma-rpg (uma-platform P48):
a box fixed to the screen's edges (`fixed inset-0`), not `h-dvh`. In a Home Screen app with a translucent status bar,
iOS can report the dynamic viewport a status bar short, which left an empty band under the bottom bar on an iPhone 15
(393 × 852); the fixed frame always covers the screen, and the page colour sits behind it. The account bar keeps the
top safe area (`pt-safe`), the bottom bar lifts by the safe area alone (§2.2), and a full-screen flow passes
`fullScreen` and the bars go (§6). The theme follows the phone's light or dark setting unless Account says otherwise
(§3.1).

### 2.1 The account bar

Left to right (uma-kit's `AccountBar`, with uma-racer's chips from `hub/RacerShell.tsx`). Every item is a 44 pt link
pushed with `back`, so Back returns to where it was tapped. The three currencies carry uma-art's pixel marks (§10.3,
the kit's `UiMark`).

| Item | Shows | Tap opens | Hidden when |
|---|---|---|---|
| Trainer button | The trainer's initial on a gold disc | Account (`/town/account`) | Never |
| **Prize Money** | Balance, with the `currency/prize-money` mark | Exchange (`/town/exchange`) | Never |
| **Speed Tickets** | Count, with the `currency/speed-ticket` mark | Exchange, at the Speed Tickets row (`?row=speed-tickets`) | Never (shows 0) |
| **Uma Tickets** | Count, with the `currency/uma-ticket` mark and the Uma Shards toward the next one ("2 · 3/5"; held at 5/5 in gold once a ticket can be made, since the exchange is a tap) | Stable, Locked tab (`/town/stable?tab=locked`) | Never ([04](04-tiers-and-promotion.md) §6: Shards keep coming from every tier) |
| **Sync** | Offline, Sync paused (signed out), or **Sync** in amber (waiting over a day) or red (failing) (D157) | Account, at the sync row (`/town/account?row=sync`) | Synced |

Numbers move with a CSS transition when they change (continuous HUD values never use springs). A race's prize flies
into the Prize Money chip on the result screen ([09](09-racing-rewards-and-exchange.md) §7). While the game boots, the
chips show blank pills where the numbers go.

### 2.2 The bottom bar

**Town Hall · Training · ( Race ) · Farm · ☰ Menu** (uma-kit's `BottomBar`, with uma-racer's tabs from
`hub/RacerShell.tsx`)

- **Race** is raised in the middle, a gold disc, and opens the **Racing page**, whose Racecourse opens in one more tap
  (it is `direct`). So a race starts four taps from anywhere: Race, Racecourse, a race card, Start race.
- **Tab badges:** Farm shows Umas with finished Farm work; Training shows Umas with finished sessions. Town Hall and
  Race carry none, so the bar stays quiet.
- The active page shows by shape (a two-tone icon and a gold marker on the bar's top edge) as well as colour.
- **☰ Menu** opens the menu sheet (§2.5) over the current route. It is the fallback route to everything when the
  canvas can't load.
- **The bar is docked** (uma-kit 0.2.0, D369): full width, flush to the screen's bottom edge, square corners, five equal
  slots. Its panel runs under the home indicator (`pb-bar-safe`), and Race is a 62 pt gold disc rising out of the bar
  in a ring of the panel's colour.
- **The app fills the iPhone's screen:** iOS 26 gives a Home Screen app that draws under its status bar a viewport one
  status bar short, and draws no fixed content below it. The kit's `fillScreen()`, run by `initAppearance()` at boot,
  makes the document exactly one screen tall there, so the bar and every full-screen flow reach the bottom edge.

### 2.3 The floating pill

On every Hub page, in the thumb zone just above the bottom bar on the right:
- **Collect all · N ready** when N Umas have something to collect ([02](02-check-ins-and-notifications.md) §2);
- **Check-in · N free** otherwise, which opens the same summary without collecting ([02](02-check-ins-and-notifications.md) §4);
- nothing, when nothing is ready and nobody is free.

It is account-wide on every page: one tap collects Farm jobs and Training sessions together. Either one opens
`?sheet=check-in` over the page; Collect all's intent rides in navigation state, so a reload shows the same summary
and never collects again (§13).

### 2.4 Getting in, and where the app opens

**Getting in** is uma-kit's `BootGates` (SD4), both games' frame in one order: the game's name on the page colour while
the app starts; **Sign in with Google** while nobody is signed in; the boot (the private content, then this phone's save);
then the start page. uma-racer has no first-launch step. A boot that stops says why in plain words, with the one button
that helps: **Try again** loads the content again, **Switch account** (a Google account that can't play) signs out to the
sign-in screen, and a save that couldn't open reloads the app. Nothing is ever cleared. Signing out in Account returns to
the sign-in screen.

`/` decides once, at launch, after the boot:
1. **A new account with no Umas** opens the Stable's Locked tab, to pick the first 20 with 20 Uma Tickets
   ([13](../rework/13-removals-and-plan-changes.md) §5).
2. **Anything needs a tap** (an Uma Ready or Free, `needsATap`: the count [02](02-check-ins-and-notifications.md)
   §7's app badge would show): the **Farm page**, where a check-in happens.
3. **Otherwise the last page viewed**, kept per device (`uma-racer:g2:lastPage`), or Town Hall the first time.

With push (phase 4, not built), a notification tap would open what it names: the summary, or the place itself for a
one-Uma notice ([02](02-check-ins-and-notifications.md) §7).

### 2.5 The menu

`?sheet=menu` (the bar's ☰ Menu), a bottom sheet titled **Every place** (`hub/GlobalSheets.tsx`, uma-kit's
`PlaceMenu`):

| Group | Entries, in order | Each opens |
|---|---|---|
| **Town Hall** | Stable · Warehouse · Exchange · Card Library | The place's Peek over its page |
| **Training** | Observatory · Lineage Hall · Gym · Dojo | The Peek |
| **Racing** | Racecourse · Scenario Gate · Expedition Map · Trophy Hall | The Racecourse's Page at once (`direct`); the others' Peeks |
| **Farm** | Sugar Grove · Orchard · Fishery · Nut Grove · Herb Garden · Fields · Vegetable Garden · Mushroom Cave · Pantry · Kitchen | The Peek |
| Under a rule | **Account** · **Needs of every Uma** | `/town/account`; the planner's roster view, `/town/stable/needs` |

- The groups are the four pages in the bar's order, each in two columns, and the entries are every drawn place of that
  page in registry order (`placesOn`), so a new place joins the menu by joining the registry. Account is the one hidden
  place.
- Each entry is a 44 pt row with the place's counter on it, hidden at 0. There are no locks: every place is open.
- A tap replaces the menu's history entry with the place, so Back from the Peek or Page returns to where the menu was
  opened.

### 2.6 The quick look (the side panel)

A place link on the map opens `/:page?peek=:place`: uma-rpg's side panel, uma-kit's `PeekPanel` since T147
(`hub/PlacePeek.tsx`), modal, sliding in from the right over 88% of the screen with the map dimmed and its scene paused
behind it.
- **Header:** the place's name, its counter, (i) for its blurb and a close button.
- **Body:** the place's registered Peek; a place without one shows its building over its blurb.
- **Enter {place}** in the thumb zone replaces the panel with the place's Page, so Back returns to the map.
- A swipe right, a tap on the dimmed map, Escape, the close button or Back closes it. Focus moves to its heading,
  stays inside while it is open, and returns to the place's link.
- A Peek opens only over its own page, and never for a `direct` place: `?peek=` naming one goes back to the bare page.
- **The Farm's quick look acts, as uma-rpg's does (D366):** chips for level, slots in use and speed; one 48 pt row per
  slot (her face in its progress ring, the item, "Carrot ×2 · 0/2", a "+1" chip with the next queued item, and the
  time left); a finished row's **Done** with **Collect** and **Repeat** (collect, then `repeat` for her); a free row's
  "+", which opens the job sheet over the map (`/farm?peek=:place&job=&slot=:n`), closing back to the panel; the
  targets as icons, each opening the sheet filled in; the stock by grade; and **Collect here** when anything is ready,
  above **Enter**. From the map: Collect a building in 2 taps, collect and restart a finished job in 2, start a job in
  a free slot in 3 ([07](07-farm.md) §10). The Training Peeks draw the same rows, with Collect and without Repeat.
- **A sheet inside the panel goes first:** the job sheet answers Escape before the panel does (the kit's sheet takes it
  in the capture phase, and the panel leaves an Escape already taken), Back closes it first since it is its own history
  entry, and a sideways drag on it never reaches the panel's swipe.

## 3. The four pages

Page ids, routes and the order of swiping: `town`, `training`, `racing`, `farm`.

The place registry, `@racer/domain/hub`'s `PLACES` (T137), as it stands. **At** is where a place stands on its page
map: the middle of its building's ground line, as fractions of the map's width and height (T145, uma-rpg's `at`). A
frame the pinned uma-art lacks is drawn as a code placeholder (§10.4); since 2.6.0 there is none.

Every page is laid out as uma-rpg lays its own: a road down the middle and the places on both sides of it, a quarter
in from either edge (x 0.24 and 0.76), with the odd one on the road (x 0.5). The Farm's ten take wider sides (x 0.2 and
0.79) so its Pantry and Kitchen fit on the road between them; the Training page leaves room under the Gym and the Dojo
for two rows of pips.

<!-- live:hub-places -->
| Page | Place | Id | Kind | Route | Counter | Frame | Pips | At (x, y) |
|---|---|---|---|---|---|---|---|---|
| Town Hall | Stable | `stable` | town | `/town/stable` | `uma-tickets` | `stable` | — | 0.24, 0.18 |
| Town Hall | Warehouse | `warehouse` | town | `/town/warehouse` | — | `warehouse` | — | 0.24, 0.72 |
| Town Hall | Exchange | `exchange` | town | `/town/exchange` | — | `exchange` | — | 0.76, 0.72 |
| Town Hall | Card Library | `card-library` | town | `/town/card-library` | — | `card-library` | — | 0.76, 0.18 |
| Town Hall | Account (hidden) | `account` | town | `/town/account` | — | — | — | — |
| Training | Observatory | `observatory` | facility | `/training/observatory` | `finished-here` | `observatory` | yes | 0.24, 0.18 |
| Training | Lineage Hall | `lineage-hall` | facility | `/training/lineage-hall` | `finished-here` | `party-hall` | yes | 0.76, 0.18 |
| Training | Gym | `gym` | facility | `/training/gym` | `finished-here` | `gym` | yes | 0.24, 0.6 |
| Training | Dojo | `dojo` | facility | `/training/dojo` | `finished-here` | `brawler-dojo` | yes | 0.76, 0.6 |
| Racing | Racecourse (direct) | `racecourse` | racing | `/racing/racecourse` | `featured-open` | `racecourse` | — | 0.5, 0.74 |
| Racing | Scenario Gate | `scenario-gate` | racing | `/racing/scenario-gate` | `ready-to-advance` | `scenario-gate` | — | 0.5, 0.2 |
| Racing | Expedition Map | `expedition-map` | racing | `/racing/expedition-map` | `promotable` | `tier-finale` | — | 0.76, 0.46 |
| Racing | Trophy Hall | `trophy-hall` | racing | `/racing/trophy-hall` | `new-flair` | `trophy-hall` | — | 0.24, 0.46 |
| Farm | Sugar Grove | `sugar-grove` | site | `/farm/sugar-grove` | `finished-here` | `sugar-grove` | yes | 0.2, 0.56 |
| Farm | Orchard | `orchard` | site | `/farm/orchard` | `finished-here` | `orchard` | yes | 0.79, 0.56 |
| Farm | Fishery | `fishery` | site | `/farm/fishery` | `finished-here` | `fishery` | yes | 0.2, 0.78 |
| Farm | Nut Grove | `nut-grove` | site | `/farm/nut-grove` | `finished-here` | `nut-grove` | yes | 0.2, 0.34 |
| Farm | Herb Garden | `herb-garden` | site | `/farm/herb-garden` | `finished-here` | `herb-garden` | yes | 0.79, 0.78 |
| Farm | Fields | `fields` | site | `/farm/fields` | `finished-here` | `fields` | yes | 0.2, 0.12 |
| Farm | Vegetable Garden | `vegetable-garden` | site | `/farm/vegetable-garden` | `finished-here` | `vegetable-garden` | yes | 0.79, 0.12 |
| Farm | Mushroom Cave | `mushroom-cave` | site | `/farm/mushroom-cave` | `finished-here` | `mushroom-cave` | yes | 0.79, 0.34 |
| Farm | Pantry | `pantry` | station | `/farm/pantry` | `finished-here` | `pantry` | yes | 0.5, 0.34 |
| Farm | Kitchen | `kitchen` | station | `/farm/kitchen` | `finished-here` | `kitchen` | yes | 0.5, 0.56 |
<!-- /live -->

### 3.1 Town Hall (`/town`)

```text
   [ Stable ]          ┃          [ Card Library ]
                ( plaza: featured Uma )
   [ Warehouse ]       ┃          [ Exchange ]
```

| Place (id) | Opens | Peek | Counter | Lock | Replaces |
|---|---|---|---|---|---|
| **Stable** (`stable`) | The roster: Owned and Locked tabs with counts, a tier crest on every owned tile (uma-art's bronze, silver and gold, §10.3), a tier filter, the shared picker's sorts and filters (D181). An Uma's profile in uma-kit's profile frame (SD4): her portrait, name, scenario and Farm Level, the shared level label ("Lv 13", "T2 · Lv 13"), her tier crest, what she's doing, then the Overview (her build per facility), **Needs** ([02](02-check-ins-and-notifications.md) §6), Skills and Racing tabs. A locked Uma: uma-kit's unlock confirm (Uma Tickets N → N−1, **Unlock for 1 Ticket**; tier 1, [04](04-tiers-and-promotion.md)), then the collection reveal; the Locked tab's multi-select and the reveal stay this game's | The featured Uma; "23 Umas · T1 21 · T2 2"; Umas ready to advance or promote; Uma Tickets in hand | Uma Tickets in hand | Open | `/stable`, Uma profile, skills; Home's featured hero |
| **Warehouse** (`warehouse`) | uma-kit's shelves (SD4): every stack held on the Raw, Crafted, Meals, Tonics and Tickets shelves; grade chips (every grade, one grade, or the highest held per family); each row's reserved, coming and needed counts; the stock sheet with what it is, what's free, the recipes that use it, **Make more** and **Sell** ×1, ×10 or All ([07](07-farm.md) §10, [09](09-racing-rewards-and-exchange.md) §6) | The biggest stacks; what the planner is short of; "Surplus worth 1,240" | — | Open | `/farm/items` |
| **Exchange** (`exchange`) | Prize Money, Speed Tickets held and the Daily Purse, then uma-kit's buy rows (SD4): Speed Tickets, and raw ingredients by family tab; each row's sheet takes how many and shows the total ([09](09-racing-rewards-and-exchange.md) §5) | Prize Money, Speed Tickets held, the planner's top shortage with its price | — (its currencies are in the account bar) | Open | Nothing (new) |
| **Card Library** (`card-library`) | Every SSR, open (D329): lens and Uma controls, sorts, filters, the card page with its bond cost and bonded Umas, **Bond** into the Dojo's session sheet ([06](06-cards-and-bonds.md) §6) | The newest cards; bonds made this tier; cards the featured Uma could bond now | — | Open | `/cards`, `/cards/:cardId` |
| **Account** (`account`, hidden) | uma-kit's Account frame (SD4): the trainer's name, which can be changed (1–32 characters, saved on the trainer badge row); the wallet (Prize Money, Speed Tickets, Uma Tickets); this phone's **Appearance** (System, Light or Dark, kept in `uma-racer:g2:appearance`, T147); then this game's sections: check-in times ([02](02-check-ins-and-notifications.md); no notifications, D336), sync status and Sync now (D157), reduced motion and default race speed; app build and content (02 §9 keeps "id" and "version" off the screen); Sign out; in dev builds only, a dev section that runs `dev-grant` (grants, Finish her work, Jump to her gate) and, on the seeds' mount, loads another synthetic seed | — | — | Open; reached from the trainer button and the menu, not drawn on the map, so it has no Peek | `/settings` |

**The shared Uma album (SB6, D373).** The Stable uses `uma-kit/album`'s `AlbumChrome`, `AlbumGrid` and
`useAlbumPrefs`: Icons is five face crops across, Cards three busts, List one full-width face row. Owned/Locked,
tier, Ready, planner target, New and A+ aptitude filters, and Level (lifetime), Release, Name, Tier, Racing and Farm
sorts remain racer-owned. The labels show tier-local levels, not lifetime numbers. Her tier, Ready, target, NEW and
Hall of Fame marks remain visible; opening her profile clears only her NEW mark. The existing
`uma-racer:g2:album:<album>` keys are also the kit's keys, so saved queries, views and seen ids need no migration.
The Library shares the chrome and query but keeps its card-specific tiles, lens, filters and sorts.

Every Uma chooser is the kit's `UmaPicker`: Farm, sessions, Lineage, Bond, Library lens, featured Uma, Racecourse,
Trophy Hall and dev grants. A compact selected-Uma face control replaces the Farm and Racing list strips. Work uses
Free first, then Farm Level; Lineage and Racing keep lifetime Level. The Farm's tie keeps suited first. Unavailable
Umas retain their reasons, and racer-only Queue, Recall and Cook appear in a follow-up after choosing an Options
tile, without nesting a second button inside the kit's. The original operations, confirmations, links and save
rules do not change. See [05](05-training-hub.md) §8 and [07](07-farm.md) §10.

`AlbumArtProvider` is the racer's `app/albumArt.tsx`, using authenticated, hash-verified content and held image URLs.
Small Umas are `FaceTile` (round in pips and slots); large Umas are `UmaBust`. **Today's `face` is per character:**
SE1 has not yet adopted uma-data 1.1.0's published `outfit-faces`, and SB6 explicitly keeps the existing face pack
until then. A missing or failed face/bust keeps her outfit icon, then her initial. Only the Town Hall plaza requests
chibis; its card and quick sheet use busts. Race art is busts, including pre-race runners, PixiJS tokens, feed,
finishing order and result hero; no race code requests chibis.

### 3.2 Training (`/training`)

```text
   [ Observatory ]     ┃          [ Lineage Hall ]
          ( lawn, hedges, benches ┃ lamps, banners )
   [ Gym ]             ┃          [ Dojo ]
```

Each facility's Page is [05](05-training-hub.md) §8's: one header row with level, slots and the Upgrade button; the
Farm's compact slot rows, grouped by room; **Needs here**; Collect here. Each also holds the **per-Uma build view** that today's Training scene shows as a tab, at
`/training/:facility/:umaId`.

| Place (id) | Opens | Peek | Counter | Lock | Replaces |
|---|---|---|---|---|---|
| **Observatory** (`observatory`) | Constellation node sessions; per Uma, her tree: open nodes, card assignments (lineage picks are the Lineage Hall's), the next node and its tonic | Its slots as the Farm's rows: faces in their rings, the tonic, how long is left or Done with Collect; Umas with nodes left in their layer; tonics (and the salads and soups standing in) in stock | Umas with a finished session here | Open | `/constellation/:umaId` |
| **Lineage Hall** (`lineage-hall`) | Inspiration sessions; per Uma, her parents and grandparents (any Uma ever owned) and their golds | Same, with tonics (a slot takes one; uniques and golds none) | Same | Open | `/constellation/:umaId/inspiration` |
| **Gym** (`gym`) | Five stat rooms of Extra Stats sessions; per Uma, her Extra Stats map and active nodes per preset | Rooms with faces; Umas with nodes left by stat; stat meals, Duos and Feasts in stock | Same | Open | `/constellation/:umaId/extra-stats` |
| **Dojo** (`dojo`) | Six card-type rooms of bond sessions; per Uma, her bonds and her card set per preset ([06](06-cards-and-bonds.md) §3) | Rooms with faces; bonds left this layer | Same | Open | `/constellation/:umaId/cards`, `/stable/:umaId/deck` |

### 3.3 Racing (`/racing`)

```text
                 [ Scenario Gate ]
   [ Trophy Hall ]     ┃          [ Expedition Map ]
                  [ Racecourse ]          (thumb zone)
```

The Racecourse sits lowest and central, on the road, nearest the raised Race button and the thumb.

| Place (id) | Opens | Peek | Counter | Lock | Replaces |
|---|---|---|---|---|---|
| **Racecourse** (`racecourse`, `direct`) | Race select: the selected-Uma face and Change picker, the Daily Purse bar, **Today's featured**, Next up, every race; then the pre-race sheet, the run (full screen) and the result ([09](09-racing-rewards-and-exchange.md) §3–§7) | None: it opens at once. Its header carries what a Peek would (featured races, purse) | Featured bonuses still open today (0–3) | Open | `/race`, `/race/run` |
| **Scenario Gate** (`scenario-gate`) | Every Uma's career: stage, goal races, holds; the **Advance** sheet ([03](03-uma-progression.md)); per Uma at `/:umaId` | Goals in progress for the featured Uma; Umas ready to advance | Umas ready to advance | Open | Home's career panel; `/scenario/:umaId/start` |
| **Expedition Map** (`expedition-map`) | **Phase 3: a placeholder** (T141) listing each Uma's distance to entry, and Promote for an Uma holding a completed run (only the dev seeds). **Phase 9:** the world map with seven region pins, the list view, each Expedition's page with her run, Start, Resume, Pause and **Promote** ([10](../rework/10-expeditions.md) "Places and screens") | Umas on Expeditions with their wins ("5/8"); Umas eligible to start | Umas whose run is complete and who can promote | **Open from day one.** Before anyone qualifies it opens on "No Uma has finished her tier yet" with each Uma's distance to entry ([10](../rework/10-expeditions.md)) | Nothing (new) |
| **Trophy Hall** (`trophy-hall`) | Badges in Uma, Stable and Trainer scopes, titles, showcases, the G1 trophy wall, records, Prestige, the trainer profile and achievements | Recent flair (today's Home panel) | New flair since the last visit | Open | `/badges`, `/trainer`; Home's flair panels |

In phase 9 the Expedition Map's sub-routes use [10](../rework/10-expeditions.md)'s checked-in Expedition ids (until then
every sub-route goes back to the Map):
`/racing/expedition-map/:expeditionId` for `us-speed`, `kr-sprint`, `us-dirt-classics`, `ae-dirt-classics`,
`hk-speed-mile`, `au-speed-mile`, `gb-speed-mile`, `gb-champions`, `hk-crown-cup`, `au-mile-championship`, `au-cups`,
`gb-classics-stayers` and `fr-arc-stayers`; `?uma=:umaId` picks the Uma, and `?view=list` the list view.

### 3.4 Farm (`/farm`)

The eight sites stand on a ring in uma-art's Duo order, so **map neighbours are Duo partners** (README ring:
Grains – Vegetables – Mushrooms – Fruits – Herbs & Spices – Fish – Sweets – Nuts & Seeds): clockwise, four down each
side of the road, joined across it at the top and the bottom, with the Pantry and Kitchen on the road in the middle.

```text
   [ Fields ]          ┃          [ Vegetable Garden ]
   [ Nut Grove ]   [ Pantry ]     [ Mushroom Cave ]
   [ Sugar Grove ] [ Kitchen ]    [ Orchard ]
   [ Fishery ]         ┃          [ Herb Garden ]
```

| Place (id) | Opens | Peek | Counter | Lock | Replaces |
|---|---|---|---|---|---|
| **Fields, Orchard, Fishery, Herb Garden, Vegetable Garden, Mushroom Cave, Sugar Grove, Nut Grove** (their uma-art ids) | The building page: gather jobs of its family ([07](07-farm.md) §10) | A row per slot (face in its ring, item, ×N · made, time left, or Done with Collect and Repeat; a free one's "+" opens the sheet over the map); the planner's lines as icons; its family's stock by open grade; Collect here | Umas with finished outputs here | Open; grades inside lock by Farm Level ("Farm Lv 16") | `/farm/district/:districtId` |
| **Pantry** (`pantry`) | Craft jobs, every family | Same, without the stock by grade | Same | Open | Today's Workshop |
| **Kitchen** (`kitchen`) | Cook jobs; recipe icon tabs by destination ([07](07-farm.md) §10) | Same, without the stock by grade | Same | Open | Today's Kitchen; `/farm/recipes` |

There is no Farmhouse: Farm Level lives on each Uma's profile, recipes in the Kitchen's sheet, and the Wishlist became
the planner ([07](07-farm.md) §13).

## 4. Slot pips

On the **Farm** and **Training** pages every building shows its slots under its name pill, so the whole roster reads
at a glance.

| Pip | Looks like |
|---|---|
| **Busy** | The worker's face (release `character-faces`, falling back to her outfit icon) in a ring filled by the current output's or unlock's progress |
| **Ready** | The ring full and gold, with one small bounce as it turns ready (uma-kit's; none with reduced motion); the building gets a **Ready** badge with the count |
| **Queued behind** | A "+2" chip on the busy pip's shoulder |
| **Free** | A small dark dot, as uma-rpg draws an open slot |
| **Room** (Gym, Dojo) | The ring tinted by its room's stat or card type |

- **Up to 8 pips**, in two rows of four: busy first, then ready, then free. That fits the Kitchen at Lv 1 (6 slots,
  [07](07-farm.md) §6). Beyond 8 (the Kitchen at Lv 2 and 3 has 9, the Gym at Lv 2 10, the Dojo 12,
  [05](05-training-hub.md) §7), the eighth pip becomes "+N".
- **Pips are display only.** The place link is the target; a pip at 20 pt would be under 44. On the map they sit straight on
  the ground under the name pill, with no backing, as in uma-rpg: faces in their rings, open slots as dots.
- **Progress is computed from start times** with the shared idle math, redrawn every 30 seconds and on foreground,
  never animated per frame.
- **VoiceOver** reads the button as one line: "Kitchen. 6 of 9 slots busy, 2 ready, 1 queued."

## 5. The featured Uma

**The plaza's crowd** (SA7, uma-kit 0.3.0, D371): up to five small Umas stand round the Town Hall plaza in uma-kit's
loose V (`CROWD_SPOTS`). The featured Uma stands in front, then the Umas with the highest lifetime level, newest release
first on ties, then name; fewer stand when fewer are owned. uma-racer has no parties, so the level rule fills the
crowd (P48). Each is 44 pt of her art: the kit's `UmaChibi`, else her bust, icon or initial. Each bobs 2 px on its own
beat and stands still under reduced motion, and the ground round them is kept clear of props (`CROWD_CLEARING`). No names show on
the map: each figure's VoiceOver name says who she is ("Featured Uma: …", or "…: Train, Race or Profile").

Tapping a figure opens the **quick sheet** for that Uma (`?sheet=featured&uma=:umaId`; closing it clears both):
- her name, tier crest, scenario, Racing Level and what she's doing ("Kitchen · 2 of 4 · 2h 10m", how long it has
  left, D366);
- **Train**, which opens her profile's **Needs** tab, where each next session has a Start ([02](02-check-ins-and-notifications.md) §6);
- **Race**, the Racecourse with her picked;
- **Profile**;
- **Feature another Uma**, the Uma picker.

She replaces today's Home hero. The first Uma unlocked is featured on a new account ([13](../rework/13-removals-and-plan-changes.md) §5).
After that the owner picks her: **`feature-uma { outfitId }`** sets `profile.featuredUmaId` to any owned Uma (an Uma not
in the Stable is refused with `unknown-uma`'s words; the one already featured changes nothing), from the quick sheet's
picker or her profile's **Feature her** (T138, `tiers/roster.ts`).

**As built (T138, T145, SA7, SB6):** she stands on the road between the four Town Hall places (`PLAZA_AT`, kept clear
of props), as the front chibi in the kit's gently bobbing crowd. `FeaturedUmaCard`, also the Stable Peek's first card,
uses her bust. "What she's doing" is her work row settled to the clock: the place, the current
entry's finished items of its count and how long it has left ("Kitchen · 2 of 4 · 2h 10m", "+N queued" behind),
"Kitchen · Ready", or "Free".

## 6. Full-screen flows

These hide the account bar and bottom bar (uma-kit's frame with `fullScreen`, so they fill the screen as the shell
does), and return to where they came from:
- **the race run and its result** ([09](09-racing-rewards-and-exchange.md) §7);
- **the collection reveal** after unlocking an Uma, outside the shell in the same frame without bars;
- **an Uma's constellation tree and Extra Stats map**, which open full screen inside their facility's route;
- **the promotion ceremony** ([04](04-tiers-and-promotion.md)).

The Expedition world map stays inside the shell: it is a place Page, and its Uma picker sits above the bottom bar.

## 7. Routes

### 7.1 The new routes

The live router (`app/router.tsx`) has no basename: the root route renders `/collection/reveal/uma/:umaId` outside the
shell, and the shell's children are `/` (the start rule), `/:page` and `/:page/:place/*`. A page that isn't one, or a
place not on the page its route names, goes to `/`. A place's `*` is its sub-route (`rest`), which its Page reads,
unless a sub-page slot claims it first (the Stable's `needs`, `places/registry.tsx`).

| Route | Screen |
|---|---|
| `/` | The start rule (§2.4) |
| `/town`, `/training`, `/racing`, `/farm` | A page's map; `?peek=:place` opens its side panel (§2.6); on `/farm`, `&job=…` opens the job sheet over it (D366) |
| any shell route `?sheet=menu`, `featured` or `check-in` | A global sheet over it (§2.3, §2.5, §5); Back closes it |
| `/town/stable` | The roster; `?tab=owned` or `?tab=locked` |
| `/town/stable/outfit/:umaId` | Her profile (Overview; `?tab=racing` for Racing); `/needs` and `/skills` are its sub-pages |
| `/town/stable/needs` | The planner's roster view ([02](02-check-ins-and-notifications.md) §6) |
| `/town/warehouse` | The Warehouse |
| `/town/exchange` | The Exchange; `?row=speed-tickets` scrolls to Speed Tickets, `?family=` picks a raw family and `&grade=` opens its quantity sheet |
| `/town/account` | Account; `?row=sync` scrolls to the sync row |
| `/town/card-library`, `/town/card-library/card/:cardId` | The Library and a card page |
| `/training/:facility` | `observatory`, `lineage-hall`, `gym` or `dojo`; `?session=…` opens the session sheet (§13) |
| `/training/:facility/:umaId` | Her build view at that facility (tree, Inspiration, Extra Stats map, bonds and card set); `?preset=` shows another preset. The Observatory's and the Gym's are full screen |
| `/racing/racecourse` | Race select; `?uma=:umaId` picks her, `&race=:raceId` opens the pre-race sheet; `?goals=open` filters to open careers |
| `/racing/racecourse/run?result=:id` | The run and result of a committed race, full screen |
| `/racing/scenario-gate`, `/racing/scenario-gate/:umaId` | Careers, and one Uma's career; `?sheet=advance` or `?sheet=promote` on hers |
| `/racing/scenario-gate/:umaId/ceremony?op=:id` | The advance or promotion ceremony, full screen |
| `/racing/expedition-map` | The Map's placeholder; `/:expeditionId` is phase 9's and goes back to the Map until then (§3.3) |
| `/racing/trophy-hall` | Badges; `?scope=uma` (the featured Uma's, the default), `stable` or `trainer` |
| `/racing/trophy-hall/uma/:umaId`, `/racing/trophy-hall/trainer` | One Uma's badges; the trainer profile |
| `/farm/:building` | One of the ten Farm buildings, by uma-art id; `?job=…` opens the job sheet (§13) |
| `/collection/reveal/uma/:umaId` | The reveal, full screen outside the shell; `?then=<id>,…&of=n` queues the next Umas |

### 7.2 The old app's routes

Every route of the old app's router (at the `pre-split` tag), and where it goes now. The live router makes each "After"
path a redirect (`app/redirects.ts`, T143), and a router test walks this table (§14):

| Before | After |
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
| `/minigames/spark-match/:umaId`, `/minigames/friendship-training/:cardId`, `/minigames/bond-recall/:cardId?` | Deleted: no minigames remain ([13](../rework/13-removals-and-plan-changes.md) §1) |
| `/rpg/*` (nine routes) | Deleted (D322) |
| `/puzzles`, `/puzzles/*`, `/puzzles/content`, `/puzzles/practice` | Deleted (D326) |
| `/collection/reveal/:kind/:id` | `/collection/reveal/uma/:umaId`; the `card` kind is deleted |
| `/dev/*` (thirteen proof routes) | Deleted with their systems. New dev proofs live under `/dev/`, in dev builds only: the seeds' mount at `/dev/seeds/*` holds them (`/dev/seeds/dev/check-in`, T143) |

**The redirect rule** (the re-architecture's, made concrete): each "After" path above is a redirect that **ships with
phase 3** and **is deleted with the next phase that ships** (phase 4 is optional), by when the installed app, bookmarks
and notification links all use the new paths. T145's Hub, phase 6 brought forward and shipped the same day as phase 3,
didn't count: the redirects (and the first-boot wipe, which leaves with them) go with phase 4 if the owner asks for it,
else phase 5 (D365). Saved data holds no paths, so nothing else changes. An unknown path goes to `/`.

### 7.3 Dev builds: the seeds' mount

In dev builds only, `/dev/seeds`, `/dev/seeds/` and anything under it (`isSeedsPath`) mount `dev/main.tsx` instead of
the app: the same routes under the `/dev/seeds` basename, over an in-memory port on `@racer/domain/sim`'s synthetic
accounts. `?seed=busy | fresh | quiet | gate | promote | tired | spent | stopped` picks one, `?at=HH:MM` moves its clock,
`?save=device` boots the device save on the seeds' content instead, and `?canvas` draws the map with Phaser's Canvas
renderer so screenshots capture it. The dev proofs sit under it (`/dev/seeds/dev/check-in`), and at `/dev/check-in`
on the dev app itself. A production build holds none of it and answers `/dev/seeds` as an unknown path
([architecture](architecture.md#dev-seeds)).

## 8. The old Home's panels

| Before | After |
|---|---|
| Featured Uma hero with Train and Race | The plaza's featured Uma and her quick sheet (§5); the raised Race button |
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
| Open the app | `/` lands on the **Farm page** (§2.4): the pips show who's done | — |
| **Collect all · 9 ready** | The floating pill; the summary sheet opens ([02](02-check-ins-and-notifications.md) §4) | 1 |
| **Repeat all (7)** | In the summary's thumb zone | 1 |
| **Start suggestions (2)** for the free Umas | In the summary | 1 |
| Close | Pips now show every slot busy | — |

Three taps and about 30 seconds ([02](02-check-ins-and-notifications.md) §1). A blocked queue adds one or two ("Buy 2 ·
190"). Swiping once to the Training page shows the sessions' pips, but the summary already covered them.

### 9.2 A racing session (free evening)

| Step | Where | Taps |
|---|---|---|
| **Race** | The Racing page | 1 |
| **Racecourse** | Race select, on the first Uma by lifetime level, highest first; release newest first, then name and id break ties (D368). An explicit `?uma=` still picks her | 1 |
| A race card: **Today's featured** or **Next up** | The pre-race sheet | 1 |
| **Start race** | The run, full screen | 1 |
| **Skip** (optional) | The result: Racing EXP, Prize Money with its band, goals, flair | 1 |
| **Next Uma** | Race select on the next Uma in the shared picker's lifetime order, Daily Purse bar updated | 1 |
| A race card, **Start race**, Skip, Next Uma … | Four taps a race | 4 |
| Back to the Hub | The Racing page; then the summary's **Speed up** or the Exchange to spend the evening's Prize Money | 1–2 |

Forty races is about 160 taps and, with Skip, under an hour: the heavy evening [09](09-racing-rewards-and-exchange.md)
§3 sizes the Daily Purse for.

**Open goals** is an optional filter chip, off by default, not an ordering rule. It hides completed careers without
changing the remaining order; it lives in `?goals=open`, not the save or album preferences. Turning it on keeps the
selected Uma if she has open goals, else selects the first shown, and closes any pre-race sheet. If every career is
complete, the page says so and leaves the chip available to turn off. **Next Uma** follows the same level order.

## 10. Art

### 10.1 Buildings

All 48×48 with a ground line, from `@luismlorenzana/uma-art` `buildings/atlas.json` (checked at 2.7.0: 40 frames on
five pages, `farmlands`, `wilds`, `learning`, `town` and, since 2.6.0, `racing`).

| Place | Frame | Source | Why it fits |
|---|---|---|---|
| Stable | `stable` | uma-art, `town` | A stable with a horse at the half-door |
| Warehouse | `warehouse` | uma-art, `town` | A big barn |
| Exchange | `exchange` | uma-art, `town` | A striped market stall |
| Card Library | `card-library` | uma-art 2.6.0 (A01) | No frame reads as a library: `mage-tower` and `arcane-armory` read as magic |
| Observatory | `observatory` | uma-art, `town` | A domed telescope: constellations |
| Lineage Hall | `party-hall` | uma-art, `town` | A timbered hall hung with heraldic banners: a family's hall |
| Gym | `gym` | uma-art 2.6.0 (A01) | Nothing reads as a gym: `rangers-lodge`'s archery target and `lancers-barracks`' spears read as combat |
| Dojo | `brawler-dojo` | uma-art, `learning` | A Japanese dojo with a tiled roof and lanterns, the right name and look |
| Racecourse | `racecourse` | uma-art 2.6.0 (A01) | The centrepiece must read as horse racing (grandstand, white rails, turf oval, finish post); the one stadium frame is the Expedition Map's |
| Scenario Gate | `scenario-gate` | uma-art, `town` | A white arch with a chequered banner over a track |
| Expedition Map | `tier-finale` | uma-art, `town` | A stadium ringed with flags of many colours, already uma-art's tier finale; the Expedition is ours ([10](../rework/10-expeditions.md)) |
| Trophy Hall | `trophy-hall` | uma-art 2.6.0 (A01) | A columned hall with a gold cup; `knights-bastion` reads as a castle |
| Eight sites, Pantry, Kitchen | their own ids | uma-art, `farmlands` | uma-rpg's Farmlands, reused whole ([07](07-farm.md) §1) |

**Not used**, because they would confuse: the eight other `learning` frames (`mage-tower`, `spell-blade-salle`,
`cleric-chapel`, `summoner-circle`, `rangers-lodge`, `lancers-barracks`, `arcane-armory`, `knights-bastion`), uma-rpg's
class halls, which read as magic, combat or worship; and the ten `wilds` frames (D330: no Mining, gathering or gear).

### 10.2 Tiles

| Page | Tiles | Notes |
|---|---|---|
| Town Hall | `town/*` | Ground, plaza paths, barrels, crates, flower pots, benches, lamps, trees |
| Training | `learning/*` | Hedges, benches, flower beds, lamps, banners: a campus |
| Racing | `racing/*`, uma-art 2.6.0 (A01) | Turf ground ×4; a dirt-track path set (`path-0…15`, the same edge masks, never closing a 2×2); props: white rail, furlong post (16×32), pennant (16×32), flower box. Pinned since 2.6.0; before it the page drew on `town/*` (§10.4) |
| Farm | `farmlands/*` | As uma-rpg's Farmlands |

### 10.3 The racer's own art, as built (uma-art 2.6.0 and 2.7.0)

ChatGPT drew it in uma-platform's `scripts/pixel-art` (original, deterministic, in git) from the packets A01 and A02,
and uma-art published it as two minor releases (uma-platform P45, P46). The racer pins **2.7.0** (D364):

| What | Ids | Size | Where it shows |
|---|---|---|---|
| Buildings (2.6.0) | `racecourse`, `trophy-hall` (page `racing`), `card-library` (page `town`), `gym` (page `learning`) | 48×48, `anchorY` 44 | The map and every DOM building sprite (§10.1); appended to the shared `buildings` atlas, so the re-architecture's planned `racer` family is these four frames |
| Racing tiles (2.6.0) | `racing/ground-0…3` (mown turf), `racing/path-0…15` (raked dirt with rail edging), props `racing/rail`, `racing/furlong-post`, `racing/pennant`, `racing/flower-box` | 16, tall props 16×32 | The Racing page (§10.2) |
| Currency marks (2.7.0) | `currency/prize-money`, `currency/speed-ticket`, `currency/uma-ticket` in `ui` | 16×16, drawn at 16 pt | The account bar, the Exchange's prices and wallet, the race result's prize, the profile's results (`ui/UiMark.tsx`); the Warehouse's sell sheet still draws T137's two-tone coin |
| Tier crests (2.7.0) | `tier/1`, `tier/2`, `tier/3` in `ui` (bronze, silver, gold) | 12×12, drawn at 24 pt | Uma tiles, the featured Uma, her profile (`TierCrest`, read as "Tier N") |
| Speed Ticket item (2.7.0) | `speed-ticket` in `items`, `kind: 'ticket'` | 32×32 | The Warehouse, job cards and prices (`ui/ItemIcon` takes the release's frame; the catalogue keeps no art for it) |

**Not drawn yet: the ten tonics** (`tonic-1` … `tonic-10`, D375), one 32×32 frame each in `items` under its id, as the
Speed Ticket is. Until a release ships them, `ui/ItemIcon` draws a tonic as its name on a plain tile; it takes a frame of
the tonic's id as soon as the pinned `items` index has one. Their packet is next in `docs/handoff/tasks/`.

**Not drawn yet (phase 9):** the Expedition world map (a composition like `world`'s islands: seven regions with pin
spots) and its seven region crests (United States, South Korea, Dubai, Hong Kong, Australia, Britain, France/Europe, at
16 and 32 px) for [10](../rework/10-expeditions.md)'s Map. Their packet is written when phase 9 is specified.

Uma art stays private: chibis only in the plaza, faces for small Umas and busts for large Umas and every race surface;
outfit icons are the fallback. Faces still map to today's per-character pack until SE1 adopts the published
`outfit-faces` family. The tier-3 wet
course ([10](../rework/10-expeditions.md)) is a palette parameter of the code-drawn race course, not new art.

The racer checks every registry frame against the pinned index in a test, as uma-rpg's `frames.test.ts` does: a frame
the pinned release lacks fails CI, never a blank building.

### 10.4 Missing art, as built (T145)

A frame the pinned atlas lacks is never an empty or white box:
- **The map draws uma-rpg's code-drawn marker** for it in the page's palette (uma-kit's `drawMarker` and `PALETTES`),
  and the DOM's building art (`ui/BuildingSprite.tsx`) draws the same marker as SVG. T145 shipped the four racer
  buildings this way until 2.6.0; any future place does the same until its art ships.
- **A page whose ground isn't drawn yet borrows Town's tiles** (`tilePageFor` in `hub/racerHub.ts`: `racing` when the atlas has
  `racing/ground-0`, else `town`), as Racing did until 2.6.0.
- **`AWAITING_ART`** in `@racer/domain/hub` lists the frames the registry test lets be missing. It is empty since 2.6.0,
  so the frames test is strict; a future place waiting for its art goes there, and leaves it when its release is pinned.

## 11. When it ships

[13](../rework/13-removals-and-plan-changes.md) §4 put the game on plain DOM screens in phase 3 and the canvas Hub in
phase 6. **Phase 3, as built:** the route scheme (§7), the place registry, the redirects, the account bar, the bottom
bar, the menu, the floating pill and every Peek and Page, with each page a DOM grid of place tiles. Shipping the routes
and registry in phase 3, not 6, meant links changed once.

**Phase 6, as built (T145, D363), brought forward:** uma-rpg's Hub, ported, and since T147 (D367) the shared uma-kit's
map. Each page is a pixel-art map on a lazy Phaser 4 canvas (the kit's `HubMap`): uma-art's tiles laid by a seeded terrain with the road down the
middle and a path from every door, props, the buildings stamped once into one texture, drifting clouds, chimney smoke
from frames that carry it, glows, and a camera fade between pages. The DOM draws every word and takes every tap
(the kit's place links, uma-rpg D33): one link per place on the scene's own grid, with its name pill, counter, pips
and Ready badge. A swipe of more than 60 pt changes page; the quick look is uma-rpg's side panel (the kit's
`PeekPanel`); the account bar, bottom bar, pill and menu are the kit's too since T147, with this game's words and
links. The routes, `?peek=` and `?sheet=` are unchanged. The four
new buildings and the Racing page's ground shipped as T145's stand-ins (§10.4) and are uma-art's own since 2.6.0
(D364). The plaza holds a crowd of up to five small Umas (§5, SA7, D371).

### Not built yet (phase 7): the place scenes

The Farm and Training places' own pixel-art scenes, a canvas inside a place
([rearchitecture/03](../rearchitecture/03-rendering-and-textures.md) §5). Until then a place's Page is DOM, as uma-rpg's
interiors are.

## 12. Budgets and accessibility

- **Fit:** each page is one screen, never scrolled or zoomed (uma-rpg D113). The map is 16 px art tiles at 1.5 CSS px
  per art pixel on 2× screens (3 device pixels; 2 CSS px on 1× ones, the device pixel ratio capped at 2), as uma-rpg's
  `hubGrid`, with an odd number of columns centred on the screen so the road runs down its middle (uma-kit's grid). A
  layout test holds every place link and the plaza inside the map, clear of the pill and of one another, at 390×844 and
  393×852 with and without safe areas (`hub/layout.test.ts`).
- **Load:** every page, Peek and sheet is a lazy chunk, and the entry stays ≤ 180 KB gzip (`scripts/check-size.mjs`;
  149.76 KB with uma-kit 0.1.2 and uma-art 2.7.0, 2026-10-16: the `ui`, `tiles` and `buildings` atlas indexes the kit's
  art provider takes, about 2.2 KB, are in it). Phaser and the kit's scene are one lazy chunk (`createHubGame`, 1.40 MB,
  374 KB gzip), loaded when a map first mounts. The atlases are small
  (buildings 29 KB, tiles 11 KB). The service worker precaches files up to 3 MB, so the Phaser chunk and the atlases
  are on the phone after install and the map works offline. Faces load only for visible pips.
- **One engine alive:** the Hub's game lives while a page's map is mounted: a tab or a swipe tells the same game the
  new page. It pauses its scene, keeping the last frame (uma-rpg D39), while the side panel or any global sheet covers
  it or the page is hidden, and is destroyed when a place's Page or a full-screen flow opens, then created again on the
  way back ([rearchitecture/03](../rearchitecture/03-rendering-and-textures.md) §3). The race scene's PixiJS never runs
  beside it.
- **VoiceOver** reads each place's name, lock, counter and pips (§4); the menu lists every place for anyone who can't
  use the map.
- **Reduced motion:** no pip bounce, no clouds, smoke or glows moving, no camera fade and no side panel slide.
- **Light and dark (T147):** every screen is drawn in uma-kit's tokens, which keep their names in both modes, so it
  follows the phone or Account's Appearance ([visual system](../design/visual-system.md#dark-mode)). The map's pixel art
  and the race scene draw the same in both.

## 13. Decided here

| Choice | Why |
|---|---|
| Page ids `town`, `training`, `racing`, `farm`; place ids as in §3 (Farm places use uma-art's ids) | Short routes; ids match the art |
| The Racecourse is `direct` (no Peek) | Racing is the payoff; two taps from anywhere to the race list |
| The floating pill (Collect all, or Check-in) on every page | A check-in works wherever the app opens |
| `/` opens the Farm page when anything needs a tap, else the last page | Most visits are check-ins, and the Farm page's pips are the glance |
| Counters on name pills and menu rows; currencies in the account bar | Clarifies the old plan's "Counter" |
| The Uma Tickets chip always shows, with the Shards toward the next ticket | Umas come from progress (D336); the chip says how close the next one is |
| The Expedition Map is open from day one | [10](../rework/10-expeditions.md)'s rule: it shows each Uma's distance to entry |
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
| A row carries an `at` map position, fractions of the map's width and height, and no grid cell (T145; T137's cells went with the DOM grid) | §1's fractions place buildings on the canvas; one position, as uma-rpg's registry has |
| No lock field: every place is open (T137) | §3 marks every place Open; grade locks live inside places |
| A pip is Ready when she has anything to collect, a running batch's finished items included; the Ready badge, the counter and VoiceOver's "ready" are that one number (T137) | It is `readyCount`'s rule (02 §2), so a tile, the pill and Collect here agree |
| A busy ring shows the current item's progress (new `itemProgress`) (T137) | §4 names the current output's or unlock's progress; `progress` is the whole entry's |
| The start rule counts Umas Ready or Free (`needsATap`) (T137) | 02 §7's count; §2.4's "Waiting" is no status in 01 §2 |
| One 30-second clock, stopped while hidden, for pips and labels (T137) | §4's 30 seconds; 02 §8's labels are cut to the minute anyway |
| The Uma Tickets chip shows Shards as n/5, held at 5/5 in gold once a ticket can be made (T137) | The exchange is the owner's tap in the Stable (04 §6), so Shards can pass 5 |
| "Sync paused" means signed out (T137) | Sync waits for a token; T136's own states are offline and error, and §2.1 names a paused chip |
| Currency marks and tier crests are uma-art's 2.7.0 frames, drawn at whole-number scales (D364; supersedes T137's vector icons) | They sit on the pixel-art town; A02 drew them for the racer |
| Currency icons: a new two-tone coin, today's ticket and Uma coupon icons (T137; superseded by the row above, D364, except the Warehouse's sell sheet, which still draws the coin) | §10.3's marks weren't in the pinned uma-art yet (A02); the visual system wants two-tone currencies |
| A Peek is uma-rpg's side panel: modal, 88% wide from the right, Enter for the Page (T145; supersedes T137's non-modal half sheet and its second tap) | The owner asked for uma-rpg's navigation lifted and shifted (D363) |
| Global sheets are `?sheet=` routes; Collect all's intent rides in navigation state (T137) | Back closes them, and a reload never collects again |
| T137 places the featured Uma (cell, still art, sheet route); her card, sheet and picker are T138's | Animation was phase 6's (§11); T145 shipped phase 6 without it, so it waits for phase 5's `outfit-chibis` (§5). The profile, picker and `feature-uma` are the Stable's |
| Faces are today's `face` art, then the outfit icon, then her initial (T137) | `character-faces` is phase 5's release; today's content stays until then (M034) |
| Full screen is a slot's `fullScreen(rest)`; places take sub-page slots (T137) | §6's flows live inside place routes; the Needs views (T142) live under the Stable (T138) |
| The hub view's counts are every place's default Counter; `useCounter` overrides one; 0 is hidden (T137) | One rule per counter, and only T141's two need data outside the work engine |
| The seeds are a dev-only mount at `/dev/seeds/*` over `@racer/domain/sim`'s synthetic seeds: `main.tsx` loads `dev/main.tsx` behind `import.meta.env.DEV` and serves the live routes under that basename (T137's `g2.html` at `/dev/g2/*` until T143) | Every place link is absolute, so the seeds need a basename; production answers `/dev/seeds` as an unknown path, and `check-size.mjs` refuses a build holding any `src/dev/` module |
| One startup budget, the app's own entry's (T137 measured the new game's entry beside today's until T143) | An overrun found at the switch would have come too late |
| The build-beside boundaries test left with `g2/` (T143) | With one app, the reach check and the PixiJS check hold what remains |
| The shell reads the game through `G2Game`; T136 plugs its store into `boot.ts` (T137) | T137 lands before T136 (M034: "Needs —") |
| uma-art goes in `dependencies`, exactly pinned (2.4.0 at T137, 2.5.0 at T145, 2.7.0 since D364); the domain keeps its dev dependency, pinned the same | The web bundles its images; the domain only tests ids |
| The hidden Account has no frame and no position (T137); the four new drawings carry A01's frame ids before their release (T145) | It is reached from the trainer chip and the menu, never drawn (§3.1); the ids are A01's, so the release switches by itself |
| A port's answer carries its operation's id beside `recheck`'s answer (T137) | The check-in sheet keeps Collect all's id in navigation state, so a reload shows the same receipt (T142) |
| `PENDING` also held the two global sheets, the plaza and the reveal (T137); it is empty since T143 | T143's "every slot filled" covered every slot T138–T142 own, not only the places |
| Global sheets open over any shell route, Peeks only over their page (T137) | The bar's menu button is on every Page too; a Peek belongs to the page its place link is on |
| A page's place links read in map order, top to bottom and left to right, the plaza among them (T137, T145) | VoiceOver and the keyboard meet the places as the eye does |
| The `busy` seed runs BASELINE's policies with the roster at its cap of 25 and opens 40 minutes after day 3's 08:00 check-in, done for three in five Farm Umas (T137) | BASELINE alone holds 20 Umas until Shards grow it, and at 08:00 itself every Uma is Ready: the offset shows Ready, Free, queued and busy rings together |
| The Trophy Hall's counter is flair earned since this device's last visit (`uma-racer:g2:trophy-hall-seen`); opening the Trophy Hall reconciles flair once and marks the visit (T141) | [01](01-game-loop.md) §4.2: device conveniences live in `uma-racer:g2:` keys |
| The Racecourse's counter loads its draw lazily, so the entry holds none; the Scenario Gate's and the Expedition Map's are the hub view's (`ready-to-advance`, `promotable`: 0 before phase 9) (T141) | One rule per counter; §3.3's Map counter is promotable Umas |
| The Scenario Gate's ceremony is a full-screen flow at `/racing/scenario-gate/:umaId/ceremony?op=:id`; the Advance and Promote sheets are `?sheet=advance` and `?sheet=promote` on her career (T141) | §6 lists the promotion ceremony; a sheet is a route, so Back closes it |
| The Trophy Hall's scopes are `?scope=` uma, stable or trainer at `/racing/trophy-hall` (the featured Uma's badges by default), one Uma's at `/uma/:umaId` and the trainer profile at `/trainer` (T141) | §7.1's three routes; a scope is a view of one page |
| The featured Uma is the Stable Peek's first card (`FeaturedUmaCard`) and stands in front of the plaza's crowd (`PlazaFigure`, SA7), with §5's quick sheet for whichever Uma is tapped (T138, T145, D371) | The owner asked for "smaller but multiple Uma chibis" on Town Hall in both apps (uma-kit 0.3.0) |
| The Locked tab's multi-select unlocks up to the tickets in hand, one `unlock-uma` each with its own id, then reveals them in turn with Next (2 of 5) and Skip all; the reveal's route carries the rest as `?then=` and the count as `?of=` (T138) | A new account picks 20 ([13](../rework/13-removals-and-plan-changes.md) §5); 20 single unlocks would take about 80 taps; `?of=` keeps "2 of 5" after a reload |
| A Stable tile reads "T2 · Lv 13" (never the lifetime number) with its tier crest, a Ready dot from `advanceReadiness` or `promotionReadiness`, the planner's crosshair, NEW and a gold frame for an inductee; a Locked tile is desaturated art behind a lock (T138) | 03 §2 keeps the lifetime number for order only; [04](04-tiers-and-promotion.md) §10 |
| Album preferences live in `uma-racer:g2:album:<album>` keys, bounded as today's (20 views, 4,000 seen ids), not the generation-2 database; a device with none sees what it owns as already seen (T138) | Device conveniences only (rearchitecture/01 §4.2); today's live in today's Dexie, which the wipe removes |
| No Hall of Fame place in phase 3; a gold frame and a profile chip show inductees (T138) | The registry has none ([04](04-tiers-and-promotion.md) §10 calls it a Town Hall place); no Uma can be inducted for months |
| The profile links to T141's Advance and Promote sheets (`/racing/scenario-gate/:umaId`) and hosts T142's Needs tab (its sub-page slot) and target toggle (`PROFILE_UI.TargetToggle`); its Needs route shows layer progress until T142 lands (T138) | One owner per sheet; the profile is their door |
| The profile's tabs are Overview, Needs (`/needs`), Skills (`/skills`) and Racing (`?tab=racing`); ‹ › and a swipe move through the Owned tab's current album order (T138) | §7.1 names two sub-routes; Racing needs no route of its own |
| Her latest results read the save's `raceResults` log through the port's `logs`; her title, Prestige frame and showcase pins are the Trophy Hall's, linked from the Racing tab (T138) | Badge state is the Trophy Hall's (T141) and isn't in the rework state |
| The Exchange's header shows T141's purse bar, drawn from its `purseBar` view at the device's day (T138) | The purse bar's words and bands are T141's; the Exchange only shows them (09 §5.5) |
| Deep links: Exchange `?row=speed-tickets` and `?family=&grade=` (the grade opens its quantity sheet); Account `?row=sync`. Counters hide at 0 (T138) | §2.1's chips open "at the row", and the planner's "Buy at the Exchange" needs one; §2.2 keeps the bar quiet |
| Bond opens the Uma picker: Umas who can bond it now first, each with the real time and no item ("No item · 5h 24m", D375); a busy Uma reads "Busy · 2h 10m left" (D366) and shows Queue only when her running session is in that card's Dojo room; the rest follow with their reason. A pick goes to T139's `/training/dojo?session=&room=&unlocks=bond:<cardId>&back=`, `&queue=1` for Queue (T138) | [06](06-cards-and-bonds.md) §6, §10; the session sheet is T139's |
| Times on screen are real (× *k*), e.g. "4 h 48 m" (T138) | [05](05-training-hub.md) §2: the pages' examples are base minutes, the game multiplies by *k* |
| Every Uma picker is `uma-kit/album`'s `UmaPicker` through `ui/racerAlbum.tsx` (SB6): candidates, order, eligibility and descriptions stay racer-owned; Queue and Recall open a follow-up Options sheet | One shared compact five-face album; no local picker or album fork |
| Taps and their words use T140's `ui/work` (`useTap`, `TapNoteLine`) and `ui/ItemIcon`; a 44 pt tab row (`ui/Tabs`) stands in for today's 32 pt SegmentedControl (T138) | One set of pieces (M034); 44 pt targets |
| The dev seeds carry invented skills and card names and run `dev-grant`; Account's dev section loads a seed in place through the port's `fixtures` and `loadFixture` (T138) | A profile's Skills tab needs a library to equip and the Library names to search; M034's rehearsal reaches a gate in one tap |
| The session sheet opens over a facility page from its query (`?session=:umaId&room=:room&unlocks=<kind>:<target>,…&back=<path>`, plus `&queue=1` and a slot row's `&slot=n`); `back` is an in-app path only, `session=` empty opens T138's picker, and only the facility's own unlocks are read (T139) | Every place is a link (§1); the Library's Bond, the planner, a Needs line and the build views reach it without importing it |
| The four facilities share one Page (the facility page and each Uma's build view at `:umaId`) and one Peek; their Counter stays the hub view's `finished-here` (T139) | One reading for four places, as the Farm's ten share one (T140); §3.2's "Umas with a finished session here" is T137's one Ready number |
| The Observatory's and the Gym's build views are full screen, with their own back; the Lineage Hall's and the Dojo's stay in the shell (T139) | §6 names only the tree and the Extra Stats map |
| `ui/TreeGraph` is new, on `training/trees`' `Tree`: the 0–100 canvas on the validator's 351 × 525 pt box scaled to the screen's width, 36 pt nodes at its 40 pt spacing, pinch zoom and a drag once zoomed; a **List** of 44 pt rows carries every node's action and the next layer's nodes, which the tree can't draw (T139) | §12's 44 pt rule over [05](05-training-hub.md) §4's spacing; today's `ConstellationGraph` reads Constellation Level and today's templates |
| The Dojo's card choices mount T138's `CardLibrary` in pick mode: the session sheet's **Add a card** (the room's cards she can bond now), each set slot (her bonded cards) and **Bond more** (cards she can bond now, into the sheet with the card's room) (T139) | [06](06-cards-and-bonds.md) §6: no weaker parallel picker |
| A facility's Peek: its slots as the Farm's rows, with how long is left (D366); how many Umas have unlocks left here (`layerProgress`) with the first three; what it takes in the Warehouse ("Tonics in the Warehouse" with their stand-ins, or the Gym's "Meals": stat meals, Duos and Feasts), or at the Dojo the bonds left this layer (T139, D375) | §3.2's Peek column |
| No Umas yet: free slots, and Needs here and the sheet read "No Umas yet · unlock them in the Stable" with the Stable's link; an id the Stable doesn't hold reads `unknown-uma`'s words (T139) | A locked place shows no placeholder (§1); the empty state says what opens it |
| The Hub is uma-rpg's, copied into `hub/` (`HubCanvas`, `scene/createHubGame`, `HubScene`, `terrain`, `markers`, `grid`, `swipe`, `PlaceTargets`, `OverlayHost`), each file crediting it; a shared uma-platform package comes later (T145, D363). That package is uma-kit since T147 (D367) | The owner's choice (c): lift and shift now, extract once both games run the same Hub |
| Phaser 4.2.1, pinned exactly as uma-rpg's, imported only by the Hub's lazy scene chunk (uma-kit's since T147); Scale NONE at zoom 1/dpr (dpr capped at 2) with a ResizeObserver, audio off; `?canvas` forces the Canvas renderer and `window.__hub` is exposed, in dev builds only (T145) | uma-rpg's engine and settings; the entry stays under budget; preview screenshots can't capture WebGL |
| The tile page for each racer page: `town` → `town`, `training` → `learning`, `farm` → `farmlands`, `racing` → `racing` when the pinned atlas has `racing/ground-0`, else `town`; a test pins it (T145) | §10.2's tiles, and a Racing page that switches to its own ground by itself when A01 ships |
| Racing's props are A01's (rail, furlong post, pennant, flower box); the other pages' are uma-rpg's lists (T145) | §10.2 and the packet name them; uma-rpg's read right on its own tiles |
| The grid has an odd number of columns, centred on the screen by whole device pixels (T145; uma-rpg's starts at the left edge) | The road and the places on it stand in the middle at any width, and the sides mirror |
| A building on the road gets a lane round one side of it, from the road above its roof to its door, laid only where it closes no 2 × 2 of road (T145) | uma-rpg puts one building on its road; Racing and the Farm put two, and every door must still reach the map's edge |
| The Farm's sites ring the page in two columns of four (x 0.2 and 0.79), with the Pantry and Kitchen on the road between them (T145) | uma-rpg's two columns of five don't fit two rows of pips at 390 × 844 with safe areas; the ring still makes neighbours Duo partners |
| A place link is 112 pt wide: its building to the ground line, then its name pill with the counter, then its pips straight on the map with no backing (`b2cb668` dropped T145's light tray, as §4 says); the Ready badge sits on the building; no lock is drawn (T145) | §4's order (pips under the name pill); every place is open (T137) |
| A missing frame is drawn as uma-rpg's code marker in the page's palette, on the map and as SVG in the DOM; `AWAITING_ART` listed the four the test let wait, and is empty since 2.6.0 (T145, D364) | Never an empty or white box (A01's "Why"); one list to empty when 2.6.0 lands |
| A swipe is a drag of more than 60 pt, at least 1.5 times as wide as it is tall, on the map only; it pushes the page like a tab, and a click that ends a swipe is swallowed (T145) | uma-rpg's swipe; a swipe across a place link isn't a tap on it |
| The scene pauses while the side panel or any `?sheet=` covers it, or the page is hidden, and is destroyed when the map unmounts (T145) | uma-rpg D39; one engine alive (§12) |
| The side panel keeps this game's counter and (i) in its header, shows the registry's Peek or the place's blurb over its building, closes by its button, Escape, a tap on the dimmed map, a swipe right or Back, and keeps focus inside (T145) | uma-rpg's `OverlayHost` with §1's (i) rule |
| A Farm Peek acts: Collect and Repeat on a finished row, Collect here, and a free row's "+" and the targets open the job sheet over the map from `?peek=:place&job=…`; the sheet sits inside the panel's tree, so Escape and Back close it first, and a sideways drag on it never closes the panel (T146, D366) | The owner wanted uma-rpg's Farm structure with fewer taps: 2 from the map to collect or restart, 3 to start a job |
| The service worker precaches files up to 3 MB (T145) | uma-rpg's limit: the Phaser chunk and the atlases precache, so the Hub works offline |
| `/dev/seeds` and `/dev/seeds/` are the seeds' root, which runs the start rule as `/` does; one tested check (`isSeedsPath`) decides the mount (T145) | The 404 came from a checkout without the mount; the router test now holds the root |
| The shell, Hub map, primitives, album and place frames are uma-kit's (0.7.1 since SB6), pinned exactly; uma-racer passes its chips, Sync chip, tabs, menu groups, place models, pips' room colours, plaza, ground and words in as props, and forks no kit component (T147, SD4, SB6) | One shell with uma-rpg: a fix like the iPhone band lands once, in the kit |
| The frame is fixed to the screen's edges and the bottom panel lifts by `max(inset − 12 pt, 8 pt)`; the reveal uses the same frame without bars (T147) | The band under the bar on an iPhone 15 (A03's 0.1), fixed for every full-screen route |
| Appearance (System, Light, Dark) in Account, kept on this phone under the game's prefix; System by default (T147) | uma-rpg's dark palette came with the kit; the owner's phone decides unless they choose |
| A Hub page reads only its own places' counter hooks (`usePlaceCounts` with `active`); the menu reads all (T147) | The kit's map and menu take counts as values; the Racecourse's draw and the Trophy Hall's flair read stay off the other pages |

## 14. Done when

- The app opens per §2.4. Every screen is reachable from a place, and every place from the ☰ menu.
- Each "Before" path in §7.2 redirects to its "After" path in phase 3 (a router test walks the table), deleted paths
  land on `/`, and the redirects are gone with the next phase that ships (phase 4 or 5, §7.2).
- The place registry is one table in `@racer/domain/hub`, and the live manual renders the same table.
- At 390×844 every place button is at least 44 pt, swipes and tabs agree, and VoiceOver reads each place's name, lock,
  counter and pips.
- On a synthetic account, every building's pips match the domain's view of its slots: faces, progress, Ready and
  queue counts. The Kitchen at Lv 2 shows eight pips; the Gym at Lv 2 shows seven and "+3".
- A check-in from a cold open is three taps (Collect all, Repeat all, Start suggestions); a race after the first is four.
- Every registry frame exists in the pinned uma-art index (a `frames.test` equivalent), and the four new buildings,
  `racing` tiles, currency marks and tier crests are in its release (2.7.0); the world map and region crests come with
  phase 9.
- The Hub chunk loads in under a second on the owner's iPhone over a warm cache, and the entry chunk stays under
  180 KB gzip.
