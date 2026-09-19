// Pure Badge destination projections (docs/design/badges.md#badge-page).

import {
  BADGE_TIERS,
  buildUmaFlairCatalog,
  decodeBadgeFilters,
  flattenShowcase,
  prestigeForState,
  projectFlairProgress,
  SCENARIOS,
  stableBadgeRarity,
  type BadgeFilter,
  type BadgeSort,
  type BadgeTier,
  type FlairCriterion,
  type FlairDefinition,
  type FlairEventV1,
  type FlairSource,
  type HistoryGrade,
  type UmaBadgeStateV1,
  type UmaSave,
  type StableBadgeRarity,
  type RaceResultRecord,
} from '@racer/domain'
import type { LoadedContent } from '../content/runtime'
import { badgeFrameStyle, type BadgeFrameStyle } from './badge-frame'

export { badgeFrameStyle, type BadgeFrameStyle } from './badge-frame'

export type BadgeScope = 'uma' | 'stable' | 'trainer'
export type BadgeRarity = StableBadgeRarity

export interface BadgeRouteState {
  scope: BadgeScope
  umaId: string | null
  query: string
  filters: BadgeFilter[]
  sort: BadgeSort
  detail: string | null
  timelineKind: FlairEventV1['kind'] | null
  unavailable: string[]
}

export interface BadgeSourceView {
  label: string
  to: string | null
  safeId: string | null
}

export interface BadgeCollectionItem {
  awardKey: string
  label: string
  description: string
  criterionLabel: string
  category: string
  kind: FlairDefinition['kind'] | 'missing'
  tier: BadgeTier | 'one-off' | null
  tierIndex: number
  status: 'locked' | 'progress' | 'complete' | 'untracked' | 'disabled' | 'missing'
  history: HistoryGrade | null
  historyLabel: string
  progressLabel: string
  progress: number | null
  value: number | null
  nextThreshold: number | null
  thresholds: number[]
  points: number
  tags: string[]
  earnedAt: number | null
  pinned: boolean
  groupId: string | null
  source: BadgeSourceView | null
  searchText: string
  surface: string | null
  distance: string | null
  strategy: string | null
  aptitude: string | null
  venue: string | null
  grade: string | null
  scenario: string | null
}

export interface UmaBadgeCollection {
  scope: 'uma'
  umaId: string
  prestige: number
  frame: BadgeFrameStyle
  activeTitle: string | null
  earnedCount: number
  visibleCount: number
  pinnedRefs: string[]
  items: BadgeCollectionItem[]
  orphanedAwardRefs: string[]
}

export interface StableBadgeItem extends BadgeCollectionItem {
  holderCount: number
  ownedUmaCount: number
  rarityPercent: number
  rarity: BadgeRarity
  holders: { umaId: string; name: string; tier: BadgeCollectionItem['tier']; earnedAt: number | null }[]
}

export interface StableBadgeCollection {
  scope: 'stable'
  ownedUmaCount: number
  earnedCount: number
  visibleCount: number
  completionPercent: number
  items: StableBadgeItem[]
  orphanedUmaIds: string[]
}

export interface TrophyView {
  awardKey: string
  familyId: string
  label: string
  count: number
  firstEarnedAt: number
  lastEarnedAt: number
  firstSource: BadgeSourceView
  lastSource: BadgeSourceView
}

export interface TimelineItemView {
  id: string
  kind: FlairEventV1['kind']
  kindLabel: string
  awardKey: string
  label: string
  stage: FlairEventV1['stage']
  earnedAt: number
  retroactive: boolean
  historyLabel: string
  source: BadgeSourceView | null
}

const TIER_ORDER: Record<BadgeTier | 'one-off', number> = {
  bronze: 0, silver: 1, gold: 2, platinum: 3, rainbow: 4, 'one-off': 5,
}
const KIND_LABELS: Record<FlairEventV1['kind'], string> = {
  'badge-tier': 'Badge', 'one-off': 'Feat', 'goal-ribbon': 'Goal Ribbon', honors: 'Honors', title: 'Title',
  'trophy-earned': 'G1 Trophy', 'trainer-achievement': 'Achievement',
}
const SEARCH_SPACES = /\s+/g

