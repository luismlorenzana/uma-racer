# UX: the shell, screens and words

> **As built: generation 2 (T137–T143), with the canvas Hub and its side panel (T145) and uma-art 2.7.0's marks and
> crests (D364).** How the game behaves in the
> hand: principles, the shell and its navigation, the screens by place, sheets and lists, feedback and plain words,
> loading and errors, the albums, and accessibility. What each place holds, and why, is the manual's
> [11 · Hub and places](../game/11-hub-and-places.md). This page is the behaviour every place shares.

Uma Racer is played on the owner's iPhone, in portrait, as a Home Screen web app. Every screen is designed at
**390×844 pt** first. Larger screens get more room, not a different app. Budgets and tech limits are in
[Game-like Web Tech](../research/game-web-tech.md).

## Principles

1. **Thumb first.** The bottom bar, the floating pill, a Peek's **Enter**, every sheet and every primary button sit in
   the bottom third. The account bar at the top holds counters and shortcuts, nothing a turn needs.
2. **Visual before textual.** Buildings, faces, pips, crests and meters carry the meaning. Numbers confirm it.
3. **Every tap answers, in place.** A press scales the control at once. The tap then answers beside its button: done, a
   rule in one sentence, or one question with the new numbers ([Feedback and plain words](#feedback-and-plain-words)).
4. **Big moments feel big.** A win's placement stamp, a level-up, a goal ribbon, new flair and a new Uma's reveal each
   get a short fanfare.
5. **One-handed loops.** A check-in is three taps (Collect all, Repeat all, Start suggestions). A race after the first
   is four (11 §9).
6. **Offline is normal.** Game actions never show a spinner: they commit on the phone and sync later
   ([02](../game/02-check-ins-and-notifications.md) §8). Sync stays quiet unless something waits (the Sync chip, D157).
   A save that can't open says why, offers **Try again** and **Copy details**, and never offers to clear anything.
7. **Help sits behind (i).** Every Peek and Page has an (i) button with the place's blurb and its own lines. No banner
   explains a rule (uma-rpg D95).
8. **Every place is a link.** Back and the iPhone's edge swipe work everywhere.

The build rules behind them (CLAUDE.md "Conventions"):
- **Mobile first** at 390×844: 44 pt targets, safe-area padding (`pt-safe`, `pb-safe`, and the bottom bar's
  `mb-bar-safe`), and uma-kit's frame fixed to the screen's edges for the shell and every full-screen flow (T147).
- **Motion** runs under `LazyMotion strict` (uma-kit's `MotionRoot`), so only `m.*` components draw. The DOM animates
  transform and opacity only.
- **Continuous values** (the account bar's numbers, HUD values) change by a CSS transition, never a spring (uma-kit's
  `AnimatedNumber`, `.kit-number` in its theme).
- **Light and dark:** every screen is drawn in uma-kit's tokens, so it follows the phone, or Account's Appearance
  ([visual system](visual-system.md#dark-mode)).
- **Timer labels** derive from saved timestamps and redraw on one 30-second clock that stops while the app is hidden.
  Nothing outside the race animates per frame.

## Visual direction

The skin is **[Visual System "Paddock"](visual-system.md)** (D111): surfaces, colour, type, shape, components, icons,
art treatment, motion and density. Its three rules decide most arguments: the art leads, one gold accent, and
decoration is a motif, not a texture. This page doesn't restate them.

## Navigation

The shell is uma-kit's, shared with uma-rpg (T147), with this game's chips, tabs and sheets passed in
(`hub/RacerShell.tsx`): the account bar on top, the route between, the bottom bar in the thumb zone, and the host for
global sheets, in a frame fixed to the screen's edges. The rules and their reasons are [11](../game/11-hub-and-places.md) §1–§2 and §13.

```text
┌───────────────────────────────────────────────┐
│ (L)   ◎ 12,340  ▭ 46  ◇ 3 · 2/5        Sync   │  account bar
│                                               │
│    pixel map (canvas) + place links (DOM)     │  the page: uma-rpg's Hub, swiped between
│                          [ Collect all · 9 ]  │  floating pill
├───────────────────────────────────────────────┤
│  Town Hall  Training  ( Race )  Farm  ☰ Menu  │  bottom bar
└───────────────────────────────────────────────┘
```

| Part | What it does | Code |
|---|---|---|
| **Account bar** | The trainer's initial (opens Account). **Prize Money** and **Speed Tickets**, each with its uma-art pixel mark (open the Exchange, the second at its Speed Tickets row). **Uma Tickets** with the Shards toward the next one, "3 · 2/5" (opens the Stable's Locked tab). The **Sync chip**, only when not synced: Offline, Sync paused (signed out), or **Sync** in amber (changes have waited over a day) or red (failing); it opens Account's sync row. Every chip is a 44 pt link | uma-kit's `AccountBar`, from `hub/RacerShell.tsx` |
| **Bottom bar** | **Town Hall · Training · ( Race ) · Farm · ☰ Menu**. Race is a raised accent disc and opens the Racing page. Farm and Training carry a badge with the Umas who have something to collect there, hidden at 0; Town Hall and Race carry none. The active page shows by shape (two-tone icon, chamfered underline) as well as colour. The floating panel lifts by the safe area alone | uma-kit's `BottomBar`, from `hub/RacerShell.tsx` |
| **Menu (☰)** | `?sheet=menu`, **Every place**: the four pages' drawn places in two columns, each with its counter and opening its Peek (the Racecourse its Page), then Account and **Needs of every Uma** (the planner's roster view). It reaches everything, whatever the page shows ([11](../game/11-hub-and-places.md) §2.5) | `hub/GlobalSheets.tsx`, uma-kit's `PlaceMenu` |
| **Page map** | Each page is a pixel-art map on a lazy canvas (uma-rpg's Hub, T145) with one DOM link per place on its building: the name pill with its counter, the slot pips and the Ready badge. A sideways swipe of more than 60 pt moves to the next or previous page, with a short fade; the map never scrolls or zooms | uma-kit's `HubMap`, from `hub/HubPage.tsx` |
| **Floating pill** | On every page, right thumb zone, above the bar: **Collect all · N ready**, else **Check-in · N free**, else nothing. It opens the check-in summary ([02](../game/02-check-ins-and-notifications.md) §4) | uma-kit's `FloatingPill`, from `hub/HubPage.tsx` |
| **Global sheets** | `?sheet=menu`, `?sheet=featured` (the featured Uma's quick sheet) and `?sheet=check-in`, over any shell route. A sheet is a route, so Back closes it. Collect all's intent rides in navigation state, so a reload never collects again | `hub/SheetHost.tsx`, `hub/nav.ts` |

### Peek, Page and Back

- **Tap a place once for its quick look, then Enter for its Page.** The quick look (a Peek) is `/:page?peek=:place`
  in uma-rpg's side panel (uma-kit's `PeekPanel`, `hub/PlacePeek.tsx`): it slides in from the right over 88% of the screen, with the map
  dimmed and paused behind it. Its header has the place's name, its counter, (i) and a close button; its body is the
  place's Peek; **Enter {place}** sits in the thumb zone and replaces the panel with the Page, so Back returns to the
  map. A swipe right, a tap on the dimmed map, Escape, the close button or Back closes it. Focus moves to its heading,
  stays inside while it is open, and returns to the place's link. A Peek opens only over its own page. The Racecourse
  is `direct`: its link opens the Page at once.
- **Every Page has one sticky header:** Back, the name and (i). Back returns to where the Page was opened. From a deep
  link it goes up a level instead: a sub-route to its place, a place to its page.
- **History follows the taps** (`useLeave` in `hub/nav.ts`). An entry pushed from inside the app carries `back`, and
  leaving it pops history. A deep link replaces itself with its parent.
- **A Page opened by a link starts at the top; Back returns to where the last one was** (D176, `app/scroll.ts`). The
  place's own scroller is reset on a new path and restored on Back or Forward; a Peek or a sheet (a change of search
  alone) leaves the page where it is.
- **Full-screen flows** hide both bars and return where they came from: the race run and its result
  (`/racing/racecourse/run`), the Scenario Gate's ceremony (`/racing/scenario-gate/:umaId/ceremony`), an Uma's
  constellation tree and Extra Stats map (`/training/observatory/:umaId`, `/training/gym/:umaId`), and the collection
  reveal (`/collection/reveal/uma/:umaId`, outside the shell).
- **Pages swipe.** A mostly sideways drag of more than 60 pt on the map moves along the bottom bar's order, without
  wrapping, as the bar's tabs do; it never moves under the side panel or a sheet, and a swipe that ends on a place's
  link doesn't open it. An Uma's profile moves through the Stable's order with Previous, Next and a swipe.

### Where the app opens

`/` decides once, when the first snapshot is ready (`app/start.ts`, 11 §2.4):
1. **No Umas yet:** the Stable's Locked tab, to pick the first ones with the starting Uma Tickets.
2. **Anything needs a tap** (an Uma Ready or Free): the **Farm page**, where a check-in happens.
3. **Otherwise the last page viewed** on this device (`uma-racer:g2:lastPage`), or Town Hall the first time.

### Routes

| Route | Opens |
|---|---|
| `/` | The start rule |
| `/town`, `/training`, `/racing`, `/farm` | A page. `?peek=:place` adds a Peek, `?sheet=` a global sheet |
| `/:page/:place/*` | A place's Page and its sub-pages: a profile at `/town/stable/outfit/:umaId`, a card at `/town/card-library/card/:cardId`, a build view at `/training/:facility/:umaId`, the run at `/racing/racecourse/run` |
| `/collection/reveal/uma/:umaId` | The reveal, full screen |
| The old app's routes | Redirected to their new places (`app/redirects.ts`, 11 §7.2) until the next phase that ships |
| Anything else | `/`: deleted paths (the retired modes and minigames, `/training/:umaId`, the old `/dev/*` proofs) and unknown ones |

The full table is 11 §7.1, and every screen as one tree from page to place to sub-page and sheet is
[11's menu tree](../game/11-hub-and-places.md#the-menu-tree-at-a-glance). **Dev builds only:** the synthetic seeds
mount at `/dev/seeds/*` (`apps/web/src/dev/`), and proofs live under `/dev/` beside the places they prove
(`/dev/check-in`). A production build holds neither.

## Screens

Every place has a Page, every drawn place but the Racecourse a Peek, and most a counter. What each one shows, its
sub-routes and its decisions are 11 §3 and the manual page that owns its rules.

| Page | Places | Rules |
|---|---|---|
| **Town Hall** (`/town`) | **Stable:** the roster album (Owned and Locked), each Uma's profile (Overview, Needs, Skills, Racing), Unlock and the reveal. **Warehouse:** every item by shelf, and the stock sheet with Make more and Sell. **Exchange:** Speed Tickets and raw ingredients. **Card Library:** every SSR, and each card's page with Bond. **Account** (hidden; reached from the trainer chip and the menu): check-in times, sync, this phone's reduced motion and race speed, App build and Content, Sign in or Sign out, and a dev section in dev builds. **The plaza:** the featured Uma and her quick sheet | 11 §3.1, §5; [03](../game/03-uma-progression.md), [04](../game/04-tiers-and-promotion.md) §6, [06](../game/06-cards-and-bonds.md) §6, [09](../game/09-racing-rewards-and-exchange.md) §5–§6 |
| **Training** (`/training`) | **Observatory, Lineage Hall, Gym, Dojo:** a facility page each (level, slots by room, Needs here, Collect here, the session sheet), and each Uma's build view at `/:umaId` | 11 §3.2; [05](../game/05-training-hub.md) §8 |
| **Racing** (`/racing`) | **Racecourse** (`direct`): race select, the pre-race sheet, the run and its result. **Scenario Gate:** every Uma's career, the Advance sheet and its ceremony. **Expedition Map:** each Uma's distance to entry until phase 9. **Trophy Hall:** badges by scope, titles, showcases, trophies, records and the trainer profile | 11 §3.3; [09](../game/09-racing-rewards-and-exchange.md), [03](../game/03-uma-progression.md) §4–§5, [10](../rework/10-expeditions.md), [Badges](badges.md) |
| **Farm** (`/farm`) | **The eight family sites, the Pantry and the Kitchen:** a building page each, with its slots, its jobs and the job sheet | 11 §3.4; [07](../game/07-farm.md) §10 |
| **Every page** | The menu, the featured Uma's quick sheet and the check-in summary. The planner's views live under the Stable (`/town/stable/needs`, each profile's `/needs`) | 11 §2; [02](../game/02-check-ins-and-notifications.md) §4–§6 |

Places with slots share one set of work pieces (`ui/work/`): compact slot rows (D366), size chips, queue chips,
Recall, Speed up and Upgrade, all answering through the same tap (below). They read how long work takes or has left,
never the clock time it ends.

### Race select and the pre-race sheet

Race select is the Racecourse's Page (`places/racing/RaceSelect.tsx`): the purse bar and featured races, the Uma strip,
**Today's featured**, **Next up** and every race ([09](../game/09-racing-rewards-and-exchange.md) §3–§4). A race card
opens the **pre-race sheet**, ordered so starting never means scrolling past the detail (D233):
1. **The race:** grade, name, its line, and its prize at today's band.
2. **What's at stake:** every goal the race can complete, with its win rule.
3. **Her:** face, name, "T1 · Lv 7", the distance preset it runs on with its Race Bonus, and "Collects 2 finished
   unlocks first" when her session has some.
4. **Running style:** four icons with her aptitude letters, starting at her race defaults. The choice isn't saved.
5. **Start race**, then her aptitudes for this surface, distance and style.
6. **Her stats for this race:** each stat reads **Good**, **Average** or **Bad** (`places/racing/race-fit.ts`).
   - **Stamina** is read against what a full spurt needs at this distance and style (the HP model rivals are built
     on): Good from 105% of the need, Average from 95%. The row says "needs 1,234".
   - **Speed, Power, Guts and Wit** are ranked against the field she will meet, from the prepared race: Good when she
     beats two-thirds of it, Average a third. The row says "beats 9/17". Stats above 1,200 count half, as in the race.
   - Nothing is authored per race, and changing the style reads it again.
7. **Race skills** with their SP (her unique is free), then the **Field**: faces in gate order.

If the race can't be prepared, the stats and the field are left out. **Start race** commits the race before it plays
([09](../game/09-racing-rewards-and-exchange.md) §8), so a reload or a reopen lands on the same race.

### The race

The run is full screen (`places/racing/run/RunPage.tsx`) and always plays a committed result. The PixiJS scene draws
the course with a numbered, colour-ringed token per runner. The HUD names the phase and the metres left (and the turn,
in a turn race), and a feed of small toasts on the right calls out skills and moves. In the thumb zone: her HP meter,
Pause, step back and on while paused, and 1× or 2× (plus Slow in a turn race). **Skip** sits top right. The last spurt
adds a slight zoom. The screen stays awake while it plays.

A run starts at this phone's default race speed from Account (`uma-racer:g2:raceSpeed`, 1× or 2×), or at the nearest
speed the race offers if that one isn't. Dev builds expose `window.__raceScene` (`seek`, `skipToEnd`).

### Results

The result slides up over the run, in [09](../game/09-racing-rewards-and-exchange.md) §7's order:
1. The placement **stamps** in ("1st!", with confetti on a win).
2. The finishing order, with margins.
3. **Racing EXP**, with a chip for each level gained and a line for a hold or a new Uma Shard.
4. **Prize Money** with its lines. The amount flies into the Prize Money chip, shown alone at the top.
5. **Goal ribbons** with their pips, and Scenario Honors when the career is complete.
6. **Flair earned**, then Trainer achievements.
7. **Races**, **Race again** and **Next Uma**. **Advance** joins them when she's ready, opening the Scenario Gate's
   Advance sheet.

The fanfare plays only the first time this device shows the result. A reload shows the stored result, its flair
headed "Earned in this race", without replaying it.

## Sheets and lists

| Surface | Behaviour | Code |
|---|---|---|
| **Bottom sheet** | Modal, over a scrim that closes it. A drag starts from the grab handle only, so taps inside are never swallowed; a drag past 90 px or a flick closes it. A close button sits by the handle. It never grows past 92% of the screen: the content scrolls under the fixed handle. Escape closes it, before anything under it | uma-kit's `BottomSheet` |
| **Sheet over a sheet** | uma-kit's `Sheet` and the Uma picker render through a portal, so a question or the picker opens over another sheet | uma-kit's `Sheet`, `ui/UmaPicker.tsx` |
| **Peek** | uma-rpg's side panel: modal, 88% wide from the right, the map dimmed and paused behind it ([Peek, Page and Back](#peek-page-and-back)) | uma-kit's `PeekPanel`, `hub/PlacePeek.tsx` |
| **Global sheets** | Focus moves to the sheet's heading and returns to what opened it. Escape, the close button, the handle and Back close it | `hub/GlobalSheets.tsx` |
| **Tab rows** | Two to four tabs at 44 pt on a sunken track, the chosen one raised, moving by a CSS transition: the Stable's Owned and Locked, an Uma's profile, the Warehouse's shelves, the build views | uma-kit's `Tabs` |
| **Lists and grids** | Rows of at least 44 pt. Long lists stay cheap through `content-visibility`: off-screen rows skip layout and paint, and the scroll position restores because nothing unmounts | `ui/album/VirtualGrid.tsx` |

**Confirm only what costs or sells, and say the amount.** The check-in summary's Buy and restart and Speed up all
([02](../game/02-check-ins-and-notifications.md) §11), a sale that includes a dish, dips into needed stock or is worth
1,000 or more, and an Exchange buy of 1,000 or more ([09](../game/09-racing-rewards-and-exchange.md) §6.1) each ask
once. Everything else is one tap. Nothing has an undo.

## Feedback and plain words

### A tap's answer

Every tap is one operation, with its id chosen before it's written ([02](../game/02-check-ins-and-notifications.md) §9).
While it runs, its button is disabled, so a double tap does nothing. Its answer shows beside the button
(`ui/work/useTap.ts`, `TapNoteLine`):

| Answer | On screen |
|---|---|
| **Done** | The screen moves on. No toast |
| **A rule** (`say`) | One plain sentence: "Kitasan Black is busy for another 2h 10m." · "Needs Farm Lv 16." |
| **A question** (`ask`) | One sentence with the new numbers, then **Yes** or **Not now**: "Only 3 left now. Start ×3?" |
| **Unexpected** | "That didn't work. Try again." The outbox also retries by itself |

The words are the rule's own refusal, run through the same `recheck` on the phone and the server, so the two agree.
**A stale screen never fails.** The tap is checked against the latest state, and it runs, shows the earlier result
("Already collected."), or asks again with the new numbers. It never tells the owner to reload, review or retry by hand
(D320).

### Plain words

The full table of situations is [02](../game/02-check-ins-and-notifications.md) §9. The rules:
- **Say what happened, in the owner's words.** Offline: "Saved on this phone. It'll sync when you're back online." Done
  on the other device: "Already collected." Anything unexpected: "That didn't work. Try again."
- **Banned in player-facing text:** operation, receipt, revision, generation, version, stale, conflict, payload, id,
  sync error codes and HTTP numbers. `hasBannedWord` (`packages/domain/src/check-in/words.ts`) holds the shell's, the
  places' and the work pieces' word tables to it in tests.
- **Names, not ids.** Templates take `{uma}`, `{item}`, `{place}` and `{time}`, and the screen fills in names and clock
  times (`ui/work/words.ts`). Account says **App build** and **Content**.
- **Times on screen are real** ("4 h 48 m"), and clock times are cut to the minute.

### Notices and sync

- **The only sync signal is the Sync chip** in the account bar ([Navigation](#navigation)). Account's sync row says the
  state in a sentence, with **Sync now**.
- **A tap the server refused** after the phone accepted it rolls back and becomes a **notice** in plain words, kept
  until dismissed. Notices show in the check-in summary's footer with **OK**, beside the offline line, which links to
  Account's sync row ([02](../game/02-check-ins-and-notifications.md) §11).
- **A new build** shows one banner at the top: **Update ready** with **Restart**. It waits for the current action to
  finish and save first, and never reloads across a gameplay commit (`app/UpdateNotice.tsx`,
  `app/update-lifecycle.ts`).

### Moments

| Moment | What moves | With reduced motion |
|---|---|---|
| A press | The control scales down a touch (buttons 0.98, bar tabs 0.94) | No movement |
| A number changes | It slides in by a CSS transition | It swaps at once |
| A slot is Ready | Its pip's ring fills gold and bounces gently every 2.4 s | No bounce |
| A Peek opens | The side panel slides in 24 px from the right and fades in, the map dims, 220 ms | It fades in, without the slide |
| A page changes | The map fades through black, 90 ms out and 130 ms in; clouds drift and chimneys smoke | No fade; nothing drifts |
| A sheet opens | It slides up from the bottom | It appears |
| A race result | The placement stamps in, confetti on a win, the finishing order slides in | Shown at once |
| Level-up, goal, flair | A level chip pops, each goal ribbon unfurls in turn, flair cards rise in sequence | Shown at once |
| Prize Money | The amount flies into the chip | The number swaps |
| A new Uma | The reveal card flips in over a gold glow | No flip |

There is no sound and no haptics: every moment stands on its own visually.

## Loading and errors

| State | What shows | Code |
|---|---|---|
| **Content loading, or the save booting** | The shell's quiet frame: both bars, blank pills where the numbers go, nothing between. Screens arrive as lazy chunks with no spinner | `hub/RacerShell.tsx`, `app/GameProvider.tsx` |
| **Signed out, or content that can't load** (before the save opens) | One full-screen panel: a title, a sentence and one way on: **Sign in**, **Sign in again**, **Switch account** (an account not on the allowlist), **Try again**, **Download again** or **Check again**. The save on the phone is never touched | `app/session.tsx`, `content/diagnostics.ts` |
| **The save can't open** | One panel: **Save needs attention**, the reason, "Your progress is kept as it is. Nothing is cleared.", then **Try again** (reloads) and **Copy details** (the app build, the time and the reason, for a report) | `app/Root.tsx` |
| **Signed out after the save opened** | Play goes on. The Sync chip says **Sync paused** until the owner signs in | `app/session.tsx` |
| **A link to something that isn't there** | An unknown path, or a place not on its page, goes to `/`. A card or Uma the save doesn't hold says so, with a way on: "That card isn't in the Library." and **Open the Library** | `app/routes.tsx` |
| **A new build** | **Update ready** with **Restart** ([Notices and sync](#notices-and-sync)) | `app/UpdateNotice.tsx` |

## Albums

Two albums share one chrome and one query engine: the **Stable**'s roster (`places/stable/`) and the **Card Library**
(`places/card-library/`, [06](../game/06-cards-and-bonds.md) §6). The **Uma picker** (`ui/UmaPicker.tsx`, D181) is the
Stable's album in a sheet, and the one way to choose an Uma anywhere. The engine is pure (`ui/album/query.ts`); the
chrome is `ui/album/AlbumChrome.tsx`, with `FilterTray.tsx` and `SortSheet.tsx`. The patterns follow the faceted-tray
research in [Game UI Reference](../research/game-ui-reference.md).

### Shared browsing chrome

```text
┌──────────────────────────────────────────┐
│ Roster                [icons|cards|list] │  title and the view switch
│ 23 owned · 244 locked · 23 shown         │  count line (the Stable adds its ticket note)
│ [ Search        ]   ↓ Level   Filters·2  │  sticky toolbar
│ [ Owned · 23 | Locked · 244 ]   Select   │    the album's own segment
│ Tier 1 ×   Distance ×   Clear all        │  active filters, only when there are some
│ ▓▓▓▓▓▓    ▓▓▓▓▓▓    ▓▓▓▓▓▓               │  the grid
└──────────────────────────────────────────┘
```

- **One title line** with the count, "N shown" and the album's own note: the Stable's Uma Tickets, with an **Exchange**
  button when five Shards make a ticket. The view switch sits at its right.
- **One sticky toolbar** stays pinned while the grid scrolls: search, a **Sort** button showing the key and its
  direction, and **Filters**, which turns gold and shows the number of active filters in place of its label. Under it
  sits the album's own segment: the Stable's Owned and Locked tabs and **Select**; the Library's lens chips and Uma
  control.
- **Sort and Filter are separate sheets.** Sort lists the keys, and tapping the chosen key again flips its direction.
  A sort can take a parameter, shown as chips under the list; no album uses one yet.
- **Every active filter is a chip** under the toolbar, removed with one tap, with **Clear all** at the end.
- **The Filters tray** groups facets into collapsible sections, and a section with an active filter opens itself. Each
  option shows the count it would return. An option that would return nothing is disabled, never a dead end. The draft
  applies on **Show N**, which counts it as it changes; **Clear all** resets the draft.
- **Quick picks and saved views sit at the top of the tray**, not in rows of their own, so the list starts near the
  top (D176). A quick pick sets filters in one tap and never overwrites a saved view.
- **Saved views:** up to 20 per album, named in up to 40 characters, each the whole query (search, filters, sort,
  direction, view and the Library's lens). Saving under a name already used replaces that view.
- **Preferences are per device**, in `uma-racer:g2:album:<album>` (`ui/albumPrefs.ts`): the query, the saved views and
  the seen set behind NEW (up to 4,000 ids). The albums are `stable`, `card-library`, and `card-library-pick` for the
  Library in pick mode. They are never synced, and a stored value the album no longer knows falls back to its default.
  The Uma picker keeps nothing: it opens on its caller's order each time.
- **An empty result names the way out:** "Nothing matches these filters", "Remove **Tier** to see 12", and
  **Clear all**.
- **Search** matches an Uma's name and outfit, or a card's character, title and skill names.

### Default sorts

| Album | Opens on | Ties | Other sorts |
|---|---|---|---|
| **Stable**, and the Uma picker | **Level**, highest first: the lifetime level, from her tier and Racing Level ([03](../game/03-uma-progression.md) §2) | Release, newest first; then name | Release · Name · Tier · Racing Level · Farm Level |
| **Card Library** | **Era**, newest first | Release, newest first; then name | Type · Character · Card name · Per-node pay (in a lens) · Race Bonus · Umas bonded |

- **A missing value sorts last** in either direction, so flipping never surfaces a hole. Locked Umas have no level,
  so the Locked tab falls through to release and name. The id breaks the last tie, so one query always gives one order.
- **Every list of Umas leads with the highest level (D181)**, unless the place has an order of its own: the Racecourse
  strip puts open goals first and finished careers last, the Scenario Gate puts Umas ready to advance first, and a
  picker can open on its caller's sort. Umas a picker can't take follow the ones it can, each with her reason (Bond's
  picker leads with the Umas who can bond the card now).

### View modes

The view switch picks one of three modes, remembered per album with the rest of the query. Each opens on **Icons**.

| Mode | Stable and the Uma picker | Card Library |
|---|---|---|
| **Icons** | Three to a row: her art, with her name and "T2 · Lv 13" under it | Three to a row: the card's art with its four corners, the character and the card's title |
| **Cards** | Two to a row, larger art | Two to a row, larger art; in a lens, the per-node pay under it |
| **List** | Full-width rows: a small tile, her name and scenario, her level and her marks | Full-width rows: a small tile, the name, and the per-node pay (or the era, in All) |

The picker's tiles carry a line under the name: why she can't be picked, what picking her would do, or the caller's
sort value.

### Art tiers

| Tier | Size | Source | Where it shows |
|---|---|---|---|
| **Icon** | 128 px, atlased (`uma-icons`, `card-icons`) | The content packs | Every card tile; every Uma tile until her bust arrives; the fallback for faces and the plaza |
| **Uma bust** (`bust`) | 256 px square, head and shoulders | Cut from her portrait at import, one file per Uma | The Stable album, the Uma picker, her profile's header, and the plaza when she has no chibi |
| **Uma portrait** (`uma`) | 512 px, transparent | One file per Uma, fetched on demand | The collection reveal |
| **Card art** (`card`) | The full illustration, 600 px on its longest edge (450×600) | One file per card, fetched on demand | The card page's hero and the art viewer |
| **Race face** (`face`) | 128 px square, transparent | One per character, cut from her summer-uniform stand at import (T059, D160) | Pips, slot rows, the Racecourse strip, the pre-race field, the race feed, the finishing order. The race scene can put them on its tokens, but the run doesn't pass them yet |
| **Chibi** (`chibi`) | 256 px, transparent: standing (`-a`) and celebrating (`-b`) | One pair per outfit, from the owner's local copy (T059) | Standing: the featured Uma in the plaza, still art (the canvas Hub didn't animate her; the code-animated chibi waits for phase 5's `outfit-chibis` release, 11 §5). Celebrating: not placed |
| **Outfit stand** (`dress`) | 512 px, transparent: gym clothes, summer and winter uniforms, casual clothes | Four per character, from the owner's local copy (T059) | Not placed |

- **Lists never use the large art; detail surfaces do.** The card page opens on its illustration full width, cropped
  4:5 from the top, with the name over its foot. A tap on it opens the **art viewer** (`ui/ArtViewer.tsx`): the whole
  image on a dark stage over everything, closed by a tap, its close button or Escape. The reveal shows her portrait.
- **The icon shows first** and the larger art replaces it when it arrives, so nothing waits on a download. A missing or
  failed file keeps the icon, with no error and no empty frame. Without content (the dev seeds), a tile shows a
  labelled placeholder and Uma art shows her initial.
- **Large art is never atlased and never precached.** Each file is content-addressed, fetched through the authenticated
  API the first time it's shown, checked against its manifest's size and hash, and cached by the service worker
  (`uma-racer-g2-content`, cache first). `useArt` (`ui/album/useArt.ts`) holds an entry while it's on screen, and each
  kind keeps a bounded window of recent ones.
- **The bust** is the original's Trainee Select tile. The importer finds her head from the portrait's own alpha,
  centres on it and takes a square of 60% of the frame from near the top (`scripts/assets/src/art.ts`).
  `content/overrides/bust-crops.json` pins any Uma the automatic crop misreads, and `pnpm assets:bust-sheet` renders
  every bust for review.
- **Faces, chibis and stands** come from the owner's own folder (`pnpm assets:import -- --source dir:<path>`), never
  fetched. A chibi is matched to its outfit through GameTora's `costume` field (card id to dress id), never by name.
  Faces and stands belong to the character, so every outfit of an Uma shares them.

### Icon overlays

Each tile keeps its marks inside its padding, so nothing covers a face (`ui/ArtTile.tsx`'s four corners).

| Corner | Stable, Owned | Stable, Locked | Card Library |
|---|---|---|---|
| **Top left** | Her tier crest (uma-art's bronze, silver or gold, read "Tier 1"), then NEW | A lock | Distance focus, then NEW, then **In set** (pick mode: the preset being filled) |
| **Top right** | A Ready dot (ready to advance or promote) and the planner's crosshair | The check, while selecting | Running-style focus |
| **Bottom left** | — | — | Card type |
| **Bottom right** | — | — | The bond pill |

- **A locked Uma** is her art dimmed and desaturated behind a lock, never an empty box. A Hall of Fame Uma gets a gold
  frame. In the list view her marks move to the end of the row.
- **The Uma picker** puts her "T2 · Lv 13" bottom right, and a check with its label top left once she's selected.
- **The bond pill** ([06](../game/06-cards-and-bonds.md) §6): with no Uma chosen, how many Umas are bonded to the card
  in their current tier (hidden at 0). With an Uma chosen: a check if she's bonded, a stopwatch while the bond is in
  her work, "G5" on the card type's colour for the dish grade she needs, or a lock, with the art dimmed, when the
  card's era is past her scenario.

### Shared behaviours

- **Filters and quick picks per album:**

  | Album | Filters | Quick picks |
  |---|---|---|
  | **Stable** and the picker | Tier · Ready to advance or promote · Planner target · New; Distance, Surface and Style A or better | Tier 1 · Tier 2 · Tier 3 · Ready to advance or promote · Planner targets (none in the picker) |
  | **Card Library** | Bondable now · Her bond (bonded or not) · Bonded to any Uma · In a set; Type · Running style · Distance · Era · Has Race Bonus · New | Bondable now and Bonded to her (with an Uma chosen) · Has Race Bonus |

- **The Library's lens and Uma.** Lens chips pick **All** or one playable scenario (1–14 until the 15th ships). The Uma
  control opens the picker ("See the Library as"). With an Uma chosen the lens follows her scenario; **No Uma** or a
  lens chip clears her, and her two bond filters rest until one is chosen again. The Library opens on the featured Uma.
  In pick mode the lens stays on the Uma it was given, and only the caller's eligible cards show.
- **NEW** marks an entry this device hasn't seen. A device with nothing stored counts everything it already has as
  seen, so only later arrivals read NEW: an Uma unlocked since, or a card a content update added. Opening her profile
  clears an Uma's NEW.
- **Select (the Stable's Locked tab)** picks up to the Uma Tickets in hand, then **Unlock N · N Uma Tickets** unlocks
  each with its own operation, and the reveal shows them in turn: Next, "2 of 5", Skip all (11 §13).
- **A filtered album is a browsing session.** An owned tile opens her profile, where Previous, Next and a swipe move
  through the Owned tab's current order.
- **One tile, one target, one line.** A tile is one link or button, and VoiceOver reads it as one line: her name, "T2 ·
  Lv 13", ready to advance or promote, planner target, Hall of Fame, new; or a card's name, type, era and pill.
- **Not in the albums:** compare, long-press actions, grouping, and a density toggle (the view switch replaced it).

## Accessibility and comfort

- **Targets:** every tap target is at least **44×44 pt**. A place's link is 112 pt wide and covers its building down to
  the ground line, its name pill and its pips (at least 90 pt tall). Pips (20 pt) are display only.
- **Thumb zone:** primary actions sit low ([Principles](#principles)). Nothing in the top corners is needed to play.
- **State never rests on colour alone.** The active tab is two-tone with an underline; a tier crest sits beside "T1 · Lv 7"
  in words and reads "Tier 1" to VoiceOver; Ready is
  a dot and a word in the label; the Sync chip says Offline, Sync paused or Sync; stats say Good, Average or Bad.
- **VoiceOver** reads each place's link as one line ("Kitchen. 6 of 8 slots busy, 2 ready, 1 queued.") and each chip
  with its count and where it goes ("Prize Money 12,340. Open the Exchange."). Links read in map order, top to bottom
  and left to right; the canvas is hidden from it. The menu lists every place for anyone who can't use the map.
- **Focus:** a Peek or a global sheet moves focus to its heading and gives it back to what opened it; the side panel
  keeps Tab inside it. Escape closes the top sheet first, then a Peek, and the art viewer.
- **Reduced motion** is on when the system asks for it or when Account's switch is on for this phone
  (`uma-racer:g2:reducedMotion`, never synced; uma-kit's `MotionRoot` under uma-racer's key prefix, `app/kit.ts`). It reaches Motion through `MotionConfig` and CSS
  through a `data-reduced-motion` attribute: no pip bounce, no number slide, no sheet slide, no reveal flip, no
  fanfare movement and no last-spurt zoom. Every state change still shows, and no commit waits on an animation.
- **Numbers** use tabular figures, so counters don't jitter, and large amounts are grouped ("12,340").
- **No sound or haptics.** Everything is shown on screen.
- **Portrait only:** the installed app is locked to portrait, the race included. The run keeps the screen awake.
