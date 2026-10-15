// Catalog-v1 award evaluation and Prestige projection (docs/design/badges.md#catalog-v1), on generation 2's catalogue
// (docs/game/04-tiers-and-promotion.md §9, 06-cards-and-bonds.md §7, 13-removals-and-plan-changes.md §1,
// 05-training-hub.md §11; T141): Diligent retired, the scenario and level awards redefined, and the tier awards added.

import {
  BADGE_CATALOG_VERSION,
  BADGE_FILTER_CATEGORIES,
  BADGE_ONE_OFF_POINTS,
  BADGE_THRESHOLDS,
  BADGE_TIER_POINTS,
  BADGE_TIERS,
  FLAIR_EVENT_VERSION,
  FLAIR_SERIES_REQUIRED_LEGS,
  FLAIR_SERIES_TAGS,
  GOAL_RIBBON_POINTS,
  HALL_OF_FAME_POINTS,
  HONORS_POINTS,
  PRESTIGE_FRAME_THRESHOLDS,
  TITLE_POINTS,
  countFact,
  parseFlairSeriesLegId,
  parseBadgeState,
  parseFlairEvent,
  type BadgeTier,
  type CountFact,
  type FlairEventKind,
  type FlairEventV1,
  type FlairSeriesTag,
  type FlairSource,
  type HistoryGrade,
  type UmaBadgeStateV1,
} from './badges'
import type { RaceTemplate } from './content'
import { capProfile } from './constellation'
import { SCENARIOS } from './scenarios'
import { DISTANCE_CATEGORIES, STATS, STRATEGIES, SURFACES, type StatKey } from './types'

export const UMA_FLAIR_EVALUATOR_VERSION = 1 as const

/**
 * The promotions (04 §9): the tier she is promoted to → the scenario that closes the tier before it,
 * T = 5t (`tiers`' SCENARIOS_PER_TIER). That scenario graduates only at promotion, so "Promoted · Tier t + 1" is
 * its Graduate fact and needs no fact of its own.
 */
export const FLAIR_PROMOTION_SCENARIOS: Readonly<Record<2 | 3, number>> = Object.freeze({ 2: 5, 3: 10 })

/** The Hall of Fame (04 §10): the catalogue's last scenario, which graduates only at induction. */
export const FLAIR_HALL_OF_FAME_SCENARIO: number = SCENARIOS.length

export const FLAIR_CATEGORIES = BADGE_FILTER_CATEGORIES
export type FlairCategory = (typeof FLAIR_CATEGORIES)[number]
export type FlairDefinitionKind = 'tiered' | 'one-off' | 'goal-ribbon' | 'honors' | 'title' | 'trophy'

export type FlairCriterion =
  | { kind: 'fact'; fact: 'wins' | 'starts' | 'longestWinStreak' | 'fullHouseCount' | 'levelPeak' | 'distinctSkills' | 'legacy' | 'dynasty' }
  | { kind: 'count'; fact: 'gradeWins' | 'surfaceWins' | 'distanceWins' | 'strategyWins' | 'venueWins' | 'lowAptitudeSurfaceWins' | 'lowAptitudeDistanceWins' | 'maxSkillsByTier'; key: string }
  | { kind: 'minimum-count'; fact: 'surfaceWins' | 'distanceWins' | 'strategyWins' | 'venueWins'; keys: string[] }
  | { kind: 'race-feat'; key: keyof UmaBadgeStateV1['facts']['raceFeats'] }
  | { kind: 'stat-peak'; stat: StatKey | 'balanced' }
  | { kind: 'scenario'; rule: 'capped' | 'perfect' | 'graduate' | 'speedrun' | 'fully-trained' | 'era-loyalist' | 'honors'; tier: number }
  | { kind: 'all-scenarios'; tiers: number[] }
  | { kind: 'goal'; goalId: string }
  | { kind: 'destiny' }
  | { kind: 'perfect-journey' }
  | { kind: 'series'; tag: FlairSeriesTag; legs: { key: string; familyIds: string[] }[] }
  | { kind: 'family-wins'; familyId: string }
  | { kind: 'course-record'; courseId: string; resultId: string; achievedAt: number }

export interface FlairDefinition {
  awardKey: string
  kind: FlairDefinitionKind
  label: string
  description: string
  category: FlairCategory
  criterion: FlairCriterion
  thresholds: readonly number[]
  points: number
  hidden: boolean
  enabled: boolean
  history: HistoryGrade
  tags: string[]
  frozenKeys: string[]
}

export interface UmaFlairCatalogV1 {
  version: typeof BADGE_CATALOG_VERSION
  definitions: FlairDefinition[]
  mainVenueKeys: string[]
  scenarioTiers: number[]
}

export interface FlairTrigger {
  source: FlairSource
  earnedAt: number
  retroactive: boolean
}

export interface FlairEventRecord {
  id: string
  data: FlairEventV1
}

export interface UmaFlairEvaluation {
  state: UmaBadgeStateV1
  events: FlairEventRecord[]
}

export interface FlairProgress {
  awardKey: string
  value: number | null
  nextThreshold: number | null
  percentage: number | null
  highestStage: BadgeTier | 'one-off' | null
  status: 'hidden' | 'locked' | 'progress' | 'complete' | 'untracked' | 'disabled'
  history: HistoryGrade
  progressLabel: string
}

const titleLabels: Record<FlairSeriesTag, string> = {
  'triple-crown': 'Triple Crown',
  'triple-tiara': 'Triple Tiara',
  'spring-triple-crown': 'Spring Triple Crown',
  'autumn-triple-crown': 'Autumn Triple Crown',
  'grand-prix': 'Grand Prix Queen',
  'sprint-crown': 'Sprint Queen',
  'mile-crown': 'Mile Queen',
  'dirt-crown': 'Dirt Queen',
}

const statLabels: Record<StatKey, string> = {
  speed: 'Speed', stamina: 'Stamina', power: 'Power', guts: 'Guts', wit: 'Wit',
}
const strategyLabels = { front: 'Front Runner', pace: 'Pace Chaser', late: 'Late Surger', end: 'End Closer' } as const

function hashText(value: string): string {
  let hash = 0x811c9dc5
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }
  return (hash >>> 0).toString(16).padStart(8, '0')
}

export function flairDynamicKey(prefix: string, value: string): string {
  const direct = `${prefix}:${value}`
  return direct.length <= 120 ? direct : `${prefix}:${hashText(value)}`
}

