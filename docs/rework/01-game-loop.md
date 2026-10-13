# 01 · Game loop

> **Status: design for owner review, 2026-10-13 (D326–D328, D331, D334).** How the new game plays from minute to
> month: the loop, one Uma's scenario, the roster in rotation and a week in both modes. Every number is a **draft**
> from the README's time model and [12](12-economy-and-pacing.md)'s first-pass model. `pnpm sim:loop`
> ([12](12-economy-and-pacing.md) §12) replaces them and pins them in tests.

This page tells the story and owns the **activity rule** (D328). The pages it links to own the parts:
- check-ins and queues: [02](02-check-ins-and-notifications.md);
- Racing Level and careers: [03](03-uma-progression.md);
- tiers and promotion: [04](04-tiers-and-promotion.md);
- sessions: [05](05-training-hub.md);
- bonds: [06](06-cards-and-bonds.md);
- Farm jobs: [07](07-farm.md);
- recipes: [08](08-item-catalogue-and-recipes.md);
- Prize Money: [09](09-racing-rewards-and-exchange.md).

## 1. The loop, step by step

```
 1 Farm site ──▶ 2 Pantry ──▶ 3 Kitchen ──▶ 4 Training Hub ──▶ 5 unlock ──────▶ 6 race
   gather          craft         cook          session            lasts the        any time,
   raw items       1 for 1       a dish        (her own)          whole tier       never blocked
      ▲                                                                                │
      │  Farm EXP → Farm Level (steps 1–3)                 Racing EXP → Racing Level   │
      │                                                                                ▼
      └──── Speed Tickets (30 min off) ◀──── 8 Exchange ◀──── 7 Prize Money ◀──────────┘
                                                                  ▲
                                   surplus items ─────────────────┘ (a third of their work value)
```

| Step | Where | Who | Time at grade 1 (grade 10) | In → out |
|---|---|---|---|---|
| **1 Gather** | One of the eight Farm sites ([07](07-farm.md)) | Any free Uma whose Farm Level opens the grade (Lv 5*g* − 4) | 90 min an item (135) | Nothing → 1 raw ingredient |
| **2 Craft** | Pantry | Same rule | 22.5 min an item (33.75) | 1 raw → 1 crafted item |
| **3 Cook** | Kitchen | Same rule | 240 min a dish (330) | 4 crafted of the dish's family + 1 crafted side → 1 dish ([08](08-item-catalogue-and-recipes.md)) |
| **4 Session** | The Training Hub facility the dish's family goes to ([05](05-training-hub.md)) | **The Uma who gets the unlock**, and only her | 180 min an unlock (315) | 1 dish → 1 unlock |
| **5 Unlock** | Her build, for the rest of the tier (D328) | — | At Collect | A constellation node, an Inspiration slot or gold, an Extra Stats node, or a card bond |
| **6 Race** | The Racing page | Any Uma, at any time | ~1–2 minutes of the owner's time with skip | Racing EXP and Prize Money ([09](09-racing-rewards-and-exchange.md)) |
| **7–8 Spend** | The Exchange | The owner | — | Prize Money → Speed Tickets (30 each), raw items, upgrades, Uma Tickets in tier 1 |

- **A job or session runs 1–10 items or unlocks one after another**, so one tap can cover the gap to the next
  check-in or the night ([02](02-check-ins-and-notifications.md) §3).
- **Steps 1–3 are anybody's work and step 4 is hers.** Dishes go to the account's one Warehouse, and any Uma's
  session can use any dish of the right family and grade. Her own sessions are the only work nobody else can do for her.
- **One unlock costs about 16 Uma-hours at grade 1 and 25 at grade 10**: five raw gathered, five crafted, one dish
  cooked and one session ([12](12-economy-and-pacing.md) §4).
- **Which facility a dish feeds** follows its family (README table): Vegetables → Observatory, Mushrooms → Lineage
  Hall, the five stat families → that stat's Gym room and card bonds, Grains → Friend and Group bonds.

The loop closes in two places:
- **Prize Money buys time.** Each Speed Ticket takes 30 minutes off one running job or session, so racing speeds up
  every passive step (§5).
