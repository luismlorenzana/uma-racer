# Data Research Backlog

Game data the design depends on. Everything extracted from the original game (character, card, and skill data,
text, images) follows the same rule as assets: **local-only, never published**.

**Most of this is already solved by uma-planner's importers** (GameTora datasets: 5★ stats, growth rates, aptitudes, release dates, `obtained`, hint skills, `gene_version` inherited uniques). See [`scripts/data/README.md`](../../scripts/data/README.md).

Candidate sources: [GameTora](https://gametora.com/umamusume) (support, character, and skill databases),
[Umamusume Wiki](https://umamusu.wiki), [uma.guide](https://uma.guide), [Game8](https://game8.co/games/Umamusume-Pretty-Derby).

## Uma templates

- [ ] Roster list (per outfit) with JP release dates.
- [x] **25 launch trainees** confirmed from GameTora `character-cards`: exactly 25 cards released 2021-02-24 (9 three-star, 8 two-star, 8 one-star). T.M. Opera O was not at launch.
- [x] Real-horse sex is available as `characters.sex` (1 = male, 2 = female). Import tracked in [T001](../tasks/T001-content-data-packs.md).
- [ ] **5★ base stats** for every Uma, and stat growth rates.
- [ ] Unique skill level and effect at 5★ (the baseline for the inherited ×0.5 version).
- [ ] Aptitudes (surface, distance, strategy).
- [ ] Unique skill, and awakening (potential) skills.
- [ ] `realHorseSex` for every Uma.
- [ ] `signatureRaces`: the real horse's famous wins (the original game's career goals are a good seed).

## Support cards (SSR only)

- [ ] Every SSR card: character, title, type, JP release date → era.
- [ ] **Acquisition method** (`event` / `free` / `gacha`) to define the starter set. Confirmed so far: story event reward SSRs exist
      (for example SSR Special Week "The Setting Sun and Rising Stars", Speed).
- [ ] Effect profile: which effects each card has, and which are its standouts.
- [ ] Hint skill lists, and unique effects.

## Skills

- [ ] Skill list: kind (unique / gold / white), trigger conditions, effect type and magnitude, duration.
- [ ] Gold ↔ white skill relationships.
- [ ] Inherited unique skill strength compared to the original unique.
- [ ] Typical SP costs, to calibrate draft costs.

## Races and courses

- [ ] Race catalog: name, grade, venue, surface, distance, direction, series.
- [ ] Course layouts: corners, straights, and slopes per course (for later race engine milestones).

## Scenarios

- [ ] Verify the ⚠️ release dates in [Scenarios](../design/scenarios.md).
- [ ] Scenarios released in JP after Design Your Island (late 2025 onward).
