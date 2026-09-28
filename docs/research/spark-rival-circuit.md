# Spark Rival Circuit: Puzzle-Battle Research and Direction

Research and implementation direction for replacing Spark Match's adjacent-swap board with a battle puzzle inspired by
*Puzzle & Dragons*. The resulting game keeps Uma Racer's own progression, vocabulary and content boundaries; it does not
copy Puzzle & Dragons' collection, economy or late-game counter mechanics.

> **Decided 2026-09-26:** use a four-strategy advantage ring, three-rival runs, partial Training EXP on a loss, a
> deterministic action replay, and a PixiJS board/battle renderer under a React HUD (D169–D172). Delivery is M022.

## Why the current Spark Match needs a replacement

The current 7×8 game is a conventional adjacent swap:

- tap one tile, tap a neighbour;
- a move is accepted only when it immediately makes a match;
- invalid swaps are free;
- repeat for 25 accepted moves;
- score has no opponent, risk or tactical identity beyond a double-value trainee tile.

That is serviceable progression plumbing, but it does not make the player feel as though an Uma is training against
anyone. It also asks for many isolated local optimisations rather than letting one movement reshape the whole board.

Puzzle & Dragons identifies its own distinguishing feature as match-3 **without the limit of one movement**. Its official
tutorial catalogue separates attributes and orbs, team building and dungeon types, while its battle material combines
attribute attacks, multiple battles, skills and enemy actions. Timed modes also tie free orb movement, Heal Orbs and combo
score together. Those are the transferable ideas; the monster collection and economy are not.

## What Uma Racer should borrow

| Puzzle-battle idea | Uma Racer adaptation | Why it fits |
|---|---|---|
| Move one orb through many spaces | Drag one orb across a 6×5 board; every entered cell swaps with it | The defining skill expression; genuinely different from Candy Crush |
| Attribute attacks | Front, Pace, Late and End strategy orbs | Uses vocabulary every Uma already owns |
| Heal orbs | Recovery restores temporary **Drive** | Creates survival decisions without a persistent energy resource |
| Active skills | Spark matches charge one universal **Spark Shift** | Adds timing and orb conversion without hand-authoring hundreds of skills |
| Dungeon waves | Two training rivals, then a boss rival | Gives a run an arc while keeping it phone-sized |
| Enemy countdown and intent | Rivals telegraph pressure, guard, conversion or a style change | A loss is readable and planning matters |
| Combos and cascades | All matches resolve after release; skyfalls can add cascades | Rewards planning the whole board rather than finding one swap |
| Fixed teams/boards for fair modes | Seed plus action log reproduces the exact run | Reloading cannot reroll a better board or rival script |

## What should stay out

- No monster team, helper leader or friend system. The trainee is the player character; support cards already have their
  own progression game in Friendship Training.
- No second stamina currency, dungeon keys, continues or paid revives. One Training Ticket is still one run.
- No drops, evolution materials, fusion fodder or alternate acquisition path. Collection remains tickets and coupons.
- No damage absorption/void, resolve chains, awoken binds, roulette spam or a growing list of required counters. Version 1
  gets a deliberately small rival-action vocabulary.
- No real race wins, Uma EXP, race records or strategy badges from a sparring battle. Racing owns all of those facts.
- No copied assets, names, formulas or encounter data. Real Uma identities live only in the private content pack.

## Attribute model

Uma Racer has four first-class running strategies. Forcing them into the source game's three-element triangle plus a
Light/Dark pair would either invent a fifth strategy or collapse Late and End into one colour. The cleaner model is a
four-way ring:

```text
Pace ──beats──► Front ──beats──► End ──beats──► Late ──beats──► Pace
```

- **Pace beats Front:** it sits on the leader and applies pressure.
- **Front beats End:** it creates separation before the deepest closer launches.
- **End beats Late:** it owns the stronger last move.
- **Late beats Pace:** it catches the tracking group after conserving its run.
- Neighbouring styles use advantage/resistance; the two opposite matchups are neutral.

The board has six orb kinds:

