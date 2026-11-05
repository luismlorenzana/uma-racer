// Settling a play (docs/game/07-stages.md §3, D384; 02 §5): the domain, not the view, grades a stage. A journal is
// replayed from its seed through its game's rules, move by move; a finished replay is reported, graded and paid. The
// device, the API, the sims and the tests all run this one function. Pure.
import { stagePay } from '../career/pay'
import { STATS, zeroStats, type Stats } from '../types'
import type { Journal, StageKind, StageReport, StageRules } from './contract'
import { grade, payMultiplier, type StageGrade } from './grade'

/** Why a journal can't be replayed or settled. `move` is the index of the move that failed. */
export interface ReplayFailure {
  readonly failed: 'kind' | 'version' | 'too-long' | 'illegal' | 'unfinished'
  readonly move?: number
}

export const isReplayFailure = (value: unknown): value is ReplayFailure =>
  typeof value === 'object' && value !== null && typeof (value as { failed?: unknown }).failed === 'string'

/** What a settled play pays into the career's wallet. */
export interface StageAward {
  readonly drills: Stats
  readonly bond: number
  readonly sp: number
}

export interface Settled {
  readonly grade: StageGrade
  readonly report: StageReport
  readonly pay: StageAward
}

export const NO_AWARD: StageAward = Object.freeze({ drills: Object.freeze(zeroStats()), bond: 0, sp: 0 })

/**
 * The state a journal reaches: its config through `init`, then every move through `step`. A move is refused when its
 * tick isn't its index, when the play was already done, or when the rules call it illegal. An unfinished play replays
 * (that is how a closed stage resumes); only `settle` needs it done.
 */
export function replay<S>(journal: Journal, rules: StageRules<S>): S | ReplayFailure {
  if (journal.config.kind !== rules.kind) return { failed: 'kind' }
  if (journal.version !== rules.version) return { failed: 'version' }
  if (journal.inputs.length > rules.maxInputs) return { failed: 'too-long' }
  let state = rules.init(journal.config)
  for (let move = 0; move < journal.inputs.length; move += 1) {
    const input = journal.inputs[move]!
    if (input.tick !== move || rules.done(state)) return { failed: 'illegal', move }
    const next = rules.step(state, input)
    if (next === null) return { failed: 'illegal', move }
    state = next
  }
  return state
}

/** `total` split across the colours in proportion to `weights`, by largest remainder (ties to the earlier colour). */
export function splitDrills(total: number, weights: Stats): Stats {
  const raw = STATS.map((stat) => Math.max(0, Math.round(weights[stat])))
  const sum = raw.reduce((a, b) => a + b, 0)
  const out = zeroStats()
  if (total <= 0 || sum === 0) return out
  const floors = raw.map((weight) => Math.floor((total * weight) / sum))
  let left = total - floors.reduce((a, b) => a + b, 0)
  const order = raw.map((weight, i) => ({ i, rest: (total * weight) % sum })).sort((a, b) => b.rest - a.rest || a.i - b.i)
  for (const { i } of order) {
    if (left <= 0) break
    floors[i]! += 1
    left -= 1
  }
  STATS.forEach((stat, i) => { out[stat] = floors[i]! })
  return out
}

/** A grade's pay: the game's pay at A × the grade's multiplier, drills split by the report, plus its bonus SP. */
export function stageAward(kind: StageKind, of: StageGrade, report: StageReport, practice: boolean): StageAward {
  if (practice) return NO_AWARD
  const pay = stagePay(kind, payMultiplier(of))
  return {
    drills: report.drills === undefined ? zeroStats() : splitDrills(pay.drills, report.drills),
    bond: pay.bond,
    sp: pay.sp + Math.max(0, Math.round(report.bonusSp ?? 0)),
  }
}

/** Replays a finished journal and settles it: its grade, its report and its pay (nothing in practice). */
export function settle<S>(journal: Journal, rules: StageRules<S>): Settled | ReplayFailure {
  const state = replay(journal, rules)
  if (isReplayFailure(state)) return state
  if (!rules.done(state)) return { failed: 'unfinished', move: journal.inputs.length }
  const report = rules.report(state)
  const of = grade(report.p, report.tasks)
  return { grade: of, report, pay: stageAward(journal.config.kind, of, report, journal.config.practice) }
}
