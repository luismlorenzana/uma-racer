// Trainer achievement catalog and deterministic reconciliation (docs/design/collection.md#trainer-achievements-account-wide).

import { CARD_MAX_LEVEL, MAX_LIMIT_BREAK } from './cards'
import type { RaceTemplate, SupportCardTemplate, UmaTemplate } from './content'
import {
  BADGE_TIERS,
  FLAIR_EVENT_VERSION,
  FLAIR_SERIES_REQUIRED_FAMILIES,
  FLAIR_SERIES_TAGS,
  countFact,
  parseBadgeState,
  parseFlairEvent,
  type BadgeTier,
  type CountFact,
  type EarnedBadgeStage,
  type FlairEventV1,
  type TrainerBadgeStateV1,
  type TrainerRecord,
  type UmaBadgeStateV1,
} from './badges'
import { flairDynamicKey, flairEventId, type FlairEventRecord } from './flair'
import type { RaceResultRecord } from './progression-race'
import type { CardSave, LedgerEntry, UmaSave } from './save'
import { LEVELS_PER_SCENARIO, SCENARIOS } from './scenarios'
import { STATS, type StatKey } from './types'

export const TRAINER_ACHIEVEMENT_CATALOG_VERSION = 1 as const
export const TRAINER_ACHIEVEMENT_EVALUATOR_VERSION = 1 as const

export const TRAINER_ACHIEVEMENT_THRESHOLDS = {
  stableMaster: [30, 40, 60, 90] as const,
  cardCollector: [10, 25, 50, 100] as const,
  maxedOut: [1, 5, 15, 40, 100] as const,
  couponClipper: [1, 5, 15, 40, 100] as const,
  stableWins: [10, 100, 500, 1_500, 5_000] as const,
  stableG1s: [1, 10, 50, 150, 500] as const,
  statBadges: [5, 25, 75, 200, 500] as const,
  badgeHoarder: [25, 150, 500, 1_500, 5_000] as const,
  titleHolders: [1, 5, 10, 20] as const,
  graduations: [5, 25, 75, 200, 500] as const,
  veteranStable: [1, 3, 10, 25, 50] as const,
  legendaryStable: [1, 3, 5, 10, 25] as const,
  heirs: [5, 25, 100, 250, 1_000] as const,
  stableGoals: [5, 25, 100, 300, 1_000] as const,
  honorsCollector: [1, 10, 30, 100, 300] as const,
  familyTree: [2, 5, 10, 25, 50] as const,
} as const

export type TrainerAchievementCategory = 'collection' | 'stable' | 'journey'

export interface TrainerAchievementDefinition {
  awardKey: string
  label: string
  description: string
  category: TrainerAchievementCategory
  tags: string[]
  kind: 'tiered' | 'one-off'
  aggregateKey: string
  thresholds: number[]
  allThresholdKey: string | null
  frozenKeys: string[]
}

export interface TrainerAchievementCatalogV1 {
  version: typeof TRAINER_ACHIEVEMENT_CATALOG_VERSION
  definitions: TrainerAchievementDefinition[]
  titleDenominatorKeys: string[]
}

export interface TrainerLedgerRow {
  id: string
  data: LedgerEntry
}

export interface TrainerReconcileInput {
  state: TrainerBadgeStateV1
  contentVersion: string
  umas: readonly UmaTemplate[]
  cards: readonly SupportCardTemplate[]
  races: readonly RaceTemplate[]
  ownedUmas: readonly UmaSave[]
  ownedCards: readonly CardSave[]
  contributors: readonly UmaBadgeStateV1[]
  ledger: readonly TrainerLedgerRow[]
  raceResults: readonly RaceResultRecord[]
  now: number
  retroactive: boolean
  sourceId?: string
}

export interface TrainerReconcileResult {
  state: TrainerBadgeStateV1
  events: FlairEventRecord[]
  changed: boolean
}

