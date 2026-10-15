// The planner: "what she still needs" (docs/rework/02-check-ins-and-notifications.md §6, §4 "Best use";
// docs/rework/08-item-catalogue-and-recipes.md §4; uma-rpg's `targetPlan`, D100). Three steps, all derived on read:
// 1. Needs: for each target, oldest layer first, every unlock left needs its one dish (T128); a bond with no card
//    chosen has no family, so it counts in `pickCards` and isn't cascaded.
// 2. Supply: the free stock once projected queue starts have taken their inputs, then the outputs still to come in
//    finish order (T131's projection of T127's settle). Reserved inputs never count; projected drops count neither way.
// 3. Allocation, once, level by level (dishes, then crafted, then raw), targets in order, stock before coming. A short
//    dish needs its recipe's crafted items (T126), and a short crafted item its raw one.
// Lines are lowest grade first. A line no Free Uma's Farm Level opens carries its gate.
import { BUILDINGS, isFacility, type BuildingId, type FacilityId, type RoomId } from '../farm/buildings'
import { FAMILY_SITE } from '../farm/jobs'
import { ITEMS, itemById, type ItemGrade, type ItemId } from '../items/catalogue'
import { gradeOpensAtFarmLevel } from '../items/grades'
import { PLANET_OWN_QTY, recipeOf, SIDE_QTY } from '../items/recipes'
import { assertNow } from '../tiers/ledger'
import { remainingUnlocks } from '../training/order'
import type { Unlock } from '../training/unlocks'
import { isFree } from '../work/activity'
import type { WorkEnv } from '../work/kinds'
import { slotOrder } from '../work/state'
import { endsAt, itemEnds } from '../work/timeline'
import { SESSION_KIND, type ItemStock, type SlotRef, type WorkState } from '../work/types'
import { projectWork, type ComingItem, type Projection } from './project'
import { workAhead, type ChosenCards } from './targets'

/** The cascade's three levels, in allocation order (02 §6). */
export type LineLevel = 'dish' | 'crafted' | 'raw'
export const LINE_LEVELS: readonly LineLevel[] = Object.freeze(['dish', 'crafted', 'raw'] as const)

/** Where an item still to come is made, and when the last of those allocated finishes ("coming 2 (Gold Ship, 14:10)"). */
export interface ComingFrom {
  readonly outfitId: string
  readonly at: number
  readonly count: number
}

/** "Grade 4 needs Farm Lv 16 · highest free Uma: Lv 14" (02 §6). */
export interface Gate {
  readonly needsLevel: number
  readonly highestFree: number
}

/** One line of the cascade (02 §6 "What it shows"). */
export interface PlanLine {
  readonly item: ItemId
  readonly level: LineLevel
  readonly grade: ItemGrade
  /** What the targets need of it at this level. */
  readonly need: number
  /** Allocated from the free stock. */
  readonly have: number
  /** Allocated from outputs still to come. */
  readonly coming: number
  readonly comingFrom: readonly ComingFrom[]
  /** need − have − coming: what still has to be started. */
  readonly short: number
  /** Set when no Free Uma's Farm Level opens its grade; null otherwise, or when no Uma is Free. */
  readonly gate: Gate | null
}

/** Where a target's unlock stands: its dish in the free stock, coming, or short, in her unlock order. */
export type UnlockSupply = 'ready' | 'coming' | 'short'

export interface PlannedUnlock {
  readonly unlock: Unlock
  readonly facility: FacilityId
  readonly room: RoomId | null
  readonly supply: UnlockSupply
}

/** One target's share of the plan. */
export interface TargetPlan {
  readonly outfitId: string
  /** Her unlocks left, oldest layer first, less her work ahead (T128's `remainingUnlocks`). */
  readonly unlocks: readonly PlannedUnlock[]
  /** Bonds still to pick a card for: "3 bonds: pick cards". */
  readonly pickCards: number
  readonly dishes: readonly PlanLine[]
  readonly crafted: readonly PlanLine[]
  readonly raw: readonly PlanLine[]
}

/** A started or projected entry and the target need its unfinished outputs cover (02 §4 "Best use"). */
export interface EntryUse {
  readonly outfitId: string
  readonly startedAt: number
  readonly slot: SlotRef
  readonly endsAt: number
  /** True while it runs at `now`; a projected queue entry hasn't started. */
  readonly running: boolean
  /** An unlock or a dish counts 1, a crafted or raw item ⅕ (`BEST_USE_WEIGHTS`). */
  readonly covers: number
}

