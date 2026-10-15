// Strict parsers for generation 2's rows (docs/rework/13-removals-and-plan-changes.md §6; T134), in today's style: exact
// keys, unknown keys refused, `T | null`. Each checks a row's id against its data, whole numbers and ranges, and the
// shapes the rework's state holds. Where a rework type holds today's shape, today's parser is reused: careers
// (`parseScenarioJourney`), badges (`parseBadgeState`) and flair (`parseFlairEvent`). Receipts are checked as JSON
// objects within the row bound, not field by field. Pure: no clock, no I/O.
import { badgeStateId, parseBadgeState, parseFlairEvent } from '../badges'
import { CARD_SET_SIZE } from '../constellation'
import { flairEventId } from '../flair'
import { INSPIRATION_SLOTS, inspirationGoldKey, type InspirationSlot } from '../inspiration'
import { parseRaceRun } from '../progression-race'
import { parseScenarioJourney, type RacePreferences, type ScenarioJourney } from '../save'
import { DISTANCE_CATEGORIES, STATS, STRATEGIES, SURFACES, type DistanceCategory, type Stats } from '../types'
import { REPEAT_SIZINGS } from '../rework/check-in/repeat'
import { MAX_CHECK_INS, MIN_CHECK_INS, MINUTES_PER_DAY } from '../rework/check-in/schedule'
import { OPERATIONS } from '../rework/check-in/once'
import { MAX_TARGETS } from '../rework/planner/targets'
import { TREE_CARD_NODES } from '../rework/constellation/sizes'
import { nodeOrder } from '../rework/constellation/tree'
import { assertLocalDay } from '../rework/exchange/purse'
import type { ItemLedgerReason } from '../rework/exchange/ledger'
import { BUILDINGS, isBuildingId, isBuildingLevel, MAX_BUILDING_LEVEL, slotsPerRoom, type RoomId } from '../rework/farm/buildings'
import { FARM_LEVEL_CAP } from '../rework/farm/level'
import { isItemGrade, itemById, type ItemGrade } from '../rework/items/catalogue'
import type { RecipeInput } from '../rework/items/recipes'
import { RACING_LEVELS_PER_TIER, SCENARIOS_PER_TIER, TIERS } from '../rework/tiers/map'
import { extraNode } from '../rework/training/extra'
import { UNLOCK_KINDS } from '../rework/training/unlocks'
import {
  LEDGER_BALANCE, type AccountProfile, type DailyPurse, type ExpeditionRun, type LedgerEntry, type LedgerReason, type LedgerResource,
  type OperationRecord, type Preset, type Refusal, type ScenarioOfTier, type Tier, type TierHistoryEntry, type TierHistoryPreset,
  type UmaBuild, type UmaState,
} from '../rework/types'
import { MAX_ITEMS_PER_ENTRY, MAX_QUEUE, MIN_ITEMS_PER_ENTRY } from '../rework/work/operations'
import {
  SESSION_KIND, type DroppedQueue, type Entry, type LastWork, type SlotRef, type UnlockRef, type WorkOutput, type WorkRequest, type WorkRow,
} from '../rework/work/types'
import { isEntityKind, isLogKind, isOperationId, isRowId, KIND_SCHEMA, SAVE_GENERATION, SAVE_LIMITS, type EntityKind, type LogKind } from './kinds'
import type { EntityData, EntityRow, ItemLedgerRow, LogData, LogRow, RaceResultRow } from './rows'

// --- Primitives -----------------------------------------------------------------------------------------------------

export const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/**
 * Every required key present, and nothing but the required and optional keys. A key holding `undefined` is absent, as
 * JSON reads it, so a value kept by structured clone (Dexie) parses as its JSON copy does.
 */
export function exactKeys(value: Record<string, unknown>, keys: readonly string[], optional: readonly string[] = []): boolean {
  const actual = Object.keys(value).filter((key) => value[key] !== undefined)
  return keys.every((key) => value[key] !== undefined && Object.hasOwn(value, key)) && actual.every((key) => keys.includes(key) || optional.includes(key))
}

export const isNonNegativeInt = (value: unknown): value is number => Number.isSafeInteger(value) && (value as number) >= 0
export const isPositiveInt = (value: unknown): value is number => Number.isSafeInteger(value) && (value as number) > 0
export const isTimestamp = isNonNegativeInt
const isIntIn = (value: unknown, min: number, max: number): value is number =>
  Number.isSafeInteger(value) && (value as number) >= min && (value as number) <= max
const isFiniteNonNegative = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0
const isText = (value: unknown, max = 500): value is string => typeof value === 'string' && value.length > 0 && value.length <= max
const isItemId = (value: unknown): value is string => isRowId(value) && itemById(value) !== undefined

