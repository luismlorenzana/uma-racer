// Furlong Hand's rules (D385), each on a spread written as text: chaining (colour, one higher, 6 → 1, wild), run and
// bank, the chain's Drive, flips and Breath, the free redraw, a leg's end (clean, cards left, the pile out), the line
// (rail, closed rail, middle, outside), the band, the spurt (Drive, the second wind), 0 Breath, the finish, the report,
// and refused moves.
import { describe, expect, it } from 'vitest'
import { furlongAt, furlongConfig, showColumns } from '../../__fixtures__/furlong'
import {
  BAND_DRIVE, CHAIN_AT, CLEAN_DRIVE, COLUMNS, dealSpread, DEPTH, DRIVE_BASE, FIELD, FLIP_BREATH, follows, furlongTasks, initFurlong, LENGTH, LINE,
  OUTSIDE_BREATH, PILE, PLACE_P, placings, playableColumns, reportFurlong, rivalGain, runYield, SECOND_WIND, SPURT_DEPTH, stepFurlong,
  styleBand, type FurlongState,
} from './rules'

const run = (state: FurlongState, x: number) => stepFurlong(state, { tick: state.moves, code: 0, x })
const bank = (state: FurlongState, x: number) => stepFurlong(state, { tick: state.moves, code: 1, x })
const flip = (state: FurlongState) => stepFurlong(state, { tick: state.moves, code: 2 })
const line = (state: FurlongState, x: number) => stepFurlong(state, { tick: state.moves, code: 3, x })
const redraw = (state: FurlongState) => stepFurlong(state, { tick: state.moves, code: 4 })
const must = (state: FurlongState | null): FurlongState => {
  if (state === null) throw new Error('That move isn\'t legal')
  return state
}

// The invented medium course: legs straight, corner, corner, climb, corner; the spurt a straight. Every colour's yield
// is +13% (a card of each type: its Training Effectiveness 6, Stat Bonus 1 × 4, and half the Friend card's 6).
const PILE_OF = ['t1', 't1', 't1']

describe('chaining', () => {
  it('plays a front card of the lead\'s colour, or exactly one higher, with 6 followed by 1', () => {
    const state = furlongAt({ columns: ['s5', 't3', 'p6', 'g1'], lead: 'p2', pile: PILE_OF })
    expect(playableColumns(state)).toEqual([1, 2])
    expect(playableColumns(furlongAt({ columns: ['s1', 't3', 'p5', 'g2'], lead: 'w6', pile: PILE_OF }))).toEqual([0])
  })

  it('lets a wild card follow anything, and anything follow a wild lead', () => {
    expect(playableColumns(furlongAt({ columns: ['*4', 't3', 'p5', 'g2'], lead: 's6', pile: PILE_OF }))).toEqual([0])
    expect(playableColumns(furlongAt({ columns: ['s4', 't3', 'p5', 'g2'], lead: '*6', pile: PILE_OF }))).toEqual([0, 1, 2, 3])
  })

  it('reads only the front card of each column, and plays the next one once the front is gone', () => {
    const state = furlongAt({ columns: ['s2 t5', 'g6', 'g6', 'g6'], lead: 't4', pile: PILE_OF })
    expect(playableColumns(state)).toEqual([0])
    const after = must(run(state, 0))
    expect(showColumns(after)).toEqual(['s2', 'g6', 'g6', 'g6'])
    expect(follows(after, after.columns[0]![0]!)).toBe(false) // t5 is the lead now: s2 is neither Stamina nor a 6
  })
})

