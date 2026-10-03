import { describe, expect, it } from 'vitest'
import {
  addUmaRaceExp,
  awaitingAdvance,
  CAREER_STAGE_LEVELS,
  careerComplete,
  careerHoldLevel,
  careerOpenAtGate,
  careerProfile,
  careerStage,
  createPlayerProfile,
  createScenarioTraining,
  createUmaSave,
  expToNextUmaLevel,
  legacyExpToNextUmaLevel,
  migrateUmaSaveWithSurplus,
  parseLegacyUmaSaveV12,
  flairSeriesLegId,
  generateScenarioJourney,
  goalRaceIds,
  parseUmaSave,
  planScenarioCareer,
  recommendedRacePreferences,
  SCENARIO_GOAL_VERSION,
  scenarioAdvanceReadiness,
  scenarioJourneySummary,
  upgradeGoalPlan,
  type Aptitudes,
  type DistanceCategory,
  type FlairSeriesTag,
  type RaceGrade,
  type RaceTemplate,
  type ScenarioGoal,
  type ScenarioJourney,
  type Surface,
  type UmaSave,
  type UmaTemplate,
} from './index'

const DISTANCE: Record<DistanceCategory, number> = { sprint: 1200, mile: 1600, medium: 2000, long: 2500 }

let nextFamily = 100
function race(grade: RaceGrade, surface: Surface, distanceCategory: DistanceCategory, extra: Partial<RaceTemplate> = {}): RaceTemplate {
  nextFamily += 1
  const id = extra.id ?? `${surface}-${grade}-${distanceCategory}-${nextFamily}`
  return {
    id,
    familyId: String(nextFamily),
    name: id,
    grade,
    surface,
    distance: DISTANCE[distanceCategory],
    distanceCategory,
    direction: 'left',
    venue: 'Test Track',
    venueKey: 'test-track',
    venueTags: [],
    series: [],
    seriesLegs: [],
    courseId: 'course-1',
    season: 1,
    fieldSize: 12,
    ...extra,
  }
}

const leg = (id: string, distanceCategory: DistanceCategory, legs: [FlairSeriesTag, string][], surface: Surface = 'turf') =>
  race('g1', surface, distanceCategory, {
    id,
    series: [...new Set(legs.map(([tag]) => tag))],
    seriesLegs: legs.map(([tag, key]) => flairSeriesLegId(tag, key)),
  })

const SET_RACES = [
  leg('satsuki-sho', 'medium', [['triple-crown', 'satsuki-sho']]),
  leg('tokyo-yushun', 'medium', [['triple-crown', 'tokyo-yushun']]),
  leg('kikuka-sho', 'long', [['triple-crown', 'kikuka-sho']]),
  leg('oka-sho', 'mile', [['triple-tiara', 'oka-sho']]),
  leg('japanese-oaks', 'medium', [['triple-tiara', 'japanese-oaks']]),
  leg('shuka-sho', 'medium', [['triple-tiara', 'shuka-sho']]),
  leg('osaka-hai', 'medium', [['spring-triple-crown', 'osaka-hai']]),
  leg('tenno-sho-spring', 'long', [['spring-triple-crown', 'tenno-sho-spring']]),
  leg('takarazuka-kinen', 'medium', [['spring-triple-crown', 'takarazuka-kinen'], ['grand-prix', 'takarazuka-kinen']]),
  leg('tenno-sho-autumn', 'medium', [['autumn-triple-crown', 'tenno-sho-autumn']]),
  leg('japan-cup', 'medium', [['autumn-triple-crown', 'japan-cup']]),
  leg('arima-kinen', 'long', [['autumn-triple-crown', 'arima-kinen'], ['grand-prix', 'arima-kinen']]),
  leg('takamatsunomiya-kinen', 'sprint', [['sprint-crown', 'takamatsunomiya-kinen']]),
  leg('sprinters-stakes', 'sprint', [['sprint-crown', 'sprinters-stakes']]),
  leg('yasuda-kinen', 'mile', [['mile-crown', 'yasuda-kinen']]),
  leg('mile-championship', 'mile', [['mile-crown', 'mile-championship']]),
  leg('february-stakes', 'mile', [['dirt-crown', 'february-stakes']], 'dirt'),
  leg('champions-cup', 'mile', [['dirt-crown', 'champions-cup']], 'dirt'),
]

