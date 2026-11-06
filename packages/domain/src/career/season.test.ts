// The season machine (D383, D391): the games a season offers, main first, when Next season opens, and how the calendar
// moves.
import { describe, expect, it } from 'vitest'
import { testCareer } from '../__fixtures__/build'
import { clock } from '../__fixtures__/g3'
import { isRefusal } from '../save/registry'
import { FINALE_SEASON, type CareerObjective } from '../save/records'
import { registeredStages } from '../stages/registry'
import { CAREER_GAMES, canAdvance, FINALE_GAMES, nextSeason, seasonFocus, seasonGames, seasonObjectives, seasonStages } from './season'

const objective = (raceId: string, season: number, won = false): CareerObjective =>
  ({ raceId, stage: 'trials', season, status: won ? 'won' : 'open', wonAt: won ? clock('07:30') : null })

describe('the season machine', () => {
  const career = testCareer('uma-1', { objectives: [objective('a', 2), objective('b', 2), objective('c', 5)] })

  it('offers both games in every season, Furlong Hand first on its race and Training Yard on the season\'s focus', () => {
    expect(CAREER_GAMES).toEqual(['furlong-hand', 'training-yard'])
    expect(CAREER_GAMES.every((game) => registeredStages().includes(game))).toBe(true)
    for (let season = 0; season < FINALE_SEASON; season += 1) {
      expect(seasonGames(season)).toEqual(CAREER_GAMES)
      expect(seasonStages({ ...career, season }, 'r')).toEqual([{ game: 'furlong-hand', raceId: 'r' }, { game: 'training-yard', focus: seasonFocus(season) }])
    }
    expect(seasonStages({ ...career, season: 3 }, null)[0]).toEqual({ game: 'furlong-hand', raceId: null })
    expect([0, 1, 2, 3, 4, 5, 11].map(seasonFocus)).toEqual(['speed', 'stamina', 'power', 'guts', 'wit', 'speed', 'stamina'])
  })

  it('offers only Furlong Hand at the Finale, on the URA Finals\' course', () => {
    expect(FINALE_GAMES).toEqual(['furlong-hand'])
    expect(seasonStages({ ...career, season: FINALE_SEASON }, 'finale-race')).toEqual([{ game: 'furlong-hand', raceId: 'finale-race' }])
    expect(() => seasonStages({ ...career, season: FINALE_SEASON }, null)).toThrow(RangeError)
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
