# T088 — Spend Level-Up Tickets before Spark

**Goal:** on the Spark Match start screen, the player spends Training Level-Up Tickets to raise the selected unit's
Training Level without playing, and sees what opened (D213).

Depends on merged T087. Read [M027](M027-training-rebalance.md), D212 and D213,
[Minigame kit — the start screen](../design/minigame-kit.md) and [Training](../design/training.md). Branch from current
`main`, open a PR, and never push to `main`.

## Rules (D213)

- **Where:** the Spark Match start screen, in `MinigameStart`'s `extra` slot (the slot T079 added for partners), for the
  Uma and scenario unit the screen was opened for (D190). Nowhere else.
- **What one ticket does:** `addTrainingExp(TL, exp, n × 1250)` for `n` tickets. That is exactly `n` levels, and the
  unit keeps its progress inside the current level. EXP it carries past TL10 is deposited in the bank with
  `depositTrainingExp` (T087). If that makes a full 1,250, the bank pays a ticket back at once.
- **Limits:** from 1 to `min(owned, 10 − TL)`. It is not offered at TL10 or while that unit has an open Spark run. The
  start screen is resuming in that case, so the control is hidden.
- **Cost:** only the tickets. No Training Ticket is spent, nothing is refunded, and no run is created.

## Screen (390 × 844)

- A **Level-Up Tickets** row under the stake shows `Owned 3 · EXP bank 850 / 1,250` and a stepper.
- A preview reads `TL6 → TL8 · opens 3 nodes`, and a full-width **Use 2 tickets** button follows it. With none owned, the
  row stays visible, disabled, with the hint "Earned from EXP past TL10".
- Confirming shows the same level-up summary a Spark result shows: before and after TL bar, each level crossed, and each
  opened node by name, linking to its Constellation, Inspiration or Extra Stats view (D210). It adds the ticket line
  (`−2 Training Level-Up Tickets`) and any banked EXP.
- **Done** returns to the start screen, which now shows the new TL. **Start** (Spark) stays available below TL10.

## Implementation contract

- One Dexie transaction re-reads the Uma, the item stack and the profile. It refuses without writing if tickets are
  short, the unit is at TL10, a Spark run is open for it, or the count is out of range. It then writes the unit, the
  stack (`−n`), a `training-level-up` item-ledger row, the bank and any regranted ticket, the badge and flair
  reconciliation, and the outbox together. Zustand publishes after commit.
- Evidence id `level-up:<umaId>:<tier>:<fromLevel>.<fromExp>`. A unit's total EXP only rises, so each starting point
  is unique: a retried tap finds its row and never spends twice, and a stale screen reloads instead of spending. No new
  save field is needed.
- Memory-only saves follow the same rules in memory.
- Units TL10 reaches this way earn the TL10 badge facts, like a Spark run.

## Docs

Add the ticket spend to [Training](../design/training.md), the start-screen row to [UX](../design/ux.md), and the
spending source to [Economy](../design/economy.md).

## Tests

- Pure: levels and bank for `n` tickets at TL1, TL8 · 900 (to TL10, 900 banked) and TL9 · 800 with a bank of 600 (TL10,
  bank 1,400 → one ticket back, 150 left).
- Persistence: an atomic success, each refusal writing nothing, and an idempotent retry.
- Screen: the control is hidden while resuming, disabled with no tickets and capped at `10 − TL`.

## Acceptance

- In the browser at 390 × 844 the owner can spend tickets on a TL1 unit, see TL and nodes open, and start a Spark run
  at the new level. The Items count and bank move to match.
- `pnpm lint`, `pnpm test` and `pnpm build` pass, and the main bundle stays under 180 KB gzip.
- This spec is deleted in the same PR, and M027 with it (D104).

## Out of scope

Earning tickets (T087), any other place to spend them, spending on a unit other than the selected one, and a ticket
that is worth anything but one level.
