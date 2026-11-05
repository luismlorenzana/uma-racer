// The stages' operation (docs/game/07-stages.md §3, D384): `settle-stage` carries a finished play's seed and moves, never
// its result. The device and the API each build the play's config from the career as it stands, replay the moves through
// the game's rules, grade the report and pay the grade into the career's wallet, so both settle alike. Practice is
// graded and pays nothing. A journal on another rules version, one whose replay breaks or stops short, or one for a
// game that isn't built is refused in plain words. Pure.
import { isRowId } from '../save/kinds'
import { defineOperation, isRefusal, refuse, type AnyOperationDef } from '../save/registry'
import type { CareerRecord } from '../save/records'
import { STATS, type Stats } from '../types'
import { careerStageConfig } from './config'
import { isStageKind, STAGE_NAMES, type StageInput, type StageKind } from './contract'
import type { StageGrade } from './grade'
import { stageRules } from './registry'
import { isStageSeed } from './rng'
import { isReplayFailure, settle, type ReplayFailure, type StageAward } from './settle'

/** The most moves a journal may carry on the wire, whatever its game: well under the 512 KB input bound. */
export const MAX_STAGE_INPUTS = 2_000
/** A move's numbers stay within this. */
const MAX_MOVE_NUMBER = 1_000_000

export interface SettleStageInput {
  readonly careerId: string
  readonly kind: StageKind
  readonly seed: number
  /** The rules' version the play ran on. */
  readonly version: number
  readonly inputs: readonly StageInput[]
  readonly practice: boolean
}

export interface SettleStageReceipt {
  readonly careerId: string
  readonly kind: StageKind
  readonly seed: number
  readonly practice: boolean
  /** The season she played it in. */
  readonly season: number
  readonly grade: StageGrade
  readonly p: number
  readonly score: number
  readonly tasks: readonly boolean[]
  /** What it paid into the wallet: nothing in practice. */
  readonly pay: StageAward
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
const keysAre = (value: Record<string, unknown>, keys: readonly string[], optional: readonly string[] = []): boolean =>
  keys.every((key) => Object.hasOwn(value, key)) && Object.keys(value).every((key) => keys.includes(key) || optional.includes(key))
const isWhole = (value: unknown, min: number, max: number): value is number =>
  Number.isSafeInteger(value) && (value as number) >= min && (value as number) <= max

function parseMove(value: unknown): StageInput | null {
  if (!isObject(value) || !keysAre(value, ['tick', 'code'], ['x', 'y'])) return null
  if (!isWhole(value.tick, 0, MAX_STAGE_INPUTS) || !isWhole(value.code, 0, 255)) return null
  const coord = (n: unknown) => n === undefined || isWhole(n, -MAX_MOVE_NUMBER, MAX_MOVE_NUMBER)
  if (!coord(value.x) || !coord(value.y)) return null
  return {
    tick: value.tick, code: value.code,
    ...(value.x === undefined ? {} : { x: value.x as number }), ...(value.y === undefined ? {} : { y: value.y as number }),
  }
}

export function parseSettleStageInput(value: unknown): SettleStageInput | null {
  if (!isObject(value) || !keysAre(value, ['careerId', 'kind', 'seed', 'version', 'inputs', 'practice'])) return null
  if (!isRowId(value.careerId) || !isStageKind(value.kind) || !isStageSeed(value.seed) || !isWhole(value.version, 1, 10_000)) return null
  if (typeof value.practice !== 'boolean' || !Array.isArray(value.inputs) || value.inputs.length > MAX_STAGE_INPUTS) return null
  const inputs = value.inputs.map(parseMove)
  if (inputs.some((input) => input === null)) return null
  return { careerId: value.careerId, kind: value.kind, seed: value.seed, version: value.version, inputs: inputs as StageInput[], practice: value.practice }
}

/** A replay's failure, in plain words. */
export function replayWords(kind: StageKind, failure: ReplayFailure, version: number): string {
  const name = STAGE_NAMES[kind]
  switch (failure.failed) {
    case 'version': return `That play of ${name} ran on other rules (version ${version}), so it can't be settled.`
    case 'too-long': return `That play of ${name} holds more moves than a play can, so it can't be settled.`
    case 'illegal': return `Move ${(failure.move ?? 0) + 1} of that play isn't legal in ${name}, so it can't be settled.`
    case 'unfinished': return `That play of ${name} isn't finished: it stops after ${failure.move ?? 0} moves.`
    default: return `That play isn't one of ${name}'s, so it can't be settled.`
  }
}

const addStats = (a: Stats, b: Stats): Stats => Object.fromEntries(STATS.map((stat) => [stat, a[stat] + b[stat]])) as unknown as Stats

/** The career with a play's pay in its wallet. */
export const payStage = (career: CareerRecord, pay: StageAward): CareerRecord => ({
  ...career,
  wallet: { drills: addStats(career.wallet.drills, pay.drills), bond: career.wallet.bond + pay.bond, sp: career.wallet.sp + pay.sp },
})

export const settleStageOp = defineOperation<SettleStageInput, SettleStageReceipt>({
  name: 'settle-stage',
  parse: parseSettleStageInput,
  apply: (state, input, _now, env) => {
    const rules = stageRules(input.kind)
    if (rules === null) return refuse('stage-not-built', `${STAGE_NAMES[input.kind]} isn't built yet.`)
    if (input.version !== rules.version) return refuse('stage-version', replayWords(input.kind, { failed: 'version' }, input.version))
    const career = state.careers[input.careerId]
    if (career === undefined) return refuse('unknown-career', 'That career doesn\'t exist.')
    if (!input.practice && career.completedAt !== null) return refuse('career-complete', 'Her career is complete: its stages are practice now.')
    const config = careerStageConfig(career, state.bonds, env.content, input.kind, input.seed, input.practice)
    if (isRefusal(config)) return config
    const settled = settle({ config, version: input.version, inputs: input.inputs }, rules)
    if (isReplayFailure(settled)) {
      return refuse(`stage-${settled.failed}`, replayWords(input.kind, settled, input.version), settled.move === undefined ? undefined : { move: settled.move })
    }
    const receipt: SettleStageReceipt = {
      careerId: input.careerId, kind: input.kind, seed: input.seed, practice: input.practice, season: career.season,
      grade: settled.grade, p: settled.report.p, score: settled.report.score, tasks: settled.report.tasks, pay: settled.pay,
    }
    if (input.practice) return { state, receipt }
    return { state: { ...state, careers: { ...state.careers, [input.careerId]: payStage(career, settled.pay) } }, receipt }
  },
})

export const STAGE_OPERATIONS: readonly AnyOperationDef[] = [settleStageOp]
