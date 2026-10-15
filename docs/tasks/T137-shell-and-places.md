# T137 — The shell and the places

**M034 · starts at once, in parallel with T134 · not started.**

Read:
- [AGENTS.md](../../AGENTS.md), [CLAUDE.md](../../CLAUDE.md) "Conventions", and [M034](M034-generation-2-cutover.md),
  whose fixed choices bind this task.
- [rework/11](../rework/11-hub-and-places.md) (all; §11 says what ships now);
  [02](../rework/02-check-ins-and-notifications.md) §2, §7, §8; [01](../rework/01-game-loop.md) §2;
  [03](../rework/03-uma-progression.md) "Lifetime level"; [04](../rework/04-tiers-and-promotion.md) §6;
  [13](../rework/13-removals-and-plan-changes.md) §5–§6; D157, D181, D333.
- [rearchitecture/04](../rearchitecture/04-hub.md) (its pattern stands), [01](../rearchitecture/01-target-architecture.md)
  §4, [Visual System](../design/visual-system.md), [UX](../design/ux.md) "Navigation" and "Accessibility and comfort".
- [The rework modules](../game/architecture.md#the-rework-modules): `work` (`settle`, `statusOf`, `isFree`, `slotsOf`,
  `slotHolder`, the timeline), `check-in` (`readyCount`, `runOnce`, `recheck`, `hasBannedWord`), `planner`
  (`freeUmas`), `tiers` (`advanceReadiness`, `promotionReadiness`, `lifetimeLevel`) and `sim` (`createLoop`).
- Today's shell, to learn from and leave alone: `apps/web/src/app/{router,AppShell,TabBar,TopBar}.tsx`, `main.tsx`
  (isolated DEV proofs), `screens/HomeScreen.tsx`, `ui/` and `content/runtime.ts` (art kinds).
- uma-rpg `origin/main`, read only: `packages/domain/src/hub/places.ts`, `apps/web/src/places/registry.tsx`,
  `app/router.tsx`, `hub/{PlaceTargets,OverlayHost,PageTabs}.tsx`, `docs/game/sections.md`. uma-art 2.4.0's
  `buildings/atlas.json` (36 frames on `farmlands`, `wilds`, `learning`, `town`).

## Goal and fixed scope

The new game's frame, built beside today's app under `apps/web/src/g2/`, reachable only in development until T143:
1. `@racer/domain/hub`: the place registry and the hub view (pips, counters, tab badges, pill counts).
2. `g2/app`: §7.1's routes, §7.2's redirects, the start rule (§2.4), and the shell of §2.
3. The four pages (§3) as DOM tile grids with uma-art frames at 2×, pills, counters and pips (§4), the featured Uma's
   plaza (§5), and the lazy slots T138–T142 fill.
4. `@luismlorenzana/uma-art` **2.4.0**, exact-pinned, in `@racer/web`; a dev mount at `/dev/g2/*` over synthetic seeds.

Nothing in today's entry imports `g2/`; today's app, routes and bundle don't change.

## Implementation contract

**`@racer/domain/hub`** (`packages/domain/src/hub/`, a new `./hub` subpath export beside `./rework/*`):
- `places.ts`: `HUB_PAGES = ['town', 'training', 'racing', 'farm']` (the bar's order), the page names, and `PLACES`,
  one row per §3 place (23: 22 drawn and the hidden Account): `{ id, page, kind, name, blurb, route, direct, hidden,
  counter, frame, pips, cell }`.
  - `kind`: `town`, `facility`, `site`, `station` or `racing`. `route` is `/${page}/${id}`. Only the Racecourse is
    `direct`, only Account `hidden`.
  - `counter` names §3's counter: `uma-tickets` (Stable), `finished-here` (the 14 buildings), `ready-to-advance`
    (Scenario Gate), `featured-open` (Racecourse), `promotable` (Expedition Map), `new-flair` (Trophy Hall), else null.
  - `frame` is §10.1's uma-art id (`party-hall`, `brawler-dojo`, `tier-finale`, the Farm's own ids…), or `null` for the
    four new drawings: `card-library`, `gym`, `racecourse`, `trophy-hall`.
  - `pips` is true for the ten Farm buildings and four facilities, whose ids are `rework/farm`'s `BuildingId`s.
  - `cell` is a row and column on a three-column grid from §3's sketches; the Farm's ring follows the Duo ring.
  - Lookups `placeById`, `placesOn(page)`, `isHubPage`. Imports from `rework/` are type-only, so this file is cheap.
