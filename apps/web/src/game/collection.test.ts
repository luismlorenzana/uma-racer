import 'fake-indexeddb/auto'

import { CARD_EFFECTS, createCardSave, createPlayerProfile, createUmaSave, type SupportCardTemplate, type UmaTemplate } from '@racer/domain'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { LoadedContent } from '../content/runtime'
import {
  exchangeMemoryUmaShards,
  exchangePersistentUmaShards,
  grantOwedMaxCoupons,
  grantOwnerGifts,
  redeemMemoryCard,
  redeemMemoryUma,
  redeemPersistentCard,
  redeemPersistentUma,
} from './collection'
import { db } from './db'

const aptitudes = {
  surface: { turf: 'A', dirt: 'G' },
  distance: { sprint: 'B', mile: 'A', medium: 'A', long: 'C' },
  strategy: { front: 'D', pace: 'A', late: 'B', end: 'C' },
} as const
const umaTemplate: UmaTemplate = {
  id: 'uma-synthetic-new', charaId: 'runner-new', name: 'Synthetic New', outfit: 'Practice Outfit',
  jpRelease: '2000-01-01', globalRelease: null, starter: false,
  baseStats: { speed: 101, stamina: 102, power: 103, guts: 104, wit: 105 },
  growthRates: { speed: 0, stamina: 0, power: 0, guts: 0, wit: 0 }, aptitudes,
  uniqueSkillId: 'skill-synthetic', awakeningSkillIds: [], realHorseSex: null, signatureRaceFamilyIds: [],
  imageSource: 'https://example.invalid/synthetic.png',
}
const cardTemplate: SupportCardTemplate = {
  id: 'card-synthetic-new', charaId: 'runner-new', charName: 'Synthetic New', title: 'Practice Notes', type: 'group',
  jpRelease: '2000-01-01', era: 9, obtain: 'gacha', starter: false, hintSkillIds: [], eventSkillIds: [],
  effectProfile: Object.fromEntries(CARD_EFFECTS.map((effect) => [effect, 1])) as SupportCardTemplate['effectProfile'],
  uniqueEffect: null, imageSource: 'https://example.invalid/synthetic.png',
}
const content: LoadedContent = {
  manifest: { version: 'synthetic', generatedAt: '', source: {}, files: [] }, origin: 'network', sparkRivals: null,
  umas: { items: [umaTemplate], byId: new Map([[umaTemplate.id, umaTemplate]]) },
  cards: { items: [cardTemplate], byId: new Map([[cardTemplate.id, cardTemplate]]) },
  skills: { items: [], byId: new Map() }, races: { items: [], byId: new Map() }, courses: { items: [], byId: new Map() },
  atlases: {
    'uma-icons': { descriptor: { schemaVersion: 1, kind: 'uma-icons', frameWidth: 128, frameHeight: 128, pages: [], frames: {} }, pageUrls: [] },
    'card-icons': { descriptor: { schemaVersion: 1, kind: 'card-icons', frameWidth: 128, frameHeight: 128, pages: [], frames: {} }, pageUrls: [] },
  },
    art: { has: () => false, load: async () => null },
}

async function resetDatabase(): Promise<void> {
  db.close()
  await db.delete()
}

async function seed(overrides: Partial<ReturnType<typeof createPlayerProfile>> = {}): Promise<void> {
  await db.open()
  await db.profile.put({
    id: 'main', version: 4,
    data: { ...createPlayerProfile('synthetic', 1), cardCoupons: 2, umaCoupons: 1, umaShards: 10, ...overrides },
  })
}

