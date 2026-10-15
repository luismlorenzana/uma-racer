// A race on generation 2 (T141 "The race commit"; docs/rework/09-racing-rewards-and-exchange.md §8–§9;
// docs/design/racing.md): today's `buildPreparedRace`, fed from the rework state. On a copy of the state her session's
// finished unlocks are collected first (01 §2), so she races with every unlock she has earned; then stats, aptitudes
// and loadout come from `deriveUmaPreset` on the preset of the race's distance (D254), rivals from `rollRivalFieldAt`
// at her T and the race's grade, and the seed from `raceAttemptSeed` with n her number of results so far. The field's
// draw is today's, step for step: opponents, the player's gate, the rivals' styles and stats, then their skills.
// Engine v9 runs it; the committed `raceResults` row keeps the run, and `replayOf` rebuilds the same input from it.
import {
  COURSE_ROTATION, RACE_GRADE_CODE, affordableLoadout, castRivals, compileRaceCourseLayout, compileRaceCourseSlopes,
  compileRaceSkill, levelUniqueSkill, progressionFieldSize, raceAttemptSeed, raceSkillSupported, rollRivalSkills,
  selectRivalSkillPool, summarizeSkillLoadout,
  type CompiledRaceSkill, type DistanceCategory, type RaceResultRunner, type RaceRun, type RaceTemplate, type SkillTemplate,
  type Stats, type Strategy, type UmaTemplate,
} from '@racer/domain'
import type { OperationEnv } from '@racer/domain/rework/check-in'
import { rollRivalFieldAt, scenarioNumber, type ScenarioAt } from '@racer/domain/rework/tiers'
import { deriveUmaPreset, type DerivedBuild } from '@racer/domain/rework/training'
import { collectBeforeRace, type WorkState } from '@racer/domain/rework/work'
import { createRng, simulateRace, type RaceInput, type RaceTimeline } from '@racer/race'
import type { LoadedContent } from '../../content/runtime'
import { accomplishmentFactsFromTimeline } from './race-facts'

/** One runner as the scene, the feed and the result name her. */
export interface RaceRunner {
  readonly templateId: string
  readonly isPlayer: boolean
}

/** What plays: the engine's input, her gate's index and the field by gate. A prepared race and a replay both are one. */
export interface RaceReplay {
  readonly umaId: string
  readonly raceId: string
  readonly strategy: Strategy
  readonly playerIndex: number
  readonly input: RaceInput
  readonly runners: readonly RaceRunner[]
}

export interface PreparedRace extends RaceReplay {
  readonly engineVersion: 9
  readonly contentVersion: string
  /** Her results before this one: the seed's n. */
  readonly sequence: number
  readonly seed: number
  /** Her scenario: the one she races as (03 §6, §12). */
  readonly at: ScenarioAt
  /** The preset of the race's distance (D254). */
  readonly preset: DistanceCategory
  readonly startStats: Stats
  /** The preset's summed card Race Bonus (06 §4). */
  readonly raceBonus: number
  /** Her derived preset as she races it, after the collect. */
  readonly derived: DerivedBuild
  /** Finished unlocks her session hands over first (01 §2): "Collects 2 finished unlocks first". */
  readonly collects: number
}

export interface PrepareInput {
  readonly state: WorkState
  readonly env: OperationEnv
  readonly content: LoadedContent
  readonly now: number
  readonly umaId: string
  readonly raceId: string
  readonly strategy: Strategy
  /** Her number of results so far. */
  readonly sequence: number
}

const shuffled = <T,>(items: readonly T[], seed: number): T[] => {
  const result = [...items]
  const rng = createRng(seed)
  for (let index = result.length - 1; index > 0; index -= 1) {
    const selected = Math.floor(rng.next() * (index + 1))
    const value = result[index]!
    result[index] = result[selected]!
    result[selected] = value
  }
  return result
}

/** One Uma per character, never hers, in id order: today's opponent pool. */
function uniqueOpponentPool(player: UmaTemplate, umas: readonly UmaTemplate[]): UmaTemplate[] {
  const byCharacter = new Map<string, UmaTemplate>()
  for (const template of [...umas].sort((left, right) => left.id.localeCompare(right.id))) {
    if (template.charaId === player.charaId || byCharacter.has(template.charaId)) continue
    byCharacter.set(template.charaId, template)
  }
  return [...byCharacter.values()]
}

function compiledSupported(template: SkillTemplate | undefined): CompiledRaceSkill[] {
  if (!template) return []
  const compiled = compileRaceSkill(template)
  return raceSkillSupported(compiled) ? [compiled] : []
}

