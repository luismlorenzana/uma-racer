# 07 · Stages

> **Status: as released (M036, D388); the framework is T155's (D384).** Its games are Training Yard
> ([08](08-training-yard.md), T155) and Furlong Hand ([09](09-furlong-hand.md), T156, D385). The career screens that
> open a season's stage are T158's (D387).
> The design is [02 · mini-games](../research/drawing-board/02-mini-games.md) §2, §4 and §5, and M036's "Stages".

A **stage** is one play of a mini-game: 3–7 minutes, graded D to S, paying a career's wallet. Every game shares one
framework: pure seeded rules in the domain with three bots and a balance sim, a lazy view on the device, a journal that
survives the app being killed, and the domain, not the view, settling the grade and the pay.

Code: `packages/domain/src/stages/` (`@racer/domain/stages`) and `apps/web/src/stages/`.

## 1. The contract

A game is a `StageRules<S>` (`stages/contract.ts`), registered once by kind (`stages/registry.ts`):

| Part | What |
|---|---|
| `kind` | `training-yard` or `furlong-hand` (`StageKind`, the career's games) |
| `version` | The rules' version. Any rule change bumps it: a journal on another version is refused, never replayed on new rules |
| `maxInputs` | The most moves a finished play can hold; a longer journal is refused unread |
| `init(config)` | The play's first state, from its `StageConfig` |
| `step(state, input)` | One move: the next state, or `null` when the move isn't legal. It never writes into `state` |
| `done(state)` | Whether the play is over |
| `report(state)` | `{ p, tasks, score, drills?, bonusSp? }`: the score over the stage's target, the bonus tasks, and how a drill pay splits across the colours |
| `bots` | `novice`, `competent` and `expert`: each gives the next move for a state, with its own dice |

- **`StageConfig`** is everything a play reads: `{ kind, seed, T, uma, deck, bonds, seasonFocus?, course?, furlong?,
  practice }`. `uma` is her outfit id and growth rates in whole percents; `deck` her career's cards in deck order, each
  with its type, its real effects by effect id and its unique effect's terms; `bonds` each deck card's bond (its track,
  or its Initial Friendship Gauge); `seasonFocus` the season's focus stat (Training Yard); `course` the race whose
  course the stage runs and `furlong` that race's legs, her racing build as the race reads it, her skills and the
  rival field (Furlong Hand, [09](09-furlong-hand.md) §1). The device and the API build it alike from the career and
  the content (`stages/config.ts`), so a play's journal needs only its seed and its moves.
- **`StageInput`** is one quantised move, `{ tick, code, x?, y? }`: `tick` is the move's index (a turn-based game's),
  `code` the game's own move, and `x`, `y` whole numbers when the move needs a place.
- **`Journal`** is `{ config, version, inputs }`: what the device keeps while a play is open.
- **The registry:** `registerStage(rules)` adds a game (a kind registers once) and `stageRules(kind)` reads it, null
  while a game isn't built. The games register in `registry.ts` itself, so whatever reads the registry reads them all.
- **Determinism:** integers or `+ − × ÷` only, no `Math.random`, no wall clock, and none of `Math.pow`, `**`,
  `Math.sin` and kin (they can differ between JavaScriptCore and V8). The dice are `stageRng(seed)`, mulberry32 read as
  integers, step for step the race engine's `createRng`. `stages/purity.test.ts` holds every file to it, and each game
  pins golden hashes of fixed seeds' plays.

**Adding a game:** its rules and bots under `stages/<kind>/`, one `registerStage` line in `registry.ts`, its golden
plays, its view and rule card in `apps/web/src/stages/views.ts`, its `sim:stages` pace (`SECONDS_PER_MOVE`), and its
manual page.

<!-- live:stage-games -->
| Game | Rules version | Pays at A | Built |
|---|---|---|---|
| Training Yard | 1 | 200 drills, 30 SP | yes |
| Furlong Hand | 1 | 25 Bond, 20 SP | yes |
<!-- /live -->

## 2. Grades and pay

