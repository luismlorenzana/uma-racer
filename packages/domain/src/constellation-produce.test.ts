import { describe, expect, it } from 'vitest'
import { constellationTemplate, deriveStats, statNodeValue, type NodeAssignment } from './constellation'
import { ConstellationProduceConflictError, resolveConstellationProduce } from './constellation-produce'
import { farmCropFor } from './farm/catalog'
import { STATS, zeroStats } from './types'

const template = constellationTemplate(2)
const produceNode = template.nodes.find((node) => node.kind === 'stat')!
const cardNode = template.nodes.find((node) => node.kind === 'card')!
const crop = farmCropFor(2, 'speed')!

const command = (overrides: Partial<Parameters<typeof resolveConstellationProduce>[0]> = {}) => resolveConstellationProduce({
  umaId: 'synthetic-uma',
  tier: 2,
  trainingLevel: 8,
  nodeId: produceNode.id,
  itemId: crop.id,
  quantity: 3,
  current: undefined,
  expectedRevision: 0,
  now: 100,
  ...overrides,
})

describe('constellation Produce command', () => {
  it('fills at revision 1 and describes one deterministic -1 movement', () => {
    expect(command()).toEqual({
      assignment: { kind: 'produce', itemId: crop.id, revision: 1 },
      movement: {
        id: `produce:synthetic-uma:2:${produceNode.id}:1`,
        itemId: crop.id,
        delta: -1,
        reason: 'constellation-produce',
        source: { kind: 'constellation-produce', umaId: 'synthetic-uma', tier: 2, nodeId: produceNode.id, revision: 1 },
        createdAt: 100,
      },
      quantityBefore: 3,
      quantityAfter: 2,
    })
  })

  it('replaces legacy at revision 1 and current Produce at the next revision', () => {
    expect(command({ current: { kind: 'legacy-produce', stat: 'wit' } }).assignment.revision).toBe(1)
    expect(command({ current: { kind: 'produce', itemId: crop.id, revision: 7 }, expectedRevision: 7 }).assignment.revision).toBe(8)
  })

  it('rejects every invalid target before describing a spend', () => {
    expect(() => command({ quantity: 0 })).toThrow(/out of stock/)
    expect(() => command({ itemId: 'produce:t1:speed' })).toThrow(/another scenario/)
    expect(() => command({ itemId: 'missing' })).toThrow(/unknown/)
    expect(() => command({ nodeId: cardNode.id })).toThrow(/not a Produce/)
    expect(() => command({ trainingLevel: 1 })).toThrow(/locked/)
    expect(() => command({ current: { kind: 'produce', itemId: crop.id, revision: 2 }, expectedRevision: 1 }))
      .toThrow(ConstellationProduceConflictError)
  })
})

describe('Produce-node budget', () => {
  const umaTemplate = { baseStats: zeroStats(), growthRates: zeroStats() }
  const statNodes = template.nodes.filter((node) => node.kind === 'stat')

  it('keeps six legacy and six stocked assignments at the exact 240-point pool for every split', () => {
    for (const mode of ['legacy', 'produce'] as const) {
      for (let offset = 0; offset < STATS.length; offset += 1) {
        const assignments: Record<string, NodeAssignment> = {}
        statNodes.forEach((node, index) => {
          const stat = STATS[(index + offset) % STATS.length]!
          assignments[node.id] = mode === 'legacy'
            ? { kind: 'legacy-produce', stat }
            : { kind: 'produce', itemId: farmCropFor(2, stat)!.id, revision: 1 }
        })
        const derived = deriveStats({
          tier: 2,
          trainingLevel: 10,
          template,
          assignments,
          cardSetIds: [],
          umaTemplate,
          cards: new Map(),
          buffs: false,
        })
        expect(derived.rawTotal).toBe(6 * statNodeValue(2))
      }
    }
  })
})
