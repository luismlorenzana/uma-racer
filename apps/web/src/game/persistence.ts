// Typed IndexedDB reads and atomic save mutations (docs/technical/architecture.md).

import {
  parseLegacyPlayerProfileV11,
  parsePlayerProfile,
  migrateCardSaveToCurrent,
  migrateUmaSaveToCurrent,
  migrateUmaSaveWithSurplus,
  migratePlayerProfileToCurrent,
  applyDailyGrants,
  createCardSave,
  createInitialSave,
  createUmaSave,
  parseCardSave,
  parseBadgeState,
  parseFlairEvent,
  migrateFarmStateToCurrent,
  parseFarmState,
  parseInventoryStackData,
  parseItemLedgerEntry,
  reconcileFarmEvidence,
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
  type FarmState,
  type InventoryStackData,
  type ItemLedgerEntry,
  type LogKind,
  type PlayerProfile,
  raceAttemptId,
  careerRaceCatalog,
  SCENARIO_GOAL_VERSION,
  deriveUma,
  upgradeGoalPlan,
  type UmaSave,
  type RpgOutfitSaveV1,
  type RpgPresetSaveV1,
  type RpgCheckpointSaveV1,
  type RpgResultEvidenceV1,
  type RpgPromotionEvidenceV1,
  type RpgCommandReceiptV1,
} from '@racer/domain'
import type { LoadedContent } from '../content/runtime'
import { db, type FarmRow, type LogRow, type OutboxRow, type VersionedRow } from './db'

