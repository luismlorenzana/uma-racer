# 12 · Economy and pacing

> **Status: approved design, 2026-10-14 (D326, D331, D334, D336, D338); measured by `pnpm sim:loop` (D348).** The
> model of §4 sized the first draft; the loop simulation (§12) now measures the pace on the rules themselves, and its
> tables here are live blocks rendered from that run. Every check passes since the owner's pacing calls (D351): the
> Pantry's fifth slot, a new account's first scenario read as its ramp, and tiers 2–3 at 18–28 days a scenario.
> If a page elsewhere quotes a number from here and the sim later moves it, this page and the sim win.

This page answers: how long things take, what the currencies are, where they come from and go, and how we know the
game hits the owner's target. Other pages own the rules; this one owns the arithmetic that ties them together.

## 1. The target (D334)

The owner's words: "4 weeks to fully max a Tier, however, remember that passive generation means I can have multiple
umas in parallel, so maybe we take that into consideration with 4 weeks to max a scenario for 25 Umas?"

**Read as:** a roster of **25 Umas** working in parallel takes **about 4 weeks to max one scenario**, so a tier takes
the roster **about 20 weeks**.

**"Max a scenario"** means two things, for every Uma in the roster:
- every unlock of that scenario's layer is done: nodes, Inspiration, Extra Stats and bonds ([05](05-training-hub.md));
- her career is complete: the G3, both G2s and all three G1s are won, so she sits at the gate ([03](03-uma-progression.md)).

The target is met with:
- three check-ins a day;
- the owner's normal racing, about 12–13 races a day across the roster (§8);
- no Speed Tickets spent.

Heavier racing makes it faster (§8). If the owner meant "a whole tier in 4 weeks", that is a single time-scale
change (§10), not a redesign.

**How the owner plays it (D336).** The owner expects to finish the passive layer first and then race the career, not to
race on a timetable. So the numbers here don't depend on when races happen within a scenario: the layer is the clock,
and the career races fit after it. Racing difficulty is tuned for a fully trained Uma ([03](03-uma-progression.md) §9).

## 2. Currencies and stocks

After the rework the account has **three currencies and one inventory**. Everything else is gone ([13](13-removals-and-plan-changes.md)).

| Thing | Earned | Spent | At promotion |
|---|---|---|---|
| **Prize Money** | Races ([09](09-racing-rewards-and-exchange.md)); selling surplus items | The Exchange; building and facility upgrades | Account-wide, carries |
| **Speed Tickets** | Bought at the Exchange (30 Prize Money) | 30 minutes off one running job or session | An item, carries |
| **Uma Tickets** | 20 at the start; 5 Uma Shards make one (each scenario gate an Uma reaches pays 1 Shard); 1 per promotion. **Not sold** (D336) | Unlocking an Uma into tier 1 | Account-wide, carries; only usable in tier 1 |
| **Items** | Farm jobs (raw, crafted, dishes) | Farm jobs (inputs), Training Hub sessions (dishes), selling | The Warehouse carries; reserved inputs follow [04](04-tiers-and-promotion.md) |

**Removed currencies:**
- Training Tickets and their daily grant;
- Card Select Coupons (Uma Select Coupons are kept, renamed Uma Tickets, and Uma Shards still make them);
- Inspiration Slot and Skill tokens;
- Puzzle materials and Legacy Universal CL Tickets;
- Energy, which becomes the Speed Ticket;
- the RPG's tokens.

### The anchor: 1 Prize Money ≈ 1 minute of Uma work

Every price in Prize Money is set from one rule: **one Prize Money is worth about one minute of an Uma's work**.
- A Speed Ticket skips 30 minutes and costs 30.
- A raw grade-1 ingredient (108 minutes to gather at *k* = 1.2) costs 108 at the Exchange.
- Selling pays a third of an item's work value, so the Exchange can't be used to launder time.
- Upgrades are priced as the Uma-time they save.

One anchor keeps every trade honest. Racing converts the owner's free time into Uma time at a known rate, and no loop
mints time from nothing.

## 3. Sources and sinks

```
           ┌──────────────── races ────────────────┐
           ▼                                       │
     Prize Money ──▶ Exchange ──▶ Speed Tickets ───┼──▶ shorter jobs and sessions
           │             │                         │
           │             └──▶ raw ingredients ─────┼──▶ Farm
           └──▶ upgrades (buildings, facilities) ──┘
 surplus items ──(a third of work value)──▶ Prize Money

 Uma time ──▶ Farm jobs ──▶ raw ──▶ crafted ──▶ dishes ──▶ Training Hub sessions ──▶ unlocks ──▶ stronger in races
```

