// An Uma's private art, in a lazy chunk that loads only when content is mounted (T137): the first of `kinds` the
// manifest carries, fetched once she is on screen, then her `uma-icons` outfit icon, then the fallback (her initial).
// Faces are today's `face` art until phase 5's `character-faces` (M034); the plaza uses `chibi` `-a`, then `bust`.
import { useEffect, useRef, useState, type ReactNode, type RefObject } from 'react'
import { getContentAsset, type ArtKind, type LoadedContent } from '../content/runtime'
import { AtlasSprite } from './AtlasSprite'

export type UmaArtKind = Extract<ArtKind, 'face' | 'chibi' | 'bust'>

function useOnScreen(target: RefObject<HTMLElement | null>): boolean {
  const [seen, setSeen] = useState(false)
  useEffect(() => {
    const element = target.current
    if (seen || element === null) return
    if (typeof IntersectionObserver === 'undefined') {
      setSeen(true)
      return
    }
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) setSeen(true)
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [seen, target])
  return seen
}

export default function ContentArt({ content, outfitId, kinds, size, fallback, className = '' }: {
  content: LoadedContent
  outfitId: string
  kinds: readonly UmaArtKind[]
  size: number
  fallback: ReactNode
  className?: string
}) {
  const box = useRef<HTMLSpanElement>(null)
  const visible = useOnScreen(box)
  const [url, setUrl] = useState<string | null>(null)
  const charaId = content.umas.byId.get(outfitId)?.charaId
  const candidates = kinds
    .map((kind) => ({ kind, id: kind === 'face' ? charaId : kind === 'chibi' ? `${outfitId}-a` : outfitId }))
    .filter((entry): entry is { kind: UmaArtKind; id: string } => entry.id !== undefined && content.art.has(entry.kind, entry.id))
  const key = candidates.map((entry) => `${entry.kind}:${entry.id}`).join(',')

  useEffect(() => {
    if (!visible || key === '') return
    let live = true
    const releases: (() => void)[] = []
    void (async () => {
      for (const { kind, id } of candidates) {
        try {
          const release = content.art.hold?.(kind, id)
          if (release) releases.push(release)
          const loaded = await content.art.load(kind, id)
          if (loaded !== null) {
            if (live) setUrl(loaded)
            return
          }
        } catch {
          // The next kind, then the outfit icon.
        }
      }
    })()
    return () => {
      live = false
      for (const release of releases) release()
    }
    // `key` names the candidates; the array itself is rebuilt each render.
  }, [visible, key, content])

  const icon = getContentAsset(content, 'uma-icons', outfitId)
  return (
    <span ref={box} className={`relative block overflow-hidden ${className}`} style={{ width: size, height: size }}>
      {url !== null
        ? <img src={url} alt="" aria-hidden draggable={false} className="size-full object-cover object-top" />
        : icon !== null ? <AtlasSprite asset={icon} decorative className="size-full" /> : fallback}
    </span>
  )
}
