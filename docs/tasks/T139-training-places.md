# T139 — Training places

**M034 · the place wave: needs T136 and T137; runs beside T138 and T140–T142, its Dojo card choices after T138's
Library · not started.**

Read:
- [AGENTS.md](../../AGENTS.md) and [M034](M034-generation-2-cutover.md), whose "Fixed choices" bind this task.
- [rework/05](../rework/05-training-hub.md) in full; [11](../rework/11-hub-and-places.md) §1, §3.2, §4, §6, §7, §9, §12;
  [06](../rework/06-cards-and-bonds.md) §2, §3, §6, §10; [03](../rework/03-uma-progression.md) §6–§8;
  [02](../rework/02-check-ins-and-notifications.md) §3, §6, §9; [09](../rework/09-racing-rewards-and-exchange.md) §5.1.
- The modules it calls: `rework/training` (unlocks, order, facilities, extra, bonds, build, derive, sessions),
  `rework/constellation`, `rework/work`, `rework/farm` (buildings), `rework/planner`, `rework/check-in` and
  `rework/exchange` (`buy`). T134–T137 and T142 are specified beside it: use their exports by the M034 table.
- [T138](T138-town-hall.md) (the Uma picker, the Card Library's pick mode) and [T140](T140-farm-places.md) (the shared
  `g2/ui/work/` pieces and `ItemIcon`, the Kitchen's job-sheet link); the first of T138–T140 to land adds a shared
  piece to its owner's contract. Today's `TrainingScene`, `ConstellationScreen`, `ExtraStatsScreen`, `CardSetScreen`
  and `ui/constellation/*`, which it replaces and never edits.

## Goal and fixed scope

The Training page's four places on plain DOM screens: the **Observatory**, **Lineage Hall**, **Gym** and **Dojo**, each
with its Page (05 §8: header with level, slots and Upgrade; slots by room; Needs here; Collect here), Peek and Counter;
the one **session sheet**; and each Uma's **build view** at `/training/:facility/:umaId`: her constellation tree, her
Inspiration map, her Extra Stats map, and her bonds with each preset's card set. Sessions run on the work engine and
the build's rules are `rework/training`'s; this task restates neither.

## Implementation contract

**Where.** `apps/web/src/g2/places/training/{facility,session,observatory,lineage-hall,gym,dojo}/` and
`g2/ui/TreeGraph.tsx`. As every place task: lazy Peek, Page and Counter in T137's slots; a pure `model.ts` beside each
screen; every tap through T136's operation action and `recheck`, its `done`, `ask` or `say` answer shown with `fill`.

**Routes** (11 §7.1): `/training/:facility` for `observatory`, `lineage-hall`, `gym`, `dojo`;
`/training/:facility/:umaId` (`?preset=sprint|mile|medium|long`). The session sheet opens over a facility page from its
query: `?session=:umaId&room=:room&unlocks=<kind>:<target>,…&back=<path>`, `back` an in-app path only.

### Facility pages

- **Header:** name, level, slots in use ("2 / 3", `slotsOf` and `slotHolder`), speed at Lv 3, and **Upgrade** with
  `upgradeCost(facility, level + 1)` and what it adds (`totalSlots`, `buildingSpeed`), each item against its stock;
  `upgrade`, its `prize-money` or `short` words when off, nothing at Lv 3. (i) help from the registry blurb and 05.
- **Slots**, grouped by room at the Gym and Dojo under the room's stat or type icon (`ROOM_NAMES`). Free: **Start a
  session**. Busy: her bust, the current unlock ("Node 7 · Potato Salad": `unlockLabel` and the dish's name),
  "2 of 3", the next finish and the session's end as clock times (`itemEnds`, `endsAt`), queue chips, **Speed up**
  and **Recall**. Ready: **Collect** (`collect`).
- **Needs here:** `facilityLines(plan(…), facility)` per target ("Special Week · 3 nodes · 2 in stock, 1 short"),
  **Start** when `canStart`; a short dish links to T140's Kitchen job sheet. **Collect here:** `collect-all` with
  `places: [facility]` (02 §2).
- **Peeks** (11 §3.2): the slots with faces and finish times; Umas with unlocks left here in their open layers; the
  facility's dishes in stock (Vegetables; Mushrooms; stat, Duo and Feast dishes by room; bonds left this layer at the
  Dojo, from `layerProgress`). **Counter:** Umas whose session here is Ready.

### The session sheet (05 §8, 06 §6)

One sheet for a slot, a locked item's **Unlock**, a Needs line, the planner and a Bond link.
1. **Uma** (skipped when the query names her): T138's Uma picker, Free Umas first, each with what she still needs
   here. A Ready Uma can be picked (`start` collects her first, 05 §2). A busy one reads "Busy until 14:20" (`freeAt`)
   with **Queue** only when her running session is at this facility and room and her queue has room (`MAX_QUEUE`); a
   running Farm job offers **Recall** first (05 §2).
2. **Unlocks:** her items here, oldest layer first in canonical order (`layerUnlocks` of each open layer, kept by
   `facilityOf` and `roomAccepts`; the next layer shown locked), each read with `unlockStatus(build, at, unlock,
   pending)` where `pending` is `workAhead(row)` plus the items picked above it. Available: a checkbox, the dish's name
   and grade, its free stock, the minutes (`sessionSeconds(grade, speedAt(…))`). Waiting: "Needs Speed grade 1
   first". In her work: "In session · opens 04:45". Later: a lock and "Opens in scenario 3 · Trackblazer". No dish:
   greyed "0 in Warehouse · Cook", linking to the Kitchen. The sheet pre-picks `fitSize(now, seconds,
   profile.checkIns, offset)` of the available items, capped by stock and `SESSION_MAX_UNLOCKS`. **Dojo:** the room's
   cards come from T138's `CardLibrary` in pick mode (`eligible`: `bondStatus` available and `dojoRoomOf` this room),
   each with `bondDishId` and its minutes; cards the query names arrive picked.
3. **Confirm:** the dishes to reserve, total minutes, each finish time; **Start** (`start` with the slot and
   `sessionRequest(unlocks)`) or **Add to queue** (`queue`). Start stays off until a picked unlock has its dish
   (05 §10). The slot is the slot card's, else the first free one of the room or facility in `slotsOf` order; with
   none free, Start says when the next one frees. After Start the sheet closes to `back` or the facility page.

### Speed up, Recall and queues

The shared `g2/ui/work/` pieces are T140's contract, used here unchanged: `SlotCard`; `SpeedUpControls` (−30m is
`speed-up` with the entry's `startedAt`; **Finish · N** is `finish`; with too few tickets "Buy 3 and finish · 90" asks
once, then `buy` and `finish` in order, 09 §5.1; the minutes the last ticket wastes are shown, 05 §2); `RecallSheet`
(a preview from `recall` run on the current state: what opens, which dishes return, the progress lost; then
`recall`); `QueueChips` (`queue` remove and move). Whichever of T139 and T140 lands first adds them.

