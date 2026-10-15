// The seeds' boot (T137, T136): seeds by default, the device save only when asked (`?save=device`, kept for the tab
// until a `?seed=`), and the first-boot wipe and the purge only with `&wipe`, so opening `/dev/seeds/` never touches a
// developer's own data.
import 'fake-indexeddb/auto'
import Dexie from 'dexie'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { SaveGame } from '../save'
import { memoryStorage } from '../save/server.test-support'
import { forgetDeviceBoot } from '../app/boot'
import { bootGame } from './boot'

const fetch = vi.fn(async (_input: string | URL | Request): Promise<Response> => Promise.reject(new TypeError('no network in tests')))

beforeEach(() => {
  vi.stubGlobal('localStorage', memoryStorage())
  vi.stubGlobal('sessionStorage', memoryStorage())
  vi.stubGlobal('fetch', fetch)
  fetch.mockClear()
  forgetDeviceBoot()
})
afterEach(() => vi.unstubAllGlobals())

async function oldDatabase(): Promise<void> {
  const db = new Dexie('uma-racer')
  db.version(1).stores({ profile: 'id' })
  await db.table('profile').put({ id: 'main' })
  db.close()
}

async function opened(game: SaveGame): Promise<void> {
  await game.session.opened
  await game.session.lane.idle()
}

describe("the seeds' mount", () => {
  it("boots the seeds by default, and loads nothing of the device save", async () => {
    const { game, save } = await bootGame('?seed=fresh')
    expect(save).toBeUndefined()
    expect('session' in game).toBe(false)
    expect(game.getSnapshot()).toMatchObject({ status: 'ready', sync: 'synced' })
  })

  it('boots the device save when asked, keeps it for the tab, and never wipes or purges unasked', async () => {
    await oldDatabase()
    localStorage.setItem('uma-racer:last-sync', '1')
    const { game, save } = await bootGame('?save=device')
    const device = save!
    await opened(device)
    expect(device.getSnapshot().status).toBe('ready')
    expect(await Dexie.exists('uma-racer')).toBe(true)
    expect(localStorage.getItem('uma-racer:last-sync')).toBe('1')
    expect(fetch.mock.calls.map(([input]) => String(input)).some((url) => url.includes('purge'))).toBe(false)
    // One device save a page: a second boot (StrictMode's second effect) gets the same port, and so does a reload's.
    const again = await bootGame('')
    expect(again.game).toBe(game)
    device.stop()
    expect('session' in (await bootGame('?seed=fresh')).game).toBe(false)
    expect('session' in (await bootGame('')).game).toBe(false)
  })

  it('wipes and purges with `&wipe`', async () => {
    await oldDatabase()
    localStorage.setItem('uma-racer:last-sync', '1')
    const device = (await bootGame('?save=device&wipe')).save!
    await opened(device)
    expect(await Dexie.exists('uma-racer')).toBe(false)
    expect(localStorage.getItem('uma-racer:last-sync')).toBeNull()
    expect(localStorage.getItem('uma-racer:g2:wiped')).not.toBeNull()
    expect(fetch.mock.calls.map(([input]) => String(input)).some((url) => url.endsWith('/api/legacy/purge'))).toBe(true)
    device.stop()
  })
})
