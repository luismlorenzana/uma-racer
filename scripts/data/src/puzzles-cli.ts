// Aggregate-only private validation; no publication or credentials (docs/technical/puzzle-content.md).
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { DEFAULT_CONTENT_DIR } from './pack'
import { importPuzzlePack, validatePuzzleContent } from './puzzles'
const arg = (name: string) => process.argv.find(a => a.startsWith(`${name}=`))?.slice(name.length + 1)
async function main() {
  const dir = resolve(arg('--content-dir') ?? DEFAULT_CONTENT_DIR)
  console.log(JSON.stringify(process.argv.includes('--import')
    ? await importPuzzlePack(dir, JSON.parse(await readFile(resolve(arg('--input') ?? `${dir}/overrides/puzzles-cast.json`), 'utf8')) as unknown)
    : await validatePuzzleContent(dir)))
}
void main().catch(() => { console.error('Uma Puzzles content unavailable. Verify reviewed private cast, source atlas and retained hashes. No content was published.'); process.exitCode = 1 })
