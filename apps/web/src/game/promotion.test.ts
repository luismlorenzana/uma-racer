import 'fake-indexeddb/auto'

import {
  applyScenarioCompletionFact,
  badgeStateId,
  buildUmaFlairCatalog,
  createCardSave,
  createPlayerProfile,
  createUmaBadgeState,
  createUmaSave,
  evaluateUmaFlair,
  flairSourceId,
  parentFingerprint,
  type ContentAtlas,
  type RaceTemplate,
  type SkillTemplate,
  type SupportCardTemplate,
  type UmaTemplate,
} from '@racer/domain'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { LoadedContent } from '../content/runtime'
import { db } from './db'
import { promoteMemoryUma, promotePersistentUma, startPersistentScenario } from './promotion'

const aptitudes = {
  surface: { turf: 'A', dirt: 'G' },
  distance: { sprint: 'B', mile: 'A', medium: 'A', long: 'C' },
  strategy: { front: 'D', pace: 'A', late: 'B', end: 'C' },
} as const

const umaTemplate: UmaTemplate = {
  id: 'uma-promo', charaId: 'chara-promo', name: 'Synthetic Graduate', outfit: null,
  jpRelease: '2000-01-01', globalRelease: null, starter: true,
  baseStats: { speed: 100, stamina: 100, power: 100, guts: 100, wit: 100 },
  growthRates: { speed: 0, stamina: 0, power: 0, guts: 0, wit: 0 }, aptitudes,
  uniqueSkillId: 'unique-promo', awakeningSkillIds: ['awake-promo'], realHorseSex: null,
  signatureRaceFamilyIds: [], imageSource: 'https://invalid.test/synthetic.png',
}

const parentTemplate: UmaTemplate = {
  ...umaTemplate,
  id: 'uma-parent', charaId: 'chara-parent', name: 'Synthetic Parent', uniqueSkillId: 'unique-parent', awakeningSkillIds: [],
}

const cardTemplate: SupportCardTemplate = {
  id: 'card-promo', charaId: 'support-promo', charName: 'Synthetic Support', title: 'Starting Line',
  type: 'speed', jpRelease: '2000-01-01', era: 1, obtain: 'free', starter: true,
  hintSkillIds: [], eventSkillIds: [], effectProfile: {
    trainingBonus: 1, friendshipBonus: 1, statBonus: 1, skillPointBonus: 1,
    specialtyPriority: 1, hintFrequency: 1, raceBonus: 1, initialStats: 1,
  }, uniqueEffect: null, imageSource: 'https://invalid.test/synthetic.png',
}

const skills: SkillTemplate[] = [
  { id: 'unique-promo', kind: 'unique', name: 'Synthetic Unique', description: '', costSp: null, iconId: null, conditions: [], inheritedSkillId: 'gene-promo', normalSkillId: null },
  { id: 'gene-promo', kind: 'inherited-unique', name: 'Synthetic Gene', description: '', costSp: 100, iconId: null, conditions: [], inheritedSkillId: null, normalSkillId: null },
  { id: 'awake-promo', kind: 'white', name: 'Synthetic Awakening', description: '', costSp: 100, iconId: null, conditions: [], inheritedSkillId: null, normalSkillId: null },
  { id: 'unique-parent', kind: 'unique', name: 'Synthetic Parent Unique', description: '', costSp: null, iconId: null, conditions: [], inheritedSkillId: 'gene-parent', normalSkillId: null },
  { id: 'gene-parent', kind: 'inherited-unique', name: 'Synthetic Parent Gene', description: '', costSp: 100, iconId: null, conditions: [], inheritedSkillId: null, normalSkillId: null },
  { id: 'white-parent', kind: 'white', name: 'Synthetic Parent White', description: '', costSp: 100, iconId: null, conditions: [], inheritedSkillId: null, normalSkillId: null },
]

