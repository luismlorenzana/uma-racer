import { createHash } from 'node:crypto'
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import type { ContentManifest } from '@racer/domain'
import { afterEach, describe, expect, it } from 'vitest'
import { sha256, writeContentPacks } from './pack'

const tempDirs: string[] = []

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((path) => rm(path, { recursive: true, force: true })))
})

describe('writeContentPacks', () => {
  it('sorts compact JSON, hashes exact bytes, removes stale packs, keeps only the asset families, and writes the manifest', async () => {
    const contentDir = await mkdtemp(join(tmpdir(), 'uma-racer-pack-'))
    tempDirs.push(contentDir)
    await import('node:fs/promises').then(({ mkdir }) => mkdir(resolve(contentDir, 'data')))
    await writeFile(resolve(contentDir, 'data/umas.stale000.json'), '{}', 'utf8')
    await writeFile(
      resolve(contentDir, 'manifest.json'),
      JSON.stringify({
        version: 'old',
        generatedAt: '2000-01-01T00:00:00.000Z',
        // A retired family's input names a file that leaves; a kept file's input and a dataset's hash stay (T144).
        source: { 'retired-art:x': 'art/retired/x.abcd1234.webp', 'uma-art:1': 'art/bust/uma-1.abcd1234.webp', races: 'r1' },
        files: [
          { path: 'atlases/uma-icons.abcd1234.json', bytes: 2, sha256: 'a'.repeat(64) },
          { path: 'art/bust/uma-1.abcd1234.webp', bytes: 3, sha256: 'b'.repeat(64) },
          // A family no pipeline builds any more, and an old pack: neither stays in the manifest (T143).
          { path: 'atlases/retired-icons-0.abcd1234.webp', bytes: 4, sha256: 'c'.repeat(64) },
          { path: 'art/retired/x.abcd1234.webp', bytes: 5, sha256: 'd'.repeat(64) },
          { path: 'data/retired.abcd1234.json', bytes: 6, sha256: 'e'.repeat(64) },
        ],
      }),
      'utf8',
    )

    const generatedAt = '2099-04-05T06:07:08.000Z'
    const manifest = await writeContentPacks({
      contentDir,
      generatedAt,
      source: { characters: 'v2', 'character-cards': 'v1' },
      packs: [
        { name: 'umas', version: 'v1', items: [{ id: '2' }, { id: '1' }] },
        { name: 'cards', version: 'v3', items: [{ id: '5' }] },
      ],
    })

    const entries = await readdir(resolve(contentDir, 'data'))
    expect(entries).not.toContain('umas.stale000.json')
    const umaFile = manifest.files.find((file) => file.path.startsWith('data/umas.'))!
    const umaJson = await readFile(resolve(contentDir, umaFile.path), 'utf8')
    expect(umaJson).toBe('{"version":"v1","items":[{"id":"1"},{"id":"2"}]}')
    expect(umaFile.sha256).toBe(sha256(umaJson))
    expect(umaFile.path).toBe(`data/umas.${umaFile.sha256.slice(0, 8)}.json`)
    expect(umaFile.bytes).toBe(Buffer.byteLength(umaJson))

    const expectedVersion = createHash('sha256')
      .update(manifest.files.map((file) => file.sha256).sort().join(''))
      .digest('hex')
      .slice(0, 12)
    expect(manifest).toMatchObject({ version: expectedVersion, generatedAt })
    expect(manifest.source).toEqual({
      'character-cards': 'v1',
      characters: 'v2',
      races: 'r1',
      'uma-art:1': 'art/bust/uma-1.abcd1234.webp',
    })
    expect(manifest.files.map((file) => file.path)).toEqual([...manifest.files.map((file) => file.path)].sort())
    expect(manifest.files).toContainEqual({
      path: 'atlases/uma-icons.abcd1234.json',
      bytes: 2,
      sha256: 'a'.repeat(64),
    })
    expect(manifest.files.map((file) => file.path).filter((path) => !path.startsWith('data/umas.') && !path.startsWith('data/cards.')))
      .toEqual(['art/bust/uma-1.abcd1234.webp', 'atlases/uma-icons.abcd1234.json'])
    expect(JSON.parse(await readFile(resolve(contentDir, 'manifest.json'), 'utf8')) as ContentManifest).toEqual(manifest)
  })
})
