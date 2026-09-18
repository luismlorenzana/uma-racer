// Deterministic saved-Uma Training turns (docs/tasks/T004-saved-uma-training-loop.md).

import {
  CARD_EFFECTS,
  CARD_TRAINING_EXP,
  cardExpToNext,
  cardLevelCap,
  deckSlotCount,
  projectedCardEffectValue,
} from './cards'
import type { CardSave, UmaSave } from './save'
import { SAVE_ID_PATTERN } from './save'
import {
  supportDeckIssueMessage,
  validateEquippedSupportDeck,
  type SupportDeckCard,
} from './support-deck'
import { tierOfLevel } from './scenarios'
import {
  addTrainingExp,
  applyCappedGain,
  isFriendshipTraining,
  spCap,
  statCap,
  trainingExpForTurn,
  trainingGains,
  type Facility,
  type PresentCard,
} from './training'
import type { SkillTemplate, SupportCardTemplate, UmaTemplate } from './content'
import { STATS, type GainKey, type StatKey, type Stats } from './types'

export const TRAINING_PLACEMENTS = [...STATS, 'out'] as const
export type TrainingPlacement = (typeof TRAINING_PLACEMENTS)[number]
export const BASE_SPECIALTY_CHANCE = 0.35
export const RANDOM_FACILITY_CHANCE = 0.7
export const BASE_HINT_CHANCE = 0.2
export const KNOWN_HINT_SP = 10

export type TrainingCardInput = SupportDeckCard

export interface TrainingCardEffects {
  present: PresentCard
  specialtyChance: number
  hintFrequency: number
}

export interface TrainingCardPlacement {
  cardId: string
  placement: TrainingPlacement
}

export interface TrainingDeal {
  seed: number
  placements: TrainingCardPlacement[]
}

export interface TrainingFacilityPreview {
  facility: Facility
  rawGains: Partial<Record<GainKey, number>>
  appliedGains: Partial<Record<GainKey, number>>
  presentCardIds: string[]
  friendshipCardIds: string[]
  friendship: boolean
}

export interface CardTrainingResult {
  card: CardSave
  expGained: number
  levelsGained: number[]
  placement: TrainingPlacement
}

export interface TrainingHintResult {
  cardId: string
  learnedSkillId: string | null
  fallbackSp: number
}

