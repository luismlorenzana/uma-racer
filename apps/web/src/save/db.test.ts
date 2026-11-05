// The device's database (T136, T152): `uma-racer-g3` at version 1, one table per kind, the outbox and the device-only
// stage journal, rows read back through the domain's parsers, and an unreadable row left where it is. Before it opens,
// the boot wipes generation 2 once: the `uma-racer-g2` database and every `uma-racer:g2:` key (D380, D381).
import 'fake-indexeddb/auto'
import { ENTITY_KINDS, LOG_KINDS } from '@racer/domain/save'
import Dexie from 'dexie'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { LEGACY_DB_NAME, readConfirmed, SAVE_DB_NAME, SaveDb, UnreadableRow, WIPED_KEY, wipeGeneration2 } from './db'
import { useSave } from './store'
import { device, FakeServer, freshDb, memoryStorage, settle, useClock } from './__fixtures__/server'

describe('uma-racer-g3', () => {
  it('opens at version 1 with one table per kind, the outbox and the stage journal, and nothing else', async () => {
    const db = new SaveDb()
    await db.open()
    expect(db.name).toBe(SAVE_DB_NAME)
    expect(SAVE_DB_NAME).toBe('uma-racer-g3')
    expect(db.verno).toBe(1)
    const tables = [...ENTITY_KINDS, ...LOG_KINDS, 'outbox', 'stageJournal'].sort()
    expect(db.tables.map((table) => table.name).sort()).toEqual(tables)
    expect([...ENTITY_KINDS].sort()).toEqual(['account', 'bonds', 'cards', 'careers', 'umas'])
    expect([...LOG_KINDS].sort()).toEqual(['operations', 'raceResults'])
    const indexes = (name: string) => db.table(name).schema.indexes.map((index) => index.name).sort()
    for (const kind of [...ENTITY_KINDS, 'stageJournal']) expect([db.table(kind).schema.primKey.keyPath, indexes(kind)]).toEqual(['id', []])
    expect(indexes('raceResults')).toEqual(['at', 'data.careerId', 'data.umaId'])
    expect(indexes('operations')).toEqual(['at'])
    expect(db.outbox.schema.primKey).toMatchObject({ keyPath: 'seq', auto: true })
    expect(db.outbox.schema.indexes).toEqual([expect.objectContaining({ name: 'key', unique: true })])
    await db.stageJournal.put({ id: 'stage-1', moves: [1, 2] })
    expect(await db.stageJournal.get('stage-1')).toEqual({ id: 'stage-1', moves: [1, 2] })
    db.close()
    // IndexedDB itself holds the same stores: Dexie's version 1 is IndexedDB's 10.
    const raw = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(SAVE_DB_NAME)
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
    expect(raw.version).toBe(10)
    expect([...raw.objectStoreNames].sort()).toEqual(tables)
    raw.close()
    await Dexie.delete(SAVE_DB_NAME)
  })

  it("reads the confirmed rows through the domain's parsers; an unreadable one throws and stays where it is", async () => {
    const server = new FakeServer()
    server.otherDevice([{ type: 'create', createdAt: 1_000 }])
    const db = freshDb()
    for (const row of server.rows.values()) await db.table(row.kind).put(row)
    const read = await readConfirmed(db, [])
    expect(read.entities.map((row) => `${row.kind}/${row.id}`)).toEqual(['account/main'])
    expect(read.logs).toEqual([])
    const broken = { ...(await db.account.get('main'))!, data: { createdAt: 1_000, umaTickets: -1, cardTickets: 24 } }
    await db.account.put(broken as never)
    await expect(readConfirmed(db, [])).rejects.toBeInstanceOf(UnreadableRow)
    expect(await db.account.get('main')).toEqual(broken)
    db.close()
  })
})

