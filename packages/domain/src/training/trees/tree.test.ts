// The re-authored trees (docs/game/05-training-hub.md §4): breadth-first ids, prefixes that stay connected, the
// carry at the advance, and parity with today's builder on today's drawings.
import { describe, expect, it } from 'vitest'
import { buildTemplate, DRAWN_TIPS, shapeDef } from '../../constellation'
import { SHAPE_ART } from '../../constellation-shapes'
import { TREE_ART } from './shapes'
import { perCardCap, treeCardNodesAt } from './sizes'
import { buildTree, cardNodeId, DRAWN_TREES, nodeOrder, ROOT_ID, treeEdges, treeFor, type Tree } from './tree'

const DRAWN = Array.from({ length: 14 }, (_, i) => i + 1)
const tree = (T: number): Tree => treeFor(T)!

/** Whether n0 … nk form one connected tree on their own edges. */
function prefixConnected(t: Tree, k: number): boolean {
  const ids = new Set(Array.from({ length: k + 1 }, (_, i) => cardNodeId(i)))
  const prefix = t.nodes.filter((node) => ids.has(node.id))
  if (prefix.length !== k + 1) return false
  const reached = new Set([ROOT_ID])
  for (const { from, to } of treeEdges(t)) {
    // Edges come in unlock order, so one pass reaches every node a prefix connects.
    if (ids.has(to.id) && reached.has(from.id)) reached.add(to.id)
  }
  return reached.size === k + 1
}

describe('ids', () => {
  it('names the root n0 and the k-th card node nk', () => {
    expect(ROOT_ID).toBe('n0')
    expect(cardNodeId(1)).toBe('n1')
    expect(cardNodeId(28)).toBe('n28')
    expect(nodeOrder('n0')).toBe(0)
    expect(nodeOrder('n17')).toBe(17)
    for (const malformed of ['root', 'n', 'n-1', 'n01', 'n1.5', 'N3', ' n3', 'n3 ']) expect(nodeOrder(malformed)).toBeNull()
  })
})

describe('every tree', () => {
  it('draws fourteen scenarios; the 15th is drawn when it ships', () => {
    expect(DRAWN_TREES).toBe(14)
    expect(TREE_ART).toHaveLength(14)
  })

  it('has one root and exactly N(T) card nodes, n1 … nN in order, each hanging from a node that opens first', () => {
    const sizes = [12, 16, 20, 24, 28, 12, 16, 20, 24, 28, 12, 16, 20, 24]
    for (const T of DRAWN) {
      const t = tree(T)
      expect(t.scenario).toBe(T)
      expect(t.cardNodes).toBe(sizes[T - 1])
      const [root, ...cards] = t.nodes
      expect(root).toMatchObject({ id: 'n0', kind: 'root', parentId: null, order: 0 })
      expect(cards.map((node) => node.kind)).toEqual(Array(sizes[T - 1]).fill('card'))
      expect(cards.map((node) => node.id)).toEqual(Array.from({ length: sizes[T - 1]! }, (_, i) => `n${i + 1}`))
      const byId = new Map(t.nodes.map((node) => [node.id, node]))
      for (const node of cards) {
        expect(node.order).toBe(nodeOrder(node.id))
        expect(byId.get(node.parentId!)!.order).toBeLessThan(node.order)
      }
    }
  })

  it('keeps every prefix n0 … nk connected, so nothing is ever stranded', () => {
    for (const T of DRAWN) {
      const t = tree(T)
      for (let k = 0; k <= t.cardNodes; k += 1) expect(prefixConnected(t, k), `scenario ${T}, k = ${k}`).toBe(true)
    }
  })

  it('carries every open node to the next scenario of the tier on the same id, under a cap that never falls', () => {
    for (const T of DRAWN) {
      if (T % 5 === 0 || T + 1 > DRAWN_TREES) continue
      const here = tree(T)
      const next = tree(T + 1)
      for (let k = 0; k <= here.cardNodes; k += 1) expect(prefixConnected(next, k), `scenario ${T + 1}, k = ${k}`).toBe(true)
    }
    for (let T = 1; T < 15; T += 1) {
      if (T % 5 === 0) continue
      expect(perCardCap(treeCardNodesAt(T + 1))).toBeGreaterThanOrEqual(perCardCap(treeCardNodesAt(T)))
    }
  })
})