| Flow | Size at the target, measured over tier 1 (§12) |
|---|---|
| Uma work per day (the roster grows from 20 to 25; 67% of its time works) | **about 380 Uma-hours** |
| Of which Farm jobs | about 310 h (83%) |
| Of which Training Hub sessions | about 65 h (17%) |
| Unlocks finished per day, roster-wide | **about 19** |
| Races per day at the target | about 13 |
| Prize Money per day from those races | about 1,850 (**about 8%** of the roster's work time) |

The first-draft model put the day at 450 Uma-hours (25 Umas working 75% of the day). The sim's roster starts at 20,
reaches 25 in its ninth week, and works about two-thirds of the time: most of the rest is the wait between a job's end
and the next check-in (§11).

## 4. The time model

**Every step takes real time from start timestamps**, so closed and offline time counts. Base formulas per grade *g*
(README "Time model"); every one is multiplied by the time factor ***k* = 1.2** (§10, D338), so the real "one unlock"
is 19.7 hours at grade 1 and 29.5 at grade 10:

| *g* | Gather (min) | Craft (min) | One crafted item (min) | Cook (min) | A planet dish's chain (min) | Session (min) | **One unlock at *k* = 1 (h)** |
|---|---|---|---|---|---|---|---|
| 1 | 90 | 22.5 | 112.5 | 240 | 802 | 180 | **16.4** |
| 2 | 95 | 23.8 | 118.8 | 250 | 838 | 195 | **17.2** |
| 3 | 100 | 25.0 | 125.0 | 260 | 872 | 210 | **18.0** |
| 4 | 105 | 26.2 | 131.2 | 270 | 914 | 225 | **19.0** |
| 5 | 110 | 27.5 | 137.5 | 280 | 955 | 240 | **19.9** |
| 6 | 115 | 28.8 | 143.8 | 290 | 996 | 255 | **20.9** |
| 7 | 120 | 30.0 | 150.0 | 300 | 1,038 | 270 | **21.8** |
| 8 | 125 | 31.2 | 156.2 | 310 | 1,079 | 285 | **22.7** |
| 9 | 130 | 32.5 | 162.5 | 320 | 1,120 | 300 | **23.7** |
| 10 | 135 | 33.8 | 168.8 | 330 | 1,161 | 315 | **24.6** |

A planet dish's chain is:
- four crafted items of its family at grade *g*;
- one crafted side at max(1, *g*−2);
- the cook.

Duos and Feasts are sized close to it ([08](08-item-catalogue-and-recipes.md)).

**Why grades barely change the time.** Grade 10 takes 1.5× grade 1, where uma-rpg's took 5.5×. The owner's target is
the same four weeks for every scenario. A steep grade curve would make scenario 5 three times slower than scenario 1,
so the grade is mainly a **marker** of which layer an unlock belongs to, not a cost multiplier. Volume does the
pacing: each unlock needs five crafted items and a session.

**Why one item takes 90 minutes, not 6 hours.** Today's Farm makes six items at the end of a 6-hour job. Here an Uma
makes items one after another, so a short check-in still collects something, and a job of 1–10 items can be sized to
the next check-in or to the night ([02](02-check-ins-and-notifications.md)).

## 5. Sizing a scenario

Per Uma, per scenario layer ([05](05-training-hub.md)), the rules' own work (her dishes' whole chains and her
sessions, at a Lv 1 building) and the days the founding cohort took, measured from her entry to the moment her layer
and career are both done:

<!-- live:loop-scenarios -->
| Scenario of the tier | Grades | Unlocks | Uma-hours | Farm work | Sessions | Days, tier 1 (p10–p90) | Days, tier 2 · tier 3 |
|---|---|---|---|---|---|---|---|
| 1 | 1–2 | 27 | 539 | 439 (82%) | 100 | **38.0 (30.6–50.2)** | 22.0 · 22.8 |
| 2 | 3–4 | 23 | 506 | 408 (81%) | 98 | **28.0 (6.2–35.8)** | 22.6 · 23.8 |
| 3 | 5–6 | 21 | 510 | 408 (80%) | 102 | **26.6 (18.6–42.4)** | 21.4 · 21.4 |
| 4 | 7–8 | 19 | 507 | 402 (79%) | 104 | **24.4 (6.4–28.0)** | 27.8 · 24.6 |
| 5 | 9–10 | 17 | 492 | 388 (79%) | 104 | **25.0 (10.2–29.8)** | 18.2 · – |
| **Tier** | | **107** | **2,554** | | | **20.9 weeks** | 16.9 · 14.5 weeks |
<!-- /live -->

