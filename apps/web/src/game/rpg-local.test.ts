import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import Dexie from 'dexie'
import { createInspirationBank, createUmaSave, openBankOutfit, rpgCampaignChapter, rpgRunId, type UmaTemplate } from '@racer/domain'
import { db } from './db'
import { abandonRpgFight, actRpgFight, beginRpgFight, enrollRpgOutfit, equipRpgSkills, finishRpgFight, forgetRpgSkill, learnRpgSkill,
  openRpgRun, readRpgAccount, readRpgFight, saveRpgParty, emptyRpgPreset } from './rpg-local'

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
    await enrollRpgOutfit({ template: template(id), contentVersion: 'test', classId: 'brawler', weapons: ['greatsword', 'spear'] })
  }
  await saveRpgParty({ ...emptyRpgPreset(1), slots: ids.slice(0, 5).map((outfitId) => ({ outfitId, loadout: [], familiar: 'greatsword' as const })) as never })
}

describe('local-first RPG (D263)', () => {
  beforeEach(async () => { await db.delete(); await db.open() })
  afterEach(() => db.close())

  it('enrolls and edits parties at once, queuing ordinary sync rows; a member moves between parties', async () => {
    await seedParty()
    const account = await readRpgAccount()
    expect(account.outfits.size).toBe(6)
    expect(account.outfits.get('u1')!.data).toMatchObject({ schemaVersion: 3, profile: { classId: 'brawler' } })
    expect(await outbox()).toEqual([...ids.map((id) => `upsert:rpgOutfits/${id}`), 'upsert:rpgPresets/party-1'].sort())
    await saveRpgParty({ ...emptyRpgPreset(2), slots: ['u1', null, null, null, null].map((id) => id && { outfitId: id, loadout: [], familiar: 'axe' }) as never })
    const parties = (await readRpgAccount()).presets
    expect(parties[0]!.data.slots[0]).toBeNull()
    expect(parties[1]!.data.slots[0]?.outfitId).toBe('u1')
  })

  it('learns, equips and swaps out a variant; parties stop equipping it', async () => {
    await seedParty()
    await db.rpgOutfits.update('u1', (row) => { row.data.profile.level = 10 })
    for (const id of ['greatsword.fire.1', 'greatsword.fire.2', 'greatsword.fire.2a']) await learnRpgSkill('u1', id)
    await equipRpgSkills('party-1', 'u1', [{ tier: 1, id: 'greatsword.fire.2a' }, { tier: 1, id: 'greatsword.fire.1' }], 'bow')
    expect((await readRpgAccount()).presets[0]!.data.slots[0]).toMatchObject({ familiar: 'bow', loadout: [{ id: 'greatsword.fire.2a' }, { id: 'greatsword.fire.1' }] })
    await forgetRpgSkill('u1', 'greatsword.fire.2a')
    expect((await readRpgAccount()).presets[0]!.data.slots[0]!.loadout).toEqual([{ tier: 1, id: 'greatsword.fire.1' }])
    await learnRpgSkill('u1', 'greatsword.fire.2b')
    await expect(forgetRpgSkill('u1', 'greatsword.fire.1')).rejects.toThrow(/variant/)
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
    // Four Skill and two Slot tokens (D286) all repay the six/twelve-token advance debt; nothing lands in Items yet.
    expect((await db.items.get('inspiration:t1:skill'))?.data.quantity).toBe(0)
    expect((await db.inspirationBank.get('main'))!.data.balances['inspiration:t1:skill']).toBe(-8)
    expect((await db.itemLedger.toArray()).map((r) => [r.data.delta, (r.data as { source: { debtPaid: number } }).source.debtPaid])).toEqual([[4, 4], [2, 2]])
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

const oldProfile = (level: number, exp: number) => ({ outfitId: 'u1', sourceContentVersion: 'test', baseStats: template('u1').baseStats,
  growthRates: template('u1').growthRates, sourceAptitudes: template('u1').aptitudes, affinities: { ice: 'A', light: 'A', fire: 'A', dark: 'A' },
  style: 'front', weapon: 'greatsword', defaultSignature: 'fire', tier: 1, level, exp,
  tree: [{ tier: 1, weapon: 'greatsword', element: 'fire', depth: 1, branch: 'foundation', level: 2 }], legacy: [] })
/** A class-era Brawler at a level, as schema 3 stores her (D282). */
const oldProfileClass = (level: number) => {
  const { affinities: _a, style: _s, weapon: _w, defaultSignature: _d, ...rest } = oldProfile(level, 40)
  return { ...rest, classId: 'brawler', weapons: ['greatsword', 'spear'], tree: [], legacy: [] }
}
const legacyDb = (version: number) => {
  const legacy = new Dexie('uma-racer')
  legacy.version(version).stores(Object.fromEntries(db.tables.filter((t) => (version >= 27 || t.name !== 'rpgFights') && !/^(puzzle|pendingPuzzle|constellationBank)/.test(t.name)).map((table) => [table.name,
    [table.schema.primKey.src, ...table.schema.indexes.map((index) => index.src)].join(', ')])))
  return legacy
}

describe('class upgrade (Dexie v29, D282)', () => {
  afterEach(() => db.close())
  it('gives outfits a class, clears loadouts and closes a fight left open under engine v3', async () => {
    await db.delete()
    const legacy = legacyDb(27)
    await legacy.open()
    await legacy.table('rpgOutfits').put({ id: 'u1', version: 7, data: { schemaVersion: 2, profile: oldProfile(14, 40), projectionRevision: 9 } })
    await legacy.table('rpgPresets').put({ id: 'party-2', version: 2, data: { schemaVersion: 2, presetId: 'party-2', name: 'Mine',
      slots: [{ outfitId: 'u1', signature: 'fire', loadout: [{ tier: 1, weapon: 'greatsword', element: 'fire', depth: 1, branch: 'foundation' }] }, null, null, null, null],
      foregroundChapterId: 'ura-finale' } })
    const battleId = 'rpg-battle:party-2:ura-finale:3'
    await legacy.table('rpgCheckpoints').put({ id: 'party-2:ura-finale', version: 5, data: { schemaVersion: 2, presetId: 'party-2', chapterId: 'ura-finale',
      wins: { start: 1, a1r1c1: 2 }, mp: { u1: 9 }, battle: { battleId, nodeId: 'a1r1c2', startedAt: 1, input: { version: 3, seed: 1 } }, battles: 3, clearedAt: null, updatedAt: 1 } })
    await legacy.table('rpgFights').put({ id: battleId, actions: [], updatedAt: 1 })
    legacy.close()
    await db.open()
    // Version 30 (D285) then restarts levels; the class migration's level carry is pinned in the domain save tests.
    expect((await db.rpgOutfits.get('u1'))!.data).toMatchObject({ schemaVersion: 3,
      profile: { classId: 'brawler', weapons: ['greatsword', 'spear'], tier: 1, level: 1, exp: 0, tree: [], legacy: [] } })
    expect((await db.rpgPresets.get('party-2'))!.data).toEqual({ schemaVersion: 3, presetId: 'party-2', name: 'Mine', foregroundChapterId: 'ura-finale',
      slots: [{ outfitId: 'u1', loadout: [], familiar: 'greatsword' }, null, null, null, null] })
    expect((await db.rpgCheckpoints.get('party-2:ura-finale'))!.data).toMatchObject({ battle: null, wins: { a1r1c1: 2 }, mp: { u1: 9 } })
    expect(await db.rpgFights.count()).toBe(0)
    expect((await db.outbox.toArray()).map((r) => `${r.op}:${r.kind}/${r.id}`).sort()).toEqual([
      'upsert:rpgCheckpoints/party-2:ura-finale', 'upsert:rpgOutfits/u1', 'upsert:rpgPresets/party-2'])
  })
})

describe('owner RPG reset (Dexie v30, D285)', () => {
  afterEach(() => db.close())
  it("returns every Uma to Lv1 with empty trees, clears loadouts and Party 1's URA Finale run only", async () => {
    await db.delete()
    const legacy = legacyDb(29)
    await legacy.open()
    const learned = { ...oldProfileClass(14), tree: [{ tier: 1, id: 'greatsword.fire.1' }, { tier: 1, id: 'greatsword.fire.2' }] }
    await legacy.table('rpgOutfits').put({ id: 'u1', version: 7, data: { schemaVersion: 3, profile: learned, projectionRevision: 9 } })
    await legacy.table('rpgPresets').put({ id: 'party-1', version: 2, data: { schemaVersion: 3, presetId: 'party-1', name: 'Mine', foregroundChapterId: 'ura-finale',
      slots: [{ outfitId: 'u1', loadout: [{ tier: 1, id: 'greatsword.fire.2' }], familiar: 'bow' }, null, null, null, null] } })
    const run = (presetId: string, battle: unknown) => ({ schemaVersion: 2, presetId, chapterId: 'ura-finale', wins: { start: 1, a1r1c1: 3, 'fire-boss': 1 },
      mp: { u1: 9 }, battle, battles: 12, clearedAt: 5, updatedAt: 1 })
    const battleId = 'rpg-battle:party-1:ura-finale:12'
    await legacy.table('rpgCheckpoints').put({ id: 'party-1:ura-finale', version: 5, data: run('party-1', { battleId, nodeId: 'a1r1c2', startedAt: 1, input: { version: 4, seed: 1 } }) })
    await legacy.table('rpgCheckpoints').put({ id: 'party-2:ura-finale', version: 3, data: run('party-2', null) })
    await legacy.table('rpgFights').put({ id: battleId, actions: [], updatedAt: 1 })
    legacy.close()
    await db.open()
    expect((await db.rpgOutfits.get('u1'))!.data).toMatchObject({ schemaVersion: 3, projectionRevision: 10,
      profile: { classId: 'brawler', weapons: ['greatsword', 'spear'], tier: 1, level: 1, exp: 0, tree: [], legacy: [] } })
    expect((await db.rpgPresets.get('party-1'))!.data.slots[0]).toEqual({ outfitId: 'u1', loadout: [], familiar: 'bow' })
    expect((await db.rpgCheckpoints.get('party-1:ura-finale'))!.data).toMatchObject({ wins: { start: 1 }, mp: {}, battle: null, clearedAt: null, battles: 12 })
    expect((await db.rpgCheckpoints.get('party-2:ura-finale'))!.data).toMatchObject({ wins: { a1r1c1: 3 }, clearedAt: 5 })
    expect(await db.rpgFights.count()).toBe(0)
    expect((await db.outbox.toArray()).map((r) => `${r.op}:${r.kind}/${r.id}`).sort()).toEqual([
      'upsert:rpgCheckpoints/party-1:ura-finale', 'upsert:rpgOutfits/u1', 'upsert:rpgPresets/party-1'])
  })
})

describe('campaign upgrade (Dexie v27)', () => {
  afterEach(() => db.close())
  it('restarts outfits at Lv1 once, clears loadouts, retires first-map checkpoints and lands a queued unlock', async () => {
    await db.delete()
    const legacy = legacyDb(26)
    await legacy.open()
    const profile = oldProfile(12, 40)
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
    expect(outfit.data).toMatchObject({ schemaVersion: 3, projectionRevision: 3, profile: { tier: 1, level: 1, exp: 0, tree: [], classId: 'brawler' } })
    expect((await db.rpgPresets.get('party-1'))!.data).toMatchObject({ schemaVersion: 3, foregroundChapterId: null, slots: [{ outfitId: 'u1', loadout: [] }, null, null, null, null] })
    expect(await db.rpgCheckpoints.count()).toBe(0)
    expect(await db.pendingRpgCommands.count()).toBe(0)
    expect((await db.items.get('inspiration:t1:slot'))).toMatchObject({ version: 4, data: { quantity: 2 } })
    expect(await db.itemLedger.get(movement.id)).toBeTruthy()
    expect((await db.outbox.toArray()).map((r) => `${r.op}:${r.kind}/${r.id}`).sort()).toEqual([
      `append:itemLedger/${movement.id}`, 'upsert:items/inspiration:t1:slot', 'upsert:rpgOutfits/u1', 'upsert:rpgPresets/party-1'])
  })
})
