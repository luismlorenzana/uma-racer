// Owner-run private import; never publishes and reports only aggregate image coverage.
import { readFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { importRpgPortraits } from './priconne'
const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')
const arg = (name: string) => process.argv.find(v => v.startsWith(`${name}=`))?.slice(name.length + 1)
async function main() {
  const contentDir = resolve(arg('--content-dir') ?? `${repoRoot}/content`)
  const raw: unknown = JSON.parse(await readFile(resolve(arg('--input') ?? `${contentDir}/overrides/rpg-chapters.json`), 'utf8'))
  const evidence: unknown = JSON.parse(await readFile(resolve(arg('--evidence') ?? `${contentDir}/overrides/rpg-source-evidence.json`), 'utf8'))
  console.log(JSON.stringify(await importRpgPortraits({ contentDir, raw, evidence, offline: process.argv.includes('--offline'),
    cacheDir: resolve(arg('--cache-dir') ?? `${repoRoot}/scripts/assets/.cache`) })))
}
void main().catch(() => { console.error('Private RPG portrait import failed. Verify official-page evidence, exact variants and cached/downloaded image validity. No content was published.'); process.exitCode = 1 })
