# T142 — Check-ins on screen

**M034 · after T136 and T137, in parallel with T138–T141 · not started.**

Read:
- [AGENTS.md](../../AGENTS.md) and [M034](M034-generation-2-cutover.md), whose fixed choices bind this task. T137's
  shell, game port, slots and seeds; T136's store (`run`, `receipts`, `sync`). From the place tasks beside it: T138's
  profile (its `/needs` route and header slot) and Exchange rows, T139's session-sheet query, and T140's job-sheet
  query and `g2/ui/work/` pieces.
- [rework/02](../rework/02-check-ins-and-notifications.md) (all); [11](../rework/11-hub-and-places.md) §2.3, §9.1;
  [01](../rework/01-game-loop.md) §2–§4; [05](../rework/05-training-hub.md) §2; [07](../rework/07-farm.md) §2, §9;
  [09](../rework/09-racing-rewards-and-exchange.md) §5; [13](../rework/13-removals-and-plan-changes.md) §6; D320, D334,
  D336.
- [The rework modules](../game/architecture.md#the-rework-modules): `check-in` (`collectAll`, `repeat`, `repeatable`,
  `checkInSummary`, `sizeChips`, `chipWords`, `fitWords`, `clockTime`, `nextCheckIn`, `queueStopped`, `makeThem`,
  `buyFor`, `speedUpAllPlan`, `recheck`, `CHECK_IN_WORDS`, `hasBannedWord`), `planner` (`targetsOf`, `plan`, `bestUse`,
  `needsFor`, `rosterTotals`, `projectWork`, `queueWarnings`), `work` (`freeAt`, `WORK_REFUSALS`), `training`
  (`unlockLabel`) and `exchange` (`buy`), with every refusal table.
- uma-rpg `origin/main`, read only: `collectAll` in `save/work.ts` and its summary, and the targets view (its D100).

## Goal and fixed scope

Rework/02's check-in on T137's shell. Every rule is T131's, and every write goes through T136's store:
1. **Collect all** from the floating pill (§2), opening the summary.
2. **The check-in summary** (§4): Collected; Free with **Start suggestions**; Queue stopped; Couldn't repeat; Training
   done; Ready to advance; Next; Money; **Repeat all (N)** with its Same/Fit toggle; **Speed up all** and **Best use**.
3. **Repeat** (§5) from the summary, for all or for one Uma.
4. **Batch-size chips** with "Fits HH:MM" and "Overnight" (§3), as the shared piece every start and queue sheet shows.
5. **Queues:** finish times and warning marks on queued entries; stopped-queue cards with Restart, Start ×N, Buy and
   restart, Make them and Dismiss (§3–§4).
6. **The planner's own views** (§6): targets, her Needs tab and the roster view.
7. **Offline, the clock, retries, stale screens and plain words** (§8–§9).

The pill's counts come from T137's hub view; this task owns what its taps do, and their rework/02 checks. Each place's
Collect here, Repeat here, For your targets and Needs here are T139's and T140's, and check-in times are T138's
Account.

## Implementation contract

**Where.** `apps/web/src/g2/places/check-in/` and `g2/places/needs/`, registered in T137's slots: `SHEET_UI['check-in']`
and the Stable's sub-pages `needs` and `outfit/:umaId/needs`. The shared pieces go in `g2/ui/work/`, beside T140's. A
dev proof at `/dev/check-in` in g2's router (DEV only, §7.2's rule for new proofs) shows them on T137's seeds. This
task adds a `stopped` seed (a `busy` account with stock drained so queues dropped) and `?at=HH:MM` to move a seed's
clock.

**Part 1 lands first:** the pieces T139's and T140's sheets and cards embed.
- `SizeChips { start, itemSeconds, max, value, onChange }`: one chip per size, 1 to `max` (what the stock covers, 10
  at most), each in `chipWords`' words ("ends 14:00 · then free until 22:30"). The marked chip carries `fitWords`
  ("Fits 13:00" or "Overnight") and is preselected; nothing is confirmed for the owner. `start` is now for a start,
  and `freeAt` for an entry added to a queue.
