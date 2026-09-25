// Synthetic race-engine balance harness (docs/design/racing.md#presentation-straight-line-real-time-view).
// No imported ids, source rows, or original-game data belong in this file.
//
//   pnpm sim:balance                 quick 2,400-race strategy regression
//   pnpm sim:balance -- 1000         custom quick seeds per row
//   pnpm sim:balance -- --final      Milestone 3 multi-dimensional closure matrix
import {
  averageCap,
  distanceCategory,
  rivalPreset,
  parseRaceCondition,
  STRATEGIES,
  type CompiledRaceSkill,
  type RaceGrade,
  type RaceSkillEffectKind,
  type Stats,
  type Strategy,
} from '../../packages/domain/src/index'
import { simulateRace, type RaceTimeline } from '../../packages/race/src/index'

const args = process.argv.slice(2)
const finalMode = args.includes('--final')
const targetOnly = args.includes('--target-only')
const racesArgument = args.find((value) => /^\d+$/.test(value))
const RACES_PER_ROW = Number(racesArgument ?? (finalMode ? 40 : 200))
if (!Number.isSafeInteger(RACES_PER_ROW) || RACES_PER_ROW < 1) throw new Error('Race count must be a positive integer')

const makeSkill = (
  id: string,
  condition: string,
  kind: RaceSkillEffectKind,
  amount: number,
  duration: number,
  activation: 'guaranteed' | 'wit' = 'wit',
): CompiledRaceSkill => ({
  id,
  activation,
  inherited: false,
  groups: [{
    precondition: null,
    condition: parseRaceCondition(condition)!,
    duration,
    cooldown: 0,
    effects: [{ kind, amount }],
    unsupportedVariables: [],
    unsupportedEffects: [],
  }],
})

const recovery = makeSkill('synthetic-recovery', 'hp_per<=70', 'recovery', 0.055, 0, 'guaranteed')
const baselineKit: readonly CompiledRaceSkill[] = [
  recovery,
  makeSkill('synthetic-middle-speed', 'phase_random==1', 'target-speed', 0.15, 3),
  makeSkill('synthetic-late-speed', 'phase_random==2', 'target-speed', 0.15, 3),
  makeSkill('synthetic-acceleration', 'phase_random==2', 'acceleration', 0.2, 3),
]
const goodKit: readonly CompiledRaceSkill[] = [
  ...baselineKit,
  makeSkill('synthetic-unique', 'phase_laterhalf_random==2', 'current-speed-natural', 0.25, 3, 'guaranteed'),
]
/** Representative trained loadout: the NPC kit/unique plus four supported card-learned skills. */
const playerGoodKit: readonly CompiledRaceSkill[] = [
  ...goodKit,
  makeSkill('synthetic-card-middle', 'phase_laterhalf_random==1', 'target-speed', 0.35, 3),
  makeSkill('synthetic-card-current', 'phase_random==2', 'current-speed', 0.25, 3),
  makeSkill('synthetic-card-late', 'phase_laterhalf_random==2', 'target-speed', 0.35, 3),
  makeSkill('synthetic-card-acceleration', 'is_lastspurt==1', 'acceleration', 0.3, 3),
]
const targetKit = args.includes('--base-loadout') ? goodKit : playerGoodKit
const skillVariants = { none: [] as readonly CompiledRaceSkill[], recovery: [recovery], baseline: goodKit }
type SkillVariant = keyof typeof skillVariants
type PlayerBuild = 'under' | 'field' | 'full'

interface Metrics {
  races: number
  runners: number
  wins: Record<Strategy, number>
  playerWins: number
  playerRaces: number
  hpEmpty: number
  maxed: number
  skills: number
  modeSeconds: number
  blockedSeconds: number
  overtakeAttempts: number
  overtakeSuccesses: number
  finishSeconds: number
  runnerSeconds: number
  runtimeMs: number
}

