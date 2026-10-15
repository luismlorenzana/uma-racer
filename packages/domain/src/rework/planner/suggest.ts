// Suggestions for Free Umas and her Needs tab (docs/rework/02-check-ins-and-notifications.md §4, §6 "Suggestions for
// free Umas", "What it shows"; docs/rework/01-game-loop.md §4). Free Umas go by Farm Level, highest first (01 §4: the
// higher grades are theirs), ties by outfit id. Each takes, in order:
// 1. her own session, when a dish for one of her open unlocks is in the projected free stock: her oldest such unlock
//    picks the facility and room, and she takes the next unlocks there while their dishes last, up to the fitted size;
// 2. otherwise the largest shortfall she can start for the first target she can work for: her Farm Level opens the
//    grade, a slot is free and the inputs are in stock. Ties go to a dish, then crafted, then raw, then the lower grade,
//    then the item id; the size fits the next check-in, capped by stock, not by need.
// Each suggestion takes its slot, inputs and outputs before the next Uma's, so nothing is promised twice. Nothing is
// written: Start suggestions runs one T127 `start` per line, in order.
import { FACILITY_IDS, type BuildingId, type FacilityId, type RoomId } from '../farm/buildings'
import { FAMILY_SITE, farmItemSeconds } from '../farm/jobs'
import { itemById, type ItemGrade, type ItemId } from '../items/catalogue'
import { canWorkGrade } from '../items/grades'
import { recipeOf, type RecipeInput } from '../items/recipes'
import { assertNow } from '../tiers/ledger'
import { isOpen, nextUnlocks, remainingUnlocks } from '../training/order'
import { bondsThrough, facilityOf, FIXED_UNLOCKS, sessionSeconds, type Unlock } from '../training/unlocks'
import { isRefusal, type Refusal, type UmaState } from '../types'
import { isFree } from '../work/activity'
import type { WorkEnv } from '../work/kinds'
import { MAX_ITEMS_PER_ENTRY, slotsOf, start, type StartReceipt } from '../work/operations'
import { slotHolder, speedAt, sumInputs } from '../work/state'
import { SESSION_KIND, type FarmKind, type ItemStock, type SlotRef, type WorkRequest, type WorkState } from '../work/types'
import { fitSize } from '../check-in/schedule'
import { planFrom, type LineLevel, type Plan, type PlanLine } from './needs'
import { projectWork } from './project'
import { targetsOf, unlocksLeft, workAhead, type ChosenCards } from './targets'

/** What the planner reads beyond the state. */
export interface PlannerContext {
  readonly env: WorkEnv
  /** The cards the owner has picked to bond next, per Uma (02 §6). */
  readonly chosen?: ChosenCards
  /** The device's offset from UTC in minutes, for fitting sizes to check-ins; the sim passes 0. */
  readonly utcOffsetMin?: number
  /** The targets to plan for; the profile's, or automatic, when absent. */
  readonly targets?: readonly string[]
}

/** One suggestion: a start that T127's `start` runs as it is. */
export interface Suggestion {
  readonly outfitId: string
  /** Her own session, or a Farm job for a target's shortfall. */
  readonly kind: 'session' | 'job'
  readonly slot: SlotRef
  readonly request: WorkRequest
  readonly size: number
  readonly endsAt: number
  /** Whose need it serves: hers for a session, a target's for a job. */
  readonly forTarget: string
  /** The item a job makes; null for a session. */
  readonly item: ItemId | null
}

export interface Suggestions {
  readonly suggestions: readonly Suggestion[]
  /** Free Umas with nothing to suggest, in the same order. */
  readonly idle: readonly string[]
}

const slotKey = (slot: SlotRef): string => `${slot.building}/${slot.room ?? ''}/${slot.slot}`

