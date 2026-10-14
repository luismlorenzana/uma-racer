// Pins the Extra Stats map (docs/rework/05-training-hub.md §6, §9, D338): its 37 ids, each node's stat vector in every
// tier, Foundation's ×1.5, and the capacity that T125's node values assume.
import { describe, expect, it } from 'vitest'
import { STATS } from '../../types'
import { NODES_THAT_CAN_PAY } from '../tiers/scaling'
import { EXTRA_CAPACITY, EXTRA_HELD, EXTRA_NODES, EXTRA_NODE_IDS, EXTRA_SINGLE_GRADES, EXTRA_STATS, extraCapacity, extraNode, extraNodeStats } from './extra'

const total = (stats: Record<string, number>) => Object.values(stats).reduce((sum, n) => sum + n, 0)

describe('the map', () => {
  it("holds 05 §9's 37 ids in layer order: singles in ring order, Duos, then the Sun", () => {
    const singles = (g: number) => EXTRA_STATS.map((stat) => `${stat}-0${g}`)
    const duos = (g: number) => ['stamina-wit', 'wit-power', 'power-speed', 'speed-guts'].map((pair) => `duo-${pair}-${g}`)
    expect(EXTRA_STATS).toEqual(['stamina', 'wit', 'power', 'speed', 'guts'])
    expect(EXTRA_SINGLE_GRADES).toEqual([1, 3, 5, 7, 9])
    expect(EXTRA_NODE_IDS).toEqual([
      ...singles(1),
      ...singles(3), ...duos(3), 'sun-4',
      ...singles(5), ...duos(5), 'sun-6',
      ...singles(7), 'sun-8',
      ...singles(9), 'sun-10',
    ])
    expect(EXTRA_NODES.map((node) => node.kind).filter((kind) => kind === 'single')).toHaveLength(25)
    expect(EXTRA_NODES.filter((node) => node.kind === 'duo')).toHaveLength(8)
    expect(EXTRA_NODES.filter((node) => node.kind === 'sun').map((node) => node.dishId)).toEqual(['feast-4', 'feast-6', 'feast-8', 'feast-10'])
    expect(extraNode('speed-03')).toMatchObject({ kind: 'single', stats: ['speed'], grade: 3, layer: 2, dishId: 'dish-sweets-3' })
    expect(extraNode('duo-power-speed-5')).toMatchObject({ kind: 'duo', stats: ['power', 'speed'], grade: 5, layer: 3, dishId: 'duo-power-speed-5' })
    expect(extraNode('nope')).toBeUndefined()
  })

  it('holds 5, 15, 25, 31 and 37 by scenario; capacity 7, 9, 11, 13, 15; min of the two is what T125 prices', () => {
    expect(EXTRA_HELD).toEqual([5, 15, 25, 31, 37])
    expect(EXTRA_CAPACITY).toEqual([7, 9, 11, 13, 15])
    expect([1, 2, 3, 4, 5].map((s) => Math.min(extraCapacity(s as 1), EXTRA_HELD[s - 1]!))).toEqual([...NODES_THAT_CAN_PAY])
  })
})

describe('extraNodeStats', () => {
  it('pays 40 × the tier multiplier per node, whatever its kind', () => {
    for (const [tier, T, single, duo, sun] of [[1, 2, 40, 20, 8], [2, 7, 50, 25, 10], [3, 12, 60, 30, 12]] as const) {
      for (const id of EXTRA_NODE_IDS) expect(total(extraNodeStats(tier, T, id)), `${id} at T${T}`).toBe(40 * [1, 1.25, 1.5][tier - 1]!)
      expect(extraNodeStats(tier, T, 'wit-05')).toEqual({ speed: 0, stamina: 0, power: 0, guts: 0, wit: single })
      expect(extraNodeStats(tier, T, 'duo-stamina-wit-3')).toEqual({ speed: 0, stamina: duo, power: 0, guts: 0, wit: duo })
      expect(extraNodeStats(tier, T, 'sun-8')).toEqual(Object.fromEntries(STATS.map((stat) => [stat, sun])))
    }
  })

  it("pays Foundation's ×1.5 in URA Finale: 60, 30 / 30 and 12", () => {
    expect(extraNodeStats(1, 1, 'speed-01').speed).toBe(60)
    expect(extraNodeStats(1, 1, 'duo-speed-guts-3')).toMatchObject({ speed: 30, guts: 30 })
    expect(extraNodeStats(1, 1, 'sun-4').power).toBe(12)
    expect(extraNodeStats(2, 6, 'speed-01').speed).toBe(50)
  })

  it('refuses a scenario outside the tier and an unknown node', () => {
    expect(() => extraNodeStats(1, 6, 'speed-01')).toThrow(RangeError)
    expect(() => extraNodeStats(1, 1, 'speed-02')).toThrow(RangeError)
  })
})
