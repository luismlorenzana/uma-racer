// Reviewed inputs only; never accesses Fandom or publishes (docs/technical/puzzle-content.md).
import { readFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { importPuzzleAtlas } from './puzzles'
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')
const arg = (name: string) => process.argv.find(a => a.startsWith(`${name}=`))?.slice(name.length + 1)
async function main() {
  const dir = resolve(arg('--content-dir') ?? `${root}/content`)
  console.log(JSON.stringify(await importPuzzleAtlas({ contentDir: dir, cacheDir: resolve(arg('--cache-dir') ?? `${root}/scripts/assets/.cache/puzzles`),
    raw: JSON.parse(await readFile(resolve(arg('--input') ?? `${dir}/overrides/puzzles-cast.json`), 'utf8')) as unknown,
    evidence: JSON.parse(await readFile(resolve(arg('--evidence') ?? `${dir}/overrides/puzzles-source-evidence.json`), 'utf8')) as unknown,
    offline: process.argv.includes('--offline') })))
}
void main().catch(() => { console.error('Uma Puzzles atlas import failed. Reviewed permitted sources, exact hashes and transparent art are required. No content was published.'); process.exitCode = 1 })
