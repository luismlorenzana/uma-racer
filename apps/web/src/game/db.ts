import {
  parseCardSave,
  migrateCardSaveToCurrent,
  migrateUmaSaveToCurrent,
  migratePlayerProfileToCurrent,
  migratePlayerProfileV1,
  migratePlayerProfileV2,
  migratePlayerProfileV3,
  migrateUmaSaveV1,
  migrateUmaSaveV2,
  migrateUmaSaveV3,
  parseLegacyPlayerProfileV1,
  parseLegacyPlayerProfileV2,
  parseLegacyPlayerProfileV3,
  parseLegacyUmaSaveV1,
  parseLegacyUmaSaveV2,
  parseLegacyUmaSaveV3,
  parsePlayerProfile,
  parseBadgeState,
  parseUmaSave,
  parseUmaSaveOrThrow,
  type CardSave,
  type BadgeStateV1,
  type FlairEventV1,
  type EntityKind,
  type LedgerEntry,
  type LogKind,
  type PlayerProfile,
  type UmaSave,
} from '@racer/domain'
import Dexie, { type EntityTable, type Transaction } from 'dexie'
import type { AlbumPrefs } from './album/prefs'
import type { RunOutcome, RunReward, RunTarget } from './minigame-host'

// Typed local-first save (docs/technical/architecture.md). Every mutation persists its entity and
// outbox marker in one transaction before Zustand publishes it.

export interface VersionedRow<T> {
  id: string
  data: T
  version: number
}

export interface LogRow<T = Record<string, unknown>> {
  id: string
  createdAt: number
  data: T
}

export interface OutboxRow {
  seq?: number
  kind: EntityKind | LogKind
  id: string
  op: 'upsert' | 'append'
  queuedAt: number
}

export interface MinigameRunRow {
  id: string
  targetKey: string
  kind: RunTarget['kind']
  target: RunTarget
  tier: number
  attemptIndex: number
  seed: string
  status: 'open' | 'completed'
  outcome: RunOutcome | null
  reward: RunReward | null
  createdAt: number
  completedAt: number | null
}

interface LegacyProfileRow {
  id: 'main'
  tickets: number
  cardCoupons: number
  umaCoupons: number
  umaShards: number
  lastDailyGrant: string | null
  version: number
}

function migrateLegacyProfile(row: LegacyProfileRow | VersionedRow<unknown>): VersionedRow<unknown> {
  if ('data' in row) return row
  return {
    id: 'main',
    version: row.version,
    data: {
      schemaVersion: 1,
      tickets: row.tickets,
      cardCoupons: row.cardCoupons,
      umaCoupons: row.umaCoupons,
      umaShards: row.umaShards,
      lastDailyGrant: row.lastDailyGrant,
      featuredUmaId: null,
      starterSeedContentVersion: null,
      createdAt: 0,
    },
  }
}

class RacerDb extends Dexie {
  profile!: EntityTable<VersionedRow<PlayerProfile>, 'id'>
  umas!: EntityTable<VersionedRow<UmaSave>, 'id'>
  cards!: EntityTable<VersionedRow<CardSave>, 'id'>
  badges!: EntityTable<VersionedRow<BadgeStateV1>, 'id'>
  raceResults!: EntityTable<LogRow, 'id'>
  ledger!: EntityTable<LogRow<LedgerEntry>, 'id'>
  flairEvents!: EntityTable<LogRow<FlairEventV1>, 'id'>
  outbox!: EntityTable<OutboxRow, 'seq'>
  /** Device-local album preferences (D112). Never synced, never part of the save. */
  albumPrefs!: EntityTable<AlbumPrefs, 'id'>
  /** Device-local in-flight/replay journal. Never synced and never part of the save (T058). */
  minigameRuns!: EntityTable<MinigameRunRow, 'id'>

