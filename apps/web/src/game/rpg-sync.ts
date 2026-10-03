// Device-local RPG command queue and acknowledged projection install (docs/technical/uma-rpg-implementation.md, T090).
import { parseRpgCommandResponseOrThrow, parseSaveSnapshotOrThrow,
  type EntityRecord, type LogRecord, type RpgCommandRequest, type RpgCommandResponse } from '@racer/domain'
import { saveApi } from '../api/client'
import { db, type RacerDb } from './db'

export async function enqueueRpgCommand(body: RpgCommandRequest, now: number, dependsOn: string | null = null, database: RacerDb = db): Promise<void> {
  if (body.schemaVersion !== 1 || !/^[A-Za-z0-9_.:-]{1,120}$/.test(body.commandId) ||
    !Number.isSafeInteger(now) || now < 0) throw new Error('Invalid RPG command queue entry')
  const existing = await database.pendingRpgCommands.get(body.commandId)
  if (existing) {
    if (JSON.stringify(existing.body) !== JSON.stringify(body) || (existing.dependsOn ?? null) !== dependsOn) {
      throw new Error('RPG command id already queued with another payload or dependency')
    }
    return
  }
  await database.pendingRpgCommands.add({ id: body.commandId, body, status: 'pending', queuedAt: now, conflict: null, dependsOn })
}


async function installAccepted(commandId: string, response: Extract<RpgCommandResponse, { status: 'applied' | 'duplicate' }>, database: RacerDb): Promise<void> {
  const entityTables = [database.rpgOutfits, database.rpgPresets, database.rpgCheckpoints, database.umas, database.items]
  const logTables = [database.rpgResults, database.rpgPromotions, database.rpgReceipts, database.itemLedger]
  const entities = response.entities
  const logs = response.logs
  await database.transaction('rw', [...entityTables, ...logTables, database.pendingRpgCommands, database.outbox], async () => {
    for (const row of entities) {
      if (row.kind !== 'rpgOutfits' && row.kind !== 'rpgPresets' && row.kind !== 'rpgCheckpoints' &&
        row.kind !== 'umas' && row.kind !== 'items') throw new Error(`Unexpected RPG command entity: ${row.kind}`)
      if ((row.kind === 'umas' || row.kind === 'items') &&
        await database.outbox.where('[kind+id]').equals([row.kind, row.id]).count()) {
        throw new Error(`Cannot adopt RPG command while ${row.kind}/${row.id} has a pending ordinary write`)
      }
      await database.table(row.kind).put({ id: row.id, version: row.version, data: row.data })
    }
    for (const row of logs) {
      if (row.kind !== 'rpgResults' && row.kind !== 'rpgPromotions' && row.kind !== 'rpgReceipts' && row.kind !== 'itemLedger') {
        throw new Error(`Unexpected RPG command log: ${row.kind}`)
      }
      await database.table(row.kind).put({ id: row.id, createdAt: row.createdAt, data: row.data })
    }
    await database.pendingRpgCommands.delete(commandId)
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
export async function flushOneRpgCommand(database: RacerDb = db, transport: Pick<typeof saveApi, 'load' | 'rpgCommand'> = saveApi): Promise<boolean> {
  const pending = await database.pendingRpgCommands.orderBy('queuedAt').filter((candidate) => candidate.status === 'pending').toArray()
  let row: typeof pending[number] | undefined
  for (const candidate of pending) {
    const dependency = candidate.dependsOn ? await database.pendingRpgCommands.get(candidate.dependsOn) : null
    if (dependency?.status === 'conflict') {
      await database.pendingRpgCommands.update(candidate.id, { status: 'conflict', conflict: dependency.conflict })
      continue
    }
    if (dependency) continue
    row = candidate
    break
  }
  if (!row) return false
  const body = row.body as RpgCommandRequest
  const response = parseRpgCommandResponseOrThrow(await transport.rpgCommand(body), row.id)
  if (response.status === 'conflict' || response.status === 'rejected') {
    await database.pendingRpgCommands.update(row.id, { status: 'conflict', conflict: response })
    return false
  }
  if (response.status === 'duplicate') {
    const snapshot = parseSaveSnapshotOrThrow(await transport.load())
    const selected = rowsForDuplicate(snapshot, body, response.receipt)
    await installAccepted(row.id, { ...response, ...selected }, database)
  } else {
    await installAccepted(row.id, response, database)
  }
  return true
}
