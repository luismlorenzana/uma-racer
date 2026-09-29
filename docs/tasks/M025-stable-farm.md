# Milestone 25 — Stable Farm

**Outcome:** Home opens a self-contained account Farm that grows from one to six plots as owned Uma outfits work
twelve-hour crop cycles, raise their own Farming Levels and collectively raise Farm Level, unlocking plots and scenario
produce on the way to one synced global Item inventory.

The contract is [Stable Farm](../design/farm.md), grounded in
[Farming game research](../research/farming-games.md). The constellation Produce-node bridge is deliberately a later
milestone: M025 proves the complete grow → harvest → inventory loop without changing current Uma builds.

## Why this is a separate system

Stable Farm has a clock, but it is not a replayable minigame. There is no ticket, run reservation, seed, action journal,
win or loss. Its state is six synced plot slots, persistent outfit assignments, outfit progress, derived Farm Level and
inventory. Reusing `MinigameHost` would create the wrong retry and device-local semantics; reusing the local-first
transaction/outbox shape keeps it consistent with the rest of the game.

## Sequence

```text
T082 domain rules + crop catalog
        │
        ▼
T083 save + runtime transactions
        │
        ▼
T084 Farm screen + Home entry
        │
        ▼
T085 global Item inventory + closure
```

| Task | Result | Must not absorb |
|---|---|---|
| [T082](T082-farm-domain.md) | Pure farm rules, level curve, 70-crop catalog and synthetic fixtures | Dexie, API, React, timers |
| [T083](T083-farm-runtime.md) | Synced Farm/items/item-ledger save, offline deadlines and atomic idempotent plant/harvest | Screen work, constellation changes |
| [T084](T084-farm-screen.md) | Lazy Farm shell, progressive six-plot field, persistent outfit crew, Home state and Farm menus | Item browser, farm economy expansion |
| [T085](T085-item-inventory.md) | Global Item inventory, farm result links, migration/reconciliation closure and device acceptance | Produce-node consumption (M026) |

Each task branches from the latest `main`, opens its own PR and deletes its own spec when it merges (D104).

## Fixed rules

- Six stable plot positions; only plot 1 starts unlocked, and Farm Levels 2 / 6 / 13 / 27 / 42 open the rest.
- Farming Level 1–20 belongs to an owned outfit. Different outfits of one character are distinct valid workers.
- `Farm Level = 1 + Σ(outfit Farming Level − 1)` across owned outfits; baseline ownership pays nothing. It unlocks
  plots and crop rows, so later Farm progression requires leveling several outfits.
- Every crop takes 12 hours, yields one item and pays the worker 12 Farming XP at harvest.
- Seventy checked-in generic crop definitions: five stats × fourteen scenario tiers, with aggregate-Farm and outfit
  requirements. No extracted data or art.
- No costs, randomness, failure, withering, watering, weather, quality, selling or auto-repeat.
- Ready is derived from persisted `readyAt`; no timer writes and no online requirement.
- Plot-to-outfit assignments persist across login and harvest. Farm opens directly to the saved field; pickers live inside
  plot and Farm management actions, never at route entry.
- Harvest atomically returns the assigned plot to Idle, raises the outfit/Farm and adds one item, once per cycle id.
- The account Item inventory is synced and extensible. There is no farm-only storage and no capacity.
- M025 does not touch constellation node kinds, assignments, derived stats or balance pins. That is M026.

## Definition of done

- A new/legacy account gets one unlocked unassigned plot, five visible locked plots, Farm Lv1 and no fabricated
  inventory or Farming XP.
- An owned outfit stays assigned until deliberately changed, can plant an eligible crop, matures while the PWA is closed,
  and harvests exactly once without opening a picker on the next visit.
- Outfit levels, aggregate Farm Level, plot unlocks and both scenario-crop gates match the documented curves and
  `pnpm sim:farm` envelopes.
- Reload, offline use, stale-screen retry, sync conflict and second-device adoption preserve the cycle and its evidence.
- Home and Farm's Field, Workers, Crops and Items views meet the 390 × 844 and 375 × 667 contracts with accessible
  44 pt controls.
- All checked-in tests use synthetic outfits/items; private chibi art is joined only at runtime.
- `pnpm lint`, `pnpm test` and `pnpm build` pass after every task; startup remains at or below 180 KB gzip.
- The final PR updates the documentation's current-state language, deletes the landed task spec, and leaves M026's
  Produce-node work explicitly unimplemented.

## Not in this milestone

Constellation consumption, crop buffs beyond the existing 40-point stat-node value, farm badges, notifications, batch or
automatic planting, expansion beyond six plots, decorations, variable timers, crop quality, cooking, crafting, selling,
seeds, currencies, multiplayer or private original-game crop content.
