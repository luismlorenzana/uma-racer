// Sync v2 on the wire (docs/rearchitecture/01-target-architecture.md §4.3; docs/rearchitecture/07-data-reset.md §3–§4;
// T134): wrong stamps, a create that isn't first, a device write of any kind but badges and flair, and every bound are
// refused; responses answer every change in order; pages and the purge are stamped too.
import { describe, expect, it } from 'vitest'
import { clock, opId } from '../__fixtures__/save-g2'
import { createTrainerBadgeState, type FlairEventV1 } from '../badges'
import { flairEventId } from '../flair'
import { initialSave } from './initial'
import { SAVE_LIMITS } from './kinds'
import { stampEntity, stampLog } from './rows'
import {
  answersRequest, isCurrentStamp, parsePurgeRequest, parsePurgeResponse, parseSaveSnapshotV2, parseSnapshotQuery, parseSyncRequestV2,
  parseSyncResponseV2, snapshotQuery, type SyncChange,
} from './wire'

const T0 = clock('07:00')
const STAMP = { protocol: 2, generation: 2 }
const FLAIR: FlairEventV1 = {
  version: 1, scope: 'trainer', umaId: null, kind: 'trainer-achievement', awardKey: 'synthetic-award', stage: 'bronze', earnedAt: T0,
  source: { kind: 'race', id: 'race:synthetic:0', tier: 1 }, retroactive: false,
}
const FLAIR_ID = flairEventId('trainer', null, 'synthetic-award', 'bronze')

const CHANGES = (): SyncChange[] => [
  { type: 'create', createdAt: T0 },
  { type: 'upsert', kind: 'badges', id: 'trainer', baseVersion: 0, data: createTrainerBadgeState(T0) },
  { type: 'append', kind: 'flairEvents', id: FLAIR_ID, at: T0, data: FLAIR },
  { type: 'operation', operation: { id: opId(1), name: 'unlock-uma', input: { outfitId: 'uma-01' }, at: T0 + 1 } },
  { type: 'operation', operation: { id: opId(2), name: 'collect-all', input: { malformed: true }, at: T0 + 2 } },
]
const request = (changes: unknown[] = CHANGES()) => JSON.parse(JSON.stringify({ ...STAMP, changes })) as Record<string, unknown>

describe('the stamp', () => {
  it('is protocol 2 and generation 2, read before anything else', () => {
    expect(isCurrentStamp(STAMP)).toBe(true)
    for (const stamp of [{}, { protocol: 1, generation: 2 }, { protocol: 2, generation: 1 }, { protocol: 2, generation: 3 }, { protocol: '2', generation: '2' }, null, 'v2']) {
      expect(isCurrentStamp(stamp), JSON.stringify(stamp)).toBe(false)
      expect(typeof parseSyncRequestV2({ ...(stamp as object), changes: [] })).toBe('string')
      expect(typeof parsePurgeRequest(stamp)).toBe('string')
    }
  })
})

