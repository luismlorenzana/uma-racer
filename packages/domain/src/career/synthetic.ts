// Invented content for `sim:careers` in CI and the career's tests (D383): Umas, races on every surface, distance, grade
// and season, their courses, and the skills the invented cards (`syntheticCards`) hint. Made-up numbers on a formula,
// shaped like the original's (star-5 bases summing 550, growth summing 30%), never a real Uma's, race's or skill's.
import type { CourseTemplate, RaceTemplate, SkillTemplate, UmaTemplate } from '../content'
import { syntheticCards } from '../build/decks'
import { DISTANCE_CATEGORIES, SURFACES, type Aptitudes, type DistanceCategory, type Grade, type Stats, type Surface } from '../types'
import type { CareerSimContent } from './sim'

const METERS: Readonly<Record<DistanceCategory, number>> = { sprint: 1200, mile: 1600, medium: 2000, long: 2500 }
const stats = (speed: number, stamina: number, power: number, guts: number, wit: number): Stats => ({ speed, stamina, power, guts, wit })

/** A course of `meters`: a start straight, two corners, the back straight, two corners and the home straight. */
export function syntheticCourse(id: string, meters: number): CourseTemplate {
  const at = (share: number) => Math.round(meters * share)
  return {
    id, trackId: '10001', distance: 0, terrain: 1, turn: 1,
    corners: [
      { start: at(0.15), end: at(0.3), number: 1 }, { start: at(0.3), end: at(0.45), number: 2 },
      { start: at(0.6), end: at(0.72), number: 3 }, { start: at(0.72), end: at(0.84), number: 4 },
    ],
    straights: [{ start: 0, end: at(0.15), frontType: 2 }, { start: at(0.45), end: at(0.6), frontType: 2 }, { start: at(0.84), end: meters, frontType: 1 }],
    slopes: [{ start: at(0.5), end: at(0.55), slope: 10_000 }],
  }
}

/**
 * The seasons each grade runs in (the race season codes): G3s in spring, summer and winter, G2s in spring, autumn and
 * winter, G1s in the cherry-blossom weeks, autumn and winter, as the original's calendar leans.
 */
export const SYNTHETIC_SEASONS: Readonly<Record<'g3' | 'g2' | 'g1', readonly number[]>> = { g3: [1, 2, 4], g2: [1, 3], g1: [5, 3, 1] }

/** A race of every surface and distance, graded G3, G2 and G1, in each of its grade's seasons. */
export function syntheticRaces(): RaceTemplate[] {
  const races: RaceTemplate[] = []
  let family = 9000
  for (const surface of SURFACES) {
    for (const distanceCategory of DISTANCE_CATEGORIES) {
      for (const grade of ['g3', 'g2', 'g1'] as const) {
        for (const season of SYNTHETIC_SEASONS[grade]) {
          family += 1
          const id = `sim-${surface}-${distanceCategory}-${grade}-${season}`
          races.push({
            id, familyId: String(family), name: `Sim ${surface} ${distanceCategory} ${grade.toUpperCase()} ${season}`, grade, surface,
            distance: METERS[distanceCategory], distanceCategory, direction: season % 2 === 0 ? 'left' : 'right',
            venue: 'Sim Park', venueKey: 'sim-park', venueTags: [], series: [], seriesLegs: [],
            courseId: `sim-course-${distanceCategory}`, season, fieldSize: 14,
          })
        }
      }
    }
  }
  return races
}

export const syntheticCourses = (): CourseTemplate[] =>
  DISTANCE_CATEGORIES.map((distance) => syntheticCourse(`sim-course-${distance}`, METERS[distance]))

const skill = (id: string, costSp: number | null, kind: SkillTemplate['kind'], condition: string, type: number, value: number, normalSkillId: string | null = null): SkillTemplate => ({
  id, kind, name: `Sim skill ${id}`, description: '', costSp, iconId: null, activation: kind === 'unique' ? 0 : 1,
  conditions: [{ precondition: null, condition, baseTime: 30_000, cooldown: null, effects: [{ type, value }] }],
  inheritedSkillId: null, normalSkillId,
})

/**
 * The skills: each Uma's unique and two awakening skills (a white and its gold), the cards' hint whites and event golds,
 * and a few whites rivals draw.
 */
