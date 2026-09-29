# Economy

> All numbers are **draft values for tuning**.

## Currencies at a glance

**Training Tickets are the only currency** ✅. Coupons and shards are collection items, not currency.

| Item | Earned by | Spent on | Expires? |
|---|---|---|---|
| 🎫 **Training Tickets** | Daily grant · Uma Level-ups | Minigame runs · unlocking cards · unlocking the next scenario | Never |
| 🎟️ **Card Select Coupon** | A card's first 5★ | A free unlock of any unowned SSR card | Never |
| 💎 **Uma Shard** | An Uma reaching a gate level (10, 20, 30…) | 5 shards → 1 Uma Select Coupon | Never |
| 🎟️ **Uma Select Coupon** | 5 Uma Shards | Any unowned Uma | Never |

**Two separate collection paths** ✅: **leveling Umas earns more Umas**, and **leveling cards earns more cards**.
Card coupons never come from Umas, and Uma coupons never come from cards. Details are in [Collection](collection.md).

## 🎫 Training Tickets

**One ticket is one minigame run** (D148). A day is sized to max one card in one scenario and still train.

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
| [Spark Match — Rival Circuit](minigames.md#spark-match--rival-circuit) run — raises Training Level | **1** |
| A [Friendship Training](minigames.md#friendship-training--card-stars) run — earns a card's star | **1** |
| Unlocking a card (D130) | **5 + era** — 6 to 19 |
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

- **Maxing one card in one scenario** is five clears, 0★ → 5★. All-or-nothing means a lost run costs its ticket, so
  budget **about six tickets**, and about 45 minutes once Friendship Training's runs grow from about 5 to 12 minutes.
- **One Uma through a scenario's Training Levels** is about 10 competent Spark Rival Circuit clears: about 10 tickets,
  one day. Losses retain partial EXP but make the route less ticket-efficient.
- **A day's 15 tickets** max one card with nine Spark Match runs to spare, or take one Uma through a scenario with room
  for several losses.
- **Late scenarios:** unlocking tier 10 → 11 costs 50, three full daily grants plus five tickets, minus what racing earns
  back.
- **Stars are per scenario** (D127), so a six-card set is about 36 tickets, or roughly two and a half daily grants, to
  max in one scenario.
- **The core choice:** minigame runs and scenario unlocks draw from the same tickets. That's intended.

Revisit these numbers once a balance simulation exists.

## Implementation notes

- A "day" uses the device's local date. Anti-cheat isn't needed for a personal game.
- **Dev mode:** grant tickets, coupons, and shards; set levels; skip days. For testing and balance work.
- All earning and spending goes into a **ledger**, so it can be audited and rebalanced later.
- Shard exchange writes `-5 uma-shards` and `+1 uma-coupons` as distinct rows under one numbered exchange prefix. Coupon
  redemption writes one `-1` row keyed by the selected Card or Uma id; reloads and retries never append another spend.