export interface TrainingTurnResult {
  uma: UmaSave
  cards: CardTrainingResult[]
  preview: TrainingFacilityPreview
  trainingExpGained: number
  trainingLevelsGained: number
  hintResults: TrainingHintResult[]
  hintSpGained: number
  ticketReward: number
  cardCouponReward: number
  newlyMaxedCardIds: string[]
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const hasExactKeys = (value: Record<string, unknown>, keys: readonly string[]): boolean => {
  const expected = [...keys].sort()
  const actual = Object.keys(value).sort()
  return actual.length === expected.length && actual.every((key, index) => key === expected[index])
}

const isFiniteNonNegative = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0

const isStatCard = (template: SupportCardTemplate): template is SupportCardTemplate & { type: StatKey } =>
  STATS.includes(template.type as StatKey)

/** Validate every private-content field consumed by the T004 Training runtime. */
export function assertTrainingContent(
  umas: readonly UmaTemplate[],
  cards: readonly SupportCardTemplate[],
  skills: readonly SkillTemplate[],
): void {
  const skillIds = new Set<string>()
  for (const skill of skills) {
    if (
      !SAVE_ID_PATTERN.test(skill.id) ||
      skillIds.has(skill.id) ||
      typeof skill.name !== 'string' ||
      skill.name.length === 0 ||
      !['white', 'gold', 'unique-upgraded', 'inherited-unique', 'unique'].includes(skill.kind)
    ) {
      throw new Error(`Skill ${String(skill.id)} has invalid Training data`)
    }
    skillIds.add(skill.id)
  }

  for (const uma of umas) {
    if (!isRecord(uma.growthRates) || !hasExactKeys(uma.growthRates, STATS) || STATS.some((key) => !isFiniteNonNegative(uma.growthRates[key]))) {
      throw new Error(`Uma ${uma.id} has invalid Training growth rates`)
    }
    if (uma.uniqueSkillId !== null && !skillIds.has(uma.uniqueSkillId)) {
      throw new Error(`Uma ${uma.id} references a missing unique skill`)
    }
  }

  for (const card of cards) {
    if (!Number.isSafeInteger(card.era) || card.era < 1 || ![...STATS, 'friend', 'group'].includes(card.type)) {
      throw new Error(`Card ${card.id} has invalid Training era or type`)
    }
    if (!isRecord(card.effectProfile) || !hasExactKeys(card.effectProfile, CARD_EFFECTS)) {
      throw new Error(`Card ${card.id} has an invalid Training effect profile`)
    }
    if (CARD_EFFECTS.some((effect) => !isFiniteNonNegative(card.effectProfile[effect]))) {
      throw new Error(`Card ${card.id} has a non-finite Training effect weight`)
    }
    if (new Set(card.hintSkillIds).size !== card.hintSkillIds.length || card.hintSkillIds.some((id) => !skillIds.has(id))) {
      throw new Error(`Card ${card.id} references an invalid Training hint skill`)
    }
  }
}

export function trainingCardEffects(card: TrainingCardInput): TrainingCardEffects {
  if (!isStatCard(card.template)) throw new Error(`Card ${card.template.id} cannot be used in MVP Training`)
  const state = { limitBreak: card.save.limitBreak, level: card.save.level }
  const effect = (key: (typeof CARD_EFFECTS)[number]) => projectedCardEffectValue(key, card.template, state)
  const specialtyAddition = effect('specialtyPriority')
  return {
    present: {
      type: card.template.type,
      trainingBonus: effect('trainingBonus'),
      friendshipBonus: effect('friendshipBonus'),
      flatBonus: {
        [card.template.type]: effect('statBonus'),
        sp: effect('skillPointBonus'),
      },
    },
    specialtyChance: Math.min(1, BASE_SPECIALTY_CHANCE + specialtyAddition / 100),
    hintFrequency: effect('hintFrequency'),
  }
}

export function trainingDeckError(tier: number, cards: readonly TrainingCardInput[]): string | null {
  const issue = validateEquippedSupportDeck(tier, cards).issues[0]
  return issue ? supportDeckIssueMessage(issue) : null
}

export function autoTrainingDeck(
  uma: UmaTemplate,
  tier: number,
  owned: readonly TrainingCardInput[],
): string[] {
  const typeOrder = [...STATS].sort(
    (left, right) => uma.growthRates[right] - uma.growthRates[left] || STATS.indexOf(left) - STATS.indexOf(right),
  )
  const byType = new Map<StatKey, TrainingCardInput[]>(
    STATS.map((type) => [
      type,
      owned
        .filter((card) => card.save.templateId === card.template.id && card.template.type === type && card.template.era <= tier)
        .sort((left, right) => left.template.id.localeCompare(right.template.id)),
    ]),
  )
  const selected: string[] = []
  const characters = new Set<string>()
  const maxRound = Math.max(0, ...[...byType.values()].map((cards) => cards.length))
  for (let round = 0; round < maxRound && selected.length < deckSlotCount(tier); round += 1) {
    for (const type of typeOrder) {
      const card = byType.get(type)?.[round]
      if (!card || characters.has(card.template.charaId)) continue
      selected.push(card.template.id)
      characters.add(card.template.charaId)
      if (selected.length === deckSlotCount(tier)) break
    }
  }
  return selected
}

/** Stable 32-bit FNV-1a seed; the zero state is remapped for xorshift. */
export function trainingTurnSeed(createdAt: number, umaId: string, tier: number, turn: number): number {
  const text = `${createdAt}:${umaId}:${tier}:${turn}`
  let hash = 0x811c9dc5
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }
  const seed = hash >>> 0
  return seed === 0 ? 0x6d2b79f5 : seed
}

class TrainingRandom {
  private state: number

  constructor(seed: number) {
    this.state = (seed >>> 0) || 0x6d2b79f5
  }

