# 09 · Racing rewards and the Exchange

> **Status: approved design, 2026-10-14; first written 2026-10-13 (D328, D331).** What a race pays, the Daily Purse that keeps racing
> from replacing the timers, the daily featured races, the Exchange, Speed Tickets and selling surplus. The prize
> table, the purse, the featured draw, the Exchange's goods and stock rule and selling are built as rules in
> `@racer/domain/rework/exchange` (T130, D345), and the tables marked live are rendered from them; nothing is in the
> game yet. The Racecourse (§3.5, §4), the race's commit (§8–§9) and the result (§7) are built in the new game beside
> today's app (T141, D359), with §10's last rows. Every number is a **draft**. The loop simulation ([12](12-economy-and-pacing.md) §12) tunes them, and its
> checks become the tests that pin them.

Races are the free-time half of the game. They cost nothing, are never blocked by Farm work or sessions (D328), and
pay two things:
- **Racing EXP**, which belongs to the Uma who ran and moves her Racing Level ([03](03-uma-progression.md));
- **Prize Money**, which belongs to the account and buys time at the Exchange.

Everything priced in Prize Money follows one anchor (D331): **1 Prize Money ≈ 1 minute of Uma work**. A race that pays
300 buys about five hours of somebody's job.

## 1. Racing EXP (unchanged, restated)

Racing EXP is today's rule ([design/racing.md](../design/racing.md#rewards)), with the cards in her set now being her
**bonded** cards ([06](06-cards-and-bonds.md)):

| Outcome | Racing EXP |
|---|---|
| 1st | `winExp[grade] × (1 + Σ Race Bonus of the cards in her set for this race's preset)` |
| 2nd–3rd | 25% of that |
| 4th and below | 0 |

| Debut/Maiden | Pre-OP/OP | G3 | G2 | G1 |
|---|---|---|---|---|
| 40 | 60 | 80 | 110 | 150 |

- **A scenario costs 1,800 Racing EXP** in every tier (README). The level curve, the holds at the Maiden and Trials
  goals, the gate and what happens to EXP at a hold are [03](03-uma-progression.md)'s.
- Every card pays today's full Race Bonus (D329). The race reads the preset of its distance (D254), so a Long race uses
  her Long preset's set.
- At the target an Uma runs about 14 races a scenario: her six goal races and the races that fill her levels
  ([12](12-economy-and-pacing.md) §8).

| Wins a scenario takes | G1 (150) | G1 with +33% Race Bonus (200) | G2 (110) |
|---|---:|---:|---:|
| 1,800 EXP | 12 | 9 | 17 |

**Nothing below reduces Racing EXP.** The Daily Purse (§3) touches Prize Money only, so a heavy evening never costs
an Uma her levels or her goals.

## 2. Prize Money

### 2.1 The prize table

A race pays its grade's prize times its place's share. Each place below 2nd pays half the one above it. That keeps the
README's 40% and 20% and continues the halving down to 5th; the real JRA split (100 / 40 / 25 / 15 / 10) is a little
richer, but halving is easier to read and pays less for a bad race.

<!-- live:prize-table -->
| Grade | 1st | 2nd (40%) | 3rd (20%) | 4th (10%) | 5th (5%) | 6th and below |
|---|---:|---:|---:|---:|---:|---:|
| Debut, Maiden | 60 | 24 | 12 | 6 | 3 | 0 |
| Pre-OP | 80 | 32 | 16 | 8 | 4 | 0 |
| OP | 100 | 40 | 20 | 10 | 5 | 0 |
| G3 | 150 | 60 | 30 | 15 | 7 | 0 |
| G2 | 200 | 80 | 40 | 20 | 10 | 0 |
| G1 | 300 | 120 | 60 | 30 | 15 | 0 |
<!-- /live -->

- **Rounding:** down to a whole Prize Money, after every multiplier.
- **No entry fee and no appearance money.** 6th and below pays nothing, so sending a weak Uma into G1s for the field
  money doesn't pay.
- **No Race Bonus on Prize Money.** Race Bonus already pays in EXP. Keeping Prize Money a pure function of grade and
  place makes the purse and the pacing model exact.
- **No tier multiplier.** Work times are the same in every tier ([12](12-economy-and-pacing.md) §9), so the anchor is too.
  Tier 2 and 3 races are harder to win, which is their own cost.
- **Expedition races pay 1.5× the G1 row, whatever their local grade** (draft): 450 / 180 / 90 / 45 / 22.
  [10](10-expeditions.md) decides which races are Expedition races (never in the regular catalogue), that retries are
  free and that they pay no Racing EXP; this page sets the rate. A first draft here was ×2 on the race's own grade.
  10's rule is better: foreign grades don't map one-to-one onto JRA's, and a fully trained Uma wins about 45% abroad
  against 80–100% of home G1s, so a 450 Expedition race and a 300 home G1 pay about the same per race run.
- **The Expedition rate is for families she hasn't won yet on this run.** Once a family is in her run's wins
  ([10](10-expeditions.md) "Save"), racing it again pays the home G1 row (300 / 120 / 60 / 30 / 15). A repeat can't
  move her toward the eight wins, so it earns no premium; a family not yet won still does, including after the eighth
  win, while she chases a Clean Sweep. So the Expedition is never a better farm than home G1s.

