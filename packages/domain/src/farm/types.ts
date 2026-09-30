// Strict data-only Stable Farm vocabulary (docs/design/farm.md, T082).

import { STATS, type StatKey } from '../types'
import {
  FARM_CROP_YIELD,
  FARM_GROWTH_HOURS,
  FARM_GROWTH_MS,
  FARM_PLOT_IDS,
  FARM_PLOT_LEVEL_REQUIREMENTS,
  FARM_SCHEMA_VERSION,
  FARMING_EXP_PER_HARVEST,
  MAX_FARM_WORKERS,
  MAX_OUTFIT_FARMING_LEVEL,
  type FarmPlotId,
} from './constants'

export type FarmCropId = `produce:t${number}:${StatKey}`

export interface FarmCropDefinition {
  id: FarmCropId
  name: string
  stat: StatKey
  scenarioTier: number
  outfitLevelRequired: number
  farmLevelRequired: number
  growthHours: typeof FARM_GROWTH_HOURS
  yield: typeof FARM_CROP_YIELD
  farmingExp: typeof FARMING_EXP_PER_HARVEST
}

export interface OutfitFarmingProgress {
  level: number
  exp: number
}

export interface FarmCycle {
  id: string
  cropId: FarmCropId
  plantedAt: number
  readyAt: number
}

export interface FarmPlot {
  id: FarmPlotId
  templateId: string | null
  lastCropId: FarmCropId | null
  attempt: number
  cycle: FarmCycle | null
}

export interface FarmState {
  schemaVersion: typeof FARM_SCHEMA_VERSION
  plots: FarmPlot[]
  workers: Record<string, OutfitFarmingProgress>
}

export interface FarmHarvestMovement {
  id: string
  itemId: FarmCropId
  delta: typeof FARM_CROP_YIELD
  reason: 'farm-harvest'
  source: {
    kind: 'farm-harvest'
    plotId: FarmPlotId
    cycleId: string
    templateId: string
    farmingExp: typeof FARMING_EXP_PER_HARVEST
  }
  createdAt: number
}

/** Synced data stored inside one versioned `items/{itemId}` entity. */
export interface InventoryStackData {
  itemId: string
  quantity: number
  updatedAt: number
}

export interface ConstellationProduceMovement {
  id: string
  itemId: FarmCropId
  delta: -1
  reason: 'constellation-produce'
  source: {
    kind: 'constellation-produce'
    umaId: string
    tier: number
    nodeId: string
    revision: number
  }
  createdAt: number
}

/** The Training Level-Up Ticket (D212): one Training Level's EXP, paid by the Training EXP bank. */
export const TRAINING_LEVEL_UP_TICKET_ID = 'training:level-up-ticket' as const

/** A spend of Level-Up Tickets on one unit, named by where it started so an exact retry finds its own evidence (D213). */
export interface TrainingLevelUpSource {
  kind: 'level-up'
  umaId: string
  tier: number
  fromLevel: number
  fromExp: number
}

/** Tickets the Training EXP bank paid out: from a Spark run past TL10, a settled bank, or a spend past TL10. */
export interface TrainingExpBankMovement {
  id: string
  itemId: typeof TRAINING_LEVEL_UP_TICKET_ID
  delta: number
  reason: 'exp-bank'
  source: { kind: 'spark-run'; runId: string } | { kind: 'bank-settle' } | TrainingLevelUpSource
  createdAt: number
}

/** Tickets spent on one unit's Training Levels (D213). */
export interface TrainingLevelUpMovement {
  id: string
  itemId: typeof TRAINING_LEVEL_UP_TICKET_ID
  delta: number
  reason: 'training-level-up'
  source: TrainingLevelUpSource
  createdAt: number
}

/** Append-only evidence from which item quantities and Farm harvest XP can be repaired. */
export type ItemLedgerEntry = FarmHarvestMovement | ConstellationProduceMovement | TrainingExpBankMovement | TrainingLevelUpMovement

type UnknownRecord = Record<string, unknown>

export const FARM_SAFE_ID_PATTERN = /^[A-Za-z0-9_.:-]{1,120}$/
export const FARM_CROP_ID_PATTERN = /^produce:t([1-9]|1[0-4]):(speed|stamina|power|guts|wit)$/

