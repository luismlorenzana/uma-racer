import type { SyncRequest, SyncResponse } from '@racer/domain'
import { describe, expect, it } from 'vitest'
import type { OutboxRow } from './db'
import { acknowledgedSequences, nextEconomicLane, type EconomicLane } from './sync'

const batch: OutboxRow[] = [
  { seq: 4, kind: 'profile', id: 'main', op: 'upsert', queuedAt: 1 },
  { seq: 5, kind: 'ledger', id: 'daily-tickets:2000-01-01', op: 'append', queuedAt: 1 },
]
const request: SyncRequest = {
  upserts: [{ kind: 'profile', id: 'main', baseVersion: 0, data: {} }],
  appends: [{ kind: 'ledger', id: 'daily-tickets:2000-01-01', data: {}, createdAt: 1 }],
}

describe('sync acknowledgement validation', () => {
  it('serves ordinary/Puzzle/Farm lanes fairly even with continuously replenished queues', () => {
    let previous: EconomicLane | null = null
    const served: EconomicLane[] = []
    for (let n = 0; n < 12; n++) { previous = nextEconomicLane(['farm', 'puzzle', 'ordinary'], previous); served.push(previous!) }
    expect(served).toEqual(Array.from({ length: 4 }, () => ['ordinary', 'puzzle', 'farm']).flat())
    expect(nextEconomicLane(['farm', 'ordinary'], 'ordinary')).toBe('farm')
    expect(nextEconomicLane(['ordinary'], 'farm')).toBe('ordinary')
    expect(nextEconomicLane([], 'puzzle')).toBeNull()
  })
  it('acknowledges only the exact captured queue sequences', () => {
    const response: SyncResponse = {
      applied: [{ kind: 'profile', id: 'main', version: 1 }],
      conflicts: [],
      appended: 0,
      serverTime: 2,
    }
    expect(acknowledgedSequences(batch, request, response)).toEqual([4, 5])
  })

  it('keeps work pending on partial, duplicate, or unrelated entity replies', () => {
    const base = { appended: 1, serverTime: 2 }
    expect(() => acknowledgedSequences(batch, request, { ...base, applied: [], conflicts: [] })).toThrow(/does not account/)
    expect(() => acknowledgedSequences(batch, request, {
      ...base,
      applied: [
        { kind: 'profile', id: 'main', version: 1 },
        { kind: 'profile', id: 'main', version: 2 },
      ],
      conflicts: [],
    })).toThrow(/does not account/)
  })
})
