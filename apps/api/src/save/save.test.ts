import { readFileSync } from 'node:fs'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { LocalSaveRepository } from './local-save.repository'
import { LEDGER_REASONS, LEDGER_RESOURCES, MAX_COMPLETION_GOALS, MAX_SYNC_OPERATIONS, parseSyncRequest, resolveUpserts, type EntityRecord } from './save.types'
import { fromStored, hasNestedArray, toStored } from './firestore-codec'

describe('LocalSaveRepository sync', () => {
  let dir: string
  let repo: LocalSaveRepository

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'racer-save-'))
    repo = new LocalSaveRepository(join(dir, 'save.json'))
  })
  afterEach(() => rm(dir, { recursive: true, force: true }))

  it('applies new entities at version 1 and bumps on matching baseVersion', async () => {
    const first = await repo.sync('u1', { upserts: [{ kind: 'umas', id: 'spe', baseVersion: 0, data: { level: 1 } }], appends: [] })
    expect(first.applied).toEqual([{ kind: 'umas', id: 'spe', version: 1 }])

    const second = await repo.sync('u1', { upserts: [{ kind: 'umas', id: 'spe', baseVersion: 1, data: { level: 2 } }], appends: [] })
    expect(second.applied[0]?.version).toBe(2)

    const save = await repo.load('u1')
    expect(save.entities).toHaveLength(1)
    expect(save.entities[0]?.data).toEqual({ level: 2 })
  })

  it('returns the server copy on a stale upsert instead of overwriting', async () => {
    await repo.sync('u1', { upserts: [{ kind: 'cards', id: 'c1', baseVersion: 0, data: { lb: 1 } }], appends: [] })
    await repo.sync('u1', { upserts: [{ kind: 'cards', id: 'c1', baseVersion: 1, data: { lb: 2 } }], appends: [] })
    const stale = await repo.sync('u1', { upserts: [{ kind: 'cards', id: 'c1', baseVersion: 1, data: { lb: 9 } }], appends: [] })
    expect(stale.applied).toEqual([])
    expect(stale.conflicts[0]?.data).toEqual({ lb: 2 })
  })

  it('appends logs idempotently and keeps players separate', async () => {
    const append = { kind: 'raceResults' as const, id: 'r1', data: { placement: 1 }, createdAt: 1 }
    expect((await repo.sync('u1', { upserts: [], appends: [append] })).appended).toBe(1)
    expect((await repo.sync('u1', { upserts: [], appends: [append] })).appended).toBe(0)
    expect((await repo.load('u1')).logs).toHaveLength(1)
    expect((await repo.load('u2')).logs).toHaveLength(0)
    // A later, different copy of the same log id is a second device recording the same event: the first write wins and
    // the rest of the batch still lands, rather than failing the whole sync (D149).
    const response = await repo.sync('u1', {
      upserts: [{ kind: 'profile', id: 'main', baseVersion: 0, data: { placement: 0 } }],
      appends: [{ ...append, data: { placement: 2 }, createdAt: 2 }],
    })
    expect(response).toMatchObject({ appended: 0, applied: [{ kind: 'profile', id: 'main', version: 1 }] })
    expect((await repo.load('u1')).logs).toEqual([append])
  })
})

