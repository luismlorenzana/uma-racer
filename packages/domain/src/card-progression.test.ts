import { describe, expect, it } from 'vitest'
import { advanceCardStars, cardStars, isCardMaxed, mergeCardProgress, owedMaxCouponCardIds } from './card-progression'
import { MAX_STARS } from './cards'
import { migrateCardSaveToCurrent, parseCardSave, type CardSave } from './save'

const card = (stars = 0, maxCouponGranted = false): CardSave =>
  ({ schemaVersion: 1, templateId: 'c1', stars, maxCouponGranted })

describe('global three stars (D200, D255)', () => {
  it('climbs one star a clear to 3★, paying the Card Select Coupon on the first 3★ only', () => {
    let save = card()
    const coupons: boolean[] = []
    for (let clear = 1; clear <= MAX_STARS; clear += 1) {
      const result = advanceCardStars(save, clear)
      expect(result).toMatchObject({ tier: clear, fromStars: clear - 1, toStars: clear })
      coupons.push(result.couponGranted)
      save = result.card
    }
    expect(coupons).toEqual([false, false, true])
    expect(isCardMaxed(save)).toBe(true)
    for (let tier = 1; tier <= 14; tier += 1) expect(() => advanceCardStars(save, tier)).toThrow(/already has 3★ globally/)
    expect(cardStars(save)).toBe(3)
    expect(() => advanceCardStars(card(), 15)).toThrow(/valid scenario/)
  })

  it('owes the coupon only to a card at max that never paid it', () => {
    expect(owedMaxCouponCardIds([
      { ...card(3), templateId: 'maxed' },
      { ...card(3, true), templateId: 'paid' },
      { ...card(2), templateId: 'short' },
      { ...card(3), templateId: 'another' },
    ])).toEqual(['another', 'maxed'])
  })

  it('takes maximum not sum through every historical scale, preserving paid coupons', () => {
    const old = (body: object) => ({ templateId: 'c1', maxCouponGranted: true, ...body })
    expect(migrateCardSaveToCurrent(old({ bonds: { '1': 1, '2': 2 } }))).toEqual(card(2, true))
    expect(migrateCardSaveToCurrent(old({ bonds: { '1': 3, '14': 1 } }))).toEqual(card(3, true))
    expect(migrateCardSaveToCurrent(old({ bonds: {} }))).toEqual(card(0, true))
    expect(migrateCardSaveToCurrent(old({ stars: { '1': 2, '2': 3 } }))).toEqual(card(2, true))
    expect(migrateCardSaveToCurrent(old({ limitBreaks: { '1': 1, '2': 3 } }))).toEqual(card(3, true))
    expect(migrateCardSaveToCurrent(old({ limitBreak: 2 }))).toEqual(card(2, true))
    expect(migrateCardSaveToCurrent(card(2))).toEqual(card(2))
  })

  it('rejects malformed current and legacy shapes rather than falling back', () => {
    for (const value of [
      { ...card(), stars: 4 }, { ...card(), stars: -1 }, { ...card(), stars: 1.5 },
      { ...card(), stars: { '1': 3 } }, { ...card(), schemaVersion: 2, limitBreak: 4 },
      { ...card(), bonds: {} }, { ...card(), maxCouponGranted: 1 },
      { templateId: 'c1', bonds: { '15': 3 }, maxCouponGranted: false },
    ]) {
      expect(parseCardSave(value)).toBeNull()
      expect(migrateCardSaveToCurrent(value)).toBeNull()
    }
  })

  it('merges permanent progress monotonically without adding concurrent counts', () => {
    expect(mergeCardProgress(card(2, true), card(1))).toEqual(card(2, true))
    expect(mergeCardProgress(card(2), card(2))).toEqual(card(2))
    expect(mergeCardProgress(card(1), card(3, true))).toEqual(card(3, true))
    expect(() => mergeCardProgress(card(), { ...card(), templateId: 'other' })).toThrow(/different cards/)
  })
})
