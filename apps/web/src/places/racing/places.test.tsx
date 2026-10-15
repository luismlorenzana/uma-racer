// @vitest-environment jsdom
// The Racing page's places, rendered on the dev seeds through the in-memory port (T141 "Tests"): a race after the first
// is four taps from the Racing page, its result reads the committed row and a reopen shows it without fanfare; the
// Racecourse and Trophy Hall counters; a stale Advance redraws under "Her build changed." and keeps the button; the
// Promote sheet waits for her to be free; the Map offers no Start and sends its sub-routes back; the three scopes. A run
// starts at Account's race speed and follows Account's reduced motion, a badge's race link opens that result, and a turn
// race that runs past its turn count holds the HUD at the count. The PixiJS scene is stubbed: jsdom has no WebGL, and it
// ends the race as soon as it mounts.
import { act, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { renderG2, seedGame, stubStorage } from '../../__fixtures__/testing'
import { raceTurns, timelineDuration } from '@racer/race'
import { hudTurn, TURN_RACE_RATE } from '../../scenes/race/presentation'
import { setRaceSpeed, setReducedMotion, startingSpeed } from '../../ui/devicePrefs'
import { replayOf, simulate } from './prepare'
import { readLogs } from './records'
import { TROPHY_HALL_SEEN_KEY } from './seen'
import { profilePath } from '../stable/model'
import { resultPath } from './today'
import { raceRecords } from './trophy'

/** What the stubbed scene was given: the reduced-motion flag it was built with, and each playback rate it was set to. */
const scene = vi.hoisted(() => ({ reducedMotion: null as boolean | null, rates: [] as number[] }))

vi.mock('../../scenes/race/RaceScene', () => ({
  RaceScene: class {
    private readonly onFinish: () => void
    constructor(..._args: unknown[]) {
      this.onFinish = _args[4] as () => void
      scene.reducedMotion = _args[5] as boolean
    }
    async mount() { this.onFinish() }
    seek() {}
    skipToEnd() { this.onFinish() }
    setSpeed(rate: number) { scene.rates.push(rate) }
    setFaces() { return Promise.resolve() }
    destroy() {}
    get position() { return 0 }
  },
}))

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})
beforeEach(() => {
  stubStorage()
  scene.reducedMotion = null
  scene.rates = []
})

