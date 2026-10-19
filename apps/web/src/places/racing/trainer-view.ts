// Pure Trainer achievement/profile projections (docs/design/badges.md#trainer-achievements).

import {
  BADGE_TIERS,
  badgeStateId,
  buildTrainerAchievementCatalog,
  flattenShowcase,
  parseTrainerUmaAwardRef,
  projectTrainerAchievementProgress,
  trainerContentCounts,
  trainerRecordLabel,
  trainerStatName,
  type BadgeTier,
  type FlairEventV1,
  type TrainerBadgeStateV1,
  type TrainerRecord,
  type UmaBadgeStateV1,
  type UmaSave,
} from '@racer/domain'
import type { LoadedContent } from '../../content/view'
import { buildUmaBadgeCollection, type BadgeCollectionItem, type BadgeSourceView } from './badge-collection-view'
import { resultPath, type LinkedRaceRecord } from './today'

export interface TrainerBadgeCollection {
  scope: 'trainer'
  displayName: string
  earnedCount: number
  visibleCount: number
  pinnedRefs: string[]
  items: BadgeCollectionItem[]
  records: TrainerRecordView[]
  counts: ReturnType<typeof trainerContentCounts>
}

export interface TrainerRecordView {
  kind: TrainerRecord['kind']
  label: string
  valueLabel: string
  umaId: string
  umaName: string
  source: BadgeSourceView | null
}

export interface TrainerPinnedUmaView {
  umaId: string
  name: string
  level: number
  missingContent: boolean
}

export interface TrainerShowcaseView {
  ref: string
  label: string
  ownerLabel: string
  tier: BadgeTier | 'one-off' | null
  missing: boolean
}

export interface StableRecentFlairView {
  id: string
  label: string
  ownerLabel: string
  stage: FlairEventV1['stage']
  earnedAt: number
  to: string
  trainer: boolean
}

const stageIndex = (stage: BadgeTier | 'one-off' | null): number => stage === 'one-off' ? BADGE_TIERS.length : stage ? BADGE_TIERS.indexOf(stage) : -1

function groupIdFor(state: TrainerBadgeStateV1, awardKey: string): string | null {
  return state.preferences.showcaseGroups.find((group) => group.awardRefs.includes(awardKey))?.id ?? null
}

function recordView(
  record: TrainerRecord,
  content: LoadedContent,
  saves: Readonly<Record<string, UmaSave>>,
  raceHistory: readonly LinkedRaceRecord[],
): TrainerRecordView {
  const template = content.umas.byId.get(record.umaId)
  const sourceRace = record.sourceId ? raceHistory.find((row) => `race:${row.umaId}:${row.sequence}` === record.sourceId) : null
  const source = sourceRace ? {
    label: 'View race result',
    to: resultPath(sourceRace.resultId),
    safeId: record.sourceId,
  } : record.sourceId ? { label: 'Source unavailable', to: null, safeId: record.sourceId } : null
  const valueLabel = record.kind === 'biggest-winning-margin'
    ? `${record.value.toFixed(2)} lengths`
    : record.kind === 'highest-stat'
      ? `${Math.round(record.value).toLocaleString()} ${trainerStatName(record.stat) ?? ''}`.trim()
      : Math.round(record.value).toLocaleString()
  return {
    kind: record.kind,
    label: trainerRecordLabel(record),
    valueLabel,
    umaId: record.umaId,
    umaName: template?.name ?? saves[record.umaId]?.templateId ?? record.umaId,
    source,
  }
}

export function buildTrainerBadgeCollection(
  content: LoadedContent,
  state: TrainerBadgeStateV1,
  saves: Readonly<Record<string, UmaSave>>,
  raceHistory: readonly LinkedRaceRecord[] = [],
): TrainerBadgeCollection {
  const catalog = buildTrainerAchievementCatalog({ umas: content.umas.items, cards: content.cards.items, races: content.races.items })
  const progress = projectTrainerAchievementProgress(catalog, state)
  const items: BadgeCollectionItem[] = progress.map((row) => {
    const groupId = groupIdFor(state, row.definition.awardKey)
    const stage = row.highestStage
    const thresholdLabel = row.complete
      ? `${row.value.toLocaleString()} · Complete`
      : `${row.value.toLocaleString()} / ${(row.nextThreshold ?? 0).toLocaleString()}`
    const thresholds = [...row.definition.thresholds]
    if (row.definition.allThresholdKey) thresholds.push(row.nextThreshold ?? row.frozenAllKeys.length)
    return {
      awardKey: row.definition.awardKey,
      label: row.definition.label,
      description: row.definition.description,
      criterionLabel: row.definition.description,
      category: row.definition.category,
      kind: row.definition.kind,
      tier: stage,
      tierIndex: stageIndex(stage),
      status: row.complete ? 'complete' : row.value > 0 ? 'progress' : 'locked',
      history: 'exact',
      historyLabel: row.frozenAllKeys.length > 0 ? `All frozen at ${row.frozenAllKeys.length} applicable entries` : 'Exact account history',
      progressLabel: thresholdLabel,
      progress: row.complete ? 1 : row.progress,
      value: row.value,
      nextThreshold: row.nextThreshold,
      thresholds,
      points: 0,
      tags: row.definition.tags,
      earnedAt: row.earnedAt,
      pinned: groupId !== null,
      groupId,
      source: { label: 'Open Trainer profile', to: '/trainer', safeId: null },
      searchText: `${row.definition.label} ${row.definition.description} ${row.definition.category} ${row.definition.tags.join(' ')}`.toLocaleLowerCase(),
      surface: null,
      distance: null,
      strategy: null,
      aptitude: null,
      venue: null,
      grade: null,
      scenario: null,
    }
  })
  return {
    scope: 'trainer',
    displayName: state.preferences.displayName,
    earnedCount: items.filter((item) => item.tier !== null).length,
    visibleCount: items.length,
    pinnedRefs: flattenShowcase(state.preferences.showcaseGroups),
    items,
    records: state.records.map((record) => recordView(record, content, saves, raceHistory)),
    counts: trainerContentCounts(state),
  }
}