/** The Free Umas in suggestion order: Farm Level, highest first, ties by outfit id. */
export function freeUmas(state: WorkState): readonly UmaState[] {
  return Object.values(state.umas)
    .filter((uma) => isFree(state, uma.outfitId))
    .sort((a, b) => b.farm.level - a.farm.level || (a.outfitId < b.outfitId ? -1 : a.outfitId > b.outfitId ? 1 : 0))
}

/** The slots, stock and shortfalls suggestions share, so nothing is promised twice. */
export class Bench {
  private readonly stock: Map<ItemId, number>
  private readonly taken = new Set<string>()

  constructor(private readonly state: WorkState, stock: ItemStock) {
    this.stock = new Map(Object.entries(stock))
  }

  has(item: ItemId): number {
    return this.stock.get(item) ?? 0
  }

  /** The lowest slot at a place nobody holds and no earlier suggestion took. */
  freeSlot(building: BuildingId, room: RoomId | null): SlotRef | undefined {
    return slotsOf(this.state, building).find((slot) => (slot.room ?? null) === room && slotHolder(this.state, slot) === undefined && !this.taken.has(slotKey(slot)))
  }

  /** How many items of `inputs` each the stock covers; unbounded when there are none. */
  covers(inputs: readonly RecipeInput[]): number {
    return inputs.reduce((n, { item, qty }) => Math.min(n, Math.floor(this.has(item) / qty)), Number.POSITIVE_INFINITY)
  }

  claim(slot: SlotRef, inputs: readonly RecipeInput[]): void {
    this.taken.add(slotKey(slot))
    for (const { item, qty } of inputs) this.stock.set(item, this.has(item) - qty)
  }
}

/** When a suggestion starts and the check-ins its size fits. */
export interface Timing {
  readonly now: number
  readonly times: readonly number[]
  readonly utcOffsetMin: number
}

/** The Farm kind, building and seconds an item is made with, at today's speed. */
function makerOf(state: WorkState, item: ItemId): { kind: FarmKind; building: BuildingId; seconds: number; grade: ItemGrade } | null {
  const def = itemById(item)
  if (def === undefined || def.kind === 'ticket') return null
  const kind: FarmKind = def.kind === 'raw' ? 'gather' : def.kind === 'crafted' ? 'craft' : 'cook'
  const building: BuildingId = def.kind === 'raw' ? FAMILY_SITE[def.family] : def.kind === 'crafted' ? 'pantry' : 'kitchen'
  return { kind, building, seconds: farmItemSeconds(kind, def.grade, speedAt(state, building)), grade: def.grade }
}

/**
 * The job she would start to make `item` now, or null when she can't: her Farm Level must open the grade, a slot must
 * be free and the stock must cover one. `size` is `'fit'` (fitted to the next check-in) or a count, either capped by
 * stock and at 10.
 */
export function jobFor(state: WorkState, bench: Bench, uma: UmaState, item: ItemId, size: 'fit' | number, timing: Timing): Omit<Suggestion, 'forTarget'> | null {
  const maker = makerOf(state, item)
  if (maker === null || !canWorkGrade(uma.farm.level, maker.grade)) return null
  const slot = bench.freeSlot(maker.building, null)
  if (slot === undefined) return null
  const inputs = recipeOf(item)?.inputs ?? []
  const covered = Math.min(bench.covers(inputs), MAX_ITEMS_PER_ENTRY)
  if (covered < 1) return null
  const wanted = size === 'fit'
    ? fitSize(timing.now, Array.from({ length: MAX_ITEMS_PER_ENTRY }, () => maker.seconds), timing.times, timing.utcOffsetMin)
    : size
  const count = Math.max(1, Math.min(wanted, covered))
  return {
    outfitId: uma.outfitId, kind: 'job', slot, request: { kind: maker.kind, item, count }, size: count,
    endsAt: timing.now + count * maker.seconds * 1000, item,
  }
}

