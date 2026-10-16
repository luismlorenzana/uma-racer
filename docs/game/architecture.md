# Architecture

How the code that runs fits together: generation 2, since the phase-3 cutover (M034, D361). The infrastructure values
and the release runbook are [technical/infrastructure.md](../technical/infrastructure.md); the plan for the phases
still ahead is [docs/rearchitecture/](../rearchitecture/README.md) with [rework/13](../rework/13-removals-and-plan-changes.md) §4.

Uma Racer reuses the **uma-planner** architecture (`../uma-planner`): a TypeScript pnpm/Turbo monorepo, a React SPA on
Firebase Hosting, a NestJS API on Cloud Run, Firebase Auth with an owner email allowlist, and Firestore. What a game
adds is **local-first state**, **rules that run on the device and again on the server**, **client-side race
simulation** and a **private content pipeline**.

| Area | uma-planner | Uma Racer |
|---|---|---|
| Monorepo | pnpm workspaces + Turbo, `tsconfig.base.json` | Same |
| Web | React, Vite, React Router, TanStack Query, Tailwind | Same stack, current majors: React 19, Vite 7, React Router 7, TanStack Query 5, Tailwind 4 |
| API | NestJS, `AuthGuard` (Firebase ID token + `ALLOWED_EMAIL`), `AUTH_MODE=disabled` locally | Same pattern, NestJS 11 |
| Persistence | Repository interface with a local JSON file (dev) or Firestore (prod) | Same pattern, for the save |
| Reference data | GameTora JSON importers | Same source, output as private content packs |
| Deploy | GitHub Actions with keyless OIDC: Artifact Registry → Cloud Run → Firebase Hosting, smoke checks | Same workflow, in the `uma-racer` project |

## The repo

A pnpm 10 workspace with Turbo, on Node 22, in strict TypeScript.

