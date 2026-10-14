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
| `pnpm sim:rework-builds` | The stamina ladder and the G1 grid on full-layer rework builds at every T = 1–14 against T125's fields, and each buff's typical value | A hard ladder check fails, other than those waiting for the owner (`LADDER_OPEN_MISSES`) |
| `pnpm sim:rework-careers` | Every career of the private pack frozen by the rework's rule, and each stage's best case on full-layer builds at every T, against [rework/03](../rework/03-uma-progression.md) §12's targets | A career can't be frozen, or a cell falls under 25% |

Flags: races per cell as a bare number, `--tiers=` (the game's scenarios T), `--ladder-only` and `--rates-only` for the
builds, `--coverage-only` and `--content=<dir>` for the careers. The rework's two also take `--write-report`, which
rewrites their committed report in `packages/domain/src/rework/builds/`; the rework pages' live blocks render it, so CI
never runs the engine. Re-run both with it after changing a rule a build or a field reads.

## The web app

- **Local-first.** Game state lives in Zustand stores, persisted to the IndexedDB database `uma-racer` (Dexie, 34
  versions, 47 tables). A background sync pushes changes through an outbox.
- **Three sync lanes:** ordinary writes, Puzzle operations and Farm operations take turns.
- **Lazy by default.** PixiJS, Firebase, the race engine and the heavy screens load on demand.

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
  Measured at 155.10 KB on 2026-10-14.
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
