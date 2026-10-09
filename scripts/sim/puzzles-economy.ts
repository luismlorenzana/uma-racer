// Exact accepted-win projections, not phone-time income (design §11).
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { SCENARIOS } from '../../packages/domain/src/scenarios'
import { STRATEGIES, type Strategy } from '../../packages/domain/src/types'
import { addPuzzleExp, puzzleWinExp } from '../../packages/domain/src/minigames/uma-puzzles/progression'
import { freezePuzzleCohort, preparePuzzleBank, repayPuzzleMaterial } from '../../packages/domain/src/minigames/uma-puzzles/bank'
import { resolvePuzzleLegacyCredit } from '../../packages/domain/src/minigames/uma-puzzles/legacy'
import { puzzleMaterialId, resolvePuzzleExchange } from '../../packages/domain/src/minigames/uma-puzzles/materials'
import { puzzleChapter } from '../../packages/domain/src/minigames/uma-puzzles/campaign/chapters'
import { puzzleEncounterRewards } from '../../packages/domain/src/minigames/uma-puzzles/campaign/encounters'
import { puzzleEmptyStyleStock, planPuzzleTargetedWins } from '../../packages/domain/src/minigames/uma-puzzles/campaign/allocation'
import { syntheticPuzzleEntrants } from '../../packages/domain/src/minigames/uma-puzzles/campaign/fixtures'
import type { PuzzleMapNode } from '../../packages/domain/src/minigames/uma-puzzles/campaign/types'
import { PUZZLE_CAMPAIGN_ROUTE_ENVELOPE } from './puzzles-campaign-envelope'

