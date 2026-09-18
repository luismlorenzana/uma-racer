# Data pipeline

Turns GameTora's public datasets into normalized **private content packs** for the authenticated content API. The importer
is re-runnable, caches its source downloads, and writes only to paths that are ignored by git.

## Run it

From the repository root:

```bash
pnpm data:import
pnpm data:import -- --refresh   # ignore cached datasets and download fresh copies
pnpm assets:import              # next: download image sources and build private atlases
```

The manifest is always fetched. Dataset JSON is reused from `scripts/data/.cache/` unless `--refresh` is present. The seven
source datasets are `character-cards`, `characters`, `support-cards`, `skills`, `races`, `racetracks`, and `ura-objectives`.
The objective import keeps only ordered, distinct race-family references for characters with retained gameplay races. It
prints aggregate coverage/unresolved counts and does not copy objective text, conditions, turns, fans, or nested source rows.

The optional private input `content/overrides/flair.json` supplies semantic race-series tags and the main-venue set used by
titles/Grand Tour. It has version `1`, a `series` array of unique `{ familyId, tags }` rows, and exactly 10 unique
`mainVenueKeys`. Tags must use the catalog-v1 semantic enum documented in `docs/design/badges.md`; every reference must
resolve to a retained normalized race. The file and generated packs remain ignored. Missing input produces an aggregate
warning and empty tags; the importer prints only aggregate coverage and synthetic tests use invented references.

## Output

```text
content/
  manifest.json
  data/umas.<hash8>.json
  data/cards.<hash8>.json
  data/skills.<hash8>.json
  data/races.<hash8>.json
  data/courses.<hash8>.json
  atlases/...                   # preserved when present; written by scripts/assets
```

Each pack is compact JSON with `{ version, items }`; items are sorted by string id, and stale hashes for that pack are
removed after the replacement manifest is written. Existing atlas entries are preserved. `manifest.json` records the GameTora dataset versions plus every content file's relative
path, byte count, and full SHA-256. Its version is the first 12 hexadecimal characters of the SHA-256 over the sorted file
hashes. Paths are resolved from this package's location, so the result does not depend on the command's current directory.

## Safety and tests

`content/` and `scripts/data/.cache/` contain original-game data and must never be committed, copied into fixtures, or put
on a public host. Unit tests use only small invented records in `src/__fixtures__/` and never access the network.

```bash
pnpm --filter @racer/data-pipeline lint
pnpm --filter @racer/data-pipeline test
```
