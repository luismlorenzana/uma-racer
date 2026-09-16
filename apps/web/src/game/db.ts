import { SAVE_SCHEMA_VERSION, type CardSave, type EntityKind, type LedgerEntry, type LogKind, type PlayerProfile, type UmaSave } from '@racer/domain'
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

function migrateLegacyProfile(row: LegacyProfileRow | VersionedRow<PlayerProfile>): VersionedRow<PlayerProfile> {
  if ('data' in row) return row
  return {
    id: 'main',
    version: row.version,
    data: {
      schemaVersion: SAVE_SCHEMA_VERSION,
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
  }
}

export const db = new RacerDb()
