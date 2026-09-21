# Milestone 13 — The constellation screen

**Outcome:** the screen the whole game now hangs off. You see the tree, you fill it, and the stat and skill
consequences update as you touch it.

Design: [Constellations](../design/constellations.md) · [Visual system](../design/visual-system.md).

## Tasks

| Task | Scope | Owner |
|---|---|---|
| T046 | The graph: layout, unlocked/locked states, pan and zoom, node assignment | Claude |
| T047 | Card set editor, including the scenario slot | Claude |
| T048 | Lineage picker: six slots against the owned roster, live aptitude preview | Claude |

## The screen (T046)

A constellation is a graph on a dark **stage** surface — the one place in the app that gets the full
night-sky treatment, because that is what makes it read as a constellation rather than a form.

- **Node states:** locked (dim, no outline), unlocked and empty (hairline outline, gold when tappable),
  filled (the card or Uma icon inside the node, type colour on the rim).
- **Edges** are hairlines; an edge between two filled nodes of the same card brightens, so a stacked card
  reads as a constellation line rather than as repetition.
- **Tapping an unlocked node** opens the assignment sheet: the six card-set entries for a card node, five
  stats for a stat node, the owned roster for a lineage node.
- **A live stat column** pinned to the edge of the screen shows the five derived stats and SP, each with a
  delta against the configuration as it was when the screen opened. Changing a node animates the delta.
- **Pan and zoom** with the standard touch gestures, and a "fit" control. A 38-node tier-14 tree must be
  legible on a 390 pt screen without zooming, which constrains node size to about 44 pt including its label.

Layout comes from the template's stored positions, not from a force simulation: the shape is authored and
must look the same every time.

## Acceptance

- Every node kind can be assigned, reassigned and cleared, and the stat column matches `deriveStats` exactly.
- Locked nodes state which Training Level opens them.
- The aptitude line updates live as lineage slots change, and shows the step count that produced each grade.
- 60 fps pan and zoom on the target device at tier 14.
- Verified in the browser preview at 390×844.
