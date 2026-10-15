// The check-in summary as the sheet draws it (docs/rework/02-check-ins-and-notifications.md §4, §5, §6; T142): pure
// readings of `checkInSummary` and the receipts of this sheet's Collect all and Repeat, in the screen's words, with
// each line's link and each fix's operations. Every number and every rule is the domain's: the sections and their
// order, the suggestions, the stopped queues' fixes (`queueStopped`, `buyFor`, `makeThem`), Speed up all's counts
// (`speedUpAllPlan`, its refusal from `speedUpAll` run on the current state) and Best use.
import {
  checkInSummary, CHECK_IN_WORDS, clockTime, fill, makeThem, nextCheckIn, say, speedUpAll, speedUpAllPlan, SPEED_UP_SPANS,
  type BuyLine, type CheckInSummary, type CollectAllReceipt, type OperationEnv, type RepeatReceipt, type SpeedUpSpan,
  type SummarySection, type Words,
} from '@racer/domain/check-in'
import { placeById } from '@racer/domain/hub'
import { bestUse, planFrom, targetsOf, type Suggestion } from '@racer/domain/planner'
import { isRefusal } from '@racer/domain/tiers'
import { facilityOf, UNLOCK_KINDS, unlockKey, unlockLabel, type UnlockKind, type UnlockRef } from '@racer/domain/training'
import { SESSION_KIND, type FarmRequest, type SlotRef, type UnlockRef as WorkUnlockRef, type WorkRequest, type WorkState } from '@racer/domain/work'
import { lineLabel, sheetQuery } from '../farm/building/model'
import { requestWords } from '../../ui/work/QueueChips'
import type { WorkView } from '../../ui/work/view'
import { cardName } from '../../ui/words'
import { grouped, itemsList, placeName, type WordsContext } from '../../ui/work/words'
import { summaryWords } from './words'

type Section<K extends SummarySection['kind']> = Extract<SummarySection, { kind: K }>

/** The summary over the state after this sheet's Collect all and Repeat (02 §4); `since` 0 the first time. */
export function summaryOf(state: WorkState, env: OperationEnv, now: number, utcOffsetMin: number, since: number | null, collect: CollectAllReceipt | null, repeat: RepeatReceipt | null): CheckInSummary {
  return checkInSummary(state, {
    since: since ?? 0,
    ...(collect === null ? {} : { collect }),
    ...(repeat === null ? {} : { repeat }),
  }, now, { env, utcOffsetMin, chosen: {} })
}

export const sectionOf = <K extends SummarySection['kind']>(summary: CheckInSummary, kind: K): Section<K> | undefined =>
  summary.sections.find((section): section is Section<K> => section.kind === kind)

// --- The header -----------------------------------------------------------------------------------------------------

/** "5 h ago" (02 §4): minutes under an hour, hours under two days, then days. */
export function agoWords(since: number, now: number): string {
  const minutes = Math.max(0, Math.floor((now - since) / 60_000))
  if (minutes < 1) return summaryWords('ago-now')
  if (minutes < 60) return summaryWords('ago-minutes', { n: minutes })
  const hours = Math.floor(minutes / 60)
  if (hours < 48) return summaryWords('ago-hours', { n: hours })
  const days = Math.floor(hours / 24)
  return days === 1 ? summaryWords('ago-day') : summaryWords('ago-days', { n: days })
}

/** "Check-in · since 08:02 (5 h ago)", or `title` alone the first time this device shows the sheet. */
export function headerWords(title: string, since: number | null, now: number, utcOffsetMin: number): string {
  if (since === null) return title
  const at = Math.min(since, now)
  return summaryWords('since', { time: clockTime(at, utcOffsetMin), ago: agoWords(at, now) })
}

// --- Words for work -------------------------------------------------------------------------------------------------

/** A work entry's unlock as the training rules type it, or null for a kind they don't know. */
export const asUnlock = (ref: WorkUnlockRef): UnlockRef | null =>
  (UNLOCK_KINDS as readonly string[]).includes(ref.kind) ? { kind: ref.kind as UnlockKind, target: ref.target } : null

/** An unlock as the summary names it: "node 11", "Speed grade 2", or a bond by its card. */
export function unlockWords(work: WorkUnlockRef, env: OperationEnv): string {
  const ref = asUnlock(work)
  if (ref === null) return work.target
  if (ref.kind !== 'bond') return unlockLabel(ref)
  return env.content.cards.has(ref.target) ? summaryWords('note-bond', { name: cardName(env.content, ref.target) }) : unlockLabel(ref)
}