const races: RaceTemplate[] = [
  ['race-a', 'pre-op', '101'], ['race-b', 'op', '102'], ['race-c', 'g1', '103'],
].map(([id, grade, familyId], index) => ({
  id: id!, familyId: familyId!, name: `Synthetic Race ${index + 1}`, grade: grade as RaceTemplate['grade'],
  surface: 'turf', distance: 1600 + index * 200, distanceCategory: index < 2 ? 'mile' : 'medium',
  direction: 'left', venue: 'Synthetic', venueKey: 'synthetic-venue', venueTags: [], series: [], seriesLegs: [], courseId: 'course-goals', season: 1, fieldSize: 8,
}))

function content(): LoadedContent {
  const atlas = (kind: ContentAtlas['kind']): ContentAtlas => ({
    schemaVersion: 1, kind, frameWidth: 128, frameHeight: 128,
    pages: [{ path: 'synthetic.webp', width: 128, height: 128 }],
    frames: { synthetic: { page: 0, x: 0, y: 0, width: 128, height: 128 } },
  })
  return {
    manifest: { version: 'synthetic-v2', generatedAt: '2000-01-01T00:00:00Z', source: {}, files: [] }, origin: 'network',
    umas: { items: [umaTemplate, parentTemplate], byId: new Map([[umaTemplate.id, umaTemplate], [parentTemplate.id, parentTemplate]]) },
    cards: { items: [cardTemplate], byId: new Map([[cardTemplate.id, cardTemplate]]) },
    skills: { items: skills, byId: new Map(skills.map((skill) => [skill.id, skill])) },
    races: { items: races, byId: new Map(races.map((race) => [race.id, race])) }, courses: { items: [], byId: new Map() },
    atlases: {
      'uma-icons': { descriptor: atlas('uma-icons'), pageUrls: ['blob:synthetic'] },
      'card-icons': { descriptor: atlas('card-icons'), pageUrls: ['blob:synthetic'] },
    },
    art: { has: () => false, load: async () => null },
  }
}

function readyUma() {
  const uma = createUmaSave(umaTemplate)
  return { ...uma, goalPlanVersion: 0, scenarioStarted: true, level: 10, deckCardIds: [cardTemplate.id], trainingsThisScenario: 20 }
}

async function resetDatabase() {
  db.close()
  await db.delete()
}

