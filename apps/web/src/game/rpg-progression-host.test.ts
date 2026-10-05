import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { grantRpgExp, projectRpgStats, rpgResultId, rpgSkillKey, type RpgCommandRequest, type RpgPresetSaveV1 } from '@racer/domain'
import { syntheticChapterPack, syntheticChapterProfiles } from '../../../../packages/domain/src/rpg/chapter.synthetic'
import { parseRpgCommandRequest, resolveRpgCommand } from '../../../api/src/save/rpg-command'
import { RacerDb } from './db'
import { RpgChapterHost } from './rpg-chapter-host'
import { RpgProgressionHost } from './rpg-progression-host'
import { flushOneRpgCommand } from './rpg-sync'
const db = new RacerDb('test-rpg-progression')
type Entity = Parameters<typeof resolveRpgCommand>[2] extends Map<string, infer T> ? T : never
type Log = Parameters<typeof resolveRpgCommand>[3] extends Map<string, infer T> ? T : never
const entities = new Map<string, Entity>(), logs = new Map<string, Log>()
const uid = 'progression-test', checkpointId = 'party-1:test-chapter', outfitId = 'test-outfit-0'
let now = 100, pack = syntheticChapterPack()
const chapter = new RpgChapterHost(async () => pack, db, () => ++now)
const host = new RpgProgressionHost(db, () => ++now)
const transport = {
  load: async () => ({ entities: [...entities.values()], logs: [...logs.values()], serverTime: now }),
  rpgCommand: async (body: RpgCommandRequest) => {
    const parsed = parseRpgCommandRequest(body)
    if (typeof parsed === 'string') return { status: 'rejected', reason: parsed }
    const result = resolveRpgCommand(uid, parsed, entities, logs, ++now)
    for (const row of result.writes) entities.set(`${row.kind}/${row.id}`, row)
    for (const row of result.appends) logs.set(`${row.kind}/${row.id}`, row)
    return result.response
  },
}
async function sync() { for (let i = 0; i < 20 && await db.pendingRpgCommands.where('status').equals('pending').count(); i++) await flushOneRpgCommand(db, transport) }
async function setProfile(index: number, update: (p: ReturnType<typeof syntheticChapterProfiles>[number]) => ReturnType<typeof syntheticChapterProfiles>[number], remoteOnly = false) {
  const id = `test-outfit-${index}`, row = (await db.rpgOutfits.get(id))!
  const data = { ...row.data, profile: update(row.data.profile) }
  const version = row.version + 1
  entities.set(`rpgOutfits/${id}`, { ...entities.get(`rpgOutfits/${id}`)!, data: data as unknown as Record<string, unknown>, version })
  if (!remoteOnly) await db.rpgOutfits.put({ ...row, data, version })
}
async function enter() {
  await chapter.start('party-1', 'test-chapter'); await sync()
  await chapter.choose(uid, 'party-1', 'test-chapter', 'opening'); await sync()
}
async function terminal() {
  let view = await chapter.battle.resume(checkpointId)
  for (let i = 0; i < 200 && view.state?.outcome === 'active'; i++) {
    const state = view.state
    const ally = state.units.find((u) => u.side === 'ally' && u.hp > 0 && !state.acted.includes(u.id))!
    const enemy = state.units.find((u) => u.side === 'enemy' && u.hp > 0)!
    view = await chapter.battle.submitAction(checkpointId, view.actionCount, { kind: 'attack', actorId: ally.id, targetId: enemy.id })
  }
  return view
}
describe('real RPG progression + grouped API resolver', () => {
  beforeEach(async () => {
    await db.delete(); await db.open(); entities.clear(); logs.clear(); now = 100; pack = syntheticChapterPack()
    const profiles = syntheticChapterProfiles()
    const preset: RpgPresetSaveV1 = { schemaVersion: 1, presetId: 'party-1', name: 'Test team', foregroundChapterId: null,
      slots: profiles.map((p) => ({ outfitId: p.outfitId, signature: p.defaultSignature, loadout: [] })) as unknown as RpgPresetSaveV1['slots'] }
    await db.rpgPresets.put({ id: preset.presetId, data: preset, version: 1 })
    entities.set(`rpgPresets/${preset.presetId}`, { kind: 'rpgPresets', id: preset.presetId, data: preset as unknown as Record<string, unknown>, version: 1, deleted: false, updatedAt: 1 })
    for (const p of profiles) {
      const data = { schemaVersion: 1 as const, profile: p, projectionRevision: 0 }
      await db.rpgOutfits.put({ id: p.outfitId, data, version: 1 })
      entities.set(`rpgOutfits/${p.outfitId}`, { kind: 'rpgOutfits', id: p.outfitId, data: data as unknown as Record<string, unknown>, version: 1, deleted: false, updatedAt: 1 })
    }
  })
  afterEach(() => db.close())
  it('acknowledges a fresh class correction once, preserving EXP, party slots and frozen inputs', async () => {
    await setProfile(0, p => ({ ...p, level: 1, exp: 65, tree: [], sourceAptitudes: {
      ...p.sourceAptitudes, strategy: { ...p.sourceAptitudes.strategy, pace: 'A' } } }))
    const view = await host.read(outfitId), before = view.outfit.data.profile
    const presetBefore = await db.rpgPresets.toArray()
    await host.changeClass(view, 'pace', 'sword-shield')
    expect((await db.rpgOutfits.get(outfitId))!.data.profile).toEqual(before)
    await expect(host.changeClass(view, 'pace', 'spear')).rejects.toThrow(/pending/)
    const queued = (await db.pendingRpgCommands.toArray())[0]!.body as RpgCommandRequest
    expect(queued.expected.filter(e => e.kind === 'rpgPresets')).toHaveLength(5)
    // A lost ACK retries the exact same grouped command, not a new enrollment.
    await expect(flushOneRpgCommand(db, { ...transport, rpgCommand: async body => {
      await transport.rpgCommand(body); throw new Error('lost ACK')
    } })).rejects.toThrow('lost ACK')
    await sync()
    expect((await db.rpgOutfits.get(outfitId))!.data.profile).toEqual({ ...before, style: 'pace', weapon: 'sword-shield' })
    expect((await db.rpgOutfits.get(outfitId))!.data.projectionRevision).toBe(1)
    expect(await db.rpgPresets.toArray()).toEqual(presetBefore)
    await expect(host.changeClass(view, 'pace', 'spear')).rejects.toThrow(/changed/)
    await host.changeClass(await host.read(outfitId), 'pace', 'spear'); await sync()
    expect((await db.rpgOutfits.get(outfitId))!.data.profile.exp).toBe(65)
    await setProfile(0, p => ({ ...p, level: 2 }))
    await expect(host.changeClass(await host.read(outfitId), 'front', 'greatsword')).rejects.toThrow(/Tier 1 RPG Lv1/)
  })
  it('blocks fresh class edits during an open fight, even after its member leaves the current party', async () => {
    await setProfile(0, p => ({ ...p, level: 1, tree: [], sourceAptitudes: {
      ...p.sourceAptitudes, strategy: { ...p.sourceAptitudes.strategy, pace: 'A' } } }))
    const stale = await host.read(outfitId)
    await enter()
    await expect(host.changeClass(stale, 'pace', 'spear')).rejects.toThrow(/Finish|changed/)
    await expect(host.changeClass(await host.read(outfitId), 'pace', 'spear')).rejects.toThrow(/Finish/)
    const preset = (await db.rpgPresets.get('party-1'))!
    await db.rpgPresets.put({ ...preset, version: preset.version + 1, data: { ...preset.data,
      slots: preset.data.slots.map(s => s?.outfitId === outfitId ? null : s) as RpgPresetSaveV1['slots'] } })
    expect((await host.read(outfitId)).checkpoints.map(c => c.id)).toContain(checkpointId)
    await expect(host.changeClass(await host.read(outfitId), 'pace', 'spear')).rejects.toThrow(/Finish/)
  })
  it('awards five different levels atomically; pending cannot spend; multiple crossed levels reveal after acknowledgement', async () => {
    for (const [i, level] of [1, 5, 10, 30, 50].entries()) await setProfile(i, (p) => ({ ...p, level, tree: level === 1 ? [] : p.tree }))
    await enter(); expect((await terminal()).state?.outcome).toBe('victory')
    const before = (await db.rpgOutfits.toArray()).map((r) => r.data.profile)
    await chapter.battle.complete(checkpointId)
    const pending = await chapter.battle.resume(checkpointId)
    expect(pending.kind).toBe('pending'); expect(pending.evidence).toBeNull()
    expect(pending.previewEvidence?.memberExp.map((m) => m.delta)).toEqual([1898, 1743, 1549, 775, 387])
    expect((await db.rpgOutfits.toArray()).map((r) => r.data.profile)).toEqual(before)
    const ref = { tier: 1, weapon: 'greatsword' as const, element: 'fire' as const, depth: 1, branch: 'foundation' as const }
    await expect(host.learn(await host.read(outfitId), ref)).rejects.toThrow(/point|pending|Finish/)
    await sync()
    const accepted = await chapter.battle.resume(checkpointId)
    expect(accepted.kind).toBe('accepted')
    expect(accepted.evidence?.memberExp[0]!.afterLevel).toBeGreaterThan(3)
    expect((await db.rpgOutfits.get('test-outfit-4'))!.data.profile.exp).toBe(387)
    expect(await db.items.count()).toBe(0)
  })
  it('reconciles only stale profiles before resubmitting the same reward identity and frozen replay', async () => {
    await enter(); await terminal(); await chapter.battle.complete(checkpointId)
    const queued = (await db.pendingRpgCommands.toArray())[0]!, old = queued.body as RpgCommandRequest
    const frozen = (await db.rpgCheckpoints.get(checkpointId))!.data.frozenEntry!
    await setProfile(0, (p) => grantRpgExp(p, 4000).profile, true)
    expect(await flushOneRpgCommand(db, transport)).toBe(false)
    const reconciled = (await db.pendingRpgCommands.get(queued.id))!.body as RpgCommandRequest
    expect(reconciled.commandId).toBe(old.commandId)
    expect(reconciled.appends[0]!.data.stateHash).toBe(old.appends[0]!.data.stateHash)
    expect((reconciled.appends[0]!.data.memberExp as Array<{ delta: number }>)[0]!.delta).toBe(1549)
    expect((await db.pendingRpgCommands.get(queued.id))!.status).toBe('pending')
    expect(await db.rpgResults.count()).toBe(0)
    await sync()
    expect((await db.rpgCheckpoints.get(checkpointId))!.data.frozenEntry).toEqual(frozen)
    expect((await db.rpgOutfits.get(outfitId))!.data.profile).toEqual(grantRpgExp(syntheticChapterProfiles()[0]!, 5549).profile)
    expect(await db.rpgResults.count()).toBe(1)
  })
  it('lost acknowledgement, duplicate complete and duplicate receipt never pay twice', async () => {
    await enter(); await terminal(); await chapter.battle.complete(checkpointId)
    await expect(flushOneRpgCommand(db, { ...transport, rpgCommand: async (body) => { await transport.rpgCommand(body); throw new Error('lost ACK') } })).rejects.toThrow('lost ACK')
    expect(await db.rpgResults.count()).toBe(0)
    await sync()
    const profile = (await db.rpgOutfits.get(outfitId))!.data.profile
    await chapter.battle.complete(checkpointId); await sync()
    expect((await db.rpgOutfits.get(outfitId))!.data.profile).toEqual(profile)
    expect(await db.rpgResults.count()).toBe(1)
  })
  it('does not rebase a stale checkpoint/lease or append orphan EXP', async () => {
    await enter(); await terminal(); await chapter.battle.complete(checkpointId)
    const cp = entities.get(`rpgCheckpoints/${checkpointId}`)!
    entities.set(`rpgCheckpoints/${checkpointId}`, { ...cp, version: cp.version + 1 })
    await sync()
    expect((await db.pendingRpgCommands.toArray())[0]!.status).toBe('conflict')
    expect(await db.rpgResults.count()).toBe(0)
    expect((await db.rpgOutfits.get(outfitId))!.data.profile.level).toBe(10)
  })
  it('KO’d winners earn the same EXP, while loss/abandon pay zero and preserve the kit', async () => {
    await setProfile(0, (p) => ({ ...p, baseStats: { ...p.baseStats, stamina: 0, power: 0 } }))
    const scout = pack.actors[0]!.combat
    scout.stats = { ...scout.stats, hp: 1000, atk: 10000 }; scout.moves = [{ id: 'hit', kind: 'damage', channel: 'physical', element: null, power: 150, target: 'front', intentText: 'KO first entrant' }]
    await enter(); const view = await terminal()
    expect(view.state?.outcome).toBe('victory'); expect(view.state!.units.find((u) => u.id === outfitId)!.hp).toBe(0)
    await chapter.battle.complete(checkpointId); await sync()
    expect((await chapter.battle.resume(checkpointId)).evidence?.memberExp.map((m) => m.delta)).toEqual(Array(5).fill(1549))
    await chapter.advance('party-1', 'test-chapter'); await sync()
    await chapter.choose(uid, 'party-1', 'test-chapter', 'fork'); await sync()
    await chapter.choose(uid, 'party-1', 'test-chapter', 'elite'); await sync()
    const frozen = (await db.rpgCheckpoints.get(checkpointId))!.data.frozenEntry!
    await chapter.battle.abandonToCheckpoint(checkpointId); await sync()
    expect((await db.rpgResults.get(rpgResultId(frozen.entryId, 0)))!.data.memberExp.every((m) => m.delta === 0)).toBe(true)
    expect((await db.rpgCheckpoints.get(checkpointId))!.data.frozenEntry!.enemyKitJson).toBe(frozen.enemyKitJson)
  })
  it('spends one point and equips only at a safe accepted checkpoint; stale editors cannot spend', async () => {
    await enter(); await terminal(); await chapter.battle.complete(checkpointId); await sync()
    expect((await host.read(outfitId)).blocked).toMatch(/Finish/)
    await chapter.advance('party-1', 'test-chapter'); await sync()
    const view = await host.read(outfitId), skill = { tier: 1, weapon: 'greatsword' as const, element: 'fire' as const, depth: 2, branch: 'area' as const }
    await host.learn(view, skill)
    expect((await db.rpgOutfits.get(outfitId))!.data.profile.tree).toHaveLength(1)
    await expect(host.learn(view, skill)).rejects.toThrow(/pending/)
    await sync(); expect((await db.rpgOutfits.get(outfitId))!.data.profile.tree).toHaveLength(2)
    await host.equip(await host.read(outfitId), 'party-1', 'fire', [skill]); await sync()
    expect((await db.rpgPresets.get('party-1'))!.data.slots[0]!.loadout).toEqual([skill])
    const stale = await host.read(outfitId)
    await chapter.choose(uid, 'party-1', 'test-chapter', 'fork'); await sync()
    await expect(host.learn(stale, skill)).rejects.toThrow(/changed/)
    await expect(host.equip(await host.read(outfitId), 'party-1', 'fire', [skill, skill])).rejects.toThrow(/Invalid/)
  })
  it('two promotions preserve bank, permanent stats, archive and deliberate legacy; every preset is pruned', async () => {
    await setProfile(0, (p) => ({ ...p, level: 50, exp: 2080 }))
    let view = await host.read(outfitId)
    const foundation = view.outfit.data.profile.tree[0]!
    await expect(host.promote(view, [foundation], false)).rejects.toThrow(/discard/)
    const before = projectRpgStats(view.outfit.data.profile)
    await host.promote(view, [foundation], true)
    expect((await db.rpgOutfits.get(outfitId))!.data.profile.tier).toBe(1)
    await sync(); let p = (await db.rpgOutfits.get(outfitId))!.data.profile
    expect(p).toMatchObject({ tier: 2, level: 11, exp: 0, tree: [], legacy: [foundation] })
    expect(projectRpgStats(p).speed).toBeGreaterThan(before.speed)
    await host.learn(await host.read(outfitId), { ...foundation, tier: 2 }); await sync()
    p = (await db.rpgOutfits.get(outfitId))!.data.profile
    await host.equip(await host.read(outfitId), 'party-1', 'fire', [p.tree[0]!, foundation]); await sync()
    await setProfile(0, (current) => ({ ...current, level: 50, exp: 2080 }))
    view = await host.read(outfitId); await host.promote(view, [foundation], true); await sync()
    p = (await db.rpgOutfits.get(outfitId))!.data.profile
    expect(p).toMatchObject({ tier: 3, level: 11, exp: 0, tree: [], legacy: [foundation] })
    expect((await db.rpgPresets.get('party-1'))!.data.slots[0]!.loadout.map(rpgSkillKey)).toEqual([rpgSkillKey(foundation)])
    expect(await db.rpgPromotions.count()).toBe(2)
  })
  it('the save boundary rejects forged reward amounts without writing', async () => {
    await enter(); await terminal(); await chapter.battle.complete(checkpointId)
    const body = structuredClone((await db.pendingRpgCommands.toArray())[0]!.body) as RpgCommandRequest
    const member = (body.appends[0]!.data.memberExp as Array<{ delta: number }>)[0]!; member.delta++
    expect((await transport.rpgCommand(body)).status).toBe('rejected')
    expect(logs.size).toBe(2) // Start + begin receipts only.
  })
  it('the save boundary rejects free respec, overfilled slots and omitted promotion pruning', async () => {
    const view = await host.read(outfitId), foundation = view.outfit.data.profile.tree[0]!
    await host.learn(view, { ...foundation, depth: 2, branch: 'area' })
    const queued = (await db.pendingRpgCommands.toArray())[0]!.body as RpgCommandRequest
    const respec = structuredClone(queued)
    const changed = respec.upserts[0]!.data.profile as { tree: unknown[] }
    changed.tree.shift() // Removing a learned node is not a point spend.
    expect((await transport.rpgCommand(respec)).status).toBe('rejected')
    await sync()
    await host.equip(await host.read(outfitId), 'party-1', 'fire', [foundation]); await sync()
    await setProfile(0, (p) => ({ ...p, level: 50 }))
    await host.promote(await host.read(outfitId), [], true)
    const promotion = structuredClone((await db.pendingRpgCommands.toArray())[0]!.body) as RpgCommandRequest
    promotion.upserts = promotion.upserts.filter((u) => u.kind !== 'rpgPresets')
    expect((await transport.rpgCommand(promotion)).status).toBe('rejected')
    expect((entities.get(`rpgOutfits/${outfitId}`)!.data.profile as { tier: number }).tier).toBe(1)
    await sync()
    // Parser and resolver independently validate loadout references/slots.
    const equip = { schemaVersion: 1, commandId: 'forged-slots', action: 'edit-preset',
      expected: [{ kind: 'rpgPresets', id: 'party-1', version: (await db.rpgPresets.get('party-1'))!.version },
        ...Array.from({ length: 5 }, (_, i) => ({ kind: 'rpgOutfits', id: `test-outfit-${i}`, version: entities.get(`rpgOutfits/test-outfit-${i}`)!.version }))],
      upserts: [{ kind: 'rpgPresets', id: 'party-1', data: structuredClone((await db.rpgPresets.get('party-1'))!.data) as unknown as Record<string, unknown> }], appends: [] } as RpgCommandRequest
    const slots = equip.upserts[0]!.data.slots as Array<{ loadout: unknown[] }>
    slots[0]!.loadout = [foundation, foundation, foundation, foundation]
    expect((await transport.rpgCommand(equip)).status).toBe('rejected')
  })
})
