// Repeat (docs/game/02-check-ins-and-notifications.md §5; docs/game/07-farm.md §9; docs/game/05-training-hub.md
// §2): restarts each Free Uma's last job or session where the stock allows. Umas go in the order of their last slots,
// each seeing the stock the ones before left and taking the lowest free slot at the same building and room, so Collect
// all then Repeat all always finds one. The size is the last one, or the fitted one when the profile says `fit`, shrunk
// to the stock ("×6 → ×3"); gathering always starts; a session takes T128's next unlocks there while the items they
// take last (D375: some take none); the grade stays, with a note when a higher one is open. An Uma is skipped, with a
// reason and a fix, when she has nothing to repeat (recalled or promoted), isn't Free, has a stopped queue, is short,
// finds the place full, has finished that facility for her open layers, or was at the Dojo, where which card to bond
// is the owner's choice.
import { buyPrice, farmLevelsOf, RAW_PER_PURCHASE, stockedGrade } from '../economy/exchange'
import type { BuildingId, RoomId } from '../farm/buildings'
import { farmItemSeconds } from '../farm/jobs'
import { craftedItem, heldFor, itemById, planetDish, rawItem, tonicItem, type ItemGrade, type ItemId } from '../items/catalogue'
import { highestOpenGrade } from '../items/grades'
import { recipeOf, type RecipeInput } from '../items/recipes'
import { assertNow } from '../tiers/ledger'
import { nextUnlocks } from '../training/order'
import { sessionSeconds, type Unlock } from '../training/unlocks'
import { isRefusal, type OpResult, type ReworkState, type RepeatSizing } from '../state/types'
import { isFree, statusOf, chainEnd } from '../work/activity'
import type { WorkEnv } from '../work/kinds'
import { MAX_ITEMS_PER_ENTRY, slotsOf, start } from '../work/operations'
import { WORK_REFUSALS } from '../work/refusals'
import { joinSettles, settle } from '../work/settle'
import { shortfall, slotHolder, slotOrder, speedAt, sumInputs } from '../work/state'
import { SESSION_KIND, type ItemMovement, type SettleReport, type SlotRef, type WorkRequest, type WorkState } from '../work/types'
import { fitSize } from './schedule'
import { CHECK_IN_WORDS, say, type Words } from './words'

/** Repeat's two sizes (02 §5): the last one, or the one the picker would mark. */
export const REPEAT_SIZINGS: readonly RepeatSizing[] = Object.freeze(['same', 'fit'] as const)

/** What the Exchange would sell to cover a shortfall (09 §5): each raw item at today's price. */
export interface BuyLine {
  readonly sku: ItemId
  readonly qty: number
  readonly unitPrice: number
}

export interface BuyFix {
  readonly items: readonly BuyLine[]
  readonly total: number
}

/**
 * The Exchange's price for `short` (09 §5, §5.3): every item raw, stocked at its grade and at most 99 a purchase, or
 * null when it can't all be bought. T130's `buyPrice` and stock rule, read where they live.
 */
export function buyFor(state: ReworkState, short: readonly RecipeInput[]): BuyFix | null {
  if (short.length === 0) return null
  const stocked = stockedGrade(state.profile, farmLevelsOf(state))
  const items: BuyLine[] = []
  for (const { item, qty } of short) {
    const def = itemById(item)
    const unitPrice = buyPrice(item)
    if (def?.kind !== 'raw' || unitPrice === undefined || def.grade > stocked || qty > RAW_PER_PURCHASE) return null
    items.push({ sku: item, qty, unitPrice })
  }
  return { items, total: items.reduce((sum, line) => sum + line.qty * line.unitPrice, 0) }
}

