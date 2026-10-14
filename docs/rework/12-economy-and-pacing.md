# 12 · Economy and pacing

> **Status: approved design, 2026-10-14 (D326, D331, D334, D336, D338).** Every number here is a draft from a first-pass
> model (§4–§9). D338 halved the Gym's singles and set the time factor *k* = 1.2: §5, §10 and §11 are recomputed for it;
> the Farm building tables in §7 are still the first draft's, and the loop simulation recomputes them in phase 2. The loop simulation (§12) replaces the model, and the sim's checks become the tests that pin the
> numbers. If a page elsewhere quotes a number from here and the sim later moves it, this page and the sim win.

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

| Flow | Size at the target (draft) |
|---|---|
| Uma work per day (25 Umas × 24 h × 75%) | **450 Uma-hours** |
| Of which Farm jobs | ~360 h (80%) |
| Of which Training Hub sessions | ~90 h (20%) |
| Unlocks finished per day, roster-wide | **~22** |
| Races per day at the target | ~12–13 |
| Prize Money per day from those races | ~1,900 (≈ 31 Uma-hours, **~7%** of the roster's day) |

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

Per Uma, per scenario layer ([05](05-training-hub.md)):

| Scenario of the tier | Grades | Unlocks | Uma-hours | Farm work | Sessions | **Days for 25 Umas** |
|---|---|---|---|---|---|---|
| 1 | 1–2 | 27 | 539 | 439 (82%) | 100 | **29.9** |
| 2 | 3–4 | 23 | 504 | 405 (81%) | 98 | **28.0** |
| 3 | 5–6 | 21 | 508 | 405 (80%) | 102 | **28.2** |
| 4 | 7–8 | 19 | 504 | 399 (79%) | 104 | **28.0** |
| 5 | 9–10 | 17 | 488 | 385 (79%) | 104 | **27.1** |
| **Tier** | | **107** | **2,542** | | | **141 days ≈ 20 weeks** |

At *k* = 1.2 (D338). D336's 24 Inspiration unlocks (6 slots, 6 inherited uniques, 12 golds) are spread 4, 6, 4, 6, 4
across the scenarios. Each scenario's five Gym singles sit at its first grade (D338). Duos and Feasts are priced like a
planet dish of their grade.

**Why *k* = 1.2.** The first draft had 132 unlocks a tier at *k* = 1 (147 days). D338's 107 unlocks at *k* = 1 would
take 118 days, about 23–25 a scenario, below four weeks. Raising every duration by a fifth brings each scenario back to
27–30 days and the tier to about 20 weeks, D334's target. Each remaining unlock is worth more, so the time is spent
better.

How to read it:
- An Uma's own layer takes about 500 hours of somebody's work.
- With 25 Umas each working 75% of the day (18 hours), the roster finishes about 19 unlocks a day.
- So 25 layers of 17–27 unlocks take about four weeks.
- The roster shares the work: one Uma's dishes are often cooked by others.

**Layers are front-loaded on purpose.** Scenario 1 has 27 cheap unlocks (12 nodes, 6 bonds), and scenario 5 has 17
dear ones. Each scenario then costs about the same time, and a new tier starts with many quick wins.

**The first day of a new account.** All twenty Umas can gather at once, so the first grade-1 dish is ready about six
hours in: gathering in parallel ~1.5 h, crafting ~0.5 h, cooking 4 h. The first unlock lands three hours after that,
on the first evening. Racing is open from minute one, though a brand-new Uma mostly loses until her first unlocks land:
races are tuned for a trained Uma ([03](03-uma-progression.md) §9).

## 6. Farm Level timing

Farm EXP is 1 per minute of Farm work × the Uma's running aptitude for the family, and level *L* → *L*+1 costs
480 + 5(*L*−1) ([07](07-farm.md) §3–§4). Working without a break, that's the owner's **2–3 levels a day, 4–5 when
suited** (D336). An average Uma farms 864 minutes a day (80% of her 75%), so:

| | At C (×1.0) | Mixed, well assigned (×1.3) | Always suited (×1.6) |
|---|---|---|---|
| Grade 2 (Lv 6) | day 3 | day 2 | day 2 |
| Grade 5 (Lv 21) | day 12 | day 9 | day 8 |
| Grade 10 (Lv 46) | day 31 | day 24 | day 19 |
| Lv 50 | day 34 | day 26 | day 21 |

**Every grade is open within about a month of a tier**, while the tier runs about 20 weeks. So Farm Level is a quick
climb at the start of each tier (and for an Uma who joins mid-tier), never what holds a scenario back. **Which grade
each unlock asks for is a rule of the layers** ([05](05-training-hub.md) §3): scenario *s* asks for grades 2*s*−1 and
2*s*, so each scenario's demand lands on its own two grades and the Farm's mix moves up the ladder with the roster.

- No Farm Level cap is needed: the level is a short ramp, and the layers do the pacing.
- An Uma who joins mid-tier reaches the top grades in three to five weeks; meanwhile the shared Warehouse and
  higher-level Umas cover what she can't make yet.
- Farm Level resets at promotion ([04](04-tiers-and-promotion.md)), and each tier starts with the same quick climb.

## 7. Capacity: slots

A slot sits idle between an Uma's last item and the next check-in, just as the Uma does. So the slots needed for an
activity are its hours per day ÷ (24 × 0.75).

The averages hide peaks. The Vegetable Garden and the Observatory peak in scenario 1, where 12 of the 27 unlocks are
constellation nodes. The full tables are in [07](07-farm.md) §6 (Farm, after [08](08-item-catalogue-and-recipes.md)'s
side rotation) and [05](05-training-hub.md) (Training Hub). In summary:

| Building | Hours a day, tier average | Peak (scenario) | Slots at Lv 1 / Lv 2 / Lv 3 |
|---|---|---|---|
| **Kitchen** (cooking is 30% of Farm work) | 110 | 116 (1) | 6 / 8 / 8 + speed |
| Pantry | 53 | 54 (all) | 3 / 4 / 4 + speed |
| Mushroom Cave (Inspiration, 24 unlocks a tier) | 32 | 40 (2, 4) | 2 / 3 / 3 + speed |
| Vegetable Garden (Constellation) | 35 | 66 (1) | 4 / 5 / 5 + speed |
| Each other site (Grains included: 08 sends it most sides) | 23–25 | 28–34 | 2 / 3 / 3 + speed |
| Observatory | ~23 | 37.6 (1) | 2, then a slot more at Lv 2 |
| Gym, Lineage Hall, Dojo | ~15–31 across their rooms | — | per [05](05-training-hub.md) |

The Farm rows are the first draft's (before D338). D338 sends a fifth fewer dishes to the five stat sites and makes
every job a fifth longer, so the stat sites end up about as busy as here and the Vegetable Garden, Mushroom Cave,
Pantry and Kitchen about a fifth busier. The Vegetable Garden's scenario-1 peak then passes its four Lv 1 slots, so its
Lv 2 joins the first upgrades. `sim:loop` recomputes this table in phase 2.

- **The Kitchen is the game's bottleneck building.** At two slots it would cap the whole game at a third of the
  target pace.
- **Lv 1 carries the 20-Uma start; Lv 2 carries 25.** Every building stays at or under about 81% at peak once it's at Lv 2.
  Growing the roster and buying the Kitchen, Pantry and Observatory's Lv 2 go together in tier 1's first weeks.
  Lv 2 needs grade-1 items and Prize Money, so it comes with the first weeks of racing, before the roster passes 20.
- Upgrades buy headroom above these averages, so the owner can catch up after a missed day.

### Upgrades and the pace

Building and facility upgrades are the account's and carry through promotion. **Lv 3 adds ×1.25 speed**, so once the
Farm and Training Hub are at Lv 3, an unlock costs about 80–84% of its listed Uma-time:

| Building levels | A scenario for 25 Umas |
|---|---|
| Lv 1–2 (most of tier 1) | 29–30 days (§5) |
| Lv 3 everywhere (tier 1's last scenarios, tiers 2 and 3) | **about 23–24 days** |

**That's the upgrade reward, and it's accepted.** Tier 1 runs at about four weeks a scenario. A fully upgraded
account runs at about three and a half, still "about four weeks". The upgrades cost about 51,300 Prize Money for the
Farm ([07](07-farm.md) §7) and 16,800 for the Training Hub ([05](05-training-hub.md)), roughly five weeks of target
racing. The sim models building levels with an upgrade policy (buy Lv 2 at once, Lv 3 when affordable), and its CI
bands are set per tier (§12). If the owner wants later tiers held to four weeks, the time factor *k* is set per tier
(§10).

## 8. Racing's share: Prize Money and Speed Tickets

At the target, each Uma runs about 14 races a scenario: her six goal races plus the races that lift her Racing Level
([03](03-uma-progression.md)). Across 25 Umas that's about **12–13 races a day**, roughly 15–25 minutes of the owner's
time with skip.

| Racing day | Races | Prize Money (avg 150 a race, draft) | Speed Tickets | Roster time saved | Tier length |
|---|---|---|---|---|---|
| Target | ~12 | ~1,900 | ~62 | ~31 h (**~7%**) | ~19.6 weeks |
| Heavy (a free evening) | ~40 | ~6,000 | ~200 | ~100 h (**~22%**) | ~17.2 weeks if every day were heavy |

- **Racing buys real progress without replacing the Farm.** The anti-grind rule ([09](09-racing-rewards-and-exchange.md))
  flattens returns past a heavy day, so racing can't make timers meaningless.
- **Prize Money doesn't buy Umas** (D336). The roster grows the normal way, from Uma Shards (§9), so racing's money
  goes to Speed Tickets, raw ingredients and upgrades.

## 9. The roster over time

| When | Roster | Note |
|---|---|---|
| Day 0 | 20 Umas in tier 1 | 20 Uma Tickets, all spent on day 0 |
| ~Week 4–5 | 20 → 24 | The first scenario gates: 20 Shards make 4 Uma Tickets |
| ~Week 9 | → about 28 | The second gates, plus the first gates of the four new Umas |
| Each later month | about +4–5 | One Shard per Uma per scenario gate, 5 to a ticket. Tier 1 ends near 35–40 Umas if every ticket is spent |
| ~Weeks 18–22 | The first 20 at scenario 5, Expeditions open | An Uma may start her Expedition once her last career is complete, even if her scenario-5 layer isn't finished ([10](10-expeditions.md)). About 20 races each, about 500 a tier, so Expedition racing overlaps scenario 5's last weeks of training instead of adding weeks |
| ~Week 20 on | Promotions | Each promoted Uma leaves tier 1 and pays one Uma Ticket. A new tier-1 Uma can take her place, but tier 2 only fills with promoted Umas |

**Roster size doesn't change the four weeks.** Each Uma's own layer is about 530 Uma-hours of work, and each Uma brings
about 18 hours a day, so an Uma's scenario takes about 29 days however many Umas there are. As long as slots keep up,
more Umas just means more of them finishing. The 25 in the target is a **capacity** figure. Lv 2 buildings carry 25
Umas, and Lv 3 carries about 30–32 under the sim's 90% check. Past that the Kitchen is the limit, so the owner can hold
spare Uma Tickets (they never expire) or accept a slower pace for the newest Umas.

**Tiers overlap.** Promotions are per Uma, so the account soon has Umas in two tiers. The Farm and Training Hub
serve both: grades are the same in every tier, and tier 2 asks for the same dishes. Tier 2 is harder in **races and
Expeditions** (stronger fields, higher caps, mechanics; [04](04-tiers-and-promotion.md), [10](10-expeditions.md)), not
in Farm time.

## 10. The whole game's length

| | Roster time (draft) |
|---|---|
| One scenario | ~4 weeks |
| One tier, with its Expeditions | ~20 weeks at Lv 1–2 buildings, ~17 at Lv 3 (Expeditions overlap scenario 5) |
| Three tiers | **~55–63 weeks (13–15 months)** for the first Umas to clear tier 3: the lower figure with Lv 3 buildings from tier 2 |

That's long by design: an idle game the owner checks two or three times a day and races in when free. It's also one
number to change. **Every duration** (gather, craft, cook, session) **scales with one time factor *k***, **1.2** since
D338:

| *k* | Scenario | Tier | Game |
|---|---|---|---|
| **1.2** | ~4 weeks | ~20 weeks | 13–15 months |
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

| Utilisation | Tier, no Speed Tickets | Target racing | Heavy racing every day |
|---|---|---|---|
| 50% (one check-in a day) | 30.3 weeks | 28.3 | 24.7 |
| 60% | 25.2 | 23.6 | 20.6 |
| **75% (three check-ins, queues)** | **20.2** | **18.8** | **16.5** |
| 90% (Repeat, very attentive) | 16.9 | 15.7 | 13.7 |

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

`pnpm sim:loop`, a deterministic, seeded, headless run of the whole economy. It replaces the model above and becomes
the test that pins the numbers.

**What it simulates:**
- A fresh account: 20 Umas at day 0, more as Uma Shards make tickets (§9).
- The real rules from the domain package: recipes, times, Farm Level, slots, sessions, layers, unlock order.
- A **check-in policy:** three check-ins at 08:00, 13:00 and 22:30. Each one collects everything, then Repeats.
- **Idle Umas** take the planner's suggestion ([02](02-check-ins-and-notifications.md)): her own session first if a
  dish for it is in stock, then the scarcest input for the first target she can work for.
- A **racing policy**, the owner's habit (D336): each Uma races her career once her layer is done. Win chances come
  from a table derived from `sim:balance` race runs for a fully trained Uma. A variant races as unlocks land.
- A **spending policy:** Prize Money buys, in order:
  1. every Lv 2 upgrade;
  2. Lv 3 upgrades as affordable, busiest building first;
  3. Speed Tickets for the rest.
- **Variants:** utilisation (one, two or three check-ins), racing (none, target, heavy), roster (fixed at 20, 25 or 30, or growing from Shards), building
  levels (frozen at Lv 1, the spending policy).

**What it reports:**
- days per scenario and per tier;
- slot use per building and facility, with the time each is the bottleneck;
- idle Uma-hours and why (no inputs, no slot, waiting for a check-in);
- Warehouse stock by family and grade over time;
- Prize Money in and out;
- the share of time saved by Speed Tickets.

**Its partner, `pnpm sim:expeditions`** ([10](10-expeditions.md)), runs fully trained Umas through every Expedition in
every tier with real race engine runs. It pins how many races an Expedition takes and the win rate per tier. The loop
sim reads its median race count to schedule Expedition racing in the roster's last weeks.

**What CI pins** (initial tolerances):

| Check | Range |
|---|---|
| Each scenario of tier 1, 25 Umas, three check-ins, target racing, the spending policy | 24–32 days |
| Each scenario of tiers 2 and 3 (buildings at Lv 3) | 20–28 days |
| Tier 1 | 19–23 weeks |
| Any building's average slot use with the spending policy | ≤ 90% (no permanent bottleneck) |
| Time saved by target racing / by heavy racing | 5–10% / 18–25% |
| Farm Level, working without a break | 2–3 levels a day at C, 4–5 at A or S, early in the tier |
| The first unlock on a fresh account | within 12 hours |

## 13. Decided here

| Choice | Why |
|---|---|
| Read the target as "25 Umas max a scenario in ~4 weeks", a tier ~20 weeks | The owner's own refinement of "4 weeks a tier"; the time factor (§10) covers the other reading |
| One anchor: 1 Prize Money ≈ 1 minute of Uma work | Every price follows from it, and no trade mints time |
| Grades barely change times (×1.5 from grade 1 to 10) | Keeps every scenario at about four weeks; grades mark which layer an unlock belongs to |
| No Farm Level cap | Farm Level is a short ramp at the owner's 2–3 levels a day (4–5 suited); the layers do the pacing |
| Front-loaded layers (27 → 17 unlocks) | Equal time per scenario, and quick wins at the start of each tier |
| Half the Gym's singles at twice the value, *k* = 1.2 (D338) | Every session is worth having; the four weeks hold |
| Tier 2 and 3 cost the same Farm time | Higher tiers are harder in races and Expeditions; Farm time stays predictable |
| Speed Tickets are not counted in the target | The target holds without them; racing is a bonus the owner earns |
| The Kitchen is sized as the busiest building | Cooking is 30% of all Farm work |
| Lv 3 speed shortens later scenarios to ~22–25 days, and that's accepted | It's the reward for upgrading; tier 1 still runs at four weeks, and *k* per tier can hold later tiers if wanted |
| The roster grows from Uma Shards, not Prize Money (D336) | The owner's rule; roster size doesn't change an Uma's four weeks, only how many finish them |
| Racing assumes a trained Uma (D336) | The owner finishes the passive layer first; difficulty and the sim follow that |

## 14. Done when

- `pnpm sim:loop` runs on a fresh synthetic account with the domain's real rules and reports §12's metrics.
- CI fails if any §12 check leaves its range.
- This page's tables are live blocks rendered from the domain constants (in this page until phase 3 moves it into the
  manual, `docs/game/`), so the numbers here can't drift from the code.
- After four weeks of the owner's real play on the new game, the measured pace (scenario 1's completion across the
  roster) is within 25% of the sim. If it isn't, the time factor is retuned and logged as a decision.
