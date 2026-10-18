import { useEffect, useState } from 'react'
import type { ArtKind, LoadedContent } from '../content/runtime'

/**
 * Resolves an entry's large private art, or `null` until it arrives. Callers keep showing the icon
 * meanwhile, so a grid never waits on a download (docs/design/ux.md#art-tiers).
 */
export function useArt(content: LoadedContent | null, kind: ArtKind, id: string | null): string | null {
  const [loaded, setLoaded] = useState<{ content: LoadedContent; kind: ArtKind; id: string; url: string } | null>(null)

  useEffect(() => {
    if (!content || !id || !content.art.has(kind, id)) {
      setLoaded(null)
      return
    }
    let cancelled = false
    setLoaded(null)
    // Held while shown, so another screen's loads can never revoke it underneath this one.
    const release = content.art.hold?.(kind, id)
    void content.art.load(kind, id)
      .then((url) => { if (!cancelled && url !== null) setLoaded({ content, kind, id, url }) })
      // A failed or unverifiable fetch is not an error the player needs: the icon stays.
      .catch(() => { if (!cancelled) setLoaded(null) })
    return () => {
      cancelled = true
      release?.()
    }
  }, [content, id, kind])

  return loaded?.content === content && loaded.kind === kind && loaded.id === id ? loaded.url : null
}
