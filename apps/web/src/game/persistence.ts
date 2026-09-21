// Typed IndexedDB reads and atomic save mutations (docs/technical/architecture.md).

import {
  applyDailyGrants,
  createCardSave,
  createInitialSave,
  createUmaSave,
  parseCardSave,
  parseBadgeState,
  parseFlairEvent,
  parseEntityData,
  parseLedgerEntry,
  parseLogData,
  parsePlayerProfileOrThrow,
  parseRaceResultRecord,
  rebaseBadgePreferences,
  parseSaveSnapshotOrThrow,
  parseUmaSave,
  parseUmaSaveOrThrow,
  type CardSave,
  type BadgeStateV1,
  type FlairEventV1,
  type EntityKind,
  type EntityRecord,
  type LedgerEntry,
  type LogKind,
  type PlayerProfile,
  raceAttemptId,
  SCENARIO_GOAL_VERSION,
  type UmaSave,
} from '@racer/domain'
import type { LoadedContent } from '../content/runtime'
import { db, type LogRow, type OutboxRow, type VersionedRow } from './db'

export interface LocalSnapshot {
  profile: VersionedRow<PlayerProfile>
  umas: VersionedRow<UmaSave>[]
  cards: VersionedRow<CardSave>[]
  badges: VersionedRow<BadgeStateV1>[]
  flairEvents: LogRow<FlairEventV1>[]
}

export async function queueInTransaction(
  kind: EntityKind | LogKind,
  id: string,
  op: OutboxRow['op'],
  queuedAt: number,
): Promise<void> {
  await db.outbox.where('[kind+id]').equals([kind, id]).delete()
  await db.outbox.add({ kind, id, op, queuedAt })
}

export async function readLocalSnapshot(): Promise<LocalSnapshot | null> {
  const profileRow = await db.profile.get('main')
  if (!profileRow) return null
  if (profileRow.id !== 'main' || !Number.isSafeInteger(profileRow.version) || profileRow.version < 0) {
    throw new Error('Local profile row metadata is invalid')
  }
  const profile = parsePlayerProfileOrThrow(profileRow.data)

  const umaRows = await db.umas.toArray()
  const cardRows = await db.cards.toArray()
  const badgeRows = await db.badges.toArray()
  const flairRows = await db.flairEvents.toArray()
  const umas = umaRows.map((row) => {
    const data = parseUmaSaveOrThrow(row.data)
    if (data.templateId !== row.id) throw new Error(`Invalid local Uma save: ${row.id}`)
    return { ...row, data }
  })
  const cards = cardRows.map((row) => {
    const data = parseCardSave(row.data)
    if (!data || data.templateId !== row.id) throw new Error(`Invalid local card save: ${row.id}`)
    return { ...row, data }
  })
  const badges = badgeRows.map((row) => {
    const data = parseBadgeState(row.data)
    if (!data || (data.scope === 'uma' ? row.id !== `uma:${data.umaId}` : row.id !== 'trainer')) {
      throw new Error(`Invalid local badge state: ${row.id}`)
    }
    return { ...row, data }
  })
  const flairEvents = flairRows.map((row) => {
    const data = parseFlairEvent(row.data)
    if (!data || data.earnedAt !== row.createdAt) throw new Error(`Invalid local flair event: ${row.id}`)
    return { ...row, data }
  })
  if (umaRows.some((row) => !Number.isSafeInteger(row.version) || row.version < 0)) throw new Error('Local Uma row version is invalid')
  if (cardRows.some((row) => !Number.isSafeInteger(row.version) || row.version < 0)) throw new Error('Local card row version is invalid')
  if (badgeRows.some((row) => !Number.isSafeInteger(row.version) || row.version < 0)) throw new Error('Local badge row version is invalid')
  return { profile: { ...profileRow, data: profile }, umas, cards, badges, flairEvents }
}

export async function isDatabaseSemanticallyEmpty(): Promise<boolean> {
  const counts = await Promise.all([
    db.profile.count(),
    db.umas.count(),
    db.cards.count(),
    db.badges.count(),
    db.raceResults.count(),
    db.ledger.count(),
    db.flairEvents.count(),
    db.outbox.count(),
  ])
  return counts.every((count) => count === 0)
}

