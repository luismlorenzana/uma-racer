import 'fake-indexeddb/auto'

import {
  createPlayerProfile,
  createInitialSave,
  createUmaBadgeState,
  createTrainerBadgeState,
  createUmaSave,
  buildUmaFlairCatalog,
  evaluateUmaFlair,
  type ContentAtlas,
  type RaceTemplate,
  type SkillTemplate,
  type SupportCardTemplate,
  type UmaTemplate,
  type UmaSave,
} from '@racer/domain'
import Dexie from 'dexie'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { saveApi } from '../api/client'
import type { LoadedContent } from '../content/runtime'
import { db } from './db'
import { bootstrapBadgeFacts, bootstrapUmaFlair } from './badges'
import { GameRuntime } from './runtime'
import { clearGameState, localDay, replaceUma, useGame } from './store'
import {
  adoptServerSnapshot,
  applyOwedDailyGrant,
  bootstrapGoalPlans,
  completeStarterSeed,
  isDatabaseSemanticallyEmpty,
  persistInitial,
  queueInTransaction,
  readLocalSnapshot,
} from './persistence'

const aptitudes = {
  surface: { turf: 'A', dirt: 'G' },
  distance: { sprint: 'B', mile: 'A', medium: 'A', long: 'C' },
  strategy: { front: 'D', pace: 'A', late: 'B', end: 'C' },
} as const

function uma(id: string): UmaTemplate {
  return {
    id,
    charaId: `chara-${id}`,
    name: `Synthetic ${id}`,
    outfit: null,
    jpRelease: '2000-01-01',
    globalRelease: null,
    starter: true,
    baseStats: { speed: 101, stamina: 102, power: 103, guts: 104, wit: 105 },
    growthRates: { speed: 0, stamina: 0, power: 0, guts: 0, wit: 0 },
    aptitudes,
    uniqueSkillId: null,
    awakeningSkillIds: [],
    realHorseSex: null,
    signatureRaceFamilyIds: [],
    imageSource: 'https://invalid.test/synthetic.png',
  }
}

function card(): SupportCardTemplate {
  return {
    id: 'card-1',
    charaId: 'card-chara-1',
    charName: 'Synthetic Card Character',
    title: 'Synthetic Starter',
    type: 'speed',
    jpRelease: '2000-01-01',
    era: 1,
    obtain: 'free',
    starter: true,
    hintSkillIds: [],
    eventSkillIds: [],
    effectProfile: {
      trainingBonus: 1,
      friendshipBonus: 1,
      statBonus: 1,
      skillPointBonus: 1,
      specialtyPriority: 1,
      hintFrequency: 1,
      raceBonus: 1,
      initialStats: 1,
    },
    uniqueEffect: null,
    imageSource: 'https://invalid.test/synthetic.png',
  }
}

const paidSkill: SkillTemplate = {
  id: 'skill-paid-1',
  kind: 'white',
  name: 'Synthetic Speed Skill',
  description: 'Synthetic fixture.',
  costSp: 90,
  iconId: null,
  activation: 0,
  conditions: [{ precondition: null, condition: 'phase>=1', baseTime: 10_000, cooldown: 0, effects: [{ type: 27, value: 1_500 }] }],
  inheritedSkillId: null,
  normalSkillId: null,
}

const goalRaces: RaceTemplate[] = [
  ['goal-g2', 'g2', '101'], ['goal-g3', 'g3', '102'], ['goal-op', 'op', '103'],
].map(([id, grade, familyId], index) => ({
  id: id!, familyId: familyId!, name: `Synthetic Goal ${index + 1}`, grade: grade as RaceTemplate['grade'], surface: 'turf',
  distance: 1600 + index * 200, distanceCategory: index < 2 ? 'mile' : 'medium', direction: 'left', venue: 'Synthetic',
  venueKey: 'synthetic-venue', venueTags: [], series: [],
  courseId: `goal-course-${index + 1}`, season: 1, fieldSize: 8,
}))

