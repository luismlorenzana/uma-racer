import { m, useReducedMotion } from 'motion/react'
import { useState, type ReactNode } from 'react'
import type { ArtKind, ContentAsset, LoadedContent } from '../../content/runtime'
import { ArtViewer, ExpandMark } from '../ArtViewer'
import { AtlasSprite } from '../AtlasSprite'
import { Placeholder } from '../Placeholder'
import { useArt } from './useArt'

/**
 * The reserved area above the grid: the selected entry, large, with its details
 * (docs/design/collection.md#layout-dense-grid-reserved-detail). Browsing fills this instead of
 * opening a sheet, so the grid never goes away.
 */
export function AlbumDetail({
  content,
  kind,
  id,
  icon,
  alt,
  /** Portraits sit on a tinted stage; card illustrations fill their frame. */
  frame = 'portrait',
  children,
  empty,
}: {
  content: LoadedContent
  kind: ArtKind
  id: string | null
  icon: ContentAsset | null
  alt: string
  frame?: 'portrait' | 'art'
  children?: ReactNode
  empty?: ReactNode
}) {
  const art = useArt(content, kind, id)
  const reducedMotion = useReducedMotion()
  const [viewing, setViewing] = useState(false)

  if (!id) {
    return (
      <section className="rounded-md border border-hairline bg-panel p-4 text-center text-[13px] text-ink-soft">
        {empty ?? 'Select an entry to see its details.'}
      </section>
    )
  }

  return (
    <section className="relative isolate overflow-hidden rounded-md border border-hairline bg-panel shadow-1">
      <div className={`flex gap-3 p-3 ${frame === 'art' ? 'items-start' : 'items-stretch'}`}>
        <div
          className={`relative shrink-0 overflow-hidden rounded-sm border border-hairline ${
            frame === 'art' ? 'h-40 w-30 bg-sunken' : 'h-36 w-32 bg-gradient-to-b from-sunken to-panel'
          }`}
        >
          {/* The icon shows immediately; the large art crossfades in when it resolves. */}
          <AtlasSprite asset={icon} alt={alt} className="absolute inset-0 h-full w-full" fallback={<Placeholder label={alt} />} />
          {art && (
            <m.img
              key={art}
              src={art}
              alt=""
              aria-hidden
              draggable={false}
              initial={reducedMotion ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.18, ease: [0.2, 0, 0, 1] }}
              className={`absolute inset-0 h-full w-full ${frame === 'art' ? 'object-cover' : 'object-contain object-top'}`}
            />
          )}
          {art && (
            <button type="button" onClick={() => setViewing(true)} aria-label={`View ${alt} full size`} className="absolute inset-0">
              <ExpandMark className="absolute right-1 bottom-1 h-5 w-5" />
            </button>
          )}
        </div>
        <div className="min-w-0 flex-1">{children}</div>
      </div>
      <ArtViewer src={viewing ? art : null} title={alt} onClose={() => setViewing(false)} />
    </section>
  )
}
