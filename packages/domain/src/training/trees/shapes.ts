// The re-authored silhouettes (docs/rework/05-training-hub.md §4): every scenario keeps its motif
// (docs/design/scenarios.md#constellation-shapes) at its rework size, 12, 16, 20, 24 or 28 card nodes, with exactly that
// many drawn (D235's six pruned tips are gone).
//
// Today's notation (constellation-shapes.ts): `R` is the root and `o` a card node, on even columns and lines; `-` and
// `|` join straight neighbours, `/` and `\` diagonal ones, and a straight run may cross an empty node position. Which
// node is which is not drawn: the tree numbers them breadth-first from the root (tree.ts). Every drawing fits 8 node
// columns and 9 node rows, so nodes stay 40 pt apart on a 375 pt phone (validate.ts).
import { CONSTELLATION_SHAPES } from '../../constellation'

export const TREE_ART: readonly string[] = [
  // 1 URA Finale (12): the fern, a trunk of 6 from the root with one leaflet on alternating sides at each trunk node.
  String.raw`
  R
  |
o-o
  |
  o-o
  |
o-o
  |
  o-o
  |
o-o
  |
  o-o
`,
  // 2 Unity Cup (16): a stem of 1 and three long branches of 5.
  String.raw`
      R
      |
      o
     /|\
    o o o
   /  |  \
  o   o   o
 /    |    \
o     o     o
|     |     |
o     o     o
|     |     |
o     o     o
`,
  // 3 Trackblazer (20): the track's two halves of 8 climb from the root at its open foot and almost meet at the top;
  // four short spurs point outward.
  String.raw`
    o   o
   /     \
  o       o
  |       |
o-o       o-o
  |       |
  o       o
  |       |
  o       o
  |       |
o-o       o-o
  |       |
  o       o
   \     /
    o   o
     \ /
      R
`,
  // 4 Our Grand Concert (24): the five-arm star, four arms of 5 out to the corners and a foot arm of 4, the stage.
  String.raw`
o           o
|           |
o           o
|           |
o-o       o-o
   \     /
    o   o
     \ /
      R
     /|\
    o o o
   /  |  \
o-o   o   o-o
|     |     |
o     o     o
|     |     |
o     o     o
`,
  // 5 Grand Masters (28): a bar of 6 through the root, two arcs of 9 hanging from its ends and curling in at the foot,
  // a pendant of 4 between them.
  String.raw`
o-o-o-R-o-o-o
|     |     |
o     o     o
|     |     |
o     o     o
|     |     |
o     o     o
|     |     |
o     o     o
|           |
o           o
|           |
o           o
|           |
o           o
 \         /
  o-o   o-o
`,
  // 6 Project L'Arc (12): the arch, a lintel of 2 either side of the keystone root on two legs of 4.
  String.raw`
o-o-R-o-o
|       |
o       o
|       |
o       o
|       |
o       o
|       |
o       o
`,
  // 7 U.A.F. Ready GO! (16): a stem of 1 and three branches of 3, one per sport, each with two feathers.
  String.raw`
      R
      |
  o---o---o
 /|   |   |\
o |   |   | o
  |   |   |
  o   o   o
  |\  |  /|
  | o | o |
  |   |   |
  o   o   o
     /|\
    o | o
      |
      o
`,
  // 8 Great Food Festival (20): a short trunk of 2 under a canopy of six boughs of 3, stepping up to its centre.
  String.raw`
    o   o
    |   |
  o o   o o
  | |   | |
o o o   o o o
| |  \ /  | |
o o---o---o o
|     |     |
o-----o-----o
      |
      R
`,
  // 9 Run! Mecha Umamusume (24): a spine of 6 with six ribs of 3, three a side, their ends dropping.
  String.raw`
      R
      |
  o-o-o-o-o
 /    |    \
o     o     o
      |
  o-o-o-o-o
 /    |    \
o     o     o
      |
  o-o-o-o-o
 /    |    \
o     o     o
`,
  // 10 The Twinkle Legends (28): a band of 7 rooted below its centre and seven crown points of 3, short and tall in turn.
  String.raw`
  o   o   o
  |   |   |
  o   o   o
  |   |   |
  o   o   o
  |   |   |
o | o | o | o
| | | | | | |
o | o | o | o
| | | | | | |
o | o | o | o
| | | | | | |
o-o-o-o-o-o-o
      |
      R
`,
  // 11 Design Your Island (12): four spokes of 1 from the island root, each carrying a ring arc of 2; the ring stays
  // open at the foot.
  String.raw`
o-o   o-o
|\     /|
o \   / o
   \ /
o---R---o
|       |
o       o
|       |
o       o
`,
  // 12 Yukoma Hot Springs (16): the square spiral from the root, cut to its first 16 nodes (seven legs).
  String.raw`
  o-o-o-o
  |     |
  o R-o o
  |   | |
  o-o-o o
        |
o-o-o-o-o
`,
  // 13 Beyond Dreams (20): twin trunks of 10 rise from the root, arch over and come down to the foot, where their tips
  // almost touch: a heart.
  String.raw`
  o-o   o-o
 /   \ /   \
o     R     o
|           |
o           o
|           |
o           o
|           |
o           o
 \         /
  o       o
  |       |
  o       o
   \     /
    o   o
    |   |
    o   o
`,
  // 14 Tracen Diner (24): a counter of 8 under the root, eight pendants alternating 1 and 3 long.
  String.raw`
      R
      |
o-o-o-o-o-o-o-o
| | | | | | | |
o o o o o o o o
  |   |   |   |
  o   o   o   o
  |   |   |   |
  o   o   o   o
`,
]

/**
 * How each scenario's motif adapts to its rework size (05 §4's table), indexed by T − 1. Each line's parts add up to
 * the tree's card nodes. The 15th is drawn when it ships.
 */
export const TREE_MOTIFS: readonly string[] = [
  'The fern: a trunk of 6 from the root, one leaflet on alternating sides at each trunk node',
  'A stem of 1 and three long branches of 5',
  "The track's two halves, 8 nodes each, climb from the root at the open foot; four short spurs point outward",
  'The five-arm star: four arms of 5 and a foot arm of 4, the stage',
  'A bar of 6 through the root, two arcs of 9 hanging from its ends, a pendant of 4 between them',
  'The arch: a lintel of 2 either side of the keystone root, two legs of 4',
  'A stem of 1, three branches of 3, each with two feathers',
  'A short trunk of 2 under a canopy of six boughs of 3',
  'A spine of 6 with six ribs of 3, three a side, their ends dropping',
  'A band of 7 rooted below its centre, seven crown points of 3',
  'Four spokes of 1 from the island root, each carrying a ring arc of 2; the ring stays open at the foot',
  'The square spiral from the root, cut to its first 16 nodes (seven legs, about one and a half turns)',
  'Twin trunks of 10 from the root, their tips almost touching at the foot',
  'A counter of 8 under the root, eight pendants alternating 1 and 3 long',
  'Drawn when it ships; until then [04](04-tiers-and-promotion.md) says what tier 3 does',
]

/** Every scenario keeps its silhouette, so a tree's shape id is today's (`CONSTELLATION_SHAPES`). */
export const TREE_SHAPES: readonly string[] = CONSTELLATION_SHAPES.map((def) => def.shape)

/** The shape id of drawn scenario T = 1–14. */
export function treeShape(T: number): string {
  const shape = TREE_SHAPES[T - 1]
  if (!Number.isInteger(T) || shape === undefined) throw new RangeError(`No drawn shape for scenario ${T}`)
  return shape
}
