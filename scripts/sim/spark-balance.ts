// Spark Rival Circuit balance harness (docs/design/minigames.md#spark-match--rival-circuit, T074).
// All ids and labels are invented. This script never reads private or original-game content.
//
//   pnpm sim:spark
//   pnpm sim:spark -- --quick
//   pnpm sim:spark -- --full    # 1,000 fixed seeds for every tier/TL row
//   pnpm sim:spark -- --update  # include the measured regression envelope
import {
  SPARK_RIVAL_MAX_DRIVE,
  SPARK_RIVAL_SHIFT_CHARGE,
  SPARK_RIVAL_TURNS_PER_WAVE,
  STRATEGIES,
  addTrainingExp,
  bestSparkStrategy,
  createSparkRivalState,
  currentSparkRivalIntent,
  reduceSparkRival,
  sparkIndexCell,
  sparkMatchup,
  sparkNextInt,
  sparkSeed,
  syntheticSparkEncounter,
  type SparkCell,
  type SparkRivalAction,
  type SparkRivalEncounterV1,
  type SparkRivalRecipe,
  type SparkRivalState,
  type Grade,
  type Strategy,
} from '../../packages/domain/src/index'

type AgentKind = 'random' | 'greedy' | 'planner' | 'healer' | 'no-match' | 'hoard' | 'farm-loss' | 'disadvantaged'

interface AgentState { rng: number }
interface RunResult {
  kind: 'clear' | 'loss'
  reason: string
  exp: number
  drive: number
  turns: readonly [number, number, number]
  waveCleared: readonly [boolean, boolean, boolean]
  combos: number
  drags: number
  shifts: number
  actions: number
}

interface MatrixCase {
  tier: number
  trainingLevel: number
  traineeBest: Strategy
  recipe: Exclude<SparkRivalRecipe, 'circuit-boss'>
  profile: AptitudeProfile
  repetition: number
}

interface AptitudeProfile {
  label: 'low' | 'average' | 'high'
  best: Grade
  other: Grade
}

interface RateSummary {
  rate: number
  minimum: number
  maximum: number
}

interface PlannerRun {
  input: MatrixCase
  result: RunResult
}

interface RowMeasurements {
  label: string
  clearRate: number
  medianClearExp: number
  maximumLossExp: number
  shiftClearRate: number
  styleRates: Readonly<Record<Strategy, number>>
  recipeWaveRates: Readonly<Record<SparkRivalRecipe, number>>
}

const args = process.argv.slice(2)
const QUICK = args.includes('--quick')
const FULL = args.includes('--full')
const UPDATE = args.includes('--update')
const ALL_LEVELS = [1, 2, 3, 4, 5, 6, 7, 8, 9] as const
const ANCHOR_LEVELS = [1, 5, 9] as const
const ALL_TIERS = Array.from({ length: 14 }, (_, index) => index + 1)
const ANCHOR_TIERS = [1, 7, 14] as const
const ORDINARY_RECIPES = ['rush-pressure', 'tracker-guard', 'surge-convert', 'finisher-delay', 'adaptive-duel'] as const
const PROFILES: readonly AptitudeProfile[] = [
  { label: 'low', best: 'B', other: 'D' },
  { label: 'average', best: 'A', other: 'B' },
  { label: 'high', best: 'S', other: 'A' },
]
const COMBINATIONS = STRATEGIES.length * ORDINARY_RECIPES.length * PROFILES.length
const ROW_SAMPLES = FULL ? 1_000 : COMBINATIONS
const DIRECTIONS = [
  [-1, -1], [-1, 0], [-1, 1],
  [0, -1], [0, 1],
  [1, -1], [1, 0], [1, 1],
] as const

