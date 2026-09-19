# T032 — Original icon set (Milestone 9, part 3)

**Outcome:** no emoji anywhere in the product. One original, project-owned icon set carries navigation, currencies,
stats, states and actions.

Emoji are the loudest reason the app reads as amateur: they are someone else's art, at a different weight, colour and
optical size than everything around them. Read [Visual System — Iconography](../design/visual-system.md#iconography).

## Fixed choices

- **Project-owned SVG only.** Drawn for this repo, or a properly licensed open set that is adapted to the grid. No
  original-game UI art, ever, and no icon font.
- Geometry: 24 px grid, 1.75 px strokes, **curve-led silhouettes**, rounded joins, optical alignment over mathematical.
- Variants: line (default), solid (active), and **two-tone illustrated** for the five tab icons and the three
  currencies — those carry the personality.
- Icons are inline React components using `currentColor`, tree-shakeable, with no runtime sprite fetch.
- Every icon has an accessible name or is explicitly `aria-hidden` beside a visible label.

## Inventory

At minimum, replacing what exists today:

| Group | Icons |
|---|---|
| Navigation | Home · Stable · Race · Cards · Badges |
| Currency | Training Ticket · Card Select Coupon · Uma Shard / Uma Select Coupon |
| Stats and facilities | Speed · Stamina · Power · Guts · Wit · Skill Points |
| Race | Grade crest · surface (turf, dirt) · distance · strategy (front, pace, late, end) · gate · finish · trophy |
| Progression | Level up · promotion gate · Training Level · scenario crest · goal target · ribbon · honors |
| Collection | Owned · locked · limit break · maxed · era · deck slot · coupon |
| System | Search · sort · filter · density · chevrons · close · check · warning · error · offline · sync · settings · retry |

## Contract

- One module per icon under `apps/web/src/ui/icons/`, exported through a barrel with a typed name union.
- Icons accept `size` (16 / 20 / 24 / 32) and inherit colour; the two-tone set takes an accent prop defaulting to the
  accent token.
- PWA icons (apple-touch, 192, 512, maskable) are regenerated from the new mark, verified at Home Screen size and inside
  the maskable safe zone. `apps/web/scripts/generate-icons.mjs` is updated rather than bypassed.
- Bundle cost: the set must add no more than **8 KB gzip** to the startup chunk; anything heavier is lazy-loaded with
  its screen. Report the measured delta.

## Tests and verification

- A snapshot test renders every icon at 24 px and asserts unique names and no stray `fill` values.
- A guard test fails if an emoji character appears in `apps/web/src` outside test fixtures.
- Verify the tab bar, currencies and the Training facility icons in the browser at 390×844, and attach a contact sheet of
  the whole set to the PR.

## Acceptance

- `pnpm lint && pnpm test && pnpm build` pass, the emoji guard passes, and the bundle delta is within budget.
- The PR shows the set rendered together, plus the tab bar and Home before/after.
- This spec is deleted in the same PR (D104).

## Out of scope

Bespoke badge or trophy illustrations (Milestone 11), character and card art (private content), audio, and any layout
change.