/** A fix Repeat offers beside a skip (02 §4 "Couldn't repeat"). */
export type RepeatFix =
  | ({ readonly kind: 'buy' } & BuyFix)
  /** Make the missing input with a Free Uma (the summary picks her). */
  | { readonly kind: 'make'; readonly item: ItemId; readonly qty: number }
  | { readonly kind: 'pick-another'; readonly building: BuildingId; readonly room: RoomId | null }
  /** Opens her Dojo sheet with the room chosen. */
  | { readonly kind: 'pick-cards'; readonly room: RoomId | null }
  /** Queue stopped's fixes put back what she was meant to do next. */
  | { readonly kind: 'queue-stopped' }
  /** The planner's next suggestion for her. */
  | { readonly kind: 'suggestion' }

export interface RepeatStart {
  readonly outfitId: string
  readonly slot: SlotRef
  readonly request: WorkRequest
  /** The size Repeat aimed for (her last, or the fitted one), and the size started. */
  readonly from: number
  readonly to: number
  /** True when the stock covered less than that size: "×6 → ×3". */
  readonly shrunk: boolean
  /** The same line at her highest open grade, when it is higher: "grade 2 open", with **Switch**. */
  readonly switchTo: { readonly item: ItemId; readonly grade: ItemGrade } | null
  readonly endsAt: number
  /** The summary's notes: "×6 → ×3", "grade 2 open". */
  readonly notes: readonly Words[]
}

export interface RepeatSkip {
  readonly outfitId: string
  readonly code: string
  readonly words: Words
  readonly fixes: readonly RepeatFix[]
}

export interface RepeatReceipt {
  readonly started: readonly RepeatStart[]
  readonly skipped: readonly RepeatSkip[]
  readonly movements: readonly ItemMovement[]
  readonly settled: SettleReport
}

export interface RepeatInput {
  /** These Umas; every Free Uma with a last job or session when absent. */
  readonly outfitIds?: readonly string[]
  /** Only Umas whose last work was at these places. */
  readonly places?: readonly BuildingId[]
  /** The device's offset from UTC in minutes, for "Fit to next check-in"; 0 when absent. */
  readonly utcOffsetMin?: number
}

const requestSize = (request: WorkRequest): number => (request.kind === SESSION_KIND ? request.unlocks.length : request.count)

/**
 * The same line at grade `g`: raw, crafted, a planet dish or a tonic; null for a Duo or a Feast, whose grade is the
 * node's, and for a retired dish, which is never cooked again (D375).
 */
function sameLineAt(item: ItemId, g: ItemGrade): ItemId | null {
  const def = itemById(item)
  if (def?.kind === 'raw') return rawItem(def.family, g).id
  if (def?.kind === 'crafted') return craftedItem(def.family, g).id
  if (def?.kind === 'dish' && def.dish === 'planet' && !def.retired) return planetDish(def.family, g).id
  if (def?.kind === 'tonic') return tonicItem(g).id
  return null
}

function switchTo(item: ItemId, farmLevel: number): RepeatStart['switchTo'] {
  const def = itemById(item)
  if (def === undefined || def.kind === 'ticket') return null
  const open = highestOpenGrade(farmLevel)
  const higher = open > def.grade ? sameLineAt(item, open) : null
  return higher === null ? null : { item: higher, grade: open }
}

/** Fixes for a shortfall: buy it when the Exchange can, make the first missing item, or pick another job. */
function shortFixes(state: WorkState, short: readonly RecipeInput[], place: SlotRef): RepeatFix[] {
  const buy = buyFor(state, short)
  return [
    ...(buy ? [{ kind: 'buy' as const, ...buy }] : []),
    { kind: 'make', item: short[0]!.item, qty: Math.min(short[0]!.qty, MAX_ITEMS_PER_ENTRY) },
    { kind: 'pick-another', building: place.building, room: place.room ?? null },
  ]
}

type Planned = { readonly request: WorkRequest; readonly from: number; readonly to: number; readonly switchTo: RepeatStart['switchTo'] } | RepeatSkip

