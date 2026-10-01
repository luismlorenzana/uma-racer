# T098 — Scenario token grant and Inspiration unlock bridge

**Goal:** a successful RPG chapter clear has a real, spendable effect on Inspiration, without relocking anything the
owner already opened. Read [M028](M028-uma-rpg.md), [Global Uma RPG](../design/uma-rpg.md),
[implementation contract](../technical/uma-rpg-implementation.md), [Constellations](../design/constellations.md),
[Stable Farm](../design/farm.md), D120–D123, D220 and D223. Depends on T090, T095 and T096; start against the latest
Items/Inspiration implementation on `main`.

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

## Migration and transaction handoff

1. Add explicit `openedLineageBranches` (the two parent ids, not six independent booleans) to each `ScenarioTraining`
   in the next save migration. For every existing run, branch A is open if old TL≥9 or any A-branch assignment is
   present; branch B if old TL≥10 or any B-branch assignment is present. Preserve those assignments and derived
   stats/skills. Do **not** issue tokens for grandfathered branches, spend tokens retroactively or change TL. Migrate
   local Dexie and older cloud copies exactly once; compare derived pre/post build on synthetic TL8/9/10 saves.
2. Refactor lineage unlock checks through the explicit branch state, while card/Produce checks still use TL. This
   affects `packages/domain/src/constellation.ts` (`isNodeUnlocked`, `unlockedNodes`, `nodesUnlockedBetween`,
   `deriveStats`), `packages/domain/src/derived.ts`, web runtime assignment validation, Constellation graph and
   Inspiration screen, Spark result links/tests and any caller found by `rg isNodeUnlocked`. A TL9/10 Spark result
   must no longer claim to open lineage. Fill/change existing unlocked lineage slots remains free.
3. Add scenario token ids to the **existing** Item catalog and parser. Boss clear sends the T090 grouped checkpoint
   command with one item-stack increment and `itemLedger` movement keyed by accepted chapter attempt. A replay
   clear has a new attempt key; duplicate/reconnect of one clear does not. A token spend sends a grouped command with
   expected Uma and Item versions, branch-open state, stack −1 and movement keyed by branch revision. If either row
   conflicts, neither branch nor movement commits. The item stack is repairable from accepted ledger evidence.
4. Expose current scenario token count and both branch states on Inspiration, with confirmation naming the Uma,
   scenario and parent branch. An already-open branch stays visible as open even if no token is owned. Wrong-scenario
   token, pending clear, stale confirmation and double tap all fail without consuming anything. Global Items links
   back to the matching scenario Inspiration view.

## Mandatory fixture matrix

Old TL8 empty; TL9 A open; TL10 both open; a malformed old save with a filled branch below its old TL; duplicate
local/cloud migration; current TL10 after migration but both branches closed; one- and two-token spends; wrong tier;
duplicate clear; replay clear; stale Item and Uma versions; derived stats/skills before/after grandfathering. All
must pass in domain, API and fake-IndexedDB tests. If a previously filled branch loses any derived contribution,
stop and repair the migration before release.

## Acceptance

Migration tests cover TL below/at/above old gates and filled branches, plus cloud adoption and retry; no branch
relocks or double charges. Transaction tests cover duplicate clear, replay clear, stale concurrent spend and wrong
scenario. Browser at 390×844 shows clear→Items→Inspiration spend→open branch, including reload. `pnpm lint`,
`pnpm test`, `pnpm build` and affected RPG/constellation sims pass; startup gzip ≤180 KB. Update design, architecture,
decision log and numeric pins where changed; remove this spec in its PR (D104).

**Out of scope:** card Constellation, RPG level bonuses, changing lineage slot contents, grant size changes. The
existing six lineage node ids and assignment semantics remain intact.
