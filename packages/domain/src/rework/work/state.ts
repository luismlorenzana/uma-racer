// The work engine's state helpers (docs/rework/07-farm.md §2, §5, §6, §12; docs/rework/13-removals-and-plan-changes.md
// §5–§6): a new account's Farm and Training Hub, slots and who holds them, building order, and the Warehouse's free
// stock. Pure; every helper returns new objects and never writes into its inputs.
import type { ItemId } from '../items/catalogue'
import type { RecipeInput } from '../items/recipes'
import type { ReworkState } from '../types'
import {
  BUILDING_IDS, BUILDINGS, INITIAL_BUILDINGS, buildingSpeed, isBuildingId, slotsPerRoom, type BuildingId, type BuildingLevel, type RoomId,
} from '../farm/buildings'
import type { PlannedItem } from './kinds'
import type { Entry, ItemMovement, ItemStock, SlotRef, WorkRow, WorkState } from './types'

/** The account's Farm and Training Hub on day one: every building at Lv 1, an empty Warehouse, no work (13 §5). */
export function newWorkState<S extends ReworkState>(account: S): S & WorkState {
  if (Object.keys(account.work).length > 0) throw new RangeError('A new Farm starts with no work rows')
  return { ...account, items: {}, buildings: INITIAL_BUILDINGS, work: {} } as S & WorkState
}

// --- Buildings and slots --------------------------------------------------------------------------------------------

export const buildingLevel = (state: Pick<WorkState, 'buildings'>, building: BuildingId): BuildingLevel => state.buildings[building]?.level ?? 1
export const speedAt = (state: Pick<WorkState, 'buildings'>, building: BuildingId): number => buildingSpeed(buildingLevel(state, building))

/** Whether `slot` names a slot the building has at its current level; a malformed one throws (a caller's bug). */
export function slotExists(state: Pick<WorkState, 'buildings'>, slot: SlotRef): boolean {
  if (!isBuildingId(slot.building)) throw new RangeError(`No building ${String(slot.building)}`)
  const rooms = BUILDINGS[slot.building].rooms
  if (rooms.length > 0 ? slot.room === undefined || !rooms.includes(slot.room) : slot.room !== undefined) {
    throw new RangeError(`${slot.building} has no room ${String(slot.room)}`)
  }
  if (!Number.isInteger(slot.slot) || slot.slot < 0) throw new RangeError(`A slot index is a whole number ≥ 0: ${slot.slot}`)
  return slot.slot < slotsPerRoom(slot.building, buildingLevel(state, slot.building))
}

export const samePlace = (a: SlotRef, b: { readonly building: BuildingId; readonly room?: RoomId }): boolean =>
  a.building === b.building && a.room === b.room
export const sameSlot = (a: SlotRef, b: SlotRef): boolean => samePlace(a, b) && a.slot === b.slot

/** Tie-break order (07 §2, T127): 07 §1's buildings, then the facilities, then rooms in 05 §1's order, then slot. */
export function slotOrder(a: SlotRef, b: SlotRef): number {
  const building = BUILDING_IDS.indexOf(a.building) - BUILDING_IDS.indexOf(b.building)
  if (building !== 0) return building
  const rooms = BUILDINGS[a.building].rooms
  const room = (a.room === undefined ? -1 : rooms.indexOf(a.room)) - (b.room === undefined ? -1 : rooms.indexOf(b.room))
  return room !== 0 ? room : a.slot - b.slot
}

/** A row is working a slot while it holds started entries. */
export const holdsSlot = (row: WorkRow): boolean => row.entries.length > 0 && row.slot !== null

/** The outfit whose work holds `slot`, if any. */
export function slotHolder(state: Pick<WorkState, 'work'>, slot: SlotRef): string | undefined {
  for (const row of Object.values(state.work)) if (holdsSlot(row) && sameSlot(row.slot!, slot)) return row.outfitId
  return undefined
}

// --- Rows -----------------------------------------------------------------------------------------------------------

export const emptyRow = (outfitId: string): WorkRow => ({ outfitId, slot: null, entries: [], queue: [], last: null, dropped: null })

/** The state with her row replaced; a row holding nothing at all is removed. */
export function withRow<S extends WorkState>(state: S, row: WorkRow): S {
  const idle = row.entries.length === 0 && row.queue.length === 0 && row.last === null && row.dropped === null
  const work: Record<string, WorkRow> = { ...state.work }
  if (idle) delete work[row.outfitId]
  else work[row.outfitId] = row
  return { ...state, work }
}

/** The entry started from a plan (07 §2: the speed, inputs and EXP are frozen into it). */
export function entryFrom(request: Entry['request'], items: readonly PlannedItem[], startedAt: number, speed: number, fromQueue: boolean): Entry {
  return {
    request,
    seconds: items.map((item) => item.seconds),
    inputs: items.map((item) => item.inputs),
    outputs: items.map((item) => item.output),
    farmExp: items.map((item) => item.farmExp),
    startedAt,
    acceleratedMs: 0,
    collected: 0,
    speed,
    fromQueue,
  }
}

// --- The Warehouse --------------------------------------------------------------------------------------------------

/** Rows of item and quantity summed by item, in first-seen order. */
export function sumInputs(rows: readonly (readonly RecipeInput[])[]): RecipeInput[] {
  const total = new Map<ItemId, number>()
  for (const row of rows) for (const { item, qty } of row) total.set(item, (total.get(item) ?? 0) + qty)
  return [...total].map(([item, qty]) => ({ item, qty }))
}

export const stockOf = (items: ItemStock, item: ItemId): number => items[item] ?? 0

/** What the free stock lacks for `inputs`, item by item, in their order. */
export const shortfall = (items: ItemStock, inputs: readonly RecipeInput[]): RecipeInput[] =>
  inputs.flatMap(({ item, qty }) => (stockOf(items, item) < qty ? [{ item, qty: qty - stockOf(items, item) }] : []))

/** The most of `items` from the first, in order, whose inputs the free stock covers (02 §9: "Only 3 left now"). */
export function largestCoverable(stock: ItemStock, items: readonly PlannedItem[]): number {
  let covered = 0
  for (let n = 1; n <= items.length; n += 1) {
    if (shortfall(stock, sumInputs(items.slice(0, n).map((item) => item.inputs))).length > 0) break
    covered = n
  }
  return covered
}

/** Moves stock: `sign` −1 takes (the caller checked it's there), +1 gives. A count that reaches 0 leaves the map. */
export function moveStock(items: ItemStock, rows: readonly RecipeInput[], sign: 1 | -1): ItemStock {
  const next: Record<ItemId, number> = { ...items }
  for (const { item, qty } of rows) {
    const count = (next[item] ?? 0) + sign * qty
    if (count < 0) throw new RangeError(`The Warehouse has no ${qty} ${item}`)
    if (count === 0) delete next[item]
    else next[item] = count
  }
  return next
}

export const movements = (kind: ItemMovement['kind'], rows: readonly RecipeInput[], outfitId: string | null, at: number): ItemMovement[] =>
  rows.filter(({ qty }) => qty > 0).map(({ item, qty }) => ({ kind, item, qty, outfitId, at }))
