// Invented catalogue rows only (D291).
import { describe, expect, it } from 'vitest'
import { verifiedUmaSources } from './puzzle-preservation-content'

const row = (id: string) => ({
  id, baseStats: { speed: 100, stamina: 100, power: 100, guts: 100, wit: 100 },
  growthRates: { speed: 0.1, stamina: 0, power: 0, guts: 0, wit: 0 },
  aptitudes: { surface: { turf: 'A', dirt: 'G' }, distance: { sprint: 'C', mile: 'A', medium: 'A', long: 'B' },
    strategy: { front: 'A', pace: 'B', late: 'C', end: 'G' } },
})
const sha = 'ab'.repeat(32)

describe('preservation Uma catalogue (D291)', () => {
  it("names the catalogue by its verified file hash, so the importer's joined '+' version passes", () => {
    const verified = verifiedUmaSources({ sha256: sha }, { version: 'aaaa1111+bbbb2222', items: [row('invented-1'), row('invented-2')] })
    expect(verified.catalogueVersion).toBe(sha)
    expect([...verified.sources.keys()]).toEqual(['invented-1', 'invented-2'])
    expect([...verified.sources.values()].every((source) => source.contentVersion === sha)).toBe(true)
  })

  it('still refuses a malformed catalogue or an ambiguous outfit', () => {
    expect(() => verifiedUmaSources({ sha256: sha }, { version: 7, items: [] })).toThrow(/Uma catalogue failed verification/)
    expect(() => verifiedUmaSources({ sha256: sha }, { version: 'v', items: {} })).toThrow(/Uma catalogue failed verification/)
    expect(() => verifiedUmaSources({ sha256: sha }, { version: 'v', items: [row('same'), row('same')] })).toThrow(/Ambiguous/)
  })
})
