# T118 — Pure Farm catalogue, production rules and balance witnesses

**M031 · first task · no implementation yet.** Deliver one green PR to main; merge before T119.
Read AGENTS.md, README.md, task index, [M031](M031-farm-kitchen-rework.md),
[design §§3–12](../design/farm-kitchen-rework.md), [technical §§1–3,8–9](../technical/farm-kitchen-implementation.md),
[research](../research/farm-kitchen-games.md) and decisions D294–D299. Recheck current main before choosing
module/export names and the next decision number.

## Goal and fixed scope

Build the original scenario-food catalogue and pure rules that every later layer will call. Verify production
can fund a whole block map on the road to personal Lv 50, without making Farm a thousand-point racing boost.
Keep existing Farm code/caps/card values and all live behaviours unchanged; new rules are additive and dormant.

- Thirty immediately available stations; one owned outfit/spot, one spot/outfit; no expertise/expansion tracks.
- Original 14-scenario food rows from design §6, equally distributed across all five stats. No private datasets.
- Personal 24 EXP/level, 12 EXP/completion; six-hour raw/process/cook jobs; raw 6, process 6→6, cook 1–4.
- Raw scenario flavours at 1+10×(index−1); block eligibility 1/51/101; shared processing 6/56/106 and cooking 9/59/109.
- Five pure + ten pair + one Sun meal/block; processed potency is ingredient identity, never a node multiplier.
- 65 nodes, 20 total points each, capacity 18+2×(index−1), existing caps, flat post-growth/pre-cap Farm vector.
- Energy 30 minutes on one running job; debug grant 50; no automatic collection/restart or input borrowing.

Baseline numbers may be tuned **only** if the required witness fails or a reported balance result justifies it.
Update design/pins/envelopes/new decision together. Do not solve gaps by changing cards/caps/racing or claiming
the owner's 1,600-Speed example must fit tier 1. A separate design expansion needs owner direction.

## Implementation contract

### Modules and catalogue

Create `packages/domain/src/farm/kitchen/{types,rules,catalogue,progression,production,extra-map}.ts`, or equally
small focused modules, with design headers and a lazy `@racer/domain/farm/kitchen` export. Keep React, I/O,
Date.now, Dexie, browser globals and `Math.random` out. Pure timing takes explicit integer `now`.

Catalogue definitions carry stable item/recipe IDs, stat/signature, source scenario, block, family, raw gate,
canonical input family, output quantity/EXP and rules version. Processed recipes bind exactly one raw scenario
variant; kitchen slots choose any legal same-stat raw/processed item within the block. Freeze chosen IDs/amounts.
Return typed errors for wrong family/stat/block, insufficient stock, unregistered scenario and unsafe integers.
No permissive arbitrary `{stat,potency}` input lets an unknown item become legal.

Materialize 490 raw +630 processed +48 meal +1 Energy definitions for the present 14 scenarios. Names come from the
original design table and bounded family naming; scenario labels come from the registry. Adding a registered
scenario adds 35 raw/45 processed, but only a new five-scenario block adds 16 meal definitions. Do not generate s15
now. Tests use small invented shapes/IDs; these original authored foods are design code, not imported fixtures.

### Pure production

Implement assignment/move/remove, eligibility, start, ready/remaining projection, claim, Energy and job receipt
helpers over the planned immutable shapes. Separate semantic effects from persistence wrappers. Start outputs
the exact input debit and frozen job; Claim outputs stock/worker/milestone/cookbook effects. Identity includes
generation/station/attempt; retries and old-generation evidence are later protocol responsibilities, not RNG.
One claim awards 12 EXP even for four meals. Busy/Ready workers cannot move/cancel; ready jobs wait indefinitely.
Energy clamps remaining time to zero and exposes wasted minutes; Start/energy/purchases award no EXP.
Each Claim evaluates the resulting worker level for all registered block milestones, including when an old-
block job passes a new threshold or the worker already exceeds it. No all-worker scan or repeated crossing gate.

### Extra map and stat helper

Author deterministic names/positions for 50 single nodes, all 10 unordered stat pairs and 5 central Suns. IDs/order
are stable across blocks; bought IDs are separate from active scenario/preset selections. Pure purchase validates
a matching one-meal signature and real target block; activation validates ownership/unique IDs/capacity and
changes no inventory. Any node can be bought first; no adjacency/index purchase prerequisite.

