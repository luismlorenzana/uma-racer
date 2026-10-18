# 07 · Farm

> **Status: as built, phase 3 (generation 2, D361); first written 2026-10-13 (D326, D327, D328, D330, D331, D334).**
> The rules are phase 2's (D343), measured by the loop simulation ([12](12-economy-and-pacing.md) §12, D348), whose
> tables here are live. §10's screens are T146's compact ones (D366, superseding T140's of D358), with §14's last rows.

The Farm is where the roster spends most of its time. Umas gather ingredients at eight family sites, the **Pantry**
crafts them and the **Kitchen** cooks them into dishes, all on timers that run while the app is closed. A dish is the
entry ticket to a Training Hub session ([05](05-training-hub.md)). The Farm reuses uma-rpg's farming half and
uma-art's buildings, items and dishes (D330); the item catalogue and every recipe are in [08](08-item-catalogue-and-recipes.md).

This page owns the buildings, jobs, Farm Level, worker rules, slots and upgrades. Collect all, Repeat, queues as UX,
notifications and the "what she still needs" planner belong to [02](02-check-ins-and-notifications.md); the Hub's Farm
page belongs to [11](11-hub-and-places.md); prices of Speed Tickets and sales belong to [09](09-racing-rewards-and-exchange.md).

## 1. The buildings

Ten buildings, all on the Farm page, all open from the first day. Ids are uma-art building ids on its `farmlands`
page (checked against `packages/art/buildings/atlas.json`).

| Building | uma-art id | Job | Makes | Feeds ([08](08-item-catalogue-and-recipes.md) §1) |
|---|---|---|---|---|
| Sugar Grove | `sugar-grove` | Gather | Sweets, raw | Speed |
| Orchard | `orchard` | Gather | Fruits, raw | Stamina |
| Fishery | `fishery` | Gather | Fish, raw | Power |
| Nut Grove | `nut-grove` | Gather | Nuts & Seeds, raw | Guts |
| Herb Garden | `herb-garden` | Gather | Herbs & Spices, raw | Wit |
| Fields | `fields` | Gather | Grains, raw | Skill: Friend and Group bonds |
| Vegetable Garden | `vegetable-garden` | Gather | Vegetables, raw | Constellation |
| Mushroom Cave | `mushroom-cave` | Gather | Mushrooms, raw | Inspiration |
| Pantry | `pantry` | Craft | One raw item into one crafted item of the same family and grade | Every family |
| Kitchen | `kitchen` | Cook | Dishes: 80 planet dishes, 8 Duos, 4 Feasts | Training Hub sessions |

There is no other Farm building. The Farmhouse, the Workshop, the Barnyard and the five districts of today's Farm go
(§12). uma-rpg's Wilds sites, Workbench and Forge are not used (D330).

## 2. Jobs

A **job** is one Uma making 1–10 outputs of one thing at one building, **one after another**.

| Rule | Value |
|---|---|
| **Outputs** | 1–10 per job, chosen at the start. Each output finishes on its own timer; the next one starts at once |
| **Inputs** | Reserved at the start for every output of the job: they leave the Warehouse's free stock and show as "reserved" |
| **Queue** | Up to **3 more jobs** wait behind the running one, for the same Uma at the same building. Each may be a different item or grade |
| **Queue start** | When a job's last output finishes, the next queued job starts at that instant if the Warehouse's free stock covers its inputs. If it doesn't, **the whole queue drops** |
| **Collect** | Pays every finished output into the Warehouse and the Farm EXP for those outputs (§4) to the Uma who made them |
| **Recall** | Stops the job now. Pays the finished outputs; **returns the inputs of every unmade output**, including the one in progress; drops the queue. Only time is lost |
| **Speed Ticket** | Takes 30 minutes off the running job ([09](09-racing-rewards-and-exchange.md) owns the price) (§8) |
| **Timers** | Derived from the start timestamp, never a running count: closed and offline time counts |

**Per-output times** come from the README's time model ([12](12-economy-and-pacing.md) §4), for grade *g*, in base minutes; in play each is × *k* = 1.2 (D338):

<!-- live:farm-job-times -->
| Job | Minutes per output | Grade 1 | Grade 10 |
|---|---|---|---|
| Gather one raw item (eight sites) | 90 + 5(*g*−1) | 90 | 135 |
| Craft one item (Pantry) | a quarter of gathering | 22.5 | 33.75 |
| Cook one dish (Kitchen, every kind) | 240 + 10(*g*−1) | 240 | 330 |
<!-- /live -->

A building at Lv 3 divides these by 1.25 (§7). The speed is frozen into the job when it starts.

**The clock.** A job stores `startedAt`, the per-output minutes, the output count and its acceleration (minutes taken
off by Speed Tickets). Output *k* finishes at `startedAt + k × minutes − acceleration`. Readiness is recomputed when
the app comes to the foreground. The trusted-device clock policy stays as today: a clock moved backwards makes the
wait longer, never negative.

**Worked example.** At 08:00 Special Week (Farm Lv 7) starts **Gather Potato × 10** at the Vegetable Garden: 95 minutes
each, so outputs land at 09:35, 11:10 … and the last at 23:50. Behind it the owner queues **Gather Carrot × 6**.
- 13:00 check-in: three Potatoes are done. Collect pays 3 Potatoes and 285 Farm EXP (base minutes, as every worked
  example; in play each Potato takes 114 minutes and pays 114 EXP at *k* = 1.2). The owner spends one Speed Ticket:
  the job now ends at 23:20.
- 23:20: the tenth Potato finishes and the Carrot job starts at once (gathering needs no inputs), ending 08:20.
- If the owner had recalled her at 22:30 instead: nine Potatoes paid, the tenth's 45 minutes of progress lost, the
  Carrot job dropped.

A Kitchen job reserves more: **Cook Carrot Salad × 3** takes 12 Chopped Carrot and 3 Wheat Flour at the start
([08](08-item-catalogue-and-recipes.md) §4). Recalled after one and a half salads, it pays one salad and returns 8
Chopped Carrot and 2 Wheat Flour.

**Which queue starts first.** When several queued jobs would start while the app is closed, they start in time order
(ties by building order in §1, then slot), each checking the free stock left by the ones before it. Outputs that are
finished but not collected do not count as stock. So two devices, or a reload, always reach the same result.

### Why these times

| | uma-rpg (Farm today, D96) | Today's racer Farm (M031, D304) | This design |
|---|---|---|---|
| Gather one raw | 30 + 30*g*: 60–330 min | 6 raw at the end of a 6-hour job | 90 + 5(*g*−1): 90–135 min |
| Craft (refine) one | a quarter: 15–82.5 min | 6 → 6 in 6 hours | a quarter: 22.5–33.75 min |
| Cook one | twice a raw: 120–660 min | 1–4 meals in 6 hours | 240 + 10(*g*−1): 240–330 min |
| Grade 10 ÷ grade 1 | 5.5× | no grades (blocks of five scenarios) | 1.5× |
| EXP | 2 a base minute; 1,440 → 2,160 a level | 12 a job; 24 a level | 1 a minute × aptitude; 480 → 720 a level |
| Lv 1 → 50 | 735 hours of work | 98 jobs | 490 hours of work at C, 306 at A |

- **uma-rpg's steep curve** fits a world map that gets harder continent by continent. Here every scenario should take
  about four weeks (D334). A grade-10 dish at 5.5× the cost of grade 1 would make scenario 5 three times slower than
  scenario 1. So grades are mainly a **gate** and a **marker**; volume does the pacing ([12](12-economy-and-pacing.md) §4).
- **Today's 6-hour batches** pay nothing until the end, so a check-in after five hours collects nothing. One output
  every 90 minutes means every check-in collects something, and a 1–10 job can be sized to the next check-in or to the
  night ([02](02-check-ins-and-notifications.md)).

## 3. Aptitudes speed Farm Levels, not jobs

The owner's rule (D336), as uma-rpg landed on it: **an Uma levels 2–3 Farm Levels a day, and 4–5 when her running
aptitudes suit what she's making.** Each family is matched to one running aptitude, the four distances and the four
running styles, so every Uma is good at something:

<!-- live:farm-aptitudes -->
| Family | Aptitude that suits it | Why the pair |
|---|---|---|
| Sweets (Speed) | Sprint | Speed for the shortest races |
| Fish (Power) | Mile | Power for the mile's push |
| Herbs & Spices (Wit) | Medium | Wit for the tactical middle distances |
| Fruits (Stamina) | Long | Stamina for the long races |
| Nuts & Seeds (Guts) | End Closer | Guts to come from the back |
| Grains (Skill: Friend and Group) | Pace Chaser | Runs with the pack, like a team card |
| Vegetables (Constellation) | Front Runner | Leads the way, as the tree grows out from its root |
| Mushrooms (Inspiration) | Late Surger | Grows in the shade and comes late, like a lineage |
<!-- /live -->

**Which aptitude counts:**
- **Gathering** uses the site's family. The Pantry uses the family of the item being crafted.
- **The Kitchen** uses the dish's family. A Duo or a Feast uses the best of its families.
- Surface aptitudes (Turf, Dirt) aren't used. Most Umas are strong on one surface, which would split the roster in two
  rather than give each Uma her own specialty.

**What it changes: Farm EXP, not the job's time.** The aptitude multiplies the Farm EXP a job pays:

<!-- live:farm-exp-multipliers -->
| Her aptitude for the family | S | A | B | C | D | E, F, G |
|---|---|---|---|---|---|---|
| Farm EXP × | **1.8** | **1.6** | 1.2 | 1.0 | 0.9 | 0.8 |
| Levels a day, working without a break, at Lv 1 → Lv 49 | 5.4 → 3.6 | 4.8 → 3.2 | 3.6 → 2.4 | 3.0 → 2.0 | 2.7 → 1.8 | 2.4 → 1.6 |
<!-- /live -->

"Working without a break" is how uma-rpg states its rates. A real Uma with check-in gaps does about 60% of it.

uma-rpg speeds the job itself instead (S/A work at half time). The racer doesn't, for one reason: the four-week pace
([12](12-economy-and-pacing.md)) then holds whoever is assigned where, and the timer on screen is the same for every
Uma. The aptitude still gives the owner a reason to put the right Uma on the right site: she levels nearly twice as
fast. The job sheet stars a suited Uma (an S or A letter for what she'd make), uses suited as the tie-break after Farm
Level (D368), and names the chosen one's line ("Sprint A · Farm EXP ×1.6").

## 4. Farm Level

| Rule | Value |
|---|---|
| **Range** | Lv 1–50 per Uma **per tier** (D327) |
| **Source** | Farm work only: gathering, crafting and cooking. Training Hub sessions, races and Speed Tickets pay none |
| **Rate** | **1 Farm EXP per listed minute** of each finished output (the §2 minutes × *k*, before building speed) **× her aptitude for the family** (§3). Paid at collection |
| **Curve** | Level *L* → *L*+1 costs **480 + 5(*L*−1)** EXP: 8 hours of work at Lv 1, 12 at Lv 49. Lv 50 is 29,400 EXP |
| **Grade gate** | Grade *g* opens at **Lv 5*g* − 4**: 1, 6, 11 … 46. It gates every step: gathering and crafting grade *g*, and cooking a dish of grade *g* (the dish's grade, not its side's) |
| **After Lv 46** | Lv 47–50 open nothing new; they complete the tier's Farm track. EXP stops counting at Lv 50 |
| **Promotion** | Farm Level resets to 1 in the new tier ([04](04-tiers-and-promotion.md)). Items are not tied to a tier |

EXP is paid per **listed** minute so that Farm Level measures work done, not wall-clock time. A Lv 3 building or a
Speed Ticket gets the work done sooner and the EXP with it. EXP is kept in quarter points so a 22.5-minute craft pays
exactly 22.5; the screen shows whole numbers.

### When an average Uma opens each grade

Each grade opens at its Farm Level, after this much Farm EXP:

<!-- live:farm-level-grades -->
| Grade | Farm Lv | EXP |
|---|---|---|
| 1 | 1 | 0 |
| 2 | 6 | 2,450 |
| 3 | 11 | 5,025 |
| 4 | 16 | 7,725 |
| 5 | 21 | 10,550 |
| 6 | 26 | 13,500 |
| 7 | 31 | 16,575 |
| 8 | 36 | 19,775 |
| 9 | 41 | 23,100 |
| 10 | 46 | 26,550 |
| (Lv 50) | 50 | 29,400 |
<!-- /live -->

An average Uma works 75% of the day and puts 80% of that into the Farm: 864 minutes a day
([12](12-economy-and-pacing.md) §6). The day she reaches each grade at that rate, and the day the loop simulation's
founding cohort measured in tier 1 (T132):

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

**Every grade is open within about a month of a tier** (about three weeks for the cohort), while the tier runs about
20 weeks. So Farm Level is a fast climb at the start of each tier, and for an Uma who joins mid-tier, and never what holds a scenario back.
Which grade each unlock asks for is a rule of the layers ([05](05-training-hub.md) §3), not of Farm Level.

**Umas who join late.** An Uma unlocked mid-tier starts at Farm Lv 1 in scenario 1, and her own first unlocks need the
grade-1 and grade-2 dishes she can make at once. She reaches the top grades in three to five weeks, and meanwhile the
shared Warehouse and higher-level Umas cover anything she can't make yet.

## 5. Workers

| Rule | Value |
|---|---|
| **Who** | Any owned Uma, at any building. Only her own Farm Level gates the grades she can work (§4) |
| **One passive thing at a time** (D328) | A Farm job (running, queued or finished but not collected) or a Training Hub session, never both |
| **Racing** | Never blocked. An Uma at the Farm can race, and racing doesn't touch her job |
| **One Uma per slot** | A slot holds one job, and so one Uma, at a time |
| **A slot is held by a job, not by an Uma** | Collecting a finished job frees both the slot and the Uma. She has no standing assignment; Repeat (§9) brings her back |
| **Moving a worker** | A free Uma can start a job at any free slot. A busy one is moved by **Recall** (her row's ⋯, §10), then a new job: Recall shows what is lost (the output in progress and the queue) before it confirms |
| **Into a session** | Sending an Uma whose Farm job is finished to a session collects it first, in the same tap. A running job must be recalled first |
| **Promotion** | **Promotion needs her free** ([04](04-tiers-and-promotion.md) §5): no running job, no queue, nothing waiting for Collect. The Promote sheet offers Collect, Recall or Speed Tickets, or says when she'll be free. So no job spans two tiers' Farm Levels |

## 6. Slots

A slot sits idle between an Uma's last output and the next check-in, just as she does, so the slots an activity needs
are its hours a day ÷ (24 × 0.75) ([12](12-economy-and-pacing.md) §7). Work isn't spread evenly over the ten
buildings: cooking is 30% of all Farm work, and Vegetables feed every constellation node. So slots aren't uniform.

<!-- live:farm-slots -->
| Building | Lv 1 | Lv 2 | Lv 3 |
|---|---|---|---|
| **Kitchen** | 6 | 8 | 8, speed ×1.25 |
| **Pantry** | 3 | 5 | 5, speed ×1.25 |
| **Vegetable Garden** | 4 | 5 | 5, speed ×1.25 |
| **Each of the other seven sites** | 2 | 3 | 3, speed ×1.25 |
| **All ten** | **27** | **39** | 39 (48.75 slot-equivalents) |
<!-- /live -->

### Slot demand at the target

The loop simulation's baseline (T132, D348): a roster growing from 20 to 25, three check-ins, the planner's suggestions
and the spending policy's upgrades. A slot is held from a job's start until Collect, so the hours count the wait for
the next check-in too. "Slots needed" is hours a day ÷ 18 (24 hours × 75%), and each use is the slot time held over a
tier-1 scenario's window (the cohort's median entry to its median finish):

<!-- live:loop-farm-slots -->
| Building | Slots Lv 1 / 2 / 3 | Hours a day held, tier 1 | Slots needed (÷ 18) | Use in 1·1 | Use in 1·2 | Use in 1·3 | Use in 1·4 | Use in 1·5 | Peak, all tiers |
|---|---|---|---|---|---|---|---|---|---|
| Sugar Grove | 2 / 3 / 3 | 20.8 | 1.2 | 31% | 33% | 32% | 30% | 28% | 40% (2·2) |
| Orchard | 2 / 3 / 3 | 20.8 | 1.2 | 32% | 36% | 27% | 34% | 23% | 40% (3·2) |
| Fishery | 2 / 3 / 3 | 19.9 | 1.1 | 33% | 34% | 31% | 35% | 20% | 39% (2·2) |
| Nut Grove | 2 / 3 / 3 | 20.5 | 1.1 | 22% | 32% | 41% | 22% | 34% | 41% (1·3) |
| Herb Garden | 2 / 3 / 3 | 19.6 | 1.1 | 29% | 27% | 43% | 19% | 34% | 43% (1·3) |
| Fields | 2 / 3 / 3 | 27.3 | 1.5 | 50% | 27% | 54% | 31% | 43% | 57% (2·3) |
| Vegetable Garden | 4 / 5 / 5 | 44.0 | 2.4 | 58% | 34% | 31% | 30% | 33% | 63% (2·1) |
| Mushroom Cave | 2 / 3 / 3 | 38.0 | 2.1 | 51% | 58% | 52% | 74% | 54% | 76% (3·4) |
| Pantry | 3 / 5 / 5 | 67.6 | 3.8 | 56% | 55% | 65% | 76% | 63% | 80% (2·3) |
| Kitchen | 6 / 8 / 8 | 124.2 | 6.9 | 74% | 63% | 65% | 77% | 74% | 79% (2·5) |
<!-- /live -->

How to read it:
- **About 17 Farm slots are held at any moment over tier 1, 13 of them working**, and the 27 slots of Lv 1 hold the
  20-Uma start.
- **The Kitchen is the busiest building**, about 130 slot-hours a day: cooking is the longest step, and a 4.8–5.4-hour
  dish fills only half of a 9.5-hour gap between check-ins. Six slots carry the 20-Uma start; the eight of Lv 2 carry
  25 at about 80%.
- **The Pantry is the fullest.** The planner fills its slots at nearly every check-in, and the owner queues more crafts
  behind one that ends early, so it has five slots at Lv 2 and 3, not four (D351): with four it ran at the 90% ceiling,
  with five it peaks at about 80%.
- **The Vegetable Garden is the hot site in scenario 1**, where 12 of the 27 unlocks are constellation nodes, and the
  **Mushroom Cave** in the scenarios with six Inspiration unlocks. Fields carries 63 of a tier's 107 sides.
- **The stat sites run under half full** since D338 halved the Gym's singles ([08](08-item-catalogue-and-recipes.md)
  §7). Their third slot at Lv 2 is headroom for a Speed-heavy deck.
- Upgrades buy headroom above these averages, so the owner can catch up after a missed day.

## 7. Building upgrades

Upgrades are the account's, and buildings carry through promotion (D327). Prices use the anchor **1 Prize Money ≈ 1
minute of Uma work** (D331), plus crafted items of the building's own family. The Pantry and Kitchen serve every
family, so they take one or two of each.

<!-- live:farm-upgrades -->
| Building | To Lv 2 (one more slot; two for the Pantry; two for the Kitchen) | To Lv 3 (speed ×1.25) |
|---|---|---|
| Each site | 1,200 PM + 4 crafted grade 1 of its family | 2,400 PM + 4 crafted grade 3 of its family |
| Pantry | 1,500 PM + 1 crafted grade 1 of each of the eight families | 6,000 PM + 1 crafted grade 3 of each family |
| Kitchen | 3,000 PM + 2 crafted grade 1 of each of the eight families | 12,000 PM + 2 crafted grade 3 of each family |
| **All ten** | **14,100 PM** | **37,200 PM** |
<!-- /live -->

- **Lv 2 needs only grade-1 items and Prize Money**, so it comes with tier 1's first careers: the sim's account buys
  every Lv 2 between days 31 and 34, as the roster starts growing past 20. Lv 1 carries the 20-Uma start.
- **Lv 3 opens once someone reaches Farm Lv 11** (grade 3, about day 4 of a tier); the sim's account has every Lv 3 by
  about day 65, busiest building first. It pays back in six to ten days of the time
  it saves: ×1.25 saves a fifth of a building's work, which is ~21 Uma-hours a day at the Kitchen (~1,260 PM a day),
  ~10 at the Pantry, ~7 at the Vegetable Garden and ~5 at a stat site.
- **All twenty upgrades cost 51,300 PM**, about four weeks of the target's racing (about 1,850 PM a day,
  [12](12-economy-and-pacing.md) §3). Racing bunches at the end of each layer (D336), so they arrive in two waves, after
  the first and second scenarios.
