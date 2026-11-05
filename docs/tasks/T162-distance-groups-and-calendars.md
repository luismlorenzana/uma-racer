# T162 — Distance groups and their calendars

> **M037, part 3.** Domain, API, web and docs. Branch from `main` once T160 has merged (it retunes T160's bundle).
> Decision **D393**. It changes the save's shape: sync protocol 3 → 4, and the career in progress restarts.

## Why

The owner: careers need "a lot more in terms of racing". Umas should race by distance group:
- **Long** (Long and Medium): every long and medium G1, the Triple Crown and "the Long Triple Crown";
- **Mile and Medium:** the Triple Tiara, the Mile Crown and some medium races;
- **Sprint and Mile:** the sprint and mile G1s.

And: "maybe we do a lot of training upfront in the career and then the Uma races all the career at their max stats".

Today a career is six objectives from a generator. The owner also asked how tickets are earned.

## Context

Read first:
- **The design:** [careers v2](../research/careers-v2/README.md). This is the binding summary, with the visual summary
  in [previews/careers.html](../research/careers-v2/previews/careers.html). This packet carries:
  - §1, the groups;
  - §2, the calendars;
  - §4, the pacing;
  - §5, the tickets;
  - §7, the code map;
  - §8's defaults (D390).
- **T160** (merged): `CAREER_GAMES` and the one pay bundle.
- **The career code:**
  - `scenario-goals.ts`, `career-shapes.ts` and `career-stages.ts` (the generator, which retires);
  - `career/` (calendar, start, season, races, rewards, finale, pay, sim, synthetic);
  - `tiers/rivals.ts`;
  - `race-series.ts` and the private overlay `content/overrides/flair.json` (the series legs; Claude keeps it,
    D107).
- **The save:**
  - `save/records.ts` (`CareerRecord`, `CareerObjective`) and its parsers;
  - the protocol constant;
  - the API's sync and save;
  - the web's `save/`.
- **The manual:** [03](../game/03-careers.md), [12](../game/12-pacing.md), [Racing](../game/racing.md),
  [02](../game/02-unlocks.md) §1 and [11](../game/11-hub-and-places.md) §3 and §8.

## Do

1. **The groups** (§1):
   - `distanceGroups(aptitudes)`: A in one distance and B or better in the other, on a surface where she is A;
   - `defaultGroup`;
   - Umas with no group run a group holding their A distance, with their below-B races optional (§1.4);
   - dirt is the Mile · Medium dirt calendar (§1.5);
   - the crowns' sex gate goes (§8, point 6).
2. **The calendars** (§2):
   - `career/calendars.ts` holds the four fixed tables of §2.2: slots by season in month order, with grade, distance,
     optional, and the crowns of each leg;
   - the planned plays per season;
   - `resolveCalendar(group, surface, races, aptitudes)` resolves slots by public name and distance with §9.1's
     tie-break;
   - a race can come twice, keyed `season:race`, and its seed names the season;
   - her own G1s join the optional list (§2.3);
   - the generator, the Maiden/Trials/Main stages and `placeObjectives` retire;
   - season placement is by month (§2.1).
3. **The seasons** (§2.1, §2.3):
   - the Junior block: Spring, Summer and Autumn, three planned plays each, no races;
   - Junior Winter: one play and her Junior G1;
   - racing seasons lead with **Upgrade → Race**, with the play as an optional prep heat (T160's rows moved below the
     races);
   - Classic and Senior Summer are camps, one play each;
   - `canAdvance` ignores optional races;
   - optional races pay their SP on a first win and never block.
4. **The URA Finals:** at one of her group's two distances on her surface, picked at the Finale
   (`set-finals-distance`, defaulting to her better aptitude, ties to the longer).
5. **Pacing** (§4):
   - retune T160's bundle on the new calendar, starting from **110 drills, 15 Bond and 0 SP**;
   - set `RIVAL_SEASON_SHARE` to §4.2's curve, then re-set it from the sim's print as D383 did;
   - re-measure `RIVAL_TRAINED_STAT` for T1.
6. **Tickets** (§5):
   - a crown won (every leg of a series, objectives or optional races) pays **1 Card Ticket**;
   - an objective's win pays SP only;
   - the URA Finals keep 1 Uma Ticket and 2 Card Tickets;
   - the calendar strip and the race sheet show a crown's ticket on its last leg.
7. **The save** (§7):
   - `CareerRecord` gains `group`, `surface`, `objectives` with `optional`, the `finale` with its `distance`, and
     **`presets`** (one per distance, each `{ deck, posts, strategy }`) in place of `deck` and `posts`;
   - both presets start as the same deck, and T163 builds the per-distance editing on this shape, so the save
     changes once;
   - `racingBuilds` per distance;
   - **sync protocol 4**: an older app is told to update;
   - `restart-careers`, a one-time operation with a fixed id, deletes careers in the old shape with their race
     results and stage journals, and keeps every ticket, unlock and bond track (§8, point 7).
8. **The web:**
   - the Start career group sheet (§1.6);
   - the calendar strip (G1 solid, G2 grey, G3 outlined, optional dashed, crown legs, the block's plays as pips);
   - the season card: Play n of 3 in the block, Upgrade → Race in racing seasons;
   - the Finals' distance pick;
   - the completion screen with the crowns won;
   - the Stable album's group filter.
9. **Sims:** `sim:careers` per §4.4: every Uma in each group she qualifies for, the bands per calendar, printing the
   curve, the first tries by school year and the SP sources, with `--group=`. The synthetic content gains races named
   after the slots, with invented courses and stats.
10. **Docs:**
    - rewrite [01](../game/01-game-loop.md), [02](../game/02-unlocks.md) §1, [03](../game/03-careers.md) whole,
      [04](../game/04-tiers-and-scenarios.md) §4, [11](../game/11-hub-and-places.md) §3 and §8,
      [12](../game/12-pacing.md), [Racing](../game/racing.md) and [the architecture](../game/architecture.md)'s save;
    - add live blocks for the four calendars, the groups rule, the plays per season and the crowns' tickets;
    - rewrite the career guide;
    - add **D393** with the sim's results as shares.

## Done when

- [ ] Domain tests:
  - [ ] the groups rule on synthetic aptitudes, including no group, dirt and two groups;
  - [ ] each calendar resolves on synthetic races named after its slots;
  - [ ] repeated races carry distinct keys and seeds;
  - [ ] optional races never block;
  - [ ] a crown pays once;
  - [ ] the Finals at the picked distance;
  - [ ] `restart-careers` keeps tickets, unlocks and bonds, and drops old careers;
  - [ ] the strict v4 parser refuses the v3 career shape.
- [ ] API tests: protocol 4, the new operations replay alike.
- [ ] Web tests at 390×844 in light and dark: the group sheet, a block season, a racing season, the Finals pick.
- [ ] `pnpm sim:careers` meets §4.4's bands for every calendar on the private pack (aggregates only in the PR and
      D393), and the synthetic bands in CI.
- [ ] `pnpm lint && pnpm test:ci && pnpm build` pass; the startup chunk stays ≤ 180 KB gzip.

## Deliver

- Branch `feat/t162-distance-groups` from `main`, with a PR into `main` titled
  `feat: careers by distance group, full race calendars (T162)`.
- CI must pass before the merge.
- Delete this file in the PR.
- Before merging, update `content/overrides/flair.json` if a calendar's crown needs a leg the overlay lacks, then
  run `pnpm overlays:import` and publish. Only Claude does this.
- It deploys on merge. Verify per the release runbook, including that `restart-careers` ran on the owner's account:
  read-only Firestore, aggregates only. Then tell the owner to restart the app and that their career starts over
  under v2, with tickets, unlocks and bonds kept.