describe('the sync request', () => {
  it('takes the outbox in order: the create first, a badge, a flair event and operations, whose inputs are checked later', () => {
    const parsed = parseSyncRequestV2(request())
    expect(parsed).toEqual({ ...STAMP, changes: CHANGES() })
    expect(parseSyncRequestV2(request([]))).toEqual({ ...STAMP, changes: [] })
  })

  it('refuses a create that is not first, or a second one', () => {
    const [create, ...rest] = CHANGES()
    expect(typeof parseSyncRequestV2(request([...rest, create]))).toBe('string')
    expect(typeof parseSyncRequestV2(request([create, create]))).toBe('string')
  })

  it('refuses a device write of any kind but badges and flair events: those change only by operation', () => {
    for (const change of [
      { type: 'upsert', kind: 'profile', id: 'main', baseVersion: 1, data: initialSave(T0).state.profile },
      { type: 'upsert', kind: 'umas', id: 'uma-01', baseVersion: 0, data: {} },
      { type: 'upsert', kind: 'items', id: 'speed-ticket', baseVersion: 0, data: { count: 99 } },
      { type: 'upsert', kind: 'cards', id: 'card-1', baseVersion: 0, data: {} },
      { type: 'append', kind: 'ledger', id: 'grant', at: T0, data: { id: 'grant', resource: 'prize-money', delta: 1, reason: 'race-prize', at: T0 } },
      { type: 'append', kind: 'raceResults', id: opId(3), at: T0, data: {} },
      { type: 'append', kind: 'operations', id: opId(3), at: T0, data: {} },
      { type: 'upsert', kind: 'flairEvents', id: FLAIR_ID, baseVersion: 0, data: FLAIR },
      { type: 'append', kind: 'badges', id: 'trainer', at: T0, data: createTrainerBadgeState(T0) },
    ]) expect(typeof parseSyncRequestV2(request([change])), `${change.type} ${change.kind}`).toBe('string')
  })

  it('refuses malformed changes: a badge or flair id that its data does not name, a negative base, the same row twice', () => {
    const [, badge, flair, operation] = CHANGES()
    for (const changes of [
      [{ ...badge, id: 'uma:someone' }], [{ ...badge, baseVersion: -1 }], [{ ...flair, at: T0 + 1 }], [{ ...flair, id: 'flair:other' }],
      [badge, badge], [operation, operation], [{ type: 'teleport' }], [{ ...badge, extra: 1 }],
      [{ type: 'operation', operation: { id: 'bad', name: 'collect-all', input: {}, at: T0 } }],
      [{ type: 'operation', operation: { id: opId(4), name: 'teleport', input: {}, at: T0 } }],
    ]) expect(typeof parseSyncRequestV2(request(changes)), JSON.stringify(changes).slice(0, 100)).toBe('string')
  })

  it('refuses each bound: 100 changes, 2 MiB a request, 512 KiB an input, 160-character ids', () => {
    const op = (n: number, input: unknown = {}) => ({ type: 'operation', operation: { id: opId(n), name: 'collect-all', input, at: T0 } })
    expect(typeof parseSyncRequestV2(request(Array.from({ length: SAVE_LIMITS.changes }, (_, n) => op(n))))).toBe('object')
    expect(typeof parseSyncRequestV2(request(Array.from({ length: SAVE_LIMITS.changes + 1 }, (_, n) => op(n))))).toBe('string')
    const input = (kib: number) => ({ shown: [], pad: 'x'.repeat(kib * 1024) })
    expect(typeof parseSyncRequestV2(request([op(1, input(500))]))).toBe('object')
    expect(typeof parseSyncRequestV2(request([op(1, input(513))]))).toBe('string')
    expect(typeof parseSyncRequestV2(request(Array.from({ length: 5 }, (_, n) => op(n, input(480)))))).toBe('string')
    const [, badge] = CHANGES()
    expect(typeof parseSyncRequestV2(request([{ ...badge, id: 'x'.repeat(161) }]))).toBe('string')
  })

  it('pins the bounds', () => {
    expect(SAVE_LIMITS).toEqual({ changes: 100, requestBytes: 2_097_152, rowBytes: 524_288, pageRows: 1_000, pageBytes: 4_194_304, idLength: 160 })
  })
})

