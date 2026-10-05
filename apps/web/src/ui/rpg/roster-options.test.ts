import { describe, expect, it } from 'vitest'
import { orderRpgRoster } from './roster-options'

describe('RPG roster order', () => {
  it('groups enrolled outfits first, then sorts names with a stable id tie break without mutating input', () => {
    const ids = ['unenrolled-a', 'enrolled-z', 'enrolled-b', 'enrolled-a']
    const names: Record<string, string> = { 'unenrolled-a': 'A', 'enrolled-z': 'Z', 'enrolled-b': 'A', 'enrolled-a': 'A' }
    expect(orderRpgRoster(ids, new Set(ids.slice(1)), id => names[id]!))
      .toEqual(['enrolled-a', 'enrolled-b', 'enrolled-z', 'unenrolled-a'])
    expect(ids[0]).toBe('unenrolled-a')
  })
})