export function flairEventId(scope: 'uma' | 'trainer', umaId: string | null, awardKey: string, stage: string): string {
  const raw = `flair:${scope}:${umaId ?? 'stable'}:${awardKey}:${stage}`
  if (raw.length <= 120) return raw
  return `flair:${scope}:${hashText(umaId ?? 'stable')}:${hashText(`${awardKey}:${stage}`)}`
}

export function flairSourceId(prefix: string, ...parts: string[]): string {
  const raw = [prefix, ...parts].join(':')
  return raw.length <= 120 ? raw : `${prefix}:${hashText(raw)}`
}

const sorted = (values: Iterable<string>): string[] => [...new Set(values)].sort((left, right) => left.localeCompare(right))
const raceDetailHistory = (state: UmaBadgeStateV1): HistoryGrade =>
  state.history.diagnostics.some((code) => code.startsWith('race-facts-unavailable:')) ? 'untracked' : state.history.race

export interface FlairContentCoverage {
  coveredSeries: number
  totalSeries: number
  coveredLegs: number
  mainVenues: number
}

export function flairContentCoverage(races: readonly RaceTemplate[]): FlairContentCoverage {
  const legsByTag = new Map<FlairSeriesTag, Set<string>>(FLAIR_SERIES_TAGS.map((tag) => [tag, new Set<string>()]))
  const mainVenues = new Set<string>()
  for (const race of races) {
    if (race.venueTags.includes('jra-main')) mainVenues.add(race.venueKey)
    for (const legId of race.seriesLegs) {
      const leg = parseFlairSeriesLegId(legId)
      if (leg) legsByTag.get(leg.tag)!.add(legId)
    }
  }
  return {
    coveredSeries: FLAIR_SERIES_TAGS.filter((tag) => legsByTag.get(tag)!.size === FLAIR_SERIES_REQUIRED_LEGS[tag]).length,
    totalSeries: FLAIR_SERIES_TAGS.length,
    coveredLegs: [...legsByTag.values()].reduce((sum, legs) => sum + legs.size, 0),
    mainVenues: mainVenues.size,
  }
}

function definition(input: Omit<FlairDefinition, 'thresholds' | 'points' | 'hidden' | 'enabled' | 'history' | 'tags' | 'frozenKeys'> & Partial<Pick<FlairDefinition, 'thresholds' | 'points' | 'hidden' | 'enabled' | 'history' | 'tags' | 'frozenKeys'>>): FlairDefinition {
  return {
    thresholds: [],
    points: input.kind === 'title' ? TITLE_POINTS : input.kind === 'goal-ribbon' ? GOAL_RIBBON_POINTS : input.kind === 'honors' ? HONORS_POINTS : BADGE_ONE_OFF_POINTS,
    hidden: false,
    enabled: true,
    history: 'exact',
    tags: [],
    frozenKeys: [],
    ...input,
  }
}

