import { describe, expect, it } from 'vitest'
import { advanceCardStars, cardStars, isCardMaxedIn, owedMaxCouponCardIds } from './card-progression'
import { MAX_STARS } from './cards'
import type { CardSave } from './save'

const card = (bonds: Record<string, number> = {}, maxCouponGranted = false): CardSave =>
  ({ templateId: 'c1', bonds, maxCouponGranted })

describe('three stars (D200)', () => {
  it('climbs one star a clear to 3★, paying the Card Select Coupon on the first 3★ only', () => {
    let save = card()
    const coupons: boolean[] = []
    for (let clear = 1; clear <= MAX_STARS; clear += 1) {
      const result = advanceCardStars(save, 2)
      expect(result).toMatchObject({ tier: 2, fromStars: clear - 1, toStars: clear })
      coupons.push(result.couponGranted)
      save = result.card
    }
    expect(coupons).toEqual([false, false, true])
    expect(isCardMaxedIn(save, 2)).toBe(true)
    expect(() => advanceCardStars(save, 2)).toThrow(/already has 3★/)
    // A second scenario climbs on its own and never pays a second coupon.
    let other = save
    for (let clear = 1; clear <= MAX_STARS; clear += 1) {
      const result = advanceCardStars(other, 5)
      expect(result.couponGranted).toBe(false)
      other = result.card
    }
    expect([cardStars(other, 2), cardStars(other, 5)]).toEqual([3, 3])
  })

  it('owes the coupon only to a card at max that never paid it', () => {
    expect(owedMaxCouponCardIds([
      { ...card({ '1': 3 }), templateId: 'maxed' },
      { ...card({ '1': 3 }, true), templateId: 'paid' },
      { ...card({ '1': 2, '4': 1 }), templateId: 'short' },
      { ...card({ '7': 3 }), templateId: 'another' },
    ])).toEqual(['another', 'maxed'])
  })
})
