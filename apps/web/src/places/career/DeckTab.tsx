// Upgrade's Deck (D387): her six slots, each card with the branch it trains at, then the owned cards her scenario's era
// allows, filtered by type and focus (icons, as the Card Library's). A card toggles in or out of the deck (`set-deck`,
// a new card posted to its own type's branch); a deck card opens one sheet to post it to another branch
// (`post-card`) or take it out. The tree's previews read the deck as it stands, so they change at once.
import { Chip, DeckSlotIcon, Sheet } from '@luismlorenzana/uma-kit/ui'
import { cardFocus, type SupportCardTemplate, type SupportCardType } from '@racer/domain'
import { BRANCH_SEATS, postOf, seatsTaken } from '@racer/domain/build'
import { BRANCHES, DECK_SIZE, type CareerRecord, type OperationEnv, type SaveState } from '@racer/domain/save'
import { useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import { libraryPath } from '../../hub/nav'
import { CardSquare } from '../../ui/ArtSquare'
import { DistanceTypeIcon, RunningStyleIcon } from '../../ui/CardFocusIcons'
import { DISTANCE_LABEL, DISTANCES, STAT_LABEL, STYLE_LABEL, STYLES } from '../../ui/labels'
import { TypeIcon, typeLabel } from '../../ui/TypeIcon'
import { titledCardName } from '../../ui/words'
import { allowedCards, careersWords } from './model'
import { useCareerOp } from './useCareerOp'

const CARD_TYPES: readonly SupportCardType[] = ['speed', 'stamina', 'power', 'guts', 'wit', 'friend', 'group']

function Toggle({ pressed, label, onClick, children }: { pressed: boolean; label: string; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" aria-pressed={pressed} aria-label={label} onClick={onClick}
      className={`flex min-h-11 min-w-0 items-center justify-center rounded-sm ${pressed ? 'bg-accent-wash ring-2 ring-inset ring-accent' : 'opacity-70'}`}>
      {children}
    </button>
  )
}

interface Filters {
  readonly type: SupportCardType | null
  readonly style: string | null
  readonly distance: string | null
}

/** The post sheet: the five branches with their seats, the card's own preselected, and Take out. */
function PostSheet({ careerId, career, card, onClose }: { careerId: string; career: CareerRecord; card: SupportCardTemplate | null; onClose: () => void }) {
  const op = useCareerOp()
  const seats = seatsTaken(career.posts, career.deck)
  const current = card === null ? null : postOf(career, card.id, card)
  const post = async (branch: (typeof BRANCHES)[number]) => {
    if (card === null) return
    if (branch === current || await op.go('post-card', { careerId, cardId: card.id, branch })) onClose()
  }
  const takeOut = async () => {
    if (card !== null && await op.go('set-deck', { careerId, deck: career.deck.filter((id) => id !== card.id) })) onClose()
  }
  return (
    <Sheet open={card !== null} onClose={onClose} title={card === null ? '' : titledCardName(card)}>
      {card !== null && (
        <div className="space-y-3" data-racer="post-sheet" data-card={card.id}>
          <h3 className="text-micro">{careersWords('post-title')}</h3>
          <div role="group" aria-label={careersWords('post-title')} className="grid grid-cols-5 gap-1.5">
            {BRANCHES.map((branch) => {
              const full = seats[branch] >= BRANCH_SEATS && branch !== current
              return (
                <button key={branch} type="button" aria-pressed={branch === current} disabled={full || op.busy} onClick={() => void post(branch)} data-post={branch}
                  aria-label={`${STAT_LABEL[branch]}, ${careersWords('post-seats', { n: seats[branch] })}`}
                  className={`flex min-h-14 flex-col items-center justify-center gap-0.5 rounded-sm border disabled:opacity-40 ${branch === current ? 'border-accent bg-accent-wash ring-2 ring-inset ring-accent' : 'border-hairline bg-panel'}`}>
                  <TypeIcon type={branch} size={24} />
                  <span aria-hidden className="numeral text-[11px] text-ink-soft">{careersWords('post-seats', { n: seats[branch] })}</span>
                </button>
              )
            })}
          </div>
          <button type="button" onClick={() => void takeOut()} disabled={op.busy}
            className="flex min-h-11 w-full items-center justify-center rounded-sm border border-hairline font-semibold text-danger">
            {careersWords('take-out')}
          </button>
          {op.error !== null && <p role="alert" className="text-[13px] text-danger">{op.error}</p>}
        </div>
      )}
    </Sheet>
  )
}

export function DeckTab({ careerId, career, state, env }: { careerId: string; career: CareerRecord; state: SaveState; env: OperationEnv }) {
  const op = useCareerOp()
  const [filters, setFilters] = useState<Filters>({ type: null, style: null, distance: null })
  const [posting, setPosting] = useState<string | null>(null)
  const cards = env.content.cards
  const allowed = useMemo(() => allowedCards(state, cards, career.T), [cards, career.T, state])
  const shown = useMemo(() => allowed.filter((card) => {
    if (filters.type !== null && card.type !== filters.type) return false
    if (filters.style === null && filters.distance === null) return true
    const focus = cardFocus(card, env.content.skills)
    return (filters.style === null || focus.style === filters.style) && (filters.distance === null || focus.distance === filters.distance)
  }), [allowed, env.content.skills, filters])
  const full = career.deck.length >= DECK_SIZE
  const toggle = (id: string) => {
    if (op.busy) return
    if (career.deck.includes(id)) void op.go('set-deck', { careerId, deck: career.deck.filter((each) => each !== id) })
    else if (!full) void op.go('set-deck', { careerId, deck: [...career.deck, id] })
  }
  const flip = <K extends keyof Filters>(key: K, value: Filters[K]) => setFilters((now) => ({ ...now, [key]: now[key] === value ? null : value }))
  const postingCard = posting === null ? null : cards.get(posting) ?? null

  if (allowed.length === 0) {
    return (
      <div className="space-y-3 rounded-md border border-hairline bg-panel p-4 text-center" data-racer="deck-tab">
        <p className="text-[14px] text-ink-soft">{careersWords('no-cards')}</p>
        <Link to={libraryPath('locked')} state={{ back: true }} className="inline-flex min-h-11 items-center rounded-sm bg-accent px-4 font-semibold text-accent-ink">
          {careersWords('to-library')}
        </Link>
      </div>
    )
  }
  return (
    <div className="space-y-3" data-racer="deck-tab">
      <ol aria-label={careersWords('deck')} className="grid grid-cols-6 gap-1.5" data-racer="deck-slots">
        {Array.from({ length: DECK_SIZE }, (_, slot) => {
          const id = career.deck[slot]
          const card = id === undefined ? undefined : cards.get(id)
          if (id === undefined || card === undefined) {
            return (
              <li key={`empty-${slot}`} aria-label={careersWords('deck-slot')} className="flex aspect-square items-center justify-center rounded-sm border border-dashed border-hairline-strong text-ink-faint">
                <DeckSlotIcon size={20} />
              </li>
            )
          }
          const branch = postOf(career, id, card)
          return (
            <li key={id} className="min-w-0">
              <button type="button" onClick={() => setPosting(id)} data-deck-card={id} data-post={branch}
                aria-label={careersWords('deck-card', { card: titledCardName(card), branch: STAT_LABEL[branch] })}
                className="block min-h-11 w-full min-w-0 rounded-sm">
                <CardSquare cardId={id} name={titledCardName(card)} tight bottomLeft={<TypeIcon type={card.type} size={16} />} />
                <span aria-hidden className="mt-0.5 flex items-center justify-center gap-0.5 text-[10px] text-ink-soft">
                  <span>to</span><TypeIcon type={branch} size={16} />
                </span>
              </button>
            </li>
          )
        })}
      </ol>
      <p className="text-[12px] text-ink-soft">{full ? careersWords('deck-full') : careersWords('deck-note')}</p>
      <div role="group" aria-label={careersWords('card-types')} className="grid grid-cols-7 gap-1">
        {CARD_TYPES.map((type) => (
          <Toggle key={type} pressed={filters.type === type} label={typeLabel(type)} onClick={() => flip('type', type)}><TypeIcon type={type} size={24} /></Toggle>
        ))}
      </div>
      <div role="group" aria-label={careersWords('card-focus')} className="grid grid-cols-8">
        {STYLES.map((style) => (
          <Toggle key={style} pressed={filters.style === style} label={STYLE_LABEL[style]} onClick={() => flip('style', style)}><RunningStyleIcon style={style} size={24} /></Toggle>
        ))}
        {DISTANCES.map((distance) => (
          <Toggle key={distance} pressed={filters.distance === distance} label={DISTANCE_LABEL[distance]} onClick={() => flip('distance', distance)}><DistanceTypeIcon distance={distance} size={24} /></Toggle>
        ))}
      </div>
      {(filters.type !== null || filters.style !== null || filters.distance !== null) && (
        <div className="flex justify-end"><Chip className="min-h-11" onClick={() => setFilters({ type: null, style: null, distance: null })}>Clear filters</Chip></div>
      )}
      {shown.length === 0 ? <p className="rounded-md border border-hairline bg-panel p-4 text-center text-[14px] text-ink-soft">{careersWords('no-match')}</p> : (
        <ul className="grid grid-cols-4 gap-2" aria-label="Cards" data-racer="deck-cards">
          {shown.map((card) => {
            const inDeck = career.deck.includes(card.id)
            return (
              <li key={card.id} className="min-w-0">
                <button type="button" aria-pressed={inDeck} disabled={!inDeck && full} onClick={() => toggle(card.id)} data-card={card.id}
                  aria-label={titledCardName(card)} className="block min-h-11 w-full min-w-0 rounded-md disabled:opacity-45">
                  <CardSquare cardId={card.id} name={titledCardName(card)} tight dimmed={false}
                    bottomLeft={<TypeIcon type={card.type} size={16} />}
                    corner={inDeck ? <span className="flex size-5 items-center justify-center rounded-full bg-accent text-[11px] font-bold text-accent-ink">{career.deck.indexOf(card.id) + 1}</span> : undefined} />
                  <span className="mt-1 block truncate text-center text-[11px] font-semibold">{card.charName}</span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
      {op.error !== null && <p role="alert" className="text-[13px] text-danger">{op.error}</p>}
      <PostSheet careerId={careerId} career={career} card={postingCard} onClose={() => setPosting(null)} />
    </div>
  )
}
