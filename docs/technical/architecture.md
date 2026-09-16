# Architecture

Uma Racer reuses the **uma-planner** architecture (`../uma-planner`), which is already proven in production: a TypeScript
pnpm/Turbo monorepo with a React SPA on Firebase Hosting, a NestJS API on Cloud Run, Firebase Auth with an owner email
allowlist, and Firestore. The main changes for a game are **local-first state**, **client-side simulation**, and a
**private content pipeline**.

## What is reused from uma-planner

| Area | uma-planner | Uma Racer |
|---|---|---|
| Monorepo | pnpm workspaces + Turbo, `tsconfig.base.json` | Same |
| Web | React 18, Vite 5, React Router 6, TanStack Query, Tailwind 3 | Same stack, current majors: React 19, Vite 7, React Router 7, TanStack Query 5, Tailwind 4 |
| API | NestJS 10, `AuthGuard` (Firebase ID token + `ALLOWED_EMAIL`), `AUTH_MODE=disabled` locally | Same pattern, NestJS 11 |
| Persistence | Repository interface with a local JSON file (dev) or Firestore (prod) implementation | Same pattern, for saves |
| Reference data | GameTora JSON importers (`scripts/import-*.cjs`) | Same source (manifest + versioned datasets), output as private content packs |
| Deploy | GitHub Actions with keyless OIDC: Artifact Registry → Cloud Run → Firebase Hosting, with smoke checks | Same workflow, for a new `uma-racer` project |
| Local dev | `pnpm dev` (web on 5173 proxies `/api` to 8080) | Same |

## Repository layout

```text
apps/
  web/        React 19 + Vite 7 + React Router 7 + Tailwind 4 + TanStack Query + Zustand + Dexie
              + Motion (UI animation) + PixiJS 8 (race and effect scenes) + vite-plugin-pwa
  api/        NestJS 11 on Cloud Run: auth guard, save sync, content delivery, health
packages/
  domain/     game rules: types and pure formulas (levels, caps, Race Form, economy, badges). Unit-tested
  race/       deterministic race engine: seeded RNG, fixed 1/15 s tick, timeline output. Unit-tested
scripts/
  data/       GameTora importers → normalized content packs (run locally, never committed)
  assets/     image pipeline: fetch → resize → WebP → sprite atlases; production ops upload the ignored output
infra/        GCP bootstrap and GitHub Actions docs
docs/         design, technical, research
```

Package scope is `@racer/*` (`@racer/web`, `@racer/api`, `@racer/domain`, `@racer/race`).

## Runtime overview

```mermaid
flowchart LR
    subgraph iPhone["iPhone · Home Screen web app"]
        SW[Service worker<br/>app shell + content cache]
        UI[React UI<br/>Motion animations]
        Scene[PixiJS scenes<br/>race playback · effects]
        Store[Zustand game store]
        IDB[(IndexedDB · Dexie<br/>save + outbox)]
        Sim[@racer/race + @racer/domain<br/>run on device]
        UI <--> Store
        Scene --> Store
        Store <--> IDB
        Store --> Sim
    end
    subgraph GCP["GCP project uma-racer"]
        Hosting[Firebase Hosting<br/>SPA]
        Auth[Firebase Auth<br/>owner allowlist]
        API[Cloud Run · NestJS<br/>min instances 0]
        FS[(Firestore<br/>saves)]
        GCS[(Cloud Storage · private<br/>content packs + atlases)]
    end
    SW -.install/update.-> Hosting
    IDB -- outbox sync --> API
    SW -- content packs --> API
    API --> FS
    API --> GCS
    UI -. sign-in .-> Auth
```

### 1. Local-first game state

Gameplay never waits on the network, because Cloud Run cold starts would ruin the game feel.

- The whole save lives in **IndexedDB** (Dexie) on the device and is loaded into a **Zustand** store at boot.
- Save v1 stores only mutable profile, Uma, card, and ledger state. Static names, art, release metadata, and card/skill
  definitions remain in the private content registry and are joined by stable ids at render time.
- A coordinator waits for auth and a verified content version, migrates and parses IndexedDB, then publishes ready state.
  A non-empty local save opens immediately. Only a semantically empty database tries a full cloud bootstrap before
  deterministic starter seeding; an unavailable cloud may seed offline and reconcile through the normal outbox.
- Every action (a training turn, a race, a promotion) runs **on the device** through `@racer/domain` and `@racer/race`,
  updates the store, writes to IndexedDB, and appends changed entities to an **outbox**.
- A saved-Uma Training turn derives its card deal and hint rolls from a stable seed (profile creation time, Uma id, tier,
  and completed-turn count). An empty deck is deterministically auto-filled once from owned eligible stat cards. A chosen
  facility then spends one ticket and writes the profile, Uma, changed cards, append-only spend/reward ledger rows, and
  coalesced outbox work in one Dexie transaction; Zustand publishes only after that transaction commits. Memory-only mode
  runs the same pure mutation but keeps its existing explicit non-persistent warning.
- A background sync flushes the outbox to `POST /api/sync`: batched, debounced, and also when the app goes to the background.
- On a new device, or with an empty local save, `GET /api/save` pulls everything.
- Conflicts: single player, so the server keeps a per-entity `version`. A stale write gets back the server copy, and the
  client adopts it. If a newer local mutation was queued while that request was in flight, its payload is preserved and
  rebased onto the returned server version. Append-only records (race results, ledger) are idempotent by id.
