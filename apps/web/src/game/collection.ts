// Atomic local-first collection mutations (docs/tasks/T011-select-coupons-and-collection.md).

import {
  SAVE_ID_PATTERN,
  badgeStateId,
  buildUmaFlairCatalog,
  createUmaBadgeState,
  evaluateUmaFlair,
  exchangeUmaShards,
  nextUmaShardExchangeSequence,
  parseBadgeState,
  parseCardSave,
  parseLedgerEntry,
  parsePlayerProfileOrThrow,
  parseUmaSave,
  redeemCardSelectCoupon,
  redeemUmaSelectCoupon,
  type CardSave,
  type FlairEventRecord,
  type LedgerEntry,
  type PlayerProfile,
  type UmaSave,
  type UmaBadgeStateV1,
} from '@racer/domain'
import type { LoadedContent } from '../content/runtime'
import { db, type LogRow } from './db'
import { appendFlairEvents } from './badges'
import { queueInTransaction } from './persistence'

export interface ShardExchangeMutation {
  profile: PlayerProfile
  sequence: number
  ledgerIds: [string, string]
}

export interface CardRedemptionMutation {
  profile: PlayerProfile
  card: CardSave
  ledgerId: string
  alreadyRedeemed: boolean
}

export interface UmaRedemptionMutation {
  profile: PlayerProfile
  uma: UmaSave
  ledgerId: string
  alreadyRedeemed: boolean
  badgeState: UmaBadgeStateV1
  flairEvents: FlairEventRecord[]
}

function initializedBadgeState(content: LoadedContent, uma: UmaSave, now: number, sourceId: string) {
  const state = createUmaBadgeState(uma, now)
  return evaluateUmaFlair(
    buildUmaFlairCatalog({ state, races: content.races.items }),
    state,
    { source: { kind: 'collection', id: sourceId, tier: null }, earnedAt: now, retroactive: false },
  )
}

function assertSafeTarget(id: string, kind: string): void {
  if (!SAVE_ID_PATTERN.test(id)) throw new Error(`${kind} target id is unsafe`)
}

function assertMatchingLedger(
  row: LogRow<LedgerEntry>,
  expected: Pick<LedgerEntry, 'resource' | 'delta' | 'reason'>,
): void {
  const data = parseLedgerEntry(row.data)
  if (
    !data || row.createdAt !== data.createdAt || data.resource !== expected.resource ||
    data.delta !== expected.delta || data.reason !== expected.reason
  ) throw new Error(`Collection redemption record is corrupt: ${row.id}`)
}

export function exchangeMemoryUmaShards(
  profile: PlayerProfile,
  sequence: number,
  today: string,
  now: number,
): ShardExchangeMutation {
  const mutation = exchangeUmaShards(profile, sequence, today, now)
  return { profile: mutation.profile, sequence, ledgerIds: [mutation.ledger[0].id, mutation.ledger[1].id] }
}

export function redeemMemoryCard(
  content: LoadedContent,
  profile: PlayerProfile,
  cardsById: Readonly<Record<string, CardSave>>,
  cardId: string,
  today: string,
  now: number,
): CardRedemptionMutation {
  assertSafeTarget(cardId, 'Card')
  const template = content.cards.byId.get(cardId)
  if (!template) throw new Error('Card content is missing')
  const mutation = redeemCardSelectCoupon(profile, template, cardsById[cardId] !== undefined, today, now)
  return { profile: mutation.profile, card: mutation.card, ledgerId: mutation.ledger[0].id, alreadyRedeemed: false }
}

export function redeemMemoryUma(
  content: LoadedContent,
  profile: PlayerProfile,
  umasById: Readonly<Record<string, UmaSave>>,
  umaId: string,
  today: string,
  now: number,
): UmaRedemptionMutation {
  assertSafeTarget(umaId, 'Uma')
  const template = content.umas.byId.get(umaId)
  if (!template) throw new Error('Uma content is missing')
  const mutation = redeemUmaSelectCoupon(profile, template, umasById[umaId] !== undefined, today, now)
  const badge = initializedBadgeState(content, mutation.uma, now, mutation.ledger[0].id)
  return {
    profile: mutation.profile,
    uma: mutation.uma,
    ledgerId: mutation.ledger[0].id,
    alreadyRedeemed: false,
    badgeState: badge.state,
    flairEvents: badge.events,
  }
}

export async function exchangePersistentUmaShards(today: string, now: number): Promise<ShardExchangeMutation> {
  return db.transaction('rw', db.profile, db.ledger, db.outbox, async () => {
    const profileRow = await db.profile.get('main')
    if (!profileRow) throw new Error('Local profile is missing')
    const profile = parsePlayerProfileOrThrow(profileRow.data)
    const keys = (await db.ledger.toCollection().primaryKeys()).filter((key): key is string => typeof key === 'string')
    const sequence = nextUmaShardExchangeSequence(keys)
    const mutation = exchangeUmaShards(profile, sequence, today, now)
    if ((await db.ledger.bulkGet(mutation.ledger.map((entry) => entry.id))).some(Boolean)) {
      throw new Error('Uma shard exchange sequence already exists')
    }
    await db.profile.put({ ...profileRow, data: mutation.profile })
    await queueInTransaction('profile', 'main', 'upsert', now)
    for (const entry of mutation.ledger) {
      await db.ledger.add({ id: entry.id, data: entry.data, createdAt: entry.data.createdAt })
      await queueInTransaction('ledger', entry.id, 'append', now)
    }
    return { profile: mutation.profile, sequence, ledgerIds: [mutation.ledger[0].id, mutation.ledger[1].id] }
  })
}

