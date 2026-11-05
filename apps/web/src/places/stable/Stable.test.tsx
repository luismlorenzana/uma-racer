// @vitest-environment jsdom
// The Stable (docs/game/02-unlocks.md §2, docs/game/11-hub-and-places.md §3.1; T157, D386) at 390 × 844 on invented
// accounts: the Owned and Locked tabs, unlocking an Uma (the ticket spent and the record written, then the reveal), her
// profile's racing builds from a synthetic completed career, her career in progress, and Start career on the invented
// career content.
import { initialSave, careerId, type CareerRecord, type SaveState } from '@racer/domain/save'
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { umaId } from '../../__fixtures__/content'
import { MEMORY_AT, memoryGame } from '../../__fixtures__/memory'
import { renderRacer, stubPointerEvents, stubStorage } from '../../__fixtures__/testing'
import { careerPath, profilePath } from '../../hub/nav'
import { atPhoneSize, FURLONG_ENV, FURLONG_UMA } from '../../stages/__fixtures__/stages'
import { racingBuilds, stableRows, stableTab } from './model'

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

function career(uma: string, patch: Partial<CareerRecord> = {}): CareerRecord {
  return {
    umaId: uma, T: 1, startedAt: MEMORY_AT, season: 0, objectives: [], finale: { step: 0, won: false }, deck: [], posts: {},
    pips: zero, camps: [null, null], skills: [], spSpent: 0, wallet: { drills: zero, bond: 0, sp: 0 }, completedAt: null, racingBuild: null,
    ...patch,
  }
}

/** An account owning the first `n` invented Umas, with the careers given. */
function owning(n: number, careers: Record<string, CareerRecord> = {}, tickets?: number): SaveState {
  const base = initialSave(MEMORY_AT).state
  return {
    ...base,
    account: tickets === undefined ? base.account : { ...base.account, umaTickets: tickets },
    umas: Object.fromEntries(Array.from({ length: n }, (_, i) => [umaId(i + 1), { unlockedAt: MEMORY_AT + i }])),
    careers,
  }
}

const COMPLETED = career(umaId(1), {
  season: 12, finale: { step: 3, won: true }, completedAt: MEMORY_AT + 5,
  racingBuild: {
    stats: { speed: 612, stamina: 455, power: 498, guts: 301, wit: 377 },
    aptitudes: { surface: { turf: 'A', dirt: 'G' }, distance: { sprint: 'C', mile: 'A', medium: 'S', long: 'B' }, strategy: { front: 'D', pace: 'A', late: 'B', end: 'C' } },
    skills: ['invented-skill-1'],
  },
})

