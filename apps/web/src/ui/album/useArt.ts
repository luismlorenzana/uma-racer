import { useEffect, useState } from 'react'
import type { ArtKind, LoadedContent } from '../../content/runtime'

/**
 * Resolves an entry's large private art, or `null` until it arrives. Callers keep showing the icon
 * meanwhile, so a grid never waits on a download (docs/design/collection.md#art-tiers).
 */
export function useArt(content: LoadedContent | null, kind: ArtKind, id: string | null): string | null {
  const [url, setUrl] = useState<string | null>(null)

  useEffect(() => {
    if (!content || !id || !content.art.has(kind, id)) {
      setUrl(null)
      return
    }
    let cancelled = false
    setUrl(null)
    void content.art.load(kind, id)
      .then((resolved) => { if (!cancelled) setUrl(resolved) })
      // A failed or unverifiable fetch is not an error the player needs: the icon stays.
      .catch(() => { if (!cancelled) setUrl(null) })
    return () => { cancelled = true }
  }, [content, id, kind])

  return url
}
