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

function fixture(versionCharacter = 'a', includeSparkRivals = false, extraCardArt = 0): Fixture {
  const responses = new Map<string, { bytes: ArrayBuffer; contentType: string }>()
  const files: ContentManifestFile[] = []
  const add = (path: string, value: string | Uint8Array, contentType: string) => {
    const encoded = bytes(value)
    responses.set(path, { bytes: encoded, contentType })
    files.push({ path, bytes: encoded.byteLength, sha256: hash(encoded) })
  }
  const styles = ['front', 'pace', 'late', 'end', 'front', 'pace'] as const
  const umaItems = includeSparkRivals
    ? styles.map((best, index) => ({
        id: index === 0 ? 'uma-x' : `synthetic-uma-${index + 1}`,
        charaId: `synthetic-character-${index + 1}`,
        aptitudes: {
          strategy: Object.fromEntries(['front', 'pace', 'late', 'end'].map((strategy) => [strategy, strategy === best ? 'A' : 'C'])),
        },
      }))
    : [{ id: 'uma-x' }]
  add(`data/umas.${versionCharacter.repeat(8)}.json`, JSON.stringify({ version: 'synthetic', items: umaItems }), 'application/json')
  for (const [name, id] of [['cards', 'card-x'], ['skills', 'skill-x'], ['races', 'race-x'], ['courses', 'course-x']] as const) {
    add(`data/${name}.${versionCharacter.repeat(8)}.json`, JSON.stringify({ version: 'synthetic', items: [{ id }] }), 'application/json')
  }
  if (includeSparkRivals) {
    const sparkRivals = {
      version: '1',
      items: Array.from({ length: 14 }, (_, index) => ({
        id: `tier:${index + 1}`,
        tier: index + 1,
        ordinary: ['front', 'pace', 'late', 'end'].map((strategy, candidate) => ({
          templateId: umaItems[candidate]!.id,
          charaId: `synthetic-character-${candidate + 1}`,
          strategy,
          recipe: ['rush-pressure', 'tracker-guard', 'surge-convert', 'finisher-delay'][candidate],
        })),
        bosses: [0, 1].map((candidate) => ({
          templateId: umaItems[candidate + 4]!.id,
          charaId: `synthetic-character-${candidate + 5}`,
          strategy: candidate === 0 ? 'front' : 'pace',
          recipe: 'circuit-boss',
        })),
      })),
    }
    add(`data/spark-rivals.${versionCharacter.repeat(8)}.json`, JSON.stringify(sparkRivals), 'application/json')
  }
  const atlas = (kind: ContentAtlas['kind'], ids: readonly string[]): ContentAtlas => ({
    schemaVersion: 1,
    kind,
    frameWidth: 128,
    frameHeight: 128,
    pages: [{ path: `atlases/${kind}-0.${versionCharacter.repeat(8)}.webp`, width: 130 * ids.length + 2, height: 132 }],
    frames: Object.fromEntries(ids.map((id, index) => [id, { page: 0, x: 2 + 130 * index, y: 2, width: 128, height: 128 }])),
  })
  for (const [kind, ids] of [
    ['uma-icons', umaItems.map((item) => item.id)],
    ['card-icons', ['card-x']],
  ] as const) {
    const descriptor = atlas(kind, ids)
    const webp = syntheticWebp(descriptor.pages[0]!.width, descriptor.pages[0]!.height)
    webp[20] = versionCharacter === 'a' ? 0 : 2
    add(`atlases/${kind}-0.${versionCharacter.repeat(8)}.webp`, webp, 'image/webp')
    add(`atlases/${kind}.${versionCharacter.repeat(8)}.json`, JSON.stringify(descriptor), 'application/json')
  }
  // Per-entry art: fetched on demand, so it is in the manifest but never loaded up front.
  // T059: chibis per outfit, stands and race faces per character.
  for (const [dir, id] of [['uma', 'uma-x'], ['card', 'card-x'], ['chibi', 'uma-x-a'], ['dress', '1001-summer'], ['face', '1001']] as const) {
    add(`art/${dir}/${id}.${versionCharacter.repeat(8)}.webp`, syntheticWebp(512, 512), 'image/webp')
  }
  for (let index = 0; index < extraCardArt; index += 1) {
    add(`art/card/c-${index}.${versionCharacter.repeat(8)}.webp`, syntheticWebp(450, 600 + index), 'image/webp')
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

describe('private art loader', () => {
  it('serves art on demand, caches it, and reports what the manifest has', async () => {
    const current = fixture()
    const { urls } = urlFactory()
    const runtime = new ContentRuntime(transport(() => current), new MemoryStore(), urls)
    const content = await runtime.load()
    if (content.status !== 'ready') throw new Error('expected ready content')

    expect(content.content.art.has('uma', 'uma-x')).toBe(true)
    expect(content.content.art.has('card', 'missing')).toBe(false)

    const first = await content.content.art.load('uma', 'uma-x')
    expect(first).toMatch(/^blob:synthetic-/)
    // A second request reuses the same object URL rather than fetching again.
    expect(await content.content.art.load('uma', 'uma-x')).toBe(first)
    // Art the manifest does not carry resolves to null so callers fall back to the icon atlas.
    expect(await content.content.art.load('card', 'missing')).toBeNull()
  })

  it('never revokes art a screen still holds, however many others load after it (D183)', async () => {
    const current = fixture('a', false, 30)
    const { urls, revoke } = urlFactory()
    const content = await new ContentRuntime(transport(() => current), new MemoryStore(), urls).load()
    if (content.status !== 'ready') throw new Error('expected ready content')
    const art = content.content.art
    const release = art.hold!('card', 'c-0')
    const held = await art.load('card', 'c-0')
    const unheld = await art.load('card', 'c-1')
    for (let index = 2; index < 30; index += 1) await art.load('card', `c-${index}`)
    // Past the 24-entry window the oldest unheld entries go; the held one stays and is still served.
    expect(revoke).toHaveBeenCalledWith(unheld)
    expect(revoke).not.toHaveBeenCalledWith(held)
    expect(await art.load('card', 'c-0')).toBe(held)
    release()
    release()
  })

  it('resolves T059\'s chibi, outfit-stand and race-face art', async () => {
    const current = fixture()
    const { urls } = urlFactory()
    const content = await new ContentRuntime(transport(() => current), new MemoryStore(), urls).load()
    if (content.status !== 'ready') throw new Error('expected ready content')
    expect(content.content.art.has('chibi', 'uma-x-a')).toBe(true)
    expect(content.content.art.has('dress', '1001-summer')).toBe(true)
    expect(await content.content.art.load('face', '1001')).toMatch(/^blob:synthetic-/)
    // A character without a face keeps her numbered dot in the race.
    expect(content.content.art.has('face', '1002')).toBe(false)
  })

  it('rejects art whose bytes do not match the manifest hash', async () => {
    const current = fixture()
    const path = current.manifest.files.find((file) => file.path.startsWith('art/uma/'))!.path
    current.responses.set(path, { bytes: bytes(syntheticWebp(256, 256)), contentType: 'image/webp' })
    const { urls } = urlFactory()
    const runtime = new ContentRuntime(transport(() => current), new MemoryStore(), urls)
    const content = await runtime.load()
    if (content.status !== 'ready') throw new Error('expected ready content')

    await expect(content.content.art.load('uma', 'uma-x')).rejects.toThrow(/mismatch/)
  })
})

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
    expect(result.content.sparkRivals).toBeNull()
    expect(result.content.races.items[0]?.seriesLegs).toEqual([])
    expect(result.content.origin).toBe('network')
    expect(getContentAsset(result.content, 'uma-icons', 'uma-x')).toMatchObject({
      url: 'blob:synthetic-1',
      frame: { x: 2, y: 2 },
    })
    expect(JSON.parse(store.value!)).toMatchObject({ version: data.manifest.version })
  })

  it('loads the optional Spark rival pack while keeping old manifests compatible', async () => {
    const data = fixture('a', true)
    const runtime = new ContentRuntime(transport(() => data), new MemoryStore(), urlFactory().urls)

    const result = await runtime.load()

    expect(result.status).toBe('ready')
    if (result.status !== 'ready') return
    expect(result.content.sparkRivals).toHaveLength(14)
    expect(result.content.sparkRivals?.[13]).toMatchObject({ id: 'tier:14', tier: 14 })
  })

  it('rejects a malformed present Spark rival pack instead of silently falling back', async () => {
    const data = fixture('a', true)
    const file = data.manifest.files.find((entry) => entry.path.startsWith('data/spark-rivals.'))!
    const malformed = bytes(JSON.stringify({ version: '1', items: [] }))
    data.responses.set(file.path, { bytes: malformed, contentType: 'application/json' })
    file.bytes = malformed.byteLength
    file.sha256 = hash(malformed)
    data.manifest.version = createHash('sha256')
      .update(data.manifest.files.map((entry) => entry.sha256).sort().join(''))
      .digest('hex')
      .slice(0, 12)

    await expect(new ContentRuntime(transport(() => data), new MemoryStore(), urlFactory().urls).load())
      .rejects.toThrow(/Spark rival content pack header/)
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
