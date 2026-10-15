# T140 — Farm places

**M034 · the place wave: needs T136 and T137; runs beside T138, T139, T141 and T142 · not started.**

Read:
- [AGENTS.md](../../AGENTS.md) and [M034](M034-generation-2-cutover.md), whose "Fixed choices" bind this task.
- [rework/07](../rework/07-farm.md) in full, §10 "Screens" above all; [08](../rework/08-item-catalogue-and-recipes.md)
  §1–§6, §9, §10; [09](../rework/09-racing-rewards-and-exchange.md) §5.1, §5.3, §8, §10;
  [11](../rework/11-hub-and-places.md) §1, §3.4, §4, §7, §9, §11, §12; [02](../rework/02-check-ins-and-notifications.md)
  §2, §3, §5, §6, §8, §9.
- The modules it calls: `rework/farm` (buildings, jobs, level), `rework/work`, `rework/items`, `rework/planner`,
  `rework/check-in` (`schedule`, `collect-all`, `repeat`, `once`) and `rework/exchange`. T134–T137 and T142 are
  specified beside it: use their exports by the M034 table.
- [T138](T138-town-hall.md) (the Uma picker, the Warehouse's Make more, the Exchange's deep links) and
  [T139](T139-training-places.md) (which uses this task's shared pieces); the first of T138–T140 to land adds a shared
  piece to its owner's contract. Today's `farm/FarmScreen`, `farm/FarmKitchenScreen` and `ui/farm/*` go with today's
  Farm; this task replaces them and never edits them.

## Goal and fixed scope

The Farm page's ten places on plain DOM screens: the eight family sites (Sugar Grove, Orchard, Fishery, Nut Grove,
Herb Garden, Fields, Vegetable Garden, Mushroom Cave), the **Pantry** and the **Kitchen**. Each has 07 §10's building
page, a Peek and a Counter; one **job sheet** serves all ten, with sizes and queues; slot cards collect, recall, take
Speed Tickets and queue; each building upgrades. This task also owns the pieces every timed thing shares
(`g2/ui/work/`, `g2/ui/ItemIcon`). Jobs run on the work engine, and no screen restates a Farm rule or number.

## Implementation contract

**Where.** `apps/web/src/g2/places/farm/{building,job-sheet}/`, `g2/ui/work/` and `g2/ui/ItemIcon.tsx`. As every
place task: lazy Peek, Page and Counter in T137's slots; a pure `model.ts` beside each screen; every tap through T136's
operation action and `recheck`, its `done`, `ask` or `say` answer shown with `fill`.

**Routes** (11 §7.1): `/farm/:building` for the ten uma-art ids (`BUILDINGS` whose job is gather, craft or cook). The
job sheet opens over a building page from its query: `?job=:itemId&uma=:umaId&count=:n&queue=1&back=<path>`, `back`
an in-app path only. T138's Make more, the planner's lines and T139's "Cook" links use it.

### Building pages (07 §10)

1. **Header:** name, level, slots in use ("5 of 6"), speed, **Upgrade** with `upgradeCost(building, level + 1)`'s
   Prize Money and items against stock (`upgrade`; `prize-money` and `short` as words; nothing at Lv 3), (i) help.
2. **For your targets:** `placeLines(plan(…), building)`, lowest grade first, in 02 §6's words ("Vegetables G3 · short
   6 · Warehouse 4 · coming 2 (Gold Ship, 14:10)"). A gated line reads "Grade 4 needs Farm Lv 16 · highest free Uma:
   Lv 14" and, when `stockedGrade` covers it, "Buy at the Exchange · 126" linking to T138's `?family=&grade=` row.
   Tapping a line opens the job sheet filled in: `suggest`'s Uma and size for that item, else the first Free Uma whose
   Farm Level opens it, sized by `fitSize`.
