// The loop simulation's report (T132's "Report"): the runs the live blocks and the checks read,
// once per process, and the plain-text report `pnpm sim:loop` prints. Pure: it returns text.
import { BUILDINGS } from '../farm/buildings'
import { FAMILIES, FAMILY_IDS } from '../items/families'
import { evaluateChecks, type CheckResult } from './checks'
import { daysSince, loopRng } from './clock'
import { BASELINE, LOOP_VARIANTS, simulateLoop, type LoopResult } from './loop'
import { IDLE_REASONS } from './metrics'
import { farmLevelProbes, firstUnlockProbe, type FarmLevelProbe, type FirstUnlockProbe } from './probes'

export interface LoopReport {
  /** Three tiers at the baseline (12 §12). */
  readonly baseline: LoopResult
  /** Tier 1 with heavy evenings, and with one and two check-ins a day (12 §11's utilisation rows). */
  readonly heavy: LoopResult
  readonly oneCheckIn: LoopResult
  readonly twoCheckIns: LoopResult
  readonly farmLevels: readonly FarmLevelProbe[]
  readonly firstUnlock: FirstUnlockProbe
  readonly checks: readonly CheckResult[]
}

let memo: LoopReport | null = null
/** Every run the live blocks and checks read, once per process (T132 "Live blocks": one run per test worker). */
export function loopReport(): LoopReport {
  if (memo) return memo
  const run = (config = BASELINE) => simulateLoop(config, loopRng(config.seed))
  const baseline = run()
  const heavy = run(LOOP_VARIANTS.heavy)
  const farmLevels = farmLevelProbes()
  const firstUnlock = firstUnlockProbe()
  memo = {
    baseline, heavy, oneCheckIn: run(LOOP_VARIANTS['one-check-in']), twoCheckIns: run(LOOP_VARIANTS['two-check-ins']), farmLevels, firstUnlock,
    checks: evaluateChecks({ baseline, heavy, farmLevels, firstUnlock }),
  }
  return memo
}

// ---- Text ----------------------------------------------------------------------------------------------------------

const fixed = (n: number | null, digits = 1) => (n === null ? '–' : n.toFixed(digits))
const pct = (n: number | null) => (n === null ? '–' : `${Math.round(n * 100)}%`)
const pad = (s: string, n: number) => s.padEnd(n)
const dayAt = (at: number) => daysSince(at).toFixed(1)

export function formatReport(result: LoopResult): string {
  const { metrics: m, logs, config } = result
  const lines: string[] = []
  lines.push(`Loop simulation: seed ${config.seed}, check-ins ${config.checkIns.map((t) => `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`).join(' ')}, racing ${config.racing}, roster ${config.roster.kind === 'grow' ? `grows to ${config.roster.cap ?? 'no cap'}` : `fixed at ${config.roster.size}`}, buildings ${config.buildings}; ${fixed(m.days)} days, ${logs.races} races, ${logs.unlocks} unlocks`)
  lines.push('', 'Days per scenario, founding cohort (median, p10–p90; layer done in brackets)')
  for (const row of m.scenarios) {
    lines.push(`  T${row.tier}·${row.scenario}  ${fixed(row.days.median).padStart(5)}  (${fixed(row.days.p10)}–${fixed(row.days.p90)})  [layer ${fixed(row.layerDays.median)}]  n=${row.days.n}`)
  }
  for (const row of m.tiers) lines.push(`  Tier ${row.tier}: ${fixed(row.weeks, 2)} weeks to the cohort's median promotion (p10–p90 ${fixed(row.finished.p10)}–${fixed(row.finished.p90)}), all Lv 3 at entry: ${row.allLv3AtEntry ? 'yes' : 'no'}`)
  lines.push('', 'Slot use per scenario window, held (start to Collect); peak; bottleneck hours; tier 1 hours a day held / running')
  lines.push(`  ${pad('', 18)} ${m.scenarios.map((row) => `T${row.tier}·${row.scenario}`.padStart(5)).join(' ')}`)
  for (const slot of m.slots) {
    lines.push(`  ${pad(BUILDINGS[slot.building].name, 18)} ${slot.held.map((v) => pct(v).padStart(5)).join(' ')}   peak ${pct(slot.peakHeld)} (${slot.peakScenario})  ${fixed(slot.bottleneckHours, 0)} h  ${fixed(slot.hoursHeldTier1)} / ${fixed(slot.hoursRunningTier1)}`)
  }
  lines.push('', `Idle Uma-hours over tier 1: ${IDLE_REASONS.map((reason) => `${reason} ${fixed(m.idle[reason], 0)}`).join(', ')}; utilisation ${pct(m.utilisation)}`)
  lines.push('', 'Warehouse at each week, raw / crafted / dishes held (all grades)')
  for (const week of logs.stock.filter((_, i) => i % 4 === 0)) {
    const sum = (rows: Record<string, number[]>) => Object.values(rows).reduce((s, row) => s + row.reduce((a, b) => a + b, 0), 0)
    const fam = FAMILY_IDS.map((family) => `${FAMILIES[family].name.split(' ')[0]} ${week.crafted[family]!.reduce((a, b) => a + b, 0)}`).join(', ')
    lines.push(`  week ${String(week.week).padStart(2)}: ${sum(week.raw)} / ${sum(week.crafted)} / ${week.dishes.reduce((a, b) => a + b, 0)}  (crafted: ${fam})`)
  }
  const { gross, paid } = logs.prize
  lines.push('', `Prize Money in by purse band, gross → paid: full ${gross.full} → ${paid.full}, tired ${gross.tired} → ${paid.tired}, spent ${gross.spent} → ${paid.spent}`)
  lines.push(`Prize Money out: upgrades ${logs.spent.upgrades}, Speed Tickets ${logs.spent.tickets} (${logs.ticketsBought} tickets, ${fixed(logs.ticketMinutes, 0)} minutes saved); balance ${result.state.profile.prizeMoney}`)
  lines.push(`Tier 1: ${fixed(m.racesPerDay)} races a day, ${fixed(m.prizePerDay, 0)} Prize Money a day, ${fixed(m.workHoursPerDay, 0)} Uma-hours of work a day; racing saves ${pct(m.racingShare)} (${(100 * m.racingShare).toFixed(2)}%)`)
  const roster = logs.roster.filter((entry, i, all) => i === 0 || entry.umas !== all[i - 1]!.umas)
  lines.push('', `Roster: ${roster.map((entry) => `${entry.umas} on day ${dayAt(entry.at)}`).join(', ')}; ${result.state.profile.umaTickets} tickets and ${result.state.profile.umaShards} Shards held at the end`)
  lines.push(`Upgrades: ${logs.upgrades.map((step) => `${BUILDINGS[step.building].name} Lv ${step.level} day ${dayAt(step.at)}`).join(', ') || 'none'}`)
  if (logs.raceGuardHits > 0) lines.push(`Race guard hit ${logs.raceGuardHits} times`)
  return lines.join('\n')
}

