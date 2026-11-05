// Training Yard's rules (D384), each on a yard drawn as text: merges and their pay, cascades, Partners and wild cards,
// Masterclass, Fatigue's drift, Rest and its clear, the hold, the end, the tasks, the report and the queue.
import { describe, expect, it } from 'vitest'
import { drawBoard, showBoard, yardConfig, yardWith, DECK_IDS } from '../../__fixtures__/stages'
import {
  cellAt, FATIGUE_FREE, FATIGUE_PIECE, initYard, MASTERCLASS_DRILLS, PARTNER_BASE, REST_SP, reportYard, stepYard, YARD_LADDER,
  YARD_PLACEMENTS, YARD_QUEUE, YARD_TARGET, yardDone, yardQueue, yardTasks, type YardState,
} from './rules'

const SWEAT = YARD_LADDER[0]!
const [SPEED, STAMINA, , , WIT] = [0, 1, 2, 3, 4]
/** Her deck's cards as Partner pieces: speed, stamina, power, guts, wit, Friend. */
const PARTNER = { speed: PARTNER_BASE, stamina: PARTNER_BASE + 1, friend: PARTNER_BASE + 5 }

const EMPTY_ROW = '. . . . . .'
const rows = (...top: string[]): string[] => [...top, ...Array.from({ length: 6 - top.length }, () => EMPTY_ROW)]

function place(state: YardState, x: number, y: number): YardState {
  const next = stepYard(state, { tick: state.moves, code: 0, x, y })
  if (next === null) throw new Error(`(${x}, ${y}) isn't legal`)
  return next
}

describe('merges', () => {
  it('merges three touching pieces of one colour and tier one tier up, on the cell just placed', () => {
    const after = place(yardWith(rows('s0 s0 . . . .'), SPEED), 2, 0)
    expect(showBoard(after.board)[0]).toBe('. . s1 . . .')
    expect(after.score).toBe(SWEAT + YARD_LADDER[1]!)
    expect(after.drills).toEqual([SWEAT + YARD_LADDER[1]!, 0, 0, 0, 0])
    expect(after.events.map((event) => event.kind)).toEqual(['place', 'merge'])
  })

  it('merges a bigger group the same way, and every piece set down pays its Sweat', () => {
    const after = place(yardWith(rows('s0 s0 . s0 . .'), SPEED), 2, 0)
    expect(showBoard(after.board)[0]).toBe('. . s1 . . .')
    const lone = place(yardWith(rows(), WIT), 0, 0)
    expect([lone.score, lone.drills[WIT]]).toEqual([SWEAT, SWEAT])
  })

  it('needs orthogonal touch, one colour and one tier', () => {
    expect(showBoard(place(yardWith(rows('s0 s0 . . . .'), SPEED), 2, 1).board).slice(0, 2)).toEqual(['s0 s0 . . . .', '. . s0 . . .'])
    expect(place(yardWith(rows('s0 s0 . . . .'), STAMINA), 2, 0).score).toBe(SWEAT)
    expect(place(yardWith(rows('s0 s1 . . . .'), SPEED), 2, 0).score).toBe(SWEAT)
  })

  it('cascades: the new piece merges again with its new tier', () => {
    const after = place(yardWith(rows('s1 s1 . s0 . .', '. . s0 . . .'), SPEED), 2, 0)
    expect(showBoard(after.board).slice(0, 2)).toEqual(['. . s2 . . .', EMPTY_ROW])
    expect(after.score).toBe(SWEAT + YARD_LADDER[1]! + YARD_LADDER[2]!)
    expect(after.events.filter((event) => event.kind === 'merge').map((event) => event.kind === 'merge' && event.tier)).toEqual([1, 2])
  })

  it('clears three rainbows for a Masterclass', () => {
    const after = place(yardWith(rows('s4 s4 . . . .'), PARTNER.speed), 2, 0)
    expect(showBoard(after.board)[0]).toBe(EMPTY_ROW)
    expect(after.score).toBe(SWEAT + MASTERCLASS_DRILLS)
    expect(after.masterclasses).toBe(1)
    expect(after.events.at(-1)).toMatchObject({ kind: 'masterclass', colour: SPEED, drills: MASTERCLASS_DRILLS })
  })
})

