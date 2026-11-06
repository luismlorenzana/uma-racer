// `pnpm sim:stages` (docs/game/07-stages.md §6, D384, D385): every built mini-game's three bots over 500 seeds each,
// graded by the framework, and failing unless the bands hold: the competent bot's median at A, the novice's at C or B,
// the expert at S on 35–65% of seeds, a play of 3–7 minutes at a human pace (Furlong Hand 3.5–6.5), and the competent
// bot's drills over at least three colours.
//
//   pnpm sim:stages                     the private pack when it is present locally, else the invented content
//   pnpm sim:stages -- --synthetic      the invented content only
//   pnpm sim:stages -- --seeds=200      seeds per bot (default 500)
//   pnpm sim:stages -- --kind=training-yard
//
// The configs are a typical career's (`stageSimConfig`): each Uma in turn, each season's focus (the Yard) or each of her
// objectives and her URA Finals (Furlong Hand), and the median deck with 0–3 of its cards at bond 80. The private pack is read from MASTER_DIR, else ../uma-platform/content/release beside the
// repository. Only aggregates are printed: never an Uma, card or value.
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { syntheticCards } from '../../packages/domain/src/build/decks'
import { syntheticCareerUmas, syntheticCourses, syntheticRaces, syntheticSkills } from '../../packages/domain/src/career/synthetic'
import {
  registeredStages, simulateStage, stageRules, stageSimConfig, type StageSimContent, type StageSimReport,
} from '../../packages/domain/src/stages/index'

const ROOT = process.env.INIT_CWD ?? process.cwd() // where `pnpm sim:stages` was run: the repository's root
const args = process.argv.slice(2)
const option = (name: string): string | undefined => args.find((arg) => arg.startsWith(`--${name}=`))?.split('=')[1]
const SEEDS = Number(option('seeds') ?? 500)
const KIND = option('kind')

async function privatePack(): Promise<StageSimContent | null> {
  const dir = resolve(process.env.MASTER_DIR ?? resolve(ROOT, '../uma-platform/content/release'))
  if (!existsSync(resolve(dir, 'manifest.json'))) return null
  const { localRelease } = await import('../overlays/src/local')
  const { adaptMaster } = await import('../../packages/domain/src/master/index')
  const master = await localRelease(dir).load()
  const { content } = adaptMaster(master.data, null)
  return { umas: content.umas, cards: content.cards, races: content.races, courses: content.courses, skills: content.skills }
}

function print(source: string, report: StageSimReport, seconds: number): void {
  const pct = (n: number) => `${(n * 100).toFixed(1)}%`.padStart(6)
  console.log(`\n${report.name} · ${source}: ${report.seeds} seeds a bot, ${seconds.toFixed(1)} s`)
  console.log('bot         median p  grade    D     C     B     A     S   all tasks  median score  median moves')
  for (const line of report.lines) {
    const grades = (['D', 'C', 'B', 'A', 'S'] as const).map((g) => String(line.grades[g]).padStart(5)).join(' ')
    console.log(`${line.level.padEnd(10)}  ${line.medianP.toFixed(3).padStart(8)}  ${line.medianGrade.padStart(5)}  ${grades}  ${pct(line.allTasks / line.plays).padStart(9)}  ${String(line.medianScore).padStart(12)}  ${String(line.medianMoves).padStart(12)}`)
  }
  const expert = report.lines.find((line) => line.level === 'expert')!
  console.log(`expert S on ${pct(expert.sShare).trim()} of seeds; a play runs ${report.minutes.toFixed(1)} minutes at a human pace (band ${report.band.min}–${report.band.max})`)
  const competent = report.lines.find((line) => line.level === 'competent')!
  console.log(`the competent bot's drills split over ${competent.medianColours} colours (a tenth or more each; at least 3)`)
  for (const group of report.groups) {
    console.log(`  competent, ${group.label.padEnd(7)} ${String(group.plays).padStart(4)} plays  median p ${group.medianP.toFixed(3)}  ${String(group.medianMoves).padStart(4)} moves, ${group.minutes.toFixed(1)} minutes`)
  }
}

async function main(): Promise<void> {
  const synthetic = args.includes('--synthetic')
  const pack = synthetic ? null : await privatePack()
  const source = pack === null ? 'invented content' : 'private pack'
  const content: StageSimContent = pack ?? {
    umas: syntheticCareerUmas(), cards: syntheticCards(), races: syntheticRaces(), courses: syntheticCourses(), skills: syntheticSkills(),
  }
  let failed = false
  for (const kind of registeredStages().filter((each) => KIND === undefined || each === KIND)) {
    const rules = stageRules(kind)!
    const started = performance.now()
    const report = simulateStage(rules, stageSimConfig(kind, content), SEEDS)
    print(source, report, (performance.now() - started) / 1000)
    for (const failure of report.failures) console.log(`FAIL ${failure}`)
    failed ||= report.failures.length > 0
  }
  if (failed) process.exitCode = 1
  else console.log('\nThe bands hold.')
}

void main()
