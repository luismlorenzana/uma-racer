// A career's races (docs/game/03-careers.md §4, D383): an objective or a URA Finals round, prepared here from her
// racing build, run by the engine the caller hands in (`OperationEnv.race`), and settled here. The field's draw is
// generation 2's, step for step: the opponents shuffled, her gate, the rivals' styles and stats from `rollRivalFieldAt` at
// the career's scenario, the race's grade and its season, then their skills. The seed is `raceAttemptSeed` of the
// career's start, the content, her, the race, her strategy and the attempt, so a retry is a new race and the same
// attempt is the same race on every device. Pure.
import type { CourseTemplate, RaceTemplate, SkillTemplate, SupportCardTemplate, UmaTemplate } from '../content'
import { COURSE_ROTATION, RACE_GRADE_CODE, compileRaceCourseLayout, compileRaceCourseSlopes } from '../course-layout'
import { castRivals, rollRivalSkills } from '../opponents'
import {
  bestStrategy, raceAttemptSeed, raceFieldSize, raceRng, raceRunOf,
  type RaceEngine, type RaceFinish, type RaceRun, type RaceSetup, type RaceSetupRunner,
} from '../race-attempt'
import {
  compileRaceSkill, levelUniqueSkill, raceSkillSupported, selectRivalSkillPool, skillChainBelow, type CompiledRaceSkill,
} from '../race-skills'
import { deriveRacingBuild } from '../build/racing-build'
import type { BondRecord, CareerObjective, CareerRecord, RacingBuild } from '../save/records'
import { rollRivalFieldAt } from '../tiers/rivals'
import type { RaceGrade, Strategy } from '../types'

/** What preparing a race reads beyond the career: the content, its version and her bond tracks. */
export interface RaceContent {
  readonly umas: ReadonlyMap<string, UmaTemplate>
  readonly cards: ReadonlyMap<string, SupportCardTemplate>
  readonly skills: ReadonlyMap<string, SkillTemplate>
  readonly courses: ReadonlyMap<string, CourseTemplate>
}

/** Which race, against which field. */
export interface RaceSpec {
  readonly kind: 'objective' | 'finale'
  readonly race: RaceTemplate
  /** The field's grade: the race's, or a URA Finals round's. */
  readonly grade: RaceGrade
  /** The rivals' handicap, when the round sets its own. */
  readonly handicap?: number
  /** The career's season the field is as strong as: the objective's, or the Finale (12). */
  readonly season: number
  /** The race's name in the seed: its id, or its id and the round's. */
  readonly seedKey: string
}

export interface RaceChoice {
  /** Her running style; her best by aptitude when not given. */
  readonly strategy?: Strategy
  /** The attempt's number: a retry is the next one. */
  readonly attempt: number
}

/** A race ready to run: the engine's input, and what names its runners. */
export interface PreparedRace {
  readonly kind: 'objective' | 'finale'
  readonly umaId: string
  readonly raceId: string
  readonly strategy: Strategy
  readonly attempt: number
  readonly seed: number
  readonly contentVersion: string
  /** Her gate. */
  readonly playerIndex: number
  /** Each gate's Uma. */
  readonly umaIds: readonly string[]
  readonly setup: RaceSetup
}

const rivalPools = new WeakMap<ReadonlyMap<string, SkillTemplate>, CompiledRaceSkill[]>()
function rivalSkillPool(skills: ReadonlyMap<string, SkillTemplate>): CompiledRaceSkill[] {
  let pool = rivalPools.get(skills)
  if (pool === undefined) {
    pool = selectRivalSkillPool([...skills.values()])
    rivalPools.set(skills, pool)
  }
  return pool
}

function supported(template: SkillTemplate | undefined): CompiledRaceSkill[] {
  if (template === undefined) return []
  const compiled = compileRaceSkill(template)
  return raceSkillSupported(compiled) ? [compiled] : []
}

/**
 * The skills she races with: her unique at level 5, then the skills she bought, only the highest of each chain (a gold
 * races in place of its white, D188), and only those this game's races can run.
 */