/** Her repeated request at `place`, or why not. */
function repeatRequest(state: WorkState, outfitId: string, last: { slot: SlotRef; request: WorkRequest }, sizing: RepeatSizing, now: number, utcOffsetMin: number): Planned {
  const uma = state.umas[outfitId]!
  const { slot: place, request } = last
  const times = state.profile.checkIns
  const skip = (code: string, words: Words, fixes: RepeatFix[]): RepeatSkip => ({ outfitId, code, words, fixes })
  if (request.kind === SESSION_KIND) {
    const facility = place.building
    if (facility === 'dojo') return skip('pick-cards', say(CHECK_IN_WORDS['pick-cards']), [{ kind: 'pick-cards', room: place.room ?? null }])
    if (facility !== 'observatory' && facility !== 'lineage-hall' && facility !== 'gym') throw new RangeError(`A session isn't made at ${facility}`)
    const next = nextUnlocks(uma.build, uma, facility, place.room ?? null, MAX_ITEMS_PER_ENTRY)
    if (next.length === 0) return skip('place-done', say(CHECK_IN_WORDS['place-done'], { place: facility }), [{ kind: 'suggestion' }])
    const left = new Map<ItemId, number>()
    const takeable: Unlock[] = []
    for (const unlock of next) {
      if (unlock.dishId === null) {
        takeable.push(unlock)
        continue
      }
      const have = left.get(unlock.dishId) ?? heldFor(state.items, unlock.dishId)
      if (have < 1) break
      left.set(unlock.dishId, have - 1)
      takeable.push(unlock)
    }
    const speed = speedAt(state, facility)
    const size = sizing === 'fit' && takeable.length > 0
      ? fitSize(now, takeable.map((u) => sessionSeconds(u.grade, speed)), times, utcOffsetMin)
      : requestSize(request)
    if (takeable.length === 0) {
      const short = shortfall(state.items, sumInputs(next.slice(0, size).map((u) => (u.dishId === null ? [] : [{ item: u.dishId, qty: 1 }]))))
      return skip('short', say(CHECK_IN_WORDS.short, { n: short[0]!.qty, item: short[0]!.item }), shortFixes(state, short, place))
    }
    const unlocks = takeable.slice(0, size)
    return { request: { kind: SESSION_KIND, unlocks }, from: size, to: unlocks.length, switchTo: null }
  }

  const def = itemById(request.item)
  if (def === undefined || def.kind === 'ticket') throw new RangeError(`No item ${request.item} to repeat`)
  // A salad, soup or bread cooked before D375 retired it is never cooked again, so she picks another job.
  if (def.kind === 'dish' && def.dish === 'planet' && def.retired) {
    return skip('retired', say(CHECK_IN_WORDS.retired), [{ kind: 'pick-another', building: place.building, room: place.room ?? null }])
  }
  const inputs = recipeOf(request.item)?.inputs ?? []
  const seconds = farmItemSeconds(request.kind, def.grade, speedAt(state, place.building))
  const size = sizing === 'fit'
    ? fitSize(now, Array.from({ length: MAX_ITEMS_PER_ENTRY }, () => seconds), times, utcOffsetMin)
    : request.count
  const covered = inputs.reduce((n, { item, qty }) => Math.min(n, Math.floor((state.items[item] ?? 0) / qty)), size)
  if (covered < 1) {
    const short = shortfall(state.items, inputs.map(({ item, qty }) => ({ item, qty: qty * size })))
    return skip('short', say(CHECK_IN_WORDS.short, { n: short[0]!.qty, item: short[0]!.item }), shortFixes(state, short, place))
  }
  return { request: { ...request, count: covered }, from: size, to: covered, switchTo: switchTo(request.item, uma.farm.level) }
}

/** The Umas Repeat takes by default: every Free Uma with a last job or session. */
export function repeatable(state: WorkState): readonly string[] {
  return Object.values(state.work).filter((row) => row.last !== null && isFree(state, row.outfitId) && state.umas[row.outfitId]).map((row) => row.outfitId)
}

