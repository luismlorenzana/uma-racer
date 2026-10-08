import { describe, expect, it } from 'vitest'
import { constellationTemplate, nodesUnlockedBetween } from '../../constellation'
import { TRAINING_LEVEL_UP_TICKET_ID } from '../../farm/types'
import { baselineSkillPoints, SCENARIOS } from '../../scenarios'
import { freezePuzzleCohort, preparePuzzleBank } from './bank'
import { parsePuzzleMaterialId, previewPuzzleClSpend, previewPuzzleExchange, puzzleMaterialCatalogue, puzzleMaterialId,
  puzzleScenarioIdForTier, resolvePuzzleClSpend, resolvePuzzleExchange, type PuzzleClSpendInput, type PuzzleExchangeInput } from './materials'
import { puzzleError, syntheticPuzzleSource } from './test-fixtures'

const fr = puzzleMaterialId('ura-finale', 'front'), pc = puzzleMaterialId('ura-finale', 'pace')
const unityFr = puzzleMaterialId('unity-cup', 'front'), trackFr = puzzleMaterialId('trackblazer', 'front')
const spend = (changes: Partial<PuzzleClSpendInput> = {}): PuzzleClSpendInput => ({ scenarioId: 'ura-finale', level: 1,
  source: syntheticPuzzleSource(['front', 'pace']), unlockedScenarioIds: ['ura-finale'], inputs: [{ itemId: fr, quantity: 9 }],
  stocks: { [fr]: 12, [pc]: 5, [TRAINING_LEVEL_UP_TICKET_ID]: 10 }, revision: 3, expectedRevision: 3, ...changes })
const exchange = (changes: Partial<PuzzleExchangeInput> = {}): PuzzleExchangeInput => ({ from: unityFr, to: fr, quantity: 1,
  openingGuardianClears: ['unity-cup'], stocks: { [unityFr]: 9 }, bank: null, revision: 0, expectedRevision: 0, ...changes })

