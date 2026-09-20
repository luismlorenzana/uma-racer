# T033 — Album engine and the Stable (Milestone 10, part 1)

**Outcome:** one reusable browsing engine — search, facets with counts, sorts, grouping, saved views, density,
virtualization — and the Stable rebuilt on top of it, opening on the documented default order.

Read [Collection — Albums](../design/collection.md#albums) first; it is the contract. Read
[Game UI Reference](../research/game-ui-reference.md#browsing-267-umas-and-312-cards) for why the patterns are what they
are, and [Visual System](../design/visual-system.md) for how the controls look.

## Fixed choices

- The engine is **pure and generic**: `(items, facets, query) → { results, counts, groups }`, with no React, no Dexie and
  no content imports. It lives beside the existing pure view models in `apps/web/src/game/`.
- Album preferences (filters, sort, density, grouping, saved views, last search) are **device-local**: a dedicated Dexie
  table, **not** part of the synced save. No save schema change, no API change (D112).
- Facet counts use standard faceted counting: a facet's option counts are computed with that facet's own selections
  excluded, so counts never collapse to zero as you pick within one group.
- **No new dependency.** The virtualizer is ours, roughly a hundred lines, and tested.
- Ownership is a segmented control, never a hidden filter.
- Album state stays device-local, including the **seen set** behind NEW markers, so nothing here needs a save migration.

## Implementation contract

### Engine

- A facet is declared as `{ key, label, kind: 'enum' | 'range' | 'boolean', options?, valueOf(item), group }`. Adding a
  facet must not require touching the engine.
- Multi-select within a facet is **OR**; across facets it is **AND**.
- Sorts are declared as `{ key, label, compare, defaultDirection }`, with an explicit direction toggle and a documented
  stable tie-break chain. Missing values sort last in both directions.
- The default query for an album is a declared constant, so "Reset to default" is exact.
- Results, counts and group headers come out of one pass; the whole thing is deterministic and framework-free.

### Chrome components

In `apps/web/src/ui/album/`: `AlbumChrome` (title, completion, segmented ownership, sticky search + Sort + Filter),
`FilterTray` (bottom sheet, collapsible sections, option counts, disabled zero options, Clear all, Apply showing the
pending result count), `SortMenu`, `FilterChips`, `DensityToggle`, `SavedViewsMenu`, `VirtualGrid`.

- The sticky bar survives scrolling; search expands in place and debounces at 120 ms.
- Chips scroll horizontally, each removable, with clear-all at the end, and the result count sits above the grid.
- The tray opens at a comfortable height, is dismissible by drag from its handle, and applies on Apply — not on every tap.
- A saved view stores filters, sort, grouping and density under a 1–40 character name, with at most 20 per album.
- `VirtualGrid` windows a fixed-height grid, keeps ±1 screen of overscan, restores scroll position on return, and falls
  back to plain rendering when the list is under 60 items.
- Everything is keyboard and VoiceOver reachable: the tray is a focus-trapped dialog that restores focus on close, and
  every control has a name and a state.

### Shared list behaviours

- **Tiles carry decision data** and their **secondary line follows the active sort** (release → date, total stats →
  total, level → level). A sort whose value is invisible on the tile is a bug.
- **NEW markers:** entries whose ids are not in the device-local seen set get the NEW treatment until opened. Seeding on
  a fresh device marks everything already present as seen, so a first launch is not a wall of NEW.
- **Quick filter presets** as a one-tap row: Trainable now · Ready to promote · Maxed · Equippable at my tier · Unowned.
  Presets set the query; they are not saved views and never overwrite one.
- **Multi-select → Compare** for two or three entries: a sheet with one column per entry, rows for the comparable
  fields, and differences emphasised. Multi-select never acts on items hidden by the current filter.
- **Long-press quick actions** on a tile: Train · Race · Set featured · Deck for an Uma. Every action has an accessible
  equivalent reachable without a long press.
- **Empty states name the single filter to drop** when removing exactly one facet would return results.
- Group headers carry completion counts that link to the matching badge definition.
- A parameterised sort ("best aptitude for…") exposes its parameter as a chip beside the sort control.

### Stable adoption

- Default order exactly as documented: owned before unowned → release date newest → Uma level highest → name.
- Sorts: release date · level · name · tier · Training Level · total stats · prestige · badges earned · recently raced ·
  best aptitude for a chosen surface or distance. **"Recently trained" is not implementable** — no save timestamps and no
  per-entity ledger rows — so it is deliberately absent (D114); "recently raced" comes from race history.
- Facets: ownership · tier · surface / distance / strategy aptitude · minimum aptitude grade · real-horse sex · level
  range · launch roster · has parent snapshot · Journey state · holds a title · ready to train.
- Tiles are art-first per the visual system: portrait, name, level, tier crest, a compact aptitude line, at most two
  state chips; unowned is desaturated art with a lock.
- **Two grouping modes for 267 outfits over 134 characters:** by outfit (default) and **by character** — one tile per
  character showing her best-owned outfit with a `×N` count, expanding to her outfits, where ownership means "owned in
  any outfit". The mode is part of the saved query.
- The Uma profile gains **swipe between results in the filtered order**, with the order handed over by the route rather
  than recomputed, and the album restores its scroll position on back.
- The shard and coupon strip stays above the chrome.

## Tests

- Engine: AND across facets, OR within a facet, range and boolean facets, counting with the own-facet exclusion, every
  sort including direction and tie-breaks, missing values last, grouping headers and counts, and the exact default query.
- Saved views: create, apply, rename, delete, the 20 cap, and the 1–40 character name rule.
- Preferences: persist and reload, and a corrupt or unknown stored preference falls back to the default query without
  throwing.
- `VirtualGrid`: window maths at both densities, the small-list fallback, and scroll restoration.
- Stable: default order on a synthetic roster, a filter combination that yields zero results shows the empty state with
  Clear all plus the single-facet suggestion when one exists, and the profile swipe order matches the filtered order.
- Character mode: outfits collapse to one tile per character with the right count and best-owned representative, and
  ownership means owned in any outfit.
- NEW markers: unseen ids are marked, opening clears them, and a fresh device seeds everything as seen.
- Presets produce exactly their documented query; Compare renders two and three columns and ignores hidden selections.

## Acceptance

- `pnpm lint && pnpm test && pnpm build` pass; startup stays at or below 180 KB gzip.
- In the browser at 390×844: the unfiltered Stable scrolls smoothly end to end, filters apply in under 100 ms, chips and
  counts agree with the grid, and returning from a profile lands on the same scroll position.
- The PR includes screenshots of the chrome, the tray, an active-chip state, and both densities.
- This spec is deleted in the same PR (D104).

## Out of scope

Card facets and card detail (T034), deck editor changes, gameplay or reward changes, new content fields, and cross-device
sync of album preferences.