const GENERIC_RACES = (['turf', 'dirt'] as const).flatMap((surface) =>
  (['g3', 'g2', 'g1'] as const).flatMap((grade) =>
    (['sprint', 'mile', 'medium', 'long'] as const).flatMap((distance) =>
      [0, 1, 2].map(() => race(grade, surface, distance)))))

const RACES: readonly RaceTemplate[] = [...SET_RACES, ...GENERIC_RACES]
const byId = new Map(RACES.map((entry) => [entry.id, entry]))

const grades = (distance: [string, string, string, string], surface: [string, string] = ['A', 'G']): Aptitudes => ({
  surface: { turf: surface[0], dirt: surface[1] },
  distance: { sprint: distance[0], mile: distance[1], medium: distance[2], long: distance[3] },
  strategy: { front: 'B', pace: 'A', late: 'A', end: 'C' },
} as Aptitudes)

const template = (id: string, aptitudes: Aptitudes, extra: Partial<UmaTemplate> = {}): UmaTemplate => ({
  id,
  charaId: `chara-${id}`,
  name: `Synthetic ${id}`,
  outfit: null,
  jpRelease: '2000-01-01',
  globalRelease: null,
  starter: true,
  baseStats: { speed: 100, stamina: 100, power: 100, guts: 100, wit: 100 },
  growthRates: { speed: 0, stamina: 0, power: 0, guts: 0, wit: 0 },
  aptitudes,
  uniqueSkillId: null,
  awakeningSkillIds: [],
  realHorseSex: null,
  signatureRaceFamilyIds: [],
  imageSource: 'https://invalid.test/synthetic.png',
  ...extra,
})

const COLT = template('colt', grades(['C', 'B', 'A', 'A']), { realHorseSex: 'male' })
const FILLY = template('filly', grades(['C', 'A', 'A', 'C']), { realHorseSex: 'female' })
const SPRINTER = template('sprinter', grades(['A', 'B', 'C', 'G']), { realHorseSex: 'male' })
const DIRT = template('dirt', grades(['B', 'A', 'C', 'G'], ['C', 'A']), { realHorseSex: 'male' })

const atTier = (uma: UmaTemplate, tier: number): UmaSave => ({
  ...createUmaSave(uma),
  level: (tier - 1) * 10 + 1,
  unlockedTier: tier,
  scenarios: Array.from({ length: tier }, (_, index) => ({ ...createScenarioTraining(index + 1), started: true })),
})

function career(uma: UmaTemplate, tier = 1, races: readonly RaceTemplate[] = RACES) {
  return planScenarioCareer({ uma: atTier(uma, tier), umaTemplate: uma, aptitudes: uma.aptitudes, races })
}

const racesOf = (goals: readonly ScenarioGoal[]) => goals.flatMap(goalRaceIds).map((id) => byId.get(id)!)

describe('career profile', () => {
  it('pairs her best two neighbouring distances on her better surface', () => {
    expect(careerProfile(COLT.aptitudes, COLT, RACES)).toMatchObject({ band: 'medium-long', surface: 'turf' })
    expect(careerProfile(FILLY.aptitudes, FILLY, RACES)).toMatchObject({ band: 'mile-medium', surface: 'turf' })
    expect(careerProfile(SPRINTER.aptitudes, SPRINTER, RACES)).toMatchObject({ band: 'sprint-mile', surface: 'turf' })
    expect(careerProfile(DIRT.aptitudes, DIRT, RACES).surface).toBe('dirt')
  })

  it('breaks an even pair with her real career', () => {
    const even = grades(['A', 'A', 'A', 'C'])
    expect(careerProfile(even, template('even', even), RACES).band).toBe('mile-medium')
    const sprintCareer = template('sprint-career', even, { signatureRaceFamilyIds: [byId.get('sprinters-stakes')!.familyId] })
    expect(careerProfile(even, sprintCareer, RACES).band).toBe('sprint-mile')
  })

  it('recommends one style, distance and surface, and constrains a chosen future career band', () => {
    expect(recommendedRacePreferences(COLT.aptitudes, COLT, RACES))
      .toEqual({ strategy: 'pace', distance: 'long', surface: 'turf' })
    expect(careerProfile(COLT.aptitudes, COLT, RACES, { distance: 'sprint', surface: 'dirt' }))
      .toMatchObject({ band: 'sprint-mile', surface: 'dirt' })
    const chosen = { ...atTier(COLT, 1), racePreferences: { strategy: 'front' as const, distance: 'sprint' as const, surface: 'dirt' as const } }
    expect(planScenarioCareer({ uma: chosen, umaTemplate: COLT, aptitudes: COLT.aptitudes, races: RACES }).profile)
      .toMatchObject({ band: 'sprint-mile', surface: 'dirt' })
  })
})

