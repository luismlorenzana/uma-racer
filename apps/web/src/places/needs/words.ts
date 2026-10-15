// The planner's views' own sentences (docs/rework/02-check-ins-and-notifications.md §6; T142): her Needs tab, the
// roster view and the target toggle. The plan's lines speak 02 §6's words (`lineWords`, T140's) and the rules' templates
// (`CHECK_IN_WORDS`, `CHECK_IN_REFUSALS`). 02 §9's banned words never appear here (`needs.test.tsx` holds them).
import { fill } from '@racer/domain/check-in'

export const NEEDS_WORDS = Object.freeze({
  title: '{uma} · Needs',
  'back-to-profile': 'Back to {uma}',
  progress: 'Layers',
  'progress-line': '{place} {done}/{total}',
  'unlocks-left': '{n} unlocks left',
  'unlocks-left-one': '1 unlock left',
  'nothing-left': 'Her open layers are done.',
  'dishes-short': 'Dishes',
  'crafted-short': 'Crafted',
  'raw-short': 'Raw',
  'start-title': 'Start now',
  'start-line': '{uma}: {what}',
  start: 'Start',
  'start-label': 'Start {what} with {uma}',
  'none-startable': 'No Free Uma can start one of these now.',
  'buy-at-exchange': 'Buy at the Exchange · {price}',
  /** The target toggle. */
  mark: 'Mark as target',
  remove: 'Remove target',
  'is-target': 'Target {n} of {max}',
  /** The roster view. */
  'roster-title': 'Needs of every Uma',
  targets: 'Targets',
  automatic: 'Automatic: the five furthest behind',
  'no-targets': 'No Uma has unlocks left.',
  up: 'Move {uma} up',
  down: 'Move {uma} down',
  'remove-label': 'Remove {uma} from the targets',
  'roster-unlocks': 'Unlocks left',
  'roster-line': '{n} left',
  'roster-dishes': 'Dishes short',
  'roster-dishes-none': 'No dish is short.',
} as const)

export type NeedsWord = keyof typeof NEEDS_WORDS

export const needsWords = (key: NeedsWord, data?: Readonly<Record<string, string | number>>): string =>
  fill(data === undefined ? { text: NEEDS_WORDS[key] } : { text: NEEDS_WORDS[key], data })
