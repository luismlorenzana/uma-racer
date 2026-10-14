// The tier rules' live blocks (docs/tasks/M033-rework-rules.md "The live manual"): each table the rework pages state
// that this area owns, rendered from the code so the design can't drift from it. Registered in
// packages/domain/src/docs/rework.ts. Pure: no I/O.
import { HISTORICAL_CARD_NORMALIZATION, TREE_BUDGET_SHARE } from '../../constellation'
import { GATE_SHARD_REWARD, expToNextUmaLevel, raceExp, umaGateShardLedgerId } from '../../progression'
import { LEVELS_PER_SCENARIO } from '../../scenarios'
import { STATS, type RaceGrade } from '../../types'
import { perCardCap, treeCardNodesAt } from '../constellation/sizes'
import type { ScenarioOfTier, Tier } from '../types'
import { LAST_SCENARIO_NUMBER, SCENARIOS_PER_TIER, TIERS, firstLevel, gateLevel, scenarioRow } from './map'
import { HALL_OF_FAME_TIER, PROMOTION_UMA_TICKETS, promotionTicketLedgerId } from './promotion'
import { INITIAL_UMA_TICKETS, INITIAL_UMA_TICKETS_LEDGER_ID, TICKETS_PER_EXCHANGE, UMA_SHARDS_PER_TICKET } from './roster'
import { FULL_ACTIVE_EXTRA_NODES, capBudgetAt, capProfileAt, extraBudget, extraBudgetAt, extraNodeValues, nodeValue, spCapAt } from './scaling'

type Cell = string | number
/** A Markdown table; an empty cell renders as `| |`, as the hand-written pages have it. */
function table(head: readonly Cell[], rows: readonly (readonly Cell[])[]): string {
  const line = (cells: readonly Cell[]) => `|${cells.map((c) => (c === '' ? ' ' : ` ${String(c).replace(/\|/g, '\\|')} `)).join('|')}|`
  return [line(head), `|${head.map(() => '---').join('|')}|`, ...rows.map(line)].join('\n')
}
const num = (n: number): string => n.toLocaleString('en-US')
const cap = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1)
const numbers = (count: number): number[] => Array.from({ length: count }, (_, i) => i + 1)
const TIER_LIST = numbers(TIERS) as Tier[]
const SCENARIO_LIST = numbers(SCENARIOS_PER_TIER) as ScenarioOfTier[]
const ALL_T = numbers(LAST_SCENARIO_NUMBER)
/** A ledger id with a named placeholder where the builder takes a number. */
const placeholder = (name: string): number => name as unknown as number

// --- 04 §1 ----------------------------------------------------------------------------------------------------------

function tierMap(): string {
  return table(['Tier', '*s*', 'T', 'Scenario', 'JP release', 'Racing Levels', 'Cap budget', 'SP cap'], ALL_T.map((T) => {
    const row = scenarioRow(T)
    return [row.scenario === 1 ? `**${row.tier}**` : '', row.scenario, T, row.name, row.jpRelease ?? '—',
      `${firstLevel(row.scenario)}–${gateLevel(row.scenario)}`, num(capBudgetAt(T)), num(spCapAt(T))]
  }))
}

// --- 04 §6 ----------------------------------------------------------------------------------------------------------

function umaTickets(): string {
  const gates = SCENARIO_LIST.map(gateLevel)
  return table(['Source', 'Amount', 'Ledger id'], [
    ['A new account', `${INITIAL_UMA_TICKETS} Uma Tickets`, `\`${INITIAL_UMA_TICKETS_LEDGER_ID}\``],
    [`Each scenario gate an Uma reaches, once per Uma per gate per tier: Racing Lv ${gates.slice(0, -1).join(', ')} and ${gates.at(-1)}`,
      `${GATE_SHARD_REWARD} Uma Shard`, `\`${umaGateShardLedgerId('{umaId}', placeholder('{lifetime gate}'))}\``],
    ['Exchanging Uma Shards in the Stable', `${UMA_SHARDS_PER_TICKET} Uma Shards make ${TICKETS_PER_EXCHANGE} Uma Ticket`,
      '`uma-shard-exchange:{n}:shards` and `uma-shard-exchange:{n}:coupon`'],
    ['A promotion', `${PROMOTION_UMA_TICKETS} Uma Ticket`, `\`${promotionTicketLedgerId('{umaId}', placeholder('{tier}') as Tier)}\``],
    ['Entering the Hall of Fame', `${PROMOTION_UMA_TICKETS} Uma Ticket`, `\`${promotionTicketLedgerId('{umaId}', HALL_OF_FAME_TIER)}\``],
  ])
}