export interface TrainerAchievementProgress {
  definition: TrainerAchievementDefinition
  value: number
  highestStage: BadgeTier | 'one-off' | null
  nextThreshold: number | null
  progress: number
  complete: boolean
  earnedAt: number | null
  frozenAllKeys: string[]
}

const MAX_UMA_LEVEL = SCENARIOS.length * LEVELS_PER_SCENARIO
const NORMAL_STAGES = BADGE_TIERS.slice(0, 4)

function sortedUnique(values: readonly string[]): string[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right))
}

function safeDynamicKey(prefix: string, value: string): string {
  return flairDynamicKey(prefix, value)
}

function hashText(value: string): number {
  let hash = 0x811c9dc5
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }
  return hash >>> 0
}

function countRows(values: ReadonlyMap<string, number>): CountFact[] {
  return [...values].map(([key, count]) => ({ key, count })).sort((left, right) => left.key.localeCompare(right.key))
}

function setCount(target: Map<string, number>, key: string, count: number): void {
  if (!Number.isSafeInteger(count) || count < 0) throw new Error(`Trainer aggregate is invalid: ${key}`)
  target.set(key, count)
}

function isCouponRedemption(row: TrainerLedgerRow): boolean {
  if (row.data.reason === 'card-coupon-redeem') {
    return row.data.resource === 'card-coupons' && row.data.delta === -1 && /^card-coupon-redeem:[A-Za-z0-9_.:-]+$/.test(row.id)
  }
  if (row.data.reason === 'uma-coupon-redeem') {
    return row.data.resource === 'uma-coupons' && row.data.delta === -1 && /^uma-coupon-redeem:[A-Za-z0-9_.:-]+$/.test(row.id)
  }
  return false
}

function titleDenominator(races: readonly RaceTemplate[]): string[] {
  const families = new Map<string, { g1: boolean; tags: Set<string> }>()
  for (const race of [...races].sort((left, right) => left.id.localeCompare(right.id))) {
    const current = families.get(race.familyId) ?? { g1: false, tags: new Set<string>() }
    current.g1 ||= race.grade === 'g1'
    race.series.forEach((tag) => current.tags.add(tag))
    families.set(race.familyId, current)
  }
  const keys: string[] = []
  for (const tag of FLAIR_SERIES_TAGS) {
    const tagged = [...families].filter(([, family]) => family.tags.has(tag)).map(([id]) => id)
    if (tagged.length === FLAIR_SERIES_REQUIRED_FAMILIES[tag]) keys.push(`title:${tag}`)
  }
  for (const [familyId, family] of [...families].sort(([left], [right]) => left.localeCompare(right))) {
    if (!family.g1) continue
    keys.push(safeDynamicKey('title:two-time', familyId), safeDynamicKey('title:three-time', familyId))
  }
  return sortedUnique(keys)
}

function fixedDefinition(
  awardKey: string,
  label: string,
  description: string,
  category: TrainerAchievementCategory,
  aggregateKey: string,
  thresholds: readonly number[],
  allThresholdKey: string | null = null,
  frozenKeys: readonly string[] = [],
): TrainerAchievementDefinition {
  return {
    awardKey,
    label,
    description,
    category,
    aggregateKey,
    kind: 'tiered',
    thresholds: [...thresholds],
    allThresholdKey,
    frozenKeys: [...frozenKeys],
    tags: ['trainer', category],
  }
}

