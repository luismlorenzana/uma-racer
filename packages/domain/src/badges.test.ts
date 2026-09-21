import { subject } from './__fixtures__/subject'
import { describe, expect, it } from 'vitest'
import {
  applyDynastyFact,
  applyLegacyFact,
  applyParentedStartFact,
  applyRaceBadgeFacts,
  applyScenarioCompletionFact,
  badgeStateId,
  createTrainerBadgeState,
  createUmaBadgeState,
  parseBadgeState,
  parseFlairEvent,
  type RaceAccomplishmentFactsV1,
  type RaceResultRecord,
  type UmaTemplate,
} from './index'
import { createUmaSave } from './save'

const template: UmaTemplate = {
  id: 'synthetic-uma',
  charaId: 'synthetic-character',
  name: 'Synthetic Runner',
  outfit: null,
  jpRelease: '2000-01-01',
  globalRelease: null,
  starter: true,
  baseStats: { speed: 100, stamina: 110, power: 120, guts: 130, wit: 140 },
  growthRates: { speed: 0, stamina: 0, power: 0, guts: 0, wit: 0 },
  aptitudes: {
    surface: { turf: 'B', dirt: 'F' },
    distance: { sprint: 'A', mile: 'A', medium: 'B', long: 'F' },
    strategy: { front: 'C', pace: 'A', late: 'A', end: 'C' },
  },
  uniqueSkillId: null,
  awakeningSkillIds: [],
  realHorseSex: null,
  signatureRaceFamilyIds: [],
  imageSource: 'https://invalid.test/synthetic.png',
}

const facts: RaceAccomplishmentFactsV1 = {
  version: 1,
  familyId: 'synthetic-family',
  grade: 'g1',
  venueKey: 'synthetic-venue',
  venueTags: ['jra-main'],
  courseId: 'synthetic-course',
  surface: 'turf',
  distance: 3_000,
  distanceCategory: 'long',
  series: ['triple-crown'],
  playerStartDelay: 0.08,
  playerFinalSpurtPlacement: 10,
  ledEverySectionCheckpoint: true,
  inheritedUniqueActivated: true,
}

function result(sequence = 0, placement = 1): RaceResultRecord {
  return {
    engineVersion: 3,
    course: { distance: 3_000, surface: 'turf', season: 1 },
    contentVersion: 'synthetic-version',
    umaId: template.id,
    raceId: 'synthetic-race',
    sequence,
    seed: 7,
    strategy: 'front',
    startLevel: 1,
    startExp: 0,
    startStats: { speed: 600, stamina: 610, power: 620, guts: 630, wit: 640 },
    raceBonus: 0,
    playerPlacement: placement,
    expGained: 0,
    levelsGained: [],
    ticketReward: 0,
    shardReward: 0,
    completedGoalIds: sequence === 0 ? ['synthetic-goal'] : [],
    accomplishmentFacts: facts,
    field: Array.from({ length: 10 }, (_, index) => ({
      umaId: index === 0 ? template.id : `synthetic-rival-${index}`,
      isPlayer: index === 0,
      strategy: 'front' as const,
      gate: index,
      stats: { speed: 600, stamina: 610, power: 620, guts: 630, wit: 640 },
      aptitude: { distance: 'B' as const, surface: 'B' as const, strategy: 'C' as const },
      placement: index === 0 ? placement : index < placement ? index : index + 1,
      finishTime: 100 + index,
      marginLengths: index === 1 ? 10 : index === 0 ? 0 : 1,
    })),
    createdAt: 1_000 + sequence,
  }
}

