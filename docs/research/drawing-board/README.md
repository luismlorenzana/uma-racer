# The drawing board: Uma Racer without the clock (v3)

> **The design for the restart (2026-11-04).** v3 applies the owner's third round of answers. v1 (`06ce5db`) and v2
> (`0c30e76`) are in git. It rests on five research reports:
> [01 · the original career and its 15 scenarios](01-uma-career-and-scenarios.md),
> [02 · mini-games: design and tech](02-mini-games.md), [03 · uma-racer today](03-racer-today.md),
> [04 · the mini-game evaluation](04-mini-game-evaluation.md) and [05 · card mechanics](05-card-mechanics.md).
> The restart is D380. The first release is M036, the URA Finale slice, released on 2026-11-05 (D388; [the task
> plan](../../tasks/README.md)). The rework's pages ([docs/rework](../../rework/README.md)) are archived.

## 1. The owner's direction

**The game:**
- **No time-based mechanics,** and no play limits: the more you play, the more you unlock.
- **No energy, mood or rest.** Retries are free.
- **A handful of mini-games (5–7),** each paying different things at different points of a career.
- **The core is a card race in the Pocket Card Jockey vein,** fully Uma-themed and played with the real support cards.
  It recurs all through every career.
- **One game unlocks Umas, and another unlocks cards.**
- **Every mechanic is open from scenario 1.** Nothing is unlocked by reaching a later scenario. New mechanics arrive
  by release, and then work everywhere.
- **Card power creep is answered.** Newer cards often outclass older ones of other running styles. Since the owner
  plays every Uma, each card can be **refitted once** to stay level (§4.3).
- **Every mini-game is Uma Musume through and through:** Uma faces, busts and chibis, the real support cards, real
  courses and the series' places. Not abstract shapes.

**The mini-game constraints:**
- No audio needed to finish one, so no rhythm games.
- No heavy tapping, so no runners.
- No one-touch momentum.
- Nothing as thin as the claw machine.
- Nothing as heavy as Puzzle & Dragons or Kingdom Rush. **The Uma Puzzles fold-in is cancelled.**

**The loop:** play mini-games for resources, upgrade the Uma, race; then again, on a seasonal cadence.

**The build:**
- Mini-games pay **resources**, which the owner **allocates by hand in trees**, because that is deterministic.
- What an allocation grants follows the **real card mechanics**.

**The release:**
- **No dev preview and no dev-only milestone.** The minimum slice is a full URA Finale.
- It launches to production with a **full wipe**, with no backups and no rollback.
- The owner tests live and gives feedback. The later games and mechanics follow as releases on a roadmap.

## 2. The shape of the game

**An Uma's career is one scenario,** from the start of her Junior year to the scenario's finale.

**The calendar** has three school years of four seasons each, so 12 seasons and then the finale
([01](01-uma-career-and-scenarios.md) §5).

**Each season runs three steps:**

| Step | What happens |
|---|---|
| **1. Play** | The season's mini-game, one stage of 3–7 minutes, graded D to S. Any game can be replayed at any time for more resources |
| **2. Upgrade** | Spend resources in her tree, post her six cards, pour bond, buy skills. Every number is previewed before you commit |
| **3. Race** | The objective races that fall in the season, on today's race engine. She must win each one before the calendar passes it. Retries are free |

**The finale** is the scenario's cup, for URA Finale the three URA Finals races. Winning it **completes the career**
and opens her next scenario.

**What carries over:**
- **Each career starts her from her base stats,** with a fresh tree under that scenario's caps, as each career does in
  the original. The finished build is kept as **her racing build** for that scenario, the original's "Veteran".
- **Bonds carry across the five careers of a tier** ([05](05-card-mechanics.md) §3.4).
- **What accumulates on the account:** Umas and cards unlocked, refits, bonds, and the best grade on each stage.

**What makes scenarios differ:**
- the caps;
- her objectives;
- the rivals;
- the card era, since cards released after a scenario can't be used in it;
- the finale;
- **a themed stage set** in every game: its boards, rival teams, courses and dishes.

**A scenario never adds or removes a mechanic.**

## 3. The mini-games: a core and five more

The set is [04](04-mini-game-evaluation.md) §3: six games, each owning its own resources and season slot. All of
them are turn-based or aim-then-watch, with no audio and light taps. Five run on DOM with Motion; the peg board uses
Phaser, already loaded by the Hub. The *ships* column is the roadmap's order, not a scenario gate.