- `view.ts`: `hubView(state: WorkState, now, env: WorkEnv): HubView`, settling once:
  - `ready` (`readyCount`, the pill's Collect all), `free` (`freeUmas`), and `readySlots` for Collect all's `shown`;
  - `needsATap`: Umas Ready or Free (02 §7), from a new `needsATap` in `rework/check-in` (the app badge in phase 4);
  - `tabs`: Umas with something to collect at a Farm building, and at a facility (§2.2);
  - `buildings[id]`: `{ slots, busy, ready, free, queued, pips, more }`, each pip
    `{ state: 'busy' | 'ready' | 'free', outfitId, progress, queued, room }`, busy first, then ready, then free; past
    8 slots, seven pips and `more` (§4). `progress` is the current item's, from a new `itemProgress(entry, now)` in
    `rework/work/timeline.ts`;
  - `counts[placeId]` for `uma-tickets`, `finished-here`, `ready-to-advance` (`advanceReadiness`) and `promotable`
    (`promotionReadiness`).
- `words.ts`: the tile's VoiceOver line ("Kitchen. 6 of 8 slots busy, 2 ready, 1 queued."), counter words ("3 Uma
  Tickets") and the shell's copy. `docs.ts`: a `hub-places` live block in rework/11 §3, joined in `docs/rework.ts`.

**The game port** (`g2/app/game.ts`). The shell reads the game only through `G2Game`: `subscribe`, `getSnapshot()` →
`{ status, state, env, trainerName, sync, receipts }`, `now()`, `utcOffsetMin(now)` and
`run(name, input, busyKey?) → Promise<Answer>` (T131's `recheck` answer), with hooks `useGame(selector)`, `useHub()`,
`useNow()` and `useRun()`. `g2/app/boot.ts` creates the port lazily: here the in-memory one (below); T136 adapts its
`useSave` store there, one to one, with two mappings:
- `status` is `lifecycle` (`booting`, `ready`, `error`), and `trainerName` the trainer badge row's display name;
- `sync` is the chip's state: `paused` while signed out (today's `useAuth`), `offline`, `failing` (red) on `error`,
  `waiting` (amber, D157) when `oldestQueuedAt` is over a day old, else `synced`.

`useNow` is one 30-second clock that stops while the page is hidden and ticks again on return. Nothing writes on a tick.

**Routes** (`g2/app/router.tsx`, `createBrowserRouter` with a `basename`):
- `/` waits for the first snapshot, then replaces itself (§2.4): no Umas → `/town/stable?tab=locked`; `needsATap > 0`
  → `/farm`; otherwise `uma-racer:g2:lastPage` (written on each page visit, in try/catch) or `/town`.
- `/:page` is the page grid; `?peek=:place` opens a Peek and `?sheet=menu | featured | check-in` a global sheet, so Back
  closes either.
- `/:page/:place/*` renders the place's sub-page slots, then its Page with `rest`. A place not on that page, or a page
  that isn't one, goes to `/`, so `/training/:umaId` falls to `/` (§7.2).
- `/collection/reveal/uma/:umaId` is a full-screen flow (T138). Today's uma reveal links already match it; `card`
  falls to `/`.
- `g2/app/redirects.ts` is §7.2 as a table, each "After" a `<Navigate replace>` carrying params and search.
  `/cards/redeem` is listed explicitly (to `/`) so `/cards/:cardId` can't catch it. Its header says it is deleted with
  phase 4. `*` → `/`.

**The shell** (`g2/hub/`), at 390×844 first, with safe areas and `h-dvh`:
- **Account bar** (§2.1), icon-and-numeral chips with 44 pt tap areas: the trainer's initial → Account; Prize Money →
  `/town/exchange`; Speed Tickets (`stockOf(items, SPEED_TICKET_ID)`) → `/town/exchange?row=speed-tickets`; Uma
  Tickets "2 · 3/5" → `/town/stable?tab=locked`; the Sync chip ("Offline", "Sync paused", or "Sync" in amber or red),
  hidden when synced → `/town/account?row=sync`, where T138's Sign in and Sync now sit. The `?row=` links are T138's.
  A changed number moves by a CSS transform and opacity transition, never a spring.
- **Bottom bar** (§2.2): Town Hall · Training · (RACE) · Farm · ☰. RACE is raised and opens `/racing`; the active page
  shows by shape as well as colour; only Farm and Training carry badges (`tabs`).
- **Menu** (`?sheet=menu`): every drawn place by page with its counter, then Account and `/town/stable/needs`.
- **Floating pill** (§2.3), right thumb zone above the bar, every page: "Collect all · N ready", else "Check-in · N
  free", else nothing. It opens `?sheet=check-in`, with `{ collect: true }` in navigation state for Collect all; T142's
  sheet does the rest. Each page pads its bottom so the pill never covers a tile at rest.
- **Overlay host:** a Peek is a non-modal sheet over the lower half, so the page stays live: the same tile again opens
  the Page, another swaps the Peek, and Back, ✕ or the handle closes it. Global sheets use today's modal `BottomSheet`.
  Focus moves into a sheet and returns to its tile.
- **Full-screen flows** (§6) hide both bars through a slot's `fullScreen(rest)`. T137 sets §6's (`racecourse`'s `run`,
  `observatory`'s and `gym`'s `:umaId`) and the reveal; T141 adds the promotion ceremony's.
- **Loading and errors:** a quiet frame while the port boots; a save that can't open says why with **Try again** and
  **Copy details**, and never offers to clear anything (ux "Principles").

**Pages and tiles.** A page is a CSS grid of its places' `cell`s and scrolls vertically when it doesn't fit, never
sideways (§12). A tile is one `Link` (to its Peek, or its Page when `direct`) of at least 96 × 96 pt covering sprite,
name pill, counter and pips, labelled with the VoiceOver line.
- The sprite is a 96 × 96 `div` on `@luismlorenzana/uma-art/buildings/atlas.png?url`, `background-size` twice the atlas,
  positioned from the index (imported in the lazy page chunk), `image-rendering: pixelated`. A `null` frame is a plain
  sunken 96 × 96 square with the name pill as usual.
- Pips (20 pt, `aria-hidden`) sit under the pill in up to two rows of four: busy is her face in a ring filled by
  `progress`; ready a full gold ring with a small bounce; queued a "+N" on the busy pip's shoulder; free a hollow ring.
  Gym and Dojo rings take their room's stat or card-type colour.
- Faces are today's private `face` art, loaded only for pips on screen, then the `uma-icons` outfit icon, then her
  initial.

**The featured Uma** (§5). The Town Hall plaza cell holds `profile.featuredUmaId`, or D181's first by
`lifetimeLevel`, and stays empty with no Umas. T137 draws her as still art in `g2/ui/UmaArt` (today's `chibi` `-a`,
then her bust, then her icon), and a tap opens `?sheet=featured`. The cell's content and the sheet are T138's slots:
its `FeaturedUmaCard`, and 11 §5's quick sheet (Train to her `/needs`, Race to `/racing/racecourse?uma=:umaId`,
Profile, Feature another Uma through T138's `UmaPicker` and `feature-uma` operation).

**Slots** (`g2/places/registry.tsx`, uma-rpg's pattern): `PLACE_UI[placeId] = { Peek?, Page?, subPages?, fullScreen?,
useCounter? }`, `SHEET_UI` (`check-in`, `featured`), `TOWN_PLAZA` and `FLOW_UI.reveal`, each component `React.lazy`.
- `Peek` gets `{ place }`, `Page` gets `{ place, rest }`. `subPages` maps `rest` patterns (`needs`,
  `outfit/:umaId/needs`) to components, so one task can own a sub-route of another's place.
- **Counters:** the hub view's `counts` are each place's default, so T138–T140 need no Counter of their own. A place's
  `useCounter`, a small hook outside the lazy chunks, overrides it where the rework state can't give the number
  (T141's Racecourse and Trophy Hall). A counter of 0 is hidden, so the bar stays quiet (11 §2.2).
- An unfilled slot shows the place's name, its blurb behind (i) and Enter. `g2/ui/PlaceHeader` is every Page's header:
  back, name, and (i) with the blurb and the place's own lines.
- Fillers: T138 Stable, Warehouse, Exchange, Card Library, Account, the plaza, the featured sheet and the reveal; T139
  the four facilities; T140 the ten Farm buildings; T141 the Racing places; T142 the check-in sheet and the Needs
  sub-pages.

**Code boundaries.** `g2/` imports only today's surviving generic pieces: the `ui/` primitives (Button, BottomSheet,
Panel, Row, Chip, Pill, SegmentedControl, Meter, Numeral, AtlasSprite, Placeholder), `ui/icons` and `defineIcon`,
`ui/motionFeatures`, `index.css`, `content/`, `auth/`, and for T141 `scenes/race/`. A test holds the allowlist and that
nothing outside `g2/` imports it; a task that widens it says why, and T143 keeps every listed piece. The shell runs
under `LazyMotion strict` with `m.*` only. Prize Money gets a new two-tone `CoinIcon` in `g2/ui/icons/`; Speed Tickets
use today's `TicketIcon` and Uma Tickets `UmaCouponIcon`, until uma-art draws `currency/*`.

**Dev mount.** `apps/web/g2.html` loads `src/g2/main.tsx` at basename `/dev/g2`; a dev-server plugin in
`vite.config.ts` (`apply: 'serve'`) answers `/dev/g2` and `/dev/g2/*` with it, so it never reaches `dist`. Like
today's isolated proofs it mounts no auth, content or service worker, so art falls back. `g2/dev/seed.ts` builds
synthetic accounts from `@racer/domain/rework/sim` (`createLoop` on `BASELINE`), picked by `?seed=`: `busy` (default;
day 3 at 08:00, 25 Umas with Ready, Free, queued and busy slots), `fresh` (a new account, 13 §5) and `quiet` (all
Working, nothing to collect). Later tasks add seeds (T142's `stopped`). The in-memory port runs every operation through
`recheck` on the seed and saves nothing; its clock starts at the seed's time and runs with real time.

**Budget.** `pnpm build` adds a measure-only build of `g2.html` (`vite build --mode g2-size`, no PWA) into the
gitignored `apps/web/dist-g2/`, checked by `scripts/check-size.mjs`, which takes the HTML name as a second argument.
The g2 entry holds the router, the shell's frame, the registry and the port's interface; the domain's rules, the port,
pages, places and sheets are lazy, so the frame paints first and counts fill in when the game chunk arrives.

**Reduced motion** is on when the system asks for it or Account's device switch (`uma-racer:g2:reducedMotion`, T138)
is set. The root applies it through Motion's `MotionConfig` and a `data-reduced-motion` attribute for CSS: no pip
bounce, no number transition, instant sheets (§12).

## Tests

- **Registry:** 23 places with §3's ids, routes, kinds and counters; one `direct`, one `hidden`; cells unique per page;
  Farm neighbours are Duo partners in uma-art's ring; `pips` exactly on the 14 `BuildingId`s.
- **Frames** (like uma-rpg's `frames.test`): every non-null frame is in the pinned 2.4.0 index on §10.1's atlas page;
  the nulls are exactly §10.3's four new buildings and absent from it, so a release that draws one fails until wired.
- **Hub view** on synthetic states: pip order and counts match the work rows; the Kitchen at Lv 2 shows eight pips and
  the Gym at Lv 2 seven and "+3" (§14); `ready` equals `readyCount`; `needsATap` counts Ready and Free; tab badges and
  counters; `itemProgress` from start times, within 0–1 with the clock moved either way.
- **Words and purity:** no banned word in names, blurbs, counter words, labels or copy; `hub/` reads no `Date.now`,
  `Math.random` or I/O.
- **Router** (memory router, same routes): every §7.2 row lands on its "After"; deleted paths, `/training/<umaId>`,
  `/cards/redeem` and unknown paths reach `/`; the start rule's three cases and the last page.
- **Shell** (Testing Library): the pill's three states, tab badges, chip links, a tile's label, Peek then Page on the
  second tap, `direct`, the menu's places, and no bounce under reduced motion.
- **Slots:** every place has a Page and, unless `direct` or `hidden`, a Peek, except a `PENDING` list each place task
  empties; T143 requires it empty.
- **Boundaries:** the import allowlist both ways; `dist/` holds no `g2/` module.

## Acceptance

- [ ] `@racer/domain/hub` exports the registry and `hubView`; `needsATap` and `itemProgress` are in their modules with
  tests.
- [ ] `@luismlorenzana/uma-art` is exactly `2.4.0` in `@racer/web`'s dependencies; `pnpm docs:update` leaves no diff.
- [ ] `pnpm lint && pnpm test && pnpm build` are green; the g2 measure build is ≤ 180 KB gzip; today's entry is the
  same size, and `main.tsx` and `app/router.tsx` are untouched.
- [ ] In the `uma-racer-dev` preview at 390×844 (mobile preset):
  - [ ] `/dev/g2/` opens Farm on `busy`, the Stable's Locked tab on `fresh`, and Town Hall (or the last page) on `quiet`;
  - [ ] each page shows sprites and the four plain tiles; Town Hall, Training and Racing fit without scrolling, and
    nothing scrolls sideways;
  - [ ] tiles measure at least 96 × 96 pt and bar controls at least 44 pt (`getBoundingClientRect`);
  - [ ] pips match the seed (initials, rings, gold Ready, "+N"), and each Ready badge equals its counter;
  - [ ] a tile opens its Peek, a second tap its Page; the Racecourse opens its Page at once; Back closes a Peek;
  - [ ] the pill reads "Collect all · N ready" on `busy` and is absent on `quiet`; each chip opens its place;
  - [ ] the plaza shows the seed's featured Uma (her initial, art falling back) and opens `?sheet=featured`;
  - [ ] `/dev/g2/stable/<id>/deck` lands on `/dev/g2/training/dojo/<id>`, `/dev/g2/puzzles` on the start rule's page;
  - [ ] with reduced motion emulated nothing bounces; the console shows no errors.
- [ ] The Decided here rows go into rework/11 §13 with one decisions.md entry, and this spec is deleted (D104).

**The manual.** The new app now imports the rework modules and `@luismlorenzana/uma-art`, so the manual's
"[The rework modules](../game/architecture.md#the-rework-modules)" section changes in this task: the `g2/` app beside
today's imports them; today's entry still doesn't; uma-art is a dependency of `@racer/web` and a dev dependency of the
domain.

## Out of scope

- Every Peek's and Page's content (T138–T142); the store, Dexie, sync and the wipe (T136); the API (T135).
- Making g2 the entry, the update prompt, the auth and content providers, and removing the dev mount, the measure
  build and `g2.html` (T143).
- The canvas maps, tiles, building positions, swiping between pages, the chibi's animation and the Hub chunk's
  one-second load (phase 6, §11); the new uma-art frames, crests and currency marks (uma-platform); push (phase 4).

## Decided here

| Choice | Why |
|---|---|
| A row carries a grid `cell` from §3's sketches; phase 6 adds map positions | §1's fractions place buildings on a canvas, which phase 3 doesn't draw (§11) |
| No lock field: every place is open | §3 marks every place Open; grade locks live inside places |
| A pip is Ready when she has anything to collect, a running batch's finished items included; the Ready badge, the counter and VoiceOver's "ready" are that one number | It is `readyCount`'s rule (02 §2), so a tile, the pill and Collect here agree |
| A busy ring shows the current item's progress (new `itemProgress`) | §4 names the current output's or unlock's progress; `progress` is the whole entry's |
| The start rule counts Umas Ready or Free (`needsATap`) | 02 §7's count; §2.4's "Waiting" is no status in 01 §2 |
| One 30-second clock, stopped while hidden, for pips and labels | §4's 30 seconds; 02 §8's labels are cut to the minute anyway |
| The Uma Tickets chip shows Shards as n/5, held at 5/5 in gold once a ticket can be made | The exchange is the owner's tap in the Stable (04 §6), so Shards can pass 5 |
| "Sync paused" means signed out | Sync waits for a token; T136's own states are offline and error, and §2.1 names a paused chip |
| Currency icons: a new two-tone coin, today's ticket and Uma coupon icons | §10.3's marks aren't in 2.4.0; the visual system wants two-tone currencies |
| A Peek is a non-modal half sheet; the same tile again opens the Page | §1's "tap once, again for the Page" needs the tile in reach |
| Global sheets are `?sheet=` routes; Collect all's intent rides in navigation state | Back closes them, and a reload never collects again |
| T137 places the featured Uma (cell, still art, sheet route); her card, sheet and picker are T138's | Animation is phase 6 (§11); the profile, picker and `feature-uma` are the Stable's |
| Faces are today's `face` art, then the outfit icon, then her initial | `character-faces` is phase 5's release; today's content stays until then (M034) |
| Full screen is a slot's `fullScreen(rest)`; places take sub-page slots | §6's flows live inside place routes; the Needs views (T142) live under the Stable (T138) |
| The hub view's counts are every place's default Counter; `useCounter` overrides one; 0 is hidden | One rule per counter, and only T141's two need data outside the work engine |
| The dev mount is `g2.html` at `/dev/g2/*`, by a dev-only rewrite, over `rework/sim` seeds | M034: nothing in today's entry imports `g2/`; seeds stay synthetic |
| The g2 budget is checked from now, by a measure-only build | An overrun found at T143 would come too late |
| `g2/` imports only today's surviving generic pieces, held by a test | T143 deletes the rest in one change |
| The shell reads the game through `G2Game`; T136 plugs its store into `boot.ts` | T137 lands before T136 (M034: "Needs —") |
| uma-art goes in `dependencies`, exactly 2.4.0; the domain keeps its dev dependency | The web bundles its images; the domain only tests ids |
