// @vitest-environment jsdom
// The shell (docs/game/11-hub-and-places.md §2, §4, §12; T152) on invented accounts through the in-memory port: the bars
// in uma-kit's frame, the bottom bar's Town Hall, Career, raised Career and Menu, the chips' tickets and links, the Sync
// chip, the side panel and every way it closes, the menu's places, and reduced motion.
import { setReducedMotion as setDeviceReducedMotion } from '@luismlorenzana/uma-kit/ui'
import { placeById, placesOn } from '@racer/domain/hub'
import { act, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { memoryGame } from '../__fixtures__/memory'
import { renderRacer, stubPointerEvents, stubStorage } from '../__fixtures__/testing'
import { REDUCED_MOTION_KEY } from '../app/kit'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})
beforeEach(() => {
  stubStorage()
  stubPointerEvents()
})

const header = async () => (await screen.findAllByRole('banner'))[0]!

describe('the bars (§2.1, §2.2)', () => {
  it("sit in uma-kit's frame, fixed to the screen's edges, with the bottom bar docked over the safe area (T147, D369)", async () => {
    renderRacer('/town', memoryGame())
    const bar = await screen.findByRole('navigation', { name: 'Hub pages' })
    const frame = document.querySelector<HTMLElement>('[data-kit="frame"]')!
    expect(frame.className.split(' ')).toEqual(expect.arrayContaining(['fixed', 'inset-0']))
    expect(frame.className).not.toContain('h-dvh')
    expect(bar.className.split(' ')).toContain('pb-bar-safe')
  })

  it('holds Town Hall, Career, the raised Career to her careers, and Menu', async () => {
    renderRacer('/town', memoryGame())
    const bar = await screen.findByRole('navigation', { name: 'Hub pages' })
    const links = within(bar).getAllByRole('link')
    expect(links.map((link) => [link.getAttribute('aria-label') ?? link.textContent, link.getAttribute('href')])).toEqual([
      ['Town Hall', '/town'], ['Career', '/career'], ['Career', '/career/careers'], ['Menu: every place', '/town?sheet=menu'],
    ])
    expect(links[0]!.getAttribute('aria-current')).toBe('page')
    expect(links[1]!.getAttribute('aria-current')).toBeNull()
  })

  it('marks the raised Career on her careers, and the Career tab elsewhere on its page', async () => {
    renderRacer('/career/careers', memoryGame())
    const bar = await screen.findByRole('navigation', { name: 'Hub pages' })
    const [, page, raised] = within(bar).getAllByRole('link')
    expect([page!.getAttribute('aria-current'), raised!.getAttribute('aria-current')]).toEqual([null, 'page'])
    cleanup()
    renderRacer('/career/furlong-hand', memoryGame())
    const again = await screen.findByRole('navigation', { name: 'Hub pages' })
    const [, tab, centre] = within(again).getAllByRole('link')
    expect([tab!.getAttribute('aria-current'), centre!.getAttribute('aria-current')]).toEqual(['page', null])
  })

  it('shows Uma Tickets and Card Tickets, each a link to the place that spends it, and no other currency', async () => {
    renderRacer('/town', memoryGame())
    const bar = await header()
    const links = within(bar).getAllByRole('link')
    expect(links.map((link) => link.getAttribute('href'))).toEqual(['/town/account', '/town/stable', '/town/card-library'])
    expect(links.map((link) => link.getAttribute('aria-label'))).toEqual([
      'Account: Trainer', 'Uma Tickets 20. Open the Stable.', 'Card Tickets 24. Open the Card Library.',
    ])
    expect(within(bar).queryByText(/Prize Money|Speed Ticket/)).toBeNull()
  })

  it('moves the chips with a tap', async () => {
    const game = memoryGame()
    renderRacer('/town', game)
    await within(await header()).findByRole('link', { name: 'Uma Tickets 20. Open the Stable.' })
    await act(() => game.run('dev-grant', { umaTickets: 3, cardTickets: 1 }))
    await within(await header()).findByRole('link', { name: 'Uma Tickets 23. Open the Stable.' })
    within(await header()).getByRole('link', { name: 'Card Tickets 25. Open the Card Library.' })
  })

  it.each([
    ['offline', 'Offline'], ['paused', 'Sync paused'], ['waiting', 'Sync'], ['failing', 'Sync'],
  ] as const)('shows the %s Sync chip, linking to Account at the sync row', async (sync, text) => {
    renderRacer('/town', memoryGame({ sync }))
    const chip = within(await header()).getAllByRole('link').at(-1)!
    expect(chip.getAttribute('href')).toBe('/town/account?row=sync')
    expect(chip.textContent).toBe(text)
  })
})