| Orb | Match result |
|---|---|
| Front · Pace · Late · End | Damage in that style, scaled by the trainee's strategy aptitude and the rival matchup |
| Spark | Neutral damage and charge toward Spark Shift; the orb carries the trainee's icon |
| Recovery | Restore Drive; surplus recovery has no hidden conversion |

Colour never carries the distinction alone: every orb also has a strategy glyph and short accessible label.

## One run

1. `beginRun` spends one ticket and fixes the seed, active scenario and attempt.
2. The run selects two ordinary rivals and one boss from that scenario's authored private roster.
3. Each player turn moves one orb. Planning before touching is unlimited; the movement clock begins on the first cell
   transition. Release or timeout resolves the path.
4. Matches clear simultaneously, cascades fall, style attacks and recovery resolve, then the rival countdown advances.
5. A rival at countdown zero performs its telegraphed action and resets its countdown.
6. Emptying Resolve advances the wave. Emptying Drive, or failing to finish a wave inside its turn bound, ends the run.
7. Damage progress, wave clears, combos and the final clear contribute Training EXP. A loss banks what was earned; a
   clear remains substantially more efficient.
8. `commitRun` replays the stored actions, applies Training EXP once, and names every Training Level and constellation
   node opened.

The T071-pinned baseline is a 6×5 board, a seven-second movement clock, three waves and at most eight player turns per
wave. T074 may move those numbers only with the simulator, matching design updates and the domain pinning test.

## Rival vocabulary

Version 1 keeps enemy rules legible:

| Action | Meaning |
|---|---|
| **Pressure** | Reduce Drive by the shown amount |
| **Guard** | Reduce the next turn's damage unless the shown combo threshold is met |
| **Convert** | Change a bounded set of one orb kind into another |
| **Delay** | Add the displayed amount to Spark Shift's remaining charge requirement |
| **Enrage** | Permanently strengthen later Pressure after a visible trigger |
| **Change style** | Switch primary strategy, weakness and resistance at a health threshold |

The four base rival archetypes are Rush (Front), Tracker (Pace), Surge (Late) and Finisher (End). An encounter definition
chooses a checked-in recipe; a rival's opening strategy comes from her template and an adaptive recipe may change it in a
later phase. Exact Resolve, Pressure, countdowns and EXP budgets come from scenario tier and Training Level bands, not the
source game's race stats; race balance must never alter a puzzle battle accidentally.

## Private encounter content

`content/overrides/spark-rivals.json` is the local-only authored input. It names each scenario's eligible rivals and bosses
by private Uma template id plus semantic behavior. The importer resolves those ids, rejects missing/self-duplicate lineups,
and emits a hashed `spark-rivals` pack beside the other content packs. Nothing from that file or the source dataset goes in
git.

Checked-in code contains only the schema, behavior vocabulary, aggregate validation and small synthetic fixtures. If an
older or incomplete content publication lacks the pack, the client deterministically composes a safe lineup from the
already-loaded Uma catalogue, excluding the trainee's character, and reports a diagnostic. Production publication is not
complete until all fourteen authored rosters validate; the fallback prevents another dead-end screen, not a permanent
substitute for authored encounters.

## Determinism and reloads

The engine is a pure reducer:

```text
state = replay(encounter, seed, actions)
```

A drag action stores its ordered board-cell path and measured movement duration. Paths may revisit cells; every consecutive
cell must be adjacent, including diagonals, and the controller fills cells skipped by a fast pointer sample with one fixed
grid traversal. Spark Shift is a separate action. The engine owns all seeded skyfalls and rival choices. It never reads the
clock, DOM, PixiJS or `Math.random`.

The device-local `minigameRuns` row holds a versioned, bounded action list. Each completed turn appends under an expected
action count in one Dexie transaction, which prevents two stale screens from writing the same turn. A reload replays to the
exact board, wave, Drive, Resolve and gauges. An interrupted drag is presentation-only and restores the start of that turn.
The row is never synced and the cloud save schema does not change.

## Rendering and touch direction

Pure TypeScript describes the game, not its presentation. The production scene is hybrid:

