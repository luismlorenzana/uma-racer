# T127 — Jobs, sessions and the Farm

**M033 · after T125 and T126, in parallel with T128 and T129 · not started.**

Read:
- [AGENTS.md](../../AGENTS.md) and [M033](M033-rework-rules.md). Its fixed choices bind this task.
- [rework/07](../rework/07-farm.md) (all), [01](../rework/01-game-loop.md) §2, [05](../rework/05-training-hub.md) §2
  and §7, [09](../rework/09-racing-rewards-and-exchange.md) §5.1, [12](../rework/12-economy-and-pacing.md) §4, §6, §7,
  [13](../rework/13-removals-and-plan-changes.md) §6, and the [README](../rework/README.md)'s shared numbers.
- D328, D330, D331, D336 (Farm EXP and Farm Level), D338 (`TIME_FACTOR` 1.2).
- The T125, T126 and T128 specs: T127 imports `rework/time.ts`, `rework/types.ts` and `rework/items`, and T128 plugs
  its session kind into this engine.
- uma-rpg, read only, on its `origin/main`: `economy/jobs.ts`, `save/work.ts`, `economy/pacing.ts`. Reuse the shape;
  don't reuse its numbers, its lazy per-slot queue starts or its thrown errors.

## Goal and fixed scope

One engine runs every timed thing an Uma does: a Farm job or a Training Hub session, 1–10 items one after another.
The Farm's buildings, Farm Level and the activity rule sit on top. Everything is pure and tested, and the live game
doesn't use it. Every number is a draft, held as a named constant that cites its page.

1. **The work engine** (07 §2, §5, §8, §12; 05 §2; 09 §5.1; 13 §6) gives per-item timers, collect (also part-way),
   recall, queues of up to **3**, and queue starts in time order across the roster. A Speed Ticket takes **30 minutes**
   off the whole remaining schedule, and Finish costs ⌈remaining ÷ 30 min⌉ tickets.
2. **Farm jobs** (07 §1–§2): gather at the eight family sites (T127 owns the family → site map), craft at the Pantry
   (raw into crafted of the same family and grade), cook at the Kitchen. Step times are T126's base minutes (gather
   90 + 5(*g*−1), craft a quarter, cook 240 + 10(*g*−1)); T127 applies the building's speed.
3. **Buildings** (07 §1, §6–§7; 05 §1, §7): ten Farm buildings and four facilities at Lv 1–3, speed 1, 1, 1.25.
   - **Slots at Lv 1/2/3:** Kitchen 6/8/8, Pantry 3/4/4, Vegetable Garden 4/5/5, other sites 2/3/3, Observatory and
     Lineage Hall 2/3/3, Gym 5 rooms × 1/2/2, Dojo 6 rooms × 1/2/2.
   - **Upgrades to Lv 2/3, in PM** plus each table's crafted items: sites 1,200/2,400, Pantry 1,500/6,000, Kitchen
     3,000/12,000, Observatory 1,200/2,400, Lineage Hall 1,000/1,500, Gym 2,400/4,800, Dojo 1,500/2,000.
4. **Farm EXP and Farm Level** (07 §3–§4, D336). EXP is 1 per listed minute × her aptitude for the family (07 §3's
   map: S 1.8, A 1.6, B 1.2, C 1, D 0.9, E–G 0.8), kept in quarter points and paid at collection. Level *L* → *L*+1
   costs 480 + 5(*L*−1), Lv 1–50 per tier, and EXP stops at Lv 50 (29,400). T127 applies T126's grade gate (Lv
   5*g* − 4) to every step, a dish by its own grade.
5. **The activity rule** (01 §2, 07 §5, D328): Free, Working or Ready, and she races in all three. Starting work for a
   Ready Uma collects her first. A Working Uma is refused with her free time. A queue never leaves its slot.

Session content is T128's: the unlocks, their dishes, their order and the 180 + 15(*g*−1) minutes. T127 runs a
session's timing, dishes, collect, recall, queue and tickets.

