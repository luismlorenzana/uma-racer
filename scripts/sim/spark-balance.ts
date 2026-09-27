// Spark Rival Circuit balance harness (docs/design/minigames.md#spark-match--rival-circuit, T071).
// All ids and labels are invented. This script never reads private or original-game content.
//
//   pnpm sim:spark
//   pnpm sim:spark -- --quick
//   pnpm sim:spark -- --update   # print the measured regression envelope for an intentional retune
import {
  SPARK_RIVAL_MAX_DRIVE,
  SPARK_RIVAL_SHIFT_CHARGE,
  SPARK_RIVAL_TURNS_PER_WAVE,
} from '../../packages/domain/src/index'
import {
  createSparkRivalState,
  currentSparkRivalIntent,
  reduceSparkRival,
  sparkIndexCell,
  sparkNextInt,
  sparkSeed,
  syntheticSparkEncounter,
  type SparkCell,
  type SparkRivalAction,
  type SparkRivalEncounterV1,
  type SparkRivalState,
  type SparkRivalRecipe,
} from '../../apps/web/src/game/minigames/spark-rival/index'

type AgentKind = 'random' | 'greedy' | 'planner'

interface AgentState { rng: number }
interface RunResult {
  kind: 'clear' | 'loss'
  reason: string
  exp: number
  drive: number
  turns: readonly [number, number, number]
  combos: number
  drags: number
}

const args = process.argv.slice(2)
const QUICK = args.includes('--quick')
const UPDATE = args.includes('--update')
const SEEDS = QUICK ? 4 : 12
const TIERS = [1, 7, 14] as const
const LEVELS = [1, 5, 9] as const
const RECIPES = ['rush-pressure', 'tracker-guard', 'surge-convert', 'finisher-delay'] as const
const PROFILES = [{ label: 'A/B', grade: 'A' }, { label: 'S/B', grade: 'S' }] as const
const DIRECTIONS = [
  [-1, -1], [-1, 0], [-1, 1],
  [0, -1], [0, 1],
  [1, -1], [1, 0], [1, 1],
] as const

const REGRESSION = {
  plannerClearRate: { minimum: 0.65, maximum: 0.85 },
  plannerMedianWaveTurns: { minimum: 3, maximum: 8 },
  plannerClearExp: { minimum: 1_950, maximum: 2_250 },
  plannerLossExpMaximum: 877,
} as const

function randomPath(agent: AgentState, minimum: number, maximum: number): SparkCell[] {
  let value: number
  ;[value, agent.rng] = sparkNextInt(agent.rng, 30)
  const path = [sparkIndexCell(value)]
  ;[value, agent.rng] = sparkNextInt(agent.rng, maximum - minimum + 1)
  const length = minimum + value
  while (path.length < length) {
    const last = path.at(-1)!
    let candidate: SparkCell | null = null
    for (let attempt = 0; attempt < DIRECTIONS.length; attempt += 1) {
      ;[value, agent.rng] = sparkNextInt(agent.rng, DIRECTIONS.length)
      const direction = DIRECTIONS[value]!
      const row = last.row + direction[0]
      const column = last.column + direction[1]
      if (row >= 0 && row < 5 && column >= 0 && column < 6) {
        candidate = { row, column }
        break
      }
    }
    if (!candidate) candidate = { row: last.row, column: last.column === 5 ? 4 : last.column + 1 }
    path.push(candidate)
  }
  return path
}

function drag(path: readonly SparkCell[]): SparkRivalAction {
  return { type: 'drag', path, movementMs: Math.min(7_000, Math.max(1, (path.length - 1) * 95)) }
}

