import { getContentAsset, type LoadedContent } from '../content/runtime'
import { AtlasSprite } from './AtlasSprite'
import { useArt } from './album/useArt'
import { Placeholder } from './Placeholder'

/**
 * An Uma's head-and-shoulders tile art (`art/bust`, 256 px), as the original's Trainee Select shows her. Her atlas
 * icon stands in until the bust arrives, and wherever there is none, so a list never waits on a download.
 */
export function UmaBust({
  content,
  umaId,
  alt,
  dimmed = false,
  className = '',
}: {
  content: LoadedContent
  umaId: string
  /** Omit for a decorative image beside her name. */
  alt?: string
  dimmed?: boolean
  className?: string
}) {
  const url = useArt(content, 'bust', umaId)
  const tone = dimmed ? 'opacity-45 saturate-50' : ''
  if (url) {
    return (
      <div
        role={alt ? 'img' : undefined}
        aria-label={alt}
        aria-hidden={alt ? undefined : true}
        className={`relative isolate aspect-square overflow-hidden ${className}`}
      >
        <img src={url} alt="" draggable={false} className={`pointer-events-none h-full w-full select-none object-cover ${tone}`} />
      </div>
    )
  }
  return (
    <AtlasSprite
      asset={getContentAsset(content, 'uma-icons', umaId)}
      alt={alt}
      decorative={!alt}
      className={`${className} ${tone}`}
      fallback={<Placeholder label={alt ?? ''} />}
    />
  )
}
