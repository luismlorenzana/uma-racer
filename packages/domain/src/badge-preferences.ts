// Badge preference rules for T017 (docs/tasks/T017-badge-page-showcases-and-timeline.md).

import {
  BADGE_TIERS,
  BADGE_FILTER_CATEGORIES,
  isTrainerSavedBadgeView,
  parseBadgeState,
  type BadgePreferences,
  type BadgeSort,
  type BadgeStateV1,
  type CountFact,
  type SavedBadgeView,
  type ShowcaseGroup,
  type TrainerBadgeStateV1,
  type UmaBadgeStateV1,
} from './badges'
import { flairDynamicKey } from './flair'
import { RACE_GRADES, DISTANCE_CATEGORIES, STRATEGIES, SURFACES } from './types'
import { SCENARIOS } from './scenarios'

export const BADGE_FILTER_KINDS = [
  'category', 'type', 'surface', 'distance', 'strategy', 'aptitude', 'venue', 'grade', 'scenario', 'status',
  'pinned', 'earned-after', 'uma', 'rarity',
] as const
export type BadgeFilterKind = (typeof BADGE_FILTER_KINDS)[number]

export interface BadgeFilter {
  kind: BadgeFilterKind
  value: string | number
}

export type StableBadgeRarity = 'common' | 'uncommon' | 'rare' | 'elite'
export type TrainerBadgePreferences = TrainerBadgeStateV1['preferences']

export function trainerUmaAwardRef(umaId: string, awardKey: string): string {
  const ref = `uma-ref:${umaId.length}:${umaId}:${awardKey}`
  if (!/^[A-Za-z0-9_.:-]{1,120}$/.test(ref)) throw new Error('Trainer Uma award reference is too long or unsafe')
  return ref
}

export function parseTrainerUmaAwardRef(ref: string): { umaId: string; awardKey: string } | null {
  const match = /^uma-ref:(\d+):/.exec(ref)
  if (!match) return null
  const length = Number(match[1])
  const start = match[0].length
  if (!Number.isSafeInteger(length) || length < 1 || ref[start + length] !== ':') return null
  const umaId = ref.slice(start, start + length)
  const awardKey = ref.slice(start + length + 1)
  return /^[A-Za-z0-9_.:-]{1,120}$/.test(umaId) && /^[A-Za-z0-9_.:-]{1,120}$/.test(awardKey) ? { umaId, awardKey } : null
}

/** Local-roster rarity is structural: universal, majority/half, minority, or unique/unheld. */
export function stableBadgeRarity(holderCount: number, ownedUmaCount: number): StableBadgeRarity {
  if (!Number.isSafeInteger(holderCount) || !Number.isSafeInteger(ownedUmaCount) || holderCount < 0 || ownedUmaCount < 1 || holderCount > ownedUmaCount) {
    throw new Error('Stable badge rarity counts are invalid')
  }
  if (holderCount <= 1) return 'elite'
  if (holderCount * 2 < ownedUmaCount) return 'rare'
  if (holderCount < ownedUmaCount) return 'uncommon'
  return 'common'
}

const SAFE_FILTER_VALUE = /^[A-Za-z0-9_.-]{1,100}$/
const FILTER_ENUMS: Partial<Record<BadgeFilterKind, readonly string[]>> = {
  category: BADGE_FILTER_CATEGORIES,
  type: [...BADGE_TIERS, 'one-off', 'title', 'trophy', 'goal-ribbon', 'honors'],
  surface: SURFACES,
  distance: DISTANCE_CATEGORIES,
  strategy: STRATEGIES,
  aptitude: ['challenge', 'impossible', 'unorthodox'],
  grade: RACE_GRADES,
  status: ['earned', 'locked', 'progress', 'complete', 'untracked'],
  pinned: ['yes', 'no'],
  rarity: ['common', 'uncommon', 'rare', 'elite'],
}

