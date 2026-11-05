// A play's config (docs/game/07-stages.md §1, D384): what the rules read, built alike on the device and the API from the
// career and the content, so a journal's replay needs only its seed and inputs. Her growth rates as whole percents,
// her deck in deck order with each card's real effects, each card's bond (its track, or its Initial Friendship Gauge),
// and the season's focus stat for Training Yard. Pure.
import { readDeck } from '../build/derive'
import { seasonFocus } from '../career/season'
import type { SupportCardTemplate, UmaTemplate } from '../content'
import type { BondRecord, CareerRecord } from '../save/records'
import { refuse, type Refusal } from '../save/registry'
import { STATS, type StatKey, type Stats } from '../types'
import type { StageCard, StageConfig, StageKind, StageUma } from './contract'
import { isStageSeed } from './rng'

/** What a config reads from the content. */
export interface StageContent {
  readonly umas: ReadonlyMap<string, UmaTemplate>
  readonly cards: ReadonlyMap<string, SupportCardTemplate>
}

/** Her, for a stage: her growth rates (0.1) as whole percents (10). */
export const stageUma = (uma: Pick<UmaTemplate, 'id' | 'growthRates'>): StageUma => ({
  id: uma.id,
  growth: Object.fromEntries(STATS.map((stat) => [stat, Math.round(uma.growthRates[stat] * 100)])) as unknown as Stats,
})

export const stageCard = (card: Pick<SupportCardTemplate, 'id' | 'type' | 'effects'>): StageCard => ({ id: card.id, type: card.type, effects: { ...card.effects } })

export interface StageParts {
  readonly kind: StageKind
  readonly seed: number
  readonly T: number
  readonly uma: Pick<UmaTemplate, 'id' | 'growthRates'>
  /** The deck in order, each card with its bond. */
  readonly deck: readonly { readonly card: SupportCardTemplate; readonly bond: number }[]
  readonly focus?: StatKey
  readonly course?: string
  readonly practice: boolean
}

export function buildStageConfig(parts: StageParts): StageConfig {
  if (!isStageSeed(parts.seed)) throw new RangeError('A stage seed is an unsigned 32-bit integer')
  return {
    kind: parts.kind,
    seed: parts.seed,
    T: parts.T,
    uma: stageUma(parts.uma),
    deck: parts.deck.map(({ card }) => stageCard(card)),
    bonds: Object.fromEntries(parts.deck.map(({ card, bond }) => [card.id, bond])),
    ...(parts.focus === undefined ? {} : { seasonFocus: parts.focus }),
    ...(parts.course === undefined ? {} : { course: parts.course }),
    practice: parts.practice,
  }
}

/**
 * A career's play of `kind` at its current season: her deck and bonds as they stand, and for Training Yard the season's
 * focus. Refuses when her Uma isn't in the content. Furlong Hand's course is T156's.
 */
export function careerStageConfig(
  career: CareerRecord,
  bonds: Readonly<Record<string, BondRecord>>,
  content: StageContent,
  kind: StageKind,
  seed: number,
  practice: boolean,
): StageConfig | Refusal {
  const uma = content.umas.get(career.umaId)
  if (uma === undefined) return refuse('unknown-uma', 'That Uma isn\'t in the game.')
  const posted = readDeck(career, { cards: content.cards, bonds }).posted
  return buildStageConfig({
    kind, seed, T: career.T, uma, practice,
    deck: posted.map(({ card, bond }) => ({ card, bond })),
    ...(kind === 'training-yard' ? { focus: seasonFocus(career.season) } : {}),
  })
}

/** A practice play outside any career: her alone, no deck, Speed as the focus. */
export const practiceStageConfig = (uma: Pick<UmaTemplate, 'id' | 'growthRates'>, kind: StageKind, seed: number): StageConfig =>
  buildStageConfig({ kind, seed, T: 1, uma, deck: [], practice: true, ...(kind === 'training-yard' ? { focus: STATS[0] } : {}) })
