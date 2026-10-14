// Careers on the rework's builds (T133): today's `pnpm sim:careers` on full-layer rework builds against T125's fields
// (docs/rework/03-uma-progression.md §4, §9 and §12, D137, D336 (4), D349). Beside `pnpm sim:careers`, which keeps
// checking today's game.
//
//   pnpm sim:rework-careers                      coverage of the private content pack + stage win rates at every T = 1–14
//   pnpm sim:rework-careers -- --content=<dir>   read the pack from another folder (default content/data)
//   pnpm sim:rework-careers -- 60                races per win-rate cell (default 20)
//   pnpm sim:rework-careers -- --tiers=1,5,9     the game's scenarios T to race (default 1–14)
//   pnpm sim:rework-careers -- --coverage-only   skip the win rates
//   pnpm sim:rework-careers -- --write-report    also rewrite packages/domain/src/rework/builds/careers-report.ts, which
//                                                the rework pages' live blocks render (every T; rates only)
//
// Coverage freezes every Uma's career at every T with the rework's `freezeCareer` (today's planner), reading the local,
// gitignored pack as `sim:careers` does, and prints only counts. Win rates use the synthetic builds of harness.ts: a full
// layer at T, every card current-era at 100%, Extra Stats at capacity, against `rollRivalFieldAt` at today's handicaps.
// The targets (03 §12) are every Maiden G3 won, the Trials G2s at 90% or more and the Main G1s at 60–100%, best case; a
// miss is marked and listed, for the owner (docs/open-questions.md). Exit code 1 when a career cannot be frozen, a
// career race falls below her B-or-better aptitudes, or a cell falls under today's 25% floor (D152).
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  CAREER_STAGES,
  CAREER_STAGE_GRADES,
  GRADES,
  careerRaceCatalog,
  goalRaceIds,
  type CareerStage,
  type DistanceCategory,
  type RaceTemplate,
  type Stats,
  type UmaTemplate,
} from '../../packages/domain/src/index'
import { CAREER_TARGETS, meetsCareerTarget } from '../../packages/domain/src/rework/builds/targets'
import type { CareerRow, RateCell } from '../../packages/domain/src/rework/builds/types'
import { emptyBuild, freezeCareer, type CareerSubject, type TierContent } from '../../packages/domain/src/rework/tiers/index'
import { simulateRace } from '../../packages/race/src/index'
import {
  FIELD_STRATEGIES, LONG, PLAYER_KIT, STAYER, STAYER_POWER, goldRecovery, reworkFairShare, reworkStats, reworkTypicalRows, rivalRunnersAt,
  typicalCourse, typicalLines,
} from './harness'

const args = process.argv.slice(2)
const RACES = Number(args.find((value) => /^\d+$/.test(value)) ?? 20)
const CONTENT = args.find((value) => value.startsWith('--content='))?.split('=')[1] ?? 'content/data'
const COVERAGE_ONLY = args.includes('--coverage-only')
const WRITE_REPORT = args.includes('--write-report')
const tiersArg = args.find((value) => value.startsWith('--tiers='))?.split('=')[1]
const SCENARIOS = Array.from({ length: 14 }, (_, index) => index + 1)
const SAMPLED = tiersArg ? tiersArg.split(',').map(Number) : SCENARIOS
/** Run from the repo root, as `pnpm sim:…` does. */
const REPORT = 'packages/domain/src/rework/builds/careers-report.ts'
if (WRITE_REPORT && (tiersArg || COVERAGE_ONLY || process.env.V8 || process.env.BASE_STAMINA || process.env.BASE_GUTS)) {
  console.error('--write-report races every T on the default engine and base stats')
  process.exit(2)
}
let hardFailures = 0

// --- Coverage: every Uma's career at every T, frozen by the rework's rule ------------------------------------------

function readPack<T>(prefix: string): T[] {
  const file = readdirSync(CONTENT).find((name) => name.startsWith(`${prefix}.`) && name.endsWith('.json'))
  if (!file) throw new Error(`No ${prefix} pack in ${CONTENT}; run pnpm data:import or pass --content=<dir>`)
  return (JSON.parse(readFileSync(join(CONTENT, file), 'utf8')) as { items: T[] }).items
}

const races = careerRaceCatalog(readPack<RaceTemplate>('races'))
const umas = readPack<UmaTemplate>('umas')
const content: TierContent = { umas: new Map(umas.map((uma) => [uma.id, uma])), races }
const byId = new Map(races.map((race) => [race.id, race]))
const eligible = (uma: UmaTemplate, race: RaceTemplate) =>
  GRADES.indexOf(uma.aptitudes.surface[race.surface]) <= GRADES.indexOf('B') &&
  GRADES.indexOf(uma.aptitudes.distance[race.distanceCategory]) <= GRADES.indexOf('B')

