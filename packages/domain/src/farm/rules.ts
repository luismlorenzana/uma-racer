// Pure Stable Farm assignment, planting, readiness, and harvest rules (docs/design/farm.md, T082, D234).

import {
  FARM_CROP_YIELD,
  FARM_SCHEMA_VERSION,
  FARMING_EXP_PER_HARVEST,
  type FarmPlotId,
} from './constants'
import {
  applyFarmingXp,
  cropGrowthMs,
  cropTierOpenLevel,
  cropTiersUnlockedBetween,
  defaultOutfitFarmingProgress,
  farmLevel,
  farmPlotNumber,
  isPlotUnlocked,
  plotsUnlockedBetween,
} from './progression'
import {
  FARM_SAFE_ID_PATTERN,
  isEmptyFarmPlot,
  parseFarmCropDefinition,
  type FarmCropDefinition,
  type FarmHarvestMovement,
  type FarmPlot,
  type FarmState,
  type OutfitFarmingProgress,
} from './types'

export type FarmPlotStatus = 'locked' | 'unassigned' | 'idle' | 'growing' | 'ready'

export type FarmPlantBlockReason =
  | 'plot-locked'
  | 'plot-unassigned'
  | 'plot-busy'
  | 'outfit-unowned'
  | 'outfit-assigned-elsewhere'
  | 'outfit-level-required'

export type FarmPlantCheck =
  | { ok: true; templateId: string; outfitLevel: number; farmLevel: number; growthMs: number }
  | { ok: false; reason: FarmPlantBlockReason; requiredLevel?: number }

export interface PlantFarmInput {
  farm: FarmState
  plotId: FarmPlotId
  crop: FarmCropDefinition
  ownedTemplateIds: ReadonlySet<string>
  now: number
}

export interface PlantFarmResult {
  farm: FarmState
  cycleId: string
  readyAt: number
}

export interface HarvestFarmInput {
  farm: FarmState
  plotId: FarmPlotId
  cycleId: string
  crop: FarmCropDefinition
  now: number
}

export interface HarvestFarmResult {
  farm: FarmState
  movement: FarmHarvestMovement
  outfitLevelBefore: number
  outfitLevelAfter: number
  levelsCrossed: number[]
  farmLevelBefore: number
  farmLevelAfter: number
  plotsUnlocked: FarmPlotId[]
  cropTiersUnlocked: number[]
}

export class FarmRuleError extends Error {
  constructor(
    public readonly code: FarmPlantBlockReason | 'invalid-farm-command' | 'cycle-missing' | 'cycle-mismatch' | 'crop-mismatch' | 'crop-not-ready',
    message: string,
  ) {
    super(message)
    this.name = 'FarmRuleError'
  }
}

const validNow = (now: number): boolean => Number.isSafeInteger(now) && now >= 0

const copyPlot = (plot: FarmPlot): FarmPlot => ({
  ...plot,
  cycle: plot.cycle === null ? null : { ...plot.cycle },
})

const plotOrder = (left: FarmPlot, right: FarmPlot): number => farmPlotNumber(left.id)! - farmPlotNumber(right.id)!

/** Writes one plot back in plot order; an empty never-planted plot is not stored (D234). */
function replacePlot(farm: FarmState, replacement: FarmPlot): FarmState {
  const others = farm.plots.filter((plot) => plot.id !== replacement.id).map(copyPlot)
  return {
    ...farm,
    plots: (isEmptyFarmPlot(replacement) ? others : [...others, replacement]).sort(plotOrder),
    workers: Object.fromEntries(Object.entries(farm.workers).map(([id, progress]) => [id, { ...progress }])),
  }
}

function replaceWorker(farm: FarmState, templateId: string, progress: OutfitFarmingProgress): FarmState {
  const workers: Array<[string, OutfitFarmingProgress]> = [
    ...Object.entries(farm.workers).filter(([id]) => id !== templateId),
    [templateId, progress],
  ]
  return {
    ...farm,
    plots: farm.plots.map(copyPlot),
    workers: Object.fromEntries(workers.sort(([left], [right]) => left.localeCompare(right))),
  }
}

/** Every plot reads as stored, or as an empty never-planted plot when nothing is stored for it. */
export function farmPlot(farm: FarmState, plotId: FarmPlotId): FarmPlot {
  if (farmPlotNumber(plotId) === null) throw new FarmRuleError('invalid-farm-command', `Farm plot is invalid: ${plotId}`)
  const plot = farm.plots.find((candidate) => candidate.id === plotId)
  return plot ? copyPlot(plot) : { id: plotId, templateId: null, lastCropId: null, attempt: 0, cycle: null }
}

