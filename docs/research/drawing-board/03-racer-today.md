# 03 · uma-racer today, against the 2026-11-04 redesign

Research only, on `origin/main` (`c592ccd`, generation 2). LOC counts are `wc -l` on non-test `.ts`/`.tsx`, so they
understate dense files (many lines are 150-250 characters). Guesses are marked **(guess)**.

## 1. System inventory

Totals today: `packages/domain/src` 21.9k LOC (+13.9k tests), `packages/race` 3.0k (+1.1k), `apps/web/src` 21.8k (+8.6k),
`apps/api/src` 0.9k (+1.1k), `scripts/sim` 1.5k. Domain areas below are subfolders of `packages/domain/src`; the core
files at its root (cards, constellation, scenarios, progression, race catalogue, lineage, flair, badges, opponents…)
are roughly 7.3k LOC.

The generation-2 loop is Farm gather -> Pantry craft -> Kitchen cook -> Training Hub session -> unlock (node, bond,
Inspiration slot, Extra Stats) -> race ([docs/game/01-game-loop.md](../../game/01-game-loop.md)). Every arrow except the
last is a timer (`TIME_FACTOR = 1.8`, `packages/domain/src/state/time.ts`). **The stat pipeline is built on timers**:
an Uma's stats are derived from unlocks that only timed sessions can pay for. Removing time therefore removes the way
stats are earned, not just a convenience layer.

