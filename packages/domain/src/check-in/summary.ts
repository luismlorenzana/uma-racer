// The check-in summary and Speed up all (docs/game/02-check-ins-and-notifications.md §1, §4). The sheet reads top to
// bottom: Collected, Free with the planner's suggestions, Queue stopped with its fixes, Couldn't repeat, Training done,
// Ready to advance, Next and Money; an empty section doesn't show. `since` is when this device last showed the sheet
// (device storage, 02 §10), clamped to `now`. Speed up all takes 1 h, 2 h or "to the next check-in" off every running
// job and session in one tap: each running entry gets ⌈span ÷ 30 minutes⌉ Speed Tickets, never more than finish it, in
// building order, in one receipt, and nothing is spent unless every ticket is there.
import { SPEED_TICKET_ID, type ItemGrade } from '../items/catalogue'
import { assertNow } from '../tiers/ledger'
import { advanceReadiness } from '../tiers/advance'
import { layerDone } from '../training/order'
import { isRefusal, type OpResult, type ScenarioAt, type ScenarioOfTier } from '../state/types'
import { statusOf } from '../work/activity'
import type { WorkEnv } from '../work/kinds'
import { speedUp, type SpeedUpReceipt } from '../work/operations'
import { workRefusal } from '../work/refusals'
import { joinSettles, settle } from '../work/settle'
import { slotOrder, stockOf } from '../work/state'
import { endsAt, remainingMs, ticketsToFinish } from '../work/timeline'
import type { ItemMovement, SettleReport, SlotRef, UnlockRef, WorkRequest, WorkState } from '../work/types'
import { planFrom } from '../planner/needs'
import { projectWork } from '../planner/project'
import { suggestFrom, type PlannerContext, type Suggestion } from '../planner/suggest'
import { targetsOf } from '../planner/targets'
import type { CollectAllReceipt } from './collect-all'
import { queueStopped, type StoppedQueue } from './dropped'
import { repeatable, type RepeatReceipt, type RepeatSkip } from './repeat'
import { nextCheckIn } from './schedule'

/** A notable change in Collected (02 §4): her unlocks, or a Farm Level-up with the grades it opened. */
export type CollectedNote =
  | { readonly kind: 'unlocks'; readonly outfitId: string; readonly unlocks: readonly UnlockRef[] }
  | { readonly kind: 'level'; readonly outfitId: string; readonly from: number; readonly to: number; readonly gradesOpened: readonly ItemGrade[] }

export type SummarySection =
  | {
    readonly kind: 'collected'
    /** "41 items · 6 dishes · 5 unlocks". */
    readonly items: number
    readonly dishes: number
    readonly unlocks: number
    readonly notes: readonly CollectedNote[]
    /** Umas whose queue started an entry since the last visit: "3 queues moved on". */
    readonly queuesMovedOn: number
  }
  | { readonly kind: 'free'; readonly umas: readonly { readonly outfitId: string; readonly suggestion: Suggestion | null }[] }
  | { readonly kind: 'queue-stopped'; readonly queues: readonly StoppedQueue[] }
  /** Each skip with the planner's suggestion for her, where its fix is the next suggestion. */
  | { readonly kind: 'couldnt-repeat'; readonly skipped: readonly (RepeatSkip & { readonly suggestion: Suggestion | null })[] }
  | { readonly kind: 'training-done'; readonly umas: readonly { readonly outfitId: string; readonly scenario: ScenarioOfTier }[] }
  | { readonly kind: 'ready-to-advance'; readonly umas: readonly { readonly outfitId: string; readonly from: ScenarioAt; readonly to: ScenarioAt }[] }
  | {
    readonly kind: 'next'
    /** The next entry to finish: "14:10 Kitchen ×1". */
    readonly next: { readonly at: number; readonly outfitId: string; readonly slot: SlotRef; readonly request: WorkRequest }
    /** When everything running and queued will be done: "all done by 22:05". */
    readonly allDoneAt: number
  }
  | { readonly kind: 'money'; readonly prizeMoney: number; readonly speedTickets: number }

export type SummarySectionKind = SummarySection['kind']

/** 02 §4's sections in order. */
export const SUMMARY_SECTIONS: readonly SummarySectionKind[] = Object.freeze([
  'collected', 'free', 'queue-stopped', 'couldnt-repeat', 'training-done', 'ready-to-advance', 'next', 'money',
] as const)

export interface CheckInSummary {
  /** `since`, clamped to `now`: "since 08:02 (5 h ago)". */
  readonly since: number
  readonly sections: readonly SummarySection[]
  /** **Repeat all (11)**: the Free Umas a Repeat would take. */
  readonly repeatAll: number
  /** **Start suggestions (3)**. */
  readonly startSuggestions: number
}

