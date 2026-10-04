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

The manifest is always fetched. Dataset JSON is reused from `scripts/data/.cache/` unless `--refresh` is present. The eight
source datasets are `character-cards`, `characters`, `support-cards`, `skills`, `races`, `racetracks`, `scenarios`, and
`ura-objectives`.
The objective import keeps only ordered, distinct race-family references for characters with retained gameplay races. It
prints aggregate coverage/unresolved counts and does not copy objective text, conditions, turns, fans, or nested source rows.
The scenario dataset is never packed: the importer reads only its JP start timestamps and warns with aggregate counts and
dates when released source scenarios outnumber the modeled ladder.
Support-card effect identity mapping is shared with the domain projection. Friend/Group stat and initial-stat identities
become generated broad profiles; unmapped source effect rows are reported only as aggregate inactive counts and are never
approximated or copied into checked-in fixtures.

The optional, Claude-maintained private input `content/overrides/flair.json` supplies semantic race-series legs and the
main-venue set used by titles/Grand Tour. Version 2 contains `series` rows shaped as
`{ tag, legs: [{ key, familyIds }] }` plus exactly 10 unique `mainVenueKeys`. Each included tag has the fixed leg count
documented in `docs/design/badges.md`; a stable kebab-case leg key may name several retained family aliases, and a family
may participate in more than one tag but only one leg within a tag. Every family and venue reference must resolve to the
normalized race pack. The file and generated packs remain ignored. Missing input produces an aggregate warning and empty
coverage; malformed input fails the import. Logs expose aggregate coverage only, and tests use invented references.

The optional private input `content/overrides/spark-rivals.json` supplies the fourteen Spark Rival Circuit rosters. Its
version-1 shape is `{ version: 1, scenarios: [{ tier, ordinary, bosses }] }`; candidates contain only a private Uma
`templateId` and one checked-in recipe id. Import validation resolves every identity, derives its canonical character and
stable best strategy, enforces no-self/no-duplicate coverage, and logs aggregate counts only. Missing input is allowed for
development and omits the optional pack so the app uses its deterministic catalogue fallback. A publication dry run or
real publish refuses a manifest without a complete, valid `spark-rivals` pack.

## Output

```text
content/
  manifest.json
  data/umas.<hash8>.json
  data/cards.<hash8>.json
  data/skills.<hash8>.json
  data/races.<hash8>.json
  data/courses.<hash8>.json
  data/spark-rivals.<hash8>.json # optional during development; required to publish
  atlases/...                   # preserved when present; written by scripts/assets
```

Each pack is compact JSON with `{ version, items }`; items are sorted by string id, and stale hashes for that pack are
removed after the replacement manifest is written. Existing atlas entries are preserved. `manifest.json` records the GameTora dataset versions plus every content file's relative
path, byte count, and full SHA-256. Its version is the first 12 hexadecimal characters of the SHA-256 over the sorted file
hashes. Paths are resolved from this package's location, so the result does not depend on the command's current directory.

## Private RPG chapter pipeline

After a reviewed private `content/overrides/rpg-chapters.json` and official-page evidence are authored:

```bash
pnpm assets:rpg:import
pnpm data:rpg:import
pnpm data:rpg:validate --replay  # offline, credential-free validation and bounded invented-party replay
```

See [the standing RPG content contract](../../docs/technical/rpg-chapter-content.md) for v2 provenance, exact-version
catalog/art references, custom paths and owner-authorized publication. Every old pack/image remains retained; versions
cannot be reauthored. Regular data imports preserve RPG files/catalog and source pins. A present RPG pack must pass
this gate before the existing publisher contacts storage. A partial RPG-only staging manifest must never replace
the complete production manifest. The first URA chapter's [publication record](../../docs/research/rpg-private-ura-handoff.md)
records the complete manifest and immutable pack hash (D257).

## Safety and tests

`content/` and `scripts/data/.cache/` contain original-game data and must never be committed, copied into fixtures, or put
on a public host. Unit tests use only small invented records in `src/__fixtures__/` and never access the network.

```bash
pnpm --filter @racer/data-pipeline lint
pnpm --filter @racer/data-pipeline test
```

## Publish the private output

After both importers finish, preview and publish the complete manifest with:

```bash
pnpm content:publish -- --dry-run
pnpm content:publish
```

The publisher verifies every byte and SHA-256 locally, checks the private bucket, uploads addressed files before the
manifest, and leaves older objects alone. It pins its gcloud child environment to the owner's `default` configuration and
the `uma-racer` project without changing the active gcloud configuration. See the
[release runbook](../../docs/technical/infrastructure.md#release-runbook) for smoke checks and recovery.
