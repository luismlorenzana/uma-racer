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
  domain/     game rules: types and pure formulas (levels, caps, rivals, economy, badges). Unit-tested
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
        Scene[PixiJS scenes<br/>race playback · puzzle battles · effects]
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
- Save v7 stores mutable profile/Uma/card state, including one constellation per unlocked scenario, scenario-scoped card
  stars (the field is `stars`, so a v6 `limitBreaks` card is never read without its conversion), skill history, and typed Journey slots with frozen series legs. Derived stats, node values, static names,
  art, release metadata, and card/skill definitions stay outside the save and are joined from the private content registry.
  Dexie and cloud adoption migrate older schemas one way, preserve entity versions, and queue only upgraded synced rows;
  the API accepts rollout reads but rejects an older schema over a newer one.
- A coordinator waits for auth and a verified content version, migrates and parses IndexedDB, then publishes ready state.
  A non-empty local save opens immediately. Only a semantically empty database tries a full cloud bootstrap before
  deterministic starter seeding; an unavailable cloud may seed offline and reconcile through the normal outbox.
- Every action (a deck edit, minigame result, race, or promotion) runs **on the device** through `@racer/domain` and `@racer/race`,
  updates the store, writes to IndexedDB, and appends changed entities to an **outbox**.
- A focused domain validator resolves an ordered deck against tier slots, ownership, current content, stat-card type, era,
  duplicate ids, and duplicate characters. The editor, constellation, and racing use that same result. Saving re-reads the Uma
  and selected card rows, updates only the Uma plus its coalesced outbox row in one transaction, and treats an identical
  order as a write-free no-op. Explicit Auto fill remains a pure draft helper; opening a constellation never mutates an empty deck.
- Minigame reservations are save-backed transactions. `beginRun` re-parses the target and profile, returns an existing open
  target run without another charge, or atomically spends the documented ticket, appends its stable ledger id, and stores
  a device-local run row. Its FNV-1a seed derives from profile creation time, content version, target, scenario and attempt.
  Every game stores one engine-tagged frozen snapshot and bounded action journal; these remain device-local and out of the
  cloud save. A generic journal port dispatches `load` and compare-and-`append` through the engine adapter, checking the
  expected prior action count in the same Dexie transaction. Dexie v12 moved open Friendship Training and Spark rows to
  this shape without changing their ids, tickets, seeds or replay states; completed history is untouched.
- `commitRun` is idempotent by run id. It reloads the engine-tagged snapshot and journal, replays them in the pure engine,
  and requires a terminal state plus the screen's matching action-count/state-hash claim. Spark derives Training EXP from
  that authoritative result, applies it through `addTrainingExp` and reports actual constellation node ids/labels opened;
  the screen cannot submit score or EXP. Friendship Training applies a replayed clear only to the named scenario's card
  stars, appends the one-time 5★ coupon when earned (a star pays no tickets, D148), and treats a loss
  as a closed paid run. The profile, affected Uma/card, ledger, Trainer reconciliation and outbox work commit atomically
  before Zustand publishes.
- Collection acquisition uses the same boundary. Shard exchange transactionally derives its next numbered prefix and
  writes the profile plus separate `-5 shards`/`+1 Uma Coupon` ledger rows. A Card or Uma redemption re-reads the profile,
  target entity, private content, and target-keyed ledger row; it then writes the profile, a version-0 canonical entity,
  one coupon spend, and all outbox work atomically. Matching entity+ledger retries return success, ownership without that
  ledger is already-owned, and same-id mismatches are corruption. Zustand publishes only after commit.
- Scenario Start re-reads the child and every chosen frozen parent snapshot inside one transaction. Its pure resolver checks
  snapshot fingerprints and character identity, applies permanent→parent→grandparent collision precedence and sequential
  pink sparks, then persists exact selected snapshots as the active finite lineage. A pending tier-1 Uma writes only its Uma
  entity/outbox; promotion additionally re-reads the profile/deck, freezes the pre-refresh snapshot, spends deterministic
  ledgers, applies promotion/Initial Stats and overflow, refreshes awakening/history, and resets training. Zustand publishes
  only after commit. A race reaching the current global maximum freezes the final snapshot inside the existing result
  transaction. Memory-only mode runs the same pure resolver with an explicit warning.
- Goal-plan v2 is another content-ready coordination step. Every pre-T014 Uma is upgraded in one Dexie transaction after
  its full race history is strictly parsed: earlier tiers become `legacy-untracked`, the current unfinished tier freezes
  three deterministic targets, and only current-tier results are replayed. New Scenario Starts generate post-inheritance
  targets atomically; the v1→v2 pass regenerates only untouched active plans. Promotion/final completion closes the
  previous Journey without inventing rewards or history.