describe('run and bank', () => {
  it('runs a card for ground by its colour: her class, the terrain (Speed on a straight) and the deck', () => {
    // Leg 0 is a straight: Speed 2 + 1 points, Stamina 2, at +13%.
    const state = furlongAt({ columns: ['s1', 't2', 'g6', 'g6'], lead: 's6', pile: PILE_OF })
    expect(runYield(state, state.columns[0]![0]!).ground).toBe(Math.floor((6 * 10 * 113) / 200))
    expect(runYield(state, state.columns[1]![0]!).ground).toBe(Math.floor((4 * 10 * 113) / 200))
    const after = must(run(state, 0))
    expect(after.ground - state.ground).toBe(33)
    expect(after.events[0]).toEqual({ kind: 'run', card: state.columns[0]![0]!, column: 0, ground: 33, fired: false })
  })

  it('moves her class half a point a class, and Power gains on a corner or a climb', () => {
    const corner = furlongAt({ columns: ['p1', 's1', 'g6', 'g6'], lead: 'p6', pile: PILE_OF }, { spread: 1 })
    expect(runYield(corner, corner.columns[0]![0]!).ground).toBe(Math.floor((6 * 10 * 113) / 200))
    expect(runYield(corner, corner.columns[1]![0]!).ground).toBe(Math.floor((4 * 10 * 113) / 200))
    const strong = furlongAt({ columns: ['p1', 's1', 'g6', 'g6'], lead: 'p6', pile: PILE_OF }, { spread: 1, classes: [2, 0, 1, 0, 0] })
    expect(runYield(strong, strong.columns[0]![0]!).ground).toBe(Math.floor((7 * 10 * 113) / 200))
    expect(runYield(strong, strong.columns[1]![0]!).ground).toBe(Math.floor((6 * 10 * 113) / 200))
  })

  it('banks a card for a Drive and no ground', () => {
    const state = furlongAt({ columns: ['s1', 'g6', 'g6', 'g6'], lead: 's6', pile: PILE_OF })
    const after = must(bank(state, 0))
    expect([after.ground, after.drive]).toEqual([state.ground, state.drive + 1])
    expect(after.events[0]).toMatchObject({ kind: 'bank', column: 0 })
  })

  it('pays a Drive once a chain reaches four, and a flip starts a new chain', () => {
    let state = furlongAt({ columns: ['s1 s2 s3 s4', 'g6', 'g6', 'g6'], lead: 's6', pile: ['s5', ...PILE_OF] }, { drive: 0 })
    for (let i = 0; i < CHAIN_AT - 1; i += 1) state = must(run(state, 0))
    expect([state.chain, state.drive]).toEqual([CHAIN_AT - 1, 0])
    state = must(run(state, 0))
    expect([state.chain, state.drive, state.chainPaid]).toEqual([CHAIN_AT, 1, true])
    expect(state.events).toContainEqual({ kind: 'chain', drive: 1 })
    state = must(flip(state))
    expect([state.chain, state.chainPaid]).toEqual([0, false])
  })
})

describe('flips and the free redraw', () => {
  it('flips the next draw card as the lead for a Breath, at any time, and never below 0', () => {
    const state = furlongAt({ columns: ['s1', 'g6', 'g6', 'g6'], lead: 't3', pile: ['p6', 'w2'] }, { breath: 1 })
    const once = must(flip(state))
    expect(once.cards[once.lead]).toMatchObject({ colour: 2, value: 6 })
    expect([once.breath, once.pile.length]).toEqual([1 - FLIP_BREATH, 1])
    const twice = must(flip(once))
    expect(twice.breath).toBe(0)
    expect(flip({ ...twice, pile: [] })).toBeNull()
  })

  it('redraws a spread once, free, before any card is played or flipped: a new deal and a new lead', () => {
    const start = initFurlong(furlongConfig())
    const open = must(line(start, LINE.middle))
    expect([open.redrawn, open.pile.length]).toEqual([false, PILE - 1])
    const again = must(redraw(open))
    expect(again.columns).not.toEqual(open.columns)
    expect([again.redrawn, again.breath, again.pile.length]).toEqual([true, open.breath, PILE - 1])
    expect(again.events.map((event) => event.kind)).toEqual(['redraw', 'lead'])
    expect(redraw(again)).toBeNull()
    const played = playableColumns(open).length > 0 ? must(run(open, playableColumns(open)[0]!)) : must(flip(open))
    expect(redraw(played)).toBeNull()
  })
})

