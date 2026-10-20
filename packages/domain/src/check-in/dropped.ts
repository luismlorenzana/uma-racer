// Queue stopped (docs/game/02-check-ins-and-notifications.md §3 "Queues", §4, §10; docs/game/07-farm.md §2, §9):
// a queue whose next entry couldn't be covered drops, and her work row keeps it until the owner restarts or dismisses
// it. T131 adds the two operation variants that act on it: `start { outfitId, from: 'dropped', count? }` restarts the
// entry at its size, or at Start ×N's count, and puts the rest of the queue back; `queue { outfitId, dismiss }` clears
// it. Any other start for her clears it too (T127's `start`). The summary's fixes: **Buy and restart** is T130's `buy`
// of the shortfall, then that restart, as two operations in order; **Start ×N** restarts at the size the stock covers;
// **Make them** starts the missing input with a suggested Free Uma, sized to the shortfall and 10 at most.
import type { ItemId } from '../items/catalogue'
import type { RecipeInput } from '../items/recipes'
import { assertNow } from '../tiers/ledger'
import { tierRefusal } from '../tiers/refusals'
import { isRefusal, type OpResult, type Refusal } from '../state/types'
import { kindRules, type WorkEnv } from '../work/kinds'
import { MAX_ITEMS_PER_ENTRY, queue, slotsOf, start, type StartReceipt } from '../work/adapter'
import { workRefusal } from '../work/refusals'
import { joinSettles, settle } from '../work/adapter'
import { largestCoverable, shortfall, slotExists, slotHolder, speedAt, sumInputs, withRow } from '../work/adapter'
import { SESSION_KIND, type DroppedQueue, type ItemMovement, type SettleReport, type SlotRef, type WorkRequest, type WorkState } from '../work/types'
import { Bench, freeUmas, jobFor, type Suggestion, type Timing } from '../planner/suggest'
import { buyFor, type BuyFix } from './repeat'
import { checkInRefusal, CHECK_IN_WORDS, say, type Words } from './words'

export interface RestartInput {
  readonly outfitId: string
  readonly from: 'dropped'
  /** Start ×N: a smaller size for the first entry; its own size when absent. */
  readonly count?: number
}

export interface RestartReceipt extends StartReceipt {
  /** The queue that had stopped. */
  readonly restarted: DroppedQueue
  /** The entries put back behind it. */
  readonly queued: readonly WorkRequest[]
}

/** The request at a smaller size: a job's count, or a session's first N unlocks. */
function resized(request: WorkRequest, count: number | undefined): WorkRequest {
  const size = request.kind === SESSION_KIND ? request.unlocks.length : request.count
  if (count === undefined) return request
  if (!Number.isInteger(count) || count < 1 || count > size) throw new RangeError(`Restart at 1 to ${size}: ${count}`)
  return request.kind === SESSION_KIND ? { ...request, unlocks: request.unlocks.slice(0, count) } : { ...request, count }
}

/** Her stopped queue's slot if it is free, else the lowest free slot at the same place. */
function restartSlot(state: WorkState, outfitId: string, at: SlotRef): SlotRef | undefined {
  const holder = slotExists(state, at) ? slotHolder(state, at) : 'gone'
  if (holder === undefined || holder === outfitId) return at
  return slotsOf(state, at.building).find((slot) => slot.room === at.room && slotHolder(state, slot) === undefined)
}

/**
 * `start { outfitId, from: 'dropped', count? }` (02 §4, 13 §6): restarts her stopped queue's entry with T127's `start`
 * and puts every entry behind it back with T127's `queue`, all or nothing.
 */
export function restartDropped<S extends WorkState>(state: S, input: RestartInput, now: number, env: WorkEnv): OpResult<RestartReceipt, S> {
  assertNow(now)
  const { outfitId } = input
  if (!state.umas[outfitId]) return tierRefusal('unknown-uma', { uma: outfitId })
  const before = settle(state, now, env)
  const dropped = before.state.work[outfitId]?.dropped
  if (!dropped) return checkInRefusal('nothing-stopped')
  const slot = restartSlot(before.state, outfitId, dropped.slot)
  if (slot === undefined) return checkInRefusal('place-full', { place: dropped.slot.building })
  const first = start(before.state, { outfitId, slot, request: resized(dropped.requests[0]!, input.count) }, now, env)
  if (isRefusal(first)) return first
  let next = first.state
  const settles: SettleReport[] = [before.report, first.receipt.settled]
  const movements: ItemMovement[] = [...before.report.movements, ...first.receipt.movements]
  const rest = dropped.requests.slice(1)
  for (const request of rest) {
    const queued = queue(next, { outfitId, add: { request, building: slot.building, ...(slot.room === undefined ? {} : { room: slot.room }) } }, now, env)
    if (isRefusal(queued)) return queued
    next = queued.state
    settles.push(queued.receipt.settled)
    movements.push(...queued.receipt.movements)
  }
  return {
    state: next,
    receipt: { ...first.receipt, restarted: dropped, queued: rest, movements, settled: joinSettles(...settles) },
  }
}