function content(): LoadedContent {
  const umas = Array.from({ length: 25 }, (_, index) => uma(`u${String(index).padStart(2, '0')}`))
  const cards = [card()]
  const atlas = (kind: ContentAtlas['kind'], ids: string[]): ContentAtlas => ({
    schemaVersion: 1,
    kind,
    frameWidth: 128,
    frameHeight: 128,
    pages: [{ path: `${kind}.webp`, width: 128 * ids.length, height: 128 }],
    frames: Object.fromEntries(ids.map((id, index) => [id, { page: 0, x: index * 128, y: 0, width: 128 as const, height: 128 as const }])),
  })
  return {
    manifest: { version: 'abc123def456', generatedAt: '2000-01-01T00:00:00Z', source: {}, files: [] },
    origin: 'network',
    umas: { items: umas, byId: new Map(umas.map((item) => [item.id, item])) },
    cards: { items: cards, byId: new Map(cards.map((item) => [item.id, item])) },
    skills: { items: [paidSkill], byId: new Map([[paidSkill.id, paidSkill]]) },
    races: { items: [], byId: new Map() },
    courses: { items: [], byId: new Map() },
    atlases: {
      'uma-icons': { descriptor: atlas('uma-icons', umas.map((item) => item.id)), pageUrls: ['blob:synthetic-umas'] },
      'card-icons': { descriptor: atlas('card-icons', cards.map((item) => item.id)), pageUrls: ['blob:synthetic-cards'] },
    },
  }
}

const toRecord = (value: object): Record<string, unknown> => value as unknown as Record<string, unknown>

function currentBadgeState(loaded: LoadedContent, uma: UmaSave) {
  const state = createUmaBadgeState(uma, 1)
  return evaluateUmaFlair(
    buildUmaFlairCatalog({ state, races: loaded.races.items }),
    state,
    { source: { kind: 'migration', id: null, tier: null }, earnedAt: 1, retroactive: true },
  ).state
}

async function resetDatabase(): Promise<void> {
  db.close()
  await db.delete()
}

