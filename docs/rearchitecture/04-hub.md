# 04 · Hub rework

The Home screen's scrolling list of cards becomes a **Hub**: pixel-art pages of places, each place opening its
screen. It's the pattern uma-rpg runs today (its `docs/game/sections.md`), built on the shared `uma-scene` hub
([02](02-platform-and-packages.md) §4) and `uma-art`'s tiles and buildings ([03](03-rendering-and-textures.md)). The
place list below covers every screen the racer has after the RPG leaves. The owner's feature docs may rename,
regroup or add places; the structure doesn't change.

## 1. Today

- **`HomeScreen.tsx` (286 lines)**, inside `AppShell`, is one scrolling column:
  - the featured Uma (Train, Race);
  - Career goals;
  - the Training Tickets meter;
  - Farm, Puzzles and RPG cards;
  - Recent flair and Stable flair.
- **`TabBar`:** Home · Stable · Race (raised) · Cards · Badges.
- **`TopBar`:** the logo opens Settings; it also shows a sync chip and pills for tickets, Card Coupons and Uma Coupons.
- **Outside the tabs, as full-screen shells:** the Farm, Puzzles, RPG, constellation, minigames, the race run and the
  collection reveal.
- **The Hub isn't specified anywhere:** `docs/design/ux.md`'s "Home (lobby)" is stale.

## 2. The pattern (shared with uma-rpg)

