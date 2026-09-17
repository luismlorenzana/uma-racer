// API-side validation for the @racer/domain save wire contract (docs/tasks/T003-stable-save-foundation.md).
// This stays self-contained because the production API is a CommonJS deploy and does not ship workspace TS sources.

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

const ID_PATTERN = /^[A-Za-z0-9_.:-]{1,120}$/
const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/
const STATS = ['speed', 'stamina', 'power', 'guts', 'wit'] as const
const GRADES = ['S', 'A', 'B', 'C', 'D', 'E', 'F', 'G'] as const
const SKILL_ORIGINS = ['own-unique', 'awakening', 'card', 'inherited'] as const
const LEDGER_RESOURCES = ['tickets', 'card-coupons', 'uma-coupons', 'uma-shards'] as const
const LEDGER_REASONS = [
  'daily-grant', 'initial-grant', 'training', 'uma-level', 'card-level', 'uma-promotion', 'card-limit-break', 'card-max',
  'uma-shard-exchange', 'card-coupon-redeem', 'uma-coupon-redeem',
] as const
const PROFILE_FIELDS = ['schemaVersion', 'tickets', 'cardCoupons', 'umaCoupons', 'umaShards', 'lastDailyGrant', 'featuredUmaId', 'starterSeedContentVersion', 'createdAt'] as const
const UMA_FIELDS = ['templateId', 'level', 'exp', 'trainingLevel', 'trainingExp', 'stats', 'skillPoints', 'aptitudes', 'deckCardIds', 'skillLibrary', 'loadoutSkillIds', 'trainingsThisScenario'] as const
const CARD_FIELDS = ['templateId', 'level', 'exp', 'limitBreak', 'maxCouponGranted'] as const
const SKILL_FIELDS = ['skillId', 'origin', 'sourceId'] as const
const LEDGER_FIELDS = ['resource', 'delta', 'reason', 'localDay', 'createdAt'] as const
const STRATEGIES = ['front', 'pace', 'late', 'end'] as const
const RACE_RESULT_FIELDS = [
  'contentVersion', 'umaId', 'raceId', 'sequence', 'seed', 'strategy', 'startLevel', 'startExp', 'startStats',
  'raceBonus', 'playerPlacement', 'expGained', 'levelsGained', 'ticketReward', 'shardReward', 'field', 'createdAt',
] as const
const RACE_COURSE_FIELDS = ['distance', 'surface', 'season'] as const
const RACE_COURSE_V3_FIELDS = ['distance', 'surface', 'season', 'layout'] as const
const RACE_RUNNER_FIELDS = ['umaId', 'isPlayer', 'strategy', 'gate', 'stats', 'aptitude', 'placement', 'finishTime', 'marginLengths'] as const
const RACE_APTITUDE_FIELDS = ['distance', 'surface', 'strategy'] as const

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

function parseProfile(value: unknown): Record<string, unknown> | null {
  if (!isRecord(value) || !exactKeys(value, PROFILE_FIELDS) || value.schemaVersion !== 1) return null
  if (![value.tickets, value.cardCoupons, value.umaCoupons, value.umaShards].every(isNonNegativeInt)) return null
  if (value.lastDailyGrant !== null && !isLocalDay(value.lastDailyGrant)) return null
  if (value.featuredUmaId !== null && !isId(value.featuredUmaId)) return null
  if (value.starterSeedContentVersion !== null && !isId(value.starterSeedContentVersion)) return null
  if (!isNonNegativeInt(value.createdAt)) return null
  return value
}

