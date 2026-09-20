// Typed local-first save vocabulary and initialization (docs/technical/architecture.md).

import { CARD_MAX_LEVEL, MAX_LIMIT_BREAK, cardExpToNext, cardLevelCap } from './cards'
import {
  badgeStateId,
  FLAIR_SERIES_LEG_KEY_PATTERN,
  FLAIR_SERIES_TAGS,
  parseBadgeState,
  parseFlairEvent,
  type FlairSeriesTag,
} from './badges'
import type { SupportCardTemplate, UmaTemplate } from './content'
import { DAILY_TICKETS, TICKET_STORAGE_CAP } from './economy'
import { expToNextUmaLevel } from './progression'
import { parseRaceResultRecord } from './progression-race'
import { SCENARIO_MODIFIER_VERSION, parseScenarioModifierState, type ScenarioModifierState } from './scenario-modifiers'
import { MAX_UMA_LEVEL, SCENARIOS, isGateLevel, tierOfLevel } from './scenarios'
import { EXP_TO_NEXT_TRAINING_LEVEL, MAX_TRAINING_LEVEL } from './training'
import { GRADES, STATS, type Aptitudes, type Grade, type Stats } from './types'

export const SAVE_SCHEMA_VERSION = 4 as const
export const LEGACY_SAVE_SCHEMA_VERSION = 1 as const
export const LEGACY_SAVE_SCHEMA_VERSION_V2 = 2 as const
export const LEGACY_SAVE_SCHEMA_VERSION_V3 = 3 as const
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
}

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

export type GoalSlot = 'aptitude' | 'identity' | 'challenge'
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

export interface UmaSave {
  schemaVersion: typeof SAVE_SCHEMA_VERSION
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
  scenarioModifier: ScenarioModifierState | null
}

export interface LegacyPlayerProfileV1 extends Omit<PlayerProfile, 'schemaVersion'> {
  schemaVersion: typeof LEGACY_SAVE_SCHEMA_VERSION
}

export interface LegacyPlayerProfileV2 extends Omit<PlayerProfile, 'schemaVersion'> {
  schemaVersion: typeof LEGACY_SAVE_SCHEMA_VERSION_V2
}

export interface LegacyPlayerProfileV3 extends Omit<PlayerProfile, 'schemaVersion'> {
  schemaVersion: typeof LEGACY_SAVE_SCHEMA_VERSION_V3
}

export interface LegacyScenarioGoalV2 extends Omit<ScenarioGoal, 'series' | 'kind' | 'raceId'> {
  raceId: string
  kind: 'win' | 'win-by-margin'
}

export interface LegacyScenarioJourneyV2 extends Omit<ScenarioJourney, 'goals'> {
  goals: LegacyScenarioGoalV2[]
}

export interface LegacyUmaSaveV3 extends Omit<UmaSave, 'schemaVersion' | 'scenarioModifier'> {
  schemaVersion: typeof LEGACY_SAVE_SCHEMA_VERSION_V3
}

export interface LegacyUmaSaveV2 extends Omit<LegacyUmaSaveV3, 'schemaVersion' | 'scenarioJourneys'> {
  schemaVersion: typeof LEGACY_SAVE_SCHEMA_VERSION_V2
  scenarioJourneys: LegacyScenarioJourneyV2[]
}

export interface LegacyUmaSaveV1 extends Omit<UmaSave,
  'schemaVersion' | 'scenarioStarted' | 'skillHistory' | 'currentParents' | 'parentSnapshot' | 'goalPlanVersion' | 'scenarioJourneys' | 'scenarioModifier'> {}

