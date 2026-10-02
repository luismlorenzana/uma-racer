import { emptySubject } from './__fixtures__/save'
import { describe, expect, it } from 'vitest'
import { constellationTemplate, createUmaBadgeState, createUmaSave, type RaceAccomplishmentFactsV1, type RaceResultRecord, type UmaTemplate } from '@racer/domain'
import { courseRecordIdsForResult, trainingSnapshot } from './badges'

const template: UmaTemplate = {
  id: 'record-uma', charaId: 'record-character', name: 'Record Runner', outfit: null,
  jpRelease: '2000-01-01', globalRelease: null, starter: false,
  baseStats: { speed: 100, stamina: 100, power: 100, guts: 100, wit: 100 },
  growthRates: { speed: 0, stamina: 0, power: 0, guts: 0, wit: 0 },
  aptitudes: { surface: { turf: 'A', dirt: 'A' }, distance: { sprint: 'A', mile: 'A', medium: 'A', long: 'A' }, strategy: { front: 'A', pace: 'A', late: 'A', end: 'A' } },
  uniqueSkillId: null, awakeningSkillIds: [], realHorseSex: null, signatureRaceFamilyIds: [], imageSource: 'https://invalid.test/record.png',
}
const facts: RaceAccomplishmentFactsV1 = {
  version: 1, familyId: 'record-family', grade: 'op', venueKey: 'record-venue', venueTags: [], courseId: 'record-course',
  surface: 'turf', distance: 2_000, distanceCategory: 'medium', series: [], playerStartDelay: 0.02,
  playerFinalSpurtPlacement: 2, ledEverySectionCheckpoint: false, inheritedUniqueActivated: false,
}
const record = (finishTime: number): RaceResultRecord => ({
  contentVersion: 'synthetic-v1', umaId: template.id, raceId: 'record-race', sequence: 1, seed: 1, strategy: 'front',
  startLevel: 1, startExp: 0, startStats: { ...template.baseStats }, raceBonus: 0, playerPlacement: 1,
  expGained: 0, levelsGained: [], ticketReward: 0, shardReward: 0,
  field: [{ umaId: template.id, isPlayer: true, strategy: 'front', gate: 0, stats: { ...template.baseStats }, aptitude: { distance: 'A', surface: 'A', strategy: 'A' }, placement: 1, finishTime, marginLengths: 0 }],
  createdAt: 10,
})

describe('course record evidence', () => {
  it('requires a strict improvement after a prior player finish', () => {
    const base = createUmaBadgeState(createUmaSave(template), emptySubject(), 1)
    expect(courseRecordIdsForResult(base, facts, record(100))).toBeUndefined()
    const established = { ...base, facts: { ...base.facts, courseBests: [{ courseId: facts.courseId, finishTime: 100, resultId: 'race:record-uma:0', achievedAt: 5 }] } }
    expect(courseRecordIdsForResult(established, facts, record(100))).toBeUndefined()
    expect(courseRecordIdsForResult(established, facts, record(101))).toBeUndefined()
    expect([...courseRecordIdsForResult(established, facts, record(99.999))!]).toEqual(['record-course'])
  })
})

describe('Full House', () => {
  it('counts a tree full when every card node is filled; Extra stats sit beside it (D235)', () => {
    const save = createUmaSave(template)
    const cardNodes = constellationTemplate(1).nodes.filter((node) => node.kind === 'card')
    const full = Object.fromEntries(cardNodes.map((node) => [node.id, { kind: 'card' as const, cardId: `card-${node.id}` }]))
    const tree = (assignments: typeof full) => ({ ...save, scenarios: [{ ...save.scenarios[0]!, assignments }] })
    expect(trainingSnapshot(tree(full), new Map()).fullTreeTiers).toEqual([1])
    const { [cardNodes[0]!.id]: _first, ...missingOne } = full
    expect(trainingSnapshot(tree(missingOne), new Map()).fullTreeTiers).toEqual([])
  })
})
