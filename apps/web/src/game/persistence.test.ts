import 'fake-indexeddb/auto'
import { freezeAdvance, advanceOutfit, BANK_KEY, bankData } from '../../../api/src/save/inspiration-advance'
import type { EntityRecord as ApiEntityRecord } from '../../../api/src/save/save.types'

import { INSPIRATION_SLOTS, RPG_CLASS_WEAPONS, TRAINING_LEVEL_UP_TICKET_ID, activeScenario, cardNodeCap, constellationTemplate, createScenarioTraining, enrollRpgOutfit,
  inspirationGoldKey, legacyProduceNodeIds, rpgClassOptions, scenarioAt } from '@racer/domain'
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
  scenarioView,
  type ScenarioUnit,
  type SupportCardTemplate,
  type UmaTemplate,
  type PlayerProfile,
  type UmaSave,
} from '@racer/domain'
import Dexie from 'dexie'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/** A v5–v11 unit made from today's: the same, without the Extra stats grid (D235). */
/** A unit's one build as saves up to v14 held it (D252), without the Extra stats grid or Inspiration. */
const legacyRun = (unit: ScenarioUnit) => {
  const { extraStats: _grid, inspiration: _inspiration, preset: _preset, ...run } = scenarioView(unit, 'medium')
  return run
}
/** A save as v14 held it: no preset in use, one build per scenario (D252). */
const flatUma = ({ activePreset, ...head }: UmaSave) => ({ ...head, scenarios: head.scenarios.map((unit) => {
  const { preset: _preset, ...run } = scenarioView(unit, activePreset)
  return run
}) })
import { saveApi } from '../api/client'
import type { LoadedContent } from '../content/runtime'
import { db } from './db'
import { appendFlairEvents, bootstrapBadgeFacts, bootstrapUmaFlair, sparkRunsByTier } from './badges'
import { GameRuntime } from './runtime'
import { getFarmKitchenHost } from './farm/kitchen/host'
import { farmProtocolFixture } from '../../../../packages/domain/src/farm/kitchen/protocol-fixtures'
import { settleTrainingExpBank } from './training-bank'
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

