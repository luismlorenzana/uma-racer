// Generation 3's save (D381): a new account, the operation registry and commit (ids, receipts, refusals, the stubs the
// later M036 parts replace), rows and their parsers, and the wire stamp.
import { describe, expect, it } from 'vitest'
import { card, clock, DEV, ENV, opId, uma } from '../__fixtures__/g3'
import { INITIAL_CARD_TICKETS, INITIAL_UMA_TICKETS } from '../account/ops'
import { commitOperation, parseOperationEnvelope } from './commit'
import { initialSave } from './initial'
import { KIND_ORDER, SAVE_GENERATION, SAVE_PROTOCOL } from './kinds'
import { OPERATION_NAMES } from './operations'
import { parseEntityRow, parseLogRow } from './parse'
import { careerId, parseCareerRecord, type CareerRecord } from './records'
import { stampEntity, stampLog } from './rows'
import { toSaveState } from './state'
import { isCurrentStamp, parseSnapshotQuery, parseSyncRequest, STAMP } from './wire'

const fresh = () => initialSave(clock('07:00')).state
const op = (n: number, name: string, input: unknown, at = clock('07:01')) => ({ id: opId(n), name, input, at })

describe('a new account', () => {
  it('starts with 20 Uma Tickets, 24 Card Tickets and nothing unlocked', () => {
    const save = initialSave(clock('07:00'))
    expect(save.state.account).toEqual({ createdAt: clock('07:00'), umaTickets: INITIAL_UMA_TICKETS, cardTickets: INITIAL_CARD_TICKETS })
    expect([INITIAL_UMA_TICKETS, INITIAL_CARD_TICKETS]).toEqual([20, 24])
    expect(save.state).toMatchObject({ umas: {}, cards: {}, careers: {}, bonds: {} })
    expect(save.entities.map((row) => `${row.kind}/${row.id}`)).toEqual(['account/main'])
  })
})

describe('the operation table', () => {
  it('declares every operation the slice needs, once', () => {
    expect([...OPERATION_NAMES].sort()).toEqual([
      'buy-pips', 'buy-skill', 'dev-grant', 'next-season', 'post-card', 'pour-bond', 'run-finale', 'run-race', 'set-deck',
      'settle-stage', 'start-career', 'unlock-card', 'unlock-uma',
    ])
  })

  it.each([['start-career'], ['run-race'], ['next-season'], ['run-finale'], ['set-deck'], ['post-card'], ['buy-pips'], ['pour-bond'],
    ['buy-skill'], ['settle-stage']])('%s refuses until its part lands', (name) => {
    const commit = commitOperation(fresh(), op(1, name, {}), ENV)
    expect(commit).toMatchObject({ status: 'refused', refusal: { code: 'not-built-yet' } })
  })
})

describe('unlocking', () => {
  it('spends a ticket and writes the Uma, the account and the operation', () => {
    const commit = commitOperation(fresh(), op(1, 'unlock-uma', { umaId: uma(1) }), ENV)
    if (commit.status !== 'applied') throw new Error(commit.status)
    expect(commit.state.umas[uma(1)]).toEqual({ unlockedAt: clock('07:01') })
    expect(commit.state.account.umaTickets).toBe(INITIAL_UMA_TICKETS - 1)
    expect(commit.receipt).toEqual({ id: uma(1), ticketsLeft: INITIAL_UMA_TICKETS - 1 })
    expect(commit.entities.map((row) => `${row.kind}/${row.id}`)).toEqual(['account/main', `umas/${uma(1)}`])
    expect(commit.logs.map((row) => `${row.kind}/${row.id}`)).toEqual([`operations/${opId(1)}`])
  })

  it('unlocks a card with a Card Ticket', () => {
    const commit = commitOperation(fresh(), op(1, 'unlock-card', { cardId: card(2) }), ENV)
    if (commit.status !== 'applied') throw new Error(commit.status)
    expect(commit.state.cards[card(2)]).toEqual({ unlockedAt: clock('07:01') })
    expect(commit.state.account.cardTickets).toBe(INITIAL_CARD_TICKETS - 1)
  })

  it('refuses in plain words: unknown, twice, or with no tickets', () => {
    expect(commitOperation(fresh(), op(1, 'unlock-uma', { umaId: 'nobody' }), ENV)).toMatchObject({ refusal: { code: 'unknown-uma' } })
    const once = commitOperation(fresh(), op(1, 'unlock-uma', { umaId: uma(1) }), ENV)
    if (once.status !== 'applied') throw new Error(once.status)
    expect(commitOperation(once.state, op(2, 'unlock-uma', { umaId: uma(1) }), ENV)).toMatchObject({ refusal: { code: 'already-unlocked' } })
    const broke = { ...fresh(), account: { ...fresh().account, cardTickets: 0 } }
    expect(commitOperation(broke, op(3, 'unlock-card', { cardId: card(1) }), ENV)).toMatchObject({ refusal: { code: 'no-tickets', reason: 'You have no Card Tickets left.' } })
  })

  it('applies an id once: a retry gives the first receipt and writes nothing', () => {
    const first = commitOperation(fresh(), op(1, 'unlock-uma', { umaId: uma(1) }), ENV)
    if (first.status !== 'applied') throw new Error(first.status)
    const again = commitOperation(first.state, op(1, 'unlock-uma', { umaId: uma(1) }), ENV)
    expect(again).toMatchObject({ status: 'repeated', receipt: first.receipt, entities: [], logs: [] })
    expect(() => commitOperation(first.state, op(1, 'unlock-card', { cardId: card(1) }), ENV)).toThrow(/ran as unlock-uma/)
  })

  it('throws on a malformed input, which the caller answers invalid', () => {
    expect(() => commitOperation(fresh(), op(1, 'unlock-uma', { umaId: uma(1), extra: 1 }), ENV)).toThrow(/Malformed/)
  })
})

