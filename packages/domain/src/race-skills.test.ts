import { describe, expect, it } from 'vitest'
import {
  assertRaceSkillContent,
  compileRaceSkill,
  createUmaSave,
  evaluateRaceCondition,
  parseCompiledRaceSkill,
  parseRaceCondition,
  raceSkillCompatibleWithCourse,
  raceSkillSupported,
  replaceSkillLoadout,
  selectBaselineRaceSkills,
  summarizeSkillLoadout,
  summarizeRaceSkillCoverage,
  type SkillTemplate,
  type UmaTemplate,
} from './index'

const aptitudes = {
  surface: { turf: 'A', dirt: 'C' },
  distance: { sprint: 'B', mile: 'A', medium: 'A', long: 'C' },
  strategy: { front: 'B', pace: 'A', late: 'A', end: 'C' },
} as const

const uma: UmaTemplate = {
  id: 'u1',
  charaId: 'chara-u1',
  name: 'Synthetic Runner',
  outfit: null,
  jpRelease: '2000-01-01',
  globalRelease: null,
  starter: true,
  baseStats: { speed: 100, stamina: 100, power: 100, guts: 100, wit: 100 },
  growthRates: { speed: 0, stamina: 0, power: 0, guts: 0, wit: 0 },
  aptitudes,
  uniqueSkillId: 'unique-1',
  awakeningSkillIds: [],
  realHorseSex: null,
  signatureRaceFamilyIds: [],
  imageSource: 'https://invalid.test/synthetic.png',
}

function skill(id: string, kind: SkillTemplate['kind'] = 'white', costSp: number | null = 90): SkillTemplate {
  return {
    id,
    kind,
    name: `Synthetic ${id}`,
    description: 'Synthetic fixture.',
    costSp,
    iconId: null,
    activation: 0,
    inheritedSkillId: null,
    normalSkillId: null,
    conditions: [{
      precondition: 'phase>=1',
      condition: 'distance_rate>=50&order_rate<=50@remain_distance<=200',
      baseTime: 20_000,
      cooldown: 300_000,
      effects: [{ type: 27, value: 3_500 }],
    }],
  }
}

