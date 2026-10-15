// The one session sheet (docs/rework/05-training-hub.md §2, §8, §10; docs/rework/06-cards-and-bonds.md §6, §10;
// docs/rework/02-check-ins-and-notifications.md §3, §9; T139), read from one work view. Pure:
// 1. **Uma** for T138's picker: what she still needs here (`remainingFor`), Free and Ready first; a busy one "Busy until
//    14:20" (her chain's end) with Queue only when her running session is at this facility and room and her queue has
//    room (`MAX_QUEUE`), and Recall first for a running Farm job (05 §2).
// 2. **Unlocks**: her items here, oldest layer first in canonical order (`layerUnlocks` of each open layer, kept by
//    `facilityOf` and `roomAccepts`, the next layer shown locked), each read with `unlockStatus` where the work ahead is
//    `workAhead(row)` plus the items picked above it. Available ones show their dish, its free stock less the picks
//    above, and their minutes; none in stock reads "0 in Warehouse · Cook". The sheet pre-picks `fitSize` of the next
//    items (`nextUnlocks`), capped by stock and `SESSION_MAX_UNLOCKS`; unlocks the link names arrive picked instead. At
//    the Dojo the list is the bonds picked from the Card Library, each card's own dish and room.
// 3. **Confirm**: the dishes to reserve, the minutes and each finish time; then `start` on the slot (the slot card's,
//    else hers, else the first free one of the room in `slotsOf` order) or `queue` behind her running session here,
//    each run on the current state first so a disabled button says why in the rule's own words.
import { clockTime, fitSize, hasReady, say, type Words } from '@racer/domain/rework/check-in'
import { BUILDINGS, type FacilityId, type RoomId } from '@racer/domain/rework/farm'
import type { ItemId } from '@racer/domain/rework/items'
import { remainingFor, workAhead } from '@racer/domain/rework/planner'
import { isRefusal, TIER_REFUSALS, type UmaState } from '@racer/domain/rework/tiers'
import {
  facilityOf, isOpen, isRoomOf, layerUnlocks, nextUnlocks, resolveUnlock, roomAccepts, roomsFor, sessionRequest, sessionSeconds,
  SESSION_MAX_UNLOCKS, TRAINING_REFUSALS, unlockKey, unlockStatus, type Unlock, type UnlockRef,
} from '@racer/domain/rework/training'
import {
  chainEnd, holdsSlot, MAX_QUEUE, queue, SESSION_KIND, slotHolder, slotsOf, speedAt, start, statusOf, stockOf, type QueueInput, type SlotRef,
  type StartInput, type WorkState,
} from '@racer/domain/rework/work'
import type { WorkView } from '../../../ui/work/view'
import { duration } from '../../../ui/labels'
import type { WordsContext } from '../../../ui/work/words'
import { dishWords, itemState, itemWords, ruleWords, unlockName, type Content } from '../common'
import { trainingWords } from '../words'
import type { SessionQuery } from './query'

// ---- Uma (step 1) ---------------------------------------------------------------------------------------------------

export interface SessionUmaRow {
  readonly umaId: string
  readonly status: 'free' | 'ready' | 'working'
  /** Her unlocks left here (bonds still to pick cards for, at the Dojo). */
  readonly left: number
  /** Of those, how many have a dish in the free stock now. */
  readonly ready: number
  /** When her work ends, while she works. */
  readonly until: number | null
  /** Her running session is at this facility and room, and her queue has room: Queue adds to it. */
  readonly canQueue: boolean
  /** Her running work is a Farm job: Recall frees her first (05 §2). */
  readonly farmJob: boolean
  /** The picker's line under her tile. */
  readonly line: string
  /** Why a tap on her row can't pick her; Queue or Recall may still show. */
  readonly reason: string | null
  /** The picker's "Left here" order: Free and Ready first, then the most left here. */
  readonly order: number
}

const sameRoom = (slot: SlotRef, room: RoomId | null): boolean => (slot.room ?? null) === room

