// The stages' live blocks (docs/game/architecture.md "The live manual"): the grade and pay ladder, the sim's bands,
// Training Yard's numbers and drill ladder, and Furlong Hand's grade map, pay, numbers and ability library, rendered
// from the code so docs/game/07-stages.md, 08-training-yard.md and 09-furlong-hand.md can't drift. Registered in
// packages/domain/src/docs/render.ts. Only code-owned rules. Pure: no I/O.
import { STAGE_PAY_AT_A, stagePay } from '../career/pay'
import { STAGE_NAMES } from './contract'
import {
  ABILITIES, ABILITY_BY_EFFECT, ABILITY_WORDS, BAND_DRIVE, BREATH_BASE, BREATH_MAX, CHAIN_AT, CLASS_FLOORS, CLEAN_DRIVE, CLEAN_TASK,
  CLEAR_LENGTHS, COLUMNS, DEPTH, DRIVE_BASE, DRIVE_MAX, FIELD, FLIP_BREATH, FURLONG_VERSION, HINT_PER_PEEK, INITIAL_BREATH_MAX, INITIAL_PER_BREATH,
  KINDRED_BOND, LENGTH,
  OUTSIDE_BREATH, PARTNER_POINTS, PILE, PLACE_P, POINT, RACE_BONUS_PER_DRIVE, RAINBOW_BOND, RAINBOW_CARDS, SECOND_WIND, SKILL_CARDS,
  SKILL_POINTS, SPURT_DEPTH, STAT_BONUS_PERCENT, STYLE_BAND, UNPLAYED_DEALT, YIELD_BASE,
} from './furlong/rules'
import { FURLONG_RIVALS, LEGS_BY_DISTANCE } from './furlong/setup'
import { GRADE_FLOORS, PAY_MULTIPLIERS, STAGE_GRADES } from './grade'
import { MAX_STAGE_INPUTS } from './ops'
import { registeredStages, stageRules } from './registry'
import { SECONDS_PER_MOVE, STAGE_BANDS, STAGE_MINUTES } from './sim'
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
    ['A play at a human pace', `${STAGE_BANDS.minutes.min}–${STAGE_BANDS.minutes.max} minutes (the competent bot's median moves); Furlong Hand ${STAGE_MINUTES['furlong-hand'].min}–${STAGE_MINUTES['furlong-hand'].max}`],
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

const ordinal = (n: number): string => `${n}${n === 1 ? 'st' : n === 2 ? 'nd' : n === 3 ? 'rd' : 'th'}`

function furlongGrades(): string {
  const rows: Cell[][] = [
    [`1st, ${CLEAR_LENGTHS} lengths clear or more, with every task`, `${PLACE_P[0]} + a hundredth a length clear`, 'S'],
    ['1st', `${PLACE_P[0]} + a hundredth a length clear (under ${GRADE_FLOORS.S})`, 'A'],
  ]
  for (let place = 2; place <= FURLONG_RIVALS + 1; place += 1) {
    const p = PLACE_P[place - 1]!
    const g = p >= GRADE_FLOORS.B ? 'B' : p >= GRADE_FLOORS.C ? 'C' : 'D'
    rows.push([ordinal(place), p, g])
  }
  return table(['Finish', 'p', 'Grade'], rows)
}

function furlongPay(): string {
  return table(['Grade', 'Bond', 'SP'], [...STAGE_GRADES].reverse().map((g) => {
    const pay = stagePay('furlong-hand', PAY_MULTIPLIERS[g])
    return [g, pay.bond, `${pay.sp}, and each Partner's SP Bonus the first time it plays`]
  }))
}