| Game | Genre | The Uma Musume in it | Pays | Ships |
|---|---|---|---|---|
| **Furlong Hand** (the core) | Card race | **Partners:** the real support card art. Her rivals are real Umas on a position ladder. **The course:** the real course of her next objective, its legs from the real layout. **Style bands:** her running style's band | **Bond**, **Hints**, SP | The slice |
| **Training Yard** | Merge (Triple Town–like) | Pieces are **Uma face tiles on stat-coloured backgrounds**, and merges climb frames (bronze, silver, gold, rainbow). Her cards are Partner pieces | **Drills** (stat-coloured), SP | The slice |
| **Team Showdown** | Auto-battler, untimed | Teams of real Umas (busts) wearing support cards; rival teams captained by locked Umas | **Shards**, which unlock Umas | Release 2 |
| **Fan Festival** | Peg board (Peglin-like) | A cheer orb falls through crowds of fans and penlights. Each card in her deck is an orb with its art. The board is a race-day crowd | **Scout points** toward a card you choose, to unlock it and refit it | Release 3, after a determinism proof |
| **Summer Camp** | Dice placement | The camp's beach, hill and pool facilities, with that day's support cards standing at each. Her dice show her face | **Aptitude points**, Drills | Release 4 |
| **Festival Kitchen** | Cooking on a flavour map | Uma judges with their real appetites; carrots and the series' dishes as ingredients; cards lend techniques | **Dishes**: one-use boosts | Release 5 |

**Shards and Scout points are deterministic.** You pick the Uma or card you're working toward, and grades fill its
meter. Nothing is a gacha.

**How a stage pays:**
- The grade is set by the score against the stage's target: **D** under 50%, **C** 50%, **B** 75%, **A** 100%, **S**
  120% or A with every bonus task.
- A stage pays its resources on every play, scaled by grade: D 0.25, C 0.6, B 0.8, A 1.0, S 1.2.
- The trees and caps are finite, so playing more fills them sooner but never raises the ceiling.
- Each stage follows [02](02-mini-games.md) §5: pure seeded rules, bots, `sim:stages`, and a journal so a stage resumes
  after iOS kills the app.

**Ideas from [04](04-mini-game-evaluation.md) §3's growth table** (teammates, shops, fragments, knowledge drafts and the
rest) become **mechanics on the roadmap**. Each is open in every scenario once it ships, and the scenario it came from
gives it its theme.

## 4. The build: resources, trees and the real cards

### 4.1 Resources and the tree

This is the model in [05](05-card-mechanics.md) §3.

**Resources:**

| Resource | Spent on |
|---|---|
| **Drills** in five colours | Training sessions in the tree |
| **Skill Points** | Skills |
| **Bond** | The bond track of a card she has |
| **Aptitude points** | One grade step on a distance, surface or style, up to A |
| **Uma Tickets, Shards** | Unlocking Umas |
| **Card Tickets, Scout points** | Unlocking cards; Scout points also pay for a refit |

**The tree:**
- One tree per career, with **five branches**, one per training facility.
- Each branch has five levels of four session pips: **100 sessions**, plus two Camp nodes.
- A pip costs drills of its colour.
- **What a pip grants is the original's training formula,** computed from the cards you **post** to that branch:
  - each card's real Stat Bonus, Training Effectiveness, Mood Effect (mood fixed at Great) and Skill Point Bonus;
  - the card count bonus;
  - Friendship, for a card at its own type's branch with bond 80 or more;
  - her growth rates.
- It is recomputed whenever you change the deck or a bond, so **every pip shows its exact gain before you buy it**.

### 4.2 Bonds and skills

**Bond tracks** run 0–100 per card and start at the card's real initial bond. You pour Bond into them, and they stop
at three points:
- **hints**, at intervals set by Hint Frequency;
- **80**, friendship;
- **100**, the card's event skills.

**Skills** come from SP, with hint levels cutting the cost up to 40%. The SP you can spend in a career is capped by its
scenario.

### 4.3 Owning cards, and the refit

**Owning cards:**
- Cards are **unlocked** one by one: with Card Tickets in the slice, and with Fan Festival's Scout points once it ships.
- An owned SSR plays at its maximum level. Bond is each card's progression.

**Measuring a card's power** works because the tree prices training with the original formula:
- A card's **power** is the stat gain it adds to a **reference session**: a level-3 pip at its own type's branch, bonded,
  on a reference Uma, beside a fixed reference deck.
- It is computed from the card's real effects, so every card of a type can be ranked on one scale. Friend and Group
  cards are ranked among themselves.

**The refit, once per card:**
- It raises the card's training effects (Stat Bonus, Training Effectiveness, Friendship, Mood Effect and Skill Point
  Bonus) by one common factor, until its power equals the **median power of its type among the newest era's cards**.
- Its skills, hints and unique effect stay its own.
- A card already at or above that level can't be refitted.
- The result is fixed once done, and it applies in every scenario the card's era allows.
- So an older End-style card that hints the skills an End runner needs keeps up with the newest Front-style releases.
- The refit ships with Fan Festival, because it costs Scout points. Power creep only bites from tier 2, when newer
  eras open, so tier 1 doesn't need it.

### 4.4 Data and balance

**The data is already there.** uma-data holds every card's full effect table and every Uma's base stats and growth
rates. Only the racer's adapter changes, from today's squashed 0.5–1.5 profile to the real values. Those stay in the
private pack, and tests use synthetic cards ([05](05-card-mechanics.md) §1).