const normalizeSearch = (value: string): string => value.trim().toLocaleLowerCase().replace(SEARCH_SPACES, ' ')
const humanize = (value: string): string => value.split(/[-_:]/).filter(Boolean)
  .map((part) => part.charAt(0).toLocaleUpperCase() + part.slice(1)).join(' ')

function sourceView(source: FlairSource | null, umaId: string, raceResults: readonly RaceResultRecord[] = []): BadgeSourceView | null {
  if (!source) return null
  if (source.kind === 'race' && source.id) {
    const record = raceResults.find((entry) => `race:${entry.umaId}:${entry.sequence}` === source.id)
    return record
      ? { label: 'View race result', to: `/race/run?uma=${encodeURIComponent(record.umaId)}&race=${encodeURIComponent(record.raceId)}&strategy=${record.strategy}&sequence=${record.sequence}`, safeId: source.id }
      : { label: 'Race result unavailable', to: null, safeId: source.id }
  }
  if (source.kind === 'goal') return { label: 'View Journey', to: `/stable/${encodeURIComponent(umaId)}#journey`, safeId: source.id }
  if (source.kind === 'training') return { label: 'Training milestone', to: null, safeId: source.id }
  if (source.kind === 'scenario') return { label: `Scenario ${source.tier ?? ''} completion`.trim(), to: `/stable/${encodeURIComponent(umaId)}#journey`, safeId: source.id }
  if (source.kind === 'migration') return { label: 'Imported history', to: null, safeId: source.id }
  return { label: 'Collection award', to: null, safeId: source.id }
}

function context(definition: FlairDefinition) {
  const result = { surface: null as string | null, distance: null as string | null, strategy: null as string | null,
    aptitude: null as string | null, venue: null as string | null, grade: null as string | null, scenario: null as string | null }
  const criterion = definition.criterion
  if (criterion.kind === 'count') {
    if (criterion.fact === 'surfaceWins') result.surface = criterion.key
    if (criterion.fact === 'distanceWins') result.distance = criterion.key
    if (criterion.fact === 'strategyWins') result.strategy = criterion.key
    if (criterion.fact === 'venueWins') result.venue = criterion.key
    if (criterion.fact === 'gradeWins') result.grade = criterion.key
    if (criterion.fact === 'lowAptitudeSurfaceWins') { result.surface = criterion.key; result.aptitude = 'challenge' }
    if (criterion.fact === 'lowAptitudeDistanceWins') { result.distance = criterion.key; result.aptitude = 'challenge' }
  }
  if (criterion.kind === 'minimum-count') {
    if (criterion.fact === 'surfaceWins') result.surface = '*'
    if (criterion.fact === 'distanceWins') result.distance = '*'
    if (criterion.fact === 'strategyWins') result.strategy = '*'
    if (criterion.fact === 'venueWins') result.venue = '*'
  }
  if (criterion.kind === 'scenario') result.scenario = String(criterion.tier)
  if (criterion.kind === 'goal') result.scenario = definition.tags.find((tag) => tag.startsWith('tier:'))?.slice(5) ?? null
  if (criterion.kind === 'family-wins' || criterion.kind === 'series') result.grade = 'g1'
  if (definition.tags.includes('impossible')) result.aptitude = 'impossible'
  if (definition.tags.includes('unorthodox')) result.aptitude = 'unorthodox'
  return result
}

function criterionLabel(criterion: FlairCriterion): string {
  if (criterion.kind === 'fact') return humanize(criterion.fact)
  if (criterion.kind === 'count') return `${humanize(criterion.key)} ${humanize(criterion.fact)}`
  if (criterion.kind === 'minimum-count') return `${humanize(criterion.fact)} across ${criterion.keys.length} categories`
  if (criterion.kind === 'race-feat') return humanize(criterion.key)
  if (criterion.kind === 'stat-peak') return `${humanize(criterion.stat)} peak`
  if (criterion.kind === 'scenario') return `${SCENARIOS[criterion.tier - 1]?.name ?? `Scenario ${criterion.tier}`} · ${humanize(criterion.rule)}`
  if (criterion.kind === 'all-scenarios') return 'Complete every scenario'
  if (criterion.kind === 'goal') return `Journey goal ${criterion.goalId}`
  if (criterion.kind === 'series') return `${humanize(criterion.tag)} series`
  if (criterion.kind === 'family-wins') return `${humanize(criterion.familyId)} wins`
  if (criterion.kind === 'course-record') return `Course record ${criterion.courseId}`
  return humanize(criterion.kind)
}

