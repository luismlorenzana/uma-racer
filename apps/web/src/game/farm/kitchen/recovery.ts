// Explicit private device export, including unresolved intents. No restoration, network or progress writes.
import { farmBytes, FARM_CUTOVER_LIMITS } from '@racer/domain/farm/kitchen'
import type { RacerDb } from '../../db'
export async function exportFarmDeviceRecovery(db: RacerDb, accountId: string, build: string,
  download: (blob: Blob, filename: string) => Promise<void> = async (blob, filename) => {
    const url = URL.createObjectURL(blob), link = document.createElement('a')
    link.href = url; link.download = filename
    try { document.body.append(link); link.click() } finally { link.remove(); setTimeout(() => URL.revokeObjectURL(url), 60000) }
  }): Promise<void> {
  const rows = await db.transaction('r', db.tables, async () => {
    const tables: Record<string, unknown[]> = {}
    for (const table of db.tables) tables[table.name] = await table.toArray()
    return tables
  })
  // Opaque rows are retained even for corrupt/future schemas; this export cannot authorize cutover.
  const recovery = { format: 'uma-racer-farm-device-recovery-v1', accountId, build, databaseVersion: db.verno, localTables: rows }
  if (farmBytes(recovery) > FARM_CUTOVER_LIMITS.archiveBytes) throw new Error('Recovery exceeds the private export limit; keep this device and request forward recovery')
  await download(new Blob([JSON.stringify(recovery)], { type: 'application/json' }), 'uma-racer-private-farm-recovery.json')
}