- An upgrade bought while jobs run adds its slots at once; the speed applies to jobs started after it.
- The sim reports when each building reaches each level ([12](12-economy-and-pacing.md) §7) and checks every building's
  slot use against 90% in every scenario window (§12).

**Pacing note.** With all ten buildings at Lv 3, Farm work takes 80% of its listed time, and the sim measures tiers 2
and 3 at 20–23 days a scenario ([12](12-economy-and-pacing.md) §5). Buildings carry, so that is the steady state for
most of the game; [12](12-economy-and-pacing.md) §10's time factor per tier is the lever if the owner wants it slower.

## 8. Speed Tickets

Today's **Energy** becomes the **Speed Ticket**: an item in the Warehouse, bought at the Exchange (30 PM, D331,
[09](09-racing-rewards-and-exchange.md)). On the Farm:
- **−30m** takes 30 minutes off the Uma's **running job**: its end and every output still to come move 30 minutes
  earlier. A queued job then starts sooner.
- **Finish** spends ⌈remaining minutes ÷ 30⌉ tickets and completes the running job at once.
- A ticket can't be used on a finished job, a queued one or an empty slot. If less than 30 minutes remain, the sheet
  shows the minutes wasted before it confirms.
- A ticket pays no output or EXP by itself: the outputs it hurries pay their listed EXP at collection.
- The same ticket works on Training Hub sessions ([05](05-training-hub.md)).

