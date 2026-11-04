# The drawing board: Uma Racer without the clock

> **A proposal for the owner's review (2026-11-04). Nothing is decided yet.** It turns the owner's direction of
> 2026-11-04 into one game, built on three research reports:
> [01 · the original career and its scenarios](01-uma-career-and-scenarios.md),
> [02 · mini-games: design and tech](02-mini-games.md) and [03 · uma-racer today](03-racer-today.md).
> Once the owner approves, its calls become decisions (D380 onward) and a new manual. The rework's pages
> ([docs/rework](../../rework/README.md)) are then archived.

## 1. The direction

From the owner, 2026-11-04:
- **No time-based mechanics at all:** no timers, no passive generation, no jobs or queues. uma-rpg's farm is the
  passive game, and two would be too many.
- **Each scenario is a long activity for one Uma,** made of mini-game stages. Clearing them maxes her stats, bonds her
  support cards and so on. Each scenario has **one mini-game**, which pays its own kinds of resources. A calendar like
  the real game's career may be part of it.
- **What stays:** the race engine and the rest of the game, roughly as today.
- **The owner's answers:**
  - genres are **mixed**, one per scenario (some timing, some strategy);
  - a stage takes **3–7 minutes**;
  - the old Uma Puzzles battle **folds in** as one scenario's mini-game;
  - **the live app isn't fixed now.** It's looked at once the rework starts landing in pieces.

## 2. The game in one paragraph

Pick an Uma and start her **career** in a scenario: a calendar of three school years.
- **Each season is one stage** of that scenario's mini-game, 3–7 minutes of play.
- **The grade (D to S) pays toward her caps:** stats, skill points, bonds with the cards she brought, and aptitude.
- **Her objective races sit on the calendar** between seasons and run on today's race engine.
- **Her best grade on each stage is kept,** so a replay pays only the improvement, and a stage she has mastered can be
  swept instead of replayed.
- **The scenario's finale ends the career.** Five finales promote her to the next tier.
- **No clock anywhere:** the game moves when you play, and never because time passed.

## 3. The career: a calendar without a clock

The original's career is 72 half-month turns plus a finale, and a hand-played run takes 20–40 minutes, because each
turn resolves at once ([01](01-uma-career-and-scenarios.md) §1). If every turn were a 5-minute stage, one career would
take about 6 hours ([01](01-uma-career-and-scenarios.md) §5). So the proposal plays the calendar **by season**:

| | Proposed |
|---|---|
| **Calendar** | Junior, Classic and Senior years, four seasons each: **12 season stages plus a finale**, the scenario's finale race or races |
| **Before a season** | One quick pick (about 30 seconds): the **focus** (which two stats the stage pays most) and the **deck** (which six support cards come along; only they gain bond) |
| **A season** | One stage of the scenario's mini-game, 3–7 minutes |
| **Races** | The Uma's dated objectives (debut, then the G3, G2s and G1s she has today) fall between seasons. She must win each before the calendar moves past it. Retries are free |
| **Length** | About 13 × 5 + 6 + 6 ≈ **75 minutes** a career. 25 Umas take about 31 hours a scenario, about 4.5 weeks at an hour a day ([01](01-uma-career-and-scenarios.md) §5), close to today's pace |
| **Left out** | Energy, mood, rest and the infirmary. They are pacing tools, and without a clock nothing needs pacing. Mood stays the race engine's own seeded roll |

**The alternative** is the original's own shape, model C in [01](01-uma-career-and-scenarios.md) §5. All 72 turns
are quick commands (train, rest, race) with energy and mood, and only 8 key turns are stages: five half-year checks,
two camps and the finale. A career runs about 60 minutes. That is closer to the original, but stages become only about
two-thirds of play, against about 85% here.

## 4. What a stage pays

The reward contract is [02](02-mini-games.md) §2. A stage reports a score against its target, and the game grades it:
**D** under 50% (not cleared), **C** 50%, **B** 75%, **A** 100%, **S** 120% or A with every bonus task.