function fixedDefinitions(state: UmaBadgeStateV1): FlairDefinition[] {
  const raceHistory = state.history.race
  const detailHistory = raceDetailHistory(state)
  const trainingHistory = state.history.training
  const rows: FlairDefinition[] = [
    definition({ awardKey: 'badge:winner', kind: 'tiered', label: 'Winner', description: 'Win races.', category: 'victories', criterion: { kind: 'fact', fact: 'wins' }, thresholds: BADGE_THRESHOLDS.mastery, points: 0, history: raceHistory, tags: ['race'] }),
    definition({ awardKey: 'badge:g3-champion', kind: 'tiered', label: 'G3 Champion', description: 'Win G3 races.', category: 'victories', criterion: { kind: 'count', fact: 'gradeWins', key: 'g3' }, thresholds: BADGE_THRESHOLDS.gradeChampion, points: 0, history: detailHistory, tags: ['race', 'g3'] }),
    definition({ awardKey: 'badge:g2-champion', kind: 'tiered', label: 'G2 Champion', description: 'Win G2 races.', category: 'victories', criterion: { kind: 'count', fact: 'gradeWins', key: 'g2' }, thresholds: BADGE_THRESHOLDS.gradeChampion, points: 0, history: detailHistory, tags: ['race', 'g2'] }),
    definition({ awardKey: 'badge:g1-champion', kind: 'tiered', label: 'G1 Champion', description: 'Win G1 races.', category: 'victories', criterion: { kind: 'count', fact: 'gradeWins', key: 'g1' }, thresholds: BADGE_THRESHOLDS.g1Champion, points: 0, history: detailHistory, tags: ['race', 'g1'] }),
    definition({ awardKey: 'badge:unbeaten', kind: 'tiered', label: 'Unbeaten', description: 'Build a consecutive win streak.', category: 'victories', criterion: { kind: 'fact', fact: 'longestWinStreak' }, thresholds: BADGE_THRESHOLDS.unbeaten, points: 0, history: raceHistory, tags: ['race', 'streak'] }),
    definition({ awardKey: 'badge:seasoned', kind: 'tiered', label: 'Seasoned', description: 'Start races.', category: 'victories', criterion: { kind: 'fact', fact: 'starts' }, thresholds: BADGE_THRESHOLDS.starts, points: 0, history: raceHistory, tags: ['race'] }),
  ]
  for (const surface of SURFACES) {
    const name = surface === 'turf' ? 'Turf' : 'Dirt'
    rows.push(
      definition({ awardKey: `badge:surface:${surface}`, kind: 'tiered', label: `${name} Master`, description: `Win on ${name.toLowerCase()}.`, category: 'surface', criterion: { kind: 'count', fact: 'surfaceWins', key: surface }, thresholds: BADGE_THRESHOLDS.mastery, points: 0, history: detailHistory, tags: ['race', surface] }),
      definition({ awardKey: `badge:against-grain:${surface}`, kind: 'tiered', label: `Against the Grain · ${name}`, description: `Win on ${name.toLowerCase()} with B-or-lower aptitude.`, category: 'surface', criterion: { kind: 'count', fact: 'lowAptitudeSurfaceWins', key: surface }, thresholds: BADGE_THRESHOLDS.specialist, points: 0, history: detailHistory, tags: ['race', surface, 'aptitude'] }),
    )
  }
  rows.push(
    definition({ awardKey: 'badge:impossible-ground', kind: 'one-off', label: 'Impossible Ground', description: 'Win with E-or-lower surface aptitude.', category: 'surface', criterion: { kind: 'race-feat', key: 'impossibleGroundWins' }, hidden: true, history: detailHistory, tags: ['race', 'aptitude'] }),
    definition({ awardKey: 'badge:dual-surface', kind: 'tiered', label: 'Dual Surface', description: 'Win on both turf and dirt.', category: 'surface', criterion: { kind: 'minimum-count', fact: 'surfaceWins', keys: [...SURFACES] }, thresholds: BADGE_THRESHOLDS.breadth, points: 0, history: detailHistory, tags: ['race', 'breadth'] }),
  )
  for (const distance of DISTANCE_CATEGORIES) {
    const name = distance.charAt(0).toUpperCase() + distance.slice(1)
    rows.push(
      definition({ awardKey: `badge:distance:${distance}`, kind: 'tiered', label: `${name} Master`, description: `Win ${name.toLowerCase()} races.`, category: 'distance', criterion: { kind: 'count', fact: 'distanceWins', key: distance }, thresholds: BADGE_THRESHOLDS.mastery, points: 0, history: detailHistory, tags: ['race', distance] }),
      definition({ awardKey: `badge:stretching-out:${distance}`, kind: 'tiered', label: `Stretching Out · ${name}`, description: `Win at ${name.toLowerCase()} distance with B-or-lower aptitude.`, category: 'distance', criterion: { kind: 'count', fact: 'lowAptitudeDistanceWins', key: distance }, thresholds: BADGE_THRESHOLDS.specialist, points: 0, history: detailHistory, tags: ['race', distance, 'aptitude'] }),
    )
  }
  rows.push(
    definition({ awardKey: 'badge:all-rounder', kind: 'tiered', label: 'All-Rounder', description: 'Win across all four distance categories.', category: 'distance', criterion: { kind: 'minimum-count', fact: 'distanceWins', keys: [...DISTANCE_CATEGORIES] }, thresholds: BADGE_THRESHOLDS.breadth, points: 0, history: detailHistory, tags: ['race', 'breadth'] }),
    definition({ awardKey: 'badge:iron-horse', kind: 'one-off', label: 'Iron Horse', description: 'Win at 3,000 m or longer.', category: 'distance', criterion: { kind: 'race-feat', key: 'ironHorseWins' }, history: detailHistory, tags: ['race', 'long'] }),
    definition({ awardKey: 'badge:blink-of-an-eye', kind: 'one-off', label: 'Blink of an Eye', description: 'Win at 1,200 m or shorter.', category: 'distance', criterion: { kind: 'race-feat', key: 'blinkOfAnEyeWins' }, history: detailHistory, tags: ['race', 'sprint'] }),
  )
  for (const strategy of STRATEGIES) {
    rows.push(definition({ awardKey: `badge:strategy:${strategy}`, kind: 'tiered', label: strategyLabels[strategy], description: `Win using ${strategyLabels[strategy]}.`, category: 'strategy', criterion: { kind: 'count', fact: 'strategyWins', key: strategy }, thresholds: BADGE_THRESHOLDS.mastery, points: 0, history: detailHistory, tags: ['race', strategy] }))
  }
  rows.push(
    definition({ awardKey: 'badge:chameleon', kind: 'tiered', label: 'Chameleon', description: 'Win with all four strategies.', category: 'strategy', criterion: { kind: 'minimum-count', fact: 'strategyWins', keys: [...STRATEGIES] }, thresholds: BADGE_THRESHOLDS.breadth, points: 0, history: detailHistory, tags: ['race', 'breadth'] }),
    definition({ awardKey: 'badge:unorthodox', kind: 'one-off', label: 'Unorthodox', description: 'Win with C-or-lower strategy aptitude.', category: 'strategy', criterion: { kind: 'race-feat', key: 'unorthodoxWins' }, hidden: true, history: detailHistory, tags: ['race', 'aptitude'] }),
    definition({ awardKey: 'badge:from-the-back', kind: 'tiered', label: 'From the Back', description: 'Win from 10th or worse at final spurt.', category: 'race-feat', criterion: { kind: 'race-feat', key: 'backFieldWins' }, thresholds: BADGE_THRESHOLDS.backField, points: 0, history: detailHistory, tags: ['race', 'spurt'] }),
  )
  const feats: readonly [string, string, string, keyof UmaBadgeStateV1['facts']['raceFeats'], boolean][] = [
    ['wire-to-wire', 'Wire to Wire', 'Win while strictly leading every section checkpoint.', 'wireToWireWins', true],
    ['great-comeback', 'Great Comeback', 'Win from last place when final spurt begins.', 'greatComebackWins', true],
    ['dominant', 'Dominant', 'Win by at least 5 lengths.', 'dominantWins', false],
    ['big-margin', 'Big Margin', 'Win by at least 10 lengths.', 'bigMarginWins', true],
    ['photo-finish', 'Photo Finish', 'Win by a positive margin below 0.15 lengths.', 'photoFinishWins', false],
    ['lightning-start', 'Lightning Start', 'Win with a start delay below 0.010 seconds.', 'lightningStartWins', true],
    ['slow-start-fast-finish', 'Slow Start, Fast Finish', 'Win after a start delay of at least 0.080 seconds.', 'slowStartWins', true],
    ['heir', 'Heir', 'Win after an inherited unique skill activates.', 'inheritedUniqueWins', false],
  ]
  for (const [id, label, description, key, hidden] of feats) rows.push(definition({ awardKey: `badge:${id}`, kind: 'one-off', label, description, category: 'race-feat', criterion: { kind: 'race-feat', key }, hidden, history: detailHistory, tags: ['race', 'feat'] }))
  for (const stat of STATS) rows.push(definition({ awardKey: `badge:stat:${stat}`, kind: 'tiered', label: `${statLabels[stat]} Peak`, description: `Reach higher saved ${statLabels[stat]}.`, category: 'stats', criterion: { kind: 'stat-peak', stat }, thresholds: BADGE_THRESHOLDS.statPeak, points: 0, tags: ['stats', stat] }))
  rows.push(
    definition({ awardKey: 'badge:balanced', kind: 'tiered', label: 'Balanced', description: 'Raise the minimum of all five stats.', category: 'stats', criterion: { kind: 'stat-peak', stat: 'balanced' }, thresholds: BADGE_THRESHOLDS.balanced, points: 0, tags: ['stats'] }),
    // The level badges read the lifetime level, which the device writes as `levelPeak` (03 §2).
    definition({ awardKey: 'badge:level', kind: 'tiered', label: 'Level Milestones', description: 'Raise her lifetime level: 50 for each tier before hers, plus her Racing Level.', category: 'scenario', criterion: { kind: 'fact', fact: 'levelPeak' }, thresholds: BADGE_THRESHOLDS.level, points: 0, tags: ['level'] }),
    definition({ awardKey: 'badge:full-house', kind: 'one-off', label: 'Full House', description: 'Fill every card node of one constellation.', category: 'training', criterion: { kind: 'fact', fact: 'fullHouseCount' }, hidden: true, history: trainingHistory, tags: ['training'] }),
    definition({ awardKey: 'badge:skill-collector', kind: 'tiered', label: 'Skill Collector', description: 'Learn distinct skills across the Uma’s lifetime.', category: 'skills', criterion: { kind: 'fact', fact: 'distinctSkills' }, thresholds: BADGE_THRESHOLDS.lifetimeSkills, points: 0, tags: ['skills'] }),
    definition({ awardKey: 'badge:full-kit', kind: 'tiered', label: 'Full Kit', description: 'Learn distinct skills in one scenario.', category: 'skills', criterion: { kind: 'count', fact: 'maxSkillsByTier', key: '*' }, thresholds: BADGE_THRESHOLDS.scenarioSkills, points: 0, tags: ['skills', 'scenario'] }),
    definition({ awardKey: 'badge:destiny', kind: 'tiered', label: 'Destiny', description: 'Complete tracked Journey goals.', category: 'goals', criterion: { kind: 'destiny' }, thresholds: BADGE_THRESHOLDS.destiny, points: 0, tags: ['goals'] }),
    definition({ awardKey: 'badge:perfect-journey', kind: 'one-off', label: 'Perfect Journey', description: 'Earn Honors in at least three fully tracked completed Journeys; earlier untracked tiers are ignored.', category: 'goals', criterion: { kind: 'perfect-journey' }, tags: ['goals', 'scenario'] }),
    definition({ awardKey: 'badge:legacy', kind: 'tiered', label: 'Legacy', description: 'Be committed as a direct parent.', category: 'lineage', criterion: { kind: 'fact', fact: 'legacy' }, thresholds: BADGE_THRESHOLDS.legacy, points: 0, history: state.history.lineage, tags: ['lineage'] }),
    definition({ awardKey: 'badge:dynasty', kind: 'tiered', label: 'Dynasty', description: 'Have a grandchild complete a scenario.', category: 'lineage', criterion: { kind: 'fact', fact: 'dynasty' }, thresholds: BADGE_THRESHOLDS.dynasty, points: 0, history: state.history.lineage, tags: ['lineage'] }),
  )
  return rows
}

