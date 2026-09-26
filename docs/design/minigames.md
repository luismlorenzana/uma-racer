# Minigames

> All numbers are **draft values for tuning**. Names are provisional.

Minigames are the **third pillar** of the game, beside Collection and Racing. They are the only way to raise a
Training Level and the only way to earn a card's stars. There is no other training loop: no turns, no
facilities, no energy, no per-turn RNG (D120).

| Minigame | Raises | Board |
|---|---|---|
| **Spark Match — Rival Circuit** | Training Level 1 → 10 of the active scenario | continuous-drag puzzle battle |
| **Bond Recall** | one card by one star, until Friendship Training replaces it (M020) | match-2 memory |

Both are **seeded and replay-stable**. Spark Rival Circuit is a pure replay of its encounter, seed and persisted
actions; Bond Recall's board comes from `(saveId, target, attemptIndex)`. Reloading mid-run restores the same state and
cannot reroll a friendlier one. Neither uses `Math.random`.

Both are **lazy-loaded routes**. Spark Match loads its own PixiJS scene under the existing route; Bond Recall is DOM and
CSS. Neither may push the main bundle past the 180 KB gzip budget.

---

## Spark Match — Rival Circuit

Spark Match is a three-wave sparring battle, not a race. Move one orb through many cells, build several matches in one
path, and use their strategy advantage to break a rival's **Resolve** before her pressure empties the trainee's
temporary **Drive** (D169). Two training rivals lead to one boss rival.

The public name remains **Spark Match**; **Rival Circuit** distinguishes this ruleset from the retired adjacent-swap
game. It remains the only way to raise the active scenario's Training Level.

### Board and movement

The board is **6 columns × 5 rows** with six orb kinds:

| Orb | Match result |
|---|---|
| Front · Pace · Late · End | Damage in that running strategy |
| **Spark** | Neutral damage and charge for **Spark Shift**; carries the trainee's icon |
| **Recovery** | Restore Drive, up to the run maximum |

Press an orb and drag it through the board. Entering an orthogonally **or diagonally** adjacent cell swaps the held orb
with the orb there. A path may revisit a cell. Planning before touching is unlimited; a **seven-second movement clock**
begins on the first cell transition. Releasing or timing out fixes the path and resolves every horizontal or vertical
line of three or more, then refills and resolves cascades until the board is stable.

The initial board is a seeded, match-free shuffle with exactly five of each orb. Refills are uniform seeded draws. A drag
path is bounded to 256 cells and a resolution to 64 cascade steps; reaching the path cap resolves like timeout, while a
cascade-cap breach is an engine error caught by tests/simulation rather than silently truncating a turn.

Fast pointer samples may cross more than one cell. The controller expands them through one documented, deterministic
grid traversal before it sends the path to the engine. A cancelled or interrupted pointer restores the pre-turn board,
costs no turn and writes no action. Only one pointer may own a drag.

### Strategy advantage

The four running strategies form one ring:

```text
Pace ──beats──► Front ──beats──► End ──beats──► Late ──beats──► Pace
```

An advantaged attack deals **1.5×**, a resisted attack **0.67×**, and either opposite-style matchup **1×**. Spark
damage is always neutral. Strategy aptitude modifies only that strategy's attack; the draft scale is S 1.10, A 1.00,
B 0.95, C 0.90, D 0.85, E 0.80, F 0.75, G 0.70. This is a puzzle-battle reading of aptitude and has no effect on the
race engine.

Every orb also has a glyph and accessible label. Colour is never the only carrier of strategy or state.

### Turn resolution

The engine resolves one accepted drag in this order:

1. Find all matches on the released board and clear them simultaneously.
2. Apply gravity, fill from the run's seeded stream, and repeat until no cascade remains.
3. Total each attack style, Recovery and Spark charge. One connected match is one combo; all cascades count toward the
   same turn's combo multiplier.
