// The check-in summary's own sentences (docs/game/02-check-ins-and-notifications.md §4, §5, §9; T142): headings,
// lines and buttons around the rules' words, which come from the domain's tables (`CHECK_IN_WORDS`, the refusals) and
// are filled with `showWords`. 02 §9's banned words never appear here (`check-in.test.tsx` holds every template, and
// every filled one, to `hasBannedWord`).
import { fill } from '@racer/domain/check-in'

export const SUMMARY_WORDS = Object.freeze({
  /** The header (02 §4). */
  since: 'Check-in · since {time} ({ago})',
  'ago-now': 'just now',
  'ago-minutes': '{n} min ago',
  'ago-hours': '{n} h ago',
  'ago-day': '1 day ago',
  'ago-days': '{n} days ago',
  collecting: 'Collecting…',
  'nothing-to-do': 'Everyone is working. Nothing needs you.',
  /** Collected. */
  collected: 'Collected',
  totals: '{items} · {dishes} · {unlocks}',
  items: '{n} items',
  'items-one': '1 item',
  dishes: '{n} dishes',
  'dishes-one': '1 dish',
  unlocks: '{n} unlocks',
  'unlocks-one': '1 unlock',
  'note-bond': 'bond with {name}',
  'note-unlocks': '{place} {what}',
  'note-level': 'Farm Lv {from} → {to}',
  'line-label': '{uma}: {what}',
  /** Repeated (Repeat all's receipt, 02 §5). */
  repeated: 'Repeated ({n})',
  'repeated-line': '{what} → {time}',
  switch: 'Switch',
  'switch-label': 'Switch {uma} to grade {grade}',
  /** Free. */
  free: 'Free ({n})',
  'start-suggestions': 'Start suggestions ({n})',
  'suggest-gather': 'Gather {what} ×{n} → {time}',
  'suggest-craft': 'Craft {what} ×{n} → {time}',
  'suggest-cook': 'Cook {what} ×{n} → {time}',
  'suggest-session': '{place} ×{n} → {time}',
  'free-idle': 'Nothing she can start for your targets now.',
  repeat: 'Repeat',
  'repeat-label': 'Repeat {uma}’s last job',
  'open-line': 'Open {uma}’s suggestion',
  /** Queue stopped. */
  stopped: 'Queue stopped ({n})',
  /** Couldn't repeat. */
  'couldnt-repeat': 'Couldn’t repeat ({n})',
  'fix-buy': 'Buy {n} and repeat · {price}',
  'fix-buy-ask': 'Buy {items} for {price} Prize Money and repeat {uma}’s job?',
  'fix-make': 'Make them: {place} ×{n}',
  'fix-pick-another': 'Pick another',
  'fix-pick-cards': 'Pick cards',
  'fix-queue-stopped': 'See her stopped queue',
  'fix-suggestion': 'Start: {what}',
  /** Training done and Ready to advance. */
  'training-done': 'Training done ({n})',
  race: 'Race',
  'race-label': 'Race {uma}',
  'ready-to-advance': 'Ready to advance ({n})',
  'advance-line': 'scenario {from} complete',
  advance: 'Advance',
  'advance-label': 'Advance {uma}',
  /** Next and Money. */
  next: 'Next: {time} {place} ×{n} · all done by {done}',
  money: 'Prize Money {pm} · Speed Tickets {tickets}',
  'speed-up': 'Speed up',
  /** The footer. */
  'repeat-all': 'Repeat all ({n})',
  sizing: 'Repeat sizes',
  same: 'Same size',
  fit: 'Fit size',
  ok: 'OK',
  'section-label': '{title}, tap to show or hide',
  /** Speed up all (02 §4). */
  'speed-title': 'Speed up all',
  'speed-span-hours': '{n} h',
  'speed-span-to': 'to {time}',
  'speed-option': '{span} · {n} Speed Tickets',
  'speed-ask': 'Use {n} Speed Tickets to take {span} off every running job?',
  'speed-done': '{n} Speed Tickets used.',
  'buy-tickets': 'Buy Speed Tickets at the Exchange',
  'best-use': 'Best use',
  'best-use-none': 'Nothing running unblocks your targets yet.',
  'best-line': '{what} → {time}',
  back: 'Back to the check-in',
} as const)

export type SummaryWord = keyof typeof SUMMARY_WORDS

export const summaryWords = (key: SummaryWord, data?: Readonly<Record<string, string | number>>): string =>
  fill(data === undefined ? { text: SUMMARY_WORDS[key] } : { text: SUMMARY_WORDS[key], data })
