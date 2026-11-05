// The save's boot (T136, T152): local first, an empty device pulls or creates; the only requests are the save's own.
import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CREATE_KEY } from './db'
import { useSave } from './store'
import { cardId, device, FakeServer, nextId, settle, umaId, useClock, type Device } from './__fixtures__/server'

beforeEach(() => useClock())
afterEach(() => vi.useRealTimers())

const tickets = () => useSave.getState().state?.account.umaTickets
const umas = () => Object.keys(useSave.getState().state?.umas ?? {})

/** A server that already holds this account's save: created, with Uma 1 unlocked, on another device. */
function serverWithSave(): FakeServer {
  const server = new FakeServer()
  server.otherDevice([
    { type: 'create', createdAt: Date.now() },
    { type: 'operation', operation: { id: nextId(), name: 'unlock-uma', input: { umaId: umaId(1) }, at: Date.now() } },
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

async function stop(...devices: Device[]): Promise<void> {
  for (const each of devices) {
    await settle(each)
    each.session.stop()
  }
}

describe('local-first boot', () => {
  it('only requests save and sync, on boot, reconnect and sign-in', async () => {
    const server = serverWithSave()
    const phone = device(server)
    await settle(phone)
    expect([tickets(), umas()]).toEqual([19, [umaId(1)]])
    phone.net.online()
    await settle(phone)
    phone.session.setSignedIn(false)
    phone.session.setSignedIn(true)
    await settle(phone)
    expect(server.requests.length).toBeGreaterThan(0)
    expect(server.requests.every(({ path }) => path === '/api/save' || path === '/api/sync')).toBe(true)
    await stop(phone)
    const again = device(server, { db: phone.db, storage: phone.storage })
    await settle(again)
    expect([tickets(), umas()]).toEqual([19, [umaId(1)]])
    again.session.stop()
  })

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

  it('an empty device on an empty server queues the create with 20 Uma Tickets and 24 Card Tickets, and the server takes it', async () => {
    const server = new FakeServer()
    const seen = requestsWhenReady(server)
    const phone = device(server)
    await phone.session.opened
    expect(seen.value).toBe(1)
    expect((await phone.db.outbox.toArray()).map((row) => row.key)).toEqual([CREATE_KEY])
    expect(useSave.getState().state?.account).toEqual({ createdAt: Date.now(), umaTickets: 20, cardTickets: 24 })
    await settle(phone)
    expect(server.syncs()[0]).toEqual({ protocol: 3, generation: 3, changes: [{ type: 'create', createdAt: Date.now() }] })
    expect(server.row<{ data: { umaTickets: number } }>('account/main')?.data.umaTickets).toBe(20)
    expect(await phone.db.outbox.count()).toBe(0)
    expect(await phone.db.account.count()).toBe(1)
    phone.session.stop()
  })

  it("an empty device offline creates its save too, and adopts the server's on `exists`", async () => {
    const server = serverWithSave()
    server.failAlways('offline')
    const phone = device(server)
    await settle(phone)
    expect(useSave.getState().lifecycle).toBe('ready')
    expect([tickets(), umas(), useSave.getState().sync.status]).toEqual([20, [], 'offline'])
    await phone.session.actions.run('unlock-card', { cardId: cardId(1) })
    server.failAlways(null)
    phone.net.online()
    await settle(phone)
    expect(server.syncs().at(-1)?.changes.map((change) => change.type)).toEqual(['create', 'operation'])
    // The server's save, and the tap made offline, run on it.
    expect([tickets(), umas(), Object.keys(useSave.getState().state!.cards)]).toEqual([19, [umaId(1)], [cardId(1)]])
    expect(await phone.db.outbox.count()).toBe(0)
    expect(server.requests.filter((r) => r.path === '/api/save').at(-1)?.query.since).toBe('0')
    phone.session.stop()
  })

  it('opens an empty device once the rule kinds are in, and loads the history behind it', async () => {
    const server = serverWithSave()
    server.pageRows = 1
    const seen = requestsWhenReady(server)
    const phone = device(server)
    await settle(phone)
    expect(seen.value).not.toBeNull()
    expect([tickets(), umas()]).toEqual([19, [umaId(1)]])
    expect(await phone.db.operations.count()).toBe(1)
    phone.session.stop()
  })

  it('opens signed out with a save of its own, and syncs once signed in', async () => {
    const server = new FakeServer()
    const phone = device(server, { signedIn: false })
    await settle(phone)
    expect([useSave.getState().lifecycle, tickets(), server.requests.length]).toEqual(['ready', 20, 0])
    phone.session.setSignedIn(true)
    await settle(phone)
    expect(server.row('account/main')).toBeDefined()
    phone.session.stop()
  })

  it("stays shut on a row it can't read, and deletes nothing", async () => {
    const server = new FakeServer()
    const first = device(server)
    await stop(first)
    await first.db.open()
    const account = (await first.db.account.get('main'))!
    await first.db.account.put({ ...account, data: { ...account.data, umaTickets: -1 } })
    const again = device(server, { db: first.db, storage: first.storage })
    await settle(again)
    expect(useSave.getState()).toMatchObject({ lifecycle: 'error', words: "That didn't work. Try again." })
    expect((await first.db.account.get('main'))?.data.umaTickets).toBe(-1)
    again.session.stop()
  })
})
