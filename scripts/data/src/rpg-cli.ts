// Local-only RPG compilation/validation; logs aggregates, never private rows or URLs.
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { DEFAULT_CONTENT_DIR } from './pack'
import { importRpgPack, validateRpgContent } from './rpg'
import { parseRpgChapterPack, parseRpgContentCatalog } from '@racer/domain'
import { readRpgManifest, RPG_CATALOG_PATH } from './rpg'
import { replayPrivateRpgPack } from './rpg-replay'
const arg = (name: string) => process.argv.find(v => v.startsWith(`${name}=`))?.slice(name.length + 1)
async function main() {
  const contentDir = resolve(arg('--content-dir') ?? DEFAULT_CONTENT_DIR)
  const result = process.argv.includes('--import')
    ? await importRpgPack(contentDir, JSON.parse(await readFile(resolve(arg('--input') ?? `${contentDir}/overrides/rpg-chapters.json`), 'utf8')) as unknown)
    : await validateRpgContent(contentDir)
  console.log(JSON.stringify(result, null, 2))
  if (process.argv.includes('--replay')) {
    const manifest=await readRpgManifest(contentDir)
    const file=manifest.files.find(f=>RPG_CATALOG_PATH.test(f.path))!
    const catalog=parseRpgContentCatalog(JSON.parse(await readFile(resolve(contentDir,file.path),'utf8')) as unknown,manifest.files)
    const reference=catalog.packs.find(p=>p.sha256===catalog.activeHash)!
    const pack=parseRpgChapterPack(JSON.parse(await readFile(resolve(contentDir,reference.path),'utf8')) as unknown,
      {version:reference.version,contentHash:reference.sha256,artKeys:reference.art.map(a=>a.key)})
    const replay=replayPrivateRpgPack(pack);console.log(JSON.stringify(replay,null,2))
    if(!replay.routes||replay.clears!==replay.routes||replay.phaseShifts<replay.clears) throw new Error('Private chapter probe did not clear every route/phase')
  }
}
void main().catch(() => { console.error('RPG validation/import failed. Check private source, graph, positive EXP, phase kits, art pins and retained object integrity. No content was published.'); process.exitCode = 1 })
