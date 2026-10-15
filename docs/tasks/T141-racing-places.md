# T141 — Racing

**M034 · a place task: needs T136 and T137, parallel with T138–T140 and T142 · not started.**

Read:
- [AGENTS.md](../../AGENTS.md) and [M034](M034-generation-2-cutover.md), whose "Fixed choices" bind this task. It closes
  the racing half of the milestone's cross-task acceptance #1.
- [rework/11](../rework/11-hub-and-places.md) §3.3 (the Racing page), §6 (full-screen flows), §7 (routes), §9.2 (a
  racing session); [09](../rework/09-racing-rewards-and-exchange.md) in full; [03](../rework/03-uma-progression.md) §2,
  §4, §5, §10; [04](../rework/04-tiers-and-promotion.md) §3, §5, §9, §10; [02](../rework/02-check-ins-and-notifications.md)
  §8–§9 (offline, stale screens, plain words); [06](../rework/06-cards-and-bonds.md) §7 and
  [05](../rework/05-training-hub.md) §11 (the badge changes); [10](../rework/10-expeditions.md) "Entry" and "Places and
  screens", only for what the placeholder must not promise.
- [design/racing.md](../design/racing.md) (race loop, rewards, presentation) and [design/badges.md](../design/badges.md);
  D122, D328, D336, D340, D345.
- Today's race: `apps/web/src/screens/RaceSelectScreen.tsx`, `screens/race/*`, `game/racing.ts`, `game/race-plan.ts`,
  `scenes/race/*`; today's Trophy Hall: `screens/BadgesScreen.tsx`, `TrainerProfileScreen.tsx`, `game/flair-view.ts`.
- The rules it calls: `@racer/domain/rework/tiers` (`applyRaceFinish`, `advanceReadiness`, `promotionReadiness`,
  `promote`, `canStartExpedition`, `rollRivalFieldAt`, `careerView`), `rework/training` (`advanceScenario`, which wraps
  the tier rule and the carry, `deriveUmaPreset`, `promotionPresetStats`, `layerDone`), `rework/exchange`
  (`purseFor`, `bandAt`, `boardDay`, `featuredBoard`, `featuredSeed`), T134's `finish-race`, and `@racer/domain`'s
  `raceAttemptSeed`, badges and flair.

## Goal and fixed scope

The Racing page's four places as plain DOM pages under `apps/web/src/g2/places/racing/`, filling T137's Peek, Page and
Counter slots:

| Place | Builds |
|---|---|
| **Racecourse** (`direct`) | Race select (Uma strip, purse bar, Today's featured, Next up, every race), the pre-race sheet, the run and the result |
| **Scenario Gate** | Every Uma's career, one Uma's career at `/:umaId`, the Advance sheet, the Promote sheet and the ceremony |
| **Expedition Map** | The phase-3 placeholder |
| **Trophy Hall** | Badges in Uma, Stable and Trainer scopes, titles, showcases, the G1 trophy wall, records, Prestige and the trainer profile, on generation 2's catalogue |

- **Today's engine and scene, as they are.** Engine v9 (`packages/race`) and `scenes/race/RaceScene.ts` (PixiJS,
  lazy). The run page imports them; nothing in `packages/race` or `scenes/race/` changes.
- **Racing is never blocked** (D328): no Farm lock (today's `lockFarmRace` isn't carried), no work check, no cost.
- **She races as her current scenario:** no scenario picker and no `tier` query parameter (03 §6, §12).
- **No screen restates a number:** prizes, band edges, EXP, holds and thresholds come from the rules' exports.

## Implementation contract

### The race commit, on T134's `finish-race`

A race commits through T134's `finish-race` operation (09 §9) as T134 defines it: its input, its `raceResults` row
(the operation's id is the result's id) and its receipt. This task prepares the race, runs it and shows the receipt; a
gap a screen finds is fixed in T134's module, with its test.

