# T156 — Furlong Hand, the core card race

> **M036, part 5 of 8.** Domain and web. Starts once T155's stage contract has merged into `restart/g3`. Decision
> **D385**.

## Why

The owner chose a card race "with full Umamusume theme and actual cards from card sets" as the recurring core
mini-game. Furlong Hand is our original design for it: the support cards are the deck, the race is her next objective's
real course, and the rivals are real Umas. In the slice, it's the prep heat of every season that holds an objective,
and of the finale. It pays **Bond** and **SP**, and it never changes the real race.

## Context

Read first:
- [M036](M036-ura-finale-slice.md), "Furlong Hand". This is the binding summary.
- [04](../research/drawing-board/04-mini-game-evaluation.md) §2: what Pocket Card Jockey does and what reviewers
  criticised, the full rules of Furlong Hand, the effect hooks table and one example turn.
  - **Our rules are original.** Don't copy that game's rules, names or art.
  - Its criticisms to avoid: harsh losses, being boxed in despite good play, luck of the draw, and long tutorials.
- T155's contract: `@racer/domain/stages` (`StageRules`, `grade`, `settle`, the registry) and the web `StageHost`.
- **Inputs:**
  - the career's current objective (T154's `seasonStage` names the course);
  - `course-layout.ts` for the legs;
  - `tiers/rivals.ts` for the rival field (real Umas of the race's field);
  - her racing build (T153 `deriveRacingBuild`: stats, aptitudes, skills);
  - the deck and bonds;
  - the cards' real effects (T152's adapter).
- Art: `uma-kit/album` busts and faces for her and the rivals, card art for Partners, `uma-art` marks.

## Do

1. **Rules** (`packages/domain/src/stages/furlong/`), following 04 §2.2:
   - **The deck** (about 39 cards):
     - **stride cards** in five stat colours, valued 1–6;
     - **Partners:** her six support cards, each with its type's colour (Friend and Group are wild);
     - **Skill cards:** from her bought skills; Wit sets how many.
   - **The course:** legs from the objective's real layout. Sprint has 3 legs, Mile 4, Medium 5 and Long 6, then the
     **spurt**. Each leg's terrain favours a colour: Speed on straights, Power on corners and climbs.
   - **The field:** her rivals as tokens on a position ladder 1–9, at the objective's rival strength. Each shows its
     next move (surge, hold, fade, close the rail) from a seeded script. **Rival moves are always visible.**
   - **Her gauges:** Breath (Stamina and distance aptitude), Drive (the spurt's fuel) and position.
   - **A leg:**
     - a spread of four columns three deep, with a draw pile of 8;
     - play a front card if it matches the lead's **colour** or is **one higher** (6 → 1);
     - **run** it for ground (her stat grade plus terrain), or **bank** it for +1 Drive;
     - a chain of ≥ 4 adds +1 Drive;
     - when stuck, flip a draw card for −1 Breath;
     - the leg ends when the spread is clear (a clean leg: +2 Drive) or the pile is empty. Each card left lets the
       field gain.
   - **Between legs, the line:** the rail (free, but it can be blocked), the middle, or the outside (−1 Breath, never
     blocked, Speed +1). **Her running style's band:** in band +1 Drive, out of band −1 Breath.
   - **The spurt:** a final spread in which Drive multiplies run cards. Skill cards fire on their conditions. The finish
     order follows from her ground against the rivals' scripted race.
   - **The effect hooks** (04 §2.2's table), from real values:
     - Training Effectiveness and Stat Bonus lift their colour's yields;
     - Specialty Priority deals the Partner into the first spread;
     - Friendship at bond ≥ 80 makes a **rainbow**: the next chain's yields double;
     - Hint Frequency peeks at the next leg's spread;
     - SP Bonus, Race Bonus and Initial stats feed the stage's SP pay, Drive at the spurt and starting Breath;
     - each card's unique effect maps to one ability from a small library (≤ 12 abilities; document the mapping rule).
   - **Fairness:**
     - an unlucky deal is never unwinnable for a competent bot on an A-target race;
     - there is always one free redraw per leg;
     - losing still pays (grade D).
   - **Grade and pay:**
     - **S**, a win by ≥ 2 lengths with all three tasks: two clean legs, every Partner played, every leg in band;
     - **A**, a win; **B**, top 3; **C**, top 5; **D**, otherwise;
     - for the framework, `p` is mapped from the finish so that `grade()` returns these;
     - pay is Bond (about 60 at A) and SP (about 20 at A), × the multiplier.
   - **The bots:** novice (the first legal card, always run), competent (greedy chain length and running-style
     banking), expert (a short look-ahead and line choice).
   - **Length:** 3.5–6.5 minutes at about 3 s a card, measured by `sim:stages`.
2. Register it with T155's registry. **`sim:stages`** gains Furlong Hand with the same bands as T155.
3. **The view** (`apps/web/src/stages/furlong/`), DOM and Motion:
   - **The top 40% is the race:** the ladder with her bust and the rivals' faces, their next-move marks, her Breath and
     Drive, and the leg strip (straight, corner, climb) from the real course.
   - **The bottom 60% is the hand:** the spread's columns as cards. Stride cards are stat-coloured with the stat icon and
     value; Partners show the support card's art and a rainbow frame when bonded.
   - Tap a card to **run** it, and swipe it down to **bank** it. The line choice is three large buttons.
   - The spurt has its own moment, made with transform and opacity only.
   - A rule card in one sentence, and a free practice.
   - 390×844, light and dark, 44 pt targets.
4. **The manual:** write `docs/game/09-furlong-hand.md`: the rules, the hooks and the pay, with live blocks for the
   grade map and pay.
5. **D385:** the rules as built, the numbers, the ability library and the sim's results.

## Done when

- [ ] Domain tests cover every rule (chain legality, run and bank, Breath and Drive, the redraw, line choice and
      blocking, bands, the spurt), every effect hook on synthetic cards, rival scripts, golden hashes and the bots.
- [ ] `pnpm sim:stages` passes for Furlong Hand, with its length within 3.5–6.5 minutes.
- [ ] Web tests cover dealing, run, bank, line choice, the spurt, and settle through the host.
- [ ] `pnpm lint && pnpm test:ci && pnpm build` pass. Furlong Hand is its own lazy chunk.
- [ ] The manual page and D385 are written.

## Deliver

- Branch `feat/t156-furlong-hand` from `restart/g3`. Open a PR into `restart/g3` titled
  `feat: Furlong Hand, the card race (T156)`.
- Delete this file in the PR. Claude merges.