describe('Partners', () => {
  it('join a merge of their colour at any tier and lift it one more tier', () => {
    const after = place(yardWith(rows('s0 s0 . . . .'), PARTNER.speed), 2, 0)
    expect(showBoard(after.board)[0]).toBe('. . s2 . . .')
    expect(after.score).toBe(SWEAT + YARD_LADDER[2]!)
    expect([after.partnersPlaced, after.partnersMerged]).toEqual([1, 1])
    expect(after.events.at(-1)).toMatchObject({ kind: 'merge', tier: 2, lift: 1 })
  })

  it('lift two tiers at bond 80, so a plain trio makes gold', () => {
    const after = place(yardWith(rows('s0 s0 . . . .'), PARTNER.speed, { bonds: { 'sim-speed-2': 80 } }), 2, 0)
    expect(showBoard(after.board)[0]).toBe('. . s3 . . .')
    expect(after.golds).toBe(1 << SPEED)
  })

  it('take the highest tier they can merge, and stop at rainbow', () => {
    const after = place(yardWith(rows('. s2 . . . .', 's0 . s2 . . .', '. s0 . . . .'), PARTNER.speed), 1, 1)
    expect(showBoard(after.board).slice(0, 3)).toEqual(['. . . . . .', 's0 s4 . . . .', '. s0 . . . .'])
  })

  it('settle as a plain piece of their colour where nothing of it merges', () => {
    const after = place(yardWith(rows('s0 s0 . . . .'), PARTNER.stamina), 2, 0)
    expect(showBoard(after.board)[0]).toBe('s0 s0 t0 . . .')
    expect([after.partnersPlaced, after.partnersMerged]).toEqual([1, 0])
  })

  it('are wild as Friend and Group cards: any colour, and the season\'s focus when nothing merges', () => {
    const wit = place(yardWith(rows('w0 w0 . . . .'), PARTNER.friend), 2, 0)
    expect(showBoard(wit.board)[0]).toBe('. . w2 . . .')
    const lone = place(yardWith(rows(), PARTNER.friend, { focus: 'power' }), 0, 0)
    expect(showBoard(lone.board)[0]).toBe('p0 . . . . .')
  })
})

describe('Fatigue and Rest', () => {
  it('steps each Fatigue one cell toward the highest-tier piece after a placement (north, west, east, south)', () => {
    const after = place(yardWith(rows('F . . . . .', EMPTY_ROW, EMPTY_ROW, EMPTY_ROW, EMPTY_ROW, '. . . . . s2'), WIT), 3, 3)
    expect(showBoard(after.board)[0]).toBe('. F . . . .')
    expect(after.events).toContainEqual({ kind: 'move', from: cellAt(0, 0), to: cellAt(1, 0) })
  })

  it('leaves the Fatigue just placed where it was put', () => {
    const after = place(yardWith(rows(EMPTY_ROW, EMPTY_ROW, EMPTY_ROW, EMPTY_ROW, EMPTY_ROW, '. . . . . s2'), FATIGUE_PIECE), 0, 0)
    expect(showBoard(after.board)[0]).toBe('F . . . . .')
    expect(after.score).toBe(0) // Fatigue pays no Sweat
  })

  it('doesn\'t step where no empty cell is closer, and turns a boxed-in Fatigue to Rest', () => {
    const after = place(yardWith(rows('F t0 . . . .', 'g0 . . . . .'), WIT), 5, 5)
    expect(showBoard(after.board).slice(0, 2)).toEqual(['R t0 . . . .', 'g0 . . . . .'])
    expect(after.events).toContainEqual({ kind: 'rest', cell: 0 })
  })

  it('clears three touching Rests and every Fatigue around them, for a little SP', () => {
    const start = yardWith(rows('R R F t0 . .', 'g0 p0 w0 F . .'), WIT)
    const after = place(start, 5, 5)
    expect(showBoard(after.board).slice(0, 2)).toEqual(['. . . t0 . .', 'g0 p0 w0 . . .'])
    expect(after.sp).toBe(REST_SP)
    expect(after.events.at(-1)).toEqual({ kind: 'rest-clear', cells: [0, 1, 2], fatigue: [cellAt(3, 1)], sp: REST_SP })
  })
})

