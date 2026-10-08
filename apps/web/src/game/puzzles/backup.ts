// Device-only whole-account recovery evidence before protected cutover; never uploaded (implementation §8).
import { parseSaveSnapshotOrThrow, type SaveSnapshot } from '@racer/domain'
import type { RacerDb, MinigameRunRow } from '../db'
export const PUZZLE_BACKUP_ID = 'puzzle-preservation-backup-v1'
export interface PuzzleBackup {
  schemaVersion: 1; stage: 'pre-cutover' | 'already-preparing'; snapshot: SaveSnapshot; minigameRuns: MinigameRunRow[]
}
export function parsePuzzleBackup(value: unknown): PuzzleBackup {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Keep the preservation backup for recovery')
  const v = value as Record<string, unknown>
  if (Object.keys(v).sort().join() !== 'minigameRuns,schemaVersion,snapshot,stage' || v.schemaVersion !== 1 ||
    !['pre-cutover', 'already-preparing'].includes(v.stage as string) || !Array.isArray(v.minigameRuns)) throw new Error('Preservation backup is malformed; keep it for recovery')
  return { schemaVersion: 1, stage: v.stage as PuzzleBackup['stage'], snapshot: parseSaveSnapshotOrThrow(v.snapshot), minigameRuns: structuredClone(v.minigameRuns) as MinigameRunRow[] }
}
/** A failed fetch/write, new outgoing mutation or identity change prevents all cutover requests. */
export async function retainPuzzleBackup(database: RacerDb, snapshot: () => Promise<unknown>, current: () => boolean): Promise<boolean> {
  const profile = await database.profile.get('main')
  const sameAccount = (backup: PuzzleBackup) => {
    const saved = backup.snapshot.entities.find(r => r.kind === 'profile' && r.id === 'main')
    if (!profile || !saved || saved.data.createdAt !== profile.data.createdAt) throw new Error('Backup account identity changed; keep the original copy for recovery')
  }
  const prior = await database.puzzleArchives.get(PUZZLE_BACKUP_ID)
  if (prior) { sameAccount(parsePuzzleBackup(prior.data)); return current() }
  const canonical = parseSaveSnapshotOrThrow(await snapshot())
  if (!current()) return false
  const sourceProfile = canonical.entities.find(r => r.kind === 'profile' && r.id === 'main')
  if (!profile || !sourceProfile || profile.data.createdAt !== sourceProfile.data.createdAt) throw new Error('Backup account identity changed; sync before preparing')
  return database.transaction('rw', [database.profile, database.outbox, database.pendingRpgCommands, database.pendingPuzzleOperations, database.puzzleArchives, database.minigameRuns], async () => {
    if (!current()) return false
    if (await database.outbox.count() || await database.pendingRpgCommands.count() || await database.pendingPuzzleOperations.count() ||
      JSON.stringify(await database.profile.get('main')) !== JSON.stringify(profile)) throw new Error('New progress arrived while backing up; sync and retry safely')
    const existing = await database.puzzleArchives.get(PUZZLE_BACKUP_ID)
    if (existing) { sameAccount(parsePuzzleBackup(existing.data)); return true }
    const backup: PuzzleBackup = { schemaVersion: 1, stage: canonical.entities.some(r => r.kind === 'constellationBank') ? 'already-preparing' : 'pre-cutover',
      snapshot: canonical, minigameRuns: await database.minigameRuns.toArray() }
    await database.puzzleArchives.add({ id: PUZZLE_BACKUP_ID, reason: 'Whole-account preservation recovery backup; never partially restore', data: backup, createdAt: Date.now() })
    return true
  })
}
export async function downloadPuzzleBackup(database: RacerDb): Promise<void> {
  const row = await database.puzzleArchives.get(PUZZLE_BACKUP_ID)
  if (!row) throw new Error('No backup on this device. Use the device that first prepared Uma Puzzles.')
  const backup = parsePuzzleBackup(row.data), url = URL.createObjectURL(new Blob([JSON.stringify(backup)], { type: 'application/json' }))
  const link = document.createElement('a'); link.href = url; link.download = 'uma-racer-private-pre-puzzles-backup.json'
  try { document.body.append(link); link.click() } finally { link.remove(); setTimeout(() => URL.revokeObjectURL(url), 60_000) }
}
