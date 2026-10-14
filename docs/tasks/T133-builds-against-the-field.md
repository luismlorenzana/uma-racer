# T133 — The rework's builds against the field

**M033 · last wave: needs T125, T128 and T129; parallel with T130–T132 · not started.**

Read:
- [AGENTS.md](../../AGENTS.md) and [M033](M033-rework-rules.md), whose fixed choices bind this task.
- [rework/03](../rework/03-uma-progression.md) §8, §9 and §12; [04](../rework/04-tiers-and-promotion.md) §7, §8 and §12;
  [05](../rework/05-training-hub.md) §4, §6 and §12. Decisions D134, D152, D159, D191, D336 (4) and D338–D344.
- Today's balance sims: `scripts/sim/constellation-balance.ts` (`pnpm sim:constellation`, the stamina ladder),
  `career-balance.ts` (`pnpm sim:careers`) and their `harness.ts`, and
  [design/constellations.md](../design/constellations.md#balance-targets-the-stamina-ladder).
- The landed rework modules: T125's `rework/tiers` (`scaling`, `rivals`: `rivalTrainedStat`, `rivalPresetAt`,
  `rollRivalFieldAt`), T128's `rework/training` (`deriveBuild`, the buffs), T129's `rework/constellation`.

## Goal and fixed scope

Prove the rework's builds race as the design says, before phase 3 wipes into them. Three balance checks the rework pages
ask for, on rework builds, **beside today's sims, which stay unchanged** (M033 acceptance 4):

| Check | Target | Source |
|---|---|---|
| **The stamina ladder** at every T = 1–14 on the re-authored trees, with the rework's Extra Stats | Each rung holds as today's ladder defines it | 03 §12, 05 §6, D152 |
| **Careers with full-layer builds** at every T = 1–14 | Every Maiden G3 won, the Trials G2s at ≥ 90%, the Main G1s at 60–100% best case, today's handicaps unchanged | 03 §9, §12, D336 (4) |
| **The buffs' typical values**, re-measured on the rework's typical build | Today's range, about 2–5% (Legends 0) | 04 §8 |

T = 15 waits for the 15th scenario's content (04 §2).

**The rivals finding to settle.** On the new trees today's `trainedStat` grows faster late in each tier (646 → 728
across tier 1, against today's 650 → 689), because the full active Extra Stats E isn't discounted by the rivals' 84%
card factor (T125's report, M033). The career check measures whether that costs the fully trained Uma her edge at
scenarios 4 and 5 of a tier.

## Implementation contract

- **`scripts/sim/rework-builds.ts`**, root script `pnpm sim:rework-builds`: synthetic only, like `sim:constellation`.
  It runs the ladder on rework builds (T128's `deriveBuild` from synthetic cards, the re-authored tree sizes, the
  scenario's active Extra Stats on the ladder rung's stat) and the G1 win-rate grid against T125's
  `rollRivalFieldAt`. Flags as today's: races per cell, `--ladder-only`, `--rates-only`, `--tiers=`. **Exit 1 when a
  ladder rung fails**, so it is a regression gate the owner can run.
- **`scripts/sim/rework-careers.ts`**, root script `pnpm sim:rework-careers`: today's `sim:careers` on rework builds. It
  reads the private packs exactly as today's does (local only, never in CI) and reports the Maiden, Trials and Main
  rates per T, with every cell's best-case build.
- **Typical values.** Both sims report each buff's typical gain on the rework's typical build. If a measured value
  differs from `SCENARIO_BUFFS[*].typical` by more than half a point, the task updates the rework's copy that
  `rivalTrainedStat` reads (not today's `scenario-buffs.ts`, which today's game still pins), with 04 §8's table and a
  pinning test.
- **Shared code** goes into `scripts/sim/harness.ts` only as new exports; today's exports keep their behaviour, and
  `pnpm sim:constellation` and `pnpm sim:careers` print the same output before and after.
- Seeded with the race engine's `createRng`; no `Math.random`.

## Tests

`scripts/sim` has no test runner today. Add a small domain test only for what moves into `rework/` (the typical
values, if they change). The sims themselves are verified by running them: the PR (or commit series) quotes
`pnpm sim:rework-builds` exiting 0 and the `sim:rework-careers` report.

## If a target fails

1. **The ladder** fails only through the rework's trees or Extra Stats; the fix is T129's drawing order or T128's
   activation rule, never a handicap.
2. **A career cell** below target at scenarios 4–5 of a tier is the rivals finding. D336 (4) fixes the rival formula
   and the handicaps as the owner's rule, so this task does **not** change them. It writes the measured miss and a
   recommendation into [open-questions.md](../open-questions.md) for the owner (for example: discount E by the rivals'
   card factor, which restores today's edge at every T).
3. Any number it does change lands with its page, its pinning test and its decision row.

## Live blocks

`rework-ladder` and `rework-g1-rates` into 05 §12 and 03 §9, rendered from a committed report the sims write with
`--write-report` (like T132's win table), so CI renders without running the engine.

## Acceptance

- `pnpm sim:rework-builds` exits 0; `pnpm sim:rework-careers` reports every cell; both are documented in
  [scripts/sim](../../scripts/sim) usage comments and in the manual's architecture page.
- `pnpm sim:constellation` and `pnpm sim:careers` print exactly what they printed before.
- 03 §12's and 05 §12's balance bullets are met, or the owner has an open question with the measured miss.
- `pnpm lint && pnpm test && pnpm build` stay green; `git grep "rework/" apps` finds nothing.
- Its decision row is appended, and this spec is deleted (D104).

## Out of scope

Changing handicaps or the rival formula (the owner's, D336); `sim:loop` (T132); Expedition fields (phase 9).
