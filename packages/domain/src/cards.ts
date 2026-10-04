// SSR support cards: stars, and the generated effect profile that still feeds Race Bonus
// (docs/design/support-cards.md). The rest of the effect model died with the training turn (D125).

import { CARD_SET_SIZE, starNodePct } from './constellation'
import type { SkillTemplate, SupportCardTemplate } from './content'

/**
 * A card holds 0★–3★ in each scenario; 3★ is max, with every bonus at full strength (D200). The three stars are the old
 * 1★ · 3★ · 5★ (D147), so a maxed card pays what a 5★ card paid.
 */
export const MAX_STARS = 3

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

/** Six slots at every tier; the 4/5/6 ramp was ours to begin with and the original always has six (D125). */
export const deckSlotCount = (_tier: number): number => CARD_SET_SIZE

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

/**
 * Race Bonus at max stars for an era-1 card whose profile weight is 1. It is the value the old model reached at max limit
 * break and level 25 (0.03 × 1.5 × 1.08), so a maxed card races exactly as it did before stars (D147).
 */
const RACE_BONUS_AT_MAX = 0.03 * 1.5 * 1.08

/**
 * What one card adds to race EXP at its global stars, the one generated effect that outlived the training turn
 * (D125). Nothing at 0★; from 1★ it follows the same star curve as a card node (68% · 84% · 100%, D200), so no migration
 * ever lowered a card's Race Bonus. At 3★ the card's unique effect adds its bonus if
 * Race Bonus is one of its kinds.
 */
export function cardRaceBonus(template: SupportCardTemplate, stars: number): number {
  const held = Math.min(MAX_STARS, Math.max(0, Math.trunc(stars)))
  if (held === 0) return 0
  const full = RACE_BONUS_AT_MAX * eraMult(template.era) * (template.effectProfile.raceBonus ?? 0)
  const signature = held === MAX_STARS && cardUniqueEffectKinds(template).has('raceBonus') ? CARD_UNIQUE_BONUS_MULTIPLIER : 0
  return full * (starNodePct(held) / 100) * (1 + signature)
}