const gross = (nodes: PuzzleMapNode[], dark: 'pace' | 'late' = 'late') => {
  const stock = puzzleEmptyStyleStock()
  for (const node of nodes) for (const r of puzzleEncounterRewards(node, node.localId === 'c-dark' ? dark : null)) stock[r.style] += r.quantity
  return stock
}
const total = (stock: ReturnType<typeof gross>) => STRATEGIES.reduce((n, s) => n + stock[s], 0)
export function runPuzzleEconomy() {
  console.log('Economy: accepted win projections, no claim about live win rates or rewards/minute.')
  // D301: one stage line per chapter. A clear is the whole line plus one Champion (84); a full clear is all 26 (132).
  const routeEnvelope = SCENARIOS.map(s => {
    const chapter = puzzleChapter(s.id), vectors = new Set<string>(), line = chapter.nodes.filter(n => n.kind !== 'champion')
    assert.equal(line.filter(n => n.kind === 'ordinary').length, 18)
    for (const champion of chapter.nodes.filter(n => n.kind === 'champion'))
      for (const dark of champion.localId === 'c-dark' ? ['pace', 'late'] as const : ['late'] as const) {
        const stock = gross([...line, champion], dark)
        assert.equal(total(stock), 84); vectors.add(STRATEGIES.map(style => stock[style]).join('/'))
      }
    const full = gross(chapter.nodes); assert.equal(total(full), 132)
    const vectorHash = createHash('sha256').update([...vectors].sort().join(',')).digest('hex').slice(0, 16)
    console.log(`${s.id}: line + one Champion ×84 in ${vectors.size} exact vectors; full clear FR/PC/LS/EC ${STRATEGIES.map(style => full[style]).join('/')} =132`)
    return { scenario: s.id, variants: vectors.size, full, vectorHash }
  })
  assert.deepEqual(routeEnvelope, PUZZLE_CAMPAIGN_ROUTE_ENVELOPE, 'Exact route/style-vector drift')
  const source = syntheticPuzzleEntrants(1)[0]!.source, levels = Array.from({ length: 5 }, () => ({ level: 1, exp: 0 }))
  const progression = SCENARIOS.slice(0, 2).map(s => {
    const before = levels.map(p => ({ ...p })), chapter = puzzleChapter(s.id)
    // Every node in order, as the owner plays (D301).
    for (const node of chapter.nodes)
      levels.forEach((p, i) => { levels[i] = addPuzzleExp(source, p, puzzleWinExp(node.level, p.level, node.kind)).after })
    console.log(`${s.id}: five members ${JSON.stringify(before)} → ${JSON.stringify(levels)}`)
    return levels.map(p => ({ ...p }))
  })
  assert.deepEqual(progression.map(p => p[0]), [{ level: 11, exp: 182 }, { level: 22, exp: 34 }])
  const catchup = [7, 10, 13, 17, 22].map(level => ({ level, exp: 0 }))
  const catchupBefore = catchup.map(p => ({ ...p }))
  for (const s of SCENARIOS.slice(1, 3)) {
    for (const node of puzzleChapter(s.id).nodes)
      catchup.forEach((p, i) => { catchup[i] = addPuzzleExp(source, p, puzzleWinExp(node.level, p.level, node.kind)).after })
    console.log(`${s.id} catch-up: ${JSON.stringify(catchupBefore)} → ${JSON.stringify(catchup)}`)
  }
  assert(catchup[0]!.level > catchupBefore[0]!.level); assert(catchup[4]!.level >= catchupBefore[4]!.level)
  assert(catchup[4]!.level - catchup[0]!.level < catchupBefore[4]!.level - catchupBefore[0]!.level)
  assert.deepEqual(catchup, [{ level: 31, exp: 355 }, { level: 31, exp: 397 }, { level: 32, exp: 106 }, { level: 32, exp: 201 }, { level: 33, exp: 31 }])
  for (const level of [7, 10, 13]) console.log(`PL${level} vs champion10: ${puzzleWinExp(10, level, 'champion')} EXP per entrant; repeat win12 once-account`)
  assert(puzzleWinExp(10, 7, 'champion') > puzzleWinExp(10, 10, 'champion'))
  assert(puzzleWinExp(10, 13, 'champion') < puzzleWinExp(10, 10, 'champion'))
  const first = puzzleChapter(SCENARIOS[0]!.id), stock = gross(first.nodes.filter(n => n.kind !== 'champion' || n.localId === 'c-fire'))
  const groups: [string, Strategy[][]][] = [
    ['mixed-five', [['front'], ['pace'], ['late'], ['end'], ['pace', 'late']]],
    ['mixed-six', [['front'], ['front'], ['pace'], ['late'], ['end'], ['pace', 'late']]],
    ...STRATEGIES.map(style => [`pure-${style}`, Array.from({ length: 6 }, () => [style])] as [string, Strategy[][]]),
  ]
  const allocations = groups.map(([name, styles]) => {
    const plan = planPuzzleTargetedWins(stock, styles.map((eligible, i) => ({ id: `invented-recipient-${i}`, eligible, needed: 9 })))
    assert.equal(plan.final.missing, 0); assert.equal(plan.initial.usable + total(plan.initial.stranded), 84)
    console.log(`${name}: stock ${JSON.stringify(stock)}; usable ${plan.initial.usable}, stranded ${JSON.stringify(plan.initial.stranded)}; extra bosses ${plan.extraWins} ${JSON.stringify(plan.wins)}`)
    return { name, usable: plan.initial.usable, extraWins: plan.extraWins, wins: plan.wins }
  })
  assert.deepEqual(allocations.map(a => [a.name, a.usable, a.extraWins, a.wins]), [
    ['mixed-five',45,0,{front:0,pace:0,late:0,end:0}], ['mixed-six',54,0,{front:0,pace:0,late:0,end:0}],
    ['pure-front',30,2,{front:2,pace:0,late:0,end:0}], ['pure-pace',9,4,{front:0,pace:4,late:0,end:0}],
    ['pure-late',33,2,{front:0,pace:0,late:2,end:0}], ['pure-end',12,4,{front:0,pace:0,late:0,end:4}],
  ])
  const id = puzzleMaterialId(first.scenarioId, 'front'), unit = { outfitId: source.templateId, scenarioId: first.scenarioId, level: 8, preferredStyle: 'front' as const }
  const bank = preparePuzzleBank(freezePuzzleCohort('invented-bank', [unit]), new Map([[source.templateId, source]]))
  for (const amount of [6, 7, 12]) {
    const payment = repayPuzzleMaterial(bank, id, amount)
    assert.equal(payment.debtPaid, Math.min(7, amount)); assert.equal(payment.net, Math.max(0, amount - 7))
    console.log(`Debt -7 / gross${amount}: ${payment.debtPaid} repaid / ${payment.net} deposited / balance${payment.bankAfter!.balances[id]}`)
  }
  const preserved = resolvePuzzleLegacyCredit('invented-credit', { preservedStock: 3, accountExp: 1251, units: [] })
  assert.equal(preserved.stockAfter, 5); assert.equal(bank.balances[id], -7)
  console.log('Legacy credit bypass: universal3 + rounded1251 EXP=5; matching debt stays-7.')
  let stocks: Record<string, number> = { [puzzleMaterialId(SCENARIOS.at(-1)!.id, 'front')]: 1 }
  const open = SCENARIOS.slice(1).map(s => s.id)
  for (let i = SCENARIOS.length - 1; i > 0; i--) {
    const from = puzzleMaterialId(SCENARIOS[i]!.id, 'front'), to = puzzleMaterialId(SCENARIOS[i - 1]!.id, 'front')
    const input = { from, to, quantity: stocks[from]!, stocks, bank: null, revision: 0, expectedRevision: 0, openingGuardianClears: open }
    assert.throws(() => resolvePuzzleExchange({ ...input, openingGuardianClears: open.filter(s => s !== SCENARIOS[i]!.id) }))
    stocks = resolvePuzzleExchange(input).stocksAfter
    assert.equal(stocks[to], 2 ** (SCENARIOS.length - i))
    assert.equal(resolvePuzzleExchange({ ...input, from: to, to: from, quantity: stocks[to]!, stocks }).gross, stocks[to]! / 2)
    console.log(`Edge ${SCENARIOS[i]!.id} → ${SCENARIOS[i - 1]!.id}: ${stocks[to]}; missing higher Opening clear rejects.`)
  }
  assert.equal(stocks[puzzleMaterialId(first.scenarioId, 'front')], 8192)
  console.log('Route/style regression:', JSON.stringify(routeEnvelope)); console.log('Catch-up regression:', JSON.stringify(catchup))
  console.log('PASS:14 chapter lines (84 per clear, 132 per full clear), two-chapter EXP, restricted allocation, debt and13 edges.')
  return { routeEnvelope, progression, allocations }
}
