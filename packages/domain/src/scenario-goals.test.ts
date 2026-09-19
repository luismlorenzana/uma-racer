import { describe, expect, it } from 'vitest'
import type { RaceTemplate, UmaTemplate } from './content'
import type { RaceResultRecord, RaceResultRunner } from './progression-race'
import {
  bootstrapScenarioGoals,
  CHALLENGE_MARGIN_LENGTHS,
  closeScenarioJourney,
  evaluateScenarioGoals,
  generateScenarioJourney,
  scenarioGoalAptitudeScore,
  scenarioGoalGradeFallback,
  scenarioGoalRequestedGrade,
  scenarioJourneySummary,
  stableHash,
} from './scenario-goals'
import { createUmaSave, parseUmaSave, type ParentSnapshot, type UmaSave } from './save'

const template: UmaTemplate = {
  id: 'uma-goal', charaId: '901', name: 'Synthetic Goal Runner', outfit: null,
  jpRelease: '2000-01-01', globalRelease: null, starter: true,
  baseStats: { speed: 100, stamina: 100, power: 100, guts: 100, wit: 100 },
  growthRates: { speed: 0, stamina: 0, power: 0, guts: 0, wit: 0 },
  aptitudes: {
    surface: { turf: 'A', dirt: 'D' },
    distance: { sprint: 'B', mile: 'A', medium: 'B', long: 'E' },
    strategy: { front: 'B', pace: 'A', late: 'C', end: 'D' },
  },
  uniqueSkillId: null, awakeningSkillIds: [], realHorseSex: null,
  signatureRaceFamilyIds: ['202'], imageSource: 'https://invalid.test/synthetic.png',
}

function race(id: string, familyId: string, grade: RaceTemplate['grade'], distance: number, surface: RaceTemplate['surface'] = 'turf'): RaceTemplate {
  const distanceCategory = distance <= 1400 ? 'sprint' : distance <= 1800 ? 'mile' : distance <= 2400 ? 'medium' : 'long'
  return {
    id, familyId, name: `Synthetic ${id}`, grade, surface, distance, distanceCategory,
    direction: 'left', venue: 'Synthetic', venueKey: 'synthetic-venue', venueTags: [], series: [], seriesLegs: [],
    courseId: `course-${id}`, season: 1, fieldSize: 8,
  }
}

const races = [
  race('pre-a', '101', 'pre-op', 1600),
  race('op-identity', '202', 'op', 1800),
  race('op-other', '203', 'op', 2000),
  race('g3-a', '301', 'g3', 1600),
  race('g3-b', '302', 'g3', 2000),
  race('g3-c', '303', 'g3', 1400),
  race('g2-a', '401', 'g2', 1600),
  race('g1-a', '501', 'g1', 2600),
]

function started(level = 1): UmaSave {
  return { ...createUmaSave(template), goalPlanVersion: 0, scenarioStarted: true, level }
}

function runners(playerPlacement: number, secondMargin = 5, playerId = template.id): RaceResultRunner[] {
  return Array.from({ length: 8 }, (_, index) => {
    const placement = index + 1
    const player = placement === playerPlacement
    return {
      umaId: player ? playerId : `rival-${index}`,
      isPlayer: player,
      strategy: 'pace', gate: index,
      stats: { speed: 100, stamina: 100, power: 100, guts: 100, wit: 100 },
      aptitude: { distance: 'A', surface: 'A', strategy: 'A' },
      placement, finishTime: 100 + index, marginLengths: placement === 2 ? secondMargin : placement === 1 ? 0 : 1,
    }
  })
}

function result(raceId: string, options: { umaId?: string; startLevel?: number; margin?: number; placement?: number; sequence?: number } = {}): RaceResultRecord {
  const placement = options.placement ?? 1
  return {
    contentVersion: 'synthetic-v1', umaId: options.umaId ?? template.id, raceId,
    sequence: options.sequence ?? 0, seed: 1, strategy: 'pace', startLevel: options.startLevel ?? 1, startExp: 0,
    startStats: { speed: 100, stamina: 100, power: 100, guts: 100, wit: 100 }, raceBonus: 0,
    playerPlacement: placement, expGained: 0, levelsGained: [], ticketReward: 0, shardReward: 0,
    completedGoalIds: [], field: runners(placement, options.margin, options.umaId), createdAt: 50 + (options.sequence ?? 0),
  }
}

describe('scenario goal generation', () => {
  it('pins grade escalation, nearest fallback, aptitude scoring, and stable hashing', () => {
    expect(['aptitude', 'identity', 'challenge'].map((slot) => scenarioGoalRequestedGrade(1, slot as 'aptitude' | 'identity' | 'challenge')))
      .toEqual(['pre-op', 'op', 'op'])
    expect([1, 2, 3, 4, 11].map((tier) => scenarioGoalRequestedGrade(tier, 'aptitude')))
      .toEqual(['pre-op', 'g3', 'g2', 'g1', 'g1'])
    expect(scenarioGoalGradeFallback('g2')).toEqual(['g2', 'g3', 'op', 'pre-op', 'maiden', 'debut', 'g1'])
    expect(scenarioGoalAptitudeScore(started(), race('best', '999', 'op', 1600))).toBe(2)
    expect(stableHash('same')).toBe(stableHash('same'))
  })

  it('selects three distinct frozen targets, prefers an eligible identity family, and ignores input order', () => {
    const first = generateScenarioJourney({ uma: started(), umaTemplate: template, races })
    const reordered = generateScenarioJourney({ uma: started(), umaTemplate: template, races: [...races].reverse() })
    expect(reordered).toEqual(first)
    expect(first.goals).toHaveLength(3)
    expect(new Set(first.goals.map((goal) => goal.raceId)).size).toBe(3)
    expect(first.goals.find((goal) => goal.slot === 'identity')?.raceId).toBe('op-identity')
    expect(first.goals.find((goal) => goal.slot === 'challenge')).toMatchObject({ kind: 'win-by-margin', minimumMarginLengths: 5 })
  })

  it('fails with count-only diagnostics when three distinct races cannot be supplied', () => {
    expect(() => generateScenarioJourney({ uma: started(), umaTemplate: template, races: races.slice(0, 2) }))
      .toThrow(/2 races, 2 grade buckets/)
  })
})