### Build views (`/training/:facility/:umaId`)

A shared header: her bust, name, "T1 · URA Finale", the preset switch (`?preset=`, opening on
`raceDefaults.selectedPreset`), the preset's five stats and SP (`deriveUmaPreset`), and the **Collect** chip ("2
unlocks finished": her session's finished, uncollected unlocks; `collect`). Every locked item says what it needs in
05 §8's words and links to the step that gets it; its **Unlock** opens the session sheet with her and that item.
- **Observatory** (full screen, 11 §6): `TreeGraph` draws `treeFor(T)` and `treeEdges` on the validator's box, with
  pinch zoom. Open nodes take the assigned card's type colour; the next node reads "Needs: Cabbage Salad (grade 3) at
  the Observatory · 2 in stock" with **Unlock**; further ones "Opens after node 14"; a later layer's "Opens in scenario
  3 · Trackblazer"; her session's "In session · opens 04:45" or "Finished · Collect". An open node's sheet shows its
  card and the skills it pays there, and picks another card of the set under `perCardCap` (`set-assignments`;
  `node-cap`, `node-locked` as words). A **List** toggle shows the same nodes as 44 pt rows, which VoiceOver reads.
- **Lineage Hall:** 05 §5's map: A and B above, A1, A2, B1, B2 below, natural golds as moons; each slot locked, open or
  filled, with its unique and two golds and their states. Filling a slot runs `set-lineage` through the Uma picker:
  owned Umas, never herself, `lineageSlotEligibility`'s reasons as `disabledReason`, and a sort by what each pick would
  move (`deriveBuild` with that pick). The gold-2 warning of 05 §3 shows when the Uma in the slot has one natural gold.
