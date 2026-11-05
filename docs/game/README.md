# The Uma Racer manual

What the game **is**. It's the reference for any session, Claude's or another agent's. Every page describes the code
as it runs.

> **Generation 3, as released (M036, D388).** The restart (D380) retired generation 2 and its manual, whose pages are
> [archived](../archive/g2-manual/). The design behind this game is [the drawing board v3](../research/drawing-board/README.md),
> and what comes after URA Finale is [the task plan](../tasks/README.md) and
> [v3's roadmap](../research/drawing-board/README.md#7-the-roadmap).

## The game in one page

Uma Racer is a **racing game with mini-game careers and no clock**. Nothing runs on timers, nothing refills overnight,
and nothing limits how much you play: the game moves when you play it ([01 · The game loop](01-game-loop.md)).

**Unlock.** You unlock Umas and SSR support cards with tickets, one ticket each, for good: a new account starts with 20
Uma Tickets and 24 Card Tickets, and nothing is bought. The Stable holds the Umas and the Card Library the cards, each
card with its real effects at its top level ([02 · Unlocks](02-unlocks.md), [06 · Cards and bonds](06-cards-and-bonds.md)).

**Start a career.** An Uma's career in a scenario freezes her objectives onto a calendar of three school years, four
seasons each, then the scenario's finale. This release opens **URA Finale** (T = 1): a Maiden G3, two Trials G2s and
three Main G1s, then the URA Finals ([03 · Careers](03-careers.md)). The scenarios, their tiers, caps and card eras are
[04 · Tiers and scenarios](04-tiers-and-scenarios.md) and [Scenarios](scenarios.md).

**Each season** has three steps, on her career page ([11 · Hub and places](11-hub-and-places.md) §8):
1. **Play** one 3–7 minute mini-game stage, graded D to S, for resources ([07 · Stages](07-stages.md)):
   - **Furlong Hand**, the card race, as the prep heat on her objective's real course, when the season holds one
     ([09](09-furlong-hand.md)). It pays Bond and SP;
   - **Training Yard**, the merge game, otherwise ([08](08-training-yard.md)). It pays drills of each stat's colour,
     and a little SP.
2. **Upgrade** her by hand: drills buy pips in her tree, Bond fills the deck's bond tracks, SP buys skills. Every pip is
   priced with the original's training formula and the **real numbers** of the support cards posted to its branch, and
   shows its exact gain before you buy it ([05 · The build](05-the-build.md), [06](06-cards-and-bonds.md)).
3. **Race** the season's objectives on the race engine with her **racing build**, as often as it takes: retries are
   free ([03](03-careers.md) §4, [Racing](racing.md)).

Then **Next season**. A stage can be played again at any time and pays like a first play; the tree, the bond tracks
and the SP cap are the ceilings, not the plays.

**Finish.** The URA Finals are a prep heat and three races. Winning the final completes the career, freezes her build
as her URA Finale racing build on her profile, and pays tickets to unlock more. Each objective's first win pays a Card
Ticket and SP, so a career funds the next. How much each play pays, and how strong the rivals are at each point of the
calendar, is [12 · Pacing](12-pacing.md).

**Where it happens.** The Hub has two pages: **Town Hall** (the Stable, the Card Library, Account) and **Career** (the
careers and the two games), with the raised **Career** button one tap from her current season. Every screen, route
and sheet is [11's menu tree](11-hub-and-places.md#the-menu-tree-at-a-glance).

**Not built yet:** later scenarios and promotion, a second career in a scenario, and the other four mini-games. Each
page's "Not built yet" names what is its own; the order is
[v3's roadmap](../research/drawing-board/README.md#7-the-roadmap).

## Pages

| Page | What |
|---|---|
| [01 · The game loop](01-game-loop.md) | Careers, seasons and the loop; playing again; what a career is worth |
| [02 · Unlocks](02-unlocks.md) | Uma and Card Tickets, the Stable, the Card Library, a card's page, eras |
| [03 · Careers](03-careers.md) | Starting one, the calendar, objectives, seasons, races, the URA Finals, rewards, the operations |
| [04 · Tiers and scenarios](04-tiers-and-scenarios.md) | The tier map, caps, card eras, careers and rivals by scenario |
| [05 · The build](05-the-build.md) | The wallet, the deck and posting, the tree and the session formula, stats, skills, the racing build |
| [06 · Cards and bonds](06-cards-and-bonds.md) | Owned cards at full level, their real effects, bond tracks, card power |
| [07 · Stages](07-stages.md) | The mini-game framework: the contract, grades, pay, settling, replays, resume, `sim:stages` |
| [08 · Training Yard](08-training-yard.md) | The merge game: its rules, pay, bots and screen |
| [09 · Furlong Hand](09-furlong-hand.md) | The card race: its rules, effect hooks, pay, bots and screen |
| [11 · Hub and places](11-hub-and-places.md) | Every screen, route and sheet: the menu tree, the shell, the places, the career screens |
| [12 · Pacing](12-pacing.md) | The pay table, the targets and `sim:careers` |
| [Racing](racing.md) | Rival handicaps, rival strength by season, and the roll |
| [Scenarios](scenarios.md) | The fifteen scenarios, and which page owns each scenario rule |
| [Architecture](architecture.md) | The code by folder, the save and sync, the API, content, the checks and the deploy |

## How these pages stay true

- **Lists are generated from the code.** Each table between `<!-- live:<key> -->` and `<!-- /live -->` is rendered
  from the rules by `packages/domain/src/docs/render.ts`, which joins each area's `docs.ts`.
- **CI catches a stale page.** `packages/domain/src/docs/docs.test.ts` fails when a page here no longer matches the
  code, so a rule change can't ship with a stale manual.
- **After a rule change, run `pnpm docs:update`.** It rewrites every live block. Commit the result with the change.
- **Hand-written parts are edited by hand,** in the same commit as the code they describe.
- **Original-game content stays out.** Only code-owned rules are rendered: no Uma, card, skill or race data from the
  private content packs, and no real card values.
