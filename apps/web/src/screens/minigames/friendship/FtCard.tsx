import { FT_BOND_GAUGE, type FtCardDef, type StatKey } from '@racer/domain'
import { useRef, type ReactNode } from 'react'
import type { LoadedContent } from '../../../content/runtime'
import { GutsIcon, PowerIcon, SparkIcon, SpeedIcon, StaminaIcon, WitIcon, type IconComponent } from '../../../ui/icons'
import { CardArt } from '../BondBoard'

export const STAT_NAMES: Readonly<Record<StatKey, string>> = { speed: 'Speed', stamina: 'Stamina', power: 'Power', guts: 'Guts', wit: 'Wit' }
export const STAT_ICONS: Readonly<Record<StatKey, IconComponent>> = { speed: SpeedIcon, stamina: StaminaIcon, power: PowerIcon, guts: GutsIcon, wit: WitIcon }
export const STAT_BG: Readonly<Record<StatKey, string>> = {
  speed: 'bg-stat-speed', stamina: 'bg-stat-stamina', power: 'bg-stat-power', guts: 'bg-stat-guts', wit: 'bg-stat-wit',
}
export const STAT_TEXT: Readonly<Record<StatKey, string>> = {
  speed: 'text-stat-speed', stamina: 'text-stat-stamina', power: 'text-stat-power', guts: 'text-stat-guts', wit: 'text-stat-wit',
}

export const typeName = (type: FtCardDef['type']): string =>
  type === 'friend' ? 'Friend' : type === 'group' ? 'Group' : STAT_NAMES[type]

/** A stat type's badge: its colour and icon. Friend and Group cards count as any type, so they carry the spark. */
export function TypeBadge({ type, size = 'sm' }: { type: FtCardDef['type']; size?: 'sm' | 'md' }) {
  const broad = type === 'friend' || type === 'group'
  const Icon = broad ? SparkIcon : STAT_ICONS[type]
  const box = size === 'md' ? 'h-8 w-8' : 'h-6 w-6'
  return (
    <span className={`flex ${box} shrink-0 items-center justify-center rounded-full text-white shadow-1 ${broad ? 'bg-accent-strong' : STAT_BG[type]}`}>
      <Icon size={size === 'md' ? 20 : 16} title={typeName(type)} />
    </span>
  )
}

/** Tap selects; a long press opens the card's sheet instead. */
function useLongPress(onPress: () => void, onLong: () => void) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const fired = useRef(false)
  const cancel = () => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = null
  }
  return {
    onPointerDown: () => {
      fired.current = false
      cancel()
      timer.current = setTimeout(() => {
        fired.current = true
        onLong()
      }, 450)
    },
    onPointerUp: cancel,
    onPointerLeave: cancel,
    onPointerCancel: cancel,
    onContextMenu: (event: { preventDefault: () => void }) => event.preventDefault(),
    onClick: () => {
      cancel()
      if (!fired.current) onPress()
    },
  }
}

/**
 * One card in a run: its full 3:4 illustration, its type (top left) and what it scores here (bottom right). The main
 * card wears its friendship gauge, and a gold ring once bonded (docs/tasks/M020-friendship-training.md#the-hand).
 */
export function FtCard({
  content,
  def,
  art,
  points,
  selected = false,
  gauge,
  bonded = false,
  onSelect,
  onInspect,
  label,
  corner,
}: {
  content: LoadedContent
  def: FtCardDef
  art: string | null
  points?: number
  selected?: boolean
  gauge?: number
  bonded?: boolean
  onSelect?: () => void
  onInspect?: () => void
  label?: string
  corner?: ReactNode
}) {
  const press = useLongPress(() => onSelect?.(), () => onInspect?.())
  const interactive = onSelect !== undefined
  const face = (
    <>
      <span className="absolute inset-0 overflow-hidden rounded-[inherit]">
        <CardArt content={content} cardId={def.id} art={art} />
      </span>
      <span className="absolute top-1 left-1"><TypeBadge type={def.type} /></span>
      {gauge !== undefined && (
        <span className="absolute top-1.5 right-1.5 flex gap-0.5" aria-label={bonded ? 'Bonded' : `Friendship ${gauge} of ${FT_BOND_GAUGE}`}>
          {Array.from({ length: FT_BOND_GAUGE }, (_, index) => (
            <span key={index} className={`h-2 w-2 rounded-full border border-white/80 ${bonded || index < gauge ? 'bg-accent' : 'bg-ink/40'}`} />
          ))}
        </span>
      )}
      {points !== undefined && (
        <span className="font-display absolute right-1 bottom-1 rounded-xs bg-stage/85 px-1.5 text-[13px] leading-5 font-bold text-ink-on-dark tabular-nums">
          {points}
        </span>
      )}
      {corner}
    </>
  )
  const ring = bonded ? 'ring-2 ring-accent' : selected ? 'ring-2 ring-white' : 'ring-1 ring-white/15'
  const className = `relative block aspect-[3/4] w-full rounded-md bg-stage-soft shadow-2 transition-transform duration-150 ${ring} ${selected ? '-translate-y-2' : ''}`
  return interactive ? (
    <button
      type="button"
      aria-pressed={selected}
      aria-label={label ?? `${def.name}, ${typeName(def.type)}${points !== undefined ? `, ${points} points` : ''}`}
      className={`${className} touch-manipulation select-none [-webkit-touch-callout:none]`}
      {...press}
    >
      {face}
    </button>
  ) : (
    <span className={className} role="img" aria-label={label ?? `${def.name}, ${typeName(def.type)}`}>{face}</span>
  )
}
