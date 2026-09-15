# Asset pipeline

Turns the private Uma and SSR-card image sources in T001's data packs into deterministic WebP sprite atlases. Downloads,
caches, and generated output contain original-game content, so all of them stay in gitignored paths and the production
bucket remains private.

## Run it

From the repository root, build the data packs first:

```bash
pnpm data:import
pnpm assets:import
pnpm assets:import -- --refresh   # download every source again instead of using the local cache
```

The importer downloads at most eight images concurrently into `scripts/assets/.cache/`. Each source is contained on a
transparent 128×128 frame, packed with 2 px padding, and encoded into deterministic WebP pages no larger than 4096×4096.
The source icons are 128×128; the pipeline deliberately does not invent a larger portrait by upscaling them.

## Output

```text
content/
  manifest.json
  atlases/uma-icons-0.<hash8>.webp
  atlases/uma-icons.<hash8>.json
  atlases/card-icons-0.<hash8>.webp
  atlases/card-icons.<hash8>.json
```

More pages are produced automatically if a family grows beyond 961 frames. Atlas descriptors map template ids to their
page and rectangle. The importer preserves all `data/*` entries, hashes exact output bytes, swaps the combined manifest,
then removes stale files from the two atlas families.

Production upload is intentionally not part of this package. Claude/the owner uploads the completed ignored `content/`
tree to the private GCS bucket using the documented production process.

## Safety and tests

Never commit anything under `content/` or `scripts/assets/.cache/`. Tests generate tiny synthetic SVG inputs with invented
ids and never contact GameTora.

```bash
pnpm --filter @racer/asset-pipeline lint
pnpm --filter @racer/asset-pipeline test
```