/** A scenario's completion history: exact with its snapshot, otherwise the family's grade. */
function completionHistoryOf(state: UmaBadgeStateV1, tier: number): HistoryGrade {
  return state.facts.completions.some((entry) => entry.tier === tier) ? 'exact' : state.history['scenario-completion']
}

/** How she leaves scenario `tier` (04 §9): by the advance, by promotion, or into the Hall of Fame. */
function graduateDescription(label: string, tier: number): string {
  if (tier === FLAIR_HALL_OF_FAME_SCENARIO) return `Leave ${label} by entering the Hall of Fame.`
  if (Object.values(FLAIR_PROMOTION_SCENARIOS).includes(tier)) return `Leave ${label} by promotion to the next tier.`
  return `Leave ${label} by advancing to the next scenario.`
}

/** The tier awards (04 §9–§10): each reads the Graduate fact of the scenario that closes it. */
function tierAwardDefinitions(state: UmaBadgeStateV1): FlairDefinition[] {
  const rows = Object.entries(FLAIR_PROMOTION_SCENARIOS).map(([to, tier]) => definition({
    awardKey: `badge:promoted:${to}`, kind: 'one-off', label: `Promoted · Tier ${to}`, description: `Be promoted from tier ${Number(to) - 1} to tier ${to}.`,
    category: 'scenario', criterion: { kind: 'scenario', rule: 'graduate', tier }, history: completionHistoryOf(state, tier),
    tags: ['scenario', 'promotion', `tier:${tier}`],
  }))
  const tier = FLAIR_HALL_OF_FAME_SCENARIO
  const history = completionHistoryOf(state, tier)
  rows.push(
    definition({
      awardKey: 'badge:hall-of-fame', kind: 'one-off', label: 'Hall of Fame', description: 'Enter the Hall of Fame by completing tier 3.',
      category: 'scenario', criterion: { kind: 'scenario', rule: 'graduate', tier }, points: HALL_OF_FAME_POINTS, history,
      tags: ['scenario', 'hall-of-fame', `tier:${tier}`],
    }),
    definition({
      awardKey: 'title:hall-of-famer', kind: 'title', label: 'Hall of Famer', description: 'Enter the Hall of Fame by completing tier 3.',
      category: 'title', criterion: { kind: 'scenario', rule: 'graduate', tier }, history, tags: ['title', 'hall-of-fame', `tier:${tier}`],
    }),
  )
  return rows
}

