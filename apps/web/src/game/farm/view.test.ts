import {
  FARM_CROPS,
  createInitialFarmState,
  defaultOutfitFarmingProgress,
  unlockedPlotCount,
  type FarmPlotId,
} from '@racer/domain/farm'
import { describe, expect, it } from 'vitest'
import { visibleFarmPlotCount, type FarmView } from './host'
import {
  buildFarmHomeSummary,
  buildFarmSections,
  buildFarmWorkerRows,
  cropAvailability,
  farmPlantConfirmation,
  farmPlotLabel,
  formatFarmRemaining,
  formatGrowthMinutes,
  nextOutfitCropUnlock,
  presentedPlotStatus,
  workerGrowthNote,
} from './view'

const NOW = 2_000_000_000_000

function farmView(input: {
  farmLevel?: number
  workers?: FarmView['workers']
  plots?: Partial<Record<FarmPlotId, Partial<FarmView['plots'][number]>>>
} = {}): FarmView {
  const state = createInitialFarmState()
  const farmLevel = input.farmLevel ?? 1
  const unlockedPlots = unlockedPlotCount(farmLevel)
  const workers = input.workers ?? { 'synthetic-outfit-a': defaultOutfitFarmingProgress() }
  return {
    version: 3,
    state,
    farmLevel,
    unlockedPlots,
    workers,
    inventory: {},
    plots: Array.from({ length: visibleFarmPlotCount(unlockedPlots) }, (_, index) => {
      const id: FarmPlotId = `plot-${index + 1}`
      return { id, status: 'locked', templateId: null, lastCropId: null, cycle: null, ...input.plots?.[id] }
    }),
  }
}