### 2.2 What a scenario pays

An Uma's six goal races, all won, pay 150 + 2 × 200 + 3 × 300 = **1,450**. The rest of her 1,800 EXP is mostly G1
wins and places, so a whole scenario pays her account about **2,100–3,000 Prize Money**, depending on how many of her
races are G1s.

[12](12-economy-and-pacing.md) §8 models ~150 a race, ~1,900 a day at the target, ~7% of the roster's 450 Uma-hours.
A career run mostly on G1 wins averages nearer 200 a race, which is about 2,500 a day and 9%. That's still inside
the sim's 5–10% check. If the sim measures more than 10%, the lever is **one prize factor** on the whole table (0.75
would make a G1 win 225), never a per-grade patch, so the ratios between grades stay.

## 3. The Daily Purse (anti-grind)

### 3.1 The problem

A race costs nothing, takes under a minute with Skip, and can be repeated. Without a bound, an evening of G1s would
pay tens of thousands of Prize Money: hundreds of Speed Tickets, enough to finish every job in the game. The timers
would stop meaning anything, and the owner would feel they *had* to grind.

The rule has to:
- never touch the owner's normal racing (about 12–13 races a day);
- make a heavy free evening (about 40 races) clearly worth it: **20–25%** of the roster's day;
- flatten past that, without ever paying zero;
- be one number the owner can read.

### 3.2 Options considered

Numbers use ~150 a race and the roster's day of 27,000 Uma-minutes (25 × 24 h × 75%).

| Option | How it works | 12 races | 40 races | 100 races | Verdict |
|---|---|---|---|---|---|
| **Per-Uma "fresh legs"** | Each Uma's first 2 races a day pay in full, later ones 25% | 7% | 22% if spread over 20+ Umas; less if not | ~35% (50 full races across 25 Umas, then 25%) | **Rejected.** It punishes the natural way to clear a career, racing one Uma through her stage in one sitting, and barely bounds the roster (25 × 2 = 50 full races) |
| **First win per scenario pays a bonus** | An Uma's first win of each race in a scenario pays ×2 | 7–14% | no bound | no bound | **Rejected as the bound.** Hundreds of races × 25 Umas is no limit; as a variety nudge the featured board (§4) does it more simply |
| **Diminishing returns per race family per day** | The same race pays 100%, 50%, 25% … each day | 7% | ~22% | ~50% | **Rejected.** Switching races dodges it (about 24 G1s and 35 G2s); it taxes only the owner who doesn't game it |
| **Daily Purse (account-wide, in Prize Money)** | The day's first 4,500 of prizes pay in full (6,000 in the first draft, D348), the rest to 12,000 a quarter, beyond that a twentieth | 7% | **18%** | 24% | **Chosen** |

Why measure the purse in Prize Money, not races: a race-count cap would make heavy days G1-only, since a capped race
should be the dearest one. A Prize Money purse bounds the same whatever the owner races.

### 3.3 The rule

Every race's **gross prize** (§2.1, at the Expedition rate for an Expedition race) goes into the day's purse, in
order:

<!-- live:purse-bands -->
| Band | Gross Prize Money that day | Paid |
|---|---|---|
| Full | 0 – 4,500 | 100% |
| Tired | 4,500 – 12,000 | 25% |
| Spent | above 12,000 | 5% |
<!-- /live -->

- **A race that crosses a band edge is split**: a G1 win at 4,400 pays 100 in full and 200 at a quarter, so 150.
- **The day** is the device's local calendar date when the race starts (today's rule: a day is the device's date,
  and anti-cheat isn't needed). A race started at 23:58 counts on that day.
- **The purse only moves forward.** If the device's date goes back (a time-zone change), the stored day carries on
  until the local date passes it.
- **What it touches:** Prize Money only. Racing EXP, goals, badges, titles, Expedition progress and the featured
  bonus (§4) are never reduced.
- **Selling surplus** (§6) doesn't count toward it: sales are bounded by Farm output, which is already time.

### 3.4 What it pays

| Races in a day | Gross at ~150 a race | Paid | Share of the roster's day | Gross at ~200 a race | Paid | Share |
|---|---:|---:|---:|---:|---:|---:|
| 12 (the target) | 1,800 | 1,800 | 6.7% | 2,400 | 2,400 | 8.9% |
| 25 | 3,750 | 3,750 | 13.9% | 5,000 | 4,625 | 17.1% |
| **40 (a heavy evening)** | 6,000 | **4,875** | **18.1%** | 8,000 | **5,375** | **19.9%** |
| 60 | 9,000 | 5,625 | 20.8% | 12,000 | 6,375 | 23.6% |
| 100 | 15,000 | 6,525 | 24.2% | 20,000 | 6,775 | 25.1% |
| 150 | 22,500 | 6,900 | 25.6% | 30,000 | 7,275 | 26.9% |

