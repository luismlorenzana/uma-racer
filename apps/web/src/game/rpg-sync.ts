// Device-local RPG command queue and acknowledged projection install (docs/technical/uma-rpg-implementation.md, T090).
import { parseRpgCommandResponseOrThrow, parseSaveSnapshotOrThrow,
  type EntityRecord, type LogRecord, type RpgCommandRequest, type RpgCommandResponse } from '@racer/domain'
import { saveApi } from '../api/client'
import { db } from './db'

export async function enqueueRpgCommand(body: RpgCommandRequest, now: number, dependsOn: string | null = null): Promise<void> {
  if (body.schemaVersion !== 1 || !/^[A-Za-z0-9_.:-]{1,120}$/.test(body.commandId) ||
    !Number.isSafeInteger(now) || now < 0) throw new Error('Invalid RPG command queue entry')
  const existing = await db.pendingRpgCommands.get(body.commandId)
  if (existing) {
    if (JSON.stringify(existing.body) !== JSON.stringify(body) || (existing.dependsOn ?? null) !== dependsOn) {
      throw new Error('RPG command id already queued with another payload or dependency')
    }
    return
  }
  await db.pendingRpgCommands.add({ id: body.commandId, body, status: 'pending', queuedAt: now, conflict: null, dependsOn })
}

const entityTables = [db.rpgOutfits, db.rpgPresets, db.rpgCheckpoints, db.umas, db.items]
const logTables = [db.rpgResults, db.rpgPromotions, db.rpgReceipts, db.itemLedger]

async function installAccepted(commandId: string, response: Extract<RpgCommandResponse, { status: 'applied' | 'duplicate' }>): Promise<void> {
  const entities = response.entities
  const logs = response.logs
  await db.transaction('rw', [...entityTables, ...logTables, db.pendingRpgCommands, db.outbox], async () => {
    for (const row of entities) {
      if (row.kind !== 'rpgOutfits' && row.kind !== 'rpgPresets' && row.kind !== 'rpgCheckpoints' &&
        row.kind !== 'umas' && row.kind !== 'items') throw new Error(`Unexpected RPG command entity: ${row.kind}`)
      if ((row.kind === 'umas' || row.kind === 'items') &&
        await db.outbox.where('[kind+id]').equals([row.kind, row.id]).count()) {
        throw new Error(`Cannot adopt RPG command while ${row.kind}/${row.id} has a pending ordinary write`)
      }
      await db.table(row.kind).put({ id: row.id, version: row.version, data: row.data })
    }
    for (const row of logs) {
      if (row.kind !== 'rpgResults' && row.kind !== 'rpgPromotions' && row.kind !== 'rpgReceipts' && row.kind !== 'itemLedger') {
        throw new Error(`Unexpected RPG command log: ${row.kind}`)
      }
      await db.table(row.kind).put({ id: row.id, createdAt: row.createdAt, data: row.data })
    }
    await db.pendingRpgCommands.delete(commandId)
  })
}

function rowsForDuplicate(snapshot: { entities: EntityRecord[]; logs: LogRecord[] }, body: RpgCommandRequest,
  receipt: Extract<RpgCommandResponse, { status: 'applied' | 'duplicate' }>['receipt']): { entities: EntityRecord[]; logs: LogRecord[] } {
  const entities = receipt.applied.map((applied) => snapshot.entities.find((row) => row.kind === applied.kind && row.id === applied.id))
  const logs = [
    ...receipt.appendedIds.map((id, index) => snapshot.logs.find((row) => row.kind === body.appends[index]?.kind && row.id === id)),
    snapshot.logs.find((row) => row.kind === 'rpgReceipts' && row.id === receipt.commandId),
  ]
  if (entities.some((row) => !row) || logs.some((row) => !row)) throw new Error('Accepted RPG command evidence missing from save')
  return { entities: entities as EntityRecord[], logs: logs as LogRecord[] }
}

/** Returns true only after one command's server-acknowledged rows are locally installed. */
export async function flushOneRpgCommand(): Promise<boolean> {
  const pending = await db.pendingRpgCommands.orderBy('queuedAt').filter((candidate) => candidate.status === 'pending').toArray()
  let row: typeof pending[number] | undefined
  for (const candidate of pending) {
    const dependency = candidate.dependsOn ? await db.pendingRpgCommands.get(candidate.dependsOn) : null
    if (dependency?.status === 'conflict') {
      await db.pendingRpgCommands.update(candidate.id, { status: 'conflict', conflict: dependency.conflict })
      continue
    }
    if (dependency) continue
    row = candidate
    break
  }
  if (!row) return false
  const body = row.body as RpgCommandRequest
  const response = parseRpgCommandResponseOrThrow(await saveApi.rpgCommand(body), row.id)
  if (response.status === 'conflict' || response.status === 'rejected') {
    await db.pendingRpgCommands.update(row.id, { status: 'conflict', conflict: response })
    return false
  }
  if (response.status === 'duplicate') {
    const snapshot = parseSaveSnapshotOrThrow(await saveApi.load())
    const selected = rowsForDuplicate(snapshot, body, response.receipt)
    await installAccepted(row.id, { ...response, ...selected })
  } else {
    await installAccepted(row.id, response)
  }
  return true
}
