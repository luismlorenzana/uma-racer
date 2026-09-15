# T002 — Content assets and authenticated runtime (Milestone 1, part 2)

**Goal:** complete Milestone 1 by turning the image sources in T001's private data packs into deterministic WebP sprite
atlases, then load and verify every content pack and atlas in the web app after sign-in. Generated data, downloaded images,
atlases, and caches remain gitignored and private. Production bucket upload is an owner/Claude deployment step and is not
part of this coding task.

Depends on: `T001-content-data-packs.md`.

Read first: `AGENTS.md`, `docs/technical/architecture.md` §3, `docs/technical/infrastructure.md` §Privacy,
`docs/design/ux.md`, `docs/research/game-web-tech.md` §Performance, `docs/decisions.md`, and
`scripts/data/README.md`.

## Scope and fixed choices

- Build atlases only for the image sources already normalized by T001:
  - `UmaTemplate.imageSource` → `uma-icons`
  - `SupportCardTemplate.imageSource` → `card-icons`
- Those GameTora sources are transparent 128×128 PNG icons as of 2026-09-15. Normalize every frame onto a transparent
  128×128 canvas with `contain` fitting and no crop. Do not upscale them into a fake hero-art family. The UI may use the
  Uma icon anywhere it needs an Uma image until a higher-resolution source is documented in a later task.
- Encode atlas pages as WebP at quality 82 and alpha quality 100. Frames have 2 transparent pixels of padding on every
  side. Pages may be non-power-of-two, must be no larger than 4096×4096, and are filled deterministically by item id in
  rows from left to right, top to bottom.
- Use `sharp` in `scripts/assets`; it is justified because Node has no built-in portable image decoder, resizer, or WebP
  encoder. Add no other image dependency.
- The content manifest remains the single index for data and assets. Running either importer must preserve the other
  importer's files and recompute the overall content version from all current file hashes.
- The service worker Cache Storage is the durable byte cache. The web runtime persists only the last known-good manifest
  in local storage, then can reopen the hash-addressed responses from Cache Storage when offline. Reference content does
  not become save data and does not go in Zustand or the save/outbox tables.
- The browser must fetch protected files with the same bearer-token provider as JSON API calls. A raw protected URL is
  not a usable `<img>` or Pixi source because those consumers cannot attach the Firebase bearer token. Image bytes become
  managed Blob URLs after authenticated fetch and integrity verification.

## Deliverables

### 1. Shared content and atlas contracts

Extend `packages/domain/src/content.ts` with:

```ts
type ContentAtlasKind = 'uma-icons' | 'card-icons'

interface ContentAtlasPage {
  path: string       // content-relative, content-addressed WebP path
  width: number
  height: number
}

interface ContentAtlasFrame {
  page: number       // index into pages
  x: number
  y: number
  width: 128
  height: 128
}

interface ContentAtlas {
  schemaVersion: 1
  kind: ContentAtlasKind
  frameWidth: 128
  frameHeight: 128
  pages: ContentAtlasPage[]
  frames: Record<string, ContentAtlasFrame> // template id → frame
}

interface ContentPack<T> {
  version: string
  items: T[]
}
```

Keep `ContentManifest` as the authoritative manifest type in `@racer/domain`; remove narrower duplicate web/API shapes
where practical. The API may retain an explicit empty-manifest response with `version: null`.

### 2. Workspace package `scripts/assets`

Create private package `@racer/asset-pipeline` with `lint`, `test`, and `import` scripts, plus root command
`pnpm assets:import`.

The importer must:

1. Read `content/manifest.json`, locate and verify the current `umas` and `cards` JSON pack files, and take ids plus
   `imageSource` URLs from those packs. If T001 output is absent or invalid, fail with a message to run `pnpm data:import`.
2. Download sources into `scripts/assets/.cache/<kind>/<id>.<source-extension>`. Default runs reuse cached bytes;
   `--refresh` downloads them again. Use a bounded concurrency of 8, send a descriptive User-Agent, reject non-2xx
   responses and non-image content types, and report failed ids/URLs without writing a partial new atlas set.
3. Decode each source with `sharp`, respect EXIF orientation, fit it inside 128×128 without cropping, preserve alpha, and
   composite it onto a transparent frame.
4. Pack frames deterministically. The cell size is 132×132: a 128×128 frame inset by 2 pixels on each edge. A row holds
   at most `floor(4096 / 132) = 31` cells and a page holds at most 31 rows. Start another page if necessary. Trim the last
   page to its used cell columns and rows rather than allocating an empty 4096² canvas.
5. Write pages as `content/atlases/<kind>-<page>.<sha256-first-8>.webp` and the descriptor as
   `content/atlases/<kind>.<sha256-first-8>.json`. Descriptor `pages[].path` contains the final hashed page path.
