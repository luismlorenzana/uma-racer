import { describe, expect, it } from 'vitest'
import { createUmaSave, type ContentAtlas, type RaceResultRecord, type RaceTemplate, type ScenarioJourney, type UmaTemplate } from '@racer/domain'
import type { LoadedContent } from '../content/runtime'
import { buildGoalRaceCatalog, buildHomeGoalState, buildJourneyView, buildResultGoalView, goalsAtStake } from './goals-view'

const template: UmaTemplate = {
  id: 'uma-goals', charaId: '901', name: 'Synthetic Runner', outfit: null, jpRelease: '2000-01-01', globalRelease: null,
  starter: true, baseStats: { speed: 1, stamina: 1, power: 1, guts: 1, wit: 1 },
  growthRates: { speed: 0, stamina: 0, power: 0, guts: 0, wit: 0 },
  aptitudes: { surface: { turf: 'A', dirt: 'G' }, distance: { sprint: 'B', mile: 'A', medium: 'B', long: 'C' }, strategy: { front: 'C', pace: 'A', late: 'B', end: 'D' } },
  uniqueSkillId: null, awakeningSkillIds: [], realHorseSex: null, signatureRaceFamilyIds: [], imageSource: 'https://invalid.test/synthetic.png',
}
const races: RaceTemplate[] = ['a', 'b', 'c', 'd'].map((id, index) => ({
  id: `race-${id}`, familyId: String(100 + index), name: `Synthetic Race ${id.toUpperCase()}`, grade: 'op', surface: 'turf',
  distance: 1600, distanceCategory: 'mile', direction: 'left', venue: 'Synthetic', venueKey: 'synthetic-venue', venueTags: [], series: [], seriesLegs: [],
  courseId: `course-${id}`, season: 1, fieldSize: 8,
}))
const atlas = (kind: ContentAtlas['kind']): ContentAtlas => ({
  schemaVersion: 1, kind, frameWidth: 128, frameHeight: 128,
  pages: [{ path: `${kind}.webp`, width: 128, height: 128 }], frames: { x: { page: 0, x: 0, y: 0, width: 128, height: 128 } },
})
const content: LoadedContent = {
  manifest: { version: 'synthetic-v1', generatedAt: '2000-01-01T00:00:00Z', source: {}, files: [] }, origin: 'network',
  umas: { items: [template], byId: new Map([[template.id, template]]) }, cards: { items: [], byId: new Map() },
  skills: { items: [], byId: new Map() }, races: { items: races, byId: new Map(races.map((race) => [race.id, race])) },
  courses: { items: [], byId: new Map() },
  art: { has: () => false, load: async () => null },
  atlases: { 'uma-icons': { descriptor: atlas('uma-icons'), pageUrls: ['blob:uma'] }, 'card-icons': { descriptor: atlas('card-icons'), pageUrls: ['blob:card'] } },
}
const journey: ScenarioJourney = {
  tier: 1, tracking: 'tracked', state: 'active', completedAt: null,
  goals: [
    { id: 'goal:1:aptitude', slot: 'aptitude', raceId: 'race-a', kind: 'win', series: null, minimumMarginLengths: 0, status: 'completed', completedRaceResultId: 'race:uma-goals:0', completedAt: 10 },
    { id: 'goal:1:identity', slot: 'identity', raceId: 'race-b', kind: 'win', series: null, minimumMarginLengths: 0, status: 'active', completedRaceResultId: null, completedAt: null },
    { id: 'goal:1:challenge', slot: 'challenge', raceId: 'missing-race', kind: 'win-by-margin', series: null, minimumMarginLengths: 5, status: 'active', completedRaceResultId: null, completedAt: null },
  ],
}
const uma = { ...createUmaSave(template), scenarioStarted: true, goalPlanVersion: 1, scenarioJourneys: [journey] }

