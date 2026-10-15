// Queue starts in time order (docs/game/07-farm.md §2 "Which queue starts first", §11;
// docs/game/02-check-ins-and-notifications.md §3, §8). Settling to `now` takes, again and again, the earliest row
// whose last entry ended by `now` with a queue waiting (ties by building, room and slot order), plans its next request
// at that moment's speed and starts it at that exact end if the Warehouse's free stock covers its inputs. Otherwise the
// rest of the queue drops. Finished outputs that aren't collected aren't stock, so the result never depends on which
// card was collected first, on whether the app was open, or on the device. Settling twice changes nothing.
import { isRefusal } from '../state/types'
import { kindRules, type WorkEnv } from './kinds'
import { entryFrom, moveStock, movements, shortfall, slotOrder, speedAt, sumInputs, withRow } from './state'
import { endsAt } from './timeline'
import type { DroppedQueue, ItemMovement, QueueStart, SettleReport, WorkRow, WorkState } from './types'

export const EMPTY_SETTLE: SettleReport = Object.freeze({ started: [], dropped: [], movements: [] })

const lastEnd = (row: WorkRow): number => endsAt(row.entries[row.entries.length - 1]!)

/** A row with a queue waiting behind a last entry that ended by `now`. */
const isDue = (row: WorkRow, now: number): boolean => row.queue.length > 0 && row.entries.length > 0 && row.slot !== null && lastEnd(row) <= now

/** The row whose queue is due first by `now`: earliest end, then building, room and slot. */
function nextDue(state: WorkState, now: number): WorkRow | undefined {
  let best: WorkRow | undefined
  for (const row of Object.values(state.work)) {
    if (!isDue(row, now)) continue
    if (best === undefined || (lastEnd(row) - lastEnd(best) || slotOrder(row.slot!, best.slot!)) < 0) best = row
  }
  return best
}

/** Settles every queue due by `now`, in time order. A clock moved back settles nothing new and undoes nothing. */
export function settle<S extends WorkState>(state: S, now: number, env: WorkEnv): { readonly state: S; readonly report: SettleReport } {
  let next = state
  const started: QueueStart[] = []
  const dropped: (DroppedQueue & { readonly outfitId: string })[] = []
  const moved: ItemMovement[] = []
  for (let row = nextDue(next, now); row !== undefined; row = nextDue(next, now)) {
    const at = lastEnd(row)
    const slot = row.slot!
    const request = row.queue[0]!
    const speed = speedAt(next, slot.building)
    const rules = kindRules(env, request.kind)
    // The queue took this request with these rules; an env without them is a caller's bug, not a reason to drop it.
    if (rules === undefined) throw new RangeError(`No rules plan ${request.kind} work`)
    const plan = rules.plan(next, row.outfitId, request, at, { slot, speed, earlier: row.entries.map((entry) => entry.request), env })
    const inputs = isRefusal(plan) ? [] : sumInputs(plan.map((item) => item.inputs))
    const short = shortfall(next.items, inputs)
    if (isRefusal(plan) || short.length > 0) {
      const drop: DroppedQueue = { at, slot, requests: row.queue, short, refused: isRefusal(plan) ? plan : null }
      dropped.push({ ...drop, outfitId: row.outfitId })
      next = withRow(next, { ...row, queue: [], dropped: drop })
      continue
    }
    next = withRow({ ...next, items: moveStock(next.items, inputs, -1) }, {
      ...row, queue: row.queue.slice(1), entries: [...row.entries, entryFrom(request, plan, at, speed, true)],
    })
    started.push({ outfitId: row.outfitId, slot, at, request })
    moved.push(...movements('reserve', inputs, row.outfitId, at))
  }
  return { state: next, report: started.length + dropped.length === 0 ? EMPTY_SETTLE : { started, dropped, movements: moved } }
}

/** Settle reports as one, in order. */
export function joinSettles(...reports: readonly SettleReport[]): SettleReport {
  const started = reports.flatMap((report) => report.started)
  const dropped = reports.flatMap((report) => report.dropped)
  return started.length + dropped.length === 0 ? EMPTY_SETTLE : { started, dropped, movements: reports.flatMap((report) => report.movements) }
}
