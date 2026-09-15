# T003 — Stable and synchronized save foundation (Milestone 2, part 1)

**Goal:** replace the placeholder stable with the player's real 25-Uma launch roster and a useful Uma Profile Overview,
backed by a typed, migrated, local-first save that can bootstrap from and synchronize with the existing API. This task is
the persistence and navigation foundation for Training and race progression; it does not implement either gameplay loop.

Depends on: `T001-content-data-packs.md` and `T002-content-assets-runtime.md`. A complete private content version must be
available locally for manual verification. Production content publication remains an owner/Claude operation.

Read first: `AGENTS.md`, `docs/technical/architecture.md` §1 and §Firestore data model, `docs/design/uma-progression.md`,
`docs/design/collection.md` §Starting the game, `docs/design/training.md` §Two levels and §Opening training,
`docs/design/support-cards.md` §Ownership vs. equipping, `docs/design/economy.md`, `docs/design/ux.md` §Home, §Stable, and
§Uma Profile, `docs/decisions.md`, and the two prerequisite task specs.

## Scope and fixed choices

- Static GameTora fields stay only in the content registry. Save entities contain mutable player state plus stable
  template ids; they never copy names, release dates, image URLs, card profiles, or other reference data.
- The existence of an Uma/card save entity means it is owned. On a brand-new save, seed every `UmaTemplate` and
  `SupportCardTemplate` whose `starter` flag is true. The live content version must yield exactly 25 starter Umas; fail
  initialization with a useful error if it does not. Starter-card count may change as source classification improves.
- Starter seeding happens once. A later content version does not silently grant newly marked starter entities. Content
  that temporarily lacks a template referenced by the save must not delete that entity; preserve it and report the
  orphan in diagnostics so a corrected content version can restore it.
- Every new Uma starts from the template's 5-star `baseStats` and `aptitudes`, Uma Level 1, Training Level 1, zero EXP,
  zero SP, no deck, and zero trainings this scenario. Her own unique skill is placed in the scenario library when one is
  present. It is always active for free and is not duplicated in the paid loadout list.
- Every new card starts at level 1, zero EXP, and LB0. Friend/Group cards may be owned, but later tasks decide when they
  can be equipped or dealt.
- A new profile starts with 3 Card Select Coupons and no other coupons or shards. The first daily grant supplies today's
  50 Training Tickets and is recorded through the same ledger path as later daily grants.
- A local save is authoritative during ordinary play. Only a semantically empty local database performs a full
  `GET /api/save` bootstrap. If that request is unavailable, first-run seeding may proceed offline; when connectivity
  returns, normal per-entity conflict handling adopts any already-existing server entity.
- Server copies win stale mutable-entity conflicts, matching the architecture doc. Append-only ledger records are
  idempotent by id. No automatic destructive reset or whole-save overwrite is allowed.
- The runtime starts only after auth is ready and private content is ready. A persisted Firebase session plus cached
  content/save must still open offline. Signed-out, empty-content, and content-error sessions do not seed or sync.
- T003 uses the existing 128×128 Uma atlas icon as both tile and profile hero art. Do not invent, scrape, commit, or host a
  separate portrait source in this task.
- Keep the startup bundle at or below 180 KB gzip. Stable/Profile screens and sync code may be code-split. Add no runtime
  dependency; prefer pure tests around the persistence coordinator and parsers.

## Deliverables

### 1. Shared save v1 contracts and initialization rules

Add a small `packages/domain/src/save.ts`, exported from `@racer/domain`, with the canonical mutable save vocabulary. The
exact naming may follow surrounding code, but the persisted shape must carry these fields:

