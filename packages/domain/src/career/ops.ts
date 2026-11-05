// The career's operations (docs/game/03-careers.md, D383): starting a career, racing an objective, the next season and
// the URA Finals. Each reads one career, refuses in plain words, and is idempotent by its id through `commitOperation`.
// A race runs inside its operation on the engine the env hands in (`env.race`): the device and the API each run the
// same seeded race and settle it alike, and the result is written as a `raceResults` row under the operation's id.
// `next-season` and `run-finale` name the season or round they mean, so a second tap can't skip one. Pure.
import { deriveRacingBuild } from '../build/racing-build'
import { isRowId } from '../save/kinds'
import { defineOperation, isRefusal, refuse, type AnyOperationDef, type Refusal } from '../save/registry'
import { FINALE_RACES, FINALE_SEASON, careerId as careerIdOf, type CareerRecord, type RaceResultRecord } from '../save/records'
import type { SaveState } from '../save/state'
import { LAST_SCENARIO_NUMBER } from '../tiers/map'
import { STRATEGIES, type Strategy } from '../types'
import type { CareerStage } from '../career-shapes'
import { seasonName } from './calendar'
import { FINALE_ROUNDS, FINALE_ROUND_NAMES, finaleRace, finaleSpec, settleFinale } from './finale'
import { prepareCareerRace, runPrepared, settleRace, objectiveSpec, type PreparedRace } from './races'
import { FINALE_REWARD, objectiveReward, payFinale, payObjective } from './rewards'
import { canAdvance, nextSeason } from './season'
import { startCareer } from './start'

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
/** Exactly these keys, and only these optional ones beside them. */
const keysAre = (value: Record<string, unknown>, keys: readonly string[], optional: readonly string[] = []): boolean =>
  keys.every((key) => Object.hasOwn(value, key)) && Object.keys(value).every((key) => keys.includes(key) || optional.includes(key))
const isStrategy = (value: unknown): value is Strategy => (STRATEGIES as readonly unknown[]).includes(value)
const isAttempt = (value: unknown): value is number => Number.isSafeInteger(value) && (value as number) >= 0 && (value as number) <= 1_000_000

/** The career an operation acts on, while it runs. */
function running(state: SaveState, id: string): CareerRecord | Refusal {
  const career = state.careers[id]
  if (career === undefined) return refuse('unknown-career', 'That career doesn\'t exist.')
  if (career.completedAt !== null) return refuse('career-complete', 'Her career is complete.')
  return career
}

const withCareer = (state: SaveState, id: string, career: CareerRecord): SaveState => ({ ...state, careers: { ...state.careers, [id]: career } })

const noEngine = (): Refusal => refuse('no-engine', 'Races can\'t run here: the race engine isn\'t loaded.')

/** Prepares a race, or refuses when the content can't run it. */
function prepare(make: () => PreparedRace): PreparedRace | Refusal {
  try {
    return make()
  } catch (error) {
    return refuse('race-unavailable', `That race can't run with this content (${error instanceof Error ? error.message : 'unknown'}).`)
  }
}

const resultRow = (id: string, prepared: PreparedRace, placement: number, run: RaceResultRecord['run'], now: number): RaceResultRecord =>
  ({ careerId: id, umaId: prepared.umaId, raceId: prepared.raceId, kind: prepared.kind, placement, run, at: now })

// --- start-career ---------------------------------------------------------------------------------------------------

export interface StartCareerInput {
  readonly umaId: string
  readonly T: number
}

export interface StartCareerReceipt {
  readonly careerId: string
  readonly objectives: readonly { readonly raceId: string; readonly stage: CareerStage; readonly season: number }[]
}

export const startCareerOp = defineOperation<StartCareerInput, StartCareerReceipt>({
  name: 'start-career',
  parse: (value) => {
    if (!isObject(value) || !keysAre(value, ['umaId', 'T']) || !isRowId(value.umaId)) return null
    if (!Number.isSafeInteger(value.T) || (value.T as number) < 1 || (value.T as number) > LAST_SCENARIO_NUMBER) return null
    return { umaId: value.umaId, T: value.T as number }
  },
  apply: (state, input, now, env) => {
    const career = startCareer(state, input.umaId, input.T, env.content.races, env.content.umas, now)
    if (isRefusal(career)) return career
    const id = careerIdOf(input.umaId, input.T)
    return {
      state: withCareer(state, id, career),
      receipt: { careerId: id, objectives: career.objectives.map(({ raceId, stage, season }) => ({ raceId, stage, season })) },
    }
  },
})

