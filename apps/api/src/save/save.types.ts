// API-side validation for the @racer/domain save wire contract (docs/technical/architecture.md).
// This stays self-contained because the production API is a CommonJS deploy and does not ship workspace TS sources.
import { parseRpgEntity, parseRpgLog, rpgEntityIdMatches, rpgLogIdMatches, rpgOrdinaryRow } from './rpg-save.types'
import { parseInspirationBank } from './inspiration-bank'
import { FARM_ENTITY_KINDS, FARM_LOG_KINDS, FARM_SYNC_LIMITS, farmBytes, parseFarmEntity, farmEntityIdMatches,
  parseFarmCommandMovement, parseFarmOperationLog, farmLogIdMatches, parseFarmOperationBatch, farmOperationReferences,
  type FarmOperationV1, type FarmOperationResponse } from './farms'
import { PUZZLE_ENTITY_KINDS, PUZZLE_LOG_KINDS, parsePuzzleEntity, puzzleEntityIdMatches, parsePuzzleResultSave,
  parsePuzzleOperationReceipt, parsePuzzleItemMovement, parsePuzzleOperationBatch, puzzleOperationReferences,
  PUZZLE_SYNC_LIMITS, type PuzzleOperationV1, type PuzzleOperationResponse } from './puzzles'

export const ENTITY_KINDS = ['profile', 'umas', 'cards', 'badges', 'farm', 'items', 'rpgOutfits', 'rpgPresets', 'rpgCheckpoints', 'inspirationBank', ...PUZZLE_ENTITY_KINDS, ...FARM_ENTITY_KINDS] as const
export type EntityKind = (typeof ENTITY_KINDS)[number]
export const LOG_KINDS = ['raceResults', 'ledger', 'flairEvents', 'itemLedger', 'rpgResults', 'rpgPromotions', 'rpgReceipts', ...PUZZLE_LOG_KINDS, ...FARM_LOG_KINDS] as const
export type LogKind = (typeof LOG_KINDS)[number]
export const MAX_SYNC_OPERATIONS = 400

export interface EntityRecord {
  kind: EntityKind
  id: string
  version: number
  data: Record<string, unknown>
  deleted: boolean
  updatedAt: number
}

export interface LogRecord {
  kind: LogKind
  id: string
  data: Record<string, unknown>
  createdAt: number
}

export interface EntityUpsert {
  kind: EntityKind
  id: string
  baseVersion: number
  data: Record<string, unknown>
  deleted?: boolean
}

export interface LogAppend {
  kind: LogKind
  id: string
  data: Record<string, unknown>
  createdAt: number
}

export interface SyncRequest {
  upserts: EntityUpsert[]
  appends: LogAppend[]
  puzzleOperations?: PuzzleOperationV1[]
  puzzleProtocolVersion?: 1
  farmOperations?: FarmOperationV1[]
  farmProtocolVersion?: 1
}

export interface SyncResponse {
  applied: { kind: EntityKind; id: string; version: number }[]
  conflicts: EntityRecord[]
  appended: number
  serverTime: number
  puzzleOperations?: PuzzleOperationResponse[]
  farmOperations?: FarmOperationResponse[]
}

export interface SaveSnapshot {
  entities: EntityRecord[]
  logs: LogRecord[]
  serverTime: number
}

const ID_PATTERN = /^[A-Za-z0-9_.:-]{1,120}$/
const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/
const MAX_SCENARIO_TIER = 14
const MAX_UMA_LEVEL = MAX_SCENARIO_TIER * 10
const MAX_TRAINING_LEVEL = 10
/** From save v11 every Training Level costs the same (D211). */
const TRAINING_EXP_PER_LEVEL = 1250
const TRAINING_LEVEL_UP_TICKET_ID = 'training:level-up-ticket'
/** v5 and v6 cards held limit breaks up to 4; v7 cards hold 0★–5★ (D147); v8 cards 0★–3★ as `bonds` (D200). */
const LEGACY_MAX_LIMIT_BREAK = 4
const LEGACY_MAX_STARS_V7 = 5
const MAX_STARS = 3
const CARD_SET_SIZE = 6
/** A ceiling on constellation size, not the authored node count: the templates are not in this deploy. */
const MAX_CONSTELLATION_NODES = 128
const STATS = ['speed', 'stamina', 'power', 'guts', 'wit'] as const
const GRADES = ['S', 'A', 'B', 'C', 'D', 'E', 'F', 'G'] as const
const SKILL_ORIGINS = ['own-unique', 'awakening', 'card', 'inherited'] as const
export const LEDGER_RESOURCES = ['tickets', 'card-coupons', 'uma-coupons', 'uma-shards'] as const
/** A scenario completion's goals: a career's maiden, two trials and up to three main races. Mirrors the domain's bound. */
export const MAX_COMPLETION_GOALS = 6
export const LEDGER_REASONS = [
  'daily-grant', 'initial-grant', 'training', 'uma-level', 'card-level', 'uma-promotion', 'card-limit-break', 'card-max',
  'uma-shard-exchange', 'card-coupon-redeem', 'uma-coupon-redeem', 'card-unlock', 'dev-grant', 'minigame-refund',
] as const
const PROFILE_FIELDS = ['schemaVersion', 'tickets', 'cardCoupons', 'umaCoupons', 'umaShards', 'lastDailyGrant', 'featuredUmaId', 'starterSeedContentVersion', 'createdAt'] as const
/** v11 adds the Training EXP bank (D212). */
const PROFILE_V11_FIELDS = [...PROFILE_FIELDS, 'trainingExpBank'] as const
const LEGACY_UMA_FIELDS = ['templateId', 'level', 'exp', 'trainingLevel', 'trainingExp', 'stats', 'skillPoints', 'aptitudes', 'deckCardIds', 'skillLibrary', 'loadoutSkillIds', 'trainingsThisScenario'] as const
const UMA_FIELDS = ['schemaVersion', ...LEGACY_UMA_FIELDS, 'scenarioStarted', 'skillHistory', 'currentParents', 'parentSnapshot', 'goalPlanVersion', 'scenarioJourneys'] as const
const CURRENT_UMA_FIELDS = [...UMA_FIELDS, 'scenarioModifier'] as const
const UMA_V6_FIELDS = ['schemaVersion', 'templateId', 'level', 'exp', 'unlockedTier', 'scenarios', 'skillHistory', 'goalPlanVersion'] as const
const UMA_V10_FIELDS = [...UMA_V6_FIELDS, 'racePreferences'] as const
const SCENARIO_TRAINING_FIELDS = ['tier', 'trainingLevel', 'trainingExp', 'cardSetIds', 'assignments', 'loadoutSkillIds', 'journey', 'started'] as const
/** v12 units carry the Extra stats grid (D235). */
const SCENARIO_TRAINING_V12_FIELDS = [...SCENARIO_TRAINING_FIELDS, 'extraStats'] as const
/** Save v15 (D252): a unit's shared state and its four distance presets, each with its own build. */
const SCENARIO_UNIT_FIELDS = ['tier', 'trainingLevel', 'trainingExp', 'extraStatsUnlocked', 'inspiration', 'presets', 'journey', 'started'] as const
const TRAINING_PRESET_FIELDS = ['cardSetIds', 'assignments', 'activeExtraStats', 'loadoutSkillIds'] as const
const EXTRA_STAT_NODE_PATTERN = /^(speed|stamina|power|guts|wit)-([1-4])$/
const CARD_FIELDS = ['templateId', 'level', 'exp', 'limitBreak', 'maxCouponGranted'] as const
const CARD_V5_FIELDS = ['templateId', 'limitBreak', 'maxCouponGranted'] as const
const CARD_V6_FIELDS = ['templateId', 'limitBreaks', 'maxCouponGranted'] as const
const CARD_V7_FIELDS = ['templateId', 'stars', 'maxCouponGranted'] as const
const CARD_V8_FIELDS = ['templateId', 'bonds', 'maxCouponGranted'] as const
const CARD_GLOBAL_FIELDS = ['schemaVersion', 'templateId', 'stars', 'maxCouponGranted'] as const
const SKILL_FIELDS = ['skillId', 'origin', 'sourceId'] as const
const SKILL_HISTORY_FIELDS = [...SKILL_FIELDS, 'tier'] as const
const PARENT_FIELDS = ['umaId', 'charaId', 'completedTier', 'takenAt', 'inheritedUniqueSkillId', 'inheritableWhiteSkillIds', 'aptitudes'] as const
const SNAPSHOT_FIELDS = [...PARENT_FIELDS, 'parents'] as const
const JOURNEY_FIELDS = ['tier', 'tracking', 'state', 'completedAt', 'goals'] as const
const LEGACY_GOAL_FIELDS = ['id', 'slot', 'raceId', 'kind', 'minimumMarginLengths', 'status', 'completedRaceResultId', 'completedAt'] as const
const GOAL_FIELDS = [...LEGACY_GOAL_FIELDS, 'series'] as const
const GOAL_SERIES_FIELDS = ['tag', 'legs'] as const
const GOAL_LEG_FIELDS = ['key', 'raceId', 'status', 'completedRaceResultId', 'completedAt'] as const
const SERIES_LEG_KEY_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const LEDGER_FIELDS = ['resource', 'delta', 'reason', 'localDay', 'createdAt'] as const
const STRATEGIES = ['front', 'pace', 'late', 'end'] as const
const RACE_RESULT_FIELDS = [
  'contentVersion', 'umaId', 'raceId', 'sequence', 'seed', 'strategy', 'startLevel', 'startExp', 'startStats',
  'raceBonus', 'playerPlacement', 'expGained', 'levelsGained', 'ticketReward', 'shardReward', 'field', 'createdAt',
] as const
const RACE_COURSE_FIELDS = ['distance', 'surface', 'season'] as const
const RACE_COURSE_V3_FIELDS = ['distance', 'surface', 'season', 'layout'] as const
const RACE_COURSE_V5_FIELDS = ['distance', 'surface', 'season', 'layout', 'trackId', 'rotation'] as const
/** Engine v8 adds the race's grade code for the `grade` skill condition. */
const RACE_COURSE_V8_FIELDS = [...RACE_COURSE_V5_FIELDS, 'grade'] as const
/** Mirrors @racer/domain RACE_SKILL_EFFECT_KINDS (engine v5 adds gate and passive kinds, M018). */
const RACE_SKILL_EFFECT_KINDS = [
  'recovery', 'current-speed', 'current-speed-natural', 'target-speed', 'acceleration',
  'passive-speed', 'passive-stamina', 'passive-power', 'passive-guts', 'passive-wit', 'start-delay',
] as const
const RACE_RUNNER_FIELDS = ['umaId', 'isPlayer', 'strategy', 'gate', 'stats', 'aptitude', 'placement', 'finishTime', 'marginLengths'] as const
const RACE_APTITUDE_FIELDS = ['distance', 'surface', 'strategy'] as const
const RACE_FACT_FIELDS = [
  'version', 'familyId', 'grade', 'venueKey', 'venueTags', 'courseId', 'surface', 'distance', 'distanceCategory',
  'series', 'playerStartDelay', 'playerFinalSpurtPlacement', 'ledEverySectionCheckpoint', 'inheritedUniqueActivated',
] as const
const RACE_GRADES = ['debut', 'maiden', 'pre-op', 'op', 'g3', 'g2', 'g1'] as const
const DISTANCES = ['sprint', 'mile', 'medium', 'long'] as const
const FLAIR_SERIES = [
  'triple-crown', 'triple-tiara', 'spring-triple-crown', 'autumn-triple-crown',
  'grand-prix', 'sprint-crown', 'mile-crown', 'dirt-crown',
] as const
const FLAIR_KINDS = ['badge-tier', 'one-off', 'goal-ribbon', 'honors', 'title', 'trophy-earned', 'trainer-achievement'] as const
const BADGE_TIERS = ['bronze', 'silver', 'gold', 'platinum', 'rainbow', 'one-off'] as const
const BADGE_FILTER_CATEGORIES = [
  'victories', 'surface', 'distance', 'strategy', 'venue', 'race-feat', 'stats', 'scenario', 'training', 'skills',
  'goals', 'lineage', 'title', 'trophy', 'collection', 'stable', 'journey',
] as const
const TRAINER_RECORD_KINDS = [
  'highest-stat', 'most-wins', 'most-g1-wins', 'most-badge-stages', 'biggest-winning-margin', 'longest-win-streak',
] as const
const FARM_SCHEMA_VERSION = 2
const FARM_PLOT_IDS_V1 = ['plot-1', 'plot-2', 'plot-3', 'plot-4', 'plot-5', 'plot-6'] as const
const FARM_PLOT_LEVELS_V1 = [1, 2, 6, 13, 27, 42] as const
const FARM_CROP_ID_PATTERN = /^produce:t([1-9]|1[0-4]):(speed|stamina|power|guts|wit)$/
const FARM_GROWTH_MS_V1 = 12 * 60 * 60 * 1_000
const MAX_FARM_WORKERS = 1_000
/** Farm v2 (D234, D237): three Sections, `plot-1` … `plot-18`; plot n costs 2 × (n − 1)² Farm Levels more than plot n − 1. */
const FARM_PLOT_ID_PATTERN = /^plot-([1-9]\d{0,2})$/
const MAX_FARM_PLOTS = 18
const MAX_FARMING_LEVEL_BOUND = 99_999
const FARM_PLOT_LEVELS: readonly number[] = (() => {
  const levels = [0, 1]
  for (let plot = 2; plot <= MAX_FARM_PLOTS; plot += 1) {
    levels.push(levels[plot - 1]! + 2 * (plot - 1) ** 2)
  }
  return levels
})()

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
const isId = (value: unknown): value is string => typeof value === 'string' && ID_PATTERN.test(value)
const isNonNegativeInt = (value: unknown): value is number => Number.isSafeInteger(value) && (value as number) >= 0
const isPositiveInt = (value: unknown): value is number => Number.isSafeInteger(value) && (value as number) > 0