export function formatChecks(checks: readonly CheckResult[]): string {
  return ['12 §12 checks', ...checks.map(({ check, values, pass }) => {
    const range = `${check.min ?? ''}${check.min !== null && check.max !== null ? '–' : check.max !== null ? '≤ ' : '≥ '}${check.max ?? ''}`
    const shown = values.map((v) => (v === null ? 'never' : check.unit === 'share' ? `${(100 * v).toFixed(1)}%` : v.toFixed(2))).join(', ')
    const result = pass ? 'pass' : check.knownMiss ? 'miss' : 'FAIL'
    return `  ${result.padEnd(4)}  ${check.label} (${range} ${check.unit}): ${shown}${check.also ? ` · ${check.also.label}` : ''}${!pass && check.knownMiss ? `\n        known miss (D348): ${check.knownMiss}` : ''}`
  })].join('\n')
}

export interface MatrixRow {
  readonly variant: string
  readonly tier1Weeks: number | null
  readonly scenarioDays: readonly (number | null)[]
  readonly peak: number
  readonly utilisation: number
  readonly racingShare: number
  readonly racesPerDay: number
  readonly idleHours: number
}

export function matrixRow(variant: string, result: LoopResult): MatrixRow {
  const m = result.metrics
  return {
    variant,
    tier1Weeks: m.tiers[0]?.weeks ?? null,
    scenarioDays: m.scenarios.filter((row) => row.tier === 1).map((row) => row.days.median),
    peak: Math.max(...m.slots.map((slot) => slot.peakHeld)),
    utilisation: m.utilisation,
    racingShare: m.racingShare,
    racesPerDay: m.racesPerDay,
    idleHours: IDLE_REASONS.reduce((sum, reason) => sum + m.idle[reason], 0),
  }
}

export function formatMatrix(rows: readonly MatrixRow[]): string {
  return ['Variant            Tier 1 wk   Scenario days (median)          Peak slot  Utilisation  Racing  Races/day',
    ...rows.map((row) => `${pad(row.variant, 18)} ${fixed(row.tier1Weeks, 2).padStart(8)}   ${row.scenarioDays.map((d) => fixed(d).padStart(5)).join(' ')}   ${pct(row.peak).padStart(8)}  ${pct(row.utilisation).padStart(10)}  ${pct(row.racingShare).padStart(6)}  ${fixed(row.racesPerDay).padStart(8)}`)].join('\n')
}