  constructor() {
    super('uma-racer')
    const stores = {
      profile: 'id',
      umas: 'id',
      cards: 'id',
      badges: 'id',
      raceResults: 'id, createdAt',
      ledger: 'id, createdAt',
      flairEvents: 'id, createdAt',
      outbox: '++seq, [kind+id]',
    }
    const storesWithAlbumPrefs = { ...stores, albumPrefs: 'id' }
    const storesWithMinigameRuns = {
      ...storesWithAlbumPrefs,
      minigameRuns: 'id, targetKey, [targetKey+status], [targetKey+attemptIndex]',
    }
    this.version(1).stores(stores)
    this.version(2).stores(stores).upgrade(async (tx: Transaction) => {
      const table = tx.table('profile')
      const legacy = (await table.get('main')) as LegacyProfileRow | VersionedRow<PlayerProfile> | undefined
      if (legacy) await table.put(migrateLegacyProfile(legacy))
    })
    this.version(3).stores(stores).upgrade(async (tx: Transaction) => {
      const profileTable = tx.table('profile')
      const umaTable = tx.table('umas')
      const outboxTable = tx.table('outbox')
      const queuedAt = Date.now()
      const queue = async (kind: EntityKind, id: string) => {
        await outboxTable.where('[kind+id]').equals([kind, id]).delete()
        await outboxTable.add({ kind, id, op: 'upsert', queuedAt })
      }

      const profileRow = await profileTable.get('main') as VersionedRow<unknown> | undefined
      if (profileRow && !parsePlayerProfile(profileRow.data)) {
        const legacy = parseLegacyPlayerProfileV1(profileRow.data)
        if (!legacy) throw new Error('Local player profile cannot be migrated')
        await profileTable.put({ ...profileRow, data: migratePlayerProfileV1(legacy) })
        await queue('profile', 'main')
      }

      const umaRows = await umaTable.toArray() as VersionedRow<unknown>[]
      for (const row of umaRows) {
        if (parseUmaSave(row.data)) continue
        const legacy = parseLegacyUmaSaveV1(row.data)
        if (!legacy) throw new Error(`Local Uma ${row.id} cannot be migrated`)
        const migrated = migrateUmaSaveV1(legacy)
        if (migrated.templateId !== row.id) throw new Error(`Local Uma ${row.id} has mismatched data`)
        await umaTable.put({ ...row, data: migrated })
        await queue('umas', row.id)
      }
    })
    this.version(4).stores(stores).upgrade(async (tx: Transaction) => {
      const badges = await tx.table('badges').toArray() as VersionedRow<unknown>[]
      for (const row of badges) {
        const parsed = parseBadgeState(row.data)
        if (!parsed || (parsed.scope === 'uma' ? row.id !== `uma:${parsed.umaId}` : row.id !== 'trainer')) {
          throw new Error(`Local badge ${row.id} cannot be migrated`)
        }
      }
    })
    this.version(5).stores(stores).upgrade(async (tx: Transaction) => {
      const profileTable = tx.table('profile')
      const umaTable = tx.table('umas')
      const outboxTable = tx.table('outbox')
      const queuedAt = Date.now()
      const queue = async (kind: EntityKind, id: string) => {
        await outboxTable.where('[kind+id]').equals([kind, id]).delete()
        await outboxTable.add({ kind, id, op: 'upsert', queuedAt })
      }

      const profileRow = await profileTable.get('main') as VersionedRow<unknown> | undefined
      if (profileRow && !parsePlayerProfile(profileRow.data)) {
        const legacy = parseLegacyPlayerProfileV2(profileRow.data)
        if (!legacy) throw new Error('Local v2 player profile cannot be migrated')
        await profileTable.put({ ...profileRow, data: migratePlayerProfileV2(legacy) })
        await queue('profile', 'main')
      }

      const umaRows = await umaTable.toArray() as VersionedRow<unknown>[]
      for (const row of umaRows) {
        if (parseUmaSave(row.data)) continue
        const legacy = parseLegacyUmaSaveV2(row.data)
        if (!legacy) throw new Error(`Local v2 Uma ${row.id} cannot be migrated`)
        const migrated = migrateUmaSaveV2(legacy)
        if (migrated.templateId !== row.id) throw new Error(`Local Uma ${row.id} has mismatched data`)
        await umaTable.put({ ...row, data: migrated })
        await queue('umas', row.id)
      }
    })
    // Additive: album preferences are device-local, so there is nothing to migrate.
    this.version(6).stores(storesWithAlbumPrefs)
    this.version(7).stores(storesWithAlbumPrefs).upgrade(async (tx: Transaction) => {
      const profileTable = tx.table('profile')
      const umaTable = tx.table('umas')
      const outboxTable = tx.table('outbox')
      const queuedAt = Date.now()
      const queue = async (kind: EntityKind, id: string) => {
        await outboxTable.where('[kind+id]').equals([kind, id]).delete()
        await outboxTable.add({ kind, id, op: 'upsert', queuedAt })
      }

      const profileRow = await profileTable.get('main') as VersionedRow<unknown> | undefined
      if (profileRow && !parsePlayerProfile(profileRow.data)) {
        const legacy = parseLegacyPlayerProfileV3(profileRow.data)
        if (!legacy) throw new Error('Local v3 player profile cannot be migrated')
        await profileTable.put({ ...profileRow, data: migratePlayerProfileV3(legacy) })
        await queue('profile', 'main')
      }

      const umaRows = await umaTable.toArray() as VersionedRow<unknown>[]
      for (const row of umaRows) {
        if (parseUmaSave(row.data)) continue
        if (typeof row.data === 'object' && row.data !== null && 'schemaVersion' in row.data && row.data.schemaVersion === 4) {
          parseUmaSaveOrThrow(row.data)
        }
        const legacy = parseLegacyUmaSaveV3(row.data)
        if (!legacy) throw new Error(`Local v3 Uma ${row.id} cannot be migrated`)
        const migrated = migrateUmaSaveV3(legacy)
        if (migrated.templateId !== row.id) throw new Error(`Local Uma ${row.id} has mismatched data`)
        await umaTable.put({ ...row, data: migrated })
        await queue('umas', row.id)
      }
    })
    // Additive: open minigame runs are device-local replay state, so there is nothing to migrate.
    this.version(8).stores(storesWithMinigameRuns)
    // Each schema bump re-runs the same walk: bumping the Dexie version is how it knows to run again.
    this.version(9).stores(storesWithMinigameRuns).upgrade(walkRowsToCurrent)
    // Save v7 (D147, D148): stars and re-denominated tickets.
    this.version(10).stores(storesWithMinigameRuns).upgrade(walkRowsToCurrent)
  }
}

