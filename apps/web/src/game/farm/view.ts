// Pure Stable Farm presentation rules (docs/design/farm.md#screen-contract, T084).

import {
  FARM_CROP_LEVEL_REQUIREMENTS,
  FARM_OUTFIT_LEVEL_REQUIREMENTS,
  FARM_PLOT_IDS,
  FARM_PLOT_LEVEL_REQUIREMENTS,
  farmingXpToNext,
  type FarmCropDefinition,
  type FarmPlotId,
  type FarmPlotStatus,
  type OutfitFarmingProgress,
} from '@racer/domain'
import type { FarmPlotView, FarmView } from './host'

export interface FarmHomeSummary {
  farmLevel: number
  ready: number
  working: number
  unlocked: number
  deadline: number | null
  deadlineLabel: string
  nextPlotUnlock: string
  nextCropUnlock: string
}

export interface FarmWorkerIdentity {
  id: string
  name: string
  outfit: string | null
}

export interface FarmWorkerRow extends FarmWorkerIdentity {
  progress: OutfitFarmingProgress
  plotId: FarmPlotId | null
  xpToNext: number
}

export type FarmCropAvailability =
  | { available: true }
  | { available: false; farmLevelRequired: number | null; outfitLevelRequired: number | null }

export function presentedPlotStatus(plot: FarmPlotView, farmLevel: number, now: number): FarmPlotStatus {
  const index = FARM_PLOT_IDS.indexOf(plot.id)
  if (farmLevel < FARM_PLOT_LEVEL_REQUIREMENTS[index]!) return 'locked'
  if (plot.templateId === null) return 'unassigned'
  if (plot.cycle === null) return 'idle'
  return now >= plot.cycle.readyAt ? 'ready' : 'growing'
}

export function formatFarmRemaining(deadline: number | null, now: number): string {
  if (deadline === null) return 'No crops growing'
  if (deadline <= now) return 'Ready now'
  const minutes = Math.max(1, Math.ceil((deadline - now) / 60_000))
  if (minutes < 60) return `${minutes}m remaining`
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return rest === 0 ? `${hours}h remaining` : `${hours}h ${rest}m remaining`
}

export function buildFarmHomeSummary(view: FarmView, now: number): FarmHomeSummary {
  const statuses = view.plots.map((plot) => presentedPlotStatus(plot, view.farmLevel, now))
  const unlocked = statuses.filter((status) => status !== 'locked').length
  const ready = statuses.filter((status) => status === 'ready').length
  const working = statuses.filter((status) => status === 'growing' || status === 'ready').length
  const growingDeadlines = view.plots.flatMap((plot, index) => {
    if (statuses[index] !== 'growing' || plot.cycle === null) return []
    return [plot.cycle.readyAt]
  })
  const deadline = ready > 0 ? now : growingDeadlines.length > 0 ? Math.min(...growingDeadlines) : null
  const nextPlotIndex = FARM_PLOT_LEVEL_REQUIREMENTS.findIndex((level) => level > view.farmLevel)
  const nextCropIndex = FARM_CROP_LEVEL_REQUIREMENTS.findIndex((level) => level > view.farmLevel)
  return {
    farmLevel: view.farmLevel,
    ready,
    working,
    unlocked,
    deadline,
    deadlineLabel: formatFarmRemaining(deadline, now),
    nextPlotUnlock: nextPlotIndex < 0
      ? 'All plots unlocked'
      : `Plot ${nextPlotIndex + 1} at Farm Lv${FARM_PLOT_LEVEL_REQUIREMENTS[nextPlotIndex]}`,
    nextCropUnlock: nextCropIndex < 0
      ? 'All crop rows unlocked'
      : `Scenario ${nextCropIndex + 1} crops at Farm Lv${FARM_CROP_LEVEL_REQUIREMENTS[nextCropIndex]}`,
  }
}

export function buildFarmWorkerRows(view: FarmView, identities: readonly FarmWorkerIdentity[]): FarmWorkerRow[] {
  const plotByWorker = new Map(view.plots.flatMap((plot) => plot.templateId ? [[plot.templateId, plot.id] as const] : []))
  return identities.flatMap((identity) => {
    const progress = view.workers[identity.id]
    if (!progress) return []
    return [{ ...identity, progress, plotId: plotByWorker.get(identity.id) ?? null,
      xpToNext: farmingXpToNext(progress.level) }]
  }).sort((left, right) =>
    right.progress.level - left.progress.level || left.name.localeCompare(right.name) ||
    (left.outfit ?? '').localeCompare(right.outfit ?? '') || left.id.localeCompare(right.id))
}

export function cropAvailability(
  crop: FarmCropDefinition,
  progress: OutfitFarmingProgress,
  farmLevel: number,
): FarmCropAvailability {
  const farmLevelRequired = farmLevel < crop.farmLevelRequired ? crop.farmLevelRequired : null
  const outfitLevelRequired = progress.level < crop.outfitLevelRequired ? crop.outfitLevelRequired : null
  return farmLevelRequired === null && outfitLevelRequired === null
    ? { available: true }
    : { available: false, farmLevelRequired, outfitLevelRequired }
}

export function farmPlantConfirmation(input: {
  workerName: string
  outfit: string | null
  crop: FarmCropDefinition
  plotId: FarmPlotId
  readyAt: number
  formatTime?: (time: number) => string
}): string {
  const formatTime = input.formatTime ?? ((time: number) => new Date(time).toLocaleString([], {
    weekday: 'short', hour: 'numeric', minute: '2-digit',
  }))
  return `${input.workerName} · ${input.outfit ?? 'Standard outfit'} will grow ${input.crop.name} for ${input.crop.stat} in ${input.plotId.replace('plot-', 'Plot ')}. Ready ${formatTime(input.readyAt)}.`
}

export function nextOutfitCropUnlock(level: number): string {
  const index = FARM_OUTFIT_LEVEL_REQUIREMENTS.findIndex((required) => required > level)
  return index < 0 ? 'All scenario crops unlocked' : `Scenario ${index + 1} at Farming Lv${FARM_OUTFIT_LEVEL_REQUIREMENTS[index]}`
}
