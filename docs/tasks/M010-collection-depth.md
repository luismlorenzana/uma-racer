# Milestone 10 — Collection depth

**Outcome:** browsing 267 Umas and 312 cards on a phone is fast, clean and genuinely enjoyable — the collection pillar
finally behaves like the main attraction it was always meant to be.

The contract is [Collection — Albums](../design/collection.md#albums): one shared browsing chrome, opinionated default
sorts, deep facets, saved views, density, and art-first tiles. The patterns are grounded in
[Game UI Reference](../research/game-ui-reference.md).

## Why it is a milestone of its own

Collection was named a core pillar from the first conversation, and the albums today offer a handful of chips and a
single sort. With three hundred entries each, that is a wall, not a collection. The work is also genuinely shared: one
engine serves the Stable, the Cards album, coupon redemption, and later the deck editor.

## Sequence

```text
T033 album engine + Stable       ✅ landed 2026-09-19
        │
        ▼
T034 Cards album + deck editor   ✅ landed 2026-09-19
        │
        ▼
T035 Race Select                 (delegable)
```

| Task | Result | Must not absorb |
|---|---|---|
| T033 ✅ | The shared chrome, facet engine, saved views, density, virtualization, and the Stable using all of it | Card-specific facets, gameplay changes, new rewards |
| T034 ✅ | The Cards album, card detail, redemption **and the deck editor** on the same engine | New card mechanics, Friend/Group gameplay (M8) |
| [T035](T035-race-select-browsing.md) | Race Select — the third long list — with aptitude fit, series filters and pinned goal targets | Race rules, rewards, the Pixi scene |

All three build on Milestone 9's [visual system](../design/visual-system.md), which has landed. T035 also reuses the
shared Uma picker (`ui/album/UmaPickerSheet`, D181) that Race Select already uses to switch Umas.

## Definition of done

- Both albums and Race Select open on a sensible default order without anyone touching a control.
- Browsing matches the shape of the real game: dense image-only tiles, a reserved detail area, and view modes.
- Tiles carry the data the sort is about, entries can be compared, and quick actions work without a detour.
- The Stable can be browsed by character as well as by outfit, and the deck editor uses the album rather than its own
  weaker picker.
- Every documented facet works, shows counts, never offers a zero-result dead end, and appears as a removable chip.
- Saved views, density and grouping persist per device and survive reload.
- Scrolling the full unfiltered album stays smooth on the owner's iPhone, and returning from a detail restores position.
- `pnpm lint`, `pnpm test`, `pnpm build` pass, startup stays within budget, and the design doc matches what shipped.
