// Typed local-first save vocabulary and initialization (docs/technical/architecture.md).

import { MAX_STARS } from './cards'
import {
  badgeStateId,
  FLAIR_SERIES_LEG_KEY_PATTERN,
  FLAIR_SERIES_TAGS,
  parseBadgeState,
  parseFlairEvent,
  type FlairSeriesTag,
} from './badges'
import type { SupportCardTemplate, UmaTemplate } from './content'
import { DAILY_TICKETS, TICKET_STORAGE_CAP, redenominateTickets } from './economy'
import { expToNextUmaLevel, legacyExpToNextUmaLevel } from './progression'
import { CAREER_STAGES, careerHoldLevel, type CareerStage } from './career-stages'
import { parseRaceResultRecord } from './progression-race'
import {
  CARD_SET_SIZE,
  MAX_TRAINING_LEVEL,
  constellationTemplate,
  legacyProduceNodeIds,
  produceAssignmentStat,
  type LegacyNodeAssignment,
  type NodeAssignment,
} from './constellation'
import { emptyExtraStats, extraStatsFromProduce, parseExtraStats, type ExtraStatNodeId, type ExtraStats } from './extra-stats'
import { LEVELS_PER_SCENARIO, MAX_SCENARIO_TIER, MAX_UMA_LEVEL, SCENARIOS, isGateLevel, tierOfLevel } from './scenarios'
import { EXP_TO_NEXT_TRAINING_LEVEL, fitsTrainingCurve, relevelLegacyTraining } from './training'
import { DISTANCE_CATEGORIES, GRADES, STATS, STRATEGIES, SURFACES, type Aptitudes, type DistanceCategory, type Grade, type StatKey, type Stats, type Strategy, type Surface } from './types'
import { FARM_SCHEMA_VERSION } from './farm/constants'
import { migrateFarmStateToCurrent } from './farm/legacy'
import { parseFarmState, parseInventoryStackData, parseItemLedgerEntry, type FarmCropId } from './farm/types'
import { farmCropById } from './farm/catalog'
import { RPG_SAVE_SCHEMA_VERSION, parseRpgCheckpointSave, parseRpgCommandReceipt, parseRpgOutfitSave,
  parseRpgPresetSave, parseRpgPromotionEvidence, parseRpgResultEvidence, rpgCheckpointId,
  type RpgCommandAction, type RpgCommandReceiptV1 } from './rpg/save'

import { emptyInspiration, grandfatherInspiration, parseInspiration, type InspirationState } from './inspiration'

export const SAVE_SCHEMA_VERSION = 15 as const
export const LEGACY_SAVE_SCHEMA_VERSION = 1 as const
export const LEGACY_SAVE_SCHEMA_VERSION_V2 = 2 as const
export const LEGACY_SAVE_SCHEMA_VERSION_V3 = 3 as const
export const LEGACY_SAVE_SCHEMA_VERSION_V4 = 4 as const
export const LEGACY_SAVE_SCHEMA_VERSION_V5 = 5 as const
export const LEGACY_SAVE_SCHEMA_VERSION_V6 = 6 as const
export const LEGACY_SAVE_SCHEMA_VERSION_V7 = 7 as const
export const LEGACY_SAVE_SCHEMA_VERSION_V8 = 8 as const
export const LEGACY_SAVE_SCHEMA_VERSION_V9 = 9 as const
export const LEGACY_SAVE_SCHEMA_VERSION_V10 = 10 as const
export const LEGACY_SAVE_SCHEMA_VERSION_V11 = 11 as const
export const LEGACY_SAVE_SCHEMA_VERSION_V12 = 12 as const
export const LEGACY_SAVE_SCHEMA_VERSION_V13 = 13 as const
export const LEGACY_SAVE_SCHEMA_VERSION_V14 = 14 as const
export const SAVE_ID_PATTERN = /^[A-Za-z0-9_.:-]{1,120}$/
const LOCAL_DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/

export interface PlayerProfile {
  schemaVersion: typeof SAVE_SCHEMA_VERSION
  tickets: number
  cardCoupons: number
  umaCoupons: number
  umaShards: number
  lastDailyGrant: string | null
  featuredUmaId: string | null
  starterSeedContentVersion: string | null
  createdAt: number
  /**
   * Training EXP past TL10, account-wide (D212). Every full level's worth becomes a Training Level-Up Ticket: at once on a
   * commit, and at startup for what the v11 migration banked.
   */
  trainingExpBank: number
}

/** The profile before save v11 added the Training EXP bank. */
export type LegacyPlayerProfileBody = Omit<PlayerProfile, 'schemaVersion' | 'trainingExpBank'>

export type SkillOrigin = 'own-unique' | 'awakening' | 'card' | 'inherited'

export interface SkillUnlock {
  skillId: string
  origin: SkillOrigin
  sourceId: string | null
}

export interface SkillHistoryEntry extends SkillUnlock {
  tier: number
}

export interface FrozenParent {
  umaId: string
  charaId: string
  completedTier: number
  takenAt: number
  inheritedUniqueSkillId: string | null
  inheritableWhiteSkillIds: string[]
  aptitudes: Aptitudes
}

export interface ParentSnapshot extends FrozenParent {
  parents: FrozenParent[]
}

/** The three optional targets of goal plans v1 and v2, kept only on journeys frozen before careers. */
export type LegacyGoalSlot = 'aptitude' | 'identity' | 'challenge'
export { CAREER_STAGES, type CareerStage } from './career-stages'
export type GoalSlot = LegacyGoalSlot | CareerStage
/** Goal plan v4 repairs untouched careers whose targets left the regular race catalog (D194). */
export const SCENARIO_GOAL_VERSION = 4 as const
export type GoalStatus = 'active' | 'completed' | 'missed'

export interface ScenarioGoalLeg {
  key: string
  raceId: string
  status: GoalStatus
  completedRaceResultId: string | null
  completedAt: number | null
}

export interface ScenarioGoalSeries {
  tag: FlairSeriesTag
  legs: ScenarioGoalLeg[]
}

export interface ScenarioGoal {
  id: string
  slot: GoalSlot
  raceId: string | null
  kind: 'win' | 'win-by-margin' | 'win-series'
  series: ScenarioGoalSeries | null
  minimumMarginLengths: number
  status: GoalStatus
  completedRaceResultId: string | null
  completedAt: number | null
}

export interface ScenarioJourney {
  tier: number
  tracking: 'tracked' | 'legacy-untracked'
  state: 'active' | 'completed'
  completedAt: number | null
  goals: ScenarioGoal[]
}

/**
 * One persisted career run. Everything an Uma is inside a scenario lives here, and an Uma keeps one of
 * these per unlocked tier (D121).
 */
/** A scenario with one build, as saves up to v14 stored it; the shape a preset view still has (D252). */
export interface FlatScenarioTraining {
  tier: number
  /** 1–10, earned by Spark Match. Decides which constellation nodes are open. */
  trainingLevel: number
  trainingExp: number
  /** Up to six owned, era-eligible cards. The sixth is the scenario's dedicated SP slot. */
  cardSetIds: string[]
  /** nodeId → what fills it. The current configuration, and the only one kept. */
  assignments: Record<string, NodeAssignment>
  /** The Extra stats grid: nodes bought with this scenario's crops, and the six at most that pay (D235). */
  extraStats: ExtraStats
  /** Slot and natural-gold availability, independent of Training Level (D250). */
  inspiration: InspirationState
  loadoutSkillIds: string[]
  journey: ScenarioJourney | null
  /** False until the player confirms this scenario's start. */
  started: boolean
}

/**
 * One scenario's build for one distance (D252): its card set, the constellation's card and lineage nodes, which of the
 * bought Extra stat nodes are on, and the equipped skills.
 */
export interface TrainingPreset {
  cardSetIds: string[]
  assignments: Record<string, NodeAssignment>
  /** At most six of the unit's bought Extra stat nodes, in grid order (D235). */
  activeExtraStats: ExtraStatNodeId[]
  loadoutSkillIds: string[]
}

/**
 * A scenario as stored from save v15 (D252): what its four distance presets share (Training Level, the Extra stat nodes
 * bought with crops, Inspiration's open slots, the career) and the presets themselves.
 */
export interface ScenarioUnit {
  tier: number
  /** 1–10, earned by Spark Match. Decides which constellation nodes are open, for every preset. */
  trainingLevel: number
  trainingExp: number
  /** How many of each stat's Extra stat nodes are bought, for every preset (D235). */
  extraStatsUnlocked: ExtraStats['unlocked']
  inspiration: InspirationState
  presets: Record<DistanceCategory, TrainingPreset>
  journey: ScenarioJourney | null
  /** False until the player confirms this scenario's start. */
  started: boolean
}

/** One scenario seen through one distance preset: the unit's shared state and the preset's build (D252). */
export interface ScenarioTraining extends FlatScenarioTraining {
  preset: DistanceCategory
}

/** A v5–v11 unit: Produce nodes in the tree and no Extra stats grid. Only the migrations read it. */
export interface LegacyScenarioTraining extends Omit<FlatScenarioTraining, 'assignments' | 'extraStats' | 'inspiration'> {
  assignments: Record<string, LegacyNodeAssignment>
}

/** The v5–v11 Uma body around legacy units. */
export type LegacyUmaBody = Omit<UmaSave, 'schemaVersion' | 'scenarios' | 'activePreset'> & { scenarios: LegacyScenarioTraining[] }

/**
 * Stats, skill points, aptitudes, the skill library and the loadout are **not** stored: they are derived
 * from the active scenario's constellation on read (D121, docs/design/constellations.md).
 */
export interface RacePreferences {
  strategy: Strategy
  distance: DistanceCategory
  surface: Surface
}

export interface UmaSave {
  schemaVersion: typeof SAVE_SCHEMA_VERSION
  templateId: string
  /** Permanent, earned by racing only. Unlocks scenarios; does not feed stats. */
  level: number
  exp: number
  /** Highest unlocked scenario, and always the active one. */
  unlockedTier: number
  scenarios: ScenarioUnit[]
  skillHistory: SkillHistoryEntry[]
  goalPlanVersion: number
  /** The distance preset her profile shows and edits, and that every race-free use reads (D252). */
  activePreset: DistanceCategory
  /** Null means the deterministic template recommendation until the owner sets a preference. */
  racePreferences: RacePreferences | null
}

/** The v4 shape, retained only so a stored save can be migrated forward. */
export interface LegacyUmaSaveV4 {
  schemaVersion: typeof LEGACY_SAVE_SCHEMA_VERSION_V4
  templateId: string
  level: number
  exp: number
  trainingLevel: number
  trainingExp: number
  stats: Stats
  skillPoints: number
  aptitudes: Aptitudes
  deckCardIds: string[]
  skillLibrary: SkillUnlock[]
  loadoutSkillIds: string[]
  trainingsThisScenario: number
  scenarioStarted: boolean
  skillHistory: SkillHistoryEntry[]
  currentParents: ParentSnapshot[]
  parentSnapshot: ParentSnapshot | null
  goalPlanVersion: number
  scenarioJourneys: ScenarioJourney[]
  scenarioModifier: unknown
}

export interface LegacyPlayerProfileV1 extends LegacyPlayerProfileBody {
  schemaVersion: typeof LEGACY_SAVE_SCHEMA_VERSION
}

export interface LegacyPlayerProfileV2 extends LegacyPlayerProfileBody {
  schemaVersion: typeof LEGACY_SAVE_SCHEMA_VERSION_V2
}

export interface LegacyPlayerProfileV3 extends LegacyPlayerProfileBody {
  schemaVersion: typeof LEGACY_SAVE_SCHEMA_VERSION_V3
}

export interface LegacyPlayerProfileV4 extends LegacyPlayerProfileBody {
  schemaVersion: typeof LEGACY_SAVE_SCHEMA_VERSION_V4
}

export interface LegacyPlayerProfileV5 extends LegacyPlayerProfileBody {
  schemaVersion: typeof LEGACY_SAVE_SCHEMA_VERSION_V5
}

/** v6 counted tickets at five times today's value (D148). */
export interface LegacyPlayerProfileV6 extends LegacyPlayerProfileBody {
  schemaVersion: typeof LEGACY_SAVE_SCHEMA_VERSION_V6
}

/** v7 profiles have v8's shape; the bump belongs to the cards' three-star scale (D200). */
export interface LegacyPlayerProfileV7 extends LegacyPlayerProfileBody {
  schemaVersion: typeof LEGACY_SAVE_SCHEMA_VERSION_V7
}

/** v8 profiles have v9's shape; v9 belongs to Produce assignments on Uma rows. */
export interface LegacyPlayerProfileV8 extends LegacyPlayerProfileBody {
  schemaVersion: typeof LEGACY_SAVE_SCHEMA_VERSION_V8
}

export interface LegacyPlayerProfileV9 extends LegacyPlayerProfileBody {
  schemaVersion: typeof LEGACY_SAVE_SCHEMA_VERSION_V9
}

export interface LegacyPlayerProfileV10 extends LegacyPlayerProfileBody {
  schemaVersion: typeof LEGACY_SAVE_SCHEMA_VERSION_V10
}

/** v11 profiles have the current shape; v12 belongs to the Uma rows' Extra stats grid (D235). */
export interface LegacyPlayerProfileV11 extends Omit<PlayerProfile, 'schemaVersion'> {
  schemaVersion: typeof LEGACY_SAVE_SCHEMA_VERSION_V11
}

/** v12 profiles have the current shape too; v13 belongs to the Uma rows' level curve (D241). */
export interface LegacyPlayerProfileV12 extends Omit<PlayerProfile, 'schemaVersion'> {
  schemaVersion: typeof LEGACY_SAVE_SCHEMA_VERSION_V12
}

export interface LegacyScenarioGoalV2 extends Omit<ScenarioGoal, 'series' | 'kind' | 'raceId'> {
  raceId: string
  kind: 'win' | 'win-by-margin'
}

export interface LegacyScenarioJourneyV2 extends Omit<ScenarioJourney, 'goals'> {
  goals: LegacyScenarioGoalV2[]
}

export interface LegacyUmaSaveV3 extends Omit<LegacyUmaSaveV4, 'schemaVersion' | 'scenarioModifier'> {
  schemaVersion: typeof LEGACY_SAVE_SCHEMA_VERSION_V3
}

export interface LegacyUmaSaveV2 extends Omit<LegacyUmaSaveV3, 'schemaVersion' | 'scenarioJourneys'> {
  schemaVersion: typeof LEGACY_SAVE_SCHEMA_VERSION_V2
  scenarioJourneys: LegacyScenarioJourneyV2[]
}

export interface LegacyUmaSaveV1 extends Omit<LegacyUmaSaveV4,
  'schemaVersion' | 'scenarioStarted' | 'skillHistory' | 'currentParents' | 'parentSnapshot' | 'goalPlanVersion' | 'scenarioJourneys' | 'scenarioModifier'> {}

/**
 * Cards earn one star per clear of the card minigame, 0★–3★ (D200), and stars belong to the scenario they were earned in
 * but are shared by every Uma (D127). An absent tier means 0★ there. The field is `bonds`, not v7's `stars` (0★–5★) or
 * v6's `limitBreaks`, so a card on an older scale can never be read without its conversion.
 */
export interface CardSave {
  templateId: string
  bonds: Record<string, number>
  maxCouponGranted: boolean
}

