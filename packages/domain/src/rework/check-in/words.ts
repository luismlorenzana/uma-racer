// Plain words for the check-in and the planner (docs/rework/02-check-ins-and-notifications.md §4, §5, §9). Every
// sentence these rules can show is a template here; `{name}` placeholders are filled by the screen from the data
// (`{uma}` an outfit and `{item}` an item it shows by name, `{place}` a building, `{time}` a timestamp it shows as a
// clock time). 02 §9's banned words never appear in a template, and `hasBannedWord` is the test every refusal table of
// the rework is held to.
import { refuse, type Refusal } from '../types'

/** 02 §9: never in player-facing text, with sync error codes and HTTP numbers. */
export const BANNED_WORDS = Object.freeze(['operation', 'receipt', 'revision', 'generation', 'version', 'stale', 'conflict', 'payload', 'id'] as const)

const BANNED = new RegExp(`\\b(${BANNED_WORDS.join('|')})s?\\b|\\bsync (error|failed)\\b|\\b[1-5]\\d\\d\\b`, 'i')

/** Whether `text` holds a banned word, a sync error or an HTTP status number (02 §9). */
export const hasBannedWord = (text: string): boolean => BANNED.test(text)

/** The check-in's and the planner's own sentences. */
export const CHECK_IN_WORDS = {
  /** 02 §2, §9: a line the other device already collected. */
  'already-collected': 'Already collected.',
  /** 02 §9: anything unexpected; the outbox retries by itself. */
  unexpected: "That didn't work. Try again.",
  /** 02 §9: offline. */
  offline: "Saved on this phone. It'll sync when you're back online.",
  /** 02 §9: the stock changed under the size the owner picked. */
  'only-left': 'Only {n} left now. Start ×{n}?',
  /** 02 §3: the size picker. */
  chip: 'ends {end} · then free until {checkIn}',
  'chip-on-time': 'ends {end}',
  fits: 'Fits {time}',
  overnight: 'Overnight',
  /** 02 §5: Repeat. */
  shrunk: '×{from} → ×{to}',
  'grade-open': 'grade {grade} open',
  'nothing-to-repeat': 'Nothing to repeat.',
  'collect-first': 'Collect first.',
  'queue-stopped': 'Her queue stopped.',
  'pick-cards': 'Pick cards',
  'place-done': '{place} done for this scenario.',
  'place-full': '{place} full.',
  short: 'Short {n} {item}.',
  /** 02 §4: the summary. */
  'training-done': 'scenario {scenario} training complete',
  'queues-moved-on': '{n} queues moved on',
  /** 02 §6: the planner. */
  'pick-cards-count': '{n} bonds: pick cards',
  gate: 'Grade {grade} needs Farm Lv {level} · highest free Uma: Lv {highest}',
  estimate: 'about {hours} Uma-hours of work',
} as const

/** The operations T131 and T134 add, refused in plain words. */
export const CHECK_IN_REFUSALS = {
  'check-in-times': 'Pick one to four times.',
  /** The 5 is `MAX_TARGETS`; a test keeps them equal. */
  targets: 'Five targets at most.',
  'nothing-stopped': 'Nothing to restart.',
  'place-full': '{place} full.',
  /** T134's `dev-grant`, everywhere but a dev build or a dev API (M034). */
  'dev-only': 'Dev builds only.',
} as const

export type CheckInRefusalCode = keyof typeof CHECK_IN_REFUSALS

export const checkInRefusal = (code: CheckInRefusalCode, data?: Refusal['data']): Refusal => refuse(code, CHECK_IN_REFUSALS[code], data)

/** A sentence a screen shows: a template and the data that fills it. */
export interface Words {
  readonly text: string
  readonly data?: Readonly<Record<string, string | number>>
}

export const say = (text: string, data?: Words['data']): Words => (data ? { text, data } : { text })

/** A template filled from its data, as the screen does with names left as given. Tests and the sim read it. */
export const fill = (words: Words): string =>
  words.text.replace(/\{(\w+)\}/g, (whole, key: string) => (words.data && key in words.data ? String(words.data[key]) : whole))
