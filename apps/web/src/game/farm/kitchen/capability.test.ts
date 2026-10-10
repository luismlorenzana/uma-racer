// Release parity without importing the standalone API adapter into a browser package.
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { FARM_KITCHEN_RELEASE_ENABLED } from './capability'
describe('complete Farm release gates', () => {
  it('enables both code-owned capabilities together', () => {
    expect(FARM_KITCHEN_RELEASE_ENABLED).toBe(true)
    expect(readFileSync(new URL('../../../../../api/src/save/farms.ts', import.meta.url), 'utf8')).toContain('export const FARM_KITCHEN_RELEASE_ENABLED = true')
  })
})