```ts
const SAVE_SCHEMA_VERSION = 1

interface PlayerProfile {
  schemaVersion: 1
  tickets: number
  cardCoupons: number
  umaCoupons: number
  umaShards: number
  lastDailyGrant: string | null       // device-local YYYY-MM-DD
  featuredUmaId: string | null
  starterSeedContentVersion: string | null
  createdAt: number                   // epoch milliseconds
}

interface SkillUnlock {
  skillId: string
  origin: 'own-unique' | 'awakening' | 'card' | 'inherited'
  sourceId: string | null
}

interface UmaSave {
  templateId: string
  level: number
  exp: number
  trainingLevel: number
  trainingExp: number
  stats: Stats
  skillPoints: number
  aptitudes: Aptitudes
  deckCardIds: string[]
  skillLibrary: SkillUnlock[]
  loadoutSkillIds: string[]            // freely equipped non-unique skills only
  trainingsThisScenario: number
}

interface CardSave {
  templateId: string
  level: number
  exp: number
  limitBreak: number
  maxCouponGranted: boolean
}

interface LedgerEntry {
  resource: 'tickets' | 'card-coupons' | 'uma-coupons' | 'uma-shards'
  delta: number
  reason: 'daily-grant' | 'initial-grant' | 'uma-level' | 'card-level' | 'uma-promotion' | 'card-limit-break'
  localDay: string | null
  createdAt: number
}
```

- `scenarioTier`, caps, readiness to promote, card level cap, and `maxed` are derived through domain functions rather than
  persisted twice.
- Entity ids equal their template ids. `featuredUmaId`, deck ids, skill ids, and template ids are references, not copied
  objects.
- Export explicit parsers/type guards for every T003 shape that crosses IndexedDB or the network. Reject non-finite,
  fractional, negative, out-of-range, duplicate, or malformed values where the design requires counters, levels, ids,
  dates, grades, or arrays. Unknown save schema versions produce an “app update required” error; never reset them.
- Validate the T003-consumed fields of content templates (`starter`, `baseStats`, `aptitudes`, and unique/reference ids)
  before initialization or rendering. A malformed private pack is a content error and must not write a partial save.
- Add pure constructors for a new profile, Uma, card, and complete initial save. Inputs are content templates, content
  version, local day, and time so tests never depend on the real clock. Deep-copy mutable stats and aptitude records.
- Sort seeded entities by id and choose the first id-sorted starter Uma as the initial featured Uma. Initialization is
  deterministic for the same content and time inputs.
- Keep future parent snapshots, goals, race history, badges, titles, presets, and settings out of save v1 until their task
  defines their full shapes. Add them later through explicit schema migrations rather than `Record<string, unknown>`.

### 2. Daily grants and auditable ledger

Replace the current boot-only grant mutation with a pure, idempotent daily-grant operation:

1. Device-local dates remain the product rule; handle DST with calendar arithmetic rather than elapsed milliseconds.
2. Process each unhandled local day from `lastDailyGrant` through today. A new save handles today once.
3. Apply +50 while the profile is below the 500 daily-storage cap. Never reduce tickets already above the cap.
4. Append a deterministic ledger id such as `daily-tickets:<YYYY-MM-DD>` only when that day moves tickets. Update
   `lastDailyGrant` even when the cap makes the delta zero.
5. If the device date moves backwards, grant nothing and do not move `lastDailyGrant` backwards.
6. Seed the 3 initial Card Select Coupons with one deterministic `initial-card-coupons` ledger entry on new saves.

Migrating the current local profile must preserve its tickets, coupons, shards, `lastDailyGrant`, and server version. Do
not retroactively invent ledger movements for resources that predate T003, and do not grant today twice.

### 3. Typed Dexie schema and crash-safe local mutations

Upgrade `apps/web/src/game/db.ts` from the placeholder/generic v1 rows to typed, versioned rows:

```ts
interface VersionedRow<T> {
  id: string
  data: T
  version: number       // server version; 0 until accepted
}
```

- `profile/main`, `umas/<templateId>`, and `cards/<templateId>` use the shared types. Ledger remains append-only with its
  typed data and timestamp. Badge and race-result stores may remain empty/reserved but must not become `any`.
- Add a Dexie v2 migration that wraps the existing flat profile row, sets save schema v1 defaults for new fields, and
  preserves all current counters, last-grant date, version, ledger/outbox rows, and unrelated stores. Content-dependent
  starter entities are created after migration by the coordinator, not inside the schema upgrade. A migrated profile has
  `starterSeedContentVersion: null`; the coordinator uses that marker to seed only missing starter entities once without
  overwriting counters or any already-present Uma/card row.
