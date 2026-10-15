// The words every timed thing shows (docs/rework/02-check-ins-and-notifications.md §9; T140): a rule's or a question's
// template from the domain filled for the screen, `{uma}` with her template's name, `{item}` with the item's,
// `{place}` with the building's and `{time}` as a clock time, numbers grouped ("1,200"); and the shared pieces' own
// copy. 02 §9's banned words never appear here (`work.test.ts` holds every template to `hasBannedWord`).
import { clockTime, fill, type Words } from '@racer/domain/rework/check-in'
import { BUILDINGS, isBuildingId } from '@racer/domain/rework/farm'
import { itemById } from '@racer/domain/rework/items'

/** What filling a template reads beyond its data. */
export interface WordsContext {
  /** Her template's name, or '' when the content lacks her. */
  readonly umaName: (outfitId: string) => string
  /** The device's offset from UTC, for clock times. */
  readonly utcOffsetMin: number
}

export const itemName = (item: string): string => itemById(item)?.name ?? item

export const placeName = (building: string): string => (isBuildingId(building) ? BUILDINGS[building].name : building)

export const grouped = (n: number): string => n.toLocaleString('en-US')

/** A template filled for the screen: names for outfits, items and places, clock times for `{time}`. */
export function showWords(words: Words, context: WordsContext): string {
  const data = words.data
  if (data === undefined) return words.text
  const named: Record<string, string | number> = {}
  for (const [key, value] of Object.entries(data)) {
    if (key === 'uma' && typeof value === 'string') named[key] = context.umaName(value) || value
    else if (key === 'item' && typeof value === 'string') named[key] = itemName(value)
    else if (key === 'place' && typeof value === 'string') named[key] = placeName(value)
    else if (key === 'time' && typeof value === 'number') named[key] = clockTime(value, context.utcOffsetMin)
    else named[key] = typeof value === 'number' ? grouped(value) : value
  }
  return fill({ text: words.text, data: named })
}

/** The shared pieces' own sentences: slot cards, Speed Tickets, Recall and queues. */
export const WORK_WORDS = Object.freeze({
  /** A card's VoiceOver line (07 §10). */
  'card-running': '{uma}. {what}, {made} of {count} made, next at {next}',
  'card-ready': '{uma}. {what}, {made} of {count} made, ready to collect',
  'card-free': 'Slot {n}, free',
  made: '{made} / {count} made',
  next: 'next {time}',
  ends: 'ends {time}',
  finished: 'finished {time}',
  'farm-level': 'Farm Lv {level}',
  queued: '+{n}',
  'queued-label': '{n} queued behind',
  free: 'Free',
  'start-job': 'Start a job',
  collect: 'Collect · {n}',
  recall: 'Recall',
  'add-queue': '+ Queue',
  /** 07 §8, 09 §5.1. */
  'speed-up': '−30m',
  'speed-up-label': 'Take 30 minutes off with one Speed Ticket',
  finish: 'Finish · {n}',
  'finish-label': 'Finish now with {n} Speed Tickets',
  'buy-finish': 'Buy {n} and finish · {price}',
  'buy-finish-ask': 'Buy {n} Speed Tickets for {price} Prize Money and finish now?',
  waste: '{minutes} of the ticket’s 30 minutes go unused. Finish now?',
  'buy-waste': 'Buy 1 Speed Ticket for {price} Prize Money and finish now? {minutes} of its 30 minutes go unused.',
  yes: 'Yes',
  'not-now': 'Not now',
  /** RecallSheet (07 §2, §5). */
  'recall-title': 'Recall {uma}',
  'recall-paid': '{items} collected',
  'recall-returned': '{items} come back',
  'recall-returned-one': '{items} comes back',
  'recall-lost': '{n} minutes of progress lost',
  'recall-lost-one': '1 minute of progress lost',
  'recall-queue': '{n} queued jobs dropped',
  'recall-queue-one': '1 queued job dropped',
  'recall-nothing': 'Nothing is lost.',
  'recall-confirm': 'Recall',
  'recall-and-start': 'Recall and start here',
  /** QueueChips (02 §3). */
  'queue-then': 'then {what} → {time}',
  'queue-then-unknown': 'then {what}',
  'queue-up': 'Move {what} earlier',
  'queue-remove': 'Remove {what} from the queue',
  'queue-title': 'Queued behind',
  /** StoppedQueueCard (02 §3, §4; T142). */
  'stopped-label': '{uma}’s queue stopped: {line}',
  'stopped-line': '{place} ×{n} at {time}',
  restart: 'Restart',
  'buy-restart': 'Buy {n} and restart · {price}',
  'buy-restart-ask': 'Buy {items} for {price} Prize Money and restart her queue?',
  'start-smaller': 'Start ×{n}',
  'make-them': 'Make them: {place} ×{n}',
  'make-them-label': 'Make them: {place} ×{n}, by {uma}',
  dismiss: 'Dismiss',
  'dismiss-label': 'Dismiss {uma}’s stopped queue',
  /** UpgradeControls (07 §7, 05 §7). */
  upgrade: 'Upgrade to Lv {level}',
  'upgrade-cost': '{pm} Prize Money',
  'upgrade-item': '{need} {item} · {have} held',
  'upgrade-ask': 'Upgrade the {place} to Lv {level} for {cost}?',
  'upgrade-done': 'The {place} is Lv {level} now.',
  'upgrade-slots': '{slots} slots at Lv {level}',
  'upgrade-speed': 'Speed ×{speed} at Lv {level}',
  /** SizeChips (02 §3). */
  'size-label': 'How many',
  'size-chip': '×{n}',
  'size-chip-label': '×{n}, {words}',
  /** The fallbacks for a request without an item name. */
  'what-farm': '{item} ×{n}',
  'what-session': '{n} unlocks',
  'what-session-one': '1 unlock',
} as const)

export type WorkWord = keyof typeof WORK_WORDS

/** One of the pieces' sentences, filled. */
export const workWords = (key: WorkWord, data?: Readonly<Record<string, string | number>>): string =>
  fill(data === undefined ? { text: WORK_WORDS[key] } : { text: WORK_WORDS[key], data })

/** "8 Chopped Carrot and 2 Wheat Flour". */
export function itemsList(rows: readonly { readonly item: string; readonly qty: number }[]): string {
  const parts = rows.map(({ item, qty }) => `${grouped(qty)} ${itemName(item)}`)
  if (parts.length <= 1) return parts.join('')
  return `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`
}