export function buildUmaFlairCatalog(input: {
  state: UmaBadgeStateV1
  races: readonly RaceTemplate[]
  courseRecordIds?: ReadonlySet<string>
  courseRecordSources?: ReadonlyMap<string, { resultId: string; achievedAt: number }>
}): UmaFlairCatalogV1 {
  const { state } = input
  const definitions = fixedDefinitions(state)
  const detailHistory = raceDetailHistory(state)
  const venues = new Map<string, string>()
  const familyRows = new Map<string, { grade: RaceTemplate['grade']; name: string }>()
  const seriesLegs = new Map<FlairSeriesTag, Map<string, Set<string>>>(
    FLAIR_SERIES_TAGS.map((tag) => [tag, new Map<string, Set<string>>()]),
  )
  for (const race of [...input.races].sort((left, right) => left.id.localeCompare(right.id))) {
    if (!venues.has(race.venueKey)) venues.set(race.venueKey, race.venue)
    const family = familyRows.get(race.familyId) ?? { grade: race.grade, name: race.name }
    if (race.grade === 'g1') family.grade = 'g1'
    familyRows.set(race.familyId, family)
    for (const legId of race.seriesLegs) {
      const leg = parseFlairSeriesLegId(legId)
      if (!leg) continue
      const families = seriesLegs.get(leg.tag)!.get(legId) ?? new Set<string>()
      families.add(race.familyId)
      seriesLegs.get(leg.tag)!.set(legId, families)
    }
  }
  for (const venueKey of sorted(new Set([...venues.keys(), ...state.facts.venueWins.map((row) => row.key)]))) {
    definitions.push(definition({
      awardKey: flairDynamicKey('badge:venue', venueKey),
      kind: 'tiered',
      label: `${venues.get(venueKey) ?? `Venue ${venueKey}`} Regular`,
      description: 'Win at this venue.',
      category: 'venue',
      criterion: { kind: 'count', fact: 'venueWins', key: venueKey },
      thresholds: BADGE_THRESHOLDS.venue,
      points: 0,
      history: detailHistory,
      tags: ['race', 'venue'],
      frozenKeys: [venueKey],
    }))
  }
  const mainVenueKeys = sorted(new Set(input.races.filter((race) => race.venueTags.includes('jra-main')).map((race) => race.venueKey)))
  definitions.push(definition({
    awardKey: 'badge:grand-tour', kind: 'one-off', label: 'Grand Tour', description: 'Win at all 10 main venues.',
    category: 'venue', criterion: { kind: 'minimum-count', fact: 'venueWins', keys: mainVenueKeys }, enabled: mainVenueKeys.length === 10,
    history: detailHistory, tags: ['race', 'venue'], frozenKeys: mainVenueKeys,
  }))
  for (const tag of FLAIR_SERIES_TAGS) {
    const legs = [...seriesLegs.get(tag)!]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, familyIds]) => ({ key, familyIds: sorted(familyIds) }))
    definitions.push(definition({
      awardKey: `title:${tag}`, kind: 'title', label: titleLabels[tag], description: `Win every leg in the ${titleLabels[tag]} set.`,
      category: 'title', criterion: { kind: 'series', tag, legs }, enabled: legs.length === FLAIR_SERIES_REQUIRED_LEGS[tag],
      history: detailHistory, tags: ['title', 'race', tag], frozenKeys: legs.map((leg) => leg.key),
    }))
  }
  const knownFamilyIds = sorted(new Set([...familyRows.keys(), ...state.facts.familyWins.map((row) => row.key)]))
  for (const familyId of knownFamilyIds) {
    const current = familyRows.get(familyId)
    const stored = state.facts.familyWins.find((row) => row.key === familyId)
    if (current?.grade !== 'g1' && stored?.grade !== 'g1') continue
    const name = current?.name ?? `Race ${familyId}`
    definitions.push(
      definition({ awardKey: flairDynamicKey('trophy', familyId), kind: 'trophy', label: `${name} Trophy`, description: 'Win this G1 family.', category: 'trophy', criterion: { kind: 'family-wins', familyId }, history: detailHistory, tags: ['trophy', 'g1'], frozenKeys: [familyId] }),
      definition({ awardKey: flairDynamicKey('title:two-time', familyId), kind: 'title', label: `Two-Time ${name}`, description: 'Win this G1 family twice.', category: 'title', criterion: { kind: 'family-wins', familyId }, thresholds: [2], history: detailHistory, tags: ['title', 'g1'], frozenKeys: [familyId] }),
      definition({ awardKey: flairDynamicKey('title:three-time', familyId), kind: 'title', label: `Three-Time ${name}`, description: 'Win this G1 family three times.', category: 'title', criterion: { kind: 'family-wins', familyId }, thresholds: [3], history: detailHistory, tags: ['title', 'g1'], frozenKeys: [familyId] }),
    )
  }
  const earnedCourseIds = state.awards.badges
    .filter((award) => award.awardKey.startsWith('badge:course-record:'))
    .flatMap((award) => award.frozenKeys)
  const courseRecordIds = new Set([...(input.courseRecordIds ?? []), ...earnedCourseIds])
  for (const best of state.facts.courseBests) {
    if (!courseRecordIds.has(best.courseId)) continue
    const source = input.courseRecordSources?.get(best.courseId)
    definitions.push(definition({ awardKey: flairDynamicKey('badge:course-record', best.courseId), kind: 'one-off', label: 'Course Record', description: 'Set a strictly faster player time on this course.', category: 'race-feat', criterion: { kind: 'course-record', courseId: best.courseId, resultId: source?.resultId ?? best.resultId, achievedAt: source?.achievedAt ?? best.achievedAt }, history: detailHistory, tags: ['race', 'record'], frozenKeys: [best.courseId] }))
  }
  for (let tier = 1; tier <= SCENARIOS.length; tier += 1) {
    const scenario = SCENARIOS[tier - 1]!
    const label = scenario.name
    const hasSnapshot = state.facts.completions.some((entry) => entry.tier === tier)
    const completionHistory: HistoryGrade = completionHistoryOf(state, tier)
    const snapshotHistory: HistoryGrade = hasSnapshot ? 'exact' : state.facts.completedScenarioTiers.includes(tier) ? 'untracked' : 'exact'
    const speedrunHistory: HistoryGrade = hasSnapshot
      ? 'exact'
      : state.facts.completedScenarioTiers.includes(tier)
        ? state.history.race === 'exact' ? completionHistory : 'untracked'
        : completionHistory
    // The cap is the scenario's, Graduate is leaving it, Fully Trained is its layer done (05 §11, D344), and Era
    // Loyalist reads the sets of every race she ran in it (06 §7), which the device writes into the completion's deck.
    definitions.push(
      definition({ awardKey: `badge:scenario:${tier}:capped`, kind: 'one-off', label: `${label} Capped`, description: `Complete ${label} with a stat at its cap.`, category: 'scenario', criterion: { kind: 'scenario', rule: 'capped', tier }, history: snapshotHistory, tags: ['scenario', `tier:${tier}`] }),
      definition({ awardKey: `badge:scenario:${tier}:perfect`, kind: 'one-off', label: `${label} Perfect Form`, description: `Complete ${label} with every stat at its cap.`, category: 'scenario', criterion: { kind: 'scenario', rule: 'perfect', tier }, history: snapshotHistory, tags: ['scenario', `tier:${tier}`] }),
      definition({ awardKey: `badge:scenario:${tier}:graduate`, kind: 'one-off', label: `${label} Graduate`, description: graduateDescription(label, tier), category: 'scenario', criterion: { kind: 'scenario', rule: 'graduate', tier }, history: completionHistory, tags: ['scenario', `tier:${tier}`] }),
      definition({ awardKey: `badge:scenario:${tier}:speedrun`, kind: 'one-off', label: `${label} Speedrun`, description: `Complete ${label} in 15 or fewer race starts.`, category: 'scenario', criterion: { kind: 'scenario', rule: 'speedrun', tier }, history: speedrunHistory, tags: ['scenario', `tier:${tier}`] }),
      definition({ awardKey: `badge:scenario:${tier}:fully-trained`, kind: 'one-off', label: `${label} Fully Trained`, description: `Open every unlock of ${label}'s layer.`, category: 'training', criterion: { kind: 'scenario', rule: 'fully-trained', tier }, history: state.history.training, tags: ['training', 'scenario', `tier:${tier}`] }),
      definition({ awardKey: `badge:scenario:${tier}:era-loyalist`, kind: 'one-off', label: `${label} Era Loyalist`, description: `Complete ${label} with only era-${tier} cards in the set of every race she ran in it.`, category: 'training', criterion: { kind: 'scenario', rule: 'era-loyalist', tier }, history: snapshotHistory, tags: ['training', 'scenario', `tier:${tier}`] }),
      definition({ awardKey: `honors:${tier}`, kind: 'honors', label: `${label} Honors`, description: `Complete all three tracked goals in ${label}.`, category: 'goals', criterion: { kind: 'scenario', rule: 'honors', tier }, history: 'exact', tags: ['goals', 'scenario', `tier:${tier}`] }),
    )
  }
  const scenarioTiers = Array.from({ length: SCENARIOS.length }, (_, index) => index + 1)
  // The last scenario graduates only at induction, so Living Legend comes only through the Hall of Fame (04 §9).
  const livingLegend = 'Complete every scenario in this catalog: the last one only by entering the Hall of Fame.'
  definitions.push(definition({ awardKey: 'badge:living-legend', kind: 'one-off', label: 'Living Legend', description: livingLegend, category: 'scenario', criterion: { kind: 'all-scenarios', tiers: scenarioTiers }, history: state.history['scenario-completion'], tags: ['scenario'], frozenKeys: sorted(scenarioTiers.map(String)) }))
  definitions.push(...tierAwardDefinitions(state))
  for (const goal of state.facts.goals) definitions.push(definition({
    awardKey: flairDynamicKey('ribbon', goal.goalId), kind: 'goal-ribbon', label: `Goal Ribbon · Tier ${goal.tier}`, description: 'Complete this tracked Journey goal.',
    category: 'goals', criterion: { kind: 'goal', goalId: goal.goalId }, history: 'exact', tags: ['goals', `tier:${goal.tier}`], frozenKeys: [goal.goalId],
  }))
  definitions.sort((left, right) => left.awardKey.localeCompare(right.awardKey))
  return { version: BADGE_CATALOG_VERSION, definitions, mainVenueKeys, scenarioTiers }
}

