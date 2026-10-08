// Local-only RPG compilation/validation; logs aggregates, never private rows or URLs.
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { DEFAULT_CONTENT_DIR } from './pack'
import { importRpgPack, validateRpgContent } from './rpg'
const arg = (name: string) => process.argv.find(v => v.startsWith(`${name}=`))?.slice(name.length + 1)
async function main() {
  const contentDir = resolve(arg('--content-dir') ?? DEFAULT_CONTENT_DIR)
  const result = process.argv.includes('--import')
    ? await importRpgPack(contentDir, JSON.parse(await readFile(resolve(arg('--input') ?? `${contentDir}/overrides/rpg-chapters.json`), 'utf8')) as unknown)
    : await validateRpgContent(contentDir)
  console.log(JSON.stringify(result, null, 2))
}
void main().catch(() => { console.error('RPG validation/import failed. Check private source, graph, art pins and retained object integrity. No content was published.'); process.exitCode = 1 })
