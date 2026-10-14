# T129 — Constellations re-authored

**M033 · first wave, parallel with T125 and T126 · not started.** One pull request (or commit series), green before
T128 builds on it.

Read:
- [AGENTS.md](../../AGENTS.md) and [M033](M033-rework-rules.md), whose fixed choices bind this task.
- [rework/05](../rework/05-training-hub.md) §3 (node ids) and §4 (the tree table), [03](../rework/03-uma-progression.md)
  §6 (the carry by node id) and the [README](../rework/README.md)'s layer table.
- [Constellations](../design/constellations.md): "Silhouettes", "Templates" and "The screen" (40 pt on a 375 × 812
  phone, whose graph box is 351 × 525 pt); [Scenarios](../design/scenarios.md#constellation-shapes) for today's motifs.
- Today's `constellation-shapes.ts` (the grid notation, `parseShapeArt`), `constellation.ts` (`buildTemplate`,
  `validateTemplate`, `TREE_BOX`, `CARD_SET_SIZE`, `cardNodeCap`, `cardFairShare`) and the layout tests in
  `constellation.test.ts`.
- Decisions D134, D143, D235, D328 and D338.

## Goal and fixed scope

Every scenario's constellation, redrawn at its rework size as static content with a validator, in
`@racer/domain/rework/constellation`. Today's fourteen trees, their sizes and today's saves don't change.

- **Sizes** (05 §4, README): scenario *s* of any tier has *N* = 12, 16, 20, 24 or 28 card nodes, so T = 1–15 cycle
  through them by tier.
- **Per-card cap** ceil(*N*/6) + 1 = 3, 4, 5, 5, 6 (D134), which never falls inside a tier (03 §6); fair share
  ceil(*N*/6) = 2, 3, 4, 4, 5.
- **Fourteen drawings** (T = 1–14), each keeping its scenario's motif as 05 §4's table adapts it. The 15th is drawn when
  it ships (05 §4, §12); its size (28) and cap (6) are known now.
- **Drawing rules** (05 §4, Constellations): nodes on an even grid, straight uncrossed edges, exactly *N* card nodes
  (D235's six pruned tips go), and at least 40 pt between node centres on a 375 pt phone.
- **Ids and order** (03 §6, 05 §3): numbered breadth-first from the root, with today's tie rule (nearer rows, then
  columns). The root is `n0` and the card nodes are `n1` … `n`*N*; the number is the unlock order. So the first *k*
  nodes of any tree are connected, and an Uma with *k* nodes open keeps every assignment on its id when she advances.
- **A validator** that refuses any tree breaking these rules, with a plain reason.

## Implementation contract

Modules live in `packages/domain/src/rework/constellation/`, each with a header linking 05 §4. The area's `index.ts` is
`@racer/domain/rework/constellation` under T125's `./rework/*` export.

**`sizes.ts`**, a leaf that T125 and T128 import:
- `TREE_CARD_NODES = [12, 16, 20, 24, 28]` (05 §4, README), `treeCardNodes(s)` and `treeCardNodesAt(T)` =
  `TREE_CARD_NODES[(T − 1) mod 5]`.
- `fairShare(N)` = ceil(*N* ÷ `CARD_SET_SIZE`) and `perCardCap(N)` = `fairShare(N)` + 1, with today's `CARD_SET_SIZE`
  (6) imported. Its only import. If T125 lands first, it creates this file exactly so.

**`shapes.ts`**:
- `TREE_ART`: fourteen drawings indexed by T − 1, in today's notation (`R` root, `o` card node, `-` `|` `/` `\`
  connectors, nodes on even columns and lines), each with a comment naming its motif.
- `TREE_MOTIFS`: 05 §4's "How the motif adapts" text per T, plus the 15th's line. Shape ids are today's
  `CONSTELLATION_SHAPES[T − 1].shape`, imported, since every scenario keeps its motif.

**`tree.ts`**:
- `TreeNode { id; kind: 'root' | 'card'; parentId: string | null; order; x; y }`, with order 0 for the root and *k*
  for `n`*k*, and x and y on today's 0–100 canvas inside `TREE_BOX`. `Tree { scenario; shape; cardNodes; nodes }`.
  There are no lineage nodes: Inspiration is the Lineage Hall's own map (05 §5).
