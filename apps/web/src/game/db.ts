import {
  GATE_SHARD_REWARD,
  UMA_LEVEL_TICKET_REWARD,
  parseLegacyPlayerProfileV11,
  parseLegacyPlayerProfileV12,
  umaGateShardLedgerId,
  umaLevelTicketLedgerId,
  migrateFarmStateToCurrent,
  parseFarmState,
  parseCardSave,
  migrateCardSaveToCurrent,
  migrateUmaSaveWithSurplus,
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
  parseLegacyUmaSaveV10,
  parsePlayerProfile,
  parseBadgeState,
  parseUmaSave,
  parseUmaSaveOrThrow,
  type CardSave,
  type BadgeStateV1,
  type FlairEventV1,
  type EntityKind,
  type LedgerEntry,
  type FarmState,
  type InventoryStackData,
  type ItemLedgerEntry,
  type LogKind,
  type PlayerProfile,
  type UmaSave,
  type RpgOutfitSaveV1,
  type RpgPresetSaveV1,
  type RpgCheckpointSaveV1,
  type RpgResultEvidenceV1,
  type RpgPromotionEvidenceV1,
  type RpgCommandReceiptV1,
} from '@racer/domain'
import Dexie, { type EntityTable, type Table, type Transaction } from 'dexie'
import type { AlbumPrefs } from './album/prefs'
import type { MinigameRunSnapshotV1, ReplayJournalV1 } from './minigame-journal'
import type { RunTarget, StoredRunOutcome, StoredRunReward } from './minigame-host'
import { localDay } from './store'
import type { CombatAction } from '@racer/domain'

// Typed local-first save (docs/technical/architecture.md). Every mutation persists its entity and
// outbox marker in one transaction before Zustand publishes it.

export interface VersionedRow<T> {
  id: string
  data: T
  version: number
}

/** Server entity version plus a device-local optimistic command revision for stale-screen protection. */
export interface FarmRow extends VersionedRow<FarmState> {
  revision: number
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
  outcome: StoredRunOutcome | null
  reward: StoredRunReward | null
  createdAt: number
  completedAt: number | null
  /** Engine-tagged frozen inputs and action journal. Device-local only (D168, D171, D185). */
  snapshot?: MinigameRunSnapshotV1
  journal?: ReplayJournalV1
}

/** Device-local command queue; no RPG rewards are projected before server acknowledgement. */
export interface PendingRpgCommandRow {
  id: string
  body: unknown
  status: 'pending' | 'conflict'
  queuedAt: number
  conflict: unknown | null
  /** A result cannot be sent until its entry/takeover receipt is installed. */
  dependsOn?: string | null
}

/** Device-local RPG battle replay; never joins the cloud save or ordinary outbox. */
export interface RpgBattleJournalRow {
  id: string
  entryId: string
  retryOrdinal: number
  engineVersion: 1
  frozenHash: string
  actions: CombatAction[]
  stateHash: string
  terminal: 'open' | 'win' | 'loss' | 'abandoned'
  commitStatus: 'none' | 'pending' | 'accepted' | 'conflict'
  createdAt: number
  updatedAt: number
}

/** Ownership marker survives a missing/corrupt journal so another device still needs takeover. */
export interface RpgBattleClaimRow {
  id: string
  leaseRevision: number
}

export interface RpgBattleArchiveRow {
  id: string
  journal: RpgBattleJournalRow
  reason: 'takeover'
}

