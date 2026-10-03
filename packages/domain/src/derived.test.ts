import { describe, expect, it } from 'vitest'
import type { SkillKind, SkillTemplate, UmaTemplate } from './content'
import { cardGoldSkillIds } from './cards'
import { awakeningSkillsOpen, deriveUma, ownSkillIds } from './derived'
import { lineageInheritedUniques } from './lineage'
import { createUmaSave, type UmaSave } from './save'
import { grandfatherInspiration } from './inspiration'

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

const child = uma('child', 'u-child')
const sky = uma('sky', 'u-sky', ['w-sky'])
const grand = uma('grand', 'u-grand')
const plain = uma('plain', 'u-plain')
const skills = new Map([
  skill('u-child', 'unique', 'i-child'), skill('i-child', 'inherited-unique'),
  skill('u-sky', 'unique', 'i-sky'), skill('i-sky', 'inherited-unique'),
  skill('u-grand', 'unique', 'i-grand'), skill('i-grand', 'inherited-unique'),
  skill('u-plain', 'unique', null),
  skill('w-sky', 'white'),
].map((entry) => [entry.id, entry]))
const umas = new Map([child, sky, grand, plain].map((entry) => [entry.id, entry]))

function withLineage(trainingLevel: number): UmaSave {
  const save = createUmaSave(child)
  return {
    ...save,
    scenarios: save.scenarios.map((run) => ({
      ...run,
      trainingLevel,
      inspiration: grandfatherInspiration(trainingLevel, {}),
      assignments: {
        parent0: { kind: 'lineage', templateId: 'sky' },
        'parent0-gp0': { kind: 'lineage', templateId: 'grand' },
        'parent0-gp1': { kind: 'lineage', templateId: 'plain' },
      },
    })),
  }
}

const derive = (save: UmaSave) => deriveUma({
  uma: save, umaTemplate: child, cardSaves: new Map(), cardTemplates: new Map(), umaTemplates: umas, skillTemplates: skills,
})

describe('inherited uniques from lineage (D174)', () => {
  it('passes every filled slot’s unique in its inherited form, parents and grandparents alike', () => {
    const library = derive(withLineage(9)).library
    expect(library.find((entry) => entry.skillId === 'i-sky')).toEqual({ skillId: 'i-sky', origin: 'inherited', sourceId: 'sky' })
    expect(library.find((entry) => entry.skillId === 'i-grand')).toEqual({ skillId: 'i-grand', origin: 'inherited', sourceId: 'grand' })
    // Her baseline skills still come too; her own unique stays her own, never inherited from herself.
    expect(library.some((entry) => entry.skillId === 'w-sky')).toBe(true)
    expect(library.find((entry) => entry.skillId === 'u-child')?.origin).toBe('own-unique')
    expect(library.some((entry) => entry.skillId === 'i-child')).toBe(false)
  })

  it('passes nothing for a unique with no inherited form, or from a slot that is still locked', () => {
    expect(derive(withLineage(9)).library.some((entry) => entry.skillId.startsWith('u-plain'))).toBe(false)
    expect(derive(withLineage(8)).library.some((entry) => entry.origin === 'inherited')).toBe(false)
  })

  it('keeps an equipped inherited unique in the loadout while its slot holds', () => {
    const save = withLineage(10)
    const equipped: UmaSave = { ...save, scenarios: save.scenarios.map((run) => ({ ...run, loadoutSkillIds: ['i-sky'] })) }
    expect(derive(equipped).loadoutSkillIds).toEqual(['i-sky'])
    const emptied: UmaSave = { ...equipped, scenarios: equipped.scenarios.map((run) => ({ ...run, assignments: {} })) }
    expect(derive(emptied).loadoutSkillIds).toEqual([])
  })

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

  it('puts her innate and story skills in her first scenario’s library, once each, beside her unique', () => {
    const library = deriveUma({
      uma: createUmaSave(own), umaTemplate: own, cardSaves: new Map(), cardTemplates: new Map(), umaTemplates: new Map([[own.id, own]]), skillTemplates: new Map(),
    }).library
    expect(library.map((entry) => entry.skillId)).toEqual(['u-own', 'a-white-1', 'a-gold-1', 'i-1', 'i-2', 'i-3', 'e-1'])
    expect(library.filter((entry) => entry.skillId !== 'u-own').every((entry) => entry.origin === 'awakening' && entry.sourceId === 'own')).toBe(true)
  })

  it('reads a pack from before D186, with no innate or story lists, as her awakening skills alone', () => {
    expect(ownSkillIds(uma('old', 'u-old', ['w', 'g', 'w2', 'g2']), 1)).toEqual(['w', 'g'])
  })
})
