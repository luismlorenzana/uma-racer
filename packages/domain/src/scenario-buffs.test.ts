import { describe, expect, it } from 'vitest'
import {
  CARD_SET_SIZE,
  cardFairShare,
  cardNodeCap,
  constellationTemplate,
  deriveStats,
  nodeValue,
  type CardNodeState,
  type NodeAssignment,
} from './constellation'
import { SCENARIO_BUFFS, lineageSlotTakesAnyUma, scenarioBuff } from './scenario-buffs'
import { MAX_SCENARIO_TIER } from './scenarios'
import { STATS, type Stats } from './types'

type CardType = CardNodeState['template']['type']
interface SetCard { id: string; type: CardType; nodes?: number; stars?: number; era?: number }

const uma = {
  baseStats: { speed: 0, stamina: 0, power: 0, guts: 0, wit: 0 } as Stats,
  growthRates: { speed: 0, stamina: 0, power: 0, guts: 0, wit: 0 } as Stats,
}

/** One configuration at TL10: each card on its nodes (fair share unless said), stat nodes as given, lineage filled. */
function derive(tier: number, set: SetCard[], options: { statNodes?: number; lineage?: number; goalsWon?: number; buffs?: boolean } = {}) {
  const template = constellationTemplate(tier)
  const cards = new Map(set.map((entry) => [entry.id, {
    template: { id: entry.id, type: entry.type, era: entry.era ?? tier, effectProfile: { statBonus: 1, trainingBonus: 1 }, hintSkillIds: [] },
    stars: entry.stars ?? 5,
  } as unknown as CardNodeState]))
  const assignments: Record<string, NodeAssignment> = {}
  const cardNodes = template.nodes.filter((node) => node.kind === 'card')
  let cursor = 0
  for (const entry of set) {
    for (let placed = 0; placed < (entry.nodes ?? cardFairShare(tier)) && cursor < cardNodes.length; placed += 1) {
      assignments[cardNodes[cursor++]!.id] = { kind: 'card', cardId: entry.id }
    }
  }
  template.nodes.filter((node) => node.kind === 'stat').slice(0, options.statNodes ?? 0)
    .forEach((node) => { assignments[node.id] = { kind: 'stat', stat: 'speed' } })
  template.nodes.filter((node) => node.kind === 'parent' || node.kind === 'grandparent').slice(0, options.lineage ?? 0)
    .forEach((node, index) => { assignments[node.id] = { kind: 'lineage', templateId: `ancestor-${index}` } })
  return deriveStats({
    tier, trainingLevel: 10, template, assignments, cardSetIds: set.map((entry) => entry.id), umaTemplate: uma, cards,
    goalsWon: options.goalsWon, buffs: options.buffs,
  })
}

/** How much the buff multiplies the tree's total for this configuration. */
const lift = (tier: number, set: SetCard[], options: Parameters<typeof derive>[2] = {}) =>
  derive(tier, set, options).rawTotal / derive(tier, set, { ...options, buffs: false }).rawTotal

