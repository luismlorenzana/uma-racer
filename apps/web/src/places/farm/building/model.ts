// A Farm building's page and Peek (docs/rework/07-farm.md §10; docs/rework/11-hub-and-places.md §3.4;
// docs/rework/02-check-ins-and-notifications.md §6; T140), read from one work view: the header with its level, slots in
// use, speed and the next upgrade against stock; "For your targets", the planner's lines here in 02 §6's words, each
// opening the job sheet filled in; one card per slot; the Umas with finished outputs here (the Counter), and who Repeat
// here would take. Pure: every number is the domain's.
import { CHECK_IN_WORDS, buyFor, clockTime, fill, fitSize, hasReady, repeatable, say } from '@racer/domain/check-in'
import {
  BUILDINGS, buildingSpeed, farmItemSeconds, type BuildingLevel, type FarmBuildingId,
} from '@racer/domain/farm'
import {
  canWorkGrade, FAMILIES, highestOpenGrade, itemById, rawItem, type FamilyId, type ItemGrade, type ItemId,
} from '@racer/domain/items'
import {
  Bench, freeUmas, jobFor, placeLines, planFrom, suggestFrom, targetsOf, type Plan, type PlanLine, type Suggestion, type Timing,
} from '@racer/domain/planner'
import {
  buildingLevel, holdsSlot, MAX_ITEMS_PER_ENTRY, speedAt, stockOf, type FarmKind, type SlotRef, type WorkState,
} from '@racer/domain/work'
import { slotCards, upgradeView, type SlotCardModel, type UpgradeView } from '../../../ui/work/model'
import type { WorkView } from '../../../ui/work/view'
import { grouped, type WordsContext } from '../../../ui/work/words'

export type { UpgradeView }
import { farmWords } from '../words'

/** One line of "For your targets" (02 §6). */
export interface TargetLineView {
  readonly line: PlanLine
  /** "Vegetables G3 · short 6 · Warehouse 4 · coming 2 (Gold Ship, 14:10)". */
  readonly words: string
  /** "Grade 4 needs Farm Lv 16 · highest free Uma: Lv 14". */
  readonly gate: string | null
  /** The Exchange's row for a stocked raw item on a gated line: "Buy at the Exchange · 126". */
  readonly buy: { readonly price: number; readonly to: string } | null
  /** The job sheet's query, filled in: the item, `suggest`'s Uma and size, else the first Free Uma who can. */
  readonly sheet: string
}

export interface BuildingView {
  readonly building: FarmBuildingId
  readonly name: string
  readonly job: FarmKind
  /** A site's family; null for the Pantry and the Kitchen. */
  readonly family: FamilyId | null
  readonly level: BuildingLevel
  readonly slots: number
  /** Slots a job holds: "5 of 6 in use". */
  readonly used: number
  readonly speed: number
  /** Null at Lv 3: there is nothing to buy. */
  readonly upgrade: UpgradeView | null
  readonly lines: readonly TargetLineView[]
  readonly cards: readonly SlotCardModel[]
  /** Umas with finished outputs here: the Counter (11 §3.4) and Collect here's slots. */
  readonly ready: number
  readonly readySlots: readonly SlotRef[]
  /** The Umas Repeat here takes: Free, with a last job here. */
  readonly repeatable: readonly string[]
}

/** What a Farm building's slots run (07 §1). */
export function farmKindOf(building: FarmBuildingId): FarmKind {
  const job = BUILDINGS[building].job
  if (job === 'session') throw new RangeError(`${building} runs sessions`)
  return job
}

/** "Vegetables G3" (02 §6): the family and grade of an ingredient or a planet dish; a Duo's or a Feast's kind and grade. */
export function lineLabel(item: ItemId): string {
  const def = itemById(item)
  if (def === undefined || def.kind === 'ticket') return item
  if (def.kind === 'dish' && def.dish !== 'planet') return `${def.dish === 'duo' ? 'Duo' : 'Feast'} G${def.grade}`
  return `${FAMILIES[def.family].name} G${def.grade}`
}

/** A plan line in 02 §6's words. */
export function lineWords(line: PlanLine, context: WordsContext): string {
  const parts = [lineLabel(line.item)]
  if (line.short > 0) parts.push(farmWords('line-short', { n: grouped(line.short) }))
  parts.push(farmWords('line-warehouse', { n: grouped(line.have) }))
  if (line.coming > 0) {
    const from = line.comingFrom
      .map((coming) => farmWords('line-from', { uma: context.umaName(coming.outfitId) || coming.outfitId, time: clockTime(coming.at, context.utcOffsetMin) }))
      .join('; ')
    parts.push(farmWords('line-coming', { n: grouped(line.coming), from }))
  }
  return parts.join(' · ')
}

/** The Exchange's raw row (T138's deep link). */
export const exchangeRow = (family: FamilyId, grade: ItemGrade): string => `/town/exchange?family=${family}&grade=${grade}`

