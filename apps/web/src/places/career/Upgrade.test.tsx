// @vitest-environment jsdom
// A career's Upgrade (docs/game/11-hub-and-places.md §3.2; T158, D387) at 390 × 844 on the invented career content:
// the Tree's previews equal what buying a pip, a row and a Camp pays; the Deck takes owned cards by era and type, posts
// a card, and re-previews the tree at once; Bonds pours the amount preselected to the next stop and names the next
// hint; Skills sells at the hinted cost, a gold after its white.
import { careerStats, previewPip, previewPips, readDeck, rowLeft } from '@racer/domain/build'
import { STATS, type Stats } from '@racer/domain'
import type { CareerRecord, SaveState } from '@racer/domain/save'
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { renderRacer, stubPointerEvents, stubStorage } from '../../__fixtures__/testing'
import { upgradePath } from '../../hub/nav'
import { atPhoneSize } from '../../stages/__fixtures__/stages'
import { CAREER, CAREER_ENV, careerGame, startedState, STRONG_DECK, UMA } from './__fixtures__/career'
import { trackView } from './model'

beforeEach(() => {
  stubStorage()
  stubPointerEvents()
  atPhoneSize()
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

const flat = (n: number): Stats => ({ speed: n, stamina: n, power: n, guts: n, wit: n })

/** Her career with a deck and a wallet. */
function withWallet(patch: Partial<CareerRecord> = {}, deck: readonly string[] = STRONG_DECK): SaveState {
  const state = startedState(deck)
  const career = state.careers[CAREER]!
  return { ...state, careers: { [CAREER]: { ...career, wallet: { drills: flat(300), bond: 30, sp: 400 }, ...patch } } }
}

const uma = CAREER_ENV.content.umas.get(UMA)!
const viewOf = (state: SaveState) => ({ uma, cards: CAREER_ENV.content.cards, bonds: state.bonds })
/** Her stats as the screen's stat row reads them. */
const shownStats = () => {
  const row = document.querySelector<HTMLElement>('[data-racer="her-stats"]')!
  return Object.fromEntries(STATS.map((stat) => [stat, Number(within(row).getByLabelText(new RegExp(`^${stat[0]!.toUpperCase()}${stat.slice(1)} \\d+$`)).getAttribute('aria-label')!.split(' ')[1])])) as unknown as Stats
}
const gainShown = (line: HTMLElement): Record<string, number> =>
  Object.fromEntries([...line.querySelectorAll<HTMLElement>('[data-gain]')].map((item) => [item.dataset.gain, Number(item.textContent!.replace(/[^\d-]/g, ''))]))

describe('Upgrade: the Tree', () => {
  it('previews each pip and the row exactly, and buying pays the preview', async () => {
    const game = careerGame(withWallet({ wallet: { drills: { ...flat(60), power: 300 }, bond: 0, sp: 0 } }))
    renderRacer(upgradePath(CAREER, 'tree'), game)
    const panel = await screen.findByText((_, node) => node?.getAttribute('data-racer') === 'pip-preview')
    // Power has the most drills: it is preselected.
    expect(panel.dataset.branch).toBe('power')
    expect(screen.getByRole('button', { name: /^Power: level 1, 0 of 20 pips, next pip affordable$/ }).getAttribute('aria-pressed')).toBe('true')
    const before = game.getSnapshot().state!
    const pip = previewPip(before.careers[CAREER]!, viewOf(before), 'power')!
    const next = panel.querySelector<HTMLElement>('[data-racer="next-pip"]')!
    expect(Number(next.dataset.cost)).toBe(pip.cost)
    expect(gainShown(next)).toEqual({
      ...Object.fromEntries(STATS.filter((stat) => pip.gain.stats[stat] !== 0).map((stat) => [stat, pip.gain.stats[stat]])), sp: pip.gain.sp,
    })
    const stats = shownStats()
    fireEvent.click(within(next).getByRole('button'))
    await waitFor(() => expect(game.getSnapshot().state!.careers[CAREER]!.pips.power).toBe(1))
    await waitFor(() => expect(shownStats()).toEqual(Object.fromEntries(STATS.map((stat) => [stat, stats[stat] + pip.gain.stats[stat]]))))
    // The row: the level's other three pips at once, as previewed.
    const mid = game.getSnapshot().state!
    const row = previewPips(mid.careers[CAREER]!, viewOf(mid), 'power', rowLeft(1))!
    const line = await waitFor(() => {
      const found = document.querySelector<HTMLElement>('[data-racer="row-pips"]')
      expect(found?.textContent).toContain('The row: 3 pips')
      return found!
    })
    expect(Number(line.dataset.cost)).toBe(row.cost)
    const after = shownStats()
    fireEvent.click(within(line).getByRole('button'))
    await waitFor(() => expect(game.getSnapshot().state!.careers[CAREER]!.pips.power).toBe(4))
    expect(game.getSnapshot().state!.careers[CAREER]!.wallet.drills.power).toBe(300 - pip.cost - row.cost)
    await waitFor(() => expect(shownStats()).toEqual(Object.fromEntries(STATS.map((stat) => [stat, after[stat] + row.gain.stats[stat]]))))
    expect(careerStats(game.getSnapshot().state!.careers[CAREER]!, viewOf(game.getSnapshot().state!))).toEqual(shownStats())
    expect(game.applied).toEqual(['buy-pips', 'buy-pips'])
  })

  it('says what a pip needs when the drills fall short, and opens the Camps at level 3', async () => {
    const game = careerGame(withWallet({ pips: { ...flat(0), speed: 8 }, wallet: { drills: { ...flat(5), speed: 200 }, bond: 0, sp: 0 } }))
    renderRacer(upgradePath(CAREER, 'tree'), game)
    await screen.findByText((_, node) => node?.getAttribute('data-racer') === 'pip-preview')
    fireEvent.click(screen.getByRole('button', { name: /^Wit: level 1/ }))
    const next = document.querySelector<HTMLElement>('[data-racer="next-pip"]')!
    expect(within(next).getByRole('button').textContent).toMatch(/^Needs \d+ more Wit drills\.$/)
    expect(within(next).getByRole('button').hasAttribute('disabled')).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: /^Speed: level 3, 8 of 20 pips, next pip affordable$/ }))
    const camp = await waitFor(() => {
      const found = document.querySelector<HTMLElement>('[data-racer="camp"]')
      expect(found).not.toBeNull()
      return found!
    })
    fireEvent.click(within(camp).getByRole('button'))
    await waitFor(() => expect(game.getSnapshot().state!.careers[CAREER]!.camps).toEqual(['speed', null]))
  })
})

