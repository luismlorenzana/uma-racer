// View-only ticket eligibility; authorization always remains in the host transaction (Uma Puzzles §7).
import { SCENARIOS, TRAINING_LEVEL_UP_TICKET_ID, eligiblePuzzleStyles, puzzleMaterialCatalogue, type PuzzleMaterialInput, type PuzzleSourceV1 } from '@racer/domain'

export function clTicketRows(source: PuzzleSourceV1, scenarioId: string, stocks: Readonly<Record<string, number>>) {
  const styles = eligiblePuzzleStyles(source)
  return puzzleMaterialCatalogue().filter(m => m.scenarioId === scenarioId || (stocks[m.id] ?? 0) > 0).map(m => ({ ...m,
    owned: stocks[m.id] ?? 0, eligible: m.scenarioId === scenarioId && styles.includes(m.style),
    reason: m.scenarioId !== scenarioId ? 'Different racing scenario' : styles.includes(m.style) ? null : 'Original running-style aptitude is not A',
  }))
}
export function clSpendVector(counts: Readonly<Record<string, string>>, rows: ReturnType<typeof clTicketRows>, universal: number, remaining: number): PuzzleMaterialInput[] | null {
  const result: PuzzleMaterialInput[] = []
  for (const [itemId, raw] of Object.entries(counts)) {
    if (raw === '' || raw === '0') continue
    if (!/^[1-9][0-9]*$/.test(raw)) return null
    const quantity = Number(raw), row = rows.find(r => r.id === itemId)
    const stock = itemId === TRAINING_LEVEL_UP_TICKET_ID ? universal : row?.eligible ? row.owned : 0
    if (!Number.isSafeInteger(quantity) || quantity > stock) return null
    result.push({ itemId: itemId as PuzzleMaterialInput['itemId'], quantity })
  }
  const total = result.reduce((n, r) => n + r.quantity, 0)
  return total > 0 && total <= remaining && Number.isSafeInteger(total) ? result : null
}
export function exchangeBatch(raw: string, down: boolean): number | null {
  if (!/^[1-9][0-9]*$/.test(raw)) return null
  const quantity = Number(raw) * (down ? 1 : 2)
  return Number.isSafeInteger(quantity) ? quantity : null
}
export function clScenario(tier: number) { return SCENARIOS.find(s => s.tier === tier) }
