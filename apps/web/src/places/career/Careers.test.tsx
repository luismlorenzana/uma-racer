// @vitest-environment jsdom
// The Careers place (docs/game/11-hub-and-places.md §3.2; T157, T158, D386, D387) at 390 × 844 on the invented career
// content: the careers in progress (the latest started first, each with where she stands and her next objective) and
// the completed ones; Start a career through the kit's Uma picker (free Umas only) and its one confirm sheet, which
// shows the objectives `start-career` freezes; a career's page with its objectives; and the quick look.
import { careerId, initialSave, type CareerObjective, type CareerRecord, type SaveState } from '@racer/domain/save'
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MEMORY_AT, memoryGame } from '../../__fixtures__/memory'
import { renderRacer, stubPointerEvents, stubStorage } from '../../__fixtures__/testing'
import { careerPath, profilePath } from '../../hub/nav'
import { atPhoneSize, FURLONG_ENV } from '../../stages/__fixtures__/stages'
import { accountState, applied, CAREER, careerGame, UMA } from './__fixtures__/career'

beforeEach(() => {
  stubStorage()
  stubPointerEvents()
  atPhoneSize()
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

const zero = { speed: 0, stamina: 0, power: 0, guts: 0, wit: 0 }
const objective = (raceId: string, season: number, won = false): CareerObjective =>
  ({ raceId, stage: 'main', season, status: won ? 'won' : 'open', wonAt: won ? MEMORY_AT : null })

function career(umaId: string, patch: Partial<CareerRecord>): CareerRecord {
  return {
    umaId, T: 1, startedAt: MEMORY_AT, season: 0, objectives: [], finale: { step: 0, won: false }, deck: [], posts: {},
    pips: zero, camps: [null, null], skills: [], spSpent: 0, wallet: { drills: zero, bond: 0, sp: 0 }, completedAt: null, racingBuild: null,
    ...patch,
  }
}

const FIRST = careerId('sim-uma-0', 1)
const SECOND = careerId('sim-uma-1', 1)
const DONE = careerId('sim-uma-2', 1)

function state(): SaveState {
  const base = initialSave(MEMORY_AT).state
  return {
    ...base,
    umas: Object.fromEntries(['sim-uma-0', 'sim-uma-1', 'sim-uma-2'].map((id) => [id, { unlockedAt: MEMORY_AT }])),
    careers: {
      [FIRST]: career('sim-uma-0', { startedAt: MEMORY_AT + 1, season: 4, objectives: [objective('sim-turf-mile-g3-1', 1, true), objective('sim-turf-mile-g1-5', 4)] }),
      [SECOND]: career('sim-uma-1', { startedAt: MEMORY_AT + 2, season: 12, objectives: [objective('sim-turf-long-g1-3', 10, true)] }),
      [DONE]: career('sim-uma-2', { startedAt: MEMORY_AT, season: 12, completedAt: MEMORY_AT + 3, finale: { step: 3, won: true } }),
    },
  }
}

describe('the Careers place', () => {
  it('lists the careers in progress, the latest started first, then the completed ones', async () => {
    const { where } = renderRacer('/career/careers', memoryGame({ env: FURLONG_ENV, state: state() }))
    const running = await screen.findByRole('region', { name: 'In progress' })
    const rows = within(running).getAllByRole('link')
    expect(rows.map((row) => row.getAttribute('href'))).toEqual([careerPath(SECOND), careerPath(FIRST)])
    // Each row reads her face's initial, her name, where she stands and her next objective.
    expect(rows[0]!.textContent).toMatch(/Sim Uma 1URA Finale · FinaleNext: the URA Finals$/)
    expect(rows[1]!.textContent).toMatch(/Sim Uma 0URA Finale · Classic SpringNext: Sim turf mile G1 5 \(G1\)$/)
    const completed = screen.getByRole('region', { name: 'Completed' })
    expect(within(completed).getByRole('link').getAttribute('href')).toBe(profilePath('sim-uma-2'))
    // Every owned Uma is busy or done: no one to start, so the Stable is a tap away.
    expect(screen.queryByRole('button', { name: 'Start a career' })).toBeNull()
    expect(screen.getByText("Every Uma you own is in a career or has finished hers. Unlock another in the Stable.")).toBeTruthy()
    fireEvent.click(rows[1]!)
    await waitFor(() => expect(where()).toBe(careerPath(FIRST)))
    const page = await waitFor(() => {
      const found = document.querySelector<HTMLElement>('[data-racer="objectives"]')
      expect(found).not.toBeNull()
      return found!
    })
    expect([...page.querySelectorAll<HTMLElement>('[data-objective]')].map((row) => [row.dataset.objective, row.dataset.status]))
      .toEqual([['sim-turf-mile-g3-1', 'won'], ['sim-turf-mile-g1-5', 'open']])
    expect(within(page).getByText('Junior Summer')).toBeTruthy()
  })

  it('sends a new account to the Stable', async () => {
    renderRacer('/career/careers', memoryGame())
    expect(await screen.findByText('No Uma in your Stable yet: unlock one with an Uma Ticket to start her career.')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Open the Stable' }).getAttribute('href')).toBe('/town/stable?tab=locked')
    expect(screen.getByText('No career running.')).toBeTruthy()
    expect(screen.queryByRole('region', { name: 'Completed' })).toBeNull()
  })

  it('starts a career: the picker offers only free Umas, and one sheet shows the objectives she will race', async () => {
    // Sim Uma 0 runs a career already; Sim Uma 1 and 2 are free.
    const game = careerGame(applied(accountState(), 'start-career', { umaId: UMA, T: 1 }))
    const { where } = renderRacer('/career/careers', game)
    fireEvent.click(await screen.findByRole('button', { name: 'Start a career' }))
    const picker = await screen.findByRole('dialog', { name: 'Who runs?' })
    expect(within(picker).queryByRole('button', { name: 'Sim Uma 0' })).toBeNull()
    expect(within(picker).getByRole('button', { name: 'Sim Uma 2' })).toBeTruthy()
    fireEvent.click(within(picker).getByRole('button', { name: 'Sim Uma 1' }))
    const sheet = await screen.findByRole('dialog', { name: 'Sim Uma 1' })
    const objectives = within(sheet).getAllByRole('listitem')
    expect(objectives).toHaveLength(6)
    expect(objectives[0]!.textContent).toMatch(/^G3.+Junior (Spring|Summer|Autumn|Winter)$/)
    fireEvent.click(within(sheet).getByRole('button', { name: 'Start career · URA Finale' }))
    const id = careerId('sim-uma-1', 1)
    await waitFor(() => expect(where()).toBe(careerPath(id)))
    expect(game.applied).toEqual(['start-career'])
    const started = game.getSnapshot().state!.careers[id]!
    // The sheet showed exactly what the operation froze.
    expect(objectives.map((row) => row.dataset.objective)).toEqual(started.objectives.map((each) => each.raceId))
    expect(await screen.findByText('URA Finale · Junior Spring')).toBeTruthy()
    expect(CAREER).toBe(careerId(UMA, 1))
  })

  it("says so for a career that isn't in the save", async () => {
    renderRacer(careerPath('nobody:1'), memoryGame())
    expect(await screen.findByText("That career isn't in your save.")).toBeTruthy()
  })

  it('shows the careers in progress in its quick look, with the count on its header', async () => {
    renderRacer('/career?peek=careers', memoryGame({ env: FURLONG_ENV, state: state() }))
    const panel = await screen.findByRole('dialog', { name: 'Careers' })
    const peek = await waitFor(() => {
      const found = panel.querySelector<HTMLElement>('[data-racer="careers-peek"]')
      expect(found).not.toBeNull()
      return found!
    })
    expect(within(peek).getAllByRole('link').map((row) => row.getAttribute('href'))).toEqual([careerPath(SECOND), careerPath(FIRST)])
    expect(within(peek).getByText('Next: Sim turf mile G1 5 (G1)')).toBeTruthy()
  })
})
