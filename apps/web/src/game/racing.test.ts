import 'fake-indexeddb/auto'
import { umaFixture, withRun } from './__fixtures__/save'
import {
  constellationTemplate,
  activeScenario,
  createCardSave,
  createPlayerProfile,
  createUmaSave,
  expToNextUmaLevel,
  parseRaceResultRecord,
  type ContentAtlas,
  type CourseTemplate,
  type RaceTemplate,
  type SkillTemplate,
  type SupportCardTemplate,
  type UmaTemplate,
  type UmaSave,
} from '@racer/domain'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import type { LoadedContent } from '../content/runtime'
import { db } from './db'
import {
  buildPreparedRace,
  completeMemoryRace,
  completePersistentRace,
  preparedRaceFromRecord,
  preparePersistentRace,
  simulatePreparedRace,
} from './racing'

const aptitudes = {
  surface: { turf: 'A', dirt: 'C' },
  distance: { sprint: 'B', mile: 'A', medium: 'A', long: 'C' },
  strategy: { front: 'B', pace: 'A', late: 'A', end: 'C' },
} as const

function uma(id: string, charaId = `chara-${id}`): UmaTemplate {
  return {
    id,
    charaId,
    name: `Synthetic ${id}`,
    outfit: null,
    jpRelease: '2000-01-01',
    globalRelease: null,
    starter: true,
    baseStats: { speed: 4_000, stamina: 4_000, power: 4_000, guts: 4_000, wit: 4_000 },
    growthRates: { speed: 0, stamina: 0, power: 0, guts: 0, wit: 0 },
    aptitudes,
    uniqueSkillId: null,
    awakeningSkillIds: [],
    realHorseSex: null,
    signatureRaceFamilyIds: [],
    imageSource: 'https://invalid.test/synthetic.png',
  }
}