/** The v7 shape: per-scenario stars on the five-star scale (D147). */
export interface LegacyCardSaveV7 {
  templateId: string
  stars: Record<string, number>
  maxCouponGranted: boolean
}

/** The v6 shape: per-scenario limit breaks, 0–4. */
export interface LegacyCardSaveV6 {
  templateId: string
  limitBreaks: Record<string, number>
  maxCouponGranted: boolean
}

/** The v5 shape, retained only so a stored save can be migrated forward. */
export interface LegacyCardSaveV5 {
  templateId: string
  limitBreak: number
  maxCouponGranted: boolean
}

export const LEDGER_RESOURCES = ['tickets', 'card-coupons', 'uma-coupons', 'uma-shards'] as const
export type LedgerResource = (typeof LEDGER_RESOURCES)[number]
export const LEDGER_REASONS = [
  'daily-grant',
  'initial-grant',
  'training',
  'uma-level',
  'card-level',
  'uma-promotion',
  'card-limit-break',
  'card-max',
  'uma-shard-exchange',
  'card-coupon-redeem',
  'uma-coupon-redeem',
  /** A card bought with tickets instead of a coupon (M016). */
  'card-unlock',
  /** Owner-only top-up for playtesting; never earned in play (docs/design/economy.md). */
  'dev-grant',
  /** A run retired before it could finish gives its ticket back: open Bond Recall runs at the cutover (D177). */
  'minigame-refund',
] as const
export type LedgerReason = (typeof LEDGER_REASONS)[number]

export interface LedgerEntry {
  resource: LedgerResource
  delta: number
  reason: LedgerReason
  localDay: string | null
  createdAt: number
}

export interface InitialSave {
  profile: PlayerProfile
  umas: UmaSave[]
  cards: CardSave[]
  ledger: { id: string; data: LedgerEntry }[]
}

export const ENTITY_KINDS = ['profile', 'umas', 'cards', 'badges', 'farm', 'items', 'rpgOutfits', 'rpgPresets', 'rpgCheckpoints'] as const
export type EntityKind = (typeof ENTITY_KINDS)[number]
export const LOG_KINDS = ['raceResults', 'ledger', 'flairEvents', 'itemLedger', 'rpgResults', 'rpgPromotions', 'rpgReceipts'] as const
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
}

export interface SyncResponse {
  applied: { kind: EntityKind; id: string; version: number }[]
  conflicts: EntityRecord[]
  appended: number
  serverTime: number
}

/** RPG mutations are never placed on the ordinary sync outbox. */
export interface RpgCommandRequest {
  schemaVersion: 1
  commandId: string
  action: RpgCommandAction
  expected: Array<{ kind: EntityKind; id: string; version: number }>
  upserts: Array<{ kind: EntityKind; id: string; data: Record<string, unknown> }>
  appends: LogAppend[]
}

export type RpgCommandResponse =
  | { status: 'applied' | 'duplicate'; receipt: RpgCommandReceiptV1; entities: EntityRecord[]; logs: LogRecord[] }
  | { status: 'conflict'; authoritative: Array<{ kind: EntityKind; id: string; record: EntityRecord | null }> }
  | { status: 'rejected'; reason: string }

export interface SaveSnapshot {
  entities: EntityRecord[]
  logs: LogRecord[]
  serverTime: number
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const isId = (value: unknown): value is string => typeof value === 'string' && SAVE_ID_PATTERN.test(value)
const isNonNegativeInt = (value: unknown): value is number => Number.isSafeInteger(value) && (value as number) >= 0
const isPositiveInt = (value: unknown): value is number => Number.isSafeInteger(value) && (value as number) > 0
const isTimestamp = (value: unknown): value is number => isNonNegativeInt(value)

export function isLocalDay(value: unknown): value is string {
  if (typeof value !== 'string' || !LOCAL_DAY_PATTERN.test(value)) return false
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(Date.UTC(year!, month! - 1, day))
  return date.getUTCFullYear() === year && date.getUTCMonth() === month! - 1 && date.getUTCDate() === day
}

function exactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  const actual = Object.keys(value).sort()
  return actual.length === keys.length && actual.every((key, index) => key === [...keys].sort()[index])
}

function parseStats(value: unknown): Stats | null {
  if (!isObject(value) || !exactKeys(value, STATS)) return null
  if (STATS.some((key) => !isNonNegativeInt(value[key]))) return null
  return Object.fromEntries(STATS.map((key) => [key, value[key] as number])) as Stats
}

function parseGrade(value: unknown): Grade | null {
  return typeof value === 'string' && GRADES.includes(value as Grade) ? (value as Grade) : null
}

function parseAptitudes(value: unknown): Aptitudes | null {
  if (!isObject(value) || !isObject(value.surface) || !isObject(value.distance) || !isObject(value.strategy)) return null
  const surface = value.surface
  const distance = value.distance
  const strategy = value.strategy
  const surfaceKeys = ['turf', 'dirt'] as const
  const distanceKeys = ['sprint', 'mile', 'medium', 'long'] as const
  const strategyKeys = ['front', 'pace', 'late', 'end'] as const
  if (!exactKeys(surface, surfaceKeys) || !exactKeys(distance, distanceKeys) || !exactKeys(strategy, strategyKeys)) return null
  if (
    surfaceKeys.some((key) => !parseGrade(surface[key])) ||
    distanceKeys.some((key) => !parseGrade(distance[key])) ||
    strategyKeys.some((key) => !parseGrade(strategy[key]))
  ) return null
  return {
    surface: Object.fromEntries(surfaceKeys.map((key) => [key, surface[key]])) as Aptitudes['surface'],
    distance: Object.fromEntries(distanceKeys.map((key) => [key, distance[key]])) as Aptitudes['distance'],
    strategy: Object.fromEntries(strategyKeys.map((key) => [key, strategy[key]])) as Aptitudes['strategy'],
  }
}

function parseUniqueIds(value: unknown, max = Number.POSITIVE_INFINITY): string[] | null {
  if (!Array.isArray(value) || value.length > max || value.some((item) => !isId(item))) return null
  const ids = value as string[]
  return new Set(ids).size === ids.length ? [...ids] : null
}

function assertSaveUmaTemplate(template: UmaTemplate): void {
  if (!isId(template.id) || !isId(template.charaId)) throw new Error('Uma content has an invalid reference id')
  if (typeof template.name !== 'string' || template.name.length === 0) throw new Error(`Uma ${template.id} has no name`)
  if (template.outfit !== null && typeof template.outfit !== 'string') throw new Error(`Uma ${template.id} has an invalid outfit`)
  if (typeof template.starter !== 'boolean' || !parseStats(template.baseStats) || !parseAptitudes(template.aptitudes)) {
    throw new Error(`Uma ${template.id} has invalid save initialization data`)
  }
  if (template.uniqueSkillId !== null && !isId(template.uniqueSkillId)) {
    throw new Error(`Uma ${template.id} has an invalid unique skill reference`)
  }
  if (!parseUniqueIds(template.awakeningSkillIds)) {
    throw new Error(`Uma ${template.id} has invalid awakening skill references`)
  }
  // Her innate and story-event skills (D186) are optional: a pack published before them has neither.
  for (const list of [template.innateSkillIds, template.eventSkillIds]) {
    if (list !== undefined && !parseUniqueIds(list)) throw new Error(`Uma ${template.id} has invalid own skill references`)
  }
}

function assertSaveCardTemplate(template: SupportCardTemplate): void {
  if (!isId(template.id) || !isId(template.charaId)) throw new Error('Card content has an invalid reference id')
  if (typeof template.starter !== 'boolean' || !parseUniqueIds(template.hintSkillIds) || !parseUniqueIds(template.eventSkillIds)) {
    throw new Error(`Card ${template.id} has invalid save initialization data`)
  }
}

/** Validate every content field T003 reads before save rows are written or rendered. */
export function assertSaveContent(umas: readonly UmaTemplate[], cards: readonly SupportCardTemplate[]): void {
  for (const template of umas) assertSaveUmaTemplate(template)
  for (const template of cards) assertSaveCardTemplate(template)
}

const LEGACY_PROFILE_KEYS = [
  'schemaVersion', 'tickets', 'cardCoupons', 'umaCoupons', 'umaShards', 'lastDailyGrant', 'featuredUmaId',
  'starterSeedContentVersion', 'createdAt',
] as const
const PROFILE_KEYS = [...LEGACY_PROFILE_KEYS, 'trainingExpBank'] as const

function parsePlayerProfileVersion<T extends 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10>(value: unknown, schemaVersion: T): (LegacyPlayerProfileBody & { schemaVersion: T }) | null {
  if (!isObject(value) || !exactKeys(value, LEGACY_PROFILE_KEYS)) return null
  if (value.schemaVersion !== schemaVersion) return null
  const fields = parseProfileFields(value)
  return fields ? { schemaVersion, ...fields } : null
}

function parseProfileFields(value: Record<string, unknown>): LegacyPlayerProfileBody | null {
  if (![value.tickets, value.cardCoupons, value.umaCoupons, value.umaShards].every(isNonNegativeInt)) return null
  if (value.lastDailyGrant !== null && !isLocalDay(value.lastDailyGrant)) return null
  if (value.featuredUmaId !== null && !isId(value.featuredUmaId)) return null
  if (value.starterSeedContentVersion !== null && !isId(value.starterSeedContentVersion)) return null
  if (!isTimestamp(value.createdAt)) return null
  return {
    tickets: value.tickets as number,
    cardCoupons: value.cardCoupons as number,
    umaCoupons: value.umaCoupons as number,
    umaShards: value.umaShards as number,
    lastDailyGrant: value.lastDailyGrant as string | null,
    featuredUmaId: value.featuredUmaId as string | null,
    starterSeedContentVersion: value.starterSeedContentVersion as string | null,
    createdAt: value.createdAt as number,
  }
}

export function parsePlayerProfile(value: unknown): PlayerProfile | null {
  if (!isObject(value) || !exactKeys(value, PROFILE_KEYS) || value.schemaVersion !== SAVE_SCHEMA_VERSION) return null
  if (!isNonNegativeInt(value.trainingExpBank)) return null
  const fields = parseProfileFields(value)
  return fields ? { schemaVersion: SAVE_SCHEMA_VERSION, ...fields, trainingExpBank: value.trainingExpBank } : null
}

export function parseLegacyPlayerProfileV11(value: unknown): LegacyPlayerProfileV11 | null {
  if (!isObject(value) || value.schemaVersion !== LEGACY_SAVE_SCHEMA_VERSION_V11) return null
  const parsed = parsePlayerProfile({ ...value, schemaVersion: SAVE_SCHEMA_VERSION })
  return parsed ? { ...parsed, schemaVersion: LEGACY_SAVE_SCHEMA_VERSION_V11 } : null
}

/** A stamp bump: v12 changes the Uma rows (D235), not the profile. */
export function migratePlayerProfileV11(value: LegacyPlayerProfileV11): PlayerProfile {
  const parsed = parseLegacyPlayerProfileV11(value)
  if (!parsed) throw new Error('Legacy v11 player profile is malformed')
  return { ...parsed, schemaVersion: SAVE_SCHEMA_VERSION }
}

export function parseLegacyPlayerProfileV12(value: unknown): LegacyPlayerProfileV12 | null {
  if (!isObject(value) || value.schemaVersion !== LEGACY_SAVE_SCHEMA_VERSION_V12) return null
  const parsed = parsePlayerProfile({ ...value, schemaVersion: SAVE_SCHEMA_VERSION })
  return parsed ? { ...parsed, schemaVersion: LEGACY_SAVE_SCHEMA_VERSION_V12 } : null
}

/** A stamp bump: v13 changes the Uma rows' level curve (D241), not the profile. */
export function migratePlayerProfileV12(value: LegacyPlayerProfileV12): PlayerProfile {
  const parsed = parseLegacyPlayerProfileV12(value)
  if (!parsed) throw new Error('Legacy v12 player profile is malformed')
  return { ...parsed, schemaVersion: SAVE_SCHEMA_VERSION }
}

export function parseLegacyPlayerProfileV1(value: unknown): LegacyPlayerProfileV1 | null {
  return parsePlayerProfileVersion(value, LEGACY_SAVE_SCHEMA_VERSION)
}

export function parseLegacyPlayerProfileV2(value: unknown): LegacyPlayerProfileV2 | null {
  return parsePlayerProfileVersion(value, LEGACY_SAVE_SCHEMA_VERSION_V2)
}

export function parseLegacyPlayerProfileV3(value: unknown): LegacyPlayerProfileV3 | null {
  return parsePlayerProfileVersion(value, LEGACY_SAVE_SCHEMA_VERSION_V3)
}

export function migratePlayerProfileV1(value: LegacyPlayerProfileV1): PlayerProfile {
  const parsed = parseLegacyPlayerProfileV1(value)
  if (!parsed) throw new Error('Legacy player profile is malformed')
  return migratePlayerProfileV6({ ...parsed, schemaVersion: LEGACY_SAVE_SCHEMA_VERSION_V6 })
}

export function migratePlayerProfileV2(value: LegacyPlayerProfileV2): PlayerProfile {
  const parsed = parseLegacyPlayerProfileV2(value)
  if (!parsed) throw new Error('Legacy v2 player profile is malformed')
  return migratePlayerProfileV6({ ...parsed, schemaVersion: LEGACY_SAVE_SCHEMA_VERSION_V6 })
}

export function migratePlayerProfileV3(value: LegacyPlayerProfileV3): PlayerProfile {
  const parsed = parseLegacyPlayerProfileV3(value)
  if (!parsed) throw new Error('Legacy v3 player profile is malformed')
  return migratePlayerProfileV6({ ...parsed, schemaVersion: LEGACY_SAVE_SCHEMA_VERSION_V6 })
}

export function parseLegacyPlayerProfileV4(value: unknown): LegacyPlayerProfileV4 | null {
  return parsePlayerProfileVersion(value, LEGACY_SAVE_SCHEMA_VERSION_V4)
}

export function migratePlayerProfileV4(value: LegacyPlayerProfileV4): PlayerProfile {
  const parsed = parseLegacyPlayerProfileV4(value)
  if (!parsed) throw new Error('Legacy v4 player profile is malformed')
  return migratePlayerProfileV6({ ...parsed, schemaVersion: LEGACY_SAVE_SCHEMA_VERSION_V6 })
}

export function parseLegacyPlayerProfileV5(value: unknown): LegacyPlayerProfileV5 | null {
  return parsePlayerProfileVersion(value, LEGACY_SAVE_SCHEMA_VERSION_V5)
}

export function migratePlayerProfileV5(value: LegacyPlayerProfileV5): PlayerProfile {
  const parsed = parseLegacyPlayerProfileV5(value)
  if (!parsed) throw new Error('Legacy v5 player profile is malformed')
  return migratePlayerProfileV6({ ...parsed, schemaVersion: LEGACY_SAVE_SCHEMA_VERSION_V6 })
}

export function parseLegacyPlayerProfileV6(value: unknown): LegacyPlayerProfileV6 | null {
  return parsePlayerProfileVersion(value, LEGACY_SAVE_SCHEMA_VERSION_V6)
}

export function parseLegacyPlayerProfileV7(value: unknown): LegacyPlayerProfileV7 | null {
  return parsePlayerProfileVersion(value, LEGACY_SAVE_SCHEMA_VERSION_V7)
}

