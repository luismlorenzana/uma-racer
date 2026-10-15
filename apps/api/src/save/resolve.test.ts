// Generation 2's sync and pull, pure (T135): the read set, the new account, operations re-run with the domain, two
// devices, the device rows' rules, coalesced writes and the pages. Synthetic content only (the domain's fixtures).
import { beforeAll, describe, expect, it } from 'vitest'
import { createTrainerBadgeState, flairEventId, type FlairEventV1 } from '@racer/domain'
import { rawItem } from '@racer/domain/items'
import {
  answersRequest, KIND_ORDER, logDraft, stampLog, OPERATIONS_WINDOW_MS, parseSaveSnapshotV2, parseSyncRequestV2, parseSyncResponseV2, rowKey, SAVE_LIMITS,
  type EntityRow, type LogRow, type OperationEnv, type SyncChange, type SyncRequestV2, type SyncResponseV2,
} from '@racer/domain/save'
import {
  comparePulled, encodeCursor, NO_SAVE, parseCursor, resolveSync, selectReadSet, snapshotPage, syncReadSet, type SaveRow,
} from './resolve'
import { saveFixtures, type SaveFixtures } from './save.test-support'

let F: SaveFixtures
beforeAll(async () => { F = await saveFixtures() })

const STAMP = { protocol: 2, generation: 2 } as const
const VEG = rawItem('vegetables', 1).id
const GARDEN = { building: 'vegetable-garden', slot: 0 } as const
const HOUR = 60 * 60 * 1000

/** A request as the wire carries it, through T134's parser. */
function request(changes: readonly unknown[]): SyncRequestV2 {
  const parsed = parseSyncRequestV2(JSON.parse(JSON.stringify({ ...STAMP, changes })))
  if (typeof parsed === 'string') throw new Error(parsed)
  return parsed
}

const op = (n: number, name: string, input: unknown, at: number): SyncChange =>
  ({ type: 'operation', operation: { id: F.opId(n), name, input, at } }) as SyncChange

/** A stand-in for a repository: every row of one save, the read set, `resolveSync`, then the writes. */
class Server {
  readonly rows = new Map<string, SaveRow>()
  now = 1_000_000
  reads: string[] = []

  constructor(private readonly env: OperationEnv = F.ENV) {}

  sync(changes: readonly unknown[], env: OperationEnv = this.env): SyncResponseV2 | typeof NO_SAVE {
    const parsed = request(changes)
    const stored = selectReadSet(this.rows.values(), syncReadSet(parsed))
    this.reads = [...stored.entities.keys(), ...stored.logs.keys()]
    this.now += 1_000
    const resolved = resolveSync(stored, parsed, this.now, env)
    if (resolved === NO_SAVE) return NO_SAVE
    for (const row of [...resolved.entities, ...resolved.logs]) this.rows.set(rowKey(row), row)
    // Every answer is one T134's client parser takes, and answers its request change by change.
    const wire = parseSyncResponseV2(JSON.parse(JSON.stringify(resolved.response)))
    if (typeof wire === 'string') throw new Error(wire)
    expect(answersRequest(parsed, resolved.response)).toBe(true)
    return resolved.response
  }

  ok(changes: readonly unknown[], env?: OperationEnv): SyncResponseV2 {
    const response = this.sync(changes, env)
    if (response === NO_SAVE) throw new Error('no save')
    return response
  }

  row(key: string): SaveRow | undefined {
    return this.rows.get(key)
  }

  profile() {
    return (this.rows.get('profile/main') as EntityRow<'profile'>).data
  }
}

/** A new account with the first `n` Umas unlocked, one operation each. */
function account(n = 0, env?: OperationEnv): Server {
  const server = new Server(env)
  server.ok([{ type: 'create', createdAt: F.clock('07:00') }])
  if (n > 0) server.ok(Array.from({ length: n }, (_, i) => op(900 + i, 'unlock-uma', { outfitId: F.uma(i + 1) }, F.clock('07:01'))))
  return server
}

const FLAIR = (stage: FlairEventV1['stage'], earnedAt: number): FlairEventV1 => ({
  version: 1, scope: 'trainer', umaId: null, kind: 'trainer-achievement', awardKey: 'synthetic-award', stage, earnedAt,
  source: { kind: 'race', id: 'race:synthetic:0', tier: 1 }, retroactive: false,
})