| Part | What it is | Lives in |
|---|---|---|
| **Place registry** | One table: id, page, kind, name, one-line blurb, position on the page map (fractions of width and height), slot pips, hidden flag | `@racer/domain/hub` (pure, tested, rendered into the live manual) |
| **Pages** | A few pixel-art maps, one per area, swiped between | `scenes/hub/` (Phaser via `uma-scene/hub`) |
| **Hit layer** | One DOM button per place over its building: name label, lock badge, "Ready" badge, slot pips with faces | `hub/PlaceTargets.tsx` (shared component) |
| **Place UI** | Per place: a **Peek** (a short side panel), a **Page** (its full screen) and an optional **Counter** (a number in the account bar), all lazy | `places/registry.tsx` |
| **Routes** | `/:page`, `/:page/:place`, `/:page/:place/*` (a place's own sub-routes, e.g. `town/stable/outfit/:id`) | `app/router.tsx` |
| **Shell** | Account bar on top (trainer, currencies, sync state), page tabs at the bottom, a global menu listing every place, an overlay host for Peeks | `app/` |

Rules carried over from uma-rpg:
- The canvas draws and the DOM receives every tap.
- Every place is a link, so Back works and the iPhone's swipe-back works.
- A locked place shows a lock and no placeholder text (uma-rpg D95).
- Explanations live behind an (i) help button.

## 3. Pages and places

Three pages, plus a raised **Race** button in the bottom bar, because races are the payoff (design pillar 2) and
stay one tap away:

```text
┌──────────────────────── account bar: trainer · Training Tickets · Uma Tickets · Card Coupons · sync ─┐
│                                   page map (Phaser) + place buttons (DOM)                           │
└──────────── bottom bar:  Town · Training · ( RACE ) · Farm · ☰ ─────────────────────────────────────┘
```

### Town (the start page)

| Place | Opens (today's screen) | Peek | Counter |
|---|---|---|---|
| **Stable** | Stable roster, Uma profile and skills, unlocking with Uma Tickets | Featured Uma, roster size, Umas ready to promote | Uma Tickets |
| **Racecourse** | Race Select → race run → result | Next career goal race per featured Uma | — |
| **Scenario Gate** | Scenario careers and goals (Journey), promotions, Scenario Start | Goals in progress, gates reached | Goals ready |
| **Card Hall** | Cards album, card page, decks and card sets, Friendship Training | Stars to earn, coupons | Card Coupons |
| **Trophy Hall** | Badges, titles, showcases, Trainer profile and achievements | Recent flair (today's Home panel) | New flair |
| **Warehouse** | Items: produce, meals, Puzzle materials, Inspiration tokens and their Convert ([06](06-rpg-decommission.md) §5) | Top stacks | — |
| Account *(hidden; from the account bar)* | Settings, sign-out, build and content versions | — | — |

The **featured Uma** stands in the Town plaza as a code-animated chibi. Tapping her opens a quick sheet (Train, Race,
Profile), which replaces today's hero card.

### Training

| Place | Opens | Peek | Counter |
|---|---|---|---|
| **Training Grounds** | The constellation screen per Uma: nodes, cards, Inspiration, Extra Stats (today's `/constellation/:umaId/*`) | Umas with CL to spend | — |
| **Puzzle Arena** | Uma Puzzles: roster, parties, chapters, map, battle, exchange (today's `/puzzles/*`) | Chapters open, materials | — |

### Farm

| Place | Opens | Peek | Counter |
|---|---|---|---|
| **Garden, Orchard, Barn** | That district's six stations: the Farm scene ([05](05-farm.md) §5) | Each station's job and time left | — |
| **Workshop, Kitchen** | Same, for processing and cooking | Same | — |
| **Farmhouse** | Crew (workers and Farm Levels), Recipes, Wishlist | Ready jobs across the Farm | Ready jobs |

On the Farm page the five districts show **six slot pips each**, with the worker's face ringed by her job's progress
and a "Ready" badge when something can be collected. That's uma-rpg's facility pips, and the whole Farm reads at a
glance.

**Full-screen flows** stay outside the Hub and return to the place they came from: the race run, the constellation
scene, a Puzzle battle, a Friendship run, the collection reveal.

## 4. Routes

| Today | After |
|---|---|
| `/` | `/town` |
| `/stable`, `/stable/:umaId`, `/stable/:umaId/skills` | `/town/stable`, `/town/stable/outfit/:id`, `…/skills` |
| `/race`, `/race/run` | `/town/racecourse`, `/town/racecourse/run` |
| `/cards`, `/cards/:cardId`, `/minigames/friendship-training/:cardId` | `/town/card-hall`, `…/card/:id`, `…/card/:id/friendship` |
| `/badges`, `/trainer` | `/town/trophy-hall`, `/town/trophy-hall/trainer` |
| `/settings` | `/town/account` |
| `/constellation/:umaId/*` | `/training/grounds/:umaId/*` |
| `/puzzles/*` | `/training/puzzle-arena/*` |
| `/farm/*` | `/farm/:district`, `/farm/farmhouse/*` |
| `/rpg/*`, `/minigames/spark-match/*` | Deleted, with no redirects |

The old paths redirect for one release, then the redirects go. Saved data holds no paths, so nothing else changes.

## 5. Art

- **Ground and props:** `uma-art` `tiles`, the same autotiler as uma-rpg (16 px cells, paths that never close a 2×2
  block, water and props).
- **Buildings:** `uma-art` `buildings` where one fits (a Warehouse, a hall), plus a new `racer` family drawn by
  `scripts/pixel-art` for the Racecourse, Card Hall, Trophy Hall, Scenario Gate, Training Grounds and Puzzle Arena.
  The Farm page uses the new `farm` family's district buildings ([02](02-platform-and-packages.md) §3).
- **Page size:** each page fits the screen at the largest whole-number scale (no scrolling), as in uma-rpg. If the
  owner's docs add many places, pages scroll vertically with the same grid. That's uma-rpg's H19, built in the shared
  hub so both games get it.

## 6. What happens to today's Home panels

| Today | After |
|---|---|
| Featured Uma hero, Train and Race | The plaza chibi and her quick sheet; the raised Race button |
| Career goals panel | The Scenario Gate's Peek and Counter |
| Training Tickets meter | The account bar |
| Farm, Puzzles cards | The Farm page and the Puzzle Arena |
| RPG card | Deleted |
| Recent flair, Stable flair | The Trophy Hall's Peek and Counter |
| `PuzzlePreparationNotice` | Deleted: there is no preparation after the wipe |

## 7. Done when

- The app opens on `/town`. Every screen above is reachable from a place, and every place is reachable from the global
  menu.
- The place registry and the live manual's place list are the same table (`docs/game` renders it).
- At 390×844 every place button is at least 44 pt, page swipes and tabs agree, and VoiceOver reads each place's name,
  lock and counter.
- The Hub's chunk (scene + tiles + buildings) loads in under a second on the owner's iPhone over a warm cache, and the
  entry chunk stays under 180 KB gzip.
