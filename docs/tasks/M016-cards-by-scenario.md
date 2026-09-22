# M016 — Cards by scenario

> Owner: Claude, end to end (the owner's call on 2026-09-22; ChatGPT is on minigame improvements).

## Why

The training rework moved a card's power into the scenario (D120, D125–D127), but every card surface still
presented the original game's model: an account-wide level and limit break, generated effects that died with the
training turn, and a ticket-priced **Limit Break** button that skipped Bond Recall and broke the card in its *own
era's* scenario. Bond Recall itself was reachable only from a bottom sheet inside the Cards album, and nothing in the
Training loop linked to it. The owner could not find a way to upgrade a card.

The milestone applies one rule everywhere: **a card is owned account-wide; its power belongs to a scenario.**

| | Collection (account-wide) | Scenario (per tier, shared by every Uma there) |
|---|---|---|
| What | owning the card | its **Bond 0–4**, which sets it is in, which nodes it fills |
| Earned by | tickets, or a Card Select Coupon | Bond Recall clears |
| Shown in | Cards tab · Collection lens, card page | Training scene · Card set, constellation, Cards tab · scenario lens |

## Fixed choices

- **"Limit break" is called Bond on screen** (Bond 0–4, "Max bond"), and **card level is gone** — it was only ever
  `5 + 5 × LB`. Save fields keep their names; no migration.
- **Tickets unlock cards**: `cardUnlockCost(era) = 25 + 5 × era`. Card Select Coupons stay, as free-unlock vouchers.
- **Replacing a card in a set hands its nodes to the new card**; removing one empties them.
- Every way into Bond Recall names a card **and** a scenario, and carries a `return` path.

## Parts

Each part is deployed on its own.

| Part | Scope |
|---|---|
| **A** | Training scene with **Constellation · Card set** tabs; the card set rebuilt in Paddock with bond, per-node pay, nodes held and a **Bond** button per slot; Bond Recall entry/exit (`uma`, `return`, faces from the launching set, no tier-less picker, Bond again); bond pips in the constellation node sheet and the profile; the ticket limit-break path removed |
| **B** | Card page `/cards/:cardId`; unlock with tickets or a coupon; `card-unlock` ledger reason on the client **and** the API validator (D128); `/cards/redeem` folded in |
| **C** | Cards tab lens row (Collection + one chip per unlocked scenario); lens-aware tiles, facets, sorts, compare; Bond button in the reserved detail area; the card picker on the scenario lens |
| **D** | Legacy sweep: generated effects, level, broad-support facility copy and dead domain code; design docs, decisions, badge wording; this spec deleted (D104) |

## Acceptance

- From a started scenario, a card can be bonded in two taps from the profile, the Training scene, or the Cards tab,
  and every run returns to where it was launched.
- No screen shows a card level, a generated Training/Friendship/Hint/Stat/Initial-Stats effect, or a ticket-priced
  limit break.
- An unowned card can be unlocked with tickets or a coupon from its page, and the ledger row syncs (API test).
- `pnpm lint`, `pnpm test`, `pnpm build` green; verified at 390 × 844.

## Out of scope

Bond Recall's board, rules and visuals (ChatGPT's minigame work), Spark Match, and new badge criteria.