function criterionValue(state: UmaBadgeStateV1, criterion: FlairCriterion): number {
  const facts = state.facts
  if (criterion.kind === 'fact') {
    if (criterion.fact === 'distinctSkills') return facts.distinctSkillIds.length
    if (criterion.fact === 'legacy') return facts.legacyEvidence.length
    if (criterion.fact === 'dynasty') return facts.dynastyEvidence.length
    return facts[criterion.fact]
  }
  if (criterion.kind === 'count') {
    const rows = facts[criterion.fact] as CountFact[]
    return criterion.key === '*' ? Math.max(0, ...rows.map((row) => row.count)) : countFact(rows, criterion.key)
  }
  if (criterion.kind === 'minimum-count') return criterion.keys.length === 0 ? 0 : Math.min(...criterion.keys.map((key) => countFact(facts[criterion.fact], key)))
  if (criterion.kind === 'race-feat') return facts.raceFeats[criterion.key]
  if (criterion.kind === 'stat-peak') return criterion.stat === 'balanced' ? facts.balancedPeak : facts.statPeaks[criterion.stat]
  if (criterion.kind === 'scenario') {
    if (criterion.rule === 'graduate') return facts.completedScenarioTiers.includes(criterion.tier) ? 1 : 0
    if (criterion.rule === 'speedrun') {
      const completion = facts.completions.find((entry) => entry.tier === criterion.tier)
      const starts = completion?.raceStarts ?? countFact(facts.raceStartsByTier, String(criterion.tier))
      return facts.completedScenarioTiers.includes(criterion.tier) && starts <= 15 ? 1 : 0
    }
    if (criterion.rule === 'fully-trained') return facts.fullyTrainedTiers.includes(criterion.tier) ? 1 : 0
    if (criterion.rule === 'honors') return facts.honorsTiers.includes(criterion.tier) ? 1 : 0
    const completion = facts.completions.find((entry) => entry.tier === criterion.tier)
    if (!completion) return 0
    if (criterion.rule === 'era-loyalist') return completion.deckEras.length > 0 && completion.deckEras.every((era) => era === criterion.tier) ? 1 : 0
    const cap = Math.min(...STATS.map((stat) => capProfile(criterion.tier)[stat]))
    const capped = STATS.map((stat) => completion.stats[stat] >= cap)
    return criterion.rule === 'capped' ? (capped.some(Boolean) ? 1 : 0) : (capped.every(Boolean) ? 1 : 0)
  }
  if (criterion.kind === 'all-scenarios') return criterion.tiers.every((tier) => facts.completedScenarioTiers.includes(tier)) ? 1 : 0
  if (criterion.kind === 'goal') return facts.goals.some((goal) => goal.goalId === criterion.goalId) ? 1 : 0
  if (criterion.kind === 'destiny') return facts.goals.length
  if (criterion.kind === 'perfect-journey') return facts.completions.length >= 3 && facts.completions.every((entry) => entry.honors) ? 1 : 0
  if (criterion.kind === 'series') return criterion.legs.length > 0 && criterion.legs.every((leg) =>
    leg.familyIds.some((familyId) => countFact(facts.familyWins, familyId) > 0)) ? 1 : 0
  if (criterion.kind === 'family-wins') return countFact(facts.familyWins, criterion.familyId)
  return facts.courseBests.some((entry) => entry.courseId === criterion.courseId) ? 1 : 0
}