describe('Upgrade: the Deck', () => {
  it('fills her deck from her owned cards, posts one, and the tree re-previews at once', async () => {
    const game = careerGame(withWallet({}, []))
    renderRacer(upgradePath(CAREER, 'deck'), game)
    const cards = await waitFor(() => {
      const found = document.querySelector<HTMLElement>('[data-racer="deck-cards"]')
      expect(found).not.toBeNull()
      return found!
    })
    // Filter by type: the Stamina icon shows only Stamina cards.
    fireEvent.click(screen.getByRole('button', { name: 'Stamina' }))
    expect([...cards.querySelectorAll<HTMLElement>('[data-card]')].every((card) => card.dataset.card!.startsWith('sim-stamina'))).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: 'Stamina' }))
    for (const id of STRONG_DECK) {
      fireEvent.click(document.querySelector<HTMLElement>(`[data-racer="deck-cards"] [data-card="${id}"]`)!)
      await waitFor(() => expect(game.getSnapshot().state!.careers[CAREER]!.deck).toContain(id))
    }
    expect(game.getSnapshot().state!.careers[CAREER]!.deck).toEqual(STRONG_DECK)
    expect(screen.getByText('Her deck holds six: take one out to add another.')).toBeTruthy()
    // Each card trains at its own type's branch; the Wit pip's preview before moving the Speed card there.
    const speedCard = STRONG_DECK.find((id) => id.startsWith('sim-speed'))!
    const before = game.getSnapshot().state!
    const witBefore = previewPip(before.careers[CAREER]!, viewOf(before), 'wit')!
    fireEvent.click(document.querySelector<HTMLElement>(`[data-deck-card="${speedCard}"]`)!)
    const sheet = await screen.findByRole('dialog', { name: /Sim speed/ })
    expect(within(sheet).getByRole('button', { name: 'Speed, 1 of 5' }).getAttribute('aria-pressed')).toBe('true')
    fireEvent.click(within(sheet).getByRole('button', { name: /^Wit, / }))
    await waitFor(() => expect(game.getSnapshot().state!.careers[CAREER]!.posts[speedCard]).toBe('wit'))
    const after = game.getSnapshot().state!
    const witAfter = previewPip(after.careers[CAREER]!, viewOf(after), 'wit')!
    expect(witAfter.gain).not.toEqual(witBefore.gain)
    fireEvent.click(screen.getByRole('tab', { name: /^Tree/ }))
    fireEvent.click(await screen.findByRole('button', { name: /^Wit: level 1/ }))
    const next = document.querySelector<HTMLElement>('[data-racer="next-pip"]')!
    expect(gainShown(next).wit).toBe(witAfter.gain.stats.wit)
    expect(game.applied).toEqual([...STRONG_DECK.map(() => 'set-deck'), 'post-card'])
  })
})