- **Gym** (full screen): 05 §6's 37-node grid (columns in `EXTRA_STATS` order, then the Sun column; rows by grade), each
  node's value at her tier (`extraNodeStats`) and state; on/off for the preset (`set-active-nodes`) with "9 of 9 on"
  (`extraCapacity`); `over-capacity` as words. A Duo or Sun's Unlock opens the first room `roomsFor` lists.
- **Dojo:** her bonds this tier and "6 of 9 by scenario 2" (`bondsThrough`); the preset's set of six (`set-card-set`),
  each slot opening T138's `CardLibrary` in pick mode on her bonded cards; the receipt's `handedOver` and `emptied` in
  one line (D129); a dimmed node value and "newer cards available" where an older card's `eraPct` fell (06 §3);
  **Bond more**: eligible unbonded cards with dish and Bond (the sheet).

### States

No Umas yet: free slots and "No Umas yet · unlock them in the Stable". An unknown Uma id: `unknown-uma`'s words. An
empty Warehouse: the sheet opens greyed with Start off. Offline: everything applies locally and shows the same. A
second device's session: Start's `recheck` names it ("Kitasan Black is busy until 18:30."). Advancing mid-session: it
runs on (05 §10); promotion's Recall is T141's sheet.

## Tests

View models, on synthetic state built with the operations and `rework/sim`'s fixtures:
- Facility pages: slots read `totalSlots` (the Observatory 2 at Lv 1, 3 at Lv 2; the Gym ten in five rooms at Lv 2);
  a three-node session's words and clock times from `sessionSeconds`; the Counter; Needs here lines.
- The sheet: a tier-1, scenario-2 Uma with layer 1 done lists `n13`–`n16` with `dish-vegetables-3`, `-3`, `-4`, `-4`,
  and `n17` as "Opens in scenario 3 · Trackblazer"; picking `n13` frees `n14`; the Power room lists Power grade 3, then
  the Wit–Power and Power–Speed Duos and the Spring Feast's Sun, each "Needs … first"; the pre-pick equals `fitSize`;
  with no dish in stock, Start is off.
- Build views: each tree node state; 37 Extra Stats cells in 05 §6's grid and the capacity line; Lineage slot states
  and the gold-2 warning; the card set's refusals in words. Every screen's copy passes `BANNED_WORDS`.

