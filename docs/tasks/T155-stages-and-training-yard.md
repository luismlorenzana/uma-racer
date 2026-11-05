# T155 — The stage framework and Training Yard

> **M036, part 4 of 8.** Domain and web. Starts after T152 has merged. **Land the contract first** (step 1, as an
> early PR or the first commit pushed) so T156 can build on it. Decision **D384**.

## Why

Every mini-game shares one framework ([02](../research/drawing-board/02-mini-games.md) §5):
- pure seeded rules;
- bots and a balance sim;
- a lazy view;
- a journal that survives iOS killing the app;
- the domain, not the view, settling the grade and the pay.

Training Yard is the first game on it. It's a Triple Town–like merge drawn as **Uma face tiles on stat-coloured
backgrounds**, and it pays the Drills the tree spends.

## Context

Read first:
- [M036](M036-ura-finale-slice.md), "Stages" and "Training Yard". This is the binding summary.
- [02](../research/drawing-board/02-mini-games.md):
  - §2, grades and pay;
  - §4, iOS input, pause and lazy chunks;
  - §5, the contract's sketch, determinism rules and the journal.
- [04](../research/drawing-board/04-mini-game-evaluation.md) §1.2, "Training Yard".
- **The generation-3 save from T152:**
  - the device-only `stage-journal` table in Dexie;
  - the declared `settle-stage` operation;
  - the career wallet;
  - the race engine's seeded RNG (`packages/race`'s `createRng`), to reuse or mirror.
- **Web:**
  - the kit's album art (`@luismlorenzana/uma-kit/album`: face tiles), `uma-kit/ui` (Button, Sheet, Chip, icons) and
    Motion's `m.*`;
  - the theme tokens (light and dark);
  - 44 pt targets, input in the bottom 60% of the screen.
- **The owner's constraints:** no audio needed, light taps, no timers, no one-touch momentum, everything Uma-themed.

## Do

1. **The contract** (`packages/domain/src/stages/`, subpath `@racer/domain/stages`):
   - **The types:** `StageKind`, `StageConfig { kind, seed, T, uma, deck, bonds, seasonFocus?, course?, practice }`,
     `StageInput` (a quantised move), `StageRules<S>` (`version`, `init`, `step`, `done`, `report → { p, tasks }`,
     `bots: novice | competent | expert`) and `Journal { config, version, inputs }`.
   - **`grade(p, tasks)`:** D under 0.5, C 0.5, B 0.75, A 1.0, and S at ≥ 1.2 or A with every task.
   - **`payMultiplier`:** D 0.25, C 0.6, B 0.8, A 1.0, S 1.2.
   - **`settle(journal, rules) → { grade, pay }`** replays the inputs from the seed. The pay is the game's
     resources × the multiplier, from T154's `career/pay.ts` table; until that exists, a stub in `stages/pay.ts` with
     the M036 numbers.
   - **The registry:** `registerStage(rules)` and `stageRules(kind)`.
   - **Determinism:** integers or `+ − × ÷` only, no `Math.random`, no wall clock, and a golden-hash test per game.