/** A device's local date, `YYYY-MM-DD` of the civil calendar (09 §3.3). */
export function isLocalDay(value: unknown): value is string {
  if (typeof value !== 'string') return false
  try {
    assertLocalDay(value)
    return true
  } catch {
    return false
  }
}

/** Unique ids, each passing `check`, at most `max`. */
export function parseIds(value: unknown, max = Number.POSITIVE_INFINITY, check: (id: unknown) => boolean = isRowId): string[] | null {
  if (!Array.isArray(value) || value.length > max || !value.every(check)) return null
  return new Set(value).size === value.length ? [...(value as string[])] : null
}

/**
 * The UTF-8 bytes of `value` as JSON: what a row, an input or a request weighs against `SAVE_LIMITS`. Counted by hand,
 * so the module reads no platform encoder.
 */
export function jsonBytes(value: unknown): number {
  const text = JSON.stringify(value) ?? ''
  let bytes = 0
  for (let i = 0; i < text.length; i += 1) {
    const code = text.charCodeAt(i)
    if (code < 0x80) bytes += 1
    else if (code < 0x800) bytes += 2
    else if (code >= 0xd800 && code <= 0xdbff && i + 1 < text.length) {
      bytes += 4
      i += 1
    } else bytes += 3
  }
  return bytes
}

/** A JSON value: null, a boolean, a finite number, a string, or arrays and plain objects of them. */
export function isJson(value: unknown): boolean {
  if (value === null || typeof value === 'boolean' || typeof value === 'string') return true
  if (typeof value === 'number') return Number.isFinite(value)
  if (Array.isArray(value)) return value.every(isJson)
  // An object's `undefined` field is one JSON leaves out.
  if (isObject(value)) return Object.getPrototypeOf(value) === Object.prototype && Object.values(value).every((v) => v === undefined || isJson(v))
  return false
}

/** A receipt as stored: a JSON object within the row bound (receipts are not re-checked field by field). */
export const isReceipt = (value: unknown): value is Record<string, unknown> =>
  isObject(value) && isJson(value) && jsonBytes(value) <= SAVE_LIMITS.rowBytes

// --- Shared shapes --------------------------------------------------------------------------------------------------

export function parseRefusal(value: unknown): Refusal | null {
  if (!isObject(value) || !exactKeys(value, ['refused', 'code', 'reason'], ['data'])) return null
  if (value.refused !== true || !isText(value.code, 80) || !isText(value.reason)) return null
  if (value.data !== undefined) {
    if (!isObject(value.data) || !Object.values(value.data).every((v) => typeof v === 'string' || (typeof v === 'number' && Number.isFinite(v)))) return null
    return { refused: true, code: value.code, reason: value.reason, data: { ...(value.data as Record<string, string | number>) } }
  }
  return { refused: true, code: value.code, reason: value.reason }
}

function parseStats(value: unknown): Stats | null {
  if (!isObject(value) || !exactKeys(value, STATS) || !STATS.every((stat) => isFiniteNonNegative(value[stat]))) return null
  return Object.fromEntries(STATS.map((stat) => [stat, value[stat]])) as unknown as Stats
}

const isDistance = (value: unknown): value is DistanceCategory => DISTANCE_CATEGORIES.includes(value as DistanceCategory)
const isTier = (value: unknown): value is Tier => isIntIn(value, 1, TIERS)
const isScenario = (value: unknown): value is ScenarioOfTier => isIntIn(value, 1, SCENARIOS_PER_TIER)
const isSlotName = (value: unknown): value is InspirationSlot => INSPIRATION_SLOTS.includes(value as InspirationSlot)
const GOLD_KEYS: readonly string[] = INSPIRATION_SLOTS.flatMap((slot) => [0, 1].map((i) => inspirationGoldKey(slot, i)))
const MAX_CARD_NODES = Math.max(...TREE_CARD_NODES)
const isCardNode = (value: unknown): boolean => typeof value === 'string' && isIntIn(nodeOrder(value), 1, MAX_CARD_NODES)
const isExtraNode = (value: unknown): boolean => typeof value === 'string' && extraNode(value) !== undefined

/** One value per distance preset, each parsed by `parse`. */
function perDistance<T>(value: unknown, parse: (entry: unknown) => T | null): Record<DistanceCategory, T> | null {
  if (!isObject(value) || !exactKeys(value, DISTANCE_CATEGORIES)) return null
  const out: Partial<Record<DistanceCategory, T>> = {}
  for (const distance of DISTANCE_CATEGORIES) {
    const parsed = parse(value[distance])
    if (parsed === null) return null
    out[distance] = parsed
  }
  return out as Record<DistanceCategory, T>
}