describe('parseSyncRequest', () => {
  it('rejects unknown kinds, bad ids, and oversized batches', () => {
    expect(parseSyncRequest({ upserts: [{ kind: 'nope', id: 'a', baseVersion: 0, data: {} }] })).toMatch(/unknown entity kind/)
    expect(parseSyncRequest({ upserts: [{ kind: 'umas', id: '../x', baseVersion: 0, data: {} }] })).toMatch(/invalid entity id/)
    const many = Array.from({ length: MAX_SYNC_OPERATIONS + 1 }, (_, i) => ({ kind: 'ledger', id: `l${i}`, data: {}, createdAt: 0 }))
    expect(parseSyncRequest({ appends: many })).toMatch(/at most/)
  })

  it('accepts a valid batch', () => {
    const profile = {
      schemaVersion: 1,
      tickets: 50,
      cardCoupons: 3,
      umaCoupons: 0,
      umaShards: 0,
      lastDailyGrant: '2026-01-01',
      featuredUmaId: null,
      starterSeedContentVersion: 'synthetic-v1',
      createdAt: 1,
    }
    const parsed = parseSyncRequest({
      upserts: [{ kind: 'profile', id: 'main', baseVersion: 3, data: profile }],
      appends: [
        {
          kind: 'ledger',
          id: 'l1',
          data: { resource: 'tickets', delta: -1, reason: 'training', localDay: '2026-01-01', createdAt: 1 },
          createdAt: 1,
        },
      ],
    })
    expect(typeof parsed).toBe('object')
    expect(parseSyncRequest({ upserts: [{ kind: 'profile', id: 'main', baseVersion: 3, data: { ...profile, copiedName: 'Synthetic' } }] })).toMatch(/invalid profile data/)
    expect(parseSyncRequest({ upserts: [
      { kind: 'profile', id: 'main', baseVersion: 3, data: profile },
      { kind: 'profile', id: 'main', baseVersion: 3, data: profile },
    ] })).toMatch(/duplicate/)
    expect(parseSyncRequest({ appends: [{
      kind: 'ledger',
      id: 'card-coupon-redeem:synthetic-card',
      data: { resource: 'card-coupons', delta: -1, reason: 'card-coupon-redeem', localDay: '2026-01-01', createdAt: 2 },
      createdAt: 2,
    }] })).toMatchObject({ appends: [{ kind: 'ledger', id: 'card-coupon-redeem:synthetic-card' }] })
  })

  it('strictly validates the reserved badge and flair sync shapes', () => {
    const trainer = {
      version: 1,
      scope: 'trainer',
      catalogVersion: 1,
      evaluatorVersion: 0,
      trackingStartedAt: 1,
      sourceWatermarks: { contributors: 0, ledgerEntries: 0, contentVersion: null },
      aggregates: [],
      records: [],
      awards: { achievements: [] },
      preferences: {
        activeTitleId: null,
        showcaseGroups: [{ id: 'default', name: null, awardRefs: [] }],
        savedViews: [],
        displayName: 'Trainer',
        pinnedUmaIds: [],
      },
    }
    const flair = {
      version: 1,
      scope: 'trainer',
      umaId: null,
      kind: 'trainer-achievement',
      awardKey: 'synthetic-achievement',
      stage: 'bronze',
      earnedAt: 5,
      source: { kind: 'migration', id: null, tier: null },
      retroactive: true,
    }
    expect(parseSyncRequest({
      upserts: [{ kind: 'badges', id: 'trainer', baseVersion: 0, data: trainer }],
      appends: [{ kind: 'flairEvents', id: 'flair:synthetic', data: flair, createdAt: 5 }],
    })).toMatchObject({ upserts: [{ id: 'trainer' }], appends: [{ id: 'flair:synthetic' }] })
    expect(parseSyncRequest({
      upserts: [{ kind: 'badges', id: 'trainer', baseVersion: 0, data: { ...trainer, records: [{
        kind: 'highest-stat', value: 999, umaId: 'synthetic-uma', sourceId: null, achievedAt: 4, stat: 'speed',
      }] } }],
    })).toMatchObject({ upserts: [{ id: 'trainer' }] })
    expect(parseSyncRequest({
      upserts: [{ kind: 'badges', id: 'trainer', baseVersion: 0, data: { ...trainer, records: [{
        kind: 'most-wins', value: 5, umaId: 'synthetic-uma', sourceId: null, achievedAt: 4, stat: 'speed',
      }] } }],
    })).toMatch(/invalid badges data/)
    expect(parseSyncRequest({
      upserts: [{ kind: 'badges', id: 'trainer', baseVersion: 0, data: { ...trainer, aggregates: [{ key: 'wins', count: -1 }] } }],
    })).toMatch(/invalid badges data/)
    expect(parseSyncRequest({
      upserts: [{ kind: 'badges', id: 'trainer', baseVersion: 0, data: {
        ...trainer,
        preferences: { ...trainer.preferences, savedViews: [{
          id: 'invalid-view', name: 'Invalid', filters: [{ key: 'status:anything', count: 1 }], sort: 'recent',
        }] },
      } }],
    })).toMatch(/invalid badges data/)
    const scopedViews = [
      ...Array.from({ length: 20 }, (_, index) => ({ id: `view-${index}`, name: `View ${index}`, filters: [], sort: 'recent' })),
      ...Array.from({ length: 20 }, (_, index) => ({ id: `trainer-view-${index}`, name: `View ${index}`, filters: [], sort: 'recent' })),
    ]
    expect(parseSyncRequest({
      upserts: [{ kind: 'badges', id: 'trainer', baseVersion: 0, data: {
        ...trainer, preferences: { ...trainer.preferences, savedViews: scopedViews },
      } }],
    })).toMatchObject({ upserts: [{ id: 'trainer' }] })
    expect(parseSyncRequest({
      upserts: [{ kind: 'badges', id: 'trainer', baseVersion: 0, data: {
        ...trainer,
        preferences: { ...trainer.preferences, savedViews: [...scopedViews, { id: 'trainer-view-overflow', name: 'Overflow', filters: [], sort: 'recent' }] },
      } }],
    })).toMatch(/invalid badges data/)
    expect(parseSyncRequest({
      appends: [{ kind: 'flairEvents', id: 'flair:synthetic', data: flair, createdAt: 6 }],
    })).toMatch(/timestamp/)
  })

  it('accepts save v7: profiles, star cards up to 5★, and still v6 limit-break cards from old clients (D147, D148)', () => {
    const profile = {
      schemaVersion: 7, tickets: 89, cardCoupons: 3, umaCoupons: 0, umaShards: 0, lastDailyGrant: '2026-01-01',
      featuredUmaId: null, starterSeedContentVersion: 'synthetic-v1', createdAt: 1,
    }
    expect(parseSyncRequest({ upserts: [{ kind: 'profile', id: 'main', baseVersion: 3, data: profile }] })).toMatchObject({
      upserts: [{ kind: 'profile', data: { schemaVersion: 7 } }],
    })
    expect(parseSyncRequest({ upserts: [{ kind: 'profile', id: 'main', baseVersion: 3, data: { ...profile, schemaVersion: 11 } }] }))
      .toMatch(/invalid profile data/)
    const card = (data: Record<string, unknown>) => parseSyncRequest({ upserts: [{ kind: 'cards', id: 'c1', baseVersion: 1, data: { templateId: 'c1', maxCouponGranted: false, ...data } }] })
    expect(card({ stars: { '1': 5, '2': 3 } })).toMatchObject({ upserts: [{ kind: 'cards', data: { stars: { '1': 5 } } }] })
    expect(card({ stars: { '1': 6 } })).toMatch(/invalid cards data/)
    expect(card({ limitBreaks: { '1': 4 } })).toMatchObject({ upserts: [{ kind: 'cards' }] })
    expect(card({ limitBreaks: { '1': 5 } })).toMatch(/invalid cards data/)
    // Save v8 (D200): three-star cards under `bonds`, beside a v7 card from a client that has not updated.
    expect(parseSyncRequest({ upserts: [{ kind: 'profile', id: 'main', baseVersion: 3, data: { ...profile, schemaVersion: 8 } }] }))
      .toMatchObject({ upserts: [{ kind: 'profile', data: { schemaVersion: 8 } }] })
    expect(card({ bonds: { '1': 3, '2': 1 } })).toMatchObject({ upserts: [{ kind: 'cards', data: { bonds: { '1': 3 } } }] })
    expect(card({ bonds: { '1': 4 } })).toMatch(/invalid cards data/)
    const v8Card = { kind: 'cards' as const, id: 'c1', version: 2, data: { templateId: 'c1', bonds: { '1': 3 }, maxCouponGranted: true }, deleted: false, updatedAt: 1 }
    const olderCard = resolveUpserts(new Map([['cards/c1', v8Card as EntityRecord]]), [{ kind: 'cards', id: 'c1', baseVersion: 2, data: { templateId: 'c1', stars: { '1': 5 }, maxCouponGranted: true } }], 2)
    expect(olderCard.conflicts).toHaveLength(1)
    expect(olderCard.writes).toHaveLength(0)
    const newerCard = resolveUpserts(new Map([['cards/c1', { ...v8Card, data: { templateId: 'c1', stars: { '1': 5 }, maxCouponGranted: true } } as EntityRecord]]), [{ kind: 'cards', id: 'c1', baseVersion: 2, data: v8Card.data }], 2)
    expect(newerCard.writes).toHaveLength(1)
    // A current profile never gives way to an older one.
    const current = { kind: 'profile' as const, id: 'main', version: 4, data: profile, deleted: false, updatedAt: 1 }
    const stale = resolveUpserts(new Map([['profile/main', current as EntityRecord]]), [{ kind: 'profile', id: 'main', baseVersion: 4, data: { ...profile, schemaVersion: 6, tickets: 444 } }], 2)
    expect(stale.conflicts).toHaveLength(1)
    expect(stale.writes).toHaveLength(0)
  })

  it('accepts v2 profiles and never lets a v1 write replace v2', () => {
    const v2 = {
      schemaVersion: 2,
      tickets: 50,
      cardCoupons: 3,
      umaCoupons: 0,
      umaShards: 0,
      lastDailyGrant: null,
      featuredUmaId: null,
      starterSeedContentVersion: 'synthetic-v2',
      createdAt: 1,
    }
    expect(parseSyncRequest({ upserts: [{ kind: 'profile', id: 'main', baseVersion: 4, data: v2 }] })).toMatchObject({
      upserts: [{ kind: 'profile', id: 'main', data: { schemaVersion: 2 } }],
    })
    const current: EntityRecord = { kind: 'profile', id: 'main', version: 4, data: v2, deleted: false, updatedAt: 1 }
    const legacy = { ...v2, schemaVersion: 1 }
    const resolved = resolveUpserts(new Map([['profile/main', current]]), [
      { kind: 'profile', id: 'main', baseVersion: 4, data: legacy },
    ], 2)
    expect(resolved.writes).toEqual([])
    expect(resolved.conflicts).toEqual([current])
  })

  it('accepts v3 series goals and strict v4 modifiers, rejects malformed shapes, and prevents a downgrade', () => {
    const single = (slot: 'aptitude' | 'challenge', raceId: string) => ({
      id: `goal:1:${slot}`, slot, raceId, kind: slot === 'challenge' ? 'win-by-margin' : 'win', series: null,
      minimumMarginLengths: slot === 'challenge' ? 5 : 0, status: 'active', completedRaceResultId: null, completedAt: null,
    })
    const identity = {
      id: 'goal:1:identity', slot: 'identity', raceId: null, kind: 'win-series', minimumMarginLengths: 0,
      series: { tag: 'grand-prix', legs: [
        { key: 'first-leg', raceId: 'series-a', status: 'completed', completedRaceResultId: 'race:synthetic-uma:0', completedAt: 2 },
        { key: 'second-leg', raceId: 'series-b', status: 'active', completedRaceResultId: null, completedAt: null },
      ] },
      status: 'active', completedRaceResultId: null, completedAt: null,
    }
    const uma = {
      schemaVersion: 3, templateId: 'synthetic-uma', level: 1, exp: 0, trainingLevel: 1, trainingExp: 0,
      stats: { speed: 100, stamina: 100, power: 100, guts: 100, wit: 100 }, skillPoints: 0,
      aptitudes: { surface: { turf: 'A', dirt: 'G' }, distance: { sprint: 'B', mile: 'A', medium: 'A', long: 'C' }, strategy: { front: 'D', pace: 'A', late: 'B', end: 'C' } },
      deckCardIds: [], skillLibrary: [], loadoutSkillIds: [], trainingsThisScenario: 0, scenarioStarted: true,
      skillHistory: [], currentParents: [], parentSnapshot: null, goalPlanVersion: 2,
      scenarioJourneys: [{ tier: 1, tracking: 'tracked', state: 'active', completedAt: null, goals: [single('aptitude', 'single-a'), identity, single('challenge', 'single-c')] }],
    }
    expect(parseSyncRequest({ upserts: [{ kind: 'umas', id: 'synthetic-uma', baseVersion: 4, data: uma }] })).toMatchObject({
      upserts: [{ kind: 'umas', data: { schemaVersion: 3 } }],
    })
    const current = {
      ...uma,
      schemaVersion: 4,
      level: 11,
      goalPlanVersion: 0,
      scenarioJourneys: [],
      scenarioModifier: { version: 1, tier: 2, kind: 'team-spirit', bursts: 3 },
    }
    expect(parseSyncRequest({ upserts: [{ kind: 'umas', id: 'synthetic-uma', baseVersion: 4, data: current }] }))
      .toMatchObject({ upserts: [{ kind: 'umas', data: { schemaVersion: 4, scenarioModifier: { kind: 'team-spirit', bursts: 3 } } }] })
    expect(parseSyncRequest({ upserts: [{ kind: 'umas', id: 'synthetic-uma', baseVersion: 4, data: { ...current, scenarioModifier: { ...current.scenarioModifier, version: 2 } } }] }))
      .toMatch(/invalid umas data/)
    expect(parseSyncRequest({ upserts: [{ kind: 'umas', id: 'synthetic-uma', baseVersion: 4, data: { ...current, scenarioModifier: { version: 1, tier: 3, kind: 'climax', earned: 2, stock: 2, used: 1 } } }] }))
      .toMatch(/invalid umas data/)
    const modifierFor = (level: number, scenarioModifier: Record<string, unknown>) => ({ ...current, level, scenarioModifier })
    expect(parseSyncRequest({ upserts: [{ kind: 'umas', id: 'synthetic-uma', baseVersion: 4, data: modifierFor(31, { version: 1, tier: 4, kind: 'performances', notes: ['speed', 'power'], performances: 2 }) }] }))
      .toMatchObject({ upserts: [{ data: { scenarioModifier: { kind: 'performances' } } }] })
    expect(parseSyncRequest({ upserts: [{ kind: 'umas', id: 'synthetic-uma', baseVersion: 4, data: modifierFor(41, { version: 1, tier: 5, kind: 'goddess-fragments', fragments: 7, bursts: 1 }) }] }))
      .toMatchObject({ upserts: [{ data: { scenarioModifier: { kind: 'goddess-fragments' } } }] })
    expect(parseSyncRequest({ upserts: [{ kind: 'umas', id: 'synthetic-uma', baseVersion: 4, data: modifierFor(51, { version: 1, tier: 6, kind: 'expedition', stamps: 5, completed: 2, upgraded: 1 }) }] }))
      .toMatchObject({ upserts: [{ data: { scenarioModifier: { kind: 'expedition' } } }] })
    expect(parseSyncRequest({ upserts: [{ kind: 'umas', id: 'synthetic-uma', baseVersion: 4, data: modifierFor(31, { version: 1, tier: 4, kind: 'performances', notes: ['power', 'speed'], performances: 2 }) }] }))
      .toMatch(/invalid umas data/)
    const formerMaximum = {
      ...uma,
      level: 110,
      parentSnapshot: {
        umaId: 'synthetic-uma', charaId: 'synthetic-character', completedTier: 11, takenAt: 2,
        inheritedUniqueSkillId: null, inheritableWhiteSkillIds: [], aptitudes: uma.aptitudes, parents: [],
      },
      scenarioJourneys: [{ tier: 11, tracking: 'legacy-untracked', state: 'completed', completedAt: null, goals: [] }],
    }
    expect(parseSyncRequest({ upserts: [{ kind: 'umas', id: 'synthetic-uma', baseVersion: 4, data: formerMaximum }] }))
      .toMatchObject({ upserts: [{ kind: 'umas', data: { level: 110 } }] })
    expect(parseSyncRequest({ upserts: [{ kind: 'umas', id: 'synthetic-uma', baseVersion: 4, data: { ...uma, level: 140, exp: 0, goalPlanVersion: 0, scenarioJourneys: [] } }] }))
      .toMatchObject({ upserts: [{ kind: 'umas', data: { level: 140 } }] })
    expect(parseSyncRequest({ upserts: [{ kind: 'umas', id: 'synthetic-uma', baseVersion: 4, data: { ...uma, level: 141 } }] }))
      .toMatch(/invalid umas data/)
    expect(parseSyncRequest({ upserts: [{ kind: 'umas', id: 'synthetic-uma', baseVersion: 4, data: { ...uma, scenarioJourneys: [{ ...uma.scenarioJourneys[0], goals: [single('aptitude', 'series-a'), identity, single('challenge', 'single-c')] }] } }] })).toMatch(/invalid umas data/)
    const currentRecord: EntityRecord = { kind: 'umas', id: 'synthetic-uma', version: 4, data: current, deleted: false, updatedAt: 1 }
    const resolved = resolveUpserts(new Map([['umas/synthetic-uma', currentRecord]]), [
      { kind: 'umas', id: 'synthetic-uma', baseVersion: 4, data: { ...uma, schemaVersion: 2 } },
    ], 2)
    expect(resolved.writes).toEqual([])
    expect(resolved.conflicts).toEqual([currentRecord])
  })

  it('strictly validates progression race result appends', () => {
    const data = {
      contentVersion: 'abc123def456',
      umaId: 'u1',
      raceId: 'r1',
      sequence: 0,
      seed: 123,
      strategy: 'pace',
      startLevel: 1,
      startExp: 0,
      startStats: { speed: 100, stamina: 100, power: 100, guts: 100, wit: 100 },
      raceBonus: 0.03,
      playerPlacement: 1,
      expGained: 155,
      levelsGained: [2],
      ticketReward: 5,
      shardReward: 0,
      field: Array.from({ length: 8 }, (_, index) => ({
        umaId: index === 0 ? 'u1' : `u${index + 1}`,
        isPlayer: index === 0,
        strategy: 'pace',
        gate: index,
        stats: { speed: 100, stamina: 100, power: 100, guts: 100, wit: 100 },
        aptitude: { distance: 'A', surface: 'A', strategy: 'A' },
        placement: index + 1,
        finishTime: 100 + index,
        marginLengths: index === 0 ? 0 : 1,
      })),
      createdAt: 1,
    }
    expect(parseSyncRequest({ appends: [{ kind: 'raceResults', id: 'race:u1:0', data, createdAt: 1 }] })).toMatchObject({
      appends: [{ kind: 'raceResults', id: 'race:u1:0' }],
    })
    // A level paid five tickets before save v7 and one after (D148); a record keeps the reward of its day.
    expect(parseSyncRequest({ appends: [{ kind: 'raceResults', id: 'race:u1:0', data: { ...data, ticketReward: 1 }, createdAt: 1 }] }))
      .toMatchObject({ appends: [{ kind: 'raceResults', id: 'race:u1:0' }] })
    expect(parseSyncRequest({ appends: [{ kind: 'raceResults', id: 'race:u1:0', data: { ...data, ticketReward: 3 }, createdAt: 1 }] }))
      .toMatch(/invalid raceResults/)
    const v2 = {
      ...data,
      engineVersion: 2,
      course: { distance: 2_000, surface: 'turf', season: 1 },
      field: data.field.map((runner) => ({ ...runner, skills: [] })),
    }
    expect(parseSyncRequest({ appends: [{ kind: 'raceResults', id: 'race:u1:0', data: v2, createdAt: 1 }] })).toMatchObject({
      appends: [{ kind: 'raceResults', id: 'race:u1:0', data: { engineVersion: 2 } }],
    })
    const v3 = {
      ...v2,
      engineVersion: 3,
      course: {
        ...v2.course,
        layout: { corners: [{ start: 1_200, end: 1_600, number: 2 }], straights: [{ start: 0, end: 1_200 }, { start: 1_600, end: 2_000 }] },
      },
    }
    expect(parseSyncRequest({ appends: [{ kind: 'raceResults', id: 'race:u1:0', data: v3, createdAt: 1 }] })).toMatchObject({
      appends: [{ kind: 'raceResults', id: 'race:u1:0', data: { engineVersion: 3 } }],
    })
    // Engine v4 (the stamina contest, D135) records the same course shape as v3 and must sync.
    expect(parseSyncRequest({ appends: [{ kind: 'raceResults', id: 'race:u1:0', data: { ...v3, engineVersion: 4 }, createdAt: 1 }] })).toMatchObject({
      appends: [{ kind: 'raceResults', id: 'race:u1:0', data: { engineVersion: 4 } }],
    })
    expect(parseSyncRequest({ appends: [{ kind: 'raceResults', id: 'race:u1:0', data: { ...v3, engineVersion: 5 }, createdAt: 1 }] })).toMatch(/invalid raceResults data/)
    // Engines v6 (turns, D154) and v7 (D158) record v5's course: slopes, track and rotation.
    const v5Course = { ...v3.course, layout: { ...v3.course.layout, slopes: [] }, trackId: 10006, rotation: 1 }
    for (const engineVersion of [5, 6, 7]) {
      expect(parseSyncRequest({ appends: [{ kind: 'raceResults', id: 'race:u1:0', data: { ...v3, engineVersion, course: v5Course }, createdAt: 1 }] }))
        .toMatchObject({ appends: [{ kind: 'raceResults', id: 'race:u1:0', data: { engineVersion } }] })
    }
    // Engine v8 (D231) adds the race's grade code and each straight's front type; older engines' courses carry neither.
    const v8Course = {
      ...v5Course,
      layout: { ...v5Course.layout, straights: [{ start: 0, end: 1_200, frontType: 2 }, { start: 1_600, end: 2_000, frontType: 1 }] },
      grade: 100,
    }
    const append = (data: unknown) => parseSyncRequest({ appends: [{ kind: 'raceResults', id: 'race:u1:0', data, createdAt: 1 }] })
    expect(append({ ...v3, engineVersion: 8, course: v8Course })).toMatchObject({ appends: [{ data: { engineVersion: 8 } }] })
    expect(append({ ...v3, engineVersion: 8, course: v5Course })).toMatch(/invalid raceResults data/)
    expect(append({ ...v3, engineVersion: 7, course: v8Course })).toMatch(/invalid raceResults data/)
    expect(append({ ...v3, engineVersion: 8, course: { ...v8Course, layout: { ...v8Course.layout, straights: [{ start: 0, end: 2_000, frontType: 3 }] } } }))
      .toMatch(/invalid raceResults data/)
    expect(append({ ...v3, engineVersion: 9, course: v8Course })).toMatch(/invalid raceResults data/)
    const withGoals = { ...v3, completedGoalIds: ['goal:1:aptitude', 'goal:1:challenge'] }
    expect(parseSyncRequest({ appends: [{ kind: 'raceResults', id: 'race:u1:0', data: withGoals, createdAt: 1 }] })).toMatchObject({
      appends: [{ kind: 'raceResults', id: 'race:u1:0', data: { completedGoalIds: withGoals.completedGoalIds } }],
    })
    expect(parseSyncRequest({ appends: [{
      kind: 'raceResults', id: 'race:u1:0', data: { ...withGoals, completedGoalIds: ['goal:1:aptitude', 'goal:1:aptitude'] }, createdAt: 1,
    }] })).toMatch(/invalid raceResults data/)
    expect(parseSyncRequest({ appends: [{ kind: 'raceResults', id: 'race:u1:0', data: { ...data, ticketReward: 10 }, createdAt: 1 }] })).toMatch(/invalid raceResults data/)
    const accomplishmentFacts = {
      version: 1,
      familyId: 'synthetic-family',
      grade: 'g1',
      venueKey: 'synthetic-venue',
      venueTags: ['jra-main'],
      courseId: 'synthetic-course',
      surface: 'turf',
      distance: 2_000,
      distanceCategory: 'medium',
      series: ['spring-triple-crown', 'triple-crown'],
      playerStartDelay: 0.03,
      playerFinalSpurtPlacement: 2,
      ledEverySectionCheckpoint: true,
      inheritedUniqueActivated: false,
    }
    expect(parseSyncRequest({ appends: [{
      kind: 'raceResults', id: 'race:u1:0', data: { ...v3, accomplishmentFacts }, createdAt: 1,
    }] })).toMatchObject({ appends: [{ data: { accomplishmentFacts } }] })
    expect(parseSyncRequest({ appends: [{
      kind: 'raceResults', id: 'race:u1:0', data: { ...v3, accomplishmentFacts: { ...accomplishmentFacts, distanceCategory: 'long' } }, createdAt: 1,
    }] })).toMatch(/invalid raceResults data/)
    // A race run as one of her earlier scenarios names it and pays nothing (D190).
    const past = { ...data, tier: 1, startLevel: 15, expGained: 0, levelsGained: [], ticketReward: 0, shardReward: 0 }
    expect(parseSyncRequest({ appends: [{ kind: 'raceResults', id: 'race:u1:0', data: past, createdAt: 1 }] }))
      .toMatchObject({ appends: [{ data: { tier: 1 } }] })
    for (const bad of [{ ...past, tier: 2 }, { ...past, tier: 0 }, { ...past, expGained: 155 }, { ...past, completedGoalIds: ['goal:1:main:1'] }]) {
      expect(parseSyncRequest({ appends: [{ kind: 'raceResults', id: 'race:u1:0', data: bad, createdAt: 1 }] })).toMatch(/invalid raceResults data/)
    }
  })
})