describe('career generation', () => {
  it('freezes a G3 maiden race, a G2 trial at each distance, and three G1 wins', () => {
    const { journey, profile } = career(COLT)
    expect(journey.goals.map((goal) => goal.id)).toEqual([
      'goal:1:maiden', 'goal:1:trials:1', 'goal:1:trials:2', 'goal:1:main:1',
    ])
    const [maiden, trialA, trialB] = journey.goals.map((goal) => byId.get(goal.raceId ?? '')!)
    expect(maiden).toMatchObject({ grade: 'g3', surface: 'turf' })
    expect(profile.distances).toContain(maiden!.distanceCategory)
    expect([trialA, trialB].map((entry) => [entry!.grade, entry!.distanceCategory])).toEqual([['g2', 'medium'], ['g2', 'long']])
    expect(journey.goals[3]).toMatchObject({ kind: 'win-series', series: { tag: 'triple-crown' } })
    expect(racesOf(journey.goals.filter((goal) => goal.slot === 'main')).map((entry) => entry.id))
      .toEqual(['satsuki-sho', 'tokyo-yushun', 'kikuka-sho'])
    expect(parseUmaSave({ ...createUmaSave(COLT), scenarios: [{ ...createUmaSave(COLT).scenarios[0]!, started: true, journey }] })).not.toBeNull()
  })

  it('rotates the main set by scenario and tops a two-leg set up from her own G1s', () => {
    expect([1, 2, 3, 4, 5, 6].map((tier) => career(COLT, tier).main))
      .toEqual(['triple-crown', 'spring-triple-crown', 'autumn-triple-crown', 'grand-prix', 'signature', 'triple-crown'])
    expect([1, 2, 3].map((tier) => career(FILLY, tier).main)).toEqual(['triple-tiara', 'mile-crown', 'signature'])
    expect([1, 2, 3].map((tier) => career(SPRINTER, tier).main)).toEqual(['sprint-crown', 'mile-crown', 'signature'])
    expect([1, 2].map((tier) => career(DIRT, tier).main)).toEqual(['dirt-crown', 'signature'])

    for (const [uma, tier] of [[COLT, 4], [COLT, 5], [SPRINTER, 1], [DIRT, 2]] as const) {
      const main = career(uma, tier).journey.goals.filter((goal) => goal.slot === 'main')
      const mainRaces = racesOf(main)
      expect(mainRaces).toHaveLength(3)
      expect(new Set(mainRaces.map((entry) => entry.familyId)).size).toBe(3)
      expect(mainRaces.every((entry) => entry.grade === 'g1')).toBe(true)
    }
  })

  it('keeps every race in her profile at B or better, and never repeats a race', () => {
    for (const uma of [COLT, FILLY, SPRINTER, DIRT]) {
      for (let tier = 1; tier <= 14; tier += 1) {
        const { journey, profile } = career(uma, tier)
        const races = racesOf(journey.goals)
        expect(new Set(races.map((entry) => entry.id)).size).toBe(races.length)
        for (const entry of races) {
          expect(entry.surface).toBe(profile.surface)
          expect(profile.distances).toContain(entry.distanceCategory)
        }
      }
    }
  })

  it('walks her real career first, and is deterministic whatever the input order', () => {
    const maidenFamily = RACES.find((entry) => entry.grade === 'g3' && entry.surface === 'turf' && entry.distanceCategory === 'long')!
    const withCareer = template('with-career', COLT.aptitudes, { realHorseSex: 'male', signatureRaceFamilyIds: [maidenFamily.familyId] })
    expect(career(withCareer, 1).journey.goals[0]!.raceId).toBe(maidenFamily.id)
    expect(career(withCareer, 2).journey.goals[0]!.raceId).not.toBe(maidenFamily.id)
    expect(career(COLT, 3, [...RACES].reverse()).journey).toEqual(career(COLT, 3).journey)
    expect(career(COLT, 1).journey.goals[0]!.raceId).not.toBe(career(COLT, 2).journey.goals[0]!.raceId)
  })

  it('runs both trials at her good distance when the other is below B', () => {
    const specialist = template('specialist', grades(['A', 'C', 'G', 'G']))
    const { journey, profile } = career(specialist)
    expect(profile.band).toBe('sprint-mile')
    expect(racesOf(journey.goals.filter((goal) => goal.slot === 'trials')).map((entry) => entry.distanceCategory)).toEqual(['sprint', 'sprint'])
  })

  it('falls back to looser pools rather than failing', () => {
    const noLongG2 = RACES.filter((entry) => !(entry.grade === 'g2' && entry.distanceCategory === 'long'))
    const trials = career(COLT, 1, noLongG2).journey.goals.filter((goal) => goal.slot === 'trials')
    expect(trials).toHaveLength(2)
    expect(racesOf(trials).every((entry) => entry.grade === 'g2')).toBe(true)
    expect(() => career(COLT, 1, RACES.filter((entry) => entry.grade !== 'g3'))).toThrow(/cannot supply a career/)
  })
})