## Implementation contract

**Modules** live under `packages/domain/src/rework/`, with an `index.ts` per area behind T125's `./rework/*` export.
- **`work/timeline.ts`** is numbers only, so phase 7 can move it to `uma-idle` (02 §8).
  - `itemEnds(startedAt, seconds[], acceleratedMs)`, `finishedCount`, `endsAt`, `remainingMs`, `progress` (0–1) and
    `chainTimes(row)`.
  - `SPEED_TICKET_MS = 1_800_000` and `ticketsToFinish(ms) = ⌈ms ÷ SPEED_TICKET_MS⌉`.
  - `applyTickets → { acceleratedMs, appliedMs, wastedMs }`, where applied = min(tickets × 30 min, remaining).
- **`work/types.ts`**: `SlotRef { building, room?, slot }`; `WorkRequest` (a gather, craft or cook item and count, or
  T128's session unlock refs); `Entry` (request, per-item seconds, inputs and outputs, `startedAt`, `acceleratedMs`,
  `collected`, `speed`, `fromQueue`); `WorkRow { outfitId, slot, entries, queue, last, dropped }` as `work[outfitId]`.
- **`work/kinds.ts`**: `WorkKindRules { plan(state, outfitId, request, now) → items | Refusal; pay(state, outfitId,
  outputs) }`. T127 registers gather, craft and cook; T128's `session` is registered by whichever lands second, and
  T127 tests with a synthetic one. `plan` counts her earlier entries as made, so a queued session continues in order.
- **`work/settle.ts`, `work/operations.ts`, `work/activity.ts`.** Activity exports `workState`, `freeAt`, `isFree` and
  `collectBeforeRace`.
- **`farm/`:** `jobs.ts` (the three Farm kinds and `FAMILY_SITE`), `buildings.ts` (ids, order, rooms, slots, speeds,
  costs) and `level.ts` (`FAMILY_APTITUDE`, `farmExpToNext`, `farmLevel`, `farmExpMultiplier`). Step times, the grade
  gate (`canWorkGrade`, `highestOpenGrade`) and recipes are imported from T126's `rework/items`, never copied.

**Durations and EXP.** An item lasts T125's `workSeconds(base, speed)` = round(round(base minutes × `TIME_FACTOR` ×
60) ÷ speed), with T126's base minutes: at grade 1, gather 6,480 s (5,184 at Lv 3), craft 1,620 s, cook 17,280 s.
Farm EXP per item is round(`workSeconds(base, 1)` × aptitude in tenths ÷ 150) quarter points, fixed at the start,
using the site's, the crafted item's or the dish's family (a Duo or Feast: the best of its main families). It lands
in T125's `umas[id].farm`: `exp` in quarter points, `level` kept equal to `farmLevel(exp)`.

**Operations** have the form `(state, input, now) → { state, receipt } | Refusal`. Each settles to `now` before and
after it runs, so a Finish starts the next queued entry at once.
- **`start { outfitId, slot, request }`** reserves every item's inputs. It checks, in order: the slot exists and is
  free; she's Free, or Ready (then she's collected in the same receipt); the count is 1–10; this building makes it;
  her Farm Level opens the grade; free stock covers it.
- **`queue { outfitId, add | remove | move }`** edits up to 3 entries behind the running one, at the same building and
  room. Adding checks the place and the grade gate. Nothing is reserved.
- **`collect { outfitId }`** pays every finished item, oldest first: Farm items go to the Warehouse with EXP and levels
  crossed, and sessions pay through T128. Once all is paid, the slot and Uma are freed and `last` is set. It never
  refuses; with nothing ready the receipt is empty (02 §9).
- **`recall { outfitId }`** collects, then ends the running entry. It returns the inputs of every unmade item, the one
  in progress included, drops the queue without a dropped record, and clears `last`. With nothing running it acts
  as `collect`.
