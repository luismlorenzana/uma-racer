// What one training session pays (docs/game/05-the-build.md, D382): the original's formula (05 §2.1) with mood fixed at
// Great and one per-scenario scale, exactly 05 §3.3:
//
//   gain[stat] = floor( s(T) × (Base[stat] + Σ Stat Bonus[stat])
//                     × Π_friendship (1 + Friendship) × (1 + Unique Friendship)
//                     × (1 + 0.20 × (1 + Σ Mood Effect))
//                     × (1 + Σ Training Effectiveness)
//                     × (1 + 0.05 × cards present)
//                     × (1 + Growth[stat]) )            only the stats the facility trains
//   gainSP     = the same on Base SP + Σ Skill Point Bonus, without growth
//
// Pure.
import type { SupportCardTemplate } from '../content'
import type { Branch } from '../save/records'
import { STATS, type Stats } from '../types'
import { amountOf, EFFECT, inFriendship, resolveEffects, STAT_BONUS, type CardSituation } from './effects'
import type { FacilityRow } from './facilities'

/** Mood is fixed at Great: +20% (05 §3.3). */
export const MOOD_GREAT = 0.2
/** Each card present adds 5% (the headcount bonus). */
export const HEADCOUNT_BONUS = 0.05

/**
 * The per-scenario scale s(T): 1 at URA Finale. A table filled per scenario as each one's `sim:decks` sets it (D382);
 * a scenario without a row has no tuned build yet.
 */
export const SESSION_SCALE: Readonly<Record<number, number>> = Object.freeze({ 1: 1 })

export function sessionScaleAt(T: number): number {
  const scale = SESSION_SCALE[T]
  if (scale === undefined) throw new RangeError(`Scenario ${T}'s session scale isn't set yet`)
  return scale
}

/** A card at a session, as the formula reads it: fractions for percentages, flat bonuses as they are. */
export interface SessionCard {
  /** An own-type card at bond ≥ 80: its Friendship multiplies. */
  readonly inFriendship: boolean
  readonly friendship: number
  readonly uniqueFriendship: number
  readonly mood: number
  readonly effectiveness: number
  readonly statBonus: Stats
  readonly spBonus: number
}

export interface SessionInput {
  /** The facility level's base. */
  readonly base: FacilityRow
  /** The cards posted to the branch. */
  readonly cards: readonly SessionCard[]
  /** Her growth rates, as fractions. */
  readonly growth: Stats
  /** s(T). */
  readonly scale: number
}

export interface Gain {
  readonly stats: Stats
  readonly sp: number
}

// Floating-point products such as 15 × 1.2 land a hair under the whole number; the original's floor doesn't.
const floor = (value: number): number => Math.floor(value + 1e-9)

/** One session's gain: exactly 05 §3.3. */
export function sessionGain(input: SessionInput): Gain {
  const { base, cards, growth, scale } = input
  const friendship = cards.filter((card) => card.inFriendship)
    .reduce((product, card) => product * (1 + card.friendship) * (1 + card.uniqueFriendship), 1)
  const mood = 1 + MOOD_GREAT * (1 + cards.reduce((sum, card) => sum + card.mood, 0))
  const effectiveness = 1 + cards.reduce((sum, card) => sum + card.effectiveness, 0)
  const headcount = 1 + HEADCOUNT_BONUS * cards.length
  const common = scale * friendship * mood * effectiveness * headcount
  const stats = Object.fromEntries(STATS.map((stat) => {
    if (base.stats[stat] <= 0) return [stat, 0]
    const flat = base.stats[stat] + cards.reduce((sum, card) => sum + card.statBonus[stat], 0)
    return [stat, floor(flat * common * (1 + growth[stat]))]
  })) as unknown as Stats
  const sp = floor((base.sp + cards.reduce((sum, card) => sum + card.spBonus, 0)) * common)
  return { stats, sp }
}

/** A posted card's effects at a session, as the formula reads them. */
export function sessionCard(card: Pick<SupportCardTemplate, 'type' | 'effects' | 'uniqueEffect'>, at: CardSituation): SessionCard {
  const effects = resolveEffects(card, at)
  const percent = (id: number) => amountOf(effects, id) / 100
  return {
    inFriendship: inFriendship(card, at.branch, at.bond),
    friendship: percent(EFFECT.friendship),
    uniqueFriendship: effects.uniqueFriendship / 100,
    mood: percent(EFFECT.mood),
    effectiveness: percent(EFFECT.effectiveness),
    statBonus: Object.fromEntries(STATS.map((stat) => [stat, amountOf(effects, STAT_BONUS[stat])])) as unknown as Stats,
    spBonus: amountOf(effects, EFFECT.spBonus),
  }
}

/** The drill cuts at a branch's session: Σ Energy Cost Reduction, and Σ Wit Friendship Recovery at Wit in friendship. */
export function sessionCuts(cards: readonly { card: Pick<SupportCardTemplate, 'type' | 'effects' | 'uniqueEffect'>; at: CardSituation }[], branch: Branch): { energyCut: number; recovery: number } {
  let energyCut = 0
  let recovery = 0
  for (const { card, at } of cards) {
    const effects = resolveEffects(card, at)
    energyCut += amountOf(effects, EFFECT.energyCut) / 100
    if (branch === 'wit' && inFriendship(card, branch, at.bond)) recovery += amountOf(effects, EFFECT.witRecovery)
  }
  return { energyCut, recovery }
}

export const addGains = (a: Gain, b: Gain, times = 1): Gain => ({
  stats: Object.fromEntries(STATS.map((stat) => [stat, a.stats[stat] + b.stats[stat] * times])) as unknown as Stats,
  sp: a.sp + b.sp * times,
})

export const NO_GAIN: Gain = Object.freeze({ stats: Object.freeze({ speed: 0, stamina: 0, power: 0, guts: 0, wit: 0 }), sp: 0 })