export function parseLegacyPlayerProfileV8(value: unknown): LegacyPlayerProfileV8 | null {
  return parsePlayerProfileVersion(value, LEGACY_SAVE_SCHEMA_VERSION_V8)
}

export function parseLegacyPlayerProfileV9(value: unknown): LegacyPlayerProfileV9 | null {
  return parsePlayerProfileVersion(value, LEGACY_SAVE_SCHEMA_VERSION_V9)
}

export function migratePlayerProfileV9(value: LegacyPlayerProfileV9): PlayerProfile {
  const parsed = parseLegacyPlayerProfileV9(value)
  if (!parsed) throw new Error('Legacy v9 player profile is malformed')
  return { ...parsed, schemaVersion: SAVE_SCHEMA_VERSION, trainingExpBank: 0 }
}

export function parseLegacyPlayerProfileV10(value: unknown): LegacyPlayerProfileV10 | null {
  return parsePlayerProfileVersion(value, LEGACY_SAVE_SCHEMA_VERSION_V10)
}

/**
 * v11 adds the Training EXP bank (D212), empty here: what the re-levelled Umas carried past TL10 is added by whichever
 * path migrates them together (the Dexie walk or a legacy cloud save), and settled into tickets at startup.
 */
export function migratePlayerProfileV10(value: LegacyPlayerProfileV10): PlayerProfile {
  const parsed = parseLegacyPlayerProfileV10(value)
  if (!parsed) throw new Error('Legacy v10 player profile is malformed')
  return { ...parsed, schemaVersion: SAVE_SCHEMA_VERSION, trainingExpBank: 0 }
}

/** A stamp bump: v9 changes Uma constellation assignments, not the profile. */
export function migratePlayerProfileV8(value: LegacyPlayerProfileV8): PlayerProfile {
  const parsed = parseLegacyPlayerProfileV8(value)
  if (!parsed) throw new Error('Legacy v8 player profile is malformed')
  return { ...parsed, schemaVersion: SAVE_SCHEMA_VERSION, trainingExpBank: 0 }
}

/** A stamp bump: v8 changed the cards (D200), not the profile. */
export function migratePlayerProfileV7(value: LegacyPlayerProfileV7): PlayerProfile {
  const parsed = parseLegacyPlayerProfileV7(value)
  if (!parsed) throw new Error('Legacy v7 player profile is malformed')
  return { ...parsed, schemaVersion: SAVE_SCHEMA_VERSION, trainingExpBank: 0 }
}

/** One ticket became one run (D148): the balance is re-denominated once, here, and never again. */
export function migratePlayerProfileV6(value: LegacyPlayerProfileV6): PlayerProfile {
  const parsed = parseLegacyPlayerProfileV6(value)
  if (!parsed) throw new Error('Legacy v6 player profile is malformed')
  return { ...parsed, schemaVersion: SAVE_SCHEMA_VERSION, tickets: redenominateTickets(parsed.tickets), trainingExpBank: 0 }
}

/** Parse a profile at a storage/network boundary without treating an unknown schema as corrupt data. */
export function parsePlayerProfileOrThrow(value: unknown): PlayerProfile {
  if (isObject(value) && 'schemaVersion' in value && value.schemaVersion !== SAVE_SCHEMA_VERSION) {
    throw new Error(`App update required for save schema ${String(value.schemaVersion)}`)
  }
  const profile = parsePlayerProfile(value)
  if (!profile) throw new Error('Player profile is malformed')
  return profile
}

function parseSkillUnlock(value: unknown): SkillUnlock | null {
  if (!isObject(value) || !exactKeys(value, ['skillId', 'origin', 'sourceId']) || !isId(value.skillId)) return null
  if (!['own-unique', 'awakening', 'card', 'inherited'].includes(String(value.origin))) return null
  if (value.sourceId !== null && !isId(value.sourceId)) return null
  return { skillId: value.skillId, origin: value.origin as SkillOrigin, sourceId: value.sourceId as string | null }
}

function parseSkillHistoryEntry(value: unknown): SkillHistoryEntry | null {
  if (!isObject(value) || !exactKeys(value, ['skillId', 'origin', 'sourceId', 'tier'])) return null
  const unlock = parseSkillUnlock({ skillId: value.skillId, origin: value.origin, sourceId: value.sourceId })
  if (!unlock || !isPositiveInt(value.tier) || value.tier > SCENARIOS.length) return null
  return { ...unlock, tier: value.tier }
}

function parseFrozenParent(value: unknown): FrozenParent | null {
  if (!isObject(value) || !exactKeys(value, [
    'umaId', 'charaId', 'completedTier', 'takenAt', 'inheritedUniqueSkillId', 'inheritableWhiteSkillIds', 'aptitudes',
  ])) return null
  const aptitudes = parseAptitudes(value.aptitudes)
  const whiteIds = parseUniqueIds(value.inheritableWhiteSkillIds)
  if (
    !isId(value.umaId) || !isId(value.charaId) || !isPositiveInt(value.completedTier) ||
    value.completedTier > SCENARIOS.length || !isTimestamp(value.takenAt) ||
    (value.inheritedUniqueSkillId !== null && !isId(value.inheritedUniqueSkillId)) || !whiteIds || !aptitudes
  ) return null
  return {
    umaId: value.umaId,
    charaId: value.charaId,
    completedTier: value.completedTier,
    takenAt: value.takenAt,
    inheritedUniqueSkillId: value.inheritedUniqueSkillId as string | null,
    inheritableWhiteSkillIds: whiteIds,
    aptitudes,
  }
}

function parseFrozenParents(value: unknown): FrozenParent[] | null {
  if (!Array.isArray(value) || value.length > 2) return null
  const parents = value.map(parseFrozenParent)
  if (parents.some((parent) => parent === null)) return null
  const valid = parents as FrozenParent[]
  if (new Set(valid.map((parent) => parent.umaId)).size !== valid.length) return null
  if (new Set(valid.map((parent) => parent.charaId)).size !== valid.length) return null
  return valid
}

function parseParentSnapshots(value: unknown): ParentSnapshot[] | null {
  if (!Array.isArray(value) || value.length > 2) return null
  const parents = value.map(parseParentSnapshot)
  if (parents.some((parent) => parent === null)) return null
  const valid = parents as ParentSnapshot[]
  if (new Set(valid.map((parent) => parent.umaId)).size !== valid.length) return null
  if (new Set(valid.map((parent) => parent.charaId)).size !== valid.length) return null
  return valid
}

function parseParentSnapshot(value: unknown): ParentSnapshot | null {
  if (!isObject(value) || !exactKeys(value, [
    'umaId', 'charaId', 'completedTier', 'takenAt', 'inheritedUniqueSkillId', 'inheritableWhiteSkillIds', 'aptitudes', 'parents',
  ])) return null
  const parent = parseFrozenParent({
    umaId: value.umaId,
    charaId: value.charaId,
    completedTier: value.completedTier,
    takenAt: value.takenAt,
    inheritedUniqueSkillId: value.inheritedUniqueSkillId,
    inheritableWhiteSkillIds: value.inheritableWhiteSkillIds,
    aptitudes: value.aptitudes,
  })
  const parents = parseFrozenParents(value.parents)
  return parent && parents ? { ...parent, parents } : null
}

const LEGACY_GOAL_SLOTS: readonly LegacyGoalSlot[] = ['aptitude', 'identity', 'challenge']
const GOAL_SLOTS: readonly GoalSlot[] = [...LEGACY_GOAL_SLOTS, ...CAREER_STAGES]
const isCareerStage = (slot: GoalSlot): slot is CareerStage => (CAREER_STAGES as readonly string[]).includes(slot)
/** Each career stage's goal count: one maiden race, two trials, and one to four main goals. */
const CAREER_STAGE_COUNTS: Readonly<Record<CareerStage, { min: number; max: number }>> = {
  maiden: { min: 1, max: 1 },
  trials: { min: 2, max: 2 },
  main: { min: 1, max: 4 },
}

function hasValidGoalEvidence(value: Record<string, unknown>): boolean {
  const completed = value.status === 'completed'
  return completed
    ? isId(value.completedRaceResultId) && isTimestamp(value.completedAt)
    : value.completedRaceResultId === null && value.completedAt === null
}

function parseScenarioGoalLeg(value: unknown): ScenarioGoalLeg | null {
  if (!isObject(value) || !exactKeys(value, ['key', 'raceId', 'status', 'completedRaceResultId', 'completedAt'])) return null
  if (typeof value.key !== 'string' || value.key.length > 40 || !FLAIR_SERIES_LEG_KEY_PATTERN.test(value.key) || !isId(value.raceId)) return null
  if (!['active', 'completed', 'missed'].includes(String(value.status)) || !hasValidGoalEvidence(value)) return null
  return {
    key: value.key,
    raceId: value.raceId,
    status: value.status as GoalStatus,
    completedRaceResultId: value.completedRaceResultId as string | null,
    completedAt: value.completedAt as number | null,
  }
}

function parseScenarioGoalSeries(value: unknown): ScenarioGoalSeries | null {
  if (!isObject(value) || !exactKeys(value, ['tag', 'legs']) || !FLAIR_SERIES_TAGS.includes(value.tag as FlairSeriesTag)) return null
  if (!Array.isArray(value.legs) || value.legs.length < 2 || value.legs.length > 3) return null
  const legs = value.legs.map(parseScenarioGoalLeg)
  if (legs.some((leg) => leg === null)) return null
  const valid = legs as ScenarioGoalLeg[]
  if (new Set(valid.map((leg) => leg.key)).size !== valid.length || new Set(valid.map((leg) => leg.raceId)).size !== valid.length) return null
  return { tag: value.tag as FlairSeriesTag, legs: valid }
}

function parseScenarioGoal(value: unknown, tier: number): ScenarioGoal | null {
  if (!isObject(value) || !exactKeys(value, [
    'id', 'slot', 'raceId', 'kind', 'series', 'minimumMarginLengths', 'status', 'completedRaceResultId', 'completedAt',
  ])) return null
  if (!GOAL_SLOTS.includes(value.slot as GoalSlot) || !['win', 'win-by-margin', 'win-series'].includes(String(value.kind))) return null
  if (typeof value.minimumMarginLengths !== 'number' || !Number.isFinite(value.minimumMarginLengths) || value.minimumMarginLengths < 0) return null
  if (value.slot === 'challenge' ? value.kind !== 'win-by-margin' || value.minimumMarginLengths !== 5 : value.minimumMarginLengths !== 0) return null
  if (value.kind === 'win-series' && value.slot !== 'identity' && value.slot !== 'main') return null
  if (!['active', 'completed', 'missed'].includes(String(value.status))) return null
  // A career goal's id carries its place in the stage, so the journey checks it.
  if (!isCareerStage(value.slot as GoalSlot) && value.id !== `goal:${tier}:${String(value.slot)}`) return null
  if (typeof value.id !== 'string' || !value.id.startsWith(`goal:${tier}:`)) return null
  if (!hasValidGoalEvidence(value)) return null
  const series = value.kind === 'win-series' ? parseScenarioGoalSeries(value.series) : null
  if (value.kind === 'win-series') {
    if (value.raceId !== null || !series) return null
    const active = series.legs.filter((leg) => leg.status === 'active').length
    const missed = series.legs.filter((leg) => leg.status === 'missed').length
    if (value.status === 'active' && (active === 0 || missed > 0)) return null
    if (value.status === 'completed' && (active > 0 || missed > 0 || !series.legs.some((leg) =>
      leg.completedRaceResultId === value.completedRaceResultId && leg.completedAt === value.completedAt))) return null
    if (value.status === 'missed' && (active > 0 || missed === 0)) return null
  } else {
    if (!isId(value.raceId) || value.series !== null) return null
    if (value.slot === 'challenge' ? value.kind !== 'win-by-margin' : value.kind !== 'win') return null
  }
  return {
    id: value.id,
    slot: value.slot as GoalSlot,
    raceId: value.raceId as string | null,
    kind: value.kind as ScenarioGoal['kind'],
    series,
    minimumMarginLengths: value.minimumMarginLengths,
    status: value.status as GoalStatus,
    completedRaceResultId: value.completedRaceResultId as string | null,
    completedAt: value.completedAt as number | null,
  }
}

function parseLegacyScenarioGoalV2(value: unknown, tier: number): LegacyScenarioGoalV2 | null {
  if (!isObject(value) || !exactKeys(value, [
    'id', 'slot', 'raceId', 'kind', 'minimumMarginLengths', 'status', 'completedRaceResultId', 'completedAt',
  ])) return null
  if (!LEGACY_GOAL_SLOTS.includes(value.slot as LegacyGoalSlot) || !isId(value.raceId) || !['win', 'win-by-margin'].includes(String(value.kind))) return null
  if (typeof value.minimumMarginLengths !== 'number' || !Number.isFinite(value.minimumMarginLengths) || value.minimumMarginLengths < 0) return null
  if (value.slot === 'challenge' ? value.kind !== 'win-by-margin' || value.minimumMarginLengths !== 5 : value.kind !== 'win' || value.minimumMarginLengths !== 0) return null
  if (!['active', 'completed', 'missed'].includes(String(value.status)) || value.id !== `goal:${tier}:${String(value.slot)}` || !hasValidGoalEvidence(value)) return null
  return {
    id: value.id,
    slot: value.slot as GoalSlot,
    raceId: value.raceId,
    kind: value.kind as LegacyScenarioGoalV2['kind'],
    minimumMarginLengths: value.minimumMarginLengths,
    status: value.status as GoalStatus,
    completedRaceResultId: value.completedRaceResultId as string | null,
    completedAt: value.completedAt as number | null,
  }
}

/** Goal plans v1–v2: exactly the three legacy slots, each once. */
function isLegacyGoalPlan(goals: readonly ScenarioGoal[]): boolean {
  return goals.length === LEGACY_GOAL_SLOTS.length && goals.every((goal) => !isCareerStage(goal.slot)) &&
    new Set(goals.map((goal) => goal.slot)).size === LEGACY_GOAL_SLOTS.length
}

/**
 * Goal plan v3+: stages in order, each with its documented count, ids numbered within the stage
 * (`goal:3:maiden`, `goal:3:trials:1`, `goal:3:main:2`), and at most one series goal, among the main goals.
 */
function isCareerGoalPlan(goals: readonly ScenarioGoal[], tier: number): boolean {
  let index = 0
  for (const stage of CAREER_STAGES) {
    const stageGoals: ScenarioGoal[] = []
    while (goals[index]?.slot === stage) stageGoals.push(goals[index++]!)
    const { min, max } = CAREER_STAGE_COUNTS[stage]
    if (stageGoals.length < min || stageGoals.length > max) return false
    if (stageGoals.some((goal, position) => goal.id !== (max === 1 ? `goal:${tier}:${stage}` : `goal:${tier}:${stage}:${position + 1}`))) return false
  }
  return index === goals.length && goals.filter((goal) => goal.kind === 'win-series').length <= 1 &&
    goals.every((goal) => goal.kind !== 'win-by-margin')
}