describe('goal evaluation and closure', () => {
  it('accepts exactly five lengths from the ordered runner-up and records the committed result id', () => {
    const uma = started()
    const journey = generateScenarioJourney({ uma, umaTemplate: template, races })
    const challenge = journey.goals.find((goal) => goal.slot === 'challenge')!
    const target = races.find((item) => item.id === challenge.raceId)!
    const failed = evaluateScenarioGoals({ journey, uma: { ...uma, scenarioJourneys: [journey] }, race: target, resultId: 'race:uma-goal:0', result: result(target.id, { margin: 4.99 }), completedAt: 60 })
    expect(failed.newlyCompletedIds).toEqual([])
    const passed = evaluateScenarioGoals({ journey, uma: { ...uma, scenarioJourneys: [journey] }, race: target, resultId: 'race:uma-goal:0', result: result(target.id, { margin: CHALLENGE_MARGIN_LENGTHS }), completedAt: 60 })
    expect(passed.newlyCompletedIds).toEqual([challenge.id])
    expect(passed.journey.goals.find((goal) => goal.id === challenge.id)).toMatchObject({ status: 'completed', completedRaceResultId: 'race:uma-goal:0' })
  })

  it('ignores a loss, another Uma, another tier, and another race, then preserves completion while closing misses', () => {
    const uma = started()
    const journey = generateScenarioJourney({ uma, umaTemplate: template, races })
    const goal = journey.goals[0]!
    const target = races.find((item) => item.id === goal.raceId)!
    for (const record of [
      result(target.id, { placement: 2 }), result(target.id, { umaId: 'other' }),
      result(target.id, { startLevel: 11 }), result('op-other'),
    ]) {
      expect(evaluateScenarioGoals({ journey, uma: { ...uma, scenarioJourneys: [journey] }, race: target, resultId: 'race:uma-goal:0', result: record, completedAt: 60 }).newlyCompletedIds).toEqual([])
    }
    const won = evaluateScenarioGoals({ journey, uma: { ...uma, scenarioJourneys: [journey] }, race: target, resultId: 'race:uma-goal:0', result: result(target.id), completedAt: 60 }).journey
    const closed = closeScenarioJourney(won, 70)
    expect(scenarioJourneySummary(closed)).toEqual({ completed: 1, missed: 2, active: 0, honors: false })
    expect(closeScenarioJourney(closed, 99)).toEqual(closed)
  })
})

describe('goal bootstrap', () => {
  it('adds honest legacy tiers and replays only current-tier committed history', () => {
    const uma = started(21)
    const provisional = generateScenarioJourney({ uma, umaTemplate: template, races })
    const targetId = provisional.goals[0]!.raceId
    const bootstrapped = bootstrapScenarioGoals({
      uma, umaTemplate: template, races,
      raceHistory: [result(targetId, { startLevel: 11, sequence: 0 }), result(targetId, { startLevel: 21, sequence: 1 })],
    })
    expect(bootstrapped.goalPlanVersion).toBe(1)
    expect(bootstrapped.scenarioJourneys.slice(0, 2)).toEqual([
      { tier: 1, tracking: 'legacy-untracked', state: 'completed', completedAt: null, goals: [] },
      { tier: 2, tracking: 'legacy-untracked', state: 'completed', completedAt: null, goals: [] },
    ])
    expect(bootstrapped.scenarioJourneys[2]?.goals[0]).toMatchObject({ status: 'completed', completedRaceResultId: 'race:uma-goal:1' })
    expect(parseUmaSave(bootstrapped)).not.toBeNull()
  })

  it('leaves pending Umas without an active journey and marks a pre-T014 final completion untracked', () => {
    const pending = createUmaSave(template)
    expect(bootstrapScenarioGoals({ uma: { ...pending, goalPlanVersion: 0 }, umaTemplate: template, races, raceHistory: [] }))
      .toMatchObject({ goalPlanVersion: 1, scenarioJourneys: [] })
    const snapshot: ParentSnapshot = {
      umaId: template.id, charaId: template.charaId, completedTier: 11, takenAt: 1,
      inheritedUniqueSkillId: null, inheritableWhiteSkillIds: [], aptitudes: template.aptitudes, parents: [],
    }
    const final = bootstrapScenarioGoals({
      uma: { ...started(110), parentSnapshot: snapshot }, umaTemplate: template, races, raceHistory: [],
    })
    expect(final.scenarioJourneys).toHaveLength(11)
    expect(final.scenarioJourneys.every((journey) => journey.tracking === 'legacy-untracked' && journey.completedAt === null)).toBe(true)
  })
})
