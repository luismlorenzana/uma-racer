# 01 · Game loop

> **Status: approved design, 2026-10-14; first written 2026-10-13 (D326–D328, D331, D334).** How the new game plays from minute to
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
| **5 Unlock** | Her build, for the rest of the tier (D328) | — | At Collect | A constellation node, an Inspiration slot, inherited unique or gold, an Extra Stats node, or a card bond |
| **6 Race** | The Racing page | Any Uma, at any time | ~1–2 minutes of the owner's time with skip | Racing EXP and Prize Money ([09](09-racing-rewards-and-exchange.md)) |
| **7–8 Spend** | The Exchange | The owner | — | Prize Money → Speed Tickets (30 each), raw items, upgrades |

- **A job or session runs 1–10 items or unlocks one after another**, so one tap can cover the gap to the next
  check-in or the night ([02](02-check-ins-and-notifications.md) §3).
- **Steps 1–3 are anybody's work and step 4 is hers.** Dishes go to the account's one Warehouse, and any Uma's
  session can use any dish of the right family and grade. Her own sessions are the only work nobody else can do for her.
- **One unlock costs about 20 Uma-hours at grade 1 and 30 at grade 10** (*k* = 1.2, D338): five raw gathered, five
  crafted, one dish cooked and one session ([12](12-economy-and-pacing.md) §4).
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

A worked example with the draft numbers. Kitasan Black is in tier 1, scenario 1, on an account working at the target
pace: three check-ins a day and no Speed Tickets ([12](12-economy-and-pacing.md)). She's played the way the owner
plays (D336): **train the layer first, then race the career.** Timings are rough on purpose; nothing in the game
needs the owner to play at set times.

### Her layer

Scenario 1's layer is **27 unlocks** (README), 19 at grade 1 and 8 at grade 2:

| Unlock | Count | Facility | Dish family |
|---|---|---|---|
| Constellation nodes (tree of 12) | 12 | Observatory | Vegetables |
| Inspiration: both parent slots, then both parents' inherited uniques | 4 | Lineage Hall | Mushrooms |
| Extra Stats singles | 5 | Gym, one room per stat | One single per stat at grade 1 (README map, D338): one dish from each of Sweets, Fruits, Fish, Nuts & Seeds and Herbs & Spices |
| Card bonds | 6 | Dojo | Each card's family: e.g. 2 Speed (Sweets), 2 Stamina (Fruits), 1 Wit (Herbs & Spices), 1 Friend (Grains) |

Her layer needs 27 dishes: 135 crafted items from 135 raw. That's about **539 Uma-hours** of somebody's work at
*k* = 1.2: about 439 hours of Farm work and **100 hours of her own sessions** ([12](12-economy-and-pacing.md) §5).

### Her month

She works about 18 hours a day (75%), so the 539 hours her layer costs take about four weeks. She spends about a fifth
of it in her own sessions and the rest on the Farm, mostly on dishes for other Umas. Her own dishes come from whoever
is free.

| Roughly | What happens |
|---|---|
| Week 1 | Farm work from the first hour. Her **Farm Level climbs fast**: 2–3 levels a day working without a break, 4–5 on a family that suits her running aptitudes ([07](07-farm.md) §3). Grade 2 opens in two or three days. Her first nodes, bonds and both parent slots land |
| Weeks 2–3 | The bulk of the layer: the rest of her nodes and bonds, her parents' uniques, her Extra Stats. By the end of the month she's past Farm Lv 30, so she can make any grade the tier will ask of her for weeks |
| Week 4 | The last unlocks. Her layer is done |
| Then | The owner races her career: Maiden G3, both Trials G2s, then three G1s, plus the races that lift her Racing Level, about 14 in all. Fully trained, she's favoured in every one ([03](03-uma-progression.md) §9), so it's a racing session or two, not weeks |

- **Racing EXP:** 1,800 a scenario, from about 14 races ([03](03-uma-progression.md)). Racing is never blocked, so the
  owner can also race her as unlocks land; she just wins less until her layer fills.
- **Farm Level** is a quick climb, not a gate she waits on: every grade is open within about a month of a tier
  ([12](12-economy-and-pacing.md) §6).
- **The order of unlocks is the owner's choice.** The planner suggests one ([02](02-check-ins-and-notifications.md)
  §6); nothing forces it.

### A typical check-in day

| When | What happens |
|---|---|
| The night before | She started **Gather Vegetables ×6** at the Vegetable Garden: about 9 hours, done by morning |
| Morning check-in | **Collect all** takes her 6 Vegetables and her Farm EXP. Another Uma cooked a Vegetable dish overnight, so the summary lists her under "Dish ready". One tap starts an **Observatory** session sized to end before the next check-in |
| Midday check-in | Collect the node. The planner's top suggestion for her is Fruits for a Stamina dish, so **Gather ×6**, sized to end by the evening |
| Evening check-in | Collect the Fruits. **Cook ×2** at the Kitchen overnight, inputs reserved from the Warehouse at the start |

