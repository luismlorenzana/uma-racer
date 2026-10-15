// `pnpm sim:loop` (D348, docs/rework/12-economy-and-pacing.md §12): the whole economy from a
// fresh account on the rework's rules, its report, and 12 §12's checks.
//
//   pnpm sim:loop                         the baseline (three tiers), the heavy variant and the probes; the report
//   pnpm sim:loop -- --variant=<name>     one variant instead of the baseline (tier 1): see VARIANTS below
//   pnpm sim:loop -- --matrix             every variant axis changed alone from the baseline, tier 1, in one table
//   pnpm sim:loop -- --json               the report as JSON
//   pnpm sim:loop -- --refresh-wins       regenerate the committed win table (about 12 minutes; build the domain first)
//
// Exit code 1 when a check fails, except a check the loop test marks as a known miss (D348). Synthetic only, seeded with
// the race engine's createRng, never Math.random. Runs with tsx under the data pipeline.
import { createRng } from '../../packages/race/src/rng'
import {
  BASELINE, LOOP_VARIANTS, evaluateChecks, farmLevelProbes, firstUnlockProbe, formatChecks, formatMatrix, formatReport, loopRng,
  matrixRow, simulateLoop, type LoopConfig, type LoopResult,
} from '../../packages/domain/src/sim/index'

const args = process.argv.slice(2)
const flag = (name: string) => args.includes(`--${name}`)
const option = (name: string) => args.find((arg) => arg.startsWith(`--${name}=`))?.split('=')[1]

// The domain's copy of mulberry32 must roll what the engine's createRng rolls.
{
  const engine = createRng(132), ours = loopRng(132)
  for (let i = 0; i < 64; i += 1) if (engine.next() !== ours.next()) throw new Error("loopRng drifted from the race engine's createRng")
}

const run = (config: LoopConfig): LoopResult => simulateLoop(config, createRng(config.seed))

async function main(): Promise<number> {
  if (flag('refresh-wins')) {
    const { generateWinTable, writeWinTable } = await import('./loop-wins')
    const races = Number(option('races') ?? 200)
    writeWinTable(generateWinTable(races, 132, (line) => console.log(line)))
    console.log('Wrote packages/domain/src/sim/win-table.ts. Run `pnpm docs:update` next.')
    return 0
  }
  if (flag('matrix')) {
    const rows = Object.entries(LOOP_VARIANTS).map(([name, config]) => matrixRow(name, run(config)))
    console.log(flag('json') ? JSON.stringify(rows, null, 2) : formatMatrix(rows))
    return 0
  }
  const variant = option('variant')
  if (variant !== undefined) {
    const config = LOOP_VARIANTS[variant]
    if (!config) throw new Error(`No variant ${variant}: ${Object.keys(LOOP_VARIANTS).join(', ')}`)
    const result = run(config)
    console.log(flag('json') ? JSON.stringify({ variant, metrics: result.metrics }, null, 2) : formatReport(result))
    return 0
  }

  const baseline = run(BASELINE)
  const heavy = run(LOOP_VARIANTS.heavy!)
  const checks = evaluateChecks({ baseline, heavy, farmLevels: farmLevelProbes(), firstUnlock: firstUnlockProbe() })
  if (flag('json')) console.log(JSON.stringify({ metrics: baseline.metrics, heavy: heavy.metrics, checks: checks.map((c) => ({ id: c.check.id, values: c.values, pass: c.pass })) }, null, 2))
  else console.log([formatReport(baseline), '', formatChecks(checks)].join('\n'))
  const failed = checks.filter((check) => !check.pass && !check.check.knownMiss)
  if (failed.length > 0) console.error(`\n${failed.length} check(s) failed: ${failed.map((check) => check.check.id).join(', ')}`)
  return failed.length > 0 ? 1 : 0
}

main().then((code) => process.exit(code), (error: unknown) => { console.error(error); process.exit(1) })
