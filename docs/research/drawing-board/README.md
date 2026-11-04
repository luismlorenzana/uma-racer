# The drawing board: Uma Racer without the clock (v2)

> **The design for the restart, for the owner's approval (2026-11-04).** v2 applies the owner's second-round answers
> and replaces v1, which is in git at `06ce5db`. It rests on five research reports:
> [01 · the original career and its 15 scenarios](01-uma-career-and-scenarios.md),
> [02 · mini-games: design and tech](02-mini-games.md), [03 · uma-racer today](03-racer-today.md),
> [04 · the mini-game evaluation](04-mini-game-evaluation.md) and [05 · card mechanics](05-card-mechanics.md).
> On approval, §7's minimum slice becomes a spec, the calls in §8 become decisions (D380 onward), and the manual is
> rewritten as the slice is built. The rework's pages ([docs/rework](../../rework/README.md)) are archived.

## 1. The owner's direction

**The game:**
- **No time-based mechanics,** and no play limits: the more you play, the more you unlock.
- **No energy, mood or rest.** Retries are free.
- **A handful of mini-games (5–7),** each paying different things at different points of a career.
- **Every scenario grows one or a few of them** with new stages or mechanics, instead of adding a new game.
- **The core is a card race in the Pocket Card Jockey vein,** fully Uma-themed and played with the real support cards.
  It recurs in every scenario.

**The mini-game constraints:**
- No audio needed to finish one, so no rhythm games.
- No heavy tapping, so no runners.
- No one-touch momentum.
- Nothing as thin as the claw machine.
- Nothing as heavy as Puzzle & Dragons or Kingdom Rush. **The Uma Puzzles fold-in is cancelled.**
- **Liked:** Triple Town (yes), Peglin (maybe), an auto-battler with real Umas and cards (maybe), and a cooking game
  (maybe).

**The loop:** play mini-games for resources, upgrade the Uma, race; then again, on a seasonal cadence.

**The build:**
- Mini-games pay **resources**, which the owner **allocates by hand in trees**, because that is deterministic.
- What an allocation grants follows the **real card mechanics**: training effectiveness, stat bonuses, SP bonus and the
  rest.

**The release:**
- **No dev preview and no dev-only milestone.** Claude defines the minimum slice, and it launches to production with
  a **full wipe**, with no backups and no rollback.
- The owner tests live and gives feedback from there.
- "uma-racer is dead in its current state; let's start this correctly."

## 2. The shape of the game

**An Uma's career is one scenario,** from the start of her Junior year to the scenario's finale.

**The calendar** has three school years of four seasons each, so 12 seasons and then the finale ([01](01-uma-career-and-scenarios.md) §5).

**Each season runs three steps:**

| Step | What happens |
|---|---|
| **1. Play** | The season's mini-game, one stage of 3–7 minutes, graded D to S. Any unlocked game can be replayed at any time for more resources |
| **2. Upgrade** | Spend resources in her tree, post her six cards, pour bond, buy skills. Every number is previewed before you commit |
| **3. Race** | Her objective races that fall in the season, on today's race engine. She must win each one before the calendar passes it. Retries are free |

**The finale** is the scenario's cup. Winning it **completes the career** and opens her next scenario.

**What carries over:**
- **Each career starts her from her base stats,** with a fresh tree under that scenario's caps, as each career does in
  the original. The finished build is kept as **her racing build** for that scenario, the original's "Veteran".
- **Bonds carry across the five careers of a tier,** so a tier is a long bonding arc ([05](05-card-mechanics.md) §3.4).
- **What accumulates on the account:** Umas unlocked, bonds, mini-game rules opened by scenarios, and the best
  grades shown on each stage.

**Pace:** a career is about 13 stages plus races and upgrades, roughly 75 minutes. Filling the tree completely takes
some replays. Nothing limits how much you play in a day.

## 3. The mini-games: a core and five more

The set is [04](04-mini-game-evaluation.md) §3: six games, each owning its own resources and season slot. All of
them are turn-based or aim-then-watch, with no audio and light taps. Five run on DOM with Motion; the peg board uses
Phaser, already loaded by the Hub.

