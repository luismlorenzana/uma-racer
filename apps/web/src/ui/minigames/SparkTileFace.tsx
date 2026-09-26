import type { CSSProperties } from 'react'
import type { ContentAsset } from '../../content/runtime'
import { AtlasSprite } from '../AtlasSprite'

/**
 * Spark Match's tile colours, one per cast slot (D161): each kind of tile has its own ring, so a line of three reads
 * by colour before faces. The trainee, last, is yellow beside her gold 2× marker.
 */
export const SPARK_TILE_COLORS = ['#ef4444', '#3b82f6', '#22c55e', '#a855f7', '#f97316', '#facc15'] as const
export const SPARK_TILE_COLOR_NAMES = ['red', 'blue', 'green', 'purple', 'orange', 'yellow'] as const

// The whole standing chibi, a little inside the ring so her ears and feet clear it.
const CHIBI_FULL: CSSProperties = { position: 'absolute', inset: '4%', width: '92%', height: '92%', objectFit: 'contain' }

/**
 * One Spark Match tile: her chibi in a ring of her slot's colour, over a tint of it. Until the chibi arrives, or for an
 * Uma without one, her icon stands in.
 */
export function SparkTileFace({ slot, chibi, asset, label }: { slot: number; chibi: string | null; asset: ContentAsset | null; label: string }) {
  const color = SPARK_TILE_COLORS[slot % SPARK_TILE_COLORS.length]!
  return (
    <span
      className="relative block aspect-square w-full overflow-hidden rounded-full border-[3px]"
      style={{ borderColor: color, backgroundColor: `${color}33` }}
    >
      {chibi ? (
        <img src={chibi} alt="" aria-hidden draggable={false} className="pointer-events-none select-none" style={CHIBI_FULL} />
      ) : (
        <AtlasSprite
          asset={asset}
          decorative
          className="h-full w-full"
          fallback={<span className="flex h-full items-center justify-center font-display text-lg font-bold text-ink-on-dark">{label.slice(0, 1)}</span>}
        />
      )}
    </span>
  )
}