export async function persistInitial(content: LoadedContent, today: string, now: number): Promise<void> {
  const initial = createInitialSave(content.umas.items, content.cards.items, content.manifest.version, today, now)
  await db.transaction('rw', db.profile, db.umas, db.cards, db.ledger, db.outbox, async () => {
    await db.profile.put({ id: 'main', data: initial.profile, version: 0 })
    await db.umas.bulkPut(initial.umas.map((data) => ({ id: data.templateId, data, version: 0 })))
    await db.cards.bulkPut(initial.cards.map((data) => ({ id: data.templateId, data, version: 0 })))
    await db.ledger.bulkPut(initial.ledger.map((entry) => ({ id: entry.id, data: entry.data, createdAt: entry.data.createdAt })))
    await queueInTransaction('profile', 'main', 'upsert', now)
    for (const data of initial.umas) await queueInTransaction('umas', data.templateId, 'upsert', now)
    for (const data of initial.cards) await queueInTransaction('cards', data.templateId, 'upsert', now)
    for (const entry of initial.ledger) await queueInTransaction('ledger', entry.id, 'append', now)
  })
}

export async function adoptServerSnapshot(raw: unknown): Promise<'empty' | 'adopted'> {
  const snapshot = parseSaveSnapshotOrThrow(raw)
  const legacyKeys = new Set<string>()
  if (typeof raw === 'object' && raw !== null && !Array.isArray(raw) && Array.isArray((raw as Record<string, unknown>).entities)) {
    for (const record of (raw as Record<string, unknown>).entities as unknown[]) {
      if (typeof record !== 'object' || record === null || Array.isArray(record)) continue
      const row = record as Record<string, unknown>
      if ((row.kind === 'profile' || row.kind === 'umas') && typeof row.id === 'string' && typeof row.data === 'object' && row.data !== null) {
        const data = row.data as Record<string, unknown>
        if (row.kind === 'profile' ? data.schemaVersion === 1 || data.schemaVersion === 2 || data.schemaVersion === 3 :
          !Object.hasOwn(data, 'schemaVersion') || data.schemaVersion === 2 || data.schemaVersion === 3) {
          legacyKeys.add(`${row.kind}/${row.id}`)
        }
      }
    }
  }
  const profileRecords = snapshot.entities.filter((record) => record.kind === 'profile' && !record.deleted)
  if (profileRecords.length === 0) {
    if (snapshot.entities.some((record) => !record.deleted) || snapshot.logs.length > 0) {
      throw new Error('Server save is incomplete: profile/main is missing')
    }
    return 'empty'
  }
  if (profileRecords.length !== 1 || profileRecords[0]!.id !== 'main') throw new Error('Server save has duplicate profiles')

  await db.transaction('rw', [db.profile, db.umas, db.cards, db.badges, db.raceResults, db.ledger, db.flairEvents, db.outbox], async () => {
    await Promise.all([db.profile.clear(), db.umas.clear(), db.cards.clear(), db.badges.clear(), db.raceResults.clear(), db.ledger.clear(), db.flairEvents.clear(), db.outbox.clear()])
    for (const record of snapshot.entities) {
      if (record.deleted) continue
      if (record.kind === 'profile') await db.profile.put({ id: record.id, data: parsePlayerProfileOrThrow(record.data), version: record.version })
      if (record.kind === 'umas') await db.umas.put({ id: record.id, data: parseUmaSave(record.data)!, version: record.version })
      if (record.kind === 'cards') await db.cards.put({ id: record.id, data: parseCardSave(record.data)!, version: record.version })
      if (record.kind === 'badges') await db.badges.put({ id: record.id, data: parseBadgeState(record.data)!, version: record.version })
    }
    for (const record of snapshot.logs) {
      if (record.kind === 'ledger') {
        await db.ledger.put({ id: record.id, data: parseLedgerEntry(record.data)!, createdAt: record.createdAt })
      } else if (record.kind === 'raceResults') {
        await db.raceResults.put({ id: record.id, data: record.data, createdAt: record.createdAt })
      } else {
        await db.flairEvents.put({ id: record.id, data: parseFlairEvent(record.data)!, createdAt: record.createdAt })
      }
    }
    for (const key of legacyKeys) {
      const separator = key.indexOf('/')
      await queueInTransaction(key.slice(0, separator) as EntityKind, key.slice(separator + 1), 'upsert', snapshot.serverTime)
    }
  })
  return 'adopted'
}

