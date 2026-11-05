// @vitest-environment jsdom
// The Card Library (docs/game/02-unlocks.md §3, docs/game/11-hub-and-places.md §3.1; T157, D386) at 390 × 844 on
// invented cards with invented values (no real card number is in git): the Owned and Locked tabs, the type and focus
// icons and the search, newest release first; a card's page with its effects at level 50 in plain words, its unique
// effect, its skills, its era and its power; and unlocking a card (the ticket spent and the record written).
import type { SkillTemplate, SupportCardTemplate } from '@racer/domain'
import { cardPower } from '@racer/domain/build'
import { buildOperationEnv, initialSave, type SaveState } from '@racer/domain/save'
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cardId } from '../../__fixtures__/content'
import { MEMORY_AT, memoryGame } from '../../__fixtures__/memory'
import { renderRacer, stubPointerEvents, stubStorage } from '../../__fixtures__/testing'
import { cardPath } from '../../hub/nav'
import { atPhoneSize } from '../../stages/__fixtures__/stages'
import { eraReading, libraryResult, libraryRows, powerReading, readFilters } from './model'

beforeEach(() => {
  stubStorage()
  stubPointerEvents()
  atPhoneSize()
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

const NAMES = ['Amber Sprint', 'Bluebell Dash', 'Cinder Gale', 'Dawn Meadow', 'Ember Flight']

function card(n: number, patch: Partial<SupportCardTemplate>): SupportCardTemplate {
  return {
    id: cardId(n), charaId: `invented-chara-${n}`, charName: NAMES[n - 1]!, title: `Invented Title ${n}`, type: 'speed',
    jpRelease: '2021-03-01', era: 1, obtain: 'gacha', starter: false, hintSkillIds: [], hintOthers: [], eventSkillIds: [],
    effects: {}, uniqueEffect: null, ...patch,
  }
}

const skill = (id: string, name: string, kind: SkillTemplate['kind']): SkillTemplate => ({
  id, kind, name, description: '', costSp: 120, iconId: null, activation: 1, conditions: [], inheritedSkillId: null, normalSkillId: null,
})

/** Invented cards and invented values. */
const CARDS: readonly SupportCardTemplate[] = [
  card(1, {
    type: 'speed', jpRelease: '2021-03-01', focus: { style: 'front' },
    effects: { 30: 2, 8: 15, 3: 1, 14: 25, 1: 20 },
    uniqueEffect: { level: 30, description: 'Invented: trains harder once the bond is strong.', effects: [{ type: 101, value: 80, params: [8, 5] }] },
    hintSkillIds: ['invented-hint-1', 'invented-hint-2'], eventSkillIds: ['invented-gold-1'],
  }),
  card(2, { type: 'stamina', jpRelease: '2022-05-01', era: 3, focus: { distance: 'long' }, effects: { 8: 10 }, uniqueEffect: { level: 30, description: null, effects: [{ type: 1, value: 10, params: [] }] } }),
  card(3, { type: 'speed', jpRelease: '2021-09-01', effects: { 8: 5 } }),
  card(4, { type: 'friend', jpRelease: '2023-01-01', effects: { 1: 10 } }),
  card(5, { type: 'wit', jpRelease: '2021-06-01', effects: { 8: 8 } }),
]
const SKILLS = [skill('invented-hint-1', 'Invented Corner', 'white'), skill('invented-hint-2', 'Invented Straight', 'white'), skill('invented-gold-1', 'Invented Gold', 'gold')]
const ENV = buildOperationEnv({ umas: [], races: [], courses: [], cards: CARDS, skills: SKILLS, contentVersion: 'library-test' })

function account(owned: readonly number[] = [], tickets?: number): SaveState {
  const base = initialSave(MEMORY_AT).state
  return {
    ...base,
    account: tickets === undefined ? base.account : { ...base.account, cardTickets: tickets },
    cards: Object.fromEntries(owned.map((n) => [cardId(n), { unlockedAt: MEMORY_AT }])),
  }
}

const tiles = () => [...document.querySelectorAll<HTMLElement>('[data-card][data-owned]')].map((tile) => tile.dataset.card)

describe('the album (T157)', () => {
  it('opens a new account on Locked, newest release first, and filters by type, focus and search', async () => {
    renderRacer('/town/card-library', memoryGame({ env: ENV }))
    expect((await screen.findByRole('tab', { name: 'Locked · 5' })).getAttribute('aria-selected')).toBe('true')
    await waitFor(() => expect(tiles()).toEqual([4, 2, 3, 5, 1].map(cardId)))
    const types = screen.getByRole('group', { name: 'Card type' })
    fireEvent.click(within(types).getByRole('button', { name: 'Speed' }))
    await waitFor(() => expect(tiles()).toEqual([3, 1].map(cardId)))
    expect(within(types).getByRole('button', { name: 'Speed' }).getAttribute('aria-pressed')).toBe('true')
    fireEvent.click(within(types).getByRole('button', { name: 'Speed' }))
    await waitFor(() => expect(tiles()).toHaveLength(5))
    const focus = screen.getByRole('group', { name: 'Focus' })
    fireEvent.click(within(focus).getByRole('button', { name: 'Front Runner' }))
    await waitFor(() => expect(tiles()).toEqual([cardId(1)]))
    fireEvent.click(within(focus).getByRole('button', { name: 'Long' }))
    await waitFor(() => expect(tiles()).toEqual([]))
    expect(screen.getByText('No card matches these filters.')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }))
    await waitFor(() => expect(tiles()).toHaveLength(5))
    fireEvent.change(screen.getByRole('searchbox', { name: 'Search cards' }), { target: { value: 'dawn' } })
    await waitFor(() => expect(tiles()).toEqual([cardId(4)]))
  })

  it('opens on Owned once any card is, and a card opens its page', async () => {
    const { where } = renderRacer('/town/card-library', memoryGame({ env: ENV, state: account([1, 3]) }))
    expect((await screen.findByRole('tab', { name: 'Owned · 2' })).getAttribute('aria-selected')).toBe('true')
    await waitFor(() => expect(tiles()).toEqual([3, 1].map(cardId)))
    fireEvent.click(screen.getByRole('link', { name: 'Amber Sprint [Invented Title 1]' }))
    await waitFor(() => expect(where()).toBe(cardPath(cardId(1))))
  })
})