function awardDetails(state: UmaBadgeStateV1, awardKey: string) {
  const stages = state.awards.badges.filter((award) => award.awardKey === awardKey)
  const title = state.awards.titles.find((award) => award.awardKey === awardKey)
  const trophy = awardKey.startsWith('trophy:')
    ? state.awards.trophies.find((award) => awardKey === `trophy:${award.familyId}`)
    : undefined
  const rows = [...stages, ...(title ? [title] : [])]
  const earnedAt = Math.max(-1, ...rows.map((row) => row.earnedAt), trophy?.lastEarnedAt ?? -1)
  const source = rows.sort((left, right) => right.earnedAt - left.earnedAt)[0]?.source ??
    (trophy ? { kind: 'race' as const, id: trophy.lastResultId, tier: null } : null)
  return { earnedAt: earnedAt < 0 ? null : earnedAt, source }
}

function missingItem(awardKey: string, state: UmaBadgeStateV1, pin: { pinned: boolean; groupId: string | null }, raceResults: readonly RaceResultRecord[]): BadgeCollectionItem {
  const details = awardDetails(state, awardKey)
  return {
    awardKey, label: `Missing content · ${awardKey}`, description: 'This earned award is preserved while its content is unavailable.',
    criterionLabel: 'Content unavailable', category: 'missing', kind: 'missing', tier: 'one-off', tierIndex: 5,
    status: 'missing', history: null, historyLabel: 'Stored award', progressLabel: 'Earned · content unavailable', progress: 1,
    value: null, nextThreshold: null, thresholds: [], points: 0, tags: ['missing'], earnedAt: details.earnedAt,
    ...pin, source: sourceView(details.source, state.umaId, raceResults), searchText: normalizeSearch(awardKey),
    surface: null, distance: null, strategy: null, aptitude: null, venue: null, grade: null, scenario: null,
  }
}

export function buildUmaBadgeCollection(
  content: LoadedContent,
  state: UmaBadgeStateV1,
  events: readonly (FlairEventV1 & { id: string })[] = [],
  raceResults: readonly RaceResultRecord[] = [],
): UmaBadgeCollection {
  const catalog = buildUmaFlairCatalog({ state, races: content.races.items })
  const groups = new Map(state.preferences.showcaseGroups.flatMap((group) => group.awardRefs.map((ref) => [ref, group.id] as const)))
  const definitions = new Map(catalog.definitions.map((definition) => [definition.awardKey, definition]))
  const items = catalog.definitions.flatMap((definition): BadgeCollectionItem[] => {
    const progress = projectFlairProgress(definition, state)
    if (progress.status === 'hidden') return []
    const details = awardDetails(state, definition.awardKey)
    const event = events.filter((row) => row.scope === 'uma' && row.umaId === state.umaId && row.awardKey === definition.awardKey)
      .sort((left, right) => right.earnedAt - left.earnedAt || right.id.localeCompare(left.id))[0]
    const tier = progress.highestStage
    const scenarioName = definition.criterion.kind === 'scenario' ? SCENARIOS[definition.criterion.tier - 1]?.name ?? '' : ''
    return [{
      awardKey: definition.awardKey, label: definition.label, description: definition.description,
      criterionLabel: criterionLabel(definition.criterion), category: definition.category, kind: definition.kind, tier,
      tierIndex: tier ? TIER_ORDER[tier] : -1, status: progress.status,
      history: progress.history,
      historyLabel: progress.history === 'exact' ? 'Exact history' : progress.history === 'since-tracking' ? 'Since tracking began' : 'History unavailable',
      progressLabel: progress.progressLabel, progress: progress.percentage, value: progress.value,
      nextThreshold: progress.nextThreshold, thresholds: [...definition.thresholds], points: definition.points,
      tags: [...definition.tags], earnedAt: event?.earnedAt ?? details.earnedAt, pinned: groups.has(definition.awardKey),
      groupId: groups.get(definition.awardKey) ?? null, source: sourceView(event?.source ?? details.source, state.umaId, raceResults),
      searchText: normalizeSearch([definition.label, definition.description, criterionLabel(definition.criterion), scenarioName,
        ...definition.tags, ...definition.frozenKeys].join(' ')), ...context(definition),
    }]
  })
  const earnedRefs = new Set([
    ...state.awards.badges.map((row) => row.awardKey), ...state.awards.titles.map((row) => row.awardKey),
    ...state.awards.trophies.map((row) => `trophy:${row.familyId}`),
  ])
  const orphanedAwardRefs = [...earnedRefs].filter((ref) => !definitions.has(ref)).sort()
  for (const ref of orphanedAwardRefs) items.push(missingItem(ref, state, { pinned: groups.has(ref), groupId: groups.get(ref) ?? null }, raceResults))
  const prestige = prestigeForState(catalog, state)
  return {
    scope: 'uma', umaId: state.umaId, prestige, frame: badgeFrameStyle(prestige),
    activeTitle: state.preferences.activeTitleId,
    earnedCount: items.filter((item) => item.tier !== null).length, visibleCount: items.length,
    pinnedRefs: flattenShowcase(state.preferences.showcaseGroups), items, orphanedAwardRefs,
  }
}

