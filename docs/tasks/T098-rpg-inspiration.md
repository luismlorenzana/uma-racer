# T098 — Scenario token grant and Inspiration unlock bridge

**Goal:** a successful RPG chapter clear has a real, spendable effect on Inspiration, without relocking anything the
owner already opened. Read [M028](M028-uma-rpg.md), [Global Uma RPG](../design/uma-rpg.md),
[Constellations](../design/constellations.md), [Stable Farm](../design/farm.md), D120–D123 and D220. Depends on
T090 and T096; start against the latest Items/Inspiration implementation on `main`.

## Scope and contract

- Extend the existing global Item catalog/stack/ledger with one scenario-typed `Inspiration Unlock Token [Scenario]`.
  A successful boss clear grants **one** token for that chapter's scenario, including replay under a new attempt id.
  Grant and chapter-clear evidence commit atomically; failed/abandoned chapters grant none; duplicate results grant
  none. Do not create a separate RPG wallet, Badge reward or Training Ticket cost.
- Migrate the current TL9/10-derived lineage unlocks to explicit per-Uma/per-scenario parent-branch open state.
  Grandfather all already-open branches (including preexisting assignments) without spending tokens or demoting
  Training. New unlocks no longer read TL; one token opens one complete parent + linked two-grandparent branch,
  so two tokens open both. Assignment/fill semantics stay unchanged.
- Inspiration shows 0/2, 1/2 or 2/2 branches, owned scenario tokens and a confirmation naming the target branch.
  Refuse wrong-scenario, already-open or insufficient-token spends atomically. Global Items shows the scenario label
  and ledger history. Memory-only development mode follows the same rule.

## Acceptance

Migration tests cover TL below/at/above old gates and filled branches, plus cloud adoption and retry; no branch
relocks or double charges. Transaction tests cover duplicate clear, replay clear, stale concurrent spend and wrong
scenario. Browser at 390×844 shows clear→Items→Inspiration spend→open branch, including reload. `pnpm lint`,
`pnpm test`, `pnpm build` and affected RPG/constellation sims pass; startup gzip ≤180 KB. Update design, architecture,
decision log and numeric pins where changed; remove this spec in its PR (D104).

**Out of scope:** card Constellation, RPG level bonuses, changing lineage slot contents, grant size changes.
