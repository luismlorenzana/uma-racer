// The Town Hall plaza's crowd (docs/game/11-hub-and-places.md §5, SA7): the featured Uma in front, then the highest
// lifetime levels, newest release first, then name; five at most.
import { describe, expect, it } from 'vitest'
import { PLAZA_CROWD, plazaCrowd } from './racerHub'

const uma = (outfitId: string, tier: number, level: number) => ({ outfitId, tier, racing: { level } }) as never
const ABOUT: Readonly<Record<string, { name: string; release: string }>> = {
  a: { name: 'Amber', release: '2021-02-24' },
  b: { name: 'Bluebell', release: '2023-05-01' },
  c: { name: 'Cinder', release: '2022-01-10' },
  d: { name: 'Dawn', release: '2022-01-10' },
  e: { name: 'Ember', release: '2020-01-01' },
  f: { name: 'Fern', release: '2024-08-08' },
}
const about = (id: string) => ABOUT[id]!

describe('the plaza crowd (SA7)', () => {
  it('puts the featured Uma in front, then lifetime level, newest release, name; five at most', () => {
    const umas = {
      a: uma('a', 1, 3),
      b: uma('b', 1, 10),
      c: uma('c', 2, 1), // lifetime 51: the highest
      d: uma('d', 2, 1), // 51 too, same release as Cinder: name breaks the tie
      e: uma('e', 1, 10), // 10, as Bluebell; Bluebell is newer
      f: uma('f', 1, 1),
    }
    expect(PLAZA_CROWD).toBe(5)
    expect(plazaCrowd(umas, 'a', about)).toEqual(['a', 'c', 'd', 'b', 'e'])
  })

  it('stands fewer when fewer are owned, and needs no featured Uma', () => {
    expect(plazaCrowd({ b: uma('b', 1, 2), f: uma('f', 1, 2) }, null, about)).toEqual(['f', 'b'])
    expect(plazaCrowd({}, null, about)).toEqual([])
  })

  it('ignores a featured id she no longer owns', () => {
    expect(plazaCrowd({ b: uma('b', 1, 2) }, 'gone', about)).toEqual(['b'])
  })
})