describe('Upgrade: Bonds and Skills', () => {
  it('pours the Bond that reaches the next stop, and names the hint it brings', async () => {
    const game = careerGame(withWallet())
    renderRacer(upgradePath(CAREER, 'bonds'), game)
    const first = STRONG_DECK[0]!
    const row = await waitFor(() => {
      const found = document.querySelector<HTMLElement>(`[data-bond-card="${first}"]`)
      expect(found).not.toBeNull()
      return found!
    })
    const state = game.getSnapshot().state!
    const track = trackView(state.careers[CAREER]!, state, CAREER_ENV.content.cards, first)!
    expect(track.next?.kind).toBe('hint')
    expect(within(row).getByText(/^Next: hint · Sim skill sim-skill-\w+-1 at \d+$/)).toBeTruthy()
    expect(within(row).getByRole('meter').getAttribute('aria-valuenow')).toBe(String(track.value))
    const pour = within(row).getByRole('button', { name: `Pour ${track.toNext}` })
    fireEvent.click(pour)
    await waitFor(() => expect(game.getSnapshot().state!.careers[CAREER]!.wallet.bond).toBe(30 - track.toNext))
    const poured = game.getSnapshot().state!
    expect(readDeck(poured.careers[CAREER]!, viewOf(poured)).posted.find((card) => card.id === first)!.bond).toBe(track.next!.at)
    await waitFor(() => expect(within(row).getByText(/^Next: hint · Sim skill sim-skill-\w+-2 at \d+$/)).toBeTruthy())
  })

  it('sells her skills at their hinted cost, a gold only after its white, within the SP cap', async () => {
    const game = careerGame(withWallet())
    renderRacer(upgradePath(CAREER, 'skills'), game)
    const white = await waitFor(() => {
      const found = document.querySelector<HTMLElement>('[data-skill="sim-awake-w-0"]')
      expect(found).not.toBeNull()
      return found!
    })
    const gold = document.querySelector<HTMLElement>('[data-skill="sim-awake-g-0"]')!
    expect(white.dataset.cost).toBe('150')
    expect(within(gold).getByText('Buy Sim skill sim-awake-w-0 first: Sim skill sim-awake-g-0 builds on it.')).toBeTruthy()
    expect(within(gold).getByRole('button', { name: /^Buy Sim skill sim-awake-g-0/ }).hasAttribute('disabled')).toBe(true)
    expect(screen.getByText('2,000 of the 2,000 SP cap left')).toBeTruthy()
    fireEvent.click(within(white).getByRole('button', { name: 'Buy Sim skill sim-awake-w-0, 150 SP' }))
    await waitFor(() => expect(game.getSnapshot().state!.careers[CAREER]!.skills).toEqual(['sim-awake-w-0']))
    expect(screen.getByText('1,850 of the 2,000 SP cap left')).toBeTruthy()
    const bought = screen.getByRole('region', { name: 'Bought' })
    expect(within(bought).getByText('Sim skill sim-awake-w-0')).toBeTruthy()
    await waitFor(() => expect(within(document.querySelector<HTMLElement>('[data-skill="sim-awake-g-0"]')!).getByRole('button').hasAttribute('disabled')).toBe(false))
  })
})
