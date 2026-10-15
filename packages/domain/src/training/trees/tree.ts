// The re-authored constellation trees (docs/game/05-training-hub.md §4): each scenario's drawing built into a tree
// whose node ids are its unlock order, breadth-first from the root (05 §3, 03 §6). Static content: built once, cached
// and frozen. There are no lineage nodes; Inspiration is the Lineage Hall's own map (05 §5).
import { cellKey, parseShapeArt, type ShapeCell } from '../../constellation-shapes'
import { TREE_BOX } from '../../constellation'
import { TREE_ART, treeShape } from './shapes'
import { treeCardNodesAt } from './sizes'

export type TreeNodeKind = 'root' | 'card'

export interface TreeNode {
  /** `n0` for the root, `n`k for the k-th card node to open. */
  readonly id: string
  readonly kind: TreeNodeKind
  /** The node it hangs from, toward the root; `null` for the root. */
  readonly parentId: string | null
  /** Unlock order: 0 for the root, k for `n`k. */
  readonly order: number
  /** Position on the 0–100 canvas, inside `TREE_BOX`. Authored, never simulated. */
  readonly x: number
  readonly y: number
}

export interface Tree {
  /** The game's scenario T = 1–15. */
  readonly scenario: number
  /** The silhouette's id, today's `CONSTELLATION_SHAPES[T − 1].shape`. */
  readonly shape: string
  readonly cardNodes: number
  /** The root, then the card nodes in unlock order. */
  readonly nodes: readonly TreeNode[]
}

export interface TreeEdge {
  readonly from: TreeNode
  readonly to: TreeNode
}

/** The root's id. It is always open and always empty (05 §3). */
export const ROOT_ID = 'n0'

/** The id of the k-th card node to open: `n`k (05 §3). */
export const cardNodeId = (k: number): string => `n${k}`

/** The unlock order an id names (`n0` → 0, `n12` → 12), or `null` for anything else. */
export function nodeOrder(id: string): number | null {
  const match = /^n(0|[1-9]\d*)$/.exec(id)
  return match ? Number(match[1]) : null
}

const round1 = (value: number): number => Math.round(value * 10) / 10

/**
 * Builds a tree from a drawing in today's notation (`constellation-shapes.ts`). A first-in, first-out walk from the
 * root numbers the nodes, taking each node's unvisited neighbours by row and then column, as today's `buildTemplate`
 * does; each cell is placed at its centre in `TREE_BOX`, rounded to one decimal. Throws when the drawing doesn't hold
 * `cardNodes` + 1 nodes or its connectors don't make one tree.
 */
export function buildTree(art: string, cardNodes: number, scenario: number, shape: string): Tree {
  const grid = parseShapeArt(art)
  if (grid.cells.length !== cardNodes) {
    throw new Error(`Scenario ${scenario}'s drawing has ${grid.cells.length} card nodes; it needs ${cardNodes}`)
  }
  const edges = [...grid.links.values()].reduce((sum, neighbours) => sum + neighbours.length, 0) / 2
  if (edges !== cardNodes) {
    throw new Error(`Scenario ${scenario}'s drawing has ${edges} connectors for ${cardNodes} card nodes; a tree needs one each`)
  }

  const pitchX = (TREE_BOX.maxX - TREE_BOX.minX) / grid.columns
  const pitchY = (TREE_BOX.maxY - TREE_BOX.minY) / grid.rows
  const place = (cell: ShapeCell) => ({
    x: round1(TREE_BOX.minX + (cell.col + 0.5) * pitchX),
    y: round1(TREE_BOX.minY + (cell.row + 0.5) * pitchY),
  })

  const ids = new Map<string, string>([[cellKey(grid.root), ROOT_ID]])
  const nodes: TreeNode[] = [{ id: ROOT_ID, kind: 'root', parentId: null, order: 0, ...place(grid.root) }]
  const queue: ShapeCell[] = [grid.root]
  while (queue.length > 0) {
    const cell = queue.shift()!
    const neighbours = [...(grid.links.get(cellKey(cell)) ?? [])].sort((a, b) => a.row - b.row || a.col - b.col)
    for (const next of neighbours) {
      if (ids.has(cellKey(next))) continue
      const order = nodes.length
      ids.set(cellKey(next), cardNodeId(order))
      queue.push(next)
      nodes.push({ id: cardNodeId(order), kind: 'card', parentId: ids.get(cellKey(cell))!, order, ...place(next) })
    }
  }
  if (nodes.length !== cardNodes + 1) {
    throw new Error(`Scenario ${scenario}'s drawing is not one tree: the root reaches ${nodes.length - 1} of ${cardNodes} card nodes`)
  }
  return { scenario, shape, cardNodes, nodes }
}

/** The fourteen drawn scenarios; the 15th is drawn when it ships (05 §4, §12). */
export const DRAWN_TREES = 14
const LAST_SCENARIO = 15

function freezeTree(tree: Tree): Tree {
  for (const node of tree.nodes) Object.freeze(node)
  Object.freeze(tree.nodes)
  return Object.freeze(tree)
}

const CACHE = new Map<number, Tree>()

/** The tree for scenario T = 1–14, built once and frozen; `null` for the 15th until it ships. */
export function treeFor(T: number): Tree | null {
  if (!Number.isInteger(T) || T < 1 || T > LAST_SCENARIO) throw new RangeError(`Scenario must be 1–15: ${T}`)
  if (T > DRAWN_TREES) return null
  let tree = CACHE.get(T)
  if (!tree) {
    tree = freezeTree(buildTree(TREE_ART[T - 1]!, treeCardNodesAt(T), T, treeShape(T)))
    CACHE.set(T, tree)
  }
  return tree
}

/** Every edge, from the node a card hangs from to the card. */
export function treeEdges(tree: Tree): TreeEdge[] {
  const byId = new Map(tree.nodes.map((node) => [node.id, node]))
  return tree.nodes.flatMap((node) => {
    const parent = node.parentId === null ? undefined : byId.get(node.parentId)
    return parent ? [{ from: parent, to: node }] : []
  })
}
