// The career's live blocks (docs/game/architecture.md "The live manual"): the calendar's season mapping, the stages'
// years, the URA Finals' fields, the rewards, the stages' pay and the sim's targets, rendered from the code so
// docs/game/03-careers.md, 12-pacing.md and racing.md can't drift. Registered in packages/domain/src/docs/render.ts.
// Only code-owned rules: no Uma, card, skill or race data. Pure: no I/O.
import { CAREER_STAGE_LABELS } from '../scenario-goals'
import { GRADE_HANDICAP } from '../opponents'
import { FINALE_SEASON, SEASONS } from '../save/records'
import { RIVAL_SEASON_SHARE, rivalTrainedStat } from '../tiers/rivals'
import { QUARTERS, RACE_SEASON_QUARTER, STAGE_YEAR, YEARS, seasonName } from './calendar'
import { FINALE_FIELDS, FINALE_ROUND_NAMES } from './finale'
import { STAGE_PAY_AT_A } from './pay'
import { FINALE_REWARD, OBJECTIVE_CARD_TICKETS, OBJECTIVE_SP } from './rewards'
import { CAREER_TARGETS, INVENTED_TARGETS, type CareerTargets } from './sim'
import { seasonFocus } from './season'

type Cell = string | number
function table(head: readonly Cell[], rows: readonly (readonly Cell[])[]): string {
  const line = (cells: readonly Cell[]) => `|${cells.map((c) => (c === '' ? ' ' : ` ${String(c).replace(/\|/g, '\\|')} `)).join('|')}|`
  return [line(head), `|${head.map(() => '---').join('|')}|`, ...rows.map(line)].join('\n')
}
const pct = (n: number): string => `${Math.round(n * 1000) / 10}%`
const cap = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1)
const CODE_NAMES: Readonly<Record<number, string>> = { 1: 'spring', 2: 'summer', 3: 'autumn', 4: 'winter', 5: 'cherry blossom' }

function careerCalendar(): string {
  const codes = Object.entries(RACE_SEASON_QUARTER).map(([code, quarter]) => [`${code} (${CODE_NAMES[Number(code)]})`, QUARTERS[quarter]!])
  const seasons = table(['Race season code', 'Season of the year'], [...codes, ['0 (none)', 'never an objective']])
  const years = table(['Stage', 'Year'], [
    [CAREER_STAGE_LABELS.maiden, YEARS[STAGE_YEAR.maiden]!],
    [CAREER_STAGE_LABELS.trials, YEARS[STAGE_YEAR.trials]!],
    [`${CAREER_STAGE_LABELS.main}: the earliest`, YEARS[STAGE_YEAR.main]!],
    [`${CAREER_STAGE_LABELS.main}: the others`, YEARS[STAGE_YEAR.main + 1]!],
  ])
  return `${seasons}\n\n${years}`
}

function careerSeasons(): string {
  return table(['Season', 'Index', 'Focus'], Array.from({ length: SEASONS + 1 }, (_, season) =>
    [seasonName(season), season, cap(seasonFocus(season)) + (season === FINALE_SEASON ? ' (Furlong Hand only)' : '')]))
}

function careerFinale(): string {
  return table(['Round', 'Field', 'Rivals\' handicap'], FINALE_FIELDS.map((field) =>
    [FINALE_ROUND_NAMES[field.round], field.grade.toUpperCase(), pct(field.handicap ?? GRADE_HANDICAP[field.grade])]))
}

function careerRewards(): string {
  return table(['What', 'Pays'], [
    ...(['g3', 'g2', 'g1'] as const).map((grade) => [`A ${grade.toUpperCase()} objective's win`,
      `${OBJECTIVE_CARD_TICKETS} Card Ticket, and ${OBJECTIVE_SP[grade]} SP × (1 + the deck's Race Bonus) to the wallet`]),
    ['Winning the URA Finals', `${FINALE_REWARD.umaTickets} Uma Ticket and ${FINALE_REWARD.cardTickets} Card Tickets`],
  ])
}

function careerPay(): string {
  return table(['Game', 'Drills', 'Bond', 'SP'], [['Every game', STAGE_PAY_AT_A.drills, STAGE_PAY_AT_A.bond, STAGE_PAY_AT_A.sp]])
}

function targets(t: CareerTargets): Cell[][] {
  const band = (b: { min: number; max: number }, f: (n: number) => string) => `${f(b.min)}–${f(b.max)}`
  const plain = (n: number) => String(n)
  return [
    ['G3 first tries won (median deck)', t.median === null ? 'won and lost' : `≥ ${pct(t.median.g3)}`],
    ['G2 first tries won', t.median === null ? 'won and lost' : `≥ ${pct(t.median.g2)}`],
    ['G1 first tries won', t.median === null ? 'won and lost' : `≥ ${pct(t.median.g1)}`],
    ['URA Finals finals won', t.final === null ? 'won and lost' : band(t.final, pct)],
    ['A strong deck', 'wins more races in all'],
    ['Tree bought', band(t.tree, pct)],
    ['Deck cards at bond 80', band(t.bonded, plain)],
    ['SP earned, in golds with their whites', band(t.goldSkills, plain)],
    ['Tree bought with one replay of each season\'s play', `≥ ${pct(t.replayTree)}`],
  ]
}

function careerTargets(): string {
  const pack = targets(CAREER_TARGETS)
  const invented = targets(INVENTED_TARGETS)
  return table(['Target', 'Private pack (local)', 'Invented content (CI)'], pack.map((row, i) => [row[0]!, row[1]!, invented[i]![1]!]))
}

function rivalSeasons(): string {
  const stat = rivalTrainedStat(1)
  return table(['Season', 'Share', 'Field stat before the handicap (T = 1)'], RIVAL_SEASON_SHARE.map((share, season) =>
    [seasonName(season), share.toFixed(3), Math.round(stat * share)]))
}

export const LIVE_BLOCKS: Readonly<Record<string, () => string>> = {
  'career-calendar': careerCalendar,
  'career-seasons': careerSeasons,
  'career-finale': careerFinale,
  'career-rewards': careerRewards,
  'career-pay': careerPay,
  'career-targets': careerTargets,
  'rival-seasons': rivalSeasons,
}
