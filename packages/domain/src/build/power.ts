// Card power (docs/game/06-cards-and-bonds.md, D382): the stat gain a card adds to the reference session, a level-3
// pip at its own type's branch, alone there, at bond 80, for an Uma with no growth, in a fixed reference deck (one card
// of each type and a Friend, all at bond 80, the tree at level 3 throughout). Release 3's refit compares a card with
// its type's median by it; here it is built and tested only. Pure.
import type { SupportCardTemplate, SupportCardType } from '../content'
import { STATS, zeroStats } from '../types'
import { deckWideTerms, defaultBranch, FRIENDSHIP_BOND, inFriendship, type DeckFacts } from './effects'
import { facilityRow, PIPS_PER_LEVEL } from './facilities'
import { sessionCard, sessionGain } from './session'

export const REFERENCE_LEVEL = 3
export const REFERENCE_BOND = FRIENDSHIP_BOND
const REFERENCE_TYPES: readonly SupportCardType[] = ['speed', 'stamina', 'power', 'guts', 'wit', 'friend']

/** The scale a card's power is read on: stat cards against each other; Friend and Group cards on their own. */
export const powerScale = (card: Pick<SupportCardTemplate, 'type'>): 'stat' | 'support' =>
  (STATS as readonly string[]).includes(card.type) ? 'stat' : 'support'

/** The stat gain the card adds to the reference session. Friend and Group cards train at Wit and never reach friendship. */
export function cardPower(card: Pick<SupportCardTemplate, 'type' | 'effects' | 'uniqueEffect'>): number {
  const branch = defaultBranch(card.type)
  const types = REFERENCE_TYPES.includes(card.type) ? REFERENCE_TYPES : [...REFERENCE_TYPES.slice(0, 5), card.type]
  const deck: DeckFacts = {
    types,
    bondTotal: REFERENCE_BOND * types.length,
    combinedLevel: REFERENCE_LEVEL * STATS.length,
    deckWide: deckWideTerms([card]),
  }
  const at = {
    branch, bond: REFERENCE_BOND, level: REFERENCE_LEVEL, present: 1,
    friendshipPip: inFriendship(card, branch, REFERENCE_BOND), sessions: PIPS_PER_LEVEL * (REFERENCE_LEVEL - 1), deck,
  }
  const base = facilityRow(branch, REFERENCE_LEVEL)
  const growth = zeroStats()
  const alone = sessionGain({ base, cards: [], growth, scale: 1 })
  const withCard = sessionGain({ base, cards: [sessionCard(card, at)], growth, scale: 1 })
  return STATS.reduce((sum, stat) => sum + withCard.stats[stat] - alone.stats[stat], 0)
}
