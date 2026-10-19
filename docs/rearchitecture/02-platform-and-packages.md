# 02 · uma-platform and packages

How uma-racer stops being its own master-data importer and becomes a consumer of uma-platform, and which shared
packages are extracted now that it is the second game to need them (D325, platform P5–P11).

## 1. What uma-platform provides today

| Package or service | Version | What it gives the racer |
|---|---|---|
| `@luismlorenzana/uma-data` | 1.0.0 | Neutral master types and runtime validators (hand-written parsers, P18), the release client (channel → manifest → files, every hash checked), and `uma-data/testing` with synthetic records and an in-memory release (P28) |
| Release bucket `gs://uma-platform-master-data` | channel `v1/latest` | Characters, outfits with full stats, support cards, skills, scenarios, races, courses, career objectives, and one art index per release (P23, P24) |
| `@luismlorenzana/uma-art` | 2.0.0 | Original pixel-art atlases drawn from code: items, dishes, gear, Hub buildings, Hub terrain tiles, the world map, battle effects, UI emblems (P37–P39) |
| `scripts/pixel-art` | — | The generator for any new original art the racer needs (§4), with no third-party images |

The repo already has read access to these packages on GitHub (granted by the owner). CI installs them with the
workflow's own token, exactly as uma-rpg's does:
- `.npmrc` points `@luismlorenzana` at `npm.pkg.github.com` with `${NODE_AUTH_TOKEN}`.
- The workflow sets `NODE_AUTH_TOKEN: ${{ secrets.GITHUB_TOKEN }}` with `permissions: packages: read`.
- The Docker build receives the token as a build secret, so it never lands in an image layer.
- Locally: `NODE_AUTH_TOKEN=$(gh auth token) pnpm install`.

## 2. Master data from the platform

### 2.1 The flow

```text
gs://uma-platform-master-data ──(API service account, read-only)──▶ racer-api /api/master/*
        ──(signed-in fetch, hash-verified, cached)──▶ web content client ──▶ @racer/domain/master adapter ──▶ the game
```

- **API (SE1):** a `master` module configures published `uma-server/content` 0.2.0's proxies/sources, not copies.
  - In production it reads the channel, then the manifest, then the files from the platform bucket.
  - In development it reads `../uma-platform/content/release`.
  - Files are served `private, max-age=31536000, immutable`, since their names carry their hash.
- **Web (SE1):** `uma-data` 1.1.0's client verifies the manifest, sets and art index. Racer loads all rule sets at boot
  because race/save operations need them, and keeps verified persistent bytes for offline startup. Images load on
  demand. The shared React provider adoption remains SE4, not a copied component.
- **Following releases:** the racer follows `latest` within schema major 1 automatically (P7). A new Uma or card
  reaches the game without a code change; a breaking schema change waits for a deliberate package upgrade.

### 2.2 The adapter

`@racer/domain/master` is the **only** place master records become racer shapes (P8). It replaces today's
`content.ts` pack contracts and the racer-typed normalizers in `scripts/data/src/normalize`.

| Racer shape | From master | Racer-only rule applied here |
|---|---|---|
| `UmaTemplate` | Outfit (base stats, growth rates, aptitudes, rarity, skills) and its character | Ids become strings with `String(id)` (P19); the Stable's sort and era come from the release date |
| Support card | Support card (type, rarity, effects, unique effects, skills) | SSR only; effects mapped to the racer's training model (today's `sourceCardEffect`); era from release order |
| Scenario / era | Scenario (release order, identity, crest) | The fourteen-tier ladder and its buffs stay racer rules |
| Race catalogue | Races and courses (grade, surface, distance, venue, layout) | Grade handicap, race sets and course geometry for `course-layout` |
| Skill | Skill (kind, conditions, effects as codes, P21) | Compiled by `race-skills`; non-evolved, non-inherited filter as today (P22 keeps everything upstream) |
| Career goals | Career objectives | The G3 → 2×G2 → G1-set ladder (`scenario-goals`) |

The adapter tolerates ids it doesn't know (a newer release) and ids that vanish (a removed record) without crashing
(architecture §2.4). Saves hold ids only, so a corrected record never breaks a save.

