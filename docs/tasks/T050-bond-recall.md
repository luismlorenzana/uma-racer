# T050 — Bond Recall

The match-2 memory minigame that limit breaks a card. Full rules:
[Minigames — Bond Recall](../design/minigames.md#bond-recall--card-limit-breaks).

## Fixed choices

- **Board size** depends on the limit break being left:

  | Leaving | Pairs | Grid | Mismatches allowed |
  |---|---|---|---|
  | LB0 → LB1 | 6 | 3 × 4 | 10 |
  | LB1 → LB2 | 8 | 4 × 4 | 12 |
  | LB2 → LB3 | 10 | 4 × 5 | 14 |
  | LB3 → LB4 | 12 | 4 × 6 | 16 |

- **Faces:** the six cards of the active scenario's card set first, then filler taken deterministically from
  the player's other owned cards, ordered by id. Fewer than `pairs` owned cards repeats the set rather than
  failing.
- **Input:** flip two tiles. A match stays face up. A mismatch flips both back after 700 ms and spends one of
  the mismatch budget.
- **Win:** every pair matched within the budget → the card advances one limit break.
- **Loss:** the budget is exhausted → the run ends with no advance. The ticket is still spent.
- **Cost:** 10 tickets, spent by `beginRun` before the first flip.

## Implementation contract

```
apps/web/src/game/minigames/bond-recall.ts        pure engine, no React
apps/web/src/game/minigames/bond-recall.test.ts   fixed-seed fixtures
apps/web/src/screens/minigames/BondRecallScreen.tsx
```

DOM and CSS, not PixiJS: 24 tiles with a flip transform do not need a renderer, and staying out of PixiJS
keeps this route's chunk small.

Tiles show **card art**, so use the existing `content.art.load('card', id)` path with the icon as the instant
fallback — the same tier system the albums use. A tile whose art has not arrived shows its icon, never a
placeholder box.

The result screen shows the card advancing: LB pips filling, the node multiplier moving (0.60 → 0.70, and so
on), and what that is worth in the constellation. Reaching LB4 shows the Card Select Coupon award.

## Tests

- Fixed-seed layouts: same seed, same face positions.
- Face selection prefers the active card set, then fills by owned-card id order, then repeats.
- A mismatch decrements the budget exactly once, even if the player taps during the flip-back.
- Exhausting the budget ends the run with `cleared: false` and no advance.
- `commitRun` called twice with one `runId` advances the card once.

## Out of scope

Choosing which card to play against — that entry point comes from the Cards album and can be stubbed with a
picker. Do not touch save schema, domain, or the constellation.
