# T125 — Tiers and progression

**M033 · first wave, parallel with T126 and T129 · not started.** One pull request (or commit series), green before
T127 and T128 build on it.

Read:
- [AGENTS.md](../../AGENTS.md) and [M033](M033-rework-rules.md), whose fixed choices bind this task.
- The rework [README](../rework/README.md), [03](../rework/03-uma-progression.md) §1–§7, §9 and §10,
  [04](../rework/04-tiers-and-promotion.md) §1–§7 and §10, [05](../rework/05-training-hub.md) §6 and §9, and
  [13](../rework/13-removals-and-plan-changes.md) §2 and §6.
- Decisions D191, D327, D328, D332, D336 and D338.

## Goal and fixed scope

The rules that move one Uma through her tier, and the account's Uma Tickets, as pure functions in
`@racer/domain/rework/tiers`, plus the groundwork the other M033 tasks build on. Nothing live changes.

- **Tier map** (04 §1–§2, D327): 3 tiers of 5 scenarios, T = 5(*t* − 1) + *s*; tier 3 has 4 until a 15th exists.
- **Racing Level** (03 §2): 1–50 a tier on today's curve (1,800 EXP a scenario, D241) and EXP per finish; holds at
  levels 2 and 5 of a scenario; a gate banks up to 100; the tier's last gate stops EXP. Lifetime = 50(*t* − 1) + level.
- **Careers** (03 §4), **advancing** (03 §5, free, bank applied), **promotion** (04 §3–§5), **Hall of Fame** (04 §10),
  and a stand-in Expedition that phase 9 replaces (8 wins complete a run, D332).
- **Uma Tickets and Shards** (04 §6, D336): 20 at the start; 1 Shard per gate per Uma per tier; 5 Shards a ticket;
  1 ticket per promotion and per induction; a ticket unlocks an unowned Uma into tier 1 only.
- **Tier scaling** (04 §7): caps with row 15 (2,600 / 1,750 / 1,800 / 1,700 / 1,650, SP cap 5,200); Extra Stats node
  values 40 / 20 + 20 / 8 × 5, ×1.25 and ×1.5 (D338); E = 200 … 900; node value = round((0.60 × capBudget − E) / *N*);
  rival strength on the new trees (03 §9).
- **Groundwork** (M033): `rework/types.ts`, `rework/time.ts`, the `./rework/*` export and the docs check over
  `docs/rework/`. If T126 or T129 landed first and added any of these, T125 keeps it and completes it to this contract.

## Implementation contract

**Export.** One entry `"./rework/*"` in `packages/domain/package.json`, with the existing conditions: `require` →
`./dist/cjs/rework/*/index.js` (and `.d.ts`), `default` → `./src/rework/*/index.ts`. So `@racer/domain/rework/<area>` is
the area's `index.ts`, as T126–T128 assume. `types.ts` and `time.ts` sit beside the areas and are imported relatively;
`rework/tiers/index.ts` re-exports both for `scripts/sim`.

**`rework/time.ts`.** `TIME_FACTOR = 1.2` (D338), `SECONDS_PER_MINUTE = 60`, `MS_PER_SECOND = 1000`, and
`workSeconds(baseMinutes, speed = 1)` = round(round(baseMinutes × TIME_FACTOR × 60) ÷ speed), the signature T127 calls
(speed 1 or 1.25, 05 §2). `secondsToMs(s)`. A negative or non-finite argument, or a speed ≤ 0, throws `RangeError`.

**`rework/types.ts`**: plain readonly state shaped after 13 §6.
- `Refusal { refused: true; code; reason; data? }`: plain words with `{uma}`-style placeholders the screen fills
  (02 §9), the shape T127 and T130 use. `OpResult<R> = { state: ReworkState; receipt: R } | Refusal`.