function isLocalDay(value: unknown): value is string {
  if (typeof value !== 'string' || !DAY_PATTERN.test(value)) return false
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(Date.UTC(year!, month! - 1, day))
  return date.getUTCFullYear() === year && date.getUTCMonth() === month! - 1 && date.getUTCDate() === day
}

function exactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  const expected = [...keys].sort()
  const actual = Object.keys(value).sort()
  return actual.length === expected.length && actual.every((key, index) => key === expected[index])
}

function parseStats(value: unknown): Record<(typeof STATS)[number], number> | null {
  if (!isRecord(value) || !exactKeys(value, STATS) || STATS.some((key) => !isNonNegativeInt(value[key]))) return null
  return Object.fromEntries(STATS.map((key) => [key, value[key] as number])) as Record<(typeof STATS)[number], number>
}

function parseAptitudes(value: unknown): Record<string, unknown> | null {
  if (!isRecord(value) || !isRecord(value.surface) || !isRecord(value.distance) || !isRecord(value.strategy)) return null
  const groups = [
    [value.surface, ['turf', 'dirt']],
    [value.distance, ['sprint', 'mile', 'medium', 'long']],
    [value.strategy, ['front', 'pace', 'late', 'end']],
  ] as const
  for (const [group, keys] of groups) {
    if (!exactKeys(group, keys) || keys.some((key) => !GRADES.includes(group[key] as (typeof GRADES)[number]))) return null
  }
  return value
}

function parseUniqueIds(value: unknown, max = Number.POSITIVE_INFINITY): string[] | null {
  if (!Array.isArray(value) || value.length > max || value.some((item) => !isId(item))) return null
  return new Set(value).size === value.length ? [...value] as string[] : null
}

function parseFarmProgressV1(value: unknown): { level: number; exp: number } | null {
  if (!isRecord(value) || !exactKeys(value, ['level', 'exp']) || !isPositiveInt(value.level) || value.level > 20 ||
    !isNonNegativeInt(value.exp)) return null
  if (value.level === 20) return value.exp === 0 ? { level: 20, exp: 0 } : null
  const required = 48 + 12 * Math.floor((value.level - 1) / 4)
  return value.exp < required ? { level: value.level, exp: value.exp } : null
}

/** v2 (D234): no cap; every level costs 24 XP, two harvests. */
function parseFarmProgress(value: unknown): { level: number; exp: number } | null {
  if (!isRecord(value) || !exactKeys(value, ['level', 'exp']) || !isPositiveInt(value.level) ||
    value.level > MAX_FARMING_LEVEL_BOUND || !isNonNegativeInt(value.exp)) return null
  return value.exp < 24 ? { level: value.level, exp: value.exp } : null
}

const farmPlotNumber = (value: unknown): number | null => {
  const match = typeof value === 'string' ? FARM_PLOT_ID_PATTERN.exec(value) : null
  const number = match ? Number(match[1]) : NaN
  return number >= 1 && number <= MAX_FARM_PLOTS ? number : null
}

/** 10h, then 15 minutes faster a level for ten levels, to 7h 30m (D237); or D234's 12h → 8h in 24-minute steps. */
const isFarmGrowthMs = (value: number): boolean => {
  if (!Number.isSafeInteger(value) || value % 60_000 !== 0) return false
  const minutes = value / 60_000
  const onLadder = (base: number, step: number) => base - minutes >= 0 && (base - minutes) % step === 0 && base - minutes <= step * 10
  return onLadder(600, 15) || onLadder(720, 24)
}

function parseFarmPlotShape(plot: unknown, growthOk: (ms: number) => boolean): plot is Record<string, unknown> {
  if (!isRecord(plot) || !exactKeys(plot, ['id', 'templateId', 'lastCropId', 'attempt', 'cycle']) ||
    farmPlotNumber(plot.id) === null || !isNonNegativeInt(plot.attempt) ||
    !(plot.templateId === null || isId(plot.templateId)) ||
    !(plot.lastCropId === null || (typeof plot.lastCropId === 'string' && FARM_CROP_ID_PATTERN.test(plot.lastCropId)))) return false
  if (plot.cycle !== null) {
    const cycle = plot.cycle
    if (!isRecord(cycle) || !exactKeys(cycle, ['id', 'cropId', 'plantedAt', 'readyAt']) ||
      cycle.id !== `farm:${String(plot.id)}:${String(plot.attempt)}` ||
      typeof cycle.cropId !== 'string' || !FARM_CROP_ID_PATTERN.test(cycle.cropId) ||
      !isNonNegativeInt(cycle.plantedAt) || !isNonNegativeInt(cycle.readyAt) ||
      !growthOk(cycle.readyAt - cycle.plantedAt) || plot.templateId === null || plot.attempt < 1) return false
  }
  return !(plot.templateId === null && (plot.lastCropId !== null || plot.cycle !== null))
}

function parseFarmWorkers(value: Record<string, unknown>, parse: typeof parseFarmProgress): number | null {
  const workerIds = Object.keys(value)
  if (workerIds.length > MAX_FARM_WORKERS || workerIds.some((id) => !isId(id))) return null
  let farmLevel = 1
  for (const id of workerIds) {
    const progress = parse(value[id])
    if (!progress) return null
    farmLevel += progress.level - 1
  }
  return farmLevel
}

/** The v1 Farm (six fixed plots, Farming Levels 1–20), still accepted so an older client's sync is answered. */
function parseFarmV1(value: Record<string, unknown>): Record<string, unknown> | null {
  if (!Array.isArray(value.plots) || value.plots.length !== FARM_PLOT_IDS_V1.length || !isRecord(value.workers)) return null
  const farmLevel = parseFarmWorkers(value.workers, parseFarmProgressV1)
  if (farmLevel === null) return null
  const assigned = new Set<string>()
  for (let index = 0; index < value.plots.length; index += 1) {
    const plot = value.plots[index]
    if (!parseFarmPlotShape(plot, (ms) => ms === FARM_GROWTH_MS_V1) || plot.id !== FARM_PLOT_IDS_V1[index]) return null
    if (typeof plot.templateId === 'string') {
      if (assigned.has(plot.templateId)) return null
      assigned.add(plot.templateId)
    }
    if (farmLevel < FARM_PLOT_LEVELS_V1[index]! && (plot.templateId !== null || plot.lastCropId !== null || plot.cycle !== null)) return null
  }
  return value
}

function parseFarm(value: unknown): Record<string, unknown> | null {
  if (!isRecord(value) || !exactKeys(value, ['schemaVersion', 'plots', 'workers'])) return null
  if (value.schemaVersion === 1) return parseFarmV1(value)
  if (value.schemaVersion !== FARM_SCHEMA_VERSION || !Array.isArray(value.plots) || value.plots.length > MAX_FARM_PLOTS ||
    !isRecord(value.workers)) return null
  const farmLevel = parseFarmWorkers(value.workers, parseFarmProgress)
  if (farmLevel === null) return null
  // Sparse and canonical: plot order, once each, never an empty never-planted plot.
  const assigned = new Set<string>()
  let previous = 0
  for (const plot of value.plots) {
    if (!parseFarmPlotShape(plot, isFarmGrowthMs)) return null
    const number = farmPlotNumber(plot.id)!
    if (number <= previous) return null
    previous = number
    if (plot.templateId === null && plot.lastCropId === null && plot.cycle === null && plot.attempt === 0) return null
    if (typeof plot.templateId === 'string') {
      if (assigned.has(plot.templateId)) return null
      assigned.add(plot.templateId)
    }
    if (farmLevel < FARM_PLOT_LEVELS[number]! && (plot.templateId !== null || plot.lastCropId !== null || plot.cycle !== null)) return null
  }
  return value
}

function parseItemStack(value: unknown): Record<string, unknown> | null {
  if (!isRecord(value) || !exactKeys(value, ['itemId', 'quantity', 'updatedAt']) || !isId(value.itemId) ||
    !isNonNegativeInt(value.quantity) || !isNonNegativeInt(value.updatedAt)) return null
  return value
}

/** Where a Training Level-Up Ticket was spent, named by the unit's starting point (D213). */
function isLevelUpSource(value: Record<string, unknown>): boolean {
  return exactKeys(value, ['kind', 'umaId', 'tier', 'fromLevel', 'fromExp']) && value.kind === 'level-up' &&
    isId(value.umaId) && isPositiveInt(value.tier) && value.tier <= MAX_SCENARIO_TIER &&
    isPositiveInt(value.fromLevel) && value.fromLevel < MAX_TRAINING_LEVEL && isNonNegativeInt(value.fromExp)
}

/** Training Level-Up Tickets: paid by the Training EXP bank, spent on one unit's levels (D212, D213). */
function parseTrainingTicketMovement(value: Record<string, unknown>): Record<string, unknown> | null {
  const source = value.source as Record<string, unknown>
  if (value.reason === 'exp-bank') {
    if (!isPositiveInt(value.delta)) return null
    if (source.kind === 'spark-run') return exactKeys(source, ['kind', 'runId']) && isId(source.runId) ? value : null
    if (source.kind === 'bank-settle') return exactKeys(source, ['kind']) ? value : null
    return isLevelUpSource(source) ? value : null
  }
  if (value.reason === 'training-level-up') {
    return Number.isSafeInteger(value.delta) && (value.delta as number) < 0 && isLevelUpSource(source) ? value : null
  }
  return null
}

function parseItemLedger(value: unknown): Record<string, unknown> | null {
  const puzzle = parsePuzzleItemMovement(value)
  if (puzzle) return puzzle as unknown as Record<string, unknown>
  if (!isRecord(value) || !exactKeys(value, ['id', 'itemId', 'delta', 'reason', 'source', 'createdAt']) ||
    !isId(value.id) || typeof value.itemId !== 'string' ||
    !isNonNegativeInt(value.createdAt) || !isRecord(value.source)) return null
  if (value.itemId === TRAINING_LEVEL_UP_TICKET_ID) return parseTrainingTicketMovement(value)
  if (/^inspiration:t([1-9]|1[0-4]):(slot|skill)$/.test(value.itemId)) return parseInspirationMovement(value)
  if (!FARM_CROP_ID_PATTERN.test(value.itemId)) return null
  if (value.reason === 'farm-harvest') {
    if (value.delta !== 1 || !exactKeys(value.source, ['kind', 'plotId', 'cycleId', 'templateId', 'farmingExp']) ||
      value.source.kind !== 'farm-harvest' || farmPlotNumber(value.source.plotId) === null ||
      value.source.cycleId !== value.id || !isId(value.source.templateId) || value.source.farmingExp !== 12) return null
    return value
  }
  if (value.reason === 'constellation-produce') {
    if (value.delta !== -1 || !exactKeys(value.source, ['kind', 'umaId', 'tier', 'nodeId', 'revision']) ||
      value.source.kind !== 'constellation-produce' || !isId(value.source.umaId) || !isId(value.source.nodeId) ||
      !isPositiveInt(value.source.tier) || value.source.tier > 14 || !isPositiveInt(value.source.revision)) return null
    return value
  }
  // An Extra stat node bought with its stat's scenario crop, as many as its place in the row (D235).
  if (value.reason === 'extra-stat-unlock') {
    if (!exactKeys(value.source, ['kind', 'umaId', 'tier', 'nodeId']) || value.source.kind !== 'extra-stat-unlock' ||
      !isId(value.source.umaId) || !isPositiveInt(value.source.tier) || value.source.tier > 14 ||
      typeof value.source.nodeId !== 'string') return null
    const node = EXTRA_STAT_NODE_PATTERN.exec(value.source.nodeId)
    const crop = FARM_CROP_ID_PATTERN.exec(value.itemId)
    if (!node || !crop || Number(crop[1]) !== value.source.tier || crop[2] !== node[1] || value.delta !== -Number(node[2]) ||
      value.id !== `extra:${value.source.umaId}:${value.source.tier}:${value.source.nodeId}`) return null
    return value
  }
  return null
}

/** A unit's Extra stats grid (D235): each stat's bought count 0–4, and at most six bought nodes on, in grid order. */
function parseInspirationMovement(value: Record<string, unknown>): Record<string, unknown> | null {
  const token = /^inspiration:t([1-9]|1[0-4]):(slot|skill)$/.exec(value.itemId as string)
  if (!token || !isRecord(value.source)) return null
  const s = value.source, tier = Number(token[1]), kind = token[2]
  if (s.tier !== tier || s.kind !== value.reason) return null
  if (value.reason === 'rpg-inspiration') {
    if (!exactKeys(s, s.debtPaid === undefined ? ['kind', 'entryId', 'attemptId', 'tier', 'tokenKind'] : ['kind', 'entryId', 'attemptId', 'tier', 'tokenKind', 'debtPaid']) ||
      (s.debtPaid !== undefined && (!isNonNegativeInt(s.debtPaid) || s.debtPaid > Number(value.delta))) || !isId(s.entryId) || !isId(s.attemptId) ||
      s.tokenKind !== kind || !isPositiveInt(value.delta) || value.delta > (kind === 'slot' ? 30 : 60) ||
      value.id !== `rpg-inspiration:${s.entryId}:${kind}`) return null
  } else if (value.reason === 'inspiration-unlock') {
    if (!exactKeys(s, ['kind', 'umaId', 'tier', 'nodeId', 'goldIndex']) || !isId(s.umaId) ||
      !['parent0', 'parent1', 'parent0-gp0', 'parent0-gp1', 'parent1-gp0', 'parent1-gp1'].includes(s.nodeId as string) ||
      !(s.goldIndex === null || [0, 1].includes(s.goldIndex as number)) || kind !== (s.goldIndex === null ? 'slot' : 'skill') ||
      value.delta !== -1 || value.id !== `inspiration:${s.umaId}:${tier}:${s.nodeId}:${s.goldIndex === null ? 'slot' : `gold${s.goldIndex}`}`) return null
  } else if (value.reason === 'inspiration-exchange') {
    // D309: each side carries the whole exchange, so its amount and tier range check on their own.
    const keys = ['kind', 'exchangeId', 'tier', 'tokenKind', 'direction', 'batches', 'side']
    const out = s.side === 'out', up = s.direction === 'up', batches = s.batches as number
    const lower = up === !out, amount = lower ? 2 * batches : batches
    if (!exactKeys(s, out && s.debtPaid !== undefined ? [...keys, 'debtPaid'] : keys) || !isId(s.exchangeId) ||
      !['up', 'down'].includes(s.direction as string) || !['in', 'out'].includes(s.side as string) || s.tokenKind !== kind ||
      !isPositiveInt(s.batches) || batches > 999 || value.delta !== (out ? amount : -amount) ||
      (lower ? tier >= MAX_SCENARIO_TIER : tier < 2) || value.id !== `inspiration-exchange:${s.exchangeId}:${s.side}` ||
      (s.debtPaid !== undefined && (!isNonNegativeInt(s.debtPaid) || s.debtPaid > Number(value.delta)))) return null
  } else return null
  return value
}

