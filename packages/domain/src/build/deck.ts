// The deck and posting (docs/game/05-the-build.md, D382): six owned SSRs whose era allows the career's scenario, each
// posted to one branch, by default its own type's (Friend and Group at Wit); a branch seats five. Pure.
import type { SupportCardTemplate } from '../content'
import { refuse, type Refusal } from '../save/registry'
import { BRANCHES, DECK_SIZE, isUnlocked, type Branch, type CareerRecord, type UnlockRecord } from '../save/records'
import { scenarioForTier } from '../scenarios'
import { defaultBranch } from './effects'

/** A branch seats five cards, as a facility does. */
export const BRANCH_SEATS = 5

export const BRANCH_NAMES: Readonly<Record<Branch, string>> = Object.freeze({
  speed: 'Speed', stamina: 'Stamina', power: 'Power', guts: 'Guts', wit: 'Wit',
})

/** How many deck cards sit at each branch. */
export function seatsTaken(posts: Readonly<Record<string, Branch>>, deck: readonly string[]): Record<Branch, number> {
  const taken = { speed: 0, stamina: 0, power: 0, guts: 0, wit: 0 } as Record<Branch, number>
  for (const id of deck) {
    const branch = posts[id]
    if (branch !== undefined) taken[branch] += 1
  }
  return taken
}

/** Why this deck can't be the career's, in plain words, or null when it can. */
export function deckRefusal(
  deck: readonly string[],
  T: number,
  cards: ReadonlyMap<string, SupportCardTemplate>,
  owned: Readonly<Record<string, UnlockRecord>>,
): Refusal | null {
  if (deck.length > DECK_SIZE) return refuse('deck-too-big', `A deck holds ${DECK_SIZE} cards.`)
  if (new Set(deck).size !== deck.length) return refuse('duplicate-card', 'A card goes in the deck once.')
  for (const id of deck) {
    const card = cards.get(id)
    if (card === undefined) return refuse('unknown-card', 'That card isn\'t in the game.')
    if (!isUnlocked(owned[id])) return refuse('card-locked', `${card.title} isn't in your Card Library yet.`)
    if (card.era > T) {
      const scenario = scenarioForTier(T)?.name ?? `scenario ${T}`
      return refuse('card-era', `${card.title} arrived after ${scenario}, so it can't join this career.`, { era: card.era })
    }
  }
  return null
}

/**
 * The career with a new deck: cards staying keep their posts, and each new card goes to its default branch, or to the
 * first branch with a free seat when that one is full. Bought pips stay; what they pay is read from the new deck.
 */
export function withDeck(career: CareerRecord, deck: readonly string[], cards: ReadonlyMap<string, SupportCardTemplate>): CareerRecord {
  const posts: Record<string, Branch> = {}
  for (const id of deck) {
    const kept = career.posts[id]
    if (kept !== undefined && career.deck.includes(id)) posts[id] = kept
  }
  for (const id of deck) {
    if (posts[id] !== undefined) continue
    const taken = seatsTaken(posts, deck)
    const preferred = defaultBranch(cards.get(id)!.type)
    posts[id] = taken[preferred] < BRANCH_SEATS ? preferred : BRANCHES.find((branch) => taken[branch] < BRANCH_SEATS)!
  }
  return { ...career, deck: [...deck], posts }
}

/** The career with one deck card moved to a branch, or why it can't move. */
export function postCard(career: CareerRecord, cardId: string, branch: Branch, cards: ReadonlyMap<string, SupportCardTemplate>): CareerRecord | Refusal {
  const card = cards.get(cardId)
  const title = card?.title ?? 'That card'
  if (!career.deck.includes(cardId)) return refuse('not-in-deck', `${title} isn't in her deck.`)
  if (career.posts[cardId] === branch) return refuse('already-posted', `${title} already trains at ${BRANCH_NAMES[branch]}.`)
  if (seatsTaken(career.posts, career.deck)[branch] >= BRANCH_SEATS) {
    return refuse('branch-full', `${BRANCH_NAMES[branch]} already seats ${BRANCH_SEATS} cards.`)
  }
  return { ...career, posts: { ...career.posts, [cardId]: branch } }
}

/** A deck card's branch: its post, or its default when it has none. */
export const postOf = (career: Pick<CareerRecord, 'posts'>, cardId: string, card: Pick<SupportCardTemplate, 'type'>): Branch =>
  career.posts[cardId] ?? defaultBranch(card.type)