export interface CardSave {
  templateId: string
  level: number
  exp: number
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

export const ENTITY_KINDS = ['profile', 'umas', 'cards', 'badges'] as const
export type EntityKind = (typeof ENTITY_KINDS)[number]
export const LOG_KINDS = ['raceResults', 'ledger', 'flairEvents'] as const
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

const PROFILE_KEYS = [
  'schemaVersion', 'tickets', 'cardCoupons', 'umaCoupons', 'umaShards', 'lastDailyGrant', 'featuredUmaId',
  'starterSeedContentVersion', 'createdAt',
] as const

function parsePlayerProfileVersion<T extends 1 | 2 | 3 | 4>(value: unknown, schemaVersion: T): (Omit<PlayerProfile, 'schemaVersion'> & { schemaVersion: T }) | null {
  if (!isObject(value) || !exactKeys(value, PROFILE_KEYS)) return null
  if (value.schemaVersion !== schemaVersion) return null
  if (![value.tickets, value.cardCoupons, value.umaCoupons, value.umaShards].every(isNonNegativeInt)) return null
  if (value.lastDailyGrant !== null && !isLocalDay(value.lastDailyGrant)) return null
  if (value.featuredUmaId !== null && !isId(value.featuredUmaId)) return null
  if (value.starterSeedContentVersion !== null && !isId(value.starterSeedContentVersion)) return null
  if (!isTimestamp(value.createdAt)) return null
  return {
    schemaVersion,
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
  return parsePlayerProfileVersion(value, SAVE_SCHEMA_VERSION)
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
  return { ...parsed, schemaVersion: SAVE_SCHEMA_VERSION }
}

export function migratePlayerProfileV2(value: LegacyPlayerProfileV2): PlayerProfile {
  const parsed = parseLegacyPlayerProfileV2(value)
  if (!parsed) throw new Error('Legacy v2 player profile is malformed')
  return { ...parsed, schemaVersion: SAVE_SCHEMA_VERSION }
}

export function migratePlayerProfileV3(value: LegacyPlayerProfileV3): PlayerProfile {
  const parsed = parseLegacyPlayerProfileV3(value)
  if (!parsed) throw new Error('Legacy v3 player profile is malformed')
  return { ...parsed, schemaVersion: SAVE_SCHEMA_VERSION }
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

const GOAL_SLOTS: readonly GoalSlot[] = ['aptitude', 'identity', 'challenge']

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
  if (value.kind === 'win-series' && value.slot !== 'identity') return null
  if (!['active', 'completed', 'missed'].includes(String(value.status))) return null
  if (value.id !== `goal:${tier}:${String(value.slot)}`) return null
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
  if (!GOAL_SLOTS.includes(value.slot as GoalSlot) || !isId(value.raceId) || !['win', 'win-by-margin'].includes(String(value.kind))) return null
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
    if (validGoals.length !== GOAL_SLOTS.length) return null
    if (new Set(validGoals.map((goal) => goal.slot)).size !== GOAL_SLOTS.length) return null
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
  if (value.tracking === 'tracked' && (valid.length !== GOAL_SLOTS.length || new Set(valid.map((goal) => goal.slot)).size !== GOAL_SLOTS.length || new Set(valid.map((goal) => goal.raceId)).size !== GOAL_SLOTS.length)) return null
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
const UMA_VERSIONED_KEYS = [
  'schemaVersion', ...LEGACY_UMA_KEYS, 'scenarioStarted', 'skillHistory', 'currentParents', 'parentSnapshot',
  'goalPlanVersion', 'scenarioJourneys', 'scenarioModifier',
] as const
const LEGACY_UMA_VERSIONED_KEYS = [
  'schemaVersion', ...LEGACY_UMA_KEYS, 'scenarioStarted', 'skillHistory', 'currentParents', 'parentSnapshot',
  'goalPlanVersion', 'scenarioJourneys',
] as const

function parseUmaCore(value: Record<string, unknown>): LegacyUmaSaveV1 | null {
  if (!isId(value.templateId)) return null
  if (!isPositiveInt(value.level) || value.level > MAX_UMA_LEVEL || !isNonNegativeInt(value.exp)) return null
  const maxLevel = MAX_UMA_LEVEL
  if (value.level === maxLevel ? value.exp !== 0 : isGateLevel(value.level) ? value.exp > expToNextUmaLevel(value.level + 1) : value.exp >= expToNextUmaLevel(value.level)) return null
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

export function migrateUmaSaveV1(value: LegacyUmaSaveV1): UmaSave {
  const parsed = parseLegacyUmaSaveV1(value)
  if (!parsed) throw new Error('Legacy Uma save is malformed')
  const tier = tierOfLevel(parsed.level)
  return {
    schemaVersion: SAVE_SCHEMA_VERSION,
    ...parsed,
    scenarioStarted: true,
    skillHistory: parsed.skillLibrary.map((unlock) => ({ ...unlock, tier })),
    currentParents: [],
    parentSnapshot: null,
    goalPlanVersion: 0,
    scenarioJourneys: [],
    scenarioModifier: null,
  }
}

function parseVersionedUmaSave<J extends ScenarioJourney | LegacyScenarioJourneyV2>(
  value: unknown,
  schemaVersion: 2 | 3 | 4,
  goalPlanVersion: 1 | 2,
  journeyParser: (value: unknown) => J | null,
): (Omit<UmaSave, 'schemaVersion' | 'scenarioJourneys' | 'scenarioModifier'> & { schemaVersion: 2 | 3 | 4; scenarioJourneys: J[] }) | null {
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

export function migrateUmaSaveV2(value: LegacyUmaSaveV2): UmaSave {
  const parsed = parseLegacyUmaSaveV2(value)
  if (!parsed) throw new Error('Legacy v2 Uma save is malformed')
  return {
    ...parsed,
    schemaVersion: SAVE_SCHEMA_VERSION,
    scenarioModifier: null,
    scenarioJourneys: parsed.scenarioJourneys.map((journey) => ({
      ...journey,
      goals: journey.goals.map((goal): ScenarioGoal => ({ ...goal, series: null })),
    })),
  }
}

export function parseLegacyUmaSaveV3(value: unknown): LegacyUmaSaveV3 | null {
  return parseVersionedUmaSave(value, LEGACY_SAVE_SCHEMA_VERSION_V3, 2, parseScenarioJourney) as LegacyUmaSaveV3 | null
}

export function migrateUmaSaveV3(value: LegacyUmaSaveV3): UmaSave {
  const parsed = parseLegacyUmaSaveV3(value)
  if (!parsed) throw new Error('Legacy v3 Uma save is malformed')
  return { ...parsed, schemaVersion: SAVE_SCHEMA_VERSION, scenarioModifier: null }
}

export function parseUmaSave(value: unknown): UmaSave | null {
  if (!isObject(value) || !exactKeys(value, UMA_VERSIONED_KEYS) || value.schemaVersion !== SAVE_SCHEMA_VERSION) return null
  const { scenarioModifier: rawModifier, ...legacyShape } = value
  const base = parseVersionedUmaSave(legacyShape, SAVE_SCHEMA_VERSION, 2, parseScenarioJourney)
  if (!base) return null
  const scenarioModifier = rawModifier === null ? null : parseScenarioModifierState(rawModifier)
  if (rawModifier !== null && !scenarioModifier) return null
  const currentTier = tierOfLevel(base.level)
  if (scenarioModifier && (!base.scenarioStarted || scenarioModifier.tier !== currentTier)) return null
  return { ...base, schemaVersion: SAVE_SCHEMA_VERSION, scenarioModifier }
}

/** Parse a current Uma at a storage/network boundary while distinguishing unsupported nested state. */
export function parseUmaSaveOrThrow(value: unknown): UmaSave {
  if (isObject(value) && 'schemaVersion' in value && value.schemaVersion !== SAVE_SCHEMA_VERSION) {
    throw new Error(`App update required for save schema ${String(value.schemaVersion)}`)
  }
  if (isObject(value) && isObject(value.scenarioModifier) && 'version' in value.scenarioModifier &&
    value.scenarioModifier.version !== SCENARIO_MODIFIER_VERSION) {
    throw new Error(`App update required for scenario modifier version ${String(value.scenarioModifier.version)}`)
  }
  const uma = parseUmaSave(value)
  if (!uma) throw new Error('Uma save is malformed')
  return uma
}

export function parseCardSave(value: unknown): CardSave | null {
  if (!isObject(value) || !isId(value.templateId)) return null
  if (!isPositiveInt(value.level) || value.level > CARD_MAX_LEVEL || !isNonNegativeInt(value.exp)) return null
  if (!isNonNegativeInt(value.limitBreak) || value.limitBreak > MAX_LIMIT_BREAK || value.level > cardLevelCap(value.limitBreak)) return null
  if (value.exp > cardExpToNext(value.level) || (value.level < cardLevelCap(value.limitBreak) && value.exp === cardExpToNext(value.level))) return null
  if (typeof value.maxCouponGranted !== 'boolean') return null
  return {
    templateId: value.templateId,
    level: value.level,
    exp: value.exp,
    limitBreak: value.limitBreak,
    maxCouponGranted: value.maxCouponGranted,
  }
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
  }
}

export function createUmaSave(template: UmaTemplate): UmaSave {
  assertSaveUmaTemplate(template)
  const skillLibrary: SkillUnlock[] = template.uniqueSkillId
    ? [{ skillId: template.uniqueSkillId, origin: 'own-unique', sourceId: template.id }]
    : []
  return {
    schemaVersion: SAVE_SCHEMA_VERSION,
    templateId: template.id,
    level: 1,
    exp: 0,
    trainingLevel: 1,
    trainingExp: 0,
    stats: { ...template.baseStats },
    skillPoints: 0,
    aptitudes: {
      surface: { ...template.aptitudes.surface },
      distance: { ...template.aptitudes.distance },
      strategy: { ...template.aptitudes.strategy },
    },
    deckCardIds: [],
    skillLibrary,
    loadoutSkillIds: [],
    trainingsThisScenario: 0,
    scenarioStarted: false,
    skillHistory: skillLibrary.map((unlock) => ({ ...unlock, tier: 1 })),
    currentParents: [],
    parentSnapshot: null,
    goalPlanVersion: 2,
    scenarioJourneys: [],
    scenarioModifier: null,
  }
}

export function createCardSave(template: SupportCardTemplate): CardSave {
  assertSaveCardTemplate(template)
  return { templateId: template.id, level: 1, exp: 0, limitBreak: 0, maxCouponGranted: false }
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
  if (kind === 'profile') {
    const current = parsePlayerProfile(value)
    if (current) return current as unknown as Record<string, unknown>
    const legacyV3 = parseLegacyPlayerProfileV3(value)
    if (legacyV3) return migratePlayerProfileV3(legacyV3) as unknown as Record<string, unknown>
    const legacyV2 = parseLegacyPlayerProfileV2(value)
    if (legacyV2) return migratePlayerProfileV2(legacyV2) as unknown as Record<string, unknown>
    const legacy = parseLegacyPlayerProfileV1(value)
    return legacy ? migratePlayerProfileV1(legacy) as unknown as Record<string, unknown> : null
  }
  if (kind === 'umas') {
    const current = parseUmaSave(value)
    if (current) return current as unknown as Record<string, unknown>
    const legacyV3 = parseLegacyUmaSaveV3(value)
    if (legacyV3) return migrateUmaSaveV3(legacyV3) as unknown as Record<string, unknown>
    const legacyV2 = parseLegacyUmaSaveV2(value)
    if (legacyV2) return migrateUmaSaveV2(legacyV2) as unknown as Record<string, unknown>
    const legacy = parseLegacyUmaSaveV1(value)
    return legacy ? migrateUmaSaveV1(legacy) as unknown as Record<string, unknown> : null
  }
  return parseEntityData(kind, value)
}

export function parseEntityData(kind: EntityKind, value: unknown): Record<string, unknown> | null {
  if (kind === 'profile') return parsePlayerProfile(value) as unknown as Record<string, unknown> | null
  if (kind === 'umas') return parseUmaSave(value) as unknown as Record<string, unknown> | null
  if (kind === 'cards') return parseCardSave(value) as unknown as Record<string, unknown> | null
  if (kind === 'badges') return parseBadgeState(value) as unknown as Record<string, unknown> | null
  return parseGenericData(value)
}

export function parseLogData(kind: LogKind, value: unknown): Record<string, unknown> | null {
  if (kind === 'ledger') return parseLedgerEntry(value) as unknown as Record<string, unknown> | null
  if (kind === 'raceResults') return parseRaceResultRecord(value) as unknown as Record<string, unknown> | null
  if (kind === 'flairEvents') return parseFlairEvent(value) as unknown as Record<string, unknown> | null
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
    if (!isId(value.id)) return 'invalid entity id'
    if (!isNonNegativeInt(value.baseVersion)) return 'invalid baseVersion'
    const data = parseEntityData(kind, value.data)
    if (!data) return `invalid ${kind} data`
    if ((kind === 'profile' && value.id !== 'main') || ((kind === 'umas' || kind === 'cards') && data.templateId !== value.id) ||
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
    if (!isId(value.id)) return 'invalid log id'
    const data = parseLogData(kind, value.data)
    if (!data) return `invalid ${kind} data`
    if (!isTimestamp(value.createdAt)) return 'append createdAt must be a number'
    if (kind === 'raceResults' && (value.id !== `race:${String(data.umaId)}:${String(data.sequence)}` || value.createdAt !== data.createdAt)) {
      return 'raceResults id or timestamp does not match data'
    }
    if (kind === 'flairEvents' && value.createdAt !== data.earnedAt) return 'flairEvents timestamp does not match data'
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
  if ((kind === 'profile' && value.id !== 'main') || ((kind === 'umas' || kind === 'cards') && data.templateId !== value.id) ||
    (kind === 'badges' && !badgeIdMatchesData(value.id, data))) return null
  return { kind, id: value.id, version: value.version, data, deleted: value.deleted, updatedAt: value.updatedAt }
}

function parseLogRecord(value: unknown): LogRecord | null {
  if (!isObject(value) || !LOG_KINDS.includes(value.kind as LogKind) || !isId(value.id) || !isTimestamp(value.createdAt)) return null
  const kind = value.kind as LogKind
  const data = parseLogData(kind, value.data)
  if (kind === 'raceResults' && data && (value.id !== `race:${String(data.umaId)}:${String(data.sequence)}` || value.createdAt !== data.createdAt)) return null
  if (kind === 'flairEvents' && data && value.createdAt !== data.earnedAt) return null
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
      if (!parseLegacyPlayerProfileV1(record.data) && !parseLegacyPlayerProfileV2(record.data) && !parseLegacyPlayerProfileV3(record.data)) parsePlayerProfileOrThrow(record.data)
    }
    if (isObject(record) && record.kind === 'umas' && isObject(record.data) && 'schemaVersion' in record.data) {
      if (record.data.schemaVersion !== LEGACY_SAVE_SCHEMA_VERSION_V2 && record.data.schemaVersion !== LEGACY_SAVE_SCHEMA_VERSION_V3 && record.data.schemaVersion !== SAVE_SCHEMA_VERSION) {
        throw new Error(`App update required for save schema ${String(record.data.schemaVersion)}`)
      }
      if (record.data.schemaVersion === SAVE_SCHEMA_VERSION && isObject(record.data.scenarioModifier) &&
        record.data.scenarioModifier.version !== SCENARIO_MODIFIER_VERSION) {
        throw new Error(`App update required for scenario modifier version ${String(record.data.scenarioModifier.version)}`)
      }
    }
  }
}

function assertSnapshotSchemaIsConsistent(records: unknown): void {
  if (!Array.isArray(records)) return
  const active = records.filter((record): record is Record<string, unknown> => isObject(record) && record.deleted !== true)
  const profile = active.find((record) => record.kind === 'profile')
  if (!profile || !isObject(profile.data)) return
  const schema = profile.data.schemaVersion
  if (schema !== LEGACY_SAVE_SCHEMA_VERSION && schema !== LEGACY_SAVE_SCHEMA_VERSION_V2 && schema !== LEGACY_SAVE_SCHEMA_VERSION_V3 && schema !== SAVE_SCHEMA_VERSION) return
  for (const record of active) {
    if (record.kind !== 'umas' || !isObject(record.data)) continue
    const umaSchema = Object.hasOwn(record.data, 'schemaVersion') ? record.data.schemaVersion : LEGACY_SAVE_SCHEMA_VERSION
    if (umaSchema !== schema) throw new Error('Server save mixes incompatible schema versions')
  }
}

export function parseSaveSnapshotOrThrow(value: unknown): SaveSnapshot {
  if (isObject(value)) {
    assertSupportedProfileRecords(value.entities)
    assertSnapshotSchemaIsConsistent(value.entities)
  }
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
