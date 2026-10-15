// SSR support cards: the generated effect profile that still feeds Race Bonus (docs/design/support-cards.md). The rest
// of the effect model died with the training turn (D125), and every card pays 100%: no stars (D329).

import type { SkillTemplate, SupportCardTemplate } from './content'

export const eraMult = (era: number): number => 1 + 0.08 * (era - 1)

export const CARD_UNIQUE_BONUS_MULTIPLIER = 0.25

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

export const STAT_BONUS_SOURCE_IDS = { speed: 3, stamina: 4, power: 5, guts: 6, wit: 7 } as const
export const INITIAL_STAT_SOURCE_IDS = { speed: 9, stamina: 10, power: 11, guts: 12, wit: 13 } as const

/**
 * A card's gold skills, in its events' order: in the original a card's gold comes from its event chain, never from its
 * hints (every one of the 2,331 hint skills is white). Each node the card fills pays the next of them, on top of the
 * next white hint (D182).
 */
export function cardGoldSkillIds(
  template: Pick<SupportCardTemplate, 'eventSkillIds'>,
  skills: ReadonlyMap<string, Pick<SkillTemplate, 'kind'>>,
): string[] {
  return template.eventSkillIds.filter((id) => skills.get(id)?.kind === 'gold')
}

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

/**
 * Race Bonus for an era-1 card whose profile weight is 1: the value the old model reached at max limit break and level
 * 25 (0.03 × 1.5 × 1.08), so a card races exactly as a maxed card did (D147, D329).
 */
const RACE_BONUS_AT_MAX = 0.03 * 1.5 * 1.08

/**
 * What one card adds to race EXP, the one generated effect that outlived the training turn (D125): its full value, and
 * its unique effect's bonus on top when Race Bonus is one of its kinds.
 */
export function cardRaceBonus(template: SupportCardTemplate): number {
  const full = RACE_BONUS_AT_MAX * eraMult(template.era) * (template.effectProfile.raceBonus ?? 0)
  const signature = cardUniqueEffectKinds(template).has('raceBonus') ? CARD_UNIQUE_BONUS_MULTIPLIER : 0
  return full * (1 + signature)
}