const requirePlot = farmPlot

function requireTemplateId(templateId: string): void {
  if (!FARM_SAFE_ID_PATTERN.test(templateId)) throw new FarmRuleError('invalid-farm-command', 'Outfit id is unsafe')
}

export function createInitialFarmState(): FarmState {
  return {
    schemaVersion: FARM_SCHEMA_VERSION,
    plots: [],
    workers: {},
  }
}

export const farmWorkerProgress = (farm: FarmState, templateId: string): OutfitFarmingProgress =>
  farm.workers[templateId] ? { ...farm.workers[templateId]! } : defaultOutfitFarmingProgress()

export function plotStatus(farm: FarmState, plotId: FarmPlotId, now: number): FarmPlotStatus {
  if (!validNow(now)) throw new FarmRuleError('invalid-farm-command', 'Farm clock is invalid')
  const plot = requirePlot(farm, plotId)
  if (!isPlotUnlocked(plotId, farmLevel(farm.workers))) return 'locked'
  if (plot.templateId === null) return 'unassigned'
  if (plot.cycle === null) return 'idle'
  return now >= plot.cycle.readyAt ? 'ready' : 'growing'
}

export function assignFarmOutfit(
  farm: FarmState,
  plotId: FarmPlotId,
  templateId: string,
  ownedTemplateIds: ReadonlySet<string>,
): FarmState {
  requireTemplateId(templateId)
  const plot = requirePlot(farm, plotId)
  if (!isPlotUnlocked(plotId, farmLevel(farm.workers))) throw new FarmRuleError('plot-locked', 'Farm plot is locked')
  if (plot.cycle !== null) throw new FarmRuleError('plot-busy', 'A growing or ready plot cannot change workers')
  if (!ownedTemplateIds.has(templateId)) throw new FarmRuleError('outfit-unowned', 'Farm worker is not owned')
  if (farm.plots.some((candidate) => candidate.id !== plotId && candidate.templateId === templateId)) {
    throw new FarmRuleError('outfit-assigned-elsewhere', 'Farm worker is already assigned')
  }
  if (plot.templateId === templateId) return replacePlot(farm, copyPlot(plot))
  return replacePlot(farm, { ...copyPlot(plot), templateId, lastCropId: null })
}

export function unassignFarmOutfit(farm: FarmState, plotId: FarmPlotId): FarmState {
  const plot = requirePlot(farm, plotId)
  if (!isPlotUnlocked(plotId, farmLevel(farm.workers))) throw new FarmRuleError('plot-locked', 'Farm plot is locked')
  if (plot.cycle !== null) throw new FarmRuleError('plot-busy', 'A growing or ready plot cannot change workers')
  return replacePlot(farm, { ...copyPlot(plot), templateId: null, lastCropId: null })
}

export function canPlant(
  farm: FarmState,
  plotId: FarmPlotId,
  crop: FarmCropDefinition,
  ownedTemplateIds: ReadonlySet<string>,
): FarmPlantCheck {
  const plot = requirePlot(farm, plotId)
  const accountFarmLevel = farmLevel(farm.workers)
  if (!isPlotUnlocked(plotId, accountFarmLevel)) return { ok: false, reason: 'plot-locked' }
  if (plot.templateId === null) return { ok: false, reason: 'plot-unassigned' }
  if (plot.cycle !== null) return { ok: false, reason: 'plot-busy' }
  if (!ownedTemplateIds.has(plot.templateId)) return { ok: false, reason: 'outfit-unowned' }
  if (farm.plots.some((candidate) => candidate.id !== plotId && candidate.templateId === plot.templateId)) {
    return { ok: false, reason: 'outfit-assigned-elsewhere' }
  }
  const outfitLevel = farmWorkerProgress(farm, plot.templateId).level
  const required = cropTierOpenLevel(crop.scenarioTier)
  if (outfitLevel < required) return { ok: false, reason: 'outfit-level-required', requiredLevel: required }
  return { ok: true, templateId: plot.templateId, outfitLevel, farmLevel: accountFarmLevel,
    growthMs: cropGrowthMs(crop.scenarioTier, outfitLevel) }
}