describe('save persistence', () => {
  beforeEach(resetDatabase)

  it('bootstraps all pre-goal Umas atomically, queues once, and is idempotent', async () => {
    const loaded = content()
    const goalContent: LoadedContent = {
      ...loaded,
      races: { items: goalRaces, byId: new Map(goalRaces.map((race) => [race.id, race])) },
    }
    const old = { ...createUmaSave(loaded.umas.items[0]!), scenarioStarted: true, goalPlanVersion: 0, level: 21 }
    await db.open()
    await db.umas.put({ id: old.templateId, data: old, version: 7 })
    expect(await bootstrapGoalPlans(goalContent, 100)).toBe(1)
    const saved = await db.umas.get(old.templateId)
    expect(saved).toMatchObject({ version: 7, data: { goalPlanVersion: 1 } })
    expect(saved?.data.scenarioJourneys.slice(0, 2).map((journey) => journey.tracking)).toEqual(['legacy-untracked', 'legacy-untracked'])
    expect(saved?.data.scenarioJourneys[2]).toMatchObject({ tier: 3, tracking: 'tracked', state: 'active' })
    expect(await db.outbox.where('[kind+id]').equals(['umas', old.templateId]).count()).toBe(1)
    expect(await bootstrapGoalPlans(goalContent, 101)).toBe(0)
    expect(await db.outbox.where('[kind+id]').equals(['umas', old.templateId]).count()).toBe(1)
  })
  afterEach(resetDatabase)

  it('initializes profile, roster, ledger, and coalesced outbox atomically', async () => {
    const loaded = content()
    await db.open()
    expect(await isDatabaseSemanticallyEmpty()).toBe(true)
    await persistInitial(loaded, '2000-01-02', 10)

    const snapshot = await readLocalSnapshot()
    expect(snapshot?.profile.data).toMatchObject({ tickets: 50, cardCoupons: 3, featuredUmaId: 'u00' })
    expect(snapshot?.umas).toHaveLength(25)
    expect(snapshot?.cards).toHaveLength(1)
    expect(await db.ledger.count()).toBe(2)
    expect(await db.outbox.count()).toBe(29)
    expect(await isDatabaseSemanticallyEmpty()).toBe(false)

    await db.transaction('rw', db.outbox, async () => {
      await queueInTransaction('profile', 'main', 'upsert', 11)
      await queueInTransaction('profile', 'main', 'upsert', 12)
    })
    expect(await db.outbox.where('[kind+id]').equals(['profile', 'main']).count()).toBe(1)
    expect(await applyOwedDailyGrant('2000-01-02', 13)).toBe(0)
    expect(await db.ledger.count()).toBe(2)
  })

  it('bootstraps one strict badge fact state per owned Uma exactly once', async () => {
    const loaded = content()
    await db.open()
    await persistInitial(loaded, '2000-01-02', 10)
    await db.outbox.clear()

    await expect(bootstrapBadgeFacts(loaded, 20)).resolves.toBe(25)
    expect(await db.badges.count()).toBe(25)
    expect(await db.outbox.where('kind').equals('badges').count()).toBe(25)
    const first = await db.badges.get('uma:u00')
    expect(first?.data).toMatchObject({ scope: 'uma', umaId: 'u00', history: { training: 'since-tracking', lineage: 'since-tracking' } })

    if (!first || first.data.scope !== 'uma') throw new Error('Expected an Uma badge state')
    await db.badges.put({ ...first, data: {
      ...first.data,
      facts: { ...first.data.facts, statPeaks: { ...first.data.facts.statPeaks, speed: 600 } },
    } })
    await expect(bootstrapUmaFlair(loaded, 25)).resolves.toBe(1)
    const awarded = await db.badges.get('uma:u00')
    expect(awarded?.data).toMatchObject({ evaluatorVersion: 1, awards: { badges: [{ awardKey: 'badge:stat:speed', stage: 'bronze' }] } })
    expect(await db.flairEvents.toArray()).toEqual([expect.objectContaining({ data: expect.objectContaining({ retroactive: true, source: { kind: 'migration', id: null, tier: null } }) })])
    await expect(bootstrapUmaFlair(loaded, 26)).resolves.toBe(0)

    await expect(bootstrapBadgeFacts(loaded, 30)).resolves.toBe(0)
    expect(await db.badges.get('uma:u00')).toEqual(awarded)
    expect(await db.outbox.where('kind').equals('badges').count()).toBe(25)
  })

  it('validates the complete starter set before writing any first-run row', async () => {
    const loaded = content()
    const items = loaded.umas.items.slice(1)
    const incomplete: LoadedContent = {
      ...loaded,
      umas: { items, byId: new Map(items.map((item) => [item.id, item])) },
    }
    await db.open()

    await expect(persistInitial(incomplete, '2000-01-02', 10)).rejects.toThrow(/exactly 25/)
    expect(await isDatabaseSemanticallyEmpty()).toBe(true)
  })

  it('reports an unsupported local profile schema without replacing it', async () => {
    await db.open()
    const unsupported = { ...createPlayerProfile('synthetic-v1', 1), schemaVersion: 3 }
    await db.table('profile').put({ id: 'main', data: unsupported, version: 7 })

    await expect(readLocalSnapshot()).rejects.toThrow(/App update required/)
    expect(await db.table('profile').get('main')).toMatchObject({ version: 7, data: { schemaVersion: 3 } })
  })

  it('parses a cloud snapshot before replacing any local rows', async () => {
    const loaded = content()
    await db.open()
    await persistInitial(loaded, '2000-01-02', 10)
    const savedUma = createUmaSave(loaded.umas.items[0]!)
    const incomplete = {
      entities: [{ kind: 'umas', id: savedUma.templateId, version: 1, data: toRecord(savedUma), deleted: false, updatedAt: 20 }],
      logs: [],
      serverTime: 20,
    }

    await expect(adoptServerSnapshot(incomplete)).rejects.toThrow(/profile\/main is missing/)
    expect((await readLocalSnapshot())?.umas).toHaveLength(25)
  })

  it('adopts a valid server copy and clears first-run outbox work', async () => {
    const loaded = content()
    await db.open()
    await persistInitial(loaded, '2000-01-02', 10)
    const profile = { ...createPlayerProfile(loaded.manifest.version, 1), tickets: 275, featuredUmaId: 'u03' }
    const savedUma = createUmaSave(loaded.umas.items[3]!)
    await expect(adoptServerSnapshot({
      entities: [
        { kind: 'profile', id: 'main', version: 4, data: toRecord(profile), deleted: false, updatedAt: 20 },
        { kind: 'umas', id: savedUma.templateId, version: 2, data: toRecord(savedUma), deleted: false, updatedAt: 20 },
      ],
      logs: [],
      serverTime: 20,
    })).resolves.toBe('adopted')

    const snapshot = await readLocalSnapshot()
    expect(snapshot?.profile).toMatchObject({ version: 4, data: { tickets: 275, featuredUmaId: 'u03' } })
    expect(snapshot?.umas.map((row) => row.id)).toEqual(['u03'])
    expect(await db.outbox.count()).toBe(0)
  })

  it('migrates the flat v1 profile and completes starters without overwriting an existing Uma', async () => {
    const loaded = content()
    const current = createUmaSave(loaded.umas.items[0]!)
    const { schemaVersion: _schemaVersion, scenarioStarted: _scenarioStarted, skillHistory: _skillHistory,
      currentParents: _currentParents, parentSnapshot: _parentSnapshot, goalPlanVersion: _goalPlanVersion,
      scenarioJourneys: _scenarioJourneys, ...legacyUma } = current
    const existing = { ...legacyUma, stats: { ...legacyUma.stats, speed: 777 } }
    const legacy = new Dexie('uma-racer')
    legacy.version(1).stores({
      profile: 'id',
      umas: 'id',
      cards: 'id',
      badges: 'id',
      raceResults: 'id, createdAt',
      ledger: 'id, createdAt',
      outbox: '++seq, [kind+id]',
    })
    await legacy.open()
    await legacy.table('profile').put({ id: 'main', tickets: 225, cardCoupons: 7, umaCoupons: 2, umaShards: 9, lastDailyGrant: '2000-01-01', version: 6 })
    await legacy.table('umas').put({ id: existing.templateId, data: existing, version: 3 })
    await legacy.table('badges').put({ id: `uma:${current.templateId}`, data: createUmaBadgeState(current, 1), version: 1 })
    await legacy.table('outbox').add({ kind: 'umas', id: existing.templateId, op: 'upsert', queuedAt: 1 })
    legacy.close()

    await db.open()
    const migrated = await readLocalSnapshot()
    expect(migrated?.profile).toMatchObject({ version: 6, data: { schemaVersion: 2, tickets: 225, cardCoupons: 7, starterSeedContentVersion: null } })
    expect(migrated?.umas[0]?.data).toMatchObject({ schemaVersion: 2, scenarioStarted: true, currentParents: [], goalPlanVersion: 0 })
    expect(await db.outbox.where('kind').equals('profile').count()).toBe(1)
    expect(await db.outbox.where('[kind+id]').equals(['umas', existing.templateId]).count()).toBe(1)
    await completeStarterSeed(loaded, 30)

    const completed = await readLocalSnapshot()
    expect(completed?.profile.data.starterSeedContentVersion).toBe(loaded.manifest.version)
    expect(completed?.umas).toHaveLength(25)
    expect(completed?.umas.find((row) => row.id === existing.templateId)).toMatchObject({ version: 3, data: { stats: { speed: 777 } } })
    expect(await db.badges.count()).toBe(1)
  })

  it('migrates a consistent v1 cloud snapshot and queues preserved-version replacements', async () => {
    const loaded = content()
    await db.open()
    const profile = { ...createPlayerProfile(loaded.manifest.version, 1), schemaVersion: 1 as const, tickets: 88 }
    const current = createUmaSave(loaded.umas.items[0]!)
    const { schemaVersion: _schemaVersion, scenarioStarted: _scenarioStarted, skillHistory: _skillHistory,
      currentParents: _currentParents, parentSnapshot: _parentSnapshot, goalPlanVersion: _goalPlanVersion,
      scenarioJourneys: _scenarioJourneys, ...legacyUma } = current
    await expect(adoptServerSnapshot({
      entities: [
        { kind: 'profile', id: 'main', version: 7, data: profile, deleted: false, updatedAt: 20 },
        { kind: 'umas', id: legacyUma.templateId, version: 5, data: legacyUma, deleted: false, updatedAt: 20 },
      ],
      logs: [],
      serverTime: 21,
    })).resolves.toBe('adopted')
    const snapshot = await readLocalSnapshot()
    expect(snapshot?.profile).toMatchObject({ version: 7, data: { schemaVersion: 2, tickets: 88 } })
    expect(snapshot?.umas[0]).toMatchObject({ version: 5, data: { schemaVersion: 2, scenarioStarted: true } })
    expect((await db.outbox.toArray()).map((row) => `${row.kind}/${row.id}`).sort()).toEqual(['profile/main', `umas/${legacyUma.templateId}`])
    await expect(adoptServerSnapshot({
      entities: [
        { kind: 'profile', id: 'main', version: 7, data: profile, deleted: false, updatedAt: 20 },
        { kind: 'umas', id: current.templateId, version: 5, data: current, deleted: false, updatedAt: 20 },
      ],
      logs: [],
      serverTime: 21,
    })).rejects.toThrow(/mixes incompatible/)
  })
})

