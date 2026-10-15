// A race's prize (docs/game/09-racing-rewards-and-exchange.md §2.1, §3.3, §4, §9, §11): day, gross, purse, featured
// bonus and pay, in that order, on the profile alone.
import { describe, expect, it } from 'vitest'
import { RACES, days, mulberry32 } from '../__fixtures__/economy'
import { deepFreeze } from '../__fixtures__/tiers'
import { newAccount } from '../tiers/roster'
import { isRefusal, type AccountProfile, type DailyPurse, type Refusal } from '../state/types'
import { featuredBoard, featuredSeed } from './featured'
import { boardDay } from './purse'
import { settleRacePrize, type RacePrizeInput, type RacePrizeResult } from './race-prize'

const NOW = 1_000
const profileWith = (purse: Partial<DailyPurse> = {}, prizeMoney = 0): AccountProfile => {
  const base = newAccount(0).profile
  return { ...base, prizeMoney, purse: { ...base.purse, day: '2026-10-13', ...purse } }
}
const input = (overrides: Partial<RacePrizeInput> = {}): RacePrizeInput => ({
  resultId: 'r1', raceId: 'g1-mile-a', grade: 'g1', place: 1, localDay: '2026-10-13', board: [], ...overrides,
})
const ok = (result: RacePrizeResult | Refusal): RacePrizeResult => {
  if (isRefusal(result)) throw new Error(result.reason)
  return result
}
const boardOf = (profile: AccountProfile, localDay: string): readonly string[] => {
  const day = boardDay(profile.purse, localDay)
  return featuredBoard(day, RACES, mulberry32(featuredSeed(day)))
}

describe('settleRacePrize', () => {
  it('pays a G1 win at 4,400 gross 150 (09 §11), with its ledger row', () => {
    const { profile, prize, ledger } = ok(settleRacePrize(profileWith({ gross: 4_400 }, 40), input(), NOW))
    expect(prize).toEqual({ gross: 300, paid: 150, band: 'tired', dayGross: 4_700, expedition: false, featuredBonus: 0 })
    expect(profile.prizeMoney).toBe(190)
    expect(profile.purse).toEqual({ day: '2026-10-13', gross: 4_700, featuredPaid: [] })
    expect(ledger).toEqual([{ id: 'race:r1:prize', resource: 'prize-money', delta: 150, reason: 'race-prize', at: NOW }])
  })

  it('pays an Expedition win 450, and a second win of the same family on that run 300 (09 §11)', () => {
    const first = ok(settleRacePrize(profileWith(), input({ grade: 'g2', expedition: { familyWon: false } }), NOW))
    expect(first.prize).toEqual({ gross: 450, paid: 450, band: 'full', dayGross: 450, expedition: true, featuredBonus: 0 })
    const again = ok(settleRacePrize(first.profile, input({ resultId: 'r2', grade: 'g2', expedition: { familyWon: true } }), NOW))
    expect(again.prize).toEqual({ gross: 300, paid: 300, band: 'full', dayGross: 750, expedition: false, featuredBonus: 0 })
    expect(again.profile.prizeMoney).toBe(750)
  })

  it('fills the purse with an Expedition race like any race (09 §10)', () => {
    const { profile, prize } = ok(settleRacePrize(profileWith({ gross: 4_300 }), input({ expedition: { familyWon: false } }), NOW))
    expect(prize).toMatchObject({ gross: 450, paid: 200 + 62, band: 'tired', dayGross: 4_750 })
    expect(profile.purse.gross).toBe(4_750)
  })

  it('writes no row for nothing: a 6th place moves no money, but keeps the day', () => {
    const { profile, prize, ledger } = ok(settleRacePrize(profileWith({ day: '2026-10-12', gross: 9_000 }), input({ place: 6 }), NOW))
    expect(prize).toEqual({ gross: 0, paid: 0, band: 'full', dayGross: 0, expedition: false, featuredBonus: 0 })
    expect(ledger).toEqual([])
    expect(profile.purse).toEqual({ day: '2026-10-13', gross: 0, featuredPaid: [] })
  })

  it('pays a spent purse a twentieth: a deep-evening G1 win still pays 15 (09 §3.4)', () => {
    expect(ok(settleRacePrize(profileWith({ gross: 12_000 }), input(), NOW)).prize).toMatchObject({ paid: 15, band: 'spent' })
  })

  it('starts a new purse on a later day and keeps the stored one on an earlier day', () => {
    const tired = profileWith({ day: '2026-10-13', gross: 7_000, featuredPaid: ['g1-mile-a'] })
    expect(ok(settleRacePrize(tired, input({ localDay: '2026-10-14' }), NOW)).profile.purse).toEqual({ day: '2026-10-14', gross: 300, featuredPaid: [] })
    const back = ok(settleRacePrize(tired, input({ localDay: '2026-10-12' }), NOW))
    expect(back.prize.paid).toBe(75)
    expect(back.profile.purse).toEqual({ day: '2026-10-13', gross: 7_300, featuredPaid: ['g1-mile-a'] })
  })

  it('refuses a place that is not a finishing place, and changes nothing', () => {
    const profile = deepFreeze(profileWith())
    expect(settleRacePrize(profile, input({ place: 0 }), NOW)).toMatchObject({ refused: true, code: 'place', data: { place: '0' } })
    expect(() => settleRacePrize(profile, input({ localDay: '2026-02-30' }), NOW)).toThrow(RangeError)
    expect(() => settleRacePrize(profile, input(), 1.5)).toThrow(RangeError)
  })

  it('reads and writes the profile only, never its input', () => {
    const profile = deepFreeze(profileWith({ gross: 5_900, featuredPaid: ['x'] }))
    const race = deepFreeze(input({ board: ['g1-mile-a'] }))
    const first = settleRacePrize(profile, race, NOW)
    expect(settleRacePrize(profile, race, NOW)).toEqual(first)
    expect(Object.keys(ok(first).profile).sort()).toEqual(Object.keys(profile).sort())
  })
})

