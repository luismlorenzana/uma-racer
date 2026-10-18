// SB6: uma-kit's album draws the art; only this adapter knows the racer's authenticated content runtime. Today's
// face pack is per character (SB6's explicit SE1 fallback); busts and plaza chibis are per outfit. No public image URLs.
import { AlbumArtProvider, type AlbumArt, type UmaArtKind } from '@luismlorenzana/uma-kit/album'
import { useEffect, useState, type ReactNode } from 'react'
import type { ArtKind, ContentAsset, LoadedContent } from '../content/runtime'
import { AtlasSprite } from '../ui/AtlasSprite'
import { initialOf, useUmaName } from '../ui/uma'
import { useG2Content } from './content'

export function albumArtCandidates(content: LoadedContent, kind: UmaArtKind, outfitId: string): readonly { kind: ArtKind; id: string }[] {
  const character = content.umas.byId.get(outfitId)?.charaId
  if (kind === 'face') return character === undefined ? [] : [{ kind: 'face', id: character }]
  if (kind === 'bust') return [{ kind: 'bust', id: outfitId }]
  if (kind === 'chibi') return [{ kind: 'chibi', id: `${outfitId}-a` }, { kind: 'bust', id: outfitId }]
  return []
}

export function outfitIcon(content: LoadedContent, outfitId: string): ContentAsset | null {
  const atlas = content.atlases['uma-icons']
  const frame = atlas.descriptor.frames[outfitId]
  const page = frame === undefined ? undefined : atlas.descriptor.pages[frame.page]
  return frame === undefined || page === undefined ? null
    : { frame, url: atlas.pageUrls[frame.page]!, pageWidth: page.width, pageHeight: page.height }
}

// Only callers asking for an icon URL need a crop. FaceTile's fallback draws the atlas directly, without making a
// new image per tile. Data URLs are scoped to the loaded content and share its lifetime; no unbounded Blob URL cache.
const icons = new WeakMap<LoadedContent, Map<string, Promise<string | null>>>()
function iconUrl(content: LoadedContent, outfitId: string): Promise<string | null> {
  let cache = icons.get(content)
  if (cache === undefined) { cache = new Map(); icons.set(content, cache) }
  const pending = cache.get(outfitId)
  if (pending !== undefined) return pending
  const asset = outfitIcon(content, outfitId)
  if (asset === null) return Promise.resolve(null)
  const request = (async () => {
    try {
      const image = new Image()
      image.src = asset.url
      await image.decode()
      const canvas = document.createElement('canvas')
      canvas.width = asset.frame.width
      canvas.height = asset.frame.height
      const ctx = canvas.getContext('2d')
      if (ctx === null) return null
      const { x, y, width, height } = asset.frame
      ctx.drawImage(image, x, y, width, height, 0, 0, width, height)
      return canvas.toDataURL('image/png')
    } catch { return null }
  })()
  cache.set(outfitId, request)
  return request
}

function useUrl(kind: UmaArtKind, outfitId: string): string | null {
  const content = useG2Content()
  const [loaded, setLoaded] = useState<{ content: LoadedContent; kind: UmaArtKind; id: string; url: string } | null>(null)
  useEffect(() => {
    if (content === null) return
    let live = true
    const releases: (() => void)[] = []
    void (async () => {
      if (kind === 'icon') {
        const url = await iconUrl(content, outfitId)
        if (live && url !== null) setLoaded({ content, kind, id: outfitId, url })
        return
      }
      for (const candidate of albumArtCandidates(content, kind, outfitId)) {
        if (!live) return
        if (!content.art.has(candidate.kind, candidate.id)) continue
        const release = content.art.hold?.(candidate.kind, candidate.id)
        if (release !== undefined) releases.push(release)
        try {
          const url = await content.art.load(candidate.kind, candidate.id)
          if (url !== null) {
            if (live) setLoaded({ content, kind, id: outfitId, url })
            return
          }
        } catch { /* A missing or unverifiable image keeps the outfit icon, not broken art. */ }
      }
    })()
    return () => { live = false; for (const release of releases) release() }
  }, [content, kind, outfitId])
  // Never flash a previous outfit's image while a new request is starting, including after a content refresh.
  return loaded?.content === content && loaded.kind === kind && loaded.id === outfitId ? loaded.url : null
}

function Fallback({ outfitId, size }: { outfitId: string; size: number }) {
  const content = useG2Content()
  const name = useUmaName(outfitId)
  const asset = content === null ? null : outfitIcon(content, outfitId)
  return asset !== null ? <AtlasSprite asset={asset} decorative className="size-full" /> : (
    <span aria-hidden className="font-display flex size-full items-center justify-center bg-sunken font-bold text-ink-soft"
      style={{ fontSize: Math.round(size * 0.5) }}>{initialOf(name)}</span>
  )
}

const RACER_ALBUM_ART: AlbumArt = { useUrl, Fallback }

export function RacerAlbumArtProvider({ children }: { children: ReactNode }) {
  return <AlbumArtProvider art={RACER_ALBUM_ART}>{children}</AlbumArtProvider>
}
