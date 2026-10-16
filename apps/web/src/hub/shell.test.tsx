// @vitest-environment jsdom
// The shell (docs/game/11-hub-and-places.md §2, §4, §12) on the dev seeds through the in-memory port: the pill's
// three states, the tab badges, the chips' links, a place link's VoiceOver line, the side panel (its Peek, Enter, and
// every way it closes), the direct Racecourse, the menu's places, the plaza, full-screen flows, and reduced motion.
import { setReducedMotion as setDeviceReducedMotion } from '@luismlorenzana/uma-kit/ui'
import { REDUCED_MOTION_KEY } from '../app/kit'
import { hubView, hubWords, placesOn, tileLabel, placeById } from '@racer/domain/hub'
import { act, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { renderG2, seed, seedGame, stubPointerEvents, stubStorage } from '../__fixtures__/testing'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})
beforeEach(() => {
  stubStorage()
  stubPointerEvents()
})

const busyView = () => hubView(seed('busy').state, seed('busy').at, seed('busy').env)

describe('the floating pill (§2.3)', () => {
  it('reads Collect all with the ready count, and carries the intent to collect into the check-in sheet', async () => {
    const view = busyView()
    expect(view.ready).toBeGreaterThan(0)
    const { where, state } = renderG2('/farm', seedGame('busy'))
    const pill = await screen.findByRole('link', { name: `Collect all · ${view.ready} ready` })
    fireEvent.click(pill)
    await waitFor(() => expect(where()).toBe('/farm?sheet=check-in'))
    expect(state()).toEqual({ back: true, collect: true })
    expect(await screen.findByRole('dialog', { name: 'Check-in' })).toBeTruthy()
  })

  it('reads Check-in with the free count when nothing is ready', async () => {
    const game = seedGame('fresh')
    for (const outfitId of ['sim-uma-01', 'sim-uma-02']) {
      const answer = await game.run('unlock-uma', { outfitId })
      expect(answer.kind).toBe('done')
    }
    const { where, state } = renderG2('/town', game)
    fireEvent.click(await screen.findByRole('link', { name: 'Check-in · 2 free' }))
    await waitFor(() => expect(where()).toBe('/town?sheet=check-in'))
    expect(state()).toEqual({ back: true, collect: false })
  })

  it('is absent when nothing is ready and nobody is free', async () => {
    renderG2('/farm', seedGame('quiet'))
    await screen.findByRole('link', { name: /^Kitchen\./ })
    expect(screen.queryByRole('link', { name: /^(Collect all|Check-in)/ })).toBeNull()
  })
})

describe('the bars (§2.1, §2.2)', () => {
  it("sit in uma-kit's frame, fixed to the screen's edges, with the bottom bar lifted only by the safe area (T147)", async () => {
    renderG2('/town', seedGame('busy'))
    const bar = await screen.findByRole('navigation', { name: 'Hub pages' })
    const frame = document.querySelector<HTMLElement>('[data-kit="frame"]')!
    expect(frame.className.split(' ')).toEqual(expect.arrayContaining(['fixed', 'inset-0']))
    expect(frame.className).not.toContain('h-dvh')
    expect(bar.firstElementChild!.className.split(' ')).toContain('mb-bar-safe')
    expect(bar.className).not.toContain('pb-safe')
  })

  it('badges only Farm and Training, with Umas who have something to collect there', async () => {
    const view = busyView()
    expect(view.tabs.farm).toBeGreaterThan(0)
    expect(view.tabs.training).toBeGreaterThan(0)
    renderG2('/racing', seedGame('busy'))
    const bar = await screen.findByRole('navigation', { name: 'Hub pages' })
    await within(bar).findByRole('link', { name: `Farm, ${view.tabs.farm} ready` })
    within(bar).getByRole('link', { name: `Training, ${view.tabs.training} ready` })
    expect(within(bar).getByRole('link', { name: 'Town Hall' }).getAttribute('href')).toBe('/town')
    const race = within(bar).getByRole('link', { name: 'Race' })
    expect(race.getAttribute('href')).toBe('/racing')
    expect(race.getAttribute('aria-current')).toBe('page')
    expect(within(bar).getByRole('link', { name: 'Menu: every place' }).getAttribute('href')).toBe('/racing?sheet=menu')
  })

  it("links each chip to the place that sells or spends it, and hides the Sync chip when synced", async () => {
    renderG2('/town', seedGame('busy'))
    const header = (await screen.findAllByRole('banner'))[0]!
    const hrefs = within(header).getAllByRole('link').map((link) => link.getAttribute('href'))
    expect(hrefs).toEqual(['/town/account', '/town/exchange', '/town/exchange?row=speed-tickets', '/town/stable?tab=locked'])
    await within(header).findByRole('link', { name: /^Uma Tickets 0, Uma Shards 0 of 5/ })
  })

  it.each([
    ['offline', 'Offline'], ['paused', 'Sync paused'], ['waiting', 'Sync'], ['failing', 'Sync'],
  ] as const)('shows the %s Sync chip, linking to Account at the sync row', async (sync, text) => {
    renderG2('/town', seedGame('busy', { sync }))
    const header = (await screen.findAllByRole('banner'))[0]!
    const chip = within(header).getAllByRole('link').at(-1)!
    expect(chip.getAttribute('href')).toBe('/town/account?row=sync')
    expect(chip.textContent).toBe(text)
  })
})