function candidateScore(
  kind: Exclude<AgentKind, 'random'>,
  encounter: SparkRivalEncounterV1,
  state: SparkRivalState,
  action: SparkRivalAction,
): number {
  const next = reduceSparkRival(encounter, state, action).state
  if (next.outcome?.kind === 'clear') return 10_000_000 + next.outcome.trainingExp
  if (next.outcome?.kind === 'loss') return -10_000_000 + next.outcome.trainingExp
  const crossedWave = next.waveIndex > state.waveIndex
  const damage = crossedWave ? state.rival.resolve : state.rival.resolve - next.rival.resolve
  const driveChange = next.drive - state.drive
  const chargeChange = next.sparkCharge - state.sparkCharge
  const base = damage * 1_000 + (crossedWave ? 500_000 : 0) + next.totalCombos * 2 + chargeChange * 20
  if (kind === 'greedy') return base
  const visible = currentSparkRivalIntent(encounter, state)
  const danger = state.drive <= 40 || (state.rival.countdown <= 1 && visible.type === 'pressure')
  const survival = driveChange * (danger ? 1_200 : 120)
  const shiftSetup = next.sparkCharge >= next.sparkTarget ? 8_000 : chargeChange * 250
  const pace = Math.max(0, SPARK_RIVAL_TURNS_PER_WAVE - next.waveTurn) * 4
  return base + survival + shiftSetup + pace
}

function chooseAction(
  kind: AgentKind,
  encounter: SparkRivalEncounterV1,
  state: SparkRivalState,
  agent: AgentState,
): SparkRivalAction {
  if (state.sparkCharge >= state.sparkTarget && state.board.includes('spark')) return { type: 'spark-shift' }
  if (kind === 'random') return drag(randomPath(agent, 3, 14))
  const samples = kind === 'greedy' ? 40 : 48
  const minimum = 2
  const maximum = 14
  let best = drag(randomPath(agent, minimum, maximum))
  let bestScore = candidateScore(kind, encounter, state, best)
  for (let sample = 1; sample < samples; sample += 1) {
    const action = drag(randomPath(agent, minimum, maximum))
    const score = candidateScore(kind, encounter, state, action)
    if (score > bestScore) {
      best = action
      bestScore = score
    }
  }
  return best
}

function simulate(kind: AgentKind, encounter: SparkRivalEncounterV1, seed: string): RunResult {
  let state = createSparkRivalState(encounter, seed)
  const agent = { rng: sparkSeed(seed, `agent-${kind}`) }
  const turns = [0, 0, 0] as [number, number, number]
  let actionCount = 0
  while (!state.outcome && actionCount < 64) {
    const wave = state.waveIndex
    const action = chooseAction(kind, encounter, state, agent)
    const reduced = reduceSparkRival(encounter, state, action, actionCount)
    if (reduced.resolution.turnConsumed) turns[wave] += 1
    state = reduced.state
    actionCount += 1
  }
  if (!state.outcome) throw new Error(`${kind} exceeded the action bound`)
  return {
    kind: state.outcome.kind,
    reason: state.outcome.reason,
    exp: state.outcome.trainingExp,
    drive: state.drive,
    turns,
    combos: state.totalCombos,
    drags: state.totalDrags,
  }
}

function median(values: readonly number[]): number {
  const ordered = [...values].sort((left, right) => left - right)
  const middle = Math.floor(ordered.length / 2)
  return ordered.length % 2 === 0 ? (ordered[middle - 1]! + ordered[middle]!) / 2 : ordered[middle]!
}

function average(values: readonly number[]): number {
  return values.length === 0 ? 0 : values.reduce((sum, value) => sum + value, 0) / values.length
}

function percent(value: number): string {
  return `${Math.round(value * 100).toString().padStart(3)}%`
}

console.log('Spark Rival Circuit balance — synthetic fixed seeds only')
console.log(`Drive ${SPARK_RIVAL_MAX_DRIVE} · Shift ${SPARK_RIVAL_SHIFT_CHARGE} · ${SPARK_RIVAL_TURNS_PER_WAVE} drags/wave · ${SEEDS} seeds/cell`)

const overall: Record<AgentKind, RunResult[]> = { random: [], greedy: [], planner: [] }
const plannerRows: { label: string; runs: RunResult[] }[] = []
for (const tier of TIERS) for (const trainingLevel of LEVELS) for (const recipe of RECIPES) for (const profile of PROFILES) {
  const encounter = syntheticSparkEncounter({
    scenarioTier: tier,
    trainingLevel,
    traineeBest: recipe === 'rush-pressure' ? 'pace' : recipe === 'tracker-guard' ? 'late' : recipe === 'surge-convert' ? 'end' : 'front',
    bestGrade: profile.grade,
    recipes: [recipe, recipe, 'circuit-boss'],
  })
  const row: RunResult[] = []
  for (let index = 0; index < SEEDS; index += 1) {
    const seed = `spark-sim-v1-t${tier}-l${trainingLevel}-${recipe}-${profile.label}-${index}`
    for (const kind of ['random', 'greedy', 'planner'] as const) {
      const result = simulate(kind, encounter, seed)
      overall[kind].push(result)
      if (kind === 'planner') row.push(result)
    }
  }
  plannerRows.push({ label: `T${tier.toString().padStart(2)} TL${trainingLevel} ${recipe.padEnd(15)} ${profile.label}`, runs: row })
}

