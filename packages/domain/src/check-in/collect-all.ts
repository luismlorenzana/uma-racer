// Collect all (docs/rework/02-check-ins-and-notifications.md §2, §9; docs/rework/07-farm.md §9): one operation claims
// every finished item and unlock across the roster. It settles, then runs T127's `collect` on every slot with something
// finished, in building, room and slot order, so queues advance as if each entry had started on time. Each slot gets a
// line: what came in, Farm EXP, levels crossed and grades opened. A slot the screen showed with nothing ready (the other
// device collected it) reads "Already collected."; a slot that fails keeps its reason and never stops the rest. It never
// starts, buys, sells or spends a Speed Ticket: restarting is Repeat.
import { raiseExchangeGrade } from '../economy/exchange'
import type { BuildingId } from '../farm/buildings'
import { itemById, type ItemGrade } from '../items/catalogue'
import type { RecipeInput } from '../items/recipes'
import { assertNow } from '../tiers/ledger'
import { isFree } from '../work/activity'
import type { CollectReceipt } from '../work/collect'
import type { WorkEnv } from '../work/kinds'
import { collect } from '../work/operations'
import { joinSettles, settle } from '../work/settle'
import { sameSlot, slotHolder, slotOrder, sumInputs } from '../work/state'
import { finishedCount } from '../work/timeline'
import type { ItemMovement, SettleReport, SlotRef, UnlockRef, WorkRow, WorkState } from '../work/types'
import { CHECK_IN_WORDS, say, type Words } from './words'

export interface CollectAllInput {
  /** Only these places: a place page's own Collect (02 §2). Every place when absent. */
  readonly places?: readonly BuildingId[]
  /** The slots the screen showed as ready; one with nothing ready now reads "Already collected." (02 §9). */
  readonly shown?: readonly SlotRef[]
}

export type CollectLineStatus = 'collected' | 'already-collected' | 'failed'

/** One slot's line (07 §9). */
export interface CollectAllLine {
  /** Whose work it was; null for a shown slot nobody holds now. */
  readonly outfitId: string | null
  readonly slot: SlotRef
  readonly status: CollectLineStatus
  /** Farm items in, summed by item. */
  readonly items: readonly RecipeInput[]
  /** A session's unlocks committed. */
  readonly unlocks: readonly UnlockRef[]
  /** Farm EXP paid, in quarter points (07 §4). */
  readonly farmExp: number
  readonly farmLevel: { readonly from: number; readonly to: number }
  readonly gradesOpened: readonly ItemGrade[]
  /** True when her slot and she are free. */
  readonly freed: boolean
  /** When each collected entry a queue started had started: the summary's "queues moved on". */
  readonly queueStarts: readonly number[]
  /** "Already collected." or "That didn't work. Try again."; null for a collected line. */
  readonly words: Words | null
}

export interface CollectAllTotals {
  /** Raw and crafted items. */
  readonly items: number
  readonly dishes: number
  readonly unlocks: number
  /** Farm EXP in quarter points. */
  readonly farmExp: number
  /** Farm Levels crossed, all Umas together. */
  readonly levelUps: number
}

export interface CollectAllReceipt {
  /** One line per slot, in building, room and slot order. */
  readonly lines: readonly CollectAllLine[]
  readonly totals: CollectAllTotals
  /** T127's receipt for each slot collected, in order, for phase 3's ledgers. */
  readonly collected: readonly CollectReceipt[]
  /** The Exchange's stock mark, raised to the highest grade a Farm Level now opens (09 §5.3, D345). */
  readonly exchangeGrade: { readonly from: ItemGrade; readonly to: ItemGrade }
  readonly movements: readonly ItemMovement[]
  readonly settled: SettleReport
}

/**
 * Whether a row holds a finished item not yet collected: a running batch's finished items count. One rule for the
 * pill, the Hub's pips and badges, and Collect all (rework/11 §4, T137).
 */
export const hasReady = (row: WorkRow, now: number): boolean => row.entries.some((entry) => finishedCount(entry, now) > entry.collected)

const inPlaces = (slot: SlotRef, places: readonly BuildingId[] | undefined): boolean => places === undefined || places.includes(slot.building)

const emptyLine = (outfitId: string | null, slot: SlotRef, status: CollectLineStatus, words: Words): CollectAllLine => ({
  outfitId, slot, status, items: [], unlocks: [], farmExp: 0, farmLevel: { from: 0, to: 0 }, gradesOpened: [], freed: false, queueStarts: [], words,
})