// --- profile/main ---------------------------------------------------------------------------------------------------

const PROFILE_KEYS = [
  'generation', 'createdAt', 'umaTickets', 'umaShards', 'prizeMoney', 'featuredUmaId', 'purse', 'exchangeGrade', 'targets', 'checkIns',
  'repeatSizing',
] as const satisfies readonly (keyof AccountProfile)[]

function parsePurse(value: unknown): DailyPurse | null {
  if (!isObject(value) || !exactKeys(value, ['day', 'gross', 'featuredPaid']) || !isLocalDay(value.day) || !isNonNegativeInt(value.gross)) return null
  const featuredPaid = parseIds(value.featuredPaid)
  return featuredPaid ? { day: value.day, gross: value.gross, featuredPaid } : null
}

/** 1–4 check-in times, ascending minutes of the day (02 §3, §10). */
function parseCheckIns(value: unknown): number[] | null {
  if (!Array.isArray(value) || value.length < MIN_CHECK_INS || value.length > MAX_CHECK_INS) return null
  if (!value.every((t, i) => isIntIn(t, 0, MINUTES_PER_DAY - 1) && (i === 0 || t > (value[i - 1] as number)))) return null
  return [...(value as number[])]
}

export function parseProfile(value: unknown): AccountProfile | null {
  if (!isObject(value) || !exactKeys(value, PROFILE_KEYS) || value.generation !== SAVE_GENERATION) return null
  if (!isTimestamp(value.createdAt) || ![value.umaTickets, value.umaShards, value.prizeMoney].every(isNonNegativeInt)) return null
  if (value.featuredUmaId !== null && !isRowId(value.featuredUmaId)) return null
  if (!isItemGrade(value.exchangeGrade as number) || !REPEAT_SIZINGS.includes(value.repeatSizing as AccountProfile['repeatSizing'])) return null
  const purse = parsePurse(value.purse)
  const targets = parseIds(value.targets, MAX_TARGETS)
  const checkIns = parseCheckIns(value.checkIns)
  if (!purse || !targets || !checkIns) return null
  return {
    generation: SAVE_GENERATION,
    createdAt: value.createdAt,
    umaTickets: value.umaTickets as number,
    umaShards: value.umaShards as number,
    prizeMoney: value.prizeMoney as number,
    featuredUmaId: value.featuredUmaId as string | null,
    purse,
    exchangeGrade: value.exchangeGrade as ItemGrade,
    targets,
    checkIns,
    repeatSizing: value.repeatSizing as AccountProfile['repeatSizing'],
  }
}

// --- umas/{outfitId} ------------------------------------------------------------------------------------------------

function parsePreset(value: unknown): Preset | null {
  if (!isObject(value) || !exactKeys(value, ['cardSetIds', 'assignments', 'lineage', 'activeExtraNodes', 'loadoutSkillIds'])) return null
  const cardSetIds = parseIds(value.cardSetIds, CARD_SET_SIZE)
  const activeExtraNodes = parseIds(value.activeExtraNodes, Number.POSITIVE_INFINITY, isExtraNode)
  const loadoutSkillIds = parseIds(value.loadoutSkillIds)
  if (!cardSetIds || !activeExtraNodes || !loadoutSkillIds || !isObject(value.assignments) || !isObject(value.lineage)) return null
  if (!Object.entries(value.assignments).every(([node, card]) => isCardNode(node) && isRowId(card))) return null
  if (!Object.entries(value.lineage).every(([slot, uma]) => isSlotName(slot) && isRowId(uma))) return null
  return {
    cardSetIds,
    assignments: { ...(value.assignments as Record<string, string>) },
    lineage: { ...(value.lineage as Partial<Record<InspirationSlot, string>>) },
    activeExtraNodes,
    loadoutSkillIds,
  }
}

function parseBuild(value: unknown): UmaBuild | null {
  if (!isObject(value) || !exactKeys(value, ['constellationOpened', 'inspiration', 'extraNodes', 'bonds', 'presets'])) return null
  if (!isIntIn(value.constellationOpened, 0, MAX_CARD_NODES)) return null
  const inspiration = value.inspiration
  if (!isObject(inspiration) || !exactKeys(inspiration, ['slots', 'uniques', 'golds'])) return null
  const slots = parseIds(inspiration.slots, INSPIRATION_SLOTS.length, isSlotName) as InspirationSlot[] | null
  const uniques = parseIds(inspiration.uniques, INSPIRATION_SLOTS.length, isSlotName) as InspirationSlot[] | null
  const golds = parseIds(inspiration.golds, GOLD_KEYS.length, (key) => GOLD_KEYS.includes(key as string))
  const extraNodes = parseIds(value.extraNodes, Number.POSITIVE_INFINITY, isExtraNode)
  const bonds = parseIds(value.bonds)
  const presets = perDistance(value.presets, parsePreset)
  if (!slots || !uniques || !golds || !extraNodes || !bonds || !presets) return null
  return { constellationOpened: value.constellationOpened, inspiration: { slots, uniques, golds }, extraNodes, bonds, presets }
}

