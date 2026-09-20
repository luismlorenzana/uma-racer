# Visual System — "Paddock"

The skin the game wears. This supersedes the "Racecourse Pop" table in [UX](ux.md#visual-direction) (D111); ux.md keeps
navigation, the screen inventory, and the feedback catalogue.

**The brief:** it should feel like the real *Umamusume* — bright, warm, art-forward, one-handed — with the restraint of a
modern HoYoverse menu. The research and the diagnosis of what is wrong today live in
[Game UI Reference](../research/game-ui-reference.md).

**Three rules that decide most arguments:**

1. **The art leads.** Portraits are large, cropped to the face, and everything else is a frame around them.
2. **One accent.** Gold marks what you can act on and what you have earned. Everything else is a neutral or a
   desaturated role colour.
3. **Decoration is a motif, not a texture.** The chamfered corner, the embossed numeral and the second-layer motion each
   appear once or twice per screen, never everywhere.

## Surfaces

| Token | Value | Use |
|---|---|---|
| `--surface-page` | `#EDF1F6` with a faint turf wash at the bottom edge and 2% grain | The page behind everything. No saturated gradients |
| `--surface-panel` | `#FFFFFF` · hairline border `rgb(16 26 36 / 0.08)` | Ordinary content panels |
| `--surface-raised` | `#FFFFFF` · shadow-2 | Sheets, menus, anything floating |
| `--surface-sunken` | `#E4EAF2` | Wells: inputs, meters, empty slots |
| `--surface-inverse` | `#101A24 → #16222E` vertical, light text | Immersive scenes: race, training, reveals, results |
| `--surface-scrim` | `transparent → rgb(16 26 36 / 0.72)` | Over portrait art, always, so text stays legible |

Three levels is the whole system. A panel inside a panel drops to a hairline divider instead of stacking another card.

## Colour

| Role | Token | Value |
|---|---|---|
| Ink | `--ink` / `--ink-muted` / `--ink-faint` | `#101A24` / `#5A6B84` / `#8A98AC` |
| On inverse | `--ink-on-dark` / `--ink-on-dark-muted` | `#F2F6FA` / `#A8B6C6` |
| Accent (silks gold) | `--accent` / `--accent-strong` | `#D39A2B` / `#B87F18` |
| Turf | `--turf` | `#2F7A4F` |
| Dirt | `--dirt` | `#8A6A4B` |
| Speed · Stamina · Power · Guts · Wit | `--stat-*` | `#2F6FE0` · `#D6483F` · `#E07B22` · `#D24E8C` · `#1F9A70` |
| Tier metals | `--tier-*` | bronze `#B07A46` · silver `#9AA6B5` · gold `#D9A62B` · platinum `#6FB7D9` · rainbow gradient |
| Semantic | `--success` / `--danger` / `--warning` / `--info` | `#2F7A4F` / `#C23B33` / `#D08A0E` / `#2F6FE0` |

Stat colours are one notch less saturated than today's, and they appear as **meters, dots and 2 px accents** — never as
a filled pill behind text. Tier metals belong to flair only. Text contrast stays at 4.5:1 or better, and state is never
carried by colour alone.

## Type

Two faces, both OFL and self-hosted, latin subset only:

| Role | Face | Sizes |
|---|---|---|
| Display: headings, numerals, buttons | **Outfit** 600/700, tabular numerals | 44 hero · 32 display · 24 display-sm · 20 title |
| UI: body, labels, rows, chips | **Inter** 400/500/600 | 17 title-sm · 15 body · 13 body-sm · 12 label · 11 micro |
| Wordmark only | a drawn mark, arriving with the icon set (T032) | the logo, nowhere else |

- `micro` is uppercase with `0.06em` tracking, used for section labels — the small-caps texture that makes a game UI
  read as designed rather than as a form.
- **Key numerals get the embossed treatment** borrowed from Umamusume: a light top shadow and a soft dark drop, applied
  with the `.numeral` utility. Big stat values, race placements, level numbers and reward counts only, never body text.
  Over dark surfaces add `.numeral-on-dark`. (Emboss comes from shadows rather than `background-clip: text`, so a glyph
  can never vanish on an unexpected background.)
- Line height 1.2 for display, 1.45 for body. One weight step between a row's primary and secondary text.

## Shape and depth

- Radii: `--r-xs 6` chips · `--r-sm 10` controls · `--r-md 14` panels · `--r-lg 18` sheets · pill for filters.
- **Chamfer motif:** one 12 px cut corner (top-right by default) on hero cards, tier crests and the active tab
  indicator. At most two chamfered elements per screen.
- Elevation: `shadow-1 0 1px 2px rgb(16 26 36/.06)` · `shadow-2 0 6px 16px -6px rgb(16 26 36/.18)` ·
  `shadow-3 0 18px 40px -12px rgb(16 26 36/.28)` for sheets. Hairline borders do most of the separation work; shadows
  are for things that actually float.
- **No slab buttons.** The 3D bottom edge goes away.

## Components

| Component | Direction |
|---|---|
| Primary button | Accent fill, ink text, `--r-sm`, 48 pt tall, press = scale 0.98 and drop to shadow-1. Loading state keeps the label |
| Secondary | Panel fill with hairline border. Tertiary is text plus icon. Destructive is a danger outline |
| Chip / filter | 32 pt pill, hairline border, selected = accent 12% fill with accent border and a check |
| Segmented control | Sunken track, raised thumb, 2–4 segments, for ownership and density |
| Panel | Panel surface, `--r-md`, hairline, 16 px padding, optional `micro` section label above |
| Row | 56 pt, art or icon left, primary 15 / secondary 13, value right in display numerals |
| Meter | Sunken track, 6 pt tall, stat colour fill, soft cap marked by a 1 px tick at 1200 |
| Tab bar | Translucent inverse bar with blur, 5 illustrated icons, active tint accent with a chamfered underline; Race stays raised but becomes a flat accent disc with a hairline ring, not a candy dome |
| Top bar | Transparent over art or panel elsewhere. Currencies are icon + display numeral, tappable |
| Bottom sheet | Raised surface, `--r-lg` top corners, grab handle, drag from the handle only (unchanged) |
| Uma tile | **Art first:** portrait fills the tile, scrim at the bottom, name + level over the art, state chips top-left, tier crest top-right |
| Card tile | Card art fills, type dot + LB pips on the scrim, level bottom-right, unowned = desaturated art at 35% with a lock, never a grey box |

## Iconography

- One original set: 24 px grid, 1.75 px strokes, **curve-led silhouettes** (the Umamusume rule), rounded joins, optical
  alignment over mathematical.
- Line by default, solid for active states, and **illustrated two-tone versions for the five tab icons and the three
  currencies** — those are the ones that carry personality.
- Every icon ships with an accessible name. **No emoji in the product** once the set lands.

## Art treatment

- Portraits are cover-cropped and **top-anchored** so faces never get cut, over `--surface-scrim`, with a 1 px inner
  light border.
- **Three art tiers** (see [Collection](collection.md#art-tiers)): 128 px atlased icons for grids, 512 px transparent
  portraits for Umas, and 450×600 illustrations for cards. The large tiers are per-entry files fetched on demand, so a
  grid never waits on them and a screen shows the icon until the art arrives.
- Full-body Uma art is not available from any documented source; the 512 px portrait is the ceiling.
- Reveals and results put art at full width; the panel is a frame, not a container.
- Missing or retired content shows a labelled placeholder with the same silhouette, never a broken-image grey box.

## Motion

- Durations: 120 ms fast · 180 ms standard · 260 ms emphasised. Standard easing `cubic-bezier(.2, 0, 0, 1)`.
- Lists stagger at 24 ms per item, capped at 8 items.
- **Second layer:** on a major transition, one small element (a dot row, a rule, a chip) follows the main shape ~80 ms
  later. This is most of why HoYoverse menus feel expensive.
- Springs are reserved for reward moments: level-ups, limit breaks, coupon reveals, badge tiers.
- Reduced motion keeps every state change, drops movement, and never changes timing of a commit.

## Density

Albums carry a **Comfortable / Compact** toggle: 2-up art tiles versus 3-up tiles with a shorter scrim, and 56 pt versus
44 pt rows. The choice is remembered per device. Everything else stays comfortable.

## Working rules

- Tokens live in `apps/web/src/index.css` under `@theme`; components read tokens, never raw hex.
- Tailwind utilities are fine; one-off colours are not.
- Animate transform and opacity only in the DOM; keep PixiJS, Firebase and fonts lazy; the startup bundle stays at or
  below 180 KB gzip, and the two font families must fit inside that budget as latin-only woff2.
- Every screen is designed at 390×844 first, with 44 pt targets and safe-area padding.