| System | What it is | Lives in | LOC (src) | Verdict |
|---|---|---|---|---|
| **Tiers, map, promotion** | 3 tiers x 5 scenarios (T 1-15), cap budgets, SP caps, Hall of Fame, promotion resets | `domain/tiers` (map, scaling, promotion, advance, roster) | 1.2k | **Stays, changed.** The tier/scenario ladder and cap budgets (`tiers/scaling.ts`) are the natural spine for a career calendar. Promotion, Racing-Level gates and Uma Ticket payouts must be re-based on mini-game progress, not timers |
| **Scenarios / careers** | 15 scenarios, one buff each, frozen per-Uma career (Maiden, Trials, Main goals) | `domain/scenarios.ts`, `career-shapes.ts`, `career-stages.ts`, `scenario-goals.ts`, `scenario-buffs.ts`, `training/buffs.ts` | ~2k (guess) | **Stays, changed.** Today a scenario is a Racing-Level band plus a layer of timed unlocks. New: a scenario is the mini-game activity (one genre each). Careers (race goals) stay and map onto a turn calendar |
| **Training Hub** (Observatory, Lineage Hall, Gym, Dojo) | Four facilities. Sessions open constellation nodes, Inspiration slots/golds/uniques, Extra Stats nodes, card bonds | `domain/training` (derive, extra, bonds, sessions, trees, unlocks, skill-points), `apps/web/src/places/training` | 2.6k + 2.9k | **Goes: time-based** (sessions, slots, upgrades, queues, rooms). **Owner's call** on the *build model* it feeds (constellation trees, Extra Stats map, lineage): keep the derivation (`training/derive.ts`, `build.ts`, `extra.ts`) and replace "session" with "mini-game stage reward", or retire it? |
| **Support cards and bonds** | 312 SSRs, all open at 100%; a bond ties a card to one Uma for a tier (a Dojo session); era decay; Race Bonus | `domain/cards.ts`, `card-focus.ts`, `constellation.ts`, `training/bonds.ts`, `places/card-library` | ~1.5k + 0.8k | **Stays, changed.** Cards, era, Race Bonus and the Library stay. A bond is earned by mini-game output instead of a timed Dojo session (matches the brief's "bond support cards") |
| **Farm** (8 sites, Farm Level 1-50) | Timed gather jobs per site by ingredient family | `domain/farm`, `places/farm` | 0.5k + 1.3k | **Goes: time-based** (every job is a duration; Farm Level exists only to open grades) |
| **Pantry** | Timed craft, 1 raw -> 1 crafted | `domain/items/recipes.ts`, `places/farm` | in items | **Goes: time-based** |
| **Kitchen** | Timed cooking of meals and tonics | `domain/items/work.ts`, `places/farm` | in items | **Goes: time-based**. Owner's call if meals/tonics survive as non-timed consumables (see next row) |
| **Meals, tonics, items, Warehouse** | Item catalogue (families, grades 1-10), recipes, demand, stock | `domain/items` (0.9k), `places/warehouse` (0.4k) | 0.9k + 0.4k | **Owner's call.** Items exist to pay unlock costs (a tonic per node, a meal per Extra Stats node). With no Farm and no sessions they have no sink. Either goes entirely, or becomes a mini-game reward/consumable (e.g. a stage buff) |
| **uma-work / kit `/work`** | Shared timed-work engine and its Provider, queues, collect, recall | `@luismlorenzana/uma-work`, `uma-kit/work`; `domain/work` (0.5k + 1.2k tests), `apps/web/src/ui/work` | 0.5k + ~0.4k | **Goes: time-based** (the whole engine is jobs and slots) |
| **Speed Tickets** | Currency, 30 min off a running job; 30 Prize Money each | `domain/economy/exchange.ts`, `places/check-in/SpeedUpAll.tsx`, Exchange row | small | **Goes: time-based** |
| **Check-ins** | Check-in schedule, Collect all, Repeat, queue drop, Speed up all, summary, "what she still needs" | `domain/check-in` (1.5k + 1.3k tests), `domain/planner` (1.0k), `places/check-in` (1.2k), `places/needs` (0.4k) | 4.1k | **Goes: time-based** (planner/needs project queues; its "cascade" of unlock -> dish -> raw is the Farm loop) |
| **Daily Purse, featured races** | Prize Money falloff per local day; three featured races per day | `domain/economy/purse.ts`, `featured.ts` | ~0.3k | **Goes: time-based** (daily reset). Owner's call whether Prize Money needs a different anti-grind limit (e.g. per calendar turn) |
| **Prize Money and Exchange** | Race prizes; Exchange sells Speed Tickets, raw items, upgrades; sell surplus | `domain/economy` (0.8k), `places/exchange` (0.3k) | 1.1k | **Stays, changed.** Prize Money stays a currency, but every current sink is time (Speed Tickets, facility upgrades) or Farm (raw items). Needs new sinks. Owner's call: what does money buy now? |
| **Uma Tickets and unlocking Umas** | 20 at start, 1 per Uma-gate Shard (5 per ticket), 1 per promotion/HoF; unlock any Uma at tier 1 | `domain/tiers/roster.ts`, `places/stable`, `places/reveal` | in tiers/stable | **Stays** (not timed). Shard/gate sources must be re-pointed to the new progression |
| **Stable, roster, Card Library, album** | Roster album (Owned/Locked), outfit profile, Needs tab, Card Library, kit album and picker | `places/stable` (1.2k), `places/card-library` (0.8k), `ui/racerAlbum.tsx`, `uma-kit/album`, `/roster` | ~2.5k | **Stays.** The Needs tab goes (planner) |
| **Races and calendar** | Racecourse, race select, run, result, race catalogue (grades, courses, seasons) | `packages/race`, `domain/race-catalog.ts`, `progression-race.ts`, `race-pack.ts`, `course-layout.ts`, `places/racing` (5.4k), `scenes/race` | 3.0k + 5.4k | **Stays.** The catalogue's dates/seasons give a ready turn calendar. Featured races go |
| **Rivals** | Generated per race from a "typical trained Uma" per tier, handicap by grade | `domain/opponents.ts`, `tiers/rivals.ts`, `tiers/scaling.ts` | ~0.6k | **Stays, changed.** Rival strength is calibrated to "player's build ~ 60% of the cap budget". Mini-game output must land in that range, or the rival formula needs retuning (see section 2) |
| **Builds** | `domain/builds` = balance targets + committed `sim:builds`/`sim:careers` reports; "build" itself = `UmaBuild` presets (4 distance presets per tier) in `state/types.ts`, derived by `training/derive.ts` | `domain/builds`, `domain/state`, `domain/training/build.ts` | 0.3k | **Stays, changed.** Reports regenerate against the new pipeline. Four distance presets are Owner's call |
| **Hub and its four pages** | Town Hall, Training, Racing, Farm pages; place registry; pixel-art Phaser map; peeks | `domain/hub` (0.5k), `apps/web/src/hub` (0.5k), `uma-kit/hub`, `/shell`, `/places` | ~1.1k | **Stays, changed.** Shell, map, peeks stay. Farm page goes; Training page becomes the scenario activity entry. Racing and Town stay |
| **Account** | Trainer chip, sync status, appearance, check-in times, build/content info | `places/account` (0.3k), `uma-kit/places` | 0.3k | **Stays, changed** (check-in times row goes) |
| **Save and sync** | Dexie `uma-racer-g2`, one sync lane, `/api/save`, `/api/sync` protocol 2, ops log, parsers | `domain/save` (1.6k), `apps/web/src/save` (1.8k), `apps/api/src/save` (0.7k), `domain/state` | 4.4k | **Stays, changed.** Needs new record kinds for mini-game progress and a schema bump. Work/queue/check-in records go. Pure ledger + operations design is reusable |
| **Content / master data** | `uma-data` master records -> racer adapter; private data packs, WebP atlases, served via authenticated API | `domain/master`, `apps/api/src/master`, `apps/web/src/content`, `scripts/data`, `scripts/assets`, `uma-server/content` | 0.4k + 0.1k + 0.3k | **Stays** |
| **World Expeditions (phase 9)** | A tier's gating event; today a stand-in "8 wins" (`tiers/expedition.ts`); the real one is planned, unspecified | `tiers/expedition.ts`, `places/racing` (Expedition Map) | small | **Owner's call.** Planned and unbuilt; it can become a calendar event or capstone. No sunk cost |
| **Loop simulator** | `sim:loop`, `sim:builds`, `sim:careers`, `sim:turns`, `sim:balance` | `domain/sim` (2.3k), `scripts/sim` (1.5k) | 3.8k | `sim:loop` **Goes** (timers/Farm/utilisation). Balance and turns sims **Stay** |

**Size of what goes** (non-test, rough): Farm + items + work + check-in + planner + loop sim in domain is about
7.3k LOC. In web: `places/farm`, `places/check-in`, `places/needs`, `places/warehouse`, `ui/work`, most of
`places/training` is about 6.3k. About **13-14k of the 44k non-test LOC**, plus about 8k of their tests. The Training
Hub's derivation (`derive.ts`, `extra.ts`, trees) is the part with the real choice: keeping it is about 2k domain LOC.

## 2. What the race engine needs

The engine is `packages/race/src` (engine v9; `simulateRace(input)`, deterministic, 15 Hz, one-second turns since
v6). The contract is `RaceInput` (`packages/race/src/types.ts`), validated by `assertRaceInput`
(`packages/race/src/validation.ts`).

**Per runner (`RaceRunnerInput`):**

| Input | Type and range | Notes |
|---|---|---|
| `stats` | `{speed, stamina, power, guts, wit}`, finite numbers >= 0. **No upper bound in validation**; the game clamps them in derivation | Mood is applied inside (below), not by the caller |
| `strategy` | `front / pace / late / end` | Chosen by the player per race (`prepareRace` takes it; default `bestStrategy`, `progression-race.ts:297`) |
| `aptitude` | `{distance, surface, strategy}`, each grade `S..G` | One grade per axis for *this* race's distance, surface and strategy; `prepare.ts` reads them from the build's `aptitudes` |
| `gate` | integer 0..n-1, unique | Rolled from the seed in `prepare.ts` |
| `skills` | up to 64 `CompiledRaceSkill` (`domain/race-skills.ts`): guaranteed or Wit-roll activation, conditions, recovery/speed/acceleration effects, green passive stat gains, start-delay | Built from content with `compileRaceSkill`. Unsupported skills are dropped |
| `id`, `label` | strings | Cosmetic |

**Per race:** `course` (`distance`, `surface`, optional `season`, `layout` (corners/straights/slopes), `trackId`,
`rotation`, `grade` code), `runners` (1-18), `seed` (uint32).

**Not inputs.** Mood (-2..+2, each level moves every stat 2%; `turns.ts:165`, `turn-clock.ts` `moodStep: 0.02`) is rolled
inside the engine from each runner's own RNG stream. Ground, weather: fixed at Good/sunny (`constants.ts:131`). Race
Bonus affects only Racing EXP (`progression.ts`). The comment in `types.ts` saying mood is "applied by the caller" is
stale (v6+). A mini-game cannot inject mood or condition without an engine change. **(guess)** Easy to expose as an
optional per-runner `mood` input, since the roll already exists.

**Ranges.** Per-stat caps by scenario number T (`tiers/scaling.ts`, `constellation.ts`): T1 1,200 each; +250 budget a
scenario; T14 Speed 2,500, Stamina 1,750, Power 1,700, Guts/Wit 1,650; T15 2,600/1,750/1,800/1,700/1,650. Cap budget
6,000 at T1 to 9,500 at T15. SP cap 2,000 to 5,200. Median base stat 110 (`opponents.ts` `TYPICAL_BASE_STAT`).

**Where each is produced today** (`apps/web/src/places/racing/prepare.ts`, `deriveUmaPreset` in
`domain/training/derive.ts`):

- **Stats** = `min(cap(T), round(base + cardRaw x (1 + growth) + extra))`. `base` is the template's 5-star base;
  `cardRaw` sums open constellation nodes `nodeValue(T) x eraPct x (100+buff)% x share[type][stat]`; `extra` is flat
  Extra Stats nodes (Gym). The whole build is tuned to about 60% of the cap budget (`04` section 7). **This is the
  number a mini-game must hit**: roughly +50-60% of cap budget spread over five stats from base ~110 each.
- **Aptitudes** = template grades improved only by Inspiration lineage, capped at A (`lineage.ts`, `inspiration.ts`).
- **Skills** = the unique skill at Lv 5 plus the equipped loadout the Uma's SP can pay for (`playerRaceSkills`,
  `training/skill-points.ts`: baseline SP from open nodes plus Friend/Group card nodes).
