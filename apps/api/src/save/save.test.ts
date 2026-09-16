import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { LocalSaveRepository } from './local-save.repository'
import { MAX_SYNC_OPERATIONS, parseSyncRequest } from './save.types'

describe('LocalSaveRepository sync', () => {
  let dir: string
  let repo: LocalSaveRepository

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'racer-save-'))
    repo = new LocalSaveRepository(join(dir, 'save.json'))
  })
  afterEach(() => rm(dir, { recursive: true, force: true }))

  it('applies new entities at version 1 and bumps on matching baseVersion', async () => {
    const first = await repo.sync('u1', { upserts: [{ kind: 'umas', id: 'spe', baseVersion: 0, data: { level: 1 } }], appends: [] })
    expect(first.applied).toEqual([{ kind: 'umas', id: 'spe', version: 1 }])

    const second = await repo.sync('u1', { upserts: [{ kind: 'umas', id: 'spe', baseVersion: 1, data: { level: 2 } }], appends: [] })
    expect(second.applied[0]?.version).toBe(2)

    const save = await repo.load('u1')
    expect(save.entities).toHaveLength(1)
    expect(save.entities[0]?.data).toEqual({ level: 2 })
  })

  it('returns the server copy on a stale upsert instead of overwriting', async () => {
    await repo.sync('u1', { upserts: [{ kind: 'cards', id: 'c1', baseVersion: 0, data: { lb: 1 } }], appends: [] })
    await repo.sync('u1', { upserts: [{ kind: 'cards', id: 'c1', baseVersion: 1, data: { lb: 2 } }], appends: [] })
    const stale = await repo.sync('u1', { upserts: [{ kind: 'cards', id: 'c1', baseVersion: 1, data: { lb: 9 } }], appends: [] })
    expect(stale.applied).toEqual([])
    expect(stale.conflicts[0]?.data).toEqual({ lb: 2 })
  })

  it('appends logs idempotently and keeps players separate', async () => {
    const append = { kind: 'raceResults' as const, id: 'r1', data: { placement: 1 }, createdAt: 1 }
    expect((await repo.sync('u1', { upserts: [], appends: [append] })).appended).toBe(1)
    expect((await repo.sync('u1', { upserts: [], appends: [append] })).appended).toBe(0)
    expect((await repo.load('u1')).logs).toHaveLength(1)
    expect((await repo.load('u2')).logs).toHaveLength(0)
  })
})

describe('parseSyncRequest', () => {
  it('rejects unknown kinds, bad ids, and oversized batches', () => {
    expect(parseSyncRequest({ upserts: [{ kind: 'nope', id: 'a', baseVersion: 0, data: {} }] })).toMatch(/unknown entity kind/)
    expect(parseSyncRequest({ upserts: [{ kind: 'umas', id: '../x', baseVersion: 0, data: {} }] })).toMatch(/invalid entity id/)
    const many = Array.from({ length: MAX_SYNC_OPERATIONS + 1 }, (_, i) => ({ kind: 'ledger', id: `l${i}`, data: {}, createdAt: 0 }))
    expect(parseSyncRequest({ appends: many })).toMatch(/at most/)
  })

  it('accepts a valid batch', () => {
    const profile = {
      schemaVersion: 1,
      tickets: 50,
      cardCoupons: 3,
      umaCoupons: 0,
      umaShards: 0,
      lastDailyGrant: '2026-01-01',
      featuredUmaId: null,
      starterSeedContentVersion: 'synthetic-v1',
      createdAt: 1,
    }
    const parsed = parseSyncRequest({
      upserts: [{ kind: 'profile', id: 'main', baseVersion: 3, data: profile }],
      appends: [
        {
          kind: 'ledger',
          id: 'l1',
          data: { resource: 'tickets', delta: 50, reason: 'daily-grant', localDay: '2026-01-01', createdAt: 1 },
          createdAt: 1,
        },
      ],
    })
    expect(typeof parsed).toBe('object')
    expect(parseSyncRequest({ upserts: [{ kind: 'profile', id: 'main', baseVersion: 3, data: { ...profile, copiedName: 'Synthetic' } }] })).toMatch(/invalid profile data/)
    expect(parseSyncRequest({ upserts: [
      { kind: 'profile', id: 'main', baseVersion: 3, data: profile },
      { kind: 'profile', id: 'main', baseVersion: 3, data: profile },
    ] })).toMatch(/duplicate/)
  })
})