const metrics = (): Metrics => ({
  races: 0,
  runners: 0,
  wins: { front: 0, pace: 0, late: 0, end: 0 },
  playerWins: 0,
  playerRaces: 0,
  hpEmpty: 0,
  maxed: 0,
  skills: 0,
  modeSeconds: 0,
  blockedSeconds: 0,
  overtakeAttempts: 0,
  overtakeSuccesses: 0,
  finishSeconds: 0,
  runnerSeconds: 0,
  runtimeMs: 0,
})

function collect(target: Metrics, timeline: RaceTimeline, runners: readonly { strategy: Strategy }[], runtimeMs: number, playerIndex?: number) {
  target.races += 1
  target.runners += runners.length
  target.runtimeMs += runtimeMs
  target.wins[runners[timeline.results[0]!.runner]!.strategy] += 1
  target.hpEmpty += timeline.events.filter((event) => event.type === 'hp-empty').length
  target.skills += timeline.events.filter((event) => event.type === 'skill-activated').length
  target.maxed += timeline.results.filter((result) => result.spurtMaxed).length
  target.finishSeconds += timeline.results.reduce((sum, result) => sum + result.finishTime, 0)
  for (const result of timeline.results) {
    target.runnerSeconds += result.finishTime
    if (!result.pack) continue
    target.modeSeconds += Object.entries(result.pack.modeSeconds)
      .filter(([mode]) => mode !== 'normal')
      .reduce((sum, [, seconds]) => sum + seconds, 0)
    target.blockedSeconds += result.pack.blockedSeconds
    target.overtakeAttempts += result.pack.overtakeAttempts
    target.overtakeSuccesses += result.pack.overtakeSuccesses
  }
  if (playerIndex !== undefined) {
    target.playerRaces += 1
    if (timeline.results[0]!.runner === playerIndex) target.playerWins += 1
  }
}

function simulateMeasured(input: Parameters<typeof simulateRace>[0]): { timeline: RaceTimeline; runtimeMs: number } {
  const started = performance.now()
  const timeline = simulateRace(input)
  return { timeline, runtimeMs: performance.now() - started }
}

const percent = (numerator: number, denominator: number) => denominator ? 100 * numerator / denominator : 0
const allStats = (value: number): Stats => ({ speed: value, stamina: value, power: value, guts: value, wit: value })

function printMetrics(label: string, value: Metrics) {
  const wins = STRATEGIES.map((strategy) => `${strategy[0]!.toUpperCase()} ${percent(value.wins[strategy], value.races).toFixed(1)}%`).join(' · ')
  console.log(`${label}: ${value.races.toLocaleString()} races · ${wins}`)
  console.log(`  HP empty ${percent(value.hpEmpty, value.runners).toFixed(1)}% · max spurt ${percent(value.maxed, value.runners).toFixed(1)}% · activations ${(value.skills / value.runners).toFixed(2)}/runner`)
  console.log(`  non-normal ${percent(value.modeSeconds, value.runnerSeconds).toFixed(1)}% · blocked ${(value.blockedSeconds / value.runners).toFixed(1)}s/runner · overtake ${percent(value.overtakeSuccesses, value.overtakeAttempts).toFixed(1)}% (${value.overtakeSuccesses}/${value.overtakeAttempts})`)
  console.log(`  finish ${(value.finishSeconds / value.runners).toFixed(1)}s · engine ${(value.runtimeMs / value.races).toFixed(2)}ms/race (${(value.runtimeMs / 1_000).toFixed(1)}s measured)`)
}

// Each style on its own rival preset (D153), unrolled, so strategy shares compare the styles rather than luck.
function mixedRunners(tier: number, grade: RaceGrade, distance: number, field: number, skills: readonly CompiledRaceSkill[]) {
  return Array.from({ length: field }, (_, gate) => ({
    id: `synthetic-${gate}`,
    label: `${gate + 1}`,
    stats: rivalPreset(tier, grade, distanceCategory(distance), STRATEGIES[gate % STRATEGIES.length]!),
    strategy: STRATEGIES[gate % STRATEGIES.length]!,
    aptitude: { distance: 'A', surface: 'A', strategy: 'A' } as const,
    gate,
    skills,
  }))
}

