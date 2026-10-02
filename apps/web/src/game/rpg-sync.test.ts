import 'fake-indexeddb/auto'
import { createPlayerProfile, enrollRpgOutfit, type RpgCommandRequest } from '@racer/domain'
import Dexie from 'dexie'
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { saveApi } from '../api/client'
import { db } from './db'
import { adoptServerSnapshot, readLocalSnapshot } from './persistence'
import { enqueueRpgCommand, flushOneRpgCommand } from './rpg-sync'

const stats = { speed: 100, stamina: 100, power: 100, guts: 100, wit: 100 }
const growth = { speed: 0, stamina: 0, power: 0, guts: 0, wit: 0 }
const aptitudes = { surface: { turf: 'A', dirt: 'B' }, distance: { sprint: 'B', mile: 'A', medium: 'A', long: 'C' },
  strategy: { front: 'D', pace: 'A', late: 'B', end: 'C' } } as const
const profile = enrollRpgOutfit({ outfit: { id: 'synthetic-outfit', baseStats: stats, growthRates: growth, aptitudes },
  contentVersion: 'synthetic-v1', style: 'pace', weapon: 'spear', defaultSignature: 'fire' })
const outfit = { schemaVersion: 1 as const, profile, projectionRevision: 0 }
const player = createPlayerProfile('synthetic-v1', 1)
const command: RpgCommandRequest = { schemaVersion: 1, commandId: 'enroll-1', action: 'enroll',
  expected: [{ kind: 'umas', id: profile.outfitId, version: 1 }, { kind: 'rpgOutfits', id: profile.outfitId, version: 0 }],
  upserts: [{ kind: 'rpgOutfits', id: profile.outfitId, data: outfit as unknown as Record<string, unknown> }], appends: [] }
const receipt = { schemaVersion: 1, commandId: command.commandId, action: command.action,
  payloadHash: 'a'.repeat(64), applied: [{ kind: 'rpgOutfits', id: profile.outfitId, version: 1 }],
  appendedIds: [], createdAt: 10 }
const entity = { kind: 'rpgOutfits', id: profile.outfitId, version: 1, data: outfit, deleted: false, updatedAt: 10 }
const receiptLog = { kind: 'rpgReceipts', id: command.commandId, data: receipt, createdAt: 10 }

