// The fold (T136; docs/game/02-check-ins-and-notifications.md §9): the confirmed rows, then each queued operation,
// with the server's own `commitOperation`. A lost answer folds as repeated, a refused or broken tap is skipped and stays
// queued, and the same rows and outbox always fold to the same state.
import { isEntityKind, type EntityRow, type LogRow, type OperationEnvelope } from '@racer/domain/save'
import { describe, expect, it } from 'vitest'
import { CREATE_KEY, operationKey, type ConfirmedRows, type OutboxRow } from './db'
import { fold } from './fold'
import { ENV, FakeServer, umaId } from './__fixtures__/server'

const T = Date.UTC(2026, 9, 15, 8)
const create: OutboxRow = { seq: 1, key: CREATE_KEY, change: { type: 'create', createdAt: T }, queuedAt: T }
const envelope = (n: number, name: OperationEnvelope['name'], input: unknown): OperationEnvelope =>
  ({ id: `op-${String(n).padStart(5, '0')}`, name, input, at: T + n * 1_000 })
const queued = (seq: number, operation: OperationEnvelope): OutboxRow =>
  ({ seq, key: operationKey(operation.id), change: { type: 'operation', operation }, queuedAt: operation.at })

function confirmed(server: FakeServer): ConfirmedRows {
  const rows = [...server.rows.values()]
  return {
    entities: rows.filter((row): row is EntityRow => isEntityKind(row.kind)),
    logs: rows.filter((row): row is LogRow => !isEntityKind(row.kind)),
  }
}

describe('fold', () => {
  it('holds no save without a profile row or a create', () => {
    expect(fold({ entities: [], logs: [] }, [], ENV)).toEqual({ state: null, receipts: {}, pendingLogs: [], skipped: [] })
  })

  it('starts a new account from the create, then applies each queued tap at its own time', () => {
    const one = envelope(1, 'unlock-uma', { outfitId: umaId(1) })
    const two = envelope(2, 'unlock-uma', { outfitId: umaId(2) })
    const folded = fold({ entities: [], logs: [] }, [create, queued(2, one), queued(3, two)], ENV)
    expect(folded.state?.profile).toMatchObject({ umaTickets: 18, featuredUmaId: umaId(1), createdAt: T })
    expect(Object.keys(folded.state!.umas)).toEqual([umaId(1), umaId(2)])
    expect(Object.keys(folded.receipts)).toEqual([one.id, two.id])
    expect(folded.state?.operations?.[two.id]?.at).toBe(two.at)
    // The taps' own log rows wait as pending logs: their ledger rows and their operations rows.
    expect(folded.pendingLogs.map((row) => `${row.kind}/${row.id}`)).toEqual(expect.arrayContaining([`operations/${one.id}`, `operations/${two.id}`]))
    expect(folded.pendingLogs.filter((row) => row.kind === 'ledger')).toHaveLength(2)
  })

  it("folds an operation the server already ran, whose answer was lost, as repeated: it is never applied twice", () => {
    const server = new FakeServer(ENV, () => T)
    server.otherDevice([{ type: 'create', createdAt: T }])
    const one = envelope(1, 'unlock-uma', { outfitId: umaId(1) })
    // The device sent it; the server applied it; the answer never came back, and a pull brought the rows.
    const answer = server.otherDevice([{ type: 'operation', operation: one }]) as { results: { receipt: unknown }[] }
    const folded = fold(confirmed(server), [queued(5, one)], ENV)
    expect(folded.state?.profile.umaTickets).toBe(19)
    expect(folded.receipts[one.id]).toEqual(answer.results[0]!.receipt)
    expect(folded.pendingLogs).toEqual([])
    // Without the outbox row the confirmed operations row isn't read into the state at all.
    expect(fold(confirmed(server), [], ENV).state?.operations).toBeUndefined()
  })

  it('skips a tap that refuses or throws here, and folds the rest', () => {
    const one = envelope(1, 'unlock-uma', { outfitId: umaId(1) })
    const again = envelope(2, 'unlock-uma', { outfitId: umaId(1) })
    const broken = envelope(3, 'unlock-uma', { outfitId: 7 })
    const two = envelope(4, 'unlock-uma', { outfitId: umaId(2) })
    const folded = fold({ entities: [], logs: [] }, [create, queued(2, one), queued(3, again), queued(4, broken), queued(5, two)], ENV)
    expect(folded.skipped).toEqual([again.id, broken.id])
    expect(folded.state?.profile.umaTickets).toBe(18)
    expect(Object.keys(folded.receipts)).toEqual([one.id, two.id])
  })

  it('gives the same state, receipts and logs for the same rows, outbox and content', () => {
    const server = new FakeServer(ENV, () => T)
    server.otherDevice([{ type: 'create', createdAt: T }, { type: 'operation', operation: envelope(1, 'unlock-uma', { outfitId: umaId(3) }) }])
    const outbox = [queued(7, envelope(7, 'unlock-uma', { outfitId: umaId(4) })), queued(8, envelope(8, 'set-repeat-sizing', { sizing: 'fit' }))]
    expect(fold(confirmed(server), outbox, ENV)).toEqual(fold(confirmed(server), outbox, ENV))
    expect(fold(confirmed(server), outbox, ENV).state?.profile).toMatchObject({ umaTickets: 18, repeatSizing: 'fit' })
  })
})
