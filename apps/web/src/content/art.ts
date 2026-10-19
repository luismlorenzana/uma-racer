// Small held object-URL windows for release art; only the plaza asks for chibis (SE1 / SB6).
import type { ArtIndex, ImageFamily } from '@luismlorenzana/uma-data'
import type { ArtKind, ArtLoader, ObjectUrlFactory } from './view'
export const ART_FAMILIES: Record<ArtKind, ImageFamily> = {
  uma: 'outfit-portraits', card: 'support-card-art', bust: 'outfit-busts', chibi: 'outfit-chibis', dress: 'character-dresses', face: 'outfit-faces',
}
const LIMIT: Record<ArtKind, number> = { uma: 24, card: 24, bust: 320, chibi: 64, dress: 24, face: 320 }
export function releaseArt(art: ArtIndex | null, load: (path: string) => Promise<Uint8Array>, urls: ObjectUrlFactory): { loader: ArtLoader; dispose(): void } {
  const entries = new Map<string, string>(), holds = new Map<string, number>(), pending = new Map<string, Promise<string | null>>()
  let disposed = false
  const image = (kind: ArtKind, id: string) => art?.images[ART_FAMILIES[kind]]?.[id]
  const trim = (kind: ArtKind, newest?: string) => {
    const keys = [...entries.keys()].filter((key) => key.startsWith(`${kind}:`))
    let excess = keys.length - LIMIT[kind]
    for (const key of keys) if (excess > 0 && key !== newest && !holds.has(key)) { urls.revoke(entries.get(key)!); entries.delete(key); excess -= 1 }
  }
  return {
    loader: {
      has: (kind, id) => image(kind, id) !== undefined,
      hold: (kind, id) => {
        const key = `${kind}:${id}`
        holds.set(key, (holds.get(key) ?? 0) + 1)
        let released = false
        return () => { if (released) return; released = true; const n = (holds.get(key) ?? 1) - 1; if (n > 0) holds.set(key, n); else holds.delete(key); trim(kind) }
      },
      load: async (kind, id) => {
        if (disposed) return null
        const file = image(kind, id), key = `${kind}:${id}`
        const hit = entries.get(key)
        if (hit !== undefined) { entries.delete(key); entries.set(key, hit); return hit }
        if (file === undefined) return null
        if (!pending.has(key)) {
          const request = load(file.path).then((bytes) => {
            if (disposed) return null
            const url = urls.create(new Blob([bytes as Uint8Array<ArrayBuffer>], { type: 'image/webp' }))
            entries.set(key, url); trim(kind, key); return url
          }).finally(() => pending.delete(key))
          pending.set(key, request)
        }
        return pending.get(key)!
      },
    },
    dispose: () => { disposed = true; for (const url of entries.values()) urls.revoke(url); entries.clear() },
  }
}
