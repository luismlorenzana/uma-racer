import { describe, expect, it } from 'vitest'
import {
  addUmaRaceExp,
  assertProgressionRaceContent,
  bestStrategy,
  createCardSave,
  createUmaSave,
  equippedRaceBonus,
  expToNextUmaLevel,
  parseRaceResultRecord,
  playerRaceStats,
  raceAttemptId,
  raceAttemptSeed,
  resolveRaceExperience,
  type RaceResultRecord,
  type RaceTemplate,
  type SupportCardTemplate,
  type UmaTemplate,
} from './index'

const aptitudes = {
  surface: { turf: 'A', dirt: 'C' },
  distance: { sprint: 'B', mile: 'A', medium: 'A', long: 'C' },
  strategy: { front: 'B', pace: 'A', late: 'A', end: 'C' },
} as const

const uma = (id = 'u1'): UmaTemplate => ({
  id,
  charaId: `chara-${id}`,
  name: `Synthetic ${id}`,
  outfit: null,
  jpRelease: '2000-01-01',
  globalRelease: null,
  starter: true,
  baseStats: { speed: 100, stamina: 110, power: 120, guts: 130, wit: 140 },
  growthRates: { speed: 0, stamina: 0, power: 0, guts: 0, wit: 0 },
  aptitudes,
  uniqueSkillId: null,
  awakeningSkillIds: [],
  realHorseSex: null,
  signatureRaceFamilyIds: [],
  imageSource: 'https://invalid.test/synthetic.png',
})

const card = (): SupportCardTemplate => ({
  id: 'c1',
  charaId: 'card-chara-1',
  charName: 'Synthetic Card',
  title: 'Synthetic Support',
  type: 'speed',
  jpRelease: '2000-01-01',
  era: 1,
  obtain: 'free',
  starter: true,
  hintSkillIds: [],
  eventSkillIds: [],
  effectProfile: {
    trainingBonus: 1,
    friendshipBonus: 1,
    statBonus: 1,
    skillPointBonus: 1,
    specialtyPriority: 1,
    hintFrequency: 1,
    raceBonus: 1,
    initialStats: 1,
  },
  uniqueEffect: null,
  imageSource: 'https://invalid.test/synthetic.png',
})

const race: RaceTemplate = {
  id: 'r1',
  familyId: '101',
  name: 'Synthetic Cup',
  grade: 'g1',
  surface: 'turf',
  distance: 2000,
  distanceCategory: 'medium',
  direction: 'left',
  venue: 'Test Track',
  venueKey: 'test-track',
  venueTags: [],
  series: [],
  seriesLegs: [],
  courseId: 'course-1',
  season: 1,
  fieldSize: 8,
}

function record(): RaceResultRecord {
  return {
    contentVersion: 'abc123def456',
    umaId: 'u1',
    raceId: 'r1',
    sequence: 0,
    seed: 123,
    strategy: 'pace',
    startLevel: 1,
    startExp: 0,
    startStats: { speed: 100, stamina: 100, power: 100, guts: 100, wit: 100 },
    raceBonus: 0.03,
    playerPlacement: 1,
    expGained: 155,
    levelsGained: [2],
    ticketReward: 5,
    shardReward: 0,
    field: Array.from({ length: 8 }, (_, index) => ({
      umaId: index === 0 ? 'u1' : `u${index + 1}`,
      isPlayer: index === 0,
      strategy: 'pace' as const,
      gate: index,
      stats: { speed: 100, stamina: 100, power: 100, guts: 100, wit: 100 },
      aptitude: { distance: 'A' as const, surface: 'A' as const, strategy: 'A' as const },
      placement: index + 1,
      finishTime: 100 + index,
      marginLengths: index === 0 ? 0 : 1,
    })),
    createdAt: 99,
  }
}

