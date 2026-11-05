// `pnpm sim:decks` (docs/game/05-the-build.md "Keeping it balanced", D382): each scenario's full tree with an empty, a
// median bonded and a strong bonded deck, as shares of the cap budget, failing when the bands drift.
//
//   pnpm sim:decks                 the private pack when it is present locally, else the invented cards
//   pnpm sim:decks -- --synthetic  the invented cards only (what CI checks through the domain's tests)
//
// The private pack is read from MASTER_DIR, else ../uma-platform/content/release beside the repository. Only aggregate
// shares are printed: never a card id, a name or a value.
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { simulateDecks, syntheticCards, syntheticUmas, type DeckSimReport, type SimUma } from '../../packages/domain/src/build/index'
import type { SupportCardTemplate } from '../../packages/domain/src/content'

const SCENARIOS = [1] // each scenario joins once its session scale is set (D382)
const ROOT = process.cwd() // `pnpm sim:decks` runs at the repository's root

async function privatePack(): Promise<{ cards: SupportCardTemplate[]; umas: SimUma[] } | null> {
  const dir = resolve(process.env.MASTER_DIR ?? resolve(ROOT, '../uma-platform/content/release'))
  if (!existsSync(resolve(dir, 'manifest.json'))) return null
  const { localRelease } = await import('../overlays/src/local')
  const { adaptMaster } = await import('../../packages/domain/src/master/index')
  const master = await localRelease(dir).load()
  const { content } = adaptMaster(master.data, null)
  return { cards: content.cards, umas: content.umas }
}

function print(source: string, report: DeckSimReport): void {
  const pct = (n: number) => `${(n * 100).toFixed(1)}%`.padStart(6)
  console.log(`\nT${report.T} · ${source}: ${report.cards} cards allowed, ${report.umas} Umas, 100 sessions each`)
  console.log('deck     mean    min    max   stats capped (mean)  all five capped')
  for (const line of report.lines) {
    console.log(`${line.label.padEnd(7)} ${pct(line.mean)} ${pct(line.min)} ${pct(line.max)}   ${line.cappedMean.toFixed(2).padStart(4)}                 ${line.allCapped}`)
  }
}

async function main(): Promise<void> {
  const synthetic = process.argv.includes('--synthetic')
  const pack = synthetic ? null : await privatePack()
  const source = pack === null ? 'invented cards' : 'private pack'
  const cards = pack?.cards ?? syntheticCards()
  const umas = pack?.umas ?? syntheticUmas()
  let failed = false
  for (const T of SCENARIOS) {
    const report = simulateDecks(cards, umas, T)
    print(source, report)
    for (const failure of report.failures) console.log(`FAIL ${failure}`)
    failed ||= report.failures.length > 0
  }
  if (failed) process.exitCode = 1
  else console.log('\nThe bands hold.')
}

void main()
