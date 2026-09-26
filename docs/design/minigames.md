# Minigames

> All numbers are **draft values for tuning**. Names are provisional.

Minigames are the **third pillar** of the game, beside Collection and Racing. They are the only way to raise a
Training Level and the only way to earn a card's stars. There is no other training loop: no turns, no
facilities, no energy, no per-turn RNG (D120).

| Minigame | Raises | Board |
|---|---|---|
| **Spark Match** | Training Level 1 → 10 of the active scenario | match-3 |
| **Bond Recall** | one card by one star, until Friendship Training replaces it (M020) | match-2 memory |

Both are **seeded and replay-stable**: the board comes from `(saveId, umaId, scenarioTier, attemptIndex)`, so
reloading mid-run restores the same board and cannot reroll a friendlier one. Neither uses `Math.random`.

Both are **lazy-loaded routes**. Spark Match reuses the PixiJS bundle that races already pull in; Bond Recall
is DOM and CSS. Neither may push the main bundle past the 180 KB gzip budget.

---

## Spark Match — Training Levels

A 7×8 board of six tile kinds. Five are **character icons assigned to the scenario**; the sixth is **the Uma
you are training**. Swap two adjacent tiles to line up three or more, matches clear, tiles fall, cascades
resolve.

### Scoring

| Event | Points |
|---|---|
| Match of 3 | 30 |
| Match of 4 | 60 |
| Match of 5 or more | 120 |
| Cascade step | × 1.2, compounding |
| Match containing the trainee's own tile | × 2 |

The trainee tile is what makes a run feel like *this* Uma's run, and it is the only tile whose identity
changes between Umas.

### Tiles

Each tile is the character's **whole standing chibi** (T059) in a circle with a thick ring in its **kind's colour**:
red, blue, green, purple and orange for the five cast tiles, and **yellow for the trainee**, beside her gold 2×
marker. The ring and a faint tint of the same colour behind the chibi make a line of three read at a glance, before
faces (D161). A selected tile gets a white ring and a hinted pair a white glow, so neither is mistaken for a tile
colour. Until a chibi arrives, or for a character without one, her icon stands in.

### Levelling

A run ends after **25 moves**. There is no timer: this is played one-handed on a phone. The run's score is
added to the scenario's Training EXP, and levels resolve greedily:

```
targetExp(n) = 1000 + 350 × (n − 1)        n = the level you are leaving, 1–9
```

| Leaving TL | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 |
|---|---|---|---|---|---|---|---|---|---|
| EXP to next | 1000 | 1350 | 1700 | 2050 | 2400 | 2750 | 3100 | 3450 | 3800 |

**Surplus carries over**, and a run can cross more than one level. There is therefore **no failure state** — a
bad run is slow progress, never wasted progress. Reaching TL10 is roughly 8–12 good runs.

Levelling unlocks constellation nodes immediately ([Constellations](constellations.md#unlock-schedule)); the
post-run summary names exactly which nodes opened.

### Cost

**1 training ticket per run** (D148). A day's 10 tickets take about one Uma to TL10, which keeps tickets the pacing
currency they have always been ([Economy](economy.md)).

### Scenario tile sets

Each scenario names **five Uma characters** whose icons are its tiles, authored as private content beside
`flair.json` and themed on that scenario. The trainee's icon is the sixth at runtime. If a tile character is
missing from the pack the scenario falls back to the next available starter, and the import warns.

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