/** Starts her G1 from race select and waits for the run page; returns the result's id. */
async function startRace(where: () => string): Promise<string> {
  fireEvent.click(await screen.findByRole('button', { name: 'Start race' }))
  await waitFor(() => expect(where()).toMatch(/^\/racing\/racecourse\/run\?result=/))
  return new URLSearchParams(where().split('?')[1]).get('result')!
}

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

  it("starts at Account's race speed, or the nearest speed the race offers", async () => {
    expect(startingSpeed([1, 2], 2)).toBe(2)
    expect(startingSpeed([1 / 3, 1, 2], 1)).toBe(1)
    expect(startingSpeed([1 / 3, 1], 2)).toBe(1)
    expect(startingSpeed([1, 2], 1 / 3)).toBe(1)
    expect(startingSpeed([1, 2], 1.5)).toBe(1)
    setRaceSpeed(2)
    const { where } = renderG2('/racing/racecourse?uma=sim-uma-01&race=sim-g1-medium-a', seedGame('busy'))
    await startRace(where)
    const speeds = await screen.findByRole('group', { name: 'Playback speed' })
    expect(within(speeds).getByRole('button', { name: '2×' }).getAttribute('aria-pressed')).toBe('true')
    expect(within(speeds).getByRole('button', { name: '1×' }).getAttribute('aria-pressed')).toBe('false')
    // The scene loads after the first render, and still starts at that rate: a turn race plays at its own rate on top.
    const turnRace = within(speeds).queryByRole('button', { name: 'Slow' }) !== null
    await waitFor(() => expect(scene.rates.at(-1)).toBe(2 * (turnRace ? TURN_RACE_RATE : 1)))
  })

  it("runs and shows the result without fanfare under Account's reduced motion, as the rest of the app does", async () => {
    const game = seedGame('busy')
    setReducedMotion(true)
    const { where } = renderG2('/racing/racecourse?uma=sim-uma-01&race=sim-g1-medium-a', game)
    await startRace(where)
    await waitFor(() => expect(scene.reducedMotion).toBe(true))
    // The Prize Money chip shows the new balance at once: no flying amount, no count up from the old one.
    const chip = await screen.findByRole('status', { name: 'Prize Money' })
    expect(chip.textContent).toBe(game.getSnapshot().state!.profile.prizeMoney.toLocaleString('en-US'))
    act(() => setReducedMotion(false))
  })

  it("opens a badge's or a record's race on the live run route, at that race's result", async () => {
    const game = seedGame('busy')
    const { where } = renderG2('/racing/racecourse?uma=sim-uma-01&race=sim-g1-medium-a', game)
    const id = await startRace(where)
    cleanup()
    const logs = await readLogs(game)
    const linked = raceRecords(game.getSnapshot().state!, { ...logs, badges: {} }).find((record) => record.resultId === id)!
    expect(linked).toMatchObject({ umaId: 'sim-uma-01', raceId: 'sim-g1-medium-a' })
    expect(resultPath(linked.resultId)).toBe(`/racing/racecourse/run?result=${id}`)
    const view = renderG2(resultPath(linked.resultId), game)
    expect(await screen.findByRole('region', { name: 'Prize Money' })).toBeTruthy()
    expect(document.querySelector('[data-g2="race-result"]')).not.toBeNull()
    expect(view.where()).toBe(`/racing/racecourse/run?result=${id}`)
  })

  it("runs a turn race past the course's turn count in normal play, and the HUD holds at the count", async () => {
    const game = seedGame('busy')
    const { where } = renderG2('/racing/racecourse?uma=sim-uma-01&race=sim-g1-medium-a', game)
    const id = await startRace(where)
    const timeline = simulate(replayOf((await readLogs(game)).raceResults[id]!))
    const total = raceTurns(timeline.courseDistance)
    expect(timeline.tickRate).toBe(1)
    // The field takes turns until its last runner finishes: here past the 2,000 m course's 100.
    expect(timelineDuration(timeline)).toBeGreaterThan(total)
    expect(hudTurn(timelineDuration(timeline), total)).toBe(total)
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
    // A real change to her: an equal copy (any sync's) isn't one, and advances on the first tap (ceremony.test.tsx).
    const preset = game.getSnapshot().state!.umas[umaId]!.raceDefaults.selectedPreset === 'sprint' ? 'mile' : 'sprint'
    await act(async () => { await game.run('set-race-defaults', { umaId, selectedPreset: preset }) })
    fireEvent.click(sheetButton())
    expect(await screen.findByText('Her build changed.')).toBeTruthy()
    fireEvent.click(sheetButton())
    await waitFor(() => expect(where()).toMatch(new RegExp(`^/racing/scenario-gate/${umaId}/ceremony\\?op=`)))
    expect(game.getSnapshot().state!.umas[umaId]!.scenario).toBe(2)
    expect(await screen.findByRole('heading', { name: 'URA Finale Graduate' })).toBeTruthy()
  })

  it("goes on to her profile after 2.5 s, not 6 s, under Account's reduced motion", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    try {
      const game = seedGame('gate')
      const umaId = Object.values(game.getSnapshot().state!.umas).find((uma) => uma.racing.level === 10)!.outfitId
      setReducedMotion(true)
      const { where } = renderG2(`/racing/scenario-gate/${umaId}?sheet=advance`, game)
      await screen.findByText('The new layer')
      fireEvent.click(document.querySelector<HTMLButtonElement>('[data-advance]')!)
      expect(await screen.findByRole('heading', { name: 'URA Finale Graduate' })).toBeTruthy()
      await act(async () => { await vi.advanceTimersByTimeAsync(2_600) })
      await waitFor(() => expect(where()).toBe(`/town/stable/outfit/${umaId}`))
    } finally {
      act(() => setReducedMotion(false))
      vi.useRealTimers()
    }
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
  it("opens a goal's or a scenario's flair on her profile's live route, with no redirect on the way", async () => {
    const { where } = renderG2(profilePath('sim-uma-01'), seedGame('busy'))
    expect(await screen.findByRole('heading', { name: 'Amber Sprint' })).toBeTruthy()
    expect(where()).toBe(profilePath('sim-uma-01'))
    expect(document.querySelector('[data-g2="career-goals"]')).not.toBeNull()
  })

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