So a normal day never sees the purse. A heavy evening pays most of its worth: the loop simulation measures heavy
evenings at about 4,450 Prize Money a day and 22% of the roster's work time, normal days at about 1,850 and 8%
([12](12-economy-and-pacing.md) §8). Past about 30 races each further race is worth a quarter, then a twentieth: a G1
win deep in the evening still pays 15, half a Speed Ticket. Even every day at 150 races, racing buys under a third of
the roster's time.

**Tuning (D348):** the sim pins the band edges with [12](12-economy-and-pacing.md)'s check "heavy racing saves
18–25%". At the first draft's 6,000 a heavy evening saved 29%: the sim's roster works about two-thirds of its time, not
the 75% this table assumes, so each Prize Money is a larger share of it. The first edge moved to 4,500; the quarter,
the twentieth and the 12,000 edge stay.

### 3.5 On screen

- **The Racecourse header** carries a slim purse bar: "Today's purse · 3,450 of 4,500 at full prize". Past 4,500 it
  reads "Tired purse · a quarter until 12,000", and past 12,000 "Spent purse · a twentieth until midnight". (i)
  explains the bands in two lines.
- **The pre-race sheet** shows the race's prize at the current band ("G1 win · 300", or "G1 win · 75, tired purse").
- **The result** names the band on the Prize Money line (§7).

## 4. Featured races (ships in v1)

A daily board of three races that pay a bonus. It gives the free-time mode a small goal each day and nudges the owner
off the same handful of races.

| Rule | Value (draft) |
|---|---|
| The board | **3 races a day:** one G1, one G2 or G3, one OP or Pre-OP, from the regular catalogue (not Expedition pools) |
| The draw | Seeded by the local date (`featured:YYYY-MM-DD`), so every device shows the same board. No race is featured two days running, and the three differ in distance category when the catalogue allows |
| The bonus | **The first win of each featured race that day, by any Uma, pays its win prize again**: G1 +300, G2 +200, G3 +150, OP +100, Pre-OP +80. Places pay no bonus |
| Purse | The bonus is **outside** the Daily Purse: never reduced, and it doesn't fill the purse |
| Most a day | 600 (G1 + G2 + OP), about 2% of the roster's day |
| Resets | At local midnight, with the purse |

- **On screen:** "Today's featured" sits at the top of the Racecourse, above Next up, three race cards with a gold
  ribbon. A paid bonus turns the ribbon into "Bonus paid". The Racecourse's counter on the Hub is the number of bonuses
  still open (0–3, [11](11-hub-and-places.md)).
- **Why Prize Money and not an item:** the Exchange already turns Prize Money into any raw ingredient (§5.3), so
  money is the bonus that fits every need. An item bonus would need a rule for which family, and would usually be the
  wrong one.
- **Why it ships in v1:** it's a pure function of the date and the catalogue, with no new state beyond the three
  "paid" flags (§9), and the racing mode wants a reason to come back every day.

## 5. The Exchange

A Town Hall place ([11](11-hub-and-places.md)), drawn with uma-art's `exchange` market stall. It sells for Prize
Money; it doesn't buy (selling happens in the Warehouse, §6).

| Goods | Price (Prize Money, draft) | Limit |
|---|---|---|
| **Speed Ticket** | 30 | None |
| **Raw ingredient**, grade *g*, any family | (90 + 5(*g*−1)) × *k*: its real gathering minutes (*k* = 1.2, D338) | Grades up to the stock rule (§5.3); up to 99 a purchase |
| Building and facility upgrades | Bought at each building, priced in Prize Money (and items) by [05](05-training-hub.md) and [07](07-farm.md) | — |

**Not sold, by decision:** Uma Tickets (§5.4), crafted items, dishes, Racing EXP, bonds and unlocks. The Farm makes crafted items and
dishes, and selling them would let racing skip the whole Farm chain, not just speed it up. Raw ingredients buy back
gathering time only; crafting and cooking still take an Uma, and still pay her Farm EXP.

### 5.1 Speed Tickets

The Speed Ticket replaces today's Energy (D331). It's an **item** in the Warehouse's Tickets shelf, and it carries
through promotion ([12](12-economy-and-pacing.md) §2).

