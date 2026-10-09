# Farm kitchen — T118 balance witnesses

**2026-10-09 · D304 · additive rules only.** All crews, clocks, owned outfits, cards and growth profiles are
invented. No owner save, private roster or content pack supplies these new simulations. The original foods are
the definitions in [design §6](../design/farm-kitchen-rework.md#6-raw-catalogue).
The live Farm/Extra implementation is unchanged; T119–T124 still own persistence, UI and production activation.

## Reproduce and regression gates

`pnpm sim:farm:kitchen` and `pnpm sim:farm:stats` use the existing workspace tsx runner, without installing a
dependency or requiring network. `-- --json` prints the measured report; the stat sim's `-- --matrix` additionally
prints every measured build, not only summary/sample rows. Strict standalone TypeScript checking:

```sh
pnpm --filter @racer/data-pipeline exec tsc --noEmit --strict --noUncheckedIndexedAccess --target ES2022 --module ESNext --moduleResolution Bundler --esModuleInterop --skipLibCheck --typeRoots node_modules/@types --types node ../sim/farm-kitchen.ts ../sim/farm-kitchen-stats.ts
```

Both scripts pin the complete deterministic report with SHA-256, alongside readable workload/time assertions:

| Envelope | SHA-256 |
|---|---|
| Production | `99fc49c3909c9ccb504789c17c0f3979e0b413a95d128c9473098c7f3b7fb144` |
| Stat matrix | `965ab0db062d575ffcc864a3e2d90887691f7cb5d3fd249a4831610276f62c13` |

Changing a policy/constant intentionally requires reviewing its new output and updating this evidence,
design/pins and a new decision together. Do not widen a gate just to hide a failure.

## Material conservation and check-in policy

Start debits actual selected stacks, Claim credits frozen outputs/12 EXP, and each actual map purchase consumes
one matching meal. The simulation calls the public production/purchase functions; no future output is borrowed.
Stock begins empty; shared milestones begin empty. Two daily checks are 08:00/20:00, three 07:00/15:00/23:00,
four 00:00/06:00/12:00/18:00. Ready jobs wait until the next check; there is no automatic restart/collection.
Days below are elapsed from the first Start, not inclusive calendar-day labels.

The planner gathers the exact canonical bill, chooses vegetable for pure bowls and fruit for pair/Sun recipes,
and makes cheese from milk. It queues per-stat raw/processing jobs, then the sixteen meal recipes. Specialists
take the earliest eligible supplied job in their district; a solo worker moves between idle stations. Raw and
processed identities are retained. Ingredient alternatives are separate probes, not interchangeable fake points.

| Per-stat item | Produced | Consumed | Remaining |
|---|---|---|---|
| Vegetables | 12 | 10 | 2 |
| Fruit | 12 | 9 | 3 |
| Milk | 24 | 24 into processing | 0 |
| Cheese | 24 | 19 | 5 |

All five stats match: **40 raw +20 processing +27 cooking =87 claims**, exactly 65 purchased nodes/meals,
1,044 EXP, **Lv44 +12 remainder**. Surplus is 25 raw +25 processed units. The complete map fits within the
98-claim Lv50 budget with eleven claims spare. A separate all-raw timing probe checks shared processing on
claim10 (Lv6) and cooking on claim16 (Lv9); both may also be opened by any qualifying old-block claim.

| Crew / policy | Maps | First meal (days) | First / all complete maps (days) | Final worker levels |
|---|---|---|---|---|
| Solo, two/day | 1 | 30.5 | 43.5 /43.5 | 44 |
| Solo, three/day | 1 | 20⅓ | 29 /29 | 44 |
| Solo, four/day | 1 | 15.25 | 21.75 /21.75 | 44 |
| Five, one worker/district, two/day | 1 | 8.5 | 21.5 /21.5 | 6 /6 /11 /11 /14 |
| Thirty, six/district, two/day | 30 | 8.5 | 46.5 /49.5 | Garden21–22, Orchard19–20, Barn/Workshop40–41, Kitchen41–42 |
| Staggered thirty, two/day | 30 | 8.5 | 60 /63 | 2–58; individual levels retained in JSON |
| Five +50 Energy, two/day | 1 | 8 | 21 /21 | 6 /6 /11 /11 /14 |
| Solo, egg→mayonnaise alternative | 1 | 30.5 | 43.5 /43.5 | 44 |
| Five, later same-block variants | 1 | 1.5 | 15 /15 | 16 /16 /21 /11 /14 |

The staggered cohort adds one five-worker district set every seven days (day0,7,14,21,28,35), not thirty on day0.
The Energy probe spends its declared budget on the earliest running jobs until exhausted, through real deadline
clamps. It spends all50 and adds no EXP/output directly; it is not an optimal acceleration policy. The variants
probe starts gatherers at earned Lv11 but Workshop/Kitchen at Lv1, mixes the first two scenarios, freezes one
variant/slot and allows explicit partial batches when a stack is fragmented. It still needs87 claims and has
25/25 surplus under this policy; two check-in stock shortages occur. This is not a fresh-account speed promise.

| Two/day probe | Aggregate idle worker-hours | Of those, Ready waiting for collection | Stock-blocked worker checks |
|---|---|---|---|
| Solo canonical | 522 | 522 | 0 |
| Five canonical | 2,058 | 522 | 0 |
| Thirty canonical | 24,132 | 11,508 | 7 |
| Staggered thirty | 21,252 | 11,508 | 35 |
| Five +50 Energy | 2,023 | 499 | 0 |
| Later-variant specialists | 1,278 | 522 | 2 |

Idle sums over the available workers, including Ready waits, gated sections, finished workloads and input
waits; it is **not** one outfit's elapsed time. A stock-blocked check means an otherwise eligible queued job
had no sufficient concrete stack at the first action pass. No deficit becomes negative inventory.

Thirty maps pool leftovers: Garden250, Orchard225, Barn475, Workshop475, Kitchen493 claims, **1,918 total**.
Each district fits its six workers' 588-claim combined Lv50 budget. Stock finishes at zero. This policy can
finish thirty maps in49.5 days; the supplied-Kitchen-only 27/12=2.25-day arithmetic is not a cold-start promise.

## Personal levels and three blocks

The independent all-raw98-claim timing probe starts each real job, waits and claims it, producing588 units:

| Check-ins | Personal Lv1→50 | Waiting after readiness (hours) |
|---|---|---|
| Two/day | 49 days | 588 |
| Three/day | 32⅔ days | 196 |
| Four/day | 24½ days | 0 |

Helpers never transfer EXP. The continuous solo run starts at Lv1/zero stock, completes block1's map, performs
thirteen real old-block raw jobs to Lv51, completes block2, performs another thirteen to Lv101, then block3.
It preserves all EXP/stacks/milestones between blocks: **287 claims,3,444 EXP,Lv144,143.5 days** at two/day.
Processing/cooking milestones occur on elapsed days5/8,55/58,105/108. Final surplus is231 raw/75 processed,
including156 filler vegetables. Separate block2/3 probes start at exactly Lv51/101 with empty stocks and
milestones, each needing87 further jobs/43.5 days; they do not substitute for the continuous run.

## Banquet stress, not an extra station multiplier

Thirty workers start with earned Lv9 but no ingredients/shared recipes. Twenty vegetable jobs +twenty milk
jobs +twenty cheese jobs +six quantity-four banquet jobs produce/consume24 Sun meals: **66 claims**, zero
surplus, first meal day2.5, last day3,22 stock-blocked worker checks. Fruit is legally replaced by same-stat
vegetables for this probe; the unused Orchard stays idle. Each cook receives12 EXP, not48.

One six-Kitchen burst needs120 processed +120 direct raw units, while one six-Workshop round produces36
processed: an84-unit processed shortfall without a buffer. Sustained banquet-only cooking cannot run every
Kitchen continuously. The balanced map mix fits; the shopping planner must show this real recipe-specific
preparation requirement. No baseline constants were changed or fictitious materials supplied to make it pass.

## Card/Farm stat matrix

**672 exact card-only checks** cover all14 tiers, all0–3 global-star ranks, era1/current, neutral and declared
10% Speed/10% Stamina growth, and three flex decks. **2,016 reported builds** cover low/mid/max0/1/3 stars
and all four distances. Base stats are all100. The deck is2 Speed +1 Stamina/Power/Guts +2 Wit +one Friend:
the sixth card gets its existing fair SP share, other nodes spread across the five stat cards within their caps.
Each build uses shipped scenario buffs and cap profiles. Extra/inspiration/goals are empty; no race bonuses
or private card rows are invented. Card values, SP, growth and Shared Light ordering are not changed.

Each full allocation fills the actual scenario capacity; partial uses its first ceil(capacity/2) chosen nodes.
Selection is deterministic, headroom-aware weighted marginal gain: Sprint weights Speed4/Power2; Mile
Speed3/Stamina2/Power2; Medium Stamina3/Speed2/Power2; Long Stamina4/Speed2/Guts2; other weights1.
This is an auditable planner, not a claim to solve optimal racing builds. JSON shows IDs, raw cards, grown
pre-cap values, Farm vector, partial/full final stats and Farm-only cap waste for every printed sample.

Selected current-era3-star Stamina-flex/declared-growth Long examples, ordered Speed/Stamina/Power/Guts/Wit:

| Tier / capacity | Card-only | Partial Farm | Full Farm | Farm vector / cap waste |
|---|---|---|---|---|
| 1 /18 | 1200/532/437/268/885 | 1200/712/437/268/885 | 1200/762/447/378/895 | 0/230/10/110/10; no waste |
| 5 /26 | 1600/626/510/305/1056 | 1600/856/520/315/1066 | 1600/874/528/523/1074 | 18/248/18/218/18;18 Speed wasted |
| 10 /36 | 1829/724/586/343/1121 | 1919/964/596/353/1131 | 2053/968/600/567/1135 | 224/244/14/224/14; no waste |
| 14 /44 | 2109/794/698/399/1312 | 2279/1034/708/409/1322 | 2369/1054/748/659/1362 | 260/260/50/260/50; no waste |

Tier1's max targeted stat gain is256 with18 active nodes; the unbounded full65-node inventory totals260 per
stat, but never means65 active in current scenarios. Total active Farm contribution is360 at tier1/880 at14,
not that much to every stat. Cardless Long builds remain weak: tier1 ends190/340/110/110/110, tier14
360/360/150/360/150; cap gaps remain large. Deck flex, stars and eras continue to matter. A single Stamina-card
example is not promised to run every Long race; shipped recovery/deck requirements are not waived by Farm.

Foundation comparison, the same six legacy40-point nodes: old raw360, grown360 neutral/**384** declared.
New18-node vector is **360 flat** for both growth profiles. Foundation, growth and Shared Light do not scale
or reclassify the separate Farm vector. `previewFarmStats` takes uncapped post-growth values, adds once, rounds
and caps once; zero Farm exactly reproduces existing card-only values. The historical240 normalization stays.

## Verification and explicit limitations

- `pnpm lint`, `pnpm test --concurrency=1` (1,565 tests), `pnpm build`: pass on rebased main `adaca2b`.
  Parallel local package runs twice hit the unchanged race250ms wall-clock test under CPU contention
  (895ms/293ms); serial package execution runs every test without changing thresholds or skipping anything.
  Canonical `pnpm test` is also required by PR CI, not replaced by a weaker command.
- Both new sims and standalone strict sim type-check pass with the hashes above; `pnpm sim:farm` and
  `pnpm sim:careers` pass. No old Farm/card/race coefficients or envelopes are changed.
- `pnpm sim:constellation`: **known preexisting failure**, exactly one tier1 hard stamina check (“one stamina
  card runs1,400m”), ladder345/498/738/869/1093/1200. Already reproduced on unchanged main in
  [the earlier proof](rpg-inspiration-phone-proof.md#commands-and-known-baseline-issue). This branch changes
  none of its script/harness, constellation derivation or race sources; do not retune them within T118.
- New catalogue is reachable only through `@racer/domain/farm/kitchen`, absent from root/live Farm barrels
  and the web dependency graph. Entry `index-BglDflPx.js` is478,624 bytes /154,376 bytes gzip (**154.38KB**),
  under180KB. No new food item prefixes occur in any web JS chunk. No dependency or UI change.
- These are rules witnesses, not economic retry/sync guarantees. T119 implements versioned wrappers, receipt
  uniqueness and transactions; T120 rehearses reset/recovery; T123 joins these stats to real race inputs.
  Physical phone, owner pacing and real-account/second-device checks remain pending T124 release.