const rivalPools = new WeakMap<readonly SkillTemplate[], CompiledRaceSkill[]>()
function rivalSkillPool(content: LoadedContent): CompiledRaceSkill[] {
  let pool = rivalPools.get(content.skills.items)
  if (!pool) {
    pool = selectRivalSkillPool(content.skills.items)
    rivalPools.set(content.skills.items, pool)
  }
  return pool
}

/**
 * Her skills for the race: her unique at Lv 5, then her equipped loadout as far as her SP pays for it (today's rule,
 * D188, D196). A skill the content can't race is left out rather than blocking the race: Start race is always enabled.
 */
export function playerRaceSkills(content: LoadedContent, derived: DerivedBuild, template: UmaTemplate): CompiledRaceSkill[] {
  const own = template.uniqueSkillId ? compiledSupported(content.skills.byId.get(template.uniqueSkillId)).map(levelUniqueSkill) : []
  const raceable = derived.loadoutSkillIds.filter((id) => {
    if (id === template.uniqueSkillId) return false
    const skill = content.skills.byId.get(id)
    return skill !== undefined && Number.isSafeInteger(skill.costSp) && (skill.costSp ?? 0) > 0 && raceSkillSupported(compileRaceSkill(skill))
  })
  const summary = summarizeSkillLoadout({ ...derived, skillPoints: Number.MAX_SAFE_INTEGER }, template, content.skills.byId, raceable)
  const equipped = affordableLoadout(summary.entries, derived.skillPoints).map((skill) => compileRaceSkill(skill))
  return [...own, ...equipped.filter(raceSkillSupported)]
}

/** The race of `raceId` in the content; a missing one is a stale link and throws. */
export function raceOf(content: LoadedContent, raceId: string): RaceTemplate {
  const race = content.races.byId.get(raceId)
  if (!race) throw new Error(`No race ${raceId}`)
  return race
}

/** Today's `buildPreparedRace` on the rework state (T141 "Prepare"). Pure: the same state, race, strategy and n give the same race. */
export function prepareRace(input: PrepareInput): PreparedRace {
  const { content, env, umaId, strategy, sequence } = input
  const race = raceOf(content, input.raceId)
  const collected = collectBeforeRace(input.state, umaId, input.now, env)
  const uma = collected.state.umas[umaId]
  if (!uma) throw new Error(`No Uma ${umaId}`)
  const template = content.umas.byId.get(umaId)
  if (!template) throw new Error(`No Uma template ${umaId}`)
  const course = content.courses.byId.get(race.courseId)
  if (!course) throw new Error(`No course ${race.courseId}`)
  const preset = race.distanceCategory
  const derived = deriveUmaPreset(uma, preset, env.content)
  const at: ScenarioAt = { tier: uma.tier, scenario: uma.scenario }
  const layout = {
    ...compileRaceCourseLayout(course, race.distance, race.direction, { frontTypes: true }),
    slopes: compileRaceCourseSlopes(course, race.distance),
  }
  const seed = raceAttemptSeed(collected.state.profile.createdAt, content.manifest.version, umaId, race.id, strategy, sequence)
  const fieldSize = progressionFieldSize(race)
  const opponents = shuffled(uniqueOpponentPool(template, content.umas.items), seed ^ 0x9e3779b9)
  if (opponents.length < fieldSize - 1) throw new Error(`${race.name} needs ${fieldSize - 1} distinct opponent characters`)
  const rng = createRng(seed ^ 0x5bd1e995)
  const playerGate = Math.floor(rng.next() * fieldSize)
  const playerSkills = playerRaceSkills(content, derived, template)
  const skillRng = createRng((seed ^ 0x2545f491) >>> 0)
  const pool = rivalSkillPool(content)
  const slots = rollRivalFieldAt({ T: scenarioNumber(at), grade: race.grade, distance: race.distanceCategory, meters: race.distance, count: fieldSize - 1, rng })
  const cast = castRivals(opponents, slots)
  let rivalIndex = 0
  const runners = Array.from({ length: fieldSize }, (_, gate) => {
    if (gate === playerGate) {
      return {
        display: { templateId: template.id, isPlayer: true },
        engine: {
          id: template.id, label: String(gate + 1), stats: { ...derived.stats }, strategy, gate, skills: playerSkills,
          aptitude: {
            distance: derived.aptitudes.distance[race.distanceCategory],
            surface: derived.aptitudes.surface[race.surface],
            strategy: derived.aptitudes.strategy[strategy],
          },
        },
      }
    }
    const slot = slots[rivalIndex]!
    const rival = cast[rivalIndex++]!
    return {
      display: { templateId: rival.id, isPlayer: false },
      engine: {
        id: rival.id, label: String(gate + 1), stats: slot.stats, strategy: slot.strategy, gate,
        aptitude: { distance: 'A', surface: 'A', strategy: 'A' } as const,
        skills: [
          ...compiledSupported(content.skills.byId.get(rival.uniqueSkillId ?? '')).map(levelUniqueSkill),
          ...rollRivalSkills(pool, { strategy: slot.strategy, course: { distance: race.distance, surface: race.surface, season: race.season }, rng: skillRng }),
        ],
      },
    }
  })
  const collects = collected.receipt.outputs.filter((output) => 'unlock' in output).length
  return {
    engineVersion: 9,
    contentVersion: content.manifest.version,
    umaId,
    raceId: race.id,
    sequence,
    seed,
    strategy,
    at,
    preset,
    startStats: { ...derived.stats },
    raceBonus: derived.raceBonus,
    derived,
    collects,
    playerIndex: playerGate,
    input: {
      course: {
        distance: race.distance,
        surface: race.surface,
        season: race.season,
        layout,
        trackId: /^\d+$/.test(course.trackId) ? Number(course.trackId) : 0,
        rotation: COURSE_ROTATION[race.direction],
        grade: RACE_GRADE_CODE[race.grade],
      },
      runners: runners.map((runner) => runner.engine),
      seed,
    },
    runners: runners.map((runner) => runner.display),
  }
}