| Path | What |
|---|---|
| `packages/domain` (`@racer/domain`) | Every game rule, pure with no I/O ([below](#the-domain-package)). Vite, Vitest and `tsc` read its TypeScript source; `pnpm --filter @racer/domain build` also emits a CommonJS `dist/cjs` that the API imports |
| `packages/race` (`@racer/race`) | The deterministic race engine: a seeded RNG (never `Math.random`), one-second turns recorded as a timeline at 15 samples a second, which the scene plays back |
| `apps/web` (`@racer/web`) | React 19, Vite 7, Tailwind 4, Motion (`m.*` under `LazyMotion strict`), Zustand + Dexie, PixiJS 8 for the race scene only, a PWA ([below](#the-web-app)) |
| `apps/api` (`@racer/api`) | NestJS 11 on Cloud Run: the auth guard, the generation-2 save and sync, the one-release purge, private content ([below](#the-api)) |
| `scripts/data`, `scripts/assets` | The private content pipeline: GameTora datasets and images into gitignored packs and WebP atlases ([below](#private-content)) |
| `scripts/sim` | Headless balance runs (`pnpm sim:*`, [below](#the-balance-sims)) |
| `scripts/check-size.mjs` | The startup JS budget, and the dev-only check ([below](#budgets)) |
| `infra/` | GCP bootstrap and GitHub Actions notes |

```mermaid
flowchart LR
    subgraph iPhone["iPhone · Home Screen web app"]
        SW[Service worker<br/>app shell + content cache]
        UI[React shell and places<br/>Motion]
        Scene[PixiJS race scene]
        Store[useSave · Zustand]
        IDB[(Dexie uma-racer-g2<br/>kind tables + outbox)]
        Rules[@racer/domain + @racer/race<br/>run on device]
        UI <--> Store
        Scene --> UI
        Store <--> IDB
        Store --> Rules
    end
    subgraph GCP["GCP project uma-racer"]
        Hosting[Firebase Hosting<br/>SPA]
        Auth[Firebase Auth<br/>owner allowlist]
        API[Cloud Run · NestJS<br/>re-runs every operation]
        FS[(Firestore<br/>saves/uid)]
        GCS[(Cloud Storage · private<br/>content packs + atlases)]
    end
    SW -.install/update.-> Hosting
    IDB -- one sync lane --> API
    SW -- content files --> API
    API --> FS
    API --> GCS
    UI -. sign-in .-> Auth
```

## The domain package

`@racer/domain` holds every rule as a pure function: no I/O, `Date.now`, `Math.random`, React, Dexie or browser
globals. Time comes in as `now`, integer milliseconds; randomness from the race engine's seeded RNG, passed in.

### The domain's exports

| Import | For | Resolves to |
|---|---|---|
| `@racer/domain` | The core: types, content-pack contracts and the rules kept from before the rework (careers and goals, the race EXP walk, the level curve, rivals, constellation and cap rules, lineage, Inspiration's pick rules, badges, flair, Trainer achievements, the race catalogue and skills, card focus) | `src/index.ts`; `dist/cjs/index.js` under `require` |
| `@racer/domain/save` | The generation-2 save: rows, strict parsers, `initialSave`, operation envelopes and receipts, `commitOperation`, sync v2's wire types ([rework/13](../rework/13-removals-and-plan-changes.md) §6) | `src/save/index.ts`; `dist/cjs/save/…` |
| `@racer/domain/state` | The shared state shapes and the one time factor (`types.ts`, `time.ts`): the only path to them | `src/state/index.ts` |
| `@racer/domain/tiers` | The tier map, Racing Level, careers, advancing, promotion, Uma Tickets and Shards, tier scaling, rivals, the stand-in Expedition | `src/tiers/index.ts` |
| `@racer/domain/items` | The 8 × 10 catalogue, crafted items, planet dishes, Duos and Feasts, recipes, grade gates, work values | `src/items/index.ts` |
| `@racer/domain/work` | The one-after-another work engine: jobs and sessions, queues, collect, recall, Speed Tickets, the clock | `src/work/index.ts` |
| `@racer/domain/farm` | The Farm's buildings and slots, Farm Level, Farm jobs | `src/farm/index.ts` |
| `@racer/domain/training` | The Training Hub's facilities, layers and unlock order, the Extra Stats map, bonds, presets, buffs, derived stats, and the re-authored trees (`training/trees/`) | `src/training/index.ts` |
| `@racer/domain/economy` | Prize Money, the Daily Purse, featured races, the Exchange and selling (09 §10–§11) | `src/economy/index.ts` |
| `@racer/domain/check-in` | Every operation (`OPERATIONS`, `runOnce`, `recheck`), Collect all, Repeat, batch sizing, the check-in summary, `finish-race`, `dev-grant`, the plain words | `src/check-in/index.ts` |
| `@racer/domain/planner` | The planner's needs and suggestions | `src/planner/index.ts` |
| `@racer/domain/sim` | `sim:loop`'s pure core, its policies and the invented content the dev seeds are built on | `src/sim/index.ts` |
| `@racer/domain/builds` | The committed balance reports of `sim:builds` and `sim:careers` | `src/builds/index.ts` |
| `@racer/domain/hub` | The place registry (`PLACES`) and the Hub view the shell draws | `src/hub/index.ts` |

Every entry has a `require` condition (`dist/cjs/<area>/…`) beside `default` (the TypeScript source). The API resolves
with Node16 rules, so it takes `require` and reads the built CommonJS; everything else reads the source. Turbo builds the
domain before any package's `lint`, `test`, `build` or `dev`. After changing a domain rule while `pnpm dev` runs,
restart it so the API picks up the rebuilt `dist`.

The core export keeps the rules the rework still reads, or uses as its parity oracle, until phase 5 rewrites them
behind rearchitecture/01 §3's `racing`, `cards` and `badges` subpaths (D361). Its `career-shapes.ts` holds only the
journey and preference shapes those rules read (the old `save.ts`, cut). No save migration or legacy constant remains.

## The rework modules

The rules of the [game rework](../rework/README.md), built in phase 2 (D340–D350), are the areas above from `state` to
`hub`: `packages/domain/src/<area>/`, each exported as `@racer/domain/<area>`. Screens and the server call their
operations and queries; no screen or API handler restates a rule or a number.

| Area | Holds |
|---|---|
| `state` | The shared state (`ReworkState`, the profile, `UmaState`, work rows) and `TIME_FACTOR` |
| `tiers` | The tier map, Racing Level per tier, careers, advancing, promotion, Uma Tickets and Shards, tier scaling, rivals |
| `items` | The 8 × 10 catalogue, crafted items, planet dishes, Duos and Feasts, recipes, grade gates, work values |
| `work`, `farm` | The one-after-another work engine (jobs and sessions, queues, collect, recall, Speed Tickets), buildings, Farm Level |
| `training` | The Training Hub's facilities, layers and unlock order, the Extra Stats map, bonds, presets, buffs, derived stats; `training/trees/` the re-authored trees, their sizes and the validator |
| `economy` | Prize Money, the Daily Purse, featured races, the Exchange and selling |
| `check-in`, `planner` | Every operation and its plain words, Collect all, Repeat, batch sizing, the check-in summary, the planner's needs and suggestions |
| `builds` | The committed balance reports of `sim:builds` and `sim:careers` |
| `sim` | `pnpm sim:loop`, the whole economy from a fresh account, its CI checks, and the invented content the dev seeds use |
| `hub` | The 23 places of the four pages with their routes, counters, uma-art frames and map positions, and `hubView`, which gathers what the shell draws: the pill's counts, tab badges, slot pips, counters, the featured Uma and the account bar's chips |

The rules every area follows:
- **Pure**, as above.
- **Whole seconds through one time factor.** Every duration is a base formula in minutes × `TIME_FACTOR` (1.2,
  D338) × 60, rounded once, then divided by a building's speed and rounded once more (`state/time.ts`).
- **Reuse, don't copy.** Where the rework keeps a rule as it was, the area imports the core's (`progression.ts`,
  `scenario-goals.ts`, `constellation.ts`, `lineage.ts`, `opponents.ts` …). Where it changed a formula, the new one
  lives in the area.
- **Numbers are named constants** citing their page, pinned by tests beside the modules and in `domain.test.ts`. A
  number changes only with its page, its test and a decision entry.
- **Art ids are uma-art's**, checked against the package's indexes by a test (`@luismlorenzana/uma-art`, a dev
  dependency of the domain and a dependency of `@racer/web`, which draws the Hub's buildings from it).
- **State, not saves.** Plain typed state shaped after the generation-2 save kinds. Each owner action is a pure
  function `(state, input, now, env?) → { state, receipt } | Refusal`, and a refusal carries plain words, never protocol
  names. `commitOperation` (`@racer/domain/save`) runs an operation once through `runOnce` and says which rows it
  writes: the device and the server call the same function.
- **Synthetic fixtures only.** No master data, names or ids from the private packs; each area's fixture is
  `src/__fixtures__/<area>.ts`.
- **The live manual.** Each area exports `LIVE_BLOCKS` from its `docs.ts`; `src/docs/render.ts` joins them as
  `AREA_BLOCKS` beside the manual's own keys, and `src/docs/docs.test.ts` checks every page of `docs/game/` and
  `docs/rework/` against them. `pnpm docs:update` rewrites the blocks.

### The balance sims

`scripts/sim` races the engine headless on synthetic builds, from the repo root (`pnpm sim:*`; they read the domain's
built `dist`, so run `pnpm --filter @racer/domain build` first in a fresh checkout).

| Script | Checks | Exits 1 when |
|---|---|---|
| `pnpm sim:balance` | The engine's strategy balance on synthetic fields (`--final` for the full matrix) | — (a report) |
| `pnpm sim:turns` | Engine v9's targets on generated G1 fields (`ENGINE=7` or `8` compares a frozen engine) | — (a report) |
| `pnpm sim:builds` | The stamina ladder and the G1 grid on full-layer builds at every T = 1–14 against the tier rules' fields, and each buff's typical value | A hard ladder check fails, other than the three accepted at a tier's first scenario (`LADDER_ACCEPTED_MISSES`, D350) |
| `pnpm sim:careers` | Every career of the private pack frozen by the rework's rule, and each stage's best case on full-layer builds at every T, against [03](03-uma-progression.md) §12's targets | A career can't be frozen, or a cell falls under 25% |
| `pnpm sim:loop` | The whole economy from a fresh account over three tiers, and [12](12-economy-and-pacing.md) §12's pacing checks; `--variant=`, `--matrix`, `--json` | A check fails |

Flags: races per cell as a bare number, `--tiers=` (the game's scenarios T), `--ladder-only` and `--rates-only` for the
builds, `--coverage-only` and `--content=<dir>` for the careers. `sim:builds` and `sim:careers` also take
`--write-report`, which rewrites their committed report in `packages/domain/src/builds/`; the pages' live blocks render
it, so CI never runs the engine. Re-run both with it after changing a rule a build or a field reads.
`pnpm sim:loop -- --refresh-wins` does the same for the loop's win table (`packages/domain/src/sim/win-table.ts`); the
loop itself runs on the domain's source, and its test runs the checks in CI.

## The web app

`apps/web/src`, mobile first at 390×844:

| Folder | What |
|---|---|
| `main.tsx` | The entry: TanStack Query, the auth provider (Firebase lazy), the content provider, the motion root, the session, the live router and the update prompt. In dev builds a path under `/dev/seeds/` mounts the seeds instead |
| `app/` | The router (`router.tsx`, `routes.tsx`), the old app's redirects (`redirects.ts`), the start rule (`start.ts`), the session (`session.tsx`), the game port (`game.ts`, `G2Game`) and its lazy boot (`boot.ts`), the 30-second clock, the motion root, the update prompt (`UpdateNotice.tsx`, `register-updates.ts`, `update-lifecycle.ts`) and the build id (`build.ts`) |
| `hub/` | The shell ([11](11-hub-and-places.md) §2): the account bar, the bottom bar with the raised Race button, the ☰ menu and global sheets, the sheet host; and uma-rpg's Hub, ported (T145): each page's map (`HubPage.tsx`) on a lazy Phaser canvas (`HubCanvas.tsx` over `scene/`: `createHubGame`, `HubScene`, the seeded `terrain`, the placeholder `markers` and the page `palettes`), the shared grid (`grid.ts`), the place links with their pips (`PlaceTargets.tsx`, `Pips.tsx`), swipes (`swipe.ts`) and the side panel for Peeks (`OverlayHost.tsx`) |
| `places/` | Every place's Peek, Page, sub-pages and sheets, filled through `places/registry.tsx` (each a lazy chunk): `stable`, `reveal`, `warehouse`, `exchange`, `card-library`, `account`, `training`, `farm`, `racing`, `check-in`, `needs`. Each screen draws a pure view model (`model.ts`) over the rules' state |
| `save/` | The device's generation-2 save and its one sync lane ([below](#the-save-and-sync)) |
| `ui/` | Shared pieces: primitives, the icon set, the work pieces (`ui/work/`: slot cards, Speed Tickets, Recall, queue and size chips, `useTap`), `ItemIcon`, `TreeGraph`, the one Uma picker (`UmaPicker`, D181), the album chrome and query engine (`ui/album/`), art and labels |
| `scenes/race/` | The race scene: PixiJS 8, lazy, the only PixiJS in the repo until phase 8 ([below](#the-race)) |
| `content/` | The private content runtime ([below](#private-content)) |
| `auth/` | Firebase Auth, loaded on demand; `idToken()` feeds both the content client and the save |
| `api/client.ts` | The content client |
| `dev/` | The synthetic seeds' mount and the dev proofs, dev builds only ([below](#dev-seeds)) |
| `__fixtures__/` | Test support (`testing.tsx`, `testing-ops.ts`); places keep their own under `places/*/__fixtures__/` |

- **One store for game state:** `useSave` (Zustand), read through selectors and fed only by Dexie commits. Device
  conveniences (the last page, album views, reduced motion, race speed, seen flair) are `uma-racer:g2:` localStorage
  keys and never sync. TanStack Query is for network data only.
- **One port.** The shell and every place read the game only through `G2Game` (`app/game.ts`): status, the folded
  state, the Hub view, sync, receipts and notices, `run` for a tap (the domain's `recheck`, then the operation), `logs`
  for race results, the ledger, the Warehouse's movements and an operation's own row (its name, time and receipt: the
  folded state never holds a confirmed tap's, so the Scenario Gate's ceremony reads it here), and `writeDevice` for
  badge and flair rows. The seeds' in-memory port has the same shape: its operations live beside the state. Every tap and
  device write holds the update prompt's restart until it commits (`criticalGameplayAction`).
- **The session** (`app/session.tsx`) boots the device save once the private content is ready, since operations need
  its env. Before the save has opened, a signed-out phone or content that can't load gets one full-screen panel in the
  content diagnostics' words, with its way on; once it has opened, signing out pauses sync and play goes on. Account's
  last row is Sign in while sync is paused and Sign out otherwise; with auth off (local dev) neither shows and the
  phone acts signed in.
- **Lazy by default.** The entry holds the router, the shell's frame, the place registry and the port's interface;
  the rules, the save, Dexie, Firebase, the race engine and scene, and every page and sheet load on demand.
- **Generation-2 names stay.** Identifiers, CSS classes (`app/g2.css`), `data-g2` attributes, storage keys and the
  database keep their `G2`/`g2` names: renaming them changes no behaviour, and the keys and database must keep theirs.

### Routes

The live router ([11](11-hub-and-places.md) §7) has no basename:
- `/` is the start rule: a new account opens the Stable's Locked tab, anything that needs a tap opens the Farm page,
  otherwise the last page viewed (`uma-racer:g2:lastPage`) or Town Hall.
- `/:page` is a page's map (`town`, `training`, `racing`, `farm`), with `?peek=:place` for a Peek in the side panel
  and `?sheet=menu | featured | check-in` for a global sheet, so Back closes either.
- `/:page/:place/*` is a place: its sub-page slots, then its Page. `/collection/reveal/uma/:umaId` is the full-screen
  reveal.
- **Redirects:** the old app's routes go to their new paths (`app/redirects.ts`, 11 §7.2's table, walked by
  `app/router.test.tsx`). Deleted paths and unknown paths go to `/`. The redirects ship with phase 3 and leave with the
  next phase that ships, as does the first-boot wipe.

### Dev seeds

In dev builds, `main.tsx` loads `dev/main.tsx` for `/dev/seeds`, `/dev/seeds/` and any path under it (`isSeedsPath`),
whose root runs the start rule as `/` does, and which serves the same routes under
that basename over an in-memory port on `@racer/domain/sim`'s invented accounts: `?seed=busy | fresh | quiet | gate |
promote | tired | spent | stopped`, and `?at=HH:MM` to move the clock. `?save=device` boots the device save on the
seeds' content instead (`&wipe` adds the wipe and the purge). It mounts no auth, content or service worker, so art falls
back to each Uma's initial. The dev proofs sit under it (`/dev/seeds/dev/check-in`). In any dev build, Account's dev
section runs `dev-grant`; on the seeds' in-memory port it also loads another seed in place. A production build holds
none of it: `check-size.mjs` refuses a build with any `src/dev/` module, and production answers `/dev/seeds` as an
unknown path.

## The save and sync

Generation 2 is one save in one shape, with no migrations: entities, logs and operations in one sync lane. The kinds,
rows, bounds and wire format are [rework/13](../rework/13-removals-and-plan-changes.md) §6 ("The save as built", "The
API as built", "The web save as built"); this is the outline.

- **Every change is an operation** with an id chosen before the tap is written. The device applies it at once with
  `commitOperation` and queues it; the API re-runs the same function on its own rows and commits, or refuses with the
  same plain words. A retried id returns its first receipt and is never applied twice. Only badges and flair events are
  written as rows by the device; a new account's rows are built by the server from a create that carries only
  `createdAt`.
- **On the device** (`apps/web/src/save/`): Dexie `uma-racer-g2`, schema version 1, one table per kind plus the
  `outbox`. The store is a fold of the queued operations over what the server confirmed, so a reload and the server's
  answer fold to the same account, and a refused answer rolls a tap back with a notice. It publishes only after Dexie
  commits.
- **One lane** (`save/sync.ts`): the outbox flushes in order, 100 rows a request, 1.5 s after the last write, at once
  when the app is hidden, and with a pull when it is visible or back online. Failures retry after 5 s, 30 s and
  2 minutes, then every 5 minutes while visible. A 426 stops the lane until the app restarts; a 409 drops the device's
  save and boots it as a new device. The Sync chip says offline, paused (signed out), amber (waiting over a day, D157)
  or red.
- **The boot** (`save/boot.ts`): the first-boot wipe, then the purge call, then open, local first. An empty device pulls
  every page; one that can't reach the save creates its own and adopts the server's on a later `exists`.
- **The first-boot wipe** (`save/wipe.ts`, once per device, until the next phase that ships): it deletes the old
  database `uma-racer`, in dev builds the old proof databases (`<name>-proof-*`), every `uma-racer:` key that isn't
  `uma-racer:g2:`, and the old content cache `racer-content`, then sets `uma-racer:g2:wiped`. It never reads old data.
  The content runtime keeps its last manifest under `uma-racer:g2:content-manifest` and the service worker caches
  content as `uma-racer-g2-content`, so the wipe never takes what this app has just fetched.
- **The purge** (`POST /api/legacy/purge`, for one release): once signed in, the device asks the API to delete the old
  save's `players/{uid}` tree; the API records `saves/{uid}/meta/purge`, and a second device gets `already`. The device
  marks `uma-racer:g2:purged`. T144's follow-up release removes the endpoint and the call.
- **On the server** (`apps/api/src/save/`): `saves/{uid}/{kind}/{id}` in Firestore, one small document per row through
  the Firestore codec (a row whose data nests arrays is stored as JSON text, D151); a sync is one transaction with every
  read before the first write. Local dev keeps one file, `apps/api/.data/save-g2.json`.

## The API

| Route | What |
|---|---|
| `GET /api/health` | Liveness. The only route without auth |
| `GET /api/save` | A page of the save's rows since `since` (protocol and generation as query parameters) |
| `POST /api/sync` | The outbox in order: the create, badge upserts, flair appends and operations, each answered in order |
| `POST /api/legacy/purge` | Deletes the old save once (one release: T144's follow-up removes it) |
| `GET /api/content/manifest`, `GET /api/content/files/*path` | Private content from the `uma-racer-content` bucket, hash-named and immutable |

- **Auth.** Every route except health sits behind `AuthGuard`: a Firebase ID token whose email matches
  `ALLOWED_EMAIL`. In development, `AUTH_MODE=disabled` acts as a fixed local user.
- **Stamps.** The save's three routes run the guard, then the stamp: anything but `protocol: 2` and `generation: 2` is
  426 with nothing read or written, so a stale app can't write. Bodies are checked by the domain's parsers (400).
- **Operations run on the server's content:** the `umas`, `races`, `cards` and `skills` packs, verified by hash and
  built with `buildOperationEnv`, cached per manifest version and re-read at most once a minute (503 when they can't
  load).
- **`dev-grant`** runs only when the API starts with `DEV_OPERATIONS=true`. `pnpm dev` and `pnpm api` set it through
  the API's package scripts; no deploy, Dockerfile or Cloud Run setting does, so production refuses it.
- `app.module.test.ts` holds the API to exactly these six routes.

## Private content

- **Game data** (Umas, SSR cards, skills, races, courses and career-objective references) comes from GameTora's
  versioned JSON datasets (`pnpm data:import`), normalized into hashed packs. Objective rows keep only ordered
  race-family ids.
- **Overlays** Claude keeps in the gitignored `content/overrides/`: `flair.json` (race-series legs and the ten main
  venues, D107) and `card-focus.json` ([06](06-cards-and-bonds.md) §5). Import validation resolves every private
  reference; git holds only semantic tags, aggregate coverage and synthetic fixtures.
- **Images** are fetched once by `pnpm assets:import`, normalized into WebP frames and packed into sprite atlases
  (`uma-icons`, `card-icons`, and the optional `scenario-icons` and `skill-icons`) and art families (`uma`, `card`,
  `bust`, `chibi`, `dress`, `face`). An import keeps only the atlases and art families `scripts/assets` builds; any
  other file leaves the manifest.
- **Publishing** (`pnpm content:publish`) uploads content-addressed files to the private bucket, then the manifest last.
  Old hashed objects are kept ([infrastructure](../technical/infrastructure.md#release-runbook)).
- **On the device** (`content/runtime.ts`): the app fetches `GET /api/content/manifest` with the owner's token, reads
  the files whose kind it knows (the five packs, the atlases and the art families) and ignores any other, verifies each
  against its SHA-256 and keeps the last verified manifest for offline boots. Image pages become Blob URLs for the DOM
  and the race scene. The service worker caches content files by hash, so after the first download the app loads
  offline.
- In local dev the API serves the same files from the gitignored `content/` folder (`CONTENT_SOURCE=local`).

## The race

- **Simulation, then playback.** `simulateRace(input)` (`@racer/race`, engine v9) runs the whole race up front as
  one-second turns and returns a timeline at 15 samples a second. A race commits as the `finish-race` operation at
  Start race, before playback ([09](09-racing-rewards-and-exchange.md) §8–§9), so closing the app mid-race changes
  nothing.
- **Determinism.** Randomness comes only from a seeded RNG in the input. A result stores its seed, its course and every
  runner's compiled skills, so it replays exactly. `packages/race` keeps every engine version; the web replays v9 only,
  since generation 2 holds no older row.
- **The scene** (`scenes/race/RaceScene.ts`, PixiJS, lazy) plays the timeline back at the display's refresh rate,
  interpolating between samples (`sampleTimeline`) into pooled runner tokens with no per-frame allocation. Its own
  renderer clock handles the gate pre-roll, close-finish slowdown, seek, skip and reduced motion; none of it is saved or
  read by a reward.
- **Headless runs** use the same engine in Node: the balance sims above.

## Budgets

- **Startup JS ≤ 180 KB gzip, enforced.** `scripts/check-size.mjs` runs at the end of the web build. It fails when the
  HTML entry, or the entry plus every chunk it statically imports, passes the budget; dynamic imports don't count. It
  also fails when the build holds any dev-only module (`src/dev/`). Measured at 143.38 KB on 2026-10-15 (T145), with
  the Hub's Phaser chunk (1.40 MB, 374 KB gzip) loaded lazily beside it. The service worker precaches files up to 3 MB,
  so that chunk and uma-art's atlases are on the phone after install.
- **Reach.** Every web source file is reachable from `src/main.tsx`, and every domain source file from an export entry
  or `src/docs/render.ts`, checked with `tsc --listFilesOnly` (T143's check 5).
- **PixiJS for the race only** until phase 8 ports it to Phaser: `pixi.js` is imported only under `scenes/race/`.
- **Phaser for the Hub only:** `phaser` (4.2.1, exact) is imported only under `hub/scene/`, by the lazy chunk
  `HubCanvas` loads. The Hub's game is destroyed whenever its map unmounts, so it never runs beside the race scene.
- 390×844 portrait first, 44 pt targets, safe-area padding, transform and opacity animation only
  ([game-web-tech.md](../research/game-web-tech.md)).

## Deploy

`.github/workflows/deploy.yml`:
- **On every pull request and push to `main`:** install, lint, test and build.
- **On `main` only:** build the API image and deploy it to Cloud Run `racer-api`, smoke-check `/api/health` and
  `/api/save` (401), then build the web app and deploy it to Firebase Hosting.

GCP auth is keyless (WIF). `@luismlorenzana/*` packages install from GitHub Packages with the workflow's token. The
image build receives the token as a BuildKit secret, so it never lands in a layer. Locally:
`NODE_AUTH_TOKEN=$(gh auth token) pnpm install`.

## Decided at the switch (T143)

How generation 2 became the app (D361). The plan-level choices (the tag, the deletion lists and their checks) are
[rework/13](../rework/13-removals-and-plan-changes.md) §8's.

| Choice | Why |
|---|---|
| The rework areas drop the `rework/` segment: `exchange` becomes `economy`, `constellation` goes under `training/trees`, the shared state under `state` | One rule for every area; 09 §10–§11 names `economy`; the core's `constellation.ts` stays, so its name can't be a folder |
| The core's kept modules stay in the main export; rearchitecture/01 §3's `racing`, `cards` and `badges` subpaths wait for phase 5, and so do the rules the rework reads or uses as its parity oracle (the race EXP walk, the career planner, the old rivals for `sim:balance` and `sim:turns`, the badge and race-record parsers) | Phase 5 rewrites `content.ts` and its readers anyway; deleting an oracle would drop the parity it proves |
| The old `save.ts` is cut to the shapes kept rules read and renamed `career-shapes.ts`; the `UmaSave` view `careerView` returns loses Training Level, Extra stats and Inspiration, and the Trainer's fingerprints hash that smaller view | `@racer/domain/save` is generation 2's; careers and badges still read journey shapes; generation 2 has no stored fingerprint yet |
| `@racer/domain/state` is the only path to the shared shapes and the time factor | A second path to the same names is a compatibility re-export |
| `cardRaceBonus(template)` takes no stars and pays the full value; `starNodePct` stays only for the rivals' 84% card factor | D329 pays every card 100%, which the rework already passed as 3★, so no number moves; the rivals' factor is their build (D336) |
| Fixtures take their area's name (`src/__fixtures__/<area>.ts`); the race catalogue the Exchange tests read is `economy.ts` | One naming rule |
| `src/docs/rework.ts` folds into `render.ts` as `AREA_BLOCKS`; the manual's retired keys (the fourteen-scenario ladder, caps, buffs and the 1–140 level table) leave `render.ts` with their pages' rewrite | A list no page shows is dormant code; 04 and 03 render what runs |
| Sims are renamed `sim:builds` and `sim:careers`, and their harness loses the old `buildStats` and the helpers only deleted sims used | The `rework` prefix leaves with `rework/`; those read Training Levels, stars and the old Extra stats |
| The session boots the device save once the content is ready; before it opens, a signed-out phone or failing content gets one full-screen panel; after, signing out pauses sync and play goes on. Account's last row is Sign in or Sign out | A cold boot without content can't run a rule; an open save keeps the owner's taps |
| One `idToken()` in `auth/firebase.ts` feeds the content client and the save's token provider; `api/client.ts` keeps only the content client | One token source, and the save's client stays in its lazy chunk |
| Every tap and device write holds the update prompt's restart until it commits (`criticalGameplayAction`) | The installed app defers a restart across gameplay commits |
| The seeds are a dev-only mount at `/dev/seeds/*`, with the dev proofs under it; `check-size.mjs` refuses a build holding any `src/dev/` module | Every place link is absolute, so the seeds need a basename; proofs stay under `/dev/` and dev-only (11 §7.2) |
| The content runtime ignores manifest files it has no kind for, keeps its manifest under `uma-racer:g2:content-manifest`, and the service worker caches content as `uma-racer-g2-content` | The old manifest stays readable until T144 publishes the new one; under the old names the wipe would delete what the app had just fetched |
| The wipe finds the old dev proof databases by their shared shape, `<name>-proof-*` | The same databases, dev builds only, without naming a retired mode in code |
| `g2/` moved to `app/`, `hub/`, `places/`, `save/`, `ui/` and `dev/`; test support to `__fixtures__/`; the `G2`/`g2` names stay in identifiers, CSS classes, `data-g2` attributes and storage keys | Renaming every identifier changes no behaviour, and the keys and database must keep their names |
| The old race plan, fit and facts, goals, flair, badge-collection and trainer views and badge frame moved to `places/racing/`; the album query to `ui/album/`; the Root and Account read the build id through `app/build.ts` | A module lives with the place that uses it, or in `ui/` when two share it |
| The build-beside boundaries test went whole | With one app, the reach check and the PixiJS check hold what remains |
| The icon set loses the five icons that drew only retired things; the new game's four join the set | Whole deletion for retired systems; generic icons stay as the visual system's |
| The API keeps the Firestore codec (D151), moved into the save module; `app.module.test.ts` holds it to six routes | Generation 2's repository stores work rows through it; the API answers only those routes |
| `pnpm dev` and `pnpm api` start the API with `DEV_OPERATIONS=true`; `.env.example` documents it, commented out | `dev-grant` works locally without a hand-edited `.env`; nothing that deploys sets it |
| A data import keeps only the atlases and art families `scripts/assets` builds | T144 needs a manifest with none of the retired art, and naming the kept families keeps retired names out of code |
| The domain's reach check roots at every export entry plus `src/docs/render.ts` | The renderer and each area's `docs.ts` run only under `pnpm docs:update` and the docs test |
| The redirects and the first-boot wipe leave with the next phase that ships | 11 §7.2 ties them to phase 4, which ships only if the owner asks (D336) |

## Dependencies

<!-- live:dependencies -->
| Package | Dependency | Version | Kind |
|---|---|---|---|
| uma-racer | turbo | ^2.10.13 | dev |
| @racer/web | @luismlorenzana/uma-art | 2.7.0 | runtime |
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
| @racer/api | @nestjs/common | ^11.2.4 | runtime |
| @racer/api | @nestjs/config | ^4.0.4 | runtime |
| @racer/api | @nestjs/core | ^11.2.4 | runtime |
| @racer/api | @nestjs/platform-express | ^11.2.4 | runtime |
| @racer/api | @racer/domain | workspace:* | runtime |
| @racer/api | firebase-admin | ^13.10.0 | runtime |
| @racer/api | reflect-metadata | ^0.2.2 | runtime |
| @racer/api | rxjs | ^7.8.2 | runtime |
| @racer/api | @nestjs/cli | ^11.0.24 | dev |
| @racer/api | @types/express | ^5.0.6 | dev |
| @racer/api | @types/node | ^22.20.2 | dev |
| @racer/api | typescript | ~5.9.3 | dev |
| @racer/api | vitest | ^3.2.7 | dev |
| @racer/domain | @luismlorenzana/uma-data | 1.0.0 | runtime |
| @racer/domain | @luismlorenzana/uma-art | 2.7.0 | dev |
| @racer/domain | typescript | ~5.9.3 | dev |
| @racer/domain | vitest | ^3.2.7 | dev |
| @racer/race | @racer/domain | workspace:* | runtime |
| @racer/race | typescript | ~5.9.3 | dev |
| @racer/race | vitest | ^3.2.7 | dev |
<!-- /live -->
