# Architecture

## Planned Farm production/cooking replacement

[M031](../tasks/M031-farm-kitchen-rework.md) has completed T118's pure rules (D304) and T119's dormant
save/sync implementation (D306). [The contract](farm-kitchen-implementation.md)
implements Farm3 and separate worker/recipe/Extra records, atomic semantic commands in the authenticated sync
endpoint, an exact-source standalone API mirror, additive Dexie32 and an acknowledged-only inventory with
device-local intent/predictions. Local-file and Firestore adapters share the pure resolver; ordinary Farm-owned
writes and retired Extra resurrection are guarded by an implicit cutover read. The owner chose the existing Farm's
trusted-device deadline model, preserving offline intent; server time stamps acknowledgements. No global Uma/profile schema bump.
T120/D307 adds an authenticated, dormant preparation endpoint, immutable freeze/step/page-verification/final
receipts and a separate SHA-256 whole-account archive in device-only `farmRecovery`. Per-outfit reset steps patch
current non-Farm fields, not frozen whole objects; legacy deadlines/stock/history remain. Archive/cutover adapters
are lazy; no Dexie reset callback or normal startup request. Full pulls merge the retired Extra whitelist without
resurrecting historical bonuses. T121/D308 implements the lazy real host, acknowledged/pending views, bounded
target/dependency reads, durable Collect/retry and private recovery export. Separate Zustand/Dexie subscriptions
derive readiness read-only; a new control always blocks legacy writers. Normal flag-off boot initializes no kitchen
rows. Serialized round-robin sync lanes avoid ordinary/Puzzle/Farm starvation. T122–T124 still own screens/stat joins
and enablement. Both Farm gates are false;
the existing Farm described below stays live until T124 and no account reset is executed by intermediate work.

## Global card progression (D255)

Card rows have independent schema 1: `{ schemaVersion: 1, templateId, stars: 0..3, maxCouponGranted }`.
Uma/profile save v15 and the four distance presets remain unchanged. Dexie v25 migrates legacy card maps to the
maximum converted count, retaining row versions and coalescing upload writes. Cloud adoption queues migrated raw
card rows too; conflict reconciliation keeps maximum stars/OR coupon flags, and API writes cannot downgrade either
the card schema or progress. Sets and node assignments retain owned card ids; readers apply the global count with
the original scenario's era multiplier. Friendship Training discovers open reservations per card across contexts,
but leaves paid legacy ids/seeds/setup/journals untouched and displays the frozen scenario when resumed.

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

