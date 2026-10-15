import { describe, expect, it } from 'vitest'
import {
  affordableLoadout,
  racingSkillCosts,
  skillChainBelow,
  assertRaceSkillContent,
  compileRaceSkill,
  evaluateRaceCondition,
  levelUniqueSkill,
  parseCompiledRaceSkill,
  parseRaceCondition,
  raceSkillCompatibleWithCourse,
  raceSkillSupported,
  replaceSkillLoadout,
  skillAimsAtOthers,
  selectRivalSkillPool,
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

  it('converts fixed-point effects, records unsupported mechanics, and takes inherited uniques at their own values', () => {
    const compiled = compileRaceSkill(skill('s1'))
    expect(compiled.groups[0]).toMatchObject({ duration: 2, cooldown: 30, unsupportedVariables: [] })
    expect(compiled.groups[0]!.effects).toEqual([{ kind: 'target-speed', amount: 0.35 }])
    expect(raceSkillSupported(compiled)).toBe(true)
    expect(parseCompiledRaceSkill(compiled)).toEqual(compiled)

    const inherited = compileRaceSkill({ ...skill('s2', 'inherited-unique', 200), conditions: [{
      precondition: null,
      condition: 'is_temptation==1',
      baseTime: -1,
      cooldown: null,
      effects: [{ type: 31, value: 4_000 }, { type: 999, value: 1 }],
    }] })
    expect(inherited.groups[0]).toMatchObject({ duration: -1, unsupportedVariables: ['is_temptation'], unsupportedEffects: [999] })
    // The inherited record already carries the weaker values; compiling does not halve them again (D174).
    expect(inherited.groups[0]!.effects).toEqual([{ kind: 'acceleration', amount: 0.4 }])
    expect(inherited.inherited).toBe(true)
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

  it('applies only a runner\'s own effects, and flags skills aimed wholly at others (D141)', () => {
    const selfCost = compileRaceSkill({ ...skill('self-cost'), conditions: [{
      ...skill('self-cost').conditions[0]!, effects: [{ type: 27, value: 5_500 }, { type: 9, value: -400 }],
    }] })
    expect(selfCost.groups[0]!.effects).toEqual([{ kind: 'target-speed', amount: 0.55 }, { kind: 'recovery', amount: -0.04 }])
    const mixed = { ...skill('steal'), conditions: [{
      ...skill('steal').conditions[0]!, effects: [{ type: 9, value: 300 }, { type: 9, value: -300, target: 18 }],
    }] }
    expect(compileRaceSkill(mixed).groups[0]!.effects).toEqual([{ kind: 'recovery', amount: 0.03 }])
    expect(skillAimsAtOthers(mixed)).toBe(false)
    const debuff = { ...skill('debuff'), conditions: [{
      ...skill('debuff').conditions[0]!, effects: [{ type: 21, value: -1_500, target: 18 }],
    }] }
    expect(compileRaceSkill(debuff).groups[0]).toMatchObject({ effects: [], unsupportedEffects: [] })
    expect(raceSkillSupported(compileRaceSkill(debuff))).toBe(false)
    expect(skillAimsAtOthers(debuff)).toBe(true)
    expect(() => assertRaceSkillContent([debuff])).not.toThrow()
  })

  it('compiles engine v5 gate and green skills and course conditions (M018)', () => {
    const green = compileRaceSkill({ ...skill('green'), conditions: [{
      precondition: null, condition: 'rotation==2&track_id==10006', baseTime: 0, cooldown: null, effects: [{ type: 2, value: 400_000 }],
    }] })
    expect(green.groups[0]!.effects).toEqual([{ kind: 'passive-stamina', amount: 40 }])
    expect(raceSkillSupported(green)).toBe(true)
    const gate = compileRaceSkill({ ...skill('gate', 'inherited-unique'), conditions: [{
      precondition: null, condition: 'always==1', baseTime: 0, cooldown: null, effects: [{ type: 10, value: 4_000 }],
    }] })
    expect(gate.groups[0]!.effects).toEqual([{ kind: 'start-delay', amount: 0.4 }])
    for (const condition of ['all_corner_random==1', 'straight_random==1', 'is_last_straight==1', 'accumulatetime>=5', 'up_slope_random==1']) {
      expect(raceSkillSupported(compileRaceSkill({ ...skill('c'), conditions: [{ ...skill('c').conditions[0]!, condition }] })), condition).toBe(true)
    }
    expect(compileRaceSkill({ ...skill('bad'), conditions: [{ ...skill('bad').conditions[0]!, condition: 'corner_random>=1' }] })
      .groups[0]!.unsupportedVariables).toEqual(['corner_random'])
    expect(parseCompiledRaceSkill(green)).toEqual(green)
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

  it('reports aggregate coverage and a rival pool of supported whites without private ids (D163)', () => {
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
    // Sorted by id; the gold and the unsupported skill are left out, and so is a malus.
    const malus = { ...withEffect('slow', 27), conditions: [{ ...withEffect('slow', 27).conditions[0]!, effects: [{ type: 27, value: -1_000 }] }] }
    expect(selectRivalSkillPool([...catalog, malus]).map((entry) => entry.id)).toEqual(['accel', 'recovery', 'speed-a', 'speed-b'])
    expect(() => assertRaceSkillContent([{ ...catalog[0]!, activation: 9 }])).toThrow(/invalid race data/)
  })
})

describe('skill loadouts', () => {
  it('lets an overdrawn loadout shed skills, but never grow its overdraft (D196)', () => {
    const skills = new Map(['a', 'b', 'c'].map((id) => [id, skill(id)]))
    // Three 90 SP skills equipped on 100 SP: 270, over budget, as a D188 repricing or a moved card can leave it.
    const source = {
      skillPoints: 100,
      loadoutSkillIds: ['a', 'b', 'c'],
      library: ['a', 'b', 'c'].map((id) => ({ skillId: id, origin: 'card' as const, sourceId: 'card-1' })),
    }
    expect(replaceSkillLoadout(source, uma, skills, ['a', 'b'])).toEqual(['a', 'b'])
    expect(replaceSkillLoadout(source, uma, skills, ['c', 'b', 'a'])).toEqual(['c', 'b', 'a'])
    expect(replaceSkillLoadout(source, uma, skills, [])).toEqual([])
    expect(() => replaceSkillLoadout({ ...source, loadoutSkillIds: ['a', 'b'] }, uma, skills, ['a', 'b', 'c'])).toThrow(/costs 270 SP/)
    expect(() => replaceSkillLoadout(source, uma, skills, ['a', 'missing'])).toThrow(/not available/)
  })

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
    const unsupported = { ...skill('later'), conditions: [{ ...skill('later').conditions[0]!, condition: 'is_temptation==1' }] }
    const withUnsupported = new Map(skills).set(unsupported.id, unsupported)
    expect(() => replaceSkillLoadout({
      ...source,
      library: [...source.library, { skillId: unsupported.id, origin: 'card' as const, sourceId: 'card-1' }],
    }, uma, withUnsupported, [unsupported.id])).toThrow(/not available yet/)
  })
})

describe('affordableLoadout', () => {
  const entry = (id: string, cost: number, belowIds: string[] = []) =>
    ({ skill: { id } as SkillTemplate, cost, includes: [], belowIds })

  it('keeps equipped skills in order while they fit, and stops at the first that does not', () => {
    const entries = [entry('a', 100), entry('b', 150), entry('c', 50)]
    expect(affordableLoadout(entries, 300).map((skill) => skill.id)).toEqual(['a', 'b', 'c'])
    expect(affordableLoadout(entries, 260).map((skill) => skill.id)).toEqual(['a', 'b'])
    expect(affordableLoadout(entries, 120).map((skill) => skill.id)).toEqual(['a'])
    expect(affordableLoadout(entries, 0)).toEqual([])
  })

  it('races an upgrade instead of its lower skill, and the lower skill alone when the upgrade does not fit (D188)', () => {
    const entries = [entry('white', 140), entry('gold', 140, ['white'])]
    expect(affordableLoadout(entries, 280).map((skill) => skill.id)).toEqual(['gold'])
    expect(affordableLoadout(entries, 200).map((skill) => skill.id)).toEqual(['white'])
  })
})

describe('skill upgrades (D188)', () => {
  // Right-Handed ○ → ◎ → Right-Handed Demon, and a gold on a plain white, as in the original's upper skills.
  const circle = skill('circle', 'white', 90)
  const double = { ...skill('double', 'white', 110), normalSkillId: 'circle' }
  const demon = { ...skill('demon', 'gold', 130), normalSkillId: 'double' }
  const focus = skill('focus', 'white', 140)
  const concentration = { ...skill('concentration', 'gold', 140), normalSkillId: 'focus' }
  const skills = new Map([circle, double, demon, focus, concentration].map((entry) => [entry.id, entry]))
  const source = (loadoutSkillIds: string[] = []) => ({
    skillPoints: 1_000,
    loadoutSkillIds,
    // Only the golds are in her library: equipping one learns its chain anyway.
    library: ['demon', 'concentration', 'focus'].map((skillId) => ({ skillId, origin: 'card' as const, sourceId: 'card-1' })),
  })

  it('walks a chain down from any skill, nearest first', () => {
    expect(skillChainBelow(demon, skills).map((entry) => entry.id)).toEqual(['double', 'circle'])
    expect(skillChainBelow(focus, skills)).toEqual([])
  })

  it('charges a gold its whole chain once, and races only the gold', () => {
    const summary = summarizeSkillLoadout(source(), uma, skills, ['concentration', 'demon'])
    expect(summary.cost).toBe(280 + 330)
    expect(summary.entries.map((entry) => [entry.skill.id, entry.cost, entry.includes.map((lower) => lower.id)])).toEqual([
      ['concentration', 280, ['focus']],
      ['demon', 330, ['double', 'circle']],
    ])
    expect(summary.skills.map((entry) => entry.id)).toEqual(['concentration', 'demon'])
    expect(summary.learnedBy.get('focus')?.id).toBe('concentration')
  })

  it('counts an equipped white once when its gold is equipped too, and races the gold alone', () => {
    const summary = summarizeSkillLoadout(source(), uma, skills, ['focus', 'concentration'])
    expect(summary.entries.map((entry) => entry.cost)).toEqual([140, 140])
    expect(summary.cost).toBe(280)
    expect(summary.skills.map((entry) => entry.id)).toEqual(['concentration'])
    // The racing gold is shown at its whole chain's price, though its white was paid for first.
    expect(racingSkillCosts(summary).get('concentration')).toBe(280)
  })
})

describe('unique skill levels (D158)', () => {
  it('races an Uma\'s own unique at Lv5: speed ×1.10, acceleration and the rest ×1.08, gate effects as they are', () => {
    const unique = {
      id: 'u', activation: 'guaranteed' as const, inherited: false,
      groups: [{
        precondition: null, condition: parseRaceCondition('phase==2')!, duration: 5, cooldown: 0,
        effects: [
          { kind: 'target-speed' as const, amount: 0.35 },
          { kind: 'acceleration' as const, amount: 0.2 },
          { kind: 'recovery' as const, amount: 0.035 },
          { kind: 'passive-speed' as const, amount: 60 },
        ],
        unsupportedVariables: [], unsupportedEffects: [],
      }],
    }
    const amounts = levelUniqueSkill(unique).groups[0]!.effects.map((effect) => effect.amount)
    expect(amounts[0]).toBeCloseTo(0.385)
    expect(amounts[1]).toBeCloseTo(0.216)
    expect(amounts[2]).toBeCloseTo(0.0378)
    expect(amounts[3]).toBe(60)
    expect(unique.groups[0]!.effects[0]!.amount).toBe(0.35)
  })
})
