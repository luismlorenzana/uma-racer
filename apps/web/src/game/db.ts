import Dexie, { type EntityTable } from 'dexie'

// Local-first save (docs/technical/architecture.md#1-local-first-game-state). The Zustand store hydrates from
// here at boot; every mutation writes back and queues an outbox entry for background sync.

export interface ProfileRow {
  id: 'main'
  tickets: number
  cardCoupons: number
  umaCoupons: number
  umaShards: number
  /** Local date (YYYY-MM-DD) of the last daily ticket grant. */
  lastDailyGrant: string | null
  /** Server version for optimistic sync (0 = never synced). */
  version: number
}

export interface EntityRow {
  id: string
  data: Record<string, unknown>
  version: number
}

export interface LogRow {
  id: string
  createdAt: number
  data: Record<string, unknown>
}

export interface OutboxRow {
  seq?: number
  kind: 'profile' | 'umas' | 'cards' | 'badges' | 'raceResults' | 'ledger'
  id: string
  op: 'upsert' | 'append'
  queuedAt: number
}

class RacerDb extends Dexie {
  profile!: EntityTable<ProfileRow, 'id'>
  umas!: EntityTable<EntityRow, 'id'>
  cards!: EntityTable<EntityRow, 'id'>
  badges!: EntityTable<EntityRow, 'id'>
  raceResults!: EntityTable<LogRow, 'id'>
  ledger!: EntityTable<LogRow, 'id'>
  outbox!: EntityTable<OutboxRow, 'seq'>

  constructor() {
    super('uma-racer')
    this.version(1).stores({
      profile: 'id',
      umas: 'id',
      cards: 'id',
      badges: 'id',
      raceResults: 'id, createdAt',
      ledger: 'id, createdAt',
      outbox: '++seq, [kind+id]',
    })
  }
}

export const db = new RacerDb()
