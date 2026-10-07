# T106 — Pure Puzzle progression and Constellation materials

**First task of [M030](M030-uma-puzzles.md).** Depends on the owner-approved plan, not on runtime/content work.
Read [design §§2–4, 7–8](../design/uma-puzzles.md) and the
[implementation contract §§1–3, 5, 8](../technical/uma-puzzles-implementation.md), D267–D268, then current
`training.md`, `constellations.md`, scenario registry and Items/ledger types. Work in its own PR from latest main.

## Deliverable and boundaries

Author tested pure rules in `packages/domain/src/minigames/uma-puzzles/`: `identity.ts`, `progression.ts`,
`materials.ts`, `bank.ts`, `legacy.ts`, versioned `types.ts`/parsers and a narrow barrel. Export through the established
domain boundary. Nothing in this task writes a save, runs a migration, changes current Spark or advertises Home entry.
Do not rename shared persisted fields yet or touch RPG progression.

## Fixed rule contract

1. Registration uses original literal A styles. No A → unavailable, not collection deletion. Dirt A overrides first
   and permits all five elements. Exact F/FP → Light; exact E/LE → Dark; P/L/PL and every other non-Dirt-A multi-A
   set → Fire/Water/Wood. B/S/lineage/default racing styles never become A through a loose comparison.
2. Freeze versioned source base/growth/grades and selected element in a parsed enrollment profile. PL is global per
   outfit, initially 1 with zero EXP; correction is free only before first battle entry. Source base/growth are
   independent of racing build. Growth fractions are validated/normalized once; reject NaN and mixed percentage units.
3. Candidate stat and EXP formulas are exactly design §4. Level carry crosses every affordable level with no Lv50
   reset. Validate safe integers/overflow and bound parser/iteration work without introducing a hidden gameplay cap.
   EXP awards use each frozen entrant level and one authored encounter level, not summed foes or current mutable level.
4. Define four item families for every registered scenario: `constellation:<scenarioId>:<style>`; today's catalogue
   has 56 definitions. Item definition generation must also pass with an invented fifteenth scenario.
5. One eligible ticket = +1 shared scenario CL, cap 10. Only original A styles and an unlocked racing scenario qualify;
   mix eligible styles in a batch. Recipient need not be in a puzzle party. A Dirt/element choice cannot broaden styles.
   Preserved universal stock uses its existing id and remains eligible as described in design §8.
6. Exchange only adjacent registry scenarios, same style, both directions: 1 higher ↔ 2 lower. Higher Opening guardian
   first clear unlocks the edge account-wide. Batch math is integer-safe; insufficient/odd up-conversion input fails.
7. Bank balances are nonpositive and separate from Items/Inspiration. Gross acquisition repays only matching
   scenario/style, then deposits net. Derive `{gross, debtPaid, net, bankAfter}` without mutating arguments.
8. Legacy cohort debt is CL−1 once per outfit/scenario. Choose saved preference if original A, else stable first-A
   Front/Pace/Late/End; freeze it. Never debit per preset/all-A or include future units. Invalid source stops preparation.
9. Legacy conversion pools only unapplied scenario EXP + account bank, at 1,250 per universal ticket; preserve stock,
   round the final account fraction once at most, keep exact compensation evidence. Credit never repays new debt.

## Function contracts

Provide typed equivalents of these functions; exact names can follow the surrounding code, but one implementation
must supply each behavior:

- eligible elements/styles and parsed enrollment/correction validation;
- `puzzleStats(source, level)`, next-level cost, award/carry result with every level/stat delta;
- scenario/style item catalogue/id parser and deterministic order/facets;
- pure CL spend preview/resolve taking current CL, unlocked scenario, frozen eligibility, selected input vector,
  available stacks and expected revision; returning exact debits, CL before/after and no implicit assignments;
- pure adjacent exchange preview/resolve taking edge access, source/output debt and stacks;
- immutable debt-cohort preparation and matching repayment; pure legacy credit summary/receipt.

Return typed illegal/stale/insufficient/unknown errors, not null success or silent clamping. Bound arrays/ids, reject
duplicates, unsafe quantities, prototype keys and future schema versions. Functions may take registry/templates as
arguments; no content fetch, clock, save/Dexie, DOM, `Math.random` or React.

## Tests

- Invent small synthetic templates covering every style set, Dirt override, B/S/no-A, exact versus supersets and
  source grade versus improved/default grade. Do not copy catalogue rows to tests.
- PL1 and multiple stat growths, fractional normalization, exact threshold, multi-level carry, level >50/>140,
  relative EXP min/max, malformed inputs and arithmetic overflow. Result deltas equal direct projection differences.
- CL1→10 costs 9; five/six units cost 45/54; CL9/10 do not invent nodes. Mixed A-style spend, ineligible style,
  locked scenario, max-level/overspend/zero count/stale preview and legacy universal selection.
- All scenario/style item round trips, unknown/ambiguous ids, stable registry order and synthetic registry expansion.
- Debt −7 + gross12 → 0/7/5; below/equal/above debt, wrong scenario/style, zero-debt receipt retained, monotonic
  balance and conservation `gross = debtPaid + net`.
- Exchange round trip absent debt, output entirely/partially intercepted, locked/nonadjacent edges, odd inputs,
  overflow, no FR↔PC and thirteen-edge tier value 8,192.
- Four preset fixtures yield one legacy debit; preferred non-A fallback; future outfits excluded; 0 EXP/no round-up,
  1,249→one compensation, 1,250→one exact ticket, several fractions pool before rounding, previously converted
  overflow excluded. Retry exact receipt identity cannot recalculate cohort.

## Acceptance / handoff

Pure exported contracts are sufficient for T107/T108 and later save/UI tasks to use without reimplementing formulas.
Pin accepted new candidate constants when they first become executable, label them initial balance rather than
production evidence, and append a new decision; later T108/T116 tuning follows AGENTS. Resolve the Constellation
`max(base, 50×TL)` prose discrepancy to the current fixed-base projection without changing that engine's numbers.
Keep current training rules clearly active until cutover; add planned CL terminology rather than globally replacing it.

Run lint/test/build and report startup gzip. Delete this spec in the merge PR, update M030/task index and the design /
technical contract with actual exports and parser versions. No live account credit/debit, production infra, asset
import or code for a second RPG class/skill tree belongs in T106.
