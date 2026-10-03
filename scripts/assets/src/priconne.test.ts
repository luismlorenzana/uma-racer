import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import sharp from 'sharp'
import { afterEach, describe, expect, it } from 'vitest'
import { importRpgPortraits, verifyRpgSources } from './priconne'
import type { ContentManifest } from '@racer/domain'

// Entirely invented characters, URLs and combat rows. No network or extracted art.
function fixture() {
  const source={characterId:'example',pageUrl:'https://priconne-redive.jp/character/example/',
    portraitUrl:'https://images.microcms-assets.io/assets/invented.png',variant:'Invented pose',attribution:'Synthetic fixture',verifiedAt:'2099-01-01T00:00:00.000Z'}
  const actor={id:'example',name:'Invented captain',role:'Ward',artKey:'example',source,combat:{id:'example',element:'fire',
    stats:{speed:10,stamina:10,power:10,guts:10,wit:10,atk:10,matk:10,initiative:10,pdef:10,mdef:10,dexterity:10,hp:100,mp:10},moves:[{id:'poke',kind:'damage',channel:'physical',element:null,power:10,target:'front',intentText:'Invented poke'}]}}
  return {schemaVersion:2,version:'example-v1',actors:[actor],chapters:[{id:'example-chapter',scenarioId:'ura-finale',title:'Invented chapter',contentVersion:'example-v1',surface:'turf',distance:'medium',
    recommendedTier:1,recommendedLevel:1,startNodeId:'boss',bossNodeId:'boss',nodes:[{id:'boss',kind:'boss',name:'Invented boss',detail:'Invented detail',enemies:['example'],exits:[],baseExp:100}]}]}
}
const evidence=()=>({schemaVersion:1,pages:[{pageUrl:fixture().actors[0]!.source.pageUrl,portraitUrls:[fixture().actors[0]!.source.portraitUrl]}]})
const dirs:string[]=[]
afterEach(async()=>{await Promise.all(dirs.splice(0).map(d=>rm(d,{recursive:true,force:true})))})
async function options() {
  const dir=await mkdtemp(resolve(tmpdir(),'rpg-art-test-'));dirs.push(dir)
  return {contentDir:resolve(dir,'content'),cacheDir:resolve(dir,'cache'),raw:fixture(),evidence:evidence()}
}
describe('private curated PriConne portrait import',()=>{
  it('requires official-page evidence for the selected variant and safe provenance',()=>{
    expect(verifyRpgSources(fixture(),evidence()).actors).toHaveLength(1)
    expect(()=>verifyRpgSources(fixture(),{schemaVersion:1,pages:[]})).toThrow(/verified/)
    const bad=fixture();bad.actors[0]!.source.portraitUrl='https://evil.example/image.png'
    expect(()=>verifyRpgSources(bad,evidence())).toThrow()
    expect(()=>verifyRpgSources(fixture(),{schemaVersion:1,pages:[{pageUrl:1,portraitUrls:[]}]})).toThrow(/evidence/)
  })
  it('decodes invented pixels, normalizes 256px WebP, caches offline and retains older image bytes',async()=>{
    const opts=await options(),png=await sharp({create:{width:12,height:18,channels:4,background:'#123456'}}).png().toBuffer()
    let calls=0
    const fetcher:typeof fetch=async()=>{calls++;return new Response(new Uint8Array(png),{headers:{'content-type':'image/png'}})}
    expect(await importRpgPortraits({...opts,fetcher})).toMatchObject({portraits:1,cacheHits:0,unresolvedReferences:0})
    const before=JSON.parse(await readFile(resolve(opts.contentDir,'manifest.json'),'utf8')) as ContentManifest
    const path=before.source['rpg-art:example']!
    expect(await sharp(await readFile(resolve(opts.contentDir,path))).metadata()).toMatchObject({format:'webp',width:256,height:256})
    expect(await importRpgPortraits({...opts,offline:true,fetcher:async()=>{throw new Error('No network')}})).toMatchObject({cacheHits:1})
    expect(calls).toBe(1)
    opts.raw.actors[0]!.source.portraitUrl='https://images.microcms-assets.io/assets/invented-second.png'
    opts.evidence.pages[0]!.portraitUrls=[opts.raw.actors[0]!.source.portraitUrl]
    const other=await sharp({create:{width:12,height:18,channels:4,background:'#654321'}}).png().toBuffer()
    await importRpgPortraits({...opts,fetcher:async()=>new Response(new Uint8Array(other),{headers:{'content-type':'image/png'}})})
    const after=JSON.parse(await readFile(resolve(opts.contentDir,'manifest.json'),'utf8')) as ContentManifest
    expect(after.files).toHaveLength(2);expect(after.source['rpg-art:example']).not.toBe(path)
    expect(await readFile(resolve(opts.contentDir,path))).toEqual(await readFile(resolve(opts.contentDir,before.files[0]!.path)))
  })
  it('fails visibly on an offline cache miss or an undecodable image, without a manifest swap',async()=>{
    const opts=await options()
    await expect(importRpgPortraits({...opts,offline:true})).rejects.toThrow(/offline/)
    await expect(importRpgPortraits({...opts,fetcher:async()=>new Response('invented not pixels',{headers:{'content-type':'image/png'}})})).rejects.toThrow()
    await expect(readFile(resolve(opts.contentDir,'manifest.json'))).rejects.toThrow()
  })
})
