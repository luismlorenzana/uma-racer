// The app's boot (T143): the device save on the content, with the first-boot wipe and the purge call; its requests carry
// the auth provider's token; Account's Sign in and Sign out are the provider's, absent with auth off; and a tap holds the
// update prompt's restart until it has committed.
import 'fake-indexeddb/auto'
import { SIM_CARDS, SIM_RACES, SIM_UMAS } from '@racer/domain/sim'
import Dexie from 'dexie'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { SaveGame } from '../save'
import type { OperationContent } from '../save/env'
import { memoryStorage } from '../save/__fixtures__/server'
import { appUpdateLifecycle } from '@luismlorenzana/uma-kit/places'
import { bootSaveGame, forgetDeviceBoot } from './boot'

const fetch = vi.fn(async (_input: string | URL | Request, _init?: RequestInit): Promise<Response> => Promise.reject(new TypeError('no network in tests')))

const registry = <T extends { readonly id: string }>(items: readonly T[]) => ({ items, byId: new Map(items.map((item) => [item.id, item])) })
const CONTENT: OperationContent = {
  manifest: { version: 'invented0001' } as OperationContent['manifest'],
  umas: registry(SIM_UMAS),
  races: registry(SIM_RACES),
  cards: registry(SIM_CARDS),
  skills: registry([]),
}

beforeEach(() => {
  vi.stubGlobal('localStorage', memoryStorage())
  vi.stubGlobal('sessionStorage', memoryStorage())
  vi.stubGlobal('fetch', fetch)
  fetch.mockClear()
  forgetDeviceBoot()
})
afterEach(() => vi.unstubAllGlobals())

async function opened(save: SaveGame): Promise<void> {
  await save.session.opened
  await save.session.lane.idle()
}

describe("the app's boot", () => {
  it('wipes the old save once, purges, and sends the provider token with every request', async () => {
    const old = new Dexie('uma-racer')
    old.version(1).stores({ profile: 'id' })
    await old.table('profile').put({ id: 'main' })
    old.close()
    localStorage.setItem('uma-racer:last-sync', '1')
    const token = vi.fn(async () => 'invented-token')
    const { game, save } = await bootSaveGame(CONTENT, { token, signedIn: true })
    await opened(save!)
    expect(game.getSnapshot().status).toBe('ready')
    expect(game.getSnapshot().state?.profile.umaTickets).toBe(20)
    expect(await Dexie.exists('uma-racer')).toBe(false)
    expect(localStorage.getItem('uma-racer:last-sync')).toBeNull()
    const purge = fetch.mock.calls.find(([input]) => String(input).endsWith('/api/legacy/purge'))
    expect(purge).toBeDefined()
    expect(new Headers(purge![1]?.headers).get('Authorization')).toBe('Bearer invented-token')
    expect(token).toHaveBeenCalled()
    save!.stop()
  })

  it("offers the provider's Sign in and Sign out, and none with auth off", async () => {
    const signIn = vi.fn(async () => {})
    const signOut = vi.fn(async () => {})
    const { game, save } = await bootSaveGame(CONTENT, { token: async () => null, signedIn: true, signIn, signOut })
    await opened(save!)
    await game.signOut?.()
    expect(signOut).toHaveBeenCalledOnce()
    expect(game.signIn).toBe(signIn)
    save!.stop()
    forgetDeviceBoot()
    const off = await bootSaveGame(CONTENT, { token: async () => null, signedIn: true })
    expect(off.game.signIn).toBeUndefined()
    expect(off.game.signOut).toBeUndefined()
    off.save!.stop()
  })

  it("holds the update prompt's restart while a tap commits", async () => {
    const { game, save } = await bootSaveGame(CONTENT, { token: async () => null, signedIn: false })
    await opened(save!)
    const seen: number[] = []
    const unsubscribe = appUpdateLifecycle.subscribe(() => seen.push(appUpdateLifecycle.getSnapshot().activeActions))
    const answer = await game.run('unlock-uma', { outfitId: SIM_UMAS[0]!.id })
    unsubscribe()
    expect(answer.kind).toBe('done')
    expect(seen).toEqual([1, 0])
    expect(game.getSnapshot().state?.profile.umaTickets).toBe(19)
    save!.stop()
  })
})
