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
  type CardNodeState,
  cardNodeValue,
  cardShares,
  constellationEdges,
  constellationTemplate,
  deriveStats,
  eraPct,
  isNodeUnlocked,
  starNodePct,
  STAR_NODE_PCT,
  MIN_ERA_PCT,
  type NodeAssignment,
  nodesUnlockedBetween,
  nodeUnlockLevel,
  nodeValue,
  shapeDef,
  slotCount,
  DRAWN_TIPS,
  legacyProduceNodeIds,
  spNodeValue,
  STAT_NODE_POOL,
  TREE_BOX,
  treeBudget,
  unlockedNodeCount,
  validateTemplate,
} from './constellation'
import { MAX_STARS } from './cards'
import { EXTRA_STAT_NODE_VALUE, emptyExtraStats, extraStatsFromProduce, type ExtraStats } from './extra-stats'
import { parseShapeArt } from './constellation-shapes'
import { MAX_SCENARIO_TIER, baselineSkillPoints, skillPointCap } from './scenarios'
import { STATS, type StatKey, type Stats } from './types'

const TIERS = Array.from({ length: MAX_SCENARIO_TIER }, (_, index) => index + 1)

const card = (
  id: string,
  type: CardNodeState['template']['type'],
  weights = {},
  era = 1,
): CardNodeState => ({
  template: {
    id,
    type,
    era,
    effectProfile: { statBonus: 1, trainingBonus: 1, ...weights },
    hintSkillIds: [`${id}-a`, `${id}-b`, `${id}-c`, `${id}-d`, `${id}-e`, `${id}-f`],
  } as CardNodeState['template'],
  stars: MAX_STARS,
})

const uma = {
  baseStats: { speed: 100, stamina: 100, power: 100, guts: 100, wit: 100 } as Stats,
  growthRates: { speed: 0, stamina: 0, power: 0, guts: 0, wit: 0 } as Stats,
}

