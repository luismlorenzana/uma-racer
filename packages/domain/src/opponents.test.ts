import { describe, expect, it } from 'vitest'
import {
  CAP_PROFILES,
  DISTANCE_CATEGORIES,
  RACE_GRADES,
  RIVAL_SKILL_RANGE,
  RIVAL_STAMINA_ROLL,
  RIVAL_STAT_FLOOR,
  SPREAD_STATS,
  STATS,
  STRATEGIES,
  STYLE_PROFILE,
  capProfile,
  castRivals,
  fullSpurtStamina,
  rivalPreset,
  parseRaceCondition,
  rollRivalField,
  rollRivalSkills,
  rollRivalStats,
  rollStyleCounts,
  fieldTrainedStat,
  trainedStat,
  type Aptitudes,
  type CompiledRaceSkill,
  type Stats,
  type Strategy,
  type UmaTemplate,
} from './index'

// A small seeded generator (mulberry32), so the tests exercise the rolls the way a race's RNG does.
const rng = (seed: number) => {
  let state = seed >>> 0
  return {
    next() {
      state = (state + 0x6d2b79f5) >>> 0
      let t = Math.imul(state ^ (state >>> 15), state | 1)
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    },
  }
}
const mean = (stats: Stats) => STATS.reduce((sum, stat) => sum + stats[stat], 0) / STATS.length

describe('rival presets (D153, D159)', () => {
  it('average the handicapped trained Uma where no cap bites', () => {
    // Tier 1's caps are even, so the scenario leans nowhere: its field's 709.0 (D191) × (1 − 0.05) on average for a G1.
    for (const strategy of STRATEGIES) expect(mean(rivalPreset(1, 'g1', 'medium', strategy, 2000))).toBeCloseTo(673.588)
    expect(mean(rivalPreset(1, 'g3', 'sprint', 'end'))).toBeCloseTo(fieldTrainedStat(1) * 0.75)
    expect(fieldTrainedStat(1)).toBeLessThan(trainedStat(1))
  })

  it('carry the Stamina a full spurt at the race distance needs, from a 90% roll up', () => {
    for (const strategy of STRATEGIES) {
      for (const meters of [1200, 1600, 2000, 2400]) {
        const preset = rivalPreset(1, 'g1', 'medium', strategy, meters)
        expect(preset.stamina * RIVAL_STAMINA_ROLL).toBeCloseTo(fullSpurtStamina(meters, strategy, preset.speed, preset.guts), 0)
      }
    }
    const stamina = (meters: number) => rivalPreset(1, 'g1', 'medium', 'pace', meters).stamina
    expect(stamina(2400)).toBeGreaterThan(stamina(2000) + 250)
    // A marathon cannot take more than 40% of the build.
    const marathon = rivalPreset(1, 'g1', 'long', 'pace', 3600)
    expect(marathon.stamina).toBeCloseTo(0.4 * 5 * mean(marathon))
  })

  it('shape each running style after what it needs', () => {
    const front = rivalPreset(1, 'g1', 'mile', 'front')
    const end = rivalPreset(1, 'g1', 'mile', 'end')
    expect(end.power).toBeGreaterThan(front.power)
    expect(front.wit).toBeGreaterThan(end.wit)
    const spreadMean = (row: Record<string, number>) => Object.values(row).reduce((sum, weight) => sum + weight, 0) / SPREAD_STATS.length
    for (const row of Object.values(STYLE_PROFILE)) expect(spreadMean(row)).toBeCloseTo(1)
  })

  it('lean the way the scenario caps lean, and never pass a cap', () => {
    // Trackblazer (tier 3) caps Speed at 1,200; Grand Masters (tier 5) caps Wit at 1,800.
    const share = (tier: number, stat: 'speed' | 'wit') => rivalPreset(tier, 'g1', 'medium', 'pace', 2000)[stat] / mean(rivalPreset(tier, 'g1', 'medium', 'pace', 2000))
    expect(share(3, 'speed')).toBeLessThan(share(1, 'speed'))
    expect(share(5, 'wit')).toBeGreaterThan(share(1, 'wit'))
    for (let tier = 1; tier <= CAP_PROFILES.length; tier += 1) {
      for (const grade of RACE_GRADES) for (const distance of DISTANCE_CATEGORIES) for (const strategy of STRATEGIES) {
        const preset = rivalPreset(tier, grade, distance, strategy)
        for (const stat of STATS) expect(preset[stat]).toBeLessThanOrEqual(capProfile(tier)[stat])
      }
    }
  })
})

