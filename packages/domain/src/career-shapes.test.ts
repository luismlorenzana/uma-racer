import { describe, expect, it } from 'vitest'
import type { UmaTemplate } from './content'
import {
  activeScenario,
  bestBaseDistance,
  createUmaSave,
  parseScenarioJourney,
  trainedScenario,
  withScenarioView,
} from './career-shapes'

const aptitudes = {
  surface: { turf: 'A', dirt: 'G' },
  distance: { sprint: 'B', mile: 'A', medium: 'A', long: 'C' },
  strategy: { front: 'D', pace: 'A', late: 'B', end: 'C' },
} as const

function uma(id: string, starter = true): UmaTemplate {
  return {
    id,
    charaId: `chara-${id}`,
    name: `Synthetic ${id}`,
    outfit: null,
    jpRelease: '2000-01-01',
    globalRelease: null,
    starter,
    baseStats: { speed: 101, stamina: 102, power: 103, guts: 104, wit: 105 },
    growthRates: { speed: 0, stamina: 0, power: 0, guts: 0, wit: 0 },
    aptitudes,
    uniqueSkillId: `skill-${id}`,
    awakeningSkillIds: [],
    realHorseSex: null,
    signatureRaceFamilyIds: [],
    imageSource: 'https://invalid.test/synthetic.png',
  }
}

describe('a new Uma', () => {
  it('records the unique in skill history; the library itself is derived', () => {
    expect(createUmaSave(uma('u1'))).toMatchObject({
      skillHistory: [{ skillId: 'skill-u1', origin: 'own-unique', sourceId: 'u1', tier: 1 }],
    })
  })

  it('rejects malformed content before constructing a save', () => {
    const malformed = { ...uma('bad'), baseStats: { ...uma('bad').baseStats, speed: -1 } }
    expect(() => createUmaSave(malformed)).toThrow(/invalid save initialization data/)
  })
})

describe('careers', () => {
  it('strictly validates single and series goal shapes and distinct frozen targets', () => {
    const single = (slot: 'aptitude' | 'challenge', raceId: string) => ({
      id: `goal:1:${slot}`, slot, raceId, kind: slot === 'challenge' ? 'win-by-margin' as const : 'win' as const,
      series: null, minimumMarginLengths: slot === 'challenge' ? 5 : 0, status: 'active' as const,
      completedRaceResultId: null, completedAt: null,
    })
    const identity = {
      id: 'goal:1:identity', slot: 'identity' as const, raceId: null, kind: 'win-series' as const,
      series: { tag: 'grand-prix' as const, legs: [
        { key: 'first-leg', raceId: 'series-a', status: 'completed' as const, completedRaceResultId: 'race:u1:1', completedAt: 10 },
        { key: 'second-leg', raceId: 'series-b', status: 'active' as const, completedRaceResultId: null, completedAt: null },
      ] },
      minimumMarginLengths: 0, status: 'active' as const, completedRaceResultId: null, completedAt: null,
    }
    const journey = { tier: 1, tracking: 'tracked' as const, state: 'active' as const, completedAt: null, goals: [single('aptitude', 'single-a'), identity, single('challenge', 'single-c')] }
    expect(parseScenarioJourney(journey)).not.toBeNull()
    expect(parseScenarioJourney({ ...journey, goals: [{ ...journey.goals[0], series: identity.series }, identity, journey.goals[2]] })).toBeNull()
    expect(parseScenarioJourney({ ...journey, goals: [journey.goals[0], { ...identity, raceId: 'series-a' }, journey.goals[2]] })).toBeNull()
    expect(parseScenarioJourney({ ...journey, goals: [journey.goals[0], { ...identity, series: { ...identity.series, legs: [identity.series.legs[0]!] } }, journey.goals[2]] })).toBeNull()
    expect(parseScenarioJourney({ ...journey, goals: [journey.goals[0], { ...identity, series: { ...identity.series, legs: [identity.series.legs[0]!, { ...identity.series.legs[1]!, key: 'first-leg' }] } }, journey.goals[2]] })).toBeNull()
    expect(parseScenarioJourney({ ...journey, goals: [journey.goals[0], { ...identity, series: { ...identity.series, legs: [identity.series.legs[0]!, { ...identity.series.legs[1]!, raceId: 'series-a' }] } }, journey.goals[2]] })).toBeNull()
    expect(parseScenarioJourney({ ...journey, goals: [single('aptitude', 'series-a'), identity, journey.goals[2]] })).toBeNull()
  })
})

describe('distance presets (D252)', () => {
  const template = uma('u1')

  it('shows a unit through one preset, and writes a change back to that preset alone', () => {
    const save = { ...createUmaSave(template), activePreset: 'mile' as const }
    const mile = activeScenario(save)
    expect(mile.preset).toBe('mile')
    const changed = withScenarioView(save, { ...mile, cardSetIds: ['c1'] })
    const unit = changed.scenarios[0]!
    expect(unit.presets.mile).toMatchObject({ cardSetIds: ['c1'] })
    expect(unit.presets.long).toMatchObject({ cardSetIds: [] })
    expect(trainedScenario(changed, 1, 'long')).toMatchObject({ preset: 'long', cardSetIds: [] })
  })

  it('starts a new Uma on her best base distance', () => {
    const grades = (sprint: string, mile: string, medium: string, long: string) =>
      ({ aptitudes: { ...template.aptitudes, distance: { sprint, mile, medium, long } } }) as Pick<UmaTemplate, 'aptitudes'>
    expect(bestBaseDistance(grades('B', 'A', 'C', 'G'))).toBe('mile')
    expect(bestBaseDistance(grades('A', 'B', 'A', 'B'))).toBe('medium')
    expect(bestBaseDistance(grades('A', 'A', 'B', 'B'))).toBe('sprint')
  })
})