- `QueueTimes` and `QueueWarning`: a queued entry's projected finish from `projectWork` ("then Vegetables ×4 →
  17:30"), and `queueWarnings`' mark ("Short 2 raw Vegetables G2."), for T140's `QueueChips`.
- `StoppedQueueCard` (below), and `useOperation()`, which runs a tap and renders its answer (below).

Part 2 is the summary, Speed up, the Needs views and targets.

**Reading.** Every view is derived on read from T136's store, memoised on the state and T137's 30-second clock. The
planner context is the store's `env`, the device's `utcOffsetMin` at `now`, `chosen = {}` (Decided here), and the
profile's targets through `targetsOf`. Screens fill T131's templates: `{uma}` with her template's name, `{item}` the
item's name, `{place}` the building's, and `{time}` through `clockTime`.

**Writing.** Every tap is the store's `run(name, input, busyKey)`, with an id chosen before it's written, and shows
T131's `recheck` answer:
- `done`: the result;
- `ask`: one sentence with the new numbers ("Only 3 left now. Start ×3?") and a yes that runs the answer's input;
- `say`: the rule in plain words beside the button ("Kitasan Black is busy until 18:30.").

A pending button is disabled and its `busyKey` held, so a second tap does nothing. Nothing ever says to reload, review
or retry; the unexpected reads "That didn't work. Try again." while the outbox retries. Spending (Buy and restart, a
fix's Buy, Speed up all) confirms once with the amount (§1 counts two taps); everything else is one tap.

**Collect all.** The pill's Collect all reaches the sheet with `{ collect: true }` in navigation state (T137). The
sheet runs `collect-all { shown: hub.readySlots }` once, then replaces that history entry's state with the operation's
id, so a reload shows the same receipt. The pill's Check-in opens the sheet without collecting.

**The summary sheet** (§4): a modal bottom sheet, read top to bottom, with the primary action in the thumb zone.
- **Header:** "Check-in · since 08:02 (5 h ago)". `since` is the device key `uma-racer:g2:check-in:shown-at`, written
  when the sheet closes; collapsed sections are `uma-racer:g2:check-in:collapsed`. Both are read in try/catch.
- **Sections** come from `checkInSummary(state, { since, collect, repeat }, now, context)`, in its order, without the
  empty ones. `collect` and `repeat` are the store's `receipts[id]` for this sheet's operations, the server's when it
  has answered, else the local one. So when the other device collected first, the lines change in place to "Already
  collected." (§9).
- **Collected:** "41 items · 6 dishes · 5 unlocks", the notes (`unlockLabel`, "Farm Lv 5 → 6 · grade 2 open"), and "3
  queues moved on". A line opens her profile or the place.
- **Free:** each Uma with her suggestion ("Gather Fruits G2 ×3 → 17:30"), and **Repeat** beside it when she has a last
  job (`repeat { outfitIds: [id], utcOffsetMin }`). **Start suggestions (N)** runs one `start` per line, in order, each
  its own operation; a line the state no longer allows shows its words. A tap on a line opens its sheet preselected
  (the links below).
- **Queue stopped:** a `StoppedQueueCard` per `queueStopped`, "Pantry ×10 at 06:00: short 2 raw Vegetables G2", with:
  - **Restart** when the stock covers it: `start { outfitId, from: 'dropped' }`;
  - **Buy 2 and restart · 190**: one `buy` per short item at `buyFor`'s prices, then that restart;
  - **Start ×8**: `start { outfitId, from: 'dropped', count }`;
  - **Make them: Garden ×2**: the `start` of `makeThem`'s suggestion;
  - **Dismiss**: `queue { outfitId, dismiss: true }`.
- **Couldn't repeat:** each skip's words and its fixes. `buy` buys, then repeats her; `make` starts `makeThem`'s
  suggestion; `pick-another` opens her place; `pick-cards` opens her Dojo sheet in that room; `queue-stopped` points
  at her card above; `suggestion` starts it.
- **Repeat's notes:** "×6 → ×3", and "grade 2 open" with **Switch**: `recall`, then a `start` of `switchTo`'s item at
  the same place and size, through `recheck`.
- **Training done:** **Race** → `/racing/racecourse?uma=:umaId`. **Ready to advance:** **Advance** →
  `/racing/scenario-gate/:umaId`.
- **Next:** "Next: 14:10 Kitchen ×1 · all done by 22:05". **Money:** "Prize Money 1,240 · Speed Tickets 18" with
  **Speed up**.
- **Footer:** **Repeat all (N)**, N being `repeatAll` and hidden at 0, runs `repeat { utcOffsetMin }`. Beside it is the
  Same/Fit toggle (`set-repeat-sizing`). Offline, one line reads "Saved on this phone. It'll sync when you're back
  online."

**Speed up** (§4): a sheet offering 1 h, 2 h and "to 13:00" (the next check-in), each with its ticket count from
`speedUpAllPlan`. One confirmation names the count and runs `speed-up { all: true, span, utcOffsetMin }`; short tickets
read "Needs 12 Speed Tickets." with a link to `/town/exchange?row=speed-tickets`. Below, **Best use** lists `bestUse`
of today's plan: up to three running entries, each with −30m (`speed-up`, one ticket) and Finish (`finish`, its count
on the button).

