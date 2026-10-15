// The rework's builds against the field (T133): the stamina ladder and the G1 win rates on rework builds, and each
// scenario buff's typical value on the rework's typical build (docs/rework/03-uma-progression.md §8–§9,
// docs/rework/04-tiers-and-promotion.md §7–§8, docs/rework/05-training-hub.md §6 and §12, D152, D349). Beside
// `pnpm sim:constellation`, which keeps checking today's game. Every id and number is synthetic; this script never reads
// private or original-game content.
//
//   pnpm sim:rework-builds                    stamina ladder at every T = 1–14 + G1 win rates + the buffs' typical values
//   pnpm sim:rework-builds -- 400             races per win-rate cell (default 200)
//   pnpm sim:rework-builds -- --ladder-only
//   pnpm sim:rework-builds -- --rates-only
//   pnpm sim:rework-builds -- --tiers=1,5,9   the game's scenarios T to race (default 1–14)
//   pnpm sim:rework-builds -- --write-report  also rewrite packages/domain/src/builds/builds-report.ts, which the
//                                             rework pages' live blocks render (every T, ladder and rates)
//
// A build is a full layer at scenario T (T128's `deriveBuild`): every card node of the re-authored tree open, current-era
// cards at 100%, the Inspiration slots her layers open filled, and Extra Stats at the scenario's capacity leaning on the
// rung's stat. Fields are T125's `rollRivalFieldAt`. Exit code 1 when a hard ladder check fails, other than the misses
// accepted by design (`LADDER_ACCEPTED_MISSES`, D350, reported as ACCEPTED): a regression gate.
import { writeFileSync } from 'node:fs'
import type { DistanceCategory, Stats, Strategy } from '../../packages/domain/src/index'
import { LADDER_ACCEPTED_MISSES, isAcceptedLadderMiss } from '../../packages/domain/src/builds/targets'
import type { G1Row, LadderRow } from '../../packages/domain/src/builds/types'
import { SPURT_BUFFER_METERS, simulateRace } from '../../packages/race/src/index'
import {
  FIELD_STRATEGIES,
  LONG,
  PLAYER_KIT,
  SPRINT_GUTS,
  STAYER,
  STAYER_POWER,
  goldRecovery,
  reworkFairShare,
  reworkStats,
  reworkTypicalRows,
  rivalRunnersAt,
  typicalCourse,
  typicalLines,
} from './harness'

const args = process.argv.slice(2)
const RACES = Number(args.find((value) => /^\d+$/.test(value)) ?? 200)
const LADDER_ONLY = args.includes('--ladder-only')
const RATES_ONLY = args.includes('--rates-only')
const WRITE_REPORT = args.includes('--write-report')
const tiersArg = args.find((value) => value.startsWith('--tiers='))?.split('=')[1]
const TIERS = tiersArg ? tiersArg.split(',').map(Number) : Array.from({ length: 14 }, (_, index) => index + 1)
const LADDER_RACES = 30
/** Run from the repo root, as `pnpm sim:…` does. */
const REPORT = 'packages/domain/src/builds/builds-report.ts'
if (WRITE_REPORT && (tiersArg || LADDER_ONLY || RATES_ONLY || process.env.V8 || process.env.BASE_STAMINA || process.env.BASE_GUTS)) {
  console.error('--write-report runs every T, both parts, on the default engine and base stats')
  process.exit(2)
}

// Each rung adds a stamina source, as today's ladder (D152): a stamina card, then Extra Stats on Stamina, then a lean and a
// Power card, then a second stamina card. The rework's Extra Stats are the scenario's capacity, not today's six.
const configs = (T: number) => ({
  'no stamina card': reworkStats(T, SPRINT_GUTS, 2, reworkFairShare(T), 'stamina'),
  'sprint (1 stamina card)': reworkStats(T, STAYER, 2, reworkFairShare(T), 'speed'),
  'mile (stamina card, Extra Stats → stamina)': reworkStats(T, STAYER, 2, reworkFairShare(T), 'stamina'),
  'medium (stamina card +1)': reworkStats(T, STAYER, 2, reworkFairShare(T) + 1, 'stamina'),
  'medium (stamina card +1, power card)': reworkStats(T, STAYER_POWER, 2, reworkFairShare(T) + 1, 'stamina', { first: [3] }),
  'long (2 stamina cards)': reworkStats(T, LONG, 2, reworkFairShare(T) + 1, 'stamina', { first: [3] }),
})

// --- Stamina ladder --------------------------------------------------------------------------------