export function buildTrainerAchievementCatalog(input: {
  umas: readonly UmaTemplate[]
  cards: readonly SupportCardTemplate[]
  races: readonly RaceTemplate[]
}): TrainerAchievementCatalogV1 {
  const umaIds = sortedUnique(input.umas.map((uma) => uma.id))
  const cardIds = sortedUnique(input.cards.map((card) => card.id))
  const titleKeys = titleDenominator(input.races)
  const definitions: TrainerAchievementDefinition[] = [
    fixedDefinition('trainer:stable-master', 'Stable Master', 'Own Umas across the current private catalog.', 'collection', 'owned-umas', TRAINER_ACHIEVEMENT_THRESHOLDS.stableMaster, 'catalog-umas', umaIds),
    fixedDefinition('trainer:card-collector', 'Card Collector', 'Own SSR support cards across the current private catalog.', 'collection', 'owned-cards', TRAINER_ACHIEVEMENT_THRESHOLDS.cardCollector, 'catalog-cards', cardIds),
    fixedDefinition('trainer:maxed-out', 'Maxed Out', 'Raise support cards to LB4 and level 25.', 'collection', 'maxed-cards', TRAINER_ACHIEVEMENT_THRESHOLDS.maxedOut),
    fixedDefinition('trainer:coupon-clipper', 'Coupon Clipper', 'Redeem Card and Uma Select Coupons.', 'collection', 'coupon-redemptions', TRAINER_ACHIEVEMENT_THRESHOLDS.couponClipper),
    fixedDefinition('trainer:stable-wins', 'Stable Wins', 'Win races across the Stable.', 'stable', 'stable-wins', TRAINER_ACHIEVEMENT_THRESHOLDS.stableWins),
    fixedDefinition('trainer:stable-g1s', 'Stable G1s', 'Win G1 races across the Stable.', 'stable', 'stable-g1s', TRAINER_ACHIEVEMENT_THRESHOLDS.stableG1s),
    fixedDefinition('trainer:stat-badges', 'Stat Badges', 'Earn stat and Balanced badge stages across the Stable.', 'stable', 'stat-badge-stages', TRAINER_ACHIEVEMENT_THRESHOLDS.statBadges),
    fixedDefinition('trainer:badge-hoarder', 'Badge Hoarder', 'Earn badge stages, one-offs, Ribbons, and Honors across the Stable.', 'stable', 'badge-stages', TRAINER_ACHIEVEMENT_THRESHOLDS.badgeHoarder),
    fixedDefinition('trainer:title-holders', 'Title Holders', 'Hold distinct title definitions across the Stable.', 'stable', 'distinct-titles', TRAINER_ACHIEVEMENT_THRESHOLDS.titleHolders, 'catalog-titles', titleKeys),
    fixedDefinition('trainer:graduations', 'Graduations', 'Complete scenarios across the Stable.', 'journey', 'graduations', TRAINER_ACHIEVEMENT_THRESHOLDS.graduations),
    fixedDefinition('trainer:veteran-stable', 'Veteran Stable', 'Raise Umas to level 50 or higher.', 'stable', 'veteran-umas', TRAINER_ACHIEVEMENT_THRESHOLDS.veteranStable),
    fixedDefinition('trainer:legendary-stable', 'Legendary Stable', 'Raise Umas to the current maximum level.', 'stable', 'legendary-umas', TRAINER_ACHIEVEMENT_THRESHOLDS.legendaryStable),
    fixedDefinition('trainer:heirs', 'Heirs', 'Start scenarios with at least one direct parent.', 'journey', 'parented-starts', TRAINER_ACHIEVEMENT_THRESHOLDS.heirs),
    fixedDefinition('trainer:stable-goals', 'Stable Goals', 'Complete tracked Journey goals across the Stable.', 'journey', 'stable-goals', TRAINER_ACHIEVEMENT_THRESHOLDS.stableGoals),
    fixedDefinition('trainer:honors-collector', 'Honors Collector', 'Earn Journey Honors across the Stable.', 'journey', 'honors', TRAINER_ACHIEVEMENT_THRESHOLDS.honorsCollector),
    fixedDefinition('trainer:family-tree', 'Family Tree', 'Have distinct Umas serve as a direct parent.', 'journey', 'parent-holders', TRAINER_ACHIEVEMENT_THRESHOLDS.familyTree),
  ]

  const eras = [...new Set(input.cards.map((card) => card.era))].sort((left, right) => left - right)
  for (const era of eras) {
    const ids = sortedUnique(input.cards.filter((card) => card.era === era).map((card) => card.id))
    definitions.push({
      awardKey: `trainer:era-complete:${era}`,
      label: `Era ${era} Complete`,
      description: `Own every support card in era ${era}.`,
      category: 'collection',
      tags: ['trainer', 'collection', `era:${era}`],
      kind: 'one-off',
      aggregateKey: `owned-era:${era}`,
      thresholds: [],
      allThresholdKey: `catalog-era:${era}`,
      frozenKeys: ids,
    })
  }
  const types = sortedUnique(input.cards.map((card) => card.type))
  for (const type of types) {
    const ids = sortedUnique(input.cards.filter((card) => card.type === type).map((card) => card.id))
    definitions.push({
      awardKey: safeDynamicKey('trainer:type-complete', type),
      label: `${type.charAt(0).toLocaleUpperCase()}${type.slice(1)} Complete`,
      description: `Own every ${type} support card.`,
      category: 'collection',
      tags: ['trainer', 'collection', `type:${type}`],
      kind: 'one-off',
      aggregateKey: safeDynamicKey('owned-type', type),
      thresholds: [],
      allThresholdKey: safeDynamicKey('catalog-type', type),
      frozenKeys: ids,
    })
  }
  definitions.sort((left, right) => left.awardKey.localeCompare(right.awardKey))
  return { version: TRAINER_ACHIEVEMENT_CATALOG_VERSION, definitions, titleDenominatorKeys: titleKeys }
}

