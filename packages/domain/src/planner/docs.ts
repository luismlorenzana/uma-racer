// The check-ins' live block (docs/game/architecture.md#the-rework-modules "The live manual"): rework/02 §3's gap table, rendered
// from `sizeChips` at the default check-in times with grade-1 items in base minutes, as the page states it. A cell
// fits each window from its first check-in; while the entry before is ×10, the next one queues behind it and fits the
// same check-in, as 02 §3's craft row does. Registered in packages/domain/src/docs/rework.ts. Pure: no I/O.
import { cookBaseMinutes, craftBaseMinutes, gatherBaseMinutes } from '../items/work'
import { SECONDS_PER_MINUTE } from '../state/time'
import { sessionBaseMinutes } from '../training/unlocks'
import { MAX_ITEMS_PER_ENTRY, MAX_QUEUE } from '../work/operations'
import { clockTime, DEFAULT_CHECK_INS, MINUTES_PER_DAY, sizeChips } from '../check-in/schedule'

type Cell = string | number
function table(head: readonly Cell[], rows: readonly (readonly Cell[])[]): string {
  const line = (cells: readonly Cell[]) => `|${cells.map((c) => ` ${String(c).replace(/\|/g, '\\|')} `).join('|')}|`
  return [line(head), `|${head.map(() => '---').join('|')}|`, ...rows.map(line)].join('\n')
}

const MS_PER_MINUTE = 60_000
const UTC = 0

/** The sizes fitted from the window's first check-in, each queued behind a ×10, and when the last ends. */
function fitted(baseMinutes: number, from: number): { sizes: number[]; endsAt: number } {
  const seconds = Array.from({ length: MAX_ITEMS_PER_ENTRY }, () => baseMinutes * SECONDS_PER_MINUTE)
  const sizes: number[] = []
  let at = from * MS_PER_MINUTE
  do {
    const chips = sizeChips(at, seconds, DEFAULT_CHECK_INS, UTC)
    sizes.push(chips.marked)
    at = chips.chips[chips.marked - 1]!.endsAt
  } while (sizes[sizes.length - 1] === MAX_ITEMS_PER_ENTRY && sizes.length <= MAX_QUEUE)
  return { sizes, endsAt: at }
}

function cell(baseMinutes: number, from: number): string {
  const { sizes, endsAt } = fitted(baseMinutes, from)
  const [first, second] = sizes.map((n) => `×${n}`)
  const chain = sizes.length === 1 ? first! : sizes.length === 2 ? `${first} then ${second} queued` : `${sizes.map((n) => `×${n}`).join(', ')} queued`
  return `${chain}, ends ${clockTime(endsAt, UTC)}`
}

/** 02 §3: gaps at the default times, at grade 1. */
function checkInFits(): string {
  const times = DEFAULT_CHECK_INS
  const windows = times.map((from, i) => ({ from, to: times[(i + 1) % times.length]! }))
  const at = (minute: number) => clockTime(minute * MS_PER_MINUTE, UTC)
  const hours = (from: number, to: number) => ((to - from + MINUTES_PER_DAY) % MINUTES_PER_DAY) / 60
  const rows: [string, number][] = [
    ['Gather', gatherBaseMinutes(1)],
    ['Craft', craftBaseMinutes(1)],
    ['Cook', cookBaseMinutes(1)],
    ['Session', sessionBaseMinutes(1)],
  ]
  return table(
    ['Work at grade 1', ...windows.map(({ from, to }) => `${at(from)} → ${at(to)} (${hours(from, to)} h)`)],
    rows.map(([work, minutes]) => [`${work} (${minutes} min each)`, ...windows.map(({ from }) => cell(minutes, from))]),
  )
}

export const LIVE_BLOCKS: Readonly<Record<string, () => string>> = Object.freeze({
  'check-in-fits': checkInFits,
})