/** Every owned Uma as the sheet's picker shows her (05 §8 step 1). */
export function sessionUmaRows(view: WorkView, facility: FacilityId, room: RoomId | null, context: WordsContext): ReadonlyMap<string, SessionUmaRow> {
  const { settled, now, env } = view
  const rows = new Map<string, SessionUmaRow>()
  for (const uma of Object.values(settled.umas)) {
    const row = settled.work[uma.outfitId]
    const status = statusOf(row, now)
    const remaining = remainingFor(settled, uma.outfitId).filter((entry) => entry.facility === facility)
    const left = remaining.reduce((sum, entry) => sum + (entry.kind === 'unlock' ? 1 : entry.count), 0)
    const used = new Map<ItemId, number>()
    let ready = 0
    for (const entry of remaining) {
      if (entry.kind !== 'unlock') continue
      const taken = used.get(entry.dishId) ?? 0
      if (stockOf(settled.items, entry.dishId) > taken) {
        ready += 1
        used.set(entry.dishId, taken + 1)
      }
    }
    const last = row?.entries.at(-1)
    const working = status === 'working'
    const until = working ? chainEnd(settled, row!, now, env) : null
    const here = working && row!.slot !== null && row!.slot.building === facility && sameRoom(row!.slot, room)
    const canQueue = here && last?.request.kind === SESSION_KIND && row!.queue.length < MAX_QUEUE
    const farmJob = working && last !== undefined && last.request.kind !== SESSION_KIND
    const line = facility === 'dojo'
      ? (left > 0 ? trainingWords('left-bonds', { n: left }) : trainingWords('left-here-none'))
      : (left > 0 ? trainingWords('left-here', { n: left, ready }) : trainingWords('left-here-none'))
    rows.set(uma.outfitId, {
      umaId: uma.outfitId,
      status,
      left,
      ready,
      until,
      canQueue,
      farmJob,
      line,
      reason: until === null ? null : trainingWords('busy-until', { time: clockTime(until, context.utcOffsetMin) }),
      order: (status === 'free' ? 2_000 : status === 'ready' ? 1_000 : 0) + left,
    })
  }
  return rows
}

// ---- Unlocks (step 2) -----------------------------------------------------------------------------------------------

export type SessionItemState = 'available' | 'waiting' | 'pending' | 'later' | 'open'

export interface SessionItem {
  readonly key: string
  readonly unlock: Unlock | null
  /** The ref as listed: a bond's card even when it can't be bonded. */
  readonly ref: UnlockRef
  readonly name: string
  /** "Cabbage Salad (grade 3)"; null for a card past her tier. */
  readonly dish: string | null
  readonly dishId: ItemId | null
  /** Real seconds at the facility's speed now. */
  readonly seconds: number
  readonly state: SessionItemState
  /** "Needs Speed grade 1 first.", "In session · opens 04:45", "Opens in scenario 3 · Trackblazer". */
  readonly words: string | null
  /** The dish's free stock, less what the picks above it reserve. */
  readonly stock: number
  readonly picked: boolean
  /** Its checkbox can change: available, and a dish left for it unless it's already picked. */
  readonly pickable: boolean
}

export interface SessionInput {
  readonly facility: FacilityId
  readonly umaId: string | null
  readonly room: RoomId | null
  /** The owner's picks in the sheet, or null for the sheet's own: what the link names, else the fitted pre-pick. */
  readonly picks: readonly UnlockRef[] | null
  readonly query: Pick<SessionQuery, 'unlocks' | 'slot'>
}

export type SessionMode = 'start' | 'queue'

export type SessionAction =
  | { readonly mode: 'start'; readonly input: StartInput; readonly refusal: Words | null }
  | { readonly mode: 'queue'; readonly input: QueueInput; readonly refusal: Words | null }
  | { readonly mode: 'blocked'; readonly words: string }

export interface SessionConfirm {
  /** Each dish and how many the session reserves. */
  readonly dishes: readonly { readonly item: ItemId; readonly qty: number }[]
  readonly seconds: number
  /** Each picked unlock's end, in order. */
  readonly finishes: readonly { readonly name: string; readonly at: number }[]
}