/** Her own session (02 §6 step 1), or null. */
function ownSession(state: WorkState, bench: Bench, uma: UmaState, chosen: ChosenCards, timing: Timing): Suggestion | null {
  const pending = workAhead(state.work[uma.outfitId])
  const unlocks = remainingUnlocks(uma.build, uma, chosen[uma.outfitId] ?? [], pending).flatMap((entry) => (entry.kind === 'unlock' ? [entry] : []))
  const tried = new Set<string>()
  for (const entry of unlocks) {
    if (bench.has(entry.dishId) < 1) continue
    const place = `${entry.facility}/${entry.room ?? ''}`
    if (tried.has(place)) continue
    tried.add(place)
    const slot = bench.freeSlot(entry.facility, entry.room)
    if (slot === undefined) continue
    const candidates: readonly Unlock[] = entry.facility === 'dojo'
      ? unlocks.filter((u) => u.facility === 'dojo' && entry.room !== null && u.rooms.includes(entry.room)).map((u) => u.unlock)
      : nextUnlocks(uma.build, uma, entry.facility, entry.room, MAX_ITEMS_PER_ENTRY, pending)
    const left = new Map<ItemId, number>()
    const taken: Unlock[] = []
    for (const unlock of candidates) {
      const have = left.get(unlock.dishId) ?? bench.has(unlock.dishId)
      if (have < 1) {
        // The Dojo has no order, so a bond whose dish is missing doesn't hold up the next; elsewhere an unlock may
        // depend on the one before (05 §2).
        if (entry.facility === 'dojo') continue
        break
      }
      left.set(unlock.dishId, have - 1)
      taken.push(unlock)
    }
    if (taken.length === 0) continue
    const speed = speedAt(state, entry.facility)
    const size = fitSize(timing.now, taken.map((u) => sessionSeconds(u.grade, speed)), timing.times, timing.utcOffsetMin)
    const unlocksTaken = taken.slice(0, size)
    const seconds = unlocksTaken.reduce((sum, u) => sum + sessionSeconds(u.grade, speed), 0)
    bench.claim(slot, sumInputs(unlocksTaken.map((u) => [{ item: u.dishId, qty: 1 }])))
    return {
      outfitId: uma.outfitId, kind: 'session', slot, request: { kind: SESSION_KIND, unlocks: unlocksTaken }, size: unlocksTaken.length,
      endsAt: timing.now + seconds * 1000, forTarget: uma.outfitId, item: null,
    }
  }
  return null
}

const LEVEL_ORDER: Readonly<Record<LineLevel, number>> = { dish: 0, crafted: 1, raw: 2 }

/** Larger shortfall first; ties to a dish, crafted, raw, the lower grade, then the item id (T131). */
const scarcest = (a: { line: PlanLine; short: number }, b: { line: PlanLine; short: number }): number =>
  b.short - a.short || LEVEL_ORDER[a.line.level] - LEVEL_ORDER[b.line.level] || a.line.grade - b.line.grade ||
  (a.line.item < b.line.item ? -1 : a.line.item > b.line.item ? 1 : 0)

/** What is still short per target and item, less what earlier suggestions will make. */
class Shortfalls {
  private readonly left: Map<string, Map<ItemId, number>>

  constructor(private readonly planned: Plan) {
    this.left = new Map(planned.targets.map((t) => [t.outfitId, new Map([...t.dishes, ...t.crafted, ...t.raw].map((l) => [l.item, l.short]))]))
  }

  of(target: string, item: ItemId): number {
    return this.left.get(target)?.get(item) ?? 0
  }

  /** `count` more of `item` will come: it goes to the targets in order. */
  made(item: ItemId, count: number): void {
    let rest = count
    for (const target of this.planned.targets) {
      const short = this.of(target.outfitId, item)
      const used = Math.min(short, rest)
      if (used > 0) this.left.get(target.outfitId)!.set(item, short - used)
      rest -= used
    }
  }
}