function parseUma(value: unknown): Record<string, unknown> | null {
  if (!isRecord(value) || !exactKeys(value, UMA_FIELDS) || !isId(value.templateId) || !isPositiveInt(value.level) || value.level > 110 || !isNonNegativeInt(value.exp)) return null
  const expToNext = 100 + 25 * (value.level - 1)
  const expLimit = expToNext + (value.level % 10 === 0 ? 100 + 25 * value.level : -1)
  if (value.exp > expLimit) return null
  if (!isPositiveInt(value.trainingLevel) || value.trainingLevel > 10 || !isNonNegativeInt(value.trainingExp)) return null
  if ((value.trainingLevel === 10 && value.trainingExp !== 0) || (value.trainingLevel < 10 && value.trainingExp >= 100)) return null
  if (!parseStats(value.stats) || !parseAptitudes(value.aptitudes) || !isNonNegativeInt(value.skillPoints) || !isNonNegativeInt(value.trainingsThisScenario)) return null
  const deck = parseUniqueIds(value.deckCardIds, 6)
  const loadout = parseUniqueIds(value.loadoutSkillIds)
  if (!deck || !loadout || !Array.isArray(value.skillLibrary)) return null
  const skills = value.skillLibrary
  if (skills.some((skill) => !isRecord(skill) || !exactKeys(skill, SKILL_FIELDS) || !isId(skill.skillId) || !SKILL_ORIGINS.includes(skill.origin as (typeof SKILL_ORIGINS)[number]) || (skill.sourceId !== null && !isId(skill.sourceId)))) return null
  const skillIds = skills.map((skill) => (skill as Record<string, unknown>).skillId as string)
  if (new Set(skillIds).size !== skillIds.length) return null
  const paid = new Set(skills.filter((skill) => (skill as Record<string, unknown>).origin !== 'own-unique').map((skill) => (skill as Record<string, unknown>).skillId))
  if (loadout.some((id) => !paid.has(id))) return null
  return value
}

function parseCard(value: unknown): Record<string, unknown> | null {
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
        ['recovery', 'current-speed', 'current-speed-natural', 'target-speed', 'acceleration'].includes(String(effect.kind)) &&
        typeof effect.amount === 'number' && Number.isFinite(effect.amount),
      ) && Array.isArray(group.unsupportedVariables) &&
      group.unsupportedVariables.every((item) => typeof item === 'string' && /^[a-zA-Z0-9_]+$/.test(item)) &&
      Array.isArray(group.unsupportedEffects) && group.unsupportedEffects.every(Number.isSafeInteger)
  })
}