  next(): number {
    let value = this.state
    value ^= value << 13
    value ^= value >>> 17
    value ^= value << 5
    this.state = value >>> 0
    return this.state / 0x1_0000_0000
  }
}

export function dealTrainingCards(cards: readonly TrainingCardInput[], seed: number): TrainingDeal {
  const rng = new TrainingRandom(seed)
  return {
    seed,
    placements: cards.map((card) => {
      const effects = trainingCardEffects(card)
      if (rng.next() < effects.specialtyChance) return { cardId: card.template.id, placement: card.template.type as Facility }
      if (rng.next() >= RANDOM_FACILITY_CHANCE) return { cardId: card.template.id, placement: 'out' }
      return { cardId: card.template.id, placement: STATS[Math.floor(rng.next() * STATS.length)]! }
    }),
  }
}

function cardsAtFacility(
  cards: readonly TrainingCardInput[],
  deal: TrainingDeal,
  facility: Facility,
): TrainingCardInput[] {
  const byId = new Map(cards.map((card) => [card.template.id, card]))
  if (
    deal.placements.length !== cards.length ||
    new Set(deal.placements.map((entry) => entry.cardId)).size !== cards.length ||
    deal.placements.some((entry) => !byId.has(entry.cardId))
  ) {
    throw new Error('Training deal does not match the equipped deck')
  }
  return deal.placements
    .filter((entry) => entry.placement === facility)
    .map((entry) => byId.get(entry.cardId)!)
}

export function previewTrainingFacilities(
  uma: UmaSave,
  template: UmaTemplate,
  cards: readonly TrainingCardInput[],
  deal: TrainingDeal,
): Record<Facility, TrainingFacilityPreview> {
  const tier = tierOfLevel(uma.level)
  const error = trainingDeckError(tier, cards)
  if (error) throw new Error(error)
  return Object.fromEntries(
    STATS.map((facility) => {
      const present = cardsAtFacility(cards, deal, facility)
      const effects = present.map((card) => trainingCardEffects(card).present)
      const rawGains = trainingGains(facility, template.growthRates, effects)
      const appliedGains: Partial<Record<GainKey, number>> = {}
      for (const [key, gain] of Object.entries(rawGains) as [GainKey, number][]) {
        const current = key === 'sp' ? uma.skillPoints : uma.stats[key]
        const cap = key === 'sp' ? spCap(tier, uma.trainingLevel) : statCap(tier, uma.trainingLevel)
        appliedGains[key] = applyCappedGain(current, gain, cap, key !== 'sp') - current
      }
      const friendshipCardIds = present
        .filter((card) => card.template.type === facility)
        .map((card) => card.template.id)
      return [facility, {
        facility,
        rawGains,
        appliedGains,
        presentCardIds: present.map((card) => card.template.id),
        friendshipCardIds,
        friendship: isFriendshipTraining(facility, effects),
      }]
    }),
  ) as Record<Facility, TrainingFacilityPreview>
}

export function addCardTrainingExp(save: CardSave, gained: number): Omit<CardTrainingResult, 'placement'> {
  const cap = cardLevelCap(save.limitBreak)
  if (!Number.isSafeInteger(gained) || gained < 0) throw new Error('Card Training EXP must be a nonnegative integer')
  let level = save.level
  let exp = save.exp
  let remaining = gained
  const levelsGained: number[] = []
  while (level < cap && remaining > 0) {
    const needed = cardExpToNext(level) - exp
    if (remaining < needed) {
      exp += remaining
      remaining = 0
    } else {
      remaining -= needed
      level += 1
      exp = 0
      levelsGained.push(level)
    }
  }
  if (level === cap && remaining > 0) exp = Math.min(cardExpToNext(level), exp + remaining)
  return { card: { ...save, level, exp }, expGained: gained, levelsGained }
}

