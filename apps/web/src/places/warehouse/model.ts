// The Warehouse's view model (docs/game/07-farm.md §10; docs/game/09-racing-rewards-and-exchange.md §6, §6.1, §8;
// docs/game/08-item-catalogue-and-recipes.md §10; T138): every stack on its shelf (Raw · Crafted · Dishes · Tickets)
// with what's held, reserved (`reservedStock`), coming (`projectWork(...).coming`) and needed (`neededFromStock` over
// the plan for `targetsOf`); the stock sheet's recipes, sell sizes (`stackCounts`), prices (`sellPrice`) and the one
// question a sale asks (`sellConfirmations`); and the Peek's biggest stacks, shortfalls and surplus. Pure.
import type { OperationEnv } from '@racer/domain/check-in'
import { EXCHANGE_REFUSALS, sellConfirmations, sellPrice, stackCounts, type StackCounts } from '@racer/domain/economy'
import { FAMILY_SITE } from '@racer/domain/farm'
import {
  FAMILIES, ITEMS, recipeOf, SPEED_TICKET_ID, workValueSeconds, type Destination, type FamilyId, type ItemDef, type ItemId,
} from '@racer/domain/items'
import { neededFromStock, planFrom, projectWork, targetsOf, type Plan, type PlanLine } from '@racer/domain/planner'
import { reservedStock, type WorkState } from '@racer/domain/work'

export type Shelf = 'raw' | 'crafted' | 'dishes' | 'tickets'
export const SHELVES: readonly Shelf[] = ['raw', 'crafted', 'dishes', 'tickets']
export const SHELF_LABEL: Readonly<Record<Shelf, string>> = { raw: 'Raw', crafted: 'Crafted', dishes: 'Dishes', tickets: 'Tickets' }

/** Where a family's dishes go, as the Kitchen's tabs name them (07 §10). */
export const DESTINATION_LABEL: Readonly<Record<Destination | 'sun', string>> = {
  speed: 'Speed', stamina: 'Stamina', power: 'Power', guts: 'Guts', wit: 'Wit', skill: 'Skill bonds', constellation: 'Constellation',
  inspiration: 'Inspiration', sun: 'Sun',
}

export const shelfOf = (item: ItemDef): Shelf => (item.kind === 'raw' ? 'raw' : item.kind === 'crafted' ? 'crafted' : item.kind === 'dish' ? 'dishes' : 'tickets')

/** The item's family, or a Duo's first; none for a Feast and the Speed Ticket. */
export function familyOf(item: ItemDef): FamilyId | null {
  if (item.kind === 'raw' || item.kind === 'crafted') return item.family
  if (item.kind === 'dish') return item.dish === 'planet' ? item.family : item.dish === 'duo' ? item.families[0] : null
  return null
}

export const gradeOf = (item: ItemDef): number | null => (item.kind === 'ticket' ? null : item.grade)

/** Where it goes: a dish's destination, a Duo's two stats, or its family's for an ingredient. */
export function destinationOf(item: ItemDef): string {
  if (item.kind === 'ticket') return 'Speeds up work'
  if (item.kind === 'dish') {
    if (item.dish === 'duo') return `${item.stats.map((stat) => DESTINATION_LABEL[stat]).join('–')} Duo`
    return DESTINATION_LABEL[item.destination]
  }
  return FAMILIES[item.family].name
}

/** "Carrot Salad · Constellation · grade 1" (08 §10). */
export function itemLine(item: ItemDef): string {
  const grade = gradeOf(item)
  return [item.name, destinationOf(item), ...(grade === null ? [] : [`grade ${grade}`])].join(' · ')
}

export interface StockRow {
  readonly item: ItemDef
  readonly shelf: Shelf
  readonly family: FamilyId | null
  readonly grade: number | null
  readonly line: string
  readonly held: number
  readonly reserved: number
  readonly coming: number
  readonly needed: number
}

export interface Warehouse {
  readonly rows: readonly StockRow[]
  readonly plan: Plan
  readonly counts: (itemId: ItemId) => StockRow | undefined
}

/**
 * Every stack with anything held, reserved, coming or needed, in catalogue order, from one projection at `now`: the
 * state settled to `now` gives held and reserved, the projection gives coming, and the plan for the targets needed.
 */
