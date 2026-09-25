// The fourteen constellation silhouettes (T052), drawn on a grid.
//
// Nodes sit on even columns and even lines: `R` is the root and `o` a card or stat node. The odd positions between
// them hold connectors: `-` and `|` join straight neighbours, `/` and `\` diagonal ones, and a run of `-` or `|` may
// cross an empty node position to reach a farther node. On a grid every edge is straight, and two edges can never
// cross, because a crossing would need two connectors in one character.
//
// Which node is which is not drawn: the template numbers the nodes breadth-first from the root, so the tree always
// opens outward, and the deepest nodes are the stat nodes (constellationTemplate).

export const SHAPE_ART: readonly string[] = [
  // 1 URA Finale: a single trunk with short branches, alternating like a fern.
  String.raw`
    R
    |
o-o-o
    |
    o-o-o
    |
o-o-o
    |
    o-o-o
    |
o-o-o
    |
    o-o-o
    |
o-o-o
`,
  // 2 Unity Cup: three long branches from one stem, the outer two longest.
  String.raw`
      R
      |
o-o-o-o-o-o-o
|     |     |
o     o     o
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
`,
  // 3 Trackblazer: one long track round an oval, open at the bottom, with side spurs.
  String.raw`
      R
      |
  o-o-o-o-o
  |       |
  o       o
  |       |
o-o       o
  |       |
  o       o-o
  |       |
  o       o
  |       |
  o-o   o-o
    |
    o
`,
  // 4 Our Grand Concert: a five-arm star around a central root.
  String.raw`
o     o     o
|     |     |
o     o     o
|     |     |
o     o     o
 \    |    /
  o   o   o
   \  |  /
    o o o
     \|/
      R
     / \
    o   o
   /     \
  o       o
 /         \
o-o-o   o-o-o
`,
  // 5 Grand Masters: twin arcs hanging from one bar.
  String.raw`
o-o-o-R-o-o-o
|     |     |
o     o     o
|           |
o           o
|           |
o   o   o   o
|   |   |   |
o   o   o   o
|   |   |   |
o   o   o   o
|   |   |   |
o-o-o   o-o-o
`,
  // 6 Project L'Arc: an arch, a heavy lintel on two legs, the root its keystone.
  String.raw`
o-o-o-R-o-o-o
| | | | | | |
o o o o o o o
| |   |   | |
o o   o   o o
| |       | |
o o       o o
|           |
o           o
|           |
o           o
|           |
o           o
|           |
o           o
`,
  // 7 U.A.F. Ready GO!: three feathered branches, one per sport.
  String.raw`
o-----R-----o
|     |     |
o     o     o
|     |     |
o-o   o   o-o
|     |     |
o   o-o-o   o
|     |     |
o-o   o   o-o
|     |     |
o     o     o
|     |     |
o-o   o   o-o
|     |     |
o     o     o
`,
  // 8 Great Food Festival: a wide canopy on a short trunk, rooted at the bottom.
  String.raw`
    o o o
    | | |
  o o o o o
  | | | | |
o o o o o o o
| | | | | | |
o o o o o o o
| | | | | | |
o-o-o-o-o-o-o
      |
    o-o-o
      |
      R
`,
  // 9 Run! Mecha Umamusume: a spine with ribs, the rib ends dropping like an open lattice.
  String.raw`
      R
      |
o-o-o-o-o-o-o
|     |     |
o     o     o
      |
o-o-o-o-o-o-o
|     |     |
o     o     o
      |
o-o-o-o-o-o-o
|     |     |
o     o     o
      |
    o-o-o
`,
  // 10 The Twinkle Legends: a seven-point crown on its band, rooted below.
  String.raw`
o     o     o
|     |     |
o   o o o   o
|   | | |   |
o   o o o   o
|   | | |   |
o o o o o o o
| | | | | | |
o o o o o o o
| | | | | | |
o-o-o-o-o-o-o
      |
      R
`,
  // 11 Design Your Island: an island at the centre, spokes out to a ring open at the bottom.
  String.raw`
  o-o-o-o-o
 /    |    \
o     o     o
|     |     |
o-o   o   o-o
|     |     |
o     o     o
|     |     |
o   o-R-o   o
|     |     |
o     o     o
|     |     |
o-o   o   o-o
|     |     |
o     o     o
 \         /
  o-o   o-o
`,
  // 12 Yukoma Hot Springs: a square spiral out from the root.
  String.raw`
  o-o-o-o-o-o
  |         |
  o o-o-o-o o
  | |     | |
  o o R-o o o
  | |   | | |
  o o-o-o o o
  |       | |
  o-o-o-o-o o
            |
o-o-o-o-o-o-o
`,
  // 13 Beyond Dreams: twin trunks meeting at the root, and touching again at the foot.
  String.raw`
      R
     / \
o-o-o   o-o-o
    |   |
  o-o   o-o
    |   |
o-o-o   o-o-o
    |   |
  o-o   o-o
    |   |
o-o-o   o-o-o
    |   |
  o-o   o-o
    |   |
o-o-o-o o-o-o
`,
  // 14 Tracen Diner: a counter with pendants of alternating length hanging from it.
  String.raw`
      R
      |
o-o-o-o-o-o-o
| | | | | | |
o o o o o o o
| | | | | | |
o o o o o o o
|   | | |   |
o   o o o   o
|   |   |   |
o   o   o   o
|   |   |   |
o   o   o   o
|   |   |   |
o   o   o   o
`,
]

