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

T059's chibis, outfit stands and race faces come from the original's files by their wiki names, in a local folder
the owner provides; nothing is fetched for them:

```bash
pnpm assets:import -- --dry-run --source dir:~/Documents/uma-content   # stage the folder, report counts and gaps
pnpm assets:import -- --wiki-only                                       # build art/chibi, art/dress, art/face
```

`--source dir:<path>` copies the roster's files into `scripts/assets/.cache/wiki/`; every later run (including a full
one) builds from that cache, so the folder is only needed again for new files. Chibis are matched to outfits through
GameTora's `costume` field in `scripts/data/.cache/character-cards.json`, so run `pnpm data:import` first.

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
  atlases/skill-icons-0.<hash8>.webp    every skill icon the skills pack uses, by iconId (D182)
  atlases/skill-icons.<hash8>.json
  art/uma/<umaId>.<hash8>.webp          art/bust/<umaId>…   art/card/<cardId>…
  art/chibi/<umaId>-a|b.<hash8>.webp    art/dress/<charaId>-gym|summer|winter|casual…
  art/face/<charaId>.<hash8>.webp
```

`pnpm assets:import -- --families=skill-icons` rebuilds only that family (seconds, no other download). Stat and card type
icons are the app's own drawings (D183), so the `type-icons` family D182 imported is retired: an import drops its files.
A skill icon GameTora lacks is skipped and the app draws its own star in its place.

More pages are produced automatically if a family grows beyond 961 frames. Atlas descriptors map template ids to their
page and rectangle. The importer preserves all `data/*` entries, hashes exact output bytes, swaps the combined manifest,
then removes stale files from the two atlas families.

Production upload is intentionally not part of this package. Claude/the owner uploads the completed ignored `content/`
tree to the private GCS bucket using the documented production process.

## Private PriConne portraits

`pnpm assets:rpg:import` reads the reviewed private chapter plus `content/overrides/rpg-source-evidence.json`.
It verifies the selected official-page portrait URLs, caches source bytes by URL hash, natively decodes and crops
256×256 WebP into `art/priconne/<key>.<hash8>.webp`, retaining earlier image objects. It pins exact current art
paths in the manifest for `pnpm data:rpg:import`; no publishing occurs. `--offline` never fetches and fails on a
missing source cache. See [the content contract](../../docs/technical/rpg-chapter-content.md) for browser evidence,
allowed hosts, custom private paths and owner handoff. Tests use generated pixels and invented characters only.

## Safety and tests

Never commit anything under `content/` or `scripts/assets/.cache/`. Tests generate tiny synthetic SVG inputs with invented
ids and never contact GameTora.

```bash
pnpm --filter @racer/asset-pipeline lint
pnpm --filter @racer/asset-pipeline test
```
