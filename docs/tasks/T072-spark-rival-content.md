# T072 — Spark Rival private encounter content

**Goal:** give every scenario a validated, deterministic roster of real rival Umas without putting an original-game id,
name, image or extracted row in git. Old/missing publications remain playable through a deterministic catalogue fallback.

Depends on accepted T071. Read [M022](M022-spark-rival-circuit.md), D170, the
[content architecture](../technical/architecture.md#3-content-reference-data-and-images) and `scripts/data/README.md`.
Branch from current `main`; open a PR; never push to `main`.

## Privacy boundary

The authored source is exactly `content/overrides/spark-rivals.json`. The root `content/` directory is gitignored. It may
contain actual template ids and is handled like `content/overrides/flair.json`. Never paste its rows, ids or names into a
test, log, PR body, screenshot filename or checked-in document.

Checked-in work contains only:

- a strict schema/parser and semantic behavior vocabulary;
- normalizer/pack/runtime types;
- aggregate coverage and warning counts;
- small invented fixtures such as `synthetic-trainee-a` and `synthetic-rival-b`.

The generated `data/spark-rivals.<hash>.json`, manifest and caches remain ignored and private. Publication uses the existing
manifest-last private content flow; this task changes no bucket, workflow, infrastructure or credential file.

## Authored input v1

The private overlay has one version and exactly fourteen scenario rows. Each row identifies a tier, ordinary candidates
and boss candidates. A candidate references a private Uma template and one checked-in recipe:

```ts
interface SparkRivalOverrideV1 {
  version: 1
  scenarios: readonly {
    tier: number
    ordinary: readonly { templateId: string; recipe: SparkRivalRecipeId }[]
    bosses: readonly { templateId: string; recipe: SparkRivalRecipeId }[]
  }[]
}
```

Do not put free-form display text, raw stats, EXP, Resolve, Pressure or executable intent scripts in the overlay. Names and
art join from the Uma pack. A candidate's opening style is its template's best strategy; the recipe's archetype label is
presentation flavor, not an override of private aptitude data. T071's checked-in tier/TL curves own numbers. A recipe
expands to the bounded intent cycle below using only Pressure, Guard, Convert, Delay, Enrage and Change style. “Advantaged
orbs” means the strategy that currently beats the rival; conversion turns those into the rival's current strategy.

The v1 recipe vocabulary is deliberately small and legible:

| Recipe | Archetype | Readable behavior |
|---|---|---|
| `rush-pressure` | Rush / Front | countdown 2; Pressure; at <50% Resolve, one Enrage makes later Pressure ×1.5 |
| `tracker-guard` | Tracker / Pace | countdown 3; Guard (50% reduction unless 4 combos), then Pressure, repeat |
| `surge-convert` | Surge / Late | countdown 2; convert up to 4 advantaged orbs to its style, then Pressure, repeat |
| `finisher-delay` | Finisher / End | countdown 3; Delay +3, then ×1.5 Pressure, repeat |
| `adaptive-duel` | template's best strategy | countdown 2; Pressure; at <50%, change once to resist trainee's best strategy |
| `circuit-boss` | template's best strategy | countdown 2; Guard → Convert → Pressure; one adaptive phase at <50% |

If T071 play proves a recipe invalid, change this table, minigame design and D170–D172 before adding it. Private data must
not invent a seventh action.

## Normalization and validation

Add `scripts/data/src/normalize/spark-rivals.ts` and co-located tests, wire it into `import.ts` and `pack.ts`, and document
the optional input in `scripts/data/README.md`.

Strict validation:

- exact object keys, version 1, integer unique tiers 1–14, exactly fourteen rows;
- known recipe ids; bounded arrays and ids; no duplicate template id within a list;
- every template id resolves to one normalized Uma; use canonical character identity so two outfits cannot bypass a
  no-duplicate-character rule;
- the four style-specific recipes match that template's stable best strategy (Front/Pace/Late/End respectively, with the
  domain strategy order as tie-break); adaptive/boss recipes accept any best strategy;
- each tier has enough distinct candidates to select two ordinary rivals and one boss after excluding any trainee:
  at least four distinct ordinary characters, two distinct bosses and four distinct characters across the union;
