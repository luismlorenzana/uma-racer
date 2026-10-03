// Lazy exact-version campaigns; never substitute a synthetic or newer chapter (T097).
import { assertProductionRpgPack, parseRpgChapterPack, parseRpgContentCatalog, type ContentManifestFile, type RpgChapterPack,
  type RpgContentCatalog, type RpgPackIdentity } from '@racer/domain'
import { contentApi } from '../api/client'
import type { ContentTransport, LoadedContent } from './runtime'

async function json(file: ContentManifestFile, transport: ContentTransport): Promise<unknown> {
  const { bytes, contentType } = await transport.file(file.path)
  if (contentType.split(';')[0]?.trim() !== 'application/json' || bytes.byteLength !== file.bytes) throw new Error('Invalid RPG chapter bytes or type')
  const hash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map((part) => part.toString(16).padStart(2, '0')).join('')
  if (hash !== file.sha256) throw new Error('RPG chapter hash mismatch')
  return JSON.parse(new TextDecoder().decode(bytes)) as unknown
}

export class RpgContentLibrary {
  private catalog: Promise<RpgContentCatalog | null> | undefined
  private packs = new Map<string, Promise<RpgChapterPack | null>>()
  constructor(private readonly content: LoadedContent, private readonly transport: ContentTransport = contentApi) {}
  private index(): Promise<RpgContentCatalog | null> {
    this.catalog ??= (async () => {
      const catalogs = this.content.manifest.files.filter(f => /^data\/rpg-catalog\.[a-f0-9]{8}\.json$/.test(f.path))
      if (catalogs.length > 1) throw new Error('RPG catalog is ambiguous')
      return catalogs[0] ? parseRpgContentCatalog(await json(catalogs[0], this.transport), this.content.manifest.files) : null
    })().catch(error => { this.catalog = undefined; throw error })
    return this.catalog
  }
  async load(identity?: RpgPackIdentity): Promise<RpgChapterPack | null> {
    const catalog = await this.index()
    const reference = catalog?.packs.find(p => p.sha256 === (identity?.contentHash ?? catalog.activeHash))
    if (catalog && (!reference || identity && identity.contentVersion !== reference.version)) throw new Error('Frozen chapter content unavailable: exact pack is not retained')
    const files = this.content.manifest.files.filter(f => /^data\/rpg-chapters\.[a-f0-9]{8}\.json$/.test(f.path))
    if (!catalog && files.length > 1) throw new Error('RPG chapter pack is ambiguous')
    const file = reference ? files.find(f => f.path === reference.path)! : files[0]
    if (!file) return null
    if (identity && file.sha256 !== identity.contentHash) throw new Error('Frozen chapter content unavailable: hash changed')
    let pending = this.packs.get(file.sha256)
    if (!pending) {
      pending = (async () => {
        const raw = await json(file, this.transport)
        const version = typeof raw === 'object' && raw !== null && 'version' in raw && typeof raw.version === 'string' ? raw.version : ''
        const artKeys = reference?.art.map(a => a.key) ?? this.content.manifest.files.flatMap(f => {
          const match = /^art\/priconne\/([A-Za-z0-9_.:-]{1,24})\.[a-f0-9]{8}\.webp$/.exec(f.path)
          return match ? [match[1]!] : []
        })
        const pack = parseRpgChapterPack(raw, { version: reference?.version ?? version, contentHash: file.sha256, artKeys })
        if (pack.schemaVersion === 2) assertProductionRpgPack(pack)
        return pack
      })().catch(error => { this.packs.delete(file.sha256); throw error })
      this.packs.set(file.sha256, pending)
    }
    const pack = await pending
    if (identity && pack?.version !== identity.contentVersion) throw new Error('Frozen chapter content unavailable: version changed')
    return pack
  }
  /** Presentation joins to the exact campaign, never to a live enemy kit. */
  async presentation(identity: RpgPackIdentity): Promise<{ names: Record<string, string>; portraits: Record<string, string> }> {
    const pack = await this.load(identity)
    if (!pack) throw new Error('Frozen chapter content unavailable')
    const catalog = await this.index()
    const reference = catalog?.packs.find(p => p.sha256 === identity.contentHash)
    const names: Record<string, string> = {}, portraits: Record<string, string> = {}
    for (const actor of pack.actors) {
      names[actor.id] = actor.name
      const path = reference?.art.find(a => a.key === actor.artKey)?.path ?? this.content.manifest.files.find(f => f.path.startsWith(`art/priconne/${actor.artKey}.`))?.path
      const file = this.content.manifest.files.find(f => f.path === path)
      if (!file) throw new Error('Frozen portrait unavailable')
      portraits[actor.id] = `${actor.artKey}-${file.sha256.slice(0, 8)}`
    }
    return { names, portraits }
  }
}
const libraries = new WeakMap<LoadedContent, RpgContentLibrary>()
export function rpgContentLibrary(content: LoadedContent): RpgContentLibrary {
  let library = libraries.get(content)
  if (!library) { library = new RpgContentLibrary(content); libraries.set(content, library) }
  return library
}
export function loadRpgChapterPack(content: LoadedContent, transport: ContentTransport = contentApi, identity?: RpgPackIdentity): Promise<RpgChapterPack | null> {
  return new RpgContentLibrary(content, transport).load(identity)
}
