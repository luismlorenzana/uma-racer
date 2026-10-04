// Device-local RPG command queue and acknowledged projection install (docs/technical/uma-rpg-implementation.md, T090).
import { parseRpgCommandResponseOrThrow, parseSaveSnapshotOrThrow, parseRpgOutfitSave, rpgRewardProjection,
  parseRpgResultEvidence,
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
  const entityTables = [database.rpgOutfits, database.rpgPresets, database.rpgCheckpoints, database.umas, database.items, database.inspirationBank]
  const logTables = [database.rpgResults, database.rpgPromotions, database.rpgReceipts, database.itemLedger]
  const entities = response.entities
  const logs = response.logs
  await database.transaction('rw', [...entityTables, ...logTables, database.pendingRpgCommands, database.outbox], async () => {
    for (const row of entities) {
      if (row.kind !== 'rpgOutfits' && row.kind !== 'rpgPresets' && row.kind !== 'rpgCheckpoints' &&
        row.kind !== 'umas' && row.kind !== 'items' && row.kind !== 'inspirationBank') throw new Error(`Unexpected RPG command entity: ${row.kind}`)
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

/** Only a profile-only conflict may be reconciled. A changed checkpoint/lease is NEVER a rebased win. */
async function reconcileBattleProfiles(body: RpgCommandRequest,
  response: Extract<RpgCommandResponse, { status: 'conflict' }>, database: RacerDb): Promise<boolean> {
  if (body.action !== 'battle-result') return false
  const evidence = parseRpgResultEvidence(body.appends.find((a) => a.kind === 'rpgResults')?.data)
  if (!evidence || response.authoritative.length !== body.expected.length) return false
  const authoritative = new Map(response.authoritative.map((r) => [`${r.kind}/${r.id}`, r.record]))
  if (body.expected.some((e) => e.kind !== 'rpgOutfits' && authoritative.get(`${e.kind}/${e.id}`)?.version !== e.version)) return false
  const members = evidence.memberExp.map((member) => {
    const row = authoritative.get(`rpgOutfits/${member.outfitId}`)
    const parsed = row && !row.deleted && parseRpgOutfitSave(row.data)
    return row && parsed ? { row, parsed, grant: rpgRewardProjection(parsed.profile, member.delta) } : null
  })
  if (members.some((m) => !m)) return false
  const valid = members.filter((m) => m !== null)
  const next: RpgCommandRequest = { ...body,
    expected: body.expected.map((e) => e.kind === 'rpgOutfits' ? { ...e,
      version: valid.find((m) => m.row.id === e.id)!.row.version } : e),
    upserts: body.upserts.map((u) => {
      if (u.kind !== 'rpgOutfits') return u
      const member = valid.find((m) => m.row.id === u.id)!
      return { ...u, data: { ...member.parsed, profile: member.grant.profile,
        projectionRevision: member.parsed.projectionRevision + 1 } as unknown as Record<string, unknown> }
    }),
    appends: body.appends.map((a) => a.kind === 'rpgResults' ? { ...a,
      data: { ...evidence, memberExp: valid.map((m) => m.grant.member) } as unknown as Record<string, unknown> } : a),
  }
  if (JSON.stringify(next) === JSON.stringify(body)) return false
  await database.transaction('rw', [database.rpgOutfits, database.pendingRpgCommands], async () => {
    const pending = await database.pendingRpgCommands.get(body.commandId)
    if (!pending || JSON.stringify(pending.body) !== JSON.stringify(body)) throw new Error('Result reservation changed during reconciliation')
    for (const member of valid) {
      const local = await database.rpgOutfits.get(member.row.id)
      if (local && local.version > member.row.version) throw new Error('Newer profile arrived during reward reconciliation')
      await database.rpgOutfits.put({ id: member.row.id, version: member.row.version, data: member.parsed })
    }
    // Same result/command identity, seed, kit, delta, hash and timestamp. The failed group wrote nothing.
    await database.pendingRpgCommands.update(body.commandId, { body: next, status: 'pending', conflict: null })
  })
  return true
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
  if (response.status === 'conflict' && await reconcileBattleProfiles(body, response, database)) return false
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
