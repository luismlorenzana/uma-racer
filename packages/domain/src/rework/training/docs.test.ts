// The Training Hub's live blocks (docs/game/architecture.md#the-rework-modules): the thirteen tables of rework/README, /04, /05 and
// /06 this area owns. docs/docs.test.ts checks each page against them.
import { describe, expect, it } from 'vitest'
import { REWORK_BLOCKS } from '../../docs/rework'
import { LIVE_BLOCKS } from './docs'

describe('live blocks', () => {
  it('render the tables this area owns, and join the registry', () => {
    expect(Object.keys(LIVE_BLOCKS).sort()).toEqual([
      'bond-counts', 'bond-dishes', 'bond-grades', 'rework-buffs', 'training-extra-capacity', 'training-extra-grades', 'training-extra-nodes',
      'training-facilities', 'training-inspiration-grades', 'training-layer-grades', 'training-layers', 'training-node-grades', 'training-session-times',
    ])
    for (const [key, render] of Object.entries(LIVE_BLOCKS)) {
      expect(key).toMatch(/^[a-z-]+$/)
      expect(render()).toMatch(/^\| .+ \|\n\|---/)
      expect(REWORK_BLOCKS[key]).toBe(render)
    }
  })

  it('state the pages\' numbers', () => {
    expect(LIVE_BLOCKS['training-layers']!()).toContain('| **Tier** | **28** | **24** (6 slots, 6 uniques, 12 golds) | **37** (25 + 8 + 4) | **18** | **107** |')
    expect(LIVE_BLOCKS['training-session-times']!()).toContain('| Real minutes at *k* = 1.2, Lv 1–2 | 216 | 234 | 252 | 270 | 288 | 306 | 324 | 342 | 360 | 378 |')
    expect(LIVE_BLOCKS['training-layer-grades']!()).toContain('| 4 | 7–8 | 4 nodes: 2 at g7, 2 at g8 | 2 grandparent uniques and 1 grandparent gold at g7, 3 grandparent golds at g8 |')
    expect(LIVE_BLOCKS['training-extra-capacity']!()).toContain('| Nodes that can pay | 5 | 9 | 11 | 13 | 15 |')
    expect(LIVE_BLOCKS['bond-grades']!()).toContain("| 6 · Project L'Arc | — | **1** | 1 |")
    expect(LIVE_BLOCKS['bond-counts']!()).toContain('| Bonded by the end of the scenario | 6 | 9 | 12 | 15 | 18 | |')
    expect(LIVE_BLOCKS['rework-buffs']!()).toContain('| 1 | URA Finale | **Foundation** | Extra Stats nodes pay ×1.5 (single +60, Duo +30/+30, Sun +12) |')
  })
})
