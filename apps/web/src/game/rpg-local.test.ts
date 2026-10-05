import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import Dexie from 'dexie'
import { createInspirationBank, createUmaSave, enrollRpgOutfit as enrollProfile, openBankOutfit, rpgCampaignChapter,
  rpgRunId, type UmaTemplate } from '@racer/domain'
import { db } from './db'
import { abandonRpgFight, actRpgFight, beginRpgFight, enrollRpgOutfit, finishRpgFight, openRpgRun, readRpgAccount,
  readRpgFight, saveRpgParty, emptyRpgPreset } from './rpg-local'

// Invented outfits and cast only.
const template = (id: string): UmaTemplate => ({ id, charaId: `character-${id}`, name: `Invented ${id}`, outfit: null, jpRelease: '2000-01-01', globalRelease: null, starter: true,
  baseStats: { speed: 115, stamina: 110, power: 110, guts: 100, wit: 110 }, growthRates: { speed: 0, stamina: 0, power: 0, guts: 0, wit: 0 },
  aptitudes: { surface: { turf: 'A', dirt: 'G' }, distance: { sprint: 'G', mile: 'A', medium: 'A', long: 'G' }, strategy: { front: 'A', pace: 'A', late: 'G', end: 'G' } },
  uniqueSkillId: null, awakeningSkillIds: [], realHorseSex: null, signatureRaceFamilyIds: [], imageSource: 'https://invalid.test/portrait.png' })
const ids = ['u1', 'u2', 'u3', 'u4', 'u5', 'u6']
const chapter = rpgCampaignChapter('ura-finale', Array.from({ length: 7 }, (_, i) => ({ id: `cast${i}`, name: `Rival ${i}` })))
const outbox = async () => (await db.outbox.toArray()).map((row) => `${row.op}:${row.kind}/${row.id}`).sort()

async function seedParty() {
  for (const id of ids) {
    await db.umas.put({ id, version: 1, data: createUmaSave(template(id)) })
    await enrollRpgOutfit({ template: template(id), contentVersion: 'test', style: 'front', weapon: 'greatsword', signature: 'fire' })
  }
  await saveRpgParty({ ...emptyRpgPreset(1), slots: ids.slice(0, 5).map((outfitId) => ({ outfitId, signature: 'fire' as const, loadout: [] })) as never })
}

describe('local-first RPG (D263)', () => {
  beforeEach(async () => { await db.delete(); await db.open() })
  afterEach(() => db.close())

  it('enrolls and edits parties at once, queuing ordinary sync rows; a member moves between parties', async () => {
    await seedParty()
    const account = await readRpgAccount()
    expect(account.outfits.size).toBe(6)
    expect(account.outfits.get('u1')!.data.schemaVersion).toBe(2)
    expect(await outbox()).toEqual([...ids.map((id) => `upsert:rpgOutfits/${id}`), 'upsert:rpgPresets/party-1'].sort())
    await saveRpgParty({ ...emptyRpgPreset(2), slots: ['u1', null, null, null, null].map((id) => id && { outfitId: id, signature: 'fire', loadout: [] }) as never })
    const parties = (await readRpgAccount()).presets
    expect(parties[0]!.data.slots[0]).toBeNull()
    expect(parties[1]!.data.slots[0]?.outfitId).toBe('u1')
  })

  it('plays a fight to the end and settles EXP, carried MP and tokens that repay the advance first', async () => {
    await seedParty()
    let bank = createInspirationBank([{ id: 'u1', scenarios: [{ tier: 1, inspiration: { slots: [], golds: [] } }] }], 1)
    bank = openBankOutfit(bank, 'u1')
    await db.inspirationBank.put({ id: 'main', version: 3, data: bank })
    await openRpgRun('party-1', chapter.id)
    const nodeId = chapter.nodes.find((n) => n.id === 'start')!.exits[0]!
    const battleId = await beginRpgFight(chapter, 'party-1', nodeId)
    let view = (await readRpgFight('party-1', chapter.id))!
    let count = 0
    while (view.step.state.outcome === 'active' && count < 200) {
      const state = view.step.state
      const actor = state.units.find((u) => u.side === 'ally' && u.hp > 0 && !state.acted.includes(u.id))!
      const target = state.units.find((u) => u.side === 'enemy' && u.hp > 0)!
      await actRpgFight('party-1', chapter.id, battleId, count, { kind: 'attack', actorId: actor.id, targetId: target.id })
      count += 1
      view = (await readRpgFight('party-1', chapter.id))!
    }
    expect(view.step.state.outcome).toBe('victory')
    await expect(actRpgFight('party-1', chapter.id, battleId, count - 1, { kind: 'attack', actorId: 'u1', targetId: 'foe1' })).rejects.toThrow(/changed/)
    await db.outbox.clear()
    const settled = await finishRpgFight(chapter, 'party-1', battleId)
    expect(settled.outcome).toBe('win')
    const run = (await db.rpgCheckpoints.get(rpgRunId('party-1', chapter.id)))!.data
    expect(run.wins[nodeId]).toBe(1)
    expect(run.battle).toBeNull()
    expect((await db.rpgOutfits.get('u1'))!.data.profile.exp).toBe(settled.result!.members[0]!.delta)
    // Two Skill and one Slot token all repay the six/twelve-token advance debt; nothing lands in Items yet.
    expect((await db.items.get('inspiration:t1:skill'))?.data.quantity).toBe(0)
    expect((await db.inspirationBank.get('main'))!.data.balances['inspiration:t1:skill']).toBe(-10)
    expect((await db.itemLedger.toArray()).map((r) => [r.data.delta, (r.data as { source: { debtPaid: number } }).source.debtPaid])).toEqual([[2, 2], [1, 1]])
    expect(await outbox()).toEqual([`append:itemLedger/rpg-inspiration:${battleId}:skill`, `append:itemLedger/rpg-inspiration:${battleId}:slot`,
      `append:rpgResults/${battleId}`, 'upsert:inspirationBank/main', 'upsert:items/inspiration:t1:skill', 'upsert:items/inspiration:t1:slot',
      `upsert:rpgCheckpoints/${rpgRunId('party-1', chapter.id)}`, ...ids.slice(0, 5).map((id) => `upsert:rpgOutfits/${id}`)].sort())
    expect(await db.rpgFights.count()).toBe(0)
  })

  it('a fight can be left and resumed, or abandoned with no reward and MP as it was', async () => {
    await seedParty()
    const nodeId = chapter.nodes.find((n) => n.id === 'start')!.exits[0]!
    const battleId = await beginRpgFight(chapter, 'party-1', nodeId)
    await expect(beginRpgFight(chapter, 'party-1', nodeId)).rejects.toThrow(/open fight/)
    const view = (await readRpgFight('party-1', chapter.id))!
    expect(view.run.battle?.battleId).toBe(battleId)
    await abandonRpgFight('party-1', chapter.id)
    const run = (await db.rpgCheckpoints.get(rpgRunId('party-1', chapter.id)))!.data
    expect(run.battle).toBeNull()
    expect(run.wins[nodeId]).toBeUndefined()
    expect(run.mp).toEqual({})
    expect(await readRpgFight('party-1', chapter.id)).toBeNull()
  })
})

