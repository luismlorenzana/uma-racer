# 11 · Hub and places

> **Status: generation 3 (M036; T152, T157, D381, D386).** T152 cut the Hub to two pages, Town Hall and Career; T157
> built the shell, the Stable, the Card Library, the Careers place's shell and Account on them. **T158 adds the career
> screens** (§8). Generation 2's four pages, their places and their decisions left with it (D380); git history holds
> them.

The Hub keeps the re-architecture's pattern whole ([rearchitecture/04](../rearchitecture/04-hub.md) §3–§6): a place
registry, pixel-art pages on a Phaser canvas with a DOM hit layer, a Peek, a Page and a Counter per place, and routes
`/:page/:place/*`. Since T147 its shell, Hub map and primitives are uma-kit's, the app both Uma games share
([architecture](architecture.md#uma-kit)).

## The menu tree at a glance

Every screen, from page to place to sub-page and sheet, as the code builds it. The place lines follow §3's live table;
the routes are §7.1. On a page's map, a place's link opens its quick look in the side panel (`/:page?peek=:place`,
§2.6) and **Enter** opens its Page. `…` stands for the place's own route.

```text
/                          the start rule (§2.4): the last page viewed on this phone, or Town Hall
├─ Town Hall /town         bottom bar tab 1; the plaza's crowd (§5), a tap opens her profile
│  ├─ Stable               Peek: Uma Tickets, owned of all, the latest unlocks; counter: Uma Tickets in hand
│  │  ├─ /town/stable                the album: ?tab=owned | locked; search, sort and filters; a locked face opens
│  │  │                              the unlock sheet, then its reveal (Her profile · Done)
│  │  └─ …/outfit/:umaId             her profile: her career (Open her career, or Start career), her racing builds,
│  │                                 her template; a locked Uma's Unlock opens the same sheet
│  ├─ Card Library         Peek: Card Tickets, owned of all; counter: Card Tickets in hand
│  │  ├─ /town/card-library          the album: ?tab=owned | locked, &type=, &style=, &distance=, &q=
│  │  └─ …/card/:cardId              a card's page: Unlock, power, effects at level 50, unique effect, skills, era
│  └─ Account (hidden)     no Peek, not on the map; the trainer chip and the menu open it; ?row=sync
└─ Career /career          bottom bar tab 2; the raised Career opens her current season (§2.2)
   ├─ Careers              Peek: the careers in progress and their next objectives; counter: careers in progress
   │  ├─ /career/careers             in progress (a tap opens one) and completed (a tap opens her profile)
   │  └─ …/:careerId                 one career (`{umaId}:{T}`): where she stands and her objectives (T158 builds
   │                                 the season screens here)
   ├─ Training Yard        Peek; its Page is the stage host, full screen, as practice (§6)
   └─ Furlong Hand         Peek; its Page is the stage host, full screen, as practice (§6)

On every shell route   ?sheet=menu (☰, §2.5)
In a Page's state      the Stable's unlock sheet and its reveal: a reload closes them
Anything else          generation 2's paths and unknown paths go to / (§7.2)
```

## 1. The pattern

| Part | What it is | Lives in |
|---|---|---|
| **Place registry** | One table: id, page, name, one-line blurb, art frame, position on the page (fractions of width and height), counter, `direct` and hidden flags | `@racer/domain/hub` (`places.ts`): pure, tested, rendered into §3's live table |
| **Pages** | Two pixel-art maps on a lazy Phaser 4 canvas (uma-rpg's Hub, shared since T147): seeded tile terrain, a road down the middle with a path to every door, props, uma-art's buildings, clouds and chimney smoke; swiped between | uma-kit's `HubMap`, fed by `hub/HubPage.tsx` and `hub/racerHub.ts` (each page's tile page and palette, and the plaza's crowd) |
| **Hit layer** | One DOM link per place over its building, on the scene's own grid, with its name pill and counter | uma-kit's place links, from `hub/HubPage.tsx` |
| **Place UI** | Per place: a **Peek** (its quick look in the side panel), a **Page** (its full screen) with optional sub-page slots and a full-screen rule, all lazy | `places/registry.tsx` |
| **Routes** | `/:page`, `/:page?peek=:place`, `/:page/:place`, `/:page/:place/*` | `app/router.tsx`, `app/routes.tsx` |
| **Shell** | Account bar on top, bottom bar, the ☰ menu listing every place, the side panel for Peeks and a host for the global sheets | uma-kit's `AppFrame`, `AccountBar`, `BottomBar`, `PlaceMenu` and `PeekPanel`, with uma-racer's words, chips, tabs and sheets passed in: `hub/RacerShell.tsx`, `hub/GlobalSheets.tsx` and `SheetHost.tsx`, `hub/PlacePeek.tsx`, `hub/nav.ts` (the global sheets and the places' paths), `hub/counts.ts` |
| **The Hub's view** | The tickets, each place's counter, the owned Umas (the plaza's crowd), the cards owned, and the careers in progress with their next objective | `@racer/domain/hub`'s `hubView` (`view.ts`), run in the lazily loaded rules chunk |
| **Words** | The shell's and the Peeks' sentences in `HUB_WORDS`; each place's own in its `model.ts` | `@racer/domain/hub` (`words.ts`); `places/*/model.ts` |

Rules carried over from uma-rpg:
- **The canvas draws and the DOM receives every tap.** No sprite is a tap target.
- **Every place is a link**, so Back and the iPhone's edge swipe work everywhere.
- **Explanations live behind an (i) button** on each Page, written from the registry blurb and the place's own lines.
- **44 pt targets.** Every button, link, field and tab on a place carries a 44 pt-or-taller class, checked at 390 × 844
  (`places/targets.test.tsx`).
- **Swipe between pages** on the map (not inside sheets or the side panel), in the bottom bar's order, without
  wrapping: a mostly sideways drag of more than 60 pt, with the scene's camera fade. The bottom bar's tabs do the same.
- **No scroll or zoom on the map** (uma-rpg D113): each page is one screen.
- **Tap once for the Peek, then Enter for the Page** (uma-rpg D43). No place is `direct` in generation 3.

## 2. The shell

```text
┌──────────────────────────────────────────────────────────────┐
│ (T)                      ▭ 20      ▣ 24          Sync paused │  account bar
│                                                              │
│              page map (Phaser) + place links (DOM)           │
│                                                              │
├──────────────────────────────────────────────────────────────┤
│  Town Hall     Career     ( Career )     ☰ Menu              │  bottom bar
└──────────────────────────────────────────────────────────────┘
```

**The frame** is uma-kit's `AppFrame`: a box fixed to the screen's edges (`fixed inset-0`), never `h-dvh`, which an
iPhone's Home Screen app can report a status bar short. The account bar keeps the top safe area, the bottom bar lifts by
the safe area alone, and a full-screen flow passes `fullScreen` and the bars go (§6). The theme follows the phone's
light or dark setting unless Account says otherwise (§3.1).

### 2.1 The account bar

Left to right (uma-kit's `AccountBar`, with uma-racer's chips from `hub/RacerShell.tsx`). Every item is a 44 pt link.

| Item | Shows | Tap opens | Hidden when |
|---|---|---|---|
| Trainer button | "T", the trainer's initial on a gold disc (generation 3 keeps no trainer name) | Account (`/town/account`) | Never |
| **Uma Tickets** | Count, with uma-art's `currency/uma-ticket` mark | The Stable's Locked tab (`/town/stable?tab=locked`) | Never (shows 0) |
| **Card Tickets** | Count, with `currency/card-ticket`; uma-art draws none yet, so the kit's cards icon stands in (§10.3) | The Card Library's Locked tab (`/town/card-library?tab=locked`) | Never (shows 0) |
| **Sync** | Offline, Sync paused (signed out), or **Sync** in amber (waiting over a day) or red (failing) (D157) | Account, at the sync row (`/town/account?row=sync`) | Synced |

There are no coins and no Speed Tickets. Numbers move with a CSS transition when they change. While the game boots,
the chips show blank pills where the numbers go.

### 2.2 The bottom bar

**Town Hall · Career · ( Career ) · ☰ Menu** (uma-kit's `BottomBar`, with uma-racer's tabs from `hub/RacerShell.tsx`):
- **Town Hall** and **Career** open their pages.
- **The raised Career** in the middle, a gold disc, opens **her current season**: the career in progress started last
  (`/career/careers/:careerId`), or every career (`/career/careers`) when none runs. It is marked on the Careers place,
  the Career tab elsewhere on the Career page.
- **☰ Menu** opens the menu sheet (§2.5) over the current route. It is the way to everything when the canvas can't load.
- No tab carries a badge, so the bar stays quiet. The active page shows by shape (a two-tone icon and a gold marker)
  as well as colour.
- **The bar is docked** (uma-kit 0.2.0, D369): full width, flush to the screen's bottom edge, its panel under the home
  indicator (`pb-bar-safe`), the raised disc rising out of it.

### 2.3 The floating pill

Gone with generation 2's check-ins (D380): nothing runs on a clock, so nothing waits to be collected.

### 2.4 Getting in, and where the app opens

**Getting in** is uma-kit's `BootGates` (SD4): the game's name while the app starts; **Sign in with Google** while nobody
is signed in; the boot (the private content, then this phone's save); then the start page. A boot that stops says why
in plain words, with the one button that helps (Try again, Switch account, or reload). Nothing is ever cleared.

`/` decides once, at launch, after the boot: **the last page viewed**, kept per device (`uma-racer:g3:lastPage`), or
**Town Hall** the first time. A new account then meets its tickets on the account bar, one tap from the Stable's Locked
tab.

### 2.5 The menu

`?sheet=menu` (the bar's ☰ Menu), a bottom sheet titled **Every place** (`hub/GlobalSheets.tsx`, uma-kit's `PlaceMenu`):

| Group | Entries, in order | Each opens |
|---|---|---|
| **Town Hall** | Stable · Card Library | The place's Peek over its page |
| **Career** | Careers · Training Yard · Furlong Hand | The Peek |
| Under a rule | **Account** | `/town/account` |

The entries are every drawn place of each page in registry order (`placesOn`), so a new place joins the menu by joining
the registry. Each is a 44 pt row with the place's counter, hidden at 0. A tap replaces the menu's history entry with
the place, so Back returns to where the menu was opened.

### 2.6 The quick look (the side panel)

A place link on the map opens `/:page?peek=:place`: uma-rpg's side panel, uma-kit's `PeekPanel` (`hub/PlacePeek.tsx`),
modal, sliding in from the right over 88% of the screen with the map dimmed and its scene paused behind it.
- **Header:** the place's name, its counter, (i) for its blurb and a close button.
- **Body:** the place's registered Peek (§3); a place without one shows its building over its blurb.
- **Enter {place}** in the thumb zone replaces the panel with the place's Page, so Back returns to the map.
- A swipe right, a tap on the dimmed map, Escape, the close button or Back closes it. Focus moves to its heading,
  stays inside while it is open, and returns to the place's link.
- A Peek opens only over its own page: `?peek=` naming a place on another page, or the hidden Account, goes back to the
  bare page.

## 3. The two pages

Page ids, routes and the order of swiping: `town`, `career`.

The place registry, `@racer/domain/hub`'s `PLACES`, as it stands. **At** is where a place stands on its page map: the
middle of its building's ground line, as fractions of the map's width and height. Each page is laid out as uma-rpg
lays its own: a road down the middle and the places on both sides of it, a quarter in from either edge (x 0.24 and
0.76), with the odd one on the road (x 0.5).

<!-- live:hub-places -->
| Page | Place | Id | Kind | Route | Counter | Frame | At (x, y) |
|---|---|---|---|---|---|---|---|
| Town Hall | Stable | `stable` | town | `/town/stable` | `uma-tickets` | `stable` | 0.24, 0.18 |
| Town Hall | Card Library | `card-library` | town | `/town/card-library` | `card-tickets` | `card-library` | 0.76, 0.18 |
| Town Hall | Account (hidden) | `account` | town | `/town/account` | — | — | — |
| Career | Careers | `careers` | career | `/career/careers` | `careers-open` | `party-hall` | 0.5, 0.2 |
| Career | Training Yard | `training-yard` | career | `/career/training-yard` | — | `gym` | 0.24, 0.6 |
| Career | Furlong Hand | `furlong-hand` | career | `/career/furlong-hand` | — | `racecourse` | 0.76, 0.6 |
<!-- /live -->

### 3.1 Town Hall (`/town`)

```text
   [ Stable ]          ┃          [ Card Library ]
                ( plaza: the owned Umas )
```

| Place (id) | Peek | Page | Counter |
|---|---|---|---|
| **Stable** (`stable`) | Uma Tickets in hand; how many Umas are owned of all of them; the latest five unlocks as faces, each a link to her profile | The album and her profile ([02](02-unlocks.md) §2): Owned and Locked tabs (Owned once any Uma is owned, else Locked), uma-kit's album chrome (search, sort, filters, kept on this phone) over a grid of faces, five a row, a race mark on an Uma in a career and a trophy on one with a completed career. A locked face opens the **unlock sheet**: her bust, aptitudes and growth rates, Uma Tickets N → N−1 and **Unlock · 1 Uma Ticket** (`unlock-uma`), then the reveal in the same sheet with **Her profile** preselected. **Her profile** is uma-kit's profile frame: her career (Open her career, Start career · URA Finale, or complete), her racing builds (five stats, aptitudes and skills per completed career) and her template | Uma Tickets in hand |
| **Card Library** (`card-library`) | Card Tickets in hand; how many cards are owned of all of them | The album and a card's page ([02](02-unlocks.md) §3): Owned and Locked tabs, a search, the seven types and eight focus marks as 44 pt toggles (all in the URL), the cards newest release first, four a row. **A card's page:** art, type, title, era ("First usable in …" and whether URA Finale careers take it), focus, **Unlock · 1 Card Ticket** while locked (`unlock-card`, then the art pops and "In your Library"), its power against its type's median, its effects at level 50 in plain words, its unique effect's description, its hint and event skills | Card Tickets in hand |
| **Account** (`account`, hidden) | None | uma-kit's Account frame: the wallet (both tickets), Appearance (System, Light, Dark, on this phone), the sync row and **Sync now** (`?row=sync` scrolls there), this phone's Reduce motion and race speed, in dev builds a dev section whose buttons run `dev-grant` (+5 Uma Tickets, +5 Card Tickets; the API runs it only with `DEV_OPERATIONS=true`), App build and Content, and **Sign out** where somebody signs in. No check-in times and no rows for retired systems | — |

### 3.2 Career (`/career`)

```text
                       [ Careers ]
                            ┃
   [ Training Yard ]        ┃        [ Furlong Hand ]
```

| Place (id) | Peek | Page | Counter |
|---|---|---|---|
| **Careers** (`careers`) | The careers in progress, the latest started first (three at most): her face and name, where she stands ("URA Finale · Classic Spring") and her next objective ("Next: … (G1)", or "Next: the URA Finals"), each a link to the career; or how to start one | **In progress** rows (a tap opens the career) and **Completed** rows (a tap opens her profile's racing build); none running points to the Stable. **A career** (`…/:careerId`) shows her bust, where she stands and her objectives with their seasons and Won or Open. T158 builds the season screens here | Careers in progress |
| **Training Yard** (`training-yard`) | Its building and blurb | The stage host full screen ([08](08-training-yard.md)), as practice until T158 opens it for a season: her running career's deck, or an Uma alone | — |
| **Furlong Hand** (`furlong-hand`) | Its building and blurb | The stage host full screen ([09](09-furlong-hand.md)), as practice until T158 opens it for a season | — |

A career starts from her profile in the Stable: **Start career · URA Finale** commits `start-career` and opens it.

## 4. Counters

A place's counter is the hub view's count (`hub/counts.ts`): Uma Tickets in hand on the Stable, Card Tickets on the Card
Library, careers in progress on Careers. It shows on the place's name pill, its menu row and its Peek's header, and is
hidden at 0 so the pages stay quiet. VoiceOver reads it with the name ("Stable. 20 Uma Tickets.").

## 5. The plaza crowd

Up to five small Umas stand round the Town Hall plaza in uma-kit's loose V (`CROWD_SPOTS`, SA7, D371): **the owned
Umas, newest unlock first**. Each is 44 pt of her art (the kit's `UmaChibi`, else her bust, icon or initial), bobs 2 px
on its own beat and stands still under reduced motion. No names show on the map; each figure's VoiceOver name is
"{name}: Profile", and a tap opens her profile in the Stable (`hub/PlazaFigure.tsx`). A new account's plaza is empty.

## 6. Full-screen flows

These hide the account bar and bottom bar (uma-kit's frame with `fullScreen`, a place slot's `fullScreen(rest)`), and
return to where they came from:
- **the two career games**, Training Yard (`/career/training-yard`, [08](08-training-yard.md)) and Furlong Hand
  (`/career/furlong-hand`, [09](09-furlong-hand.md)): the stage host, as practice until the career screens open them for
  a season ([07](07-stages.md) §5);
- T158 adds the race run and the URA Finals' completion.

The Stable's unlock reveal stays in its sheet, inside the shell.

## 7. Routes

### 7.1 The routes

The live router (`app/router.tsx`) has no basename. The shell's children are `/` (the start rule), `/:page` and
`/:page/:place/*`. A page that isn't one, or a place not on the page its route names, goes to `/`. A place's `*` is
its sub-route (`rest`), which its Page reads, unless a sub-page slot claims it first (`places/registry.tsx`). A Page
sends a sub-route it doesn't know back to its root. The paths into the places are made in one file, `hub/nav.ts`.

| Route | Screen |
|---|---|
| `/` | The start rule (§2.4) |
| `/town`, `/career` | A page's map; `?peek=:place` opens its side panel (§2.6) |
| any shell route `?sheet=menu` | The menu over it (§2.5); Back closes it |
| `/town/stable` | The Stable's album; `?tab=owned` or `?tab=locked` |
| `/town/stable/outfit/:umaId` | Her profile |
| `/town/card-library` | The Library's album; `?tab=`, `&type=` (a card type), `&style=` (a running style), `&distance=` and `&q=` (the search) |
| `/town/card-library/card/:cardId` | A card's page |
| `/town/account` | Account; `?row=sync` scrolls to the sync row |
| `/career/careers` | Every career |
| `/career/careers/:careerId` | One career, `{umaId}:{T}`, URL-encoded |
| `/career/training-yard`, `/career/furlong-hand` | The stage hosts, full screen (§6) |

### 7.2 Retired routes

Generation 2's paths (`/farm`, `/training`, `/racing`, `/town/warehouse`, `/town/exchange`, `/collection/reveal/…`, the
dev seeds' `/dev/seeds/*` and the rest) go to `/`, which applies the start rule, as any unknown path does. Saved data
holds no route paths, so nothing needs migrating.

## 8. Not built yet (T158): the career screens

The Careers place's career page becomes the season flow: the calendar strip, the season's **Play → Upgrade → Race**,
the Tree · Deck · Bonds · Skills tabs, the race sheet and run, **Next season** and the URA Finals with the completion
screen ([T158](../tasks/T158-career-screens.md)). T158 rewrites §3.2, §6 and the menu tree for them.

## 9. Tap by tap

From the Town Hall map, with tickets in hand:
- **Unlock an Uma:** the Uma Tickets chip (the Stable's Locked tab), her face, **Unlock · 1 Uma Ticket**: three taps.
  **Her profile** is a fourth.
- **Unlock a card:** the Card Tickets chip, the card, **Unlock · 1 Card Ticket**: three taps.
- **Start a career:** a plaza figure (her profile), **Start career · URA Finale**: two taps, and the career opens.
- **Back to her career** from anywhere: the raised Career, one tap.

## 10. Art

### 10.1 Buildings

All 48×48 with a ground line, from `@luismlorenzana/uma-art`'s `buildings` atlas.

| Place | Frame | Why it fits |
|---|---|---|
| Stable | `stable` | A stable with a horse at the half-door |
| Card Library | `card-library` | Drawn for the racer (A01, uma-art 2.6.0) |
| Careers | `party-hall` | A timbered hall hung with banners: where her career is planned |
| Training Yard | `gym` | Drawn for the racer (A01): the yard she trains in |
| Furlong Hand | `racecourse` | Drawn for the racer (A01): grandstand, rails and finish post |

### 10.2 Tiles

| Page | Tiles | Notes |
|---|---|---|
| Town Hall | `town/*` | Ground, plaza paths, barrels, crates, flower pots, benches, lamps, trees |
| Career | `learning/*` | Generation 2's Training ground: hedges, benches, flower beds, lamps, banners |

### 10.3 Marks (uma-art 2.10.0)

- **`currency/uma-ticket`** (16×16, drawn at 16 pt) in the account bar, the Stable's Peek, its unlock sheet and
  Account's wallet (the kit's `UiMark`).
- **`currency/card-ticket` isn't drawn yet.** Every place that shows Card Tickets passes the kit's cards icon as the
  mark's fallback, so it switches by itself when a uma-art release draws one.
- The card types, running styles and distances are the racer's own SVG icons (`ui/TypeIcon.tsx`,
  `ui/CardFocusIcons.tsx`); the surfaces are the kit's.

Uma art stays private: chibis only in the plaza, faces for small Umas and busts for large ones; outfit icons are the
fallback. Card art is the private `support-card-art` family on a card's page and the `card-icons` atlas in the album.
Both load through the authenticated content runtime; nothing is a public URL.

### 10.4 Missing art

A frame the pinned atlas lacks is never an empty or white box: the map draws uma-rpg's code-drawn marker in the page's
palette, and the DOM's building art (`ui/BuildingSprite.tsx`) the same marker as SVG. `AWAITING_ART` in
`@racer/domain/hub` lists the frames the registry test lets be missing; it is empty, so the frames test is strict. A
missing card or Uma image falls back to its atlas icon, then a labelled placeholder or her initial.

## 11. As built

- **T152** cut the Hub to two pages, kept Account and the kit's shell, and turned every other place into "Coming soon".
- **T155 and T156** opened the two games' stage hosts in practice.
- **T157 (D386)** filled the Stable, the Card Library and the Careers shell, gave the Peeks their bodies, pointed the
  ticket chips at the Locked tabs and the raised Career at her current season, and wrote this page and
  [02](02-unlocks.md).

## 12. Budgets and accessibility

- **Fit:** each page is one screen, never scrolled or zoomed. The map is 16 px art tiles on uma-kit's grid, with an odd
  number of columns centred so the road runs down the middle. A layout test holds every place link and the plaza
  inside the map and clear of one another at 390×844 and 393×852 (`hub/layout.test.ts`).
- **Load:** every page, Peek and sheet is a lazy chunk, and the entry stays ≤ 180 KB gzip (`scripts/check-size.mjs`;
  151.32 KB at T157). Phaser and the kit's scene are one lazy chunk (`createHubGame`, about 1.40 MB, 374 KB gzip),
  loaded when a map first mounts. The card effect words, `cardPower` and the album engine load with the Card Library's
  and the Stable's chunks only.
- **One engine alive:** the Hub's game lives while a page's map is mounted. It pauses its scene while the side panel or
  any global sheet covers it or the page is hidden, and is destroyed when a place's Page or a full-screen flow opens.
  The race scene's PixiJS never runs beside it.
- **VoiceOver** reads each place's name and counter; each face, card and career row its name and state ("Amber Sprint,
  Locked", "…, In a career"); each aptitude and stat its label and value. The menu lists every place for anyone who
  can't use the map.
- **Reduced motion:** no clouds, smoke or camera fade, no side panel or sheet slide, and the reveals appear without
  growing.
- **Light and dark:** every screen draws in uma-kit's tokens, which keep their names in both modes
  ([visual system](../design/visual-system.md#dark-mode)); the Stable, the Library and Careers use no raw colour.
  Animations move transform and opacity only.

## 13. Decided here

| Choice | Why |
|---|---|
| Two pages, `town` and `career`; Town Hall holds the Stable, the Card Library and the hidden Account, Career holds Careers and the two games (D381, D386) | M036's places; the Farm, Training and Racing pages left with generation 2 |
| The bottom bar is Town Hall · Career · raised Career · Menu; the raised Career opens the career in progress started last, else every career (D386) | "Career: her current season": one tap back to where she is |
| The top bar's two chips are the tickets, each opening the Locked tab of the place that spends it (D386) | Tickets are spent only on Locked; no coins or Speed Tickets exist |
| The Stable and the Library open on Owned once anything is owned, else Locked (D386) | A new account's first move is to spend its tickets |
| The Stable's grid is uma-kit's `VirtualGrid` of `FaceTile`s under its album chrome, not `AlbumGrid` (D386) | `AlbumGrid` prints a level under each face, and generation 3 has none; the kit's primitives are composed, not forked |
| The unlock sheet is one screen with her bust, aptitudes, growth and the tickets; the reveal plays in the same sheet with Her profile preselected (D386) | The owner's one-screen sheets with the obvious choice preselected; generation 2's reveal route left with T152 |
| A card's page is its own confirm: Unlock · 1 Card Ticket commits at once (D386) | You read the card before you spend; one more sheet would be one more tap |
| The Library's filters are icons in the URL; the Stable's are the kit's album chrome kept on the phone (D386) | Types and foci have icons; Back from a card keeps the view; Umas need the search and sort over every outfit |
| A card's effects are named in `@racer/domain/hub`'s `EFFECT_WORDS` and rendered into [02](02-unlocks.md) (D386) | The names are the code's own and can't drift; the values stay in the private pack |
| Power is a bar against its type's strongest, with a mark at the type's median, from the loaded content (D386) | "Against its type's median" needs a scale; the strongest card fills it |
| The Careers place keeps T158's path, `places/career/`, and every career link goes through `careerPath` (D386) | T158 fills the same files and changes the route in one place if it must |
| The Peeks' words are `HUB_WORDS`; each place's own words sit in its `model.ts` (D386) | The shell's entry reads `HUB_WORDS`; a place's words load with its chunk |

## 14. Done when

- The app opens per §2.4. Every screen is reachable from a place, and every place from the ☰ menu.
- The place registry is one table in `@racer/domain/hub`, and the live manual renders the same table.
- At 390×844 every tap target is at least 44 pt (`places/targets.test.tsx`), swipes and tabs agree, and VoiceOver reads
  each place's name and counter.
- Unlocking an Uma and a card spends one ticket and writes the record; a profile shows a completed career's racing
  build; a card's page names its real effects from the private pack, and no real card value is in git.
- Every registry frame exists in the pinned uma-art index, and the entry chunk stays under 180 KB gzip.
