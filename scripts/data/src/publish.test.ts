import { createHash } from 'node:crypto'
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import type { ContentManifest } from '@racer/domain'
import { afterEach, describe, expect, it } from 'vitest'
import { publishContent, type ContentStorageClient } from './publish'

const temporaryDirectories: string[] = []

async function fixture(): Promise<{ contentDir: string; manifest: ContentManifest }> {
  const contentDir = await mkdtemp(resolve(tmpdir(), 'uma-racer-publish-'))
  temporaryDirectories.push(contentDir)
  await mkdir(resolve(contentDir, 'data'))
  await mkdir(resolve(contentDir, 'art/uma'), { recursive: true })
  const sparkPack = JSON.stringify({
    version: '1',
    items: Array.from({ length: 14 }, (_, index) => ({
      id: `tier:${index + 1}`,
      tier: index + 1,
      ordinary: ['front', 'pace', 'late', 'end'].map((strategy, candidate) => ({
        templateId: `synthetic-uma-${index + 1}-${candidate + 1}`,
        charaId: `synthetic-character-${candidate + 1}`,
        strategy,
        recipe: ['rush-pressure', 'tracker-guard', 'surge-convert', 'finisher-delay'][candidate],
      })),
      bosses: [0, 1].map((candidate) => ({
        templateId: `synthetic-boss-${index + 1}-${candidate + 1}`,
        charaId: `synthetic-character-${candidate + 5}`,
        strategy: candidate === 0 ? 'front' : 'pace',
        recipe: 'circuit-boss',
      })),
    })),
  })
  const entries = [
    ['data/alpha.1234abcd.json', '{"synthetic":1}'],
    ['data/beta.5678abcd.json', '{"synthetic":2}'],
    ['data/spark-rivals.abcdef12.json', sparkPack],
    // Per-entry art publishes through the same path as packs and atlases.
    ['art/uma/synthetic-1.9abcdef0.webp', 'synthetic-art'],
  ] as const
  const files = []
  for (const [path, value] of entries) {
    await writeFile(resolve(contentDir, path), value)
    files.push({ path, bytes: Buffer.byteLength(value), sha256: createHash('sha256').update(value).digest('hex') })
  }
  const version = createHash('sha256').update(files.map((file) => file.sha256).sort().join('')).digest('hex').slice(0, 12)
  const manifest: ContentManifest = { version, generatedAt: '2099-01-01T00:00:00.000Z', source: { source: 'synthetic' }, files }
  await writeFile(resolve(contentDir, 'manifest.json'), JSON.stringify(manifest))
  return { contentDir, manifest }
}

class FakeStorage implements ContentStorageClient {
  manifest: unknown | null = null
  objects = new Map<string, number>()
  calls: string[] = []
  activeObjectChecks = 0
  maxObjectChecks = 0
  delayObjectChecks = false

  readManifest = async () => this.manifest
  objectState = async (path: string) => {
    this.activeObjectChecks += 1
    this.maxObjectChecks = Math.max(this.maxObjectChecks, this.activeObjectChecks)
    if (this.delayObjectChecks) await new Promise((resolve) => setTimeout(resolve, 1))
    const result = this.objects.has(path) ? { bytes: this.objects.get(path)! } : null
    this.activeObjectChecks -= 1
    return result
  }
  upload = async (localPath: string, objectPath: string) => {
    this.calls.push(objectPath)
    if (objectPath === 'manifest.json') this.manifest = JSON.parse(await readFile(localPath, 'utf8')) as unknown
    else this.objects.set(objectPath, (await readFile(localPath)).byteLength)
  }
}

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((path) => rm(path, { recursive: true, force: true })))
})

