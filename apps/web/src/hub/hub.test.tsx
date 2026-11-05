// @vitest-environment jsdom
// The Hub map (docs/game/11-hub-and-places.md §1, §12; T152) on invented accounts, with uma-kit's Phaser game replaced by a
// recorder: the two pages and their places, the scene created once and following page changes, pausing under the side
// panel and the menu and destroyed on leaving the map; a swipe of more than 60 px changes page in the bar's order; the
// plaza's crowd; and every place link on the scene's own grid.
import { initialSave } from '@racer/domain/save'
import { placesOn, PLAZA_AT } from '@racer/domain/hub'
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { umaId } from '../__fixtures__/content'
import { memoryGame } from '../__fixtures__/memory'
import { renderRacer, stubPointerEvents, stubStorage } from '../__fixtures__/testing'
import { LAST_PAGE_KEY } from '../app/start'
import { hubGrid, placeAnchor } from '@luismlorenzana/uma-kit/hub'

/** What the kit hands its scene (its `HubSceneState`): the page's ground and places. */
interface SceneState {
  readonly ground: { readonly id: string; readonly tiles: string }
  readonly places: readonly { readonly id: string }[]
}

const engine = vi.hoisted(() => ({
  created: [] as { page: string; tiles: string; places: string[] }[],
  updates: [] as { page: string; places: string[] }[],
  paused: [] as boolean[],
  destroyed: 0,
}))

// The kit's lazy game module, which its map imports when it mounts (vite.config.ts runs the kit through Vite in tests).
vi.mock('../../node_modules/@luismlorenzana/uma-kit/dist/hub/scene/createHubGame.js', () => ({
  createHubGame: async (_host: HTMLElement, initial: SceneState) => {
    engine.created.push({ page: initial.ground.id, tiles: initial.ground.tiles, places: initial.places.map((place) => place.id) })
    return {
      update: (next: SceneState) => engine.updates.push({ page: next.ground.id, places: next.places.map((place) => place.id) }),
      setPaused: (paused: boolean) => engine.paused.push(paused),
      destroy: () => { engine.destroyed += 1 },
    }
  },
}))

class Observer {
  observe() {}
  disconnect() {}
}