### 2.3 Proving parity before the switch

The switch must not change the game silently:

1. A **parity test**, run locally with private data and never in CI, builds the racer's view from the last racer
   release and from the platform release. It compares every Uma template, card, skill, race and course field by field,
   then lists every difference.
2. Each difference is resolved one of two ways:
   - A **neutral fact** the platform lacks is added there in a uma-platform session, as a minor release.
   - A **racer interpretation** goes into the adapter or a racer overlay.
3. CI then runs the adapter against `uma-data/testing`'s synthetic release.

Known gaps to check first: T059's stands and race faces (today from the owner's wiki folder; the platform's families
are outfit chibis, busts, portraits, character dresses and faces) and the bust sheet (`bust-sheet.ts`).

### 2.4 What leaves the racer

| Today | After |
|---|---|
| `scripts/data/src`: `gametora.ts`, `import.ts`, `normalize/*` (except the overlays below), `scenario-coverage.ts` | Deleted: uma-platform's `scripts/data` |
| `scripts/assets/src`: `art`, `atlas`, `bust-sheet`, `download`, `import`, `layout`, `read`, `wiki`, `write` | Deleted: uma-platform's `scripts/assets` |
| `scripts/data/src/rpg*`, `scripts/assets/src/priconne*` | Deleted with the RPG ([06](06-rpg-decommission.md)) |
| `normalize/spark-rivals` and the optional `spark-rivals` pack | Deleted with Spark Rival Circuit |
| `normalize/flair`, `normalize/card-focus` | Pure validators in `@racer/domain/master`; private authored inputs stay Racer's, built/published by `scripts/overlays`. Puzzles and their placeholders were deleted, not retained |
| `pnpm data:import`, `assets:import` | Replaced by `pnpm overlays:import`; master data is imported once, in uma-platform |
| Atlas descriptors `uma-icons`, `card-icons`, `scenario-icons`, `skill-icons` | The release's `outfit-icons`, `support-card-icons`, `scenario-icons`, `skill-icons` |
| Art kinds `uma`, `card`, `bust`, `chibi`, `dress`, `face` | Families `outfit-portraits`, `support-card-art`, `outfit-busts`, `outfit-chibis`, `character-dresses`, `outfit-faces`; outfit icons are the fallback |
| Art kind `priconne` | Deleted (RPG) |
| Legacy `starter` metadata | Generation 2 opens every SSR (D329); no starter-card compatibility overlay or gating. Uma unlocking still uses tickets |

**Private overrides:** `content/overrides/flair.json` stays the racer's to author and keep (D107), since it maps
race-series legs and venues; it now names platform race and track ids. The platform's own overrides (scenario
crests, bust pins) live in uma-platform.

## 3. Original art from `uma-art`

The racer gets the pixel-art look the other games share, for its Hub and Farm. What 2.0.0 already has, and what a
uma-platform session draws for the racer (generated by `scripts/pixel-art`, deterministic, in git, P15, P35):

| Need | Source |
|---|---|
| Hub ground, paths, water, props | `tiles` (reused as-is) |
| Generic buildings (Stable, Warehouse, Exchange, Observatory-style halls) | `buildings` (reused where the meaning matches) |
| Racer places: Racecourse, Card Hall, Trophy Hall, Scenario Gate, Training Grounds, Puzzle Arena | **New:** a `racer` buildings family, 48×48 with a ground line like `buildings` |
| Farm districts and stations: Garden, Orchard, Barn, Workshop, Kitchen; plots, pens, benches, ovens | **New:** a `farm` family: station props in states (idle, working, ready) |
| Farm items (1,169 definitions) | **New, lean:** one icon per item *family and stage* (raw, processed, meal kinds), tinted by stat at runtime, not 1,169 drawings. Owner preference: features first, the cheapest art that looks fine |
| UI emblems, status badges, effects | `ui`, `fx` (reused where they fit) |