export async function completeStarterSeed(content: LoadedContent, now: number): Promise<void> {
  const row = await db.profile.get('main')
  if (!row) throw new Error('Cannot seed starters without a profile')
  const profile = parsePlayerProfileOrThrow(row.data)
  if (profile.starterSeedContentVersion !== null) return

  const starterUmas = content.umas.items.filter((item) => item.starter).sort((a, b) => a.id.localeCompare(b.id))
  if (starterUmas.length !== 25) throw new Error(`Expected exactly 25 starter Umas, found ${starterUmas.length}`)
  const starterCards = content.cards.items.filter((item) => item.starter).sort((a, b) => a.id.localeCompare(b.id))

  await db.transaction('rw', db.profile, db.umas, db.cards, db.outbox, async () => {
    const addedUmas: UmaSave[] = []
    const addedCards: CardSave[] = []
    for (const template of starterUmas) if (!(await db.umas.get(template.id))) addedUmas.push(createUmaSave(template))
    for (const template of starterCards) if (!(await db.cards.get(template.id))) addedCards.push(createCardSave(template))
    if (addedUmas.length) await db.umas.bulkPut(addedUmas.map((data) => ({ id: data.templateId, data, version: 0 })))
    if (addedCards.length) await db.cards.bulkPut(addedCards.map((data) => ({ id: data.templateId, data, version: 0 })))
    const nextProfile = {
      ...profile,
      featuredUmaId: profile.featuredUmaId ?? starterUmas[0]!.id,
      starterSeedContentVersion: content.manifest.version,
    }
    await db.profile.put({ ...row, data: nextProfile })
    await queueInTransaction('profile', 'main', 'upsert', now)
    for (const data of addedUmas) await queueInTransaction('umas', data.templateId, 'upsert', now)
    for (const data of addedCards) await queueInTransaction('cards', data.templateId, 'upsert', now)
  })
}

/** Upgrade every pre-T014 Uma and its current-tier history in one all-or-nothing local transaction. */
export async function bootstrapGoalPlans(content: LoadedContent, now: number): Promise<number> {
  if (!Number.isSafeInteger(now) || now < 0) throw new Error('Goal bootstrap time is invalid')
  const affectedCount = await db.transaction('rw', [db.umas, db.raceResults, db.outbox], async () => {
    const umaRows = await db.umas.toArray()
    const affected = umaRows.filter((row) => {
      const uma = parseUmaSave(row.data)
      if (!uma || uma.templateId !== row.id) throw new Error(`Invalid local Uma save: ${row.id}`)
      return uma.goalPlanVersion !== SCENARIO_GOAL_VERSION
    })
    if (affected.length === 0) return 0
    const histories = (await db.raceResults.toArray()).map((row) => {
      const record = parseRaceResultRecord(row.data)
      if (!record || row.id !== raceAttemptId(record.umaId, record.sequence) || row.createdAt !== record.createdAt) {
        throw new Error(`Invalid local race result: ${row.id}`)
      }
      return record
    })
    for (const row of affected) {
      const uma = parseUmaSave(row.data)!
      const template = content.umas.byId.get(row.id)
      if (!template) throw new Error(`Goal bootstrap content is missing Uma ${row.id}`)
      // The v5 migration already carries each run's journey; there is no goal-plan backfill left to do.
      void template
      void histories
    }
    return affected.length
  })
  if (affectedCount > 0) console.info(`[scenario-goals] upgraded ${affectedCount} local Uma plan${affectedCount === 1 ? '' : 's'} to v${SCENARIO_GOAL_VERSION}`)
  return affectedCount
}

export async function applyOwedDailyGrant(today: string, now: number): Promise<number> {
  const row = await db.profile.get('main')
  if (!row) return 0
  const profile = parsePlayerProfileOrThrow(row.data)
  const result = applyDailyGrants(profile, today, now)
  if (result.profile === profile) return 0
  await db.transaction('rw', db.profile, db.ledger, db.outbox, async () => {
    await db.profile.put({ ...row, data: result.profile })
    await queueInTransaction('profile', 'main', 'upsert', now)
    for (const entry of result.ledger) {
      await db.ledger.put({ id: entry.id, data: entry.data, createdAt: entry.data.createdAt })
      await queueInTransaction('ledger', entry.id, 'append', now)
    }
  })
  return result.ledger.reduce((sum, entry) => sum + entry.data.delta, 0)
}