describe('progression race content and setup rules', () => {
  it('validates race shape and distance category', () => {
    expect(() => assertProgressionRaceContent([race])).not.toThrow()
    expect(() => assertProgressionRaceContent([{ ...race, distanceCategory: 'sprint' }])).toThrow(/invalid progression-race data/)
    expect(() => assertProgressionRaceContent([race, race])).toThrow(/duplicate id/)
  })

  it('builds stable attempt identities and uses the declared strategy tie break', () => {
    expect(raceAttemptSeed(10, 'abc123def456', 'u1', 'r1', 'pace', 0)).toBe(raceAttemptSeed(10, 'abc123def456', 'u1', 'r1', 'pace', 0))
    expect(raceAttemptSeed(10, 'abc123def456', 'u1', 'r1', 'pace', 1)).not.toBe(raceAttemptSeed(10, 'abc123def456', 'u1', 'r1', 'pace', 0))
    expect(raceAttemptId('u1', 4)).toBe('race:u1:4')
    expect(bestStrategy(uma())).toBe('pace')
  })

  it('uses generated equipped-card Race Bonus and applies player Form once', () => {
    const template = card()
    const bonus = equippedRaceBonus(1, [{ save: { ...createCardSave(template), limitBreak: 1 }, template }])
    expect(bonus).toBeCloseTo(0.033)
    expect(playerRaceStats({ speed: 100, stamina: 200, power: 300, guts: 400, wit: 500 }, 1))
      .toEqual({ speed: 80, stamina: 160, power: 240, guts: 320, wit: 400 })
    expect(equippedRaceBonus(1, [{
      save: { ...createCardSave(template), limitBreak: 1 },
      template: { ...template, type: 'friend' },
    }])).toBeCloseTo(0.033)
  })
})

describe('Uma race progression', () => {
  it('carries remainder through multiple levels and pays five tickets each', () => {
    const save = { ...createUmaSave(uma()), exp: 90 }
    const result = addUmaRaceExp(save, 300)
    expect(result.uma).toMatchObject({ level: 4, exp: 15 })
    expect(result.levelsGained).toEqual([2, 3, 4])
    expect(result.ticketReward).toBe(15)
  })

  it('stops at a gate, grants one shard, and caps banked overflow', () => {
    const save = { ...createUmaSave(uma()), level: 9, exp: expToNextUmaLevel(9) - 10 }
    const result = addUmaRaceExp(save, 1_000)
    expect(result.uma).toMatchObject({ level: 10, exp: expToNextUmaLevel(11) })
    expect(result.levelsGained).toEqual([10])
    expect(result).toMatchObject({ ticketReward: 5, reachedGate: 10, shardReward: 1 })
    const banked = addUmaRaceExp(result.uma, 500)
    expect(banked.uma).toEqual(result.uma)
    expect(banked.levelsGained).toEqual([])
    expect(banked.shardReward).toBe(0)
  })

  it('treats level 110 as an ordinary gate and stops EXP permanently at level 140', () => {
    const at109 = { ...createUmaSave(uma()), level: 109, exp: expToNextUmaLevel(109) - 1 }
    const gate = addUmaRaceExp(at109, 10_000)
    expect(gate).toMatchObject({ uma: { level: 110, exp: expToNextUmaLevel(111) }, reachedGate: 110, shardReward: 1 })
    const at139 = { ...createUmaSave(uma()), level: 139, exp: expToNextUmaLevel(139) - 1 }
    const maximum = addUmaRaceExp(at139, 10_000)
    expect(maximum).toMatchObject({ uma: { level: 140, exp: 0 }, reachedGate: 140, shardReward: 1 })
    expect(addUmaRaceExp({ ...maximum.uma, exp: 99 }, 500).uma).toMatchObject({ level: 140, exp: 0 })
  })

  it('uses grade, placement, and Race Bonus for the awarded EXP', () => {
    const save = createUmaSave(uma())
    expect(resolveRaceExperience(save, 'g1', 1, 0.1).expGained).toBe(165)
    expect(resolveRaceExperience(save, 'g1', 2, 0.1).expGained).toBe(41)
    expect(resolveRaceExperience(save, 'g1', 4, 0.1).expGained).toBe(0)
  })
})

