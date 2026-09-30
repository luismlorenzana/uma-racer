import {
  FARM_CROPS,
  createInitialFarmState,
  defaultOutfitFarmingProgress,
  type FarmPlotId,
} from '@racer/domain/farm'
import { describe, expect, it } from 'vitest'
import type { FarmView } from './host'
import {
  buildFarmHomeSummary,
  buildFarmWorkerRows,
  cropAvailability,
  farmPlantConfirmation,
  formatFarmRemaining,
  presentedPlotStatus,
} from './view'

const NOW = 2_000_000_000_000

function farmView(input: {
  farmLevel?: number
  workers?: FarmView['workers']
  plots?: Partial<Record<FarmPlotId, Partial<FarmView['plots'][number]>>>
} = {}): FarmView {
  const state = createInitialFarmState()
  const farmLevel = input.farmLevel ?? 1
  const workers = input.workers ?? { 'synthetic-outfit-a': defaultOutfitFarmingProgress() }
  return {
    version: 3,
    state,
    farmLevel,
    workers,
    inventory: {},
    plots: state.plots.map((plot) => ({
      id: plot.id,
      status: 'locked',
      templateId: null,
      lastCropId: null,
      cycle: null,
      ...input.plots?.[plot.id],
    })),
  }
}

describe('Farm screen view model', () => {
  it('summarizes the one-plot start and every plot unlock without fabricating work', () => {
    expect(buildFarmHomeSummary(farmView(), NOW)).toMatchObject({
      farmLevel: 1, ready: 0, working: 0, unlocked: 1, deadline: null,
      nextPlotUnlock: 'Plot 2 at Farm Lv2', nextCropUnlock: 'Scenario 2 crops at Farm Lv2',
    })
    expect(buildFarmHomeSummary(farmView({ farmLevel: 42 }), NOW)).toMatchObject({
      unlocked: 6, nextPlotUnlock: 'All plots unlocked', nextCropUnlock: 'Scenario 10 crops at Farm Lv46',
    })
  })

  it('derives multiple growing plots, one or many ready plots and the nearest deadline from time', () => {
    const cycle = (id: string, readyAt: number) => ({ id, cropId: 'produce:t1:speed' as const, plantedAt: readyAt - 43_200_000, readyAt })
    const view = farmView({ farmLevel: 6, plots: {
      'plot-1': { templateId: 'synthetic-outfit-a', cycle: cycle('farm:plot-1:1', NOW + 80_000) },
      'plot-2': { templateId: 'synthetic-outfit-b', cycle: cycle('farm:plot-2:1', NOW + 40_000) },
      'plot-3': { templateId: 'synthetic-outfit-c', cycle: cycle('farm:plot-3:1', NOW - 1) },
    } })
    expect(buildFarmHomeSummary(view, NOW)).toMatchObject({ ready: 1, working: 3, unlocked: 3, deadline: NOW, deadlineLabel: 'Ready now' })
    expect(buildFarmHomeSummary(view, NOW - 100_000)).toMatchObject({ ready: 0, working: 3, deadline: NOW - 1 })
  })

  it('keeps outfit identity, parallel outfits and assignment while sorting by level then name/outfit', () => {
    const view = farmView({ farmLevel: 3, workers: {
      'synthetic-dress-a': { level: 2, exp: 3 },
      'synthetic-dress-b': { level: 2, exp: 0 },
      'synthetic-other': { level: 1, exp: 0 },
    }, plots: { 'plot-1': { templateId: 'synthetic-dress-b' } } })
    const rows = buildFarmWorkerRows(view, [
      { id: 'synthetic-dress-b', name: 'Synthetic Star', outfit: 'Winter' },
      { id: 'synthetic-other', name: 'Another Uma', outfit: null },
      { id: 'synthetic-dress-a', name: 'Synthetic Star', outfit: 'Classic' },
      { id: 'missing-art-outfit', name: 'Missing Art', outfit: 'Long Outfit Name' },
    ])
    expect(rows.map((row) => [row.id, row.plotId])).toEqual([
      ['synthetic-dress-a', null], ['synthetic-dress-b', 'plot-1'], ['synthetic-other', null],
    ])
  })

  it('names Farm and outfit locks independently and writes exact confirmation copy', () => {
    const crop = FARM_CROPS.find((entry) => entry.scenarioTier === 4 && entry.stat === 'power')!
    expect(cropAvailability(crop, { level: 3, exp: 0 }, 4)).toEqual({
      available: false, farmLevelRequired: 7, outfitLevelRequired: 5,
    })
    expect(cropAvailability(crop, { level: 5, exp: 0 }, 7)).toEqual({ available: true })
    expect(farmPlantConfirmation({ workerName: 'Synthetic Star', outfit: 'Classic', crop, plotId: 'plot-2', readyAt: NOW,
      formatTime: () => 'Thursday at 8:00 PM' })).toBe(
      'Synthetic Star · Classic will grow Onion for power in Plot 2. Ready Thursday at 8:00 PM.',
    )
  })

  it('presents status and rounded remaining time without relying on persisted status', () => {
    const plot = farmView({ farmLevel: 2, plots: { 'plot-2': { templateId: 'synthetic-outfit-a', cycle: {
      id: 'farm:plot-2:1', cropId: 'produce:t1:speed', plantedAt: NOW, readyAt: NOW + 3_610_000,
    } } } }).plots[1]!
    expect(presentedPlotStatus(plot, 1, NOW)).toBe('locked')
    expect(presentedPlotStatus(plot, 2, NOW)).toBe('growing')
    expect(presentedPlotStatus(plot, 2, NOW + 3_610_000)).toBe('ready')
    expect(formatFarmRemaining(NOW + 3_610_000, NOW)).toBe('1h 1m remaining')
  })
})
