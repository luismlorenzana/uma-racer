# T089 — Pure RPG profile, tier and tree rules

**Outcome:** every non-combat rule for an outfit RPG profile is deterministic, documented and pinned before it
becomes save data. Depends on latest `main`. Read [M028](M028-uma-rpg.md), [RPG design](../design/uma-rpg.md),
[implementation contract](../technical/uma-rpg-implementation.md), D215–D224 and `AGENTS.md`. No route or save write.

## Fixed rules

- One owned outfit enrolls once. It needs an A running style and selects exactly one such style, its permitted weapon
  path and one eligible default signature. Running style and first-delivery weapon stay locked through promotions.
- A/B **distance** controls elemental cells on that weapon; B has lower-depth access only. Turf/Dirt is map context,
  never an element gate. Attack/Guard are free basics. Even local levels 2…50 award one tree point; depth five is A-only
  at Lv50; learned skills can improve to level five. A tier renewal does not erase usable legacy techniques.
- Speed informs ATK and MATK from base racing stats/growths, not scenario constellation stats. Promotion at Lv50 is
  explicit, carries banked EXP, never lowers permanent stats and has no final tier.

## Implementation contract

1. Add pure `packages/domain/src/rpg/` types/functions for `enroll`, profile/stat projection, `grantExp`, `promote`,
   eligible cells, tree spend and loadout validation. Freeze enrollment base-stat/growth inputs and source content
   version so a later pack refresh cannot silently alter an existing profile. Reject absent/malformed inputs rather
   than inventing an aptitude or growth. No I/O, browser time or RNG.
2. Close the design's numeric candidates **in this PR**: EXP-to-next formula and rounding, stat/HP/MP projection,
   specialization scope/rounding, depth gates, point and skill-level costs, active/legacy slot bounds. For each,
   show candidate, chosen value, synthetic evidence and a pin in `packages/domain/src/domain.test.ts`; append a
   decision when a value or rule is settled. Do not leave a coefficient to T093 UI or T096 reward code.
3. Add `pnpm sim:rpg:progression` with invented outfits: five scenario-length reward budgets, two full tiers,
   weak-chapter replay, catch-up and focused-versus-broad trees. Show chapter-by-chapter levels against the design's
   roughly-ten-level intent and a Tier 1 Lv50→Tier 2 Lv1 stat comparison. If the candidate misses badly, tune and
   explain the tradeoff in the design before merging.

## Test matrix and acceptance

No-A rejected; dual-A locks one; multi-A/B distance eligibility; B denied capstone; surface irrelevant; preset
signature different from enrollment default but still legal; no alternate class tree. At each even level a point is
earned once, at odd levels none; invalid point/slot/skill-level spending is non-mutating. Banked EXP survives
promotion, can cross multiple post-promotion levels and cannot overflow a safe integer. Repeated projection from the
same frozen base inputs is identical across scenario switches. `pnpm lint`, `pnpm test`, `pnpm build` and the sim pass.
Update design/decision/pins and delete this spec in the same implementation PR (D104).

**Out of scope:** battle coefficients, UI/save schema, PriConne data and encounter EXP payout. T096 sets payout
against T095's concrete map fixture; T089 sets only level arithmetic.
