import { describe, expect, it } from 'vitest'
import { syntheticSkills } from '../__fixtures__/synthetic'
import { normalizeSkills } from './skills'

describe('normalizeSkills', () => {
  it('maps supported kinds, excludes evolutions, and emits localized gene versions', () => {
    const result = normalizeSkills(syntheticSkills)
    expect(result.items.map((skill) => skill.kind)).toEqual([
      'white',
      'gold',
      'unique-upgraded',
      'inherited-unique',
      'unique',
      'inherited-unique',
    ])
    const unique = result.items.find((skill) => skill.id === '7305')!
    expect(result.items.find((skill) => skill.id === '7302')?.normalSkillId).toBe('7301')
    expect(unique.inheritedSkillId).toBe('7391')
    expect(unique.conditions).toEqual([
      {
        precondition: 'localized_pre',
        condition: 'localized_condition',
        baseTime: 2,
        cooldown: 3,
        effects: [{ type: 4, value: 50 }],
      },
    ])
    expect(unique.activation).toBe(1)
    expect(result.items.find((skill) => skill.id === '7391')).toMatchObject({
      kind: 'inherited-unique',
      name: 'Localized Gene',
      description: 'A Front Runner inheritance.',
      inheritedSkillId: null,
      normalSkillId: null,
    })
    expect(result.items.some((skill) => skill.id === '7306')).toBe(false)
  })

  it('keeps the target of an effect aimed at someone else, and leaves self effects bare (D141)', () => {
    const [debuff] = normalizeSkills([{
      id: 7400, rarity: 1, enname: 'Synthetic Debuff', desc_en: 'Slows rivals.', cost: 100, iconid: 1,
      condition_groups: [{ condition: 'phase==1', base_time: 30000, effects: [
        { type: 9, value: -100, target: 18, target_details: 1 },
        { type: 27, value: 1500 },
      ] }],
    }]).items
    expect(debuff!.conditions[0]!.effects).toEqual([{ type: 9, value: -100, target: 18 }, { type: 27, value: 1500 }])
  })

  it('uses Global terminology without double-replacing existing terms', () => {
    const unique = normalizeSkills(syntheticSkills).items.find((skill) => skill.id === '7305')!
    expect(unique.description).toBe(
      'Front Runner and Front Runner; Pace Chaser and Pace Chaser; Late Surger; End Closer and End Closer.',
    )
  })
})