Provide a pure flat Farm-vector/cap-aware preview helper for T123, retaining pre-cap base/card values so Farm is
added **before** the final cap/round. Do not mutate the current deriveStats path in this task. Pin that a full
map is 260/stat, scenario 1 max one stat 256, and each active node totals 20, regardless of its shape. A future
registry capacity beyond 65 fails a coverage assertion pending deliberate design extension.

## Sims: small, deterministic and honest

Add `scripts/sim/farm-kitchen.ts`, `farm-kitchen-stats.ts` and commands `pnpm sim:farm:kitchen` /
`pnpm sim:farm:stats`, using existing tsx/runtime conventions, no dependency. Drive the public pure rules with
invented outfits/cards and explicit time. Event-step between check-ins/deadlines; no huge stochastic sweep.

1. Canonical exact-map conservation: 40 raw/20 processing/27 cooking = 87 jobs, 65 meals, 1,044 EXP→Lv 44/remainder 12.
   Verify each stat needs 10 vegetables/9 fruit/24 milk, uses 19 of 24 cheese and equal rounded surplus. Require ≤ 98
   successful completions without Energy; 16 initial raw jobs open cooking and avoid eligibility deadlock.
2. Personal 98 jobs toLv 50; two/three/four daily completion policies report actual elapsed/idle time, never
   personal days divided by worker count. Assert EXP arithmetic separately from clock/check-in rounding.
3. Solo sequential producer, smaller crew, fixed 6/6/6/6/6 specialists and a staggered 30-outfit cohort. Show
   first recipe milestones, first/full map, per-worker levels, stock deficits and queue idle time at two/day.
   Staffed/supplied kitchen lower bound 27 jobs/12 daily is not a fresh-account calendar promise.
4. Repeat through three blocks, lower-level specialist using later same-block variants, alternative ingredient
   families, partial quantities and banquet-only stress. Run no-Energy and one fixed declared Energy budget;
   no free inputs or helper XP. The pooled 30-map static witness must still fit each section's 588 job capacity;
   report variant fragmentation/rounding as well as totals.
5. Stat matrix: all 14 tiers, 2 Speed+1 flex(Stamina/Power/Guts)+2 Wit with the current sixth SP-slot convention,
   low/mid/max global stars and neutral/one declared synthetic growth profile. Show card-only/partial/full
   Farm, per-distance target allocations, raw/post-growth/Farm/cap waste and Foundation comparison. Exact
   card-only equality is mandatory; report remaining cardless gaps rather than inventing a success target.

Record measured outputs/assumptions in `docs/research/farm-kitchen-balance.md`; set a tight deterministic
regression envelope from the measured schedule after verifying the policy. Do not tune bots solely to make
an arbitrary date green. Existing `sim:farm`, constellation and career envelopes still measure shipped rules.

## Tests and acceptance

- Catalogue coverage/unique IDs/registry order, equal family/stat counts, every scenario's named variety,
  all milk/cheese lanes, future appended scenario, B1/B2/B3 separation and dependency DAG conservation.
- Lv 1/6/9/11/41/50/51/56/59/101/131 boundary cases, overflow, old-block EXP, no level cap, milestone monotonicity.
- One-station ownership, moving idle/busy/ready, six-hour frozen deadline, backward/forward clock, refresh JSON
  round trip, quantity 1–4, exact start debit/claim credit, no EXP from output count, Energy clamp/waste.
- All 65 nodes and 16 signatures, pair symmetry/Sun total, unbought/duplicate IDs, wrong block, capacity boundaries,
  purchase without activation, four independent presets and no cross-outfit unlock.
- Source guard excludes I/O/React/unseeded randomness; parsers reject malformed/future shapes and unsafe values.
- `pnpm lint && pnpm test && pnpm build`; old `sim:farm`, `sim:constellation`, `sim:careers` plus both new sims.
  Report startup gzip ≤ 180 KB and confirm the large new catalogue is not in startup.

Update matching new constants in `packages/domain/src/domain.test.ts`, design §§4–11, standing technical §§2,8–9
and a new next-free decision. This task is done when the rules/sim contract is real and pinned, not when a
fixture-only placeholder catalogue compiles. Delete this spec under D104 and update M031/index links/status.

## Explicitly out of scope

No actual owner save, API/DB migration, release flags, UI, manual reset/grants, asset import, card/race changes,
infrastructure or global dependency. T119 owns persistence; T124 owns enabling the complete replacement.
