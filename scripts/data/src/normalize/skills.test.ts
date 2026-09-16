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
    })
    expect(result.items.some((skill) => skill.id === '7306')).toBe(false)
  })

  it('uses Global terminology without double-replacing existing terms', () => {
    const unique = normalizeSkills(syntheticSkills).items.find((skill) => skill.id === '7305')!
    expect(unique.description).toBe(
      'Front Runner and Front Runner; Pace Chaser and Pace Chaser; Late Surger; End Closer and End Closer.',
    )
  })
})
