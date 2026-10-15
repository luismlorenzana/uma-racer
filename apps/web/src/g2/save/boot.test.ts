// The save's boot (T136; docs/rearchitecture/01-target-architecture.md §4.3; 07 §2–§3): local first, an empty device
// pulls or creates, the wipe runs before anything else, and the purge runs once in the background.
import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PURGED_KEY } from './boot'
import { CREATE_KEY } from './db'
import { useSave } from './store'
import {
  device, FakeServer, flairEvent, freshDb, memoryStorage, nextId, settle, turn, umaId, useClock, type Device,
} from './server.test-support'
import type { WipeDeps } from './wipe'

beforeEach(() => useClock())
afterEach(() => vi.useRealTimers())

const tickets = () => useSave.getState().state?.profile.umaTickets
const umas = () => Object.keys(useSave.getState().state?.umas ?? {})

/** A server that already holds this account's save: created, with Uma 1 unlocked, on another device. */
function serverWithSave(): FakeServer {
  const server = new FakeServer()
  server.otherDevice([
    { type: 'create', createdAt: Date.now() },
    { type: 'operation', operation: { id: nextId(), name: 'unlock-uma', input: { outfitId: umaId(1) }, at: Date.now() } },
  ])
  return server
}

/** The moment the store first opened, as the number of requests the server had seen by then. */
function requestsWhenReady(server: FakeServer): { readonly value: number | null } {
  const seen: { value: number | null } = { value: null }
  const stop = useSave.subscribe((store) => {
    if (store.lifecycle === 'ready' && seen.value === null) {
      seen.value = server.requests.length
      stop()
    }
  })
  return seen
}

/** Every purge request the device made, answered or not. */
const purgeCalls = (server: FakeServer): number => server.fetch.mock.calls.filter(([input]) => String(input).endsWith('/api/legacy/purge')).length

async function stop(...devices: Device[]): Promise<void> {
  for (const each of devices) {
    await settle(each)
    each.session.stop()
  }
}

describe('local-first boot', () => {
  it('opens a device that holds a save before any network call, then flushes and pulls', async () => {
    const server = new FakeServer()
    const first = device(server)
    await stop(first)
    const before = server.requests.length
    const seen = requestsWhenReady(server)
    const again = device(server, { db: first.db, storage: first.storage })
    await again.session.opened
    expect(seen.value).toBe(before)
    expect(tickets()).toBe(20)
    await settle(again)
    expect(server.requests.length).toBeGreaterThan(before)
    again.session.stop()
  })

  it('pulls the server save into an empty device and opens on it, with nothing to create', async () => {
    const server = serverWithSave()
    const phone = device(server)
    await settle(phone)
    expect(useSave.getState().lifecycle).toBe('ready')
    expect([tickets(), umas()]).toEqual([19, [umaId(1)]])
    expect(await phone.db.outbox.count()).toBe(0)
    expect(server.syncs()).toEqual([])
    phone.session.stop()
  })

  it('an empty device on an empty server queues the create with 20 Uma Tickets, and the server takes it', async () => {
    const server = new FakeServer()
    const seen = requestsWhenReady(server)
    const phone = device(server)
    await phone.session.opened
    expect(seen.value).toBe(1)
    expect((await phone.db.outbox.toArray()).map((row) => row.key)).toEqual([CREATE_KEY])
    expect([tickets(), umas()]).toEqual([20, []])
    await settle(phone)
    expect(server.syncs()[0]?.changes).toEqual([{ type: 'create', createdAt: Date.now() }])
    expect(server.row<{ data: { umaTickets: number } }>('profile/main')?.data.umaTickets).toBe(20)
    expect(await phone.db.outbox.count()).toBe(0)
    expect(await phone.db.profile.count()).toBe(1)
    phone.session.stop()
  })

  it("an empty device offline creates its save too, and adopts the server's on `exists`", async () => {
    const server = serverWithSave()
    server.failAlways('offline')
    const phone = device(server)
    await settle(phone)
    expect(useSave.getState().lifecycle).toBe('ready')
    expect([tickets(), umas(), useSave.getState().sync.status]).toEqual([20, [], 'offline'])
    await phone.session.actions.run('set-repeat-sizing', { sizing: 'fit' })
    server.failAlways(null)
    phone.net.online()
    await settle(phone)
    expect(server.syncs().at(-1)?.changes.map((change) => change.type)).toEqual(['create', 'operation'])
    // The server's save, and the tap made offline, run on it.
    expect([tickets(), umas(), useSave.getState().state?.profile.repeatSizing]).toEqual([19, [umaId(1)], 'fit'])
    expect(await phone.db.outbox.count()).toBe(0)
    expect(server.requests.filter((r) => r.path === '/api/save').at(-1)?.query.since).toBe('0')
    phone.session.stop()
  })

  it('opens an empty device once the rule kinds are in, and loads the history behind it', async () => {
    const server = serverWithSave()
    for (let n = 1; n <= 6; n += 1) {
      const event = flairEvent(n, Date.now())
      server.otherDevice([{ type: 'append', kind: 'flairEvents', id: `flair:trainer:stable:achievement-${n}:one-off`, at: event.earnedAt, data: event }])
    }
    server.pageRows = 4
    const seen = requestsWhenReady(server)
    const phone = device(server)
    await settle(phone)
    const pulls = server.count('/api/save')
    expect(seen.value).not.toBeNull()
    expect(seen.value!).toBeLessThan(pulls)
    expect(await phone.db.flairEvents.count()).toBe(6)
    expect([tickets(), umas()]).toEqual([19, [umaId(1)]])
    phone.session.stop()
  })

  it('opens signed out with a save of its own, and syncs once signed in', async () => {
    const server = new FakeServer()
    const phone = device(server, { signedIn: false })
    await settle(phone)
    expect([useSave.getState().lifecycle, tickets(), server.requests.length]).toEqual(['ready', 20, 0])
    phone.session.setSignedIn(true)
    await settle(phone)
    expect(server.row('profile/main')).toBeDefined()
    phone.session.stop()
  })

  it("stays shut on a row it can't read, and deletes nothing", async () => {
    const server = new FakeServer()
    const first = device(server)
    await stop(first)
    await first.db.open()
    const profile = (await first.db.profile.get('main'))!
    await first.db.profile.put({ ...profile, data: { ...profile.data, umaTickets: -1 } })
    const again = device(server, { db: first.db, storage: first.storage })
    await settle(again)
    expect(useSave.getState()).toMatchObject({ lifecycle: 'error', words: "That didn't work. Try again." })
    expect((await first.db.profile.get('main'))?.data.umaTickets).toBe(-1)
    again.session.stop()
  })
})

