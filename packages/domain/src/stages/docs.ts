// The stages' live blocks (docs/game/architecture.md "The live manual"): the grade and pay ladder, the sim's bands, and
// Training Yard's numbers and drill ladder, rendered from the code so docs/game/07-stages.md and 08-training-yard.md
// can't drift. Registered in packages/domain/src/docs/render.ts. Only code-owned rules. Pure: no I/O.
import { STAGE_PAY_AT_A } from '../career/pay'
import { STAGE_NAMES } from './contract'
import { GRADE_FLOORS, PAY_MULTIPLIERS, STAGE_GRADES } from './grade'
import { MAX_STAGE_INPUTS } from './ops'
import { registeredStages, stageRules } from './registry'
import { SECONDS_PER_MOVE, STAGE_BANDS } from './sim'
import {
  COLOUR_WEIGHT, FATIGUE_FREE, FATIGUE_PERCENT, MASTERCLASS_DRILLS, PARTNER_BONDED_AT, PARTNER_LIFT, PARTNER_RATE, REST_SP, YARD_LADDER,
  YARD_PLACEMENTS, YARD_SIDE, YARD_TARGET, YARD_TIERS, YARD_VERSION,
} from './yard/rules'

type Cell = string | number
function table(head: readonly Cell[], rows: readonly (readonly Cell[])[]): string {
  const line = (cells: readonly Cell[]) => `|${cells.map((c) => (c === '' ? ' ' : ` ${String(c).replace(/\|/g, '\\|')} `)).join('|')}|`
  return [line(head), `|${head.map(() => '---').join('|')}|`, ...rows.map(line)].join('\n')
}
const pct = (n: number): string => `${Math.round(n * 1000) / 10}%`
const cap = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1)

function stageGrades(): string {
  const floor = (g: (typeof STAGE_GRADES)[number]): string => {
    if (g === 'D') return `under ${GRADE_FLOORS.C}`
    if (g === 'S') return `${GRADE_FLOORS.S} or more, or A with every task`
    return `${GRADE_FLOORS[g]} or more`
  }
  return table(['Grade', 'p', 'Pays × the game\'s pay at A'], [...STAGE_GRADES].reverse().map((g) => [g, floor(g), PAY_MULTIPLIERS[g]]))
}

function stageGames(): string {
  return table(['Game', 'Rules version', 'Pays at A', 'Built'], (Object.keys(STAGE_NAMES) as (keyof typeof STAGE_NAMES)[]).map((kind) => {
    const pay = STAGE_PAY_AT_A[kind]
    const parts = [pay.drills > 0 ? `${pay.drills} drills` : '', pay.bond > 0 ? `${pay.bond} Bond` : '', `${pay.sp} SP`].filter(Boolean).join(', ')
    const rules = stageRules(kind)
    return [STAGE_NAMES[kind], rules === null ? '' : rules.version, parts, registeredStages().includes(kind) ? 'yes' : 'not yet']
  }))
}

function stageBands(): string {
  return table(['Check', 'Band'], [
    ['Seeds a bot', 500],
    ['The competent bot\'s median grade', STAGE_BANDS.competent.join(' or ')],
    ['The novice\'s median grade', STAGE_BANDS.novice.join(' or ')],
    ['The expert\'s S', `${pct(STAGE_BANDS.expertS.min)}–${pct(STAGE_BANDS.expertS.max)} of seeds`],
    ['A play at a human pace', `${STAGE_BANDS.minutes.min}–${STAGE_BANDS.minutes.max} minutes (the competent bot's median moves)`],
    ...Object.entries(SECONDS_PER_MOVE).map(([kind, seconds]) => [`Pace, ${STAGE_NAMES[kind as keyof typeof STAGE_NAMES]}`, `${seconds} s a move`]),
    ['Moves a journal may carry', MAX_STAGE_INPUTS.toLocaleString('en-US')],
  ])
}

function yardLadder(): string {
  return table(['Tier', 'Made by', 'Drills'], YARD_TIERS.map((tier, i) => [
    cap(tier), i === 0 ? 'setting a piece down (its Sweat)' : `merging three ${YARD_TIERS[i - 1]}`, YARD_LADDER[i]!,
  ]).concat([['Masterclass', 'three rainbows touching (they clear)', MASTERCLASS_DRILLS]]))
}

function yardNumbers(): string {
  return table(['Rule', 'Value'], [
    ['The yard', `${YARD_SIDE} × ${YARD_SIDE}`],
    ['Placements a play', YARD_PLACEMENTS],
    ['A colour\'s weight in the queue', `(100 + her growth %) × ${COLOUR_WEIGHT.base}, × ${COLOUR_WEIGHT.focus} for the season's focus`],
    ['A Partner\'s weight in the queue', `${PARTNER_RATE} × (100 + its Specialty Priority), on the colours' scale × 100`],
    ['A Partner\'s lift', `${PARTNER_LIFT.base} tier; ${PARTNER_LIFT.bonded} at bond ${PARTNER_BONDED_AT} or more`],
    ['Fatigue in the queue', `${FATIGUE_PERCENT}%, none among the first ${FATIGUE_FREE} pieces`],
    ['Three Rests clearing', `${REST_SP} SP, beyond the grade's pay`],
    ['The target (grade A)', `${YARD_TARGET} drills scored`],
    ['Rules version', YARD_VERSION],
  ])
}

export const LIVE_BLOCKS: Readonly<Record<string, () => string>> = {
  'stage-grades': stageGrades,
  'stage-games': stageGames,
  'stage-bands': stageBands,
  'yard-ladder': yardLadder,
  'yard-numbers': yardNumbers,
}
