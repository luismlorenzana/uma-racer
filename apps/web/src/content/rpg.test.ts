import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { syntheticChapterJson } from '../../../../packages/domain/src/rpg/chapter.synthetic'
import { loadRpgChapterPack, RpgContentLibrary } from './rpg'
import type { LoadedContent } from './runtime'
const bytes = new TextEncoder().encode(JSON.stringify(syntheticChapterJson())).buffer as ArrayBuffer
const sha256 = createHash('sha256').update(new Uint8Array(bytes)).digest('hex')
const file = { path: `data/rpg-chapters.${sha256.slice(0, 8)}.json`, sha256, bytes: bytes.byteLength }
const content = { manifest: { files: [file, ...['test-scout', 'test-elite', 'test-captain', 'test-wall'].map((id) => ({
  path: `art/priconne/${id}.12345678.webp`, sha256: 'b'.repeat(64), bytes: 1 }))] } } as LoadedContent
const transport = { manifest: async () => null, file: async () => ({ bytes, contentType: 'application/json' }) }
describe('lazy private RPG content', () => {
  it('returns unavailable, not a synthetic fallback, when the manifest has no chapter pack', async () => {
    expect(await loadRpgChapterPack({ manifest: { files: [] } } as unknown as LoadedContent, transport)).toBeNull()
  })
  it('verifies bytes/hash and binds chapter and portrait references', async () => {
    expect((await loadRpgChapterPack(content, transport))?.chapters[0]?.contentHash).toBe(sha256)
  })
  it('rejects drifted bytes, missing art and ambiguous packs', async () => {
    await expect(loadRpgChapterPack(content, { ...transport, file: async () => ({ bytes: new Uint8Array(bytes.byteLength).buffer, contentType: 'application/json' }) })).rejects.toThrow(/hash/)
    await expect(loadRpgChapterPack({ ...content, manifest: { ...content.manifest, files: [file] } }, transport)).rejects.toThrow(/art/)
    await expect(loadRpgChapterPack({ ...content, manifest: { ...content.manifest, files: [file, file] } }, transport)).rejects.toThrow(/ambiguous/)
  })
  it('loads the exact retained chapter and portrait after an active-version change; missing old content never rerolls', async () => {
    const objects=new Map<string,ArrayBuffer>(), files:LoadedContent['manifest']['files']=[]
    const add=(pathPrefix:string,value:unknown)=>{
      const bytes=new TextEncoder().encode(JSON.stringify(value)).buffer as ArrayBuffer
      const sha256=createHash('sha256').update(new Uint8Array(bytes)).digest('hex'),path=`${pathPrefix}.${sha256.slice(0,8)}.json`
      files.push({path,sha256,bytes:bytes.byteLength});objects.set(path,bytes);return {path,sha256}
    }
    const references=['invented-old','invented-new'].map((version,i)=>{
      const raw=syntheticChapterJson();raw.version=version;raw.chapters=raw.chapters.slice(0,1);raw.chapters[0]!.contentVersion=version
      raw.actors[0]!.name=i?'New scout':'Old scout'
      const pack=add('data/rpg-chapters',raw), art=raw.actors.map(actor=>{
        const sha256=(i?'d':'c').repeat(64),path=`art/priconne/${actor.artKey}.${sha256.slice(0,8)}.webp`
        files.push({path,sha256,bytes:1});return {key:actor.artKey,path}
      })
      return {...pack,version,art}
    })
    const catalog={schemaVersion:1,activeHash:references[1]!.sha256,packs:references}, catalogFile=add('data/rpg-catalog',catalog)
    const source={manifest:{files}} as LoadedContent
    const requests:string[]=[]
    let fail=false
    const transport={manifest:async()=>null,file:async(path:string)=>{requests.push(path);if(fail)throw new Error('Offline');return {bytes:objects.get(path)!,contentType:'application/json'}}}
    const library=new RpgContentLibrary(source,transport),old={contentVersion:references[0]!.version,contentHash:references[0]!.sha256}
    expect((await library.load())?.actors[0]?.name).toBe('New scout')
    expect((await library.load(old))?.actors[0]?.name).toBe('Old scout')
    expect((await library.presentation(old)).portraits['test-scout']).toBe('test-scout-cccccccc')
    expect((await library.presentation({contentVersion:references[1]!.version,contentHash:references[1]!.sha256})).portraits['test-scout']).toBe('test-scout-dddddddd')
    expect(requests.filter(path=>path===catalogFile.path)).toHaveLength(1)
    await expect(library.load({...old,contentVersion:'wrong-version'})).rejects.toThrow(/not retained/)
    await expect(library.load({...old,contentHash:'e'.repeat(64)})).rejects.toThrow(/not retained/)
    expect(requests.some(path=>path.startsWith('art/'))).toBe(false)
    const retry=new RpgContentLibrary(source,transport);fail=true
    await expect(retry.load(old)).rejects.toThrow('Offline');fail=false
    expect((await retry.load(old))?.version).toBe(old.contentVersion)
  })
  it('rejects wrong JSON MIME before parsing source rows',async()=>{
    await expect(loadRpgChapterPack(content,{...transport,file:async()=>({bytes,contentType:'text/html'})})).rejects.toThrow(/type/)
  })
})
