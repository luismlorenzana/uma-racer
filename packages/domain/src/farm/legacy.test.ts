import { describe, expect, it } from 'vitest'
import { migrateFarmStateToCurrent, parseLegacyFarmStateV1 } from './legacy'
import { farmLevel } from './progression'
import { createInitialFarmState } from './rules'

const HOURS_12 = 12 * 60 * 60 * 1_000
const emptyV1 = (id: string) => ({ id, templateId: null, lastCropId: null, attempt: 0, cycle: null })

const v1Farm = () => ({
  schemaVersion: 1,
  plots: [
    { id: 'plot-1', templateId: 'outfit-a', lastCropId: 'produce:t1:stamina', attempt: 2,
      cycle: { id: 'farm:plot-1:2', cropId: 'produce:t1:speed', plantedAt: 1_000, readyAt: 1_000 + HOURS_12 } },
    { id: 'plot-2', templateId: 'outfit-b', lastCropId: null, attempt: 0, cycle: null },
    ...['plot-3', 'plot-4', 'plot-5', 'plot-6'].map(emptyV1),
  ],
  workers: { 'outfit-a': { level: 2, exp: 12 }, 'outfit-b': { level: 1, exp: 36 } },
})

describe('Farm v1 → v2 (D234)', () => {
  it('re-levels every worker from her lifetime Farming XP and keeps only plots that were used', () => {
    expect(parseLegacyFarmStateV1(v1Farm())).not.toBeNull()
    const migrated = migrateFarmStateToCurrent(v1Farm())!
    expect(migrated.schemaVersion).toBe(2)
    expect(migrated.plots.map((plot) => plot.id)).toEqual(['plot-1', 'plot-2'])
    // 60 XP is five harvests: Lv3 and half a level. 36 XP is three: Lv2 and half. The twelve-hour cycle keeps its deadline.
    expect(migrated.workers).toEqual({ 'outfit-a': { level: 3, exp: 12 }, 'outfit-b': { level: 2, exp: 12 } })
    expect(migrated.plots[0]!.cycle).toEqual(v1Farm().plots[0]!.cycle)
    expect(farmLevel(migrated.workers)).toBe(4)
  })

  it('raises a v1 Lv20 worker to the level her 112 harvests buy, and passes v2 through', () => {
    const maxed = { ...v1Farm(), workers: { 'outfit-a': { level: 20, exp: 0 } } }
    expect(migrateFarmStateToCurrent(maxed)!.workers['outfit-a']).toEqual({ level: 57, exp: 0 })
    const current = createInitialFarmState()
    expect(migrateFarmStateToCurrent(current)).toEqual(current)
  })

  it('refuses anything that is neither shape', () => {
    expect(migrateFarmStateToCurrent({ ...v1Farm(), plots: v1Farm().plots.slice(1) })).toBeNull()
    expect(migrateFarmStateToCurrent({ ...v1Farm(), workers: { 'outfit-a': { level: 21, exp: 0 } } })).toBeNull()
    expect(migrateFarmStateToCurrent({ ...v1Farm(), schemaVersion: 3 })).toBeNull()
    expect(migrateFarmStateToCurrent(null)).toBeNull()
  })
})