function parseExtraStats(value: unknown): boolean {
  if (!isRecord(value) || !exactKeys(value, ['unlocked', 'active']) || !isRecord(value.unlocked) ||
    !exactKeys(value.unlocked, STATS) || !Array.isArray(value.active) || value.active.length > 6) return false
  const unlocked = value.unlocked
  if (STATS.some((stat) => !isNonNegativeInt(unlocked[stat]) || (unlocked[stat] as number) > 4)) return false
  let previous = -1
  for (const id of value.active) {
    const node = typeof id === 'string' ? EXTRA_STAT_NODE_PATTERN.exec(id) : null
    if (!node || Number(node[2]) > (unlocked[node[1]!] as number)) return false
    const order = STATS.indexOf(node[1] as (typeof STATS)[number]) * 4 + Number(node[2])
    if (order <= previous) return false
    previous = order
  }
  return true
}

function jsonIsBounded(value: unknown, depth = 0): boolean {
  if (depth > 12) return false
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return typeof value !== 'string' || value.length <= 240
  if (typeof value === 'number') return Number.isFinite(value)
  if (Array.isArray(value)) return value.length <= 10_000 && value.every((item) => jsonIsBounded(item, depth + 1))
  if (!isRecord(value) || Object.keys(value).length > 80) return false
  return Object.entries(value).every(([key, item]) => ID_PATTERN.test(key) && jsonIsBounded(item, depth + 1))
}

function parseSortedIds(value: unknown, max = 10_000): string[] | null {
  const ids = parseUniqueIds(value, max)
  return ids && ids.every((id, index) => index === 0 || ids[index - 1]!.localeCompare(id) < 0) ? ids : null
}

function parseCounts(value: unknown, max = 10_000): boolean {
  if (!Array.isArray(value) || value.length > max) return false
  return value.every((entry, index) => isRecord(entry) && exactKeys(entry, ['key', 'count']) && isId(entry.key) &&
    isNonNegativeInt(entry.count) && (index === 0 || isRecord(value[index - 1]) &&
      String((value[index - 1] as Record<string, unknown>).key).localeCompare(entry.key) < 0))
}

function parseTierList(value: unknown): boolean {
  return Array.isArray(value) && value.length <= MAX_SCENARIO_TIER && value.every((tier, index) =>
    isPositiveInt(tier) && tier <= MAX_SCENARIO_TIER && (index === 0 || (value[index - 1] as number) < tier))
}

function parseBadgeSource(value: unknown): boolean {
  return isRecord(value) && exactKeys(value, ['kind', 'id', 'tier']) &&
    ['race', 'training', 'scenario', 'goal', 'migration', 'collection'].includes(String(value.kind)) &&
    (value.id === null || isId(value.id)) && (value.tier === null || (isPositiveInt(value.tier) && value.tier <= MAX_SCENARIO_TIER))
}

function parseAwardStage(value: unknown): boolean {
  return isRecord(value) && exactKeys(value, ['awardKey', 'stage', 'earnedAt', 'history', 'source', 'frozenKeys']) &&
    isId(value.awardKey) && BADGE_TIERS.includes(value.stage as (typeof BADGE_TIERS)[number]) &&
    isNonNegativeInt(value.earnedAt) && ['exact', 'since-tracking'].includes(String(value.history)) &&
    parseBadgeSource(value.source) && parseSortedIds(value.frozenKeys, 500) !== null
}

function parseAwardTitle(value: unknown): boolean {
  return isRecord(value) && exactKeys(value, ['awardKey', 'earnedAt', 'history', 'source', 'frozenKeys']) &&
    isId(value.awardKey) && isNonNegativeInt(value.earnedAt) && ['exact', 'since-tracking'].includes(String(value.history)) &&
    parseBadgeSource(value.source) && parseSortedIds(value.frozenKeys, 500) !== null
}

function parseBadgePreferences(value: unknown, trainer: boolean): boolean {
  const keys = trainer
    ? ['activeTitleId', 'showcaseGroups', 'savedViews', 'displayName', 'pinnedUmaIds']
    : ['activeTitleId', 'showcaseGroups', 'savedViews']
  if (!isRecord(value) || !exactKeys(value, keys) || (value.activeTitleId !== null && !isId(value.activeTitleId)) ||
    !Array.isArray(value.showcaseGroups) || value.showcaseGroups.length < 1 || value.showcaseGroups.length > 21 ||
    !Array.isArray(value.savedViews) || value.savedViews.length > (trainer ? 40 : 20)) return false
  const refs = new Set<string>()
  const groupIds = new Set<string>()
  const groupNames = new Set<string>()
  for (const [index, group] of value.showcaseGroups.entries()) {
    if (!isRecord(group) || !exactKeys(group, ['id', 'name', 'awardRefs']) || !isId(group.id) || groupIds.has(group.id) ||
      (index === 0 ? group.id !== 'default' || group.name !== null : typeof group.name !== 'string' || group.name.trim().length < 1 || group.name.trim().length > 40)) return false
    const awardRefs = parseUniqueIds(group.awardRefs)
    if (!awardRefs || awardRefs.some((ref) => refs.has(ref))) return false
    if (index > 0) {
      const name = (group.name as string).trim().toLocaleLowerCase()
      if (groupNames.has(name)) return false
      groupNames.add(name)
    }
    awardRefs.forEach((ref) => refs.add(ref))
    groupIds.add(group.id)
  }
  const viewIds = new Set<string>()
  const names = new Set<string>()
  let stableViewCount = 0
  let trainerViewCount = 0
  for (const view of value.savedViews) {
    if (!isRecord(view) || !exactKeys(view, ['id', 'name', 'filters', 'sort']) || !isId(view.id) || viewIds.has(view.id) ||
      typeof view.name !== 'string' || view.name.trim().length < 1 || view.name.trim().length > 40 ||
      !['recent', 'tier', 'closest', 'rarest', 'alphabetical', 'category'].includes(String(view.sort)) || !parseSavedViewFilters(view.filters)) return false
    const name = view.name.trim().toLocaleLowerCase()
    const viewScope = trainer && (view.id as string).startsWith('trainer-view-') ? 'trainer' : 'stable'
    const scopedName = `${viewScope}:${name}`
    if (names.has(scopedName)) return false
    names.add(scopedName)
    viewIds.add(view.id)
    if (viewScope === 'trainer') trainerViewCount += 1
    else stableViewCount += 1
  }
  if (stableViewCount > 20 || trainerViewCount > 20) return false
  return !trainer || (typeof value.displayName === 'string' && value.displayName.trim().length > 0 &&
    [...value.displayName.trim()].length <= 32 && parseUniqueIds(value.pinnedUmaIds) !== null)
}

function parseSavedViewFilters(value: unknown): boolean {
  if (!parseCounts(value, 30)) return false
  const rows = value as { key: string; count: number }[]
  const kinds = new Set<string>()
  const enums: Record<string, readonly string[]> = {
    category: BADGE_FILTER_CATEGORIES,
    type: [...BADGE_TIERS, 'title', 'trophy', 'goal-ribbon', 'honors'],
    surface: ['turf', 'dirt'], distance: DISTANCES, strategy: STRATEGIES,
    aptitude: ['challenge', 'impossible', 'unorthodox'], grade: RACE_GRADES,
    status: ['earned', 'locked', 'progress', 'complete', 'untracked'], pinned: ['yes', 'no'],
    rarity: ['common', 'uncommon', 'rare', 'elite'],
  }
  for (const row of rows) {
    if (row.key === 'earned-after') {
      if (kinds.has(row.key)) return false
      kinds.add(row.key)
      continue
    }
    if (row.count !== 1) return false
    const separator = row.key.indexOf(':')
    if (separator <= 0) return false
    const kind = row.key.slice(0, separator)
    const filterValue = row.key.slice(separator + 1)
    if (kinds.has(kind)) return false
    kinds.add(kind)
    if (kind === 'scenario') {
      const tier = Number(filterValue)
      if (!isPositiveInt(tier) || tier > MAX_SCENARIO_TIER || String(tier) !== filterValue) return false
    } else if (kind === 'venue' || kind === 'uma') {
      if (!isId(filterValue)) return false
    } else if (!enums[kind]?.includes(filterValue)) return false
  }
  return true
}

const RACE_FEAT_FIELDS = [
  'wireToWireWins', 'greatComebackWins', 'backFieldWins', 'dominantWins', 'bigMarginWins', 'photoFinishWins',
  'lightningStartWins', 'slowStartWins', 'inheritedUniqueWins', 'impossibleGroundWins', 'unorthodoxWins',
  'ironHorseWins', 'blinkOfAnEyeWins',
] as const

function parseUmaBadgeFacts(value: unknown): boolean {
  const fields = [
    'starts', 'wins', 'seconds', 'thirds', 'currentWinStreak', 'longestWinStreak', 'gradeWins', 'surfaceWins',
    'distanceWins', 'strategyWins', 'venueWins', 'familyWins', 'lowAptitudeSurfaceWins', 'lowAptitudeDistanceWins',
    'courseBests', 'raceFeats', 'statPeaks', 'balancedPeak', 'levelPeak', 'distinctSkillIds', 'lifetimeTrainingTurns',
    'friendshipTrainings', 'fullHouseCount', 'trainingByTier', 'fullyTrainedTiers', 'maxSkillsByTier', 'goals',
    'honorsTiers', 'completedScenarioTiers', 'raceStartsByTier', 'completions', 'parentedScenarioStarts',
    'legacyEvidence', 'dynastyEvidence',
  ]
  if (!isRecord(value) || !exactKeys(value, fields)) return false
  const counters = ['starts', 'wins', 'seconds', 'thirds', 'currentWinStreak', 'longestWinStreak', 'balancedPeak',
    'levelPeak', 'lifetimeTrainingTurns', 'friendshipTrainings', 'fullHouseCount']
  if (counters.some((key) => !isNonNegativeInt(value[key])) || (value.wins as number) > (value.starts as number) ||
    (value.seconds as number) + (value.thirds as number) > (value.starts as number) ||
    (value.currentWinStreak as number) > (value.longestWinStreak as number) ||
    (value.friendshipTrainings as number) > (value.lifetimeTrainingTurns as number) ||
    (value.fullHouseCount as number) > (value.lifetimeTrainingTurns as number) || !parseStats(value.statPeaks) ||
    parseSortedIds(value.distinctSkillIds) === null || !parseTierList(value.fullyTrainedTiers) ||
    !parseTierList(value.honorsTiers) || !parseTierList(value.completedScenarioTiers)) return false
  const counts = ['gradeWins', 'surfaceWins', 'distanceWins', 'strategyWins', 'venueWins', 'lowAptitudeSurfaceWins',
    'lowAptitudeDistanceWins', 'maxSkillsByTier', 'raceStartsByTier']
  if (counts.some((key) => !parseCounts(value[key]))) return false
  const gradeWins = value.gradeWins as { key: string }[]
  const surfaceWins = value.surfaceWins as { key: string }[]
  const distanceWins = value.distanceWins as { key: string }[]
  const strategyWins = value.strategyWins as { key: string }[]
  const tierCounts = [...value.maxSkillsByTier as { key: string }[], ...value.raceStartsByTier as { key: string }[]]
  if (gradeWins.some((entry) => !RACE_GRADES.includes(entry.key as (typeof RACE_GRADES)[number])) ||
    surfaceWins.some((entry) => !['turf', 'dirt'].includes(entry.key)) ||
    distanceWins.some((entry) => !DISTANCES.includes(entry.key as (typeof DISTANCES)[number])) ||
    strategyWins.some((entry) => !STRATEGIES.includes(entry.key as (typeof STRATEGIES)[number])) ||
    tierCounts.some((entry) => !isPositiveInt(Number(entry.key)) || Number(entry.key) > MAX_SCENARIO_TIER || String(Number(entry.key)) !== entry.key)) return false
  if (!isRecord(value.raceFeats) || !exactKeys(value.raceFeats, RACE_FEAT_FIELDS) ||
    RACE_FEAT_FIELDS.some((key) => !isNonNegativeInt((value.raceFeats as Record<string, unknown>)[key]))) return false
  const familyWins = value.familyWins
  if (!Array.isArray(familyWins) || familyWins.some((entry, index) => !isRecord(entry) ||
    !exactKeys(entry, ['key', 'count', 'grade', 'series']) || !isId(entry.key) || !isNonNegativeInt(entry.count) ||
    !RACE_GRADES.includes(entry.grade as (typeof RACE_GRADES)[number]) || !Array.isArray(entry.series) ||
    entry.series.some((tag) => !FLAIR_SERIES.includes(tag as (typeof FLAIR_SERIES)[number])) ||
    (entry.series as unknown[]).some((tag, tagIndex, tags) => tagIndex > 0 && String(tags[tagIndex - 1]).localeCompare(String(tag)) >= 0) ||
    (index > 0 && isRecord(familyWins[index - 1]) &&
      String((familyWins[index - 1] as Record<string, unknown>).key).localeCompare(entry.key) >= 0))) return false
  const courseBests = value.courseBests
  if (!Array.isArray(courseBests) || courseBests.length > 10_000 || courseBests.some((entry) =>
    !isRecord(entry) || !exactKeys(entry, ['courseId', 'finishTime', 'resultId', 'achievedAt']) || !isId(entry.courseId) ||
    typeof entry.finishTime !== 'number' || !Number.isFinite(entry.finishTime) || entry.finishTime < 0 ||
    !isId(entry.resultId) || !isNonNegativeInt(entry.achievedAt)) ||
    courseBests.some((entry, index) => index > 0 && isRecord(entry) && isRecord(courseBests[index - 1]) &&
      String((courseBests[index - 1] as Record<string, unknown>).courseId).localeCompare(String(entry.courseId)) >= 0)) return false
  const trainingByTier = value.trainingByTier
  if (!Array.isArray(trainingByTier) || trainingByTier.length > MAX_SCENARIO_TIER || trainingByTier.some((entry, index) =>
    !isRecord(entry) || !exactKeys(entry, ['tier', 'turns', 'friendshipTrainings', 'fullHouseCount', 'reachedTl10']) ||
    !isPositiveInt(entry.tier) || entry.tier > MAX_SCENARIO_TIER || !isNonNegativeInt(entry.turns) || !isNonNegativeInt(entry.friendshipTrainings) ||
    entry.friendshipTrainings > entry.turns || !isNonNegativeInt(entry.fullHouseCount) || entry.fullHouseCount > entry.turns ||
    typeof entry.reachedTl10 !== 'boolean' ||
    (index > 0 && isRecord(trainingByTier[index - 1]) && ((trainingByTier[index - 1] as Record<string, unknown>).tier as number) >= entry.tier))) return false
  const evidence = ['parentedScenarioStarts', 'legacyEvidence', 'dynastyEvidence']
  if (evidence.some((key) => !Array.isArray(value[key]) || (value[key] as unknown[]).length > 10_000 ||
    (value[key] as unknown[]).some((entry, index, rows) => !isRecord(entry) || !exactKeys(entry, ['key', 'relatedUmaId', 'tier', 'createdAt']) ||
      !isId(entry.key) || !isId(entry.relatedUmaId) || !isPositiveInt(entry.tier) || entry.tier > MAX_SCENARIO_TIER || !isNonNegativeInt(entry.createdAt) ||
      (index > 0 && isRecord(rows[index - 1]) && String((rows[index - 1] as Record<string, unknown>).key).localeCompare(entry.key) >= 0)))) return false
  const goals = value.goals
  if (!Array.isArray(goals) || goals.length > MAX_SCENARIO_TIER * 3 || goals.some((entry) => !isRecord(entry) ||
    !exactKeys(entry, ['goalId', 'resultId', 'tier', 'completedAt']) || !isId(entry.goalId) || !isId(entry.resultId) ||
    !isPositiveInt(entry.tier) || entry.tier > MAX_SCENARIO_TIER || !isNonNegativeInt(entry.completedAt)) ||
    goals.some((entry, index) => index > 0 && isRecord(entry) && isRecord(goals[index - 1]) &&
      String((goals[index - 1] as Record<string, unknown>).goalId).localeCompare(String(entry.goalId)) >= 0)) return false
  const completions = value.completions
  return Array.isArray(completions) && completions.length <= MAX_SCENARIO_TIER && completions.every((entry, index) =>
    isRecord(entry) && exactKeys(entry, ['tier', 'completedAt', 'trainingLevel', 'stats', 'deckCardIds', 'deckEras',
      'trainingTurns', 'friendshipTrainings', 'raceStarts', 'completedGoalIds', 'honors', 'parentUmaIds', 'grandparentUmaIds']) &&
    isPositiveInt(entry.tier) && entry.tier <= MAX_SCENARIO_TIER && isNonNegativeInt(entry.completedAt) && isPositiveInt(entry.trainingLevel) &&
    entry.trainingLevel <= 10 && parseStats(entry.stats) !== null && parseUniqueIds(entry.deckCardIds, 6) !== null &&
    Array.isArray(entry.deckEras) && entry.deckEras.length === (entry.deckCardIds as unknown[]).length && entry.deckEras.every(isPositiveInt) &&
    isNonNegativeInt(entry.trainingTurns) &&
    isNonNegativeInt(entry.friendshipTrainings) && isNonNegativeInt(entry.raceStarts) && parseUniqueIds(entry.completedGoalIds, MAX_COMPLETION_GOALS) !== null &&
    typeof entry.honors === 'boolean' && parseUniqueIds(entry.parentUmaIds, 2) !== null && parseUniqueIds(entry.grandparentUmaIds, 4) !== null &&
    (index === 0 || isRecord(completions[index - 1]) && ((completions[index - 1] as Record<string, unknown>).tier as number) < entry.tier))
}

