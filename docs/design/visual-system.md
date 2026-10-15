# Visual System — "Paddock"

The skin the game wears. This supersedes the "Racecourse Pop" table in [UX](ux.md#visual-direction) (D111); ux.md keeps
the shell and navigation, the screens, plain words and the albums.

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
| `--surface-inverse` | `#101A24 → #16222E` vertical, light text | Immersive scenes: race, reveals, results |
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
| Speed · Stamina · Power · Guts · Wit | `--stat-*` | `#0980E6` · `#DD4433` · `#E66E00` · `#F1368B` · `#05A371`: the original's own, the rims of its type icons (D183) |
| Tier metals | `--tier-*` | bronze `#B07A46` · silver `#9AA6B5` · gold `#D9A62B` · platinum `#6FB7D9` · rainbow gradient |
| Semantic | `--success` / `--danger` / `--warning` / `--info` | `#2F7A4F` / `#C23B33` / `#D08A0E` / `#2F6FE0` |

Stat colours are the original's (D183), and they appear as **meters, dots, 2 px accents and the type icons** — never as
a filled pill behind text. Tier metals belong to flair only. Text contrast stays at 4.5:1 or better, and state is never
carried by colour alone.

## Type

Two faces, both OFL and self-hosted, latin subset only:

| Role | Face | Sizes |
|---|---|---|
| Display: headings, numerals, buttons | **Outfit** 600/700, tabular numerals | 44 hero · 32 display · 24 display-sm · 20 title |
| UI: body, labels, rows, chips | **Inter** 400/500/600 | 17 title-sm · 15 body · 13 body-sm · 12 label · 11 micro |
| Wordmark only | the drawn mark (a horseshoe holding a spark) beside the name set in Outfit | the logo, nowhere else |

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
| Tab row (`ui/Tabs`) | Sunken track, raised thumb, 2–4 tabs at 44 pt |
| Panel | Panel surface, `--r-md`, hairline, 16 px padding, optional `micro` section label above |
| Row | 56 pt, art or icon left, primary 15 / secondary 13, value right in display numerals |
| Meter | Sunken track, 6 pt tall, stat colour fill, soft cap marked by a 1 px tick at 1200 |
| Bottom bar | A floating translucent panel with blur and a hairline border: four page tabs and the ☰ menu. The active tab is two-tone with a chamfered accent underline; RACE is raised as a flat accent disc with a hairline ring, not a candy dome |
| Account bar | Translucent panel with blur and a hairline under it. The trainer's initial on an accent disc, then the currencies as icon + display numeral chips, each a 44 pt link |
| Bottom sheet | Raised surface, `--r-lg` top corners, grab handle, drag from the handle only (unchanged) |
| Uma tile | **Art first:** her bust (her icon until it arrives) fills the square tile, name and level under it, tier crest and NEW top-left, Ready dot and planner crosshair top-right; locked = art dimmed to 45% at half saturation behind a lock, never a grey box ([UX](ux.md#icon-overlays)) |
| Card tile | Card icon fills the tile; distance top-left, running style top-right, type bottom-left, bond pill bottom-right (D238); a card past her scenario is dimmed the same way behind a lock |

## Iconography

- One original set: 24 px grid, 1.75 px strokes, **curve-led silhouettes** (the Umamusume rule), rounded joins, optical
  alignment over mathematical.
- Line by default, solid for active states, and **illustrated two-tone versions for the four page tabs and the three
  currencies** — those are the ones that carry personality.
- Every icon ships with an accessible name. **No emoji in the product** once the set lands.
- **Stats and card types have one icon each** (D183), `ui/TypeIcon`: our own drawings in the original's style, a
  rounded tile with a darker rim, a top-to-bottom gradient and a white glyph (boot, heart, flexed arm, flame,
  mortarboard), and the light Friend and Group tiles with their figures, in colours sampled from the original's icons.
  They ship with the app, so they draw before content loads and stay crisp at any size; the line set keeps no stat
  glyphs.
- The set lives in `apps/web/src/ui/icons/`: one module per icon, a typed `IconName` union, sizes 16 / 20 / 24 / 32 in
  `currentColor`. Each drawing has three layers: the outline, the inner marks (knocked out of a solid silhouette), and
  the tone that duotone paints in the accent (or `accent`, such as the panel white on the raised Race tab). An icon
  is decorative unless it gets a `title`.
- Tabs: line at rest, two-tone when active. Currencies are always two-tone. The race controls and the album's chosen
  view use solid. Tier metals colour the flair medal; the stage label still names the tier.
- Every definition is `/* @__PURE__ */`, so a screen ships only the icons it draws; the shell's icons add about 2 KB
  gzip to startup. Tests pin the drawings and fail on any emoji, or on any symbol-font glyph standing in for an icon.
  Typography stays: `·`, `—`, `…`, `→` in copy, `×` in counts, `★` in ratings.
- The mark is a gold horseshoe, open to the sky, holding a spark, on the stage. `apps/web/scripts/generate-icons.mjs`
  draws the Home Screen PNGs and `icon.svg` (the favicon) from the same numbers, inside the maskable safe zone.

## Art treatment

- Portraits are cover-cropped and **top-anchored** so faces never get cut, over `--surface-scrim`, with a 1 px inner
  light border.
- **Four art tiers** (see [UX](ux.md#art-tiers)): 128 px atlased icons for card grids, 256 px
  head-and-shoulders busts for every list of Umas, 512 px transparent portraits for Umas, and 450×600 illustrations for
  cards. Busts sit on a panel-to-sunken gradient, since the portrait's transparency carries through. Everything but
  the icon is a per-entry file fetched on demand, so a list never waits on it and a screen shows the icon until the
  art arrives.
- Full-body Uma art is not available from any documented source; the 512 px portrait is the ceiling.
- Reveals and results put art at full width; the panel is a frame, not a container.
- Missing or retired content shows a labelled placeholder with the same silhouette, never a broken-image grey box.

## Motion

- Durations: 120 ms fast · 180 ms standard · 260 ms emphasised. Standard easing `cubic-bezier(.2, 0, 0, 1)`.
- Lists stagger at 24 ms per item, capped at 8 items.
- **Second layer:** on a major transition, one small element (a dot row, a rule, a chip) follows the main shape ~80 ms
  later. This is most of why HoYoverse menus feel expensive.
- Springs are reserved for reward moments: the placement stamp, level-ups, goal ribbons and a new Uma's reveal. (Sheets
  and the art viewer also open on a spring, and a meter fills on one unless it tracks a live value.)
- Reduced motion keeps every state change, drops movement, and never changes timing of a commit.

## Density

Albums carry a **view switch** rather than a density toggle: Icons (3-up tiles), Cards (2-up, larger art) and List
(full-width rows). The choice is remembered per album on the device ([UX](ux.md#view-modes)). Everything else stays
comfortable.

## Working rules

- Tokens live in `apps/web/src/index.css` under `@theme`; components read tokens, never raw hex.
- Tailwind utilities are fine; one-off colours are not.
- Animate transform and opacity only in the DOM; keep PixiJS, Firebase and fonts lazy; startup JS stays at or below
  180 KB gzip. The two font families ship as latin-only woff2 with `font-display: swap`, precached, at no more than
  96 KB together (D167).
- Every screen is designed at 390×844 first, with 44 pt targets and safe-area padding.
