# The Uma Racer manual

What the game **is**. It's the reference for any session, Claude's or another agent's. Every page describes the code
as it runs.

> **Generation 3, being built (M036, D380, D381).** The restart retired generation 2 and its manual; those pages are
> [archived](../archive/g2-manual/). The new game is [the drawing board v3](../research/drawing-board/README.md), and
> its first release is [M036, URA Finale](../tasks/M036-ura-finale-slice.md). Each page below is written by the part
> that builds its system, in the same commit as the code.

## The game in one paragraph

Uma Racer is a **racing game with mini-game careers and no clock**. You unlock Umas and support cards with tickets.
An Uma's **career** in a scenario is a calendar of three school years, four seasons each, then the scenario's finale.
Each season has three steps:
1. **Play** one 3–7 minute mini-game stage, graded D to S, for resources.
2. **Upgrade** her by spending those resources in her tree, by hand. Each training session there is priced with the
   original's formula and the **real numbers** of the support cards you post to it.
3. **Race** her objectives on the race engine.

Win the finale and the career is done. Her finished build becomes her racing build for that scenario. Nothing runs on
timers, and nothing limits how much you play.

## Pages

| Page | What | Written by |
|---|---|---|
| 01 · The game loop | Careers, seasons and the loop | T154 |
| 02 · Unlocks | Uma and Card Tickets, the Stable, the Card Library, eras | T157 |
| 03 · Careers | The calendar, objectives, seasons, the finale, rewards | T154 |
| [04 · Tiers and scenarios](04-tiers-and-scenarios.md) | The tier map, caps and card eras | T152, T154 |
| 05 · The build | The deck, posting, the tree, the session formula, the racing build, skills | T153 |
| 06 · Cards and bonds | Owned cards at full level, their real effects, bond tracks | T153 |
| 07 · Stages | The mini-game framework: grades, pay, replays, resume | T155 |
| 08 · Training Yard | The merge game | T155 |
| 09 · Furlong Hand | The card race | T156 |
| [11 · Hub and places](11-hub-and-places.md) | Every screen, route and sheet: the menu tree | T157, T158 (being rewritten) |
| 12 · Pacing | The pay table, the targets and the sims | T154 |
| [Racing](racing.md) | The race engine and rivals | kept; T154 updates the rivals |
| [Scenarios](scenarios.md) | The fifteen scenarios | kept |
| [Architecture](architecture.md) | The code by folder, the save, the checks and the deploy | T152, T159 |

## How these pages stay true

- **Lists are generated from the code.** Each table between `<!-- live:<key> -->` and `<!-- /live -->` is rendered
  from the rules by `packages/domain/src/docs/render.ts`, which joins each area's `docs.ts`.
- **CI catches a stale page.** `packages/domain/src/docs/docs.test.ts` fails when a page here no longer matches the
  code, so a rule change can't ship with a stale manual.
- **After a rule change, run `pnpm docs:update`.** It rewrites every live block. Commit the result with the change.
- **Hand-written parts are edited by hand,** in the same commit as the code they describe.
- **Original-game content stays out.** Only code-owned rules are rendered: no Uma, card, skill or race data from the
  private content packs, and no real card values.
