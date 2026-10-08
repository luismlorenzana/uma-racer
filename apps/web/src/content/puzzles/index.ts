// Lazy, authenticated, exact-hash PAD presentation with held atlas URLs (docs/technical/puzzle-content.md).
import { assertPuzzleArtJoin, parsePuzzleAtlas, parsePuzzleContentCatalog, parsePuzzleContentPack, puzzleCastForContent,
  PUZZLE_CATALOG_PATH, PUZZLE_CONTENT_LIMITS as L, puzzleWebpMetadata, type ContentManifest, type ContentManifestFile, type PuzzleAtlas,
  type PuzzleContentPack, type PuzzlePackIdentity } from '@racer/domain'
import { contentApi } from '../../api/client'
import type { ContentTransport, ObjectUrlFactory } from '../runtime'

export class PuzzleContentError extends Error {
  constructor(readonly reason: 'missing' | 'invalid' | 'unsupported' | 'network', message: string) { super(message); this.name = 'PuzzleContentError' }
}
export function puzzleContentDiagnostic(error: unknown): string {
  const reason = error instanceof PuzzleContentError ? error.reason : error instanceof Error && /unsupported|incompatible/.test(error.message) ? 'unsupported' : 'invalid'
  return { missing: 'The required immutable content pack is not published or retained.', invalid: 'Required content or art did not pass verification.',
    unsupported: 'This content needs a compatible app version.', network: 'The authenticated content request is unavailable; retry when connected.' }[reason]
}
export interface PuzzlePresentationLease {
  identity: PuzzlePackIdentity; pack: PuzzleContentPack; cast: ReturnType<typeof puzzleCastForContent>; atlas: PuzzleAtlas
  pageUrls: readonly string[]; release: () => void
}
interface Pack { identity: PuzzlePackIdentity; pack: PuzzleContentPack; atlas: PuzzleAtlas }
interface Page { url: string }
async function browserDecode(blob: Blob): Promise<void> {
  if (typeof createImageBitmap === 'function') { const bitmap = await createImageBitmap(blob); bitmap.close(); return }
  const url = URL.createObjectURL(blob)
  try { const image = new Image(); image.src = url; await image.decode() } finally { URL.revokeObjectURL(url) }
}
export class PuzzleContentLibrary {
  private catalog: ReturnType<typeof this.indexRequest> | undefined
  private packs = new Map<string, Promise<Pack>>()
  private pages = new Map<string, Page>()
  private pendingPages = new Map<string, Promise<string>>()
  private holds = new Map<string, number>()
  constructor(private readonly manifest: ContentManifest, private readonly transport: ContentTransport = contentApi,
    private readonly urls: ObjectUrlFactory = { create: b => URL.createObjectURL(b), revoke: u => URL.revokeObjectURL(u) },
    private readonly decode: (blob: Blob) => Promise<void> = browserDecode) {}
  private async bytes(file: ContentManifestFile, mime: string, max: number): Promise<ArrayBuffer> {
    if (!Number.isSafeInteger(file.bytes) || file.bytes <= 0 || file.bytes > max || !/^[a-f0-9]{64}$/.test(file.sha256) ||
      !file.path.includes(`.${file.sha256.slice(0, 8)}.`)) throw new PuzzleContentError('invalid', 'Content exceeds bounds or addressed hash mismatch')
    let response: Awaited<ReturnType<ContentTransport['file']>>
    try { response = await this.transport.file(file.path) } catch { throw new PuzzleContentError('network', 'Authenticated content request unavailable') }
    if (response.contentType.split(';')[0]?.trim().toLowerCase() !== mime || response.bytes.byteLength !== file.bytes) throw new PuzzleContentError('invalid', 'Content type/length mismatch')
    const digest = [...new Uint8Array(await crypto.subtle.digest('SHA-256', response.bytes))].map(b => b.toString(16).padStart(2, '0')).join('')
    if (digest !== file.sha256) throw new PuzzleContentError('invalid', 'Content integrity mismatch')
    return response.bytes
  }
  private async json(file: ContentManifestFile): Promise<unknown> {
    return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(await this.bytes(file, 'application/json', L.jsonBytes))) as unknown
  }
  private reference(file: ContentManifestFile): ContentManifestFile {
    const found = this.manifest.files.find(f => f.path === file.path && f.bytes === file.bytes && f.sha256 === file.sha256)
    if (!found) throw new PuzzleContentError('missing', 'Exact content object is not retained')
    return found
  }
  private async indexRequest() {
    const files = this.manifest.files.filter(f => PUZZLE_CATALOG_PATH.test(f.path))
    if (!files.length) throw new PuzzleContentError('missing', 'Verified Puzzle catalog is absent')
    if (files.length !== 1) throw new PuzzleContentError('invalid', 'Ambiguous Puzzle catalog')
    return parsePuzzleContentCatalog(await this.json(files[0]!), this.manifest.files)
  }
  private index() {
    this.catalog ??= this.indexRequest().catch(error => { this.catalog = undefined; throw error })
    return this.catalog
  }
  async load(identity?: PuzzlePackIdentity): Promise<Pack> {
    const catalog = await this.index(), reference = catalog.packs.find(p => p.sha256 === (identity?.contentHash ?? catalog.activeHash))
    if (!reference || identity && identity.version !== reference.version) throw new PuzzleContentError('missing', 'Frozen Puzzle pack is not retained')
    let request = this.packs.get(reference.sha256)
    if (!request) {
      request = (async () => {
        const pack = parsePuzzleContentPack(await this.json(reference))
        if (pack.version !== reference.version) throw new PuzzleContentError('invalid', 'Immutable pack version mismatch')
        const atlas = parsePuzzleAtlas(await this.json(this.reference(pack.atlas)))
        assertPuzzleArtJoin(pack, atlas)
        atlas.pages.forEach(page => this.reference(page))
        return { identity: { version: pack.version, contentHash: reference.sha256 }, pack, atlas }
      })().catch(error => { this.packs.delete(reference.sha256); throw error })
      this.packs.set(reference.sha256, request)
    } else { this.packs.delete(reference.sha256); this.packs.set(reference.sha256, request) }
    const pack = await request
    // Evict only resolved metadata; active leases own their immutable pack directly.
    while (this.packs.size > L.cachedPacks) this.packs.delete(this.packs.keys().next().value!)
    return pack
  }
  private evict(): void {
    for (const [hash, page] of this.pages) {
      if (this.pages.size <= L.cachedPages) break
      if (this.holds.has(hash)) continue
      this.urls.revoke(page.url); this.pages.delete(hash)
    }
  }
  private page(file: PuzzleAtlas['pages'][number]): Promise<string> {
    const cached = this.pages.get(file.sha256)
    if (cached) { this.pages.delete(file.sha256); this.pages.set(file.sha256, cached); return Promise.resolve(cached.url) }
    let request = this.pendingPages.get(file.sha256)
    if (!request) {
      request = (async () => {
        const bytes = await this.bytes(this.reference(file), 'image/webp', L.imageBytes), dimensions = puzzleWebpMetadata(new Uint8Array(bytes))
        if (dimensions.width !== file.width || dimensions.height !== file.height) throw new PuzzleContentError('invalid', 'Atlas dimensions mismatch')
        const blob = new Blob([bytes], { type: 'image/webp' }); await this.decode(blob)
        const url = this.urls.create(blob); this.pages.set(file.sha256, { url }); this.evict(); return url
      })().finally(() => this.pendingPages.delete(file.sha256))
      this.pendingPages.set(file.sha256, request)
    }
    return request
  }
  /** Verify ALL art before entry; no null texture/fallback may create a rewarded battle. */
  async acquire(identity?: PuzzlePackIdentity): Promise<PuzzlePresentationLease> {
    const loaded = await this.load(identity), hashes = loaded.atlas.pages.map(p => p.sha256)
    hashes.forEach(hash => this.holds.set(hash, (this.holds.get(hash) ?? 0) + 1))
    let released = false
    const release = () => { if (released) return; released = true
      hashes.forEach(hash => { const count = this.holds.get(hash)! - 1; if (count) this.holds.set(hash, count); else this.holds.delete(hash) }); this.evict()
    }
    try {
      // Wait for every request to settle before releasing a failed acquire's holds.
      const settled = await Promise.allSettled(loaded.atlas.pages.map(page => this.page(page)))
      const failed = settled.find(p => p.status === 'rejected')
      if (failed?.status === 'rejected') {
        if (failed.reason instanceof PuzzleContentError && failed.reason.reason === 'network') throw failed.reason
        throw new PuzzleContentError('invalid', 'Required Puzzle art unavailable or invalid')
      }
      return { ...loaded, cast: puzzleCastForContent(loaded.pack, `puzzles-${loaded.identity.contentHash}`),
        pageUrls: settled.map(p => (p as PromiseFulfilledResult<string>).value), release }
    } catch (error) { release(); throw error }
  }

  async acquireHash(contentHash: string): Promise<PuzzlePresentationLease> {
    const catalog = await this.index(), ref = catalog.packs.find(p => p.sha256 === contentHash)
    if (!ref) throw new PuzzleContentError('missing', 'The frozen replacement pack is not retained')
    return this.acquire({ version: ref.version, contentHash })
  }
  /** Explicit teardown may drop unheld pages, never art another visible scene leases. */
  clear(): void {
    this.packs.clear(); this.catalog = undefined
    for (const [hash, page] of this.pages) if (!this.holds.has(hash)) { this.urls.revoke(page.url); this.pages.delete(hash) }
  }
}
const libraries = new WeakMap<ContentManifest, PuzzleContentLibrary>()
export function puzzleContentLibrary(manifest: ContentManifest): PuzzleContentLibrary {
  let library = libraries.get(manifest)
  if (!library) { library = new PuzzleContentLibrary(manifest); libraries.set(manifest, library) }
  return library
}