console.log('\nAgent smoke summary')
for (const kind of ['random', 'greedy', 'planner'] as const) {
  const runs = overall[kind]
  const clears = runs.filter((run) => run.kind === 'clear')
  const losses = runs.filter((run) => run.kind === 'loss')
  console.log(`${kind.padEnd(8)} clear ${percent(clears.length / runs.length)} · combos/drag ${average(runs.map((run) => run.combos / run.drags)).toFixed(2)} · clear EXP ${Math.round(average(clears.map((run) => run.exp)))} · loss EXP ${Math.round(average(losses.map((run) => run.exp)))}`)
}

console.log('\nPlanner matrix')
for (const row of plannerRows) {
  const clears = row.runs.filter((run) => run.kind === 'clear')
  const turns = row.runs.flatMap((run) => run.turns.filter((value) => value > 0))
  const drive = clears.map((run) => run.drive)
  console.log(`${row.label} · clear ${percent(clears.length / row.runs.length)} · wave turns ${median(turns).toFixed(1)} · combo/drag ${average(row.runs.map((run) => run.combos / run.drags)).toFixed(2)} · Drive ${Math.round(average(drive))} · EXP ${Math.round(average(row.runs.map((run) => run.exp)))}`)
}

const planner = overall.planner
const plannerClears = planner.filter((run) => run.kind === 'clear')
const plannerLosses = planner.filter((run) => run.kind === 'loss')
const measurements = {
  plannerClearRate: plannerClears.length / planner.length,
  plannerMedianWaveTurns: median(planner.flatMap((run) => run.turns.filter((value) => value > 0))),
  plannerClearExp: average(plannerClears.map((run) => run.exp)),
  plannerMaximumLossExp: Math.max(0, ...plannerLosses.map((run) => run.exp)),
}

if (UPDATE) console.log(`\nMeasured regression envelope:\n${JSON.stringify(measurements, null, 2)}`)

const failures: string[] = []
if (measurements.plannerClearRate < REGRESSION.plannerClearRate.minimum || measurements.plannerClearRate > REGRESSION.plannerClearRate.maximum) failures.push(`planner clear rate ${percent(measurements.plannerClearRate)} outside ${percent(REGRESSION.plannerClearRate.minimum)}–${percent(REGRESSION.plannerClearRate.maximum)}`)
if (measurements.plannerMedianWaveTurns < REGRESSION.plannerMedianWaveTurns.minimum || measurements.plannerMedianWaveTurns > REGRESSION.plannerMedianWaveTurns.maximum) failures.push(`median wave turns ${measurements.plannerMedianWaveTurns} outside ${REGRESSION.plannerMedianWaveTurns.minimum}–${REGRESSION.plannerMedianWaveTurns.maximum}`)
if (measurements.plannerClearExp < REGRESSION.plannerClearExp.minimum || measurements.plannerClearExp > REGRESSION.plannerClearExp.maximum) failures.push(`clear EXP ${Math.round(measurements.plannerClearExp)} outside ${REGRESSION.plannerClearExp.minimum}–${REGRESSION.plannerClearExp.maximum}`)
if (measurements.plannerMaximumLossExp > REGRESSION.plannerLossExpMaximum) failures.push(`loss EXP ${measurements.plannerMaximumLossExp} exceeds ${REGRESSION.plannerLossExpMaximum}`)
if (overall.random.filter((run) => run.kind === 'clear').length > plannerClears.length) failures.push('random agent cleared more often than planner')

if (failures.length > 0) {
  console.error(`\nSpark balance regression:\n- ${failures.join('\n- ')}`)
  process.exitCode = 1
} else console.log('\nSpark balance regression: pass')
