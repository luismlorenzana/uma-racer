// The tier rules' live blocks (docs/game/architecture.md "The live manual"): the tier map, the caps and each scenario's
// rival strength, rendered from the code so docs/game/04-tiers-and-scenarios.md can't drift. Registered in
// packages/domain/src/docs/render.ts. Pure: no I/O.
import { STATS } from '../types'
import { LAST_SCENARIO_NUMBER, scenarioRow } from './map'
import { rivalFieldStat, rivalTrainedStat } from './rivals'
import { capBudgetAt, capProfileAt, spCapAt } from './scaling'

type Cell = string | number
/** A Markdown table; an empty cell renders as `| |`, as the hand-written pages have it. */
function table(head: readonly Cell[], rows: readonly (readonly Cell[])[]): string {
  const line = (cells: readonly Cell[]) => `|${cells.map((c) => (c === '' ? ' ' : ` ${String(c).replace(/\|/g, '\\|')} `)).join('|')}|`
  return [line(head), `|${head.map(() => '---').join('|')}|`, ...rows.map(line)].join('\n')
}
const num = (n: number): string => n.toLocaleString('en-US')
const cap = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1)
const ALL_T = Array.from({ length: LAST_SCENARIO_NUMBER }, (_, i) => i + 1)

function tierMap(): string {
  return table(['Tier', '*s*', 'T', 'Scenario', 'JP release', 'Cap budget', 'SP cap'], ALL_T.map((T) => {
    const row = scenarioRow(T)
    return [row.scenario === 1 ? `**${row.tier}**` : '', row.scenario, T, row.name, row.jpRelease, num(capBudgetAt(T)), num(spCapAt(T))]
  }))
}

function tierCaps(): string {
  return table(['T', 'Scenario', ...STATS.map(cap), 'Budget'], ALL_T.map((T) => {
    const caps = capProfileAt(T)
    return [T, scenarioRow(T).name, ...STATS.map((stat) => caps[stat]), capBudgetAt(T)]
  }))
}

function tierRivals(): string {
  return table(['T', 'Scenario', 'Typical trained stat', 'Field stat (D191)', 'From'], ALL_T.map((T) => [
    T, scenarioRow(T).name, num(Math.round(rivalTrainedStat(T) * 10) / 10), num(Math.round(rivalFieldStat(T) * 10) / 10),
    T === 1 ? '`sim:careers` (D383)' : 'generation 2, frozen (D381)',
  ]))
}

export const LIVE_BLOCKS: Readonly<Record<string, () => string>> = {
  'tier-map': tierMap,
  'tier-caps': tierCaps,
  'tier-rivals': tierRivals,
}
