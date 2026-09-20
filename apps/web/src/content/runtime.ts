// Authenticated, hash-verified, offline-capable private content runtime (T002).

import type {
  ContentAtlas,
  ContentAtlasFrame,
  ContentAtlasKind,
  ContentManifest,
  ContentManifestFile,
  CourseTemplate,
  RaceTemplate,
  SkillTemplate,
  SupportCardTemplate,
  UmaTemplate,
} from '@racer/domain'
import { contentApi } from '../api/client'
import { ContentFallbackError } from './errors'
import { findRequiredFile, parseContentAtlas, parseContentManifest, parseContentPack } from './parse'

const LAST_MANIFEST_KEY = 'uma-racer:last-content-manifest'

export interface ContentTransport {
  manifest: () => Promise<unknown>
  file: (path: string) => Promise<{ bytes: ArrayBuffer; contentType: string }>
}

export interface ManifestStore {
  get: () => string | null
  set: (value: string) => void
  clear: () => void
}

export interface ObjectUrlFactory {
  create: (blob: Blob) => string
  revoke: (url: string) => void
}

export interface ContentRegistry<T extends { id: string }> {
  items: readonly T[]
  byId: ReadonlyMap<string, T>
}

export interface LoadedAtlas {
  descriptor: ContentAtlas
  pageUrls: readonly string[]
}

export interface LoadedContent {
  manifest: ContentManifest
  origin: 'network' | 'offline-cache'
  umas: ContentRegistry<UmaTemplate>
  cards: ContentRegistry<SupportCardTemplate>
  skills: ContentRegistry<SkillTemplate>
  races: ContentRegistry<RaceTemplate>
  courses: ContentRegistry<CourseTemplate>
  atlases: Record<ContentAtlasKind, LoadedAtlas>
  art: ArtLoader
}

/** One private art family: large per-entry images fetched on demand, never atlased. */
export type ArtKind = 'uma' | 'card'

export interface ArtLoader {
  /** True when the published manifest carries art for this entry. */
  has: (kind: ArtKind, id: string) => boolean
  /**
   * Object URL for the entry's art, verified against the manifest hash. Resolves to `null` when the
   * manifest has no such file; rejects when the fetch or verification fails, so callers can fall back
   * to the icon atlas.
   */
  load: (kind: ArtKind, id: string) => Promise<string | null>
}

export interface ContentAsset {
  url: string
  frame: ContentAtlasFrame
  pageWidth: number
  pageHeight: number
}

export type ContentLoadResult = { status: 'ready'; content: LoadedContent } | { status: 'empty' }

function browserManifestStore(): ManifestStore {
  return {
    get: () => {
      try {
        return globalThis.localStorage?.getItem(LAST_MANIFEST_KEY) ?? null
      } catch {
        return null
      }
    },
    set: (value) => {
      try {
        globalThis.localStorage?.setItem(LAST_MANIFEST_KEY, value)
      } catch {
        // The content still works for this session when storage is unavailable.
      }
    },
    clear: () => {
      try {
        globalThis.localStorage?.removeItem(LAST_MANIFEST_KEY)
      } catch {
        // Nothing else to clear when storage is unavailable.
      }
    },
  }
}

const browserObjectUrls: ObjectUrlFactory = {
  create: (blob) => URL.createObjectURL(blob),
  revoke: (url) => URL.revokeObjectURL(url),
}

function registry<T extends { id: string }>(items: T[]): ContentRegistry<T> {
  return { items: Object.freeze([...items]), byId: new Map(items.map((item) => [item.id, item])) }
}