export interface SessionView {
  readonly facility: FacilityId
  readonly uma: UmaState | null
  /** `unknown-uma`'s words when the link names an Uma the Stable doesn't hold. */
  readonly unknown: string | null
  readonly mode: SessionMode
  readonly room: RoomId | null
  readonly rooms: readonly RoomId[]
  readonly items: readonly SessionItem[]
  readonly picks: readonly Unlock[]
  /** When the first picked unlock would start: now, or the end of her work here for a queued session. */
  readonly start: number
  readonly confirm: SessionConfirm
  readonly action: SessionAction
}

/** The room the sheet opens on: the link's, else its first unlock's, else her session's here, else the first (T139). */
export function openingRoom(view: WorkView, facility: FacilityId, query: SessionQuery, content: Content): RoomId | null {
  const rooms = BUILDINGS[facility].rooms
  if (rooms.length === 0) return null
  if (query.room !== null) return query.room
  const uma = query.uma === null ? undefined : view.settled.umas[query.uma]
  for (const ref of query.unlocks) {
    const resolved = uma === undefined && ref.kind === 'bond' ? null : safeResolve(ref, uma?.tier ?? 1, content)
    const room = resolved === null ? undefined : roomsFor(resolved)[0]
    if (room !== undefined) return room
  }
  const slot = query.uma === null ? null : view.settled.work[query.uma]?.slot ?? null
  if (slot !== null && slot.building === facility && slot.room !== undefined) return slot.room
  if (query.slot !== null) {
    const asked = slotsOf(view.settled, facility).filter((one) => one.slot === query.slot)
    if (asked.length === 1 && asked[0]!.room !== undefined) return asked[0]!.room
  }
  return rooms[0]!
}

/** A ref resolved for her tier, or null for a card the content lacks or a tier that never allows it. */
function safeResolve(ref: UnlockRef, tier: UmaState['tier'], content: Content): Unlock | null {
  if (ref.kind === 'bond' && !content.cards.has(ref.target)) return null
  try {
    const resolved = resolveUnlock(ref, tier, content)
    return isRefusal(resolved) ? null : resolved
  } catch {
    return null
  }
}

/** The fitted pre-pick (05 §8): `fitSize` of the next items, capped by the dishes in stock and `SESSION_MAX_UNLOCKS`. */
export function prePick(view: WorkView, uma: UmaState, facility: FacilityId, room: RoomId | null, start: number, utcOffsetMin: number): readonly Unlock[] {
  if (facility === 'dojo' || !isRoomOf(facility, room)) return []
  const { settled } = view
  const chain = nextUnlocks(uma.build, uma, facility, room, SESSION_MAX_UNLOCKS, workAhead(settled.work[uma.outfitId]))
  if (chain.length === 0) return []
  const speed = speedAt(settled, facility)
  const fit = fitSize(start, chain.map((entry) => sessionSeconds(entry.grade, speed)), settled.profile.checkIns, utcOffsetMin)
  const taken = new Map<ItemId, number>()
  let covered = 0
  for (const entry of chain) {
    const used = taken.get(entry.dishId) ?? 0
    if (stockOf(settled.items, entry.dishId) <= used) break
    taken.set(entry.dishId, used + 1)
    covered += 1
  }
  return chain.slice(0, Math.min(fit, covered, SESSION_MAX_UNLOCKS))
}

/** The slot a start takes: the slot card's when free (or hers), else hers here, else the room's first free one. */
export function chooseSlot(settled: WorkState, facility: FacilityId, room: RoomId | null, outfitId: string, asked: number | null): SlotRef | null {
  const slots = slotsOf(settled, facility).filter((slot) => sameRoom(slot, room))
  const usable = (slot: SlotRef) => {
    const holder = slotHolder(settled, slot)
    return holder === undefined || holder === outfitId
  }
  const card = asked === null ? undefined : slots.find((slot) => slot.slot === asked)
  if (card !== undefined && usable(card)) return card
  return slots.find((slot) => slotHolder(settled, slot) === outfitId) ?? slots.find((slot) => slotHolder(settled, slot) === undefined) ?? null
}