describe('scenario promotion persistence', () => {
  beforeEach(resetDatabase)
  afterEach(resetDatabase)

  it('commits profile, Uma, ledgers, and outbox atomically and retries idempotently', async () => {
    const loaded = content()
    const profile = { ...createPlayerProfile(loaded.manifest.version, 1), tickets: 100 }
    const uma = readyUma()
    const card = createCardSave(cardTemplate)
    await db.open()
    await db.profile.put({ id: 'main', data: profile, version: 7 })
    await db.umas.put({ id: uma.templateId, data: uma, version: 5 })
    await db.cards.put({ id: card.templateId, data: card, version: 3 })

    const first = await promotePersistentUma(loaded, uma.templateId, 50)
    expect(first).toMatchObject({ alreadyPromoted: false, profile: { tickets: 75 }, uma: { level: 11, trainingLevel: 1 } })
    expect(await db.ledger.get('uma-promotion:uma-promo:1')).toMatchObject({ data: { delta: -25, reason: 'uma-promotion' } })
    const firstOutbox = (await db.outbox.toArray()).map((row) => `${row.kind}/${row.id}`)
    expect(firstOutbox).toEqual(expect.arrayContaining([
      'badges/uma:uma-promo', 'ledger/uma-promotion:uma-promo:1', 'profile/main', 'umas/uma-promo',
    ]))
    expect(first.earnedFlairEventIds.filter((id) => id.startsWith('flair:uma:'))).toHaveLength(4)
    expect(first.earnedFlairEventIds.filter((id) => id.startsWith('flair:trainer:'))).toHaveLength(3)
    expect(firstOutbox.filter((id) => id.startsWith('flairEvents/'))).toHaveLength(7)
    expect(firstOutbox).toContain('badges/trainer')
    expect((await db.profile.get('main'))?.version).toBe(7)
    expect((await db.umas.get(uma.templateId))?.version).toBe(5)

    const retry = await promotePersistentUma(loaded, uma.templateId, 99)
    expect(retry).toMatchObject({ alreadyPromoted: true, profile: { tickets: 75 }, uma: { level: 11 } })
    expect(await db.ledger.count()).toBe(1)
  })

  it('uses the same rules in memory mode and writes nothing after a rejected transaction', async () => {
    const loaded = content()
    const profile = { ...createPlayerProfile(loaded.manifest.version, 1), tickets: 100 }
    const uma = readyUma()
    const card = createCardSave(cardTemplate)
    expect(promoteMemoryUma(loaded, profile, uma, { [card.templateId]: card }, 5)).toMatchObject({
      profile: { tickets: 75 }, uma: { level: 11 }, alreadyPromoted: false,
    })

    await db.open()
    await db.profile.put({ id: 'main', data: profile, version: 0 })
    await db.umas.put({ id: uma.templateId, data: uma, version: 0 })
    await expect(promotePersistentUma(loaded, uma.templateId, 5)).rejects.toThrow(/not owned/)
    expect((await db.profile.get('main'))?.data.tickets).toBe(100)
    expect((await db.umas.get(uma.templateId))?.data.level).toBe(10)
    expect(await db.ledger.count()).toBe(0)
    expect(await db.outbox.count()).toBe(0)
  })

  it('promotes a formerly final level-110 save without replacing its snapshot or re-awarding Graduate flair', async () => {
    const loaded = content()
    const profile = { ...createPlayerProfile(loaded.manifest.version, 1), tickets: 1_000 }
    const snapshot = {
      umaId: umaTemplate.id, charaId: umaTemplate.charaId, completedTier: 11, takenAt: 70,
      inheritedUniqueSkillId: 'gene-promo', inheritableWhiteSkillIds: [], aptitudes, parents: [],
    }
    const completedJourney = {
      tier: 11, tracking: 'legacy-untracked' as const, state: 'completed' as const, completedAt: null, goals: [],
    }
    const formerMaximum = {
      ...readyUma(), level: 110, parentSnapshot: snapshot, goalPlanVersion: 2, scenarioJourneys: [completedJourney],
    }
    let badge = createUmaBadgeState(formerMaximum, 70)
    badge = applyScenarioCompletionFact(badge, {
      tier: 11,
      completedAt: 70,
      trainingLevel: formerMaximum.trainingLevel,
      stats: formerMaximum.stats,
      deckCardIds: [...formerMaximum.deckCardIds],
      deckEras: [1],
      trainingTurns: formerMaximum.trainingsThisScenario,
      friendshipTrainings: 0,
      raceStarts: 0,
      completedGoalIds: [],
      honors: false,
      parentUmaIds: [],
      grandparentUmaIds: [],
    })
    const awarded = evaluateUmaFlair(buildUmaFlairCatalog({ state: badge, races: loaded.races.items }), badge, {
      source: { kind: 'scenario', id: flairSourceId('scenario', umaTemplate.id, '11'), tier: 11 },
      earnedAt: 70,
      retroactive: false,
    })
    const graduateId = awarded.events.find((event) => event.data.awardKey === 'badge:scenario:11:graduate')?.id
    expect(graduateId).toBeTruthy()

    await db.open()
    await db.profile.put({ id: 'main', data: profile, version: 0 })
    await db.umas.put({ id: formerMaximum.templateId, data: formerMaximum, version: 0 })
    await db.cards.put({ id: cardTemplate.id, data: createCardSave(cardTemplate), version: 0 })
    await db.badges.put({ id: badgeStateId(formerMaximum.templateId), data: awarded.state, version: 3 })
    await db.flairEvents.bulkPut(awarded.events.map((event) => ({ id: event.id, data: event.data, createdAt: event.data.earnedAt })))

    const result = await promotePersistentUma(loaded, formerMaximum.templateId, 99)
    expect(result.uma).toMatchObject({ level: 111, parentSnapshot: snapshot })
    expect(result.uma.scenarioJourneys[0]).toEqual(completedJourney)
    expect(result.earnedFlairEventIds).not.toContain(graduateId)
    expect((await db.flairEvents.toArray()).filter((row) => row.data.awardKey === 'badge:scenario:11:graduate')).toHaveLength(1)
  })

  it('starts a fresh Uma with a frozen parent for free and treats an exact retry as success', async () => {
    const loaded = content()
    const profile = { ...createPlayerProfile(loaded.manifest.version, 1), tickets: 100 }
    const child = createUmaSave(umaTemplate)
    const snapshot = {
      umaId: parentTemplate.id, charaId: parentTemplate.charaId, completedTier: 1, takenAt: 20,
      inheritedUniqueSkillId: 'gene-parent', inheritableWhiteSkillIds: ['white-parent'], aptitudes, parents: [],
    }
    const parent = { ...createUmaSave(parentTemplate), goalPlanVersion: 0, scenarioStarted: true, parentSnapshot: snapshot }
    const selection = {
      parents: [parentFingerprint(snapshot)], grandparentUniqueSkillIds: [], grandparentWhiteSkillIds: [], pinkSparks: [null],
    }
    await db.open()
    await db.profile.put({ id: 'main', data: profile, version: 0 })
    await db.umas.bulkPut([{ id: child.templateId, data: child, version: 0 }, { id: parent.templateId, data: parent, version: 0 }])

    const first = await startPersistentScenario(loaded, child.templateId, selection, 30)
    expect(first).toMatchObject({ alreadyStarted: false, profile: { tickets: 100 }, uma: { scenarioStarted: true } })
    expect(first.uma.skillLibrary).toContainEqual({ skillId: 'gene-parent', origin: 'inherited', sourceId: parentTemplate.id })
    expect(first.uma.currentParents).toEqual([snapshot])
    expect(await db.ledger.count()).toBe(0)
    expect((await db.outbox.toArray()).map((row) => `${row.kind}/${row.id}`)).toEqual(expect.arrayContaining([
      `umas/${child.templateId}`,
      `badges/uma:${child.templateId}`,
      `badges/uma:${parent.templateId}`,
      'flairEvents/flair:uma:uma-parent:badge:legacy:bronze',
    ]))
    expect(first.earnedFlairEventIds).toEqual([
      'flair:uma:uma-parent:badge:legacy:bronze',
      'flair:trainer:stable:trainer:stable-master:rainbow',
    ])
    const retry = await startPersistentScenario(loaded, child.templateId, selection, 31)
    expect(retry).toMatchObject({ alreadyStarted: true, alreadyPromoted: false, profile: { tickets: 100 } })
    expect(await db.ledger.count()).toBe(0)
  })

  it('rejects a refreshed parent fingerprint without any child or profile write', async () => {
    const loaded = content()
    const profile = { ...createPlayerProfile(loaded.manifest.version, 1), tickets: 100 }
    const child = createUmaSave(umaTemplate)
    const snapshot = {
      umaId: parentTemplate.id, charaId: parentTemplate.charaId, completedTier: 2, takenAt: 40,
      inheritedUniqueSkillId: 'gene-parent', inheritableWhiteSkillIds: [], aptitudes, parents: [],
    }
    const parent = { ...createUmaSave(parentTemplate), goalPlanVersion: 0, scenarioStarted: true, parentSnapshot: snapshot }
    await db.open()
    await db.profile.put({ id: 'main', data: profile, version: 0 })
    await db.umas.bulkPut([{ id: child.templateId, data: child, version: 0 }, { id: parent.templateId, data: parent, version: 0 }])
    const stale = { ...parentFingerprint(snapshot), takenAt: 39 }
    await expect(startPersistentScenario(loaded, child.templateId, {
      parents: [stale], grandparentUniqueSkillIds: [], grandparentWhiteSkillIds: [], pinkSparks: [null],
    }, 50)).rejects.toThrow(/stale/)
    expect((await db.profile.get('main'))?.data).toEqual(profile)
    expect((await db.umas.get(child.templateId))?.data).toEqual(child)
    expect(await db.outbox.count()).toBe(0)
  })
})