function thresholdStages(definition: FlairDefinition, value: number): (BadgeTier | 'one-off')[] {
  if (definition.kind === 'tiered') return definition.thresholds.flatMap((threshold, index) => value >= threshold ? [BADGE_TIERS[index]!] : [])
  const threshold = definition.thresholds[0] ?? 1
  return value >= threshold ? ['one-off'] : []
}

function eventKind(definition: FlairDefinition): FlairEventKind {
  if (definition.kind === 'title') return 'title'
  if (definition.kind === 'trophy') return 'trophy-earned'
  if (definition.kind === 'goal-ribbon') return 'goal-ribbon'
  if (definition.kind === 'honors') return 'honors'
  return definition.kind === 'tiered' ? 'badge-tier' : 'one-off'
}

function sourceForDefinition(
  definition: FlairDefinition,
  state: UmaBadgeStateV1,
  trigger: FlairTrigger,
  stage: BadgeTier | 'one-off',
): FlairTrigger {
  if (definition.criterion.kind === 'goal') {
    const goalId = definition.criterion.goalId
    const goal = state.facts.goals.find((entry) => entry.goalId === goalId)
    if (goal) return { source: { kind: 'goal', id: goal.goalId, tier: goal.tier }, earnedAt: goal.completedAt, retroactive: trigger.retroactive }
  }
  if (definition.criterion.kind === 'course-record') {
    return { source: { kind: 'race', id: definition.criterion.resultId, tier: null }, earnedAt: definition.criterion.achievedAt, retroactive: trigger.retroactive }
  }
  if (definition.criterion.kind === 'scenario') {
    const scenarioTier = definition.criterion.tier
    const completion = state.facts.completions.find((entry) => entry.tier === scenarioTier)
    if (completion) return {
      source: { kind: 'scenario', id: flairSourceId('scenario', state.umaId, String(completion.tier)), tier: completion.tier },
      earnedAt: completion.completedAt,
      retroactive: trigger.retroactive,
    }
  }
  if (definition.criterion.kind === 'fact' && (definition.criterion.fact === 'legacy' || definition.criterion.fact === 'dynasty')) {
    const evidence = [...(definition.criterion.fact === 'legacy' ? state.facts.legacyEvidence : state.facts.dynastyEvidence)]
      .sort((left, right) => left.createdAt - right.createdAt || left.key.localeCompare(right.key))
    const thresholdIndex = definition.kind === 'tiered' && stage !== 'one-off' ? BADGE_TIERS.indexOf(stage) : 0
    const threshold = definition.thresholds[thresholdIndex] ?? 1
    const crossing = evidence[threshold - 1]
    if (crossing) return {
      source: { kind: 'scenario', id: flairSourceId('scenario', crossing.relatedUmaId, String(crossing.tier)), tier: crossing.tier },
      earnedAt: crossing.createdAt,
      retroactive: trigger.retroactive,
    }
  }
  return trigger
}

export function evaluateUmaFlair(catalog: UmaFlairCatalogV1, previous: UmaBadgeStateV1, trigger: FlairTrigger): UmaFlairEvaluation {
  if (catalog.version !== BADGE_CATALOG_VERSION || previous.catalogVersion > catalog.version || !Number.isSafeInteger(trigger.earnedAt) || trigger.earnedAt < 0) {
    throw new Error('Flair evaluator input is incompatible')
  }
  let badges = [...previous.awards.badges]
  let titles = [...previous.awards.titles]
  let trophies = [...previous.awards.trophies]
  let activeTitleId = previous.preferences.activeTitleId
  const events: FlairEventRecord[] = []
  for (const definition of catalog.definitions) {
    if (!definition.enabled || definition.history === 'untracked') continue
    const value = criterionValue(previous, definition.criterion)
    if (definition.kind === 'trophy') {
      if (value <= 0 || definition.criterion.kind !== 'family-wins') continue
      const source = sourceForDefinition(definition, previous, trigger, 'one-off')
      const familyId = definition.criterion.familyId
      const existing = trophies.find((entry) => entry.familyId === familyId)
      if (existing) {
        if (value > existing.count) trophies = trophies.map((entry) => entry.familyId === familyId ? {
          ...entry,
          count: value,
          lastEarnedAt: source.earnedAt,
          lastResultId: source.source.id ?? entry.lastResultId,
        } : entry)
        continue
      }
      const resultId = source.source.id ?? `migration:${previous.umaId}`
      trophies.push({ familyId, count: value, firstEarnedAt: source.earnedAt, lastEarnedAt: source.earnedAt, firstResultId: resultId, lastResultId: resultId })
      const data: FlairEventV1 = { version: FLAIR_EVENT_VERSION, scope: 'uma', umaId: previous.umaId, kind: 'trophy-earned', awardKey: definition.awardKey, stage: 'one-off', earnedAt: source.earnedAt, source: source.source, retroactive: source.retroactive }
      events.push({ id: flairEventId('uma', previous.umaId, definition.awardKey, 'one-off'), data })
      continue
    }
    const stages = thresholdStages(definition, value)
    if (definition.kind === 'title') {
      if (stages.length === 0 || titles.some((entry) => entry.awardKey === definition.awardKey)) continue
      const source = sourceForDefinition(definition, previous, trigger, 'one-off')
      titles.push({ awardKey: definition.awardKey, earnedAt: source.earnedAt, history: definition.history, source: source.source, frozenKeys: [...definition.frozenKeys] })
      if (activeTitleId === null) activeTitleId = definition.awardKey
      const data: FlairEventV1 = { version: FLAIR_EVENT_VERSION, scope: 'uma', umaId: previous.umaId, kind: 'title', awardKey: definition.awardKey, stage: 'one-off', earnedAt: source.earnedAt, source: source.source, retroactive: source.retroactive }
      events.push({ id: flairEventId('uma', previous.umaId, definition.awardKey, 'one-off'), data })
      continue
    }
    for (const stage of stages) {
      if (badges.some((entry) => entry.awardKey === definition.awardKey && entry.stage === stage)) continue
      const source = sourceForDefinition(definition, previous, trigger, stage)
      badges.push({ awardKey: definition.awardKey, stage, earnedAt: source.earnedAt, history: definition.history, source: source.source, frozenKeys: [...definition.frozenKeys] })
      const data: FlairEventV1 = { version: FLAIR_EVENT_VERSION, scope: 'uma', umaId: previous.umaId, kind: eventKind(definition), awardKey: definition.awardKey, stage, earnedAt: source.earnedAt, source: source.source, retroactive: source.retroactive }
      events.push({ id: flairEventId('uma', previous.umaId, definition.awardKey, stage), data })
    }
  }
  const stageOrder = (stage: BadgeTier | 'one-off') => stage === 'one-off' ? BADGE_TIERS.length : BADGE_TIERS.indexOf(stage)
  badges.sort((left, right) => left.awardKey.localeCompare(right.awardKey) || stageOrder(left.stage) - stageOrder(right.stage))
  titles.sort((left, right) => left.awardKey.localeCompare(right.awardKey))
  trophies.sort((left, right) => left.familyId.localeCompare(right.familyId))
  const candidate: UmaBadgeStateV1 = {
    ...previous,
    catalogVersion: catalog.version,
    evaluatorVersion: UMA_FLAIR_EVALUATOR_VERSION,
    awards: { badges, titles, trophies },
    preferences: { ...previous.preferences, activeTitleId },
  }
  const parsed = parseBadgeState(candidate)
  if (!parsed || parsed.scope !== 'uma') throw new Error('Flair evaluator produced invalid badge state')
  for (const event of events) if (!parseFlairEvent(event.data)) throw new Error('Flair evaluator produced an invalid event')
  return { state: parsed, events }
}

