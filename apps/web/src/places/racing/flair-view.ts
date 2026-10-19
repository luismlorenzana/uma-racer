// Pure compact flair projections for T016 action feedback and profile surfaces.

import {
  BADGE_TIER_POINTS,
  BADGE_TIERS,
  buildUmaFlairCatalog,
  buildTrainerAchievementCatalog,
  orderFlairEventsForFanfare,
  prestigeForState,
  type FlairEventRecord,
  type FlairEventV1,
  type UmaBadgeStateV1,
  type TrainerBadgeStateV1,
} from '@racer/domain'
import type { LoadedContent } from '../../content/view'
import { badgeFrameStyle, type BadgeFrameStyle } from './badge-frame'

export interface FlairEventView {
  id: string
  awardKey: string
  label: string
  description: string
  kind: FlairEventV1['kind']
  kindLabel: string
  stage: FlairEventV1['stage']
  stageLabel: string
  earnedAt: number
  prestigeDelta: number
  retroactive: boolean
}

export interface UmaFlairSummary {
  prestige: number
  frame: BadgeFrameStyle
  activeTitle: string | null
  badgeCount: number
  titleCount: number
  trophyCount: number
  recent: FlairEventView[]
}

const kindLabels: Record<FlairEventV1['kind'], string> = {
  'badge-tier': 'Badge',
  'one-off': 'Feat',
  'goal-ribbon': 'Goal Ribbon',
  honors: 'Honors',
  title: 'Title',
  'trophy-earned': 'G1 Trophy',
  'trainer-achievement': 'Achievement',
}

const titleCase = (value: string): string => value
  .split(/[-:]/)
  .filter(Boolean)
  .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
  .join(' ')

function fallbackLabel(event: FlairEventV1): string {
  if (event.kind === 'trophy-earned') return 'G1 Trophy · Missing race content'
  if (event.kind === 'goal-ribbon') return 'Goal Ribbon · Missing goal content'
  if (event.kind === 'title') return titleCase(event.awardKey.replace(/^title:/, '')) || 'Earned title'
  if (event.kind === 'honors') return `Scenario ${event.source.tier ?? '?'} Honors`
  return titleCase(event.awardKey.replace(/^badge:/, '')) || 'Earned badge'
}

const stageLabel = (stage: FlairEventV1['stage']): string =>
  stage === 'one-off' ? 'Earned' : stage.charAt(0).toUpperCase() + stage.slice(1)

function eventRows(events: readonly (FlairEventV1 & { id: string })[]): FlairEventRecord[] {
  return events.map(({ id, ...data }) => ({ id, data }))
}

function viewRows(
  content: LoadedContent,
  state: UmaBadgeStateV1,
  rows: readonly FlairEventRecord[],
  deltaRows: readonly FlairEventRecord[] = rows,
): FlairEventView[] {
  const catalog = buildUmaFlairCatalog({ state, races: content.races.items })
  const definitions = new Map(catalog.definitions.map((definition) => [definition.awardKey, definition]))
  const firstNewTier = new Map<string, number>()
  for (const row of deltaRows) {
    if (row.data.kind !== 'badge-tier') continue
    const index = BADGE_TIERS.indexOf(row.data.stage as (typeof BADGE_TIERS)[number])
    firstNewTier.set(row.data.awardKey, Math.min(firstNewTier.get(row.data.awardKey) ?? index, index))
  }
  return rows.map((row) => {
    const definition = definitions.get(row.data.awardKey)
    let prestigeDelta = definition?.points ?? 0
    if (row.data.kind === 'badge-tier') {
      const highest = BADGE_TIERS.indexOf(row.data.stage as (typeof BADGE_TIERS)[number])
      const first = firstNewTier.get(row.data.awardKey) ?? highest
      prestigeDelta = BADGE_TIER_POINTS[highest]! - (first > 0 ? BADGE_TIER_POINTS[first - 1]! : 0)
    }
    return {
      id: row.id,
      awardKey: row.data.awardKey,
      label: definition?.label ?? fallbackLabel(row.data),
      description: definition?.description ?? 'Stored flair is preserved while its private content is unavailable.',
      kind: row.data.kind,
      kindLabel: kindLabels[row.data.kind],
      stage: row.data.stage,
      stageLabel: stageLabel(row.data.stage),
      earnedAt: row.data.earnedAt,
      prestigeDelta,
      retroactive: row.data.retroactive,
    }
  })
}

export function buildFlairFanfare(
  content: LoadedContent,
  state: UmaBadgeStateV1,
  events: readonly (FlairEventV1 & { id: string })[],
  eventIds: readonly string[],
): FlairEventView[] {
  const ids = new Set(eventIds)
  const selected = eventRows(events).filter((event) => ids.has(event.id))
  return viewRows(content, state, orderFlairEventsForFanfare(selected), selected)
}

export function buildTrainerFlairFanfare(
  content: LoadedContent,
  state: TrainerBadgeStateV1,
  events: readonly (FlairEventV1 & { id: string })[],
  eventIds: readonly string[],
): FlairEventView[] {
  const ids = new Set(eventIds)
  const definitions = new Map(buildTrainerAchievementCatalog({
    umas: content.umas.items,
    cards: content.cards.items,
    races: content.races.items,
  }).definitions.map((definition) => [definition.awardKey, definition]))
  return orderFlairEventsForFanfare(eventRows(events).filter((event) =>
    ids.has(event.id) && event.data.scope === 'trainer')).map((event) => {
    const definition = definitions.get(event.data.awardKey)
    return {
      id: event.id,
      awardKey: event.data.awardKey,
      label: definition?.label ?? titleCase(event.data.awardKey.replace(/^trainer:/, '')),
      description: definition?.description ?? 'Stored Trainer achievement',
      kind: event.data.kind,
      kindLabel: kindLabels[event.data.kind],
      stage: event.data.stage,
      stageLabel: stageLabel(event.data.stage),
      earnedAt: event.data.earnedAt,
      prestigeDelta: 0,
      retroactive: event.data.retroactive,
    }
  })
}

export function buildUmaFlairSummary(
  content: LoadedContent,
  state: UmaBadgeStateV1,
  events: readonly (FlairEventV1 & { id: string })[],
): UmaFlairSummary {
  const own = orderFlairEventsForFanfare(eventRows(events)
    .filter((event) => event.data.scope === 'uma' && event.data.umaId === state.umaId))
    .sort((left, right) => right.data.earnedAt - left.data.earnedAt || right.id.localeCompare(left.id))
  const catalog = buildUmaFlairCatalog({ state, races: content.races.items })
  const prestige = prestigeForState(catalog, state)
  const activeTitle = state.preferences.activeTitleId === null
    ? null
    : catalog.definitions.find((definition) => definition.awardKey === state.preferences.activeTitleId)?.label ??
      titleCase(state.preferences.activeTitleId.replace(/^title:/, ''))
  return {
    prestige,
    frame: badgeFrameStyle(prestige),
    activeTitle,
    badgeCount: new Set(state.awards.badges.map((entry) => entry.awardKey)).size,
    titleCount: state.awards.titles.length,
    trophyCount: state.awards.trophies.length,
    recent: viewRows(content, state, own.slice(0, 3), own.slice(0, 3)),
  }
}