const card: SupportCardTemplate = {
  id: 'c1',
  charaId: 'support-chara-1',
  charName: 'Synthetic Support',
  title: 'Synthetic Speed',
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

const race: RaceTemplate = {
  id: 'r1',
  familyId: '101',
  name: 'Synthetic Cup',
  grade: 'g1',
  surface: 'turf',
  distance: 2000,
  distanceCategory: 'medium',
  direction: 'left',
  venue: 'Test Track',
  venueKey: 'test-track',
  venueTags: [],
  series: [],
  seriesLegs: [],
  courseId: 'course-1',
  season: 1,
  fieldSize: 8,
}

const course: CourseTemplate = {
  id: 'course-1',
  trackId: 'track-1',
  distance: 3,
  terrain: 1,
  turn: 1,
  corners: [{ start: 700, end: 1_050, number: 1 }, { start: 1_350, end: 1_650, number: 2 }],
  straights: [{ start: 0, end: 700, frontType: 1 }, { start: 1_050, end: 1_350, frontType: 2 }, { start: 1_650, end: 2_000, frontType: 1 }],
  slopes: [],
}

const atlas: ContentAtlas = {
  schemaVersion: 1,
  kind: 'uma-icons',
  frameWidth: 128,
  frameHeight: 128,
  pages: [{ path: 'synthetic.webp', width: 128, height: 128 }],
  frames: { synthetic: { page: 0, x: 0, y: 0, width: 128, height: 128 } },
}

const baselineSkills: SkillTemplate[] = [
  ['synthetic-recovery', 9],
  ['synthetic-speed-a', 27],
  ['synthetic-speed-b', 27],
  ['synthetic-acceleration', 31],
].map(([id, type]) => ({
  id: String(id),
  kind: 'white',
  name: String(id),
  description: 'Synthetic race skill.',
  costSp: 100,
  iconId: null,
  activation: 0,
  inheritedSkillId: null,
  normalSkillId: null,
  conditions: [{
    precondition: null,
    condition: id === 'synthetic-speed-b' ? 'phase_random==2' : 'phase_random==1',
    baseTime: 20_000,
    cooldown: null,
    effects: [{ type: Number(type), value: 1_000 }],
  }],
}))

function content(umaCount = 10): LoadedContent {
  const umas = Array.from({ length: umaCount }, (_, index) => uma(`u${index + 1}`))
  // Alternate outfit must not create another opponent character.
  if (umaCount >= 10) umas.push(uma('u-alt', 'chara-u2'))
  return {
    manifest: { version: 'abc123def456', generatedAt: '2000-01-01T00:00:00.000Z', source: {}, files: [] },
    origin: 'network',
    umas: { items: umas, byId: new Map(umas.map((item) => [item.id, item])) },
    cards: { items: [card], byId: new Map([[card.id, card]]) },
    skills: { items: baselineSkills, byId: new Map(baselineSkills.map((item) => [item.id, item])) },
    races: { items: [race], byId: new Map([[race.id, race]]) },
    courses: { items: [course], byId: new Map([[course.id, course]]) },
    atlases: {
      'uma-icons': { descriptor: atlas, pageUrls: ['blob:synthetic'] },
      'card-icons': { descriptor: { ...atlas, kind: 'card-icons' }, pageUrls: ['blob:synthetic'] },
    },
    art: { has: () => false, load: async () => null },
  }
}

function state() {
  // Stats come from the constellation, so a strong racer is one with every node filled by a maxed card.
  const template = constellationTemplate(1)
  const assignments = Object.fromEntries(template.nodes
    .filter((node) => node.kind === 'card')
    .map((node) => [node.id, { kind: 'card', cardId: 'c1' } as const]))
  const player = umaFixture(uma('u1'), { goalPlanVersion: 0, cardSetIds: ['c1'], assignments })
  return {
    profile: createPlayerProfile('abc123def456', 42),
    player,
    cards: { c1: { ...createCardSave(card), limitBreaks: { '1': 1 } } },
  }
}

function withGoalJourney(player: UmaSave, tier: number): UmaSave {
  return {
    ...player,
    goalPlanVersion: 1,
    // A journey belongs to its own run, so the run moves to that tier with it.
    unlockedTier: tier,
    scenarios: player.scenarios.map((run) => (run.tier === player.unlockedTier ? { ...run, tier, journey: {
      tier, tracking: 'tracked' as const, state: 'active' as const, completedAt: null,
      goals: [
        { id: `goal:${tier}:aptitude`, slot: 'aptitude' as const, raceId: 'r1', kind: 'win' as const, series: null, minimumMarginLengths: 0, status: 'active' as const, completedRaceResultId: null, completedAt: null },
        { id: `goal:${tier}:identity`, slot: 'identity' as const, raceId: 'r2', kind: 'win' as const, series: null, minimumMarginLengths: 0, status: 'active' as const, completedRaceResultId: null, completedAt: null },
        { id: `goal:${tier}:challenge`, slot: 'challenge' as const, raceId: 'r3', kind: 'win-by-margin' as const, series: null, minimumMarginLengths: 5, status: 'active' as const, completedRaceResultId: null, completedAt: null },
      ],
    } } : run)),
  }
}

describe('progression race field', () => {
  it('is deterministic, uses the saved player, and never repeats a character', () => {
    const loaded = content()
    const { profile, player, cards } = state()
    const first = buildPreparedRace({ content: loaded, profile, uma: player, cardsById: cards, raceId: 'r1', strategy: 'pace', sequence: 0 })
    const second = buildPreparedRace({ content: loaded, profile, uma: player, cardsById: cards, raceId: 'r1', strategy: 'pace', sequence: 0 })
    expect(second).toEqual(first)
    expect(first.input.runners[first.playerIndex]).toMatchObject({ id: 'u1', strategy: 'pace' })
    expect(first.raceBonus).toBeCloseTo(0.033)
    const characters = first.runners.map((runner) => loaded.umas.byId.get(runner.templateId)!.charaId)
    expect(new Set(characters).size).toBe(characters.length)
  })

  it('races the affordable part of a loadout the scenario no longer pays SP for', () => {
    const hinted: SupportCardTemplate = { ...card, hintSkillIds: ['synthetic-speed-a'] }
    const loaded = { ...content(), cards: { items: [hinted], byId: new Map([[hinted.id, hinted]]) } }
    const { profile, player, cards } = state()
    // c1 is a Speed card, so it pays stats and no SP (D132), yet a 100 SP skill it taught is still equipped.
    const overdrawn = withRun(player, { loadoutSkillIds: ['synthetic-speed-a'] })
    const attempt = buildPreparedRace({ content: loaded, profile, uma: overdrawn, cardsById: cards, raceId: 'r1', strategy: 'pace', sequence: 0 })
    const skills = attempt.input.runners[attempt.playerIndex]!.skills?.map((skill) => skill.id) ?? []
    expect(skills).not.toContain('synthetic-speed-a')
  })

  it('rejects locked, gated, and undersized fields', () => {
    const loaded = content()
    const { profile, player, cards } = state()
    expect(() => buildPreparedRace({ content: loaded, profile, uma: withRun(player, { started: false }), cardsById: cards, raceId: 'r1', strategy: 'pace', sequence: 0 })).toThrow(/Start this scenario/)
    expect(() => buildPreparedRace({ content: loaded, profile, uma: { ...player, level: 10 }, cardsById: cards, raceId: 'r1', strategy: 'pace', sequence: 0 })).toThrow(/Advance this Uma/)
    expect(() => buildPreparedRace({ content: content(4), profile, uma: player, cardsById: cards, raceId: 'r1', strategy: 'pace', sequence: 0 })).toThrow(/distinct opponent/)
  })

  it('refuses a saved card whose refreshed era is later than the racing Uma tier', () => {
    const loaded = content()
    const moved = { ...card, era: 12 }
    const refreshed = { ...loaded, cards: { items: [moved], byId: new Map([[moved.id, moved]]) } }
    const { profile, player } = state()
    expect(() => buildPreparedRace({
      content: refreshed,
      profile,
      uma: { ...player, level: 101 },
      cardsById: { [moved.id]: createCardSave(moved) },
      raceId: 'r1',
      strategy: 'pace',
      sequence: 0,
    })).toThrow(`Support card ${moved.id} is Era locked until tier 12`)
  })

  it('resolves a memory-only result from the exact prepared attempt', () => {
    const loaded = content()
    const { profile, player, cards } = state()
    const attempt = buildPreparedRace({ content: loaded, profile, uma: player, cardsById: cards, raceId: 'r1', strategy: 'pace', sequence: 0 })
    const completion = completeMemoryRace(loaded, profile, player, cards, [], attempt, '2026-09-16', 100)
    expect(completion.record).toMatchObject({ umaId: 'u1', raceId: 'r1', sequence: 0, expGained: 155 })
    expect(parseRaceResultRecord(completion.record)).toEqual(completion.record)
    expect(completion.profile.tickets).toBe(5)
    const replay = preparedRaceFromRecord(loaded, completion.record)
    expect(replay.input.course).toEqual({ distance: 2_000, surface: 'turf', season: 1, layout: {
      corners: course.corners.map(({ start, end, number }) => ({ start, end, number })),
      straights: course.straights.map(({ start, end }) => ({ start, end })),
    } })
    expect(simulatePreparedRace(replay).results).toEqual(completion.timeline.results)

    const { engineVersion: _engineVersion, course: _course, ...legacyBody } = completion.record
    const legacy = {
      ...legacyBody,
      field: legacyBody.field.map(({ skills: _skills, ...runner }) => runner),
    }
    const legacyReplay = preparedRaceFromRecord(loaded, legacy)
    expect(legacyReplay.engineVersion).toBe(1)
    expect(simulatePreparedRace(legacyReplay).events.some((event) => event.type === 'skill-activated')).toBe(false)
  })

  it('snapshots authoritative goal completion ids in the same memory result', () => {
    const loaded = content()
    const { profile, player, cards } = state()
    const tracked = withGoalJourney(player, 1)
    const attempt = buildPreparedRace({ content: loaded, profile, uma: tracked, cardsById: cards, raceId: 'r1', strategy: 'pace', sequence: 0 })
    const completion = completeMemoryRace(loaded, profile, tracked, cards, [], attempt, '2026-09-16', 100)
    expect(completion.record.completedGoalIds).toEqual(['goal:1:aptitude'])
    expect(activeScenario(completion.uma).journey?.goals[0]).toMatchObject({ status: 'completed', completedRaceResultId: 'race:u1:0' })
  })

})

describe('persistent progression race', () => {
  beforeEach(async () => {
    db.close()
    await db.delete()
    await db.open()
    const { profile, player, cards } = state()
    await db.profile.put({ id: 'main', data: profile, version: 0 })
    await db.umas.put({ id: player.templateId, data: player, version: 0 })
    await db.cards.put({ id: 'c1', data: cards.c1!, version: 0 })
  })

  afterAll(async () => {
    db.close()
    await db.delete()
  })

  it('atomically writes progression, result, deterministic rewards, and outbox work once', async () => {
    const loaded = content()
    const preparation = await preparePersistentRace(loaded, 'u1', 'r1', 'pace')
    expect(preparation.status).toBe('prepared')
    if (preparation.status !== 'prepared') return
    const completion = await completePersistentRace(loaded, preparation.attempt, '2026-09-16', 100)
    expect(completion.record).toMatchObject({ expGained: 155, levelsGained: [2], ticketReward: 5, shardReward: 0 })
    expect((await db.profile.get('main'))?.data).toMatchObject({ tickets: 5, umaShards: 0 })
    expect((await db.umas.get('u1'))?.data).toMatchObject({ level: 2, exp: 55 })
    expect(await db.raceResults.count()).toBe(1)
    expect((await db.ledger.toArray()).map((row) => row.id)).toEqual(['uma-level-tickets:u1:2'])
    const outbox = (await db.outbox.toArray()).map((row) => `${row.kind}/${row.id}`)
    expect(outbox).toEqual(expect.arrayContaining([
      'badges/uma:u1',
      'ledger/uma-level-tickets:u1:2',
      'profile/main',
      'raceResults/race:u1:0',
      'umas/u1',
    ]))
    expect(completion.record.earnedFlairEventIds).toHaveLength(await db.flairEvents.count())
    expect(outbox.filter((id) => id.startsWith('flairEvents/'))).toHaveLength(completion.record.earnedFlairEventIds?.length ?? 0)

    const retry = await completePersistentRace(loaded, preparation.attempt, '2026-09-16', 101)
    expect(retry.alreadyRecorded).toBe(true)
    expect(retry.record.earnedFlairEventIds).toEqual(completion.record.earnedFlairEventIds)
    expect(retry.record.completedGoalIds).toEqual([])
    expect((await db.profile.get('main'))?.data).toMatchObject({ tickets: 5 })
    expect(await db.raceResults.count()).toBe(1)
    expect(await db.ledger.count()).toBe(1)

    await expect(completePersistentRace(
      loaded,
      { ...preparation.attempt, contentVersion: 'changed-content' },
      '2026-09-16',
      102,
    )).rejects.toThrow(/collision/)
  })

  it('rejects a stale attempt with no partial result or reward writes', async () => {
    const loaded = content()
    const preparation = await preparePersistentRace(loaded, 'u1', 'r1', 'pace')
    if (preparation.status !== 'prepared') throw new Error('Expected a prepared race')
    const row = await db.umas.get('u1')
    await db.umas.put({ ...row!, data: { ...row!.data, exp: 1 } })
    await expect(completePersistentRace(loaded, preparation.attempt, '2026-09-16', 100)).rejects.toThrow(/stale/)
    expect(await db.raceResults.count()).toBe(0)
    expect(await db.ledger.count()).toBe(0)
    expect(await db.outbox.count()).toBe(0)
  })

  it('persists the level-10 gate reward and one ledger entry per resource', async () => {
    const loaded = content()
    const row = await db.umas.get('u1')
    await db.umas.put({
      ...row!,
      data: { ...row!.data, level: 9, exp: expToNextUmaLevel(9) - 1 },
    })

    const preparation = await preparePersistentRace(loaded, 'u1', 'r1', 'pace')
    if (preparation.status !== 'prepared') throw new Error('Expected a prepared race')
    const completion = await completePersistentRace(loaded, preparation.attempt, '2026-09-16', 100)

    expect(completion.record).toMatchObject({
      playerPlacement: 1,
      levelsGained: [10],
      ticketReward: 5,
      shardReward: 1,
    })
    expect((await db.profile.get('main'))?.data).toMatchObject({ tickets: 5, umaShards: 1 })
    expect((await db.umas.get('u1'))?.data).toMatchObject({ level: 10, exp: 154 })
    expect((await db.ledger.toArray()).map((entry) => entry.id).sort()).toEqual([
      'uma-gate-shard:u1:10',
      'uma-level-tickets:u1:10',
    ])
    expect((await db.outbox.toArray()).map((entry) => `${entry.kind}/${entry.id}`)).toEqual(expect.arrayContaining([
      'badges/uma:u1',
      'ledger/uma-gate-shard:u1:10',
      'ledger/uma-level-tickets:u1:10',
      'profile/main',
      'raceResults/race:u1:0',
      'umas/u1',
    ]))
    expect(completion.record.earnedFlairEventIds).toHaveLength(await db.flairEvents.count())
  })

  it('captures the tier-14 snapshot in the max-level race transaction', async () => {
    const loaded = content()
    const row = await db.umas.get('u1')
    await db.umas.put({
      ...row!,
      data: {
        ...withGoalJourney(row!.data, 14),
        level: 139,
        exp: expToNextUmaLevel(139) - 1,
      },
    })
    const preparation = await preparePersistentRace(loaded, 'u1', 'r1', 'pace')
    if (preparation.status !== 'prepared') throw new Error('Expected a prepared race')
    const completion = await completePersistentRace(loaded, preparation.attempt, '2026-09-16', 100)
    // There is no tier beyond 14 to unlock, so the final race just closes that run's journey.
    expect(completion.uma).toMatchObject({ level: 140, unlockedTier: 14 })
    expect(activeScenario(completion.uma).journey?.state).toBe('completed')
    expect(completion.record.playerPlacement).toBe(1)
    expect(completion.record.completedGoalIds).toEqual(['goal:14:aptitude'])
    expect(activeScenario(completion.uma).journey).toMatchObject({ state: 'completed', completedAt: 100 })
    expect(activeScenario(completion.uma).journey?.goals.map((goal) => goal.status)).toEqual(['completed', 'missed', 'missed'])
    const retry = await completePersistentRace(loaded, preparation.attempt, '2026-09-16', 200)
    // Retrying the final race is idempotent: the journey stays closed at its original time.
    expect(activeScenario(retry.uma).journey?.completedAt).toBe(100)
  })
})