describe('game bootstrap coordinator', () => {
  let runtime: GameRuntime

  beforeEach(async () => {
    await resetDatabase()
    clearGameState()
    runtime = new GameRuntime()
    vi.stubGlobal('window', { addEventListener: vi.fn(), removeEventListener: vi.fn() })
    vi.stubGlobal('document', { visibilityState: 'visible', addEventListener: vi.fn(), removeEventListener: vi.fn() })
    vi.stubGlobal('navigator', { onLine: false })
  })

  afterEach(async () => {
    runtime.stop()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
    await resetDatabase()
  })

  it('seeds after an empty cloud response and after an unavailable cloud response', async () => {
    const loaded = content()
    const load = vi.spyOn(saveApi, 'load').mockResolvedValueOnce({ entities: [], logs: [], serverTime: 1 })
    await runtime.start(loaded)
    expect(useGame.getState()).toMatchObject({ status: 'ready', persistent: true, profile: { tickets: 50 } })
    expect(Object.keys(useGame.getState().umas)).toHaveLength(25)
    expect(load).toHaveBeenCalledTimes(1)

    runtime.stop()
    await resetDatabase()
    load.mockRejectedValueOnce(new Error('synthetic offline'))
    await runtime.start(loaded)
    expect(useGame.getState().status).toBe('ready')
    expect(Object.keys(useGame.getState().umas)).toHaveLength(25)
  })

  it('adopts a complete cloud save before publishing ready state', async () => {
    const loaded = content()
    const initial = createInitialSave(loaded.umas.items, loaded.cards.items, loaded.manifest.version, localDay(), 1)
    const entities = [
      { kind: 'profile' as const, id: 'main', data: toRecord({ ...initial.profile, tickets: 325 }), version: 3, deleted: false, updatedAt: 2 },
      ...initial.umas.map((data) => ({ kind: 'umas' as const, id: data.templateId, data: toRecord(data), version: 1, deleted: false, updatedAt: 2 })),
      ...initial.cards.map((data) => ({ kind: 'cards' as const, id: data.templateId, data: toRecord(data), version: 1, deleted: false, updatedAt: 2 })),
      ...initial.umas.map((data) => ({ kind: 'badges' as const, id: `uma:${data.templateId}`, data: toRecord(currentBadgeState(loaded, data)), version: 1, deleted: false, updatedAt: 2 })),
      { kind: 'badges' as const, id: 'trainer', data: toRecord(createTrainerBadgeState(1)), version: 1, deleted: false, updatedAt: 2 },
    ]
    vi.spyOn(saveApi, 'load').mockResolvedValue({ entities, logs: [], serverTime: 2 })

    await runtime.start(loaded)

    expect(useGame.getState().profile?.tickets).toBe(325)
    expect(Object.keys(useGame.getState().umas)).toHaveLength(25)
    expect(useGame.getState().sync.pending).toBe(0)
  })

  it('boots an existing local save without a full cloud pull and leaves it on sign-out cleanup', async () => {
    const loaded = content()
    await db.open()
    await persistInitial(loaded, localDay(), 1)
    const load = vi.spyOn(saveApi, 'load')

    await runtime.start(loaded)
    expect(load).not.toHaveBeenCalled()
    expect(useGame.getState().status).toBe('ready')
    expect(window.addEventListener).toHaveBeenCalledWith('online', expect.any(Function))
    runtime.stop()
    expect(window.removeEventListener).toHaveBeenCalledWith('online', expect.any(Function))
    expect(useGame.getState().profile).toBeNull()
    expect((await readLocalSnapshot())?.umas).toHaveLength(25)
  })

  it('persists a legal skill loadout and coalesces Uma outbox work before publishing it', async () => {
    const loaded = content()
    vi.spyOn(saveApi, 'load').mockResolvedValue({ entities: [], logs: [], serverTime: 1 })
    await runtime.start(loaded)
    const current = useGame.getState().umas.u00!
    const next = {
      ...current,
      skillPoints: 100,
      skillLibrary: [{ skillId: paidSkill.id, origin: 'card' as const, sourceId: 'card-1' }],
    }
    const row = await db.umas.get('u00')
    await db.umas.put({ ...row!, data: next })
    replaceUma(next)

    await runtime.setUmaLoadout('u00', [paidSkill.id])

    expect(useGame.getState().umas.u00?.loadoutSkillIds).toEqual([paidSkill.id])
    expect((await db.umas.get('u00'))?.data.loadoutSkillIds).toEqual([paidSkill.id])
    expect(await db.outbox.where('[kind+id]').equals(['umas', 'u00']).count()).toBe(1)
    await expect(runtime.setUmaLoadout('u00', [paidSkill.id, paidSkill.id])).rejects.toThrow(/duplicate/)
  })

  it('rebases a mutation queued during a stale request without acknowledging or overwriting it', async () => {
    vi.stubGlobal('navigator', { onLine: true })
    const loaded = content()
    const initial = createInitialSave(loaded.umas.items, loaded.cards.items, loaded.manifest.version, localDay(), 1)
    const serverProfile = { ...initial.profile, featuredUmaId: 'u00' }
    vi.spyOn(saveApi, 'load').mockResolvedValue({
      entities: [
        { kind: 'profile', id: 'main', version: 3, data: toRecord(serverProfile), deleted: false, updatedAt: 2 },
        ...initial.umas.map((data) => ({ kind: 'umas' as const, id: data.templateId, version: 1, data: toRecord(data), deleted: false, updatedAt: 2 })),
        ...initial.cards.map((data) => ({ kind: 'cards' as const, id: data.templateId, version: 1, data: toRecord(data), deleted: false, updatedAt: 2 })),
        ...initial.umas.map((data) => ({ kind: 'badges' as const, id: `uma:${data.templateId}`, version: 1, data: toRecord(currentBadgeState(loaded, data)), deleted: false, updatedAt: 2 })),
        { kind: 'badges' as const, id: 'trainer', version: 1, data: toRecord(createTrainerBadgeState(1)), deleted: false, updatedAt: 2 },
      ],
      logs: [],
      serverTime: 2,
    })
    let respond!: (value: unknown) => void
    const sync = vi.spyOn(saveApi, 'sync').mockImplementation(() => new Promise((resolve) => { respond = resolve }))
    await runtime.start(loaded)
    await runtime.setFeaturedUma('u01')

    const flushing = runtime.flush()
    await vi.waitFor(() => expect(sync).toHaveBeenCalledTimes(1))
    await runtime.setFeaturedUma('u02')
    respond({
      applied: [],
      conflicts: [{ kind: 'profile', id: 'main', version: 4, data: toRecord(serverProfile), deleted: false, updatedAt: 3 }],
      appended: 0,
      serverTime: 3,
    })
    await flushing

    const local = await readLocalSnapshot()
    expect(local?.profile).toMatchObject({ version: 4, data: { featuredUmaId: 'u02' } })
    expect(await db.outbox.where('[kind+id]').equals(['profile', 'main']).count()).toBe(1)
    expect(useGame.getState().profile?.featuredUmaId).toBe('u02')
  })

  it('adopts a server conflict when no newer local mutation exists', async () => {
    vi.stubGlobal('navigator', { onLine: true })
    const loaded = content()
    const initial = createInitialSave(loaded.umas.items, loaded.cards.items, loaded.manifest.version, localDay(), 1)
    const serverProfile = { ...initial.profile, featuredUmaId: 'u00' }
    vi.spyOn(saveApi, 'load').mockResolvedValue({
      entities: [
        { kind: 'profile', id: 'main', version: 3, data: toRecord(serverProfile), deleted: false, updatedAt: 2 },
        ...initial.umas.map((data) => ({ kind: 'umas' as const, id: data.templateId, version: 1, data: toRecord(data), deleted: false, updatedAt: 2 })),
        ...initial.cards.map((data) => ({ kind: 'cards' as const, id: data.templateId, version: 1, data: toRecord(data), deleted: false, updatedAt: 2 })),
        ...initial.umas.map((data) => ({ kind: 'badges' as const, id: `uma:${data.templateId}`, version: 1, data: toRecord(currentBadgeState(loaded, data)), deleted: false, updatedAt: 2 })),
        { kind: 'badges' as const, id: 'trainer', version: 1, data: toRecord(createTrainerBadgeState(1)), deleted: false, updatedAt: 2 },
      ],
      logs: [],
      serverTime: 2,
    })
    vi.spyOn(saveApi, 'sync').mockResolvedValue({
      applied: [],
      conflicts: [{ kind: 'profile', id: 'main', version: 4, data: toRecord(serverProfile), deleted: false, updatedAt: 3 }],
      appended: 0,
      serverTime: 3,
    })
    await runtime.start(loaded)

    await expect(runtime.setFeaturedUma('not-owned')).rejects.toThrow(/must be owned/)
    await runtime.setFeaturedUma('u01')
    await runtime.flush()

    expect((await readLocalSnapshot())?.profile).toMatchObject({ version: 4, data: { featuredUmaId: 'u00' } })
    expect(await db.outbox.count()).toBe(0)
    expect(useGame.getState().profile?.featuredUmaId).toBe('u00')
  })
})
