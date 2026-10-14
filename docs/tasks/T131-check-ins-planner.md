# T131 — Check-ins and the planner

**M033 · after T127 and T128, in parallel with T130 · not started.**

Read:
- [AGENTS.md](../../AGENTS.md), [M033](M033-rework-rules.md) (its fixed choices bind this task), and T127's and T128's
  merged modules.
- [rework/02](../rework/02-check-ins-and-notifications.md) (all), [01](../rework/01-game-loop.md) §2–§4,
  [07](../rework/07-farm.md) §2, §9, §11, [05](../rework/05-training-hub.md) §2,
  [08](../rework/08-item-catalogue-and-recipes.md) §4, §6, [12](../rework/12-economy-and-pacing.md) §12,
  [13](../rework/13-removals-and-plan-changes.md) §6; D328, D334, D336, D338.
- uma-rpg, read only, on `origin/main`: `save/targets.ts` (D100's cascade), `collectAll` in `save/work.ts`, and
  `save/notify.ts`, which judges work by the real collect rules. Reuse the shape, not the numbers.

## Goal and fixed scope

This task builds the rules a check-in of under a minute runs on, all pure, on top of T127's work engine and T128's
sessions. Each draft number becomes a named constant that cites its page.

1. **Collect all** (02 §2, 07 §9): one operation claims every finished item and unlock, with a line for each slot. One
   slot failing never blocks the others.
2. **Repeat** (02 §5, 07 §9, 05 §2): restarts each free Uma's last request at the same size or fitted, shrinks it to
   the stock, and skips with a reason and a fix.
3. **Batch sizing** (02 §3): marks the size that fits the next check-in. There are **1–4** check-in times, by default
   **08:00, 13:00, 22:30** (02 §1, §3; 12 §12; 13 §6).
4. **Queues at check-ins** (02 §3–§4): a warning before an entry would drop, and **Queue stopped** with Buy and
   restart, Start ×N, Make them and Dismiss.
5. **The check-in summary** (02 §4), with Speed up all and Best use.
6. **The planner** (02 §6): up to **5** targets, or the **five furthest behind** automatically. Needs cascade from
   unlock to dish to crafted to raw. Stock and incoming outputs are allocated once, in target order. It also gives
   lines per place, the Needs tab, roster totals and suggestions for free Umas.
7. **Offline, clock and retries** (02 §8–§9): a retry never pays twice, a stale screen re-checks, and words stay plain.

Push notifications (phase 4) are out of scope, with their tick, "what ended between" and the badge.

## Implementation contract

**Modules** live under `packages/domain/src/rework/`, each area with an `index.ts`. `check-in/` holds `schedule.ts`,
`collect-all.ts`, `repeat.ts`, `dropped.ts`, `summary.ts`, `once.ts` and `words.ts`. `planner/` holds `targets.ts`,
`project.ts`, `needs.ts` and `suggest.ts`.

**From other tasks:**
- **T127:** `settle`, `start`, `queue`, `collect`, `speed-up`, `workSeconds` and the building order.
- **T128:** `remainingUnlocks(build, at, chosen)` (oldest layer first, each with facility, room, grade and dish id, or
  "needs a card"), `nextUnlocks(build, at, facility, room, n, pending)`, and `layerDone(build, s)`.
- **T126:** the recipes. **T125:** the profile and career completion.
- **T130** runs in parallel, so prices come in as a parameter `price(itemId) → number | null`.

**Schedule.** `DEFAULT_CHECK_INS = [480, 780, 1350]` minutes after local midnight; `MAX_CHECK_INS = 4`.
- `nextCheckIn(now, times, utcOffsetMin)` is the first check-in strictly after `now`.
- `sizeChips(start, itemSeconds[], times, utcOffsetMin)` gives each size its end and the idle time to the first
  check-in at or after it ("then free until 22:30").
- The marked size is the largest ending by the next check-in; if even ×1 overruns it, the check-in after is used. It
  reads **Overnight** when that check-in is the day's earliest, else **Fits HH:MM**.
- `fitSize` is the marked size. Sessions pass one time per unlock.

**Collect all.** `collect-all { places?, shown? }` settles, then runs T127's `collect` on every row with a finished
item, in building, room and slot order. A line per slot gives what came in, Farm EXP, levels crossed and grades opened.
A `shown` slot with nothing ready reads "Already collected." A slot that fails keeps its reason without stopping the
rest. It never starts, buys, sells or spends tickets. `readyCount` counts Umas with something to collect.

**Repeat.** `repeat { outfitIds?, places? }` defaults to every Free Uma with a `last` request. Umas go in their last
slots' order, each seeing the stock left by the ones before, and each takes the lowest free slot at the same building
and room. It follows 02 §5's table:
- size: the same, or `fitSize` when the profile's `repeatSizing` is `fit`, shrunk to the stock ("×6 → ×3");
- gathering always starts;
- a session takes T128's next unlocks there while their dishes last;
- the grade stays, with a `switchTo` note when a higher one is open.

It skips an Uma, with a reason and a fix, when she has no `last` (recalled or promoted), isn't Free, has a dropped
queue, is short ("Short 4 Honey."), finds no free slot ("Kitchen full."), has finished that facility for her open
layers, or is at the Dojo ("Pick cards").

**Queues at check-ins.**
- `projectWork(state, now)` runs T127's settle on a copy to the end of every chain, with no collects. It reports each
  queued entry's start, or its drop and shortfall. `queueWarnings` are those drops ("Short 2 {item}."), and the planner
  uses the same projection.
- T131 adds two operation variants:
  - `start { outfitId, from: 'dropped', count? }` restarts the dropped entry at its size, or at Start ×N's `count`, and
    puts its queue back;
  - `queue { outfitId, dismiss }` clears it. Any other start for her also clears it.
- **Buy and restart** is T130's `buy` of the shortfall followed by that start, as two operations in order.
- **Make them** starts the missing input with the suggested free Uma, sized to the shortfall, up to 10.

**Summary.** `checkInSummary(state, { since, collect?, repeat? }, now, { utcOffsetMin, price })` returns 02 §4's
sections in order and drops the empty ones:
- **Collected:** totals, unlocks, level-ups, grades opened, and queues that moved on (`fromQueue` starts after `since`).
- **Free:** each Free Uma with her suggestion.
- **Queue stopped:** each dropped queue, with its fixes and the Buy and restart price.
- **Couldn't repeat**, **Training done** (T128) and **Ready to advance** (T125).
- **Next:** the next finish, and when everything is done.
- **Money:** Prize Money and Speed Tickets.

`since` comes from device storage (02 §10), clamped to `now`.

**Speed up all.** `speed-up { all, span: 60 | 120 | 'next-check-in' }` gives each running entry min(⌈span ÷ 30⌉,
`ticketsToFinish`) tickets through T127, in building order, in one receipt. It refuses whole if tickets run short.

**Best use.** `bestUse(plan)` marks the three running entries that cover the most target need. An unlock or dish counts
1, and a crafted or raw item ⅕ (08 §4).

**Targets.** `set-targets { outfitIds }` takes up to `MAX_TARGETS = 5` owned Umas, in order ("Five targets at most.").
An empty list means automatic. `automaticTargets` takes the `AUTO_TARGETS = 5` Umas with the most unlocks left in their
open layers, only those with some left, ties by `outfitId`.

**Plan.** `plan(state, targets, now, chosen)` works in three steps. `chosen` maps an outfitId to the cards the owner
has picked to bond next (02 §6); it is passed to T128's `remainingUnlocks`, and `suggest` takes it too:
1. **Needs.** For each target, oldest layer first, each unlock needs its dish. An unchosen bond counts in `pickCards`
   and isn't cascaded.
2. **Supply.** Free stock, less what projected queued entries will take; then outputs coming, in finish order: the
   unfinished and uncollected items, and the queued outputs. Entries projected to drop count neither way, and reserved
   inputs never count.
3. **Allocation**, done once, level by level: dishes, then crafted, then raw. Targets take turns in order, and stock is
   used before coming. A short dish needs its T126 recipe, and a short crafted item one raw.

A line is `{ item, grade, need, have, coming, comingFrom[{ outfitId, at, count }], short, gate }`, lowest grade first.
`gate` is `{ needsLevel, highestFree }` when no Free Uma's Farm Level opens the grade.

**Views:**
- `placeLines(plan, building)` and `facilityLines(plan, facility)`.
- `needsFor(state, outfitId, now)` plans for her alone, without touching targets. It gives layer progress by facility,
  an estimate in real time at today's building speeds, and her first three startable lines.
- `rosterTotals` plans for every Uma, in automatic order.

**Suggest.** `suggest(state, now, ctx)` takes Free Umas by Farm Level, highest first, ties by `outfitId`.
1. **Her own session**, if a dish for one of her open unlocks is in projected free stock. Her oldest such unlock picks
   the facility and room. She takes the next unlocks there while dishes last, up to `fitSize`.
2. **Otherwise, the largest shortfall** she can start for the first target she can work for: her grade is open, a slot
   is free and the inputs are in stock. Ties go to dish, then crafted, then raw, then lower grade, then item id. The
   size is `fitSize`, capped by stock.

Each suggestion takes its slot, inputs and outputs before the next Uma's. Nothing is written. Start suggestions runs one
T127 `start` per line, in order.

**Retries, stale screens, words and settings:**
- `runOnce(state, { id, name, input }, now)` returns the receipt stored at `state.operations[id]` and leaves the state
  unchanged. Otherwise it runs the operation and stores its receipt. Every rework operation goes through it. T131 adds
  `operations` (13 §6's log) to T125's `ReworkState`.
- A stale action is checked against the latest state. It then runs, shows the earlier result, or asks again with
  T127's new numbers.
- `BANNED_WORDS` is 02 §9's list.
- A clock moved back gives a later next check-in, never a negative wait.
- `set-check-in-times { times }` takes 1–4 distinct times ("Pick one to four times.").
- `set-repeat-sizing` takes `same` or `fit`.

## Decided here

| Choice | Why |
|---|---|
| Bond picks are an input: `plan` and `suggest` take `chosen` cards per Uma | 02 §6 cascades only chosen bonds, and 13 §6 saves no picks; phase 3 decides whether the Dojo sheet's picks persist |
| If ×1 already overruns the next check-in, fit the one after | 02 §3 is silent; marking ×1 idles her until the following visit anyway |
| Local time comes from a `utcOffsetMin` passed in, and the sim passes 0 | The rules stay pure; a DST night is off by an hour at most, once |
| There are 1–4 check-in times, never none | "Up to four" (02 §3), and fitting needs at least one |
| **Overnight** marks the day's earliest check-in | 02 §3: "after the last check-in of the day it marks the one for the morning" |
| Repeat with no ids takes every Free Uma with a `last`, in slot order, at the lowest free slot | 02 §5 says "collected in this check-in", 07 §9 says "each free Uma", and the screen passes the ids it collected |
| Repeat skips an Uma with a dropped queue | Queue stopped's fixes put back what she was meant to do next |
| A repeated session takes the next unlocks in order and stops at the first missing dish | An unlock may depend on the one before (05 §2) |
| A dropped queue clears on restart, on Dismiss, or on any new start for her | 02 §10 keeps it "until the owner restarts or dismisses it", and a new start is acting on it |
| Make them is sized to the shortfall, 10 at most | 02 §4's example is "Garden ×2" for 2 short |
| Speed up all: "to the next check-in" is the time until it, each entry is clamped to Finish, and short tickets refuse it all | One confirmation shows one count (02 §4), with nothing half applied |
| Best use counts a dish or unlock as 1 and a crafted or raw item as ⅕, and marks three | A dish takes five crafted items (08 §4) |
| Automatic targets need unlocks left; ties go by `outfitId` | It's deterministic and matches "furthest behind" (12 §12) |
| Suggestions go by Farm Level, highest first; "scarcest" is the largest shortfall that can start now; size is capped by stock, not need | 01 §4 gives higher grades to higher levels, and idle time costs more than surplus |
| Projected drops count neither as takes nor as coming | The planner and the warnings agree with settle |
| Clock times are cut to the minute, so 02 §3's "12:53" renders as 12:52 | The same table already shows 22:22:30 and 07:52:30 as 22:22 and 07:52 |
| New operation inputs: `start` from dropped, `queue` dismiss, `speed-up` all, `set-targets`, `set-check-in-times`, `set-repeat-sizing` | 02 §10 saves and syncs these, but 13 §6's list lacks them |
| The Needs estimate uses today's speeds, and its "three jobs" are her first three startable lines | 02 §6 names both without a rule |
| Prices come in as a parameter | T130 runs in parallel |

## Tests

**Pinning:** `DEFAULT_CHECK_INS`, `MAX_CHECK_INS` 4, `MAX_TARGETS` 5, `AUTO_TARGETS` 5, `BANNED_WORDS`.

**Behaviour:**
- **Fit:** 02 §3's gap table cell by cell from base-minute items; a ×2 session at 08:00 reads "ends 14:00 · then free
  until 22:30"; Overnight; ×1 overrunning the next check-in; UTC offsets on both sides.
- **Collect all** (02 §12), on a synthetic 25-Uma account: one operation claims everything; the same id returns the
  same receipt and pays nothing twice; a second device's later Collect all reads "Already collected"; a failing slot
  doesn't block the others; nothing is started, sold or spent.
- **Queues** (02 §12): a three-entry queue started at 22:30 runs overnight with no operations; starts don't depend on
  collect order; a 06:00 drop shows under Queue stopped at 08:00, and a synthetic stock grant (standing in for T130's
  buy) plus a restart puts the whole queue back; the warning shows before the start; stock collected at 08:00 doesn't
  count backwards.
- **Repeat:** every row of 02 §5's table; same or fit; Collect all then Repeat all always finds slots; competing Umas
  go in slot order.
- **Planner:** lines equal a brute-force recount (layer, dish, crafted, raw, less stock and coming); nothing is
  allocated twice across five targets, and target order holds; uncollected outputs count as coming, while reserved
  inputs and projected drops don't; pick cards and gate lines; an empty Warehouse suggests gathering; marking one
  target ends automatic.
- **Suggestions:** her own session first, then Farm Level order; no slot or input promised twice; sizes fitted and
  capped.
- **Summary:** every section from synthetic states, empty ones dropped, the `since` clamp, next and all-done times.
- **Speed up all:** ticket counts, the Finish clamp, and the refusal when short.
- **Clock and stale screens:** forward makes work Ready and Collect all accepts it; back makes waits grow, never
  negative; every 02 §9 case ends in a result or a one-sentence question.
- **Words and purity:** no banned word in T131's templates or in any exported refusal table (T125's `TIER_REFUSALS`,
  T127's `WORK_REFUSALS`, T128's `TRAINING_REFUSALS`, T130's); no `Date.now`, `Math.random`, I/O or browser globals.

## Live blocks

`check-in-fits` goes in rework/02 §3: the gap table, rendered from `sizeChips` with base-minute items as the page
states it. The craft row chains queued entries while the previous one is ×10.

## Acceptance

- [ ] `@racer/domain/rework/check-in` and `/rework/planner` export this contract; `git grep "rework/" apps` finds nothing.
- [ ] Every number is a cited constant with a pinning test, every test above passes, and `pnpm lint && pnpm test &&
  pnpm build` are green.
- [ ] The live block is in place, and `pnpm docs:update` leaves no diff.
- [ ] T132's check-in and idle-Uma policies need only `collect-all`, `repeat`, `fitSize` and `suggest`.
- [ ] The Decided here rows go into rework/02 §11 with one decisions.md entry, and this spec is deleted (D104).

## Out of scope

Push notifications, their tick, quiet hours and badge (phase 4). The Exchange and prices (T130). Session content
(T128), and timers and job rules (T127). Screens, device storage, saves and sync (phase 3). The sim (T132). The
owner's one-minute iPhone check (02 §12).
