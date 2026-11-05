# T164 — Race conditions: ground, weather and season in the engine

> **M037, part 3.** Race engine, domain and docs. Branch from `main`. It's independent of T160 and T161, so it can
> run beside them. T162 needs it, because its URA Finals run on an announced course and conditions. Decision **D396**.

## Why

The owner wants the URA Finals to work like the original's Champions Meeting and League of Heroes: an announced course
("Tokyo 2000m, Chukyo 1200m") with "variable conditions for each event". Our engine runs every race on firm ground in
sunny weather (`FIXED_GROUND_CONDITION`, `FIXED_WEATHER`) and has no season. As a result, the 55 skills that read the
season, weather or ground can't fire and can't be bought, and the ground never changes a race.

## Context

Read first:
- **The design:** [the URA Finals as an announced course](../research/careers-v2/finale-events.md) §4 and §6.
  This is the binding summary.
- **The engine:** `packages/race/src/` (`engine.ts`'s condition variables, `constants.ts`, `types.ts`'s `RaceInput`,
  `validation.ts`, and the engine version).
- **The research:** [race mechanics](../research/race-mechanics.md) (the ground's HP modifiers, and the stat table
  left open there) and [the mechanics review](../research/race-mechanics-review.md).
- **The skills:** `packages/domain/src/race-skills.ts` (`COURSE_RACE_VARIABLES`, unsupported variables) and
  [05](../game/05-the-build.md) §8's "no effect in races" rule.
- **The race hand-off:** `career/races.ts` (`prepareCareerRace`, the seeds) and the API's race re-run.
- **Course data:** the content's `statThresholds` on each course.

## Do

1. **The inputs:** `RaceInput.conditions` is `{ ground: 1–4, weather: 1–4, season: 1–4 }`, using the original's
   codes (ground 1 firm … 4 heavy; weather 1 sunny, 2 cloudy, 3 rainy, 4 snowy; season 1 spring … 4 autumn and winter
   as the original numbers them). It's validated, and absent means today's firm and sunny. The `ground_condition` and
   `weather` variables read it, and `season` joins them.
2. **The ground's effects:** the stat modifiers and HP use from the design's table, for her and every rival.
   - Check each value against the race-mechanics sources first.
   - Cite the sources in [race mechanics](../research/race-mechanics.md), and close its "table to research" item.
   - Where a source disagrees, take the original's value and say so in D396.
3. **The course's stat check:**
   - Research the original's rule for each course's `statThresholds`.
   - If the sources confirm it, build it and pin it with tests.
   - If they don't, record in D396 why it stays unread.
4. **Skills:** skills whose conditions read the season, weather or ground are no longer unsupported, so they race and
   can be bought. An older record's compiled skills still replay as they were (the engine-version rule).
5. **The engine version** goes up. Records raced on the old version replay on it, as before.
6. **Calendar races:** `prepareCareerRace` passes the race's month as the original's season, sunny weather and firm
   ground. The URA Finals' own conditions come with T162.
7. **Sims:**
   - `sim:balance` adds a ground column (each style's win share on firm and on heavy);
   - `sim:careers` holds 12 §2's bands with the season skills now buyable;
   - aggregates only.
8. **Docs:**
   - rewrite [Racing](../game/racing.md) (conditions and the ground), and [05](../game/05-the-build.md) §8 (which
     skills can be bought);
   - add a live block for the ground table;
   - add **D396**.

## Done when

- [ ] Engine tests:
  - [ ] each ground's stat and HP effect on her and a rival;
  - [ ] the condition variables read the input;
  - [ ] a season skill fires only in its season, and a weather or ground skill only under its condition;
  - [ ] absent conditions race exactly as today (golden timelines unchanged at firm and sunny);
  - [ ] an old record replays on its version.
- [ ] Domain tests:
  - [ ] the newly supported skills can be bought;
  - [ ] a calendar race's season follows its month.
- [ ] `pnpm sim:balance` and `pnpm sim:careers` pass on the private pack.
- [ ] `pnpm lint && pnpm test:ci && pnpm build` pass.

## Deliver

- Branch `feat/t164-race-conditions` from `main`, with a PR into `main` titled
  `feat: ground, weather and season in the race engine (T164)`.
- CI must pass before the merge.
- Delete this file in the PR.
- It deploys on merge. Verify per the release runbook, then tell the owner to restart the app and that season,
  weather and ground skills can now be bought.
