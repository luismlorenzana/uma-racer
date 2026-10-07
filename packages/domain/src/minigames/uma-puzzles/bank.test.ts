import { describe, expect, it } from 'vitest'
import { freezePuzzleCohort, parsePuzzleBank, parsePuzzleCohort, preparePuzzleBank, repayPuzzleMaterial } from './bank'
import { puzzleMaterialId } from './materials'
import { puzzleError, syntheticPuzzleSource } from './test-fixtures'

const fr = puzzleMaterialId('ura-finale', 'front'), pc = puzzleMaterialId('ura-finale', 'pace'), unity = puzzleMaterialId('unity-cup', 'front')
const source = syntheticPuzzleSource(['front', 'pace'])
const cohort = () => freezePuzzleCohort('cutover:one', [{ outfitId: source.templateId, scenarioId: 'ura-finale', level: 8, preferredStyle: 'front' }])
const active = () => preparePuzzleBank(cohort(), new Map([[source.templateId, source]]))

describe('separate frozen Constellation bank', () => {
  it('charges CL−1 once per scenario unit, not per preset or A-style', () => {
    const savedUnit = { level: 8, presets: ['sprint', 'mile', 'medium', 'long'] }
    expect(savedUnit.presets).toHaveLength(4)
    const bank = active()
    expect(bank.allocations).toHaveLength(1)
    expect(bank.balances).toEqual({ [fr]: -7 })
    expect(bank.allocations[0]).toMatchObject({ eligibleStyles: ['front', 'pace'], style: 'front' })
    const other = syntheticPuzzleSource(['late', 'end'], false, 'invented-b')
    const mixed = preparePuzzleBank(freezePuzzleCohort('cutover:mixed', [
      { outfitId: source.templateId, scenarioId: 'ura-finale', level: 1, preferredStyle: 'pace' },
      { outfitId: source.templateId, scenarioId: 'unity-cup', level: 10, preferredStyle: 'end' },
      { outfitId: other.templateId, scenarioId: 'ura-finale', level: 4, preferredStyle: null },
    ]), new Map([[source.templateId, source], [other.templateId, other]]))
    expect(mixed.balances).toEqual({ [pc]: 0, [unity]: -9, [puzzleMaterialId('ura-finale', 'late')]: -3 })
    expect(parsePuzzleBank(mixed)).toEqual(mixed)
  })
  it('holds unknown/invalid/no-A sources preparing without partial debit, then resumes the same cohort', () => {
    const frozen = cohort(), pending = preparePuzzleBank(frozen, new Map())
    expect(pending).toMatchObject({ phase: 'preparing', balances: {}, allocations: [], unresolvedOutfits: [source.templateId] })
    expect(parsePuzzleBank(pending)).toEqual(pending)
    puzzleError(() => repayPuzzleMaterial(pending, fr, 12), 'locked')
    const invalid = { ...source, growthRates: { ...source.growthRates, speed: NaN } }
    expect(preparePuzzleBank(frozen, new Map([[source.templateId, invalid]])).phase).toBe('preparing')
    expect(preparePuzzleBank(frozen, new Map([[source.templateId, syntheticPuzzleSource([])]])).phase).toBe('preparing')
    const ready = preparePuzzleBank(frozen, new Map([[source.templateId, source]]), pending)
    expect(ready.phase).toBe('active')
    expect(ready.balances[fr]).toBe(-7)
  })
  it('freezes the cohort and allocation across retries/preference edits/new acquisitions', () => {
    const frozen = cohort(), bank = active()
    const retried = freezePuzzleCohort('cutover:one', [...frozen.units, { outfitId: 'future-outfit', scenarioId: 'ura-finale', level: 10, preferredStyle: null }], frozen)
    expect(retried).toEqual(frozen)
    expect(preparePuzzleBank(retried, new Map(), bank)).toEqual(bank)
    const changed = { ...frozen, units: [{ ...frozen.units[0]!, preferredStyle: 'pace' as const }] }
    puzzleError(() => preparePuzzleBank(changed, new Map([[source.templateId, source]]), bank), 'stale')
    puzzleError(() => freezePuzzleCohort('different:receipt', [], frozen), 'stale')
    const paid = repayPuzzleMaterial(bank, fr, 12).bankAfter!
    expect(preparePuzzleBank(frozen, new Map(), paid).balances[fr]).toBe(0)
  })
  it('repays only matching material and retains the zero-debt receipt', () => {
    const bank = active(), before = JSON.stringify(bank)
    const result = repayPuzzleMaterial(bank, fr, 12)
    expect(result).toMatchObject({ gross: 12, debtPaid: 7, net: 5 })
    expect(result.bankAfter?.balances[fr]).toBe(0)
    expect(result.bankAfter?.receiptId).toBe(bank.receiptId)
    expect(JSON.stringify(bank)).toBe(before)
    for (const id of [pc, unity]) expect(repayPuzzleMaterial(bank, id, 12)).toMatchObject({ debtPaid: 0, net: 12, bankAfter: bank })
    expect(repayPuzzleMaterial(result.bankAfter, fr, 1)).toMatchObject({ debtPaid: 0, net: 1 })
    expect(repayPuzzleMaterial(null, fr, 12)).toEqual({ gross: 12, debtPaid: 0, net: 12, bankAfter: null })
  })
  it('conserves every grant and moves debt monotonically toward zero', () => {
    for (const gross of [0, 1, 6, 7, 8, 12, Number.MAX_SAFE_INTEGER]) {
      const result = repayPuzzleMaterial(active(), fr, gross)
      expect(result.debtPaid + result.net).toBe(gross)
      expect(result.bankAfter!.balances[fr]).toBeGreaterThanOrEqual(-7)
      expect(result.bankAfter!.balances[fr]).toBeLessThanOrEqual(0)
    }
    let bank = active()
    for (let i = 0; i < 12; i++) bank = repayPuzzleMaterial(bank, fr, 1).bankAfter!
    expect(bank.balances[fr]).toBe(0)
    expect(parsePuzzleBank(bank)).toEqual(bank)
  })
  it('rejects future, oversized, duplicate, prototype, wrong-limit and incoherent bank payloads', () => {
    const c = cohort(), bank = active()
    for (const v of [{ ...c, schemaVersion: 2 }, { ...c, units: [...c.units, ...c.units] },
      { ...c, units: Array(4097).fill(c.units[0]) }, { ...c, receiptId: '__proto__' }]) expect(parsePuzzleCohort(v)).toBeNull()
    for (const v of [{ ...bank, schemaVersion: 2 }, { ...bank, balances: { [fr]: 1 } }, { ...bank, balances: { [fr]: -8 } },
      { ...bank, balances: {} }, { ...bank, balances: JSON.parse('{"__proto__":-7}') },
      { ...bank, allocations: [] }, { ...bank, phase: 'preparing' }, { ...bank, unresolvedOutfits: ['unknown'] },
      { ...bank, allocations: [{ ...bank.allocations[0]!, eligibleStyles: ['front', 'front'] }] }]) expect(parsePuzzleBank(v)).toBeNull()
    puzzleError(() => repayPuzzleMaterial(bank, fr, -1), 'invalid')
  })
})