Each new family follows the existing contract:
- One atlas and one JSON index.
- Ids, not row arithmetic.
- A minor changeset, published by uma-platform CI.
- The racer pins the exact version and checks its catalogue against the index in a test, as uma-rpg's
  `frames.test.ts` does.

## 4. The shared kit (extract on second use)

Platform P11 said Hub, farm and idle code are built in uma-rpg first and extracted when uma-racer becomes the second
user. That moment is this rebuild. Each package is extracted in a **uma-platform session** from code that already
runs in production in one or both games; then uma-racer adopts it here, and uma-rpg adopts it in its own session.

| Package (provisional name) | Holds | Taken from |
|---|---|---|
| `@luismlorenzana/uma-auth` | **Web:** lazy Firebase sign-in, ID-token provider, auth state hook. **Server:** the NestJS `AuthGuard` (Firebase token + allowlisted email, `AUTH_MODE=disabled` for dev) | Both games' `auth/` folders, nearly identical today |
| `@luismlorenzana/uma-content` | **Web:** the release client wired to a game API, hash-verified fetch, Cache Storage cache with offline fallback to the last manifest, object-URL LRU for art, art-index lookups, the `AtlasSprite` component. **Server:** the release reader (GCS or local folder) and the file-serving helper | uma-rpg `master/master.ts`, `master/art.tsx`, `api/src/master`; racer `content/runtime.ts` (verification, offline fallback), `ui/AtlasSprite.tsx`, `ArtLoader` |
| `@luismlorenzana/uma-scene` | The Phaser 4 scene host: lazy load, mount into a container, DPR and resize, pause when hidden, destroy on close, texture registration from images and blobs, reduced motion. A `hub` subpath: the tile grid, terrain autotiling, place markers, the DOM hit layer over the canvas, page swipe | uma-rpg `hub/scene/*`, `hub/HubCanvas.tsx`, `hub/PlaceTargets.tsx`, `hub/grid.ts`, `hub/swipe.ts`, `battle/scene/createBattleGame.ts` |
| `@luismlorenzana/uma-idle` | Pure timer math for passive generators: a job's finished count at a time, progress, end time, claim, queues, time skips, facility slots, offline accrual, and a helper for "EXP per minute of work" curves. **No rates, no content:** each game passes its own numbers | uma-rpg `economy/jobs.ts`, `save/work.ts` (timing parts), `economy/pacing.ts` (curve helpers); racer `farm/kitchen/production.ts` |
| `@luismlorenzana/uma-ui` | A few primitives, not a design system: the bottom sheet with its focus trap (today's `RpgModalFocus`, renamed), the help button, the progress bar, and the PWA update prompt with its deferred restart | racer `app/register-updates.ts`, `update-lifecycle.ts`, `ui/rpg/RpgModalFocus.tsx`; uma-rpg `ui/BottomSheet.tsx`, `HelpButton.tsx` |

**Rules for every package:**
- React and Phaser are peer dependencies.
- Web parts are ESM; server parts are ESM + CJS, like `uma-data` (P28).
- Each package has its own tests and synthetic fixtures, versions with Changesets and is published by CI.
- Games pin exact versions (P9). To try a change before publishing, use `pnpm link`, and never commit the link.

**Not shared, by decision:** the save format and the sync protocol. uma-rpg stores one snapshot per account; the
racer's unbounded logs need per-entity sync (01 §4.3). Platform architecture §3.2 lists "save sync" as shared; the
uma-platform session that extracts the kit records this exception as a new P-decision.

**Order of extraction** follows the phases that need them ([08](08-phases.md)):
1. `uma-auth` and `uma-ui` (the rewrite's shell).
2. `uma-content` (the master-data switch).
3. `uma-scene` (the Hub).
4. `uma-idle` (the Farm).

## 5. Responsibilities across repos

| Change | Where |
|---|---|
| A neutral master-data field, a new art family, any shared package | uma-platform session (Claude), released, then pinned here |
| The adapter, overlays, game rules, screens, scenes | Here |
| Granting `racer-api` read access to the platform bucket | uma-platform session (`infra/README.md` there) |
| Keeping uma-platform's roadmap Phase 3 status current | Whoever finishes a phase step |
