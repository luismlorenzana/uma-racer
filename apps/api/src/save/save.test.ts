import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { LocalSaveRepository } from './local-save.repository'
import { MAX_SYNC_OPERATIONS, parseSyncRequest, resolveUpserts, type EntityRecord } from './save.types'

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
    await expect(repo.sync('u1', { upserts: [], appends: [{ ...append, data: { placement: 2 } }] })).rejects.toThrow(/id collision/)
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
      upserts: [{ kind: 'badges', id: 'trainer', baseVersion: 0, data: { ...trainer, aggregates: [{ key: 'wins', count: -1 }] } }],
    })).toMatch(/invalid badges data/)
    expect(parseSyncRequest({
      appends: [{ kind: 'flairEvents', id: 'flair:synthetic', data: flair, createdAt: 6 }],
    })).toMatch(/timestamp/)
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
  })
})