- Goal-plan v4 uses the same content-ready transaction to compare frozen targets with the curated regular catalog. It
  regenerates only an active career with no completed or missed goal when a target was retired; progressed and historical
  journeys remain frozen.
- Milestone 6 introduced the independently versioned `badges` collection; core profile/Uma state is now save v3. T015
  creates one bounded fact/award/preference state per owned Uma and defines a preference-valid `trainer` shell. T016 now
  evaluates the complete per-Uma catalog after each fact transition and during content-ready retroactive reconciliation;
  every changed badge state and append-only event commits inside the triggering Training/race/scenario/collection
  transaction. Lost Training/lineage history stays a labeled lower bound, and unresolved detailed race/completion history
  stays untracked instead of being fabricated. T017 initializes the trainer shell, lazy Uma/Stable collection UI, paged
  timeline reads, and conflict rebase. T018 now authoritatively reconciles that shell from collection, ledger, race,
  Journey, level, and per-Uma award facts and exposes the lazy Trainer scope/profile.
- The private flair overlay is version 2 and maps semantic series legs to one or more race-family aliases, plus exactly 10
  main venues. Normalized races carry sorted `series` and `<tag>:<leg-key>` `seriesLegs` arrays. On every content-ready
  startup the app joins current legs to stored family/venue wins and performs a write-free no-op unless new monotonic flair
  is earned; deterministic retroactive events then feed the existing single archive-summary toast.
- New race rows snapshot bounded accomplishment metadata from the authoritative content/input/timeline without changing
  engine replay versions, plus exact `earnedFlairEventIds` (including `[]`). Deterministic per-Uma `flairEvents` are
  idempotent by scope+Uma+award+stage; retry validates and returns stored ids, while reload renders a summary without fresh
  fanfare. Stable scope remains a live aggregation instead of another persisted copy. Trainer reconciliation replaces
  current aggregates/records while preserving monotonic awards and preferences, and is a write-free no-op when unchanged.
- A progression race uses an append-log sequence per Uma to derive a stable attempt id, seed, gates, and no-duplicate NPC
  field from the private catalog. The saved Uma's current stats/aptitudes and equipped-card Race Bonus feed the client-side
  engine. Supported source skills are compiled into bounded data-only condition/effect objects before simulation; the race
  engine never evaluates source strings. Engine v3 also joins, validates, clips, and snapshots the selected private course's
  corner/straight geometry before simulation. At the finish, one Dexie transaction revalidates and re-simulates the attempt, updates Uma EXP/levels and profile
  rewards, then appends the typed race result plus deterministic level-ticket/gate-shard ledger ids and outbox work. A
  goal evaluation updates the active Journey and snapshots exact `completedGoalIds` on the result in that same transaction.
  A matching retry reads the existing result and pays/animates nothing twice; abandoning before the finish writes nothing.