- Parse every row read from IndexedDB. A corrupt/unsupported row exposes a recoverable error with export/reset left to a
  later settings task; it must not be silently replaced.
- First-run seeding, a daily grant, featured-Uma changes, and later game actions each write their affected rows and outbox
  records in one Dexie transaction before updating Zustand. A reload must observe either the whole mutation or none.
- Coalesce pending mutable-entity outbox entries by `[kind+id]`. Append-only ids remain unique. Never acknowledge an
  outbox mutation queued after the request being acknowledged.
- If IndexedDB is unavailable, keep the existing in-memory fallback for play, clearly expose `persistent: false`, and do
  not claim that unsaved mutations synchronized.

### 4. Save bootstrap and background sync coordinator

Create small modules under `apps/web/src/game/` for parsing/adoption, persistence, outbox batching, and React lifecycle.
Avoid one large store file. Replace the top-level `void bootGame()` call with a provider/coordinator that observes auth and
content state.

Boot sequence:

1. Wait for auth resolution. If signed out, expose `signed-out` and make no save/content-state API mutation.
2. Wait for a complete `LoadedContent`. Content `empty` or `error` remains visible and does not initialize a save.
3. Open/migrate IndexedDB and parse the local snapshot.
4. If local state has a valid profile, adopt it immediately and apply any owed daily grants locally without waiting for
   Cloud Run.
5. If local state is semantically empty, try `GET /api/save`. Parse the complete server snapshot before writing anything.
   Adopt it transactionally when it contains a profile. If it is empty, or the request fails because the device is
   offline, create the initial save transactionally from the loaded content.
6. If an adopted local or cloud profile has `starterSeedContentVersion: null`, complete the one-time starter seeding in a
   transaction, preserve all existing entities/resources, set the marker to the active content version, and queue only
   rows actually added or changed. Never change a non-null marker during ordinary content updates.
7. Join save entities to content by id, compute diagnostics for missing references, and expose ready state.
8. Start background outbox flushing only when signed in/auth-disabled and online.

Sync behavior:

- Build API request types from the shared contracts instead of maintaining narrower duplicate web shapes. Keep explicit
  API validation of untrusted request bodies; the server continues to trust the personal client’s game decisions, not
  malformed storage shapes.
- Flush at most `MAX_SYNC_OPERATIONS` per request, debounce ordinary mutations, retry on the next `online` event, and make
  a best effort when the document becomes hidden. Do not busy-loop after an error.
- Read the current row payload and base version when constructing a batch. Record the exact outbox sequence ids included.
- For `applied`, update local server versions and remove only acknowledged queue entries in one transaction. For
  `conflicts`, strictly parse and adopt the server copy, then clear only the superseded queued entry. Append acknowledgments
  remove the matching append entries.
- A malformed response, unknown kind, unknown schema version, or partial mismatch leaves affected outbox work pending and
  surfaces a sync error; it never discards local data.
- Sign-out stops timers/listeners, clears in-memory game state, and leaves the owner's IndexedDB save intact for the next
  authenticated/offline session. T003 does not add a destructive local-data button.
- Expose a compact sync state (`idle`, `pending`, `syncing`, `offline`, `error`), pending count, and last successful sync
  time. Settings shows these diagnostics; gameplay is never blocked by them.

### 5. Zustand selectors and content/save joins

- Store only mutable save state and runtime status in Zustand. Do not copy content templates or atlas metadata into it.
- Normalize Umas/cards by id and expose selectors for profile, owned counts, one Uma, one card, and sync status. Components
  subscribe to the smallest useful slice; avoid rerendering the whole Stable when one counter changes.
- Provide a pure join/view-model function that combines `UmaSave` with `UmaTemplate`, scenario/cap derivations, and
  `getContentAsset(content, 'uma-icons', id)`. Missing content returns a diagnostic result rather than throwing during
  render.
