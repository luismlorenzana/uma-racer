// No downloads or publishing. Generated originals/rows stay in ignored content/ (D289).
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { exportPuzzlePlaceholders } from './puzzle-placeholders'
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')
const arg = process.argv.find(a => a.startsWith('--content-dir='))?.slice('--content-dir='.length)
void exportPuzzlePlaceholders(resolve(arg ?? `${root}/content`)).then(r => console.log(`Original placeholder export: ${r.members} members. No content published.`))
  .catch(() => { console.error('Original placeholder export failed; retained files were not replaced.'); process.exitCode = 1 })