export async function redeemPersistentCard(
  content: LoadedContent,
  cardId: string,
  today: string,
  now: number,
): Promise<CardRedemptionMutation> {
  assertSafeTarget(cardId, 'Card')
  const template = content.cards.byId.get(cardId)
  if (!template) throw new Error('Card content is missing')
  const ledgerId = `card-coupon-redeem:${cardId}`
  return db.transaction('rw', db.profile, db.cards, db.ledger, db.outbox, async () => {
    const [profileRow, cardRow, ledgerRow] = await Promise.all([
      db.profile.get('main'), db.cards.get(cardId), db.ledger.get(ledgerId),
    ])
    if (!profileRow) throw new Error('Local profile is missing')
    const profile = parsePlayerProfileOrThrow(profileRow.data)
    if (cardRow && ledgerRow) {
      const card = parseCardSave(cardRow.data)
      if (!card || card.templateId !== cardId) throw new Error(`Invalid local card save: ${cardId}`)
      assertMatchingLedger(ledgerRow, { resource: 'card-coupons', delta: -1, reason: 'card-coupon-redeem' })
      return { profile, card, ledgerId, alreadyRedeemed: true }
    }
    if (ledgerRow) throw new Error('Card redemption record exists without its card')
    if (cardRow) throw new Error('Support card is already owned')
    const mutation = redeemCardSelectCoupon(profile, template, false, today, now)
    const entry = mutation.ledger[0]
    await db.profile.put({ ...profileRow, data: mutation.profile })
    await db.cards.add({ id: cardId, data: mutation.card, version: 0 })
    await db.ledger.add({ id: entry.id, data: entry.data, createdAt: entry.data.createdAt })
    await queueInTransaction('profile', 'main', 'upsert', now)
    await queueInTransaction('cards', cardId, 'upsert', now)
    await queueInTransaction('ledger', entry.id, 'append', now)
    return { profile: mutation.profile, card: mutation.card, ledgerId, alreadyRedeemed: false }
  })
}

export async function redeemPersistentUma(
  content: LoadedContent,
  umaId: string,
  today: string,
  now: number,
): Promise<UmaRedemptionMutation> {
  assertSafeTarget(umaId, 'Uma')
  const template = content.umas.byId.get(umaId)
  if (!template) throw new Error('Uma content is missing')
  const ledgerId = `uma-coupon-redeem:${umaId}`
  return db.transaction('rw', [db.profile, db.umas, db.badges, db.ledger, db.flairEvents, db.outbox], async () => {
    const [profileRow, umaRow, ledgerRow] = await Promise.all([
      db.profile.get('main'), db.umas.get(umaId), db.ledger.get(ledgerId),
    ])
    if (!profileRow) throw new Error('Local profile is missing')
    const profile = parsePlayerProfileOrThrow(profileRow.data)
    if (umaRow && ledgerRow) {
      const uma = parseUmaSave(umaRow.data)
      if (!uma || uma.templateId !== umaId) throw new Error(`Invalid local Uma save: ${umaId}`)
      assertMatchingLedger(ledgerRow, { resource: 'uma-coupons', delta: -1, reason: 'uma-coupon-redeem' })
      const badgeRow = await db.badges.get(badgeStateId(umaId))
      const badgeState = badgeRow ? parseBadgeState(badgeRow.data) : null
      if (!badgeState || badgeState.scope !== 'uma' || badgeState.umaId !== umaId) throw new Error('Uma redemption badge state is missing')
      return { profile, uma, ledgerId, alreadyRedeemed: true, badgeState, flairEvents: [] }
    }
    if (ledgerRow) throw new Error('Uma redemption record exists without its Uma')
    if (umaRow) throw new Error('Uma outfit is already owned')
    const mutation = redeemUmaSelectCoupon(profile, template, false, today, now)
    const entry = mutation.ledger[0]
    await db.profile.put({ ...profileRow, data: mutation.profile })
    await db.umas.add({ id: umaId, data: mutation.uma, version: 0 })
    const flair = initializedBadgeState(content, mutation.uma, now, entry.id)
    const badgeState = flair.state
    await db.badges.add({ id: badgeStateId(umaId), data: badgeState, version: 0 })
    await db.ledger.add({ id: entry.id, data: entry.data, createdAt: entry.data.createdAt })
    await queueInTransaction('profile', 'main', 'upsert', now)
    await queueInTransaction('umas', umaId, 'upsert', now)
    await queueInTransaction('badges', badgeStateId(umaId), 'upsert', now)
    await appendFlairEvents(flair.events, now)
    await queueInTransaction('ledger', entry.id, 'append', now)
    return { profile: mutation.profile, uma: mutation.uma, ledgerId, alreadyRedeemed: false, badgeState, flairEvents: flair.events }
  })
}