**The planner** (§6):
- **Her Needs tab**, the content of T138's `/needs` route (`needsFor`): layer progress ("Observatory 8/12 · Lineage
  Hall 1/2 · Gym 4/10 · Dojo 3/6"); the cascade, dishes then crafted then raw short, each in §6's line words; "about
  120 Uma-hours of work"; her three startable lines with **Start**; and "3 bonds: pick cards", linking to her Dojo
  sheet. A line's `gate` reads in its words, with **Buy at the Exchange · price** linking to T138's
  `/town/exchange?family=&grade=` when `buyFor` can sell it.
- **The target toggle**, in T138's profile header slot and on the Needs tab: **Mark as target** or **Remove target**
  (`set-targets`, "Five targets at most." past five).
- **Roster view** (`/town/stable/needs`): the targets in order, with up, down and remove, or "Automatic: the five
  furthest behind" when none are marked. Then `rosterTotals`: unlocks left per Uma, and dishes short by family and
  grade.

**Links, as T139–T141 define them:** a job opens `/farm/:building?job=:itemId&uma=:umaId&count=:n&back=<path>`
(T140); a session `/training/:facility?session=:umaId&room=:room&unlocks=…&back=<path>` (T139), and her Dojo sheet
the same with only the room; `/racing/racecourse?uma=` and `/racing/scenario-gate/:umaId` as §7.1 says (T141).

## Tests

All on T137's in-memory port and synthetic seeds, with Testing Library.
- **Summary:** each §4 section from synthetic states, in order, with empty ones absent; the header's `since`; the
  totals line; a check-in with nothing to fix shows only Collected and Repeat all.
- **Collect all** (§12): one operation claims everything; a retried id shows the same receipt; a shown slot the other
  device collected reads "Already collected."; a failing slot doesn't block the rest; a reload doesn't collect again;
  a server receipt replaces the local lines.
- **Repeat:** Repeat all's count equals `repeatable`; a line's Repeat takes her alone; Same/Fit persists through
  `set-repeat-sizing`; the shrink and Switch notes; every skip's fixes issue the right operations, in order.
- **Start suggestions:** one `start` per line, in order; a refused line shows its words while the others start.
- **Queue stopped:** each button issues its operations; Buy and restart puts the whole queue back (§12).
- **Size chips:** §3's `check-in-fits` table, cell by cell, renders as chips from base-minute items; Overnight; ×1
  overrunning the next check-in; the preselect; no auto-confirm.
