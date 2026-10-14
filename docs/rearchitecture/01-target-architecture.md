# 01 · Target architecture

What uma-racer looks like after the rebuild (D321), and what happens to every part of it today. The layer choices
are uma-platform's baseline (architecture §4) as uma-rpg runs it: React 19, Vite, Tailwind 4, Motion, Zustand +
Dexie, NestJS on Cloud Run, Firebase Hosting and Auth, PWA, pnpm 10, Node 22, Turbo, strict TypeScript, Vitest.

## 1. The approach: a clean skeleton, rules ported in

The wipe (D323) means no old save has to load, so nothing that exists only to carry old data has to survive.
The rebuild therefore splits the code in four:

| Treatment | What | Why |
|---|---|---|
| **Keep** | `packages/race`, and the pure rule modules of `packages/domain` listed in §3 | Tested, deterministic, and the heart of the game. Moved only if a folder changes |
| **Port** | Screens, view models and UI components for racing, cards, Stable, profile, constellation, badges, Farm, Puzzles, Friendship | Same behaviour, new imports: the save layer, content and scene APIs change under them |
| **Rewrite** | The save (`save.ts`), local database, persistence, sync, runtime, Home, content loading, API save module, Dockerfile, CI | These carry 33 migrations, 34 Dexie versions, three sync lanes and four cutover machines that generation 2 doesn't need |
| **Delete** | The RPG ([06](06-rpg-decommission.md)), Spark Rival Circuit (retired by D287 and still routed), the v1/v2 Farm, every cutover, preservation, advance and legacy path, the GameTora pipelines, the API's generated copies, PixiJS outside the Puzzles | Dead after the wipe, or owned elsewhere now |

It is done in place on `main`, in the pull requests of [08](08-phases.md), not in a new repo. History, issues,
the deploy pipeline and the private content bucket stay where they are.

## 2. Repository after the rebuild

```text
apps/
  web/            React 19 + Vite + Tailwind 4 + Motion; Phaser 4 scenes (Hub, Farm, race); PWA
  api/            NestJS 11 on Cloud Run: auth, save v2, master data proxy, racer overlays, health
packages/
  domain/         pure rules, split into lazy subpath exports (§3); builds ESM source + a CJS dist for the API
  race/           the deterministic race engine, unchanged
scripts/
  overlays/       racer-only private content: flair, card focus, Puzzle cast/monsters (was scripts/data + scripts/assets)
  sim/            headless balance runs (race, career, cards, Farm, Puzzles)
  check-size.mjs  the startup JS budget, run by `pnpm build` (from uma-rpg)
docs/
  game/           the live manual, generated lists checked by CI (from uma-rpg D92)
  design/ technical/ research/ tasks/ decisions.md open-questions.md
infra/            the GCP bootstrap, unchanged
```

Gone from the tree:

- `scripts/data` and `scripts/assets` as GameTora and wiki pipelines (uma-platform owns them; [02](02-platform-and-packages.md)).
- `apps/api/src/save/puzzle-domain/**` and `farm-domain/**`, about 17,800 generated lines, and the two
  `sync-*-adapter.mjs` scripts.
- `apps/api/src/save/save.types.ts` and `rpg-save.types.ts`, hand-kept copies of the domain's wire contract.

## 3. The domain package

One package, still pure TypeScript with no runtime dependencies, split into **lazy subpath exports** the way uma-rpg
did it (H16). Startup imports only what it needs; each screen or the API imports its own part.