describe('save v6 over the wire', () => {
  // Copied out of a real IndexedDB save, so a shape drift between the client and this validator fails here
  // rather than silently 400ing every sync (docs/decisions.md D121, D127).
  const uma = {
    schemaVersion: 6,
    templateId: '100101',
    level: 1,
    exp: 0,
    unlockedTier: 1,
    scenarios: [{
      tier: 1,
      trainingLevel: 1,
      trainingExp: 0,
      cardSetIds: [],
      assignments: {},
      loadoutSkillIds: [],
      journey: {
        tier: 1,
        tracking: 'tracked',
        state: 'active',
        completedAt: null,
        goals: [
          { id: 'goal:1:aptitude', slot: 'aptitude', raceId: '450701', kind: 'win', series: null, minimumMarginLengths: 0, status: 'active', completedRaceResultId: null, completedAt: null },
          { id: 'goal:1:identity', slot: 'identity', raceId: '701301', kind: 'win', series: null, minimumMarginLengths: 0, status: 'active', completedRaceResultId: null, completedAt: null },
          { id: 'goal:1:challenge', slot: 'challenge', raceId: '409401', kind: 'win-by-margin', series: null, minimumMarginLengths: 5, status: 'active', completedRaceResultId: null, completedAt: null },
        ],
      },
      started: true,
    }],
    skillHistory: [{ skillId: '100011', origin: 'own-unique', sourceId: '100101', tier: 1 }],
    goalPlanVersion: 2,
  }
  const card = { templateId: '30019', limitBreaks: {}, maxCouponGranted: false }
  const profile = {
    schemaVersion: 6, tickets: 349, cardCoupons: 2, umaCoupons: 0, umaShards: 0,
    lastDailyGrant: '2026-09-21', featuredUmaId: '100901', starterSeedContentVersion: 'e191151b5660', createdAt: 0,
  }

  it('accepts the rows a v6 client pushes on a fresh save', () => {
    expect(parseSyncRequest({ upserts: [
      { kind: 'umas', id: '100101', baseVersion: 3, data: uma },
      { kind: 'cards', id: '30019', baseVersion: 2, data: card },
      { kind: 'profile', id: 'main', baseVersion: 16, data: profile },
    ], appends: [] })).toMatchObject({ upserts: [{ kind: 'umas' }, { kind: 'cards' }, { kind: 'profile' }] })
  })

  it('accepts a second scenario with filled nodes and a per-scenario limit break', () => {
    const trained = {
      ...uma,
      level: 12,
      exp: 0,
      unlockedTier: 2,
      scenarios: [uma.scenarios[0]!, {
        tier: 2,
        trainingLevel: 6,
        trainingExp: 120,
        cardSetIds: ['30019', '30022'],
        assignments: {
          'card-1': { kind: 'card', cardId: '30019' },
          'stat-1': { kind: 'stat', stat: 'speed' },
          'parent-1': { kind: 'lineage', templateId: '100201' },
        },
        loadoutSkillIds: [],
        journey: null,
        started: true,
      }],
    }
    expect(parseSyncRequest({ upserts: [
      { kind: 'umas', id: '100101', baseVersion: 3, data: trained },
      { kind: 'cards', id: '30019', baseVersion: 2, data: { ...card, limitBreaks: { '2': 3 } } },
    ], appends: [] })).toMatchObject({ upserts: [{ kind: 'umas' }, { kind: 'cards' }] })
  })

  it('rejects a v6 row that contradicts the rules the client enforces', () => {
    expect(parseSyncRequest({ upserts: [{ kind: 'umas', id: '100101', baseVersion: 3, data: { ...uma, unlockedTier: 9 } }] }))
      .toMatch(/invalid umas data/)
    expect(parseSyncRequest({ upserts: [{ kind: 'umas', id: '100101', baseVersion: 3, data: { ...uma, scenarios: [{ ...uma.scenarios[0]!, tier: 4 }] } }] }))
      .toMatch(/invalid umas data/)
    expect(parseSyncRequest({ upserts: [{ kind: 'umas', id: '100101', baseVersion: 3, data: { ...uma, scenarios: [{ ...uma.scenarios[0]!, assignments: { 'card-1': { kind: 'card' } } }] } }] }))
      .toMatch(/invalid umas data/)
    expect(parseSyncRequest({ upserts: [{ kind: 'umas', id: '100101', baseVersion: 3, data: { ...uma, scenarios: [{ ...uma.scenarios[0]!, cardSetIds: ['1', '2', '3', '4', '5', '6', '7'] }] } }] }))
      .toMatch(/invalid umas data/)
    expect(parseSyncRequest({ upserts: [{ kind: 'cards', id: '30019', baseVersion: 2, data: { ...card, limitBreaks: { '2': 9 } } }] }))
      .toMatch(/invalid cards data/)
    expect(parseSyncRequest({ upserts: [{ kind: 'cards', id: '30019', baseVersion: 2, data: { ...card, limitBreaks: { '0': 2 } } }] }))
      .toMatch(/invalid cards data/)
  })

  it('accepts v9 Produce assignments while keeping the v8 wire shape migration-only', () => {
    const scenario = {
      ...uma.scenarios[0]!,
      assignments: {
        'stat-1': { kind: 'produce', itemId: 'produce:t1:speed', revision: 2 },
        'stat-2': { kind: 'legacy-produce', stat: 'stamina' },
      },
    }
    const v9 = { ...uma, schemaVersion: 9, scenarios: [scenario] }
    expect(parseSyncRequest({ upserts: [{ kind: 'umas', id: '100101', baseVersion: 3, data: v9 }] }))
      .toMatchObject({ upserts: [{ kind: 'umas', data: { schemaVersion: 9 } }] })
    expect(parseSyncRequest({ upserts: [{
      kind: 'umas', id: '100101', baseVersion: 3,
      data: { ...v9, scenarios: [{ ...scenario, assignments: { 'stat-1': { kind: 'stat', stat: 'speed' } } }] },
    }] })).toMatch(/invalid umas data/)
    expect(parseSyncRequest({ upserts: [{
      kind: 'umas', id: '100101', baseVersion: 3,
      data: { ...v9, scenarios: [{ ...scenario, assignments: { 'stat-1': { kind: 'produce', itemId: 'produce:t2:speed', revision: 1 } } }] },
    }] })).toMatch(/invalid umas data/)
    expect(parseSyncRequest({ upserts: [{
      kind: 'umas', id: '100101', baseVersion: 3,
      data: { ...uma, schemaVersion: 8, scenarios: [{ ...scenario, assignments: { 'stat-1': { kind: 'produce', itemId: 'produce:t1:speed', revision: 1 } } }] },
    }] })).toMatch(/invalid umas data/)
  })

  it('accepts v10 outfit race defaults and rejects malformed choices', () => {
    const current = { ...uma, schemaVersion: 10, racePreferences: { strategy: 'front', distance: 'long', surface: 'turf' } }
    const sync = (data: unknown) => parseSyncRequest({ upserts: [{ kind: 'umas', id: '100101', baseVersion: 3, data }] })
    expect(sync(current)).toMatchObject({ upserts: [{ kind: 'umas', data: current }] })
    expect(sync({ ...current, racePreferences: null })).toMatchObject({ upserts: [{ kind: 'umas' }] })
    expect(sync({ ...current, racePreferences: { ...current.racePreferences, strategy: 'random' } })).toMatch(/invalid umas data/)
    expect(sync({ ...current, racePreferences: { ...current.racePreferences, extra: true } })).toMatch(/invalid umas data/)
    const stored: EntityRecord = { kind: 'umas', id: '100101', version: 4, data: current, deleted: false, updatedAt: 1 }
    const older = resolveUpserts(new Map([['umas/100101', stored]]), [{
      kind: 'umas', id: '100101', baseVersion: 4, data: { ...uma, schemaVersion: 9 },
    }], 2)
    expect(older.writes).toEqual([])
    expect(older.conflicts).toEqual([stored])
  })

  it('accepts v11: linear Training Levels, the Training EXP bank and Level-Up Tickets (D211–D213)', () => {
    const v11 = { ...uma, schemaVersion: 11, racePreferences: null }
    const run = uma.scenarios[0]!
    const sync = (kind: string, data: unknown) => parseSyncRequest({ upserts: [{ kind, id: kind === 'profile' ? 'main' : '100101', baseVersion: 3, data }] })
    expect(sync('umas', { ...v11, scenarios: [{ ...run, trainingLevel: 7, trainingExp: 1249 }] })).toMatchObject({ upserts: [{ kind: 'umas' }] })
    expect(sync('umas', { ...v11, scenarios: [{ ...run, trainingLevel: 7, trainingExp: 1250 }] })).toMatch(/invalid umas data/)
    expect(sync('umas', { ...v11, scenarios: [{ ...run, trainingLevel: 10, trainingExp: 1 }] })).toMatch(/invalid umas data/)
    // A v10 row is still on the old curve, so it may hold more.
    expect(sync('umas', { ...v11, schemaVersion: 10, scenarios: [{ ...run, trainingLevel: 7, trainingExp: 3000 }] })).toMatchObject({ upserts: [{ kind: 'umas' }] })

    const v11Profile = { ...profile, schemaVersion: 11, trainingExpBank: 850 }
    expect(sync('profile', v11Profile)).toMatchObject({ upserts: [{ kind: 'profile' }] })
    // The migration may bank more than a level until startup settles it.
    expect(sync('profile', { ...v11Profile, trainingExpBank: 62_100 })).toMatchObject({ upserts: [{ kind: 'profile' }] })
    expect(sync('profile', { ...v11Profile, trainingExpBank: -1 })).toMatch(/invalid profile data/)
    expect(sync('profile', { ...profile, schemaVersion: 11 })).toMatch(/invalid profile data/)
    expect(sync('profile', { ...profile, schemaVersion: 10, trainingExpBank: 0 })).toMatch(/invalid profile data/)

    const ticket = 'training:level-up-ticket'
    const levelUp = { kind: 'level-up', umaId: '100101', tier: 1, fromLevel: 9, fromExp: 800 }
    const append = (data: Record<string, unknown>) => parseSyncRequest({ appends: [{ kind: 'itemLedger', id: data.id, data, createdAt: data.createdAt }] })
    for (const data of [
      { id: 'exp-bank:spark:1', itemId: ticket, delta: 1, reason: 'exp-bank', source: { kind: 'spark-run', runId: 'spark:1' }, createdAt: 5 },
      { id: 'exp-bank:settle:5', itemId: ticket, delta: 49, reason: 'exp-bank', source: { kind: 'bank-settle' }, createdAt: 5 },
      { id: 'level-up:100101:1:9.800', itemId: ticket, delta: -1, reason: 'training-level-up', source: levelUp, createdAt: 5 },
    ]) expect(append(data)).toMatchObject({ appends: [{ kind: 'itemLedger' }] })
    expect(append({ id: 'x', itemId: ticket, delta: 1, reason: 'training-level-up', source: levelUp, createdAt: 5 })).toMatch(/invalid itemLedger data/)
    expect(append({ id: 'x', itemId: ticket, delta: 1, reason: 'farm-harvest', source: levelUp, createdAt: 5 })).toMatch(/invalid itemLedger data/)
    expect(append({ id: 'x', itemId: 'produce:t1:speed', delta: 1, reason: 'exp-bank', source: { kind: 'bank-settle' }, createdAt: 5 })).toMatch(/invalid itemLedger data/)

    // A v10 row never replaces a v11 one.
    const stored: EntityRecord = { kind: 'umas', id: '100101', version: 4, data: v11, deleted: false, updatedAt: 1 }
    const older = resolveUpserts(new Map([['umas/100101', stored]]), [{
      kind: 'umas', id: '100101', baseVersion: 4, data: { ...v11, schemaVersion: 10 },
    }], 2)
    expect(older.writes).toEqual([])
  })

  it('accepts v12: each unit\'s Extra stats grid, no Produce in the tree, and unlock evidence (D235)', () => {
    const grid = { unlocked: { speed: 2, stamina: 4, power: 0, guts: 0, wit: 1 }, active: ['speed-1', 'stamina-1', 'stamina-2', 'stamina-3', 'stamina-4', 'wit-1'] }
    const run = { ...uma.scenarios[0]!, extraStats: grid }
    const v12 = { ...uma, schemaVersion: 12, racePreferences: null, scenarios: [run] }
    const sync = (kind: string, data: unknown) => parseSyncRequest({ upserts: [{ kind, id: kind === 'profile' ? 'main' : '100101', baseVersion: 3, data }] })
    expect(sync('umas', v12)).toMatchObject({ upserts: [{ kind: 'umas', data: { schemaVersion: 12 } }] })
    expect(sync('umas', { ...v12, scenarios: [{ ...run, extraStats: { ...grid, active: [...grid.active, 'speed-2'] } }] })).toMatch(/invalid umas data/)
    expect(sync('umas', { ...v12, scenarios: [{ ...run, extraStats: { ...grid, active: ['power-1'] } }] })).toMatch(/invalid umas data/)
    expect(sync('umas', { ...v12, scenarios: [{ ...run, extraStats: { ...grid, active: ['wit-1', 'speed-1'] } }] })).toMatch(/invalid umas data/)
    expect(sync('umas', { ...v12, scenarios: [{ ...run, extraStats: { ...grid, unlocked: { ...grid.unlocked, guts: 5 } } }] })).toMatch(/invalid umas data/)
    expect(sync('umas', { ...v12, scenarios: [uma.scenarios[0]!] })).toMatch(/invalid umas data/)
    expect(sync('umas', { ...v12, scenarios: [{ ...run, assignments: { 'n20': { kind: 'legacy-produce', stat: 'speed' } } }] })).toMatch(/invalid umas data/)
    // A v11 row may not carry a grid.
    expect(sync('umas', { ...v12, schemaVersion: 11 })).toMatch(/invalid umas data/)
    expect(sync('profile', { ...profile, schemaVersion: 12, trainingExpBank: 30 })).toMatchObject({ upserts: [{ kind: 'profile' }] })

    const append = (data: Record<string, unknown>) => parseSyncRequest({ appends: [{ kind: 'itemLedger', id: data.id, data, createdAt: data.createdAt }] })
    const unlock = { id: 'extra:100101:1:stamina-3', itemId: 'produce:t1:stamina', delta: -3, reason: 'extra-stat-unlock',
      source: { kind: 'extra-stat-unlock', umaId: '100101', tier: 1, nodeId: 'stamina-3' }, createdAt: 9 }
    expect(append(unlock)).toMatchObject({ appends: [{ kind: 'itemLedger' }] })
    expect(append({ ...unlock, delta: -1 })).toMatch(/invalid itemLedger data/)
    expect(append({ ...unlock, itemId: 'produce:t1:speed' })).toMatch(/invalid itemLedger data/)
    expect(append({ ...unlock, id: 'extra:100101:1:stamina-2' })).toMatch(/invalid itemLedger data/)

    // A v11 row never replaces a v12 one.
    const stored: EntityRecord = { kind: 'umas', id: '100101', version: 4, data: v12, deleted: false, updatedAt: 1 }
    const older = resolveUpserts(new Map([['umas/100101', stored]]), [{
      kind: 'umas', id: '100101', baseVersion: 4, data: { ...uma, schemaVersion: 11, racePreferences: null },
    }], 2)
    expect(older.writes).toEqual([])
  })

  it('never lets a v8 Uma replace a v9 Uma', () => {
    const v9 = {
      ...uma,
      schemaVersion: 9,
      scenarios: [{ ...uma.scenarios[0]!, assignments: { 'stat-1': { kind: 'produce', itemId: 'produce:t1:speed', revision: 1 } } }],
    }
    const current: EntityRecord = { kind: 'umas', id: '100101', version: 4, data: v9, deleted: false, updatedAt: 1 }
    const resolved = resolveUpserts(new Map([['umas/100101', current]]), [{
      kind: 'umas', id: '100101', baseVersion: 4, data: { ...uma, schemaVersion: 8 },
    }], 2)
    expect(resolved.writes).toEqual([])
    expect(resolved.conflicts).toEqual([current])
  })
})

