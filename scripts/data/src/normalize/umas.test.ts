import { describe, expect, it } from 'vitest'
import { syntheticCharacterCards, syntheticCharacters } from '../__fixtures__/synthetic'
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

  it('skips invalid aptitude grades with a warning', () => {
    const broken = [{ ...syntheticCharacterCards[0], aptitude: ['Z', ...syntheticCharacterCards[0]!.aptitude.slice(1)] }]
    const result = normalizeUmas(broken, syntheticCharacters)
    expect(result.items).toEqual([])
    expect(result.warnings[0]).toContain('9001')
  })
})
