# T089 — RPG rules and progression tuning

**Goal:** establish the pure, testable rules every later RPG task consumes. Read [M028](M028-uma-rpg.md),
[Global Uma RPG](../design/uma-rpg.md), D215–D222, and `AGENTS.md`. Branch from latest `main`; do not expose the mode.

## Scope and contract

- Add pure `packages/domain` RPG types/functions for outfit enrollment eligibility, permanent A-running-style choice,
  one weapon path, signature element and A/B-distance element access. No mutable scenario stats or save I/O.
- Implement deterministic base-stat/growth projection with Speed as both ATK/MATK input; tier-local EXP/level,
  lossless Lv50 EXP bank and repeatable promotion. Model a single active weapon × eligible-element matrix: even-level
  points, five depths, skill level ≤5, A-only capstone and retained legacy techniques. Refuse ineligible choices.
- Resolve only necessary numeric candidates: progression curve/stat formula, tree depth gates/slot ladder,
  specialization scope/rounding and promotion carry-over. Record chosen numbers in the design and decision log and
  pin them in `packages/domain/src/domain.test.ts`; keep unchosen class-mastery variants explicitly deferred.
- Add a small synthetic RPG progression sim (five scenario-length rewards, two tiers, weak-chapter replay and catch-up
  outfit) with documented inputs and a bounded pass envelope. No real Uma values or content rows in fixtures.

## Acceptance

Pure tests prove each running style/weapon choice, multi-A/B eligibility, no extra style tree, no negative or lost
EXP/stat on promotion, stable recomputation and point/slot/capstone gates. The sim output and fixtures are reproducible.
`pnpm lint`, `pnpm test`, `pnpm build` and the new sim pass. Remove this spec in the implementation PR (D104).

**Out of scope:** combat coefficients, UI, save schema, private content and RPG reward grants.
