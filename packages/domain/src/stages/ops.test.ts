// `settle-stage` through `commitOperation` (D384, D385): a played Yard settles into the career's wallet, split by the
// colours it merged, and a played Furlong Hand pays Bond and SP; practice is graded and pays nothing; a broken,
// unfinished or foreign journal is refused in plain words; the device and the server, running the same function,
// settle alike; and a full play's input is far under the bound.
import { describe, expect, it } from 'vitest'
import { careerSave, CONTENT_ENV, UMAS } from '../__fixtures__/career'
import { clock, deepFreeze, opId } from '../__fixtures__/g3'
import { STAGE_PAY_AT_A } from '../career/pay'
import { commitOperation, type Commit } from '../save/commit'
import { SAVE_LIMITS } from '../save/kinds'
import { jsonBytes } from '../save/parse'
import { careerId, parseCareerRecord, type CareerRecord } from '../save/records'
import { isRefusal } from '../save/registry'
import type { SaveState } from '../save/state'
import { careerStageConfig } from './config'
import type { StageInput } from './contract'
import { grade } from './grade'
import { parseSettleStageInput, type SettleStageReceipt } from './ops'
import { FURLONG_RULES } from './furlong'
import { playBot } from './sim'
import { YARD_RULES } from './yard'

const UMA = UMAS[0]!
const ID = careerId(UMA.id, 1)
const op = (n: number, name: string, input: unknown) => ({ id: opId(n), name, input, at: clock('08:00') })
const applied = (commit: Commit) => {
  if (commit.status !== 'applied') throw new Error(commit.status === 'refused' ? commit.refusal.reason : commit.status)
  return commit
}
const refusal = (commit: Commit) => (commit.status === 'refused' ? commit.refusal : null)

/** Her career with a deck of the first six invented cards, in season `season`. */
function career(season = 1): SaveState {
  const start = applied(commitOperation(deepFreeze(careerSave(UMA.id)), op(1, 'start-career', { umaId: UMA.id, T: 1 }), CONTENT_ENV))
  const deck = [...CONTENT_ENV.content.cards.keys()].filter((_, i) => i % 5 === 0).slice(0, 6)
  const record: CareerRecord = { ...start.state.careers[ID]!, deck, season }
  return deepFreeze({ ...start.state, careers: { [ID]: record } })
}

/** The competent bot's whole play of the career's Yard. */
function played(state: SaveState, seed: number, practice = false): StageInput[] {
  const config = careerStageConfig(state.careers[ID]!, state.bonds, CONTENT_ENV.content, 'training-yard', seed, practice)
  if (isRefusal(config)) throw new Error(config.reason)
  return playBot(YARD_RULES, config, 'competent', seed).inputs
}

const settleInput = (inputs: readonly StageInput[], seed: number, extra: Record<string, unknown> = {}) =>
  ({ careerId: ID, kind: 'training-yard', seed, version: YARD_RULES.version, inputs, practice: false, ...extra })

