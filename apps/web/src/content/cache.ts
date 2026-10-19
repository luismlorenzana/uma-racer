// SE1's release bridge: verified immutable bytes survive a restart; metadata becomes last-good only after full boot.
import type { ReleaseFile } from '@luismlorenzana/uma-data'
export interface ByteCache { match(key: string): Promise<Response | undefined>; put(key: string, value: Response): Promise<void> }
export interface ManifestStore { get(): string | null; set(value: string): void; clear(): void }
export interface ContentTransport { read(path: string): Promise<Uint8Array> }
export const LAST_MASTER_KEY = 'uma-racer:g2:master-release'
export const MASTER_CACHE = 'uma-racer-master-v1'
export const cacheKey = (hash: string): string => `https://uma-racer.invalid/master/${hash}`
export async function digest(bytes: Uint8Array): Promise<string> {
  return [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes as Uint8Array<ArrayBuffer>))].map((n) => n.toString(16).padStart(2, '0')).join('')
}
export const validBytes = async (bytes: Uint8Array, file: ReleaseFile): Promise<boolean> => bytes.byteLength === file.bytes && await digest(bytes) === file.sha256
export const json = (bytes: Uint8Array): unknown => JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)) as unknown
export async function browserCache(): Promise<ByteCache | null> {
  try { return typeof caches === 'undefined' ? null : await caches.open(MASTER_CACHE) } catch { return null }
}
export function browserStore(): ManifestStore {
  return {
    get: () => { try { return localStorage.getItem(LAST_MASTER_KEY) } catch { return null } },
    set: (value) => { try { localStorage.setItem(LAST_MASTER_KEY, value) } catch { /* This session still works. */ } },
    clear: () => { try { localStorage.removeItem(LAST_MASTER_KEY) } catch { /* No storage. */ } },
  }
}
export class VerifiedCache {
  constructor(private readonly transport: ContentTransport, private readonly cache: Promise<ByteCache | null>) {}
  async read(path: string, file?: ReleaseFile): Promise<Uint8Array> {
    if (file === undefined) return this.transport.read(path)
    const cache = await this.cache
    const hit = await cache?.match(cacheKey(file.sha256)).catch(() => undefined)
    if (hit !== undefined) {
      const bytes = new Uint8Array(await hit.arrayBuffer())
      if (await validBytes(bytes, file)) return bytes
    }
    const bytes = await this.transport.read(path)
    if (!await validBytes(bytes, file)) throw new Error('Content hash mismatch')
    await cache?.put(cacheKey(file.sha256), new Response(bytes as Uint8Array<ArrayBuffer>)).catch(() => undefined)
    return bytes
  }
}