let careers = 0
let short = 0
let belowB = 0
for (const uma of umas) {
  // A new Uma's subject: no lineage yet, so her career reads her own aptitudes, as the planner does today.
  const subject: CareerSubject = { outfitId: uma.id, raceDefaults: { preferences: null, selectedPreset: 'mile' }, build: emptyBuild(uma.uniqueSkillId) }
  for (const T of SCENARIOS) {
    let journey: ReturnType<typeof freezeCareer>
    try {
      journey = freezeCareer(subject, T, content)
    } catch (error) {
      hardFailures += 1
      console.error(`FAIL career T${T}: ${(error as Error).message}`)
      continue
    }
    careers += 1
    if (journey.goals.filter((goal) => goal.slot === 'main').flatMap(goalRaceIds).length < 3) short += 1
    for (const raceId of journey.goals.flatMap(goalRaceIds)) if (!eligible(uma, byId.get(raceId)!)) belowB += 1
  }
}
console.log(`Careers frozen by the rework's rule: ${careers} of ${umas.length * SCENARIOS.length} (${SCENARIOS.length} scenarios each)`)
console.log(`Fewer than 3 main races: ${short}`)
console.log(`Career races below her B-or-better aptitudes: ${belowB}`)
hardFailures += belowB

// --- Stage win rates on full-layer builds -----------------------------------------------------------------------------

const FLOOR = 25
/** Career goals she has won when she races each stage, for Climax (04 §8): none at her Maiden, one at her Trials. */
const GOALS_WON: Record<CareerStage, number> = { maiden: 0, trials: 1, main: 2 }
type Build = { label: string; stats: (T: number, goalsWon: number) => Stats }
// Today's decks per distance (career-balance.ts), the stamina ladder's sets with the Friend card last or first, and a
// Power card in sprints and miles; as rework builds. Labels are synthetic.
const DECKS: Record<DistanceCategory, { distance: number; golds: number; builds: Build[] }> = {
  sprint: { distance: 1400, golds: 0, builds: [
    { label: 'Stamina set, Speed Extra, Friend last', stats: (T, goalsWon) => reworkStats(T, STAYER, 2, reworkFairShare(T), 'speed', { friend: 'last', goalsWon }) },
    { label: 'Stamina set, Speed Extra', stats: (T, goalsWon) => reworkStats(T, STAYER, 2, reworkFairShare(T), 'speed', { goalsWon }) },
    { label: 'Stamina and Power set, Speed Extra, Friend last', stats: (T, goalsWon) => reworkStats(T, STAYER_POWER, 2, reworkFairShare(T), 'speed', { friend: 'last', goalsWon }) },
  ] },
  mile: { distance: 1600, golds: 0, builds: [
    { label: 'Stamina set, Stamina Extra, Friend last', stats: (T, goalsWon) => reworkStats(T, STAYER, 2, reworkFairShare(T), 'stamina', { friend: 'last', goalsWon }) },
    { label: 'Stamina set, Stamina Extra', stats: (T, goalsWon) => reworkStats(T, STAYER, 2, reworkFairShare(T), 'stamina', { goalsWon }) },
    { label: 'Stamina and Power set, Stamina Extra, Friend last', stats: (T, goalsWon) => reworkStats(T, STAYER_POWER, 2, reworkFairShare(T), 'stamina', { friend: 'last', goalsWon }) },
  ] },
  medium: { distance: 2200, golds: 0, builds: [
    { label: 'Stamina card +1 and Power card, Friend last', stats: (T, goalsWon) => reworkStats(T, STAYER_POWER, 2, reworkFairShare(T) + 1, 'stamina', { first: [3], friend: 'last', goalsWon }) },
    { label: 'Stamina card +1, Friend last', stats: (T, goalsWon) => reworkStats(T, STAYER, 2, reworkFairShare(T) + 1, 'stamina', { friend: 'last', goalsWon }) },
  ] },
  long: { distance: 2500, golds: 1, builds: [
    { label: 'Two Stamina cards, Friend last', stats: (T, goalsWon) => reworkStats(T, LONG, 2, reworkFairShare(T) + 1, 'stamina', { first: [3], friend: 'last', goalsWon }) },
  ] },
}
const CATEGORIES = Object.keys(DECKS) as DistanceCategory[]

