import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import sharp from 'sharp'
import { afterEach, describe, expect, it } from 'vitest'
import { chibiName, encodeWikiArt, parseWikiName, readCostumes, selectWikiArt, stageWikiFiles, stagedWikiFiles, standName } from './wiki'

describe('wiki file names (T059)', () => {
  it('reads chibis and the four outfit stands', () => {
    expect(parseWikiName('Game_Asset_petit_chr_1068_106810_0010.png')).toEqual({ family: 'chibi', chara: '1068', dress: '106810', pose: 'a' })
    expect(parseWikiName('Game_Asset_petit_chr_1068_106810_0011.png')).toEqual({ family: 'chibi', chara: '1068', dress: '106810', pose: 'b' })
    expect(parseWikiName('Game_Asset_chara_stand_1001_000001.png')).toEqual({ family: 'dress', chara: '1001', look: 'gym' })
    expect(parseWikiName('Game_Asset_chara_stand_1001_000002.png')).toEqual({ family: 'dress', chara: '1001', look: 'summer' })
    expect(parseWikiName('Game_Asset_chara_stand_1001_000005.png')).toEqual({ family: 'dress', chara: '1001', look: 'winter' })
    expect(parseWikiName('Game_Asset_chara_stand_1001_901001.png')).toEqual({ family: 'dress', chara: '1001', look: 'casual' })
  })

  it('ignores lookalikes: an outfit stand, a race dress, someone else\'s casual, other poses and formats', () => {
    for (const name of [
      'Game_Asset_chara_stand_1001_100101.png',
      'Game_Asset_chara_stand_1001_000103.png',
      'Game_Asset_chara_stand_1001_901002.png',
      'Game_Asset_petit_chr_1001_100101_0012.png',
      'Game_Asset_petit_chr_1001_100101_0010.jpg',
      'petit_chr_1001_100101_0010.png',
    ]) expect(parseWikiName(name)).toBeNull()
  })
})

describe('selecting the roster\'s art', () => {
  // Kitasan Black: our 106802 is the game's dress 106810, and our 106803 is dress 106802.
  const umas = [{ id: '106801', charaId: '1068' }, { id: '106802', charaId: '1068' }, { id: '106803', charaId: '1068' }]
  const costumes = new Map([['106801', '106801'], ['106802', '106810'], ['106803', '106802']])
  const files = new Set([
    ...['106801', '106810', '106802'].flatMap((dress) => [chibiName('1068', dress, 'a'), chibiName('1068', dress, 'b')]),
    standName('1068', 'gym'), standName('1068', 'winter'), standName('1068', 'casual'),
  ])

  it('matches each outfit\'s chibi by its dress id, not its card id', () => {
    const selection = selectWikiArt(files, umas, costumes)
    expect(selection.chibi.find((pick) => pick.id === '106802-a')!.file).toBe('Game_Asset_petit_chr_1068_106810_0010.png')
    expect(selection.chibi.find((pick) => pick.id === '106803-b')!.file).toBe('Game_Asset_petit_chr_1068_106802_0011.png')
  })

  it('takes one set of stands and one face per character, and reports the gaps', () => {
    const selection = selectWikiArt(files, umas, costumes)
    expect(selection.dress.map((pick) => pick.id)).toEqual(['1068-gym', '1068-winter', '1068-casual'])
    // No summer uniform here, so the face comes from the winter one.
    expect(selection.face).toEqual([{ id: '1068', file: standName('1068', 'winter') }])
    expect(selection.missing).toEqual(['1068-summer'])
  })
})

describe('staging and encoding', () => {
  let dir: string | null = null
  afterEach(async () => { if (dir) await rm(dir, { recursive: true, force: true }) })

  it('stages only roster files, once', async () => {
    dir = await mkdtemp(join(tmpdir(), 'wiki-'))
    const source = join(dir, 'source')
    const cache = join(dir, 'cache')
    await mkdir(source)
    await writeFile(join(source, standName('1001', 'summer')), 'x')
    await writeFile(join(source, 'notes.txt'), 'x')
    expect(await stageWikiFiles(source, cache)).toEqual({ copied: 1, kept: 0 })
    expect(await stageWikiFiles(source, cache)).toEqual({ copied: 0, kept: 1 })
    expect([...await stagedWikiFiles(cache)]).toEqual([standName('1001', 'summer')])
  })

  it('reads the card → dress map from the data cache', async () => {
    dir = await mkdtemp(join(tmpdir(), 'wiki-'))
    await writeFile(join(dir, 'character-cards.json'), JSON.stringify([{ card_id: 106802, costume: 106810 }, { card_id: 1 }]))
    expect([...await readCostumes(dir)]).toEqual([['106802', '106810']])
    await expect(readCostumes(join(dir, 'missing'))).rejects.toThrow(/data:import/)
  })

  it('cuts a 128 px face from a 512 px stand and keeps its transparency', async () => {
    const stand = await sharp({ create: { width: 512, height: 512, channels: 4, background: { r: 1, g: 2, b: 3, alpha: 0.5 } } }).png().toBuffer()
    const face = await encodeWikiArt('face', '1001', stand)
    expect([face.width, face.height]).toEqual([128, 128])
    expect((await sharp(face.bytes).metadata()).hasAlpha).toBe(true)
    const chibi = await encodeWikiArt('chibi', '100101-a', await sharp({ create: { width: 256, height: 256, channels: 4, background: '#fff' } }).png().toBuffer())
    expect(chibi.width).toBe(256)
  })
})