describe('the read set', () => {
  it('reads the operation set for a create or an operation, and only the documents a device change names', () => {
    expect(syncReadSet(request([{ type: 'upsert', kind: 'badges', id: 'trainer', baseVersion: 0, data: createTrainerBadgeState(1) }]))).toEqual({
      collections: [], ruleLedger: false, documents: ['profile/main', 'badges/trainer'],
    })
    expect(syncReadSet(request([op(1, 'collect-all', {}, 5), op(2, 'repeat', {}, 6)]))).toEqual({
      collections: ['profile', 'umas', 'buildings', 'work', 'items'], ruleLedger: true, documents: [`operations/${F.opId(1)}`, `operations/${F.opId(2)}`],
    })
    // A create's `exists` answers every entity, so it reads the badges too, and names no badge document again.
    const flairId = flairEventId('trainer', null, 'synthetic-award', 'bronze')
    expect(syncReadSet(request([
      { type: 'create', createdAt: 1 },
      { type: 'upsert', kind: 'badges', id: 'trainer', baseVersion: 0, data: createTrainerBadgeState(1) },
      { type: 'append', kind: 'flairEvents', id: flairId, at: 1, data: FLAIR('bronze', 1) },
    ]))).toEqual({ collections: ['profile', 'umas', 'buildings', 'work', 'items', 'badges'], ruleLedger: true, documents: [`flairEvents/${flairId}`] })
  })

  it('hands resolveSync the rule rows of the ledger and nothing else of the logs', () => {
    const server = account(1)
    server.ok([op(1, 'dev-grant', { prizeMoney: 500 }, F.clock('08:00'))], F.DEV)
    server.ok([op(2, 'collect-all', {}, F.clock('08:01'))])
    const keys = server.reads.filter((key) => !/^(profile|umas|buildings|work|items)\//.test(key))
    expect(keys.sort()).toEqual([`ledger/initial-uma-tickets`, `ledger/unlock-uma:${F.uma(1)}`])
  })
})

describe('the new account', () => {
  it('is created from createdAt alone: 20 Uma Tickets, 14 buildings at version 1 and its ledger row', () => {
    const server = new Server()
    const response = server.ok([{ type: 'create', createdAt: F.clock('07:00') }])
    expect(response.results).toEqual([{ type: 'create', status: 'created' }])
    expect(server.profile()).toMatchObject({ umaTickets: 20, featuredUmaId: null, createdAt: F.clock('07:00') })
    const buildings = response.entities.filter((row) => row.kind === 'buildings')
    expect(buildings).toHaveLength(14)
    expect(response.entities.every((row) => row.version === 1 && row.savedAt === server.now)).toBe(true)
    expect(response.logs.map(rowKey)).toEqual(['ledger/initial-uma-tickets'])
    expect(response.logs[0]).toMatchObject({ at: F.clock('07:00'), savedAt: server.now, data: { delta: 20, reason: 'initial-uma-tickets' } })
  })

  it('answers a second create `exists` with every entity, badges too, and writes nothing', () => {
    const server = account(1)
    server.ok([{ type: 'upsert', kind: 'badges', id: 'trainer', baseVersion: 0, data: createTrainerBadgeState(5) }])
    const before = new Map(server.rows)
    const response = server.ok([{ type: 'create', createdAt: F.clock('09:00') }])
    expect(response.results).toEqual([{ type: 'create', status: 'exists' }])
    expect(response.logs).toEqual([])
    const entities = [...before.values()].filter((row) => KIND_ORDER.indexOf(row.kind) < KIND_ORDER.indexOf('ledger')).map(rowKey).sort()
    expect(response.entities.map(rowKey).sort()).toEqual(entities)
    expect(response.entities.map(rowKey)).toContain('badges/trainer')
    expect(server.rows).toEqual(before)
  })

  it('accepts nothing but a create when there is no save', () => {
    const server = new Server()
    expect(server.sync([])).toBe(NO_SAVE)
    expect(server.sync([{ type: 'upsert', kind: 'badges', id: 'trainer', baseVersion: 0, data: createTrainerBadgeState(5) }])).toBe(NO_SAVE)
    expect(server.sync([op(1, 'unlock-uma', { outfitId: F.uma(1) }, 5)])).toBe(NO_SAVE)
    expect(server.rows.size).toBe(0)
    // A create first, and the rest of the batch runs on the account it made.
    const response = server.ok([{ type: 'create', createdAt: 5 }, op(1, 'unlock-uma', { outfitId: F.uma(1) }, 6)])
    expect(response.results.map((result) => result.status)).toEqual(['created', 'applied'])
    expect(server.profile().umaTickets).toBe(19)
  })
})

describe('operations', () => {
  it('re-runs each tap with the domain: two unlocks leave 18 tickets, the first featured', () => {
    const server = account()
    const response = server.ok([op(1, 'unlock-uma', { outfitId: F.uma(1) }, F.clock('08:00')), op(2, 'unlock-uma', { outfitId: F.uma(2) }, F.clock('08:01'))])
    expect(response.results).toEqual([
      { type: 'operation', id: F.opId(1), status: 'applied', receipt: { outfitId: F.uma(1), ticketsSpent: 1, featured: true } },
      { type: 'operation', id: F.opId(2), status: 'applied', receipt: { outfitId: F.uma(2), ticketsSpent: 1, featured: false } },
    ])
    expect(server.profile()).toMatchObject({ umaTickets: 18, featuredUmaId: F.uma(1) })
    expect(response.logs.map(rowKey)).toEqual([
      `ledger/unlock-uma:${F.uma(1)}`, `ledger/unlock-uma:${F.uma(2)}`, `operations/${F.opId(1)}`, `operations/${F.opId(2)}`,
    ])
  })

  it('answers a retried id with its first receipt, never applies it twice, and writes nothing', () => {
    const server = account()
    const first = server.ok([op(1, 'unlock-uma', { outfitId: F.uma(1) }, F.clock('08:00'))])
    const before = new Map(server.rows)
    const again = server.ok([op(1, 'unlock-uma', { outfitId: F.uma(1) }, F.clock('09:00'))])
    expect(again.results).toEqual([{ ...first.results[0], status: 'repeated' }])
    expect(again.entities).toEqual([])
    expect(again.logs).toEqual([])
    expect(server.rows).toEqual(before)
    expect(server.profile().umaTickets).toBe(19)
  })

  it('refuses a 21st unlock in its plain words and writes nothing', () => {
    const server = account(20)
    expect(server.profile().umaTickets).toBe(0)
    const before = new Map(server.rows)
    const response = server.ok([op(1, 'unlock-uma', { outfitId: F.uma(21) }, F.clock('08:00'))])
    expect(response.results).toEqual([{
      type: 'operation', id: F.opId(1), status: 'refused', refusal: expect.objectContaining({ refused: true, code: 'no-ticket', reason: expect.any(String) }),
    }])
    const refusal = (response.results[0] as { refusal: { reason: string } }).refusal
    expect(refusal.reason).not.toMatch(/operation|receipt|revision|generation|version|stale|conflict|payload|\bid\b/i)
    expect(response.entities).toEqual([])
    expect(response.logs).toEqual([])
    expect(server.rows).toEqual(before)
  })

  it('answers a malformed input `invalid`, and the next operation still applies', () => {
    const server = account()
    const response = server.ok([
      op(1, 'unlock-uma', { outfitId: F.uma(1), extra: true }, F.clock('08:00')),
      op(2, 'unlock-uma', { outfitId: F.uma(1) }, F.clock('08:01')),
    ])
    expect(response.results.map((result) => result.status)).toEqual(['invalid', 'applied'])
    expect(response.results[0]).toEqual({ type: 'operation', id: F.opId(1), status: 'invalid' })
    expect(server.row(`operations/${F.opId(1)}`)).toBeUndefined()
    expect(server.profile().umaTickets).toBe(19)
  })

  it('applies a batch in order on one state and raises each document once', () => {
    const server = account()
    const versions = new Map([...server.rows].map(([key, row]) => [key, 'version' in row ? row.version : 0]))
    const response = server.ok([
      op(1, 'unlock-uma', { outfitId: F.uma(1) }, F.clock('08:00')),
      op(2, 'start', { outfitId: F.uma(1), slot: GARDEN, request: { kind: 'gather', item: VEG, count: 1 } }, F.clock('08:01')),
      op(3, 'collect', { outfitId: F.uma(1) }, F.clock('20:00')),
    ])
    expect(response.results.map((result) => result.status)).toEqual(['applied', 'applied', 'applied'])
    const keys = response.entities.map(rowKey)
    expect(new Set(keys).size).toBe(keys.length)
    expect(keys).toEqual(expect.arrayContaining(['profile/main', `umas/${F.uma(1)}`, `work/${F.uma(1)}`, `items/${VEG}`]))
    for (const row of response.entities) expect(row.version, rowKey(row)).toBe((versions.get(rowKey(row)) ?? 0) + 1)
    expect((server.row(`items/${VEG}`) as EntityRow<'items'>).data.count).toBeGreaterThan(0)
    expect(response.logs.filter((row) => row.kind === 'itemLedger').length).toBeGreaterThan(0)
  })

  it('runs dev-grant only on a dev env (M034)', () => {
    const server = account()
    expect(server.ok([op(1, 'dev-grant', { prizeMoney: 100 }, 5)]).results[0]).toMatchObject({ status: 'refused', refusal: { code: 'dev-only' } })
    expect(server.ok([op(2, 'dev-grant', { prizeMoney: 100 }, 6)], F.DEV).results[0]).toMatchObject({ status: 'applied' })
    expect(server.profile().prizeMoney).toBe(100)
  })
})

describe('two devices and the clock', () => {
  it("gives a later Collect all the server's receipt: what A collected reads Already collected on B (02 §9)", () => {
    const server = account(1)
    server.ok([op(1, 'start', { outfitId: F.uma(1), slot: GARDEN, request: { kind: 'gather', item: VEG, count: 2 } }, F.clock('08:00'))])
    const a = server.ok([op(2, 'collect-all', { shown: [GARDEN] }, F.clock('20:00'))])
    const collected = (a.results[0] as { receipt: { totals: { items: number }; lines: { status: string }[] } }).receipt
    expect(collected.totals.items).toBe(2)
    expect(collected.lines.map((line) => line.status)).toEqual(['collected'])
    const count = (server.row(`items/${VEG}`) as EntityRow<'items'>).data.count
    const b = server.ok([op(3, 'collect-all', { shown: [GARDEN] }, F.clock('20:05'))])
    const late = (b.results[0] as { receipt: { totals: { items: number }; lines: { status: string; items: unknown[] }[] } }).receipt
    expect(late.totals.items).toBe(0)
    expect(late.lines).toEqual([expect.objectContaining({ status: 'already-collected', items: [] })])
    expect((server.row(`items/${VEG}`) as EntityRow<'items'>).data.count).toBe(count)
  })

  it("trusts the phone's clock: work it moved forward is finished, and its collect is accepted (02 §8, §12)", () => {
    const server = account(1)
    server.ok([op(1, 'start', { outfitId: F.uma(1), slot: GARDEN, request: { kind: 'gather', item: VEG, count: 1 } }, F.clock('08:00'))])
    // The server's own clock is a second later; the tap says a day has passed.
    const response = server.ok([op(2, 'collect', { outfitId: F.uma(1) }, F.clock('08:00') + 24 * HOUR)])
    expect(response.results[0]).toMatchObject({ status: 'applied' })
    expect((server.row(`items/${VEG}`) as EntityRow<'items'>).data.count).toBe(1)
  })
})

describe('the device rows', () => {
  it('writes a badge at version 1 from 0, at version + 1 on a match, and answers anything else a conflict', () => {
    const server = account()
    const badge = (version: number, at: number) => ({ type: 'upsert', kind: 'badges', id: 'trainer', baseVersion: version, data: createTrainerBadgeState(at) })
    // Missing with a base: a conflict with no copy, and nothing written.
    const missing = server.ok([badge(3, 1)])
    expect(missing.results).toEqual([{ type: 'upsert', kind: 'badges', id: 'trainer', status: 'conflict' }])
    expect(missing.entities).toEqual([])
    expect(server.row('badges/trainer')).toBeUndefined()
    expect(server.ok([badge(0, 1)]).results).toEqual([{ type: 'upsert', kind: 'badges', id: 'trainer', status: 'applied', version: 1 }])
    const matched = server.ok([badge(1, 2)])
    expect(matched.results).toEqual([{ type: 'upsert', kind: 'badges', id: 'trainer', status: 'applied', version: 2 }])
    expect(matched.entities).toEqual([expect.objectContaining({ kind: 'badges', id: 'trainer', version: 2, savedAt: server.now, data: createTrainerBadgeState(2) })])
    // Stale: the server's copy comes back, and nothing is written.
    const stale = server.ok([badge(1, 3)])
    expect(stale.results).toEqual([{ type: 'upsert', kind: 'badges', id: 'trainer', status: 'conflict' }])
    expect(stale.entities).toEqual([server.row('badges/trainer')])
    expect(server.row('badges/trainer')).toMatchObject({ version: 2, data: createTrainerBadgeState(2) })
    // A create's `exists` lists the badge once, though the upsert in the same request conflicts.
    const both = server.ok([{ type: 'create', createdAt: 1 }, badge(0, 5)])
    expect(both.results.map((result) => result.status)).toEqual(['exists', 'conflict'])
    expect(both.entities.filter((row) => row.kind === 'badges')).toHaveLength(1)
  })

  it('keeps the first write of a flair event', () => {
    const server = account()
    const id = flairEventId('trainer', null, 'synthetic-award', 'bronze')
    const first = server.ok([{ type: 'append', kind: 'flairEvents', id, at: 10, data: FLAIR('bronze', 10) }])
    expect(first.results).toEqual([{ type: 'append', kind: 'flairEvents', id, status: 'appended' }])
    expect(first.logs).toEqual([expect.objectContaining({ kind: 'flairEvents', id, at: 10, savedAt: server.now })])
    const second = server.ok([{ type: 'append', kind: 'flairEvents', id, at: 20, data: FLAIR('bronze', 20) }])
    expect(second.results).toEqual([{ type: 'append', kind: 'flairEvents', id, status: 'exists' }])
    expect(second.logs).toEqual([])
    expect((server.row(`flairEvents/${id}`) as LogRow<'flairEvents'>).data.earnedAt).toBe(10)
  })
})

describe('the pull', () => {
  const T = 10 * 24 * HOUR
  /** A synthetic log row of `kind`, saved at `savedAt`: only the order fields matter to a page. */
  const row = (kind: SaveRow['kind'], id: string, savedAt: number, pad = 0): SaveRow =>
    ({ kind, id, generation: 2, schema: 1, at: 0, savedAt, data: { pad: 'x'.repeat(pad) } }) as unknown as SaveRow

  it('walks KIND_ORDER, then savedAt, then id, and leaves out what was saved before `since`', () => {
    const rows = [row('raceResults', 'r', T), row('profile', 'main', T + 5), row('umas', 'b', T + 1), row('umas', 'a', T + 1), row('buildings', 'gym', T + 9),
      row('umas', 'c', T - 1), row('ledger', 'l', T + 2)]
    const page = snapshotPage(rows, T - 1, null, T + 10)
    expect([...page.entities, ...page.logs].map(rowKey)).toEqual(['profile/main', 'buildings/gym', 'umas/a', 'umas/b', 'ledger/l', 'raceResults/r'])
    expect(page).toMatchObject({ ...STAMP, serverTime: T + 10, cursor: null })
  })

  it('carries a week of operation receipts', () => {
    const now = T
    const rows = [row('operations', 'op-old-0001', now - OPERATIONS_WINDOW_MS), row('operations', 'op-new-0001', now - OPERATIONS_WINDOW_MS + 1),
      row('ledger', 'old', now - OPERATIONS_WINDOW_MS)]
    expect(snapshotPage(rows, 0, null, now).logs.map(rowKey)).toEqual(['ledger/old', 'operations/op-new-0001'])
  })

  it('pages within 1,000 rows and 4 MiB and resumes after its cursor', () => {
    const ledger = (i: number): SaveRow => {
      const id = `row-${String(i).padStart(5, '0')}`
      return stampLog(logDraft('ledger', id, 0, { id, resource: 'uma-tickets', delta: 1, reason: 'unlock-uma', at: 0 }), T + (i % 7))
    }
    const rows = Array.from({ length: 2_500 }, (_, i) => ledger(i))
    const seen: string[] = []
    let cursor: string | null = null
    let pages = 0
    do {
      const page = snapshotPage(rows, 0, cursor, T + 100)
      const parsed = parseSaveSnapshotV2(JSON.parse(JSON.stringify(page)))
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
    const cursor = encodeCursor({ kind: 'itemLedger', savedAt: 1_760_000_000_000, id: `${F.opId(1)}:m0` })
    expect(cursor).toMatch(/^[A-Za-z0-9_.:~=-]{1,512}$/)
    expect(parseCursor(cursor)).toEqual({ kind: 'itemLedger', savedAt: 1_760_000_000_000, id: `${F.opId(1)}:m0` })
    for (const bad of ['profile', 'teams~1~a', 'umas~x~a', 'umas~1~', 'umas~1~a~b']) expect(parseCursor(bad), bad).toBeNull()
    expect(() => snapshotPage([], 0, 'umas~1', T)).toThrow(RangeError)
  })

  it('pulls what the server wrote: stamped rows, the week of operations, the logs once', () => {
    const server = account(2)
    const page = snapshotPage(server.rows.values(), 0, null, server.now)
    expect(page.entities.length + page.logs.length).toBe(server.rows.size)
    const parsed = parseSaveSnapshotV2(JSON.parse(JSON.stringify(page)))
    if (typeof parsed === 'string') throw new Error(parsed)
    expect(snapshotPage(server.rows.values(), server.now, null, server.now + 1)).toMatchObject({ entities: [], logs: [], cursor: null })
  })
})
