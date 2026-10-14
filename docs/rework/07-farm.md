# 07 · Farm

> **Status: design for owner review, 2026-10-13 (D326, D327, D328, D330, D331, D334).** Nothing here is built. Every
> number is a **draft**: the loop simulation ([12](12-economy-and-pacing.md) §12) tunes it and its checks pin it.

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

**Per-output times** come from the README's time model ([12](12-economy-and-pacing.md) §4), for grade *g*:

| Job | Minutes per output | Grade 1 | Grade 10 |
|---|---|---|---|
| Gather one raw item (eight sites) | 90 + 5(*g*−1) | 90 | 135 |
| Craft one item (Pantry) | a quarter of gathering | 22.5 | 33.75 |
| Cook one dish (Kitchen, every kind) | 240 + 10(*g*−1) | 240 | 330 |

A building at Lv 3 divides these by 1.25 (§7). The speed is frozen into the job when it starts.

**The clock.** A job stores `startedAt`, the per-output minutes, the output count and its acceleration (minutes taken
off by Speed Tickets). Output *k* finishes at `startedAt + k × minutes − acceleration`. Readiness is recomputed when
the app comes to the foreground. The trusted-device clock policy stays as today: a clock moved backwards makes the
wait longer, never negative.

**Worked example.** At 08:00 Special Week (Farm Lv 7) starts **Gather Potato × 10** at the Vegetable Garden: 95 minutes
each, so outputs land at 09:35, 11:10 … and the last at 23:50. Behind it the owner queues **Gather Carrot × 6**.
- 13:00 check-in: three Potatoes are done. Collect pays 3 Potatoes and 285 Farm EXP. The owner spends one Speed Ticket:
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

**Which aptitude counts:**
- **Gathering** uses the site's family. The Pantry uses the family of the item being crafted.
- **The Kitchen** uses the dish's family. A Duo or a Feast uses the best of its families.
- Surface aptitudes (Turf, Dirt) aren't used. Most Umas are strong on one surface, which would split the roster in two
  rather than give each Uma her own specialty.

**What it changes: Farm EXP, not the job's time.** The aptitude multiplies the Farm EXP a job pays:

| Her aptitude for the family | S | A | B | C | D | E, F, G |
|---|---|---|---|---|---|---|
| Farm EXP × | **1.8** | **1.6** | 1.2 | 1.0 | 0.9 | 0.8 |
| Levels a day, working without a break, at Lv 1 → Lv 49 | 5.4 → 3.6 | 4.8 → 3.2 | 3.6 → 2.4 | 3.0 → 2.0 | 2.7 → 1.8 | 2.4 → 1.6 |

"Working without a break" is how uma-rpg states its rates. A real Uma with check-in gaps does about 60% of it.

uma-rpg speeds the job itself instead (S/A work at half time). The racer doesn't, for one reason: the four-week pace
([12](12-economy-and-pacing.md)) then holds whoever is assigned where, and the timer on screen is the same for every
Uma. The aptitude still gives the owner a reason to put the right Uma on the right site: she levels nearly twice as
fast. The job sheet shows it beside each Uma ("Sprint A · Farm EXP ×1.6"), and the picker sorts suited Umas first.

## 4. Farm Level

| Rule | Value |
|---|---|
| **Range** | Lv 1–50 per Uma **per tier** (D327) |
| **Source** | Farm work only: gathering, crafting and cooking. Training Hub sessions, races and Speed Tickets pay none |
| **Rate** | **1 Farm EXP per listed minute** of each finished output (the §2 minutes, before building speed) **× her aptitude for the family** (§3). Paid at collection |
| **Curve** | Level *L* → *L*+1 costs **480 + 5(*L*−1)** EXP: 8 hours of work at Lv 1, 12 at Lv 49. Lv 50 is 29,400 EXP |
| **Grade gate** | Grade *g* opens at **Lv 5*g* − 4**: 1, 6, 11 … 46. It gates every step: gathering and crafting grade *g*, and cooking a dish of grade *g* (the dish's grade, not its side's) |
| **After Lv 46** | Lv 47–50 open nothing new; they complete the tier's Farm track. EXP stops counting at Lv 50 |
| **Promotion** | Farm Level resets to 1 in the new tier ([04](04-tiers-and-promotion.md)). Items are not tied to a tier |

