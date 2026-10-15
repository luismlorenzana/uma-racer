// The Firestore codec (D151), kept from the generation-1 save module when T143 deleted it: a row whose data holds an
// array inside an array is stored as JSON text, every other row as it is.
import { describe, expect, it } from 'vitest'
import { fromStored, hasNestedArray, toStored } from './firestore-codec'

describe('Firestore codec', () => {
  // A compiled skill condition, alternatives of clauses, is an array of arrays, which Firestore cannot store (D151).
  const raceRow = {
    kind: 'raceResults' as const, id: 'op-1', generation: 2, schema: 1, at: 1, savedAt: 2,
    data: { run: { field: [{ umaId: 'u1', skills: [{ groups: [{ condition: [[{ variable: 'phase', op: '>=', value: 2 }]] }] }] }] } },
  }

  it('finds an array directly inside another array, however deep', () => {
    expect(hasNestedArray(raceRow.data)).toBe(true)
    expect(hasNestedArray({ a: [1, { b: [2, 3] }], c: { d: [] } })).toBe(false)
    expect(hasNestedArray([[1]])).toBe(true)
  })

  it('stores such a row as JSON text and reads it back exactly', () => {
    const stored = toStored(raceRow)
    expect(stored).not.toHaveProperty('data')
    expect(typeof stored.dataJson).toBe('string')
    expect(hasNestedArray(stored)).toBe(false)
    expect(fromStored(stored)).toEqual(raceRow)
  })

  it('leaves every other row as it is', () => {
    const ledger = { kind: 'ledger' as const, id: 'l1', generation: 2, schema: 1, at: 1, savedAt: 2, data: { id: 'l1', resource: 'umaTickets', delta: 20, reason: 'initial-uma-tickets', at: 1 } }
    expect(toStored(ledger)).toEqual(ledger)
    expect(fromStored(ledger)).toEqual(ledger)
  })
})
