// A small mark from uma-art's `ui` atlas (docs/game/11-hub-and-places.md §10.3; A02, uma-art 2.7.0): the account bar's
// currencies and the tier crests, drawn from code like the town under them. A CSS sprite at a whole-number scale, pixels
// kept crisp; 16 pt for a 16 px mark lands on whole device pixels at both 2× and 3×.
import atlasUrl from '@luismlorenzana/uma-art/ui/atlas.png?url'
import atlas from '@luismlorenzana/uma-art/ui/atlas.json'

export type UiMarkId = 'currency/prize-money' | 'currency/speed-ticket' | 'currency/uma-ticket' | 'tier/1' | 'tier/2' | 'tier/3'

const FRAMES: Readonly<Record<string, { readonly x: number; readonly y: number; readonly w: number; readonly h: number }>> = atlas.frames

export function UiMark({ mark, scale = 1, className = '' }: { mark: UiMarkId; scale?: 1 | 2; className?: string }) {
  const at = FRAMES[mark]!
  return (
    <span
      aria-hidden
      data-mark={mark}
      className={`inline-block shrink-0 ${className}`}
      style={{
        width: at.w * scale,
        height: at.h * scale,
        backgroundImage: `url(${atlasUrl})`,
        backgroundSize: `${atlas.width * scale}px ${atlas.height * scale}px`,
        backgroundPosition: `-${at.x * scale}px -${at.y * scale}px`,
        backgroundRepeat: 'no-repeat',
        imageRendering: 'pixelated',
      }}
    />
  )
}

/** An Uma's tier as its uma-art crest (bronze, silver, gold) at 24 pt, read as "Tier N". */
export function TierCrest({ tier, className = '' }: { tier: number; className?: string }) {
  const mark = `tier/${Math.min(3, Math.max(1, tier))}` as UiMarkId
  return (
    <span role="img" aria-label={`Tier ${tier}`} data-tier={tier} className={`inline-flex drop-shadow-sm ${className}`}>
      <UiMark mark={mark} scale={2} />
    </span>
  )
}
