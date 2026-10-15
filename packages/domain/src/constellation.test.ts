import { describe, expect, it } from 'vitest'

import {
  buildTemplate,
  CAP_PROFILES,
  capBudget,
  capProfile,
  CARD_SET_SIZE,
  CARD_TYPE_SHARES,
  cardFairShare,
  cardNodeCap,
  type CardNodeType,
  cardShares,
  constellationEdges,
  constellationTemplate,
  eraPct,
  starNodePct,
  STAR_NODE_PCT,
  MIN_ERA_PCT,
  nodeValue,
  shapeDef,
  STAT_NODE_POOL,
  TREE_BOX,
  treeBudget,
  validateTemplate,
} from './constellation'
import { parseShapeArt } from './constellation-shapes'
import { MAX_SCENARIO_TIER } from './scenarios'
import { STATS } from './types'

const TIERS = Array.from({ length: MAX_SCENARIO_TIER }, (_, index) => index + 1)

const card = (id: string, type: CardNodeType, weights = {}) => ({
  template: { id, type, era: 1, effectProfile: { statBonus: 1, trainingBonus: 1, ...weights } },
})

describe('cap profiles', () => {
  it('starts URA Finale at 1200 in every stat', () => {
    expect(capProfile(1)).toEqual({ speed: 1200, stamina: 1200, power: 1200, guts: 1200, wit: 1200 })
    expect(capProfile(2)).toEqual({ speed: 1300, stamina: 1300, power: 1250, guts: 1200, wit: 1200 })
    expect(capProfile(14)).toEqual({ speed: 2500, stamina: 1750, power: 1700, guts: 1650, wit: 1650 })
  })

  it('rises by 250 per tier from 6000, 100 of it to Speed', () => {
    for (let tier = 1; tier <= MAX_SCENARIO_TIER; tier += 1) {
      expect(capBudget(tier)).toBe(6000 + 250 * (tier - 1))
      expect(capProfile(tier).speed).toBe(1200 + 100 * (tier - 1))
    }
    for (const profile of CAP_PROFILES) {
      for (const stat of STATS) expect(profile[stat]).toBeLessThanOrEqual(2500)
    }
  })

  it('clamps out-of-range tiers instead of throwing', () => {
    expect(capProfile(0)).toEqual(capProfile(1))
    expect(capProfile(99)).toEqual(capProfile(MAX_SCENARIO_TIER))
  })
})

describe('budgets', () => {
  it('pays about 60% of the cap budget, so no build reaches every cap', () => {
    for (const tier of TIERS) {
      // Rounding the card node value moves the total by at most half a point per card node.
      expect(Math.abs(treeBudget(tier) - 0.6 * capBudget(tier))).toBeLessThanOrEqual(shapeDef(tier).cardNodes / 2)
      expect(treeBudget(tier)).toBe(shapeDef(tier).cardNodes * nodeValue(tier) + STAT_NODE_POOL)
      expect(treeBudget(tier)).toBeLessThan(capBudget(tier))
    }
  })

  it('pays card nodes integer values beside a fixed 240-point Extra stats pool: six active nodes of 40 (D134, D235)', () => {
    for (const tier of TIERS) expect(Number.isInteger(nodeValue(tier))).toBe(true)
    expect(TIERS.map(nodeValue)).toEqual([187, 176, 215, 181, 158, 158, 158, 163, 163, 162, 162, 167, 166, 166])
    expect(STAT_NODE_POOL).toBe(240)
  })

  it('caps every card at its fair share of the card nodes plus one (D134)', () => {
    expect(TIERS.map(cardFairShare)).toEqual([3, 4, 3, 4, 5, 5, 5, 5, 5, 5, 5, 5, 6, 6])
    for (const tier of TIERS) {
      expect(cardNodeCap(tier)).toBe(cardFairShare(tier) + 1)
      // Six cards at their fair share can always fill the tree, so the cap never strands a node.
      expect(cardFairShare(tier) * CARD_SET_SIZE).toBeGreaterThanOrEqual(shapeDef(tier).cardNodes)
    }
  })

  it('builds every tree from card nodes alone; the six drawn tips that were Produce nodes are pruned (D235)', () => {
    for (const tier of TIERS) {
      const template = constellationTemplate(tier)
      expect(template.nodes.filter((node) => node.kind === 'card')).toHaveLength(shapeDef(tier).cardNodes)
    }
  })
})

describe('card shares', () => {
  it('sums every card type to exactly 100', () => {
    for (const type of Object.keys(CARD_TYPE_SHARES) as (keyof typeof CARD_TYPE_SHARES)[]) {
      const total = Object.values(CARD_TYPE_SHARES[type]).reduce((sum, share) => sum + (share ?? 0), 0)
      expect(total).toBe(100)
    }
  })

  it('pays every card of a type its type’s split, whatever its effect profile (D180)', () => {
    expect(CARD_TYPE_SHARES.speed).toEqual({ speed: 70, power: 30 })
    expect(CARD_TYPE_SHARES.guts).toEqual({ guts: 60, speed: 20, power: 20 })
    for (const type of Object.keys(CARD_TYPE_SHARES) as (keyof typeof CARD_TYPE_SHARES)[]) {
      for (const weights of [{ statBonus: 1.5, trainingBonus: 0 }, { statBonus: 0, trainingBonus: 1.5 }, {}]) {
        expect(cardShares(card('c', type, weights).template)).toEqual(CARD_TYPE_SHARES[type])
      }
    }
  })
})

describe('stars', () => {
  it('pays 60% of a node at 0★ and 100% at 3★, the old 0★ · 1★ · 3★ · 5★ (D147, D200)', () => {
    expect(STAR_NODE_PCT).toEqual([60, 68, 84, 100])
    expect(starNodePct(3)).toBe(100)
    expect(starNodePct(99)).toBe(100)
    expect(starNodePct(-1)).toBe(60)
  })
})

