// @vitest-environment jsdom
// Furlong Hand's view at 390 × 844 (T156, D385): it deals the race (the course from her objective's layout, the field
// of nine with faces and each rival's next move, her bust and gauges), takes a line, runs a tapped front card and banks
// a swiped one (or a tap with Bank on), flips and redraws, draws Partners as card art (a rainbow frame when bonded),
// has its own moment for the spurt, keeps every target at 44 pt or more with the race on top and the hand below, and
// takes no taps while locked.
import { FURLONG_MOVE, LINE, MOVE, playableColumns, type FurlongState } from '@racer/domain/stages'
import { cleanup, fireEvent, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { stubPointerEvents, stubStorage } from '../../__fixtures__/testing'
import { atPhoneSize, furlongAfter, furlongConfigFor, furlongGame, renderInApp } from '../__fixtures__/stages'
import FurlongView, { SWIPE_BANK } from './FurlongView'

beforeEach(() => {
  stubStorage()
  stubPointerEvents()
  atPhoneSize()
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

const SEED = 11
const config = furlongConfigFor(SEED)

function show(state: FurlongState, locked = false) {
  const onMove = vi.fn()
  renderInApp(furlongGame(), <FurlongView config={config} state={state} onMove={onMove} reducedMotion={false} locked={locked} />)
  return onMove
}

/** The play at its first leg, opened from the middle line. */
const inLeg = (): FurlongState => {
  for (let moves = 1; moves < 40; moves += 1) {
    const state = furlongAfter(SEED, moves)
    if (state.phase === 'leg' && playableColumns(state).length > 0) return state
  }
  throw new Error('No playable leg')
}

describe('Furlong Hand\'s view', () => {
  it('deals the race: the course\'s legs, the field of nine with faces and next moves, her gauges, and the line first', () => {
    const start = furlongAfter(SEED, 0)
    show(start)
    const legs = screen.getByRole('list', { name: 'The course' })
    expect(within(legs).getAllByRole('listitem')).toHaveLength(start.legs.length + 1)
    expect(within(legs).getAllByRole('listitem')[0]!.getAttribute('aria-current')).toBe('step')
    expect(within(legs).getByLabelText('The spurt')).toBeTruthy()
    const field = screen.getByRole('list', { name: 'The field, first to last' })
    expect(within(field).getAllByRole('listitem')).toHaveLength(9)
    expect(field.querySelector('[data-her="true"]')).toBeTruthy()
    // Every rival shows its move for the spread ahead.
    expect(field.querySelectorAll('[data-move]')).toHaveLength(8)
    const moves = start.rivals.map((rival) => rival.script[0])
    expect(moves.filter((move) => move === MOVE.surge).length).toBe(field.querySelectorAll('[data-move="Surges"]').length)
    expect(screen.getByRole('meter', { name: 'Breath' }).getAttribute('aria-valuenow')).toBe(String(start.breath))
    expect(screen.getByRole('meter', { name: 'Drive' })).toBeTruthy()
    expect(screen.getByText(/^Prep heat: /)).toBeTruthy()
    expect(screen.getByRole('button', { name: /^Rail: / })).toBeTruthy()
  })

  it('takes a line: rail, middle or outside, and says when a rival closes the rail', () => {
    const start = furlongAfter(SEED, 0)
    const onMove = show(start)
    fireEvent.click(screen.getByRole('button', { name: /^Outside: Speed \+1, −1 Breath/ }))
    expect(onMove).toHaveBeenCalledWith({ code: FURLONG_MOVE.line, x: LINE.outside })
    fireEvent.click(screen.getByRole('button', { name: /^Middle: / }))
    expect(onMove).toHaveBeenLastCalledWith({ code: FURLONG_MOVE.line, x: LINE.middle })
    cleanup()
    const closed: FurlongState = { ...start, rivals: start.rivals.map((rival, r) => ({ ...rival, script: rival.script.map((move, s) => (s === 0 && r === 0 ? MOVE.rail : move)) })) }
    show(closed)
    expect(screen.getByRole('button', { name: /^Rail: A rival is closing it: column 1 starts shut/ })).toBeTruthy()
    expect(screen.getByRole('list', { name: 'The field, first to last' }).querySelector('[data-move="Closes the rail"]')).toBeTruthy()
  })

  it('runs a tapped front card, banks a swiped one, and banks taps with Bank on', () => {
    const state = inLeg()
    const column = playableColumns(state)[0]!
    const onMove = show(state)
    const card = screen.getByRole('group', { name: 'The spread' }).querySelector<HTMLButtonElement>(`[data-front="${column}"]`)!
    expect(card.getAttribute('aria-label')).toMatch(/: tap to run, swipe down to bank$/)
    fireEvent.click(card)
    expect(onMove).toHaveBeenLastCalledWith({ code: FURLONG_MOVE.run, x: column })
    fireEvent.pointerDown(card, { clientX: 10, clientY: 100 })
    fireEvent.pointerUp(card, { clientX: 10, clientY: 100 + SWIPE_BANK + 4 })
    fireEvent.click(card)
    expect(onMove).toHaveBeenLastCalledWith({ code: FURLONG_MOVE.bank, x: column })
    expect(onMove).toHaveBeenCalledTimes(2)
    fireEvent.click(screen.getByRole('button', { name: 'Bank: taps bank cards for Drive' }))
    expect(screen.getByRole('button', { name: 'Bank: taps bank cards for Drive' }).getAttribute('aria-pressed')).toBe('true')
    fireEvent.click(card)
    expect(onMove).toHaveBeenLastCalledWith({ code: FURLONG_MOVE.bank, x: column })
  })

  it('flips a draw card, redraws a fresh spread, and shows the lead and the cards that don\'t follow it', () => {
    const state = inLeg()
    const onMove = show({ ...state, redrawn: false, pile: state.pile.length === 7 ? state.pile : [...state.pile, ...state.pile].slice(0, 7) })
    expect(screen.getByRole('img', { name: /^Lead: / })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Flip a draw card as the lead, for 1 Breath' }))
    expect(onMove).toHaveBeenLastCalledWith({ code: FURLONG_MOVE.flip })
    const stuck = [0, 1, 2, 3].filter((c) => !playableColumns(state).includes(c) && state.columns[c]!.length > 0)
    for (const c of stuck) {
      const front = screen.getByRole('group', { name: 'The spread' }).querySelector<HTMLButtonElement>(`[data-front="${c}"]`)!
      expect(front.disabled).toBe(true)
    }
    const redraw = screen.queryByRole('button', { name: 'Redraw this spread, free, once' })
    if (redraw !== null) {
      fireEvent.click(redraw)
      expect(onMove).toHaveBeenLastCalledWith({ code: FURLONG_MOVE.redraw })
    }
  })

  it('draws Partners as their card with a rainbow frame once bonded, stride cards on their stat colour', () => {
    const state = inLeg()
    const partner = state.cards.findIndex((card) => card.kind === 'partner' && state.partners[card.ref]!.cardId === 'sim-speed-2')
    const speed = state.cards.findIndex((card) => card.kind === 'stride' && card.colour === 0)
    const bonded = { ...state, partners: state.partners.map((each, i) => (i === 0 ? { ...each, rainbow: true } : each)), columns: [[speed, partner], ...state.columns.slice(1)] }
    show(bonded)
    const spread = screen.getByRole('group', { name: 'The spread' })
    const front = spread.querySelector('[data-front="0"]')!
    expect(front.getAttribute('aria-label')).toMatch(/^Partner Sim speed, Speed \d, rainbow/)
    expect(front.querySelector('[data-card="partner"]')).toBeTruthy()
    expect(front.querySelector('[data-rainbow="true"]')?.className).toMatch(/conic-gradient/)
    const behind = spread.querySelector('[data-column="0"] [role="img"]')!
    expect(behind.getAttribute('aria-label')).toMatch(/^Speed \d$/)
    expect(behind.querySelector('[data-colour="speed"]')?.className).toMatch(/bg-stat-speed/)
  })

  it('has its own moment for the spurt: Drive multiplies every run card', () => {
    let state = inLeg()
    for (let moves = 1; moves < 200; moves += 1) {
      state = furlongAfter(SEED, moves)
      if (state.spread === state.legs.length) break
    }
    expect(state.spread).toBe(state.legs.length)
    show(state)
    const moment = screen.getByRole('status', { name: '' })
    expect(document.querySelector('[data-racer="furlong-spurt"]')?.textContent).toMatch(/^The spurtDrive ×\d+\.\d on every run card$/)
    expect(moment).toBeTruthy()
    expect(within(screen.getByRole('list', { name: 'The course' })).getByLabelText('The spurt').getAttribute('aria-current')).toBe('step')
  })

  it('keeps every target at 44 pt or more, the race on top and the hand below, and takes no taps while locked', () => {
    const state = inLeg()
    show(state)
    const view = document.querySelector('[data-racer="furlong"]')!
    const order = [...view.children].map((child) => child.getAttribute('data-racer'))
    expect(order.indexOf('furlong-race')).toBeLessThan(order.indexOf('furlong-hand'))
    expect(view.querySelector('[data-racer="furlong-race"]')!.className).toMatch(/basis-\[40%\]/)
    expect(view.querySelector('[data-racer="furlong-hand"]')!.className).toMatch(/basis-\[60%\]/)
    for (const front of view.querySelectorAll('[data-front]')) expect(front.className).toMatch(/min-h-11 min-w-11/)
    for (const button of screen.getAllByRole('button')) expect(button.className).toMatch(/min-h-1[1-4]/)
    cleanup()
    show(state, true)
    expect(screen.getAllByRole('button').every((button) => (button as HTMLButtonElement).disabled)).toBe(true)
  })
})
