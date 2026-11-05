# 08 · Training Yard

> **Status: generation 3, built (T155, D384).** The rules, bots and view are T155's; the career screens (T158) open it
> for a season without objectives, and the Hub's Training Yard place opens it as practice until then. The design is
> [M036](../tasks/M036-ura-finale-slice.md) "Training Yard" and [04](../research/drawing-board/04-mini-game-evaluation.md)
> §1.2. The framework it runs on is [07](07-stages.md).

**Merge.** A Triple Town–like yard of Uma face tiles: set each piece down, and three touching pieces of one colour and
frame merge one frame up. It pays the **drills** her tree spends ([05](05-the-build.md) §3), in the colours she merged,
and a little SP.

Code: `packages/domain/src/stages/yard/` (rules and bots) and `apps/web/src/stages/yard/` (the view).

## 1. The yard

- **A 6 × 6 yard and 60 placements.** The play ends after the 60th, or sooner when the yard is full.
- **The piece in hand** is set down on any empty cell with a tap. The next two pieces are shown.
- **Hold:** one piece can be put aside. The first hold takes the next piece into hand; later ones swap the hand with
  the held piece. One hold a placement, as in Tetris, so a play is at most 120 moves.

## 2. Pieces and merges

- **A piece** has a stat colour (Speed, Stamina, Power, Guts, Wit) and a tier, shown as its frame: plain, bronze,
  silver, gold, rainbow.
- **Merging:** a piece set down that joins a 4-connected group of three or more of the same colour and tier merges
  them into one piece a tier up, **on the cell just placed**; the others empty. The new piece merges again if it now
  joins three of its new tier: cascades resolve.
- **Masterclass:** three or more touching rainbows of one colour clear (their cells empty) and pay a Masterclass.
- **Every piece set down pays its Sweat** (tier 0's drills), and every merge pays the tier it makes, in its colour.
  Fatigue pays nothing.

<!-- live:yard-ladder -->
| Tier | Made by | Drills |
|---|---|---|
| Plain | setting a piece down (its Sweat) | 3 |
| Bronze | merging three plain | 4 |
| Silver | merging three bronze | 12 |
| Gold | merging three silver | 36 |
| Rainbow | merging three gold | 108 |
| Masterclass | three rainbows touching (they clear) | 324 |
<!-- /live -->

## 3. The queue

The queue is rolled once from the play's seed: 64 pieces (60 placements, the first in hand, one held and two shown).
- **Fatigue** at its rate, never among the first pieces.
- Otherwise **a colour or a Partner by weight:** each colour by her growth rate, × 1.5 for the season's focus stat
  (Speed, Stamina, Power, Guts and Wit in turn from Junior Spring, [03](03-careers.md) §3; Speed in practice outside a
  career), and each deck card by its real **Specialty Priority** (effect 19).

<!-- live:yard-numbers -->
| Rule | Value |
|---|---|
| The yard | 6 × 6 |
| Placements a play | 60 |
| A colour's weight in the queue | (100 + her growth %) × 2, × 3 for the season's focus |
| A Partner's weight in the queue | 25 × (100 + its Specialty Priority), on the colours' scale × 100 |
| A Partner's lift | 1 tier; 2 at bond 80 or more |
| Fatigue in the queue | 8%, none among the first 4 pieces |
| Three Rests clearing | 2 SP, beyond the grade's pay |
| The target (grade A) | 222 drills scored |
| Rules version | 1 |
<!-- /live -->

With a typical deck, about one piece in seven is a Partner and one in twelve is Fatigue.

## 4. Partners

Each of her six deck cards comes into the queue as a **Partner**, drawn with the card's art.
- **Set down, a Partner takes the colour and tier that merges there:** its own colour (its card's type), at the highest
  tier where it completes a group of three, so a Partner can finish a merge of any tier. Then it **lifts that merge one more
  tier**, or two at bond 80 or more (friendship). A Speed Partner beside two plain Speed pieces makes silver at once, or
  gold when bonded. The lift is capped at rainbow.
- **Friend and Group cards are wild:** they take any colour (the highest tier first, then the biggest group).
- **Where nothing of its colour merges,** a Partner settles as a plain piece of its colour, and a wild one of the
  season's focus colour.

## 5. Fatigue and Rest

- **Fatigue** comes in the queue and is set down like any piece.
- **It drifts:** after every placement, each Fatigue but the one just set down steps one cell toward her highest-tier
  piece (the first in reading order on a tie), to the first empty cell that is closer: north, west, east, then south.
  Where no closer cell is empty it stays.
- **Boxed in** (no empty cell beside it), a Fatigue becomes **Rest**.
- **Three touching Rests clear,** with every Fatigue in the eight cells around them, and pay 2 SP.

## 6. Score, tasks, grade and pay

- **The score** is the drills scored (§2). `p` is the score over the **target**, 222: the competent bot's median, so
  a typical competent play sits at grade A ([07](07-stages.md) §2).
- **Three bonus tasks** (all three lift an A to S):
  1. gold (or better) made in two colours;
  2. no Fatigue left at the end;
  3. every Partner set down joined a merge (at least one set down).
- **The pay** is Training Yard's at A, 200 drills and 30 SP ([12](12-pacing.md) §1), × the grade's multiplier. The
  drills split across the colours **in proportion to the drills scored in each**, so a yard of Stamina pays Stamina
  drills. Rests' SP comes on top. Practice pays nothing.

## 7. The bots and the bands

- **Novice:** a random empty cell, never holding.
- **Competent:** greedy on the immediate merge: the placement that pays the most now, a random one among equals. It
  never holds.
- **Expert:** one ply ahead with the next piece and the hold: each placement of the hand, or of the next piece after a
  hold, worth twice what it pays now plus what the following piece can then pay.

`pnpm sim:stages`, 500 seeds a bot (D384):

| Content | Novice median | Competent median | Expert S | A play |
|---|---|---|---|---|
| Private pack | 0.644 (C) | 1.032 (A) | 53.6% | 58 moves, 3.9 minutes |
| Invented content | 0.658 (C) | 1.045 (A) | 61.4% | 58 moves, 3.9 minutes |

No bot completes all three tasks: the S by tasks is for a player who keeps Partners for merges.

## 8. On the screen

`apps/web/src/stages/yard/YardView.tsx`, DOM and Motion, its own lazy chunk:
- **Pieces are Uma face tiles** (uma-kit's album faces) on the stat colour's ground: **her own face on the season's
  focus colour, and four rivals'** (other Umas, picked by the play's seed) on the others. The frame shows the tier
  (hairline, bronze, silver, gold, a ring of all five stat colours for rainbow), and pips count it too, so colour
  never carries a rule alone.
- **Partners show their support card's art** with a type mark, and a heart once bonded.
- **Fatigue** is the kit's warning mark on a dark tile, and **Rest** its moon. (uma-kit and uma-art have no sweat drop
  or towel mark yet.)
- The top holds the score against the grade ladder (C, B and A marked), the placements left and the tasks; the yard
  and the queue (Now, Next × 2, Hold, and the Hold or Swap button) sit in the bottom of the screen. Every target is
  44 pt or more at 390 × 844, in light and dark.
- Pieces pop in with transform and opacity only; reduced motion keeps the moves without the pop.