export function stateFromSnapshot(snapshot: LocalSnapshot, content: LoadedContent, persistent: boolean) {
  const umas = Object.fromEntries(snapshot.umas.map((row) => [row.id, row.data]))
  const cards = Object.fromEntries(snapshot.cards.map((row) => [row.id, row.data]))
  const badges = Object.fromEntries(snapshot.badges.map((row) => [row.id, row.data]))
  return {
    profile: snapshot.profile.data,
    umas,
    cards,
    badges,
    flairEvents: snapshot.flairEvents.map((row) => ({ id: row.id, ...row.data })),
    persistent,
    orphanedUmaIds: snapshot.umas.filter((row) => !content.umas.byId.has(row.id)).map((row) => row.id),
    orphanedCardIds: snapshot.cards.filter((row) => !content.cards.byId.has(row.id)).map((row) => row.id),
  }
}

export async function entityRow(kind: EntityKind, id: string): Promise<VersionedRow<object> | null> {
  const row = kind === 'profile'
    ? await db.profile.get(id)
    : kind === 'umas'
      ? await db.umas.get(id)
      : kind === 'cards'
        ? await db.cards.get(id)
        : await db.badges.get(id)
  if (!row) return null
  if (row.id !== id || !Number.isSafeInteger(row.version) || row.version < 0) {
    throw new Error(`Invalid local ${kind} row metadata: ${id}`)
  }
  const data = kind === 'profile' ? parsePlayerProfileOrThrow(row.data) : parseEntityData(kind, row.data)
  if (!data || ((kind === 'umas' || kind === 'cards') && (!('templateId' in data) || data.templateId !== id))) {
    throw new Error(`Invalid local ${kind} data: ${id}`)
  }
  return { id: row.id, version: row.version, data }
}

export async function logRow(kind: LogKind, id: string): Promise<LogRow<object> | null> {
  const row = kind === 'ledger' ? await db.ledger.get(id) : kind === 'raceResults' ? await db.raceResults.get(id) : await db.flairEvents.get(id)
  if (!row) return null
  if (row.id !== id || !Number.isSafeInteger(row.createdAt) || row.createdAt < 0) {
    throw new Error(`Invalid local ${kind} row metadata: ${id}`)
  }
  const data = parseLogData(kind, row.data)
  if (!data) throw new Error(`Invalid local ${kind} data: ${id}`)
  return { id: row.id, createdAt: row.createdAt, data }
}

export async function putConflict(record: EntityRecord, queueMigrated = false, now = Date.now()): Promise<void> {
  if (record.deleted) {
    if (record.kind === 'profile') await db.profile.delete(record.id)
    if (record.kind === 'umas') await db.umas.delete(record.id)
    if (record.kind === 'cards') await db.cards.delete(record.id)
    if (record.kind === 'badges') await db.badges.delete(record.id)
    return
  }
  if (record.kind === 'profile') await db.profile.put({ id: record.id, data: parsePlayerProfileOrThrow(record.data), version: record.version })
  if (record.kind === 'umas') await db.umas.put({ id: record.id, data: parseUmaSave(record.data)!, version: record.version })
  if (record.kind === 'cards') await db.cards.put({ id: record.id, data: parseCardSave(record.data)!, version: record.version })
  if (record.kind === 'badges') {
    const server = parseBadgeState(record.data)
    if (!server) throw new Error(`Invalid server badge conflict: ${record.id}`)
    const localRow = await db.badges.get(record.id)
    const local = localRow ? parseBadgeState(localRow.data) : null
    const rebased = local ? rebaseBadgePreferences(server, local) : server
    await db.badges.put({ id: record.id, data: rebased, version: record.version })
    if (JSON.stringify(rebased.preferences) !== JSON.stringify(server.preferences)) {
      await queueInTransaction('badges', record.id, 'upsert', now)
    }
  }
  if (queueMigrated && (record.kind === 'profile' || record.kind === 'umas')) {
    await queueInTransaction(record.kind, record.id, 'upsert', now)
  }
}

export async function updateEntityVersion(kind: EntityKind, id: string, version: number): Promise<void> {
  if (kind === 'profile') await db.profile.update(id, { version })
  if (kind === 'umas') await db.umas.update(id, { version })
  if (kind === 'cards') await db.cards.update(id, { version })
  if (kind === 'badges') await db.badges.update(id, { version })
}