export interface LocalSnapshot {
  profile: VersionedRow<PlayerProfile>
  umas: VersionedRow<UmaSave>[]
  cards: VersionedRow<CardSave>[]
  badges: VersionedRow<BadgeStateV1>[]
  flairEvents: LogRow<FlairEventV1>[]
  farm: FarmRow | null
  items: VersionedRow<InventoryStackData>[]
  itemLedger: LogRow<ItemLedgerEntry>[]
  rpgOutfits: VersionedRow<RpgOutfitSaveV1>[]
  rpgPresets: VersionedRow<RpgPresetSaveV1>[]
  rpgCheckpoints: VersionedRow<RpgCheckpointSaveV1>[]
  rpgResults: LogRow<RpgResultEvidenceV1>[]
  rpgPromotions: LogRow<RpgPromotionEvidenceV1>[]
  rpgReceipts: LogRow<RpgCommandReceiptV1>[]
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

/** Repairs Farm/item projections from append-only evidence. Call inside a transaction containing these four tables. */
export async function reconcileFarmProjectionsInTransaction(now: number): Promise<{ farmChanged: boolean; changedItemIds: string[] }> {
  const farmRow = await db.farm.get('main')
  if (!farmRow) return { farmChanged: false, changedItemIds: [] }
  const movements = (await db.itemLedger.toArray()).map((row) => {
    const parsed = parseItemLedgerEntry(row.data)
    if (!parsed || parsed.id !== row.id || parsed.createdAt !== row.createdAt) throw new Error(`Invalid local item ledger: ${row.id}`)
    return parsed
  })
  const itemRows = await db.items.toArray()
  const result = reconcileFarmEvidence(farmRow.data, itemRows.map((row) => row.data), movements)
  if (result.farmChanged) {
    await db.farm.put({ ...farmRow, data: result.farm, revision: farmRow.revision + 1 })
    await queueInTransaction('farm', 'main', 'upsert', now)
  }
  for (const itemId of result.changedItemIds) {
    const data = result.stacks.find((stack) => stack.itemId === itemId)
    if (!data) throw new Error(`Reconciled item stack is missing: ${itemId}`)
    const row = await db.items.get(itemId)
    await db.items.put({ id: itemId, data, version: row?.version ?? 0 })
    await queueInTransaction('items', itemId, 'upsert', now)
  }
  return { farmChanged: result.farmChanged, changedItemIds: result.changedItemIds }
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
  const farmRow = await db.farm.get('main')
  const itemRows = await db.items.toArray()
  const itemLedgerRows = await db.itemLedger.toArray()
  const rpgOutfits = validateRpgEntities('rpgOutfits', await db.rpgOutfits.toArray()) as VersionedRow<RpgOutfitSaveV1>[]
  const rpgPresets = validateRpgEntities('rpgPresets', await db.rpgPresets.toArray()) as VersionedRow<RpgPresetSaveV1>[]
  const rpgCheckpoints = validateRpgEntities('rpgCheckpoints', await db.rpgCheckpoints.toArray()) as VersionedRow<RpgCheckpointSaveV1>[]
  const rpgResults = validateRpgLogs('rpgResults', await db.rpgResults.toArray()) as LogRow<RpgResultEvidenceV1>[]
  const rpgPromotions = validateRpgLogs('rpgPromotions', await db.rpgPromotions.toArray()) as LogRow<RpgPromotionEvidenceV1>[]
  const rpgReceipts = validateRpgLogs('rpgReceipts', await db.rpgReceipts.toArray()) as LogRow<RpgCommandReceiptV1>[]
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
  const farm = farmRow ? (() => {
    const data = parseFarmState(farmRow.data)
    if (!data || farmRow.id !== 'main' || !Number.isSafeInteger(farmRow.version) || farmRow.version < 0 ||
      !Number.isSafeInteger(farmRow.revision) || farmRow.revision < 0) {
      throw new Error('Invalid local Farm state')
    }
    return { ...farmRow, data }
  })() : null
  const items = itemRows.map((row) => {
    const data = parseInventoryStackData(row.data, row.id)
    if (!data || !Number.isSafeInteger(row.version) || row.version < 0) throw new Error(`Invalid local item stack: ${row.id}`)
    return { ...row, data }
  })
  const itemLedger = itemLedgerRows.map((row) => {
    const data = parseItemLedgerEntry(row.data)
    if (!data || data.id !== row.id || data.createdAt !== row.createdAt) throw new Error(`Invalid local item ledger: ${row.id}`)
    return { ...row, data }
  })
  if (umaRows.some((row) => !Number.isSafeInteger(row.version) || row.version < 0)) throw new Error('Local Uma row version is invalid')
  if (cardRows.some((row) => !Number.isSafeInteger(row.version) || row.version < 0)) throw new Error('Local card row version is invalid')
  if (badgeRows.some((row) => !Number.isSafeInteger(row.version) || row.version < 0)) throw new Error('Local badge row version is invalid')
  return { profile: { ...profileRow, data: profile }, umas, cards, badges, flairEvents, farm, items, itemLedger,
    rpgOutfits, rpgPresets, rpgCheckpoints, rpgResults, rpgPromotions, rpgReceipts }
}

function validateRpgEntities(kind: EntityKind, rows: VersionedRow<unknown>[]): VersionedRow<object>[] {
  return rows.map((row) => {
    if (typeof row.data === 'object' && row.data !== null && 'schemaVersion' in row.data &&
      typeof row.data.schemaVersion === 'number' && row.data.schemaVersion > 1) {
      throw new Error(`App update required for RPG schema ${row.data.schemaVersion}`)
    }
    const parsed = parseEntityData(kind, row.data)
    if (!parsed || !Number.isSafeInteger(row.version) || row.version < 0) throw new Error(`Invalid local ${kind}/${row.id}`)
    if ((kind === 'rpgOutfits' && (parsed.profile as Record<string, unknown>).outfitId !== row.id) ||
      (kind === 'rpgPresets' && parsed.presetId !== row.id) ||
      (kind === 'rpgCheckpoints' && `${parsed.presetId}:${parsed.chapterId}` !== row.id)) {
      throw new Error(`Invalid local ${kind} identity: ${row.id}`)
    }
    return { ...row, data: parsed }
  })
}

function validateRpgLogs(kind: LogKind, rows: LogRow<unknown>[]): LogRow<object>[] {
  return rows.map((row) => {
    if (typeof row.data === 'object' && row.data !== null && 'schemaVersion' in row.data &&
      typeof row.data.schemaVersion === 'number' && row.data.schemaVersion > 1) {
      throw new Error(`App update required for RPG schema ${row.data.schemaVersion}`)
    }
    const parsed = parseLogData(kind, row.data)
    if (!parsed || !Number.isSafeInteger(row.createdAt) || row.createdAt < 0 || parsed.createdAt !== row.createdAt) {
      throw new Error(`Invalid local ${kind}/${row.id}`)
    }
    if ((kind === 'rpgResults' && parsed.resultId !== row.id) ||
      (kind === 'rpgPromotions' && parsed.promotionId !== row.id) ||
      (kind === 'rpgReceipts' && parsed.commandId !== row.id)) throw new Error(`Invalid local ${kind} identity: ${row.id}`)
    return { ...row, data: parsed }
  })
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
    db.farm.count(),
    db.items.count(),
    db.itemLedger.count(),
    db.rpgOutfits.count(), db.rpgPresets.count(), db.rpgCheckpoints.count(),
    db.rpgResults.count(), db.rpgPromotions.count(), db.rpgReceipts.count(), db.pendingRpgCommands.count(),
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
  const trainingSurplus = legacyTrainingSurplus(raw)
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
      // A v1 Farm reads as v2 (D234); upload the new shape so the cloud copy catches up.
      if (row.kind === 'farm' && typeof row.id === 'string' && typeof row.data === 'object' && row.data !== null &&
        !parseFarmState(row.data)) legacyKeys.add(`farm/${row.id}`)
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

  await db.transaction('rw', [db.profile, db.umas, db.cards, db.badges, db.raceResults, db.ledger, db.flairEvents, db.farm, db.items, db.itemLedger,
    db.rpgOutfits, db.rpgPresets, db.rpgCheckpoints, db.rpgResults, db.rpgPromotions, db.rpgReceipts, db.outbox], async () => {
    await Promise.all([db.profile.clear(), db.umas.clear(), db.cards.clear(), db.badges.clear(), db.raceResults.clear(), db.ledger.clear(), db.flairEvents.clear(), db.farm.clear(), db.items.clear(), db.itemLedger.clear(), db.outbox.clear()])
    for (const record of snapshot.entities) {
      if (record.deleted) continue
      // A server row can be any supported schema. Migrate on the way in, and re-queue whatever moved so the
      // cloud copy catches up rather than staying on an old shape forever.
      if (record.kind === 'profile') {
        const migrated = migratePlayerProfileToCurrent(record.data)
        if (!migrated) throw new Error('Server player profile cannot be migrated')
        if (!parsePlayerProfile(record.data)) legacyKeys.add(`profile/${record.id}`)
        // A pre-v11 profile banks what its Umas' re-levelling carried past TL10, as the local walk does (D212).
        const profile = trainingSurplus.legacyProfile
          ? { ...migrated, trainingExpBank: migrated.trainingExpBank + trainingSurplus.exp }
          : migrated
        if (trainingSurplus.legacyProfile) legacyKeys.add(`profile/${record.id}`)
        await db.profile.put({ id: record.id, data: profile, version: record.version })
      }
      if (record.kind === 'umas') {
        const uma = migrateUmaSaveToCurrent(record.data)
        if (!uma) throw new Error(`Server Uma ${record.id} cannot be migrated`)
        if (!parseUmaSave(record.data) || trainingSurplus.legacyUmaIds.has(record.id)) legacyKeys.add(`umas/${record.id}`)
        await db.umas.put({ id: record.id, data: uma, version: record.version })
      }
      if (record.kind === 'cards') {
        const card = migrateCardSaveToCurrent(record.data)
        if (!card) throw new Error(`Server card ${record.id} cannot be migrated`)
        if (!parseCardSave(record.data)) legacyKeys.add(`cards/${record.id}`)
        await db.cards.put({ id: record.id, data: card, version: record.version })
      }
      if (record.kind === 'badges') await db.badges.put({ id: record.id, data: parseBadgeState(record.data)!, version: record.version })
      if (record.kind === 'farm') {
        const farm = migrateFarmStateToCurrent(record.data)
        if (!farm) throw new Error(`Server Farm ${record.id} cannot be migrated`)
        await db.farm.put({ id: record.id, data: farm, version: record.version, revision: record.version })
      }
      if (record.kind === 'items') await db.items.put({ id: record.id, data: parseInventoryStackData(record.data, record.id)!, version: record.version })
      if (record.kind === 'rpgOutfits' || record.kind === 'rpgPresets' || record.kind === 'rpgCheckpoints') {
        await mergeRpgEntity(record)
      }
    }
    for (const record of snapshot.logs) {
      if (record.kind === 'ledger') {
        await db.ledger.put({ id: record.id, data: parseLedgerEntry(record.data)!, createdAt: record.createdAt })
      } else if (record.kind === 'raceResults') {
        await db.raceResults.put({ id: record.id, data: record.data, createdAt: record.createdAt })
      } else if (record.kind === 'flairEvents') {
        await db.flairEvents.put({ id: record.id, data: parseFlairEvent(record.data)!, createdAt: record.createdAt })
      } else if (record.kind === 'rpgResults' || record.kind === 'rpgPromotions' || record.kind === 'rpgReceipts') {
        await mergeRpgLog(record)
      } else {
        await db.itemLedger.put({ id: record.id, data: parseItemLedgerEntry(record.data)!, createdAt: record.createdAt })
      }
    }
    for (const key of legacyKeys) {
      const separator = key.indexOf('/')
      await queueInTransaction(key.slice(0, separator) as EntityKind, key.slice(separator + 1), 'upsert', snapshot.serverTime)
    }
    await reconcileFarmProjectionsInTransaction(snapshot.serverTime)
  })
  return 'adopted'
}

/** Cloud adoption never erases a newer or absent-from-cloud local RPG row. Equal-version divergence is visible. */
function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`
  if (value !== null && typeof value === 'object') {
    const record = value as Record<string, unknown>
    return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`).join(',')}}`
  }
  return JSON.stringify(value)
}

async function mergeRpgEntity(record: EntityRecord): Promise<void> {
  if (!['rpgOutfits', 'rpgPresets', 'rpgCheckpoints'].includes(record.kind)) throw new Error('Not an RPG entity')
  const table = db.table<VersionedRow<Record<string, unknown>>, string>(record.kind)
  const local = await table.get(record.id)
  if (local && local.version > record.version) return
  if (local && local.version === record.version && canonicalJson(local.data) !== canonicalJson(record.data)) {
    throw new Error(`Conflicting RPG row ${record.kind}/${record.id} at version ${record.version}`)
  }
  if (record.deleted) {
    if (!local || local.version < record.version) await table.delete(record.id)
  } else if (!local || local.version < record.version) {
    await table.put({ id: record.id, data: record.data, version: record.version })
  }
}

async function mergeRpgLog(record: { kind: LogKind; id: string; data: Record<string, unknown>; createdAt: number }): Promise<void> {
  if (!['rpgResults', 'rpgPromotions', 'rpgReceipts'].includes(record.kind)) throw new Error('Not an RPG log')
  const table = db.table<LogRow<Record<string, unknown>>, string>(record.kind)
  const local = await table.get(record.id)
  if (local && (local.createdAt !== record.createdAt || canonicalJson(local.data) !== canonicalJson(record.data))) {
    throw new Error(`Conflicting RPG evidence ${record.kind}/${record.id}`)
  }
  if (!local) await table.put({ id: record.id, data: record.data, createdAt: record.createdAt })
}

/**
 * A cloud copy from before save v11 still holds its Umas on the old Training curve (D211). The snapshot parser migrates
 * rows on the way in, which re-levels them, so what passed TL10 is read from the raw rows. It is banked only when the
 * profile is pre-v11 too: a current profile already banked it on the device that migrated first.
 */
function legacyTrainingSurplus(raw: unknown): { exp: number; legacyProfile: boolean; legacyUmaIds: Set<string> } {
  const result = { exp: 0, legacyProfile: false, legacyUmaIds: new Set<string>() }
  const entities = typeof raw === 'object' && raw !== null && !Array.isArray(raw) ? (raw as Record<string, unknown>).entities : null
  if (!Array.isArray(entities)) return result
  for (const entry of entities as unknown[]) {
    if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) continue
    const row = entry as Record<string, unknown>
    if (row.deleted === true || typeof row.id !== 'string') continue
    // Only a profile from before v11 has not banked its Umas' re-levelling yet (D212); v11 is a stamp away from v12.
    if (row.kind === 'profile' && !parsePlayerProfile(row.data) && !parseLegacyPlayerProfileV11(row.data) &&
      migratePlayerProfileToCurrent(row.data)) result.legacyProfile = true
    if (row.kind === 'umas' && !parseUmaSave(row.data)) {
      const migrated = migrateUmaSaveWithSurplus(row.data)
      if (!migrated) continue
      result.exp += migrated.surplusExp
      result.legacyUmaIds.add(row.id)
    }
  }
  if (!result.legacyProfile) result.exp = 0
  return result
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

/**
 * Upgrade every Uma to the current goal plan in one all-or-nothing local transaction. An untouched active journey
 * becomes a career frozen against her current constellation; one with progress keeps its plan (D137).
 */
export async function bootstrapGoalPlans(content: LoadedContent, now: number): Promise<number> {
  if (!Number.isSafeInteger(now) || now < 0) throw new Error('Goal bootstrap time is invalid')
  const races = careerRaceCatalog(content.races.items)
  const affectedCount = await db.transaction('rw', [db.umas, db.cards, db.outbox], async () => {
    const umaRows = await db.umas.toArray()
    const affected = umaRows.filter((row) => {
      const uma = parseUmaSave(row.data)
      if (!uma || uma.templateId !== row.id) throw new Error(`Invalid local Uma save: ${row.id}`)
      return uma.goalPlanVersion !== SCENARIO_GOAL_VERSION
    })
    if (affected.length === 0) return 0
    const cardSaves = new Map((await db.cards.toArray()).map((row) => [row.id, row.data as CardSave]))
    for (const row of affected) {
      const uma = parseUmaSave(row.data)!
      const template = content.umas.byId.get(row.id)
      if (!template) throw new Error(`Goal bootstrap content is missing Uma ${row.id}`)
      const { aptitudes } = deriveUma({
        uma,
        umaTemplate: template,
        cardSaves,
        cardTemplates: content.cards.byId,
        umaTemplates: content.umas.byId,
        skillTemplates: content.skills.byId,
      })
      const upgraded = upgradeGoalPlan({
        uma,
        umaTemplate: template,
        aptitudes,
        races,
      })
      await db.umas.put({ ...row, data: upgraded })
      await queueInTransaction('umas', row.id, 'upsert', now)
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
        : kind === 'badges'
          ? await db.badges.get(id)
          : kind === 'farm'
            ? await db.farm.get(id)
            : kind === 'rpgOutfits'
              ? await db.rpgOutfits.get(id)
              : kind === 'rpgPresets'
                ? await db.rpgPresets.get(id)
                : kind === 'rpgCheckpoints'
                  ? await db.rpgCheckpoints.get(id)
            : await db.items.get(id)
  if (!row) return null
  if (row.id !== id || !Number.isSafeInteger(row.version) || row.version < 0) {
    throw new Error(`Invalid local ${kind} row metadata: ${id}`)
  }
  const data = kind === 'profile' ? parsePlayerProfileOrThrow(row.data) : parseEntityData(kind, row.data)
  if (!data || ((kind === 'umas' || kind === 'cards') && (!('templateId' in data) || data.templateId !== id)) ||
    (kind === 'farm' && id !== 'main') || (kind === 'items' && (!('itemId' in data) || data.itemId !== id))) {
    throw new Error(`Invalid local ${kind} data: ${id}`)
  }
  return { id: row.id, version: row.version, data }
}

export async function logRow(kind: LogKind, id: string): Promise<LogRow<object> | null> {
  const row = kind === 'ledger'
    ? await db.ledger.get(id)
    : kind === 'raceResults'
      ? await db.raceResults.get(id)
      : kind === 'flairEvents'
        ? await db.flairEvents.get(id)
        : kind === 'rpgResults'
          ? await db.rpgResults.get(id)
          : kind === 'rpgPromotions'
            ? await db.rpgPromotions.get(id)
            : kind === 'rpgReceipts'
              ? await db.rpgReceipts.get(id)
        : await db.itemLedger.get(id)
  if (!row) return null
  if (row.id !== id || !Number.isSafeInteger(row.createdAt) || row.createdAt < 0) {
    throw new Error(`Invalid local ${kind} row metadata: ${id}`)
  }
  const data = parseLogData(kind, row.data)
  if (!data) throw new Error(`Invalid local ${kind} data: ${id}`)
  return { id: row.id, createdAt: row.createdAt, data }
}

/**
 * A server copy on an older save schema than this app writes, which the migration chain can still read (D156). The
 * server keeps whatever shape its last successful sync wrote, so after a stretch of failed syncs it can hold a copy
 * from before a save migration: a copy that cannot be newer than a current-schema local one.
 */
export function isLegacyServerRecord(record: EntityRecord): boolean {
  if (record.deleted) return false
  if (record.kind === 'profile') return !parsePlayerProfile(record.data) && migratePlayerProfileToCurrent(record.data) !== null
  if (record.kind === 'umas') return !parseUmaSave(record.data) && migrateUmaSaveToCurrent(record.data) !== null
  if (record.kind === 'cards') return !parseCardSave(record.data) && migrateCardSaveToCurrent(record.data) !== null
  return false
}

export async function putConflict(record: EntityRecord, queueMigrated = false, now = Date.now()): Promise<void> {
  if (record.deleted) {
    if (record.kind === 'profile') await db.profile.delete(record.id)
    if (record.kind === 'umas') await db.umas.delete(record.id)
    if (record.kind === 'cards') await db.cards.delete(record.id)
    if (record.kind === 'badges') await db.badges.delete(record.id)
    if (record.kind === 'farm') await db.farm.delete(record.id)
    if (record.kind === 'items') await db.items.delete(record.id)
    if (record.kind === 'rpgOutfits') await db.rpgOutfits.delete(record.id)
    if (record.kind === 'rpgPresets') await db.rpgPresets.delete(record.id)
    if (record.kind === 'rpgCheckpoints') await db.rpgCheckpoints.delete(record.id)
    return
  }
  // Migrate on the way in, as a first load does: a conflict can carry any supported schema, and a row that cannot be
  // read is never written (D156).
  if (record.kind === 'profile') {
    const profile = migratePlayerProfileToCurrent(record.data) ?? parsePlayerProfileOrThrow(record.data)
    await db.profile.put({ id: record.id, data: profile, version: record.version })
  }
  if (record.kind === 'umas') {
    const uma = migrateUmaSaveToCurrent(record.data)
    if (!uma) throw new Error(`Server Uma ${record.id} cannot be migrated`)
    await db.umas.put({ id: record.id, data: uma, version: record.version })
  }
  if (record.kind === 'cards') {
    const card = migrateCardSaveToCurrent(record.data)
    if (!card) throw new Error(`Server card ${record.id} cannot be migrated`)
    await db.cards.put({ id: record.id, data: card, version: record.version })
  }
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
  if (record.kind === 'farm') {
    const farm = migrateFarmStateToCurrent(record.data)
    if (!farm || record.id !== 'main') throw new Error(`Invalid server Farm conflict: ${record.id}`)
    const local = await db.farm.get(record.id)
    await db.farm.put({ id: record.id, data: farm, version: record.version, revision: (local?.revision ?? record.version) + 1 })
  }
  if (record.kind === 'items') {
    const item = parseInventoryStackData(record.data, record.id)
    if (!item) throw new Error(`Invalid server item conflict: ${record.id}`)
    await db.items.put({ id: record.id, data: item, version: record.version })
  }
  if (record.kind === 'rpgOutfits' || record.kind === 'rpgPresets' || record.kind === 'rpgCheckpoints') {
    await mergeRpgEntity(record)
  }
  if (queueMigrated && (record.kind === 'profile' || record.kind === 'umas' || record.kind === 'cards')) {
    await queueInTransaction(record.kind, record.id, 'upsert', now)
  }
}

export async function updateEntityVersion(kind: EntityKind, id: string, version: number): Promise<void> {
  if (kind === 'profile') await db.profile.update(id, { version })
  if (kind === 'umas') await db.umas.update(id, { version })
  if (kind === 'cards') await db.cards.update(id, { version })
  if (kind === 'badges') await db.badges.update(id, { version })
  if (kind === 'farm') await db.farm.update(id, { version })
  if (kind === 'items') await db.items.update(id, { version })
  if (kind === 'rpgOutfits') await db.rpgOutfits.update(id, { version })
  if (kind === 'rpgPresets') await db.rpgPresets.update(id, { version })
  if (kind === 'rpgCheckpoints') await db.rpgCheckpoints.update(id, { version })
}