/** `repeat { outfitIds?, places? }` (02 §5, 13 §6). It never refuses: each Uma it can't restart is a skip. */
export function repeat<S extends WorkState>(state: S, input: RepeatInput, now: number, env: WorkEnv): { readonly state: S; readonly receipt: RepeatReceipt } {
  assertNow(now)
  const before = settle(state, now, env)
  let next = before.state
  const utcOffsetMin = input.utcOffsetMin ?? 0
  const ids = [...new Set(input.outfitIds ?? repeatable(next))]
  const lastSlot = (id: string) => next.work[id]?.last?.slot
  const order = ids
    .filter((id) => input.places === undefined || (lastSlot(id) !== undefined && input.places.includes(lastSlot(id)!.building)))
    .sort((a, b) => {
      const x = lastSlot(a), y = lastSlot(b)
      if (x && y) return slotOrder(x, y) || (a < b ? -1 : 1)
      return x ? -1 : y ? 1 : a < b ? -1 : 1
    })

  const started: RepeatStart[] = []
  const skipped: RepeatSkip[] = []
  const movements: ItemMovement[] = [...before.report.movements]
  const settles: SettleReport[] = [before.report]
  for (const outfitId of order) {
    const skip = (code: string, words: Words, fixes: RepeatFix[] = []) => skipped.push({ outfitId, code, words, fixes })
    const row = next.work[outfitId]
    if (!next.umas[outfitId] || !row?.last) { skip('nothing-to-repeat', say(CHECK_IN_WORDS['nothing-to-repeat'])); continue }
    if (!isFree(next, outfitId)) {
      if (statusOf(row, now) === 'working') {
        const time = chainEnd(next, row, now, env)
        skip('busy', say(WORK_REFUSALS.busy, { uma: outfitId, time }))
      } else skip('collect-first', say(CHECK_IN_WORDS['collect-first']))
      continue
    }
    if (row.dropped !== null) { skip('queue-stopped', say(CHECK_IN_WORDS['queue-stopped']), [{ kind: 'queue-stopped' }]); continue }
    const planned = repeatRequest(next, outfitId, row.last, next.profile.repeatSizing, now, utcOffsetMin)
    if ('code' in planned) { skipped.push(planned); continue }
    const place = row.last.slot
    const slot = slotsOf(next, place.building).find((s) => s.room === place.room && slotHolder(next, s) === undefined)
    if (slot === undefined) {
      skip('place-full', say(CHECK_IN_WORDS['place-full'], { place: place.building }), [{ kind: 'pick-another', building: place.building, room: place.room ?? null }])
      continue
    }
    const result = start(next, { outfitId, slot, request: planned.request }, now, env)
    if (isRefusal(result)) { skip(result.code, say(result.reason, result.data)); continue }
    next = result.state
    movements.push(...result.receipt.movements)
    settles.push(result.receipt.settled)
    const { from } = planned
    const shrunk = planned.to < from
    started.push({
      outfitId, slot, request: planned.request, from, to: planned.to, shrunk, switchTo: planned.switchTo, endsAt: result.receipt.endsAt,
      notes: [
        ...(shrunk ? [say(CHECK_IN_WORDS.shrunk, { from, to: planned.to })] : []),
        ...(planned.switchTo ? [say(CHECK_IN_WORDS['grade-open'], { grade: planned.switchTo.grade })] : []),
      ],
    })
  }
  return { state: next, receipt: { started, skipped, movements, settled: joinSettles(...settles) } }
}

/** `set-repeat-sizing { sizing }` (02 §5, §10; 13 §6): `same` or `fit`, remembered for the account. */
export function setRepeatSizing<S extends ReworkState>(state: S, input: { readonly sizing: RepeatSizing }, now: number): OpResult<{ readonly sizing: RepeatSizing }, S> {
  assertNow(now)
  if (!REPEAT_SIZINGS.includes(input.sizing)) throw new RangeError(`Repeat sizes the same or fits: ${String(input.sizing)}`)
  return { state: { ...state, profile: { ...state.profile, repeatSizing: input.sizing } }, receipt: { sizing: input.sizing } }
}
