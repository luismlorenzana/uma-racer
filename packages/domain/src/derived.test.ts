import { describe, expect, it } from 'vitest'
import type { SkillKind, SkillTemplate, UmaTemplate } from './content'
import { cardGoldSkillIds } from './cards'
import { awakeningSkillsOpen, ownSkillIds } from './derived'
import { lineageInheritedUniques } from './lineage'

// Lineage passes each slot's unique in its inherited form (D174), beside its baseline skills.

const uma = (id: string, uniqueSkillId: string | null, awakening: string[] = []): UmaTemplate => ({
  id,
  charaId: `chara-${id}`,
  name: `Runner ${id}`,
  outfit: null,
  jpRelease: '2021-01-01',
  globalRelease: null,
  starter: true,
  baseStats: { speed: 100, stamina: 100, power: 100, guts: 100, wit: 100 },
  growthRates: { speed: 0, stamina: 0, power: 0, guts: 0, wit: 0 },
  aptitudes: {
    surface: { turf: 'A', dirt: 'G' },
    distance: { sprint: 'C', mile: 'A', medium: 'A', long: 'B' },
    strategy: { front: 'A', pace: 'B', late: 'C', end: 'D' },
  },
  uniqueSkillId,
  awakeningSkillIds: awakening,
  realHorseSex: null,
  signatureRaceFamilyIds: [],
  imageSource: 'https://invalid.test/uma.png',
})

const skill = (id: string, kind: SkillKind, inheritedSkillId: string | null = null): SkillTemplate => ({
  id, kind, name: id, description: '', costSp: kind === 'unique' ? null : 200, iconId: null,
  conditions: [{ precondition: null, condition: 'phase>=2', baseTime: 24000, cooldown: null, effects: [{ type: 31, value: 2000 }] }],
  inheritedSkillId, normalSkillId: null,
})

const sky = uma('sky', 'u-sky', ['w-sky'])
const grand = uma('grand', 'u-grand')
const skills = new Map([
  skill('u-sky', 'unique', 'i-sky'), skill('i-sky', 'inherited-unique'),
  skill('u-grand', 'unique', 'i-grand'), skill('i-grand', 'inherited-unique'),
  skill('w-sky', 'white'),
].map((entry) => [entry.id, entry]))

describe('inherited uniques from lineage (D174)', () => {
  it('deduplicates by skill', () => {
    expect(lineageInheritedUniques([sky, sky, grand], skills)).toEqual([
      { skillId: 'i-sky', sourceId: 'sky' },
      { skillId: 'i-grand', sourceId: 'grand' },
    ])
  })
})

describe('card golds (D182)', () => {
  it('reads a card’s golds from its event skills, in their order, never its hints', () => {
    const kinds = new Map([['e-gold', { kind: 'gold' as const }], ['e-white', { kind: 'white' as const }], ['e-gold-2', { kind: 'gold' as const }]])
    expect(cardGoldSkillIds({ eventSkillIds: ['e-white', 'e-gold', 'missing', 'e-gold-2'] }, kinds)).toEqual(['e-gold', 'e-gold-2'])
  })
})

describe('her own skills (D186)', () => {
  const own: UmaTemplate = {
    ...uma('own', 'u-own', ['a-white-1', 'a-gold-1', 'a-white-2', 'a-gold-2']),
    innateSkillIds: ['i-1', 'i-2', 'i-3'],
    eventSkillIds: ['e-1', 'a-white-1'],
  }

  it('opens her awakening skills a pair at a time: a white and a gold in her first scenario, all four from her second', () => {
    expect([1, 2, 3, 14].map(awakeningSkillsOpen)).toEqual([2, 4, 4, 4])
    expect(ownSkillIds(own, 1)).toEqual(['a-white-1', 'a-gold-1', 'i-1', 'i-2', 'i-3', 'e-1', 'a-white-1'])
    expect(ownSkillIds(own, 2).slice(0, 4)).toEqual(['a-white-1', 'a-gold-1', 'a-white-2', 'a-gold-2'])
  })

  it('reads a pack from before D186, with no innate or story lists, as her awakening skills alone', () => {
    expect(ownSkillIds(uma('old', 'u-old', ['w', 'g', 'w2', 'g2']), 1)).toEqual(['w', 'g'])
  })
})
