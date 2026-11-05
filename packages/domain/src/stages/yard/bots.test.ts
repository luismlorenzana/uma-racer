// Training Yard's bots and golden plays (D384): every bot plays only legal moves to the end, the skill order holds,
// and fixed seeds replay to the same yard, byte for byte, here and on any engine (the golden hashes).
import { describe, expect, it } from 'vitest'
import { yardConfig } from '../../__fixtures__/stages'
import { BOT_LEVELS } from '../contract'
import { fnv1a } from '../rng'
import { isReplayFailure, settle } from '../settle'
import { playBot } from '../sim'
import { YARD_RULES } from './index'
import { FATIGUE_PIECE, YARD_MOVE, YARD_PLACEMENTS, yardQueue } from './rules'

const play = (level: (typeof BOT_LEVELS)[number], seed: number) => playBot(YARD_RULES, yardConfig({ seed }), level, seed ^ 0x5eed5eed)

/** A play's fingerprint: its moves, its final yard and its score. */
const fingerprint = (level: (typeof BOT_LEVELS)[number], seed: number): number => {
  const { inputs, state } = play(level, seed)
  return fnv1a(JSON.stringify({ inputs, board: state.board, score: state.score, drills: state.drills, sp: state.sp }))
}

describe('the bots', () => {
  it('play legal moves to the end, and their journals settle', () => {
    for (const level of BOT_LEVELS) {
      for (const seed of [1, 2, 3]) {
        const { inputs, state } = play(level, seed)
        expect(YARD_RULES.done(state)).toBe(true)
        expect(state.placed <= YARD_PLACEMENTS && inputs.length <= YARD_RULES.maxInputs).toBe(true)
        expect(inputs.every((input, tick) => input.tick === tick)).toBe(true)
        const settled = settle({ config: yardConfig({ seed }), version: YARD_RULES.version, inputs }, YARD_RULES)
        expect(isReplayFailure(settled)).toBe(false)
        if (!isReplayFailure(settled)) expect(settled.report.score).toBe(state.score)
      }
    }
  })

  it('hold the skill order over a few dozen seeds: novice, competent, expert', () => {
    const mean = (level: (typeof BOT_LEVELS)[number]) =>
      Array.from({ length: 30 }, (_, seed) => play(level, seed + 100).state.score).reduce((a, b) => a + b, 0) / 30
    const [novice, competent, expert] = BOT_LEVELS.map(mean)
    expect(novice!).toBeLessThan(competent!)
    expect(competent!).toBeLessThan(expert!)
  })

  it('leave holding to the expert, and place Fatigue like any piece', () => {
    const holds = (level: (typeof BOT_LEVELS)[number]) =>
      Array.from({ length: 10 }, (_, seed) => play(level, seed).inputs.filter((input) => input.code === YARD_MOVE.hold).length).reduce((a, b) => a + b, 0)
    expect([holds('novice'), holds('competent')]).toEqual([0, 0])
    expect(holds('expert')).toBeGreaterThan(0)
    expect(Array.from({ length: 10 }, (_, seed) => play('competent', seed).state.queue).flat()).toContain(FATIGUE_PIECE)
  })
})

describe('golden plays', () => {
  // Pinned: a change to the rules, the queue or the bots moves these, and must bump YARD_VERSION when the rules moved.
  const GOLDEN: Readonly<Record<string, number>> = {
    'novice:1': 1167164027, 'competent:1': 2926734920, 'expert:1': 1370177121,
    'novice:2': 2585117943, 'competent:2': 3900425110, 'expert:2': 3814299327,
  }

  it('rolls the same queue for a seed', () => {
    expect(fnv1a(JSON.stringify(yardQueue(yardConfig({ seed: 1 }))))).toBe(2612714378)
  })

  it.each(Object.keys(GOLDEN))('%s replays to its pinned hash', (key) => {
    const [level, seed] = key.split(':') as [(typeof BOT_LEVELS)[number], string]
    expect(fingerprint(level, Number(seed))).toBe(GOLDEN[key])
  })
})
