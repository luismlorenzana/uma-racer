// Generation 3's sync and pull, pure (T152): the read set, the new account, operations re-run with the domain, the
// declared operations that aren't built yet, coalesced writes and the pages. Synthetic content only.
import { describe, expect, it } from 'vitest'
import {
  answersRequest, ENTITY_KINDS, logDraft, stampLog, OPERATIONS_WINDOW_MS, parseSaveSnapshot, parseSyncRequest, parseSyncResponse, rowKey,
  SAVE_LIMITS, type EntityRow, type OperationEnv, type SyncRequest, type SyncResponse,
} from '@racer/domain/save'
import {
  comparePulled, encodeCursor, NO_SAVE, parseCursor, resolveSync, selectReadSet, snapshotPage, syncReadSet, type SaveRow,
} from './resolve'
import { card, clock, DEV, ENV, op, opId, STAMP, uma } from './save.test-support'

const HOUR = 60 * 60 * 1000

/** A request as the wire carries it, through the domain's parser. */
function request(changes: readonly unknown[]): SyncRequest {
  const parsed = parseSyncRequest(JSON.parse(JSON.stringify({ ...STAMP, changes })))
  if (typeof parsed === 'string') throw new Error(parsed)
  return parsed
}

/** A stand-in for a repository: every row of one save, the read set, `resolveSync`, then the writes. */
class Server {
  readonly rows = new Map<string, SaveRow>()
  now = 1_000_000
  reads: string[] = []

  constructor(private readonly env: OperationEnv = ENV) {}

  sync(changes: readonly unknown[], env: OperationEnv = this.env): SyncResponse | typeof NO_SAVE {
    const parsed = request(changes)
    const stored = selectReadSet(this.rows.values(), syncReadSet(parsed))
    this.reads = [...stored.entities.keys(), ...stored.logs.keys()]
    this.now += 1_000
    const resolved = resolveSync(stored, parsed, this.now, env)
    if (resolved === NO_SAVE) return NO_SAVE
    for (const row of [...resolved.entities, ...resolved.logs]) this.rows.set(rowKey(row), row)
    // Every answer is one the device's parser takes, and answers its request change by change.
    const wire = parseSyncResponse(JSON.parse(JSON.stringify(resolved.response)))
    if (typeof wire === 'string') throw new Error(wire)
    expect(answersRequest(parsed, resolved.response)).toBe(true)
    return resolved.response
  }

  ok(changes: readonly unknown[], env?: OperationEnv): SyncResponse {
    const response = this.sync(changes, env)
    if (response === NO_SAVE) throw new Error('no save')
    return response
  }

  row(key: string): SaveRow | undefined {
    return this.rows.get(key)
  }

  account() {
    return (this.rows.get('account/main') as EntityRow<'account'>).data
  }
}

/** A new account with the first `n` Umas unlocked, one operation each. */
function account(n = 0, env?: OperationEnv): Server {
  const server = new Server(env)
  server.ok([{ type: 'create', createdAt: clock('07:00') }])
  if (n > 0) server.ok(Array.from({ length: n }, (_, i) => op(900 + i, 'unlock-uma', { umaId: uma(i + 1) }, clock('07:01'))))
  return server
}

describe('the read set', () => {
  it('reads every entity kind for a create or an operation, the request’s operation rows, and account/main alone for nothing', () => {
    expect(syncReadSet(request([]))).toEqual({ collections: [], documents: ['account/main'] })
    expect(syncReadSet(request([{ type: 'create', createdAt: 1 }]))).toEqual({ collections: [...ENTITY_KINDS], documents: [] })
    expect(syncReadSet(request([op(1, 'unlock-uma', { umaId: uma(1) }, 5), op(2, 'unlock-card', { cardId: card(1) }, 6)]))).toEqual({
      collections: ['account', 'umas', 'cards', 'careers', 'bonds'], documents: [`operations/${opId(1)}`, `operations/${opId(2)}`],
    })
  })

  it('hands resolveSync every entity and only the operation rows the request names', () => {
    const server = account(2)
    server.ok([op(1, 'unlock-card', { cardId: card(1) }, clock('08:00'))])
    server.ok([op(1, 'unlock-card', { cardId: card(1) }, clock('08:00')), op(2, 'unlock-card', { cardId: card(2) }, clock('08:01'))])
    expect(server.reads.sort()).toEqual([
      'account/main', `cards/${card(1)}`, `operations/${opId(1)}`, `umas/${uma(1)}`, `umas/${uma(2)}`,
    ])
  })
})

