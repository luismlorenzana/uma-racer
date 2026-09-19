# Data Research Backlog

Game data the design depends on. Everything extracted from the original game (character, card, and skill data,
text, images) follows the same rule as assets: **local-only, never published**.

**Most of this is already solved by uma-planner's importers** (GameTora datasets: 5★ stats, growth rates, aptitudes, release dates, `obtained`, hint skills, `gene_version` inherited uniques). See [`scripts/data/README.md`](../../scripts/data/README.md).

Candidate sources: [GameTora](https://gametora.com/umamusume) (support, character, and skill databases),
[Umamusume Wiki](https://umamusu.wiki), [uma.guide](https://uma.guide), [Game8](https://game8.co/games/Umamusume-Pretty-Derby).

## Uma templates

- [x] Roster list (per outfit) with JP release dates.
- [x] **25 launch trainees** confirmed from GameTora `character-cards`: exactly 25 cards released 2021-02-24 (9 three-star, 8 two-star, 8 one-star). T.M. Opera O was not at launch.
- [x] Real-horse sex is available as `characters.sex` (1 = male, 2 = female), imported as `realHorseSex`. It drives classic-series goals and the Stable filter.
- [x] **5★ base stats** for every Uma, and stat growth rates.
- [x] Unique skill level and effect at 5★ (the baseline for the inherited ×0.5 version).
- [x] Aptitudes (surface, distance, strategy).
- [x] Unique skill, and awakening (potential) skills.
- [x] `realHorseSex` for every Uma.
- [x] Ordered `signatureRaceFamilyIds` are normalized from GameTora `ura-objectives` career-race references and joined to
      retained gameplay race families. Objective names/conditions and raw rows remain private and are not copied into packs.

## Support cards (SSR only)

- [x] Every SSR card: character, title, type, JP release date → era.
- [x] **Acquisition method** (`event` / `free` / `gacha`) to define the starter set. Confirmed so far: story event reward SSRs exist
      (for example SSR Special Week "The Setting Sun and Rising Stars", Speed).
- [x] Effect profile: which effects each card has, and which are its standouts.
- [x] Hint skill lists, and unique effects.

## Skills

- [x] Skill list: kind (unique / gold / white), trigger conditions, effect type and magnitude, duration.
- [x] Gold → white skill relationships normalized from ordered source `versions`; missing counterparts remain explicit importer diagnostics.
- [x] Inherited unique skill strength compared to the original unique.
- [x] Typical SP costs, to calibrate draft costs.

## Races and courses

- [x] Race catalog: name, grade, venue, surface, distance, and direction.
- [x] Stable race-family ids for matching career objectives to concrete gameplay race variants.
- [x] Private race-series/main-venue override v2 contract, leg-alias validation, normalized `seriesLegs`, and aggregate-only diagnostics.
- [x] `content/overrides/flair.json` is authored and published (Claude's, D107): 8 series as legs with their alias families, across 30 race families, plus the 10 `jra-main` venues. Re-check it whenever new races are retained. No live identifier or mapping enters git.
- [x] JP scenario list verified against the public GameTora `scenarios` dataset on 2026-09-19: 14 released scenarios, all
      dates confirmed. Tiers 12–14 are live, and each import warns from aggregate counts/dates when the source moves ahead.
- [x] Course layouts: corners, straights, and slopes per course (for later race engine milestones).

## Scenarios

- [x] Every released JP scenario through Tracen Diner is modeled; all release dates are verified.
- [x] Aggregate importer coverage warns when a later released source scenario is not yet modeled.
