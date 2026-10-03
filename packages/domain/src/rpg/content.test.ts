import { describe, expect, it } from 'vitest'
import { syntheticChapterJson } from './chapter.synthetic'
import { isRpgCharacterSource, parseRpgChapterPack } from './chapter'
import { assertProductionRpgPack, parseRpgContentCatalog } from './content'

const hash = 'a'.repeat(64), artHash = 'b'.repeat(64)
const reference = { version: 'example-v1', sha256: hash, path: `data/rpg-chapters.${hash.slice(0,8)}.json`, art: [{key:'example',path:`art/priconne/example.${artHash.slice(0,8)}.webp`}] }
const files = [{path:reference.path,sha256:hash,bytes:1},{path:reference.art[0]!.path,sha256:artHash,bytes:1}]
const source = { characterId:'example',pageUrl:'https://priconne-redive.jp/character/example/',portraitUrl:'https://images.microcms-assets.io/assets/example.png',
  variant:'Invented fantasy pose',attribution:'Synthetic source attribution',verifiedAt:'2099-01-01T00:00:00.000Z' }
function raw() {
  const json = syntheticChapterJson()
  return {...json,schemaVersion:2,chapters:json.chapters.slice(0,1),actors:json.actors.map(a=>({...a,source}))}
}
const parse = (json: unknown) => parseRpgChapterPack(json,{version:'invented-map-v1',contentHash:hash,artKeys:syntheticChapterJson().actors.map(a=>a.artKey)})
describe('private RPG content contracts', () => {
  it('validates source and v2 while leaving legacy v1 replay parsing intact', () => {
    expect(isRpgCharacterSource(source)).toBe(true)
    expect(parse(raw()).schemaVersion).toBe(2)
    expect(parse(syntheticChapterJson()).schemaVersion).toBe(1)
    expect(() => assertProductionRpgPack(parse(raw()))).not.toThrow()
  })
  it.each([{...source,pageUrl:'https://evil.example/character/example/'},{...source,portraitUrl:'javascript:alert(1)'},
    {...source,portraitUrl:'https://images.microcms-assets.io.evil.example/a.png'},{...source,characterId:'missing'},
    {...source,attribution:''},{...source,verifiedAt:'tomorrow'},
    {...source,pageUrl:'https://user:pass@priconne-redive.jp/character/example/'}])('rejects unsupported or missing provenance %#', value => {
    expect(isRpgCharacterSource(value)).toBe(false)
    expect(()=>parse({...raw(),actors:raw().actors.map(a=>({...a,source:value}))})).toThrow()
  })
  it('requires real EXP and a mechanically changed boss phase for publication', () => {
    const noExp=raw();delete noExp.chapters[0]!.nodes[0]!.baseExp
    expect(()=>assertProductionRpgPack(parse(noExp))).toThrow(/EXP/)
    const noPhase=raw();delete noPhase.actors.find(a=>a.combat.phaseTwo)!.combat.phaseTwo
    expect(()=>assertProductionRpgPack(parse(noPhase))).toThrow(/phase/)
    const cosmetic=raw(), boss=cosmetic.actors.find(a=>a.combat.phaseTwo)!
    boss.combat.phaseTwo!.moves=boss.combat.moves.map((m,i)=>({...m,id:`different-${i}`,intentText:'Different words'}))
    expect(()=>assertProductionRpgPack(parse(cosmetic))).toThrow(/phase/)
  })
  it('binds retained pack and exact art hashes without assuming the newest version', () => {
    const catalog={schemaVersion:1,activeHash:hash,packs:[reference]}
    expect(parseRpgContentCatalog(catalog,files).packs[0]?.sha256).toBe(hash)
    for(const bad of [{...catalog,activeHash:'c'.repeat(64)},{...catalog,packs:[reference,reference]},
      {...catalog,packs:[{...reference,path:'../secret'}]},{...catalog,packs:[{...reference,art:[{key:'absent',path:reference.art[0]!.path}]}]}])
      expect(()=>parseRpgContentCatalog(bad,files)).toThrow()
    expect(()=>parseRpgContentCatalog(catalog,files.slice(0,1))).toThrow()
    expect(()=>parseRpgContentCatalog(catalog,files.map(f=>({...f,sha256:'c'.repeat(64)})))).toThrow()
  })
})