/** A suggestion or a start in 02 §4's words: "Gather Fruits G2 ×3 → 17:30", "Lineage Hall ×1 → 16:15". */
export function startWords(slot: SlotRef, request: WorkRequest, endsAt: number, utcOffsetMin: number): string {
  const time = clockTime(endsAt, utcOffsetMin)
  if (request.kind === SESSION_KIND) return summaryWords('suggest-session', { place: placeName(slot.building), n: request.unlocks.length, time })
  const key = request.kind === 'gather' ? 'suggest-gather' : request.kind === 'craft' ? 'suggest-craft' : 'suggest-cook'
  return summaryWords(key, { what: lineLabel(request.item), n: request.count, time })
}

export const suggestionWords = (suggestion: Suggestion, utcOffsetMin: number): string =>
  startWords(suggestion.slot, suggestion.request, suggestion.endsAt, utcOffsetMin)

// --- Links (T139–T141's routes) -------------------------------------------------------------------------------------

/** Her session sheet (T139): `/training/:facility?session=:umaId&room=:room&unlocks=…&back=<path>`. */
export function sessionLink(facility: string, outfitId: string, room: string | null, unlocks: readonly WorkUnlockRef[], back: string | null): string {
  const params = new URLSearchParams()
  params.set('session', outfitId)
  if (room !== null) params.set('room', room)
  const keys = unlocks.flatMap((unlock) => {
    const ref = asUnlock(unlock)
    return ref === null ? [] : [unlockKey(ref)]
  })
  if (keys.length > 0) params.set('unlocks', keys.join(','))
  if (back !== null) params.set('back', back)
  return `/training/${facility}?${params.toString()}`
}

/** A suggestion's sheet, preselected (02 §4): T140's job sheet, or T139's session sheet. */
export function suggestionLink(suggestion: Suggestion, back: string): string {
  const { slot, request } = suggestion
  if (request.kind === SESSION_KIND) return sessionLink(slot.building, suggestion.outfitId, slot.room ?? null, request.unlocks, back)
  return `/farm/${slot.building}${sheetQuery({ job: request.item, uma: suggestion.outfitId, count: request.count, slot: slot.slot, back })}`
}

export const profileLink = (outfitId: string): string => `/town/stable/outfit/${encodeURIComponent(outfitId)}`
export const needsLink = (outfitId: string): string => `${profileLink(outfitId)}/needs`
export const raceLink = (outfitId: string): string => `/racing/racecourse?uma=${encodeURIComponent(outfitId)}`
/** Her career at the Scenario Gate with T141's Advance sheet open: Advance with its usual confirmation. */
export const advanceLink = (outfitId: string): string => `/racing/scenario-gate/${encodeURIComponent(outfitId)}?sheet=advance`
/** T138's Exchange row for Speed Tickets. */
export const TICKETS_ROW = '/town/exchange?row=speed-tickets'

// --- Collected ------------------------------------------------------------------------------------------------------

export interface NoteView {
  readonly outfitId: string
  /** "Kitasan Black: Observatory node 11", "Gold Ship: Farm Lv 5 → 6 · grade 2 open". */
  readonly words: string
  readonly to: string
}

export interface CollectedView {
  /** "41 items · 6 dishes · 5 unlocks"; null when nothing was collected (only queues moved on). */
  readonly totals: string | null
  readonly notes: readonly NoteView[]
  /** "3 queues moved on"; null at 0. */
  readonly movedOn: string | null
}

/** "41 items", "1 dish". */
const count = (key: 'items' | 'dishes' | 'unlocks', n: number): string =>
  (n === 1 ? summaryWords(`${key}-one`) : summaryWords(key, { n: grouped(n) }))

export function collectedView(section: Section<'collected'>, env: OperationEnv, context: WordsContext): CollectedView {
  const name = (outfitId: string) => context.umaName(outfitId) || outfitId
  const notes = section.notes.map((note): NoteView => {
    if (note.kind === 'unlocks') {
      const byPlace = new Map<string, string[]>()
      for (const unlock of note.unlocks) {
        const ref = asUnlock(unlock)
        const place = ref === null ? '' : placeName(facilityOf(ref.kind))
        byPlace.set(place, [...(byPlace.get(place) ?? []), unlockWords(unlock, env)])
      }
      const what = [...byPlace].map(([place, labels]) => summaryWords('note-unlocks', { place, what: labels.join(', ') })).join(' · ')
      return { outfitId: note.outfitId, words: summaryWords('line-label', { uma: name(note.outfitId), what }), to: profileLink(note.outfitId) }
    }
    const what = [
      summaryWords('note-level', { from: note.from, to: note.to }),
      ...note.gradesOpened.map((grade) => fill(say(CHECK_IN_WORDS['grade-open'], { grade }))),
    ].join(' · ')
    return { outfitId: note.outfitId, words: summaryWords('line-label', { uma: name(note.outfitId), what }), to: profileLink(note.outfitId) }
  })
  const collected = section.items + section.dishes + section.unlocks > 0
  return {
    totals: collected ? summaryWords('totals', { items: count('items', section.items), dishes: count('dishes', section.dishes), unlocks: count('unlocks', section.unlocks) }) : null,
    notes,
    movedOn: section.queuesMovedOn > 0 ? fill(say(CHECK_IN_WORDS['queues-moved-on'], { n: section.queuesMovedOn })) : null,
  }
}

