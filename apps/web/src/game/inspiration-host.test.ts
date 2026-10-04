import 'fake-indexeddb/auto'
import { beforeEach, afterEach, describe, expect, it } from 'vitest'
import { createPlayerProfile, createUmaSave, INSPIRATION_SLOTS, scenarioView, type RpgCommandRequest, type SkillTemplate, type UmaTemplate } from '@racer/domain'
import { parseRpgCommandRequest, resolveRpgCommand } from '../../../api/src/save/rpg-command'
import { db } from './db'
import { reserveInspirationUnlock } from './inspiration-host'
import { flushOneRpgCommand } from './rpg-sync'
import { queueInTransaction } from './persistence'
import { RpgChapterHost } from './rpg-chapter-host'

const gold: SkillTemplate = { id: 'invented-gold', kind: 'gold', name: 'Invented gold', description: '', costSp: 100,
  iconId: null, inheritedSkillId: null, normalSkillId: null, conditions: [] }
const template = (id: string): UmaTemplate => ({ id, charaId: `character-${id}`, name: `Invented ${id}`, outfit: null, jpRelease: '2000-01-01', globalRelease: null, starter: true,
  baseStats: { speed: 100, stamina: 100, power: 100, guts: 100, wit: 100 }, growthRates: { speed: 0, stamina: 0, power: 0, guts: 0, wit: 0 },
  aptitudes: { surface: { turf: 'A', dirt: 'G' }, distance: { sprint: 'B', mile: 'A', medium: 'A', long: 'G' }, strategy: { front: 'A', pace: 'B', late: 'G', end: 'G' } },
  uniqueSkillId: null, awakeningSkillIds: [], realHorseSex: null, signatureRaceFamilyIds: [], imageSource: 'https://invalid.test/portrait.png' })
