// Training Level (1–10, resets each scenario) and stat gains (docs/design/training.md).
import { baselineSpCap, baselineStatCap, STAT_SOFT_CAP } from './scenarios'
import type { GainKey, StatKey, Stats } from './types'

export const MAX_TRAINING_LEVEL = 10
export const TRAINING_EXP_PER_TURN = 36
export const FRIENDSHIP_TRAINING_EXP_MULT = 1.5
export const EXP_TO_NEXT_TRAINING_LEVEL = 100

/** 80% of the scenario baseline at TL1, 100% at TL10. */
export function capMult(trainingLevel: number): number {
  const tl = Math.min(MAX_TRAINING_LEVEL, Math.max(1, trainingLevel))
  return 0.8 + ((tl - 1) * 0.2) / 9
}

export const statCap = (tier: number, trainingLevel: number): number =>
  Math.round(baselineStatCap(tier) * capMult(trainingLevel))

export const spCap = (tier: number, trainingLevel: number): number =>
  Math.round(baselineSpCap(tier) * capMult(trainingLevel))

export type Facility = StatKey
export type CardType = StatKey | 'friend' | 'group'

export const FACILITY_BASE_GAINS: Record<Facility, Partial<Record<GainKey, number>>> = {
  speed: { speed: 60, power: 24, sp: 6 },
  stamina: { stamina: 54, guts: 24, sp: 6 },
  power: { power: 54, stamina: 24, sp: 6 },
  guts: { guts: 48, speed: 18, power: 18, sp: 6 },
  wit: { wit: 54, speed: 12, sp: 12 },
}

/** Effect values of a card present at the chosen facility, already scaled by era/LB/level. */
export interface PresentCard {
  type: CardType
  /** 0.10 = +10% */
  trainingBonus: number
  /** 0.25 = +25%; only applies when the card type matches the facility. */
  friendshipBonus: number
  /** Flat additions: targeted Stat Bonus, five-way broad support, and Skill Point Bonus as `sp`. */
  flatBonus: Partial<Record<GainKey, number>>
}

export const isFriendshipTraining = (facility: Facility, cards: readonly PresentCard[]): boolean =>
  cards.some((c) => c.type === facility)

/** Unrounded gains for one training turn. Scenario modifiers apply before the ordinary rounding step. */
export function trainingRawGains(
  facility: Facility,
  umaGrowth: Partial<Stats>,
  presentCards: readonly PresentCard[],
): Partial<Record<GainKey, number>> {
  const base = FACILITY_BASE_GAINS[facility]
  const training = 1 + presentCards.reduce((sum, c) => sum + c.trainingBonus, 0)
  const friendship = presentCards
    .filter((c) => c.type === facility)
    .reduce((product, c) => product * (1 + c.friendshipBonus), 1)
  const crowd = 1 + 0.05 * presentCards.length

  const gains: Partial<Record<GainKey, number>> = {}
  const keys = new Set<GainKey>(Object.keys(base) as GainKey[])
  for (const card of presentCards) {
    if (card.type === 'friend' || card.type === 'group') {
      for (const key of Object.keys(card.flatBonus) as GainKey[]) keys.add(key)
    }
  }
  for (const key of keys) {
    const value = base[key] ?? 0
    const flat = presentCards.reduce((sum, c) => sum + (c.flatBonus[key] ?? 0), 0)
    const growth = key === 'sp' ? 0 : (umaGrowth[key] ?? 0)
    gains[key] = (value + flat) * (1 + growth) * training * friendship * crowd
  }
  return gains
}

export function roundTrainingGains(
  gains: Partial<Record<GainKey, number>>,
): Partial<Record<GainKey, number>> {
  return Object.fromEntries(
    Object.entries(gains).map(([key, value]) => [key, Math.round(value!)]),
  ) as Partial<Record<GainKey, number>>
}

/** Gains for one ordinary training turn, rounded. Caps are applied separately by `applyCappedGain`. */
export function trainingGains(
  facility: Facility,
  umaGrowth: Partial<Stats>,
  presentCards: readonly PresentCard[],
): Partial<Record<GainKey, number>> {
  return roundTrainingGains(trainingRawGains(facility, umaGrowth, presentCards))
}

/**
 * Caps only limit gains — a value already above the cap is kept, never reduced. The part of a gain above
 * STAT_SOFT_CAP (1200) counts half, as in the original game. Skill points have no soft cap: pass `softCap: false`.
 */
export function applyCappedGain(current: number, gain: number, cap: number, softCap = true): number {
  if (current >= cap || gain <= 0) return current
  if (!softCap) return Math.min(cap, current + gain)
  const full = Math.max(0, Math.min(gain, STAT_SOFT_CAP - current))
  return Math.min(cap, current + full + Math.floor((gain - full) / 2))
}

export function trainingExpForTurn(friendship: boolean): number {
  return Math.round(TRAINING_EXP_PER_TURN * (friendship ? FRIENDSHIP_TRAINING_EXP_MULT : 1))
}

/** Adds Training EXP, levelling up as needed. EXP stops accumulating at TL10. */
export function addTrainingExp(trainingLevel: number, exp: number, gained: number): { trainingLevel: number; exp: number } {
  let tl = trainingLevel
  let total = exp + gained
  while (tl < MAX_TRAINING_LEVEL && total >= EXP_TO_NEXT_TRAINING_LEVEL) {
    total -= EXP_TO_NEXT_TRAINING_LEVEL
    tl += 1
  }
  return { trainingLevel: tl, exp: tl === MAX_TRAINING_LEVEL ? 0 : total }
}