/** The largest shortfall she can start for the first target she can work for (02 §6 step 2), or null. */
function shortfallJob(state: WorkState, bench: Bench, shortfalls: Shortfalls, planned: Plan, uma: UmaState, timing: Timing): Suggestion | null {
  for (const target of planned.targets) {
    const options = [...target.dishes, ...target.crafted, ...target.raw]
      .map((line) => ({ line, short: shortfalls.of(target.outfitId, line.item) }))
      .filter(({ short }) => short > 0)
      .sort(scarcest)
    for (const { line } of options) {
      const job = jobFor(state, bench, uma, line.item, 'fit', timing)
      if (job === null) continue
      bench.claim(job.slot, (recipeOf(line.item)?.inputs ?? []).map(({ item, qty }) => ({ item, qty: qty * job.size })))
      shortfalls.made(line.item, job.size)
      return { ...job, forTarget: target.outfitId }
    }
  }
  return null
}

function timingOf(state: WorkState, now: number, context: PlannerContext): Timing {
  return { now, times: state.profile.checkIns, utcOffsetMin: context.utcOffsetMin ?? 0 }
}

/** The suggestions for every Free Uma at `now` (02 §4 "Free", §6). Nothing is written. */
export function suggest(state: WorkState, now: number, context: PlannerContext): Suggestions {
  assertNow(now)
  const chosen = context.chosen ?? {}
  const projection = projectWork(state, now, context.env)
  const { current } = projection
  const planned = planFrom(projection, context.targets ?? targetsOf(current, chosen), chosen)
  return suggestFrom(current, planned, chosen, timingOf(current, now, context))
}

/** Suggestions over a plan already made (the summary shares one). */
export function suggestFrom(current: WorkState, planned: Plan, chosen: ChosenCards, timing: Timing): Suggestions {
  const bench = new Bench(current, planned.freeStock)
  const shortfalls = new Shortfalls(planned)
  const suggestions: Suggestion[] = []
  const idle: string[] = []
  for (const uma of freeUmas(current)) {
    const next = ownSession(current, bench, uma, chosen, timing) ?? shortfallJob(current, bench, shortfalls, planned, uma, timing)
    if (next === null) idle.push(uma.outfitId)
    else suggestions.push(next)
  }
  return { suggestions, idle }
}

export interface StartedSuggestions<S extends WorkState> {
  readonly state: S
  readonly started: readonly StartReceipt[]
  /** Lines the state no longer allowed, with T127's reason. */
  readonly refused: readonly { readonly outfitId: string; readonly refusal: Refusal }[]
}

/** **Start suggestions** (02 §1, §6): one T127 `start` per line, in order. */
export function startSuggestions<S extends WorkState>(state: S, suggestions: readonly Suggestion[], now: number, env: WorkEnv): StartedSuggestions<S> {
  let next = state
  const started: StartReceipt[] = []
  const refused: { outfitId: string; refusal: Refusal }[] = []
  for (const line of suggestions) {
    const result = start(next, { outfitId: line.outfitId, slot: line.slot, request: line.request }, now, env)
    if (isRefusal(result)) refused.push({ outfitId: line.outfitId, refusal: result })
    else {
      next = result.state
      started.push(result.receipt)
    }
  }
  return { state: next, started, refused }
}

// --- Her Needs tab --------------------------------------------------------------------------------------------------

/** One facility's progress through her open layers: "Observatory 8/12". */
export interface FacilityProgress {
  readonly facility: FacilityId
  readonly done: number
  readonly total: number
}

export interface Needs {
  readonly outfitId: string
  readonly progress: readonly FacilityProgress[]
  /** Her plan alone: her unlocks, then dishes short → crafted short → raw short. */
  readonly plan: Plan
  /**
   * Real seconds of work left at today's building speeds: her sessions for the unlocks the plan can name, and the Farm
   * work her shortfalls take. Bonds still waiting for a card have no dish or grade yet, so they aren't in it.
   */
  readonly estimateSeconds: number
  /** Her first three startable lines, each with its own Free Uma and the size that would start it. */
  readonly startable: readonly { readonly line: PlanLine; readonly start: Suggestion }[]
}