// --- Repeated (Repeat's notes, 02 §5) -------------------------------------------------------------------------------

export interface RepeatedLine {
  readonly outfitId: string
  /** "Amber Sprint: Gather Fruits G1 ×3 → 17:30 · ×6 → ×3 · grade 2 open". */
  readonly words: string
  /** **Switch**: Recall, then the same job at the open grade, at the same place and size. */
  readonly switchTo: { readonly grade: number; readonly slot: SlotRef; readonly request: FarmRequest } | null
}

export interface RepeatedView {
  readonly count: number
  /** The starts with a note: shrunk, or a higher grade open. */
  readonly lines: readonly RepeatedLine[]
}

export function repeatedView(receipt: RepeatReceipt, settled: WorkState, context: WordsContext): RepeatedView {
  const lines = receipt.started.filter((start) => start.notes.length > 0).map((start): RepeatedLine => {
    const notes = start.notes.map(fill)
    const what = [startWords(start.slot, start.request, start.endsAt, context.utcOffsetMin), ...notes].join(' · ')
    // Switch recalls her repeated job, so it shows only while that job is still her latest.
    const current = settled.work[start.outfitId]?.entries.at(-1)
    const still = current !== undefined && sameRequest(current.request, start.request)
    const request = start.request
    return {
      outfitId: start.outfitId,
      words: summaryWords('line-label', { uma: context.umaName(start.outfitId) || start.outfitId, what }),
      switchTo: start.switchTo !== null && still && request.kind !== SESSION_KIND
        ? { grade: start.switchTo.grade, slot: start.slot, request: { ...request, item: start.switchTo.item } }
        : null,
    }
  })
  return { count: receipt.started.length, lines }
}

const sameRequest = (a: WorkRequest, b: WorkRequest): boolean => JSON.stringify(a) === JSON.stringify(b)

// --- Free -----------------------------------------------------------------------------------------------------------

export interface FreeLine {
  readonly outfitId: string
  readonly suggestion: Suggestion | null
  /** "Gather Fruits G2 ×3 → 17:30", or why there is nothing to suggest. */
  readonly words: string
  /** Her suggestion's sheet, preselected; her Needs tab when there is none. */
  readonly to: string
  /** **Repeat** beside her: she has a last job or session. */
  readonly canRepeat: boolean
}

export function freeLines(section: Section<'free'>, settled: WorkState, back: string, utcOffsetMin: number): FreeLine[] {
  return section.umas.map(({ outfitId, suggestion }): FreeLine => ({
    outfitId,
    suggestion,
    words: suggestion === null ? summaryWords('free-idle') : suggestionWords(suggestion, utcOffsetMin),
    to: suggestion === null ? needsLink(outfitId) : suggestionLink(suggestion, back),
    canRepeat: (settled.work[outfitId]?.last ?? null) !== null,
  }))
}

// --- Couldn't repeat ------------------------------------------------------------------------------------------------

export type FixView =
  | { readonly kind: 'buy'; readonly lines: readonly BuyLine[]; readonly n: number; readonly items: string; readonly price: number }
  | { readonly kind: 'make'; readonly suggestion: Suggestion; readonly place: string; readonly n: number }
  | { readonly kind: 'pick-another'; readonly to: string }
  | { readonly kind: 'pick-cards'; readonly to: string }
  | { readonly kind: 'queue-stopped' }
  | { readonly kind: 'suggestion'; readonly suggestion: Suggestion; readonly words: string }

export interface SkipView {
  readonly outfitId: string
  readonly words: Words
  readonly fixes: readonly FixView[]
}

