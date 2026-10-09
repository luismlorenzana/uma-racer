// Invented banks and stacks only (D309).
import { describe, expect, it } from 'vitest'
import { createInspirationBank, inspirationAdvanceDebts, openBankOutfit, repayInspiration } from './inspiration-bank'
import { planInspirationExchange, validInspirationExchange } from './inspiration-exchange'
import { parseInspirationMovement } from './inspiration'
import { parseItemLedgerEntry } from './farm/types'
import { reconcileFarmEvidence } from './farm/reconciliation'
import { createInitialFarmState } from './farm/rules'

const unit = (tier: number) => ({ tier, inspiration: { slots: [], golds: [] } })
const opened = () => openBankOutfit(createInspirationBank([{ id: 'invented-a', scenarios: [unit(1), unit(2)] }], 1), 'invented-a')

describe('Inspiration token exchange (D309)', () => {
  it('turns two lower tokens into one higher and one higher into two lower, same kind', () => {
    const up = planInspirationExchange({ kind: 'skill', lowerTier: 3, direction: 'up', batches: 4 }, { 'inspiration:t3:skill': 9 }, null, 'x1', 5)
    expect(up).toMatchObject({ from: 'inspiration:t3:skill', to: 'inspiration:t4:skill', spend: 8, gross: 4, debtPaid: 0, net: 4, after: { from: 1, to: 4 } })
    expect(up.movements.map((m) => [m.id, m.itemId, m.delta])).toEqual([
      ['inspiration-exchange:x1:in', 'inspiration:t3:skill', -8], ['inspiration-exchange:x1:out', 'inspiration:t4:skill', 4]])
    const down = planInspirationExchange({ kind: 'slot', lowerTier: 13, direction: 'down', batches: 3 }, { 'inspiration:t14:slot': 3, 'inspiration:t13:slot': 1 }, null, 'x2', 5)
    expect(down).toMatchObject({ from: 'inspiration:t14:slot', to: 'inspiration:t13:slot', spend: 3, gross: 6, after: { from: 0, to: 7 } })
    for (const m of [...up.movements, ...down.movements]) {
      expect(parseInspirationMovement(m)).toEqual(m)
      expect(parseItemLedgerEntry(m)).toEqual(m)
    }
  })

  it('repays the output scenario’s advance first, then deposits the rest', () => {
    const plan = planInspirationExchange({ kind: 'skill', lowerTier: 1, direction: 'down', batches: 10 }, { 'inspiration:t2:skill': 10 }, opened(), 'x3', 5)
    expect(plan).toMatchObject({ gross: 20, debtPaid: 12, net: 8, after: { from: 0, to: 8 } })
    expect(plan.bank!.balances['inspiration:t1:skill']).toBe(0)
    expect(plan.movements[1]!.source).toMatchObject({ side: 'out', debtPaid: 12 })
    // Ledger evidence rebuilds the same Items: gross minus what repaid the advance.
    const rebuilt = reconcileFarmEvidence(createInitialFarmState(), [], [
      { id: 'rpg-inspiration:e:skill', itemId: 'inspiration:t2:skill', delta: 10, createdAt: 1, reason: 'rpg-inspiration',
        source: { kind: 'rpg-inspiration', entryId: 'e', attemptId: 'a', tier: 2, tokenKind: 'skill' } }, ...plan.movements])
    expect(Object.fromEntries(rebuilt.stacks.map((s) => [s.itemId, s.quantity]))).toEqual({ 'inspiration:t1:skill': 8, 'inspiration:t2:skill': 0 })
  })

  it('refuses a spend Items can’t cover, a pair past the last scenario and a bank still opening', () => {
    expect(() => planInspirationExchange({ kind: 'slot', lowerTier: 1, direction: 'up', batches: 2 }, { 'inspiration:t1:slot': 3 }, null, 'x', 1)).toThrow(/Needs 4/)
    for (const bad of [{ lowerTier: 0 }, { lowerTier: 14 }, { batches: 0 }, { batches: 1000 }, { batches: 1.5 }]) {
      expect(validInspirationExchange({ kind: 'slot', lowerTier: 1, direction: 'up', batches: 1, ...bad })).toBe(false)
    }
    const opening = createInspirationBank([{ id: 'invented-a', scenarios: [unit(1)] }, { id: 'invented-b', scenarios: [unit(1)] }], 1)
    expect(() => planInspirationExchange({ kind: 'slot', lowerTier: 1, direction: 'down', batches: 1 }, { 'inspiration:t2:slot': 1 },
      openBankOutfit(opening, 'invented-a'), 'x', 1)).toThrow(/Resume/)
  })

  it('accepts only self-consistent exchange rows', () => {
    const [input, output] = planInspirationExchange({ kind: 'skill', lowerTier: 2, direction: 'up', batches: 2 }, { 'inspiration:t2:skill': 4 }, null, 'x4', 1).movements
    const bad = [
      { ...input, delta: -2 }, { ...output, delta: 3 }, { ...input, id: 'inspiration-exchange:other:in' },
      { ...input, itemId: 'inspiration:t2:slot' }, { ...input, itemId: 'inspiration:t14:skill', source: { ...input!.source, tier: 14 } },
      { ...output, itemId: 'inspiration:t1:skill', source: { ...output!.source, tier: 1 } },
      { ...output, source: { ...output!.source, debtPaid: 3 } }, { ...input, source: { ...input!.source, debtPaid: 0 } },
      { ...input, source: { ...input!.source, batches: 1000 } },
    ]
    for (const row of bad) expect(parseInspirationMovement(row)).toBeNull()
  })

  it('summarises what the advance lent, still owes and has repaid', () => {
    const bank = repayInspiration(opened(), 'inspiration:t1:skill', 5).bank!
    expect(inspirationAdvanceDebts(bank)).toEqual([
      { itemId: 'inspiration:t1:slot', lent: 6, owed: 6, repaid: 0 }, { itemId: 'inspiration:t1:skill', lent: 12, owed: 7, repaid: 5 },
      { itemId: 'inspiration:t2:slot', lent: 6, owed: 6, repaid: 0 }, { itemId: 'inspiration:t2:skill', lent: 12, owed: 12, repaid: 0 }])
  })
})
