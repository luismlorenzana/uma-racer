// Every rule failure of the work engine and the Farm, in plain words (docs/rework/02-check-ins-and-notifications.md §9,
// docs/rework/07-farm.md §10–§11). `{uma}` is her outfit and `{item}` an item, which the screen turns into names;
// `{time}` is a timestamp it shows as a clock time. The data carries what the screen needs to ask again with new numbers
// ("Only 3 left now. Start ×3?"): `freeAt`, the shortfall and `largestCoverable`. One table, so T131's banned-word test
// reads every sentence the work rules can show.
import { refuse, type Refusal } from '../state/types'

export const WORK_REFUSALS = {
  'slot-taken': 'That slot is taken.',
  busy: '{uma} is busy until {time}.',
  count: 'Make 1 to 10 at a time.',
  'not-here': "That isn't made here.",
  grade: 'Needs Farm Lv {level}.',
  'top-level': 'Already at the top level.',
  short: 'Short {n} {item}.',
  'queue-full': 'Three are already queued.',
  'queue-place': 'A queue stays at one place.',
  finished: "It's already finished.",
  tickets: 'Needs {n} Speed Tickets.',
  'prize-money': 'Needs {n} Prize Money.',
} as const

export type WorkRefusalCode = keyof typeof WORK_REFUSALS

export const workRefusal = (code: WorkRefusalCode, data?: Refusal['data']): Refusal => refuse(code, WORK_REFUSALS[code], data)
