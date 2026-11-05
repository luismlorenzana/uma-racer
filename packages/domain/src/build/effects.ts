// A support card's real effects, read in a situation (docs/game/06-cards-and-bonds.md, D382): its top-level effects,
// its unique effect, and the unique's conditionals translated to the tree (05 §3.3). Effect ids are the original's
// (05 §1); the conditional ids and their params follow umamusu.wiki's `Module:Game/Supports/Data/Effects`. Pure.
import { INITIAL_STAT_SOURCE_IDS, STAT_BONUS_SOURCE_IDS } from '../cards'
import type { SupportCardTemplate, SupportCardType } from '../content'
import type { Branch } from '../save/records'
import { STATS, type StatKey } from '../types'

/** Every card is owned at its top level (D329): an SSR's level 50, where every unique effect is on. */
export const CARD_LEVEL = 50

/** The original's effect ids the build reads (05 §1). */
export const EFFECT = Object.freeze({
  friendship: 1,
  mood: 2,
  effectiveness: 8,
  initialBond: 14,
  raceBonus: 15,
  hintLevels: 17,
  hintFrequency: 18,
  energyCut: 28,
  spBonus: 30,
  witRecovery: 31,
  initialSp: 32,
  /** "All Stats Training Bonus": a Stat Bonus on every stat. */
  allStatsBonus: 41,
})

export const STAT_BONUS: Readonly<Record<StatKey, number>> = STAT_BONUS_SOURCE_IDS
export const INITIAL_STAT: Readonly<Record<StatKey, number>> = INITIAL_STAT_SOURCE_IDS

/** The unique effect's conditional ids that the tree translates (05 §3.3, D382). */
export const UNIQUE = Object.freeze({
  /** At bond ≥ value: params are (effect, amount) pairs. */
  bond: 101,
  /** At bond ≥ value, posted off its own type: Training Effectiveness + params[0]. */
  bondOffType: 102,
  /** With at least `value` card types in the deck: Training Effectiveness + params[0]. */
  deckTypes: 103,
  /** Initial stat + value of each deck card's type; Friend and Group cards + params[0] to every stat. */
  initialPerCard: 105,
  /** In friendship: effect params[0] + params[1] per session in its branch, up to `value` sessions. */
  friendshipSessions: 106,
  /** Effect `value` + 1 per params[0] bond across the deck. */
  deckBond: 109,
  /** Effect `value` + params[0] per other card posted alongside. */
  alongside: 110,
  /** Effect `value` + params[0] per level of the pip. */
  facilityLevel: 111,
  /** Effect `value` + params[0] on a friendship pip (some card at its branch in friendship). */
  friendshipPip: 113,
  /** Effect `value` + params[0] for every card in the deck. */
  deckWide: 115,
  /** Effect `value` up to params[1], scaling with the tree's combined facility level up to params[0]. */
  combinedLevel: 117,
  /** At bond ≥ params[0]: Stat Bonus + value per deck card of each type (up to params[2]); Friend and Group: SP Bonus + params[1]. */
  deckTypeBonus: 120,
  /** Extra bond: + value to every track, + params[0] to cards posted with it (read by bond.ts). */
  extraBond: 121,
})

/**
 * The conditionals the tree drops (still shown on the card): fans (104), energy (107, 108, 114), failure (112), skills
 * learned by category (116), appearances and Specialty Priority (118, 119), and next-turn buffs (122).
 */
export const DROPPED_UNIQUES: readonly number[] = Object.freeze([104, 107, 108, 112, 114, 116, 118, 119, 122])

/** Friendship opens at this bond, on the card's own type's branch (05 §2.1). */
export const FRIENDSHIP_BOND = 80

/** A card's default branch: its own type's; Friend and Group cards train at Wit. */
export const defaultBranch = (type: SupportCardType): Branch => ((STATS as readonly string[]).includes(type) ? type as Branch : 'wit')

/** In friendship: an own-type card at bond 80 or more. Friend and Group cards never are (D115). */
export const inFriendship = (card: Pick<SupportCardTemplate, 'type'>, branch: Branch, bond: number): boolean =>
  card.type === branch && bond >= FRIENDSHIP_BOND

/** What the deck around a card holds, for the conditionals that count it. */
export interface DeckFacts {
  /** One type per deck card. */
  readonly types: readonly SupportCardType[]
  /** The deck's bonds, summed. */
  readonly bondTotal: number
  /** The tree's facility levels, summed: 5 (all at level 1) to 25. */
  readonly combinedLevel: number
  /** The deck's deck-wide terms (115), by effect id: every deck card gets them. */
  readonly deckWide: Readonly<Record<number, number>>
}

/** Where a card stands when its effects are read. */
export interface CardSituation {
  /** The branch it is posted to. */
  readonly branch: Branch
  /** Its bond, 0–100. */
  readonly bond: number
  /** The pip's facility level, 1–5 (0 outside a session). */
  readonly level: number
  /** Cards posted to its branch, itself included. */
  readonly present: number
  /** Some card at its branch is in friendship. */
  readonly friendshipPip: boolean
  /** Sessions bought in its branch: pips and Camp sessions. */
  readonly sessions: number
  readonly deck: DeckFacts
}

/** A card's effects in a situation: amounts by effect id, and the unique's Friendship Bonus, which multiplies apart. */
export interface ResolvedEffects {
  readonly totals: Readonly<Record<number, number>>
  readonly uniqueFriendship: number
}

