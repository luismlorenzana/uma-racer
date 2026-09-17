import {
  migratePlayerProfileV1,
  migrateUmaSaveV1,
  parseLegacyPlayerProfileV1,
  parseLegacyUmaSaveV1,
  parsePlayerProfile,
  parseUmaSave,
  type CardSave,
  type EntityKind,
  type LedgerEntry,
  type LogKind,
  type PlayerProfile,
  type UmaSave,
} from '@racer/domain'
import Dexie, { type EntityTable, type Transaction } from 'dexie'

// Typed local-first save (docs/tasks/T003-stable-save-foundation.md). Every mutation persists its entity and
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
  badges!: EntityTable<VersionedRow<Record<string, unknown>>, 'id'>
  raceResults!: EntityTable<LogRow, 'id'>
  ledger!: EntityTable<LogRow<LedgerEntry>, 'id'>
  outbox!: EntityTable<OutboxRow, 'seq'>

  constructor() {
    super('uma-racer')
    const stores = {
      profile: 'id',
      umas: 'id',
      cards: 'id',
      badges: 'id',
      raceResults: 'id, createdAt',
      ledger: 'id, createdAt',
      outbox: '++seq, [kind+id]',
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
  }
}

export const db = new RacerDb()
