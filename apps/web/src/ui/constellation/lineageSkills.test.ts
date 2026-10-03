import type { SkillTemplate } from '@racer/domain'
import { describe, expect, it } from 'vitest'
import { naturalGoldSkills, naturalLineageSkills } from './lineageSkills'

const skill = (id: string, kind: SkillTemplate['kind']): SkillTemplate => ({
  id,
  kind,
  name: id,
  description: `${id} description`,
  costSp: 100,
  iconId: null,
  conditions: [],
  inheritedSkillId: null,
  normalSkillId: null,
})

describe('lineage skill presentation', () => {
  it('keeps the natural unique and gold skills, excluding natural whites', () => {
    const skills = new Map([
      ['unique', skill('unique', 'unique')],
      ['white', skill('white', 'white')],
      ['gold-a', skill('gold-a', 'gold')],
      ['gold-b', skill('gold-b', 'gold')],
    ])
    const template = { uniqueSkillId: 'unique', awakeningSkillIds: ['white', 'gold-a', 'gold-b'] }

    expect(naturalLineageSkills(template, skills).map((entry) => entry.id)).toEqual(['unique', 'gold-a', 'gold-b'])
    expect(naturalGoldSkills(template, skills).map((entry) => entry.id)).toEqual(['gold-a', 'gold-b'])
  })

  it('does not duplicate a skill that appears in both source lists', () => {
    const unique = skill('unique', 'unique')
    const skills = new Map([['unique', unique]])
    expect(naturalLineageSkills({ uniqueSkillId: 'unique', awakeningSkillIds: ['unique'] }, skills)).toEqual([unique])
  })
})