- `setFeaturedUma(id)` validates that the Uma is owned, persists profile + outbox atomically, and then updates the store.
- The initial 25 Umas and all starter cards are real saved entities, not a UI-only filter over templates. Stable/profile
  ownership counts come from save entities; top-bar ticket and coupon counters continue to come from the profile.

### 6. Reusable private-atlas sprite component

Add a small accessible web component that renders one frame from a verified `ContentAsset`:

- Clip/scale the atlas page without copying it to canvas and without fetching another URL. The only image source is the
  managed Blob URL returned by T002.
- Preserve a square aspect ratio at tile and hero sizes, use the supplied frame/page dimensions, and prevent neighboring
  frames or padding from bleeding at fractional device pixels.
- Accept useful alternative text (or explicit decorative mode), a fallback for a missing frame, and ordinary class/style
  composition. Do not expose GameTora or raw protected API URLs to `<img>`/CSS.
- Reuse it on Home, Stable, Uma Profile, and later race/training screens.

### 7. Stable, Uma Profile Overview, and Home

Replace the Stable placeholder with a lazy route and add `/stable/:umaId` as a nested, code-split profile route.

**Stable**

- Render the player's owned Umas only—25 on a fresh save—in an id-stable, responsive two-column grid at 390×844.
- Each tile shows atlas icon, name/outfit, Uma Level, Training Level, scenario name/crest label, and a visually distinct
  ready-to-promote state derived from level/EXP. The full all-Uma silhouette Album remains a collection task.
- Provide chips for tier, surface, distance, strategy, and ready-to-promote, plus a sort sheet for name, Uma Level, and
  Training Level. Aptitude-category filters include grades S or A. Empty filtered results have a clear reset action.
- Tap opens the profile. Long-press opens a lightweight peek with the five stats and aptitude highlights; provide a visible
  44 pt “Quick view” control as the keyboard/screen-reader equivalent.
- Loading, signed-out, empty-content, content-error, save-error, and non-persistent states are explicit and do not flash a
  fake empty stable.

**Uma Profile Overview**

- Resolve the route id against both the owned save and content. Unknown/unowned ids render a useful not-found state with a
  path back to Stable.
- The hero shows the same atlas icon, name/outfit, Uma Level, Training Level, scenario name, and a “Featured” toggle.
- Overview shows all five current stats, each current TL cap, and the scenario baseline cap; values already over the
  current cap remain visibly valid. Show SP with its current cap and all surface/distance/strategy aptitude grades.
- Show a minimal Journey strip for the current tier and prior tiers. Goal pips, Honors, badges, record, lineage, editable
  loadout, and deck tabs remain visibly unavailable until their owning tasks rather than using fake data.
- The sticky action area explains “Train once to unlock races.” Train is marked as coming in T004; real Race and Promote
  actions are not enabled by T003.

**Home**

- Replace “Your stable awaits” with the persisted featured Uma's icon, name, levels, and scenario. Tapping the hero opens
  her profile.
- If the featured id is missing but another owned/content-backed Uma exists, select a deterministic fallback and repair
  the profile through the normal persisted mutation path.
- Train and Race use the same honest disabled/coming-soon state as the profile until their tasks land. Do not route the
  featured Uma into the generic race-engine preview as if rewards were connected.
- Keep all touch targets at least 44 pt, safe-area padding, reduced-motion behavior, and Motion `m.*` usage. Animate only
  transform/opacity.

### 8. Tests and documentation

- Use small invented content/save fixtures only. No real names, ids, stats, images, or downloaded packs enter git.
- Domain tests cover deterministic first-run creation, exactly-starter-only ownership, base-stat/aptitude deep copies,
  unique-library initialization, derived tier/caps, malformed saves, and unsupported schema versions.
- Daily tests cover first launch, multiple missed days, 500 cap, tickets already above cap, DST calendar boundaries, clock
  rollback, deterministic ledger ids, and no double grant after reload/migration.