/** A profile as schemas 1–10 stored it, before v11's Training EXP bank (D212). */
function legacyProfileBody(profile: PlayerProfile): Record<string, unknown> {
  const { trainingExpBank: _bank, ...body } = profile
  return body
}


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
    sparkRivals: null,
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

  it('upgrades a v24 database to global maximum stars without modifying any of the four presets', async () => {
    const loaded = content()
    const card = loaded.cards.items[0]!
    const current = withRun(createUmaSave(loaded.umas.items[0]!), { cardSetIds: [card.id] })
    // Use the current store definitions, but open at the version deployed before global stars.
    const old = new Dexie('uma-racer')
    old.version(24).stores(Object.fromEntries(db.tables.map((table) => [table.name,
      [table.schema.primKey.src, ...table.schema.indexes.map((index) => index.src)].join(', ')])))
    await old.open()
    const profile = { id: 'main', data: createPlayerProfile('global-proof', 1), version: 9 }
    const umaRow = { id: current.templateId, data: current, version: 7 }
    await old.table('profile').put(profile)
    await old.table('umas').put(umaRow)
    await old.table('cards').put({ id: card.id, data: { templateId: card.id,
      bonds: { '1': 1, '3': 2, '14': 1 }, maxCouponGranted: true }, version: 5 })
    await old.table('outbox').add({ kind: 'cards', id: card.id, op: 'upsert', queuedAt: 1 })
    const finished = { id: 'legacy-completed', targetKey: 'friendship-training:card:3', status: 'completed',
      seed: '123', snapshot: { retained: 'verbatim' }, journal: { retained: 'verbatim' }, reward: { starsAfter: 1 } }
    await old.table('minigameRuns').put(finished)
    old.close()
    await db.open()
    expect((await db.cards.get(card.id))).toEqual({ id: card.id, version: 5,
      data: { schemaVersion: 1, templateId: card.id, stars: 2, maxCouponGranted: true } })
    expect(await db.umas.get(current.templateId)).toEqual(umaRow)
    expect(await db.profile.get('main')).toEqual(profile)
    expect(await db.minigameRuns.get(finished.id)).toEqual(finished)
    expect(await db.outbox.where('[kind+id]').equals(['cards', card.id]).count()).toBe(1)
    expect(await db.outbox.count()).toBe(1)
    db.close(); await db.open()
    expect(await db.outbox.count()).toBe(1)
  })

  it('migrates cloud card rows on a new device and queues the raw legacy shape for upload', async () => {
    await db.open()
    await adoptServerSnapshot({ entities: [
      { kind: 'profile', id: 'main', version: 2, data: createPlayerProfile('cloud-global', 1), deleted: false, updatedAt: 1 },
      { kind: 'cards', id: 'cloud-card', version: 7, data: { templateId: 'cloud-card', bonds: { '1': 3, '4': 1 }, maxCouponGranted: true }, deleted: false, updatedAt: 1 },
    ], logs: [], serverTime: 5 })
    expect(await db.cards.get('cloud-card')).toEqual({ id: 'cloud-card', version: 7,
      data: { schemaVersion: 1, templateId: 'cloud-card', stars: 3, maxCouponGranted: true } })
    expect(await db.outbox.where('[kind+id]').equals(['cards', 'cloud-card']).count()).toBe(1)
    expect(await db.ledger.count()).toBe(0)
  })

  it('rebases global card conflicts by maximum and paid flag, never sum or rollback', async () => {
    await db.open()
    const local = { schemaVersion: 1 as const, templateId: 'merge-card', stars: 2, maxCouponGranted: true }
    await db.cards.put({ id: local.templateId, version: 1, data: local })
    await db.transaction('rw', [db.cards, db.outbox], () => putConflict({ kind: 'cards', id: local.templateId,
      data: { ...local, stars: 1, maxCouponGranted: false }, version: 3, updatedAt: 1, deleted: false }, false, 5))
    expect(await db.cards.get(local.templateId)).toEqual({ id: local.templateId, data: local, version: 3 })
    expect(await db.outbox.where('[kind+id]').equals(['cards', local.templateId]).count()).toBe(1)
    await db.transaction('rw', [db.cards, db.outbox], () => putConflict({ kind: 'cards', id: local.templateId,
      data: { ...local, stars: 3 }, version: 4, updatedAt: 1, deleted: false }, false, 6))
    expect((await db.cards.get(local.templateId))?.data).toEqual({ ...local, stars: 3 })
  })

  it('initializes profile, roster, ledger, and coalesced outbox atomically', async () => {
    const loaded = content()
    await db.open()
    expect(await isDatabaseSemanticallyEmpty()).toBe(true)
    await persistInitial(loaded, '2000-01-02', 10)

    const snapshot = await readLocalSnapshot()
    expect(snapshot?.profile.data).toMatchObject({ tickets: 15, cardCoupons: 3, featuredUmaId: 'u00' })
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

  it('counts an Uma\'s Spark Match runs per scenario from the ledger, and backfills her training badges (T056)', async () => {
    const loaded = content()
    await db.open()
    await persistInitial(loaded, '2000-01-02', 10)
    const run = (id: string) => ({ id, data: { resource: 'tickets' as const, delta: -1, reason: 'training' as const, localDay: '2000-01-02', createdAt: 11 }, createdAt: 11 })
    await db.ledger.bulkAdd([
      run('spark-match:u00:1:0'), run('spark-match:u00:1:1'), run('spark-match:u00:2:0'),
      run('spark-match:u001:1:0'), run('bond-recall:c1:1:0'),
    ])
    expect([...await sparkRunsByTier('u00')]).toEqual([[1, 2], [2, 1]])

    await bootstrapBadgeFacts(loaded, 20)
    const state = (await db.badges.get('uma:u00'))?.data
    if (state?.scope !== 'uma') throw new Error('Expected an Uma badge state')
    expect(state.facts.lifetimeTrainingTurns).toBe(3)
    expect(state.history.training).toBe('exact')
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
    expect(first?.data).toMatchObject({ scope: 'uma', umaId: 'u00', history: { training: 'exact', lineage: 'since-tracking' } })

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
    const unsupported = { ...createPlayerProfile('synthetic-v1', 1), schemaVersion: 17 }
    await db.table('profile').put({ id: 'main', data: unsupported, version: 7 })

    await expect(readLocalSnapshot()).rejects.toThrow(/App update required/)
    expect(await db.table('profile').get('main')).toMatchObject({ version: 7, data: { schemaVersion: 17 } })
  })

  it('loads class-era RPG rows (D282) and refuses only a newer RPG schema', async () => {
    const loaded = content()
    await db.open()
    await persistInitial(loaded, '2000-01-02', 10)
    const template = loaded.umas.items[0]!
    const classId = rpgClassOptions(template.aptitudes)[0]!
    const profile = enrollRpgOutfit({ outfit: template, contentVersion: loaded.manifest.version, classId, weapons: [...RPG_CLASS_WEAPONS[classId][0]!] })
    await db.rpgOutfits.put({ id: template.id, version: 3, data: { schemaVersion: 3, profile, projectionRevision: 1 } })
    await db.rpgPresets.put({ id: 'party-1', version: 2, data: { schemaVersion: 3, presetId: 'party-1', name: 'Mine', foregroundChapterId: 'ura-finale',
      slots: [{ outfitId: template.id, loadout: [], familiar: 'greatsword' }, null, null, null, null] } })
    const snapshot = await readLocalSnapshot()
    expect(snapshot?.rpgOutfits.map((row) => row.id)).toEqual([template.id])
    expect(snapshot?.rpgPresets).toHaveLength(1)
    await db.rpgOutfits.put({ id: template.id, version: 3, data: { schemaVersion: 4, profile, projectionRevision: 1 } as never })
    await expect(readLocalSnapshot()).rejects.toThrow(/App update required for RPG schema 4/)
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
    expect(migrated?.profile).toMatchObject({ version: 6, data: { schemaVersion: 15, tickets: 45, cardCoupons: 7, starterSeedContentVersion: null } })
    expect(migrated?.umas[0]?.data).toMatchObject({ schemaVersion: 15, unlockedTier: 1, goalPlanVersion: 0, racePreferences: null })
    expect(await db.outbox.where('kind').equals('profile').count()).toBe(1)
    expect(await db.outbox.where('[kind+id]').equals(['umas', existing.templateId]).count()).toBe(1)
    await completeStarterSeed(loaded, 30)

    const completed = await readLocalSnapshot()
    expect(completed?.profile.data.starterSeedContentVersion).toBe(loaded.manifest.version)
    expect(completed?.umas).toHaveLength(25)
    // The v5 migration discards stored stats rather than inventing a configuration that reproduces them.
    expect(completed?.umas.find((row) => row.id === existing.templateId)).toMatchObject({ version: 3, data: { schemaVersion: 15 } })
    expect(await db.badges.count()).toBe(1)
  })

  it('upgrades Dexie v22/save v13 Inspiration once without EXP, assignment, inventory or version changes', async () => {
    const current = flatUma(createUmaSave(uma('synthetic-inspiration')))
    const { inspiration: _i, ...run } = current.scenarios[0]!
    const legacyUma = { ...current, schemaVersion: 13, exp: 25, scenarios: [{ ...run, trainingLevel: 9, trainingExp: 333,
      assignments: { parent0: { kind: 'lineage', templateId: 'invented-parent' } } }] }
    const legacy = new Dexie('uma-racer')
    // v23 keeps the v22 table/index contract unchanged; only the row migration changes.
    legacy.version(22).stores(Object.fromEntries(db.tables.map(table => [table.name,
      [table.schema.primKey.src, ...table.schema.indexes.map(index => index.src)].join(', ')])))
    await legacy.open()
    await legacy.table('profile').put({ id: 'main', version: 4, data: { ...createPlayerProfile('synthetic', 1), schemaVersion: 13 } })
    await legacy.table('umas').put({ id: current.templateId, version: 7, data: legacyUma })
    legacy.close()
    await db.open()
    const migrated = (await db.umas.get(current.templateId))!
    expect(migrated.version).toBe(7)
    expect(migrated.data.schemaVersion).toBe(15)
    const { inspiration, preset: _preset, ...after } = scenarioView(migrated.data.scenarios[0]!, migrated.data.activePreset)
    expect(inspiration).toEqual({ slots: ['parent0', 'parent0-gp0', 'parent0-gp1'],
      golds: ['parent0:gold0', 'parent0:gold1', 'parent0-gp0:gold0', 'parent0-gp0:gold1', 'parent0-gp1:gold0', 'parent0-gp1:gold1'] })
    expect(after).toEqual(legacyUma.scenarios[0]); expect(migrated.data.exp).toBe(25)
    expect(await db.items.count()).toBe(0); expect(await db.itemLedger.count()).toBe(0)
    const markers = await db.outbox.toArray()
    expect(markers.map(r => `${r.kind}/${r.id}`).sort()).toEqual(['profile/main', `umas/${current.templateId}`])
    db.close(); await db.open()
    expect(await db.umas.get(current.templateId)).toEqual(migrated)
    expect(await db.outbox.toArray()).toEqual(markers)
  })

  it('adopts v13 cloud lineage access without inventing token grants or changing entity versions', async () => {
    await db.open()
    const current = flatUma(createUmaSave(uma('synthetic-cloud-inspiration')))
    const legacy = { ...current, schemaVersion: 13, scenarios: current.scenarios.map(({ inspiration: _i, ...run }) => ({ ...run, trainingLevel: 10 })) }
    await adoptServerSnapshot({ entities: [
      { kind: 'profile', id: 'main', version: 3, data: toRecord({ ...createPlayerProfile('synthetic', 1), schemaVersion: 13 }), deleted: false, updatedAt: 1 },
      { kind: 'umas', id: current.templateId, version: 6, data: toRecord(legacy), deleted: false, updatedAt: 1 },
    ], logs: [], serverTime: 2 })
    expect((await db.umas.get(current.templateId))?.version).toBe(6)
    expect((await db.umas.get(current.templateId))?.data.scenarios[0]!.inspiration.slots).toHaveLength(6)
    expect((await db.umas.get(current.templateId))?.data.scenarios[0]!.inspiration.golds).toHaveLength(12)
    expect(await db.items.count()).toBe(0); expect(await db.itemLedger.count()).toBe(0)
  })

  it('moves a v7 save to three stars on open, once, and queues the moved rows (D200)', async () => {
    const legacy = new Dexie('uma-racer')
    legacy.version(12).stores({
      profile: 'id', umas: 'id', cards: 'id', badges: 'id', raceResults: 'id, createdAt', ledger: 'id, createdAt',
      flairEvents: 'id, createdAt', outbox: '++seq, [kind+id]', albumPrefs: 'id',
      minigameRuns: 'id, targetKey, [targetKey+status], [targetKey+attemptIndex]',
    })
    await legacy.open()
    await legacy.table('profile').put({ id: 'main', data: { ...legacyProfileBody(createPlayerProfile('v7', 1)), schemaVersion: 7, tickets: 12 }, version: 9 })
    await legacy.table('cards').put({ id: 'c1', data: { templateId: 'c1', stars: { '1': 4, '2': 2, '3': 5 }, maxCouponGranted: true }, version: 4 })
    legacy.close()

    await db.open()
    const migrated = await readLocalSnapshot()
    expect(migrated?.profile).toMatchObject({ version: 9, data: { schemaVersion: 15, tickets: 12 } })
    expect(migrated?.cards[0]).toMatchObject({ version: 4, data: { schemaVersion: 1, templateId: 'c1', stars: 3, maxCouponGranted: true } })
    expect(await db.outbox.where('[kind+id]').equals(['cards', 'c1']).count()).toBe(1)
    expect(await db.outbox.where('[kind+id]').equals(['profile', 'main']).count()).toBe(1)
  })

  it('moves v8 Stat assignments into the Extra stats grid without touching item rows or fabricating evidence', async () => {
    const loaded = content()
    const current = flatUma(createUmaSave(loaded.umas.items[0]!))
    const nodeId = legacyProduceNodeIds(1)[0]!
    const { extraStats: _grid, inspiration: _inspiration, ...run } = current.scenarios[0]!
    const legacyUma = {
      ...current,
      schemaVersion: 8,
      scenarios: [{ ...run, assignments: { [nodeId]: { kind: 'stat', stat: 'power' } } }],
    }
    const legacy = new Dexie('uma-racer')
    legacy.version(14).stores({
      profile: 'id', umas: 'id', cards: 'id', badges: 'id', raceResults: 'id, createdAt', ledger: 'id, createdAt',
      flairEvents: 'id, createdAt', outbox: '++seq, [kind+id]', albumPrefs: 'id',
      minigameRuns: 'id, targetKey, [targetKey+status], [targetKey+attemptIndex]',
      farm: 'id', items: 'id', itemLedger: 'id, createdAt',
    })
    await legacy.open()
    await legacy.table('umas').put({ id: current.templateId, data: legacyUma, version: 5 })
    const stack = { itemId: 'produce:t1:power', quantity: 7, updatedAt: 10 }
    await legacy.table('items').put({ id: stack.itemId, data: stack, version: 3 })
    legacy.close()

    await db.open()
    const upgraded = (await db.umas.get(current.templateId))!.data
    expect(upgraded.schemaVersion).toBe(15)
    expect(scenarioView(upgraded.scenarios[0]!, upgraded.activePreset))
      .toMatchObject({ assignments: {}, extraStats: { unlocked: { power: 1 }, active: ['power-1'] } })
    expect(await db.items.get(stack.itemId)).toEqual({ id: stack.itemId, data: stack, version: 3 })
    expect(await db.itemLedger.count()).toBe(0)
    expect(await db.outbox.where('[kind+id]').equals(['umas', current.templateId]).count()).toBe(1)
    expect(await db.outbox.where('kind').equals('items').count()).toBe(0)
  })

  it('upgrades v9 outfit rows in Dexie v16 without touching a frozen journey or rewards', async () => {
    const current = createUmaSave(uma('synthetic-worker'))
    const journey = { tier: 1, tracking: 'legacy-untracked', state: 'completed', completedAt: 7, goals: [] }
    const { racePreferences: _unused, ...oldShape } = flatUma(current)
    const legacy = new Dexie('uma-racer')
    legacy.version(15).stores({
      profile: 'id', umas: 'id', cards: 'id', badges: 'id', raceResults: 'id, createdAt', ledger: 'id, createdAt',
      flairEvents: 'id, createdAt', outbox: '++seq, [kind+id]', albumPrefs: 'id',
      minigameRuns: 'id, targetKey, [targetKey+status], [targetKey+attemptIndex]',
      farm: 'id', items: 'id', itemLedger: 'id, createdAt',
    })
    await legacy.open()
    await legacy.table('profile').put({ id: 'main', data: { ...legacyProfileBody(createPlayerProfile('v9', 1)), schemaVersion: 9 }, version: 3 })
    await legacy.table('umas').put({ id: current.templateId, data: {
      ...oldShape, schemaVersion: 9, scenarios: [{ ...legacyRun(current.scenarios[0]!), started: true, journey }],
    }, version: 8 })
    legacy.close()

    await db.open()
    expect((await db.umas.get(current.templateId))?.data).toMatchObject({
      schemaVersion: 15, racePreferences: null, scenarios: [{ journey }],
    })
    expect((await db.profile.get('main'))?.data).toMatchObject({ schemaVersion: 15 })
    expect(await db.outbox.where('[kind+id]').equals(['umas', current.templateId]).count()).toBe(1)
    expect(await db.ledger.count()).toBe(0)
    expect(await db.raceResults.count()).toBe(0)
  })

  it('migrates a v1 cloud snapshot, mixed or not, and queues preserved-version replacements (D156)', async () => {
    const loaded = content()
    await db.open()
    const profile = { ...legacyProfileBody(createPlayerProfile(loaded.manifest.version, 1)), schemaVersion: 1 as const, tickets: 88 }
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
    expect(snapshot?.profile).toMatchObject({ version: 7, data: { schemaVersion: 15, tickets: 18 } })
    expect(snapshot?.umas[0]).toMatchObject({ version: 5, data: { schemaVersion: 15, unlockedTier: 1 } })
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
    expect(mixed?.profile.data).toMatchObject({ schemaVersion: 15, tickets: 18 })
    expect(mixed?.umas[0]?.data).toEqual(current)
    expect((await db.outbox.toArray()).map((row) => `${row.kind}/${row.id}`)).toEqual(['profile/main'])
  })

  it('re-levels v10 units in Dexie v17, banks what passed TL10 once, and settles it into Level-Up Tickets (D211, D212)', async () => {
    const current = createUmaSave(uma('synthetic-trainee'))
    const second = createUmaSave(uma('synthetic-second'))
    const run = current.scenarios[0]!
    const legacy = new Dexie('uma-racer')
    legacy.version(16).stores({
      profile: 'id', umas: 'id', cards: 'id', badges: 'id', raceResults: 'id, createdAt', ledger: 'id, createdAt',
      flairEvents: 'id, createdAt', outbox: '++seq, [kind+id]', albumPrefs: 'id',
      minigameRuns: 'id, targetKey, [targetKey+status], [targetKey+attemptIndex]',
      farm: 'id', items: 'id', itemLedger: 'id, createdAt',
    })
    await legacy.open()
    await legacy.table('profile').put({ id: 'main', data: { ...legacyProfileBody(createPlayerProfile('v10', 1)), schemaVersion: 10 }, version: 3 })
    await legacy.table('umas').put({ id: current.templateId, version: 8, data: {
      ...flatUma(current), schemaVersion: 10, scenarios: [{ ...legacyRun(run), trainingLevel: 10, trainingExp: 0 }],
    } })
    await legacy.table('umas').put({ id: second.templateId, version: 2, data: {
      ...flatUma(second), schemaVersion: 10, scenarios: [{ ...legacyRun(second.scenarios[0]!), trainingLevel: 6, trainingExp: 0 }],
    } })
    legacy.close()

    await db.open()
    expect(activeScenario((await db.umas.get(current.templateId))!.data)).toMatchObject({ trainingLevel: 10, trainingExp: 0 })
    expect(activeScenario((await db.umas.get(second.templateId))!.data)).toMatchObject({ trainingLevel: 7, trainingExp: 1000 })
    expect((await db.profile.get('main'))?.data).toMatchObject({ schemaVersion: 15, trainingExpBank: 10_350 })
    expect(await db.outbox.where('kind').equals('umas').count()).toBe(2)

    const settled = await settleTrainingExpBank(500)
    expect(settled?.tickets).toBe(8)
    expect((await db.profile.get('main'))?.data.trainingExpBank).toBe(350)
    expect((await db.items.get(TRAINING_LEVEL_UP_TICKET_ID))?.data).toEqual({ itemId: TRAINING_LEVEL_UP_TICKET_ID, quantity: 8, updatedAt: 500 })
    expect((await db.itemLedger.get('exp-bank:settle:500'))?.data).toMatchObject({ delta: 8, reason: 'exp-bank', source: { kind: 'bank-settle' } })
    expect(await db.outbox.where('kind').anyOf('items', 'itemLedger').count()).toBe(2)
    // Settling again, or reopening, pays nothing more.
    expect(await settleTrainingExpBank(600)).toBeNull()
    db.close()
    await db.open()
    expect((await db.profile.get('main'))?.data.trainingExpBank).toBe(350)
    expect(await db.itemLedger.count()).toBe(1)
  })

  it('re-levels a v12 Uma in Dexie v22 on the flat curve and pays each new level once, as a race does (D241)', async () => {
    const current = createUmaSave(uma('synthetic-climber'))
    const legacy = new Dexie('uma-racer')
    legacy.version(21).stores({
      profile: 'id', umas: 'id', cards: 'id', badges: 'id', raceResults: 'id, createdAt', ledger: 'id, createdAt',
      flairEvents: 'id, createdAt', outbox: '++seq, [kind+id]', albumPrefs: 'id',
      minigameRuns: 'id, targetKey, [targetKey+status], [targetKey+attemptIndex]',
      farm: 'id', items: 'id', itemLedger: 'id, createdAt',
      rpgOutfits: 'id', rpgPresets: 'id', rpgCheckpoints: 'id',
      rpgResults: 'id, createdAt', rpgPromotions: 'id, createdAt', rpgReceipts: 'id, createdAt',
      pendingRpgCommands: 'id, status, queuedAt',
      rpgBattleJournals: 'id, entryId, [entryId+retryOrdinal]', rpgBattleClaims: 'id', rpgBattleArchives: 'id',
    })
    await legacy.open()
    await legacy.table('profile').put({ id: 'main', data: { ...createPlayerProfile('v12', 1), schemaVersion: 12, tickets: 10 }, version: 3 })
    // Scenario 2 at Lv15 with 136 of 450: 1,686 EXP since Lv11, which is Lv19 with 186 of 300 on the flat curve.
    await legacy.table('umas').put({ id: current.templateId, version: 8, data: {
      ...flatUma(current), schemaVersion: 12, level: 15, exp: 136, unlockedTier: 2,
      scenarios: [flatUma(current).scenarios[0]!, { ...flatUma(current).scenarios[0]!, tier: 2 }].map(({ inspiration: _inspiration, ...run }) => run),
    } })
    // A level some device already paid is not paid again.
    const paid = { resource: 'tickets', delta: 1, reason: 'uma-level', localDay: '2026-10-01', createdAt: 1 }
    await legacy.table('ledger').put({ id: `uma-level-tickets:${current.templateId}:16`, data: paid, createdAt: 1 })
    legacy.close()

    await db.open()
    expect((await db.umas.get(current.templateId))?.data).toMatchObject({ schemaVersion: 15, level: 19, exp: 186 })
    expect((await db.profile.get('main'))?.data).toMatchObject({ schemaVersion: 15, tickets: 13 })
    expect((await db.ledger.toArray()).map((row) => row.id).sort()).toEqual([16, 17, 18, 19].map((level) => `uma-level-tickets:${current.templateId}:${level}`))
    expect((await db.ledger.get(`uma-level-tickets:${current.templateId}:16`))?.data).toEqual(paid)
    expect(await db.outbox.where('kind').equals('ledger').count()).toBe(3)
    expect(await db.outbox.where('[kind+id]').equals(['profile', 'main']).count()).toBe(1)
    // Reopening pays nothing more.
    db.close()
    await db.open()
    expect((await db.profile.get('main'))?.data.tickets).toBe(13)
    expect(await db.ledger.count()).toBe(4)
  })

  it('banks a v10 cloud save\'s surplus only when its profile is v10 too (D212)', async () => {
    const loaded = content()
    await db.open()
    const current = createUmaSave(loaded.umas.items[0]!)
    const v10Uma = { ...flatUma(current), schemaVersion: 10, scenarios: [{ ...legacyRun(current.scenarios[0]!), trainingLevel: 10, trainingExp: 0 }] }
    const v10Profile = { ...legacyProfileBody(createPlayerProfile(loaded.manifest.version, 1)), schemaVersion: 10 }
    const adopt = (profile: unknown) => adoptServerSnapshot({
      entities: [
        { kind: 'profile', id: 'main', version: 7, data: profile, deleted: false, updatedAt: 20 },
        { kind: 'umas', id: current.templateId, version: 5, data: v10Uma, deleted: false, updatedAt: 20 },
      ],
      logs: [],
      serverTime: 21,
    })
    await expect(adopt(v10Profile)).resolves.toBe('adopted')
    expect((await db.profile.get('main'))?.data.trainingExpBank).toBe(10_350)
    expect(activeScenario((await db.umas.get(current.templateId))!.data)).toMatchObject({ trainingLevel: 10, trainingExp: 0 })
    expect((await db.outbox.toArray()).map((row) => `${row.kind}/${row.id}`).sort()).toEqual(['profile/main', `umas/${current.templateId}`])
    // A current profile already banked it on the device that migrated first.
    await expect(adopt({ ...createPlayerProfile(loaded.manifest.version, 1), trainingExpBank: 40 })).resolves.toBe('adopted')
    expect((await db.profile.get('main'))?.data.trainingExpBank).toBe(40)
  })

})