4. Apply attacks in Front, Pace, Late, End, then Spark order; a defeated rival cannot act.
5. Apply Recovery, capped at maximum Drive, and charge Spark Shift.
6. Advance the rival countdown. At zero, execute the already displayed intent and reset its countdown.
7. Check victory, loss and the **eight-player-turn bound for the current wave**.

The first simulator baseline is below. These are checked-in tuning constants, not private content fields. `pnpm sim:spark`
pins them in T071 and T074; any change follows AGENTS.md's design/decision/domain-test rule.

| Constant/formula | Draft value |
|---|---|
| Maximum Drive | 100 |
| Match shape | `1 + 0.25 × (orbs − 3)` |
| Whole-turn combo | `1 + 0.20 × (combos − 1)` |
| Style attack per match | `round(40 × shape × combo × aptitude × matchup)` |
| Spark attack per match | `round(30 × shape × combo)` |
| Recovery per match | `round(6 × orbs × combo)` |
| Spark charge | cleared Spark orb count; ready at 9 |
| Delay | +3 remaining requirement; ready threshold capped at 15 |
| Difficulty factor | `1 + 0.01 × (tier − 1) + 0.015 × (TL − 1)` |
| Wave Resolve | `round([500, 650, 900][wave] × difficulty)` |
| Base Pressure | `round([12, 16, 24][wave] × difficulty)` before recipe modifiers |

### Spark Shift

Spark matches fill one visible run-scoped gauge. At full charge, **Spark Shift** is a separate player action: it converts
every Spark orb currently on the board into the trainee's highest-aptitude strategy orb. Ties use Front, Pace, Late, End
order. The converted board does not resolve until the next drag, so the player still has to route it. Shift never consumes
a turn or permits a second drag, and rival **Delay** may add charge to the remaining requirement but cannot empty earned
charge.

### Rivals and intent

Every rival shows portrait, name, primary strategy, current/max Resolve, countdown and next intent before the player
touches the board. Four base archetypes make the first read predictable: **Rush** (Front), **Tracker** (Pace), **Surge**
(Late) and **Finisher** (End).

| Intent | Contract |
|---|---|
| **Pressure** | Remove the displayed amount of Drive |
| **Guard** | Reduce the next turn's damage unless the displayed combo threshold is met |
| **Convert** | Change a displayed, bounded orb kind into another using seeded cell order |
| **Delay** | Add the displayed charge requirement to Spark Shift |
| **Enrage** | Permanently increase later Pressure after the displayed trigger |
| **Change style** | Change strategy, weakness and resistance at a Resolve threshold |

Private candidates choose one checked-in recipe; their opening strategy is the template's stable best strategy. The four
style recipes require a matching best strategy, while adaptive/boss accept any:

| Recipe | Script |
|---|---|
| `rush-pressure` (Front) | countdown 2; Pressure; below half, Enrage once to ×1.5 later Pressure |
| `tracker-guard` (Pace) | countdown 3; Guard by 50% unless 4 combos, then Pressure, repeat |
| `surge-convert` (Late) | countdown 2; convert up to 4 orbs that beat it into its own style, then Pressure, repeat |
| `finisher-delay` (End) | countdown 3; Delay +3, then ×1.5 Pressure, repeat |
| `adaptive-duel` | countdown 2; Pressure; below half, change once to resist trainee's best strategy |
| `circuit-boss` | countdown 2; Guard → Convert → Pressure; one adaptive phase below half |

Intent has no hidden target selection. A status must be visible on the rival or gauge for its entire lifetime. A wave ends
immediately at zero Resolve. A run ends in a loss at zero Drive or when the eighth player turn finishes without clearing
the wave; no ninth drag begins.

### Training EXP and levelling

Wave EXP budgets are **500 / 650 / 800**. An uncleared wave pays
`floor(budget × Resolve removed / max Resolve)`; clearing pays that wave's exact budget. A full circuit adds 50, plus
`min(100, 10 × max(0, total combos − completed drags))`, plus up to 100 proportional to Drive remaining. A loss gets
no bonuses and is capped at 45% of the 1,950 wave-budget total. This prevents a high-Resolve rival, healing or stalling from
being an unintended EXP farm and makes a full clear substantially more efficient than repeatedly losing late.