- `buildTree(art, cardNodes, scenario, shape)` parses with today's `parseShapeArt` and then works as today's
  `buildTemplate` does: a first-in, first-out walk from the root, each node's unvisited neighbours taken by row and
  then column, and each cell placed at its centre in `TREE_BOX`, rounded to one decimal. It throws when the drawing
  doesn't hold `cardNodes` + 1 nodes or its connectors don't make one tree (as many edges as card nodes, all reached).
- `treeFor(T)`: the built, cached and frozen tree for T = 1–14; `null` for 15; `RangeError` outside 1–15.
- `treeEdges(tree)`, `cardNodeId(k)` = `n`*k*, and `nodeOrder(id)`, which gives *k*, or `null` for a malformed id.

**`validate.ts`**:
- `MIN_NODE_SPACING_PT = 40` and `PHONE_GRAPH_BOX_PT = { width: 351, height: 525 }` (Constellations "The screen",
  05 §4).
- `validateTree(tree, expectedCardNodes) → TreeIssue | null`, where `TreeIssue { code; reason }`. The reason is plain
  words naming the nodes ("n7 and n8 are 37 pt apart; the minimum is 40."). Checks, in order:
  1. `root`: one root, id `n0`, order 0, no parent.
  2. `card-count`: exactly `expectedCardNodes` card nodes.
  3. `ids`: card ids are `n1` … `n`*N*, unique, each equal to `n` + its order.
  4. `parent`: every card's parent exists and is the root or a card of lower order. With check 3, this makes one tree
     with no cycle, and every prefix `n0` … `n`*k* connected.
  5. `breadth-first`: the orders equal a breadth-first walk of the tree's own edges with today's tie rule (by y, then x).
  6. `outside-box`: every node inside `TREE_BOX`.
  7. `spacing`: every pair at least 40 pt apart once the canvas is stretched to 351 × 525 pt.
  8. `crossing`: no two edges cross; edges that share an end are fine.
- `validateAllTrees()` runs it over the fourteen trees with `treeCardNodesAt(T)`.

**What the rules allow.** `TREE_BOX` (x 2–98, y 2–74) on the 351 × 525 pt box leaves about 337 × 378 pt. At 40 pt that
is at most 8 node columns and 9 node rows. The validator is the real check; this only guides the drawing.

