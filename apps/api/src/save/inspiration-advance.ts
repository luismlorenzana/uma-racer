// Protected, resumable account cutover. Never changes presets (docs/design/skills-and-inheritance.md, D256).
import { createInspirationBank, openBankOutfit, parseInspirationBank, type InspirationBank } from './inspiration-bank'
import { parseEntityData, type EntityRecord } from './save.types'

export const BANK_KEY = 'inspirationBank/main'
const slots = ['parent0', 'parent1', 'parent0-gp0', 'parent0-gp1', 'parent1-gp0', 'parent1-gp1']
export function freezeAdvance(rows: EntityRecord[], now: number): EntityRecord | null {
  const owned = rows.filter(r => r.kind === 'umas' && !r.deleted)
  if (!owned.length) return null
  const cohort = owned.map(r => {
    if (![15, 16].includes(r.data.schemaVersion as number) || r.data.templateId !== r.id || !parseEntityData('umas', r.data)) throw new Error('Sync all owned outfits to the current save before advancing Inspiration')
    return { id: r.id, scenarios: r.data.scenarios as { tier: number; inspiration: { slots: string[]; golds: string[] } }[] }
  })
  return { kind: 'inspirationBank', id: 'main', version: 1, deleted: false, updatedAt: now,
    data: createInspirationBank(cohort, now) as unknown as Record<string, unknown> }
}
export function bankData(row: EntityRecord): InspirationBank {
  const bank = !row.deleted && parseInspirationBank(row.data)
  if (!bank) throw new Error('Inspiration bank is invalid; no unlocks or rewards changed')
  return bank
}
export function advanceOutfit(bankRow: EntityRecord, uma: EntityRecord | undefined, id: string, now: number): EntityRecord[] {
  const bank = bankData(bankRow)
  if (bank.opened.includes(id)) return []
  if (!uma || uma.deleted || uma.kind !== 'umas' || uma.id !== id || ![15, 16].includes(uma.data.schemaVersion as number) || !parseEntityData('umas', uma.data)) {
    throw new Error('Frozen Inspiration outfit unavailable; resume after syncing its current save')
  }
  const tiers = bank.cohort[id]?.tiers
  const runs = uma.data.scenarios as Record<string, unknown>[]
  if (!tiers || tiers.some(t => !runs.some(s => s.tier === t))) throw new Error('Frozen Inspiration scenario unavailable')
  const data = { ...uma.data, scenarios: runs.map(run => tiers.includes(run.tier as number)
    ? { ...run, inspiration: { slots: [...slots], golds: slots.flatMap(s => [0, 1].map(i => `${s}:gold${i}`)) } } : run) }
  return [{ ...uma, version: uma.version + 1, data, updatedAt: now },
    { ...bankRow, version: bankRow.version + 1, data: openBankOutfit(bank, id) as unknown as Record<string, unknown>, updatedAt: now }]
}