export interface ShapeCell {
  col: number
  row: number
}

export interface ShapeGrid {
  columns: number
  rows: number
  root: ShapeCell
  /** Every node except the root, in reading order. */
  cells: ShapeCell[]
  /** Undirected adjacency, keyed `col,row`. */
  links: Map<string, ShapeCell[]>
}

export const cellKey = (cell: ShapeCell): string => `${cell.col},${cell.row}`

// Each connector character joins the two node positions on either side of it along its direction.
const DIRECTIONS: readonly { dx: number; dy: number; glyph: string }[] = [
  { dx: 1, dy: 0, glyph: '-' },
  { dx: -1, dy: 0, glyph: '-' },
  { dx: 0, dy: 1, glyph: '|' },
  { dx: 0, dy: -1, glyph: '|' },
  { dx: 1, dy: 1, glyph: '\\' },
  { dx: -1, dy: -1, glyph: '\\' },
  { dx: 1, dy: -1, glyph: '/' },
  { dx: -1, dy: 1, glyph: '/' },
]

/** Reads one silhouette. Throws on a malformed drawing, so a bad edit fails every test at once. */
export function parseShapeArt(art: string): ShapeGrid {
  const lines = art.replace(/^\n/, '').replace(/\n\s*$/, '').split('\n')
  const at = (x: number, y: number): string => lines[y]?.[x] ?? ' '
  const isNode = (glyph: string) => glyph === 'o' || glyph === 'R'

  const found: (ShapeCell & { root: boolean })[] = []
  for (const [y, line] of lines.entries()) {
    for (const [x, glyph] of [...line].entries()) {
      if (!isNode(glyph)) continue
      if (x % 2 !== 0 || y % 2 !== 0) throw new Error(`node off the grid at line ${y + 1}, column ${x + 1}`)
      found.push({ col: x / 2, row: y / 2, root: glyph === 'R' })
    }
  }
  const roots = found.filter((cell) => cell.root)
  if (roots.length !== 1) throw new Error(`a shape needs exactly one root, found ${roots.length}`)

  const minCol = Math.min(...found.map((cell) => cell.col))
  const minRow = Math.min(...found.map((cell) => cell.row))
  const links = new Map<string, ShapeCell[]>()
  const normalise = (x: number, y: number): ShapeCell => ({ col: x / 2 - minCol, row: y / 2 - minRow })

  for (const cell of found) {
    const x = cell.col * 2
    const y = cell.row * 2
    const neighbours: ShapeCell[] = []
    for (const { dx, dy, glyph } of DIRECTIONS) {
      if (at(x + dx, y + dy) !== glyph) continue
      // Walk the connector until it reaches a node. A straight run may cross an empty node position; anything else
      // it meets is a drawing error.
      let cx = x + dx
      let cy = y + dy
      for (;;) {
        cx += dx
        cy += dy
        const seen = at(cx, cy)
        if (isNode(seen)) break
        const emptyNodePosition = seen === ' ' && cx % 2 === 0 && cy % 2 === 0
        if (seen === glyph || (emptyNodePosition && (dx === 0 || dy === 0))) continue
        throw new Error(`connector at line ${cy - dy + 1}, column ${cx - dx + 1} runs into '${seen}'`)
      }
      neighbours.push(normalise(cx, cy))
    }
    links.set(cellKey(normalise(x, y)), neighbours)
  }

  const cells = found.map((cell) => normalise(cell.col * 2, cell.row * 2))
  const root = normalise(roots[0]!.col * 2, roots[0]!.row * 2)
  return {
    columns: Math.max(...cells.map((cell) => cell.col)) + 1,
    rows: Math.max(...cells.map((cell) => cell.row)) + 1,
    root,
    cells: cells.filter((cell) => cell.col !== root.col || cell.row !== root.row),
    links,
  }
}
