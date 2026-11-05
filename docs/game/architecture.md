# Architecture

The code as it runs: generation 3, released as M036 (D381–D388). The infrastructure values and the release runbook are
[technical/infrastructure.md](../technical/infrastructure.md); what's done and what comes next is
[the task plan](../tasks/README.md).

Uma Racer reuses the **uma-planner** architecture (`../uma-planner`): a TypeScript pnpm/Turbo monorepo, a React SPA on
Firebase Hosting, a NestJS API on Cloud Run, Firebase Auth with an owner email allowlist, and Firestore. What a game
adds is **local-first state**, **rules that run on the device and again on the server** (the operations, the stages'
replays and the races), **client-side race simulation** and a **private content pipeline**.

| Area | uma-planner | Uma Racer |
|---|---|---|
| Monorepo | pnpm workspaces + Turbo, `tsconfig.base.json` | Same |
| Web | React, Vite, React Router, TanStack Query, Tailwind | Same stack, current majors: React 19, Vite 7, React Router 7, TanStack Query 5, Tailwind 4 |
| API | NestJS, `AuthGuard` (Firebase ID token + `ALLOWED_EMAIL`), `AUTH_MODE=disabled` locally | Same pattern, NestJS 11, with uma-server's guard |
| Persistence | Repository interface with a local JSON file (dev) or Firestore (prod) | Same pattern, for the save |
| Reference data | GameTora JSON importers | uma-platform's verified releases through `uma-data`, one racer adapter (SE1) |
| Deploy | GitHub Actions with keyless OIDC: Artifact Registry → Cloud Run → Firebase Hosting, smoke checks | Same workflow, in the `uma-racer` project |

## The repo

A pnpm 10 workspace with Turbo, on Node 22, in strict TypeScript.

