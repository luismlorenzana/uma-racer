import { describe, expect, it } from 'vitest'
import { allocatePuzzleMaterials, planPuzzleTargetedWins } from './allocation'
import { STRATEGIES } from '../../../types'

describe('restricted integer allocation reports', () => {
  it('reroutes an overlapping A-style recipient instead of greedily stranding a single-style recipient', () => {
    const stock = { front: 9, pace: 9, late: 0, end: 0 }, recipients = [
      { id: 'invented-dual', eligible: ['front', 'pace'] as const, needed: 9 }, { id: 'invented-front', eligible: ['front'] as const, needed: 9 },
    ].map(r => ({ ...r, eligible: [...r.eligible] }))
    const report = allocatePuzzleMaterials(stock, recipients)
    expect(report.usable).toBe(18); expect(report.missing).toBe(0)
    expect(report.allocations[0]!.byStyle.pace).toBe(9); expect(stock.front).toBe(9)
    expect(planPuzzleTargetedWins(stock, recipients).extraWins).toBe(0)
  })
  it.each(STRATEGIES)('reports unusable stock and minimum extra %s champion wins for six restricted recipients', style => {
    const stock = { front: 0, pace: 0, late: 0, end: 0 }, other = STRATEGIES.find(s => s !== style)!
    stock[other] = 54
    const plan = planPuzzleTargetedWins(stock, Array.from({ length: 6 }, (_, i) => ({ id: `invented-${i}`, eligible: [style], needed: 9 })))
    expect(plan.initial.usable).toBe(0); expect(plan.initial.stranded[other]).toBe(54)
    expect(plan.extraWins).toBe(5); expect(plan.wins[style]).toBe(5); expect(plan.final.missing).toBe(0)
    expect(plan.final.stranded[style]).toBe(6)
  })
  it('rejects negative/fractional/unknown stock and unsafe report cohorts', () => {
    const stock = { front: 1, pace: 0, late: 0, end: 0 }, r = { id: 'invented-one', eligible: ['front' as const], needed: 9 }
    for (const invalid of [{ ...stock, front: -1 }, { ...stock, front: 1.5 }, { ...stock, extra: 0 }]) expect(() => allocatePuzzleMaterials(invalid, [r])).toThrow()
    for (const invalid of [[], [r, r], [{ ...r, needed: 10 }], [{ ...r, eligible: [] }], new Array(1)])
      expect(() => allocatePuzzleMaterials(stock, invalid)).toThrow()
  })
  it('skips an overflowing unrelated-family candidate while retaining a feasible targeted plan', () => {
    const plan = planPuzzleTargetedWins({ front: Number.MAX_SAFE_INTEGER, pace: 0, late: 0, end: 0 },
      [{ id: 'invented-pace', eligible: ['pace'], needed: 9 }])
    expect(plan.extraWins).toBe(1); expect(plan.wins.pace).toBe(1)
    expect(plan.final.stranded.front).toBe(Number.MAX_SAFE_INTEGER)
  })
})
