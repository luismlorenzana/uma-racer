# T019 — Race series legs and earnable titles (Milestone 7, part 1)

**Outcome:** the race-set titles the design promises — Triple Crown, Triple Tiara, Spring and Autumn Triple Crown, Grand
Prix Queen, Sprint Queen, Mile Queen, Dirt Queen — and the Grand Tour badge become earnable, including retroactively from
races already won. Today they are permanently unearnable in production.

## Why this is broken

[Badges](../design/badges.md#4-titles-and-g1-trophies) awards these titles from semantic `series` tags that the importer
reads out of an owner-maintained, gitignored `content/overrides/flair.json` (D99). That file was never written, so:

- the published content has **0 tagged families and 0 main venues**;
- every race-set title and Grand Tour is silently disabled;
- the Trainer achievement **Title Holders** can never reach its `all` tier;
- only the Two-Time / Three-Time [Race] repeat titles work, because those need no tags.

The override also needs one shape change before it can be written honestly. Race **names are not one family**: the
retained catalog holds alternate-venue and scenario variants, for example Satsuki Sho at two venues and Arima Kinen in
three families. The current rule — "win every tagged family" — would demand winning all of them, and tagging only one
variant would refuse credit for the others.

## Fixed choices

- A series is a list of **legs**. A leg is one real race, satisfied by a win in **any** of its family aliases.
- Leg counts per tag are unchanged: 3 for the four Triple Crown/Tiara sets, 2 for the four Queen sets.
- The override stays **private and gitignored**. No family id, venue id, or other original-game identifier enters git.
  Real race names (Satsuki Sho, Arima Kinen) are public JRA facts and may appear in docs and in the catalog's labels.
- Claude owns and publishes the override file (D107). It is not an owner action, and a delegated agent never needs the
  private content or cloud credentials to finish the code.
- Titles stay pure flair, monotonic, and never revoked (D98).

## Implementation contract

### Override format v2

```text
{
  "version": 2,
  "series": [
    { "tag": "triple-crown",
      "legs": [ { "key": "satsuki-sho", "familyIds": ["…", "…"] }, … ] }, …
  ],
  "mainVenueKeys": ["…", …]
}
```

- `tag` is one of the eight `FLAIR_SERIES_TAGS`; every tag appears at most once.
- `key` is kebab-case, 1–40 characters, unique within its tag, and stable: it becomes part of award evidence.
- `familyIds` is a non-empty, duplicate-free list of retained family ids; a family may appear in several tags (Takarazuka
  Kinen is both `spring-triple-crown` and `grand-prix`) but only once per tag.
- Validation keeps its current strictness and fails the import on: an unknown tag, an unknown family or venue, a duplicate
  leg key, a family repeated inside one tag, a leg count that does not match `FLAIR_SERIES_REQUIRED_LEGS`, or a
  `mainVenueKeys` list that is not exactly 10 distinct retained venues.
- A missing file keeps today's behavior: a warning, zero coverage, and only the affected criteria disabled.
- There is no v1 file in existence, so v2 replaces v1 outright rather than migrating it.

### Domain and content

- Replace `FLAIR_SERIES_REQUIRED_FAMILIES` with `FLAIR_SERIES_REQUIRED_LEGS` (`triple-crown` 3, `triple-tiara` 3,
  `spring-triple-crown` 3, `autumn-triple-crown` 3, `grand-prix` 2, `sprint-crown` 2, `mile-crown` 2, `dirt-crown` 2) and
  pin it in `domain.test.ts`.
- `RaceTemplate` keeps `series: FlairSeriesTag[]` and gains `seriesLegs: string[]`, each entry `"<tag>:<leg key>"`,
  sorted and duplicate-free. Races with no coverage keep empty arrays.
- A title is earned when the Uma has won at least one family of **every leg** of that tag. The evaluator resolves
  family → legs through the **current** content join, so no badge-state migration is required and stored
  `FamilyWinFact.series` values stay valid.
- Grand Tour is unchanged: one win at each of the 10 `jra-main` venue keys, with the awarding catalog version freezing
  the venue set.

### Retroactivity

- Titles and Grand Tour must be awarded **retroactively** from existing race history the first time coverage appears.
  The badge bootstrap already reconciles per-Uma facts; this task requires that a change in content version re-evaluates
  the series-dependent criteria and appends the ordinary deterministic flair events for anything already achieved.
- Retroactive awards collapse into the existing archive summary rather than replaying a wall of fanfare (D97).
- The first title an Uma earns fills her empty active-title slot (D98); later ones do not displace it.

### Diagnostics

- The Badge page's existing content diagnostic must distinguish "no series coverage published" from "covered, not yet
  earned", and Settings reports the number of covered series and main venues alongside the content version.

## Deliverables

Deliverables 1–3 are ordinary delegable code work. Deliverable 4 needs the private content and the production bucket, so
Claude runs it after the code merges; the PR for 1–3 ships with coverage still at zero and everything degrading exactly
as it does today.

1. Override parsing, validation, and the `seriesLegs` stamp in `scripts/data`, with synthetic fixtures.
2. `FLAIR_SERIES_REQUIRED_LEGS`, the leg-based title criterion, and the content join in `packages/domain`.
3. Retroactive re-evaluation on content-version change, plus the diagnostic strings.
4. **Claude only:** author `content/overrides/flair.json` with these legs and venues, re-import, and publish.

| Tag | Legs |
|---|---|
| `triple-crown` | Satsuki Sho · Tokyo Yushun (Japanese Derby) · Kikuka Sho |
| `triple-tiara` | Oka Sho · Japanese Oaks (Yushun Himba) · Shuka Sho |
| `spring-triple-crown` | Osaka Hai · Tenno Sho (Spring) · Takarazuka Kinen |
| `autumn-triple-crown` | Tenno Sho (Autumn) · Japan Cup · Arima Kinen |
| `grand-prix` | Takarazuka Kinen · Arima Kinen |
| `sprint-crown` | Takamatsunomiya Kinen · Sprinters Stakes |
| `mile-crown` | Yasuda Kinen · Mile Championship |
| `dirt-crown` | February Stakes · Champions Cup |

Main venues: Sapporo, Hakodate, Niigata, Fukushima, Nakayama, Tokyo, Chukyo, Kyoto, Hanshin, Kokura. Every alternate-venue
or scenario variant of a leg's race belongs to that leg's `familyIds`.

## Tests

Synthetic fixtures only, no network:

- A leg with two alias families awards the title from either alias, and never twice.
- A tag with one leg unwon awards nothing.
- Validation rejects: unknown tag, unknown family, unknown venue, duplicate leg key, duplicated family inside a tag,
  wrong leg count, 9 or 11 main venues.
- A missing override disables exactly the series criteria and Grand Tour, and nothing else.
- Retroactive evaluation awards from stored race history exactly once and is idempotent on a second boot.
- `domain.test.ts` pins the leg counts.

## Acceptance

- `pnpm lint && pnpm test && pnpm build` pass.
- After Claude publishes: the import reports 8 covered series and 10 main venues, the production Badge page shows the
  titles as earnable, and an Uma with the right wins holds the title without any new race.
- No original-game identifier is committed; `content/` and `scripts/*/.cache/` stay ignored.

## Out of scope

New badge definitions or criteria, `Duelist` and `Upset` (still deferred), goal changes (T020), badge art, and any change
to how G1 trophies count.
