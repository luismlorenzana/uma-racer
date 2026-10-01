import 'fake-indexeddb/auto'
import { createEncounter, enrollRpgOutfit, projectRpgStats, replay, rpgCheckpointId,
  type EncounterInput, type RpgCheckpointSaveV1, type RpgCommandRequest,
  type RpgOutfitSaveV1, type RpgPresetSaveV1 } from '@racer/domain'
import { syntheticEnemy } from '../../../../packages/domain/src/rpg/combat/synthetic'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { parseRpgCommandRequest, resolveRpgCommand } from '../../../api/src/save/rpg-command'
import { saveApi } from '../api/client'
import { db } from './db'
import { decodeKit, DexieRpgBattleHost, encodeKit, rpgBattleJournalId } from './rpg-battle-host'
import { flushOneRpgCommand } from './rpg-sync'

const uid = 'synthetic-account'
const chapterId = 'invented-chapter'
const nodeId = 'invented-node'
const checkpointId = rpgCheckpointId('party-1', chapterId)
const contentHash = 'a'.repeat(64)
const baseStats = { speed: 400, stamina: 400, power: 400, guts: 400, wit: 400 }
const growthRates = { speed: 0, stamina: 0, power: 0, guts: 0, wit: 0 }
const aptitudes = { surface: { turf: 'A', dirt: 'B' }, distance: { sprint: 'B', mile: 'A', medium: 'A', long: 'C' },
  strategy: { front: 'D', pace: 'A', late: 'B', end: 'C' } } as const
const profiles = Array.from({ length: 5 }, (_, index) => enrollRpgOutfit({ outfit: {
  id: `invented-outfit-${index}`, baseStats, growthRates, aptitudes }, contentVersion: 'invented-v1',
style: 'pace', weapon: 'spear', defaultSignature: 'fire' }))
const outfits: RpgOutfitSaveV1[] = profiles.map((profile) => ({ schemaVersion: 1, profile, projectionRevision: 0 }))
const preset: RpgPresetSaveV1 = { schemaVersion: 1, presetId: 'party-1', name: 'Invented team',
  slots: profiles.map((profile) => ({ outfitId: profile.outfitId, signature: 'fire' as const, loadout: [] })) as unknown as RpgPresetSaveV1['slots'],
  foregroundChapterId: chapterId }
const checkpoint: RpgCheckpointSaveV1 = { schemaVersion: 1, presetId: 'party-1', chapterId,
  contentVersion: 'invented-v1', contentHash, attemptIndex: 1,
  attemptId: `rpg-attempt:party-1:${chapterId}:1`, lastClearedNodeId: null, selectedPath: [],
  status: 'at-checkpoint', revision: 0, frozenEntry: null }
const input: EncounterInput = { version: 1, contentVersion: checkpoint.contentVersion, seed: 0,
  weaknessFollowUp: 'bounded', allies: profiles.map((profile) => ({ id: profile.outfitId, style: profile.style,
    weapon: profile.weapon, tier: profile.tier, level: profile.level, stats: projectRpgStats(profile),
    affinities: profile.affinities, signature: 'fire', tree: [], legacy: [], loadout: [] })),
  enemies: [{ ...syntheticEnemy('invented-foe', 'ice'), stats: {
    ...syntheticEnemy('invented-foe', 'ice').stats, hp: 1 } }] }

type ServerEntity = Parameters<typeof resolveRpgCommand>[2] extends Map<string, infer T> ? T : never
type ServerLog = Parameters<typeof resolveRpgCommand>[3] extends Map<string, infer T> ? T : never
const serverEntities = new Map<string, ServerEntity>()
const serverLogs = new Map<string, ServerLog>()
let serverNow = 100
const host = new DexieRpgBattleHost(() => 50)

