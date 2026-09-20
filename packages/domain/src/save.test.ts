import { describe, expect, it } from 'vitest'
import type { SupportCardTemplate, UmaTemplate } from './content'
import { createUmaBadgeState } from './badges'
import {
  applyDailyGrants,
  createInitialSave,
  createPlayerProfile,
  createUmaSave,
  migratePlayerProfileV1,
  migratePlayerProfileV2,
  migratePlayerProfileV3,
  migrateUmaSaveV1,
  migrateUmaSaveV2,
  migrateUmaSaveV3,
  parseCardSave,
  parsePlayerProfile,
  parsePlayerProfileOrThrow,
  parseSaveSnapshot,
  parseSaveSnapshotOrThrow,
  parseSyncRequest,
  parseUmaSave,
  parseUmaSaveOrThrow,
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
    signatureRaceFamilyIds: [],
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
    expect(parsePlayerProfile({ ...createPlayerProfile('v1', 1), schemaVersion: 5 })).toBeNull()
    expect(() => parsePlayerProfileOrThrow({ ...createPlayerProfile('v1', 1), schemaVersion: 5 })).toThrow(/App update required/)
  })

  it('migrates v1 profiles and Umas into current defaults and preserves every v2 goal fact', () => {
    const profileV1 = { ...createPlayerProfile('v1', 1), schemaVersion: 1 as const, tickets: 77 }
    expect(migratePlayerProfileV1(profileV1)).toEqual({ ...profileV1, schemaVersion: 4 })
    const profileV2 = { ...profileV1, schemaVersion: 2 as const }
    expect(migratePlayerProfileV2(profileV2)).toEqual({ ...profileV2, schemaVersion: 4 })
    const profileV3 = { ...profileV1, schemaVersion: 3 as const }
    expect(migratePlayerProfileV3(profileV3)).toEqual({ ...profileV3, schemaVersion: 4 })
    const current = createUmaSave(uma('u1'))
    const { schemaVersion: _schemaVersion, scenarioStarted: _scenarioStarted, skillHistory: _skillHistory,
      currentParents: _currentParents, parentSnapshot: _parentSnapshot, goalPlanVersion: _goalPlanVersion,
      scenarioJourneys: _scenarioJourneys, scenarioModifier: _scenarioModifier, ...legacy } = current
    const migrated = migrateUmaSaveV1({ ...legacy, level: 20 })
    expect(migrated).toMatchObject({
      schemaVersion: 4, level: 20, scenarioStarted: true, currentParents: [], parentSnapshot: null,
      goalPlanVersion: 0, scenarioJourneys: [],
      scenarioModifier: null,
      skillHistory: [{ skillId: 'skill-u1', origin: 'own-unique', sourceId: 'u1', tier: 2 }],
    })
    expect(parseUmaSave(migrated)).toEqual(migrated)

    const goal = {
      id: 'goal:1:aptitude', slot: 'aptitude' as const, raceId: 'synthetic-race', kind: 'win' as const,
      minimumMarginLengths: 0, status: 'completed' as const, completedRaceResultId: 'race:u1:4', completedAt: 22,
    }
    const { scenarioModifier: _currentModifier, ...preModifier } = current
    const legacyV2 = {
      ...preModifier,
      schemaVersion: 2 as const,
      scenarioStarted: true,
      goalPlanVersion: 1,
      scenarioJourneys: [{
        tier: 1, tracking: 'tracked' as const, state: 'active' as const, completedAt: null,
        goals: [
          goal,
          { ...goal, id: 'goal:1:identity', slot: 'identity' as const, raceId: 'synthetic-race-2', status: 'active' as const, completedRaceResultId: null, completedAt: null },
          { ...goal, id: 'goal:1:challenge', slot: 'challenge' as const, raceId: 'synthetic-race-3', kind: 'win-by-margin' as const, minimumMarginLengths: 5, status: 'active' as const, completedRaceResultId: null, completedAt: null },
        ],
      }],
    }
    const migratedV2 = migrateUmaSaveV2(legacyV2)
    expect(migratedV2).toMatchObject({ schemaVersion: 4, goalPlanVersion: 1, scenarioModifier: null })
    expect(migratedV2.scenarioJourneys[0]?.goals).toEqual(legacyV2.scenarioJourneys[0]?.goals.map((item) => ({ ...item, series: null })))
    expect(parseUmaSave(migratedV2)).toEqual(migratedV2)

    const legacyV3 = { ...preModifier, schemaVersion: 3 as const }
    const migratedV3 = migrateUmaSaveV3(legacyV3)
    expect(migratedV3).toEqual({ ...legacyV3, schemaVersion: 4, scenarioModifier: null })
    expect(parseUmaSave(migratedV3)).toEqual(migratedV3)
  })

  it('strictly rejects duplicate histories, recursive parents, and malformed journeys', () => {
    const save = createUmaSave(uma('u1'))
    expect(parseUmaSave({ ...save, skillHistory: [...save.skillHistory, ...save.skillHistory] })).toBeNull()
    expect(parseUmaSave({ ...save, currentParents: [{ umaId: 'p1' }] })).toBeNull()
    expect(parseUmaSave({ ...save, scenarioJourneys: [{ tier: 1, tracking: 'tracked', state: 'active', completedAt: null, goals: [] }] })).toBeNull()
  })

  it('accepts only the modifier state for the active tier and rejects future or malformed state', () => {
    const base = { ...createUmaSave(uma('u1')), level: 11, scenarioStarted: true, goalPlanVersion: 0 }
    const spirit = { version: 1 as const, tier: 2 as const, kind: 'team-spirit' as const, bursts: 3 }
    expect(parseUmaSave({ ...base, scenarioModifier: spirit })).toMatchObject({ scenarioModifier: spirit })
    expect(parseUmaSave({ ...base, scenarioModifier: { ...spirit, version: 2 } })).toBeNull()
    expect(() => parseUmaSaveOrThrow({ ...base, scenarioModifier: { ...spirit, version: 2 } })).toThrow(/App update required/)
    expect(parseUmaSave({ ...base, scenarioModifier: { ...spirit, tier: 3 } })).toBeNull()
    expect(parseUmaSave({ ...base, scenarioModifier: { ...spirit, bursts: -1 } })).toBeNull()
    expect(parseUmaSave({ ...base, scenarioModifier: { ...spirit, extra: true } })).toBeNull()

    const climaxBase = { ...base, level: 21 }
    const climax = { version: 1 as const, tier: 3 as const, kind: 'climax' as const, earned: 4, stock: 2, used: 2 }
    expect(parseUmaSave({ ...climaxBase, scenarioModifier: climax })).toMatchObject({ scenarioModifier: climax })
    expect(parseUmaSave({ ...climaxBase, scenarioModifier: { ...climax, used: 1 } })).toBeNull()
    expect(parseUmaSave({ ...climaxBase, scenarioStarted: false, scenarioModifier: climax })).toBeNull()

    const concert = { ...base, level: 31, scenarioModifier: { version: 1 as const, tier: 4 as const, kind: 'performances' as const, notes: ['speed', 'power'] as const, performances: 1 } }
    expect(parseUmaSave(concert)).toMatchObject({ scenarioModifier: { kind: 'performances', notes: ['speed', 'power'] } })
    expect(parseUmaSave({ ...concert, scenarioModifier: { ...concert.scenarioModifier, notes: ['power', 'speed'] } })).toBeNull()
    const masters = { ...base, level: 41, scenarioModifier: { version: 1 as const, tier: 5 as const, kind: 'goddess-fragments' as const, fragments: 7, bursts: 2 } }
    expect(parseUmaSave(masters)).toMatchObject({ scenarioModifier: { kind: 'goddess-fragments', fragments: 7 } })
    const expedition = { ...base, level: 51, scenarioModifier: { version: 1 as const, tier: 6 as const, kind: 'expedition' as const, stamps: 5, completed: 2, upgraded: 1 } }
    expect(parseUmaSave(expedition)).toMatchObject({ scenarioModifier: { kind: 'expedition', stamps: 5 } })
    expect(() => parseUmaSaveOrThrow({ ...base, scenarioModifier: { version: 1, tier: 2, kind: 'future-loop' } })).toThrow(/App update required/)
  })

  it('strictly validates single and series goal shapes and distinct frozen targets', () => {
    const base = { ...createUmaSave(uma('u1')), scenarioStarted: true, goalPlanVersion: 2 }
    const single = (slot: 'aptitude' | 'challenge', raceId: string) => ({
      id: `goal:1:${slot}`, slot, raceId, kind: slot === 'challenge' ? 'win-by-margin' as const : 'win' as const,
      series: null, minimumMarginLengths: slot === 'challenge' ? 5 : 0, status: 'active' as const,
      completedRaceResultId: null, completedAt: null,
    })
    const identity = {
      id: 'goal:1:identity', slot: 'identity' as const, raceId: null, kind: 'win-series' as const,
      series: { tag: 'grand-prix' as const, legs: [
        { key: 'first-leg', raceId: 'series-a', status: 'completed' as const, completedRaceResultId: 'race:u1:1', completedAt: 10 },
        { key: 'second-leg', raceId: 'series-b', status: 'active' as const, completedRaceResultId: null, completedAt: null },
      ] },
      minimumMarginLengths: 0, status: 'active' as const, completedRaceResultId: null, completedAt: null,
    }
    const journey = { tier: 1, tracking: 'tracked' as const, state: 'active' as const, completedAt: null, goals: [single('aptitude', 'single-a'), identity, single('challenge', 'single-c')] }
    expect(parseUmaSave({ ...base, scenarioJourneys: [journey] })).not.toBeNull()
    expect(parseUmaSave({ ...base, scenarioJourneys: [{ ...journey, goals: [{ ...journey.goals[0], series: identity.series }, identity, journey.goals[2]] }] })).toBeNull()
    expect(parseUmaSave({ ...base, scenarioJourneys: [{ ...journey, goals: [journey.goals[0], { ...identity, raceId: 'series-a' }, journey.goals[2]] }] })).toBeNull()
    expect(parseUmaSave({ ...base, scenarioJourneys: [{ ...journey, goals: [journey.goals[0], { ...identity, series: { ...identity.series, legs: [identity.series.legs[0]!] } }, journey.goals[2]] }] })).toBeNull()
    expect(parseUmaSave({ ...base, scenarioJourneys: [{ ...journey, goals: [journey.goals[0], { ...identity, series: { ...identity.series, legs: [identity.series.legs[0]!, { ...identity.series.legs[1]!, key: 'first-leg' }] } }, journey.goals[2]] }] })).toBeNull()
    expect(parseUmaSave({ ...base, scenarioJourneys: [{ ...journey, goals: [journey.goals[0], { ...identity, series: { ...identity.series, legs: [identity.series.legs[0]!, { ...identity.series.legs[1]!, raceId: 'series-a' }] } }, journey.goals[2]] }] })).toBeNull()
    expect(parseUmaSave({ ...base, scenarioJourneys: [{ ...journey, goals: [single('aptitude', 'series-a'), identity, journey.goals[2]] }] })).toBeNull()
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
      entities: [{ ...duplicate, data: { ...profile, schemaVersion: 5 } }],
      logs: [],
      serverTime: 1,
    })).toThrow(/App update required/)
    const currentUma = { ...createUmaSave(uma('u1')), level: 11, scenarioStarted: true, goalPlanVersion: 0 }
    expect(() => parseSaveSnapshotOrThrow({
      entities: [
        duplicate,
        {
          kind: 'umas', id: currentUma.templateId, version: 1, deleted: false, updatedAt: 1,
          data: { ...currentUma, scenarioModifier: { version: 2, tier: 2, kind: 'team-spirit', bursts: 0 } },
        },
      ],
      logs: [],
      serverTime: 1,
    })).toThrow(/scenario modifier version 2/)
  })

  it('strictly validates independent badge entities and flair logs', () => {
    const state = createUmaBadgeState(createUmaSave(uma('u1')), 10)
    const event = {
      version: 1,
      scope: 'uma',
      umaId: 'u1',
      kind: 'badge-tier',
      awardKey: 'synthetic-award',
      stage: 'bronze',
      earnedAt: 20,
      source: { kind: 'migration', id: null, tier: null },
      retroactive: true,
    }
    expect(parseSyncRequest({
      upserts: [{ kind: 'badges', id: 'uma:u1', baseVersion: 0, data: state }],
      appends: [{ kind: 'flairEvents', id: 'flair:synthetic', data: event, createdAt: 20 }],
    })).toMatchObject({
      upserts: [{ kind: 'badges', id: 'uma:u1' }],
      appends: [{ kind: 'flairEvents', id: 'flair:synthetic' }],
    })
    expect(parseSyncRequest({
      upserts: [{ kind: 'badges', id: 'uma:wrong', baseVersion: 0, data: state }],
    })).toMatch(/does not match/)
    expect(parseSyncRequest({
      upserts: [{ kind: 'badges', id: 'uma:u1', baseVersion: 0, data: { ...state, facts: { ...state.facts, wins: 2, starts: 1 } } }],
    })).toMatch(/invalid badges data/)
    expect(parseSyncRequest({
      appends: [{ kind: 'flairEvents', id: 'flair:synthetic', data: event, createdAt: 21 }],
    })).toMatch(/timestamp/)
  })
})