function withJourney(uma: UmaSave, journey: ScenarioJourney): UmaSave {
  return { ...uma, scenarios: uma.scenarios.map((run) => run.tier === journey.tier ? { ...run, started: true, journey } : run) }
}

const complete = (journey: ScenarioJourney, stages: readonly ScenarioGoal['slot'][]): ScenarioJourney => ({
  ...journey,
  goals: journey.goals.map((goal) => !stages.includes(goal.slot) ? goal : {
    ...goal,
    status: 'completed',
    completedRaceResultId: 'race:colt:0',
    completedAt: 10,
    series: goal.series ? { ...goal.series, legs: goal.series.legs.map((entry) => ({ ...entry, status: 'completed' as const, completedRaceResultId: 'race:colt:0', completedAt: 10 })) } : null,
  }),
})

describe('career stages', () => {
  const fresh = career(COLT, 2).journey

  it('holds levels 2 and 5 of the scenario until their goals are won', () => {
    expect(CAREER_STAGE_LEVELS).toEqual({ maiden: { first: 1, last: 2 }, trials: { first: 3, last: 5 }, main: { first: 6, last: 10 } })
    expect(careerStage(fresh)).toBe('maiden')
    expect(careerHoldLevel(fresh, 11)).toBe(12)
    // An Uma already past a hold is never pushed back: the next unfinished stage holds her instead.
    expect(careerHoldLevel(fresh, 14)).toBe(15)
    expect(careerHoldLevel(fresh, 16)).toBeNull()
    const maidenWon = complete(fresh, ['maiden'])
    expect(careerStage(maidenWon)).toBe('trials')
    expect(careerHoldLevel(maidenWon, 12)).toBe(15)
    const trialsWon = complete(fresh, ['maiden', 'trials'])
    expect(careerStage(trialsWon)).toBe('main')
    expect(careerHoldLevel(trialsWon, 15)).toBeNull()
    expect(careerComplete(complete(fresh, ['maiden', 'trials', 'main']))).toBe(true)
    expect(scenarioJourneySummary(complete(fresh, ['maiden', 'trials', 'main'])).honors).toBe(true)
  })

  it('banks EXP just short of the next level while held, and releases it once the hold lifts', () => {
    const uma = { ...atTier(COLT, 2), level: 11, exp: 0 }
    const held = addUmaRaceExp(uma, 10_000, careerHoldLevel(fresh, 11))
    expect(held.uma).toMatchObject({ level: 12, exp: expToNextUmaLevel(12) - 1 })
    expect(held.levelsGained).toEqual([12])
    const still = addUmaRaceExp(held.uma, 500, careerHoldLevel(fresh, 12))
    expect(still.uma).toEqual(held.uma)
    const released = addUmaRaceExp(held.uma, 1, careerHoldLevel(complete(fresh, ['maiden']), 12))
    expect(released.uma.level).toBe(13)
    expect(released.levelsGained).toEqual([13])
  })

  it('keeps an unfinished career racing at the gate and gates the advance on it', () => {
    const profile = { ...createPlayerProfile('abc123def456', 1), tickets: 500 }
    const gate = withJourney({ ...atTier(COLT, 2), level: 20, exp: 0 }, complete(fresh, ['maiden', 'trials']))
    expect(careerOpenAtGate(activeJourney(gate))).toBe(true)
    expect(awaitingAdvance(gate)).toBe(false)
    expect(scenarioAdvanceReadiness(profile, gate)).toMatchObject({ ready: false, reason: 'Win her main goals to unlock the next scenario' })
    const done = withJourney(gate, complete(fresh, ['maiden', 'trials', 'main']))
    expect(awaitingAdvance(done)).toBe(true)
    expect(scenarioAdvanceReadiness(profile, done)).toMatchObject({ ready: true })
  })
})