describe('rival skills (D163)', () => {
  const white = (id: string, condition: string): CompiledRaceSkill => ({
    id, activation: 'wit', inherited: false,
    groups: [{ precondition: null, condition: parseRaceCondition(condition)!, duration: 3, cooldown: 0, effects: [{ kind: 'target-speed', amount: 0.15 }], unsupportedVariables: [], unsupportedEffects: [] }],
  })
  const pool = [
    ...Array.from({ length: 10 }, (_, index) => white(`any-${index}`, 'phase_random==2')),
    white('front-only', 'running_style==1'),
    white('long-only', 'distance_type==4'),
  ]
  const course = { distance: 2000, surface: 'turf' as const }

  it('rolls three to seven whites without repeats, five on average', () => {
    let total = 0
    for (let seed = 1; seed <= 400; seed += 1) {
      const kit = rollRivalSkills(pool, { strategy: 'pace', course, rng: rng(seed) })
      expect(kit.length).toBeGreaterThanOrEqual(RIVAL_SKILL_RANGE.min)
      expect(kit.length).toBeLessThanOrEqual(RIVAL_SKILL_RANGE.max)
      expect(new Set(kit.map((skill) => skill.id)).size).toBe(kit.length)
      total += kit.length
    }
    expect(total / 400).toBeCloseTo(5, 0)
  })

  it('draws only skills that can fire for her style on this course', () => {
    for (let seed = 1; seed <= 200; seed += 1) {
      const ids = rollRivalSkills(pool, { strategy: 'pace', course, rng: rng(seed) }).map((skill) => skill.id)
      expect(ids).not.toContain('front-only')
      expect(ids).not.toContain('long-only')
    }
    const fronts = Array.from({ length: 200 }, (_, seed) => rollRivalSkills(pool, { strategy: 'front', course, rng: rng(seed + 1) }))
    expect(fronts.some((kit) => kit.some((skill) => skill.id === 'front-only'))).toBe(true)
  })
})

describe('rival rolls (D153)', () => {
  it('rolls every stat between 80% and 100% of the preset', () => {
    const preset = rivalPreset(7, 'g2', 'long', 'late')
    let lowest = 1
    let highest = 0
    for (let seed = 1; seed <= 300; seed += 1) {
      const rolled = rollRivalStats(preset, rng(seed))
      for (const stat of STATS) {
        const share = rolled[stat] / preset[stat]
        expect(share).toBeGreaterThanOrEqual(RIVAL_STAT_FLOOR - 0.001)
        expect(share).toBeLessThanOrEqual(1.001)
        lowest = Math.min(lowest, share)
        highest = Math.max(highest, share)
      }
    }
    expect(lowest).toBeLessThan(0.81)
    expect(highest).toBeGreaterThan(0.99)
  })

  it('splits the field into two to five of each style, and fits small fields', () => {
    const seen = new Set<string>()
    for (let rivals = 7; rivals <= 17; rivals += 1) {
      for (let seed = 1; seed <= 200; seed += 1) {
        const counts = rollStyleCounts(rivals, rng(seed * 97 + rivals))
        const values = STRATEGIES.map((strategy) => counts[strategy])
        expect(values.reduce((sum, count) => sum + count, 0)).toBe(rivals)
        for (const count of values) {
          expect(count).toBeGreaterThanOrEqual(rivals >= 8 ? 2 : 1)
          expect(count).toBeLessThanOrEqual(5)
        }
        if (rivals === 11) seen.add(values.join('-'))
      }
    }
    // Eleven rivals split 20 ways, two to five of each, and every one of them turns up.
    expect(seen.size).toBe(20)
    expect(seen.has('2-2-2-5')).toBe(true)
  })

  it('rolls a whole field deterministically from the race seed', () => {
    const field = (seed: number) => rollRivalField({ tier: 1, grade: 'g1', distance: 'medium', count: 11, rng: rng(seed) })
    expect(field(42)).toEqual(field(42))
    expect(field(42)).not.toEqual(field(43))
    expect(field(42)).toHaveLength(11)
    // No two rivals share a build, and the field is not all one style.
    expect(new Set(field(42).map((slot) => JSON.stringify(slot.stats))).size).toBe(11)
    expect(new Set(field(42).map((slot) => slot.strategy)).size).toBe(4)
  })
})

describe('casting rivals (D153)', () => {
  const aptitudes = (best: Strategy): Aptitudes => ({
    surface: { turf: 'A', dirt: 'G' },
    distance: { sprint: 'A', mile: 'A', medium: 'A', long: 'A' },
    strategy: { front: 'D', pace: 'D', late: 'D', end: 'D', [best]: 'A' },
  })
  const uma = (id: string, best: Strategy) => ({ id, aptitudes: aptitudes(best) }) as UmaTemplate

  it('gives each slot the first Uma suited to its style', () => {
    const pool = [uma('p1', 'pace'), uma('p2', 'pace'), uma('e1', 'end'), uma('f1', 'front'), uma('l1', 'late')]
    const cast = castRivals(pool, [{ strategy: 'pace' }, { strategy: 'front' }, { strategy: 'end' }, { strategy: 'late' }])
    expect(cast.map((template) => template.id)).toEqual(['p1', 'f1', 'e1', 'l1'])
  })

  it('falls back to anyone free when no one suits a style, and never casts an Uma twice', () => {
    const pool = [uma('p1', 'pace'), uma('p2', 'pace'), uma('p3', 'pace')]
    const cast = castRivals(pool, [{ strategy: 'front' }, { strategy: 'front' }, { strategy: 'pace' }])
    expect(new Set(cast.map((template) => template.id)).size).toBe(3)
    expect(() => castRivals(pool.slice(0, 2), [{ strategy: 'front' }, { strategy: 'pace' }, { strategy: 'end' }])).toThrow()
  })
})
