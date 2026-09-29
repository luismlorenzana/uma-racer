# T085 — Global Item inventory and Farm closure (Milestone 25, part 4)

**Outcome:** every harvest has a durable, understandable destination: a global Item inventory that is ready for later
systems without pretending constellation consumption has already shipped.

**Prerequisite:** T084 has merged. Read [Stable Farm — Global Item inventory](../design/farm.md#global-item-inventory),
[Collection — Shared browsing chrome](../design/collection.md#shared-browsing-chrome) and the full M025 acceptance list.

## Fixed choices

- `/farm/items` is the Item menu in the self-contained Farm shell. Its data remains global account inventory; it is not a
  sixth app tab or part of Cards/Stable completion counts.
- Show current global stacks from T083. Do not create a second client-side quantity or derive items from plot history in
  the view.
- Produce can be filtered by stat and destination scenario. No consume, sell, discard, favorite or capacity action ships.
- Zero-quantity definitions are hidden by default; **All crops** may reveal them as locked/empty catalog entries.

## Implementation contract

- Build an engine-agnostic item catalog/view model: join stack to definition, stable default order (destination scenario,
  stat order, name), quantities, total unique/owned counts and filters. Keep it reusable for a later non-produce category.
- Reuse the shared album filter/saved-view primitives only where their generic contracts fit; do not force quantities into
  Uma/card ownership semantics. Inventory preference (owned/all, stat/scenario filter, density) is device-local.
- Item tile: original crop mark, name, stat glyph and text, scenario name/tier, quantity. The detail sheet explains the
  source (**Stable Farm**) and future use (**Produce nodes are not available yet**) honestly.
- Farm navigation and harvest result link to the exact item/detail. Home keeps one Farm entry instead of a second Items
  shortcut; Field, Workers, Crops and Items live together after entry.
- Finish rollout reconciliation and diagnostics: Settings/export summaries include Farm/item counts without item names
  from private content; malformed/future rows retain the existing recoverable-save path.
- Update README, UX, architecture, Farm and task docs from planned language to current state. Keep the M026 future bridge
  explicit. Delete the completed M025/task specs under D104.

## Tests and verification

- Join/order/filter tests over small synthetic catalogs, including 0, 1, large quantities and an orphan stack.
- Preferences survive reload and never sync; direct item links reject unsafe/unknown ids cleanly.
- A harvest result opens the same stack quantity that committed; reload/offline keeps it.
- Reconciliation is a write-free no-op when evidence, stacks and outfit XP agree; a synthetic partial conflict repairs
  the item, outfit, Farm projection and harvested plot once.
- Accessibility: quantity, stat and scenario are in the accessible name; filters expose selected state and result count.
- Browser screenshots at 390 × 844: owned default, All crops with empty silhouettes, filtered scenario/stat, detail sheet,
  and Farm with its Items link.
- Physical-iPhone check: plant, close the Home Screen app, reopen after deadline (or a documented dev-clock fixture),
  harvest, inspect the item, reload offline, then reconnect and verify sync. Owner performs/signs the real wait/device part.

## Acceptance

- `pnpm lint && pnpm test && pnpm build` pass; startup remains at or below 180 KB gzip and Items/Farm chunks are stated.
- All M025 definition-of-done bullets pass, except a real twelve-hour wait may use the documented test clock in automated
  and browser checks; production has no clock override.
- No original-game data/assets, secrets, infra/workflow/env edits or constellation changes.
- This spec and the completed M025 spec are deleted in the same PR (D104); `docs/tasks/README.md` advances its free task
  number and records the last commit containing them.

## Out of scope

Produce-node consumption (M026), arbitrary item rewards, item capacity, discard/sell/craft/cook, expansion beyond six,
notifications, badges and balance changes.