export function warehouse(state: WorkState, now: number, env: OperationEnv): Warehouse {
  const projection = projectWork(state, now, env)
  const current = projection.current
  const plan = planFrom(projection, targetsOf(current), {})
  const reserved = reservedStock(current, now)
  const coming = new Map<ItemId, number>()
  for (const item of projection.coming) coming.set(item.item, (coming.get(item.item) ?? 0) + 1)
  const rows = ITEMS.map((item): StockRow => ({
    item,
    shelf: shelfOf(item),
    family: familyOf(item),
    grade: gradeOf(item),
    line: itemLine(item),
    held: current.items[item.id] ?? 0,
    reserved: reserved[item.id] ?? 0,
    coming: coming.get(item.id) ?? 0,
    needed: neededFromStock(plan, item.id),
  })).filter((row) => row.held > 0 || row.reserved > 0 || row.coming > 0 || row.needed > 0)
  const byId = new Map(rows.map((row) => [row.item.id, row]))
  return { rows, plan, counts: (itemId) => byId.get(itemId) }
}

export interface ShelfFilter {
  readonly shelf: Shelf
  readonly family: FamilyId | null
  readonly grade: number | null
}

export const filterRows = (rows: readonly StockRow[], filter: ShelfFilter): StockRow[] =>
  rows.filter((row) => row.shelf === filter.shelf && (filter.family === null || row.family === filter.family) && (filter.grade === null || row.grade === filter.grade))

/** 09 §8: the empty Warehouse's line. */
export const EMPTY_WORDS = "Nothing to sell yet: the Farm's first harvest lands here"

// ---- The stock sheet (07 §10, 09 §6.1) ------------------------------------------------------------------------------

/** The recipes that take `itemId`, by the dish or crafted item they make and how many each takes. */
export function recipesUsing(itemId: ItemId): readonly { readonly item: ItemDef; readonly qty: number }[] {
  return ITEMS.flatMap((item) => {
    const input = recipeOf(item.id)?.inputs.find((entry) => entry.item === itemId)
    return input === undefined ? [] : [{ item, qty: input.qty }]
  })
}

/** Make more (07 §10): the building whose job sheet makes it (T140's), or null for the Speed Ticket. */
export function makeAt(item: ItemDef): string | null {
  if (item.kind === 'raw') return FAMILY_SITE[item.family]
  if (item.kind === 'crafted') return 'pantry'
  if (item.kind === 'dish') return 'kitchen'
  return null
}

export type SellSize = 'one' | 'ten' | 'surplus' | 'allFree'
export const SELL_SIZES: readonly SellSize[] = ['one', 'ten', 'surplus', 'allFree']
export const SELL_LABEL: Readonly<Record<SellSize, string>> = { one: 'Sell ×1', ten: 'Sell ×10', surplus: 'Surplus', allFree: 'All free' }

export interface SellOption {
  readonly size: SellSize
  readonly qty: number
  readonly unitPrice: number
  readonly total: number
}

export interface SellSheet {
  readonly counts: StackCounts
  /** The price the sale carries; null for the Speed Ticket, which can't be sold. */
  readonly unitPrice: number | null
  readonly options: readonly SellOption[]
  /** Why there's no Sell at all: Speed Tickets. */
  readonly noSale: string | null
}

export function sellSheet(row: StockRow): SellSheet {
  const counts = stackCounts({ held: row.held, reserved: row.reserved, needed: row.needed })
  const unitPrice = sellPrice(row.item.id) ?? null
  if (unitPrice === null) return { counts, unitPrice, options: [], noSale: EXCHANGE_REFUSALS.sell['not-sellable'] }
  return {
    counts,
    unitPrice,
    options: SELL_SIZES.map((size) => ({ size, qty: counts.sizes[size], unitPrice, total: counts.sizes[size] * unitPrice })),
    noSale: null,
  }
}

/**
 * A size's button, saying what it sells (09 §6.1): ×1 and ×10 are capped at what is held, so with 9 held the ×10 size
 * reads "Sell ×9"; a size of 0 keeps its name, off with its reason; Surplus and All free carry their count.
 */