Her day: working most of it, waiting a little for check-ins, one unlock and two dishes started for whoever needs them.

### Advancing

When her career is complete she sits at Racing Level 10, and her card shows **Ready to advance**. Advancing is free
and explicit ([03](03-uma-progression.md), [13](13-removals-and-plan-changes.md)): she becomes Racing Level 11 in
scenario 2, and its layer (28 unlocks, grades 3–4) opens. Her scenario-1 unlocks stay for the whole tier (D328).

- **Advancing needs her career, not her full layer.** If she wins her G1s before every unlock is done, she can
  advance, and the rest stay open. The planner keeps listing them under "from scenario 1" until they're done.
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
| Free until the next check-in | ~6 | The 25% that queues and Repeat shrink (and push, if the owner adopts it) |
| **Racing** | any of them | About 12–13 races a day, none of which takes an Uma off her work |

Per day that's **450 Uma-hours** of work and about **19 unlocks** finished roster-wide (more in scenario 1's cheap
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
| **Unlocked mid-tier** (tier 1, an Uma Ticket from Uma Shards) | She starts at scenario 1, Racing Level 1, Farm Level 1. Her Farm Level climbs fast (grade 2 in two or three days), and the shared Warehouse often already holds her grade 1–2 dishes. Her floor is her own sessions: ~100 hours, about 6 days at 18 a day. A late Uma catches up fast while the roster cooks for her |
| **Promoted to tier 2** | She starts over at Racing Level 1 and Farm Level 1, grade 1 again ([04](04-tiers-and-promotion.md)). The Farm, the Warehouse and the buildings carry, and grades are the same in every tier, so tier-1 Umas' cooking feeds her too ([12](12-economy-and-pacing.md) §9) |
| **Far ahead** | She can advance early (§3). Her next layer's grades are usually open already, since Farm Levels come fast; if not, others cook for her |
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
  bring a tier from ~21 weeks to ~19.6; heavy racing every day would bring it to ~17.2.
- **Early in tier 1, Prize Money goes to upgrades first**: the Kitchen, Pantry and Vegetable Garden at Lv 2. Umas
  aren't for sale (D336): the roster grows from Uma Shards as Umas reach their scenario gates, about 20 → 24 at the end
  of scenario 1 ([12](12-economy-and-pacing.md) §9).
- **A missed day costs time, never progress.** Work simply waits as Ready until the owner is back.

## 6. The tier arc

A tier is five scenarios, a World Expedition and a promotion. For a roster of 25 at the target
([12](12-economy-and-pacing.md) §5, §9):

| Roster weeks | Stage | Grades | Layer (unlocks) | How it feels |
|---|---|---|---|---|
| 0–4 | **Scenario 1** | 1–2 | 27 | Quick wins: the first unlock on the first evening, cheap nodes and bonds, both parents and their uniques, Farm Levels climbing fast |
| 4–8 | **Scenario 2** | 3–4 | 23 | Parent golds and the first grandparents. The first **Duo** nodes (grade 3) and a **Sun** node from a grade-4 Feast. The first Shards make the roster 24 |
| 8–12 | **Scenario 3** | 5–6 | 21 | The last grandparents and two of their uniques; more Duos (grade 5) and a Sun (grade 6). The build takes its shape |
| 12–16 | **Scenario 4** | 7–8 | 19 | Fewer, dearer unlocks; the last uniques and the first grandparent golds; Extra Stats capacity 13 |
| 16–20 | **Scenario 5** | 9–10 | 17 | The full tier build: 107 unlocks, 28 nodes, 24 Inspiration, 37 Extra Stats nodes, 18 bonds |
| ~17–21 | **World Expedition** | — | — | Abroad: **8 distinct wins** from one region's race pool, about 15–25 races per Uma ([10](10-expeditions.md)). The Farm keeps running at home |
| ~20 on | **Promotion** | 1 again | 27 | She moves to tier 2 and starts over. In tier 1, each promotion pays one Uma Ticket ([04](04-tiers-and-promotion.md)) |

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
| How to spend Prize Money: Speed Tickets, raw items, upgrades | **Suggestions** for free Umas, which the owner starts with one tap |
| What to sell | Collecting an Uma's finished unlocks before she races, or before she's moved |
| When to advance a scenario, which Expedition to run, when to promote | **Push notifications** when Umas fall free, if the owner adopts uma-rpg's ([02](02-check-ins-and-notifications.md) §7) |

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
  (sessions about 20% of roster time, about 19 unlocks a day) within its tolerances.
- A domain test replays §3's Kitasan Black: a synthetic roster of 25 at three check-ins a day takes her through
  scenario 1 in 24–32 days, with all 27 unlocks, then about 14 races to Racing Level 10, her Farm Level past 30.
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