describe('the featured bonus (09 §4)', () => {
  it('pays the first win of a featured race its win prize again, outside the purse', () => {
    const start = profileWith({ gross: 4_400 })
    const { profile, prize, ledger } = ok(settleRacePrize(start, input({ board: ['g1-mile-a'] }), NOW))
    expect(prize).toEqual({ gross: 300, paid: 150, band: 'tired', dayGross: 4_700, expedition: false, featuredBonus: 300 })
    expect(profile.prizeMoney).toBe(450)
    expect(profile.purse).toEqual({ day: '2026-10-13', gross: 4_700, featuredPaid: ['g1-mile-a'] })
    expect(ledger).toEqual([
      { id: 'race:r1:prize', resource: 'prize-money', delta: 150, reason: 'race-prize', at: NOW },
      { id: 'race:r1:featured', resource: 'prize-money', delta: 300, reason: 'featured-bonus', at: NOW },
    ])
  })

  it('pays once per race per day, by any Uma, and again the next day', () => {
    const board = ['g1-mile-a', 'g3-sprint-a']
    const first = ok(settleRacePrize(profileWith(), input({ board }), NOW))
    const second = ok(settleRacePrize(first.profile, input({ resultId: 'r2', board }), NOW))
    expect([first.prize.featuredBonus, second.prize.featuredBonus]).toEqual([300, 0])
    expect(second.ledger.map((row) => row.id)).toEqual(['race:r2:prize'])
    const g3 = ok(settleRacePrize(second.profile, input({ resultId: 'r3', raceId: 'g3-sprint-a', grade: 'g3', board }), NOW))
    expect(g3.prize.featuredBonus).toBe(150)
    expect(g3.profile.purse.featuredPaid).toEqual(['g1-mile-a', 'g3-sprint-a'])
    const tomorrow = ok(settleRacePrize(g3.profile, input({ resultId: 'r4', localDay: '2026-10-14', board }), NOW))
    expect(tomorrow.prize.featuredBonus).toBe(300)
  })

  it('pays no places, no races off the board and no Expedition race', () => {
    const board = ['g1-mile-a']
    expect(ok(settleRacePrize(profileWith(), input({ board, place: 2 }), NOW)).prize.featuredBonus).toBe(0)
    expect(ok(settleRacePrize(profileWith(), input({ board, raceId: 'g1-long-a' }), NOW)).prize.featuredBonus).toBe(0)
    for (const familyWon of [false, true]) {
      const result = ok(settleRacePrize(profileWith(), input({ board, expedition: { familyWon } }), NOW))
      expect(result.prize.featuredBonus).toBe(0)
      expect(result.profile.purse.featuredPaid).toEqual([])
    }
  })

  it('never fills the purse and never passes 600 a day, whatever is raced, over a year of boards', () => {
    let profile = newAccount(0).profile
    let resultId = 0
    for (const day of days('2026-01-01', 366)) {
      const board = boardOf(profile, day)
      let bonus = 0
      let gross = 0
      // Every featured race won three times, then a G1 field run twice off the board.
      for (const raceId of [...board, ...board, ...board, 'g1-long-a', 'g1-long-a']) {
        const race = RACES.find((entry) => entry.id === raceId)!
        const result = ok(settleRacePrize(profile, { resultId: `r${(resultId += 1)}`, raceId, grade: race.grade, place: 1, localDay: day, board }, NOW))
        bonus += result.prize.featuredBonus
        gross += result.prize.gross
        profile = result.profile
      }
      expect(bonus).toBeLessThanOrEqual(600)
      expect(bonus).toBe(board.reduce((sum, id) => sum + ({ g1: 300, g2: 200, g3: 150, op: 100, 'pre-op': 80 } as Record<string, number>)[RACES.find((r) => r.id === id)!.grade]!, 0))
      expect(profile.purse.gross).toBe(gross)
    }
  })
})