describe('RPG IndexedDB save and pending commands', () => {
  beforeEach(async () => {
    db.close()
    await db.delete()
    await db.open()
  })
  afterEach(() => { vi.restoreAllMocks(); db.close() })

  it('opens the additive current schema without inventing RPG enrollments or changing an older profile', async () => {
    expect(db.verno).toBe(22)
    expect(await db.rpgOutfits.count()).toBe(0)
    expect(await db.rpgPresets.count()).toBe(0)
    expect(await db.pendingRpgCommands.count()).toBe(0)
    await db.profile.put({ id: 'main', data: player, version: 3 })
    expect((await readLocalSnapshot())?.profile.version).toBe(3)
  })

  it('migrates a v17 database to v19 without fabricating enrollments or changing existing tables', async () => {
    db.close()
    await db.delete()
    const old = new Dexie('uma-racer')
    old.version(17).stores({ profile: 'id', umas: 'id', cards: 'id', badges: 'id',
      raceResults: 'id, createdAt', ledger: 'id, createdAt', flairEvents: 'id, createdAt',
      outbox: '++seq, [kind+id]', albumPrefs: 'id',
      minigameRuns: 'id, targetKey, [targetKey+status], [targetKey+attemptIndex]',
      farm: 'id', items: 'id', itemLedger: 'id, createdAt' })
    await old.open()
    await old.table('profile').put({ id: 'main', data: player, version: 7 })
    await old.table('items').put({ id: 'synthetic-item', data: { itemId: 'synthetic-item', quantity: 2, updatedAt: 1 }, version: 3 })
    old.close()
    await db.open()
    expect(db.verno).toBe(22)
    expect((await db.profile.get('main'))?.version).toBe(7)
    expect((await db.items.get('synthetic-item'))?.version).toBe(3)
    expect(await db.rpgOutfits.count()).toBe(0)
    expect(await db.pendingRpgCommands.count()).toBe(0)
  })

  it('adds a device-only battle journal and lease marker to an existing v18 RPG save', async () => {
    db.close()
    await db.delete()
    const old = new Dexie('uma-racer')
    old.version(18).stores({ profile: 'id', umas: 'id', cards: 'id', badges: 'id',
      raceResults: 'id, createdAt', ledger: 'id, createdAt', flairEvents: 'id, createdAt',
      outbox: '++seq, [kind+id]', albumPrefs: 'id',
      minigameRuns: 'id, targetKey, [targetKey+status], [targetKey+attemptIndex]',
      farm: 'id', items: 'id', itemLedger: 'id, createdAt',
      rpgOutfits: 'id', rpgPresets: 'id', rpgCheckpoints: 'id',
      rpgResults: 'id, createdAt', rpgPromotions: 'id, createdAt', rpgReceipts: 'id, createdAt',
      pendingRpgCommands: 'id, status, queuedAt' })
    await old.open()
    await old.table('rpgOutfits').put({ id: profile.outfitId, data: outfit, version: 3 })
    old.close()
    await db.open()
    expect(db.verno).toBe(22)
    expect((await db.rpgOutfits.get(profile.outfitId))?.version).toBe(3)
    expect(await db.rpgBattleJournals.count()).toBe(0)
    expect(await db.rpgBattleClaims.count()).toBe(0)
    expect(await db.rpgBattleArchives.count()).toBe(0)
  })

  it('preserves locally acknowledged RPG rows when an older cloud snapshot lacks them', async () => {
    await db.rpgOutfits.put({ id: profile.outfitId, data: outfit, version: 2 })
    const cloud = { entities: [{ kind: 'profile', id: 'main', version: 1, data: player,
      deleted: false, updatedAt: 5 }], logs: [], serverTime: 5 }
    expect(await adoptServerSnapshot(cloud)).toBe('adopted')
    expect((await readLocalSnapshot())?.rpgOutfits).toMatchObject([{ id: profile.outfitId, version: 2 }])
  })

  it('keeps two chapter checkpoints and fails visibly on a corrupt local RPG row', async () => {
    await db.profile.put({ id: 'main', data: player, version: 1 })
    const checkpoint = (chapterId: string) => ({ schemaVersion: 1 as const, presetId: 'party-1', chapterId,
      contentVersion: 'synthetic-v1', contentHash: 'a'.repeat(64), attemptIndex: 1,
      attemptId: `rpg-attempt:party-1:${chapterId}:1`, lastClearedNodeId: null, selectedPath: [],
      status: 'at-checkpoint' as const, revision: 0, frozenEntry: null })
    await db.rpgCheckpoints.bulkPut(['chapter-a', 'chapter-b'].map((chapterId) => ({ id: `party-1:${chapterId}`,
      data: checkpoint(chapterId), version: 1 })))
    expect((await readLocalSnapshot())?.rpgCheckpoints.map((row) => row.id).sort()).toEqual(['party-1:chapter-a', 'party-1:chapter-b'])
    await db.rpgOutfits.put({ id: profile.outfitId, version: 1,
      data: { ...outfit, profile: { ...profile, tree: Array(26).fill({ tier: 1, weapon: 'spear',
        element: 'fire', depth: 1, branch: 'foundation', level: 1 }) } } })
    await expect(readLocalSnapshot()).rejects.toThrow(/Invalid local rpgOutfits/)
    // Simulate a database written by a future app version; the current TS type intentionally cannot express it.
    await db.rpgOutfits.put({ id: profile.outfitId, version: 1, data: { ...outfit, schemaVersion: 2 } as unknown as typeof outfit })
    await expect(readLocalSnapshot()).rejects.toThrow(/App update required for RPG schema 2/)
  })

  it('does not project a queued reward on conflict; an accepted response installs it once', async () => {
    await db.profile.put({ id: 'main', data: player, version: 1 })
    await enqueueRpgCommand(command, 9)
    expect((await readLocalSnapshot())?.rpgOutfits).toHaveLength(0)
    vi.spyOn(saveApi, 'rpgCommand').mockResolvedValueOnce({ status: 'conflict', authoritative: [
      { kind: 'rpgOutfits', id: profile.outfitId, record: null },
    ] })
    expect(await flushOneRpgCommand()).toBe(false)
    expect((await db.pendingRpgCommands.get(command.commandId))?.status).toBe('conflict')
    expect((await readLocalSnapshot())?.rpgOutfits).toHaveLength(0)
    await db.pendingRpgCommands.update(command.commandId, { status: 'pending', conflict: null })
    vi.spyOn(saveApi, 'rpgCommand').mockResolvedValueOnce({ status: 'applied', receipt,
      entities: [entity], logs: [receiptLog] })
    expect(await flushOneRpgCommand()).toBe(true)
    expect((await readLocalSnapshot())?.rpgOutfits).toHaveLength(1)
    expect(await db.pendingRpgCommands.count()).toBe(0)
    expect(await db.rpgReceipts.count()).toBe(1)
  })

  it('recovers a duplicate acknowledgement by pulling its authoritative saved rows', async () => {
    await db.profile.put({ id: 'main', data: player, version: 1 })
    await enqueueRpgCommand(command, 9)
    vi.spyOn(saveApi, 'rpgCommand').mockResolvedValue({ status: 'duplicate', receipt, entities: [], logs: [] })
    vi.spyOn(saveApi, 'load').mockResolvedValue({ entities: [
      { kind: 'profile', id: 'main', version: 1, data: player, deleted: false, updatedAt: 1 }, entity,
    ], logs: [receiptLog], serverTime: 11 })
    expect(await flushOneRpgCommand()).toBe(true)
    expect((await readLocalSnapshot())?.rpgOutfits).toHaveLength(1)
    expect(await db.pendingRpgCommands.count()).toBe(0)
  })
})