// --- run-race -------------------------------------------------------------------------------------------------------

export interface RunRaceInput {
  readonly careerId: string
  readonly raceId: string
  /** The attempt's number: 0 first, then one more each retry. */
  readonly attempt: number
  /** Her running style; her best by aptitude when absent. */
  readonly strategy?: Strategy
}

export interface RaceReward {
  readonly cardTickets: number
  readonly umaTickets: number
  readonly sp: number
}

export interface RunRaceReceipt {
  readonly careerId: string
  readonly raceId: string
  readonly attempt: number
  readonly strategy: Strategy
  readonly placement: number
  readonly won: boolean
  /** What the win paid; null on a loss. */
  readonly reward: RaceReward | null
  /** Whether Next season is open after it. */
  readonly canAdvance: boolean
}

const parseRaceInput = (value: unknown): RunRaceInput | null => {
  if (!isObject(value) || !keysAre(value, ['careerId', 'raceId', 'attempt'], ['strategy'])) return null
  if (!isRowId(value.careerId) || !isRowId(value.raceId) || !isAttempt(value.attempt)) return null
  if (value.strategy !== undefined && !isStrategy(value.strategy)) return null
  return { careerId: value.careerId, raceId: value.raceId, attempt: value.attempt, ...(value.strategy === undefined ? {} : { strategy: value.strategy }) }
}

export const runRaceOp = defineOperation<RunRaceInput, RunRaceReceipt>({
  name: 'run-race',
  parse: parseRaceInput,
  apply: (state, input, now, env) => {
    const career = running(state, input.careerId)
    if (isRefusal(career)) return career
    if (career.season === FINALE_SEASON) return refuse('at-finale', 'She is at the Finale: the URA Finals run from there.')
    const objective = career.objectives.find((entry) => entry.raceId === input.raceId)
    const race = env.content.races.find((entry) => entry.id === input.raceId)
    if (objective === undefined) return refuse('not-an-objective', `${race?.name ?? 'That race'} isn't one of her objectives.`)
    if (race === undefined) return refuse('unknown-race', 'That race isn\'t in the game.')
    if (objective.status === 'won') return refuse('already-won', `She has already won the ${race.name}.`)
    if (objective.season !== career.season) {
      return refuse('not-this-season', `The ${race.name} is in ${seasonName(objective.season)}; she is in ${seasonName(career.season)}.`)
    }
    if (env.race === undefined) return noEngine()
    const prepared = prepare(() => prepareCareerRace(career, objectiveSpec(objective, race), input, state.bonds, env.content, env.contentVersion))
    if (isRefusal(prepared)) return prepared
    const { run, placement } = runPrepared(prepared, env.race)
    const settled = settleRace(career, race.id, placement, now)
    let next: SaveState = withCareer(state, input.careerId, settled.career)
    let reward: RaceReward | null = null
    if (settled.won) {
      const paid = objectiveReward(objective.stage, career.deck, env.content.cards)
      const after = payObjective(state.account, settled.career, paid)
      next = { ...withCareer(next, input.careerId, after.career), account: after.account }
      reward = { cardTickets: paid.cardTickets, umaTickets: 0, sp: paid.sp }
    }
    return {
      state: next,
      receipt: {
        careerId: input.careerId, raceId: race.id, attempt: input.attempt, strategy: prepared.strategy, placement, won: settled.won, reward,
        canAdvance: canAdvance(next.careers[input.careerId]!),
      },
      raceResults: [resultRow(input.careerId, prepared, placement, run, now)],
    }
  },
})

// --- next-season ----------------------------------------------------------------------------------------------------

export interface NextSeasonInput {
  readonly careerId: string
  /** The season she is leaving. */
  readonly season: number
}

export interface NextSeasonReceipt {
  readonly careerId: string
  readonly season: number
}

