// @vitest-environment jsdom
// A career's page (docs/game/11-hub-and-places.md §3.2; T158, D387) at 390 × 844 on the invented career content: the
// calendar strip, the wallet, the season card's three steps with their states (Play's game and Resume or Played,
// Upgrade's badge, Race's objectives), Next season, Play again in the header, the URA Finals' card with its rounds one
// at a time, and a completed career's frozen build.
import { deriveRacingBuild } from '@racer/domain/build'
import { FINALE_SEASON, type SaveState } from '@racer/domain/save'
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MEMORY_AT } from '../../__fixtures__/memory'
import { renderRacer, stubPointerEvents, stubStorage } from '../../__fixtures__/testing'
import { careerPath, playPath, upgradePath } from '../../hub/nav'
import { journalId } from '../../stages/ids'
import { atPhoneSize } from '../../stages/__fixtures__/stages'
import { applied, CAREER, CAREER_ENV, careerGame, oneMoveLeft, startedState, STRONG_DECK, UMA } from './__fixtures__/career'
import { recordPlay } from './plays'

beforeEach(() => {
  stubStorage()
  stubPointerEvents()
  atPhoneSize()
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

const page = () => waitFor(() => {
  const found = document.querySelector<HTMLElement>('[data-racer="career"] [data-racer="season-card"], [data-racer="career"] [data-racer="finale-card"], [data-racer="career"] [data-racer="completion"]')
  expect(found).not.toBeNull()
  return found!
})
const step = (name: string) => document.querySelector<HTMLElement>(`[data-step="${name}"]`)!

/** Her career with every objective before `season` won and the calendar moved there. */
function atSeason(season: number, deck: readonly string[] = []): SaveState {
  let state = startedState(deck)
  const career = state.careers[CAREER]!
  state = { ...state, careers: { ...state.careers, [CAREER]: {
    ...career, season,
    objectives: career.objectives.map((objective) => objective.season < season ? { ...objective, status: 'won' as const, wonAt: MEMORY_AT } : objective),
  } } }
  return state
}

describe('a career\'s page', () => {
  it('draws the calendar strip: the season now raised, the ones behind done, each objective marked on its season', async () => {
    const state = atSeason(4)
    renderRacer(careerPath(CAREER), careerGame(state))
    await page()
    const strip = screen.getByRole('region', { name: 'The calendar' })
    const cells = within(strip).getAllByRole('listitem')
    expect(cells).toHaveLength(13)
    expect(cells.map((cell) => cell.dataset.state)).toEqual([...Array(4).fill('done'), 'now', ...Array(8).fill('ahead')])
    expect(cells[4]!.getAttribute('aria-current')).toBe('step')
    const career = state.careers[CAREER]!
    for (const objective of career.objectives) {
      const cell = cells[objective.season]!
      expect(cell.querySelector(`[data-objective-mark="${objective.raceId}"]`)).not.toBeNull()
      expect(cell.getAttribute('aria-label')).toContain(objective.status === 'won' ? 'won' : 'open')
    }
    expect(cells[12]!.getAttribute('aria-label')).toBe('Finale, ahead')
    // The wallet: drills by colour, Bond and SP, as icons with numbers.
    const wallet = screen.getByRole('list', { name: 'Wallet' })
    expect(within(wallet).getAllByRole('listitem').map((item) => item.getAttribute('aria-label')))
      .toEqual(['Speed drills 0', 'Stamina drills 0', 'Power drills 0', 'Guts drills 0', 'Wit drills 0', 'Bond 0', 'SP to spend 0'])
  })

  it('leads a racing season: Play its prep heat, Upgrade with a badge, Race its objective, and Next season once won', async () => {
    const game = careerGame(startedState())
    renderRacer(careerPath(CAREER), game)
    const card = await page()
    const career = game.getSnapshot().state!.careers[CAREER]!
    const first = career.objectives[0]!
    expect(first.season).toBe(0)
    const race = CAREER_ENV.content.races.find((each) => each.id === first.raceId)!
    expect(within(card).getByRole('heading', { level: 2 }).textContent).toBe('Junior SpringSeason 1 of 12')
    const play = step('play')
    expect(play.getAttribute('href')).toBe(playPath(CAREER, 'furlong-hand'))
    expect(play.dataset.state).toBe('next')
    expect(play.textContent).toContain(`Furlong Hand · ${race.name}`)
    // No deck yet: six slots to fill, so Upgrade opens on the Deck.
    const upgrade = step('upgrade')
    expect(upgrade.querySelector('[data-racer="upgrade-badge"]')?.textContent).toBe('6')
    expect(upgrade.getAttribute('href')).toBe(upgradePath(CAREER, 'deck'))
    expect(within(step('race')).getByRole('button', { name: `Race the ${race.name}` })).toBeTruthy()
    const next = screen.getByRole('button', { name: 'Next season' })
    expect(next.hasAttribute('disabled')).toBe(true)
    expect(screen.getByText('Win this season\'s races to move on.')).toBeTruthy()
    // Play again: both games from the header.
    const again = screen.getByRole('group', { name: 'Play again' })
    expect(within(again).getAllByRole('link').map((link) => link.getAttribute('href')))
      .toEqual([playPath(CAREER, 'training-yard'), playPath(CAREER, 'furlong-hand')])
  })

  it('checks Play once played this season, marks a play left open Resume, and lights Race next', async () => {
    const game = careerGame(startedState())
    const { journal } = oneMoveLeft('furlong-hand', game.getSnapshot().state!)
    await game.journal.write({ id: journalId('furlong-hand', CAREER, 'career'), careerId: CAREER, journal })
    renderRacer(careerPath(CAREER), game)
    await page()
    await waitFor(() => expect(step('play').textContent).toContain('Resume'))
    await game.journal.clear(journalId('furlong-hand', CAREER, 'career'))
    cleanup()
    recordPlay({ careerId: CAREER, kind: 'furlong-hand', season: 0, grade: 'B', practice: false })
    recordPlay({ careerId: CAREER, kind: 'furlong-hand', season: 0, grade: 'A', practice: false })
    recordPlay({ careerId: CAREER, kind: 'furlong-hand', season: 0, grade: 'C', practice: false })
    renderRacer(careerPath(CAREER), game)
    await page()
    expect(step('play').dataset.state).toBe('done')
    expect(step('play').textContent).toContain('Played · A')
    expect(step('race').dataset.state).toBe('next')
  })

  it('ends a season without a race at once: Training Yard on its focus, then Next season moves the calendar', async () => {
    const game = careerGame(applied(atSeason(1), 'set-deck', { careerId: CAREER, deck: STRONG_DECK }))
    renderRacer(careerPath(CAREER), game)
    await page()
    expect(step('play').getAttribute('href')).toBe(playPath(CAREER, 'training-yard'))
    expect(step('play').textContent).toContain('Training Yard · Stamina focus')
    expect(step('race').textContent).toContain('No race this season.')
    const next = screen.getByRole('button', { name: 'Next season' })
    expect(next.hasAttribute('disabled')).toBe(false)
    fireEvent.click(next)
    await waitFor(() => expect(game.getSnapshot().state!.careers[CAREER]!.season).toBe(2))
    expect(game.applied).toEqual(['next-season'])
    expect(await screen.findByText('Junior Autumn', { selector: 'h2 *, h2' })).toBeTruthy()
  })

  it('runs the URA Finals one round at a time after Senior Winter', async () => {
    const state = atSeason(FINALE_SEASON)
    const career = state.careers[CAREER]!
    renderRacer(careerPath(CAREER), careerGame({ ...state, careers: { [CAREER]: { ...career, finale: { step: 1, won: false } } } }))
    const card = await page()
    expect(card.dataset.racer).toBe('finale-card')
    expect(step('play').getAttribute('href')).toBe(playPath(CAREER, 'furlong-hand'))
    const rounds = [...card.querySelectorAll<HTMLElement>('[data-round]')]
    expect(rounds.map((row) => [row.dataset.round, row.dataset.status])).toEqual([['0', 'won'], ['1', 'open'], ['2', 'locked']])
    expect(rounds.map((row) => row.textContent)).toEqual([
      expect.stringMatching(/^G2URA Finals QualifierWon$/), expect.stringMatching(/^G1URA Finals SemifinalRace$/), expect.stringMatching(/^G1\+URA Finals Final$/),
    ])
    expect(within(card).getAllByRole('button', { name: /^Race the / })).toHaveLength(1)
    expect(screen.queryByRole('button', { name: 'Next season' })).toBeNull()
  })

  it('shows a completed career\'s frozen racing build, the tickets the Finals paid, and what comes next', async () => {
    const state = atSeason(FINALE_SEASON, STRONG_DECK)
    const career = state.careers[CAREER]!
    const build = deriveRacingBuild(career, CAREER_ENV.content.umas.get(UMA)!, CAREER_ENV.content.cards, {})
    renderRacer(careerPath(CAREER), careerGame({ ...state, careers: { [CAREER]: { ...career, finale: { step: 3, won: true }, completedAt: MEMORY_AT, racingBuild: build } } }))
    const done = await page()
    expect(done.dataset.racer).toBe('completion')
    expect(within(done).getByText('URA Finale complete')).toBeTruthy()
    expect(within(done).getByLabelText(`Speed ${build.stats.speed}`)).toBeTruthy()
    expect(within(done).getByText('+1 Uma Ticket')).toBeTruthy()
    expect(within(done).getByText('+2 Card Tickets')).toBeTruthy()
    expect(within(done).getByText('Next: Unity Cup, coming in release 2')).toBeTruthy()
    expect(screen.queryByRole('list', { name: 'Wallet' })).toBeNull()
    expect(screen.getAllByRole('listitem').filter((cell) => cell.dataset.state !== undefined).every((cell) => cell.dataset.state === 'done')).toBe(true)
  })
})
