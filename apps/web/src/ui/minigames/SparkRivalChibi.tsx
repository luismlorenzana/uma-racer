import type { SparkOrb, Strategy } from '@racer/domain'
import type { ContentAsset } from '../../content/runtime'
import { AtlasSprite } from '../AtlasSprite'
import { SparkIcon } from '../icons'
import { SPARK_ORB_COLORS, SPARK_ORB_GLYPHS, SPARK_ORB_LABELS } from './spark-rival-presentation'

/** One whole standing Chibi inside the gameplay kind's ring; icon and labelled silhouette are safe fallbacks. */
export function SparkRivalChibi({
  kind,
  chibi,
  asset,
  label,
  className = '',
}: {
  kind: SparkOrb | Strategy
  chibi: string | null
  asset: ContentAsset | null
  label: string
  className?: string
}) {
  const color = SPARK_ORB_COLORS[kind]
  const glyph = SPARK_ORB_GLYPHS[kind]
  return (
    <span
      role="img"
      aria-label={`${label} · ${SPARK_ORB_LABELS[kind]}`}
      className={`relative block aspect-square overflow-hidden rounded-full border-[3px] ${className}`}
      style={{ borderColor: color, backgroundColor: `${color}33` }}
    >
      {chibi ? (
        <img src={chibi} alt="" aria-hidden draggable={false} className="pointer-events-none absolute inset-[4%] h-[92%] w-[92%] object-contain select-none" />
      ) : (
        <AtlasSprite
          asset={asset}
          decorative
          className="h-full w-full"
          fallback={<span className="flex h-full items-center justify-center font-display text-lg font-bold text-ink-on-dark">{label.slice(0, 1)}</span>}
        />
      )}
      <span className="absolute right-0 bottom-0 flex h-5 min-w-5 items-center justify-center rounded-full border border-white/70 bg-stage/90 px-1 text-[10px] font-bold text-white" aria-hidden>
        {kind === 'spark' ? <SparkIcon size={16} /> : glyph}
      </span>
    </span>
  )
}
