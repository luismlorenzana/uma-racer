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
  scenarioGoalSeriesRotation,
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

function race(
  id: string,
  familyId: string,
  grade: RaceTemplate['grade'],
  distance: number,
  surface: RaceTemplate['surface'] = 'turf',
  seriesLegs: string[] = [],
): RaceTemplate {
  const distanceCategory = distance <= 1400 ? 'sprint' : distance <= 1800 ? 'mile' : distance <= 2400 ? 'medium' : 'long'
  return {
    id, familyId, name: `Synthetic ${id}`, grade, surface, distance, distanceCategory,
    direction: 'left', venue: 'Synthetic', venueKey: 'synthetic-venue', venueTags: [],
    series: [...new Set(seriesLegs.map((leg) => leg.slice(0, leg.indexOf(':'))))] as RaceTemplate['series'], seriesLegs,
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

function startedFor(umaTemplate: UmaTemplate, level = 1): UmaSave {
  return { ...createUmaSave(umaTemplate), goalPlanVersion: 0, scenarioStarted: true, level }
}

const seriesKeys = {
  'triple-crown': ['satsuki-sho', 'tokyo-yushun', 'kikuka-sho'],
  'triple-tiara': ['oka-sho', 'japanese-oaks', 'shuka-sho'],
  'spring-triple-crown': ['osaka-hai', 'tenno-sho-spring', 'takarazuka-kinen'],
  'autumn-triple-crown': ['tenno-sho-autumn', 'japan-cup', 'arima-kinen'],
  'grand-prix': ['takarazuka-kinen', 'arima-kinen'],
  'sprint-crown': ['takamatsunomiya-kinen', 'sprinters-stakes'],
  'mile-crown': ['yasuda-kinen', 'mile-championship'],
  'dirt-crown': ['february-stakes', 'champions-cup'],
} as const

function seriesCatalog(longClassic = false): RaceTemplate[] {
  let family = 600
  return Object.entries(seriesKeys).flatMap(([tag, keys]) => keys.flatMap((key) => {
    family += 1
    const distance = longClassic && tag === 'triple-crown' ? 2_600 : tag === 'sprint-crown' ? 1_200 : 1_600
    const surface = tag === 'dirt-crown' ? 'dirt' as const : 'turf' as const
    return [
      race(`${tag}-${key}-a`, String(family), 'g1', distance, surface, [`${tag}:${key}`]),
      race(`${tag}-${key}-b`, String(family + 100), 'g1', distance, surface, [`${tag}:${key}`]),
    ]
  }))
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

  it('walks career order and skips missing, previously used, and off-aptitude families', () => {
    const careerTemplate = {
      ...template,
      signatureRaceFamilyIds: ['999', '701', '702', '202', '203'],
    }
    const catalog = [
      ...races,
      race('off-surface', '701', 'g1', 1_600, 'dirt'),
      race('off-distance', '702', 'g1', 2_600),
    ]
    const tierOne = generateScenarioJourney({ uma: startedFor(careerTemplate), umaTemplate: careerTemplate, races: catalog })
    expect(tierOne.goals.find((goal) => goal.slot === 'identity')?.raceId).toBe('op-identity')
    const tierTwoUma = { ...startedFor(careerTemplate, 11), scenarioJourneys: [closeScenarioJourney(tierOne, 9)] }
    const tierTwo = generateScenarioJourney({ uma: tierTwoUma, umaTemplate: careerTemplate, races: catalog })
    expect(tierTwo.goals.find((goal) => goal.slot === 'identity')?.raceId).toBe('op-other')
  })

  it('uses classic legs in documented order by sex and lets unknown sex fall back to aptitude', () => {
    const catalog = [...races, ...seriesCatalog()]
    const identityTargets = (sex: UmaTemplate['realHorseSex']) => {
      const sexTemplate = { ...template, realHorseSex: sex, signatureRaceFamilyIds: [] }
      let save = startedFor(sexTemplate)
      const targets: (string | null)[] = []
      for (const level of [1, 11, 21]) {
        save = { ...save, level }
        const journey = generateScenarioJourney({ uma: save, umaTemplate: sexTemplate, races: catalog })
        targets.push(journey.goals.find((goal) => goal.slot === 'identity')?.raceId ?? null)
        save = { ...save, scenarioJourneys: [...save.scenarioJourneys, closeScenarioJourney(journey, level)] }
      }
      return targets.map((id) => catalog.find((item) => item.id === id)?.seriesLegs[0] ?? null)
    }
    expect(identityTargets('male')).toEqual(seriesKeys['triple-crown'].map((key) => `triple-crown:${key}`))
    expect(identityTargets('female')).toEqual(seriesKeys['triple-tiara'].map((key) => `triple-tiara:${key}`))
    expect(identityTargets(null)).toEqual([null, null, null])
  })

  it('builds late-tier series in the fixed rotation and skips an ineligible scheduled set', () => {
    const male = { ...template, realHorseSex: 'male' as const, signatureRaceFamilyIds: [], aptitudes: { ...template.aptitudes, surface: { ...template.aptitudes.surface, dirt: 'B' as const } } }
    const catalog = [...races, ...seriesCatalog()]
    const tags = [7, 8, 9, 10, 11].map((tier) => {
      const journey = generateScenarioJourney({ uma: startedFor(male, (tier - 1) * 10 + 1), umaTemplate: male, races: catalog })
      const identity = journey.goals.find((goal) => goal.slot === 'identity')!
      expect(identity.kind).toBe('win-series')
      expect(identity.series?.legs.map((leg) => leg.key)).toEqual(seriesKeys[identity.series!.tag])
      return identity.series?.tag
    })
    expect(tags).toEqual(scenarioGoalSeriesRotation('male').slice(0, 5))

    const skipped = generateScenarioJourney({ uma: startedFor(male, 61), umaTemplate: male, races: [...races, ...seriesCatalog(true)] })
    expect(skipped.goals.find((goal) => goal.slot === 'identity')?.series?.tag).toBe('spring-triple-crown')
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

  it('requires every exact frozen series leg in the active tier and emits only the final goal id', () => {
    const male = { ...template, realHorseSex: 'male' as const, signatureRaceFamilyIds: [], aptitudes: { ...template.aptitudes, surface: { ...template.aptitudes.surface, dirt: 'B' as const } } }
    const catalog = [...races, ...seriesCatalog()]
    const base = startedFor(male, 61)
    let journey = generateScenarioJourney({ uma: base, umaTemplate: male, races: catalog })
    const identity = journey.goals.find((goal) => goal.slot === 'identity')!
    const firstLeg = identity.series!.legs[0]!
    const alias = catalog.find((candidate) => candidate.id !== firstLeg.raceId && candidate.seriesLegs.includes(`triple-crown:${firstLeg.key}`))!
    const ignored = evaluateScenarioGoals({ journey, uma: { ...base, scenarioJourneys: [journey] }, race: alias, resultId: 'race:uma-goal:0', result: result(alias.id, { startLevel: 61 }), completedAt: 60 })
    expect(ignored.journey).toEqual(journey)

    for (const [index, leg] of identity.series!.legs.entries()) {
      const target = catalog.find((candidate) => candidate.id === leg.raceId)!
      const evaluated = evaluateScenarioGoals({
        journey,
        uma: { ...base, scenarioJourneys: [journey] },
        race: target,
        resultId: `race:uma-goal:${index + 1}`,
        result: result(target.id, { startLevel: 61, sequence: index + 1 }),
        completedAt: 61 + index,
      })
      expect(evaluated.newlyCompletedIds).toEqual(index === identity.series!.legs.length - 1 ? [identity.id] : [])
      journey = evaluated.journey
    }
    expect(journey.goals.find((goal) => goal.id === identity.id)).toMatchObject({
      status: 'completed', completedRaceResultId: `race:uma-goal:${identity.series!.legs.length}`,
    })

    const partial = generateScenarioJourney({ uma: base, umaTemplate: male, races: catalog })
    const partialIdentity = partial.goals.find((goal) => goal.slot === 'identity')!
    const target = catalog.find((candidate) => candidate.id === partialIdentity.series!.legs[0]!.raceId)!
    const wonOne = evaluateScenarioGoals({ journey: partial, uma: { ...base, scenarioJourneys: [partial] }, race: target, resultId: 'race:uma-goal:9', result: result(target.id, { startLevel: 61, sequence: 9 }), completedAt: 70 }).journey
    const closed = closeScenarioJourney(wonOne, 80)
    const closedIdentity = closed.goals.find((goal) => goal.slot === 'identity')!
    expect(closedIdentity.status).toBe('missed')
    expect(closedIdentity.series?.legs.map((leg) => leg.status)).toEqual(['completed', 'missed', 'missed'])
    expect(scenarioJourneySummary(closed)).toMatchObject({ missed: 3 })
  })
})

describe('goal bootstrap', () => {
  it('regenerates only an untouched v1 active plan and freezes any plan with progress', () => {
    const oldJourney = {
      tier: 1, tracking: 'tracked' as const, state: 'active' as const, completedAt: null,
      goals: [
        { id: 'goal:1:aptitude', slot: 'aptitude' as const, raceId: 'pre-a', kind: 'win' as const, series: null, minimumMarginLengths: 0, status: 'active' as const, completedRaceResultId: null, completedAt: null },
        { id: 'goal:1:identity', slot: 'identity' as const, raceId: 'op-other', kind: 'win' as const, series: null, minimumMarginLengths: 0, status: 'active' as const, completedRaceResultId: null, completedAt: null },
        { id: 'goal:1:challenge', slot: 'challenge' as const, raceId: 'g3-a', kind: 'win-by-margin' as const, series: null, minimumMarginLengths: 5, status: 'active' as const, completedRaceResultId: null, completedAt: null },
      ],
    }
    const old = { ...started(), goalPlanVersion: 1, scenarioJourneys: [oldJourney] }
    const regenerated = bootstrapScenarioGoals({ uma: old, umaTemplate: template, races, raceHistory: [] })
    expect(regenerated.goalPlanVersion).toBe(2)
    expect(regenerated.scenarioJourneys[0]?.goals.find((goal) => goal.slot === 'identity')?.raceId).toBe('op-identity')

    const progressed = {
      ...old,
      scenarioJourneys: [{ ...oldJourney, goals: oldJourney.goals.map((goal, index) => index === 0
        ? { ...goal, status: 'completed' as const, completedRaceResultId: 'race:uma-goal:0', completedAt: 5 }
        : goal) }],
    }
    const frozen = bootstrapScenarioGoals({ uma: progressed, umaTemplate: template, races, raceHistory: [] })
    expect(frozen.goalPlanVersion).toBe(2)
    expect(frozen.scenarioJourneys).toEqual(progressed.scenarioJourneys)
  })

  it('adds honest legacy tiers and replays only current-tier committed history', () => {
    const uma = started(21)
    const provisional = generateScenarioJourney({ uma, umaTemplate: template, races })
    const targetId = provisional.goals[0]!.raceId!
    const bootstrapped = bootstrapScenarioGoals({
      uma, umaTemplate: template, races,
      raceHistory: [result(targetId, { startLevel: 11, sequence: 0 }), result(targetId, { startLevel: 21, sequence: 1 })],
    })
    expect(bootstrapped.goalPlanVersion).toBe(2)
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
      .toMatchObject({ goalPlanVersion: 2, scenarioJourneys: [] })
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