- **Unlocks make her win.** A stronger build wins her career goals. Winning them lets her advance to the next
  scenario, whose layer asks for higher-grade dishes ([03](03-uma-progression.md)).

## 2. The activity rule (D328)

**An Uma does one passive thing at a time, a Farm job or a Training Hub session, and she can always race.**

Every Uma is in exactly one of three work states. Racing is never one of them.

| State | Meaning | Can race | Can start other work |
|---|---|---|---|
| **Free** | No job or session, nothing to collect. A queue that couldn't start its next entry has dropped, so she is Free ([07](07-farm.md) §2) | Yes | Yes |
| **Working** | A job or session is running in her slot, maybe with up to 3 more queued behind it | Yes | No (see the edge cases) |
| **Ready** | Everything she was doing has finished and waits to be collected | Yes | Yes: starting collects first |

### Edge cases

| Situation | What happens | Why |
|---|---|---|
| **An Uma mid-session wants to race** | **Allowed.** The race reads her build at race start. Unlocks the session has already finished are collected first, in the same tap. The unlock still in progress counts only once it finishes | Racing is never blocked, and she should never race without an unlock she has already earned |
| An Uma mid-job (Farm) wants to race | Allowed, as above. The job runs on | Same rule |
| **An Uma mid-job is assigned to a session** | **Refused until the job is collected or recalled.** The sheet says when she is free ("Free at 18:30") and offers **Recall** in the same place. Recall pays what she has finished and returns the inputs of what she hasn't ([07](07-farm.md)) | One passive thing at a time. Recall makes the choice explicit and loses only time |
| An Uma mid-session is assigned to a Farm job | Refused the same way, with **Recall** for the session: finished unlocks stay, unused dishes go back to the Warehouse ([05](05-training-hub.md)) | Same rule |
| A Ready Uma is assigned elsewhere | Her finished work is **collected first, in the same tap**, then the new work starts | Nothing is lost, so refusing would only add a tap |
| Queue a session behind a Farm job | **Not possible.** A queue stays in one slot at one place ([02](02-check-ins-and-notifications.md) §3) | A queue that moved her between buildings would need a second slot held for her |
| She advances to the next scenario mid-job or mid-session | **Allowed; running work continues.** A session making a previous-layer unlock still pays it, because layers last the whole tier | Advancing changes her career, not her work |
| She is promoted while working | Promotion needs her free ([04](04-tiers-and-promotion.md) §5). The Promote sheet offers Collect for finished work, and Recall or Speed Tickets for a running job or session, or says when she'll be free | No job or session spans two tiers, so no Farm EXP or unlock lands in the wrong one |
| She races in a World Expedition | Allowed at any work state | Expedition races are races ([10](10-expeditions.md)) |

The rule in one line for the screens: **a busy Uma's card shows her job and its finish time, and a Race button that
always works.**

## 3. One Uma, one scenario

A worked example with the draft numbers. Kitasan Black is in tier 1, scenario 1, on an account whose roster is
already at 25 and working at the target pace: three check-ins a day at 08:00, 13:00 and 22:30
([12](12-economy-and-pacing.md) §12), about 12–13 races a day across the roster, and no Speed Tickets.

### Her layer

Scenario 1's layer is **30 unlocks** (README). About half use grade-1 dishes and half grade-2
([12](12-economy-and-pacing.md) §6):

| Unlock | Count | Facility | Dish family |
|---|---|---|---|
| Constellation nodes (tree of 12) | 12 | Observatory | Vegetables |
| Inspiration parent slots | 2 | Lineage Hall | Mushrooms |
| Extra Stats singles | 10 | Gym, one room per stat | One single per stat at grade 1 and at grade 2 (README map): two dishes from each of Sweets, Fruits, Fish, Nuts & Seeds and Herbs & Spices |
| Card bonds | 6 | Dojo | Each card's family: e.g. 2 Speed (Sweets), 2 Stamina (Fruits), 1 Wit (Herbs & Spices), 1 Friend (Grains) |