function parseExpeditionRun(value: unknown): ExpeditionRun | null {
  if (!isObject(value) || !exactKeys(value, ['expeditionId', 'races', 'wins', 'completed'])) return null
  if (!isRowId(value.expeditionId) || !isNonNegativeInt(value.races) || !isNonNegativeInt(value.wins) || value.wins > value.races ||
    typeof value.completed !== 'boolean') return null
  return { expeditionId: value.expeditionId, races: value.races, wins: value.wins, completed: value.completed }
}

function parseRuns(value: unknown): ExpeditionRun[] | null {
  if (!Array.isArray(value)) return null
  const runs = value.map(parseExpeditionRun)
  return runs.every((run) => run !== null) ? (runs as ExpeditionRun[]) : null
}

function parseHistoryPreset(value: unknown): TierHistoryPreset | null {
  if (!isObject(value) || !exactKeys(value, ['stats', 'skillPoints', 'cardSetIds'])) return null
  const stats = parseStats(value.stats)
  const cardSetIds = parseIds(value.cardSetIds, CARD_SET_SIZE)
  return stats && cardSetIds && isFiniteNonNegative(value.skillPoints) ? { stats, skillPoints: value.skillPoints, cardSetIds } : null
}

function parseTierHistory(value: unknown): TierHistoryEntry | null {
  if (!isObject(value) || !exactKeys(value, ['tier', 'promotedAt', 'finalRacingLevel', 'presets', 'bonds', 'runs'])) return null
  if (!isTier(value.tier) || !isTimestamp(value.promotedAt) || !isIntIn(value.finalRacingLevel, 1, RACING_LEVELS_PER_TIER)) return null
  const presets = perDistance(value.presets, parseHistoryPreset)
  const bonds = parseIds(value.bonds)
  const runs = parseRuns(value.runs)
  if (!presets || !bonds || !runs) return null
  return { tier: value.tier, promotedAt: value.promotedAt, finalRacingLevel: value.finalRacingLevel, presets, bonds, runs }
}

function parsePreferences(value: unknown): RacePreferences | null {
  if (!isObject(value) || !exactKeys(value, ['strategy', 'distance', 'surface'])) return null
  if (!STRATEGIES.includes(value.strategy as RacePreferences['strategy']) || !isDistance(value.distance) ||
    !SURFACES.includes(value.surface as RacePreferences['surface'])) return null
  return { strategy: value.strategy as RacePreferences['strategy'], distance: value.distance, surface: value.surface as RacePreferences['surface'] }
}

function parseLevel(value: unknown, cap: number): { level: number; exp: number } | null {
  if (!isObject(value) || !exactKeys(value, ['level', 'exp']) || !isIntIn(value.level, 1, cap) || !isNonNegativeInt(value.exp)) return null
  return { level: value.level, exp: value.exp }
}

const UMA_KEYS = [
  'outfitId', 'tier', 'scenario', 'racing', 'farm', 'career', 'closedCareers', 'build', 'expedition', 'tierHistory', 'raceDefaults', 'hallOfFame',
] as const satisfies readonly (keyof UmaState)[]

