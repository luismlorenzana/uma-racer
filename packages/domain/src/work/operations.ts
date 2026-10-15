// The work operations (docs/rework/13-removals-and-plan-changes.md §6; docs/rework/07-farm.md §2, §5, §7, §8, §11;
// docs/rework/05-training-hub.md §2, §7; docs/rework/09-racing-rewards-and-exchange.md §5.1, §9;
// docs/rework/02-check-ins-and-notifications.md §3, §9): `start`, `queue`, `collect`, `recall`, `speed-up`, `finish`
// and `upgrade`, each `(state, input, now, env) → { state, receipt } | Refusal`. Every one settles to `now` before and
// after it runs, so a Finish starts the next queued entry at once, and its receipt lists every item movement for phase
// 3's `itemLedger`. Refusals are plain words with the data a screen needs to ask again; a malformed input (an unknown
// building or room, a negative ticket count) is a caller's bug and throws, as T125's `now` check does.
import {
  BUILDINGS, buildingSpeed, isBuildingId, MAX_BUILDING_LEVEL, slotsPerRoom, totalSlots, upgradeCost, type BuildingId, type BuildingLevel,
  type RoomId,
} from '../farm/buildings'
import { SPEED_TICKET_ID } from '../items/catalogue'
import type { RecipeInput } from '../items/recipes'
import { assertNow, writeLedger } from '../tiers/ledger'
import { tierRefusal } from '../tiers/refusals'
import { isRefusal, type LedgerEntry, type OpResult, type Refusal } from '../state/types'
import { chainEnd, statusOf } from './activity'
import { payWork, type CollectReceipt, type PaidWork } from './collect'
import { kindRules, type PlannedItem, type WorkEnv } from './kinds'
import { workRefusal } from './refusals'
import { joinSettles, settle } from './settle'
import {
  buildingLevel, emptyRow, entryFrom, largestCoverable, moveStock, movements, samePlace, shortfall, slotExists, slotHolder, speedAt,
  stockOf, sumInputs, withRow,
} from './state'
import { applyTickets, endsAt, finishedCount, itemEnds, remainingMs, ticketsToFinish } from './timeline'
import {
  SESSION_KIND, type Done, type ItemMovement, type SettleReport, type SlotRef, type WorkRequest, type WorkRow, type WorkState,
} from './types'

/** A job or session makes 1–10 items or unlocks (07 §2, 05 §2). */
export const MIN_ITEMS_PER_ENTRY = 1
export const MAX_ITEMS_PER_ENTRY = 10
/** Up to 3 requests wait behind the running one (07 §2, 02 §3). */
export const MAX_QUEUE = 3
const MS_PER_MINUTE = 60_000

/** How many items or unlocks a request makes. */
export const requestCount = (request: WorkRequest): number => (request.kind === SESSION_KIND ? request.unlocks.length : request.count)
const countAllowed = (n: number): boolean => Number.isInteger(n) && n >= MIN_ITEMS_PER_ENTRY && n <= MAX_ITEMS_PER_ENTRY

function plan(state: WorkState, outfitId: string, request: WorkRequest, now: number, slot: SlotRef, earlier: readonly WorkRequest[], env: WorkEnv): readonly PlannedItem[] | Refusal {
  const rules = kindRules(env, request.kind)
  if (rules === undefined) return workRefusal('not-here')
  return rules.plan(state, outfitId, request, now, { slot, speed: speedAt(state, slot.building), earlier, env })
}

/** Runs `op` on the state settled to `now`, then settles again, joining both settles into the receipt. */
function settled<S extends WorkState, R extends { readonly movements: readonly ItemMovement[] }>(
  state: S, now: number, env: WorkEnv, op: (state: S) => { readonly state: S; readonly receipt: R } | Refusal,
): { readonly state: S; readonly receipt: R & { readonly settled: SettleReport } } | Refusal {
  assertNow(now)
  const before = settle(state, now, env)
  const result = op(before.state)
  if (isRefusal(result)) return result
  const after = settle(result.state, now, env)
  return {
    state: after.state,
    receipt: {
      ...result.receipt,
      movements: [...before.report.movements, ...result.receipt.movements, ...after.report.movements],
      settled: joinSettles(before.report, after.report),
    },
  }
}