| Rule | Value |
|---|---|
| What it does | Takes **30 minutes** off one **running** Farm job or Training Hub session, or any other running timer its owning doc gives one (for example a building upgrade, if [05](05-training-hub.md) or [07](07-farm.md) make upgrades take time) |
| A job of several items | The job's whole remaining schedule moves 30 minutes earlier. An item whose end passes becomes ready; leftover minutes run on into the next item. A ticket on an item with 10 minutes left finishes it and takes 20 off the next |
| **Finish** | Spends ⌈remaining minutes ÷ 30⌉ tickets and finishes the whole job or session. The last ticket's unused minutes are lost |
| Not on | A queued job (it isn't running yet), a ready job or session, or a race |
| Farm EXP | Skipped minutes still count as work: the job pays its full Farm EXP on collect, as in uma-rpg ([07](07-farm.md) owns Farm EXP) |
| Queues | When a job finishes early, the next queued job starts at that moment ([02](02-check-ins-and-notifications.md)) |
| Selling | Speed Tickets can't be sold |

- **On a job or session card:** "−30m" and "Finish · 4". With too few tickets, Finish reads "Buy 3 and finish · 90"
  and asks once; the buy and the speed-up go through as two operations in order (§9).
- **Worked example.** A Kitchen job of three grade-3 dishes (260 minutes each) started at 08:00, and it's 12:00. The
  first dish ends at 12:20, so it has 20 minutes left and 540 in all. One ticket makes the first dish ready now and
  moves the other two to 16:10 and 20:30. Finish would cost ⌈540 ÷ 30⌉ = 18 tickets, 540 Prize Money.

### 5.2 What a day of racing buys

| Racing day | Paid Prize Money | As Speed Tickets | Roster time |
|---|---:|---:|---|
| Target (about 13 races, measured) | ~1,850 | ~62 | ~31 Uma-hours |
| Heavy evening (40 races) | ~4,900–5,400 | ~165–180 | ~80–90 Uma-hours |
| Heavy, plus every featured bonus | ~5,500–6,000 | ~185–200 | ~90–100 Uma-hours |

### 5.3 Raw ingredients and the stock rule

<!-- live:exchange-prices -->
| Grade | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Price | 108 | 114 | 120 | 126 | 132 | 138 | 144 | 150 | 156 | 162 |
<!-- /live -->

**Stock rule:** the Exchange stocks raw grades **1 up to the highest grade any of the owner's Umas has ever opened**,
in all eight families. Grade *g* opens at Farm Lv 5*g* − 4 (README), so the stock grows to grade 2 when the first Uma
reaches Farm Lv 6.

- **Why a high-water mark**, not "what someone can make now": Farm Levels reset at promotion, and once most of the
  roster is promoted the stock would shrink back to grade 1. A shop that loses stock reads as a bug.
- **Why gated at all:** it never sells something nobody can use. A grade can only be crafted by an Uma at its Farm
  Level ([07](07-farm.md)).
- uma-rpg stocks grades by world progress (a continent's grade pair once a stage there is won). The racer's
  progress is Farm Level, so the gate follows it.
- **Planner hints:** each family's row badges the grades the planner says the roster is short of ("Vegetables G3 ·
  short 6", [02](02-check-ins-and-notifications.md)), so a free evening's money goes where the Farm is behind.
- **Raw Vegetables are the usual buy.** Every constellation node takes a Vegetables dish, so the Vegetable Garden is
  the hottest site, and buying its raw items is the relief valve when it falls behind
  ([08](08-item-catalogue-and-recipes.md) §7, [07](07-farm.md) §6).

### 5.4 Uma Tickets are not sold

The owner's rule (D336): **Prize Money doesn't buy Umas.** The roster grows the normal way, as Umas progress through
the scenarios: each scenario gate an Uma reaches pays 1 Uma Shard, 5 Shards make 1 Uma Ticket, and a promotion pays
1 ([04](04-tiers-and-promotion.md) §6 owns the rules; [12](12-economy-and-pacing.md) §9 shows the roster over time).
So racing's money goes to Speed Tickets, raw ingredients and upgrades, and the roster is a reward for progress, not a
purchase.

### 5.5 The Exchange screen

- **Header:** Prize Money, Speed Tickets held, and the purse bar (§3.5).
- **Speed Tickets:** ×1, ×10, ×50, or a typed amount; the total; Buy.
- **Raw ingredients:** eight family tabs; one row per stocked grade with its icon (uma-art `items`), price, Warehouse
  count and planner badge; a quantity sheet (1–99).
- **Links:** "Sell surplus → Warehouse" and "Upgrades are bought at each building".
- **Buy** is disabled with "Need 120 more" when the balance is short. Any purchase of 1,000 or more asks once.

### 5.6 Where the money goes in tier 1

The one-off sinks, all bought with Prize Money (upgrades also take crafted items, which their docs list):

| Sink | Prize Money | Owner |
|---|---:|---|
| Farm upgrades to Lv 2 (ten buildings) | 14,100 | [07](07-farm.md) §7 |
| Training Hub upgrades to Lv 2 (four facilities) | 6,100 | [05](05-training-hub.md) §7 |
| Farm upgrades to Lv 3 (from grade 3, about day 4–6) | 37,200 | [07](07-farm.md) §7 |
| Training Hub upgrades to Lv 3 | 10,700 | [05](05-training-hub.md) §7 |
| **All of them** | **68,100** | |

- **At target racing** (~1,850 a day) that's about **37 days**, about five weeks; racing bunches at the end of each
  layer, so the loop simulation's account buys every Lv 2 between days 31 and 34 and every Lv 3 by about day 65
  ([12](12-economy-and-pacing.md) §7). With two heavy evenings a week (5 × 1,850 + 2 × 5,000 = 19,250 a week) it's
  about three and a half weeks.
- **So tier 1's first weeks spend racing on growth, not skips.** A sensible order: the Kitchen, Pantry and
  Vegetable Garden at Lv 2 (07 notes a 25-Uma roster needs them), then the other Lv 2s, then Lv 3s once grade 3
  opens. The game suggests nothing here and never spends for the owner ([01](01-game-loop.md) §7).
- **After that, Prize Money is mostly Speed Tickets and raw ingredients**, and buildings carry through promotion
  (D327), so tiers 2 and 3 start with every upgrade already bought.
- [12](12-economy-and-pacing.md)'s target holds without Speed Tickets, so a month of money going into upgrades
  instead slows nothing below the target; the upgrades themselves speed the Farm up ([07](07-farm.md) §7's pacing
  note).

## 6. Selling surplus ("fodder")

Any Warehouse item sells for **a third of its work value**, rounded down, at least 1. An item's work value is the
real Uma minutes in it at *k* = 1.2, inputs included, whatever the building speed or Speed Tickets
([08](08-item-catalogue-and-recipes.md) §8):

<!-- live:sell-values -->
| Grade | Raw: work | Raw: sells for | Crafted: work | Crafted: sells for | Planet dish: work | Planet dish: sells for |
|---|---:|---:|---:|---:|---:|---:|
| 1 | 108 | 36 | 135 | 45 | 963 | 321 |
| 2 | 114 | 38 | 142.5 | 47 | 1,005 | 335 |
| 3 | 120 | 40 | 150 | 50 | 1,047 | 349 |
| 4 | 126 | 42 | 157.5 | 52 | 1,096.5 | 365 |
| 5 | 132 | 44 | 165 | 55 | 1,146 | 382 |
| 6 | 138 | 46 | 172.5 | 57 | 1,195.5 | 398 |
| 7 | 144 | 48 | 180 | 60 | 1,245 | 415 |
| 8 | 150 | 50 | 187.5 | 62 | 1,294.5 | 431 |
| 9 | 156 | 52 | 195 | 65 | 1,344 | 448 |
| 10 | 162 | 54 | 202.5 | 67 | 1,393.5 | 464 |
<!-- /live -->

A crafted item is its raw item plus a quarter of the gathering time. A planet dish is four crafted items of its grade,
one crafted side at max(1, *g*−2) and the cook. A Duo sells like a planet dish of its grade; Feasts sell for 418, 456,
494 and 532 at grades 4, 6, 8 and 10. Speed Tickets and Uma Tickets can't be sold.

**Why a third:** the Exchange sells raw at full work value, so buying and selling back loses two thirds, and no loop
mints time. Buying a grade-1 raw for 108 and selling it back pays 36; crafting it first adds 27 minutes of an Uma's
work and pays 45. Selling is for real surplus: the side families a scenario overproduced, old grades after a
scenario, or a Warehouse full after promotion.

### 6.1 Reserved items and confirmations

Each stack in the Warehouse shows three counts:

| Count | Meaning | Can sell |
|---|---|---|
| **Reserved** | Inputs held by a running job or session. A queued job reserves only when it starts ([07](07-farm.md) §9) | **Never.** The sheet doesn't offer them |
| **Needed** | What the planner says the roster still needs from this stack ([02](02-check-ins-and-notifications.md)), and inputs of queued jobs that don't reserve | Yes, after a confirmation that names what it leaves short |
| **Free** | The rest | Yes |

The stock sheet offers **Sell ×1**, **×10**, **Surplus** (free minus needed) and **All free**, with the unit price and
the total. It asks once when the sale:
- includes any **dish** ("Sell 2 grade-3 Vegetable dishes for 698? Each took about 17 hours of work.");
- dips into **needed** stock ("This leaves the planner 4 short for Hishi Akebono's Observatory layer.");
- is worth **1,000 or more**.

No undo: a confirmed sale is final, and buying back costs three times as much, so the confirmations are the guard.

**As built (T138).** Reserved is `reservedStock` (`rework/work`), what Recall would return; the sizes are `stackCounts`'s,
each priced by `sellPrice` with its total, a size of 0 off with its reason. `sellConfirmations` decides the one question,
which reads all that apply in one sentence at live prices: "Sell 2 Cabbage Salad (grade 3) for 698? Each took about 17
hours of work. This leaves the planner 4 short for Hishi Akebono's Observatory layer." (hours from `workValueSeconds`; the
target is the first in the plan's order whose unlocks take the stack, as a dish or inside one). The sale carries the
price shown, so a stale one reads `price-changed`'s "Price changed." and the sheet reads the live price again. The
Exchange's Buy is off with "Need 120 more" when short and asks once at 1,000 or more (`buyNeedsConfirm`).

## 7. The race result screen

Today's sequence ([design/ux.md](../design/ux.md#results)) keeps its order; the ticket reward leaves and Prize Money
joins.

1. The placement **stamps** in ("1st!", confetti on a win).
2. The finishing order with margins.
3. **Racing EXP:** the bar fills by the race's EXP, with Race Bonus named ("+180 · G1 win ×1.2"). A level-up bursts;
   a hold says what releases it ("Held at Lv 25 · win the Trials", [03](03-uma-progression.md)).
4. **Prize Money:** "+300 · 1st in a G1", and below it only the lines that applied: "Expedition rate", "Featured
   bonus +300", "Tired purse: paid a quarter (6,420 of 12,000)". The amount flies into the account bar's chip.
5. **Goals:** goal ribbons and pips, as today; for an Expedition race, the distinct-win count ("5 of 8",
   [10](10-expeditions.md)).
6. **Flair:** badges, titles and achievements in today's T016 order, unchanged.
7. **Actions:** **Next Uma** (the Racecourse on the next Uma with something to race, [11](11-hub-and-places.md)),
   **Race again** (same Uma, same race) and **Races**. At a gate with her career complete, an **Advance** action joins
   them and opens the Scenario Gate; an Expedition's eighth win shows **Promote** instead, and a lost Expedition race
   **Retry** ([10](10-expeditions.md)). Until the result is saved only **Retry save** shows, as today.

A reload shows the stored result, its prize and band from the saved row, without replaying fanfare.

## 8. Edge cases

| Case | What happens |
|---|---|
| **Offline** | Races, purchases, sales and Speed Tickets all work offline against the local save and sync later. The server re-runs each operation in commit order. With one device (the owner's case) its numbers equal the screen's |
| **Two devices offline on the same day** | The server's commit order decides the purse; the second device's prize is recomputed at sync and the ledger shows the server's amount. Rare, and never more than the band difference |
| **A stale Exchange screen** | A `buy` carries the unit price the screen showed. If the price has changed, the server refuses it with "Price changed", charges nothing, and the screen refreshes |
| **Short of money at the server** | Refused with nothing charged; the local purchase rolls back with a notice |
| **A retried operation** | Returns its first receipt; nothing is charged or paid twice (§9) |
| **Closing the app mid-race** | The result is settled when the race starts (today's app settles when playback ends), so quitting the playback can't change the prize or the purse. Reopening shows the result |
| **A promoted Uma** | Prize Money, Speed Tickets and the Warehouse are the account's and carry ([04](04-tiers-and-promotion.md)). Her races in tier 2 pay the same table |
| **An Uma bought mid-tier** | Changes nothing here. The Exchange's stock never drops, and her first races pay like anyone's |
| **An Uma at Racing Level 50, or held** | Racing EXP follows [03](03-uma-progression.md); Prize Money is paid as usual, so racing a finished Uma still feeds the Farm, through the purse |
| **A 0-stock Warehouse** | The sell list shows "Nothing to sell yet: the Farm's first harvest lands here". The Exchange still sells raw |
| **No running work** | Speed Tickets wait in the Warehouse; the job cards are where they're used |
| **Device date goes backwards** | The purse keeps its stored day (§3.3); the featured board shows the stored day's board until the date passes it |

## 9. Saved data and operations

Generation 2's kinds ([13](13-removals-and-plan-changes.md) §6), with what this page needs on them:

| Where | Field | Notes |
|---|---|---|
| `profile/main` | `prizeMoney` | Integer ≥ 0 |
| `profile/main` | `umaTickets`, `umaShards` | [04](04-tiers-and-promotion.md)'s; the Exchange never touches them |
| `profile/main` | `purse: { day, gross, featuredPaid }` | `day` is `YYYY-MM-DD`; `gross` the day's gross prizes; `featuredPaid` the race ids whose bonus was paid today |
| `profile/main` | `exchangeGrade` (1–10) | The stock rule's high-water mark |
| `items/speed-ticket` | count | Speed Tickets are an item |
| `raceResults` row | `commit.prize: { gross, paid, band, expedition, featuredBonus }`, in the `finish-race` receipt the row keeps | What the result screen shows on reload |
| `ledger` (log) | `{ id, resource, delta, reason, at }`, the built `LedgerEntry` (D340, D345); the id carries the cause | Prize Money movements (and [04](04-tiers-and-promotion.md)'s Uma Ticket and Shard movements) |
| `itemLedger` (log) | `{ id, itemId, delta, reason, outfitId, opId, at }` ([13](13-removals-and-plan-changes.md) §6) | Speed Tickets and items bought, sold and used |

**Ledger reasons:** `race-prize`, `featured-bonus`, `buy`, `sell`, `upgrade` (with the building id), `promotion`
([04](04-tiers-and-promotion.md)), and `dev-grant` in dev builds only. Every row's id names what caused it: the race
result, the operation, the building.

**Ids make everything idempotent.** A row's id comes from what caused it, so a retry finds the row and writes nothing:

| Event | Ledger ids |
|---|---|
| A race's prize | `race:<resultId>:prize`, and `race:<resultId>:featured` for a bonus |
| `buy { opId, sku, qty, unitPrice }` | `buy:<opId>:pay` (Prize Money) and `buy:<opId>:get` (the item) |
| `sell { opId, itemId, qty, unitPrice }` | `sell:<opId>:give` (the item) and `sell:<opId>:pay` (Prize Money) |
| `speed-up { opId, outfitId, startedAt, tickets }` | `<opId>:m<n>`, the tickets' item movement ([13](13-removals-and-plan-changes.md) §6). `startedAt` names the job, so a ticket meant for a finished job can't land on the next one |

- **The race's prize is written with its result**, in the same atomic commit as the result row, the Uma, the profile's
  balance and purse, and the ledger rows. **As built (T134), a race commits as the operation `finish-race`** in
  [13](13-removals-and-plan-changes.md)'s list: in one tap it collects her finished unlocks, pays Racing EXP, goals and
  the gate's Shard on the preset of the race's distance, then the prize through the purse with any featured bonus, and
  writes the `raceResults` row under the operation's id, which is the race result's.
- **The server re-runs** `buy`, `sell` and `speed-up` with the domain package and refuses one whose price, stock,
  balance or target doesn't match. Prices live in `@racer/domain/economy`, one table, which the live manual renders.
- **An audit:** the sum of a currency's ledger deltas equals its balance on `profile/main`. A domain test checks it on
  a simulated month, and the dev build can run it on the real save.

## 10. Decided here

| Choice | Why |
|---|---|
| Places pay 40%, 20%, 10%, 5% of the win; 6th and below nothing | Halving is easy to read; no appearance money means a weak Uma can't farm G1 fields |
| No Race Bonus and no tier multiplier on Prize Money | Race Bonus already pays in EXP; work times are equal in every tier, so the anchor is too |
| Expedition races pay 1.5× the G1 row whatever their local grade (10's proposal), not ×2 on their own grade | Foreign grades don't map onto JRA's; at ~45% wins abroad a race pays about what a home G1 does |
| A family already won on her current run pays the home G1 row; Expedition races fill the Daily Purse like any race | Repeats don't advance the eight wins, so no premium; one purse for every race keeps the bound whole |
| One prize factor is the lever if racing pays too much | Keeps the grades' ratios; G1-heavy careers may average 200 a race, not 150 |
| **Anti-grind is an account-wide Daily Purse in Prize Money**: full to 4,500 (D348, from 6,000), a quarter to 12,000, a twentieth beyond | The loop simulation measures 8% / 22% / flat; robust to G1-only days; never zero; one bar to read. Per-Uma, per-race and first-win rules either punish career bursts or don't bound |
| The purse touches Prize Money only, and sales don't fill it | EXP and goals are progression, never taxed; sales are already time-bounded |
| Featured races ship in v1: 3 a day, first win pays the prize again, outside the purse | A daily goal for the racing mode, cheap to build, bounded at 600 |
| The Exchange sells Speed Tickets and raw ingredients; not Uma Tickets, crafted items or dishes | Racing speeds the Farm up but never skips it; Umas come from progress (D336) |
| Raw stock: grades up to the highest any Uma has ever opened | Never sells the unusable; never shrinks at promotion |
| Speed Tickets: running timers only; Finish rounds up; skipped minutes still pay Farm EXP | uma-rpg's rules, which the owner already knows; a skip buys time, not less progress |
| "Buy and finish" in one tap, with one confirmation | A free evening's money should reach the jobs without a trip to the Exchange |
| Selling: a third of work value, rounded down; reserved stock never offered; dishes, needed stock and sales of 1,000+ confirm | No money pump; the planner protects what the roster still needs |
| The purse day is the device's local date at race start, and never goes backwards | Today's day rule; a time-zone hop can't reopen a spent purse |
| The rules live in `@racer/domain/rework/exchange`, not §9 and §11's `@racer/domain/economy` (D345) | [M033](../game/architecture.md#the-rework-modules) keeps every rework area under `rework/` until phase 3 moves them, when today's `economy.ts` goes |
| The profile carries §9's `purse` and `exchangeGrade` (listed in [13](13-removals-and-plan-changes.md) §6), and phase 3's save carries them. A new account's purse is empty on 1970-01-01, which every race day is later than, and the Exchange stocks grade 1 (D345) | Grade 1 is stocked before the first Uma exists (D323); the first race starts a fresh purse |
| The day comes in as `localDay`, the device's `YYYY-MM-DD` at race start (D345) | A pure rule can't know the time zone |
| "Never two days running" keeps each slot's pool sorted by id and only the indices with the parity of the day's number (days since 1970-01-01). A one-race pool shows its race every other day. Each slot draws once a day, even from an empty pool, and prefers a distance category not yet on the board, slot by slot (D345) | Exact, with no stored history; a slot's draw never depends on an earlier slot's pool |
| The stock counts every current Uma's open grade as well as the stored mark; `sim:loop` raises the mark after each collect, and phase 3 puts that in the collect commit (D345) | Only the Farm's collect raises Farm Level, and the Farm's rules don't depend on the Exchange; so a promotion can't lower the stock |
| Each race rounds down once, after the purse share; §3.4 models day totals, so it is pinned on totals, and race by race it matches exactly at 200 a race and within 1 a race at 150 (D345) | §2.1's "after every multiplier" |
| Surplus is the Free count; "All free" is every unreserved item, which dips into needed and so asks first; a needed-stock confirmation names the planner's whole shortfall after the sale (D345) | §6.1 defines Free as "the rest", then offers "Surplus (free minus needed)"; reserved inputs leave the Warehouse count when work starts ([07](07-farm.md) §2, §12), so the count is what can be sold |
| A race result's `expedition` says the Expedition rate applied: a family not yet won on her run (D345) | It is what the result's "Expedition rate" line shows (§7); a family already won pays the home G1 row |
| **The collect commit raises the stock mark:** `runOnce`, which every owner action passes through on the device and the server, sets `exchangeGrade` to `stockedGrade` over every current Farm Level after an operation applies, a no-op unless a collect (`collect`, `collect-all`, `recall`, `repeat` or `start`'s collect-first) lifted one; a retried id changes nothing (T140, D358) | D345's "phase 3 puts that in the collect commit": one place covers every collect path, and the Farm's rules still don't read the Exchange. `stockedGrade` never goes below the mark, so a promotion can't lower it |
| A race commits at **Start race**, before playback: the attempt is prepared, the timeline simulated, and `finish-race` applied locally and queued; the run (`/racing/racecourse/run?result=:id`) plays the committed row. A commit that fails starts nothing, and the sheet says "That didn't work. Try again." (T141) | §8: settled at the start, so quitting can't change the prize or purse, and a reopen lands on the same race; [01](01-game-loop.md) §2: the race reads her build at its start |
| The prepared build first collects her session's finished unlocks on a copy, as `finish-race` does; the pre-race sheet says "Collects 2 finished unlocks first" (T141) | 01 §2's one tap; the device and the server agree |
| The seed counts her results (`raceAttemptSeed(…, n)`, *n* her `raceResults` rows), and the result's id is the operation's (T141) | Today's seed rule keeps an attempt reproducible; T134 makes the id once-only |
| `localDay`, the device's date at Start race, and the board the screen showed ride in the attempt (T141) | §3.3: the race's day is the day it starts; the bonus is the one the owner saw |
| The `raceResults` row keeps the set she raced with (`cardSetIds`: the preset of the race's distance, after the collect), and the prize receipt the day's gross after the race (`dayGross`) (T141) | Era Loyalist reads every race's set ([06](06-cards-and-bonds.md) §7); the tired and spent lines name the day's gross, and a reload shows the day as it stood |
| The result's header shows the account bar's Prize Money chip alone; the purse's pay and any bonus fly into it on the first showing (T141) | §7 and [11](11-hub-and-places.md) §2.1 fly the prize into the chip; 11 §6 hides the bars in full-screen flows |
| "Gate reached · +1 Uma Shard" shows when the receipt pays one; the hold's line ("Held at Lv 25 · win the Trials") and **Advance** read her as she stands, on her latest result only (T141) | [04](04-tiers-and-promotion.md) §6 pays the Shard in that commit; an older result can't know her hold now |
| The first showing on this device plays the fanfare; a reload or a reopen shows the stored row's result, prize and band quietly (T141) | §7's last line: what was paid is the receipt's, the fanfare this visit's |
| The tired line reads "Tired purse: paid a quarter (6,420 of 12,000)" and the spent line "Spent purse: paid a twentieth (13,100 today)"; the shares' words come from `PURSE_BANDS` (T141) | §7 names only the tired line; the spent band has no upper edge to name |
| The purse bar reads the device's date: a later day is an empty purse; its (i) gives the bands in two lines from `PURSE_BANDS` (T141) | §3.5's bar; the next race starts the new day's purse |
| The strip leads with open goals, then D181's order by lifetime level, then name, finished careers last; a tile reads "T1 · Lv 13" with her work in one chip. **Next Uma** is the next in that order, round to the first (T141) | [11](11-hub-and-places.md) §9.2 |
| Race select opens on the first Uma in the strip; `?uma=&race=` preselects her and opens the pre-race sheet. The sheet's running style starts at her race defaults (her preferences, else today's recommendation) and is not saved (T141) | 11 §9.2's first Uma with an unwon goal; the Uma profile owns `set-race-defaults` (T138) |

## 11. Done when

- `@racer/domain/economy` holds the prize table, the place shares, the Expedition rate, the purse bands, the
  featured draw, the Exchange prices, the stock rule and the sell rule, and tests pin each: a G3 5th pays 7; a G1 win
  at 4,400 gross pays 150; an Expedition win pays 450, and a second win of the same family on that run 300; the
  2026-10-13 board is the same on every run; a grade-5 crafted
  item sells for 55 (D338).
- `pnpm sim:loop` with this page's rules passes [12](12-economy-and-pacing.md)'s checks: target racing saves 5–10%
  of the roster's time and heavy racing 18–25%.
- On the owner's iPhone, a race's result shows its Prize Money line with any Expedition rate, bonus and band, and the
  account bar's chip changes by the same amount.
- A retried `buy`, `sell` or `speed-up` returns its first receipt, and the balance moves once. A `buy` at a stale price
  is refused with nothing charged.
- The Warehouse never offers reserved stock for sale, and selling a dish or needed stock asks first.
- A Speed Ticket on a three-item job moves all three ends by 30 minutes; Finish spends ⌈minutes ÷ 30⌉ and the job pays
  its full Farm EXP.
- The ledger audit (deltas sum to balances) passes on a simulated month and on the owner's save.
- The Racecourse shows today's three featured races and the purse bar; both reset at local midnight.
