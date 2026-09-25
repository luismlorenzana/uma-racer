import type { ReactNode } from 'react'
import type { ContentAsset } from '../content/runtime'
import { AtlasSprite } from './AtlasSprite'
import { Placeholder } from './Placeholder'

/**
 * Art-first tile: the portrait fills the frame, a scrim carries the text, and unowned art is
 * desaturated behind a lock rather than hidden (docs/design/visual-system.md#art-treatment).
 */
export function ArtTile({
  asset,
  artUrl = null,
  alt,
  dimmed = false,
  chamfer = false,
  overlay,
  corner,
  footer,
  className = '',
}: {
  asset: ContentAsset | null
  /** Larger per-entry art, such as an Uma's bust, shown in place of the atlas icon once it has loaded. */
  artUrl?: string | null
  alt: string
  dimmed?: boolean
  chamfer?: boolean
  /** Top-left state chips. */
  overlay?: ReactNode
  /** Top-right crest or badge. */
  corner?: ReactNode
  /** Text over the scrim at the bottom. */
  footer?: ReactNode
  className?: string
}) {
  return (
    <div
      className={`relative isolate aspect-square overflow-hidden rounded-md border border-hairline bg-sunken shadow-1 ${
        chamfer ? 'chamfer-tr' : ''
      } ${className}`}
    >
      {artUrl ? (
        <img
          src={artUrl}
          alt={alt}
          draggable={false}
          className={`absolute inset-0 h-full w-full select-none bg-gradient-to-b from-panel to-sunken object-cover ${dimmed ? 'opacity-45 saturate-50' : ''}`}
        />
      ) : (
        <AtlasSprite
          asset={asset}
          alt={alt}
          className={`absolute inset-0 h-full w-full ${dimmed ? 'opacity-45 saturate-50' : ''}`}
          fallback={<Placeholder label={alt} />}
        />
      )}
      {footer && <div className="art-scrim pointer-events-none absolute inset-x-0 bottom-0 h-1/2" aria-hidden />}
      {overlay && <div className="absolute top-1.5 left-1.5 flex flex-col items-start gap-1">{overlay}</div>}
      {corner && <div className="absolute top-1.5 right-1.5">{corner}</div>}
      {footer && <div className="absolute inset-x-0 bottom-0 p-2 text-ink-on-dark">{footer}</div>}
    </div>
  )
}
