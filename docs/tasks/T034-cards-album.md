# T034 — Cards album and card detail (Milestone 10, part 2)

**Outcome:** the 312-card album gets the same browsing power as the Stable, plus a card detail worth opening, and coupon
redemption stops being a separate, weaker list.

**Prerequisite:** T033 has merged. Reuse its engine and chrome as they are; if a card facet needs a new facet *kind*,
extend the engine generically rather than special-casing cards.

Read [Collection — Card album](../design/collection.md#card-album) and
[Support Cards](../design/support-cards.md).

## Fixed choices

- Default order exactly as documented: owned before unowned → era/release newest → card level highest → name.
- Friend and Group cards are **listed and filterable now**; their gameplay stays inactive until Milestone 8 ships, and
  the existing "collectible now" note stays accurate.
- No change to card effects, limit-break rules, coupon rules or any generated value.

## Implementation contract

### Album

- Sorts: era/release · card level · limit break · type · character name · card name · effect strength for a chosen
  effect. **"Recently used" is not implementable** and is deliberately absent (D114).
- Facets: ownership · type (including Friend and Group) · era · limit break 0–4 · level range · maxed · equippable now
  (era ≤ a chosen tier) · currently equipped (and by which Uma) · starter/free · effect kind (friendship, training, race
  bonus, SP, initial stats) · hint skill matching the search term.
- Grouping by era or by type inserts sticky headers carrying that group's completion count; the tray's section headers
  show the same completion counters the design doc promises.
- Tiles are art-first: card art, type dot, LB pips, level on the scrim, the card's headline effect, an accent frame when
  maxed, and desaturated art with a lock when unowned. NEW markers, presets, Compare and long-press actions come from
  T033; cards add *Limit break* and *Where equipped* as their quick actions, and Compare shows effect values at the
  current level beside the next limit break.
- Search covers card title **and** character name.

### Card detail

A bottom sheet, opened from a tile, showing:

- Card art, character, type, era, ownership, level and limit break with the next-LB cost.
- **Effect values at the current level next to the values at the next limit break**, using the existing generated
  projection — no new numbers, no copied source values.
- Hint skills, with each skill's name resolved from private content and a safe fallback when content is missing.
- Which Umas currently have it equipped, linking to each deck.
- The limit-break action with its exact ticket cost, reusing the existing atomic promotion path, and a disabled state
  with the reason when it is unavailable.
- Swipe left/right moves through the filtered order, as the Uma profile does.

### Deck editor

The deck editor becomes a consumer of this album rather than a second, weaker picker: the same chrome and facets with
ownership forced to Owned and era-eligibility pre-applied, opened as a picker that returns the chosen card. Existing
deck validation, ordering, Auto fill and save behaviour are unchanged.

### Redemption

Coupon redemption reuses `AlbumChrome` with ownership forced to Unowned and the ownership segment hidden, keeps its
coupon balance header, and still commits before opening the read-only reveal route. No change to redemption semantics.

## Tests

- Default order on a synthetic catalogue, including the owned/unowned split and the level tie-break.
- Each card facet, including equippable-at-tier, currently-equipped, effect kind and the hint-skill search.
- Group headers carry the right completion counts per era and per type.
- Detail: current versus next-LB values come from the existing projection, the limit-break action is disabled with a
  reason when tickets are short or the card is maxed, and a missing hint skill degrades safely.
- Redemption keeps forcing Unowned and still commits before navigating.
- The deck editor picker returns a valid card, refuses an era-locked or duplicate pick with the existing structured
  error, and leaves deck ordering and Auto fill untouched.

## Acceptance

- `pnpm lint && pnpm test && pnpm build` pass; startup stays within budget.
- In the browser at 390×844: the full album scrolls smoothly, a five-facet combination resolves instantly, detail opens
  and swipes, and one real limit break works from the sheet.
- The PR includes screenshots of the album, an active-filter state, grouped-by-era, and the detail sheet.
- This spec is deleted in the same PR (D104).

## Out of scope

Friend/Group gameplay (T024), deck editor redesign, new effects or values, and cross-device sync of album preferences.
