import type { SkillTemplate, SupportCardTemplate } from '@racer/domain'
import { describe, expect, it } from 'vitest'
import { applyCardFocusOverride, cardFocusReport } from './card-focus'

const skill = (id: string, condition: string): SkillTemplate => ({
  id, kind: 'white', name: `Synthetic ${id}`, description: '', costSp: 100, iconId: null, inheritedSkillId: null, normalSkillId: null,
  conditions: [{ precondition: null, condition, baseTime: 30_000, cooldown: null, effects: [{ type: 27, value: 1_500 }] }],
})
const skills = [skill('late-1', 'running_style==3'), skill('late-2', 'running_style==3&phase==2'), skill('any', 'phase==2')]

const card = (id: string): SupportCardTemplate => ({
  id, charaId: `chara-${id}`, charName: `Synthetic ${id}`, title: 'Synthetic', type: 'speed', jpRelease: '2021-02-24', era: 1,
  obtain: 'gacha', starter: false, hintSkillIds: ['late-1', 'late-2', 'any'], eventSkillIds: [],
  effectProfile: {} as SupportCardTemplate['effectProfile'], uniqueEffect: null, imageSource: 'https://invalid.test/card.png',
})

describe('card focus override', () => {
  it('writes an override onto its card only, and counts the final focus', () => {
    const result = applyCardFocusOverride([card('a'), card('b')], skills, {
      b: { distance: 'long', note: 'Synthetic: a signature Long gold' },
    })
    expect(result.items[0]!.focus).toBeUndefined()
    expect(result.items[1]!.focus).toEqual({ distance: 'long' })
    expect(result.coverage).toEqual({ style: { late: 2 }, distance: { generalist: 1, long: 1 }, both: 1, neither: 0, overridden: 1 })
  })

  it('refuses an unknown card, an unknown value, and an entry without a note', () => {
    expect(() => applyCardFocusOverride([card('a')], skills, { z: { style: 'late', note: 'x' } })).toThrow(/unknown card/)
    expect(() => applyCardFocusOverride([card('a')], skills, { a: { style: 'sideways', note: 'x' } })).toThrow(/known style/)
    expect(() => applyCardFocusOverride([card('a')], skills, { a: { style: 'late' } })).toThrow(/note/)
  })

  it('works without an override, and reports each skill restriction privately', () => {
    const result = applyCardFocusOverride([card('a')], skills, null)
    expect(result.warnings).toHaveLength(1)
    expect(cardFocusReport(result.items, skills)).toContain('Synthetic late-1 [Late]')
  })
})