- `Tier` (1–3), `ScenarioOfTier` (1–5) and `ScenarioAt { tier; scenario }`, which T128 takes as `at`.
- `ReworkState { profile; umas: Record<outfitId, UmaState>; work: Record<outfitId, unknown>; ledger: LedgerEntry[] }`.
  T127 narrows `work` to its `WorkRow`; other tasks add their own parts (the Warehouse, buildings). T125 never reads or
  writes a part it doesn't name, which is how the account carries at promotion.
- `AccountProfile { generation: 2; createdAt; umaTickets; umaShards; prizeMoney; featuredUmaId | null }`; T130 and T131
  add their fields. `LedgerEntry { id; resource: 'uma-tickets' | 'uma-shards'; delta; reason; at }`; others widen it.
- `UmaState` extends `ScenarioAt` with `outfitId; racing: { level; exp }; farm: { level; exp }; career:
  ScenarioJourney; closedCareers; build: UmaBuild; expedition: { runs: ExpeditionRun[] }; tierHistory; raceDefaults:
  { preferences: RacePreferences | null; selectedPreset }; hallOfFame: { inductedAt } | null`. `racing.exp` holds any
  banked EXP, as today; Farm EXP's units are T127's.
- `UmaBuild` (opened node count, Inspiration slots, uniques and golds, Extra Stats nodes oldest first, bonds, and a
  `Preset` per distance: card set, assignments, lineage, active Extra nodes, loadout; 05 §9, 03 §6) and
  `emptyBuild(uniqueSkillId)`, whose loadouts hold her unique (04 §4). T128 completes both in place, as its spec says.