describe('the new account', () => {
  it('is created from createdAt alone: 20 Uma Tickets and 24 Card Tickets, at version 1, with no logs', () => {
    const server = new Server()
    const response = server.ok([{ type: 'create', createdAt: clock('07:00') }])
    expect(response.results).toEqual([{ type: 'create', status: 'created' }])
    expect(server.account()).toEqual({ createdAt: clock('07:00'), umaTickets: 20, cardTickets: 24 })
    expect(response.entities).toEqual([expect.objectContaining({ kind: 'account', id: 'main', generation: 3, schema: 1, version: 1, savedAt: server.now })])
    expect(response.logs).toEqual([])
  })

  it('answers a second create `exists` with every entity, and writes nothing', () => {
    const server = account(2)
    server.ok([op(1, 'unlock-card', { cardId: card(1) }, clock('08:00'))])
    const before = new Map(server.rows)
    const response = server.ok([{ type: 'create', createdAt: clock('09:00') }])
    expect(response.results).toEqual([{ type: 'create', status: 'exists' }])
    expect(response.logs).toEqual([])
    expect(response.entities.map(rowKey)).toEqual(['account/main', `umas/${uma(1)}`, `umas/${uma(2)}`, `cards/${card(1)}`])
    // Each as stored: versions and times untouched.
    expect(response.entities).toEqual(response.entities.map((row) => before.get(rowKey(row))))
    expect(server.rows).toEqual(before)
  })

  it('accepts nothing but a create when there is no save', () => {
    const server = new Server()
    expect(server.sync([])).toBe(NO_SAVE)
    expect(server.sync([op(1, 'unlock-uma', { umaId: uma(1) }, 5)])).toBe(NO_SAVE)
    expect(server.rows.size).toBe(0)
    // A create first, and the rest of the batch runs on the account it made.
    const response = server.ok([{ type: 'create', createdAt: 5 }, op(1, 'unlock-uma', { umaId: uma(1) }, 6)])
    expect(response.results.map((result) => result.status)).toEqual(['created', 'applied'])
    expect(server.account().umaTickets).toBe(19)
    // A save that exists answers an empty request with nothing.
    expect(server.ok([])).toMatchObject({ results: [], entities: [], logs: [] })
  })
})