| Game | Genre | Plays | Pays | Arrives with |
|---|---|---|---|---|
| **Furlong Hand** (the core) | Card race | Chain cards by colour or one step up; run each for ground or bank it for the spurt; end each leg in her running style's band; pick a line between legs. The prep heat for her next objective, on that race's course | **Bond**, **Hints**, a little SP | URA Finale (1) |
| **Training Yard** | Merge (Triple Town–like) | Place pieces on a 6×6 yard; three of a kind merge up through five tiers in five stat colours. Her cards are Partner pieces | **Drills** (stat-coloured), a little SP | URA Finale (1) |
| **Team Showdown** | Auto-battler, untimed | Six rounds: buy Umas and cards from a small shop, line up five, and watch the heat resolve | **Shards** (unlock Umas), Fans | Unity Cup (2) |
| **Fan Festival** | Peg board (Peglin-like) | Aim, release and watch a cheer orb fall through fan pegs; each card is an orb | **SP**, Hints | Our Grand Concert (4), after a determinism proof |
| **Summer Camp** | Dice placement | Seven camp days of rolling her dice into facility slots where that day's cards stand. The original's training turn as a puzzle | **Aptitude points**, Drills | Project L'Arc (6) |
| **Festival Kitchen** | Cooking on a flavour map | Steer a dish across a flavour map with ingredient arrows to land in the judge's zone; cards lend techniques | **Dishes**: one-use boosts | Great Food Festival (8) |

**Growth:** [04](04-mini-game-evaluation.md) §3's table has what each of the 15 scenarios adds, for example:
- Unity Cup gives the card race a teammate;
- Trackblazer adds a shop between legs;
- Grand Masters adds fragments to the Yard;
- Twinkle Legends adds a knowledge draft to the card race.

In seven scenarios the card race itself gains a rule, so it doesn't grow stale.

**How a stage pays:**
- The grade is set by the score against the stage's target: **D** under 50%, **C** 50%, **B** 75%, **A** 100%, **S**
  120% or A with every bonus task.
- A stage pays its resources on every play, scaled by grade: D 0.25, C 0.6, B 0.8, A 1.0, S 1.2.
- The trees are finite, so playing more fills them sooner but never raises the ceiling. v1's best-grade bookkeeping and
  sweeps aren't needed.
- Each stage follows [02](02-mini-games.md) §5: pure seeded rules, bots, `sim:stages`, and a journal so a stage resumes
  after iOS kills the app.

## 4. The build: resources, trees and the real cards

This is the model in [05](05-card-mechanics.md) §3.

**Resources:**

| Resource | Spent on |
|---|---|
| **Drills** in five colours | Training sessions in the tree |
| **Skill Points** | Skills |
| **Bond** | The bond track of a card she has |
| **Aptitude points** | One grade step on a distance, surface or style, up to A |

**Shards** and **Dishes** arrive with their games.

**The tree:**
- One tree per career, with **five branches**, one per training facility.
- Each branch has five levels of four session pips: **100 sessions**, plus two Camp nodes.
- A pip costs drills of its colour.
- **What a pip grants is the original's training formula,** computed from the cards you **post** to that branch:
  - each card's real Stat Bonus, Training Effectiveness, Mood Effect (mood fixed at Great) and Skill Point Bonus;
  - the card count bonus;
  - Friendship, for a card at its own type's branch with bond 80 or more;
  - her growth rates.
- It is recomputed whenever you change the deck or a bond, so **every pip shows its exact gain before you buy it**,
  overflow over the cap included. Nothing is random.

**Bond tracks** run 0–100 per card and start at the card's real initial bond. You pour Bond into them, and they stop
at three points:
- **hints**, at intervals set by Hint Frequency;
- **80**, friendship;
- **100**, the card's event skills.

**Skills** come from SP, with hint levels cutting the cost up to 40%, as in the original. **The SP you can spend in a
career stays capped by its scenario,** as today.

**The data is already there.** uma-data holds every card's full effect table and every Uma's base stats and growth
rates. Only the racer's adapter changes, from today's squashed 0.5–1.5 profile to the real values. Those stay in the
private pack, and tests use synthetic cards ([05](05-card-mechanics.md) §1).

**Balance:**
- A rough run of 100 sessions puts an empty deck at about 44% of the T1 cap budget, a median bonded deck at about 67%
  and a strong deck at about 80%.
- Rivals are tuned near 60%, so a good deck wins comfortably and no deck caps all five stats.
- One scale per scenario, set by a `sim:decks` run, keeps later scenarios in the same band.

## 5. What stays and what goes

**Stays:**
- the race engine and its scene, the race catalogue and courses;
- the rivals, re-tuned;
- tiers, the 15 scenarios and their caps; the 15th becomes **Goshiki Shuntaisai**, which Japan released on 2026-10-26;
- support cards and the Card Library;
- the Stable, the album and Uma Tickets;
- sign-in, save and sync (with new record kinds), master data, the shared kit, and the deploy pipeline.

**Goes:**
- everything on a clock: the Farm, the Pantry, the Kitchen, items, uma-work and the kit's `/work` screens, Speed
  Tickets, check-ins, the planner and the Needs tab, the Daily Purse and featured races;
- the Training Hub's timed sessions and facilities;
- today's unlock trees: constellations, Extra Stats and lineage;
- Racing Levels;
- World Expeditions, whose deadline came from the old pacing;
- `sim:loop`.

**Prize Money:** Prize Money, the Exchange and free races at the Racecourse are left out of the slice. They come back
once they have a purpose. Until then, the career's races are the racing, and finales pay Uma Tickets.

