// Replay and settle (D384): a journal replays from its seed move by move, and only a finished one settles, graded and
// paid from the career pay table. A toy game keeps the framework's own rules apart from any real game's.
import { describe, expect, it } from 'vitest'
import { STAGE_PAY_AT_A } from '../career/pay'
import { yardConfig } from '../__fixtures__/stages'
import type { Journal, StageConfig, StageInput, StageRules } from './contract'
import { stageRng } from './rng'
import { isReplayFailure, NO_AWARD, replay, settle, splitDrills, stageAward } from './settle'

/** Five moves; each adds its code (0–3) to the score. The target is 10, and the task is "no zero played". */
interface Toy { readonly moves: number; readonly score: number; readonly zero: boolean }
const TOY: StageRules<Toy> = {
  kind: 'training-yard',
  version: 3,
  maxInputs: 5,
  init: () => ({ moves: 0, score: 0, zero: false }),
  step: (state, input) => (input.code > 3 ? null : { moves: state.moves + 1, score: state.score + input.code, zero: state.zero || input.code === 0 }),
  done: (state) => state.moves >= 5,
  report: (state) => ({ p: state.score / 10, tasks: [!state.zero], score: state.score, drills: { speed: 1, stamina: 1, power: 0, guts: 0, wit: 2 }, bonusSp: 3 }),
  bots: {
    novice: (state, rng) => ({ tick: state.moves, code: rng.below(4) }),
    competent: (state) => ({ tick: state.moves, code: 2 }),
    expert: (state) => ({ tick: state.moves, code: 3 }),
  },
}

const moves = (...codes: number[]): StageInput[] => codes.map((code, tick) => ({ tick, code }))
const journal = (inputs: StageInput[], config: StageConfig = yardConfig(), version = 3): Journal => ({ config, version, inputs })

describe('replay', () => {
  it('runs the moves from init, and replays an unfinished play (a resume)', () => {
    expect(replay(journal(moves(1, 2)), TOY)).toEqual({ moves: 2, score: 3, zero: false })
    expect(replay(journal([]), TOY)).toEqual({ moves: 0, score: 0, zero: false })
  })

  it('refuses another game, another version, too many moves, a tick out of order, an illegal move and a move past the end', () => {
    expect(replay(journal([], { ...yardConfig(), kind: 'furlong-hand' }), TOY)).toEqual({ failed: 'kind' })
    expect(replay(journal([], yardConfig(), 2), TOY)).toEqual({ failed: 'version' })
    expect(replay(journal(moves(1, 1, 1, 1, 1, 1)), TOY)).toEqual({ failed: 'too-long' })
    expect(replay(journal([{ tick: 0, code: 1 }, { tick: 2, code: 1 }]), TOY)).toEqual({ failed: 'illegal', move: 1 })
    expect(replay(journal(moves(1, 9)), TOY)).toEqual({ failed: 'illegal', move: 1 })
    const past: StageRules<Toy> = { ...TOY, maxInputs: 9 }
    expect(replay(journal(moves(1, 1, 1, 1, 1, 1)), past)).toEqual({ failed: 'illegal', move: 5 })
  })
})

describe('settle', () => {
  it('grades a finished play and pays the game\'s pay at A × the grade, drills split by the report, plus its bonus SP', () => {
    const settled = settle(journal(moves(3, 3, 2, 2, 0)), TOY)
    if (isReplayFailure(settled)) throw new Error(settled.failed)
    expect(settled.grade).toBe('A')
    expect(settled.report.p).toBe(1)
    const yard = STAGE_PAY_AT_A['training-yard']
    expect(settled.pay).toEqual({ drills: splitDrills(yard.drills, { speed: 1, stamina: 1, power: 0, guts: 0, wit: 2 }), bond: 0, sp: yard.sp + 3 })
    expect(Object.values(settled.pay.drills).reduce((a, b) => a + b, 0)).toBe(yard.drills)
  })

  it('reaches S by every task at A, and D pays a quarter', () => {
    const s = settle(journal(moves(3, 3, 3, 1, 1)), TOY)
    const d = settle(journal(moves(0, 0, 0, 1, 1)), TOY)
    if (isReplayFailure(s) || isReplayFailure(d)) throw new Error('unsettled')
    expect([s.grade, d.grade]).toEqual(['S', 'D'])
    expect(Object.values(d.pay.drills).reduce((a, b) => a + b, 0)).toBe(Math.round(STAGE_PAY_AT_A['training-yard'].drills * 0.25))
  })

  it('pays nothing in practice, and refuses an unfinished play', () => {
    const practice = settle(journal(moves(3, 3, 3, 3, 3), yardConfig({ practice: true })), TOY)
    if (isReplayFailure(practice)) throw new Error(practice.failed)
    expect(practice.grade).toBe('S')
    expect(practice.pay).toEqual(NO_AWARD)
    expect(settle(journal(moves(3, 3)), TOY)).toEqual({ failed: 'unfinished', move: 2 })
  })

  it('settles every bot play the same way twice', () => {
    for (const level of ['novice', 'competent', 'expert'] as const) {
      const rng = stageRng(7)
      let state = TOY.init(yardConfig())
      const inputs: StageInput[] = []
      while (!TOY.done(state)) {
        const input = TOY.bots[level](state, rng)
        inputs.push(input)
        state = TOY.step(state, input)!
      }
      expect(settle(journal(inputs), TOY)).toEqual(settle(journal(inputs), TOY))
    }
  })
})

describe('the pay', () => {
  it('splits drills by largest remainder, ties to the earlier colour, and pays none for no weight', () => {
    expect(splitDrills(10, { speed: 1, stamina: 1, power: 1, guts: 0, wit: 0 })).toEqual({ speed: 4, stamina: 3, power: 3, guts: 0, wit: 0 })
    expect(splitDrills(200, { speed: 50, stamina: 25, power: 25, guts: 0, wit: 0 })).toEqual({ speed: 100, stamina: 50, power: 50, guts: 0, wit: 0 })
    expect(splitDrills(7, { speed: 0, stamina: 0, power: 0, guts: 0, wit: 0 })).toEqual({ speed: 0, stamina: 0, power: 0, guts: 0, wit: 0 })
  })

  it('pays Furlong Hand\'s Bond and SP with no drills', () => {
    const award = stageAward('furlong-hand', 'B', { p: 0.8, tasks: [], score: 0 }, false)
    expect(award).toEqual({ drills: { speed: 0, stamina: 0, power: 0, guts: 0, wit: 0 }, bond: Math.round(STAGE_PAY_AT_A['furlong-hand'].bond * 0.8), sp: Math.round(STAGE_PAY_AT_A['furlong-hand'].sp * 0.8) })
  })
})