export interface SummaryInput {
  /** When this device last showed the summary (02 §10). */
  readonly since: number
  /** The Collect all this check-in ran, if any: the Hub's Check-in button opens the sheet without collecting. */
  readonly collect?: CollectAllReceipt
  readonly repeat?: RepeatReceipt
}

/** The check-in summary (02 §4) over the state after this check-in's Collect all and Repeat. */
export function checkInSummary(state: WorkState, input: SummaryInput, now: number, context: PlannerContext): CheckInSummary {
  assertNow(now)
  const since = Math.min(input.since, now)
  const chosen = context.chosen ?? {}
  const timing = { now, times: state.profile.checkIns, utcOffsetMin: context.utcOffsetMin ?? 0 }
  const projection = projectWork(state, now, context.env)
  const { current, ahead } = projection
  const planned = planFrom(projection, context.targets ?? targetsOf(current, chosen), chosen)
  const { suggestions, idle } = suggestFrom(current, planned, chosen, timing)
  const suggestionFor = (outfitId: string) => suggestions.find((s) => s.outfitId === outfitId) ?? null
  const sections: SummarySection[] = []

  // Collected: the totals, the notable lines, and every queue that moved on since the last visit.
  const lines = input.collect?.lines.filter((line) => line.status === 'collected') ?? []
  const notes: CollectedNote[] = lines.flatMap((line): CollectedNote[] => [
    ...(line.unlocks.length > 0 ? [{ kind: 'unlocks' as const, outfitId: line.outfitId!, unlocks: line.unlocks }] : []),
    ...(line.farmLevel.to > line.farmLevel.from
      ? [{ kind: 'level' as const, outfitId: line.outfitId!, from: line.farmLevel.from, to: line.farmLevel.to, gradesOpened: line.gradesOpened }]
      : []),
  ])
  const moved = new Set<string>()
  const inWindow = (at: number) => at > since && at <= now
  for (const line of lines) if (line.queueStarts.some(inWindow)) moved.add(line.outfitId!)
  for (const row of Object.values(current.work)) if (row.entries.some((entry) => entry.fromQueue && inWindow(entry.startedAt))) moved.add(row.outfitId)
  const totals = input.collect?.totals
  if ((totals !== undefined && totals.items + totals.dishes + totals.unlocks > 0) || notes.length > 0 || moved.size > 0) {
    sections.push({
      kind: 'collected', items: totals?.items ?? 0, dishes: totals?.dishes ?? 0, unlocks: totals?.unlocks ?? 0, notes, queuesMovedOn: moved.size,
    })
  }

  // Free: every Free Uma, with her suggestion.
  const free = [...suggestions.map((s) => s.outfitId), ...idle].map((outfitId) => ({ outfitId, suggestion: suggestionFor(outfitId) }))
  if (free.length > 0) sections.push({ kind: 'free', umas: free })

  // Queue stopped: every stopped queue still kept, with its fixes at today's stock and prices.
  const queues = Object.values(current.work)
    .filter((row) => row.dropped !== null)
    .sort((a, b) => slotOrder(a.dropped!.slot, b.dropped!.slot))
    .flatMap((row) => {
      const stopped = queueStopped(current, row.outfitId, now, context.env, timing)
      return stopped ? [stopped] : []
    })
  if (queues.length > 0) sections.push({ kind: 'queue-stopped', queues })

  const skipped = (input.repeat?.skipped ?? []).map((skip) => ({
    ...skip, suggestion: skip.fixes.some((fix) => fix.kind === 'suggestion') ? suggestionFor(skip.outfitId) : null,
  }))
  if (skipped.length > 0) sections.push({ kind: 'couldnt-repeat', skipped })

  // Training done (T128) and Ready to advance (T125): an Uma ready to advance shows only there.
  const umas = Object.values(current.umas).sort((a, b) => (a.outfitId < b.outfitId ? -1 : a.outfitId > b.outfitId ? 1 : 0))
  const ready = umas.flatMap((uma) => {
    const readiness = advanceReadiness(uma)
    return isRefusal(readiness) ? [] : [{ outfitId: uma.outfitId, from: readiness.from, to: readiness.to }]
  })
  const trained = umas
    .filter((uma) => layerDone(uma.build, uma.scenario) && !ready.some((r) => r.outfitId === uma.outfitId))
    .map((uma) => ({ outfitId: uma.outfitId, scenario: uma.scenario }))
  if (trained.length > 0) sections.push({ kind: 'training-done', umas: trained })
  if (ready.length > 0) sections.push({ kind: 'ready-to-advance', umas: ready })

  // Next: the next entry to finish, and when everything started or queued to start will be done.
  let next: Extract<SummarySection, { kind: 'next' }>['next'] | null = null
  let allDoneAt = 0
  for (const row of Object.values(ahead.work)) {
    for (const entry of row.entries) {
      const end = endsAt(entry)
      if (end <= now || row.slot === null) continue
      allDoneAt = Math.max(allDoneAt, end)
      if (next === null || end < next.at || (end === next.at && slotOrder(row.slot, next.slot) < 0)) {
        next = { at: end, outfitId: row.outfitId, slot: row.slot, request: entry.request }
      }
    }
  }
  if (next !== null) sections.push({ kind: 'next', next, allDoneAt })

  const prizeMoney = current.profile.prizeMoney
  const speedTickets = stockOf(current.items, SPEED_TICKET_ID)
  if (prizeMoney > 0 || speedTickets > 0) sections.push({ kind: 'money', prizeMoney, speedTickets })

  return { since, sections, repeatAll: repeatable(current).length, startSuggestions: suggestions.length }
}