const REGRESSION = {
  plannerClearRate: { minimum: 0.65, maximum: 0.85 },
  rowClearRate: { minimum: 0.55, maximum: 0.90 },
  plannerMedianWaveTurns: { minimum: 4, maximum: 7 },
  plannerP90WaveTurnsMaximum: 8,
  plannerMedianClearExp: { minimum: 2_100, maximum: 2_300 },
  plannerMedianClearDrive: { minimum: 15, maximum: 65 },
  plannerShiftClearRate: { minimum: 0.25, maximum: 0.75 },
  trainingPathMedian: { minimum: 9, maximum: 12 },
  trainingPathP90Maximum: 15,
  styleLeadMaximum: 0.10,
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

function actionMeasurements(encounter: SparkRivalEncounterV1, state: SparkRivalState, action: SparkRivalAction) {
  const reduced = reduceSparkRival(encounter, state, action)
  const next = reduced.state
  const crossedWave = next.waveIndex > state.waveIndex
  const damage = crossedWave ? state.rival.resolve : state.rival.resolve - next.rival.resolve
  const recovery = next.drive - state.drive
  const charge = next.sparkCharge - state.sparkCharge
  const combos = next.totalCombos - state.totalCombos
  const resisted = reduced.resolution.steps.reduce((sum, step) =>
    step.type === 'attack' && step.attack.matchup === 'resisted' ? sum + step.attack.appliedAmount : sum, 0)
  return { next, crossedWave, damage, recovery, charge, combos, resisted }
}

function candidateScore(
  kind: Exclude<AgentKind, 'random' | 'no-match'>,
  encounter: SparkRivalEncounterV1,
  state: SparkRivalState,
  action: SparkRivalAction,
): number {
  const measured = actionMeasurements(encounter, state, action)
  if (measured.next.outcome?.kind === 'clear') return 10_000_000 + measured.next.outcome.trainingExp
  if (measured.next.outcome?.kind === 'loss') return -10_000_000 + measured.next.outcome.trainingExp
  if (kind === 'healer') return measured.recovery * 2_000 - measured.damage * 20 + measured.combos
  if (kind === 'disadvantaged') return measured.resisted * 2_000 + measured.recovery * 20 - measured.damage
  const base = measured.damage * 1_000 + (measured.crossedWave ? 500_000 : 0) + measured.combos * 20 + measured.charge * 20
  if (kind === 'greedy') return base
  const visible = currentSparkRivalIntent(encounter, state)
  const danger = state.drive <= 45 || (state.rival.countdown <= 1 && visible.type === 'pressure')
  const survival = measured.recovery * (danger ? 3_000 : 180)
  const shiftSetup = measured.next.sparkCharge >= measured.next.sparkTarget ? 6_000 : measured.charge * 250
  const pace = Math.max(0, SPARK_RIVAL_TURNS_PER_WAVE - measured.next.waveTurn) * 4
  return base + survival + shiftSetup + pace
}

function shouldShift(kind: AgentKind, encounter: SparkRivalEncounterV1, state: SparkRivalState, agent: AgentState): boolean {
  if (kind === 'hoard' || kind === 'farm-loss' || kind === 'healer' || kind === 'no-match' || kind === 'disadvantaged') return false
  if (state.sparkCharge < state.sparkTarget || !state.board.includes('spark')) return false
  if (kind === 'random') {
    const [roll, next] = sparkNextInt(agent.rng, 2)
    agent.rng = next
    return roll === 0
  }
  const best = bestSparkStrategy(encounter.trainee.strategyAptitudes)
  return sparkMatchup(best, state.rival.strategy) === 'advantaged' && state.board.filter((orb) => orb === 'spark').length >= 2
}

function chooseDrag(kind: AgentKind, encounter: SparkRivalEncounterV1, state: SparkRivalState, agent: AgentState): SparkRivalAction {
  if (kind === 'no-match' || (kind === 'farm-loss' && state.waveIndex === 2)) {
    return drag([sparkIndexCell(0), sparkIndexCell(1), sparkIndexCell(0)])
  }
  if (kind === 'random') return drag(randomPath(agent, 3, 14))
  const scoringKind = kind === 'farm-loss' || kind === 'hoard' ? 'planner' : kind
  const samples = scoringKind === 'greedy' ? 40 : 48
  let best = drag(randomPath(agent, 2, 14))
  let bestScore = candidateScore(scoringKind, encounter, state, best)
  for (let sample = 1; sample < samples; sample += 1) {
    const action = drag(randomPath(agent, 2, 14))
    const score = candidateScore(scoringKind, encounter, state, action)
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
  const waveCleared = [false, false, false] as [boolean, boolean, boolean]
  let actionCount = 0
  let shifts = 0
  while (!state.outcome && actionCount < 64) {
    const wave = state.waveIndex
    const action: SparkRivalAction = shouldShift(kind, encounter, state, agent)
      ? { type: 'spark-shift' }
      : chooseDrag(kind, encounter, state, agent)
    if (action.type === 'spark-shift') shifts += 1
    const reduced = reduceSparkRival(encounter, state, action, actionCount)
    if (reduced.resolution.turnConsumed) turns[wave] += 1
    if (reduced.state.waveIndex > wave || reduced.state.outcome?.kind === 'clear') waveCleared[wave] = true
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
    waveCleared,
    combos: state.totalCombos,
    drags: state.totalDrags,
    shifts,
    actions: actionCount,
  }
}

function percentile(values: readonly number[], share: number): number {
  if (values.length === 0) return 0
  const ordered = [...values].sort((left, right) => left - right)
  return ordered[Math.min(ordered.length - 1, Math.max(0, Math.ceil(ordered.length * share) - 1))]!
}

function median(values: readonly number[]): number {
  return percentile(values, 0.5)
}

function rate(successes: number, total: number): RateSummary {
  if (total === 0) return { rate: 0, minimum: 0, maximum: 0 }
  const value = successes / total
  const z = 1.96
  const denominator = 1 + z * z / total
  const center = (value + z * z / (2 * total)) / denominator
  const radius = z * Math.sqrt((value * (1 - value) + z * z / (4 * total)) / total) / denominator
  return { rate: value, minimum: Math.max(0, center - radius), maximum: Math.min(1, center + radius) }
}

function percent(value: number): string {
  return `${Math.round(value * 100).toString().padStart(3)}%`
}

function rateText(summary: RateSummary, total: number): string {
  return `${percent(summary.rate)} n=${total} (95% ${percent(summary.minimum)}–${percent(summary.maximum)})`
}

function matrixCase(tier: number, trainingLevel: number, sample: number): MatrixCase {
  const combination = sample % COMBINATIONS
  const repetition = Math.floor(sample / COMBINATIONS)
  const profileIndex = combination % PROFILES.length
  const recipeIndex = Math.floor(combination / PROFILES.length) % ORDINARY_RECIPES.length
  const strategyIndex = Math.floor(combination / (PROFILES.length * ORDINARY_RECIPES.length)) % STRATEGIES.length
  return {
    tier,
    trainingLevel,
    traineeBest: STRATEGIES[strategyIndex]!,
    recipe: ORDINARY_RECIPES[recipeIndex]!,
    profile: PROFILES[profileIndex]!,
    repetition,
  }
}

function encounterFor(input: MatrixCase): SparkRivalEncounterV1 {
  const strategyIndex = STRATEGIES.indexOf(input.traineeBest)
  const recipeIndex = ORDINARY_RECIPES.indexOf(input.recipe)
  const rivalStrategy = STRATEGIES[(strategyIndex + recipeIndex) % STRATEGIES.length]!
  return syntheticSparkEncounter({
    scenarioTier: input.tier,
    trainingLevel: input.trainingLevel,
    traineeBest: input.traineeBest,
    bestGrade: input.profile.best,
    otherGrade: input.profile.other,
    recipes: [input.recipe, input.recipe, 'circuit-boss'],
    adaptiveStrategy: rivalStrategy,
    bossStrategy: rivalStrategy,
  })
}

function seedFor(input: MatrixCase, suffix = 'planner'): string {
  return `spark-sim-v2-t${input.tier}-l${input.trainingLevel}-${input.traineeBest}-${input.recipe}-${input.profile.label}-${input.repetition}-${suffix}`
}

function rowKeys(): { tier: number; trainingLevel: number }[] {
  if (FULL) return ALL_TIERS.flatMap((tier) => ALL_LEVELS.map((trainingLevel) => ({ tier, trainingLevel })))
  if (QUICK) return ANCHOR_TIERS.flatMap((tier) => ANCHOR_LEVELS.map((trainingLevel) => ({ tier, trainingLevel })))
  return [
    ...ALL_LEVELS.map((trainingLevel) => ({ tier: 7, trainingLevel })),
    ...[1, 14].flatMap((tier) => ANCHOR_LEVELS.map((trainingLevel) => ({ tier, trainingLevel }))),
  ].sort((left, right) => left.tier - right.tier || left.trainingLevel - right.trainingLevel)
}

function trainingPaths(pools: ReadonlyMap<number, readonly RunResult[]>): number[] {
  const paths: number[] = []
  for (let path = 0; path < 1_000; path += 1) {
    let trainingLevel = 1
    let trainingExp = 0
    let runs = 0
    while (trainingLevel < 10 && runs < 64) {
      const pool = pools.get(trainingLevel)
      if (!pool || pool.length === 0) throw new Error(`Missing TL${trainingLevel} path pool`)
      const result = pool[(path * 17 + runs * 31) % pool.length]!
      const gain = addTrainingExp(trainingLevel, trainingExp, result.exp)
      trainingLevel = gain.trainingLevel
      trainingExp = gain.trainingExp
      runs += 1
    }
    paths.push(runs)
  }
  return paths
}

function conditionalWaveRate(entries: readonly PlannerRun[], recipe: SparkRivalRecipe): RateSummary & { reached: number } {
  let reached = 0
  let cleared = 0
  for (const { input, result } of entries) {
    if (recipe === 'circuit-boss') {
      if (!result.waveCleared[1]) continue
      reached += 1
      if (result.waveCleared[2]) cleared += 1
    } else if (input.recipe === recipe) {
      reached += 2
      cleared += Number(result.waveCleared[0]) + Number(result.waveCleared[1])
    }
  }
  return { ...rate(cleared, reached), reached }
}

console.log('Spark Rival Circuit balance — synthetic fixed seeds only')
console.log(`Drive ${SPARK_RIVAL_MAX_DRIVE} · Shift ${SPARK_RIVAL_SHIFT_CHARGE} · ${SPARK_RIVAL_TURNS_PER_WAVE} drags/wave · ${ROW_SAMPLES} seeds/tier-TL row`)

const rows = rowKeys()
const plannerRuns: PlannerRun[] = []
for (const [rowIndex, row] of rows.entries()) {
  for (let sample = 0; sample < ROW_SAMPLES; sample += 1) {
    const input = matrixCase(row.tier, row.trainingLevel, sample)
    plannerRuns.push({ input, result: simulate('planner', encounterFor(input), seedFor(input)) })
  }
  if (FULL) console.log(`full matrix ${rowIndex + 1}/${rows.length} · T${row.tier} TL${row.trainingLevel}`)
}

const smokeInputs = Array.from({ length: COMBINATIONS }, (_, sample) => matrixCase(7, 5, sample))
const smoke = Object.fromEntries((['random', 'greedy', 'planner'] as const).map((kind) => [kind,
  smokeInputs.map((input) => simulate(kind, encounterFor(input), seedFor(input, `smoke-${kind}`))),
])) as Record<'random' | 'greedy' | 'planner', RunResult[]>

console.log('\nAgent smoke summary')
for (const kind of ['random', 'greedy', 'planner'] as const) {
  const runs = smoke[kind]
  const clears = runs.filter((run) => run.kind === 'clear')
  const summary = rate(clears.length, runs.length)
  console.log(`${kind.padEnd(8)} clear ${rateText(summary, runs.length)} · combos/drag ${median(runs.map((run) => run.combos / Math.max(1, run.drags))).toFixed(2)} · clear EXP ${median(clears.map((run) => run.exp))}`)
}

console.log('\nPlanner matrix')
const rowMeasurements: RowMeasurements[] = []
for (const row of rows) {
  const entries = plannerRuns.filter(({ input }) => input.tier === row.tier && input.trainingLevel === row.trainingLevel)
  const runs = entries.map(({ result }) => result)
  const clears = runs.filter((run) => run.kind === 'clear')
  const summary = rate(clears.length, runs.length)
  const rowStyleRates = Object.fromEntries(STRATEGIES.map((strategy) => {
    const styleRuns = entries.filter(({ input }) => input.traineeBest === strategy).map(({ result }) => result)
    return [strategy, rate(styleRuns.filter((run) => run.kind === 'clear').length, styleRuns.length).rate]
  })) as Record<Strategy, number>
  const rowRecipeRates = Object.fromEntries([...ORDINARY_RECIPES, 'circuit-boss' as const].map((recipe) => [
    recipe,
    conditionalWaveRate(entries, recipe).rate,
  ])) as Record<SparkRivalRecipe, number>
  const label = `T${row.tier} TL${row.trainingLevel}`
  rowMeasurements.push({
    label,
    clearRate: summary.rate,
    medianClearExp: median(clears.map((run) => run.exp)),
    maximumLossExp: Math.max(0, ...runs.filter((run) => run.kind === 'loss').map((run) => run.exp)),
    shiftClearRate: clears.filter((run) => run.shifts > 0).length / Math.max(1, clears.length),
    styleRates: rowStyleRates,
    recipeWaveRates: rowRecipeRates,
  })
  const styleRange = Object.values(rowStyleRates)
  console.log(`T${row.tier.toString().padStart(2)} TL${row.trainingLevel} · clear ${rateText(summary, runs.length)} · style ${percent(Math.min(...styleRange))}–${percent(Math.max(...styleRange))} · wave turns ${median(runs.flatMap((run) => run.turns.filter((turn) => turn > 0)))} · Drive ${median(clears.map((run) => run.drive))} · EXP ${median(clears.map((run) => run.exp))}`)
}

const allPlanner = plannerRuns.map(({ result }) => result)
const plannerClears = allPlanner.filter((run) => run.kind === 'clear')
const plannerLosses = allPlanner.filter((run) => run.kind === 'loss')
const clearRate = rate(plannerClears.length, allPlanner.length)
const waveTurns = allPlanner.flatMap((run) => run.turns.filter((turn) => turn > 0))
const tlPools = new Map<number, RunResult[]>()
for (const { input, result } of plannerRuns) {
  if (input.tier !== 7) continue
  const pool = tlPools.get(input.trainingLevel) ?? []
  pool.push(result)
  tlPools.set(input.trainingLevel, pool)
}
const paths = QUICK ? [] : trainingPaths(tlPools)

const styleRates = Object.fromEntries(STRATEGIES.map((strategy) => {
  const runs = plannerRuns.filter(({ input }) => input.traineeBest === strategy).map(({ result }) => result)
  return [strategy, rate(runs.filter((run) => run.kind === 'clear').length, runs.length).rate]
})) as Record<Strategy, number>
const styleOrder = [...STRATEGIES].sort((left, right) => styleRates[right] - styleRates[left])
const styleLead = styleRates[styleOrder[0]!] - styleRates[styleOrder[1]!]

const waveRecipeRates = [...ORDINARY_RECIPES, 'circuit-boss' as const].map((recipe) => ({
  recipe,
  ...conditionalWaveRate(plannerRuns, recipe),
}))

const measurements = {
  plannerClearRate: clearRate.rate,
  plannerRuns: allPlanner.length,
  plannerMedianWaveTurns: median(waveTurns),
  plannerP90WaveTurns: percentile(waveTurns, 0.9),
  plannerMedianClearExp: median(plannerClears.map((run) => run.exp)),
  plannerMaximumLossExp: Math.max(0, ...plannerLosses.map((run) => run.exp)),
  plannerMedianClearDrive: median(plannerClears.map((run) => run.drive)),
  plannerShiftClearRate: plannerClears.filter((run) => run.shifts > 0).length / Math.max(1, plannerClears.length),
  trainingPathMedian: paths.length > 0 ? median(paths) : null,
  trainingPathP90: paths.length > 0 ? percentile(paths, 0.9) : null,
  styleRates,
  styleLead,
  recipeWaveRates: Object.fromEntries(waveRecipeRates.map((entry) => [entry.recipe, entry.rate])),
  lossReasons: Object.fromEntries(['drive-depleted', 'turn-limit'].map((reason) => [reason, plannerLosses.filter((run) => run.reason === reason).length])),
}

console.log('\nFairness and progression')
console.log(`overall clear ${rateText(clearRate, allPlanner.length)} · clear EXP ${measurements.plannerMedianClearExp} · Drive ${measurements.plannerMedianClearDrive} · Shift ${percent(measurements.plannerShiftClearRate)}`)
console.log(`styles ${STRATEGIES.map((strategy) => `${strategy} ${percent(styleRates[strategy])}`).join(' · ')} · leading gap ${percent(styleLead)}`)
console.log(`conditional wave clears ${waveRecipeRates.map((entry) => `${entry.recipe} ${percent(entry.rate)} n=${entry.reached}`).join(' · ')}`)
if (paths.length > 0) console.log(`TL1→10 paid runs median ${measurements.trainingPathMedian} · p90 ${measurements.trainingPathP90}`)
console.log(`losses Drive ${measurements.lossReasons['drive-depleted']} · turn bound ${measurements.lossReasons['turn-limit']}`)

const adversarialInput = matrixCase(7, 5, 0)
const adversarialEncounter = encounterFor(adversarialInput)
const adversarial: { kind: string; result: RunResult }[] = (['healer', 'no-match', 'farm-loss', 'hoard', 'disadvantaged'] as const).map((kind) => ({
  kind,
  result: simulate(kind, adversarialEncounter, seedFor(adversarialInput, `adversarial-${kind}`)),
}))
const conversionInput: MatrixCase = { ...adversarialInput, recipe: 'surge-convert' }
adversarial.push({ kind: 'conversion', result: simulate('planner', encounterFor(conversionInput), seedFor(conversionInput, 'adversarial-conversion')) })
console.log(`adversarial ${adversarial.map(({ kind, result }) => `${kind}:${result.kind}/${result.reason}/${result.exp}EXP/${result.actions}a`).join(' · ')}`)

if (UPDATE) console.log(`\nMeasured regression envelope:\n${JSON.stringify(measurements, null, 2)}`)

const failures: string[] = []
if (measurements.plannerClearRate < REGRESSION.plannerClearRate.minimum || measurements.plannerClearRate > REGRESSION.plannerClearRate.maximum) failures.push(`planner clear rate ${percent(measurements.plannerClearRate)} outside ${percent(REGRESSION.plannerClearRate.minimum)}–${percent(REGRESSION.plannerClearRate.maximum)}`)
for (const row of rowMeasurements) {
  if (row.clearRate < REGRESSION.rowClearRate.minimum || row.clearRate > REGRESSION.rowClearRate.maximum) failures.push(`${row.label} clear rate ${percent(row.clearRate)} outside ${percent(REGRESSION.rowClearRate.minimum)}–${percent(REGRESSION.rowClearRate.maximum)}`)
  if (row.shiftClearRate >= 1) failures.push(`${row.label} requires Shift in every clear`)
  if (row.medianClearExp > 0 && row.maximumLossExp >= row.medianClearExp * 0.45) failures.push(`${row.label} loss EXP ${row.maximumLossExp} is not below 45% of clear median ${row.medianClearExp}`)
  if (FULL) {
    for (const strategy of STRATEGIES) {
      const styleRate = row.styleRates[strategy]
      if (styleRate < REGRESSION.rowClearRate.minimum || styleRate > REGRESSION.rowClearRate.maximum) failures.push(`${row.label} ${strategy} clear rate ${percent(styleRate)} outside ${percent(REGRESSION.rowClearRate.minimum)}–${percent(REGRESSION.rowClearRate.maximum)}`)
    }
    const bossRate = row.recipeWaveRates['circuit-boss']
    for (const recipe of ORDINARY_RECIPES) if (row.recipeWaveRates[recipe] < bossRate) failures.push(`${row.label} ${recipe} wave clear ${percent(row.recipeWaveRates[recipe])} trails boss ${percent(bossRate)}`)
  }
}
if (measurements.plannerMedianWaveTurns < REGRESSION.plannerMedianWaveTurns.minimum || measurements.plannerMedianWaveTurns > REGRESSION.plannerMedianWaveTurns.maximum) failures.push(`median wave turns ${measurements.plannerMedianWaveTurns} outside ${REGRESSION.plannerMedianWaveTurns.minimum}–${REGRESSION.plannerMedianWaveTurns.maximum}`)
if (measurements.plannerP90WaveTurns > REGRESSION.plannerP90WaveTurnsMaximum) failures.push(`p90 wave turns ${measurements.plannerP90WaveTurns} exceeds ${REGRESSION.plannerP90WaveTurnsMaximum}`)
if (measurements.plannerMedianClearExp < REGRESSION.plannerMedianClearExp.minimum || measurements.plannerMedianClearExp > REGRESSION.plannerMedianClearExp.maximum) failures.push(`median clear EXP ${measurements.plannerMedianClearExp} outside ${REGRESSION.plannerMedianClearExp.minimum}–${REGRESSION.plannerMedianClearExp.maximum}`)
if (measurements.plannerMedianClearDrive < REGRESSION.plannerMedianClearDrive.minimum || measurements.plannerMedianClearDrive > REGRESSION.plannerMedianClearDrive.maximum) failures.push(`median clear Drive ${measurements.plannerMedianClearDrive} outside ${REGRESSION.plannerMedianClearDrive.minimum}–${REGRESSION.plannerMedianClearDrive.maximum}`)
if (measurements.plannerShiftClearRate < REGRESSION.plannerShiftClearRate.minimum || measurements.plannerShiftClearRate > REGRESSION.plannerShiftClearRate.maximum) failures.push(`Shift clear use ${percent(measurements.plannerShiftClearRate)} outside ${percent(REGRESSION.plannerShiftClearRate.minimum)}–${percent(REGRESSION.plannerShiftClearRate.maximum)}`)
if (measurements.trainingPathMedian !== null && (measurements.trainingPathMedian < REGRESSION.trainingPathMedian.minimum || measurements.trainingPathMedian > REGRESSION.trainingPathMedian.maximum)) failures.push(`TL path median ${measurements.trainingPathMedian} outside ${REGRESSION.trainingPathMedian.minimum}–${REGRESSION.trainingPathMedian.maximum}`)
if (measurements.trainingPathP90 !== null && measurements.trainingPathP90 > REGRESSION.trainingPathP90Maximum) failures.push(`TL path p90 ${measurements.trainingPathP90} exceeds ${REGRESSION.trainingPathP90Maximum}`)
if (measurements.styleLead > REGRESSION.styleLeadMaximum) failures.push(`best strategy lead ${percent(measurements.styleLead)} exceeds ${percent(REGRESSION.styleLeadMaximum)}`)
if (measurements.plannerMaximumLossExp >= measurements.plannerMedianClearExp * 0.45) failures.push(`loss EXP ${measurements.plannerMaximumLossExp} is not below 45% of median clear ${measurements.plannerMedianClearExp}`)
if (smoke.random.filter((run) => run.kind === 'clear').length >= smoke.greedy.filter((run) => run.kind === 'clear').length) failures.push('greedy agent did not beat random')
if (smoke.greedy.filter((run) => run.kind === 'clear').length >= smoke.planner.filter((run) => run.kind === 'clear').length) failures.push('planner agent did not beat greedy')
const maximumCompetentClear = Math.max(0, ...plannerClears.map((run) => run.exp))
for (const { kind, result } of adversarial) {
  if (result.actions > 64) failures.push(`${kind} exceeded the action bound`)
  if (result.exp > maximumCompetentClear) failures.push(`${kind} paid ${result.exp}, above a competent clear`)
}
const zeroProgress = adversarial.find((entry) => entry.kind === 'no-match')!.result
if (zeroProgress.exp !== 0) failures.push(`zero-progress path paid ${zeroProgress.exp} EXP`)

if (failures.length > 0) {
  console.error(`\nSpark balance regression:\n- ${failures.join('\n- ')}`)
  process.exitCode = 1
} else console.log('\nSpark balance regression: pass')
