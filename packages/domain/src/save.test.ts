import { describe, expect, it } from 'vitest'
import type { SupportCardTemplate, UmaTemplate } from './content'
import {
  applyDailyGrants,
  createInitialSave,
  createPlayerProfile,
  createUmaSave,
  migratePlayerProfileV1,
  migrateUmaSaveV1,
  parseCardSave,
  parsePlayerProfile,
  parsePlayerProfileOrThrow,
  parseSaveSnapshot,
  parseSaveSnapshotOrThrow,
  parseSyncRequest,
  parseUmaSave,
} from './save'

const aptitudes = {
  surface: { turf: 'A', dirt: 'G' },
  distance: { sprint: 'B', mile: 'A', medium: 'A', long: 'C' },
  strategy: { front: 'D', pace: 'A', late: 'B', end: 'C' },
} as const

function uma(id: string, starter = true): UmaTemplate {
  return {
    id,
    charaId: `chara-${id}`,
    name: `Synthetic ${id}`,
    outfit: null,
    jpRelease: '2000-01-01',
    globalRelease: null,
    starter,
    baseStats: { speed: 101, stamina: 102, power: 103, guts: 104, wit: 105 },
    growthRates: { speed: 0, stamina: 0, power: 0, guts: 0, wit: 0 },
    aptitudes,
    uniqueSkillId: `skill-${id}`,
    awakeningSkillIds: [],
    realHorseSex: null,
    signatureRaces: [],
    imageSource: 'https://invalid.test/synthetic.png',
  }
}