function assertUniqueIds<T>(rows: readonly T[], id: (row: T) => string, label: string): void {
  const ids = rows.map(id)
  if (new Set(ids).size !== ids.length) throw new Error(`Duplicate Trainer ${label}`)
}

function aggregateFacts(input: TrainerReconcileInput, catalog: TrainerAchievementCatalogV1): CountFact[] {
  assertUniqueIds(input.ownedUmas, (row) => row.templateId, 'Uma contributor')
  assertUniqueIds(input.ownedCards, (row) => row.templateId, 'Card contributor')
  assertUniqueIds(input.contributors, (row) => row.umaId, 'badge contributor')
  assertUniqueIds(input.ledger, (row) => row.id, 'ledger contributor')
  const knownUmaIds = new Set(input.umas.map((row) => row.id))
  const knownCardIds = new Set(input.cards.map((row) => row.id))
  const umas = [...input.ownedUmas].filter((row) => knownUmaIds.has(row.templateId)).sort((left, right) => left.templateId.localeCompare(right.templateId))
  const cards = [...input.ownedCards].filter((row) => knownCardIds.has(row.templateId)).sort((left, right) => left.templateId.localeCompare(right.templateId))
  const contributorMap = new Map(input.contributors.map((row) => [row.umaId, row]))
  const contributors = umas.map((uma) => {
    const state = contributorMap.get(uma.templateId)
    if (!state) throw new Error(`Trainer contributor is missing: ${uma.templateId}`)
    return state
  })
  const facts = new Map<string, number>()
  setCount(facts, 'owned-umas', umas.length)
  setCount(facts, 'catalog-umas', input.umas.length)
  setCount(facts, 'owned-cards', cards.length)
  setCount(facts, 'catalog-cards', input.cards.length)
  setCount(facts, 'maxed-cards', cards.filter((card) => card.limitBreak === MAX_LIMIT_BREAK && card.level === CARD_MAX_LEVEL).length)
  setCount(facts, 'coupon-redemptions', input.ledger.filter(isCouponRedemption).length)
  setCount(facts, 'stable-wins', contributors.reduce((sum, state) => sum + state.facts.wins, 0))
  setCount(facts, 'stable-g1s', contributors.reduce((sum, state) => sum + countFact(state.facts.gradeWins, 'g1'), 0))
  setCount(facts, 'stat-badge-stages', contributors.reduce((sum, state) => sum + state.awards.badges.filter((award) => award.awardKey.startsWith('badge:stat:') || award.awardKey === 'badge:balanced').length, 0))
  setCount(facts, 'badge-stages', contributors.reduce((sum, state) => sum + state.awards.badges.length, 0))
  const titles = sortedUnique(contributors.flatMap((state) => state.awards.titles.map((title) => title.awardKey)))
  setCount(facts, 'distinct-titles', titles.length)
  setCount(facts, 'catalog-titles', catalog.titleDenominatorKeys.length)
  setCount(facts, 'graduations', contributors.reduce((sum, state) => sum + state.facts.completedScenarioTiers.length, 0))
  setCount(facts, 'veteran-umas', umas.filter((uma) => uma.level >= 50).length)
  setCount(facts, 'legendary-umas', umas.filter((uma) => uma.level >= MAX_UMA_LEVEL).length)
  setCount(facts, 'parented-starts', contributors.reduce((sum, state) => sum + state.facts.parentedScenarioStarts.length, 0))
  setCount(facts, 'stable-goals', contributors.reduce((sum, state) => sum + state.facts.goals.length, 0))
  setCount(facts, 'honors', contributors.reduce((sum, state) => sum + state.facts.honorsTiers.length, 0))
  setCount(facts, 'parent-holders', contributors.filter((state) => state.facts.legacyEvidence.length > 0).length)

  const ownedCardIds = new Set(cards.map((card) => card.templateId))
  for (const era of [...new Set(input.cards.map((card) => card.era))].sort((left, right) => left - right)) {
    const bucket = input.cards.filter((card) => card.era === era)
    setCount(facts, `catalog-era:${era}`, bucket.length)
    setCount(facts, `owned-era:${era}`, bucket.filter((card) => ownedCardIds.has(card.id)).length)
  }
  for (const type of sortedUnique(input.cards.map((card) => card.type))) {
    const bucket = input.cards.filter((card) => card.type === type)
    setCount(facts, safeDynamicKey('catalog-type', type), bucket.length)
    setCount(facts, safeDynamicKey('owned-type', type), bucket.filter((card) => ownedCardIds.has(card.id)).length)
  }
  for (const uma of umas) {
    const state = contributorMap.get(uma.templateId)!
    setCount(facts, safeDynamicKey('fingerprint-uma', uma.templateId), hashText(JSON.stringify({ uma, facts: state.facts, awards: state.awards })))
  }
  for (const card of cards) setCount(facts, safeDynamicKey('fingerprint-card', card.templateId), hashText(JSON.stringify(card)))
  setCount(facts, 'fingerprint-content', hashText(JSON.stringify({
    umas: input.umas.map((row) => row.id).sort(),
    cards: input.cards.map((row) => [row.id, row.era, row.type]).sort(([left], [right]) => String(left).localeCompare(String(right))),
    titles: catalog.titleDenominatorKeys,
  })))
  return countRows(facts)
}

