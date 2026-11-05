# T154 — The career: calendar, seasons, objectives and the URA Finals

> **M036, part 3 of 8.** Domain only. Starts after T152 has merged. It needs T153's `deriveRacingBuild` signature;
> agree it from T153's draft PR or stub it behind the same type. Decision **D383**.

## Why

A career is the restart's spine ([v3 §2](../research/drawing-board/README.md#2-the-shape-of-the-game)):
- 12 seasons of **Play → Upgrade → Race**;
- her objectives, raced on the real engine;
- the URA Finals as the finale.

This part writes the calendar and the season machine, settles races, pays rewards, and re-tunes the rivals so a
properly built Uma wins.

## Context

Read first:
- [M036](M036-ura-finale-slice.md), "The rules → The career", "Unlocks" and "Rivals". This is the binding summary.
- [01](../research/drawing-board/01-uma-career-and-scenarios.md) §1: the original calendar, objectives and URA's
  three-race finale.
- **Kept code:**
  - `scenario-goals.ts`: `planScenarioCareer` and `generateScenarioJourney` (Maiden G3, two Trials G2s, three Main G1s,
    rotated by T) and `careerProfile`;
  - `race-catalog.ts` and `content.ts` (`RaceTemplate.season`, `grade`, `distanceCategory`, `surface`, `courseId`);
  - `course-layout.ts`;
  - `tiers/rivals.ts`: `rollRivalFieldAt` and `rivalFieldStat`;
  - `opponents.ts`;
  - `progression-race.ts`: `raceAttemptSeed`, `raceAttemptId`, `bestStrategy` and `RaceResultRecord`, keeping only what
    a race needs;
  - `packages/race` (`simulateRace`, `RaceInput`).
- **The generation-3 save from T152:**
  - the `career` record: Uma, T, season index, objectives with their status, finale state, the frozen racing build;
  - the `race-result` record;
  - the declared operations `start-career`, `run-race`, `next-season` and `run-finale`.
- **T153:** `deriveRacingBuild(career, …)` is the only source of her runner. T155: stages pay into the career wallet;
  this part only reads which stage a season plays.

## Do

1. **`packages/domain/src/career/` (new area, subpath `@racer/domain/career`):**
   - **`calendar.ts`:**
     - The seasons are Junior, Classic and Senior × Spring, Summer, Autumn and Winter, indices 0–11, then the Finale
       (12).
     - `placeObjectives(journey)` puts each goal in its race's season (`RaceTemplate.season`):
       - the Maiden falls in Junior;
       - the Trials fall in Classic;
       - of the Main G1s, the earliest by season falls in Classic and the other two in Senior;
       - a race that can't fit that order moves to the next year;
       - two objectives may share a season.
     - Map `RaceTemplate.season` to the four seasons, and document the mapping.
   - **`season.ts`:** the season machine.
     - `seasonStage(career)` names the stage: Furlong Hand on the season's first objective course if the season holds
       one, otherwise Training Yard.
     - `canAdvance(career)` is true when every objective in the season is won.
     - `nextSeason(career)` moves the calendar.
     - Stages and replays never move the calendar.
   - **`start.ts`:** `startCareer(uma, T)` freezes the journey with `planScenarioCareer` (T = 1), places it and opens
     an empty tree and wallet. One career at a time per Uma, and one URA Finale career per Uma in this release.
   - **`races.ts`:**
     - `prepareObjectiveRace(career, objective, attempt)` builds the `RaceInput`: her runner from `deriveRacingBuild`
       with the strategy she chooses (default `bestStrategy`), the rival field from `rollRivalFieldAt` at T and the
       race's grade, and the seed from `raceAttemptSeed`.
     - `settleRace(result)` marks the objective won on a first-place finish; retries are free.
     - A race must be an objective of the current season or of the finale.
   - **`finale.ts`:** the URA Finals.
     - The prep heat is the season's stage. Then come three races (qualifier, semifinal and final) at her best distance
       and surface by aptitude, on the catalogue's highest-grade course for that pair.
     - The fields strengthen: G2, G1 and G1 with a stronger handicap. Write the handicaps in D383.
     - Winning the final completes the career and **freezes her racing build** on the career record as her URA Finale
       build.
   - **`rewards.ts`:**
     - an objective's first win pays +1 Card Ticket and SP by grade (G3 40, G2 60, G1 100) × (1 + Σ the deck's real
       Race Bonus) into the career wallet;
     - completing the finale pays +1 Uma Ticket and +2 Card Tickets to the account.
2. **Operations** in `career/ops.ts`, wired into T152's dispatcher: `start-career`, `run-race` (a seeded attempt; the
   server re-runs `simulateRace` and settles), `next-season` and `run-finale`. Each is idempotent by id and refuses in
   plain words.
3. **Rivals re-tune.**
   - Using T153's `deriveRacingBuild` and `sim:decks` decks, extend **`sim:careers`** to play every Uma's T1 career
     with "played once at A" resources:
     - spend them greedily (a fixed allocation bot, documented);
     - race each objective, recording first-try win rates.
   - Tune `rollRivalFieldAt`'s T1 handicaps until a median bonded deck wins a G3 ≥ 90%, a G2 ≥ 75% and a G1 ≥ 50% of
     first tries, a strong deck wins more, and the URA Finals final sits near 50% for a median deck.
   - Synthetic in CI; private-pack aggregates locally, given in the PR only.
4. **Pacing:**
   - Settle the stage pay tables with T155/T156's targets: a career played once at A ends with about 60% of the tree
     bought, about 3 of 6 cards at bond 80 and SP for 4–6 skills, and one replay of each Training Yard season fills
     the tree.
   - Put the shared numbers (drills, Bond and SP at grade A per game) in one `career/pay.ts` table that the stage
     settle reads.
5. **The manual:**
   - rewrite `docs/game/01-game-loop.md` (the career loop) and write `docs/game/03-careers.md` (calendar, objectives,
     seasons, the finale, rewards);
   - rewrite `docs/game/04-tiers-and-promotion.md` as `04-tiers-and-scenarios.md`: the tier map's live block, caps,
     the 15th scenario as **Goshiki Shuntaisai** (JP 2026-10-26; update the map and its test), and promotion marked
     "release 4";
   - write `docs/game/12-pacing.md` (the pay table, the targets and the sims);
   - update `docs/game/racing.md`'s rivals section.
6. **D383:** the season mapping, the placement rule, the finale fields, the handicaps, the pay table and the sims'
   results (shares only).

## Done when

- [ ] Tests cover placement for synthetic journeys (every rule above, collisions and roll-forward), the season machine,
      the race settle (won and lost), the finale and its freeze, and rewards, all through `commitOperation`.
- [ ] `pnpm sim:careers` passes in CI on synthetic content. Its local private-pack rates meet the targets and are given
      in the PR.
- [ ] `pnpm lint && pnpm test:ci && pnpm build` pass. Nothing in `career/` reads a clock.
- [ ] The manual pages and D383 are written.

## Deliver

- Branch `feat/t154-the-career` from `restart/g3`. Open a PR into `restart/g3` titled
  `feat(domain): the career — calendar, seasons, URA Finals (T154)`.
- Delete this file in the PR. Claude merges.
