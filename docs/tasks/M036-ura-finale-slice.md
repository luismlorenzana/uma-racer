# M036 — URA Finale, the new game (the first release of the restart)

> **Status: specified 2026-11-04, not started.** The design is the
> [drawing board v3](../research/drawing-board/README.md) (D380). This milestone is its first production release:
> complete URA Finale careers with two mini-games, on a fresh generation-3 save, launched with a full wipe. There is no
> dev-preview milestone. The owner tests in production and feeds back from there. Decisions D381–D388 are reserved for
> its parts. They are written as each part lands.

## Why

The live game is retired as of 2026-11-04 ("uma-racer is dead in its current state; let's start this correctly"). This
is the smallest complete game the new design allows:
- unlock Umas and cards;
- build a deck;
- play a career's seasons of mini-games;
- spend resources in her tree;
- race her objectives;
- win the URA Finals.

Everything else is on the roadmap ([v3 §7](../research/drawing-board/README.md#7-the-roadmap)).

## In and out

| In | Out (later releases or never) |
|---|---|
| Generation 3: a new save, a new sync stamp, a new server path, and the full wipe of generation 2 | Any migration or backup of generation 2 |
| Uma and Card Tickets; unlocking Umas in the Stable and cards in the Card Library | Team Showdown and Shards (release 2); Fan Festival, Scout points and the refit (release 3) |
| URA Finale careers (T = 1) for every Uma: 12 seasons and the URA Finals | Unity Cup and later scenarios; promotion and tiers 2–3 |
| **Training Yard** and **Furlong Hand**, with the shared stage framework | Summer Camp, Festival Kitchen, Fan Festival, Team Showdown |
| The tree, the deck and posting, bond tracks, skills, and the racing build | Aptitude points (her own grades stand until Summer Camp) |
| Objective races and the finale on the race engine and scene | The free Racecourse, Prize Money, the Exchange, featured races |
| The Hub: **Town Hall** and **Career** | The Farm, Training and Racing pages; badges, flair titles, the Trophy Hall |
| The manual, rewritten as built, and CLAUDE.md's new rules | Today's manual pages for the retired systems (deleted) |

## The rules

These are starting numbers. The sims own the final ones, and each part's decision records what it set.

### The career

- **Start a career:**
  - Any unlocked Uma can start her URA Finale career; one career at a time per Uma.
  - It freezes her objectives with today's generator (`planScenarioCareer` / `generateScenarioJourney`, T = 1): a
    Maiden G3, two Trials G2s (one at each of her two distances) and three Main G1s.
- **The calendar:**
  - 12 seasons: Junior, Classic and Senior × Spring, Summer, Autumn and Winter. Then the **Finale**.
  - Each objective sits in its race's season (`RaceTemplate.season`). The Maiden falls in Junior and the Trials in
    Classic. Of the Main G1s, the earliest by season falls in Classic and the other two in Senior.
  - When a race's season can't fit that order, it moves to the next year.
  - Two objectives may share a season.
- **A season:**
  1. **Play:** Furlong Hand if the season holds an objective, as the prep heat on the first objective's course.
     Otherwise Training Yard.
  2. **Upgrade.**
  3. **Race** its objectives, each won before the season can end, with free retries.
  
  The season ends with **Next season**. Playing again (§Stages) is open at any time and never advances the calendar.
- **The finale (URA Finals):**
  - A Furlong Hand prep heat, then three races: qualifier, semifinal and final.
  - They run at her best distance and surface, on the catalogue's highest-grade course for that pair, against fields
    strengthening from G2 to G1+.
  - Winning the final completes the career. Her build is frozen as her **URA Finale racing build** and shown on her
    profile.
- **Rewards:**
  - an objective's first win: +1 Card Ticket and SP by grade (G3 40, G2 60, G1 100), × (1 + Σ the deck's real Race
    Bonus);
  - completing the finale: +1 Uma Ticket and +2 Card Tickets.
- **A second career** with the same Uma in the same scenario is not in the slice. Her completed career stays
  viewable, and her stages stay replayable for practice.

### Stages

- **The framework** is [02](../research/drawing-board/02-mini-games.md) §5:
  - pure seeded rules in `@racer/domain`: `init`, `step`, `done`, `report`, and novice, competent and expert bots;
  - a lazy view per game;
  - an input journal in Dexie, flushed on pause, so a stage resumes after the app is killed;
  - **the domain settles:** the `settle-stage` operation carries the seed and the journal, and the device and the API
    replay the same rules for the grade.
- **Grades:** the score against the stage's target. D under 0.5, C 0.5, B 0.75, A 1.0, and S at 1.2 or A with every
  bonus task.
- **Pay** on every play, × the grade: D 0.25, C 0.6, B 0.8, A 1.0, S 1.2.
- **Replays:**
  - Both games can be played any time from her career, at the current season's stage.
  - A replay pays like a first play. **The tree and caps are the ceiling, not the plays.**
  - Practice, outside a career, pays nothing.
- **The targets (`sim:stages`):** a competent bot scores A, a novice C and an expert S on about half of the seeds. Each
  game has 3–7 minutes of play at a human pace (judged by move count × seconds per move).

**Training Yard** ([04](../research/drawing-board/04-mini-game-evaluation.md) §1.2):
- **The board:** a 6×6 yard, 60 placements. The next two pieces are shown, and one can be held.
- **Pieces:** **Uma face tiles** (the career Uma and her rivals' outfit faces) on **stat-coloured backgrounds**.
  - Three touching pieces of one colour and tier merge into the next tier, on the last piece placed.
  - The tiers show as frames: plain, bronze, silver, gold, rainbow.
- **Fatigue and Rest:** Fatigue blocks drift toward the biggest piece. Boxed in, a Fatigue becomes Rest, and three
  Rests clear the Fatigue around them.
- **Partners:**
  - Each of her six deck cards appears as a **Partner** piece with its art.
  - A Partner placed on a merge of its type lifts the result one more tier. At bond 80 it lifts two.
  - Friend and Group cards are wild.
- **Her queue:** her growth rates and the season's focus stat tilt the colours.
- **Pays:** Drills of each colour, from the merges made in that colour (about 260 drills in all at A), and SP (about
  30 at A).

**Furlong Hand** ([04](../research/drawing-board/04-mini-game-evaluation.md) §2.2), the rules as written there:
- the five-colour stride deck, her support cards as **Partners** with their art, and her skills as Skill cards;
- the course's legs from the objective's real layout (`course-layout.ts`);
- chaining by colour or one step up, **run** or **bank**;
- Breath and Drive, the strategy band, and line choice between legs;
- the spurt, and rival tokens (real Umas from the objective's rival field) showing their next move.

Grade: S, a win by 2 or more lengths with every task done; A, a win; B, top 3; C, top 5; D, otherwise.
**Pays:** Bond (about 60 at A) and SP (about 20 at A). **It never changes the real race.**

### The build

The model is [05](../research/drawing-board/05-card-mechanics.md) §3–§4.

**The deck:**
- Six owned SSRs whose era allows T = 1 (`eraOf`).
- Each is posted to one branch, by default its own type's (Friend and Group to Wit). A branch seats five.

**The tree:**
- Five branches × five levels × four pips, plus two Camp nodes. A Camp node is four level-5 sessions in a branch the
  owner picks, and opens when any branch reaches level 3.
- **Costs:** a pip costs 20, 22, 24, 26 or 28 drills of its colour by level. Energy Cost Reduction cuts it.
- **The session formula** is 05 §3.3:
  - the facility base table (URA's levels 1–5, a rule constant);
  - real Stat Bonus, Training Effectiveness, Mood Effect at Great and Skill Point Bonus from the cards posted there;
  - Friendship for an own-type card at bond 80 or more;
  - the +5% card count bonus;
  - her growth rates;
  - the T scale `s(1) = 1`.
- **Derived when read:** every pip shows its gain, and any overflow over the cap, before it is bought.

**Stats:**
- `min(cap(T), base star5 + Σ deck Initial stats + Σ bought pips + hint stat rewards)`.
- The caps are today's T1 values (`capProfileAt`).

**Bond tracks:**
- One per (Uma, tier, card), 0–100, starting at the card's real Initial Friendship Gauge.
- Bond is poured from the career's wallet.
- **Stops:**
  - **hints**, every `round(20 / (1 + Hint Frequency))` bond, each hint the card's next hint skill at
    `1 + Hint Levels` (its `hints.others` rewards pay when due);
  - **80**, friendship;
  - **100**, the card's event skills hinted, golds included.

**Skills:**
- Her own skills plus every hinted skill.
- Cost `round(costSp × (1 − d))`, with *d* = 0, 10, 20, 30, 35 or 40% at hint levels 0–5.
- SP spent in a career is capped at `spCapAt(1)` (2,000). Bought skills are equipped (up to 64). Golds need their
  white.

**Races:**
- A race reads the **racing build**: the stats above, her template aptitudes, her bought skills and the strategy she
  chooses (default `bestStrategy`).
- It runs on today's engine and run screen.

**Rivals:**
- `rollRivalFieldAt` at T = 1, re-tuned with `sim:decks` so that a career played once through at A grades, with a
  median bonded deck, wins a G3 ≥ 90%, a G2 ≥ 75% and a G1 ≥ 50% of its first tries.
- A strong deck wins more, and no deck caps all five stats.

**The targets (`sim:decks`):**
- A career played once at A per season ends with about 60% of the tree bought, about 3 of 6 cards at bond 80 and SP
  for 4–6 skills.
- One replay of each Training Yard season fills the tree.

### Unlocks

- **A new account starts with 20 Uma Tickets and 24 Card Tickets,** and nothing unlocked.
- One ticket unlocks one Uma (the Stable's Locked tab) or one SSR (the Card Library's Locked tab).
- Cards are account-wide. A career uses only cards its era allows.

## The save: generation 3

- **One save in one shape, no migrations,** with today's patterns: operations with ids, `commitOperation` on the
  device and the API, one sync lane, and receipts.
- **Synced kinds:** `account` (tickets, created), `uma` (unlocked), `card` (unlocked), `career` (Uma, T, season,
  objectives, finale, deck, posts, pips, skills, wallet), `bond` (Uma, tier, card, value, hints given) and
  `race-result`, plus the operations log.
- **Device-only:** the stage journal.
- **Operations:**
  - `create`, `unlock-uma`, `unlock-card`;
  - `start-career`, `set-deck`, `post-card`;
  - `buy-pips`, `pour-bond`, `buy-skill`;
  - `settle-stage` (seed and journal, replayed);
  - `run-race` (seeded, as today);
  - `next-season`, `run-finale`;
  - `dev-grant` (API only with `DEV_OPERATIONS=true`).
- **Stamps:** protocol 3, generation 3. Anything else is 426.
- **The server path is `g3/{uid}/{kind}/{id}`.** The local API file is `.data/save-g3.json`.
- **The device:**
  - Dexie `uma-racer-g3`, and the kit's `storagePrefix` is `uma-racer:g3:`.
  - On first boot it deletes the `uma-racer-g2` database and the `uma-racer:g2:*` keys.
  - This is the full wipe, and it is intended.

## The places

- **The Hub** (uma-kit `HubMap`):
  - **Town Hall:** Stable, Card Library, Account; the plaza crowd stays.
  - **Career:** her careers, the current season, and the two games.
  - The registry, peeks and side panel work as today.
- **Stable:** Owned and Locked tabs, unlock with a ticket, and her profile (racing builds, current career).
- **Card Library:** Owned and Locked tabs, unlock with a ticket, and each card's real effects at maximum level, read
  from the private pack.
- **Career:**
  - the calendar strip (12 seasons and the Finale) and the objectives;
  - the season's three steps: **Play**, **Upgrade** (Tree · Deck · Bonds · Skills) and **Race**;
  - **Next season** and the finale.
- **The games:** Training Yard and Furlong Hand, full screen, with a one-sentence rule card and a free practice. Input
  sits in the bottom 60% of the screen.
- **Account:** sync, appearance, app build and content; the check-in times row goes.
- **Theming:** every board is drawn in Uma art (`uma-kit/album` faces and busts, the card art, `uma-art` marks); no
  abstract placeholder shapes ship.

## Deleted at the switch

**Domain:**
- `farm`, `items`, `work`, `check-in`, `planner`, `economy`;
- the old `training`, and `constellation*`, `lineage`, `inspiration`;
- `progression` (Racing EXP and Levels);
- `tiers/advance`, `promotion` and `expedition`;
- `badges`, `trainer-achievements` and flair titles, which the slice drops;
- `sim/loop`;
- the generation-2 save.

**Web:** places `farm`, `check-in`, `needs`, `warehouse`, `exchange` and `training`, and the racing places except the
run screen and race scene; `ui/work`.

**API:** the generation-2 save code.

**Dependencies:** `uma-work`; the racer's uses of `uma-kit/work`.

**Docs:** the manual's pages for retired systems. `docs/rework` and `docs/rearchitecture` get an "archived" banner.

**Kept:** the race engine, the race catalogue and courses, `race-skills`, rivals and opponents, tier scaling and the map
(the 15th becomes Goshiki Shuntaisai), the master adapter (extended), `scenario-goals`, `card-focus`, the content
runtime, sign-in, the kit shell and Hub, and the deploy.

## The parts

They are built on the branch `restart/g3`. Each part runs in its own worktree, and Claude merges them. Nothing deploys
until T159.

| Part | What | After | Decision |
|---|---|---|---|
| **T152** ✓ | **Done (D381).** **The clean slate.** Delete §"Deleted at the switch" and cut the kept modules loose; generation 3's records, stamps, operation registry (every slice operation declared), API path and Dexie g3 with the g2 wipe; the master adapter's real card effects; tickets and unlocks; a green app that signs in to Town Hall → Account | — | D381 |
| **T153** ✓ | **Done (D382).** **The build.** Deck, posting, the tree and the session formula, bond tracks, skills, the racing build; card power (05's reference session, for the later refit); `sim:decks` | T152 | D382 |
| [**T154**](T154-the-career.md) | **The career.** Calendar placement, the season machine, objectives on the engine, the URA Finals, rewards; the rivals' re-tune with T153's sim | T152, T153's types | D383 |
| [**T155**](T155-stages-and-training-yard.md) | **The stage framework and Training Yard:** contract, host, journal, settle, `sim:stages`; the Yard's rules, bots and view | T152 | D384 |
| [**T156**](T156-furlong-hand.md) | **Furlong Hand:** rules, rival scripts, bots and view, on T155's contract | T155's contract | D385 |
| [**T157**](T157-the-shell.md) | **The shell:** the Hub's two pages, Stable, Card Library and Account on the generation-3 save | T152 | D386 |
| [**T158**](T158-career-screens.md) | **The career screens:** calendar, season flow, Tree · Deck · Bonds · Skills, the race hand-off and the finale | T153, T154, T157 (T155, T156) | D387 |
| [**T159**](T159-release.md) | **The release:** the manual rewritten as built, the new rules in CLAUDE.md and AGENTS.md, then the release steps below | All | D388 |

**The packets** are self-contained for any agent (Claude, ChatGPT or Codex): each has Why, Context, Do, Done when and
Deliver. A part's branch is `feat/t15x-…` from `restart/g3`, with a PR into `restart/g3`, and Claude merges. After
T152, the parts run in parallel: T153, T154, T155 and T157 at once, then T156 on T155's contract, then T158.

## The release (T159)

1. `restart/g3` passes the gates:
   - lint, `test:ci` and the build with its 180 KB budget;
   - `sim:stages`, `sim:decks` and `sim:careers` (T = 1);
   - the reach and "nothing old remains" checks and the docs link check.
2. Merge to `main`. CI deploys. Verify:
   - the new revision's image ends in the SHA;
   - `/api/health` 200 and `/api/save` 401 on the Cloud Run URL;
   - the shell is `no-cache`;
   - a live chunk holds a generation-3 string.
3. **The server wipe:** delete every document under Firestore's `saves` (generation 2 and its markers) with the scoped
   gcloud configuration, and confirm it's empty. No export is taken: the owner asked for no backups.
4. Tell the owner to restart: **Update ready → Restart**, then sign in. The device deletes its generation-2 database on
   that boot. The owner tests live.
5. Record D388 and mark M036 completed in the plan. The specs are deleted per D104.

## Done when

- [ ] A new account can unlock Umas and cards, start a URA Finale career, and play its 12 seasons and the finale end to
      end on the phone in production.
- [ ] Both games run 3–7 minutes, grade D–S, pay as specified, resume after the app is killed, and hold their
      `sim:stages` bands.
- [ ] Every tree pip previews its exact gain from the real card numbers, and buying it matches the preview.
- [ ] Objectives and the URA Finals race on the real engine with the racing build. The rivals hold `sim:decks`' bands.
- [ ] No clock anywhere: no timers, durations, regen, daily resets or check-ins in the code.
- [ ] No generation-2 save on the server or the phone.
- [ ] The manual describes the game as it runs, and CLAUDE.md holds the new rules.
