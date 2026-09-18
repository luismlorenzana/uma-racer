import { describe, expect, it } from 'vitest'
import { syntheticCharacterCards, syntheticCharacters, syntheticObjectives, syntheticRaces } from '../__fixtures__/synthetic'
import { normalizeObjectiveFamilies } from './objectives'
import { normalizeRaces } from './races'
import { normalizeUmas } from './umas'

describe('normalizeUmas', () => {
  it('maps ordered stats, percent growth, aptitudes, skills, sex, and starter status', () => {
    const result = normalizeUmas(syntheticCharacterCards, syntheticCharacters)
    const first = result.items[0]!
    expect(first.baseStats).toEqual({ speed: 101, stamina: 202, power: 303, guts: 404, wit: 505 })
    expect(first.growthRates).toEqual({ speed: 0.1, stamina: 0.2, power: 0.3, guts: 0.4, wit: 0.5 })
    expect(first.aptitudes).toEqual({
      surface: { turf: 'S', dirt: 'G' },
      distance: { sprint: 'A', mile: 'B', medium: 'C', long: 'D' },
      strategy: { front: 'E', pace: 'F', late: 'G', end: 'S' },
    })
    expect(first).toMatchObject({
      id: '9001',
      charaId: '901',
      outfit: 'Prototype Dash',
      starter: true,
      uniqueSkillId: '7001',
      awakeningSkillIds: ['7003', '7004'],
      realHorseSex: 'male',
    })
    expect(result.items[1]).toMatchObject({ starter: false, realHorseSex: 'female' })
  })

  it('shares ordered, distinct retained objective families across outfits', () => {
    const races = normalizeRaces(syntheticRaces).items
    const objectives = normalizeObjectiveFamilies(syntheticObjectives, syntheticRaces, races)
    const cards = [syntheticCharacterCards[0]!, { ...syntheticCharacterCards[0]!, card_id: 9003 }]
    const result = normalizeUmas(cards, syntheticCharacters, objectives.byCharacterId)
    expect(result.items.map((item) => item.signatureRaceFamilyIds)).toEqual([['8801', '8802'], ['8801', '8802']])
    expect(objectives.counts).toEqual({
      rows: 2,
      malformedRows: 0,
      characters: 2,
      resolvedReferences: 3,
      unresolvedReferences: 2,
    })
  })

  it('reports malformed objective rows only as aggregate diagnostics', () => {
    const races = normalizeRaces(syntheticRaces).items
    const result = normalizeObjectiveFamilies([{ char_id: 901, objectives: 'bad' }], syntheticRaces, races)
    expect(result.byCharacterId.size).toBe(0)
    expect(result.warnings).toEqual(['Objective metadata skipped 1 malformed row(s)'])
  })

  it('skips invalid aptitude grades with a warning', () => {
    const broken = [{ ...syntheticCharacterCards[0], aptitude: ['Z', ...syntheticCharacterCards[0]!.aptitude.slice(1)] }]
    const result = normalizeUmas(broken, syntheticCharacters)
    expect(result.items).toEqual([])
    expect(result.warnings[0]).toContain('9001')
  })
})