- **Strategy and distance preset**: owner's pick at race time; the preset (four per tier) decides which card set and
  loadout apply (D254).
- **Rivals**: `rollRivalFieldAt` (`tiers/rivals.ts`, `opponents.ts`): stats 80-100% of a style preset, graded handicap
  (35% Debut to 5% G1), 3-7 skills each, aptitudes fixed at A.

**Contract for mini-game outputs.** Whatever a stage awards must resolve to: (1) five stats under the T cap;
(2) a set of aptitude grades; (3) a skill list affordable by an SP-like budget (or granted directly); (4) per-race
strategy, which stays a player choice. The rest of the derivation (cards, trees, lineage) is optional plumbing that
can be kept or replaced.

## 3. The old Uma Puzzles (`pre-split`)

Source: `docs/design/uma-puzzles.md`, `docs/technical/uma-puzzles-implementation.md`,
`docs/research/puzzle-battle-phone-proof.md` at the tag; code under `packages/domain/src/minigames/uma-puzzles/`,
`apps/web/src/{game,scenes,screens,ui,content}/puzzles/`. Read with
`git show pre-split:<path>`.

**It was a full account-wide mode, not just a board.** Roster, ten parties of five, per-outfit Puzzle Level, a
26-node chapter map per scenario, an exchange shop, a negative-ticket "bank" migration and preservation. The board
battle is the core worth reusing.