Components (jsdom with `fake-indexeddb`, T136's store over a synthetic save, a memory router and a fake clock):
- A three-node Observatory session from the sheet takes three dishes from the Warehouse and shows "Node 1 · … · 1 of
  3"; after two finishes the tree's Collect chip opens two nodes, each holding the set card 03 §6's fill picks; Recall
  returns the third dish.
- −30m spends one ticket and moves every unfinished finish 30 minutes earlier; Finish with too few tickets asks
  "Buy N and finish · …" and then runs `buy` and `finish`.
- Upgrading the Observatory with its price in hand shows three slots at once.
- The Dojo query from a card page opens the sheet with her, the room and the card; Start returns to `back`.
- Over capacity, an Extra Stats switch reads "Only 9 Extra Stats can be on at once."; a reload keeps every change.

## Acceptance

- `pnpm lint && pnpm test:ci && pnpm build` pass; the entry chunk stays ≤ 180 KB gzip; nothing in today's entry
  imports `g2/`.
- In the `uma-racer-dev` preview at 390×844, with Account's dev fixtures (a tier-1, scenario-2 Uma, dishes, Prize Money,
  Speed Tickets): each facility's Page, Peek and Counter; start, queue, speed up, finish, recall and collect a session
  at every facility; upgrade one; in each build view assign a card to a node, fill a lineage slot, switch an Extra
  Stats node and change the set; bond a card from the Library through the Dojo sheet. Each survives a reload.
- The Gym at Lv 2 shows ten slots in five rooms; full-screen views hide both bars and return where they came from;
  every action is at least 44 pt (tree nodes through the List); reduced motion stills every bounce; VoiceOver reads a
  slot as one line (who, what, when).
- Every locked item names its dish, facility and blocker, and its Unlock opens the sheet pre-filled (05 §12); every
  disabled button says why; no player-facing text holds a banned word.
- The rows below land in 05 §11 and 11 §13 with one `docs/decisions.md` entry, and this spec is deleted in the pull
  request that lands it (D104).

## Out of scope

The page grid and pips (T137); Collect all, Repeat, targets, the Needs tab and the summary (T142); the Advance and
Promote sheets and the race-start collect (T141); the Card Library and the Uma picker (T138); the Kitchen and its job
sheet (T140); the pixel-art Training scenes (phase 7).

## Decided here

| Choice | Why |
|---|---|
| The session sheet opens from the facility page's query (`?session=…&room=…&unlocks=…&back=…`), `back` in-app only | Every place is a link (11 §1); the Library's Bond, the planner and the build views reach it without importing it |
| The Observatory's and Gym's build views are full screen; the Lineage Hall's and Dojo's stay in the shell | 11 §6 names only the tree and the Extra Stats map |
| A build view's preset switch is view-only (`?preset=`), opening on her selected preset | 03 §6: her profile selects a preset (T138's `set-race-defaults`) and every training screen edits it |
| Lineage picks are made on the Lineage Hall's map only | 05 §4–§5: the tree carries no lineage band (11 §3.2's Observatory says "card and lineage assignments") |
| Tree nodes keep the validator's 40 pt spacing with pinch zoom; a List of 44 pt rows carries every node action | 05 §4's spacing can't hold 44 pt targets; today's graph draws smaller nodes too |
| `TreeGraph` is new, on `rework/constellation`'s `Tree`; today's `ConstellationGraph` isn't reused | It reads Constellation Level and today's templates |
| Start takes the slot card's slot, else the first free slot of the room or facility in `slotsOf` order | 05 §8 doesn't say; every free slot of a place runs the same |
| The Dojo's card choices mount T138's Library in pick mode and land after it | 06 §6: no weaker parallel picker |
| The Counter counts Umas whose session here is Ready | 11 §3.2: "Umas with a finished session here" |
| The sheet pre-picks `fitSize` of the available items, capped by stock and 10; the Dojo pre-picks only cards the query names | 05 §8's "as many as fit before the next check-in"; a bond names its card (D344) |
| A Duo or Sun goes to the room it was started from, else the first `roomsFor` lists | 05 §1 lets either room take it |
| Speed up, Recall and queue chips are T140's shared `g2/ui/work/` pieces; the first of T139 and T140 to land adds them | One look for every timed thing an Uma does (07 §2, 05 §11) |
| Dishes show by name and grade with their icon, never by id: 05 §8's "`dish-vegetables-3` (Cabbage Salad)" reads "Cabbage Salad (grade 3)" | 08 §10 shows a dish by name; 02 §9 keeps ids off the screen |
