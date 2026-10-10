// D319: once the new Farm is active, the old Farm's Produce stacks are cleared. Nothing in the new Farm uses them, and
// the owner asked for every old Farm item to go. Ordinary sync cannot delete a row, so each stack falls to zero (every
// Items view hides empty stacks); the API accepts that one change to a retired stack and nothing else.
import { parseFarmCutoverControl } from '@racer/domain/farm/kitchen'
import type { RacerDb } from '../../db'

/** Zeroes every old Produce stack once the new Farm is active and no Farm command is pending; returns the cleared ids. */
export async function clearLegacyProduce(db: RacerDb, now = Date.now()): Promise<string[]> {
  return db.transaction('rw', [db.items, db.farmCutover, db.farmPending, db.outbox], async () => {
    const control = parseFarmCutoverControl((await db.farmCutover.get('main'))?.data)
    // A pending Farm command (a legacy claim) may still expect the stack it pays into; wait for it to settle.
    if (control?.phase !== 'active' || await db.farmPending.count()) return []
    const cleared: string[] = []
    for (const row of await db.items.where('id').startsWith('produce:').toArray()) {
      if (!(row.data.quantity > 0)) continue
      await db.items.put({ ...row, data: { ...row.data, quantity: 0, updatedAt: now } })
      await db.outbox.where('[kind+id]').equals(['items', row.id]).delete()
      await db.outbox.add({ kind: 'items', id: row.id, op: 'upsert', queuedAt: now })
      cleared.push(row.id)
    }
    return cleared
  })
}