export function parseScenarioJourney(value: unknown): ScenarioJourney | null {
  if (!isObject(value) || !exactKeys(value, ['tier', 'tracking', 'state', 'completedAt', 'goals'])) return null
  if (!isPositiveInt(value.tier) || value.tier > SCENARIOS.length) return null
  if (!['tracked', 'legacy-untracked'].includes(String(value.tracking)) || !['active', 'completed'].includes(String(value.state))) return null
  if (value.state === 'active' && value.completedAt !== null) return null
  if (value.state === 'completed' && value.tracking === 'tracked' && !isTimestamp(value.completedAt)) return null
  if (value.state === 'completed' && value.tracking === 'legacy-untracked' && value.completedAt !== null && !isTimestamp(value.completedAt)) return null
  if (!Array.isArray(value.goals)) return null
  const goals = value.goals.map((goal) => parseScenarioGoal(goal, value.tier as number))
  if (goals.some((goal) => goal === null)) return null
  const validGoals = goals as ScenarioGoal[]
  if (value.tracking === 'legacy-untracked' && validGoals.length !== 0) return null
  if (value.tracking === 'legacy-untracked' && value.state !== 'completed') return null
  if (value.tracking === 'tracked') {
    if (!validGoals.every((goal) => isCareerStage(goal.slot)) ? !isLegacyGoalPlan(validGoals) : !isCareerGoalPlan(validGoals, value.tier)) return null
    const raceIds = validGoals.flatMap((goal) => goal.series?.legs.map((leg) => leg.raceId) ?? (goal.raceId ? [goal.raceId] : []))
    if (new Set(raceIds).size !== raceIds.length) return null
  }
  if (value.state === 'active' && validGoals.some((goal) => goal.status === 'missed')) return null
  if (value.state === 'completed' && validGoals.some((goal) => goal.status === 'active')) return null
  return {
    tier: value.tier,
    tracking: value.tracking as ScenarioJourney['tracking'],
    state: value.state as ScenarioJourney['state'],
    completedAt: value.completedAt as number | null,
    goals: validGoals,
  }
}

function parseLegacyScenarioJourneyV2(value: unknown): LegacyScenarioJourneyV2 | null {
  if (!isObject(value) || !exactKeys(value, ['tier', 'tracking', 'state', 'completedAt', 'goals'])) return null
  if (!isPositiveInt(value.tier) || value.tier > SCENARIOS.length) return null
  if (!['tracked', 'legacy-untracked'].includes(String(value.tracking)) || !['active', 'completed'].includes(String(value.state))) return null
  if (value.state === 'active' && value.completedAt !== null) return null
  if (value.state === 'completed' && value.tracking === 'tracked' && !isTimestamp(value.completedAt)) return null
  if (value.state === 'completed' && value.tracking === 'legacy-untracked' && value.completedAt !== null && !isTimestamp(value.completedAt)) return null
  if (!Array.isArray(value.goals)) return null
  const goals = value.goals.map((goal) => parseLegacyScenarioGoalV2(goal, value.tier as number))
  if (goals.some((goal) => goal === null)) return null
  const valid = goals as LegacyScenarioGoalV2[]
  if (value.tracking === 'legacy-untracked' && (valid.length !== 0 || value.state !== 'completed')) return null
  if (value.tracking === 'tracked' && (valid.length !== LEGACY_GOAL_SLOTS.length || new Set(valid.map((goal) => goal.slot)).size !== LEGACY_GOAL_SLOTS.length || new Set(valid.map((goal) => goal.raceId)).size !== LEGACY_GOAL_SLOTS.length)) return null
  if (value.state === 'active' && valid.some((goal) => goal.status === 'missed')) return null
  if (value.state === 'completed' && valid.some((goal) => goal.status === 'active')) return null
  return {
    tier: value.tier,
    tracking: value.tracking as ScenarioJourney['tracking'],
    state: value.state as ScenarioJourney['state'],
    completedAt: value.completedAt as number | null,
    goals: valid,
  }
}

const LEGACY_UMA_KEYS = [
  'templateId', 'level', 'exp', 'trainingLevel', 'trainingExp', 'stats', 'skillPoints', 'aptitudes', 'deckCardIds',
  'skillLibrary', 'loadoutSkillIds', 'trainingsThisScenario',
] as const
const LEGACY_UMA_V4_KEYS = [
  'schemaVersion', ...LEGACY_UMA_KEYS, 'scenarioStarted', 'skillHistory', 'currentParents', 'parentSnapshot',
  'goalPlanVersion', 'scenarioJourneys', 'scenarioModifier',
] as const
const UMA_VERSIONED_KEYS = [
  'schemaVersion', 'templateId', 'level', 'exp', 'unlockedTier', 'scenarios', 'skillHistory', 'goalPlanVersion', 'racePreferences',
] as const
/** Save v15 (D252): each unit holds four distance presets, and the Uma names the one in use. */
const UMA_V15_KEYS = [...UMA_VERSIONED_KEYS, 'activePreset'] as const
const SCENARIO_UNIT_KEYS = [
  'tier', 'trainingLevel', 'trainingExp', 'extraStatsUnlocked', 'inspiration', 'presets', 'journey', 'started',
] as const
const TRAINING_PRESET_KEYS = ['cardSetIds', 'assignments', 'activeExtraStats', 'loadoutSkillIds'] as const
const LEGACY_UMA_V9_KEYS = UMA_VERSIONED_KEYS.filter((key) => key !== 'racePreferences')
const LEGACY_SCENARIO_TRAINING_KEYS = [
  'tier', 'trainingLevel', 'trainingExp', 'cardSetIds', 'assignments', 'loadoutSkillIds', 'journey', 'started',
] as const
const SCENARIO_TRAINING_KEYS = [...LEGACY_SCENARIO_TRAINING_KEYS, 'extraStats'] as const
const SCENARIO_TRAINING_V14_KEYS = [...SCENARIO_TRAINING_KEYS, 'inspiration'] as const
const LEGACY_UMA_VERSIONED_KEYS = [
  'schemaVersion', ...LEGACY_UMA_KEYS, 'scenarioStarted', 'skillHistory', 'currentParents', 'parentSnapshot',
  'goalPlanVersion', 'scenarioJourneys',
] as const

/** Her EXP fits her level on a curve: short of the next level, or a gate's bank of one level at most. */
function umaExpFits(level: number, exp: number, toNext: (level: number) => number): boolean {
  return level === MAX_UMA_LEVEL ? exp === 0 : isGateLevel(level) ? exp <= toNext(level + 1) : exp < toNext(level)
}

function parseUmaCore(value: Record<string, unknown>): LegacyUmaSaveV1 | null {
  if (!isId(value.templateId)) return null
  if (!isPositiveInt(value.level) || value.level > MAX_UMA_LEVEL || !isNonNegativeInt(value.exp)) return null
  if (!umaExpFits(value.level, value.exp, legacyExpToNextUmaLevel)) return null
  if (!isPositiveInt(value.trainingLevel) || value.trainingLevel > MAX_TRAINING_LEVEL || !isNonNegativeInt(value.trainingExp)) return null
  if (
    (value.trainingLevel === MAX_TRAINING_LEVEL && value.trainingExp !== 0) ||
    (value.trainingLevel < MAX_TRAINING_LEVEL && value.trainingExp >= EXP_TO_NEXT_TRAINING_LEVEL)
  ) return null
  const stats = parseStats(value.stats)
  const aptitudes = parseAptitudes(value.aptitudes)
  const deckCardIds = parseUniqueIds(value.deckCardIds, 6)
  const loadoutSkillIds = parseUniqueIds(value.loadoutSkillIds)
  if (!stats || !aptitudes || !deckCardIds || !loadoutSkillIds || !isNonNegativeInt(value.skillPoints) || !isNonNegativeInt(value.trainingsThisScenario)) return null
  if (!Array.isArray(value.skillLibrary)) return null
  const skillLibrary = value.skillLibrary.map(parseSkillUnlock)
  if (skillLibrary.some((item) => item === null)) return null
  const skills = skillLibrary as SkillUnlock[]
  if (new Set(skills.map((item) => item.skillId)).size !== skills.length) return null
  const paidSkills = new Set(skills.filter((item) => item.origin !== 'own-unique').map((item) => item.skillId))
  if (loadoutSkillIds.some((id) => !paidSkills.has(id))) return null
  return {
    templateId: value.templateId,
    level: value.level,
    exp: value.exp,
    trainingLevel: value.trainingLevel,
    trainingExp: value.trainingExp,
    stats,
    skillPoints: value.skillPoints,
    aptitudes,
    deckCardIds,
    skillLibrary: skills,
    loadoutSkillIds,
    trainingsThisScenario: value.trainingsThisScenario,
  }
}

export function parseLegacyUmaSaveV1(value: unknown): LegacyUmaSaveV1 | null {
  return isObject(value) && exactKeys(value, LEGACY_UMA_KEYS) ? parseUmaCore(value) : null
}

export function migrateUmaSaveV1(value: LegacyUmaSaveV1): LegacyUmaSaveV10 {
  const parsed = parseLegacyUmaSaveV1(value)
  if (!parsed) throw new Error('Legacy Uma save is malformed')
  const tier = tierOfLevel(parsed.level)
  return migrateUmaSaveV4({
    schemaVersion: LEGACY_SAVE_SCHEMA_VERSION_V4,
    ...parsed,
    scenarioStarted: true,
    skillHistory: parsed.skillLibrary.map((unlock) => ({ ...unlock, tier })),
    currentParents: [],
    parentSnapshot: null,
    goalPlanVersion: 0,
    scenarioJourneys: [],
    scenarioModifier: null,
  })
}

function parseVersionedUmaSave<J extends ScenarioJourney | LegacyScenarioJourneyV2>(
  value: unknown,
  schemaVersion: 2 | 3 | 4,
  goalPlanVersion: 1 | 2,
  journeyParser: (value: unknown) => J | null,
): (Omit<LegacyUmaSaveV4, 'schemaVersion' | 'scenarioJourneys' | 'scenarioModifier'> & { schemaVersion: 2 | 3 | 4; scenarioJourneys: J[] }) | null {
  if (!isObject(value) || !exactKeys(value, LEGACY_UMA_VERSIONED_KEYS) || value.schemaVersion !== schemaVersion) return null
  const legacyShape = Object.fromEntries(LEGACY_UMA_KEYS.map((key) => [key, value[key]]))
  const base = parseUmaCore(legacyShape)
  if (!base || typeof value.scenarioStarted !== 'boolean' || !isNonNegativeInt(value.goalPlanVersion) || value.goalPlanVersion > goalPlanVersion) return null
  if (!Array.isArray(value.skillHistory) || !Array.isArray(value.scenarioJourneys)) return null
  const skillHistory = value.skillHistory.map(parseSkillHistoryEntry)
  if (skillHistory.some((entry) => entry === null)) return null
  const history = skillHistory as SkillHistoryEntry[]
  if (new Set(history.map((entry) => `${entry.tier}:${entry.skillId}`)).size !== history.length) return null
  if (base.skillLibrary.some((unlock) => !history.some((entry) => entry.skillId === unlock.skillId))) return null
  const currentParents = parseParentSnapshots(value.currentParents)
  if (!currentParents) return null
  const parentSnapshot = value.parentSnapshot === null ? null : parseParentSnapshot(value.parentSnapshot)
  if (value.parentSnapshot !== null && !parentSnapshot) return null
  if (parentSnapshot && parentSnapshot.umaId !== base.templateId) return null
  const scenarioJourneys = value.scenarioJourneys.map(journeyParser)
  if (scenarioJourneys.some((journey) => journey === null)) return null
  const journeys = scenarioJourneys as J[]
  if (new Set(journeys.map((journey) => journey.tier)).size !== journeys.length) return null
  if (journeys.filter((journey) => journey.state === 'active').length > 1) return null
  const currentTier = tierOfLevel(base.level)
  if (journeys.some((journey) => journey.tier > currentTier)) return null
  if (value.goalPlanVersion > 0) {
    const active = journeys.filter((journey) => journey.state === 'active')
    const completedGate = isGateLevel(base.level) && parentSnapshot?.completedTier === currentTier
    if (!value.scenarioStarted || completedGate) {
      if (active.length !== 0) return null
    } else if (active.length !== 1 || active[0]!.tier !== currentTier || active[0]!.tracking !== 'tracked') return null
  }
  return {
    schemaVersion,
    ...base,
    scenarioStarted: value.scenarioStarted,
    skillHistory: history,
    currentParents,
    parentSnapshot,
    goalPlanVersion: value.goalPlanVersion,
    scenarioJourneys: journeys,
  }
}

export function parseLegacyUmaSaveV2(value: unknown): LegacyUmaSaveV2 | null {
  return parseVersionedUmaSave(value, LEGACY_SAVE_SCHEMA_VERSION_V2, 1, parseLegacyScenarioJourneyV2) as LegacyUmaSaveV2 | null
}

export function migrateUmaSaveV2(value: LegacyUmaSaveV2): LegacyUmaSaveV10 {
  const parsed = parseLegacyUmaSaveV2(value)
  if (!parsed) throw new Error('Legacy v2 Uma save is malformed')
  return migrateUmaSaveV4({
    ...parsed,
    schemaVersion: LEGACY_SAVE_SCHEMA_VERSION_V4,
    scenarioModifier: null,
    scenarioJourneys: parsed.scenarioJourneys.map((journey) => ({
      ...journey,
      goals: journey.goals.map((goal): ScenarioGoal => ({ ...goal, series: null })),
    })),
  })
}

export function parseLegacyUmaSaveV3(value: unknown): LegacyUmaSaveV3 | null {
  return parseVersionedUmaSave(value, LEGACY_SAVE_SCHEMA_VERSION_V3, 2, parseScenarioJourney) as LegacyUmaSaveV3 | null
}

export function migrateUmaSaveV3(value: LegacyUmaSaveV3): LegacyUmaSaveV10 {
  const parsed = parseLegacyUmaSaveV3(value)
  if (!parsed) throw new Error('Legacy v3 Uma save is malformed')
  return migrateUmaSaveV4({ ...parsed, schemaVersion: LEGACY_SAVE_SCHEMA_VERSION_V4, scenarioModifier: null })
}

export function parseLegacyUmaSaveV4(value: unknown): LegacyUmaSaveV4 | null {
  if (!isObject(value) || !exactKeys(value, LEGACY_UMA_V4_KEYS) || value.schemaVersion !== LEGACY_SAVE_SCHEMA_VERSION_V4) {
    return null
  }
  const { scenarioModifier, ...legacyShape } = value
  const base = parseVersionedUmaSave(legacyShape, LEGACY_SAVE_SCHEMA_VERSION_V4, 2, parseScenarioJourney)
  if (!base) return null
  // Modifier state is discarded by the migration, so its shape is never validated.
  return { ...base, schemaVersion: LEGACY_SAVE_SCHEMA_VERSION_V4, scenarioModifier: scenarioModifier ?? null }
}

/**
 * v4 held one flat run. It becomes a single FlatScenarioTraining at her current tier.
 *
 * Assignments start empty and her stored stats are discarded: no configuration reproduces them, and
 * inventing one would be a lie about how she was built. Parents and modifier state are dropped outright.
 */
export function migrateUmaSaveV4(value: LegacyUmaSaveV4): LegacyUmaSaveV10 {
  const parsed = parseLegacyUmaSaveV4(value)
  if (!parsed) throw new Error('Legacy v4 Uma save is malformed')
  const tier = tierOfLevel(parsed.level)
  const journey = parsed.scenarioJourneys.find((entry) => entry.tier === tier) ?? null
  return {
    schemaVersion: LEGACY_SAVE_SCHEMA_VERSION_V10,
    templateId: parsed.templateId,
    level: parsed.level,
    exp: parsed.exp,
    unlockedTier: tier,
    scenarios: [{
      tier,
      trainingLevel: parsed.trainingLevel,
      trainingExp: parsed.trainingExp,
      cardSetIds: parsed.deckCardIds.slice(0, CARD_SET_SIZE),
      assignments: {},
      loadoutSkillIds: [],
      journey,
      started: parsed.scenarioStarted,
    }],
    skillHistory: parsed.skillHistory,
    goalPlanVersion: parsed.goalPlanVersion,
    racePreferences: null,
  }
}

