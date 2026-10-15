// The areas' live-block registry never lets two areas render the same key (M033).
import { beforeAll, expect, it } from 'vitest'
import { loopReport } from '../sim/report'
import { AREA_BLOCKS, joinBlocks, renderBlock } from './render'

// The loop simulation's blocks read one run per worker (T132); make it before the tests, not inside one's timeout.
beforeAll(() => { loopReport() }, 120_000)

it('joins area tables and refuses a key rendered twice', () => {
  const joined = joinBlocks({ a: () => 'A' }, { b: () => 'B' })
  expect(Object.keys(joined)).toEqual(['a', 'b'])
  expect(() => joinBlocks({ a: () => 'A' }, { a: () => 'again' })).toThrow(/rendered twice/)
})

it('keeps the area keys apart from the manual keys', () => {
  for (const key of Object.keys(AREA_BLOCKS)) {
    expect(renderBlock(key, { packages: [] })).toBe(AREA_BLOCKS[key]!())
  }
  expect(joinBlocks(AREA_BLOCKS, Object.fromEntries(['scenarios', 'caps', 'buffs', 'levels', 'race-rewards', 'rivals', 'dependencies']
    .map((key) => [key, () => key])))).toBeTruthy()
})
