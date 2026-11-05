// The season machine (D383): which stage a season plays, when Next season opens, and how the calendar moves.
import { describe, expect, it } from 'vitest'
import { testCareer } from '../__fixtures__/build'
import { clock } from '../__fixtures__/g3'
import { isRefusal } from '../save/registry'
import { FINALE_SEASON, type CareerObjective } from '../save/records'
import { canAdvance, nextSeason, seasonFocus, seasonObjectives, seasonStage } from './season'

const objective = (raceId: string, season: number, won = false): CareerObjective =>
  ({ raceId, stage: 'trials', season, status: won ? 'won' : 'open', wonAt: won ? clock('07:30') : null })

describe('the season machine', () => {
  const career = testCareer('uma-1', { objectives: [objective('a', 2), objective('b', 2), objective('c', 5)] })

  it('plays Furlong Hand on the first objective\'s course in a season that holds one, Training Yard otherwise', () => {
    expect(seasonStage({ ...career, season: 2 })).toEqual({ game: 'furlong-hand', raceId: 'a' })
    expect(seasonStage({ ...career, season: 3 })).toEqual({ game: 'training-yard', focus: 'guts' })
    expect([0, 1, 2, 3, 4, 5, 11].map(seasonFocus)).toEqual(['speed', 'stamina', 'power', 'guts', 'wit', 'speed', 'stamina'])
    expect(seasonStage({ ...career, season: FINALE_SEASON }, 'finale-race')).toEqual({ game: 'furlong-hand', raceId: 'finale-race' })
    expect(() => seasonStage({ ...career, season: FINALE_SEASON })).toThrow(RangeError)
  })

  it('opens Next season once every objective in the season is won', () => {
    expect(seasonObjectives({ ...career, season: 2 }).map((entry) => entry.raceId)).toEqual(['a', 'b'])
    expect(canAdvance({ ...career, season: 0 })).toBe(true)
    expect(canAdvance({ ...career, season: 2 })).toBe(false)
    const oneWon = { ...career, season: 2, objectives: [objective('a', 2, true), objective('b', 2), objective('c', 5)] }
    expect(canAdvance(oneWon)).toBe(false)
    expect(nextSeason(oneWon)).toMatchObject({ code: 'objectives-open', reason: 'Win this season\'s objective first.' })
    expect(nextSeason({ ...career, season: 2 })).toMatchObject({ reason: 'Win this season\'s 2 objectives first.' })
    const bothWon = { ...oneWon, objectives: [objective('a', 2, true), objective('b', 2, true), objective('c', 5)] }
    expect(canAdvance(bothWon)).toBe(true)
    const moved = nextSeason(bothWon)
    expect(isRefusal(moved) ? null : moved.season).toBe(3)
  })

  it('stops at the Finale and once the career is complete', () => {
    expect(canAdvance({ ...career, season: FINALE_SEASON })).toBe(false)
    expect(nextSeason({ ...career, season: FINALE_SEASON })).toMatchObject({ code: 'at-finale' })
    expect(nextSeason({ ...career, completedAt: clock('09:00') })).toMatchObject({ code: 'career-complete' })
  })
})
