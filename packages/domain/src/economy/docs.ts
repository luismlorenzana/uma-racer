// The Exchange's live blocks in docs/rework/09-racing-rewards-and-exchange.md (M033): the prize table (§2.1), the purse
// bands (§3.3), the raw prices (§5.3) and the sell values (§6), rendered from the code so the page can't drift. Joined
// into `docs/render.ts` through `docs/rework.ts`. §4's rule table is prose and stays hand-written; §3.4, §5.2 and §5.6
// are pacing models for `sim:loop` (T132). Pure.
import { RACE_GRADES, type RaceGrade } from '../types'
import { craftedItem, ITEM_GRADE_LIST, planetDish, rawItem, type ItemId } from '../items/catalogue'
import { FAMILY_IDS } from '../items/families'
import { workValueSeconds } from '../items/work'
import { SECONDS_PER_MINUTE } from '../state/time'
import { isRefusal } from '../state/types'
import { buyPrice } from './exchange'
import { grossPrize, PLACE_SHARE_PERCENT, WIN_PRIZE } from './prizes'
import { PURSE_BANDS, PURSE_SHARE_DENOMINATOR } from './purse'
import { sellPrice } from './selling'

type Cell = string | number
type Align = 'left' | 'right'
/** A Markdown table with 09's alignment: `---:` on right-aligned columns. */
function table(head: readonly Cell[], align: readonly Align[], rows: readonly (readonly Cell[])[]): string {
  const line = (cells: readonly Cell[]) => `|${cells.map((c) => (c === '' ? ' ' : ` ${String(c).replace(/\|/g, '\\|')} `)).join('|')}|`
  return [line(head), `|${align.map((a) => (a === 'right' ? '---:' : '---')).join('|')}|`, ...rows.map(line)].join('\n')
}
const num = (n: number): string => n.toLocaleString('en-US')
const ordinal = (n: number): string => `${n}${n === 1 ? 'st' : n === 2 ? 'nd' : n === 3 ? 'rd' : 'th'}`
const GRADE_LABEL: Readonly<Record<RaceGrade, string>> = {
  debut: 'Debut', maiden: 'Maiden', 'pre-op': 'Pre-OP', op: 'OP', g3: 'G3', g2: 'G2', g1: 'G1',
}
/** Real minutes of work in an item: whole seconds ÷ 60. */
const realMinutes = (id: ItemId): number => workValueSeconds(id)! / SECONDS_PER_MINUTE
const gross = (grade: RaceGrade, place: number): number => {
  const prize = grossPrize({ grade, place })
  if (isRefusal(prize)) throw new Error(prize.reason)
  return prize
}

// --- §2.1 -----------------------------------------------------------------------------------------------------------

function prizeTable(): string {
  /** Grades in order, those paying the same win prize on one row ("Debut, Maiden"). */
  const rows: RaceGrade[][] = []
  for (const grade of RACE_GRADES) {
    const last = rows.at(-1)
    if (last !== undefined && WIN_PRIZE[last[0]!] === WIN_PRIZE[grade]) last.push(grade)
    else rows.push([grade])
  }
  const places = PLACE_SHARE_PERCENT.map((_, i) => i + 1)
  const unpaid = PLACE_SHARE_PERCENT.length + 1
  return table(
    ['Grade', ...places.map((place) => (place === 1 ? ordinal(1) : `${ordinal(place)} (${PLACE_SHARE_PERCENT[place - 1]}%)`)), `${ordinal(unpaid)} and below`],
    ['left', ...places.map((): Align => 'right'), 'right'],
    rows.map((grades) => [grades.map((grade) => GRADE_LABEL[grade]).join(', '), ...places.map((place) => gross(grades[0]!, place)), gross(grades[0]!, unpaid)]),
  )
}

// --- §3.3 -----------------------------------------------------------------------------------------------------------

function purseBands(): string {
  let from = 0
  return table(['Band', 'Gross Prize Money that day', 'Paid'], ['left', 'left', 'left'], PURSE_BANDS.map((rule) => {
    const range = rule.upTo === null ? `above ${num(from)}` : `${num(from)} – ${num(rule.upTo)}`
    from = rule.upTo ?? from
    return [rule.band.charAt(0).toUpperCase() + rule.band.slice(1), range, `${(rule.paidTwentieths * 100) / PURSE_SHARE_DENOMINATOR}%`]
  }))
}

// --- §5.3 -----------------------------------------------------------------------------------------------------------

/** Every family's raw item costs the same at a grade (tested), so one family stands for the row. */
function exchangePrices(): string {
  return table(['Grade', ...ITEM_GRADE_LIST], ['left', ...ITEM_GRADE_LIST.map((): Align => 'right')],
    [['Price', ...ITEM_GRADE_LIST.map((g) => num(buyPrice(rawItem(FAMILY_IDS[0], g).id)!))]])
}

// --- §6 -------------------------------------------------------------------------------------------------------------

/** Every family's items are worth the same at a grade (tested), so one family stands for the row. */
function sellValues(): string {
  return table(
    ['Grade', 'Raw: work', 'Raw: sells for', 'Crafted: work', 'Crafted: sells for', 'Planet dish: work', 'Planet dish: sells for'],
    ['left', 'right', 'right', 'right', 'right', 'right', 'right'],
    ITEM_GRADE_LIST.map((g) => {
      const family = FAMILY_IDS[0]
      return [g, ...[rawItem(family, g).id, craftedItem(family, g).id, planetDish(family, g).id]
        .flatMap((id) => [num(realMinutes(id)), num(sellPrice(id)!)])]
    }),
  )
}

/** Keys are `[a-z-]+`, the docs check's pattern. */
export const LIVE_BLOCKS: Readonly<Record<string, () => string>> = Object.freeze({
  'prize-table': prizeTable,
  'purse-bands': purseBands,
  'exchange-prices': exchangePrices,
  'sell-values': sellValues,
})