export interface Plan {
  readonly now: number
  readonly targets: readonly TargetPlan[]
  /** Every target's lines summed per item, lowest grade first. */
  readonly dishes: readonly PlanLine[]
  readonly crafted: readonly PlanLine[]
  readonly raw: readonly PlanLine[]
  readonly pickCards: number
  /** The Umas Free at `now` (01 §2), by outfit id. */
  readonly free: readonly string[]
  /** The highest Farm Level among Free Umas, or null when none is Free. */
  readonly highestFree: number | null
  /** The free stock the plan allocated from, before allocation. */
  readonly freeStock: ItemStock
  readonly uses: readonly EntryUse[]
}

/**
 * Best use's weights in fifths (02 §4, 08 §4): an unlock or a dish counts 1; a crafted or raw item ⅕, since a dish
 * takes five crafted items (`PLANET_OWN_QTY` + `SIDE_QTY`).
 */
export const BEST_USE_WEIGHTS = Object.freeze({ dish: PLANET_OWN_QTY + SIDE_QTY, crafted: 1, raw: 1 } as const)
const UNLOCK_WEIGHT = BEST_USE_WEIGHTS.dish
const WEIGHT_UNIT = PLANET_OWN_QTY + SIDE_QTY
/** Best use marks three running entries (02 §4). */
export const BEST_USE_MARKS = 3

const CATALOGUE_ORDER = new Map(ITEMS.map((item, i) => [item.id, i]))

function gradeOf(item: ItemId): ItemGrade {
  const def = itemById(item)
  if (def === undefined || def.kind === 'ticket') throw new RangeError(`${item} has no grade`)
  return def.grade
}

const byGrade = (a: PlanLine, b: PlanLine): number =>
  a.grade - b.grade || (CATALOGUE_ORDER.get(a.item) ?? 0) - (CATALOGUE_ORDER.get(b.item) ?? 0)

/** Outputs grouped by their entry, in the order first taken; `at` is the last one's finish. */
function groupComing(taken: readonly ComingItem[]): ComingFrom[] {
  const groups = new Map<string, { outfitId: string; at: number; count: number }>()
  for (const item of taken) {
    const key = `${item.outfitId}@${item.startedAt}`
    const group = groups.get(key)
    if (group) {
      group.count += 1
      group.at = Math.max(group.at, item.at)
    } else groups.set(key, { outfitId: item.outfitId, at: item.at, count: 1 })
  }
  return [...groups.values()]
}

interface Allocated {
  readonly item: ItemId
  readonly need: number
  readonly have: number
  readonly taken: readonly ComingItem[]
  readonly short: number
}

/** The free stock and the outputs coming, each allocated once (02 §6 "What counts first" 3). */
class Supply {
  private readonly stock = new Map<ItemId, number>()
  private readonly coming = new Map<ItemId, ComingItem[]>()

  constructor(stock: ItemStock, coming: readonly ComingItem[]) {
    for (const [item, count] of Object.entries(stock)) this.stock.set(item, count)
    for (const item of coming) {
      const list = this.coming.get(item.item)
      if (list) list.push(item)
      else this.coming.set(item.item, [item])
    }
  }

  /** Allocates `need` of `item`: free stock first, then outputs coming in finish order. */
  take(item: ItemId, need: number): Allocated {
    const inStock = this.stock.get(item) ?? 0
    const have = Math.min(inStock, need)
    this.stock.set(item, inStock - have)
    const list = this.coming.get(item) ?? []
    const taken = list.splice(0, need - have)
    return { item, need, have, taken, short: need - have - taken.length }
  }
}

/** Adds `qty` of `item` to an ordered demand. */
const add = (demand: Map<ItemId, number>, item: ItemId, qty: number) => demand.set(item, (demand.get(item) ?? 0) + qty)

function line(level: LineLevel, allocated: Allocated, highestFree: number | null): PlanLine {
  const grade = gradeOf(allocated.item)
  const needsLevel = gradeOpensAtFarmLevel(grade)
  return {
    item: allocated.item, level, grade, need: allocated.need, have: allocated.have, coming: allocated.taken.length,
    comingFrom: groupComing(allocated.taken), short: allocated.short,
    gate: highestFree !== null && needsLevel > highestFree ? { needsLevel, highestFree } : null,
  }
}

/** The highest Farm Level among Umas Free at `now` (01 §2), or null when none is. */
export function highestFreeLevel(state: WorkState): number | null {
  const levels = Object.values(state.umas).filter((uma) => isFree(state, uma.outfitId)).map((uma) => uma.farm.level)
  return levels.length === 0 ? null : Math.max(...levels)
}

/**
 * The plan for `targets`, in order (02 §6). `chosen` maps an Uma to the cards the owner picked to bond next; they go to
 * T128's `remainingUnlocks` with her work ahead, so a dish already reserved or queued isn't counted twice.
 */