| Part | Rule |
|---|---|
| Prepare | Today's `buildPreparedRace`, fed from the generation-2 state. First T134's collect-before-race on a copy of the state, so she races with every unlock already finished (01 §2); then stats, aptitudes and loadout from `deriveUmaPreset` on the preset of the race's distance (D254); rivals from `rollRivalFieldAt` at her T and the race's grade; seed `raceAttemptSeed(profile.createdAt, contentVersion, outfitId, raceId, strategy, n)`, *n* her number of results so far. The attempt carries `localDay`, the device's `YYYY-MM-DD` at Start race (09 §3.3), and the featured board the screen shows |
| When | **At Start race**, before playback: the timeline is simulated, the operation applies locally and is queued, and the run plays the committed result (09 §8). If the local commit fails, the run doesn't start and the sheet says "That didn't work. Try again." (02 §9) |
| Input | The placement from the timeline, `localDay`, the board, and `run`: today's race record without its progression fields (engine version 9, course, seed, field, accomplishment facts) |
| The server | Re-runs the operation on its copy, trusting the placement and the board as it trusts the clock (02 §8, 09 §3.3: no anti-cheat); it doesn't re-run the race |
| The result reads | The row's `commit` receipt (collect, finish, prize), so a reload shows exactly what was paid |

- **Flair** is evaluated after the operation applies locally (`applyRaceBadgeFacts`, `evaluateUmaFlair`), and the
  `badges/…` entities and `flairEvents` rows are written in the same local transaction and queued behind the operation
  in the one lane, as today's race commit does (badges.md "Award and event semantics"). The server stores them as
  ordinary entities and logs. Advance and promotion write their awards the same way.
- **Two devices offline on one day** (09 §8): the server's purse decides; its row and ledger carry its amount, and a
  reload shows it.

### Racecourse

`/racing/racecourse` (`?uma=&race=` preselects) and `/racing/racecourse/run?result=:id`, which always plays a
committed result, so a reload or a reopen lands on the same race.

- **Header** (what a Peek would carry, 11 §3.3): the purse bar in 09 §3.5's three wordings, from
  `purseFor(profile.purse, localDay)` and `bandAt`, with a two-line (i); the featured bonuses still open.
- **Uma strip:** open goals first, then D181's order by lifetime level (03 §2), finished careers last (11 §9.2). A tile
  reads "T1 · Lv 13" with her work in one chip ("Kitchen · 16:40"), never a lock.