- **`speed-up { outfitId, startedAt, tickets }`** and **`finish { outfitId, startedAt }`** (13 §6) work on the running
  entry named by `startedAt` (09 §9). They spend 1 to `ticketsToFinish` `speed-ticket` items, and Finish spends them
  all. The receipt gives minutes saved, minutes wasted and the new end.
- **`upgrade { building }`** charges Prize Money and items once, up to Lv 3. New slots apply at once, and the new speed
  only to later starts.

Receipts list every item movement (reserve, return, output, cost, ticket), so phase 3 can write `itemLedger` from them.

**Settle.** `settle(state, now)` loops until nothing is due. It takes the earliest row whose last entry ended by `now`
with a queue waiting, ordered by end time, then building, room and slot. It plans that queued request at that moment's
speed. If free stock covers it, it reserves the inputs and starts the entry at that end time (`fromQueue`). If not,
the rest of the queue becomes `dropped { at, requests, short }`. Settle is idempotent.

Order is 07 §1's ten buildings, then Observatory, Lineage Hall, Gym and Dojo. Rooms follow 05 §1: the Gym's Stamina,
Wit, Power, Speed and Guts; the Dojo's Speed, Stamina, Power, Guts, Wit and Friend & Group.

**Refusals** use T125's `Refusal`: a code, a plain-words reason, and data such as `freeAt`, `short` and
`largestCoverable`. With that data the screen can ask "Only 3 left now. Start ×3?" and fill the placeholders. One
exported table, `WORK_REFUSALS`, holds every reason, and T131's banned-word test reads it:

| Code | Reason | Code | Reason |
|---|---|---|---|
| `slot-taken` | That slot is taken. | `short` | Short {n} {item}. |
| `busy` | {uma} is busy until {time}. | `queue-full` | Three are already queued. |
| `count` | Make 1 to 10 at a time. | `queue-place` | A queue stays at one place. |
| `not-here` | That isn't made here. | `finished` | It's already finished. |
| `grade` | Needs Farm Lv {level}. | `tickets` | Needs {n} Speed Tickets. |
| `top-level` | Already at the top level. | `prize-money` | Needs {n} Prize Money. |

**Clock and determinism.** Only timestamps are stored, and only the given `now` is read. A clock moved forward
finishes work early, and one moved back lengthens the wait. `collected` never falls, a settled start is never undone,
and progress never goes below zero. The same state, input and `now` give the same result, after a JSON round trip too.

## Decided here

| Choice | Why |
|---|---|
| **Farm EXP is per real listed minute:** base × `TIME_FACTOR`, before building speed | It's the only reading that keeps 07 §4's "8 hours of work at Lv 1", 07 §3's levels a day, 12 §6's day table and 08 §5's "× *k*" true at *k* = 1.2. 07 §2's "285 Farm EXP" is a base-minute example |
| Quarter points are rounded once per item, then multiplied by the items collected | ×0.9 and ×1.8 aren't exact in quarter points, and split collects must pay the same as one |
| Ticket time is kept in integer ms and clamped to the time remaining | Finish then ends exactly at `now`, so nothing starts in the past |
| A queued entry takes its speed and inputs when it starts, and its grade gate when it's added | 05 §7 applies speed to work "started after it", and Farm Level never drops within a tier |
| Ties go by 07 §1's order, then the facilities, rooms and slot | 07 §2 orders only the Farm buildings, but sessions queue too |
| A Duo or Feast uses its **main** families, not its side | A planet dish's family excludes its side (07 §3, 08 §4) |
| There is no `assign` operation: work rows hold slots, and building rows hold levels | 07 §5 has no standing assignment, so the `assign` in 07 §12 and 13 §6 is left over |
| Collect never refuses, and Recall with nothing running acts as Collect | 02 §9: an action already done shows its result |
| An upgrade's only gate is its cost | Its grade-3 items are 07 §7's "from Farm Lv 11" |

