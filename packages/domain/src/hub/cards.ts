// The Card Library's words for a card's effects (docs/game/02-unlocks.md §3, D386): each of the original's effect ids
// (docs/research/drawing-board/05-card-mechanics.md §1) by its plain name, and how its value reads, "15%" or "+1".
// The values themselves come from the private content pack at runtime and never appear here. Pure.
import type { SupportCardTemplate } from '../content'

/** How an effect's value reads: a percentage ("15%"), or a flat amount ("+1"). */
export type EffectUnit = 'percent' | 'flat'

export interface EffectWord {
  readonly name: string
  readonly unit: EffectUnit
}

const percent = (name: string): EffectWord => Object.freeze({ name, unit: 'percent' })
const flat = (name: string): EffectWord => Object.freeze({ name, unit: 'flat' })

/** Every effect id a card's top-level effects or plain unique terms can carry, by its plain name. */
export const EFFECT_WORDS: Readonly<Record<number, EffectWord>> = Object.freeze({
  1: percent('Friendship Bonus'),
  2: percent('Mood Effect'),
  3: flat('Speed Bonus'),
  4: flat('Stamina Bonus'),
  5: flat('Power Bonus'),
  6: flat('Guts Bonus'),
  7: flat('Wit Bonus'),
  8: percent('Training Effectiveness'),
  9: flat('Initial Speed'),
  10: flat('Initial Stamina'),
  11: flat('Initial Power'),
  12: flat('Initial Guts'),
  13: flat('Initial Wit'),
  14: flat('Initial Friendship Gauge'),
  15: percent('Race Bonus'),
  16: percent('Fan Bonus'),
  17: flat('Hint Levels'),
  18: percent('Hint Frequency'),
  19: flat('Specialty Priority'),
  20: flat('Max Speed'),
  21: flat('Max Stamina'),
  22: flat('Max Power'),
  23: flat('Max Guts'),
  24: flat('Max Wit'),
  25: percent('Event Recovery'),
  26: percent('Event Effectiveness'),
  27: percent('Failure Protection'),
  28: percent('Energy Cost Reduction'),
  29: percent('Minigame Effectiveness'),
  30: flat('Skill Point Bonus'),
  31: flat('Wit Friendship Recovery'),
  32: flat('Initial Skill Points'),
  41: flat('All Stats Bonus'),
})

/** An effect's name; an id the table doesn't know reads as "Effect {id}". */
export const effectName = (id: number): string => EFFECT_WORDS[id]?.name ?? `Effect ${id}`

/** An effect's value as the card reads it: "15%" for a percentage, "+1" for a flat amount. */
export function effectValue(id: number, value: number): string {
  const unit = EFFECT_WORDS[id]?.unit ?? 'flat'
  const shown = Number.isInteger(value) ? String(value) : value.toFixed(1)
  return unit === 'percent' ? `${shown}%` : `${value < 0 ? '' : '+'}${shown}`
}

/** One effect on a card's page. */
export interface EffectLine {
  readonly id: number
  readonly name: string
  readonly value: string
}

/** A card's top-level effects at its maximum level, in id order, each named; an effect at 0 is left out. */
export function effectLines(effects: Readonly<Record<number, number>>): EffectLine[] {
  return Object.entries(effects)
    .map(([key, value]) => [Number(key), value] as const)
    .filter(([id, value]) => Number.isInteger(id) && value !== 0)
    .sort(([a], [b]) => a - b)
    .map(([id, value]) => ({ id, name: effectName(id), value: effectValue(id, value) }))
}

/** The unique effect's plain terms (an id under 100, always on), named; its conditional terms are its description's. */
export function uniqueEffectLines(card: Pick<SupportCardTemplate, 'uniqueEffect'>): EffectLine[] {
  const plain = (card.uniqueEffect?.effects ?? []).filter((term) => term.type > 0 && term.type < 100 && term.value !== 0)
  return plain.map((term) => ({ id: term.type, name: effectName(term.type), value: effectValue(term.type, term.value) }))
}