- **Today's featured:** three race cards with a gold ribbon, from `featuredBoard(boardDay(purse, localDay), regular,
  createRng(featuredSeed(day)))`, `regular` being today's Race Select projection (`race-catalog.ts`, D192). A paid bonus
  reads "Bonus paid". Then **Next up** (`race-plan.ts`) and every race, as today.
- **Pre-race sheet:** today's (grade, venue, surface, distance, aptitudes, strategy from her race defaults, stat fit,
  goals at stake), plus the preset it reads, the prize at the current band ("G1 win · 300", or "G1 win · 75, tired
  purse") and, when she has any, "Collects 2 finished unlocks first" (01 §2). **Start race** is always enabled.
- **Run:** today's `RaceRunScreen` behaviour, ported: scene, HUD, feed, speeds, step, pause, Skip, the wake lock and
  `window.__raceScene` in dev builds.
- **Result** (09 §7), in order: the stamp; the order and margins; Racing EXP with Race Bonus named, a level-up burst,
  a hold's line ("Held at Lv 25 · win the Trials") and "Gate reached · +1 Uma Shard" when the receipt pays one; Prize
  Money ("+300 · 1st in a G1") with only the lines that applied (featured bonus; tired or spent purse with the day's
  gross); goal ribbons and pips; flair in today's T016 order; **Next Uma**, **Race again**, **Races**, and **Advance**
  (to the Scenario Gate) when `advanceReadiness` is ready. The amount flies into the account bar's Prize Money chip,
  shown alone in the result's header (the shell's bars stay hidden, 11 §6). A reload or reopen shows the stored row's
  result, prize and band without fanfare.
- **Counter:** featured bonuses still open today, 0–3.

### Scenario Gate

- **Page:** every Uma's career (stage, goal races, holds, Racing Level); `/racing/scenario-gate/:umaId` for one. **Peek:**
  the featured Uma's goals in progress and the Umas ready to advance. **Counter:** Umas `advanceReadiness` says are ready.
- **Advance sheet** (03 §5), from the Gate or her profile (T138 links here): the move with both crests and "Racing Lv 10
  → 11"; a tab per preset with the five stats, SP and caps before and after; the new layer as counts; unfinished earlier
  unlocks ("Layer 1: 23 of 27. The rest stay open."); the new buff in one line; the new career's six races by name;
  "Free"; Advance or Not yet. "After" and the new career come from running `advanceScenario` on a copy of the state.
- **After Advance:** the "<Scenario> Graduate" award plays, then her profile opens (`/town/stable/outfit/:umaId`).
  Legacy counts the selected preset's parents at each arrival (unlock, advance, promotion), when her career freezes.
- **Stale or busy:** a refused advance redraws the sheet under "Her build changed." and keeps the button (03 §10.8).
- **Promote sheet** (04 §9) and the **ceremony** (full screen, 11 §6): the move, her tier in numbers, what resets and
  carries, her work with Collect, Recall and −30m (T136's work actions; nothing new here), "+1 Uma Ticket", Promote
  (enabled while `promotionReadiness` is ready) or Not yet. `promote` takes `promotionPresetStats`; the receipt's awards
  and ticket play in the ceremony; Skip or reduced motion go to her profile. Reached from the result, her profile and
  the Map only when she holds a completed run, so before phase 9 only through a dev proof under `/dev/` (11 §7.2).

### Expedition Map (placeholder until phase 9)

- **Page:** "No Uma has finished her tier yet" with each Uma's distance to entry ("Scenario 4 · Racing Lv 37"). An Uma
  for whom `canStartExpedition` holds reads "Ready for her World Expedition. Expeditions open in a later update; she
  keeps racing, and nothing is lost." (13 §4, 04 §11.7).
- **Never shown:** Start, a pool, a region, a fit, an Expedition id, a prize or a date. `/racing/expedition-map/:id`
  redirects to the Map. Nothing calls `recordExpeditionRace`, so no Expedition state is written before phase 9.
- **Peek:** the number of Umas ready for an Expedition. **Counter:** 0. Its frame is uma-art's `tier-finale`.

### Trophy Hall

- Today's badge page (three scopes, search, filters, sorts, showcases, titles, trophy wall, timeline) and trainer
  profile, ported at `/racing/trophy-hall`, `/trainer` and `/uma/:umaId`. View models that read `UmaSave` read the rework
  state through `careerView`; pure ones are imported as they are. Badge entities keep their shapes (13 §6).
- **Peek:** recent flair. **Counter:** flair events newer than this device's last visit (`uma-racer:g2:trophy-hall-seen`).
- **The generation-2 catalogue**, beside today's behind a `generation: 2` option on `buildUmaFlairCatalog` and
  `buildTrainerAchievementCatalog`, whose default stays today's until T143 removes it:

| Change | What (source) |
|---|---|
| Retire | Diligent, Card Collector, Maxed Out, Coupon Clipper, every Puzzle and Friendship record, and the `lifetimeTrainingTurns` and `friendshipTrainings` facts (13 §1, 06 §7) |
| Redefine | [Scenario] Fully Trained = `layerDone` (05 §11, D344); Graduate at the advance or promotion; level badges and Veteran Stable on lifetime level; Living Legend only through the Hall of Fame (04 §9); Era Loyalist over the sets of every race she ran in the scenario; [Era]/[Type] Complete become [Era]/[Type] Bonded; the Trainer meter "Cards bonded x/N", N the content's SSR count (06 §7) |
| Add | Promoted · Tier 2 and Tier 3 (one-off, 4 Prestige); Hall of Fame (one-off, 16 Prestige, title "Hall of Famer"); Trainer Promotions 1/5/15/30/50 and Hall of Fame 1/3/10/25/50 (04 §9); Card Partners 10/25/50/100/200 (06 §7) |
| Phase 9's | Expedition titles, Clean Sweep, series titles, Around the World (10 "Rewards") |

- **The ever-bonded set** (Card Partners, Bonded) is reconciled from every Uma's bonds and tier histories (06 §9) in each
  race, advance and promotion commit and when the Trophy Hall opens, so no other place task calls flair.

## Tests

- **Domain:** the generation-2 catalogue (retired awards absent, each redefinition, the new points and thresholds pinned
  in `domain.test.ts`); Card Partners survives a synthetic promotion.
- **The race on `finish-race`:** a prepared attempt for the same state, race, strategy and *n* is identical (seed,
  field, stats); the prepared stats include an unlock finished before Start; a committed race's device and server
  receipts are equal; a retried Start pays once; a second device's same-day race shows the server's re-priced prize
  after sync; a featured first win pays its bonus once.
- **View models:** strip order; the purse bar in each band and across the 4,500 edge; ribbons and the counter; the
  pre-race prize per band; result lines (featured, tired, spent, Shard, hold); a reopen shows the stored prize without
  fanfare; Next Uma; the Advance sheet's "after" equals the operation's; a stale advance redraws; the Map has no Start
  and its sub-routes redirect; the Trophy Hall counter; 02 §9's banned-words check over every new string.
- **Browser at 390×844** (`uma-racer-dev`, `window.__raceScene.skipToEnd()`): a race after the first is four taps from
  the Racing page; the result; the purse bar past each edge; the Advance sheet on a synthetic Uma at a gate; the Promote
  sheet and ceremony through the dev proof; the three scopes; no horizontal scroll and 44 pt targets.

## Acceptance

- On a fresh synthetic account an Uma races, wins her goals and earns Racing EXP and Prize Money by 03 §2 and 09
  §2–§4; the account bar's chip moves by the result's amount; she advances at her gate. All of it survives a reload,
  offline then synced, and a second device's sync (M034 #1, its racing half).
- 09 §11's on-screen items, 03 §12's racing and advance items, and 04 §13's promotion items (on the dev proof) hold.
- `pnpm lint && pnpm test:ci && pnpm build` stay green, today's app is unchanged, and today's entry imports no `g2/`.
- badges.md and racing.md (the commit at Start, the result, the generation-2 catalogue) say what runs; one decision
  records the choices below; this spec is deleted (D104).

## Out of scope

Expedition rules, content, map art and races (phase 9); a Hall of Fame place; the race on Phaser (phase 8); the canvas
Racing page (phase 6); the Uma profile, Skills and Needs (T138); the work actions the Promote sheet calls (T136, T139,
T140); the shell, routes and redirects (T137); deleting today's screens (T143).

## Decided here

| Choice | Why |
|---|---|
| The race commits at Start race, before playback, and the run page plays a committed result (`?result=`) | 09 §8: settled at the start, so quitting can't change the prize or purse, and a reopen shows the result; 01 §2: the race reads her build at its start |
| The prepared build first collects her finished unlocks on a copy | 01 §2 collects them in the same tap; T134's operation does the same, so device and server agree |
| The seed counts her results; the result's id is the operation's (T134) | Today's seed rule keeps an attempt reproducible; T134 makes the operation id once-only |
| `localDay` and the shown board are fixed at Start race and carried by the attempt | 09 §3.3: the race's day is the day it starts; the bonus is the one the owner saw |
| Flair rides as entities and logs in the same local transaction, behind the operation | badges.md's atomic awards; 13 §6 keeps `badges/…` as today |
| The result's header shows the account bar's Prize Money chip alone | 09 §7 and 11 §2.1 fly the prize into it; 11 §6 hides the bars in full-screen flows |
| "Gate reached · +1 Uma Shard" on the result | 04 §6 pays it in that commit; the owner should see it |
| Race again stays enabled at a gate | 03 §10.5: waiting at the gate is allowed and keeps paying Prize Money |
| The Map writes no Expedition state and offers no Start before phase 9 | 13 §4 and 10's entry; phase 9 can replace D340's stand-in run without a migration |
| Promote sheet and ceremony are built now, reachable only with a completed run | M034 gives promotion to this task; 04 §13 needs them testable |
| No Hall of Fame place in phase 3 | 04 §10 calls it a Town Hall place, 11 §3.1 lists none, and no Uma reaches it before phase 9 |
| The generation-2 catalogue sits behind a `generation` option until T143 | Build beside: today's app and tests stay green |
| The ever-bonded set is a projection of bonds and tier histories | 06 §9 keeps each tier's bonds, so it equals 06 §7's record, and no place calls flair |
| Legacy counts at each arrival | Today's Scenario Start is gone; arrival is when the career freezes (03 §4) |
| The web replays engine v9 only; `packages/race` keeps every version | The wipe leaves no older row; M034 keeps the engine as is |
| The Trophy Hall's "since last visit" is per device | 01 §4.2: device conveniences live in `uma-racer:g2:` keys |
