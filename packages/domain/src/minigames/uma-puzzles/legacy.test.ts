import { describe, expect, it } from 'vitest'
import { parsePuzzleLegacyCredit, resolvePuzzleLegacyCredit, summarizePuzzleLegacyCredit, type PuzzleLegacyCreditInput } from './legacy'
import { puzzleError } from './test-fixtures'

const input = (exp = 0): PuzzleLegacyCreditInput => ({ preservedStock: 3, accountExp: exp, units: [] })
describe('one-time legacy universal credit', () => {
  it.each([0, 1249, 1250, 1251, 2500])('pools %i EXP, preserving stock and rounding once', exp => {
    const credit = resolvePuzzleLegacyCredit('legacy:one', input(exp))
    expect(credit.wholeTickets).toBe(Math.floor(exp / 1250))
    expect(credit.remainderExp).toBe(exp % 1250)
    expect(credit.roundUpTickets).toBe(exp % 1250 > 0 ? 1 : 0)
    expect(credit.stockAfter).toBe(3 + Math.ceil(exp / 1250))
    expect(credit.compensationExp + credit.pooledExp).toBe((credit.wholeTickets + credit.roundUpTickets) * 1250)
    expect(parsePuzzleLegacyCredit(credit)).toEqual(credit)
  })
  it('pools several fractions and the account bank before rounding; excludes settled overflow', () => {
    const credit = resolvePuzzleLegacyCredit('legacy:pool', { ...input(200), units: [
      { outfitId: 'invented-a', scenarioId: 'ura-finale', unappliedExp: 400, alreadyConverted: false },
      { outfitId: 'invented-b', scenarioId: 'ura-finale', unappliedExp: 300, alreadyConverted: false },
      { outfitId: 'invented-a', scenarioId: 'unity-cup', unappliedExp: 250, alreadyConverted: false },
      { outfitId: 'invented-c', scenarioId: 'ura-finale', unappliedExp: 1250, alreadyConverted: true },
    ] })
    expect(credit).toMatchObject({ pooledExp: 1150, wholeTickets: 0, remainderExp: 1150, roundUpTickets: 1, compensationExp: 100, stockAfter: 4 })
    // No bank parameter: this preserves owned value, rather than acquiring a debt-paying reward.
    expect(Object.keys(credit)).not.toContain('debtPaid')
  })
  it('returns the same receipt on retry rather than re-converting later account EXP/stock', () => {
    const credit = resolvePuzzleLegacyCredit('legacy:one', input(1249))
    expect(resolvePuzzleLegacyCredit('legacy:one', input(99999), credit)).toEqual(credit)
    puzzleError(() => resolvePuzzleLegacyCredit('legacy:other', input(0), credit), 'stale')
    expect(credit).toMatchObject({ preservedStock: 3, stockAfter: 4, compensationExp: 1 })
  })
  it('rejects unsafe sums, malformed inputs, duplicate units, future schemas and tampered totals', () => {
    puzzleError(() => summarizePuzzleLegacyCredit(input(-1)), 'invalid')
    puzzleError(() => summarizePuzzleLegacyCredit({ ...input(1250), preservedStock: Number.MAX_SAFE_INTEGER }), 'overflow')
    const unit = { outfitId: 'invented-a', scenarioId: 'ura-finale', unappliedExp: 1, alreadyConverted: false }
    puzzleError(() => summarizePuzzleLegacyCredit({ ...input(), units: [unit, unit] }), 'invalid')
    puzzleError(() => summarizePuzzleLegacyCredit({ ...input(Number.MAX_SAFE_INTEGER), units: [unit] }), 'overflow')
    const credit = resolvePuzzleLegacyCredit('legacy:one', input(1249))
    for (const v of [{ ...credit, schemaVersion: 2 }, { ...credit, stockAfter: 10 }, { ...credit, compensationExp: 0 },
      { ...credit, receiptId: 'constructor' }, { ...credit, units: Array(4097).fill(unit) }, { ...credit, units: [null] }]) expect(parsePuzzleLegacyCredit(v)).toBeNull()
  })
})
