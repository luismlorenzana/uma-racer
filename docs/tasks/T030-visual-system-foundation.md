# T030 — Visual system foundation (Milestone 9, part 1)

**Outcome:** the Paddock system exists in code — tokens, fonts, primitives — and Home and Stable are rebuilt with it as
the worked reference every other screen copies.

**Owner: Claude.** This one is taste-driven: it needs iteration in the browser at 390×844, judgement calls about
proportion and restraint, and a reference that is good enough to imitate. T031 and T032 are delegable once it lands.

The contract is [Visual System — "Paddock"](../design/visual-system.md), and the reasoning is in
[Game UI Reference](../research/game-ui-reference.md).

## Fixed choices

- Tokens live in `apps/web/src/index.css` under `@theme`, exactly as named in the visual system. Components read tokens;
  raw hex in a component is a bug.
- Fonts: **Outfit** (display, numerals) and **Inter** (UI), both OFL, self-hosted, **latin subset only**, variable where
  that is smaller. M PLUS Rounded 1c survives only in the wordmark. Total font payload must fit the 180 KB gzip startup
  budget together with the app shell; measure before and after.
- No new runtime dependency.
- No gameplay, projection, persistence or copy change. Screens keep their structure and their information.

## Deliverables

1. **Tokens:** surfaces (page, panel, raised, sunken, inverse, scrim), ink ramp, accent, turf/dirt, stat colours, tier
   metals, semantics, radii, the chamfer size, three elevations, motion durations and easings, density metrics.
2. **Typography:** the two families wired up with the documented size and weight ladder, tabular numerals, the `micro`
   uppercase label style, and an `<Numeral>` component implementing the embossed treatment (gradient fill, 1 px stroke,
   inner shadow) for stats, levels, placements, rewards and counts.
3. **Primitives** in `apps/web/src/ui/`, replacing or restyling what exists: `Button` (primary, secondary, tertiary,
   destructive, icon; press scale 0.98; no slab), `Chip`, `SegmentedControl`, `Panel`, `Row`, `Meter` (sunken track, soft
   cap tick at 1200), `Sheet` (restyled `BottomSheet`, drag from handle only), `Crest`, `ArtTile` (cover-crop,
   top-anchored, scrim, hairline inner border, optional chamfer), `Placeholder` (labelled missing-content state).
4. **Reference screens:** Home and Stable rebuilt on the primitives — Home with the full-bleed portrait hero, Stable with
   art-first tiles in both densities. These two are the pattern library other screens copy.
5. **Docs:** update the visual system doc if reality forces a change, and record the chosen font payload and bundle
   delta in the PR.

Emoji stay until T032; mark each with `TODO(T032)`.

## Tests and verification

- Render tests for the primitives: variants, disabled states, accessible names, and `Placeholder` fallback.
- A token test asserts every documented token exists, so a rename fails loudly.
- Existing Home and Stable tests keep passing; update only assertions that name a class or label deliberately changed.
- Browser verification at 390×844: Home, Stable in both densities, reduced motion, long names, missing art, and a
  contrast check on text over scrims.
- Record startup bundle size before and after.

## Acceptance

- `pnpm lint && pnpm test && pnpm build` pass; startup at or below 180 KB gzip including fonts.
- Home and Stable look like the intended game and nothing else regressed visually.
- Before/after screenshots in the PR; this spec is deleted in the same PR (D104).

## Out of scope

Rolling the system across other screens (T031), the icon set (T032), album browsing chrome (Milestone 10), audio,
celebration choreography, and anything inside the PixiJS race scene.