## 9. Collect all, Repeat and queues

[02](02-check-ins-and-notifications.md) owns how these look and where the buttons are. The Farm's rules underneath:
- **Collect all** collects every finished output in every slot, each with its own receipt. A failure in one slot never
  blocks the others, and the result says which failed.
- **Repeat** restarts each free Uma's **last job** (same building, item and count) if a slot there is free. If the
  Warehouse covers fewer than her last count, it **shrinks to the largest count the stock covers** and says so
  ([02](02-check-ins-and-notifications.md)); if it covers none, or no slot is free, that Uma is skipped with the reason
  ("Kitchen full", "4 Honey short").
- **Queues** follow §2: up to 3 behind the running job, inputs reserved only when each starts, the whole queue drops
  when the next job can't be covered. A dropped queue is reported in the next check-in summary and its notification.
- Nothing restarts by itself. Repeat and queues are the only ways a job starts without a fresh choice.

## 10. Screens

The Hub's **Farm page** ([11](11-hub-and-places.md)) shows the ten buildings, each with slot pips (the worker's face
ringed by her output's progress) and a **Ready** badge. Tapping one opens its quick look in the side panel; **Enter**
opens its page. Every Farm screen follows four rules the owner set after playing T140's (D366):
- **Durations, never clock end times.** A job reads how long it has left ("1h 20m") or will take ("×4 · 7h 12m"), and
  **Done** once it has ended (`durationText`, 02 §3).