function parseBadge(value: unknown): Record<string, unknown> | null {
  if (!isRecord(value) || value.version !== 1 || !jsonIsBounded(value)) return null
  if (value.scope === 'uma') {
    const keys = ['version', 'scope', 'umaId', 'catalogVersion', 'evaluatorVersion', 'trackingStartedAt', 'sourceWatermarks', 'history', 'facts', 'awards', 'preferences']
    const sourceWatermarks = value.sourceWatermarks
    if (!exactKeys(value, keys) || !isId(value.umaId) || !isPositiveInt(value.catalogVersion) ||
      !isNonNegativeInt(value.evaluatorVersion) || !isNonNegativeInt(value.trackingStartedAt) ||
      !isRecord(sourceWatermarks) || !exactKeys(sourceWatermarks, ['raceSequence', 'trainingTurns', 'scenarioCompletions', 'lineageEvidence']) ||
      !Number.isSafeInteger(sourceWatermarks.raceSequence) || (sourceWatermarks.raceSequence as number) < -1 ||
      !isNonNegativeInt(sourceWatermarks.trainingTurns) || !isNonNegativeInt(sourceWatermarks.scenarioCompletions) ||
      !isNonNegativeInt(sourceWatermarks.lineageEvidence) || !isRecord(value.history) ||
      !exactKeys(value.history, ['race', 'training', 'scenario-completion', 'lineage', 'diagnostics']) ||
      !['exact', 'since-tracking', 'untracked'].includes(String(value.history.race)) ||
      !['exact', 'since-tracking', 'untracked'].includes(String(value.history.training)) ||
      !['exact', 'since-tracking', 'untracked'].includes(String(value.history['scenario-completion'])) ||
      !['exact', 'since-tracking', 'untracked'].includes(String(value.history.lineage)) ||
      parseSortedIds(value.history.diagnostics, 200) === null || !parseUmaBadgeFacts(value.facts) ||
      !isRecord(value.awards) || !exactKeys(value.awards, ['badges', 'titles', 'trophies']) ||
      !Array.isArray(value.awards.badges) || value.awards.badges.some((entry) => !parseAwardStage(entry)) ||
      !Array.isArray(value.awards.titles) || value.awards.titles.some((entry) => !parseAwardTitle(entry)) ||
      !Array.isArray(value.awards.trophies) || value.awards.trophies.some((entry) => !isRecord(entry) ||
        !exactKeys(entry, ['familyId', 'count', 'firstEarnedAt', 'lastEarnedAt', 'firstResultId', 'lastResultId']) ||
        !isId(entry.familyId) || !isPositiveInt(entry.count) || !isNonNegativeInt(entry.firstEarnedAt) ||
        !isNonNegativeInt(entry.lastEarnedAt) || entry.lastEarnedAt < entry.firstEarnedAt ||
        !isId(entry.firstResultId) || !isId(entry.lastResultId)) || !parseBadgePreferences(value.preferences, false)) return null
    const facts = value.facts as Record<string, unknown>
    const lineageCount = ['parentedScenarioStarts', 'legacyEvidence', 'dynastyEvidence']
      .reduce((sum, key) => sum + (facts[key] as unknown[]).length, 0)
    if ((sourceWatermarks.raceSequence as number) + 1 !== facts.starts ||
      sourceWatermarks.trainingTurns !== facts.lifetimeTrainingTurns ||
      sourceWatermarks.scenarioCompletions !== (facts.completedScenarioTiers as unknown[]).length ||
      sourceWatermarks.lineageEvidence !== lineageCount) return null
    return value
  }
  if (value.scope === 'trainer') {
    const keys = ['version', 'scope', 'catalogVersion', 'evaluatorVersion', 'trackingStartedAt', 'sourceWatermarks', 'aggregates', 'records', 'awards', 'preferences']
    if (!exactKeys(value, keys) || !isPositiveInt(value.catalogVersion) || !isNonNegativeInt(value.evaluatorVersion) ||
      !isNonNegativeInt(value.trackingStartedAt) || !isRecord(value.sourceWatermarks) ||
      !exactKeys(value.sourceWatermarks, ['contributors', 'ledgerEntries', 'contentVersion']) ||
      !isNonNegativeInt(value.sourceWatermarks.contributors) || !isNonNegativeInt(value.sourceWatermarks.ledgerEntries) ||
      (value.sourceWatermarks.contentVersion !== null && !isId(value.sourceWatermarks.contentVersion)) ||
      !parseCounts(value.aggregates) || !parseTrainerRecords(value.records) || !isRecord(value.awards) ||
      !exactKeys(value.awards, ['achievements']) || !Array.isArray(value.awards.achievements) ||
      value.awards.achievements.some((entry) => !parseAwardStage(entry)) || !parseBadgePreferences(value.preferences, true)) return null
    return value
  }
  return null
}

function parseTrainerRecords(value: unknown): boolean {
  if (!Array.isArray(value) || value.length > TRAINER_RECORD_KINDS.length) return false
  return value.every((entry, index) => isRecord(entry) && exactKeys(entry, ['kind', 'value', 'umaId', 'sourceId', 'achievedAt', 'stat']) &&
    TRAINER_RECORD_KINDS.includes(entry.kind as (typeof TRAINER_RECORD_KINDS)[number]) &&
    typeof entry.value === 'number' && Number.isFinite(entry.value) && entry.value >= 0 && isId(entry.umaId) &&
    (entry.sourceId === null || isId(entry.sourceId)) && isNonNegativeInt(entry.achievedAt) &&
    (entry.kind === 'highest-stat' ? STATS.includes(entry.stat as (typeof STATS)[number]) : entry.stat === null) &&
    (index === 0 || isRecord(value[index - 1]) && String((value[index - 1] as Record<string, unknown>).kind).localeCompare(String(entry.kind)) < 0))
}

function parseFlair(value: unknown): Record<string, unknown> | null {
  if (!isRecord(value) || !exactKeys(value, ['version', 'scope', 'umaId', 'kind', 'awardKey', 'stage', 'earnedAt', 'source', 'retroactive']) ||
    value.version !== 1 || !['uma', 'trainer'].includes(String(value.scope)) ||
    (value.scope === 'uma' ? !isId(value.umaId) : value.umaId !== null) ||
    !FLAIR_KINDS.includes(value.kind as (typeof FLAIR_KINDS)[number]) ||
    (value.scope === 'trainer' ? value.kind !== 'trainer-achievement' : value.kind === 'trainer-achievement') || !isId(value.awardKey) ||
    !BADGE_TIERS.includes(value.stage as (typeof BADGE_TIERS)[number]) || !isNonNegativeInt(value.earnedAt) ||
    typeof value.retroactive !== 'boolean' || !isRecord(value.source) ||
    !exactKeys(value.source, ['kind', 'id', 'tier']) || !['race', 'training', 'scenario', 'goal', 'migration', 'collection'].includes(String(value.source.kind)) ||
    (value.source.id !== null && !isId(value.source.id)) ||
    (value.source.tier !== null && (!isPositiveInt(value.source.tier) || value.source.tier > MAX_SCENARIO_TIER))) return null
  return value
}

function parseRaceFacts(value: unknown, fieldSize: number, playerPlacement: number, course: unknown): boolean {
  if (!isRecord(value) || !exactKeys(value, RACE_FACT_FIELDS)) return false
  const series = value.series
  if (value.version !== 1 || !isId(value.familyId) ||
    !RACE_GRADES.includes(value.grade as (typeof RACE_GRADES)[number]) || !isId(value.venueKey) ||
    !Array.isArray(value.venueTags) || value.venueTags.some((tag) => tag !== 'jra-main') || new Set(value.venueTags).size !== value.venueTags.length ||
    !isId(value.courseId) || !['turf', 'dirt'].includes(String(value.surface)) || !isPositiveInt(value.distance) ||
    !DISTANCES.includes(value.distanceCategory as (typeof DISTANCES)[number]) ||
    (value.distance <= 1_400 ? 'sprint' : value.distance <= 1_800 ? 'mile' : value.distance <= 2_400 ? 'medium' : 'long') !== value.distanceCategory ||
    !Array.isArray(series) || series.some((tag) => !FLAIR_SERIES.includes(tag as (typeof FLAIR_SERIES)[number])) ||
    series.some((tag, index) => index > 0 && String(series[index - 1]).localeCompare(String(tag)) >= 0) ||
    typeof value.playerStartDelay !== 'number' || !Number.isFinite(value.playerStartDelay) || value.playerStartDelay < 0 ||
    (value.playerFinalSpurtPlacement !== null && (!isPositiveInt(value.playerFinalSpurtPlacement) || value.playerFinalSpurtPlacement > fieldSize)) ||
    typeof value.ledEverySectionCheckpoint !== 'boolean' || (value.ledEverySectionCheckpoint && playerPlacement !== 1) ||
    typeof value.inheritedUniqueActivated !== 'boolean') return false
  return !isRecord(course) || (course.distance === value.distance && course.surface === value.surface)
}