describe('parity with today', () => {
  it("builds today's fourteen drawings, tips included, exactly as today's buildTemplate places and numbers them", () => {
    for (let t = 1; t <= 14; t += 1) {
      const today = buildTemplate(t)
      const def = shapeDef(t)
      const ported = buildTree(SHAPE_ART[t - 1]!, def.cardNodes + DRAWN_TIPS, t, def.shape)
      const byId = new Map(ported.nodes.map((node) => [node.id, node]))
      const shift = (id: string) => (id === 'root' ? 'n0' : `n${Number(id.slice(1)) + 1}`)
      const todayTree = today.nodes.filter((node) => node.kind === 'root' || node.kind === 'card')
      for (const node of todayTree) {
        const twin = byId.get(shift(node.id))!
        expect(twin, `tier ${t} ${node.id}`).toBeDefined()
        expect({ x: twin.x, y: twin.y }).toEqual({ x: node.x, y: node.y })
        expect(twin.parentId).toBe(node.parentId === null ? null : shift(node.parentId))
      }
      // Today's six drawn tips are T129's last six ids.
      expect(ported.nodes).toHaveLength(todayTree.length + DRAWN_TIPS)
    }
  })
})

describe('the builder', () => {
  it('throws on a drawing with the wrong count', () => {
    expect(() => buildTree(TREE_ART[0]!, 13, 1, 'single-trunk')).toThrow(/12 card nodes; it needs 13/)
  })

  it('throws on two roots or a stray connector', () => {
    expect(() => buildTree('R-o-R', 1, 1, 'x')).toThrow(/one root/)
    expect(() => buildTree('R-o-', 1, 1, 'x')).toThrow(/runs into/)
  })

  it('throws on a loop, whether it adds an edge or leaves nodes detached', () => {
    expect(() => buildTree('R-o\n| |\no-o', 3, 1, 'x')).toThrow(/4 connectors for 3 card nodes/)
    expect(() => buildTree('R o-o\n   \\|\n    o', 3, 1, 'x')).toThrow(/not one tree/)
  })

  it('is deterministic: two builds of a drawing are deep-equal', () => {
    for (const T of DRAWN) {
      const shape = tree(T).shape
      expect(buildTree(TREE_ART[T - 1]!, treeCardNodesAt(T), T, shape)).toEqual(buildTree(TREE_ART[T - 1]!, treeCardNodesAt(T), T, shape))
      expect(buildTree(TREE_ART[T - 1]!, treeCardNodesAt(T), T, shape)).toEqual(tree(T))
    }
  })
})

describe('lookup', () => {
  it('has no tree for the 15th until it ships, and refuses anything outside 1–15', () => {
    expect(treeFor(15)).toBeNull()
    for (const T of [0, 16, -1, 1.5, Number.NaN]) expect(() => treeFor(T)).toThrow(RangeError)
  })

  it('builds each tree once and freezes it', () => {
    for (const T of DRAWN) {
      const t = tree(T)
      expect(treeFor(T)).toBe(t)
      expect(Object.isFrozen(t)).toBe(true)
      expect(Object.isFrozen(t.nodes)).toBe(true)
      expect(t.nodes.every((node) => Object.isFrozen(node))).toBe(true)
    }
  })

  it('lists one edge per card node, from the node it hangs from', () => {
    for (const T of DRAWN) {
      const edges = treeEdges(tree(T))
      expect(edges).toHaveLength(tree(T).cardNodes)
      for (const { from, to } of edges) expect(to.parentId).toBe(from.id)
    }
  })
})
