// Acknowledged one-time account advance, isolated from ordinary edits (D256).
import { parseInspirationBank, parseSaveSnapshotOrThrow, parseUmaSave, type UmaSave } from '@racer/domain'
import { create } from 'zustand'
import { saveApi } from '../api/client'
import { db, type RacerDb } from './db'

export const useInspirationAdvanceStatus = create<{ busy: boolean; error: string | null }>(() => ({ busy: false, error: null }))

export async function advanceInspirationOnce(database: RacerDb = db, transport: Pick<typeof saveApi, 'advanceInspiration'> = saveApi,
  current: () => boolean = () => true): Promise<boolean> {
  if (!current() || (typeof navigator !== 'undefined' && !navigator.onLine) || useInspirationAdvanceStatus.getState().busy) return false
  if ((await database.inspirationBank.get('main'))?.data.phase === 'active' || !await database.umas.count() ||
    await database.outbox.count() || await database.pendingRpgCommands.count()) return false
  useInspirationAdvanceStatus.setState({ busy: true, error: null })
  try {
    const snapshot = parseSaveSnapshotOrThrow(await transport.advanceInspiration())
    if (!current()) return false
    if (!snapshot.entities.length) return false
    const bankRow = snapshot.entities.find(e => e.kind === 'inspirationBank' && e.id === 'main' && !e.deleted)
    const bank = bankRow && parseInspirationBank(bankRow.data)
    if (!bank || !bankRow) throw new Error('Advance acknowledgement has no valid bank')
    if (bank.phase !== 'active' || snapshot.entities.some(e => e.kind !== 'inspirationBank' && e.kind !== 'umas') ||
      Object.entries(bank.cohort).some(([id, cohort]) => {
        const record = snapshot.entities.find(e => e.kind === 'umas' && e.id === id && !e.deleted)
        const uma = record && parseUmaSave(record.data)
        return !uma || cohort.tiers.some(t => {
          const state = uma.scenarios.find(s => s.tier === t)?.inspiration
          return !state || state.slots.length !== 6 || state.golds.length !== 12
        })
      })) throw new Error('Advance acknowledgement is incomplete; sync to resume safely')
    await database.transaction('rw', [database.inspirationBank, database.umas, database.outbox], async () => {
      if (!current()) return
      const localBank = await database.inspirationBank.get('main')
      if (localBank && localBank.version > bankRow.version) return
      for (const row of snapshot.entities.filter(e => e.kind === 'umas')) {
        const uma = parseUmaSave(row.data)
        if (!uma || row.deleted || !bank.cohort[row.id]) throw new Error('Invalid advanced outfit acknowledgement')
        const local = await database.umas.get(row.id)
        if (local && local.version > row.version) continue
        const queued = await database.outbox.where('[kind+id]').equals(['umas', row.id]).count()
        // A new edit during the request survives. Only permanent unlocks are merged into it.
        const data: UmaSave = queued && local ? { ...local.data, scenarios: local.data.scenarios.map(unit => {
          const opened = uma.scenarios.find(s => s.tier === unit.tier)?.inspiration
          return opened ? { ...unit, inspiration: { slots: [...new Set([...unit.inspiration.slots, ...opened.slots])],
            golds: [...new Set([...unit.inspiration.golds, ...opened.golds])] } } : unit
        }) } : uma
        await database.umas.put({ id: row.id, version: row.version, data })
      }
      await database.inspirationBank.put({ id: 'main', version: bankRow.version, data: bank })
    })
    return current()
  } catch (error) {
    if (current()) useInspirationAdvanceStatus.setState({ error: error instanceof Error ? error.message : String(error) })
    return false
  } finally { useInspirationAdvanceStatus.setState({ busy: false }) }
}
