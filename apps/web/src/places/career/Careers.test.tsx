// @vitest-environment jsdom
// The Careers place's shell (docs/game/11-hub-and-places.md §3.2; T157, D386) at 390 × 844 on the invented career
// content: the careers in progress (the latest started first, each with where she stands and her next objective) and the
// completed ones, a career's page with its objectives, and the quick look. T158 builds the season screens on it.
import { careerId, initialSave, type CareerObjective, type CareerRecord, type SaveState } from '@racer/domain/save'
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MEMORY_AT, memoryGame } from '../../__fixtures__/memory'
import { renderRacer, stubPointerEvents, stubStorage } from '../../__fixtures__/testing'
import { careerPath, profilePath } from '../../hub/nav'
import { atPhoneSize, FURLONG_ENV } from '../../stages/__fixtures__/stages'

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

describe('the Careers place (T157)', () => {
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
    fireEvent.click(rows[1]!)
    await waitFor(() => expect(where()).toBe(careerPath(FIRST)))
    const page = await waitFor(() => {
      const found = document.querySelector<HTMLElement>('[data-racer="career"]')
      expect(found).not.toBeNull()
      return found!
    })
    expect([...page.querySelectorAll<HTMLElement>('[data-objective]')].map((row) => [row.dataset.objective, row.dataset.status]))
      .toEqual([['sim-turf-mile-g3-1', 'won'], ['sim-turf-mile-g1-5', 'open']])
    expect(within(page).getByText('Junior Summer')).toBeTruthy()
    expect(within(page).getByText('The season screens are coming next.')).toBeTruthy()
  })

  it('sends a new account to the Stable to start one', async () => {
    renderRacer('/career/careers', memoryGame())
    expect(await screen.findByText("No career running. Start one from an Uma's profile in the Stable.")).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Open the Stable' }).getAttribute('href')).toBe('/town/stable?tab=owned')
    expect(screen.queryByRole('region', { name: 'Completed' })).toBeNull()
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
