# T082 — Stable Farm domain and crop catalog (Milestone 25, part 1)

**Outcome:** the Farm's complete rule set exists as pure, pinned TypeScript before a clock or screen can mutate a save.

Read [Stable Farm](../design/farm.md), [Farming game research](../research/farming-games.md),
[Architecture](../technical/architecture.md) and `AGENTS.md`.

## Fixed choices

- Implement D203–D208 as refined by D206–D208: one-to-six plots, 12-hour cycles, one item, 12 Farming XP,
  outfit-scoped levels 1–20, derived Farm Level, and the documented plot/crop ladders.
- The crop catalog is checked-in Uma Racer design data: five stats × fourteen tiers, using the names and unlock levels in
  `farm.md`. It is not imported private content.
- Rules have no wall-clock read. Every function that needs time receives integer epoch milliseconds.
- No `Math.random`, I/O, React, Dexie, browser global or private content dependency in the domain module.

## Implementation contract

Create `packages/domain/src/farm/` with small modules matching the repository's pure-rule conventions:

- `types.ts`: crop, plot, worker progress, farm state, inventory movement and result types; bounds and exact parsers.
- `catalog.ts`: all 70 frozen crop definitions, id lookup and tier/stat lookup. Validate one and only one crop for each
  tier/stat pair, safe unique ids, exact constants and the Farming-Level ladder.
- `progression.ts`: `farmingXpToNext`, accumulated-threshold helpers, multi-level application, level-20 clamping,
  `farmLevel` aggregation and plot/crop unlock projections.
- `rules.ts`: constants plus pure assignment/removal, `canPlant`, `plantPlot`, `plotStatus` and `harvestPlot`. Plant and
  harvest return new values/descriptors; they never mutate their input.
- `scripts/sim/farm-progression.ts` and `pnpm sim:farm`: focused-one-outfit, ideal spread and casual once-daily policies,
  reporting plot, crop-row and outfit-level unlock days under fixed owned-outfit fixtures.
- public exports from `@racer/domain` without pulling the catalog into unrelated startup code through accidental eager
  web imports.

The canonical farm shape has six stable ids, a persistent optional `templateId` assignment on each unlocked plot, and a
bounded worker-progress map keyed by outfit template id. A missing worker entry means outfit Farming Lv1, 0 XP.
`plantPlot` validates ownership plus outfit/Farm gates through explicit arguments, rejects a locked or unassigned plot and
an outfit already assigned elsewhere, then generates the next deterministic cycle id. It does not inspect content itself.

`harvestPlot` requires the expected cycle id and a mature deadline, returns one `farm-harvest` item movement plus the
updated worker/plot, and is pure. Runtime idempotency belongs to T083's evidence row, not a hidden flag in these rules.

## Tests

- Catalog coverage is exactly 70, with one crop for every tier/stat and the documented names/levels.
- Parser round trips for locked, unassigned, idle, growing and ready projections; reject unknown keys, duplicate plot ids,
  duplicate outfit assignments, unsafe ids, fractional/negative timestamps, invalid levels/XP and over-bound arrays.
- Every crop has 12 hours, yield 1 and XP 12; constants are pinned in `packages/domain/src/domain.test.ts`.
- Level thresholds and cumulative values: Lv2 after 48 XP/four harvests; Lv20 after 1,344 XP/112 harvests; overflow
  crosses multiple levels; max level clamps.
- Aggregate Farm Level ignores every outfit's baseline, counts every earned outfit level, and drives exact plot thresholds
  1 / 2 / 6 / 13 / 27 / 42 plus the documented scenario-row ladder.
- Assignment persists independently of a crop; removal/reassignment works only while Idle. Plant rejects unowned outfits,
  a locked/unassigned/busy plot, a duplicate assigned outfit, and either failed crop gate.
- Readiness flips exactly at `readyAt`, never before. Harvest rejects stale ids/early clocks and pays the exact descriptor.
- Source guard proves `packages/domain/src/farm/` has no forbidden I/O/framework/global imports and no `Math.random`.

## Acceptance

- `pnpm lint && pnpm test && pnpm build && pnpm sim:farm` pass; the focused domain suite covers the rule matrix and the
  simulation pins a sensible one-to-six expansion envelope.
- The design numbers, pinning test and decision rows agree.
- Only small synthetic outfit/state fixtures are committed.
- This spec is deleted in the same PR (D104), and M025 marks T082 complete.

## Out of scope

Save schema, API/Dexie, sync, real clocks, UI/art, Home, inventory browsing, constellation nodes and any tuning not stated
in `farm.md`.
