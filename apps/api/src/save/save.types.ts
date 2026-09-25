// API-side validation for the @racer/domain save wire contract (docs/technical/architecture.md).
// This stays self-contained because the production API is a CommonJS deploy and does not ship workspace TS sources.

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

const ID_PATTERN = /^[A-Za-z0-9_.:-]{1,120}$/
const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/
const MAX_SCENARIO_TIER = 14
const MAX_UMA_LEVEL = MAX_SCENARIO_TIER * 10
const MAX_TRAINING_LEVEL = 10
/** v5 and v6 cards held limit breaks up to 4; v7 cards hold 0★–5★ (D147). */
const LEGACY_MAX_LIMIT_BREAK = 4
const MAX_STARS = 5
const CARD_SET_SIZE = 6
/** A ceiling on constellation size, not the authored node count: the templates are not in this deploy. */
const MAX_CONSTELLATION_NODES = 128
const STATS = ['speed', 'stamina', 'power', 'guts', 'wit'] as const
const GRADES = ['S', 'A', 'B', 'C', 'D', 'E', 'F', 'G'] as const
const SKILL_ORIGINS = ['own-unique', 'awakening', 'card', 'inherited'] as const
export const LEDGER_RESOURCES = ['tickets', 'card-coupons', 'uma-coupons', 'uma-shards'] as const
export const LEDGER_REASONS = [
  'daily-grant', 'initial-grant', 'training', 'uma-level', 'card-level', 'uma-promotion', 'card-limit-break', 'card-max',
  'uma-shard-exchange', 'card-coupon-redeem', 'uma-coupon-redeem', 'card-unlock', 'dev-grant',
] as const
const PROFILE_FIELDS = ['schemaVersion', 'tickets', 'cardCoupons', 'umaCoupons', 'umaShards', 'lastDailyGrant', 'featuredUmaId', 'starterSeedContentVersion', 'createdAt'] as const
const LEGACY_UMA_FIELDS = ['templateId', 'level', 'exp', 'trainingLevel', 'trainingExp', 'stats', 'skillPoints', 'aptitudes', 'deckCardIds', 'skillLibrary', 'loadoutSkillIds', 'trainingsThisScenario'] as const
const UMA_FIELDS = ['schemaVersion', ...LEGACY_UMA_FIELDS, 'scenarioStarted', 'skillHistory', 'currentParents', 'parentSnapshot', 'goalPlanVersion', 'scenarioJourneys'] as const
const CURRENT_UMA_FIELDS = [...UMA_FIELDS, 'scenarioModifier'] as const
const UMA_V6_FIELDS = ['schemaVersion', 'templateId', 'level', 'exp', 'unlockedTier', 'scenarios', 'skillHistory', 'goalPlanVersion'] as const
const SCENARIO_TRAINING_FIELDS = ['tier', 'trainingLevel', 'trainingExp', 'cardSetIds', 'assignments', 'loadoutSkillIds', 'journey', 'started'] as const
const CARD_FIELDS = ['templateId', 'level', 'exp', 'limitBreak', 'maxCouponGranted'] as const
const CARD_V5_FIELDS = ['templateId', 'limitBreak', 'maxCouponGranted'] as const
const CARD_V6_FIELDS = ['templateId', 'limitBreaks', 'maxCouponGranted'] as const
const CARD_V7_FIELDS = ['templateId', 'stars', 'maxCouponGranted'] as const
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
    isNonNegativeInt(entry.friendshipTrainings) && isNonNegativeInt(entry.raceStarts) && parseUniqueIds(entry.completedGoalIds, 3) !== null &&
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
  if (!isRecord(value) || !exactKeys(value, PROFILE_FIELDS) || ![1, 2, 3, 4, 5, 6, 7].includes(value.schemaVersion as number)) return null
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

