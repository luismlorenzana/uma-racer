# Economy

> All numbers are **draft values for tuning**.

## Currencies at a glance

**D287 release boundary:** current Spark/ticket rules below stay live while both Puzzle capabilities are off.
After protected preservation, scenario/style materials buy CL directly; daily tickets still pay Friendship and
scenario advancement, not free Puzzle entry. Existing `training:level-up-ticket` stock becomes **Legacy Universal CL
Tickets**, with one final pooled unapplied EXP conversion at1,250 each plus a single positive-fraction compensation
per account. Nothing new mints universals after activation. Negative material debt is separate from nonnegative
Items; migration credit bypasses debt. Original paid Spark refunds use stable D177 evidence and are not capped at60.
[Exact conversion/recovery](../technical/uma-puzzles-implementation.md#t115-implemented-preservation-v2-d287).

**Training Tickets are the only currency** ✅. Coupons and shards are collection items, not currency.

| Item | Earned by | Spent on | Expires? |
|---|---|---|---|
| 🎫 **Training Tickets** | Daily grant · Uma Level-ups | Minigame runs · unlocking the next scenario | Never |
| 🎟️ **Card Select Coupon** | A card's first 3★ | Unlocking any unowned SSR card, the only way to own one (D198) | Never |
| 💎 **Uma Shard** | An Uma reaching a gate level (10, 20, 30…) | 5 shards → 1 Uma Select Coupon | Never |
| 🎟️ **Uma Select Coupon** | 5 Uma Shards | Any unowned Uma | Never |
| ⏫ **Training Level-Up Ticket** | Every 1,250 Training EXP past TL10, through the Training EXP bank (D212) | One Training Level for the unit on the Spark Match start screen (D213) | Never |

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
- **One Uma through a scenario's Training Levels** is 11,250 Training EXP (D211): a median of 6 paid Spark Rival Circuit
  runs, p90 8. Losses retain partial EXP but make the route less ticket-efficient.
- **A day's 15 tickets** max about three cards, or one card with ten Spark Match runs to spare, or take two to three Umas
  through a scenario.
- **Level-Up Tickets** come only from EXP past TL10, so they arrive at most about one per Uma finished and never replace
  the daily Training Tickets. Each is spent as one Training Level on the Spark Match start screen, the work of about two
  thirds of a paid run (D213). The v11 migration paid the surplus of units trained on the old, steeper curve.
- **Late scenarios:** unlocking tier 10 → 11 costs 50, three full daily grants plus five tickets, minus what racing earns
  back.
- **Stars are global** (D255), so about24 tickets to max six cards benefits every scenario/preset that can equip them.
- **The core choice:** minigame runs and scenario unlocks draw from the same tickets. That's intended.

Revisit these numbers once a balance simulation exists.

## Implementation notes

- A "day" uses the device's local date. Anti-cheat isn't needed for a personal game.
- **Dev mode:** grant tickets, coupons, and shards; set levels; skip days. For testing and balance work.
- All earning and spending goes into a **ledger**, so it can be audited and rebalanced later.
- Shard exchange writes `-5 uma-shards` and `+1 uma-coupons` as distinct rows under one numbered exchange prefix. Coupon
  redemption writes one `-1` row keyed by the selected Card or Uma id; reloads and retries never append another spend.
