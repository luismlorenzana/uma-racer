// The tier rules' live blocks (docs/game/architecture.md "The live manual"): the tier map and the caps that
// docs/game/04-tiers-and-scenarios.md shows. docs/docs.test.ts checks the page against them.
import { describe, expect, it } from 'vitest'
import { AREA_BLOCKS } from '../docs/render'
import { LIVE_BLOCKS } from './docs'

describe('live blocks', () => {
  it('render the two tables this area owns, and join the registry', () => {
    expect(Object.keys(LIVE_BLOCKS).sort()).toEqual(['tier-caps', 'tier-map'])
    for (const [key, render] of Object.entries(LIVE_BLOCKS)) {
      expect(render()).toMatch(/^\| .+ \|\n\|---/)
      expect(AREA_BLOCKS[key]).toBe(render)
    }
  })

  it('names the 15th and its caps', () => {
    expect(LIVE_BLOCKS['tier-map']!()).toContain('| 5 | 15 | Goshiki Shuntaisai | 2026-10-26 | 9,500 | 5,200 |')
    expect(LIVE_BLOCKS['tier-caps']!()).toContain('| 15 | Goshiki Shuntaisai | 2600 | 1750 | 1800 | 1700 | 1650 | 9500 |')
  })
})
