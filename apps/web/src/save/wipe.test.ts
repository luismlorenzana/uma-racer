// The first-boot wipe (T136; docs/rearchitecture/07-data-reset.md §2, §4): today's database, the dev proofs, every
// `uma-racer:` key but generation 2's, and the content cache, once, in that order; never generation 2's own data.
import 'fake-indexeddb/auto'
import Dexie from 'dexie'
import { describe, expect, it, vi } from 'vitest'
import { SAVE_DB_NAME, SaveDb } from './db'
import { memoryStorage } from './__fixtures__/server'
import { OLD_CONTENT_CACHE, OLD_DATABASE, WIPED_KEY, wipeOnce, type WipeDeps } from './wipe'

async function makeDatabase(name: string): Promise<void> {
  const db = new Dexie(name)
  db.version(1).stores({ rows: 'id' })
  await db.table('rows').put({ id: 'main', data: 'old' })
  db.close()
}

function deviceWith(dev = true) {
  const storage = memoryStorage()
  for (const key of ['uma-racer:last-sync', 'uma-racer:scenario-choice', 'uma-racer:farm-kitchen-guide-v1', 'uma-racer:g2:lastPage', 'firebase:authUser', 'theme']) {
    storage.setItem(key, 'x')
  }
  const steps: string[] = []
  const caches = { delete: vi.fn(async (name: string) => (steps.push(`cache ${name}`), true)) }
  const deps: WipeDeps = {
    storage,
    deleteDatabase: async (name) => {
      steps.push(`database ${name}`)
      await Dexie.delete(name)
    },
    databaseNames: () => Dexie.getDatabaseNames(),
    caches,
    dev,
    now: () => 42,
  }
  const removeItem = storage.removeItem.bind(storage)
  storage.removeItem = (key) => {
    steps.push(`key ${key}`)
    removeItem(key)
  }
  return { storage, steps, caches, deps }
}

describe('the first-boot wipe', () => {
  it("deletes today's database, the dev proofs, the old keys and the content cache, in order, then sets its marker", async () => {
    for (const name of [OLD_DATABASE, 'farm-kitchen-proof-1', 'farm-kitchen-proof-release-2', 'another-app']) await makeDatabase(name)
    const g2 = new SaveDb()
    await g2.profile.count()
    g2.close()
    const { storage, steps, caches, deps } = deviceWith()
    expect(await wipeOnce(deps)).toBe('wiped')
    expect((await Dexie.getDatabaseNames()).sort()).toEqual(['another-app', SAVE_DB_NAME])
    expect(steps).toEqual([
      `database ${OLD_DATABASE}`, 'database farm-kitchen-proof-1', 'database farm-kitchen-proof-release-2',
      'key uma-racer:last-sync', 'key uma-racer:scenario-choice', 'key uma-racer:farm-kitchen-guide-v1', `cache ${OLD_CONTENT_CACHE}`,
    ])
    expect(caches.delete).toHaveBeenCalledExactlyOnceWith('racer-content')
    expect(storage.getItem('uma-racer:g2:lastPage')).toBe('x')
    expect(storage.getItem('firebase:authUser')).toBe('x')
    expect(storage.getItem('theme')).toBe('x')
    expect(storage.getItem(WIPED_KEY)).toBe('42')
    await Dexie.delete(SAVE_DB_NAME)
    await Dexie.delete('another-app')
  })

  it("runs once: a second boot finds the marker and touches nothing", async () => {
    const { deps, steps } = deviceWith()
    expect(await wipeOnce(deps)).toBe('wiped')
    await makeDatabase(OLD_DATABASE)
    steps.length = 0
    expect(await wipeOnce(deps)).toBe('already')
    expect(steps).toEqual([])
    expect(await Dexie.exists(OLD_DATABASE)).toBe(true)
    await Dexie.delete(OLD_DATABASE)
  })

  it('leaves the proofs alone outside dev builds, and tolerates every absence', async () => {
    await makeDatabase('farm-kitchen-proof-release-2')
    const { deps } = deviceWith(false)
    expect(await wipeOnce({ ...deps, caches: null })).toBe('wiped')
    expect(await Dexie.exists('farm-kitchen-proof-release-2')).toBe(true)
    await Dexie.delete('farm-kitchen-proof-release-2')
  })

  it('leaves its marker unset when a step fails, so the next boot tries again', async () => {
    const { deps, storage } = deviceWith()
    const failing: WipeDeps = { ...deps, caches: { delete: async () => Promise.reject(new Error('busy')) } }
    expect(await wipeOnce(failing)).toBe('incomplete')
    expect(storage.getItem(WIPED_KEY)).toBeNull()
    expect(storage.getItem('uma-racer:last-sync')).toBeNull()
    expect(await wipeOnce(deps)).toBe('wiped')
  })
})