describe('a leg\'s end', () => {
  it('ends a clear spread as a clean leg: +2 Drive, then the line before the next spread', () => {
    const state = furlongAt({ columns: ['s1', '', '', ''], lead: 's6', pile: PILE_OF }, { drive: 0, band: [1, 9] })
    const after = must(run(state, 0))
    expect(after.phase).toBe('line')
    expect(after.spread).toBe(1)
    expect(after.cleanSpreads).toBe(1)
    expect(after.drive).toBe(CLEAN_DRIVE + BAND_DRIVE)
    expect(after.events).toContainEqual(expect.objectContaining({ kind: 'leg-end', spread: 0, left: 0, clean: true }))
    expect([after.lead, after.redrawn, after.blocked]).toEqual([-1, false, -1])
  })

  it('deals each leg four columns three deep and a pile of eight, from the seed', () => {
    const start = initFurlong(furlongConfig())
    expect(start.columns.map((column) => column.length)).toEqual([DEPTH, DEPTH, DEPTH, DEPTH])
    expect(start.pile).toHaveLength(PILE)
    expect(new Set([...start.columns.flat(), ...start.pile]).size).toBe(COLUMNS * DEPTH + PILE)
    expect(initFurlong(furlongConfig()).columns).toEqual(start.columns)
    expect(initFurlong(furlongConfig({ seed: 7 })).columns).not.toEqual(start.columns)
  })

  it('ends when the pile is out and nothing plays, and every card left lets each rival gain', () => {
    const state = furlongAt({ columns: ['g6 g6', 'g6', '', ''], lead: 's1', pile: ['t3'] })
    const after = must(flip(state)) // t3: nothing follows, and the pile is out
    expect(after.phase).toBe('line')
    expect(after.events).toContainEqual(expect.objectContaining({ kind: 'leg-end', left: 3, clean: false }))
    expect(after.rivalGround).toEqual(state.rivalGround.map((g, r) => g + rivalGain(state, r, 0, 3)))
    expect(rivalGain(state, 0, 0, 3) - rivalGain(state, 0, 0, 0)).toBe(3 * FIELD.left)
  })

  it('places her by ground (she takes a tie), and pays a Drive in band or costs a Breath out of it', () => {
    expect(placings(100, [120, 100, 80])).toEqual({ her: 2, rivals: [1, 3, 4] })
    const rivals = [5000, 5000, 5000, 5000, 5000, 5000, 5000, 5000]
    const trailing = furlongAt({ columns: ['s1', '', '', ''], lead: 's6', pile: PILE_OF }, { rivalGround: rivals, ground: 0, band: [1, 2], breath: 5, drive: 0 })
    const out = must(run(trailing, 0))
    expect([out.place, out.breath, out.drive, out.legsInBand]).toEqual([9, 4, CLEAN_DRIVE, 0])
    expect(out.events).toContainEqual(expect.objectContaining({ kind: 'leg-end', inBand: false, place: 9 }))
    const band = must(run({ ...trailing, band: [9, 9] }, 0))
    expect([band.breath, band.drive, band.legsInBand]).toEqual([5, CLEAN_DRIVE + BAND_DRIVE, 1])
  })

  it('never lets a rival get more than ten lengths clear at a leg\'s end', () => {
    const state = furlongAt({ columns: ['s1', '', '', ''], lead: 's6', pile: PILE_OF }, { rivalGround: [99_999, 0, 0, 0, 0, 0, 0, 0], ground: 0 })
    const after = must(run(state, 0))
    expect(after.rivalGround[0]).toBe(after.ground + FIELD.slip)
    expect(FIELD.slip).toBe(10 * LENGTH)
  })
})