- `ExpeditionRun { expeditionId; races; wins; completed }` (04 §3's summary; phase 9 adds the rest) and
  `TierHistoryEntry { tier; promotedAt; finalRacingLevel; presets (stats, skill points, card set); bonds; runs }`.

**`rework/tiers/` modules.** Every number is a named constant citing its page.
- `map.ts`: `TIERS = 3`, `SCENARIOS_PER_TIER = 5` (D327), `RACING_LEVELS_PER_TIER` = 5 × `LEVELS_PER_SCENARIO`;
  `ScenarioCatalogue { scenarioCount: 14 | 15 }` with `TODAY_CATALOGUE` from `MAX_SCENARIO_TIER`; `scenarioNumber`,
  `tierOf`, `scenariosInTier(t, catalogue)`, `gateLevel(s) = 10s`, `lastGate(t, catalogue)`, `lifetimeLevel`, and
  `scenarioRow(T)` (name and JP release from today's `SCENARIOS`; row 15 reads "Japan's next" with no date).
- `scaling.ts`: `capProfileAt(T)` and `spCapAt(T)` call today's `capProfile` and `skillPointCap` up to T = 14 and
  return `FIFTEENTH_CAPS` and `FIFTEENTH_SP_CAP` at 15, so today's clamp to 14 is never hit; `capBudgetAt`.
  `EXTRA_NODE_VALUES_TIER_1 = { single: 40, duo: 20, sun: 8 }`, `TIER_MULTIPLIER_PCT = [100, 125, 150]`,
  `extraNodeValues(t)`; `FULL_ACTIVE_EXTRA_NODES = [5, 9, 11, 13, 15]` (04 §7: scenario 1 holds only 5 against a
  capacity of 7); `extraBudget(t, s)` = nodes × 40 × pct ÷ 100; `nodeValue(T)` with today's `TREE_BUDGET_SHARE`. *N*,
  fair share and the per-card cap come from T129's leaf `rework/constellation/sizes.ts`.
- `rivals.ts` (04 §7, 03 §9): `rivalTrainedStat(T)` is today's `trainedStat` formula on the new trees:
  `TYPICAL_BASE_STAT` + ((*N* − fair share) × node value × 84% + E) × (1 + the buff's typical value) ÷ 5. Typical
  values are today's `scenarioBuff(T).typical`, the draft until `sim:careers` re-measures them (04 §8); T = 15 has none
  yet and throws. `rivalFieldStat(T, catalogue)` keeps D191's minimum over T and every later scenario in the
  catalogue. `rivalPresetAt` and `rollRivalFieldAt` spread and roll it as today's `rivalPreset` and `rollRivalField` do.
- `career.ts`: `freezeCareer(uma, T, content)` calls today's `planScenarioCareer` on `careerView(uma, T)`: a today's
  `UmaSave` with her `templateId` and `racePreferences`, the lifetime level of the scenario's first level, and neutral
  other fields. Lifetime level equals today's Uma Level for the same scenario, so today's level helpers take it
  unchanged. Aptitudes are today's `lineageAptitudes` over her selected preset's lineage. `settleGoalWin(career,
  raceId, resultId, at)` marks a won goal or series leg.
- `racing.ts`: `addRacingExp(uma, exp, catalogue)` and `applyRaceFinish(state, { umaId, raceId, resultId, grade,
  placement, raceBonus }, now)`. Goals settle first; then today's `raceExp` walks the curve under today's
  `careerHoldLevel` (D137). A level-up onto a gate pays 1 Shard once, under today's `umaGateShardLedgerId(umaId,
  lifetime gate)`. It never refuses for work (D328). T130 adds Prize Money to the same commit.
- `roster.ts`: `newAccount(now)` (20 tickets, ledger `initial-uma-tickets`); `unlockUma` (1 ticket, ledger
  `unlock-uma:{outfitId}`; T1 · s1 · Racing Lv 1 · Farm Lv 1, `emptyBuild`, a frozen career, featured if no Uma is);
  `exchangeShards` (5 → 1, with today's `nextUmaShardExchangeSequence` and its `:shards` / `:coupon` ledger pair).
- `advance.ts`: `advanceReadiness` and `advanceScenario`. Conditions (03 §5): at gate 10*s*, career complete, not the
  tier's last scenario. Effects: scenario + 1; Racing Lv 10*s* + 1 at EXP 0, then the bank through `addRacingExp` under
  the new career's holds; the old career closed into `closedCareers`; a new one frozen. Build, Farm, work and Expedition
  stay as they are.
- `promotion.ts`: `canStartExpedition` (last scenario, last gate, career complete), `promotionReadiness`, `promote` and
  `induct`. `promote` needs tier 1 or 2, a completed run and no work row (a stand-in that T127's `isFree` replaces). It
  closes the career, writes a `TierHistoryEntry`, resets 04 §4's left column, starts her at tier *t* + 1 · s1 · Lv 1
  with a fresh career, and pays 1 ticket under `promotion-uma-ticket:{umaId}:{tier}`. `induct` needs tier 3 and a
  completed run (04 §2 lets one finish from scenario 14), resets nothing, and pays under the same id with tier 3.
  Receipts name the awards `promoted-tier-2`, `promoted-tier-3` and `hall-of-fame`.
- `expedition.ts`, the stand-in: `recordExpeditionRace(state, { umaId, expeditionId, won }, now)` needs
  `canStartExpedition`, counts races and wins on her open run, and completes it at `EXPEDITION_WINS = 8` (D332). In
  tier 3 that same call inducts her (04 §10). Distinct race families, pools and fields are phase 9's.

**Inputs, refusals, determinism.** Operations have M033's shape. Content arrives as `{ umas: ReadonlyMap<id,
UmaTemplate>; races }`. A missing template or a non-integer `now` throws `RangeError`, since phase 3's parsers keep them
out. Rule failures are refusals, listed in one exported `TIER_REFUSALS` table for T131's banned-word test:
`unknown-uma`, `not-at-gate` ("{uma} needs Racing Lv {level} first."), `career-open`, `last-scenario`,
`scenario-not-playable`, `no-expedition`, `run-complete`, `busy`, `use-hall-of-fame`, `owned`, `no-ticket`, `shards`,
`inducted`. Payments are once-only by ledger id. The same state, input and `now` give the same result; inputs are never
mutated; randomness comes only through the rival roll's seeded RNG.

**Imported, never copied:** `SCENARIOS`, `LEVELS_PER_SCENARIO`, `MAX_SCENARIO_TIER`, `skillPointCap` (scenarios.ts);
`capProfile`, `TREE_BUDGET_SHARE`, `HISTORICAL_CARD_NORMALIZATION`, `starNodePct` (constellation.ts);
`expToNextUmaLevel`, `raceExp`, `GATE_SHARD_REWARD`, `umaGateShardLedgerId` (progression.ts); `UMA_SHARDS_PER_COUPON`;
`nextUmaShardExchangeSequence`; the career planner and helpers; `lineageAptitudes`; from opponents.ts the typical-Uma
constants, `GRADE_HANDICAP`, the spread profiles, `fullSpurtStamina`, `rollStyleCounts` and `rollRivalStats`;
`scenarioBuff`; today's types. Never used: `umaPromotionCost` and the level-up Training Ticket.

## Decided here

1. **Gates pay Shards.** 03 §2 and its §11 row say the gate's Uma Shard is gone; D336, 04 §6 and 13 §2 say each gate
   pays one. D336 wins, and this PR corrects both lines of 03.
2. **Ledger ids.** Gate Shards reuse today's builder with the lifetime gate (10 … 150), unique per gate per tier.
   `exchange-shards` is its own operation, one ticket a time as today: 04 §6 makes it explicit, 13 §6 and M033 omit it.
   Unlocks use `unlock-uma:{outfitId}`.
3. **The bank applies at the advance** (03 §2, §5). Today's `advanceScenario` sets EXP to 0; the rework doesn't copy it.
4. **Ports, each proven by a parity test.** Today's `addUmaRaceExp` and `evaluateScenarioGoals` take today's whole save,
   and the first stops at Uma Level 140, not at each tier's last gate. Today's `rivalPreset` and `rollRivalField` read
   today's trees. `addRacingExp`, `settleGoalWin`, `rivalPresetAt` and `rollRivalFieldAt` restate their rules; career
   generation and every constant are imported.
5. **Career aptitudes** come from the selected preset's lineage, as from today's active preset (D252).
6. **Promotion history's stats** come from the caller (T128's derived stats); T125 can't derive stats.
7. **Shared numbers.** T128's Extra Stats map and capacity must reproduce `FULL_ACTIVE_EXTRA_NODES`. Tree sizes and the
   per-card cap live in T129's leaf `sizes.ts`; whichever task lands first creates it as T129 specifies.
8. **Owners.** The Extra Stats capacity fill at the advance (03 §6) is T128's, which extends `advanceScenario`. The
   reviewed buffs (04 §8) are T128's (M033). Re-measuring their typical values for rivals belongs with T133's builds
   against the field; until then rivals use today's values.
9. **The 15th.** Today's planner knows 14 scenarios, so a career at T = 15 refuses `scenario-not-playable` until the
   catalogue has it (phase 5). The 14 → 15 rule is tested up to `advanceReadiness`.

## Tests

Beside the modules, in `rework/**/*.test.ts`. Expected values are literals from the rework pages.
- **Pins.** `TIME_FACTOR` 1.2; `workSeconds` 180 → 12,960, 315 → 22,680, 22.5 → 1,620, 240 → 17,280, 180 at speed
  1.25 → 10,368. 04 §1's 15 rows; 04 §7's caps (rows 1–14 identical to today's); Extra values 40/20/8, 50/25/10,
  60/30/12; E's 15 cells; node values 283, 212, 173, 147, 129, 342, 253, 205, 173, 150, 400, 294, 237, 199, 171;
  |*N* × node + E − 60% of budget| ≤ *N*/2. Rival trained stat 646.06 at T = 1, 728.46 at 5 and 979.17 at 14, and every
  other T. Tickets 20 / 1 / 1; 1 Shard a gate; 5 a ticket; 8 Expedition wins.
- **Time guard.** Outside `time.ts`, no `rework/` source has `1.2` as a numeric literal in code.
- **Racing.** 1,800 EXP a scenario in every tier; holds at levels 2 and 5; a gate banks at most 100; tier 1 stops at 50,
  tier 3 at 40 with 14 scenarios and at 50 with 15; the winning race releases its hold. Parity with `addUmaRaceExp` at
  every lifetime level 1–139 except 50 and 100. Shards: five a tier in tiers 1 and 2, four in tier 3 with 14
  scenarios, never twice for one gate, and again for a promoted Uma's tier-2 gates.
- **Careers.** The career for T equals the planner's for a full today's Uma at the same level; tier 2 · s1 gets
  scenario 6's rotation; `settleGoalWin` equals `evaluateScenarioGoals` on synthetic single and series careers.
- **Advance.** Each condition refuses with its own reason; nothing is spent; a bank of 100 lands her on 10*s* + 2; the
  old career is closed and kept; build, Farm, work and Expedition are deep-equal before and after.
- **Promotion.** Refused with no completed run, with a work row, and in tier 3. It resets exactly 04 §4's left column
  and keeps the middle; every other state part stays reference-equal. A second payment under the ticket's id pays
  nothing. The history holds the caller's stats, card sets, bonds and run summaries; the Expedition is cleared.
- **Expedition and induction.** A run completes on its 8th win and refuses more races; tier 3's 8th win inducts in the
  same call, with no reset and one ticket; with 15 scenarios an inducted Uma passes `advanceReadiness`.
- **Rivals.** Fed today's trained stat, `rivalPresetAt` and `rollRivalFieldAt` equal today's functions for T = 1–14
  with the same seed. The field stat never exceeds a later scenario's.
- **Roster.** 20 tickets and one ledger row at the start; `unlockUma` refuses `owned` and `no-ticket`; the exchange
  refuses under 5 Shards and numbers its rows as today. **Purity:** deep-frozen inputs; no `Date.now`,
  `Math.random` or I/O under `rework/tiers`.

## Live blocks

Rendered by `packages/domain/src/docs/render.ts`, each replacing a hand-typed table. The first `pnpm docs:update` may
change formatting but no number; a changed number means the page was wrong, so report it rather than change the rule.
- `tier-map`: 04 §1. `tier-caps`, `tier-extra-values` and `tier-node-values` (with the 240-term column): 04 §7.
- `tier-extra-budget`: 05 §6's extraBudget table. `uma-tickets`: 04 §6's sources, as source, amount and ledger id.
- `racing-curve` and `racing-exp`: 03 §2's two tables.

`docs.test.ts` checks `docs/game/*.md` and `docs/rework/*.md`, requires live blocks in both folders, and
`pnpm docs:update` rewrites both.

## Acceptance

- [ ] `@racer/domain/rework/tiers` exports this contract; `rework/types.ts` and `rework/time.ts` exist as above.
- [ ] Every number is a cited constant pinned beside its module, and every test above passes.
- [ ] The eight live blocks are in place, the docs check covers `docs/rework/`, and `pnpm docs:update` leaves no diff.
- [ ] `pnpm lint && pnpm test && pnpm build` are green, the 180 KB budget holds, existing sims are unchanged, and
  `git grep "rework/" apps` finds nothing.
- [ ] 03 §2 carries its correction; the Decided rows go into 03 §11 and 04 §12 with one decisions.md entry; this spec
  is deleted (D104).

## Out of scope

- Farm Level and Farm EXP rules, work rows and `isFree`: T127. Layers, sessions, the Extra Stats map and capacity,
  bonds, presets, buffs and derived stats: T128. Trees: T129. Prize Money: T130.
- Expedition rules, pools, distinct families, fields and difficulty: phase 9. Badge definitions, Prestige and flair
  events: phase 3. Re-measuring buff typical values and careers on the new builds: T133.
- Saves, parsers, retries by operation id, screens, and any change to today's modules or their pinned numbers.