6. Remove stale files for the two atlas families only after every replacement has been produced successfully.
7. Merge the new page and descriptor entries into `content/manifest.json`, preserving `data/*`. Sort files by path,
   record exact byte length and full SHA-256, preserve the GameTora `source` map, update `generatedAt`, and derive
   `version` exactly as T001 does from all sorted file hashes.
8. Print source counts, cache hits/downloads, page dimensions and byte sizes, the new content version, and warnings.

Refactor T001's writer as needed so a later `pnpm data:import` preserves `atlases/*`, removes only stale `data/*`, and
recomputes the combined version. The two commands need not be safe to run concurrently.

### 3. Web content runtime

Create `apps/web/src/content/` with small modules for parsing, integrity verification, loading, resource lifetime, and
React integration.

The runtime must:

1. Start only after auth is ready and either auth is disabled locally or a user is signed in. Signed-out sessions make no
   content requests and release any active Blob URLs.
2. Fetch `/api/content/manifest` with the token provider. Validate its shape. `version: null` is an explicit `empty` state,
   not an exception.
3. Locate exactly one pack each for `umas`, `cards`, `skills`, `races`, and `courses`, and one descriptor each for
   `uma-icons` and `card-icons`. Reject missing or duplicate required files with a useful error.
4. Fetch every referenced file through an authenticated byte-fetch helper. Verify exact byte length and SHA-256 with Web
   Crypto before parsing or exposing it. Validate pack envelopes and atlas descriptors sufficiently to prevent invalid
   ids, paths, page indices, rectangles, overlaps, or out-of-bounds frames from reaching UI/rendering code.
5. Verify every descriptor page is also present in the manifest and that its declared dimensions match the descriptor.
   Create one Blob URL per verified WebP page and expose asset lookup by atlas kind plus template id.
6. Expose immutable, id-indexed registries for Umas, cards, skills, races, and courses, along with sorted item arrays,
   manifest/source metadata, asset lookup, and load origin (`network` or `offline-cache`). Duplicate ids are invalid.
7. Persist the manifest only after the entire version loads successfully. If the network manifest is unavailable or a new
   version fails to complete, attempt the previous last-known-good manifest and its service-worker-cached files. If neither
   version loads, expose an `error` state without blocking local save hydration or app navigation.
8. Reuse an already active content version, and revoke the old version's Blob URLs only after a complete replacement is
   ready. Revoke all active URLs on sign-out.
9. Integrate through TanStack Query, because content is network reference data. Do not copy it into Zustand. Provide a
   `ContentProvider`/`useContent` API for later Stable, Training, and Race tasks.
10. Replace Settings' manifest-only query with runtime status showing the loaded version and item counts, plus clear
    signed-out, empty, loading, offline-cache, and error labels.

Keep the startup JavaScript budget intact: `sharp` is scripts-only, Firebase remains lazy, and this task must not import
PixiJS into the app shell.

### 4. Tests and documentation

- Asset tests use generated tiny synthetic images with invented ids. No downloaded image or real data is a fixture.
- Cover cache reuse/refresh and failures; deterministic item ordering; frame normalization; page splitting and bounds;
  atlas descriptor paths and hashes; stale cleanup; data-file preservation; and combined manifest versioning.
- Add a web test script and co-located Vitest tests. Cover manifest/pack/atlas parsing, duplicate ids, hash and byte mismatch,
  rectangle validation, authenticated requests, last-known-good fallback, Blob URL replacement/revocation, empty content,
  and signed-out no-request behavior where applicable.
- Update `README.md`, `AGENTS.md`, `CLAUDE.md`, and the pipeline README(s) with `pnpm assets:import` and the required command
  order. Append a decision row for the asset/atlas and offline runtime format; never edit an old row.
- Do not modify `.github/workflows/`, `infra/`, `firebase.json`, environment files, or `apps/api/Dockerfile`.

## Acceptance

- `pnpm data:import` followed by `pnpm assets:import` produces five hashed data packs, two hashed atlas descriptors, and
  their hashed WebP pages under gitignored `content/`; running either command again preserves the other category.
- With public GameTora access, the live asset import succeeds for every Uma and SSR card in T001 and reports counts/page
  sizes. Nothing under `content/` or `scripts/*/.cache/` appears in `git status`.
- With `pnpm dev`, a signed-in production session—or auth-disabled local session—loads and verifies the content version;
  Settings reports all five data counts and both atlases. Reloading after warming the service-worker cache works offline.
- Protected content bytes are requested with the bearer token; no original-game URL or API content URL is assigned
  directly to an `<img>` or Pixi texture.
- `pnpm lint && pnpm test && pnpm build` pass. The web startup chunk remains at or below 180 KB gzip.