Her layer needs 30 dishes: 150 crafted items from 150 raw. That's about **504 Uma-hours** of somebody's work: 410
hours of Farm work and **94 hours of her own sessions** ([12](12-economy-and-pacing.md) §5). The sessions are 15 at
180 minutes (grade 1) and 15 at 195 (grade 2).

### Her four weeks

She works about 18 hours a day (75%). Over 28 days, that's about the 504 hours her own layer costs. She spends about
**19% of it in her own sessions** and **81% on the Farm**, mostly on dishes for other Umas. Her own dishes come from
whoever is free.

| Days | Unlocks (of 30) | Her sessions | Races | Racing Level | Farm Level |
|---|---|---|---|---|---|
| 1–7 | 7: 3 nodes, 2 bonds, 1 parent slot, 1 Extra | ~21 h | 3: two EXP races, then her **Maiden G3** (won day 6) | 1 → 3; held at 2 until the G3 win | 1 → 3.5 |
| 8–14 | 15: +3 nodes, 1 bond, 1 parent slot, 3 Extra | ~24 h | 3: two EXP races and the first **Trials G2** | 3 → 5; held at 5 | 3.5 → 6: **grade 2 opens** |
| 15–21 | 22: +3 nodes, 2 bonds, 2 Extra | ~23 h | 4: the second G2 releases the hold; her first **Main G1** | 5 → 7 | 6 → 8.5 |
| 22–28 | **30**: +3 nodes, 1 bond, 4 Extra | ~26 h | 4: G1s two and three | 7 → **10**, career complete | 8.5 → **11**: grade 3 opens |

- **Racing EXP:** 1,800 a scenario, from about 14 races. Her six goal races are among them; the rest lift her level
  ([03](03-uma-progression.md)). She races when her unlocks make her a favourite for the next goal, which is the
  sim's racing policy.
- **Farm EXP:** 1 a minute of Farm work and 2,400 a level, so her ~410 hours make about **10 levels**: Lv 1 → 11.
  Grade 3 opens just as scenario 2 starts, by design ([12](12-economy-and-pacing.md) §6).
- **Grades:** her grade-1 unlocks come first. Grade-2 dishes follow from about day 14, when grade 2 opens for the
  average Uma; until then, Umas with a higher Farm Level cook them.
- **The order of unlocks is the owner's choice.** This example front-loads nodes and bonds because they raise race
  strength fastest, and leaves most Extra Stats singles for the second half. The planner suggests an order
  ([02](02-check-ins-and-notifications.md) §6); nothing forces one.

### A typical day: day 10

Day 10: Farm Lv 4, 10 of 30 unlocks done, Racing Level 3, her first G2 not yet won.

| Time | What happens |
|---|---|
| 22:30 the night before | Started **Gather Vegetables G1 ×6** at the Vegetable Garden: 6 × 90 min = 9 h, done 07:30 |
| 08:00 check-in | **Collect all** takes her 6 Vegetables and 540 Farm EXP. Gold Ship cooked a Vegetable dish G1 overnight, so the summary lists her under "Dish ready". One tap starts **Observatory ×1** (3 h, done 11:00). The size picker showed ×2 ending 14:00, which would leave her free until 22:30, so ×1 was the better fit |
| 11:00 | Session done; she is Ready (node 11 waits to be collected) |
| 12:30, lunch | The owner races her in her **Trials G2**. The race collects node 11 first, so she runs with it. She wins: Prize Money 200 (draft) and Racing EXP. Her level can't pass 5 until her second G2 is won |
| 13:00 check-in | Free. The planner's top suggestion for her is Fruits G1 for a Stamina dish. **Gather ×6** ends 22:00, which fits 22:30 |
| 22:30 check-in | Collect 6 Fruits. **Cook Fruit dish G1 ×2** at the Kitchen (8 h, done 06:30). Its 8 crafted Fruits and 2 sides are reserved from the Warehouse at the start |

Her day: 20 hours working, 4 waiting for a check-in (83%), one race, one unlock, 2 dishes started for whoever needs
them next. Her other ~14 races of the scenario fit around days like this one.

### Advancing

