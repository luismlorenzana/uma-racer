import { describe, expect, it } from 'vitest'
import { orderRpgRoster, rpgPartyCandidates } from './roster-options'

describe('RPG roster order', () => {
  it('puts enrolled outfits first, highest RPG level first, then names with a stable id tie break', () => {
    const ids = ['unenrolled-a', 'low-z', 'high-b', 'high-a', 'low-a']
    const levels: Record<string, number | null> = { 'unenrolled-a': null, 'low-z': 3, 'high-b': 14, 'high-a': 14, 'low-a': 3 }
    const names: Record<string, string> = { 'unenrolled-a': 'A', 'low-z': 'Z', 'high-b': 'B', 'high-a': 'A', 'low-a': 'A' }
    expect(orderRpgRoster(ids, (id) => levels[id]!, (id) => names[id]!)).toEqual(['high-a', 'high-b', 'low-a', 'low-z', 'unenrolled-a'])
    expect(ids[0]).toBe('unenrolled-a')
  })
})

describe('RPG party picker (D284)', () => {
  it('offers only enrolled Umas that no party holds, highest level first', () => {
    const levels: Record<string, number> = { a: 3, b: 14, c: 9, d: 20 }
    const parties = [[{ outfitId: 'd' }, null, null, null, null], [null, { outfitId: 'c' }, null, null, null]]
    expect(rpgPartyCandidates(['a', 'b', 'c', 'd'], parties, (id) => levels[id]!, (id) => id)).toEqual(['b', 'a'])
    expect(rpgPartyCandidates(['a'], [[{ outfitId: 'a' }]], (id) => levels[id]!, (id) => id)).toEqual([])
  })
})
