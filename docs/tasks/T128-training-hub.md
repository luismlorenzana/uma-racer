# T128 — The Training Hub and the build

**M033 · second wave: needs T125, T126 and T129; runs beside T127 · not started.**

Read:
- [AGENTS.md](../../AGENTS.md) and [M033](M033-rework-rules.md), whose "Fixed choices" bind this task.
- [rework/README](../rework/README.md); [05](../rework/05-training-hub.md) and [06](../rework/06-cards-and-bonds.md)
  in full; [03](../rework/03-uma-progression.md) §6–§8; [04](../rework/04-tiers-and-promotion.md) §2, §4, §7, §8;
  [08](../rework/08-item-catalogue-and-recipes.md) §6; [02](../rework/02-check-ins-and-notifications.md) §6, §9;
  [13](../rework/13-removals-and-plan-changes.md) §6. Decisions D326, D328, D329, D336 and D338.
- The T125, T126, T127, T129 and T131 specs: this task imports their exports and copies none of their numbers. Today's
  `constellation.ts`, `derived.ts`, `lineage.ts`, `inspiration.ts`, `cards.ts`, `scenario-buffs.ts`, `race-skills.ts`.

## Goal and fixed scope

Build, as pure tested modules, everything a Training Hub session unlocks and the build those unlocks feed: what each
facility and room takes, the layers, the unlock order, the dish each unlock takes, the Extra Stats map and its
capacity, bonds, card sets and presets, the reviewed buffs, and the stats derived from all of it. Sessions run on
T127's work engine; this task gives them their content. Today's game and today's modules do not change.

Draft numbers. Each becomes a named constant whose comment cites its page and section:
- **Facilities** (05 §1): the Observatory opens nodes with Vegetables, the Lineage Hall Inspiration with Mushrooms, the
  Gym Extra Stats, the Dojo bonds. A Gym room (ring order Stamina, Wit, Power, Speed, Guts) takes its stat's singles,
  Duos with its stat and any Sun; a Dojo room takes its card type's bonds (Friend and Group share one). Slots, levels,
  speed and upgrade prices are T127's (`farm/buildings.ts`).
- **Layers** (05 §3, D338): 27, 23, 21, 19 and 17 unlocks, 107 a tier. Observatory 12/4/4/4/4 (28), Lineage Hall
  4/6/4/6/4 (24), Gym 5/10/10/6/6 (25 singles, 8 Duos, 4 Suns), Dojo 6/3/3/3/3 (18, a pacing count, not a cap).
- **Grades and dishes** (README, 05 §3, 08 §6): scenario *s* uses grades 2*s*−1 and 2*s*, fixed per unlock by 05 §3's
  three tables. A node takes `dish-vegetables-<g>`, an Inspiration unlock `dish-mushrooms-<g>`, a single its family's
  `dish-<family>-<g>`, a Duo `duo-<a>-<b>-<g>`, a Sun `feast-<g>`. One exact dish; no substitutes.
- **Session time** (README, 05 §2): 180 + 15(*g*−1) base minutes an unlock, as `workSeconds(base, speed)` at the
  facility's speed when the entry starts. 1–10 unlocks of one facility, one room at the Gym and Dojo.
- **Extra Stats** (05 §6, D338): 37 nodes a tier: a single per stat per scenario at grades 1, 3, 5, 7, 9; Duos
  Stamina–Wit, Wit–Power, Power–Speed and Speed–Guts at grades 3 and 5; Suns at 4, 6, 8, 10. Per-kind values and E are
  T125's (`scaling.ts`); this task applies them per node, with Foundation's ×1.5 at T1 (04 §8). Active capacity per
  preset 7/9/11/13/15; the layers so far hold 5/15/25/31/37.
- **Card nodes and SP** (03 §8, 05 §4, D134): node value and caps from T125 (`nodeValue`, `capProfileAt`, `spCapAt`),
  tree size and per-card cap from T129 (`sizes.ts`). Baseline SP = round(0.40 × spCap(T) × opened ÷ *N*);
  spNodeValue = round(0.60 × spCap(T) ÷ ceil(*N*/6)).
- **Bonds** (06 §2, D329): *p* = max(1, era − 5(tier − 1)), grade 2*p*−1. Speed Sweets, Stamina Fruits, Power Fish, Guts
  Nuts & Seeds, Wit Herbs & Spices, Friend and Group Grains. Bondable when era ≤ T; any number; never undone. Pacing
  counts 6, 9, 12, 15, 18 by scenario (05 §11, "Fully Trained").
