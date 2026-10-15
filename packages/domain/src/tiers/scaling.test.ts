// Pins tier scaling (docs/game/04-tiers-and-promotion.md §7, docs/game/05-training-hub.md §6, D338).
import { describe, expect, it } from 'vitest'
import { capProfile } from '../constellation'
import { treeCardNodesAt } from '../training/trees/sizes'
import {
  EXTRA_NODE_VALUES_TIER_1, FIFTEENTH_CAPS, FIFTEENTH_SP_CAP, FULL_ACTIVE_EXTRA_NODES, NODES_THAT_CAN_PAY, TIER_MULTIPLIER_PCT,
  capBudgetAt, capProfileAt, extraBudget, extraBudgetAt, extraNodeValues, nodeValue, spCapAt,
} from './scaling'

const ALL_T = Array.from({ length: 15 }, (_, i) => i + 1)

describe('caps', () => {
  it("keeps today's profile for scenarios 1–14 and continues the +250 rotation at the 15th", () => {
    for (let T = 1; T <= 14; T += 1) expect(capProfileAt(T)).toEqual(capProfile(T))
    expect(capProfileAt(15)).toEqual({ speed: 2600, stamina: 1750, power: 1800, guts: 1700, wit: 1650 })
    expect(FIFTEENTH_CAPS).toEqual(capProfileAt(15))
    expect(ALL_T.map(capBudgetAt)).toEqual(ALL_T.map((T) => 6000 + 250 * (T - 1)))
    expect(() => capProfileAt(16)).toThrow(RangeError)
  })

  it('climbs the SP ladder to 5,200 at the 15th', () => {
    expect(ALL_T.map(spCapAt)).toEqual([2000, 2400, 2800, 3000, 3200, 3400, 3600, 3800, 4000, 4200, 4400, 4600, 4800, 5000, 5200])
    expect(FIFTEENTH_SP_CAP).toBe(5200)
  })
})

describe('Extra Stats', () => {
  it('pays 40 / 20 / 8 at tier 1, ×1.25 and ×1.5 after (D338)', () => {
    expect(EXTRA_NODE_VALUES_TIER_1).toEqual({ single: 40, duo: 20, sun: 8 })
    expect(TIER_MULTIPLIER_PCT).toEqual([100, 125, 150])
    expect(([1, 2, 3] as const).map(extraNodeValues)).toEqual([
      { single: 40, duo: 20, sun: 8 }, { single: 50, duo: 25, sun: 10 }, { single: 60, duo: 30, sun: 12 },
    ])
    for (const tier of [1, 2, 3] as const) {
      const values = extraNodeValues(tier)
      expect(values.single).toBe(2 * values.duo)
      expect(values.single).toBe(5 * values.sun)
      expect(Object.values(values).every(Number.isInteger)).toBe(true)
    }
  })

  it('holds a full build at 5, 9, 11, 13 and 15 active nodes (04 §7)', () => {
    expect(FULL_ACTIVE_EXTRA_NODES).toEqual([5, 9, 11, 13, 15])
    expect(NODES_THAT_CAN_PAY).toBe(FULL_ACTIVE_EXTRA_NODES)
  })

  it("gives E's fifteen cells (05 §6)", () => {
    expect(ALL_T.map(extraBudgetAt)).toEqual([200, 360, 440, 520, 600, 250, 450, 550, 650, 750, 300, 540, 660, 780, 900])
    expect(extraBudget(2, 3)).toBe(550)
    expect(() => extraBudget(1, 6 as never)).toThrow(RangeError)
  })
})

describe('node values', () => {
  it("pins 04 §7's decided column", () => {
    expect(ALL_T.map(nodeValue)).toEqual([283, 212, 173, 147, 129, 342, 253, 205, 173, 150, 400, 294, 237, 199, 171])
  })

  it('keeps a full build within N/2 of 60% of the cap budget', () => {
    for (const T of ALL_T) {
      const N = treeCardNodesAt(T)
      expect(Math.abs(N * nodeValue(T) + extraBudgetAt(T) - 0.6 * capBudgetAt(T))).toBeLessThanOrEqual(N / 2)
    }
  })
})