const child = template('invented-child'), ancestor = { ...template('invented-ancestor'), awakeningSkillIds: [gold.id, 'invented-gold2'] }
const content = { umas: new Map([[child.id, child], [ancestor.id, ancestor]]), skills: new Map([[gold.id, gold], ['invented-gold2', { ...gold, id: 'invented-gold2' }]]) }
type ServerEntity = Parameters<typeof resolveRpgCommand>[2] extends Map<string, infer T> ? T : never
type ServerLog = Parameters<typeof resolveRpgCommand>[3] extends Map<string, infer T> ? T : never
const entities = new Map<string, ServerEntity>(), logs = new Map<string, ServerLog>()
let now = 1
const transport = {
  load: async () => ({ entities: [...entities.values()], logs: [...logs.values()], serverTime: now }),
  rpgCommand: async (body: RpgCommandRequest) => {
    const parsed = parseRpgCommandRequest(body)
    if (typeof parsed === 'string') throw new Error(parsed)
    const result = resolveRpgCommand('test-account', parsed, entities, logs, ++now)
    result.writes.forEach(r => entities.set(`${r.kind}/${r.id}`, r)); result.appends.forEach(r => logs.set(`${r.kind}/${r.id}`, r))
    return result.response
  },
}
const unlock = (nodeId = 'parent0', goldIndex: number | null = null, tier = 1) => reserveInspirationUnlock({ umaId: child.id, tier, nodeId, goldIndex }, content, db, ++now)
const unit = async () => (await db.umas.get(child.id))!.data
async function seed() {
  const uma = createUmaSave(child)
  const profile = createPlayerProfile('invented', 1)
  await db.umas.put({ id: child.id, version: 1, data: uma }); await db.profile.put({ id: 'main', version: 1, data: profile })
  entities.set(`umas/${child.id}`, { kind: 'umas', id: child.id, version: 1, data: uma as unknown as Record<string, unknown>, deleted: false, updatedAt: 1 })
  entities.set('profile/main', { kind: 'profile', id: 'main', version: 1, data: profile as unknown as Record<string, unknown>, deleted: false, updatedAt: 1 })
  for (const [kind, quantity] of [['slot', 6], ['skill', 12]] as const) {
    const id = `inspiration:t1:${kind}`, data = { itemId: id, quantity, updatedAt: 1 }
    await db.items.put({ id, version: 1, data }); entities.set(`items/${id}`, { kind: 'items', id, version: 1, data, deleted: false, updatedAt: 1 })
  }
}
describe('acknowledged Inspiration unlock transactions', () => {
  beforeEach(async () => { await db.delete(); await db.open(); entities.clear(); logs.clear(); now = 1; await seed() })
  afterEach(() => db.close())
  it('reserves offline without spending, resumes the same command, installs once, and blocks ordinary edits', async () => {
    await unlock(); await unlock()
    expect(await db.pendingRpgCommands.count()).toBe(1)
    expect((await unit()).scenarios[0]!.inspiration.slots).toEqual([])
    expect((await db.items.get('inspiration:t1:slot'))?.data.quantity).toBe(6)
    await expect(db.transaction('rw', [db.umas, db.outbox], async () => {
      await db.umas.update(child.id, { data: { ...await unit(), level: 2 } })
      await queueInTransaction('umas', child.id, 'upsert', now)
    })).rejects.toThrow(/pending RPG/)
    expect((await unit()).level).toBe(1)
    await flushOneRpgCommand(db, transport); await unlock()
    expect((await unit()).scenarios[0]!.inspiration.slots).toEqual(['parent0'])
    expect((await db.items.get('inspiration:t1:slot'))?.data.quantity).toBe(5)
    expect(await db.itemLedger.count()).toBe(1); expect(await db.pendingRpgCommands.count()).toBe(0)
  })
  it('opens exactly six slots and twelve gold positions, rejecting missing parent/ancestor/wrong scenario', async () => {
    await expect(unlock('parent0-gp0')).rejects.toThrow(/parent/)
    await expect(unlock('parent0', 0)).rejects.toThrow(/open/)
    await expect(unlock('parent0', null, 2)).rejects.toThrow(/scenario/)
    for (const nodeId of INSPIRATION_SLOTS) {
      await unlock(nodeId); await flushOneRpgCommand(db, transport)
      await expect(unlock(nodeId, 0)).rejects.toThrow(/ancestor/)
      const row = (await db.umas.get(child.id))!
      row.data.scenarios[0]!.presets[row.data.activePreset].assignments[nodeId] = { kind: 'lineage', templateId: ancestor.id }
      await db.umas.put(row)
      entities.get(`umas/${child.id}`)!.data = row.data as unknown as Record<string, unknown>
      for (const index of [0, 1]) { await unlock(nodeId, index); await flushOneRpgCommand(db, transport) }
    }
    expect((await unit()).scenarios[0]!.inspiration).toMatchObject({ slots: [...INSPIRATION_SLOTS] })
    expect((await unit()).scenarios[0]!.inspiration.golds).toHaveLength(12)
    expect((await db.items.toArray()).every(r => r.data.quantity === 0)).toBe(true)
    expect(await db.itemLedger.count()).toBe(18)
  })
  it('recovers a lost ACK with duplicate receipt, never a second deduction', async () => {
    await unlock()
    await expect(flushOneRpgCommand(db, { ...transport, rpgCommand: async body => { await transport.rpgCommand(body); throw new Error('offline after accepted write') } })).rejects.toThrow(/offline/)
    expect((await unit()).scenarios[0]!.inspiration.slots).toEqual([])
    await flushOneRpgCommand(db, transport)
    expect((await db.items.get('inspiration:t1:slot'))?.data.quantity).toBe(5)
    expect(await db.itemLedger.count()).toBe(1)
  })
  it.each(['umas', 'items'] as const)('rejects stale %s atomically and explicitly refreshes dependencies without replacing ordinary writes', async kind => {
    await unlock()
    const id = kind === 'umas' ? child.id : 'inspiration:t1:slot'
    const server = entities.get(`${kind}/${id}`)!; server.version++
    if (kind === 'umas') server.data = { ...server.data, exp: 25 }
    else server.data = { ...server.data, quantity: 2 }
    await flushOneRpgCommand(db, transport)
    expect(await db.itemLedger.count()).toBe(0)
    expect((await unit()).scenarios[0]!.inspiration.slots).toEqual([])
    const host = new RpgChapterHost(async () => null, db)
    const other = createUmaSave(template('other-local-edit'))
    other.exp = 777
    await db.umas.put({ id: other.templateId, version: 1, data: other })
    await db.transaction('rw', db.outbox, () => queueInTransaction('umas', other.templateId, 'upsert', now))
    entities.set(`umas/${other.templateId}`, { kind: 'umas', id: other.templateId, version: 5,
      data: { ...other, exp: 0 } as unknown as Record<string, unknown>, deleted: false, updatedAt: now })
    await host.refreshAccount(true, transport)
    expect((await db.umas.get(other.templateId))?.data.exp).toBe(777)
    expect(await db.pendingRpgCommands.count()).toBe(0)
    expect((await db.table(kind).get(id)).version).toBe(server.version)
    await unlock(); await flushOneRpgCommand(db, transport)
    expect((await unit()).scenarios[0]!.inspiration.slots).toEqual(['parent0'])
  })
  it('migrates a recovered v13 Uma and queues its version-preserving replacement', async () => {
    const row = entities.get(`umas/${child.id}`)!
    // A v13 row: one build per scenario (D252) and no Inspiration state.
    const saved = await unit()
    const { activePreset: _preset, ...head } = row.data
    row.data = { ...head, schemaVersion: 13, scenarios: saved.scenarios.map((entry) => {
      const { inspiration: _i, preset: _p, ...run } = scenarioView(entry, saved.activePreset)
      return { ...run, trainingLevel: 9 }
    }) }
    await new RpgChapterHost(async () => null, db).refreshAccount(true, transport)
    expect((await unit()).scenarios[0]!.inspiration.slots).toEqual(['parent0', 'parent0-gp0', 'parent0-gp1'])
    expect((await db.umas.get(child.id))?.version).toBe(1)
    expect(await db.outbox.where('[kind+id]').equals(['umas', child.id]).count()).toBe(1)
    expect(await db.itemLedger.count()).toBe(0)
  })
})