function recordCandidateOrder(left: TrainerRecord, right: TrainerRecord): number {
  return right.value - left.value || left.achievedAt - right.achievedAt || left.umaId.localeCompare(right.umaId) ||
    (left.sourceId ?? '').localeCompare(right.sourceId ?? '') || (left.stat ?? '').localeCompare(right.stat ?? '')
}

function bestRecord(kind: TrainerRecord['kind'], candidates: TrainerRecord[]): TrainerRecord | null {
  const best = [...candidates].filter((row) => row.value > 0).sort(recordCandidateOrder)[0]
  return best ? { ...best, kind } : null
}

function raceSource(result: RaceResultRecord): Pick<TrainerRecord, 'sourceId' | 'achievedAt'> {
  return { sourceId: `race:${result.umaId}:${result.sequence}`, achievedAt: result.createdAt }
}

function orderedRaceResults(input: TrainerReconcileInput, umaId: string): RaceResultRecord[] {
  return input.raceResults.filter((result) => result.umaId === umaId)
    .sort((left, right) => left.createdAt - right.createdAt || left.sequence - right.sequence || left.raceId.localeCompare(right.raceId))
}

function deriveRecords(input: TrainerReconcileInput): TrainerRecord[] {
  const known = new Set(input.umas.map((row) => row.id))
  const contributors = [...input.contributors].filter((row) => known.has(row.umaId)).sort((left, right) => left.umaId.localeCompare(right.umaId))
  const rows: TrainerRecord[] = []
  const statRows = contributors.flatMap((state) => STATS.map((stat): TrainerRecord => ({
    kind: 'highest-stat', value: state.facts.statPeaks[stat], umaId: state.umaId, sourceId: null,
    achievedAt: state.trackingStartedAt, stat,
  })))
  const stat = bestRecord('highest-stat', statRows)
  if (stat) rows.push(stat)
  const scalar = (
    kind: TrainerRecord['kind'],
    value: (state: UmaBadgeStateV1) => number,
    source?: (state: UmaBadgeStateV1) => Pick<TrainerRecord, 'sourceId' | 'achievedAt'> | null,
  ) => bestRecord(kind, contributors.map((state) => {
    const recordSource = source?.(state)
    return {
      kind, value: value(state), umaId: state.umaId, sourceId: recordSource?.sourceId ?? null,
      achievedAt: recordSource?.achievedAt ?? state.trackingStartedAt, stat: null,
    }
  }))
  const exactRaceSource = (
    state: UmaBadgeStateV1,
    value: number,
    predicate: (result: RaceResultRecord) => boolean,
  ): Pick<TrainerRecord, 'sourceId' | 'achievedAt'> | null => {
    const matching = orderedRaceResults(input, state.umaId).filter(predicate)
    return value > 0 && matching.length === value ? raceSource(matching.at(-1)!) : null
  }
  const wins = scalar('most-wins', (state) => state.facts.wins,
    (state) => exactRaceSource(state, state.facts.wins, (result) => result.playerPlacement === 1))
  const g1s = scalar('most-g1-wins', (state) => countFact(state.facts.gradeWins, 'g1'),
    (state) => exactRaceSource(state, countFact(state.facts.gradeWins, 'g1'),
      (result) => result.playerPlacement === 1 && result.accomplishmentFacts?.grade === 'g1'))
  const badges = scalar('most-badge-stages', (state) => state.awards.badges.length, (state) => {
    const latest = [...state.awards.badges].sort((left, right) => left.earnedAt - right.earnedAt ||
      left.awardKey.localeCompare(right.awardKey) || (left.source.id ?? '').localeCompare(right.source.id ?? '')).at(-1)
    return latest ? { sourceId: latest.source.id, achievedAt: latest.earnedAt } : null
  })
  const streak = scalar('longest-win-streak', (state) => state.facts.longestWinStreak, (state) => {
    const results = orderedRaceResults(input, state.umaId)
    if (results.length !== state.facts.starts) return null
    let current = 0
    let best = 0
    let sourceResult: RaceResultRecord | null = null
    for (const result of results) {
      current = result.playerPlacement === 1 ? current + 1 : 0
      if (current > best) {
        best = current
        sourceResult = result
      }
    }
    return best === state.facts.longestWinStreak && sourceResult ? raceSource(sourceResult) : null
  })
  for (const record of [wins, g1s, badges, streak]) if (record) rows.push(record)
  const margins = input.raceResults.filter((result) => known.has(result.umaId) && result.playerPlacement === 1).flatMap((result): TrainerRecord[] => {
    const runnerUp = result.field.find((runner) => runner.placement === 2)
    return runnerUp ? [{
      kind: 'biggest-winning-margin', value: runnerUp.marginLengths, umaId: result.umaId,
      sourceId: `race:${result.umaId}:${result.sequence}`, achievedAt: result.createdAt, stat: null,
    }] : []
  })
  const margin = bestRecord('biggest-winning-margin', margins)
  if (margin) rows.push(margin)
  return rows.sort((left, right) => left.kind.localeCompare(right.kind))
}