EXP is paid per **listed** minute so that Farm Level measures work done, not wall-clock time. A Lv 3 building or a
Speed Ticket gets the work done sooner and the EXP with it. EXP is kept in quarter points so a 22.5-minute craft pays
exactly 22.5; the screen shows whole numbers.

### When an average Uma opens each grade

An average Uma works 75% of the day and puts 80% of that into the Farm: 864 minutes a day
([12](12-economy-and-pacing.md) §6). The day she reaches each grade:

| Grade | Farm Lv | EXP | At C (×1.0) | Mixed, well assigned (×1.3) | Always suited (×1.6) |
|---|---|---|---|---|---|
| 1 | 1 | 0 | day 0 | day 0 | day 0 |
| 2 | 6 | 2,450 | 3 | 2 | 2 |
| 3 | 11 | 5,025 | 6 | 4 | 4 |
| 4 | 16 | 7,725 | 9 | 7 | 6 |
| 5 | 21 | 10,550 | 12 | 9 | 8 |
| 6 | 26 | 13,500 | 16 | 12 | 10 |
| 7 | 31 | 16,575 | 19 | 15 | 12 |
| 8 | 36 | 19,775 | 23 | 18 | 14 |
| 9 | 41 | 23,100 | 27 | 21 | 17 |
| 10 | 46 | 26,550 | 31 | 24 | 19 |
| (Lv 50) | 50 | 29,400 | 34 | 26 | 21 |

**Every grade is open within about a month of a tier**, while the tier's scenarios run about 21 weeks. So Farm Level
is a fast climb at the start of each tier, and for an Uma who joins mid-tier, and never what holds a scenario back.
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
| **Moving a worker** | A free Uma can start a job at any free slot. A busy one is moved by **Recall**, then a new job: the sheet shows what is lost (the output in progress and the queue) before it confirms |
| **Into a session** | Sending an Uma whose Farm job is finished to a session collects it first, in the same tap. A running job must be recalled first |
| **Promotion** | **Promotion needs her free** ([04](04-tiers-and-promotion.md) §5): no running job, no queue, nothing waiting for Collect. The Promote sheet offers Collect, Recall or Speed Tickets, or says when she'll be free. So no job spans two tiers' Farm Levels |

## 6. Slots

A slot sits idle between an Uma's last output and the next check-in, just as she does, so the slots an activity needs
are its hours a day ÷ (24 × 0.75) ([12](12-economy-and-pacing.md) §7). Work isn't spread evenly over the ten
buildings: cooking is 30% of all Farm work, and Vegetables feed every constellation node. So slots aren't uniform.

| Building | Lv 1 | Lv 2 | Lv 3 |
|---|---|---|---|
| **Kitchen** | 6 | 8 | 8, speed ×1.25 |
| **Pantry** | 3 | 4 | 4, speed ×1.25 |
| **Vegetable Garden** | 4 | 5 | 5, speed ×1.25 |
| **Each of the other seven sites** | 2 | 3 | 3, speed ×1.25 |
| **All ten** | **27** | **38** | 38 (47.5 slot-equivalents) |

### Slot demand at the target

25 Umas, 75% utilisation, base speed, using [08](08-item-catalogue-and-recipes.md)'s recipes and representative deck.
"Slots needed" is hours a day ÷ 18. The peak is the busiest scenario of the tier for that building.

