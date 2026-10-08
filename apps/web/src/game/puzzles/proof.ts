// Explicit isolated proof adapter, never installed by runtime (docs/technical/uma-puzzles-implementation.md §5).
import type { PuzzleStoredEntity } from '@racer/domain'
import { RacerDb } from '../db'
import { PersistentPuzzleHost, type PuzzleHostOptions } from './host'

export async function createIsolatedPuzzleProof(name: string, rows: readonly PuzzleStoredEntity[],
  options: Omit<PuzzleHostOptions, 'database' | 'enabled'>) {
  if (!/^puzzle-proof-[a-zA-Z0-9_-]+$/.test(name)) throw new Error('Proof storage must have an explicit isolated name')
  const database = new RacerDb(name)
  await database.open()
  if ((await Promise.all(database.tables.map(table => table.count()))).some(count => count > 0)) {
    database.close(); throw new Error('A proof never overwrites an existing store')
  }
  try {
    await database.transaction('rw', [...new Set(rows.map(r => r.kind))].map(k => database.table(k)), async () => {
      for (const row of rows) await database.table(row.kind).add({ id: row.id, data: row.data, version: row.version })
    })
    return { database, host: new PersistentPuzzleHost({ ...options, database, enabled: true }),
      dispose: () => database.delete() }
  } catch (error) { await database.delete(); throw error }
}
