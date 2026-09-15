# Data pipeline

Turns GameTora's public datasets into normalized **private content packs** for the authenticated content API. The importer
is re-runnable, caches its source downloads, and writes only to paths that are ignored by git.

## Run it

From the repository root:

```bash
pnpm data:import
pnpm data:import -- --refresh   # ignore cached datasets and download fresh copies
```

The manifest is always fetched. Dataset JSON is reused from `scripts/data/.cache/` unless `--refresh` is present. The six
source datasets are `character-cards`, `characters`, `support-cards`, `skills`, `races`, and `racetracks`.

## Output

```text
content/
  manifest.json
  data/umas.<hash8>.json
  data/cards.<hash8>.json
  data/skills.<hash8>.json
  data/races.<hash8>.json
  data/courses.<hash8>.json
```

Each pack is compact JSON with `{ version, items }`; items are sorted by string id, and stale hashes for that pack are
removed after the replacement is written. `manifest.json` records the GameTora dataset versions plus every pack's relative
path, byte count, and full SHA-256. Its version is the first 12 hexadecimal characters of the SHA-256 over the sorted file
hashes. Paths are resolved from this package's location, so the result does not depend on the command's current directory.

## Safety and tests

`content/` and `scripts/data/.cache/` contain original-game data and must never be committed, copied into fixtures, or put
on a public host. Unit tests use only small invented records in `src/__fixtures__/` and never access the network.

```bash
pnpm --filter @racer/data-pipeline lint
pnpm --filter @racer/data-pipeline test
```