interface LegacyMinigameRunRow extends Omit<MinigameRunRow, 'journal' | 'snapshot'> {
  setup?: unknown
  actions?: unknown
  journal?: unknown
  sparkSnapshot?: unknown
  snapshot?: unknown
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
  farm!: EntityTable<FarmRow, 'id'>
  items!: EntityTable<VersionedRow<InventoryStackData>, 'id'>
  itemLedger!: EntityTable<LogRow<ItemLedgerEntry>, 'id'>
  rpgOutfits!: EntityTable<VersionedRow<RpgOutfitSaveV1>, 'id'>
  rpgPresets!: EntityTable<VersionedRow<RpgPresetSaveV1>, 'id'>
  rpgCheckpoints!: EntityTable<VersionedRow<RpgCheckpointSaveV1>, 'id'>
  rpgResults!: EntityTable<LogRow<RpgResultEvidenceV1>, 'id'>
  rpgPromotions!: EntityTable<LogRow<RpgPromotionEvidenceV1>, 'id'>
  rpgReceipts!: EntityTable<LogRow<RpgCommandReceiptV1>, 'id'>
  pendingRpgCommands!: EntityTable<PendingRpgCommandRow, 'id'>
  rpgBattleJournals!: EntityTable<RpgBattleJournalRow, 'id'>
  rpgBattleClaims!: EntityTable<RpgBattleClaimRow, 'id'>
  rpgBattleArchives!: EntityTable<RpgBattleArchiveRow, 'id'>
  outbox!: EntityTable<OutboxRow, 'seq'>
  /** Device-local album preferences (D112). Never synced, never part of the save. */
  albumPrefs!: EntityTable<AlbumPrefs, 'id'>
  /** Device-local in-flight/replay journal. Never synced and never part of the save (D168, D171). */
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
    const storesWithFarm = {
      ...storesWithMinigameRuns,
      farm: 'id',
      items: 'id',
      itemLedger: 'id, createdAt',
    }
    const storesWithRpg = { ...storesWithFarm,
      rpgOutfits: 'id', rpgPresets: 'id', rpgCheckpoints: 'id',
      rpgResults: 'id, createdAt', rpgPromotions: 'id, createdAt', rpgReceipts: 'id, createdAt',
      pendingRpgCommands: 'id, status, queuedAt',
    }
    const storesWithBattleJournal = { ...storesWithRpg,
      rpgBattleJournals: 'id, entryId, [entryId+retryOrdinal]',
      rpgBattleClaims: 'id',
      rpgBattleArchives: 'id',
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
        if (isCurrentOrV10(row.data)) continue
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
        if (isCurrentOrV10(row.data)) continue
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
        if (isCurrentOrV10(row.data)) continue
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
    // Additive device-local journal fields. Open legacy Spark rows adopt lazily once verified content is available.
    this.version(11).stores(storesWithMinigameRuns)
    // One engine-tagged snapshot and journal for every open minigame. Completed rows remain byte-identical history.
    this.version(12).stores(storesWithMinigameRuns).upgrade(migrateOpenMinigameJournals)
    // Save v8 (D200): cards move to three stars. Owed coupons and five-star runs settle at startup, where every path meets.
    this.version(13).stores(storesWithMinigameRuns).upgrade(walkRowsToCurrent)
    // Additive synced Farm projections and evidence. Farm initializes lazily; migrations fabricate no rows.
    this.version(14).stores(storesWithFarm)
    // Save v9: free Stat assignments become explicit legacy Produce, without fabricating inventory or evidence.
    this.version(15).stores(storesWithFarm).upgrade(walkRowsToCurrent)
    // Save v10 adds nullable per-outfit racing preferences; all v9 rows keep their frozen careers.
    this.version(16).stores(storesWithFarm).upgrade(walkRowsToCurrent)
    // Save v11 (D211, D212): linear Training Levels. Units re-level once, and what passes TL10 is banked on the profile.
    this.version(17).stores(storesWithFarm).upgrade(walkRowsToCurrent)
    // Additive RPG state and device-local pending command queue. No enrollment is synthesized.
    this.version(18).stores(storesWithRpg)
    this.version(19).stores(storesWithBattleJournal)
    // Farm v2 (D234): uncapped Farming Levels, Sections of numbered plots.
    this.version(20).stores(storesWithBattleJournal).upgrade(migrateFarmRow)
    // Save v12 (D235): every Uma and the profile walk forward; Produce nodes become each unit's Extra stats grid.
    this.version(21).stores(storesWithBattleJournal).upgrade(walkRowsToCurrent)
    // Save v13 (D241): every scenario's Uma Levels cost the same. Each Uma re-levels through this scenario's EXP, and
    // the levels it reaches pay their tickets (and a gate its shard) as race levels do.
    this.version(22).stores(storesWithBattleJournal).upgrade(walkRowsToCurrent)
  }
}

/** An Uma's save-v13 re-levelling (D241): the levels it reached and the gate, if it reached one. */
export interface UmaRelevelPayout {
  umaId: string
  levelsGained: readonly number[]
  gateReached: number | null
}

/**
 * Pays what save v13's re-levelling reached as race levels pay (D241): a ticket a level and a gate's Uma Shard, each
 * under the race's own ledger id, so a level already paid is never paid again. Runs inside the caller's transaction
 * over the profile, ledger and outbox tables; without a profile there is nothing to pay into.
 */