describe('place links and the side panel (§1, §4)', () => {
  it("labels each place link with its VoiceOver line, and draws the seed's pips and Ready badges", async () => {
    const view = busyView()
    renderG2('/farm', seedGame('busy'))
    for (const place of placesOn('farm')) {
      const tile = await screen.findByRole('link', { name: tileLabel(place, view) })
      const building = view.buildings[place.id as keyof typeof view.buildings]
      const pips = [...tile.querySelectorAll('[data-pip]')].map((pip) => (pip as HTMLElement).dataset.pip)
      expect(pips).toEqual([...building.pips.map((pip) => pip.state), ...(building.more > 0 ? ['more'] : [])])
      const badge = tile.querySelector<HTMLElement>('[data-ready-badge]')
      expect(badge?.textContent ?? null).toBe(building.ready > 0 ? hubWords('ready-badge', { n: building.ready }) : null)
      expect(Number(tile.querySelector<HTMLElement>('[data-counter]')?.dataset.counter ?? 0)).toBe(building.ready)
    }
    expect(document.querySelectorAll('[data-queued]').length).toBeGreaterThan(0)
  })

  it('opens the side panel on a tap: a modal dialog with its Peek and Enter, which replaces it with the Page', async () => {
    const { where, state } = renderG2('/farm', seedGame('busy'))
    fireEvent.click(await screen.findByRole('link', { name: /^Kitchen\./ }))
    await waitFor(() => expect(where()).toBe('/farm?peek=kitchen'))
    expect(state()).toEqual({ back: true })
    const panel = await screen.findByRole('dialog', { name: 'Kitchen' })
    expect(panel.getAttribute('aria-modal')).toBe('true')
    expect(panel.querySelector('[data-kit="side-panel"]')).toBeTruthy()
    // The registry's Peek, then Enter.
    await waitFor(() => expect(within(panel).getAllByText(/slots in use/).length).toBeGreaterThan(0))
    const enter = within(panel).getByRole('link', { name: 'Enter Kitchen' })
    expect(enter.getAttribute('href')).toBe('/farm/kitchen')
    // Its blurb sits behind (i).
    fireEvent.click(within(panel).getByRole('button', { name: 'About Kitchen' }))
    expect(within(panel).getByText(placeById('kitchen')!.blurb)).toBeTruthy()
    fireEvent.click(enter)
    await waitFor(() => expect(where()).toBe('/farm/kitchen'))
    expect(await screen.findByRole('heading', { level: 1, name: 'Kitchen' })).toBeTruthy()
    expect(screen.queryByRole('dialog', { name: 'Kitchen' })).toBeNull()
  })

  it.each([
    ['its close button', (panel: HTMLElement) => fireEvent.click(within(panel).getByRole('button', { name: 'Close' }))],
    ['Escape', () => fireEvent.keyDown(window, { key: 'Escape' })],
    ['a tap on the dimmed map', (panel: HTMLElement) => fireEvent.click(within(panel).getByRole('button', { name: 'Back to Farm' }))],
    ['a swipe right', (panel: HTMLElement) => {
      const side = panel.querySelector<HTMLElement>('[data-kit="side-panel"]')!
      fireEvent.pointerDown(side, { clientX: 120, clientY: 400 })
      fireEvent.pointerUp(side, { clientX: 220, clientY: 410 })
    }],
  ] as const)('closes the side panel with %s, back to the page', async (_, act) => {
    const { where } = renderG2('/farm', seedGame('busy'))
    fireEvent.click(await screen.findByRole('link', { name: /^Kitchen\./ }))
    act(await screen.findByRole('dialog', { name: 'Kitchen' }))
    await waitFor(() => expect(where()).toBe('/farm'))
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('keeps focus inside the side panel, and a deep link closes it to its page', async () => {
    const { where } = renderG2('/farm?peek=kitchen', seedGame('busy'))
    const panel = await screen.findByRole('dialog', { name: 'Kitchen' })
    expect(document.activeElement?.textContent).toBe('Kitchen')
    const enter = within(panel).getByRole('link', { name: 'Enter Kitchen' })
    enter.focus()
    fireEvent.keyDown(window, { key: 'Tab' })
    expect(document.activeElement).toBe(within(panel).getByRole('button', { name: 'About Kitchen' }))
    fireEvent.keyDown(window, { key: 'Tab', shiftKey: true })
    expect(document.activeElement).toBe(enter)
    fireEvent.click(within(panel).getByRole('button', { name: 'Close' }))
    await waitFor(() => expect(where()).toBe('/farm'))
  })

  it('sends a Peek of a place not on the page, or of the direct Racecourse, back to the page', async () => {
    const { where } = renderG2('/farm?peek=stable', seedGame('busy'))
    await waitFor(() => expect(where()).toBe('/farm'))
    cleanup()
    const racing = renderG2('/racing?peek=racecourse', seedGame('busy'))
    await waitFor(() => expect(racing.where()).toBe('/racing'))
  })

  it('opens the direct Racecourse at once', async () => {
    renderG2('/racing', seedGame('busy'))
    expect((await screen.findByRole('link', { name: /^Racecourse\./ })).getAttribute('href')).toBe('/racing/racecourse')
    expect(screen.getByRole('link', { name: /^Scenario Gate\./ }).getAttribute('href')).toBe('/racing?peek=scenario-gate')
  })

  it("draws the featured Uma in the plaza, opening her sheet", async () => {
    const { where } = renderG2('/town', seedGame('busy'))
    fireEvent.click(await screen.findByRole('link', { name: 'Featured Uma: Amber Sprint' }))
    await waitFor(() => expect(where()).toBe('/town?sheet=featured'))
    const sheet = await screen.findByRole('dialog', { name: 'Featured Uma' })
    expect((await within(sheet).findByRole('link', { name: 'Profile' })).getAttribute('href')).toBe('/town/stable/outfit/sim-uma-01')
    expect(within(sheet).getByRole('link', { name: 'Race' }).getAttribute('href')).toBe('/racing/racecourse?uma=sim-uma-01')
  })
})

describe('the menu (§2.2)', () => {
  it('lists every drawn place by page, then Account and the Needs view', async () => {
    renderG2('/farm?sheet=menu', seedGame('busy'))
    const menu = await screen.findByRole('dialog', { name: 'Every place' })
    const names = within(menu).getAllByRole('link').map((link) => link.textContent?.replace(/\d+$/, ''))
    expect(names).toEqual([
      ...['town', 'training', 'racing', 'farm'].flatMap((page) => placesOn(page as 'town').map((place) => place.name)),
      'Account', 'Needs of every Uma',
    ])
    expect(within(menu).getByRole('link', { name: /^Racecourse/ }).getAttribute('href')).toBe('/racing/racecourse')
    expect(within(menu).getByRole('link', { name: /^Kitchen/ }).getAttribute('href')).toBe('/farm?peek=kitchen')
    expect(within(menu).getByRole('link', { name: 'Needs of every Uma' }).getAttribute('href')).toBe('/town/stable/needs')
  })
})

describe('full-screen flows (§6)', () => {
  it.each(['/racing/racecourse/run', '/training/observatory/sim-uma-01', '/training/gym/sim-uma-01'])('hides both bars on %s', async (path) => {
    renderG2(path, seedGame('busy'))
    await waitFor(() => expect(document.querySelector('[data-kit="frame"]')?.getAttribute('data-full-screen')).toBe('true'))
    expect(screen.queryByRole('navigation', { name: 'Hub pages' })).toBeNull()
  })

  it('keeps the bars on a build view the Dojo shows in the shell, and on the reveal hides them', async () => {
    renderG2('/training/dojo/sim-uma-01', seedGame('busy'))
    expect(await screen.findByRole('navigation', { name: 'Hub pages' })).toBeTruthy()
    cleanup()
    renderG2('/collection/reveal/uma/sim-uma-01', seedGame('busy'))
    expect(await screen.findByRole('heading', { name: 'Amber Sprint' })).toBeTruthy()
    expect(screen.queryByRole('navigation', { name: 'Hub pages' })).toBeNull()
  })
})

describe('reduced motion (§12)', () => {
  it("stills the Ready pips' bounce and the numbers' slide when the system or the device switch asks", async () => {
    // The CSS that stills them is uma-kit's theme (tokens.test.ts); here the root sets the attribute it keys on.
    renderG2('/farm', seedGame('busy'))
    await waitFor(() => expect(document.querySelectorAll('.kit-pip-ready').length).toBeGreaterThan(0))
    expect(document.documentElement.hasAttribute('data-reduced-motion')).toBe(false)
    act(() => setDeviceReducedMotion(true))
    expect(localStorage.getItem(REDUCED_MOTION_KEY)).toBe('true')
    await waitFor(() => expect(document.documentElement.hasAttribute('data-reduced-motion')).toBe(true))
    act(() => setDeviceReducedMotion(false))
    await waitFor(() => expect(document.documentElement.hasAttribute('data-reduced-motion')).toBe(false))
  })
})
