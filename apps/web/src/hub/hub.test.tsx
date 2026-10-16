// @vitest-environment jsdom
// The Hub map (docs/game/11-hub-and-places.md §1, §12) on the dev seeds, with the Phaser game replaced by a recorder:
// the scene is created once with the page's places, follows page changes, pauses under the side panel and every global
// sheet, and is destroyed on leaving the map; a swipe of more than 60 px changes page in the bar's order; and every place
// link sits on the scene's own grid.
import { placesOn, PLAZA_AT } from '@racer/domain/hub'
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { renderG2, seedGame, stubPointerEvents, stubStorage } from '../__fixtures__/testing'
import { LAST_PAGE_KEY } from '../app/start'
import { hubGrid, placeAnchor } from './grid'
import type { HubSceneState } from './scene/HubScene'

const engine = vi.hoisted(() => ({
  created: [] as { page: string; places: number }[],
  updates: [] as string[],
  paused: [] as boolean[],
  destroyed: 0,
}))

vi.mock('./scene/createHubGame', () => ({
  createHubGame: async (_host: HTMLElement, initial: HubSceneState) => {
    engine.created.push({ page: initial.page, places: initial.places.length })
    return {
      update: (next: HubSceneState) => engine.updates.push(next.page),
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

const map = () => document.querySelector<HTMLElement>('[data-g2="page"]')!
function swipe(dx: number, dy = 0) {
  fireEvent.pointerDown(map(), { clientX: 200, clientY: 400 })
  fireEvent.pointerUp(map(), { clientX: 200 + dx, clientY: 400 + dy })
}

describe('the scene (§12)', () => {
  it("is created once with the page's places, follows the page, pauses under the panel and the sheets, and goes with the map", async () => {
    const { where, unmount } = renderG2('/town', seedGame('busy'))
    await waitFor(() => expect(engine.created).toEqual([{ page: 'town', places: 4 }]))
    await waitFor(() => expect(engine.paused.at(-1)).toBe(false))
    // A tab changes the page in place: one engine, told the new page.
    fireEvent.click(screen.getByRole('link', { name: /^Farm/ }))
    await waitFor(() => expect(where()).toBe('/farm'))
    await waitFor(() => expect(engine.updates.at(-1)).toBe('farm'))
    expect(engine.created).toHaveLength(1)
    // The side panel pauses it, and closing resumes it.
    fireEvent.click(screen.getByRole('link', { name: /^Kitchen\./ }))
    await screen.findByRole('dialog', { name: 'Kitchen' })
    await waitFor(() => expect(engine.paused.at(-1)).toBe(true))
    fireEvent.keyDown(window, { key: 'Escape' })
    await waitFor(() => expect(where()).toBe('/farm'))
    await waitFor(() => expect(engine.paused.at(-1)).toBe(false))
    // So does a global sheet: the menu and the check-in here, the featured Uma's below.
    for (const sheet of ['menu', 'check-in']) {
      fireEvent.click(sheet === 'menu' ? screen.getByRole('link', { name: 'Menu: every place' }) : screen.getByRole('link', { name: /^Collect all/ }))
      await waitFor(() => expect(where()).toBe(`/farm?sheet=${sheet}`))
      await screen.findByRole('dialog', { name: sheet === 'menu' ? 'Every place' : 'Check-in' })
      await waitFor(() => expect(engine.paused.at(-1)).toBe(true))
      fireEvent.keyDown(window, { key: 'Escape' })
      await waitFor(() => expect(where()).toBe('/farm'))
      await waitFor(() => expect(engine.paused.at(-1)).toBe(false))
    }
    expect(engine.destroyed).toBe(0)
    unmount()
    expect(engine.destroyed).toBe(1)
  })

  it("starts paused under the featured Uma's sheet, and is destroyed when a place's Page opens", async () => {
    const { where } = renderG2('/town?sheet=featured', seedGame('busy'))
    await waitFor(() => expect(engine.created).toHaveLength(1))
    await screen.findByRole('dialog', { name: 'Featured Uma' })
    await waitFor(() => expect(engine.paused.at(-1)).toBe(true))
    fireEvent.keyDown(window, { key: 'Escape' })
    await waitFor(() => expect(where()).toBe('/town'))
    await waitFor(() => expect(engine.paused.at(-1)).toBe(false))
    fireEvent.click(screen.getByRole('link', { name: /^Stable/ }))
    fireEvent.click(await screen.findByRole('link', { name: 'Enter Stable' }))
    await waitFor(() => expect(where()).toBe('/town/stable'))
    await waitFor(() => expect(engine.destroyed).toBe(1))
  })
})

describe('swipes (§1)', () => {
  it('move one page per swipe of more than 60 px, in the bar order, without wrapping, and remember the page', async () => {
    const { where } = renderG2('/town', seedGame('busy'))
    await screen.findByRole('link', { name: /^Stable/ })
    swipe(80)
    expect(where()).toBe('/town')
    swipe(-60)
    expect(where()).toBe('/town')
    swipe(-80, 70)
    expect(where()).toBe('/town')
    for (const page of ['training', 'racing', 'farm']) {
      swipe(-80)
      await waitFor(() => expect(where()).toBe(`/${page}`))
      await waitFor(() => expect(localStorage.getItem(LAST_PAGE_KEY)).toBe(page))
    }
    swipe(-120)
    expect(where()).toBe('/farm')
    swipe(120)
    await waitFor(() => expect(where()).toBe('/racing'))
  })

  it("don't change page under the side panel or a sheet, and a swipe across a place link isn't a tap on it", async () => {
    const { where } = renderG2('/farm?sheet=menu', seedGame('busy'))
    await screen.findByRole('dialog', { name: 'Every place' })
    swipe(100)
    expect(where()).toBe('/farm?sheet=menu')
    cleanup()
    // On the first page a swipe right goes nowhere, and the click it ends in doesn't open the place either.
    const town = renderG2('/town', seedGame('busy'))
    const stable = await screen.findByRole('link', { name: /^Stable/ })
    fireEvent.pointerDown(stable, { clientX: 120, clientY: 200 })
    fireEvent.pointerUp(stable, { clientX: 200, clientY: 202 })
    fireEvent.click(stable)
    expect(town.where()).toBe('/town')
    expect(screen.queryByRole('dialog', { name: 'Stable' })).toBeNull()
    // A tap is still a tap.
    fireEvent.pointerDown(stable, { clientX: 120, clientY: 200 })
    fireEvent.pointerUp(stable, { clientX: 122, clientY: 201 })
    fireEvent.click(stable)
    await waitFor(() => expect(town.where()).toBe('/town?peek=stable'))
  })
})

describe('place links on the grid (§1)', () => {
  it("stand every link on its building through the scene's grid math, the plaza's too", async () => {
    vi.stubGlobal('devicePixelRatio', 2)
    const width = vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(390)
    const height = vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(642)
    try {
      renderG2('/town', seedGame('busy'))
      await screen.findByRole('link', { name: /^Stable/ })
      const grid = hubGrid(390, 642, 2)
      await waitFor(() => expect(document.querySelector('[data-g2="place-targets"]')?.getAttribute('data-grid')).toBe(`${grid.cols}x${grid.rows}`))
      for (const place of placesOn('town')) {
        const link = document.querySelector<HTMLElement>(`[data-place="${place.id}"]`)!
        const anchor = placeAnchor(place.at!, grid)
        expect([link.style.left, link.style.top, link.style.transform], place.id).toEqual([`${anchor.x}px`, `${anchor.y}px`, 'translate(-50%, -66px)'])
        expect(link.style.width).toBe('112px')
      }
      const plaza = document.querySelector<HTMLElement>('[data-g2="plaza"]')!
      const anchor = placeAnchor(PLAZA_AT, grid)
      expect([plaza.style.left, plaza.style.top]).toEqual([`${anchor.x}px`, `${anchor.y}px`])
      // Reading order is the map's: top row left to right, the plaza, then the bottom row.
      const order = [...document.querySelectorAll<HTMLElement>('[data-place], [data-g2="plaza"]')].map((el) => el.dataset.place ?? 'plaza')
      expect(order).toEqual(['stable', 'card-library', 'plaza', 'warehouse', 'exchange'])
    } finally {
      width.mockRestore()
      height.mockRestore()
    }
  })
})
