import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { type RpgCommandRequest, type RpgPresetSaveV1 } from '@racer/domain'
import { syntheticChapterPack, syntheticChapterProfiles } from '../../../../packages/domain/src/rpg/chapter.synthetic'
import { parseRpgCommandRequest, resolveRpgCommand } from '../../../api/src/save/rpg-command'
import { RacerDb } from './db'
import { RpgChapterHost } from './rpg-chapter-host'
import { flushOneRpgCommand } from './rpg-sync'
import { decodeKit } from './rpg-battle-host'

const database = new RacerDb('test-rpg-chapters')
const uid = 'chapter-test-account', presetId = 'party-1', chapterId = 'test-chapter', id = `${presetId}:${chapterId}`
type ServerEntity = Parameters<typeof resolveRpgCommand>[2] extends Map<string, infer T> ? T : never
type ServerLog = Parameters<typeof resolveRpgCommand>[3] extends Map<string, infer T> ? T : never
const entities = new Map<string, ServerEntity>(), logs = new Map<string, ServerLog>()
let now = 100
let pack: ReturnType<typeof syntheticChapterPack> | null
const host = new RpgChapterHost(async () => pack, database, () => ++now)
const transport = {
  load: async () => ({ entities: [...entities.values()], logs: [...logs.values()], serverTime: now }),
  rpgCommand: async (body: RpgCommandRequest) => {
    const parsed = parseRpgCommandRequest(body)
    if (typeof parsed === 'string') return { status: 'rejected', reason: parsed }
    const result = resolveRpgCommand(uid, parsed, entities, logs, ++now)
    result.writes.forEach((e) => entities.set(`${e.kind}/${e.id}`, e))
    result.appends.forEach((e) => logs.set(`${e.kind}/${e.id}`, e))
    return result.response
  },
}
async function sync() { while (await flushOneRpgCommand(database, transport)) { /* Drain acknowledgement groups. */ } }
async function seed() {
  const profiles = syntheticChapterProfiles()
  const preset: RpgPresetSaveV1 = { schemaVersion: 1, presetId, name: 'Invented party', foregroundChapterId: null,
    slots: profiles.map((p) => ({ outfitId: p.outfitId, signature: p.defaultSignature, loadout: [] })) as unknown as RpgPresetSaveV1['slots'] }
  await database.rpgPresets.put({ id: presetId, data: preset, version: 1 })
  entities.set(`rpgPresets/${presetId}`, { kind: 'rpgPresets', id: presetId, data: preset as unknown as Record<string, unknown>, version: 1, deleted: false, updatedAt: 1 })
  for (const p of profiles) {
    const data = { schemaVersion: 1 as const, profile: p, projectionRevision: 0 }
    await database.rpgOutfits.put({ id: p.outfitId, data, version: 1 })
    entities.set(`rpgOutfits/${p.outfitId}`, { kind: 'rpgOutfits', id: p.outfitId, data: data as unknown as Record<string, unknown>, version: 1, deleted: false, updatedAt: 1 })
  }
}
async function win(checkpointId = id) {
  let view = await host.battle.resume(checkpointId)
  for (let count = 0; count < 100 && view.state?.outcome === 'active'; count++) {
    const state = view.state
    const ally = state.units.find((u) => u.side === 'ally' && u.hp > 0 && !state.acted.includes(u.id))!
    const enemy = state.units.find((u) => u.side === 'enemy' && u.hp > 0)!
    view = await host.battle.submitAction(checkpointId, view.actionCount, { kind: 'attack', actorId: ally.id, targetId: enemy.id })
  }
  expect(view.state?.outcome).toBe('victory')
  await host.battle.complete(checkpointId)
}
async function clearFight(node: string, checkpointId = id, chapter = chapterId) {
  await host.choose(uid, presetId, chapter, node); await sync(); await win(checkpointId); await sync()
  await host.advance(presetId, chapter); await sync()
}
describe('chapter host + real grouped server acceptance', () => {
  beforeEach(async () => { await database.delete(); await database.open(); entities.clear(); logs.clear(); now = 100; pack = syntheticChapterPack(); await seed() })
  afterEach(() => database.close())
  it.each(['rest', 'elite'])('plays the %s route through the boss and only explicit replay increments attempt', async (path) => {
    await host.start(presetId, chapterId); await sync()
    await clearFight('opening')
    await host.choose(uid, presetId, chapterId, 'fork'); await sync()
    if (path === 'elite') await clearFight('elite')
    else { await host.choose(uid, presetId, chapterId, 'rest'); await sync() }
    await host.choose(uid, presetId, chapterId, 'join'); await sync()
    await clearFight('boss')
    const before = (await database.rpgCheckpoints.get(id))!.data
    expect(before).toMatchObject({ status: 'cleared', attemptIndex: 1, lastClearedNodeId: 'boss', frozenEntry: null })
    expect(before.selectedPath).toEqual(['opening', 'fork', path, 'join', 'boss'])
    expect(await database.rpgResults.count()).toBe(path === 'elite' ? 3 : 2)
    expect((await database.items.get('inspiration:t1:slot'))?.data.quantity).toBe(30)
    expect((await database.items.get('inspiration:t1:skill'))?.data.quantity).toBe(path === 'elite' ? 120 : 60)
    await expect(host.start(presetId, chapterId)).rejects.toThrow(/explicit replay/)
    await host.start(presetId, chapterId, true); await sync()
    expect((await database.rpgCheckpoints.get(id))!.data).toMatchObject({ attemptIndex: 2, selectedPath: [], lastClearedNodeId: null })
    await host.choose(uid, presetId, chapterId, 'opening'); await sync()
    expect((await database.rpgCheckpoints.get(id))!.data.frozenEntry?.entryId).toContain(':2:opening')
  })
  it('never opens a next node or clear before entry/result/map acknowledgement; double tap reserves once', async () => {
    await Promise.allSettled([host.start(presetId, chapterId), host.start(presetId, chapterId)])
    expect(await database.pendingRpgCommands.count()).toBe(1)
    expect((await host.read(presetId, chapterId)).checkpoint).toBeNull()
    await sync(); await host.choose(uid, presetId, chapterId, 'opening'); await win()
    await expect(host.advance(presetId, chapterId)).rejects.toThrow(/pending/)
    expect(await database.rpgResults.count()).toBe(0)
    expect((await database.rpgCheckpoints.get(id))!.data.selectedPath).toEqual([])
    await sync(); await host.advance(presetId, chapterId)
    await expect(host.choose(uid, presetId, chapterId, 'fork')).rejects.toThrow(/pending/)
    await sync(); expect((await database.rpgCheckpoints.get(id))!.data.selectedPath).toEqual(['opening'])
  })
  it('selects retained content for an open checkpoint, then current content only for explicit replay',async()=>{
    const old=syntheticChapterPack(), current=syntheticChapterPack()
    current.version='invented-new';current.contentHash='c'.repeat(64)
    for(const chapter of current.chapters){chapter.contentVersion=current.version;chapter.contentHash=current.contentHash}
    let active=old,retained=true
    const versioned=new RpgChapterHost(async identity=>{
      if(!identity)return active
      if(identity.contentHash===old.contentHash&&retained)return old
      if(identity.contentHash===current.contentHash)return current
      throw new Error('Exact pack not retained')
    },database,()=>++now)
    await versioned.start(presetId,chapterId);await sync();active=current
    expect((await versioned.read(presetId,chapterId)).chapter?.contentVersion).toBe(old.version)
    retained=false;expect((await versioned.read(presetId,chapterId)).unavailable).toMatch(/not retained/)
    await expect(versioned.choose(uid,presetId,chapterId,'opening')).rejects.toThrow(/not retained/)
    expect(await database.rpgBattleJournals.count()).toBe(0);retained=true
    await clearFight('opening');await host.choose(uid,presetId,chapterId,'fork');await sync()
    await host.choose(uid,presetId,chapterId,'rest');await sync();await host.choose(uid,presetId,chapterId,'join');await sync();await clearFight('boss')
    await versioned.start(presetId,chapterId,true);await sync()
    expect((await database.rpgCheckpoints.get(id))!.data).toMatchObject({contentHash:current.contentHash,contentVersion:current.version,attemptIndex:2})
  })
  it('loss, reload and chapter switching preserve exact kit and prior clears; future party edits affect only future entries', async () => {
    await host.start(presetId, chapterId); await sync(); await clearFight('opening')
    await host.choose(uid, presetId, chapterId, 'fork'); await sync()
    await host.choose(uid, presetId, chapterId, 'elite'); await sync()
    const frozen = (await database.rpgCheckpoints.get(id))!.data.frozenEntry!
    await expect(host.start(presetId, 'test-second')).rejects.toThrow(/Pause/)
    await host.battle.abandonToCheckpoint(id); await sync()
    await host.start(presetId, 'test-second'); await sync()
    expect((await database.rpgCheckpoints.get(id))!.data.selectedPath).toEqual(['opening', 'fork'])
    await host.focus(presetId, chapterId); await sync()
    const restored = new RpgChapterHost(async () => pack, database)
    await restored.choose(uid, presetId, chapterId, 'elite'); await sync()
    const retry = (await database.rpgCheckpoints.get(id))!.data.frozenEntry!
    expect(retry).toEqual({ ...frozen, retryOrdinal: 1 })
    const party = (await database.rpgPresets.get(presetId))!
    const edited = { ...party.data, slots: [...party.data.slots].reverse() as RpgPresetSaveV1['slots'] }
    await database.rpgPresets.put({ ...party, data: edited, version: party.version + 1 })
    entities.set(`rpgPresets/${presetId}`, { ...entities.get(`rpgPresets/${presetId}`)!, version: party.version + 1, data: edited as unknown as Record<string, unknown> })
    expect(decodeKit(retry.enemyKitJson).allies.map((a) => a.id)).toEqual(frozen.party.map((p) => p.outfitId))
    await win(); await sync(); await host.advance(presetId, chapterId); await sync()
    await host.choose(uid, presetId, chapterId, 'join'); await sync(); await host.choose(uid, presetId, chapterId, 'boss'); await sync()
    const next = (await database.rpgCheckpoints.get(id))!.data.frozenEntry!
    expect(next.party.map((p) => p.outfitId)).toEqual(edited.slots.map((s) => s!.outfitId))
  })
  it('rejects stale second-device advance atomically and will not substitute missing/drifted private content', async () => {
    await host.start(presetId, chapterId); await sync(); await host.choose(uid, presetId, chapterId, 'opening'); await sync(); await win(); await sync()
    const remote = entities.get(`rpgCheckpoints/${id}`)!
    entities.set(`rpgCheckpoints/${id}`, { ...remote, version: remote.version + 1 })
    await host.advance(presetId, chapterId); await sync()
    expect((await database.pendingRpgCommands.toArray())[0]?.status).toBe('conflict')
    expect((await database.rpgCheckpoints.get(id))!.data.lastClearedNodeId).toBeNull()
    expect(await database.items.count()).toBe(0)
    await host.refreshAccount(true, transport)
    expect(await database.pendingRpgCommands.count()).toBe(0)
    expect((await database.rpgCheckpoints.get(id))!.version).toBe(remote.version + 1)
    expect(await database.rpgBattleJournals.count()).toBe(1)
    pack = null
    expect((await host.read(presetId, chapterId)).unavailable).toMatch(/unavailable/)
    pack = syntheticChapterPack(); pack.chapters[0]!.contentHash = 'b'.repeat(64)
    expect((await host.read(presetId, chapterId)).unavailable).toMatch(/version\/hash/)
  })
  it('server refuses forged advancement when a pending-result row has no accepted winning receipt', async () => {
    await host.start(presetId, chapterId); await sync(); await host.choose(uid, presetId, chapterId, 'opening'); await sync(); await win(); await sync()
    await host.advance(presetId, chapterId)
    const command = (await database.pendingRpgCommands.toArray())[0]!.body as RpgCommandRequest
    logs.clear()
    expect(await transport.rpgCommand(command)).toMatchObject({ status: 'rejected', reason: 'Map advance requires accepted winning evidence' })
  })
  it('recovers a lost grant ACK after reload without collecting the same winning entry twice', async () => {
    await host.start(presetId, chapterId); await sync(); await host.choose(uid, presetId, chapterId, 'opening'); await sync(); await win(); await sync()
    await host.advance(presetId, chapterId)
    await expect(flushOneRpgCommand(database, { ...transport, rpgCommand: async body => {
      await transport.rpgCommand(body); throw new Error('Lost map ACK')
    } })).rejects.toThrow(/Lost map ACK/)
    expect(await database.items.count()).toBe(0)
    expect((await database.rpgCheckpoints.get(id))!.data.lastClearedNodeId).toBeNull()
    const restored = new RpgChapterHost(async () => pack, database)
    await sync()
    expect((await database.items.get('inspiration:t1:skill'))?.data.quantity).toBe(60)
    expect(await database.itemLedger.count()).toBe(1)
    await expect(restored.advance(presetId, chapterId)).rejects.toThrow()
    expect(await database.itemLedger.count()).toBe(1)
  })
  it('archives a rejected terminal journal and explicitly restarts the same accepted frozen entry, never its stale result', async () => {
    await host.start(presetId, chapterId); await sync(); await host.choose(uid, presetId, chapterId, 'opening'); await sync()
    const frozen = (await database.rpgCheckpoints.get(id))!.data.frozenEntry!
    const remote = entities.get(`rpgCheckpoints/${id}`)!
    entities.set(`rpgCheckpoints/${id}`, { ...remote, version: remote.version + 1 })
    await host.battle.abandonToCheckpoint(id); await sync()
    expect((await database.pendingRpgCommands.toArray())[0]?.status).toBe('conflict')
    await host.refreshAccount(true, transport)
    expect(await database.rpgBattleJournals.count()).toBe(0)
    expect((await database.rpgBattleArchives.toArray())[0]).toMatchObject({ reason: 'rejected-command', journal: { terminal: 'abandoned', commitStatus: 'conflict' } })
    expect(await host.battle.resume(id)).toMatchObject({ kind: 'open', recovery: 'restart-journal', state: null })
    expect(await host.battle.restartFromFrozenEntry(id)).toMatchObject({ kind: 'open', recovery: 'none', actionCount: 0 })
    expect((await database.rpgCheckpoints.get(id))!.data.frozenEntry).toEqual(frozen)
    expect(await database.rpgResults.count()).toBe(0)
  })
  it('restores an equipped non-empty loadout after dictionary decoding/reload without treating key order as kit drift', async () => {
    const preset = (await database.rpgPresets.get(presetId))!
    const slots = structuredClone(preset.data.slots)
    slots[0]!.loadout = [{ tier: 1, weapon: 'greatsword', element: 'fire', depth: 1, branch: 'foundation' }]
    const next = { ...preset.data, slots }
    await database.rpgPresets.put({ ...preset, data: next })
    entities.set(`rpgPresets/${presetId}`, { ...entities.get(`rpgPresets/${presetId}`)!, data: next as unknown as Record<string, unknown> })
    await host.start(presetId, chapterId); await sync(); await host.choose(uid, presetId, chapterId, 'opening'); await sync()
    expect(await new RpgChapterHost(async () => pack, database).battle.resume(id)).toMatchObject({ kind: 'open', recovery: 'none' })
  })
  it('requires five filled slots but levels below recommendation are advisory', async () => {
    const preset = (await database.rpgPresets.get(presetId))!
    await database.rpgPresets.put({ ...preset, data: { ...preset.data, slots: [null, ...preset.data.slots.slice(1)] as RpgPresetSaveV1['slots'] } })
    await expect(host.start(presetId, chapterId)).rejects.toThrow(/five/)
    await database.rpgPresets.put(preset)
    for (const row of await database.rpgOutfits.toArray()) await database.rpgOutfits.put({ ...row, data: { ...row.data, profile: { ...row.data.profile, level: 1, tree: [] } } })
    await expect(host.start(presetId, chapterId)).resolves.toBeUndefined()
  })
  it('accepts a genuine all-KO loss, grants nothing, and retries the same frozen defeat probe', async () => {
    const chapter = 'test-loss', checkpointId = `${presetId}:${chapter}`
    await host.start(presetId, chapter); await sync(); await host.choose(uid, presetId, chapter, 'wall'); await sync()
    const before = (await database.rpgCheckpoints.get(checkpointId))!.data.frozenEntry!
    let view = await host.battle.resume(checkpointId)
    for (let count = 0; count < 30 && view.state?.outcome === 'active'; count++) {
      const ally = view.state.units.find((u) => u.side === 'ally' && u.hp > 0 && !view.state!.acted.includes(u.id))!
      view = await host.battle.submitAction(checkpointId, view.actionCount, { kind: 'attack', actorId: ally.id, targetId: 'test-wall' })
    }
    expect(view.state?.outcome).toBe('loss')
    await host.battle.complete(checkpointId); await sync()
    await expect(host.advance(presetId, chapter)).rejects.toThrow(/accepted win/)
    expect((await database.rpgCheckpoints.get(checkpointId))!.data.selectedPath).toEqual([])
    expect((await database.rpgResults.toArray())[0]?.data.memberExp.every((m) => m.delta === 0)).toBe(true)
    await host.choose(uid, presetId, chapter, 'wall'); await sync()
    expect((await database.rpgCheckpoints.get(checkpointId))!.data.frozenEntry).toEqual({ ...before, retryOrdinal: 1 })
  })
})
