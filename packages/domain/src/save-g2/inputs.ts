// One strict parser per operation's input (docs/rework/13-removals-and-plan-changes.md §6; T134): exact keys, the
// right types, every id well formed. The mapped type makes an operation without a parser fail `tsc`. A malformed value
// is `null`, which the server answers as that operation's `invalid`; a rule (a busy Uma, short stock, a size outside
// 1–10, a sixth target) stays the operation's own refusal, in its plain words.
import { STATS, DISTANCE_CATEGORIES, type DistanceCategory, type Stats } from '../types'
import { INSPIRATION_SLOTS, type InspirationSlot } from '../inspiration'
import { parseRaceRun } from '../progression-race'
import type { CollectAllInput } from '../rework/check-in/collect-all'
import type { DevGrantInput } from '../rework/check-in/dev-grant'
import type { FinishRaceInput } from '../rework/check-in/finish-race'
import type { OperationInput, OperationName } from '../rework/check-in/once'
import { REPEAT_SIZINGS, type RepeatInput } from '../rework/check-in/repeat'
import { MAX_OFFSET_MINUTES, MINUTES_PER_DAY } from '../rework/check-in/schedule'
import { SPEED_UP_SPANS, type SpeedUpSpan } from '../rework/check-in/summary'
import { FEATURED_SLOTS } from '../rework/exchange/featured'
import { BUILDINGS, isBuildingId, type BuildingId, type RoomId } from '../rework/farm/buildings'
import { itemById } from '../rework/items/catalogue'
import type { PromotionPresetStats } from '../rework/tiers/promotion'
import type { RepeatSizing } from '../rework/types'
import { isRowId } from './kinds'
import {
  exactKeys, isLocalDay, isNonNegativeInt, isObject, isPositiveInt, isTimestamp, parseIds, parseSlotRef, parseWorkRequest,
} from './parse'

type InputParsers = { readonly [N in OperationName]: (value: unknown) => OperationInput<N> | null }

const isIndex = isNonNegativeInt
const isOffset = (value: unknown): value is number => Number.isSafeInteger(value) && Math.abs(value as number) <= MAX_OFFSET_MINUTES
const isDistance = (value: unknown): value is DistanceCategory => DISTANCE_CATEGORIES.includes(value as DistanceCategory)

/** `{ outfitId }`, `{ umaId }` and the like: one key holding an id. */
function idOnly<K extends string>(key: K): (value: unknown) => Record<K, string> | null {
  return (value) => (isObject(value) && exactKeys(value, [key]) && isRowId(value[key]) ? ({ [key]: value[key] } as Record<K, string>) : null)
}

function parseBuildings(value: unknown): BuildingId[] | null {
  return parseIds(value, Number.POSITIVE_INFINITY, (id) => typeof id === 'string' && isBuildingId(id)) as BuildingId[] | null
}

function parseSlots(value: unknown): ReturnType<typeof parseSlotRef>[] | null {
  if (!Array.isArray(value)) return null
  const slots = value.map(parseSlotRef)
  return slots.every((slot) => slot !== null) ? slots : null
}

function start(value: unknown): OperationInput<'start'> | null {
  if (!isObject(value) || !isRowId(value.outfitId)) return null
  if (value.from !== undefined) {
    if (!exactKeys(value, ['outfitId', 'from'], ['count']) || value.from !== 'dropped') return null
    if (value.count !== undefined && !isPositiveInt(value.count)) return null
    return value.count === undefined ? { outfitId: value.outfitId, from: 'dropped' } : { outfitId: value.outfitId, from: 'dropped', count: value.count }
  }
  if (!exactKeys(value, ['outfitId', 'slot', 'request'])) return null
  const slot = parseSlotRef(value.slot)
  const request = parseWorkRequest(value.request, true)
  return slot && request ? { outfitId: value.outfitId, slot, request } : null
}

function queue(value: unknown): OperationInput<'queue'> | null {
  if (!isObject(value) || !isRowId(value.outfitId)) return null
  const outfitId = value.outfitId
  if (exactKeys(value, ['outfitId', 'dismiss'])) return value.dismiss === true ? { outfitId, dismiss: true } : null
  if (exactKeys(value, ['outfitId', 'remove'])) return isIndex(value.remove) ? { outfitId, remove: value.remove } : null
  if (exactKeys(value, ['outfitId', 'move'])) {
    const move = value.move
    return isObject(move) && exactKeys(move, ['from', 'to']) && isIndex(move.from) && isIndex(move.to) ? { outfitId, move: { from: move.from, to: move.to } } : null
  }
  if (!exactKeys(value, ['outfitId', 'add'])) return null
  const add = value.add
  if (!isObject(add) || !exactKeys(add, ['request', 'building'], ['room']) || typeof add.building !== 'string' || !isBuildingId(add.building)) return null
  const rooms: readonly string[] = BUILDINGS[add.building].rooms
  if (add.room !== undefined && !rooms.includes(add.room as string)) return null
  const request = parseWorkRequest(add.request, true)
  if (!request) return null
  return { outfitId, add: add.room === undefined ? { request, building: add.building } : { request, building: add.building, room: add.room as RoomId } }
}

