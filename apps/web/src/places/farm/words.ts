// The Farm places' own sentences (docs/game/07-farm.md §10; docs/game/02-check-ins-and-notifications.md §6, §9;
// T140): the building page, its Peek and the job sheet. Rules speak through the domain's refusal tables and templates;
// these are labels and headings around them. 02 §9's banned words never appear here (`model.test.ts` holds every
// template to `hasBannedWord`).
import { fill } from '@racer/domain/check-in'

export const FARM_WORDS = Object.freeze({
  /** The building page's header (07 §10). */
  level: 'Lv {level}',
  'slots-in-use': '{used} of {slots} in use',
  speed: 'Speed ×{speed}',
  help: 'Each slot holds one Uma making {min} to {max} of one thing, one after another, with up to {queue} more jobs queued behind.',
  'help-site': 'Gathering needs no inputs; the grade a job can make opens with her Farm Level.',
  'help-station': 'A job reserves its inputs when it starts; Recall returns what wasn\'t made.',
  /** For your targets (02 §6). */
  'targets-title': 'For your targets',
  'targets-none': 'Nothing here is short for your targets.',
  'line-short': 'short {n}',
  'line-warehouse': 'Warehouse {n}',
  'line-coming': 'coming {n} ({from})',
  'line-from': '{uma}, {time}',
  'buy-at-exchange': 'Buy at the Exchange · {price}',
  /** Slot cards and the page's own Collect and Repeat (07 §10, 02 §5). */
  'slots-title': 'Slots',
  'collect-here': 'Collect here',
  'collect-here-n': 'Collect here · {n}',
  'repeat-here': 'Repeat here',
  'repeat-here-n': 'Repeat here · {n}',
  'nothing-to-collect': 'Nothing to collect here yet.',
  'nothing-to-repeat': 'Nobody to repeat here.',
  'collected-line': '{uma}: {items}',
  'collected-farm-exp': 'Farm EXP +{n}',
  'repeated-line': '{uma}: {what} → {time}',
  'skipped-line': '{uma}: {words}',
  /** The Peek (11 §3.4). */
  'peek-free': '{n} free',
  'peek-free-one': '1 free',
  'peek-stock': 'Warehouse by grade',
  'peek-next': 'next {time}',
  'peek-ready': 'ready',
  /** The job sheet (07 §10). */
  'sheet-title': 'Start a job · {place}',
  'sheet-queue-title': 'Queue a job · {place}',
  'uma-title': 'Uma',
  'what-title': 'What',
  change: 'Change',
  'change-uma': 'Change the Uma',
  'change-item': 'Change what to make',
  'show-all': 'Show all {n}',
  'no-umas': 'No Umas yet · unlock them in the Stable',
  'open-stable': 'Open the Stable',
  'pick-uma': 'Pick an Uma.',
  'pick-item': 'Pick what to make.',
  'uma-row': 'Farm Lv {level} · up to grade {grade} · Tier {tier}',
  aptitude: '{aptitude} {letter} · Farm EXP ×{multiplier}',
  'in-session': 'in a session until {time}',
  working: '{place} until {time}',
  'ready-first': 'Ready · collected first',
  'queue-here': 'Her job here · add to queue',
  'recall-here': 'Recall and start here',
  locked: 'Farm Lv {level}',
  stock: '{n} in Warehouse',
  needed: 'Needed × {n}',
  'wanted-by': 'For {names}',
  'wanted-more': '{names} +{n}',
  'can-cook-now': 'Can cook now',
  'nothing-cookable': 'Nothing can be cooked from the Warehouse yet.',
  'each-output': '{minutes} min each',
  ends: 'ends {time}',
  'farm-exp': 'Farm EXP +{n}',
  input: '{item} {have} of {need}',
  'input-short': '{item} {have} of {need} · {short} short',
  start: 'Start',
  'add-to-queue': 'Add to queue',
  'no-slot': 'Every slot is taken. The next job here ends at {time}.',
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
