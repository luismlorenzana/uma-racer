// The calendar (D383): the season mapping, and `placeObjectives` on invented journeys: each stage's year, the earliest
// Main G1 in Classic and the rest in Senior, race sets flattened, collisions and the roll to the next year.
import { describe, expect, it } from 'vitest'
import type { CareerStage, ScenarioGoal } from '../career-shapes'
import type { RaceTemplate } from '../content'
import { journeyRaces, placeObjectives, raceQuarter, seasonIndex, seasonName } from './calendar'

const r = (id: string, season: number): Pick<RaceTemplate, 'id' | 'season'> => ({ id, season })
const win = (slot: CareerStage, raceId: string): ScenarioGoal => ({
  id: `goal:${raceId}`, slot, raceId, kind: 'win', series: null, minimumMarginLengths: 0, status: 'active', completedRaceResultId: null, completedAt: null,
})
const set = (raceIds: readonly string[]): ScenarioGoal => ({
  ...win('main', 'set'), raceId: null, kind: 'win-series',
  series: { tag: 'triple-crown', legs: raceIds.map((raceId, n) => ({ key: `leg-${n}`, raceId, status: 'active', completedRaceResultId: null, completedAt: null })) },
})
const journey = (...goals: ScenarioGoal[]) => ({ goals })
const seasons = (placed: { raceId: string; season: number }[]) => Object.fromEntries(placed.map((entry) => [entry.raceId, seasonName(entry.season)]))

describe('the calendar', () => {
  it('maps the race season codes to seasons of the year, the cherry-blossom weeks to spring, and 0 to none', () => {
    expect([1, 2, 3, 4, 5].map((season) => raceQuarter({ season }))).toEqual([0, 1, 2, 3, 0])
    expect(raceQuarter({ season: 0 })).toBeNull()
    expect(raceQuarter({ season: 9 })).toBeNull()
  })

  it('names twelve seasons and the Finale', () => {
    expect(seasonName(0)).toBe('Junior Spring')
    expect(seasonName(seasonIndex(1, 2))).toBe('Classic Autumn')
    expect(seasonName(11)).toBe('Senior Winter')
    expect(seasonName(12)).toBe('Finale')
    expect(() => seasonName(13)).toThrow(RangeError)
  })
})

describe('placeObjectives', () => {
  const races = [
    r('maiden', 3), r('trial-a', 3), r('trial-b', 1), r('trial-x', 2), r('g1-summer', 2), r('g1-spring', 5), r('g1-winter', 4), r('g1-autumn', 3),
    r('leg-1', 1), r('leg-2', 1), r('leg-3', 3), r('no-season', 0),
  ]

  it('puts the Maiden in Junior, the Trials in Classic by season, the earliest Main in Classic and the rest in Senior', () => {
    const placed = placeObjectives(journey(win('maiden', 'maiden'), win('trials', 'trial-x'), win('trials', 'trial-b'),
      win('main', 'g1-winter'), win('main', 'g1-autumn'), win('main', 'g1-summer')), races)
    expect(seasons(placed)).toEqual({
      maiden: 'Junior Autumn', 'trial-b': 'Classic Spring', 'trial-x': 'Classic Summer',
      'g1-summer': 'Classic Summer', 'g1-autumn': 'Senior Autumn', 'g1-winter': 'Senior Winter',
    })
    expect(placed.map((entry) => entry.stage)).toEqual(['maiden', 'trials', 'trials', 'main', 'main', 'main'])
    expect(placed.map((entry) => entry.season)).toEqual([...placed.map((entry) => entry.season)].sort((a, b) => a - b))
  })

  it('moves a Main G1 that would come before the last Trial to the next year', () => {
    const placed = placeObjectives(journey(win('maiden', 'maiden'), win('trials', 'trial-a'), win('trials', 'trial-b'),
      win('main', 'g1-spring'), win('main', 'g1-autumn'), win('main', 'g1-winter')), races)
    // The earliest Main (spring) can't fall before Classic Autumn's Trial: it moves to Senior Spring.
    expect(seasons(placed)).toMatchObject({ 'g1-spring': 'Senior Spring', 'g1-autumn': 'Senior Autumn', 'g1-winter': 'Senior Winter' })
  })

  it('lets two objectives share a season', () => {
    const placed = placeObjectives(journey(win('maiden', 'maiden'), win('trials', 'trial-b'), win('trials', 'trial-a'),
      win('main', 'g1-autumn'), win('main', 'g1-winter')), races)
    expect(placed.filter((entry) => seasonName(entry.season) === 'Classic Autumn').map((entry) => entry.raceId)).toEqual(['trial-a', 'g1-autumn'])
  })

  it('flattens a race set into one objective a leg, ordered by season and kept in the set\'s order on ties', () => {
    const goals = journey(win('maiden', 'maiden'), win('trials', 'trial-b'), win('trials', 'trial-b'), set(['leg-1', 'leg-2', 'leg-3']))
    expect(journeyRaces(goals).filter((entry) => entry.stage === 'main').map((entry) => entry.raceId)).toEqual(['leg-1', 'leg-2', 'leg-3'])
    const placed = placeObjectives(journey(win('maiden', 'maiden'), win('trials', 'trial-b'), set(['leg-1', 'leg-2', 'leg-3'])), races)
    expect(seasons(placed)).toEqual({ maiden: 'Junior Autumn', 'trial-b': 'Classic Spring', 'leg-1': 'Classic Spring', 'leg-2': 'Senior Spring', 'leg-3': 'Senior Autumn' })
  })

  it('throws on a race the content lacks or one without a season', () => {
    expect(() => placeObjectives(journey(win('maiden', 'missing')), races)).toThrow(/No race/)
    expect(() => placeObjectives(journey(win('maiden', 'no-season')), races)).toThrow(/no season/)
  })
})
