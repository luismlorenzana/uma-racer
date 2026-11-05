// What a career pays beyond its stages (docs/game/03-careers.md §5, D383): an objective's win pays a Card Ticket to the
// account and SP by grade, times one plus the deck's real Race Bonus, into the career's wallet; completing the URA
// Finals pays an Uma Ticket and two Card Tickets. An objective is raced until won and never again, so every win is its
// first. Pure.
import { cardRaceBonus } from '../cards'
import type { SupportCardTemplate } from '../content'
import { CAREER_STAGE_GRADES } from '../scenario-goals'
import type { CareerStage } from '../career-shapes'
import type { AccountRecord, CareerRecord } from '../save/records'
import type { RaceGrade } from '../types'

/** SP an objective's win pays by its grade, before Race Bonus. */
export const OBJECTIVE_SP: Readonly<Partial<Record<RaceGrade, number>>> = Object.freeze({ g3: 40, g2: 60, g1: 100 })
/** Card Tickets an objective's win pays. */
export const OBJECTIVE_CARD_TICKETS = 1
/** What completing the URA Finals pays the account. */
export const FINALE_REWARD = Object.freeze({ umaTickets: 1, cardTickets: 2 })

/** The deck's summed real Race Bonus, as a fraction. Cards missing from content add nothing. */
export function deckRaceBonus(deck: readonly string[], cards: ReadonlyMap<string, Pick<SupportCardTemplate, 'effects' | 'uniqueEffect'>>): number {
  return deck.reduce((sum, id) => {
    const card = cards.get(id)
    return card === undefined ? sum : sum + cardRaceBonus(card)
  }, 0)
}

export interface ObjectiveReward {
  readonly cardTickets: number
  readonly sp: number
  /** The deck's Race Bonus the SP was multiplied by. */
  readonly raceBonus: number
}

/** An objective's win: round(SP by grade × (1 + Σ Race Bonus)), and one Card Ticket. */
export function objectiveReward(stage: CareerStage, deck: readonly string[], cards: ReadonlyMap<string, SupportCardTemplate>): ObjectiveReward {
  const raceBonus = deckRaceBonus(deck, cards)
  const base = OBJECTIVE_SP[CAREER_STAGE_GRADES[stage]] ?? 0
  return { cardTickets: OBJECTIVE_CARD_TICKETS, sp: Math.round(base * (1 + raceBonus)), raceBonus }
}

/** The account and the career with an objective's reward paid. */
export function payObjective(account: AccountRecord, career: CareerRecord, reward: ObjectiveReward): { account: AccountRecord; career: CareerRecord } {
  return {
    account: { ...account, cardTickets: account.cardTickets + reward.cardTickets },
    career: { ...career, wallet: { ...career.wallet, sp: career.wallet.sp + reward.sp } },
  }
}

/** The account with the URA Finals' reward paid. */
export const payFinale = (account: AccountRecord): AccountRecord => ({
  ...account,
  umaTickets: account.umaTickets + FINALE_REWARD.umaTickets,
  cardTickets: account.cardTickets + FINALE_REWARD.cardTickets,
})