describe('goal plan v3+ careers over the wire', () => {
  const goal = (id: string, slot: string, raceId: string | null, extra: Record<string, unknown> = {}) => ({
    id, slot, raceId, kind: 'win', series: null, minimumMarginLengths: 0, status: 'active', completedRaceResultId: null, completedAt: null, ...extra,
  })
  const legs = [
    { key: 'satsuki-sho', raceId: '101001', status: 'completed', completedRaceResultId: 'race:100101:4', completedAt: 40 },
    { key: 'tokyo-yushun', raceId: '101002', status: 'active', completedRaceResultId: null, completedAt: null },
    { key: 'kikuka-sho', raceId: '101003', status: 'active', completedRaceResultId: null, completedAt: null },
  ]
  const careerGoals = [
    goal('goal:1:maiden', 'maiden', '300101', { status: 'completed', completedRaceResultId: 'race:100101:0', completedAt: 10 }),
    goal('goal:1:trials:1', 'trials', '200101'),
    goal('goal:1:trials:2', 'trials', '200102'),
    goal('goal:1:main:1', 'main', null, { kind: 'win-series', series: { tag: 'triple-crown', legs } }),
  ]
  const uma = {
    schemaVersion: 6,
    templateId: '100101',
    level: 3,
    exp: 0,
    unlockedTier: 1,
    scenarios: [{
      tier: 1, trainingLevel: 1, trainingExp: 0, cardSetIds: [], assignments: {}, loadoutSkillIds: [], started: true,
      journey: { tier: 1, tracking: 'tracked', state: 'active', completedAt: null, goals: careerGoals },
    }],
    skillHistory: [],
    goalPlanVersion: 4,
  }
  const push = (goals: unknown[], over: Record<string, unknown> = {}) => parseSyncRequest({ upserts: [{
    kind: 'umas', id: '100101', baseVersion: 1,
    data: { ...uma, ...over, scenarios: [{ ...uma.scenarios[0]!, journey: { ...uma.scenarios[0]!.journey, goals } }] },
  }] })

  it('accepts a career with a set among its main goals', () => {
    expect(push(careerGoals)).toMatchObject({ upserts: [{ kind: 'umas' }] })
    expect(push([...careerGoals, goal('goal:1:main:2', 'main', '101009')])).toMatchObject({ upserts: [{ kind: 'umas' }] })
  })

  it('rejects stages out of order, wrong counts or ids, and a mix with the legacy slots', () => {
    const [maiden, trialA, trialB, main] = careerGoals
    expect(push(careerGoals, { goalPlanVersion: 5 })).toMatch(/invalid umas data/)
    expect(push([trialA, maiden, trialB, main])).toMatch(/invalid umas data/)
    expect(push([maiden, trialA, main])).toMatch(/invalid umas data/)
    expect(push([maiden, trialA, trialB])).toMatch(/invalid umas data/)
    expect(push([maiden, { ...trialA, id: 'goal:1:trials:2' }, trialB, main])).toMatch(/invalid umas data/)
    expect(push([maiden, trialA, trialB, main, { ...main, id: 'goal:1:main:2' }])).toMatch(/invalid umas data/)
    expect(push([maiden, trialA, trialB, goal('goal:1:identity', 'identity', '101009')])).toMatch(/invalid umas data/)
    expect(push([{ ...maiden, kind: 'win-series', raceId: null, series: { tag: 'triple-crown', legs } }, trialA, trialB, goal('goal:1:main:1', 'main', '101009')]))
      .toMatch(/invalid umas data/)
  })
})