function parseUmaBase(value: Record<string, unknown>): boolean {
  if (!isId(value.templateId) || !isPositiveInt(value.level) || value.level > MAX_UMA_LEVEL || !isNonNegativeInt(value.exp)) return false
  const expLimit = value.level === MAX_UMA_LEVEL ? 0 : value.level % 10 === 0 ? 100 + 25 * value.level : 100 + 25 * (value.level - 1) - 1
  if (value.exp > expLimit) return false
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
/** Goal plan v3 career stages, in order, with each stage's goal count (mirrors @racer/domain save.ts, D137). */
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
function parseNodeAssignment(value: unknown): boolean {
  if (!isRecord(value)) return false
  if (value.kind === 'card') return exactKeys(value, ['kind', 'cardId']) && isId(value.cardId)
  if (value.kind === 'stat') return exactKeys(value, ['kind', 'stat']) && STATS.includes(value.stat as (typeof STATS)[number])
  if (value.kind === 'lineage') return exactKeys(value, ['kind', 'templateId']) && isId(value.templateId)
  return false
}

/**
 * One persisted career run. `assignments` is only shape-checked: which node ids exist per tier comes from
 * the authored constellation templates, which live in @racer/domain and are not shipped to this deploy.
 */
function parseScenarioTraining(value: unknown, umaLevel: number): boolean {
  if (!isRecord(value) || !exactKeys(value, SCENARIO_TRAINING_FIELDS)) return false
  if (!isPositiveInt(value.tier) || value.tier > MAX_SCENARIO_TIER || value.tier > Math.ceil(umaLevel / 10)) return false
  if (!isPositiveInt(value.trainingLevel) || value.trainingLevel > MAX_TRAINING_LEVEL) return false
  if (!isNonNegativeInt(value.trainingExp) || typeof value.started !== 'boolean') return false
  if (!parseUniqueIds(value.cardSetIds, CARD_SET_SIZE) || !parseUniqueIds(value.loadoutSkillIds)) return false
  if (!isRecord(value.assignments)) return false
  const nodeIds = Object.keys(value.assignments)
  if (nodeIds.length > MAX_CONSTELLATION_NODES || nodeIds.some((nodeId) => !isId(nodeId))) return false
  if (nodeIds.some((nodeId) => !parseNodeAssignment((value.assignments as Record<string, unknown>)[nodeId]))) return false
  if (value.journey === null) return true
  return parseJourney(value.journey, false) && (value.journey as Record<string, unknown>).tier === value.tier
}

/** v5, v6 and v7 Umas share one shape: only cards (and v7's tickets) changed between them. */
function parseUmaV6(value: Record<string, unknown>): Record<string, unknown> | null {
  if (!exactKeys(value, UMA_V6_FIELDS) || ![5, 6, 7].includes(value.schemaVersion as number)) return null
  if (!isId(value.templateId) || !isPositiveInt(value.level) || value.level > MAX_UMA_LEVEL || !isNonNegativeInt(value.exp)) return null
  const expLimit = value.level === MAX_UMA_LEVEL ? 0 : value.level % 10 === 0 ? 100 + 25 * value.level : 100 + 25 * (value.level - 1) - 1
  if (value.exp > expLimit) return null
  if (!isNonNegativeInt(value.goalPlanVersion) || value.goalPlanVersion > 3) return null

  const currentTier = Math.ceil((value.level as number) / 10)
  if (!isPositiveInt(value.unlockedTier) || value.unlockedTier > currentTier) return null
  if (!Array.isArray(value.scenarios) || value.scenarios.length === 0) return null
  if (value.scenarios.some((run) => !parseScenarioTraining(run, value.level as number))) return null
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
  if (value.schemaVersion === 5 || value.schemaVersion === 6 || value.schemaVersion === 7) return parseUmaV6(value)
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
  if (isRecord(value) && exactKeys(value, CARD_V7_FIELDS)) {
    if (!isId(value.templateId) || typeof value.maxCouponGranted !== 'boolean' || !parsePerTier(value.stars, MAX_STARS)) return null
    return value
  }
  // Old clients still sync v6 and v5 cards until they update; the app migrates them on read.
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

function parseCourseLayout(value: unknown, distance: number, withSlopes = false): boolean {
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
  const hasCompletedGoalIds = Object.hasOwn(value, 'completedGoalIds')
  const hasAccomplishmentFacts = Object.hasOwn(value, 'accomplishmentFacts')
  const hasEarnedFlairEventIds = Object.hasOwn(value, 'earnedFlairEventIds')
  const version = value.engineVersion
  if (!exactKeys(value, [
    ...RACE_RESULT_FIELDS,
    ...(hasCompletedGoalIds ? ['completedGoalIds'] : []),
    ...(hasAccomplishmentFacts ? ['accomplishmentFacts'] : []),
    ...(hasEarnedFlairEventIds ? ['earnedFlairEventIds'] : []),
    ...(versioned ? ['engineVersion', 'course'] : []),
  ]) ||
      (versioned && ![2, 3, 4, 5, 6].includes(version as number)) || !Array.isArray(value.field)) return null
  // Engine v6 (turns, D154) records the same course as v5.
  const v5Course = version === 5 || version === 6
  const hasLayout = version === 3 || version === 4 || v5Course
  if (versioned && (
    !isRecord(value.course) ||
    !exactKeys(value.course, v5Course ? RACE_COURSE_V5_FIELDS : hasLayout ? RACE_COURSE_V3_FIELDS : RACE_COURSE_FIELDS) ||
    !isPositiveInt(value.course.distance) || !['turf', 'dirt'].includes(String(value.course.surface)) ||
    !isNonNegativeInt(value.course.season) ||
    (hasLayout && !parseCourseLayout(value.course.layout, value.course.distance, v5Course)) ||
    (v5Course && (!isNonNegativeInt(value.course.trackId) || !isNonNegativeInt(value.course.rotation)))
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
  if (hasAccomplishmentFacts && !parseRaceFacts(value.accomplishmentFacts, fieldSize, value.playerPlacement as number, value.course)) return null
  return value
}

function parseEntityData(kind: EntityKind, value: unknown): Record<string, unknown> | null {
  if (kind === 'profile') return parseProfile(value)
  if (kind === 'umas') return parseUma(value)
  if (kind === 'cards') return parseCard(value)
  return parseBadge(value)
}

function parseLogData(kind: LogKind, value: unknown): Record<string, unknown> | null {
  if (kind === 'ledger') return parseLedger(value)
  if (kind === 'raceResults') return parseRaceResult(value)
  return parseFlair(value)
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
    if ((kind === 'profile' && value.id !== 'main') || ((kind === 'umas' || kind === 'cards') && data.templateId !== value.id) ||
      (kind === 'badges' && (data.scope === 'trainer' ? value.id !== 'trainer' : value.id !== `uma:${String(data.umaId)}`))) return `${kind} id does not match data`
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
    if (kind === 'flairEvents' && value.createdAt !== data.earnedAt) return 'flairEvents timestamp does not match data'
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
    const currentSchema = current && (current.kind === 'profile' || current.kind === 'umas')
      ? (current.kind === 'profile' ? current.data.schemaVersion : (current.data.schemaVersion ?? 1))
      : null
    const incomingSchema = upsert.kind === 'profile' || upsert.kind === 'umas'
      ? (upsert.kind === 'profile' ? upsert.data.schemaVersion : (upsert.data.schemaVersion ?? 1))
      : null
    if (current && typeof currentSchema === 'number' && typeof incomingSchema === 'number' && currentSchema > incomingSchema) {
      conflicts.push(current)
      continue
    }
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
