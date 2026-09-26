import { useEffect, useState } from 'react'
import type { LoadedContent } from '../../content/runtime'

/** Card illustrations for a set of cards, loaded on demand; a card with no published art is simply absent. */
export function useCardArt(content: LoadedContent | null, cardIds: readonly string[]): ReadonlyMap<string, string> {
  const [art, setArt] = useState<ReadonlyMap<string, string>>(new Map())
  const key = cardIds.join('\u0000')

  useEffect(() => {
    if (!content || key.length === 0) {
      setArt(new Map())
      return
    }
    let cancelled = false
    const ids = [...new Set(cardIds)]
    void Promise.all(ids.map(async (id) => {
      if (!content.art.has('card', id)) return null
      try {
        const url = await content.art.load('card', id)
        return url ? ([id, url] as const) : null
      } catch {
        return null
      }
    })).then((loaded) => {
      if (!cancelled) setArt(new Map(loaded.filter((entry): entry is readonly [string, string] => entry !== null)))
    })
    return () => { cancelled = true }
  }, [content, key])

  return art
}
