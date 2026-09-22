# T031 — Visual rollout across every screen (Milestone 9, part 2)

**Outcome:** every screen uses the Paddock system. Nothing in the app still carries the old skin.

**Prerequisite:** T030 has merged, so the tokens, fonts and primitives exist and Home plus Stable are the worked
reference. Read [Visual System](../design/visual-system.md) and copy how those two screens do it. Read
[UX](../design/ux.md) for each screen's purpose before touching it.

## Fixed choices

- **This is a re-skin, not a redesign.** Screen structure, copy, flows and information stay as they are unless the visual
  system explicitly calls for a change (art-first tiles, density, chamfer motif, embossed numerals).
- No gameplay, persistence, projection or rule change of any kind. No new features.
- Components read tokens. A raw hex value, an ad-hoc shadow, or a one-off radius in a screen file is a bug.
- Emoji may remain **only** where T032 has not yet landed its replacement icon; leave a `TODO(T032)` comment and list
  them in the PR.

## Scope, screen by screen

Work in this order, one commit per group, all in one PR:

1. **Race:** Race Select, pre-race, `RaceRunScreen` HUD and results (the Pixi scene itself is untouched; only DOM chrome).
2. **Training and minigames:** Training-scene header/stat strip, constellation chrome and node sheets, card-set tab,
   Spark Match, Bond Recall, Training Level and bond result summaries.
3. **Cards:** Collection/scenario album lenses, card page, card-set picker, unlock and reveal routes.
4. **Scenario:** profile start/advance actions, Journey medallions, scenario history and advancement feedback.
5. **Badges and Trainer:** collection page, detail, timeline, showcase editors, trainer profile.
6. **Settings** and any remaining placeholder route.

T030 already did the shell (TopBar, TabBar, AppShell, ScreenState), Home and Stable; use them as the reference.

For each screen: replace surfaces with the three defined levels, apply the type ladder (micro labels, display numerals,
body text), swap slab buttons for the new button set, desaturate stat colours to the tokens, apply art-first treatment
where portraits or card art appear, and apply the standard motion durations.

## Contract

- **Sheets and menus** use the existing `BottomSheet` (drag from the handle only) restyled to `--surface-raised`.
- **Meters** get the sunken track and the 1 px soft-cap tick at 1200.
- **Numbers** that represent a stat, level, placement, reward or count use display numerals with the embossed treatment;
  everything else does not.
- **Reduced motion** keeps every state change and drops movement, on every screen touched.
- **Missing content** renders the labelled placeholder from the visual system, never a grey box or a broken image.
- Delete dead styles as you go. Two things must be gone by the end of this task: the deprecated `Racecourse Pop` alias
  block in `index.css` (`--color-sky*`, `--color-cream`, `--color-gold*`, `--color-turf-deep`), and the `GameButton`
  compatibility shim.

## Tests and verification

- Existing tests must keep passing; update only assertions that name a class or a label you deliberately changed.
- The web package has no DOM test environment yet. Add `jsdom` and `@testing-library/react` as dev dependencies —
  justified in the PR — and cover the primitives: every `Button` variant and disabled state, `Chip` selected state,
  `SegmentedControl` selection, `ArtTile` dimmed/placeholder fallback, and `Placeholder`'s accessible name.
- Keep `apps/web/src/ui/tokens.test.ts` passing; extend it when you remove the alias block.
- Verify in the browser at 390×844 for every screen in the list, in both densities and with reduced motion on, and
  attach before/after screenshots of at least Race Select, the Training scene, one minigame, Cards, Badges and Results
  to the PR.
- Record the startup bundle size before and after; it must stay at or below 180 KB gzip.

## Acceptance

- `pnpm lint && pnpm test && pnpm build` pass.
- `rg` finds no `Racecourse Pop` token, no slab-button styling, and no emoji outside the `TODO(T032)` list.
- Every screen in the scope list has a before/after screenshot in the PR.
- This spec is deleted in the same PR (D104).

## Out of scope

Icons (T032), audio and haptics, celebration choreography, the album browsing chrome (Milestone 10), any layout the
visual system does not call for, and anything inside the PixiJS race scene.
