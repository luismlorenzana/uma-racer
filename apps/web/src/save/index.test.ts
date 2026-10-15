// The save behind the shell's port (T136; T137's `G2Game`): the store maps one to one onto the snapshot, the Sync chip
// reads the lane's state (paused, offline, failing, waiting after a day, synced), and the chip turns amber on its own.
import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createSaveApi } from './api'
import { chipOf, createSaveGame, WAITING_MS, type SaveGame } from './index'
import { useSave, type SaveStore } from './store'
import {
  ENV, FakeServer, fakeSignals, freshDb, memoryStorage, nextId, noWipe, trainerBadge, turn, umaId, useClock,
} from './__fixtures__/server'

beforeEach(() => useClock())
afterEach(() => vi.useRealTimers())

function saveGame(server: FakeServer, net = fakeSignals()): SaveGame {
  return createSaveGame({
    env: ENV, wipe: false, purge: false, wipeDeps: noWipe, newId: nextId, db: freshDb(), storage: memoryStorage(), signals: net.signals,
    api: createSaveApi({ fetch: server.fetch as unknown as typeof fetch, base: '', token: async () => 't' }),
  })
}

async function settled(game: SaveGame): Promise<void> {
  await game.session.opened
  for (let i = 0; i < 6; i += 1) {
    await game.session.lane.idle()
    await turn()
  }
}

describe('the port', () => {
  it('opens booting, then maps the store one to one', async () => {
    const server = new FakeServer()
    const game = saveGame(server)
    expect(game.getSnapshot()).toMatchObject({ status: 'booting', state: null, env: null })
    const seen = vi.fn()
    game.subscribe(seen)
    await settled(game)
    expect(seen).toHaveBeenCalled()
    expect(game.getSnapshot()).toMatchObject({ status: 'ready', env: ENV, trainerName: 'Trainer', sync: 'synced', receipts: {}, notices: [] })
    expect(game.getSnapshot().state?.profile.umaTickets).toBe(20)
    const answer = await game.run('unlock-uma', { outfitId: umaId(1) })
    expect(answer.kind).toBe('done')
    expect(game.getSnapshot().receipts[answer.id]).toEqual({ local: answer.kind === 'done' ? answer.receipt : null })
    await game.session.actions.writeBadge('trainer', trainerBadge('Hana'))
    expect(game.getSnapshot().trainerName).toBe('Hana')
    // The snapshot is stable between publishes, and through a change the port doesn't show.
    const shown = game.getSnapshot()
    expect(game.getSnapshot()).toBe(shown)
    seen.mockClear()
    useSave.setState((store) => ({ sync: { ...store.sync, status: 'syncing', lastSuccessAt: 1 } }))
    expect(game.getSnapshot()).toBe(shown)
    expect(seen).not.toHaveBeenCalled()
    expect(game.utcOffsetMin(Date.now())).toBe(-new Date(Date.now()).getTimezoneOffset())
    game.stop()
  })

  it("says why it can't open, in plain words", async () => {
    const server = new FakeServer()
    const game = saveGame(server)
    await settled(game)
    useSave.setState({ lifecycle: 'error', words: "That didn't work. Try again." })
    expect(game.getSnapshot()).toMatchObject({ status: 'error', state: null, env: null, words: "That didn't work. Try again." })
    game.stop()
  })

  it('reads the chip from the lane: paused, offline, failing, waiting after a day, else synced', () => {
    const now = Date.now()
    const store = (sync: Partial<SaveStore['sync']>, signedIn = true): SaveStore =>
      ({ ...useSave.getState(), signedIn, sync: { ...useSave.getState().sync, ...sync } })
    expect(chipOf(store({ status: 'idle' }, false), now)).toBe('paused')
    expect(chipOf(store({ status: 'offline' }), now)).toBe('offline')
    expect(chipOf(store({ status: 'error' }), now)).toBe('failing')
    expect(chipOf(store({ status: 'pending', oldestQueuedAt: now - WAITING_MS }), now)).toBe('synced')
    expect(chipOf(store({ status: 'pending', oldestQueuedAt: now - WAITING_MS - 1 }), now)).toBe('waiting')
    expect(chipOf(store({ status: 'syncing', oldestQueuedAt: now }), now)).toBe('synced')
    expect(chipOf(store({ status: 'idle' }), now)).toBe('synced')
  })

  it('turns the chip amber on its own once a change has waited a day', async () => {
    const server = new FakeServer()
    const net = fakeSignals()
    const game = saveGame(server, net)
    await settled(game)
    net.offline()
    await game.run('unlock-uma', { outfitId: umaId(1) })
    const seen = vi.fn()
    game.subscribe(seen)
    await vi.advanceTimersByTimeAsync(WAITING_MS - 60_000)
    // The debounce found no network: the chip says so.
    expect(game.getSnapshot().sync).toBe('offline')
    useSave.setState((store) => ({ sync: { ...store.sync, status: 'pending' } }))
    expect(game.getSnapshot().sync).toBe('synced')
    seen.mockClear()
    await vi.advanceTimersByTimeAsync(60_001)
    expect(seen).toHaveBeenCalled()
    expect(game.getSnapshot().sync).toBe('waiting')
    game.stop()
  })

  it('syncs now on asking, and reads the logs the snapshot never holds', async () => {
    const server = new FakeServer()
    const game = saveGame(server)
    await settled(game)
    const answer = await game.run('unlock-uma', { outfitId: umaId(1) })
    const before = server.syncs().length
    await game.syncNow!()
    expect(server.syncs()).toHaveLength(before + 1)
    expect(server.row('umas/' + umaId(1))).toBeDefined()
    expect((await game.logs!.ledgerRows()).map((row) => row.reason)).toEqual(['initial-uma-tickets', 'unlock-uma'])
    expect(await game.logs!.raceResults(umaId(1))).toEqual([])
    expect(await game.logs!.itemLedgerRows()).toEqual([])
    expect(await game.logs!.receipt(answer.id)).toEqual(answer.kind === 'done' ? answer.receipt : null)
    game.stop()
  })

  it('pauses sync while signed out', async () => {
    const server = new FakeServer()
    const game = createSaveGame({
      env: ENV, wipe: false, purge: false, wipeDeps: noWipe, newId: nextId, db: freshDb(), storage: memoryStorage(), signals: fakeSignals().signals,
      api: createSaveApi({ fetch: server.fetch as unknown as typeof fetch, base: '' }), signedIn: false,
    })
    await settled(game)
    expect([game.getSnapshot().status, game.getSnapshot().sync, server.requests.length]).toEqual(['ready', 'paused', 0])
    game.setSignedIn(true)
    await settled(game)
    expect(game.getSnapshot().sync).toBe('synced')
    expect(server.row('profile/main')).toBeDefined()
    game.stop()
  })
})
