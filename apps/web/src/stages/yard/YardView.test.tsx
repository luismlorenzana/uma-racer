// @vitest-environment jsdom
// Training Yard's view at 390 × 844 (T155, D384): a tap on an empty cell places the piece in hand, Hold holds it (then
// swaps, once a placement), pieces are Uma faces on stat colours framed by tier with Partners as card art, Fatigue and
// Rest are their marks, every target is 44 pt or more, and a locked yard takes no taps.
import { pieceCell, FATIGUE, PARTNER_BASE, REST, YARD_RULES, type YardState } from '@racer/domain/stages'
import { cleanup, fireEvent, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { stubStorage } from '../../__fixtures__/testing'
import { atPhoneSize, CAREER, careerGame, careerState, ENV, renderInApp, UMA } from '../__fixtures__/stages'
import { stageConfigFor } from '../session'
import YardView from './YardView'

beforeEach(() => {
  stubStorage()
  atPhoneSize()
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

const config = (() => {
  const made = stageConfigFor('training-yard', CAREER, false, 4242, careerState(), ENV)
  if (typeof made === 'string') throw new Error(made)
  return made
})()

function show(change: Partial<YardState> = {}, locked = false) {
  const onMove = vi.fn()
  const state = { ...YARD_RULES.init(config), ...change }
  renderInApp(careerGame(), <YardView config={config} state={state} onMove={onMove} reducedMotion={false} locked={locked} />)
  return onMove
}

const board = (cells: Record<number, number>): number[] => Array.from({ length: 36 }, (_, cell) => cells[cell] ?? 0)

describe('the Yard\'s view', () => {
  it('places the piece in hand on a tapped empty cell', () => {
    const onMove = show({ hand: 2 })
    fireEvent.click(screen.getByRole('button', { name: 'Row 2, column 3: empty' }))
    expect(onMove).toHaveBeenCalledWith({ code: 0, x: 2, y: 1 })
    expect(screen.getByLabelText('In hand: Power, plain')).toBeTruthy()
  })

  it('holds the piece in hand, then swaps, once a placement', () => {
    const onMove = show()
    fireEvent.click(screen.getByRole('button', { name: 'Hold this piece' }))
    expect(onMove).toHaveBeenCalledWith({ code: 1 })
    cleanup()
    show({ hold: 3, held: false })
    expect(screen.getByRole('button', { name: 'Swap with the held piece' })).toBeTruthy()
    expect(screen.getByLabelText('Held: Guts, plain')).toBeTruthy()
    cleanup()
    show({ hold: 3, held: true })
    expect((screen.getByRole('button', { name: 'Swap with the held piece' }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('draws pieces as Uma faces on stat colours, framed by tier, and Fatigue and Rest as their marks', () => {
    show({ board: board({ 0: pieceCell(0, 2), 1: pieceCell(4, 4), 2: FATIGUE, 3: REST }) })
    const silver = screen.getByRole('button', { name: 'Row 1, column 1: Speed, silver' })
    expect(within(silver).getByRole('img', { name: 'Speed, silver' })).toBeTruthy()
    expect(silver.querySelector('[data-piece="0:2"]')?.className).toMatch(/bg-stat-speed/)
    expect(silver.querySelector('[data-piece="0:2"]')?.className).toMatch(/ring-tier-silver/)
    const rainbow = screen.getByRole('button', { name: 'Row 1, column 2: Wit, rainbow' })
    expect(rainbow.querySelector('[data-piece="4:4"]')?.parentElement?.className).toMatch(/conic-gradient/)
    expect(within(screen.getByRole('button', { name: 'Row 1, column 3: Fatigue' })).getByRole('img', { name: 'Fatigue' })).toBeTruthy()
    expect(within(screen.getByRole('button', { name: 'Row 1, column 4: Rest' })).getByRole('img', { name: 'Rest' })).toBeTruthy()
    // Her face is on the season's focus colour (stamina in season 1).
    expect(config.seasonFocus).toBe('stamina')
    expect(config.uma.id).toBe(UMA)
  })

  it('shows a Partner as its card, with its type and the colours it fits', () => {
    show({ hand: PARTNER_BASE })
    const hand = screen.getByLabelText(/^In hand: Partner/)
    expect(within(hand).getByRole('img', { name: /^Partner: .+, Speed$/ })).toBeTruthy()
    expect(hand.querySelector('[data-piece="partner"]')).toBeTruthy()
  })

  it('keeps every target at 44 pt or more, the yard and pieces in the bottom of the screen', () => {
    show()
    for (const cell of screen.getAllByRole('button', { name: /^Row \d, column \d/ })) expect(cell.className).toMatch(/min-h-11 min-w-11/)
    expect(screen.getByRole('button', { name: 'Hold this piece' }).className).toMatch(/min-h-11/)
    const yard = document.querySelector('[data-racer="yard"]')!
    const order = [...yard.children].map((child) => child.getAttribute('data-racer') ?? child.getAttribute('aria-label'))
    expect(order.indexOf('yard-board')).toBeGreaterThan(order.indexOf('This play'))
    expect(order.indexOf('yard-queue')).toBeGreaterThan(order.indexOf('yard-board'))
  })

  it('takes no taps while locked', () => {
    show({}, true)
    expect(screen.getAllByRole('button', { name: /^Row \d, column \d/ }).every((cell) => (cell as HTMLButtonElement).disabled)).toBe(true)
    expect((screen.getByRole('button', { name: 'Hold this piece' }) as HTMLButtonElement).disabled).toBe(true)
  })
})