describe('dev-grant', () => {
  it('adds tickets only in a dev build', () => {
    expect(commitOperation(fresh(), op(1, 'dev-grant', { umaTickets: 5, cardTickets: 1 }), ENV)).toMatchObject({ refusal: { code: 'dev-only' } })
    const commit = commitOperation(fresh(), op(1, 'dev-grant', { umaTickets: 5, cardTickets: 1 }), DEV)
    expect(commit).toMatchObject({ status: 'applied', state: { account: { umaTickets: 25, cardTickets: 25 } } })
  })
})

describe('rows', () => {
  it('round-trips a commit through stamped rows', () => {
    const save = initialSave(clock('07:00'))
    const commit = commitOperation(save.state, op(1, 'unlock-uma', { umaId: uma(2) }), ENV)
    if (commit.status !== 'applied') throw new Error(commit.status)
    // The commit's rows replace the create's, as a server's newer versions do.
    const latest = new Map([...save.entities, ...commit.entities].map((draft) => [`${draft.kind}/${draft.id}`, draft]))
    const entities = [...latest.values()].map((draft) => stampEntity(draft, 1, clock('07:02')))
    const logs = commit.logs.map((draft) => stampLog(draft, clock('07:02')))
    for (const row of entities) expect(parseEntityRow(JSON.parse(JSON.stringify(row)))).toEqual(row)
    for (const row of logs) expect(parseLogRow(JSON.parse(JSON.stringify(row)))).toEqual(row)
    expect(toSaveState(entities, logs)).toEqual(commit.state)
  })

  it('keeps a career record exact: its id, its finale and its frozen build agree', () => {
    const career: CareerRecord = {
      umaId: uma(1), T: 1, startedAt: 1, season: 0,
      objectives: [{ raceId: 'race-1', stage: 'maiden', season: 3, status: 'open', wonAt: null }],
      finale: { step: 0, won: false }, deck: [card(1)], posts: { [card(1)]: 'speed' },
      pips: { speed: 0, stamina: 0, power: 0, guts: 0, wit: 0 }, camps: [null, null], skills: [], spSpent: 0,
      wallet: { drills: { speed: 0, stamina: 0, power: 0, guts: 0, wit: 0 }, bond: 0, sp: 0 }, completedAt: null, racingBuild: null,
    }
    expect(parseCareerRecord(JSON.parse(JSON.stringify(career)))).toEqual(career)
    expect(parseCareerRecord({ ...career, finale: { step: 3, won: false } })).toBeNull()
    expect(parseCareerRecord({ ...career, completedAt: 5 })).toBeNull()
    expect(parseCareerRecord({ ...career, posts: { other: 'speed' } })).toBeNull()
    const row = stampEntity({ kind: 'careers', id: careerId(uma(1), 1), generation: SAVE_GENERATION, schema: 1, data: career } as never, 1, 0)
    expect(parseEntityRow(row)).toEqual(row)
    expect(parseEntityRow({ ...row, id: careerId(uma(1), 2) })).toBeNull()
  })

  it('walks the account first', () => {
    expect(KIND_ORDER[0]).toBe('account')
  })
})

describe('the wire', () => {
  it('is protocol 3 and generation 3 only', () => {
    expect(STAMP).toEqual({ protocol: SAVE_PROTOCOL, generation: SAVE_GENERATION })
    expect([SAVE_PROTOCOL, SAVE_GENERATION]).toEqual([3, 3])
    expect(isCurrentStamp({ protocol: 2, generation: 2 })).toBe(false)
    expect(parseSnapshotQuery({ protocol: '2', generation: '2' })).toBeUndefined()
    expect(parseSyncRequest({ protocol: 2, generation: 2, changes: [] })).toBe('protocol 3 and generation 3 only')
  })

  it('carries a create first and operations, nothing else', () => {
    const request = parseSyncRequest({ ...STAMP, changes: [{ type: 'create', createdAt: 1 }, { type: 'operation', operation: op(1, 'unlock-uma', { umaId: uma(1) }) }] })
    expect(typeof request).not.toBe('string')
    expect(parseSyncRequest({ ...STAMP, changes: [{ type: 'upsert', kind: 'badges', id: 'x', baseVersion: 0, data: {} }] })).toMatch(/unknown type/)
    expect(parseOperationEnvelope(op(1, 'feed-the-horse', {}))).toMatch(/unknown operation/)
  })
})
