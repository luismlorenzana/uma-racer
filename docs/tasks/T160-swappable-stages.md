# T160 — Swappable stages: one pay bundle, Furlong Hand first

> **M037, part 1.** Domain, web and docs. Branch from `main`. Decision **D391**. Independent of T161; T162 retunes
> the bundle on the new calendar.

## Why

The owner, after first playing generation 3: Training Yard "won't be the main minigame for training… let's just keep it
around"; "all minigames… same outputs after completion so it's easy to swap in and out"; and "let's build out the
pocket card jockey style minigame then and we decide if we wire that one explicitly for training in Careers".

Furlong Hand is that game (T156), but today:
- it pays Bond and SP while the Yard pays drills and SP;
- the calendar decides which game a season opens.

So the games can't stand in for each other, and Furlong Hand can't be the training game.

## Context

Read first:
- **The design:** [careers v2 · swappable stages](../research/careers-v2/swappable-stages.md). This is the binding
  summary.
- **The framework:** [07](../game/07-stages.md), `stages/contract.ts`, `stages/settle.ts`, `stages/ops.ts` and
  `stages/config.ts`.
- **The pay:** `career/pay.ts` and [12](../game/12-pacing.md).
- **The season:** `career/season.ts` (`seasonStage`, `CareerGame`) and [03](../game/03-careers.md) §3.
- **Furlong Hand:** `stages/furlong/rules.ts` (`report`, `bonusSp`, the run cards' yields) and
  [09](../game/09-furlong-hand.md) §9.
- **Training Yard:** `stages/yard/rules.ts` (`report`, Rests) and [08](../game/08-training-yard.md).
- **The web:** `apps/web/src/places/career/` (the season's Play step, T158) and `apps/web/src/stages/StageHost.tsx`.
- **The sims:** `career/sim.ts` and `stages/sim.ts`.

## Do

1. **One bundle.**
   - `STAGE_PAY_AT_A` becomes one `StagePay`.
   - `stagePay(multiplier)` drops its game.
   - `stageAward` pays the bundle × the grade, with the drills split by the report's weights.
   - `StageReport.drills` becomes required, and `bonusSp` goes.
   - The starting numbers: about **100 drills, 12 Bond and 25 SP** at A. Set them with `sim:careers` on today's
     calendar so 12 §2's targets hold; T162 retunes them on the new calendar.
2. **Furlong Hand's split:**
   - `report().drills` is the ground each colour ran: its run cards' points by colour;
   - wild cards (Friend and Group strides and Partners) count for the season's focus colour, so `StageConfig` carries
     `seasonFocus` for Furlong Hand too;
   - banked cards count for nothing; Skill cards count for their colour;
   - no rules version bump: the moves and the state don't change;
   - the Partners' first-play SP Bonus leaves the pay (it already pays through the tree's sessions).
3. **Training Yard:**
   - its split is unchanged;
   - Rests still clear Fatigue but pay no SP (`report` stops sending `state.sp`);
   - its rule card and docs say so.
4. **`CAREER_GAMES`** (in `career/season.ts`):
   - `['furlong-hand', 'training-yard']`, the first being the main one;
   - `seasonStage` returns the season's games in that order, each with its context: Furlong Hand's race from
     `furlongRaceFor`, the Yard's focus;
   - the Finale offers Furlong Hand alone;
   - `careerStageConfig` builds either game in any season.
5. **The season's Play step** (web):
   - **Furlong Hand** is the big Play;
   - **Another game: Training Yard** is a second, smaller row;
   - each shows the same "Pays at A" line;
   - the Hub's two practice places are unchanged.

   T162 later makes racing seasons lead with Race, with the play as a smaller optional prep heat. T160 keeps today's
   season card order, so build the games' rows as one component T162 can move.
6. **Sims:**
   - `sim:careers` models the main game's split: Furlong Hand's, from the deck's type mix with wilds to the focus,
     replacing the Yard's growth model;
   - `sim:stages` adds a check that the competent Furlong Hand bot's weights cover at least 3 colours on a median deck.
7. **Docs:**
   - rewrite [03](../game/03-careers.md) §3, [07](../game/07-stages.md) §1–§2, [08](../game/08-training-yard.md),
     [09](../game/09-furlong-hand.md) §9 and [12](../game/12-pacing.md) §1 and §4, and the season screens in
     [11](../game/11-hub-and-places.md);
   - update `pnpm docs:update`'s blocks: career-pay becomes one row, and the Furlong Hand and Yard pay blocks lose the
     extra SP;
   - update the career guide's (`docs/design/game-loop/previews/career-guide.html`) Play section;
   - add **D391**: the bundle, the splits and `CAREER_GAMES`.

## Done when

- [ ] `stages/settle.test.ts`: every registered game, at every grade, pays the same bundle; only the drill split
      differs.
- [ ] Furlong Hand's tests:
  - [ ] the drill weights follow the colours run, and wilds count for the focus;
  - [ ] the golden plays still replay (the move hashes are unchanged), and the report hashes are re-pinned.
- [ ] Season tests:
  - [ ] every season offers both games, Furlong Hand first;
  - [ ] the Finale offers Furlong Hand only;
  - [ ] `settle-stage` pays either game in any season.
- [ ] A web test at 390×844, in light and dark: the Play step shows both games, Furlong Hand first.
- [ ] `pnpm sim:careers` meets 12 §2's targets on the private pack, and `sim:stages` holds its bands.
- [ ] `pnpm lint && pnpm test:ci && pnpm build` pass.

## Deliver

- Branch `feat/t160-swappable-stages` from `main`, with a PR into `main` titled
  `feat: swappable stages, Furlong Hand first (T160)`.
- CI must pass before the merge (no merge on red).
- Delete this file in the PR.
- It deploys on merge: verify per the release runbook, then tell the owner to restart the app.
