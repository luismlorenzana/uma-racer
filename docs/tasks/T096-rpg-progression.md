# T096 — Battle EXP, skill setup and class promotion

**Outcome:** a completed chapter fight advances all five participating RPG outfits and opens a meaningful safe-
checkpoint skill decision; promotion is lossless. Depends on T089, T090, T092, T094 and **T095's chapter fixture**.
Read [M028](M028-uma-rpg.md), [RPG design](../design/uma-rpg.md),
[implementation contract](../technical/uma-rpg-implementation.md), D217–D223 and the landed T089/T091 numeric pins.

## Reward and state contract

1. Use the accepted terminal battle receipt to grant deterministic, level-relative RPG EXP to the five **frozen
   entrant outfits**, each at its own tier/local level. Every entrant, including one KO'd before victory, receives
   the same encounter EXP adjusted for her level; a lost/abandoned encounter grants none. A boss pays its authored
   encounter EXP; chapter clear grants a token in T098, not another hidden EXP bonus (D225). Weak-chapter replay
   tapers but stays positive; catch-up increases low-level gain. No race/Training/Farm/card resources move.
2. Use T095's synthetic route lengths and recommended levels to set the encounter-base EXP schedule and relative
   factor. `pnpm sim:rpg:progression` must show per-fight and per-chapter gains across five scenarios/two tiers,
   overleveled replay and underleveled catch-up. Publish exact payout formula, floors/rounding and envelope in
   design; append a decision and pin values in `packages/domain/src/domain.test.ts`. Do not tune from real private
   opponent stats or grant EXP in a screen effect.
3. Extend T090/T092's **same grouped terminal command** with result evidence and all affected RPG outfit versions.
   On stale profile revision, reconcile against authoritative profile before resubmitting an unchanged encounter
   reward identity; never mutate a battle's frozen combat inputs or pay twice. Pending/offline results show an EXP
   preview marked unearned and cannot fund tree choices or a promotion until acknowledgement.
4. At accepted map checkpoints expose current-tier weapon×eligible-element trees from T089, target/hit/support
   alternatives, point balance, skill levels and bounded equip slots. Spend and loadout edits validate in domain
   and save boundary, and affect only later battles. The result reveal names every crossed level, five stat deltas,
   points, slots and Lv50 bank. At Lv50 a manual promotion archives old mastery, returns to Lv1 of next tier,
   applies the bank and retains usable legacy techniques. No running-style/weapon respec.

## Acceptance and tests

Idempotent terminal retry, stale competing result, one KO'd winner, loss, five different entrant levels, multiple
levels from one encounter, weak replay, catch-up, Lv50 overflow, two promotions, invalid point/slot and stale
checkpoint edit are all synthetic test cases. A browser result/profile/skill setup flow at 390×844 and 375×667
shows before/after correctly and never shows a provisional reward as spendable. `pnpm lint`, `pnpm test`,
`pnpm build`, progression/combat/replay sims pass; report startup gzip ≤180 KB. Update design/decision/pins and
delete this spec in its PR (D104).

**Out of scope:** PriConne content, chapter-clear token grant/sink and Home entry.