describe('ledger vocabulary', () => {
  // The deploy cannot import the domain (D128), so the test reads its source: every reason the client can write must
  // sync. dev-grant shipped without this check and 400ed every batch that held one.
  const domainSave = readFileSync(resolve(__dirname, '../../../../packages/domain/src/save.ts'), 'utf8')
  const domainList = (name: string): string[] => {
    const body = domainSave.slice(domainSave.indexOf(`export const ${name} = [`)).split('] as const')[0]!
    return [...body.matchAll(/'([a-z-]+)'/g)].map((match) => match[1]!).sort()
  }

  it('matches the domain exactly', () => {
    expect(domainList('LEDGER_REASONS')).toContain('card-unlock')
    expect([...LEDGER_REASONS].sort()).toEqual(domainList('LEDGER_REASONS'))
    expect([...LEDGER_RESOURCES].sort()).toEqual(domainList('LEDGER_RESOURCES'))
  })

  it('bounds a scenario completion\'s goals as the domain does', () => {
    const domainBadges = readFileSync(resolve(__dirname, '../../../../packages/domain/src/badges.ts'), 'utf8')
    expect(Number(domainBadges.match(/export const MAX_COMPLETION_GOALS = (\d+)/)?.[1])).toBe(MAX_COMPLETION_GOALS)
  })

  it('accepts a ticket-bought card', () => {
    const data = { resource: 'tickets', delta: -30, reason: 'card-unlock', localDay: '2026-09-22', createdAt: 1 }
    expect(parseSyncRequest({ appends: [{ kind: 'ledger', id: 'card-unlock:30019', data, createdAt: 1 }] }))
      .toMatchObject({ appends: [{ data }] })
  })
})