- **Presets** (03 §6, 06 §3): Sprint, Mile, Medium, Long. Each: six bonded slots, assignments by node id, lineage
  picks, active Extra Stats, loadout. Shared by all four: opened nodes, Inspiration and Extra Stats, and bonds.
- **Buffs** (04 §8): the reviewed table, with Team Spirit +2% a filled slot, Fragments era ≤ 4 +8%, New Wave, Full
  Course and Encore (T15, Wit cards +10%).

## Implementation contract

Modules live in `packages/domain/src/rework/training/`, exported as `@racer/domain/rework/training` (T125's
`./rework/*` entry). `at` is `{ tier, scenario }`, and T = 5(tier − 1) + scenario. State is T125's `rework/types.ts`:
the build is its `UmaBuild` and `Preset`, which this task owns the rules of and may refine.

| Module | Owns | Main exports |
|---|---|---|
| `facilities.ts` | 05 §1 | `FACILITY_UNLOCKS`, `FACILITY_DISH_FAMILY`, `roomAccepts(room, unlock)` over T127's building and room ids |
| `unlocks.ts` | 05 §3, 06 §2 | `Unlock` (`kind`, `target`, `layer`, `grade`, `dishId`), `layerUnlocks(s)` (89 fixed, canonical order), `bondUnlock(card, tier, s)`, `sessionBaseMinutes(g)`, `LAYER_SIZES`, `BONDS_BY_SCENARIO` |
| `order.ts` | 05 §3 | `unlockStatus(build, at, unlock, pending)`, `nextUnlocks(build, at, facility, room, n, pending)`, `remainingUnlocks(build, at, chosen)` (oldest layer first, for T131: bonds for `chosen` cards, "needs a card" for the rest of the pacing count), `layerDone(build, s)` |
| `extra.ts` | 05 §6 | `EXTRA_NODE_IDS`, `extraNodeStats(tier, T, id)`, `EXTRA_CAPACITY`, `EXTRA_HELD` |
| `skill-points.ts` | 03 §8 | `baselineSp(T, opened)`, `reworkSpNodeValue(T)` |
| `bonds.ts` | 06 §2 | `BOND_FAMILY`, `bondGrade(era, tier)`, `bondStatus(build, card, T, pending)` |
| `build.ts` | 03 §6, 06 §3 | `commitUnlocks`, `carryOnAdvance`, `advanceScenario`, the preset operations |
| `sessions.ts` | 05 §2 | `sessionKind`: T127's `WorkKindRules` for `session` |
| `buffs.ts`, `derive.ts`, `docs.ts` | 04 §8, 03 §8 | `REWORK_BUFFS`, `deriveBuild(input)`, the live-block renderers |

**Ids.** Nodes are T129's `n1` … `n28`; the build stores the opened count. Inspiration reuses `INSPIRATION_SLOTS`
(A `parent0`, B `parent1`, A1 `parent0-gp0`, A2 `parent0-gp1`, B1 `parent1-gp0`, B2 `parent1-gp1`) and
`inspirationGoldKey(slot, 0 | 1)` for gold 1 and 2; opened uniques are a list of slots. Extra Stats ids follow 05 §9
(`speed-01` … `speed-09`, `duo-stamina-wit-3` … `duo-speed-guts-5`, `sun-4` … `sun-10`), kept in opening order.

**Order** (05 §3). Observatory: the lowest locked node. Lineage Hall: a grandparent slot needs its parent's slot open;
a unique or gold needs its own slot open, not filled; gold 2 never needs gold 1, B never needs A. Gym: singles in grade
order per stat; a Duo needs both same-grade singles; a Sun its scenario's five. Dojo: none; a bond names its card. A
dependency is met by an opened unlock, by her pending work ahead of it, or by an earlier unlock in the same session. A
later layer is refused: "Opens in scenario 3 · Trackblazer". Canonical order: Lineage Hall as 05 §3's table; a Gym
room by layer, grade, single, Duos in ring order, Sun.

**Sessions on T127's engine.** T128 rebuilds none of start, queue, collect, recall or speed-up. `sessionKind.plan`
checks the request (one facility and room, 1–10 unlocks, each allowed now, none already pending; T127 counts her
earlier entries as made) and returns the items: each unlock's dish as its input and its seconds. `sessionKind.pay`
commits finished unlocks into the build. Whichever of T127 and T128 lands second registers it.

