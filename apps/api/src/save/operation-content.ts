// Operations consume the same verified release and racer adapter as the web (SE1; docs/game/architecture.md).
import { buildOperationEnv, type OperationEnv } from '@racer/domain/save'
import type { MasterContent, MasterSnapshot } from '../master/master-content'

export const MANIFEST_TTL_MS = 60_000
export class ContentUnavailable extends Error {
  constructor() { super('Operation content is unavailable'); this.name = 'ContentUnavailable' }
}
export const devOperations = (): boolean => process.env.DEV_OPERATIONS === 'true'
export type OperationContentSource = Pick<MasterContent, 'snapshot' | 'load'>

export class OperationContent {
  private pointer: { at: number; value: Promise<MasterSnapshot> } | undefined
  private cached: { key: string; env: OperationEnv } | undefined
  private loading: { key: string; value: Promise<OperationEnv> } | undefined
  constructor(private readonly source: OperationContentSource, private readonly clock: () => number = Date.now) {}

  async env(): Promise<OperationEnv> {
    try {
      const now = this.clock()
      if (this.pointer === undefined || now - this.pointer.at >= MANIFEST_TTL_MS) this.pointer = { at: now, value: this.source.snapshot() }
      const snapshot = await this.pointer.value
      const key = `${snapshot.manifest.version}:${snapshot.overlay.version}`
      if (this.cached?.key === key) return { ...this.cached.env, dev: devOperations() }
      if (this.loading?.key !== key) {
        const value = this.source.load(snapshot).then((content) => buildOperationEnv(content))
        this.loading = { key, value }
        void value.then((env) => { this.cached = { key, env } }, () => undefined)
          .finally(() => { if (this.loading?.value === value) this.loading = undefined })
      }
      return { ...await this.loading.value, dev: devOperations() }
    } catch {
      this.pointer = undefined // A repaired publication must be retryable immediately, not only after the minute TTL.
      throw new ContentUnavailable()
    }
  }
}