- **Queues:** a warning shows before the entry would start; queued finish times match `projectWork`.
- **Planner:** the Needs tab and roster view show the domain's lines; targets up to five, with the refusal past five.
- **Speed up all:** each span's count, one confirmation, the short-ticket refusal, and Best use's three entries.
- **Stale screens and words:** each §9 case ends in a result or one sentence; a double tap runs one operation; the
  offline line shows; no string, and no filled template, holds a banned word.
- **Clock:** moved forward, the pill reads Collect all and the sheet collects; moved back, no time or progress goes
  negative.

## Acceptance

- [ ] Part 1 is merged before T139's and T140's sheets embed it.
- [ ] `pnpm lint && pnpm test && pnpm build` are green, and the g2 measure build stays ≤ 180 KB gzip.
- [ ] In the `uma-racer-dev` preview at 390×844 (mobile preset):
  - [ ] on `/dev/g2/?seed=busy`, the pill's **Collect all · N ready**, **Repeat all**, **Start suggestions** and close
    take three taps; afterwards every pip is busy, or the Uma is Free with a reason in the summary;
  - [ ] on `?seed=stopped`, Queue stopped shows **Buy and restart** with its price; it confirms once, and her queue
    comes back whole;
  - [ ] Speed up shows three counts and up to three Best use entries;
  - [ ] an Uma's Needs tab, the roster view and marking a target all work;
  - [ ] `/dev/g2/dev/check-in?at=09:00` shows "Fits 13:00", and `?at=23:00` shows "Overnight";
  - [ ] with offline emulated, the summary shows the offline line and its taps still apply; the console shows no
    errors.
- [ ] The pill's counts match rework/02 §2 and §4 on every seed.
- [ ] The Decided here rows go into rework/02 §11 with one decisions.md entry, and this spec is deleted (D104).

## Out of scope

- Push notifications, their tick, quiet hours and the app badge (phase 4).
- Each place's Collect here, Repeat here, For your targets and Needs here, its job and session sheets, queue editing,
  −30m and Finish on cards, Recall and upgrades (T139, T140); check-in times, the Exchange and the profile (T138);
  race select (T141).
- The store, outbox and sync (T136); the server's re-run (T135); the owner's one-minute check on the iPhone (T144,
  rework/02 §12).

## Decided here

| Choice | Why |
|---|---|
| Bond picks aren't saved in phase 3: the planner runs with `chosen = {}`, so an unchosen bond reads "N bonds: pick cards" and links to her Dojo sheet | T131 left it to phase 3; 13 §6 saves no picks; a device-only list would plan differently per device; cards are chosen at the Dojo anyway |
| Start suggestions is one `start` per line, each its own operation | 13 §6 has no batch start, and a line the state refuses mustn't stop the rest (T131's `startSuggestions`) |
| The summary shows the server's receipt once it has one, else the local one | "Already collected" then shows in place, with no second screen (§9) |
| Collect all runs once from navigation state, then keeps its id there | A reload shows the same receipt and never collects again |
| `since` is written when the sheet closes | Reopening in the same visit keeps "since 08:02" |
| Per-Uma Repeat sits on her Free line; each place's Repeat here is T140's | §5's "on every collected card" in a summary that folds slots into totals |
| A Free line's tap opens its sheet preselected | T131 plans one suggestion per Uma; §4's "swap for another suggestion" has no rule |
| Switch is Recall, then a start at the higher grade, through `recheck` | Repeat already started the old grade; Recall returns its inputs (07) |
| Couldn't repeat's Buy is a buy, then a Repeat of her | Her Repeat then finds the stock it lacked |
| Spending confirms once with the amount; everything else is one tap | §1 counts two taps for Buy and restart; §4 confirms Speed up all |
| A gated Needs line links to the Exchange row; only Queue stopped's fixes buy inline | T140's rule: a purchase stays one deliberate tap, outside §4's fixes |
| `SizeChips` shows a chip per size, 1 to what the stock covers | §3: "a chip per size with its finish time" |
| The shared pieces land first, as part 1, in `g2/ui/work/` | T139 and T140 embed the size chips, queue times and warnings |
| Offline shows one line in the summary's footer | §9's words, where the owner just tapped |
