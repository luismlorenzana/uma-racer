// Pure Stable Farm presentation rules (docs/design/farm.md#screen-contract, T084, D234).

import {
  FARM_CROP_TIERS,
  FARM_FASTEST_GROWTH_MINUTES,
  FARM_PLOTS_PER_SECTION,
  cropGrowthMinutes,
  cropTierOpenLevel,
  farmPlotNumber,
  farmPlotRequirement,
  farmSectionOf,
  farmingXpToNext,
  highestCropTier,
  plotLevelRequirement,
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
  /** The Farm Level that opens the next plot. */
  nextPlotLevel: number
}

export interface FarmSectionSummary {
  section: number
  plots: FarmPlotView[]
  statuses: FarmPlotStatus[]
  unlocked: number
  ready: number
  growing: number
  /** Open plots with a worker and nothing planted. */
  idle: number
  /** Open plots with no worker. */
  unassigned: number
  /** The nearest growing deadline, or null. */
  nextReadyAt: number | null
  /** The Farm Level that opens this Section's first plot. */
  opensAt: number
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
  | { available: true; growthMinutes: number }
  | { available: false; outfitLevelRequired: number }

export function presentedPlotStatus(plot: FarmPlotView, farmLevel: number, now: number): FarmPlotStatus {
  if (farmLevel < plotLevelRequirement(plot.id)) return 'locked'
  if (plot.templateId === null) return 'unassigned'
  if (plot.cycle === null) return 'idle'
  return now >= plot.cycle.readyAt ? 'ready' : 'growing'
}

/** "Section 2 · Plot 3": plots are numbered within their Section of six. */
export function farmPlotLabel(plotId: FarmPlotId): string {
  const number = farmPlotNumber(plotId)!
  return `Section ${farmSectionOf(number)} · Plot ${(number - 1) % FARM_PLOTS_PER_SECTION + 1}`
}

/** "12h", "10h 48m", "8h". */
export function formatGrowthMinutes(minutes: number): string {
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  if (hours === 0) return `${rest}m`
  return rest === 0 ? `${hours}h` : `${hours}h ${rest}m`
}

/** A compact countdown for badges: "Ready", "45m", "10h 12m". */
export function formatFarmCountdown(deadline: number, now: number): string {
  if (deadline <= now) return 'Ready'
  return formatGrowthMinutes(Math.max(1, Math.ceil((deadline - now) / 60_000)))
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

function nextPlotUnlock(unlocked: number): string {
  const next = unlocked + 1
  return `${farmPlotLabel(`plot-${next}`)} at Farm Lv${farmPlotRequirement(next).toLocaleString()}`
}

export function buildFarmHomeSummary(view: FarmView, now: number): FarmHomeSummary {
  const statuses = view.plots.map((plot) => presentedPlotStatus(plot, view.farmLevel, now))
  const ready = statuses.filter((status) => status === 'ready').length
  const working = statuses.filter((status) => status === 'growing' || status === 'ready').length
  const growingDeadlines = view.plots.flatMap((plot, index) =>
    statuses[index] === 'growing' && plot.cycle !== null ? [plot.cycle.readyAt] : [])
  const deadline = ready > 0 ? now : growingDeadlines.length > 0 ? Math.min(...growingDeadlines) : null
  return {
    farmLevel: view.farmLevel,
    ready,
    working,
    unlocked: view.unlockedPlots,
    deadline,
    deadlineLabel: formatFarmRemaining(deadline, now),
    nextPlotUnlock: nextPlotUnlock(view.unlockedPlots),
    nextPlotLevel: farmPlotRequirement(view.unlockedPlots + 1),
  }
}

/** One summary per visible Section: every Section with an open plot, then the next (D234). */
export function buildFarmSections(view: FarmView, now: number): FarmSectionSummary[] {
  const sections: FarmSectionSummary[] = []
  for (let start = 0; start < view.plots.length; start += FARM_PLOTS_PER_SECTION) {
    const plots = view.plots.slice(start, start + FARM_PLOTS_PER_SECTION)
    const statuses = plots.map((plot) => presentedPlotStatus(plot, view.farmLevel, now))
    const growing = plots.flatMap((plot, index) => statuses[index] === 'growing' && plot.cycle ? [plot.cycle.readyAt] : [])
    const count = (status: FarmPlotStatus) => statuses.filter((entry) => entry === status).length
    sections.push({
      section: start / FARM_PLOTS_PER_SECTION + 1,
      plots,
      statuses,
      unlocked: plots.length - count('locked'),
      ready: count('ready'),
      growing: count('growing'),
      idle: count('idle'),
      unassigned: count('unassigned'),
      nextReadyAt: growing.length > 0 ? Math.min(...growing) : null,
      opensAt: farmPlotRequirement(start + 1),
    })
  }
  return sections
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

/** A crop row is the worker's alone to open; when she can grow it, her level decides how long it takes (D234). */
export function cropAvailability(crop: FarmCropDefinition, progress: OutfitFarmingProgress): FarmCropAvailability {
  const required = cropTierOpenLevel(crop.scenarioTier)
  return progress.level < required
    ? { available: false, outfitLevelRequired: required }
    : { available: true, growthMinutes: cropGrowthMinutes(crop.scenarioTier, progress.level) }
}

export function farmPlantConfirmation(input: {
  workerName: string
  outfit: string | null
  crop: FarmCropDefinition
  plotId: FarmPlotId
  growthMinutes: number
  readyAt: number
  formatTime?: (time: number) => string
}): string {
  const formatTime = input.formatTime ?? ((time: number) => new Date(time).toLocaleString([], {
    weekday: 'short', hour: 'numeric', minute: '2-digit',
  }))
  return `${input.workerName} · ${input.outfit ?? 'Standard outfit'} will grow ${input.crop.name} for ${input.crop.stat} in ${farmPlotLabel(input.plotId)}. Ready in ${formatGrowthMinutes(input.growthMinutes)}, ${formatTime(input.readyAt)}.`
}

export function nextOutfitCropUnlock(level: number): string {
  const highest = highestCropTier(level)
  return highest >= FARM_CROP_TIERS
    ? `Every scenario's crops are open`
    : `Scenario ${highest + 1} crops at Farming Lv${cropTierOpenLevel(highest + 1)}`
}

/** Her newest crop row and how fast she grows it: "Scenario 2 crops in 10h 48m". */
export function workerGrowthNote(level: number): string {
  const tier = highestCropTier(level)
  const minutes = cropGrowthMinutes(tier, level)
  return minutes === FARM_FASTEST_GROWTH_MINUTES
    ? `Scenario ${tier} crops in ${formatGrowthMinutes(minutes)}, her fastest`
    : `Scenario ${tier} crops in ${formatGrowthMinutes(minutes)}`
}