function parseNodeAssignment(value: unknown): NodeAssignment | null {
  if (!isObject(value)) return null
  if (value.kind === 'card') {
    return exactKeys(value, ['kind', 'cardId']) && isId(value.cardId)
      ? { kind: 'card', cardId: value.cardId }
      : null
  }
  if (value.kind === 'lineage') {
    return exactKeys(value, ['kind', 'templateId']) && isId(value.templateId)
      ? { kind: 'lineage', templateId: value.templateId }
      : null
  }
  return null
}

function parseLegacyNodeAssignment(value: unknown): LegacyNodeAssignment | null {
  if (!isObject(value)) return null
  if (value.kind === 'card' || value.kind === 'lineage') return parseNodeAssignment(value)
  if (value.kind === 'produce') {
    return exactKeys(value, ['kind', 'itemId', 'revision']) && typeof value.itemId === 'string' &&
      farmCropById(value.itemId) !== null && isPositiveInt(value.revision)
      ? { kind: 'produce', itemId: value.itemId as FarmCropId, revision: value.revision }
      : null
  }
  if (value.kind === 'legacy-produce') {
    return exactKeys(value, ['kind', 'stat']) && STATS.includes(value.stat as StatKey)
      ? { kind: 'legacy-produce', stat: value.stat as StatKey }
      : null
  }
  return null
}

/** The fields every unit shape shares; the caller checks the keys and the assignments. */
function parseScenarioRun(value: Record<string, unknown>, umaLevel: number, curve: 'linear' | 'legacy'): Omit<FlatScenarioTraining, 'assignments' | 'extraStats' | 'inspiration'> | null {
  if (!isPositiveInt(value.tier) || value.tier > MAX_SCENARIO_TIER || value.tier > tierOfLevel(umaLevel)) return null
  if (!isPositiveInt(value.trainingLevel) || value.trainingLevel > MAX_TRAINING_LEVEL) return null
  if (!isNonNegativeInt(value.trainingExp)) return null
  if (curve === 'linear' && !fitsTrainingCurve(value.trainingLevel, value.trainingExp)) return null
  if (typeof value.started !== 'boolean') return null
  const cardSetIds = parseUniqueIds(value.cardSetIds, CARD_SET_SIZE)
  const loadoutSkillIds = parseUniqueIds(value.loadoutSkillIds)
  if (!cardSetIds || !loadoutSkillIds) return null
  const journey = value.journey === null ? null : parseScenarioJourney(value.journey)
  if (value.journey !== null && !journey) return null
  if (journey && journey.tier !== value.tier) return null
  return {
    tier: value.tier,
    trainingLevel: value.trainingLevel,
    trainingExp: value.trainingExp,
    cardSetIds,
    loadoutSkillIds,
    journey,
    started: value.started,
  }
}

/** A v12 unit: card and lineage nodes in the tree, and the Extra stats grid beside it (D235). */
function parseScenarioTraining(value: unknown, umaLevel: number, legacy = false): FlatScenarioTraining | null {
  if (!isObject(value) || !exactKeys(value, legacy ? SCENARIO_TRAINING_KEYS : SCENARIO_TRAINING_V14_KEYS)) return null
  const run = parseScenarioRun(value, umaLevel, 'linear')
  if (!run || !isObject(value.assignments)) return null
  const nodes = new Set(constellationTemplate(run.tier).nodes.map((node) => node.id))
  const assignments: Record<string, NodeAssignment> = {}
  for (const [nodeId, raw] of Object.entries(value.assignments)) {
    // An assignment naming a node this template does not have is dropped, not fatal: a template can be
    // re-authored (T052) and a stale key must never lock the player out of her save.
    if (!nodes.has(nodeId)) continue
    const assignment = parseNodeAssignment(raw)
    if (!assignment) return null
    assignments[nodeId] = assignment
  }
  const extraStats = parseExtraStats(value.extraStats)
  const inspiration = legacy ? grandfatherInspiration(run.trainingLevel, assignments) : parseInspiration(value.inspiration)
  if (!extraStats || !inspiration) return null
  // Canonical key order: badge fingerprints hash the save's JSON.
  return { tier: run.tier, trainingLevel: run.trainingLevel, trainingExp: run.trainingExp, cardSetIds: run.cardSetIds,
    assignments, extraStats, inspiration, loadoutSkillIds: run.loadoutSkillIds, journey: run.journey, started: run.started }
}

/** A v5–v11 unit, whose Produce nodes were the tree's six drawn tips. */
function parseLegacyScenarioTraining(value: unknown, umaLevel: number, curve: 'linear' | 'legacy'): LegacyScenarioTraining | null {
  if (!isObject(value) || !exactKeys(value, LEGACY_SCENARIO_TRAINING_KEYS)) return null
  const run = parseScenarioRun(value, umaLevel, curve)
  if (!run || !isObject(value.assignments)) return null
  const tree = new Set(constellationTemplate(run.tier).nodes.map((node) => node.id))
  const produceNodes = new Set(legacyProduceNodeIds(run.tier))
  const assignments: Record<string, LegacyNodeAssignment> = {}
  for (const [nodeId, raw] of Object.entries(value.assignments)) {
    // A stale node id is dropped, not fatal, as in the current parser.
    if (!tree.has(nodeId) && !produceNodes.has(nodeId)) continue
    const assignment = parseLegacyNodeAssignment(raw)
    if (!assignment) return null
    const produce = assignment.kind === 'produce' || assignment.kind === 'legacy-produce'
    if (produce !== produceNodes.has(nodeId)) return null
    if (assignment.kind === 'produce' && farmCropById(assignment.itemId)?.scenarioTier !== run.tier) return null
    assignments[nodeId] = assignment
  }
  return { tier: run.tier, trainingLevel: run.trainingLevel, trainingExp: run.trainingExp, cardSetIds: run.cardSetIds,
    assignments, loadoutSkillIds: run.loadoutSkillIds, journey: run.journey, started: run.started }
}

export interface LegacyUmaSaveV5 extends Omit<LegacyUmaBody, 'racePreferences'> {
  schemaVersion: typeof LEGACY_SAVE_SCHEMA_VERSION_V5
}

export interface LegacyUmaSaveV6 extends Omit<LegacyUmaBody, 'racePreferences'> {
  schemaVersion: typeof LEGACY_SAVE_SCHEMA_VERSION_V6
}

export interface LegacyUmaSaveV7 extends Omit<LegacyUmaBody, 'racePreferences'> {
  schemaVersion: typeof LEGACY_SAVE_SCHEMA_VERSION_V7
}

export interface LegacyUmaSaveV8 extends Omit<LegacyUmaBody, 'racePreferences'> {
  schemaVersion: typeof LEGACY_SAVE_SCHEMA_VERSION_V8
}

/** v5–v8 used free Stat assignments. Translate those values before the current parser sees them. */
function parseLegacyProduceUma<T extends 5 | 6 | 7 | 8>(
  value: unknown,
  schemaVersion: T,
): (Omit<LegacyUmaBody, 'racePreferences'> & { schemaVersion: T }) | null {
  if (!isObject(value) || value.schemaVersion !== schemaVersion || !Array.isArray(value.scenarios)) return null
  const scenarios = value.scenarios.map((raw) => {
    if (!isObject(raw) || !isObject(raw.assignments)) return null
    const knownNodes = isPositiveInt(raw.tier) && raw.tier <= MAX_SCENARIO_TIER
      ? new Set([...constellationTemplate(raw.tier).nodes.map((node) => node.id), ...legacyProduceNodeIds(raw.tier)])
      : null
    const assignments: Record<string, unknown> = {}
    for (const [nodeId, assignment] of Object.entries(raw.assignments)) {
      // Preserve the current parser's stale-template tolerance during the one-way semantic migration.
      if (knownNodes && !knownNodes.has(nodeId)) continue
      if (!isObject(assignment)) return null
      if (assignment.kind === 'stat') {
        if (!exactKeys(assignment, ['kind', 'stat']) || !STATS.includes(assignment.stat as StatKey)) return null
        assignments[nodeId] = { kind: 'legacy-produce', stat: assignment.stat }
      } else if (assignment.kind === 'card' || assignment.kind === 'lineage') {
        assignments[nodeId] = assignment
      } else return null
    }
    return { ...raw, assignments }
  })
  if (scenarios.some((run) => run === null)) return null
  const parsed = parseLegacyUmaBody({ ...value, scenarios, racePreferences: null }, 'legacy')
  if (!parsed) return null
  const { racePreferences: _unused, ...legacy } = parsed
  return { ...legacy, schemaVersion }
}

export function parseLegacyUmaSaveV8(value: unknown): LegacyUmaSaveV8 | null {
  return parseLegacyProduceUma(value, LEGACY_SAVE_SCHEMA_VERSION_V8)
}

export function migrateUmaSaveV8(value: LegacyUmaSaveV8): LegacyUmaSaveV10 {
  const parsed = asLegacyUmaV10({ ...value, racePreferences: null })
  if (!parsed) throw new Error('Legacy v8 Uma save is malformed')
  return parsed
}

export function parseLegacyUmaSaveV7(value: unknown): LegacyUmaSaveV7 | null {
  return parseLegacyProduceUma(value, LEGACY_SAVE_SCHEMA_VERSION_V7)
}

export function migrateUmaSaveV7(value: LegacyUmaSaveV7): LegacyUmaSaveV10 {
  const parsed = asLegacyUmaV10({ ...value, racePreferences: null })
  if (!parsed) throw new Error('Legacy v7 Uma save is malformed')
  return parsed
}

export function parseLegacyUmaSaveV6(value: unknown): LegacyUmaSaveV6 | null {
  return parseLegacyProduceUma(value, LEGACY_SAVE_SCHEMA_VERSION_V6)
}

export function migrateUmaSaveV6(value: LegacyUmaSaveV6): LegacyUmaSaveV10 {
  const parsed = asLegacyUmaV10({ ...value, racePreferences: null })
  if (!parsed) throw new Error('Legacy v6 Uma save is malformed')
  return parsed
}

export function parseLegacyUmaSaveV5(value: unknown): LegacyUmaSaveV5 | null {
  return parseLegacyProduceUma(value, LEGACY_SAVE_SCHEMA_VERSION_V5)
}

export function migrateUmaSaveV5(value: LegacyUmaSaveV5): LegacyUmaSaveV10 {
  const parsed = asLegacyUmaV10({ ...value, racePreferences: null })
  if (!parsed) throw new Error('Legacy v5 Uma save is malformed')
  return parsed
}

export interface LegacyUmaSaveV9 extends Omit<LegacyUmaBody, 'racePreferences'> {
  schemaVersion: typeof LEGACY_SAVE_SCHEMA_VERSION_V9
}

export function parseLegacyUmaSaveV9(value: unknown): LegacyUmaSaveV9 | null {
  if (!isObject(value) || !exactKeys(value, LEGACY_UMA_V9_KEYS) || value.schemaVersion !== LEGACY_SAVE_SCHEMA_VERSION_V9) return null
  const parsed = parseLegacyUmaBody({ ...value, racePreferences: null }, 'legacy')
  if (!parsed) return null
  const { racePreferences: _unused, ...legacy } = parsed
  return { ...legacy, schemaVersion: LEGACY_SAVE_SCHEMA_VERSION_V9 }
}

export function migrateUmaSaveV9(value: LegacyUmaSaveV9): LegacyUmaSaveV10 {
  const parsed = asLegacyUmaV10({ ...value, racePreferences: null })
  if (!parsed) throw new Error('Legacy v9 Uma save is malformed')
  return parsed
}

export interface LegacyUmaSaveV10 extends LegacyUmaBody {
  schemaVersion: typeof LEGACY_SAVE_SCHEMA_VERSION_V10
}

/** v11 is v10 on the linear Training curve (D211), still with Produce nodes in the tree. */
export interface LegacyUmaSaveV11 extends LegacyUmaBody {
  schemaVersion: typeof LEGACY_SAVE_SCHEMA_VERSION_V11
}

/** v10 has v11's shape on the old Training curve (D211); every older Uma migrates to it first. */
function asLegacyUmaV10(value: Record<string, unknown>): LegacyUmaSaveV10 | null {
  const parsed = parseLegacyUmaBody(value, 'legacy')
  return parsed ? { ...parsed, schemaVersion: LEGACY_SAVE_SCHEMA_VERSION_V10 } : null
}

export function parseLegacyUmaSaveV10(value: unknown): LegacyUmaSaveV10 | null {
  if (!isObject(value) || !exactKeys(value, UMA_VERSIONED_KEYS) || value.schemaVersion !== LEGACY_SAVE_SCHEMA_VERSION_V10) return null
  return asLegacyUmaV10(value)
}

/**
 * An Uma moved to the current schema, the Training EXP its re-levelled units carried past TL10 (D211), and the Uma
 * Levels the v13 curve re-levelled her to (D241).
 */
export interface UmaMigration extends UmaRelevel {
  uma: UmaSave
  surplusExp: number
}

/** v11 re-levels every unit once on the linear curve through its total earned EXP (D211). */
export function migrateUmaSaveV10(value: LegacyUmaSaveV10): { uma: LegacyUmaSaveV12; surplusExp: number } {
  let surplusExp = 0
  const scenarios = value.scenarios.map((run) => {
    const releveled = relevelLegacyTraining(run.trainingLevel, run.trainingExp)
    surplusExp += releveled.surplusExp
    return { ...run, trainingLevel: releveled.trainingLevel, trainingExp: releveled.trainingExp }
  })
  const v11 = parseLegacyUmaSaveV11({ ...value, schemaVersion: LEGACY_SAVE_SCHEMA_VERSION_V11, scenarios })
  if (!v11) throw new Error('Legacy v10 Uma save is malformed')
  return { uma: migrateUmaSaveV11(v11), surplusExp }
}

export function parseLegacyUmaSaveV11(value: unknown): LegacyUmaSaveV11 | null {
  if (!isObject(value) || value.schemaVersion !== LEGACY_SAVE_SCHEMA_VERSION_V11) return null
  const parsed = parseLegacyUmaBody(value, 'linear')
  return parsed ? { ...parsed, schemaVersion: LEGACY_SAVE_SCHEMA_VERSION_V11 } : null
}

/**
 * v12 takes the Produce nodes out of the tree (D235): each filled one buys and turns on the next Extra stat node of its
 * stat, free, four at most a stat. Card and lineage assignments are kept as they were.
 */