| Export | Holds (today's modules) | Treatment |
|---|---|---|
| `@racer/domain` | `types`, `scenarios`, `economy`, `collection`, `progression`, `career-stages`, `scenario-promotion`, ids and labels | Keep |
| `@racer/domain/save` | The generation-2 save: entity and log kinds, parsers, `createInitialSave` (20 Uma Tickets), the sync v2 wire types | **Rewrite** (§5) |
| `@racer/domain/master` | The master-data adapter: uma-data records → `UmaTemplate`, card effects, eras, the race catalogue | **Rewrite** from `content.ts` ([02](02-platform-and-packages.md) §2) |
| `@racer/domain/racing` | `race-skills`, `progression-race`, `opponents`, `course-layout`, `race-pack`, `race-catalog`, `skill-tags` | Keep |
| `@racer/domain/training` | `constellation`, `constellation-shapes`, `derived`, `scenario-buffs`, `scenario-goals`, `training`, `training-level-up`, `lineage`, `inspiration`, `inspiration-exchange`, `preset-carry` | Keep; Inspiration gains its goal-win source ([06](06-rpg-decommission.md) §5) |
| `@racer/domain/cards` | `cards`, `card-progression`, `card-focus`, `support-deck` | Keep |
| `@racer/domain/badges` | `badges`, `flair`, `badge-preferences`, `trainer-achievements` | Keep |
| `@racer/domain/farm` | `farm/kitchen/*` (catalogue, production, operations, resolver, extra map) and `extra-stats` | Keep the rules; delete `cutover`, the v1/v2 `rules`, `progression`, `reconciliation`, `legacy` |
| `@racer/domain/puzzles` | `minigames/uma-puzzles/*` | Keep battles, campaign, materials, exchange, CL spend; delete `preservation*`, `legacy*`, `legacy-spark*` and the debt side of the bank |
| `@racer/domain/minigames` | `minigames/friendship/*` and the run contract | Keep |
| — | `rpg/`, `spark-rival.ts`, `minigames/spark-rival/`, `inspiration-bank.ts` (the D256 advance) | **Delete** |

The package builds a CommonJS `dist/` with `tsc -p tsconfig.cjs.json` for the API, exactly as uma-rpg's domain does;
the web app keeps importing the TypeScript source.

## 4. The web app

### 4.1 Shape

```text
apps/web/src/
  app/        router, providers, shell (AccountBar, page tabs, overlays), update prompt
  hub/        the Hub: canvas host, place hit layer, page tabs, place registry UI (04)
  places/     one folder per place: stable/, race/, cards/, trophies/, farm/, puzzles/, training/, settings/ …
  scenes/     Phaser scenes: hub/, farm/, race/  ·  puzzles/ (PixiJS until D324 resolves)
  save/       the generation-2 store: db, outbox, sync, store, actions
  content/    master data + overlays through the shared content client (02)
  ui/         racer components ("Paddock" visual system), icons
```

Screens become **places** (uma-rpg's pattern): each has a Peek (a short side panel), a Page (its full screen) and
optionally a Counter (a number on the Hub), registered in one table and lazy-loaded. A route is
`/:page/:place/*`, so every place is a link and Back works ([04](04-hub.md)).

### 4.2 State and persistence

- **Zustand** holds the game state with selectors, as today. One store (`save/store.ts`) replaces `useGame`,
  `usePuzzleSync`, `usePuzzlePreparation`, the Inspiration-advance store and the FarmKitchen store.
- **Dexie** database `uma-racer-g2`, schema version 1. One table per entity kind and log kind, plus `outbox`.
  Device-only tables are only what a feature truly needs on one device: `minigameRuns` (run journals) and the open
  Puzzle battle's journal.
- **localStorage** keeps per-device conveniences only (last tab, guide seen). Every key is prefixed `uma-racer:g2:`.

### 4.3 Sync (protocol v2)

Today's per-entity model is right for this game and stays: race results and flair events are append-only logs that
grow without bound, so a single save document (uma-rpg's model) would outgrow Firestore's 1 MiB limit.

What changes:

- **One lane.** Ordinary writes, Farm operations and Puzzle operations flush through the same outbox in order. The
  three round-robin economic lanes existed to keep preparation flows apart; those flows are gone.
- **Three record shapes:** entities (`kind/id`, versioned, last-write-wins on a matching base version), logs
  (append-only, first write wins) and **operations** (an atomic multi-entity command such as "claim a Farm job",
  which the server re-runs with the domain package before committing). Operations replace `/api/farm/prepare`,
  `/api/puzzles/*` and `/api/rpg/command`.
- **A generation and protocol stamp on every request** (`generation: 2`, `protocol: 2`). The server refuses anything
  else with `426 Upgrade Required`, so an old installed app can never write into the new save
  ([07](07-data-reset.md) §4).
- **A missing server document only accepts a create** (`baseVersion: 0`). Today it accepts any upsert, which is how a
  stale device re-uploads a wiped save.
- **Boot:** a local database with rows opens at once (local-first). An empty one pulls `GET /api/save`, and creates
  the initial save only if the server is empty too. That's today's rule without the cutover checks around it.

### 4.4 Content

Two sources, one client ([02](02-platform-and-packages.md)):

- **Master data and Uma art** from uma-platform's release, through `/api/master/*`, verified by hash and cached.
- **Racer overlays** (flair, card focus, Puzzle content) from the racer bucket, through `/api/content/*`, as today.

### 4.5 Budgets and performance

- **Startup JS ≤ 180 KB gzip, enforced.** `scripts/check-size.mjs` (uma-rpg's) fails `pnpm build` when the entry
  chunk passes the budget. Phaser, Firebase, the race engine, every place's Page and every domain subpath beyond the
  core load lazily.
- One canvas engine alive at a time, destroyed when its screen closes and paused when the app is hidden
  ([03](03-rendering-and-textures.md) §2).
- The rules carried over from `docs/research/game-web-tech.md`: 390×844 portrait first, 44 pt targets, safe areas,
  transform and opacity animation only, elapsed time for every animation.

## 5. The save, generation 2

> **Revised by [rework/13](../rework/13-removals-and-plan-changes.md) §6.** The generation-2 save holds the rework's
> kinds: no `cards/{cardId}`, no Puzzle kinds and no today's-Farm kinds, plus `work/{outfitId}`, `buildings/{id}` and
> the rework's profile. The table below is the first draft's.

Rewritten from scratch in `@racer/domain/save`. One schema version (1) per entity kind, no migrations, no legacy
constants. Version bumps after launch follow uma-rpg's rule: a migration only when real data must survive.

| Kind | Holds | Notes |
|---|---|---|
| `profile/main` | Training Tickets, **Uma Tickets**, Uma Shards, Card Coupons, daily grant date, featured Uma, created at, `generation: 2` | `umaCoupons` is renamed Uma Tickets; the Training EXP bank and the starter-seed marker are gone |
| `umas/{outfitId}` | Uma Level and EXP, unlocked tier, one run per unlocked scenario (CL, Inspiration, four presets, journey), skill history, race defaults, active preset | Today's v15 shape without the save16 stamping or the retired Extra-stats fields |
| `cards/{cardId}` | Global stars, max-coupon flag | Unchanged |
| `badges/uma:{id}`, `badges/trainer` | Badge state v1 | Unchanged |
| `farm/main`, `farmWorkers/{outfitId}`, `farmRecipes/b{n}`, `farmExtra/{outfit}:b{n}` | The Farm ([05](05-farm.md)) | No generation counter, cutover or recovery rows |
| `items/{itemId}` | Item stacks: produce, meals, Puzzle materials, Inspiration tokens, Energy | One inventory |
| `puzzleOutfits`, `puzzlePresets`, `puzzleCheckpoints`, `puzzleBank/main` | Uma Puzzles | The bank keeps only balances and exchange unlocks; preservation, cohort and debt are gone |
| Logs: `raceResults`, `ledger`, `flairEvents`, `itemLedger`, `puzzleResults`, `operations` | Append-only | One `operations` log replaces `farmOperations` and `puzzleOperations` |

## 6. The API

```text
apps/api/src/
  auth/      AuthGuard from @luismlorenzana/uma-auth (Firebase token + ALLOWED_EMAIL; AUTH_MODE=disabled for dev)
  save/      GET /api/save · POST /api/sync (v2) · Firestore repository at saves/{uid}/… · local JSON repository for dev
  master/    GET /api/master/manifest · /api/master/files/* — the uma-platform release, read-only (uma-rpg's module)
  content/   GET /api/content/manifest · /api/content/files/* — racer overlays (today's, minus RPG packs)
  health.controller.ts
```

- It imports `@racer/domain` (built CJS) for every validation and every operation. The Dockerfile follows uma-rpg's:
  install the workspace, build the domain, build the API, `pnpm deploy --prod --legacy`, with the npm token passed as a
  build secret for `@luismlorenzana/*`.
- Deleted endpoints: `/api/rpg/command`, `/api/inspiration/advance`, `/api/puzzles/{prepare,takeover,legacy-spark}`,
  `/api/farm/prepare`.
- The service account gains `roles/storage.objectViewer` on `gs://uma-platform-master-data` (a uma-platform session
  grants it, as it did for uma-rpg).

## 7. Tests, sims and docs

- **Kept:** domain and race tests for every kept module, API save and sync tests (rewritten for v2) and web view-model
  tests. Synthetic fixtures only, as today.
- **Deleted with their code:** RPG, Spark, legacy Farm, cutover, preservation, migration and Dexie-upgrade tests.
- **Sims:** `sim:balance`, `sim:cards`, career and training sims, `sim:farm`, `sim:puzzles` stay. `sim:rpg:campaign`,
  `sim:spark` and `sim:farm:legacy` go.
- **The live manual.** `docs/game/` is added with uma-rpg's renderer (`packages/domain/src/docs/render.ts`,
  `pnpm docs:update`, a test that fails on a stale page). Its lists come from the code: scenarios, the race catalogue,
  the constellation shapes, the Farm catalogue, places, prices and caps.
- **The design docs** stay the intent; each page states "as built" once its phase lands. Docs about deleted systems
  are deleted (git keeps them).

## 8. Deploy and infra

- **The workflow stays:** verify (`lint`, `test`, `build`) on every push and pull request, deploy on `main` through
  keyless WIF, and smoke checks for `/api/health` 200 and `/api/save` 401.
- **New in CI:** `NODE_AUTH_TOKEN` for GitHub Packages (`read:packages`), the size check, and the Docker build secret.
- **GCP stays:** project `uma-racer`, Cloud Run `racer-api`, Firestore, the bucket `uma-racer-content`, the $5 budget.
  The only new grant is read access to the platform bucket. No new resources and no new cost: Firestore usage drops
  with the wipe.