describe('goal view projections', () => {
  it('projects explicit Home states and missing private targets', () => {
    expect(buildHomeGoalState(createUmaSave(template), content)).toMatchObject({ kind: 'pending' })
    expect(buildHomeGoalState(uma, content)).toMatchObject({ kind: 'active', completed: 1, missingTargets: 1 })
    expect(buildHomeGoalState({ ...uma, scenarioJourneys: [{ tier: 1, tracking: 'legacy-untracked', state: 'completed', completedAt: null, goals: [] }] }, content))
      .toMatchObject({ kind: 'legacy-untracked' })
  })

  it('derives Journey pips, Honors, and a distinct untracked mark', () => {
    expect(buildJourneyView(uma, content)[0]).toMatchObject({ completed: 1, active: 2, honors: false })
    const honors = { ...journey, state: 'completed' as const, completedAt: 20, goals: journey.goals.map((goal) => ({ ...goal, status: 'completed' as const, completedRaceResultId: 'race:uma-goals:0', completedAt: 10 })) }
    expect(buildJourneyView({ ...uma, scenarioJourneys: [honors] }, content)[0]).toMatchObject({ completed: 3, honors: true })
    expect(buildJourneyView({ ...uma, scenarioJourneys: [{ tier: 1, tracking: 'legacy-untracked', state: 'completed', completedAt: null, goals: [] }] }, content)[0]?.tracking).toBe('legacy-untracked')
  })

  it('pins, filters, and deduplicates active goal races and exposes pre-race stakes', () => {
    const catalog = buildGoalRaceCatalog([races[0]!, races[2]!, races[1]!], uma, content)
    expect(catalog.map((item) => item.race.id)).toEqual(['race-b', 'race-a', 'race-c'])
    expect(buildGoalRaceCatalog(races, uma, content, true).map((item) => item.race.id)).toEqual(['race-b'])
    expect(goalsAtStake(uma, 'race-b', content)).toMatchObject([{ slot: 'identity', rule: 'Finish 1st' }])
  })

  it('pins every unwon series leg and names the set with one pip per leg', () => {
    const seriesJourney: ScenarioJourney = {
      ...journey,
      goals: [journey.goals[0]!, {
        id: 'goal:1:identity', slot: 'identity', raceId: null, kind: 'win-series', minimumMarginLengths: 0,
        series: { tag: 'triple-crown', legs: [
          { key: 'first-leg', raceId: 'race-b', status: 'completed', completedRaceResultId: 'race:uma-goals:1', completedAt: 11 },
          { key: 'second-leg', raceId: 'race-c', status: 'active', completedRaceResultId: null, completedAt: null },
          { key: 'third-leg', raceId: 'race-d', status: 'active', completedRaceResultId: null, completedAt: null },
        ] },
        status: 'active', completedRaceResultId: null, completedAt: null,
      }, journey.goals[2]!],
    }
    const seriesUma = { ...uma, goalPlanVersion: 2, scenarioJourneys: [seriesJourney] }
    const home = buildHomeGoalState(seriesUma, content)
    expect(home.kind).toBe('active')
    expect(home.kind === 'active' ? home.goals[1] : null).toMatchObject({
      raceName: 'Triple Crown', pips: [{ status: 'completed' }, { status: 'active' }, { status: 'active' }],
    })
    expect(buildGoalRaceCatalog(races, seriesUma, content, true).map((item) => item.race.id)).toEqual(['race-c', 'race-d'])
    expect(goalsAtStake(seriesUma, 'race-d', content)).toMatchObject([{ seriesName: 'Triple Crown', rule: 'Synthetic Race D · 1 / 3 legs won' }])
  })

  it('orders multi-goal result facts and animates only the fresh commit', () => {
    const completedJourney: ScenarioJourney = {
      ...journey,
      goals: journey.goals.map((goal) => ({ ...goal, status: 'completed', completedRaceResultId: 'race:uma-goals:0', completedAt: 10 })),
    }
    const record = { completedGoalIds: ['goal:1:challenge', 'goal:1:identity'] } as RaceResultRecord
    expect(buildResultGoalView(record, { ...uma, scenarioJourneys: [completedJourney] }, content, true)).toMatchObject({
      animate: true, completions: [{ slot: 'identity' }, { slot: 'challenge' }],
    })
    expect(buildResultGoalView(record, { ...uma, scenarioJourneys: [completedJourney] }, content, false).animate).toBe(false)
  })
})