function validFilter(filter: BadgeFilter): boolean {
  if (!BADGE_FILTER_KINDS.includes(filter.kind)) return false
  if (filter.kind === 'earned-after') return Number.isSafeInteger(filter.value) && (filter.value as number) >= 0
  if (typeof filter.value !== 'string') return false
  if (filter.kind === 'scenario') {
    const tier = Number(filter.value)
    return Number.isSafeInteger(tier) && tier >= 1 && tier <= SCENARIOS.length && String(tier) === filter.value
  }
  if (filter.kind === 'venue' || filter.kind === 'uma') return SAFE_FILTER_VALUE.test(filter.value)
  return FILTER_ENUMS[filter.kind]?.includes(filter.value) ?? false
}

export function encodeBadgeFilters(filters: readonly BadgeFilter[]): CountFact[] {
  const seen = new Set<BadgeFilterKind>()
  const rows = filters.map((filter) => {
    if (!validFilter(filter) || seen.has(filter.kind)) throw new Error(`Invalid or duplicate badge filter: ${filter.kind}`)
    seen.add(filter.kind)
    return filter.kind === 'earned-after'
      ? { key: filter.kind, count: filter.value as number }
      : { key: `${filter.kind}:${filter.value}`, count: 1 }
  })
  return rows.sort((left, right) => left.key.localeCompare(right.key))
}

export function decodeBadgeFilters(rows: readonly CountFact[]): BadgeFilter[] | null {
  const result: BadgeFilter[] = []
  for (const row of rows) {
    if (row.key === 'earned-after') {
      result.push({ kind: 'earned-after', value: row.count })
      continue
    }
    if (row.count !== 1) return null
    const separator = row.key.indexOf(':')
    if (separator <= 0) return null
    result.push({ kind: row.key.slice(0, separator) as BadgeFilterKind, value: row.key.slice(separator + 1) })
  }
  return result.every(validFilter) && new Set(result.map((filter) => filter.kind)).size === result.length ? result : null
}

export function isStrictSavedBadgeView(view: SavedBadgeView): boolean {
  return decodeBadgeFilters(view.filters) !== null
}

export function awardRefsForState(state: BadgeStateV1): string[] {
  if (state.scope === 'trainer') return [...new Set(state.awards.achievements.map((award) => award.awardKey))].sort()
  return [...new Set([
    ...state.awards.badges.map((award) => award.awardKey),
    ...state.awards.titles.map((award) => award.awardKey),
    ...state.awards.trophies.map((trophy) => flairDynamicKey('trophy', trophy.familyId)),
  ])].sort()
}

export const flattenShowcase = (groups: readonly ShowcaseGroup[]): string[] => groups.flatMap((group) => group.awardRefs)

