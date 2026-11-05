import { describe, expect, it } from 'vitest'
import {
  careerComplete,
  careerProfile,
  careerStage,
  flairSeriesLegId,
  goalRaceIds,
  planScenarioCareer,
  recommendedRacePreferences,
  scenarioJourneySummary,
  type Aptitudes,
  type DistanceCategory,
  type FlairSeriesTag,
  type RaceGrade,
  type RaceTemplate,
  type ScenarioGoal,
  type ScenarioJourney,
  type Surface,
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
  ...extra,
})

const COLT = template('colt', grades(['C', 'B', 'A', 'A']), { realHorseSex: 'male' })
const FILLY = template('filly', grades(['C', 'A', 'A', 'C']), { realHorseSex: 'female' })
const SPRINTER = template('sprinter', grades(['A', 'B', 'C', 'G']), { realHorseSex: 'male' })
const DIRT = template('dirt', grades(['B', 'A', 'C', 'G'], ['C', 'A']), { realHorseSex: 'male' })

function career(uma: UmaTemplate, tier = 1, races: readonly RaceTemplate[] = RACES) {
  return planScenarioCareer({ T: tier, umaTemplate: uma, aptitudes: uma.aptitudes, races })
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
    const preferences = { strategy: 'front' as const, distance: 'sprint' as const, surface: 'dirt' as const }
    expect(planScenarioCareer({ T: 1, preferences, umaTemplate: COLT, aptitudes: COLT.aptitudes, races: RACES }).profile)
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