/** Today's test (constellation-balance.ts): a full spurt in 90% of 12-runner G1 fields, HP to within 60 m of the line. */
function fullSpurt(T: number, stats: Stats, distance: number, strategy: Strategy, golds = 0): boolean {
  let good = 0
  for (let race = 0; race < LADDER_RACES; race += 1) {
    const gate = race % 12
    const seed = 31_337 + T * 101 + race * 7919
    const player = { id: 'P', label: String(gate + 1), stats, strategy, gate, aptitude: { distance: 'A', surface: 'A', strategy: 'A' } as const,
      skills: [goldRecovery('gold-a', 60), goldRecovery('gold-b', 40)].slice(0, golds) }
    const timeline = simulateRace({
      course: typicalCourse(distance),
      seed,
      runners: [...rivalRunnersAt(T, 'g1', distance, 12, gate, seed), player].sort((left, right) => left.gate - right.gate),
    })
    const me = timeline.results.find((result) => result.id === 'P')!
    const dry = timeline.events.find((event) => event.type === 'hp-empty' && event.runner === gate)
    const dryAt = dry ? timeline.distance[dry.tick * timeline.runnerCount + gate]! : Number.POSITIVE_INFINITY
    if (me.spurtMaxed && dryAt >= distance - SPURT_BUFFER_METERS) good += 1
  }
  return good >= LADDER_RACES * 0.9
}

interface Check { name: string; stats: keyof ReturnType<typeof configs>; distance: number; golds?: number; expect: boolean; hard: boolean }
/** Today's ladder checks (D152), on the rework's builds. */
const CHECKS: Check[] = [
  { name: 'one stamina card runs 1,400 m', stats: 'sprint (1 stamina card)', distance: 1400, expect: true, hard: true },
  { name: 'Extra Stats into stamina run 1,800 m', stats: 'mile (stamina card, Extra Stats → stamina)', distance: 1800, expect: true, hard: true },
  { name: 'a Power card runs 2,200 m', stats: 'medium (stamina card +1, power card)', distance: 2200, expect: true, hard: true },
  { name: 'a Power card runs 2,400 m', stats: 'medium (stamina card +1, power card)', distance: 2400, expect: true, hard: true },
  { name: 'a lean alone runs 2,200 m', stats: 'medium (stamina card +1)', distance: 2200, expect: true, hard: false },
  { name: 'two stamina cards run 2,500 m', stats: 'long (2 stamina cards)', distance: 2500, expect: true, hard: true },
  { name: 'two stamina cards run 3,000 m with one gold recovery', stats: 'long (2 stamina cards)', distance: 3000, golds: 1, expect: true, hard: true },
  { name: 'two stamina cards run 3,200 m with two gold recoveries', stats: 'long (2 stamina cards)', distance: 3200, golds: 2, expect: true, hard: true },
  { name: 'no stamina card cannot run 1,400 m', stats: 'no stamina card', distance: 1400, expect: false, hard: false },
  { name: 'a sprint set cannot run 1,800 m', stats: 'sprint (1 stamina card)', distance: 1800, expect: false, hard: false },
  { name: 'a lean alone cannot run 2,400 m', stats: 'medium (stamina card +1)', distance: 2400, expect: false, hard: false },
  { name: 'a Power card cannot run 3,000 m', stats: 'medium (stamina card +1, power card)', distance: 3000, golds: 1, expect: false, hard: false },
]

let hardFailures = 0
const nowHolding: string[] = []
const ladder: LadderRow[] = []
if (!RATES_ONLY) console.log('Stamina ladder on rework builds — in 12-runner G1 fields (T125), pace and late, full layer, every card current-era at 100%, Extra Stats at capacity, median base stats, zero growth')
for (const T of RATES_ONLY ? [] : TIERS) {
  const built = configs(T)
  const misses: LadderRow['misses'][number][] = []
  for (const check of CHECKS) {
    const ok = (['pace', 'late'] as Strategy[]).every((strategy) =>
      fullSpurt(T, built[check.stats], check.distance, strategy, check.golds ?? 0) === check.expect)
    if (!ok) {
      misses.push({ name: check.name, hard: check.hard })
      if (check.hard && !isAcceptedLadderMiss(T, check.name)) hardFailures += 1
    } else if (isAcceptedLadderMiss(T, check.name)) {
      nowHolding.push(`T${T}: ${check.name}`)
    }
  }
  const stamina = Object.values(built).map((stats) => Math.round(stats.stamina))
  ladder.push({ T, stamina, misses })
  const words = misses.map((miss) => `${miss.hard ? (isAcceptedLadderMiss(T, miss.name) ? 'ACCEPTED' : 'FAIL') : 'soft'}: ${miss.name}`)
  console.log(`T${String(T).padStart(2)}  stamina ${stamina.join(' / ')}  ${words.length === 0 ? 'ok' : words.join('; ')}`)
}