**Rules.**
- 6 columns x 5 rows. Six orb kinds: Fire, Water, Wood, Light, Dark, Heart. Hold and drag one orb through
  neighbours (including diagonals) to swap continuously, Puzzle & Dragons style; a 7-second clock starts at the first
  transition; planning is untimed. Release without a transition cancels.
- Lines of 3+ clear; same-kind connected lines form one combo; gravity, seeded refill and cascades run until stable
  (a 2,048-retry match-free opening; 64-cascade bound).
- A party of five shares one HP pool. Each Uma attacks once per cleared group of her element; 5+ orbs makes a mass hit.
  Hearts heal. Damage: `ATK x (1+0.25(orbs-3)) x (1+0.25(combos-1)) x leader x pattern x matchup - DEF`.
  Element triangle (Fire > Wood > Water > Fire; Light and Dark mutual x2).
- Enemies (1-5 per node, 1-4 cyclic intents) show a countdown and next hit. Recipes: striker, healer, guard, converter,
  combo-ward, guardian, champion (rage below 50% HP). Per Uma: one active skill (convert 4 or 6 orbs, shield, delay)
  with a charge of 5-7 turns; one leader passive; optional pattern bonus at PL5 and PL10.
- **Win** = all enemies dead; **lose** = party HP 0, or the 30-drag cap. Stage score is not a number: the result is
  win/loss plus drags, combos and damage for the receipt.
