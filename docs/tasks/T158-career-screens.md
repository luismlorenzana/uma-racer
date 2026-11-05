# T158 — The career screens: season flow, upgrade, races and the finale

> **M036, part 7 of 8.** Web. Starts once T153, T154 and T157 have merged. T155 and T156 should have merged too, so
> the season's Play step opens real games. Decision **D387**.

## Why

This is where the game is played:
- start a career;
- walk its 12 seasons of **Play → Upgrade → Race**;
- spend resources in the tree, the deck, bonds and skills, with every number previewed;
- race the objectives on the real engine;
- win the URA Finals.

The screens must make a career feel fast and readable on the phone, and match the owner's "fewer taps, icons over
text" rule (D366).

## Context

Read first:
- [M036](M036-ura-finale-slice.md), "The career", "The build" and "The places". This is the binding summary.
- [v3](../research/drawing-board/README.md) §2 (the season's three steps) and §4 (the build).
- **The domain:**
  - T153's `@racer/domain/build` (`previewPip`, `buyPips`, posting, `pourBond`, `skillCost`, `deriveRacingBuild`);
  - T154's `@racer/domain/career` (calendar, `seasonStage`, `canAdvance`, `prepareObjectiveRace`, finale, rewards);
  - T155's `StageHost`.
- **Today's race screen and scene**, which T152 keeps: the run screen (`RunPage`) and `apps/web/src/scenes/race`
  (PixiJS, lazy). Re-point them to T154's `prepareObjectiveRace` and the `run-race` operation.
- **Kit:** `PlacePageHeader`, `Sheet`, `Tabs`, `Chip`, `Button`, `UiMark`, `FaceTile` and `UmaBust`, plus Motion's
  `m.*`.
- **The owner's rules:** durations never (and there are none now), icons over text, one-screen sheets with the obvious
  choice preselected, 44 pt targets, light and dark.

## Do

1. **Careers** (the place, `apps/web/src/places/career/`):
   - **In progress:** a row per Uma with her face, scenario, season and next objective. A tap opens her career.
   - **Start a career:** pick an owned Uma (the kit's `UmaPicker`, free Umas only) and confirm.
   - **Completed:** her racing builds.
2. **A career's page:**
   - **The calendar strip:** 12 seasons and the Finale. The current one is highlighted, objectives are marked on their
     seasons, and finished seasons are checked.
   - **The season card:** three steps with clear states.
     1. **Play:** the season's game, opened in the host.
     2. **Upgrade:** a badge counts what's affordable.
     3. **Race:** the season's objectives, each with its grade, course and a **Race** button.
   - **Next season** is enabled once every objective in the season is won.
   - **Play again:** both games at any time, from the page header.
   - **The wallet:** drills by colour, Bond and SP, as icons with numbers.
3. **Upgrade**, as one screen with tabs:
   - **Tree:**
     - five branch columns;
     - each pip shows its exact **+gain** (per stat and SP) and its cost before buying;
     - overflow over the cap is shown;
     - **Buy row** buys a level's four pips at once;
     - Camp nodes, once open.
   - **Deck:**
     - six slots and the owned cards allowed by era, filtered by type and focus;
     - posting each card to a branch, by default its own type's;
     - changing the deck or a post re-previews the tree at once.
   - **Bonds:**
     - per deck card, a 0–100 bar with its stops (hints, 80 and 100) marked;
     - **Pour** with the amount preselected to the next stop;
     - the next hint skill is named.
   - **Skills:**
     - her library with costs after hint discounts;
     - the SP cap's remaining amount;
     - **Buy**.
     - Bought skills are listed. Golds show their white requirement.
4. **Races:**
   - the race sheet shows her racing build (stats, aptitudes, skills), the strategy (preselected `bestStrategy`) and
     the field;
   - **Race** commits `run-race` and plays the result in today's scene;
   - the result returns to the career with the objective's status and any reward;
   - a lost race offers **Retry** at once.
5. **The finale:**
   - after the Senior Winter season, the Finale card shows the prep heat (Play), then the qualifier, semifinal and
     final, one at a time;
   - winning the final shows a completion screen: her frozen racing build, the tickets earned, and "Next: Unity Cup,
     coming in release 2";
   - the career moves to **Completed**.
6. **Resume:** reopening the app returns to the career page, and a stage in progress resumes through T155's host.
7. **The manual:** add the career screens to `docs/game/11-hub-and-places.md`'s menu tree (every route, sheet and
   button), and cross-link `03-careers.md` and `05-the-build.md`.
8. **D387:** the screen structure, the badges and preselections, and the race sheet.

## Done when

- [ ] Web tests take a synthetic Uma through a whole career with fixed seeds:
  - [ ] start;
  - [ ] each season's Play (settle through the host, with bots' journals), Upgrade (buy pips, post, pour, buy a skill)
        and Race;
  - [ ] Next season;
  - [ ] the finale and completion.
  
  Previews equal what is bought.
- [ ] Nothing on these screens reads a clock. Every target is ≥ 44 pt, light and dark work, and the layout fits
      390×844.
- [ ] `pnpm lint && pnpm test:ci && pnpm build` pass, within the 180 KB budget. The race scene stays lazy.
- [ ] The menu tree and D387 are written.

## Deliver

- Branch `feat/t158-career-screens` from `restart/g3`. Open a PR into `restart/g3` titled
  `feat(web): the career screens (T158)`.
- Delete this file in the PR. Claude merges.