export function parseUmaState(value: unknown): UmaState | null {
  if (!isObject(value) || !exactKeys(value, UMA_KEYS)) return null
  if (!isRowId(value.outfitId) || !isTier(value.tier) || !isScenario(value.scenario)) return null
  const racing = parseLevel(value.racing, RACING_LEVELS_PER_TIER)
  const farm = parseLevel(value.farm, FARM_LEVEL_CAP)
  const career = parseScenarioJourney(value.career)
  const closed = Array.isArray(value.closedCareers) ? value.closedCareers.map(parseScenarioJourney) : null
  const build = parseBuild(value.build)
  const expedition = isObject(value.expedition) && exactKeys(value.expedition, ['runs']) ? parseRuns(value.expedition.runs) : null
  const history = Array.isArray(value.tierHistory) ? value.tierHistory.map(parseTierHistory) : null
  const defaults = value.raceDefaults
  if (!racing || !farm || !career || !closed || closed.some((c) => c === null) || !build || !expedition || !history ||
    history.some((h) => h === null) || !isObject(defaults) || !exactKeys(defaults, ['preferences', 'selectedPreset']) ||
    !isDistance(defaults.selectedPreset)) return null
  const preferences = defaults.preferences === null ? null : parsePreferences(defaults.preferences)
  if (defaults.preferences !== null && preferences === null) return null
  const fame = value.hallOfFame
  if (fame !== null && (!isObject(fame) || !exactKeys(fame, ['inductedAt']) || !isTimestamp(fame.inductedAt))) return null
  return {
    outfitId: value.outfitId,
    tier: value.tier,
    scenario: value.scenario,
    racing,
    farm,
    career,
    closedCareers: closed as ScenarioJourney[],
    build,
    expedition: { runs: expedition },
    tierHistory: history as TierHistoryEntry[],
    raceDefaults: { preferences, selectedPreset: defaults.selectedPreset },
    hallOfFame: fame === null ? null : { inductedAt: (fame as { inductedAt: number }).inductedAt },
  }
}

// --- work/{outfitId} ------------------------------------------------------------------------------------------------

/** A slot at a building and, at the Gym and Dojo, one of its rooms; the index is below the building's Lv 3 slots. */
export function parseSlotRef(value: unknown): SlotRef | null {
  if (!isObject(value) || !exactKeys(value, ['building', 'slot'], ['room']) || typeof value.building !== 'string' || !isBuildingId(value.building)) return null
  const rooms: readonly string[] = BUILDINGS[value.building].rooms
  const hasRoom = value.room !== undefined
  if (rooms.length > 0 ? !hasRoom || !rooms.includes(value.room as string) : hasRoom) return null
  if (!isIntIn(value.slot, 0, slotsPerRoom(value.building, MAX_BUILDING_LEVEL) - 1)) return null
  return hasRoom ? { building: value.building, room: value.room as RoomId, slot: value.slot } : { building: value.building, slot: value.slot }
}

/** An unlock as a request or an output holds it: a ref (`kind`, `target`), or T128's full unlock with its layer, grade and dish. */
export function parseUnlock(value: unknown): UnlockRef | null {
  if (!isObject(value) || !UNLOCK_KINDS.includes(value.kind as (typeof UNLOCK_KINDS)[number]) || !isRowId(value.target)) return null
  if (exactKeys(value, ['kind', 'target'])) return { kind: value.kind as string, target: value.target }
  if (!exactKeys(value, ['kind', 'target', 'layer', 'grade', 'dishId']) || !isScenario(value.layer) || !isItemGrade(value.grade as number) ||
    !isItemId(value.dishId)) return null
  return { kind: value.kind as string, target: value.target, layer: value.layer, grade: value.grade, dishId: value.dishId } as UnlockRef
}

const FARM_KINDS = ['gather', 'craft', 'cook'] as const

/**
 * A job (1–10 of one item) or a session (1–10 unlocks). `loose` takes any whole count and any number of unlocks: an
 * operation's input, where a size outside 1–10 is the rule's refusal, not a malformed tap.
 */
export function parseWorkRequest(value: unknown, loose = false): WorkRequest | null {
  if (!isObject(value)) return null
  const sized = (n: unknown) => (loose ? Number.isSafeInteger(n) : isIntIn(n, MIN_ITEMS_PER_ENTRY, MAX_ITEMS_PER_ENTRY))
  if (value.kind === SESSION_KIND) {
    if (!exactKeys(value, ['kind', 'unlocks']) || !Array.isArray(value.unlocks) || !sized(value.unlocks.length)) return null
    const unlocks = value.unlocks.map(parseUnlock)
    return unlocks.every((unlock) => unlock !== null) ? { kind: SESSION_KIND, unlocks: unlocks as UnlockRef[] } : null
  }
  if (!FARM_KINDS.includes(value.kind as (typeof FARM_KINDS)[number]) || !exactKeys(value, ['kind', 'item', 'count'])) return null
  if (!(loose ? isRowId(value.item) : isItemId(value.item)) || !sized(value.count)) return null
  return { kind: value.kind as (typeof FARM_KINDS)[number], item: value.item as string, count: value.count as number }
}

export function parseRecipeInput(value: unknown): RecipeInput | null {
  if (!isObject(value) || !exactKeys(value, ['item', 'qty']) || !isItemId(value.item) || !isPositiveInt(value.qty)) return null
  return { item: value.item, qty: value.qty }
}

function parseRecipeInputs(value: unknown): RecipeInput[] | null {
  if (!Array.isArray(value)) return null
  const rows = value.map(parseRecipeInput)
  return rows.every((row) => row !== null) ? (rows as RecipeInput[]) : null
}

