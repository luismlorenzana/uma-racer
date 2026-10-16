// The shared work pieces' view models (docs/game/07-farm.md §2, §8, §10; docs/game/05-training-hub.md §2;
// docs/game/09-racing-rewards-and-exchange.md §5.1; docs/game/02-check-ins-and-notifications.md §3; T140, D366). Pure
// readings of the domain's state and rules for one slot's row, its Speed Ticket controls, a Recall's preview, a queue's
// chips, the size chips and a building's upgrade; times are durations, never the clock time work ends. Every number
// comes from a domain function; nothing here restates a rule.
import { durationText, say, sizeChips, type OperationEnv, type Words } from '@racer/domain/check-in'
import { buy as buyOperation, buyPrice } from '@racer/domain/economy'
import { isRefusal } from '@racer/domain/state'
import { buildingSpeed, MAX_BUILDING_LEVEL, totalSlots, upgradeCost, type BuildingId } from '@racer/domain/farm'
import { SPEED_TICKET_ID, type ItemId, type RecipeInput } from '@racer/domain/items'
import type { Projection, QueueWarning } from '@racer/domain/planner'
import type { WorkView } from './view'
import { workWords } from './words'
import {
  applyTickets, buildingLevel, endsAt, finishedCount, holdsSlot, itemEnds, itemProgress, recall, remainingMs, sameSlot, slotsOf, stockOf,
  sumInputs, ticketsToFinish, upgrade, SESSION_KIND, SPEED_TICKET_MS, type Entry, type SlotRef, type WorkRequest, type WorkRow, type WorkState,
} from '@racer/domain/work'

const MS_PER_MINUTE = 60_000

// --- Slot cards -----------------------------------------------------------------------------------------------------

/** A slot nobody holds: **Start a job**. */
export interface FreeSlotCard {
  readonly kind: 'free'
  readonly slot: SlotRef
}

/** A slot her work holds: running, or finished and waiting for Collect (07 §10). */
export interface HeldSlotCard {
  readonly kind: 'held'
  readonly slot: SlotRef
  readonly outfitId: string
  /** The latest started entry's request: what the card names. */
  readonly request: WorkRequest
  /** The latest entry's start: what a Speed Ticket names (09 §9). */
  readonly startedAt: number
  /** Its items finished at `now`, collected or not: "3 / 10 made". */
  readonly made: number
  readonly count: number
  /** Finished items not yet collected, every entry together: **Collect**. */
  readonly waiting: number
  /** True while the latest entry runs; false once it has ended and waits for Collect. */
  readonly running: boolean
  /** The next item's end while it runs, else null. */
  readonly nextAt: number | null
  /** The latest entry's end. */
  readonly endsAt: number
  /** How long the latest entry has left at `now`, 0 once it has ended: the row's "1h 20m" (D366). */
  readonly leftMs: number
  /** The current item's progress, 0–1, as the Hub's pips draw it (game/11 §4). */
  readonly progress: number
  readonly queue: readonly WorkRequest[]
}

export type SlotCardModel = FreeSlotCard | HeldSlotCard

const countOf = (request: WorkRequest): number => (request.kind === SESSION_KIND ? request.unlocks.length : request.count)

/** One held slot's card on a state already settled to `now`. */
export function heldCard(row: WorkRow, now: number): HeldSlotCard {
  const last = row.entries[row.entries.length - 1]!
  const made = finishedCount(last, now)
  const ends = itemEnds(last.startedAt, last.seconds, last.acceleratedMs)
  const running = endsAt(last) > now
  return {
    kind: 'held',
    slot: row.slot!,
    outfitId: row.outfitId,
    request: last.request,
    startedAt: last.startedAt,
    made,
    count: countOf(last.request),
    waiting: row.entries.reduce((sum, entry) => sum + Math.max(0, finishedCount(entry, now) - entry.collected), 0),
    running,
    nextAt: running ? ends[made] ?? null : null,
    endsAt: endsAt(last),
    leftMs: Math.max(0, endsAt(last) - now),
    progress: itemProgress(last, now),
    queue: row.queue,
  }
}

/** Every slot of `building` at its level, in `slotsOf` order, on a state already settled to `now` (07 §10). */
export function slotCards(settled: WorkState, building: BuildingId, now: number): SlotCardModel[] {
  const holders = Object.values(settled.work).filter(holdsSlot)
  return slotsOf(settled, building).map((slot): SlotCardModel => {
    const row = holders.find((holder) => sameSlot(holder.slot!, slot))
    return row === undefined ? { kind: 'free', slot } : heldCard(row, now)
  })
}

// --- Speed Tickets --------------------------------------------------------------------------------------------------

/**
 * `SpeedUpControls`' four states (07 §8, 09 §5.1): hidden on a queued, finished or empty slot; `ready` with −30m and
 * **Finish · N**; `buy` when she holds fewer than N tickets ("Buy 3 and finish · 90"); `waste` under 30 minutes left,
 * when one ticket finishes it and the sheet shows the minutes it wastes before it confirms.
 */
