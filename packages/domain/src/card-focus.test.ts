import { describe, expect, it } from 'vitest'
import { cardFocus, derivedCardFocus, parseCardFocusOverride, skillRestriction, skillRestrictions } from './card-focus'
import type { SkillTemplate } from './content'

const skill = (id: string, condition: string | null, precondition: string | null = null): SkillTemplate => ({
  id, kind: 'white', name: id, description: '', costSp: 100, iconId: null, inheritedSkillId: null, normalSkillId: null,
  conditions: [{ precondition, condition, baseTime: 30_000, cooldown: null, effects: [{ type: 27, value: 1_500 }] }],
})

const LATE = 'running_style==3&phase==2'
const END = 'running_style==4&phase==2'
const LONG = 'distance_type==4&phase==1'
const ANY = 'phase==2'

function card(conditions: readonly (string | null)[]) {
  const skills = conditions.map((condition, index) => skill(`s${index}`, condition))
  return {
    template: { hintSkillIds: skills.map((entry) => entry.id), eventSkillIds: [] as string[] },
    skills: new Map(skills.map((entry) => [entry.id, entry])),
  }
}

describe('card focus (D201)', () => {
  it('restricts a skill only when every branch names the same style or distance', () => {
    expect(skillRestriction(skill('a', LATE), 'running_style')).toBe(3)
    expect(skillRestriction(skill('b', `${LATE}@running_style==3&corner==1`), 'running_style')).toBe(3)
    expect(skillRestriction(skill('c', `${LATE}@corner==1`), 'running_style')).toBeNull()
    // Branches naming different styles restrict the skill to both (D236), but to no single one.
    expect(skillRestriction(skill('d', `${LATE}@${END}`), 'running_style')).toBeNull()
    expect(skillRestrictions(skill('d', `${END}@${LATE}`), 'running_style')).toEqual([3, 4])
    expect(skillRestrictions(skill('c', `${LATE}@corner==1`), 'running_style')).toEqual([])
    expect(skillRestriction(skill('e', 'corner==1', 'running_style==2'), 'running_style')).toBe(2)
    expect(skillRestriction(skill('f', ANY), 'running_style')).toBeNull()
    expect(skillRestriction(skill('g', null), 'distance_type')).toBeNull()
    expect(skillRestriction(skill('h', 'not a condition'), 'running_style')).toBeNull()
  })

  it('tags the style or distance that at least two skills and 30% name, else Generalist', () => {
    const late3of8 = card([LATE, LATE, LATE, ANY, ANY, ANY, ANY, ANY])
    expect(derivedCardFocus(late3of8.template, late3of8.skills).style).toBe('late')
    const late2of10 = card([LATE, LATE, ANY, ANY, ANY, ANY, ANY, ANY, ANY, ANY])
    expect(derivedCardFocus(late2of10.template, late2of10.skills).style).toBe('generalist')
    const lateOnce = card([LATE, ANY, ANY])
    expect(derivedCardFocus(lateOnce.template, lateOnce.skills).style).toBe('generalist')
    const tie = card([LATE, LATE, END, END, ANY])
    expect(derivedCardFocus(tie.template, tie.skills).style).toBe('generalist')
    // A Mile-or-Medium skill counts toward both distances.
    const mileOrMedium = card(['distance_type==2@distance_type==3', 'distance_type==3', ANY, ANY])
    expect(derivedCardFocus(mileOrMedium.template, mileOrMedium.skills).distance).toBe('medium')
    // A style and a distance on the same card are read independently.
    const both = card([LATE, LATE, LONG, LONG, ANY])
    expect(derivedCardFocus(both.template, both.skills)).toEqual({ style: 'late', distance: 'long' })
  })

  it('counts each distinct hint and event skill once, ignoring ids the pack lacks', () => {
    const base = card([LATE, LATE, ANY])
    const template = { hintSkillIds: ['s0', 's1', 's2', 'missing'], eventSkillIds: ['s0'] }
    expect(derivedCardFocus(template, base.skills).style).toBe('late')
  })

  it('lets an override replace only the dimension it names', () => {
    const both = card([LATE, LATE, LONG, LONG, ANY])
    expect(cardFocus({ ...both.template, focus: { distance: 'medium' } }, both.skills)).toEqual({ style: 'late', distance: 'medium' })
    expect(cardFocus({ ...both.template, focus: { style: 'generalist' } }, both.skills)).toEqual({ style: 'generalist', distance: 'long' })
  })

  it('validates override entries: a known value for a dimension, and a note', () => {
    expect(parseCardFocusOverride({ style: 'late', note: 'Signature gold is Late-only' })).toEqual({ style: 'late', note: 'Signature gold is Late-only' })
    expect(parseCardFocusOverride({ distance: 'generalist', note: 'Mixed' })).toEqual({ distance: 'generalist', note: 'Mixed' })
    expect(parseCardFocusOverride({ style: 'late' })).toBeNull()
    expect(parseCardFocusOverride({ style: 'sideways', note: 'x' })).toBeNull()
    expect(parseCardFocusOverride({ note: 'nothing to set' })).toBeNull()
    expect(parseCardFocusOverride({ style: 'late', note: 'x', extra: 1 })).toBeNull()
  })
})