function runQuick() {
  const rows: [tier: number, distance: number][] = [[1, 1200], [1, 1600], [1, 2400], [1, 3200], [6, 2400], [11, 3200]]
  const overall = metrics()
  let worstRow = 0
  let rowsWithAllStrategies = 0
  console.log(`Quick R3 regression · ${RACES_PER_ROW} seeds/row · 12 runners · G1 · recovery kit`)
  console.log('tier dist grade  wins Front/Pace/Late/End  hp-empty max-spurt blocked pass finish runtime')
  rows.forEach(([tier, distance]) => (['g3', 'g1'] as RaceGrade[]).forEach((grade) => {
    const row = metrics()
    const runners = mixedRunners(tier, grade, distance, 12, [recovery])
    for (let seed = 1; seed <= RACES_PER_ROW; seed += 1) {
      const result = simulateMeasured({ course: { distance, surface: 'turf' }, seed, runners })
      collect(row, result.timeline, runners, result.runtimeMs)
      collect(overall, result.timeline, runners, result.runtimeMs)
    }
    const rowShares = STRATEGIES.map((strategy) => percent(row.wins[strategy], row.races))
    worstRow = Math.max(worstRow, ...rowShares)
    if (rowShares.every((share) => share > 0)) rowsWithAllStrategies += 1
    console.log(`${String(tier).padStart(4)} ${String(distance).padStart(4)} ${grade.toUpperCase().padStart(5)}  ${STRATEGIES.map((strategy) => String(row.wins[strategy]).padStart(4)).join('/')}  ${percent(row.hpEmpty, row.runners).toFixed(1).padStart(7)}% ${percent(row.maxed, row.runners).toFixed(1).padStart(8)}% ${(row.blockedSeconds / row.runners).toFixed(1).padStart(6)}s ${percent(row.overtakeSuccesses, row.overtakeAttempts).toFixed(0).padStart(4)}% ${(row.finishSeconds / row.runners).toFixed(1).padStart(6)}s ${(row.runtimeMs / row.races).toFixed(2).padStart(6)}ms`)
  }))
  printMetrics('Aggregate', overall)
  console.log(`  worst strategy row ${worstRow.toFixed(1)}% · all strategies won ${rowsWithAllStrategies}/${rows.length * 2} rows`)

  const compareRecovery = (withRecovery: boolean) => {
    const row = metrics()
    const runners = mixedRunners(1, 'g1', 3_200, 12, withRecovery ? [recovery] : [])
    for (let seed = 1; seed <= RACES_PER_ROW; seed += 1) {
      const result = simulateMeasured({ course: { distance: 3_200, surface: 'turf' }, seed, runners })
      collect(row, result.timeline, runners, result.runtimeMs)
    }
    return row
  }
  const without = compareRecovery(false)
  const withSkill = compareRecovery(true)
  console.log(`Long recovery: HP empty ${percent(without.hpEmpty, without.runners).toFixed(1)}% → ${percent(withSkill.hpEmpty, withSkill.runners).toFixed(1)}% · finish ${(without.finishSeconds / without.runners).toFixed(1)}s → ${(withSkill.finishSeconds / withSkill.runners).toFixed(1)}s`)
}

function playerStats(tier: number, grade: RaceGrade, distance: number, build: PlayerBuild): Stats {
  if (build === 'field') return rivalPreset(tier, grade, distanceCategory(distance), 'pace')
  return allStats(averageCap(tier) * (build === 'under' ? 0.7 : 1))
}

function playerRunners(input: {
  tier: number; grade: RaceGrade; distance: number; field: number; build: PlayerBuild
  playerStrategy: Strategy; playerSkills: readonly CompiledRaceSkill[]; seed: number
}) {
  const rivalStats = (strategy: Strategy) => rivalPreset(input.tier, input.grade, distanceCategory(input.distance), strategy)
  const playerGate = input.seed % input.field
  return {
    playerIndex: playerGate,
    runners: Array.from({ length: input.field }, (_, gate) => ({
      id: gate === playerGate ? 'synthetic-player' : `synthetic-rival-${gate}`,
      label: gate === playerGate ? 'Player' : `${gate + 1}`,
      stats: gate === playerGate ? playerStats(input.tier, input.grade, input.distance, input.build) : rivalStats(STRATEGIES[gate % STRATEGIES.length]!),
      strategy: gate === playerGate ? input.playerStrategy : STRATEGIES[gate % STRATEGIES.length]!,
      aptitude: { distance: 'A', surface: 'A', strategy: 'A' } as const,
      gate,
      skills: gate === playerGate ? input.playerSkills : goodKit,
    })),
  }
}