describe('save v13: every scenario costs the same EXP (D241)', () => {
  const fresh = career(COLT, 2).journey
  const v12 = (uma: UmaSave) => ({ ...uma, schemaVersion: 12, scenarios: uma.scenarios.map(({ inspiration: _inspiration, ...run }) => run) })
  const at = (level: number, exp: number, stages: readonly ScenarioGoal['slot'][]) =>
    v12(withJourney({ ...atTier(COLT, 2), level, exp }, complete(fresh, stages)))

  it('costs 100 to 300 EXP a level in every scenario, 1,800 for its nine', () => {
    expect([1, 9, 10, 11, 19, 131, 139].map(expToNextUmaLevel)).toEqual([100, 300, 325, 100, 300, 100, 300])
    const scenario = (tier: number) => Array.from({ length: 9 }, (_, step) => expToNextUmaLevel((tier - 1) * 10 + 1 + step))
      .reduce((sum, value) => sum + value, 0)
    expect([1, 2, 7, 14].map(scenario)).toEqual([1_800, 1_800, 1_800, 1_800])
    // The rising curve it replaces: scenario 2 cost 4,050 and scenario 14 31,050.
    expect([15, 131].map(legacyExpToNextUmaLevel)).toEqual([450, 3_350])
  })

  it('re-levels a v12 Uma through the EXP she earned this scenario, and reports the levels to pay', () => {
    // Lv15 with 136 of 450: 1,686 earned since Lv11, which is Lv19 with 186 of 300 on the flat curve.
    const migrated = migrateUmaSaveWithSurplus(at(15, 136, ['maiden', 'trials']))!
    expect(migrated.uma).toMatchObject({ schemaVersion: 14, level: 19, exp: 186 })
    expect(migrated).toMatchObject({ levelsGained: [16, 17, 18, 19], gateReached: null, surplusExp: 0 })
    // Enough to pass the gate stops there with one level banked, and the gate is reported for its shard.
    const toGate = migrateUmaSaveWithSurplus(at(19, 500, ['maiden', 'trials']))!
    expect(toGate.uma).toMatchObject({ level: 20, exp: 100 })
    expect(toGate).toMatchObject({ levelsGained: [20], gateReached: 20 })
    // Already at the gate: her bank becomes one flat level.
    expect(migrateUmaSaveWithSurplus(at(20, 600, ['maiden', 'trials']))).toMatchObject({ uma: { level: 20, exp: 100 }, levelsGained: [] })
    // Scenario 1's levels cost what they did, so a scenario-1 Uma does not move.
    const first = v12({ ...atTier(COLT, 1), level: 5, exp: 150 })
    expect(migrateUmaSaveWithSurplus(first)).toMatchObject({ uma: { level: 5, exp: 150 }, levelsGained: [] })
  })

  it('stops at her career hold, banked just short, as a race would', () => {
    // Trials unwon holds level 15: she keeps the hold and banks 199 of 200.
    const held = migrateUmaSaveWithSurplus(at(15, 449, ['maiden']))!
    expect(held.uma).toMatchObject({ level: 15, exp: expToNextUmaLevel(15) - 1 })
    expect(held.levelsGained).toEqual([])
  })

  it('reads v12 on the rising curve and v13 on the flat one', () => {
    expect(parseLegacyUmaSaveV12(at(15, 449, ['maiden']))).not.toBeNull()
    expect(migrateUmaSaveWithSurplus({ ...at(15, 449, ['maiden']), schemaVersion: 13 })).toBeNull()
    expect(migrateUmaSaveWithSurplus({ ...at(15, 199, ['maiden']), schemaVersion: 13 })).not.toBeNull()
  })
})

const activeJourney = (uma: UmaSave) => uma.scenarios.find((run) => run.tier === uma.unlockedTier)?.journey ?? null