function parseProfile(value: unknown): Record<string, unknown> | null {
  if (!isRecord(value)) return null
  if (value.schemaVersion === 16 && value.trainingExpBank !== 0) return null
  if (value.schemaVersion === 11 || value.schemaVersion === 12 || value.schemaVersion === 13 || value.schemaVersion === 14 || value.schemaVersion === 15 || value.schemaVersion === 16
    ? !exactKeys(value, PROFILE_V11_FIELDS) || !isNonNegativeInt(value.trainingExpBank)
    : !exactKeys(value, PROFILE_FIELDS) || ![1, 2, 3, 4, 5, 6, 7, 8, 9, 10].includes(value.schemaVersion as number)) return null
  if (![value.tickets, value.cardCoupons, value.umaCoupons, value.umaShards].every(isNonNegativeInt)) return null
  if (value.lastDailyGrant !== null && !isLocalDay(value.lastDailyGrant)) return null
  if (value.featuredUmaId !== null && !isId(value.featuredUmaId)) return null
  if (value.starterSeedContentVersion !== null && !isId(value.starterSeedContentVersion)) return null
  if (!isNonNegativeInt(value.createdAt)) return null
  return value
}

function parseScenarioModifier(value: unknown, tier: number): boolean {
  if (!isRecord(value) || value.version !== 1 || value.tier !== tier) return false
  if (value.kind === 'team-spirit') {
    return tier === 2 && exactKeys(value, ['version', 'tier', 'kind', 'bursts']) && isNonNegativeInt(value.bursts)
  }
  if (value.kind === 'climax') {
    return tier === 3 && exactKeys(value, ['version', 'tier', 'kind', 'earned', 'stock', 'used']) &&
      isNonNegativeInt(value.earned) && isNonNegativeInt(value.stock) && isNonNegativeInt(value.used) &&
      value.stock + value.used === value.earned
  }
  if (value.kind === 'performances') {
    if (!Array.isArray(value.notes)) return false
    const notes = value.notes
    return tier === 4 && exactKeys(value, ['version', 'tier', 'kind', 'notes', 'performances']) &&
      notes.length < STATS.length && notes.every((note, index) =>
        STATS.includes(note as (typeof STATS)[number]) &&
        (index === 0 || STATS.indexOf(notes[index - 1] as (typeof STATS)[number]) < STATS.indexOf(note as (typeof STATS)[number]))) &&
      isNonNegativeInt(value.performances)
  }
  if (value.kind === 'goddess-fragments') {
    return tier === 5 && exactKeys(value, ['version', 'tier', 'kind', 'fragments', 'bursts']) &&
      isNonNegativeInt(value.fragments) && value.fragments < 8 && isNonNegativeInt(value.bursts)
  }
  return value.kind === 'expedition' && tier === 6 && exactKeys(value, ['version', 'tier', 'kind', 'stamps', 'completed', 'upgraded']) &&
    isNonNegativeInt(value.stamps) && value.stamps <= 5 && isNonNegativeInt(value.completed) &&
    isNonNegativeInt(value.upgraded) && value.upgraded <= value.completed
}

function parseSkill(value: unknown): value is Record<string, unknown> {
  return isRecord(value) && exactKeys(value, SKILL_FIELDS) && isId(value.skillId) &&
    SKILL_ORIGINS.includes(value.origin as (typeof SKILL_ORIGINS)[number]) && (value.sourceId === null || isId(value.sourceId))
}

/**
 * The most EXP an Uma may hold at a level: short of the next level, or a gate's bank of one. v13 costs every scenario's
 * levels the same, 100 + 25 a level into it (D241); v12 and older rose without end, 100 + 25 × (level − 1).
 */
function umaExpLimit(level: number, curve: 'flat' | 'rising'): number {
  const toNext = (at: number) => 100 + 25 * (curve === 'flat' ? (at - 1) % 10 : at - 1)
  return level === MAX_UMA_LEVEL ? 0 : level % 10 === 0 ? toNext(level + 1) : toNext(level) - 1
}

function parseUmaBase(value: Record<string, unknown>): boolean {
  if (!isId(value.templateId) || !isPositiveInt(value.level) || value.level > MAX_UMA_LEVEL || !isNonNegativeInt(value.exp)) return false
  if (value.exp > umaExpLimit(value.level, 'rising')) return false
  if (!isPositiveInt(value.trainingLevel) || value.trainingLevel > 10 || !isNonNegativeInt(value.trainingExp)) return false
  if ((value.trainingLevel === 10 && value.trainingExp !== 0) || (value.trainingLevel < 10 && value.trainingExp >= 100)) return false
  if (!parseStats(value.stats) || !parseAptitudes(value.aptitudes) || !isNonNegativeInt(value.skillPoints) || !isNonNegativeInt(value.trainingsThisScenario)) return false
  const deck = parseUniqueIds(value.deckCardIds, 6)
  const loadout = parseUniqueIds(value.loadoutSkillIds)
  if (!deck || !loadout || !Array.isArray(value.skillLibrary)) return false
  const skills = value.skillLibrary
  if (skills.some((skill) => !parseSkill(skill))) return false
  const skillIds = skills.map((skill) => (skill as Record<string, unknown>).skillId as string)
  if (new Set(skillIds).size !== skillIds.length) return false
  const paid = new Set(skills.filter((skill) => (skill as Record<string, unknown>).origin !== 'own-unique').map((skill) => (skill as Record<string, unknown>).skillId))
  return !loadout.some((id) => !paid.has(id))
}

function parseParent(value: unknown): value is Record<string, unknown> {
  return isRecord(value) && exactKeys(value, PARENT_FIELDS) && isId(value.umaId) && isId(value.charaId) &&
    isPositiveInt(value.completedTier) && value.completedTier <= MAX_SCENARIO_TIER && isNonNegativeInt(value.takenAt) &&
    (value.inheritedUniqueSkillId === null || isId(value.inheritedUniqueSkillId)) &&
    parseUniqueIds(value.inheritableWhiteSkillIds) !== null && parseAptitudes(value.aptitudes) !== null
}

function parseParents(value: unknown): value is Record<string, unknown>[] {
  if (!Array.isArray(value) || value.length > 2 || value.some((parent) => !parseParent(parent))) return false
  const parents = value as Record<string, unknown>[]
  return new Set(parents.map((parent) => parent.umaId)).size === parents.length &&
    new Set(parents.map((parent) => parent.charaId)).size === parents.length
}

function parseSnapshot(value: unknown, templateId?: string): boolean {
  if (!isRecord(value) || !exactKeys(value, SNAPSHOT_FIELDS)) return false
  const { parents, ...parent } = value
  return parseParent(parent) && (templateId === undefined || parent.umaId === templateId) && parseParents(parents)
}

function parseSnapshots(value: unknown): value is Record<string, unknown>[] {
  if (!Array.isArray(value) || value.length > 2 || value.some((snapshot) => !parseSnapshot(snapshot))) return false
  const snapshots = value as Record<string, unknown>[]
  return new Set(snapshots.map((snapshot) => snapshot.umaId)).size === snapshots.length &&
    new Set(snapshots.map((snapshot) => snapshot.charaId)).size === snapshots.length
}

function hasGoalEvidence(value: Record<string, unknown>): boolean {
  return value.status === 'completed'
    ? isId(value.completedRaceResultId) && isNonNegativeInt(value.completedAt)
    : value.completedRaceResultId === null && value.completedAt === null
}

function parseGoalLeg(value: unknown): boolean {
  return isRecord(value) && exactKeys(value, GOAL_LEG_FIELDS) && typeof value.key === 'string' && value.key.length <= 40 &&
    SERIES_LEG_KEY_PATTERN.test(value.key) && isId(value.raceId) && ['active', 'completed', 'missed'].includes(String(value.status)) &&
    hasGoalEvidence(value)
}

const LEGACY_GOAL_SLOTS = ['aptitude', 'identity', 'challenge'] as const
/** Goal plan v3+ career stages, in order, with each stage's goal count (mirrors @racer/domain save.ts, D137). */
const CAREER_STAGE_COUNTS = [['maiden', 1, 1], ['trials', 2, 2], ['main', 1, 4]] as const
const isCareerSlot = (slot: unknown): boolean => CAREER_STAGE_COUNTS.some(([stage]) => stage === slot)

function parseGoal(value: unknown, tier: number, legacy: boolean): boolean {
  const fields = legacy ? LEGACY_GOAL_FIELDS : GOAL_FIELDS
  const career = !legacy && isRecord(value) && isCareerSlot(value.slot)
  if (!isRecord(value) || !exactKeys(value, fields) || (!LEGACY_GOAL_SLOTS.includes(value.slot as (typeof LEGACY_GOAL_SLOTS)[number]) && !career) ||
    // A career goal's id carries its place in the stage, so the journey checks it.
    (career ? typeof value.id !== 'string' || !value.id.startsWith(`goal:${tier}:`) : value.id !== `goal:${tier}:${String(value.slot)}`) ||
    !['win', 'win-by-margin', ...(legacy ? [] : ['win-series'])].includes(String(value.kind)) ||
    typeof value.minimumMarginLengths !== 'number' || !Number.isFinite(value.minimumMarginLengths) || value.minimumMarginLengths < 0 ||
    (value.slot === 'challenge' ? value.kind !== 'win-by-margin' || value.minimumMarginLengths !== 5 : value.minimumMarginLengths !== 0) ||
    !['active', 'completed', 'missed'].includes(String(value.status)) || !hasGoalEvidence(value)) return false
  if (legacy) return isId(value.raceId) && value.kind === (value.slot === 'challenge' ? 'win-by-margin' : 'win')
  if (value.kind !== 'win-series') {
    return isId(value.raceId) && value.series === null && value.kind === (value.slot === 'challenge' ? 'win-by-margin' : 'win')
  }
  if ((value.slot !== 'identity' && value.slot !== 'main') || value.raceId !== null || !isRecord(value.series) || !exactKeys(value.series, GOAL_SERIES_FIELDS) ||
    !FLAIR_SERIES.includes(value.series.tag as (typeof FLAIR_SERIES)[number]) || !Array.isArray(value.series.legs) ||
    value.series.legs.length < 2 || value.series.legs.length > 3 || value.series.legs.some((leg) => !parseGoalLeg(leg))) return false
  const legs = value.series.legs as Record<string, unknown>[]
  if (new Set(legs.map((leg) => leg.key)).size !== legs.length || new Set(legs.map((leg) => leg.raceId)).size !== legs.length) return false
  const active = legs.filter((leg) => leg.status === 'active').length
  const missed = legs.filter((leg) => leg.status === 'missed').length
  if (value.status === 'active') return active > 0 && missed === 0
  if (value.status === 'missed') return active === 0 && missed > 0
  return active === 0 && missed === 0 && legs.some((leg) => leg.completedRaceResultId === value.completedRaceResultId && leg.completedAt === value.completedAt)
}

/** Stages in order with their counts, ids numbered within the stage, and at most one series goal. */
function isCareerPlan(goals: readonly Record<string, unknown>[], tier: number): boolean {
  let index = 0
  for (const [stage, min, max] of CAREER_STAGE_COUNTS) {
    const start = index
    while (goals[index]?.slot === stage) index += 1
    const count = index - start
    if (count < min || count > max) return false
    for (let position = 0; position < count; position += 1) {
      if (goals[start + position]!.id !== (max === 1 ? `goal:${tier}:${stage}` : `goal:${tier}:${stage}:${position + 1}`)) return false
    }
  }
  return index === goals.length && goals.filter((goal) => goal.kind === 'win-series').length <= 1 &&
    goals.every((goal) => goal.kind !== 'win-by-margin')
}

function parseJourney(value: unknown, legacy: boolean): value is Record<string, unknown> {
  if (!isRecord(value) || !exactKeys(value, JOURNEY_FIELDS) || !isPositiveInt(value.tier) || value.tier > MAX_SCENARIO_TIER ||
    !['tracked', 'legacy-untracked'].includes(String(value.tracking)) || !['active', 'completed'].includes(String(value.state)) ||
    (value.state === 'active' && value.completedAt !== null) ||
    (value.state === 'completed' && value.tracking === 'tracked' && !isNonNegativeInt(value.completedAt)) ||
    (value.state === 'completed' && value.tracking === 'legacy-untracked' && value.completedAt !== null && !isNonNegativeInt(value.completedAt)) ||
    !Array.isArray(value.goals)) return false
  if (value.tracking === 'legacy-untracked') return value.state === 'completed' && value.goals.length === 0
  if (value.goals.some((goal) => !parseGoal(goal, value.tier as number, legacy))) return false
  const goals = value.goals as Record<string, unknown>[]
  const raceIds = goals.flatMap((goal) => isRecord(goal.series) && Array.isArray(goal.series.legs)
    ? (goal.series.legs as Record<string, unknown>[]).map((leg) => leg.raceId)
    : [goal.raceId])
  const shaped = goals.length > 0 && goals.every((goal) => isCareerSlot(goal.slot))
    ? isCareerPlan(goals, value.tier as number)
    : goals.length === 3 && new Set(goals.map((goal) => goal.slot)).size === 3 && goals.every((goal) => !isCareerSlot(goal.slot))
  return shaped && new Set(raceIds).size === raceIds.length &&
    (value.state !== 'active' || goals.every((goal) => goal.status !== 'missed')) &&
    (value.state !== 'completed' || goals.every((goal) => goal.status !== 'active'))
}

/** One filled constellation node (D121). The node ids belong to the client's templates, so only the value is checked. */
function parseNodeAssignment(value: unknown, schemaVersion: number, tier: number): boolean {
  if (!isRecord(value)) return false
  if (value.kind === 'card') return exactKeys(value, ['kind', 'cardId']) && isId(value.cardId)
  if (value.kind === 'stat') {
    return schemaVersion < 9 && exactKeys(value, ['kind', 'stat']) && STATS.includes(value.stat as (typeof STATS)[number])
  }
  // v9–v11 Produce nodes; v12 moved them to the Extra stats grid (D235).
  if (value.kind === 'legacy-produce') {
    return schemaVersion >= 9 && schemaVersion <= 11 && exactKeys(value, ['kind', 'stat']) &&
      STATS.includes(value.stat as (typeof STATS)[number])
  }
  if (value.kind === 'produce') {
    if (schemaVersion < 9 || schemaVersion > 11 || !exactKeys(value, ['kind', 'itemId', 'revision']) ||
      typeof value.itemId !== 'string' || !isPositiveInt(value.revision)) return false
    const match = FARM_CROP_ID_PATTERN.exec(value.itemId)
    return match !== null && Number(match[1]) === tier
  }
  if (value.kind === 'lineage') return exactKeys(value, ['kind', 'templateId']) && isId(value.templateId)
  return false
}