On day 28 she reaches Level 10 with every career goal won, so her card shows **Ready to advance**. Advancing is free
and explicit ([03](03-uma-progression.md), [13](13-removals-and-plan-changes.md)): she becomes Racing Level 11 in
scenario 2, and its layer (26 unlocks, grades 3–4) opens. Her 30 scenario-1 unlocks stay for the whole tier (D328).

- **Advancing needs her career, not her full layer.** If she wins her G1s with 26 of 30 unlocks, she can advance, and
  the last 4 stay open. The planner keeps listing them under "from scenario 1" until they're done.
- **A layer doesn't expire.** Advancing early costs her nothing but strength in the next scenario's goal races.

## 4. The roster in rotation

### Who does what

No Uma has a fixed job. Each one farms, trains in her own sessions and races, and the mix shifts with what she needs.
On an average moment at the target ([12](12-economy-and-pacing.md) §3, §7):

| Doing | Umas (of 25) | Notes |
|---|---|---|
| Gathering | ~8.5 | Vegetable Garden the busiest site (Constellation dishes) |
| Crafting at the Pantry | ~2 | Short items; batches of 10 and queues bridge the gaps |
| Cooking at the Kitchen | ~4.5 | The Kitchen is the game's bottleneck building |
| In her own session | ~4 | 20% of roster time |
| Free until the next check-in | ~6 | The 25% that queues, Repeat and push notifications shrink |
| **Racing** | any of them | About 12–13 races a day, none of which takes an Uma off her work |

Per day that's **450 Uma-hours** of work and about **22 unlocks** finished roster-wide (more in scenario 1's cheap
layer, fewer in scenario 5's) ([12](12-economy-and-pacing.md) §3, §5).

### How an Uma's next job is chosen

The owner chooses; the planner suggests ([02](02-check-ins-and-notifications.md) §6). Its suggestion for a free Uma:
1. **Her own session**, when a dish for one of her remaining unlocks is in the Warehouse. Only she can do it.
2. Otherwise **the scarcest input for the first planner target she can work for**, at a grade her Farm Level opens.
   Until the owner marks targets, they are the five Umas furthest behind. That's the sim's policy
   ([12](12-economy-and-pacing.md) §12), so the advice is the one the pacing was proved with.
3. Higher-Farm-Level Umas get the higher-grade work, because only they can do it.

### Umas who don't fit the average

| Uma | What changes |
|---|---|
| **Bought mid-tier** (tier 1, an Uma Ticket from the Exchange) | She starts at scenario 1, Racing Level 1, Farm Level 1. She can only work grade 1 until Lv 6, but the shared Warehouse often already holds her grade 1–2 dishes. Her floor is her own sessions: ~94 hours, about 5 days at 18 a day. A late Uma catches up fast while the roster cooks for her |
| **Promoted to tier 2** | She starts over at Racing Level 1 and Farm Level 1, grade 1 again ([04](04-tiers-and-promotion.md)). The Farm, the Warehouse and the buildings carry, and grades are the same in every tier, so tier-1 Umas' cooking feeds her too ([12](12-economy-and-pacing.md) §9) |
| **Far ahead** | She can advance early (§3). Her next layer needs grades she may not have opened, so others cook for her, or she keeps farming the grades she has |
| **Far behind** | The planner's automatic targets put her first (above), so the roster's free hands drift toward her dishes |
| **On an empty Warehouse** (a fresh account) | All twenty Umas gather at once. The first grade-1 dish is ready about six hours in, and **the first unlock lands on the first evening** ([12](12-economy-and-pacing.md) §5). Racing is open from minute one |

## 5. A week of play

The owner plays in two modes ([README](README.md)). The numbers are drafts from [12](12-economy-and-pacing.md) §8;
[09](09-racing-rewards-and-exchange.md) owns prizes and the anti-grind rule.

### A busy day

| Time | The owner | Time spent |
|---|---|---|
| 08:00 | Check-in: Collect all, Repeat all, start the planner's suggestions for free Umas | under a minute |
| 12:30–13:00 | Check-in, and three or four races over lunch | ~6 minutes |
| Evening | Five or six races | ~10 minutes |
| 22:30 | Check-in, sizing jobs for the night | under a minute |