/** A stage's race at T: her best of four strategies and the distance's decks (D152), retries free. */
function bestCell(T: number, stage: CareerStage, category: DistanceCategory): RateCell {
  const { distance, golds, builds } = DECKS[category]
  const kit = [...PLAYER_KIT, ...[goldRecovery('gold-a', 60), goldRecovery('gold-b', 40)].slice(0, golds)]
  let best: RateCell = { rate: -1, build: '', strategy: 'pace' }
  for (const build of builds) {
    const stats = build.stats(T, GOALS_WON[stage])
    for (const strategy of FIELD_STRATEGIES) {
      let wins = 0
      for (let race = 0; race < RACES; race += 1) {
        const playerGate = race % 12
        const seed = 7_000_003 * T + race * 7919
        const player = { id: 'player', label: String(playerGate + 1), stats, strategy, gate: playerGate, aptitude: { distance: 'A', surface: 'A', strategy: 'A' } as const, skills: kit }
        const timeline = simulateRace({
          course: typicalCourse(distance),
          seed,
          runners: [...rivalRunnersAt(T, CAREER_STAGE_GRADES[stage], distance, 12, playerGate, seed), player].sort((left, right) => left.gate - right.gate),
        })
        if (timeline.results[0]!.id === 'player') wins += 1
      }
      const rate = Math.round((100 * wins) / RACES)
      if (rate > best.rate) best = { rate, build: build.label, strategy }
    }
  }
  return best
}

const rows: CareerRow[] = []
if (!COVERAGE_ONLY) {
  const targets = CAREER_STAGES.map((stage) => `${stage} ${CAREER_STAGE_GRADES[stage].toUpperCase()} ${CAREER_TARGETS[stage].words}`).join(' · ')
  console.log(`\nStage win rates on rework builds, full layer (best of 4 strategies and the decks per distance, ${RACES} races per cell, 12 runners; floor ${FLOOR}%)`)
  console.log(`Targets (03 §12): ${targets}; * marks a miss`)
  console.log('        maiden G3              trials G2              main G1')
  console.log('        spr  mil  med  lng     spr  mil  med  lng     spr  mil  med  lng')
  const misses: string[] = []
  for (const T of SAMPLED) {
    const stages = {} as Record<CareerStage, Record<DistanceCategory, RateCell>>
    for (const stage of CAREER_STAGES) {
      stages[stage] = {} as Record<DistanceCategory, RateCell>
      for (const category of CATEGORIES) {
        const cell = bestCell(T, stage, category)
        stages[stage][category] = cell
        if (cell.rate < FLOOR) {
          hardFailures += 1
          console.error(`FAIL T${T} ${stage} ${category}: ${cell.rate}%`)
        }
        if (!meetsCareerTarget(stage, cell.rate)) misses.push(`T${T} ${stage} ${category} ${cell.rate}% (target ${CAREER_TARGETS[stage].words})`)
      }
    }
    rows.push({ T, stages })
    const cells = CAREER_STAGES.map((stage) => CATEGORIES.map((category) => {
      const { rate } = stages[stage][category]
      return `${String(rate).padStart(3)}${meetsCareerTarget(stage, rate) ? ' ' : '*'}`
    }).join(' ')).join('    ')
    console.log(`T${String(T).padStart(2)}     ${cells}`)
  }
  console.log(`\nBest-case builds and running styles:`)
  for (const row of rows) {
    for (const stage of CAREER_STAGES) {
      const words = CATEGORIES.map((category) => `${category} ${row.stages[stage][category].build} / ${row.stages[stage][category].strategy}`)
      console.log(`T${String(row.T).padStart(2)} ${stage.padEnd(6)}  ${words.join(' · ')}`)
    }
  }
  console.log(misses.length === 0 ? '\nEvery cell meets its target.' : `\n${misses.length} cell(s) below target:\n  ${misses.join('\n  ')}`)
}

// --- The buffs' typical values (04 §8): what the rivals above carry -------------------------------------------------

console.log(`\n${typicalLines(reworkTypicalRows(SCENARIOS)).join('\n')}`)

if (WRITE_REPORT) {
  writeFileSync(REPORT, [
    '// Generated by `pnpm sim:rework-careers -- --write-report` (scripts/sim/rework-careers.ts, T133). Do not edit: re-run it.',
    `// Each career stage's race on full-layer rework builds against T125's fields, best case, ${RACES} races a cell. Rates and`,
    "// synthetic labels only: nothing from the private packs. The rework pages render it (./docs.ts), so CI needs no engine.",
    "import type { CareersReport } from './types'",
    '',
    'export const CAREERS_REPORT: CareersReport = {',
    `  racesPerCell: ${RACES},`,
    '  rates: [',
    ...rows.map((row) => [`    { T: ${row.T}, stages: {`, ...CAREER_STAGES.map((stage) => `      ${stage}: ${JSON.stringify(row.stages[stage])},`), '    } },'].join('\n')),
    '  ],',
    '}',
    '',
  ].join('\n'))
  console.log(`\nWrote ${REPORT}`)
}

if (hardFailures > 0) {
  console.error(`\n${hardFailures} career check(s) failed`)
  process.exit(1)
}