**Drawing.** Draw each tree as 05 §4's table describes. Each row's parts add up to its *N*, so a drawing that follows
the words has the right count (with Project L'Arc read as Decided below). Long runs must bend to fit nine rows, as
their words already say: Grand Masters' arcs of 9, Beyond Dreams' trunks of 10 curving to meet at the foot, and
Trackblazer's halves of 8.

**Purity and determinism.** No I/O, clock or randomness. Trees are frozen, built once and cached. Two builds of the same
drawing are deep-equal.

## Decided here

1. **Fourteen drawings, fifteen sizes.** M033's table says "fifteen silhouettes", but 05 §4 and §12 draw the 15th when
   it ships. T129 delivers every size and cap and fourteen drawings. The 15th's drawing joins 04 §2's "when the
   platform publishes the 15th" steps, with its own decision entry.
2. **Ids `n0` (root) and `n1` … `n`*N*,** as 03 §6 and 05 §3 write them. Today's code names the root `root` and numbers
   cards from `n0`; 05 §3's "as today" means the root is always open and empty. Generation 2 starts empty, so no save
   maps between the two schemes.
3. **Project L'Arc:** "a lintel of 4 either side of the keystone root" reads as four lintel nodes, two either side. Four
   a side would make 16 nodes, not 12.
4. **Tracen Diner:** the root sits above the counter of 8, as in today's drawing. A counter of 8 through the root is
   nine nodes in a row, 37 pt apart. The 40 pt rule wins over the wording.
5. **No lineage band on the tree,** so today's parent and grandparent checks leave the validator. Trees keep today's
   `TREE_BOX` and the 351 × 525 pt box, so the 40 pt results compare with today's.
6. **Two ports, each proven by a parity test.** Today's walk and placement live inside `buildTemplate`, which reads
   today's drawings and prunes six tips. Today's `cardNodeCap` and `cardFairShare` read today's sizes by scenario.
   T129 restates them by drawing and by *N*. The parser, `TREE_BOX`, `CARD_SET_SIZE` and shape ids are imported.
7. **Sizes and the per-card cap live here,** in the leaf `sizes.ts`. T125 needs them before T128 exists, and T128's
   per-card cap from *N* should re-export `perCardCap` rather than restate it.

## Tests

Beside the modules, in `rework/constellation/*.test.ts`. Expected values are literals from 05 §4.
- **Pins:** `TREE_CARD_NODES`; `perCardCap` 3, 4, 5, 5, 6; `fairShare` 2, 3, 4, 4, 5; `treeCardNodesAt` for T = 1–15;
  40 pt; 351 × 525 pt.
- **Parity with today:**
  - `perCardCap` and `fairShare` of each of today's sizes (`shapeDef(t).cardNodes`) equal today's `cardNodeCap(t)`
    and `cardFairShare(t)` for t = 1–14.
  - `buildTree` on today's fourteen `SHAPE_ART` drawings, tips included, reproduces today's templates: today's `n`*i*
    and its parent are T129's `n`*i*+1 and its parent, at the same x and y, with today's `root` as `n0`.
- **Every tree:** one root and exactly *N*(T) card nodes; ids `n1` … `n`*N* in order; every parent of lower order;
  `validateTree` returns `null` for all fourteen.
- **Prefixes:** for every tree and every *k* from 0 to *N*, the nodes `n0` … `n`*k* form one connected tree.
- **Advancing:** for T and T + 1 in the same tier and every *k* ≤ *N*(T), `n1` … `n`*k* exist in T + 1's tree and are
  connected there. The per-card cap never falls from one scenario to the next.
- **Layout:** every node inside `TREE_BOX`, every pair at least 40 pt apart, no crossing edges, at most 8 columns and
  9 rows.
- **The validator refuses** one synthetic tree per code: no root, 11 card nodes where 12 are expected, a duplicate id,
  an id that isn't `n` + its order, a parent of higher order, a missing parent, two orders swapped, a node outside the
  box, two nodes 30 pt apart, and two crossing edges. Each reason names the nodes.
- **The builder throws** on a drawing with the wrong count, two roots, a stray connector or a loop.
- **Lookup:** `treeFor(15)` is `null`; `treeFor(0)` and `treeFor(16)` throw; trees are frozen.
- **Purity:** no `Date.now`, `Math.random` or I/O under `rework/constellation`.

## Live blocks

Rendered by `packages/domain/src/docs/render.ts`. Keys match the docs check's `[a-z-]+`.
- `constellation-trees` replaces 05 §4's table (#, scenario, tier · scenario, nodes, per-card cap, how the motif
  adapts). It is built from `TREE_MOTIFS`, the sizes and today's scenario names; row 15 keeps its "drawn when it
  ships" line.
- `constellation-art` is a new block right after it: each drawing as a fenced text block under its scenario's name. A
  reviewer sees every silhouette, and the page can't drift from the code.

The blocks need T125's docs check over `docs/rework/`. If T129 lands first, it extends `docs.test.ts` as T125 specifies.

## Acceptance

- [ ] `@racer/domain/rework/constellation` exports the sizes, the fourteen trees, `treeFor`, the helpers and the
  validator.
- [ ] Every number is a cited constant pinned beside its module, and every test above passes.
- [ ] 05 §4 carries both live blocks, the docs check passes over `docs/rework/`, and `pnpm docs:update` leaves no diff.
- [ ] `pnpm lint && pnpm test && pnpm build` are green; today's constellation tests, every sim and the 180 KB budget are
  unchanged; `git grep "rework/" apps` finds nothing.
- [ ] The Decided rows go into 05 §11 with one decisions.md entry, and this spec is deleted (D104).

## Out of scope

- The dish and grade per node, the Observatory's order, presets, assignments, the carry at the advance, SP and derived
  stats: T128. Node values, E and caps: T125.
- The 15th's drawing, until it ships.
- Screens, tile sizes, pan and zoom; today's trees and `constellations.md`, rewritten as built in phase 3.