function parseOutput(value: unknown): WorkOutput | null {
  if (!isObject(value)) return null
  if (exactKeys(value, ['item'])) return isItemId(value.item) ? { item: value.item } : null
  if (!exactKeys(value, ['unlock'])) return null
  const unlock = parseUnlock(value.unlock)
  return unlock ? { unlock } : null
}

const requestSize = (request: WorkRequest): number => (request.kind === SESSION_KIND ? request.unlocks.length : request.count)

const ENTRY_KEYS = [
  'request', 'seconds', 'inputs', 'outputs', 'farmExp', 'startedAt', 'acceleratedMs', 'collected', 'speed', 'fromQueue',
] as const satisfies readonly (keyof Entry)[]

/** A started entry: its request's 1–10 items with every per-item array that long, and `collected` no more than them. */
export function parseEntry(value: unknown): Entry | null {
  if (!isObject(value) || !exactKeys(value, ENTRY_KEYS)) return null
  const request = parseWorkRequest(value.request)
  if (!request) return null
  const n = requestSize(request)
  const lists = [value.seconds, value.inputs, value.outputs, value.farmExp]
  if (!lists.every((list) => Array.isArray(list) && list.length === n)) return null
  const seconds = value.seconds as unknown[]
  const farmExp = value.farmExp as unknown[]
  const inputs = (value.inputs as unknown[]).map(parseRecipeInputs)
  const outputs = (value.outputs as unknown[]).map(parseOutput)
  if (!seconds.every(isPositiveInt) || !farmExp.every(isNonNegativeInt) || inputs.some((row) => row === null) ||
    outputs.some((output) => output === null)) return null
  if (!isTimestamp(value.startedAt) || !isNonNegativeInt(value.acceleratedMs) || !isIntIn(value.collected, 0, n) ||
    typeof value.speed !== 'number' || !Number.isFinite(value.speed) || value.speed <= 0 || typeof value.fromQueue !== 'boolean') return null
  return {
    request,
    seconds: seconds as number[],
    inputs: inputs as RecipeInput[][],
    outputs: outputs as WorkOutput[],
    farmExp: farmExp as number[],
    startedAt: value.startedAt,
    acceleratedMs: value.acceleratedMs,
    collected: value.collected,
    speed: value.speed,
    fromQueue: value.fromQueue,
  }
}

function parseRequests(value: unknown, min: number, max: number): WorkRequest[] | null {
  if (!Array.isArray(value) || value.length < min || value.length > max) return null
  const requests = value.map((request) => parseWorkRequest(request))
  return requests.every((request) => request !== null) ? (requests as WorkRequest[]) : null
}

function parseLast(value: unknown): LastWork | null {
  if (!isObject(value) || !exactKeys(value, ['slot', 'request'])) return null
  const slot = parseSlotRef(value.slot)
  const request = parseWorkRequest(value.request)
  return slot && request ? { slot, request } : null
}

function parseDropped(value: unknown): DroppedQueue | null {
  if (!isObject(value) || !exactKeys(value, ['at', 'slot', 'requests', 'short', 'refused']) || !isTimestamp(value.at)) return null
  const slot = parseSlotRef(value.slot)
  // The entry that couldn't start and every one behind it: up to the running one's queue of three, and the one it held.
  const requests = parseRequests(value.requests, 1, MAX_QUEUE + 1)
  const short = parseRecipeInputs(value.short)
  const refused = value.refused === null ? null : parseRefusal(value.refused)
  if (!slot || !requests || !short || (value.refused !== null && !refused)) return null
  return { at: value.at, slot, requests, short, refused }
}

const WORK_KEYS = ['outfitId', 'slot', 'entries', 'queue', 'last', 'dropped'] as const satisfies readonly (keyof WorkRow)[]

export function parseWorkRow(value: unknown): WorkRow | null {
  if (!isObject(value) || !exactKeys(value, WORK_KEYS) || !isRowId(value.outfitId)) return null
  const slot = value.slot === null ? null : parseSlotRef(value.slot)
  const entries = Array.isArray(value.entries) ? value.entries.map(parseEntry) : null
  const queue = parseRequests(value.queue, 0, MAX_QUEUE)
  const last = value.last === null ? null : parseLast(value.last)
  const dropped = value.dropped === null ? null : parseDropped(value.dropped)
  if ((value.slot !== null && !slot) || !entries || entries.some((entry) => entry === null) || !queue ||
    (value.last !== null && !last) || (value.dropped !== null && !dropped)) return null
  return { outfitId: value.outfitId, slot, entries: entries as Entry[], queue, last, dropped }
}

