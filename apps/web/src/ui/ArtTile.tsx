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
  badge,
  bottomLeft,
  footer,
  tight = false,
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
  /** Bottom-right mark, such as the icons view's level (T051) or a card's stars (D238). */
  badge?: ReactNode
  /** Bottom-left mark, such as a card's type in the icons view (D238). */
  bottomLeft?: ReactNode
  /** Text over the scrim at the bottom. */
  footer?: ReactNode
  /** Small tiles: every corner mark sits 4 px in, not 6. */
  tight?: boolean
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
      {overlay && <div className={`absolute flex flex-col items-start gap-1 ${tight ? 'top-1 left-1' : 'top-1.5 left-1.5'}`}>{overlay}</div>}
      {corner && <div className={`absolute flex items-start gap-1 ${tight ? 'top-1 right-1' : 'top-1.5 right-1.5'}`}>{corner}</div>}
      {bottomLeft && <div className="absolute bottom-1 left-1">{bottomLeft}</div>}
      {badge && <div className="absolute right-1 bottom-1">{badge}</div>}
      {footer && <div className="absolute inset-x-0 bottom-0 p-2 text-ink-on-dark">{footer}</div>}
    </div>
  )
}