function normalizePreferences(
  state: BadgeStateV1,
  desired: BadgePreferences,
  allowedAwardRefs: ReadonlySet<string>,
): BadgePreferences {
  const activeTitleId = state.scope === 'uma' && desired.activeTitleId !== null &&
    state.awards.titles.some((title) => title.awardKey === desired.activeTitleId)
    ? desired.activeTitleId
    : desired.activeTitleId === null ? null : (() => { throw new Error('Active title must be earned') })()
  if (desired.showcaseGroups.length < 1 || desired.showcaseGroups.length > 21 || desired.showcaseGroups[0]?.id !== 'default' || desired.showcaseGroups[0]?.name !== null) {
    throw new Error('Showcase must start with the default group')
  }
  const names = new Set<string>()
  const groupIds = new Set<string>()
  const refs = new Set<string>()
  const showcaseGroups = desired.showcaseGroups.map((group, index): ShowcaseGroup => {
    if (groupIds.has(group.id)) throw new Error('Showcase group ids must be unique')
    groupIds.add(group.id)
    const name = index === 0 ? null : group.name?.trim() ?? null
    if (index > 0 && (!name || name.length > 40)) throw new Error('Showcase group names must be 1–40 characters')
    if (name) {
      const normalized = name.toLocaleLowerCase()
      if (names.has(normalized)) throw new Error('Showcase group names must be unique')
      names.add(normalized)
    }
    const awardRefs = group.awardRefs.map((ref) => {
      if (!allowedAwardRefs.has(ref)) throw new Error(`Showcase reference is not earned: ${ref}`)
      if (refs.has(ref)) throw new Error(`Showcase reference is duplicated: ${ref}`)
      refs.add(ref)
      return ref
    })
    return { id: group.id, name, awardRefs }
  })
  if (state.scope === 'trainer') {
    const trainerViews = desired.savedViews.filter(isTrainerSavedBadgeView)
    if (trainerViews.length > 20 || desired.savedViews.length - trainerViews.length > 20) throw new Error('Saved view limit reached')
  } else if (desired.savedViews.length > 20) throw new Error('Saved view limit reached')
  const viewNames = new Set<string>()
  const viewIds = new Set<string>()
  const savedViews = desired.savedViews.map((view): SavedBadgeView => {
    const name = view.name.trim()
    const normalized = name.toLocaleLowerCase()
    const viewScope = state.scope === 'trainer' && isTrainerSavedBadgeView(view) ? 'trainer' : 'stable'
    const scopedName = `${viewScope}:${normalized}`
    if (!name || name.length > 40 || viewNames.has(scopedName) || viewIds.has(view.id) || !isStrictSavedBadgeView(view)) {
      throw new Error('Saved views must have unique names, ids, and valid filters')
    }
    viewNames.add(scopedName)
    viewIds.add(view.id)
    return { ...view, name, filters: [...view.filters] }
  })
  return { activeTitleId, showcaseGroups, savedViews }
}

export function replaceBadgePreferences<T extends BadgeStateV1>(
  state: T,
  desired: BadgePreferences,
  allowedAwardRefs: ReadonlySet<string> = new Set(awardRefsForState(state)),
): T {
  const candidate = { ...state, preferences: state.scope === 'trainer'
    ? { ...state.preferences, ...normalizePreferences(state, desired, allowedAwardRefs) }
    : normalizePreferences(state, desired, allowedAwardRefs) }
  const parsed = parseBadgeState(candidate)
  if (!parsed || parsed.scope !== state.scope || (parsed.scope === 'uma' && state.scope === 'uma' && parsed.umaId !== state.umaId)) {
    throw new Error('Badge preferences produced invalid state')
  }
  return parsed as T
}

export function rebaseBadgePreferences(server: BadgeStateV1, local: BadgeStateV1): BadgeStateV1 {
  if (server.scope !== local.scope || (server.scope === 'uma' && local.scope === 'uma' && server.umaId !== local.umaId)) return server
  const allowed = new Set([
    ...awardRefsForState(server),
    ...(server.scope === 'trainer' ? flattenShowcase(local.preferences.showcaseGroups).filter((ref) => parseTrainerUmaAwardRef(ref) !== null) : []),
  ])
  const showcaseGroups = local.preferences.showcaseGroups.map((group) => ({
    ...group,
    awardRefs: group.awardRefs.filter((ref) => allowed.has(ref)),
  }))
  const activeTitleId = server.scope === 'uma' && local.preferences.activeTitleId !== null &&
    server.awards.titles.some((title) => title.awardKey === local.preferences.activeTitleId)
    ? local.preferences.activeTitleId
    : server.preferences.activeTitleId
  const desired: BadgePreferences = {
    activeTitleId,
    showcaseGroups,
    savedViews: local.preferences.savedViews,
  }
  if (server.scope === 'trainer' && local.scope === 'trainer') {
    return replaceTrainerPreferences(server, { ...local.preferences, ...desired }, allowed)
  }
  return replaceBadgePreferences(server, desired, allowed)
}