- Persistence/coordinator tests cover empty cloud → seed, cloud save → adopt, unavailable cloud → offline seed, existing
  local → immediate boot/no full pull, partial/corrupt snapshot rejection, atomic initialization, outbox coalescing,
  batching, acknowledgment, a mutation queued during a request, server-wins conflict adoption, append idempotence, retry
  triggers, and sign-out cleanup. Prefer pure adapters; if Dexie migration cannot be tested meaningfully otherwise,
  `fake-indexeddb` is the only pre-approved test-only dependency and must be justified in the PR.
- Web tests cover join/view-model fallbacks, owned counts/filtering/sorting, featured-Uma validation, and atlas-frame style
  math. Do not add a component-testing stack only for this task.
- Update `README.md` status, `docs/technical/architecture.md` save/runtime details, and append a decisions row only if
  implementation changes a choice fixed here. Never edit an old decision row.
- Do not modify `.github/workflows/`, `infra/`, `firebase.json`, environment files, or `apps/api/Dockerfile`.

## Manual verification

With `pnpm data:import`, `pnpm assets:import`, and `pnpm dev`:

1. Start from a cleared local development database and empty local API save. Confirm first boot creates exactly 25 Umas,
   all starter cards, 3 Card Select Coupons, today's 50 tickets, and the two initial ledger movements.
2. Reload. Confirm no entity, coupon, or daily grant is duplicated and the same featured Uma remains selected.
3. Change the featured Uma, reload, and confirm Home/Profile/Stable agree.
4. Inspect Stable and a profile at 390×844: no horizontal overflow, 44 pt controls, correct icon frames, stats/caps,
   aptitude labels, filters/sort/peek, and no console errors.
5. Stop the API after warming content and save state. Reload and confirm the Stable/Profile remain usable, show offline sync
   status, and queue a featured-Uma change locally.
6. Restart the API and confirm the queue drains. In a fresh browser database, confirm `GET /api/save` reconstructs the
   same featured Uma, counters, 25 Umas, and starter cards.
7. Force a stale entity version in local development and confirm the server copy wins without deleting unrelated local
   entities or append-only ledger records.
8. Confirm signed-out production UI makes no save/content initialization calls and cannot expose private atlas bytes.

## Acceptance

- A new authenticated/auth-disabled save owns exactly the content-marked starter set: 25 launch Umas and every current
  event/free starter SSR card. Every Uma/card has a typed, valid initial entity tied to its template id.
- Existing v1 IndexedDB profile values migrate without loss or duplicate rewards. Daily grants are local-date based,
  capped correctly, ledgered, and idempotent.
- Gameplay state opens from IndexedDB without waiting on Cloud Run. An empty device restores a cloud snapshot when
  available; otherwise it can initialize offline and reconcile later through tested server-wins conflicts.
- Every local mutation is durable with its outbox entry before Zustand publishes it. Batched sync safely acknowledges,
  retries, and adopts conflicts without dropping concurrent work.
- Home shows a real featured Uma. Stable shows the 25 owned Umas with working filters/sort/peek. Every owned Uma has a
  content-driven Overview profile with correct current values and derived caps. No original-game byte or datum is added
  to git.
- Signed-out/content-error/save-error/offline/non-persistent states are honest and recoverable. No game action waits on a
  network request.
- `pnpm lint && pnpm test && pnpm build` pass. The production startup chunk stays at or below 180 KB gzip, the PWA builds,
  and browser verification at 390×844 has no errors or horizontal overflow.

## Explicitly out of scope

- Training deals, gain resolution, card EXP/levels, hints, or Training animations (T004).
- Deck editing, the Card Album, limit breaks, coupons, or redemptions beyond seeding owned starter cards.
- Races using a saved Uma, NPC content selection, results persistence, Uma EXP/levels, ticket rewards, or race history
  (T005). The existing race-engine preview remains a non-progression demo.
- Promotion, scenario-start inheritance, parents, goals, awakening skills, badges/titles, Journey goal pips, or record
  history.
- New portrait/icon sources, generated original-game artifacts in git, production bucket upload, or infrastructure/env
  changes.