function parseCourseLayout(value: unknown, distance: number): boolean {
  if (!isRecord(value) || !exactKeys(value, ['corners', 'straights']) ||
    !Array.isArray(value.corners) || !Array.isArray(value.straights)) return false
  const valid = (segments: unknown[], corner: boolean) => segments.every((segment, index) => {
    if (!isRecord(segment) || !exactKeys(segment, corner ? ['start', 'end', 'number'] : ['start', 'end'])) return false
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
  const version = value.engineVersion
  if (!exactKeys(value, [...RACE_RESULT_FIELDS, ...(versioned ? ['engineVersion', 'course'] : [])]) ||
      (versioned && version !== 2 && version !== 3) || !Array.isArray(value.field)) return null
  if (versioned && (
    !isRecord(value.course) || !exactKeys(value.course, version === 3 ? RACE_COURSE_V3_FIELDS : RACE_COURSE_FIELDS) ||
    !isPositiveInt(value.course.distance) || !['turf', 'dirt'].includes(String(value.course.surface)) ||
    !isNonNegativeInt(value.course.season) || (version === 3 && !parseCourseLayout(value.course.layout, value.course.distance))
  )) return null
  const fieldSize = value.field.length
  if (
    !isId(value.contentVersion) || !isId(value.umaId) || !isId(value.raceId) ||
    !isNonNegativeInt(value.sequence) || !isNonNegativeInt(value.seed) ||
    !STRATEGIES.includes(value.strategy as (typeof STRATEGIES)[number]) ||
    !isPositiveInt(value.startLevel) || value.startLevel > 110 || !isNonNegativeInt(value.startExp) ||
    !parseRaceStats(value.startStats) || typeof value.raceBonus !== 'number' || !Number.isFinite(value.raceBonus) || value.raceBonus < 0 ||
    !isPositiveInt(value.playerPlacement) || value.playerPlacement > fieldSize || !isNonNegativeInt(value.expGained) ||
    !Array.isArray(value.levelsGained) || value.levelsGained.some((level) => !isPositiveInt(level) || level > 110) ||
    !isNonNegativeInt(value.ticketReward) || value.ticketReward !== value.levelsGained.length * 5 ||
    !isNonNegativeInt(value.shardReward) || value.shardReward > 1 || fieldSize < 8 || fieldSize > 18 ||
    !isNonNegativeInt(value.createdAt)
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
  return value
}

function parseEntityData(kind: EntityKind, value: unknown): Record<string, unknown> | null {
  if (kind === 'profile') return parseProfile(value)
  if (kind === 'umas') return parseUma(value)
  if (kind === 'cards') return parseCard(value)
  return isRecord(value) ? value : null
}

function parseLogData(kind: LogKind, value: unknown): Record<string, unknown> | null {
  return kind === 'ledger' ? parseLedger(value) : parseRaceResult(value)
}

/** Shape-check an untrusted sync body before it reaches either repository implementation. */
export function parseSyncRequest(body: unknown): SyncRequest | string {
  if (!isRecord(body)) return 'body must be an object'
  const upserts = body.upserts ?? []
  const appends = body.appends ?? []
  if (!Array.isArray(upserts) || !Array.isArray(appends)) return 'upserts and appends must be arrays'
  if (upserts.length + appends.length > MAX_SYNC_OPERATIONS) return `at most ${MAX_SYNC_OPERATIONS} operations per sync`

  const parsedUpserts: EntityUpsert[] = []
  for (const value of upserts) {
    if (!isRecord(value)) return 'upsert must be an object'
    if (!ENTITY_KINDS.includes(value.kind as EntityKind)) return `unknown entity kind ${String(value.kind)}`
    const kind = value.kind as EntityKind
    if (!isId(value.id)) return 'invalid entity id'
    if (!isNonNegativeInt(value.baseVersion)) return 'invalid baseVersion'
    const data = parseEntityData(kind, value.data)
    if (!data) return `invalid ${kind} data`
    if ((kind === 'profile' && value.id !== 'main') || ((kind === 'umas' || kind === 'cards') && data.templateId !== value.id)) return `${kind} id does not match data`
    if (value.deleted !== undefined && typeof value.deleted !== 'boolean') return 'invalid deleted flag'
    parsedUpserts.push({ kind, id: value.id, baseVersion: value.baseVersion, data, deleted: value.deleted as boolean | undefined })
  }

  const parsedAppends: LogAppend[] = []
  for (const value of appends) {
    if (!isRecord(value)) return 'append must be an object'
    if (!LOG_KINDS.includes(value.kind as LogKind)) return `unknown log kind ${String(value.kind)}`
    const kind = value.kind as LogKind
    if (!isId(value.id)) return 'invalid log id'
    const data = parseLogData(kind, value.data)
    if (!data) return `invalid ${kind} data`
    if (!isNonNegativeInt(value.createdAt)) return 'append createdAt must be a number'
    if (kind === 'raceResults' && (value.id !== `race:${String(data.umaId)}:${String(data.sequence)}` || value.createdAt !== data.createdAt)) {
      return 'raceResults id or timestamp does not match data'
    }
    parsedAppends.push({ kind, id: value.id, data, createdAt: value.createdAt })
  }
  const entityKeys = parsedUpserts.map((item) => `${item.kind}/${item.id}`)
  const logKeys = parsedAppends.map((item) => `${item.kind}/${item.id}`)
  if (new Set(entityKeys).size !== entityKeys.length || new Set(logKeys).size !== logKeys.length) return 'duplicate operation id'
  return { upserts: parsedUpserts, appends: parsedAppends }
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
    const currentVersion = current?.version ?? 0
    if (current && upsert.baseVersion !== currentVersion) {
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
