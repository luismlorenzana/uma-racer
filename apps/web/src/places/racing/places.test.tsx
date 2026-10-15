// @vitest-environment jsdom
// The Racing page's places, rendered on the dev seeds through the in-memory port (T141 "Tests"): a race after the first
// is four taps from the Racing page, its result reads the committed row and a reopen shows it without fanfare; the
// Racecourse and Trophy Hall counters; a stale Advance redraws under "Her build changed." and keeps the button; the
// Promote sheet waits for her to be free; the Map offers no Start and sends its sub-routes back; the three scopes. The
// PixiJS scene is stubbed: jsdom has no WebGL, and it ends the race as soon as it mounts.
import { act, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { renderG2, seedGame, stubStorage } from '../../__fixtures__/testing'
import { readLogs } from './records'
import { TROPHY_HALL_SEEN_KEY } from './seen'

vi.mock('../../scenes/race/RaceScene', () => ({
  RaceScene: class {
    private readonly onFinish: () => void
    constructor(..._args: unknown[]) {
      this.onFinish = _args[4] as () => void
    }
    async mount() { this.onFinish() }
    seek() {}
    skipToEnd() { this.onFinish() }
    setSpeed() {}
    setFaces() { return Promise.resolve() }
    destroy() {}
    get position() { return 0 }
  },
}))

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})
beforeEach(stubStorage)

describe('the Racecourse', () => {
  it('runs a race in four taps from the Racing page and shows its committed result, then quietly on a reopen', async () => {
    const game = seedGame('busy')
    const { where } = renderG2('/racing', game)
    fireEvent.click(await screen.findByRole('link', { name: /^Racecourse/ })) // 1
    await screen.findByText(/Today's purse · 0 of 4,500 at full prize/)
    const featured = await screen.findByRole('region', { name: "Today's featured" })
    fireEvent.click(within(featured).getAllByRole('button')[0]!) // 2
    fireEvent.click(await screen.findByRole('button', { name: 'Start race' })) // 3
    await waitFor(() => expect(where()).toMatch(/^\/racing\/racecourse\/run\?result=/))
    fireEvent.click(await screen.findByRole('button', { name: 'Skip' })) // 4
    const result = await screen.findByRole('region', { name: 'Prize Money' })
    const id = new URLSearchParams(where().split('?')[1]).get('result')!
    const row = (await readLogs(game)).raceResults[id]!
    expect(within(result).getByText(new RegExp(`in a G1$`)).textContent).toMatch(/^\+\d+ · \d+(st|nd|rd|th) in a G1$/)
    expect(document.querySelector('[data-g2="race-result"]')?.getAttribute('data-fanfare')).toBe('yes')
    expect(row.commit.prize.paid).toBeGreaterThanOrEqual(0)
    cleanup()
    renderG2(`/racing/racecourse/run?result=${id}`, game)
    await screen.findByRole('region', { name: 'Prize Money' })
    expect(document.querySelector('[data-g2="race-result"]')?.getAttribute('data-fanfare')).toBe('no')
  })

  it('counts the featured bonuses still open on its tile', async () => {
    renderG2('/racing', seedGame('busy'))
    const tile = await screen.findByRole('link', { name: /^Racecourse/ })
    await waitFor(() => expect(tile.querySelector('[data-counter]')?.getAttribute('data-counter')).toBe('2'))
  })

  it('says nothing more than "That didn\'t work. Try again." when the commit fails', async () => {
    const game = seedGame('busy')
    const failing = { ...game, run: () => Promise.reject(new Error('down')) }
    renderG2('/racing/racecourse?uma=sim-uma-01&race=sim-g1-medium-a', failing as typeof game)
    fireEvent.click(await screen.findByRole('button', { name: 'Start race' }))
    expect(await screen.findByRole('alert')).toHaveProperty('textContent', "That didn't work. Try again.")
  })
})

describe('the Scenario Gate', () => {
  it('redraws a stale Advance sheet under "Her build changed." and keeps the button; the next tap advances', async () => {
    const game = seedGame('gate')
    const umaId = Object.values(game.getSnapshot().state!.umas).find((uma) => uma.racing.level === 10)!.outfitId
    const { where } = renderG2(`/racing/scenario-gate/${umaId}?sheet=advance`, game)
    await screen.findByText('The new layer')
    const sheetButton = () => document.querySelector<HTMLButtonElement>('[data-advance]')!
    await act(async () => { await game.run('set-active-nodes', { umaId, preset: 'medium', nodeIds: [] }) })
    fireEvent.click(sheetButton())
    expect(await screen.findByText('Her build changed.')).toBeTruthy()
    fireEvent.click(sheetButton())
    await waitFor(() => expect(where()).toMatch(new RegExp(`^/racing/scenario-gate/${umaId}/ceremony\\?op=`)))
    expect(game.getSnapshot().state!.umas[umaId]!.scenario).toBe(2)
    expect(await screen.findByRole('heading', { name: 'URA Finale Graduate' })).toBeTruthy()
  })

  it('opens Promote only while she is free, and offers her work actions first', async () => {
    const game = seedGame('promote')
    const state = game.getSnapshot().state!
    const busy = Object.values(state.umas).find((uma) => uma.expedition.runs.some((run) => run.completed) && (state.work[uma.outfitId]?.entries.length ?? 0) > 0)!
    renderG2(`/racing/scenario-gate/${busy.outfitId}?sheet=promote`, game)
    await screen.findByText('Her tier in numbers')
    const promote = () => document.querySelector<HTMLButtonElement>('[data-promote]')!
    expect(promote().disabled).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: 'Recall' }))
    await waitFor(() => expect(promote().disabled).toBe(false))
    expect(screen.getByText('+1 Uma Ticket')).toBeTruthy()
  })
})

describe('the Expedition Map, a placeholder', () => {
  it('offers no Start and sends an Expedition’s route back to the Map', async () => {
    const { where } = renderG2('/racing/expedition-map/us-speed', seedGame('busy'))
    await screen.findByText('No Uma has finished her tier yet')
    expect(where()).toBe('/racing/expedition-map')
    expect(screen.queryByRole('button', { name: /start/i })).toBeNull()
    expect(screen.queryByRole('link', { name: /start/i })).toBeNull()
  })
})

describe('the Trophy Hall', () => {
  it('shows the three scopes and clears its counter on a visit', async () => {
    const game = seedGame('busy')
    const view = renderG2('/racing/trophy-hall', game)
    const scopes = await screen.findByRole('navigation', { name: 'Badge scope' })
    expect(within(scopes).getAllByRole('link').map((link) => link.textContent)).toEqual(['Uma', 'Stable', 'Trainer'])
    await waitFor(() => expect(Object.keys(game.getSnapshot().badges ?? {})).toContain('trainer'))
    expect(Number(localStorage.getItem(TROPHY_HALL_SEEN_KEY))).toBeGreaterThan(0)
    fireEvent.click(within(scopes).getByRole('link', { name: 'Trainer' }))
    expect(await screen.findByText(/^Cards bonded \d+\/\d+$/)).toBeTruthy()
    view.unmount()
    renderG2('/racing', game)
    const tile = await screen.findByRole('link', { name: /^Trophy Hall/ })
    expect(tile.querySelector('[data-counter]')).toBeNull()
  })
})