export function projectFlairProgress(definition: FlairDefinition, state: UmaBadgeStateV1): FlairProgress {
  const earned = state.awards.badges.filter((entry) => entry.awardKey === definition.awardKey)
  const titleEarned = state.awards.titles.some((entry) => entry.awardKey === definition.awardKey)
  const trophyFamilyId = definition.criterion.kind === 'family-wins' ? definition.criterion.familyId : null
  const trophyEarned = trophyFamilyId !== null && state.awards.trophies.some((entry) => entry.familyId === trophyFamilyId)
  const value = definition.history === 'untracked' ? null : criterionValue(state, definition.criterion)
  const highestStage = titleEarned || trophyEarned ? 'one-off' : earned.at(-1)?.stage ?? null
  if (!definition.enabled) {
    const progressLabel = definition.criterion.kind === 'series'
      ? 'Race-series coverage is not published'
      : definition.awardKey === 'badge:grand-tour'
        ? 'Main-venue coverage is not published'
        : 'Unavailable in current content'
    return { awardKey: definition.awardKey, value, nextThreshold: null, percentage: null, highestStage, status: 'disabled', history: definition.history, progressLabel }
  }
  if (definition.hidden && !highestStage) return { awardKey: definition.awardKey, value: null, nextThreshold: null, percentage: null, highestStage: null, status: 'hidden', history: definition.history, progressLabel: 'Hidden' }
  if (definition.history === 'untracked') return { awardKey: definition.awardKey, value: null, nextThreshold: null, percentage: null, highestStage, status: 'untracked', history: definition.history, progressLabel: 'History unavailable' }
  const thresholds = definition.kind === 'tiered' ? definition.thresholds : [definition.thresholds[0] ?? 1]
  const nextThreshold = thresholds.find((threshold) => (value ?? 0) < threshold) ?? null
  const complete = nextThreshold === null
  const percentage = nextThreshold === null ? 1 : Math.min(1, (value ?? 0) / nextThreshold)
  const prefix = definition.history === 'since-tracking' ? 'at least ' : ''
  return {
    awardKey: definition.awardKey,
    value,
    nextThreshold,
    percentage,
    highestStage,
    status: complete ? 'complete' : (value ?? 0) > 0 ? 'progress' : 'locked',
    history: definition.history,
    progressLabel: complete ? `${prefix}${value} · Complete` : `${prefix}${value} / ${nextThreshold}`,
  }
}

export function prestigeForState(catalog: UmaFlairCatalogV1, state: UmaBadgeStateV1): number {
  let total = state.awards.titles.length * TITLE_POINTS
  const definitions = new Map(catalog.definitions.map((entry) => [entry.awardKey, entry]))
  const badgesByAward = new Map<string, typeof state.awards.badges>()
  for (const badge of state.awards.badges) badgesByAward.set(badge.awardKey, [...(badgesByAward.get(badge.awardKey) ?? []), badge])
  for (const [awardKey, rows] of badgesByAward) {
    const definition = definitions.get(awardKey)
    if (!definition) continue
    if (definition.kind === 'tiered') {
      const highest = Math.max(...rows.map((row) => BADGE_TIERS.indexOf(row.stage as BadgeTier)))
      if (highest >= 0) total += BADGE_TIER_POINTS[highest]!
    } else {
      total += definition.points
    }
  }
  return total
}

export const PRESTIGE_FRAME_LABELS = ['Plain', 'Bronze', 'Silver', 'Gold', 'Platinum', 'Rainbow', 'Legend'] as const
export function prestigeFrame(prestige: number): { index: number; label: (typeof PRESTIGE_FRAME_LABELS)[number]; minimum: number } {
  if (!Number.isSafeInteger(prestige) || prestige < 0) throw new Error('Prestige is invalid')
  let index = 0
  PRESTIGE_FRAME_THRESHOLDS.forEach((threshold, candidate) => { if (prestige >= threshold) index = candidate })
  return { index, label: PRESTIGE_FRAME_LABELS[index]!, minimum: PRESTIGE_FRAME_THRESHOLDS[index]! }
}

const fanfareKindOrder: Readonly<Record<FlairEventKind, number>> = {
  'goal-ribbon': 0,
  honors: 1,
  'badge-tier': 2,
  'one-off': 2,
  'trophy-earned': 3,
  title: 4,
  'trainer-achievement': 5,
}

export function orderFlairEventsForFanfare(events: readonly FlairEventRecord[]): FlairEventRecord[] {
  const highest = new Map<string, FlairEventRecord>()
  for (const event of events) {
    const key = `${event.data.kind}:${event.data.awardKey}`
    const current = highest.get(key)
    const currentTier = current ? BADGE_TIERS.indexOf(current.data.stage as BadgeTier) : -1
    const nextTier = BADGE_TIERS.indexOf(event.data.stage as BadgeTier)
    if (!current || nextTier > currentTier) highest.set(key, event)
  }
  return [...highest.values()].sort((left, right) => fanfareKindOrder[left.data.kind] - fanfareKindOrder[right.data.kind] ||
    left.data.awardKey.localeCompare(right.data.awardKey))
}