That's about **8–10 races** on a busy weekday. Two check-ins instead of three works, but slower: about 60%
utilisation stretches a tier from about 20 to about 25 weeks ([12](12-economy-and-pacing.md) §11).

### A free evening

Three check-ins as usual, plus **about 40 races** in an evening of an hour or so with skip. Those 40 races pay about
6,000 Prize Money (draft), about 200 Speed Tickets, which take about **100 Uma-hours** off running work. That's
**~22%** of the roster's 450-hour day.

Where to spend them: the planner marks the running jobs whose finish unblocks the most, usually Kitchen jobs and
the last session of a layer ([02](02-check-ins-and-notifications.md) §4). **Speed up all** spreads them in one tap.

### The week

| Day | Check-ins | Races | Prize Money (draft) | Speed Tickets' worth | Roster time saved |
|---|---|---|---|---|---|
| Mon–Fri, each | 3 | ~8 | ~1,200 | ~40 | ~20 h (4%) |
| Saturday (free evening) | 3 | ~40 | ~6,000 | ~200 | ~100 h (22%) |
| Sunday | 3 | ~12 | ~1,800 | ~60 | ~30 h (7%) |
| **Week** | **21** | **~92 (about 13 a day)** | **~13,800** | **~460** | **~230 h (~7% of 3,150)** |

- **The target holds without Speed Tickets** ([12](12-economy-and-pacing.md) §1). Tickets bought from target racing
  bring a tier from ~20 weeks to ~18.8; heavy racing every day would bring it to ~16.5.
- **Early in tier 1, Prize Money goes to Uma Tickets first.** Five of them, at the draft price, are about two weeks of
  normal racing ([12](12-economy-and-pacing.md) §8). The roster grows from 20 to 25 by about week three.
- **A missed day costs time, never progress.** Work simply waits as Ready until the owner is back.

## 6. The tier arc

A tier is five scenarios, a World Expedition and a promotion. For a roster of 25 at the target
([12](12-economy-and-pacing.md) §5, §9):

| Roster weeks | Stage | Grades | Layer (unlocks) | How it feels |
|---|---|---|---|---|
| 0–4 | **Scenario 1** | 1–2 | 30 | Quick wins: the first unlock on the first evening, cheap nodes and bonds, the roster growing 20 → 25 |
| 4–8 | **Scenario 2** | 3–4 | 26 | Parent golds. The first **Duo** nodes (grade 3) and a **Sun** node from a grade-4 Feast |
| 8–12 | **Scenario 3** | 5–6 | 26 | Grandparent slots; more Duos (grade 5) and a Sun (grade 6). The build takes its shape |
| 12–16 | **Scenario 4** | 7–8 | 22 | Fewer, dearer unlocks; Extra Stats capacity 26 |
| 16–20 | **Scenario 5** | 9–10 | 22 | The full tier build: 126 unlocks, 28 nodes, 18 Inspiration, 62 Extra Stats nodes, 18 bonds |
| 20–22 | **World Expedition** | — | — | Abroad: **8 distinct wins** from one region's race pool, about 15–25 races per Uma ([10](10-expeditions.md)). The Farm keeps running at home |
| ~22 on | **Promotion** | 1 again | 30 | She moves to tier 2 and starts over. In tier 1, each promotion pays one Uma Ticket ([04](04-tiers-and-promotion.md)) |

**Tier 2 is the same loop in a stronger world.** Node values are ×1.25 (×1.5 in tier 3), fields are stronger and
Expeditions add mechanics ([04](04-tiers-and-promotion.md), [10](10-expeditions.md)). The Farm takes the same time in
every tier. Only promoted Umas live in tier 2, so for a while the roster spans two tiers and shares one Farm. A new
tier-1 Uma, bought with the promotion's ticket, can take the promoted Uma's place.

**The whole game** is about 22 weeks a tier and about 15 months for three ([12](12-economy-and-pacing.md) §10). That's
one time factor to change if it feels too long.

## 7. What the owner decides, what the game does

