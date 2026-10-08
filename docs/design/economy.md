# Economy

> All numbers are **draft values for tuning**.

## Currencies at a glance

**Active Puzzle economy (D287–D290):** free battles earn scenario/style materials. Matching rewards repay legacy
debt before entering nonnegative global Items; a CL step spends one eligible source-A material. Preserved universals
are separate **Legacy Universal CL Tickets**. Final conversion pools unapplied EXP once at1,250 per universal plus
one positive account fraction; no new gameplay mints them. Credit bypasses debt. Paid old Spark refunds retain their
original cost and D177 daily-cap bypass. Friendship and racing promotion still use daily Training Tickets.
[Exact conversion/recovery](../technical/uma-puzzles-implementation.md#t115-implemented-preservation-v2-d287).

**Training Tickets are the only currency** ✅. Coupons and shards are collection items, not currency.

| Item | Earned by | Spent on | Expires? |
|---|---|---|---|
| 🎫 **Training Tickets** | Daily grant · Uma Level-ups | Friendship Training · unlocking the next scenario | Never |
| 🎟️ **Card Select Coupon** | A card's first 3★ | Unlocking any unowned SSR card, the only way to own one (D198) | Never |
| 💎 **Uma Shard** | An Uma reaching a gate level (10, 20, 30…) | 5 shards → 1 Uma Select Coupon | Never |
| 🎟️ **Uma Select Coupon** | 5 Uma Shards | Any unowned Uma | Never |
| **Scenario/style CL ticket** | Free Puzzle wins, after matching debt | One eligible CL step or unlocked same-style adjacent-scenario exchange | Never |
| **Legacy Universal CL Ticket** | Preserved stock plus one-time pooled unapplied EXP conversion | One explicitly selected CL step | Never |

**Two separate collection paths** ✅: **leveling Umas earns more Umas**, and **leveling cards earns more cards**.
Card coupons never come from Umas, and Uma coupons never come from cards. Details are in [Collection](collection.md).

## 🎫 Training Tickets

**One ticket is one Friendship Training run** (D148). Uma Puzzles entry/retry is free.

### Earning

These are the **only** sources ✅:

| Source | Amount |
|---|---|
| Daily grant | **+15 per day**, accruing while you're away |
| Uma Level-up (from race EXP) | **+1** |

A card's star pays nothing: its run already cost one ticket, and the star is the reward. There are **no login streaks**,
and badges, achievements, and goals don't pay tickets ✅.

**Storage cap (60, four days):** the cap only stops the **daily grant** from accruing, so you can skip up to four days
and spend them at once. Tickets earned by leveling Umas are always added, even above 60, so nothing earned is ever
lost.

### Spending

| Use | Cost |
|---|---|
| [Uma Puzzles](uma-puzzles.md) entry/retry | **free** |
| A [Friendship Training](minigames.md#friendship-training--card-stars) run — earns a card's star | **1** |
| Unlocking the next scenario | **5 × fromTier** |
| **Reconfiguring a constellation** | **free, always** |

| Unlock next scenario | 1 → 2 | 5 → 6 | 10 → 11 |
|---|---|---|---|
| Cost | 5 | 25 | 50 |

A star has no separate price: the run *is* the star, and a lost run costs its ticket without advancing (D146).
Reconfiguring is free on purpose — charging for it would make players hoard one safe build, which is the opposite of
what the [constellation](constellations.md) is for.

### Save v7 re-denomination

Before save v7 a run cost 5 or 10 and a day granted 50. The v7 migration divides a balance by 5, rounding up, once, so
card and scenario unlocks cost the same number of days as before. Past ledger entries keep their old amounts: the
ledger is history, and the conversion is a change of unit rather than a transaction, so it writes no entry. Race
records keep the ticket reward of their day, five a level before v7 and one after.

## Pacing sanity check

- **Maxing one card in one scenario** is three clears, 0★ → 3★ (D200). All-or-nothing means a lost run costs its
  ticket, so budget **about four tickets**, and about 25 minutes for runs of about 5, 8 and 12 minutes.
- **Puzzle progression** grants54 gross materials on one primary route and132 on a full two-branch clear;
  matching debt is repaid first. Nine materials raise one unit CL1→10. These are not daily Training Tickets;
  [exact allocation and repeat-boss planning](uma-puzzles.md#6-chapters-and-the-farming-loop) remain explicit.
- **A day's15 tickets** support card bonding or racing promotion; they never limit Puzzle entry.
- **Preserved universals** are finite old progress, not a new recurring reward source.
- **Late scenarios:** unlocking tier 10 → 11 costs 50, three full daily grants plus five tickets, minus what racing earns
  back.
- **Stars are global** (D255), so about24 tickets to max six cards benefits every scenario/preset that can equip them.
- **The core choice:** Friendship runs and scenario unlocks draw from the same tickets. That's intended.

Revisit these numbers once a balance simulation exists.

## Implementation notes

- A "day" uses the device's local date. Anti-cheat isn't needed for a personal game.
- **Dev mode:** grant tickets, coupons, and shards; set levels; skip days. For testing and balance work.
- All earning and spending goes into a **ledger**, so it can be audited and rebalanced later.
- Shard exchange writes `-5 uma-shards` and `+1 uma-coupons` as distinct rows under one numbered exchange prefix. Coupon
  redemption writes one `-1` row keyed by the selected Card or Uma id; reloads and retries never append another spend.
