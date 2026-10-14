// The re-authored trees' drawing rules (docs/rework/05-training-hub.md §4): every tree passes, and the validator refuses
// each broken rule in plain words that name the nodes.
import { describe, expect, it } from 'vitest'
import { TREE_BOX } from '../../constellation'
import { parseShapeArt } from '../../constellation-shapes'
import { TREE_ART } from './shapes'
import { treeCardNodesAt } from './sizes'
import { treeEdges, treeFor, type Tree, type TreeNode } from './tree'
import { MIN_NODE_SPACING_PT, PHONE_GRAPH_BOX_PT, spacingPt, validateAllTrees, validateTree } from './validate'

const DRAWN = Array.from({ length: 14 }, (_, i) => i + 1)
const tree = (T: number): Tree => treeFor(T)!

describe('pins', () => {
  it('keeps 40 pt between nodes on the 351 × 525 pt graph box of a 375 pt phone', () => {
    expect(MIN_NODE_SPACING_PT).toBe(40)
    expect(PHONE_GRAPH_BOX_PT).toEqual({ width: 351, height: 525 })
  })
})

describe('the fourteen trees', () => {
  it('all pass the validator at their size', () => {
    for (const T of DRAWN) expect(validateTree(tree(T), treeCardNodesAt(T)), `scenario ${T}`).toBeNull()
    expect(validateAllTrees()).toEqual([])
  })

  it('sit inside the tree box', () => {
    for (const T of DRAWN) {
      for (const node of tree(T).nodes) {
        expect(node.x).toBeGreaterThanOrEqual(TREE_BOX.minX)
        expect(node.x).toBeLessThanOrEqual(TREE_BOX.maxX)
        expect(node.y).toBeGreaterThanOrEqual(TREE_BOX.minY)
        expect(node.y).toBeLessThanOrEqual(TREE_BOX.maxY)
      }
    }
  })

  it('keep every pair of nodes at least 40 pt apart on the smallest phone', () => {
    for (const T of DRAWN) {
      const nodes = tree(T).nodes
      const gaps = nodes.flatMap((a, i) => nodes.slice(i + 1).map((b) => spacingPt(a, b)))
      expect(Math.min(...gaps), `scenario ${T}`).toBeGreaterThanOrEqual(40)
    }
  })

  it('never let two edges cross', () => {
    const turn = (a: TreeNode, b: TreeNode, c: TreeNode) => Math.sign((b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x))
    for (const T of DRAWN) {
      const edges = treeEdges(tree(T))
      for (const [i, a] of edges.entries()) {
        for (const b of edges.slice(i + 1)) {
          const cross = turn(a.from, a.to, b.from) * turn(a.from, a.to, b.to) < 0 && turn(b.from, b.to, a.from) * turn(b.from, b.to, a.to) < 0
          expect(cross, `scenario ${T}: ${a.from.id}–${a.to.id} and ${b.from.id}–${b.to.id}`).toBe(false)
        }
      }
    }
  })

  it('fit 8 node columns and 9 node rows, what 40 pt allows', () => {
    for (const art of TREE_ART) {
      const grid = parseShapeArt(art)
      expect(grid.columns).toBeLessThanOrEqual(8)
      expect(grid.rows).toBeLessThanOrEqual(9)
    }
  })
})

// --- Refusals ---------------------------------------------------------------------------------------------------------

type Draft = { id: string; kind: 'root' | 'card'; parentId: string | null; order: number; x: number; y: number }
const draft = (t: Tree): Draft[] => t.nodes.map((node) => ({ ...node }))
const asTree = (nodes: Draft[], cardNodes = nodes.length - 1): Tree => ({ scenario: 0, shape: 'synthetic', cardNodes, nodes })
const at = (nodes: Draft[], id: string): Draft => nodes.find((node) => node.id === id)!

/** Swaps two nodes' ids and orders, re-pointing their children, so only the breadth-first order breaks. */
function swap(nodes: Draft[], a: string, b: string): Draft[] {
  const rename = (id: string | null) => (id === a ? b : id === b ? a : id)
  return nodes.map((node) => ({ ...node, id: rename(node.id)!, parentId: rename(node.parentId), order: node.id === a ? at(nodes, b).order : node.id === b ? at(nodes, a).order : node.order }))
}

/** A synthetic four-node tree on the canvas: the root and two pairs. */
const SMALL: Draft[] = [
  { id: 'n0', kind: 'root', parentId: null, order: 0, x: 50, y: 10 },
  { id: 'n1', kind: 'card', parentId: 'n0', order: 1, x: 20, y: 40 },
  { id: 'n2', kind: 'card', parentId: 'n0', order: 2, x: 80, y: 40 },
  { id: 'n3', kind: 'card', parentId: 'n1', order: 3, x: 20, y: 70 },
  { id: 'n4', kind: 'card', parentId: 'n2', order: 4, x: 80, y: 70 },
]