- Fully deterministic: seeded xorshift32 streams, a journal of at most 181 actions, server-side replay validation.

**Tech.** PixiJS 8 scene (`scenes/puzzles/PuzzleBattleScene.ts`, 370 LOC) with a single-pointer controller
(`pointer.ts`, `scenes/puzzle-input/geometry.ts`) and a lock-free preview while dragging. DOM HUD in React
(`screens/puzzles/PuzzleBattleScreen.tsx`, `PuzzleBattleStage.tsx`). It was built on a shared 6x5 board with an earlier
"Spark" training minigame (still in `minigames/friendship` and `spark-rival` at the tag) **(guess: that is where the
board and drag controller came from)**.

**Session shape and length.** One node = one battle: a regular trio of foes, an elite group or a boss. Entry and
retries were free, and HP and cooldowns reset each node. Documented evidence: a proof win took 5 drags and 14 combos
(`puzzle-battle-phone-proof.md`); the hard cap is 30 drags. **Duration is not documented. (guess: 1-4 minutes a battle;
5-30 drags at a few seconds each plus resolve animation.)** A chapter was 14 encounters on the primary route, so about
30-60 minutes of play **(guess)**.

**Rewards and dependencies.** Per win: Puzzle EXP for the five entrants (100 + 10(L-1) per level; ordinary x0.28,
guardian x0.8, champion x0.5 of the encounter level), plus Constellation Level tickets by enemy colour (FR/PC/LS/EC
styles; 3 per foe, 6 guardian, 12 champion; 132 for a full chapter) that raise CL 1-10 for one Uma/scenario. It
depended on: the roster and templates (stats feed ATK/HP/RCV by formula), source A-aptitudes (element, ticket
eligibility), scenarios (chapters), Constellation Level (the reward target), the exchange/bank/debt, a private monster
art pack plus content publish, and Dexie journal/ops sync with API replay.

**Size at `pre-split`** (non-test / test LOC):

| Part | Non-test | Test |
|---|---:|---:|
| Domain rules (`minigames/uma-puzzles`) | 3,433 | 1,691 |
| (of which board, combat, battle, enemies, rules, bots, rng, types) | about 700 | in battle/board/combat tests |
| (of which operations, preservation, bank, materials, records, legacy: economy and migration) | about 1,500 | |
| (of which campaign map, allocation, rewards) | 597 | 333 |
| Pixi scene and pointer | 370 | 149 |
| Web host (journal, operations, store, preparation) | 1,434 | 1,210 |
| Screens (hub, map, party, roster, result, guide, proof) | 1,190 | 481 |
| UI pieces | 322 | 37 |
| Content client | 173 | 186 |
| API (`puzzle*.ts`, a copy of 83 domain modules for replay) | 605 incl. tests | |
| Sims and asset scripts | 432 (sim) plus pipelines | |
| **Total** | **about 6.9k + API** | **about 3.8k** |

**Porting as one scenario's stage.**
- **Keep:** the board (`board.ts` 141, `battle.ts`/`combat.ts`/`battle-rules.ts` about 240), the RNG, `enemies.ts`, `bots.ts`
  (as test players and auto-balance), the Pixi scene and pointer controller, the replay/hash tests and the guide
  screens. Together about 2.5k LOC.
- **Cut:** parties and roster management, Puzzle Level, CL tickets, bank/debt/exchange, preservation, legacy migration,
  campaign v1, the journal and server replay (a personal single-player game does not need anti-cheat replay), and
  the capability flags. That is about 70% of the code.
- **Adapt:** the party model (shared HP of five) must become a per-Uma mini-game; the Uma's own stats could drive ATK/HP
  (existing `PUZZLE_STAT_GROWTH`), her aptitude drives the active skill. Rewards change from tickets to the stat/bond
  outputs of section 2. The 7-second move clock is a skill-timing rule, **not** a real-time progression mechanic;
  confirm that it stays (see open points).
- **Risks:** (a) the balance was never closed ("not balance closure", D269); (b) it needs original monster art and a
  fixed cast, which was a private-content pipeline; (c) 3-7 minute stages fit a battle but one per scenario means
  tuning 15 chapters of difficulty; (d) the git history is deleted code with `@racer/domain` imports and a
  hand-copied API twin, so a clean re-port into the current `domain/hub` and `G2Game` port is a rewrite of the glue;
  (e) PixiJS is allowed only in `scenes/race` today (`CLAUDE.md`), so a second Pixi scene needs a lazy chunk and a
  rule change; the startup budget (180 KB gzip) already sat at 153 KB then.

