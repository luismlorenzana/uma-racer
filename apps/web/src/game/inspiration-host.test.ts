import 'fake-indexeddb/auto'
import { beforeEach, afterEach, describe, expect, it } from 'vitest'
import { createPlayerProfile, createUmaSave, INSPIRATION_SLOTS, type SkillTemplate, type UmaTemplate } from '@racer/domain'
import { db } from './db'
import { reserveInspirationUnlock } from './inspiration-host'

const gold: SkillTemplate = { id: 'invented-gold', kind: 'gold', name: 'Invented gold', description: '', costSp: 100,
  iconId: null, inheritedSkillId: null, normalSkillId: null, conditions: [] }
const template = (id: string): UmaTemplate => ({ id, charaId: `character-${id}`, name: `Invented ${id}`, outfit: null, jpRelease: '2000-01-01', globalRelease: null, starter: true,
  baseStats: { speed: 100, stamina: 100, power: 100, guts: 100, wit: 100 }, growthRates: { speed: 0, stamina: 0, power: 0, guts: 0, wit: 0 },
  aptitudes: { surface: { turf: 'A', dirt: 'G' }, distance: { sprint: 'B', mile: 'A', medium: 'A', long: 'G' }, strategy: { front: 'A', pace: 'B', late: 'G', end: 'G' } },
  uniqueSkillId: null, awakeningSkillIds: [], realHorseSex: null, signatureRaceFamilyIds: [], imageSource: 'https://invalid.test/portrait.png' })
const child = template('invented-child'), ancestor = { ...template('invented-ancestor'), awakeningSkillIds: [gold.id, 'invented-gold2'] }
const content = { umas: new Map([[child.id, child], [ancestor.id, ancestor]]), skills: new Map([[gold.id, gold], ['invented-gold2', { ...gold, id: 'invented-gold2' }]]) }
let now = 1
const unlock = (nodeId = 'parent0', goldIndex: number | null = null, tier = 1) => reserveInspirationUnlock({ umaId: child.id, tier, nodeId, goldIndex }, content, db, ++now)
const unit = async () => (await db.umas.get(child.id))!.data
async function seed() {
  const uma = createUmaSave(child)
  const profile = createPlayerProfile('invented', 1)
  await db.umas.put({ id: child.id, version: 1, data: uma }); await db.profile.put({ id: 'main', version: 1, data: profile })
  for (const [kind, quantity] of [['slot', 6], ['skill', 12]] as const) {
    const id = `inspiration:t1:${kind}`, data = { itemId: id, quantity, updatedAt: 1 }
    await db.items.put({ id, version: 1, data })
  }
}
describe('local Inspiration unlocks (D263)', () => {
  beforeEach(async () => { await db.delete(); await db.open(); now = 1; await seed() })
  afterEach(() => db.close())
  it('opens at once, spends one token with ledger evidence, queues the writes and never spends twice', async () => {
    await unlock(); await unlock()
    expect((await unit()).scenarios[0]!.inspiration.slots).toEqual(['parent0'])
    expect((await db.items.get('inspiration:t1:slot'))?.data.quantity).toBe(5)
    expect(await db.itemLedger.count()).toBe(1)
    const queued = (await db.outbox.toArray()).map((row) => `${row.op}:${row.kind}`).sort()
    expect(queued).toEqual(['append:itemLedger', 'upsert:items', 'upsert:umas'])
  })
  it('opens exactly six slots and twelve gold positions, rejecting missing parent/ancestor/wrong scenario', async () => {
    await expect(unlock('parent0-gp0')).rejects.toThrow(/parent/)
    await expect(unlock('parent0', 0)).rejects.toThrow(/open/)
    await expect(unlock('parent0', null, 2)).rejects.toThrow(/scenario/)
    for (const nodeId of INSPIRATION_SLOTS) {
      await unlock(nodeId)
      await expect(unlock(nodeId, 0)).rejects.toThrow(/ancestor/)
      const row = (await db.umas.get(child.id))!
      row.data.scenarios[0]!.presets[row.data.activePreset].assignments[nodeId] = { kind: 'lineage', templateId: ancestor.id }
      await db.umas.put(row)
      for (const index of [0, 1]) await unlock(nodeId, index)
    }
    expect((await unit()).scenarios[0]!.inspiration).toMatchObject({ slots: [...INSPIRATION_SLOTS] })
    expect((await unit()).scenarios[0]!.inspiration.golds).toHaveLength(12)
    expect((await db.items.toArray()).every(r => r.data.quantity === 0)).toBe(true)
    expect(await db.itemLedger.count()).toBe(18)
    await expect(unlock('parent0', 0)).resolves.toBeUndefined()
  })
  it('refuses an unlock without tokens', async () => {
    await db.items.update('inspiration:t1:slot', { data: { itemId: 'inspiration:t1:slot', quantity: 0, updatedAt: 1 } })
    await expect(unlock()).rejects.toThrow(/tokens/)
    expect(await db.itemLedger.count()).toBe(0)
  })
})