| Building | Hours a day, tier average | Slots needed, average | Peak (scenario) | Slots needed at peak | Use at peak, Lv 1 / Lv 2 |
|---|---|---|---|---|---|
| Kitchen | 110 | 6.1 | 116 (1) | 6.4 | 108% / **81%** |
| Pantry | 53 | 2.9 | 54 (all) | 3.0 | 100% / **75%** |
| Vegetable Garden | 35 | 2.0 | 66 (1) | 3.7 | 92% / **73%** |
| Fields | 25 | 1.4 | 36 (5) | 2.0 | 100% / 67% |
| Sugar Grove | 24 | 1.3 | 31 (2) | 1.7 | 87% / 58% |
| Orchard | 24 | 1.3 | 31 (4) | 1.7 | 86% / 57% |
| Fishery | 24 | 1.3 | 30 (2) | 1.7 | 83% / 56% |
| Mushroom Cave | 32 | 1.8 | 40 (2, 4) | 2.2 | 111% / **74%** |
| Herb Garden | 25 | 1.4 | 29 (3) | 1.6 | 79% / 53% |
| Nut Grove | 24 | 1.3 | 28 (3) | 1.6 | 78% / 52% |
| **Farm** | **374** | **20.8** | | | |

Re-estimated for D336's 24 Inspiration unlocks a tier (was 18): six more Mushrooms dishes per Uma per tier, each
with a Grains side. The sim recomputes the whole table.

How to read it:
- **About 20 Umas farm at once** (25 × 80%), and 27 slots hold them from the first day.
- **The Kitchen is the game's bottleneck building.** At 2 slots it would cap the whole game at a third of the target.
  Six slots carry a 20-Uma roster (81% at peak); the 25-Uma roster needs Kitchen Lv 2.
- **The Vegetable Garden is the hot site.** Over a tier it carries 17% of all gathering against 11–12% for the
  others; in scenario 1, where 12 of the 32 unlocks are constellation nodes, it carries about 30%. Four slots carry
  a 20-Uma start (73%); Lv 2 carries 25.
- **Fields is no longer cold.** 08's side rotation sends 62 of a tier's sides to Grains, so it is as busy as a stat site.
- **Lv 1 fits a 20-Uma roster; Lv 2 everywhere fits 25** with every building at or under about 81% at peak, under
  the sim's 90% check. Growing the
  roster and upgrading the Kitchen and Pantry go together in tier 1's first weeks.
- Decks change site demand a little: a Speed-heavy deck adds about 3 Sweets dishes a tier. Lv 2's headroom covers it.

## 7. Building upgrades

Upgrades are the account's, and buildings carry through promotion (D327). Prices use the anchor **1 Prize Money ≈ 1
minute of Uma work** (D331), plus crafted items of the building's own family. The Pantry and Kitchen serve every
family, so they take one or two of each.

| Building | To Lv 2 (one more slot; two for the Kitchen) | To Lv 3 (speed ×1.25) |
|---|---|---|
| Each site | 1,200 PM + 4 crafted grade 1 of its family | 2,400 PM + 4 crafted grade 3 of its family |
| Pantry | 1,500 PM + 1 crafted grade 1 of each of the eight families | 6,000 PM + 1 crafted grade 3 of each family |
| Kitchen | 3,000 PM + 2 crafted grade 1 of each of the eight families | 12,000 PM + 2 crafted grade 3 of each family |
| **All ten** | **14,100 PM** | **37,200 PM** |

- **Lv 2 is buyable on day one** (grade-1 items), so the owner can keep up as the roster grows from 20 to 25.
- **Lv 3 opens once someone reaches Farm Lv 11** (grade 3, about day 4–6 of a tier). It pays back in six to ten days of the time
  it saves: ×1.25 saves a fifth of a building's work, which is ~21 Uma-hours a day at the Kitchen (~1,260 PM a day),
  ~10 at the Pantry, ~7 at the Vegetable Garden and ~5 at a stat site.
- **All twenty upgrades cost 51,300 PM**, about four weeks of the target's racing (~1,900 PM a day, [12](12-economy-and-pacing.md) §3),
  alongside the ~25,000 PM of Uma Tickets in the same weeks. Heavy racing makes it two.
- An upgrade bought while jobs run adds its slots at once; the speed applies to jobs started after it.
- Upgrades are a draft. The sim reports when each building reaches each level and pins "every building ≤ 90% average
  slot use" ([12](12-economy-and-pacing.md) §12).

**Pacing note.** With all ten buildings at Lv 3, Farm work takes 80% of its listed time and an unlock about 84% of the
Uma-time in [12](12-economy-and-pacing.md) §5, so a scenario would take about 23–25 days instead of 27–30. Buildings
carry, so that is the steady state for most of the game. The sim must run with building levels, and the four-week
target is best measured at Lv 3; [12](12-economy-and-pacing.md) §10's time factor is the lever if it runs fast.

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
ringed by her output's progress) and a **Ready** badge. Tapping one opens its peek, then its page.

