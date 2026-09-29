import { describe, expect, it } from 'vitest'
import { farmCropFor } from './catalog'
import { FARM_GROWTH_MS } from './constants'
import {
  assignFarmOutfit,
  canPlant,
  createInitialFarmState,
  farmWorkerProgress,
  harvestPlot,
  plantPlot,
  plotStatus,
  unassignFarmOutfit,
} from './rules'
import type { FarmState } from './types'

const OWNED = new Set(['outfit-a', 'outfit-b', 'outfit-c'])
const crop = (tier: number, stat = 'speed' as const) => farmCropFor(tier, stat)!

function assignedFarm(progress = { level: 1, exp: 0 }): FarmState {
  const initial = { ...createInitialFarmState(), workers: { 'outfit-a': progress } }
  return assignFarmOutfit(initial, 'plot-1', 'outfit-a', OWNED)
}

describe('Farm rules', () => {
  it('starts with one unlocked unassigned plot and five derived locks', () => {
    const farm = createInitialFarmState()
    expect(farm.plots.map((plot) => plotStatus(farm, plot.id, 0)))
      .toEqual(['unassigned', 'locked', 'locked', 'locked', 'locked', 'locked'])
  })

  it('assigns owned outfits only to unlocked idle plots and prevents duplicates', () => {
    const initial = createInitialFarmState()
    expect(() => assignFarmOutfit(initial, 'plot-1', 'missing', OWNED)).toThrow(/not owned/)
    expect(() => assignFarmOutfit(initial, 'plot-2', 'outfit-a', OWNED)).toThrow(/locked/)

    const openTwo = { ...initial, workers: { 'outfit-a': { level: 2, exp: 0 } } }
    const first = assignFarmOutfit(openTwo, 'plot-1', 'outfit-a', OWNED)
    expect(() => assignFarmOutfit(first, 'plot-2', 'outfit-a', OWNED)).toThrow(/already assigned/)
    const parallel = assignFarmOutfit(first, 'plot-2', 'outfit-b', OWNED)
    expect(parallel.plots.slice(0, 2).map((plot) => plot.templateId)).toEqual(['outfit-a', 'outfit-b'])
    expect(unassignFarmOutfit(parallel, 'plot-2').plots[1]?.templateId).toBeNull()
  })

  it('reports outfit and aggregate crop locks separately', () => {
    const outfitBlocked = assignedFarm()
    expect(canPlant(outfitBlocked, 'plot-1', crop(2), OWNED)).toEqual({
      ok: false, reason: 'outfit-level-required', requiredLevel: 2,
    })
    const farmBlocked = assignedFarm({ level: 5, exp: 0 })
    expect(canPlant(farmBlocked, 'plot-1', crop(4), OWNED)).toEqual({
      ok: false, reason: 'farm-level-required', requiredLevel: 7,
    })
    const eligible = assignedFarm({ level: 2, exp: 0 })
    expect(canPlant(eligible, 'plot-1', crop(2), OWNED)).toMatchObject({
      ok: true, templateId: 'outfit-a', outfitLevel: 2, farmLevel: 2,
    })
  })

  it('plants deterministic monotonic cycles without mutating its input', () => {
    const farm = assignedFarm()
    const before = structuredClone(farm)
    const planted = plantPlot({ farm, plotId: 'plot-1', crop: crop(1), ownedTemplateIds: OWNED, now: 5_000 })
    expect(farm).toEqual(before)
    expect(planted.cycleId).toBe('farm:plot-1:1')
    expect(planted.readyAt).toBe(5_000 + FARM_GROWTH_MS)
    expect(plotStatus(planted.farm, 'plot-1', planted.readyAt - 1)).toBe('growing')
    expect(plotStatus(planted.farm, 'plot-1', planted.readyAt)).toBe('ready')
    expect(() => assignFarmOutfit(planted.farm, 'plot-1', 'outfit-b', OWNED)).toThrow(/cannot change/)
    expect(() => plantPlot({ ...planted, plotId: 'plot-1', crop: crop(1), ownedTemplateIds: OWNED, now: 6_000 }))
      .toThrow(/plot-busy/)
  })

  it('harvests one item and 12 XP, retains the worker, and exposes crossed unlocks', () => {
    const farm = assignedFarm({ level: 1, exp: 36 })
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
      outfitLevelBefore: 1, outfitLevelAfter: 2, levelsCrossed: [2], farmLevelBefore: 1, farmLevelAfter: 2,
      plotsUnlocked: ['plot-2'], cropTiersUnlocked: [2],
    })
    expect(result.farm.plots[0]).toMatchObject({
      templateId: 'outfit-a', lastCropId: 'produce:t1:speed', attempt: 1, cycle: null,
    })
    expect(farmWorkerProgress(result.farm, 'outfit-a')).toEqual({ level: 2, exp: 0 })
    expect(plotStatus(result.farm, 'plot-1', planted.readyAt)).toBe('idle')
  })

  it('clamps harvested XP at Farming Level 20', () => {
    const farm = assignedFarm({ level: 20, exp: 0 })
    const planted = plantPlot({ farm, plotId: 'plot-1', crop: crop(1), ownedTemplateIds: OWNED, now: 0 })
    const result = harvestPlot({
      farm: planted.farm, plotId: 'plot-1', cycleId: planted.cycleId, crop: crop(1), now: planted.readyAt,
    })
    expect(farmWorkerProgress(result.farm, 'outfit-a')).toEqual({ level: 20, exp: 0 })
    expect(result.levelsCrossed).toEqual([])
  })
})

