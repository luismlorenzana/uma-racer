import { createHash } from 'node:crypto'
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import type { ContentAtlas, ContentManifest } from '@racer/domain'
import { afterEach, describe, expect, it } from 'vitest'
import { buildAtlas } from './atlas'
import { writeAtlases } from './write'

const tempDirs: string[] = []
const SVG = Buffer.from(
  '<svg xmlns="http://www.w3.org/2000/svg" width="2" height="2"><rect width="2" height="2" fill="lime"/></svg>',
)

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((path) => rm(path, { recursive: true, force: true })))
})

describe('writeAtlases', () => {
  it('hashes descriptors/pages, removes stale family files, and preserves data entries', async () => {
    const contentDir = await mkdtemp(join(tmpdir(), 'uma-racer-atlas-write-'))
    tempDirs.push(contentDir)
    await mkdir(resolve(contentDir, 'atlases'))
    await writeFile(resolve(contentDir, 'atlases/uma-icons.stale000.json'), '{}')
    const dataEntry = { path: 'data/umas.deadbeef.json', bytes: 2, sha256: 'b'.repeat(64) }
    await writeFile(
      resolve(contentDir, 'manifest.json'),
      JSON.stringify({
        version: 'old',
        generatedAt: '2000-01-01T00:00:00.000Z',
        source: { characters: 'synthetic-v1' },
        files: [dataEntry, { path: 'atlases/uma-icons.stale000.json', bytes: 2, sha256: 'c'.repeat(64) }],
      }),
    )
    const atlas = await buildAtlas([{ id: 'invented-1', bytes: SVG, cacheHit: false }])

    const manifest = await writeAtlases({
      contentDir,
      generatedAt: '2099-01-02T03:04:05.000Z',
      atlases: [{ kind: 'uma-icons', atlas }],
    })

    expect(manifest.files).toContainEqual(dataEntry)
    expect(manifest.source).toEqual({ characters: 'synthetic-v1' })
    expect(await readdir(resolve(contentDir, 'atlases'))).not.toContain('uma-icons.stale000.json')
    const descriptorFile = manifest.files.find((file) => /^atlases\/uma-icons\.[a-f0-9]{8}\.json$/.test(file.path))!
    const descriptorJson = await readFile(resolve(contentDir, descriptorFile.path), 'utf8')
    const descriptor = JSON.parse(descriptorJson) as ContentAtlas
    expect(descriptor.frames['invented-1']).toMatchObject({ width: 128, height: 128 })
    expect(descriptor.pages[0]!.path).toMatch(/^atlases\/uma-icons-0\.[a-f0-9]{8}\.webp$/)
    expect(descriptorFile.sha256).toBe(createHash('sha256').update(descriptorJson).digest('hex'))
    const expectedVersion = createHash('sha256')
      .update(manifest.files.map((file) => file.sha256).sort().join(''))
      .digest('hex')
      .slice(0, 12)
    expect(manifest.version).toBe(expectedVersion)
    expect(JSON.parse(await readFile(resolve(contentDir, 'manifest.json'), 'utf8')) as ContentManifest).toEqual(manifest)
  })
})