describe('collection persistence', () => {
  beforeEach(resetDatabase)
  afterEach(resetDatabase)

  it('atomically exchanges shards and derives a new sequence for every exchange', async () => {
    await seed()
    const [first, second] = await Promise.all([
      exchangePersistentUmaShards('2000-01-02', 50),
      exchangePersistentUmaShards('2000-01-02', 51),
    ])
    expect([first.sequence, second.sequence].sort()).toEqual([1, 2])
    expect((await db.profile.get('main'))?.data).toMatchObject({ umaShards: 0, umaCoupons: 3 })
    expect(await db.ledger.count()).toBe(4)
    expect(await db.outbox.count()).toBe(5)
  })

  it('redeems future Friend/Group cards exactly once and queues entity/log/profile', async () => {
    await seed()
    const first = await redeemPersistentCard(content, cardTemplate.id, '2000-01-02', 60)
    const retry = await redeemPersistentCard(content, cardTemplate.id, '2000-01-03', 70)
    expect(first).toMatchObject({ alreadyRedeemed: false, profile: { cardCoupons: 1 }, card: { stars: 0 } })
    expect(retry).toMatchObject({ alreadyRedeemed: true, profile: { cardCoupons: 1 } })
    expect((await db.cards.get(cardTemplate.id))?.version).toBe(0)
    expect(await db.ledger.get(`card-coupon-redeem:${cardTemplate.id}`)).toMatchObject({
      data: { resource: 'card-coupons', delta: -1, reason: 'card-coupon-redeem' },
    })
    expect(await db.outbox.count()).toBe(8)
    expect(await db.badges.get('trainer')).toMatchObject({ data: { aggregates: expect.arrayContaining([
      { key: 'coupon-redemptions', count: 1 },
    ]) } })
    expect(await db.flairEvents.count()).toBe(4)
  })

  it('redeems an Uma exactly once with canonical state and leaves featured Uma unchanged', async () => {
    await seed({ featuredUmaId: 'existing-uma' })
    const mutation = await redeemPersistentUma(content, umaTemplate.id, '2000-01-02', 60)
    expect(mutation).toMatchObject({
      alreadyRedeemed: false,
      profile: { umaCoupons: 0, featuredUmaId: 'existing-uma' },
      uma: { level: 1, unlockedTier: 1 },
    })
    expect(mutation.uma).toEqual(createUmaSave(umaTemplate))
    expect((await db.umas.get(umaTemplate.id))?.version).toBe(0)
    expect((await redeemPersistentUma(content, umaTemplate.id, '2000-01-02', 61)).alreadyRedeemed).toBe(true)
  })

  it('rolls back no-balance/missing-content failures and rejects ownership without a redemption ledger', async () => {
    await seed({ cardCoupons: 0, umaCoupons: 0, umaShards: 4 })
    await expect(redeemPersistentCard(content, cardTemplate.id, '2000-01-02', 60)).rejects.toThrow('No Card')
    await expect(redeemPersistentUma(content, umaTemplate.id, '2000-01-02', 60)).rejects.toThrow('No Uma')
    await expect(exchangePersistentUmaShards('2000-01-02', 60)).rejects.toThrow('Need 5')
    await expect(redeemPersistentCard(content, 'missing-card', '2000-01-02', 60)).rejects.toThrow('content is missing')
    expect(await db.ledger.count()).toBe(0)
    expect(await db.outbox.count()).toBe(0)
    await db.cards.add({ id: cardTemplate.id, data: createCardSave(cardTemplate), version: 3 })
    await expect(redeemPersistentCard(content, cardTemplate.id, '2000-01-02', 60)).rejects.toThrow('already owned')
    expect((await db.profile.get('main'))?.data.cardCoupons).toBe(0)
  })

  it('detects a same-id ledger mismatch as corruption without writing', async () => {
    await seed()
    await db.cards.add({ id: cardTemplate.id, data: createCardSave(cardTemplate), version: 0 })
    await db.ledger.add({
      id: `card-coupon-redeem:${cardTemplate.id}`,
      createdAt: 50,
      data: { resource: 'tickets', delta: -1, reason: 'training', localDay: '2000-01-02', createdAt: 50 },
    })
    await expect(redeemPersistentCard(content, cardTemplate.id, '2000-01-02', 60)).rejects.toThrow('corrupt')
    expect((await db.profile.get('main'))?.data.cardCoupons).toBe(2)
    expect(await db.outbox.count()).toBe(0)
  })
})

