# UX: the shell, screens and words

> **As built: generation 3 (M036; T157, T158, D386, D387, D388), on uma-kit's shell and canvas Hub.** How the game
> behaves in the hand: principles, the shell and its navigation, the screens by place, sheets and lists, feedback and
> plain words, loading and errors, the albums, and accessibility. What each place holds, and why, is the manual's
> [11 · Hub and places](../game/11-hub-and-places.md). This page is the behaviour every place shares.

Uma Racer is played on the owner's iPhone, in portrait, as a Home Screen web app. Every screen is designed at
**390×844 pt** first. Larger screens get more room, not a different app. Budgets and tech limits are in
[Game-like Web Tech](../research/game-web-tech.md).

## Principles

1. **Thumb first.** The bottom bar, a Peek's **Enter**, every sheet and every primary button sit in the bottom third,
   and a game's input sits in the bottom 60% of the screen. The account bar at the top holds the tickets and
   shortcuts, nothing a season needs.
2. **Visual before textual.** Buildings, faces, busts, card art, stat icons and meters carry the meaning. Numbers
   confirm it.
3. **Every tap answers, in place.** A press scales the control at once. The tap then answers beside its button: done,
   or a rule in one sentence ([Feedback and plain words](#feedback-and-plain-words)).
4. **Big moments feel big.** A new Uma's reveal, a stage's grade, a win's place and the URA Finals' completion each get
   a short moment.
5. **One-handed loops.** A season is Play, Upgrade, Race and Next season from her career page, a handful of taps
   ([11](../game/11-hub-and-places.md) §9). The raised Career button is one tap back to her current season.
6. **Offline is normal.** Game actions never show a spinner: they commit on the phone and sync later
   ([architecture](../game/architecture.md#the-save-and-sync)). Sync stays quiet unless something waits (the Sync
   chip, D157). A save that can't open says why, offers **Try again** and **Copy details**, and never offers to clear
   anything.
7. **Help sits behind (i).** Every Peek and Page has an (i) button with the place's blurb and its own lines; each game
   opens on a rule card of one verb and one sentence. No banner explains a rule (uma-rpg D95).
8. **Every place is a link.** Back and the iPhone's edge swipe work everywhere.

The build rules behind them (CLAUDE.md "Conventions"):
- **Mobile first** at 390×844: 44 pt targets, safe-area padding (`pt-safe`, `pb-safe`, and the docked bottom bar's
  `pb-bar-safe`), and uma-kit's frame filling the screen for the shell and every full-screen flow (T147, D369).
- **Motion** runs under `LazyMotion strict` (uma-kit's `MotionRoot`), so only `m.*` components draw. The DOM animates
  transform and opacity only.
- **Continuous values** (the account bar's numbers, HUD values) change by a CSS transition, never a spring (uma-kit's
  `AnimatedNumber`, `.kit-number` in its theme).
- **Light and dark:** every screen is drawn in uma-kit's tokens, so it follows the phone, or Account's Appearance
  ([visual system](visual-system.md#dark-mode)).
- **No clock on screen** (D380): no screen shows a duration, a countdown or a time to wait. Only the race, a game's
  moves and the Hub's map animate per frame.

## Visual direction

The skin is **[Visual System "Paddock"](visual-system.md)** (D111): surfaces, colour, type, shape, components, icons,
art treatment, motion and density. Its three rules decide most arguments: the art leads, one gold accent, and
decoration is a motif, not a texture. This page doesn't restate them.

## Navigation

The shell is uma-kit's, shared with uma-rpg (T147), with this game's chips, tabs and sheets passed in
(`hub/RacerShell.tsx`): the account bar on top, the route between, the bottom bar in the thumb zone, and the host for
the menu, in a frame fixed to the screen's edges. The rules and their reasons are [11](../game/11-hub-and-places.md)
§1–§2 and §13.

```text
┌───────────────────────────────────────────────┐
│ (T)            ▭ 20    ▣ 24            Sync   │  account bar
│                                               │
│    pixel map (canvas) + place links (DOM)     │  the page: uma-rpg's Hub, swiped between
│                                               │
├───────────────────────────────────────────────┤
│  Town Hall   Career   ( Career )   ☰ Menu     │  bottom bar
└───────────────────────────────────────────────┘
```

| Part | What it does | Code |
|---|---|---|
| **Account bar** | The trainer's initial (opens Account). **Uma Tickets** and **Card Tickets**, each with its mark, opening the Locked tab of the place that spends it. The **Sync chip**, only when not synced: Offline, Sync paused (signed out), or **Sync** in amber (changes have waited over a day) or red (failing); it opens Account's sync row. Every chip is a 44 pt link | uma-kit's `AccountBar`, from `hub/RacerShell.tsx` |
| **Bottom bar** | **Town Hall · Career · ( Career ) · ☰ Menu**. The raised Career is an accent disc that opens her current season (the career in progress started last, else every career). No tab carries a badge. The active page shows by shape (two-tone icon, a gold marker) as well as colour | uma-kit's `BottomBar`, from `hub/RacerShell.tsx` |
| **Menu (☰)** | `?sheet=menu`, **Every place**: each page's drawn places with their counters, each opening its Peek, then Account. It reaches everything, whatever the page shows ([11](../game/11-hub-and-places.md) §2.5) | `hub/GlobalSheets.tsx`, uma-kit's `PlaceMenu` |
| **Page map** | Each page is a pixel-art map on a lazy canvas (uma-rpg's Hub, T145) with one DOM link per place on its building: the name pill with its counter. A sideways swipe of more than 60 pt moves to the next or previous page, with a short fade; the map never scrolls or zooms | uma-kit's `HubMap`, from `hub/HubPage.tsx` |
| **The menu sheet** | Over any shell route; a sheet is a route, so Back closes it | `hub/SheetHost.tsx`, `hub/nav.ts` |

### Peek, Page and Back

- **Tap a place once for its quick look, then Enter for its Page.** The quick look (a Peek) is `/:page?peek=:place`
  in uma-rpg's side panel (uma-kit's `PeekPanel`, `hub/PlacePeek.tsx`): it slides in from the right over 88% of the
  screen, with the map dimmed and paused behind it. Its header has the place's name, its counter, (i) and a close
  button; its body is the place's Peek; **Enter {place}** sits in the thumb zone and replaces the panel with the Page,
  so Back returns to the map. A swipe right, a tap on the dimmed map, Escape, the close button or Back closes it. Focus
  moves to its heading, stays inside while it is open, and returns to the place's link. A Peek opens only over its own
  page. No place is `direct`.
- **Every Page has one sticky header:** Back, the name and (i). Back returns to where the Page was opened. From a deep
  link it goes up a level instead: a sub-route to its place, a place to its page.
- **History follows the taps** (uma-kit's `useLeave`). An entry pushed from inside the app carries `back`, and leaving
  it pops history. A deep link replaces itself with its parent.
- **A Page opened by a link starts at the top; Back returns to where the last one was** (D176, `app/scroll.ts`). The
  place's own scroller is reset on a new path and restored on Back or Forward; a Peek or a sheet (a change of search
  alone) leaves the page where it is.
- **Full-screen flows** hide both bars and return where they came from: a career's play and race run
  (`/career/careers/:careerId/play/:kind`, `…/race/:id`) and the two games' practice
  (`/career/training-yard`, `/career/furlong-hand`).
- **Pages swipe.** A mostly sideways drag of more than 60 pt on the map moves along the bottom bar's order, without
  wrapping, as the bar's tabs do; it never moves under the side panel or a sheet, and a swipe that ends on a place's
  link doesn't open it.

### Where the app opens

`/` decides once, when the first snapshot is ready (`app/start.ts`, 11 §2.4):
1. **Her career page,** when a career's screen was the last thing viewed on this device and that career still runs
   (`uma-racer:g3:lastCareer`). A play left mid-way resumes from there.
2. **Otherwise the last page viewed** on this device (`uma-racer:g3:lastPage`), or Town Hall the first time.

### Routes

| Route | Opens |
|---|---|
| `/` | The start rule |
| `/town`, `/career` | A page. `?peek=:place` adds a Peek, `?sheet=menu` the menu |
| `/:page/:place/*` | A place's Page and its sub-pages: a profile at `/town/stable/outfit/:umaId`, a card at `/town/card-library/card/:cardId`, a career at `/career/careers/:careerId` with its `upgrade`, `play/:kind` and `race/:id` |
| Anything else | `/`: the old game's paths and unknown ones (11 §7.2) |

The full table is 11 §7.1, and every screen as one tree from page to place to sub-page and sheet is
[11's menu tree](../game/11-hub-and-places.md#the-menu-tree-at-a-glance). There are no dev seeds or dev routes (D381).

## Screens

Every place has a Page, most a Peek and a counter. What each one shows, its sub-routes and its decisions are 11 §3 and
§8 and the manual page that owns its rules.

| Page | Places | Rules |
|---|---|---|
| **Town Hall** (`/town`) | **Stable:** the roster album (Owned and Locked), the unlock sheet and its reveal, each Uma's profile (her career, her racing builds, her template). **Card Library:** every SSR, and each card's page with its real effects and Unlock. **Account** (hidden; reached from the trainer chip and the menu): the tickets, sync, Appearance, this phone's reduced motion and race speed, App build and Content, Sign out, and a dev section in dev builds. **The plaza:** the owned Umas | 11 §3.1, §5; [02](../game/02-unlocks.md), [06](../game/06-cards-and-bonds.md) |
| **Career** (`/career`) | **Careers:** Start a career, the careers in progress and completed, and each career's page, Upgrade (Tree · Deck · Bonds · Skills), plays and race runs. **Training Yard, Furlong Hand:** each game's practice | 11 §3.2, §8; [03](../game/03-careers.md), [05](../game/05-the-build.md), [07](../game/07-stages.md)–[09](../game/09-furlong-hand.md) |
| **Every page** | The menu | 11 §2.5 |

### Race select and the pre-race sheet

There is no race select: a career's races open from its page. The season card's Race step lists the season's
objectives (or the URA Finals' rounds), and **Race** opens **the race sheet** over her career page (11 §8.4):
1. **The race:** its field's grade, surface, metres, distance and venue.
2. **Her racing build** as the race reads it: her five stats, this race's surface and distance grades, her skills.
3. **Running style:** the four styles as 44 pt icons with her grade in each, her best preselected. The choice isn't
   saved.
4. **The field:** the runners' faces by gate, hers marked, from the same seeded draw the operation runs.
5. **Race** commits the race before it plays, so a reload or a reopen lands on the same race.

### The race

The run is full screen (`places/career/RunPage.tsx`) and always plays a committed result. The PixiJS scene draws
the course with each runner's verified outfit bust in a numbered, colour-ringed token (a numbered dot if unavailable).
The header names the race, its distance and her style, with **Skip**; the HUD names the phase and the metres left, and
a feed of small toasts on the right calls out skills and moves. In the thumb zone: her place, her HP meter, Pause, and
1× or 2×. The screen stays awake while it plays.

A run starts at this phone's default race speed from Account (`uma-racer:g3:raceSpeed`, 1× or 2×). Dev builds expose
`window.__raceScene` (`seek`, `skipToEnd`).

### Results

The result slides up over the run (11 §8.5):
1. Her bust and her place: "Win!", or "4th".
2. The objective's status: "Objective won", or "Not won yet: retries are free"; at the URA Finals, the next round or
   the Finals won.
3. What a win paid: a Card Ticket and its SP; the final's tickets.
4. The field in finishing order with outfit busts and margins.
5. A loss offers **Retry** at once beside **Back to her career**; a win **Continue**s to her career.

A reload shows the same stored result.

## Sheets and lists

| Surface | Behaviour | Code |
|---|---|---|
| **Bottom sheet** | Modal, over a scrim that closes it. A drag starts from the grab handle only, so taps inside are never swallowed; a drag past 90 px or a flick closes it. A close button sits by the handle. It never grows past 92% of the screen: the content scrolls under the fixed handle. Escape closes it, before anything under it | uma-kit's `BottomSheet` |
| **Sheet over a sheet** | uma-kit's `Sheet` and Uma picker render through a portal, so a sheet or picker opens over another sheet | `uma-kit/ui`, `uma-kit/album` |
| **Peek** | uma-rpg's side panel: modal, 88% wide from the right, the map dimmed and paused behind it ([Peek, Page and Back](#peek-page-and-back)) | uma-kit's `PeekPanel`, `hub/PlacePeek.tsx` |
| **The menu** | Focus moves to the sheet's heading and returns to what opened it. Escape, the close button, the handle and Back close it | `hub/GlobalSheets.tsx` |
| **Tab rows** | Two to four tabs at 44 pt on a sunken track, the chosen one raised, moving by a CSS transition: the Stable's and the Library's Owned and Locked, Upgrade's Tree · Deck · Bonds · Skills | uma-kit's `Tabs` |
| **Lists and grids** | Rows of at least 44 pt. Long grids stay cheap through `content-visibility`: off-screen rows skip layout and paint, and the scroll position restores because nothing unmounts | `uma-kit/album`'s `VirtualGrid` |

**Confirm only what spends, and say the amount.** Unlocking an Uma says Uma Tickets N → N−1 on its one sheet; a card's
page is its own confirm (**Unlock · 1 Card Ticket**); Start a career shows the objectives it will freeze. Buying a pip,
a row or a Camp shows the exact gain and cost first; pouring Bond is preselected to the next stop. Everything else is
one tap. Nothing has an undo.

## Feedback and plain words

### A tap's answer

Every tap is one operation, with its id chosen before it's written
([architecture](../game/architecture.md#the-save-and-sync)). While it runs, its button is disabled, so a double tap
does nothing. Its answer shows beside the button (`places/career/useCareerOp.ts` on the career's screens):

| Answer | On screen |
|---|---|
| **Done** | The screen moves on. No toast |
| **A rule** | One plain sentence, the rule's own refusal: "Win this season's objective first." · "Her career is complete." |
| **Unexpected** | "That didn't work. Try again." The outbox also retries by itself |

The words are the rule's own refusal, from the same `commitOperation` on the phone and the server, so the two agree.
A refused tap never tells the owner to reload, review or retry by hand (D320).

### Plain words

- **Say what happened, in the owner's words.** Offline: "Saved on this phone. It'll sync when you're back online."
  Anything unexpected: "That didn't work. Try again."
- **Banned in player-facing text:** operation, receipt, revision, generation, version, stale, conflict, payload, id,
  sync error codes and HTTP numbers. `hasBannedWord` (`apps/web/src/save/words.ts`) holds the save's words to it in
  tests.
- **Names, not ids.** Screens name Umas, cards, skills and races from the content. Account says **App build** and
  **Content**.
- **No times to wait.** Nothing on screen counts down or names a duration.

### Notices and sync

- **The only sync signal is the Sync chip** in the account bar ([Navigation](#navigation)). Account's sync row says the
  state in a sentence, with **Sync now**.
- **A tap the server refused** after the phone accepted it rolls back and becomes a **notice** in plain words, kept
  until dismissed.
- **A new build** shows one banner at the top: **Update ready** with **Restart**. It waits for the current action to
  finish and save first, and never reloads across a gameplay commit (uma-kit's `UpdateNotice` and `criticalAction`).

### Moments

| Moment | What moves | With reduced motion |
|---|---|---|
| A press | The control scales down a touch (buttons 0.98, bar tabs 0.94) | No movement |
| A number changes | It slides in by a CSS transition | It swaps at once |
| A Peek opens | The side panel slides in 24 px from the right and fades in, the map dims, 220 ms | It fades in, without the slide |
| A page changes | The map fades through black, 90 ms out and 130 ms in; clouds drift and chimneys smoke | No fade; nothing drifts |
| A sheet opens | It slides up from the bottom | It appears |
| A new Uma or card | The reveal grows in the unlock sheet; a card's art pops | Shown at once |
| A game's move | Pieces and cards move by transform and opacity; the Yard's pieces pop in; Furlong Hand's spurt has its banner | The moves without the flourish |
| A race result | The result slides up over the run | Shown at once |

There is no sound and no haptics: every moment stands on its own visually.

## Loading and errors

| State | What shows | Code |
|---|---|---|
| **Content loading, or the save booting** | The shell's quiet frame: both bars, blank pills where the numbers go, nothing between. Screens arrive as lazy chunks with no spinner | `hub/RacerShell.tsx`, `app/GameProvider.tsx` |
| **Signed out, or content that can't load** (before the save opens) | One full-screen panel: a title, a sentence and one way on: **Sign in**, **Sign in again**, **Switch account** (an account not on the allowlist), **Try again**, **Download again** or **Check again**. The save on the phone is never touched | `app/session.tsx`, `content/diagnostics.ts` |
| **The save can't open** | One panel: **Save needs attention**, the reason, "Your progress is kept as it is. Nothing is cleared.", then **Try again** (reloads) and **Copy details** (the app build, the time and the reason, for a report) | `app/Root.tsx` |
| **Signed out after the save opened** | Play goes on. The Sync chip says **Sync paused** until the owner signs in | `app/session.tsx` |
| **A link to something that isn't there** | An unknown path, or a place not on its page, goes to `/`; a sub-route a Page doesn't know goes back to its root | `app/routes.tsx`, the places |
| **A play killed mid-way** | Reopening resumes it from its journal on this phone; a play whose deck, bonds or season changed starts again, saying why | `stages/StageHost.tsx` ([07](../game/07-stages.md) §4) |
| **A new build** | **Update ready** with **Restart** ([Notices and sync](#notices-and-sync)) | uma-kit's `UpdateNotice` |

## Albums

Two albums: the **Stable**'s roster (`places/stable/`, [02](../game/02-unlocks.md) §2) and the **Card Library**
(`places/card-library/`, [02](../game/02-unlocks.md) §3). The **Uma picker** is `uma-kit/album`'s, the one way to
choose an Uma anywhere (SB6, D373): Start a career opens it over the owned Umas free to start one. The query engine is
pure (`uma-kit/roster`); the patterns follow the faceted-tray research in
[Game UI Reference](../research/game-ui-reference.md).

### Shared browsing chrome

- **Owned and Locked tabs** with their counts on both albums; each opens on Owned once anything is owned, else Locked.
- **The Stable** uses uma-kit's compact `AlbumChrome`: search, a **Sort** button showing the key and its direction,
  and **Filters**, which turns gold and shows the number of active filters. Every active filter is a chip, removed
  with one tap, with **Clear all**. The Filters tray shows each option's count, disables an option that would return
  nothing, and applies on **Show N**. Its query is kept on this phone (uma-kit's `useAlbumPrefs`, under the
  `uma-racer:g3:` prefix) and never synced.
- **The Card Library** has a search and the seven types and eight focus marks as 44 pt icon toggles, all in the URL
  (`?tab=`, `&type=`, `&style=`, `&distance=`, `&q=`), so Back from a card keeps the view.
- **An empty result names the way out:** the Stable's empty filter result names the filter to remove, with **Clear
  all**; an empty Owned tab says how tickets unlock, with **Unlock your first Umas** (or cards).

### Default sorts

| Album | Opens on | Other sorts |
|---|---|---|
| **Stable** | Release, newest first | Name · Latest unlock |
| **Card Library** | Release, newest first | — |
| **Uma picker** (Start a career) | Latest unlock, newest first | — |

### View modes

One mode each: the Stable is five face tiles to a row with her name under each; the Library four card tiles to a row
with the card's name. There is no view switch.

### Art tiers

| Tier | Size | Source | Where it shows |
|---|---|---|---|
| **Icon** | 128 px, atlased (`uma-icons`, `card-icons`) | The platform release | Every card tile; an Uma's fallback while her art loads or fails |
| **Face** (`face`) | Square, transparent | The platform's `outfit-faces` | The Stable's grid, the Uma picker, the race sheet's field, the Yard's face tiles, Furlong Hand's ladder (`FaceTile`) |
| **Bust** (`bust`) | 256 px square, head and shoulders | The platform's `outfit-busts` | Sheets, her profile and career page, the race's runner tokens, feed and result; the plaza's fallback |
| **Chibi** (`chibi`) | Transparent, standing (`-a`) | The platform's `outfit-chibis` | Only the Town Hall plaza crowd; the kit gently bobs it |
| **Card art** (`card`) | The full illustration | The platform's `support-card-art` | A card's page and the art viewer; Partners in both games |

- **Lists never use the large art; detail surfaces do.** A card's page opens on its illustration; a tap on it opens
  the **art viewer** (`ui/ArtViewer.tsx`): the whole image on a dark stage over everything, closed by a tap, its close
  button or Escape.
- **The icon shows first** and the larger art replaces it when it arrives, so nothing waits on a download. A missing or
  failed file keeps the icon, or her initial, with no error and no empty frame.
- **Large art is never atlased and never precached.** Each file is content-addressed, fetched through the authenticated
  API the first time it's shown, checked against its manifest's size and hash, and cached by uma-kit's content runtime
  ([architecture](../game/architecture.md#private-content)). The album art adapter (`app/albumArt.tsx`) and the card
  art hook (`ui/useContentArt.ts`) hold entries while shown.

### Icon overlays

Each tile keeps its marks inside its padding, so nothing covers a face (`ui/ArtTile.tsx`'s four corners).

| Corner | Stable | Card Library |
|---|---|---|
| **Top right** | A race mark while she is in a career | — |
| **Bottom left** | — | Card type |
| **Bottom right** | A trophy once a career is complete | — |
| **Corner** | — | A lock while locked |

- **A locked Uma** is her face dimmed behind the kit's central lock, never an empty box.

### Shared behaviours

- **Stable filters:** the surfaces, distances and running styles she runs at A or better.
- **A locked face** opens the unlock sheet; an owned one opens her profile. A card opens its page, where a locked one
  is unlocked.
- **One tile, one target.** A tile's accessible name is its name and state ("Amber Sprint, Locked", "…, In a
  career"); marks are labelled, not extra actions.
- **Not in the albums:** compare, long-press actions, grouping, saved views on the Library, and a density toggle.

## Accessibility and comfort

- **Targets:** every tap target is at least **44×44 pt** (`places/targets.test.tsx`). A place's link covers its
  building down to the ground line and its name pill.
- **Thumb zone:** primary actions sit low ([Principles](#principles)). Nothing in the top corners is needed to play.
- **State never rests on colour alone.** The active tab is two-tone with a marker; a Training Yard piece's tier shows
  by frame and pips as well as colour; the Sync chip says Offline, Sync paused or Sync.
- **VoiceOver** reads each place's link with its counter ("Stable. 20 Uma Tickets.") and each chip with its count and
  where it goes. Links read in map order, top to bottom and left to right; the canvas is hidden from it. The calendar
  strip reads each season ("Classic Spring, now: … (G1), open"). The menu lists every place for anyone who can't use
  the map.
- **Focus:** a Peek or a sheet moves focus to its heading and gives it back to what opened it; the side panel keeps
  Tab inside it. Escape closes the top sheet first, then a Peek, and the art viewer.
- **Reduced motion** is on when the system asks for it or when Account's switch is on for this phone
  (`uma-racer:g3:reducedMotion`, never synced; uma-kit's `MotionRoot` under uma-racer's key prefix, `app/kit.ts`). It
  reaches Motion through `MotionConfig` and CSS through a `data-reduced-motion` attribute: no number slide, no sheet
  slide, no reveal growth, no game flourish and no race close-finish slowdown. Every state change still shows, and no
  commit waits on an animation.
- **Numbers** use tabular figures, so counters don't jitter, and large amounts are grouped ("1,850").
- **No sound or haptics.** Everything is shown on screen; no game needs audio.
- **Portrait only:** the installed app is locked to portrait, the race and the games included. A play and a run keep
  the screen awake.
