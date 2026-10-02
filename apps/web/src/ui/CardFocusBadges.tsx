// A card's running-style and distance focus, as chips on its page and detail, and as a compact mark on its tile (D201).

import type { CardFocus, Strategy } from '@racer/domain'
import { CARD_DISTANCE_FOCUS_LABEL, CARD_STYLE_FOCUS_LABEL } from '../game/album/cards'
import { DistanceIcon, StrategyEndIcon, StrategyFrontIcon, StrategyLateIcon, StrategyPaceIcon } from './icons'

const STYLE_ICON: Record<Strategy, typeof StrategyPaceIcon> = {
  front: StrategyFrontIcon, pace: StrategyPaceIcon, late: StrategyLateIcon, end: StrategyEndIcon,
}
const STYLE_SHORT: Record<Strategy, string> = { front: 'Front', pace: 'Pace', late: 'Late', end: 'End' }
const DISTANCE_SHORT = { sprint: 'Spr', mile: 'Mile', medium: 'Med', long: 'Long' } as const

/** "Late Surger · Long focus", or that it is a Generalist in both. */
export const cardFocusLabel = (focus: CardFocus): string =>
  focus.style === 'generalist' && focus.distance === 'generalist'
    ? 'Generalist in style and distance'
    : `${CARD_STYLE_FOCUS_LABEL[focus.style]} · ${CARD_DISTANCE_FOCUS_LABEL[focus.distance]}`

/** Two chips, each dimension named in full, Generalist included: the card page and the album detail. */
export function CardFocusChips({ focus, className = '' }: { focus: CardFocus; className?: string }) {
  const chip = 'inline-flex min-h-7 items-center gap-1 rounded-full border border-hairline bg-sunken px-2.5 text-[12px] font-semibold'
  const StyleIcon = focus.style === 'generalist' ? null : STYLE_ICON[focus.style]
  return (
    <div className={`flex flex-wrap gap-1.5 ${className}`} aria-label={`Focus: ${cardFocusLabel(focus)}`}>
      <span className={chip}>
        {StyleIcon ? <StyleIcon size={16} /> : null}
        <span><span className="text-ink-faint">Style</span> {CARD_STYLE_FOCUS_LABEL[focus.style]}</span>
      </span>
      <span className={chip}>
        {focus.distance !== 'generalist' && <DistanceIcon size={16} />}
        <span><span className="text-ink-faint">Distance</span> {CARD_DISTANCE_FOCUS_LABEL[focus.distance]}</span>
      </span>
    </div>
  )
}

/**
 * The tile mark: a short style and distance on a dark pill over the art, so a grid can be read at a glance. Text rather
 * than the strategy pictograms, which blur together at tile size. A Generalist dimension is left out, and a card
 * Generalist in both shows nothing; the tile does not grow.
 */
export function CardFocusMark({ focus, compact = false }: { focus: CardFocus; compact?: boolean }) {
  const parts = [
    focus.style === 'generalist' ? null : STYLE_SHORT[focus.style],
    focus.distance === 'generalist' ? null : DISTANCE_SHORT[focus.distance],
  ].filter((part) => part !== null)
  if (parts.length === 0) return null
  const pill = 'inline-flex items-center whitespace-nowrap rounded-full bg-black/70 font-semibold text-white shadow-1'
  // The icons grid is too narrow for both on one line, so each value takes its own pill in the overlay's column.
  if (compact) {
    return parts.map((part) => (
      <span key={part} className={`${pill} px-1 text-[9px] leading-[14px]`} aria-hidden="true">{part}</span>
    ))
  }
  return <span className={`${pill} px-1.5 text-[10px] leading-4`} aria-hidden="true">{parts.join(' · ')}</span>
}