- **Icons with a number beat words:** item icons, Uma faces and small badges. Explanations sit behind (i) and in
  VoiceOver's labels ("Collect 2 Carrot").
- **The obvious choice is preselected**, so most actions are one tap.
- **Nothing scrolls** at 390 × 844 for a building of up to four slots; only the Kitchen's eight do. Compactness comes
  from layout: every target stays 44 pt.

### The quick look

The side panel ([11](11-hub-and-places.md) §2.6), uma-rpg's structure made tappable:
1. **Header:** level, slots in use and speed as chips ("Lv 2", "3/4", "×1.25"; speed only above ×1).
2. **One row per slot, about 48 pt:**
   - running: her face in its progress ring, the item's icon, "Carrot ×2 · 0/2", a "+1" chip with the next queued
     item's icon, and the time left;
   - finished: **Done**, with **Collect** (its count) and **Repeat**: `collect`, then the domain's `repeat` for her
     alone, which restarts her last job at the same building, item and size, shrunk to the stock or skipped with its
     reason (§9, [02](02-check-ins-and-notifications.md) §5);
   - free: a "+" that opens the job sheet at once, over the map (`/farm?peek=:place&job=&slot=:n`).
3. **For your targets** as icons (below), each opening the sheet over the map, and a site's stock by open grade.
4. **Collect here** when anything is ready, then the panel's **Enter {place}**.