const isRecord = (value: unknown): value is UnknownRecord =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

function exactKeys(value: UnknownRecord, expected: readonly string[]): boolean {
  const actual = Object.keys(value).sort()
  const sorted = [...expected].sort()
  return actual.length === sorted.length && actual.every((key, index) => key === sorted[index])
}

const safeInteger = (value: unknown, minimum = 0): value is number =>
  Number.isSafeInteger(value) && (value as number) >= minimum

const cropId = (value: unknown): value is FarmCropId =>
  typeof value === 'string' && FARM_CROP_ID_PATTERN.test(value)

export function parseFarmCropDefinition(value: unknown): FarmCropDefinition | null {
  if (!isRecord(value) || !exactKeys(value, [
    'farmLevelRequired', 'farmingExp', 'growthHours', 'id', 'name', 'outfitLevelRequired', 'scenarioTier', 'stat', 'yield',
  ])) return null
  if (!cropId(value.id) || typeof value.name !== 'string' || value.name.length < 1 || value.name.length > 60 ||
    !STATS.includes(value.stat as StatKey) || !safeInteger(value.scenarioTier, 1) || value.scenarioTier > 14 ||
    !safeInteger(value.outfitLevelRequired, 1) || value.outfitLevelRequired > MAX_OUTFIT_FARMING_LEVEL ||
    !safeInteger(value.farmLevelRequired, 1) || value.growthHours !== FARM_GROWTH_HOURS ||
    value.yield !== FARM_CROP_YIELD || value.farmingExp !== FARMING_EXP_PER_HARVEST) return null
  const match = FARM_CROP_ID_PATTERN.exec(value.id)
  if (!match || Number(match[1]) !== value.scenarioTier || match[2] !== value.stat) return null
  return {
    id: value.id,
    name: value.name,
    stat: value.stat as StatKey,
    scenarioTier: value.scenarioTier,
    outfitLevelRequired: value.outfitLevelRequired,
    farmLevelRequired: value.farmLevelRequired,
    growthHours: FARM_GROWTH_HOURS,
    yield: FARM_CROP_YIELD,
    farmingExp: FARMING_EXP_PER_HARVEST,
  }
}

export function parseOutfitFarmingProgress(value: unknown): OutfitFarmingProgress | null {
  if (!isRecord(value) || !exactKeys(value, ['exp', 'level']) ||
    !safeInteger(value.level, 1) || value.level > MAX_OUTFIT_FARMING_LEVEL || !safeInteger(value.exp)) return null
  if (value.level === MAX_OUTFIT_FARMING_LEVEL) return value.exp === 0 ? { level: value.level, exp: 0 } : null
  const maximumExp = 48 + 12 * Math.floor((value.level - 1) / 4)
  if (value.exp >= maximumExp) return null
  return { level: value.level, exp: value.exp }
}

export function parseFarmCycle(value: unknown, plotId?: FarmPlotId, attempt?: number): FarmCycle | null {
  if (!isRecord(value) || !exactKeys(value, ['cropId', 'id', 'plantedAt', 'readyAt']) ||
    typeof value.id !== 'string' || !FARM_SAFE_ID_PATTERN.test(value.id) || !cropId(value.cropId) ||
    !safeInteger(value.plantedAt) || !safeInteger(value.readyAt) || value.readyAt - value.plantedAt !== FARM_GROWTH_MS) return null
  if (plotId !== undefined && attempt !== undefined && value.id !== `farm:${plotId}:${attempt}`) return null
  return { id: value.id, cropId: value.cropId, plantedAt: value.plantedAt, readyAt: value.readyAt }
}

export function parseFarmPlot(value: unknown): FarmPlot | null {
  if (!isRecord(value) || !exactKeys(value, ['attempt', 'cycle', 'id', 'lastCropId', 'templateId']) ||
    !FARM_PLOT_IDS.includes(value.id as FarmPlotId) || !safeInteger(value.attempt) ||
    !(value.templateId === null || (typeof value.templateId === 'string' && FARM_SAFE_ID_PATTERN.test(value.templateId))) ||
    !(value.lastCropId === null || cropId(value.lastCropId))) return null
  const id = value.id as FarmPlotId
  const cycle = value.cycle === null ? null : parseFarmCycle(value.cycle, id, value.attempt)
  if (value.cycle !== null && cycle === null) return null
  if (cycle !== null && value.attempt < 1) return null
  if (value.templateId === null && (value.lastCropId !== null || cycle !== null)) return null
  return { id, templateId: value.templateId, lastCropId: value.lastCropId, attempt: value.attempt, cycle }
}

