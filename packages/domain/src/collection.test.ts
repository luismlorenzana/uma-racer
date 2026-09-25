import { describe, expect, it } from 'vitest'
import {
  CARD_EFFECTS,
  cardCollectionCounts,
  createCardSave,
  createPlayerProfile,
  createUmaSave,
  exchangeUmaShards,
  nextUmaShardExchangeSequence,
  cardUnlockCost,
  redeemCardSelectCoupon,
  redeemUmaSelectCoupon,
  unlockCardWithTickets,
  umaCollectionCounts,
  type SupportCardTemplate,
  type UmaTemplate,
} from './index'

const aptitudes = {
  surface: { turf: 'A', dirt: 'G' },
  distance: { sprint: 'B', mile: 'A', medium: 'A', long: 'C' },
  strategy: { front: 'D', pace: 'A', late: 'B', end: 'C' },
} as const

const uma = (id: string): UmaTemplate => ({
  id,
  charaId: `runner-${id}`,
  name: `Synthetic ${id}`,
  outfit: 'Practice Outfit',
  jpRelease: '2000-01-01',
  globalRelease: null,
  starter: false,
  baseStats: { speed: 101, stamina: 102, power: 103, guts: 104, wit: 105 },
  growthRates: { speed: 0, stamina: 0, power: 0, guts: 0, wit: 0 },
  aptitudes,
  uniqueSkillId: `skill-${id}`,
  awakeningSkillIds: [],
  realHorseSex: null,
    signatureRaceFamilyIds: [],
  imageSource: 'https://example.invalid/synthetic.png',
})

const card = (id: string, era = 1, type: SupportCardTemplate['type'] = 'speed'): SupportCardTemplate => ({
  id,
  charaId: `runner-${id}`,
  charName: `Synthetic ${id}`,
  title: 'Practice Notes',
  type,
  jpRelease: '2000-01-01',
  era,
  obtain: 'gacha',
  starter: false,
  hintSkillIds: [],
  eventSkillIds: [],
  effectProfile: Object.fromEntries(CARD_EFFECTS.map((effect) => [effect, 1])) as SupportCardTemplate['effectProfile'],
  uniqueEffect: null,
  imageSource: 'https://example.invalid/synthetic.png',
})

describe('collection mutations', () => {
  it('exchanges exactly five shards into one coupon with two exact ledger rows', () => {
    const profile = { ...createPlayerProfile('synthetic', 1), umaShards: 7, umaCoupons: 2 }
    expect(exchangeUmaShards(profile, 3, '2000-01-02', 50)).toEqual({
      profile: { ...profile, umaShards: 2, umaCoupons: 3 },
      sequence: 3,
      ledger: [
        { id: 'uma-shard-exchange:3:shards', data: { resource: 'uma-shards', delta: -5, reason: 'uma-shard-exchange', localDay: '2000-01-02', createdAt: 50 } },
        { id: 'uma-shard-exchange:3:coupon', data: { resource: 'uma-coupons', delta: 1, reason: 'uma-shard-exchange', localDay: '2000-01-02', createdAt: 50 } },
      ],
    })
    expect(() => exchangeUmaShards({ ...profile, umaShards: 4 }, 4, '2000-01-02', 50)).toThrow('Need 5')
    expect(nextUmaShardExchangeSequence(['other:1', 'uma-shard-exchange:2:coupon', 'uma-shard-exchange:7:shards'])).toBe(8)
  })

  it('redeems each coupon through the canonical level-one constructor', () => {
    const profile = { ...createPlayerProfile('synthetic', 1), cardCoupons: 2, umaCoupons: 1 }
    const cardTemplate = card('card-new', 8, 'group')
    const umaTemplate = uma('uma-new')
    expect(redeemCardSelectCoupon(profile, cardTemplate, false, '2000-01-02', 51)).toEqual({
      profile: { ...profile, cardCoupons: 1 },
      card: createCardSave(cardTemplate),
      ledger: [{ id: 'card-coupon-redeem:card-new', data: { resource: 'card-coupons', delta: -1, reason: 'card-coupon-redeem', localDay: '2000-01-02', createdAt: 51 } }],
    })
    expect(redeemUmaSelectCoupon(profile, umaTemplate, false, '2000-01-02', 52)).toEqual({
      profile: { ...profile, umaCoupons: 0 },
      uma: createUmaSave(umaTemplate),
      ledger: [{ id: 'uma-coupon-redeem:uma-new', data: { resource: 'uma-coupons', delta: -1, reason: 'uma-coupon-redeem', localDay: '2000-01-02', createdAt: 52 } }],
    })
    expect(() => redeemCardSelectCoupon(profile, cardTemplate, true, '2000-01-02', 51)).toThrow('already owned')
    expect(() => redeemUmaSelectCoupon({ ...profile, umaCoupons: 0 }, umaTemplate, false, '2000-01-02', 52)).toThrow('No Uma')
  })
})

describe('unlocking a card with tickets', () => {
  it('prices a card by its era: 6 in URA Finale up to 19 in the newest scenario (D148)', () => {
    expect(cardUnlockCost(1)).toBe(6)
    expect(cardUnlockCost(8)).toBe(13)
    expect(cardUnlockCost(14)).toBe(19)
  })

  it('spends tickets once, under a ledger id keyed by the card', () => {
    const profile = { ...createPlayerProfile('synthetic', 1), tickets: 20 }
    const cardTemplate = card('card-new', 8, 'speed')
    expect(unlockCardWithTickets(profile, cardTemplate, false, '2000-01-02', 53)).toEqual({
      profile: { ...profile, tickets: 7 },
      card: createCardSave(cardTemplate),
      ledger: [{ id: 'card-unlock:card-new', data: { resource: 'tickets', delta: -13, reason: 'card-unlock', localDay: '2000-01-02', createdAt: 53 } }],
    })
    expect(() => unlockCardWithTickets({ ...profile, tickets: 12 }, cardTemplate, false, '2000-01-02', 53)).toThrow('needs 13 tickets')
    expect(() => unlockCardWithTickets(profile, cardTemplate, true, '2000-01-02', 53)).toThrow('already owned')
  })
})

describe('collection counts', () => {
  it('counts known cards by era/type without inflating completion for orphans', () => {
    const cards = [card('c2', 2, 'friend'), card('c1', 1, 'speed'), card('c3', 2, 'speed')]
    const owned = {
      c1: { ...createCardSave(cards[1]!), stars: { '1': 5 } },
      c2: createCardSave(cards[0]!),
      orphan: createCardSave(card('orphan')),
    }
    expect(cardCollectionCounts(cards, owned)).toEqual({
      owned: 2,
      total: 3,
      maxed: 1,
      eras: [{ key: 1, owned: 1, total: 1 }, { key: 2, owned: 1, total: 2 }],
      types: [{ key: 'friend', owned: 1, total: 1 }, { key: 'speed', owned: 1, total: 2 }],
      orphanedIds: ['orphan'],
    })
  })

  it('counts each Uma outfit template and reports missing references', () => {
    const templates = [uma('u1'), uma('u2')]
    expect(umaCollectionCounts(templates, { u1: createUmaSave(templates[0]!), missing: createUmaSave(uma('missing')) })).toEqual({
      owned: 1,
      total: 2,
      orphanedIds: ['missing'],
    })
  })
})
