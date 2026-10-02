// A card's running-style and distance focus, as chips on its page and detail, and as icons on its tile (D201, D238).

import type { CardFocus } from '@racer/domain'
import { CARD_DISTANCE_FOCUS_LABEL, CARD_STYLE_FOCUS_LABEL } from '../game/album/cards'
import { DistanceTypeIcon, RunningStyleIcon } from './CardFocusIcons'

/** "Late Surger · Long focus", or that it is a Generalist in both. */
export const cardFocusLabel = (focus: CardFocus): string =>
  focus.style === 'generalist' && focus.distance === 'generalist'
    ? 'Generalist in style and distance'
    : `${CARD_STYLE_FOCUS_LABEL[focus.style]} · ${CARD_DISTANCE_FOCUS_LABEL[focus.distance]}`

/** Two chips, each dimension named in full, Generalist included: the card page and the album detail. */
export function CardFocusChips({ focus, className = '' }: { focus: CardFocus; className?: string }) {
  const chip = 'inline-flex min-h-7 items-center gap-1 rounded-full border border-hairline bg-sunken px-2.5 text-[12px] font-semibold'
  return (
    <div className={`flex flex-wrap gap-1.5 ${className}`} aria-label={`Focus: ${cardFocusLabel(focus)}`}>
      <span className={`${chip} ${focus.style === 'generalist' ? '' : 'pl-1'}`}>
        {focus.style !== 'generalist' && <RunningStyleIcon style={focus.style} size={20} />}
        <span><span className="text-ink-faint">Style</span> {CARD_STYLE_FOCUS_LABEL[focus.style]}</span>
      </span>
      <span className={`${chip} ${focus.distance === 'generalist' ? '' : 'pl-1'}`}>
        {focus.distance !== 'generalist' && <DistanceTypeIcon distance={focus.distance} size={20} />}
        <span><span className="text-ink-faint">Distance</span> {CARD_DISTANCE_FOCUS_LABEL[focus.distance]}</span>
      </span>
    </div>
  )
}

/** The style's icon on a tile, top right; nothing for a Generalist. */
export function CardStyleIcon({ focus, size }: { focus: CardFocus; size: number }) {
  return focus.style === 'generalist' ? null : <RunningStyleIcon style={focus.style} size={size} className="drop-shadow" />
}

/** The distance's shoe on a tile, top left; nothing for a Generalist. */
export function CardDistanceIcon({ focus, size }: { focus: CardFocus; size: number }) {
  return focus.distance === 'generalist' ? null : <DistanceTypeIcon distance={focus.distance} size={size} className="drop-shadow" />
}