export type SpeedUpState = 'hidden' | 'ready' | 'buy' | 'waste'

export interface SpeedUpModel {
  readonly state: SpeedUpState
  readonly outfitId: string
  readonly startedAt: number
  readonly remainingMs: number
  /** What remains in 30-minute tickets, rounded up (`ticketsToFinish`): **Finish · N**. */
  readonly finish: number
  /** Speed Tickets held. */
  readonly have: number
  /** Tickets to buy before Finish, and their price at the Exchange. */
  readonly buy: number
  readonly price: number
  /** Minutes the last ticket of a Finish can't use. */
  readonly wastedMinutes: number
  /** Why the Exchange won't sell the tickets to buy (`buy`'s refusal, "Need 30 more."), else null. */
  readonly buyRefusal: Words | null
}

/** The running entry's Speed Ticket controls, on a settled state (07 §8). */
export function speedUpModel(settled: WorkState, outfitId: string, now: number): SpeedUpModel {
  const row = settled.work[outfitId]
  const entry: Entry | undefined = row?.entries[row.entries.length - 1]
  const have = stockOf(settled.items, SPEED_TICKET_ID)
  const left = entry === undefined ? 0 : remainingMs(entry, now)
  if (entry === undefined || left <= 0) {
    return { state: 'hidden', outfitId, startedAt: entry?.startedAt ?? 0, remainingMs: 0, finish: 0, have, buy: 0, price: 0, wastedMinutes: 0, buyRefusal: null }
  }
  const finish = ticketsToFinish(left)
  const buy = Math.max(0, finish - have)
  const wastedMinutes = Math.round(applyTickets(entry, finish, now).wastedMs / MS_PER_MINUTE)
  const state: SpeedUpState = buy > 0 ? 'buy' : left < SPEED_TICKET_MS ? 'waste' : 'ready'
  const unitPrice = buyPrice(SPEED_TICKET_ID)!
  const bought = buy > 0 ? buyOperation(settled, { opId: 'preview', sku: SPEED_TICKET_ID, qty: buy, unitPrice }, now) : null
  return {
    state, outfitId, startedAt: entry.startedAt, remainingMs: left, finish, have, buy, price: buy * unitPrice, wastedMinutes,
    buyRefusal: bought !== null && isRefusal(bought) ? say(bought.reason, bought.data) : null,
  }
}

// --- Recall ---------------------------------------------------------------------------------------------------------

/** What a Recall would do now (07 §2, §5): what it pays, what comes back, the progress lost and the queue dropped. */
export interface RecallPreview {
  readonly outfitId: string
  /** Outputs paid, summed by item; a session's unlocks count by themselves. */
  readonly paid: readonly RecipeInput[]
  readonly unlocks: number
  readonly returned: readonly RecipeInput[]
  /** Whole minutes of the item in progress that are lost. */
  readonly lostMinutes: number
  readonly droppedQueue: number
  /** False when nothing is running: Recall then acts as Collect. */
  readonly recalled: boolean
}

/** `recall` run on the current state, read for the sheet; the real `recall` gives the same receipt. */
export function recallPreview(state: WorkState, outfitId: string, now: number, env: OperationEnv): RecallPreview {
  const { receipt } = recall(state, { outfitId }, now, env)
  return {
    outfitId,
    paid: sumInputs(receipt.outputs.flatMap((output) => ('item' in output ? [[{ item: output.item, qty: 1 }]] : []))),
    unlocks: receipt.outputs.filter((output) => 'unlock' in output).length,
    returned: receipt.returned,
    lostMinutes: Math.round(receipt.lostMinutes),
    droppedQueue: receipt.droppedQueue.length,
    recalled: receipt.recalled,
  }
}

// --- Queues ---------------------------------------------------------------------------------------------------------

/** One queued request on her row (02 §3): how long it takes, and a warning when it would drop. */
export interface QueueChip {
  readonly index: number
  readonly request: WorkRequest
  /** When it would finish if it starts as projected; null when the projection drops it. */
  readonly endsAt: number | null
  /** How long it takes once it starts, at the speed it would start with: "then Carrot ×4 · 2h" (D366); null when dropped. */
  readonly ms: number | null
  /** `queueWarnings`' words where the stock won't cover it ("Short 2 Honey."), else null. */
  readonly warning: QueueWarningWords | null
}

export type QueueWarningWords = QueueWarning['words']

/**
 * Her queue's chips from one projection (02 §3): each end from the settle run to the end of her chain, and
 * `queueWarnings`' mark (computed once for the page) on the entry it would drop at.
 */
