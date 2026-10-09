// One-time account Inspiration advance and signed repayment (docs/design/skills-and-inheritance.md, D256).
export const INSPIRATION_ADVANCE_SLOTS = 6
export const INSPIRATION_ADVANCE_SKILLS = 12
export interface InspirationBank {
  schemaVersion: 1
  phase: 'opening' | 'active'
  createdAt: number
  cohort: Record<string, { tiers: number[]; slotsBefore: number[]; goldsBefore: number[] }>
  opened: string[]
  balances: Record<string, number>
}
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)
const exact = (v: Record<string, unknown>, keys: string[]) => Object.keys(v).sort().join(',') === [...keys].sort().join(',')
const id = (v: unknown): v is string => typeof v === 'string' && /^[A-Za-z0-9_.:-]{1,120}$/.test(v) && !['__proto__', 'constructor', 'prototype'].includes(v)
const integer = (v: unknown, min: number, max: number): v is number => Number.isSafeInteger(v) && (v as number) >= min && (v as number) <= max
export function parseInspirationBank(value: unknown): InspirationBank | null {
  if (!record(value) || !exact(value, ['schemaVersion', 'phase', 'createdAt', 'cohort', 'opened', 'balances']) ||
    value.schemaVersion !== 1 || !['opening', 'active'].includes(value.phase as string) ||
    !integer(value.createdAt, 0, Number.MAX_SAFE_INTEGER) || !record(value.cohort) || !record(value.balances) ||
    !Array.isArray(value.opened) || !value.opened.every(id) || new Set(value.opened).size !== value.opened.length) return null
  const ids = Object.keys(value.cohort)
  // Transport bound, not a roster/progression cap. Compact rows remain below Firestore's document limit.
  if (!ids.length || ids.length > 1000 || !ids.every(id) || value.opened.some(k => !ids.includes(k))) return null
  const limits: Record<string, number> = {}
  for (const key of ids) {
    const row: unknown = value.cohort[key]
    if (!record(row) || !exact(row, ['tiers', 'slotsBefore', 'goldsBefore']) || !Array.isArray(row.tiers) ||
      !row.tiers.length || row.tiers.length > 14 || !row.tiers.every(t => integer(t, 1, 14)) ||
      new Set(row.tiers).size !== row.tiers.length || !Array.isArray(row.slotsBefore) || !Array.isArray(row.goldsBefore) ||
      row.slotsBefore.length !== row.tiers.length || row.goldsBefore.length !== row.tiers.length ||
      !row.slotsBefore.every(n => integer(n, 0, 6)) || !row.goldsBefore.every(n => integer(n, 0, 12))) return null
    const tiers: number[] = row.tiers as number[]
    for (const tier of tiers) for (const kind of ['slot', 'skill'] as const) {
      const token = `inspiration:t${tier}:${kind}`
      limits[token] = (limits[token] ?? 0) + (value.opened.includes(key) ? kind === 'slot' ? 6 : 12 : 0)
    }
  }
  if (!exact(value.balances, Object.keys(limits)) ||
    Object.entries(value.balances).some(([key, v]) => !integer(v, -limits[key]!, 0)) ||
    (value.phase === 'active') !== (value.opened.length === ids.length)) return null
  return value as unknown as InspirationBank
}
export function createInspirationBank(rows: { id: string; scenarios: { tier: number; inspiration: { slots: string[]; golds: string[] } }[] }[], now: number): InspirationBank {
  const cohort: InspirationBank['cohort'] = {}, balances: Record<string, number> = {}
  for (const row of rows) {
    cohort[row.id] = { tiers: row.scenarios.map(s => s.tier), slotsBefore: row.scenarios.map(s => s.inspiration.slots.length),
      goldsBefore: row.scenarios.map(s => s.inspiration.golds.length) }
    for (const s of row.scenarios) for (const kind of ['slot', 'skill']) balances[`inspiration:t${s.tier}:${kind}`] = 0
  }
  const bank: InspirationBank = { schemaVersion: 1, phase: 'opening', createdAt: now, cohort, balances, opened: [] }
  if (!parseInspirationBank(bank)) throw new Error('Invalid or empty Inspiration advance cohort')
  return bank
}
export function openBankOutfit(bank: InspirationBank, outfitId: string): InspirationBank {
  if (!bank.cohort[outfitId]) throw new Error('Outfit is outside the frozen Inspiration advance')
  if (bank.opened.includes(outfitId)) return bank
  const balances = { ...bank.balances }
  for (const tier of bank.cohort[outfitId]!.tiers) {
    const slot = `inspiration:t${tier}:slot`, skill = `inspiration:t${tier}:skill`
    balances[slot] = (balances[slot] ?? 0) - INSPIRATION_ADVANCE_SLOTS
    balances[skill] = (balances[skill] ?? 0) - INSPIRATION_ADVANCE_SKILLS
  }
  const opened = [...bank.opened, outfitId]
  return { ...bank, balances, opened, phase: opened.length === Object.keys(bank.cohort).length ? 'active' : 'opening' }
}
export interface InspirationAdvanceDebt { itemId: string; lent: number; owed: number; repaid: number }
/** Each token's advance: what the opened cohort was lent, what it still owes and what it has repaid (D256, D309). */
export function inspirationAdvanceDebts(bank: InspirationBank): InspirationAdvanceDebt[] {
  const lent: Record<string, number> = {}
  for (const id of bank.opened) for (const tier of bank.cohort[id]?.tiers ?? []) {
    lent[`inspiration:t${tier}:slot`] = (lent[`inspiration:t${tier}:slot`] ?? 0) + INSPIRATION_ADVANCE_SLOTS
    lent[`inspiration:t${tier}:skill`] = (lent[`inspiration:t${tier}:skill`] ?? 0) + INSPIRATION_ADVANCE_SKILLS
  }
  return Object.entries(lent).map(([itemId, total]) => {
    const owed = Math.max(0, -(bank.balances[itemId] ?? 0))
    return { itemId, lent: total, owed, repaid: total - owed }
  })
}
export function repayInspiration(bank: InspirationBank | null, itemId: string, gross: number): { bank: InspirationBank | null; debtPaid: number; net: number } {
  if (!Number.isSafeInteger(gross) || gross < 0) throw new Error('Invalid Inspiration reward')
  if (bank?.phase === 'opening') throw new Error('Resume the Inspiration advance before collecting tokens')
  const debtPaid = Math.min(gross, Math.max(0, -(bank?.balances[itemId] ?? 0)))
  return { debtPaid, net: gross - debtPaid, bank: bank && debtPaid
    ? { ...bank, balances: { ...bank.balances, [itemId]: bank.balances[itemId]! + debtPaid } } : bank }
}
