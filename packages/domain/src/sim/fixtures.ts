// The loop simulation's synthetic content (T132's "Policies", docs/rework/13-removals-and-plan-
// changes.md §5): invented Uma templates, support cards and a race catalogue today's career planner accepts, and the
// representative deck (docs/game/06-cards-and-bonds.md §2, docs/game/08-item-catalogue-and-recipes.md §7). No
// master data, names or ids from the private packs. Pure data.
import { CARD_EFFECTS, type CardEffect } from '../cards'
import { flairSeriesLegId, type FlairSeriesTag } from '../badges'
import type { RaceTemplate, SkillTemplate, SupportCardTemplate, SupportCardType, UmaTemplate } from '../content'
import { DISTANCE_CATEGORIES, STRATEGIES, type Aptitudes, type DistanceCategory, type Grade, type RaceGrade, type Strategy } from '../types'
import type { TierContent } from '../tiers/career'
import { LAST_SCENARIO_NUMBER, SCENARIOS_PER_TIER } from '../tiers/map'
import type { TrainingContent } from '../training/derive'
import type { ScenarioOfTier, Tier } from '../state/types'
import type { WorkContent } from '../work/types'

// ---- Umas ----------------------------------------------------------------------------------------------------------

/** Templates in the pool: the founding 20, the five the baseline adds, and room for the uncapped variant. */
export const SIM_UMA_COUNT = 80
/** The typical Uma's base stats with no growth (scripts/sim/harness.ts's median): the loop never reads them in races. */
const BASE_STATS = { speed: 110, stamina: 105, power: 110, guts: 110, wit: 110 } as const

/** Running styles in the order the rotation walks them. */
const STYLES: readonly Strategy[] = STRATEGIES

/**
 * Uma `i`'s aptitudes: one distance and one running style at A, the next of each at B, the rest at C, rotated so every
 * distance and every style is A for an equal share of each run of 16 (T132 "Account"). Turf A, dirt G, so careers are
 * turf careers.
 */
export function simAptitudes(i: number): Aptitudes {
  const d = i % DISTANCE_CATEGORIES.length
  const s = (i + Math.floor(i / DISTANCE_CATEGORIES.length)) % STYLES.length
  const letter = (index: number, a: number, size: number): Grade => (index === a ? 'A' : index === (a + 1) % size ? 'B' : 'C')
  return {
    surface: { turf: 'A', dirt: 'G' },
    distance: Object.fromEntries(DISTANCE_CATEGORIES.map((key, k) => [key, letter(k, d, DISTANCE_CATEGORIES.length)])) as Aptitudes['distance'],
    strategy: Object.fromEntries(STYLES.map((key, k) => [key, letter(k, s, STYLES.length)])) as Aptitudes['strategy'],
  }
}

export const simUmaId = (i: number): string => `sim-uma-${String(i + 1).padStart(2, '0')}`

function umaTemplate(i: number): UmaTemplate {
  const id = simUmaId(i)
  return {
    id, charaId: `sim-chara-${id}`, name: `Synthetic Uma ${i + 1}`, outfit: null, jpRelease: '2000-01-01', globalRelease: null, starter: true,
    baseStats: { ...BASE_STATS }, growthRates: { speed: 0, stamina: 0, power: 0, guts: 0, wit: 0 },
    aptitudes: simAptitudes(i), uniqueSkillId: `sim-unique-${id}`, awakeningSkillIds: [], realHorseSex: null, signatureRaceFamilyIds: [],
  }
}

/** The pool of synthetic Umas, in unlock order. */
export const SIM_UMAS: readonly UmaTemplate[] = Object.freeze(Array.from({ length: SIM_UMA_COUNT }, (_, i) => umaTemplate(i)))

/** The Farm Level probe's Umas (T132 "Probes"): Front Runner, the Vegetables aptitude (07 §3), at C, A or S, the rest C. */
export const PROBE_LETTERS = Object.freeze(['C', 'A', 'S'] as const)
export type ProbeLetter = (typeof PROBE_LETTERS)[number]
export const probeUmaId = (letter: ProbeLetter): string => `sim-probe-${letter.toLowerCase()}`
export const PROBE_UMAS: readonly UmaTemplate[] = Object.freeze(PROBE_LETTERS.map((letter): UmaTemplate => {
  const base = umaTemplate(0)
  const c = (keys: readonly string[]) => Object.fromEntries(keys.map((key) => [key, 'C']))
  return {
    ...base, id: probeUmaId(letter), charaId: `sim-chara-${probeUmaId(letter)}`, name: `Probe ${letter}`, uniqueSkillId: null,
    aptitudes: {
      surface: { turf: 'A', dirt: 'G' } as Aptitudes['surface'],
      distance: c(DISTANCE_CATEGORIES) as Aptitudes['distance'],
      strategy: { ...(c(STYLES) as Aptitudes['strategy']), front: letter },
    },
  }
}))

// ---- Cards ---------------------------------------------------------------------------------------------------------

/** Every effect 0 but Race Bonus at weight 1.0 (T132 "fixtures"). */
const PROFILE = Object.fromEntries(CARD_EFFECTS.map((key) => [key, key === 'raceBonus' ? 1 : 0])) as Record<CardEffect, number>
/** The six card types the deck and the win table's set use; Group cards bond like Friend ones and aren't needed. */
export const SIM_CARD_TYPES: readonly SupportCardType[] = Object.freeze(['speed', 'stamina', 'power', 'guts', 'wit', 'friend'])