export function queueChips(projection: Projection, warnings: readonly QueueWarning[], outfitId: string): QueueChip[] {
  const row = projection.current.work[outfitId]
  if (row === undefined) return []
  const ahead = projection.ahead.work[outfitId]
  const started = ahead === undefined ? [] : ahead.entries.slice(row.entries.length)
  const warning = warnings.find((entry) => entry.outfitId === outfitId) ?? null
  const dropsFrom = row.queue.length - (projection.entries.filter((entry) => entry.outfitId === outfitId && entry.dropsAt !== null).length)
  return row.queue.map((request, index): QueueChip => {
    const entry = index < started.length ? started[index]! : null
    return {
      index,
      request,
      endsAt: entry === null ? null : endsAt(entry),
      ms: entry === null ? null : endsAt(entry) - entry.startedAt,
      warning: warning !== null && index === dropsFrom ? warning.words : null,
    }
  })
}

// --- Size chips -----------------------------------------------------------------------------------------------------

export interface SizeChipView {
  readonly size: number
  readonly endsAt: number
  /** How long the size takes from its start (D366): the chip's "3h 36m". */
  readonly ms: number
  readonly duration: string
  /** How long she would then wait for a check-in, 0 when it ends on one. */
  readonly idleMs: number
  /** VoiceOver's reading: "3h 36m, then free 44m before a check-in". */
  readonly words: string
}

export interface SizeChipsView {
  readonly chips: readonly SizeChipView[]
  /** The marked size, preselected: the largest ending by the check-in it fits (02 §3). */
  readonly marked: number
  /** True when that check-in is the day's first: the mark is a moon, not a check-in mark (D366). */
  readonly overnight: boolean
  /** The mark's reading, never a clock time: "fits the next check-in" or "runs overnight". */
  readonly fit: string
}

/**
 * The size picker's chips (02 §3, D366): one per size from 1 to `max` (what the stock covers, 10 at most; at least 1, so
 * a short start still shows ×1 and its shortfall), items made one after another from `start`, each read as how long it
 * takes. `sizeChips` still picks the marked size from the check-in times; the screen marks it with an icon, not a time.
 */
export function sizeChipsView(start: number, itemSeconds: readonly number[], max: number, times: readonly number[], utcOffsetMin: number): SizeChipsView {
  const n = Math.max(1, Math.min(max, itemSeconds.length))
  const chips = sizeChips(start, itemSeconds.slice(0, n), times, utcOffsetMin)
  return {
    chips: chips.chips.map((chip) => {
      const ms = chip.endsAt - start
      const duration = durationText(ms)
      return {
        size: chip.size, endsAt: chip.endsAt, ms, duration, idleMs: chip.idleMs,
        words: chip.idleMs > 0 ? workWords('size-chip-idle', { time: duration, idle: durationText(chip.idleMs) }) : duration,
      }
    }),
    marked: chips.marked,
    overnight: chips.overnight,
    fit: workWords(chips.overnight ? 'size-overnight' : 'size-fits'),
  }
}

// --- Upgrades -------------------------------------------------------------------------------------------------------

/** The next upgrade (07 §7, 05 §7) against what the account holds, with `upgrade`'s refusal when it can't be paid. */
export interface UpgradeView {
  readonly to: 2 | 3
  readonly prizeMoney: number
  readonly haveMoney: number
  readonly items: readonly { readonly item: ItemId; readonly need: number; readonly have: number }[]
  /** What the level brings: every slot at it (`totalSlots`) and its speed (`buildingSpeed`), against today's. */
  readonly adds: { readonly slots: number; readonly slotsNow: number; readonly speed: number; readonly speedNow: number }
  /** `prize-money` or `short` in the rule's words, else null. */
  readonly refusal: Words | null
}

/** The next upgrade of `building` on the view's settled state, or null at Lv 3. */
export function upgradeView(view: WorkView, building: BuildingId): UpgradeView | null {
  const settled = view.settled
  const level = buildingLevel(settled, building)
  if (level >= MAX_BUILDING_LEVEL) return null
  const to = (level + 1) as 2 | 3
  const cost = upgradeCost(building, to)
  const tried = upgrade(settled, { building }, view.now, view.env)
  return {
    to,
    prizeMoney: cost.prizeMoney,
    haveMoney: settled.profile.prizeMoney,
    items: cost.items.map(({ item, qty }) => ({ item, need: qty, have: stockOf(settled.items, item) })),
    adds: { slots: totalSlots(building, to), slotsNow: totalSlots(building, level), speed: buildingSpeed(to), speedNow: buildingSpeed(level) },
    refusal: isRefusal(tried) ? say(tried.reason, tried.data) : null,
  }
}

/** What the next level brings, in words: "3 slots at Lv 2", "Speed ×1.25 at Lv 3". */
export function upgradeAdds(upgrade: UpgradeView): string[] {
  const lines: string[] = []
  if (upgrade.adds.slots > upgrade.adds.slotsNow) lines.push(workWords('upgrade-slots', { slots: upgrade.adds.slots, level: upgrade.to }))
  if (upgrade.adds.speed > upgrade.adds.speedNow) lines.push(workWords('upgrade-speed', { speed: upgrade.adds.speed, level: upgrade.to }))
  return lines
}