function collectAll(value: unknown): CollectAllInput | null {
  if (!isObject(value) || !exactKeys(value, [], ['places', 'shown'])) return null
  const places = value.places === undefined ? undefined : parseBuildings(value.places)
  const shown = value.shown === undefined ? undefined : parseSlots(value.shown)
  if (places === null || shown === null) return null
  return { ...(places ? { places } : {}), ...(shown ? { shown: shown as NonNullable<CollectAllInput['shown']> } : {}) }
}

function repeat(value: unknown): RepeatInput | null {
  if (!isObject(value) || !exactKeys(value, [], ['outfitIds', 'places', 'utcOffsetMin'])) return null
  const outfitIds = value.outfitIds === undefined ? undefined : parseIds(value.outfitIds)
  const places = value.places === undefined ? undefined : parseBuildings(value.places)
  if (outfitIds === null || places === null || (value.utcOffsetMin !== undefined && !isOffset(value.utcOffsetMin))) return null
  return {
    ...(outfitIds ? { outfitIds } : {}),
    ...(places ? { places } : {}),
    ...(value.utcOffsetMin === undefined ? {} : { utcOffsetMin: value.utcOffsetMin as number }),
  }
}

function speedUp(value: unknown): OperationInput<'speed-up'> | null {
  if (!isObject(value)) return null
  if (value.all !== undefined) {
    if (!exactKeys(value, ['all', 'span'], ['utcOffsetMin']) || value.all !== true || !SPEED_UP_SPANS.includes(value.span as SpeedUpSpan)) return null
    if (value.utcOffsetMin !== undefined && !isOffset(value.utcOffsetMin)) return null
    const span = value.span as SpeedUpSpan
    return value.utcOffsetMin === undefined ? { all: true, span } : { all: true, span, utcOffsetMin: value.utcOffsetMin as number }
  }
  if (!exactKeys(value, ['outfitId', 'startedAt', 'tickets']) || !isRowId(value.outfitId) || !isTimestamp(value.startedAt) || !isPositiveInt(value.tickets)) return null
  return { outfitId: value.outfitId, startedAt: value.startedAt, tickets: value.tickets }
}

function finish(value: unknown): OperationInput<'finish'> | null {
  if (!isObject(value) || !exactKeys(value, ['outfitId', 'startedAt']) || !isRowId(value.outfitId) || !isTimestamp(value.startedAt)) return null
  return { outfitId: value.outfitId, startedAt: value.startedAt }
}

function upgrade(value: unknown): OperationInput<'upgrade'> | null {
  return isObject(value) && exactKeys(value, ['building']) && typeof value.building === 'string' && isBuildingId(value.building) ? { building: value.building } : null
}

function parseStats(value: unknown): Stats | null {
  if (!isObject(value) || !exactKeys(value, STATS)) return null
  if (!STATS.every((stat) => typeof value[stat] === 'number' && Number.isFinite(value[stat]) && (value[stat] as number) >= 0)) return null
  return Object.fromEntries(STATS.map((stat) => [stat, value[stat]])) as unknown as Stats
}

function promote(value: unknown): OperationInput<'promote'> | null {
  if (!isObject(value) || !exactKeys(value, ['umaId', 'presets']) || !isRowId(value.umaId) || !isObject(value.presets) ||
    !exactKeys(value.presets, DISTANCE_CATEGORIES)) return null
  const presets: Partial<Record<DistanceCategory, { stats: Stats; skillPoints: number }>> = {}
  for (const distance of DISTANCE_CATEGORIES) {
    const preset = value.presets[distance]
    if (!isObject(preset) || !exactKeys(preset, ['stats', 'skillPoints'])) return null
    const stats = parseStats(preset.stats)
    if (!stats || typeof preset.skillPoints !== 'number' || !Number.isFinite(preset.skillPoints) || preset.skillPoints < 0) return null
    presets[distance] = { stats, skillPoints: preset.skillPoints }
  }
  return { umaId: value.umaId, presets: presets as PromotionPresetStats }
}

/** `buy` and `sell`: an id, a whole quantity and the unit price the screen showed. Prices and stock are the rule's. */
function trade<K extends 'sku' | 'itemId'>(key: K): (value: unknown) => ({ readonly [P in K]: string } & { readonly qty: number; readonly unitPrice: number }) | null {
  return (value) => {
    if (!isObject(value) || !exactKeys(value, [key, 'qty', 'unitPrice']) || !isRowId(value[key]) || !Number.isSafeInteger(value.qty) ||
      !isNonNegativeInt(value.unitPrice)) return null
    return { [key]: value[key], qty: value.qty, unitPrice: value.unitPrice } as { readonly [P in K]: string } & { readonly qty: number; readonly unitPrice: number }
  }
}