describe('memory-only collection mutations', () => {
  it('uses the same rules without touching IndexedDB', () => {
    const profile = { ...createPlayerProfile('synthetic', 1), cardCoupons: 1, umaCoupons: 1, umaShards: 5 }
    expect(exchangeMemoryUmaShards(profile, 1, '2000-01-02', 50).profile).toMatchObject({ umaShards: 0, umaCoupons: 2 })
    expect(redeemMemoryCard(content, profile, {}, cardTemplate.id, '2000-01-02', 50).card).toEqual(createCardSave(cardTemplate))
    expect(redeemMemoryUma(content, profile, {}, umaTemplate.id, '2000-01-02', 50).uma).toEqual(createUmaSave(umaTemplate))
    expect(() => redeemMemoryCard(content, profile, { [cardTemplate.id]: createCardSave(cardTemplate) }, cardTemplate.id, '2000-01-02', 50)).toThrow('already owned')
  })
})

describe('startup grants', () => {
  beforeEach(resetDatabase)
  afterEach(resetDatabase)

  it('pays the coupon a card was owed for reaching 3★ through the v8 migration, once (D200)', async () => {
    await seed({ cardCoupons: 0 })
    const put = (id: string, bonds: Record<string, number>, maxCouponGranted: boolean) =>
      db.cards.put({ id, version: 1, data: { schemaVersion: 1, templateId: id, stars: Math.max(0, ...Object.values(bonds)), maxCouponGranted } })
    await put('maxed', { '1': 3 }, false)
    await put('paid', { '2': 3 }, true)
    await put('short', { '1': 2 }, false)
    expect(await grantOwedMaxCoupons(100, '2000-01-02')).toBe(1)
    expect((await db.profile.get('main'))?.data.cardCoupons).toBe(1)
    expect((await db.cards.get('maxed'))?.data.maxCouponGranted).toBe(true)
    expect((await db.cards.get('short'))?.data.maxCouponGranted).toBe(false)
    expect((await db.ledger.get('card-max-v8:maxed'))?.data).toMatchObject({ resource: 'card-coupons', delta: 1, reason: 'card-max' })
    expect((await db.outbox.toArray()).map((row) => `${row.kind}/${row.id}`).sort())
      .toEqual(['cards/maxed', 'ledger/card-max-v8:maxed', 'profile/main'])
    expect(await grantOwedMaxCoupons(200, '2000-01-03')).toBe(0)
    expect((await db.profile.get('main'))?.data.cardCoupons).toBe(1)
  })

  it('pays each owner gift once, under fixed dev-grant ledger ids (D209)', async () => {
    await seed({ umaCoupons: 1 })
    const gifts = [{ id: 'g1', grant: { tickets: 0, cardCoupons: 0, umaCoupons: 3, umaShards: 0 } }]
    expect(await grantOwnerGifts(100, '2000-01-02', gifts)).toEqual({ tickets: 0, cardCoupons: 0, umaCoupons: 3, umaShards: 0 })
    expect((await db.profile.get('main'))?.data.umaCoupons).toBe(4)
    expect((await db.ledger.get('owner-gift:g1:uma-coupons'))?.data).toMatchObject({ resource: 'uma-coupons', delta: 3, reason: 'dev-grant' })
    expect((await db.outbox.toArray()).map((row) => `${row.kind}/${row.id}`).sort())
      .toEqual(['ledger/owner-gift:g1:uma-coupons', 'profile/main'])
    expect(await grantOwnerGifts(200, '2000-01-03', gifts)).toEqual({ tickets: 0, cardCoupons: 0, umaCoupons: 0, umaShards: 0 })
    expect((await db.profile.get('main'))?.data.umaCoupons).toBe(4)
  })
})