describe("a card's page (T157)", () => {
  it('names its real effects at level 50, its unique effect, its skills, its era and its power', async () => {
    renderRacer(cardPath(cardId(1)), memoryGame({ env: ENV, state: account([1]) }))
    const effects = await screen.findByRole('list', { name: 'Effects at level 50' })
    const lines = within(effects).getAllByRole('listitem').map((item) => item.textContent)
    expect(lines).toEqual(['Friendship Bonus20%', 'Speed Bonus+1', 'Training Effectiveness15%', 'Initial Friendship Gauge+25', 'Skill Point Bonus+2'])
    expect(screen.getByText('Invented: trains harder once the bond is strong.')).toBeTruthy()
    const hints = screen.getByRole('region', { name: 'Hint skills' })
    expect(within(hints).getByText('Invented Corner')).toBeTruthy()
    expect(within(hints).getByText('Invented Straight')).toBeTruthy()
    const events = screen.getByRole('region', { name: 'Event skills' })
    expect(within(events).getByText('Invented Gold')).toBeTruthy()
    expect(within(events).getByRole('img', { name: 'Gold' })).toBeTruthy()
    expect(screen.getByText('First usable in URA Finale')).toBeTruthy()
    expect(screen.getByText('Usable in URA Finale careers.')).toBeTruthy()
    expect(screen.getByRole('img', { name: 'Running style focus: Front Runner' })).toBeTruthy()
    const reading = powerReading(CARDS[0]!, ENV.content.cards)
    expect(reading.median).toBe((cardPower(CARDS[0]!) + cardPower(CARDS[2]!)) / 2)
    expect(screen.getByText(new RegExp(`· Speed median ${reading.median}`))).toBeTruthy()
    expect(document.querySelector('[data-racer="card-unlock"]')).toBeNull()
  })

  it("shows a later era's card as not usable here, and a unique effect without a description by its terms", async () => {
    renderRacer(cardPath(cardId(2)), memoryGame({ env: ENV }))
    expect(await screen.findByText('First usable in Trackblazer')).toBeTruthy()
    expect(screen.getByText('Not usable in URA Finale careers.')).toBeTruthy()
    const unique = screen.getByRole('list', { name: 'Unique effect' })
    expect(within(unique).getByRole('listitem').textContent).toBe('Friendship Bonus10%')
  })

  it('unlocks with one Card Ticket: the ticket spent, the record written, and the card in the Library', async () => {
    const game = memoryGame({ env: ENV })
    renderRacer(cardPath(cardId(5)), game)
    expect(await screen.findByLabelText('Card Tickets: 24 to 23')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Unlock · 1 Card Ticket' }))
    expect(await screen.findByRole('status')).toHaveProperty('textContent', 'In your Library')
    expect(game.applied).toEqual(['unlock-card'])
    const state = game.getSnapshot().state!
    expect(state.account.cardTickets).toBe(23)
    expect(state.cards[cardId(5)]).toEqual({ unlockedAt: MEMORY_AT })
    expect(document.querySelector('[data-racer="card-unlock"]')).toBeNull()
  })

  it('holds the button with no Card Ticket left', async () => {
    const game = memoryGame({ env: ENV, state: account([], 0) })
    renderRacer(cardPath(cardId(5)), game)
    expect(await screen.findByText('No Card Tickets left. Winning an objective earns one.')).toBeTruthy()
    expect((screen.getByRole('button', { name: 'Unlock · 1 Card Ticket' }) as HTMLButtonElement).disabled).toBe(true)
    expect(game.applied).toEqual([])
  })

  it('says so for a card the content lacks', async () => {
    renderRacer(cardPath('nothing'), memoryGame({ env: ENV }))
    expect(await screen.findByText("That card isn't in this game's content.")).toBeTruthy()
  })
})

describe('the model', () => {
  it('filters, sorts newest first, reads the URL and the era', () => {
    const rows = libraryRows(CARDS, ENV.content.skills, { [cardId(4)]: { unlockedAt: 1 } })
    expect(libraryResult(rows, 'locked', readFilters(new URLSearchParams())).map((row) => row.id)).toEqual([2, 3, 5, 1].map(cardId))
    expect(libraryResult(rows, 'owned', readFilters(new URLSearchParams())).map((row) => row.id)).toEqual([cardId(4)])
    expect(libraryResult(rows, 'locked', readFilters(new URLSearchParams('type=speed&style=front'))).map((row) => row.id)).toEqual([cardId(1)])
    expect(readFilters(new URLSearchParams('type=nonsense&style=end&distance=x&q=a'))).toEqual({ type: null, style: 'end', distance: null, search: 'a' })
    expect(eraReading(1)).toEqual({ scenario: 'URA Finale', open: true })
    expect(eraReading(2)).toEqual({ scenario: 'Unity Cup', open: false })
    const friend = powerReading(CARDS[3]!, ENV.content.cards)
    expect(friend).toEqual({ power: cardPower(CARDS[3]!), median: cardPower(CARDS[3]!), max: cardPower(CARDS[3]!) })
  })
})