### The building page

At 390 × 844, top to bottom:
1. **Header:** name, level, slots in use ("5 of 6"), speed, **Upgrade** (price and items, with stock), and (i) help.
2. **Needed now:** the planner's lines for this building ([02](02-check-ins-and-notifications.md)), lowest grade first:
   "Chopped Carrot × 12 for 3 Umas' constellation nodes · have 4 · coming 6". Tapping a line opens the job sheet with
   it filled in.
3. **Slot cards**, one per slot:
   - a running job: her face, name and Farm Level; the item's icon and grade; a ring for the current output; "3 / 10
     made"; the next output's and the job's end times; queue chips; buttons **Collect** (when outputs are waiting),
     **−30m**, **Finish**, **Recall** and **+ Queue**;
   - a free slot: **Start a job**.
4. **Collect here** and **Repeat here**, beside the global ones.

### The job sheet

1. **Uma.** Free Umas first, then by Farm Level, highest first. Each row shows her Farm Level, the highest grade she
   can work, her tier, and "in a session until 14:20" (greyed) when she's busy.
2. **What.** Items by grade. A grade above her level shows its lock ("Farm Lv 16") rather than hiding. Each item
   shows stock and a **Needed × N** badge from the planner. At the Kitchen, tabs follow the destinations: Speed ·
   Stamina · Power · Guts · Wit · Skill bonds · Constellation · Inspiration · Duos · Feasts · **Can cook now**. A dish
   row names its destination and the Umas whose open unlocks want it.
3. **How many.** 1–10, with chips for 1, 4, 10 and "until the next check-in" ([02](02-check-ins-and-notifications.md)).
   The sheet shows minutes per output, the clock time it ends ("ends 22:40"), Farm EXP, and every input against free
   stock ("Honey 8 of 9 · 1 short").
4. **Start** or **Add to queue**. A disabled button always says why.

### The Warehouse's Farm goods

The Warehouse is in Town Hall ([11](11-hub-and-places.md)). It is the one inventory, and it doesn't reset at promotion.
- **Shelves:** Raw · Crafted · Dishes · Tickets. Filters: the eight families (with their destination icons) and grades
  1–10.
- **A row:** icon, name, grade, count, then **reserved** (inside running jobs), **coming** (unfinished outputs) and
  **needed** (the planner's open needs).
- **A stock sheet:** family, grade and destination; the recipes that use it; **Make more** (opens the building's job
  sheet); **Sell × 1 / × 10 / surplus** at a third of its work value ([09](09-racing-rewards-and-exchange.md),
  [08](08-item-catalogue-and-recipes.md) §8). Surplus is stock beyond the planner's needs; reserved items can't be sold.

## 11. Edge cases

| Case | What happens |
|---|---|
| **Offline for a day** | Every output finishes on its timestamps and queues advance in order (§2). Nothing is collected until the owner opens the app |
| **Empty Warehouse** | Pantry and Kitchen jobs can't start: the sheet names the shortfall and links to the site. Repeat skips them; a queue reaching them drops |
| **A stale screen** | Start, queue and recall carry what the screen showed. If the stock or the slot changed (another device, a queue that started), the API refuses and the screen reloads with the new state; nothing is half applied |
| **A retried tap** | Every operation has an id; a retry returns the first receipt and is never applied twice |
| **An Uma in a session** | Not in the job sheet's free list; shown greyed with the session's end |
| **An Uma bought mid-tier** | Farm Lv 1, grade 1 only, any building; her scenario-1 dishes are grade 1 and 2 |
| **A promoted Uma** | Farm Lv 1 again in the new tier ([04](04-tiers-and-promotion.md)); the items she made stay in the Warehouse |
| **Upgrade mid-job** | New slots appear at once; running jobs keep their frozen speed |
| **Clock moved** | Forward: outputs finish early (trusted device). Backward: the wait grows; no output is taken back |
| **Two devices** | Both show the same jobs after one sync. Queue starts are recomputed in the same order on both |

## 12. What's saved

| Row ([13](13-removals-and-plan-changes.md) §6) | Farm fields |
|---|---|
| `buildings/{id}` | Level; each slot's current job id, or empty |
| `work/{outfitId}` | Her running job (building, slot, kind, item or recipe, count, listed minutes, speed, reserved inputs, `startedAt`, acceleration, outputs collected so far), her queue of up to three, her last job for Repeat, and a dropped queue with its reason until the owner acts on it ([02](02-check-ins-and-notifications.md)) |
| `umas/{outfitId}` | Farm EXP for her current tier, in quarter points; the level is derived |
| `items/{itemId}`, `itemLedger` | Stock and every movement: reserve, return, output, sale, upgrade cost |
| `operations` | One receipt per `assign`, `start`, `queue`, `collect`, `collect-all`, `repeat`, `recall`, `speed-up` and `upgrade` |

The server re-runs each operation with the domain package before committing it, as in [rearchitecture/05](../rearchitecture/05-farm.md) §6.

## 13. What this replaces

Today's Farm, the Stable Kitchen (M031, D304–D320; [design/farm-kitchen-rework.md](../design/farm-kitchen-rework.md),
[rearchitecture/05](../rearchitecture/05-farm.md)), concept by concept:

