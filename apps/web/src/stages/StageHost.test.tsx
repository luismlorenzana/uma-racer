// @vitest-environment jsdom
// The stage host at 390 × 844 (T155, T156, D384, D385) over the in-memory port: the rule card, the Yard's view loaded
// lazily, the journal kept on every move and when the page hides, a closed play resumed by replay (and one whose setup
// changed started again), a career play settled through `settle-stage` on its last move into her wallet, practice
// graded on the device, paying nothing, and Furlong Hand's race settled the same way, paying Bond and SP.
import { STAGE_PAY_AT_A } from '@racer/domain/career'
import { FURLONG_MOVE } from '@racer/domain/stages'
import { act, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { stubPointerEvents, stubStorage } from '../__fixtures__/testing'
import type { StoredJournal } from '../app/game'
import {
  atPhoneSize, CAREER, careerGame, careerState, FURLONG_CAREER, furlongGame, furlongOneLeft, partPlayed, renderInApp,
} from './__fixtures__/stages'
import { StageHost } from './StageHost'

beforeEach(() => {
  stubStorage()
  stubPointerEvents()
  atPhoneSize()
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

const PRACTICE_ROW = 'training-yard:practice'
const CAREER_ROW = `training-yard:${CAREER}`

const firstEmptyCell = async () => (await screen.findAllByRole('button', { name: /^Row \d, column \d/ })).find((cell) => cell.getAttribute('aria-label')?.endsWith('empty') && !cell.hasAttribute('disabled'))!
const rowOf = (game: ReturnType<typeof careerGame>, id: string) => game.journal.rows.get(id) as StoredJournal | undefined

describe('the stage host', () => {
  it('opens on the rule card, then loads the Yard\'s view for a practice play', async () => {
    const game = careerGame()
    const onExit = vi.fn()
    renderInApp(game, <StageHost kind="training-yard" careerId={null} mode="practice" onExit={onExit} />)
    const card = await screen.findByText('Merge')
    expect(card.closest('[data-racer="rule-card"]')?.textContent).toMatch(/three touching of one colour and frame merge one frame up/)
    expect(screen.queryByRole('button', { name: 'Play' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Practice (pays nothing)' }))
    expect(await screen.findByRole('group', { name: 'The yard' })).toBeTruthy()
    expect(screen.getAllByRole('button', { name: /^Row \d, column \d/ })).toHaveLength(36)
    expect(screen.getByLabelText('Practice: pays nothing')).toBeTruthy()
    await waitFor(() => expect(rowOf(game, PRACTICE_ROW)?.journal.inputs).toEqual([]))
    fireEvent.click(screen.getByRole('button', { name: 'Leave Training Yard' }))
    expect(onExit).toHaveBeenCalled()
  })

  it('offers Play and Practice for a career, and keeps the journal on every move and when the page hides', async () => {
    const game = careerGame()
    const writes = vi.spyOn(game.journal, 'write')
    renderInApp(game, <StageHost kind="training-yard" careerId={CAREER} mode="career" onExit={() => {}} />)
    expect(await screen.findByText(/A play pays 200 drills and 30 SP at grade A/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Play' }))
    fireEvent.click(await firstEmptyCell())
    await waitFor(() => expect(rowOf(game, CAREER_ROW)?.journal.inputs).toHaveLength(1))
    expect(rowOf(game, CAREER_ROW)).toMatchObject({ careerId: CAREER, journal: { config: { practice: false, seasonFocus: 'stamina' } } })
    expect(document.querySelector('[data-racer="yard-left"]')?.textContent).toBe('59')
    const before = writes.mock.calls.length
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' })
    act(() => void document.dispatchEvent(new Event('visibilitychange')))
    act(() => void window.dispatchEvent(new Event('pagehide')))
    await waitFor(() => expect(writes.mock.calls.length).toBe(before + 2))
    Reflect.deleteProperty(document, 'visibilityState')
  })

  it('resumes a play closed mid-way by replaying its journal', async () => {
    const game = careerGame()
    const journal = partPlayed(careerState(), true, 10, null)
    await game.journal.write({ id: PRACTICE_ROW, careerId: null, journal })
    renderInApp(game, <StageHost kind="training-yard" careerId={null} mode="practice" onExit={() => {}} />)
    expect(await screen.findByRole('group', { name: 'The yard' })).toBeTruthy()
    expect(screen.queryByText('Merge')).toBeNull()
    expect(document.querySelector('[data-racer="yard-left"]')?.textContent).toBe('50')
    expect(screen.getAllByRole('button', { name: /^Row \d, column \d/ }).filter((cell) => !cell.getAttribute('aria-label')!.endsWith('empty')).length).toBeGreaterThan(0)
  })

  it('starts again, saying why, when her deck or season changed since the play', async () => {
    const game = careerGame()
    const journal = partPlayed(careerState(), false, 5)
    await game.journal.write({ id: CAREER_ROW, careerId: CAREER, journal: { ...journal, config: { ...journal.config, seasonFocus: 'wit' } } })
    renderInApp(game, <StageHost kind="training-yard" careerId={CAREER} mode="career" onExit={() => {}} />)
    expect(await screen.findByText('Her deck or season changed since that play, so it starts again.')).toBeTruthy()
    await waitFor(() => expect(rowOf(game, CAREER_ROW)).toBeUndefined())
  })

  it('settles a career play on its last move through settle-stage, paying her wallet, and offers Play again', async () => {
    const game = careerGame()
    await game.journal.write({ id: CAREER_ROW, careerId: CAREER, journal: partPlayed(careerState(), false, 59) })
    renderInApp(game, <StageHost kind="training-yard" careerId={CAREER} mode="career" onExit={() => {}} />)
    fireEvent.click(await firstEmptyCell())
    const result = await screen.findByLabelText(/^Grade [SABCD]$/)
    expect(game.applied).toEqual(['settle-stage'])
    const grade = result.textContent as 'S' | 'A' | 'B' | 'C' | 'D'
    const wallet = game.getSnapshot().state!.careers[CAREER]!.wallet
    const drills = Object.values(wallet.drills).reduce((a, b) => a + b, 0)
    expect(drills).toBe(Math.round(STAGE_PAY_AT_A['training-yard'].drills * { D: 0.25, C: 0.6, B: 0.8, A: 1, S: 1.2 }[grade]))
    const pay = screen.getByRole('list', { name: 'Pay' })
    expect(within(pay).getByText(`+${wallet.sp}`)).toBeTruthy()
    expect(rowOf(game, CAREER_ROW)).toBeUndefined()
    fireEvent.click(screen.getByRole('button', { name: 'Play again' }))
    expect(await screen.findByRole('group', { name: 'The yard' })).toBeTruthy()
    expect(document.querySelector('[data-racer="yard-left"]')?.textContent).toBe('60')
  })

  it('grades a finished practice on the device and pays nothing', async () => {
    const game = careerGame()
    await game.journal.write({ id: PRACTICE_ROW, careerId: null, journal: partPlayed(careerState(), true, 59, CAREER) })
    renderInApp(game, <StageHost kind="training-yard" careerId={CAREER} mode="practice" onExit={() => {}} />)
    fireEvent.click(await firstEmptyCell())
    expect(await screen.findByLabelText(/^Grade [SABCD]$/)).toBeTruthy()
    expect(screen.getByText('Practice pays nothing.')).toBeTruthy()
    expect(game.applied).toEqual([])
    expect(game.getSnapshot().state!.careers[CAREER]!.wallet).toEqual(careerState().careers[CAREER]!.wallet)
    expect(rowOf(game, PRACTICE_ROW)).toBeUndefined()
  })

  it('says why a play can\'t open: Furlong Hand without a race to run', async () => {
    renderInApp(careerGame(), <StageHost kind="furlong-hand" careerId={null} mode="practice" onExit={() => {}} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Practice (pays nothing)' }))
    expect((await screen.findByRole('alert')).textContent).toBe('Furlong Hand has no race to run here.')
  })
})

describe('the stage host with Furlong Hand', () => {
  const FURLONG_ROW = `furlong-hand:${FURLONG_CAREER}`

  it('opens on its rule card, then deals the race to the line choice', async () => {
    const game = furlongGame()
    renderInApp(game, <StageHost kind="furlong-hand" careerId={FURLONG_CAREER} mode="career" onExit={() => {}} />)
    const card = await screen.findByText('Race')
    expect(card.closest('[data-racer="rule-card"]')?.textContent).toMatch(/tap to run it for ground, swipe it down to bank Drive/)
    expect(screen.getByText(/A play pays 25 Bond and 20 SP at grade A/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Play' }))
    expect(await screen.findByRole('list', { name: 'The field, first to last' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /^Middle: / }))
    await waitFor(() => expect((game.journal.rows.get(FURLONG_ROW) as StoredJournal | undefined)?.journal.inputs).toHaveLength(1))
    expect(await screen.findByRole('group', { name: 'The spread' })).toBeTruthy()
  })

  it('settles a career race on its last tap through settle-stage: her place, the grade, and Bond and SP into her wallet', async () => {
    const game = furlongGame()
    const { journal, move } = furlongOneLeft(false, FURLONG_MOVE.run)
    await game.journal.write({ id: FURLONG_ROW, careerId: FURLONG_CAREER, journal })
    renderInApp(game, <StageHost kind="furlong-hand" careerId={FURLONG_CAREER} mode="career" onExit={() => {}} />)
    const spread = await screen.findByRole('group', { name: 'The spread' })
    fireEvent.click(spread.querySelector(`[data-front="${move.x}"]`)!)
    const result = await screen.findByLabelText(/^Grade [SABCD]$/)
    expect(game.applied).toEqual(['settle-stage'])
    const grade = result.textContent as 'S' | 'A' | 'B' | 'C' | 'D'
    const wallet = game.getSnapshot().state!.careers[FURLONG_CAREER]!.wallet
    expect(wallet.bond).toBe(Math.round(STAGE_PAY_AT_A['furlong-hand'].bond * { D: 0.25, C: 0.6, B: 0.8, A: 1, S: 1.2 }[grade]))
    expect(Object.values(wallet.drills).every((n) => n === 0)).toBe(true)
    expect(screen.getByText(/^Finished \d(st|nd|rd|th)$/)).toBeTruthy()
    expect(within(screen.getByRole('list', { name: 'Bonus tasks' })).getAllByRole('listitem')).toHaveLength(4)
    expect(within(screen.getByRole('list', { name: 'Pay' })).getByText(`+${wallet.bond}`)).toBeTruthy()
    expect(game.journal.rows.get(FURLONG_ROW)).toBeUndefined()
  })

  it('grades a practice race on the device by a swipe to bank, and pays nothing', async () => {
    const game = furlongGame()
    // Its last card banked instead of run: the race ends the same.
    const { journal, move } = furlongOneLeft(true, FURLONG_MOVE.run)
    await game.journal.write({ id: 'furlong-hand:practice', careerId: null, journal })
    renderInApp(game, <StageHost kind="furlong-hand" careerId={FURLONG_CAREER} mode="practice" onExit={() => {}} />)
    const spread = await screen.findByRole('group', { name: 'The spread' })
    const card = spread.querySelector(`[data-front="${move.x}"]`)!
    fireEvent.pointerDown(card, { clientX: 5, clientY: 50 })
    fireEvent.pointerUp(card, { clientX: 5, clientY: 120 })
    expect(await screen.findByLabelText(/^Grade [SABCD]$/)).toBeTruthy()
    expect(screen.getByText('Practice pays nothing.')).toBeTruthy()
    expect(game.applied).toEqual([])
  })
})
