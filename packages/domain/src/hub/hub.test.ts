// The Hub's registry, words and view on generation 3 (docs/game/11-hub-and-places.md, D381).
import { describe, expect, it } from 'vitest'
import { card, clock, ENV, opId, uma } from '../__fixtures__/g3'
import { commitOperation } from '../save/commit'
import { initialSave } from '../save/initial'
import { HUB_PAGES, PLACES, placeById, placeOnPage, placesOn } from './places'
import { hubView } from './view'
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
    })
  })
})
