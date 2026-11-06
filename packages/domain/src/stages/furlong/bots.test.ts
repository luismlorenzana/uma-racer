// Furlong Hand's bots, golden plays and fairness (D385): every bot plays only legal moves to the finish and its journal
// settles, the skill order holds, the bots play as described, fixed seeds replay to the same race byte for byte (the
// golden hashes), and the deal never decides an A-target race alone.
import { describe, expect, it } from 'vitest'
import { furlongConfig } from '../../__fixtures__/furlong'
import { syntheticCards } from '../../build/decks'
import { syntheticCareerUmas, syntheticCourses, syntheticRaces, syntheticSkills } from '../../career/synthetic'
import { BOT_LEVELS, type BotLevel, type StageConfig } from '../contract'
import { fnv1a } from '../rng'
import { isReplayFailure, settle, stageAward } from '../settle'
import { playBot, stageSimConfig } from '../sim'
import { FURLONG_RULES } from './index'
import { FIELD, FURLONG_MOVE, fieldForms, initFurlong, LENGTH, SECOND_WIND, stepFurlong, type FurlongState } from './rules'

const play = (level: BotLevel, config: StageConfig, botSeed = 1) => playBot(FURLONG_RULES, config, level, botSeed)

/** A play's fingerprint: its moves, its finish and every runner's ground. */
const fingerprint = (level: BotLevel, seed: number): number => {
  const { inputs, state } = play(level, furlongConfig({ seed }), seed ^ 0x5eed5eed)
  return fnv1a(JSON.stringify({ inputs, ground: state.ground, rivals: state.rivalGround, finish: state.finish, drive: state.drive, breath: state.breath }))
}

/** Every state a play passes through. */
function states(config: StageConfig, level: BotLevel): FurlongState[] {
  const { inputs } = play(level, config)
  const out = [FURLONG_RULES.init(config)]
  for (const input of inputs) out.push(stepFurlong(out.at(-1)!, input)!)
  return out
}

describe('the bots', () => {
  it('play legal moves to the finish, and their journals settle to the same race', () => {
    for (const level of BOT_LEVELS) {
      for (const seed of [1, 2, 3]) {
        const config = furlongConfig({ seed })
        const { inputs, state } = play(level, config, seed)
        expect(FURLONG_RULES.done(state)).toBe(true)
        expect(inputs.length).toBeLessThanOrEqual(FURLONG_RULES.maxInputs)
        expect(inputs.every((input, tick) => input.tick === tick)).toBe(true)
        const settled = settle({ config, version: FURLONG_RULES.version, inputs }, FURLONG_RULES)
        expect(isReplayFailure(settled)).toBe(false)
        if (!isReplayFailure(settled)) expect(settled.report.score).toBe(state.finish!.place)
      }
    }
  })

  it('hold the skill order over a few dozen seeds: novice, competent, expert', () => {
    const content = { umas: syntheticCareerUmas(), cards: syntheticCards(), races: syntheticRaces(), courses: syntheticCourses(), skills: syntheticSkills() }
    const configOf = stageSimConfig('furlong-hand', content)
    const mean = (level: BotLevel) => Array.from({ length: 40 }, (_, n) => {
      const config = configOf(n + 100)
      return FURLONG_RULES.report(play(level, config, config.seed ^ 0x5eed5eed).state).p
    }).reduce((a, b) => a + b, 0) / 40
    const [novice, competent, expert] = BOT_LEVELS.map(mean)
    expect(novice!).toBeLessThan(competent!)
    expect(competent!).toBeLessThan(expert!)
  })

  it('play as described: the novice runs everything and never redraws; the competent banks to hold a closer\'s band', () => {
    const codes = (level: BotLevel, strategy: 'front' | 'end') => Array.from({ length: 8 }, (_, seed) =>
      play(level, furlongConfig({ seed, her: { strategy } })).inputs.map((input) => input.code)).flat()
    expect(codes('novice', 'end').filter((code) => code === FURLONG_MOVE.bank || code === FURLONG_MOVE.redraw)).toEqual([])
    expect(codes('novice', 'end').filter((code) => code === FURLONG_MOVE.line)).toHaveLength(8 * 6)
    const banks = (strategy: 'front' | 'end') => codes('competent', strategy).filter((code) => code === FURLONG_MOVE.bank).length
    expect(banks('end')).toBeGreaterThan(banks('front'))
    expect(banks('front')).toBe(0)
  })

  it('leave the closed rail to the novice: the others take the middle or the outside', () => {
    for (const level of ['competent', 'expert'] as const) {
      for (const seed of [1, 2, 3, 4]) {
        const all = states(furlongConfig({ seed }), level)
        for (const state of all) {
          for (const event of state.events) if (event.kind === 'line') expect(event.blocked).toBe(false)
        }
      }
    }
  })
})

