// Coupon and collection rules (docs/design/collection.md).

import { bestCardLimitBreak } from './card-progression'
import type { SupportCardTemplate, UmaTemplate } from './content'
import { CARD_MAX_LEVEL, MAX_LIMIT_BREAK } from './cards'
import { UMA_SHARDS_PER_COUPON } from './economy'
import {
  SAVE_ID_PATTERN,
  createCardSave,
  createUmaSave,
  isLocalDay,
  parsePlayerProfileOrThrow,
  type CardSave,
  type LedgerEntry,
  type PlayerProfile,
  type UmaSave,
} from './save'

export interface LedgerDescriptor {
  id: string
  data: LedgerEntry
}

export interface ShardExchangeResult {
  profile: PlayerProfile
  ledger: [LedgerDescriptor, LedgerDescriptor]
  sequence: number
}

export interface CardCouponRedemptionResult {
  profile: PlayerProfile
  card: CardSave
  ledger: [LedgerDescriptor]
}

export interface UmaCouponRedemptionResult {
  profile: PlayerProfile
  uma: UmaSave
  ledger: [LedgerDescriptor]
}

function assertMutationInput(profile: PlayerProfile, today: string, now: number): void {
  parsePlayerProfileOrThrow(profile)
  if (!isLocalDay(today)) throw new Error(`Invalid local day: ${today}`)
  if (!Number.isSafeInteger(now) || now < 0) throw new Error('Invalid collection timestamp')
}

function assertGeneratedId(id: string): void {
  if (!SAVE_ID_PATTERN.test(id)) throw new Error('Collection ledger id is unsafe')
}

export function nextUmaShardExchangeSequence(ids: readonly string[]): number {
  let maximum = 0
  for (const id of ids) {
    const match = /^uma-shard-exchange:(\d+):(shards|coupon)$/.exec(id)
    if (!match) continue
    const sequence = Number(match[1])
    if (!Number.isSafeInteger(sequence) || sequence < 1) throw new Error('Invalid Uma shard exchange sequence')
    maximum = Math.max(maximum, sequence)
  }
  if (maximum >= Number.MAX_SAFE_INTEGER) throw new Error('Uma shard exchange sequence is exhausted')
  return maximum + 1
}

export function exchangeUmaShards(
  profile: PlayerProfile,
  sequence: number,
  today: string,
  now: number,
): ShardExchangeResult {
  assertMutationInput(profile, today, now)
  if (!Number.isSafeInteger(sequence) || sequence < 1) throw new Error('Invalid Uma shard exchange sequence')
  if (profile.umaShards < UMA_SHARDS_PER_COUPON) {
    throw new Error(`Need ${UMA_SHARDS_PER_COUPON} Uma Shards to exchange`)
  }
  const prefix = `uma-shard-exchange:${sequence}`
  const shardId = `${prefix}:shards`
  const couponId = `${prefix}:coupon`
  assertGeneratedId(shardId)
  assertGeneratedId(couponId)
  return {
    profile: {
      ...profile,
      umaShards: profile.umaShards - UMA_SHARDS_PER_COUPON,
      umaCoupons: profile.umaCoupons + 1,
    },
    sequence,
    ledger: [
      {
        id: shardId,
        data: { resource: 'uma-shards', delta: -UMA_SHARDS_PER_COUPON, reason: 'uma-shard-exchange', localDay: today, createdAt: now },
      },
      {
        id: couponId,
        data: { resource: 'uma-coupons', delta: 1, reason: 'uma-shard-exchange', localDay: today, createdAt: now },
      },
    ],
  }
}

export function redeemCardSelectCoupon(
  profile: PlayerProfile,
  template: SupportCardTemplate,
  alreadyOwned: boolean,
  today: string,
  now: number,
): CardCouponRedemptionResult {
  assertMutationInput(profile, today, now)
  if (!SAVE_ID_PATTERN.test(template.id)) throw new Error('Card target id is unsafe')
  if (alreadyOwned) throw new Error('Support card is already owned')
  if (profile.cardCoupons < 1) throw new Error('No Card Select Coupons available')
  const id = `card-coupon-redeem:${template.id}`
  assertGeneratedId(id)
  return {
    profile: { ...profile, cardCoupons: profile.cardCoupons - 1 },
    card: createCardSave(template),
    ledger: [{
      id,
      data: { resource: 'card-coupons', delta: -1, reason: 'card-coupon-redeem', localDay: today, createdAt: now },
    }],
  }
}

export function redeemUmaSelectCoupon(
  profile: PlayerProfile,
  template: UmaTemplate,
  alreadyOwned: boolean,
  today: string,
  now: number,
): UmaCouponRedemptionResult {
  assertMutationInput(profile, today, now)
  if (!SAVE_ID_PATTERN.test(template.id)) throw new Error('Uma target id is unsafe')
  if (alreadyOwned) throw new Error('Uma outfit is already owned')
  if (profile.umaCoupons < 1) throw new Error('No Uma Select Coupons available')
  const id = `uma-coupon-redeem:${template.id}`
  assertGeneratedId(id)
  return {
    profile: { ...profile, umaCoupons: profile.umaCoupons - 1 },
    uma: createUmaSave(template),
    ledger: [{
      id,
      data: { resource: 'uma-coupons', delta: -1, reason: 'uma-coupon-redeem', localDay: today, createdAt: now },
    }],
  }
}

export interface CollectionGroupCount<T> {
  key: T
  owned: number
  total: number
}

export function cardCollectionCounts(
  templates: readonly SupportCardTemplate[],
  cardsById: Readonly<Record<string, CardSave>>,
): {
  owned: number
  total: number
  maxed: number
  eras: CollectionGroupCount<number>[]
  types: CollectionGroupCount<SupportCardTemplate['type']>[]
  orphanedIds: string[]
} {
  const ownedIds = new Set(Object.keys(cardsById))
  const knownIds = new Set(templates.map((template) => template.id))
  const count = <T>(keys: readonly T[]): CollectionGroupCount<T>[] => [...new Set(keys)].map((key) => {
    const members = templates.filter((template) => (typeof key === 'number' ? template.era : template.type) === key)
    return { key, owned: members.filter((template) => ownedIds.has(template.id)).length, total: members.length }
  })
  return {
    owned: templates.filter((template) => ownedIds.has(template.id)).length,
    total: templates.length,
    maxed: templates.filter((template) => {
      const card = cardsById[template.id]
      // "Maxed" is account-wide: broken to LB4 in any one scenario.
      return card !== undefined && bestCardLimitBreak(card) === MAX_LIMIT_BREAK
    }).length,
    eras: count(templates.map((template) => template.era)).sort((left, right) => left.key - right.key),
    types: count(templates.map((template) => template.type)),
    orphanedIds: [...ownedIds].filter((id) => !knownIds.has(id)).sort(),
  }
}

export function umaCollectionCounts(
  templates: readonly UmaTemplate[],
  umasById: Readonly<Record<string, UmaSave>>,
): { owned: number; total: number; orphanedIds: string[] } {
  const ownedIds = new Set(Object.keys(umasById))
  const knownIds = new Set(templates.map((template) => template.id))
  return {
    owned: templates.filter((template) => ownedIds.has(template.id)).length,
    total: templates.length,
    orphanedIds: [...ownedIds].filter((id) => !knownIds.has(id)).sort(),
  }
}
