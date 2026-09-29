# Milestone 26 — Produce nodes

**Outcome:** Stable Farm's global produce becomes the deliberate minor-stat layer of every constellation: the six current
Stat nodes keep their value and position, but filling or replacing one consumes a crop authored for that scenario.

This is the second phase of [Stable Farm](../design/farm.md#future-constellation-bridge-m026-not-m025) and D205. It begins
only after M025's Farm, global Item inventory and item ledger are complete and proven independently.

## Sequence

M026 is one atomic delivery unit: **[T086 — Produce-node bridge](T086-produce-nodes.md)**. Splitting schema migration from
the node editor would leave an intermediate release that can parse a build but cannot safely edit it.

## Fixed rules

- Six existing nodes keep ids, unlock order, silhouettes and 40 raw points each. The 240-point budget does not move.
- A new fill consumes one in-stock crop whose destination is exactly that constellation's scenario tier.
- The crop's stat receives the node's 40 points. Neither outfit Farming Level nor Farm Level is checked at consumption
  time; only matching scenario stock matters.
- Replacing consumes the new crop and does not refund the old one. A filled Produce node cannot be cleared by itself.
- Existing filled Stat nodes migrate to contribution-preserving legacy assignments, without granting or consuming an item.
- Card/lineage edits stay free, and no Farm number, timer, level or yield changes.

## Definition of done

- Every old constellation derives the same stats byte for byte after migration.
- Every new item spend, node assignment and evidence row is one idempotent local-first transaction.
- Scenario/stat/quantity filters make the valid crop visible and invalid crops impossible to submit.
- Six Produce nodes still total exactly 240 raw points regardless of their stat split.
- Full test/build gates pass, startup stays at or below 180 KB gzip, and physical-iPhone confirmation covers a fill and
  replacement without accidental double consumption.

## Not in this milestone

Farm expansion, crop effects other than the existing stat value, refunds, crafting/cooking/selling, bulk fill, presets,
badges, private crop content or any change to card nodes, lineage, Training Level or scenario buffs.