function runPlayerTarget() {
  const distances = [1_200, 1_600, 2_400, 3_200]
  const fields = [12]
  for (const [gradeIndex, grade] of (['g3', 'g1'] as RaceGrade[]).entries()) {
    const value = metrics()
    for (const [distanceIndex, distance] of distances.entries()) for (const [strategyIndex, playerStrategy] of STRATEGIES.entries()) {
      const row = distanceIndex * 4 + strategyIndex
      const field = fields[row % fields.length]!
      const rowMetrics = metrics()
      for (let sample = 1; sample <= RACES_PER_ROW; sample += 1) {
        const seed = 5_000_000 + gradeIndex * 100_000 + row * 1_000 + sample
        const setup = playerRunners({ tier: 1, grade, distance, field, build: 'full', playerStrategy, playerSkills: targetKit, seed })
        const result = simulateMeasured({ course: { distance, surface: 'turf' }, seed, runners: setup.runners })
        collect(value, result.timeline, setup.runners, result.runtimeMs, setup.playerIndex)
        collect(rowMetrics, result.timeline, setup.runners, result.runtimeMs, setup.playerIndex)
      }
      console.log(`  ${grade.toUpperCase()} ${distance}m ${playerStrategy} f${field}: ${percent(rowMetrics.playerWins, rowMetrics.playerRaces).toFixed(1)}%`)
    }
    console.log(`Player target ${grade.toUpperCase()}: ${percent(value.playerWins, value.playerRaces).toFixed(1)}% (${value.playerWins}/${value.playerRaces})`)
  }
}