/** Each skip's words and its fixes at the stock now (02 §4 "Couldn't repeat"); a fix the state can't offer is left out. */
export function skipViews(section: Section<'couldnt-repeat'>, settled: WorkState, now: number, utcOffsetMin: number, back: string): SkipView[] {
  const timing = { now, times: settled.profile.checkIns, utcOffsetMin }
  return section.skipped.map((skip): SkipView => ({
    outfitId: skip.outfitId,
    words: skip.words,
    fixes: skip.fixes.flatMap((fix): FixView[] => {
      switch (fix.kind) {
        case 'buy':
          return [{
            kind: 'buy', lines: fix.items, n: fix.items.reduce((sum, line) => sum + line.qty, 0), price: fix.total,
            items: itemsList(fix.items.map((line) => ({ item: line.sku, qty: line.qty }))),
          }]
        case 'make': {
          const suggestion = makeThem(settled, skip.outfitId, fix.item, fix.qty, timing)
          return suggestion === null ? [] : [{ kind: 'make', suggestion, place: placeName(suggestion.slot.building), n: suggestion.size }]
        }
        case 'pick-another':
          return [{ kind: 'pick-another', to: placeById(fix.building)?.route ?? '/farm' }]
        case 'pick-cards':
          return [{ kind: 'pick-cards', to: sessionLink('dojo', skip.outfitId, fix.room, [], back) }]
        case 'queue-stopped':
          return settled.work[skip.outfitId]?.dropped ? [{ kind: 'queue-stopped' }] : []
        case 'suggestion':
          return skip.suggestion === null ? [] : [{ kind: 'suggestion', suggestion: skip.suggestion, words: suggestionWords(skip.suggestion, utcOffsetMin) }]
      }
    }),
  }))
}

// --- Next and Money -------------------------------------------------------------------------------------------------

/** "Next: 14:10 Kitchen ×1 · all done by 22:05". */
export function nextWords(section: Section<'next'>, utcOffsetMin: number): string {
  const { next, allDoneAt } = section
  const n = next.request.kind === SESSION_KIND ? next.request.unlocks.length : next.request.count
  return summaryWords('next', {
    time: clockTime(next.at, utcOffsetMin), place: placeName(next.slot.building), n, done: clockTime(allDoneAt, utcOffsetMin),
  })
}

/** "Prize Money 1,240 · Speed Tickets 18". */
export const moneyWords = (section: Section<'money'>): string =>
  summaryWords('money', { pm: grouped(section.prizeMoney), tickets: grouped(section.speedTickets) })

// --- Speed up all (02 §4) -------------------------------------------------------------------------------------------

export interface SpeedOption {
  readonly span: SpeedUpSpan
  /** "1 h", "2 h", "to 13:00". */
  readonly label: string
  /** Speed Tickets the whole speed-up spends. */
  readonly tickets: number
  /** `speedUpAll`'s refusal on the current state ("Needs 12 Speed Tickets."), else null. */
  readonly refusal: Words | null
  /** True when the refusal is the tickets running short: the Exchange's row is offered. */
  readonly short: boolean
}

export function speedOptions(state: WorkState, env: OperationEnv, now: number, utcOffsetMin: number): SpeedOption[] {
  return SPEED_UP_SPANS.map((span): SpeedOption => {
    const input = { all: true as const, span, utcOffsetMin }
    const plan = speedUpAllPlan(state, input, now, env)
    const tried = speedUpAll(state, input, now, env)
    const label = span === 'next-check-in'
      ? summaryWords('speed-span-to', { time: clockTime(nextCheckIn(now, state.profile.checkIns, utcOffsetMin), utcOffsetMin) })
      : summaryWords('speed-span-hours', { n: span / 60 })
    return {
      span, label, tickets: plan.entries.reduce((sum, entry) => sum + entry.tickets, 0),
      refusal: isRefusal(tried) ? say(tried.reason, tried.data) : null,
      short: isRefusal(tried) && tried.code === 'tickets',
    }
  })
}

export interface BestUseLine {
  readonly outfitId: string
  /** "Amber Sprint: Carrot Salad ×3 → 14:10". */
  readonly words: string
}

/** Best use (02 §4): up to three running entries whose finish unblocks the targets most, from today's plan. */
export function bestUseLines(view: WorkView, context: WordsContext): BestUseLine[] {
  const planned = planFrom(view.projection, targetsOf(view.settled), {})
  return bestUse(planned).map((use) => {
    const entry = view.settled.work[use.outfitId]?.entries.find((candidate) => candidate.startedAt === use.startedAt)
    const what = entry === undefined ? placeName(use.slot.building) : `${placeName(use.slot.building)} · ${requestWords(entry.request)}`
    return {
      outfitId: use.outfitId,
      words: summaryWords('line-label', {
        uma: context.umaName(use.outfitId) || use.outfitId,
        what: summaryWords('best-line', { what, time: clockTime(use.endsAt, context.utcOffsetMin) }),
      }),
    }
  })
}
