# T130 — Prize Money and the Exchange

**M033 · second wave: after T126, parallel with T127 and T128 · not started.** One pull request (or commit series).

Read:
- [AGENTS.md](../../AGENTS.md) and [M033](M033-rework-rules.md), whose fixed choices bind this task.
- The rework [README](../rework/README.md) ("Money"), all of [rework/09](../rework/09-racing-rewards-and-exchange.md),
  [08](../rework/08-item-catalogue-and-recipes.md) §8–§9, [12](../rework/12-economy-and-pacing.md) §2, §3, §8,
  [07](../rework/07-farm.md) §2, §12, [13](../rework/13-removals-and-plan-changes.md) §6 and
  [02](../rework/02-check-ins-and-notifications.md) §9 (plain words).
- Decisions D328, D331, D336 and D338, and T126's `rework/items` (landed, D341) for the catalogue and work values.

## Goal and fixed scope

What races pay, the Daily Purse, the featured board, the Exchange and selling, as pure rules. Nothing live changes.

| Deliverable | Source |
|---|---|
| **Prize table.** A win pays Debut and Maiden 60, Pre-OP 80, OP 100, G3 150, G2 200, G1 300. 2nd–5th pay 40, 20, 10 and 5% of it; 6th and below nothing. Round down after every multiplier. No Race Bonus, no tier multiplier | README, 09 §2.1 |
| **Expedition rate.** 1.5× the G1 row (450 / 180 / 90 / 45 / 22) for a race family not yet won on her run; the home G1 row for one already won | 09 §2.1, rework/10 |
| **Daily Purse.** Each race's gross fills the day's purse in order: to 6,000 pays 100%, to 12,000 25%, beyond 5%. A race crossing an edge is split. The day is the local date at race start and never goes back. Prize Money only | 09 §3.3 |
| **Featured races.** Each day one G1, one G2 or G3 and one OP or Pre-OP from the regular catalogue, seeded by `featured:YYYY-MM-DD`; none two days running; different distance categories when the catalogue allows. The day's first win of each, by any Uma, pays its win prize again, outside the purse | 09 §4 |
| **Exchange goods.** Speed Tickets at 30, no limit. Raw ingredients of grade *g* at their real gathering minutes (108 … 162), up to 99 a purchase. No Uma Tickets, crafted items or dishes | README, 09 §5, §5.3, §5.4, D331, D336, D338 |
| **Stock rule.** Raw grades 1 up to the highest grade any Uma has ever opened: a high-water mark that never drops | 09 §5.3 |
| **Selling.** A third of the work value, rounded down, at least 1. Speed Tickets and reserved stock can't be sold | 09 §5.1, §6 |
| **Confirmations.** A sale of a dish, of needed stock or worth 1,000+ asks once; so does a purchase of 1,000+ | 09 §5.5, §6.1 |
| **Ledger rows** for every Prize Money movement here, with ids from their cause | 09 §9 |

## Implementation contract

**Modules** live in `packages/domain/src/rework/exchange/` (`@racer/domain/rework/exchange`), each with a header
comment linking rework/09.

| Module | Exports |
|---|---|
| `prizes.ts` | `WIN_PRIZE: Record<RaceGrade, number>`, `PLACE_SHARE_PERCENT = [100, 40, 20, 10, 5]`, `EXPEDITION_RATE_PERCENT = 150`, `grossPrize({ grade, place, expedition? })` |
| `purse.ts` | `PURSE_BANDS` (`full` to 6,000 at 20/20, `tired` to 12,000 at 5/20, `spent` beyond at 1/20), `LocalDay`, `boardDay(purse, localDay)`, `payFromPurse(purse, localDay, gross)` |
| `featured.ts` | `FEATURED_SLOTS` (`['g1']`, `['g2', 'g3']`, `['op', 'pre-op']`), `featuredSeed(day)`, `featuredBoard(day, races, rng)` |
| `race-prize.ts` | `settleRacePrize(profile, input, now)` |
| `exchange.ts` | `SPEED_TICKET_PRICE = 30`, `RAW_PER_PURCHASE = 99`, `CONFIRM_FROM = 1_000`, `buyPrice(sku)`, `stockedGrade(profile, farmLevels)`, `raiseExchangeGrade(profile, farmLevel)`, `buyNeedsConfirm(total)`, `buy(state, input, now)` |
| `selling.ts` | `SELL_DIVISOR = 3`, `sellPrice(itemId)`, `stackCounts(…)`, `sellConfirmations(…)`, `sell(state, input, now)` |
| `ledger.ts` | 09 §9's ids: `race:<resultId>:prize`, `race:<resultId>:featured`, `buy:<opId>:pay`/`:get`, `sell:<opId>:give`/`:pay` |

