# Architecture

How the code that runs today fits together. The rebuild that replaces most of it is
[docs/rearchitecture/](../rearchitecture/README.md); the infrastructure values and the release runbook are
[technical/infrastructure.md](../technical/infrastructure.md).

## The repo

A pnpm 10 workspace with Turbo, on Node 22, in strict TypeScript.

| Path | What |
|---|---|
| `packages/domain` (`@racer/domain`) | Every game rule, pure with no I/O. Vite, Vitest and `tsc` read its TypeScript source; `pnpm --filter @racer/domain build` also emits a CommonJS `dist/cjs` that the API imports |
| `packages/race` (`@racer/race`) | The deterministic race engine: a seeded RNG (never `Math.random`), one-second turns, a timeline the scene plays back |
| `apps/web` (`@racer/web`) | React 19, Vite 7, Tailwind 4, Motion (`m.*` under `LazyMotion strict`), Zustand + Dexie, PixiJS 8 scenes (race, Puzzles, retired Spark Rival), a PWA |
| `apps/api` (`@racer/api`) | NestJS 11 on Cloud Run: the auth guard, the save, private content |
| `scripts/data`, `scripts/assets` | The private content pipeline: GameTora datasets and images into gitignored packs and WebP atlases |
| `scripts/sim` | Headless balance runs (`pnpm sim:*`) |
| `scripts/check-size.mjs` | The startup JS budget (below) |

### The domain package's exports

| Import | For | Resolves to |
|---|---|---|
| `@racer/domain` | Everything | `src/index.ts`; `dist/cjs/index.js` under `require` |
| `@racer/domain/farm`, `/farm/kitchen` | The Farm | `src/farm/…`; `dist/cjs/farm/…` |
| `@racer/domain/puzzles/<module>` | The API's Puzzle operations | `src/minigames/uma-puzzles/<module>.ts`; `dist/cjs/…` |
| `@racer/domain/rework/<area>` | The rework's rules ([below](#the-rework-modules)); not in play until T143 | `src/rework/<area>/index.ts`; `dist/cjs/rework/<area>/…` |
| `@racer/domain/save-g2` | The generation-2 save: rows, parsers, operation commits, sync v2 ([rework/13](../rework/13-removals-and-plan-changes.md) §6); not in play until T143 | `src/save-g2/index.ts`; `dist/cjs/save-g2/…` |
| `@racer/domain/hub` | The new game's place registry and Hub view ([below](#the-rework-modules)); not in play until T143 | `src/hub/index.ts`; `dist/cjs/hub/…` |

The API resolves with Node16 rules, so it takes the `require` condition and reads the built CommonJS. Everything else
takes `default` and reads the source. Turbo builds the domain before any package's `lint`, `test`, `build` or `dev`.
After changing a domain rule while `pnpm dev` runs, restart it so the API picks up the rebuilt `dist`.

### The balance sims

`scripts/sim` races the engine headless on synthetic builds, from the repo root (`pnpm sim:*`; they read the domain's
built `dist`, so run `pnpm --filter @racer/domain build` first in a fresh checkout). Racing balance has two pairs: today's
game, and the rework's rules beside it (M033) until phase 3 replaces today's.

| Script | Checks | Exits 1 when |
|---|---|---|
| `pnpm sim:constellation` | Today's stamina ladder at every tier, and the G1 win rates | A hard ladder check fails |
| `pnpm sim:careers` | Every career of the private pack, and each stage's win rate at TL10 | A career can't be generated, or a bonded set wins under 25% |
| `pnpm sim:rework-builds` | The stamina ladder and the G1 grid on full-layer rework builds at every T = 1–14 against T125's fields, and each buff's typical value | A hard ladder check fails, other than the three accepted at a tier's first scenario (`LADDER_ACCEPTED_MISSES`, D350) |
| `pnpm sim:rework-careers` | Every career of the private pack frozen by the rework's rule, and each stage's best case on full-layer builds at every T, against [rework/03](../rework/03-uma-progression.md) §12's targets | A career can't be frozen, or a cell falls under 25% |
| `pnpm sim:loop` | The rework's whole economy from a fresh account over three tiers, and [rework/12](../rework/12-economy-and-pacing.md) §12's pacing checks; `--variant=`, `--matrix`, `--json` | A check fails, other than the two known misses (D348) |