2. **The `settle-stage` operation** (`stages/ops.ts`, in T152's dispatcher):
   - it carries `{ careerId, kind, seed, inputs, practice }`;
   - the device and the API both replay and pay into the career wallet;
   - practice pays nothing;
   - a journal whose replay doesn't finish, or whose version is unknown, is refused in plain words;
   - the body stays well under the API's 5 MB.
3. **Training Yard's rules** (`stages/yard/`):
   - **The board:** 6×6, 60 placements; the next two pieces are shown, and one can be held (swap).
   - **Pieces:** a colour (Speed, Stamina, Power, Guts, Wit) and a tier 0–4 (plain, bronze, silver, gold, rainbow).
     - Placing a piece that joins a 4-connected group of ≥ 3 of the same colour and tier merges them into one piece one
       tier up, on the placed cell. Cascades resolve.
     - Three rainbows clear and pay a Masterclass bonus.
   - **The queue:** seeded, with colour weights from her growth rates and the season's focus stat.
   - **Partners:**
     - Each of her six deck cards enters the queue as a Partner piece, at a rate from its real Specialty Priority.
     - A Partner placed into a merge of its type lifts the result one more tier; at bond ≥ 80, two.
     - Friend and Group Partners are wild.
   - **Fatigue:**
     - Fatigue pieces enter the queue at a seeded rate.
     - After each placement, each Fatigue steps one cell toward the highest-tier piece if a closer cell is empty.
     - Boxed in, it becomes **Rest**. Three connected Rests clear every Fatigue in the 8 cells around them and pay a
       little SP.
   - **The end:** 60 placements or a full board.
   - **Score and pay:** drills of a colour for each merge, by tier (a geometric ladder; set it so a competent run pays
     about 260 drills in all and about 30 SP at grade A), recorded per colour for the pay.
   - **Three bonus tasks:** gold in two colours; no Fatigue left at the end; every Partner used in a merge.
   - **`p`** is the score over the target: the competent bot's median score, so A sits at 1.0.
   - **The bots:** novice (a random legal cell), competent (greedy on the immediate merge value) and expert (one-ply
     look-ahead with the next piece and the hold).
4. **`sim:stages`** (`scripts/sim`, a root script):
   - per game, 500 seeds per bot;
   - it fails unless the competent median is A, the novice median is C or B, and the expert reaches S on 35–65% of
     seeds;
   - it reports the median moves and an estimated length at 4 s a placement, which must fall within 3–7 minutes.
5. **The web host** (`apps/web/src/stages/`):
   - **`StageHost.tsx`:** it loads a game's view lazily (`import()` per kind), feeds inputs to the rules, and persists
     the journal to Dexie on every move and on `visibilitychange` or `pagehide`. On reopen it resumes by replay. On
     `done`, it commits `settle-stage` and shows the result: the grade, the pay and **Play again**.
   - **The rule card:** one verb and one sentence, plus **Practice** (pays nothing) before the first play.
   - Wake lock while playing. Reduced motion keeps the moves and drops the flourishes.
6. **Training Yard's view** (`apps/web/src/stages/yard/`), DOM and Motion:
   - Pieces are the **career Uma's and her rivals' face tiles** (kit album art) on stat-coloured backgrounds, with
     tier frames from plain to rainbow.
   - Partners show the **card art** with a small type mark. Fatigue and Rest are Uma-themed marks (a sweat drop and a
     towel), drawn from `uma-kit/ui` icons or `uma-art`, with no new sprites.
   - Tap a cell to place; the hold slot sits beside the queue.
   - It works at 390×844 in light and dark. Every tap target is ≥ 44 pt.
7. **The manual:**
   - write `docs/game/07-stages.md` (the framework, grades, pay, replays, practice, resume);
   - write `docs/game/08-training-yard.md` (rules and pay), with live blocks for the grade and pay ladders.
8. **D384:** the contract, the Yard's rules and numbers, and the sim's results.

## Done when

- [ ] Domain tests cover grade and pay, settle replay, the registry, every Yard rule (merges, cascades, Partners, wild
      cards, Fatigue movement, Rest), golden hashes for fixed seeds, and the bots.
- [ ] `pnpm sim:stages` passes for Training Yard.
- [ ] Web tests (Testing Library) cover the host's load, journal persist and resume, settle-on-done, practice paying
      nothing, and the Yard view placing and holding a piece.
- [ ] `pnpm lint && pnpm test:ci && pnpm build` pass, and the 180 KB startup budget holds: the Yard is its own lazy
      chunk.
- [ ] The manual pages and D384 are written.

## Deliver

- Branch `feat/t155-stages-yard` from `restart/g3`. Open a PR into `restart/g3` titled
  `feat: the stage framework and Training Yard (T155)`.
- If T156 is waiting, push the contract early, as its own PR `feat(domain): the stage contract (T155a)`.
- Delete this file in the final PR. Claude merges.