export function racingSkills(uniqueSkillId: string | null, bought: readonly string[], skills: ReadonlyMap<string, SkillTemplate>): CompiledRaceSkill[] {
  const below = new Set(bought.flatMap((id) => {
    const skill = skills.get(id)
    return skill === undefined ? [] : skillChainBelow(skill, skills).map((lower) => lower.id)
  }))
  const own = uniqueSkillId === null ? [] : supported(skills.get(uniqueSkillId)).map(levelUniqueSkill)
  return [...own, ...bought.filter((id) => id !== uniqueSkillId && !below.has(id)).flatMap((id) => supported(skills.get(id)))]
}

const shuffled = <T>(items: readonly T[], seed: number): T[] => {
  const result = [...items]
  const rng = raceRng(seed)
  for (let index = result.length - 1; index > 0; index -= 1) {
    const other = Math.floor(rng.next() * (index + 1))
    ;[result[index], result[other]] = [result[other]!, result[index]!]
  }
  return result
}

/** One Uma per character, never hers, in id order: the opponent pool. */
function opponentPool(player: UmaTemplate, umas: ReadonlyMap<string, UmaTemplate>): UmaTemplate[] {
  const byCharacter = new Map<string, UmaTemplate>()
  for (const uma of [...umas.values()].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))) {
    if (uma.charaId === player.charaId || byCharacter.has(uma.charaId)) continue
    byCharacter.set(uma.charaId, uma)
  }
  return [...byCharacter.values()]
}

/** The course as the engine reads it: the layout clipped to the race, its slopes, track, turn and grade. */
export function raceCourse(race: RaceTemplate, courses: ReadonlyMap<string, CourseTemplate>, grade: RaceGrade = race.grade): RaceSetup['course'] {
  const course = courses.get(race.courseId)
  if (course === undefined) throw new RangeError(`No course ${race.courseId}`)
  return {
    distance: race.distance,
    surface: race.surface,
    season: race.season,
    layout: { ...compileRaceCourseLayout(course, race.distance, race.direction, { frontTypes: true }), slopes: compileRaceCourseSlopes(course, race.distance) },
    trackId: /^\d+$/.test(course.trackId) ? Number(course.trackId) : 0,
    rotation: COURSE_ROTATION[race.direction],
    grade: RACE_GRADE_CODE[grade],
  }
}

/**
 * Prepares one of her career's races on her racing build as it stands. Throws on content that can't run it (her
 * template, the course, too few distinct rivals): a caller's bug, as the operations check the rules first.
 */
export function prepareCareerRace(
  career: CareerRecord,
  spec: RaceSpec,
  choice: RaceChoice,
  bonds: Readonly<Record<string, BondRecord>>,
  content: RaceContent,
  contentVersion: string,
): PreparedRace {
  const { race } = spec
  const uma = content.umas.get(career.umaId)
  if (uma === undefined) throw new RangeError(`No Uma ${career.umaId}`)
  if (!Number.isSafeInteger(choice.attempt) || choice.attempt < 0) throw new RangeError('An attempt is a whole number from 0')
  const strategy = choice.strategy ?? bestStrategy(uma)
  const build = deriveRacingBuild(career, uma, content.cards, bonds)
  const course = raceCourse(race, content.courses, spec.grade)
  const seed = raceAttemptSeed(career.startedAt, contentVersion, career.umaId, spec.seedKey, strategy, choice.attempt)
  const fieldSize = raceFieldSize(race)
  const opponents = shuffled(opponentPool(uma, content.umas), seed ^ 0x9e3779b9)
  if (opponents.length < fieldSize - 1) throw new RangeError(`${race.name} needs ${fieldSize - 1} rival characters`)
  const rng = raceRng(seed ^ 0x5bd1e995)
  const playerIndex = Math.floor(rng.next() * fieldSize)
  const skillRng = raceRng((seed ^ 0x2545f491) >>> 0)
  const pool = rivalSkillPool(content.skills)
  const slots = rollRivalFieldAt({
    T: career.T, grade: spec.grade, distance: race.distanceCategory, meters: race.distance, count: fieldSize - 1, rng,
    season: spec.season, ...(spec.handicap === undefined ? {} : { handicap: spec.handicap }),
  })
  const cast = castRivals(opponents, slots)
  const facts = { distance: race.distance, surface: race.surface, season: race.season }
  const umaIds: string[] = []
  let rival = 0
  const runners = Array.from({ length: fieldSize }, (_, gate): RaceSetupRunner => {
    if (gate === playerIndex) {
      umaIds.push(uma.id)
      return {
        id: uma.id, label: String(gate + 1), stats: { ...build.stats }, strategy, gate,
        aptitude: playerAptitude(build, race, strategy),
        skills: racingSkills(uma.uniqueSkillId, build.skills, content.skills),
      }
    }
    const slot = slots[rival]!
    const other = cast[rival++]!
    umaIds.push(other.id)
    return {
      id: other.id, label: String(gate + 1), stats: slot.stats, strategy: slot.strategy, gate,
      aptitude: { distance: 'A', surface: 'A', strategy: 'A' },
      skills: [
        ...supported(other.uniqueSkillId === null ? undefined : content.skills.get(other.uniqueSkillId)).map(levelUniqueSkill),
        ...rollRivalSkills(pool, { strategy: slot.strategy, course: facts, rng: skillRng }),
      ],
    }
  })
  return {
    kind: spec.kind, umaId: uma.id, raceId: race.id, strategy, attempt: choice.attempt, seed, contentVersion, playerIndex, umaIds,
    setup: { course, runners, seed },
  }
}

