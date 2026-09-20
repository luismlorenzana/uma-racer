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
  const entries = [
    ['data/alpha.1234abcd.json', '{"synthetic":1}'],
    ['data/beta.5678abcd.json', '{"synthetic":2}'],
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

  readManifest = async () => this.manifest
  objectState = async (path: string) => this.objects.has(path) ? { bytes: this.objects.get(path)! } : null
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

  it('reports the full plan without mutating storage in dry-run mode', async () => {
    const { contentDir, manifest } = await fixture()
    const storage = new FakeStorage()
    const result = await publishContent({ contentDir, storage, dryRun: true })
    expect(result.uploadPaths).toEqual(manifest.files.map((file) => file.path))
    expect(result.remoteVersionAfter).toBeNull()
    expect(storage.calls).toEqual([])
    expect(storage.manifest).toBeNull()
  })

  it('skips an already-present object and still publishes the manifest last', async () => {
    const { contentDir, manifest } = await fixture()
    const storage = new FakeStorage()
    storage.objects.set(manifest.files[0]!.path, manifest.files[0]!.bytes)
    const result = await publishContent({ contentDir, storage })
    expect(result.alreadyPresentPaths).toEqual([manifest.files[0]!.path])
    expect(storage.calls).toEqual([manifest.files[1]!.path, 'manifest.json'])
  })
})