describe('race skill compiler', () => {
  it('parses the bounded OR/AND comparison grammar and evaluates missing variables as false', () => {
    const condition = parseRaceCondition('distance_rate>=50&order<=3@remain_distance<200')!
    expect(condition).toHaveLength(2)
    expect(evaluateRaceCondition(condition, { distance_rate: 60, order: 2 })).toBe(true)
    expect(evaluateRaceCondition(condition, { remain_distance: 150 })).toBe(true)
    expect(evaluateRaceCondition(condition, { distance_rate: 60 })).toBe(false)
    expect(() => parseRaceCondition('distance_rate+50')).toThrow(/Unsupported/)
  })

  it('converts fixed-point effects, records unsupported mechanics, and halves inherited uniques', () => {
    const compiled = compileRaceSkill(skill('s1'))
    expect(compiled.groups[0]).toMatchObject({ duration: 2, cooldown: 30, unsupportedVariables: [] })
    expect(compiled.groups[0]!.effects).toEqual([{ kind: 'target-speed', amount: 0.35 }])
    expect(raceSkillSupported(compiled)).toBe(true)
    expect(parseCompiledRaceSkill(compiled)).toEqual(compiled)

    const inherited = compileRaceSkill({ ...skill('s2', 'inherited-unique', 200), conditions: [{
      precondition: null,
      condition: 'slope==1',
      baseTime: -1,
      cooldown: null,
      effects: [{ type: 31, value: 4_000 }, { type: 999, value: 1 }],
    }] })
    expect(inherited.groups[0]).toMatchObject({ duration: -1, unsupportedVariables: ['slope'], unsupportedEffects: [999] })
    expect(inherited.groups[0]!.effects).toEqual([{ kind: 'acceleration', amount: 0.2 }])
    expect(raceSkillSupported(inherited)).toBe(false)
    const sprintOnly = compileRaceSkill({
      ...skill('sprint-only'),
      conditions: [{ ...skill('sprint-only').conditions[0]!, condition: 'distance_type==1' }],
    })
    expect(raceSkillCompatibleWithCourse(sprintOnly, { distance: 1_200, surface: 'turf' })).toBe(true)
    expect(raceSkillCompatibleWithCourse(sprintOnly, { distance: 3_200, surface: 'turf' })).toBe(false)
    const naturalSpeed = compileRaceSkill({
      ...skill('natural-speed'),
      conditions: [{ ...skill('natural-speed').conditions[0]!, effects: [{ type: 22, value: 2_500 }] }],
    })
    expect(naturalSpeed.groups[0]!.effects).toEqual([{ kind: 'current-speed-natural', amount: 0.25 }])
    expect(raceSkillSupported(naturalSpeed)).toBe(true)
  })

  it('supports bounded random phase points and rejects malformed variants', () => {
    expect(raceSkillSupported(compileRaceSkill({
      ...skill('random'),
      conditions: [{ ...skill('random').conditions[0]!, condition: 'phase_laterhalf_random==1' }],
    }))).toBe(true)
    expect(compileRaceSkill({
      ...skill('bad-random'),
      conditions: [{ ...skill('bad-random').conditions[0]!, condition: 'phase_random>=1' }],
    }).groups[0]!.unsupportedVariables).toEqual(['phase_random'])
  })

  it('reports aggregate coverage and derives a fixed four-white NPC kit without private ids', () => {
    const withEffect = (id: string, type: number): SkillTemplate => ({
      ...skill(id),
      conditions: [{
        ...skill(id).conditions[0]!,
        precondition: null,
        condition: id === 'speed-a' ? 'phase_random==1' : id === 'speed-b' ? 'phase_random==2' : 'distance_rate>=10',
        effects: [{ type, value: 1_000 }],
      }],
    })
    const catalog = [
      withEffect('recovery', 9),
      withEffect('speed-a', 27),
      withEffect('speed-b', 27),
      withEffect('accel', 31),
      { ...withEffect('unsupported', 999), kind: 'gold' as const },
    ]
    const coverage = summarizeRaceSkillCoverage(catalog)
    expect(() => assertRaceSkillContent(catalog)).not.toThrow()
    expect(coverage).toMatchObject({
      total: 5,
      supported: 4,
      unsupported: 1,
      byKind: { white: { total: 4, supported: 4 }, gold: { total: 1, supported: 0 } },
      unsupportedEffects: { '999': 1 },
    })
    expect(selectBaselineRaceSkills(catalog).map((entry) => entry.id)).toEqual([
      'recovery', 'speed-a', 'speed-b', 'accel',
    ])
    expect(() => assertRaceSkillContent([{ ...catalog[0]!, activation: 9 }])).toThrow(/invalid race data/)
  })
})

describe('skill loadouts', () => {
  it('keeps the own unique implicit and enforces library membership and SP capacity', () => {
    const paid = skill('paid-1')
    const skills = new Map([['unique-1', skill('unique-1', 'unique', null)], ['paid-1', paid]])
    const source = {
      skillPoints: 100,
      loadoutSkillIds: [] as string[],
      library: [
        { skillId: 'unique-1', origin: 'own-unique' as const, sourceId: 'u1' },
        { skillId: 'paid-1', origin: 'card' as const, sourceId: 'card-1' },
      ],
    }
    expect(summarizeSkillLoadout(source, uma, skills, ['paid-1'])).toMatchObject({ valid: true, cost: 90, cap: 100 })
    expect(replaceSkillLoadout(source, uma, skills, ['paid-1'])).toEqual(['paid-1'])
    expect(() => replaceSkillLoadout({ ...source, skillPoints: 80 }, uma, skills, ['paid-1'])).toThrow(/costs 90 SP/)
    expect(() => replaceSkillLoadout(source, uma, skills, ['unique-1'])).toThrow(/automatically/)
    expect(() => replaceSkillLoadout(source, uma, skills, ['missing'])).toThrow(/not available/)
    const unsupported = { ...skill('later'), conditions: [{ ...skill('later').conditions[0]!, condition: 'slope==1' }] }
    const withUnsupported = new Map(skills).set(unsupported.id, unsupported)
    expect(() => replaceSkillLoadout({
      ...source,
      library: [...source.library, { skillId: unsupported.id, origin: 'card' as const, sourceId: 'card-1' }],
    }, uma, withUnsupported, [unsupported.id])).toThrow(/not available yet/)
  })
})
