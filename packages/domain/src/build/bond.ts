// Bond tracks (docs/game/06-cards-and-bonds.md, D382): one per (Uma, tier, card), 0–100, starting at the card's real
// Initial Friendship Gauge. The owner pours Bond from the career's wallet into a deck card's track. Its stops: a hint
// every round(20 / (1 + Hint Frequency)) bond, friendship at 80, and the card's event skills at 100. Pure.
import type { SupportCardTemplate } from '../content'
import { refuse, type Refusal } from '../save/registry'
import { BOND_MAX, bondId, type BondRecord, type CareerRecord } from '../save/records'
import { tierOf } from '../tiers/map'
import { STATS, zeroStats, type StatKey, type Stats } from '../types'
import { postOf } from './deck'
import { amountOf, CARD_LEVEL, deckWideTerms, EFFECT, FRIENDSHIP_BOND, staticEffects, UNIQUE, uniqueTerms, type DeckFacts, LONE_DECK } from './effects'

/** A hint every this much bond at Hint Frequency 0. */
export const HINT_BOND = 20
/** What a training together pays the gauge in the original (05 §2.3); the extra-bond unique adds to it. */
export const BOND_PER_TRAINING = 7

type CardEffects = Pick<SupportCardTemplate, 'type' | 'effects' | 'uniqueEffect'>

/** Bond between two hints: round(20 / (1 + Hint Frequency)). */
export const hintInterval = (card: CardEffects): number =>
  Math.max(1, Math.round(HINT_BOND / (1 + amountOf(staticEffects(card), EFFECT.hintFrequency) / 100)))

/** The level a card's hints arrive at: 1 + its Hint Levels. */
export const hintLevel = (card: CardEffects): number => 1 + amountOf(staticEffects(card), EFFECT.hintLevels)

/** Where a track starts: the card's Initial Friendship Gauge, plus any deck-wide gauge (115), up to 100. */
export const initialBond = (card: CardEffects, deck: DeckFacts = LONE_DECK): number =>
  Math.min(BOND_MAX, Math.max(0, Math.floor(amountOf(staticEffects(card, deck), EFFECT.initialBond))))

/** A track's bond: its record, or where it would start. */
export const bondValue = (track: BondRecord | undefined, card: CardEffects, deck: DeckFacts = LONE_DECK): number =>
  track?.value ?? initialBond(card, deck)

/** The hint stops a track crosses going from one bond to another. */
export const hintsBetween = (from: number, to: number, interval: number): number =>
  Math.max(0, Math.floor(to / interval) - Math.floor(from / interval))

export interface BondStop {
  readonly at: number
  readonly kind: 'hint' | 'friendship' | 'events'
}

/** A card's stops: its hints at every multiple of its interval, friendship at 80, its events at 100. */
export function bondStops(card: CardEffects): BondStop[] {
  const interval = hintInterval(card)
  const stops: BondStop[] = []
  for (let at = interval; at <= BOND_MAX; at += interval) stops.push({ at, kind: 'hint' })
  stops.push({ at: FRIENDSHIP_BOND, kind: 'friendship' }, { at: BOND_MAX, kind: 'events' })
  return stops.sort((a, b) => a.at - b.at || (a.kind === 'hint' ? -1 : 1))
}

/**
 * The extra bond the deck's extra-bond uniques (121) give a pour into this card's track: each gives `value` to every
 * deck card, and params[0] to the cards posted at its own branch (itself included).
 */
export function extraBond(career: Pick<CareerRecord, 'deck' | 'posts'>, cardId: string, cards: ReadonlyMap<string, SupportCardTemplate>): number {
  const card = cards.get(cardId)
  if (card === undefined) return 0
  const branch = postOf(career, cardId, card)
  let extra = 0
  for (const id of career.deck) {
    const giver = cards.get(id)
    if (giver === undefined) continue
    for (const term of uniqueTerms(giver)) {
      if (term.type !== UNIQUE.extraBond) continue
      extra += postOf(career, id, giver) === branch ? (term.params[0] ?? 0) : term.value
    }
  }
  return extra
}

/** Bond a pour adds: the amount, × (7 + extra) / 7, rounded down. */
export const bondGain = (amount: number, extra: number): number =>
  Math.floor((amount * (BOND_PER_TRAINING + extra)) / BOND_PER_TRAINING)