The framework grades a report (`grade(p, tasks)`): D under 0.5 (not cleared), C from 0.5, B from 0.75, A from 1, and S
from 1.2 or at A with every bonus task. **Every play pays**, D included: the game's pay at A
([12](12-pacing.md) §1, `STAGE_PAY_AT_A`) × the grade's multiplier, each resource rounded half up. A game's own bonus
SP (the Yard's Rests) comes on top, unscaled. Drills split across the colours by the report's weights, largest
remainder first, ties to the earlier colour.

<!-- live:stage-grades -->
| Grade | p | Pays × the game's pay at A |
|---|---|---|
| S | 1.2 or more, or A with every task | 1.2 |
| A | 1 or more | 1 |
| B | 0.75 or more | 0.8 |
| C | 0.5 or more | 0.6 |
| D | under 0.5 | 0.25 |
<!-- /live -->

## 3. Settling: `settle-stage`

The view never grades. On a play's last move the device commits **`settle-stage`**
`{ careerId, kind, seed, version, inputs, practice }`: the seed and the moves, never a result.
- **Both sides replay.** The device (through `commitOperation`) and the API each build the config from the career as it
  stands, replay the moves through the game's rules (`settle(journal, rules)`), grade the report and pay the grade into
  the career's wallet. The receipt is `{ careerId, kind, seed, practice, season, grade, p, score, tasks, pay }`.
- **Refused in plain words, writing nothing:** a game that isn't built ("… isn't built yet."), another rules
  version, a career that doesn't exist, a finished career's paid play ("its stages are practice now"), a move that
  isn't legal ("Move 12 of that play isn't legal in Training Yard, …"), and a play that stops short ("… isn't
  finished: it stops after 40 moves.").
- **Small:** at most 2,000 moves on the wire; a whole Yard play is about 2 KB, far under the 512 KB input bound and the
  API's 5 MB body.
- **Idempotent** by the operation's id, as every operation. A second play of the same seed is a second play and pays.

## 4. Replays, practice and resume

- **Replays pay like a first play.** Both games can be played any time from her career, at the current season's stage
  (the Yard with the season's focus); the tree and the caps are the ceiling, not the plays. Playing never moves the
  calendar ([03](03-careers.md) §3).
- **Practice** is graded and pays nothing. A career's rule card offers it before the first play; outside a career
  (the Hub's two game places) every play is practice. The device grades practice itself with the same
  `settle` and commits nothing; `settle-stage` with `practice: true` answers the grade and pays nothing, leaving the
  career as it was.
- **A finished career** keeps its stages for practice only.
- **The journal** is Dexie's device-only `stageJournal`, one row per open play (`<kind>:<careerId>`, or
  `<kind>:practice`): `{ id, careerId, journal }`. The host writes it on every move and again on `visibilitychange`
  (hidden) and `pagehide`. It is never synced, and a row that doesn't read as a play is dropped.
- **Resume:** reopening the stage replays the journal to where it was. When her deck, bonds or season changed since
  (the config no longer matches), or the rules' version did, the play starts again, saying why. A play that was
  already settled before its row was cleared shows its receipt again instead of paying twice.

## 5. On the device

`apps/web/src/stages/StageHost.tsx` is one full-screen play, `StageHost({ kind, careerId, mode, onExit })`:
- **`mode`:** `career` opens a career's plays (Play pays, Practice doesn't); `practice` offers Practice only. T158 opens
  it with `mode: 'career'` for the season's stage; the Hub's Training Yard and Furlong Hand places open it as practice
  today, borrowing her most recently started running career when there is one (its deck, and for Furlong Hand her
  build and her next race).
- **The rule card:** the game's one verb and one sentence (`views.ts`), what a play pays at A, and Play and
  Practice (pays nothing). A game may say its score in words on the result card (Furlong Hand's "Finished 2nd").
- **The view** loads lazily, one chunk per game (`STAGE_VIEWS`), and draws from the rules' state; the host stamps each
  move's tick, drops an illegal one, and journals the rest.
- **The result:** the grade, the score, the bonus tasks, the pay (or "Practice pays nothing."), **Play again** and
  Done.
- The screen stays on while playing (the Screen Wake Lock, where the phone has it). Reduced motion keeps every move
  and drops the flourishes. No audio, no timers: every game is turn-based.

## 6. Keeping it balanced: `sim:stages`

`pnpm sim:stages` plays each built game's three bots over 500 seeds and fails unless the bands hold
(`stages/sim.ts`, `scripts/sim/stages.ts`). Seed n plays a typical career's config (`stageSimConfig`): each Uma in
turn, each season's focus in turn (the Yard) or her objectives and URA Finals in turn on the typical career's stats
(Furlong Hand), and the median deck (`pickDecks`) with 0–3 of its cards at bond 80. It reads the private pack when
present (`MASTER_DIR`) and the invented content otherwise (`--synthetic`, which `pnpm test` and `test:ci` run). It
prints aggregates only, and Furlong Hand's length by distance. Furlong Hand's own packet holds it to 3.5–6.5 minutes.

<!-- live:stage-bands -->
| Check | Band |
|---|---|
| Seeds a bot | 500 |
| The competent bot's median grade | A |
| The novice's median grade | C or B |
| The expert's S | 35%–65% of seeds |
| A play at a human pace | 3–7 minutes (the competent bot's median moves); Furlong Hand 3.5–6.5 |
| Pace, Training Yard | 4 s a move |
| Pace, Furlong Hand | 3 s a move |
| Moves a journal may carry | 2,000 |
<!-- /live -->

Each game's results are on its page ([08](08-training-yard.md) §7, [09](09-furlong-hand.md) §10).

## Not built yet

- **The other four games** on this framework: Team Showdown, Fan Festival, Summer Camp and Festival Kitchen, one a
  release ([v3's roadmap](../research/drawing-board/README.md#7-the-roadmap)).
