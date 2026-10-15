// The planner's own views (docs/rework/02-check-ins-and-notifications.md §6 "Targets", "What it shows"; T142): her
// Needs tab (`needsFor`), the roster view (`rosterTotals`) and the targets, as pure readings in 02 §6's words. The
// planner runs with `chosen = {}`: bond picks aren't saved in phase 3, so an unchosen bond reads "N bonds: pick cards"
// and links to her Dojo sheet. Every number is the domain's.
import { buyFor, CHECK_IN_WORDS, fill, say, type OperationEnv } from '@racer/domain/check-in'
import { itemById } from '@racer/domain/items'
import {
  automaticTargets, LINE_LEVELS, needsFor, rosterTotals, type LineLevel, type PlanLine, type Suggestion,
} from '@racer/domain/planner'
import type { WorkState } from '@racer/domain/work'
import { exchangeRow, lineLabel, lineWords } from '../farm/building/model'
import { sessionLink, startWords } from '../check-in/model'
import { grouped, placeName, type WordsContext } from '../../ui/work/words'
import { needsWords } from './words'

/** One plan line as the views draw it: 02 §6's words, its gate, and the Exchange's row when it sells the item. */
export interface LineView {
  readonly line: PlanLine
  /** "Vegetables G3". */
  readonly label: string
  /** "Vegetables G3 · short 6 · Warehouse 4 · coming 2 (Gold Ship, 14:10)". */
  readonly words: string
  /** "Grade 4 needs Farm Lv 16 · highest free Uma: Lv 14". */
  readonly gate: string | null
  /** **Buy at the Exchange · 126**, T138's row (`?family=&grade=`), when `buyFor` can sell it. */
  readonly buy: { readonly price: number; readonly to: string } | null
}

export function lineView(line: PlanLine, settled: WorkState, context: WordsContext): LineView {
  const def = itemById(line.item)
  const offer = line.gate !== null && def?.kind === 'raw' ? buyFor(settled, [{ item: line.item, qty: 1 }]) : null
  return {
    line,
    label: lineLabel(line.item),
    words: lineWords(line, context),
    gate: line.gate === null ? null : fill(say(CHECK_IN_WORDS.gate, { grade: line.grade, level: line.gate.needsLevel, highest: line.gate.highestFree })),
    buy: offer === null || def?.kind !== 'raw' ? null : { price: offer.items[0]!.unitPrice, to: exchangeRow(def.family, def.grade) },
  }
}

/** A line a target still needs more of than the Warehouse holds, as each Farm place lists them (`placeLines`). */
const wanted = (line: PlanLine): boolean => line.need > line.have

export interface StartableView {
  readonly line: LineView
  readonly start: Suggestion
  /** "Amber Sprint: Gather Vegetables G1 ×3 → 17:30". */
  readonly words: string
}

export interface NeedsView {
  readonly outfitId: string
  /** "Observatory 8/12 · Lineage Hall 1/2 · Gym 4/10 · Dojo 3/6". */
  readonly progress: string
  readonly unlocksLeft: number
  /** Dishes, then crafted, then raw: each line she still needs more of than the Warehouse holds. */
  readonly groups: readonly { readonly level: LineLevel; readonly lines: readonly LineView[] }[]
  /** "about 120 Uma-hours of work"; null when nothing is left to make. */
  readonly estimate: string | null
  /** Her first three startable lines, with the Free Uma and size that would start each. */
  readonly startable: readonly StartableView[]
  /** "3 bonds: pick cards"; null with none. */
  readonly pickCards: string | null
  /** Her Dojo sheet, where cards are chosen. */
  readonly dojo: string
}

const SECONDS_PER_HOUR = 3_600

export function needsView(state: WorkState, settled: WorkState, outfitId: string, now: number, env: OperationEnv, context: WordsContext, back: string): NeedsView {
  const needs = needsFor(state, outfitId, now, { env, utcOffsetMin: context.utcOffsetMin, chosen: {} })
  const mine = needs.plan.targets[0]!
  const levels: Readonly<Record<LineLevel, readonly PlanLine[]>> = { dish: mine.dishes, crafted: mine.crafted, raw: mine.raw }
  const hours = Math.round(needs.estimateSeconds / SECONDS_PER_HOUR)
  return {
    outfitId,
    progress: needs.progress.map((p) => needsWords('progress-line', { place: placeName(p.facility), done: p.done, total: p.total })).join(' · '),
    unlocksLeft: mine.unlocks.length + mine.pickCards,
    groups: LINE_LEVELS.map((level) => ({ level, lines: levels[level].filter(wanted).map((line) => lineView(line, settled, context)) }))
      .filter((group) => group.lines.length > 0),
    estimate: needs.estimateSeconds > 0 ? fill(say(CHECK_IN_WORDS.estimate, { hours: grouped(Math.max(1, hours)) })) : null,
    startable: needs.startable.map(({ line, start }) => ({
      line: lineView(line, settled, context),
      start,
      words: needsWords('start-line', {
        uma: context.umaName(start.outfitId) || start.outfitId,
        what: startWords(start.slot, start.request, start.endsAt, context.utcOffsetMin),
      }),
    })),
    pickCards: mine.pickCards > 0 ? fill(say(CHECK_IN_WORDS['pick-cards-count'], { n: mine.pickCards })) : null,
    dojo: sessionLink('dojo', outfitId, null, [], back),
  }
}

// --- Targets (02 §6, §10) -------------------------------------------------------------------------------------------

/** The targets the owner marked, in order, owned Umas only: what `set-targets` edits. */
export const markedTargets = (state: WorkState): readonly string[] => state.profile.targets.filter((outfitId) => state.umas[outfitId] !== undefined)

/** The list after marking her, or after removing her. Past five, `set-targets` refuses in its own words. */
export function toggledTargets(marked: readonly string[], outfitId: string): readonly string[] {
  return marked.includes(outfitId) ? marked.filter((id) => id !== outfitId) : [...marked, outfitId]
}

/** The list with her moved one place up (-1) or down (+1); unchanged at either end. */
export function movedTarget(marked: readonly string[], outfitId: string, by: -1 | 1): readonly string[] {
  const from = marked.indexOf(outfitId)
  const to = from + by
  if (from < 0 || to < 0 || to >= marked.length) return marked
  const next = [...marked]
  next[from] = marked[to]!
  next[to] = outfitId
  return next
}

// --- The roster view (02 §6) ----------------------------------------------------------------------------------------

export interface RosterView {
  /** The owner's targets, in allocation order; empty when automatic. */
  readonly marked: readonly string[]
  /** With none marked, the five furthest behind. */
  readonly automatic: readonly string[]
  /** Unlocks left per Uma, most first. */
  readonly order: readonly { readonly outfitId: string; readonly unlocksLeft: number }[]
  /** Dishes short across the roster, by family and grade, lowest grade first. */
  readonly dishes: readonly LineView[]
}

export function rosterView(state: WorkState, settled: WorkState, now: number, env: OperationEnv, context: WordsContext): RosterView {
  const totals = rosterTotals(state, now, { env, utcOffsetMin: context.utcOffsetMin, chosen: {} })
  const marked = markedTargets(settled)
  return {
    marked,
    automatic: marked.length > 0 ? [] : automaticTargets(settled, {}),
    order: totals.order.filter((entry) => entry.unlocksLeft > 0),
    dishes: totals.plan.dishes.filter((line) => line.short > 0).map((line) => lineView(line, settled, context)),
  }
}
