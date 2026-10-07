// Filters keep economy work independent of the slower public-action combat bots.
import { runPuzzleEconomy } from './puzzles-economy'
import { runPuzzleCampaignCombat } from './puzzles-campaign-combat'
const args = process.argv.slice(2)
if (args.some(a => !['--combat', '--economy'].includes(a))) throw new Error('Use --combat or --economy (or neither for all)')
if (!args.length || args.includes('--economy')) runPuzzleEconomy()
if (!args.length || args.includes('--combat')) {
  // Preserve T107's288-battle/hash envelope unchanged. The scripts tree uses CommonJS tsx output.
  void import('./puzzles-combat').then(() => runPuzzleCampaignCombat()).catch(error => { console.error(error); process.exitCode = 1 })
}
