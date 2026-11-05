// A tap (T136, T152): one operation, written to the outbox before the store publishes it; a refusal writes nothing and
// answers in its rule's words; a held busy key ignores the second tap; a reload folds to the same state and receipts;
// and the read helpers merge Dexie's logs with the queued taps' own.
import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { operationKey } from './db'
import { useSave } from './store'
import { cardId, device, FakeServer, settle, turn, umaId, useClock, type Device } from './__fixtures__/server'

beforeEach(() => useClock())
afterEach(() => vi.useRealTimers())

/** A device whose network is down, so nothing it writes leaves the outbox. */
async function offlineDevice(): Promise<Device> {
  const server = new FakeServer()
  server.failAlways('offline')
  const phone = device(server)
  await settle(phone)
  return phone
}

describe('a tap', () => {
  it('writes one outbox row, and the store publishes only after Dexie commits it', async () => {
    const phone = await offlineDevice()
    const events: string[] = []
    const transaction = phone.db.transaction.bind(phone.db) as (...args: unknown[]) => Promise<unknown>
    ;(phone.db as unknown as { transaction: unknown }).transaction = (...args: unknown[]) =>
      transaction(...args).then((result) => (events.push('committed'), result))
    const stop = useSave.subscribe(() => events.push('published'))
    const answer = await phone.session.actions.run('unlock-uma', { umaId: umaId(1) })
    stop()
    expect(answer).toMatchObject({ kind: 'done', repeated: false, receipt: { id: umaId(1), ticketsLeft: 19 } })
    expect(events).toEqual(['committed', 'published'])
    const rows = await phone.db.outbox.toArray()
    expect(rows.map((row) => row.key)).toEqual(['create', operationKey(answer.id)])
    expect(rows[1]?.change).toEqual({ type: 'operation', operation: { id: answer.id, name: 'unlock-uma', input: { umaId: umaId(1) }, at: Date.now() } })
    expect(useSave.getState().state?.umas[umaId(1)]).toEqual({ unlockedAt: Date.now() })
    expect(useSave.getState().receipts[answer.id]).toEqual({ local: answer.kind === 'done' ? answer.receipt : null })
    expect(useSave.getState().sync).toMatchObject({ pending: 2, oldestQueuedAt: Date.now() })
    phone.session.stop()
  })

  it("writes nothing for a refusal, and answers the screen in its rule's words", async () => {
    const phone = await offlineDevice()
    const { run } = phone.session.actions
    await run('unlock-uma', { umaId: umaId(1) })
    const before = await phone.db.outbox.count()
    const state = useSave.getState().state
    expect(await run('unlock-uma', { umaId: umaId(1) })).toMatchObject({ kind: 'refused', code: 'already-unlocked', text: 'Amber Sprint is already in your Stable.' })
    expect(await run('unlock-uma', { umaId: 7 })).toMatchObject({ kind: 'refused', code: 'invalid', text: "That didn't work. Try again." })
    expect(await run('settle-stage', {})).toMatchObject({ kind: 'refused', code: 'not-built-yet' })
    expect(await phone.db.outbox.count()).toBe(before)
    expect(useSave.getState().state).toBe(state)
    phone.session.stop()
  })

  it("gives a second tap on a held busy key the first one's answer, and runs it once", async () => {
    const phone = await offlineDevice()
    const { run } = phone.session.actions
    const first = run('unlock-uma', { umaId: umaId(1) }, 'unlock')
    const second = run('unlock-uma', { umaId: umaId(1) }, 'unlock')
    expect(second).toBe(first)
    const other = run('unlock-uma', { umaId: umaId(2) }, 'other')
    await Promise.all([first, other])
    expect(await phone.db.outbox.count()).toBe(3)
    // Released once answered: the next tap with the key runs again.
    expect((await run('unlock-uma', { umaId: umaId(1) }, 'unlock')).kind).toBe('refused')
    phone.session.stop()
  })

  it('folds to the same state and receipts after a reload', async () => {
    const phone = await offlineDevice()
    const { run } = phone.session.actions
    await run('unlock-uma', { umaId: umaId(1) })
    await run('unlock-card', { cardId: cardId(2) })
    await run('dev-grant', { umaTickets: 3, cardTickets: 1 })
    const { state, receipts, pendingLogs } = useSave.getState()
    expect(state?.account).toMatchObject({ umaTickets: 22, cardTickets: 24 })
    phone.session.stop()
    const reloaded = device(phone.server, { db: phone.db, storage: phone.storage })
    await reloaded.session.opened
    expect(useSave.getState().state).toEqual(state)
    expect(useSave.getState().receipts).toEqual(receipts)
    expect(useSave.getState().pendingLogs).toEqual(pendingLogs)
    reloaded.session.stop()
  })

  it('refuses a tap before the save opens', async () => {
    const server = new FakeServer()
    let release = () => {}
    const held = new Promise<void>((resolve) => (release = resolve))
    const answer = server.fetch.getMockImplementation()!
    server.fetch.mockImplementation(async (input, init) => (await held, answer(input, init)))
    const phone = device(server)
    await expect(phone.session.actions.run('unlock-uma', { umaId: umaId(1) })).rejects.toThrow('The game is still opening.')
    release()
    await settle(phone)
    phone.session.stop()
  })
})

describe('the read helpers', () => {
  it("read a receipt and an operation from the store, the queued taps' own, or Dexie", async () => {
    const server = new FakeServer()
    const phone = device(server)
    await settle(phone)
    vi.advanceTimersByTime(60_000)
    const { run, receipt, operation } = phone.session.actions
    const synced = await run('unlock-uma', { umaId: umaId(1) })
    await vi.advanceTimersByTimeAsync(1_500)
    await settle(phone)
    server.failAlways('offline')
    const queued = await run('unlock-uma', { umaId: umaId(2) })
    await turn()
    expect(await receipt(queued.id)).toEqual(queued.kind === 'done' ? queued.receipt : null)
    expect(await operation(queued.id)).toMatchObject({ name: 'unlock-uma', at: Date.now() })
    // The store keeps the latest receipts; an older one is read from Dexie's operations log.
    useSave.setState({ receipts: {} })
    expect(await receipt(synced.id)).toEqual(synced.kind === 'done' ? synced.receipt : null)
    expect(await operation(synced.id)).toMatchObject({ name: 'unlock-uma' })
    expect(await operation('op-nowhere-0')).toBeNull()
    expect(await phone.session.actions.raceResults(umaId(1))).toEqual([])
    phone.session.stop()
  })
})