describe('badge state v1', () => {
  it('constructs strict Uma and Trainer states and rejects unknown versions or corrupt counters', () => {
    const uma = { ...createUmaSave(template), level: 12 }
    const state = createUmaBadgeState(uma, subject({ tier: 2, trainingLevel: 10 }), 100)
    expect(badgeStateId(template.id)).toBe('uma:synthetic-uma')
    expect(parseBadgeState(state)).toEqual(state)
    expect(parseBadgeState(createTrainerBadgeState(100))).toEqual(createTrainerBadgeState(100))
    expect(parseBadgeState({ ...state, version: 2 })).toBeNull()
    expect(parseBadgeState({ ...state, facts: { ...state.facts, wins: 2, starts: 1 } })).toBeNull()
  })

  it('aggregates ordered race facts once and resets a streak on a loss', () => {
    const base = createUmaBadgeState(createUmaSave(template), subject(), 100)
    const won = applyRaceBadgeFacts(base, 'race:synthetic-uma:0', result(), facts)
    expect(won.facts).toMatchObject({ starts: 1, wins: 1, currentWinStreak: 1, longestWinStreak: 1, balancedPeak: 600 })
    expect(won.facts.gradeWins).toEqual([{ key: 'g1', count: 1 }])
    expect(won.facts.familyWins).toEqual([{ key: 'synthetic-family', count: 1, grade: 'g1', series: ['triple-crown'] }])
    expect(won.facts.courseBests).toEqual([{ courseId: 'synthetic-course', finishTime: 100, resultId: 'race:synthetic-uma:0', achievedAt: 1_000 }])
    expect(won.facts.raceFeats).toMatchObject({
      wireToWireWins: 1,
      greatComebackWins: 1,
      backFieldWins: 1,
      bigMarginWins: 1,
      slowStartWins: 1,
      inheritedUniqueWins: 1,
      ironHorseWins: 1,
      unorthodoxWins: 1,
    })
    expect(won.facts.raceStartsByTier).toEqual([{ key: '1', count: 1 }])
    expect(applyRaceBadgeFacts(won, 'race:synthetic-uma:0', result(), facts)).toEqual(won)
    const lost = applyRaceBadgeFacts(won, 'race:synthetic-uma:1', result(1, 2), { ...facts, ledEverySectionCheckpoint: false })
    expect(lost.facts).toMatchObject({ starts: 2, wins: 1, seconds: 1, currentWinStreak: 0, longestWinStreak: 1 })
    expect(() => applyRaceBadgeFacts(base, 'race:synthetic-uma:1', result(1), facts)).toThrow(/sequence is incomplete/)

    const degraded = applyRaceBadgeFacts(base, 'race:synthetic-uma:0', result(), null)
    expect(degraded.facts).toMatchObject({ starts: 1, wins: 1 })
    expect(degraded.facts.gradeWins).toEqual([])
    expect(degraded.history).toMatchObject({ race: 'exact', diagnostics: ['race-facts-unavailable:race:synthetic-uma:0'] })
  })

  it('reads stats, skills and full training from the derived constellation', () => {
    const uma = createUmaSave(template)
    const derived = subject({
      trainingLevel: 10,
      stats: { speed: 700, stamina: 100, power: 100, guts: 100, wit: 100 },
      library: [{ skillId: 'synthetic-skill' }],
    })
    const state = createUmaBadgeState(uma, derived, 100)
    // Training turns no longer exist, so their history is explicitly untracked rather than a lower bound.
    expect(state.history.training).toBe('untracked')
    expect(state.facts.lifetimeTrainingTurns).toBe(0)
    expect(state.facts.statPeaks.speed).toBe(700)
    expect(state.facts.fullyTrainedTiers).toEqual([1])
    expect(state.facts.distinctSkillIds).toEqual(['synthetic-skill'])
    expect(parseBadgeState(state)).toEqual(state)
  })

  it('deduplicates lineage evidence and captures a bounded completion snapshot', () => {
    let state = createUmaBadgeState(createUmaSave(template), subject(), 100)
    state = applyParentedStartFact(state, 1, ['synthetic-parent'], 110)
    state = applyParentedStartFact(state, 1, ['synthetic-parent'], 120)
    state = applyLegacyFact(state, 'synthetic-child', 1, 130)
    state = applyLegacyFact(state, 'synthetic-child', 1, 140)
    state = applyDynastyFact(state, 'synthetic-descendant', 1, 150)
    expect(state.sourceWatermarks.lineageEvidence).toBe(3)
    const completed = applyScenarioCompletionFact(state, {
      tier: 1,
      completedAt: 200,
      trainingLevel: 10,
      stats: { speed: 700, stamina: 700, power: 700, guts: 700, wit: 700 },
      deckCardIds: ['synthetic-card'],
      deckEras: [1],
      trainingTurns: 20,
      friendshipTrainings: 4,
      raceStarts: 3,
      completedGoalIds: ['synthetic-goal'],
      honors: false,
      parentUmaIds: ['synthetic-parent'],
      grandparentUmaIds: ['synthetic-grandparent'],
    })
    expect(completed.facts.completedScenarioTiers).toEqual([1])
    expect(completed.sourceWatermarks.scenarioCompletions).toBe(1)
    expect(parseBadgeState(completed)).toEqual(completed)
  })

  it('strictly validates the reserved append-only flair envelope', () => {
    const event = {
      version: 1 as const,
      scope: 'uma' as const,
      umaId: template.id,
      kind: 'badge-tier' as const,
      awardKey: 'synthetic-award',
      stage: 'bronze' as const,
      earnedAt: 500,
      source: { kind: 'race' as const, id: 'race:synthetic-uma:0', tier: 1 },
      retroactive: false,
    }
    expect(parseFlairEvent(event)).toEqual(event)
    expect(parseFlairEvent({ ...event, surprise: true })).toBeNull()
    expect(parseFlairEvent({ ...event, scope: 'trainer', umaId: template.id })).toBeNull()
  })
})
