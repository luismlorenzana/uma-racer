// Pure SSR support-card normalization (docs/design/support-cards.md).

import {
  eraOf,
  type CardEffect,
  type StatKey,
  type SupportCardObtain,
  type SupportCardTemplate,
  type SupportCardType,
  type SupportCardUniqueEffect,
} from '@racer/domain'
import { id, ids, isRecord, number as numberValue, records, text, type NormalizeResult, type RawRecord } from './shared'

const CARD_EFFECTS: readonly CardEffect[] = [
  'trainingBonus',
  'friendshipBonus',
  'statBonus',
  'skillPointBonus',
  'specialtyPriority',
  'hintFrequency',
  'raceBonus',
  'initialStats',
]

const STAT_BONUS_IDS: Record<StatKey, number> = { speed: 3, stamina: 4, power: 5, guts: 6, wit: 7 }
const INITIAL_STAT_IDS: Record<StatKey, number> = { speed: 9, stamina: 10, power: 11, guts: 12, wit: 13 }

interface PreparedCard {
  raw: RawRecord
  id: string
  charaId: string
  type: SupportCardType
  jpRelease: string
  obtain: SupportCardObtain
  effectValues: Partial<Record<CardEffect, number>>
}

function cardType(value: unknown): SupportCardType | null {
  if (value === 'intelligence') return 'wit'
  if (value === 'speed' || value === 'stamina' || value === 'power' || value === 'guts') return value
  if (value === 'friend' || value === 'group') return value
  return null
}

function obtain(value: unknown): SupportCardObtain {
  if (value === 'gacha') return 'gacha'
  if (value === 'story_event') return 'event'
  if (value === 'promo' || value === 'limited_quest' || value === 'shop') return 'free'
  return 'unknown'
}

function mappedEffect(effectId: number, type: SupportCardType): CardEffect | null {
  if (effectId === 1) return 'friendshipBonus'
  if (effectId === 8) return 'trainingBonus'
  if (effectId === 15) return 'raceBonus'
  if (effectId === 18) return 'hintFrequency'
  if (effectId === 19) return 'specialtyPriority'
  if (effectId === 30) return 'skillPointBonus'
  if (type !== 'friend' && type !== 'group') {
    if (effectId === STAT_BONUS_IDS[type]) return 'statBonus'
    if (effectId === INITIAL_STAT_IDS[type]) return 'initialStats'
  }
  return null
}

function effectValues(value: unknown, type: SupportCardType): Partial<Record<CardEffect, number>> {
  const result: Partial<Record<CardEffect, number>> = {}
  if (!Array.isArray(value)) return result
  for (const rawRow of value) {
    if (!Array.isArray(rawRow)) continue
    const effectId = numberValue(rawRow[0])
    if (effectId === null) continue
    const effect = mappedEffect(effectId, type)
    if (!effect) continue
    const values = rawRow.slice(1).map(numberValue).filter((entry): entry is number => entry !== null && entry !== -1)
    if (values.length === 0) continue
    const maximum = Math.max(...values)
    result[effect] = Math.max(result[effect] ?? Number.NEGATIVE_INFINITY, maximum)
  }
  return result
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  const upper = sorted[middle]!
  return sorted.length % 2 === 1 ? upper : (sorted[middle - 1]! + upper) / 2
}

function profile(
  values: Partial<Record<CardEffect, number>>,
  medians: Partial<Record<CardEffect, number>>,
): Record<CardEffect, number> {
  return Object.fromEntries(
    CARD_EFFECTS.map((effect) => {
      const value = values[effect]
      const effectMedian = medians[effect]
      if (value === undefined || effectMedian === undefined || effectMedian === 0) return [effect, 0]
      const weight = Math.min(1.5, Math.max(0.5, value / effectMedian))
      return [effect, Math.round(weight * 100) / 100]
    }),
  ) as Record<CardEffect, number>
}

function uniqueEffect(value: unknown): SupportCardUniqueEffect | null {
  if (!isRecord(value)) return null
  const level = numberValue(value.level)
  if (level === null || !Array.isArray(value.effects)) return null
  const effects = value.effects
    .filter(isRecord)
    .map((entry) => ({ type: numberValue(entry.type), value: numberValue(entry.value) }))
    .filter((entry): entry is { type: number; value: number } => entry.type !== null && entry.value !== null)
  return { level, effects }
}

export function normalizeCards(value: unknown): NormalizeResult<SupportCardTemplate> {
  const warnings: string[] = []
  const prepared: PreparedCard[] = []

  for (const raw of records(value)) {
    if (numberValue(raw.rarity) !== 3) continue
    const supportId = id(raw.support_id)
    const charaId = id(raw.char_id)
    const type = cardType(raw.type)
    const jpRelease = text(raw.release)
    if (!supportId || !charaId || !type || !jpRelease) {
      warnings.push(`SSR card ${supportId ?? '<missing id>'} has invalid required fields and was skipped`)
      continue
    }
    const mappedObtain = obtain(raw.obtained ?? raw.obtain)
    if (mappedObtain === 'unknown') {
      warnings.push(`SSR card ${supportId} has unknown obtain method ${String(raw.obtained ?? raw.obtain ?? '<missing>')}`)
    }
    prepared.push({
      raw,
      id: supportId,
      charaId,
      type,
      jpRelease,
      obtain: mappedObtain,
      effectValues: effectValues(raw.effects, type),
    })
  }

  const medians: Partial<Record<CardEffect, number>> = {}
  for (const effect of CARD_EFFECTS) {
    const values = prepared
      .map((card) => card.effectValues[effect])
      .filter((entry): entry is number => entry !== undefined)
    if (values.length > 0) medians[effect] = median(values)
  }

  const items = prepared.map<SupportCardTemplate>((card) => {
    const hints = isRecord(card.raw.hints) ? card.raw.hints : {}
    return {
      id: card.id,
      charaId: card.charaId,
      charName: text(card.raw.char_name) ?? '',
      title: text(card.raw.title_en) ?? '',
      type: card.type,
      jpRelease: card.jpRelease,
      era: eraOf(card.jpRelease),
      obtain: card.obtain,
      starter: card.obtain === 'event' || card.obtain === 'free',
      hintSkillIds: ids(hints.hint_skills),
      eventSkillIds: ids(card.raw.event_skills_en ?? card.raw.event_skills),
      effectProfile: profile(card.effectValues, medians),
      uniqueEffect: uniqueEffect(card.raw.unique),
      imageSource: `https://gametora.com/images/umamusume/supports/support_card_s_${card.id}.png`,
    }
  })

  return { items, warnings }
}
