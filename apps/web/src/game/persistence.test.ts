import 'fake-indexeddb/auto'

import { activeScenario, constellationTemplate } from '@racer/domain'
import { badgeSubject } from './badges'
import { umaFixture, withRun } from './__fixtures__/save'
import {
  createPlayerProfile,
  createInitialSave,
  createUmaBadgeState,
  createTrainerBadgeState,
  createUmaSave,
  buildUmaFlairCatalog,
  evaluateUmaFlair,
  reconcileTrainerState,
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
import { appendFlairEvents, bootstrapBadgeFacts, bootstrapUmaFlair } from './badges'
import { GameRuntime } from './runtime'
import { clearGameState, localDay, replaceUma, useGame } from './store'
import {
  adoptServerSnapshot,
  applyOwedDailyGrant,
  bootstrapGoalPlans,
  completeStarterSeed,
  isDatabaseSemanticallyEmpty,
  isLegacyServerRecord,
  persistInitial,
  putConflict,
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

function card(index = 1): SupportCardTemplate {
  return {
    id: `card-${index}`,
    charaId: `card-chara-${index}`,
    charName: 'Synthetic Card Character',
    title: 'Synthetic Starter',
    type: 'speed',
    jpRelease: '2000-01-01',
    era: 1,
    obtain: 'free',
    starter: true,
    hintSkillIds: ['skill-paid-1'],
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
  venueKey: 'synthetic-venue', venueTags: [], series: [], seriesLegs: [],
  courseId: `goal-course-${index + 1}`, season: 1, fieldSize: 8,
}))

function content(cardCount = 1): LoadedContent {
  const umas = Array.from({ length: 25 }, (_, index) => uma(`u${String(index).padStart(2, '0')}`))
  const cards = Array.from({ length: cardCount }, (_, index) => card(index + 1))
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
    art: { has: () => false, load: async () => null },
  }
}

const toRecord = (value: object): Record<string, unknown> => value as unknown as Record<string, unknown>

function currentBadgeState(loaded: LoadedContent, uma: UmaSave) {
  const state = createUmaBadgeState(uma, badgeSubject(loaded, uma), 1)
  return evaluateUmaFlair(
    buildUmaFlairCatalog({ state, races: loaded.races.items }),
    state,
    { source: { kind: 'migration', id: null, tier: null }, earnedAt: 1, retroactive: true },
  ).state
}

function currentTrainerState(loaded: LoadedContent, initial: ReturnType<typeof createInitialSave>) {
  const contributors = initial.umas.map((uma) => currentBadgeState(loaded, uma))
  return reconcileTrainerState({
    state: createTrainerBadgeState(1),
    contentVersion: loaded.manifest.version,
    umas: loaded.umas.items,
    cards: loaded.cards.items,
    races: loaded.races.items,
    ownedUmas: initial.umas,
    ownedCards: initial.cards,
    contributors,
    ledger: [],
    raceResults: [],
    now: 1,
    retroactive: true,
  }).state
}

async function resetDatabase(): Promise<void> {
  db.close()
  await db.delete()
}

