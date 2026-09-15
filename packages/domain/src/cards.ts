// SSR support cards: usage leveling, limit breaks, generated effect values (docs/design/support-cards.md).

export const CARD_MAX_LEVEL = 25
export const LEVELS_PER_LIMIT_BREAK = 5
export const MAX_LIMIT_BREAK = 4

export const cardExpToNext = (level: number): number => 40 + 15 * (level - 1)

/** Highest level reachable at a limit break: LB0 → 5 … LB4 → 25. */
export const cardLevelCap = (limitBreak: number): number => LEVELS_PER_LIMIT_BREAK * (limitBreak + 1)

export const eraMult = (era: number): number => 1 + 0.08 * (era - 1)

export const LIMIT_BREAK_MULT = [1.0, 1.1, 1.2, 1.32, 1.5] as const

export const levelWithinLimitBreakMult = (level: number): number => 1 + 0.02 * ((level - 1) % LEVELS_PER_LIMIT_BREAK)

export const CARD_TRAINING_EXP = { equipped: 5, present: 15, friendship: 25 } as const

export type CardEffect =
  | 'trainingBonus'
  | 'friendshipBonus'
  | 'statBonus'
  | 'skillPointBonus'
  | 'specialtyPriority'
  | 'hintFrequency'
  | 'raceBonus'
  | 'initialStats'

/** Base values for an era-1, LB0, level-1 card. */
export const CARD_EFFECT_BASE: Record<CardEffect, number> = {
  trainingBonus: 0.05,
  friendshipBonus: 0.15,
  statBonus: 3,
  skillPointBonus: 2,
  specialtyPriority: 15,
  hintFrequency: 0.2,
  raceBonus: 0.03,
  initialStats: 10,
}

export function cardEffectValue(
  effect: CardEffect,
  opts: { era: number; limitBreak: number; level: number; profileWeight?: number },
): number {
  const lb = LIMIT_BREAK_MULT[Math.min(MAX_LIMIT_BREAK, Math.max(0, opts.limitBreak))]!
  return (
    CARD_EFFECT_BASE[effect] * eraMult(opts.era) * lb * levelWithinLimitBreakMult(opts.level) * (opts.profileWeight ?? 1)
  )
}