const done = <R, S>(result: { readonly state: S; readonly receipt: R } | Refusal): Done<R, S> => {
  if (isRefusal(result)) throw new Error(`Never refuses: ${result.code}`)
  return result
}

// --- start ----------------------------------------------------------------------------------------------------------

export interface StartInput {
  readonly outfitId: string
  readonly slot: SlotRef
  readonly request: WorkRequest
}

export interface StartReceipt {
  readonly outfitId: string
  readonly slot: SlotRef
  readonly request: WorkRequest
  readonly startedAt: number
  readonly endsAt: number
  /** Her finished work, collected first when she was Ready (01 §2), else null. */
  readonly collected: PaidWork | null
  readonly movements: readonly ItemMovement[]
  readonly settled: SettleReport
}

/**
 * `start` (07 §2, 05 §2): reserves every item's inputs and starts the entry now. In order: the slot exists and is free;
 * she is Free, or Ready (collected in the same receipt); 1–10 items; this building makes it; her Farm Level opens the
 * grade (or the kind's own rules); the free stock covers it, else `short` with `largestCoverable`. Starting clears any
 * dropped queue she kept (T131: a new start acts on it).
 */
export function start<S extends WorkState>(state: S, input: StartInput, now: number, env: WorkEnv): OpResult<StartReceipt, S> {
  assertNow(now)
  const { outfitId, slot, request } = input
  if (!state.umas[outfitId]) return tierRefusal('unknown-uma', { uma: outfitId })
  return settled(state, now, env, (current) => {
    if (!slotExists(current, slot)) throw new RangeError(`${slot.building} has no slot ${slot.slot} at Lv ${buildingLevel(current, slot.building)}`)
    const holder = slotHolder(current, slot)
    if (holder !== undefined && holder !== outfitId) return workRefusal('slot-taken')
    const row = current.work[outfitId]
    const status = statusOf(row, now)
    if (status === 'working') {
      const time = chainEnd(current, row!, now, env)
      return workRefusal('busy', { uma: outfitId, time, freeAt: time })
    }
    let next = current
    let collected: PaidWork | null = null
    if (status === 'ready') ({ state: next, paid: collected } = payWork(current, outfitId, now, env))
    if (!countAllowed(requestCount(request))) return workRefusal('count')
    const items = plan(next, outfitId, request, now, slot, [], env)
    if (isRefusal(items)) return items
    const inputs = sumInputs(items.map((item) => item.inputs))
    const short = shortfall(next.items, inputs)
    if (short.length > 0) return workRefusal('short', { n: short[0]!.qty, item: short[0]!.item, largestCoverable: largestCoverable(next.items, items) })
    const entry = entryFrom(request, items, now, speedAt(next, slot.building), false)
    const mine = next.work[outfitId] ?? emptyRow(outfitId)
    // A new start acts on a stopped queue, so it clears it, as a restart or Dismiss would (T131, 02 §10).
    next = withRow({ ...next, items: moveStock(next.items, inputs, -1) }, { ...mine, slot, entries: [entry], queue: [], dropped: null })
    return {
      state: next,
      receipt: {
        outfitId, slot, request, startedAt: now, endsAt: endsAt(entry), collected,
        movements: [...(collected?.movements ?? []), ...movements('reserve', inputs, outfitId, now)],
      },
    }
  })
}

// --- queue ----------------------------------------------------------------------------------------------------------

/** Add at a place (the sheet's building and room), remove by index, or move one entry to another index. */
export type QueueEdit =
  | { readonly add: { readonly request: WorkRequest; readonly building: BuildingId; readonly room?: RoomId } }
  | { readonly remove: number }
  | { readonly move: { readonly from: number; readonly to: number } }

export type QueueInput = { readonly outfitId: string } & QueueEdit