| Rule | What it does |
|---|---|
| **Best grade kept** | Stats and other milestone outputs pay on the best grade so far, per Uma and stage. A better grade pays only the difference, so nothing can be farmed |
| **A everywhere = maxed** | The tables are sized so that every stage at A puts the Uma at the scenario's caps. **S** pays a one-time bounty (a skill hint or a bond jump), not stats |
| **Every-run outputs** | Skill points and bond points pay on every play, scaled by grade |
| **Sweep** | With A or better, a stage can be skipped. It pays every-run outputs one grade below her best |
| **Roster mastery** | Once any Uma has S on a stage, every Uma can auto-resolve it at B, then play to improve. The 30th Uma doesn't replay 300 stages |
| **Assist** | Two Ds in a row offer an easier version (wider windows, slower play) that caps the grade at B. Practice is free and pays nothing |

**Where it lands in the build.** The race engine needs five stats, three aptitude grades, a strategy and skills
([03](03-racer-today.md) §2). Stages pay straight into those:
- **Stats** up to the scenario's caps, which stay as they are: 1,200 each at T1, up to a 9,500 budget at T15.
- **Skill points**, spent on skills, with hints cutting the cost as in the original.
- **Bond per card** from 0 to 100. At **80**, the original's friendship threshold, the card's bonus and skills open for
  that Uma.
- **Aptitude points**, raising distance, surface and style grades up to A.

The **Training Hub's unlock trees** go: constellation nodes, Extra Stats, lineage slots and the timed Dojo bonds. They
only existed to give timers something to buy. The rivals are re-tuned so that a competent player, mostly at A, wins
her objectives.

## 5. Fifteen scenarios, five engines, tier 1 first

The game keeps its 15 scenarios in three tiers of five ([04](../../game/04-tiers-and-promotion.md) §1). Each gets its own
mini-game, built on one of **five shared engines**: a timing lane, a drag board, a tile grid, cards and choices, and an
action scroller ([01](01-uma-career-and-scenarios.md) §4). The work is five engines, with fifteen rule sets on top.

**Tier 1, proposed:**

| Scenario | Mini-game | Kind | Pays most | Engine | Notes |
|---|---|---|---|---|---|
| URA Finale | **Stride Meter**: release in the zone, over three heats, the zone tightening each time | Timing | All five stats, evenly | Timing lane, Phaser | **Built first**, the cheapest proof of the framework |
| Unity Cup | **Team Clash**: the Uma Puzzles orb battle, a party of five against a rival team | Both | Bond and hints | Drag board, Phaser | The puzzle fold-in. Its 6×5 board, rules, enemies and bots (about 2,500 lines) port; the rest of the old mode stays retired ([03](03-racer-today.md) §3) |
| Trackblazer | **Circuit Planner**: plan a mini-season of races and items against fatigue and a points target | Strategy | Skill points and hints | Cards and choices, DOM | |
| Our Grand Concert | **Encore**: a rhythm chart on three lanes | Timing | Speed, Guts and skill points | Timing lane, Phaser, with audio | Needs music (call 7 in §9) |
| Grand Masters | **Fragment Forge**: a 4×4 merge board in three colours | Strategy | The stats you choose | Tile grid, DOM | |

**Tiers 2 and 3** have candidates in [01](01-uma-career-and-scenarios.md) §4 (an overseas runner, decathlon
micro-sports, a deduction table, core tuning, a three-fight deckbuilder, an island planner…) and alternates in
[02](02-mini-games.md) §1 (a card race, steering a racing line, training dice, find-the-gap, last-spurt push-your-luck).
They're chosen once tier 1 has been played.

Every mini-game follows the same rules ([02](02-mini-games.md) §3):
- one verb and one sentence of rules;
- the first 20 seconds teach it, with free practice;
- one control vocabulary across all of them: tap, hold/release, drag a path, swipe, flick;
- input in the bottom 60% of the screen.

## 6. What stays and what goes