## 4. Shared-package impact

**Imports in racer today** (counts of import statements): `uma-kit/ui` 45, `/album` 22, `/work` 17, `/shell` 15,
`/content` 10, `/places` 9, `/roster` 7, `/hub` 7, `/auth` 5; `uma-work` 7, `uma-data` 6 (+4 `testing`); API:
`uma-server/content` 4, `uma-server/auth` 4; `uma-art` in `apps/web` and domain (art registry, atlases).

| Package / subpath | Used for | Under the new direction |
|---|---|---|
| `uma-kit/work` (17 imports) and `uma-work` (7) | Timed-work Provider, job/session sheets, queues, Collect all | **Unused.** Imports are in `ui/work/*`, `places/farm/*`, `places/training/*`, `places/check-in/SpeedUpAll.tsx`, `domain/work/*`, `dev/CheckInProof.tsx` |
| `uma-kit/ui` | Buttons, sheets, chips, icons, `UiMark`, `AnimatedNumber` | **Stays.** The Speed Ticket mark in `uma-art` goes |
| `uma-kit/shell`, `/hub`, `/places` | Frame, bars, menu, peek panel, Phaser Hub map, account page, boot gates, exchange rows | **Stay.** `ExchangeRows` is Prize Money-based; check use |
| `uma-kit/album`, `/roster` | Roster album, picker, face/bust/chibi, ordering (`/roster` has "work ordering" helpers) | **Stay** (work ordering unused) |
| `uma-kit/content`, `/auth` | Content client and runtime; Google sign-in | **Stay** |
| `uma-data`, `uma-server`, `uma-art` | Master data, API guard and content serving, pixel art | **Stay.** Items/Farm frames in `uma-art` become orphaned art (A04 tonic icons were activated in `be16a6d`; consider whether to keep) |

**Must not break (uma-rpg).** uma-rpg consumes the same kit, `uma-work` and `uma-art`, and the change protocol
(`docs/change-protocol.md`) forbids forking kit components in racer: any kit removal or change goes through
uma-platform as a "Both apps" request. Racer removing its *use* of `/work` breaks nothing; **do not remove or alter
`uma-work` or `kit/work` exports** because uma-rpg's Farm/Forge/Training run on them **(guess from the shared-engine
design; I did not read uma-rpg)**. Pinned versions: kit 0.9.1, uma-work 0.1.0, uma-art 2.10.0. Racer's gen-2 save
shares `@racer/domain` shapes only with itself; `uma-data` master records are shared with uma-rpg, so adapter changes
stay in `domain/master`.

## Open points for the owner

1. **Is the stat pipeline kept?** Option A: keep constellation trees, Extra Stats, lineage and card bonds, and
   mini-game stages "open" them (the Training Hub's derivation survives, only sessions go). Option B: a new simpler
   stat model fed directly by stage output. A needs the least engine/rival retuning.
2. **Items (meals, tonics, crops, Warehouse)** have no sink once sessions and Farm go. Delete them, or turn them
   into stage-reward consumables?
3. **Prize Money sinks** are all timed (Speed Tickets, upgrades) or Farm (raw items). What does money buy?
4. **Unlock/gate economy**: Uma Shards come from Racing-Level gates, promotion from a World Expedition. Do these stay
   tied to races, or to stage and calendar progress?
5. **Expedition (phase 9)**: capstone event of a career calendar, or dropped?
6. **Mood and condition**: expose a per-runner mood input to the race engine so stage performance can matter, or keep
   it a seeded roll?
7. **Puzzle stage**: is the 7-second drag clock acceptable under "no time-based mechanics"? Which scenario gets it,
   and does the party of five become one Uma's own board?
8. **The four distance presets per tier** are a build-system complication. Keep them?
9. **Daily Purse and featured races** are daily; what replaces the anti-grind limit?
10. **PixiJS scope**: a second Pixi scene (the puzzle) needs a lazy chunk and an update to the CLAUDE.md rule
    ("PixiJS for the race scene only").