**State** is plain typed state from `rework/types.ts` (T125): the profile's `prizeMoney`, the Warehouse's `items`
counts, each Uma's Farm Level, the `Refusal` shape, and the row shapes of 13 §6's `ledger` and `itemLedger`. T130 adds
the two profile fields 09 §9 names and 13 §6 omits: `purse: { day, gross, featuredPaid }` and `exchangeGrade`, an
`ItemGrade` starting at 1 (grade 1 is stocked before the first Uma exists, D323).

**A race's prize.** `settleRacePrize(profile, { resultId, raceId, grade, place, expedition?: { familyWon }, localDay,
board }, now)` returns `{ profile, prize: { gross, paid, band, expedition, featuredBonus }, ledger }` or a refusal.
`board` is the featured board of `boardDay(purse, localDay)`, the later of the two days (09 §8). This is the prize half
of a race's commit (09 §9), not one of 13 §6's operations, and never touches Racing EXP. In order:
1. **Day.** A later `localDay` starts a new purse (gross 0, nothing featured paid). An equal or earlier one keeps the
   stored day.
2. **Gross** is `⌊win × rate × share / 10,000⌋` in integers. `win` is the grade's prize (G1's for an Expedition race),
   and `rate` is 150 for an Expedition family not yet won, else 100.
3. **Paid.** The gross splits across the bands from the purse's current gross, and pays
   `⌊(20 × full + 5 × tired + 1 × spent) / 20⌋`. The purse's gross grows by the whole gross. `band` is the band the
   purse ends in; an edge belongs to the band below.
4. **Featured bonus.** A 1st place in a race on `board`, not yet in `featuredPaid`, pays `WIN_PRIZE[grade]`, and the
   race joins `featuredPaid`. Never for an Expedition race; the bonus never fills the purse.
5. **Pay.** `prizeMoney` grows by paid + bonus, with ledger rows `race:<resultId>:prize` (`race-prize`) and
   `race:<resultId>:featured` (`featured-bonus`), written only for amounts above 0.

**The featured draw.** `featuredBoard(day, races, rng)` takes the regular catalogue as `{ id, grade, distance }` and
returns up to three race ids. Each slot's pool is sorted by id, and only indices with the parity of the day's number
(days since 1970-01-01) are kept, so no race is featured two days in a row. A slot picks `⌊rng.next() × n⌋`, preferring
a distance category not yet on the board; an empty pool leaves it empty. `featuredSeed(day) = stableHash('featured:' +
day)` reuses today's `scenario-goals.ts`. The caller passes `createRng(featuredSeed(day))` from `@racer/race`, which the
domain can't import, as `opponents.ts` takes its RNG (M033).

**Buying and selling** are 13 §6's `buy` and `sell`, as `(state, input, now) → { state, receipt } | Refusal`. Each
refusal is T125's `Refusal`: a code, plain words (02 §9) and the data that fills them. As in T127, the reasons sit in
one exported table that T131's banned-word test reads. Checks run in this order:

| Operation | Code | Reason | When |
|---|---|---|---|
| `buy { opId, sku, qty, unitPrice }` | `not-sold` | The Exchange sells raw ingredients and Speed Tickets. | `sku` isn't `speed-ticket` or a raw id |
| | `not-stocked` | In stock once an Uma reaches Farm Lv {level}. | its grade is above `stockedGrade` |
| | `quantity` | Buy 1 to 99 at a time. | raw outside 1–99; a ticket count below 1 or not whole |
| | `price-changed` | Price changed. (09 §8) | `unitPrice` isn't today's price |
| | `prize-money` | Need {n} more. (09 §5.5) | qty × price is above `prizeMoney` |
| `sell { opId, itemId, qty, unitPrice }` | `not-sellable` | Speed Tickets can't be sold. | the ticket or an unknown id |
| | `quantity` | Sell at least one. | qty below 1 or not whole |
| | `sell-short` | Only {n} can be sold now. | qty above the Warehouse count |
| | `price-changed` | Price changed. | `unitPrice` isn't `sellPrice` |

- **A buy** takes qty × price from `prizeMoney`, adds qty to `items[sku]` and stores `stockedGrade` as
  `exchangeGrade`. Its receipt carries `buy:<opId>:pay` (reason `buy`) and the item row `buy:<opId>:get`.
- **A sell** takes qty from `items` and pays qty × `sellPrice`, with `sell:<opId>:pay` (`sell`) and the item row
  `sell:<opId>:give`. Sales never touch the purse (09 §3.3). The Warehouse count never includes reserved inputs.
- **Prices.** `buyPrice` is 30 for a ticket and T126's `workValueSeconds(raw) / 60` for a raw item.
  `sellPrice(id) = max(1, ⌊workValueSeconds(id) / (60 × SELL_DIVISOR)⌋)`.
- **Stock.** `stockedGrade(profile, farmLevels)` is the larger of `exchangeGrade` and T126's `highestOpenGrade` of each
  current Uma's Farm Level. `raiseExchangeGrade(profile, farmLevel)` raises the stored mark.

**Queries for the screens** (09 §6.1). They are queries, not operations: the screen asks before it sends, and the
server re-runs an operation as sent, so operations take no "confirmed" flag.
- `stackCounts({ held, reserved, needed })` takes `held` (the Warehouse count), `reserved` (running work's inputs, from
  T127's state) and `needed` (the planner's count, from T131). It returns reserved, needed (capped at held),
  free = held − needed, and the sheet's sizes ×1, ×10, Surplus (= free) and All free (= held).
- `sellConfirmations({ itemId, qty, held, needed })` lists why a sale asks: `dish`, `needed` (with how many it leaves
  short) or `large` (≥ 1,000). `buyNeedsConfirm(total)` is total ≥ 1,000.

**Determinism and imports.** Every amount is an integer, and the same input gives the same output. T130 imports
`itemById`, `workValueSeconds`, `highestOpenGrade`, `gradeOpensAtFarmLevel`, `SPEED_TICKET_ID` and `ItemGrade` from T126;
`RaceGrade`, `DistanceCategory` and `stableHash` from today's code; and `rework/types.ts` from T125. It never uses
`TIME_FACTOR`: prices follow T126's work values (D338).

## Tests

Co-located `rework/exchange/*.test.ts`, with expected values copied from rework/09 and a synthetic race catalogue.
- **Prizes:** every cell of 09 §2.1 (G3 5th pays 7). Expedition 450 / 180 / 90 / 45 / 22, and a family already won
  300 / 120 / 60 / 30 / 15. 6th and below pay 0, and a bad place is refused.
- **Purse:** a G1 win at 5,900 gross pays 150 (09 §11). A race ending at exactly 6,000 is `full`, the next `tired`, and
  one race can span all three bands. A new day resets the purse; an earlier day keeps the stored one. 09 §3.4's "Paid"
  column comes out of a day's whole gross (8,000 → 6,500, 15,000 → 7,650, 30,000 → 8,400 …); race by race it matches
  exactly at 200 a race and within 1 a race at 150.
- **Featured:** the fixture's 2026-10-13 board is pinned and the same on every run (mulberry32 copied into the test,
  as `opponents.test.ts` does). No race appears two days in a row across 366 days. Distance categories differ whenever
  the fixture allows. The bonus is paid once per race per day, to the first win only, never fills the purse, never
  passes 600 a day, and never applies to an Expedition race.
- **Exchange:** raw prices are 108 … 162 and equal T126's work value ÷ 60, and the ticket is 30. Each refusal is tested
  with its words, including the 99 cap. Stock is grade 1 with no Umas and grade 2 at Farm Lv 6, and doesn't drop when
  Farm Levels reset.
- **Selling:** every cell of 09 §6 (raw 36 … 54, crafted 45 … 67, planet 321 … 464). Duos sell as a planet dish of
  their grade, and Feasts for 418, 456, 494 and 532. A synthetic work value under 3 minutes sells for 1. The ticket and
  a quantity above the count are refused, and each confirmation case is covered.
- **No loop mints time:** at every grade a raw sells for less than it costs, and every item's sale × 3 is at most its
  work value in minutes. So buying inputs, working them and selling never beats the money plus the minutes put in.
- **Ledger:** ids follow 09 §9. Over a synthetic month of races, buys and sells, the ledger deltas sum to `prizeMoney`
  (09 §9's audit).

## Live blocks

`prize-table` → rework/09 §2.1 · `purse-bands` → §3.3 · `exchange-prices` → §5.3 · `sell-values` → §6. T126's
`work-values` block (08 §8) switches its "A third" column from the literal ÷ 3 to `SELL_DIVISOR`. 09 §4's rule table
is prose and stays hand-written; §3.4, §5.2 and §5.6 are pacing models for T132. The first `pnpm docs:update` may change
formatting, never a number.

## Acceptance

- [ ] `rework/exchange/` exports the prize table, purse, featured draw, `buy`, `sell` and the queries; all tests pass.
- [ ] rework/09 carries the four blocks, `work-values` uses `SELL_DIVISOR`, and the docs check passes.
- [ ] Nothing in `rework/exchange/` multiplies by `TIME_FACTOR` or 1.2.
- [ ] `pnpm lint && pnpm test && pnpm build` stay green and the 180 KB startup budget holds.
- [ ] Every existing test and sim gives the same output, and `git grep "rework/" apps` finds nothing.
- [ ] The choices below go into 09 §10 with one decisions.md entry, and this spec is deleted (D104).

## Out of scope

- Racing EXP, goals, Uma Tickets and Shards: T125. Using Speed Tickets (−30m, Finish, "Buy and finish"), upgrade
  prices and `upgrade`: T127 and T128. The planner's needs: T131. Expedition races and won families: phase 9.
- Retry dedupe, sync, server re-runs, two devices and every screen: phase 3. The ledger ids make the dedupe possible.

## Decided here

1. **Where it lives.** 09 §9 and §11 name `@racer/domain/economy`. M033 puts it in `rework/exchange/` until phase 3.
2. **Profile fields.** T130 adds 09 §9's `purse` and `exchangeGrade` (listed in 13 §6) to T125's profile type, and
   phase 3's save carries them.
3. **The day comes in** as `localDay`, the device's `YYYY-MM-DD` at race start: a pure rule can't know the time zone.
4. **"Never two days running"** uses day-parity halves of each slot's pool: exact, with no history. A one-race pool
   shows its race every other day.
5. **Raising the mark.** Only T127's `collect` raises Farm Level, and T127 doesn't depend on T130. So `stockedGrade`
   also counts every current Uma's open grade, T132's loop calls `raiseExchangeGrade` after each collect, and phase 3
   puts it in the collect commit, so a promotion can't lower the stock.
6. **Rounding.** Each race rounds down once, after the purse share (09 §2.1, "after every multiplier"). 09 §3.4 models
   day totals, so it's pinned on totals.
7. **Free and Surplus.** 09 §6.1 defines Free as "the rest", then offers "Surplus (free minus needed)". Surplus is read
   as the Free count, and "All free" as every unreserved item, which dips into needed and so asks first. Reserved
   inputs leave the Warehouse count when work starts (07 §2, §12), so the count is what can be sold.