3. **Slot cards** (`SlotCard`), one per slot in `slotsOf` order; the Kitchen's eight scroll inside the page. A running
   job: her face (the release's `character-faces`, falling back to her outfit icon), name and Farm Level; the item's
   icon and grade; a ring for the current output (`progress`); "3 / 10 made"; the next output's and the job's end
   (`itemEnds`, `endsAt`); queue chips; **Collect** while outputs wait (`finishedCount` above `collected`), **−30m**,
   **Finish**, **Recall** and **+ Queue**. A free slot: **Start a job**.
4. **Collect here** (`collect-all` with `places: [building]`) and **Repeat here** (`repeat` with `places: [building]`),
   whose receipt lists each skip with its reason ("Kitchen full", "4 Honey short"), beside T142's global ones.

**Peeks** (11 §3.4): the slots with faces and the next output's time; the family's stock by open grade (up to the
highest grade any current Uma has open); the planner's lines here. The Pantry adds crafted items short for the
targets, the Kitchen dishes short. **Counter:** Umas with finished outputs here.

### The job sheet (07 §10)

1. **Uma** (T138's picker): Free first; then, once an item is chosen, the best suited (`familyAptitude` and
   `farmExpMultiplier` for its families, `expFamilies`); then Farm Level, highest first. Each row: Farm Level, the
   highest grade she can work (`highestOpenGrade`), her tier and "Sprint A · Farm EXP ×1.6" (07 §3). A session greys
   her ("in a session until 14:20"). Her running job here, with queue room, offers **Add to queue**; one elsewhere
   offers **Recall and start here**, which shows `RecallSheet`'s loss line, then runs `recall` and `start` (07 §5).
2. **What:** items by grade. A site: its family's ten raw grades. The Pantry: crafted items in family tabs, in
   `FAMILY_RING` order. The Kitchen: Speed · Stamina · Power · Guts · Wit · Skill bonds · Constellation · Inspiration ·
   Duos · Feasts · **Can cook now** (07 §10), by each family's destination (`FAMILIES`), `DUOS` and `FEASTS`. A grade
   above her Farm Level shows its lock ("Farm Lv 16", `gradeOpensAtFarmLevel`) rather than hiding. Each item: icon,
   name, stock and **Needed × N** from the plan's lines; a dish names its destination and the Umas whose open unlocks
   want it (`remainingFor` per Uma, targets first).
3. **How many:** 1–10 through T142's shared `SizeChips`, a chip per size the stock covers as 02 §3 asks (`sizeChips` and `fitWords`, each chip in
   `chipWords`' words: "ends 14:00 · then free until 22:30"). It previews with the kind's own `plan`
   (`kindRules(env, kind)`), whose items carry what Start will freeze: the minutes per output at today's speed, the
   clock end ("ends 22:40"), the Farm EXP (quarter points, shown whole) and every input against free stock ("Honey 8
   of 9 · 1 short").
4. **Start** (`start` with the slot and `{ kind, item, count }`) or **Add to queue** (`queue` with `add`). A disabled
   button always says why, in the refusal's words ("Needs Farm Lv 16.", "Short 1 Honey.", "Three are already
   queued."); a shortfall links to the building that makes it (`makesHere`, `FAMILY_SITE`) and, for a stocked raw
   item, to the Exchange row. An `ask` re-offers the covered size ("Only 3 left now. Start ×3?"). The slot is the slot
   card's, else the first free one in `slotsOf` order; with none free, Start says when the next one frees.

### The shared pieces (this task's contract; whichever of T138–T140 lands first adds a piece)

- **`g2/ui/work/SlotCard`**: one slot's card for a Farm job or a session (T139 passes its unlock line); who, what,
  progress, times, the actions below, and one VoiceOver line ("Special Week. Potato, 3 of 10 made, next at 11:10").
- **`SpeedUpControls`** (07 §8, 09 §5.1): **−30m** is `speed-up` with the entry's `startedAt` and one ticket;
  **Finish · N** is `finish`, N from `ticketsToFinish(remainingMs(…))`. With too few tickets it reads "Buy 3 and finish
  · 90", asks once, and runs `buy` (`speed-ticket` at `SPEED_TICKET_PRICE`) then `finish`. Under 30 minutes left, it
  shows the minutes wasted before it confirms. Not shown on a queued, finished or empty slot.
- **`RecallSheet`**: a preview from `recall` run on the current state (pure): outputs paid, inputs returned ("8
  Chopped Carrot and 2 Wheat Flour come back"), the minutes of progress lost and the queue dropped; then `recall`.
- **`QueueChips`**: "+2" on the running card and the queue in order, each removable and movable (`queue` with
  `remove` or `move`), with T142's warning mark where `queueWarnings` names one; a stopped queue is T142's.
- **`g2/ui/ItemIcon`**: an item's `art` frame from uma-art's `items` or `dishes` atlas as a CSS sprite at whole-number
  scales (`image-rendering: pixelated`); the Speed Ticket's new icon once the pinned release has it, until then its
  name on a plain tile (11 §11); alt text "Carrot Salad, grade 1".

### The collect commit raises the Exchange's stock mark

D345 says phase 3 puts the mark's raise in the collect commit, and keeps the Farm's rules free of the Exchange. So
`runOnce` (`rework/check-in/once.ts`), which every owner action passes through on the device and the server, sets
`exchangeGrade` to `stockedGrade(profile, farmLevelsOf(state))` after an operation applies: a no-op unless a collect
(`collect`, `collect-all`, `recall`, `repeat` or `start`'s collect-first) lifted a Farm Level. The test and a row in
09 §10 land with it.

### States

A fresh account: every building at Lv 1; a site's sheet offers grade 1 to any Uma (gathering needs no inputs); the
Pantry's and Kitchen's sheets name the shortfall and link to the site (07 §11). No Umas: "No Umas yet · unlock them in
the Stable". After a day offline every output and queue start sits where its timestamps put it, uncollected until
Collect (07 §11). A second device's change: `recheck` answers with the result, a new size or the rule. An upgrade
mid-job adds its slot cards at once; running jobs keep their frozen speed. A clock moved back makes waits longer.

## Tests

View models, on synthetic state built with the operations and `rework/sim`'s fixtures:
- Building pages: every building's slot cards follow `totalSlots` at Lv 1–3 (07 §6's table); 07 §2's Potato job reads
  "3 / 10 made" with its next output and end from `itemEnds` and `endsAt`; the Counter; the target and gate lines,
  with the Exchange link only when stocked.
- The job sheet: a site lists its family's ten raw grades, locked above her Farm Level; the Pantry's family tabs; the
  Kitchen's eleven tabs, Can cook now included; Cook Carrot Salad × 3's inputs, 12 Chopped Carrot and 3 Wheat Flour
  (07 §2); the size chips and their words from `sizeChips`; Farm EXP in whole numbers; the aptitude line; the Uma
  order.
- The shared pieces: `SpeedUpControls`' four states; `RecallSheet`'s preview equals the receipt `recall` gives.
- The domain: a `collect` through `runOnce` that lifts an Uma to Farm Lv 6 raises `exchangeGrade` to 2; nothing
  lowers it, promotion included; a retried id changes nothing. Every screen's copy passes `BANNED_WORDS`.

Components (jsdom with `fake-indexeddb`, T136's store over a synthetic save, a memory router and a fake clock):
- Gather × 10 at the Vegetable Garden; three outputs later Collect pays three into the Warehouse and their Farm EXP;
  a queued second job starts when the first ends; −30m moves the end and the queued start 30 minutes earlier.
- Cook Carrot Salad × 3 reserves its inputs; recalled after one and a half salads, it pays one and returns 8 Chopped
  Carrot and 2 Wheat Flour (07 §2).
- Upgrading the Kitchen to Lv 2 shows eight slot cards at once; a fresh account's Kitchen sheet names the shortfall
  and links to the Pantry; a Make more link opens the sheet on its item and Start returns to `back`.
- Twelve hours on the fake clock, then reopening, shows every output and queue start where the timestamps put them;
  a reload keeps everything; offline, every action still applies.

## Acceptance

- `pnpm lint && pnpm test:ci && pnpm build` pass; the entry chunk stays ≤ 180 KB gzip; nothing in today's entry
  imports `g2/`.
- In the `uma-racer-dev` preview at 390×844, from a fresh account and then Account's dev fixtures: every building's
  Page, Peek and Counter; gather, craft and cook through the sheet with each size chip; queue, −30m, Finish and Buy
  and finish, Recall with its preview, Collect, Collect here and Repeat here; upgrade a site and the Kitchen. Each
  survives a reload.
- 07 §15's screen checks: the building page shows every slot card (the Kitchen's eight scroll inside it), every action
  is at least 44 pt, and every disabled button states its reason. Animation is transform and opacity only, and the
  ring redraws every 30 seconds and on foreground, never per frame (11 §4).
- M034's cross-task #1, Farm part: a fresh account gathers, crafts and cooks offline, then syncs, and a second device
  shows the same jobs, stock and Farm Levels (07 §15).
- The rows below land in 07 §14 and 09 §10 with one `docs/decisions.md` entry, and this spec is deleted in the pull
  request that lands it (D104).

## Out of scope

The Farm page grid, pips and the Ready badge (T137); Collect all, Repeat all, the check-in summary, Start suggestions,
queue warnings and stopped queues (T142); the Warehouse and the Exchange (T138); sessions (T139); push notifications
(phase 4); the pixel-art Farm scenes (phase 7).

## Decided here

| Choice | Why |
|---|---|
| The job sheet opens from the building page's query (`?job=…&uma=…&count=…&queue=1&back=…`), `back` in-app only | Every place is a link (11 §1); the Warehouse, the planner and the session sheet reach it without importing it |
| A planner line opens the sheet filled in with the suggested Uma and a fitted size; it doesn't start at once | 07 §10 says "opens the job sheet with it filled in"; 02 §6's one-tap start stays the summary's Start suggestions |
| The section is titled "For your targets", in 02 §6's line words | 02 owns the planner's views (07 §10 calls it "Needed now") |
| The Uma list is Free first, then suited for the chosen item, then Farm Level; a busy Uma is greyed with what she's doing | Joins 07 §10's order with 07 §3's "sorts suited Umas first" |
| The Pantry's items sit in family tabs in the ring's order; a site lists its family's ten grades | 07 §10 tabs only the Kitchen; the ring is the Farm page's order (11 §3.4) |
| Can cook now lists dishes the free stock covers once and the chosen Uma's Farm Level opens (any Uma's when none is chosen) | 07 §10 names the tab, not its rule; this is what Start would accept |
| Moving a busy Uma is **Recall and start here**: one confirmation naming what is lost, then `recall` and `start` | 07 §5: "the sheet shows what is lost … before it confirms" |
| A shortfall links to the building that makes it and, for stocked raw, the Exchange; the sheet buys nothing inline | Only a stopped queue's Buy and restart (02 §4) and Finish (09 §5.1) buy inline; a purchase stays one deliberate tap |
| "Buy N and finish" runs `buy` then `finish`, two operations after one question | 09 §5.1 |
| `runOnce` raises the Exchange's stock mark after every operation (`stockedGrade` over current Farm Levels) | 09 §10 (D345): "phase 3 puts that in the collect commit", and the Farm's rules don't depend on the Exchange; every collect path runs through `runOnce` |
| The Peek's stock by open grade runs up to the highest grade any current Uma has open | 11 §3.4 says "by open grade"; the same reading as the Exchange's stock (09 §5.3) |
| This task owns `g2/ui/work/` and `g2/ui/ItemIcon`; the first of T138–T140 to land adds a piece | One look for every timed thing and every item; the Farm makes the items |