const playerAptitude = (build: RacingBuild, race: RaceTemplate, strategy: Strategy): RaceSetupRunner['aptitude'] => ({
  distance: build.aptitudes.distance[race.distanceCategory],
  surface: build.aptitudes.surface[race.surface],
  strategy: build.aptitudes.strategy[strategy],
})

/** A prepared race, run on the engine: the run as the result row keeps it, and her place. */
export function runPrepared(prepared: PreparedRace, engine: RaceEngine): { run: RaceRun; placement: number } {
  const finish: RaceFinish = engine.simulate(prepared.setup)
  const run = raceRunOf(prepared.setup, prepared.umaIds, prepared.playerIndex, prepared.strategy, prepared.contentVersion, engine.version, finish)
  const placement = run.field.find((runner) => runner.isPlayer)!.placement
  return { run, placement }
}

/** A race is won on a first-place finish. */
export const isWin = (placement: number): boolean => placement === 1

// --- Objectives ---------------------------------------------------------------------------------------------------

/** An objective's race against its grade's field, as strong as its season. */
export const objectiveSpec = (objective: Pick<CareerObjective, 'raceId' | 'season'>, race: RaceTemplate): RaceSpec =>
  ({ kind: 'objective', race, grade: race.grade, season: objective.season, seedKey: race.id })

/** Prepares an objective's race: her runner from her racing build, her chosen style (her best by default). */
export function prepareObjectiveRace(
  career: CareerRecord,
  objective: Pick<CareerObjective, 'raceId' | 'season'>,
  choice: RaceChoice,
  bonds: Readonly<Record<string, BondRecord>>,
  content: RaceContent & { readonly races: readonly RaceTemplate[] },
  contentVersion: string,
): PreparedRace {
  const race = content.races.find((entry) => entry.id === objective.raceId)
  if (race === undefined) throw new RangeError(`No race ${objective.raceId}`)
  return prepareCareerRace(career, objectiveSpec(objective, race), choice, bonds, content, contentVersion)
}

/** The career after one of its objectives ran: won on a first-place finish, unchanged otherwise (retries are free). */
export function settleRace(career: CareerRecord, raceId: string, placement: number, now: number): { career: CareerRecord; won: boolean } {
  const index = career.objectives.findIndex((objective) => objective.raceId === raceId)
  if (index < 0) throw new RangeError(`${raceId} isn't one of her objectives`)
  if (!isWin(placement) || career.objectives[index]!.status === 'won') return { career, won: false }
  const objectives = career.objectives.map((objective, i) => (i === index ? { ...objective, status: 'won' as const, wonAt: now } : objective))
  return { career: { ...career, objectives }, won: true }
}