| Stays | Changes | Goes (time-based) |
|---|---|---|
| The race engine and its scene, the race catalogue, the Racecourse | **Rivals**: re-tuned to the new build | **The Farm** and its sites, the Pantry, the Kitchen |
| Tiers, the 15 scenarios and their caps | **Scenarios**: a career calendar replaces Racing Levels as the measure of progress | Meals, tonics, items, the Warehouse |
| Support cards and the Card Library | **Bonds**: earned in stages, not in timed Dojo sessions | uma-work and the kit's `/work` screens, Speed Tickets |
| The Stable, the album, Uma Tickets | **The Hub**: three pages (Town, Career in place of Training, Racing). The Farm page goes | Check-ins, the planner and the Needs tab |
| Account, save and sync, master data, the deploy | **Save**: new record kinds and a generation-3 wipe | The Daily Purse and featured races (daily resets) |
| | **Prize Money**: new uses (call 6 in §9) | Training Hub sessions and facilities, `sim:loop` |
| | | **World Expeditions** (phase 9). The finales replace them, and their February deadline came from the old pacing |

**What goes is about 13–14k of the 44k non-test lines, plus about 8k lines of tests** ([03](03-racer-today.md) §1).

**Shared packages:**
- The racer stops importing `uma-kit/work` and `uma-work`. Nothing is removed from the kit, because uma-rpg runs on
  both.
- The mini-games use the Phaser the kit already loads for the Hub, which costs nothing extra
  ([02](02-mini-games.md) §4). That needs one decision: the "no Phaser in uma-racer" check becomes "Phaser only in
  stage scenes".
- PixiJS stays in the race scene only, so the old puzzle scene's 370 lines are rewritten in Phaser.
- **uma-puzzle:** the fold-in means uma-platform's roadmap no longer needs that app (its phase 4). uma-platform hears
  about it once the plan is approved.

## 7. How it's built

The race engine already has this shape, and each mini-game copies it ([02](02-mini-games.md) §5):
- **Pure, seeded rules** in `@racer/domain`, on a fixed tick or one move at a time, with no wall clock.
- **Novice, competent and expert bots** for each mini-game, and a `sim:stages` run that fails when the grade bands drift.
- **A lazy view per mini-game**, kept out of the 180 KB startup budget.
- **A saved input journal,** so a stage pauses when the app is hidden and resumes after iOS kills it.
- **The domain settles the reward,** not the view.

## 8. How it lands, in pieces

1. **The design spec.** This proposal, then the owner's calls, decisions and a rewritten manual.
2. **The stage framework and Stride Meter**, on dev seeds only, with `sim:stages`. This is the first thing the owner can
   play in the preview, before anything ships.
3. **The cut-over to generation 3:**
   - the timed systems are removed;
   - the career calendar and the new build model arrive;
   - URA Finale is playable end to end;
   - saves are wiped.

   From here the live app works again.
4. **Team Clash**, the puzzle fold-in, for Unity Cup.
5. **Circuit Planner, Encore and Fragment Forge,** completing tier 1.
6. **Tiers 2 and 3,** one mini-game per release.

## 9. The owner's calls

**These need you:**
1. **The calendar:** season stages (§3; recommended, because mini-games are most of the play) or the original's
   72 quick turns with 8 key-turn stages (closer to the original, with energy and mood back as turn rules)?
2. **The build model:** stages pay stats, skill points, bonds and aptitude directly, and the Training Hub's trees
   retire (recommended)? Or keep the trees, with stages opening their nodes?
3. **Play budget:** about an hour a day? It sets the pacing for a 25-Uma roster.

**Defaults I'll take unless you say otherwise:**

4. **Objectives:** free retries, and a race must be won before the calendar passes it. Failure never ends a career.
5. **Countdowns inside a stage** (a rhythm chart, the old puzzle's 7-second drag) count as skill timing, not a clock.
   They're allowed.
6. **Prize Money** stays, with new uses at the Exchange: Uma Tickets and skill hints. With no daily resets, each race
   pays its full prize once per Uma, and a reduced prize after that.
7. **Encore's music:** the original songs as private content, kept and served like the art and never committed. The
   alternative is original tracks.
8. **Roster mastery** auto-resolves at B (C is the stricter option).
9. **The tier 1 lineup** is §5's.
10. **The 15th scenario** becomes Goshiki Shuntaisai, released in Japan on 2026-10-26.
