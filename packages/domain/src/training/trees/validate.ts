// The re-authored trees' drawing rules (docs/game/05-training-hub.md §4, docs/design/constellations.md "The screen"):
// one root `n0`, exactly N card nodes numbered n1 … nN breadth-first, each hanging from a node that opens before it,
// inside the tree's box, 40 pt apart on the smallest phone, and no crossing edges. Every refusal names the nodes.
import { TREE_BOX } from '../../constellation'
import { cardNodeId, DRAWN_TREES, ROOT_ID, treeEdges, treeFor, type Tree, type TreeNode } from './tree'
import { treeCardNodesAt } from './sizes'

/** The least distance between two node centres on the smallest phone, so tiles never overlap (Constellations). */
export const MIN_NODE_SPACING_PT = 40
/** The graph's box on a 375 × 812 pt phone, the smallest the game supports; the 0–100 canvas stretches to it. */
export const PHONE_GRAPH_BOX_PT = { width: 351, height: 525 } as const

export type TreeIssueCode =
  | 'root'
  | 'card-count'
  | 'ids'
  | 'parent'
  | 'breadth-first'
  | 'outside-box'
  | 'spacing'
  | 'crossing'

export interface TreeIssue {
  readonly code: TreeIssueCode
  /** Plain words naming the nodes. */
  readonly reason: string
}

const issue = (code: TreeIssueCode, reason: string): TreeIssue => ({ code, reason })
const list = (ids: readonly string[]): string =>
  ids.length <= 1 ? (ids[0] ?? '') : `${ids.slice(0, -1).join(', ')} and ${ids[ids.length - 1]}`

/** Distance between two nodes in points, once the canvas is stretched to `PHONE_GRAPH_BOX_PT`. */
export const spacingPt = (a: Pick<TreeNode, 'x' | 'y'>, b: Pick<TreeNode, 'x' | 'y'>): number =>
  Math.hypot(((a.x - b.x) / 100) * PHONE_GRAPH_BOX_PT.width, ((a.y - b.y) / 100) * PHONE_GRAPH_BOX_PT.height)

// Canvas positions carry one decimal, so tenths make the crossing test exact integer arithmetic.
type Point = { x: number; y: number }
const tenths = (node: Pick<TreeNode, 'x' | 'y'>): Point => ({ x: Math.round(node.x * 10), y: Math.round(node.y * 10) })
const turn = (a: Point, b: Point, c: Point): number => Math.sign((b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x))
const within = (a: Point, b: Point, p: Point): boolean =>
  Math.min(a.x, b.x) <= p.x && p.x <= Math.max(a.x, b.x) && Math.min(a.y, b.y) <= p.y && p.y <= Math.max(a.y, b.y)

/** Whether two closed segments meet anywhere: a crossing, a touch or a collinear overlap. */
function segmentsMeet(p: Point, q: Point, r: Point, s: Point): boolean {
  const d1 = turn(p, q, r)
  const d2 = turn(p, q, s)
  const d3 = turn(r, s, p)
  const d4 = turn(r, s, q)
  if (d1 * d2 < 0 && d3 * d4 < 0) return true
  return (d1 === 0 && within(p, q, r)) || (d2 === 0 && within(p, q, s)) || (d3 === 0 && within(r, s, p)) || (d4 === 0 && within(r, s, q))
}

/** Edges sharing an end meet only there, unless one runs along the other. */
function edgesCross(a: { from: TreeNode; to: TreeNode }, b: { from: TreeNode; to: TreeNode }): boolean {
  const ends = [a.from, a.to, b.from, b.to].map((node) => node.id)
  const shared = ends.slice(0, 2).find((id) => ends.slice(2).includes(id))
  if (shared === undefined) return segmentsMeet(tenths(a.from), tenths(a.to), tenths(b.from), tenths(b.to))
  const pivot = tenths(shared === a.from.id ? a.from : a.to)
  const tipA = tenths(shared === a.from.id ? a.to : a.from)
  const tipB = tenths(shared === b.from.id ? b.to : b.from)
  const dot = (tipA.x - pivot.x) * (tipB.x - pivot.x) + (tipA.y - pivot.y) * (tipB.y - pivot.y)
  return turn(pivot, tipA, tipB) === 0 && dot > 0
}

/**
 * The first rule a tree breaks, or `null` when it keeps them all. Checks run in order (root, card count, ids, parents,
 * breadth-first order, box, spacing, crossings), so each later check can rely on the earlier ones.
 */