export interface QueueReceipt {
  readonly outfitId: string
  /** Her queue after the edit. */
  readonly queued: readonly WorkRequest[]
  readonly movements: readonly ItemMovement[]
  readonly settled: SettleReport
}

function edited(queue: readonly WorkRequest[], edit: QueueEdit): readonly WorkRequest[] | null {
  const index = (n: number) => {
    if (!Number.isInteger(n) || n < 0) throw new RangeError(`A queue index is a whole number ≥ 0: ${n}`)
    return n < queue.length
  }
  if ('add' in edit) return [...queue, edit.add.request]
  if ('remove' in edit) return index(edit.remove) ? queue.filter((_, i) => i !== edit.remove) : null
  if (!index(edit.move.from) || !index(edit.move.to)) return null
  const moved = queue.filter((_, i) => i !== edit.move.from)
  moved.splice(edit.move.to, 0, queue[edit.move.from]!)
  return moved
}

/**
 * `queue` (07 §2, 02 §3): edits up to three requests behind her running entry, at the same building and room. Nothing
 * is reserved. Every queued request must still plan in order behind the ones before it (the place, the grade gate,
 * T128's order), so an edit that would strand one is refused with its reason.
 */
export function queue<S extends WorkState>(state: S, input: QueueInput, now: number, env: WorkEnv): OpResult<QueueReceipt, S> {
  assertNow(now)
  const { outfitId } = input
  if (!state.umas[outfitId]) return tierRefusal('unknown-uma', { uma: outfitId })
  return settled(state, now, env, (current) => {
    const row = current.work[outfitId]
    if (statusOf(row, now) !== 'working') return workRefusal('finished')
    const slot = row!.slot!
    if ('add' in input) {
      if (row!.queue.length >= MAX_QUEUE) return workRefusal('queue-full')
      if (!samePlace(slot, input.add)) return workRefusal('queue-place')
      if (!countAllowed(requestCount(input.add.request))) return workRefusal('count')
    }
    const queued = edited(row!.queue, input)
    if (queued === null) return workRefusal('finished')
    const earlier = row!.entries.map((entry) => entry.request)
    for (const request of queued) {
      const planned = plan(current, outfitId, request, now, slot, [...earlier], env)
      if (isRefusal(planned)) return planned
      earlier.push(request)
    }
    return { state: withRow(current, { ...row!, queue: queued }), receipt: { outfitId, queued, movements: [] } }
  })
}

// --- collect --------------------------------------------------------------------------------------------------------

/** `collect` (07 §2, 05 §2): pays every finished item, oldest first. It never refuses; nothing ready pays nothing. */
export function collect<S extends WorkState>(state: S, input: { readonly outfitId: string }, now: number, env: WorkEnv): Done<CollectReceipt, S> {
  return done(settled(state, now, env, (current) => {
    const { state: next, paid } = payWork(current, input.outfitId, now, env)
    return { state: next, receipt: paid }
  }))
}

// --- recall ---------------------------------------------------------------------------------------------------------

export interface RecallReceipt extends CollectReceipt {
  /** True when an entry was running and stopped; false when Recall acted as Collect. */
  readonly recalled: boolean
  /** The inputs of every unmade item, the one in progress included, back in the free stock. */
  readonly returned: readonly RecipeInput[]
  /** The queue it dropped, with no dropped record (07 §2). */
  readonly droppedQueue: readonly WorkRequest[]
  /** Progress lost on the item in progress, in minutes. */
  readonly lostMinutes: number
}

/**
 * `recall` (07 §2, 05 §2): collects, then stops the running entry. Every unmade item's inputs come back, the one in
 * progress included; the queue drops without a record and her last work is cleared, so Repeat won't restart a
 * deliberate stop (02 §5). With nothing running it acts as `collect`.
 */
