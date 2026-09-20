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
    expect(result.warnings).toEqual([
      expect.stringContaining('invented_method'),
      '2 source effect rows across 2 SSR cards remain inactive',
    ])
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

  it('maps Friend/Group stat families into broad profiles and reports unsupported rows only in aggregate', () => {
    const rows = [
      {
        support_id: 9201, char_id: 921, char_name: 'Synthetic Friend', title_en: 'Broad Practice', rarity: 3,
        type: 'friend', release: '2021-02-24', obtained: 'promo', hints: { hint_skills: [] },
        effects: [[3, 20], [11, 10], [19, 30], [999, 50]],
      },
      {
        support_id: 9202, char_id: 922, char_name: 'Synthetic Group', title_en: 'Shared Practice', rarity: 3,
        type: 'group', release: '2021-02-24', obtained: 'gacha', hints: { hint_skills: [] },
        effects: [[7, 40], [13, 20], [8, 5]],
      },
    ]
    const first = normalizeCards(rows)
    const reversed = normalizeCards([...rows].reverse())
    expect(first.items[0]).toMatchObject({
      type: 'friend',
      effectProfile: { statBonus: 0.67, initialStats: 0.67, specialtyPriority: 1 },
    })
    expect(first.items[1]).toMatchObject({
      type: 'group',
      effectProfile: { statBonus: 1.33, initialStats: 1.33, trainingBonus: 1 },
    })
    expect(first.warnings).toEqual(['1 source effect row across 1 SSR card remains inactive'])
    expect(new Map(reversed.items.map((card) => [card.id, card.effectProfile])))
      .toEqual(new Map(first.items.map((card) => [card.id, card.effectProfile])))
  })
})
