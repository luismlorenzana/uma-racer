// The content every operation reads (docs/rework/13-removals-and-plan-changes.md §6, §8; T135): the private `umas`,
// `races`, `cards` and `skills` packs, verified against the manifest and built into T134's `buildOperationEnv`, as the
// web builds its own, so the device's numbers and the server's come from one function. The server runs on its current
// content, not the device's version. Never logs or returns a path, a row or a private value.
import { buildOperationEnv, type OperationEnv, type OperationPacks } from '@racer/domain/save'
import type { ContentManifest, ContentService } from '../content/content.service'

/** Each pack the operations read, by the web's patterns (`apps/web/src/content/runtime.ts`). */
export const OPERATION_PACK_FILES: Readonly<Record<keyof OperationPacks, RegExp>> = Object.freeze({
  umas: /^data\/umas\.[a-f0-9]{8}\.json$/,
  races: /^data\/races\.[a-f0-9]{8}\.json$/,
  cards: /^data\/cards\.[a-f0-9]{8}\.json$/,
  skills: /^data\/skills\.[a-f0-9]{8}\.json$/,
})

/** The manifest is re-read at most once a minute, so a publish takes effect within one. */
export const MANIFEST_TTL_MS = 60_000

/** A pack is missing or failed: the controller's 503 `{ code: 'content-unavailable' }`, with nothing written. */
export class ContentUnavailable extends Error {
  constructor() {
    super('Operation content is unavailable')
    this.name = 'ContentUnavailable'
  }
}

/** The two reads this needs from `ContentService`. */
export type OperationContentSource = Pick<ContentService, 'manifest' | 'readVerifiedJson'>

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)

/** `{ version, items[] }` with a unique non-empty id on every item, as the web's `parseContentPack` checks. */
function parsePack(value: unknown): Record<string, unknown>[] {
  if (!isRecord(value) || typeof value.version !== 'string' || !Array.isArray(value.items)) throw new Error('Invalid content pack')
  const ids = new Set<string>()
  for (const item of value.items) {
    if (!isRecord(item) || typeof item.id !== 'string' || item.id.length === 0 || ids.has(item.id)) throw new Error('Invalid content pack item')
    ids.add(item.id)
  }
  return value.items as Record<string, unknown>[]
}

/** Whether `DEV_OPERATIONS=true`: only then does `dev-grant` run (M034). The deploy never sets it. */
export const devOperations = (): boolean => process.env.DEV_OPERATIONS === 'true'

/**
 * The operation env, cached per manifest version; the manifest is re-read at most once a minute. A missing, ambiguous or
 * failed pack is `ContentUnavailable`, and a failed load is tried again on the next call.
 */
export class OperationContent {
  private manifestRead: { readonly at: number; readonly manifest: Promise<ContentManifest> } | undefined
  private cached: { readonly version: string; readonly env: OperationEnv } | undefined
  private loading: { readonly version: string; readonly env: Promise<OperationEnv> } | undefined

  constructor(private readonly content: OperationContentSource, private readonly clock: () => number = Date.now) {}

  /** The env for `commitOperation`, with `dev` from `DEV_OPERATIONS`. */
  async env(): Promise<OperationEnv> {
    return { ...(await this.base()), dev: devOperations() }
  }

  private async base(): Promise<OperationEnv> {
    const now = this.clock()
    if (this.manifestRead === undefined || now - this.manifestRead.at >= MANIFEST_TTL_MS) {
      this.manifestRead = { at: now, manifest: this.content.manifest() }
    }
    let manifest: ContentManifest
    try {
      manifest = await this.manifestRead.manifest
    } catch {
      throw new ContentUnavailable()
    }
    const version = manifest.version
    if (typeof version !== 'string' || version.length === 0 || !Array.isArray(manifest.files)) throw new ContentUnavailable()
    if (this.cached?.version === version) return this.cached.env
    if (this.loading?.version !== version) {
      const env = this.load(manifest)
      this.loading = { version, env }
      env.then((built) => { this.cached = { version, env: built } }, () => undefined)
        .finally(() => { if (this.loading?.env === env) this.loading = undefined })
    }
    return this.loading!.env
  }

  private async load(manifest: ContentManifest): Promise<OperationEnv> {
    try {
      const read = async (pack: keyof OperationPacks): Promise<Record<string, unknown>[]> => {
        const files = manifest.files.filter((file) => OPERATION_PACK_FILES[pack].test(file.path))
        if (files.length !== 1) throw new Error('One pack of each')
        return parsePack(await this.content.readVerifiedJson(files[0]!))
      }
      const [umas, races, cards, skills] = await Promise.all([read('umas'), read('races'), read('cards'), read('skills')])
      // The packs are the importer's templates; `parsePack` checks their envelope and ids, as the web does.
      return buildOperationEnv({ umas, races, cards, skills } as unknown as OperationPacks)
    } catch {
      throw new ContentUnavailable()
    }
  }
}