**Balance:**
- A rough run of 100 sessions puts an empty deck at about 44% of the T1 cap budget, a median bonded deck at about 67%
  and a strong deck at about 80%.
- Rivals are tuned near 60%.
- One scale per scenario, set by a `sim:decks` run, keeps later scenarios in the same band.

## 5. What stays and what goes

**Stays:**
- the race engine and its scene, the race catalogue and courses;
- the rivals, re-tuned;
- tiers, the 15 scenarios and their caps; the 15th becomes **Goshiki Shuntaisai**, which Japan released on 2026-10-26;
- support cards and the Card Library;
- the Stable, the album and Uma Tickets;
- sign-in, master data, the shared kit, and the deploy pipeline;
- save and sync as patterns, under generation 3.

**Goes:**
- everything on a clock: the Farm, the Pantry, the Kitchen, items, uma-work and the kit's `/work` screens, Speed
  Tickets, check-ins, the planner and the Needs tab, the Daily Purse and featured races;
- the Training Hub's sessions and facilities;
- today's unlock trees: constellations, Extra Stats and lineage;
- Racing Levels;
- World Expeditions;
- `sim:loop`.

**Prize Money, the Exchange and the free Racecourse** are left out until they have a purpose. The career's races are
the racing.

**Start correctly:**
- **The same repository and infrastructure:** project, buckets, sign-in, the API's shape, deploy and CI.
- **The game layer is rebuilt, not trimmed.** The old places and domain areas are deleted outright, and the new ones
  are written fresh. The race engine, race catalogue, rivals, tier scaling and the master-data adapter (extended) are
  kept.
- **Saves become generation 3:** a new local database, a new server path and a new sync stamp. Every generation-2 save
  is deleted on the phone and on the server.

**The shared kit:** the racer stops importing `uma-kit/work` and `uma-work`. Nothing is removed from the kit, because
uma-rpg uses both. uma-platform is told, and also that uma-puzzle stays its own plan.

## 6. Engineering rules that change

These are CLAUDE.md updates, made with the slice:
- **Ship to production, never to a dev-preview milestone.** Every push still passes lint, tests, the build and the
  sims, and the smoke checks still verify a deploy. The owner's feedback comes from the live app.
- **No rollback path for the old game.** The `pre-split` tag and git history stay, as history only.
- **Phaser in mini-game scenes:** "Phaser only in `stages/*/scene`". It stays lazy, and PixiJS stays race-only.
- **Real card values:** they live in the private pack only, never in git or in tests. This supersedes D54, D90, D125 and
  D132.

## 7. The roadmap

| Release | What it adds | Why then |
|---|---|---|
| **1. URA Finale, the slice** (M036, released, D388) | Careers for URA Finale end to end. **Furlong Hand** and **Training Yard**; the tree, deck, bonds and skills; Uma and Card Tickets; the full wipe | The smallest complete game |
| 2 | **Team Showdown**: Shards and Umas earned in play; Unity Cup's careers | Umas beyond the starting tickets |
| 3 | **Fan Festival**: Scout points, cards earned in play and **the refit**; Trackblazer's and Our Grand Concert's careers | Cards beyond the starting tickets; refits before tier 2's eras |
| 4 | **Summer Camp**: aptitude points; Grand Masters' careers; **promotion** to tier 2 | Tier 1 complete |
| 5 | **Festival Kitchen**: dishes; tier 2's careers | |
| Later | Roadmap mechanics in the card race and the other games (a teammate, a shop between legs, fragments, a knowledge draft…); tiers 2 and 3's careers; uses for Prize Money and the Racecourse | |

Each release lands before the owner's Umas need it.

## 8. Calls, settled by default

| # | Call | Default |
|---|---|---|
| 1 | How many games | Six; Fan Festival falls back to rule-based pegs if its physics proof fails |
| 2 | Stages a season | One, plus free replays at any time |
| 3 | Does the card race touch the real race? | No; it pays resources only |
| 4 | Unlocking | Umas with Uma Tickets, then Shards; cards with Card Tickets, then Scout points. You choose the target |
| 5 | Real card values in the rules | Yes, private pack only |
| 6 | An owned card's level | Its maximum; bonds are its progression |
| 7 | The refit | Once per card, up to the median power of its type in the newest era; skills untouched |
| 8 | Where cards train | You post each card to a branch; by default, its own type's |
| 9 | Mood | Fixed at Great, so Mood Effect still counts |
| 10 | Tree size | 100 sessions plus two camps |
| 11 | Bond scope | Per Uma per tier |
| 12 | Careers | Each starts from base; the finished build is her racing build for that scenario |
| 13 | Cards in play | SSRs only, as today |
| 14 | Prize Money and the Racecourse | Out until they have a purpose |
| 15 | The 15th scenario | Goshiki Shuntaisai |