/** The Umas with something to collect at `now`: the Hub's **Collect all · N ready** (02 §2). */
export function readyCount(state: WorkState, now: number, env: WorkEnv): number {
  assertNow(now)
  return Object.values(settle(state, now, env).state.work).filter((row) => hasReady(row, now)).length
}

/**
 * The Umas that need a tap on a state already settled to `now`, in outfit order: something to collect (`readyCount`'s
 * rule) or Free (01 §2). They never overlap: a Free Uma has nothing started, so nothing to collect.
 */
export function needingATap(settled: WorkState, now: number): readonly string[] {
  return Object.keys(settled.umas).sort().filter((id) => {
    const row = settled.work[id]
    return (row !== undefined && hasReady(row, now)) || isFree(settled, id)
  })
}

/**
 * How many Umas need a tap at `now` (02 §7): Ready (anything to collect) or Free. The app badge's count in phase 4,
 * and the start rule's in phase 3 (rework/11 §2.4: anything needs a tap → the Farm page).
 */
export function needsATap(state: WorkState, now: number, env: WorkEnv): number {
  assertNow(now)
  return needingATap(settle(state, now, env).state, now).length
}

/** `collect-all { places?, shown? }` (02 §2, 13 §6). It never refuses. */
export function collectAll<S extends WorkState>(state: S, input: CollectAllInput, now: number, env: WorkEnv): { readonly state: S; readonly receipt: CollectAllReceipt } {
  assertNow(now)
  const before = settle(state, now, env)
  let next = before.state
  const rows = Object.values(next.work)
    .filter((row) => row.slot !== null && hasReady(row, now) && inPlaces(row.slot, input.places))
    .sort((a, b) => slotOrder(a.slot!, b.slot!))

  const lines: CollectAllLine[] = []
  const collected: CollectReceipt[] = []
  const settles: SettleReport[] = [before.report]
  for (const row of rows) {
    const slot = row.slot!
    try {
      const { state: paid, receipt } = collect(next, { outfitId: row.outfitId }, now, env)
      next = paid
      collected.push(receipt)
      settles.push(receipt.settled)
      const items = sumInputs(receipt.outputs.flatMap((output) => ('item' in output ? [[{ item: output.item, qty: 1 }]] : [])))
      lines.push({
        outfitId: row.outfitId, slot, status: 'collected', items,
        unlocks: receipt.outputs.flatMap((output) => ('unlock' in output ? [output.unlock] : [])),
        farmExp: receipt.farmExp, farmLevel: receipt.farmLevel, gradesOpened: receipt.gradesOpened, freed: receipt.freed,
        queueStarts: row.entries.filter((entry) => entry.fromQueue).map((entry) => entry.startedAt), words: null,
      })
    } catch {
      // One slot failing never blocks the others (02 §2, 07 §9); the outbox retries it (02 §9).
      lines.push(emptyLine(row.outfitId, slot, 'failed', say(CHECK_IN_WORDS.unexpected)))
    }
  }
  for (const slot of input.shown ?? []) {
    if (!inPlaces(slot, input.places) || lines.some((line) => sameSlot(line.slot, slot))) continue
    lines.push(emptyLine(slotHolder(next, slot) ?? null, slot, 'already-collected', say(CHECK_IN_WORDS['already-collected'])))
  }
  lines.sort((a, b) => slotOrder(a.slot, b.slot))

  const levels = Object.values(next.umas).map((uma) => uma.farm.level)
  const from = next.profile.exchangeGrade
  if (levels.length > 0) next = { ...next, profile: raiseExchangeGrade(next.profile, Math.max(...levels)) }
  const count = (kind: 'dish' | 'ingredient') => lines.reduce((sum, line) => sum + line.items
    .filter(({ item }) => (itemById(item)?.kind === 'dish') === (kind === 'dish'))
    .reduce((n, { qty }) => n + qty, 0), 0)
  return {
    state: next,
    receipt: {
      lines,
      totals: {
        items: count('ingredient'), dishes: count('dish'), unlocks: lines.reduce((sum, line) => sum + line.unlocks.length, 0),
        farmExp: lines.reduce((sum, line) => sum + line.farmExp, 0),
        levelUps: lines.reduce((sum, line) => sum + (line.farmLevel.to - line.farmLevel.from), 0),
      },
      collected,
      exchangeGrade: { from, to: next.profile.exchangeGrade },
      movements: [...before.report.movements, ...collected.flatMap((receipt) => receipt.movements)],
      settled: joinSettles(...settles),
    },
  }
}
