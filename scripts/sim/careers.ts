// `pnpm sim:careers` (docs/game/12-pacing.md, D383): every Uma's URA Finale career played once at grade A by the
// allocation bot, with a median and a strong bonded deck, raced on the real engine. It prints first-try win rates by
// grade and URA Finals round, the pacing, and the typical career's average stat by season (what the rivals' season
// shares are set from), and fails when a target drifts.
//
//   pnpm sim:careers                     the private pack when it is present locally, else the invented content
//   pnpm sim:careers -- --synthetic      the invented content only (what CI runs)
//   pnpm sim:careers -- --attempts=5     races per objective and URA Finals round (default 3)
//   pnpm sim:careers -- --umas=40        the first n Umas only (a quick look; the targets still apply)
//
// The private pack is read from MASTER_DIR, else ../uma-platform/content/release beside the repository, with the
// racer's overlay from CONTENT_DIR (else ./content) when present. Only aggregates are printed: never an Uma, card,
// skill or race id, name or value. It runs on @racer/overlays' tsx, so CI needs no download; `test` and `test:ci` run
// it on the invented content.
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  INVENTED_TARGETS, simulateCareers, syntheticCareerContent, tallyRate, type CareerSimContent, type CareerSimReport,
} from '../../packages/domain/src/career/index'
import { simulateRace } from '../../packages/race/src/index'

const ROOT = process.env.INIT_CWD ?? process.cwd() // where `pnpm sim:careers` was run: the repository's root
const args = process.argv.slice(2)
const option = (name: string): string | undefined => args.find((arg) => arg.startsWith(`--${name}=`))?.split('=')[1]
const ATTEMPTS = Number(option('attempts') ?? 3)
const UMAS = option('umas') === undefined ? null : Number(option('umas'))

async function privatePack(): Promise<CareerSimContent | null> {
  const dir = resolve(process.env.MASTER_DIR ?? resolve(ROOT, '../uma-platform/content/release'))
  if (!existsSync(resolve(dir, 'manifest.json'))) return null
  const { localRelease, authoringOverlay } = await import('../overlays/src/local')
  const { adaptMaster } = await import('../../packages/domain/src/master/index')
  const master = await localRelease(dir).load()
  const contentDir = resolve(process.env.CONTENT_DIR ?? resolve(ROOT, 'content'))
  const overlay = existsSync(resolve(contentDir, 'overrides', 'flair.json')) ? await authoringOverlay(contentDir) : null
  const { content } = adaptMaster(master.data, overlay)
  return { ...content, contentVersion: `${master.manifest.version}:${overlay === null ? 'no-overlay' : 'overlay'}` }
}

function print(source: string, report: CareerSimReport, seconds: number): void {
  const pct = (n: number) => `${(n * 100).toFixed(1)}%`.padStart(6)
  console.log(`\nT${report.T} · ${source}: ${report.umas} Umas, ${ATTEMPTS} first tries a race, ${seconds.toFixed(0)} s`)
  console.log('deck      G3     G2     G1   qual   semi  final   tree  bond80  skills  golds')
  for (const deck of report.decks) {
    const r = deck.rates
    const cells = [r.g3, r.g2, r.g1, r.qualifier, r.semifinal, r.final].map((tally) => pct(tallyRate(tally))).join(' ')
    console.log(`${deck.label.padEnd(7)} ${cells} ${pct(deck.tree)}  ${deck.bonded.toFixed(2).padStart(5)}  ${deck.skills.toFixed(2).padStart(6)}  ${deck.goldSkills.toFixed(2).padStart(5)}`)
  }
  console.log(`(skills: racing skills the bot bought; golds: SP earned ÷ a gold with its white, ${report.goldPairPrice} SP)`)
  for (const deck of report.decks) {
    const sp = deck.spParts
    console.log(`${deck.label} SP ${deck.spEarned.toFixed(0)}: stages and races ${sp.wallet.toFixed(0)}, tree ${sp.tree.toFixed(0)}, deck ${sp.deck.toFixed(0)}, hints ${sp.hints.toFixed(0)}`)
  }
  const median = report.decks.find((deck) => deck.label === 'median')
  if (median?.replayTree != null) console.log(`one replay of each season's play: ${pct(median.replayTree)} of the tree`)
  for (const deck of report.decks) {
    const end = deck.curve[deck.curve.length - 1]!
    console.log(`${deck.label} average stat by season: ${deck.curve.map((value) => value.toFixed(0)).join(' ')}`)
    console.log(`${deck.label} share of the Finale's: ${deck.curve.map((value) => (value / end).toFixed(3)).join(' ')}`)
  }
}

async function main(): Promise<void> {
  const synthetic = args.includes('--synthetic')
  const pack = synthetic ? null : await privatePack()
  const source = pack === null ? 'invented content' : 'private pack'
  const content = pack ?? syntheticCareerContent()
  const started = performance.now()
  const report = simulateCareers(content, {
    attempts: ATTEMPTS, race: { version: 9, simulate: simulateRace }, replay: true, ...(UMAS === null ? {} : { sample: UMAS }),
    ...(pack === null ? { targets: INVENTED_TARGETS } : {}),
  })
  print(source, report, (performance.now() - started) / 1000)
  for (const failure of report.failures) console.log(`FAIL ${failure}`)
  if (report.failures.length > 0) process.exitCode = 1
  else console.log('\nThe targets hold.')
}

void main()
