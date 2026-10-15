// The device's database (T136; docs/rearchitecture/01-target-architecture.md §4.2): `uma-racer-g2` at version 1, one
// table per kind and the outbox and nothing else, rows read back through T134's parsers, and an unreadable row left
// where it is.
import 'fake-indexeddb/auto'
import { ENTITY_KINDS, LOG_KINDS } from '@racer/domain/save-g2'
import Dexie from 'dexie'
import { describe, expect, it } from 'vitest'
import { parseStoredEntity, readConfirmed, SAVE_DB_NAME, SaveDb, UnreadableRow } from './db'
import { FakeServer, freshDb, trainerBadge } from './__fixtures__/server'

describe('uma-racer-g2', () => {
  it('opens at version 1 with one table per kind and the outbox, and nothing else', async () => {
    const db = new SaveDb()
    await db.open()
    expect(db.name).toBe(SAVE_DB_NAME)
    expect(SAVE_DB_NAME).toBe('uma-racer-g2')
    expect(db.verno).toBe(1)
    expect(db.tables.map((table) => table.name).sort()).toEqual([...ENTITY_KINDS, ...LOG_KINDS, 'outbox'].sort())
    const indexes = (name: string) => db.table(name).schema.indexes.map((index) => index.name).sort()
    for (const kind of ENTITY_KINDS) expect([db.table(kind).schema.primKey.keyPath, indexes(kind)]).toEqual(['id', []])
    expect(indexes('ledger')).toEqual(['at', 'data.reason'])
    expect(indexes('raceResults')).toEqual(['at', 'data.umaId'])
    for (const kind of ['itemLedger', 'flairEvents', 'operations']) expect(indexes(kind)).toEqual(['at'])
    expect(db.outbox.schema.primKey).toMatchObject({ keyPath: 'seq', auto: true })
    expect(db.outbox.schema.indexes).toEqual([expect.objectContaining({ name: 'key', unique: true })])
    db.close()
    // IndexedDB itself holds the same stores: Dexie's version 1 is IndexedDB's 10.
    const raw = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(SAVE_DB_NAME)
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
    expect(raw.version).toBe(10)
    expect([...raw.objectStoreNames].sort()).toEqual([...ENTITY_KINDS, ...LOG_KINDS, 'outbox'].sort())
    raw.close()
    await Dexie.delete(SAVE_DB_NAME)
  })

  it("reads a badge the server hasn't confirmed at version 0, and refuses a broken row", () => {
    const row = { kind: 'badges', id: 'trainer', generation: 2, schema: 1, version: 0, savedAt: 0, data: trainerBadge() }
    expect(parseStoredEntity(row)).toEqual(row)
    expect(parseStoredEntity({ ...row, version: 3, savedAt: 9 })).toEqual({ ...row, version: 3, savedAt: 9 })
    expect(parseStoredEntity({ ...row, kind: 'items', id: 'speed-ticket', data: { count: 1 } })).toBeNull()
    expect(parseStoredEntity({ ...row, data: { scope: 'trainer' } })).toBeNull()
  })

  it("reads the confirmed rows through T134's parsers; an unreadable one throws and stays where it is", async () => {
    const server = new FakeServer()
    server.otherDevice([{ type: 'create', createdAt: 1_000 }])
    const db = freshDb()
    for (const row of server.rows.values()) await db.table(row.kind).put(row)
    const read = await readConfirmed(db, [])
    expect(read.entities.map((row) => `${row.kind}/${row.id}`)).toContain('profile/main')
    expect(read.logs.map((row) => row.data)).toEqual([expect.objectContaining({ reason: 'initial-uma-tickets' })])
    const broken = { ...(await db.profile.get('main'))!, data: { generation: 2 } }
    await db.profile.put(broken as never)
    await expect(readConfirmed(db, [])).rejects.toBeInstanceOf(UnreadableRow)
    expect(await db.profile.get('main')).toEqual(broken)
    db.close()
  })
})