From the Hub: collecting a building is 2 taps (the building, Collect here); collecting and restarting a finished job is
2 (the building, Repeat); a new job in a free slot is 3 (the building, +, Start).

### The building page

At 390 × 844, top to bottom:
1. **Header, one 52 pt row:** the chips, and **Upgrade** as a button showing its Prize Money mark and amount. It
   opens one sheet: the whole cost item by item against stock, what the level brings, and **Yes**. When the account
   can't pay, the button stays tappable and the sheet says why in the rule's words. (i) in the title bar holds the help.
2. **For your targets:** one row of item icons, each with "×N" short (a check when what's coming covers it, a lock when
   no Free Uma's Farm Level opens it), scrolling sideways. A tap opens the job sheet filled in with that item, the
   planner's Free Uma and her size; one more tap starts it. VoiceOver reads the line in 02 §6's words ("Vegetables G3 ·
   short 6 · Warehouse 4 · coming 2 (Gold Ship, in 1h 20m)").
3. **One row per slot, 56 pt:** her face in its progress ring; the item's icon; "×10 · 3/10"; the time left, or
   **Done**; and trailing 44 pt icon buttons: **Collect** with its count while outputs wait; **Repeat** on a finished
   job; a **Speed Ticket** that opens −30m, Finish and "Buy N and finish" in a small sheet (§8); and **⋯** for **Queue
   next**, her queue (move earlier, remove) and **Recall** with its preview. Queued jobs follow as small chips with
   their durations ("then [Carrot]×4 · 7h 12m"). A free slot is a dashed "+" row that opens the sheet.
4. **Collect here** and **Repeat here**, side by side in the thumb zone; off, each says why on itself ("Nothing to
   collect", "Nobody to repeat").

From the page, a new job is 2 taps (+, Start), and so is a target's (its icon, Start).

### The job sheet

One screen, everything preselected:
1. **Free Umas:** a strip of 44 pt faces, each with her Farm Level as a badge and a star when her aptitude suits what
   she'd make (§3); one line under it names the chosen one with her aptitude. **Only Free Umas** are listed: never one
   working anywhere, in a session, or Ready with a finished job still holding its slot. With none, the sheet says "No
   free Uma", with **Collect here** when a finished job here would free one, and nothing else. **Queue next** (a row's
   ⋯) names her and skips this step. The strip opens on **Farm Level, highest first**, then suited (S or A), then
   release newest first, name and id (D368), not the EXP multiplier. Unless a link names her, the preselected Uma is
   the first row. The planner's item and size are kept when they belong to her; otherwise the item the plan most needs
   that she can make (else her highest grade) is preselected, sized to the check-in.
2. **What:** an icon grid, five to a row, so a site's ten grades fit in two rows. Each cell holds the 32 pt icon, its
   grade in the corner, the stock, the plan's "×N" needed, and a lock with "Lv16" above her Farm Level; the chosen one
   is ringed, and one line under the grid names it with its stock (a dish also its destination and the Umas whose
   unlocks want it). The Pantry's families and the Kitchen's tabs (Speed · Stamina · Power · Guts · Wit · Skill bonds ·
   Constellation · Inspiration · Duos · Feasts · Can cook now) are icon chips: the stat and bond type icons, a star, a
   spark, a Duo's and a Feast's dish, a check; a family's first crafted item.
3. **How many:** a chip per size the stock covers, each with how long it takes ("×1 · 1h 48m", "×4 · 7h 12m" for a
   grade-1 gather). The size that fits until the next check-in ([02](02-check-ins-and-notifications.md) §3) carries a
   check-in mark (a moon when that check-in is the morning's) and is preselected.
4. **Inputs:** one line of input icons with have/need, red when short, and the Farm EXP. A shortfall links to the
   building that makes it, and to the Exchange's row for stocked raw; a raw grade above her Farm Level links to the
   Exchange too.
5. **Start · ×4 · 7h 12m** (or **Queue · ×4 · 7h 12m**), one footer button; when it can't run it says why in the
   rule's own words.

**What's preselected (D368):** the first Free Uma by Farm Level, then suited, release and name. If the planner suggests
an item and size for her here, keep those; otherwise the item the plan wants most that she can make (her Farm Level
opens it and the stock covers one), else the highest grade she can work; and the size the check-in fits. A link that
names an item (a target's icon, the Warehouse's Make more, a shortfall's) keeps it and its count, with the first Free
Uma in that order whose Farm Level opens it. A link naming an Uma keeps her, even if she is not the first row.

Gone from the sheet (D366): busy Umas, **Add to queue** on another Uma's job, and **Recall and start here**. Recall and
Queue next live on the slot's row.

### The Warehouse's Farm goods

The Warehouse is in Town Hall ([11](11-hub-and-places.md)). It is the one inventory, and it doesn't reset at promotion.
It is uma-kit's shelf frame (`ShelfView`, SD4), filled with this game's stock:
- **Shelves:** Raw · Crafted · Dishes · Tickets. Grade chips: every grade, one grade, or **Highest** (the highest grade
  held in each family).
- **A row** for each stack held: icon, name, count, then **reserved** (inside running jobs), **coming** (unfinished
  outputs) and **needed** (the planner's open needs).
- **A stock sheet:** what's held; family, grade and destination; what's reserved, coming, needed and free; the recipes
  that use it; **Make more** (opens the building's job sheet); **Sell ×1 / ×10 / All** at a third of its work value
  ([09](09-racing-rewards-and-exchange.md), [08](08-item-catalogue-and-recipes.md) §8). Reserved items aren't held
  (they're inside their jobs), so they can't be sold; selling into what the planner needs asks first.

**As built (T138).** A row's counts come from one projection of the work at the clock: **held** is the Warehouse
settled to now; **reserved** is `reservedStock(state, now)` (`work/activity.ts`), the inputs of every item not yet
made in a started entry, which is exactly what Recall would hand back; **coming** is `projectWork(...).coming` by item;
**needed** is `neededFromStock` over the plan for `targetsOf`. The shelves list what's held (a stack only reserved,
coming or needed shows in the Peek's shortfalls and the planner, not on a shelf), and an empty Warehouse reads
[09](09-racing-rewards-and-exchange.md) §8's "Nothing to sell yet: the Farm's first harvest lands here".
A dish reads its destination ("Carrot Salad · Constellation · grade 1"), an ingredient its family; **Make more** opens T140's
job sheet at the building that makes it (`/farm/:building?job=&back=`).

## 11. Edge cases

| Case | What happens |
|---|---|
| **Offline for a day** | Every output finishes on its timestamps and queues advance in order (§2). Nothing is collected until the owner opens the app |
| **Empty Warehouse** | Pantry and Kitchen jobs can't start: the sheet names the shortfall and links to the site. Repeat skips them; a queue reaching them drops |
| **A stale screen** | Start, queue and recall carry what the screen showed. If the stock or the slot changed (another device, a queue that started), the API refuses and the screen reloads with the new state; nothing is half applied |
| **A retried tap** | Every operation has an id; a retry returns the first receipt and is never applied twice |
| **An Uma in a session** | Not in the job sheet, which lists Free Umas only (§10) |
| **An Uma bought mid-tier** | Farm Lv 1, grade 1 only, any building; her scenario-1 dishes are grade 1 and 2 |
| **A promoted Uma** | Farm Lv 1 again in the new tier ([04](04-tiers-and-promotion.md)); the items she made stay in the Warehouse |
| **Upgrade mid-job** | New slots appear at once; running jobs keep their frozen speed |
| **Clock moved** | Forward: outputs finish early (trusted device). Backward: the wait grows; no output is taken back |
| **Two devices** | Both show the same jobs after one sync. Queue starts are recomputed in the same order on both |

## 12. What's saved

| Row ([13](../rework/13-removals-and-plan-changes.md) §6) | Farm fields |
|---|---|
| `buildings/{id}` | Level. Which job holds a slot is read from the work rows (§14) |
| `work/{outfitId}` | Her running job (building, slot, kind, item or recipe, count, listed minutes, speed, reserved inputs, `startedAt`, acceleration, outputs collected so far), her queue of up to three, her last job for Repeat, and a dropped queue with its reason until the owner acts on it ([02](02-check-ins-and-notifications.md)) |
| `umas/{outfitId}` | Farm EXP for her current tier, in quarter points; the level is derived |
| `items/{itemId}`, `itemLedger` | Stock and every movement: reserve, return, output, sale, upgrade cost |
| `operations` | One receipt per `start`, `queue`, `collect`, `collect-all`, `repeat`, `recall`, `speed-up` and `upgrade` (no `assign`: a slot is held by a job, §5) |

The server re-runs each operation with the domain package before committing it, as in [rearchitecture/05](../rearchitecture/05-farm.md) §6.

## 13. What this replaces

The old Farm, the Stable Kitchen (M031, D304–D320; deleted with the cutover, readable at the `pre-split` tag;
[rearchitecture/05](../rearchitecture/05-farm.md)), concept by concept:

| Before | After the rework |
|---|---|
| Five districts × six stations, all 30 open (Vegetable Garden, Orchard, Barnyard, Workshop, Kitchen) | Ten uma-art buildings: eight family sites, the Pantry and the Kitchen, 27 → 38 slots (§1, §6) |
| Station ids `garden-1` … `kitchen-6` | Building id plus slot index |
| Workers: an outfit holds one station until moved; a busy one waits for her claim | A slot is held by a job; Recall moves a busy Uma (§5) |
| 6-hour jobs; raw yields 6; Workshop 6 → 6; Kitchen 1–4 meals | 1–10 outputs one after another, 22.5 to 330 minutes each (§2) |
| Inputs frozen and spent at Start; a ready job waits for its claim | Inputs reserved at the start; finished outputs wait for Collect; Recall returns unused inputs |
| 12 Farm EXP a claim, 24 a level, uncapped and never reset | 1 EXP a listed minute × aptitude, 480 + 5(*L*−1) a level, Lv 1–50 per tier, reset at promotion (§4) |
| Ingredient blocks of five scenarios; personal Lv 1/51/101 | Grades 1–10 per tier, open at Lv 5*g* − 4 |
| Account milestones: first worker at block Lv 6 opens processing, Lv 9 cooking | Gone: the Pantry and Kitchen are open from day one, gated by grade only |
| 1,169 item definitions: 7 raw × 5 stats and 9 processed × 5 per scenario, 14 flavour rows | 160 items, 92 dishes and the Speed Ticket ([08](08-item-catalogue-and-recipes.md)) |
| Same-block substitutions; processed items worth double | Gone: each recipe names exact items |
| 16 meals a block (5 pure, 10 pair bentos, Sunrise Banquet) | 80 planet dishes, 4 stat Duos at grades 3 and 5, 4 Feasts ([08](08-item-catalogue-and-recipes.md)) |
| A meal buys any node on the outfit's 65-node Extra map per block | A dish pays one Training Hub session; the Extra Stats map per tier is the Gym's ([05](05-training-hub.md)) |
| Extra capacity 18 + 2 × (scenario − 1); active nodes per distance preset | Capacity 7–15 (README, D338); presets in [05](05-training-hub.md) |
| Energy: 30 minutes off one job, granted by a debug button | The Speed Ticket, bought with Prize Money (§8); dev builds may grant tickets |
| Collect all; explicit Repeat; no queues or auto-repeat | Collect all, Repeat and queues of three (§9, [02](02-check-ins-and-notifications.md)) |
| Wishlist of three meals; shopping list | The planner: what every Uma still needs ([02](02-check-ins-and-notifications.md)) |
| Cookbook records (first preparation, totals) | Gone: the recipe picker lists every dish, and the Warehouse shows stock |
| The Farmhouse: Crew, Recipes, Wishlist | Gone: Farm Level is on each Uma's profile and the job sheet; recipes in the Kitchen's sheet; needs in the planner |
| Original SVG marks for districts, families, meals and Energy | uma-art's buildings, item icons and dishes; a new Speed Ticket icon ([11](11-hub-and-places.md)) |
| Farm cutover, recovery, Puzzles-bank guard, farm sync lane, release flags | Already deleted by the re-architecture ([rearchitecture/05](../rearchitecture/05-farm.md) §2) |
| `farm/main`, `farmWorkers`, `farmRecipes`, `farmExtra` rows | `buildings`, `work`, `umas` and `items` (§12) |

## 14. Decided here

| Choice | Why |
|---|---|
| **Running aptitudes speed Farm Levels, not jobs** (§3): S ×1.8 … E–G ×0.8, one distance or style per family | The owner's 2–3 levels a day, 4–5 when suited (D336), while every job's timer stays the same for every Uma |
| **Farm EXP per listed minute, paid at collection, in quarter points** | Farm Level measures work done; building speed and tickets bring it sooner without changing its meaning |
| **Grade gate on every step; a dish gated by its own grade** | One rule; sides of lower grade never block a cook |
| **Lv 47–50 open nothing; EXP stops at Lv 50** | Grade 10 opens at 46 by the README's formula; the last levels close the tier's track |
| **Slots: Kitchen 6/8, Pantry 3/5 (D351), Vegetable Garden 4/5, other sites 2/3; Lv 3 ×1.25** | Sized to the slot demand (§6): Lv 1 carries 20 Umas, Lv 2 carries 25 under 90% |
| **Upgrade prices** (§7): sites 1,200 / 2,400, Pantry 1,500 / 6,000, Kitchen 3,000 / 12,000 PM, plus items | Six to ten days' payback on the Uma-time saved; Lv 2 with the first racing, Lv 3 from grade 3 |
| **A slot is held by a job, not an Uma** | One passive thing at a time stays simple, and sessions never fight a standing Farm seat |
| **Repeat restarts each free Uma's last job** | Matches "Repeat to restart every job and session"; no hidden reservations |
| **A queue checks collected free stock, in time order** | Deterministic offline and across devices |
| **Speed Tickets act on the running job only; Finish = ⌈remaining ÷ 30⌉** | Today's Energy rule and uma-rpg's Finish, unchanged in spirit |
| **Sending a done Uma to a session collects her first** | Saves a tap on the most common move |
| **Promotion needs her free** (decided in [04](04-tiers-and-promotion.md) §5) | No job spans two tiers' Farm Levels, and no job runs at a grade her new Farm Level can't start |
| **No Farmhouse, cookbook or account recipe milestones** | Their jobs move to the planner, the job sheet and the Warehouse |
| **Farm EXP is per real listed minute:** base × `TIME_FACTOR`, before building speed (T127) | It's the only reading that keeps §4's "8 hours of work at Lv 1", §3's levels a day, [12](12-economy-and-pacing.md) §6's day table and [08](08-item-catalogue-and-recipes.md) §5's "× *k*" true at *k* = 1.2. §2's "285 Farm EXP" is a base-minute example |
| **Farm EXP is rounded to quarter points once per item**, then multiplied by the items collected | ×0.9 and ×1.8 aren't exact in quarter points, and split collects must pay the same as one |
| **Ticket time is kept in whole milliseconds and clamped to the time remaining** | Finish then ends exactly when it's used, so nothing starts in the past |
| **A Speed Ticket count above what finishes the job spends only what finishes it** | A screen that is a minute old still does what the owner meant ([02](02-check-ins-and-notifications.md) §9) |
| **A queued job takes its speed and inputs when it starts, and its grade gate when it's added** | [05](05-training-hub.md) §7 applies speed to work "started after it", and Farm Level never drops within a tier |
| **A queue edit is refused if any queued job would no longer start in order** (its place, its grade, a session's unlock order) | Nothing in a queue is left to fail at night for a reason the sheet could have said |
| **Ties go by §1's order, then the facilities, rooms and slot** | §2 orders only the Farm buildings, but sessions queue too |
| **A Duo or Feast earns Farm EXP by its main families, not its side** | A planet dish's family excludes its side (§3, [08](08-item-catalogue-and-recipes.md) §4) |
| **There is no `assign` operation:** work rows hold slots, and building rows hold levels only | §5 has no standing assignment, and a slot read from the job in it can never disagree with that job |
| **Collect never refuses, and Recall with nothing running acts as Collect** | [02](02-check-ins-and-notifications.md) §9: an action already done shows its result |
| **An upgrade's only gate is its cost** | Its grade-3 items are §7's "from Farm Lv 11" |
| **An upgrade's Prize Money is a ledger row** `upgrade:<building>:<level>`, reason `upgrade` | [09](09-racing-rewards-and-exchange.md) §9's reasons and audit; a building reaches each level once, so the id is once-only |
| **Promotion clears her idle work row** (her last job and any dropped queue) | [02](02-check-ins-and-notifications.md) §5 never repeats a promoted Uma, and her last job's grade may be above her new Farm Level |
| The job sheet opens over the building page from its query (`?job=:itemId&uma=:umaId&count=:n&queue=1&slot=:n&back=<path>`), `back` an in-app path only; an empty `job=` opens it preselected, and `slot` is the "+" row's. The quick look opens the same query over the map (`/farm?peek=:place&job=…`), and closing it returns to the quick look (T140, D366) | Every place is a link ([11](11-hub-and-places.md) §1); the Warehouse, the planner and the session sheet reach it without importing it, and "+" and Queue next name their slot |
| A target's icon opens the sheet filled in with the suggested Uma and a fitted size, and one more tap starts it. Without a suggestion for that item, the first Free Uma whose Farm Level opens it, sized as `jobFor` fits it (capped by stock), else by `fitSize` (T140, D366) | §10 says "opens the job sheet with it filled in"; [02](02-check-ins-and-notifications.md) §6's one-tap start stays the summary's Start suggestions |
| "For your targets" is one row of item icons with "×N" short; each reads [02](02-check-ins-and-notifications.md) §6's line words to VoiceOver: family and grade ("Vegetables G3", a Duo or Feast by its kind), short (left out at 0), Warehouse, and coming with each worker and how long until it lands (T140, D366) | 02 owns the planner's views (§10 calls it "Needed now"); the planner's own Needs views keep the clock time |
| The sheet lists **Free Umas only**, Farm Level highest first, then suited (an S or A letter for the chosen item's families, else the site's), newest release, name and id (D368; D366 removed T140's Ready and busy list) | The owner wants one predictable level-first order, without Umas already allocated to jobs |
| The Pantry's items sit in family tabs in the ring's order; a site lists its family's ten grades (T140) | §10 tabs only the Kitchen; the ring is the Farm page's order ([11](11-hub-and-places.md) §3.4) |
| Can cook now lists dishes the free stock covers once and the chosen Uma's Farm Level opens (any Uma's highest when none is chosen); locks read the same way (T140) | §10 names the tab, not its rule; this is what Start would accept |
| **Needed × N** on an item is the plan's still-to-start count for it (`short`), every target together (T140) | It is what a job should make; what the Warehouse or the outputs coming already cover needs no badge |
| Moving a busy Uma is **Recall** on her row's ⋯, one confirmation naming what is lost (`recall` run on the current state), then the free slot's "+" (D366; T140's Recall and start here is gone) | §5's confirmation stays; the sheet holds only Free Umas |
| A shortfall links to the building that makes it and, for stocked raw, the Exchange; the sheet buys nothing inline (T140) | Only a stopped queue's Buy and restart ([02](02-check-ins-and-notifications.md) §4) and Finish ([09](09-racing-rewards-and-exchange.md) §5.1) buy inline; a purchase stays one deliberate tap |
| Every button runs its operation on the current state first, so a disabled one reads the rule's own refusal; with no free slot, Start says how long until the next job here ends, or that one is ready to collect (T140, D366) | §10's "a disabled button always says why", with no rule restated on screen |
| A row's Speed Ticket opens −30m and Finish in a small sheet. "Buy N and finish" runs `buy` then `finish`, two operations after one question. Under 30 minutes left, −30m and Finish are the same ticket, so only **Finish · 1** shows and asks with the minutes wasted; with no ticket held, −30m hides and Finish reads "Buy N and finish" (T140, D366) | [09](09-racing-rewards-and-exchange.md) §5.1; §8's "shows the minutes wasted before it confirms" |
| The header's **Upgrade** button (its Prize Money) opens one sheet with the whole cost and its refusal (`prize-money`, `short`) in the rule's words; it asks once; nothing shows at Lv 3 (T140, D366) | A spend of Prize Money and items confirms once, as the Exchange's large purchases do |
| A row's ring is the current item's progress (`itemProgress`) round her face, as the Hub's pips are, redrawn on the 30-second clock (T140, D366) | One look for the pip and its row ([11](11-hub-and-places.md) §4) |
| The quick look's stock by open grade runs up to the highest grade any current Uma has open; every building shows its targets as icons (T140, D366) | [11](11-hub-and-places.md) §3.4 says "by open grade"; the same reading as the Exchange's stock ([09](09-racing-rewards-and-exchange.md) §5.3) |
| Collect here and Repeat here sit in the page's thumb zone; off, each says why on itself ("Nothing to collect", "Nobody to repeat"); their receipt lists each line and each skip in the rule's words, a restart with how long it takes (T140, D366) | §10 puts them beside the global ones; [02](02-check-ins-and-notifications.md) §5's "Kitchen full", "4 Honey short" |
| `ui/work/` (SlotRow and PeekRow, PlaceStats, UpgradeButton, SpeedUpControls, RecallSheet, QueueChips, SizeChips) and `ui/ItemIcon` are shared with T139's facilities and T142's check-in; the job sheet's Uma strip is its own (T140, D366) | One look for every timed thing and every item; the Farm makes the items |
| **Every Farm screen shows how long work takes or has left, never the clock time it ends:** rows ("1h 20m", **Done**), size chips ("×4 · 7h 12m"), Start ("Start · ×4 · 7h 12m"), queue chips ("then Carrot ×4 · 7h 12m"), no-slot words and Repeat's receipt, all through the domain's `durationText` (D366) | The owner: "I don't like that you show the hour the job finishes instead of the time the job is going to take" |
| **The sheet preselects everything:** the first Free Uma in level order unless a link names her; the planner's item and size when they belong to her, else `bestItem` and the fitted size; a link's item and count are kept (D368) | "Less clicks": a free slot's job is one tap from the open sheet, with its Uma matching the new order |
| **Repeat on a finished row** is `collect`, then `repeat { outfitIds: [her] }`, two operations; the profile's Repeat sizing (same or fit, [02](02-check-ins-and-notifications.md) §5) applies as it does to Repeat here (D366) | The domain's Repeat, for one Uma; nothing restarts outside it (§9) |
| A suited Uma has an S or A letter for what she'd make (`suits`, `SUITED_LETTERS`) (D366) | §3's "4–5 levels a day when suited" |

## 15. Done when

- The domain's Farm rules have tests for: per-output timers at every grade and speed; reserve, collect and recall
  arithmetic (finished outputs paid, unmade inputs returned); queue start and drop in time order; Speed Ticket and
  Finish; Farm EXP per listed minute × aptitude and the 480 + 5(*L*−1) curve; the grade gate on each step.
- A synthetic fresh account can start, queue, speed up, recall, collect and upgrade through operations, and a
  second device shows the same jobs, stock and Farm Levels after one sync.
- Closing the app for 12 hours and reopening shows every output and queue start exactly where the timestamps put them.
- `pnpm sim:loop` reports every building's slot use per scenario; none averages above 90% with Lv 2 buildings and 25
  Umas, and the Kitchen at Lv 1 stays under 90% with 20.
- The sim's average Uma reaches Farm Lv 10*s* − 9 (grade 2*s*−1) within ±5 days of scenario *s*'s start.
- At 390 × 844 the building page shows every slot row of a building of up to four slots without scrolling (the
  Kitchen's eight scroll inside the page), every action is at least 44 pt, every disabled button states its reason, and
  no Farm screen shows the clock time a job ends.
- No Farm code reads a Training Level, a token, Energy, a district or a station id.