- **PixiJS 8:** the 30 board sprites, held orb, falls, matches, pooled particles, attacks, rival reaction and damage text.
- **React DOM:** header, gauges, intent, buttons, tutorial copy and result summary.
- **Canvas Pointer Events:** one captured pointer drives the path; no React state update runs per `pointermove`.

The held orb follows the finger with a small upward offset, while displaced orbs slide into its previous cell. The canvas
uses `touch-action: none`, captures the active pointer, handles `pointercancel` and `lostpointercapture`, and ignores a
second touch. The renderer consumes engine-produced resolution steps after release. It pools sprites and effects, caps its
resolution to the useful source-art density, pauses while hidden, and uses elapsed milliseconds rather than frame counts.

T071 proves this interaction with synthetic art before the content and persistence work proceed. T074 closes physical
iPhone feel; desktop emulation cannot prove finger occlusion, Safari frame pacing or accidental system gestures.

## T071 measured baseline

`pnpm sim:spark` runs fixed synthetic encounters at scenario tiers 1, 7 and 14; Training Levels 1, 5 and 9; all four
base rival archetypes; two aptitude profiles; and twelve seeds per cell. The landed baseline measured across 864 runs per
agent:

| Agent | Clear rate | Combos / drag | Clear EXP | Loss EXP |
|---|---:|---:|---:|---:|
| Random legal | 0% | 0.32 | — | 91 |
| Greedy | 70% | 2.89 | 2,196 | 853 |
| Planner | 80% | 3.05 | 2,197 | 850 |

The planner's median wave clear is five drags, inside the target five-to-seven range, and no loss exceeds the 877 EXP
cap. Individual twelve-seed cells remain noisy: Guard at the highest tier is the hardest row and some early Finisher rows
are effectively solved. That spread is recorded rather than hidden; T074 owns balance retuning after real-device play.
The browser proof fits without page scroll at 390×844 and 375×667, keeps 30 board sprites and 24 effects bounded, and
records zero React updates from pointer movement. Its [mid-drag](../proofs/T071-spark-rival-mid-drag.jpg) and
[cascade](../proofs/T071-spark-rival-cascade.jpg) captures use only synthetic presentation.

## Delivery recommendation

M022 is four sequential units:

1. **T071 — engine, simulator and touch proof:** implemented; browser proof complete, physical-iPhone acceptance pending.
2. **T072 — private rival content:** author and publish the data boundary with a non-blocking fallback.
3. **T073 — production route and save wiring:** replace the old game, journal actions and commit replayed outcomes.
4. **T074 — balance and device closure:** tune the full matrix, profile the iPhone and finish feedback/accessibility.

Friendship Training (M020) landed before M022. It keeps its own game and reward plus its frozen setup and saved choices;
T073's generic action journal must absorb those rows or stay compatible with them instead of migrating a run twice.

**Outcome (2026-09-28):** all four landed, and M023 then moved both minigames onto one engine home, journal and screen
shell ([Minigame kit](../design/minigame-kit.md)). The measured balance is D187 and
[Minigames](../design/minigames.md#spark-match--rival-circuit); the physical-iPhone pass waits in T038 (D189).

## Sources

- [Puzzle & Dragons — About](https://www.puzzleanddragons.us/about)
- [Puzzle & Dragons — Tutorials](https://www.puzzleanddragons.us/tutorials)
- [Puzzle & Dragons — 4-Player Mode battle rules](https://www.puzzleanddragons.us/single-post/4-player-mode-pvp-arrives-231115)
- [Puzzle & Dragons — timed Fever Mode rules](https://www.puzzleanddragons.us/single-post/summer-emdra-fever-2606)
- [PixiJS 8 — Events and interaction](https://pixijs.com/8.x/guides/components/events)
- [PixiJS 8 — Ticker](https://pixijs.com/8.x/guides/components/ticker)
- [MDN — Pointer capture](https://developer.mozilla.org/en-US/docs/Web/API/Element/setPointerCapture)
- [Game-like Web Tech on iPhone](game-web-tech.md)