**Commit.** A new node joins all four presets and takes, in each, the set's card with the fewest nodes under its cap
(ties to the earlier slot), or stays empty (03 §6, 05 §4). A new Extra Stats node turns on in every preset with room
(05 §6). A bond adds its card id. The receipt lists every opening and the newly bonded card ids, for phase 3's "ever
bonded" record (06 §7).

**Presets.** `set-card-set`, `set-assignments`, `set-lineage`, `set-active-nodes` and `set-loadout`, each
`(state, input, now) → { state, receipt } | Refusal`. A set takes bonded cards with era ≤ T, no duplicate card or
character, within the per-card cap, on opened nodes only. Replacing a card hands its nodes over; removing one empties
them (D129). Lineage picks go in open slots, from Umas ever owned, never herself, under D250's repeat rules
(`lineageSlotEligibility`) and Legends (`lineageSlotTakesAnyUma`). Active Extra Stats are opened nodes up to the
capacity. A loadout is checked against the derived library and SP (`summarizeSkillLoadout`).

**Advance and promotion.** T125 owns both and cannot import this module. `carryOnAdvance` keeps sets, assignments,
lineage and loadouts and fills raised capacity with opened nodes that were off, oldest first (03 §6).
`advanceScenario` here is T125's advance plus the carry; phase 3 calls this one. T125's promotion empties the build
and bonds (D327) and takes each preset's stats from `deriveBuild` for its history entry.

**Derived stats** (03 §8). `deriveBuild` derives one preset at T. Every card pays 100%: no stars, no CL. Card points
accumulate as exact integers (share × era × buff percentages) and round once. Extra Stats add flat after growth,
unbuffed except by Foundation. Caps clamp. Aptitudes come from filled open slots. An inherited unique pays only once
opened, golds only through opened positions; a single-side grandparent costs 2× SP, a mirror normal SP (D250). Shared
Light ranks card stats only. The result carries the preset's Race Bonus for T125's `applyRaceFinish`.
- **Reuse:** `CARD_TYPE_SHARES`, `cardShares`, `eraPct`, `paysSkillPoints`, `SP_CARD_SHARE`, `BASELINE_SP_SHARE`,
  `CARD_SET_SIZE`, `BUFF_VALUES`, `lineageAptitudes`, `lineageInheritedUniques`, `GRANDPARENT_SP_MULTIPLIER`,
  `ownSkillIds`, `cardGoldSkillIds`, `summarizeSkillLoadout`, `cardRaceBonus(template, MAX_STARS)` (full Race Bonus,
  06 §4); T125's `nodeValue`, `extraNodeValues`, `capProfileAt`, `spCapAt`; T129's sizes and per-card cap.
- **New here** (today's are wired to today's trees, CL and stars): SP from *N*, Extra Stats vectors, buffs, derivation.

**Refusals** use T125's `Refusal` (`code`, plain-words `reason` with placeholders, `data`), never thrown, in one
exported `TRAINING_REFUSALS` table for T131's banned-word test: `later-layer`, `already-open`, `needs-first` ("Needs
Speed grade 1 first"), `wrong-room`, `mixed-facility`, `session-size`, `duplicate`, `card-era`, `already-bonded`,
`not-bonded`, `duplicate-character`, `node-cap`, `node-locked`, `slot-not-open`, `lineage`, `over-capacity`, `over-sp`.

## Tests

Pinning (`rework/training/*.test.ts`):
- Layer counts, 107 a tier, and every fixed unlock's layer, grade, dish id and dependencies; every dish id exists in
  T126's catalogue. Session minutes 180 … 315 and their seconds at speeds 1 and 1.25 (12,960 … 22,680; 10,368 …).
- Extra Stats: 37 ids, each node's stat vector at tiers 1–3 (every node totals 40 × the multiplier), Foundation's
  60/30/12, capacities, and min(capacity, held) equal to T125's `NODES_THAT_CAN_PAY`.
- Baseline SP and SP node values at every T, 03 §8's example (12 open nodes pay 800 SP, a Friend card on two nodes
  adds 1,200), and 06 §2's era-to-grade table for all three tiers with the family per card type.

Behaviour:
- Every order rule both ways; a later layer refused with its name; an earlier layer open after an advance;
  dependencies met inside a session and through a queue, refused across rooms.
