// Typed local-first save vocabulary and initialization (docs/tasks/T003-stable-save-foundation.md).

import { CARD_MAX_LEVEL, MAX_LIMIT_BREAK, cardExpToNext, cardLevelCap } from './cards'
import type { SupportCardTemplate, UmaTemplate } from './content'
import { DAILY_TICKETS, TICKET_STORAGE_CAP } from './economy'
import { expToNextUmaLevel } from './progression'
import { LEVELS_PER_SCENARIO, SCENARIOS, isGateLevel } from './scenarios'
import { EXP_TO_NEXT_TRAINING_LEVEL, MAX_TRAINING_LEVEL } from './training'
import { GRADES, STATS, type Aptitudes, type Grade, type Stats } from './types'

export const SAVE_SCHEMA_VERSION = 1 as const
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

export interface UmaSave {
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
}

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
export const LOG_KINDS = ['raceResults', 'ledger'] as const
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

export function parsePlayerProfile(value: unknown): PlayerProfile | null {
  if (!isObject(value)) return null
  if (value.schemaVersion !== SAVE_SCHEMA_VERSION) return null
  if (![value.tickets, value.cardCoupons, value.umaCoupons, value.umaShards].every(isNonNegativeInt)) return null
  if (value.lastDailyGrant !== null && !isLocalDay(value.lastDailyGrant)) return null
  if (value.featuredUmaId !== null && !isId(value.featuredUmaId)) return null
  if (value.starterSeedContentVersion !== null && !isId(value.starterSeedContentVersion)) return null
  if (!isTimestamp(value.createdAt)) return null
  return {
    schemaVersion: SAVE_SCHEMA_VERSION,
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
  if (!isObject(value) || !isId(value.skillId)) return null
  if (!['own-unique', 'awakening', 'card', 'inherited'].includes(String(value.origin))) return null
  if (value.sourceId !== null && !isId(value.sourceId)) return null
  return { skillId: value.skillId, origin: value.origin as SkillOrigin, sourceId: value.sourceId as string | null }
}

export function parseUmaSave(value: unknown): UmaSave | null {
  if (!isObject(value) || !isId(value.templateId)) return null
  if (!isPositiveInt(value.level) || value.level > SCENARIOS.length * LEVELS_PER_SCENARIO || !isNonNegativeInt(value.exp)) return null
  const expLimit = expToNextUmaLevel(value.level) + (isGateLevel(value.level) ? expToNextUmaLevel(value.level + 1) : -1)
  if (value.exp > expLimit) return null
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
  return {
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
    skillLibrary: template.uniqueSkillId
      ? [{ skillId: template.uniqueSkillId, origin: 'own-unique', sourceId: template.id }]
      : [],
    loadoutSkillIds: [],
    trainingsThisScenario: 0,
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

export function parseEntityData(kind: EntityKind, value: unknown): Record<string, unknown> | null {
  if (kind === 'profile') return parsePlayerProfile(value) as unknown as Record<string, unknown> | null
  if (kind === 'umas') return parseUmaSave(value) as unknown as Record<string, unknown> | null
  if (kind === 'cards') return parseCardSave(value) as unknown as Record<string, unknown> | null
  return parseGenericData(value)
}

export function parseLogData(kind: LogKind, value: unknown): Record<string, unknown> | null {
  if (kind === 'ledger') return parseLedgerEntry(value) as unknown as Record<string, unknown> | null
  return parseGenericData(value)
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
    if ((kind === 'profile' && value.id !== 'main') || ((kind === 'umas' || kind === 'cards') && data.templateId !== value.id)) {
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
  const data = parseEntityData(kind, value.data)
  if (!data) return null
  if ((kind === 'profile' && value.id !== 'main') || ((kind === 'umas' || kind === 'cards') && data.templateId !== value.id)) return null
  return { kind, id: value.id, version: value.version, data, deleted: value.deleted, updatedAt: value.updatedAt }
}

function parseLogRecord(value: unknown): LogRecord | null {
  if (!isObject(value) || !LOG_KINDS.includes(value.kind as LogKind) || !isId(value.id) || !isTimestamp(value.createdAt)) return null
  const kind = value.kind as LogKind
  const data = parseLogData(kind, value.data)
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
      parsePlayerProfileOrThrow(record.data)
    }
  }
}

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