function runFinal() {
  console.log(`Milestone 3 final matrix · ${RACES_PER_ROW} seeds/row · synthetic fixtures only`)
  const mixed = metrics()
  let mixedRows = 0
  let worstRowShare = 0
  let zeroWinRows = 0
  let worstRow = ''
  const zeroRows: string[] = []
  const distances = [1_200, 1_600, 2_400, 3_200]
  const fields = [8, 12, 18]
  const grades: RaceGrade[] = ['g3', 'g1']
  const variants: SkillVariant[] = ['none', 'recovery', 'baseline']
  for (const [tierIndex, tier] of [1, 6, 11].entries()) {
    for (const [distanceIndex, distance] of distances.entries()) {
      for (const [gradeIndex, grade] of (['op', 'g3', 'g2', 'g1'] as RaceGrade[]).entries()) {
        const rowIndex = tierIndex * 16 + distanceIndex * 4 + gradeIndex
        const field = fields[rowIndex % fields.length]!
        const variant = variants[rowIndex % variants.length]!
        const runners = mixedRunners(tier, grade, distance, field, skillVariants[variant])
        const row = metrics()
        for (let sample = 1; sample <= RACES_PER_ROW; sample += 1) {
          const seed = 1_000_000 + rowIndex * 10_000 + sample
          const result = simulateMeasured({ course: { distance, surface: 'turf' }, seed, runners })
          collect(row, result.timeline, runners, result.runtimeMs)
          collect(mixed, result.timeline, runners, result.runtimeMs)
        }
        const shares = STRATEGIES.map((strategy) => percent(row.wins[strategy], row.races))
        shares.forEach((share, strategyIndex) => {
          const label = `T${tier} ${grade.toUpperCase()} ${distance}m f${field} ${variant} ${STRATEGIES[strategyIndex]}`
          if (share > worstRowShare) {
            worstRowShare = share
            worstRow = label
          }
          if (share === 0) zeroRows.push(label)
        })
        zeroWinRows += shares.filter((share) => share === 0).length
        mixedRows += 1
      }
    }
  }
  printMetrics('Mixed-strategy matrix', mixed)
  console.log('  48 rows · tiers 1/6/11 · OP/G3/G2/G1 · 1200/1600/2400/3200m · fields 8/12/18 · none/recovery/baseline skills')
  console.log(`  sensitivity extreme ${worstRowShare.toFixed(1)}% (${worstRow}) · zero-win cells ${zeroWinRows}/${mixedRows * STRATEGIES.length}${zeroRows.length ? ` · ${zeroRows.join('; ')}` : ''}`)

  const guard = metrics()
  let guardWorst = 0
  let guardZeroRows = 0
  const guardSeeds = 200
  const guardRows: [number, number][] = [[1, 1_200], [1, 1_600], [1, 2_400], [1, 3_200], [6, 2_400], [11, 3_200]]
  for (const [tier, distance] of guardRows) for (const grade of ['g3', 'g1'] as RaceGrade[]) {
    const row = metrics()
    const runners = mixedRunners(tier, grade, distance, 12, [recovery])
    for (let seed = 1; seed <= guardSeeds; seed += 1) {
      const result = simulateMeasured({ course: { distance, surface: 'turf' }, seed, runners })
      collect(row, result.timeline, runners, result.runtimeMs)
      collect(guard, result.timeline, runners, result.runtimeMs)
    }
    const shares = STRATEGIES.map((strategy) => percent(row.wins[strategy], row.races))
    guardWorst = Math.max(guardWorst, ...shares)
    if (shares.some((share) => share === 0)) guardZeroRows += 1
  }
  printMetrics('Standard strategy guard', guard)
  console.log(`  ${guard.races.toLocaleString()} races · worst row ${guardWorst.toFixed(1)}% · zero-win rows ${guardZeroRows}/${guardRows.length * 2}`)

  const player = metrics()
  const targetG3 = metrics()
  const targetG1 = metrics()
  let targetRow = 0
  for (const [distanceIndex, distance] of distances.entries()) {
    for (const [gradeIndex, grade] of (['g3', 'g1'] as RaceGrade[]).entries()) {
      for (const [strategyIndex, playerStrategy] of STRATEGIES.entries()) {
        const row = distanceIndex * 8 + gradeIndex * 4 + strategyIndex
        const field = 12
        for (let sample = 1; sample <= RACES_PER_ROW; sample += 1) {
          const seed = 2_000_000 + row * 10_000 + sample
          const setup = playerRunners({ tier: 1, grade, distance, field, build: 'full', playerStrategy, playerSkills: targetKit, seed })
          const result = simulateMeasured({ course: { distance, surface: 'turf' }, seed, runners: setup.runners })
          collect(player, result.timeline, setup.runners, result.runtimeMs, setup.playerIndex)
          collect(grade === 'g3' ? targetG3 : targetG1, result.timeline, setup.runners, result.runtimeMs, setup.playerIndex)
        }
        targetRow += 1
      }
    }
  }

  const comparison = metrics()
  const comparisonByBuild: Record<PlayerBuild, Metrics> = { under: metrics(), field: metrics(), full: metrics() }
  const comparisonBySkill: Record<SkillVariant, Metrics> = { none: metrics(), recovery: metrics(), baseline: metrics() }
  const builds: PlayerBuild[] = ['under', 'field', 'full']
  for (const [tierIndex, tier] of [1, 6, 11].entries()) {
    for (const [gradeIndex, grade] of grades.entries()) {
      for (const [distanceIndex, distance] of distances.entries()) {
        for (const pass of [0, 1]) {
          const row = tierIndex * 32 + gradeIndex * 16 + distanceIndex * 4 + pass
          const variant = variants[Math.floor(row / 3) % variants.length]!
          const field = fields[(row + 2) % fields.length]!
          const playerStrategy = STRATEGIES[row % STRATEGIES.length]!
          for (const [buildIndex, build] of builds.entries()) {
            for (let sample = 1; sample <= Math.max(8, Math.floor(RACES_PER_ROW / 5)); sample += 1) {
              const seed = 3_000_000 + row * 10_000 + buildIndex * 1_000 + sample
              const setup = playerRunners({ tier, grade, distance, field, build, playerStrategy, playerSkills: skillVariants[variant], seed })
              const result = simulateMeasured({ course: { distance, surface: 'turf' }, seed, runners: setup.runners })
              collect(comparison, result.timeline, setup.runners, result.runtimeMs, setup.playerIndex)
              collect(comparisonByBuild[build], result.timeline, setup.runners, result.runtimeMs, setup.playerIndex)
              collect(comparisonBySkill[variant], result.timeline, setup.runners, result.runtimeMs, setup.playerIndex)
            }
          }
        }
      }
    }
  }

  printMetrics('Representative player target rows', player)
  console.log(`  fully-trained + representative card loadout: G3 ${percent(targetG3.playerWins, targetG3.playerRaces).toFixed(1)}% (${targetG3.playerWins}/${targetG3.playerRaces}) · G1 ${percent(targetG1.playerWins, targetG1.playerRaces).toFixed(1)}% (${targetG1.playerWins}/${targetG1.playerRaces})`)
  console.log(`  ${targetRow} rows across all strategies/distances in standard 12-runner fields`)
  console.log('Representative build comparison (paired coverage of tier/grade/distance/skill/field):')
  for (const build of builds) {
    const value = comparisonByBuild[build]
    console.log(`  ${build.padEnd(5)} ${percent(value.playerWins, value.playerRaces).toFixed(1)}% wins (${value.playerWins}/${value.playerRaces})`)
  }
  console.log('Player skill comparison:')
  for (const variant of variants) {
    const value = comparisonBySkill[variant]
    console.log(`  ${variant.padEnd(8)} ${percent(value.playerWins, value.playerRaces).toFixed(1)}% wins (${value.playerWins}/${value.playerRaces})`)
  }
  printMetrics('Player comparison matrix', comparison)

  const recoveryRows = (withRecovery: boolean) => {
    const resultMetrics = metrics()
    for (const field of fields) for (let sample = 1; sample <= RACES_PER_ROW; sample += 1) {
      const runners = mixedRunners(1, 'g1', 3_200, field, withRecovery ? [recovery] : [])
      const result = simulateMeasured({ course: { distance: 3_200, surface: 'turf' }, seed: 4_000_000 + field * 10_000 + sample, runners })
      collect(resultMetrics, result.timeline, runners, result.runtimeMs)
    }
    return resultMetrics
  }
  const noRecovery = recoveryRows(false)
  const yesRecovery = recoveryRows(true)
  console.log(`Long recovery isolation: HP empty ${percent(noRecovery.hpEmpty, noRecovery.runners).toFixed(1)}% → ${percent(yesRecovery.hpEmpty, yesRecovery.runners).toFixed(1)}% · finish ${(noRecovery.finishSeconds / noRecovery.runners).toFixed(1)}s → ${(yesRecovery.finishSeconds / yesRecovery.runners).toFixed(1)}s`)
  const totalRaces = mixed.races + guard.races + player.races + comparison.races + noRecovery.races + yesRecovery.races
  const totalRuntime = mixed.runtimeMs + guard.runtimeMs + player.runtimeMs + comparison.runtimeMs + noRecovery.runtimeMs + yesRecovery.runtimeMs
  console.log(`\nTotal: ${totalRaces.toLocaleString()} deterministic races · ${(totalRuntime / 1_000).toFixed(1)}s measured engine runtime`)
  console.log(`Strategy targets: aggregate ${STRATEGIES.every((strategy) => percent(guard.wins[strategy], guard.races) >= 15 && percent(guard.wins[strategy], guard.races) <= 35) ? 'PASS' : 'REVIEW'} · row ≤60% ${guardWorst <= 60 ? 'PASS' : 'REVIEW'} · representative row wins ${guardZeroRows === 0 ? 'PASS' : 'REVIEW'}`)
}

if (targetOnly) runPlayerTarget()
else if (finalMode) runFinal()
else runQuick()