export async function payUmaRelevels(
  tables: { profile: Table; ledger: Table; outbox: Table },
  relevels: readonly UmaRelevelPayout[],
  now: number,
): Promise<void> {
  const row = await tables.profile.get('main') as VersionedRow<unknown> | undefined
  const profile = row ? parsePlayerProfile(row.data) : null
  if (!row || !profile) return
  const today = localDay(new Date(now))
  const queue = async (kind: EntityKind | LogKind, id: string, op: 'upsert' | 'append') => {
    await tables.outbox.where('[kind+id]').equals([kind, id]).delete()
    await tables.outbox.add({ kind, id, op, queuedAt: now })
  }
  let tickets = 0
  let shards = 0
  for (const relevel of relevels) {
    const rewards = [
      ...relevel.levelsGained.map((level) => ({ id: umaLevelTicketLedgerId(relevel.umaId, level), resource: 'tickets' as const, delta: UMA_LEVEL_TICKET_REWARD })),
      ...(relevel.gateReached === null ? [] : [{ id: umaGateShardLedgerId(relevel.umaId, relevel.gateReached), resource: 'uma-shards' as const, delta: GATE_SHARD_REWARD }]),
    ]
    for (const reward of rewards) {
      if (await tables.ledger.get(reward.id)) continue
      const entry: LedgerEntry = { resource: reward.resource, delta: reward.delta, reason: 'uma-level', localDay: today, createdAt: now }
      await tables.ledger.add({ id: reward.id, data: entry, createdAt: now })
      await queue('ledger', reward.id, 'append')
      if (reward.resource === 'tickets') tickets += reward.delta
      else shards += reward.delta
    }
  }
  if (tickets === 0 && shards === 0) return
  await tables.profile.put({ ...row, data: { ...profile, tickets: profile.tickets + tickets, umaShards: profile.umaShards + shards } })
  await queue('profile', 'main', 'upsert')
}

async function migrateFarmRow(tx: Transaction): Promise<void> {
  const farmTable = tx.table('farm')
  const row = await farmTable.get('main') as (VersionedRow<unknown> & { revision: number }) | undefined
  if (!row || parseFarmState(row.data)) return
  const migrated = migrateFarmStateToCurrent(row.data)
  if (!migrated) throw new Error('Local Farm cannot be migrated')
  await farmTable.put({ ...row, data: migrated, revision: row.revision + 1 })
  const outboxTable = tx.table('outbox')
  await outboxTable.where('[kind+id]').equals(['farm', 'main']).delete()
  await outboxTable.add({ kind: 'farm', id: 'main', op: 'upsert', queuedAt: Date.now() })
}

/** A row the old per-hop upgrades must leave alone: current, or already at v10, which the chain re-levels once. */
const isCurrentOrV10 = (data: unknown): boolean => parseUmaSave(data) !== null || parseLegacyUmaSaveV10(data) !== null

async function migrateOpenMinigameJournals(tx: Transaction): Promise<void> {
  const table = tx.table('minigameRuns')
  const rows = await table.toArray() as LegacyMinigameRunRow[]
  for (const row of rows) {
    if (row.status !== 'open') continue
    if (row.kind === 'friendship-training' && row.snapshot === undefined && row.journal === undefined && row.setup !== undefined) {
      const migrated: Record<string, unknown> = {
        ...row,
        snapshot: { version: 1, setup: row.setup },
        journal: { format: 1, engine: 'friendship-training-v1', actions: row.actions ?? [] },
      }
      delete migrated.setup
      delete migrated.actions
      await table.put(migrated)
      continue
    }
    if (row.kind === 'spark-match' && row.snapshot === undefined && row.sparkSnapshot !== undefined) {
      const migrated: Record<string, unknown> = { ...row, snapshot: row.sparkSnapshot }
      delete migrated.sparkSnapshot
      await table.put(migrated)
    }
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
  let migratedProfile: PlayerProfile | null = null
  if (profileRow && !parsePlayerProfile(profileRow.data)) {
    migratedProfile = migratePlayerProfileToCurrent(profileRow.data)
    if (!migratedProfile) throw new Error('Local player profile cannot be migrated')
  }

  const umaTable = tx.table('umas')
  let surplusExp = 0
  const relevels: UmaRelevelPayout[] = []
  for (const row of await umaTable.toArray() as VersionedRow<unknown>[]) {
    if (parseUmaSave(row.data)) continue
    const migrated = migrateUmaSaveWithSurplus(row.data)
    if (!migrated) throw new Error(`Local Uma ${row.id} cannot be migrated`)
    if (migrated.uma.templateId !== row.id) throw new Error(`Local Uma ${row.id} has mismatched data`)
    surplusExp += migrated.surplusExp
    relevels.push({ umaId: row.id, levelsGained: migrated.levelsGained, gateReached: migrated.gateReached })
    await umaTable.put({ ...row, data: migrated.uma })
    await queue('umas', row.id)
  }

  // What the v11 re-levelling carried past TL10 is banked on the profile it migrated with, once (D212); a v11 or v12
  // profile already banked it, and only takes the stamp. Startup turns every full level of it into a Level-Up Ticket.
  if (profileRow && migratedProfile) {
    const bank = parseLegacyPlayerProfileV11(profileRow.data) || parseLegacyPlayerProfileV12(profileRow.data) ? 0 : surplusExp
    await profileTable.put({ ...profileRow, data: { ...migratedProfile, trainingExpBank: migratedProfile.trainingExpBank + bank } })
    await queue('profile', 'main')
  }
  await payUmaRelevels({ profile: profileTable, ledger: tx.table('ledger'), outbox: outboxTable }, relevels, queuedAt)

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