beforeEach(() => {
  stubStorage()
  stubPointerEvents()
  vi.stubGlobal('ResizeObserver', Observer)
  engine.created = []
  engine.updates = []
  engine.paused = []
  engine.destroyed = 0
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

const map = () => document.querySelector<HTMLElement>('[data-kit="page"]')!
function swipe(dx: number, dy = 0) {
  fireEvent.pointerDown(map(), { clientX: 200, clientY: 400 })
  fireEvent.pointerUp(map(), { clientX: 200 + dx, clientY: 400 + dy })
}

/** An account owning the first `n` invented Umas, unlocked one minute apart. */
function owning(n: number) {
  const state = initialSave(0).state
  return memoryGame({ state: { ...state, umas: Object.fromEntries(Array.from({ length: n }, (_, i) => [umaId(i + 1), { unlockedAt: (i + 1) * 60_000 }])) } })
}

describe('the two pages', () => {
  it('draws Town Hall with the Stable and the Card Library, and Account hidden', async () => {
    renderRacer('/town', memoryGame())
    const town = await screen.findByLabelText('Town Hall map')
    await waitFor(() => expect(engine.created).toEqual([{ page: 'town', tiles: 'town', places: ['stable', 'card-library'] }]))
    const links = within(town).getAllByRole('link').map((link) => link.getAttribute('aria-label'))
    expect(links).toEqual(['Stable. 20 Uma Tickets.', 'Card Library. 24 Card Tickets.'])
    expect(within(town).getByRole('link', { name: /^Stable/ }).getAttribute('href')).toBe('/town?peek=stable')
    expect(document.querySelector('[data-place="account"]')).toBeNull()
  })

  it('draws Career with Careers and the two games on the old Training ground', async () => {
    renderRacer('/career', memoryGame())
    const career = await screen.findByLabelText('Career map')
    await waitFor(() => expect(engine.created).toEqual([{ page: 'career', tiles: 'learning', places: ['careers', 'training-yard', 'furlong-hand'] }]))
    expect(within(career).getAllByRole('link').map((link) => link.getAttribute('aria-label'))).toEqual(['Careers.', 'Training Yard.', 'Furlong Hand.'])
    expect(document.querySelector('[data-kit="plaza"]')).toBeNull()
  })

  it.each([
    ['stable', 'Uma Tickets', '20', '0 of 7'],
    ['card-library', 'Card Tickets', '24', '0 of 7'],
  ] as const)('opens %s: its Peek with the tickets and the owned count, then its Page (T157)', async (id, tickets, held, owned) => {
    const place = placesOn('town').find((each) => each.id === id)!
    const { where } = renderRacer('/town', memoryGame())
    fireEvent.click(await screen.findByRole('link', { name: new RegExp(`^${place.name}\\.`) }))
    await waitFor(() => expect(where()).toBe(`/town?peek=${id}`))
    const panel = await screen.findByRole('dialog', { name: place.name })
    const stats = await waitFor(() => {
      const found = [...panel.querySelectorAll<HTMLElement>('[data-racer="peek-stat"]')]
      expect(found).toHaveLength(2)
      return found
    })
    expect(stats.map((stat) => stat.textContent)).toEqual([`${tickets}${held}`, `Owned${owned}`])
    expect(within(panel).queryByText('Coming soon')).toBeNull()
    fireEvent.click(within(panel).getByRole('link', { name: `Enter ${place.name}` }))
    await waitFor(() => expect(where()).toBe(`/town/${id}`))
    expect(await screen.findByRole('heading', { level: 1, name: place.name })).toBeTruthy()
    // A new account owns nothing, so both open on their Locked tab.
    await waitFor(() => expect(document.querySelector(`[data-place-page="${id}"]`)?.getAttribute('data-tab')).toBe('locked'))
    expect(document.querySelector('[data-racer="unfilled-page"]')).toBeNull()
  })

  it('opens Careers on the Career page: its Peek says how to start one, its Page lists none running (T157)', async () => {
    const { where } = renderRacer('/career?peek=careers', memoryGame())
    const panel = await screen.findByRole('dialog', { name: 'Careers' })
    expect(await within(panel).findByText("No career running. Start one from an Uma's profile in the Stable.")).toBeTruthy()
    fireEvent.click(within(panel).getByRole('link', { name: 'Enter Careers' }))
    await waitFor(() => expect(where()).toBe('/career/careers'))
    expect(await screen.findByRole('heading', { level: 1, name: 'Careers' })).toBeTruthy()
    expect(await screen.findByRole('link', { name: 'Open the Stable' })).toBeTruthy()
    expect(screen.queryByText('Coming soon')).toBeNull()
  })

  it.each([['training-yard', 'Training Yard'], ['furlong-hand', 'Furlong Hand']] as const)('opens %s on the Career page as the game, full screen (T155, T156)', async (id, name) => {
    renderRacer(`/career/${id}`, memoryGame())
    expect(await screen.findByRole('heading', { level: 1, name })).toBeTruthy()
    expect(document.querySelector(`[data-racer="stage-host"][data-stage="${id}"]`)).not.toBeNull()
    expect(screen.queryByText('Coming soon')).toBeNull()
    expect(screen.queryByRole('navigation')).toBeNull()
  })
})

describe('the scene (§12)', () => {
  it('is created once, follows the page, pauses under the panel and the menu, and goes with the map', async () => {
    const { where, unmount } = renderRacer('/town', memoryGame())
    await waitFor(() => expect(engine.created).toHaveLength(1))
    await waitFor(() => expect(engine.paused.at(-1)).toBe(false))
    // A tab changes the page in place: one engine, told the new page.
    const bar = screen.getByRole('navigation', { name: 'Hub pages' })
    fireEvent.click(within(bar).getAllByRole('link', { name: 'Career' }).find((link) => link.getAttribute('href') === '/career')!)
    await waitFor(() => expect(where()).toBe('/career'))
    await waitFor(() => expect(engine.updates.at(-1)?.page).toBe('career'))
    expect(engine.created).toHaveLength(1)
    // The side panel pauses it, and closing resumes it.
    fireEvent.click(screen.getByRole('link', { name: /^Training Yard\./ }))
    await screen.findByRole('dialog', { name: 'Training Yard' })
    await waitFor(() => expect(engine.paused.at(-1)).toBe(true))
    fireEvent.keyDown(window, { key: 'Escape' })
    await waitFor(() => expect(where()).toBe('/career'))
    await waitFor(() => expect(engine.paused.at(-1)).toBe(false))
    // So does the menu.
    fireEvent.click(screen.getByRole('link', { name: 'Menu: every place' }))
    await waitFor(() => expect(where()).toBe('/career?sheet=menu'))
    await screen.findByRole('dialog', { name: 'Every place' })
    await waitFor(() => expect(engine.paused.at(-1)).toBe(true))
    fireEvent.keyDown(window, { key: 'Escape' })
    await waitFor(() => expect(where()).toBe('/career'))
    await waitFor(() => expect(engine.paused.at(-1)).toBe(false))
    expect(engine.destroyed).toBe(0)
    unmount()
    expect(engine.destroyed).toBe(1)
  })
})

describe('swipes (§1)', () => {
  it('move one page per swipe of more than 60 px, in the bar order, without wrapping, and remember the page', async () => {
    const { where } = renderRacer('/town', memoryGame())
    await screen.findByRole('link', { name: /^Stable/ })
    swipe(80)
    expect(where()).toBe('/town')
    swipe(-60)
    expect(where()).toBe('/town')
    swipe(-80, 70)
    expect(where()).toBe('/town')
    swipe(-80)
    await waitFor(() => expect(where()).toBe('/career'))
    await waitFor(() => expect(localStorage.getItem(LAST_PAGE_KEY)).toBe('career'))
    swipe(-120)
    expect(where()).toBe('/career')
    swipe(120)
    await waitFor(() => expect(where()).toBe('/town'))
  })
})

describe('the plaza crowd (§5, SA7)', () => {
  it('stands the owned Umas, newest first, five at most, each a link to her profile', async () => {
    renderRacer('/town', owning(7))
    const figures = await waitFor(() => {
      const all = [...document.querySelectorAll<HTMLElement>('[data-racer="plaza-figure"]')]
      expect(all).toHaveLength(5)
      return all
    })
    expect(figures.map((figure) => figure.dataset.uma)).toEqual([7, 6, 5, 4, 3].map(umaId))
    expect(figures[0]!.getAttribute('aria-label')).toBe('Gale Ribbon: Profile')
    expect(figures[0]!.getAttribute('href')).toBe(`/town/stable/outfit/${umaId(7)}`)
  })

  it('stands nobody on a new account', async () => {
    renderRacer('/town', memoryGame())
    await screen.findByRole('link', { name: /^Stable/ })
    expect(document.querySelectorAll('[data-racer="plaza-figure"]')).toHaveLength(0)
  })
})

describe('place links on the grid (§1)', () => {
  it("stand every link on its building through the scene's grid math, the plaza's too", async () => {
    vi.stubGlobal('devicePixelRatio', 2)
    const width = vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(390)
    const height = vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(642)
    try {
      renderRacer('/town', owning(2))
      await screen.findByRole('link', { name: /^Stable/ })
      const grid = hubGrid(390, 642, 2)
      await waitFor(() => expect(document.querySelector('[data-kit="place-targets"]')?.getAttribute('data-grid')).toBe(`${grid.cols}x${grid.rows}`))
      for (const place of placesOn('town')) {
        const link = document.querySelector<HTMLElement>(`[data-place="${place.id}"]`)!
        const anchor = placeAnchor(place.at!, grid)
        expect([link.style.left, link.style.top], place.id).toEqual([`${anchor.x}px`, `${anchor.y}px`])
      }
      const plaza = document.querySelector<HTMLElement>('[data-kit="plaza"]')!
      const anchor = placeAnchor(PLAZA_AT, grid)
      expect([plaza.style.left, plaza.style.top]).toEqual([`${anchor.x}px`, `${anchor.y}px`])
      // Reading order is the map's: the top row left to right, then the plaza.
      const order = [...document.querySelectorAll<HTMLElement>('[data-place], [data-kit="plaza"]')].map((el) => el.dataset.place ?? 'plaza')
      expect(order).toEqual(['stable', 'card-library', 'plaza'])
    } finally {
      width.mockRestore()
      height.mockRestore()
    }
  })
})