- Bonds: past era, bonded or pending refused; a 19th allowed. Sets: unbonded, duplicate card or character and past era
  refused; replace hands nodes over, remove empties them. Commit fills as above, empty and fully capped sets included.
- The advance keeps every card on its node id in all four presets and fills raised capacity oldest first.
- Derivation: exact invariance (moving a card never changes a raw total), every card at 100%, Extra Stats flat and
  unbuffed except Foundation, each reviewed buff, aptitudes, uniques and golds only when opened, full Race Bonus.
- One session per facility through T127's engine: N dishes reserved, each unlock done at its duration ÷ speed, Collect
  commits exactly the finished ones, Recall returns the rest.

**Cross-task acceptance #1 is owned here** (`whole-tier.test.ts`). One synthetic Uma goes from tier 1, scenario 1 to
promotion by operations only, against a synthetic Warehouse of exactly the 107 dishes. Each unlock starts in its own
scenario, a later-layer start is refused, Racing Level reaches 50 and the Expedition run is completed as T125's tests
do (its rules are phase 9). The Warehouse ends empty, so every unlock took one dish of the right family and grade.
Promotion resets her build and bonds; the account's goods carry.

## Live blocks

Renderers in `docs.ts`, wired into `docs/render.ts`; keys are lowercase letters and dashes only (the docs check's
pattern). README "Unlocks per scenario layer": `training-layers`. 05 §1 `training-facilities`; §2
`training-session-times`; §3 `training-layer-grades`, `training-node-grades`, `training-inspiration-grades`,
`training-extra-grades`; §6 `training-extra-nodes`, `training-extra-capacity`. 06 §2 `bond-dishes`, `bond-grades`,
`bond-counts`. 04 §8 `rework-buffs`. T125 renders 04 §7 and 05 §6's extraBudget; T127 renders 05 §7's slots and
prices; T132 renders 05 §7's demand table.

## Acceptance

- `pnpm lint && pnpm test && pnpm build` pass; `git grep "rework/" apps` finds nothing; existing sims print the same.
- Every number above is a named constant with its citation and a passing pin; nothing copies a rule listed under Reuse.
- The whole-tier test passes, and every block above renders with the docs check green over `docs/rework/`.
- The Decided rows go into 05 §11 and 06 §11 with one decisions.md entry, and this spec is deleted (D104).

## Out of scope

Screens and the Card Library; saves, parsers and sync (phase 3); the work engine, buildings and `upgrade` (T127);
items and recipes (T126); trees (T129); careers, Racing EXP, tier scaling, rivals and the buffs' typical values (T125);
the planner and Repeat (T131); achievements; the rework builds against the field, `sim:constellation` and
`sim:careers` on the new trees (T133).

## Decided here

| Choice | Why |
|---|---|
| T128 owns 04 §8's reviewed buffs | They apply only in the derivation (T125 agrees); rivals' typical values stay with T125 |
| Facility slots and prices are T127's; node value, E and Extra values per tier are T125's | One owner per number; T127's and T125's specs already hold them |
| Canonical order: Lineage Hall as 05 §3's table; a Gym room by layer, grade, single, Duo, Sun; the Dojo has none | Repeat and the planner need a "next N"; a bond needs a chosen card (02 §6, T131's "Pick cards") |
| `remainingUnlocks` takes the chosen cards; unchosen bonds count up to the pacing 6/9/12/15/18 | 02 §6 cascades only chosen bonds; the caller (a screen, or T132's deck) supplies the choice |
| Her pending work ahead of an unlock meets its dependency | A queued entry starts when the one before ends, finished but uncollected |
| Reuse today's slot ids and gold keys (gold 1 is index 0) | 05 §9 writes `slot:gold1/2`; one id scheme with `lineage.ts` and `inspiration.ts` |
| The card buff applies to a Friend or Group card's SP, as today | 03 §8 and 06 §1 omit it from the SP formula, but 03 §8 calls Friend and Group "unchanged" and D165 buffs every card node |
| Lineage picks only in open slots | 05 §5 pays "a filled open slot" |
| `advanceScenario` composes T125's advance and the carry | T125 lands first and cannot import this module |
| Cross-task acceptance #2 (demand equals 08 §7) is T132's | 08 §7 puts 9 of 18 bonds at even grades, which 06's era rule can't produce; T132 rewrites 08 §7 |
| 06 §2's "Cards" column leaves the live block for a sentence | It counts the private pack, which code may not render |