function card(id: string, starter = true): SupportCardTemplate {
  return {
    id,
    charaId: `card-chara-${id}`,
    charName: `Synthetic ${id}`,
    title: `Card ${id}`,
    type: 'speed',
    jpRelease: '2000-01-01',
    era: 1,
    obtain: starter ? 'free' : 'gacha',
    starter,
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

describe('save initialization', () => {
  it('seeds only starters deterministically with independent mutable records', () => {
    const templates = [...Array.from({ length: 25 }, (_, index) => uma(`u${String(index).padStart(2, '0')}`)), uma('later', false)]
    const result = createInitialSave([...templates].reverse(), [card('c2'), card('c1'), card('later', false)], 'abc123', '2026-03-08', 42)

    expect(result.umas).toHaveLength(25)
    expect(result.umas[0]?.templateId).toBe('u00')
    expect(result.cards.map((item) => item.templateId)).toEqual(['c1', 'c2'])
    expect(result.profile).toMatchObject({ tickets: 50, cardCoupons: 3, featuredUmaId: 'u00', starterSeedContentVersion: 'abc123' })
    expect(result.ledger.map((item) => item.id)).toEqual(['initial-card-coupons', 'daily-tickets:2026-03-08'])

    result.umas[0]!.stats.speed = 999
    result.umas[0]!.aptitudes.surface.turf = 'G'
    expect(templates.find((item) => item.id === 'u00')!.baseStats.speed).toBe(101)
    expect(templates.find((item) => item.id === 'u00')!.aptitudes.surface.turf).toBe('A')
  })

  it('requires exactly 25 launch starters', () => {
    expect(() => createInitialSave([uma('one')], [], 'v1', '2026-01-01', 1)).toThrow(/exactly 25/)
  })

  it('puts the unique in the library without charging the loadout', () => {
    expect(createUmaSave(uma('u1'))).toMatchObject({
      skillLibrary: [{ skillId: 'skill-u1', origin: 'own-unique', sourceId: 'u1' }],
      loadoutSkillIds: [],
    })
  })

  it('rejects malformed content before constructing a save', () => {
    const malformed = { ...uma('bad'), baseStats: { ...uma('bad').baseStats, speed: -1 } }
    expect(() => createUmaSave(malformed)).toThrow(/invalid save initialization data/)
  })
})

describe('daily grants', () => {
  it('handles missed calendar days, DST-shaped dates, and the cap', () => {
    const profile = { ...createPlayerProfile('v1', 1), tickets: 430, lastDailyGrant: '2026-03-07' }
    const result = applyDailyGrants(profile, '2026-03-10', 2)
    expect(result.profile.tickets).toBe(500)
    expect(result.profile.lastDailyGrant).toBe('2026-03-10')
    expect(result.ledger.map((item) => [item.id, item.data.delta])).toEqual([
      ['daily-tickets:2026-03-08', 50],
      ['daily-tickets:2026-03-09', 20],
    ])
  })

  it('never lowers over-cap tickets or grants twice after reload/clock rollback', () => {
    const profile = { ...createPlayerProfile('v1', 1), tickets: 520, lastDailyGrant: '2026-06-02' }
    const forward = applyDailyGrants(profile, '2026-06-03', 2)
    expect(forward.profile.tickets).toBe(520)
    expect(forward.ledger).toEqual([])
    expect(applyDailyGrants(forward.profile, '2026-06-03', 3).ledger).toEqual([])
    expect(applyDailyGrants(forward.profile, '2026-06-01', 3).profile.lastDailyGrant).toBe('2026-06-03')
  })
})

describe('save parsing', () => {
  it('accepts canonical records and rejects malformed counters, references, and versions', () => {
    const save = createUmaSave(uma('u1'))
    expect(parseUmaSave(save)).toEqual(save)
    expect(parseUmaSave({ ...save, trainingLevel: 11 })).toBeNull()
    expect(parseUmaSave({ ...save, deckCardIds: ['c1', 'c1'] })).toBeNull()
    expect(parseCardSave({ templateId: 'c1', level: 6, exp: 0, limitBreak: 0, maxCouponGranted: false })).toBeNull()
    expect(parsePlayerProfile({ ...createPlayerProfile('v1', 1), schemaVersion: 3 })).toBeNull()
    expect(() => parsePlayerProfileOrThrow({ ...createPlayerProfile('v1', 1), schemaVersion: 3 })).toThrow(/App update required/)
  })

  it('migrates v1 profiles and Umas losslessly into explicit v2 defaults', () => {
    const profileV1 = { ...createPlayerProfile('v1', 1), schemaVersion: 1 as const, tickets: 77 }
    expect(migratePlayerProfileV1(profileV1)).toEqual({ ...profileV1, schemaVersion: 2 })
    const current = createUmaSave(uma('u1'))
    const { schemaVersion: _schemaVersion, scenarioStarted: _scenarioStarted, skillHistory: _skillHistory,
      currentParents: _currentParents, parentSnapshot: _parentSnapshot, goalPlanVersion: _goalPlanVersion,
      scenarioJourneys: _scenarioJourneys, ...legacy } = current
    const migrated = migrateUmaSaveV1({ ...legacy, level: 20 })
    expect(migrated).toMatchObject({
      schemaVersion: 2, level: 20, scenarioStarted: true, currentParents: [], parentSnapshot: null,
      goalPlanVersion: 0, scenarioJourneys: [],
      skillHistory: [{ skillId: 'skill-u1', origin: 'own-unique', sourceId: 'u1', tier: 2 }],
    })
    expect(parseUmaSave(migrated)).toEqual(migrated)
  })

  it('strictly rejects duplicate histories, recursive parents, and malformed journeys', () => {
    const save = createUmaSave(uma('u1'))
    expect(parseUmaSave({ ...save, skillHistory: [...save.skillHistory, ...save.skillHistory] })).toBeNull()
    expect(parseUmaSave({ ...save, currentParents: [{ umaId: 'p1' }] })).toBeNull()
    expect(parseUmaSave({ ...save, scenarioJourneys: [{ tier: 1, tracking: 'tracked', state: 'active', completedAt: null, goals: [] }] })).toBeNull()
  })

  it('validates typed sync requests and snapshots', () => {
    const profile = createPlayerProfile('v1', 1)
    expect(parseSyncRequest({ upserts: [{ kind: 'profile', id: 'main', baseVersion: 0, data: profile }], appends: [] })).toEqual({
      upserts: [{ kind: 'profile', id: 'main', baseVersion: 0, data: profile, deleted: undefined }],
      appends: [],
    })
    expect(parseSyncRequest({ upserts: [{ kind: 'profile', id: 'wrong', baseVersion: 0, data: profile }] })).toMatch(/does not match/)
    expect(parseSyncRequest({
      upserts: [
        { kind: 'profile', id: 'main', baseVersion: 0, data: profile },
        { kind: 'profile', id: 'main', baseVersion: 0, data: profile },
      ],
    })).toMatch(/duplicate/)
    expect(parseSaveSnapshot({ entities: [], logs: [], serverTime: 1 })).toEqual({ entities: [], logs: [], serverTime: 1 })
    expect(parseSaveSnapshot({ entities: [{ nope: true }], logs: [], serverTime: 1 })).toBeNull()
    const duplicate = {
      kind: 'profile',
      id: 'main',
      version: 1,
      data: profile,
      deleted: false,
      updatedAt: 1,
    }
    expect(parseSaveSnapshot({ entities: [duplicate, duplicate], logs: [], serverTime: 1 })).toBeNull()
    expect(() => parseSaveSnapshotOrThrow({
      entities: [{ ...duplicate, data: { ...profile, schemaVersion: 3 } }],
      logs: [],
      serverTime: 1,
    })).toThrow(/App update required/)
  })
})
