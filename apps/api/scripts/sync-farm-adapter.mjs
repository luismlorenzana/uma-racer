// Mechanical source mirror only. Normal API deploys never import workspace TypeScript.
// node apps/api/scripts/sync-farm-adapter.mjs [--check]; no private data or generated content.
import { readFile, readdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
const api = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const source = resolve(api, '../../packages/domain/src/farm/kitchen'), target = resolve(api, 'src/save/farm-domain/farm/kitchen')
const names = (await readdir(source)).filter(n => n.endsWith('.ts') && !n.endsWith('.test.ts') && !n.endsWith('-fixtures.ts')).sort()
for (const name of names) {
  const body = await readFile(resolve(source, name), 'utf8'), output = resolve(target, name)
  if (process.argv.includes('--check')) {
    if (await readFile(output, 'utf8') !== body) throw new Error(`Stale standalone Farm adapter ${name}`)
  } else await writeFile(output, body)
}
if (JSON.stringify((await readdir(target)).sort()) !== JSON.stringify(names)) throw new Error('Unexpected Farm adapter module; keep fixtures out of production')
console.log(`Standalone Farm adapter ${process.argv.includes('--check') ? 'verified' : 'generated'}: ${names.length} pure TypeScript modules`)
