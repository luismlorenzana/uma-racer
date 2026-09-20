import { createHash } from 'node:crypto'
import type { ContentAtlas, ContentManifest, ContentManifestFile } from '@racer/domain'
import { describe, expect, it, vi } from 'vitest'
import {
  ContentRuntime,
  getContentAsset,
  readWebpDimensions,
  type ContentTransport,
  type ManifestStore,
  type ObjectUrlFactory,
} from './runtime'

interface Fixture {
  manifest: ContentManifest
  responses: Map<string, { bytes: ArrayBuffer; contentType: string }>
}

function bytes(value: string | Uint8Array): ArrayBuffer {
  const input = typeof value === 'string' ? new TextEncoder().encode(value) : value
  return Uint8Array.from(input).buffer
}

function hash(value: ArrayBuffer): string {
  return createHash('sha256').update(new Uint8Array(value)).digest('hex')
}

function syntheticWebp(width: number, height: number): Uint8Array {
  const output = new Uint8Array(30)
  const writeAscii = (offset: number, value: string) => {
    for (let index = 0; index < value.length; index += 1) output[offset + index] = value.charCodeAt(index)
  }
  writeAscii(0, 'RIFF')
  new DataView(output.buffer).setUint32(4, 22, true)
  writeAscii(8, 'WEBP')
  writeAscii(12, 'VP8X')
  new DataView(output.buffer).setUint32(16, 10, true)
  const view = new DataView(output.buffer)
  const write24 = (offset: number, value: number) => {
    view.setUint8(offset, value & 0xff)
    view.setUint8(offset + 1, (value >>> 8) & 0xff)
    view.setUint8(offset + 2, (value >>> 16) & 0xff)
  }
  write24(24, width - 1)
  write24(27, height - 1)
  return output
}

function fixture(versionCharacter = 'a'): Fixture {
  const responses = new Map<string, { bytes: ArrayBuffer; contentType: string }>()
  const files: ContentManifestFile[] = []
  const add = (path: string, value: string | Uint8Array, contentType: string) => {
    const encoded = bytes(value)
    responses.set(path, { bytes: encoded, contentType })
    files.push({ path, bytes: encoded.byteLength, sha256: hash(encoded) })
  }
  for (const [name, id] of [
    ['umas', 'uma-x'],
    ['cards', 'card-x'],
    ['skills', 'skill-x'],
    ['races', 'race-x'],
    ['courses', 'course-x'],
  ] as const) {
    add(`data/${name}.${versionCharacter.repeat(8)}.json`, JSON.stringify({ version: 'synthetic', items: [{ id }] }), 'application/json')
  }
  const atlas = (kind: ContentAtlas['kind'], id: string): ContentAtlas => ({
    schemaVersion: 1,
    kind,
    frameWidth: 128,
    frameHeight: 128,
    pages: [{ path: `atlases/${kind}-0.${versionCharacter.repeat(8)}.webp`, width: 132, height: 132 }],
    frames: { [id]: { page: 0, x: 2, y: 2, width: 128, height: 128 } },
  })
  for (const [kind, id] of [
    ['uma-icons', 'uma-x'],
    ['card-icons', 'card-x'],
  ] as const) {
    const webp = syntheticWebp(132, 132)
    webp[20] = versionCharacter === 'a' ? 0 : 2
    add(`atlases/${kind}-0.${versionCharacter.repeat(8)}.webp`, webp, 'image/webp')
    add(`atlases/${kind}.${versionCharacter.repeat(8)}.json`, JSON.stringify(atlas(kind, id)), 'application/json')
  }
  files.sort((left, right) => left.path.localeCompare(right.path))
  const version = createHash('sha256')
    .update(files.map((file) => file.sha256).sort().join(''))
    .digest('hex')
    .slice(0, 12)
  return {
    manifest: {
      version,
      generatedAt: '2099-01-01T00:00:00.000Z',
      source: { characters: 'synthetic' },
      files,
    },
    responses,
  }
}

class MemoryStore implements ManifestStore {
  value: string | null = null
  get = () => this.value
  set = (value: string) => {
    this.value = value
  }
  clear = () => {
    this.value = null
  }
}

function urlFactory() {
  let sequence = 0
  const revoke = vi.fn()
  const urls: ObjectUrlFactory = { create: () => `blob:synthetic-${++sequence}`, revoke }
  return { urls, revoke }
}

function transport(current: () => Fixture): ContentTransport {
  return {
    manifest: async () => current().manifest,
    file: async (path) => {
      const response = current().responses.get(path)
      if (!response) throw new Error(`missing ${path}`)
      return response
    },
  }
}