describe('settle-stage', () => {
  it('replays the play, grades it and pays the grade into the wallet, drills by the colours merged', () => {
    const state = career()
    const inputs = played(state, 41)
    const commit = applied(commitOperation(state, op(2, 'settle-stage', settleInput(inputs, 41)), CONTENT_ENV))
    const receipt = commit.receipt as SettleStageReceipt
    expect(receipt).toMatchObject({ careerId: ID, kind: 'training-yard', seed: 41, practice: false, season: 1 })
    expect(receipt.grade).toBe(grade(receipt.p, receipt.tasks))
    const wallet = commit.state.careers[ID]!.wallet
    expect(wallet.drills).toEqual(receipt.pay.drills)
    expect(wallet.sp).toBe(receipt.pay.sp)
    const multiplier = { D: 0.25, C: 0.6, B: 0.8, A: 1, S: 1.2 }[receipt.grade]
    expect(Object.values(wallet.drills).reduce((a, b) => a + b, 0)).toBe(Math.round(STAGE_PAY_AT_A['training-yard'].drills * multiplier))
    expect(parseCareerRecord(commit.state.careers[ID])).toEqual(commit.state.careers[ID])
    expect([...commit.entities, ...commit.logs].map((row) => `${row.kind}/${row.id}`)).toEqual([`careers/${ID}`, `operations/${opId(2)}`])
  })

  it('settles a Furlong Hand play on her season\'s objective: Bond and SP by the grade, and its Partners\' SP on top', () => {
    const objective = career().careers[ID]!.objectives[0]!
    const state = career(objective.season)
    const config = careerStageConfig(state.careers[ID]!, state.bonds, CONTENT_ENV.content, 'furlong-hand', 52, false)
    if (isRefusal(config)) throw new Error(config.reason)
    expect(config.course).toBe(objective.raceId)
    const inputs = playBot(FURLONG_RULES, config, 'competent', 52).inputs
    const input = { careerId: ID, kind: 'furlong-hand', seed: 52, version: FURLONG_RULES.version, inputs, practice: false }
    const commit = applied(commitOperation(state, op(2, 'settle-stage', input), CONTENT_ENV))
    const receipt = commit.receipt as SettleStageReceipt
    const multiplier = { D: 0.25, C: 0.6, B: 0.8, A: 1, S: 1.2 }[receipt.grade]
    expect(receipt).toMatchObject({ kind: 'furlong-hand', seed: 52, season: objective.season })
    expect(receipt.pay.bond).toBe(Math.round(STAGE_PAY_AT_A['furlong-hand'].bond * multiplier))
    expect(receipt.pay.sp).toBeGreaterThanOrEqual(Math.round(STAGE_PAY_AT_A['furlong-hand'].sp * multiplier))
    expect(Object.values(receipt.pay.drills).every((n) => n === 0)).toBe(true)
    expect(commit.state.careers[ID]!.wallet).toMatchObject({ bond: receipt.pay.bond, sp: receipt.pay.sp })
    expect(jsonBytes(input)).toBeLessThan(SAVE_LIMITS.rowBytes)
  })

  it('pays a replay like a first play, and runs the same on the device and the server', () => {
    const state = career()
    const inputs = played(state, 7)
    const first = applied(commitOperation(state, op(2, 'settle-stage', settleInput(inputs, 7)), CONTENT_ENV))
    const server = applied(commitOperation(state, op(2, 'settle-stage', settleInput(inputs, 7)), CONTENT_ENV))
    expect(server.state).toEqual(first.state)
    expect(server.receipt).toEqual(first.receipt)
    const again = applied(commitOperation(first.state, op(3, 'settle-stage', settleInput(inputs, 7)), CONTENT_ENV))
    const pay = (first.receipt as SettleStageReceipt).pay
    expect(again.state.careers[ID]!.wallet.sp).toBe(2 * pay.sp)
    expect(commitOperation(first.state, op(2, 'settle-stage', settleInput(inputs, 7)), CONTENT_ENV).status).toBe('repeated')
  })

  it('grades practice and pays nothing, changing only the operations log', () => {
    const state = career()
    const inputs = played(state, 8, true)
    const commit = applied(commitOperation(state, op(2, 'settle-stage', settleInput(inputs, 8, { practice: true })), CONTENT_ENV))
    expect(commit.state.careers).toBe(state.careers)
    expect((commit.receipt as SettleStageReceipt).pay).toEqual({ drills: { speed: 0, stamina: 0, power: 0, guts: 0, wit: 0 }, bond: 0, sp: 0 })
    expect(commit.entities).toEqual([])
  })

  it('refuses an unfinished play, an illegal move, another version, an unbuilt game, a finished career and an unknown one', () => {
    const state = career()
    const inputs = played(state, 9)
    const words = (input: unknown, at = state) => refusal(commitOperation(at, op(2, 'settle-stage', input), CONTENT_ENV))
    expect(words(settleInput(inputs.slice(0, 20), 9))).toMatchObject({ code: 'stage-unfinished', reason: 'That play of Training Yard isn\'t finished: it stops after 20 moves.' })
    expect(words(settleInput(inputs, 10))).toMatchObject({ code: expect.stringMatching(/^stage-(illegal|unfinished)$/) }) // another seed: another yard
    const taken = [...inputs.slice(0, 1), { ...inputs[0]!, tick: 1 }, ...inputs.slice(2)]
    expect(words(settleInput(taken, 9))).toMatchObject({ code: 'stage-illegal', reason: 'Move 2 of that play isn\'t legal in Training Yard, so it can\'t be settled.' })
    expect(words(settleInput(inputs, 9, { version: YARD_RULES.version + 1 }))).toMatchObject({ code: 'stage-version' })
    expect(words(settleInput([], 9, { kind: 'furlong-hand', version: FURLONG_RULES.version }))).toMatchObject({ code: 'stage-unfinished', reason: 'That play of Furlong Hand isn\'t finished: it stops after 0 moves.' })
    expect(words(settleInput(inputs, 9, { careerId: 'nobody:1' }))).toMatchObject({ code: 'unknown-career' })
    const done = deepFreeze({ ...state, careers: { [ID]: { ...state.careers[ID]!, completedAt: clock('09:00'), racingBuild: { stats: { speed: 1, stamina: 1, power: 1, guts: 1, wit: 1 }, aptitudes: UMA.aptitudes, skills: [] } } } })
    expect(words(settleInput(inputs, 9), done)).toMatchObject({ code: 'career-complete' })
    expect(commitOperation(done, op(2, 'settle-stage', settleInput(played(state, 9, true), 9, { practice: true })), CONTENT_ENV).status).toBe('applied')
  })

  it('reads its input strictly, and a full play weighs a few kilobytes', () => {
    const state = career()
    const inputs = played(state, 11)
    expect(parseSettleStageInput(settleInput(inputs, 11))).toEqual(settleInput(inputs, 11))
    expect(() => commitOperation(state, op(2, 'settle-stage', {}), CONTENT_ENV)).toThrow(/Malformed/)
    for (const bad of [{ seed: -1 }, { seed: 2 ** 32 }, { kind: 'puzzle' }, { version: 0 }, { practice: 'no' }, { inputs: [{ tick: 0 }] }, { inputs: [{ tick: 0, code: 0, z: 1 }] }, { extra: 1 }]) {
      expect(parseSettleStageInput(settleInput(inputs, 11, bad)), JSON.stringify(bad)).toBeNull()
    }
    expect(parseSettleStageInput(settleInput(Array.from({ length: 2001 }, (_, tick) => ({ tick: 0, code: 0 })), 11))).toBeNull()
    expect(jsonBytes(settleInput(inputs, 11))).toBeLessThan(SAVE_LIMITS.rowBytes / 50)
  })
})
