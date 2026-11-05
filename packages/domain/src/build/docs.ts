// The build's live blocks (docs/game/architecture.md "The live manual"): the facility table, pip costs, the hint
// discount ladder, the tree's rules and the deck sim's bands, rendered from the code so docs/game/05-the-build.md and
// 06-cards-and-bonds.md can't drift. Registered in packages/domain/src/docs/render.ts. Only code-owned rules: no card,
// Uma or skill data. Pure: no I/O.
import { BOND_MAX, BRANCHES, CAMPS, DECK_SIZE, PIPS_PER_BRANCH } from '../save/records'
import { capBudgetAt, spCapAt } from '../tiers/scaling'
import { STATS } from '../types'
import { BOND_PER_TRAINING, HINT_BOND } from './bond'
import { BRANCH_NAMES, BRANCH_SEATS } from './deck'
import { CAMP_LEVEL, CAMP_OPENS_AT_LEVEL, CAMP_SESSIONS } from './derive'
import { DECK_BANDS } from './decks'
import { CARD_LEVEL, DROPPED_UNIQUES, FRIENDSHIP_BOND } from './effects'
import { FACILITY_LEVELS, facilityRow, PIP_COSTS, pipCost, PIPS_PER_LEVEL } from './facilities'
import { HEADCOUNT_BONUS, MOOD_GREAT, SESSION_SCALE } from './session'
import { HINT_DISCOUNTS, MAX_SKILLS } from './skills'

type Cell = string | number
function table(head: readonly Cell[], rows: readonly (readonly Cell[])[]): string {
  const line = (cells: readonly Cell[]) => `|${cells.map((c) => (c === '' ? ' ' : ` ${String(c).replace(/\|/g, '\\|')} `)).join('|')}|`
  return [line(head), `|${head.map(() => '---').join('|')}|`, ...rows.map(line)].join('\n')
}
const pct = (n: number): string => `${Math.round(n * 1000) / 10}%`
const num = (n: number): string => n.toLocaleString('en-US')
const cap = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1)
const LEVELS = Array.from({ length: FACILITY_LEVELS }, (_, i) => i + 1)

function facilities(): string {
  return table(['Facility', 'Level', ...STATS.map(cap), 'SP'], BRANCHES.flatMap((branch) => LEVELS.map((level) => {
    const row = facilityRow(branch, level)
    return [level === 1 ? `**${BRANCH_NAMES[branch]}**` : '', level, ...STATS.map((stat) => row.stats[stat] || ''), row.sp]
  })))
}

function pipCosts(): string {
  return table(['Level', 'A pip', 'The level\'s four pips'], LEVELS.map((level) => [level, `${pipCost(level)} drills`, `${PIPS_PER_LEVEL * pipCost(level)} drills`]))
    + `\n\nA Camp node costs ${CAMP_SESSIONS} level-${CAMP_LEVEL} sessions: ${num(CAMP_SESSIONS * pipCost(CAMP_LEVEL))} drills before cuts. A full branch costs ${num(PIP_COSTS.reduce((sum, cost) => sum + PIPS_PER_LEVEL * cost, 0))} drills.`
}

function hintDiscounts(): string {
  return table(['Hint level', 'Discount', 'A 100 SP skill costs'], HINT_DISCOUNTS.map((discount, level) => [level, pct(discount), `${Math.round(100 * (1 - discount))} SP`]))
}

function buildRules(): string {
  const scales = Object.entries(SESSION_SCALE).map(([T, scale]) => `T${T}: ${scale}`).join(', ')
  return table(['Rule', 'Value'], [
    ['Deck', `${DECK_SIZE} owned SSRs whose era allows the scenario, at card level ${CARD_LEVEL}`],
    ['Seats per branch', BRANCH_SEATS],
    ['The tree', `${BRANCHES.length} branches × ${FACILITY_LEVELS} levels × ${PIPS_PER_LEVEL} pips = ${BRANCHES.length * PIPS_PER_BRANCH} pips`],
    ['Camp nodes', `${CAMPS}, open once a branch reaches level ${CAMP_OPENS_AT_LEVEL}; each ${CAMP_SESSIONS} level-${CAMP_LEVEL} sessions in the branch you pick`],
    ['Mood', `fixed at Great: +${pct(MOOD_GREAT)}, scaled by Mood Effect`],
    ['Headcount', `+${pct(HEADCOUNT_BONUS)} a card posted to the branch`],
    ['Friendship', `an own-type card at bond ${FRIENDSHIP_BOND} or more`],
    ['The scale s(T)', scales],
    ['Bond track', `0–${BOND_MAX}, from the card's Initial Friendship Gauge`],
    ['A hint', `every round(${HINT_BOND} ÷ (1 + Hint Frequency)) bond`],
    ['Extra bond', `a pour × (${BOND_PER_TRAINING} + the extra) ÷ ${BOND_PER_TRAINING}`],
    ['Skills held', MAX_SKILLS],
    ['SP a URA Finale career spends', num(spCapAt(1))],
  ])
}

function deckBands(): string {
  return table(['Deck', 'Share of the cap budget', 'At T1'], [
    ['Median, bonded', `${pct(DECK_BANDS.median.min)}–${pct(DECK_BANDS.median.max)}`, `${num(DECK_BANDS.median.min * capBudgetAt(1))}–${num(DECK_BANDS.median.max * capBudgetAt(1))}`],
    ['Strong, bonded', `${pct(DECK_BANDS.strong.min)}–${pct(DECK_BANDS.strong.max)}`, `${num(DECK_BANDS.strong.min * capBudgetAt(1))}–${num(DECK_BANDS.strong.max * capBudgetAt(1))}`],
    ['Any deck', 'never all five stats capped', ''],
  ])
}

function droppedUniques(): string {
  return DROPPED_UNIQUES.join(', ')
}

export const LIVE_BLOCKS: Readonly<Record<string, () => string>> = {
  'build-facilities': facilities,
  'build-pip-costs': pipCosts,
  'build-hint-discounts': hintDiscounts,
  'build-rules': buildRules,
  'build-deck-bands': deckBands,
  'build-dropped-uniques': droppedUniques,
}