function furlongNumbers(): string {
  const legs = Object.entries(LEGS_BY_DISTANCE).map(([distance, n]) => `${cap(distance)} ${n}`).join(', ')
  return table(['Rule', 'Value'], [
    ['A leg\'s spread', `${COLUMNS} columns ${DEPTH} deep, and a pile of ${PILE} (its first card the lead)`],
    ['The spurt\'s spread', `${COLUMNS} columns ${SPURT_DEPTH} deep, and a pile of ${PILE}`],
    ['Legs before the spurt', legs],
    ['A run card\'s yield', `${YIELD_BASE} points (${POINT} ground a point; a length is ${LENGTH}), +1 on its ground (Speed on a straight, Power on a corner or climb, Guts in the spurt), +1 on the rail's favoured colour, +1 Speed outside, ± half a point a stat class, × its colour's Training Effectiveness and Stat Bonus × ${STAT_BONUS_PERCENT}%`],
    ['Her stat class', `−1 under ${CLASS_FLOORS[0]}% of the season's typical trained Uma, 0 to ${CLASS_FLOORS[1]}%, +1 to ${CLASS_FLOORS[2]}%, +2 above`],
    ['A Partner', `+${PARTNER_POINTS} point run; at bond ${RAINBOW_BOND} (${KINDRED_BOND} if kindred) a rainbow: the next ${RAINBOW_CARDS} cards of its chain yield double, once a spread`],
    ['A Skill card', `+${SKILL_POINTS.white} points (a gold or her unique +${SKILL_POINTS.gold}) on its own ground; ${SKILL_CARDS.join(', ')} of them by her Wit class`],
    ['Breath', `${BREATH_BASE} + her Stamina class + her distance aptitude + 1 a ${INITIAL_PER_BREATH} of the deck's Initial stats (${INITIAL_BREATH_MAX} at most; ${BREATH_MAX} in all); a flip costs ${FLIP_BREATH}, the outside ${OUTSIDE_BREATH}, a leg out of band 1; ${SECOND_WIND} at least for the spurt`],
    ['Drive', `+1 a bank, +1 a chain of ${CHAIN_AT}, +${CLEAN_DRIVE} a clean spread, +${BAND_DRIVE} a leg in band, +1 a ${RACE_BONUS_PER_DRIVE} of the deck's Race Bonus at the spurt; at most ${DRIVE_MAX}; the spurt runs × (${DRIVE_BASE} + Drive) / ${DRIVE_BASE}`],
    ['Bands', Object.entries(STYLE_BAND).map(([style, [lo, hi]]) => `${cap(style)} ${lo}–${hi}`).join(', ')],
    ['A peek at the next spread', `a front card a ${HINT_PER_PEEK} of the deck's Hint Frequency, one more at Wit +1`],
    ['The field', `${FURLONG_RIVALS} rivals; ${FIELD.pace} ground a leg and ${FIELD.spurt} the spurt at strength ${FIELD.reference}, form +${FIELD.form}% to −${FIELD.form}%, a surge or fade ±${FIELD.surge}, ${FIELD.left} for each card she leaves; never more than ${FIELD.slip / LENGTH} lengths clear at a leg's end`],
    ['Later spreads', `deal ${UNPLAYED_DEALT} Partner she hasn't played yet`],
    ['The tasks (all four with a win: S)', `${CLEAR_LENGTHS} lengths clear, ${CLEAN_TASK} clean spreads, every Partner played, every leg in band`],
    ['Rules version', FURLONG_VERSION],
  ])
}

function furlongAbilities(): string {
  return table(['Ability', 'What it does', 'From a unique that boosts'], ABILITIES.map((ability) => {
    const ids = Object.entries(ABILITY_BY_EFFECT).filter(([, each]) => each === ability).map(([id]) => id)
    const extra = ability === 'team-play' ? ' (and the deck make-up conditionals 103, 105, 120)' : ''
    return [cap(ability.replace('-', ' ')), ABILITY_WORDS[ability], `effect ${ids.join(', ')}${extra}`]
  }))
}

export const LIVE_BLOCKS: Readonly<Record<string, () => string>> = {
  'stage-grades': stageGrades,
  'stage-games': stageGames,
  'stage-bands': stageBands,
  'yard-ladder': yardLadder,
  'yard-numbers': yardNumbers,
  'furlong-grades': furlongGrades,
  'furlong-pay': furlongPay,
  'furlong-numbers': furlongNumbers,
  'furlong-abilities': furlongAbilities,
}
