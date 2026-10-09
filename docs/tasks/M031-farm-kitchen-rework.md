# M031 — Farm production, cooking and Extra Stats

**State: T118–T120 complete; T121 next.** Original catalogue, production/map rules and deterministic
witnesses are implemented additively (D304); the live Farm and owner account are unchanged. [Design](../design/farm-kitchen-rework.md),
[technical contract](../technical/farm-kitchen-implementation.md), [research](../research/farm-kitchen-games.md).

## Outcome

Home opens a self-contained farm with thirty open spots: Garden, Orchard, Barnyard, Workshop and Kitchen,
six each. A persistent outfit crew earns independent levels while producing original scenario-specific food.
Raw→processed→meals feeds one global inventory and a configurable 65-node Extra Stats map shared by outfit
across a five-scenario block, with four independent distance builds per scenario. Energy accelerates one job;
the debug button grants Energy instead of time-shifting everyone. The full release deliberately resets only
old Farm EXP/levels and Extra purchases/actives once, safely, without discarding other progress.

## Fixed choices

- All 6/6/6/6/6 open, no expansion or expertise; no ticketed `MinigameHost`, no new currency/inventory.
- Per-outfit levels; two jobs/level. Six-hour jobs, raw 6/workshop 6→6/kitchen 1–4 are the baseline T118 verifies.
- Fourteen **different ingredient rows**, symmetric for every stat. Raw variants open at 1+10×(index−1);
  block shared processing/cooking milestones let newcomers specialize. Later variants never gate the full map.
- Original food definitions/SVGs, existing private verified Uma art. No outside game art/content dependency.
- Separate bought block maps/active scenario-distance builds; bounded 20-total-point nodes, existing caps/cards.
- Reset/account archive is a protected release migration, not manual production JSON edits or a DEV prerequisite.
- One task to completion/green PR/merge before the next, each from latest main; no push to main.

## Ordered tasks and merge gates

| Task | Complete deliverable | Prerequisites | Normal-account effect when its PR merges |
|---|---|---|---|
| T118 — **Complete** ([rules](../technical/farm-kitchen-implementation.md#t118-implemented-pure-layer-d304), [balance](../research/farm-kitchen-balance.md)) | Original scenario foods, production/Extra rules and modest deterministic sims | This approved definition | Additive pure modules; old game untouched |
| T119 — **Complete** ([contract](../technical/farm-kitchen-implementation.md#3-records-and-ownership), [verification](../research/farm-kitchen-sync.md)) | Records/parsers/API mirror, atomic operations, bounded sync and protection (D306); existing Farm timing retained | T118 | Dormant backend/DB support, no reset |
| T120 — **Complete** ([contract](../technical/farm-kitchen-implementation.md#t120-implemented-protocol-d307), [rehearsal](../research/farm-kitchen-cutover-rehearsal.md)) | Private whole-account archive, exact resumable reset, bounded verification and legacy claims (D307) | T119 | Both capabilities off, no real-account migration |
| [T121 — Real host/runtime](T121-farm-kitchen-host.md) | Save-backed port, pending/canonical views, offline replay/retry and bootstrap | T120 | Old Farm host stays selected |
| [T122 — Farm screens/cookbook](T122-farm-kitchen-screens.md) | Five phone districts, crew, recipes/shopping/Items, original glyphs, guide/Energy | T121 | Isolated proof only; legacy Home unchanged |
| [T123 — Extra map and race wiring](T123-farm-kitchen-extra-stats.md) | Meal purchases, shared map/list, preset-specific stats and real race joins | T122 | Active-generation path dormant, legacy stats unchanged |
| [T124 — Full production release](T124-farm-kitchen-release.md) | Integrated checks/tuning, matching capabilities, deployment/PWA proof and owner protocol | T118–T123 merged | Complete new loop plus guarded one-time reset |

T118 fixes pure Farm3, worker/recipe/Extra1, rules/template1; T119/T120 choose transport/DB/cutover versions from then-current main. They document them in the standing
technical contract; later tasks use those exact shapes. No task delegates an unresolved economic shape to UI.
If baseline balance fails, the rules task fixes/docs/pins it before persistence consumes it; do not ship a known
unfundable recipe or turn an owner directional example into permission to change race mechanics.

## Cross-task acceptance

1. One synthetic owned outfit can make a full 65-meal/65-node block map within its 98-job Lv 1→50 budget;
   helpers increase account supply, never transfer Farm EXP. Show smaller-crew/30-crew timed results separately.
2. Every actual scenario has equal per-stat family counts/costs, five milk/cheese variants, legal raw/processed
   substitutions and no cross-block spend. No scenario-specific mandatory rare ingredient tax.
3. Start spends inputs, Claim pays output/EXP once, Energy changes one deadline, and refresh/background/second
   device retains exact jobs. Duplicate/missing replies or a rejected ancestor never mint free stock.
4. One matching meal buys an arbitrary named node once. Another scenario/preset/outfit remains independent;
   only acknowledged selected race-distance Farm stats enter new race input. Existing replays stay immutable.
5. The release reset is whole-cohort, once-only, archived, resumable and narrowly scoped; old evidence cannot
   restore bonuses. Idle outfits reset too. Legacy stock/jobs remain accessible, with no new EXP for an old claim.
6. All six tiles fit 390 × 844 and 375 × 667; actions ≥ 44 pt, safe areas, VoiceOver/list/reduced-motion and sensible
   partial-claim/retry states. Screens connect to the real host; a test double is never installed in production.
7. Existing lint/test/build and relevant Farm/constellation/career/race/Puzzle/RPG sims remain green. Startup
   JS ≤ 180 KB gzip. Evidence names build/chunks/CI/deployment and pending owner checks independently.

## Release policy

T118–T123 may merge/deploy through normal CI, but new capabilities remain false. Do not reset a live account
while only a catalogue, migration or screen exists. T124 is the first task that enables the complete path.
No workflows/env/infra changes or account scripting are authorized by this milestone. The owner requested
the eventual Farm/Extra reset in the definition; implement it as application behaviour with a recovery archive,
not unrelated gifts or deletions. Failed prerequisite/archive checks defer the upgrade visibly.

The implementation run completes code/CI/deployment verification. Owner physical-iPhone/play/pacing checks
follow production availability and remain explicitly pending until reported; do not leave a finished game on
a branch waiting for a device test that cannot reach it. Under D104 delete each task spec in its completing
PR, preserve its rules in living docs and add its last-spec commit to the task index. Remove this milestone
spec with T124 when its definition is carried by the design/technical/release records.

## Non-goals

No RPG/Puzzle/class/reward/CL/Inspiration change, race-engine rebalance, card normalization nerf, cap increase,
weather/feeding/watering/quality/spoilage, paid upgrades, decorative placement, automatic queues, push alerts,
restaurant customers, required cooking gestures or external asset import. Follow-up owner balance feedback
gets a new decision/task or scoped bug-fix PR; never reuse T118–T124.