/** Deterministic, so a failure is reproducible. */
const rng = (seed: number) => {
  let state = seed >>> 0
  return () => {
    state = (state * 1_664_525 + 1_013_904_223) >>> 0
    return state / 0x1_0000_0000
  }
}

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
    expect(TIERS.map(nodeValue)).toEqual([220, 198, 233, 189, 164, 164, 163, 169, 168, 168, 167, 172, 171, 171])
    expect([STAT_NODE_POOL, EXTRA_STAT_NODE_VALUE]).toEqual([240, 40])
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
      expect(slotCount(tier)).toBe(shapeDef(tier).cardNodes)
      expect(template.nodes.filter((node) => node.kind === 'card')).toHaveLength(shapeDef(tier).cardNodes)
      // The tips' old ids are kept only for the v12 migration, and no tree node uses them.
      const tips = legacyProduceNodeIds(tier)
      expect(tips).toHaveLength(DRAWN_TIPS)
      expect(template.nodes.some((node) => tips.includes(node.id))).toBe(false)
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
    expect(starNodePct(MAX_STARS)).toBe(100)
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

  it('makes a newer card worth strictly more on the same node', () => {
    const tier = 7
    const template = constellationTemplate(tier)
    const node = template.nodes.find((entry) => entry.kind === 'card')!
    const totalFor = (era: number) => deriveStats({ buffs: false,
      tier,
      trainingLevel: 10,
      template,
      assignments: { [node.id]: { kind: 'card', cardId: 'c' } },
      cardSetIds: ['c'],
      umaTemplate: uma,
      cards: new Map([['c', card('c', 'speed', {}, era)]]),
    }).rawTotal

    const current = totalFor(7)
    expect(current).toBe(nodeValue(tier))
    expect(totalFor(6)).toBeCloseTo(current * 0.95, 6)
    expect(totalFor(1)).toBeCloseTo(current * 0.7, 6)
    expect(totalFor(6)).toBeGreaterThan(totalFor(5))
  })

  it('reports what one node of a card is worth', () => {
    expect(cardNodeValue(7, card('c', 'speed', {}, 7))).toBe(nodeValue(7))
    expect(cardNodeValue(7, { ...card('c', 'speed', {}, 7), stars: 0 })).toBeCloseTo(nodeValue(7) * 0.6, 6)
    expect(cardNodeValue(7, card('c', 'speed', {}, 1))).toBeCloseTo(nodeValue(7) * 0.7, 6)
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

describe('unlock schedule', () => {
  it('names the Training Level that opens each node, agreeing with the unlock check', () => {
    for (const tier of TIERS) {
      const template = constellationTemplate(tier)
      for (const node of template.nodes) {
        const level = nodeUnlockLevel(template, node)
        if (node.kind !== 'root') expect(isNodeUnlocked(template, node, level - 1)).toBe(level === 1)
        expect(isNodeUnlocked(template, node, level)).toBe(true)
      }
    }
  })

  it('spreads the card nodes over Training Levels 1–8 (D235)', () => {
    for (const tier of TIERS) {
      expect(unlockedNodeCount(tier, 8)).toBe(slotCount(tier))
      expect(unlockedNodeCount(tier, 10)).toBe(slotCount(tier))
      expect(unlockedNodeCount(tier, 1)).toBe(Math.ceil(shapeDef(tier).cardNodes / 8))
    }
    expect([1, 2, 4, 7, 8].map((level) => unlockedNodeCount(1, level))).toEqual([3, 5, 9, 16, 18])
  })

  it('never removes a node as the level rises', () => {
    for (const tier of TIERS) {
      for (let tl = 1; tl < 8; tl += 1) {
        expect(unlockedNodeCount(tier, tl + 1)).toBeGreaterThanOrEqual(unlockedNodeCount(tier, tl))
      }
    }
  })

  it('opens the first parent and its grandparents at 9, the second at 10', () => {
    const template = constellationTemplate(1)
    const lineage = template.nodes.filter((node) => node.kind === 'parent' || node.kind === 'grandparent')
    expect(lineage.filter((node) => isNodeUnlocked(template, node, 8))).toHaveLength(0)
    expect(lineage.filter((node) => isNodeUnlocked(template, node, 9))).toHaveLength(3)
    expect(lineage.filter((node) => isNodeUnlocked(template, node, 10))).toHaveLength(6)
  })

  it('names exactly the nodes a level-up opened', () => {
    const template = constellationTemplate(1)
    const opened = nodesUnlockedBetween(template, 9, 10)
    expect(opened.map((node) => node.id).sort()).toEqual(['parent1', 'parent1-gp0', 'parent1-gp1'])
    expect(nodesUnlockedBetween(template, 5, 5)).toHaveLength(0)
  })
})

/** Six active Extra stats: the ones given, topped up with Wit then Guts so no stat passes four. */
function fillSix(extra: ExtraStats): ExtraStats {
  const stats: StatKey[] = []
  for (const id of extra.active) stats.push(id.split('-')[0] as StatKey)
  for (const stat of ['wit', 'guts', 'power', 'stamina', 'speed'] as StatKey[]) {
    while (stats.length < 6 && stats.filter((entry) => entry === stat).length < 4) stats.push(stat)
  }
  return extraStatsFromProduce(stats)
}

describe('the invariance rule', () => {
  const stats: StatKey[] = [...STATS]
  // Friend and Group cards pay skill points, not stats (D132), so the stat total is about the stat types.
  const types: CardNodeState['template']['type'][] = ['speed', 'stamina', 'power', 'guts', 'wit']

  it('pays exactly treeBudget for any full configuration of current-era max-broken cards', () => {
    const random = rng(20260920)
    for (const tier of TIERS) {
      const template = constellationTemplate(tier)
      for (let run = 0; run < 40; run += 1) {
        const cardIds = Array.from({ length: CARD_SET_SIZE }, (_, i) => `card${i}`)
        const cards = new Map(
          cardIds.map((id, i) => [
            id,
            card(id, types[Math.floor(random() * types.length)]!, {
              statBonus: 1 + random() * 3,
              trainingBonus: 1 + random() * 3,
            }, tier),
          ]),
        )
        const assignments: Record<string, NodeAssignment> = {}
        const held = new Map<string, number>()
        for (const node of template.nodes) {
          if (node.kind === 'card') {
            // Any card that still has room under its cap (D134).
            const open = cardIds.filter((id) => (held.get(id) ?? 0) < cardNodeCap(tier))
            const cardId = open[Math.floor(random() * open.length)]!
            held.set(cardId, (held.get(cardId) ?? 0) + 1)
            assignments[node.id] = { kind: 'card', cardId }
          }
        }
        // Six active Extra stats, any spread of at most four a stat (D235).
        const extraStats = extraStatsFromProduce(Array.from({ length: 12 }, () => stats[Math.floor(random() * stats.length)]!).slice(0, 6))

        const derived = deriveStats({ buffs: false,
          tier,
          trainingLevel: 10,
          template,
          assignments,
          cardSetIds: cardIds,
          umaTemplate: uma,
          cards,
          extraStats: fillSix(extraStats),
        })
        expect(derived.rawTotal).toBe(treeBudget(tier))
        expect(derived.assignedNodes).toBe(slotCount(tier) + 6)
      }
    }
  })

  it('moves a card between nodes without changing the total', () => {
    const tier = 7
    const template = constellationTemplate(tier)
    const cardIds = ['a', 'b', 'c', 'd', 'e']
    const cards = new Map(cardIds.map((id, i) => [
      id,
      { ...card(id, (['speed', 'stamina', 'power', 'guts', 'wit'] as const)[i]!, {}, 1 + i * 3), stars: i % 5 },
    ]))
    const cardNodeIds = template.nodes.filter((node) => node.kind === 'card').map((node) => node.id)
    // A fixed multiset: each card occupies a fixed number of nodes, but which nodes changes.
    const multiset = cardNodeIds.map((_, i) => cardIds[i % cardIds.length]!)
    const input = { tier, trainingLevel: 10, template, cardSetIds: cardIds, umaTemplate: uma, cards }

    const straight = deriveStats({ buffs: false,
      ...input,
      assignments: Object.fromEntries(cardNodeIds.map((id, i) => [id, { kind: 'card', cardId: multiset[i]! }])),
    })
    const shuffled = [...multiset].reverse()
    const reversed = deriveStats({ buffs: false,
      ...input,
      assignments: Object.fromEntries(cardNodeIds.map((id, i) => [id, { kind: 'card', cardId: shuffled[i]! }])),
    })
    expect(reversed.rawTotal).toBe(straight.rawTotal)
    expect(reversed.raw).toEqual(straight.raw)
  })

  it('underpays exactly by limit break', () => {
    const template = constellationTemplate(1)
    const cardIds = Array.from({ length: CARD_SET_SIZE }, (_, i) => `c${i}`)
    const assignments: Record<string, NodeAssignment> = {}
    let next = 0
    for (const node of template.nodes) {
      // Round-robin keeps every card inside its cap (D134).
      if (node.kind === 'card') assignments[node.id] = { kind: 'card', cardId: cardIds[next++ % cardIds.length]! }
    }
    const cardNodes = template.nodes.filter((node) => node.kind === 'card').length
    const extraStats = extraStatsFromProduce(['speed', 'speed', 'speed', 'speed', 'stamina', 'stamina'])

    for (let stars = 0; stars <= MAX_STARS; stars += 1) {
      const derived = deriveStats({ buffs: false,
        tier: 1,
        trainingLevel: 10,
        template,
        assignments,
        cardSetIds: cardIds,
        umaTemplate: uma,
        cards: new Map(cardIds.map((id) => [id, { ...card(id, 'speed'), stars }])),
        extraStats,
      })
      const expected =
        (nodeValue(1) * cardNodes * starNodePct(stars)) / 100 + EXTRA_STAT_NODE_VALUE * 6
      expect(derived.rawTotal).toBeCloseTo(expected, 6)
    }
  })

  it('stops paying a card past its cap, counting nodes in template order (D134)', () => {
    const template = constellationTemplate(1)
    const cardNodeIds = template.nodes.filter((node) => node.kind === 'card').map((node) => node.id)
    const assignments = Object.fromEntries(cardNodeIds.slice(0, 6).map((id) => [id, { kind: 'card', cardId: 'c' } as NodeAssignment]))
    const derived = deriveStats({ buffs: false,
      tier: 1, trainingLevel: 10, template, assignments, cardSetIds: ['c'], umaTemplate: uma,
      cards: new Map([['c', card('c', 'speed')]]),
    })
    expect(derived.assignedNodes).toBe(cardNodeCap(1))
    expect(derived.rawTotal).toBe(nodeValue(1) * cardNodeCap(1))
  })

  it('pays Friend and Group cards in skill points, in any slot, and every stat card its stats', () => {
    const template = constellationTemplate(1)
    // A Wit card in the sixth slot and a Friend card in the first: the slot no longer decides (D132).
    const cardIds = ['friend', 'b', 'c', 'd', 'e', 'wit']
    const cards = new Map([
      ['friend', card('friend', 'friend')],
      ['wit', card('wit', 'wit')],
      ['group', card('group', 'group')],
    ])
    const [first, second] = template.nodes.filter((node) => node.kind === 'card').map((node) => node.id)
    const input = { tier: 1, trainingLevel: 10, template, cardSetIds: cardIds, umaTemplate: uma, cards }

    // Training alone pays 40% of the SP cap at TL10 (D133), whatever the set holds.
    const baseline = baselineSkillPoints(1, 10)
    expect(baseline).toBe(800)
    const wit = deriveStats({ buffs: false, ...input, assignments: { [first!]: { kind: 'card', cardId: 'wit' } } })
    expect(wit.skillPoints).toBe(baseline)
    expect(wit.raw.wit).toBeGreaterThan(0)
    expect(wit.rawTotal).toBe(nodeValue(1))

    const friend = deriveStats({ buffs: false, ...input, assignments: { [first!]: { kind: 'card', cardId: 'friend' } } })
    expect(friend.skillPoints).toBe(baseline + spNodeValue(1))
    expect(friend.rawTotal).toBe(0)

    const both = deriveStats({ buffs: false,
      ...input,
      cardSetIds: ['friend', 'group', 'c', 'd', 'e', 'wit'],
      assignments: { [first!]: { kind: 'card', cardId: 'friend' }, [second!]: { kind: 'card', cardId: 'group' } },
    })
    expect(both.skillPoints).toBe(baseline + 2 * spNodeValue(1))
  })

  it('clamps skill points to the scenario cap', () => {
    const template = constellationTemplate(1)
    const cardIds = ['scenario', 'b', 'c', 'd', 'e', 'f']
    const assignments = Object.fromEntries(
      template.nodes.filter((n) => n.kind === 'card').map((n) => [n.id, { kind: 'card', cardId: 'scenario' } as NodeAssignment]),
    )
    const derived = deriveStats({ buffs: false,
      tier: 1,
      trainingLevel: 10,
      template,
      assignments,
      cardSetIds: cardIds,
      umaTemplate: uma,
      cards: new Map([['scenario', card('scenario', 'friend')]]),
    })
    expect(derived.skillPoints).toBe(skillPointCap(1))
  })
})

describe('derivation', () => {
  const template = constellationTemplate(1)
  const firstCardNode = template.nodes.find((node) => node.kind === 'card')!

  it('applies growth rates after the raw budget, and caps after growth', () => {
    const derived = deriveStats({ buffs: false,
      tier: 1,
      trainingLevel: 10,
      template,
      assignments: { [firstCardNode.id]: { kind: 'card', cardId: 'c' } },
      cardSetIds: ['c'],
      umaTemplate: {
        baseStats: uma.baseStats,
        growthRates: { speed: 0.2, stamina: 0, power: 0, guts: 0, wit: 0 },
      },
      cards: new Map([['c', card('c', 'speed')]]),
    })
    // 220 × 0.70 = 154 raw speed ×1.2 growth = 184.8, on top of base 100.
    expect(derived.raw.speed).toBe(154)
    expect(derived.stats.speed).toBe(285)
    // 220 × 0.30 = 66 raw power, no growth, on the same start.
    expect(derived.stats.power).toBe(166)
    // An untouched stat sits exactly on her base.
    expect(derived.stats.guts).toBe(uma.baseStats.guts)
  })

  it('starts every stat at her base, with no career-race bonus, at every Training Level (D152)', () => {
    const early = deriveStats({ buffs: false,
      tier: 1, trainingLevel: 1, template, assignments: {}, cardSetIds: [], umaTemplate: uma, cards: new Map(),
    })
    expect(early.stats).toEqual(uma.baseStats)
  })

  it('never lets a stat exceed its cap', () => {
    const assignments = Object.fromEntries(
      template.nodes.filter((node) => node.kind === 'card').map((node) => [node.id, { kind: 'card', cardId: 'c' } as NodeAssignment]),
    )
    const derived = deriveStats({ buffs: false,
      tier: 1,
      trainingLevel: 10,
      template,
      assignments,
      extraStats: extraStatsFromProduce(['speed', 'speed', 'speed', 'speed']),
      cardSetIds: ['c'],
      umaTemplate: { baseStats: uma.baseStats, growthRates: { speed: 1, stamina: 0, power: 0, guts: 0, wit: 0 } },
      cards: new Map([['c', card('c', 'speed')]]),
    })
    expect(derived.stats.speed).toBe(capProfile(1).speed)
  })

  it('ignores assignments on locked nodes and cards outside the set', () => {
    const locked = template.nodes.filter((node) => node.kind === 'card').at(-1)!
    const cards = new Map([['c', card('c', 'speed')]])

    expect(deriveStats({ buffs: false,
      tier: 1, trainingLevel: 1, template, cardSetIds: ['c'], umaTemplate: uma, cards,
      assignments: { [locked.id]: { kind: 'card', cardId: 'c' } },
    }).rawTotal).toBe(0)

    expect(deriveStats({ buffs: false,
      tier: 1, trainingLevel: 10, template, cardSetIds: ['other'], umaTemplate: uma, cards,
      assignments: { [firstCardNode.id]: { kind: 'card', cardId: 'c' } },
    }).rawTotal).toBe(0)
  })

  it('pays one skill per node a card occupies, in hint order, deduplicated', () => {
    const cardNodeIds = template.nodes.filter((node) => node.kind === 'card').map((node) => node.id).slice(0, 3)
    const derived = deriveStats({ buffs: false,
      tier: 1,
      trainingLevel: 10,
      template,
      assignments: Object.fromEntries(cardNodeIds.map((id) => [id, { kind: 'card', cardId: 'c' } as NodeAssignment])),
      cardSetIds: ['c'],
      umaTemplate: uma,
      cards: new Map([['c', card('c', 'speed')]]),
    })
    expect(derived.cardSkillIds).toEqual(['c-a', 'c-b', 'c-c'])
    // Each node also pays the next of the card's golds while it has any, gold first (D182).
    const withGolds = deriveStats({ buffs: false,
      tier: 1, trainingLevel: 10, template, cardSetIds: ['c'], umaTemplate: uma,
      assignments: Object.fromEntries(cardNodeIds.map((id) => [id, { kind: 'card', cardId: 'c' } as NodeAssignment])),
      cards: new Map([['c', { ...card('c', 'speed'), goldSkillIds: ['g-1', 'g-2'] }]]),
    })
    expect(withGolds.cardSkillIds).toEqual(['g-1', 'c-a', 'g-2', 'c-b', 'c-c'])
  })

  it('is pure: the same input derives the same result', () => {
    const input = {
      tier: 1, trainingLevel: 10, template, cardSetIds: ['c'], umaTemplate: uma,
      cards: new Map([['c', card('c', 'speed')]]),
      assignments: { [firstCardNode.id]: { kind: 'card', cardId: 'c' } as NodeAssignment },
    }
    expect(deriveStats(input)).toEqual(deriveStats(input))
  })
})