export function migrateUmaSaveV11(value: LegacyUmaSaveV11): LegacyUmaSaveV12 {
  const scenarios: Omit<FlatScenarioTraining, 'inspiration'>[] = value.scenarios.map((run) => {
    const assignments: Record<string, NodeAssignment> = {}
    const produce: StatKey[] = []
    const legacyIds = new Set(legacyProduceNodeIds(run.tier))
    for (const nodeId of legacyProduceNodeIds(run.tier)) {
      const stat = produceAssignmentStat(run.assignments[nodeId], run.tier)
      if (stat) produce.push(stat)
    }
    for (const [nodeId, assignment] of Object.entries(run.assignments)) {
      if (legacyIds.has(nodeId) || (assignment.kind !== 'card' && assignment.kind !== 'lineage')) continue
      assignments[nodeId] = assignment
    }
    const { loadoutSkillIds, journey, started, ...head } = run
    return { ...head, assignments, extraStats: extraStatsFromProduce(produce), loadoutSkillIds, journey, started }
  })
  const uma = parseLegacyUmaSaveV12({ ...value, schemaVersion: LEGACY_SAVE_SCHEMA_VERSION_V12, scenarios })
  if (!uma) throw new Error('Legacy v11 Uma save is malformed')
  return uma
}

/** v14: one build per scenario, before distance presets (D252). */
export interface LegacyUmaSaveV14 extends Omit<UmaSave, 'schemaVersion' | 'scenarios' | 'activePreset'> {
  schemaVersion: typeof LEGACY_SAVE_SCHEMA_VERSION_V14
  scenarios: FlatScenarioTraining[]
}

export function parseLegacyUmaSaveV14(value: unknown): LegacyUmaSaveV14 | null {
  if (!isObject(value) || value.schemaVersion !== LEGACY_SAVE_SCHEMA_VERSION_V14) return null
  const body = parseUmaBody(value, (run, level) => parseScenarioTraining(run, level), expToNextUmaLevel)
  return body ? { schemaVersion: LEGACY_SAVE_SCHEMA_VERSION_V14, ...body } : null
}

/** A unit's one v14 build, copied into each of its four presets (D252). */
function unitFromFlat(run: FlatScenarioTraining): ScenarioUnit {
  const preset = (): TrainingPreset => ({ cardSetIds: [...run.cardSetIds], assignments: { ...run.assignments },
    activeExtraStats: [...run.extraStats.active], loadoutSkillIds: [...run.loadoutSkillIds] })
  return { tier: run.tier, trainingLevel: run.trainingLevel, trainingExp: run.trainingExp,
    extraStatsUnlocked: { ...run.extraStats.unlocked }, inspiration: run.inspiration,
    presets: { sprint: preset(), mile: preset(), medium: preset(), long: preset() }, journey: run.journey, started: run.started }
}

/**
 * Save v15 (D252): every scenario's build becomes four distance presets, each a copy of the build she had, so nothing
 * changes until a preset is edited. She starts on her race-default distance, or Medium without one.
 */
export function migrateUmaSaveV14(value: LegacyUmaSaveV14): UmaSave {
  const uma = parseUmaSave({ ...value, schemaVersion: SAVE_SCHEMA_VERSION, scenarios: value.scenarios.map(unitFromFlat),
    activePreset: value.racePreferences?.distance ?? 'medium' })
  if (!uma) throw new Error('Legacy v14 Uma save is malformed')
  return uma
}

function parseTrainingPreset(value: unknown, tier: number, unlocked: ExtraStats['unlocked']): TrainingPreset | null {
  if (!isObject(value) || !exactKeys(value, TRAINING_PRESET_KEYS) || !isObject(value.assignments)) return null
  const cardSetIds = parseUniqueIds(value.cardSetIds, CARD_SET_SIZE)
  const loadoutSkillIds = parseUniqueIds(value.loadoutSkillIds)
  const extra = parseExtraStats({ unlocked, active: value.activeExtraStats })
  if (!cardSetIds || !loadoutSkillIds || !extra) return null
  const nodes = new Set(constellationTemplate(tier).nodes.map((node) => node.id))
  const assignments: Record<string, NodeAssignment> = {}
  for (const [nodeId, raw] of Object.entries(value.assignments)) {
    // A stale node id is dropped, not fatal, as in the v14 parser.
    if (!nodes.has(nodeId)) continue
    const assignment = parseNodeAssignment(raw)
    if (!assignment) return null
    assignments[nodeId] = assignment
  }
  return { cardSetIds, assignments, activeExtraStats: extra.active, loadoutSkillIds }
}

/** A v15 unit: the shared run, Inspiration and bought Extra stat nodes, and its four presets in distance order. */
function parseScenarioUnit(value: unknown, umaLevel: number): ScenarioUnit | null {
  if (!isObject(value) || !exactKeys(value, SCENARIO_UNIT_KEYS) || !isObject(value.presets) ||
    !exactKeys(value.presets, DISTANCE_CATEGORIES)) return null
  const run = parseScenarioRun({ ...value, cardSetIds: [], loadoutSkillIds: [] }, umaLevel, 'linear')
  const shared = parseExtraStats({ unlocked: value.extraStatsUnlocked, active: [] })
  const inspiration = parseInspiration(value.inspiration)
  if (!run || !shared || !inspiration) return null
  const presets = {} as Record<DistanceCategory, TrainingPreset>
  for (const distance of DISTANCE_CATEGORIES) {
    const preset = parseTrainingPreset((value.presets as Record<string, unknown>)[distance], run.tier, shared.unlocked)
    if (!preset) return null
    presets[distance] = preset
  }
  // Canonical key order: badge fingerprints hash the save's JSON.
  return { tier: run.tier, trainingLevel: run.trainingLevel, trainingExp: run.trainingExp, extraStatsUnlocked: shared.unlocked,
    inspiration, presets, journey: run.journey, started: run.started }
}

export function parseUmaSave(value: unknown): UmaSave | null {
  if (!isObject(value) || value.schemaVersion !== SAVE_SCHEMA_VERSION) return null
  if (!DISTANCE_CATEGORIES.includes(value.activePreset as DistanceCategory)) return null
  const body = parseUmaBody(value, (run, level) => parseScenarioUnit(run, level), expToNextUmaLevel, UMA_V15_KEYS)
  return body ? { schemaVersion: SAVE_SCHEMA_VERSION, ...body, activePreset: value.activePreset as DistanceCategory } : null
}

/** A unit seen through one preset: what every view-reading rule and screen works on (D252). */
export function scenarioView(unit: ScenarioUnit, preset: DistanceCategory): ScenarioTraining {
  const build = unit.presets[preset]
  return { tier: unit.tier, trainingLevel: unit.trainingLevel, trainingExp: unit.trainingExp, cardSetIds: build.cardSetIds,
    assignments: build.assignments, extraStats: { unlocked: unit.extraStatsUnlocked, active: build.activeExtraStats },
    inspiration: unit.inspiration, loadoutSkillIds: build.loadoutSkillIds, journey: unit.journey, started: unit.started, preset }
}

/** A changed view written back: the shared fields into its unit, the build into its preset alone (D252). */
export function unitWithView(unit: ScenarioUnit, view: ScenarioTraining): ScenarioUnit {
  if (unit.tier !== view.tier) throw new Error(`A tier ${view.tier} view cannot change tier ${unit.tier}`)
  return {
    tier: unit.tier, trainingLevel: view.trainingLevel, trainingExp: view.trainingExp,
    extraStatsUnlocked: { ...view.extraStats.unlocked }, inspiration: view.inspiration,
    presets: { ...unit.presets, [view.preset]: { cardSetIds: [...view.cardSetIds], assignments: { ...view.assignments },
      activeExtraStats: [...view.extraStats.active], loadoutSkillIds: [...view.loadoutSkillIds] } },
    journey: view.journey, started: view.started,
  }
}

/** Every card any of a unit's presets holds (D252): a card is in her set when one of her distances uses it. */
export const unitCardSetIds = (unit: ScenarioUnit): string[] =>
  [...new Set(DISTANCE_CATEGORIES.flatMap((distance) => unit.presets[distance].cardSetIds))]

/** Writes a changed view back into her save (D252); the view's tier must already be one of her units. */
export function withScenarioView(uma: UmaSave, view: ScenarioTraining): UmaSave {
  if (!uma.scenarios.some((unit) => unit.tier === view.tier)) throw new Error(`Uma ${uma.templateId} has no scenario at tier ${view.tier}`)
  return { ...uma, scenarios: uma.scenarios.map((unit) => unit.tier === view.tier ? unitWithView(unit, view) : unit) }
}

/** v12 is v13's shape with Uma Levels on the rising curve (D241). */
export interface LegacyUmaSaveV12 extends Omit<UmaSave, 'schemaVersion' | 'scenarios' | 'activePreset'> {
  schemaVersion: typeof LEGACY_SAVE_SCHEMA_VERSION_V12
  scenarios: Omit<FlatScenarioTraining, 'inspiration'>[]
}

export function parseLegacyUmaSaveV12(value: unknown): LegacyUmaSaveV12 | null {
  if (!isObject(value) || value.schemaVersion !== LEGACY_SAVE_SCHEMA_VERSION_V12) return null
  const body = parseUmaBody(value, (run, level) => {
    const parsed = parseScenarioTraining(run, level, true)
    if (!parsed) return null
    const { inspiration: _inspiration, ...old } = parsed
    return old
  }, legacyExpToNextUmaLevel)
  return body ? { schemaVersion: LEGACY_SAVE_SCHEMA_VERSION_V12, ...body } : null
}

/** What the v13 re-levelling did: the levels it reached (each pays its ticket) and the gate, if it reached one. */
export interface UmaRelevel {
  levelsGained: number[]
  gateReached: number | null
}

/**
 * Save v13 (D241): every scenario's levels cost the same. A v12 Uma keeps the EXP she earned in her current scenario
 * and re-levels through it on the flat curve from the scenario's first level, stopping at her career's hold and at the
 * gate as a race would, and never below the level she had. The caller pays the levels gained like race levels.
 */
export function migrateUmaSaveV12(value: LegacyUmaSaveV12): { uma: LegacyUmaSaveV14 } & UmaRelevel {
  const parsed = parseLegacyUmaSaveV12(value)
  if (!parsed) throw new Error('Legacy v12 Uma save is malformed')
  let level = parsed.level
  let exp = parsed.exp
  if (level < MAX_UMA_LEVEL) {
    const start = (tierOfLevel(level) - 1) * LEVELS_PER_SCENARIO + 1
    let earned = exp
    for (let step = start; step < level; step += 1) earned += legacyExpToNextUmaLevel(step)
    const hold = careerHoldLevel(parsed.scenarios.find((run) => run.tier === parsed.unlockedTier)?.journey, parsed.level)
    level = start
    exp = earned
    while (!isGateLevel(level)) {
      const needed = expToNextUmaLevel(level)
      if (hold !== null && level >= hold) {
        exp = Math.min(needed - 1, exp)
        break
      }
      if (exp < needed) break
      exp -= needed
      level += 1
    }
    // A gate banks one level at most, the next scenario's first.
    if (isGateLevel(level)) exp = Math.min(expToNextUmaLevel(level + 1), exp)
    if (level < parsed.level) {
      level = parsed.level
      exp = Math.min(exp, isGateLevel(level) ? expToNextUmaLevel(level + 1) : expToNextUmaLevel(level) - 1)
    }
  }
  const uma = parseLegacyUmaSaveV14({ ...parsed, schemaVersion: LEGACY_SAVE_SCHEMA_VERSION_V14, level, exp,
    scenarios: parsed.scenarios.map(run => ({ ...run, inspiration: grandfatherInspiration(run.trainingLevel, run.assignments) })) })
  if (!uma) throw new Error('Legacy v12 Uma save cannot be re-levelled')
  const levelsGained = Array.from({ length: level - parsed.level }, (_, index) => parsed.level + index + 1)
  return { uma, levelsGained, gateReached: levelsGained.length > 0 && isGateLevel(level) ? level : null }
}

function parseLegacyUmaBody(value: Record<string, unknown>, curve: 'linear' | 'legacy'): LegacyUmaBody | null {
  return parseUmaBody(value, (run, level) => parseLegacyScenarioTraining(run, level, curve), legacyExpToNextUmaLevel)
}

/**
 * The Uma fields every v10+ shape shares, around units read by `parseRun`. The caller checks the schema version; the
 * migrations pass a `legacy` run parser that reads Training Levels on the pre-v11 curve and Produce nodes in the tree.
 */
function parseUmaBody<Run extends { tier: number }>(
  value: Record<string, unknown>,
  parseRun: (run: unknown, level: number) => Run | null,
  expToNext: (level: number) => number,
  keys: readonly string[] = UMA_VERSIONED_KEYS,
): (Omit<UmaSave, 'schemaVersion' | 'scenarios' | 'activePreset'> & { scenarios: Run[] }) | null {
  if (!exactKeys(value, keys)) return null
  if (!isId(value.templateId)) return null
  if (!isPositiveInt(value.level) || value.level > MAX_UMA_LEVEL || !isNonNegativeInt(value.exp)) return null
  if (!umaExpFits(value.level, value.exp, expToNext)) return null
  if (!isNonNegativeInt(value.goalPlanVersion) || value.goalPlanVersion > SCENARIO_GOAL_VERSION) return null
  if (value.racePreferences !== null && (!isObject(value.racePreferences) ||
    !exactKeys(value.racePreferences, ['strategy', 'distance', 'surface']) ||
    !STRATEGIES.includes(value.racePreferences.strategy as Strategy) ||
    !DISTANCE_CATEGORIES.includes(value.racePreferences.distance as DistanceCategory) ||
    !SURFACES.includes(value.racePreferences.surface as Surface))) return null

  const currentTier = tierOfLevel(value.level)
  if (!isPositiveInt(value.unlockedTier) || value.unlockedTier > currentTier) return null

  if (!Array.isArray(value.scenarios) || value.scenarios.length === 0) return null
  const scenarios = value.scenarios.map((entry) => parseRun(entry, value.level as number))
  if (scenarios.some((entry) => entry === null)) return null
  const runs = scenarios as Run[]
  if (new Set(runs.map((run) => run.tier)).size !== runs.length) return null
  // The active scenario is always the highest unlocked, and it must exist.
  if (!runs.some((run) => run.tier === value.unlockedTier)) return null
  if (runs.some((run) => run.tier > (value.unlockedTier as number))) return null

  if (!Array.isArray(value.skillHistory)) return null
  const skillHistory = value.skillHistory.map(parseSkillHistoryEntry)
  if (skillHistory.some((entry) => entry === null)) return null
  const history = skillHistory as SkillHistoryEntry[]
  if (new Set(history.map((entry) => `${entry.tier}:${entry.skillId}`)).size !== history.length) return null

  return {
    templateId: value.templateId,
    level: value.level,
    exp: value.exp,
    unlockedTier: value.unlockedTier,
    scenarios: runs,
    skillHistory: history,
    goalPlanVersion: value.goalPlanVersion,
    racePreferences: value.racePreferences as RacePreferences | null,
  }
}

/** The active scenario (always the highest unlocked, D121) through a preset: hers unless one is named (D252). */
export function activeScenario(uma: UmaSave, preset: DistanceCategory = uma.activePreset): ScenarioTraining {
  const run = uma.scenarios.find((entry) => entry.tier === uma.unlockedTier)
  if (!run) throw new Error(`Uma ${uma.templateId} has no scenario at tier ${uma.unlockedTier}`)
  return scenarioView(run, preset)
}

export function scenarioAt(uma: UmaSave, tier: number, preset: DistanceCategory = uma.activePreset): ScenarioTraining | null {
  const run = uma.scenarios.find((entry) => entry.tier === tier)
  return run ? scenarioView(run, preset) : null
}

/**
 * One of her trained units (D190): the scenario at `tier`, or the active one when no tier is named, through a distance
 * preset (D252). Every unlocked scenario keeps its own Training Level and presets, and races in its own context.
 */
