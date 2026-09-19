# Game UI Reference: what to copy, and what is wrong today

Research for the visual rework ([Visual System](../design/visual-system.md)). The goal the owner set: it should feel like
the real *Umamusume* — a polished, art-forward mobile game — with the restraint and precision of a modern HoYoverse
interface, instead of what it looks like now.

## The honest diagnosis

The current skin ("Racecourse Pop") reads as a late-1990s children's web game. That is not one bad choice, it is eight
small ones compounding:

| # | What we do | Why it reads as cheap |
|---|---|---|
| 1 | Emoji as interface icons (🏠 🐴 🏁 🃏 🏅 🎫 🎯) | The single loudest tell. Emoji are someone else's art, at a different weight, colour and optical size than everything around them |
| 2 | A saturated sky-blue page gradient behind every screen | Full-saturation background gradients are the default look of hobby web apps; real game UIs put art, texture or a quiet neutral back there |
| 3 | Pure white panels, 20 px radius, soft drop shadow, everywhere | One surface level repeated. No hierarchy, no material, no depth |
| 4 | A rounded display face (M PLUS Rounded 1c) used for **everything** | Rounded type at every size and weight is what makes a UI read as "for children". Real games use rounding as an accent, not a system |
| 5 | Chunky buttons with a hard bottom edge and gradient faces | 2013 casual-puzzle styling. Modern game buttons use fill, edge light and motion instead of a plastic slab |
| 6 | Fully saturated primaries and five candy stat colours | Everything shouts, so nothing leads |
| 7 | Uniform density: every row is a big pill at 16 px+ | Games look expensive when small labels sit next to big numbers. Flat density looks like a form |
| 8 | Character art shown at 96 px in a circle | The art is the product. We are hiding our best asset |

## Umamusume's own interface

From a Japanese game-UI designer's breakdown of the app ([note.com](https://note.com/togetogedesign/n/na140dde5b70a?hl=en)):

- **Layout:** characters and status live at the **top** of the screen, the operable UI at the **bottom**, explicitly so it
  can be driven one-handed. We already do this; it is the one thing to keep.
- **Base colours:** white and a **blue-tinted grey**, kept clean, with **turf green and dirt brown** carrying the racing
  theme (a nod to the JRA's green). Colourful elements sit *on top of* that quiet base — they are not the base.
- **Icon shapes:** footer icons are drawn from **curves rather than straight lines**, and they are **coloured
  illustrations, not flat pictograms**. That is where the warmth comes from, not from the font.
- **Type:** one playful-but-stable display face, with a real size ladder — roughly 32 px footer labels, 24–30 px body,
  40–42 px on main buttons, at 1080×2340. Key numbers get **gradient fills with strokes and inner shadows** so they feel
  embossed, and a rainbow glow is reserved for "NEW" urgency.
- **Density:** rich, but organised: the screen is busy with meaning, never with decoration.

## What HoYoverse does (Star Rail, Genshin, ZZZ)

Observed across their menus, plus a designer walkthrough of Star Rail's UI
([Medium](https://medium.com/@donxu29/ui-noir-honkai-star-rail-23d4b43c01a)) and the screen catalogue at
[Interface In Game](https://interfaceingame.com/games/honkai-star-rail/):

- **The art is the interface.** Character art is full-bleed and large; panels are scrims and frames around it. Their own
  writeup is blunt about it: the characters are the selling point and the UI exists in support of them.
- **Restrained decoration.** Menus have "a soft look", with just enough flavour framing a number to give it identity, and
  no more. Ornament is concentrated in one or two places per screen.
- **One accent, many neutrals.** A single warm accent (gold/amber) marks selection, rarity and the primary action. Status
  colours stay desaturated next to it.
- **Angular geometry as signature.** Chamfered corners, parallelogram tabs and diagonal cuts appear on a handful of
  elements — a motif, not a texture.
- **Motion with a second layer.** Big shapes move, and small secondary elements (dots, ticks, lines) follow a beat later.
  That two-layer timing is most of why it feels expensive.
- **Micro-typography.** Tiny tracked-out capital labels, big numerals, and secondary text used as texture.

## Browsing 267 Umas and 312 cards

From filtering/sorting UX guidance ([NN/g's faceted-search tray pattern](https://www.nngroup.com/articles/mobile-faceted-search/),
their [filters and sorting guide](https://www.nngroup.com/contents/self-paced-courses/filters-and-sorting-the-complete-design-guide/),
plus current mobile-filter practice):

- On phones, a **bottom-sheet tray** beats a sidebar. Medium complexity → bottom sheet; layered choices → full-screen panel.
- **Applied filters must be visible outside the tray**, as chips next to the results, each removable, with a clear-all.
- **Show counts and prevent zero-result dead ends** — a facet that would return nothing is disabled or labelled, never a
  trapdoor.
- **Facets must match the player's mental model.** For us that is: do I own her · what can she run · how strong is she ·
  when did she arrive.
- Sort and filter are **different controls** and should look different; sort needs an explicit direction toggle.
- A **sticky control bar** is right when adjustments are frequent, which is exactly the album case.

## What this means for us

1. Keep the one-handed, art-at-top layout. Everything else about the skin changes.
2. Move from "sky gradient + white pills" to a **quiet blue-grey base with turf accents**, three defined surface levels,
   hairline borders and a single gold accent.
3. Replace emoji with an **original icon set** built on curves, with illustrated colour variants for the five tabs and the
   currencies.
4. Split the type system: a display face for headings and numbers, a neutral UI face for everything else, with a real
   size and weight ladder. Numbers get the embossed treatment; body text does not.
5. Make **portrait art the hero** on Home, the Stable grid, the Uma profile and reveals.
6. Give the albums a proper browsing chrome: sticky search/sort/filter bar, chips, counts, a tray, saved views, and
   density control.

Sources: [Umamusume UI breakdown (note.com)](https://note.com/togetogedesign/n/na140dde5b70a?hl=en) ·
[UI Noir: Honkai Star Rail (Medium)](https://medium.com/@donxu29/ui-noir-honkai-star-rail-23d4b43c01a) ·
[Interface In Game — Honkai: Star Rail](https://interfaceingame.com/games/honkai-star-rail/) ·
[NN/g — Mobile Faceted Search with a Tray](https://www.nngroup.com/articles/mobile-faceted-search/) ·
[NN/g — Filters and Sorting](https://www.nngroup.com/contents/self-paced-courses/filters-and-sorting-the-complete-design-guide/)
