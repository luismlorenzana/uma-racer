import type { SupportCardTemplate } from '@racer/domain'
import { useContent } from '../content/ContentProvider'
import { getContentAsset } from '../content/runtime'
import { AtlasSprite } from './AtlasSprite'
import { CardsIcon, GutsIcon, PowerIcon, SpeedIcon, StaminaIcon, WitIcon, type IconComponent } from './icons'

export type TypeIconKind = SupportCardTemplate['type']

const FALLBACK: Record<TypeIconKind, { icon: IconComponent; tone: string }> = {
  speed: { icon: SpeedIcon, tone: 'bg-stat-speed' },
  stamina: { icon: StaminaIcon, tone: 'bg-stat-stamina' },
  power: { icon: PowerIcon, tone: 'bg-stat-power' },
  guts: { icon: GutsIcon, tone: 'bg-stat-guts' },
  wit: { icon: WitIcon, tone: 'bg-stat-wit' },
  friend: { icon: CardsIcon, tone: 'bg-accent' },
  group: { icon: CardsIcon, tone: 'bg-turf' },
}

const LABEL: Record<TypeIconKind, string> = {
  speed: 'Speed', stamina: 'Stamina', power: 'Power', guts: 'Guts', wit: 'Wit', friend: 'Friend', group: 'Group',
}

/**
 * A card type, or a stat, as the original's coloured type icon (D182), from the private type atlas. Until content has
 * it (an older manifest, or signed out) our own stat glyph stands in on the stat's colour.
 */
export function TypeIcon({
  type,
  size = 20,
  title,
  className = '',
}: {
  type: TypeIconKind
  size?: number
  /** The accessible name; without one the icon is decorative and sits beside a visible label. */
  title?: string
  className?: string
}) {
  const contentState = useContent()
  const asset = contentState.status === 'ready' ? getContentAsset(contentState.content, 'type-icons', type) : null
  const fallback = FALLBACK[type]
  const Glyph = fallback.icon
  return (
    <AtlasSprite
      asset={asset}
      alt={title ?? LABEL[type]}
      decorative={!title}
      className={`shrink-0 ${className}`}
      style={{ width: size, height: size }}
      fallback={(
        <span
          className={`flex h-full w-full items-center justify-center rounded-[22%] text-white ${fallback.tone}`}
          style={{ width: size, height: size }}
        >
          <Glyph size={16} variant="solid" />
        </span>
      )}
    />
  )
}