export function trainedScenario(uma: UmaSave, tier?: number, preset: DistanceCategory = uma.activePreset): ScenarioTraining {
  if (tier === undefined) return activeScenario(uma, preset)
  const run = scenarioAt(uma, tier, preset)
  if (!run) throw new Error(`Uma ${uma.templateId} has no scenario at tier ${tier}`)
  return run
}

/** A scenario before her current one (D190): it races and trains, but levels and careers belong to the current one. */
export const isPastScenario = (uma: Pick<UmaSave, 'unlockedTier'>, tier: number): boolean => tier < uma.unlockedTier

/** Parse a current Uma at a storage/network boundary while distinguishing unsupported nested state. */
export function parseUmaSaveOrThrow(value: unknown): UmaSave {
  if (isObject(value) && 'schemaVersion' in value && value.schemaVersion !== SAVE_SCHEMA_VERSION) {
    throw new Error(`App update required for save schema ${String(value.schemaVersion)}`)
  }
  const uma = parseUmaSave(value)
  if (!uma) throw new Error('Uma save is malformed')
  return uma
}

/** The highest limit break v5 and v6 saves could hold, before stars (D147). */
const LEGACY_MAX_LIMIT_BREAK = 4

/** Per-scenario counts up to `max`, keyed by tier: v7 stars, or v6 limit breaks. */
function parsePerTier(value: unknown, max: number): Record<string, number> | null {
  if (!isObject(value)) return null
  const breaks: Record<string, number> = {}
  for (const [tier, level] of Object.entries(value)) {
    if (!/^[1-9][0-9]*$/.test(tier)) return null
    const parsed = Number(tier)
    if (parsed > MAX_SCENARIO_TIER) return null
    if (!isNonNegativeInt(level) || (level as number) > max) return null
    // A zero is the default, so it is dropped rather than stored.
    if ((level as number) > 0) breaks[tier] = level as number
  }
  return breaks
}

/**
 * Walks any supported stored Uma shape to the current one, or returns null if it is not a save at all.
 *
 * Every schema bump must extend this. Scattering version checks across the Dexie upgrade and the snapshot
 * reader is what let v4 and v5 saves become unreadable: the shapes were migratable the whole time, but
 * nothing called the migration.
 */
export function migrateUmaSaveToCurrent(value: unknown): UmaSave | null {
  return migrateUmaSaveWithSurplus(value)?.uma ?? null
}

/**
 * The same walk, also returning the Training EXP past TL10 that v11's re-levelling produced (D211). Paths that migrate
 * the profile in the same pass bank it (D212); only a stored row that predates v11 has any.
 */
export function migrateUmaSaveWithSurplus(value: unknown): UmaMigration | null {
  const current = parseUmaSave(value)
  if (current) return { uma: current, surplusExp: 0, levelsGained: [], gateReached: null }
  const v14 = parseLegacyUmaSaveV14(value)
  if (v14) return { uma: migrateUmaSaveV14(v14), surplusExp: 0, levelsGained: [], gateReached: null }
  if (isObject(value) && value.schemaVersion === 13) {
    const body = parseUmaBody(value, (run, level) => parseScenarioTraining(run, level, true), expToNextUmaLevel)
    return body ? { uma: migrateUmaSaveV14({ schemaVersion: LEGACY_SAVE_SCHEMA_VERSION_V14, ...body }), surplusExp: 0, levelsGained: [], gateReached: null } : null
  }
  const v12 = migrateUmaSaveToV12(value)
  if (!v12) return null
  const relevelled = migrateUmaSaveV12(v12.uma)
  return { uma: migrateUmaSaveV14(relevelled.uma), levelsGained: relevelled.levelsGained, gateReached: relevelled.gateReached,
    surplusExp: v12.surplusExp }
}

function migrateUmaSaveToV12(value: unknown): { uma: LegacyUmaSaveV12; surplusExp: number } | null {
  const v12 = parseLegacyUmaSaveV12(value)
  if (v12) return { uma: v12, surplusExp: 0 }
  const v11 = parseLegacyUmaSaveV11(value)
  if (v11) return { uma: migrateUmaSaveV11(v11), surplusExp: 0 }
  const v10 = migrateUmaSaveToV10(value)
  return v10 ? migrateUmaSaveV10(v10) : null
}

function migrateUmaSaveToV10(value: unknown): LegacyUmaSaveV10 | null {
  const v10 = parseLegacyUmaSaveV10(value)
  if (v10) return v10
  const v9 = parseLegacyUmaSaveV9(value)
  if (v9) return migrateUmaSaveV9(v9)
  const v8 = parseLegacyUmaSaveV8(value)
  if (v8) return migrateUmaSaveV8(v8)
  const v7 = parseLegacyUmaSaveV7(value)
  if (v7) return migrateUmaSaveV7(v7)
  const v6 = parseLegacyUmaSaveV6(value)
  if (v6) return migrateUmaSaveV6(v6)
  const v5 = parseLegacyUmaSaveV5(value)
  if (v5) return migrateUmaSaveV5(v5)
  const v4 = parseLegacyUmaSaveV4(value)
  if (v4) return migrateUmaSaveV4(v4)
  const v3 = parseLegacyUmaSaveV3(value)
  if (v3) return migrateUmaSaveV3(v3)
  const v2 = parseLegacyUmaSaveV2(value)
  if (v2) return migrateUmaSaveV2(v2)
  const v1 = parseLegacyUmaSaveV1(value)
  return v1 ? migrateUmaSaveV1(v1) : null
}

/** Walks any supported stored card shape to the current one. */
export function migrateCardSaveToCurrent(value: unknown): CardSave | null {
  return parseCardSave(value) ?? migrateCardSaveV7(value) ?? migrateCardSaveV6(value) ?? migrateCardSaveV5(value)
}

/** Walks any supported stored profile shape to the current one. */
export function migratePlayerProfileToCurrent(value: unknown): PlayerProfile | null {
  // v13 and v14 profiles have the current shape: v14 and v15 belong to the Uma rows (D250, D252).
  if (isObject(value) && (value.schemaVersion === 13 || value.schemaVersion === 14)) return parsePlayerProfile({ ...value, schemaVersion: SAVE_SCHEMA_VERSION })
  const current = parsePlayerProfile(value)
  if (current) return current
  const v12 = parseLegacyPlayerProfileV12(value)
  if (v12) return migratePlayerProfileV12(v12)
  const v11 = parseLegacyPlayerProfileV11(value)
  if (v11) return migratePlayerProfileV11(v11)
  const v10 = parseLegacyPlayerProfileV10(value)
  if (v10) return migratePlayerProfileV10(v10)
  const v9 = parseLegacyPlayerProfileV9(value)
  if (v9) return migratePlayerProfileV9(v9)
  const v8 = parseLegacyPlayerProfileV8(value)
  if (v8) return migratePlayerProfileV8(v8)
  const v7 = parseLegacyPlayerProfileV7(value)
  if (v7) return migratePlayerProfileV7(v7)
  const v6 = parseLegacyPlayerProfileV6(value)
  if (v6) return migratePlayerProfileV6(v6)
  const v5 = parseLegacyPlayerProfileV5(value)
  if (v5) return migratePlayerProfileV5(v5)
  const v4 = parseLegacyPlayerProfileV4(value)
  if (v4) return migratePlayerProfileV4(v4)
  const v3 = parseLegacyPlayerProfileV3(value)
  if (v3) return migratePlayerProfileV3(v3)
  const v2 = parseLegacyPlayerProfileV2(value)
  if (v2) return migratePlayerProfileV2(v2)
  const v1 = parseLegacyPlayerProfileV1(value)
  return v1 ? migratePlayerProfileV1(v1) : null
}

export function parseCardSave(value: unknown): CardSave | null {
  if (!isObject(value) || !exactKeys(value, ['templateId', 'bonds', 'maxCouponGranted']) || !isId(value.templateId)) return null
  const bonds = parsePerTier(value.bonds, MAX_STARS)
  if (!bonds) return null
  if (typeof value.maxCouponGranted !== 'boolean') return null
  return { templateId: value.templateId, bonds, maxCouponGranted: value.maxCouponGranted }
}

/** v7's five-star scale (D147). */
const LEGACY_MAX_STARS_V7 = 5

/**
 * A v7 star count on the three-star scale, `⌈3s / 5⌉` (D200): 1→1, 2→2, 3→2, 4→3, 5→3. Rounding up keeps every node
 * percent a card had, and a card one star from the old max becomes max.
 */
export const fiveStarToThree = (stars: number): number => Math.ceil((stars * MAX_STARS) / LEGACY_MAX_STARS_V7)

export function migrateCardSaveV7(value: unknown): CardSave | null {
  if (!isObject(value) || !exactKeys(value, ['templateId', 'stars', 'maxCouponGranted']) || !isId(value.templateId)) return null
  const stars = parsePerTier(value.stars, LEGACY_MAX_STARS_V7)
  if (!stars || typeof value.maxCouponGranted !== 'boolean') return null
  return {
    templateId: value.templateId,
    bonds: Object.fromEntries(Object.entries(stars).map(([tier, count]) => [tier, fiveStarToThree(count)])),
    maxCouponGranted: value.maxCouponGranted,
  }
}

/** A v6 limit break as v7 stars: `ceil(1.25 × LB)`, so no card loses node value and LB4 stays max at 5★ (D147). */
export const limitBreakToStars = (limitBreak: number): number => Math.ceil(limitBreak * 1.25)

export function migrateCardSaveV6(value: unknown): CardSave | null {
  if (!isObject(value) || !exactKeys(value, ['templateId', 'limitBreaks', 'maxCouponGranted']) || !isId(value.templateId)) return null
  const limitBreaks = parsePerTier(value.limitBreaks, LEGACY_MAX_LIMIT_BREAK)
  if (!limitBreaks || typeof value.maxCouponGranted !== 'boolean') return null
  return migrateCardSaveV7({
    templateId: value.templateId,
    stars: Object.fromEntries(Object.entries(limitBreaks).map(([tier, limitBreak]) => [tier, limitBreakToStars(limitBreak)])),
    maxCouponGranted: value.maxCouponGranted,
  })
}

/**
 * v5 held one account-wide limit break with no scenario. It becomes tier 1's, because tier 1 is the only
 * scenario every save has reached and spreading it across tiers would invent progress that was never earned.
 */
export function migrateCardSaveV5(value: unknown): CardSave | null {
  if (!isObject(value) || !isId(value.templateId)) return null
  if (!isNonNegativeInt(value.limitBreak) || value.limitBreak > LEGACY_MAX_LIMIT_BREAK) return null
  const limitBreak = value.limitBreak as number
  return migrateCardSaveV6({
    templateId: value.templateId,
    limitBreaks: limitBreak > 0 ? { '1': limitBreak } : {},
    maxCouponGranted: value.maxCouponGranted === true,
  })
}

export function parseLedgerEntry(value: unknown): LedgerEntry | null {
  if (!isObject(value)) return null
  if (!LEDGER_RESOURCES.includes(value.resource as LedgerResource) || !LEDGER_REASONS.includes(value.reason as LedgerReason)) return null
  if (!Number.isSafeInteger(value.delta) || value.delta === 0 || !isTimestamp(value.createdAt)) return null
  if (value.localDay !== null && !isLocalDay(value.localDay)) return null
  return {
    resource: value.resource as LedgerResource,
    delta: value.delta as number,
    reason: value.reason as LedgerReason,
    localDay: value.localDay as string | null,
    createdAt: value.createdAt as number,
  }
}

export function createPlayerProfile(contentVersion: string, now: number): PlayerProfile {
  if (!isId(contentVersion)) throw new Error('Invalid content version')
  if (!isTimestamp(now)) throw new Error('Invalid save creation time')
  return {
    schemaVersion: SAVE_SCHEMA_VERSION,
    tickets: 0,
    cardCoupons: 3,
    umaCoupons: 0,
    umaShards: 0,
    lastDailyGrant: null,
    featuredUmaId: null,
    starterSeedContentVersion: contentVersion,
    createdAt: now,
    trainingExpBank: 0,
  }
}

/** A new scenario unit: Training Level 1, nothing bought, four empty presets (D252). */
export function createScenarioTraining(tier: number): ScenarioUnit {
  const preset = (): TrainingPreset => ({ cardSetIds: [], assignments: {}, activeExtraStats: [], loadoutSkillIds: [] })
  return {
    tier,
    trainingLevel: 1,
    trainingExp: 0,
    extraStatsUnlocked: emptyExtraStats().unlocked,
    inspiration: emptyInspiration(),
    presets: { sprint: preset(), mile: preset(), medium: preset(), long: preset() },
    journey: null,
    started: false,
  }
}

/** Her best base distance, Medium on a tie with it, then the shorter: where a new Uma's preset starts (D252). */
export function bestBaseDistance(template: Pick<UmaTemplate, 'aptitudes'>): DistanceCategory {
  const rank = (distance: DistanceCategory) => GRADES.indexOf(template.aptitudes.distance[distance])
  return [...DISTANCE_CATEGORIES].sort((left, right) =>
    rank(left) - rank(right) || Number(right === 'medium') - Number(left === 'medium') ||
    DISTANCE_CATEGORIES.indexOf(left) - DISTANCE_CATEGORIES.indexOf(right))[0]!
}

export function createUmaSave(template: UmaTemplate): UmaSave {
  assertSaveUmaTemplate(template)
  const skillHistory: SkillHistoryEntry[] = template.uniqueSkillId
    ? [{ skillId: template.uniqueSkillId, origin: 'own-unique', sourceId: template.id, tier: 1 }]
    : []
  return {
    schemaVersion: SAVE_SCHEMA_VERSION,
    templateId: template.id,
    level: 1,
    exp: 0,
    unlockedTier: 1,
    scenarios: [createScenarioTraining(1)],
    skillHistory,
    goalPlanVersion: SCENARIO_GOAL_VERSION,
    racePreferences: null,
    activePreset: bestBaseDistance(template),
  }
}

export function createCardSave(template: SupportCardTemplate): CardSave {
  assertSaveCardTemplate(template)
  return { templateId: template.id, bonds: {}, maxCouponGranted: false }
}

function nextLocalDay(day: string): string {
  const [year, month, date] = day.split('-').map(Number)
  const next = new Date(Date.UTC(year!, month! - 1, date! + 1))
  return `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, '0')}-${String(next.getUTCDate()).padStart(2, '0')}`
}

export function applyDailyGrants(
  input: PlayerProfile,
  today: string,
  now: number,
): { profile: PlayerProfile; ledger: { id: string; data: LedgerEntry }[] } {
  if (!isLocalDay(today)) throw new Error(`Invalid local day: ${today}`)
  if (input.lastDailyGrant && today <= input.lastDailyGrant) return { profile: input, ledger: [] }

  let cursor = input.lastDailyGrant ? nextLocalDay(input.lastDailyGrant) : today
  let tickets = input.tickets
  const ledger: { id: string; data: LedgerEntry }[] = []
  while (cursor <= today) {
    const next = tickets >= TICKET_STORAGE_CAP ? tickets : Math.min(TICKET_STORAGE_CAP, tickets + DAILY_TICKETS)
    const delta = next - tickets
    if (delta > 0) {
      ledger.push({
        id: `daily-tickets:${cursor}`,
        data: { resource: 'tickets', delta, reason: 'daily-grant', localDay: cursor, createdAt: now },
      })
    }
    tickets = next
    cursor = nextLocalDay(cursor)
  }
  return { profile: { ...input, tickets, lastDailyGrant: today }, ledger }
}