export const nextSeasonOp = defineOperation<NextSeasonInput, NextSeasonReceipt>({
  name: 'next-season',
  parse: (value) => {
    if (!isObject(value) || !keysAre(value, ['careerId', 'season']) || !isRowId(value.careerId)) return null
    if (!Number.isSafeInteger(value.season) || (value.season as number) < 0 || (value.season as number) > FINALE_SEASON) return null
    return { careerId: value.careerId, season: value.season as number }
  },
  apply: (state, input) => {
    const career = running(state, input.careerId)
    if (isRefusal(career)) return career
    if (career.season !== input.season) return refuse('season-moved', `${seasonName(input.season)} has already ended.`)
    const next = nextSeason(career)
    if (isRefusal(next)) return next
    return { state: withCareer(state, input.careerId, next), receipt: { careerId: input.careerId, season: next.season } }
  },
})

// --- run-finale -----------------------------------------------------------------------------------------------------

export interface RunFinaleInput {
  readonly careerId: string
  /** The round she means: 0 qualifier, 1 semifinal, 2 final. */
  readonly round: number
  readonly attempt: number
  readonly strategy?: Strategy
}

export interface RunFinaleReceipt {
  readonly careerId: string
  readonly round: number
  readonly raceId: string
  readonly attempt: number
  readonly strategy: Strategy
  readonly placement: number
  readonly won: boolean
  /** Whether this win completed her career. */
  readonly completed: boolean
  readonly reward: RaceReward | null
}

export const runFinaleOp = defineOperation<RunFinaleInput, RunFinaleReceipt>({
  name: 'run-finale',
  parse: (value) => {
    if (!isObject(value) || !keysAre(value, ['careerId', 'round', 'attempt'], ['strategy'])) return null
    if (!isRowId(value.careerId) || !Number.isSafeInteger(value.round) || (value.round as number) < 0 || (value.round as number) >= FINALE_RACES) return null
    if (!isAttempt(value.attempt) || (value.strategy !== undefined && !isStrategy(value.strategy))) return null
    return {
      careerId: value.careerId, round: value.round as number, attempt: value.attempt,
      ...(value.strategy === undefined ? {} : { strategy: value.strategy }),
    }
  },
  apply: (state, input, now, env) => {
    const career = running(state, input.careerId)
    if (isRefusal(career)) return career
    if (career.season !== FINALE_SEASON) return refuse('not-at-finale', 'The URA Finals open after Senior Winter.')
    const roundName = FINALE_ROUND_NAMES[FINALE_ROUNDS[input.round]!]
    if (input.round < career.finale.step) return refuse('round-won', `She has already won the ${roundName}.`)
    if (input.round > career.finale.step) {
      return refuse('round-closed', `Win the ${FINALE_ROUND_NAMES[FINALE_ROUNDS[career.finale.step]!]} first.`)
    }
    const uma = env.content.umas.get(career.umaId)
    if (uma === undefined) return refuse('unknown-uma', 'That Uma isn\'t in the game.')
    if (env.race === undefined) return noEngine()
    const engine = env.race
    const prepared = prepare(() => prepareCareerRace(career, finaleSpec(finaleRace(uma, career, env.content.races), input.round), input,
      state.bonds, env.content, env.contentVersion))
    if (isRefusal(prepared)) return prepared
    const { run, placement } = runPrepared(prepared, engine)
    const build = deriveRacingBuild(career, uma, env.content.cards, state.bonds)
    const settled = settleFinale(career, placement, now, build)
    let next = withCareer(state, input.careerId, settled.career)
    if (settled.completed) next = { ...next, account: payFinale(state.account) }
    return {
      state: next,
      receipt: {
        careerId: input.careerId, round: input.round, raceId: prepared.raceId, attempt: input.attempt, strategy: prepared.strategy, placement,
        won: settled.won, completed: settled.completed,
        reward: settled.completed ? { umaTickets: FINALE_REWARD.umaTickets, cardTickets: FINALE_REWARD.cardTickets, sp: 0 } : null,
      },
      raceResults: [resultRow(input.careerId, prepared, placement, run, now)],
    }
  },
})

export const CAREER_OPERATIONS: readonly AnyOperationDef[] = [startCareerOp, runRaceOp, nextSeasonOp, runFinaleOp]