| The owner decides | The game automates |
|---|---|
| Which Umas to unlock with Uma Tickets | Every timer, from start timestamps, with closed and offline time counted ([02](02-check-ins-and-notifications.md) §8) |
| Who works where, what she makes and how many (1–10) | Queues: the next entry starts when the last one ends if the Warehouse covers it; otherwise the queue drops and the summary says why |
| Which unlock a session makes: which node, which Inspiration pick, which Extra Stats node, **which card to bond** | **Collect all**: one tap claims every finished item and unlock |
| Card sets, presets, active Extra Stats nodes ([05](05-training-hub.md), [06](06-cards-and-bonds.md)) | **Repeat**: one tap restarts every finished job and session with the same recipe and size, where the inputs allow |
| Which races to run, and when | The **planner**: what each target still needs, cascaded to dishes, crafted and raw items, with stock and running work counted first |
| How to spend Prize Money: Speed Tickets, Uma Tickets, raw items, upgrades | **Suggestions** for free Umas, which the owner starts with one tap |
| What to sell | Collecting an Uma's finished unlocks before she races, or before she's moved |
| When to advance a scenario, which Expedition to run, when to promote | **Push notifications** when Umas fall free ([02](02-check-ins-and-notifications.md) §7) |

**The game never spends for the owner.** It never buys or sells, never uses a Speed Ticket, and never advances or
promotes an Uma by itself. Repeat and suggestions start work only on the owner's tap. A queue starting its next entry
is the one automatic start, and the owner set that up.

## 8. Decided here

| Choice | Why |
|---|---|
| Three work states: Free, Working, Ready. Racing is open in all three | One rule the screens can show on every Uma card |
| A race collects the Uma's finished unlocks first (with [05](05-training-hub.md) §2) | She never races without an unlock she has earned, and it needs no extra tap |
| Moving a Ready Uma collects her work first (with [07](07-farm.md) §5) | Nothing is lost, so a refusal would only cost a tap |
| Mid-job or mid-session Umas can't start other work until it is collected or recalled; the sheet shows "Free at" and Recall | The D328 rule, with the way out on the same sheet |
| Queues never cross buildings | A queue holds one slot; crossing would hold two |
| Advancing a scenario needs the career only, not the full layer; unfinished unlocks stay open for the tier ([03](03-uma-progression.md) §5) | Layers last the tier (D328), so nothing is lost, and the owner can push a strong Uma on |
| Advancing doesn't touch running work; promotion settles it as [04](04-tiers-and-promotion.md) §5 says | Promotion resets the Uma; advancing doesn't |
| Suggestions for a free Uma: her own session first, then the scarcest input for the first target she can work for (by default the Umas furthest behind) | Only she can do her sessions; the rest matches the sim's policy ([12](12-economy-and-pacing.md) §12) |
| The worked example's check-in times are 08:00, 13:00 and 22:30 | The sim's check-in policy, so the example and the sim agree |
| The game never spends Prize Money, Speed Tickets or items by itself, except for a queued entry's inputs at its start | The owner keeps every choice that costs something |

## 9. Done when

- `pnpm sim:loop` passes [12](12-economy-and-pacing.md) §12's checks, and its report reproduces §4's rotation shares
  (sessions about 20% of roster time, about 22 unlocks a day) within its tolerances.
- A domain test replays §3's Kitasan Black: a synthetic roster of 25 at three check-ins a day takes her through
  scenario 1 in 24–32 days, with about 14 races, Racing Level 10, Farm Level 10–12 and all 30 unlocks.
- Domain tests pin §2's table:
  - an Uma Free, Working or Ready can start a race;
  - a race collects her finished unlocks first;
  - a Working Uma's session start is refused, and succeeds after Recall;
  - moving a Ready Uma collects first;
  - advancing leaves running work as it was.
- On a fresh synthetic account, the first unlock is collected within 12 hours ([12](12-economy-and-pacing.md) §12).
- On the owner's iPhone, every Uma card shows her state and finish time with a Race button that works in all three
  states.
- After four weeks of the owner's real play, the measured share of free Uma time and races a day are reported against
  §4 and §5, and any retune is logged as a decision.
