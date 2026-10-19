import type { CSSProperties, ReactNode } from 'react'
import type { ContentAsset } from '../content/view'

export function atlasImageStyle(asset: ContentAsset): CSSProperties {
  return {
    position: 'absolute',
    maxWidth: 'none',
    width: `${(asset.pageWidth / asset.frame.width) * 100}%`,
    height: `${(asset.pageHeight / asset.frame.height) * 100}%`,
    left: `${(-asset.frame.x / asset.frame.width) * 100}%`,
    top: `${(-asset.frame.y / asset.frame.height) * 100}%`,
  }
}

export function AtlasSprite({
  asset,
  alt,
  decorative = false,
  fallback = null,
  className = '',
  style,
}: {
  asset: ContentAsset | null
  alt?: string
  decorative?: boolean
  fallback?: ReactNode
  className?: string
  style?: CSSProperties
}) {
  if (!asset) return <div className={`aspect-square overflow-hidden ${className}`}>{fallback}</div>
  return (
    <div
      role={decorative ? undefined : 'img'}
      aria-label={decorative ? undefined : alt}
      aria-hidden={decorative || undefined}
      className={`relative isolate aspect-square overflow-hidden ${className}`}
      style={style}
    >
      <img src={asset.url} alt="" aria-hidden draggable={false} className="pointer-events-none select-none" style={atlasImageStyle(asset)} />
    </div>
  )
}