/**
 * One persisted career run. `assignments` is only shape-checked: which node ids exist per tier comes from
 * the authored constellation templates, which live in @racer/domain and are not shipped to this deploy.
 */
export function validInspiration(value: unknown): boolean {
  if (!isRecord(value) || !exactKeys(value, ['slots', 'golds']) || !Array.isArray(value.slots) || !Array.isArray(value.golds)) return false
  const slots = value.slots
  if (slots.length > 6 || value.golds.length > 12 || new Set(slots).size !== slots.length || new Set(value.golds).size !== value.golds.length ||
    slots.some(s => !['parent0', 'parent1', 'parent0-gp0', 'parent0-gp1', 'parent1-gp0', 'parent1-gp1'].includes(s as string))) return false
  if (slots.some(s => String(s).includes('-gp') && !slots.includes(['parent0-gp0', 'parent0-gp1'].includes(s as string) ? 'parent0' : 'parent1'))) return false
  return value.golds.every(g => slots.some(s => g === `${s}:gold0` || g === `${s}:gold1`))
}

/** A unit's build: its card set, loadout and node assignments, as one v14 run or one v15 preset holds them. */
function parseBuild(value: Record<string, unknown>, schemaVersion: number, tier: number): boolean {
  if (!parseUniqueIds(value.cardSetIds, CARD_SET_SIZE) || !parseUniqueIds(value.loadoutSkillIds)) return false
  if (!isRecord(value.assignments)) return false
  const nodeIds = Object.keys(value.assignments)
  if (nodeIds.length > MAX_CONSTELLATION_NODES || nodeIds.some((nodeId) => !isId(nodeId))) return false
  return nodeIds.every((nodeId) => parseNodeAssignment((value.assignments as Record<string, unknown>)[nodeId], schemaVersion, tier))
}

/** v15 (D252): Training Level, bought Extra stat nodes, Inspiration and the career shared; four presets of builds. */
function parseScenarioUnit(value: unknown, umaLevel: number, schemaVersion: number): boolean {
  if (!isRecord(value) || !exactKeys(value, SCENARIO_UNIT_FIELDS) || !validInspiration(value.inspiration)) return false
  if (!parseExtraStats({ unlocked: value.extraStatsUnlocked, active: [] })) return false
  if (!isPositiveInt(value.tier) || value.tier > MAX_SCENARIO_TIER || value.tier > Math.ceil(umaLevel / 10)) return false
  if (!isPositiveInt(value.trainingLevel) || value.trainingLevel > MAX_TRAINING_LEVEL) return false
  if (!isNonNegativeInt(value.trainingExp) || typeof value.started !== 'boolean') return false
  if (schemaVersion === 16 && value.trainingExp !== 0) return false
  if (value.trainingLevel === MAX_TRAINING_LEVEL ? value.trainingExp !== 0 : value.trainingExp >= TRAINING_EXP_PER_LEVEL) return false
  if (!isRecord(value.presets) || !exactKeys(value.presets, DISTANCES)) return false
  for (const distance of DISTANCES) {
    const preset = (value.presets as Record<string, unknown>)[distance]
    if (!isRecord(preset) || !exactKeys(preset, TRAINING_PRESET_FIELDS) ||
      !parseExtraStats({ unlocked: value.extraStatsUnlocked, active: preset.activeExtraStats }) ||
      !parseBuild(preset, schemaVersion, value.tier as number)) return false
  }
  if (value.journey === null) return true
  return parseJourney(value.journey, false) && (value.journey as Record<string, unknown>).tier === value.tier
}

function parseScenarioTraining(value: unknown, umaLevel: number, schemaVersion: number): boolean {
  if (schemaVersion >= 15) return parseScenarioUnit(value, umaLevel, schemaVersion)
  if (!isRecord(value) || !exactKeys(value, schemaVersion >= 14 ? [...SCENARIO_TRAINING_V12_FIELDS, 'inspiration'] : schemaVersion >= 12 ? SCENARIO_TRAINING_V12_FIELDS : SCENARIO_TRAINING_FIELDS)) return false
  if (schemaVersion >= 14 && !validInspiration(value.inspiration)) return false
  if (schemaVersion >= 12 && !parseExtraStats(value.extraStats)) return false
  if (!isPositiveInt(value.tier) || value.tier > MAX_SCENARIO_TIER || value.tier > Math.ceil(umaLevel / 10)) return false
  if (!isPositiveInt(value.trainingLevel) || value.trainingLevel > MAX_TRAINING_LEVEL) return false
  if (!isNonNegativeInt(value.trainingExp) || typeof value.started !== 'boolean') return false
  // v11 units sit on the linear curve: short of a level, and 0 at TL10 (D211).
  if (schemaVersion >= 11 && (value.trainingLevel === MAX_TRAINING_LEVEL
    ? value.trainingExp !== 0
    : value.trainingExp >= TRAINING_EXP_PER_LEVEL)) return false
  if (!parseBuild(value, schemaVersion, value.tier as number)) return false
  if (value.journey === null) return true
  return parseJourney(value.journey, false) && (value.journey as Record<string, unknown>).tier === value.tier
}

/**
 * v5 to v15 Umas share the Uma shape; v10 adds outfit race preferences, v11 re-levels on the linear curve, v12 adds
 * each unit's Extra stats grid (D235), v13 costs every scenario's Uma Levels the same (D241), and v15 gives each unit
 * four distance presets and the Uma the one in use (D252).
 */
function parseUmaV6(value: Record<string, unknown>): Record<string, unknown> | null {
  const withPreferences = (value.schemaVersion as number) >= 10
  const fields = (value.schemaVersion as number) >= 15 ? [...UMA_V10_FIELDS, 'activePreset'] : withPreferences ? UMA_V10_FIELDS : UMA_V6_FIELDS
  if (!exactKeys(value, fields) || ![5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16].includes(value.schemaVersion as number)) return null
  if ((value.schemaVersion as number) >= 15 && !DISTANCES.includes(value.activePreset as (typeof DISTANCES)[number])) return null
  if (withPreferences && value.racePreferences !== null &&
    (!isRecord(value.racePreferences) || !exactKeys(value.racePreferences, ['strategy', 'distance', 'surface']) ||
      !['front', 'pace', 'late', 'end'].includes(value.racePreferences.strategy as string) ||
      !['sprint', 'mile', 'medium', 'long'].includes(value.racePreferences.distance as string) ||
      !['turf', 'dirt'].includes(value.racePreferences.surface as string))) return null
  if (!isId(value.templateId) || !isPositiveInt(value.level) || value.level > MAX_UMA_LEVEL || !isNonNegativeInt(value.exp)) return null
  if (value.exp > umaExpLimit(value.level, (value.schemaVersion as number) >= 13 ? 'flat' : 'rising')) return null
  if (!isNonNegativeInt(value.goalPlanVersion) || value.goalPlanVersion > 4) return null

  const currentTier = Math.ceil((value.level as number) / 10)
  if (!isPositiveInt(value.unlockedTier) || value.unlockedTier > currentTier) return null
  if (!Array.isArray(value.scenarios) || value.scenarios.length === 0) return null
  if (value.scenarios.some((run) => !parseScenarioTraining(run, value.level as number, value.schemaVersion as number))) return null
  const runs = value.scenarios as Record<string, unknown>[]
  const tiers = runs.map((run) => run.tier as number)
  if (new Set(tiers).size !== tiers.length) return null
  // The active scenario is always the highest unlocked, and it must exist (D121).
  if (!tiers.includes(value.unlockedTier as number) || tiers.some((tier) => tier > (value.unlockedTier as number))) return null

  if (!Array.isArray(value.skillHistory)) return null
  if (value.skillHistory.some((entry) => !isRecord(entry) || !exactKeys(entry, SKILL_HISTORY_FIELDS) ||
    !parseSkill({ skillId: entry.skillId, origin: entry.origin, sourceId: entry.sourceId }) ||
    !isPositiveInt(entry.tier) || entry.tier > MAX_SCENARIO_TIER)) return null
  const history = value.skillHistory as Record<string, unknown>[]
  if (new Set(history.map((entry) => `${String(entry.tier)}:${String(entry.skillId)}`)).size !== history.length) return null
  return value
}

function parseUma(value: unknown): Record<string, unknown> | null {
  if (!isRecord(value)) return null
  if (exactKeys(value, LEGACY_UMA_FIELDS)) return parseUmaBase(value) ? value : null
  if ([5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16].includes(value.schemaVersion as number)) return parseUmaV6(value)
  const schemaVersion = value.schemaVersion
  const fields = schemaVersion === 4 ? CURRENT_UMA_FIELDS : UMA_FIELDS
  if (!exactKeys(value, fields) || ![2, 3, 4].includes(schemaVersion as number) || !parseUmaBase(value)) return null
  const current = schemaVersion === 3 || schemaVersion === 4
  if (typeof value.scenarioStarted !== 'boolean' || !isNonNegativeInt(value.goalPlanVersion) || value.goalPlanVersion > (current ? 2 : 1) || !Array.isArray(value.skillHistory) ||
    !Array.isArray(value.scenarioJourneys) || !parseSnapshots(value.currentParents) ||
    (value.parentSnapshot !== null && !parseSnapshot(value.parentSnapshot, value.templateId as string))) return null
  const history = value.skillHistory
  if (history.some((entry) => !isRecord(entry) || !exactKeys(entry, SKILL_HISTORY_FIELDS) ||
    !parseSkill({ skillId: entry.skillId, origin: entry.origin, sourceId: entry.sourceId }) || !isPositiveInt(entry.tier) || entry.tier > MAX_SCENARIO_TIER)) return null
  const historyRows = history as Record<string, unknown>[]
  if (new Set(historyRows.map((entry) => `${String(entry.tier)}:${String(entry.skillId)}`)).size !== historyRows.length) return null
  const library = value.skillLibrary as Record<string, unknown>[]
  if (library.some((unlock) => !historyRows.some((entry) => entry.skillId === unlock.skillId))) return null
  if (value.scenarioJourneys.some((journey) => !parseJourney(journey, !current))) return null
  const journeys = value.scenarioJourneys as Record<string, unknown>[]
  if (new Set(journeys.map((journey) => journey.tier)).size !== journeys.length || journeys.filter((journey) => journey.state === 'active').length > 1) return null
  const currentTier = Math.ceil((value.level as number) / 10)
  if (schemaVersion === 4 && value.scenarioModifier !== null) {
    if (!value.scenarioStarted || !parseScenarioModifier(value.scenarioModifier, currentTier)) return null
  }
  if (journeys.some((journey) => (journey.tier as number) > currentTier)) return null
  if ((value.goalPlanVersion as number) > 0) {
    const active = journeys.filter((journey) => journey.state === 'active')
    const snapshot = value.parentSnapshot as Record<string, unknown> | null
    const completedGate = (value.level as number) % 10 === 0 && snapshot?.completedTier === currentTier
    if (!value.scenarioStarted || completedGate) {
      if (active.length !== 0) return null
    } else if (active.length !== 1 || active[0]!.tier !== currentTier || active[0]!.tracking !== 'tracked') return null
  }
  return value
}

/** Stars (v7) and limit breaks (v6) belong to a scenario and are shared across Umas (D127): tier string → count. */
function parsePerTier(value: unknown, max: number): boolean {
  if (!isRecord(value)) return false
  return Object.entries(value).every(([tier, level]) =>
    /^[1-9][0-9]*$/.test(tier) && Number(tier) <= MAX_SCENARIO_TIER &&
    isNonNegativeInt(level) && (level as number) <= max)
}

function parseCard(value: unknown): Record<string, unknown> | null {
  if (isRecord(value) && exactKeys(value, CARD_GLOBAL_FIELDS)) {
    if (value.schemaVersion !== 1 || !isId(value.templateId) || !isNonNegativeInt(value.stars) ||
      value.stars > MAX_STARS || typeof value.maxCouponGranted !== 'boolean') return null
    return value
  }
  if (isRecord(value) && exactKeys(value, CARD_V8_FIELDS)) {
    if (!isId(value.templateId) || typeof value.maxCouponGranted !== 'boolean' || !parsePerTier(value.bonds, MAX_STARS)) return null
    return value
  }
  // Old clients still sync v7, v6 and v5 cards until they update; the app migrates them on read.
  if (isRecord(value) && exactKeys(value, CARD_V7_FIELDS)) {
    if (!isId(value.templateId) || typeof value.maxCouponGranted !== 'boolean' || !parsePerTier(value.stars, LEGACY_MAX_STARS_V7)) return null
    return value
  }
  if (isRecord(value) && exactKeys(value, CARD_V6_FIELDS)) {
    if (!isId(value.templateId) || typeof value.maxCouponGranted !== 'boolean' || !parsePerTier(value.limitBreaks, LEGACY_MAX_LIMIT_BREAK)) return null
    return value
  }
  if (isRecord(value) && exactKeys(value, CARD_V5_FIELDS)) {
    if (!isId(value.templateId) || typeof value.maxCouponGranted !== 'boolean') return null
    return isNonNegativeInt(value.limitBreak) && (value.limitBreak as number) <= LEGACY_MAX_LIMIT_BREAK ? value : null
  }
  if (!isRecord(value) || !exactKeys(value, CARD_FIELDS) || !isId(value.templateId) || !isPositiveInt(value.level) || value.level > 25 || !isNonNegativeInt(value.exp)) return null
  if (!isNonNegativeInt(value.limitBreak) || value.limitBreak > 4 || value.level > 5 * (value.limitBreak + 1)) return null
  const expToNext = 40 + 15 * (value.level - 1)
  if (value.exp > expToNext || (value.level < 5 * (value.limitBreak + 1) && value.exp === expToNext)) return null
  if (typeof value.maxCouponGranted !== 'boolean') return null
  return value
}

