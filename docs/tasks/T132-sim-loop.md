# T132 — `pnpm sim:loop`

**M033 · last task: needs T125–T131 · not started.**

Read:
- [AGENTS.md](../../AGENTS.md) and [M033](M033-rework-rules.md), whose "Fixed choices" bind this task. It closes the
  milestone's cross-task acceptance #2 and #3.
- [rework/12](../rework/12-economy-and-pacing.md) in full; [01](../rework/01-game-loop.md) §4;
  [02](../rework/02-check-ins-and-notifications.md) §3, §6; [03](../rework/03-uma-progression.md) §2, §4;
  [04](../rework/04-tiers-and-promotion.md) §2–§6; [05](../rework/05-training-hub.md) §7; [06](../rework/06-cards-and-bonds.md) §2;
  [07](../rework/07-farm.md) §4, §6–§7; [08](../rework/08-item-catalogue-and-recipes.md) §6–§7;
  [09](../rework/09-racing-rewards-and-exchange.md) §2–§3; [10](../rework/10-expeditions.md) "Targets".
- Decisions D331, D334, D336 and D338, and the T125–T131 specs: their exports are this sim's only rules.
- uma-rpg's H14 ledger, `packages/domain/src/economy/pacing.sim.ts` and its test on uma-rpg's `main`: a pure,
  deterministic sim inside the domain, pinned by a test, printed on demand.

## Goal and fixed scope

A deterministic, seeded, headless run of the whole economy from a fresh account, built only from the phase-2
modules. It proves D334's pacing in CI (12 §12), renders the pacing tables live, and replaces the first-draft Farm
tables with measured ones. It adds no rule. It may retune only through 12 §11's levers, and only if a check fails.

**CI checks** (12 §12, initial tolerances):

| Check | Range | Run |
|---|---|---|
| Days in each scenario of tier 1 | 24–32 | Baseline |
| Days in each scenario of tiers 2 and 3 (buildings at Lv 3) | 20–28 | Baseline |
| Tier 1 | 19–23 weeks | Baseline |
| Every building's and facility's slot use, in every scenario window | ≤ 90% | Baseline |
| Time saved by target / heavy racing | 5–10% / 18–25% | Baseline / heavy |
| Farm Levels a day early in a tier, at C / at A and S | 2–3 / 4–5 | Probe |
| First unlock on a fresh account | ≤ 12 hours | Probe |

## Policies

Policy code lives only in the sim. Each item cites the page that describes the owner's habit.
- **Account** (13 §5): T125's `newAccount`: 20 Uma Tickets, 0 Prize Money, an empty Warehouse, everything at Lv 1.
  Synthetic Uma templates, cards and a race catalogue today's career planner accepts. Each Uma has one distance and one
  running style at A, one of each at B, the rest at C, rotated so every aptitude is A for an equal share of the roster.
- **Roster** (12 §9, 04 §6): 20 Umas on day 0. Shards become tickets as soon as there are five, and the baseline spends
  tickets until the roster is 25, then holds them. The 20 day-0 Umas are the **founding cohort** the checks measure.
- **Check-ins and idle Umas** (12 §12, 02 §3, §6, 01 §4): 08:00, 13:00 and 22:30, local time = UTC (`utcOffsetMin`
  0). Each runs T131's `collect-all`, then `repeat`, then starts T131's `suggest` lines as they are: her own session
  first, then the largest startable shortfall of the first automatic target she can work for. When a fitted job is ×10
  and ends before the next check-in, the rest queues as up to three more entries, as 02 §3's craft row does.
- **Bonds** (06 §2, 08 §7): the representative deck. Scenario 1 bonds one card of each of the six types; scenarios 2 and
  4 a Speed, Stamina and Power card; scenarios 3 and 5 a Guts, Wit and Friend card. Each card is of the scenario's own
  era, so its grade is 2*s*−1, the upper bound 12 §5 prices. They reach the planner as chosen cards through T128's
  `remainingUnlocks`. Each new bond fills an empty slot of her race preset.
- **Racing** (12 §12, D336, 03 §2, §4): an Uma races her career once `layerDone`. At each check-in she runs her next
  unwon goal race, in stage order, then G1s at her distance, until she is at the gate; losses retry. Places come from
  the win table. T125's `applyRaceFinish` and T130's `settleRacePrize` commit each race; the featured board is left out.
- **Racing variants:** *target* is the above. *Heavy* adds G1s at the 22:30 check-in, run by layer-complete Umas, until
  the day holds 40 races. *No pay* races the same careers and discards their Prize Money (a reference only). *As unlocks
  land* lets her race while her share of the scenario's levels is below her share of its layer.
- **Advance and promotion** (03 §5, 04 §3, §5): T128's `advanceScenario` at the first check-in where her layer and
  career are both done. Once Ready for promotion she takes no new work, and T125's `promote` runs at the first
  check-in where T127's `isFree` holds.
- **Expedition** (placeholder until phase 9, M033): 18, 20 and 23 races in tiers 1, 2 and 3 (10's 8 ÷ *p* at 45%, 40%
  and 35%), three a day, once her last career is complete. Eight are wins, the last race being the eighth, the rest at
  seeded positions. Wins pay T130's Expedition rate; the others take the G1 cell's non-win place shares. The run's
  summary is then written as T125's tests write it: the one state edit no rule covers yet.