describe('the hold and the end', () => {
  it('holds once a placement: the first takes the next piece, later ones swap', () => {
    const start = initYard(yardConfig())
    const held = stepYard(start, { tick: 0, code: 1 })!
    expect([held.hand, held.hold, held.drawn, held.held, held.moves]).toEqual([start.queue[1], start.queue[0], 2, true, 1])
    expect(stepYard(held, { tick: 1, code: 1 })).toBeNull()
    const placed = place({ ...held, hand: WIT }, 0, 0)
    expect(placed.held).toBe(false)
    const swapped = stepYard(placed, { tick: placed.moves, code: 1 })!
    expect([swapped.hand, swapped.hold, swapped.drawn]).toEqual([placed.hold, placed.hand, placed.drawn])
  })

  it('refuses a taken cell, an off-yard cell, an unknown move and a hold with a place', () => {
    const start = yardWith(rows('s0 . . . . .'), SPEED)
    expect(stepYard(start, { tick: 0, code: 0, x: 0, y: 0 })).toBeNull()
    expect(stepYard(start, { tick: 0, code: 0, x: 6, y: 0 })).toBeNull()
    expect(stepYard(start, { tick: 0, code: 0, x: 1 })).toBeNull()
    expect(stepYard(start, { tick: 0, code: 7 })).toBeNull()
    expect(stepYard(start, { tick: 0, code: 1, x: 1, y: 1 })).toBeNull()
  })

  it('ends on a full yard, and after 60 placements', () => {
    // Colours by (x + 2y) mod 5: no two neighbours match, so the last placement fills the yard.
    const full = Array.from({ length: 6 }, (_, y) => Array.from({ length: 6 }, (_, x) => `${'stpgw'[(x + 2 * y) % 5]}0`).join(' '))
    const last = full.map((row, y) => (y === 5 ? row.replace(/\S+$/, '.') : row))
    const done = place(yardWith(last, SPEED), 5, 5)
    expect(yardDone(done)).toBe(true)
    expect(stepYard(done, { tick: done.moves, code: 1 })).toBeNull()
    const sixty = { ...initYard(yardConfig()), placed: YARD_PLACEMENTS }
    expect(yardDone(sixty)).toBe(true)
  })
})

describe('the tasks and the report', () => {
  it('counts gold in two colours, no Fatigue left, and every Partner placed merged', () => {
    const base = yardWith(rows(), SPEED)
    expect(yardTasks({ ...base, golds: 0b00101, partnersPlaced: 2, partnersMerged: 2 })).toEqual([true, true, true])
    expect(yardTasks({ ...base, golds: 0b00100, partnersPlaced: 2, partnersMerged: 2 })).toEqual([false, true, true])
    expect(yardTasks({ ...base, board: drawBoard(rows('F . . . . .')), golds: 3, partnersPlaced: 2, partnersMerged: 1 })).toEqual([true, false, false])
    expect(yardTasks({ ...base, golds: 3, partnersPlaced: 0, partnersMerged: 0 })[2]).toBe(false)
  })

  it('reports the score over the target, and splits drills by colour (by the queue\'s weights before anything is scored)', () => {
    const after = place(yardWith(rows('w0 w0 . . . .'), WIT), 2, 0)
    const report = reportYard(after)
    expect(report.p).toBe(after.score / YARD_TARGET)
    expect(report.drills).toEqual({ speed: 0, stamina: 0, power: 0, guts: 0, wit: after.score })
    expect(report.bonusSp).toBe(0)
    const fresh = reportYard(initYard(yardConfig({ focus: 'guts', growth: { speed: 0, stamina: 0, power: 0, guts: 0, wit: 0.2 } })))
    expect(fresh.drills).toEqual({ speed: 20000, stamina: 20000, power: 20000, guts: 30000, wit: 24000 })
  })
})

describe('the queue', () => {
  const count = (configs: number, pick: (queue: number[]) => number, options: Parameters<typeof yardConfig>[0] = {}) =>
    Array.from({ length: configs }, (_, seed) => pick(yardQueue(yardConfig({ ...options, seed })))).reduce((a, b) => a + b, 0)

  it('is the seed\'s, 64 long, with no Fatigue among its first pieces', () => {
    expect(yardQueue(yardConfig({ seed: 9 }))).toEqual(yardQueue(yardConfig({ seed: 9 })))
    expect(yardQueue(yardConfig({ seed: 9 }))).not.toEqual(yardQueue(yardConfig({ seed: 10 })))
    expect(yardQueue(yardConfig())).toHaveLength(YARD_QUEUE)
    for (let seed = 0; seed < 50; seed += 1) expect(yardQueue(yardConfig({ seed })).slice(0, FATIGUE_FREE)).not.toContain(FATIGUE_PIECE)
  })

  it('tilts toward the season\'s focus, and brings each card more often for its Specialty Priority', () => {
    const focus = count(200, (queue) => queue.filter((piece) => piece === STAMINA).length, { focus: 'stamina' })
    const plain = count(200, (queue) => queue.filter((piece) => piece === STAMINA).length, { focus: 'speed' })
    expect(focus).toBeGreaterThan(plain * 1.3)
    // sim-speed-0 has Specialty Priority 25, sim-speed-4 85.
    const low = count(200, (queue) => queue.filter((piece) => piece === PARTNER_BASE).length, { deck: ['sim-speed-0'] })
    const high = count(200, (queue) => queue.filter((piece) => piece === PARTNER_BASE).length, { deck: ['sim-speed-4'] })
    expect(high).toBeGreaterThan(low)
    expect(count(50, (queue) => queue.filter((piece) => piece >= PARTNER_BASE && piece < FATIGUE_PIECE).length, { deck: [] })).toBe(0)
    expect(DECK_IDS).toHaveLength(6)
  })
})