export function sellLabel(option: Pick<SellOption, 'size' | 'qty'>): string {
  if (option.size === 'surplus' || option.size === 'allFree') return `${SELL_LABEL[option.size]} ×${option.qty}`
  return option.qty === 0 ? SELL_LABEL[option.size] : `Sell ×${option.qty}`
}

/** Why a size is off: there's nothing of it to sell. */
export const sizeOffWords = (size: SellSize): string => (size === 'surplus' ? 'No surplus: the planner needs all of it.' : 'None to sell.')

/** Who the planner needs a stack for, and at which facility, from the plan's lines (02 §6). */
export function neededFor(plan: Plan, itemId: ItemId): { readonly outfitId: string; readonly facility: string } | null {
  const facilityName: Readonly<Record<string, string>> = { observatory: 'Observatory', 'lineage-hall': 'Lineage Hall', gym: 'Gym', dojo: 'Dojo' }
  const takes = (dishId: ItemId): boolean => {
    if (dishId === itemId) return true
    return (recipeOf(dishId)?.inputs ?? []).some((input) => input.item === itemId || recipeOf(input.item)?.inputs.some((raw) => raw.item === itemId) === true)
  }
  // The first target, in allocation order, whose unlocks take it, as a dish or inside one.
  for (const target of plan.targets) {
    const unlock = target.unlocks.find((entry) => takes(entry.unlock.dishId))
    if (unlock !== undefined) return { outfitId: target.outfitId, facility: facilityName[unlock.facility] ?? unlock.facility }
  }
  return null
}

/**
 * The one question a sale asks (09 §6.1), from `sellConfirmations`: a dish's work at live prices ("Sell 2 Cabbage Salad
 * (grade 3) for 698? Each took about 17 hours of work."), what it leaves the planner short and for whom, or a sale of
 * 1,000 or more. Null when it asks nothing. `uma` names an Uma.
 */
export function sellQuestion(row: StockRow, option: SellOption, plan: Plan, uma: (outfitId: string) => string): string | null {
  const asks = sellConfirmations({ itemId: row.item.id, qty: option.qty, held: row.held, needed: row.needed })
  if (asks.length === 0) return null
  const grade = gradeOf(row.item)
  const what = `${option.qty} ${row.item.name}${grade === null ? '' : ` (grade ${grade})`}`
  const parts = [`Sell ${what} for ${option.total.toLocaleString('en-US')}?`]
  if (asks.some((ask) => ask.kind === 'dish')) {
    const hours = Math.round((workValueSeconds(row.item.id) ?? 0) / 3600)
    parts.push(`Each took about ${hours} hours of work.`)
  }
  const needed = asks.find((ask) => ask.kind === 'needed')
  if (needed !== undefined && needed.kind === 'needed') {
    const who = neededFor(plan, row.item.id)
    parts.push(who === null
      ? `This leaves the planner ${needed.short} short.`
      : `This leaves the planner ${needed.short} short for ${uma(who.outfitId)}'s ${who.facility} layer.`)
  }
  return parts.join(' ')
}

// ---- The Peek (11 §3.1) ---------------------------------------------------------------------------------------------

/** The three biggest stacks held. */
export const biggestStacks = (rows: readonly StockRow[], n = 3): readonly StockRow[] =>
  [...rows].filter((row) => row.held > 0).sort((a, b) => b.held - a.held || a.line.localeCompare(b.line)).slice(0, n)

/** The planner's largest shortfalls, any level. */
export const largestShortfalls = (plan: Plan, n = 3): readonly PlanLine[] =>
  [...plan.dishes, ...plan.crafted, ...plan.raw].filter((line) => line.short > 0).sort((a, b) => b.short - a.short || a.grade - b.grade).slice(0, n)

/** "Surplus worth 1,240": every sellable stack's surplus at its sale price. */
export function surplusWorth(rows: readonly StockRow[]): number {
  return rows.reduce((sum, row) => {
    const price = sellPrice(row.item.id)
    return price === undefined ? sum : sum + stackCounts({ held: row.held, reserved: row.reserved, needed: row.needed }).sizes.surplus * price
  }, 0)
}

/** The Speed Ticket's id, for the Tickets shelf. */
export const SPEED_TICKET = SPEED_TICKET_ID