/** The least Bond that fills `need` with this extra. */
export const bondToFill = (need: number, extra: number): number =>
  Math.ceil((need * BOND_PER_TRAINING) / (BOND_PER_TRAINING + extra) - 1e-9)

export interface PourReceipt {
  readonly cardId: string
  /** Bond taken from the wallet. */
  readonly spent: number
  /** The track's bond after. */
  readonly value: number
  /** Hints this pour gave. */
  readonly hints: number
}

export interface Poured {
  readonly career: CareerRecord
  readonly track: BondRecord
  readonly receipt: PourReceipt
}

/**
 * Pours Bond into a deck card's track. A new track starts at the card's gauge; the stops its start already passed pay
 * nothing. A pour past 100 takes only what fills the track.
 */
export function pourBond(
  career: CareerRecord,
  bonds: Readonly<Record<string, BondRecord>>,
  cards: ReadonlyMap<string, SupportCardTemplate>,
  cardId: string,
  amount: number,
): Poured | Refusal {
  const card = cards.get(cardId)
  const title = card?.title ?? 'That card'
  if (card === undefined || !career.deck.includes(cardId)) return refuse('not-in-deck', `${title} isn't in her deck.`)
  if (amount > career.wallet.bond) return refuse('not-enough-bond', `She has ${career.wallet.bond} Bond, not ${amount}.`, { have: career.wallet.bond, need: amount })
  const tier = tierOf(career.T)
  const id = bondId(career.umaId, tier, cardId)
  const deckWide = deckWideTerms(career.deck.flatMap((deckId) => cards.get(deckId) ?? []))
  const from = bondValue(bonds[id], card, { ...LONE_DECK, deckWide })
  if (from >= BOND_MAX) return refuse('bond-full', `${title}'s bond is full.`)
  const extra = extraBond(career, cardId, cards)
  const spent = Math.min(amount, bondToFill(BOND_MAX - from, extra))
  const value = Math.min(BOND_MAX, from + bondGain(spent, extra))
  const hints = hintsBetween(from, value, hintInterval(card))
  const track: BondRecord = { umaId: career.umaId, tier, cardId, value, hints: (bonds[id]?.hints ?? 0) + hints }
  return {
    career: { ...career, wallet: { ...career.wallet, bond: career.wallet.bond - spent } },
    track,
    receipt: { cardId, spent, value, hints },
  }
}

/** One skill hint a track gave: the skill and the levels it adds. */
export interface HintGift {
  readonly skillId: string
  readonly levels: number
}

/**
 * What a track has given: its hints' skills in the card's list order (wrapping round), each at 1 + Hint Levels; its
 * event skills, golds included, once at 100; and its non-skill hint rewards on every hint (stats 1–5, SP 30).
 */
export function trackGifts(track: Pick<BondRecord, 'value' | 'hints'>, card: Pick<SupportCardTemplate, 'type' | 'effects' | 'uniqueEffect' | 'hintSkillIds' | 'hintOthers' | 'eventSkillIds'>): {
  readonly skills: readonly HintGift[]
  readonly stats: Stats
  readonly sp: number
} {
  const levels = hintLevel(card)
  const skills: HintGift[] = []
  if (card.hintSkillIds.length > 0) {
    for (let n = 0; n < track.hints; n++) skills.push({ skillId: card.hintSkillIds[n % card.hintSkillIds.length]!, levels })
  }
  if (track.value >= BOND_MAX) for (const skillId of card.eventSkillIds) skills.push({ skillId, levels })
  const stats = zeroStats()
  let sp = 0
  for (const reward of card.hintOthers) {
    if ((reward.minLevel ?? 0) > CARD_LEVEL) continue
    const stat = STATS[reward.type - 1] as StatKey | undefined
    if (reward.type >= 1 && reward.type <= 5 && stat !== undefined) stats[stat] += reward.value * track.hints
    else if (reward.type === EFFECT.spBonus) sp += reward.value * track.hints
  }
  return { skills, stats, sp }
}

/** Her tracks for a tier, by card id. */
export function tracksOf(bonds: Readonly<Record<string, BondRecord>>, umaId: string, tier: number): BondRecord[] {
  return Object.values(bonds).filter((track) => track.umaId === umaId && track.tier === tier)
}