export function plantPlot(input: PlantFarmInput): PlantFarmResult {
  if (!validNow(input.now) || !parseFarmCropDefinition(input.crop)) {
    throw new FarmRuleError('invalid-farm-command', 'Farm planting input is invalid')
  }
  const check = canPlant(input.farm, input.plotId, input.crop, input.ownedTemplateIds)
  if (!check.ok) throw new FarmRuleError(check.reason, `Farm crop cannot be planted: ${check.reason}`)
  const plot = requirePlot(input.farm, input.plotId)
  const attempt = plot.attempt + 1
  // Her level when planted decides the time, which the cycle then keeps (D234).
  const readyAt = input.now + check.growthMs
  if (!Number.isSafeInteger(attempt) || !Number.isSafeInteger(readyAt)) {
    throw new FarmRuleError('invalid-farm-command', 'Farm cycle counter overflow')
  }
  const cycleId = `farm:${plot.id}:${attempt}`
  return {
    farm: replacePlot(input.farm, {
      ...copyPlot(plot),
      attempt,
      cycle: { id: cycleId, cropId: input.crop.id, plantedAt: input.now, readyAt },
    }),
    cycleId,
    readyAt,
  }
}

export function harvestPlot(input: HarvestFarmInput): HarvestFarmResult {
  if (!validNow(input.now) || !parseFarmCropDefinition(input.crop)) {
    throw new FarmRuleError('invalid-farm-command', 'Farm harvest input is invalid')
  }
  const plot = requirePlot(input.farm, input.plotId)
  if (plot.templateId === null || plot.cycle === null) throw new FarmRuleError('cycle-missing', 'Farm cycle is missing')
  if (plot.cycle.id !== input.cycleId) throw new FarmRuleError('cycle-mismatch', 'Farm cycle changed')
  if (plot.cycle.cropId !== input.crop.id) throw new FarmRuleError('crop-mismatch', 'Farm crop changed')
  if (input.now < plot.cycle.readyAt) throw new FarmRuleError('crop-not-ready', 'Farm crop is not ready')

  const before = farmWorkerProgress(input.farm, plot.templateId)
  const beforeFarmLevel = farmLevel(input.farm.workers)
  const applied = applyFarmingXp(before, FARMING_EXP_PER_HARVEST)
  const withWorker = replaceWorker(input.farm, plot.templateId, applied.progress)
  const afterFarmLevel = farmLevel(withWorker.workers)
  const farm = replacePlot(withWorker, { ...copyPlot(plot), lastCropId: input.crop.id, cycle: null })
  const movement: FarmHarvestMovement = {
    id: input.cycleId,
    itemId: input.crop.id,
    delta: FARM_CROP_YIELD,
    reason: 'farm-harvest',
    source: {
      kind: 'farm-harvest',
      plotId: plot.id,
      cycleId: input.cycleId,
      templateId: plot.templateId,
      farmingExp: FARMING_EXP_PER_HARVEST,
    },
    createdAt: input.now,
  }
  return {
    farm,
    movement,
    outfitLevelBefore: before.level,
    outfitLevelAfter: applied.progress.level,
    levelsCrossed: applied.levelsCrossed,
    farmLevelBefore: beforeFarmLevel,
    farmLevelAfter: afterFarmLevel,
    plotsUnlocked: plotsUnlockedBetween(beforeFarmLevel, afterFarmLevel),
    cropTiersUnlocked: cropTiersUnlockedBetween(before.level, applied.progress.level),
  }
}

export interface HastenFarmResult {
  farm: FarmState
  /** The growing plots whose crops moved earlier, in plot order. */
  plotIds: FarmPlotId[]
}

/**
 * A playtesting shortcut (D238): every crop still growing at `now` moves `ms` earlier, its planting and its deadline
 * together, so each cycle keeps the duration it was planted with and the save stays valid. Ready crops are left alone.
 */
export function hastenGrowingCrops(farm: FarmState, ms: number, now: number): HastenFarmResult {
  if (!validNow(now) || !Number.isSafeInteger(ms) || ms <= 0) {
    throw new FarmRuleError('invalid-farm-command', 'Farm hasten input is invalid')
  }
  const plotIds: FarmPlotId[] = []
  const plots = farm.plots.map((plot) => {
    const cycle = plot.cycle
    if (cycle === null || cycle.readyAt <= now || cycle.plantedAt < ms) return copyPlot(plot)
    plotIds.push(plot.id)
    return { ...plot, cycle: { ...cycle, plantedAt: cycle.plantedAt - ms, readyAt: cycle.readyAt - ms } }
  })
  return {
    farm: {
      ...farm,
      plots,
      workers: Object.fromEntries(Object.entries(farm.workers).map(([id, progress]) => [id, { ...progress }])),
    },
    plotIds,
  }
}