export function validateTree(tree: Tree, expectedCardNodes: number): TreeIssue | null {
  // 1. One root, n0, order 0, no parent.
  const roots = tree.nodes.filter((node) => node.kind === 'root')
  if (roots.length === 0) return issue('root', 'The tree has no root.')
  if (roots.length > 1) return issue('root', `The tree has ${roots.length} roots: ${list(roots.map((node) => node.id))}.`)
  const root = roots[0]!
  if (root.id !== ROOT_ID) return issue('root', `The root is ${root.id}; it must be ${ROOT_ID}.`)
  if (root.order !== 0) return issue('root', `The root ${ROOT_ID} has order ${root.order}; it must be 0.`)
  if (root.parentId !== null) return issue('root', `The root ${ROOT_ID} hangs from ${root.parentId}; it must have no parent.`)

  // 2. Exactly the expected number of card nodes.
  const cards = tree.nodes.filter((node) => node.kind === 'card')
  if (cards.length !== expectedCardNodes) {
    return issue('card-count', `The tree has ${cards.length} card nodes; it needs ${expectedCardNodes}.`)
  }

  // 3. Card ids n1 … nN, unique, each n + its order.
  const seen = new Set<string>()
  for (const node of tree.nodes) {
    if (seen.has(node.id)) return issue('ids', `${node.id} appears more than once.`)
    seen.add(node.id)
  }
  for (const node of cards) {
    if (!Number.isInteger(node.order) || node.order < 1 || node.order > expectedCardNodes) {
      return issue('ids', `${node.id} has order ${node.order}; card orders run from 1 to ${expectedCardNodes}.`)
    }
    if (node.id !== cardNodeId(node.order)) {
      return issue('ids', `${node.id} has order ${node.order}; its id must be ${cardNodeId(node.order)}.`)
    }
  }

  // 4. Every card hangs from the root or a card that opens before it: one tree, and every prefix n0 … nk connected.
  const byId = new Map(tree.nodes.map((node) => [node.id, node]))
  for (const node of cards) {
    const parent = node.parentId === null ? undefined : byId.get(node.parentId)
    if (node.parentId === null) return issue('parent', `${node.id} hangs from nothing; every card node needs a parent.`)
    if (!parent) return issue('parent', `${node.id} hangs from ${node.parentId}, which is not in the tree.`)
    if (parent.order >= node.order) {
      return issue('parent', `${node.id} hangs from ${parent.id}, which opens after it; a parent must open first.`)
    }
  }

  // 5. The orders are a breadth-first walk of the tree's own edges, children by y and then x (today's tie rule).
  const children = new Map<string, TreeNode[]>()
  for (const node of cards) children.set(node.parentId!, [...(children.get(node.parentId!) ?? []), node])
  const walk: TreeNode[] = [root]
  for (let i = 0; i < walk.length; i += 1) {
    const next = [...(children.get(walk[i]!.id) ?? [])].sort((a, b) => a.y - b.y || a.x - b.x)
    walk.push(...next)
  }
  for (const [k, node] of walk.entries()) {
    if (node.order !== k) {
      const expected = walk.find((other) => other.order === k)
      return issue('breadth-first', `Breadth-first from the root, ${node.id} opens before ${expected?.id ?? cardNodeId(k)}; it must be ${cardNodeId(k)}.`)
    }
  }

  // 6. Inside the tree's box.
  for (const node of tree.nodes) {
    if (node.x < TREE_BOX.minX || node.x > TREE_BOX.maxX || node.y < TREE_BOX.minY || node.y > TREE_BOX.maxY) {
      return issue('outside-box', `${node.id} sits at (${node.x}, ${node.y}), outside the tree's box (x ${TREE_BOX.minX}–${TREE_BOX.maxX}, y ${TREE_BOX.minY}–${TREE_BOX.maxY}).`)
    }
  }

  // 7. Every pair at least 40 pt apart on the smallest phone; the closest offending pair is named.
  let closest: { a: TreeNode; b: TreeNode; pt: number } | null = null
  for (const [i, a] of tree.nodes.entries()) {
    for (const b of tree.nodes.slice(i + 1)) {
      const pt = spacingPt(a, b)
      if (pt < MIN_NODE_SPACING_PT && (!closest || pt < closest.pt)) closest = { a, b, pt }
    }
  }
  if (closest) {
    return issue('spacing', `${closest.a.id} and ${closest.b.id} are ${Math.floor(closest.pt)} pt apart; the minimum is ${MIN_NODE_SPACING_PT}.`)
  }

  // 8. No two edges cross; edges that share an end are fine.
  const edges = treeEdges(tree)
  for (const [i, a] of edges.entries()) {
    for (const b of edges.slice(i + 1)) {
      if (edgesCross(a, b)) {
        return issue('crossing', `The edge ${a.from.id}–${a.to.id} crosses the edge ${b.from.id}–${b.to.id}.`)
      }
    }
  }
  return null
}

/** Every drawn tree's first broken rule, by scenario; empty when all fourteen are sound. */
export function validateAllTrees(): { scenario: number; issue: TreeIssue }[] {
  const failures: { scenario: number; issue: TreeIssue }[] = []
  for (let T = 1; T <= DRAWN_TREES; T += 1) {
    const found = validateTree(treeFor(T)!, treeCardNodesAt(T))
    if (found) failures.push({ scenario: T, issue: found })
  }
  return failures
}
