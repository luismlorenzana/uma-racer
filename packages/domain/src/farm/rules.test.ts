import { describe, expect, it } from 'vitest'
import { farmCropFor } from './catalog'
import {
  assignFarmOutfit,
  canPlant,
  createInitialFarmState,
  farmPlot,
  farmWorkerProgress,
  harvestPlot,
  plantPlot,
  plotStatus,
  unassignFarmOutfit,
} from './rules'
import type { FarmState } from './types'

const OWNED = new Set(['outfit-a', 'outfit-b', 'outfit-c'])
const HOUR = 60 * 60 * 1_000
const crop = (tier: number, stat = 'speed' as const) => farmCropFor(tier, stat)!

function assignedFarm(progress = { level: 1, exp: 0 }): FarmState {
  const initial = { ...createInitialFarmState(), workers: { 'outfit-a': progress } }
  return assignFarmOutfit(initial, 'plot-1', 'outfit-a', OWNED)
}

function harvestOnce(progress: { level: number; exp: number }) {
  const planted = plantPlot({ farm: assignedFarm(progress), plotId: 'plot-1', crop: crop(1), ownedTemplateIds: OWNED, now: 0 })
  return harvestPlot({ farm: planted.farm, plotId: 'plot-1', cycleId: planted.cycleId, crop: crop(1), now: planted.readyAt })
}

describe('Farm rules', () => {
  it('starts with one unlocked unassigned plot and derives every other lock', () => {
    const farm = createInitialFarmState()
    expect(['plot-1', 'plot-2', 'plot-6', 'plot-7'].map((id) => plotStatus(farm, id as 'plot-1', 0)))
      .toEqual(['unassigned', 'locked', 'locked', 'locked'])
    expect(farmPlot(farm, 'plot-7')).toEqual({ id: 'plot-7', templateId: null, lastCropId: null, attempt: 0, cycle: null })
    expect(() => farmPlot(farm, 'plot-0' as 'plot-1')).toThrow(/invalid/)
  })

  it('assigns owned outfits only to unlocked idle plots, prevents duplicates, and stores only used plots', () => {
    const initial = createInitialFarmState()
    expect(() => assignFarmOutfit(initial, 'plot-1', 'missing', OWNED)).toThrow(/not owned/)
    expect(() => assignFarmOutfit(initial, 'plot-2', 'outfit-a', OWNED)).toThrow(/locked/)

    const openTwo = { ...initial, workers: { 'outfit-a': { level: 3, exp: 0 } } }
    const first = assignFarmOutfit(openTwo, 'plot-1', 'outfit-a', OWNED)
    expect(() => assignFarmOutfit(first, 'plot-2', 'outfit-a', OWNED)).toThrow(/already assigned/)
    const parallel = assignFarmOutfit(first, 'plot-2', 'outfit-b', OWNED)
    expect(parallel.plots.map((plot) => [plot.id, plot.templateId])).toEqual([['plot-1', 'outfit-a'], ['plot-2', 'outfit-b']])
    expect(unassignFarmOutfit(parallel, 'plot-2').plots.map((plot) => plot.id)).toEqual(['plot-1'])
  })

  it('gates a crop row on the worker alone and times it by her level (D234)', () => {
    expect(canPlant(assignedFarm(), 'plot-1', crop(2), OWNED)).toEqual({
      ok: false, reason: 'outfit-level-required', requiredLevel: 10,
    })
    expect(canPlant(assignedFarm({ level: 10, exp: 0 }), 'plot-1', crop(2), OWNED)).toEqual({
      ok: true, templateId: 'outfit-a', outfitLevel: 10, farmLevel: 10, growthMs: 12 * HOUR,
    })
    expect(canPlant(assignedFarm({ level: 12, exp: 0 }), 'plot-1', crop(1), OWNED)).toMatchObject({ ok: true, growthMs: 8 * HOUR })
  })

  it('plants deterministic monotonic cycles without mutating its input', () => {
    const farm = assignedFarm({ level: 6, exp: 0 })
    const before = structuredClone(farm)
    const planted = plantPlot({ farm, plotId: 'plot-1', crop: crop(1), ownedTemplateIds: OWNED, now: 5_000 })
    expect(farm).toEqual(before)
    expect(planted.cycleId).toBe('farm:plot-1:1')
    // Lv6 is five levels past the row's Lv1: 12h − 5 × 24 min.
    expect(planted.readyAt).toBe(5_000 + 10 * HOUR)
    expect(plotStatus(planted.farm, 'plot-1', planted.readyAt - 1)).toBe('growing')
    expect(plotStatus(planted.farm, 'plot-1', planted.readyAt)).toBe('ready')
    expect(() => assignFarmOutfit(planted.farm, 'plot-1', 'outfit-b', OWNED)).toThrow(/cannot change/)
    expect(() => plantPlot({ ...planted, plotId: 'plot-1', crop: crop(1), ownedTemplateIds: OWNED, now: 6_000 }))
      .toThrow(/plot-busy/)
  })

  it('harvests one item and 12 XP, retains the worker, and exposes crossed unlocks', () => {
    const farm = assignedFarm({ level: 2, exp: 12 })
    const planted = plantPlot({ farm, plotId: 'plot-1', crop: crop(1), ownedTemplateIds: OWNED, now: 1_000 })
    const beforeHarvest = structuredClone(planted.farm)
    expect(() => harvestPlot({
      farm: planted.farm, plotId: 'plot-1', cycleId: planted.cycleId, crop: crop(1), now: planted.readyAt - 1,
    })).toThrow(/not ready/)
    expect(() => harvestPlot({
      farm: planted.farm, plotId: 'plot-1', cycleId: 'farm:plot-1:99', crop: crop(1), now: planted.readyAt,
    })).toThrow(/changed/)

    const result = harvestPlot({
      farm: planted.farm, plotId: 'plot-1', cycleId: planted.cycleId, crop: crop(1), now: planted.readyAt,
    })
    expect(planted.farm).toEqual(beforeHarvest)
    expect(result.movement).toEqual({
      id: 'farm:plot-1:1', itemId: 'produce:t1:speed', delta: 1, reason: 'farm-harvest', createdAt: planted.readyAt,
      source: { kind: 'farm-harvest', plotId: 'plot-1', cycleId: 'farm:plot-1:1', templateId: 'outfit-a', farmingExp: 12 },
    })
    expect(result).toMatchObject({
      outfitLevelBefore: 2, outfitLevelAfter: 3, levelsCrossed: [3], farmLevelBefore: 2, farmLevelAfter: 3,
      plotsUnlocked: ['plot-2'], cropTiersUnlocked: [],
    })
    expect(result.farm.plots[0]).toMatchObject({
      templateId: 'outfit-a', lastCropId: 'produce:t1:speed', attempt: 1, cycle: null,
    })
    expect(farmWorkerProgress(result.farm, 'outfit-a')).toEqual({ level: 3, exp: 0 })
    expect(plotStatus(result.farm, 'plot-1', planted.readyAt)).toBe('idle')
    expect(harvestOnce({ level: 9, exp: 12 }).cropTiersUnlocked).toEqual([2])
  })

  it('has no Farming Level cap', () => {
    const result = harvestOnce({ level: 500, exp: 12 })
    expect(farmWorkerProgress(result.farm, 'outfit-a')).toEqual({ level: 501, exp: 0 })
    expect(result.levelsCrossed).toEqual([501])
  })
})
