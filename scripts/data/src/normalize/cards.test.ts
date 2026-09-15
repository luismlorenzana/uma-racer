import { describe, expect, it } from 'vitest'
import { syntheticSupportCards } from '../__fixtures__/synthetic'
import { normalizeCards } from './cards'

describe('normalizeCards', () => {
  it('keeps SSR cards, maps card metadata, and applies starter rules', () => {
    const result = normalizeCards(syntheticSupportCards)
    expect(result.items).toHaveLength(4)
    expect(result.items[0]).toMatchObject({
      id: '9101',
      type: 'speed',
      obtain: 'event',
      starter: true,
      hintSkillIds: ['7201', '7202'],
      eventSkillIds: ['7203'],
      uniqueEffect: { level: 30, effects: [{ type: 8, value: 7 }] },
    })
    expect(result.items[1]).toMatchObject({ obtain: 'gacha', starter: false })
    expect(result.items[2]).toMatchObject({ type: 'wit', obtain: 'free', starter: true })
    expect(result.items[3]).toMatchObject({ obtain: 'unknown', starter: false })
    expect(result.warnings).toEqual([expect.stringContaining('invented_method')])
  })

  it('uses unlocked maxima, medians, clamping, and type-matched stat effects', () => {
    const { items } = normalizeCards(syntheticSupportCards)
    expect(items[0]!.effectProfile).toMatchObject({ friendshipBonus: 0.5, statBonus: 0.5, trainingBonus: 1 })
    expect(items[1]!.effectProfile).toMatchObject({ friendshipBonus: 1, statBonus: 1 })
    expect(items[2]!.effectProfile).toMatchObject({ friendshipBonus: 1.5, statBonus: 1.5, initialStats: 1 })
    expect(items[3]!.effectProfile).toEqual({
      trainingBonus: 0,
      friendshipBonus: 0,
      statBonus: 0,
      skillPointBonus: 0,
      specialtyPriority: 0,
      hintFrequency: 0,
      raceBonus: 0,
      initialStats: 0,
    })
  })
})
