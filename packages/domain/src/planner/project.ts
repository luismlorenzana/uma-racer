// What the work ahead will do (docs/game/02-check-ins-and-notifications.md §3 "Queues", §6 "What counts first";
// docs/game/07-farm.md §2): T127's settle, run on a copy to the end of every chain with no collects, decides each
// queued entry's start, or its drop and shortfall, exactly as the real settle will, since finished outputs aren't stock
// until collected. The planner and the queue warnings read this one projection, so they always agree with settle:
// the free stock it leaves is the Warehouse less what queued entries will take, and the outputs still to come are every
// unfinished or uncollected item of the entries it started. An entry projected to drop takes nothing and makes nothing.
import { assertNow } from '../tiers/ledger'
import type { ItemId } from '../items/catalogue'
import type { RecipeInput } from '../items/recipes'
import type { Refusal } from '../state/types'
import type { WorkEnv } from '../work/kinds'
import { settle } from '../work/settle'
import { slotOrder } from '../work/state'
import { endsAt, itemEnds } from '../work/timeline'
import type { ItemStock, SlotRef, WorkRequest, WorkState } from '../work/types'
import { say, type Words } from '../check-in/words'
import { WORK_REFUSALS } from '../work/refusals'

/** The end of every chain: settling to it starts or drops every queued entry, in time order. */
const END_OF_CHAINS = Number.MAX_SAFE_INTEGER

/** One queued entry's fate: the moment it starts, or the moment it drops and what it lacked. */
export interface ProjectedEntry {
  readonly outfitId: string
  readonly slot: SlotRef
  readonly request: WorkRequest
  /** When it starts, or null when it drops. */
  readonly startsAt: number | null
  /** When the queue drops at it, or null when it starts; a drop takes every entry behind it too. */
  readonly dropsAt: number | null
  /** What the free stock will lack for it, item by item; empty when it starts or its plan was refused. */
  readonly short: readonly RecipeInput[]
  /** The plan's refusal when T128's rules refused it, else null. */
  readonly refused: Refusal | null
}

/** One item still to come: a Farm output of a started or projected entry that isn't collected yet. */
export interface ComingItem {
  readonly item: ItemId
  /** When it finishes; at or before `now` when it is finished and waiting for Collect. */
  readonly at: number
  readonly outfitId: string
  /** Its entry, by start: what a Speed Ticket names (07 §8). */
  readonly startedAt: number
  readonly slot: SlotRef
  /** True while its entry is running at `now`: Speed Tickets can bring it sooner. */
  readonly running: boolean
}

export interface Projection<S extends WorkState = WorkState> {
  readonly now: number
  /** The state settled to `now`: what the screens show. */
  readonly current: S
  /** The state settled to the end of every chain, with nothing collected. */
  readonly ahead: S
  /** Every queued entry due after `now`, in time order (ties by building, room and slot). */
  readonly entries: readonly ProjectedEntry[]
  /** The Warehouse's free stock once every projected queue start has taken its inputs (02 §6 "What counts first" 1). */
  readonly freeStock: ItemStock
  /** Every Farm output still to come, in finish order (02 §6 "What counts first" 2). */
  readonly coming: readonly ComingItem[]
}

/** Runs settle on a copy to the end of every chain (T131): queue starts and drops, with no collects. */
export function projectWork<S extends WorkState>(state: S, now: number, env: WorkEnv): Projection<S> {
  assertNow(now)
  const current = settle(state, now, env).state
  const { state: ahead, report } = settle(current, END_OF_CHAINS, env)
  const entries: ProjectedEntry[] = [
    ...report.started.map((start): ProjectedEntry => ({
      outfitId: start.outfitId, slot: start.slot, request: start.request, startsAt: start.at, dropsAt: null, short: [], refused: null,
    })),
    ...report.dropped.flatMap((drop) => drop.requests.map((request, i): ProjectedEntry => ({
      outfitId: drop.outfitId, slot: drop.slot, request, startsAt: null, dropsAt: drop.at,
      short: i === 0 ? drop.short : [], refused: i === 0 ? drop.refused : null,
    }))),
  ].sort((a, b) => (a.startsAt ?? a.dropsAt!) - (b.startsAt ?? b.dropsAt!) || slotOrder(a.slot, b.slot))

  const coming: ComingItem[] = []
  for (const row of Object.values(ahead.work)) {
    if (row.slot === null) continue
    for (const entry of row.entries) {
      const ends = itemEnds(entry.startedAt, entry.seconds, entry.acceleratedMs)
      const running = entry.startedAt <= now && endsAt(entry) > now
      entry.outputs.forEach((output, k) => {
        if (k < entry.collected || !('item' in output)) return
        coming.push({ item: output.item, at: ends[k]!, outfitId: row.outfitId, startedAt: entry.startedAt, slot: row.slot!, running })
      })
    }
  }
  coming.sort((a, b) => a.at - b.at || slotOrder(a.slot, b.slot))
  return { now, current, ahead, entries, freeStock: ahead.items, coming }
}

/** A queued entry's warning mark (02 §3 "The card warns ahead"): it will drop, and why. */
export interface QueueWarning {
  readonly outfitId: string
  readonly slot: SlotRef
  readonly at: number
  readonly request: WorkRequest
  readonly short: readonly RecipeInput[]
  readonly refused: Refusal | null
  /** "Short 2 {item}.", or the plan's own reason. */
  readonly words: Words
}

/**
 * The queued entries that will drop (02 §3): the first entry of each projected drop after `now`, with what the free
 * stock, less what earlier entries will take, won't cover. A drop that already happened is the summary's Queue stopped.
 */
export function queueWarnings(state: WorkState, now: number, env: WorkEnv): readonly QueueWarning[] {
  return projectWork(state, now, env).entries
    .filter((entry) => entry.dropsAt !== null && (entry.short.length > 0 || entry.refused !== null))
    .map((entry): QueueWarning => ({
      outfitId: entry.outfitId, slot: entry.slot, at: entry.dropsAt!, request: entry.request, short: entry.short, refused: entry.refused,
      words: entry.short.length > 0
        ? say(WORK_REFUSALS.short, { n: entry.short[0]!.qty, item: entry.short[0]!.item })
        : say(entry.refused!.reason, entry.refused!.data),
    }))
}