export function recall<S extends WorkState>(state: S, input: { readonly outfitId: string }, now: number, env: WorkEnv): Done<RecallReceipt, S> {
  const { outfitId } = input
  return done(settled<S, Omit<RecallReceipt, 'settled'>>(state, now, env, (current) => {
    const { state: paid, paid: collected } = payWork(current, outfitId, now, env)
    const row = paid.work[outfitId]
    if (row === undefined || row.entries.length === 0) {
      return { state: paid, receipt: { ...collected, recalled: false, returned: [], droppedQueue: [], lostMinutes: 0 } }
    }
    const unmade = row.entries.map((entry) => entry.inputs.slice(Math.max(entry.collected, finishedCount(entry, now))))
    const returned = sumInputs(unmade.flat())
    const first = row.entries[0]!
    const made = Math.max(first.collected, finishedCount(first, now))
    const itemStart = made === 0 ? first.startedAt - first.acceleratedMs : itemEnds(first.startedAt, first.seconds, first.acceleratedMs)[made - 1]!
    const stopped: WorkRow = { ...row, slot: null, entries: [], queue: [], last: null }
    return {
      state: withRow({ ...paid, items: moveStock(paid.items, returned, 1) }, stopped),
      receipt: {
        ...collected, recalled: true, returned, droppedQueue: row.queue,
        lostMinutes: Math.max(0, now - itemStart) / MS_PER_MINUTE,
        movements: [...collected.movements, ...movements('return', returned, outfitId, now)],
      },
    }
  }))
}

// --- speed-up and finish --------------------------------------------------------------------------------------------

export interface SpeedUpInput {
  readonly outfitId: string
  /** The running entry's `startedAt`, so a ticket meant for a finished entry can't land on the next (09 §9). */
  readonly startedAt: number
  readonly tickets: number
}

export interface SpeedUpReceipt {
  readonly outfitId: string
  readonly startedAt: number
  /** Speed Tickets spent. */
  readonly tickets: number
  readonly savedMinutes: number
  /** What the last ticket couldn't use (07 §8). */
  readonly wastedMinutes: number
  /** The entry's new end. */
  readonly endsAt: number
  readonly movements: readonly ItemMovement[]
  readonly settled: SettleReport
}

function spendTickets<S extends WorkState>(state: S, input: { readonly outfitId: string; readonly startedAt: number; readonly tickets: number | 'finish' }, now: number, env: WorkEnv): OpResult<SpeedUpReceipt, S> {
  assertNow(now)
  const { outfitId, startedAt } = input
  if (input.tickets !== 'finish' && (!Number.isInteger(input.tickets) || input.tickets < 1)) throw new RangeError(`Spend at least one whole Speed Ticket: ${input.tickets}`)
  if (!state.umas[outfitId]) return tierRefusal('unknown-uma', { uma: outfitId })
  return settled(state, now, env, (current) => {
    const row = current.work[outfitId]
    const entry = row?.entries[row.entries.length - 1]
    if (row === undefined || entry === undefined || entry.startedAt !== startedAt || endsAt(entry) <= now) return workRefusal('finished')
    const needed = ticketsToFinish(remainingMs(entry, now))
    const tickets = input.tickets === 'finish' ? needed : Math.min(input.tickets, needed)
    if (stockOf(current.items, SPEED_TICKET_ID) < tickets) return workRefusal('tickets', { n: tickets, have: stockOf(current.items, SPEED_TICKET_ID) })
    const applied = applyTickets(entry, tickets, now)
    const sped = { ...entry, acceleratedMs: applied.acceleratedMs }
    const spent = [{ item: SPEED_TICKET_ID, qty: tickets }]
    return {
      state: withRow({ ...current, items: moveStock(current.items, spent, -1) }, { ...row, entries: [...row.entries.slice(0, -1), sped] }),
      receipt: {
        outfitId, startedAt, tickets, savedMinutes: applied.appliedMs / MS_PER_MINUTE, wastedMinutes: applied.wastedMs / MS_PER_MINUTE,
        endsAt: endsAt(sped), movements: movements('ticket', spent, outfitId, now),
      },
    }
  })
}

/**
 * `speed-up` (07 §8, 09 §5.1): 1 or more Speed Tickets on her running entry, each moving every unfinished item 30
 * minutes earlier, never past `now`: a count above what finishes it spends only what finishes it. Refused on a
 * finished, queued or missing entry or a wrong `startedAt` (`finished`), and without the tickets (`tickets`).
 */
