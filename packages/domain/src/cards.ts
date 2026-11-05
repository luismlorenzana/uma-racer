// SSR support cards (docs/game/06-cards-and-bonds.md): their golds, the effect kinds the card tooling names, and Race
// Bonus from the real values (D381). The tree's training formula (T153) reads the rest of `effects`.

import type { SkillTemplate, SupportCardTemplate } from './content'

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

/** The original's Race Bonus effect id. */
export const RACE_BONUS_EFFECT = 15

/**
 * What one card adds to what a race pays, as a fraction: its real Race Bonus at its top level (a percentage in the
 * source), plus its unique effect's Race Bonus where it has one (D381, 05 §3.1).
 */
export function cardRaceBonus(template: Pick<SupportCardTemplate, 'effects' | 'uniqueEffect'>): number {
  const own = template.effects[RACE_BONUS_EFFECT] ?? 0
  const unique = (template.uniqueEffect?.effects ?? []).filter((effect) => effect.type === RACE_BONUS_EFFECT).reduce((sum, effect) => sum + effect.value, 0)
  return (own + unique) / 100
}