| Today | After the rework |
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
| Extra capacity 18 + 2 × (scenario − 1); active nodes per distance preset | Capacity 14–30 (README); presets in [05](05-training-hub.md) |
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
| **Slots: Kitchen 6/8, Pantry 3/4, Vegetable Garden 4/5, other sites 2/3; Lv 3 ×1.25** | Sized to the slot demand (§6): Lv 1 carries 20 Umas, Lv 2 carries 25 under 90% |
| **Upgrade prices** (§7): sites 1,200 / 2,400, Pantry 1,500 / 6,000, Kitchen 3,000 / 12,000 PM, plus items | Six to ten days' payback on the Uma-time saved; Lv 2 on day one, Lv 3 from grade 3 |
| **A slot is held by a job, not an Uma** | One passive thing at a time stays simple, and sessions never fight a standing Farm seat |
| **Repeat restarts each free Uma's last job** | Matches "Repeat to restart every job and session"; no hidden reservations |
| **A queue checks collected free stock, in time order** | Deterministic offline and across devices |
| **Speed Tickets act on the running job only; Finish = ⌈remaining ÷ 30⌉** | Today's Energy rule and uma-rpg's Finish, unchanged in spirit |
| **Sending a done Uma to a session collects her first** | Saves a tap on the most common move |
| **Promotion needs her free** (decided in [04](04-tiers-and-promotion.md) §5) | No job spans two tiers' Farm Levels, and no job runs at a grade her new Farm Level can't start |
| **No Farmhouse, cookbook or account recipe milestones** | Their jobs move to the planner, the job sheet and the Warehouse |

## 15. Done when

- The domain's Farm rules have tests for: per-output timers at every grade and speed; reserve, collect and recall
  arithmetic (finished outputs paid, unmade inputs returned); queue start and drop in time order; Speed Ticket and
  Finish; Farm EXP per listed minute × aptitude and the 480 + 5(*L*−1) curve; the grade gate on each step.
- A synthetic fresh account can assign, start, queue, speed up, recall, collect and upgrade through operations, and a
  second device shows the same jobs, stock and Farm Levels after one sync.
- Closing the app for 12 hours and reopening shows every output and queue start exactly where the timestamps put them.
- `pnpm sim:loop` reports every building's slot use per scenario; none averages above 90% with Lv 2 buildings and 25
  Umas, and the Kitchen at Lv 1 stays under 90% with 20.
- The sim's average Uma reaches Farm Lv 10*s* − 9 (grade 2*s*−1) within ±5 days of scenario *s*'s start.
- At 390 × 844 the building page shows all its slot cards (the Kitchen's eight scroll inside the page), every action is
  at least 44 pt, and every disabled button states its reason.
- No Farm code reads a Training Level, a token, Energy, a district or a station id.