export function createInitialSave(
  umas: readonly UmaTemplate[],
  cards: readonly SupportCardTemplate[],
  contentVersion: string,
  today: string,
  now: number,
): InitialSave {
  assertSaveContent(umas, cards)
  const starterUmas = umas.filter((item) => item.starter).sort((a, b) => a.id.localeCompare(b.id))
  if (starterUmas.length !== 25) throw new Error(`Expected exactly 25 starter Umas, found ${starterUmas.length}`)
  const starterCards = cards.filter((item) => item.starter).sort((a, b) => a.id.localeCompare(b.id))
  const base = { ...createPlayerProfile(contentVersion, now), featuredUmaId: starterUmas[0]!.id }
  const daily = applyDailyGrants(base, today, now)
  return {
    profile: daily.profile,
    umas: starterUmas.map(createUmaSave),
    cards: starterCards.map(createCardSave),
    ledger: [
      {
        id: 'initial-card-coupons',
        data: { resource: 'card-coupons', delta: 3, reason: 'initial-grant', localDay: today, createdAt: now },
      },
      ...daily.ledger,
    ],
  }
}

function parseGenericData(value: unknown): Record<string, unknown> | null {
  return isObject(value) ? value : null
}

function parseStoredEntityData(kind: EntityKind, value: unknown): Record<string, unknown> | null {
  // One chain per entity, so a schema bump is taught in exactly one place.
  if (kind === 'profile') return migratePlayerProfileToCurrent(value) as unknown as Record<string, unknown> | null
  if (kind === 'umas') return migrateUmaSaveToCurrent(value) as unknown as Record<string, unknown> | null
  if (kind === 'cards') return migrateCardSaveToCurrent(value) as unknown as Record<string, unknown> | null
  if (kind === 'farm') return migrateFarmStateToCurrent(value) as unknown as Record<string, unknown> | null
  return parseEntityData(kind, value)
}

export function parseEntityData(kind: EntityKind, value: unknown): Record<string, unknown> | null {
  if (kind === 'profile') return parsePlayerProfile(value) as unknown as Record<string, unknown> | null
  if (kind === 'umas') return parseUmaSave(value) as unknown as Record<string, unknown> | null
  if (kind === 'cards') return parseCardSave(value) as unknown as Record<string, unknown> | null
  if (kind === 'badges') return parseBadgeState(value) as unknown as Record<string, unknown> | null
  if (kind === 'farm') return parseFarmState(value) as unknown as Record<string, unknown> | null
  if (kind === 'items') return parseInventoryStackData(value) as unknown as Record<string, unknown> | null
  if (kind === 'rpgOutfits') return parseRpgOutfitSave(value) as unknown as Record<string, unknown> | null
  if (kind === 'rpgPresets') return parseRpgPresetSave(value) as unknown as Record<string, unknown> | null
  if (kind === 'rpgCheckpoints') return parseRpgCheckpointSave(value) as unknown as Record<string, unknown> | null
  return parseGenericData(value)
}

export function parseLogData(kind: LogKind, value: unknown): Record<string, unknown> | null {
  if (kind === 'ledger') return parseLedgerEntry(value) as unknown as Record<string, unknown> | null
  if (kind === 'raceResults') return parseRaceResultRecord(value) as unknown as Record<string, unknown> | null
  if (kind === 'flairEvents') return parseFlairEvent(value) as unknown as Record<string, unknown> | null
  if (kind === 'itemLedger') return parseItemLedgerEntry(value) as unknown as Record<string, unknown> | null
  if (kind === 'rpgResults') return parseRpgResultEvidence(value) as unknown as Record<string, unknown> | null
  if (kind === 'rpgPromotions') return parseRpgPromotionEvidence(value) as unknown as Record<string, unknown> | null
  if (kind === 'rpgReceipts') return parseRpgCommandReceipt(value) as unknown as Record<string, unknown> | null
  return parseGenericData(value)
}

function badgeIdMatchesData(id: string, data: Record<string, unknown>): boolean {
  return data.scope === 'trainer' ? id === 'trainer' : data.scope === 'uma' && typeof data.umaId === 'string' && id === badgeStateId(data.umaId)
}

export function parseSyncRequest(body: unknown): SyncRequest | string {
  if (!isObject(body)) return 'body must be an object'
  const upserts = body.upserts ?? []
  const appends = body.appends ?? []
  if (!Array.isArray(upserts) || !Array.isArray(appends)) return 'upserts and appends must be arrays'
  if (upserts.length + appends.length > MAX_SYNC_OPERATIONS) return `at most ${MAX_SYNC_OPERATIONS} operations per sync`

  const parsedUpserts: EntityUpsert[] = []
  for (const value of upserts) {
    if (!isObject(value)) return 'upsert must be an object'
    if (!ENTITY_KINDS.includes(value.kind as EntityKind)) return `unknown entity kind ${String(value.kind)}`
    const kind = value.kind as EntityKind
    if (kind.startsWith('rpg')) return 'RPG rows require the grouped command endpoint'
    if (!isId(value.id)) return 'invalid entity id'
    if (!isNonNegativeInt(value.baseVersion)) return 'invalid baseVersion'
    const data = parseEntityData(kind, value.data)
    if (!data) return `invalid ${kind} data`
    if ((kind === 'profile' && value.id !== 'main') || (kind === 'farm' && value.id !== 'main') ||
      ((kind === 'umas' || kind === 'cards') && data.templateId !== value.id) ||
      (kind === 'items' && data.itemId !== value.id) ||
      (kind === 'badges' && !badgeIdMatchesData(value.id, data))) {
      return `${kind} id does not match data`
    }
    if (value.deleted !== undefined && typeof value.deleted !== 'boolean') return 'invalid deleted flag'
    parsedUpserts.push({ kind, id: value.id, baseVersion: value.baseVersion, data, deleted: value.deleted as boolean | undefined })
  }

  const parsedAppends: LogAppend[] = []
  for (const value of appends) {
    if (!isObject(value)) return 'append must be an object'
    if (!LOG_KINDS.includes(value.kind as LogKind)) return `unknown log kind ${String(value.kind)}`
    const kind = value.kind as LogKind
    if (kind.startsWith('rpg')) return 'RPG logs require the grouped command endpoint'
    if (!isId(value.id)) return 'invalid log id'
    const data = parseLogData(kind, value.data)
    if (!data) return `invalid ${kind} data`
    if (!isTimestamp(value.createdAt)) return 'append createdAt must be a number'
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
  if (new Set(entityKeys).size !== entityKeys.length || new Set(logKeys).size !== logKeys.length) {
    return 'duplicate operation id'
  }
  return { upserts: parsedUpserts, appends: parsedAppends }
}

function parseEntityRecord(value: unknown): EntityRecord | null {
  if (!isObject(value) || !ENTITY_KINDS.includes(value.kind as EntityKind) || !isId(value.id)) return null
  const kind = value.kind as EntityKind
  if (!isPositiveInt(value.version) || typeof value.deleted !== 'boolean' || !isTimestamp(value.updatedAt)) return null
  const data = parseStoredEntityData(kind, value.data)
  if (!data) return null
  if ((kind === 'profile' && value.id !== 'main') || (kind === 'farm' && value.id !== 'main') ||
    ((kind === 'umas' || kind === 'cards') && data.templateId !== value.id) ||
    (kind === 'items' && data.itemId !== value.id) ||
    (kind === 'rpgOutfits' && (data.profile as Record<string, unknown>).outfitId !== value.id) ||
    (kind === 'rpgPresets' && data.presetId !== value.id) ||
    (kind === 'rpgCheckpoints' && value.id !== rpgCheckpointId(data.presetId as string, data.chapterId as string)) ||
    (kind === 'badges' && !badgeIdMatchesData(value.id, data))) return null
  return { kind, id: value.id, version: value.version, data, deleted: value.deleted, updatedAt: value.updatedAt }
}

function parseLogRecord(value: unknown): LogRecord | null {
  if (!isObject(value) || !LOG_KINDS.includes(value.kind as LogKind) || !isId(value.id) || !isTimestamp(value.createdAt)) return null
  const kind = value.kind as LogKind
  const data = parseLogData(kind, value.data)
  if (kind === 'raceResults' && data && (value.id !== `race:${String(data.umaId)}:${String(data.sequence)}` || value.createdAt !== data.createdAt)) return null
  if (kind === 'flairEvents' && data && value.createdAt !== data.earnedAt) return null
  if (kind === 'itemLedger' && data && (value.id !== data.id || value.createdAt !== data.createdAt)) return null
  if (kind === 'rpgResults' && data && (value.id !== data.resultId || value.createdAt !== data.createdAt)) return null
  if (kind === 'rpgPromotions' && data && (value.id !== data.promotionId || value.createdAt !== data.createdAt)) return null
  if (kind === 'rpgReceipts' && data && (value.id !== data.commandId || value.createdAt !== data.createdAt)) return null
  return data ? { kind, id: value.id, data, createdAt: value.createdAt } : null
}

export function parseSaveSnapshot(value: unknown): SaveSnapshot | null {
  if (!isObject(value) || !Array.isArray(value.entities) || !Array.isArray(value.logs) || !isTimestamp(value.serverTime)) return null
  const entities = value.entities.map(parseEntityRecord)
  const logs = value.logs.map(parseLogRecord)
  if (entities.some((item) => item === null) || logs.some((item) => item === null)) return null
  const entityKeys = (entities as EntityRecord[]).map((item) => `${item.kind}/${item.id}`)
  const logKeys = (logs as LogRecord[]).map((item) => `${item.kind}/${item.id}`)
  if (new Set(entityKeys).size !== entityKeys.length || new Set(logKeys).size !== logKeys.length) return null
  return { entities: entities as EntityRecord[], logs: logs as LogRecord[], serverTime: value.serverTime }
}

function assertSupportedProfileRecords(records: unknown): void {
  if (!Array.isArray(records)) return
  for (const record of records) {
    if (isObject(record) && record.kind === 'profile' && isObject(record.data)) {
      if (!migratePlayerProfileToCurrent(record.data)) parsePlayerProfileOrThrow(record.data)
    }
    if (isObject(record) && record.kind === 'umas' && isObject(record.data) && 'schemaVersion' in record.data) {
      // Anything the migration chain can read is supported; only a genuinely future schema is not.
      if (!migrateUmaSaveToCurrent(record.data)) {
        throw new Error(`App update required for save schema ${String(record.data.schemaVersion)}`)
      }
    }
    if (isObject(record) && record.kind === 'farm' && isObject(record.data) &&
      typeof record.data.schemaVersion === 'number' && record.data.schemaVersion > FARM_SCHEMA_VERSION) {
      throw new Error(`App update required for Farm schema ${String(record.data.schemaVersion)}`)
    }
    if (isObject(record) && typeof record.kind === 'string' && record.kind.startsWith('rpg') &&
      isObject(record.data) && typeof record.data.schemaVersion === 'number' && record.data.schemaVersion > RPG_SAVE_SCHEMA_VERSION) {
      throw new Error(`App update required for RPG schema ${String(record.data.schemaVersion)}`)
    }
  }
}

/**
 * A server save may mix schemas: each record is written by its own sync, so a failed upload can leave an old profile
 * beside newer Umas. Every record migrates on its own chain and no migration reads another record, so a mix loads as
 * one save (D156). Only a schema newer than this app is refused (assertSupportedProfileRecords).
 */
export function parseSaveSnapshotOrThrow(value: unknown): SaveSnapshot {
  if (isObject(value)) assertSupportedProfileRecords(value.entities)
  const snapshot = parseSaveSnapshot(value)
  if (!snapshot) throw new Error('Server save response is malformed')
  return snapshot
}

export function parseSyncResponse(value: unknown): SyncResponse | null {
  if (!isObject(value) || !Array.isArray(value.applied) || !Array.isArray(value.conflicts)) return null
  if (!isNonNegativeInt(value.appended) || !isTimestamp(value.serverTime)) return null
  const applied = value.applied.map((item) => {
    if (!isObject(item) || !ENTITY_KINDS.includes(item.kind as EntityKind) || !isId(item.id) || !isPositiveInt(item.version)) return null
    return { kind: item.kind as EntityKind, id: item.id, version: item.version }
  })
  const conflicts = value.conflicts.map(parseEntityRecord)
  if (applied.some((item) => item === null) || conflicts.some((item) => item === null)) return null
  return { applied: applied as SyncResponse['applied'], conflicts: conflicts as EntityRecord[], appended: value.appended, serverTime: value.serverTime }
}

export function parseSyncResponseOrThrow(value: unknown): SyncResponse {
  if (isObject(value)) assertSupportedProfileRecords(value.conflicts)
  const response = parseSyncResponse(value)
  if (!response) throw new Error('Sync response is malformed')
  return response
}

export function parseRpgCommandResponseOrThrow(value: unknown, commandId: string): RpgCommandResponse {
  if (!isObject(value)) throw new Error('RPG command response is malformed')
  if (value.status === 'rejected' && typeof value.reason === 'string' && value.reason.length <= 200) {
    return { status: 'rejected', reason: value.reason }
  }
  if (value.status === 'conflict' && Array.isArray(value.authoritative) && value.authoritative.length <= 20) {
    const authoritative = value.authoritative.map((entry) => {
      if (!isObject(entry) || !ENTITY_KINDS.includes(entry.kind as EntityKind) || !isId(entry.id)) return null
      const record = entry.record === null ? null : parseEntityRecord(entry.record)
      if (entry.record !== null && (!record || record.kind !== entry.kind || record.id !== entry.id)) return null
      return { kind: entry.kind as EntityKind, id: entry.id, record }
    })
    if (authoritative.some((entry) => entry === null)) throw new Error('RPG conflict response is malformed')
    return { status: 'conflict', authoritative: authoritative as Array<{ kind: EntityKind; id: string; record: EntityRecord | null }> }
  }
  if ((value.status === 'applied' || value.status === 'duplicate') && Array.isArray(value.entities) && Array.isArray(value.logs)) {
    assertSupportedProfileRecords(value.entities)
    const receipt = parseRpgCommandReceipt(value.receipt)
    const snapshot = parseSaveSnapshot({ entities: value.entities, logs: value.logs, serverTime: receipt?.createdAt ?? 0 })
    if (receipt && receipt.commandId === commandId && snapshot && value.status === 'duplicate' &&
      snapshot.entities.length === 0 && snapshot.logs.length === 0) {
      return { status: 'duplicate', receipt, entities: [], logs: [] }
    }
    if (receipt && receipt.commandId === commandId && snapshot &&
      snapshot.entities.length === receipt.applied.length && snapshot.logs.length === receipt.appendedIds.length + 1 &&
      receipt.applied.every((applied) => snapshot.entities.some((row) => row.kind === applied.kind && row.id === applied.id && row.version === applied.version)) &&
      receipt.appendedIds.every((id, index) => snapshot.logs[index]?.id === id) &&
      snapshot.logs.at(-1)?.kind === 'rpgReceipts' && snapshot.logs.at(-1)?.id === commandId) {
      return { status: value.status, receipt, entities: snapshot.entities, logs: snapshot.logs }
    }
  }
  throw new Error('RPG command response is malformed')
}
