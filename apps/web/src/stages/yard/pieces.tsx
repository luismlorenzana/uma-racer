// Training Yard's pieces (docs/game/08-training-yard.md §5): Uma face tiles (uma-kit's album) on stat-coloured grounds,
// framed by tier from plain to rainbow, with the tier also counted in pips so colour never carries it alone; Partners as
// their support card's art with a type mark (and a heart once bonded); Fatigue and Rest as uma-art's sweat drop and
// folded towel (A05). Drawn in the theme's tokens only.
import { FaceTile } from '@luismlorenzana/uma-kit/album'
import { HeartIcon, StarIcon, UiMark } from '@luismlorenzana/uma-kit/ui'
import { STATS, type SupportCardTemplate } from '@racer/domain'
import { cellColour, cellTier, FATIGUE, FATIGUE_PIECE, isPartnerPiece, isPieceCell, PARTNER_BASE, PARTNER_LIFT, REST, YARD_TIERS, type YardPartner } from '@racer/domain/stages'
import { useLoadedContent } from '../../app/content'
import { TypeIcon, typeLabel } from '../../ui/TypeIcon'
import { useArt } from '../../ui/useContentArt'

/** Each colour's ground, by stat (the theme's stat tokens, the same in light and dark). */
const GROUND = ['bg-stat-speed', 'bg-stat-stamina', 'bg-stat-power', 'bg-stat-guts', 'bg-stat-wit'] as const

/** Each tier's frame. Rainbow is a ring of all five stat colours, drawn by `RAINBOW_RING`. */
const FRAME = [
  'ring-1 ring-inset ring-hairline-strong',
  'ring-[3px] ring-inset ring-tier-bronze',
  'ring-[3px] ring-inset ring-tier-silver',
  'ring-4 ring-inset ring-tier-gold',
  '',
] as const
const RAINBOW_RING = 'bg-[conic-gradient(var(--color-stat-speed),var(--color-stat-stamina),var(--color-stat-power),var(--color-stat-guts),var(--color-stat-wit),var(--color-stat-speed))] p-[3px]'

export const colourName = (colour: number): string => typeLabel(STATS[colour]!)
export const tierName = (tier: number): string => YARD_TIERS[tier]!

/** The tier as pips: one to three, and a star for rainbow (plain has none). */
function TierPips({ tier }: { tier: number }) {
  if (tier === 0) return null
  if (tier === YARD_TIERS.length - 1) return <StarIcon size={16} variant="solid" className="text-ink-on-dark drop-shadow" />
  return (
    <span className="flex gap-0.5" aria-hidden>
      {Array.from({ length: tier }, (_, i) => <span key={i} className="size-1.5 rounded-full bg-panel shadow-1" />)}
    </span>
  )
}

/** A colour piece: her or a rival's face on the colour's ground, in its tier's frame. */
export function ColourPiece({ colour, tier, faces, size }: { colour: number; tier: number; faces: readonly string[]; size: number }) {
  const label = `${colourName(colour)}, ${tierName(tier)}`
  const body = (
    <span className={`relative flex size-full items-center justify-center rounded-md ${GROUND[colour]} ${FRAME[tier]}`} data-piece={`${colour}:${tier}`}>
      <span className="block w-[74%]">
        <FaceTile outfitId={faces[colour]!} size={Math.round(size * 0.74)} round label={label} />
      </span>
      <span className="absolute right-1 bottom-1"><TierPips tier={tier} /></span>
    </span>
  )
  return tier === YARD_TIERS.length - 1 ? <span className={`block size-full rounded-md ${RAINBOW_RING}`}>{body}</span> : body
}

export function FatiguePiece() {
  return (
    <span className="flex size-full items-center justify-center rounded-md bg-stage text-ink-on-dark ring-1 ring-inset ring-hairline-dark" role="img" aria-label="Fatigue" data-piece="fatigue">
      <UiMark mark="yard/fatigue" scale={2} />
    </span>
  )
}

export function RestPiece() {
  return (
    <span className="flex size-full items-center justify-center rounded-md bg-sunken text-info ring-1 ring-inset ring-hairline-strong" role="img" aria-label="Rest" data-piece="rest">
      <UiMark mark="yard/rest" scale={2} />
    </span>
  )
}

/** A deck card as a Partner: its art, its type, and a heart when it lifts two tiers. */
export function PartnerPiece({ partner, card }: { partner: YardPartner; card: SupportCardTemplate | undefined }) {
  const content = useLoadedContent()
  const art = useArt(content, 'card', partner.cardId)
  const type = card?.type ?? (partner.colour >= 0 ? STATS[partner.colour]! : 'friend')
  const bonded = partner.lift >= PARTNER_LIFT.bonded
  const label = `Partner: ${card?.charName ?? 'a deck card'}, ${typeLabel(type)}${partner.colour < 0 ? ', fits any colour' : ''}${bonded ? ', bonded' : ''}`
  return (
    <span className="relative flex size-full items-center justify-center overflow-hidden rounded-md bg-raised ring-2 ring-inset ring-accent" role="img" aria-label={label} data-piece="partner">
      {art !== null
        ? <img src={art} alt="" draggable={false} className="absolute inset-0 size-full select-none object-cover object-top" />
        : <TypeIcon type={type} size={28} />}
      <span className="absolute top-0.5 left-0.5"><TypeIcon type={type} size={16} /></span>
      {bonded && <span className="absolute right-0.5 bottom-0.5 text-danger"><HeartIcon size={16} variant="solid" /></span>}
    </span>
  )
}

/** Any board cell's piece, or nothing for an empty cell. */
export function CellPiece({ value, faces, size }: { value: number; faces: readonly string[]; size: number }) {
  if (value === FATIGUE) return <FatiguePiece />
  if (value === REST) return <RestPiece />
  if (isPieceCell(value)) return <ColourPiece colour={cellColour(value)} tier={cellTier(value)} faces={faces} size={size} />
  return null
}

/** A queue piece (hand, next, held), or an empty slot. */
export function QueuePiece({ piece, faces, partners, cards, size }: {
  piece: number
  faces: readonly string[]
  partners: readonly YardPartner[]
  cards: ReadonlyMap<string, SupportCardTemplate> | null
  size: number
}) {
  if (piece < 0) return null
  if (piece === FATIGUE_PIECE) return <FatiguePiece />
  if (isPartnerPiece(piece)) {
    const partner = partners[piece - PARTNER_BASE]
    return partner === undefined ? null : <PartnerPiece partner={partner} card={cards?.get(partner.cardId)} />
  }
  return <ColourPiece colour={piece} tier={0} faces={faces} size={size} />
}

export function describeQueuePiece(piece: number, partners: readonly YardPartner[], cards: ReadonlyMap<string, SupportCardTemplate> | null): string {
  if (piece < 0) return 'empty'
  if (piece === FATIGUE_PIECE) return 'Fatigue'
  if (isPartnerPiece(piece)) {
    const partner = partners[piece - PARTNER_BASE]
    return `Partner ${cards?.get(partner?.cardId ?? '')?.charName ?? ''}`.trim()
  }
  return `${colourName(piece)}, plain`
}

export function describeCell(value: number): string {
  if (value === FATIGUE) return 'Fatigue'
  if (value === REST) return 'Rest'
  if (isPieceCell(value)) return `${colourName(cellColour(value))}, ${tierName(cellTier(value))}`
  return 'empty'
}