describe('the line', () => {
  const closing = (state: FurlongState, spread: number): FurlongState => ({
    ...state, rivals: state.rivals.map((rival, r) => ({ ...rival, script: rival.script.map((move, s) => (s === spread ? (r === 0 ? 3 : 1) : move)) })),
  })
  const open = (state: FurlongState, spread: number): FurlongState => ({
    ...state, rivals: state.rivals.map((rival) => ({ ...rival, script: rival.script.map((move, s) => (s === spread ? 1 : move)) })),
  })

  it('takes the rail: the leg\'s favoured colour gains a point, and the leg opens on the pile\'s first card', () => {
    const start = open(initFurlong(furlongConfig()), 0)
    const railed = must(line(start, LINE.rail))
    expect([railed.phase, railed.line, railed.blocked, railed.lead, railed.pile.length]).toEqual(['leg', LINE.rail, -1, start.pile[0], PILE - 1])
    const speed = railed.cards.findIndex((card) => card.kind === 'stride' && card.colour === 0)
    expect(runYield(railed, speed).ground).toBe(Math.floor((8 * 10 * 113) / 200))
  })

  it('shuts the rail\'s column when a rival closes it, until a Power or Wit card is played', () => {
    const start = closing(initFurlong(furlongConfig()), 0)
    const railed = must(line(start, LINE.rail))
    expect(railed.blocked).toBe(0)
    expect(railed.events[0]).toEqual({ kind: 'line', line: LINE.rail, blocked: true, breath: 0 })
    const table = furlongAt({ columns: ['s4', 'w5 s4', 'g6', 'g6'], lead: 's3', pile: PILE_OF }, { blocked: 0 })
    expect(playableColumns(table)).toEqual([1])
    const pushed = must(run(must(run(table, 1)), 1))
    expect(pushed.blocked).toBe(-1)
    expect(pushed.events).toContainEqual({ kind: 'unblock' })
  })

  it('costs a Breath on the outside, which is never shut, and lifts Speed a point; the middle is neutral', () => {
    const start = closing(initFurlong(furlongConfig()), 0)
    const outside = must(line(start, LINE.outside))
    expect([outside.blocked, outside.breath]).toEqual([-1, start.breath - OUTSIDE_BREATH])
    const speed = outside.cards.findIndex((card) => card.kind === 'stride' && card.colour === 0)
    expect(runYield(outside, speed).ground).toBe(Math.floor((8 * 10 * 113) / 200))
    const middle = must(line(start, LINE.middle))
    expect([middle.blocked, middle.breath, runYield(middle, speed).ground]).toEqual([-1, start.breath, Math.floor((6 * 10 * 113) / 200)])
  })
})

describe('her band', () => {
  it('runs Front 1–2, Pace 2–4, Late 4–7 and End 6–9, widened by an S aptitude and narrowed by C or worse', () => {
    expect([styleBand('front', 'A'), styleBand('pace', 'A'), styleBand('late', 'B'), styleBand('end', 'A')]).toEqual([[1, 2], [2, 4], [4, 7], [6, 9]])
    expect([styleBand('pace', 'S'), styleBand('end', 'S')]).toEqual([[1, 5], [5, 9]])
    expect([styleBand('front', 'C'), styleBand('late', 'D')]).toEqual([[1, 1], [5, 7]])
  })
})

describe('the spurt', () => {
  const spurtAt = (change: Partial<FurlongState> = {}) =>
    furlongAt({ columns: ['s1', 'g2', 'g6', 'g6'], lead: 's6', pile: PILE_OF }, { spread: 5, ...change })

  it('multiplies every run card by her Drive, and Guts gains a point on the home stretch', () => {
    const flat = spurtAt({ drive: 0 })
    const fired = spurtAt({ drive: 18 })
    const speed = flat.columns[0]![0]!
    const base = Math.floor((6 * 10 * 113) / 200)
    expect(runYield(flat, speed).ground).toBe(base)
    expect(runYield(fired, speed).ground).toBe(Math.floor((base * (DRIVE_BASE + 18)) / DRIVE_BASE))
    expect(runYield(flat, flat.columns[1]![0]!).ground).toBe(Math.floor((6 * 10 * 113) / 200))
  })

  it('opens with the deck\'s Race Bonus as Drive and her second wind, after the last leg', () => {
    const last = furlongAt({ columns: ['s1', '', '', ''], lead: 's6', pile: PILE_OF }, { spread: 4, breath: 0, drive: 5, spurtDrive: 2, band: [9, 9] })
    const after = must(run(last, 0))
    expect([after.phase, after.spread, after.breath]).toEqual(['line', 5, SECOND_WIND])
    expect(after.drive).toBe(5 + CLEAN_DRIVE + BAND_DRIVE + 2)
    expect(after.events).toContainEqual({ kind: 'spurt', drive: 2, breath: SECOND_WIND })
    const real = initFurlong(furlongConfig())
    expect(dealSpread(real, real.legs.length).columns.map((column) => column.length)).toEqual([SPURT_DEPTH, SPURT_DEPTH, SPURT_DEPTH, SPURT_DEPTH])
  })

  it('finishes when the spurt\'s spread ends: her place by ground, and her margin when she wins', () => {
    const state = spurtAt({ columns: [[0], [], [], []], ground: 10_000, rivalGround: [9_000, 100, 100, 100, 100, 100, 100, 100] })
    const after = must(run(state, 0))
    expect(after.phase).toBe('finished')
    expect(after.finish!.place).toBe(1)
    expect(after.finish!.margin).toBe(after.ground - Math.max(...after.rivalGround))
    expect(stepFurlong(after, { tick: after.moves, code: 2 })).toBeNull()
  })
})

