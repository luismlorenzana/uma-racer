import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { rpgFixture } from './__fixtures__/rpg'
import { canonicalRpgJson, importRpgPack, validateRpgContent } from './rpg'
import { sha256, writeContentPacks } from './pack'
import { replayPrivateRpgPack } from './rpg-replay'
import { parseRpgChapterPack, type ContentManifest } from '@racer/domain'

const dirs:string[]=[]
afterEach(async()=>{await Promise.all(dirs.splice(0).map(d=>rm(d,{recursive:true,force:true})))})
const fixture=rpgFixture
async function prepare() {
  const dir=await mkdtemp(resolve(tmpdir(),'rpg-private-test-'));dirs.push(dir);await mkdir(resolve(dir,'art/priconne'),{recursive:true})
  // Invented metadata-only VP8X header; native image decoding is separately tested in the asset pipeline.
  const image=Buffer.alloc(30);image.write('RIFF');image.writeUInt32LE(22,4);image.write('WEBPVP8X',8);image.writeUInt32LE(10,16)
  image.writeUIntLE(255,24,3);image.writeUIntLE(255,27,3);const hash=sha256(image)
  const files=fixture().actors.map(a=>({path:`art/priconne/${a.artKey}.${hash.slice(0,8)}.webp`,sha256:hash,bytes:image.length}))
  await Promise.all(files.map(f=>writeFile(resolve(dir,f.path),image)))
  await writeFile(resolve(dir,'manifest.json'),JSON.stringify({version:sha256(files.map(f=>f.sha256).sort().join('')).slice(0,12),
    generatedAt:'2099-01-01',source:Object.fromEntries(fixture().actors.map(a=>[`rpg-art:${a.artKey}`,files.find(f=>f.path.includes(a.artKey+'.'))!.path])),files}))
  return dir
}
describe('private RPG compiler and offline validator',()=>{
  it('imports deterministic bytes and reports only aggregate coverage',async()=>{
    const dir=await prepare(),raw=fixture(),result=await importRpgPack(dir,raw)
    expect(result.packs[0]).toMatchObject({chapters:1,actors:2,portraits:2,phaseActors:1,routeFightCounts:[[2,3]],unresolvedReferences:0})
    const reordered=Object.fromEntries(Object.entries(raw).reverse())
    expect(canonicalRpgJson(reordered)).toBe(canonicalRpgJson(raw))
    expect((await importRpgPack(dir,reordered)).activeHash).toBe(result.activeHash)
    expect(JSON.stringify(result)).not.toContain(raw.actors[0]!.name)
  })
  it('retains earlier packs across reimport and regular data import without deleting their files',async()=>{
    const dir=await prepare(),before=await importRpgPack(dir,fixture()),after=await importRpgPack(dir,fixture('example-v2'))
    expect(after.retainedPacks).toBe(2)
    expect(after.packs.some(p=>p.contentHash===before.activeHash)).toBe(true)
    await writeContentPacks({contentDir:dir,source:{example:'v1'},packs:[{name:'umas',version:'example',items:[{id:'invented'}]}]})
    expect((await validateRpgContent(dir)).retainedPacks).toBe(2)
    expect((await readFile(resolve(dir,`data/rpg-chapters.${before.activeHash.slice(0,8)}.json`),'utf8')).length).toBeGreaterThan(0)
  })
  it('rejects mutable version reuse, corrupt bytes, missing art pins and invalid graph/actions',async()=>{
    const dir=await prepare(),before=await importRpgPack(dir,fixture())
    const changed=fixture();changed.chapters[0]!.title='Changed'
    await expect(importRpgPack(dir,changed)).rejects.toThrow(/immutable/)
    expect((await validateRpgContent(dir)).activeHash).toBe(before.activeHash)
    const invalid=fixture('bad-graph');invalid.chapters[0]!.nodes[0]!.exits=['missing']
    await expect(importRpgPack(dir,invalid)).rejects.toThrow()
    await writeFile(resolve(dir,`data/rpg-chapters.${before.activeHash.slice(0,8)}.json`),'{}')
    await expect(validateRpgContent(dir)).rejects.toThrow(/integrity/)
  })
  it('checks portraits before swapping the catalog and refuses to rewrite a retained image mapping', async()=>{
    const dir=await prepare(),before=await importRpgPack(dir,fixture())
    const path=resolve(dir,'manifest.json'), manifest=JSON.parse(await readFile(path,'utf8')) as ContentManifest
    const original=manifest.files.find(f=>f.path.startsWith('art/priconne/'))!
    await writeFile(resolve(dir,original.path),'broken')
    await expect(importRpgPack(dir,fixture('example-v2'))).rejects.toThrow(/integrity/)
    expect(JSON.parse(await readFile(path,'utf8')).version).toBe(manifest.version)
    // Restore the invented metadata, then add a different valid image with the same key.
    const old=Buffer.alloc(30);old.write('RIFF');old.writeUInt32LE(22,4);old.write('WEBPVP8X',8);old.writeUInt32LE(10,16);old.writeUIntLE(255,24,3);old.writeUIntLE(255,27,3)
    await writeFile(resolve(dir,original.path),old)
    const changed=Buffer.from(old);changed[20]=16
    const hash=sha256(changed), key=fixture().actors[0]!.artKey, newPath=`art/priconne/${key}.${hash.slice(0,8)}.webp`
    await writeFile(resolve(dir,newPath),changed);manifest.files.push({path:newPath,sha256:hash,bytes:changed.length});manifest.source[`rpg-art:${key}`]=newPath
    manifest.version=sha256(manifest.files.map((f:{sha256:string})=>f.sha256).sort().join('')).slice(0,12);await writeFile(path,JSON.stringify(manifest))
    await expect(importRpgPack(dir,fixture())).rejects.toThrow(/portrait mapping/)
    expect((await validateRpgContent(dir)).activeHash).toBe(before.activeHash)
    expect((await importRpgPack(dir,fixture('example-v2'))).retainedPacks).toBe(2)
  })
  it('rejects hashed non-WebP portraits and probes live versus restored combat without a network', async()=>{
    const dir=await prepare(),path=resolve(dir,'manifest.json'),manifest=JSON.parse(await readFile(path,'utf8')) as ContentManifest
    const entry=manifest.files[0]!,image=Buffer.from('not a valid image'),hash=sha256(image),key=fixture().actors[0]!.artKey
    entry.path=`art/priconne/${key}.${hash.slice(0,8)}.webp`;entry.sha256=hash;entry.bytes=image.length
    manifest.source[`rpg-art:${key}`]=entry.path;manifest.version=sha256(manifest.files.map((f:{sha256:string})=>f.sha256).sort().join('')).slice(0,12)
    await writeFile(resolve(dir,entry.path),image);await writeFile(path,JSON.stringify(manifest))
    await expect(importRpgPack(dir,fixture())).rejects.toThrow(/WebP/)
    const pack=parseRpgChapterPack(fixture(),{version:'example-v1',contentHash:'a'.repeat(64),artKeys:fixture().actors.map(a=>a.artKey)})
    const result=replayPrivateRpgPack(pack)
    expect(result.clears).toBe(result.routes);expect(result.hashChecks).toBe(result.fights)
    expect(result.routes).toBe(6)
  })
})
