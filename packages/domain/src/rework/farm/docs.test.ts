// The Farm's live blocks (docs/game/architecture.md#the-rework-modules "The live manual"): seven tables in rework/07 and /05,
// registered once. docs/docs.test.ts checks each block's body against the page.
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { REWORK_BLOCKS } from '../../docs/rework'
import { LIVE_BLOCKS } from './docs'

const page = (name: string) => readFileSync(fileURLToPath(new URL(`../../../../../docs/rework/${name}`, import.meta.url)), 'utf8')

describe('the Farm blocks', () => {
  it('render seven tables, each in the page that states it', () => {
    expect(Object.keys(LIVE_BLOCKS)).toEqual([
      'farm-job-times', 'farm-aptitudes', 'farm-exp-multipliers', 'farm-level-grades', 'farm-slots', 'farm-upgrades', 'facility-slots-upgrades',
    ])
    const farm = page('07-farm.md'), hub = page('05-training-hub.md')
    for (const key of Object.keys(LIVE_BLOCKS)) {
      expect((key.startsWith('facility') ? hub : farm).includes(`<!-- live:${key} -->`), key).toBe(true)
      expect(REWORK_BLOCKS[key]).toBe(LIVE_BLOCKS[key])
    }
  })

  it('render the totals the pages state', () => {
    expect(LIVE_BLOCKS['farm-slots']!()).toContain('| **All ten** | **27** | **38** | 38 (47.5 slot-equivalents) |')
    expect(LIVE_BLOCKS['farm-upgrades']!()).toContain('| **All ten** | **14,100 PM** | **37,200 PM** |')
    expect(LIVE_BLOCKS['facility-slots-upgrades']!()).toContain('| **All four** | | | | **6,100 PM** | **10,700 PM** |')
    expect(LIVE_BLOCKS['farm-level-grades']!()).toContain('| (Lv 50) | 50 | 29,400 |')
  })
})