/** The job sheet's query (T140's route): `?job=:itemId&uma=:umaId&count=:n&queue=1&slot=:n&back=<path>`. */
export function sheetQuery(fields: {
  readonly job: ItemId | null
  readonly uma?: string | null
  readonly count?: number | null
  readonly queue?: boolean
  readonly slot?: number | null
  readonly back?: string | null
}): string {
  const params = new URLSearchParams()
  params.set('job', fields.job ?? '')
  if (fields.uma) params.set('uma', fields.uma)
  if (fields.count != null) params.set('count', String(fields.count))
  if (fields.queue) params.set('queue', '1')
  if (fields.slot != null) params.set('slot', String(fields.slot))
  if (fields.back) params.set('back', fields.back)
  return `?${params.toString()}`
}

/** Who and how many a planner line opens the sheet with (07 §10): `suggest`'s line for it, else the first Free Uma who can. */
function prefill(view: WorkView, planned: Plan, suggestions: readonly Suggestion[], building: FarmBuildingId, item: ItemId, timing: Timing): { uma: string | null; count: number | null } {
  const settled = view.settled
  const suggested = suggestions.find((s) => s.item === item && s.slot.building === building)
  if (suggested !== undefined) return { uma: suggested.outfitId, count: suggested.size }
  const def = itemById(item)
  if (def === undefined || def.kind === 'ticket') return { uma: null, count: null }
  const uma = freeUmas(settled).find((candidate) => canWorkGrade(candidate.farm.level, def.grade))
  if (uma === undefined) return { uma: null, count: null }
  const job = jobFor(settled, new Bench(settled, planned.freeStock), uma, item, 'fit', timing)
  const seconds = farmItemSeconds(farmKindOf(building), def.grade, speedAt(settled, building))
  const count = job?.size ?? fitSize(view.now, Array.from({ length: MAX_ITEMS_PER_ENTRY }, () => seconds), timing.times, timing.utcOffsetMin)
  return { uma: uma.outfitId, count }
}

function targetLines(view: WorkView, planned: Plan, building: FarmBuildingId, context: WordsContext): TargetLineView[] {
  const lines = placeLines(planned, building)
  if (lines.length === 0) return []
  const timing: Timing = { now: view.now, times: view.settled.profile.checkIns, utcOffsetMin: context.utcOffsetMin }
  const { suggestions } = suggestFrom(view.settled, planned, {}, timing)
  return lines.map((line): TargetLineView => {
    const gate = line.gate === null ? null : fill(say(CHECK_IN_WORDS.gate, { grade: line.grade, level: line.gate.needsLevel, highest: line.gate.highestFree }))
    const def = itemById(line.item)
    const offer = line.gate !== null && def?.kind === 'raw' ? buyFor(view.settled, [{ item: line.item, qty: 1 }]) : null
    const { uma, count } = prefill(view, planned, suggestions, building, line.item, timing)
    return {
      line,
      words: lineWords(line, context),
      gate,
      buy: offer === null || def?.kind !== 'raw' ? null : { price: offer.items[0]!.unitPrice, to: exchangeRow(def.family, def.grade) },
      sheet: sheetQuery({ job: line.item, uma, count }),
    }
  })
}

/** Everything the building page draws at the view's `now`. */
export function buildingView(view: WorkView, building: FarmBuildingId, context: WordsContext): BuildingView {
  const settled = view.settled
  const level = buildingLevel(settled, building)
  const cards = slotCards(settled, building, view.now)
  const planned = planFrom(view.projection, targetsOf(settled), {})
  const readyRows = Object.values(settled.work).filter((row) => holdsSlot(row) && row.slot!.building === building && hasReady(row, view.now))
  return {
    building,
    name: BUILDINGS[building].name,
    job: farmKindOf(building),
    family: BUILDINGS[building].family,
    level,
    slots: cards.length,
    used: cards.filter((card) => card.kind === 'held').length,
    speed: buildingSpeed(level),
    upgrade: upgradeView(view, building),
    lines: targetLines(view, planned, building, context),
    cards,
    ready: readyRows.length,
    readySlots: readyRows.map((row) => row.slot!),
    repeatable: repeatable(settled).filter((outfitId) => settled.work[outfitId]?.last?.slot.building === building),
  }
}

// --- The Peek -------------------------------------------------------------------------------------------------------

/** One grade of a site's family in the Warehouse (11 §3.4). */
export interface StockGrade {
  readonly item: ItemId
  readonly grade: ItemGrade
  readonly count: number
}

/**
 * A site's raw stock by open grade (11 §3.4): grades 1 up to the highest any current Uma has open, the Exchange's
 * reading of "open" (09 §5.3). The Pantry and the Kitchen have no one family: their Peek shows the lines short instead.
 */
export function stockByGrade(settled: WorkState, building: FarmBuildingId): readonly StockGrade[] {
  const family = BUILDINGS[building].family
  if (family === null) return []
  const top = Math.max(1, ...Object.values(settled.umas).map((uma) => highestOpenGrade(uma.farm.level))) as ItemGrade
  return Array.from({ length: top }, (_, i) => {
    const item = rawItem(family, (i + 1) as ItemGrade)
    return { item: item.id, grade: item.grade, count: stockOf(settled.items, item.id) }
  })
}