## Tests

**Pinning** (T126 pins the base minutes and the gate itself):
- job seconds at grades 1 and 10 at speeds 1 and 1.25, the six multipliers, and the family → site and → aptitude maps;
- 480 and 720 EXP a level at Lv 1 and 49, the EXP at each gate level (2,450 … 26,550), and 29,400 at Lv 50;
- slots for all 14 buildings (Farm totals 27 and 38) and upgrade totals: Farm 14,100, 37,200 and 51,300 PM;
  facilities 6,100, 10,700 and 16,800;
- 30-minute tickets, 10 items, 3 queued, and the ten Farm ids against uma-art's buildings index.

**Worked examples:**
- 07 §2 in base seconds (5,700 s a Potato, aptitude C) through `timeline.ts` and the EXP formula: 3 Potatoes and 285
  EXP at 13:00; the end at 23:20 after a ticket; Carrots 23:20–08:20; a 22:30 recall pays 9 and loses 45 minutes.
  The same run then goes through the operations at *k* = 1.2.
- The Kitchen recall pays 1 salad and returns 8 Chopped Carrot and 2 Wheat Flour.
- 05 §2's night at the Observatory, with a synthetic session kind.
- 09 §5.1's dishes at 16:10 and 20:30, and Finish = 18.

**Behaviour:**
- **Tickets.** With 10 minutes left, the item finishes and 20 come off the next. The waste shows under 30 minutes. A
  ticket is refused on a queued, finished or empty entry, or a wrong `startedAt`. EXP is the same with tickets or at
  Lv 3.
- **Collect and recall.** A partial collect and then a full one pay each item once. Recall returns the in-progress
  item's inputs.
- **Queues.** An entry starts at the exact end time, and uncollected outputs don't cover it. A drop takes the rest of
  the queue. Ties follow building order. Collect order doesn't change the result. A 12-hour offline replay matches the
  timestamps.
- **Activity rule.** Every row of 01 §2's table holds. `collectBeforeRace` takes only finished session unlocks.
  Advancing (T125) leaves rows alone. Promotion's check uses `isFree` instead of any stand-in.
- **Farm Level.** One collect can cross several levels, up to the cap at 50. The grade gate applies on every step, by
  a dish's own grade. Mid-tier and promoted Umas start at Lv 1.
- **07 §11.** An empty Warehouse; a stale start, refused `short` with `largestCoverable`; an Uma in a session; an
  upgrade mid-job; the clock moved either way; two devices.
- **Purity.** No `Date.now`, `Math.random`, I/O or browser globals in `rework/work` or `rework/farm`.

## Live blocks

Rendered by `packages/domain/src/docs/render.ts`:
- in rework/07: `farm-job-times` (§2's per-output table from T126's step times, in base minutes as the page states),
  `farm-aptitudes` and
  `farm-exp-multipliers` (§3, with levels a day at Lv 1 and 49), `farm-level-grades` (§4's grade, Farm Lv and EXP
  columns; T132 renders the day columns), `farm-slots` (§6) and `farm-upgrades` (§7);
- in rework/05: `facility-slots-upgrades` (§7's table). §2's session minutes are T128's.

## Acceptance

- [ ] `@racer/domain/rework/work` and `/rework/farm` export this contract, and `git grep "rework/" apps` finds nothing.
- [ ] Every number is a cited constant with a pinning test.
- [ ] `pnpm lint && pnpm test && pnpm build` are green, and existing sims are unchanged.
- [ ] The seven blocks are in place, and `pnpm docs:update` leaves no diff.
- [ ] The Decided here rows go into rework/07 §14 with one decisions.md entry, and this spec is deleted (D104).

## Out of scope

Session content (T128). Collect all, Repeat, batch sizing, the planner, the summary and retries by operation id
(T131). Prices (T130). The catalogue, recipes, step times and grade gate (T126). Promote and advance (T125). Saves,
sync, screens and push.