/** Why no slot of the room is free: one is ready to collect, or when the next one frees. */
export function noSlotWords(view: WorkView, facility: FacilityId, room: RoomId | null, context: WordsContext): string {
  const { settled, now, env } = view
  const holders = Object.values(settled.work).filter((row) => holdsSlot(row) && row.slot!.building === facility && sameRoom(row.slot!, room))
  if (holders.some((row) => hasReady(row, now))) return trainingWords('no-slot-ready')
  const ends = holders.map((row) => chainEnd(settled, row, now, env))
  return trainingWords('no-slot', { time: clockTime(Math.min(...ends), context.utcOffsetMin) })
}

/** Her items here in the sheet's order: oldest layer first, canonical within it, then the next layer, locked. */
function listed(uma: UmaState, facility: FacilityId, room: RoomId | null): readonly Unlock[] {
  const last = Math.min(5, uma.scenario + 1)
  const list: Unlock[] = []
  for (let s = 1; s <= last; s += 1) {
    for (const entry of layerUnlocks(s as Unlock['layer'])) {
      if (facilityOf(entry.kind) === facility && roomAccepts(room, entry) && !isOpen(uma.build, entry)) list.push(entry)
    }
  }
  return list
}

const refOf = (entry: UnlockRef): UnlockRef => ({ kind: entry.kind, target: entry.target })

/** The whole sheet at the view's `now`. */
export function sessionView(view: WorkView, input: SessionInput, context: WordsContext, content: Content): SessionView {
  const { settled, now, env } = view
  const { facility } = input
  const rooms = BUILDINGS[facility].rooms
  const room = rooms.length === 0 ? null : input.room !== null && isRoomOf(facility, input.room) ? input.room : rooms[0]!
  const uma = input.umaId === null ? null : settled.umas[input.umaId] ?? null
  const unknown = input.umaId !== null && uma === null ? TIER_REFUSALS['unknown-uma'] : null
  const empty: SessionConfirm = { dishes: [], seconds: 0, finishes: [] }
  if (uma === null) {
    return {
      facility, uma, unknown, mode: 'start', room, rooms, items: [], picks: [], start: now, confirm: empty,
      action: { mode: 'blocked', words: unknown ?? trainingWords('pick-uma-first') },
    }
  }

  const row = settled.work[uma.outfitId]
  const status = statusOf(row, now)
  const last = row?.entries.at(-1)
  const here = status === 'working' && row!.slot !== null && row!.slot.building === facility && sameRoom(row!.slot, room)
  const mode: SessionMode = here && last?.request.kind === SESSION_KIND ? 'queue' : 'start'
  const begin = mode === 'queue' ? chainEnd(settled, row!, now, env) : now
  const speed = speedAt(settled, facility)

  // What is picked: the owner's, else what the link names, else the fitted pre-pick.
  const wanted = input.picks ?? (input.query.unlocks.length > 0 ? input.query.unlocks : prePick(view, uma, facility, room, begin, context.utcOffsetMin))
  const wantedKeys = new Set(wanted.map(unlockKey))

  // The list: her items here, or at the Dojo the bonds picked from the Library, in the order picked.
  const candidates: { ref: UnlockRef; unlock: Unlock | null }[] = facility === 'dojo'
    ? wanted.filter((ref) => ref.kind === 'bond').map((ref) => ({ ref: refOf(ref), unlock: safeResolve(ref, uma.tier, content) }))
    : listed(uma, facility, room).map((entry) => ({ ref: refOf(entry), unlock: entry }))

  const made: UnlockRef[] = [...workAhead(row)]
  const reserved = new Map<ItemId, number>()
  const items: SessionItem[] = []
  const picks: Unlock[] = []
  for (const { ref, unlock } of candidates) {
    const key = unlockKey(ref)
    const name = unlockName(ref, content)
    if (unlock === null) {
      const card = content.cards.get(ref.target)
      const later = card === undefined ? null : resolveUnlock(ref, uma.tier, content)
      items.push({
        key, unlock: null, ref, name, dish: null, dishId: null, seconds: 0, state: 'later',
        words: later !== null && isRefusal(later) ? ruleWords(say(later.reason, later.data), context, content) : null,
        stock: 0, picked: false, pickable: false,
      })
      continue
    }
    const stock = stockOf(settled.items, unlock.dishId) - (reserved.get(unlock.dishId) ?? 0)
    const base = { key, unlock, ref, name, dish: dishWords(unlock.dishId), dishId: unlock.dishId, seconds: sessionSeconds(unlock.grade, speed), stock }
    const status = unlockStatus(uma.build, uma, unlock, made)
    if (isRefusal(status)) {
      const later = status.code === 'later-layer' || status.code === 'card-era'
      items.push({ ...base, state: later ? 'later' : 'waiting', words: ruleWords(say(status.reason, status.data), context, content), picked: false, pickable: false })
      continue
    }
    if (status.status !== 'available') {
      const state = itemState(uma, row, unlock, now, settled.items)
      const words = state.kind === 'open' && unlock.kind === 'bond'
        ? ruleWords(say(TRAINING_REFUSALS['already-bonded'], { card: unlock.target, uma: uma.outfitId }), context, content)
        : itemWords(state, unlock, context, content)
      items.push({ ...base, state: state.kind === 'open' ? 'open' : 'pending', words, picked: false, pickable: false })
      continue
    }
    const picked = wantedKeys.has(key)
    if (picked) {
      made.push(unlock)
      reserved.set(unlock.dishId, (reserved.get(unlock.dishId) ?? 0) + 1)
      picks.push(unlock)
    }
    items.push({ ...base, state: 'available', words: null, picked, pickable: picked || stock > 0 })
  }

  // Confirm: the dishes it reserves, the time and each end.
  const dishes = new Map<ItemId, number>()
  let elapsed = 0
  const finishes: { name: string; at: number }[] = []
  for (const entry of picks) {
    dishes.set(entry.dishId, (dishes.get(entry.dishId) ?? 0) + 1)
    elapsed += sessionSeconds(entry.grade, speed)
    finishes.push({ name: unlockName(entry, content), at: begin + Math.round(elapsed * 1000) })
  }
  const confirm: SessionConfirm = { dishes: [...dishes].map(([item, qty]) => ({ item, qty })), seconds: elapsed, finishes }

  return { facility, uma, unknown, mode, room, rooms, items, picks, start: begin, confirm, action: sessionAction(view, facility, room, uma, mode, picks, input.query.slot, context) }
}

