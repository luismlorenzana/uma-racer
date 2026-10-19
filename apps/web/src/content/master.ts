// Platform release → one pure racer adapter. This bridge keeps the game port and last-good offline boot (SE1).
import { createReleaseClient, parseReleaseManifest, SET_NAMES, MASTER_DATA_KEYS, type MasterData, type ReleaseManifest, type Atlas, type AtlasFamily } from '@luismlorenzana/uma-data'
import { adaptMaster, parseOverlayIndex, parseRacerOverlays, type OverlayIndex } from '@racer/domain/master'
import type { ContentAtlas, ContentAtlasKind } from '@racer/domain'
import { masterApi, ApiError } from '../api/client'
import { browserCache, browserStore, json, VerifiedCache, type ByteCache, type ContentTransport, type ManifestStore } from './cache'
import { releaseArt } from './art'
import { ContentFallbackError } from './errors'
import type { ContentLoadResult, LoadedContent, LoadedAtlas, ObjectUrlFactory } from './view'

const FAMILIES: Record<ContentAtlasKind, AtlasFamily> = { 'uma-icons': 'outfit-icons', 'card-icons': 'support-card-icons', 'scenario-icons': 'scenario-icons', 'skill-icons': 'skill-icons' }
const registry = <T extends { id: string }>(items: T[]) => ({ items: Object.freeze([...items]), byId: new Map(items.map((item) => [item.id, item])) })
const URLS: ObjectUrlFactory = { create: (blob) => URL.createObjectURL(blob), revoke: (url) => URL.revokeObjectURL(url) }
interface Snapshot { manifest: ReleaseManifest; overlay: OverlayIndex }
interface Version { content: LoadedContent; dispose(): void }

export class MasterRuntime {
  private generation = 0
  private active: Version | null = null
  private readonly bytes: VerifiedCache
  constructor(private readonly transport: ContentTransport = masterApi, private readonly store: ManifestStore = browserStore(),
    private readonly urls: ObjectUrlFactory = URLS, cache?: ByteCache | null | Promise<ByteCache | null>) {
    this.bytes = new VerifiedCache(transport, cache === undefined ? browserCache() : Promise.resolve(cache))
  }
  private async version(snapshot: Snapshot, origin: LoadedContent['origin']): Promise<Version> {
    const files = new Map(snapshot.manifest.files.map((file) => [file.path, file]))
    const client = createReleaseClient({ source: { read: (path) => this.bytes.read(`master/${path}`, path.startsWith('files/') ? files.get(path.slice(6)) : undefined) } })
    const [sets, art, overlayBytes] = await Promise.all([
      Promise.all(SET_NAMES.map(async (name) => [MASTER_DATA_KEYS[name], await client.set(snapshot.manifest, name)] as const)),
      client.art(snapshot.manifest), this.bytes.read(`content/${snapshot.overlay.file.path}`, snapshot.overlay.file),
    ])
    // SET_NAMES and MASTER_DATA_KEYS are the package's exhaustive registry; parsers ran in client.set above.
    const master = Object.fromEntries(sets) as unknown as MasterData
    const adapted = adaptMaster(master, parseRacerOverlays(json(overlayBytes)))
    const created: string[] = []
    let disposed = false
    const held = releaseArt(art, (path) => client.file(snapshot.manifest, path), this.urls)
    const dispose = () => { if (disposed) return; disposed = true; held.dispose(); for (const url of created) this.urls.revoke(url) }
    try {
      const atlas = async (kind: ContentAtlasKind): Promise<LoadedAtlas> => {
        const source: Atlas = art?.atlases[FAMILIES[kind]] ?? { frameWidth: 128, frameHeight: 128, frames: {}, pages: [] }
        const pages = await Promise.all(source.pages.map(async (page) => {
          const bytes = await client.file(snapshot.manifest, page.path)
          if (disposed) throw new Error('Content load cancelled')
          const url = this.urls.create(new Blob([bytes as Uint8Array<ArrayBuffer>], { type: 'image/webp' })); created.push(url); return url
        }))
        const frames = Object.fromEntries(Object.entries(source.frames).map(([id, frame]) => {
          if (frame.width !== 128 || frame.height !== 128) throw new Error('Malformed master atlas frame')
          return [kind === 'scenario-icons' ? adapted.scenarioIds.get(id) ?? id : id, { ...frame, width: 128 as const, height: 128 as const }]
        }))
        const descriptor: ContentAtlas = { ...source, schemaVersion: 1, kind, frameWidth: 128, frameHeight: 128, frames }
        return { descriptor, pageUrls: pages }
      }
      const [umas, cards, scenarios, skills] = await Promise.all([atlas('uma-icons'), atlas('card-icons'), atlas('scenario-icons'), atlas('skill-icons')])
      const content: LoadedContent = { manifest: snapshot.manifest, origin,
        umas: registry(adapted.content.umas), cards: registry(adapted.content.cards), skills: registry(adapted.content.skills),
        races: registry(adapted.content.races), courses: registry(adapted.content.courses),
        atlases: { 'uma-icons': umas, 'card-icons': cards, 'scenario-icons': scenarios, 'skill-icons': skills }, art: held.loader }
      return { content, dispose }
    } catch (error) { dispose(); throw error }
  }
  async load(): Promise<ContentLoadResult> {
    const generation = this.generation
    const use = (version: Version) => {
      if (this.generation !== generation) { version.dispose(); throw new Error('Content load cancelled') }
      this.active?.dispose(); this.active = version
      return { status: 'ready' as const, content: version.content }
    }
    let networkError: unknown
    try {
      const client = createReleaseClient({ source: { read: (path) => this.transport.read(`master/${path}`) } })
      const [manifest, raw] = await Promise.all([client.manifest(), this.transport.read('content/overlay.json')])
      const snapshot = { manifest, overlay: parseOverlayIndex(json(raw)) }
      const result = use(await this.version(snapshot, 'network'))
      this.store.set(JSON.stringify(snapshot))
      return result
    } catch (error) {
      if (this.generation !== generation || error instanceof ApiError && (error.status === 401 || error.status === 403)) throw error
      networkError = error
    }
    const stored = this.store.get()
    if (stored !== null) try {
      const raw = JSON.parse(stored) as { manifest: unknown; overlay: unknown }
      const snapshot = { manifest: parseReleaseManifest(raw.manifest, 'cached manifest'), overlay: parseOverlayIndex(raw.overlay) }
      return use(await this.version(snapshot, 'offline-cache'))
    } catch (error) { throw new ContentFallbackError(networkError, error) }
    throw networkError
  }
  clear(): void { this.generation += 1; this.active?.dispose(); this.active = null }
}
export const contentRuntime = new MasterRuntime()