export function moveItem<T>(items: readonly T[], from: number, to: number): T[] {
  if (!Number.isSafeInteger(from) || !Number.isSafeInteger(to) || from < 0 || from >= items.length || to < 0 || to >= items.length) {
    throw new Error('Reorder position is invalid')
  }
  if (from === to) return [...items]
  const next = [...items]
  const [item] = next.splice(from, 1)
  next.splice(to, 0, item!)
  return next
}

export function moveShowcaseRefs(
  groups: readonly ShowcaseGroup[],
  refs: readonly string[],
  destinationGroupId: string,
): ShowcaseGroup[] {
  const moving = new Set(refs)
  const destination = groups.find((group) => group.id === destinationGroupId)
  if (!destination) throw new Error('Showcase destination group is missing')
  const ordered = groups.flatMap((group) => group.awardRefs).filter((ref) => moving.has(ref))
  const unknown = refs.filter((ref) => !ordered.includes(ref))
  const additions = [...ordered, ...unknown]
  return groups.map((group) => ({
    ...group,
    awardRefs: group.id === destinationGroupId
      ? [...group.awardRefs.filter((ref) => !moving.has(ref)), ...additions]
      : group.awardRefs.filter((ref) => !moving.has(ref)),
  }))
}

export function removeShowcaseGroup(
  groups: readonly ShowcaseGroup[],
  groupId: string,
  behavior: 'move-to-default' | 'unpin',
): ShowcaseGroup[] {
  if (groupId === 'default') throw new Error('The default showcase group cannot be removed')
  const removed = groups.find((group) => group.id === groupId)
  if (!removed) throw new Error('Showcase group is missing')
  return groups.filter((group) => group.id !== groupId).map((group) => group.id === 'default' && behavior === 'move-to-default'
    ? { ...group, awardRefs: [...group.awardRefs, ...removed.awardRefs] }
    : { ...group })
}

export function replaceUmaPreferences(
  state: UmaBadgeStateV1,
  preferences: BadgePreferences,
  allowedAwardRefs?: ReadonlySet<string>,
): UmaBadgeStateV1 {
  return replaceBadgePreferences(state, preferences, allowedAwardRefs)
}

export function replaceTrainerPreferences(
  state: TrainerBadgeStateV1,
  preferences: BadgePreferences | TrainerBadgePreferences,
  allowedAwardRefs: ReadonlySet<string> = new Set(awardRefsForState(state)),
  ownedUmaIds?: ReadonlySet<string>,
): TrainerBadgeStateV1 {
  const trainerPreferences: TrainerBadgePreferences = 'displayName' in preferences
    ? preferences
    : { ...preferences, displayName: state.preferences.displayName, pinnedUmaIds: state.preferences.pinnedUmaIds }
  const base = replaceBadgePreferences(state, trainerPreferences, allowedAwardRefs)
  const displayName = trainerPreferences.displayName.normalize('NFC').trim()
  if (!displayName || [...displayName].length > 32) throw new Error('Trainer display name must be 1–32 characters')
  const allowedUmaIds = ownedUmaIds ?? new Set(trainerPreferences.pinnedUmaIds)
  if (new Set(trainerPreferences.pinnedUmaIds).size !== trainerPreferences.pinnedUmaIds.length || trainerPreferences.pinnedUmaIds.some((id) => !allowedUmaIds.has(id))) {
    throw new Error('Pinned Umas must be distinct and owned')
  }
  const candidate: TrainerBadgeStateV1 = {
    ...base,
    preferences: { ...base.preferences, displayName, pinnedUmaIds: [...trainerPreferences.pinnedUmaIds] },
  }
  const parsed = parseBadgeState(candidate)
  if (!parsed || parsed.scope !== 'trainer') throw new Error('Trainer preferences produced invalid state')
  return parsed
}

export function badgeSortIsValid(sort: string): sort is BadgeSort {
  return ['recent', 'tier', 'closest', 'rarest', 'alphabetical', 'category'].includes(sort as BadgeSort)
}