At *k* = 1.2 (D338). D336's 24 Inspiration unlocks (6 slots, 6 inherited uniques, 12 golds) are spread 4, 6, 4, 6, 4
across the scenarios. Each scenario's five Gym singles sit at its first grade (D338). Each bond is the representative
deck's card of the scenario's own era, at grade 2*s* − 1 ([06](06-cards-and-bonds.md) §2, [08](08-item-catalogue-and-recipes.md) §7).
Duos and Feasts are priced like a planet dish of their grade.

How to read it:
- **An Uma's own layer is about 500 hours of somebody's work**, as the first draft said; the roster shares it, and one
  Uma's dishes are often cooked by others.
- **The tier takes about 20 weeks**, D334's target, with the cohort travelling together: the planner serves the Umas
  furthest behind first (§12), so each scenario ends for most of the cohort within a few days.
- **Scenario 1 of a new account is its ramp, about 5½ weeks** (the owner's reading, D351). Every building is at Lv 1,
  every Uma starts at Farm Lv 1, the Warehouse is empty, and no Prize Money comes in until the first careers are raced
  at the end of the layer, so the first upgrades land around day 31. It happens once, at the start of the new game.
- **The later scenarios of tier 1 run about 3½ to 4 weeks** (24–28 days on the committed seed). By then the roster is
  25, every building reaches Lv 3 by about day 65 (×1.25 speed), and Prize Money buys Speed Tickets. Tiers 2 and 3,
  fully upgraded from the start, run 18–28 days a scenario.

**Why *k* = 1.2 stays.** The sim tried the nearest faster step that keeps raw prices in whole minutes, *k* = 1.0
([09](09-racing-rewards-and-exchange.md) §5): it takes tier 1 to about 17 weeks and most later scenarios under 20 days.
At 1.2 the tier lands at 20 weeks; the uneven shape inside it is the first scenario's cold start, which no single
factor fixes (D348).

**Layers are front-loaded on purpose.** Scenario 1 has 27 cheap unlocks (12 nodes, 6 bonds), and scenario 5 has 17
dear ones, so each scenario's layer costs about the same Uma-time. The measured shape says the upgrades and Speed
Tickets reward a later scenario more than the front-loading takes from it.

**The first day of a new account.** All twenty Umas can gather at once. If the owner checks in at every finish and
starts each job at ×1, the first dish comes out of the Kitchen mid-afternoon and **the first unlock lands 12 hours after
the first check-in**, on the first evening (the probe, §12). At the normal three check-ins, jobs fitted to the next check-in
stretch it into the second day. Racing is open from minute one, though a brand-new Uma mostly loses until her first
unlocks land: races are tuned for a trained Uma ([03](03-uma-progression.md) §9).

## 6. Farm Level timing

Farm EXP is 1 per minute of Farm work × the Uma's running aptitude for the family, and level *L* → *L*+1 costs
480 + 5(*L*−1) ([07](07-farm.md) §3–§4). Working without a break, that's the owner's **2–3 levels a day, 4–5 when
suited** (D336). The day columns assume an average Uma farming 864 minutes a day (80% of her 75%); the last column is
what the founding cohort measured in tier 1:

<!-- live:loop-farm-levels -->
| Grade | Farm Lv | EXP | Day at C (×1.0) | Mixed (×1.3) | Always suited (×1.6) | Founding cohort, measured (median day) |
|---|---|---|---|---|---|---|
| 1 | 1 | 0 | 0 | 0 | 0 | 0.0 |
| 2 | 6 | 2,450 | 3 | 2 | 2 | 2.0 |
| 3 | 11 | 5,025 | 6 | 4 | 4 | 4.0 |
| 4 | 16 | 7,725 | 9 | 7 | 6 | 6.0 |
| 5 | 21 | 10,550 | 12 | 9 | 8 | 8.2 |
| 6 | 26 | 13,500 | 16 | 12 | 10 | 10.6 |
| 7 | 31 | 16,575 | 19 | 15 | 12 | 13.0 |
| 8 | 36 | 19,775 | 23 | 18 | 14 | 15.6 |
| 9 | 41 | 23,100 | 27 | 21 | 17 | 19.2 |
| 10 | 46 | 26,550 | 31 | 24 | 19 | 22.2 |
| (Lv 50) | 50 | 29,400 | 34 | 26 | 21 | |

The day columns are 864 Farm minutes a day. Working without a break, from Farm Lv 1 to 21 at a Lv 1
building, an Uma gains 2.71 levels a day at C, 4.32 at A and 4.83 at S (the probe).
<!-- /live -->

**Every grade is open within about three weeks of a tier** for the cohort, which farms more than the average day and
spreads each Uma over her suited families, while the tier runs about 20 weeks. So Farm Level is a quick climb at the
start of each tier (and for an Uma who joins mid-tier), never what holds a scenario back. **Which grade each unlock
asks for is a rule of the layers** ([05](05-training-hub.md) §3): scenario *s* asks for grades 2*s*−1 and 2*s*, so each
scenario's demand lands on its own two grades and the Farm's mix moves up the ladder with the roster.

- No Farm Level cap is needed: the level is a short ramp, and the layers do the pacing.
- An Uma who joins mid-tier reaches the top grades in about three weeks; meanwhile the shared Warehouse and
  higher-level Umas cover what she can't make yet.
- Farm Level resets at promotion ([04](04-tiers-and-promotion.md)), and each tier starts with the same quick climb.

## 7. Capacity: slots

A slot is held from a job's start until Collect, so it sits idle between an Uma's last item and the next check-in,
just as she does. The sim counts that held time ([07](07-farm.md) §6, [05](05-training-hub.md) §7). Over tier 1, at
the spending policy's upgrade dates:

<!-- live:loop-capacity -->
| Building | Slots Lv 1 / 2 / 3 | Hours a day held, tier 1 | Running | Peak use (scenario) | Bottleneck hours | Lv 2 / Lv 3 on day |
|---|---|---|---|---|---|---|
| Sugar Grove | 2 / 3 / 3 | 20.8 | 17.1 | 40% (2·2) | 5 | 32 / 47 |
| Orchard | 2 / 3 / 3 | 20.8 | 17.2 | 40% (3·2) | 0 | 33 / 41 |
| Fishery | 2 / 3 / 3 | 19.9 | 16.7 | 39% (2·2) | 0 | 32 / 63 |
| Nut Grove | 2 / 3 / 3 | 20.5 | 16.6 | 41% (1·3) | 0 | 34 / 57 |
| Herb Garden | 2 / 3 / 3 | 19.6 | 16.3 | 43% (1·3) | 0 | 33 / 64 |
| Fields | 2 / 3 / 3 | 27.3 | 22.8 | 57% (2·3) | 43 | 34 / 41 |
| Vegetable Garden | 4 / 5 / 5 | 44.0 | 37.4 | 63% (2·1) | 0 | 34 / 51 |
| Mushroom Cave | 2 / 3 / 3 | 38.0 | 32.1 | 76% (3·4) | 0 | 32 / 55 |
| Pantry | 3 / 5 / 5 | 67.6 | 44.4 | 80% (2·3) | 48 | 33 / 46 |
| Kitchen | 6 / 8 / 8 | 124.2 | 82.6 | 79% (2·5) | 499 | 31 / 40 |
| Observatory | 2 / 3 / 3 | 29.1 | 17.9 | 76% (3·1) | 5 | 31 / 57 |
| Lineage Hall | 2 / 3 / 3 | 26.3 | 14.8 | 54% (2·2) | 15 | 31 / 61 |
| Gym | 5 rooms × 1 / 2 / 2 | 45.6 | 21.0 | 31% (3·3) | 24 | 32 / 63 |
| Dojo | 6 rooms × 1 / 2 / 2 | 25.4 | 11.1 | 17% (2·1) | 0 | 31 / 64 |
<!-- /live -->

- **The Kitchen is the busiest building**, about 130 slot-hours a day, and the Pantry the fullest: the planner fills
  its slots at nearly every check-in, so it takes a fifth slot at Lv 2 and 3 (D351) and peaks at about 80%. The Mushroom Cave runs hot in
  the scenarios with six Inspiration unlocks.
- **Lv 1 carries the 20-Uma start, and the roster grows to 25 as the first Lv 2s land.** Every Lv 2 is bought between
  days 31 and 34 of a new account, as the first careers pay, and every Lv 3 by about day 65.
- The stat sites, the Gym and the Dojo run well under half full: their slots are sized for the start of a tier, when
  every Uma bonds and trains at once.
- Upgrades buy headroom above these averages, so the owner can catch up after a missed day.

### Upgrades and the pace

Building and facility upgrades are the account's and carry through promotion. **Lv 3 adds ×1.25 speed**, so once the
Farm and Training Hub are at Lv 3 an unlock costs about 80% of its listed Uma-time. All twenty-eight upgrades cost
68,100 Prize Money (51,300 for the Farm, [07](07-farm.md) §7, and 16,800 for the Training Hub, [05](05-training-hub.md)
§7), and the sim's account buys them all in its first ten weeks. That is the upgrade reward, and it shows: tier 1's
later scenarios and tiers 2 and 3 run about three weeks a scenario (§5). If the owner wants later tiers held to four
weeks, the time factor *k* can be set per tier (§10).

## 8. Racing's share: Prize Money and Speed Tickets

The owner races each Uma's career once her layer is done (D336), so racing bunches at the end of each scenario: the
cohort's days of finishing are its racing days. Measured over tier 1:

<!-- live:loop-racing -->
| Racing day | Races a day, tier 1 | Prize Money a day | Speed Tickets bought a day, tier 1 | Time saved | Tier 1 |
|---|---|---|---|---|---|
| Target: her career once her layer is done | 13.1 | 1,791 | 44 | **8.1%** | 20.9 weeks |
| Heavy: G1s at 22:30 to 40 races a day | 34.8 | 4,438 | 131 | **22.9%** | 20.5 weeks |
<!-- /live -->

- **Racing buys real progress without replacing the Farm.** The Daily Purse ([09](09-racing-rewards-and-exchange.md)
  §3) flattens returns past a heavy day, so racing can't make timers meaningless. The sim moved its first edge from
  6,000 to 4,500 (D348): at 6,000 a heavy evening of G1s saved 29% of the roster's work time, past the 18–25% the
  owner set; at 4,500 it saves about 22%, and the normal day about 8%.
- **The Prize Money goes to upgrades first**, all twenty-eight in the first ten weeks, then to Speed Tickets, which the
  owner spends at each check-in.
- **Prize Money doesn't buy Umas** (D336). The roster grows the normal way, from Uma Shards (§9).

## 9. The roster over time

The baseline unlocks the 20 Umas a new account's tickets buy, turns every five Uma Shards into a ticket, spends tickets
until the roster is 25 and then holds them. The founding cohort is the 20 day-0 Umas:

<!-- live:loop-roster -->
| When | Roster | What |
|---|---|---|
| Day 0 | 20 | The founding cohort: a new account's 20 Uma Tickets, all spent |
| Day 32 | 21 | An Uma Ticket from five Uma Shards (a Shard a gate) |
| Day 38 | 22 | An Uma Ticket from five Uma Shards (a Shard a gate) |
| Day 40 | 23 | An Uma Ticket from five Uma Shards (a Shard a gate) |
| Day 47 | 24 | An Uma Ticket from five Uma Shards (a Shard a gate) |
| Day 63 | 25 | An Uma Ticket from five Uma Shards (a Shard a gate) |
| Day 141 | | Tier 1: the cohort's median Uma starts her Expedition |
| Day 147 | | Tier 1: the cohort's median promotion |
| Day 258 | | Tier 2: the cohort's median Uma starts her Expedition |
| Day 265 | | Tier 2: the cohort's median promotion |
| Day 359 | | Tier 3: the cohort's median Uma starts her Expedition |
| Day 366 | | Tier 3: the cohort's median Hall of Fame |
| End of the run | 25 | 137 Uma Tickets held: the roster stays at 25 |
<!-- /live -->

**Roster size doesn't change an Uma's pace, as long as slots keep up.** Each Uma's own layer is about 500 Uma-hours,
and each Uma brings her own hours, so more Umas just means more of them finishing. The 25 is a **capacity** figure:
the sim's fixed rosters of 20, 25 and 30 all finish tier 1 in 19–21 weeks, while a roster that grows with every ticket
fills every slot and slows to about 42 weeks (§11). So the owner holds spare Uma Tickets (they never expire) once the
roster is about 25.

**Tiers overlap.** Promotions are per Uma, so the account soon has Umas in two tiers. The Farm and Training Hub serve
both: grades are the same in every tier, and tier 2 asks for the same dishes. Tier 2 is harder in **races and
Expeditions** (stronger fields, higher caps, mechanics; [04](04-tiers-and-promotion.md), [10](10-expeditions.md)), not
in Farm time. The placeholder Expedition (18, 20 and 23 races at three a day, until phase 9's) takes about a week, so
promotions follow about a week after the cohort's last careers.

## 10. The whole game's length

| | Roster time (measured, §12) |
|---|---|
| One scenario | About 3–4 weeks: 5½ for a new account's first, about 3 once the buildings are at Lv 3 |
| One tier, with its Expeditions | About 20 weeks for tier 1, 17 for tier 2, 14 for tier 3's four scenarios |
| Three tiers | **About 51 weeks (12 months)** for the founding cohort to reach the Hall of Fame |

That's long by design: an idle game the owner checks two or three times a day and races in when free. It's also one
number to change. **Every duration** (gather, craft, cook, session) **scales with one time factor *k***, **1.2** since
D338:

| *k* | Scenario | Tier | Game |
|---|---|---|---|
| **1.2** | ~3–4 weeks | ~20 weeks | ~12 months |
| 0.6 | ~2 weeks | ~10 weeks | ~7 months |
| 0.25 | ~6 days | ~4 weeks | ~3 months: the "4 weeks a tier" reading |

Expedition racing is the owner's time, not Uma time, so *k* doesn't shorten it. At *k* = 0.25 the ~500 Expedition
races of a tier would take about as long as the tier's training, which matters if the owner picks that reading.

## 11. Levers, in the order to try them

If the sim or the owner's play says it's too slow or too fast:

1. **The time factor *k*** (§10): moves everything at once, keeps every ratio.
2. **Layer sizes** ([05](05-training-hub.md)): fewer unlocks per layer shorten every scenario. D338 already halved
   the Gym's singles; the next candidate is the bonds' pacing assumption ([06](06-cards-and-bonds.md)).
3. **Crafted items per dish** (4 + 1 now): fewer makes cooking dominate; more makes gathering dominate.
4. **Utilisation**: queues and Repeat raise it, and so would push notifications if the owner adopts them ([02](02-check-ins-and-notifications.md) §7).
   The sim measures it (share of Uma-time with work running, tier 1):

<!-- live:loop-utilisation -->
| Check-ins | Racing | Utilisation, tier 1 | Tier 1 | Races a day | Time saved by racing |
|---|---|---|---|---|---|
| One (08:00) | Target | 48% | **28.2 weeks** | 9.6 | 9.4% |
| Two (08:00, 22:30) | Target | 64% | **21.4 weeks** | 12.2 | 8.3% |
| Three (08:00, 13:00, 22:30) | Target | 65% | **20.9 weeks** | 13.1 | 8.1% |
| Three | Heavy | 57% | **20.5 weeks** | 34.8 | 22.9% |
<!-- /live -->

   Three check-ins work about two-thirds of the time, not the first draft's 75%. Most of the rest is the wait between
   a job's end and the next check-in: at *k* = 1.2 a dish takes 4.8–5.4 hours, so one cook fills a 9.5-hour gap only
   halfway. The baseline's owner already queues more crafts behind a craft that ends early (D348), which keeps the
   Pantry from becoming a permanent bottleneck. Two check-ins (08:00 and 22:30) cost about a week a tier; one costs
   about seven.

5. **Prize Money per race and the Daily Purse's edge** ([09](09-racing-rewards-and-exchange.md) §2, §3.4): change how
   much racing speeds things up, not the passive pace. The purse edge is the lever if racing that bunches at the end of
   each layer (D336) leaves racing's share under the target.

### Resolved: Gym sessions felt small (D338)

The first draft made Extra Stats 47% of all unlocks (62 of 132), each paying +20 to one stat, while an Observatory node
pays a card node: about 130–280 raw points spread by the card's type. Half the owner's sessions would have felt like the
least rewarding half. **The owner adopted the recommendation on 2026-10-14:** one single per stat per scenario at +40,
Duos +20/+20 and Suns +8 to all five, active capacity halved to 7–15, so the Extra Stats budget is unchanged
([05](05-training-hub.md) §6). Layers shrink from 132 to 107 unlocks a tier, and *k* = 1.2 keeps the four weeks (§5).

## 12. The loop simulation

`pnpm sim:loop` (D348), a deterministic, seeded, headless run of the whole economy from a fresh account, on the
domain's rules only: every change of state is an operation of `@racer/domain/rework/*`. Its pure core is
`@racer/domain/rework/sim`; `scripts/sim/loop.ts` prints the report, with `--variant=<name>`, `--matrix` and `--json`.
The loop test runs it in CI.

**What it simulates (the baseline):**
- A fresh account (13 §5): 20 Umas at day 0, synthetic Uma templates rotated so each distance and running style is A
  for an equal share; more as Uma Shards make tickets, up to 25.
- **Three check-ins** at 08:00, 13:00 and 22:30 (local time = UTC). Each one collects everything, races, advances and
  promotes, spends, Repeats what the planner still needs, then starts the planner's suggestions.
- **Idle Umas take the planner's suggestion** ([02](02-check-ins-and-notifications.md) §6): her own session first,
  else the largest shortfall of the first target she can work for, sized to the next check-in. The owner marks the
  targets five at a time, **furthest behind first** (the lower scenario, then the most unlocks left), and starts the
  suggestions again for the next five while Umas are left without one.
- **Queues** ([02](02-check-ins-and-notifications.md) §3): a craft that ends before the next check-in queues up to three
  more crafts behind it, fitted to the time and the stock.
- **Bonds:** the representative deck ([08](08-item-catalogue-and-recipes.md) §7), each card of its scenario's era; a
  new bond fills an empty slot of her race preset.
- **Racing** (D336): each Uma races her career once her layer is done, at the check-in: her next goal race in stage
  order, then G1s at her distance, until she is at the gate; a loss retries. Places come from a **win table** of the
  race engine's results for the ladder's Medium set at 0, 50 and 100% of her layer, against T125's rival fields
  (generated offline, `--refresh-wins`, and committed).
- **The Expedition** (a placeholder until phase 9): 18, 20 and 23 races in tiers 1–3, three a day, eight wins.
- **Spending:** Prize Money buys every Lv 2 upgrade, then every Lv 3, busiest building first, saving toward the next
  one and making its crafted items first; then Speed Tickets, spent at each check-in on running sessions, then jobs.
- **Variants:** racing (heavy evenings of G1s to 40 races a day; no pay; racing as unlocks land), check-ins (one or
  two), the roster (fixed at 20, 25 or 30, or growing with no cap), buildings frozen at Lv 1.

**What it reports:** days per scenario and per tier (the founding cohort's median, 10th and 90th percentiles); slot use
per building and facility per scenario window, held and running, with the hours each was the bottleneck; idle Uma-hours
by reason; the Warehouse each week; Prize Money in by purse band and out by upgrade and ticket; Speed Ticket minutes;
races a day; the roster, tickets and upgrade dates. Two probes stand beside it: **Farm Levels a day** (one Uma at a
Lv 1 building working without a break, Lv 1 to 21) and **the first unlock** (a fresh account, the owner checking in at
every finish on day 0).

**Its partner, `pnpm sim:expeditions`** ([10](10-expeditions.md)), runs fully trained Umas through every Expedition in
every tier with real race engine runs. It will pin how many races an Expedition takes and the win rate per tier, and
the loop sim will read its median race count instead of the placeholder.

**What CI pins** (the owner's tolerances; only the owner's decision moves one, D351):

| Check | Range |
|---|---|
| A new account's first scenario, its ramp | within 6 weeks (42 days) |
| Each later scenario of tier 1, 25 Umas, three check-ins, target racing, the spending policy | 24–32 days |
| Each scenario of tiers 2 and 3 (buildings at Lv 3) | 18–28 days |
| Tier 1 | 19–23 weeks |
| Any building's slot use in a scenario window, with the spending policy | ≤ 90% (no permanent bottleneck) |
| Time saved by target racing / by heavy racing | 5–10% / 18–25% |
| Farm Level, working without a break | 2–3 levels a day at C, 4–5 at A or S, early in the tier |
| The first unlock on a fresh account | within 12 hours |

**What it measures:**

<!-- live:loop-checks -->
| Check | Range | Measured | Result |
|---|---|---|---|
| A new account's first scenario | ≤ 42 days | 38.0 | pass |
| Days in each later scenario of tier 1 | 24–32 days | 28.0, 26.6, 24.4, 25.0 | pass |
| Days in each scenario of tiers 2 and 3 (buildings at Lv 3) | 18–28 days | 22.0, 22.6, 21.4, 27.8, 18.2, 22.8, 23.8, 21.4, 24.6 | pass |
| Tier 1 | 19–23 weeks | 20.9 | pass |
| Every building's and facility's slot use, in every scenario window | ≤ 90% | 80.2% | pass |
| Time saved by target racing | 5–10% | 8.1% | pass |
| Time saved by heavy racing | 18–25% | 22.9% | pass |
| Farm Levels a day early in a tier, at C | 2–3 levels a day | 2.71 | pass |
| Farm Levels a day early in a tier, at A and S | 4–5 levels a day | 4.32, 4.83 | pass |
| First unlock on a fresh account | ≤ 12 hours | 12.0 | pass |
<!-- /live -->

**How the two first-run misses closed (D351).** The loop first measured tier 1's scenarios at 38, 30, 23, 24 and 22
days and the Pantry at 91.5% (D348). The owner chose the Pantry's fifth slot, which evens tier 1's later scenarios
(28, 27, 24, 25) and brings the Pantry to 80%. The first scenario's cold start is read as the new account's ramp, and
tiers 2–3, a little quicker with every building at Lv 3, at 18–28 days. On other seeds the tier still takes 20.4–20.9
weeks, while a later tier-1 scenario can dip to about 20 days, so the committed seed is the one the range pins.

## 13. Decided here

| Choice | Why |
|---|---|
| The Pantry has five slots at Lv 2 and 3; a new account's first scenario is its ramp (≤ 6 weeks); tiers 2–3 run 18–28 days a scenario (D351) | The owner's pacing calls on the loop's first run: the fifth slot evens tier 1's later scenarios and ends the Pantry bottleneck |
| Read the target as "25 Umas max a scenario in ~4 weeks", a tier ~20 weeks | The owner's own refinement of "4 weeks a tier"; the time factor (§10) covers the other reading |
| One anchor: 1 Prize Money ≈ 1 minute of Uma work | Every price follows from it, and no trade mints time |
| Grades barely change times (×1.5 from grade 1 to 10) | Keeps every scenario at about four weeks; grades mark which layer an unlock belongs to |
| No Farm Level cap | Farm Level is a short ramp at the owner's 2–3 levels a day (4–5 suited); the layers do the pacing |
| Front-loaded layers (27 → 17 unlocks) | Equal time per scenario, and quick wins at the start of each tier |
| Half the Gym's singles at twice the value, *k* = 1.2 (D338) | Every session is worth having; the four weeks hold |
| Tier 2 and 3 cost the same Farm time | Higher tiers are harder in races and Expeditions; Farm time stays predictable |
| Speed Tickets are not counted in the target | The target holds without them; racing is a bonus the owner earns |
| The Kitchen is sized as the busiest building | Cooking is 30% of all Farm work |
| Lv 3 speed shortens later scenarios to ~20–24 days, and that's accepted | It's the reward for upgrading; tier 1 still runs about 20 weeks, and *k* per tier can hold later tiers if wanted |
| The roster grows from Uma Shards, not Prize Money (D336) | The owner's rule; roster size doesn't change an Uma's four weeks, only how many finish them |
| Racing assumes a trained Uma (D336) | The owner finishes the passive layer first; difficulty and the sim follow that |
| The loop simulation measures the pace; its tables here are live (D348) | The first-draft model assumed 75% utilisation; the rules give about 67% at three check-ins |
| The planner's targets are marked furthest behind first in the sim (D348) | Automatic targets rank by unlocks left in the open layers, so an Uma one dish from advancing waits behind every Uma who has advanced |
| The Daily Purse's first edge is 4,500 (D348) | At 6,000 a heavy evening saved 29% of the roster's work time, past the owner's 18–25% |

## 14. Done when

- `pnpm sim:loop` runs on a fresh synthetic account with the domain's real rules and reports §12's metrics.
- CI fails if any §12 check leaves its range.
- This page's tables are live blocks rendered from the domain constants (in this page until phase 3 moves it into the
  manual, `docs/game/`), so the numbers here can't drift from the code.
- After four weeks of the owner's real play on the new game, the measured pace (scenario 1's completion across the
  roster) is within 25% of the sim. If it isn't, the time factor is retuned and logged as a decision.