/** What Start or Add to queue does, run on the current state first (05 §10): a refusal reads in the rule's own words. */
function sessionAction(view: WorkView, facility: FacilityId, room: RoomId | null, uma: UmaState, mode: SessionMode, picks: readonly Unlock[], asked: number | null, context: WordsContext): SessionAction {
  const { settled, now, env } = view
  if (picks.length === 0) return { mode: 'blocked', words: trainingWords('pick-unlock') }
  const request = sessionRequest(picks.map(refOf))
  if (mode === 'queue') {
    const input: QueueInput = { outfitId: uma.outfitId, add: { request, building: facility, ...(room === null ? {} : { room }) } }
    const tried = queue(settled, input, now, env)
    return { mode, input, refusal: isRefusal(tried) ? say(tried.reason, tried.data) : null }
  }
  const slot = chooseSlot(settled, facility, room, uma.outfitId, asked)
  if (slot === null) return { mode: 'blocked', words: noSlotWords(view, facility, room, context) }
  const input: StartInput = { outfitId: uma.outfitId, slot, request }
  const tried = start(settled, input, now, env)
  return { mode, input, refusal: isRefusal(tried) ? say(tried.reason, tried.data) : null }
}

/** "12 h 36 m". */
export const totalWords = (confirm: SessionConfirm): string =>
  confirm.finishes.length === 1
    ? trainingWords('total-one', { time: duration(confirm.seconds) })
    : trainingWords('total', { n: confirm.finishes.length, time: duration(confirm.seconds) })