describe('save persistence', () => {
  beforeEach(resetDatabase)

  it('initializes profile, roster, ledger, and coalesced outbox atomically', async () => {
    const loaded = content()
    await db.open()
    expect(await isDatabaseSemanticallyEmpty()).toBe(true)
    await persistInitial(loaded, '2000-01-02', 10)

    const snapshot = await readLocalSnapshot()
    expect(snapshot?.profile.data).toMatchObject({ tickets: 10, cardCoupons: 3, featuredUmaId: 'u00' })
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
    expect(first?.data).toMatchObject({ scope: 'uma', umaId: 'u00', history: { training: 'untracked', lineage: 'since-tracking' } })

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

    if (!awarded || awarded.data.scope !== 'uma') throw new Error('Expected an awarded Uma badge state')
    await db.badges.put({
      ...awarded,
      data: {
        ...awarded.data,
        facts: {
          ...awarded.data.facts,
          familyWins: goalRaces.map((race) => ({ key: race.familyId, count: 1, grade: race.grade, series: ['triple-crown' as const] })),
        },
      },
    })
    const coveredRaces = goalRaces.map((race, index) => ({
      ...race,
      series: ['triple-crown' as const],
      seriesLegs: [`triple-crown:leg-${index + 1}`],
    }))
    const coveredContent: LoadedContent = {
      ...loaded,
      manifest: { ...loaded.manifest, version: 'expanded-content-v2' },
      races: { items: coveredRaces, byId: new Map(coveredRaces.map((race) => [race.id, race])) },
    }
    await expect(bootstrapUmaFlair(coveredContent, 27)).resolves.toBe(1)
    const retroAwarded = await db.badges.get('uma:u00')
    expect(retroAwarded?.data).toMatchObject({
      awards: { titles: [expect.objectContaining({ awardKey: 'title:triple-crown' })] },
    })
    expect((await db.flairEvents.toArray()).filter((row) => row.data.awardKey === 'title:triple-crown')).toEqual([
      expect.objectContaining({ data: expect.objectContaining({ retroactive: true, source: { kind: 'migration', id: null, tier: null } }) }),
    ])
    await expect(bootstrapUmaFlair(coveredContent, 28)).resolves.toBe(0)

    await expect(bootstrapBadgeFacts(loaded, 30)).resolves.toBe(0)
    expect(await db.badges.get('uma:u00')).toEqual(retroAwarded)
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
    const unsupported = { ...createPlayerProfile('synthetic-v1', 1), schemaVersion: 8 }
    await db.table('profile').put({ id: 'main', data: unsupported, version: 7 })

    await expect(readLocalSnapshot()).rejects.toThrow(/App update required/)
    expect(await db.table('profile').get('main')).toMatchObject({ version: 7, data: { schemaVersion: 8 } })
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
    const template = loaded.umas.items[0]!
    const existing = {
      templateId: current.templateId,
      level: 1,
      exp: 0,
      trainingLevel: 1,
      trainingExp: 0,
      stats: { ...template.baseStats, speed: 777 },
      skillPoints: 0,
      aptitudes: template.aptitudes,
      deckCardIds: [],
      skillLibrary: [],
      loadoutSkillIds: [],
      trainingsThisScenario: 0,
    }
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
    await legacy.table('badges').put({ id: `uma:${current.templateId}`, data: createUmaBadgeState(current, badgeSubject(loaded, current), 1), version: 1 })
    await legacy.table('outbox').add({ kind: 'umas', id: existing.templateId, op: 'upsert', queuedAt: 1 })
    legacy.close()

    await db.open()
    const migrated = await readLocalSnapshot()
    // 225 old tickets are 45 now (D148); the chain re-denominates exactly once.
    expect(migrated?.profile).toMatchObject({ version: 6, data: { schemaVersion: 7, tickets: 45, cardCoupons: 7, starterSeedContentVersion: null } })
    expect(migrated?.umas[0]?.data).toMatchObject({ schemaVersion: 7, unlockedTier: 1, goalPlanVersion: 0 })
    expect(await db.outbox.where('kind').equals('profile').count()).toBe(1)
    expect(await db.outbox.where('[kind+id]').equals(['umas', existing.templateId]).count()).toBe(1)
    await completeStarterSeed(loaded, 30)

    const completed = await readLocalSnapshot()
    expect(completed?.profile.data.starterSeedContentVersion).toBe(loaded.manifest.version)
    expect(completed?.umas).toHaveLength(25)
    // The v5 migration discards stored stats rather than inventing a configuration that reproduces them.
    expect(completed?.umas.find((row) => row.id === existing.templateId)).toMatchObject({ version: 3, data: { schemaVersion: 7 } })
    expect(await db.badges.count()).toBe(1)
  })

  it('migrates a v1 cloud snapshot, mixed or not, and queues preserved-version replacements (D156)', async () => {
    const loaded = content()
    await db.open()
    const profile = { ...createPlayerProfile(loaded.manifest.version, 1), schemaVersion: 1 as const, tickets: 88 }
    const current = createUmaSave(loaded.umas.items[0]!)
    const template = loaded.umas.items[0]!
    const legacyUma = {
      templateId: current.templateId,
      level: 1,
      exp: 0,
      trainingLevel: 1,
      trainingExp: 0,
      stats: { ...template.baseStats },
      skillPoints: 0,
      aptitudes: template.aptitudes,
      deckCardIds: [],
      skillLibrary: [],
      loadoutSkillIds: [],
      trainingsThisScenario: 0,
    }
    await expect(adoptServerSnapshot({
      entities: [
        { kind: 'profile', id: 'main', version: 7, data: profile, deleted: false, updatedAt: 20 },
        { kind: 'umas', id: legacyUma.templateId, version: 5, data: legacyUma, deleted: false, updatedAt: 20 },
      ],
      logs: [],
      serverTime: 21,
    })).resolves.toBe('adopted')
    const snapshot = await readLocalSnapshot()
    expect(snapshot?.profile).toMatchObject({ version: 7, data: { schemaVersion: 7, tickets: 18 } })
    expect(snapshot?.umas[0]).toMatchObject({ version: 5, data: { schemaVersion: 7, unlockedTier: 1 } })
    expect((await db.outbox.toArray()).map((row) => `${row.kind}/${row.id}`).sort()).toEqual(['profile/main', `umas/${legacyUma.templateId}`])
    // An old profile beside a current Uma, as a failed profile upload leaves the cloud: each migrates on its own.
    await expect(adoptServerSnapshot({
      entities: [
        { kind: 'profile', id: 'main', version: 7, data: profile, deleted: false, updatedAt: 20 },
        { kind: 'umas', id: current.templateId, version: 5, data: current, deleted: false, updatedAt: 20 },
      ],
      logs: [],
      serverTime: 21,
    })).resolves.toBe('adopted')
    const mixed = await readLocalSnapshot()
    expect(mixed?.profile.data).toMatchObject({ schemaVersion: 7, tickets: 18 })
    expect(mixed?.umas[0]?.data).toEqual(current)
    expect((await db.outbox.toArray()).map((row) => `${row.kind}/${row.id}`)).toEqual(['profile/main'])
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
    expect(useGame.getState()).toMatchObject({ status: 'ready', persistent: true, profile: { tickets: 10 } })
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
      { kind: 'badges' as const, id: 'trainer', data: toRecord(currentTrainerState(loaded, initial)), version: 1, deleted: false, updatedAt: 2 },
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
    const base = content(6)
    // A Friend card pays the skill points this loadout needs (D132); the others are stat cards.
    const friend: SupportCardTemplate = { ...base.cards.items[5]!, type: 'friend' }
    const items = [...base.cards.items.slice(0, 5), friend]
    const loaded: LoadedContent = { ...base, cards: { items, byId: new Map(items.map((item) => [item.id, item])) } }
    vi.spyOn(saveApi, 'load').mockResolvedValue({ entities: [], logs: [], serverTime: 1 })
    await runtime.start(loaded)
    const current = useGame.getState().umas.u00!
    const cardSetIds = loaded.cards.items.map((item) => item.id)
    const cardNodes = constellationTemplate(1).nodes.filter((node) => node.kind === 'card')
    const next = withRun(current, {
      cardSetIds,
      assignments: Object.fromEntries(cardNodes.slice(0, 4).map((node) => [
        node.id,
        { kind: 'card', cardId: cardSetIds[5]! },
      ])),
    })
    const row = await db.umas.get('u00')
    await db.umas.put({ ...row!, data: next })
    replaceUma(next)

    await runtime.setUmaLoadout('u00', [paidSkill.id])

    expect(activeScenario(useGame.getState().umas.u00!).loadoutSkillIds).toEqual([paidSkill.id])
    expect(activeScenario((await db.umas.get('u00'))!.data).loadoutSkillIds).toEqual([paidSkill.id])
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
        { kind: 'badges' as const, id: 'trainer', version: 1, data: toRecord(currentTrainerState(loaded, initial)), deleted: false, updatedAt: 2 },
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

  it('keeps the local copy when the server conflict predates the save schema, and sends it again (D156)', async () => {
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
        { kind: 'badges' as const, id: 'trainer', version: 1, data: toRecord(currentTrainerState(loaded, initial)), deleted: false, updatedAt: 2 },
      ],
      logs: [],
      serverTime: 2,
    })
    // The server still holds a schema-3 profile from before the save migrations, as production did after failed syncs.
    const staleProfile = { ...toRecord(serverProfile), schemaVersion: 3, tickets: 300 }
    const sync = vi.spyOn(saveApi, 'sync').mockResolvedValueOnce({
      applied: [],
      conflicts: [{ kind: 'profile', id: 'main', version: 4, data: staleProfile, deleted: false, updatedAt: 3 }],
      appended: 0,
      serverTime: 3,
    })
    await runtime.start(loaded)
    await runtime.setFeaturedUma('u01')
    await runtime.flush()

    // Our copy stands on the server's version, queued to go again; nothing threw and nothing rolled back.
    expect((await readLocalSnapshot())?.profile).toMatchObject({ version: 4, data: { featuredUmaId: 'u01', schemaVersion: 7 } })
    expect(await db.outbox.where('[kind+id]').equals(['profile', 'main']).count()).toBe(1)
    expect(useGame.getState().profile?.featuredUmaId).toBe('u01')

    sync.mockResolvedValueOnce({ applied: [{ kind: 'profile', id: 'main', version: 5 }], conflicts: [], appended: 0, serverTime: 4 })
    await runtime.flush()
    const resent = sync.mock.calls.at(-1)![0]
    expect(resent.upserts).toEqual([expect.objectContaining({ kind: 'profile', id: 'main', baseVersion: 4, data: expect.objectContaining({ featuredUmaId: 'u01' }) })])
    expect((await readLocalSnapshot())?.profile.version).toBe(5)
    expect(await db.outbox.count()).toBe(0)
  })

  it('keeps the first copy of an award earned again from a restored badge state (D156)', async () => {
    await db.open()
    const first = {
      id: 'flair:trainer:stable:trainer:badge-hoarder:bronze',
      data: {
        version: 1, scope: 'trainer', umaId: null, kind: 'trainer-achievement', awardKey: 'trainer:badge-hoarder', stage: 'bronze',
        earnedAt: 10, source: { kind: 'migration', id: null, tier: null }, retroactive: true,
      },
    }
    const again = { ...first, data: { ...first.data, earnedAt: 99 } }
    await db.transaction('rw', db.flairEvents, db.outbox, () => appendFlairEvents([first as never], 10))
    await db.transaction('rw', db.flairEvents, db.outbox, () => appendFlairEvents([again as never], 99))
    expect((await db.flairEvents.get(first.id))?.createdAt).toBe(10)
    expect(await db.flairEvents.count()).toBe(1)
  })

  it('migrates a legacy server conflict it adopts, instead of failing on it', async () => {
    const legacy = { ...toRecord(createPlayerProfile('abc123def456', 1)), schemaVersion: 3, tickets: 300 }
    const record = { kind: 'profile' as const, id: 'main', version: 7, data: legacy, deleted: false, updatedAt: 3 }
    expect(isLegacyServerRecord(record)).toBe(true)
    await db.open()
    await db.transaction('rw', db.profile, db.umas, db.cards, db.badges, db.outbox, () => putConflict(record, true, 5))
    expect((await db.profile.get('main'))?.data).toMatchObject({ schemaVersion: 7, tickets: 60 })
    expect(await db.outbox.where('[kind+id]').equals(['profile', 'main']).count()).toBe(1)
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
        { kind: 'badges' as const, id: 'trainer', version: 1, data: toRecord(currentTrainerState(loaded, initial)), deleted: false, updatedAt: 2 },
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