describe('game bootstrap coordinator', () => {
  let runtime: GameRuntime

  beforeEach(async () => {
    await resetDatabase()
    clearGameState()
    runtime = new GameRuntime([])
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

  it('applies the one-time Inspiration advance after startup outbox sync and publishes acknowledged unlocks', async () => {
    const loaded = content(), server = new Map<string, ApiEntityRecord>()
    vi.spyOn(saveApi, 'load').mockResolvedValue({ entities: [], logs: [], serverTime: 1 })
    vi.spyOn(saveApi, 'sync').mockImplementation(async request => {
      const writes = request.upserts.map(r => ({ kind: r.kind, id: r.id, version: r.baseVersion + 1, data: r.data, deleted: false, updatedAt: 2 }))
      writes.forEach(r => server.set(`${r.kind}/${r.id}`, r))
      return { applied: writes.map(r => ({ kind: r.kind, id: r.id, version: r.version })), conflicts: [], appended: request.appends.length, serverTime: 2 }
    })
    const advance = vi.spyOn(saveApi, 'advanceInspiration').mockImplementation(async () => {
      const bank = freezeAdvance([...server.values()], 3)!
      server.set(BANK_KEY, bank)
      for (const id of Object.keys(bankData(bank).cohort)) for (const row of advanceOutfit(server.get(BANK_KEY)!, server.get(`umas/${id}`), id, 3)) server.set(`${row.kind}/${row.id}`, row)
      return { entities: [...server.values()].filter(r => r.kind === 'umas' || r.kind === 'inspirationBank'), logs: [], serverTime: 3 }
    })
    await runtime.start(loaded)
    expect(advance).not.toHaveBeenCalled()
    vi.stubGlobal('navigator', { onLine: true })
    await runtime.flush()
    expect(advance).toHaveBeenCalledTimes(1)
    expect((await db.inspirationBank.get('main'))!.data.balances).toEqual({ 'inspiration:t1:slot': -150, 'inspiration:t1:skill': -300 })
    expect(Object.values(useGame.getState().umas).every(u => u.scenarios[0]!.inspiration.slots.length === 6 && u.scenarios[0]!.inspiration.golds.length === 12)).toBe(true)
    await runtime.flush(); expect(advance).toHaveBeenCalledTimes(1)
  })

  it('seeds after an empty cloud response and after an unavailable cloud response', async () => {
    const loaded = content()
    const load = vi.spyOn(saveApi, 'load').mockResolvedValueOnce({ entities: [], logs: [], serverTime: 1 })
    await runtime.start(loaded)
    expect(useGame.getState()).toMatchObject({ status: 'ready', persistent: true, profile: { tickets: 15 } })
    expect(Object.keys(useGame.getState().umas)).toHaveLength(25)
    expect(load).toHaveBeenCalledTimes(1)
    expect(() => getFarmKitchenHost()).toThrow(/not ready/)
    expect(await db.farm.count()).toBe(0)
    expect(await db.farmPreferences.count()).toBe(0)
    await expect(runtime.farmKitchenHost()).rejects.toThrow(/not ready/)

    runtime.stop()
    await resetDatabase()
    load.mockRejectedValueOnce(new Error('synthetic offline'))
    await runtime.start(loaded)
    expect(useGame.getState().status).toBe('ready')
    expect(Object.keys(useGame.getState().umas)).toHaveLength(25)
  })

  it('keeps a rejected Farm recovery visible after ordinary acknowledgements and an empty flush', async () => {
    vi.spyOn(saveApi, 'load').mockResolvedValue({ entities: [], logs: [], serverTime: 1 })
    vi.spyOn(saveApi, 'sync').mockImplementation(async request => ({
      applied: request.upserts.map(r => ({ kind: r.kind, id: r.id, version: r.baseVersion + 1 })),
      conflicts: [], appended: request.appends.length, serverTime: 2,
    }))
    vi.spyOn(saveApi, 'advanceInspiration').mockRejectedValue(new Error('synthetic deferred advance'))
    await runtime.start(content())
    const fixture = farmProtocolFixture(), operation = fixture.operation({ kind: 'assign', stationId: 'garden-2', outfitId: 'invented-1' })
    const prediction = fixture.apply(operation).responses[0]!.receipt!
    await db.farmPending.put({ id: operation.operationId, operation, prediction, status: 'rejected', reason: 'Invented conflict', order: 1, queuedAt: 1 })
    vi.stubGlobal('navigator', { onLine: true })
    await runtime.flush()
    expect(useGame.getState().sync).toMatchObject({ status: 'error', pending: 0, error: expect.stringContaining('Farm') })
    await runtime.flush()
    expect(useGame.getState().sync).toMatchObject({ status: 'error', pending: 0, error: expect.stringContaining('Farm') })
    expect(await db.farmPending.count()).toBe(1)
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

  it('saves outfit race defaults locally, queues cloud sync, and restores them after a restart', async () => {
    const loaded = content()
    vi.spyOn(saveApi, 'load').mockResolvedValue({ entities: [], logs: [], serverTime: 1 })
    await runtime.start(loaded)
    const preferences = { strategy: 'front' as const, distance: 'sprint' as const, surface: 'dirt' as const }

    await runtime.setRacePreferences('u00', preferences)

    expect(useGame.getState().umas.u00?.racePreferences).toEqual(preferences)
    expect((await db.umas.get('u00'))?.data.racePreferences).toEqual(preferences)
    expect(await db.outbox.where('[kind+id]').equals(['umas', 'u00']).count()).toBe(1)
    expect(useGame.getState().umas.u01?.racePreferences).toBeNull()

    runtime.stop()
    await runtime.start(loaded)
    expect(useGame.getState().umas.u00?.racePreferences).toEqual(preferences)
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

  it('loads a fully unlocked page of a preset from the same preset one scenario earlier, in one queued write (D288)', async () => {
    const loaded = content(6)
    vi.spyOn(saveApi, 'load').mockResolvedValue({ entities: [], logs: [], serverTime: 1 })
    await runtime.start(loaded)
    const current = useGame.getState().umas.u00!
    const preset = current.activePreset
    const cardSetIds = loaded.cards.items.map((item) => item.id)
    const nodes = constellationTemplate(1).nodes.filter((node) => node.kind === 'card')
    const ura = createScenarioTraining(1)
    const build = { cardSetIds, activeExtraStats: [], loadoutSkillIds: [paidSkill.id], assignments: {
      ...Object.fromEntries(nodes.map((node, i) => [node.id, { kind: 'card' as const, cardId: cardSetIds[i % 6]! }])),
      parent0: { kind: 'lineage' as const, templateId: 'u01' } } }
    const inspiration = { slots: [...INSPIRATION_SLOTS], golds: INSPIRATION_SLOTS.flatMap((slot) => [0, 1].map((i) => inspirationGoldKey(slot, i))) }
    const unity = (trainingLevel: number) => ({ ...createScenarioTraining(2), trainingLevel, inspiration, started: true })
    const put = async (save: UmaSave) => { const row = await db.umas.get('u00'); await db.umas.put({ ...row!, data: save }); replaceUma(save) }
    const twoTiers = (trainingLevel: number): UmaSave => ({ ...current, level: 11, exp: 0, unlockedTier: 2, scenarios: [{ ...ura, presets: { ...ura.presets, [preset]: build } }, unity(trainingLevel)] })

    await put(twoTiers(7))
    await expect(runtime.loadPresetPage('u00', 'constellation')).rejects.toThrow(/Unlock everything/)
    await put(twoTiers(10))
    await db.outbox.clear()
    await runtime.loadPresetPage('u00', 'constellation')
    await runtime.loadPresetPage('u00', 'inspiration')
    expect(await runtime.loadPresetPage('u00', 'skills')).toEqual({ skipped: 0 })
    const run = scenarioAt((await db.umas.get('u00'))!.data, 2)!
    expect(run.loadoutSkillIds).toEqual([paidSkill.id])
    expect(run.cardSetIds).toEqual(cardSetIds)
    const held = Object.values(run.assignments).filter((a) => a.kind === 'card')
    expect(held).toHaveLength(constellationTemplate(2).cardNodes)
    expect(Math.max(...cardSetIds.map((id) => held.filter((a) => a.kind === 'card' && a.cardId === id).length))).toBeLessThanOrEqual(cardNodeCap(2))
    expect(run.assignments.parent0).toEqual({ kind: 'lineage', templateId: 'u01' })
    expect(scenarioAt(useGame.getState().umas.u00!, 2)!.assignments).toEqual(run.assignments)
    expect(await db.outbox.where('[kind+id]').equals(['umas', 'u00']).count()).toBe(1)
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
    const staleProfile = { ...legacyProfileBody(serverProfile), schemaVersion: 3, tickets: 300 }
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
    expect((await readLocalSnapshot())?.profile).toMatchObject({ version: 4, data: { featuredUmaId: 'u01', schemaVersion: 15 } })
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
    const legacy = { ...legacyProfileBody(createPlayerProfile('abc123def456', 1)), schemaVersion: 3, tickets: 300 }
    const record = { kind: 'profile' as const, id: 'main', version: 7, data: legacy, deleted: false, updatedAt: 3 }
    expect(isLegacyServerRecord(record)).toBe(true)
    await db.open()
    await db.transaction('rw', db.profile, db.umas, db.cards, db.badges, db.outbox, () => putConflict(record, true, 5))
    expect((await db.profile.get('main'))?.data).toMatchObject({ schemaVersion: 15, tickets: 60 })
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