describe('operations', () => {
  it('re-runs each tap with the domain: two unlocks leave 18 tickets and write their rows and receipts', () => {
    const server = account()
    const response = server.ok([op(1, 'unlock-uma', { umaId: uma(1) }, clock('08:00')), op(2, 'unlock-uma', { umaId: uma(2) }, clock('08:01'))])
    expect(response.results).toEqual([
      { type: 'operation', id: opId(1), status: 'applied', receipt: { id: uma(1), ticketsLeft: 19 } },
      { type: 'operation', id: opId(2), status: 'applied', receipt: { id: uma(2), ticketsLeft: 18 } },
    ])
    expect(server.account().umaTickets).toBe(18)
    expect(response.entities.map(rowKey)).toEqual(['account/main', `umas/${uma(1)}`, `umas/${uma(2)}`])
    // The phone's time is the rules' `now`: the unlock is dated by the tap, not by the server.
    expect(server.row(`umas/${uma(1)}`)).toMatchObject({ data: { unlockedAt: clock('08:00') }, savedAt: server.now })
    expect(response.logs.map(rowKey)).toEqual([`operations/${opId(1)}`, `operations/${opId(2)}`])
    expect(response.logs[0]).toMatchObject({ at: clock('08:00'), data: { name: 'unlock-uma', at: clock('08:00'), receipt: { id: uma(1), ticketsLeft: 19 } } })
  })

  it('answers a retried id with its first receipt, never applies it twice, and writes nothing', () => {
    const server = account()
    const first = server.ok([op(1, 'unlock-uma', { umaId: uma(1) }, clock('08:00'))])
    const before = new Map(server.rows)
    const again = server.ok([op(1, 'unlock-uma', { umaId: uma(1) }, clock('09:00'))])
    expect(again.results).toEqual([{ ...first.results[0], status: 'repeated' }])
    expect(again.entities).toEqual([])
    expect(again.logs).toEqual([])
    expect(server.rows).toEqual(before)
    expect(server.account().umaTickets).toBe(19)
  })

  it('refuses an Uma unlocked twice, or a 21st unlock, in plain words, and writes nothing', () => {
    const server = account(20)
    expect(server.account().umaTickets).toBe(0)
    const before = new Map(server.rows)
    const response = server.ok([op(1, 'unlock-uma', { umaId: uma(1) }, clock('08:00')), op(2, 'unlock-uma', { umaId: uma(21) }, clock('08:01'))])
    expect(response.results).toEqual([
      { type: 'operation', id: opId(1), status: 'refused', refusal: expect.objectContaining({ refused: true, code: 'already-unlocked', reason: expect.any(String) }) },
      { type: 'operation', id: opId(2), status: 'refused', refusal: expect.objectContaining({ refused: true, code: 'no-tickets', reason: expect.any(String) }) },
    ])
    for (const result of response.results) {
      const { reason } = (result as { refusal: { reason: string } }).refusal
      expect(reason).not.toMatch(/operation|receipt|revision|generation|version|stale|conflict|payload|\bid\b/i)
    }
    expect(response.entities).toEqual([])
    expect(response.logs).toEqual([])
    expect(server.rows).toEqual(before)
  })

  it('answers a malformed input or an id reused under another name `invalid`, and the next operation still applies', () => {
    const server = account()
    server.ok([op(1, 'unlock-uma', { umaId: uma(1) }, clock('08:00'))])
    const response = server.ok([
      op(2, 'unlock-uma', { umaId: uma(2), extra: true }, clock('08:01')),
      op(1, 'unlock-card', { cardId: card(1) }, clock('08:02')),
      op(3, 'unlock-uma', { umaId: uma(2) }, clock('08:03')),
    ])
    expect(response.results.map((result) => result.status)).toEqual(['invalid', 'invalid', 'applied'])
    expect(response.results[0]).toEqual({ type: 'operation', id: opId(2), status: 'invalid' })
    expect(server.row(`operations/${opId(2)}`)).toBeUndefined()
    expect(server.row(`cards/${card(1)}`)).toBeUndefined()
    expect(server.account().umaTickets).toBe(18)
  })

  it('refuses a declared operation that is not built yet, and writes nothing', () => {
    const server = account(1)
    const before = new Map(server.rows)
    const response = server.ok([op(1, 'settle-stage', { careerId: 'x' }, clock('08:00'))])
    expect(response.results).toEqual([
      { type: 'operation', id: opId(1), status: 'refused', refusal: expect.objectContaining({ refused: true, code: 'not-built-yet' }) },
    ])
    expect(server.rows).toEqual(before)
  })

  it('applies a batch in order on one state and raises each document once', () => {
    const server = account()
    const response = server.ok([
      op(1, 'unlock-uma', { umaId: uma(1) }, clock('08:00')),
      op(2, 'unlock-card', { cardId: card(1) }, clock('08:01')),
      op(3, 'dev-grant', { umaTickets: 5, cardTickets: 1 }, clock('08:02')),
      op(4, 'unlock-card', { cardId: card(2) }, clock('08:03')),
    ], DEV)
    expect(response.results.map((result) => result.status)).toEqual(['applied', 'applied', 'applied', 'applied'])
    const keys = response.entities.map(rowKey)
    expect(keys).toEqual(['account/main', `umas/${uma(1)}`, `cards/${card(1)}`, `cards/${card(2)}`])
    expect(response.entities.find((row) => row.kind === 'account')).toMatchObject({ version: 2, data: { umaTickets: 24, cardTickets: 23 } })
    for (const row of response.entities.filter((row) => row.kind !== 'account')) expect(row.version, rowKey(row)).toBe(1)
  })

  it('runs dev-grant only on a dev env', () => {
    const server = account()
    expect(server.ok([op(1, 'dev-grant', { umaTickets: 10, cardTickets: 0 }, 5)]).results[0]).toMatchObject({ status: 'refused', refusal: { code: 'dev-only' } })
    expect(server.ok([op(2, 'dev-grant', { umaTickets: 10, cardTickets: 0 }, 6)], DEV).results[0]).toMatchObject({ status: 'applied' })
    expect(server.account().umaTickets).toBe(30)
  })

  it('needs the env only for an operation', () => {
    const create = request([{ type: 'create', createdAt: 1 }])
    expect(resolveSync(selectReadSet([], syncReadSet(create)), create, 2)).not.toBe(NO_SAVE)
    const server = account()
    const parsed = request([op(1, 'unlock-uma', { umaId: uma(1) }, 2)])
    expect(() => resolveSync(selectReadSet(server.rows.values(), syncReadSet(parsed)), parsed, 3)).toThrow('An operation needs its env')
  })
})