export function parseFarmState(value: unknown): FarmState | null {
  if (!isRecord(value) || !exactKeys(value, ['plots', 'schemaVersion', 'workers']) ||
    value.schemaVersion !== FARM_SCHEMA_VERSION || !Array.isArray(value.plots) || value.plots.length !== FARM_PLOT_IDS.length ||
    !isRecord(value.workers)) return null
  const plots = value.plots.map(parseFarmPlot)
  if (plots.some((plot) => plot === null)) return null
  const checkedPlots = plots as FarmPlot[]
  if (checkedPlots.some((plot, index) => plot.id !== FARM_PLOT_IDS[index])) return null
  const assigned = checkedPlots.flatMap((plot) => plot.templateId === null ? [] : [plot.templateId])
  if (new Set(assigned).size !== assigned.length) return null
  const workerIds = Object.keys(value.workers)
  if (workerIds.length > MAX_FARM_WORKERS || workerIds.some((id) => !FARM_SAFE_ID_PATTERN.test(id))) return null
  const workers: Record<string, OutfitFarmingProgress> = {}
  for (const id of workerIds.sort()) {
    const progress = parseOutfitFarmingProgress(value.workers[id])
    if (!progress) return null
    workers[id] = progress
  }
  const accountFarmLevel = 1 + Object.values(workers).reduce((sum, progress) => sum + progress.level - 1, 0)
  if (checkedPlots.some((plot, index) => accountFarmLevel < FARM_PLOT_LEVEL_REQUIREMENTS[index]! &&
    (plot.templateId !== null || plot.lastCropId !== null || plot.cycle !== null))) return null
  return { schemaVersion: FARM_SCHEMA_VERSION, plots: checkedPlots, workers }
}

export function parseFarmHarvestMovement(value: unknown): FarmHarvestMovement | null {
  if (!isRecord(value) || !exactKeys(value, ['createdAt', 'delta', 'id', 'itemId', 'reason', 'source']) ||
    typeof value.id !== 'string' || !FARM_SAFE_ID_PATTERN.test(value.id) || !cropId(value.itemId) ||
    value.delta !== FARM_CROP_YIELD || value.reason !== 'farm-harvest' || !safeInteger(value.createdAt) ||
    !isRecord(value.source) || !exactKeys(value.source, ['cycleId', 'farmingExp', 'kind', 'plotId', 'templateId']) ||
    value.source.kind !== 'farm-harvest' || typeof value.source.cycleId !== 'string' || value.source.cycleId !== value.id ||
    !FARM_PLOT_IDS.includes(value.source.plotId as FarmPlotId) ||
    typeof value.source.templateId !== 'string' || !FARM_SAFE_ID_PATTERN.test(value.source.templateId) ||
    value.source.farmingExp !== FARMING_EXP_PER_HARVEST) return null
  return {
    id: value.id,
    itemId: value.itemId,
    delta: FARM_CROP_YIELD,
    reason: 'farm-harvest',
    source: {
      kind: 'farm-harvest',
      plotId: value.source.plotId as FarmPlotId,
      cycleId: value.source.cycleId,
      templateId: value.source.templateId,
      farmingExp: FARMING_EXP_PER_HARVEST,
    },
    createdAt: value.createdAt,
  }
}

export function parseInventoryStackData(value: unknown, expectedItemId?: string): InventoryStackData | null {
  if (!isRecord(value) || !exactKeys(value, ['itemId', 'quantity', 'updatedAt']) ||
    typeof value.itemId !== 'string' || !FARM_SAFE_ID_PATTERN.test(value.itemId) ||
    (expectedItemId !== undefined && value.itemId !== expectedItemId) ||
    !safeInteger(value.quantity) || !safeInteger(value.updatedAt)) return null
  return { itemId: value.itemId, quantity: value.quantity, updatedAt: value.updatedAt }
}

