// The build's five operations through `commitOperation` on synthetic saves (D382): each validates, spends from the
// career's wallet, refuses in plain words, writes only what changed, and applies an id once.
import { describe, expect, it } from 'vitest'
import { flat, testCard, testCareer, testEnv, testSkill, testState } from '../__fixtures__/build'
import { clock, deepFreeze, opId } from '../__fixtures__/g3'
import { commitOperation, type Commit } from '../save/commit'
import { careerId, type CareerRecord } from '../save/records'
import type { SaveState } from '../save/state'

const SP = testCard('sp', 'speed', { 1: 22, 8: 9, 14: 30 }, { hintSkillIds: ['white'] })
const ST = testCard('st', 'stamina', { 8: 5 })
const FR = testCard('fr', 'friend', { 8: 5 })
const LATE = testCard('late', 'power', {}, { era: 3 })
const env = testEnv([SP, ST, FR, LATE], [testSkill('white', 100), testSkill('skill-awake-w', 150)])
const ID = careerId('uma-1', 1)
const career = (extra: Partial<CareerRecord> = {}) =>
  testCareer('uma-1', { wallet: { drills: flat(200), bond: 100, sp: 500 }, ...extra })
const save = (extra: Partial<CareerRecord> = {}) => deepFreeze(testState(career(extra), ['sp', 'st', 'fr', 'late']))
const op = (n: number, name: string, input: unknown) => ({ id: opId(n), name, input, at: clock('08:00') })
const applied = (commit: Commit) => {
  if (commit.status !== 'applied') throw new Error(commit.status === 'refused' ? commit.refusal.reason : commit.status)
  return commit
}
const careerOf = (state: SaveState) => state.careers[ID]!
const written = (commit: Commit) => (commit.status === 'applied' ? [...commit.entities, ...commit.logs].map((row) => `${row.kind}/${row.id}`) : [])

describe('set-deck', () => {
  it('sets the deck with default posts and writes the career', () => {
    const commit = applied(commitOperation(save(), op(1, 'set-deck', { careerId: ID, deck: ['sp', 'st', 'fr'] }), env))
    expect(commit.receipt).toEqual({ deck: ['sp', 'st', 'fr'], posts: { sp: 'speed', st: 'stamina', fr: 'wit' } })
    expect(written(commit)).toEqual([`careers/${ID}`, `operations/${opId(1)}`])
  })

  it('refuses a locked card, a card of a later era, an unknown career and a finished one', () => {
    const locked = deepFreeze(testState(career(), ['st']))
    expect(commitOperation(locked, op(1, 'set-deck', { careerId: ID, deck: ['sp'] }), env)).toMatchObject({ refusal: { code: 'card-locked' } })
    expect(commitOperation(save(), op(1, 'set-deck', { careerId: ID, deck: ['late'] }), env)).toMatchObject({ refusal: { code: 'card-era' } })
    expect(commitOperation(save(), op(1, 'set-deck', { careerId: 'uma-9:1', deck: [] }), env)).toMatchObject({ refusal: { code: 'unknown-career' } })
    const done = save({ completedAt: clock('07:30'), racingBuild: { stats: flat(100), aptitudes: { surface: {}, distance: {}, strategy: {} } as never, skills: [] } })
    expect(commitOperation(done, op(1, 'set-deck', { careerId: ID, deck: [] }), env)).toMatchObject({ refusal: { code: 'career-complete' } })
  })

  it('throws on a malformed input, which the caller answers invalid', () => {
    expect(() => commitOperation(save(), op(1, 'set-deck', { careerId: ID }), env)).toThrow(/Malformed/)
    expect(() => commitOperation(save(), op(1, 'set-deck', { careerId: ID, deck: 'sp' }), env)).toThrow(/Malformed/)
  })
})

describe('post-card', () => {
  it('moves a deck card to a branch with a free seat', () => {
    const state = save({ deck: ['sp'], posts: { sp: 'speed' } })
    const commit = applied(commitOperation(state, op(1, 'post-card', { careerId: ID, cardId: 'sp', branch: 'guts' }), env))
    expect(careerOf(commit.state).posts).toEqual({ sp: 'guts' })
    expect(commitOperation(state, op(2, 'post-card', { careerId: ID, cardId: 'st', branch: 'guts' }), env)).toMatchObject({ refusal: { code: 'not-in-deck' } })
    expect(() => commitOperation(state, op(3, 'post-card', { careerId: ID, cardId: 'sp', branch: 'luck' }), env)).toThrow(/Malformed/)
  })
})

