# Economy

> All numbers are **draft values for tuning**.

## Currencies at a glance

**Training Tickets are the only currency** ✅. Coupons and shards are collection items, not currency.

| Item | Earned by | Spent on | Expires? |
|---|---|---|---|
| 🎫 **Training Tickets** | Daily grant · Uma Level-ups · card level-ups | Training · Uma promotions · card limit breaks | Never |
| 🎟️ **Card Select Coupon** | Maxing a card (LB4 and level 25) | Any unowned SSR card | Never |
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
| Card level-up (from training) | **+2** |

There are **no login streaks**, and badges, achievements, and goals don't pay tickets ✅.

**Storage cap (500):** the cap only stops the **daily grant** from accruing. Tickets earned by leveling Umas or cards are always
added, even above 500, so nothing earned is ever lost.

### Spending

| Use | Cost |
|---|---|
| Training turn | **1** |
| Uma promotion (next scenario) | **25 × fromTier** |
| Card limit break | **20 × toLB** |

| Uma promotion | 1 → 2 | 5 → 6 | 10 → 11 |
|---|---|---|---|
| Cost | 25 | 125 | 250 |

| Card limit break | → LB1 | → LB2 | → LB3 | → LB4 | Total to max |
|---|---|---|---|---|---|
| Cost | 20 | 40 | 60 | 80 | **200** |

## Pacing sanity check

- **One Uma through scenario 1:** about 30 trainings (−30), 10 Uma Level-ups (+50), about 15 card level-ups across her deck (+30), and promotion (−25)
  come to a net **gain of about 25**. Early scenarios pay for themselves.
- **Late scenarios:** a tier 10 → 11 promotion (250) costs about 5 days of the daily grant, minus what leveling earns back.
- **Cards:** maxing a card costs 200 in limit breaks, and its 24 level-ups earn back 48, so about **3 days of daily tickets per Card Select Coupon**.
- **The core choice:** training, Uma promotions, and card limit breaks all draw from the same tickets. That's intended.

Revisit these numbers once a balance simulation exists.

## Implementation notes

- A "day" uses the device's local date. Anti-cheat isn't needed for a personal game.
- **Dev mode:** grant tickets, coupons, and shards; set levels; skip days. For testing and balance work.
- All earning and spending goes into a **ledger**, so it can be audited and rebalanced later.