describe('ContentRuntime', () => {
  it('reads the declared dimensions from a WebP page header', () => {
    expect(readWebpDimensions(bytes(syntheticWebp(4092, 1452)))).toEqual({ width: 4092, height: 1452 })
    expect(() => readWebpDimensions(bytes('not-webp'))).toThrow('Invalid WebP')
  })

  it('loads verified registries and atlas Blob URLs, then persists the good manifest', async () => {
    const data = fixture()
    const store = new MemoryStore()
    const factory = urlFactory()
    const runtime = new ContentRuntime(transport(() => data), store, factory.urls)

    const result = await runtime.load()

    expect(result.status).toBe('ready')
    if (result.status !== 'ready') return
    expect(result.content.umas.byId.has('uma-x')).toBe(true)
    expect(result.content.races.items[0]?.seriesLegs).toEqual([])
    expect(result.content.origin).toBe('network')
    expect(getContentAsset(result.content, 'uma-icons', 'uma-x')).toMatchObject({
      url: 'blob:synthetic-1',
      frame: { x: 2, y: 2 },
    })
    expect(JSON.parse(store.value!)).toMatchObject({ version: data.manifest.version })
  })

  it('rejects an integrity mismatch without persisting it', async () => {
    const data = fixture()
    const umaFile = data.manifest.files.find((file) => file.path.startsWith('data/umas.'))!
    data.responses.set(umaFile.path, { bytes: bytes('tampered'), contentType: 'application/json' })
    const store = new MemoryStore()
    const runtime = new ContentRuntime(transport(() => data), store, urlFactory().urls)

    await expect(runtime.load()).rejects.toThrow(/byte length mismatch|hash mismatch/)
    expect(store.value).toBeNull()
  })

  it('lets a new shell recover with the last known-good manifest through the offline byte cache', async () => {
    const data = fixture()
    const store = new MemoryStore()
    store.value = JSON.stringify(data.manifest)
    const offlineTransport: ContentTransport = {
      manifest: async () => {
        throw new Error('offline')
      },
      file: transport(() => data).file,
    }
    const runtime = new ContentRuntime(offlineTransport, store, urlFactory().urls)

    const result = await runtime.load()

    expect(result.status).toBe('ready')
    if (result.status === 'ready') expect(result.content.origin).toBe('offline-cache')
  })

  it('keeps an old active shell working when a new network version is incomplete', async () => {
    let current = fixture('a')
    const old = current
    const store = new MemoryStore()
    const runtime = new ContentRuntime(transport(() => current), store, urlFactory().urls)
    const first = await runtime.load()
    expect(first.status).toBe('ready')
    current = fixture('b')
    const missing = current.manifest.files.find((file) => file.path.startsWith('data/umas.'))!
    current.responses.delete(missing.path)

    const recovered = await runtime.load()

    expect(recovered.status).toBe('ready')
    if (recovered.status === 'ready') {
      expect(recovered.content.manifest.version).toBe(old.manifest.version)
      expect(recovered.content.origin).toBe('offline-cache')
    }
  })

  it('keeps the active version until a replacement is complete, then revokes its URLs', async () => {
    let current = fixture('a')
    const store = new MemoryStore()
    const factory = urlFactory()
    const runtime = new ContentRuntime(transport(() => current), store, factory.urls)
    await runtime.load()
    current = fixture('b')

    const replacement = await runtime.load()

    expect(replacement.status).toBe('ready')
    if (replacement.status === 'ready') expect(replacement.content.manifest.version).toBe(current.manifest.version)
    expect(factory.revoke).toHaveBeenCalledTimes(2)
  })

  it('treats a null manifest as empty and releases active resources', async () => {
    const data = fixture()
    const store = new MemoryStore()
    const factory = urlFactory()
    let empty = false
    const customTransport: ContentTransport = {
      manifest: async () => (empty ? { version: null, files: [] } : data.manifest),
      file: transport(() => data).file,
    }
    const runtime = new ContentRuntime(customTransport, store, factory.urls)
    await runtime.load()
    empty = true

    await expect(runtime.load()).resolves.toEqual({ status: 'empty' })
    expect(factory.revoke).toHaveBeenCalledTimes(2)
    expect(store.value).toBeNull()
  })

  it('releases a version that completes after sign-out cancellation', async () => {
    const data = fixture()
    let releaseManifest!: () => void
    const manifestGate = new Promise<void>((resolve) => {
      releaseManifest = resolve
    })
    const delayedTransport: ContentTransport = {
      manifest: async () => {
        await manifestGate
        return data.manifest
      },
      file: transport(() => data).file,
    }
    const factory = urlFactory()
    const runtime = new ContentRuntime(delayedTransport, new MemoryStore(), factory.urls)
    const loading = runtime.load()
    runtime.clear()
    releaseManifest()

    await expect(loading).rejects.toThrow('Content load cancelled')
    expect(factory.revoke).toHaveBeenCalledTimes(2)
  })
})
