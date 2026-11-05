// The Hub's registry, words and view on generation 3 (docs/game/11-hub-and-places.md, D381, D386), and the Card Library's
// effect words (invented values only).
import { describe, expect, it } from 'vitest'
import { card, clock, ENV, opId, uma } from '../__fixtures__/g3'
import { commitOperation } from '../save/commit'
import { initialSave } from '../save/initial'
import type { CareerRecord } from '../save/records'
import { EFFECT_WORDS, effectLines, effectName, effectValue, uniqueEffectLines } from './cards'
import { HUB_PAGES, PLACES, placeById, placeOnPage, placesOn } from './places'
import { careerSeasonLine, hubView, nextObjective } from './view'
import { counterWords, fill, hubWords, tileLabel } from './words'

describe('the registry', () => {
  it('has two pages: Town Hall (Stable, Card Library, hidden Account) and Career (Careers and the two games)', () => {
    expect(HUB_PAGES).toEqual(['town', 'career'])
    expect(placesOn('town').map((place) => place.id)).toEqual(['stable', 'card-library'])
    expect(placesOn('career').map((place) => place.id)).toEqual(['careers', 'training-yard', 'furlong-hand'])
    expect(placeById('account')).toMatchObject({ hidden: true, route: '/town/account', frame: null })
    expect(placeOnPage('career', 'stable')).toBeUndefined()
    expect(new Set(PLACES.map((place) => place.id)).size).toBe(PLACES.length)
  })
})

describe('words', () => {
  it('fills placeholders and names counters', () => {
    expect(fill('{a} and {b}', { a: 1 })).toBe('1 and {b}')
    expect(hubWords('uma-tickets', { n: 3 })).toBe('Uma Tickets 3. Open the Stable.')
    expect(counterWords('card-tickets', 1)).toBe('1 Card Ticket')
    expect(tileLabel(placeById('stable')!, 2)).toBe('Stable. 2 Uma Tickets.')
    expect(tileLabel(placeById('training-yard')!, null)).toBe('Training Yard.')
  })
})

describe('the view', () => {
  it('shows the tickets, each place\'s counter and the owned Umas, newest first', () => {
    let state = initialSave(clock('07:00')).state
    for (const [n, input, name] of [[1, { umaId: uma(1) }, 'unlock-uma'], [2, { umaId: uma(2) }, 'unlock-uma'], [3, { cardId: card(1) }, 'unlock-card']] as const) {
      const commit = commitOperation(state, { id: opId(n), name, input, at: clock(`07:0${n}`) }, ENV)
      if (commit.status !== 'applied') throw new Error(commit.status)
      state = commit.state
    }
    expect(hubView(state)).toEqual({
      wallet: { umaTickets: 18, cardTickets: 23 },
      counts: { stable: 18, 'card-library': 23, careers: 0 },
      owned: [uma(2), uma(1)],
      ownedCards: 1,
      careers: [],
    })
  })

  it('lists the careers in progress, the latest started first, each with her next open objective', () => {
    const base = initialSave(clock('07:00')).state
    const objective = (raceId: string, season: number, status: 'open' | 'won') =>
      ({ raceId, stage: 'trials' as const, season, status, wonAt: status === 'won' ? 1 : null })
    const career = (umaId: string, startedAt: number, season: number, objectives: ReturnType<typeof objective>[], completedAt: number | null = null): CareerRecord => ({
      umaId, T: 1, startedAt, season, objectives, finale: { step: 0, won: false }, deck: [], posts: {},
      pips: { speed: 0, stamina: 0, power: 0, guts: 0, wit: 0 }, camps: [null, null], skills: [], spSpent: 0,
      wallet: { drills: { speed: 0, stamina: 0, power: 0, guts: 0, wit: 0 }, bond: 0, sp: 0 }, completedAt, racingBuild: null,
    })
    const state = {
      ...base,
      careers: {
        [`${uma(1)}:1`]: career(uma(1), 10, 3, [objective('race-b', 7, 'open'), objective('race-a', 2, 'won'), objective('race-c', 5, 'open')]),
        [`${uma(2)}:1`]: career(uma(2), 20, 12, [objective('race-d', 4, 'won')]),
        [`${uma(3)}:1`]: career(uma(3), 30, 12, [], 40),
      },
    }
    const view = hubView(state)
    expect(view.counts.careers).toBe(2)
    expect(view.careers).toEqual([
      { id: `${uma(2)}:1`, umaId: uma(2), T: 1, season: 12, next: null },
      { id: `${uma(1)}:1`, umaId: uma(1), T: 1, season: 3, next: { raceId: 'race-c', stage: 'trials', season: 5 } },
    ])
    expect(nextObjective({ objectives: [] })).toBeNull()
    expect(careerSeasonLine({ T: 1, season: 4 })).toBe('URA Finale · Classic Spring')
    expect(careerSeasonLine({ T: 1, season: 12 })).toBe('URA Finale · Finale')
  })
})

describe("a card's effect words (D386)", () => {
  it('names each effect and reads its value as a percentage or a flat amount, never inventing a value', () => {
    expect(effectName(8)).toBe('Training Effectiveness')
    expect(effectName(3)).toBe('Speed Bonus')
    expect(effectName(99)).toBe('Effect 99')
    expect(effectValue(8, 15)).toBe('15%')
    expect(effectValue(3, 1)).toBe('+1')
    expect(effectValue(99, 2.5)).toBe('+2.5')
    expect(effectLines({ 30: 2, 8: 15, 3: 1, 2: 0 })).toEqual([
      { id: 3, name: 'Speed Bonus', value: '+1' },
      { id: 8, name: 'Training Effectiveness', value: '15%' },
      { id: 30, name: 'Skill Point Bonus', value: '+2' },
    ])
    expect(uniqueEffectLines({ uniqueEffect: { level: 30, description: null, effects: [{ type: 1, value: 10, params: [] }, { type: 101, value: 80, params: [8, 5] }] } }))
      .toEqual([{ id: 1, name: 'Friendship Bonus', value: '10%' }])
    expect(uniqueEffectLines({ uniqueEffect: null })).toEqual([])
    expect(Object.values(EFFECT_WORDS).every((word) => word.name.length > 0)).toBe(true)
  })
})