function parseLedger(value: unknown): Record<string, unknown> | null {
  if (!isRecord(value) || !exactKeys(value, LEDGER_FIELDS)) return null
  if (!LEDGER_RESOURCES.includes(value.resource as (typeof LEDGER_RESOURCES)[number])) return null
  if (!LEDGER_REASONS.includes(value.reason as (typeof LEDGER_REASONS)[number])) return null
  if (!Number.isSafeInteger(value.delta) || value.delta === 0 || !isNonNegativeInt(value.createdAt)) return null
  if (value.localDay !== null && !isLocalDay(value.localDay)) return null
  return value
}

function parseRaceStats(value: unknown): Record<string, unknown> | null {
  if (!isRecord(value) || !exactKeys(value, STATS)) return null
  if (STATS.some((key) => typeof value[key] !== 'number' || !Number.isFinite(value[key]) || (value[key] as number) < 0)) return null
  return value
}

function parseRaceAptitude(value: unknown): Record<string, unknown> | null {
  if (!isRecord(value) || !exactKeys(value, RACE_APTITUDE_FIELDS)) return null
  return RACE_APTITUDE_FIELDS.every((key) => GRADES.includes(value[key] as (typeof GRADES)[number])) ? value : null
}

function parseRaceCondition(value: unknown): boolean {
  return Array.isArray(value) && value.length > 0 && value.length <= 16 && value.every((group) =>
    Array.isArray(group) && group.length > 0 && group.length <= 16 && group.every((atom) =>
      isRecord(atom) && exactKeys(atom, ['variable', 'operator', 'value']) &&
      typeof atom.variable === 'string' && /^[a-zA-Z0-9_]+$/.test(atom.variable) &&
      ['<=', '>=', '==', '!=', '<', '>'].includes(String(atom.operator)) &&
      typeof atom.value === 'number' && Number.isFinite(atom.value),
    ),
  )
}

function parseCompiledSkill(value: unknown): boolean {
  if (!isRecord(value) || !exactKeys(value, ['id', 'activation', 'groups', 'inherited'])) return false
  if (!isId(value.id) || !['guaranteed', 'wit'].includes(String(value.activation)) ||
      typeof value.inherited !== 'boolean' || !Array.isArray(value.groups) || value.groups.length === 0 || value.groups.length > 16) return false
  return value.groups.every((group) => {
    if (!isRecord(group) || !exactKeys(group, [
      'precondition', 'condition', 'duration', 'cooldown', 'effects', 'unsupportedVariables', 'unsupportedEffects',
    ])) return false
    return (group.precondition === null || parseRaceCondition(group.precondition)) && parseRaceCondition(group.condition) &&
      typeof group.duration === 'number' && Number.isFinite(group.duration) && group.duration >= -1 &&
      typeof group.cooldown === 'number' && Number.isFinite(group.cooldown) && group.cooldown >= 0 &&
      Array.isArray(group.effects) && group.effects.every((effect) =>
        isRecord(effect) && exactKeys(effect, ['kind', 'amount']) &&
        RACE_SKILL_EFFECT_KINDS.includes(effect.kind as (typeof RACE_SKILL_EFFECT_KINDS)[number]) &&
        typeof effect.amount === 'number' && Number.isFinite(effect.amount),
      ) && Array.isArray(group.unsupportedVariables) &&
      group.unsupportedVariables.every((item) => typeof item === 'string' && /^[a-zA-Z0-9_]+$/.test(item)) &&
      Array.isArray(group.unsupportedEffects) && group.unsupportedEffects.every(Number.isSafeInteger)
  })
}

function parseCourseLayout(value: unknown, distance: number, withSlopes = false, withFrontTypes = false): boolean {
  if (!isRecord(value) || !exactKeys(value, withSlopes ? ['corners', 'straights', 'slopes'] : ['corners', 'straights']) ||
    !Array.isArray(value.corners) || !Array.isArray(value.straights) || (withSlopes && !Array.isArray(value.slopes))) return false
  const slopesValid = !withSlopes || (value.slopes as unknown[]).every((slope, index, all) =>
    isRecord(slope) && exactKeys(slope, ['start', 'end', 'slope']) &&
    typeof slope.start === 'number' && Number.isFinite(slope.start) && slope.start >= 0 &&
    typeof slope.end === 'number' && Number.isFinite(slope.end) && slope.end > slope.start && slope.end <= distance &&
    typeof slope.slope === 'number' && Number.isFinite(slope.slope) && slope.slope !== 0 && Math.abs(slope.slope) <= 100_000 &&
    (index === 0 || ((all[index - 1] as Record<string, unknown>).end as number) <= slope.start))
  if (!slopesValid) return false
  const valid = (segments: unknown[], corner: boolean) => segments.every((segment, index) => {
    // Engine v8 straights may name their front type (1 home, 2 back).
    const frontType = !corner && withFrontTypes && isRecord(segment) && Object.hasOwn(segment, 'frontType')
    if (!isRecord(segment) || !exactKeys(segment, corner ? ['start', 'end', 'number'] : frontType ? ['start', 'end', 'frontType'] : ['start', 'end'])) return false
    if (frontType && segment.frontType !== 1 && segment.frontType !== 2) return false
    if (typeof segment.start !== 'number' || !Number.isFinite(segment.start) || segment.start < 0 ||
      typeof segment.end !== 'number' || !Number.isFinite(segment.end) || segment.end <= segment.start || segment.end > distance ||
      (index > 0 && ((segments[index - 1] as Record<string, unknown>).end as number) > segment.start)) return false
    return !corner || (isPositiveInt(segment.number) && segment.number <= 32)
  })
  return valid(value.corners, true) && valid(value.straights, false) && (value.corners.length > 0 || value.straights.length > 0)
}

function parseRaceResult(value: unknown): Record<string, unknown> | null {
  if (!isRecord(value)) return null
  const versioned = Object.hasOwn(value, 'engineVersion')
  const hasCompletedGoalIds = Object.hasOwn(value, 'completedGoalIds')
  const hasAccomplishmentFacts = Object.hasOwn(value, 'accomplishmentFacts')
  const hasEarnedFlairEventIds = Object.hasOwn(value, 'earnedFlairEventIds')
  const hasTier = Object.hasOwn(value, 'tier')
  const version = value.engineVersion
  if (!exactKeys(value, [
    ...RACE_RESULT_FIELDS,
    ...(hasTier ? ['tier'] : []),
    ...(hasCompletedGoalIds ? ['completedGoalIds'] : []),
    ...(hasAccomplishmentFacts ? ['accomplishmentFacts'] : []),
    ...(hasEarnedFlairEventIds ? ['earnedFlairEventIds'] : []),
    ...(versioned ? ['engineVersion', 'course'] : []),
  ]) ||
      (versioned && ![2, 3, 4, 5, 6, 7, 8, 9].includes(version as number)) || !Array.isArray(value.field)) return null
  // Engines v6 (turns, D154) and v7 (D158) record the same course as v5; v8 (D231) adds the grade and straight types,
  // and v9 (D240) records v8's course.
  const v8Course = version === 8 || version === 9
  const v5Course = version === 5 || version === 6 || version === 7 || v8Course
  const hasLayout = version === 3 || version === 4 || v5Course
  if (versioned && (
    !isRecord(value.course) ||
    !exactKeys(value.course, v8Course ? RACE_COURSE_V8_FIELDS : v5Course ? RACE_COURSE_V5_FIELDS : hasLayout ? RACE_COURSE_V3_FIELDS : RACE_COURSE_FIELDS) ||
    !isPositiveInt(value.course.distance) || !['turf', 'dirt'].includes(String(value.course.surface)) ||
    !isNonNegativeInt(value.course.season) ||
    (hasLayout && !parseCourseLayout(value.course.layout, value.course.distance, v5Course, v8Course)) ||
    (v5Course && (!isNonNegativeInt(value.course.trackId) || !isNonNegativeInt(value.course.rotation))) ||
    (v8Course && !isNonNegativeInt(value.course.grade))
  )) return null
  const fieldSize = value.field.length
  if (
    !isId(value.contentVersion) || !isId(value.umaId) || !isId(value.raceId) ||
    !isNonNegativeInt(value.sequence) || !isNonNegativeInt(value.seed) ||
    !STRATEGIES.includes(value.strategy as (typeof STRATEGIES)[number]) ||
    !isPositiveInt(value.startLevel) || value.startLevel > MAX_UMA_LEVEL || !isNonNegativeInt(value.startExp) ||
    !parseRaceStats(value.startStats) || typeof value.raceBonus !== 'number' || !Number.isFinite(value.raceBonus) || value.raceBonus < 0 ||
    !isPositiveInt(value.playerPlacement) || value.playerPlacement > fieldSize || !isNonNegativeInt(value.expGained) ||
    !Array.isArray(value.levelsGained) || value.levelsGained.some((level) => !isPositiveInt(level) || level > MAX_UMA_LEVEL) ||
    // Five tickets a level before save v7, one after (D148); a record keeps the reward of its day.
    !isNonNegativeInt(value.ticketReward) || [1, 5].every((reward) => value.ticketReward !== (value.levelsGained as unknown[]).length * reward) ||
    !isNonNegativeInt(value.shardReward) || value.shardReward > 1 || fieldSize < 8 || fieldSize > 18 ||
    (hasCompletedGoalIds && parseUniqueIds(value.completedGoalIds) === null) ||
    (hasEarnedFlairEventIds && parseUniqueIds(value.earnedFlairEventIds) === null) ||
    !isNonNegativeInt(value.createdAt) ||
    // A race run as one of her earlier scenarios names it and pays nothing (D190).
    (hasTier && (!isPositiveInt(value.tier) || value.tier >= Math.ceil(value.startLevel / 10) || value.expGained !== 0 ||
      value.levelsGained.length > 0 || value.ticketReward !== 0 || value.shardReward !== 0 ||
      (hasCompletedGoalIds && (value.completedGoalIds as unknown[]).length > 0)))
  ) return null
  const runners = value.field as unknown[]
  for (const runner of runners) {
    if (!isRecord(runner) || !exactKeys(runner, [...RACE_RUNNER_FIELDS, ...(versioned ? ['skills'] : [])])) return null
    if (
      !isId(runner.umaId) || typeof runner.isPlayer !== 'boolean' ||
      !STRATEGIES.includes(runner.strategy as (typeof STRATEGIES)[number]) ||
      !isNonNegativeInt(runner.gate) || runner.gate >= fieldSize || !parseRaceStats(runner.stats) ||
      !parseRaceAptitude(runner.aptitude) || !isPositiveInt(runner.placement) || runner.placement > fieldSize ||
      typeof runner.finishTime !== 'number' || !Number.isFinite(runner.finishTime) || runner.finishTime < 0 ||
      typeof runner.marginLengths !== 'number' || !Number.isFinite(runner.marginLengths) || runner.marginLengths < 0 ||
      (versioned && (!Array.isArray(runner.skills) || runner.skills.some((skill) => !parseCompiledSkill(skill)) ||
        new Set(runner.skills.map((skill) => (skill as Record<string, unknown>).id)).size !== runner.skills.length))
    ) return null
  }
  const typed = runners as Record<string, unknown>[]
  const players = typed.filter((runner) => runner.isPlayer)
  const levels = value.levelsGained as number[]
  if (
    players.length !== 1 || players[0]!.umaId !== value.umaId || players[0]!.placement !== value.playerPlacement ||
    players[0]!.strategy !== value.strategy ||
    new Set(typed.map((runner) => runner.gate)).size !== fieldSize ||
    new Set(typed.map((runner) => runner.placement)).size !== fieldSize ||
    new Set(typed.map((runner) => runner.umaId)).size !== fieldSize ||
    new Set(levels).size !== levels.length || levels.some((level, index) => index > 0 && level <= levels[index - 1]!) ||
    (value.shardReward === 1 && (levels.at(-1) ?? -1) % 10 !== 0)
  ) return null
  if (hasAccomplishmentFacts && !parseRaceFacts(value.accomplishmentFacts, fieldSize, value.playerPlacement as number, value.course)) return null
  return value
}

export function parseEntityData(kind: EntityKind, value: unknown): Record<string, unknown> | null {
  if (FARM_ENTITY_KINDS.includes(kind as never)) return parseFarmEntity(kind, value)
  if (PUZZLE_ENTITY_KINDS.includes(kind as never)) return parsePuzzleEntity(kind, value)
  if (kind === 'profile') return parseProfile(value)
  if (kind === 'umas') return parseUma(value)
  if (kind === 'cards') return parseCard(value)
  if (kind === 'badges') return parseBadge(value)
  if (kind === 'farm') return parseFarmEntity(kind, value) ?? parseFarm(value)
  if (kind === 'inspirationBank') return parseInspirationBank(value) as unknown as Record<string, unknown> | null
  if (kind.startsWith('rpg')) return parseRpgEntity(kind, value)
  return parseItemStack(value)
}

export function parseLogData(kind: LogKind, value: unknown): Record<string, unknown> | null {
  if (kind === 'farmOperations') return parseFarmOperationLog(value) as unknown as Record<string, unknown> | null
  if (kind === 'itemLedger') { const entry = parseFarmCommandMovement(value); if (entry) return entry as unknown as Record<string, unknown> }
  if (kind === 'puzzleResults') return parsePuzzleResultSave(value) as unknown as Record<string, unknown> | null
  if (kind === 'puzzleOperations') return parsePuzzleOperationReceipt(value) as unknown as Record<string, unknown> | null
  if (kind === 'ledger') return parseLedger(value)
  if (kind === 'raceResults') return parseRaceResult(value)
  if (kind === 'flairEvents') return parseFlair(value)
  if (kind.startsWith('rpg')) return parseRpgLog(kind, value)
  return parseItemLedger(value)
}

