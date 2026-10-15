// The check-ins' live block (docs/game/architecture.md#the-rework-modules "The live manual"): rework/02 §3's gap table, registered
// once. docs/docs.test.ts checks the block's body against the page.
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { REWORK_BLOCKS } from '../docs/rework'
import { LIVE_BLOCKS } from './docs'

const page = readFileSync(fileURLToPath(new URL('../../../../docs/rework/02-check-ins-and-notifications.md', import.meta.url)), 'utf8')

describe('the check-in block', () => {
  it('renders 02 §3 in the page that states it, and joins the registry', () => {
    expect(Object.keys(LIVE_BLOCKS)).toEqual(['check-in-fits'])
    expect(page.includes('<!-- live:check-in-fits -->')).toBe(true)
    expect(REWORK_BLOCKS['check-in-fits']).toBe(LIVE_BLOCKS['check-in-fits'])
  })

  it("states the page's cells", () => {
    const table = LIVE_BLOCKS['check-in-fits']!()
    expect(table).toContain('| Work at grade 1 | 08:00 → 13:00 (5 h) | 13:00 → 22:30 (9.5 h) | 22:30 → 08:00 (9.5 h) |')
    expect(table).toContain('| Craft (22.5 min each) | ×10 then ×3 queued, ends 12:52 | ×10, ×10, ×5 queued, ends 22:22 | ×10, ×10, ×5 queued, ends 07:52 |')
    expect(table).toContain('| Session (180 min each) | ×1, ends 11:00 | ×3, ends 22:00 | ×3, ends 07:30 |')
  })
})