**Start correctly:**
- **The same repository and infrastructure:** project, buckets, sign-in, the API, deploy and CI.
- **The game layer is rebuilt, not trimmed.** The old places and the timed domain areas are deleted outright. New
  domain modules are written for careers, resources, trees, decks, bonds and stages. The race engine, race catalogue,
  rivals, tier scaling and the master-data adapter (extended) are kept.
- **Saves become generation 3:** a new local database, a new sync generation, and every generation-2 save deleted on
  the server.

**The shared kit:**
- The racer stops importing `uma-kit/work` and `uma-work`. Nothing is removed from the kit, because uma-rpg uses both.
- uma-platform will be told that the racer no longer uses them, and that uma-puzzle stays its own plan, since the
  fold-in is cancelled.

## 6. Engineering rules that change

These are CLAUDE.md updates, made with the slice:
- **Ship to production, never to a dev preview milestone.** Every push still passes lint, tests and the build, and the
  smoke checks still verify a deploy. The owner's feedback comes from the live app.
- **No rollback path for the old game.** The `pre-split` tag and git history stay, as history only.
- **Phaser in mini-game scenes:** "Phaser only in `stages/*/scene`". It stays lazy, and PixiJS stays race-only.
- **Real card values:** they live in the private pack only, never in git or in tests. This supersedes D54, D90, D125 and
  D132.

## 7. The minimum slice: URA Finale, the new game

**One release to production, with the full wipe.** After it, the owner can play complete URA Finale careers with any
Uma.

| In the slice | Details |
|---|---|
| **The wipe** | Generation 3. Every save is deleted on the phone and the server; nothing is kept |
| **Start** | 20 Uma Tickets to unlock Umas in the Stable. Every SSR card is open at its maximum level, gated by era to the scenario |
| **The Hub** | The kit's Hub with **Town Hall** (Stable, Card Library, Account) and **Career** (her careers and the current season). The Farm, Training and Racing pages go for now |
| **The career** | URA Finale's calendar: 12 seasons and the finale. Her objectives are today's T1 goals (a debut, a G3, two G2s and three G1s), raced on the engine against re-tuned rivals |
| **Two games** | **Furlong Hand** in each season with an objective race, as its prep heat, and **Training Yard** in the other seasons. Both can be replayed freely |
| **Upgrade** | The deck of six; the tree with real-card pricing; bond tracks (hints, friendship at 80, event skills at 100); skills with SP and hint discounts. Aptitudes stay at her own grades until Summer Camp |
| **The finale** | Three Furlong Hand heats as URA's cup, then the race. Winning completes the career, pays an Uma Ticket and shows the next scenario as "coming next" |

**Checks before the push:** lint, tests, the build and its budget; `sim:stages` for both games' grade bands;
`sim:decks` for the tree's bands; rivals checked against median and strong decks; the deploy smoke checks.

**Not in the slice,** in the order it follows, each as its own production release:
1. **Unity Cup and Team Showdown.** Shards start earning Umas.
2. **Trackblazer's shop** in the card race.
3. **Our Grand Concert and Fan Festival.** The peg board ships only after its determinism proof; otherwise a lattice.
4. **Grand Masters' fragments,** which completes tier 1, then promotion to tier 2.
5. **Tier 2:** Summer Camp (L'Arc), U.A.F., Festival Kitchen (Great Food Festival) and the rest, in scenario order.

Each piece lands before the owner's Umas reach it.

## 8. Calls, settled by default

None of these block the slice. Each becomes a decision unless the owner objects.

| # | Call | Default | Source |
|---|---|---|---|
| 1 | How many games | Six; Fan Festival is the first cut if its physics proof fails | 04 |
| 2 | Stages a season | One, plus free replays at any time | 04 |
| 3 | Does the card race touch the real race? | No; it pays resources only | 04 |
| 4 | Team Showdown's units | Her roster plus rival teams, whose captains pay Shards | 04 |
| 5 | Real card values in the rules | Yes, private pack only | 05 |
| 6 | Card level | Every SSR at its maximum (D329); bonds are the cards' progression | 05 |
| 7 | Where cards train | You post each card to a branch; by default, its own type's | 05 |
| 8 | Mood | Fixed at Great, so Mood Effect still counts | 05 |
| 9 | Tree size | 100 sessions plus two camps | 05 |
| 10 | Bond scope | Per Uma per tier | 05 |
| 11 | Careers | Each starts from base; the finished build is her racing build for that scenario | §2 |
| 12 | Cards in play | SSRs only, as today; R and SR stay out | 05 §1 |
| 13 | Prize Money and the Racecourse | Out of the slice until they have a purpose | §5 |
| 14 | The 15th scenario | Goshiki Shuntaisai fills the slot that waited for "Japan's next" | 01 §2 |
