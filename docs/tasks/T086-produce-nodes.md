# T086 — Constellation Produce-node bridge (Milestone 26)

**Outcome:** the produce in global Item inventory can be consumed safely on the six minor-stat nodes, with every existing
build preserved and every new spend visible and idempotent.

**Prerequisite:** M025 is complete. Read [Stable Farm — Future constellation bridge](../design/farm.md#future-constellation-bridge-m026-not-m025),
[Constellations — Stat budget](../design/constellations.md#stat-budget), D205 and the current constellation migration and
assignment transactions.

## Fixed choices

- This is a semantic/save/UI replacement, not a balance pass. `statNodeValue = 40`, six nodes and the 240-point pool are
  pinned unchanged.
- Keep every node id and template kind position stable. Domain presentation may call the kind `produce`, but the migration
  must recognize old `stat` templates/assignments for rollout reads.
- New assignments store a stable crop item id and monotonic per-node replacement revision. Legacy assignments store only
  the old stat and never impersonate an inventory item.
- No crop is refunded. The confirmation and result must say **Consume 1** and show the quantity before/after.

## Implementation contract

### Domain and migration

- Add exact `ProduceAssignment` and `LegacyProduceAssignment` unions. A crop assignment resolves through the checked-in
  catalog and must match the constellation tier; a legacy assignment accepts one valid stat only.
- Migrate each existing filled Stat assignment to legacy in one one-way save migration. Empty nodes stay empty. Do not
  create item stacks/evidence or alter card/lineage/loadout state.
- Update derivation, scenario buffs, Full House badge facts, template validation, view models and sims to treat Produce as
  the same six-node budget. A legacy or crop assignment pays exactly 40 to its resolved stat.
- Rollout parsers accept the prior shape but an older app must not overwrite the newer constellation schema.

### Atomic consumption

- Add a pure command resolver that validates open node, scenario crop, positive quantity and expected replacement
  revision, then describes the next assignment and `-1 constellation-produce` item movement.
- The web transaction re-reads the Uma, stack and item evidence; writes assignment, stack, append-only evidence, badge
  reconciliation and outbox together; and publishes Zustand only after commit.
- Evidence id includes Uma, scenario, node and replacement revision. Matching retry returns success, mismatch is
  corruption, and a stale screen reloads without spending.
- Filling an empty node starts revision 1. A legacy assignment is revision 0 and may be replaced at revision 1. A current
  crop assignment increments by one. Revisions and evidence ids are bounded.

### Training screen

- Stat gems become Produce nodes while preserving silhouette and lock/open states. Filled nodes show crop mark, name,
  stat glyph and `+40`; legacy nodes say **Legacy · <Stat> +40**.
- The picker reads global inventory, defaults to this scenario, groups by five stats, and shows owned quantity. Crops for
  another scenario and zero stacks may be explained but cannot be selected.
- Confirmation names the exact item, node/stat delta, quantity after spend and the no-refund replacement rule. There is
  no clear action; Back cancels without a write.
- Success updates the stat strip, node and inventory quantity together and links to Items. Reduced motion is immediate.

## Tests

- Migration over empty/mixed/full constellations preserves every derived stat, SP, aptitude, skill and badge fact; no item
  row changes. JSON/API/Dexie rollout round trips cover old/new shapes and future-schema rejection.
- Six legacy assignments and six crop assignments each total 240 raw points for every stat split; the existing invariance
  and stamina sims remain inside their exact envelopes.
- Reject wrong tier, unknown item, zero quantity, locked/non-Produce node and stale revision with no writes.
- Fill/replacement writes exactly one `-1` movement and one revision; retry pays once; injected faults roll back every
  affected table; two stale screens cannot both spend the same revision.
- UI tests cover all five stats, zero/large quantities, legacy copy, confirmation, result, error/reload and VoiceOver.
- Browser at 390 × 844 and 375 × 667: empty fill, legacy node, replacement confirmation and post-spend stat/inventory.
  Attach screenshots. Owner signs one physical-iPhone consumption and replacement.

## Acceptance

- `pnpm lint`, `pnpm test`, `pnpm build`, `pnpm sim:constellation` and the relevant race/career sims pass; startup gzip
  remains at or below 180 KB.
- The PR updates Training, Constellations, Stable Farm, Architecture and UX from planned to current language and deletes
  this spec plus the completed M026 spec (D104).
- No original-game data/art, infrastructure, workflow, environment, Farm tuning or new dependency.

## Out of scope

Refunds, clearing a filled Produce node, crop combining/quality, presets, bulk assignment, farm balance, new badges and
any stat value other than the existing 40.