/** Generation 2 as a phone held it: its database with a row, and its device keys beside other sites' and g3's. */
async function generation2(storage: Storage): Promise<void> {
  const old = new Dexie(LEGACY_DB_NAME)
  old.version(1).stores({ profile: 'id', outbox: '++seq, &key' })
  await old.table('profile').put({ id: 'main', data: { umaTickets: 7 } })
  old.close()
  storage.setItem('uma-racer:g2:pull', '{"serverTime":5}')
  storage.setItem('uma-racer:g2:appearance', 'dark')
  storage.setItem('uma-racer:g2:album:stable', '{}')
  storage.setItem('uma-racer:g3:appearance', 'light')
  storage.setItem('another-app:key', 'kept')
}

describe('the wipe of generation 2', () => {
  afterEach(() => Dexie.delete(LEGACY_DB_NAME))

  it("deletes the g2 database and every uma-racer:g2: key, once, and records it under a g3 key", async () => {
    const storage = memoryStorage()
    await generation2(storage)
    expect(await Dexie.exists(LEGACY_DB_NAME)).toBe(true)
    expect(await wipeGeneration2(storage, { now: () => 42 })).toBe(true)
    expect(await Dexie.exists(LEGACY_DB_NAME)).toBe(false)
    const keys = Array.from({ length: storage.length }, (_, i) => storage.key(i)!).sort()
    expect(keys).toEqual(['another-app:key', 'uma-racer:g3:appearance', WIPED_KEY].sort())
    expect(WIPED_KEY.startsWith('uma-racer:g3:')).toBe(true)
    expect(storage.getItem(WIPED_KEY)).toBe('42')
    // Once: a g2 database that turns up later is left alone.
    await generation2(storage)
    expect(await wipeGeneration2(storage)).toBe(false)
    expect(await Dexie.exists(LEGACY_DB_NAME)).toBe(true)
    expect(storage.getItem('uma-racer:g2:pull')).not.toBeNull()
  })

  it('runs again on the next boot when the database could not be deleted', async () => {
    const storage = memoryStorage()
    await generation2(storage)
    const failing = vi.fn(async () => { throw new Error('blocked') })
    await expect(wipeGeneration2(storage, { deleteDatabase: failing })).rejects.toThrow('blocked')
    expect(storage.getItem(WIPED_KEY)).toBeNull()
    expect(await wipeGeneration2(storage)).toBe(true)
    expect(await Dexie.exists(LEGACY_DB_NAME)).toBe(false)
  })

  describe('on boot', () => {
    beforeEach(() => useClock())
    afterEach(() => vi.useRealTimers())

    it('wipes before g3 opens, then opens a new account on g3', async () => {
      const storage = memoryStorage()
      await generation2(storage)
      const order: string[] = []
      const db = freshDb()
      const open = db.open.bind(db)
      db.open = (() => { order.push('open g3'); return open() }) as typeof db.open
      const phone = device(new FakeServer(), {
        db, storage,
        wipe: { deleteDatabase: async (name) => { order.push(`delete ${name}`); await Dexie.delete(name) } },
      })
      await settle(phone)
      expect(order).toEqual(['delete uma-racer-g2', 'open g3'])
      expect(await Dexie.exists(LEGACY_DB_NAME)).toBe(false)
      expect(storage.getItem('uma-racer:g2:appearance')).toBeNull()
      expect(storage.getItem(WIPED_KEY)).toBe(String(Date.now()))
      expect(useSave.getState()).toMatchObject({ lifecycle: 'ready', state: { account: { umaTickets: 20, cardTickets: 24 } } })
      phone.session.stop()
    })

    it('still opens g3 when the wipe fails, and tries again next time', async () => {
      const storage = memoryStorage()
      const error = vi.spyOn(console, 'error').mockImplementation(() => {})
      const phone = device(new FakeServer(), { storage, wipe: { deleteDatabase: async () => { throw new Error('blocked') } } })
      await settle(phone)
      expect(useSave.getState().lifecycle).toBe('ready')
      expect(storage.getItem(WIPED_KEY)).toBeNull()
      expect(error).toHaveBeenCalled()
      error.mockRestore()
      phone.session.stop()
    })
  })
})
