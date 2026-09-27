import { describe, expect, it } from 'vitest'
import type { UmaSave } from '@racer/domain'
import type { LoadedContent } from '../content/runtime'
import { umaIdsByLevel } from './uma-order'

const save = (level: number) => ({ level }) as UmaSave
const content = {
  umas: { byId: new Map([['a', { name: 'Zenno Rob Roy' }], ['b', { name: 'Air Groove' }], ['c', { name: 'Biko Pegasus' }]]) },
} as unknown as LoadedContent

describe('Uma order (D181)', () => {
  it('lists the highest Uma Level first, then by name, with catalog Umas after every owned one', () => {
    const saves = { a: save(12), b: save(3), c: save(12) }
    expect(umaIdsByLevel(saves, content)).toEqual(['c', 'a', 'b'])
    expect(umaIdsByLevel({ b: save(3) }, content, ['a', 'b'])).toEqual(['b', 'a'])
  })
})