function earnedStages(definition: TrainerAchievementDefinition, aggregates: readonly CountFact[]): (BadgeTier | 'one-off')[] {
  const value = countFact(aggregates, definition.aggregateKey)
  const allThreshold = definition.allThresholdKey ? countFact(aggregates, definition.allThresholdKey) : null
  if (definition.kind === 'one-off') return allThreshold !== null && allThreshold > 0 && value >= allThreshold ? ['one-off'] : []
  const stages = definition.thresholds.flatMap((threshold, index) => value >= threshold ? [BADGE_TIERS[index]!] : [])
  if (allThreshold !== null && allThreshold > 0 && value >= allThreshold) stages.push('rainbow')
  return stages
}

function stageFrozenKeys(definition: TrainerAchievementDefinition, stage: BadgeTier | 'one-off'): string[] {
  return (stage === 'rainbow' && definition.allThresholdKey) || definition.kind === 'one-off'
    ? [...definition.frozenKeys]
    : []
}

export function reconcileTrainerState(input: TrainerReconcileInput): TrainerReconcileResult {
  if (!Number.isSafeInteger(input.now) || input.now < 0 || !input.contentVersion) throw new Error('Trainer reconciliation time/content is invalid')
  const parsed = parseBadgeState(input.state)
  if (!parsed || parsed.scope !== 'trainer') throw new Error('Trainer reconciliation state is invalid')
  for (const contributor of input.contributors) {
    const checked = parseBadgeState(contributor)
    if (!checked || checked.scope !== 'uma' || checked.umaId !== contributor.umaId) throw new Error(`Trainer contributor is invalid: ${contributor.umaId}`)
  }
  const catalog = buildTrainerAchievementCatalog(input)
  const aggregates = aggregateFacts(input, catalog)
  const records = deriveRecords(input)
  const achievements = [...parsed.awards.achievements]
  const events: FlairEventRecord[] = []
  const source = {
    kind: input.retroactive ? 'migration' as const : 'collection' as const,
    id: input.sourceId ?? (input.retroactive ? 'migration:trainer' : `collection:${input.now}`),
    tier: null,
  }
  for (const definition of catalog.definitions) {
    for (const stage of earnedStages(definition, aggregates)) {
      if (achievements.some((award) => award.awardKey === definition.awardKey && award.stage === stage)) continue
      const award: EarnedBadgeStage = {
        awardKey: definition.awardKey,
        stage,
        earnedAt: input.now,
        history: 'exact',
        source,
        frozenKeys: stageFrozenKeys(definition, stage),
      }
      achievements.push(award)
      const data: FlairEventV1 = {
        version: FLAIR_EVENT_VERSION,
        scope: 'trainer',
        umaId: null,
        kind: 'trainer-achievement',
        awardKey: definition.awardKey,
        stage,
        earnedAt: input.now,
        source,
        retroactive: input.retroactive,
      }
      const event = { id: flairEventId('trainer', null, definition.awardKey, stage), data }
      if (!parseFlairEvent(data)) throw new Error('Trainer evaluator produced an invalid event')
      events.push(event)
    }
  }
  const stageOrder = (stage: BadgeTier | 'one-off') => stage === 'one-off' ? BADGE_TIERS.length : BADGE_TIERS.indexOf(stage)
  achievements.sort((left, right) => left.awardKey.localeCompare(right.awardKey) || stageOrder(left.stage) - stageOrder(right.stage))
  events.sort((left, right) => left.id.localeCompare(right.id))
  const candidate: TrainerBadgeStateV1 = {
    ...parsed,
    catalogVersion: TRAINER_ACHIEVEMENT_CATALOG_VERSION,
    evaluatorVersion: TRAINER_ACHIEVEMENT_EVALUATOR_VERSION,
    sourceWatermarks: {
      contributors: input.ownedUmas.filter((uma) => input.umas.some((template) => template.id === uma.templateId)).length,
      ledgerEntries: input.ledger.length,
      contentVersion: input.contentVersion,
    },
    aggregates,
    records,
    awards: { achievements },
  }
  const next = parseBadgeState(candidate)
  if (!next || next.scope !== 'trainer') throw new Error('Trainer reconciliation produced invalid state')
  return { state: next, events, changed: JSON.stringify(next) !== JSON.stringify(parsed) }
}