describe('the sync response', () => {
  const save = initialSave(T0)
  const entities = save.entities.map((draft) => stampEntity(draft, 1, T0))
  const logs = save.logs.map((draft) => stampLog(draft, T0))
  const results = [
    { type: 'create', status: 'created' },
    { type: 'upsert', kind: 'badges', id: 'trainer', status: 'applied', version: 1 },
    { type: 'append', kind: 'flairEvents', id: FLAIR_ID, status: 'appended' },
    { type: 'operation', id: opId(1), status: 'applied', receipt: { outfitId: 'uma-01', ticketsSpent: 1, featured: true } },
    { type: 'operation', id: opId(2), status: 'invalid' },
  ]
  const response = { ...STAMP, serverTime: T0 + 10, results, entities, logs }

  it('takes every result, row and copy, and answers the request change by change, in order', () => {
    const parsed = parseSyncResponseV2(JSON.parse(JSON.stringify(response)))
    if (typeof parsed === 'string') throw new Error(parsed)
    expect(parsed).toEqual(response)
    const sent = parseSyncRequestV2(request())
    if (typeof sent === 'string') throw new Error(sent)
    expect(answersRequest(sent, parsed)).toBe(true)
    expect(answersRequest(sent, { results: parsed.results.slice(1) })).toBe(false)
    expect(answersRequest(sent, { results: [parsed.results[0]!, parsed.results[2]!, parsed.results[1]!, ...parsed.results.slice(3)] })).toBe(false)
  })

  it('refuses a wrong stamp, a malformed result or row, and a row given twice', () => {
    for (const bad of [
      { ...response, generation: 1 }, { ...response, results: [{ type: 'create', status: 'maybe' }] },
      { ...response, results: [{ type: 'operation', id: opId(1), status: 'refused', refusal: { code: 'x' } }] },
      { ...response, entities: [...entities, entities[0]] }, { ...response, logs: [{ ...logs[0], generation: 1 }] }, { ...response, extra: 1 },
    ]) expect(typeof parseSyncResponseV2(JSON.parse(JSON.stringify(bad)))).toBe('string')
    const refused = { type: 'operation', id: opId(1), status: 'refused', refusal: { refused: true, code: 'no-ticket', reason: 'No Uma Ticket left.' } }
    expect(typeof parseSyncResponseV2({ ...response, results: [refused] })).toBe('object')
  })
})

describe('pages and the purge', () => {
  const save = initialSave(T0)
  const entities = save.entities.map((draft) => stampEntity(draft, 1, T0))
  const page = { ...STAMP, serverTime: T0, entities, logs: [], cursor: null }

  it('takes a stamped page of up to 1,000 rows and 4 MiB, with an opaque cursor', () => {
    expect(parseSaveSnapshotV2(page)).toEqual(page)
    expect(parseSaveSnapshotV2({ ...page, cursor: 'items:1760425200000:carrot' })).toMatchObject({ cursor: 'items:1760425200000:carrot' })
    expect(typeof parseSaveSnapshotV2({ ...page, protocol: 1 })).toBe('string')
    expect(typeof parseSaveSnapshotV2({ ...page, cursor: 'has spaces' })).toBe('string')
    const many = Array.from({ length: SAVE_LIMITS.pageRows + 1 - entities.length }, (_, n) => ({ ...entities[1]!, id: `x${n}` }))
    expect(typeof parseSaveSnapshotV2({ ...page, entities: [...entities, ...many] })).toBe('string')
  })

  it('reads a GET query: the stamp as strings, since (0 when absent) and the cursor', () => {
    expect(snapshotQuery(0, null)).toEqual({ protocol: '2', generation: '2', since: '0' })
    expect(parseSnapshotQuery(snapshotQuery(T0, 'c1'))).toEqual({ ...STAMP, since: T0, cursor: 'c1' })
    expect(parseSnapshotQuery({ protocol: '2', generation: '2' })).toEqual({ ...STAMP, since: 0, cursor: null })
    expect(parseSnapshotQuery({ protocol: '1', generation: '2' })).toBeUndefined()
    expect(parseSnapshotQuery({})).toBeUndefined()
    expect(typeof parseSnapshotQuery({ protocol: '2', generation: '2', since: '-5' })).toBe('string')
  })

  it('stamps the purge both ways', () => {
    expect(parsePurgeRequest(STAMP)).toEqual(STAMP)
    expect(typeof parsePurgeRequest({ ...STAMP, uid: 'x' })).toBe('string')
    const purged = { ...STAMP, status: 'purged', at: T0, counts: { collections: 12, documents: 3_456 } }
    expect(parsePurgeResponse(purged)).toEqual(purged)
    expect(parsePurgeResponse({ ...purged, status: 'already' })).toEqual({ ...purged, status: 'already' })
    expect(typeof parsePurgeResponse({ ...purged, status: 'done' })).toBe('string')
    expect(typeof parsePurgeResponse({ ...purged, counts: { collections: -1, documents: 0 } })).toBe('string')
  })
})