describe('Breath at 0', () => {
  it('halves Speed and Power, and Guts keeps its full yield', () => {
    const table = furlongAt({ columns: ['s1', 'p1', 'g1', 'w1'], lead: 's6', pile: PILE_OF })
    const tired = { ...table, breath: 0 }
    const [s, p, g] = [0, 1, 2].map((c) => table.columns[c]![0]!)
    expect(runYield(tired, s!).ground).toBe(Math.floor(runYield(table, s!).ground / 2))
    expect(runYield(tired, p!).ground).toBe(Math.floor(runYield(table, p!).ground / 2))
    expect(runYield(tired, g!).ground).toBe(runYield(table, g!).ground)
  })
})

describe('the report', () => {
  const finished = (place: number, margin: number, change: Partial<FurlongState> = {}): FurlongState =>
    ({ ...initFurlong(furlongConfig()), phase: 'finished', finish: { place, margin }, ...change })

  it('maps the finish to p: a win is A (a hundredth a length clear, under S), 2nd–3rd B, 4th–5th C, then D', () => {
    expect(reportFurlong(finished(1, 3 * LENGTH + 10)).p).toBe(1.03)
    expect(reportFurlong(finished(1, 40 * LENGTH)).p).toBe(1.19)
    expect([2, 3, 4, 5, 6, 9].map((place) => reportFurlong(finished(place, 0)).p)).toEqual([0.875, 0.75, 0.625, 0.5, 0.375, 0])
    expect(PLACE_P).toHaveLength(9)
    expect(reportFurlong(finished(4, 0)).score).toBe(4)
  })

  it('counts the four tasks: won 2 lengths clear, two clean spreads, every Partner played, every leg in band', () => {
    const all = finished(1, 2 * LENGTH, { cleanSpreads: 2, played: 0b111111, legsInBand: 5 })
    expect(furlongTasks(all)).toEqual([true, true, true, true])
    expect(furlongTasks({ ...all, finish: { place: 1, margin: 2 * LENGTH - 1 } })[0]).toBe(false)
    expect(furlongTasks({ ...all, finish: { place: 2, margin: 0 } })[0]).toBe(false)
    expect(furlongTasks({ ...all, cleanSpreads: 1 })[1]).toBe(false)
    expect(furlongTasks({ ...all, played: 0b011111 })[2]).toBe(false)
    expect(furlongTasks({ ...all, legsInBand: 4 })[3]).toBe(false)
    expect(furlongTasks({ ...all, partners: [] })[2]).toBe(false)
  })

  it('reports the Partners\' SP on top, and pays nothing in drills', () => {
    expect(reportFurlong(finished(3, 0, { bonusSp: 4 }))).toEqual({ p: 0.75, tasks: [false, false, false, false], score: 3, bonusSp: 4 })
  })
})

describe('refused moves', () => {
  it('refuses a column that doesn\'t play, a card off the table, a move out of its phase, and unknown moves', () => {
    const state = furlongAt({ columns: ['s1', 'g6', '', 'g6'], lead: 's6', pile: PILE_OF })
    expect(run(state, 1)).toBeNull()
    expect(run(state, 2)).toBeNull()
    expect(run(state, 4)).toBeNull()
    expect(stepFurlong(state, { tick: 0, code: 0 })).toBeNull()
    expect(stepFurlong(state, { tick: 0, code: 0, x: 0, y: 1 })).toBeNull()
    expect(line(state, LINE.rail)).toBeNull()
    expect(stepFurlong(state, { tick: 0, code: 9 })).toBeNull()
    const start = initFurlong(furlongConfig())
    expect([run(start, 0), flip(start), redraw(start), line(start, 3)]).toEqual([null, null, null, null])
  })
})