describe('content publishing', () => {
  it('refuses an uncatalogued RPG pack before any remote access', async () => {
    const { contentDir, manifest } = await fixture(), value='{}', path='data/rpg-chapters.12345678.json'
    await writeFile(resolve(contentDir,path),value)
    manifest.files.push({path,bytes:2,sha256:createHash('sha256').update(value).digest('hex')})
    manifest.version=createHash('sha256').update(manifest.files.map(f=>f.sha256).sort().join('')).digest('hex').slice(0,12)
    await writeFile(resolve(contentDir,'manifest.json'),JSON.stringify(manifest))
    const storage=new FakeStorage();storage.readManifest=async()=>{throw new Error('Remote access must not happen')}
    await expect(publishContent({contentDir,storage})).rejects.toThrow(/exactly one catalog/)
    expect(storage.calls).toEqual([])
  })
  it('refuses publication without one complete Spark rival pack', async () => {
    const { contentDir } = await fixture()
    const manifestPath = resolve(contentDir, 'manifest.json')
    const manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as ContentManifest
    manifest.files = manifest.files.filter((file) => !file.path.startsWith('data/spark-rivals.'))
    manifest.version = createHash('sha256').update(manifest.files.map((file) => file.sha256).sort().join('')).digest('hex').slice(0, 12)
    await writeFile(manifestPath, JSON.stringify(manifest))
    const storage = new FakeStorage()

    await expect(publishContent({ contentDir, storage, dryRun: true })).rejects.toThrow(/exactly one Spark rival pack/)
    expect(storage.calls).toEqual([])
  })

  it('verifies bytes and hashes before contacting storage', async () => {
    const { contentDir, manifest } = await fixture()
    await writeFile(resolve(contentDir, manifest.files[0]!.path), 'tampered')
    const storage = new FakeStorage()
    await expect(publishContent({ contentDir, storage })).rejects.toThrow(/byte length mismatch|SHA-256 mismatch/)
    expect(storage.calls).toEqual([])
  })

  it('uploads missing addressed objects in manifest order and the manifest last', async () => {
    const { contentDir, manifest } = await fixture()
    const storage = new FakeStorage()
    const result = await publishContent({ contentDir, storage })
    expect(storage.calls).toEqual([...manifest.files.map((file) => file.path), 'manifest.json'])
    expect(result).toMatchObject({
      localVersion: manifest.version,
      remoteVersionBefore: null,
      remoteVersionAfter: manifest.version,
      uploadPaths: manifest.files.map((file) => file.path),
      alreadyPresentPaths: [],
    })
  })

  it('reads the bucket once when the client can list it, uploading only what is missing', async () => {
    const { contentDir, manifest } = await fixture()
    const storage = new FakeStorage()
    const [present, ...missing] = manifest.files
    storage.objects.set(present!.path, present!.bytes)
    let lookups = 0
    const listing = Object.assign(storage, {
      listObjects: async () => new Map(storage.objects),
      objectState: async () => { lookups += 1; return null },
    })
    const result = await publishContent({ contentDir, storage: listing })
    expect(lookups).toBe(0)
    expect(result.alreadyPresentPaths).toEqual([present!.path])
    expect(storage.calls).toEqual([...missing.map((file) => file.path), 'manifest.json'])
  })

  it('reports the full plan without mutating storage in dry-run mode', async () => {
    const { contentDir, manifest } = await fixture()
    const storage = new FakeStorage()
    storage.delayObjectChecks = true
    const result = await publishContent({ contentDir, storage, dryRun: true })
    expect(result.uploadPaths).toEqual(manifest.files.map((file) => file.path))
    expect(result.remoteVersionAfter).toBeNull()
    expect(storage.calls).toEqual([])
    expect(storage.manifest).toBeNull()
    expect(storage.maxObjectChecks).toBeGreaterThan(1)
    expect(storage.maxObjectChecks).toBeLessThanOrEqual(8)
  })

  it('skips an already-present object and still publishes the manifest last', async () => {
    const { contentDir, manifest } = await fixture()
    const storage = new FakeStorage()
    storage.objects.set(manifest.files[0]!.path, manifest.files[0]!.bytes)
    const result = await publishContent({ contentDir, storage })
    expect(result.alreadyPresentPaths).toEqual([manifest.files[0]!.path])
    // Everything else uploads in manifest order, with the manifest itself last.
    expect(storage.calls).toEqual([...manifest.files.slice(1).map((file) => file.path), 'manifest.json'])
  })
})
