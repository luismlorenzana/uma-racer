// The tier rules' live blocks (docs/game/architecture.md "The live manual"): the tier map, the caps and the rivals by
// scenario that docs/game/04-tiers-and-scenarios.md shows. docs/docs.test.ts checks the page against them.
import { describe, expect, it } from 'vitest'
import { AREA_BLOCKS } from '../docs/render'
import { LIVE_BLOCKS } from './docs'

describe('live blocks', () => {
  it('render the three tables this area owns, and join the registry', () => {
    expect(Object.keys(LIVE_BLOCKS).sort()).toEqual(['tier-caps', 'tier-map', 'tier-rivals'])
    for (const [key, render] of Object.entries(LIVE_BLOCKS)) {
      expect(render()).toMatch(/^\| .+ \|\n\|---/)
      expect(AREA_BLOCKS[key]).toBe(render)
    }
  })

  it('names the 15th and its caps', () => {
    expect(LIVE_BLOCKS['tier-map']!()).toContain('| 5 | 15 | Goshiki Shuntaisai | 2026-10-26 | 9,500 | 5,200 |')
    expect(LIVE_BLOCKS['tier-caps']!()).toContain('| 15 | Goshiki Shuntaisai | 2600 | 1750 | 1800 | 1700 | 1650 | 9500 |')
  })

  it('shows URA Finale\'s measured rivals beside the frozen ones', () => {
    expect(LIVE_BLOCKS['tier-rivals']!()).toContain('| 1 | URA Finale | 559 | 559 | `sim:careers` (D383) |')
    expect(LIVE_BLOCKS['tier-rivals']!()).toContain('| 2 | Unity Cup | 664.8 | 664.8 | generation 2, frozen (D381) |')
  })
})