function parseTrainingLevelUpSource(value: unknown): TrainingLevelUpSource | null {
  if (!isRecord(value) || !exactKeys(value, ['fromExp', 'fromLevel', 'kind', 'tier', 'umaId']) || value.kind !== 'level-up' ||
    typeof value.umaId !== 'string' || !FARM_SAFE_ID_PATTERN.test(value.umaId) || !safeInteger(value.tier, 1) ||
    value.tier > 14 || !safeInteger(value.fromLevel, 1) || value.fromLevel > 9 || !safeInteger(value.fromExp)) return null
  return { kind: 'level-up', umaId: value.umaId, tier: value.tier, fromLevel: value.fromLevel, fromExp: value.fromExp }
}

function parseTrainingTicketMovement(value: unknown): TrainingExpBankMovement | TrainingLevelUpMovement | null {
  if (!isRecord(value) || !exactKeys(value, ['createdAt', 'delta', 'id', 'itemId', 'reason', 'source']) ||
    typeof value.id !== 'string' || !FARM_SAFE_ID_PATTERN.test(value.id) || value.itemId !== TRAINING_LEVEL_UP_TICKET_ID ||
    !safeInteger(value.createdAt) || !isRecord(value.source)) return null
  if (value.reason === 'training-level-up') {
    const source = parseTrainingLevelUpSource(value.source)
    if (!source || !Number.isSafeInteger(value.delta) || (value.delta as number) >= 0) return null
    return { id: value.id, itemId: TRAINING_LEVEL_UP_TICKET_ID, delta: value.delta as number, reason: 'training-level-up', source, createdAt: value.createdAt }
  }
  if (value.reason !== 'exp-bank' || !safeInteger(value.delta, 1)) return null
  let source: TrainingExpBankMovement['source'] | null = null
  if (value.source.kind === 'spark-run') {
    source = exactKeys(value.source, ['kind', 'runId']) && typeof value.source.runId === 'string' &&
      FARM_SAFE_ID_PATTERN.test(value.source.runId) ? { kind: 'spark-run', runId: value.source.runId } : null
  } else if (value.source.kind === 'bank-settle') {
    source = exactKeys(value.source, ['kind']) ? { kind: 'bank-settle' } : null
  } else {
    source = parseTrainingLevelUpSource(value.source)
  }
  return source
    ? { id: value.id, itemId: TRAINING_LEVEL_UP_TICKET_ID, delta: value.delta, reason: 'exp-bank', source, createdAt: value.createdAt }
    : null
}

export function parseItemLedgerEntry(value: unknown): ItemLedgerEntry | null {
  const harvest = parseFarmHarvestMovement(value)
  if (harvest) return harvest
  const training = parseTrainingTicketMovement(value)
  if (training) return training
  if (!isRecord(value) || !exactKeys(value, ['createdAt', 'delta', 'id', 'itemId', 'reason', 'source']) ||
    typeof value.id !== 'string' || !FARM_SAFE_ID_PATTERN.test(value.id) || !cropId(value.itemId) ||
    value.delta !== -1 || value.reason !== 'constellation-produce' || !safeInteger(value.createdAt) ||
    !isRecord(value.source) || !exactKeys(value.source, ['kind', 'nodeId', 'revision', 'tier', 'umaId']) ||
    value.source.kind !== 'constellation-produce' || typeof value.source.umaId !== 'string' ||
    !FARM_SAFE_ID_PATTERN.test(value.source.umaId) || typeof value.source.nodeId !== 'string' ||
    !FARM_SAFE_ID_PATTERN.test(value.source.nodeId) || !safeInteger(value.source.revision, 1) ||
    !safeInteger(value.source.tier, 1) || value.source.tier > 14) return null
  return {
    id: value.id,
    itemId: value.itemId,
    delta: -1,
    reason: 'constellation-produce',
    source: {
      kind: 'constellation-produce',
      umaId: value.source.umaId,
      tier: value.source.tier,
      nodeId: value.source.nodeId,
      revision: value.source.revision,
    },
    createdAt: value.createdAt,
  }
}
