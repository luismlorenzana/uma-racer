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
  cardTilt,
  constellationEdges,
  constellationTemplate,
  deriveStats,
  eraPct,
  isNodeUnlocked,
  lbNodePct,
  MIN_ERA_PCT,
  type NodeAssignment,
  nodesUnlockedBetween,
  nodeValue,
  shapeDef,
  slotCount,
  spNodeValue,
  untrainedFloor,
  STAT_NODE_POOL,
  statNodeValue,
  TREE_BOX,
  treeBudget,
  unlockedNodeCount,
  validateTemplate,
} from './constellation'
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
  limitBreak: 4,
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
  it('matches the original game for the four released scenarios', () => {
    expect(capProfile(1)).toEqual({ speed: 1400, stamina: 1400, power: 1400, guts: 1400, wit: 1400 })
    expect(capProfile(2).wit).toBe(1800)
    expect(capProfile(3).stamina).toBe(1900)
    expect(capProfile(4).speed).toBe(1600)
  })

  it('gives every released scenario the same 7000 budget, shaped differently', () => {
    for (const tier of [1, 2, 3, 4]) expect(capBudget(tier)).toBe(7000)
    expect(new Set([1, 2, 3, 4].map((tier) => JSON.stringify(capProfile(tier)))).size).toBe(4)
  })

  it('rises by 250 per tier from tier 5 and never exceeds the 2000 ceiling', () => {
    for (let tier = 5; tier <= MAX_SCENARIO_TIER; tier += 1) {
      expect(capBudget(tier)).toBe(7000 + 250 * (tier - 4))
    }
    for (const profile of CAP_PROFILES) {
      for (const stat of STATS) expect(profile[stat]).toBeLessThanOrEqual(2000)
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

  it('pays card and stat nodes integer values, stat nodes sharing a fixed 240-point pool (D134)', () => {
    for (const tier of TIERS) {
      expect(Number.isInteger(nodeValue(tier))).toBe(true)
      expect(Number.isInteger(statNodeValue(tier))).toBe(true)
      expect(statNodeValue(tier) * shapeDef(tier).statNodes).toBe(240)
    }
    expect(TIERS.map(nodeValue)).toEqual([220, 198, 233, 189, 164, 164, 163, 169, 168, 168, 167, 172, 171, 171])
    expect(TIERS.map(statNodeValue)).toEqual([80, 60, 80, 60, 60, 60, 60, 48, 48, 48, 48, 40, 40, 40])
  })

  it('caps every card at its fair share of the card nodes plus one (D134)', () => {
    expect(TIERS.map(cardFairShare)).toEqual([3, 4, 3, 4, 5, 5, 5, 5, 5, 5, 5, 5, 6, 6])
    for (const tier of TIERS) {
      expect(cardNodeCap(tier)).toBe(cardFairShare(tier) + 1)
      // Six cards at their fair share can always fill the tree, so the cap never strands a node.
      expect(cardFairShare(tier) * CARD_SET_SIZE).toBeGreaterThanOrEqual(shapeDef(tier).cardNodes)
    }
  })

  it('gives every scenario a distinct slot count', () => {
    expect(new Set(TIERS.map(slotCount)).size).toBe(MAX_SCENARIO_TIER)
  })
})

describe('card shares', () => {
  it('sums every card type to exactly 100', () => {
    for (const type of Object.keys(CARD_TYPE_SHARES) as (keyof typeof CARD_TYPE_SHARES)[]) {
      const total = Object.values(CARD_TYPE_SHARES[type]).reduce((sum, share) => sum + (share ?? 0), 0)
      expect(total).toBe(100)
    }
  })

  it('still sums to 100 once tilt shifts the split', () => {
    for (const weights of [{ statBonus: 2, trainingBonus: 0 }, { statBonus: 0, trainingBonus: 2 }, {}]) {
      for (const type of ['speed', 'stamina', 'power', 'guts', 'wit'] as StatKey[]) {
        const shares = cardShares(card('c', type, weights).template)
        const total = Object.values(shares).reduce((sum, share) => sum + (share ?? 0), 0)
        expect(total).toBe(100)
      }
    }
  })

  it('tilts toward the primary stat and stays bounded', () => {
    const specialist = cardShares(card('c', 'speed', { statBonus: 2, trainingBonus: 0 }).template)
    expect(specialist.speed).toBeGreaterThan(CARD_TYPE_SHARES.speed.speed!)
    expect(cardTilt(card('c', 'speed', { statBonus: 40, trainingBonus: 0 }).template)).toBe(10)
    expect(cardTilt(card('c', 'speed', { statBonus: 0, trainingBonus: 40 }).template)).toBe(-10)
  })

  it('never tilts a broad support card', () => {
    expect(cardTilt(card('c', 'friend', { statBonus: 9, trainingBonus: 0 }).template)).toBe(0)
    expect(cardShares(card('c', 'group').template)).toEqual(CARD_TYPE_SHARES.group)
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
    const totalFor = (era: number) => deriveStats({
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
    expect(cardNodeValue(7, { ...card('c', 'speed', {}, 7), limitBreak: 0 })).toBeCloseTo(nodeValue(7) * 0.6, 6)
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
  const tree = (tier: number) =>
    constellationTemplate(tier).nodes.filter((node) => node.kind === 'card' || node.kind === 'stat')

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

  it('separates nodes enough to stay legible at tier 14, the densest tree', () => {
    for (const tier of TIERS) {
      const nodes = tree(tier)
      const gaps = nodes.flatMap((a, i) => nodes.slice(i + 1).map((b) => Math.hypot(a.x - b.x, a.y - b.y)))
      // 9 units is about 35 pt on a 390 pt canvas, so a 44 pt node reads without zooming.
      expect(Math.min(...gaps)).toBeGreaterThan(9)
    }
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
  it('opens every card and stat node by Training Level 8', () => {
    for (const tier of TIERS) {
      expect(unlockedNodeCount(tier, 8)).toBe(slotCount(tier))
      expect(unlockedNodeCount(tier, 10)).toBe(slotCount(tier))
      expect(unlockedNodeCount(tier, 1)).toBeLessThan(slotCount(tier))
    }
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
          } else if (node.kind === 'stat') {
            assignments[node.id] = { kind: 'stat', stat: stats[Math.floor(random() * stats.length)]! }
          }
        }

        const derived = deriveStats({
          tier,
          trainingLevel: 10,
          template,
          assignments,
          cardSetIds: cardIds,
          umaTemplate: uma,
          cards,
        })
        expect(derived.rawTotal).toBe(treeBudget(tier))
        expect(derived.assignedNodes).toBe(slotCount(tier))
      }
    }
  })

  it('moves a card between nodes without changing the total', () => {
    const tier = 7
    const template = constellationTemplate(tier)
    const cardIds = ['a', 'b', 'c', 'd', 'e']
    const cards = new Map(cardIds.map((id, i) => [
      id,
      { ...card(id, (['speed', 'stamina', 'power', 'guts', 'wit'] as const)[i]!, {}, 1 + i * 3), limitBreak: i % 5 },
    ]))
    const cardNodeIds = template.nodes.filter((node) => node.kind === 'card').map((node) => node.id)
    // A fixed multiset: each card occupies a fixed number of nodes, but which nodes changes.
    const multiset = cardNodeIds.map((_, i) => cardIds[i % cardIds.length]!)
    const input = { tier, trainingLevel: 10, template, cardSetIds: cardIds, umaTemplate: uma, cards }

    const straight = deriveStats({
      ...input,
      assignments: Object.fromEntries(cardNodeIds.map((id, i) => [id, { kind: 'card', cardId: multiset[i]! }])),
    })
    const shuffled = [...multiset].reverse()
    const reversed = deriveStats({
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
      if (node.kind === 'stat') assignments[node.id] = { kind: 'stat', stat: 'speed' }
    }
    const cardNodes = template.nodes.filter((node) => node.kind === 'card').length
    const statNodes = template.nodes.filter((node) => node.kind === 'stat').length

    for (const limitBreak of [0, 1, 2, 3, 4]) {
      const derived = deriveStats({
        tier: 1,
        trainingLevel: 10,
        template,
        assignments,
        cardSetIds: cardIds,
        umaTemplate: uma,
        cards: new Map(cardIds.map((id) => [id, { ...card(id, 'speed'), limitBreak }])),
      })
      const expected =
        (nodeValue(1) * cardNodes * lbNodePct(limitBreak)) / 100 + statNodeValue(1) * statNodes
      expect(derived.rawTotal).toBeCloseTo(expected, 6)
    }
  })

  it('stops paying a card past its cap, counting nodes in template order (D134)', () => {
    const template = constellationTemplate(1)
    const cardNodeIds = template.nodes.filter((node) => node.kind === 'card').map((node) => node.id)
    const assignments = Object.fromEntries(cardNodeIds.slice(0, 6).map((id) => [id, { kind: 'card', cardId: 'c' } as NodeAssignment]))
    const derived = deriveStats({
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
    const wit = deriveStats({ ...input, assignments: { [first!]: { kind: 'card', cardId: 'wit' } } })
    expect(wit.skillPoints).toBe(baseline)
    expect(wit.raw.wit).toBeGreaterThan(0)
    expect(wit.rawTotal).toBe(nodeValue(1))

    const friend = deriveStats({ ...input, assignments: { [first!]: { kind: 'card', cardId: 'friend' } } })
    expect(friend.skillPoints).toBe(baseline + spNodeValue(1))
    expect(friend.rawTotal).toBe(0)

    const both = deriveStats({
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
    const derived = deriveStats({
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
    const derived = deriveStats({
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
    // 220 × 0.70 = 154 raw speed ×1.2 growth = 184.8, on top of the TL10 untrained floor of 500 (D134).
    expect(derived.raw.speed).toBe(154)
    expect(derived.stats.speed).toBe(685)
    // 220 × 0.30 = 66 raw power, no growth, on the same floor.
    expect(derived.stats.power).toBe(566)
    // An untouched stat sits exactly on the floor.
    expect(derived.stats.guts).toBe(untrainedFloor(10))
  })

  it('lifts only the starting point to the untrained floor, never above a higher base (D134)', () => {
    expect(untrainedFloor(1)).toBe(50)
    expect(untrainedFloor(10)).toBe(500)
    const early = deriveStats({
      tier: 1, trainingLevel: 1, template, assignments: {}, cardSetIds: [], umaTemplate: uma, cards: new Map(),
    })
    // At TL1 the floor (50) is under the base (100), so the base stands.
    expect(early.stats.stamina).toBe(uma.baseStats.stamina)
  })

  it('never lets a stat exceed its cap', () => {
    const assignments = Object.fromEntries(
      template.nodes
        .filter((node) => node.kind === 'stat' || node.kind === 'card')
        .map((node) => [node.id, node.kind === 'stat'
          ? ({ kind: 'stat', stat: 'speed' } as NodeAssignment)
          : ({ kind: 'card', cardId: 'c' } as NodeAssignment)]),
    )
    const derived = deriveStats({
      tier: 1,
      trainingLevel: 10,
      template,
      assignments,
      cardSetIds: ['c'],
      umaTemplate: { baseStats: uma.baseStats, growthRates: { speed: 1, stamina: 0, power: 0, guts: 0, wit: 0 } },
      cards: new Map([['c', card('c', 'speed')]]),
    })
    expect(derived.stats.speed).toBe(capProfile(1).speed)
  })

  it('ignores assignments on locked nodes and cards outside the set', () => {
    const locked = template.nodes.filter((node) => node.kind === 'card').at(-1)!
    const cards = new Map([['c', card('c', 'speed')]])

    expect(deriveStats({
      tier: 1, trainingLevel: 1, template, cardSetIds: ['c'], umaTemplate: uma, cards,
      assignments: { [locked.id]: { kind: 'card', cardId: 'c' } },
    }).rawTotal).toBe(0)

    expect(deriveStats({
      tier: 1, trainingLevel: 10, template, cardSetIds: ['other'], umaTemplate: uma, cards,
      assignments: { [firstCardNode.id]: { kind: 'card', cardId: 'c' } },
    }).rawTotal).toBe(0)
  })

  it('pays one skill per node a card occupies, in hint order, deduplicated', () => {
    const cardNodeIds = template.nodes.filter((node) => node.kind === 'card').map((node) => node.id).slice(0, 3)
    const derived = deriveStats({
      tier: 1,
      trainingLevel: 10,
      template,
      assignments: Object.fromEntries(cardNodeIds.map((id) => [id, { kind: 'card', cardId: 'c' } as NodeAssignment])),
      cardSetIds: ['c'],
      umaTemplate: uma,
      cards: new Map([['c', card('c', 'speed')]]),
    })
    expect(derived.cardSkillIds).toEqual(['c-a', 'c-b', 'c-c'])
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
