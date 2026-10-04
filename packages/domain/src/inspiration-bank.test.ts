import { describe, expect, it } from 'vitest'
import { createInspirationBank, openBankOutfit, parseInspirationBank, repayInspiration } from './inspiration-bank'
import { createInitialFarmState } from './farm/rules'
import { reconcileFarmEvidence } from './farm/reconciliation'
import { parseInspirationMovement, type InspirationMovement } from './inspiration'
const unit = (tier: number) => ({ tier, inspiration: { slots: ['parent0'], golds: ['parent0:gold0'] } })
const frozen = () => createInspirationBank([{ id: 'invented-a', scenarios: [unit(1), unit(2)] }, { id: 'invented-b', scenarios: [unit(1)] }], 1)
describe('signed Inspiration advance', () => {
  it('charges every position, records prior counts, resumes exactly once and never multiplies by presets', () => {
    const first = openBankOutfit(frozen(), 'invented-a')
    expect(first.phase).toBe('opening'); expect(first.balances).toEqual({ 'inspiration:t1:slot': -6, 'inspiration:t1:skill': -12, 'inspiration:t2:slot': -6, 'inspiration:t2:skill': -12 })
    expect(first.cohort['invented-a']).toEqual({ tiers: [1, 2], slotsBefore: [1, 1], goldsBefore: [1, 1] })
    expect(openBankOutfit(first, 'invented-a')).toBe(first)
    const complete = openBankOutfit(first, 'invented-b')
    expect(complete.phase).toBe('active'); expect(complete.balances['inspiration:t1:skill']).toBe(-24)
    expect(parseInspirationBank(complete)).toEqual(complete)
    expect(() => openBankOutfit(complete, 'future-outfit')).toThrow(/outside/)
  })
  it('repays only matching scenario/family, then deposits overflow; completed banks retain their receipt', () => {
    const bank = openBankOutfit(openBankOutfit(frozen(), 'invented-a'), 'invented-b')
    const first = repayInspiration(bank, 'inspiration:t1:skill', 20)
    expect(first).toMatchObject({ debtPaid: 20, net: 0 }); expect(first.bank!.balances['inspiration:t1:skill']).toBe(-4)
    const next = repayInspiration(first.bank, 'inspiration:t1:skill', 10)
    expect(next).toMatchObject({ debtPaid: 4, net: 6 }); expect(next.bank!.balances['inspiration:t1:slot']).toBe(-12)
    expect(next.bank!.balances['inspiration:t2:skill']).toBe(-12)
    expect(repayInspiration(next.bank, 'inspiration:t1:skill', 60)).toMatchObject({ debtPaid: 0, net: 60 })
    expect(repayInspiration(bank, 'inspiration:t3:skill', 60)).toMatchObject({ debtPaid: 0, net: 60 })
    expect(() => repayInspiration(frozen(), 'inspiration:t1:skill', 1)).toThrow(/Resume/)
  })
  it('rejects malformed cohorts, positive/invented balances, premature activation and duplicated completions', () => {
    const bank = frozen()
    for (const bad of [{ ...bank, extra: true }, { ...bank, phase: 'active' }, { ...bank, opened: ['invented-a', 'invented-a'] },
      { ...bank, balances: { ...bank.balances, 'inspiration:t1:skill': -12 } }, { ...bank, balances: { ...bank.balances, 'inspiration:t1:slot': 1 } },
      { ...bank, cohort: { ['__proto__']: bank.cohort['invented-a'] } }]) expect(parseInspirationBank(bad)).toBeNull()
  })
  it('reconstructs net inventory, not withheld gross rewards, including zero-net and legacy receipts', () => {
    const movement = (entry: string, debtPaid?: number): InspirationMovement => ({ id: `rpg-inspiration:${entry}:skill`, itemId: 'inspiration:t1:skill', delta: 20,
      createdAt: 1, reason: 'rpg-inspiration', source: { kind: 'rpg-inspiration', entryId: entry, attemptId: 'invented-attempt', tier: 1, tokenKind: 'skill', ...(debtPaid === undefined ? {} : { debtPaid }) } })
    const entries = [movement('zero', 20), movement('overflow', 4), movement('legacy')]
    expect(entries.every(e => parseInspirationMovement(e))).toBe(true)
    const result = reconcileFarmEvidence(createInitialFarmState(), [], entries)
    expect(result.stacks.find(s => s.itemId === 'inspiration:t1:skill')?.quantity).toBe(36)
    for (const debtPaid of [-1, 21, 1.5]) expect(parseInspirationMovement(movement('invalid', debtPaid))).toBeNull()
  })
})
