// Synthetic content and state builders for the tier rules' tests (packages/domain/src/rework/tiers). Every template
// and race is invented; the set-leg slugs are the public ones today's planner already names.
import type { RaceTemplate, UmaTemplate } from '../content'
import { flairSeriesLegId, type FlairSeriesTag } from '../badges'
import type { ScenarioJourney } from '../career-shapes'
import type { Aptitudes, DistanceCategory, RaceGrade, Surface } from '../types'
import type { TierContent } from '../rework/tiers/career'
import { freezeCareer, settleGoalWin } from '../rework/tiers/career'
import { lifetimeLevel, scenarioNumber } from '../rework/tiers/map'
import type { ReworkState, ScenarioOfTier, Tier, UmaState } from '../rework/types'
import { goalRaceIds } from '../scenario-goals'

const DISTANCE: Record<DistanceCategory, number> = { sprint: 1200, mile: 1600, medium: 2000, long: 2500 }

let nextFamily = 500
function race(grade: RaceGrade, surface: Surface, distanceCategory: DistanceCategory, extra: Partial<RaceTemplate> = {}): RaceTemplate {
  nextFamily += 1
  const id = extra.id ?? `${surface}-${grade}-${distanceCategory}-${nextFamily}`
  return {
    id, familyId: String(nextFamily), name: id, grade, surface, distance: DISTANCE[distanceCategory], distanceCategory,
    direction: 'left', venue: 'Test Track', venueKey: 'test-track', venueTags: [], series: [], seriesLegs: [],
    courseId: 'course-1', season: 1, fieldSize: 12, ...extra,
  }
}

const leg = (id: string, distanceCategory: DistanceCategory, legs: [FlairSeriesTag, string][]) =>
  race('g1', 'turf', distanceCategory, { id, series: [...new Set(legs.map(([tag]) => tag))], seriesLegs: legs.map(([tag, key]) => flairSeriesLegId(tag, key)) })

export const RACES: readonly RaceTemplate[] = [
  leg('satsuki-sho', 'medium', [['triple-crown', 'satsuki-sho']]),
  leg('tokyo-yushun', 'medium', [['triple-crown', 'tokyo-yushun']]),
  leg('kikuka-sho', 'long', [['triple-crown', 'kikuka-sho']]),
  leg('takarazuka-kinen', 'medium', [['grand-prix', 'takarazuka-kinen']]),
  leg('arima-kinen', 'long', [['grand-prix', 'arima-kinen']]),
  ...(['turf', 'dirt'] as const).flatMap((surface) => (['g3', 'g2', 'g1'] as const).flatMap((grade) =>
    (['sprint', 'mile', 'medium', 'long'] as const).flatMap((distance) => [0, 1, 2].map(() => race(grade, surface, distance))))),
]

const grades = (distance: [string, string, string, string], surface: [string, string] = ['A', 'G']): Aptitudes => ({
  surface: { turf: surface[0], dirt: surface[1] },
  distance: { sprint: distance[0], mile: distance[1], medium: distance[2], long: distance[3] },
  strategy: { front: 'B', pace: 'A', late: 'A', end: 'C' },
} as Aptitudes)

export const template = (id: string, aptitudes: Aptitudes, extra: Partial<UmaTemplate> = {}): UmaTemplate => ({
  id, charaId: `chara-${id}`, name: `Synthetic ${id}`, outfit: null, jpRelease: '2000-01-01', globalRelease: null, starter: true,
  baseStats: { speed: 100, stamina: 100, power: 100, guts: 100, wit: 100 },
  growthRates: { speed: 0, stamina: 0, power: 0, guts: 0, wit: 0 },
  aptitudes, uniqueSkillId: `unique-${id}`, awakeningSkillIds: [], realHorseSex: null, signatureRaceFamilyIds: [],
  imageSource: 'https://invalid.test/synthetic.png', ...extra,
})

/** A colt for medium and long; a sprinter whose dirt is F, so lineage can lift it; parents strong on dirt and sprint. */
export const COLT = template('colt', grades(['C', 'B', 'A', 'A']), { realHorseSex: 'male' })
export const SPRINTER = template('sprinter', grades(['A', 'B', 'C', 'G'], ['A', 'F']), { realHorseSex: 'female', uniqueSkillId: null })
export const DIRT_PARENT_A = template('dirt-a', grades(['A', 'A', 'C', 'G'], ['C', 'A']))
export const DIRT_PARENT_B = template('dirt-b', grades(['A', 'A', 'C', 'G'], ['C', 'A']))
export const DIRT_PARENT_C = template('dirt-c', grades(['A', 'A', 'C', 'G'], ['C', 'A']))

export const CONTENT: TierContent = {
  umas: new Map([COLT, SPRINTER, DIRT_PARENT_A, DIRT_PARENT_B, DIRT_PARENT_C].map((uma) => [uma.id, uma])),
  races: RACES,
}

/** Every goal of a career won, in goal order, by settling each of its races. */
export function wonCareer(career: ScenarioJourney, at = 1): ScenarioJourney {
  let next = career
  for (const raceId of career.goals.flatMap(goalRaceIds)) next = settleGoalWin(next, raceId, `result-${raceId}`, at).career
  return next
}

/**
 * An Uma moved to `tier` · `scenario` at a Racing Level, with that scenario's career frozen (and won, if asked). A
 * test-only shortcut past the rules that bring her there, which their own tests cover.
 */
export function placeUma(
  uma: UmaState,
  where: { tier: Tier; scenario: ScenarioOfTier; level: number; exp?: number; careerWon?: boolean },
  content: TierContent = CONTENT,
): UmaState {
  const moved = { ...uma, tier: where.tier, scenario: where.scenario, racing: { level: where.level, exp: where.exp ?? 0 } }
  lifetimeLevel(where.tier, where.level)
  const career = freezeCareer(moved, scenarioNumber(where), content)
  return { ...moved, career: where.careerWon ? wonCareer(career) : career }
}

/** The state with one Uma placed (see `placeUma`). */
export const withPlaced = <S extends ReworkState>(state: S, umaId: string, where: Parameters<typeof placeUma>[1]): S =>
  ({ ...state, umas: { ...state.umas, [umaId]: placeUma(state.umas[umaId]!, where) } })

/** Freeze a value and everything under it, so a test proves a rule never writes into its inputs. */
export function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value)
    for (const child of Object.values(value as object)) deepFreeze(child)
  }
  return value
}