export function plan(state: WorkState, targets: readonly string[], now: number, chosen: ChosenCards, env: WorkEnv): Plan {
  assertNow(now)
  return planFrom(projectWork(state, now, env), targets, chosen)
}

/** The plan over a projection already made (the summary and the suggestions share one). */
export function planFrom(projection: Projection, targets: readonly string[], chosen: ChosenCards): Plan {
  const { ahead, current, now } = projection
  if (new Set(targets).size !== targets.length) throw new RangeError(`A target is listed once: ${targets.join(', ')}`)
  const supply = new Supply(projection.freeStock, projection.coming)
  const free = Object.keys(current.umas).filter((outfitId) => isFree(current, outfitId)).sort()
  const highestFree = highestFreeLevel(current)

  // 1. Needs, from the state at the end of every chain: her work ahead is every entry that will start.
  const needs = targets.map((outfitId) => {
    const uma = ahead.umas[outfitId]
    if (!uma) throw new RangeError(`No Uma ${outfitId} to plan for`)
    const remaining = remainingUnlocks(uma.build, uma, chosen[outfitId] ?? [], workAhead(ahead.work[outfitId]))
    const unlocks = remaining.flatMap((entry) => (entry.kind === 'unlock' ? [entry] : []))
    const pickCards = remaining.reduce((sum, entry) => sum + (entry.kind === 'pick-cards' ? entry.count : 0), 0)
    const dishes = new Map<ItemId, number>()
    for (const entry of unlocks) add(dishes, entry.dishId, 1)
    return { outfitId, unlocks, pickCards, dishes }
  })

  // 2–3. Allocation, level by level, targets in order.
  const dishLines = needs.map(({ dishes }) => [...dishes].map(([item, qty]) => supply.take(item, qty)))
  const craftedLines = dishLines.map((lines) => {
    const demand = new Map<ItemId, number>()
    for (const dish of lines) if (dish.short > 0) for (const input of recipeOf(dish.item)?.inputs ?? []) add(demand, input.item, input.qty * dish.short)
    return [...demand].map(([item, qty]) => supply.take(item, qty))
  })
  const rawLines = craftedLines.map((lines) => {
    const demand = new Map<ItemId, number>()
    for (const crafted of lines) if (crafted.short > 0) for (const input of recipeOf(crafted.item)?.inputs ?? []) add(demand, input.item, input.qty * crafted.short)
    return [...demand].map(([item, qty]) => supply.take(item, qty))
  })

  const targetPlans = needs.map(({ outfitId, unlocks, pickCards }, t): TargetPlan => {
    const left = new Map(dishLines[t]!.map((dish) => [dish.item, { have: dish.have, coming: dish.taken.length }]))
    const planned = unlocks.map((entry): PlannedUnlock => {
      const counts = left.get(entry.dishId)!
      const supplied: UnlockSupply = counts.have > 0 ? 'ready' : counts.coming > 0 ? 'coming' : 'short'
      if (supplied === 'ready') counts.have -= 1
      else if (supplied === 'coming') counts.coming -= 1
      return { unlock: entry.unlock, facility: entry.facility, room: entry.room, supply: supplied }
    })
    return {
      outfitId, unlocks: planned, pickCards,
      dishes: dishLines[t]!.map((a) => line('dish', a, highestFree)).sort(byGrade),
      crafted: craftedLines[t]!.map((a) => line('crafted', a, highestFree)).sort(byGrade),
      raw: rawLines[t]!.map((a) => line('raw', a, highestFree)).sort(byGrade),
    }
  })

  const total = (level: LineLevel, perTarget: readonly (readonly Allocated[])[]): PlanLine[] => {
    const merged = new Map<ItemId, { need: number; have: number; taken: ComingItem[]; short: number }>()
    for (const lines of perTarget) {
      for (const a of lines) {
        const sum = merged.get(a.item) ?? { need: 0, have: 0, taken: [], short: 0 }
        merged.set(a.item, { need: sum.need + a.need, have: sum.have + a.have, taken: [...sum.taken, ...a.taken], short: sum.short + a.short })
      }
    }
    return [...merged].map(([item, sum]) => line(level, { item, ...sum }, highestFree)).sort(byGrade)
  }

  return {
    now,
    targets: targetPlans,
    dishes: total('dish', dishLines),
    crafted: total('crafted', craftedLines),
    raw: total('raw', rawLines),
    pickCards: needs.reduce((sum, { pickCards }) => sum + pickCards, 0),
    free,
    highestFree,
    freeStock: projection.freeStock,
    uses: entryUses(projection, targets, [...dishLines, ...craftedLines, ...rawLines].flat()),
  }
}

