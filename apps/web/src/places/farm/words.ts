// The Farm places' own sentences (docs/game/07-farm.md §10; docs/game/02-check-ins-and-notifications.md §6, §9;
// T140, D366): the building page, its Peek and the job sheet. Rules speak through the domain's refusal tables and
// templates; these are labels and headings around them, and VoiceOver's readings of the icon-first screens. Work reads
// how long it takes or has left, never the clock time it ends. 02 §9's banned words never appear here (`model.test.ts`
// holds every template to `hasBannedWord`).
import { fill } from '@racer/domain/check-in'

export const FARM_WORDS = Object.freeze({
  /** The building page (07 §10). */
  help: 'Each slot holds one Uma making {min} to {max} of one thing, one after another, with up to {queue} more jobs queued behind.',
  'help-site': 'Gathering needs no inputs; the grade a job can make opens with her Farm Level.',
  'help-station': 'A job reserves its inputs when it starts; Recall returns what wasn\'t made.',
  'help-icons': 'A row shows her face in a ring for the current item, what she makes, how many are made and how long is left. Tap + to start a job, the arrow to collect, the circle to repeat a finished job, the ticket to speed one up and ⋯ to queue the next or recall her.',
  /** For your targets (02 §6), one icon per line. */
  'targets-title': 'For your targets',
  'targets-none': 'Nothing here is short for your targets.',
  'target-short': '×{n}',
  'line-short': 'short {n}',
  'line-warehouse': 'Warehouse {n}',
  'line-coming': 'coming {n} ({from})',
  'line-from': '{uma}, in {time}',
  'buy-at-exchange': 'Buy at the Exchange · {price}',
  /** Slot rows and the page's own Collect and Repeat (07 §10, 02 §5). */
  'slots-title': 'Slots',
  'collect-here': 'Collect here',
  'collect-here-n': 'Collect here · {n}',
  'repeat-here': 'Repeat here',
  'repeat-here-n': 'Repeat here · {n}',
  'nothing-to-collect': 'Nothing to collect',
  'nothing-to-repeat': 'Nobody to repeat',
  'collected-line': '{uma}: {items}',
  'collected-farm-exp': 'Farm EXP +{n}',
  'repeated-line': '{uma}: {what} · {time}',
  'skipped-line': '{uma}: {words}',
  /** The Peek (11 §2.6, §3.4). */
  'peek-stock': 'Warehouse by grade',
  /** The job sheet (07 §10). */
  'sheet-title': 'Start a job · {place}',
  'sheet-queue-title': 'Queue a job · {place}',
  'uma-title': 'Free Umas',
  'what-title': 'What',
  'no-umas': 'No Umas yet · unlock them in the Stable',
  'open-stable': 'Open the Stable',
  'no-free-uma': 'No free Uma',
  'pick-item': 'Pick what to make.',
  'uma-chip-label': '{name}, Farm Lv {level}',
  'uma-suited': 'suited',
  'uma-line': '{name} · Farm Lv {level}',
  aptitude: '{aptitude} {letter} · Farm EXP ×{multiplier}',
  'queue-for': 'Next job for {name}',
  'item-label': '{name}, grade {grade}, {stock} in Warehouse',
  'item-needed': '{n} needed',
  'item-locked': 'needs Farm Lv {level}',
  'needed-badge': '×{n}',
  'locked-badge': 'Lv{level}',
  'can-cook-now': 'Can cook now',
  'nothing-cookable': 'Nothing can be cooked from the Warehouse yet.',
  'chosen-item': '{name} · G{grade} · {stock} in Warehouse',
  'wanted-by': 'for {names}',
  'wanted-more': '{names} +{n}',
  'farm-exp': 'Farm EXP +{n}',
  input: '{item} {have} of {need}',
  'input-short': '{item} {have} of {need} · {short} short',
  'inputs-label': 'Inputs',
  start: 'Start · ×{n} · {time}',
  queue: 'Queue · ×{n} · {time}',
  'start-plain': 'Start',
  'queue-plain': 'Queue',
  'no-slot': 'Every slot is taken. The next one here frees in {time}.',
  'no-slot-ready': 'Every slot is taken. Collect here to free one.',
  'make-at': 'Make {item} at the {place}',
  'buy-raw': 'Buy {item} at the Exchange · {price}',
  /** Kitchen tabs and dish destinations (07 §10, 08 §2). */
  'tab-skill': 'Skill bonds',
  'tab-duos': 'Duos',
  'tab-feasts': 'Feasts',
  'to-duo': 'Duo: {a} & {b}',
  'to-sun': 'Sun nodes',
} as const)

export type FarmWord = keyof typeof FARM_WORDS

export const farmWords = (key: FarmWord, data?: Readonly<Record<string, string | number>>): string =>
  fill(data === undefined ? { text: FARM_WORDS[key] } : { text: FARM_WORDS[key], data })