export function buildTrainerPinnedUmas(
  content: LoadedContent,
  state: TrainerBadgeStateV1,
  saves: Readonly<Record<string, UmaSave>>,
): TrainerPinnedUmaView[] {
  return state.preferences.pinnedUmaIds.flatMap((umaId) => {
    const save = saves[umaId]
    if (!save) return []
    const template = content.umas.byId.get(umaId)
    return [{ umaId, name: template?.name ?? umaId, level: save.level, missingContent: !template }]
  })
}

export function buildTrainerShowcase(
  content: LoadedContent,
  trainer: TrainerBadgeStateV1,
  states: Readonly<Record<string, import('@racer/domain').BadgeStateV1>>,
  saves: Readonly<Record<string, UmaSave>>,
  events: readonly (FlairEventV1 & { id: string })[],
  races: readonly LinkedRaceRecord[] = [],
): TrainerShowcaseView[] {
  const collection = buildTrainerBadgeCollection(content, trainer, saves, races)
  const trainerItems = new Map(collection.items.map((item) => [item.awardKey, item]))
  return flattenShowcase(trainer.preferences.showcaseGroups).map((ref) => {
    const direct = trainerItems.get(ref)
    if (direct) return { ref, label: direct.label, ownerLabel: trainer.preferences.displayName, tier: direct.tier, missing: false }
    const parsed = parseTrainerUmaAwardRef(ref)
    const state = parsed ? states[badgeStateId(parsed.umaId)] : null
    if (parsed && state?.scope === 'uma') {
      const item = buildUmaBadgeCollection(content, state, events, races).items.find((candidate) => candidate.awardKey === parsed.awardKey)
      if (item) return { ref, label: item.label, ownerLabel: content.umas.byId.get(parsed.umaId)?.name ?? parsed.umaId, tier: item.tier, missing: false }
    }
    return { ref, label: ref, ownerLabel: parsed?.umaId ?? 'Unknown', tier: null, missing: true }
  })
}

export function buildStableRecentFlair(
  content: LoadedContent,
  states: Readonly<Record<string, import('@racer/domain').BadgeStateV1>>,
  saves: Readonly<Record<string, UmaSave>>,
  events: readonly (FlairEventV1 & { id: string })[],
  limit = 8,
): StableRecentFlairView[] {
  const trainer = states.trainer?.scope === 'trainer' ? states.trainer : null
  const trainerLabels = trainer ? new Map(buildTrainerAchievementCatalog({ umas: content.umas.items, cards: content.cards.items, races: content.races.items }).definitions.map((row) => [row.awardKey, row.label])) : new Map<string, string>()
  const umaLabels = new Map<string, string>()
  for (const state of Object.values(states)) {
    if (state.scope !== 'uma') continue
    for (const item of buildUmaBadgeCollection(content, state, events).items) umaLabels.set(`${state.umaId}:${item.awardKey}`, item.label)
  }
  return [...events].sort((left, right) => right.earnedAt - left.earnedAt || right.id.localeCompare(left.id)).slice(0, limit).map((event) => {
    const isTrainer = event.scope === 'trainer'
    const owner = event.umaId ? content.umas.byId.get(event.umaId)?.name ?? saves[event.umaId]?.templateId ?? event.umaId : trainer?.preferences.displayName ?? 'Trainer'
    return {
      id: event.id,
      label: isTrainer ? trainerLabels.get(event.awardKey) ?? event.awardKey : umaLabels.get(`${event.umaId}:${event.awardKey}`) ?? event.awardKey,
      ownerLabel: owner,
      stage: event.stage,
      earnedAt: event.earnedAt,
      to: isTrainer ? `/badges?scope=trainer&detail=${encodeURIComponent(event.awardKey)}` : `/badges?scope=uma&uma=${encodeURIComponent(event.umaId ?? '')}&detail=${encodeURIComponent(event.awardKey)}`,
      trainer: isTrainer,
    }
  })
}