export function projectTrainerAchievementProgress(
  catalog: TrainerAchievementCatalogV1,
  state: TrainerBadgeStateV1,
): TrainerAchievementProgress[] {
  return catalog.definitions.map((definition) => {
    const value = countFact(state.aggregates, definition.aggregateKey)
    const earned = state.awards.achievements.filter((award) => award.awardKey === definition.awardKey)
    const expected = earnedStages(definition, state.aggregates)
    const highestStage = earned.at(-1)?.stage ?? null
    const nextStage = expected.length < (definition.kind === 'one-off' ? 1 : 5) ? expected.length : -1
    const complete = definition.kind === 'one-off' ? highestStage === 'one-off' : earned.some((award) => award.stage === 'rainbow')
    let nextThreshold: number | null = null
    if (!complete && definition.kind === 'one-off') nextThreshold = countFact(state.aggregates, definition.allThresholdKey!)
    else if (!complete && nextStage >= 0 && nextStage < 4) nextThreshold = definition.thresholds[nextStage] ?? null
    else if (!complete && nextStage === 4 && definition.allThresholdKey) nextThreshold = countFact(state.aggregates, definition.allThresholdKey)
    return {
      definition,
      value,
      highestStage,
      nextThreshold,
      progress: nextThreshold && nextThreshold > 0 ? Math.min(1, value / nextThreshold) : complete ? 1 : 0,
      complete,
      earnedAt: earned.length ? Math.max(...earned.map((award) => award.earnedAt)) : null,
      frozenAllKeys: earned.find((award) => award.stage === 'rainbow' || award.stage === 'one-off')?.frozenKeys ?? [],
    }
  })
}