export function buildStableBadgeCollection(
  content: LoadedContent,
  owned: readonly { save: UmaSave; state: UmaBadgeStateV1 | null }[],
  events: readonly (FlairEventV1 & { id: string })[] = [],
  raceResults: readonly RaceResultRecord[] = [],
): StableBadgeCollection {
  const valid = owned.filter((entry): entry is { save: UmaSave; state: UmaBadgeStateV1 } => entry.state?.umaId === entry.save.templateId)
  const orphanedUmaIds = owned.filter((entry) => !content.umas.byId.has(entry.save.templateId) || entry.state?.umaId !== entry.save.templateId)
    .map((entry) => entry.save.templateId).sort()
  const perUma = valid.map((entry) => ({ ...entry, view: buildUmaBadgeCollection(content, entry.state, events, raceResults) }))
  const keys = new Set(perUma.flatMap((entry) => entry.view.items.filter((item) => item.kind !== 'missing').map((item) => item.awardKey)))
  const items: StableBadgeItem[] = []
  for (const awardKey of [...keys].sort()) {
    const applicable = perUma.map((entry) => ({ entry, item: entry.view.items.find((item) => item.awardKey === awardKey) }))
      .filter((row): row is { entry: typeof perUma[number]; item: BadgeCollectionItem } => Boolean(row.item))
    if (applicable.length === 0) continue
    const holders = applicable.filter((row) => row.item.tier !== null).map((row) => ({
      umaId: row.entry.save.templateId,
      name: content.umas.byId.get(row.entry.save.templateId)?.name ?? row.entry.save.templateId,
      tier: row.item.tier, earnedAt: row.item.earnedAt,
    })).sort((left, right) => (right.earnedAt ?? -1) - (left.earnedAt ?? -1) || left.name.localeCompare(right.name) || left.umaId.localeCompare(right.umaId))
    const representative = [...applicable].sort((left, right) => right.item.tierIndex - left.item.tierIndex ||
      (right.item.earnedAt ?? -1) - (left.item.earnedAt ?? -1) || left.entry.save.templateId.localeCompare(right.entry.save.templateId))[0]!.item
    const holderCount = holders.length
    const denominator = applicable.length
    items.push({ ...representative, pinned: applicable.some((row) => row.item.pinned), groupId: null,
      holderCount, ownedUmaCount: denominator, rarityPercent: denominator === 0 ? 0 : Math.round(holderCount / denominator * 100),
      rarity: stableBadgeRarity(holderCount, denominator), holders })
  }
  const earnedCount = items.filter((item) => item.holderCount > 0).length
  return { scope: 'stable', ownedUmaCount: valid.length, earnedCount, visibleCount: items.length,
    completionPercent: items.length === 0 ? 0 : Math.round(earnedCount / items.length * 100), items, orphanedUmaIds }
}