- **Spending** (12 §12): Prize Money buys every Lv 2 upgrade, then Lv 3 upgrades, busiest building first (T127's
  `upgrade`), then Speed Tickets (T130's `buy`). It saves toward the next upgrade the account can buy, and that upgrade's crafted items join the planner's
  needs first. Tickets go at check-ins to running sessions, then jobs, latest finish first, in whole 30-minute steps
  (T127's `speed-up`). The sim never sells and never buys raw ingredients.
- **Other variants:** one check-in (08:00) or two (08:00, 22:30); roster fixed at 20, 25 or 30 from day 0, or growing
  with no cap; buildings frozen at Lv 1.

## Implementation contract

The pure core lives in `packages/domain/src/rework/sim/` (`@racer/domain/rework/sim`):

| Module | Exports |
|---|---|
| `fixtures.ts` | The synthetic roster, card pool (types × eras, distinct characters, Race Bonus weight 1.0), race catalogue and representative deck |
| `policies.ts` | `LoopConfig` (seed, check-ins, racing, roster, buildings, horizon) and one function per policy above |
| `win-table.ts` | Generated: place shares (1st–5th, 6th and below) per T, grade (G3, G2, G1) and build share (0, 50, 100%, interpolated) |
| `loop.ts` | `simulateLoop(config, rng): LoopResult`, `BASELINE`, and a memoized `loopReport()` |
| `metrics.ts`, `checks.ts` | The report's metrics; `LOOP_CHECKS` (the table above as data) and `evaluateChecks(result)` |
| `demand.ts` | `tierDemand(deck)`: T128's dish per unlock, expanded by T126's `craftedDemand` |
| `docs.ts` | The live-block renderers |

- **Only the rules' own operations.** Every change of state goes through T125–T131's functions, except the
  Expedition summary above. The sim never multiplies by `TIME_FACTOR`.
- **Event-stepped.** Time jumps between check-ins, T127's `settle` points and midnights (the purse), never minute by
  minute. The clock starts at 00:00 on a synthetic date.
- **Seeded.** The core takes an RNG of the race engine's shape (`{ next(): number }`). Scripts and tests pass
  `createRng(seed)` from `packages/race/src/rng.ts`, which imports nothing.
- **The win table** is generated offline by `pnpm sim:loop -- --refresh-wins` and committed. It runs the race engine
  200 times a cell on a 2,000 m `typicalCourse`, for a synthetic Uma with T128's `deriveBuild` (the ladder's Medium set,
  06 §2) and harness's `PLAYER_KIT`, against T125's rival fields at 03 §9's handicaps. Its header records the seed,
  races per cell and engine version.
- **The script.** `scripts/sim/loop.ts` prints the report, with `--variant=<name>`, `--matrix` (each variant axis
  changed alone from the baseline) and `--json`, and exits 1 when a check fails. The root script `sim:loop` follows
  `sim:farm`'s convention (`pnpm --filter @racer/data-pipeline exec node --import tsx ../sim/loop.ts`).

**Report** (12 §12): days per scenario and per tier (cohort median, 10th and 90th percentiles); slot use per building
and facility per scenario window, held and running, with the hours each was the bottleneck (a suggestion or Repeat
refused for want of a slot); idle Uma-hours by reason (no inputs, no slot, waiting for a check-in); weekly Warehouse
stock by family and grade; Prize Money in by purse band and out by upgrade and ticket; Speed Ticket minutes; races a
day; roster, tickets and upgrade dates.

**Measures.** A scenario's days run from her entry to the moment her layer and career are both done; the check reads
the cohort median. A tier's weeks run from her tier entry (day 0 for tier 1) to the cohort's median promotion. Tier 3
has four scenarios until the 15th ships (04 §2). The tier-2 and tier-3 rows also assert that every building and
facility was at Lv 3 when the cohort entered the tier. Slot use is time held (start to collect) ÷ (slots × window), each
window running from the cohort's median entry to its median finish of a scenario. Time saved by racing is Prize Money
paid ÷ Uma-minutes of work done over tier 1 (1 Prize Money ≈ 1 Uma-minute, D331), as 09 §3.4 and 12 §8 compute it.

**Probes.** *Farm Level:* one Uma at a Lv 1 building working without a break, inputs supplied, from Farm Lv 1 to 21,
at C, A and S. *First unlock:* the fresh account from 08:00 on day 0, the owner checking in at every finish until the
first session starts (12 §5's first day); the check reads that session's first finish.

## Tests

`rework/sim/loop.test.ts` runs the baseline (three tiers), the heavy, one- and two-check-in variants for tier 1, and
both probes. It checks every CI range; a deep-equal result for the same seed, and the tier-1 checks on a second seed;
conservation (no stock below zero, every consumed dish cooked, Prize Money in − out = balance, every unlock paid by
exactly one matching dish); and policy units (check-in times, spending order, the ticket rule, the Expedition count,
the purse day). **Cross-task acceptance #2:** `tierDemand` of the representative deck gives 107 dishes (Vegetables 28,
Mushrooms 24, each stat family 8, Grains 3, Duos 8, Feasts 4) and 539 crafted items, and the 89 non-bond unlocks'
cells equal 08 §7.

**Time budget:** the file finishes within 60 s on a GitHub-hosted runner (vitest timeout 120 s), each run under 20 s.
If a run is slower, profile the sim; never thin a policy to fit. The docs check renders from `loopReport()`, one run
per test worker, within the same budget.

## Live blocks and pages rewritten

Keys use lowercase letters and dashes only.
- 12: §5 `loop-scenarios` (the rules' unlocks and Uma-hours, the measured days), §6 `loop-farm-levels`, §7
  `loop-capacity`, §8 `loop-racing`, §9 `loop-roster`, §11 `loop-utilisation` (one, two and three check-ins at target
  racing, three with heavy; its model rows go), §12 `loop-checks` (each range, the measured value, pass).
- 07 §4's day columns (`loop-farm-levels` again: 864 Farm minutes a day at ×1.0, ×1.3, ×1.6, plus the cohort's
  measured median day per grade), 07 §6 `loop-farm-slots` and 05 §7 `loop-hub-slots` (hours a day, slots needed, use at
  peak). Slot counts stay T127's design numbers.
- 08 §7 `demand-dishes`, `demand-crafted` and `demand-by-scenario`, from `tierDemand`. Bond cells follow 06's era rule,
  so 9 of the 18 bonds move from even grades to odd ones; totals hold. T126's demand test inputs follow the new table.
- The prose of 07 §6, 08 §7 and 12 §5–§9 is rewritten around the measured numbers: 12's header and 07 §6's banner
  drop "still the first draft's", and the dates of the first Lv 2 upgrades are stated as measured.
- One decision (the next free number) pins the measured numbers, the 08 §7 correction and any lever moved.

## Tuning rule

Only when a check fails, and only in 12 §11's order: the time factor *k*; layer sizes; crafted items per dish;
utilisation (policy only); Prize Money per race (09 §2.2's single prize factor and 09 §3.4's 6,000 purse edge). Each
change lands with its page, its pinning test and the decision. No other number moves and no range widens. If no lever
fixes a check without breaking another, that check is marked `it.fails` with the measured miss (H14's known-miss
pattern), and the decision and `docs/open-questions.md` carry a recommendation for the owner.

## Acceptance

- `pnpm sim:loop` prints the report and exits 0; the loop test passes within its budget in CI.
- Cross-task acceptance #2 and #3 pass. `pnpm lint && pnpm test && pnpm build` stay green, existing sims print the
  same, and `git grep "rework/" apps` finds nothing.
- Every block above renders, the docs check passes, the decision is appended, and this spec is deleted (D104).

## Out of scope

World Expeditions' rules and `sim:expeditions` (phase 9, which replaces the placeholder count); push notifications;
any new rule; a time factor per tier; selling, raw purchases and featured races in the policy; the rework builds
against the field (T133); screens and saves.

## Decided here

| Choice | Why |
|---|---|
| The baseline grows from 20 to a roster of 25; fixed rosters are variants | 13 §5 starts with 20 tickets and 0 Prize Money, and Lv 1 is sized for 20, Lv 2 for 25 (05 §7, 07 §6): 25 on day 0 overloads the Kitchen before racing pays |
| Checks read the founding cohort's median; the 90th percentile is reported | The cohort travels together, and "furthest behind first" keeps the spread small |
| Racing share is Prize Money paid ÷ work minutes; the no-pay counterfactual is reported | 09 §3.4 and 12 §8 compute it so; a counterfactual would also count upgrades as racing |
| Expedition placeholder: 18/20/23 races at three a day, eight wins | 10's targets and 12 §9's "about 20 races" |
| The win table is generated offline and committed | The domain can't import the race engine, and 200 races a cell would break the CI budget |
| The first-unlock probe checks in at every finish on day 0 | Fixed check-ins can't reach 12 hours: the chain alone is about 11 hours at *k* = 1.2 (12 §5) |
| The Farm Level probe measures Lv 1 → 21 at a Lv 1 building | "Early in the tier": with T127's EXP per listed minute it gives about 2.7, 4.4 and 4.9 a day at C, A and S; over only the first levels S passes 5 |
| Slot use counts time held until Collect | 12 §7: a slot idles until the next check-in, as its Uma does |
| Spending saves toward the next buyable upgrade, whose items the planner makes first | "As affordable" otherwise never saves; 05 §7 and 07 §7 price upgrades in crafted items |
| Bonds at the scenario's own era (grade 2*s*−1), passed to the planner as chosen cards; 08 §7 rewritten to match | 06's era rule allows only odd grades; 12 §5 prices bonds so; 02 §6 cascades only chosen cards |
| Featured races are left out | Neither 12 §8's model nor §12's policy counts them; leaving them out understates racing, so the checks stay honest |
| Cross-task acceptance #2 lives here | It needs T126's recipes and T128's dishes, and 08 §7 changes here |