export function trainerRecordLabel(record: TrainerRecord): string {
  if (record.kind === 'highest-stat') return `Highest ${record.stat ?? 'stat'}`
  if (record.kind === 'most-wins') return 'Most wins by one Uma'
  if (record.kind === 'most-g1-wins') return 'Most G1 wins by one Uma'
  if (record.kind === 'most-badge-stages') return 'Most badge stages by one Uma'
  if (record.kind === 'biggest-winning-margin') return 'Biggest winning margin'
  return 'Longest win streak'
}

export function trainerHighestStage(awards: readonly EarnedBadgeStage[], awardKey: string): BadgeTier | 'one-off' | null {
  return awards.filter((award) => award.awardKey === awardKey).at(-1)?.stage ?? null
}

export function trainerContentCounts(state: TrainerBadgeStateV1): {
  ownedUmas: number
  catalogUmas: number
  ownedCards: number
  catalogCards: number
  maxedCards: number
  badgeStages: number
} {
  return {
    ownedUmas: countFact(state.aggregates, 'owned-umas'),
    catalogUmas: countFact(state.aggregates, 'catalog-umas'),
    ownedCards: countFact(state.aggregates, 'owned-cards'),
    catalogCards: countFact(state.aggregates, 'catalog-cards'),
    maxedCards: countFact(state.aggregates, 'maxed-cards'),
    badgeStages: countFact(state.aggregates, 'badge-stages'),
  }
}

export function trainerStatName(stat: StatKey | null): string | null {
  return stat ? stat.charAt(0).toLocaleUpperCase() + stat.slice(1) : null
}