export interface DismissInput {
  readonly outfitId: string
  readonly dismiss: true
}

export interface DismissReceipt {
  readonly outfitId: string
  /** The stopped queue cleared, or null when there was none (the other device already acted on it). */
  readonly dismissed: DroppedQueue | null
  readonly movements: readonly ItemMovement[]
  readonly settled: SettleReport
}

/** `queue { outfitId, dismiss }` (02 §4, 13 §6): clears her stopped queue. Nothing to clear is no change. */
export function dismissDropped<S extends WorkState>(state: S, input: DismissInput, now: number, env: WorkEnv): OpResult<DismissReceipt, S> {
  assertNow(now)
  const { outfitId } = input
  if (!state.umas[outfitId]) return tierRefusal('unknown-uma', { uma: outfitId })
  const before = settle(state, now, env)
  const row = before.state.work[outfitId]
  const dismissed = row?.dropped ?? null
  return {
    state: row && dismissed ? withRow(before.state, { ...row, dropped: null }) : before.state,
    receipt: { outfitId, dismissed, movements: before.report.movements, settled: before.report },
  }
}

/** Queue stopped's line and fixes (02 §4). */
export interface StoppedQueue {
  readonly outfitId: string
  readonly dropped: DroppedQueue
  /** "Short 2 {item}." for the stock now, or the plan's own reason. */
  readonly words: Words
  /** What the free stock lacks now for the stopped entry at its size. */
  readonly short: readonly RecipeInput[]
  /** True when the stock now covers it: a plain restart. */
  readonly restart: boolean
  /** **Buy and restart · 190**: T130's `buy` of the shortfall, then the restart; null when the Exchange can't sell it all. */
  readonly buy: BuyFix | null
  /** **Start ×8**: the size the stock covers, when it covers some but not all. */
  readonly startSmaller: number | null
  /** **Make them: Garden ×2**: the first missing input, by a suggested Free Uma, sized to the shortfall, 10 at most. */
  readonly makeThem: Suggestion | null
  readonly refused: Refusal | null
}

/** Her stopped queue with its fixes at `now`, or null when her queue hasn't stopped. */
export function queueStopped(state: WorkState, outfitId: string, now: number, env: WorkEnv, timing: Omit<Timing, 'now'>): StoppedQueue | null {
  assertNow(now)
  const current = settle(state, now, env).state
  const dropped = current.work[outfitId]?.dropped
  if (!dropped) return null
  const request = dropped.requests[0]!
  const rules = kindRules(env, request.kind)
  const items = rules?.plan(current, outfitId, request, now, { slot: dropped.slot, speed: speedAt(current, dropped.slot.building), earlier: [], env })
    ?? workRefusal('not-here')
  if (isRefusal(items)) {
    return { outfitId, dropped, words: say(items.reason, items.data), short: [], restart: false, buy: null, startSmaller: null, makeThem: null, refused: items }
  }
  const short = shortfall(current.items, sumInputs(items.map((item) => item.inputs)))
  const covered = largestCoverable(current.items, items)
  const first = short[0]
  return {
    outfitId, dropped,
    words: first ? say(CHECK_IN_WORDS.short, { n: first.qty, item: first.item }) : say(CHECK_IN_WORDS['queue-stopped']),
    short,
    restart: short.length === 0,
    buy: buyFor(current, short),
    startSmaller: covered > 0 && covered < items.length ? covered : null,
    makeThem: first ? makeThem(current, outfitId, first.item, first.qty, { ...timing, now }) : null,
    refused: null,
  }
}

/** **Make them** (02 §4): the first Free Uma in suggestion order, other than her, who can start `qty` of `item` now. */
export function makeThem(state: WorkState, outfitId: string, item: ItemId, qty: number, timing: Timing): Suggestion | null {
  const bench = new Bench(state, state.items)
  for (const worker of freeUmas(state)) {
    if (worker.outfitId === outfitId) continue
    const job = jobFor(state, bench, worker, item, Math.min(qty, MAX_ITEMS_PER_ENTRY), timing)
    if (job !== null) return { ...job, forTarget: outfitId }
  }
  return null
}
