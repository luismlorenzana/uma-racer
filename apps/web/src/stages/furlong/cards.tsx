// Furlong Hand's cards (docs/game/09-furlong-hand.md §11): stride cards on their stat colour's ground with the stat's
// icon and their value, wild cards on the Friend tile, Partners as their support card's art in a type frame (a ring of
// the five stat colours once bonded: a rainbow), and Skill cards with the skill's name on its colour. The value is
// always a numeral and the colour always an icon too, so colour never carries a rule alone. Theme tokens only.
import { SparkIcon } from '@luismlorenzana/uma-kit/ui'
import { STATS, type SkillTemplate, type SupportCardTemplate } from '@racer/domain'
import { ABILITY_WORDS, WILD, type FurlongCard, type FurlongPartner, type FurlongState } from '@racer/domain/stages'
import { useLoadedContent } from '../../app/content'
import { TypeIcon, typeLabel, type TypeIconKind } from '../../ui/TypeIcon'
import { useArt } from '../../ui/useContentArt'

/** Each colour's ground, by stat (the theme's stat tokens, the same in light and dark). */
const GROUND = ['bg-stat-speed', 'bg-stat-stamina', 'bg-stat-power', 'bg-stat-guts', 'bg-stat-wit'] as const
export const RAINBOW_RING = 'bg-[conic-gradient(var(--color-stat-speed),var(--color-stat-stamina),var(--color-stat-power),var(--color-stat-guts),var(--color-stat-wit),var(--color-stat-speed))]'

const kindOf = (colour: number): TypeIconKind => (colour === WILD ? 'friend' : STATS[colour]!)
export const colourName = (colour: number): string => (colour === WILD ? 'Any colour' : typeLabel(STATS[colour]!))

export interface CardContent {
  readonly cards: ReadonlyMap<string, SupportCardTemplate> | null
  readonly skills: ReadonlyMap<string, SkillTemplate> | null
}

/** A card in words, for its label: "Speed 4", "Partner Kitasan, Speed 4, rainbow", "Skill Corner Ace, Power 3". */
export function describeCard(state: Pick<FurlongState, 'cards' | 'partners' | 'skills'>, index: number, content: CardContent): string {
  const card = state.cards[index]
  if (card === undefined) return 'no card'
  if (card.kind === 'partner') {
    const partner = state.partners[card.ref]!
    const name = content.cards?.get(partner.cardId)?.charName ?? 'a deck card'
    const ability = partner.ability === null ? '' : `, ${partner.ability.replace('-', ' ')}: ${ABILITY_WORDS[partner.ability]}`
    return `Partner ${name}, ${colourName(card.colour)} ${card.value}${partner.rainbow ? ', rainbow' : ''}${ability}`
  }
  if (card.kind === 'skill') {
    const skill = state.skills[card.ref]!
    return `Skill ${content.skills?.get(skill.id)?.name ?? 'card'}, ${colourName(card.colour)} ${card.value}, fires ${skill.trigger === 'any' ? 'anywhere' : skill.trigger === 'spurt' ? 'in the spurt' : `on a ${skill.trigger}`}`
  }
  return `${colourName(card.colour)} ${card.value}`
}

function Value({ value, dark }: { value: number; dark?: boolean }) {
  return <span className={`numeral font-display text-[22px] leading-none font-bold ${dark ? 'text-ink' : 'text-ink-on-dark'}`}>{value}</span>
}

function StrideFace({ card }: { card: FurlongCard }) {
  if (card.colour === WILD) {
    return (
      <span className="flex size-full flex-col items-center justify-center gap-1 rounded-md bg-raised ring-2 ring-inset ring-accent" data-card="stride" data-colour="wild">
        <TypeIcon type="friend" size={22} />
        <Value value={card.value} dark />
      </span>
    )
  }
  return (
    <span className={`flex size-full flex-col items-center justify-center gap-1 rounded-md ${GROUND[card.colour]} ring-1 ring-inset ring-hairline-dark`} data-card="stride" data-colour={STATS[card.colour]}>
      <TypeIcon type={STATS[card.colour]!} size={22} />
      <Value value={card.value} />
    </span>
  )
}

function PartnerFace({ card, partner }: { card: FurlongCard; partner: FurlongPartner }) {
  const content = useLoadedContent()
  const art = useArt(content, 'card', partner.cardId)
  const body = (
    <span className="relative flex size-full items-end justify-between overflow-hidden rounded-md bg-raised p-1 ring-2 ring-inset ring-accent" data-card="partner">
      {art !== null
        ? <img src={art} alt="" draggable={false} className="absolute inset-0 size-full select-none object-cover object-top" />
        : <span className="absolute inset-0 flex items-center justify-center"><TypeIcon type={kindOf(card.colour)} size={30} /></span>}
      <span className="relative"><TypeIcon type={kindOf(card.colour)} size={18} /></span>
      <span className="relative flex items-center gap-0.5 rounded-sm bg-scrim/70 px-1">
        {partner.ability !== null && <SparkIcon size={16} className="text-accent" aria-hidden />}
        <span className="numeral text-[15px] font-bold text-ink-on-dark">{card.value}</span>
      </span>
    </span>
  )
  return partner.rainbow
    ? <span className={`block size-full rounded-md p-[3px] ${RAINBOW_RING}`} data-rainbow="true">{body}</span>
    : body
}

function SkillFace({ card, name }: { card: FurlongCard; name: string }) {
  return (
    <span className="flex size-full flex-col justify-between overflow-hidden rounded-md bg-panel p-1 ring-2 ring-inset ring-hairline-strong" data-card="skill">
      <span className="flex items-center justify-between">
        <TypeIcon type={kindOf(card.colour)} size={16} />
        <span className="numeral text-[15px] font-bold text-ink">{card.value}</span>
      </span>
      <span className="line-clamp-2 text-[10px] leading-tight font-semibold text-ink">{name}</span>
    </span>
  )
}

/** Any card's face, filling its box. */
export function CardFace({ state, index, content }: { state: Pick<FurlongState, 'cards' | 'partners' | 'skills'>; index: number; content: CardContent }) {
  const card = state.cards[index]
  if (card === undefined) return null
  if (card.kind === 'partner') return <PartnerFace card={card} partner={state.partners[card.ref]!} />
  if (card.kind === 'skill') return <SkillFace card={card} name={content.skills?.get(state.skills[card.ref]!.id)?.name ?? 'Skill'} />
  return <StrideFace card={card} />
}

/** A face-down card: a spread card not shown yet. */
export function CardBack() {
  return <span className="block size-full rounded-md bg-stage ring-1 ring-inset ring-hairline-dark" data-card="back" />
}