export function resolveTrainingTurn(input: {
  uma: UmaSave
  template: UmaTemplate
  cards: readonly TrainingCardInput[]
  skills: ReadonlyMap<string, SkillTemplate>
  deal: TrainingDeal
  facility: Facility
}): TrainingTurnResult {
  const { uma, template, cards, skills, deal, facility } = input
  if (!uma.scenarioStarted) throw new Error('Finish scenario setup before Training')
  const previews = previewTrainingFacilities(uma, template, cards, deal)
  const preview = previews[facility]
  const stats: Stats = { ...uma.stats }
  let skillPoints = uma.skillPoints
  for (const [key, gain] of Object.entries(preview.appliedGains) as [GainKey, number][]) {
    if (key === 'sp') skillPoints += gain
    else stats[key] += gain
  }

  const library = [...uma.skillLibrary]
  const known = new Set(library.map((skill) => skill.skillId))
  const hintResults: TrainingHintResult[] = []
  let hintSpGained = 0
  const hintRng = new TrainingRandom(deal.seed ^ 0x9e3779b9)
  const presentIds = new Set(preview.presentCardIds)
  const tier = tierOfLevel(uma.level)
  const currentSpCap = spCap(tier, uma.trainingLevel)
  for (const card of cards) {
    if (!presentIds.has(card.template.id)) continue
    const eligible = card.template.hintSkillIds
      .map((id) => skills.get(id))
      .filter((skill): skill is SkillTemplate =>
        skill !== undefined && (skill.kind === 'white' || (skill.kind === 'gold' && card.save.limitBreak >= 3)),
      )
      .sort((left, right) => left.id.localeCompare(right.id))
    if (eligible.length === 0) continue
    const effects = trainingCardEffects(card)
    const friendship = card.template.type === facility
    const chance = Math.min(1, BASE_HINT_CHANCE * (1 + effects.hintFrequency) * (friendship ? 2 : 1))
    if (hintRng.next() >= chance) continue
    const unknown = eligible.filter((skill) => !known.has(skill.id))
    if (unknown.length > 0) {
      const skill = unknown[Math.floor(hintRng.next() * unknown.length)]!
      library.push({ skillId: skill.id, origin: 'card', sourceId: card.template.id })
      known.add(skill.id)
      hintResults.push({ cardId: card.template.id, learnedSkillId: skill.id, fallbackSp: 0 })
    } else {
      const gained = Math.min(KNOWN_HINT_SP, Math.max(0, currentSpCap - skillPoints))
      skillPoints += gained
      hintSpGained += gained
      hintResults.push({ cardId: card.template.id, learnedSkillId: null, fallbackSp: gained })
    }
  }

  const placementByCard = new Map(deal.placements.map((entry) => [entry.cardId, entry.placement]))
  const newlyMaxedCardIds: string[] = []
  const cardResults = cards.map((card): CardTrainingResult => {
    const placement = placementByCard.get(card.template.id)
    if (!placement) throw new Error(`Training deal is missing card ${card.template.id}`)
    const gained = placement === facility
      ? card.template.type === facility
        ? CARD_TRAINING_EXP.friendship
        : CARD_TRAINING_EXP.present
      : CARD_TRAINING_EXP.equipped
    const result = addCardTrainingExp(card.save, gained)
    if (result.levelsGained.includes(25) && !card.save.maxCouponGranted) {
      newlyMaxedCardIds.push(card.template.id)
      result.card = { ...result.card, maxCouponGranted: true }
    }
    return { ...result, placement }
  })
  const ticketReward = cardResults.reduce((sum, result) => sum + result.levelsGained.length * 2, 0)
  const trainingExpGained = trainingExpForTurn(preview.friendship)
  const training = addTrainingExp(uma.trainingLevel, uma.trainingExp, trainingExpGained)
  return {
    uma: {
      ...uma,
      stats,
      skillPoints,
      trainingLevel: training.trainingLevel,
      trainingExp: training.exp,
      skillLibrary: library,
      trainingsThisScenario: uma.trainingsThisScenario + 1,
    },
    cards: cardResults,
    preview,
    trainingExpGained,
    trainingLevelsGained: training.trainingLevel - uma.trainingLevel,
    hintResults,
    hintSpGained,
    ticketReward,
    cardCouponReward: newlyMaxedCardIds.length,
    newlyMaxedCardIds,
  }
}