function hex(bytes: ArrayBuffer): string {
  return [...new Uint8Array(bytes)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

function decodeJson(bytes: ArrayBuffer, path: string): unknown {
  try {
    return JSON.parse(new TextDecoder().decode(bytes)) as unknown
  } catch {
    throw new Error(`Invalid JSON content: ${path}`)
  }
}

function requireContentType(contentType: string, expected: 'json' | 'webp', path: string): void {
  const normalized = contentType.toLowerCase().split(';', 1)[0]?.trim()
  const valid = expected === 'json' ? normalized === 'application/json' : normalized === 'image/webp'
  if (!valid) throw new Error(`Unexpected content type for ${path}: ${contentType || 'unknown'}`)
}

function ascii(view: DataView, offset: number, length: number): string {
  return Array.from({ length }, (_, index) => String.fromCharCode(view.getUint8(offset + index))).join('')
}

function uint24(view: DataView, offset: number): number {
  return view.getUint8(offset) | (view.getUint8(offset + 1) << 8) | (view.getUint8(offset + 2) << 16)
}

export function readWebpDimensions(bytes: ArrayBuffer): { width: number; height: number } {
  const view = new DataView(bytes)
  if (view.byteLength < 20 || ascii(view, 0, 4) !== 'RIFF' || ascii(view, 8, 4) !== 'WEBP') {
    throw new Error('Invalid WebP page')
  }
  let offset = 12
  while (offset + 8 <= view.byteLength) {
    const kind = ascii(view, offset, 4)
    const size = view.getUint32(offset + 4, true)
    const data = offset + 8
    if (data + size > view.byteLength) throw new Error('Invalid WebP chunk')
    if (kind === 'VP8X' && size >= 10) {
      return { width: uint24(view, data + 4) + 1, height: uint24(view, data + 7) + 1 }
    }
    if (
      kind === 'VP8 ' &&
      size >= 10 &&
      view.getUint8(data + 3) === 0x9d &&
      view.getUint8(data + 4) === 0x01 &&
      view.getUint8(data + 5) === 0x2a
    ) {
      return { width: view.getUint16(data + 6, true) & 0x3fff, height: view.getUint16(data + 8, true) & 0x3fff }
    }
    if (kind === 'VP8L' && size >= 5 && view.getUint8(data) === 0x2f) {
      const bits = view.getUint32(data + 1, true)
      return { width: (bits & 0x3fff) + 1, height: ((bits >>> 14) & 0x3fff) + 1 }
    }
    offset = data + size + (size % 2)
  }
  throw new Error('WebP page has no supported image chunk')
}

async function verifiedJson(
  transport: ContentTransport,
  file: ContentManifestFile,
): Promise<unknown> {
  const result = await transport.file(file.path)
  requireContentType(result.contentType, 'json', file.path)
  if (result.bytes.byteLength !== file.bytes) throw new Error(`Content byte length mismatch: ${file.path}`)
  const digest = hex(await globalThis.crypto.subtle.digest('SHA-256', result.bytes))
  if (digest !== file.sha256) throw new Error(`Content hash mismatch: ${file.path}`)
  return decodeJson(result.bytes, file.path)
}

const PACK_FILES = {
  umas: /^data\/umas\.[a-f0-9]{8}\.json$/,
  cards: /^data\/cards\.[a-f0-9]{8}\.json$/,
  skills: /^data\/skills\.[a-f0-9]{8}\.json$/,
  races: /^data\/races\.[a-f0-9]{8}\.json$/,
  courses: /^data\/courses\.[a-f0-9]{8}\.json$/,
} as const

const ART_FILE = /^art\/(uma|card)\/([A-Za-z0-9_-]+)\.[a-f0-9]{8}\.webp$/
/** Object URLs held for recently viewed art; older ones are revoked so memory stays bounded. */
const ART_CACHE_LIMIT = 24

function artIndex(manifest: ContentManifest): Map<string, ContentManifestFile> {
  const index = new Map<string, ContentManifestFile>()
  for (const file of manifest.files) {
    const match = ART_FILE.exec(file.path)
    if (match) index.set(`${match[1]}:${match[2]}`, file)
  }
  return index
}

function createArtLoader(
  transport: ContentTransport,
  manifest: ContentManifest,
  urls: ObjectUrlFactory,
  track: (url: string) => void,
): ArtLoader {
  const index = artIndex(manifest)
  const cache = new Map<string, string>()
  const pending = new Map<string, Promise<string | null>>()

  const fetchArt = async (key: string, file: ContentManifestFile): Promise<string | null> => {
    const result = await transport.file(file.path)
    requireContentType(result.contentType, 'webp', file.path)
    if (result.bytes.byteLength !== file.bytes) throw new Error(`Content byte length mismatch: ${file.path}`)
    const digest = hex(await globalThis.crypto.subtle.digest('SHA-256', result.bytes))
    if (digest !== file.sha256) throw new Error(`Content hash mismatch: ${file.path}`)
    const url = urls.create(new Blob([result.bytes], { type: 'image/webp' }))
    track(url)
    cache.set(key, url)
    while (cache.size > ART_CACHE_LIMIT) {
      const [oldestKey, oldestUrl] = cache.entries().next().value as [string, string]
      cache.delete(oldestKey)
      urls.revoke(oldestUrl)
    }
    return url
  }

  return {
    has: (kind, id) => index.has(`${kind}:${id}`),
    load: async (kind, id) => {
      const key = `${kind}:${id}`
      const cached = cache.get(key)
      if (cached) {
        // Refresh recency so the entry survives eviction while it is on screen.
        cache.delete(key)
        cache.set(key, cached)
        return cached
      }
      const file = index.get(key)
      if (!file) return null
      const inFlight = pending.get(key)
      if (inFlight) return inFlight
      const request = fetchArt(key, file).finally(() => pending.delete(key))
      pending.set(key, request)
      return request
    },
  }
}

const ATLAS_FILES: Record<ContentAtlasKind, RegExp> = {
  'uma-icons': /^atlases\/uma-icons\.[a-f0-9]{8}\.json$/,
  'card-icons': /^atlases\/card-icons\.[a-f0-9]{8}\.json$/,
}

function assertMatchingFrames(label: string, ids: readonly string[], atlas: ContentAtlas): void {
  const expected = new Set(ids)
  const actual = Object.keys(atlas.frames)
  if (actual.length !== expected.size || actual.some((id) => !expected.has(id))) {
    throw new Error(`${label} atlas frames do not match its content pack`)
  }
}

interface LoadVersionOptions {
  transport: ContentTransport
  manifest: ContentManifest
  origin: LoadedContent['origin']
  urls: ObjectUrlFactory
}

async function loadVersion({ transport, manifest, origin, urls }: LoadVersionOptions): Promise<LoadedContent> {
  const versionInput = new TextEncoder().encode(manifest.files.map((file) => file.sha256).sort().join(''))
  const expectedVersion = hex(await globalThis.crypto.subtle.digest('SHA-256', versionInput)).slice(0, 12)
  if (manifest.version !== expectedVersion) throw new Error('Content manifest version does not match its file hashes')

  const umaFile = findRequiredFile(manifest, PACK_FILES.umas, 'umas pack')
  const cardFile = findRequiredFile(manifest, PACK_FILES.cards, 'cards pack')
  const skillFile = findRequiredFile(manifest, PACK_FILES.skills, 'skills pack')
  const raceFile = findRequiredFile(manifest, PACK_FILES.races, 'races pack')
  const courseFile = findRequiredFile(manifest, PACK_FILES.courses, 'courses pack')
  const umaAtlasFile = findRequiredFile(manifest, ATLAS_FILES['uma-icons'], 'uma-icons atlas')
  const cardAtlasFile = findRequiredFile(manifest, ATLAS_FILES['card-icons'], 'card-icons atlas')

  const [umaJson, cardJson, skillJson, raceJson, courseJson, umaAtlasJson, cardAtlasJson] = await Promise.all([
    verifiedJson(transport, umaFile),
    verifiedJson(transport, cardFile),
    verifiedJson(transport, skillFile),
    verifiedJson(transport, raceFile),
    verifiedJson(transport, courseFile),
    verifiedJson(transport, umaAtlasFile),
    verifiedJson(transport, cardAtlasFile),
  ])
  const umas = parseContentPack<UmaTemplate>(umaJson, 'uma')
  const cards = parseContentPack<SupportCardTemplate>(cardJson, 'card')
  const skills = parseContentPack<SkillTemplate>(skillJson, 'skill')
  const races = parseContentPack<RaceTemplate>(raceJson, 'race').map((race) => {
    const seriesLegs = (race as RaceTemplate & { seriesLegs?: unknown }).seriesLegs
    // The only published pre-T019 pack has zero series coverage and predates this field. Keep that pack loadable until
    // Claude publishes the private v2 override; all newly generated packs contain a strict array.
    return { ...race, seriesLegs: seriesLegs === undefined ? [] : seriesLegs } as RaceTemplate
  })
  const courses = parseContentPack<CourseTemplate>(courseJson, 'course')
  const umaAtlas = parseContentAtlas(umaAtlasJson, 'uma-icons')
  const cardAtlas = parseContentAtlas(cardAtlasJson, 'card-icons')
  assertMatchingFrames('Uma', umas.map((item) => item.id), umaAtlas)
  assertMatchingFrames('Card', cards.map((item) => item.id), cardAtlas)

  const manifestFiles = new Map(manifest.files.map((file) => [file.path, file]))
  const createdUrls: string[] = []
  try {
    const loadAtlasPages = async (atlas: ContentAtlas): Promise<LoadedAtlas> => {
      const pageUrls = await Promise.all(
        atlas.pages.map(async (page) => {
          const file = manifestFiles.get(page.path)
          if (!file) throw new Error(`Atlas page is missing from manifest: ${page.path}`)
          const result = await transport.file(file.path)
          requireContentType(result.contentType, 'webp', file.path)
          if (result.bytes.byteLength !== file.bytes) throw new Error(`Content byte length mismatch: ${file.path}`)
          const digest = hex(await globalThis.crypto.subtle.digest('SHA-256', result.bytes))
          if (digest !== file.sha256) throw new Error(`Content hash mismatch: ${file.path}`)
          const dimensions = readWebpDimensions(result.bytes)
          if (dimensions.width !== page.width || dimensions.height !== page.height) {
            throw new Error(`Atlas page dimensions do not match descriptor: ${file.path}`)
          }
          const url = urls.create(new Blob([result.bytes], { type: 'image/webp' }))
          createdUrls.push(url)
          return url
        }),
      )
      return { descriptor: atlas, pageUrls }
    }
    const [umaIcons, cardIcons] = await Promise.all([loadAtlasPages(umaAtlas), loadAtlasPages(cardAtlas)])
    return {
      manifest,
      origin,
      umas: registry(umas),
      cards: registry(cards),
      skills: registry(skills),
      races: registry(races),
      courses: registry(courses),
      atlases: { 'uma-icons': umaIcons, 'card-icons': cardIcons },
      art: createArtLoader(transport, manifest, urls, (url) => createdUrls.push(url)),
    }
  } catch (error) {
    for (const url of createdUrls) urls.revoke(url)
    throw error
  }
}

function storedManifest(store: ManifestStore): ContentManifest | null {
  const stored = store.get()
  if (!stored) return null
  try {
    const parsed = parseContentManifest(JSON.parse(stored) as unknown)
    return parsed.version === null ? null : parsed
  } catch {
    return null
  }
}

export function getContentAsset(content: LoadedContent, kind: ContentAtlasKind, id: string): ContentAsset | null {
  const atlas = content.atlases[kind]
  const frame = atlas.descriptor.frames[id]
  if (!frame) return null
  const page = atlas.descriptor.pages[frame.page]!
  return { url: atlas.pageUrls[frame.page]!, frame, pageWidth: page.width, pageHeight: page.height }
}

export class ContentRuntime {
  private active: LoadedContent | null = null
  private generation = 0

  constructor(
    private readonly transport: ContentTransport = contentApi,
    private readonly store: ManifestStore = browserManifestStore(),
    private readonly urls: ObjectUrlFactory = browserObjectUrls,
  ) {}

  private release(content: LoadedContent): void {
    for (const atlas of Object.values(content.atlases)) {
      for (const url of atlas.pageUrls) this.urls.revoke(url)
    }
  }

  private use(content: LoadedContent, generation: number): ContentLoadResult {
    if (generation !== this.generation) {
      this.release(content)
      throw new Error('Content load cancelled')
    }
    if (this.active && this.active !== content) this.release(this.active)
    this.active = content
    return { status: 'ready', content }
  }

  async load(): Promise<ContentLoadResult> {
    const generation = this.generation
    let networkManifest: ContentManifest | null = null
    let networkError: unknown
    try {
      const parsed = parseContentManifest(await this.transport.manifest())
      if (parsed.version === null) {
        this.clear()
        this.store.clear()
        return { status: 'empty' }
      }
      networkManifest = parsed
    } catch (error) {
      networkError = error
    }

    if (networkManifest) {
      if (this.active?.manifest.version === networkManifest.version) {
        return { status: 'ready', content: { ...this.active, origin: 'network' } }
      }
      try {
        const content = await loadVersion({
          transport: this.transport,
          manifest: networkManifest,
          origin: 'network',
          urls: this.urls,
        })
        const result = this.use(content, generation)
        this.store.set(JSON.stringify(networkManifest))
        return result
      } catch (error) {
        networkError = error
      }
    }

    const fallback = storedManifest(this.store)
    if (fallback) {
      if (this.active?.manifest.version === fallback.version) {
        return { status: 'ready', content: { ...this.active, origin: 'offline-cache' } }
      }
      try {
        return this.use(
          await loadVersion({ transport: this.transport, manifest: fallback, origin: 'offline-cache', urls: this.urls }),
          generation,
        )
      } catch (fallbackError) {
        throw new ContentFallbackError(networkError, fallbackError)
      }
    }
    throw networkError instanceof Error ? networkError : new Error('Content unavailable')
  }

  clear(): void {
    this.generation += 1
    if (this.active) this.release(this.active)
    this.active = null
  }
}

export const contentRuntime = new ContentRuntime()
