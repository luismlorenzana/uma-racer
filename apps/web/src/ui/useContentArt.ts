// Only game art identities live here; the kit owns held loading, fallback and stale-request protection (SE4).
import { imagePath, useArtUrl, type ArtSource } from '@luismlorenzana/uma-kit/content'
import { useMemo } from 'react'
import type { ArtKind, LoadedContent } from '../content/view'

const FAMILIES = { face: 'outfit-faces', bust: 'outfit-busts', chibi: 'outfit-chibis', uma: 'outfit-portraits', card: 'support-card-art', dress: 'character-dresses' } as const
export function useArtCandidates(content: LoadedContent | null, candidates: readonly { kind: ArtKind; id: string }[]): string | null {
  const source = useMemo<ArtSource | null>(() => content === null ? null : content.shared?.client ?? {
    // Synthetic seeds/test doubles implement the same port without creating an authenticated runtime.
    artUrl: async (key) => { const [kind, id] = JSON.parse(key) as [ArtKind, string]; const url = await content.art.load(kind, id); if (url === null) throw new Error('No image'); return url },
    hold: (key) => { const [kind, id] = JSON.parse(key) as [ArtKind, string]; return content.art.hold?.(kind, id) ?? (() => {}) },
  }, [content])
  const paths = content === null ? [] : candidates.flatMap(({ kind, id }) => {
    if (!content.art.has(kind, id)) return []
    const path = content.shared ? imagePath(content.shared.index, FAMILIES[kind], id) : JSON.stringify([kind, id])
    return path === null ? [] : [path]
  })
  return useArtUrl(paths, source)
}
export function useArt(content: LoadedContent | null, kind: ArtKind, id: string | null): string | null {
  return useArtCandidates(content, id === null ? [] : [{ kind, id }])
}