export function syntheticSkills(umaCount = SYNTHETIC_UMAS): SkillTemplate[] {
  const kinds = ['speed', 'stamina', 'power', 'guts', 'wit', 'friend'] as const
  return [
    ...Array.from({ length: umaCount }, (_, n) => [
      skill(`sim-unique-${n}`, null, 'unique', 'phase>=2', 27, 3500),
      skill(`sim-awake-w-${n}`, 150, 'white', 'phase==1', 27, 1500),
      skill(`sim-awake-g-${n}`, 180, 'gold', 'phase==1', 27, 3500, `sim-awake-w-${n}`),
    ]).flat(),
    ...kinds.flatMap((type) => [
      skill(`sim-skill-${type}-1`, 120, 'white', 'phase==2', 27, 1500),
      skill(`sim-skill-${type}-2`, 160, 'white', 'phase==1', 31, 2000),
      skill(`sim-skill-${type}-3`, 180, 'white', 'phase==0', 9, 150),
      skill(`sim-event-${type}`, 200, 'gold', 'phase==2', 27, 3500, `sim-skill-${type}-1`),
    ]),
    skill('sim-rival-1', 140, 'white', 'phase==2', 27, 1500),
    skill('sim-rival-2', 140, 'white', 'phase==1', 31, 2000),
    skill('sim-rival-3', 140, 'white', 'phase==0', 9, 150),
  ]
}

export const SYNTHETIC_UMAS = 16

const PROFILES: readonly { distance: Readonly<Record<DistanceCategory, Grade>>; strategy: Aptitudes['strategy'] }[] = [
  { distance: { sprint: 'C', mile: 'A', medium: 'A', long: 'B' }, strategy: { front: 'C', pace: 'A', late: 'B', end: 'C' } },
  { distance: { sprint: 'D', mile: 'B', medium: 'A', long: 'A' }, strategy: { front: 'D', pace: 'B', late: 'A', end: 'B' } },
  { distance: { sprint: 'A', mile: 'A', medium: 'C', long: 'E' }, strategy: { front: 'A', pace: 'B', late: 'C', end: 'D' } },
  { distance: { sprint: 'B', mile: 'A', medium: 'B', long: 'D' }, strategy: { front: 'B', pace: 'B', late: 'B', end: 'A' } },
]
const BASES: readonly Stats[] = [stats(120, 100, 110, 100, 120), stats(105, 125, 105, 110, 105), stats(125, 95, 120, 100, 110), stats(110, 110, 110, 110, 110)]
const GROWTHS: readonly Stats[] = [stats(0.2, 0, 0.1, 0, 0), stats(0, 0.2, 0, 0.1, 0), stats(0.1, 0, 0.1, 0, 0.1), stats(0, 0, 0.2, 0.1, 0)]

/** Invented Umas, each her own character: four aptitude profiles, turf runners with a few on dirt. */
export function syntheticCareerUmas(count = SYNTHETIC_UMAS): UmaTemplate[] {
  return Array.from({ length: count }, (_, n): UmaTemplate => {
    const profile = PROFILES[n % PROFILES.length]!
    const dirt = n % 5 === 4
    const surface: Record<Surface, Grade> = dirt ? { turf: 'C', dirt: 'A' } : { turf: 'A', dirt: 'G' }
    return {
      id: `sim-uma-${n}`, charaId: `sim-chara-${n}`, name: `Sim Uma ${n}`, outfit: null, jpRelease: '2021-02-24', globalRelease: null,
      starter: true, baseStats: { ...BASES[n % BASES.length]! }, growthRates: { ...GROWTHS[(n >> 2) % GROWTHS.length]! },
      aptitudes: { surface, distance: { ...profile.distance }, strategy: { ...profile.strategy } },
      uniqueSkillId: `sim-unique-${n}`, awakeningSkillIds: [`sim-awake-w-${n}`, `sim-awake-g-${n}`], innateSkillIds: [], eventSkillIds: [],
      realHorseSex: n % 2 === 0 ? 'female' : 'male', signatureRaceFamilyIds: [],
    }
  })
}

/** All of it, as the career sim reads content. */
export function syntheticCareerContent(): CareerSimContent {
  return {
    umas: syntheticCareerUmas(), cards: syntheticCards(), skills: syntheticSkills(), races: syntheticRaces(), courses: syntheticCourses(),
    contentVersion: 'synthetic-1',
  }
}