async function seed() {
  const entity = (kind: ServerEntity['kind'], id: string, data: unknown) => {
    const row = { kind, id, version: 1, data: data as Record<string, unknown>, deleted: false, updatedAt: 1 } as ServerEntity
    serverEntities.set(`${kind}/${id}`, row)
  }
  entity('rpgPresets', preset.presetId, preset)
  entity('rpgCheckpoints', checkpointId, checkpoint)
  await db.rpgPresets.put({ id: preset.presetId, version: 1, data: preset })
  await db.rpgCheckpoints.put({ id: checkpointId, version: 1, data: checkpoint })
  for (const outfit of outfits) {
    entity('rpgOutfits', outfit.profile.outfitId, outfit)
    await db.rpgOutfits.put({ id: outfit.profile.outfitId, version: 1, data: outfit })
  }
  vi.spyOn(saveApi, 'rpgCommand').mockImplementation(async (body: RpgCommandRequest) => {
    const parsed = parseRpgCommandRequest(body)
    if (typeof parsed === 'string') return { status: 'rejected', reason: parsed }
    const resolved = resolveRpgCommand(uid, parsed, serverEntities, serverLogs, ++serverNow)
    for (const row of resolved.writes) serverEntities.set(`${row.kind}/${row.id}`, row)
    for (const row of resolved.appends) serverLogs.set(`${row.kind}/${row.id}`, row)
    return resolved.response
  })
  vi.spyOn(saveApi, 'load').mockImplementation(async () => ({ entities: [...serverEntities.values()],
    logs: [...serverLogs.values()], serverTime: serverNow }))
}