describe('the side panel (§1, §4)', () => {
  it('opens on a tap: a modal dialog with its blurb and Enter, which replaces it with the Page', async () => {
    const { where, state } = renderRacer('/career', memoryGame())
    fireEvent.click(await screen.findByRole('link', { name: /^Furlong Hand\./ }))
    await waitFor(() => expect(where()).toBe('/career?peek=furlong-hand'))
    expect(state()).toEqual({ back: true })
    const panel = await screen.findByRole('dialog', { name: 'Furlong Hand' })
    expect(panel.getAttribute('aria-modal')).toBe('true')
    const enter = within(panel).getByRole('link', { name: 'Enter Furlong Hand' })
    expect(enter.getAttribute('href')).toBe('/career/furlong-hand')
    fireEvent.click(within(panel).getByRole('button', { name: 'About Furlong Hand' }))
    expect(within(panel).getAllByText(placeById('furlong-hand')!.blurb).length).toBeGreaterThan(0)
    fireEvent.click(enter)
    await waitFor(() => expect(where()).toBe('/career/furlong-hand'))
    expect(await screen.findByRole('heading', { level: 1, name: 'Furlong Hand' })).toBeTruthy()
    expect(screen.queryByRole('dialog', { name: 'Furlong Hand' })).toBeNull()
  })

  it.each([
    ['its close button', (panel: HTMLElement) => fireEvent.click(within(panel).getByRole('button', { name: 'Close' }))],
    ['Escape', () => fireEvent.keyDown(window, { key: 'Escape' })],
    ['a tap on the dimmed map', (panel: HTMLElement) => fireEvent.click(within(panel).getByRole('button', { name: 'Back to Town Hall' }))],
    ['a swipe right', (panel: HTMLElement) => {
      const side = panel.querySelector<HTMLElement>('[data-kit="side-panel"]')!
      fireEvent.pointerDown(side, { clientX: 120, clientY: 400 })
      fireEvent.pointerUp(side, { clientX: 220, clientY: 410 })
    }],
  ] as const)('closes with %s, back to the page', async (_, close) => {
    const { where } = renderRacer('/town', memoryGame())
    fireEvent.click(await screen.findByRole('link', { name: /^Stable\./ }))
    close(await screen.findByRole('dialog', { name: 'Stable' }))
    await waitFor(() => expect(where()).toBe('/town'))
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('sends a Peek of a place not on the page, or of the hidden Account, back to the page', async () => {
    const { where } = renderRacer('/career?peek=stable', memoryGame())
    await waitFor(() => expect(where()).toBe('/career'))
    cleanup()
    const town = renderRacer('/town?peek=account', memoryGame())
    await waitFor(() => expect(town.where()).toBe('/town'))
  })
})

describe('the menu (§2.2)', () => {
  it('lists every drawn place by page, then Account', async () => {
    renderRacer('/career?sheet=menu', memoryGame())
    const menu = await screen.findByRole('dialog', { name: 'Every place' })
    const names = within(menu).getAllByRole('link').map((link) => link.textContent?.replace(/\d+$/, ''))
    expect(names).toEqual([...placesOn('town'), ...placesOn('career'), placeById('account')!].map((place) => place.name))
    expect(within(menu).getByRole('link', { name: /^Stable/ }).getAttribute('href')).toBe('/town?peek=stable')
    expect(within(menu).getByRole('link', { name: /^Careers/ }).getAttribute('href')).toBe('/career?peek=careers')
    expect(within(menu).getByRole('link', { name: 'Account' }).getAttribute('href')).toBe('/town/account')
  })
})

describe('reduced motion (§12)', () => {
  it('sets the attribute the theme stills motion on when the device switch asks', async () => {
    renderRacer('/town', memoryGame())
    await screen.findByRole('navigation', { name: 'Hub pages' })
    expect(document.documentElement.hasAttribute('data-reduced-motion')).toBe(false)
    act(() => setDeviceReducedMotion(true))
    expect(localStorage.getItem(REDUCED_MOTION_KEY)).toBe('true')
    await waitFor(() => expect(document.documentElement.hasAttribute('data-reduced-motion')).toBe(true))
    act(() => setDeviceReducedMotion(false))
    await waitFor(() => expect(document.documentElement.hasAttribute('data-reduced-motion')).toBe(false))
  })
})
