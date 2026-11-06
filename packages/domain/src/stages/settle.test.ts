// Replay and settle (D384, D391): a journal replays from its seed move by move, and only a finished one settles, graded
// and paid the one bundle every game pays. A toy game keeps the framework's own rules apart from any real game's; then
// every registered game, played by its bot, pays the same at every grade, and only its drill split differs.
import { describe, expect, it } from 'vitest'
import { STAGE_PAY_AT_A } from '../career/pay'
import { furlongConfig } from '../__fixtures__/furlong'
import { yardConfig } from '../__fixtures__/stages'
import { STATS, type Stats } from '../types'
import type { Journal, StageConfig, StageInput, StageKind, StageRules } from './contract'
import { PAY_MULTIPLIERS, STAGE_GRADES } from './grade'
import { registeredStages, stageRules } from './registry'
import { stageRng } from './rng'
import { isReplayFailure, NO_AWARD, replay, settle, splitDrills, stageAward } from './settle'
import { playBot } from './sim'

/** Five moves; each adds its code (0–3) to the score. The target is 10, and the task is "no zero played". */
interface Toy { readonly moves: number; readonly score: number; readonly zero: boolean }
const TOY: StageRules<Toy> = {
  kind: 'training-yard',
  version: 3,
  maxInputs: 5,
  init: () => ({ moves: 0, score: 0, zero: false }),
  step: (state, input) => (input.code > 3 ? null : { moves: state.moves + 1, score: state.score + input.code, zero: state.zero || input.code === 0 }),
  done: (state) => state.moves >= 5,
  report: (state) => ({ p: state.score / 10, tasks: [!state.zero], score: state.score, drills: { speed: 1, stamina: 1, power: 0, guts: 0, wit: 2 } }),
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
  it('grades a finished play and pays the bundle at A × the grade, drills split by the report', () => {
    const settled = settle(journal(moves(3, 3, 2, 2, 0)), TOY)
    if (isReplayFailure(settled)) throw new Error(settled.failed)
    expect(settled.grade).toBe('A')
    expect(settled.report.p).toBe(1)
    expect(settled.pay).toEqual({ drills: splitDrills(STAGE_PAY_AT_A.drills, { speed: 1, stamina: 1, power: 0, guts: 0, wit: 2 }), bond: STAGE_PAY_AT_A.bond, sp: STAGE_PAY_AT_A.sp })
    expect(Object.values(settled.pay.drills).reduce((a, b) => a + b, 0)).toBe(STAGE_PAY_AT_A.drills)
  })

  it('reaches S by every task at A, and D pays a quarter', () => {
    const s = settle(journal(moves(3, 3, 3, 1, 1)), TOY)
    const d = settle(journal(moves(0, 0, 0, 1, 1)), TOY)
    if (isReplayFailure(s) || isReplayFailure(d)) throw new Error('unsettled')
    expect([s.grade, d.grade]).toEqual(['S', 'D'])
    expect(Object.values(d.pay.drills).reduce((a, b) => a + b, 0)).toBe(Math.round(STAGE_PAY_AT_A.drills * 0.25))
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

  it('puts every drill on the season\'s focus when a play weighs no colour', () => {
    const none = { speed: 0, stamina: 0, power: 0, guts: 0, wit: 0 }
    expect(stageAward('B', { p: 0.8, tasks: [], score: 0, drills: none }, false, 'guts')).toEqual({
      drills: { ...none, guts: Math.round(STAGE_PAY_AT_A.drills * 0.8) }, bond: Math.round(STAGE_PAY_AT_A.bond * 0.8), sp: Math.round(STAGE_PAY_AT_A.sp * 0.8),
    })
    expect(stageAward('A', { p: 1, tasks: [], score: 0, drills: none }, false).drills.speed).toBe(STAGE_PAY_AT_A.drills)
  })
})

describe('every game pays the same (D391)', () => {
  const CONFIGS: Readonly<Record<StageKind, () => StageConfig>> = { 'training-yard': () => yardConfig({ seed: 5 }), 'furlong-hand': () => furlongConfig({ seed: 5 }) }
  const sum = (drills: Stats) => STATS.reduce((total, stat) => total + drills[stat], 0)

  it('pays every registered game\'s play the one bundle at every grade, and only the drill split differs', () => {
    const splits = new Map<StageKind, Stats>()
    for (const kind of registeredStages()) {
      const rules = stageRules(kind)!
      const config = CONFIGS[kind]()
      const { inputs } = playBot(rules, config, 'competent', 5)
      const settled = settle({ config, version: rules.version, inputs }, rules)
      if (isReplayFailure(settled)) throw new Error(settled.failed)
      for (const of of STAGE_GRADES) {
        const award = stageAward(of, settled.report, false, config.seasonFocus)
        const m = PAY_MULTIPLIERS[of]
        expect({ bond: award.bond, sp: award.sp, drills: sum(award.drills) }).toEqual({
          bond: Math.round(STAGE_PAY_AT_A.bond * m), sp: Math.round(STAGE_PAY_AT_A.sp * m), drills: Math.round(STAGE_PAY_AT_A.drills * m),
        })
      }
      splits.set(kind, stageAward('A', settled.report, false).drills)
    }
    expect(splits.size).toBe(2)
    expect(splits.get('training-yard')).not.toEqual(splits.get('furlong-hand'))
  })
})
