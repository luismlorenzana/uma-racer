// The tier rules' live blocks (docs/game/architecture.md#the-rework-modules): the eight tables of rework/03, /04 and /05 this area
// owns. docs/docs.test.ts checks each page against them.
import { describe, expect, it } from 'vitest'
import { REWORK_BLOCKS } from '../docs/rework'
import { LIVE_BLOCKS } from './docs'

describe('live blocks', () => {
  it('render the eight tables this area owns, and join the registry', () => {
    expect(Object.keys(LIVE_BLOCKS).sort()).toEqual([
      'racing-curve', 'racing-exp', 'tier-caps', 'tier-extra-budget', 'tier-extra-values', 'tier-map', 'tier-node-values', 'uma-tickets',
    ])
    for (const [key, render] of Object.entries(LIVE_BLOCKS)) {
      expect(render()).toMatch(/^\| .+ \|\n\|---/)
      expect(REWORK_BLOCKS[key]).toBe(render)
    }
  })

  it('render the curve and EXP per finish as 03 §2 states them', () => {
    expect(LIVE_BLOCKS['racing-curve']!()).toContain('| EXP to the next | 100 | 125 | 150 | 175 | 200 | 225 | 250 | 275 | 300 | **1,800** |')
    expect(LIVE_BLOCKS['racing-exp']!()).toContain('| 2nd or 3rd | 10 | 15 | 20 | 28 | 38 |')
  })
})
