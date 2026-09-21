# Economy

> All numbers are **draft values for tuning**.

## Currencies at a glance

**Training Tickets are the only currency** ✅. Coupons and shards are collection items, not currency.

| Item | Earned by | Spent on | Expires? |
|---|---|---|---|
| 🎫 **Training Tickets** | Daily grant · Uma Level-ups · card limit breaks | Minigame runs · unlocking the next scenario | Never |
| 🎟️ **Card Select Coupon** | Maxing a card (LB4) | Any unowned SSR card | Never |
| 💎 **Uma Shard** | An Uma reaching a gate level (10, 20, 30…) | 5 shards → 1 Uma Select Coupon | Never |
| 🎟️ **Uma Select Coupon** | 5 Uma Shards | Any unowned Uma | Never |

**Two separate collection paths** ✅: **leveling Umas earns more Umas**, and **leveling cards earns more cards**.
Card coupons never come from Umas, and Uma coupons never come from cards. Details are in [Collection](collection.md).

## 🎫 Training Tickets

### Earning

These are the **only** sources ✅:

| Source | Amount |
|---|---|
| Daily grant | **+50 per day**, accruing while you're away |
| Uma Level-up (from race EXP) | **+5** |
| Card limit break (from Bond Recall) | **+5** |

There are **no login streaks**, and badges, achievements, and goals don't pay tickets ✅.

**Storage cap (500):** the cap only stops the **daily grant** from accruing. Tickets earned by leveling Umas or cards are always
added, even above 500, so nothing earned is ever lost.

### Spending

| Use | Cost |
|---|---|
| [Spark Match](minigames.md#spark-match--training-levels) run — raises Training Level | **5** |
| [Bond Recall](minigames.md#bond-recall--card-limit-breaks) run — limit breaks a card | **10** |
| Unlocking the next scenario | **25 × fromTier** |
| **Reconfiguring a constellation** | **free, always** |

| Unlock next scenario | 1 → 2 | 5 → 6 | 10 → 11 |
|---|---|---|---|
| Cost | 25 | 125 | 250 |

Limit breaks no longer have a separate price: the Bond Recall run *is* the limit break, and a failed run costs
its 10 tickets without advancing. Reconfiguring is free on purpose — charging for it would make players hoard
one safe build, which is the opposite of what the [constellation](constellations.md) is for.

## Pacing sanity check

- **One Uma through scenario 1:** about 10 Spark Match runs to TL10 (−50), 10 Uma Level-ups (+50), and the
  unlock to tier 2 (−25) come to a net **cost of about 25**. A day's grant covers one Uma's scenario.
- **Late scenarios:** unlocking tier 10 → 11 costs 250, about 5 days of the daily grant, minus what racing
  earns back.
- **Cards:** maxing a card is 4 Bond Recall clears (−40) paying back 4 limit breaks (+20), so about
  **20 tickets plus whatever you lose to failed runs** per Card Select Coupon. The real cost is the memory
  game, not the tickets.
- **The core choice:** minigame runs and scenario unlocks draw from the same tickets. That's intended.

Revisit these numbers once a balance simulation exists.

## Implementation notes

- A "day" uses the device's local date. Anti-cheat isn't needed for a personal game.
- **Dev mode:** grant tickets, coupons, and shards; set levels; skip days. For testing and balance work.
- All earning and spending goes into a **ledger**, so it can be audited and rebalanced later.
- Shard exchange writes `-5 uma-shards` and `+1 uma-coupons` as distinct rows under one numbered exchange prefix. Coupon
  redemption writes one `-1` row keyed by the selected Card or Uma id; reloads and retries never append another spend.