describe('campaign upgrade (Dexie v27)', () => {
  afterEach(() => db.close())
  it('restarts outfits at Lv1 once, clears loadouts, retires first-map checkpoints and lands a queued unlock', async () => {
    await db.delete()
    const legacy = new Dexie('uma-racer')
    legacy.version(26).stores(Object.fromEntries(db.tables.filter((t) => t.name !== 'rpgFights').map((table) => [table.name,
      [table.schema.primKey.src, ...table.schema.indexes.map((index) => index.src)].join(', ')])))
    await legacy.open()
    const profile = { ...enrollProfile({ outfit: template('u1'), contentVersion: 'test', style: 'front', weapon: 'greatsword', defaultSignature: 'fire' }), level: 12, exp: 40 }
    await legacy.table('rpgOutfits').put({ id: 'u1', version: 3, data: { schemaVersion: 1, profile, projectionRevision: 2 } })
    await legacy.table('rpgPresets').put({ id: 'party-1', version: 2, data: { schemaVersion: 1, presetId: 'party-1', name: 'Old',
      slots: [{ outfitId: 'u1', signature: 'fire', loadout: [{ tier: 1, weapon: 'greatsword', element: 'fire', depth: 1, branch: 'foundation' }] }, null, null, null, null], foregroundChapterId: 'old-map' } })
    await legacy.table('rpgCheckpoints').put({ id: 'party-1:old-map', version: 5, data: { schemaVersion: 1 } })
    const movement = { id: 'inspiration:u1:1:parent0:slot', itemId: 'inspiration:t1:slot', delta: -1, reason: 'inspiration-unlock', createdAt: 9,
      source: { kind: 'inspiration-unlock', umaId: 'u1', tier: 1, nodeId: 'parent0', goldIndex: null } }
    await legacy.table('items').put({ id: 'inspiration:t1:slot', version: 4, data: { itemId: 'inspiration:t1:slot', quantity: 3, updatedAt: 1 } })
    await legacy.table('pendingRpgCommands').bulkPut([
      { id: movement.id, status: 'pending', queuedAt: 9, conflict: null, body: { action: 'spend-inspiration',
        upserts: [{ kind: 'items', id: 'inspiration:t1:slot', data: { itemId: 'inspiration:t1:slot', quantity: 2, updatedAt: 9 } }],
        appends: [{ kind: 'itemLedger', id: movement.id, data: movement, createdAt: 9 }] } },
      { id: 'rpg-map:old', status: 'pending', queuedAt: 8, conflict: null, body: { action: 'choose-node', upserts: [], appends: [] } },
    ])
    legacy.close()
    await db.open()
    const outfit = (await db.rpgOutfits.get('u1'))!
    expect(outfit.version).toBe(3)
    expect(outfit.data).toMatchObject({ schemaVersion: 2, projectionRevision: 3, profile: { tier: 1, level: 1, exp: 0, tree: [], style: 'front' } })
    expect((await db.rpgPresets.get('party-1'))!.data).toMatchObject({ schemaVersion: 2, foregroundChapterId: null, slots: [{ outfitId: 'u1', loadout: [] }, null, null, null, null] })
    expect(await db.rpgCheckpoints.count()).toBe(0)
    expect(await db.pendingRpgCommands.count()).toBe(0)
    expect((await db.items.get('inspiration:t1:slot'))).toMatchObject({ version: 4, data: { quantity: 2 } })
    expect(await db.itemLedger.get(movement.id)).toBeTruthy()
    expect((await db.outbox.toArray()).map((r) => `${r.op}:${r.kind}/${r.id}`).sort()).toEqual([
      `append:itemLedger/${movement.id}`, 'upsert:items/inspiration:t1:slot', 'upsert:rpgOutfits/u1', 'upsert:rpgPresets/party-1'])
  })
})