// --- Logs -----------------------------------------------------------------------------------------------------------

/** The ledger's reasons, kept whole by the type: a reason added to `LedgerReason` must be named here. */
const LEDGER_REASONS = Object.freeze({
  'initial-uma-tickets': true, 'unlock-uma': true, 'uma-gate-shard': true, 'uma-shard-exchange': true, 'promotion-uma-ticket': true,
  'race-prize': true, 'featured-bonus': true, buy: true, sell: true, upgrade: true, 'dev-grant': true,
} satisfies Record<LedgerReason, true>)

export function parseLedgerEntry(value: unknown): LedgerEntry | null {
  if (!isObject(value) || !exactKeys(value, ['id', 'resource', 'delta', 'reason', 'at']) || !isRowId(value.id)) return null
  if (typeof value.resource !== 'string' || !Object.hasOwn(LEDGER_BALANCE, value.resource) ||
    typeof value.reason !== 'string' || !Object.hasOwn(LEDGER_REASONS, value.reason)) return null
  if (!Number.isSafeInteger(value.delta) || value.delta === 0 || !isTimestamp(value.at)) return null
  return { id: value.id, resource: value.resource as LedgerResource, delta: value.delta as number, reason: value.reason as LedgerReason, at: value.at }
}

/** Each item reason's sign: what left the Warehouse is negative (07 §12, 05 §9, 09 §9). */
export const ITEM_LEDGER_SIGNS = Object.freeze({
  buy: 1, sell: -1, reserve: -1, return: 1, output: 1, cost: -1, ticket: -1, 'dev-grant': 1,
} satisfies Record<ItemLedgerReason, 1 | -1>)

export function parseItemLedgerRow(value: unknown): ItemLedgerRow | null {
  if (!isObject(value) || !exactKeys(value, ['id', 'itemId', 'delta', 'reason', 'outfitId', 'opId', 'at'])) return null
  if (!isRowId(value.id) || !isItemId(value.itemId) || typeof value.reason !== 'string' || !Object.hasOwn(ITEM_LEDGER_SIGNS, value.reason)) return null
  const sign = ITEM_LEDGER_SIGNS[value.reason as ItemLedgerReason]
  if (!Number.isSafeInteger(value.delta) || Math.sign(value.delta as number) !== sign) return null
  if ((value.outfitId !== null && !isRowId(value.outfitId)) || !isOperationId(value.opId) || !isTimestamp(value.at)) return null
  return {
    id: value.id, itemId: value.itemId, delta: value.delta as number, reason: value.reason as ItemLedgerReason,
    outfitId: value.outfitId as string | null, opId: value.opId, at: value.at,
  }
}

export function parseRaceResultRow(value: unknown): RaceResultRow | null {
  if (!isObject(value) || !exactKeys(value, ['umaId', 'raceId', 'opId', 'at', 'tier', 'scenario', 'run', 'commit'])) return null
  if (!isRowId(value.umaId) || !isRowId(value.raceId) || !isOperationId(value.opId) || !isTimestamp(value.at) || !isTier(value.tier) ||
    !isScenario(value.scenario) || !isReceipt(value.commit)) return null
  const run = parseRaceRun(value.run)
  const her = run?.field.find((runner) => runner.isPlayer)
  if (!run || her?.umaId !== value.umaId) return null
  return {
    umaId: value.umaId, raceId: value.raceId, opId: value.opId, at: value.at, tier: value.tier, scenario: value.scenario, run,
    commit: value.commit as unknown as RaceResultRow['commit'],
  }
}

export function parseOperationRecord(value: unknown): OperationRecord | null {
  if (!isObject(value) || !exactKeys(value, ['name', 'at', 'receipt'])) return null
  if (typeof value.name !== 'string' || !Object.hasOwn(OPERATIONS, value.name) || !isTimestamp(value.at) || !isReceipt(value.receipt)) return null
  return { name: value.name, at: value.at, receipt: value.receipt }
}

// --- Kinds ----------------------------------------------------------------------------------------------------------

const ENTITY_PARSERS: { readonly [K in EntityKind]: (value: unknown) => EntityData[K] | null } = {
  profile: parseProfile,
  umas: parseUmaState,
  buildings: (value) => (isObject(value) && exactKeys(value, ['level']) && isBuildingLevel(value.level as number) ? { level: value.level as 1 | 2 | 3 } : null),
  work: parseWorkRow,
  items: (value) => (isObject(value) && exactKeys(value, ['count']) && isNonNegativeInt(value.count) ? { count: value.count } : null),
  badges: (value) => parseBadgeState(value),
}