if (!RATES_ONLY && LADDER_ACCEPTED_MISSES.length > 0) {
  console.log(`ACCEPTED marks a hard miss the design accepts at a tier's first scenario (D350): reported, not failed`)
}
if (nowHolding.length > 0) console.log(`Now holding, so drop from LADDER_ACCEPTED_MISSES: ${nowHolding.join('; ')}`)

// --- G1 win rates -------------------------------------------------------------------------------------

const g1: G1Row[] = []
if (!LADDER_ONLY) {
  // Each cell races the build the ladder says is right for that distance, with the heals it calls for (today's grid).
  const CATEGORY: Record<DistanceCategory, { distance: number; config: keyof ReturnType<typeof configs>; golds: number }> = {
    sprint: { distance: 1400, config: 'sprint (1 stamina card)', golds: 0 },
    mile: { distance: 1600, config: 'mile (stamina card, Extra Stats → stamina)', golds: 0 },
    medium: { distance: 2400, config: 'medium (stamina card +1, power card)', golds: 0 },
    long: { distance: 3000, config: 'long (2 stamina cards)', golds: 1 },
  }
  const winRate = (T: number, category: DistanceCategory, strategy: Strategy): number => {
    const { distance, config, golds } = CATEGORY[category]
    const stats = configs(T)[config]
    const kit = [...PLAYER_KIT, ...[goldRecovery('gold-a', 60), goldRecovery('gold-b', 40)].slice(0, golds)]
    let wins = 0
    for (let race = 0; race < RACES; race += 1) {
      const playerGate = race % 12
      const seed = 1_000_003 * T + race * 7919
      const player = { id: 'player', label: String(playerGate + 1), stats, strategy, gate: playerGate, aptitude: { distance: 'A', surface: 'A', strategy: 'A' } as const, skills: kit }
      const timeline = simulateRace({
        course: typicalCourse(distance),
        seed,
        runners: [...rivalRunnersAt(T, 'g1', distance, 12, playerGate, seed), player].sort((left, right) => left.gate - right.gate),
      })
      if (timeline.results[0]!.id === 'player') wins += 1
    }
    return Math.round((100 * wins) / RACES)
  }
  console.log(`\nG1 win rate on rework builds, full layer (T125's fields, the G1 handicap), ${RACES} races per cell, 12 runners — pace / best strategy`)
  for (const T of TIERS) {
    const cells = {} as Record<DistanceCategory, G1Row['cells'][DistanceCategory]>
    for (const category of Object.keys(CATEGORY) as DistanceCategory[]) {
      const rates = FIELD_STRATEGIES.map((strategy) => winRate(T, category, strategy))
      const best = Math.max(...rates)
      cells[category] = { pace: rates[1]!, rate: best, build: CATEGORY[category].config, strategy: FIELD_STRATEGIES[rates.indexOf(best)]! }
    }
    g1.push({ T, cells })
    const words = (Object.keys(cells) as DistanceCategory[]).map((category) =>
      `${category} ${String(cells[category].pace).padStart(3)}% / ${String(cells[category].rate).padStart(3)}%`)
    console.log(`T${String(T).padStart(2)}  ${words.join('  ')}`)
  }
}

// --- The buffs' typical values (04 §8) --------------------------------------------------------------------

const typical = reworkTypicalRows(TIERS)
console.log(`\n${typicalLines(typical).join('\n')}`)

if (WRITE_REPORT) {
  const rows = <T>(list: readonly T[]) => `[\n${list.map((row) => `    ${JSON.stringify(row)},`).join('\n')}\n  ]`
  writeFileSync(REPORT, [
    '// Generated by `pnpm sim:rework-builds -- --write-report` (scripts/sim/rework-builds.ts, T133). Do not edit: re-run it.',
    `// The stamina ladder (${LADDER_RACES} races a check) and the G1 win rates (${RACES} races a cell) on rework builds against`,
    "// T125's fields, and each buff's measured typical value. The rework pages render it (./docs.ts), so CI needs no engine.",
    "import type { BuildsReport } from './types'",
    '',
    'export const BUILDS_REPORT: BuildsReport = {',
    `  racesPerCell: ${RACES},`,
    `  ladderRaces: ${LADDER_RACES},`,
    `  rungs: ${JSON.stringify(Object.keys(configs(1)))},`,
    `  ladder: ${rows(ladder)},`,
    `  g1: ${rows(g1)},`,
    `  typical: ${rows(typical)},`,
    '}',
    '',
  ].join('\n'))
  console.log(`\nWrote ${REPORT}`)
}

if (hardFailures > 0) {
  console.error(`\n${hardFailures} hard ladder check(s) failed`)
  process.exit(1)
}