describe('Firestore codec', () => {
  // A compiled skill condition, alternatives of clauses, is an array of arrays, which Firestore cannot store (D151).
  const raceRecord = {
    kind: 'raceResults' as const, id: 'race:u1:0', createdAt: 1,
    data: { field: [{ umaId: 'u1', skills: [{ groups: [{ condition: [[{ variable: 'phase', op: '>=', value: 2 }]] }] }] }] },
  }

  it('finds an array directly inside another array, however deep', () => {
    expect(hasNestedArray(raceRecord.data)).toBe(true)
    expect(hasNestedArray({ a: [1, { b: [2, 3] }], c: { d: [] } })).toBe(false)
    expect(hasNestedArray([[1]])).toBe(true)
  })

  it('stores such a record as JSON text and reads it back exactly', () => {
    const stored = toStored(raceRecord)
    expect(stored).not.toHaveProperty('data')
    expect(typeof stored.dataJson).toBe('string')
    expect(hasNestedArray(stored)).toBe(false)
    expect(fromStored(stored)).toEqual(raceRecord)
  })

  it('leaves every other record, and documents written before, as they are', () => {
    const ledger = { kind: 'ledger' as const, id: 'l1', createdAt: 1, data: { resource: 'tickets', delta: 10, reason: 'daily-grant', localDay: null, createdAt: 1 } }
    expect(toStored(ledger)).toEqual(ledger)
    expect(fromStored(ledger)).toEqual(ledger)
  })
})