// --- 04 §7 ----------------------------------------------------------------------------------------------------------

function tierCaps(): string {
  return table(['T', 'Scenario', ...STATS.map(cap), 'Budget'], ALL_T.map((T) => {
    const caps = capProfileAt(T)
    return [T, scenarioRow(T).name, ...STATS.map((stat) => caps[stat]), capBudgetAt(T)]
  }))
}

function tierExtraValues(): string {
  return table(['Tier', 'Single', 'Duo', 'Sun', `Full active Extra Stats, scenarios ${SCENARIO_LIST.join(' · ')}`], TIER_LIST.map((tier) => {
    const values = extraNodeValues(tier)
    return [tier, `+${values.single}`, `+${values.duo} / +${values.duo}`, `+${values.sun} to all five`,
      SCENARIO_LIST.map((scenario) => extraBudget(tier, scenario)).join(' · ')]
  }))
}

function tierNodeValues(): string {
  return table(['T', 'Scenario', '*N*', 'Per-card cap', `Node, ${HISTORICAL_CARD_NORMALIZATION} term`, 'E', '**Node (decided)**',
    'Full build *N* × node + E', '60% of budget'], ALL_T.map((T) => {
    const N = treeCardNodesAt(T)
    const share = Math.round(TREE_BUDGET_SHARE * capBudgetAt(T))
    const old = Math.round((TREE_BUDGET_SHARE * capBudgetAt(T) - HISTORICAL_CARD_NORMALIZATION) / N)
    return [T, scenarioRow(T).name, N, perCardCap(N), old, extraBudgetAt(T), `**${nodeValue(T)}**`, num(N * nodeValue(T) + extraBudgetAt(T)), num(share)]
  }))
}

// --- 05 §6 ----------------------------------------------------------------------------------------------------------

function tierExtraBudget(): string {
  return table(['Scenario of the tier', ...SCENARIO_LIST], TIER_LIST.map((tier) =>
    [`Tier ${tier}`, ...SCENARIO_LIST.map((scenario) => extraBudget(tier, scenario))]))
}

// --- 03 §2 ----------------------------------------------------------------------------------------------------------

function racingCurve(): string {
  const steps = numbers(LEVELS_PER_SCENARIO - 1)
  const costs = steps.map(expToNextUmaLevel)
  return table(['Level into the scenario', ...steps, '**Total**'],
    [['EXP to the next', ...costs, `**${num(costs.reduce((sum, exp) => sum + exp, 0))}**`]])
}

const EXP_COLUMNS: readonly (readonly RaceGrade[])[] = [['debut', 'maiden'], ['pre-op', 'op'], ['g3'], ['g2'], ['g1']]
const GRADE_LABEL: Readonly<Record<RaceGrade, string>> = { debut: 'Debut', maiden: 'Maiden', 'pre-op': 'Pre-OP', op: 'OP', g3: 'G3', g2: 'G2', g1: 'G1' }

function racingExp(): string {
  /** One cell for grades that pay alike, and placements that pay alike; a difference would make the table wrong. */
  const cell = (grades: readonly RaceGrade[], placements: readonly number[]): number => {
    const values = new Set(grades.flatMap((grade) => placements.map((placement) => raceExp(grade, placement))))
    if (values.size !== 1) throw new Error(`EXP differs inside one cell: ${grades.join(', ')} at ${placements.join(', ')}`)
    return [...values][0]!
  }
  return table(['Finish', ...EXP_COLUMNS.map((grades) => grades.map((grade) => GRADE_LABEL[grade]).join(' / '))], [
    ['1st', ...EXP_COLUMNS.map((grades) => cell(grades, [1]))],
    ['2nd or 3rd', ...EXP_COLUMNS.map((grades) => cell(grades, [2, 3]))],
    ['4th or worse', ...EXP_COLUMNS.map((grades) => cell(grades, [4, 5, 18]))],
  ])
}

export const LIVE_BLOCKS: Readonly<Record<string, () => string>> = {
  'tier-map': tierMap,
  'tier-caps': tierCaps,
  'tier-extra-values': tierExtraValues,
  'tier-node-values': tierNodeValues,
  'tier-extra-budget': tierExtraBudget,
  'uma-tickets': umaTickets,
  'racing-curve': racingCurve,
  'racing-exp': racingExp,
}
