// Private whole-account evidence, separate from Puzzle backups. No automatic restore; technical §6.
import { parseSaveSnapshotOrThrow, ENTITY_KINDS, LOG_KINDS, type SaveSnapshot } from '@racer/domain'
import { FARM_CUTOVER_LIMITS, farmCanonical, farmBytes, farmCutoverSource, farmArchiveDigest, farmRecord,
  type FarmArchiveProof } from '@racer/domain/farm/kitchen'
import type { RacerDb } from '../../db'
export const FARM_ARCHIVE_REASON = 'farm-cutover-archive'
/** Local databases whose tables an archive can hold: v33 (D310) only rewrites RPG rows, no table shapes. */
export const FARM_ARCHIVE_DATABASE_VERSIONS: readonly number[] = [32, 33]
export interface FarmRecoveryArchive {
  schemaVersion: 1; accountId: string; profileCreatedAt: number; build: string; databaseVersion: number; createdAt: number;
  /** Raw canonical rows are retained, even when their supported reader normalizes a legacy schema. */
  snapshot: SaveSnapshot; localTables: Record<string, unknown[]>; digest: string
}
export async function farmSha256(value: unknown): Promise<string> {
  const bytes = new TextEncoder().encode(farmCanonical(value))
  return [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(v => v.toString(16).padStart(2, '0')).join('')
}
const body = (a: FarmRecoveryArchive) => { const { digest: _digest, ...rest } = a; return rest }
export async function verifyFarmArchive(raw: unknown, accountId: string, profileCreatedAt: number): Promise<FarmRecoveryArchive> {
  if (!farmRecord(raw) || Object.keys(raw).sort().join() !== 'accountId,build,createdAt,databaseVersion,digest,localTables,profileCreatedAt,schemaVersion,snapshot' ||
    raw.schemaVersion !== 1 || raw.accountId !== accountId || raw.profileCreatedAt !== profileCreatedAt ||
    typeof raw.build !== 'string' || !raw.build.length || raw.build.length > 128 || !FARM_ARCHIVE_DATABASE_VERSIONS.includes(raw.databaseVersion as number) ||
    !Number.isSafeInteger(raw.createdAt) || Number(raw.createdAt) < 0 || !farmArchiveDigest(raw.digest) ||
    !farmRecord(raw.localTables) || Object.values(raw.localTables).some(v => !Array.isArray(v)) || farmBytes(raw) > FARM_CUTOVER_LIMITS.archiveBytes)
    throw new Error('Farm archive identity/schema/size is invalid; keep it for Export, never reset')
  const archive = raw as unknown as FarmRecoveryArchive, snapshot = parseSaveSnapshotOrThrow(archive.snapshot)
  // Inspect supported local save schemas as well as cloud rows. Opaque device journals are retained, never interpreted or removed.
  const localSnapshot = { entities: ENTITY_KINDS.flatMap(kind => (archive.localTables[kind] ?? []).map(row => {
    if (!farmRecord(row)) throw new Error('Malformed local Farm recovery row')
    return { kind, id: row.id, version: row.version, data: row.data, deleted: row.deleted ?? false, updatedAt: row.updatedAt ?? 0 }
  })), logs: LOG_KINDS.flatMap(kind => (archive.localTables[kind] ?? []).map(row => {
    if (!farmRecord(row)) throw new Error('Malformed local Farm recovery evidence')
    return { kind, ...row }
  })), serverTime: archive.createdAt }
  parseSaveSnapshotOrThrow(localSnapshot)
  if (snapshot.entities.find(r => r.kind === 'profile' && r.id === 'main')?.data.createdAt !== profileCreatedAt ||
    await farmSha256(body(archive)) !== archive.digest || await farmSha256(body(JSON.parse(JSON.stringify(archive)) as FarmRecoveryArchive)) !== archive.digest)
    throw new Error('Farm archive digest/account/export mismatch; migration blocked')
  // Exportability is checked before an archive can authorize preparation, not just when Export is tapped.
  new Blob([JSON.stringify(archive)], { type: 'application/json' })
  return structuredClone(archive)
}
export async function farmArchiveProof(archive: FarmRecoveryArchive): Promise<FarmArchiveProof> {
  const snapshot = parseSaveSnapshotOrThrow(archive.snapshot)
  return { accountId: archive.accountId, profileCreatedAt: archive.profileCreatedAt, archiveDigest: archive.digest,
    sourceDigest: await farmSha256(farmCutoverSource(archive.accountId,
      new Map(snapshot.entities.map(r => [`${r.kind}/${r.id}`, r])), new Map(snapshot.logs.map(r => [`${r.kind}/${r.id}`, r])))) }
}
async function captureLocal(database: RacerDb): Promise<Record<string, unknown[]>> {
  const rows: Record<string, unknown[]> = {}
  for (const table of database.tables) rows[table.name] = table.name === 'farmRecovery'
    ? await database.farmRecovery.filter(r => r.reason !== FARM_ARCHIVE_REASON).toArray() : await table.toArray()
  return rows
}
export async function retainFarmArchive(database: RacerDb, rawSnapshot: unknown, accountId: string, build: string,
  current: () => boolean, now: number, afterWrite: () => void = () => {}): Promise<{ id: string; archive: FarmRecoveryArchive }> {
  const snapshot = parseSaveSnapshotOrThrow(rawSnapshot), profileCreatedAt = Number(snapshot.entities.find(r => r.kind === 'profile' && r.id === 'main')?.data.createdAt)
  if (!Number.isSafeInteger(profileCreatedAt) || !current()) throw new Error('Farm account changed while backing up; retry safely')
  const localTables = await database.transaction('r', database.tables, async () => {
    if ((await database.profile.get('main'))?.data.createdAt !== profileCreatedAt) throw new Error('Sync this account before Farm backup')
    return captureLocal(database)
  })
  const unsigned = { schemaVersion: 1 as const, accountId, profileCreatedAt, build, databaseVersion: database.verno, createdAt: now,
    snapshot: structuredClone(rawSnapshot) as SaveSnapshot, localTables }
  if (farmBytes(unsigned) > FARM_CUTOVER_LIMITS.archiveBytes) throw new Error('Farm archive exceeds 64 MiB; export/recover before migration')
  const archive = await verifyFarmArchive({ ...unsigned, digest: await farmSha256(unsigned) }, accountId, profileCreatedAt), id = `farm-archive:${archive.digest}`
  await database.transaction('rw', database.tables, async () => {
    if (!current() || farmCanonical(await captureLocal(database)) !== farmCanonical(localTables))
      throw new Error('New progress arrived while archiving; sync and retry, no reset was requested')
    const old = await database.farmRecovery.get(id)
    if (old && farmCanonical(old.data) !== farmCanonical(archive)) throw new Error('Farm archive identity collision; export and recover')
    if (!old) await database.farmRecovery.add({ id, reason: FARM_ARCHIVE_REASON, data: archive, createdAt: now })
    afterWrite()
  })
  const stored = await database.farmRecovery.get(id)
  if (!stored) throw new Error('Farm archive readback failed; preparation blocked')
  const verified = await verifyFarmArchive(stored.data, accountId, profileCreatedAt)
  if (verified.digest !== archive.digest || !current()) throw new Error('Farm archive changed during readback; preparation blocked')
  return { id, archive: verified }
}
export async function exportFarmArchive(database: RacerDb, id: string, accountId: string, profileCreatedAt: number): Promise<void> {
  const row = await database.farmRecovery.get(id)
  if (!row || row.reason !== FARM_ARCHIVE_REASON) throw new Error('Use the device that captured this Farm archive')
  const archive = await verifyFarmArchive(row.data, accountId, profileCreatedAt)
  const url = URL.createObjectURL(new Blob([JSON.stringify(archive)], { type: 'application/json' })), link = document.createElement('a')
  link.href = url; link.download = `uma-racer-private-farm-${archive.digest.slice(0, 12)}.json`
  try { document.body.append(link); link.click() } finally { link.remove(); setTimeout(() => URL.revokeObjectURL(url), 60_000) }
}
