// Paying finished work (docs/game/07-farm.md §2 "Collect", §4; docs/game/05-training-hub.md §2 "Finishing";
// docs/game/02-check-ins-and-notifications.md §2, §9). Every finished item is paid once, oldest first: Farm items go
// into the Warehouse with their Farm EXP and every level crossed, a session's unlocks go through its kind (T128). Once
// everything is paid her slot is freed and her last work kept for Repeat. Nothing ready pays nothing and never refuses.
// The caller settles before and after.
import { addFarmExp } from '../farm/level'
import { highestOpenGrade } from '../items/grades'
import type { ItemGrade } from '../items/catalogue'
import { withUma } from '../tiers/ledger'
import { kindRules, type WorkEnv } from './kinds'
import { movements, sumInputs, withRow } from './state'
import { finishedCount } from './timeline'
import type { Entry, ItemMovement, SettleReport, WorkOutput, WorkState } from './types'

export interface CollectReceipt {
  readonly outfitId: string
  /** Every output paid, oldest first. */
  readonly outputs: readonly WorkOutput[]
  /** Farm EXP paid, in quarter points (07 §4). */
  readonly farmExp: number
  readonly farmLevel: { readonly from: number; readonly to: number }
  /** Grades her new Farm Level opened, for the check-in summary's "grade 2 open" (02 §4). */
  readonly gradesOpened: readonly ItemGrade[]
  /** What each kind's pay reported, oldest first (T128's openings). */
  readonly paid: readonly unknown[]
  /** True when everything was paid, so her slot and she are free (07 §5). */
  readonly freed: boolean
  readonly movements: readonly ItemMovement[]
  /** Queue starts and drops while the operation settled to its `now`. */
  readonly settled: SettleReport
}

export type PaidWork = Omit<CollectReceipt, 'settled'>

const nothing = (state: WorkState, outfitId: string): PaidWork => {
  const level = state.umas[outfitId]?.farm.level ?? 1
  return { outfitId, outputs: [], farmExp: 0, farmLevel: { from: level, to: level }, gradesOpened: [], paid: [], freed: false, movements: [] }
}

/**
 * Pays her finished items at `now`, on a settled state. `only` limits it to rows whose entries all pass (the race
 * start's collect takes sessions only, 01 §2).
 */
export function payWork<S extends WorkState>(state: S, outfitId: string, now: number, env: WorkEnv, only?: (entry: Entry) => boolean): { readonly state: S; readonly paid: PaidWork } {
  const row = state.work[outfitId]
  if (!row || row.entries.length === 0 || (only !== undefined && !row.entries.every(only))) return { state, paid: nothing(state, outfitId) }
  let next = state
  const outputs: WorkOutput[] = []
  const details: unknown[] = []
  let exp = 0
  const entries = row.entries.map((entry): Entry => {
    const made = Math.max(entry.collected, finishedCount(entry, now))
    if (made <= entry.collected) return entry
    const paying = entry.outputs.slice(entry.collected, made)
    const rules = kindRules(env, entry.request.kind)
    if (rules === undefined) throw new RangeError(`No rules pay ${entry.request.kind} work`)
    const result = rules.pay(next, outfitId, paying, { now, env })
    next = result.state
    if (result.detail !== undefined) details.push(result.detail)
    outputs.push(...paying)
    exp += entry.farmExp.slice(entry.collected, made).reduce((sum, quarters) => sum + quarters, 0)
    return { ...entry, collected: made }
  })
  if (outputs.length === 0) return { state, paid: nothing(state, outfitId) }

  const uma = next.umas[outfitId]
  if (!uma) throw new RangeError(`No Uma ${outfitId} for her work`)
  const farm = addFarmExp(uma.farm, exp)
  if (farm.exp !== uma.farm.exp) next = withUma(next, { ...uma, farm })
  const from = highestOpenGrade(uma.farm.level), to = highestOpenGrade(farm.level)
  const gradesOpened = Array.from({ length: to - from }, (_, i) => (from + i + 1) as ItemGrade)

  const unpaid = entries.filter((entry) => entry.collected < entry.seconds.length)
  const freed = unpaid.length === 0 && row.queue.length === 0
  const last = entries[entries.length - 1]!
  next = withRow(next, freed
    ? { ...row, slot: null, entries: [], last: { slot: row.slot!, request: last.request } }
    : { ...row, entries: unpaid.length > 0 ? unpaid : [last] })
  const items = sumInputs(outputs.flatMap((output) => ('item' in output ? [[{ item: output.item, qty: 1 }]] : [])))
  return {
    state: next,
    paid: {
      outfitId, outputs, farmExp: farm.exp - uma.farm.exp, farmLevel: { from: uma.farm.level, to: farm.level }, gradesOpened,
      paid: details, freed, movements: movements('output', items, outfitId, now),
    },
  }
}