const ENTITY_IDS: { readonly [K in EntityKind]: (id: string, data: EntityData[K]) => boolean } = {
  profile: (id) => id === 'main',
  umas: (id, data) => id === data.outfitId,
  buildings: (id) => isBuildingId(id),
  work: (id, data) => id === data.outfitId,
  items: (id) => isItemId(id),
  badges: (id, data) => (data.scope === 'trainer' ? id === 'trainer' : data.scope === 'uma' && id === badgeStateId(data.umaId)),
}

const LOG_PARSERS: { readonly [K in LogKind]: (value: unknown) => LogData[K] | null } = {
  raceResults: parseRaceResultRow,
  ledger: parseLedgerEntry,
  itemLedger: parseItemLedgerRow,
  flairEvents: (value) => parseFlairEvent(value),
  operations: parseOperationRecord,
}

const LOG_IDS: { readonly [K in LogKind]: (id: string, data: LogData[K]) => boolean } = {
  raceResults: (id, data) => id === data.opId,
  ledger: (id, data) => id === data.id,
  itemLedger: (id, data) => id === data.id,
  flairEvents: (id, data) => id === flairEventId(data.scope, data.umaId, data.awardKey, data.stage),
  operations: (id) => isOperationId(id),
}

/** When a log row's entry happened, from its data: the row's `at` must equal it. */
export function logAt<K extends LogKind>(kind: K, data: LogData[K]): number {
  return kind === 'flairEvents' ? (data as LogData['flairEvents']).earnedAt : (data as { readonly at: number }).at
}

/** Whether `matches` holds, with an id helper that throws on an over-long id read as a mismatch. */
function idMatches<T>(matches: (id: string, data: T) => boolean, id: string, data: T): boolean {
  try {
    return matches(id, data)
  } catch {
    return false
  }
}

/** An entity's data of `kind`, checked against `id` when given; null when malformed. */
export function parseEntityData<K extends EntityKind>(kind: K, value: unknown, id?: string): EntityData[K] | null {
  if (!isEntityKind(kind)) return null
  const data = (ENTITY_PARSERS[kind] as (value: unknown) => EntityData[K] | null)(value)
  if (data === null || (id !== undefined && !idMatches(ENTITY_IDS[kind] as (id: string, data: EntityData[K]) => boolean, id, data))) return null
  return data
}

/** A log entry's data of `kind`, checked against `id` when given; null when malformed. */
export function parseLogData<K extends LogKind>(kind: K, value: unknown, id?: string): LogData[K] | null {
  if (!isLogKind(kind)) return null
  const data = (LOG_PARSERS[kind] as (value: unknown) => LogData[K] | null)(value)
  if (data === null || (id !== undefined && !idMatches(LOG_IDS[kind] as (id: string, data: LogData[K]) => boolean, id, data))) return null
  return data
}

const fitsRow = (value: unknown): boolean => jsonBytes(value) <= SAVE_LIMITS.rowBytes

/** A stored entity: generation 2, schema 1, a version from 1, its commit's time, and data that matches its id. */
export function parseEntityRow(value: unknown): EntityRow | null {
  if (!isObject(value) || !exactKeys(value, ['kind', 'id', 'generation', 'schema', 'version', 'savedAt', 'data'])) return null
  if (!isEntityKind(value.kind) || !isRowId(value.id) || value.generation !== SAVE_GENERATION || value.schema !== KIND_SCHEMA) return null
  if (!isPositiveInt(value.version) || !isTimestamp(value.savedAt) || !fitsRow(value)) return null
  const data = parseEntityData(value.kind, value.data, value.id)
  if (data === null) return null
  return { kind: value.kind, id: value.id, generation: SAVE_GENERATION, schema: KIND_SCHEMA, version: value.version, savedAt: value.savedAt, data } as EntityRow
}

/** A stored log row: generation 2, schema 1, `at` equal to its data's time, and data that matches its id. */
export function parseLogRow(value: unknown): LogRow | null {
  if (!isObject(value) || !exactKeys(value, ['kind', 'id', 'generation', 'schema', 'at', 'savedAt', 'data'])) return null
  if (!isLogKind(value.kind) || !isRowId(value.id) || value.generation !== SAVE_GENERATION || value.schema !== KIND_SCHEMA) return null
  if (!isTimestamp(value.at) || !isTimestamp(value.savedAt) || !fitsRow(value)) return null
  const data = parseLogData(value.kind, value.data, value.id)
  if (data === null || logAt(value.kind, data) !== value.at) return null
  return { kind: value.kind, id: value.id, generation: SAVE_GENERATION, schema: KIND_SCHEMA, at: value.at, savedAt: value.savedAt, data } as LogRow
}