describe('scenario buffs (D165)', () => {
  it('names one buff per scenario', () => {
    expect(SCENARIO_BUFFS).toHaveLength(MAX_SCENARIO_TIER)
    expect(new Set(SCENARIO_BUFFS.map((buff) => buff.id)).size).toBe(MAX_SCENARIO_TIER)
    expect(scenarioBuff(1).name).toBe('Foundation')
    expect(scenarioBuff(14).name).toBe('Orders')
  })

  it('Foundation (1): stat nodes pay half again', () => {
    expect(derive(1, [], { statNodes: 1 }).raw.speed).toBe(60)
    expect(derive(1, [], { statNodes: 1, buffs: false }).raw.speed).toBe(40)
  })

  it('Team Spirit (2): +1% on card nodes per filled lineage slot', () => {
    expect(lift(2, [{ id: 'a', type: 'speed' }], { lineage: 4 })).toBeCloseTo(1.04, 9)
    expect(lift(2, [{ id: 'a', type: 'speed' }])).toBe(1)
  })

  it('Climax (3): +2% per career goal won in the scenario, up to four', () => {
    expect(lift(3, [{ id: 'a', type: 'speed' }], { goalsWon: 3 })).toBeCloseTo(1.06, 9)
    expect(lift(3, [{ id: 'a', type: 'speed' }], { goalsWon: 9 })).toBeCloseTo(1.08, 9)
  })

  it('Performance (4): +5% when all five stat types are in the set', () => {
    const five = STATS.map((stat) => ({ id: stat, type: stat, nodes: 1 }))
    expect(lift(4, five)).toBeCloseTo(1.05, 9)
    expect(lift(4, five.slice(0, 4))).toBe(1)
  })

  it('Fragments (5): cards at 4★ or higher pay +8%', () => {
    expect(lift(5, [{ id: 'a', type: 'speed', stars: 4 }])).toBeCloseTo(1.08, 9)
    expect(lift(5, [{ id: 'a', type: 'speed', stars: 3 }])).toBe(1)
  })

  it('Expedition (6): cards of era 6 or newer pay +5%', () => {
    expect(lift(6, [{ id: 'a', type: 'speed', era: 6 }])).toBeCloseTo(1.05, 9)
    expect(lift(6, [{ id: 'a', type: 'speed', era: 5 }])).toBe(1)
  })

  it('Genres (7): a type held twice pays +6% on both cards', () => {
    expect(lift(7, [{ id: 'a', type: 'speed' }, { id: 'b', type: 'speed' }])).toBeCloseTo(1.06, 9)
    expect(lift(7, [{ id: 'a', type: 'speed' }, { id: 'b', type: 'stamina' }])).toBe(1)
  })

  it('Cooking (8): a card on its full cap pays +10%', () => {
    expect(lift(8, [{ id: 'a', type: 'speed', nodes: cardNodeCap(8) }])).toBeCloseTo(1.1, 9)
    expect(lift(8, [{ id: 'a', type: 'speed', nodes: cardNodeCap(8) - 1 }])).toBe(1)
  })

  it('Research (9): Speed and Power cards pay +10%', () => {
    expect(lift(9, [{ id: 'a', type: 'power' }])).toBeCloseTo(1.1, 9)
    expect(lift(9, [{ id: 'a', type: 'wit' }])).toBe(1)
  })

  it('Legends (10): the first parent slot takes any Uma', () => {
    expect(lineageSlotTakesAnyUma(10, 'parent0')).toBe(true)
    expect(lineageSlotTakesAnyUma(10, 'parent1')).toBe(false)
    expect(lineageSlotTakesAnyUma(9, 'parent0')).toBe(false)
  })

  it('Construction (11): a card on exactly its fair share pays +8%', () => {
    expect(lift(11, [{ id: 'a', type: 'speed', nodes: cardFairShare(11) }])).toBeCloseTo(1.08, 9)
    expect(lift(11, [{ id: 'a', type: 'speed', nodes: cardFairShare(11) + 1 }])).toBe(1)
  })

  it('Soak (12): Stamina and Guts cards pay +10%', () => {
    expect(lift(12, [{ id: 'a', type: 'guts' }])).toBeCloseTo(1.1, 9)
    expect(lift(12, [{ id: 'a', type: 'speed' }])).toBe(1)
  })

  it('Shared Light (13): the two lowest stats the tree pays gain +8%', () => {
    const five = STATS.map((stat, index) => ({ id: stat, type: stat, nodes: 1 + (index % 3) }))
    const buffed = derive(13, five).raw
    const plain = derive(13, five, { buffs: false }).raw
    const lowest = [...STATS].sort((left, right) => plain[left] - plain[right]).slice(0, 2)
    for (const stat of STATS) expect(buffed[stat]).toBeCloseTo(plain[stat] * (lowest.includes(stat) ? 1.08 : 1), 9)
  })

  it('Orders (14): a Friend card also pays a quarter of a node as stats', () => {
    expect(derive(14, [{ id: 'f', type: 'friend', nodes: 4 }], { buffs: false }).rawTotal).toBe(0)
    expect(derive(14, [{ id: 'f', type: 'friend', nodes: 4 }]).rawTotal).toBeCloseTo(nodeValue(14), 9)
  })

  it('never lets which node a card sits on change a total, at any tier', () => {
    const types: CardType[] = ['speed', 'stamina', 'power', 'guts', 'wit', 'friend']
    for (let tier = 1; tier <= MAX_SCENARIO_TIER; tier += 1) {
      const template = constellationTemplate(tier)
      const cards = new Map(types.map((type, index) => [`c${index}`, {
        template: { id: `c${index}`, type, era: tier - (index % 2), effectProfile: { statBonus: 1, trainingBonus: 1 }, hintSkillIds: [] },
        stars: index % 6,
      } as unknown as CardNodeState]))
      // Card ids in blocks, each card within its cap; then the same ids on the nodes in reverse: counts equal, places not.
      const cardNodes = template.nodes.filter((node) => node.kind === 'card').map((node) => node.id)
      const ids = cardNodes.map((_, index) => `c${Math.min(types.length - 1, Math.floor(index / cardNodeCap(tier)))}`)
      const place = (order: readonly string[]) => {
        const assignments: Record<string, NodeAssignment> = {}
        cardNodes.forEach((nodeId, index) => { assignments[nodeId] = { kind: 'card', cardId: order[index]! } })
        template.nodes.filter((node) => node.kind === 'stat').forEach((node, index) => { assignments[node.id] = { kind: 'stat', stat: STATS[index % 5]! } })
        return deriveStats({ tier, trainingLevel: 10, template, assignments, cardSetIds: [...cards.keys()], umaTemplate: uma, cards, goalsWon: 2 })
      }
      const base = place(ids)
      const moved = place([...ids].reverse())
      expect(moved.rawTotal).toBeCloseTo(base.rawTotal, 9)
      expect(moved.skillPoints).toBe(base.skillPoints)
    }
  })
})
