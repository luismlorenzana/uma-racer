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

/**
 * Several entries' art at once (a minigame's cast), keyed by id. Each arrives as it loads and stays, so a board that
 * re-renders on every move never flickers back to the icon.
 */
export function useArtSet(content: LoadedContent | null, kind: ArtKind, ids: readonly string[]): ReadonlyMap<string, string> {
  const key = ids.join('|')
  const [urls, setUrls] = useState<ReadonlyMap<string, string>>(new Map())

  useEffect(() => {
    setUrls(new Map())
    if (!content || !key) return
    let cancelled = false
    const releases: (() => void)[] = []
    for (const id of key.split('|')) {
      if (!content.art.has(kind, id)) continue
      const release = content.art.hold?.(kind, id)
      if (release) releases.push(release)
      void content.art.load(kind, id)
        .then((url) => { if (!cancelled && url) setUrls((current) => new Map(current).set(id, url)) })
        // As with useArt, a failed fetch just leaves the icon.
        .catch(() => undefined)
    }
    return () => {
      cancelled = true
      for (const release of releases) release()
    }
  }, [content, key, kind])

  return urls
}