function matchesFilter(item: BadgeCollectionItem | StableBadgeItem, filter: BadgeFilter): boolean {
  const value = String(filter.value)
  if (filter.kind === 'category') return item.category === value
  if (filter.kind === 'type') return item.kind === value || item.tier === value
  if (filter.kind === 'surface') return item.surface === value || item.surface === '*'
  if (filter.kind === 'distance') return item.distance === value || item.distance === '*'
  if (filter.kind === 'strategy') return item.strategy === value || item.strategy === '*'
  if (filter.kind === 'aptitude') return item.aptitude === value
  if (filter.kind === 'venue') return item.venue === value
  if (filter.kind === 'grade') return item.grade === value
  if (filter.kind === 'scenario') return item.scenario === value
  if (filter.kind === 'status') {
    if (value === 'earned') return item.tier !== null
    if (value === 'complete') return item.status === 'complete'
    return item.status === value
  }
  if (filter.kind === 'pinned') return item.pinned === (value === 'yes')
  if (filter.kind === 'earned-after') return item.earnedAt !== null && item.earnedAt >= Number(filter.value)
  if (filter.kind === 'rarity') return 'rarity' in item && item.rarity === value
  if (filter.kind === 'uma') return 'holders' in item && item.holders.some((holder) => holder.umaId === value)
  return false
}

export function filterBadgeItems<T extends BadgeCollectionItem | StableBadgeItem>(
  items: readonly T[], query: string, filters: readonly BadgeFilter[],
): T[] {
  const normalized = normalizeSearch(query)
  return items.filter((item) => (!normalized || item.searchText.includes(normalized)) && filters.every((filter) => matchesFilter(item, filter)))
}

export function sortBadgeItems<T extends BadgeCollectionItem | StableBadgeItem>(items: readonly T[], sort: BadgeSort): T[] {
  const result = [...items]
  const final = (left: T, right: T) => left.awardKey.localeCompare(right.awardKey)
  result.sort((left, right) => {
    if (sort === 'recent') return (right.earnedAt ?? -1) - (left.earnedAt ?? -1) || final(left, right)
    if (sort === 'tier') return right.tierIndex - left.tierIndex || final(left, right)
    if (sort === 'closest') {
      const leftValue = left.nextThreshold !== null && left.progress !== null ? left.progress : -1
      const rightValue = right.nextThreshold !== null && right.progress !== null ? right.progress : -1
      return rightValue - leftValue || final(left, right)
    }
    if (sort === 'rarest') {
      const leftValue = 'rarityPercent' in left ? left.rarityPercent : 101
      const rightValue = 'rarityPercent' in right ? right.rarityPercent : 101
      return leftValue - rightValue || final(left, right)
    }
    if (sort === 'alphabetical') return left.label.localeCompare(right.label) || final(left, right)
    return left.category.localeCompare(right.category) || left.label.localeCompare(right.label) || final(left, right)
  })
  return result
}

export function buildTrophyWall(content: LoadedContent, state: UmaBadgeStateV1, raceResults: readonly RaceResultRecord[] = []): TrophyView[] {
  return state.awards.trophies.map((trophy) => {
    const race = content.races.items.find((entry) => entry.familyId === trophy.familyId)
    return {
      awardKey: `trophy:${trophy.familyId}`, familyId: trophy.familyId,
      label: race?.name ?? `Missing race · ${trophy.familyId}`, count: trophy.count,
      firstEarnedAt: trophy.firstEarnedAt, lastEarnedAt: trophy.lastEarnedAt,
      firstSource: sourceView({ kind: 'race', id: trophy.firstResultId, tier: null }, state.umaId, raceResults)!,
      lastSource: sourceView({ kind: 'race', id: trophy.lastResultId, tier: null }, state.umaId, raceResults)!,
    }
  }).sort((left, right) => right.lastEarnedAt - left.lastEarnedAt || left.familyId.localeCompare(right.familyId))
}

export function buildTimelineItems(
  content: LoadedContent, state: UmaBadgeStateV1, events: readonly (FlairEventV1 & { id: string })[],
  raceResults: readonly RaceResultRecord[] = [],
): TimelineItemView[] {
  const definitions = new Map(buildUmaFlairCatalog({ state, races: content.races.items }).definitions.map((row) => [row.awardKey, row]))
  return events.filter((event) => event.scope === 'uma' && event.umaId === state.umaId).map((event) => ({
    id: event.id, kind: event.kind, kindLabel: KIND_LABELS[event.kind], awardKey: event.awardKey,
    label: definitions.get(event.awardKey)?.label ?? (event.kind === 'trophy-earned' ? `G1 Trophy · ${event.awardKey}` : humanize(event.awardKey)),
    stage: event.stage, earnedAt: event.earnedAt, retroactive: event.retroactive,
    historyLabel: event.retroactive ? event.source.kind === 'migration' ? 'Imported · original date unavailable' : 'Awarded retroactively' : 'Earned',
    source: sourceView(event.source, state.umaId, raceResults),
  })).sort((left, right) => right.earnedAt - left.earnedAt || right.id.localeCompare(left.id))
}