Uma Puzzles' additive pure rules, battle and campaign v1 live in `packages/domain/src/minigames/uma-puzzles/` (D269–D271).
Their real local-first host calls them: [the versioned contract](uma-puzzles-implementation.md#t107-implemented-battle-v1-d270)
documents independent board/RNG, authoritative events, replay, generated maps and once-account reward projections.
The campaign uses fixed authored level/role scaling, not the entering party; private cast joins are explicit inputs.
T116 enables the release (D289–D290) with verified original-placeholder content, a whole-account device-local backup
before protected cutover, free battles and the shared CL material sheet. Spark is retired for active bank2 accounts;
historical replays and facts remain. Owner gameplay/device acceptance is [tracked separately](../research/uma-puzzles-release-acceptance.md).

- The whole save lives in **IndexedDB** (Dexie) on the device and is loaded into a **Zustand** store at boot.
- Save v15 is the pre-cutover schema; protected preservation stamps profile/Uma v16 with zero retired Training EXP,
  retained CL and four distance builds per unlocked scenario. It preserves nullable per-outfit race
  defaults (null preserves automatic recommendations), global card stars in independent card schema 1
  (following scenario-map, five-star and limit-break migrations), skill history, typed
  Journey slots with frozen series legs, card/lineage assignments and each unit's Extra stats grid (save v12, D235). Derived stats, node values, static names,
  art, release metadata, and card/skill definitions stay outside the save and are joined from the private content registry.
  Dexie and cloud adoption migrate older schemas one way, preserve entity versions, and queue only upgraded synced rows;
  the API accepts rollout reads but rejects an older schema over a newer one.
- A coordinator waits for auth and a verified content version, migrates and parses IndexedDB, then publishes ready state.
  A non-empty local save opens immediately. Only a semantically empty database tries a full cloud bootstrap before
  deterministic starter seeding; an unavailable cloud may seed offline and reconcile through the normal outbox.
- Every action (a deck edit, minigame result, race, or promotion) runs **on the device** through `@racer/domain` and `@racer/race`,
  updates the store, writes to IndexedDB, and appends changed entities to an **outbox**.
- Stable Farm uses an independent `FarmHost`, not `MinigameHost`. Dexie v14 adds one lazy `farm/main` entity, versioned
  `items/{itemId}` stacks and append-only `itemLedger/{cycleId}` evidence. Assignment and planting update Farm plus its
  coalesced outbox marker; harvest commits Farm, stack, evidence and all three outbox markers atomically. A device-local
  command revision rejects stale screens without changing the server entity version used by sync.
- Farm/item conflict adoption is followed by evidence reconciliation inside the same Dexie transaction. Unique movement
  ids rebuild stack quantity and harvest XP, advance plot attempt floors and clear a harvested cycle resurrected by a
  stale Farm copy. Matching projections are a write-free no-op; IndexedDB-unavailable play uses the same port in memory.
- Home reads an aggregate Farm projection and `/farm` lazy-loads the full-screen Field / Workers / Crops / Items shell.
  One visibility-aware minute clock derives readiness without persistence writes. The Item view joins synced stacks to
  the checked-in catalog; owned/all, stat, scenario and density preferences reuse device-local `albumPrefs` and never sync.
  Settings diagnostics expose aggregate Farm/item/ledger counts only, never private item names or ids.
- Dexie v15 walks v8 Uma rows to save v9 by translating filled Stat assignments to stat-only Legacy Produce. It creates
  no stack or evidence. A new Produce fill/replacement uses a pure expected-revision command and one transaction across
  Uma, item stack, `-1 constellation-produce` evidence, badge/flair reconciliation and outbox. Evidence ids include Uma,
  tier, node and replacement revision; matching retries pay once, stale screens reload, and Zustand publishes after commit.
  Save v12 (Dexie v21) replaced Produce nodes with each unit's Extra stats grid (D235): filled Produce nodes become
  bought, active grid nodes. Save v13 (Dexie v22) costs every scenario's Uma Levels the same (D241): each v12 Uma
  re-levels through her current scenario's EXP, stopping at her career hold and the gate, and the walk pays each level
  it reaches (`uma-level-tickets:<umaId>:<level>`, and `uma-gate-shard:<umaId>:<gate>`) in the same transaction, skipping
  ids already in the ledger; a cloud snapshot adopted from v12 pays the same after its ledger loads. A purchase is one transaction across Uma, item stack, `extra-stat-unlock` evidence
  `extra:<umaId>:<tier>:<nodeId>` (−1…−4), badge/flair reconciliation and outbox; switching nodes is an Uma-only write.
- Dexie v16 walks v9 Uma rows to save v10, adding null race preferences without regenerating any frozen journey.
  Editing preferences upserts only that Uma; the API validates the exact union and sync carries the same row.
- Dexie v17 walks every older Uma to v10's shape and then re-levels it once to v11 through its total Training EXP
  (`migrateUmaSaveWithSurplus`). Only a profile migrating in the same pass banks the surplus past TL10 (a legacy cloud
  save adopted on a new device does the same from its raw rows), so an already-migrated profile never banks it twice.
  Startup settles a bank holding a full level into Level-Up Tickets (`exp-bank:settle:<now>`), where the item tables
  always exist; a Spark commit deposits and converts in its own transaction (`exp-bank:<runId>`).
- Dexie v18 adds synchronized RPG outfit, preset, checkpoint and evidence tables plus a device-local pending-command
  queue. It creates no enrollment. An older cloud snapshot leaves existing local RPG rows in place; a newer copy wins
  by version, and equal-version divergence stops adoption visibly. Normal save v11 profile/Uma/Farm/Items rows are not
  migrated by this additive schema change.
- Dexie v19 adds only device-local RPG battle journals, lease markers and displaced-journal archives. The journal is
  keyed by frozen entry and retry ordinal, holds engine-versioned actions plus a replay hash, and never syncs. A
  missing/corrupt journal requires an explicit same-entry restart; a second device requires an acknowledged lease
  takeover before it can restart that frozen entry. No save-v11 row or RPG cloud schema changes in this migration.
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
  the screen cannot submit score or EXP. Friendship Training applies a replayed clear to the owned card's global stars (D255), with the named scenario as frozen play context
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
- RPG rows sync like every other row (D263): outfits, parties, runs (`rpgCheckpoints` schema 2), result and promotion
  logs, Items and ledger go through `/api/sync`. `/api/rpg/command` survives only for an older app's `spend-inspiration`.
- Uma Puzzles adds a separate optional semantic operation lane in `/api/sync` (T110/D273), not a replacement RPG
  protocol. All EXP/stock/debt/CL projections and evidence commit or reject together; same complete payload retry
  returns its receipt before revision checks. Dexie28 adds synced schema-1 rows and device-only prediction/journal/
  recovery tables without converting any save. [The exact protocol](uma-puzzles-implementation.md#t110-implemented-persistenceprotocol-v1-d273)
  documents16/256KiB/200 transport bounds, standalone API adapters and explicit same-seed takeover. Both capabilities
  remain off: no live bank or Training/Spark cutover. T111 implements the lazy `GameRuntime.puzzleHost()` real adapter,
  strict device-only journal replay, compare-and-append, atomic terminal/material operations and acknowledged same-seed
  recovery. Pending results stay in prediction receipts; only accepted CL earns irreversible completion flair, including
  at boot. [The real port](uma-puzzles-implementation.md#t111-implemented-real-hostjournal-d274) has no production-installed
  double. T112 adds [lazy guarded setup screens](uma-puzzles-implementation.md#t112-implemented-setup-navigation-d275)
  over a separate per-provider Zustand account selector and Dexie read subscription. Device-only party/chapter/map
  memory never enables entry; real host operations own all mutations. A DEV proof bypasses auth/content/game boot and
  uses only its explicitly named synthetic database. T113 adds durable-before-animation touch battles, exact saved
  results and account-free practice. T114 reuses global Items and the same material host for debt-aware exchanges
  and one lazy CL sheet across Profile/Training/Constellation. Read selectors include racing units and durable
  material-operation status, never a second item store. Home/production Begin and account cutover remain unavailable;
  both flags stay off. T115 preservation/retirement is next.
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

- Stable Farm keeps its clock outside the domain: pure rules receive an integer `now`, persist each cycle's deadline once
  (10h down to 7h 30m by the worker's level, older rows 7h 30m), and derive Locked/Growing/Ready plus every plot and crop-row unlock. Its
  synthetic `sim:farm` harness pins the Section-by-Section expansion envelope without reading a save, browser API or
  private content. Presentation recomputes on
  a shared minute boundary plus focus/visibility, while planting and harvesting alone cross the save boundary.
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
- RPG playable-character teams follow the separate [private chapter contract](rpg-chapter-content.md) (D248).
  Curated official-page evidence selects portrait variants; the adapter decodes/crops 256×256 WebP into a separate
  `art/priconne/` family. Offline compilation verifies the graph, positive EXP, mechanically changed boss phase and
  provenance. A hashed catalog retains exact pack/version and portrait mappings for existing checkpoints, selecting
  its active pack only for new attempts. Runtime names/art are lazy, authenticated and hash-verified; no synthetic
  fallback or source hotlink. GameTora reimports preserve RPG packs/catalog/pins; the publisher checks present RPG
  content before remote access. The [URA publication record](../research/rpg-private-ura-handoff.md) records the complete private manifest and retained pack hash.
- Packs and atlases go to a **private Cloud Storage bucket**. They are never committed to git or put on a public host.
- Uma Puzzles has a separate [private content pipeline/client](puzzle-content.md) (D272): reviewed PAD sources, alpha-safe
  atlases, immutable full-hash packs/catalogs and held authenticated atlas URLs. It never imports PAD combat data, reads
  unrelated private Spark rows or replaces another art family. Owner-provided images now supply a private AI-edited
  transparent derivative pack (D292), with original/export/edit provenance retained privately. The explicit
  `original-placeholder` pack (D289) and its art remain available for frozen fights under the same immutable
  verification/retention contract. Both application flags are enabled; verified content and active
  preservation still gate play, exchange and CL spending.
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

The Global Uma RPG has its own [implementation page](uma-rpg-implementation.md). Since the campaign (D260–D263) its rows
are ordinary local-first entities and logs: each change commits to Dexie with outbox markers and syncs through
`/api/sync`. The server validates shapes, refuses an older RPG schema over a newer one and lets the Inspiration bank
move only toward zero. Dexie v27 restarts outfits at Tier 1 Lv1 once and retires first-map checkpoints and grouped
commands; the open fight's action journal is device-local (`rpgFights`). Chapters are generated in code; the private
pack supplies only the cast's names and verified portraits ([content contract](rpg-chapter-content.md)).

```text
players/{uid}/profile/main            save15/16 currencies, retired Training EXP bank (=0 in16), daily date, featuredUmaId, starter marker, version
players/{uid}/umas/{umaId}            save15/16: racing level/EXP, scenario CL/Inspiration/four presets, race defaults, active preset, history, version
players/{uid}/cards/{cardId}          card schema 1: templateId, global stars (0–3), maxCouponGranted, version
players/{uid}/raceResults/{id}        append-only: engine/course, field, rewards, goal/accomplishment facts, flair ids, createdAt
players/{uid}/badges/uma:{umaId}      badge-state v1: bounded facts, awards, title, showcase, saved views
players/{uid}/badges/trainer          badge-state v1: account aggregates/records, awards and preferences
players/{uid}/ledger/{id}             append-only ticket, coupon, and shard movements
players/{uid}/flairEvents/{id}        append-only per-Uma/Trainer award evidence and source refs
players/{uid}/farm/main               Farm schema v2: used plots (sparse), outfit assignments/progress and attempt counters
players/{uid}/items/{itemId}          current global item-stack quantity and update time
players/{uid}/itemLedger/{id}         append-only Farm/Extra stat/Ticket movements and scenario Inspiration grants/spends
players/{uid}/rpgOutfits/{outfitId}    schema-2 locked class, frozen enrollment inputs, tier EXP/tree, revision
players/{uid}/rpgPresets/party-{1..5} schema-2 ordered nullable five-slot parties and last opened chapter
players/{uid}/rpgCheckpoints/{id}     schema-2 campaign run: wins per node, carried MP, open fight input
players/{uid}/rpgResults/{id}         append-only won-fight EXP and token evidence
players/{uid}/rpgPromotions/{id}      append-only prior-tier mastery evidence
players/{uid}/rpgReceipts/{commandId} append-only grouped-command receipts (spend-inspiration only)
players/{uid}/puzzleOutfits/{outfitId} schema-1 enrollment/source, lifetime PL/EXP, kit and revision
players/{uid}/puzzlePresets/{partyId}  schema-1 five-slot parties, leader and foreground chapter
players/{uid}/puzzleCheckpoints/{id}  schema-1 derived reached/clear/attempt facts and frozen open encounter
players/{uid}/constellationBank/main schema-1 legacy / schema-2 protected preservation bank, debt and exchange unlock facts
players/{uid}/puzzlePreservation/{id} schema-1 immutable frozen pages/header/final conversion and Spark retirement receipts
players/{uid}/puzzleCohort/{id}       schema-1 protected per-outfit/scenario preservation evidence
players/{uid}/puzzleResults/{battleId} append-only frozen input/result, five EXP awards and gross/debtPaid/net
players/{uid}/puzzleOperations/{id}   append-only exact typed operation and canonical atomic receipt
```

Firestore cannot store an array directly inside another array, and a race record's compiled skill conditions are one.
A record whose data holds a nested array is written with its data as JSON text (`dataJson`) and decoded on every read;
all other records keep `data` as a map (D151).

The profile's pre-cutover save-v15 row retains currencies, the Training EXP bank, local daily-grant date, featured Uma id, one-time
starter-content marker, creation time, and schema version. Uma save v15 has four independent distance presets and
Uma Level EXP on the flat per-scenario curve (D241) and holds one bounded
run per unlocked scenario on the linear curve (under 1,250 EXP below TL10, 0 at TL10), assignment unions for cards and
lineage, explicit scenario Inspiration slot/gold-position unlocks (D250), the unit's Extra stats grid (each stat's bought
count 0–4 and at most six active nodes per preset, D235/D252), and optional race defaults. Protected T115 preservation
stamps save16 only on cutover, adapting `trainingLevel` to CL and requiring unit/profile retired EXP exactly zero;
flags remain off. [Full version/recovery contract](uma-puzzles-implementation.md#t115-implemented-preservation-v2-d287).
Dexie31 only adds `puzzlePreservation`, preserving main's RPG29/30 migrations. The API accepts older shapes during rollout
but schema conflict resolution never lets an older shape replace a newer one. Badge-state v1 is independently migratable and cannot force a
progression reset.

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

### Inspiration advance (D256)

`inspirationBank/main` is an independently versioned, server-owned schema-1 account entity, cached in Dexie v26.
It holds a frozen outfit/scenario cohort (including pre-advance open-position counts), completed outfit ids, phase
`opening|active`, creation time and signed nonpositive scenario/token balances. Normal sync cannot create/edit/delete
it. `POST /api/inspiration/advance` accepts only `{}` behind AuthGuard, freezes the authoritative cohort once, then
opens/debits each outfit with the bank in one transaction. Two-document steps avoid Firestore's bulk write limit.
Retries resume the same cohort; active calls return the bank and frozen-cohort Uma rows without further writes.
Malformed/legacy authoritative Umas must be migrated by normal sync before advancement, never silently skipped.

Startup invokes it only with persistent storage, online and drained ordinary/RPG queues. Acknowledged bank/Uma rows
are adopted transactionally; a local edit queued during the request retains its build and unions permanent unlocks
onto the returned server version. Failures remain visible/retryable without marking the whole save unavailable.
RPG map-reward groups read the actual bank even when an old client omits it, require a matching version and exact
repayment projection, and reject collection during `opening`. Gross ledger grants retain ids and add optional
`debtPaid`; all inventory evidence reconstruction subtracts it. No profile/Uma schema bump or gameplay RNG changes.

| Layer | Tooling | Focus |
|---|---|---|
| `@racer/domain` | Vitest | Formulas match the design docs (caps, rivals, costs, EXP curves) |
| `@racer/race` | Vitest | Determinism (same seed gives the same result), phase boundaries, HP drain, sanity ranges (finish times per distance) |
| API | Vitest | Sync conflict handling, auth guard |
| Web | Vitest + fake IndexedDB, type-check + build, manual on iPhone | Migrations, boot/sync safety, joins/filters/atlas math, feel and 390×844 layout |

CI runs lint, type-check, tests, and builds on every push, as uma-planner's workflow does.