describe('the validator refuses', () => {
  it('accepts the synthetic tree as drawn', () => {
    expect(validateTree(asTree(SMALL), 4)).toBeNull()
  })

  it('a tree with no root', () => {
    const nodes = draft(tree(1))
    at(nodes, 'n0').kind = 'card'
    expect(validateTree(asTree(nodes), 12)).toEqual({ code: 'root', reason: 'The tree has no root.' })
  })

  it('11 card nodes where 12 are expected', () => {
    const nodes = draft(tree(1)).filter((node) => node.id !== 'n12')
    expect(validateTree(asTree(nodes), 12)).toEqual({ code: 'card-count', reason: 'The tree has 11 card nodes; it needs 12.' })
  })

  it('a duplicate id', () => {
    const nodes = draft(tree(1))
    at(nodes, 'n12').id = 'n11'
    expect(validateTree(asTree(nodes), 12)).toEqual({ code: 'ids', reason: 'n11 appears more than once.' })
  })

  it("an id that isn't n + its order", () => {
    const nodes = draft(tree(1))
    at(nodes, 'n5').id = 'n50'
    expect(validateTree(asTree(nodes), 12)).toEqual({ code: 'ids', reason: 'n50 has order 5; its id must be n5.' })
  })

  it('a parent of higher order', () => {
    const nodes = draft(tree(1))
    at(nodes, 'n3').parentId = 'n4'
    expect(validateTree(asTree(nodes), 12)).toEqual({
      code: 'parent',
      reason: 'n3 hangs from n4, which opens after it; a parent must open first.',
    })
  })

  it('a missing parent', () => {
    const nodes = draft(tree(1))
    at(nodes, 'n3').parentId = 'n99'
    expect(validateTree(asTree(nodes), 12)).toEqual({ code: 'parent', reason: 'n3 hangs from n99, which is not in the tree.' })
  })

  it('two orders swapped', () => {
    // In the fern, n2 is the first leaflet and n3 the next trunk node; both hang from n1.
    const nodes = swap(draft(tree(1)), 'n2', 'n3')
    expect(validateTree(asTree(nodes), 12)).toEqual({
      code: 'breadth-first',
      reason: 'Breadth-first from the root, n3 opens before n2; it must be n2.',
    })
  })

  it('a node outside the box', () => {
    const nodes = draft(tree(1))
    at(nodes, 'n12').x = 99
    expect(validateTree(asTree(nodes), 12)).toMatchObject({ code: 'outside-box', reason: expect.stringMatching(/^n12 sits at \(99, /) })
  })

  it('two nodes 30 pt apart', () => {
    const nodes = draft(tree(1))
    // n12 is the leaflet beside the last trunk node n11; bring it to 30 pt.
    at(nodes, 'n12').x = at(nodes, 'n11').x + 8.6
    expect(validateTree(asTree(nodes), 12)).toEqual({ code: 'spacing', reason: 'n11 and n12 are 30 pt apart; the minimum is 40.' })
  })

  it('two crossing edges', () => {
    const nodes = SMALL.map((node) => ({ ...node }))
    at(nodes, 'n3').x = 80
    at(nodes, 'n4').x = 20
    expect(validateTree(asTree(nodes), 4)).toEqual({ code: 'crossing', reason: 'The edge n1–n3 crosses the edge n2–n4.' })
  })

  it('an edge that runs through another node', () => {
    const nodes = SMALL.map((node) => ({ ...node }))
    // n2–n4 runs left along y 40, straight through n1.
    Object.assign(at(nodes, 'n4'), { x: 2, y: 40 })
    expect(validateTree(asTree(nodes), 4)).toEqual({ code: 'crossing', reason: 'The edge n0–n1 crosses the edge n2–n4.' })
  })

  it('an edge that folds back along another from a shared end', () => {
    // n2 hangs from n1 but sits back between n1 and the root, so n1–n2 runs along n0–n1.
    const folded: Draft[] = [
      { id: 'n0', kind: 'root', parentId: null, order: 0, x: 50, y: 10 },
      { id: 'n1', kind: 'card', parentId: 'n0', order: 1, x: 50, y: 70 },
      { id: 'n2', kind: 'card', parentId: 'n1', order: 2, x: 50, y: 40 },
    ]
    expect(validateTree(asTree(folded), 2)).toEqual({ code: 'crossing', reason: 'The edge n0–n1 crosses the edge n1–n2.' })
  })
})
