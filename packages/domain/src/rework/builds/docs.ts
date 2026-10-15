// The builds against the field's live blocks (docs/game/architecture.md#the-rework-modules "The live manual", T133): the stamina
// ladder, the G1 grid and the career rates on rework builds, and the buffs' typical values, in rework/03 §9, /04 §8 and
// /05 §12. They render the reports `pnpm sim:rework-builds` and `pnpm sim:rework-careers` commit with `--write-report`,
// since the domain can't run the race engine and CI needn't. Registered in packages/domain/src/docs/rework.ts. Pure.
import { CAREER_STAGES } from '../../career-stages'
import { SCENARIO_BUFFS } from '../../scenario-buffs'
import { CAREER_STAGE_GRADES } from '../../scenario-goals'
import { DISTANCE_CATEGORIES, type DistanceCategory } from '../../types'
import { scenarioRow } from '../tiers/map'
import { REWORK_BUFF_TYPICAL } from '../tiers/rivals'
import { reworkBuff } from '../training/buffs'
import { BUILDS_REPORT } from './builds-report'
import { CAREERS_REPORT } from './careers-report'
import { CAREER_TARGETS, isAcceptedLadderMiss, meetsCareerTarget } from './targets'

type Cell = string | number
/** A Markdown table; an empty cell renders as `| |`, as the hand-written pages have it. */
function table(head: readonly Cell[], rows: readonly (readonly Cell[])[]): string {
  const line = (cells: readonly Cell[]) => `|${cells.map((c) => (c === '' ? ' ' : ` ${String(c).replace(/\|/g, '\\|')} `)).join('|')}|`
  return [line(head), `|${head.map(() => '---').join('|')}|`, ...rows.map(line)].join('\n')
}
const num = (n: number): string => n.toLocaleString('en-US')
const capital = (word: string): string => word.charAt(0).toUpperCase() + word.slice(1)
const pct = (share: number): string => `${(100 * share).toFixed(1)}%`
const name = (T: number): string => scenarioRow(T).name
/** The G1 grid's distances, today's (constellation-balance.ts). */
const G1_METERS: Readonly<Record<DistanceCategory, number>> = { sprint: 1400, mile: 1600, medium: 2400, long: 3000 }

// --- 05 §12: the stamina ladder -------------------------------------------------------------------------------------

function ladder(): string {
  return table(['T', 'Scenario', 'Stamina, rung by rung', 'Hard checks', 'Soft checks that miss'],
    BUILDS_REPORT.ladder.map((row) => {
      const hard = row.misses.filter((miss) => miss.hard)
      const soft = row.misses.filter((miss) => !miss.hard)
      const hardWords = hard.length === 0 ? 'hold'
        : hard.map((miss) => `**${isAcceptedLadderMiss(row.T, miss.name) ? 'Accepted (D350)' : 'Fail'}:** ${miss.name}`).join('; ')
      return [row.T, name(row.T), row.stamina.map(num).join(' · '), hardWords, soft.length === 0 ? '—' : soft.map((miss) => miss.name).join('; ')]
    }))
}

// --- 03 §9: the G1 grid and the career rates ----------------------------------------------------------------------------

function g1Rates(): string {
  return table(['T', 'Scenario', ...DISTANCE_CATEGORIES.map((category) => `${capital(category)} ${num(G1_METERS[category])} m`)],
    BUILDS_REPORT.g1.map((row) => [row.T, name(row.T),
      ...DISTANCE_CATEGORIES.map((category) => `${row.cells[category].pace}% / ${row.cells[category].rate}%`)]))
}

function careerRates(): string {
  const head = CAREER_STAGES.map((stage) => `${capital(stage)} ${CAREER_STAGE_GRADES[stage].toUpperCase()} (${CAREER_TARGETS[stage].words})`)
  return table(['T', 'Scenario', ...head, 'Targets'], CAREERS_REPORT.rates.map((row) => {
    let below = 0
    const stages = CAREER_STAGES.map((stage) => DISTANCE_CATEGORIES.map((category) => {
      const { rate } = row.stages[stage][category]
      if (meetsCareerTarget(stage, rate)) return String(rate)
      below += 1
      return `**${rate}**`
    }).join(' · '))
    return [row.T, name(row.T), ...stages, below === 0 ? 'met' : `**${below} below**`]
  }))
}

// --- 04 §8: the buffs' typical values -------------------------------------------------------------------------------

function buffTypical(): string {
  return table(['T', 'Scenario', 'Buff', 'Today', "Measured on the rework's typical build", 'Rivals carry'],
    BUILDS_REPORT.typical.map((row) => {
      const today = SCENARIO_BUFFS[row.T - 1]!.typical
      const carried = REWORK_BUFF_TYPICAL[row.T - 1]!
      return [row.T, name(row.T), reworkBuff(row.T).name, pct(today), pct(row.measured), carried === today ? pct(carried) : `**${pct(carried)}**`]
    }))
}

export const LIVE_BLOCKS: Readonly<Record<string, () => string>> = {
  'rework-ladder': ladder,
  'rework-g1-rates': g1Rates,
  'rework-career-rates': careerRates,
  'rework-buff-typical': buffTypical,
}
