// Pins rival strength on the new trees (docs/rework/04-tiers-and-promotion.md §7, 03 §9) and its parity with today's
// rival rules when both build on the same trained stat.
import { describe, expect, it } from 'vitest'
import { fieldTrainedStat, rivalPreset, rollRivalField, type RivalRng } from '../opponents'
import { DISTANCE_CATEGORIES, RACE_GRADES, STRATEGIES } from '../types'
import { scenarioCatalogue } from './map'
import { REWORK_BUFF_TYPICAL, rivalFieldStat, rivalPresetAt, rivalTrainedStat, rollRivalFieldAt } from './rivals'

/** A small seeded RNG for the parity rolls (mulberry32). */
function seeded(seed: number): RivalRng {
  let state = seed >>> 0
  return {
    next() {
      state = (state + 0x6d2b79f5) >>> 0
      let t = state
      t = Math.imul(t ^ (t >>> 15), t | 1)
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    },
  }
}

const TODAY_T = Array.from({ length: 14 }, (_, i) => i + 1)

describe('the typical trained Uma on the new trees', () => {
  it('is 642.45 at T = 1, 728.46 at 5 and 969.27 at 14', () => {
    expect(rivalTrainedStat(1)).toBeCloseTo(642.45, 2)
    expect(rivalTrainedStat(5)).toBeCloseTo(728.46, 2)
    expect(rivalTrainedStat(14)).toBeCloseTo(969.27, 2)
  })

  it('pins every scenario with a typical buff value, re-measured on rework builds (T133, D349)', () => {
    expect(REWORK_BUFF_TYPICAL).toHaveLength(14)
    expect(TODAY_T.map((T) => Math.round(rivalTrainedStat(T) * 100) / 100)).toEqual([
      642.45, 664.8, 683.49, 707.92, 728.46, 763.29, 777.61, 815.33, 854.71, 839.6, 852.98, 881.1, 885.98, 969.27,
    ])
  })

  it('has no value at the 15th until its buff is measured', () => {
    expect(() => rivalTrainedStat(15)).toThrow(RangeError)
    expect(() => rivalFieldStat(1, scenarioCatalogue(15))).toThrow(RangeError)
  })

  it("keeps D191: a field is never stronger than a later scenario's", () => {
    for (const T of TODAY_T) {
      expect(rivalFieldStat(T)).toBeLessThanOrEqual(rivalTrainedStat(T))
      for (let later = T + 1; later <= 14; later += 1) expect(rivalFieldStat(T)).toBeLessThanOrEqual(rivalFieldStat(later))
    }
    expect(rivalFieldStat(9)).toBeCloseTo(839.6, 2)
    expect(rivalFieldStat(10)).toBe(rivalTrainedStat(10))
  })
})

describe("parity with today's rival rules", () => {
  it('spreads a preset as rivalPreset does, fed the same trained stat', () => {
    for (const T of TODAY_T) {
      for (const grade of RACE_GRADES) {
        for (const distance of DISTANCE_CATEGORIES) {
          for (const strategy of STRATEGIES) {
            expect(rivalPresetAt({ T, grade, distance, strategy, fieldStat: fieldTrainedStat(T) }))
              .toEqual(rivalPreset(T, grade, distance, strategy))
          }
        }
      }
      expect(rivalPresetAt({ T, grade: 'g1', distance: 'long', strategy: 'pace', meters: 3600, fieldStat: fieldTrainedStat(T) }))
        .toEqual(rivalPreset(T, 'g1', 'long', 'pace', 3600))
    }
  })

  it('rolls a field as rollRivalField does, with the same seed', () => {
    for (const T of TODAY_T) {
      for (const [grade, count, seed] of [['g1', 17, 11], ['g3', 7, 12], ['maiden', 11, 13]] as const) {
        const today = rollRivalField({ tier: T, grade, distance: 'mile', count, rng: seeded(seed * T) })
        const rework = rollRivalFieldAt({ T, grade, distance: 'mile', count, rng: seeded(seed * T), fieldStat: fieldTrainedStat(T) })
        expect(rework).toEqual(today)
      }
    }
  })

  it('builds on the new field stat by default', () => {
    const preset = rivalPresetAt({ T: 1, grade: 'g1', distance: 'medium', strategy: 'pace' })
    expect(preset).toEqual(rivalPresetAt({ T: 1, grade: 'g1', distance: 'medium', strategy: 'pace', fieldStat: rivalFieldStat(1) }))
    expect(rollRivalFieldAt({ T: 1, grade: 'g1', distance: 'medium', count: 9, rng: seeded(5) }))
      .toEqual(rollRivalFieldAt({ T: 1, grade: 'g1', distance: 'medium', count: 9, rng: seeded(5) }))
  })
})
