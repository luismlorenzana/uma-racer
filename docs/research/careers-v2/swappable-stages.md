# Careers v2 · Swappable stages, with Furlong Hand as the training game

> **Status: proposal (2026-11-05),** from the owner's first playtest of generation 3. It sits beside
> [the careers proposal](README.md); the build packets that carry both are in [docs/tasks](../../tasks/README.md)
> (M037).

## The feedback

"The match 3 won't be the main minigame for training, we may reuse it for something else so let's just keep it
around, hopefully all minigames are built out in a way where they have same outputs after completion so it's easy to
swap in and out from different mechanics while we stabilize the App. Instead, let's build out the pocket card jockey
style minigame then and we decide if we wire that one explicitly for training in Careers."

**Furlong Hand is already that game.** It's the Pocket Card Jockey–style card race that M036 built (T156, D385;
[09](../../game/09-furlong-hand.md)). Today it only opens in two places:
- in a season that holds an objective, and at the Finale (the career's Play step);
- from the Hub's Furlong Hand place, as practice.

Training Yard opens in every other season. So "build it out" here means three changes:
- Furlong Hand becomes the career's main training game, open in every season;
- it pays what the Yard pays;
- every game pays one shared bundle.

## Today: why the games can't swap

| | Training Yard | Furlong Hand |
|---|---|---|
| When a career opens it | A season without an objective (`seasonStage`) | A season with an objective, and the Finale |
| Pays at A | 200 drills, 30 SP | 25 Bond, 20 SP |
| Its own extra pay | SP for each Rest | Each Partner's SP Bonus, the first time it plays |
| Drill split | Its merges, by colour | None |

The calendar picks the game, so what a season pays depends on which game the calendar picked. A career can't run on
Furlong Hand alone: it would earn no drills and could buy no tree.

## The design

### 1. One pay bundle for every game

`STAGE_PAY_AT_A` becomes a single bundle of `{ drills, bond, sp }` instead of one table per game. Every game, at
every grade, pays that bundle × the grade's multiplier, the D-to-S ladder as today. A game now decides only **how its
drills split across the five colours**:
- `StageReport.drills` becomes required: relative weights, as today.
- `StageReport.bonusSp` goes, and a game adds no pay of its own. The deck's Skill Point Bonus already pays through the
  tree's sessions ([05](../../game/05-the-build.md) §4), which is where the original pays it.
- The Yard's Rests keep clearing Fatigue but no longer pay SP. Furlong Hand's Partners no longer pay their SP Bonus on
  their first play.
- Bond and SP are pools the owner spends by hand, so they need no split.

**The drill split for each game:**
- **Training Yard:** unchanged, its merges by colour.
- **Furlong Hand:** the ground each colour ran: the points its run cards yielded, by colour. Wild cards (Friend and
  Group strides and Partners) count for the season's focus colour. Banked cards count for nothing, and Skill cards
  count for their colour. The colours she raced with are the stats she trained.
- **Every later game** (Team Showdown, Fan Festival and so on) reports its weights the same way.

**No rules version bump** is needed. The report changes, but the moves and the state don't, so a journal replays the
same and settles under the new pay.

**The numbers** come from `sim:careers` on the new calendar ([the careers proposal](README.md)). The bundle is tuned
so that a career played once at grade A still meets [12](../../game/12-pacing.md) §2's targets: about 60% of the tree,
about 3 of 6 cards at bond 80, and 4–6 golds' worth of SP. The bundle is set once against the calendar's count of
stages, not per game. As a guide, the M036 calendar's seven Yard and seven Furlong plays at A paid 1,400 drills,
175 Bond and about 350 SP. Spread evenly, that's about **100 drills, 12 Bond and 25 SP** a play, which T160 ships on today's calendar.
Careers v2 then moves the skills' SP to racing ([the careers proposal](README.md) §4.3), so T162 retunes the bundle on
the new calendar from **110 drills, 15 Bond and 0 SP**.

### 2. Each season offers the career's games, main first

`seasonStage` stops choosing one game. A season's Play step offers **every career game** (`CAREER_GAMES`), in order,
and the first is the main one:

```ts
export const CAREER_GAMES: readonly CareerGame[] = ['furlong-hand', 'training-yard']
```

- **Furlong Hand is the big Play button in every season.** It runs the course of her season's first objective, else
  her next objective's, else the URA Finals' (`furlongRaceFor`, unchanged). In a training block with no race, it runs
  the course of the race she's training for.
- **Training Yard** sits under "Another game" on the same card, with the same pay at A and the season's focus as
  today.
- **Swapping is one line:** reorder `CAREER_GAMES` to change the main game, or drop the Yard from it to leave Furlong
  Hand alone in careers. The Yard stays registered and playable as practice from its Hub place either way, so it's
  "kept around" for later reuse.
- **The Finale** stays Furlong Hand only: the URA Finals' prep heat on the Finals' course.
- `settle-stage` already takes any built `kind` for any season. The only rule change is that `careerStageConfig` must
  build a Furlong Hand config in any season, and `furlongRaceFor` already handles that.

**Why both, rather than Furlong Hand alone:** the owner wants to decide whether to wire Furlong Hand in "explicitly
for training". With both on the card, each paying the same, they can try both in their next careers and decide.
Removing the Yard is the one-line change above. If the owner says "Furlong Hand only", we drop the Yard from
`CAREER_GAMES` and nothing else changes.

### 3. What a season looks like

- **The Play step:** Furlong Hand, then Another game (Training Yard). Each shows the same "Pays at A" line. On careers
  v2's calendars ([the careers proposal](README.md) §2.1), this is the big step in the training block, at the summer
  camps and at the Finale. A racing season leads with Race instead, and its play becomes a smaller, optional prep heat
  (T162).
- **Upgrade:** unchanged, the tree, the bonds and the skills.
- **Race:** whatever the new calendar holds ([the careers proposal](README.md)).

The career guide ([career-guide.html](../../design/game-loop/previews/career-guide.html)) and pages 03, 07, 08, 09
and 12 are rewritten with the code.

### 4. Tests and sims

- `stages/settle.test.ts`: every registered game, at every grade, pays the same bundle, and only the drill split
  differs.
- `stages/furlong`:
  - the report's drill weights follow the colours run (golden plays re-pinned for the report, not the moves);
  - wilds count for the focus colour.
- `stages/registry.test.ts`: `CAREER_GAMES` holds only registered kinds, and the Finale opens only Furlong Hand.
- `sim:stages`: the bands are unchanged, plus Furlong Hand's competent bot weights must spread over at least 3
  colours on a median deck.
- `sim:careers`:
  - models the main game's split (Furlong Hand's: the deck's type mix, focus for wilds) in place of the Yard's;
  - holds 12 §2's targets on the new calendar;
  - checks that every game pays the same.
- `docs:update`: the career-pay block becomes one row, and the Furlong Hand and Yard pay blocks lose their extra SP
  lines.

## What to tell the owner

Furlong Hand is the Pocket Card Jockey–style game, and it's already in the game:
- **In a career:** it's the Play step in any season that holds a race objective, and at the Finale.
- **For practice:** from the Hub's Furlong Hand place.

After this change, it's the main Play in every season, paying drills too, with Training Yard one tap away as the
alternative.