export const speedUp = <S extends WorkState>(state: S, input: SpeedUpInput, now: number, env: WorkEnv): OpResult<SpeedUpReceipt, S> =>
  spendTickets(state, input, now, env)

/** `finish` (07 §8): ⌈remaining ÷ 30 minutes⌉ tickets end the running entry now, and a queue starts at once. */
export const finish = <S extends WorkState>(state: S, input: { readonly outfitId: string; readonly startedAt: number }, now: number, env: WorkEnv): OpResult<SpeedUpReceipt, S> =>
  spendTickets(state, { ...input, tickets: 'finish' }, now, env)

// --- upgrade --------------------------------------------------------------------------------------------------------

/** An upgrade's Prize Money row (09 §9, reason `upgrade`): a building reaches each level once, so the id is once-only. */
export const upgradeLedgerId = (building: BuildingId, level: BuildingLevel): string => `upgrade:${building}:${level}`

export interface UpgradeReceipt {
  readonly building: BuildingId
  readonly from: BuildingLevel
  readonly to: BuildingLevel
  /** Prize Money charged. */
  readonly prizeMoney: number
  /** Its `prize-money` row, also appended to the state's ledger (T130's audit: deltas sum to the balance). */
  readonly ledger: readonly LedgerEntry[]
  /** Slots per room, and in all, at the new level: they apply at once. */
  readonly slotsPerRoom: number
  readonly totalSlots: number
  /** The new speed, for entries started from now on (07 §7, 05 §7). */
  readonly speed: number
  readonly movements: readonly ItemMovement[]
  readonly settled: SettleReport
}

/**
 * `upgrade` (07 §7, 05 §7): the account's building goes up one level, up to Lv 3, for its Prize Money and crafted
 * items, charged once. The Prize Money is a ledger row (09 §9). New slots apply at once; the new speed only to entries
 * started after it. Its only gate is its cost (07 §14).
 */
export function upgrade<S extends WorkState>(state: S, input: { readonly building: BuildingId }, now: number, env: WorkEnv): OpResult<UpgradeReceipt, S> {
  const { building } = input
  if (!isBuildingId(building)) throw new RangeError(`No building ${String(building)}`)
  return settled(state, now, env, (current) => {
    const from = buildingLevel(current, building)
    if (from >= MAX_BUILDING_LEVEL) return workRefusal('top-level')
    const to = (from + 1) as 2 | 3
    const cost = upgradeCost(building, to)
    if (current.profile.prizeMoney < cost.prizeMoney) return workRefusal('prize-money', { n: cost.prizeMoney, have: current.profile.prizeMoney })
    const short = shortfall(current.items, cost.items)
    if (short.length > 0) return workRefusal('short', { n: short[0]!.qty, item: short[0]!.item })
    const row = { id: upgradeLedgerId(building, to), resource: 'prize-money' as const, delta: -cost.prizeMoney, reason: 'upgrade' as const }
    const paid = writeLedger(current, row, now)
    return {
      state: { ...paid, items: moveStock(paid.items, cost.items, -1), buildings: { ...paid.buildings, [building]: { level: to } } },
      receipt: {
        building, from, to, prizeMoney: cost.prizeMoney, ledger: [{ ...row, at: now }], slotsPerRoom: slotsPerRoom(building, to),
        totalSlots: totalSlots(building, to), speed: buildingSpeed(to), movements: movements('cost', cost.items, null, now),
      },
    }
  })
}

/** Every slot of a building at its current level, in order (rooms in 05 §1's order). */
export function slotsOf(state: Pick<WorkState, 'buildings'>, building: BuildingId): SlotRef[] {
  const level = buildingLevel(state, building)
  const rooms: readonly (RoomId | undefined)[] = BUILDINGS[building].rooms.length > 0 ? BUILDINGS[building].rooms : [undefined]
  return rooms.flatMap((room) => Array.from({ length: slotsPerRoom(building, level) }, (_, slot) =>
    (room === undefined ? { building, slot } : { building, room, slot })))
}