describe('RPG battle host and device journal', () => {
  beforeEach(async () => {
    db.close()
    await db.delete()
    await db.open()
    serverEntities.clear()
    serverLogs.clear()
    serverNow = 100
    await seed()
  })
  afterEach(() => { vi.restoreAllMocks(); db.close() })

  it('round-trips a densely skilled five-member encounter within the frozen kit wire bound', () => {
    const elements = ['fire', 'ice', 'lightning', 'light', 'dark'] as const
    const branches = ['foundation', 'focused', 'committed', 'role', 'signature'] as const
    const tree = elements.flatMap((element) => branches.map((branch, depth) => ({ tier: 2,
      weapon: 'spear' as const, element, depth: depth + 1, branch, level: 1 })))
    const expanded: EncounterInput = { ...input, allies: input.allies.map((ally) => ({ ...ally,
      tier: 2, level: 50, tree, legacy: tree.slice(0, 2).map((skill) => ({ ...skill, tier: 1 })),
      loadout: tree.slice(0, 7).map(({ level: _level, ...ref }) => ref) })),
    enemies: Array.from({ length: 5 }, (_, index) => ({ ...syntheticEnemy(`foe-${index}`, 'ice'),
      moves: Array.from({ length: 8 }, (_, move) => ({ id: `move-${move}`,
        kind: 'damage' as const, channel: 'physical' as const, element: 'fire' as const,
        power: 120, target: 'front' as const, intentText: 'Invented sweeping attack' })),
      phaseTwo: { thresholdPercent: 50, moves: Array.from({ length: 8 }, (_, move) => ({
        id: `phase-${move}`, kind: 'damage' as const, channel: 'magical' as const,
        element: 'ice' as const, power: 150, target: 'seeded' as const,
        intentText: 'Invented late attack' })) } })) }
    const frozen = encodeKit(expanded)
    expect(frozen.length).toBeLessThanOrEqual(16_384)
    expect(decodeKit(frozen)).toEqual(expanded)
  })

  it('reserves once, replays actions after reload, rejects stale/illegal actions, and commits one acknowledged win', async () => {
    const entered = await host.enter(uid, checkpointId, nodeId, input)
    expect(entered.kind).toBe('pending')
    expect(await db.rpgBattleJournals.count()).toBe(1)
    const action = { kind: 'attack' as const, actorId: profiles[0]!.outfitId, targetId: 'invented-foe' }
    expect((await host.submitAction(checkpointId, 0, action)).kind).toBe('pending')
    await expect(host.submitAction(checkpointId, 0, action)).rejects.toThrow(/unavailable/)
    const reloaded = new DexieRpgBattleHost(() => 51)
    const restored = await reloaded.resume(checkpointId)
    expect('state' in restored ? restored.state?.outcome : null).toBe('victory')
    expect((await db.rpgBattleJournals.toArray())[0]?.actions).toEqual([action])
    expect(await flushOneRpgCommand()).toBe(true)
    expect((await reloaded.resume(checkpointId)).kind).toBe('pending')
    expect((await reloaded.complete(checkpointId)).kind).toBe('pending')
    expect((await reloaded.complete(checkpointId)).kind).toBe('pending')
    expect(await db.pendingRpgCommands.count()).toBe(1)
    expect(await flushOneRpgCommand()).toBe(true)
    expect(await reloaded.resume(checkpointId)).toMatchObject({ kind: 'accepted', outcome: 'win' })
    expect(await reloaded.complete(checkpointId)).toMatchObject({ kind: 'accepted', outcome: 'win' })
    expect([...serverLogs.values()].filter((row) => row.kind === 'rpgResults')).toHaveLength(1)
    expect(await db.rpgResults.count()).toBe(1)
    expect((await db.rpgBattleJournals.toArray())[0]?.actions).toEqual([action])
  })

  it('keeps an offline terminal result pending behind its entry and never spends a reward before acknowledgement', async () => {
    await host.enter(uid, checkpointId, nodeId, input)
    await host.submitAction(checkpointId, 0,
      { kind: 'attack', actorId: profiles[0]!.outfitId, targetId: 'invented-foe' })
    expect((await host.complete(checkpointId)).kind).toBe('pending')
    expect(await db.rpgResults.count()).toBe(0)
    expect(serverLogs.size).toBe(0)
    expect(await flushOneRpgCommand()).toBe(true)
    expect(await flushOneRpgCommand()).toBe(true)
    expect(await host.resume(checkpointId)).toMatchObject({ kind: 'accepted', outcome: 'win' })
  })

  it('refuses an illegal duplicate turn without appending and restores a missing journal even before entry sync', async () => {
    await host.enter(uid, checkpointId, nodeId, input)
    const id = (await db.rpgBattleJournals.toArray())[0]!.id
    await host.submitAction(checkpointId, 0,
      { kind: 'guard', actorId: profiles[0]!.outfitId, targetId: profiles[0]!.outfitId })
    await expect(host.submitAction(checkpointId, 1,
      { kind: 'attack', actorId: profiles[0]!.outfitId, targetId: 'invented-foe' })).rejects.toThrow(/already-acted/)
    await expect(host.submitAction(checkpointId, 0,
      { kind: 'attack', actorId: profiles[1]!.outfitId, targetId: 'invented-foe' })).rejects.toThrow(/stale/)
    expect((await db.rpgBattleJournals.get(id))?.actions).toHaveLength(1)
    await db.rpgBattleJournals.delete(id)
    expect(await host.resume(checkpointId)).toMatchObject({ kind: 'pending', phase: 'entry',
      recovery: 'restart-journal' })
    expect(await host.restartFromFrozenEntry(checkpointId)).toMatchObject({ kind: 'pending', phase: 'entry',
      recovery: 'none' })
    expect((await db.rpgBattleJournals.get(id))?.actions).toHaveLength(0)
  })

  it('allows a long deterministic battle journal beyond the ticketed minigame 64-action limit', async () => {
    const durable: EncounterInput = { ...input, enemies: [{ ...input.enemies[0]!,
      stats: { ...input.enemies[0]!.stats, hp: 50_000 }, moves: [{ id: 'brace', kind: 'guard',
        channel: 'physical', element: null, power: 0, target: 'self', intentText: 'Brace' }] }] }
    await host.enter(uid, checkpointId, nodeId, durable)
    for (let index = 0; index < 65; index += 1) {
      await host.submitAction(checkpointId, index, { kind: 'attack',
        actorId: profiles[index % 5]!.outfitId, targetId: 'invented-foe' })
    }
    const resumed = await new DexieRpgBattleHost(() => 52).resume(checkpointId)
    expect(resumed).toMatchObject({ kind: 'pending', phase: 'entry' })
    expect('state' in resumed ? resumed.state?.outcome : null).toBe('active')
    expect((await db.rpgBattleJournals.toArray())[0]?.actions).toHaveLength(65)
  })

  it('keeps a rejected offline result as conflicted history when another device wins entry first', async () => {
    await host.enter(uid, checkpointId, nodeId, input)
    await host.submitAction(checkpointId, 0,
      { kind: 'attack', actorId: profiles[0]!.outfitId, targetId: 'invented-foe' })
    await host.complete(checkpointId)
    const begin = (await db.pendingRpgCommands.toArray()).find((row) =>
      (row.body as RpgCommandRequest).action === 'begin-battle')!
    const competing = { ...(begin.body as RpgCommandRequest), commandId: 'competing-device-begin' }
    const parsed = parseRpgCommandRequest(competing)
    if (typeof parsed === 'string') throw new Error(parsed)
    const other = resolveRpgCommand(uid, parsed, serverEntities, serverLogs, ++serverNow)
    expect(other.response.status).toBe('applied')
    for (const row of other.writes) serverEntities.set(`${row.kind}/${row.id}`, row)
    for (const row of other.appends) serverLogs.set(`${row.kind}/${row.id}`, row)
    expect(await flushOneRpgCommand()).toBe(false)
    expect(await flushOneRpgCommand()).toBe(false)
    expect((await db.pendingRpgCommands.toArray()).map((row) => row.status)).toEqual(['conflict', 'conflict'])
    expect(await host.resume(checkpointId)).toMatchObject({ kind: 'conflict' })
    expect(await db.rpgBattleJournals.count()).toBe(1)
    expect([...serverLogs.values()].filter((row) => row.kind === 'rpgResults')).toHaveLength(0)
  })

  it('offers explicit same-entry recovery for a missing or corrupt journal without rerolling', async () => {
    await host.enter(uid, checkpointId, nodeId, input)
    await flushOneRpgCommand()
    const frozen = (await db.rpgCheckpoints.get(checkpointId))!.data.frozenEntry!
    const id = rpgBattleJournalId(frozen)
    const initial = createEncounter({ ...input, seed: Number.parseInt(frozen.seed, 16) }).hash
    await db.rpgBattleJournals.delete(id)
    expect(await host.resume(checkpointId)).toMatchObject({ kind: 'open', recovery: 'restart-journal', state: null })
    expect(await host.restartFromFrozenEntry(checkpointId)).toMatchObject({ kind: 'open', recovery: 'none' })
    expect((await db.rpgBattleJournals.get(id))?.stateHash).toBe(initial)
    await db.rpgBattleJournals.update(id, { stateHash: 'rpg-combat-v1:deadbeef' })
    expect(await host.resume(checkpointId)).toMatchObject({ kind: 'open', recovery: 'restart-journal' })
    await host.restartFromFrozenEntry(checkpointId)
    expect((await db.rpgBattleJournals.get(id))?.stateHash).toBe(initial)
  })

  it('shows frozen content unavailable instead of substituting a new encounter', async () => {
    await host.enter(uid, checkpointId, nodeId, input)
    await flushOneRpgCommand()
    const row = (await db.rpgCheckpoints.get(checkpointId))!
    await db.rpgCheckpoints.put({ ...row, data: { ...row.data, frozenEntry: {
      ...row.data.frozenEntry!, enemyKitJson: '{}' } } })
    expect(await host.resume(checkpointId)).toMatchObject({ kind: 'frozen-content-unavailable' })
    expect((await db.rpgBattleJournals.toArray())[0]?.actions).toHaveLength(0)
  })

  it('needs explicit acknowledged takeover on another device; the old lease cannot claim a result', async () => {
    await host.enter(uid, checkpointId, nodeId, input)
    await flushOneRpgCommand()
    const before = (await db.rpgCheckpoints.get(checkpointId))!
    const entry = before.data.frozenEntry!
    const id = rpgBattleJournalId(entry)
    const oldJournal = (await db.rpgBattleJournals.get(id))!
    await db.rpgBattleJournals.delete(id)
    await db.rpgBattleClaims.delete(id)
    expect(await host.resume(checkpointId)).toMatchObject({ kind: 'open', recovery: 'takeover-required' })
    expect((await host.takeover(checkpointId)).kind).toBe('pending')
    expect(await flushOneRpgCommand()).toBe(true)
    expect((await db.rpgCheckpoints.get(checkpointId))!.data.frozenEntry).toMatchObject({
      entryId: entry.entryId, seed: entry.seed, enemyKitJson: entry.enemyKitJson, leaseRevision: 1 })
    expect(await host.resume(checkpointId)).toMatchObject({ kind: 'open', recovery: 'restart-journal' })
    await host.restartFromFrozenEntry(checkpointId)
    // A third device has no local lease marker; its explicit takeover archives any displaced local journal.
    await db.rpgBattleClaims.delete(id)
    await host.takeover(checkpointId)
    await flushOneRpgCommand()
    expect((await db.rpgCheckpoints.get(checkpointId))!.data.frozenEntry?.leaseRevision).toBe(2)
    expect(await db.rpgBattleArchives.count()).toBe(1)
    const latest = (await db.rpgCheckpoints.get(checkpointId))!
    // Restore the former device's stale local view and its valid terminal journal.
    await db.rpgCheckpoints.put(before)
    await db.rpgBattleClaims.put({ id, leaseRevision: 0 })
    await db.rpgBattleJournals.put({ ...oldJournal, actions: [
      { kind: 'attack', actorId: profiles[0]!.outfitId, targetId: 'invented-foe' }],
      terminal: 'win', stateHash: replay({ ...input, seed: Number.parseInt(entry.seed, 16) }, [
        { kind: 'attack', actorId: profiles[0]!.outfitId, targetId: 'invented-foe' }]).hash })
    await db.rpgCheckpoints.put(latest)
    expect(await host.resume(checkpointId)).toMatchObject({ kind: 'conflict' })
    await expect(host.complete(checkpointId)).rejects.toThrow(/lease is stale/)
    await db.rpgCheckpoints.put(before)
    // A stale local lease is not allowed to submit even before the server rejects it.
    expect(await host.resume(checkpointId)).toMatchObject({ kind: 'pending', phase: 'result' })
    expect((await host.complete(checkpointId)).kind).toBe('pending')
    expect(await flushOneRpgCommand()).toBe(false)
    expect(await host.resume(checkpointId)).toMatchObject({ kind: 'conflict' })
    expect([...serverLogs.values()].filter((row) => row.kind === 'rpgResults')).toHaveLength(0)
  })

  it('records an accepted zero-reward loss and retries the identical frozen seed/kit under a new result id', async () => {
    await host.enter(uid, checkpointId, nodeId, input)
    await flushOneRpgCommand()
    const before = (await db.rpgCheckpoints.get(checkpointId))!.data.frozenEntry!
    expect((await host.abandonToCheckpoint(checkpointId)).kind).toBe('pending')
    expect(await flushOneRpgCommand()).toBe(true)
    const afterLoss = (await db.rpgCheckpoints.get(checkpointId))!.data
    expect(afterLoss.status).toBe('at-checkpoint')
    expect(afterLoss.frozenEntry).toMatchObject({ seed: before.seed, enemyKitJson: before.enemyKitJson,
      retryOrdinal: 1 })
    expect((await db.rpgResults.get(rpgBattleJournalId(before)))?.data.outcome).toBe('loss')
    await host.enter(uid, checkpointId, nodeId)
    await flushOneRpgCommand()
    const retry = (await db.rpgCheckpoints.get(checkpointId))!.data.frozenEntry!
    expect(retry.seed).toBe(before.seed)
    expect(retry.enemyKitJson).toBe(before.enemyKitJson)
    expect(rpgBattleJournalId(retry)).not.toBe(rpgBattleJournalId(before))
    expect(await db.rpgBattleJournals.count()).toBe(2)
  })
})