The draft balance target is **about 2,200 Training EXP for a competent three-wave clear**, with losses retaining only the
bounded progress actually earned. Training EXP resolves greedily and surplus carries:

```
targetExp(n) = 1000 + 350 × (n − 1)        n = the level you are leaving, 1–9
```

| Leaving TL | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 |
|---|---|---|---|---|---|---|---|---|---|
| EXP to next | 1000 | 1350 | 1700 | 2050 | 2400 | 2750 | 3100 | 3450 | 3800 |

The full TL1→10 curve is 21,600 EXP, so the target remains roughly **ten good clears**. A run can cross more than one
level. A loss is real—the encounter ends—but the ticket is not made worthless because partial EXP is still committed.
At TL10, a run cannot be started for that Uma and scenario.

Levelling unlocks constellation nodes immediately ([Constellations](constellations.md#unlock-schedule)); the
post-run summary names exactly which nodes opened.

The result first states **Circuit cleared** or the loss reason, then shows EXP earned, before/after Training Level and bar,
every level crossed, and every newly opened constellation node **by its real name**. Each opened node links back to that
Uma's constellation.

### Cost and rewards

**1 training ticket per run** (D148). A day's 10 tickets take about one Uma to TL10, which keeps tickets the pacing
currency they have always been ([Economy](economy.md)).

Training EXP and node unlocks are its only progression outputs. Rivals are sparring partners: a run never grants Uma EXP,
finishes a career goal, creates a race record, pays a race ticket, or advances race badges and milestones.

### Encounter content

Each of the fourteen scenarios has an authored private roster of eligible ordinary rivals and bosses. The gitignored
input is `content/overrides/spark-rivals.json`; the content pipeline resolves its private Uma template ids and emits a
hashed `spark-rivals` pack. Definitions choose an archetype, intent script and optional phase-two strategy. Resolve,
Pressure and EXP budgets come from checked-in tier/TL curves so private content cannot silently change balance.

The importer rejects missing ids, an encounter with the trainee as its own rival, duplicate rivals in one run, a scenario
without enough eligible rivals, unknown intents and a boss with no complete script. Checked-in fixtures are small and
synthetic. A production publication is incomplete until every scenario validates.

If an older publication has no rival pack, the client deterministically composes two rivals and a boss from the loaded
Uma catalogue, excluding the trainee's character, and records a diagnostic. The fallback must start a playable run; it is
not permission to check original-game data into git or to skip publishing the private roster.

### Determinism, journal and commit

The pure engine contract is:

```text
state = replay(encounter, seed, actions)
```

A drag action stores its ordered cell path and movement duration clamped to the allowed clock; Spark Shift is its own
action. The engine owns initial fills, skyfalls, seeded conversions and rival choices. It has no React, PixiJS, DOM, wall
clock or `Math.random` dependency.

The device-local `minigameRuns` row carries an engine version and an action list bounded to 64 entries. Each action appends in one Dexie
transaction under the expected prior action count, so two stale screens cannot both advance a run. Reload replays the
same board, wave, Drive, Resolve, gauges and intent. `commitRun` replays that stored journal and computes Training EXP; it
does not trust a score supplied by the screen. Completion remains idempotent by `runId`. The journal does not sync and
does not change the cloud save schema.

An open run created by the retired adjacent-swap version keeps its reservation, ticket and seed, but starts Rival Circuit
with an empty action list. It is never charged again. Already completed rows remain historical records.

### Presentation and touch

The route is `/minigames/spark-match/:umaId` and remains lazy. Presentation is hybrid:

- **PixiJS 8** owns the 30 orb sprites, held orb, swaps, clear/fall/cascade sequence, pooled particles, attacks, rival
  reactions and damage/recovery numbers.
- **React DOM** owns navigation, wave label, Drive/Resolve/Spark gauges, strategy and intent, tutorial, accessible live
  announcements and result actions.
- **Pointer Events** on the canvas own one active drag using `setPointerCapture`; the canvas uses `touch-action: none`,
  ignores a second pointer, handles `pointercancel` and `lostpointercapture`, and does not set React state on each move.

The held orb is drawn slightly above the finger; displaced orbs slide into the previous cell. Resolution animation follows
steps already produced by the engine and temporarily locks input. Sprites and effect objects are pooled, canvas resolution
is capped to useful art density, the ticker pauses when hidden, and all movement uses elapsed milliseconds. The target is a
stable 60 fps on the owner's iPhone, with 120 Hz presentation where Safari supplies it; game results never depend on refresh
rate. Reduced motion shortens travel and removes nonessential particles without removing board-state feedback.

At 390 × 844 the entire run has no page scroll, the board remains square-celled, HUD and board avoid the safe areas, and
every DOM control is at least 44 pt. Physical-device validation must cover finger occlusion, edge/system gestures, pointer
cancellation, background/resume and sustained frame pacing; browser emulation alone is not acceptance.

---

## Bond Recall — card stars

Pick one owned card **and one scenario**, then clear a grid of face-down tiles by matching pairs. A full
clear gives that card **one star in that scenario** (D127, D147).

A card can be trained in any scenario its era allows that some Uma has unlocked. Every way in names the card, the
scenario and where to return to (M016): a **Bond** button on each slot of the Training scene's Card set tab and
beside each card in a constellation node's sheet, and the Cards album. A run with no card redirects to the album;
there is no scenario-less picker. After a run, **Bond again** starts the next one and **Done** goes back.

### Board

One board per star being earned, growing with the card:

| Earning | Pairs | Grid | Mismatches allowed |
|---|---|---|---|
| 1★ | 6 | 3 × 4 | 10 |
| 2★ | 8 | 4 × 4 | 12 |
| 3★ | 9 | 3 × 6 | 13 |
| 4★ | 10 | 4 × 5 | 14 |
| 5★ | 12 | 4 × 6 | 16 |

Tile faces are the **cards of the set the run was launched from** (else the first set anyone holds in that
scenario), then filler drawn deterministically from the player's other owned cards. Running out of mismatches ends the run without an advance — this one has
real stakes, which is why it is the shorter game.

### Presentation

Tiles are **cards**: the full illustration at its own 3:4 shape, never cropped, so a face is recognisable at a glance
and tiles can stay small. The board measures the space it is given and uses the largest tile that fits, capped at
88 pt wide, so a 4 × 6 board fits a 375 × 667 phone (54 × 72 pt tiles) and a 3 × 4 board never balloons (88 × 117 pt).
The board sits centred in that space, so it can never push the status line off screen or squash its own rows.

- **Backs** carry a gold inlay and a ✦ emblem on a lattice, on a felt-dark table; flips turn in 3D perspective.
- **States:** a first pick gets a gold ring; a missed pair shows red rings until it turns back; matched cards glow gold
  and carry a ✓.
- The **card being bonded** leads the start screen as full art and sits beside the verdict on the result screen.
- Cards with no published illustration show their icon and name on the face instead.

### Stars, not levels

Card levels and card EXP are deleted (D120, D130): a card has one number per scenario, its **stars**, 0★ to 5★
(D147). Reaching 5★ grants the one-time **Card Select Coupon**; a star pays no tickets (D148).

Stars are what scale a card node's contribution ([Constellations](constellations.md#what-a-card-node-pays)), so the
card minigame is the direct path from "I own this card" to "this card is worth slotting".

### Cost

**1 training ticket per run**, win or lose (D148).

---

## What this replaces

Deleted outright, with the save fields that carried them:

- The training turn: the deterministic card deal, facility choice, gain formula, crowd and friendship
  multipliers, and the 1200 soft-cap halving on gains.
- Skill hint rolls. Skills now come from node assignments ([Constellations](constellations.md#skills)).
- Card EXP and the 1–25 level curve.
- Scenario modifiers as training-gain multipliers. A scenario's identity is now its cap profile, its
  constellation shape and slot count, and its buff ([Scenarios](scenarios.md#scenario-buffs)).