// --- Speed up all ---------------------------------------------------------------------------------------------------

/** Speed up all's spans (02 §4): 1 h, 2 h, or the time until the next check-in. */
export type SpeedUpSpan = 60 | 120 | 'next-check-in'
export const SPEED_UP_SPANS: readonly SpeedUpSpan[] = Object.freeze([60, 120, 'next-check-in'] as const)
const MS_PER_MINUTE = 60_000

export interface SpeedUpAllInput {
  readonly all: true
  readonly span: SpeedUpSpan
  /** The device's offset from UTC in minutes, for "to the next check-in"; 0 when absent. */
  readonly utcOffsetMin?: number
}

export interface SpeedUpAllReceipt {
  /** Speed Tickets spent in all: the confirmation's one count. */
  readonly tickets: number
  /** The span in whole minutes. */
  readonly spanMinutes: number
  /** T127's receipt for each running entry, in building order. */
  readonly entries: readonly SpeedUpReceipt[]
  readonly movements: readonly ItemMovement[]
  readonly settled: SettleReport
}

/** The tickets Speed up all would spend on each running entry at `now`, in building order (its confirmation). */
export function speedUpAllPlan(state: WorkState, input: SpeedUpAllInput, now: number, env: WorkEnv): { readonly spanMs: number; readonly entries: readonly { readonly outfitId: string; readonly startedAt: number; readonly tickets: number }[] } {
  assertNow(now)
  if (!SPEED_UP_SPANS.includes(input.span)) throw new RangeError(`Speed up all by 60, 120 or to the next check-in: ${String(input.span)}`)
  const current = settle(state, now, env).state
  const spanMs = input.span === 'next-check-in'
    ? nextCheckIn(now, current.profile.checkIns, input.utcOffsetMin ?? 0) - now
    : input.span * MS_PER_MINUTE
  const each = ticketsToFinish(spanMs)
  const entries = Object.values(current.work)
    .filter((row) => statusOf(row, now) === 'working')
    .sort((a, b) => slotOrder(a.slot!, b.slot!))
    .map((row) => {
      const running = row.entries[row.entries.length - 1]!
      return { outfitId: row.outfitId, startedAt: running.startedAt, tickets: Math.min(each, ticketsToFinish(remainingMs(running, now))) }
    })
  return { spanMs, entries }
}

/**
 * `speed-up { all, span }` (02 §4, 13 §6): T127's `speed-up` on every running entry, each clamped to what finishes it,
 * in one receipt. Refused whole when the tickets run short, and as "already finished" when nothing runs.
 */
export function speedUpAll<S extends WorkState>(state: S, input: SpeedUpAllInput, now: number, env: WorkEnv): OpResult<SpeedUpAllReceipt, S> {
  const { spanMs, entries } = speedUpAllPlan(state, input, now, env)
  const before = settle(state, now, env)
  if (entries.length === 0) return workRefusal('finished')
  const tickets = entries.reduce((sum, entry) => sum + entry.tickets, 0)
  const have = stockOf(before.state.items, SPEED_TICKET_ID)
  if (have < tickets) return workRefusal('tickets', { n: tickets, have })
  let next = before.state
  const receipts: SpeedUpReceipt[] = []
  for (const entry of entries) {
    const result = speedUp(next, entry, now, env)
    if (isRefusal(result)) return result
    next = result.state
    receipts.push(result.receipt)
  }
  return {
    state: next,
    receipt: {
      tickets, spanMinutes: Math.round(spanMs / MS_PER_MINUTE), entries: receipts,
      movements: [...before.report.movements, ...receipts.flatMap((r) => r.movements)],
      settled: joinSettles(before.report, ...receipts.map((r) => r.settled)),
    },
  }
}