/** What each unfinished entry's outputs cover of the targets' need (02 §4 "Best use"). */
function entryUses(projection: Projection, targets: readonly string[], allocated: readonly Allocated[]): EntryUse[] {
  const { ahead, now } = projection
  const fifths = new Map<string, number>()
  const credit = (outfitId: string, startedAt: number, n: number) => {
    const key = `${outfitId}@${startedAt}`
    fifths.set(key, (fifths.get(key) ?? 0) + n)
  }
  for (const a of allocated) {
    const weight = itemById(a.item)?.kind === 'dish' ? BEST_USE_WEIGHTS.dish : BEST_USE_WEIGHTS.crafted
    for (const item of a.taken) if (item.at > now) credit(item.outfitId, item.startedAt, weight)
  }
  const uses: EntryUse[] = []
  for (const row of Object.values(ahead.work)) {
    if (row.slot === null) continue
    for (const entry of row.entries) {
      const end = endsAt(entry)
      if (end <= now) continue
      if (entry.request.kind === SESSION_KIND && targets.includes(row.outfitId)) {
        const ends = itemEnds(entry.startedAt, entry.seconds, entry.acceleratedMs)
        credit(row.outfitId, entry.startedAt, UNLOCK_WEIGHT * ends.filter((at, k) => k >= entry.collected && at > now).length)
      }
      uses.push({
        outfitId: row.outfitId, startedAt: entry.startedAt, slot: row.slot, endsAt: end, running: entry.startedAt <= now,
        covers: (fifths.get(`${row.outfitId}@${entry.startedAt}`) ?? 0) / WEIGHT_UNIT,
      })
    }
  }
  return uses.sort((a, b) => a.endsAt - b.endsAt || slotOrder(a.slot, b.slot))
}

/**
 * Best use (02 §4): the three running entries whose finish covers the most target need, the first to speed up. Ties
 * go to the sooner finish, then building order.
 */
export function bestUse(planned: Plan): readonly EntryUse[] {
  return planned.uses
    .filter((use) => use.running && use.covers > 0)
    .sort((a, b) => b.covers - a.covers || a.endsAt - b.endsAt || slotOrder(a.slot, b.slot))
    .slice(0, BEST_USE_MARKS)
}

// --- Views ----------------------------------------------------------------------------------------------------------

/**
 * "For your targets" at a Farm place (02 §6): a site's raw lines of its family, the Pantry's crafted lines, the
 * Kitchen's dishes, each while the targets need more than the Warehouse holds, lowest grade first.
 */
export function placeLines(planned: Plan, building: BuildingId): readonly PlanLine[] {
  const job = BUILDINGS[building].job
  const lines = job === 'gather'
    ? planned.raw.filter((l) => FAMILY_SITE[familyOf(l.item)] === building)
    : job === 'craft' ? planned.crafted : job === 'cook' ? planned.dishes : []
  return lines.filter((l) => l.need > l.have)
}

function familyOf(item: ItemId) {
  const def = itemById(item)
  if (def?.kind !== 'raw' && def?.kind !== 'crafted') throw new RangeError(`${item} isn't an ingredient`)
  return def.family
}

/** One target's line at a Training facility (02 §6): unlocks left here, dishes ready, dishes coming. */
export interface FacilityLine {
  readonly outfitId: string
  readonly left: number
  readonly ready: number
  readonly coming: number
  /** "Start" shows when she's Free and a dish is in stock. */
  readonly canStart: boolean
}

/** Each target's line at a Training facility, in target order, for those with unlocks left there. */
export function facilityLines(planned: Plan, facility: FacilityId): readonly FacilityLine[] {
  if (!isFacility(facility)) throw new RangeError(`${facility} isn't a Training facility`)
  return planned.targets.flatMap((target) => {
    const here = target.unlocks.filter((u) => u.facility === facility)
    if (here.length === 0) return []
    const ready = here.filter((u) => u.supply === 'ready').length
    return [{
      outfitId: target.outfitId, left: here.length, ready, coming: here.filter((u) => u.supply === 'coming').length,
      canStart: ready > 0 && planned.free.includes(target.outfitId),
    }]
  })
}

/**
 * What the planner holds back of a Warehouse stack (09 §6.1's "needed", T130's `stackCounts`): the free stock the
 * targets' lines were allocated.
 */
export const neededFromStock = (planned: Plan, item: ItemId): number =>
  [...planned.dishes, ...planned.crafted, ...planned.raw].filter((l) => l.item === item).reduce((sum, l) => sum + l.have, 0)
