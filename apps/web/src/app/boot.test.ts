// The app's boot (T143, T152): generation 2 wiped once, then g3 opened, making only save and sync requests; requests
// carry the auth provider's token; Account's Sign in and Sign out are the provider's, absent with auth off; and a tap
// holds the update prompt's restart until it has committed.
import 'fake-indexeddb/auto'
import { appUpdateLifecycle } from '@luismlorenzana/uma-kit/places'
import Dexie from 'dexie'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { syntheticContent, umaId } from '../__fixtures__/content'
import { memoryStorage } from '../__fixtures__/testing'
import type { SaveGame } from '../save'
import { SAVE_DB_NAME, WIPED_KEY } from '../save/db'
import { bootSaveGame, forgetDeviceBoot } from './boot'

const fetch = vi.fn(async (_input: string | URL | Request, _init?: RequestInit): Promise<Response> => Promise.reject(new TypeError('no network in tests')))

beforeEach(async () => {
  vi.stubGlobal('localStorage', memoryStorage())
  vi.stubGlobal('sessionStorage', memoryStorage())
  vi.stubGlobal('fetch', fetch)
  fetch.mockClear()
  forgetDeviceBoot()
  await Dexie.delete(SAVE_DB_NAME)
})
afterEach(() => vi.unstubAllGlobals())

async function opened(save: SaveGame): Promise<void> {
  await save.session.opened
  await save.session.lane.idle()
}

describe("the app's boot", () => {
  it('wipes generation 2, opens g3, and sends the provider token with every save request', async () => {
    const old = new Dexie('uma-racer-g2')
    old.version(1).stores({ profile: 'id' })
    await old.table('profile').put({ id: 'main' })
    old.close()
    localStorage.setItem('uma-racer:g2:lastPage', 'farm')
    localStorage.setItem('uma-racer-other', '1')
    const token = vi.fn(async () => 'invented-token')
    const { game, save } = await bootSaveGame(syntheticContent(), { token, signedIn: true })
    await opened(save!)
    expect(game.getSnapshot().status).toBe('ready')
    expect(game.getSnapshot().state?.account).toMatchObject({ umaTickets: 20, cardTickets: 24 })
    expect(await Dexie.exists('uma-racer-g2')).toBe(false)
    expect(await Dexie.exists(SAVE_DB_NAME)).toBe(true)
    expect(localStorage.getItem('uma-racer:g2:lastPage')).toBeNull()
    expect(localStorage.getItem('uma-racer-other')).toBe('1')
    expect(localStorage.getItem(WIPED_KEY)).not.toBeNull()
    expect(fetch.mock.calls.length).toBeGreaterThan(0)
    for (const [input, init] of fetch.mock.calls) {
      expect(['/api/save', '/api/sync']).toContain(new URL(String(input), 'https://save.test').pathname)
      expect(new Headers(init?.headers).get('Authorization')).toBe('Bearer invented-token')
    }
    expect(token).toHaveBeenCalled()
    save!.stop()
  })

  it("offers the provider's Sign in and Sign out, and none with auth off", async () => {
    const signIn = vi.fn(async () => {})
    const signOut = vi.fn(async () => {})
    const { game, save } = await bootSaveGame(syntheticContent(), { token: async () => null, signedIn: true, signIn, signOut })
    await opened(save!)
    await game.signOut?.()
    expect(signOut).toHaveBeenCalledOnce()
    expect(game.signIn).toBe(signIn)
    save!.stop()
    forgetDeviceBoot()
    const off = await bootSaveGame(syntheticContent(), { token: async () => null, signedIn: true })
    expect(off.game.signIn).toBeUndefined()
    expect(off.game.signOut).toBeUndefined()
    await opened(off.save!)
    off.save!.stop()
  })

  it("holds the update prompt's restart while a tap commits", async () => {
    const { game, save } = await bootSaveGame(syntheticContent(), { token: async () => null, signedIn: false })
    await opened(save!)
    const seen: number[] = []
    const unsubscribe = appUpdateLifecycle.subscribe(() => seen.push(appUpdateLifecycle.getSnapshot().activeActions))
    const answer = await game.run('unlock-uma', { umaId: umaId(1) })
    unsubscribe()
    expect(answer.kind).toBe('done')
    expect(seen).toEqual([1, 0])
    expect(game.getSnapshot().state?.account.umaTickets).toBe(19)
    save!.stop()
  })
})