describe('Farm screen view model', () => {
  it('summarizes the one-plot start and names the next plot by Section', () => {
    expect(buildFarmHomeSummary(farmView(), NOW)).toMatchObject({
      farmLevel: 1, ready: 0, working: 0, unlocked: 1, deadline: null, nextPlotUnlock: 'Next: Section 1 · Plot 2 at Farm Lv3',
    })
    expect(buildFarmHomeSummary(farmView({ farmLevel: 111 }), NOW)).toMatchObject({
      unlocked: 6, nextPlotUnlock: 'Next: Section 2 · Plot 1 at Farm Lv183', nextPlotLevel: 183,
    })
    // Three Sections are the whole Farm (D237): nothing past them is shown or promised.
    const full = farmView({ farmLevel: 9_999 })
    expect(full.plots).toHaveLength(18)
    expect(buildFarmHomeSummary(full, NOW)).toMatchObject({ unlocked: 18, nextPlotUnlock: 'All 18 plots are open', nextPlotLevel: null })
    expect(buildFarmSections(farmView({ farmLevel: 1_013 }), NOW).map((entry) => entry.section)).toEqual([1, 2, 3])
  })

  it('derives multiple growing plots, one or many ready plots and the nearest deadline from time', () => {
    const cycle = (id: string, readyAt: number) => ({ id, cropId: 'produce:t1:speed' as const, plantedAt: readyAt - 43_200_000, readyAt })
    const view = farmView({ farmLevel: 11, plots: {
      'plot-1': { templateId: 'synthetic-outfit-a', cycle: cycle('farm:plot-1:1', NOW + 80_000) },
      'plot-2': { templateId: 'synthetic-outfit-b', cycle: cycle('farm:plot-2:1', NOW + 40_000) },
      'plot-3': { templateId: 'synthetic-outfit-c', cycle: cycle('farm:plot-3:1', NOW - 1) },
    } })
    expect(buildFarmHomeSummary(view, NOW)).toMatchObject({ ready: 1, working: 3, unlocked: 3, deadline: NOW, deadlineLabel: 'Ready now' })
    expect(buildFarmHomeSummary(view, NOW - 100_000)).toMatchObject({ ready: 0, working: 3, deadline: NOW - 1 })
  })

  it('shows every Section with an open plot, then the next one locked (D234)', () => {
    const view = farmView({ farmLevel: 183, plots: {
      'plot-1': { templateId: 'synthetic-outfit-a', cycle: { id: 'farm:plot-1:1', cropId: 'produce:t1:speed', plantedAt: NOW - 1_000, readyAt: NOW - 1 } },
      'plot-2': { templateId: 'synthetic-outfit-b', cycle: { id: 'farm:plot-2:1', cropId: 'produce:t1:speed', plantedAt: NOW, readyAt: NOW + 60_000 } },
      'plot-7': { templateId: 'synthetic-outfit-c' },
    } })
    const sections = buildFarmSections(view, NOW)
    expect(sections.map((entry) => [entry.section, entry.unlocked, entry.ready, entry.growing, entry.idle, entry.unassigned, entry.opensAt]))
      .toEqual([[1, 6, 1, 1, 0, 4, 1], [2, 1, 0, 0, 1, 0, 183], [3, 0, 0, 0, 0, 0, 1_301]])
    expect(sections[0]!.nextReadyAt).toBe(NOW + 60_000)
    expect(sections[1]!.statuses).toEqual(['idle', 'locked', 'locked', 'locked', 'locked', 'locked'])
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
    expect(rows.map((row) => [row.id, row.plotId, row.xpToNext])).toEqual([
      ['synthetic-dress-a', null, 24], ['synthetic-dress-b', 'plot-1', 24], ['synthetic-other', null, 24],
    ])
  })

  it('gates crops on the worker alone, times them by her level, and writes exact confirmation copy', () => {
    const crop = FARM_CROPS.find((entry) => entry.scenarioTier === 4 && entry.stat === 'power')!
    expect(cropAvailability(crop, { level: 29, exp: 0 })).toEqual({ available: false, outfitLevelRequired: 30 })
    expect(cropAvailability(crop, { level: 35, exp: 0 })).toEqual({ available: true, growthMinutes: 525 })
    // An older row is 7h 30m whatever her level.
    expect(cropAvailability(crop, { level: 40, exp: 0 })).toEqual({ available: true, growthMinutes: 450 })
    expect(farmPlantConfirmation({ workerName: 'Synthetic Star', outfit: 'Classic', crop, plotId: 'plot-8', growthMinutes: 648,
      readyAt: NOW, formatTime: () => 'Thursday at 8:00 PM' })).toBe(
      'Synthetic Star · Classic will grow Onion for power in Section 2 · Plot 2. Ready in 10h 48m, Thursday at 8:00 PM.',
    )
    expect([farmPlotLabel('plot-6'), farmPlotLabel('plot-13')]).toEqual(['Section 1 · Plot 6', 'Section 3 · Plot 1'])
    expect([formatGrowthMinutes(720), formatGrowthMinutes(648), formatGrowthMinutes(480)]).toEqual(['12h', '10h 48m', '8h'])
    expect([nextOutfitCropUnlock(9), nextOutfitCropUnlock(130)]).toEqual(['Scenario 2 crops at Farming Lv10', "Every scenario's crops are open"])
    expect([workerGrowthNote(1), workerGrowthNote(9), workerGrowthNote(12), workerGrowthNote(140)]).toEqual([
      'Scenario 1 crops in 10h', 'Scenario 1 crops in 8h', 'Scenario 2 crops in 9h 30m · older 7h 30m', 'Every crop in 7h 30m, her fastest',
    ])
  })

  it('presents status and rounded remaining time without relying on persisted status', () => {
    const plot = farmView({ farmLevel: 3, plots: { 'plot-2': { templateId: 'synthetic-outfit-a', cycle: {
      id: 'farm:plot-2:1', cropId: 'produce:t1:speed', plantedAt: NOW, readyAt: NOW + 3_610_000,
    } } } }).plots[1]!
    expect(presentedPlotStatus(plot, 2, NOW)).toBe('locked')
    expect(presentedPlotStatus(plot, 3, NOW)).toBe('growing')
    expect(presentedPlotStatus(plot, 3, NOW + 3_610_000)).toBe('ready')
    expect(formatFarmRemaining(NOW + 3_610_000, NOW)).toBe('1h 1m remaining')
  })
})