- A background sync flushes the outbox to `POST /api/sync`: batched, debounced, and also when the app goes to the background.
- On a new device, or with an empty local save, `GET /api/save` pulls everything.
- Conflicts: single player, so the server keeps a per-entity `version`. A stale write gets back the server copy, and the
  client adopts it. If a newer local mutation was queued while that request was in flight, its payload is preserved and
  rebased onto the returned server version. Append-only records (race results, ledger) are idempotent by id, and **the first write wins**: a later copy of an id
  with different contents (two devices claiming the same day's grant, say) is kept out with a warning rather than failing
  the batch, which once froze sync for five days (D149).
- Every IndexedDB/network shape is parsed before adoption. A corrupt or newer-schema save becomes an explicit recoverable
  error rather than being reset. If IndexedDB itself is unavailable, play can continue in clearly labeled memory-only mode.
- App-shell and private-content releases remain independently visible. The build commit is injected into Settings, content
  keeps its manifest version/origin, and a waiting or newly controlling service worker offers an explicit restart. That
  restart is deferred while Training, Expedition completion, race completion, redemption, promotion, or Scenario Start is committing. Content
  diagnostics distinguish auth, publication, missing-object, integrity, network, and verified-offline states without ever
  clearing the local save. Open minigame reservations also block silent rerolls by restoring their saved seed after reload.
- The client is trusted. It's a personal game, so there's no server-side validation of game rules beyond shape checks.

### 2. Deterministic simulation, then playback

- `simulateRace(input) → RaceTimeline` runs the **whole race up front** in a few milliseconds: 18 runners × about 2,250 ticks at 1/15 s.
- The renderer **plays the timeline back** and interpolates between ticks at the display's refresh rate (60 Hz, or 120 Hz where Safari allows).
- This gives free **skip** (jump to results), **replay** (store `seed` + inputs, re-simulate), and **headless batch balance runs** in Node or a Web Worker.
- Randomness only comes from a seeded PRNG passed in with the input. No `Math.random` inside the engine.
- Legacy T005 results have no `engineVersion` and replay through the frozen skillless engine-v1 path. Engine-v2 results
  snapshot their course and every runner's compiled skill list. Engine-v3 additionally snapshots bounded course geometry
  and simulates pack state with a separate per-runner RNG stream. Replays dispatch to explicit v1/v2/v3 entry points and do
  not recompile mutable catalog data.
- A v3 timeline adds a compact `Float32Array` of continuous lane samples plus typed mode/block/overtake/lane events. Pixi
  interpolates distance and lane into pooled runner tokens without allocating per animation frame; the renderer keeps gate
  identity separate from simulated lateral position.
- Race presentation has a second, renderer-only clock. A pure controller holds timeline time at zero during the gate
  pre-roll, applies optional close-finish slowdown/hold, and makes seek/skip/reduced-motion behavior testable without Pixi.
  A second pure projection serializes timeline events into one cue slot and derives course labels and result activation
  summaries. Neither clock nor cue state is persisted, included in the engine version, or consulted by reward completion.
- Spark Rival Circuit uses the same simulation/playback boundary at turn scale. Its pure TypeScript reducer is
  `replay(encounter, seed, actions)`: it validates each path, owns seeded fills/cascades/rival choices, and emits resolution
  steps. The lazy PixiJS scene plays those steps while a React HUD shows Drive, Resolve, Spark and intent. Pointer sampling,
  animation frames and wall time never enter the reducer; a renderer may drop frames without changing a result.
- The puzzle canvas captures one Pointer Event stream directly and mutates renderer objects without a React render per
  `pointermove`. A deterministic grid traversal fills skipped cells. Pixi sprites and effects are pooled, the ticker uses
  elapsed milliseconds and pauses while hidden, and refresh rate affects presentation only. Production scene code accepts
  an explicit encounter/seed and has no synthetic proof controls; the development proof owns those in a separate subclass.
  Spark preallocates 30 board tokens, 24 effect tokens and 8 combat-label tokens. Its proof overlay reports timing,
  pool use, journal action count, state hash, content source and pause state without exposing content ids.

### 3. Content: reference data and images

- Game data (Umas, SSR cards, skills, races, courses, and career-objective references) comes from GameTora's versioned JSON
  datasets, the same importer approach as uma-planner, and is normalized into content packs. Objective rows are reduced to
  ordered race-family ids only; names, conditions, turns, fans, nested rows, and source ids unrelated to the join are not
  copied into the packs.
- Claude maintains the gitignored flair overlay used to stamp semantic race-series legs and the 10 main venues. Import
  validation resolves every private family/venue reference, while checked-in docs, logs, and tests contain only semantic
  tags, aggregate coverage, and synthetic fixtures.
- Spark Rival Circuit follows the same private-overlay boundary. `content/overrides/spark-rivals.json` names each
  scenario's eligible training rivals and bosses by private Uma template id plus a checked-in semantic behavior vocabulary;
  import emits a hashed `spark-rivals` pack. Git contains its schema, aggregate coverage and synthetic fixtures only. A
  deterministic catalogue fallback keeps an old content publication playable, but release validation still requires all
  fourteen authored rosters.
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
players/{uid}/umas/{umaId}            save v7: level/EXP, unlocked tier, one training run per scenario, history, version
players/{uid}/cards/{cardId}          save v7: templateId, stars per scenario, maxCouponGranted, version
players/{uid}/raceResults/{id}        append-only: engine/course, field, rewards, goal/accomplishment facts, flair ids, createdAt
players/{uid}/badges/uma:{umaId}      badge-state v1: bounded facts, awards, title, showcase, saved views
players/{uid}/badges/trainer          badge-state v1: account aggregates/records, awards and preferences
players/{uid}/ledger/{id}             append-only ticket, coupon, and shard movements
players/{uid}/flairEvents/{id}        append-only per-Uma/Trainer award evidence and source refs
```

Firestore cannot store an array directly inside another array, and a race record's compiled skill conditions are one.
A record whose data holds a nested array is written with its data as JSON text (`dataJson`) and decoded on every read;
all other records keep `data` as a map (D151).

The profile is save v4 and retains currencies, local daily-grant date, featured Uma id, one-time starter-content marker,
creation time, and schema version. Every Uma row is also explicitly v4. Parent/snapshot/history and strict Journey goal
fields are present, including per-leg evidence for series goals; pending setup has no active Journey, active scenarios
have exactly one for the current tier, and final completion has none. The nullable `scenarioModifier` is a separately
versioned strict union initialized/replaced by Scenario Start; v3 rows migrate to null without inventing active-tier
progress. Badge-state v1 is independently migratable and cannot force a progression save reset.

Race history is intentionally the typed append-only `raceResults` collection, not a growing array duplicated inside each
Uma entity. Static race/Uma names and art are joined from the current private content registry at render time; deterministic
course facts, runner stats/aptitudes, compiled skills, newly completed goal ids, bounded accomplishment facts, and fresh
flair event ids are snapshotted for replay/result truth. Flair events are a separate append-only audit/timeline log; badge
entities hold current bounded progress and preferences, not a copy of every event.

Entity docs stay far below Firestore's 1 MiB limit, and daily writes stay well inside the free tier (see [Infrastructure](infrastructure.md)).

## Web app structure

```text
apps/web/src/
  app/          shell, router, bottom tab bar, providers
  auth/         Firebase auth provider (from uma-planner)
  api/          fetch client with token provider (from uma-planner), sync client
  game/         Zustand store, Dexie schema/migrations, save coordinator, persistence, outbox sync, content/save joins
  content/      manifest + pack loading, asset URLs
  scenes/       PixiJS race and Spark Rival Circuit scenes, lazy-loaded
  ui/           Paddock kit (visual-system.md): Button, Chip, SegmentedControl, Panel, Row, Pill, Meter, ArtTile, BottomSheet, Toasts;
                icons/ holds the original icon set, one module per icon
  screens/      Home, Stable, UmaProfile, Training, RaceSelect, PreRace, Race, Results, Cards, Badges, Settings
```

- **Routes are code-split**. PixiJS loads only with Race or Spark Rival Circuit scenes; Training uses route-split DOM and Motion feedback.
- The Cards album/detail and Card Select routes are also split. They join the full private catalog to account-wide card saves and call the
  same generated effect projection used by Training and progression racing, so displayed LB values cannot drift from play.
- Stable joins the complete private Uma catalog for honest outfit-level completion and silhouettes. The full-screen
  collection reveal is separately split and resolves safe kind/id params back to an already-owned entity; it has no
  mutation path, so back, reload, and direct navigation cannot spend a second coupon.
- Scenario Start is separately split. Its review is pure and write-free; the confirmation calls the same promotion result
  used by persistence, and the success route reconstructs from committed save facts rather than keeping a second game state.
- Scenario-modifier projections are pure domain functions shared by Training previews/commits and race-win rewards. The
  one modifier field is written inside the existing Uma transaction; no resource becomes a ledger row. Project L'Arc's
  ready-expedition action re-reads and updates only the Uma plus its coalesced outbox row, raises an ordinary visible
  aptitude at most to A, and shares Training's same-Uma lock and update-restart boundary. Other modifier state never enters
  race input construction.
- Goal and Journey projections remain small pure DOM view models. Home, Profile, Race Select, pre-race, and Results join
  persisted ids to private content with safe fallbacks; goal state never enters Pixi or changes simulation inputs.
- Badge/catalog/evaluator and Trainer aggregation stay pure in `@racer/domain`. Each affected local action runs the same
  deterministic Trainer reconciliation inside its existing Dexie transaction, so action-time updates and boot repair
  cannot drift. Web view models join current private labels,
  apply filters/sorts/search, and window the lazy Badge route. Preference commands re-read and replace only title/showcase/
  saved-view fields so stale UI cannot overwrite newly earned facts. A sync conflict adopts the server's newer award facts,
  filters local references against those facts, and queues still-valid local preferences on top. Timeline pages walk the
  `createdAt` IndexedDB cursor and filter one Uma without materializing other Umas' logs. Profile/Home/Stable/reveal surfaces
  consume the same pure Prestige-frame projection.
- **Game state goes in Zustand with selectors**, not React context, so a stat tick doesn't re-render the whole tree.
- **TanStack Query** is only for network-owned content loading. Save sync is local-first coordinator state reported through
  Zustand, never a query cache.

## Testing

| Layer | Tooling | Focus |
|---|---|---|
| `@racer/domain` | Vitest | Formulas match the design docs (caps, rivals, costs, EXP curves) |
| `@racer/race` | Vitest | Determinism (same seed gives the same result), phase boundaries, HP drain, sanity ranges (finish times per distance) |
| API | Vitest | Sync conflict handling, auth guard |
| Web | Vitest + fake IndexedDB, type-check + build, manual on iPhone | Migrations, boot/sync safety, joins/filters/atlas math, feel and 390×844 layout |

CI runs lint, type-check, tests, and builds on every push, as uma-planner's workflow does.
