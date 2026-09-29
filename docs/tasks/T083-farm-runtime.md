# T083 — Farm save and runtime (Milestone 25, part 2)

**Outcome:** the progressive field, persistent outfit crew and its crop cycles are durable, offline, synced and
exactly-once before a production screen is allowed to drive them.

**Prerequisite:** T082 has merged. Read [Stable Farm — Persistence boundary](../design/farm.md#persistence-boundary),
[Architecture — Local-first game state](../technical/architecture.md#1-local-first-game-state) and the save/sync tests.

## Fixed choices

- Add independent synced `farm`, `items` and append-only `itemLedger` kinds. Do not put plots or inventory in the profile,
  Uma rows, local preferences, ordinary currency ledger or `minigameRuns`.
- The Farm initializes lazily with plot 1 unlocked/unassigned, plots 2–6 locked by derived Farm Level, and no fabricated
  assignment, item, XP or timestamp.
- `readyAt` is frozen from the planted timestamp. Runtime may read `Date.now()` only at its command boundary and passes
  that value into pure domain rules.
- Follow the transaction/outbox shape used by collection redemption and minigame commit. Zustand publishes only after
  Dexie succeeds.

## Save and sync contract

- Extend the domain `SaveBundle`, web Dexie schema, outbox vocabulary, API request parsers/repository and Firestore mapping
  for one `farm/main` versioned entity, versioned `items/{itemId}` entities and `itemLedger/{id}` append records.
- Parsers are exact and bounded. Rollout reads accept older saves with no new kinds; a newer farm schema is a visible,
  recoverable error. API limits and Firestore's nested-array encoding rules still hold.
- The Dexie migration creates stores/indexes and never loops through private content to seed rows.
- Cloud bootstrap/adoption, outbox rebase, full-save export/import, memory-only mode and test database helpers include all
  three kinds. `itemLedger` follows first-write-wins log semantics.
- Add item-stack, outfit-XP and harvested-cycle reconciliation from item-ledger evidence for a sync conflict or partial
  rollout. Farm-harvest evidence names plot, cycle, outfit template and exact XP; it can return a resurrected harvested
  cycle to assigned Idle and advance an attempt floor. Reconciliation must be write-free when projections already match
  and never count one id twice.

## Runtime contract

Create a narrow `FarmHost`/port in `apps/web/src/game/farm/`, separate from `MinigameHost`:

- `getFarm()` returns parsed slots/assignments, outfit progress, derived Farm Level/unlocks and joined inventory quantities.
- `assign({ plotId, templateId, expectedFarmVersion })` and `unassign(...)` re-read ownership/Farm, require an unlocked
  Idle slot, and persist the outfit independently of any crop. One outfit cannot occupy two plots.
- `plant({ plotId, cropId, expectedFarmVersion })` uses the plot's saved outfit, checks both crop gates through T082,
  increments that plot's attempt, writes the fixed deadline and queues the Farm row.
- `harvest({ plotId, cycleId, expectedFarmVersion })` re-reads Farm/stack/evidence, calls the pure rule, and atomically
  writes Farm, stack, item ledger and outbox. A matching evidence row returns the stored result; same-id mismatches are
  corruption. No partial item/XP/plot state may remain after failure.
- A stale-screen plant/harvest gets a typed conflict and reloads current state; it never overwrites another device's plot.
- A one-minute UI subscription may invalidate a view, but it performs no database write and is not part of this task.

## Tests

- Fresh and migrated databases expose one unlocked unassigned plus five locked slots with no item/XP/evidence rows.
- Assignment survives reload, an idle visit and a harvest. Plant freezes the assigned outfit, crop and exact 12-hour
  deadline; reload and JSON round trip preserve all fields.
- The same outfit cannot be assigned twice, including two concurrent/stale transactions; different outfits of one
  character can.
- Early harvest and wrong cycle id roll back with zero changed tables.
- Mature harvest adds exactly one item, 12 outfit XP, one evidence row and one set of outbox operations, then retains the
  assignment in Idle and derives any new Farm/plot/crop unlock.
- Matching harvest retry reconstructs success without a second item or XP; mismatched evidence fails visibly.
- A transaction fault after every write boundary rolls everything back.
- Full save/API parser and sync round trips cover all new kinds; legacy API clients can still omit them.
- Offline mature/reload and second-device adoption retain the assignment/deadline. Stack and outfit-progress conflicts
  reconcile from unique evidence, and harvested evidence cannot leave its old cycle growing again.

## Acceptance

- `pnpm lint && pnpm test && pnpm build` pass; focused domain, web persistence, API save and sync suites pass.
- No infra/workflow/environment file is touched.
- The architecture data model and local-first section are updated to describe the landed kinds.
- This spec is deleted in the same PR (D104), and M025 marks T083 complete.

## Out of scope

React/routes, Home, art, inventory browsing, notifications, batch commands, constellation changes and new badge facts.