describe('buy-pips', () => {
  it('buys pips in order and spends drills of the branch\'s colour', () => {
    const commit = applied(commitOperation(save(), op(1, 'buy-pips', { careerId: ID, branch: 'speed', count: 5 }), env))
    expect(commit.receipt).toEqual({ branch: 'speed', pips: 5, camps: [null, null], spent: 102, drillsLeft: 98 })
    expect(careerOf(commit.state).wallet.drills).toEqual({ ...flat(200), speed: 98 })
  })

  it('buys a Camp node once a branch reaches level 3', () => {
    const closed = commitOperation(save(), op(1, 'buy-pips', { careerId: ID, branch: 'wit', camp: true }), env)
    expect(closed).toMatchObject({ refusal: { code: 'camps-closed' } })
    const commit = applied(commitOperation(save({ pips: { ...flat(0), speed: 8 } }), op(2, 'buy-pips', { careerId: ID, branch: 'wit', camp: true }), env))
    expect(commit.receipt).toMatchObject({ branch: 'wit', camps: ['wit', null], spent: 112, drillsLeft: 88 })
  })

  it('refuses too few drills, and a malformed count', () => {
    const poor = deepFreeze(testState(career({ wallet: { drills: flat(10), bond: 0, sp: 0 } }), []))
    expect(commitOperation(poor, op(1, 'buy-pips', { careerId: ID, branch: 'speed', count: 1 }), env))
      .toMatchObject({ refusal: { code: 'not-enough-drills', reason: 'That takes 20 Speed drills; she has 10.' } })
    expect(() => commitOperation(save(), op(2, 'buy-pips', { careerId: ID, branch: 'speed', count: 0 }), env)).toThrow(/Malformed/)
    expect(() => commitOperation(save(), op(3, 'buy-pips', { careerId: ID, branch: 'speed', count: 2, camp: true }), env)).toThrow(/Malformed/)
  })
})

describe('pour-bond', () => {
  it('pours Bond from the wallet into a deck card\'s track, writing the track and the career', () => {
    const state = save({ deck: ['sp'], posts: { sp: 'speed' } })
    const commit = applied(commitOperation(state, op(1, 'pour-bond', { careerId: ID, cardId: 'sp', amount: 50 }), env))
    expect(commit.receipt).toEqual({ cardId: 'sp', spent: 50, value: 80, hints: 3 })
    expect(commit.state.bonds['uma-1:1:sp']).toEqual({ umaId: 'uma-1', tier: 1, cardId: 'sp', value: 80, hints: 3 })
    expect(careerOf(commit.state).wallet.bond).toBe(50)
    expect(written(commit)).toEqual([`careers/${ID}`, 'bonds/uma-1:1:sp', `operations/${opId(1)}`])
    expect(commitOperation(state, op(2, 'pour-bond', { careerId: ID, cardId: 'sp', amount: 101 }), env)).toMatchObject({ refusal: { code: 'not-enough-bond' } })
  })
})

describe('buy-skill', () => {
  it('buys a skill from her library at its hinted cost', () => {
    const state = deepFreeze({ ...save({ deck: ['sp'], posts: { sp: 'speed' } }), bonds: { 'uma-1:1:sp': { umaId: 'uma-1', tier: 1 as const, cardId: 'sp', value: 40, hints: 2 } } })
    const commit = applied(commitOperation(state, op(1, 'buy-skill', { careerId: ID, skillId: 'white' }), env))
    expect(commit.receipt).toEqual({ skillId: 'white', cost: 80, spLeft: 420 })
    expect(careerOf(commit.state)).toMatchObject({ skills: ['white'], spSpent: 80 })
    expect(commitOperation(state, op(2, 'buy-skill', { careerId: ID, skillId: 'skill-awake-w' }), env)).toMatchObject({ status: 'applied', receipt: { cost: 150 } })
    expect(commitOperation(save(), op(3, 'buy-skill', { careerId: ID, skillId: 'white' }), env)).toMatchObject({ refusal: { code: 'not-in-library' } })
  })
})

describe('idempotence', () => {
  it.each([
    ['set-deck', { careerId: ID, deck: ['sp'] }],
    ['post-card', { careerId: ID, cardId: 'sp', branch: 'wit' }],
    ['buy-pips', { careerId: ID, branch: 'speed', count: 1 }],
    ['pour-bond', { careerId: ID, cardId: 'sp', amount: 10 }],
    ['buy-skill', { careerId: ID, skillId: 'skill-awake-w' }],
  ])('%s applies an id once: a retry gives the first receipt and writes nothing', (name, input) => {
    const state = save({ deck: ['sp'], posts: { sp: 'speed' } })
    const first = applied(commitOperation(state, op(1, name, input), env))
    const again = commitOperation(deepFreeze(first.state), op(1, name, input), env)
    expect(again).toMatchObject({ status: 'repeated', receipt: first.receipt, entities: [], logs: [] })
    expect(commitOperation(state, op(1, name, input), env)).toEqual(first)
  })
})