- Every IndexedDB/network shape is parsed before adoption. A corrupt or newer-schema save becomes an explicit recoverable
  error rather than being reset. If IndexedDB itself is unavailable, play can continue in clearly labeled memory-only mode.
- The client is trusted. It's a personal game, so there's no server-side validation of game rules beyond shape checks.

### 2. Deterministic simulation, then playback

- `simulateRace(input) → RaceTimeline` runs the **whole race up front** in a few milliseconds: 18 runners × about 2,250 ticks at 1/15 s.
- The renderer **plays the timeline back** and interpolates between ticks at the display's refresh rate (60 Hz, or 120 Hz where Safari allows).
- This gives free **skip** (jump to results), **replay** (store `seed` + inputs, re-simulate), and **headless batch balance runs** in Node or a Web Worker.
- Randomness only comes from a seeded PRNG passed in with the input. No `Math.random` inside the engine.

### 3. Content: reference data and images

- Game data (Umas, SSR cards, skills, races) comes from GameTora's versioned JSON datasets, the same importer approach as
  uma-planner, and is normalized into **content packs** (`umas.json`, `cards.json`, `skills.json`, `races.json`).
- Images are fetched once by a local pipeline script, normalized without crop into 128×128 WebP frames, and packed into
  deterministic **sprite atlases** used by DOM UI and later race scenes.
- Packs and atlases go to a **private Cloud Storage bucket**. They are never committed to git or put on a public host.
- The app fetches `GET /api/content/manifest` (auth required) and downloads changed packs through the API. The service worker
  caches them by content hash, so after the first download everything loads offline and instantly.
- Protected files are fetched with the Firebase bearer token and verified against their manifest SHA-256 before use. Image
  pages become local Blob URLs for DOM/Pixi consumers; the last known-good manifest selects service-worker-cached files offline.
- In local dev the API serves the same files from a gitignored `content/` folder (`CONTENT_SOURCE=local`), mirroring uma-planner's local repository pattern.

### 4. Auth

- Firebase Auth with Google sign-in, and an API `AuthGuard` that verifies the ID token and the `ALLOWED_EMAIL` allowlist (copied from uma-planner).
- **iOS Home Screen apps:** set `authDomain` to the Hosting domain (`uma-racer.web.app`) so the `/__/auth/handler` is same-origin.
  That avoids Safari's storage partitioning breaking redirect sign-in inside a standalone web app. It also needs
  `https://uma-racer.web.app/__/auth/handler` in the Google OAuth client's authorized redirect URIs, and the service worker must not
  handle `/__/` navigations (denylisted in `vite.config.ts`).
- Sign-in happens once and the session persists. Local play keeps working offline even when the token has expired, and sync resumes after refresh.

## Firestore data model (saves)

```text
players/{uid}/profile/main            currencies, daily date, featuredUmaId, starter marker, schemaVersion, version
players/{uid}/umas/{umaId}            templateId, levels/EXP, stats, aptitudes, deck ids, current library/loadout, version
players/{uid}/cards/{cardId}          templateId, level/EXP, limitBreak, maxCouponGranted, version
players/{uid}/raceResults/{id}        append-only: umaId, raceId, seed, field, placements, rewards, createdAt
players/{uid}/badges/{scope}          earned tiers with dates and race refs, pins, showcase groups, saved views
players/{uid}/ledger/{id}             append-only ticket, coupon, and shard movements
```

The profile's current save-v1 fields are currencies, local daily-grant date, featured Uma id, one-time starter-content
marker, creation time, and schema version. Settings, parents, snapshots, goals, history, badges, and titles are intentionally
added only by their owning tasks through explicit schema migrations; they are not placeholder blobs in save v1.

Entity docs stay far below Firestore's 1 MiB limit, and daily writes stay well inside the free tier (see [Infrastructure](infrastructure.md)).

## Web app structure

```text
apps/web/src/
  app/          shell, router, bottom tab bar, providers
  auth/         Firebase auth provider (from uma-planner)
  api/          fetch client with token provider (from uma-planner), sync client
  game/         Zustand store, Dexie schema/migrations, save coordinator, persistence, outbox sync, content/save joins
  content/      manifest + pack loading, asset URLs
  scenes/       PixiJS race scenes, lazy-loaded
  ui/           game UI kit: GameButton, Panel, Pill, Meter, BottomSheet, Toast, fx
  screens/      Home, Stable, UmaProfile, Training, RaceSelect, PreRace, Race, Results, Cards, Badges, Settings
```

- **Routes are code-split**. PixiJS loads only with Race scenes; Training uses route-split DOM and Motion feedback.
- **Game state goes in Zustand with selectors**, not React context, so a stat tick doesn't re-render the whole tree.
- **TanStack Query** is only for network-owned content loading. Save sync is local-first coordinator state reported through
  Zustand, never a query cache.

## Testing

| Layer | Tooling | Focus |
|---|---|---|
| `@racer/domain` | Vitest | Formulas match the design docs (caps, Race Form, costs, EXP curves) |
| `@racer/race` | Vitest | Determinism (same seed gives the same result), phase boundaries, HP drain, sanity ranges (finish times per distance) |
| API | Vitest | Sync conflict handling, auth guard |
| Web | Vitest + fake IndexedDB, type-check + build, manual on iPhone | Migrations, boot/sync safety, joins/filters/atlas math, feel and 390×844 layout |

CI runs lint, type-check, tests, and builds on every push, as uma-planner's workflow does.
