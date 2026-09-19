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
T033 album engine + Stable    (delegable)
        │
        ▼
T034 Cards album + card detail  (delegable)
```

| Task | Result | Must not absorb |
|---|---|---|
| [T033](T033-album-engine-and-stable.md) | The shared chrome, facet engine, saved views, density, virtualization, and the Stable using all of it | Card-specific facets, gameplay changes, new rewards |
| [T034](T034-cards-album.md) | The Cards album and card detail on the same engine, plus redemption reusing the chrome | New card mechanics, Friend/Group gameplay (M8) |

Both depend on Milestone 9's visual system for tiles and controls. If Milestone 9 has not landed, build against the
tokens and accept a second cosmetic pass.

## Definition of done

- Both albums open on their documented default order without anyone touching a control.
- Every documented facet works, shows counts, never offers a zero-result dead end, and appears as a removable chip.
- Saved views, density and grouping persist per device and survive reload.
- Scrolling the full unfiltered album stays smooth on the owner's iPhone, and returning from a detail restores position.
- `pnpm lint`, `pnpm test`, `pnpm build` pass, startup stays within budget, and the design doc matches what shipped.