/** Startable lines shown on her Needs tab (02 §6, T131). */
export const NEEDS_STARTABLE = 3

/** Her layer progress by facility (02 §6): fixed unlocks of her open layers opened, and bonds made against the pacing. */
export function layerProgress(uma: UmaState): readonly FacilityProgress[] {
  const open = FIXED_UNLOCKS.filter((entry) => entry.layer <= uma.scenario)
  return FACILITY_IDS.map((facility): FacilityProgress => {
    if (facility === 'dojo') {
      const total = bondsThrough(uma.scenario)
      return { facility, done: Math.min(uma.build.bonds.length, total), total }
    }
    const here = open.filter((entry) => facilityOf(entry.kind) === facility)
    return { facility, done: here.filter((entry) => isOpen(uma.build, entry)).length, total: here.length }
  })
}

/**
 * Her profile's Needs tab (02 §6): the same plan for her alone, without touching the targets; layer progress by
 * facility; an estimate in real time at today's speeds; and her first three startable lines, dishes first.
 */
export function needsFor(state: WorkState, outfitId: string, now: number, context: PlannerContext): Needs {
  assertNow(now)
  const chosen = context.chosen ?? {}
  const projection = projectWork(state, now, context.env)
  const { current } = projection
  const uma = current.umas[outfitId]
  if (!uma) throw new RangeError(`No Uma ${outfitId}`)
  const planned = planFrom(projection, [outfitId], chosen)
  const mine = planned.targets[0]!

  const sessions = mine.unlocks.reduce((sum, u) => sum + sessionSeconds(u.unlock.grade, speedAt(current, u.facility)), 0)
  const farm = [...mine.dishes, ...mine.crafted, ...mine.raw].reduce((sum, line) => sum + line.short * (makerOf(current, line.item)?.seconds ?? 0), 0)

  const timing = timingOf(current, now, context)
  const bench = new Bench(current, planned.freeStock)
  const startable: { line: PlanLine; start: Suggestion }[] = []
  // Each line takes its own Free Uma, as the suggestions do: one slot per Uma (01 §2), so every Start can run (T142).
  const working = new Set<string>()
  for (const line of [...mine.dishes, ...mine.crafted, ...mine.raw]) {
    if (startable.length >= NEEDS_STARTABLE) break
    if (line.short <= 0) continue
    for (const worker of freeUmas(current)) {
      if (working.has(worker.outfitId)) continue
      const job = jobFor(current, bench, worker, line.item, 'fit', timing)
      if (job === null) continue
      bench.claim(job.slot, (recipeOf(line.item)?.inputs ?? []).map(({ item, qty }) => ({ item, qty: qty * job.size })))
      working.add(worker.outfitId)
      startable.push({ line, start: { ...job, forTarget: outfitId } })
      break
    }
  }
  return { outfitId, progress: layerProgress(uma), plan: planned, estimateSeconds: sessions + farm, startable }
}

/** The roster view (02 §6): the plan for every Uma, in automatic order (most unlocks left first, ties by outfit id). */
export function rosterTotals(state: WorkState, now: number, context: PlannerContext): { readonly order: readonly { readonly outfitId: string; readonly unlocksLeft: number }[]; readonly plan: Plan } {
  assertNow(now)
  const chosen = context.chosen ?? {}
  const projection = projectWork(state, now, context.env)
  const order = Object.keys(projection.ahead.umas)
    .map((outfitId) => {
      const uma = projection.ahead.umas[outfitId]!
      const remaining = remainingUnlocks(uma.build, uma, chosen[outfitId] ?? [], workAhead(projection.ahead.work[outfitId]))
      return { outfitId, unlocksLeft: unlocksLeft(remaining) }
    })
    .sort((a, b) => b.unlocksLeft - a.unlocksLeft || (a.outfitId < b.outfitId ? -1 : a.outfitId > b.outfitId ? 1 : 0))
  return { order, plan: planFrom(projection, order.map(({ outfitId }) => outfitId), chosen) }
}