export function resolveBadgeUmaId(requested: string | null, ownedIds: readonly string[], featuredUmaId: string | null): string | null {
  const ids = [...new Set(ownedIds)].sort()
  if (requested && ids.includes(requested)) return requested
  if (featuredUmaId && ids.includes(featuredUmaId)) return featuredUmaId
  return ids[0] ?? null
}

export function parseBadgeRoute(search: string, validUmaIds: ReadonlySet<string>): BadgeRouteState {
  const params = new URLSearchParams(search)
  const unavailable: string[] = []
  const scopeValue = params.get('scope')
  const scope: BadgeScope = scopeValue === 'stable' || scopeValue === 'trainer' || scopeValue === 'uma' ? scopeValue : 'uma'
  if (scopeValue && scopeValue !== scope) unavailable.push(`scope:${scopeValue}`)
  const umaValue = params.get('uma')
  const umaId = umaValue && validUmaIds.has(umaValue) ? umaValue : null
  if (umaValue && !umaId) unavailable.push(`uma:${umaValue}`)
  const sortValue = params.get('sort') ?? 'recent'
  const validSort: BadgeSort[] = ['recent', 'tier', 'closest', 'rarest', 'alphabetical', 'category']
  const sort: BadgeSort = validSort.includes(sortValue as BadgeSort) && (scope === 'stable' || sortValue !== 'rarest') ? sortValue as BadgeSort : 'recent'
  if (sortValue !== sort) unavailable.push(`sort:${sortValue}`)
  const rawFilters = params.getAll('filter').map((row) => {
    const separator = row.indexOf('=')
    const key = separator < 0 ? row : row.slice(0, separator)
    const value = separator < 0 ? '' : row.slice(separator + 1)
    return key === 'earned-after' ? { key, count: Number(value) } : { key: `${key}:${value}`, count: 1 }
  })
  const decoded = decodeBadgeFilters(rawFilters)
  let filters = decoded ?? []
  if (!decoded && rawFilters.length > 0) unavailable.push(...params.getAll('filter'))
  if (scope !== 'stable') {
    const incompatible = filters.filter((filter) => filter.kind === 'uma' || filter.kind === 'rarity')
    if (incompatible.length > 0) unavailable.push(...incompatible.map((filter) => `${filter.kind}:${filter.value}`))
    filters = filters.filter((filter) => filter.kind !== 'uma' && filter.kind !== 'rarity')
  }
  if (scope === 'trainer') {
    const allowed = new Set<BadgeFilter['kind']>(['category', 'type', 'status', 'pinned', 'earned-after'])
    const incompatible = filters.filter((filter) => !allowed.has(filter.kind))
    if (incompatible.length > 0) unavailable.push(...incompatible.map((filter) => `${filter.kind}:${filter.value}`))
    filters = filters.filter((filter) => allowed.has(filter.kind))
  }
  const timelineValue = params.get('timeline')
  const kinds: FlairEventV1['kind'][] = ['badge-tier', 'one-off', 'goal-ribbon', 'honors', 'title', 'trophy-earned', 'trainer-achievement']
  const timelineKind = timelineValue && kinds.includes(timelineValue as FlairEventV1['kind']) ? timelineValue as FlairEventV1['kind'] : null
  if (timelineValue && !timelineKind) unavailable.push(`timeline:${timelineValue}`)
  return { scope, umaId, query: params.get('q') ?? '', filters, sort, detail: params.get('detail'), timelineKind, unavailable }
}

export function serializeBadgeRoute(state: Omit<BadgeRouteState, 'unavailable'>): string {
  const params = new URLSearchParams()
  if (state.scope !== 'uma') params.set('scope', state.scope)
  if (state.umaId) params.set('uma', state.umaId)
  if (state.query.trim()) params.set('q', state.query.trim())
  for (const filter of state.filters) params.append('filter', `${filter.kind}=${filter.value}`)
  if (state.sort !== 'recent') params.set('sort', state.sort)
  if (state.detail) params.set('detail', state.detail)
  if (state.timelineKind) params.set('timeline', state.timelineKind)
  const value = params.toString()
  return value ? `?${value}` : ''
}