/** A preset edit: her id, the preset, and the one field the edit sets. */
function presetEdit<K extends string, T>(key: K, parse: (value: unknown) => T | null): (value: unknown) => ({ umaId: string; preset: DistanceCategory } & Record<K, T>) | null {
  return (value) => {
    if (!isObject(value) || !exactKeys(value, ['umaId', 'preset', key]) || !isRowId(value.umaId) || !isDistance(value.preset)) return null
    const parsed = parse(value[key])
    return parsed === null ? null : ({ umaId: value.umaId, preset: value.preset, [key]: parsed } as { umaId: string; preset: DistanceCategory } & Record<K, T>)
  }
}

function idMap(value: unknown, keyOk: (key: string) => boolean): Record<string, string> | null {
  if (!isObject(value) || !Object.entries(value).every(([key, id]) => keyOk(key) && isRowId(id))) return null
  return { ...(value as Record<string, string>) }
}

const isClockMinute = (t: unknown): boolean => Number.isSafeInteger(t) && (t as number) >= 0 && (t as number) < MINUTES_PER_DAY

function finishRace(value: unknown): FinishRaceInput | null {
  if (!isObject(value) || !exactKeys(value, ['umaId', 'raceId', 'placement', 'localDay', 'board', 'run'])) return null
  if (!isRowId(value.umaId) || !isRowId(value.raceId) || !isPositiveInt(value.placement) || !isLocalDay(value.localDay)) return null
  const board = parseIds(value.board, FEATURED_SLOTS.length)
  const run = parseRaceRun(value.run)
  const her = run?.field.find((runner) => runner.isPlayer)
  // The run is hers, and her place in it is the placement the operation pays.
  if (!board || !run || her?.umaId !== value.umaId || her.placement !== value.placement) return null
  return { umaId: value.umaId, raceId: value.raceId, placement: value.placement, localDay: value.localDay, board, run }
}

function devGrant(value: unknown): DevGrantInput | null {
  const keys = ['items', 'prizeMoney', 'umaTickets', 'finish', 'gate'] as const
  if (!isObject(value) || !exactKeys(value, [], keys) || Object.values(value).every((v) => v === undefined)) return null
  const items = value.items
  if (items !== undefined && (!isObject(items) || Object.keys(items).length === 0 ||
    !Object.entries(items).every(([item, qty]) => isRowId(item) && itemById(item) !== undefined && isPositiveInt(qty)))) return null
  if ((value.prizeMoney !== undefined && !isPositiveInt(value.prizeMoney)) || (value.umaTickets !== undefined && !isPositiveInt(value.umaTickets)) ||
    (value.finish !== undefined && !isRowId(value.finish)) || (value.gate !== undefined && !isRowId(value.gate))) return null
  return {
    ...(items === undefined ? {} : { items: { ...(items as Record<string, number>) } }),
    ...(value.prizeMoney === undefined ? {} : { prizeMoney: value.prizeMoney as number }),
    ...(value.umaTickets === undefined ? {} : { umaTickets: value.umaTickets as number }),
    ...(value.finish === undefined ? {} : { finish: value.finish as string }),
    ...(value.gate === undefined ? {} : { gate: value.gate as string }),
  }
}

/** Every operation's input parser, by name (13 §6). */
export const OPERATION_INPUTS: InputParsers = Object.freeze({
  start,
  queue,
  collect: idOnly('outfitId'),
  'collect-all': collectAll,
  repeat,
  recall: idOnly('outfitId'),
  'speed-up': speedUp,
  finish,
  upgrade,
  'advance-scenario': idOnly('umaId'),
  promote,
  induct: idOnly('umaId'),
  buy: trade('sku'),
  sell: trade('itemId'),
  'unlock-uma': idOnly('outfitId'),
  'exchange-shards': (value: unknown) => (isObject(value) && exactKeys(value, []) ? {} : null),
  'set-targets': (value: unknown) => {
    if (!isObject(value) || !exactKeys(value, ['outfitIds'])) return null
    const outfitIds = parseIds(value.outfitIds)
    return outfitIds ? { outfitIds } : null
  },
  'set-check-in-times': (value: unknown) =>
    (isObject(value) && exactKeys(value, ['times']) && Array.isArray(value.times) && value.times.every(isClockMinute) ? { times: [...(value.times as number[])] } : null),
  'set-repeat-sizing': (value: unknown) =>
    (isObject(value) && exactKeys(value, ['sizing']) && REPEAT_SIZINGS.includes(value.sizing as RepeatSizing) ? { sizing: value.sizing as RepeatSizing } : null),
  'set-card-set': presetEdit('cardSetIds', (value) => parseIds(value)),
  'set-assignments': presetEdit('assignments', (value) => idMap(value, isRowId)),
  'set-lineage': presetEdit('lineage', (value) => idMap(value, (slot) => INSPIRATION_SLOTS.includes(slot as InspirationSlot))),
  'set-active-nodes': presetEdit('nodeIds', (value) => parseIds(value)),
  'set-loadout': presetEdit('skillIds', (value) => parseIds(value)),
  'finish-race': finishRace,
  'dev-grant': devGrant,
})