export const simCardId = (type: SupportCardType, era: number): string => `sim-card-${type}-e${era}`

function card(type: SupportCardType, era: number): SupportCardTemplate {
  const id = simCardId(type, era)
  return {
    id, charaId: `sim-chara-${id}`, charName: `Invented ${id}`, title: id, type, jpRelease: '2000-01-01', era, obtain: 'free', starter: true,
    hintSkillIds: [], eventSkillIds: [], effectProfile: { ...PROFILE }, uniqueEffect: null,
  }
}

/** Every type at every era 1–15, each its own character. */
export const SIM_CARDS: readonly SupportCardTemplate[] = Object.freeze(
  SIM_CARD_TYPES.flatMap((type) => Array.from({ length: LAST_SCENARIO_NUMBER }, (_, i) => card(type, i + 1))),
)
const CARD_BY_ID = new Map(SIM_CARDS.map((entry) => [entry.id, entry]))
export function simCard(id: string): SupportCardTemplate {
  const found = CARD_BY_ID.get(id)
  if (!found) throw new RangeError(`No synthetic card ${id}`)
  return found
}

/**
 * The representative deck (T132 "Bonds", 06 §2, 08 §7): scenario 1 bonds one card of each of the six types, scenarios 2
 * and 4 a Speed, Stamina and Power card, scenarios 3 and 5 a Guts, Wit and Friend card, each of the scenario's own era
 * T = 5(t − 1) + s, so its grade is 2s − 1. 6 + 3 + 3 + 3 + 3 = 18 a tier.
 */
export const DECK_TYPES: readonly (readonly SupportCardType[])[] = Object.freeze([
  SIM_CARD_TYPES,
  ['speed', 'stamina', 'power'],
  ['guts', 'wit', 'friend'],
  ['speed', 'stamina', 'power'],
  ['guts', 'wit', 'friend'],
])

export function deckCards(tier: Tier, scenario: ScenarioOfTier): readonly SupportCardTemplate[] {
  const era = SCENARIOS_PER_TIER * (tier - 1) + scenario
  return DECK_TYPES[scenario - 1]!.map((type) => simCard(simCardId(type, era)))
}


// ---- Races ---------------------------------------------------------------------------------------------------------

const METERS: Readonly<Record<DistanceCategory, number>> = { sprint: 1200, mile: 1600, medium: 2000, long: 2500 }
let family = 9000
function race(grade: RaceGrade, distanceCategory: DistanceCategory, tag: string, extra: Partial<RaceTemplate> = {}): RaceTemplate {
  family += 1
  const id = extra.id ?? `sim-${grade}-${distanceCategory}-${tag}`
  return {
    id, familyId: String(family), name: id, grade, surface: 'turf', distance: METERS[distanceCategory], distanceCategory, direction: 'left',
    venue: 'Synthetic Park', venueKey: 'synthetic-park', venueTags: [], series: [], seriesLegs: [], courseId: 'sim-course', season: 1,
    fieldSize: 12, ...extra,
  }
}
const leg = (id: string, distance: DistanceCategory, legs: readonly (readonly [FlairSeriesTag, string])[]) =>
  race('g1', distance, id, { id, series: [...new Set(legs.map(([tag]) => tag))], seriesLegs: legs.map(([tag, key]) => flairSeriesLegId(tag, key)) })

/** Today's set legs under their public slugs, then four turf races of each grade at each distance. */
export const SIM_RACES: readonly RaceTemplate[] = Object.freeze([
  leg('satsuki-sho', 'medium', [['triple-crown', 'satsuki-sho']]),
  leg('tokyo-yushun', 'medium', [['triple-crown', 'tokyo-yushun']]),
  leg('kikuka-sho', 'long', [['triple-crown', 'kikuka-sho']]),
  leg('takarazuka-kinen', 'medium', [['grand-prix', 'takarazuka-kinen']]),
  leg('arima-kinen', 'long', [['grand-prix', 'arima-kinen']]),
  ...(['g3', 'g2', 'g1'] as const).flatMap((grade) => DISTANCE_CATEGORIES.flatMap((distance) => ['a', 'b', 'c', 'd'].map((tag) => race(grade, distance, tag)))),
])

/** G1s by distance, for racing past her goals (T132 "Racing"). */
export const G1_BY_DISTANCE: Readonly<Record<DistanceCategory, readonly RaceTemplate[]>> = Object.freeze(Object.fromEntries(
  DISTANCE_CATEGORIES.map((distance) => [distance, SIM_RACES.filter((entry) => entry.grade === 'g1' && entry.distanceCategory === distance)]),
) as unknown as Record<DistanceCategory, readonly RaceTemplate[]>)

// ---- Content -------------------------------------------------------------------------------------------------------

const SKILLS: ReadonlyMap<string, SkillTemplate> = new Map()

/** Everything the rules read, in one: T125's tier content, T128's training content and T127's work content. */
export type SimContent = TierContent & TrainingContent & WorkContent

export const SIM_CONTENT: SimContent = Object.freeze({
  umas: new Map([...SIM_UMAS, ...PROBE_UMAS].map((uma) => [uma.id, uma])),
  races: SIM_RACES,
  cards: new Map(SIM_CARDS.map((entry) => [entry.id, entry])),
  skills: SKILLS,
})