Flags: races per cell as a bare number, `--tiers=` (the game's scenarios T), `--ladder-only` and `--rates-only` for the
builds, `--coverage-only` and `--content=<dir>` for the careers. The rework's two also take `--write-report`, which
rewrites their committed report in `packages/domain/src/rework/builds/`; the rework pages' live blocks render it, so CI
never runs the engine. Re-run both with it after changing a rule a build or a field reads. `pnpm sim:loop -- --refresh-wins`
does the same for the loop's win table (`packages/domain/src/rework/sim/win-table.ts`); the loop itself runs on the
domain's source, and its test runs the checks in CI.

## The rework modules

The rules of the [game rework](../rework/README.md), built in phase 2 (D340–D350) under
`packages/domain/src/rework/<area>/` and exported lazily as `@racer/domain/rework/<area>`. **None of it is in play
yet.** Phase 3 builds the new game beside today's app ([M034](../tasks/M034-generation-2-cutover.md)): `apps/web/src/g2/`
imports the rework modules, reachable only at `/dev/g2/*` in development, while today's entry imports none of them and
`apps/api` neither. The cutover (T143) makes `g2/` the entry and moves the modules to their final homes.

| Area | Holds |
|---|---|
| `tiers` | The tier map, Racing Level per tier, careers, advancing, promotion, Uma Tickets and Shards, tier scaling, rivals |
| `items` | The 8 × 10 catalogue, crafted items, planet dishes, Duos and Feasts, recipes, grade gates, work values |
| `work`, `farm` | The one-after-another work engine (jobs and sessions, queues, collect, recall, Speed Tickets), buildings, Farm Level |
| `training` | The Training Hub's facilities, layers and unlock order, the Extra Stats map, bonds, presets, buffs, derived stats |
| `constellation` | The re-authored trees, their sizes and the validator |
| `exchange` | Prize Money, the Daily Purse, featured races, the Exchange and selling |
| `check-in`, `planner` | Collect all, Repeat, batch sizing, the check-in summary, the planner's needs and suggestions |
| `builds` | The committed balance reports of `sim:rework-builds` and `sim:rework-careers` |
| `sim` | `pnpm sim:loop`, the whole economy from a fresh account, and its CI checks |

The rules every area follows:
- **Pure.** No I/O, `Date.now`, `Math.random`, React, Dexie or browser globals. Time comes in as `now`, integer
  milliseconds; randomness comes from the race engine's seeded RNG, passed in.
- **Whole seconds through one time factor.** Every duration is a rework base formula in minutes × `TIME_FACTOR` (1.2,
  D338) × 60, rounded once, then divided by a building's speed and rounded once more (`rework/time.ts`).
- **Reuse, don't copy.** Where the rework keeps a rule "as today", the module imports today's (`progression.ts`,
  `scenario-goals.ts`, `constellation.ts`, `lineage.ts`, `opponents.ts` …). Where it changes a formula, the new one
  lives in `rework/` and today's stays for today's game.
- **Numbers are named constants** citing their rework page, pinned by tests beside the modules. A number changes only
  with its page, its test and a decision entry.
- **Art ids are uma-art's**, checked against the package's indexes by a test (`@luismlorenzana/uma-art`, a dev
  dependency of the domain; also a dependency of `@racer/web`, whose new game draws the Hub's buildings from it).
- **State, not saves.** Plain typed state (`rework/types.ts`) shaped after the generation-2 save kinds
  ([rework/13](../rework/13-removals-and-plan-changes.md) §6). Each owner action is a pure function
  `(state, input, now, env?) → { state, receipt } | Refusal`, and a refusal carries plain words, never protocol names.
- **Synthetic fixtures only.** No master data, names or ids from the private packs.
- **The tables are live blocks in the rework pages.** Each area exports `LIVE_BLOCKS`, joined in
  `packages/domain/src/docs/rework.ts`, and the docs check covers `docs/rework/*.md` as well as this manual.

**Generation 2 save.** `packages/domain/src/save-g2/` (`@racer/domain/save-g2`, M034's T134) is the save these rules
run on: eleven kinds of stamped rows, strict parsers, `initialSave` for a new account, `commitOperation` (an operation
through `runOnce`, and the rows it writes), the mapping between rows and the rules' state, and sync v2's wire types.
Like the rules, it is pure and not in play: the generation-2 API and web save layer build on it, and T143 makes it
`@racer/domain/save`. Its contract is [rework/13](../rework/13-removals-and-plan-changes.md) §6.

**The Hub.** Beside the areas, `@racer/domain/hub` (`packages/domain/src/hub/`, T137) is the new game's Hub
([rework/11](../rework/11-hub-and-places.md)): `PLACES`, the 23 places of the four pages with their routes, counters,
uma-art frames and grid cells (rendered in rework/11 §3), and `hubView`, which settles once and gathers what the shell
draws from the rules above: the pill's counts, tab badges, every building's slot pips, the counters, the featured Uma
and the account bar's chips. The registry imports the rules for types only, so the shell's entry chunk reads it cheaply.

## The web app

- **Local-first.** Game state lives in Zustand stores, persisted to the IndexedDB database `uma-racer` (Dexie, 34
  versions, 47 tables). A background sync pushes changes through an outbox.
- **Three sync lanes:** ordinary writes, Puzzle operations and Farm operations take turns.
- **Lazy by default.** PixiJS, Firebase, the race engine and the heavy screens load on demand.
- **The new game beside it** (`src/g2/`, M034): its own entry `g2.html`, served only by the dev server at `/dev/g2/*`
  over synthetic seeds (`?seed=busy | fresh | quiet`), with no auth, content or service worker. It imports only today's
  generic pieces (the `ui/` primitives and icons, `content/`, `auth/`, `scenes/race/`), held by a test both ways, and
  reads the game through one port (`g2/app/game.ts`) that T136's store fills. Places fill the registry's slots
  (`g2/places/registry.tsx`): the Farm's ten share one building page and one job sheet (`g2/places/farm/`, T140), and
  every timed thing shares `g2/ui/work/` (slot cards, Speed Tickets, Recall, queue chips, size chips) and
  `g2/ui/ItemIcon`, each a view over one projection of the work per 30-second tick, every tap through `recheck`.

## The API

| Route | What |
|---|---|
| `GET /api/health` | Liveness. The only route without auth |
| `GET /api/save`, `POST /api/sync` | The save: per-entity rows and append-only logs, versioned, under `players/{uid}` in Firestore |
| `POST /api/farm/prepare`, `/api/puzzles/{prepare,takeover,legacy-spark}`, `/api/inspiration/advance` | One-time preparation and recovery flows |
| `POST /api/rpg/command` | The Global Uma RPG's grouped commands |
| `GET /api/content/manifest`, `/api/content/files/*` | Private content from the `uma-racer-content` bucket, hash-named and immutable |

Every route except health sits behind `AuthGuard`: a Firebase ID token whose email matches `ALLOWED_EMAIL`. In
development, `AUTH_MODE=disabled` and a local JSON file stand in.

## Budgets

- **Startup JS ≤ 180 KB gzip, enforced.** `scripts/check-size.mjs` runs at the end of the web build. It fails when the
  HTML entry, or the entry plus every chunk it statically imports, passes the budget. Dynamic imports don't count.
  Measured at 155.09 KB on 2026-10-14. It also fails when today's build holds a module of the new game (`src/g2/`).
- **The new game's budget is checked from now** (T137): the web build ends with a measure-only build of `g2.html`
  (`vite build --mode g2-size`, no PWA) into the gitignored `dist-g2/`, checked the same way
  (`check-size.mjs dist-g2 g2.html`). Its entry holds the router, the shell's frame, the place registry and the game
  port's interface; the rules, the port, pages and sheets are lazy. Measured at 125.96 KB on 2026-10-14.
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

## Dependencies

<!-- live:dependencies -->
| Package | Dependency | Version | Kind |
|---|---|---|---|
| uma-racer | turbo | ^2.10.13 | dev |
| @racer/web | @luismlorenzana/uma-art | 2.4.0 | runtime |
| @racer/web | @racer/domain | workspace:* | runtime |
| @racer/web | @racer/race | workspace:* | runtime |
| @racer/web | @tanstack/react-query | ^5.102.8 | runtime |
| @racer/web | dexie | ^4.4.6 | runtime |
| @racer/web | firebase | ^12.19.0 | runtime |
| @racer/web | motion | ^12.43.0 | runtime |
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
| @racer/domain | @luismlorenzana/uma-art | 2.4.0 | dev |
| @racer/domain | typescript | ~5.9.3 | dev |
| @racer/domain | vitest | ^3.2.7 | dev |
| @racer/race | @racer/domain | workspace:* | runtime |
| @racer/race | typescript | ~5.9.3 | dev |
| @racer/race | vitest | ^3.2.7 | dev |
<!-- /live -->