| Path | What |
|---|---|
| `packages/domain` (`@racer/domain`) | Every game rule, pure with no I/O ([below](#the-domain-package)). Vite, Vitest and `tsc` read its TypeScript source; `pnpm --filter @racer/domain build` also emits a CommonJS `dist/cjs` that the API imports |
| `packages/race` (`@racer/race`) | The deterministic race engine: a seeded RNG (never `Math.random`), one-second turns recorded as a timeline at 15 samples a second, which the scene plays back. Its build emits a CommonJS `dist/cjs` too, for the API's races ([below](#the-race)) |
| `apps/web` (`@racer/web`) | React 19, Vite 7, Tailwind 4, Motion (`m.*` under `LazyMotion strict`), Zustand + Dexie, uma-kit's theme, shell, Hub map (Phaser 4, lazy) and primitives, the two games' views, PixiJS 8 for the race scene only, a PWA ([below](#the-web-app)) |
| `apps/api` (`@racer/api`) | NestJS 11 on Cloud Run: the auth guard, generation 3's save and sync, the master and content proxies ([below](#the-api)) |
| `scripts/overlays` (`@racer/overlays`) | The racer's private flair and card-focus overlays, their publishing, the master parity check, and the local release reader the sims use; no GameTora or image importer (SE1) |
| `scripts/sim` | Headless balance runs (`pnpm sim:*`, [below](#the-balance-sims)) |
| `scripts/check-size.mjs` | The startup JS budget and the dev-module check ([below](#budgets-and-checks)) |
| `infra/` | GCP bootstrap and GitHub Actions notes |
| `.github/workflows/deploy.yml`, `apps/api/Dockerfile`, `firebase.json` | CI, the API image and Hosting ([below](#ci-and-deploy)) |
| `docs/` | The manual (`game/`), design, plans, tasks, technical, research and the handoff packets ([README](../../README.md#documentation-map)) |

```mermaid
flowchart LR
    subgraph iPhone["iPhone · Home Screen web app"]
        SW[Service worker<br/>app shell + atlases]
        UI[uma-kit shell and racer places<br/>Motion]
        Hub[uma-kit Phaser Hub map<br/>uma-art tiles and buildings]
        Games[Stage host<br/>Training Yard · Furlong Hand views]
        Scene[PixiJS race scene]
        Store[useSave · Zustand]
        IDB[(Dexie uma-racer-g3<br/>kind tables, outbox, stage journal)]
        Rules[@racer/domain + @racer/race<br/>run on device]
        UI <--> Store
        Games --> UI
        Scene --> UI
        Hub --> UI
        Store <--> IDB
        Store --> Rules
        Games --> Rules
    end
    subgraph GCP["GCP project uma-racer"]
        Hosting[Firebase Hosting<br/>SPA]
        Auth[Firebase Auth<br/>owner allowlist]
        API[Cloud Run · NestJS<br/>re-runs every operation]
        FS[(Firestore<br/>g3/uid)]
        GCS[(Cloud Storage · private<br/>racer overlays)]
        Master[(uma-platform<br/>master release)]
    end
    SW -.install/update.-> Hosting
    IDB -- one sync lane --> API
    UI -- content files --> API
    API --> FS
    API --> GCS
    API --> Master
    UI -. sign-in .-> Auth
```

## The domain package

`@racer/domain` holds every rule as a pure function: no I/O, `Date.now`, `Math.random`, timers, React, Dexie or
browser globals. An operation's time comes in on its envelope, integer milliseconds, and is only stamped on what it
writes: no rule reads a clock, and nothing runs on a duration. Randomness comes from seeded RNGs passed in: a race's
(`raceRng`), a stage's (`stageRng`).

### The domain's exports

| Import | For | Resolves to |
|---|---|---|
| `@racer/domain` | The core kept through the restart: the vocabulary (`types.ts`), the fifteen scenarios and their eras (`scenarios.ts`), content contracts (`content.ts`), the race catalogue, series and attempt (`race-catalog.ts`, `race-series.ts`, `race-attempt.ts`: the seed, field size, best strategy and replayable run), race skills and their tags (`race-skills.ts`, `skill-tags.ts`), pack coefficients and course layouts (`race-pack.ts`, `course-layout.ts`), the rivals' roll and casting (`opponents.ts`), her own skills (`derived.ts`), cards' golds and Race Bonus (`cards.ts`), card focus (`card-focus.ts`), and the career generator with its shapes (`scenario-goals.ts`, `career-shapes.ts`, `career-stages.ts`) | `src/index.ts`; `dist/cjs/index.js` under `require` |
| `@racer/domain/account` | Tickets, `unlock-uma`, `unlock-card` and `dev-grant` ([02](02-unlocks.md)) | `src/account/index.ts` |
| `@racer/domain/build` | The deck and posting, the facility table and the session formula, the tree and its previews, bond tracks, skills, the racing build, card power, and `sim:decks`' core ([05](05-the-build.md), [06](06-cards-and-bonds.md)) | `src/build/index.ts` |
| `@racer/domain/career` | The calendar and placement, the season machine, starting a career, races and the URA Finals on the engine, rewards, the stages' pay table, and `sim:careers`' core with its invented content ([03](03-careers.md), [12](12-pacing.md)) | `src/career/index.ts` |
| `@racer/domain/stages` | The stage framework: the contract, grades and pay, the seeded dice, replay and settle, the registry, configs, `settle-stage` and `sim:stages`' core; its two games, `yard/` (Training Yard) and `furlong/` (Furlong Hand), each rules and three bots ([07](07-stages.md), [08](08-training-yard.md), [09](09-furlong-hand.md)) | `src/stages/index.ts` |
| `@racer/domain/save` | Generation 3's save: kinds, stamps and bounds, records, rows, strict parsers, the operation registry and `commitOperation`, the wire format, a new account's rows (`initialSave`) and the operations' env (`buildOperationEnv`) ([below](#the-save-and-sync)) | `src/save/index.ts` |
| `@racer/domain/master` | The only master-to-racer adapter, flair and card-focus interpretation and the overlay envelopes ([below](#private-content)) | `src/master/index.ts` |
| `@racer/domain/tiers` | The tier map, the caps and SP caps (`scaling.ts`), and the rivals by scenario and season (`rivals.ts`) ([04](04-tiers-and-scenarios.md), [Racing](racing.md)) | `src/tiers/index.ts` |
| `@racer/domain/hub` | The place registry (`PLACES`, `AWAITING_ART`), the Hub's view of the account (`hubView`), the shell's words and a card's effect words ([11](11-hub-and-places.md), [02](02-unlocks.md)) | `src/hub/index.ts` |

Every entry has a `require` condition (`dist/cjs/<area>/…`) beside `default` (the TypeScript source). The API resolves
with Node16 rules, so it takes `require` and reads the built CommonJS; everything else reads the source. Turbo builds the
domain before any package's `lint`, `test`, `build` or `dev`. After changing a domain rule while `pnpm dev` runs,
restart it so the API picks up the rebuilt `dist`.

### The rules every area follows

- **Pure**, as above. `save/`, `career/` and `stages/` each hold a purity test that reads their source for clocks,
  dice, I/O and browser globals. The stages go further: integers or `+ − × ÷` only (no `Math.pow`, `**` or
  `Math.sin`), so a play replays alike on the phone's JavaScriptCore and the server's V8, pinned by golden hashes.
- **Every change is an operation.** Each area defines its operations in its own `ops.ts`, as a parser and an `apply`
  `(state, input, env) → { state, receipt } | Refusal`; a refusal carries plain words, never protocol names.
  `save/operations.ts` joins them into one table, and `commitOperation` runs one: the device and the server call the
  same function.
- **The engine is handed in.** The domain never imports `@racer/race`: a race runs on `OperationEnv.race`
  (`{ version, simulate }`), which the web and the API each fill with engine v9's `simulateRace`.
- **Numbers are named constants** citing their page, pinned by tests beside the modules and in `domain.test.ts`. A
  number changes only with its page, its test and a decision entry.
- **Real card values never enter git.** Rules read the cards' effects from the private pack at run time; the tests,
  the fixtures and `--synthetic` sims run on invented cards (`src/__fixtures__/`, `build/decks.ts`'s `syntheticCards`,
  `career/synthetic.ts`).
- **Synthetic fixtures only.** No master data, names or ids from the private packs; the fixtures are
  `src/__fixtures__/<area>.ts`.
- **The live manual.** Each area exports `LIVE_BLOCKS` from its `docs.ts` (`build`, `career`, `stages`, `tiers`,
  `hub`); `src/docs/render.ts` joins them as `AREA_BLOCKS` beside the manual's own keys (the rivals and the
  dependencies), and `src/docs/docs.test.ts` checks every page of `docs/game/` against them. `pnpm docs:update`
  rewrites the blocks.

### The balance sims

`scripts/sim` runs the rules headless from the repo root (`pnpm sim:*`). Each reads the private pack when it is present
locally (`MASTER_DIR`, else sibling `uma-platform/content/release`; the racer overlay from `CONTENT_DIR`), and prints
aggregates only: never an Uma, card, skill or race id, name or value. `--synthetic` runs on the invented content, as CI
does.

| Script | Checks | Exits 1 when |
|---|---|---|
| `pnpm sim:balance` | The engine's strategy balance on synthetic fields (`--final` for the full matrix) | — (a report) |
| `pnpm sim:decks` | Every pip bought with an empty, a median bonded and a strong bonded deck, as shares of the cap budget ([05](05-the-build.md) §10); the domain's tests run it on invented cards in CI | A band drifts, or a deck caps all five stats |
| `pnpm sim:stages` | Every built mini-game's novice, competent and expert bots over 500 seeds on a typical career's configs ([07](07-stages.md) §6); `--seeds=`, `--kind=`. `pnpm test` and `test:ci` run it with `--synthetic` | The competent median isn't A, the novice's isn't C or B, the expert's S share leaves 35–65%, or a play leaves 3–7 minutes (Furlong Hand 3.5–6.5) |
| `pnpm sim:careers` | Every Uma's URA Finale career played once at grade A by a fixed bot, with a median and a strong deck, its objectives and URA Finals rounds raced on the engine ([12](12-pacing.md) §3); `--attempts=`, `--umas=`. `pnpm test` and `test:ci` run it with `--synthetic` | A first-try rate or a pacing band misses its target |

`sim:balance` and `sim:decks` run on `pnpm dlx tsx`; `sim:stages` and `sim:careers` on `@racer/overlays`' own `tsx`, so
CI needs no download. Run them after changing a rule they read, and on the private pack before each release.

## The web app

`apps/web/src`, mobile first at 390×844:

| Folder | What |
|---|---|
| `main.tsx` | The entry: uma-kit's setup (`app/kit.ts`), TanStack Query, uma-kit's auth provider with the game's Firebase config (`app/auth.ts`; Firebase lazy), the content provider, the kit's motion root and art provider, the session, the live router (the routes inside the kit's `BootGates`) and the kit's update prompt (`watchAppUpdates`, `UpdateNotice`) |
| `index.css` | Tailwind, then uma-kit's `theme.css` (the tokens in light and dark, the base styles and utilities) with Tailwind reading the kit's classes, then what is uma-racer's own: the fonts and the race feed's keyframes ([below](#uma-kit)) |
| `app/` | uma-kit's setup (`kit.ts`: the device-key prefix and Appearance at boot) and the art it draws with (`art.ts`, `albumArt.tsx`), the router (`router.tsx`, `routes.tsx`), the start rule (`start.ts`), getting in (`auth.ts`, `gates.tsx`), the root's save-error panel (`Root.tsx`), the session (`session.tsx`), the game port (`game.ts`, `RacerGame`), its provider (`GameProvider.tsx`), its lazy boot (`boot.ts`) and the rules it runs (`rules.ts`, `hubView`), the content the art reads (`content.ts`), the content runtime (`contentRuntime.ts`), scroll restore (`scroll.ts`) and the build id (`build.ts`) |
| `hub/` | The racer's adapters to uma-kit's shell and Hub ([11](11-hub-and-places.md) §1–§2, [below](#uma-kit)): `RacerShell.tsx` (the kit's frame, account bar and bottom bar with the ticket chips, the Sync chip and the tabs), `HubPage.tsx` (the kit's map with each page's places and counters and the plaza), `PlazaFigure.tsx`, `racerHub.ts` (each page's tile page and palette), `PlacePeek.tsx` (the kit's side panel with the registry's Peek), the menu (`GlobalSheets.tsx` on the kit's sheet and place menu, `SheetHost.tsx`), the paths into the places (`nav.ts`) and the counters (`counts.ts`) |
| `places/` | Every place's Peek and Page, filled through `places/registry.tsx` (`PLACE_UI`, each a lazy chunk, with sub-page slots and a full-screen rule): `stable`, `card-library`, `account`, `career` (the Careers place and every career's screens: the career page, Upgrade, a play, a race's run), `training-yard` and `furlong-hand` (the stage hosts as practice). `PlacePageHeader.tsx` is the kit's place header with a place's words, `PeekStat.tsx` a Peek's line, and `Unfilled.tsx` the fallback for a place with no Page (none today). Each screen draws a pure view model (`model.ts`) over the rules' state |
| `stages/` | The stage host (`StageHost.tsx`: the rule card, the journal, resume, settle and the result; `session.ts`, `ids.ts`, `wakeLock.ts`), the games' lazy views and rule cards (`views.ts`), and each game's view, DOM and Motion with no canvas (`yard/`, `furlong/`) ([07](07-stages.md) §5) |
| `race/` | The run screen's pieces kept from the old Racecourse: the race feed (`RaceFeed.tsx`), the bust sizing, the playback busts (`art.ts`) and the labels |
| `scenes/race/` | The race scene: PixiJS 8, lazy, the only PixiJS in the repo ([below](#the-race)) |
| `save/` | The device's generation-3 save and its one sync lane ([below](#the-save-and-sync)) |
| `content/` | The game-only projection of the master release (`adapt.ts`), the view shapes (`view.ts`), the content provider and its diagnostics; no loader or byte cache of its own |
| `ui/` | The racer's own small pieces: type, focus and race-mark icons, art tiles and the art viewer, `BuildFacts`, `BuildingSprite`, `AtlasSprite` (the kit's), labels and words, device preferences (`devicePrefs.ts`) and the card art hook (`useContentArt.ts`) |
| `__fixtures__/` | Test support (`testing.tsx`, `memory.ts`, `content.ts`, `kit-setup.ts`); `save/`, `stages/` and `places/career/` keep their own |

- **One store for game state:** `useSave` (Zustand), read through selectors and fed only by Dexie commits. Device
  conveniences (the last page and career, the album views, Appearance, reduced motion, race speed, the season's
  settled plays) are `uma-racer:g3:` localStorage keys and never sync. TanStack Query is for network data only.
- **One port.** The shell and every place read the game only through `RacerGame` (`app/game.ts`): status, the save's
  state, the operations' env, sync, receipts and notices, `run` for a tap (one operation through `commitOperation`,
  answered done or refused in plain words), `logs` for race results, receipts and an operation's own row, `journal`
  for the device-only stage journal, and `now` for an operation's time. Every tap holds the update prompt's restart
  until it commits (uma-kit's `criticalAction`). `GameProvider.tsx` also keeps a 30-second display clock
  (`clock.ts`, `useNow`) that stops while the page is hidden; no screen reads it, and nothing writes on it.
- **Getting in** is uma-kit's `BootGates` (SD4, `app/gates.tsx`), in both games' order: the splash, Google sign-in
  while nobody is signed in, the boot, then the start page (`start.ts`), opened once and only when the app was opened
  at `/`: her career page while the career last viewed still runs, else the last page viewed, else Town Hall. The
  tests render the routes without the gates.
- **The session** (`app/session.tsx`) is the gates' boot: it waits for the private content (operations need its env),
  opens the device save on it and waits for its first snapshot. A boot that stops shows the content diagnostics' words,
  or the save's, and its button does what helps: Try again reloads the content, Switch account (a Google account that
  isn't the owner's, 403) signs out to the sign-in gate, and a save that couldn't open reloads the page. Signing out
  (Account's last row) returns to the sign-in gate; with auth off (local dev) nobody signs in and the phone acts
  signed in.
- **Lazy by default.** The entry holds the router, the shell's frame and bars, the place registry and the port's
  interface; the rules, the save, Dexie, Firebase, the Hub map and Phaser, each game's view and rules, the race engine
  and scene, and every page and sheet load on demand.
- **What uma-kit draws carries `data-kit`** (`frame`, `account-bar`, `bottom-bar`, `page`, `place-targets`, `plaza`,
  `peek`, `side-panel`, `sheet`, `place-header`, `place-menu`), for tests.

### uma-kit

The shell, the Hub map and the primitives are **`@luismlorenzana/uma-kit`**, uma-platform's package that uma-racer and
uma-rpg both run on (uma-platform P48, its sibling plan; D367). Its components take values, words and links as props,
and keep no game state. uma-racer pins it exactly (0.9.1, from GitHub Packages like uma-art) and passes everything that
is its own in as props. The API's guard and proxies are its sibling, `@luismlorenzana/uma-server` ([below](#the-api)).

| From uma-kit | Stays uma-racer's |
|---|---|
| `theme.css`: the Paddock tokens in light and dark, base styles, utilities (`pt-safe`, `pb-safe`, `pb-bar-safe`, `mb-bar-safe`, `scroll-strip` …), and `fillScreen()` for iOS 26's Home Screen viewport | The fonts' `@font-face` and the race feed's keyframes (`index.css`) |
| `/ui`: the icon set, `UiMark`, `Button`, `Chip`, `Tabs`, `Panel`, `BottomSheet` and `Sheet`, `AnimatedNumber`, `MotionRoot`, reduced motion, Appearance, device preferences, `KitArtProvider` | Type, focus and race-mark icons, `BuildingSprite`, `BuildFacts` |
| `/roster` and `/album`: the album query engine (`runAlbumQuery`), its preference parsers, `AlbumChrome`, `VirtualGrid`, `UmaPicker`, `useAlbumPrefs`, `AlbumArtProvider`, `FaceTile`, `UmaBust`, `UmaChibi` | The Stable's facets and sorts, the Library's icon filters, rows, marks and words; the private art ids (`app/albumArt.tsx`), loaded and held by `/content` |
| `/content` (SE4): `createContentRuntime`, snapshot and cache verification, held art hooks and URLs, `AtlasFrame` | The master-to-game projection (`content/adapt.ts`, on `@racer/domain/master`), the required overlay, the game's content port and diagnostics; auth and storage keys passed as options |
| `/shell`: `AppFrame`, `AccountBar`, `BottomBar`, `PlaceMenu`, `PeekPanel`, `PlaceHeader`, and `withParam`, `navState`, `useLeave`, `peekPath` | `RacerShell` (the ticket chips, the Sync chip, the tabs, the menu's `?sheet=` link), the menu and its host, `PlacePeek`, `PlacePageHeader`, the paths into the places (`hub/nav.ts`) |
| `/hub`: `HubMap` (the lazy Phaser canvas, the place links, swipes), the grid, `layTerrain`, the tile props, palettes and markers | Which places stand on which page and where (`@racer/domain/hub`, `AWAITING_ART`), `tilePageFor` (the ground each page draws), the Town Hall plaza, the counters (`counts.ts`) |
| `/auth`: `AuthProvider` (Google sign-in by redirect, Firebase loaded only by `import()`), `useAuth`, `idToken`, `signIn`, `signOut` | The Firebase config (`app/auth.ts`) |
| `/places` (SD4): `BootGates`, `UpdateNotice`, `watchAppUpdates` and `criticalAction`, `AccountPage`, `ProfileFrame` | Their content: the start rule and the boot's words; Account's wallet, sync, Appearance, reduce motion, race speed and dev section; her profile's sections |

- **Setup** (`app/kit.ts`, called first in `main.tsx`): `configureKit({ storagePrefix: 'uma-racer:g3:' })` puts the
  kit's device keys beside the game's own, so Reduce motion is `uma-racer:g3:reducedMotion` and Appearance
  `uma-racer:g3:appearance`. `app/kit.test.ts` pins the keys. `initAppearance()` then puts the stored Appearance on
  `<html data-theme>` before the first render. Tests get the same prefix from `__fixtures__/kit-setup.ts`.
- **Art:** the kit imports no images. `app/art.ts` hands it uma-art's `ui`, `tiles` and `buildings` atlases (each a
  `?url` image and its JSON index) through `KitArtProvider`; a mark or frame the atlas lacks falls back (a `fallback`
  node, or a code-drawn building).
- **Album art (SB6):** `GameProvider` installs the kit's `AlbumArtProvider` with `app/albumArt.tsx`, which reads the
  loaded content and holds verified URLs until unmount: face → the outfit's `face`, bust → its `bust`, plaza → its
  standing chibi then its bust; icon → the `uma-icons` atlas.
- **Dark mode:** the theme's tokens have the same names in both modes, so a screen drawn in tokens works in both.
  Account's Appearance (System, Light, Dark) is the kit's `setAppearance`, kept on this phone. Text on the gold accent
  is `text-accent-ink`, a dark surface that stays dark is `bg-stage` or `bg-scrim` (never `bg-ink`, which turns light),
  and the PixiJS race scene keeps its own palette ([visual system](../design/visual-system.md#dark-mode)).
- **Vite:** `resolve.dedupe` keeps the kit's peers (React, React DOM, React Router, Motion, Phaser) on this app's
  copies; Vitest runs the kit through Vite (`test.server.deps.inline`) so `hub/hub.test.tsx` can stand in for its lazy
  Phaser game.
- **Changing the kit:** never fork a kit component here. A change is made in uma-platform's `packages/kit` and released
  as a new version with a changeset, by the uma-rpg session or a uma-platform session; this game then pins the new
  version. To try a change first, link the kit locally (`pnpm link`, or a `file:` override), and never commit the link.

### Routes

The live router ([11](11-hub-and-places.md) §7) has no basename:
- `/` is the start rule (above).
- `/:page` is a page's map (`town`, `career`), with `?peek=:place` for a Peek in the side panel and `?sheet=menu` for
  the menu, so Back closes either.
- `/:page/:place/*` is a place: its sub-page slots, then its Page with the rest of the path. The career's screens are
  sub-routes of `/career/careers/:careerId` (`upgrade`, `play/:kind`, `race/:id`).
- **Retired and unknown paths** go to `/`, as `app/router.test.tsx` pins; saved data holds no paths.

Every route, query and sheet, as a tree from page to place to sub-page, is
[11's menu tree](11-hub-and-places.md#the-menu-tree-at-a-glance).

### Dev builds

There are no dev seeds and no dev-preview step (D380, D381): the owner tests in production. What dev builds add:
- **Hooks** (dev builds only, every route): `window.__hub` (the Hub's Phaser game, uma-kit's `debug` hook: `scene`,
  `game`, `paused`), `window.__raceScene` (the run's scene: `seek`, `skipToEnd`) and `globalThis.__racerSave` (the
  device save's port). `?canvas` on any page forces Phaser's Canvas renderer.
- **`dev-grant`** in Account's dev section (+5 Uma Tickets, +5 Card Tickets), which the local API runs only with
  `DEV_OPERATIONS=true`.
- `pnpm dev` serves web on 5173, proxying `/api` to the API on 8080 (`API_PROXY_TARGET` points it elsewhere), and the
  API keeps its save in `apps/api/.data/save-g3.json` with `DEV_OPERATIONS=true`.

## The save and sync

Generation 3 is one save in one shape, with no migrations (D381): five entities, two logs and operations in one sync
lane. The record shapes, kinds, bounds and wire format are `packages/domain/src/save/` (`records.ts`, `kinds.ts`,
`wire.ts`).

- **The kinds:**
  - entities `account/main`, `umas/{outfitId}`, `cards/{cardId}`, `careers/{umaId}:{T}` and
    `bonds/{umaId}:{tier}:{cardId}`, each versioned;
  - logs `raceResults/{opId}` and `operations/{opId}`, written once.

  The device writes no rows of its own: every row changes by an operation, or by the create that makes a new account
  (20 Uma Tickets, 24 Card Tickets).
- **Every change is an operation** with an id chosen before the tap is written. The device applies it at once with
  `commitOperation` and queues it; the API re-runs the same function on its own rows and commits, or refuses with the
  same plain words. A retried id returns its first receipt and is never applied twice.
- **The operations** (`save/registry.ts`, `save/operations.ts`), each in its area's `ops.ts`:
  - `account`: `unlock-uma`, `unlock-card` and `dev-grant` ([02](02-unlocks.md), D381);
  - `build`: `set-deck`, `post-card`, `buy-pips`, `pour-bond` and `buy-skill` ([05](05-the-build.md) §9, D382);
  - `career`: `start-career`, `run-race`, `next-season` and `run-finale` ([03](03-careers.md) §7, D383). A race runs
    inside its operation on `OperationEnv.race`, so the device and the API each run the same seeded race; without an
    engine, the races refuse;
  - `stages`: `settle-stage` ([07](07-stages.md) §3, D384): a play's seed and moves, replayed on the device and the
    API through the game's rules, graded and paid into the career's wallet.
- **Stamps:** every request and response carries protocol 3 and generation 3; anything else is 426.
- **On the device** (`apps/web/src/save/`):
  - Dexie `uma-racer-g3`, schema version 1: one table per kind, the outbox, and the device-only `stageJournal` (an
    open play's moves, written on every move and on pause, so it resumes by replay: [07](07-stages.md) §4);
  - the store is a fold of the outbox over the confirmed rows (`fold.ts`), so a refused tap rolls back with a notice;
  - one sync lane (`sync.ts`): a write flushes 1.5 s after the last, hiding the app flushes at once, showing it or
    coming back online flushes and pulls; failures retry after 5 s, 30 s and 2 minutes, then every 5 minutes while
    visible; a 426 stops the lane until the app restarts, and a 409 boots the device afresh;
  - **the generation-2 wipe:** before g3 opens, the first boot deletes the `uma-racer-g2` database and every
    `uma-racer:g2:` key once (`wipeGeneration2`, marked by `uma-racer:g3:wiped-g2`): the owner's intended full wipe
    (D380).
- **On the server** (`apps/api/src/save/`): `g3/{uid}/{kind}/{id}` in Firestore; one sync is one transaction with
  every read before the first write. Local dev keeps one file, `apps/api/.data/save-g3.json`.
- **Generation 2's server rows** (`saves/{uid}/…`) were deleted at the release (T159), with no backup.

## The API

| Route | What |
|---|---|
| `GET /api/health` | Liveness. The only route without auth |
| `GET /api/save` | A page of the save's rows since `since` (protocol and generation as query parameters) |
| `POST /api/sync` | The outbox in order: the create (only first) and operations, each answered in order |
| `GET /api/master/*path` | uma-platform's schema-major-1 channel, manifests and immutable release files |
| `GET /api/content/*path` | Only `overlay.json` and `overlays/racer.<hash16>.json` from the private racer bucket |

- **Auth.** Every route except health (`@Public()`) sits behind `@luismlorenzana/uma-server/auth`'s `AuthGuard`, both
  games' (SD4): a Firebase ID token whose email matches `ALLOWED_EMAIL`. No token or an invalid one is 401, a valid token
  for anyone else 403, and Firebase Admin failing to start 500. In development, `AUTH_MODE=disabled` lets every request
  in as `local-dev`.
- **Stamps.** The save's two routes run the guard, then the stamp: anything but `protocol: 3` and `generation: 3` is
  426 with nothing read or written, so a stale app can't write. Bodies are checked by the domain's parsers (400).
- **Operations run on the same adapter as the browser:** `OperationContent` (`save/operation-content.ts`) reads the
  verified release and the required private overlay through `MasterContent`, then `buildOperationEnv` with the race
  engine. Its cache key is both release versions, `${manifest}:${overlay}`, exactly as the device's, so race seeds
  agree on both sides; mutable pointers are re-read at most once a minute. Failure gives 503 before any save write.
- **Races on the server.** `@racer/race` is a runtime dependency: the API imports its CommonJS build (`dist/cjs`) for
  `simulateRace`, as it does the domain's, so `run-race` and `run-finale` settle on the same engine the phone ran.
- **`dev-grant`** runs only when the API starts with `DEV_OPERATIONS=true`. `pnpm dev` and `pnpm api` set it through
  the API's package scripts; no deploy, Dockerfile or Cloud Run setting does, so production refuses it.
- `app.module.test.ts` holds the API to exactly these five route patterns; HTTP tests pin both proxy guards and
  allowlists.
- **Modules** (`apps/api/src/`): `AppModule` imports a global `ConfigModule`, uma-server's `AuthModule` (`authModule()`:
  the guard on every route, its options read from `AUTH_MODE` and `ALLOWED_EMAIL`), `SaveModule` and uma-server's
  `ReleaseProxyModule` and `PrivatePackModule` (`master/master.module.ts`, configured after dotenv loads), and serves
  `HealthController`. `SaveModule` (`save/`) holds `SaveController`, the repository `PERSISTENCE` picks
  (`FirestoreSaveRepository` at `g3/{uid}`, or `LocalSaveRepository` at `LOCAL_SAVE_FILE`, default `.data/save-g3.json`
  under the API's folder), both on the pure `resolve.ts`, and `OperationContent`. A row whose data nests an array in an
  array is stored as JSON text (`firestore-codec.ts`, D151). `main.ts` puts every route under `/api`, takes JSON bodies
  up to 5 MB and allows CORS from `ALLOWED_ORIGIN`.

## Private content

- **One shared source (SE1):** `@luismlorenzana/uma-data` **1.1.0**, following schema-major-1's `latest` channel.
  Master data and original Uma and card art come from uma-platform. `@racer/domain/master` is the only interpretation:
  stable string ids, five-star stats, Global mechanics, SSRs and their real effects, Race Bonus, regular venues, career
  families and overlays. New facts and entries follow the release without changing saves or game rules.
- **Real card values** are read from the pack at run time, on the device and on the server, and are never written to
  git, a test or a doc.
- **Overlays** Claude keeps in the gitignored `content/overrides/`: `flair.json` (race-series legs and the ten main
  venues, D107) and `card-focus.json` ([06](06-cards-and-bonds.md)). Overlay validation resolves every private
  reference; git holds only semantic tags, aggregate coverage and synthetic fixtures.
- **Art identity:** faces are platform `outfit-faces` by outfit id. Busts use `outfit-busts`, plaza chibis
  `outfit-chibis` (standing suffix `-a`), portraits `outfit-portraits`, cards `support-card-art`. Atlas families map to
  the game's content port; scenario ids map by release date to the racer's.
- **Publishing:** `pnpm overlays:import` validates private authored inputs and writes an immutable hashed overlay plus
  `overlay.json`. `pnpm overlays:publish -- --dry-run` verifies bytes; publishing uploads the index last with generation
  preconditions. The racer never imports or republishes master data or art. Only these overlay paths are allowlisted.
- **Shared device loading (SE4):** uma-kit's `/content` owns authenticated transport, complete snapshots, verified
  byte caching, held URLs, cancellation and atlas rendering. `app/contentRuntime.ts` configures it lazily;
  `content/ContentProvider.tsx` projects its query and status into the session and installs the kit's provider.
  `content/adapt.ts` requests the release's sets and art and the required overlay, then runs the one pure adapter into
  game views. Atlas pages load at boot; image families load on demand. The album art, the card art and race playback
  use the same client.
- **Persistence:** every immutable byte (the enveloped overlay included) is size- and full-SHA-256-checked on download
  **and on a cache hit**. Only a complete boot becomes last-good, under `uma-racer:g3:master-release`. Cache Storage is
  `uma-racer-master-v1`, keyed by `https://uma-racer.invalid/master/<full-sha256>`, kept from generation 2 so bytes
  already verified on the phone are reused. Held URLs stay valid while displayed or played.
- **Offline:** the runtime cold-starts on the last complete release and reloads previously viewed art from persistent
  bytes. Corrupt cache hits repair online; partial or corrupt downloads never replace last-good state. A 401 or 403
  never bypasses auth by falling back. A first-time missing image keeps its icon or initial.
- **Sources:** production reads `uma-platform-master-data` and the racer's private overlay bucket through uma-server
  0.2.0's proxies. Locally `MASTER_DIR` defaults to sibling `uma-platform/content/release` and `CONTENT_DIR` to the
  root `content/`; `CONTENT_SOURCE=gcs` selects the buckets.
- **Parity:** `pnpm master:parity` compares the racer's final packs field by field; private details stay gitignored,
  only aggregates go in the [acceptance note](../research/se1-master-data/README.md).

## The art

Two sources, kept apart:
- **Original pixel art** is uma-platform's `@luismlorenzana/uma-art`, drawn from code and public to the owner's games.
  The racer pins **2.10.0** exactly: a runtime dependency of `@racer/web`, which bundles its atlases, and a dev
  dependency of `@racer/domain`.
- **Uma art** (icons, busts, faces, chibis, portraits) and card art are the original game's, so they come only from
  the private platform release ([above](#private-content)). Every board and screen draws in it: the Yard's face tiles,
  Furlong Hand's Partners and rivals, the race's busts.

| uma-art atlas | Read by | Shows |
|---|---|---|
| `buildings` (48×48, ground line at 44) | uma-kit's Hub scene on the map (through `KitArtProvider`, `app/art.ts`); `ui/BuildingSprite.tsx` in the DOM at 2× (96 pt) | Every place's building ([11](11-hub-and-places.md) §10.1) |
| `tiles` (16 px) | uma-kit's `layTerrain` and Hub scene, on each page's tile page (`hub/racerHub.ts`) | Each page's ground, paths and props: `town` (Town Hall), `learning` (Career) |
| `ui` | uma-kit's `UiMark` | The ticket marks at 16 pt (`currency/uma-ticket`; `currency/card-ticket` falls back to the kit's cards icon until drawn) |

**How a frame reaches the Hub.** Each place in the registry (`@racer/domain/hub`) names its `buildings` frame and its
`at` position. `HubPage` passes them to uma-kit's map, whose scene loads the atlases `app/art.ts` hands it, snaps each
building to the kit's grid and stamps the ground and buildings once into one texture; the DOM's place links sit on the
same grid. A frame the pinned atlas lacks is never a blank box: the map draws the kit's code marker in the page's
palette, and `BuildingSprite` draws the same marker as SVG. `AWAITING_ART` lists the frames the frames test
(`apps/web/src/hub/terrain.test.ts`) lets be missing; it is empty, so a registry frame the release lacks fails CI.

**Drawn as pixel art, never smoothed:** in the DOM a sprite is a CSS background at a whole-number scale with
`image-rendering: pixelated`; on the map the stamped texture uses nearest filtering at a whole number of device pixels
per art pixel ([11](11-hub-and-places.md) §12). New art goes through a handoff packet
([docs/handoff/](../handoff/README.md)): ChatGPT draws it in uma-platform's `scripts/pixel-art`, uma-platform publishes
a release, and Claude pins it here and updates [11](11-hub-and-places.md) §10.

## The race

- **Simulation, then playback.** `simulateRace(input)` (`@racer/race`, engine v9) runs the whole race up front as
  one-second turns and returns a timeline at 15 samples a second. A career's race commits as `run-race` (or
  `run-finale`) when **Race** is tapped, before playback ([03](03-careers.md) §4–§5), so closing the app mid-race
  changes nothing.
- **Determinism.** Randomness comes only from a seeded RNG in the input: `raceAttemptSeed` of the career's start, the
  content version, her, the race, her strategy and the attempt, so a retry is a new race and the same attempt is the
  same race on every device. A result's `raceResults` row stores its course, its seed and every runner by gate with
  her stats, aptitudes and skills, so it replays exactly. `packages/race` keeps every engine version; the game runs v9.
- **The run** (`places/career/RunPage.tsx`, its own lazy chunk) rebuilds the engine's input from the row, replays it,
  and plays it in **the scene** (`scenes/race/RaceScene.ts`, PixiJS, lazy), which plays the timeline back at the
  display's refresh rate, interpolating between samples into pooled runner tokens with no per-frame allocation. Its
  own renderer clock handles the gate pre-roll, close-finish slowdown, seek, skip and reduced motion; none of it is
  saved or read by a reward.
- **Art is playback-only:** `race/art.ts` holds and loads each distinct outfit's verified bust once in runner order,
  and the scene paints it into a circular token; missing art leaves the gate number.
- **Headless runs** use the same engine in Node: the balance sims above, and the API's races.

## Budgets and checks

What CI enforces on every push and pull request:

| Check | What it holds | Where |
|---|---|---|
| **Startup JS ≤ 180 KB gzip** | The HTML entry plus every chunk it statically imports; dynamic imports don't count. 151.86 KB at T158, with the Hub's Phaser chunk (about 1.40 MB, 374 KB gzip) loaded lazily beside it | `scripts/check-size.mjs`, at the end of `pnpm build`; its own test runs first in `pnpm test` |
| **No dev module in a build** | A production build holding any `src/dev/` module fails (none exists since D381) | `scripts/check-size.mjs` |
| **Types** | Every package type-checks (`tsc --noEmit`) | `pnpm lint` |
| **Tests** | Domain, race, API and web suites, one package at a time as CI runs them (`turbo run test --concurrency=1`), then `sim:careers` and `sim:stages` on the invented content; `pnpm test` runs the suites in parallel | `pnpm test:ci` |
| **The bands** | `sim:decks` on invented cards (the domain's tests), `sim:stages` and `sim:careers` with `--synthetic` | `pnpm test`, `pnpm test:ci` |
| **Purity** | The save, the career and the stages read no clock, roll no dice of their own and do no I/O; the stages use no maths that can differ between engines | `save/purity.test.ts`, `career/purity.test.ts`, `stages/purity.test.ts` |
| **The live manual** | Every `<!-- live:… -->` block in `docs/game/` equals what the code renders | `packages/domain/src/docs/docs.test.ts`; `pnpm docs:update` rewrites them |
| **Frames** | Every registry frame, tile and prop is in the pinned uma-art | `apps/web/src/hub/terrain.test.ts` |
| **Targets** | Every tap target on a place is 44 pt or more at 390×844 | `apps/web/src/places/targets.test.tsx` |
| **A whole career** | A URA Finale career walked end to end on the screens, on invented content with fixed seeds | `apps/web/src/places/career/Walkthrough.test.tsx` |
| **Retired routes** | Old and unknown paths land on `/` | `apps/web/src/app/router.test.tsx` |
| **The API's routes** | Exactly the five routes [above](#the-api) | `apps/api/src/app.module.test.ts` |

What a change that moves files or imports checks by hand:
- **Reach.** Every web source file is reachable from `src/main.tsx`, and every domain source file from an export entry
  or `src/docs/render.ts`. From `apps/web`, this prints nothing (for the domain, list every export entry and
  `src/docs/render.ts` in `files`):
  ```bash
  printf '{"extends":"./tsconfig.json","include":[],"files":["src/main.tsx","src/vite-env.d.ts"]}' > tsconfig.reach.json
  pnpm exec tsc -p tsconfig.reach.json --listFilesOnly | sed -n "s|^$PWD/||p" | sort > /tmp/reach; rm tsconfig.reach.json
  git ls-files 'src/*.ts' 'src/*.tsx' | grep -v -E '\.test\.tsx?$|/__fixtures__/|\.d\.ts$' | sort | comm -23 - /tmp/reach
  ```
- **Nothing old remains** (D381). This finds only the tests that assert those words are absent, the router test that
  walks retired paths, `uma-planner` citations, and comments that name what left (the generator's lineage note, the
  shell's "no Speed Tickets", the registry's retired buildings):
  ```bash
  git grep -i -E "uma-work|kit/work|check-in|prize money|speed ticket|constellation|lineage|inspiration|racing exp|racing level|farm level|warehouse|planner|expedition|trophy hall|time_factor|sim:loop" -- apps packages scripts
  ```
- **No clock in the rules.** This prints only comments that say the rules never use `Math.random`:
  ```bash
  git grep -n -E "Date\.now|setTimeout|setInterval|Math\.random" -- packages/domain/src ':!*.test.ts'
  ```
  On the device, `Date.now` and timers belong to the sync lane, the UI and the scenes only.
- **PixiJS for the race only:** `pixi.js` is imported only under `scenes/race/`.
- **Phaser only in a scene, lazy:** `phaser` (4.2.1, exact) is uma-kit's peer, imported today only by the kit's Hub
  scene in the lazy chunk its map loads (`createHubGame`); no uma-racer module imports it. A mini-game that needs a
  canvas takes it in its own lazy `stages/*/scene` (v3 §6); the two built games are DOM. The Hub's game is destroyed
  whenever its map unmounts, so it never runs beside a stage or the race scene.
- **Nothing duplicated from uma-kit:** no module under `apps/web/src` copies a kit component, and every former import
  site uses the kit. From `apps/web`, this prints nothing:
  ```bash
  grep -rn -E "from '[^']*(ui/(Button|Chip|Tabs|Panel|BottomSheet|Sheet|UiMark|AnimatedNumber|PlaceHeader|icons)|app/motion|hub/(Shell|AccountBar|BottomBar|OverlayHost|PlaceTargets|Pips|HubCanvas|grid|swipe|scene/[^']*))'" src
  ```
- **Links:** every relative link and anchor in `docs/`, README.md, AGENTS.md and CLAUDE.md resolves, except
  `docs/decisions.md`'s links to deleted pages, which stay as written.

The service worker precaches files up to 3 MB, so the Phaser chunk and uma-art's atlases are on the phone after
install; the private content is the kit runtime's, never a Workbox cache. Every screen is 390×844 portrait first, with
44 pt targets, safe-area padding, and transform and opacity animation only
([game-web-tech.md](../research/game-web-tech.md)).

## CI and deploy

`.github/workflows/deploy.yml`, adapted from uma-planner's:
- **verify** ("Test and build"), on every pull request and on pushes to `main`: install (frozen lockfile), `pnpm lint`,
  `pnpm test:ci`, `pnpm build`.
- **deploy** ("Deploy API and web"), on `main` only and only while the repository variable `DEPLOY_ENABLED` is `true`:
  authenticate with GitHub OIDC (keyless WIF), build the API image (`apps/api/Dockerfile`), push it to Artifact
  Registry tagged with the commit SHA, deploy Cloud Run `racer-api`, smoke-check `/api/health` (200) and `/api/save`
  (401) on its URL, build the web app with `VITE_API_BASE_URL` set to that URL, deploy Firebase Hosting, and check the
  hosted shell is `no-cache`. Deploys are serialized and never cancelled midway.
- **A push that changes only `docs/**` or Markdown files runs neither job** (`paths-ignore`): docs-only commits never
  deploy. Any other push to `main` deploys.

The pieces it ships:
- **The API image** (`apps/api/Dockerfile`) is multi-stage, as uma-rpg's: install the workspace, build the domain's and
  the race engine's CommonJS `dist` and the API, then `pnpm deploy --prod --legacy` into a Node 22 image on port 8080.
  Cloud Run runs it with min 0 and max 1 instances, 512 MiB, `PERSISTENCE=firestore`, `CONTENT_SOURCE=gcs` and the
  owner's `ALLOWED_EMAIL`; nothing sets `DEV_OPERATIONS`.
- **Hosting** (`firebase.json`) serves `apps/web/dist` as an SPA (every path rewrites to `index.html`): `/assets/**`
  cached for a year as immutable; the shell, `sw.js`, the manifest and Workbox's files `no-cache`. Hosting has no
  `/api` rewrite, so `https://uma-racer.web.app/api/*` answers with the SPA shell; the API is only on its Cloud Run URL.

GCP auth is keyless (WIF). `@luismlorenzana/*` packages (uma-art, uma-kit, uma-data, uma-server) install from GitHub
Packages with the workflow's token, which reads a package only once its Manage Actions access grants this repository
Read ([infrastructure](../technical/infrastructure.md#cicd-adapted-from-uma-planner)). The image build receives the
token as a BuildKit secret, so it never lands in a layer. Locally: `NODE_AUTH_TOKEN=$(gh auth token) pnpm install`. The
infrastructure's values and the release runbook are [technical/infrastructure.md](../technical/infrastructure.md).

Generation 2's layout and the choices made at its switch (T143) are in git history: `git show c592ccd:docs/game/architecture.md`.

## Dependencies

<!-- live:dependencies -->
| Package | Dependency | Version | Kind |
|---|---|---|---|
| uma-racer | turbo | ^2.10.13 | dev |
| @racer/web | @luismlorenzana/uma-art | 2.10.0 | runtime |
| @racer/web | @luismlorenzana/uma-data | 1.1.0 | runtime |
| @racer/web | @luismlorenzana/uma-kit | 0.9.1 | runtime |
| @racer/web | @racer/domain | workspace:* | runtime |
| @racer/web | @racer/race | workspace:* | runtime |
| @racer/web | @tanstack/react-query | ^5.102.8 | runtime |
| @racer/web | dexie | ^4.4.6 | runtime |
| @racer/web | firebase | ^12.19.0 | runtime |
| @racer/web | motion | ^12.43.0 | runtime |
| @racer/web | phaser | 4.2.1 | runtime |
| @racer/web | pixi.js | ^8.20.1 | runtime |
| @racer/web | react | ^19.3.0 | runtime |
| @racer/web | react-dom | ^19.3.0 | runtime |
| @racer/web | react-router | ^7.18.3 | runtime |
| @racer/web | workbox-window | ^7.4.0 | runtime |
| @racer/web | zustand | ^5.0.15 | runtime |
| @racer/web | @fontsource-variable/inter | ^5.3.0 | dev |
| @racer/web | @fontsource-variable/outfit | ^5.3.0 | dev |
| @racer/web | @tailwindcss/vite | ^4.3.3 | dev |
| @racer/web | @testing-library/react | ^16.3.3 | dev |
| @racer/web | @types/node | ^22.20.2 | dev |
| @racer/web | @types/react | ^19.3.0 | dev |
| @racer/web | @types/react-dom | ^19.3.0 | dev |
| @racer/web | @vitejs/plugin-react | ^5.2.0 | dev |
| @racer/web | fake-indexeddb | ^6.2.5 | dev |
| @racer/web | jsdom | ^26.1.0 | dev |
| @racer/web | tailwindcss | ^4.3.3 | dev |
| @racer/web | typescript | ~5.9.3 | dev |
| @racer/web | vite | ^7.3.6 | dev |
| @racer/web | vite-plugin-pwa | ^1.3.0 | dev |
| @racer/web | vitest | ^3.2.7 | dev |
| @racer/api | @google-cloud/storage | ^7.22.0 | runtime |
| @racer/api | @luismlorenzana/uma-data | 1.1.0 | runtime |
| @racer/api | @luismlorenzana/uma-server | 0.2.0 | runtime |
| @racer/api | @nestjs/common | ^11.2.4 | runtime |
| @racer/api | @nestjs/config | ^4.0.4 | runtime |
| @racer/api | @nestjs/core | ^11.2.4 | runtime |
| @racer/api | @nestjs/platform-express | ^11.2.4 | runtime |
| @racer/api | @racer/domain | workspace:* | runtime |
| @racer/api | @racer/race | workspace:* | runtime |
| @racer/api | firebase-admin | ^13.10.0 | runtime |
| @racer/api | reflect-metadata | ^0.2.2 | runtime |
| @racer/api | rxjs | ^7.8.2 | runtime |
| @racer/api | @nestjs/cli | ^11.0.24 | dev |
| @racer/api | @types/express | ^5.0.6 | dev |
| @racer/api | @types/node | ^22.20.2 | dev |
| @racer/api | typescript | ~5.9.3 | dev |
| @racer/api | vitest | ^3.2.7 | dev |
| @racer/domain | @luismlorenzana/uma-data | 1.1.0 | runtime |
| @racer/domain | @luismlorenzana/uma-art | 2.10.0 | dev |
| @racer/domain | typescript | ~5.9.3 | dev |
| @racer/domain | vitest | ^3.2.7 | dev |
| @racer/race | @racer/domain | workspace:* | runtime |
| @racer/race | typescript | ~5.9.3 | dev |
| @racer/race | vitest | ^3.2.7 | dev |
<!-- /live -->
