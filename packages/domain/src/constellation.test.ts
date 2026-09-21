import { describe, expect, it } from 'vitest'

import {
  CAP_PROFILES,
  CARD_SET_SIZE,
  CARD_TYPE_SHARES,
  SCENARIO_SLOT_INDEX,
  capBudget,
  capProfile,
  cardShares,
  cardTilt,
  constellationTemplate,
  deriveStats,
  isNodeUnlocked,
  lbNodePct,
  nodeValue,
  nodesUnlockedBetween,
  slotCount,
  treeBudget,
  unlockedNodeCount,
  validateTemplate,
  type CardNodeState,
  type NodeAssignment,
} from './constellation'
import { MAX_SCENARIO_TIER } from './scenarios'
import { STATS, type StatKey, type Stats } from './types'

const TIERS = Array.from({ length: MAX_SCENARIO_TIER }, (_, index) => index + 1)

const card = (id: string, type: CardNodeState['template']['type'], weights = {}): CardNodeState => ({
  template: {
    id,
    type,
    effectProfile: { statBonus: 1, trainingBonus: 1, ...weights },
    hintSkills: [`${id}-a`, `${id}-b`, `${id}-c`, `${id}-d`, `${id}-e`, `${id}-f`],
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
  it('pays 60% of the cap budget, so no build reaches every cap', () => {
    for (const tier of TIERS) {
      expect(treeBudget(tier)).toBe(Math.round(0.6 * capBudget(tier)))
      expect(treeBudget(tier)).toBeLessThan(capBudget(tier))
    }
  })

  it('divides into an integer node value at every tier', () => {
    for (const tier of TIERS) expect(Number.isInteger(nodeValue(tier))).toBe(true)
    expect(nodeValue(1)).toBe(200)
    expect(nodeValue(2)).toBe(175)
    expect(nodeValue(3)).toBe(210)
    expect(nodeValue(4)).toBe(168)
    for (let tier = 5; tier <= MAX_SCENARIO_TIER; tier += 1) expect(nodeValue(tier)).toBe(150)
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
  const types: CardNodeState['template']['type'][] = ['speed', 'stamina', 'power', 'guts', 'wit', 'friend', 'group']

  it('pays exactly treeBudget for any full configuration of max-broken cards', () => {
    const random = rng(20260920)
    for (const tier of TIERS) {
      const template = constellationTemplate(tier)
      for (let run = 0; run < 40; run += 1) {
        // The scenario slot is a declared exception, so keep it out of the set under test.
        const cardIds = Array.from({ length: CARD_SET_SIZE - 1 }, (_, i) => `card${i}`)
        const cards = new Map(
          cardIds.map((id, i) => [
            id,
            card(id, types[Math.floor(random() * types.length)]!, {
              statBonus: 1 + random() * 3,
              trainingBonus: 1 + random() * 3,
            }),
          ]),
        )
        const assignments: Record<string, NodeAssignment> = {}
        for (const node of template.nodes) {
          if (node.kind === 'card') {
            assignments[node.id] = { kind: 'card', cardId: cardIds[Math.floor(random() * cardIds.length)]! }
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

  it('underpays exactly by limit break', () => {
    const template = constellationTemplate(1)
    const assignments: Record<string, NodeAssignment> = {}
    for (const node of template.nodes) {
      if (node.kind === 'card') assignments[node.id] = { kind: 'card', cardId: 'c' }
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
        cardSetIds: ['c'],
        umaTemplate: uma,
        cards: new Map([['c', { ...card('c', 'speed'), limitBreak }]]),
      })
      const expected =
        (nodeValue(1) * cardNodes * lbNodePct(limitBreak)) / 100 + nodeValue(1) * statNodes
      expect(derived.rawTotal).toBeCloseTo(expected, 6)
    }
  })

  it('pays the scenario slot in skill points instead of stats', () => {
    const template = constellationTemplate(1)
    const cardIds = ['a', 'b', 'c', 'd', 'e', 'scenario']
    expect(cardIds[SCENARIO_SLOT_INDEX]).toBe('scenario')
    const cards = new Map([
      ['a', card('a', 'speed')],
      ['scenario', card('scenario', 'wit')],
    ])
    const cardNodeIds = template.nodes.filter((node) => node.kind === 'card').map((node) => node.id)

    const base: Record<string, NodeAssignment> = Object.fromEntries(
      cardNodeIds.map((id) => [id, { kind: 'card', cardId: 'a' } as NodeAssignment]),
    )
    const withScenario: Record<string, NodeAssignment> = {
      ...base,
      [cardNodeIds[0]!]: { kind: 'card', cardId: 'scenario' },
    }
    const input = { tier: 1, trainingLevel: 10, template, cardSetIds: cardIds, umaTemplate: uma, cards }

    const plain = deriveStats({ ...input, assignments: base })
    const scenario = deriveStats({ ...input, assignments: withScenario })

    expect(plain.skillPoints).toBe(0)
    expect(scenario.skillPoints).toBe(nodeValue(1) * 0.25)
    expect(scenario.rawTotal).toBe(plain.rawTotal - nodeValue(1))
  })

  it('clamps skill points to the scenario cap', () => {
    const template = constellationTemplate(1)
    const cardIds = ['a', 'b', 'c', 'd', 'e', 'scenario']
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
      cards: new Map([['scenario', card('scenario', 'wit')]]),
    })
    expect(derived.skillPoints).toBe(300)
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
    // 200 × 0.70 = 140 raw speed, ×1.2 growth = 168, + 100 base.
    expect(derived.raw.speed).toBe(140)
    expect(derived.stats.speed).toBe(268)
    expect(derived.stats.power).toBe(160)
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