describe('race result parsing', () => {
  it('accepts the exact append-only record and rejects inconsistent rewards/fields', () => {
    const valid = record()
    expect(parseRaceResultRecord(valid)).toEqual(valid)
    const v2 = {
      ...valid,
      engineVersion: 2 as const,
      course: { distance: 2_000, surface: 'turf' as const, season: 1 },
      field: valid.field.map((runner) => ({ ...runner, skills: [] })),
    }
    expect(parseRaceResultRecord(v2)).toEqual(v2)
    const v3 = {
      ...v2,
      engineVersion: 3 as const,
      course: {
        ...v2.course,
        layout: { corners: [{ start: 1_200, end: 1_600, number: 2 }], straights: [{ start: 0, end: 1_200 }, { start: 1_600, end: 2_000 }] },
      },
    }
    expect(parseRaceResultRecord(v3)).toEqual(v3)
    const withGoals = { ...v3, completedGoalIds: ['goal:1:aptitude', 'goal:1:challenge'] }
    expect(parseRaceResultRecord(withGoals)).toEqual(withGoals)
    expect(parseRaceResultRecord({ ...withGoals, completedGoalIds: ['goal:1:aptitude', 'goal:1:aptitude'] })).toBeNull()
    expect(parseRaceResultRecord({ ...v3, course: { ...v3.course, layout: { corners: [], straights: [] } } })).toBeNull()
    expect(parseRaceResultRecord({ ...valid, ticketReward: 10 })).toBeNull()
    expect(parseRaceResultRecord({ ...valid, extra: true })).toBeNull()
    expect(parseRaceResultRecord({ ...valid, field: valid.field.map((runner) => ({ ...runner, isPlayer: false })) })).toBeNull()
  })

  it('accepts strict v1 accomplishment facts while preserving legacy omission', () => {
    const valid = record()
    const accomplishmentFacts = {
      version: 1 as const,
      familyId: 'synthetic-family',
      grade: 'g1' as const,
      venueKey: 'synthetic-venue',
      venueTags: ['jra-main'] as const,
      courseId: 'synthetic-course',
      surface: 'turf' as const,
      distance: 2_000,
      distanceCategory: 'medium' as const,
      series: ['spring-triple-crown', 'triple-crown'] as const,
      playerStartDelay: 0.04,
      playerFinalSpurtPlacement: 3,
      ledEverySectionCheckpoint: true,
      inheritedUniqueActivated: false,
    }
    const current = {
      ...valid,
      engineVersion: 3 as const,
      course: {
        distance: 2_000,
        surface: 'turf' as const,
        season: 1,
        layout: { corners: [{ start: 1_200, end: 1_600, number: 2 }], straights: [{ start: 0, end: 1_200 }, { start: 1_600, end: 2_000 }] },
      },
      field: valid.field.map((runner) => ({ ...runner, skills: [] })),
      accomplishmentFacts,
    }
    expect(parseRaceResultRecord(current)).toEqual(current)
    expect(parseRaceResultRecord({ ...current, accomplishmentFacts: { ...accomplishmentFacts, extra: true } })).toBeNull()
    expect(parseRaceResultRecord({ ...current, accomplishmentFacts: { ...accomplishmentFacts, distanceCategory: 'long' } })).toBeNull()
    expect(parseRaceResultRecord({ ...current, accomplishmentFacts: { ...accomplishmentFacts, ledEverySectionCheckpoint: true }, playerPlacement: 2 })).toBeNull()
    expect(parseRaceResultRecord({ ...current, accomplishmentFacts: { ...accomplishmentFacts, series: ['triple-crown', 'spring-triple-crown'] } })).toBeNull()
  })
})
