# 03 · Careers

> **Status: generation 3, built (T154, T158; D383, D387).** The rules are T154's; the career screens (the calendar
> strip, the season card's three steps, the race sheet and run, the URA Finals and the completion) are T158's,
> [11 · Hub and places](11-hub-and-places.md#8-the-career-screens) §8; the two stages' games are T155's and T156's. The
> design is M036's "The career" (released, D388) and
> [v3 §2](../research/drawing-board/README.md#2-the-shape-of-the-game).

A career is one Uma's run through one scenario: twelve seasons, then the scenario's finale. Each season she plays a
stage for resources, the owner spends them on her build ([05](05-the-build.md)), and she races the season's
objectives on the race engine. Winning the URA Finals completes the career and freezes her build.

Code: `packages/domain/src/career/` (`@racer/domain/career`).

## 1. Starting a career

- **Who:** any Uma in the Stable. She runs one career at a time.
- **Where:** URA Finale (T = 1) only in this release; another scenario refuses ("… careers aren't open yet"). Each Uma
  runs one URA Finale career: a finished one stays viewable and can't be started again.
- **Her objectives** are frozen when the career starts, by the career generator (`planScenarioCareer`, T = 1) on the
  regular race catalogue's races that have a season of the year:
  - **Maiden:** a G3 in her profile (her best two neighbouring distances on her better surface);
  - **Trials:** two G2s, one at each of her two distances;
  - **Main:** three G1s: the scenario's race set when one fits her, topped up from her own career's G1s. A set's legs
    become one objective each.
- **Everything else starts empty:** the deck, the posts, the tree, the Camps, the skills and the wallet.
- It refuses, in plain words: an Uma not in the Stable, another scenario, a second career while one runs, a second
  URA Finale career, and a calendar that can't give her one.

## 2. The calendar

Three school years of four seasons: Junior, Classic and Senior × Spring, Summer, Autumn and Winter, indexed 0–11. The
**Finale** is season 12.

**Each objective sits in its race's season of the year.** A race's season code (the original's, which skills read too)
maps to a season of the year:

<!-- live:career-calendar -->
| Race season code | Season of the year |
|---|---|
| 1 (spring) | Spring |
| 2 (summer) | Summer |
| 3 (autumn) | Autumn |
| 4 (winter) | Winter |
| 5 (cherry blossom) | Spring |
| 0 (none) | never an objective |

| Stage | Year |
|---|---|
| Maiden | Junior |
| Trials | Classic |
| Main goals: the earliest | Classic |
| Main goals: the others | Senior |
<!-- /live -->

**Placement** (`placeObjectives`):
1. The objectives go in stage order: the Maiden, the Trials, then the Main G1s.
2. Within a stage they go by season of the year; a tie keeps the journey's order (a race set's own order).
3. Each takes its stage's year: the Maiden Junior, the Trials Classic, the earliest Main G1 Classic and the other
   Main G1s Senior.
4. A race that would fall before the objective ahead of it **moves to the next year**, until it doesn't. In practice
   only the earliest Main G1 moves: to Senior, when it would come before the second Trial.
5. Two objectives may share a season.

For example, with the Maiden in summer, the Trials in spring and autumn, and the Main G1s in spring, autumn and winter:
Junior Summer, Classic Spring, Classic Autumn, then Senior Spring (the spring G1 can't come before Classic Autumn's
Trial), Senior Autumn and Senior Winter.

## 3. Seasons

A season is three steps: **Play**, **Upgrade** and **Race**.

1. **Play** offers every career game (`CAREER_GAMES`, D391), the main one first, and each pays the same bundle
   ([12](12-pacing.md) §1), so either one played does the season's Play:
   - **Furlong Hand** ([09](09-furlong-hand.md)), the main game, on the course of her season's first objective, else
     her next objective's, else the URA Finals' (`furlongRaceFor`);
   - **Another game: Training Yard** ([08](08-training-yard.md)), with the season's focus stat tilting its colours.

   The season's focus also takes Furlong Hand's wild cards in its drill split. Reordering `CAREER_GAMES` changes the
   main game; dropping the Yard from it leaves Furlong Hand alone in careers, and the Yard stays playable as
   practice.
2. **Upgrade** is the build: Tree · Deck · Bonds · Skills ([05](05-the-build.md), [06](06-cards-and-bonds.md)).
3. **Race** runs each of the season's objectives (§4), as often as it takes to win.

<!-- live:career-seasons -->
| Season | Index | Focus |
|---|---|---|
| Junior Spring | 0 | Speed |
| Junior Summer | 1 | Stamina |
| Junior Autumn | 2 | Power |
| Junior Winter | 3 | Guts |
| Classic Spring | 4 | Wit |
| Classic Summer | 5 | Speed |
| Classic Autumn | 6 | Stamina |
| Classic Winter | 7 | Power |
| Senior Spring | 8 | Guts |
| Senior Summer | 9 | Wit |
| Senior Autumn | 10 | Speed |
| Senior Winter | 11 | Stamina |
| Finale | 12 | Power (Furlong Hand only) |
<!-- /live -->

- **Next season** opens once every objective in the season is won. A season without objectives can end at once.
- **Playing again never moves the calendar:** stages can be replayed at any time and pay every time
  ([07](07-stages.md) §4), and lost races are retried for free.
- The rules don't enforce the steps' order: the screens lead it. The season card lights the next step and badges
  Upgrade with what she can buy ([11](11-hub-and-places.md#81-a-careers-page-careercareerscareerid) §8.1).
- After Senior Winter, Next season opens the **Finale** (§5).

## 4. Races

An objective races on the race engine and its run screen, with her **racing build**
([05](05-the-build.md) §7):
- **her runner:** her stats in the career (capped), her template's aptitudes at the race's distance, surface and her
  chosen style, her unique at level 5, and the skills she bought (a gold races in place of its white);
- **her style:** the one she chooses, her best by aptitude by default (`bestStrategy`);
- **the field:** rivals rolled by `rollRivalFieldAt` at the career's scenario, the race's grade and **the objective's
  season**, so a Junior race's rivals are as green as she is and a Senior G1's are trained ([Racing](racing.md));
- **the seed:** `raceAttemptSeed` of the career's start, the content release, her, the race, her style and the
  attempt. The same attempt is the same race on every device; a retry is the next attempt and a new race.

**On the screens** ([11](11-hub-and-places.md#84-the-race-sheet) §8.4–§8.5): the race sheet shows her racing build,
her best style preselected and the field the seeded draw meets; **Race** commits `run-race` with the next attempt's
number; the run replays the stored result in the race scene; a loss offers **Retry** at once.

**Settling:** a first place wins the objective; anything else changes nothing but the record of the run, and she can
race again at once. Each run is a `raceResults` row under its operation's id, replayable.

**Where it runs:** the `run-race` operation prepares the race, runs it on the engine the caller hands in
(`OperationEnv.race`, the device's and the API's own `simulateRace`), and settles it. The device and the server each
run the same seeded race and reach the same result; the server's is the one stored. Without an engine, a race refuses
("Races can't run here").

## 5. The URA Finals

After Senior Winter the career is at the **Finale**. Its stage is a Furlong Hand prep heat on the URA Finals' course,
the one game the Finale offers (`FINALE_GAMES`); then three races, each retried until won:

<!-- live:career-finale -->
| Round | Field | Rivals' handicap |
|---|---|---|
| URA Finals Qualifier | G2 | 22% |
| URA Finals Semifinal | G1 | 17% |
| URA Finals Final | G1 | 10% |
<!-- /live -->

- **The course:** her best surface by aptitude, then her best distance on it, among the pairs the catalogue races (a
  tie goes to the pair holding more of her objectives, then the catalogue's order); on that pair, the race of the
  highest grade, one of her objectives only if nothing else is left, then by id. All three rounds run there.
- **The fields** are as strong as the Finale: the typical career's finished build, less the round's handicap.
- **Winning the final completes the career.** Her racing build (stats, aptitudes and skills) is frozen on the career
  as her **URA Finale racing build**, which her profile shows. The build can't change after that.

## 6. Rewards

<!-- live:career-rewards -->
| What | Pays |
|---|---|
| A G3 objective's win | 1 Card Ticket, and 40 SP × (1 + the deck's Race Bonus) to the wallet |
| A G2 objective's win | 1 Card Ticket, and 60 SP × (1 + the deck's Race Bonus) to the wallet |
| A G1 objective's win | 1 Card Ticket, and 100 SP × (1 + the deck's Race Bonus) to the wallet |
| Winning the URA Finals | 1 Uma Ticket and 2 Card Tickets |
<!-- /live -->

- An objective is raced until it's won and never again, so every win is its first.
- **Race Bonus** is the deck's real values summed (each card's top-level Race Bonus and any unique Race Bonus), read
  when the race is won.
- The tickets go to the account, which unlocks Umas and cards with them ([02 · Unlocks](02-unlocks.md)); the SP goes to the
  career's wallet, where skills spend it ([05](05-the-build.md) §8).

## 7. The operations

| Operation | Input | Does | Refuses |
|---|---|---|---|
| `start-career` | `umaId`, `T` | Freezes and places her objectives; an empty tree, deck and wallet | Not in the Stable; another scenario; a career running; her URA Finale career done; no calendar |
| `run-race` | `careerId`, `raceId`, `attempt`, `strategy`? | Runs the objective's race on the engine; a win marks it and pays | No engine; not her objective; not this season; already won; at the Finale; the career complete |
| `next-season` | `careerId`, the `season` she leaves | Moves the calendar a season | An objective open; that season already ended; at the Finale |
| `run-finale` | `careerId`, `round` (0–2), `attempt`, `strategy`? | Runs the round; winning the final completes the career, freezes her build and pays | No engine; before the Finale; a round already won or not yet open |

- Each is idempotent by its id through `commitOperation`. `next-season` and `run-finale` name the season and round they
  mean, so a second tap can't skip one.
- A race's receipt carries its placement, whether it won, and the reward; its run is the `raceResults` row.

## Not built yet

- **Careers v2** (M037, D390; [the proposal](../research/careers-v2/README.md)): careers by distance group on full
  race calendars (T162), a deck, posts and style per distance (T163), crowns paying Card Tickets, a training
  block up front, and the URA Finals on an announced course and conditions (D395,
  [finale events](../research/careers-v2/finale-events.md); the conditions in the engine are T164).

- **A second career** with the same Uma in the same scenario, and careers in later scenarios
  ([04](04-tiers-and-scenarios.md) §4).