export function saveEntityIdMatches(kind: EntityKind, id: string, data: Record<string, unknown>): boolean {
  if (FARM_ENTITY_KINDS.includes(kind as never) || kind === 'farm' && data.schemaVersion === 3) return farmEntityIdMatches(kind, id, data)
  if (PUZZLE_ENTITY_KINDS.includes(kind as never)) return puzzleEntityIdMatches(kind, id, data)
  if (kind.startsWith('rpg')) return rpgEntityIdMatches(kind, id, data)
  return (kind === 'profile' || kind === 'farm' || kind === 'inspirationBank') ? id === 'main' :
    (kind === 'umas' || kind === 'cards') ? data.templateId === id :
    kind === 'items' ? data.itemId === id :
    kind === 'badges' ? (data.scope === 'trainer' ? id === 'trainer' : id === `uma:${String(data.umaId)}`) : false
}

export function saveLogIdMatches(kind: LogKind, id: string, data: Record<string, unknown>, createdAt: number): boolean {
  if (kind === 'farmOperations') { const log = parseFarmOperationLog(data); return !!log && farmLogIdMatches(id, log) && log.createdAt === createdAt }
  if (kind === 'puzzleResults') return id === data.battleId && createdAt === data.createdAt
  if (kind === 'puzzleOperations') return id === (data.operation as PuzzleOperationV1).operationId && createdAt === data.createdAt
  if (kind.startsWith('rpg')) return rpgLogIdMatches(kind, id, data, createdAt)
  if (kind === 'raceResults') return id === `race:${String(data.umaId)}:${String(data.sequence)}` && createdAt === data.createdAt
  if (kind === 'flairEvents') return createdAt === data.earnedAt
  if (kind === 'itemLedger') return id === data.id && createdAt === data.createdAt
  return true
}

/** Shape-check an untrusted sync body before it reaches either repository implementation. */
export function parseSyncRequest(body: unknown): SyncRequest | string {
  if (!isRecord(body)) return 'body must be an object'
  const upserts = body.upserts ?? []
  const appends = body.appends ?? []
  const puzzleOperations = body.puzzleOperations === undefined ? undefined : parsePuzzleOperationBatch(body.puzzleOperations)
  const farmOperations = body.farmOperations === undefined ? undefined : parseFarmOperationBatch(body.farmOperations)
  if (body.farmOperations !== undefined && (!farmOperations || body.farmProtocolVersion !== 1)) return 'invalid Farm operations or protocol'
  if (body.farmProtocolVersion !== undefined && body.farmProtocolVersion !== 1) return 'unsupported Farm protocol'
  if (farmOperations?.length && body.farmProtocolVersion !== 1) return 'Farm operations require protocol 1'
  if (farmOperations?.length && puzzleOperations?.length) return 'Farm and Puzzle operations require separate batches'
  if (body.puzzleOperations !== undefined && !puzzleOperations) return 'invalid Puzzle operations or transport bounds'
  if (body.puzzleProtocolVersion !== undefined && body.puzzleProtocolVersion !== 1) return 'unsupported Puzzle protocol'
  if (!Array.isArray(upserts) || !Array.isArray(appends)) return 'upserts and appends must be arrays'
  if (upserts.length + appends.length + (puzzleOperations?.length ?? 0) + (farmOperations?.length ?? 0) > MAX_SYNC_OPERATIONS) return `at most ${MAX_SYNC_OPERATIONS} operations per sync`
  if (farmOperations?.length) {
    const refs = new Set(['farmCutover/main', 'constellationBank/main', ...upserts.map(u => isRecord(u) ? `${String(u.kind)}/${String(u.id)}` : ''),
      ...appends.map(a => isRecord(a) ? `${String(a.kind)}/${String(a.id)}` : '')])
    for (const operation of farmOperations) { const r = farmOperationReferences(operation); r.entities.forEach(k => refs.add(k)); r.logs.forEach(k => refs.add(k)) }
    if (refs.size > FARM_SYNC_LIMITS.documents || farmBytes(body) > FARM_SYNC_LIMITS.bytes) return 'Farm transport bounds exceeded'
  }
  if (puzzleOperations?.length) {
    const docs = new Set(['constellationBank/main', 'farmCutover/main', ...upserts.map(u => isRecord(u) ? `${String(u.kind)}/${String(u.id)}` : ''),
      ...appends.map(a => isRecord(a) ? `${String(a.kind)}/${String(a.id)}` : '')])
    for (const op of puzzleOperations) { const refs = puzzleOperationReferences(op); refs.entities.forEach(k => docs.add(k)); refs.logs.forEach(k => docs.add(k)) }
    if (docs.size > PUZZLE_SYNC_LIMITS.documents) return 'Puzzle transaction references too many documents'
  }

  const parsedUpserts: EntityUpsert[] = []
  for (const value of upserts) {
    if (!isRecord(value)) return 'upsert must be an object'
    if (!ENTITY_KINDS.includes(value.kind as EntityKind)) return `unknown entity kind ${String(value.kind)}`
    const kind = value.kind as EntityKind
    if (FARM_ENTITY_KINDS.includes(kind as never) || kind === 'farm' && isRecord(value.data) && value.data.schemaVersion === 3 ||
      kind === 'items' && typeof value.id === 'string' && value.id.startsWith('farm:')) return 'Farm projections require semantic operations'
    if (PUZZLE_ENTITY_KINDS.includes(kind as never)) return 'Puzzle projections require semantic operations'
    if (kind === 'items' && typeof value.id === 'string' && value.id.startsWith('constellation:')) return 'Puzzle inventory requires semantic operations'
    if (!isId(value.id)) return 'invalid entity id'
    if (!isNonNegativeInt(value.baseVersion)) return 'invalid baseVersion'
    const data = parseEntityData(kind, value.data)
    if (!data) return `invalid ${kind} data`
    // Campaign rows sync like any other save row (D263); pre-campaign RPG shapes stay command-only history.
    if (kind.startsWith('rpg') && (!rpgOrdinaryRow(kind, data) || !rpgEntityIdMatches(kind, value.id, data))) return `${kind} needs its campaign shape and id`
    if ((kind === 'profile' && value.id !== 'main') || (kind === 'farm' && value.id !== 'main') || (kind === 'inspirationBank' && value.id !== 'main') ||
      ((kind === 'umas' || kind === 'cards') && data.templateId !== value.id) ||
      (kind === 'items' && data.itemId !== value.id) ||
      (kind === 'badges' && (data.scope === 'trainer' ? value.id !== 'trainer' : value.id !== `uma:${String(data.umaId)}`))) return `${kind} id does not match data`
    if (value.deleted !== undefined && typeof value.deleted !== 'boolean') return 'invalid deleted flag'
    parsedUpserts.push({ kind, id: value.id, baseVersion: value.baseVersion, data, deleted: value.deleted as boolean | undefined })
  }

  const parsedAppends: LogAppend[] = []
  for (const value of appends) {
    if (!isRecord(value)) return 'append must be an object'
    if (!LOG_KINDS.includes(value.kind as LogKind)) return `unknown log kind ${String(value.kind)}`
    const kind = value.kind as LogKind
    if (kind === 'farmOperations' || kind === 'itemLedger' && isRecord(value.data) && value.data.reason === 'farm-command') return 'Farm evidence requires semantic operations'
    if (PUZZLE_LOG_KINDS.includes(kind as never) || kind === 'itemLedger' && isRecord(value.data) && value.data.reason === 'puzzle-material') return 'Puzzle evidence requires semantic operations'
    if (kind === 'rpgReceipts') return 'RPG receipts belong to the grouped command endpoint'
    if (!isId(value.id)) return 'invalid log id'
    const data = parseLogData(kind, value.data)
    if (!data) return `invalid ${kind} data`
    if (!isNonNegativeInt(value.createdAt)) return 'append createdAt must be a number'
    if (kind.startsWith('rpg') && (!rpgOrdinaryRow(kind, data) || !rpgLogIdMatches(kind, value.id, data, value.createdAt))) return `${kind} needs its campaign shape and id`
    if (kind === 'raceResults' && (value.id !== `race:${String(data.umaId)}:${String(data.sequence)}` || value.createdAt !== data.createdAt)) {
      return 'raceResults id or timestamp does not match data'
    }
    if (kind === 'flairEvents' && value.createdAt !== data.earnedAt) return 'flairEvents timestamp does not match data'
    if (kind === 'itemLedger' && (value.id !== data.id || value.createdAt !== data.createdAt)) {
      return 'itemLedger id or timestamp does not match data'
    }
    parsedAppends.push({ kind, id: value.id, data, createdAt: value.createdAt })
  }
  const entityKeys = parsedUpserts.map((item) => `${item.kind}/${item.id}`)
  const logKeys = parsedAppends.map((item) => `${item.kind}/${item.id}`)
  if (new Set(entityKeys).size !== entityKeys.length || new Set(logKeys).size !== logKeys.length) return 'duplicate operation id'
  return { upserts: parsedUpserts, appends: parsedAppends, ...(puzzleOperations ? { puzzleOperations } : {}),
    ...(farmOperations ? { farmOperations } : {}), ...(body.farmProtocolVersion === 1 ? { farmProtocolVersion: 1 as const } : {}),
    ...(body.puzzleProtocolVersion === 1 ? { puzzleProtocolVersion: 1 as const } : {}) }
}

/**
 * The save schema an entity is written in, where it can be told: profiles and Umas carry it; a card shows it by its
 * field (`bonds` v8, `stars` v7, `limitBreaks` v6, `limitBreak` older). A write in an older schema never replaces a newer one.
 */
function entitySchema(kind: string, data: Record<string, unknown>): number | null {
  if (kind === 'profile') return typeof data.schemaVersion === 'number' ? data.schemaVersion : null
  if (kind === 'umas') return typeof data.schemaVersion === 'number' ? data.schemaVersion : 1
  if (kind === 'cards') return data.schemaVersion === 1 ? 9 : 'bonds' in data ? 8 : 'stars' in data ? 7 : 'limitBreaks' in data ? 6 : 5
  if (kind === 'farm') return typeof data.schemaVersion === 'number' ? data.schemaVersion : null
  if (kind.startsWith('rpg')) return typeof data.schemaVersion === 'number' ? data.schemaVersion : null
  return null
}

/** Apply version-matched mutable entities and return authoritative server copies for stale writes. */
export function resolveUpserts(
  existing: Map<string, EntityRecord>,
  upserts: EntityUpsert[],
  now: number,
): { writes: EntityRecord[]; conflicts: EntityRecord[] } {
  const writes: EntityRecord[] = []
  const conflicts: EntityRecord[] = []
  for (const upsert of upserts) {
    const key = `${upsert.kind}/${upsert.id}`
    const current = existing.get(key)
    if (upsert.kind === 'inspirationBank' && (upsert.deleted || !current || current.deleted || upsert.baseVersion !== current.version ||
      !repaysInspiration(current.data, upsert.data))) {
      // The advance itself is server-owned; ordinary sync may only repay its debt (D256, D263).
      if (current) conflicts.push(current)
      continue
    }
    const currentVersion = current?.version ?? 0
    const currentSchema = current ? entitySchema(current.kind, current.data) : null
    const incomingSchema = entitySchema(upsert.kind, upsert.data)
    if (current && typeof currentSchema === 'number' && typeof incomingSchema === 'number' && currentSchema > incomingSchema) {
      conflicts.push(current)
      continue
    }
    if (current && upsert.baseVersion !== currentVersion) {
      conflicts.push(current)
      continue
    }
    // Global card progress is permanent. A matched stale device must not lower stars or erase a paid coupon (D255).
    if (current && !current.deleted && upsert.kind === 'umas' && [15, 16].includes(current.data.schemaVersion as number) &&
      !preservesInspiration(current.data, upsert.data, upsert.deleted === true)) {
      conflicts.push(current)
      continue
    }
    if (current && !current.deleted && upsert.kind === 'cards' && incomingSchema === 9 &&
      (Number(upsert.data.stars) < cardProgressCount(current.data) ||
        (current.data.maxCouponGranted === true && upsert.data.maxCouponGranted !== true))) {
      conflicts.push(current)
      continue
    }
    const record: EntityRecord = {
      kind: upsert.kind,
      id: upsert.id,
      version: currentVersion + 1,
      data: upsert.data,
      deleted: upsert.deleted ?? false,
      updatedAt: now,
    }
    existing.set(key, record)
    writes.push(record)
  }
  return { writes, conflicts }
}

/** Same frozen advance, every balance moved toward zero. */
function repaysInspiration(before: Record<string, unknown>, after: Record<string, unknown>): boolean {
  const old = before.balances as Record<string, number>, next = after.balances as Record<string, number>
  return before.phase === after.phase && before.createdAt === after.createdAt &&
    JSON.stringify(before.cohort) === JSON.stringify(after.cohort) && JSON.stringify(before.opened) === JSON.stringify(after.opened) &&
    Object.keys(old).length === Object.keys(next).length && Object.keys(old).every((key) => next[key] !== undefined && next[key]! >= old[key]! && next[key]! <= 0)
}

/** Permanent shared Inspiration positions survive stale ordinary writes (D250, D256). */
function preservesInspiration(before: Record<string, unknown>, after: Record<string, unknown>, deleted: boolean): boolean {
  if (deleted || !Array.isArray(after.scenarios)) return false
  return (before.scenarios as Record<string, unknown>[]).every(unit => {
    const next = (after.scenarios as Record<string, unknown>[]).find(s => s.tier === unit.tier)
    const old = unit.inspiration as { slots: string[]; golds: string[] }
    const state = next?.inspiration as typeof old | undefined
    return !!state && old.slots.every(s => state.slots.includes(s)) && old.golds.every(g => state.golds.includes(g))
  })
}

/** Independently decoded legacy card scales; no game-rule dependency in the API. */
function cardProgressCount(data: Record<string, unknown>): number {
  if (data.schemaVersion === 1) return Number(data.stars)
  if ('bonds' in data) return Math.max(0, ...Object.values(data.bonds as Record<string, number>))
  const old = 'stars' in data ? Math.max(0, ...Object.values(data.stars as Record<string, number>)) :
    Math.ceil(1.25 * ('limitBreaks' in data ? Math.max(0, ...Object.values(data.limitBreaks as Record<string, number>)) : Number(data.limitBreak)))
  return Math.ceil(3 * old / 5)
}