describe('golden plays', () => {
  // Pinned: a change to the rules, the deals, the scripts or the bots moves these, and must bump FURLONG_VERSION when
  // the rules moved. D391's rule change left all six as they were; seed 1's then moved with the rivals' season curve
  // (its field's strength), its moves and report unchanged.
  const GOLDEN: Readonly<Record<string, number>> = {
    'novice:1': 3042792966, 'competent:1': 3074537747, 'expert:1': 1369249322,
    'novice:2': 3897258636, 'competent:2': 2138820939, 'expert:2': 75657069,
  }

  it('deals the same first spread and scripts for a seed', () => {
    const state = initFurlong(furlongConfig({ seed: 1 }))
    expect(fnv1a(JSON.stringify({ columns: state.columns, pile: state.pile, scripts: state.rivals.map((rival) => [rival.form, rival.script]) }))).toBe(3112787956)
  })

  it.each(Object.keys(GOLDEN))('%s replays to its pinned hash', (key) => {
    const [level, seed] = key.split(':') as [BotLevel, string]
    expect(fingerprint(level, Number(seed))).toBe(GOLDEN[key])
  })

  // The same plays' reports, pinned apart from the moves: D391 changed the report (the drills by colour, no SP) and
  // left the moves' hashes above as they were.
  const GOLDEN_REPORTS: Readonly<Record<string, number>> = {
    'novice:1': 2403015024, 'competent:1': 508336663, 'expert:1': 56015651,
    'novice:2': 1668968983, 'competent:2': 4071766748, 'expert:2': 808502454,
  }

  it.each(Object.keys(GOLDEN_REPORTS))('%s reports to its pinned hash', (key) => {
    const [level, seed] = key.split(':') as [BotLevel, string]
    const { state } = play(level, furlongConfig({ seed: Number(seed) }), Number(seed) ^ 0x5eed5eed)
    expect(fnv1a(JSON.stringify(FURLONG_RULES.report(state)))).toBe(GOLDEN_REPORTS[key])
  })
})

describe('fairness', () => {
  it('keeps every field as strong, its moves always shown, a free redraw each spread, and a second wind for the spurt', () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const config = furlongConfig({ seed })
      expect(initFurlong(config).rivals.map((rival) => rival.form).sort((a, b) => b - a)).toEqual(fieldForms(8))
      for (const state of states(config, 'competent')) {
        // Each rival's move for the spread under way is in the state the view draws.
        expect(state.rivals.every((rival) => rival.script[state.spread] !== undefined || state.phase === 'finished')).toBe(true)
        if (state.phase === 'line' && state.spread === state.legs.length) expect(state.breath).toBeGreaterThanOrEqual(SECOND_WIND)
        if (state.phase === 'line') expect(Math.max(...state.rivalGround) - state.ground).toBeLessThanOrEqual(FIELD.slip)
      }
    }
  })

  it('never strands her: a leg always has a move until it ends, and a loss still pays (grade D)', () => {
    for (const seed of [11, 12, 13]) {
      for (const state of states(furlongConfig({ seed }), 'novice')) {
        if (state.phase !== 'leg') continue
        const moves = [0, 1, 2, 3].flatMap((x) => [0, 1].map((code) => stepFurlong(state, { tick: state.moves, code, x })))
        expect(moves.some((next) => next !== null) || stepFurlong(state, { tick: state.moves, code: FURLONG_MOVE.flip }) !== null).toBe(true)
      }
    }
    const lost = stageAward('D', { p: 0, tasks: [false, false, false, false], score: 9, drills: { speed: 0, stamina: 0, power: 0, guts: 0, wit: 0 } }, false)
    expect(lost.bond).toBeGreaterThan(0)
    expect(lost.sp).toBeGreaterThan(0)
  })

  it('leaves no A-target race to the deal alone: six competent-level plays win most deals, and none loses far behind', () => {
    const content = { umas: syntheticCareerUmas(), cards: syntheticCards(), races: syntheticRaces(), courses: syntheticCourses(), skills: syntheticSkills() }
    const configOf = stageSimConfig('furlong-hand', content)
    for (const family of [2, 6]) {
      const base = configOf(family)
      let competentWins = 0
      let winnable = 0
      let worst = 0
      const DEALS = 40
      for (let d = 0; d < DEALS; d += 1) {
        const config: StageConfig = { ...base, seed: (Math.imul(d + 1, 0x2545f491) ^ base.seed) >>> 0 }
        let best = Number.NEGATIVE_INFINITY
        for (const level of ['competent', 'expert'] as const) {
          for (let t = 0; t < 3; t += 1) {
            const { state } = play(level, config, (config.seed ^ Math.imul(t + 1, 0x5eed5eed)) >>> 0)
            if (level === 'competent' && t === 0 && state.finish!.place === 1) competentWins += 1
            best = Math.max(best, (state.ground - Math.max(...state.rivalGround)) / LENGTH)
          }
        }
        if (best >= 0) winnable += 1
        worst = Math.min(worst, best)
      }
      // An A-target race: the competent bot wins about half its deals.
      expect(competentWins / DEALS).toBeGreaterThanOrEqual(0.5)
      expect(winnable / DEALS).toBeGreaterThanOrEqual(0.8)
      expect(worst).toBeGreaterThan(-6)
    }
  })
})
