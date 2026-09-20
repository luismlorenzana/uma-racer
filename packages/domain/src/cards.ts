// SSR support cards: usage leveling, limit breaks, generated effect values (docs/design/support-cards.md).

import type { SupportCardTemplate } from './content'

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
export const CARD_UNIQUE_BONUS_MULTIPLIER = 0.25
export const BROAD_CARD_STAT_DIVISOR = 5

export const CARD_EFFECTS = [
  'trainingBonus',
  'friendshipBonus',
  'statBonus',
  'skillPointBonus',
  'specialtyPriority',
  'hintFrequency',
  'raceBonus',
  'initialStats',
] as const
export type CardEffect = (typeof CARD_EFFECTS)[number]

/** Four slots in tier 1, five in tier 2, and the full six from tier 3 onward. */
export const deckSlotCount = (tier: number): number => (tier <= 1 ? 4 : tier === 2 ? 5 : 6)

/** Base values for an era-1, LB0, level-1 card. */
export const CARD_EFFECT_BASE: Record<CardEffect, number> = {
  trainingBonus: 0.05,
  friendshipBonus: 0.15,
  statBonus: 6,
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

export const STAT_BONUS_SOURCE_IDS = { speed: 3, stamina: 4, power: 5, guts: 6, wit: 7 } as const
export const INITIAL_STAT_SOURCE_IDS = { speed: 9, stamina: 10, power: 11, guts: 12, wit: 13 } as const

export const isBroadSupportCard = (template: Pick<SupportCardTemplate, 'type'>): boolean =>
  template.type === 'friend' || template.type === 'group'

/** Map only source effect identity; original values and conditions never enter the generated rules. */
export function sourceCardEffect(effectType: number, cardType: SupportCardTemplate['type']): CardEffect | null {
  if (effectType === 1) return 'friendshipBonus'
  if (effectType === 8) return 'trainingBonus'
  if (effectType === 15) return 'raceBonus'
  if (effectType === 18) return 'hintFrequency'
  if (effectType === 19) return 'specialtyPriority'
  if (effectType === 30) return 'skillPointBonus'
  if (cardType === 'friend' || cardType === 'group') {
    if (Object.values(STAT_BONUS_SOURCE_IDS).some((sourceId) => sourceId === effectType)) return 'statBonus'
    if (Object.values(INITIAL_STAT_SOURCE_IDS).some((sourceId) => sourceId === effectType)) return 'initialStats'
    return null
  }
  if (effectType === STAT_BONUS_SOURCE_IDS[cardType]) return 'statBonus'
  if (effectType === INITIAL_STAT_SOURCE_IDS[cardType]) return 'initialStats'
  return null
}

export function cardUniqueEffectKinds(template: SupportCardTemplate): ReadonlySet<CardEffect> {
  return new Set(
    (template.uniqueEffect?.effects ?? [])
      .map((effect) => sourceCardEffect(effect.type, template.type))
      .filter((effect): effect is CardEffect => effect !== null),
  )
}

export interface CardEffectProjection {
  effect: CardEffect
  value: number
  signatureBonus: number
  unlockLimitBreak: number
  improvementLimitBreak: number | null
  inactiveReason: string | null
}

const EFFECT_UNLOCK_LB: Record<CardEffect, number> = {
  trainingBonus: 0,
  friendshipBonus: 0,
  statBonus: 0,
  skillPointBonus: 0,
  specialtyPriority: 0,
  hintFrequency: 0,
  raceBonus: 1,
  initialStats: 0,
}

const EFFECT_IMPROVEMENT_LB: Partial<Record<CardEffect, number>> = {
  specialtyPriority: 2,
  initialStats: 3,
}

/** One generated projection shared by Training, racing, and the Cards UI. */
export function projectCardEffects(
  template: SupportCardTemplate,
  state: { limitBreak: number; level: number },
): CardEffectProjection[] {
  const uniqueKinds = state.limitBreak >= MAX_LIMIT_BREAK ? cardUniqueEffectKinds(template) : new Set<CardEffect>()
  return CARD_EFFECTS.map((effect) => {
    const unlockLimitBreak = EFFECT_UNLOCK_LB[effect]
    const inactiveReason = isBroadSupportCard(template)
      ? effect === 'specialtyPriority'
        ? 'No specialty facility'
        : effect === 'friendshipBonus'
          ? 'Cannot match a facility'
          : null
      : null
    let value = state.limitBreak < unlockLimitBreak
      ? 0
      : cardEffectValue(effect, {
        era: template.era,
        limitBreak: state.limitBreak,
        level: state.level,
        profileWeight: template.effectProfile[effect],
      })
    if (effect === 'specialtyPriority' && state.limitBreak >= 2) value *= 1.5
    if (effect === 'initialStats' && state.limitBreak >= 3) value *= 2
    if (inactiveReason) value = 0
    const signatureBonus = inactiveReason === null && uniqueKinds.has(effect) ? value * CARD_UNIQUE_BONUS_MULTIPLIER : 0
    return {
      effect,
      value: value + signatureBonus,
      signatureBonus,
      unlockLimitBreak,
      improvementLimitBreak: EFFECT_IMPROVEMENT_LB[effect] ?? null,
      inactiveReason,
    }
  })
}

/** Count distinct preserved LB4 source identities that Uma Racer intentionally does not approximate. */
export function inactiveCardUniqueEffectCount(template: SupportCardTemplate): number {
  return new Set(
    (template.uniqueEffect?.effects ?? [])
      .map((effect) => effect.type)
      .filter((effectType) => {
        const effect = sourceCardEffect(effectType, template.type)
        return effect === null || (isBroadSupportCard(template) &&
          (effect === 'friendshipBonus' || effect === 'specialtyPriority'))
      }),
  ).size
}

export function projectedCardEffectValue(
  effect: CardEffect,
  template: SupportCardTemplate,
  state: { limitBreak: number; level: number },
): number {
  return projectCardEffects(template, state).find((row) => row.effect === effect)!.value
}