describe('career saves', () => {
  const journey = career(COLT, 1).journey
  const base = createUmaSave(COLT)
  const save = (goals: unknown[]) => ({ ...base, scenarios: [{ ...base.scenarios[0]!, started: true, journey: { ...journey, goals } }] })

  it('accepts only ordered stages with their counts and numbered ids', () => {
    expect(base.goalPlanVersion).toBe(SCENARIO_GOAL_VERSION)
    expect(parseUmaSave(save(journey.goals))).not.toBeNull()
    expect(parseUmaSave({ ...base, goalPlanVersion: SCENARIO_GOAL_VERSION + 1 })).toBeNull()
    const [maiden, trialA, trialB, main] = journey.goals
    expect(parseUmaSave(save([trialA, maiden, trialB, main]))).toBeNull()
    expect(parseUmaSave(save([maiden, trialA, main]))).toBeNull()
    expect(parseUmaSave(save([maiden, trialA, trialB]))).toBeNull()
    expect(parseUmaSave(save([maiden, { ...trialA, id: 'goal:1:trials:2' }, trialB, main]))).toBeNull()
    expect(parseUmaSave(save([{ ...maiden, id: 'goal:1:maiden:1' }, trialA, trialB, main]))).toBeNull()
    expect(parseUmaSave(save([maiden, trialA, trialB, main, { ...main, id: 'goal:1:main:2' }]))).toBeNull()
    expect(parseUmaSave(save([maiden, trialA, { ...trialB, kind: 'win-by-margin', minimumMarginLengths: 5 }, main]))).toBeNull()
    // A career never mixes with the legacy slots.
    expect(parseUmaSave(save([maiden, trialA, trialB, { ...main, slot: 'identity', id: 'goal:1:identity' }]))).toBeNull()
  })

  it('upgrades an untouched journey to a career and keeps one with progress', () => {
    const legacyGoal = (slot: 'aptitude' | 'identity' | 'challenge', raceId: string, status: 'active' | 'completed' = 'active'): ScenarioGoal => ({
      id: `goal:1:${slot}`, slot, raceId, kind: slot === 'challenge' ? 'win-by-margin' : 'win', series: null,
      minimumMarginLengths: slot === 'challenge' ? 5 : 0, status,
      completedRaceResultId: status === 'completed' ? 'race:colt:0' : null, completedAt: status === 'completed' ? 10 : null,
    })
    const legacy = (status: 'active' | 'completed'): UmaSave => ({
      ...withJourney({ ...base, goalPlanVersion: 2 }, {
        tier: 1, tracking: 'tracked', state: 'active', completedAt: null,
        goals: [legacyGoal('aptitude', 'satsuki-sho', status), legacyGoal('identity', 'tokyo-yushun'), legacyGoal('challenge', 'kikuka-sho')],
      }),
    })
    const input = (uma: UmaSave) => ({ uma, umaTemplate: COLT, aptitudes: COLT.aptitudes, races: RACES })
    const upgraded = upgradeGoalPlan(input(legacy('active')))
    expect(upgraded.goalPlanVersion).toBe(SCENARIO_GOAL_VERSION)
    expect(activeJourney(upgraded)).toEqual(generateScenarioJourney(input(legacy('active'))))
    const kept = upgradeGoalPlan(input(legacy('completed')))
    expect(kept.goalPlanVersion).toBe(SCENARIO_GOAL_VERSION)
    expect(activeJourney(kept)).toEqual(activeJourney(legacy('completed')))
    expect(careerStage(activeJourney(kept))).toBeNull()
    expect(upgradeGoalPlan(input(upgraded))).toBe(upgraded)
  })

  it('repairs an untouched v3 career that names a retired race and preserves one with progress', () => {
    const retiredRaceId = goalRaceIds(journey.goals[1]!)[0]!
    const availableRaces = RACES.filter((race) => race.id !== retiredRaceId)
    const v3 = withJourney({ ...base, goalPlanVersion: 3 }, journey)
    const input = (uma: UmaSave) => ({ uma, umaTemplate: COLT, aptitudes: COLT.aptitudes, races: availableRaces })

    const repaired = upgradeGoalPlan(input(v3))
    expect(repaired.goalPlanVersion).toBe(4)
    expect(activeJourney(repaired)).not.toEqual(journey)
    expect(activeJourney(repaired)?.goals.flatMap(goalRaceIds)).not.toContain(retiredRaceId)

    const progressed = withJourney({ ...base, goalPlanVersion: 3 }, complete(journey, ['maiden']))
    const preserved = upgradeGoalPlan(input(progressed))
    expect(preserved.goalPlanVersion).toBe(4)
    expect(activeJourney(preserved)).toEqual(activeJourney(progressed))
  })
})
