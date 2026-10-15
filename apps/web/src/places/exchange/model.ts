// The Exchange's view model (docs/rework/09-racing-rewards-and-exchange.md §5, §5.3, §5.5; T138): Speed Tickets at
// `buyPrice`, raw ingredients by family up to `stockedGrade` with the next grade's lock, each row's Warehouse count and
// the planner's badge ("Vegetables G3 · short 6"), Buy off with `prize-money`'s words when short, the one question at
// 1,000 or more (`buyNeedsConfirm`), and the Peek's top shortage priced by `buyFor`. Pure.
import { buyFor, type OperationEnv } from '@racer/domain/check-in'
import {
  buyNeedsConfirm, buyPrice, EXCHANGE_REFUSALS, farmLevelsOf, RAW_PER_PURCHASE, stockedGrade,
} from '@racer/domain/economy'
import { FAMILIES, gradeOpensAtFarmLevel, rawItem, SPEED_TICKET_ID, type FamilyId, type ItemGrade, type RawItemDef } from '@racer/domain/items'
import { planFrom, projectWork, targetsOf, type Plan, type PlanLine } from '@racer/domain/planner'
import type { WorkState } from '@racer/domain/work'

export const SPEED_TICKET_STEPS = [1, 10, 50] as const
export { RAW_PER_PURCHASE }

export interface RawRow {
  readonly item: RawItemDef
  readonly grade: ItemGrade
  readonly price: number
  readonly held: number
  /** "Vegetables G3 · short 6", while the planner is short of it. */
  readonly badge: string | null
}

export interface RawFamily {
  readonly family: FamilyId
  readonly rows: readonly RawRow[]
  /** The next grade, locked with `not-stocked`'s words; null past grade 10. */
  readonly next: { readonly item: RawItemDef; readonly words: string } | null
}

/** One family's tab: every stocked grade, then the next grade's lock (09 §5.3). */
export function rawFamily(state: WorkState, plan: Plan | null, family: FamilyId): RawFamily {
  const stocked = stockedGrade(state.profile, farmLevelsOf(state))
  const short = new Map((plan?.raw ?? []).filter((line) => line.short > 0).map((line) => [line.item, line.short]))
  const rows: RawRow[] = []
  for (let g = 1; g <= stocked; g += 1) {
    const item = rawItem(family, g as ItemGrade)
    const n = short.get(item.id)
    rows.push({
      item, grade: item.grade, price: buyPrice(item.id)!, held: state.items[item.id] ?? 0,
      badge: n === undefined ? null : `${FAMILIES[family].name} G${item.grade} · short ${n}`,
    })
  }
  const next = stocked < 10 ? rawItem(family, (stocked + 1) as ItemGrade) : null
  return {
    family,
    rows,
    next: next === null ? null : { item: next, words: EXCHANGE_REFUSALS.buy['not-stocked'].replace('{level}', String(gradeOpensAtFarmLevel(next.grade))) },
  }
}

export interface BuyCheck {
  readonly total: number
  /** "Need 120 more" when Prize Money is short; null when it covers the total. */
  readonly short: string | null
  /** A purchase of 1,000 or more asks once (09 §5.5). */
  readonly asks: boolean
}

export function buyCheck(prizeMoney: number, unitPrice: number, qty: number): BuyCheck {
  const total = unitPrice * qty
  return {
    total,
    short: total > prizeMoney ? EXCHANGE_REFUSALS.buy['prize-money'].replace('{n}', (total - prizeMoney).toLocaleString('en-US')) : null,
    asks: buyNeedsConfirm(total),
  }
}

/** The question a large purchase asks once. */
export const buyQuestion = (qty: number, name: string, total: number): string =>
  `Buy ${qty} ${name} for ${total.toLocaleString('en-US')}?`

/** A typed amount as a whole quantity from 1, or null. Speed Tickets have no upper limit (09 §5). */
export function typedQty(text: string): number | null {
  if (!/^\d{1,6}$/.test(text.trim())) return null
  const n = Number(text.trim())
  return n >= 1 ? n : null
}

export const speedTicketPrice = (): number => buyPrice(SPEED_TICKET_ID)!

/** The account settled to `now` and the planner's plan for its targets, from one projection. */
export function exchangeView(state: WorkState, now: number, env: OperationEnv): { readonly current: WorkState; readonly plan: Plan } {
  const projection = projectWork(state, now, env)
  return { current: projection.current, plan: planFrom(projection, targetsOf(projection.current), {}) }
}

/** The planner's top raw shortage the Exchange can fill, with its price (02 §6, `buyFor`). */
export function topShortage(state: WorkState, plan: Plan): { readonly line: PlanLine; readonly total: number } | null {
  for (const line of [...plan.raw].filter((entry) => entry.short > 0).sort((a, b) => b.short - a.short || a.grade - b.grade)) {
    const fix = buyFor(state, [{ item: line.item, qty: line.short }])
    if (fix !== null) return { line, total: fix.total }
  }
  return null
}