describe('card era', () => {
  it('pays a current-era card in full and docks five points per era it predates', () => {
    expect(eraPct(7, 7)).toBe(100)
    expect(eraPct(6, 7)).toBe(95)
    expect(eraPct(1, 7)).toBe(70)
  })

  it('floors an ancient card rather than letting it reach zero', () => {
    expect(eraPct(1, 14)).toBe(MIN_ERA_PCT)
    expect(eraPct(1, 99)).toBe(MIN_ERA_PCT)
  })

  it('never pays a card more than full value, even from a later era', () => {
    expect(eraPct(9, 7)).toBe(100)
  })
})

describe('templates', () => {
  it('builds a structurally valid template for every scenario', () => {
    for (const tier of TIERS) expect(validateTemplate(constellationTemplate(tier))).toBeNull()
  })

  it('rejects a template whose counts disagree with its nodes', () => {
    const broken = { ...constellationTemplate(1), cardNodes: 99 }
    expect(validateTemplate(broken)).toMatch(/card nodes/)
  })

  it('rejects a parent node that is not detached', () => {
    const template = constellationTemplate(1)
    const broken = {
      ...template,
      nodes: template.nodes.map((node) => (node.kind === 'parent' ? { ...node, parentId: 'root' } : node)),
    }
    expect(validateTemplate(broken)).toMatch(/detached/)
  })
})

describe('layout', () => {
  const tree = (tier: number) => constellationTemplate(tier).nodes.filter((node) => node.kind === 'card')

  it('keeps every tree inside its box', () => {
    for (const tier of TIERS) {
      for (const node of tree(tier)) {
        expect(node.x).toBeGreaterThanOrEqual(TREE_BOX.minX)
        expect(node.x).toBeLessThanOrEqual(TREE_BOX.maxX)
        expect(node.y).toBeGreaterThanOrEqual(TREE_BOX.minY)
        expect(node.y).toBeLessThanOrEqual(TREE_BOX.maxY)
      }
    }
  })

  // The graph's box on a 375 × 812 pt phone, the smallest the game supports; the canvas stretches to it.
  const CANVAS = { width: 351, height: 525 }
  const pt = (a: { x: number; y: number }, b: { x: number; y: number }) =>
    Math.hypot(((a.x - b.x) / 100) * CANVAS.width, ((a.y - b.y) / 100) * CANVAS.height)

  it('keeps 40 pt between any two nodes on the smallest phone, so a tile never overlaps a neighbour', () => {
    for (const tier of TIERS) {
      const nodes = constellationTemplate(tier).nodes
      const gaps = nodes.flatMap((a, i) => nodes.slice(i + 1).map((b) => pt(a, b)))
      expect(Math.min(...gaps)).toBeGreaterThanOrEqual(40)
    }
  })

  it('never lets two edges cross', () => {
    const cross = (p: { x: number; y: number }, q: { x: number; y: number }, r: { x: number; y: number }, s: { x: number; y: number }) => {
      const turn = (a: typeof p, b: typeof p, c: typeof p) => Math.sign((b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x))
      return turn(p, q, r) * turn(p, q, s) < 0 && turn(r, s, p) * turn(r, s, q) < 0
    }
    for (const tier of TIERS) {
      const edges = constellationEdges(constellationTemplate(tier))
      for (const [i, a] of edges.entries()) {
        for (const b of edges.slice(i + 1)) expect(cross(a.from, a.to, b.from, b.to)).toBe(false)
      }
    }
  })

  it('numbers nodes breadth-first, so a node opens only after the one it hangs from', () => {
    for (const tier of TIERS) {
      const template = constellationTemplate(tier)
      const byId = new Map(template.nodes.map((node) => [node.id, node]))
      for (const node of tree(tier)) {
        const parent = byId.get(node.parentId!)!
        if (parent.kind !== 'root') expect(parent.order).toBeLessThan(node.order)
      }
    }
  })

  it('keeps node ids, kinds and order fixed by the counts, so a redrawn shape never changes a saved assignment', () => {
    for (const tier of TIERS) {
      const { cardNodes } = shapeDef(tier)
      const nodes = tree(tier)
      expect(nodes.map((node) => node.id)).toEqual(Array.from({ length: cardNodes }, (_, i) => `n${i}`))
      for (const node of nodes) expect(node.id).toBe(`n${node.order}`)
    }
  })

  it('rejects a malformed drawing', () => {
    expect(() => parseShapeArt('R-o\no')).toThrow()
    expect(() => parseShapeArt('R-o-R')).toThrow(/one root/)
    expect(() => parseShapeArt('R-o-  ')).toThrow(/runs into/)
    expect(() => parseShapeArt(' R-o')).toThrow(/off the grid/)
  })

  it('keeps lineage in its own band, clear of the tree', () => {
    const template = constellationTemplate(7)
    const lineage = template.nodes.filter((node) => node.kind === 'parent' || node.kind === 'grandparent')
    expect(lineage).toHaveLength(6)
    for (const node of lineage) expect(node.y).toBeGreaterThan(TREE_BOX.maxY)
  })

  it('is deterministic: the same tier always lays out identically', () => {
    for (const tier of [1, 7, 14]) {
      expect(buildTemplate(tier).nodes).toEqual(buildTemplate(tier).nodes)
    }
  })

  it('draws an edge for every node that has a parent', () => {
    const template = constellationTemplate(1)
    const edges = constellationEdges(template)
    expect(edges).toHaveLength(template.nodes.filter((node) => node.parentId !== null).length)
    expect(edges.every((edge) => edge.from.id !== edge.to.id)).toBe(true)
  })
})