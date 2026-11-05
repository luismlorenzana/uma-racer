// The stage journal on this device (docs/game/07-stages.md §4, D384): Dexie's device-only `stageJournal`, one row per
// open play (`<kind>:<careerId>`), written on every move and again on pause, never synced or folded. A row that doesn't
// read as a play (a half-written one, an older shape) is dropped: its play starts again. The memory journal is the
// same port for the tests.
import { isStageKind, type Journal, type StageInput } from '@racer/domain/stages'
import type { RacerJournal, StoredJournal } from '../app/game'
import type { SaveDb } from './db'

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const isMove = (value: unknown): value is StageInput =>
  isObject(value) && Number.isSafeInteger(value.tick) && Number.isSafeInteger(value.code)

/** A row read back as a play, or null. */
export function readStoredJournal(value: unknown): StoredJournal | null {
  if (!isObject(value) || typeof value.id !== 'string' || !(value.careerId === null || typeof value.careerId === 'string')) return null
  const journal = value.journal
  if (!isObject(journal) || !Number.isSafeInteger(journal.version) || !Array.isArray(journal.inputs) || !journal.inputs.every(isMove)) return null
  const config = journal.config
  if (!isObject(config) || !isStageKind(config.kind) || !Number.isSafeInteger(config.seed) || typeof config.practice !== 'boolean') return null
  return { id: value.id, careerId: value.careerId, journal: journal as unknown as Journal }
}

export function dexieJournal(db: SaveDb): RacerJournal {
  return {
    async read(id) {
      const row = await db.stageJournal.get(id)
      if (row === undefined) return null
      const read = readStoredJournal(row)
      if (read === null) await db.stageJournal.delete(id)
      return read
    },
    async write(row) {
      await db.stageJournal.put({ id: row.id, careerId: row.careerId, journal: row.journal })
    },
    async clear(id) {
      await db.stageJournal.delete(id)
    },
  }
}

/** The same port in memory: what the tests and a port without a database use. */
export function memoryJournal(): RacerJournal & { readonly rows: Map<string, StoredJournal> } {
  const rows = new Map<string, StoredJournal>()
  const copy = (row: StoredJournal): StoredJournal => structuredClone(row)
  return {
    rows,
    read: async (id) => {
      const row = rows.get(id)
      return row === undefined ? null : readStoredJournal(copy(row))
    },
    write: async (row) => void rows.set(row.id, copy(row)),
    clear: async (id) => void rows.delete(id),
  }
}