/** The unique effect's terms, when the card's level has it on. */
export const uniqueTerms = (card: Pick<SupportCardTemplate, 'uniqueEffect'>): readonly { type: number; value: number; params: readonly number[] }[] =>
  card.uniqueEffect !== null && card.uniqueEffect.level <= CARD_LEVEL ? card.uniqueEffect.effects : []

/** The deck-wide terms (115) of these cards, summed by effect id. */
export function deckWideTerms(cards: readonly Pick<SupportCardTemplate, 'uniqueEffect'>[]): Record<number, number> {
  const out: Record<number, number> = {}
  for (const card of cards) {
    for (const term of uniqueTerms(card)) {
      if (term.type === UNIQUE.deckWide) out[term.value] = (out[term.value] ?? 0) + (term.params[0] ?? 0)
    }
  }
  return out
}

const param = (params: readonly number[], i: number): number => params[i] ?? 0

/** A card's effects in its situation (05 §3.3's "As in the original" and "Translated" rows). */
export function resolveEffects(card: Pick<SupportCardTemplate, 'type' | 'effects' | 'uniqueEffect'>, at: CardSituation): ResolvedEffects {
  const totals: Record<number, number> = {}
  let uniqueFriendship = 0
  const add = (type: number, amount: number, unique: boolean): void => {
    if (amount === 0) return
    if (type === EFFECT.allStatsBonus) {
      for (const stat of STATS) totals[STAT_BONUS[stat]] = (totals[STAT_BONUS[stat]] ?? 0) + amount
    } else if (unique && type === EFFECT.friendship) {
      uniqueFriendship += amount
    } else {
      totals[type] = (totals[type] ?? 0) + amount
    }
  }
  for (const [type, value] of Object.entries(card.effects)) add(Number(type), value, false)
  for (const [type, value] of Object.entries(at.deck.deckWide)) add(Number(type), value, false)

  const own = (stat: SupportCardType): boolean => (STATS as readonly string[]).includes(stat)
  const friendship = inFriendship(card, at.branch, at.bond)
  for (const { type, value, params } of uniqueTerms(card)) {
    const p = (i: number) => param(params, i)
    switch (type) {
      case UNIQUE.bond:
        if (at.bond >= value) {
          add(p(0), p(1), true)
          if (p(2) > 0) add(p(2), p(3), true)
        }
        break
      case UNIQUE.bondOffType:
        if (at.bond >= value && card.type !== at.branch) add(EFFECT.effectiveness, p(0), true)
        break
      case UNIQUE.deckTypes:
        if (new Set(at.deck.types).size >= value) add(EFFECT.effectiveness, p(0), true)
        break
      case UNIQUE.initialPerCard:
        for (const deckType of at.deck.types) {
          if (own(deckType)) add(INITIAL_STAT[deckType as StatKey], value, true)
          else for (const stat of STATS) add(INITIAL_STAT[stat], p(0), true)
        }
        break
      case UNIQUE.friendshipSessions:
        if (friendship) add(p(0), p(1) * Math.min(value, at.sessions), true)
        break
      case UNIQUE.deckBond:
        if (p(0) > 0) add(value, Math.min(Math.floor(600 / p(0)), Math.floor(at.deck.bondTotal / p(0))), true)
        break
      case UNIQUE.alongside:
        add(value, p(0) * Math.max(0, at.present - 1), true)
        break
      case UNIQUE.facilityLevel:
        add(value, p(0) * at.level, true)
        break
      case UNIQUE.friendshipPip:
        if (at.friendshipPip) add(value, p(0), true)
        break
      case UNIQUE.combinedLevel:
        if (p(0) > 0) add(value, Math.floor((p(1) * Math.min(at.deck.combinedLevel, p(0))) / p(0)), true)
        break
      case UNIQUE.deckTypeBonus:
        if (at.bond >= p(0)) {
          for (const stat of STATS) add(STAT_BONUS[stat], value * Math.min(p(2), at.deck.types.filter((t) => t === stat).length), true)
          add(EFFECT.spBonus, p(1) * Math.min(p(2), at.deck.types.filter((t) => !own(t)).length), true)
        }
        break
      case UNIQUE.deckWide:
      case UNIQUE.extraBond:
        break // read from the deck (`deckWideTerms`) and by bond.ts
      default:
        if (type < 100) add(type, value, true) // a plain effect, always on
        // Any other conditional is dropped (DROPPED_UNIQUES), or unknown: nothing.
    }
  }
  return { totals, uniqueFriendship }
}

/** An amount from resolved effects (0 when absent). */
export const amountOf = (effects: ResolvedEffects, id: number): number => effects.totals[id] ?? 0

/** The deck facts of a card read alone: no deck around it, nothing bonded, the tree untouched. */
export const LONE_DECK: DeckFacts = Object.freeze({ types: Object.freeze([]), bondTotal: 0, combinedLevel: 5, deckWide: Object.freeze({}) })

/**
 * A card's effects outside any session, for what doesn't depend on where it trains: Initial stats, Initial SP, its
 * Initial Friendship Gauge, Hint Levels and Hint Frequency, Race Bonus. Read at bond 0 at its default branch.
 */
export const staticEffects = (card: Pick<SupportCardTemplate, 'type' | 'effects' | 'uniqueEffect'>, deck: DeckFacts = LONE_DECK): ResolvedEffects =>
  resolveEffects(card, { branch: defaultBranch(card.type), bond: 0, level: 0, present: 1, friendshipPip: false, sessions: 0, deck })