describe('the wipe and the purge', () => {
  function recordingWipe(log: string[]): WipeDeps {
    return {
      storage: memoryStorage(),
      deleteDatabase: async (name) => void log.push(`delete ${name}`),
      databaseNames: async () => ['farm-kitchen-proof-1', 'uma-racer-g2'],
      caches: { delete: async (name) => (log.push(`cache ${name}`), true) },
      dev: true,
      now: () => 0,
    }
  }

  it("wipes first, then calls the purge, then reads the save: the purge's request goes out first", async () => {
    const server = new FakeServer()
    const log: string[] = []
    const answer = server.fetch.getMockImplementation()!
    server.fetch.mockImplementation(async (input, init) => {
      log.push(new URL(String(input), 'http://save.test').pathname)
      return answer(input, init)
    })
    const phone = device(server, { wipe: true, purge: true, wipeDeps: recordingWipe(log) })
    await settle(phone)
    expect(log.slice(0, 6)).toEqual([
      'delete uma-racer', 'delete farm-kitchen-proof-1', 'cache racer-content', '/api/legacy/purge', '/api/save', '/api/sync',
    ])
    phone.session.stop()
  })

  it('calls the purge once: its marker stops later calls', async () => {
    const server = new FakeServer()
    const phone = device(server, { purge: true })
    await stop(phone)
    expect(server.count('/api/legacy/purge')).toBe(1)
    expect(JSON.parse(phone.storage.getItem(PURGED_KEY)!)).toEqual({ status: 'purged', at: Date.now() })
    const again = device(server, { purge: true, db: phone.db, storage: phone.storage })
    await stop(again)
    expect(server.count('/api/legacy/purge')).toBe(1)
  })

  it('never blocks the boot: a failed purge is tried again back online, and at the next boot', async () => {
    const server = new FakeServer()
    let release = () => {}
    const held = new Promise<void>((resolve) => (release = resolve))
    server.fetch.mockImplementationOnce(async () => {
      await held
      return new Response('{}', { status: 503 })
    })
    const phone = device(server, { purge: true })
    await settle(phone)
    expect(useSave.getState().lifecycle).toBe('ready')
    release()
    await turn()
    expect(phone.storage.getItem(PURGED_KEY)).toBeNull()
    phone.net.online()
    await settle(phone)
    expect(purgeCalls(server)).toBe(2)
    expect(phone.storage.getItem(PURGED_KEY)).not.toBeNull()
    phone.session.stop()

    const failing = new FakeServer()
    failing.fetch.mockImplementationOnce(async () => Promise.reject(new TypeError('offline')))
    const next = device(failing, { purge: true, db: freshDb() })
    await stop(next)
    expect(next.storage.getItem(PURGED_KEY)).toBeNull()
    const reboot = device(failing, { purge: true, db: next.db, storage: next.storage })
    await stop(reboot)
    expect(purgeCalls(failing)).toBe(2)
    expect(reboot.storage.getItem(PURGED_KEY)).not.toBeNull()
  })

  it('waits to be signed in', async () => {
    const server = new FakeServer()
    const phone = device(server, { purge: true, signedIn: false })
    await settle(phone)
    expect(server.count('/api/legacy/purge')).toBe(0)
    phone.session.setSignedIn(true)
    await settle(phone)
    expect(server.count('/api/legacy/purge')).toBe(1)
    phone.session.stop()
  })
})