/** Engine v9: the web replays nothing older (T141 "Decided here"). */
export const simulate = (replay: RaceReplay): RaceTimeline => simulateRace(replay.input)

/** Her place in the timeline. */
export function placementOf(replay: RaceReplay, timeline: RaceTimeline): number {
  const result = timeline.results.find((entry) => entry.runner === replay.playerIndex)
  if (!result) throw new Error('The race has no result for her')
  return result.placement
}

/**
 * The race as it ran, for `finish-race`'s `run` (T134): today's record without its progression fields. The field is
 * in finishing order with each runner's gate, stats and skills, so a replay rebuilds the same input.
 */
export function raceRunOf(content: LoadedContent, attempt: PreparedRace, timeline: RaceTimeline): RaceRun {
  const race = raceOf(content, attempt.raceId)
  const player = attempt.input.runners[attempt.playerIndex]!
  const inheritedUniqueSkillIds = new Set((player.skills ?? [])
    .filter((skill) => skill.inherited && content.skills.byId.get(skill.id)?.kind === 'inherited-unique')
    .map((skill) => skill.id))
  const field: RaceResultRunner[] = timeline.results.map((result) => {
    const runner = attempt.input.runners[result.runner]
    const display = attempt.runners[result.runner]
    if (!runner || !display) throw new Error('The result names an unknown runner')
    return {
      umaId: display.templateId, isPlayer: display.isPlayer, strategy: runner.strategy, gate: runner.gate,
      stats: { ...runner.stats }, aptitude: { ...runner.aptitude }, placement: result.placement, finishTime: result.finishTime,
      marginLengths: result.marginLengths, skills: [...(runner.skills ?? [])],
    }
  }).sort((left, right) => left.placement - right.placement)
  return {
    engineVersion: 9,
    course: { ...attempt.input.course, season: attempt.input.course.season ?? 0 },
    contentVersion: attempt.contentVersion,
    seed: attempt.seed,
    strategy: attempt.strategy,
    startStats: { ...attempt.startStats },
    field,
    accomplishmentFacts: accomplishmentFactsFromTimeline({
      race, timeline, playerIndex: attempt.playerIndex, gates: attempt.input.runners.map((runner) => runner.gate), inheritedUniqueSkillIds,
    }),
  }
}

/** A committed row's race, rebuilt from its run alone (today's `preparedRaceFromRecord`): what `?result=` plays. */
export function replayOf(row: { readonly umaId: string; readonly raceId: string; readonly run: RaceRun }): RaceReplay {
  const byGate = [...row.run.field].sort((left, right) => left.gate - right.gate)
  const playerIndex = byGate.findIndex((runner) => runner.isPlayer)
  if (playerIndex < 0) throw new Error('The race has no player')
  const course = row.run.course
  if (course === undefined) throw new Error('The race has no course')
  return {
    umaId: row.umaId,
    raceId: row.raceId,
    strategy: row.run.strategy,
    playerIndex,
    input: {
      course: { ...course },
      runners: byGate.map((runner) => ({
        id: runner.umaId, label: String(runner.gate + 1), stats: { ...runner.stats }, strategy: runner.strategy,
        aptitude: { ...runner.aptitude }, gate: runner.gate, ...(runner.skills ? { skills: [...runner.skills] } : {}),
      })),
      seed: row.run.seed,
    },
    runners: byGate.map((runner) => ({ templateId: runner.umaId, isPlayer: runner.isPlayer })),
  }
}