describe('the album (T157)', () => {
  it('opens a new account on Locked, every Uma there, and Owned says how to start', async () => {
    renderRacer('/town/stable', memoryGame())
    const locked = await screen.findByRole('tab', { name: 'Locked · 7' })
    expect(locked.getAttribute('aria-selected')).toBe('true')
    await waitFor(() => expect(document.querySelectorAll('[data-uma][data-owned="false"]')).toHaveLength(7))
    expect(screen.getByRole('button', { name: 'Amber Sprint, Locked' })).toBeTruthy()
    fireEvent.click(screen.getByRole('tab', { name: 'Owned · 0' }))
    expect(await screen.findByText('No Umas yet. Each Uma Ticket unlocks one from the Locked tab.')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Unlock your first Umas' }))
    await screen.findByRole('tab', { name: 'Locked · 7', selected: true })
  })

  it('opens on Owned once she owns any, marking her careers, and a face opens her profile', async () => {
    const state = owning(3, { [careerId(umaId(1), 1)]: COMPLETED, [careerId(umaId(2), 1)]: career(umaId(2)) })
    const { where } = renderRacer('/town/stable', memoryGame({ state }))
    expect((await screen.findByRole('tab', { name: 'Owned · 3' })).getAttribute('aria-selected')).toBe('true')
    expect(await screen.findByRole('button', { name: 'Amber Sprint, Career complete' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Bluebell Dash, In a career' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Cinder Gale' }))
    await waitFor(() => expect(where()).toBe(profilePath(umaId(3))))
  })

  it("searches by name with the kit's album chrome, newest release first", async () => {
    renderRacer('/town/stable?tab=locked', memoryGame())
    fireEvent.change(await screen.findByRole('searchbox'), { target: { value: 'gale' } })
    // Cinder Gale (2023) and Gale Ribbon (2027) in the invented content.
    await waitFor(() => expect([...document.querySelectorAll<HTMLElement>('[data-uma]')].map((tile) => tile.dataset.uma)).toEqual([umaId(7), umaId(3)]))
  })
})

describe('unlocking an Uma (T157)', () => {
  it('spends one Uma Ticket, writes her record, then shows her joining with Her profile', async () => {
    const game = memoryGame()
    const { where } = renderRacer('/town/stable', game)
    fireEvent.click(await screen.findByRole('button', { name: 'Bluebell Dash, Locked' }))
    const sheet = await screen.findByRole('dialog', { name: 'Unlock Bluebell Dash?' })
    expect(within(sheet).getByLabelText('Uma Tickets: 20 to 19')).toBeTruthy()
    expect(within(sheet).getByText('Unlocking is final.')).toBeTruthy()
    expect(within(sheet).getByRole('list', { name: 'Distance' })).toBeTruthy()
    expect(within(sheet).getByRole('list', { name: 'Growth rates' })).toBeTruthy()
    fireEvent.click(within(sheet).getByRole('button', { name: 'Unlock · 1 Uma Ticket: Bluebell Dash' }))
    const reveal = await screen.findByRole('dialog', { name: 'Bluebell Dash joins your Stable' })
    expect(game.applied).toEqual(['unlock-uma'])
    const state = game.getSnapshot().state!
    expect(state.account.umaTickets).toBe(19)
    expect(state.umas[umaId(2)]).toEqual({ unlockedAt: MEMORY_AT })
    expect(reveal.querySelector('[data-racer="unlock-reveal"]')).not.toBeNull()
    fireEvent.click(within(reveal).getByRole('button', { name: 'Her profile' }))
    await waitFor(() => expect(where()).toBe(profilePath(umaId(2))))
    expect(await screen.findByRole('button', { name: 'Start career · URA Finale' })).toBeTruthy()
  })

  it('holds the button with no ticket left, and says how to earn one', async () => {
    const game = memoryGame({ state: owning(0, {}, 0) })
    renderRacer('/town/stable', game)
    fireEvent.click(await screen.findByRole('button', { name: 'Amber Sprint, Locked' }))
    const sheet = await screen.findByRole('dialog', { name: 'Unlock Amber Sprint?' })
    expect(within(sheet).getByText('No Uma Tickets left. Completing a career earns one.')).toBeTruthy()
    expect((within(sheet).getByRole('button', { name: 'Unlock · 1 Uma Ticket: Amber Sprint' }) as HTMLButtonElement).disabled).toBe(true)
    expect(game.applied).toEqual([])
  })

  it("unlocks from a locked Uma's profile too", async () => {
    const game = memoryGame()
    renderRacer(profilePath(umaId(4)), game)
    fireEvent.click(await screen.findByRole('button', { name: 'Unlock · 1 Uma Ticket' }))
    const sheet = await screen.findByRole('dialog', { name: 'Unlock Dawn Meadow?' })
    fireEvent.click(within(sheet).getByRole('button', { name: 'Unlock · 1 Uma Ticket: Dawn Meadow' }))
    const reveal = await screen.findByRole('dialog', { name: 'Dawn Meadow joins your Stable' })
    fireEvent.click(within(reveal).getByRole('button', { name: 'Her profile' }))
    expect(await screen.findByRole('button', { name: 'Start career · URA Finale' })).toBeTruthy()
    expect(game.getSnapshot().state!.umas[umaId(4)]).toBeDefined()
  })
})

describe('her profile (T157)', () => {
  it('shows her URA Finale racing build from a completed career: the five stats, aptitudes and skills', async () => {
    renderRacer(profilePath(umaId(1)), memoryGame({ state: owning(1, { [careerId(umaId(1), 1)]: COMPLETED }) }))
    const build = await waitFor(() => {
      const found = document.querySelector<HTMLElement>('[data-racer="racing-build"]')
      expect(found).not.toBeNull()
      return found!
    })
    expect(within(build).getByText('URA Finale')).toBeTruthy()
    expect(within(build).getByLabelText('Speed 612')).toBeTruthy()
    expect(within(build).getByLabelText('Wit 377')).toBeTruthy()
    expect(within(build).getByLabelText('Medium S')).toBeTruthy()
    expect(within(build).getByText('invented-skill-1')).toBeTruthy()
    expect(screen.getByText('Her URA Finale career is complete. More scenarios come in later releases.')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Start career · URA Finale' })).toBeNull()
  })

  it('links her career in progress', async () => {
    const id = careerId(umaId(1), 1)
    renderRacer(profilePath(umaId(1)), memoryGame({ state: owning(1, { [id]: career(umaId(1), { season: 5 }) }) }))
    const panel = await waitFor(() => {
      const found = document.querySelector<HTMLElement>('[data-racer="profile-career"]')
      expect(found).not.toBeNull()
      return found!
    })
    expect(within(panel).getByText('URA Finale · Classic Summer')).toBeTruthy()
    expect(within(panel).getByText('Next: the URA Finals')).toBeTruthy()
    expect(within(panel).getByRole('link', { name: 'Open her career' }).getAttribute('href')).toBe(careerPath(id))
    expect(screen.getByText('Win the URA Finals and her build is frozen here as her racing build.')).toBeTruthy()
  })

  it('starts her URA Finale career, then opens it', async () => {
    const base = initialSave(MEMORY_AT).state
    const game = memoryGame({ env: FURLONG_ENV, state: { ...base, umas: { [FURLONG_UMA]: { unlockedAt: MEMORY_AT } } } })
    const { where } = renderRacer(profilePath(FURLONG_UMA), game)
    fireEvent.click(await screen.findByRole('button', { name: 'Start career · URA Finale' }))
    const id = careerId(FURLONG_UMA, 1)
    await waitFor(() => expect(where()).toBe(careerPath(id)))
    expect(game.applied).toEqual(['start-career'])
    const started = game.getSnapshot().state!.careers[id]!
    expect(started.season).toBe(0)
    expect(started.objectives.length).toBeGreaterThan(0)
    const page = await waitFor(() => {
      const found = document.querySelector<HTMLElement>('[data-racer="career"]')
      expect(found).not.toBeNull()
      return found!
    })
    expect(page.querySelectorAll('[data-objective]')).toHaveLength(started.objectives.length)
    expect(within(page).getByText('URA Finale · Junior Spring')).toBeTruthy()
  })

  it('says so for an Uma the content lacks', async () => {
    renderRacer(profilePath('nobody'), memoryGame())
    expect(await screen.findByText("That Uma isn't in this game's content.")).toBeTruthy()
  })
})

describe('the model', () => {
  it('reads her A-or-better aptitudes as facets, and picks the tab', () => {
    const uma = { ...FURLONG_ENV.content.umas.get(FURLONG_UMA)! }
    const [row] = stableRows([uma], owning(0))
    expect(row!.owned).toBe(false)
    expect(row!.facets.distance).toEqual(['sprint', 'mile', 'medium', 'long'].filter((key) => ['S', 'A'].includes((uma.aptitudes.distance as Record<string, string>)[key]!)))
    expect(stableTab(null, 0)).toBe('locked')
    expect(stableTab(null, 2)).toBe('owned')
    expect(stableTab('locked', 2)).toBe('locked')
    expect(stableTab('nonsense', 0)).toBe('locked')
    expect(racingBuilds(umaId(1), { [careerId(umaId(1), 1)]: COMPLETED, other: career(umaId(1)) }).map((build) => build.scenario)).toEqual(['URA Finale'])
  })
})