describe('material identities and CL spending', () => {
  it('generates 56 stable definitions, facets and exact ids, expanding through registry data', () => {
    const catalogue = puzzleMaterialCatalogue()
    expect(catalogue).toHaveLength(56)
    expect(new Set(catalogue.map(row => row.id)).size).toBe(56)
    expect(catalogue.slice(0, 4).map(row => row.style)).toEqual(['front', 'pace', 'late', 'end'])
    for (const row of catalogue) expect(parsePuzzleMaterialId(row.id)).toEqual({ scenarioId: row.scenarioId, style: row.style })
    const extended = [...SCENARIOS, { tier: 15, id: 'invented-meadow', name: 'Invented Meadow' }]
    expect(puzzleMaterialCatalogue(extended)).toHaveLength(60)
    expect(puzzleScenarioIdForTier(15, extended)).toBe('invented-meadow')
    expect(puzzleMaterialCatalogue(extended).slice(0, 56)).toEqual(catalogue)
    const gaps = [{ tier: 20, id: 'invented-a', name: 'A' }, { tier: 80, id: 'invented-b', name: 'B' }]
    expect(puzzleScenarioIdForTier(80, gaps)).toBe('invented-b')
    expect(puzzleMaterialCatalogue(gaps)[0]?.scenarioTier).toBe(20)
  })
  it('rejects unknown and ambiguous identities rather than parsing labels or prefixes', () => {
    for (const id of ['constellation:unknown:front', 'constellation:URA Finale:front', 'constellation:ura-finale:FR',
      'constellation:ura-finale:front:extra', TRAINING_LEVEL_UP_TICKET_ID, '__proto__', 'x'.repeat(121)]) expect(parsePuzzleMaterialId(id)).toBeNull()
    puzzleError(() => puzzleMaterialCatalogue([...SCENARIOS, SCENARIOS[0]!]), 'invalid')
    puzzleError(() => puzzleMaterialCatalogue([{ tier: 1, id: 'a:b', name: 'A' }]), 'invalid')
    puzzleError(() => puzzleScenarioIdForTier(99), 'unknown')
  })
  it('costs exactly 9 to go CL1→10 and never assigns nodes or invents CL9/10 nodes', () => {
    const input = spend(), before = JSON.stringify(input), result = resolvePuzzleClSpend(input)
    expect(result).toMatchObject({ before: 1, after: 10, debits: [{ itemId: fr, quantity: 9 }], revisionAfter: 4 })
    expect(result.stocksAfter[fr]).toBe(3)
    expect(JSON.stringify(input)).toBe(before)
    expect(previewPuzzleClSpend(input)).toEqual(result)
    expect(5 * result.debits[0]!.quantity).toBe(45)
    expect(6 * result.debits[0]!.quantity).toBe(54)
    expect(Object.keys(result)).not.toContain('assignments')
    for (const scenario of SCENARIOS) {
      expect(nodesUnlockedBetween(constellationTemplate(scenario.tier), 8, 10)).toEqual([])
      expect(baselineSkillPoints(scenario.tier, 10)).toBeGreaterThan(baselineSkillPoints(scenario.tier, 9))
    }
  })
  it('mixes original-A styles and preserved universals in one exact batch', () => {
    const result = resolvePuzzleClSpend(spend({ inputs: [{ itemId: fr, quantity: 3 }, { itemId: pc, quantity: 4 },
      { itemId: TRAINING_LEVEL_UP_TICKET_ID, quantity: 2 }] }))
    expect(result.after).toBe(10)
    expect(result.stocksAfter).toEqual({ [fr]: 9, [pc]: 1, [TRAINING_LEVEL_UP_TICKET_ID]: 8 })
    const dirt = syntheticPuzzleSource(['front'], true)
    puzzleError(() => resolvePuzzleClSpend(spend({ source: dirt, inputs: [{ itemId: pc, quantity: 1 }] })), 'invalid')
  })
  it('fails stale, locked, insufficient, overspend, no-A and malformed vectors atomically', () => {
    const cases: [Partial<PuzzleClSpendInput>, Parameters<typeof puzzleError>[1]][] = [
      [{ expectedRevision: 2 }, 'stale'], [{ unlockedScenarioIds: [] }, 'locked'], [{ stocks: { [fr]: 8 } }, 'insufficient'],
      [{ level: 10 }, 'invalid'], [{ level: 9, inputs: [{ itemId: fr, quantity: 2 }] }, 'invalid'],
      [{ source: syntheticPuzzleSource([]) }, 'locked'], [{ inputs: [] }, 'invalid'],
      [{ inputs: [{ itemId: fr, quantity: 0 }] }, 'invalid'], [{ inputs: [{ itemId: fr, quantity: 1.5 }] }, 'invalid'],
      [{ inputs: [{ itemId: fr, quantity: 1 }, { itemId: fr, quantity: 1 }] }, 'invalid'],
      [{ inputs: [{ itemId: unityFr, quantity: 1 }], stocks: { [unityFr]: 2 } }, 'invalid'],
      [{ stocks: { [fr]: -1 } }, 'invalid'], [{ stocks: JSON.parse('{"__proto__":9}') }, 'invalid'],
      [{ revision: Number.MAX_SAFE_INTEGER, expectedRevision: Number.MAX_SAFE_INTEGER }, 'overflow'],
    ]
    for (const [change, code] of cases) { const input = spend(change), before = JSON.stringify(input); puzzleError(() => resolvePuzzleClSpend(input), code); expect(JSON.stringify(input)).toBe(before) }
  })
})