- a boss recipe is valid for a boss candidate and expands to a complete bounded script;
- normalized output is sorted by tier, role, canonical character and template id, independent of input order;
- errors never print private ids/names. Report tier, role, array index and aggregate counts only.

Missing input is not an importer failure during development: emit one aggregate warning and omit the optional pack. A
present but invalid input is a hard failure. A production publication checklist fails if the pack or any tier is absent.

The normalizer returns aggregate coverage suitable for console/PR reporting: scenarios, ordinary candidate count, boss
candidate count, distinct canonical characters, recipe counts and failures. No row-level dump.

## Pack and runtime contract

Emit one content-addressed pack named `spark-rivals`, version 1. Extend manifest/runtime loading as **optional** so the
currently published pre-T072 manifest remains valid. `LoadedContent` exposes parsed encounter rosters or `null`; malformed
present bytes remain a content-integrity error and never fall through silently.

The pack follows the existing `{ version, items }` writer contract. It has one item per scenario with stable string id
`tier:<tier>`, numeric tier, and normalized ordinary/boss candidates; candidate rows contain only template id, canonical
character id, derived primary strategy and recipe id. The parser verifies the `id`/tier relation and all aggregate bounds.

Selection is a pure function owned by the Spark feature:

```text
selectSparkEncounter(roster | null, umaCatalogue, traineeCharacter, tier, seed)
  → two ordinary rivals + one boss + source(authored|fallback)
```

- Authored selection filters the trainee's canonical character, selects the boss, then two ordinary distinct characters,
  all with stable seeded ordering. Same inputs return the same lineup.
- No rival may be the trainee's character and no two waves may share a canonical character, even through alternate outfits.
- Fallback considers the already loaded Uma catalogue, filters the trainee, orders by a seed-derived stable key and assigns
  base recipes from each selected template's best strategy. It requires no network and contains no hard-coded real id.
- If fewer than three distinct other characters exist (synthetic/dev edge), use generated synthetic silhouette rivals
  with no private identity rather than block Training. Production diagnostics mark this severe.
- The selection result snapshots the normalized recipe expansion needed for replay; a later content publication cannot
  change an already reserved run.

Expose a typed diagnostic with source and aggregate reason (`missing-pack`, `tier-missing`, `roster-exhausted`), integrate it
with existing content diagnostics/dev mode, and do not show “Content is not imported” when the fallback can play.

## Private authoring and publication

Outside git, author all fourteen scenario rosters. The roster should be themed to the scenario where practical, but that
is a curation choice, not permission to copy source-game race statistics or story text. Run:

```bash
pnpm data:import
pnpm assets:import
pnpm content:publish -- --dry-run
```

The dry run must show the new hashed pack and aggregate coverage. After the code PR merges, the production operator may
publish through the existing private runbook. Record only aggregate counts and manifest/content version in the task/PR.

## Tests

- Parser rejects every structural error, duplicate, missing tier, unknown recipe and insufficient no-self roster using
  synthetic ids only.
- Normalization output and hash are invariant to authored input order.
- Every recipe expands to a bounded T071-valid encounter definition.
- Fixed seed pins authored lineup selection; trainee exclusion and outfit/canonical duplication are covered.
- Missing pack, missing tier and tiny catalogue pin each fallback path and diagnostic; selection is stable after JSON
  round-trip and offline.
- Manifest compatibility tests load both pre-T072 manifests and manifests with the optional pack; corrupt present pack
  fails integrity checks.
- A source scan/fixture review proves no real id/name was introduced in git.

## Acceptance

- `pnpm data:import` with the private override reports 14/14 scenario coverage and no validation errors; no private rows
  appear in captured output.
- `pnpm content:publish -- --dry-run`, `pnpm lint`, `pnpm test` and `pnpm build` pass; startup remains ≤ 180 KB gzip.
- Git status contains no `content/`, generated pack, cache, manifest or original art.
- The synthetic dev proof can run all fourteen tiers from the parsed fixture, and an old manifest can start a fallback run.
- Production publication is explicitly recorded as complete or pending. Pending publication does not block T073 because
  fallback is required, but M022 cannot close until the authored pack is live and verified after sign-in.

## Out of scope

Production screen cutover, Dexie journals, reward commits, new art processing, infrastructure changes, new rival intents,
support-card combat and hand-authored numeric balance per rival.