/**
 * Walks every stored row forward with the domain's migration chain, re-queueing whatever moved so the cloud copy
 * catches up.
 *
 * The upgrades above each knew one hop, so a database already at version 7 never re-ran them and a save left at v4 or
 * v5 simply stopped parsing. This one is version-agnostic: it asks the chain, which is the single place a schema bump
 * has to be taught about.
 */
async function walkRowsToCurrent(tx: Transaction): Promise<void> {
  const queuedAt = Date.now()
  const outboxTable = tx.table('outbox')
  const queue = async (kind: EntityKind, id: string) => {
    await outboxTable.where('[kind+id]').equals([kind, id]).delete()
    await outboxTable.add({ kind, id, op: 'upsert', queuedAt })
  }

  const profileTable = tx.table('profile')
  const profileRow = await profileTable.get('main') as VersionedRow<unknown> | undefined
  if (profileRow && !parsePlayerProfile(profileRow.data)) {
    const migrated = migratePlayerProfileToCurrent(profileRow.data)
    if (!migrated) throw new Error('Local player profile cannot be migrated')
    await profileTable.put({ ...profileRow, data: migrated })
    await queue('profile', 'main')
  }

  const umaTable = tx.table('umas')
  for (const row of await umaTable.toArray() as VersionedRow<unknown>[]) {
    if (parseUmaSave(row.data)) continue
    const migrated = migrateUmaSaveToCurrent(row.data)
    if (!migrated) throw new Error(`Local Uma ${row.id} cannot be migrated`)
    if (migrated.templateId !== row.id) throw new Error(`Local Uma ${row.id} has mismatched data`)
    await umaTable.put({ ...row, data: migrated })
    await queue('umas', row.id)
  }

  const cardTable = tx.table('cards')
  for (const row of await cardTable.toArray() as VersionedRow<unknown>[]) {
    if (parseCardSave(row.data)) continue
    const migrated = migrateCardSaveToCurrent(row.data)
    if (!migrated) throw new Error(`Local card ${row.id} cannot be migrated`)
    if (migrated.templateId !== row.id) throw new Error(`Local card ${row.id} has mismatched data`)
    await cardTable.put({ ...row, data: migrated })
    await queue('cards', row.id)
  }
}

export const db = new RacerDb()