describe('adjacent same-style exchange', () => {
  it('round-trips without debt and uses the same pure projection for preview', () => {
    const down = resolvePuzzleExchange(exchange()), up = resolvePuzzleExchange(exchange({ from: fr, to: unityFr,
      quantity: 2, stocks: down.stocksAfter, revision: 1, expectedRevision: 1 }))
    expect(down).toMatchObject({ gross: 2, debtPaid: 0, net: 2, irreversible: false })
    expect(up.stocksAfter[unityFr]).toBe(9)
    expect(up.stocksAfter[fr]).toBe(0)
    expect(previewPuzzleExchange(exchange())).toEqual(down)
  })
  it('intercepts only matching output debt, including irreversible full repayment', () => {
    const source = syntheticPuzzleSource(), cohort = freezePuzzleCohort('migration:one', [{ outfitId: source.templateId,
      scenarioId: 'ura-finale', level: 8, preferredStyle: 'front' }])
    const bank = preparePuzzleBank(cohort, new Map([[source.templateId, source]]))
    const full = resolvePuzzleExchange(exchange({ quantity: 3, bank }))
    expect(full).toMatchObject({ gross: 6, debtPaid: 6, net: 0, irreversible: true })
    expect(full.bankAfter?.balances[fr]).toBe(-1)
    expect(full.stocksAfter[fr]).toBe(0)
    const partial = resolvePuzzleExchange(exchange({ quantity: 6, bank }))
    expect(partial).toMatchObject({ gross: 12, debtPaid: 7, net: 5, irreversible: true })
    expect(bank.balances[fr]).toBe(-7)
    expect(partial.stocksAfter[fr]).toBe(5)
  })
  it('uses explicit registry order, not arithmetic tier adjacency', () => {
    const registry = [{ tier: 10, id: 'invented-a', name: 'A' }, { tier: 40, id: 'invented-b', name: 'B' }]
    const a = puzzleMaterialId('invented-a', 'front', registry), b = puzzleMaterialId('invented-b', 'front', registry)
    expect(resolvePuzzleExchange({ ...exchange(), from: b, to: a, stocks: { [b]: 1 }, openingGuardianClears: ['invented-b'] }, registry).net).toBe(2)
  })
  it('fails locked/nonadjacent/cross-style/odd/zero/insufficient/unsafe/stale exchanges without mutation', () => {
    const cases: [Partial<PuzzleExchangeInput>, Parameters<typeof puzzleError>[1]][] = [
      [{ openingGuardianClears: [] }, 'locked'], [{ from: trackFr }, 'invalid'], [{ to: pc }, 'invalid'],
      [{ from: fr, to: unityFr, quantity: 3, stocks: { [fr]: 3 } }, 'invalid'], [{ quantity: 0 }, 'invalid'],
      [{ quantity: 10 }, 'insufficient'], [{ expectedRevision: 1 }, 'stale'],
      [{ quantity: Number.MAX_SAFE_INTEGER, stocks: { [unityFr]: Number.MAX_SAFE_INTEGER } }, 'overflow'],
      [{ stocks: { [unityFr]: 1, [fr]: Number.MAX_SAFE_INTEGER } }, 'overflow'],
    ]
    for (const [changes, code] of cases) { const input = exchange(changes), before = JSON.stringify(input); puzzleError(() => resolvePuzzleExchange(input), code); expect(JSON.stringify(input)).toBe(before) }
  })
  it('conserves integer tier value through thirteen edges: one top-tier ticket is 8192 launch tickets', () => {
    let id = puzzleMaterialId(SCENARIOS[13]!.id, 'front'), stocks: Record<string, number> = { [id]: 1 }
    for (let i = 13; i > 0; i--) {
      const to = puzzleMaterialId(SCENARIOS[i - 1]!.id, 'front')
      stocks = resolvePuzzleExchange({ ...exchange(), from: id, to, quantity: stocks[id]!, stocks,
        openingGuardianClears: SCENARIOS.map(s => s.id) }).stocksAfter
      id = to
    }
    expect(stocks[fr]).toBe(8192)
    for (let i = 0; i < 13; i++) {
      const to = puzzleMaterialId(SCENARIOS[i + 1]!.id, 'front')
      stocks = resolvePuzzleExchange({ ...exchange(), from: id, to, quantity: stocks[id]!, stocks,
        openingGuardianClears: SCENARIOS.map(s => s.id) }).stocksAfter
      id = to
    }
    expect(stocks[id]).toBe(1)
  })
})