describe('the pull', () => {
  const T = 10 * 24 * HOUR
  /** A synthetic row of `kind`, saved at `savedAt`: only the order fields matter to a page. */
  const row = (kind: SaveRow['kind'], id: string, savedAt: number, pad = 0): SaveRow =>
    ({ kind, id, generation: 3, schema: 1, at: 0, savedAt, data: { pad: 'x'.repeat(pad) } }) as unknown as SaveRow

  it('walks KIND_ORDER, then savedAt, then id, and leaves out what was saved before `since`', () => {
    const rows = [row('raceResults', 'r', T), row('account', 'main', T + 5), row('umas', 'b', T + 1), row('umas', 'a', T + 1), row('cards', 'c1', T + 9),
      row('umas', 'c', T - 1), row('operations', 'op-test-0001', T + 2), row('bonds', 'b1', T + 3), row('careers', 'k1', T + 4)]
    const page = snapshotPage(rows, T - 1, null, T + 10)
    expect([...page.entities, ...page.logs].map(rowKey)).toEqual([
      'account/main', 'umas/a', 'umas/b', 'cards/c1', 'careers/k1', 'bonds/b1', 'operations/op-test-0001', 'raceResults/r',
    ])
    expect(page).toMatchObject({ ...STAMP, serverTime: T + 10, cursor: null })
  })

  it('carries a week of operation receipts, and every race result', () => {
    const now = T
    const rows = [row('operations', 'op-old-0001', now - OPERATIONS_WINDOW_MS), row('operations', 'op-new-0001', now - OPERATIONS_WINDOW_MS + 1),
      row('raceResults', 'op-old-0001', now - OPERATIONS_WINDOW_MS)]
    expect(snapshotPage(rows, 0, null, now).logs.map(rowKey)).toEqual(['operations/op-new-0001', 'raceResults/op-old-0001'])
  })

  it('pages within 1,000 rows and 4 MiB and resumes after its cursor', () => {
    const receipt = (i: number): SaveRow => stampLog(logDraft('operations', opId(i), 0, { name: 'unlock-uma', at: 0, receipt: {} }), T + (i % 7))
    const rows = Array.from({ length: 2_500 }, (_, i) => receipt(i))
    const seen: string[] = []
    let cursor: string | null = null
    let pages = 0
    do {
      const page = snapshotPage(rows, 0, cursor, T + 100)
      const parsed = parseSaveSnapshot(JSON.parse(JSON.stringify(page)))
      if (typeof parsed === 'string') throw new Error(parsed)
      expect(page.entities.length + page.logs.length).toBeLessThanOrEqual(SAVE_LIMITS.pageRows)
      seen.push(...page.logs.map(rowKey))
      cursor = page.cursor
      pages += 1
    } while (cursor !== null)
    expect(pages).toBe(3)
    expect(seen).toEqual([...rows].sort(comparePulled).map(rowKey))

    // Big rows: a page stops under 4 MiB, and the next one picks up where it stopped.
    const big = Array.from({ length: 20 }, (_, i) => row('raceResults', `big-${String(i).padStart(2, '0')}`, T, 400 * 1024))
    const first = snapshotPage(big, 0, null, T)
    expect(first.logs.length).toBe(10)
    expect(JSON.stringify(first).length).toBeLessThanOrEqual(SAVE_LIMITS.pageBytes)
    const second = snapshotPage(big, 0, first.cursor, T)
    expect(second.logs.map(rowKey)).toEqual(big.slice(10).map(rowKey))
    expect(second.cursor).toBeNull()
  })

  it('encodes the cursor as kind, savedAt and id in the wire alphabet, and refuses one it did not write', () => {
    const cursor = encodeCursor({ kind: 'raceResults', savedAt: 1_760_000_000_000, id: `${opId(1)}:2` })
    expect(cursor).toMatch(/^[A-Za-z0-9_.:~=-]{1,512}$/)
    expect(parseCursor(cursor)).toEqual({ kind: 'raceResults', savedAt: 1_760_000_000_000, id: `${opId(1)}:2` })
    for (const bad of ['account', 'profile~1~main', 'ledger~1~a', 'umas~x~a', 'umas~1~', 'umas~1~a~b']) expect(parseCursor(bad), bad).toBeNull()
    expect(() => snapshotPage([], 0, 'umas~1', T)).toThrow(RangeError)
  })

  it('pulls what the server wrote: stamped rows, the week of operations, the logs once', () => {
    const server = account(2)
    server.ok([op(1, 'unlock-card', { cardId: card(1) }, clock('08:00'))])
    const page = snapshotPage(server.rows.values(), 0, null, server.now)
    expect(page.entities.length + page.logs.length).toBe(server.rows.size)
    const parsed = parseSaveSnapshot(JSON.parse(JSON.stringify(page)))
    if (typeof parsed === 'string') throw new Error(parsed)
    expect(snapshotPage(server.rows.values(), server.now, null, server.now + 1)).toMatchObject({ entities: [], logs: [], cursor: null })
  })
})
