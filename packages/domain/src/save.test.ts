import { subject } from './__fixtures__/subject'
import { MAX_STARS } from './cards'
import { constellationTemplate, starNodePct } from './constellation'
import { describe, expect, it } from 'vitest'
import type { SupportCardTemplate, UmaTemplate } from './content'
import { createUmaBadgeState } from './badges'
import { deriveUma } from './derived'
import {
  createCardSave,
  SAVE_SCHEMA_VERSION,
  migratePlayerProfileToCurrent,
  migrateCardSaveToCurrent,
  migrateUmaSaveToCurrent,
  applyDailyGrants,
  createInitialSave,
  createPlayerProfile,
  createUmaSave,
  migratePlayerProfileV1,
  migratePlayerProfileV2,
  migratePlayerProfileV3,
  migrateCardSaveV5,
  fiveStarToThree,
  limitBreakToStars,
  migrateUmaSaveV4,
  parseCardSave,
  parsePlayerProfile,
  parsePlayerProfileOrThrow,
  parseSaveSnapshot,
  parseSaveSnapshotOrThrow,
  parseSyncRequest,
  parseUmaSave,
  parseUmaSaveOrThrow,
  type UmaSave,
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
    expect(result.profile).toMatchObject({ tickets: 15, cardCoupons: 3, featuredUmaId: 'u00', starterSeedContentVersion: 'abc123' })
    expect(result.ledger.map((item) => item.id)).toEqual(['initial-card-coupons', 'daily-tickets:2026-03-08'])

    // A new Uma starts with one scenario at tier 1 and nothing configured in it.
    expect(result.umas[0]!.unlockedTier).toBe(1)
    expect(result.umas[0]!.scenarios).toEqual([{
      tier: 1, trainingLevel: 1, trainingExp: 0, cardSetIds: [], assignments: {},
      loadoutSkillIds: [], journey: null, started: false,
    }])
  })

  it('requires exactly 25 launch starters', () => {
    expect(() => createInitialSave([uma('one')], [], 'v1', '2026-01-01', 1)).toThrow(/exactly 25/)
  })

  it('records the unique in skill history; the library itself is derived', () => {
    expect(createUmaSave(uma('u1'))).toMatchObject({
      skillHistory: [{ skillId: 'skill-u1', origin: 'own-unique', sourceId: 'u1', tier: 1 }],
    })
  })

  it('rejects malformed content before constructing a save', () => {
    const malformed = { ...uma('bad'), baseStats: { ...uma('bad').baseStats, speed: -1 } }
    expect(() => createUmaSave(malformed)).toThrow(/invalid save initialization data/)
  })
})

describe('daily grants', () => {
  it('handles missed calendar days, DST-shaped dates, and the cap', () => {
    const profile = { ...createPlayerProfile('v1', 1), tickets: 36, lastDailyGrant: '2026-03-07' }
    const result = applyDailyGrants(profile, '2026-03-10', 2)
    expect(result.profile.tickets).toBe(60)
    expect(result.profile.lastDailyGrant).toBe('2026-03-10')
    expect(result.ledger.map((item) => [item.id, item.data.delta])).toEqual([
      ['daily-tickets:2026-03-08', 15],
      ['daily-tickets:2026-03-09', 9],
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
    const run = save.scenarios[0]!
    expect(parseUmaSave({ ...save, scenarios: [{ ...run, trainingLevel: 11 }] })).toBeNull()
    expect(parseUmaSave({ ...save, scenarios: [{ ...run, cardSetIds: ['c1', 'c1'] }] })).toBeNull()
    expect(parseUmaSave({ ...save, scenarios: [{ ...run, cardSetIds: ['a', 'b', 'c', 'd', 'e', 'f', 'g'] }] })).toBeNull()
    // The active scenario must exist, and no run may sit above it.
    expect(parseUmaSave({ ...save, unlockedTier: 2 })).toBeNull()
    expect(parseUmaSave({ ...save, scenarios: [] })).toBeNull()
    expect(parseUmaSave({ ...save, scenarios: [run, run] })).toBeNull()
    expect(parseCardSave({ templateId: 'c1', bonds: { '1': 4 }, maxCouponGranted: false })).toBeNull()
    // A v6 card, on the limit-break scale, and a v7 card, on five stars, are not v8 cards (D200).
    expect(parseCardSave({ templateId: 'c1', limitBreaks: { '1': 2 }, maxCouponGranted: false })).toBeNull()
    expect(parseCardSave({ templateId: 'c1', stars: { '1': 2 }, maxCouponGranted: false })).toBeNull()
    expect(parseCardSave({ templateId: 'c1', bonds: { '0': 2 }, maxCouponGranted: false })).toBeNull()
    expect(parseCardSave({ templateId: 'c1', bonds: { '99': 2 }, maxCouponGranted: false })).toBeNull()
    expect(parseCardSave({ templateId: 'c1', bonds: { '1': 2, '3': 3 }, maxCouponGranted: false }))
      .toEqual({ templateId: 'c1', bonds: { '1': 2, '3': 3 }, maxCouponGranted: false })
    // A zero is the default, so it never needs storing.
    expect(parseCardSave({ templateId: 'c1', bonds: { '2': 0 }, maxCouponGranted: false }))
      .toEqual({ templateId: 'c1', bonds: {}, maxCouponGranted: false })
    // v5 held one break with no scenario; it becomes tier 1's, then v7 stars (LB3 → 4★), then three stars (4★ → 3★).
    expect(migrateCardSaveV5({ templateId: 'c1', limitBreak: 3, maxCouponGranted: false }))
      .toEqual({ templateId: 'c1', bonds: { '1': 3 }, maxCouponGranted: false })
    expect(parsePlayerProfile({ ...createPlayerProfile('v1', 1), schemaVersion: 11 })).toBeNull()
    expect(() => parsePlayerProfileOrThrow({ ...createPlayerProfile('v1', 1), schemaVersion: 11 })).toThrow(/App update required/)
  })

  it('migrates v1 profiles and Umas into current defaults and preserves every v2 goal fact', () => {
    // Every older profile passes through v6 → v7 once, so its tickets are re-denominated exactly once (D148).
    const profileV1 = { ...createPlayerProfile('v1', 1), schemaVersion: 1 as const, tickets: 77 }
    expect(migratePlayerProfileV1(profileV1)).toEqual({ ...profileV1, schemaVersion: SAVE_SCHEMA_VERSION, tickets: 16 })
    const profileV2 = { ...profileV1, schemaVersion: 2 as const }
    expect(migratePlayerProfileV2(profileV2)).toEqual({ ...profileV2, schemaVersion: SAVE_SCHEMA_VERSION, tickets: 16 })
    const profileV3 = { ...profileV1, schemaVersion: 3 as const }
    expect(migratePlayerProfileV3(profileV3)).toEqual({ ...profileV3, schemaVersion: SAVE_SCHEMA_VERSION, tickets: 16 })
    // v4 is the last shape with a flat run; v5 turns it into one ScenarioTraining at her current tier.
    const legacyV4 = {
      schemaVersion: 4 as const,
      templateId: 'u1',
      level: 12,
      exp: 0,
      trainingLevel: 7,
      trainingExp: 40,
      stats: { speed: 900, stamina: 800, power: 700, guts: 600, wit: 500 },
      skillPoints: 250,
      aptitudes: uma('u1').aptitudes,
      deckCardIds: ['c1', 'c2'],
      skillLibrary: [{ skillId: 'skill-u1', origin: 'own-unique' as const, sourceId: 'u1' }],
      loadoutSkillIds: [],
      trainingsThisScenario: 11,
      scenarioStarted: true,
      skillHistory: [{ skillId: 'skill-u1', origin: 'own-unique' as const, sourceId: 'u1', tier: 2 }],
      currentParents: [],
      parentSnapshot: null,
      goalPlanVersion: 0,
      scenarioJourneys: [{
        tier: 1, tracking: 'legacy-untracked' as const, state: 'completed' as const, completedAt: null, goals: [],
      }],
      scenarioModifier: null,
    }

    const migratedV4 = migrateUmaSaveV4(legacyV4)
    expect(migratedV4).toMatchObject({ schemaVersion: SAVE_SCHEMA_VERSION, level: 12, unlockedTier: 2, goalPlanVersion: 0 })
    expect(migratedV4.scenarios).toEqual([{
      tier: 2,
      trainingLevel: 7,
      trainingExp: 40,
      cardSetIds: ['c1', 'c2'],
      // Stored stats are discarded: no configuration reproduces them, and inventing one would be a lie.
      assignments: {},
      loadoutSkillIds: [],
      // Only the current tier's journey carries over; earlier tiers were never recorded per scenario.
      journey: null,
      started: true,
    }])
    expect(parseUmaSave(migratedV4)).toEqual(migratedV4)

    // Parents and modifier state are dropped outright rather than approximated.
    expect(JSON.stringify(migratedV4)).not.toContain('parentSnapshot')
    expect(JSON.stringify(migratedV4)).not.toContain('scenarioModifier')

    // A v4 save whose modifier blob is unreadable still migrates: the blob is discarded either way.
    expect(migrateUmaSaveV4({ ...legacyV4, scenarioModifier: { nonsense: true } as never })).toEqual(migratedV4)

  })

  it('strictly rejects duplicate histories and malformed scenario runs', () => {
    const save = createUmaSave(uma('u1'))
    const run = save.scenarios[0]!
    expect(parseUmaSave({ ...save, skillHistory: [...save.skillHistory, ...save.skillHistory] })).toBeNull()
    const realNodeId = constellationTemplate(1).nodes.find((node) => node.kind === 'card')!.id
    const produceNodeId = constellationTemplate(1).nodes.find((node) => node.kind === 'stat')!.id
    expect(parseUmaSave({ ...save, scenarios: [{ ...run, assignments: { [realNodeId]: { kind: 'nonsense' } } }] })).toBeNull()
    expect(parseUmaSave({ ...save, scenarios: [{ ...run, assignments: { [realNodeId]: { kind: 'stat', stat: 'nope' } } }] })).toBeNull()
    expect(parseUmaSave({ ...save, scenarios: [{ ...run, assignments: { [produceNodeId]: { kind: 'legacy-produce', stat: 'speed' } } }] })).not.toBeNull()
    expect(parseUmaSave({ ...save, scenarios: [{ ...run, assignments: { [produceNodeId]: { kind: 'produce', itemId: 'produce:t1:speed', revision: 1 } } }] })).not.toBeNull()
    expect(parseUmaSave({ ...save, scenarios: [{ ...run, assignments: { [produceNodeId]: { kind: 'produce', itemId: 'produce:t2:speed', revision: 1 } } }] })).toBeNull()
    // A journey must belong to the run that holds it.
    expect(parseUmaSave({ ...save, scenarios: [{ ...run, journey: {
      tier: 2, tracking: 'tracked', state: 'active', completedAt: null, goals: [],
    } }] })).toBeNull()
    // An assignment naming a node this template does not have is dropped rather than fatal.
    const stale = parseUmaSave({ ...save, scenarios: [{ ...run, assignments: { 'no-such-node': { kind: 'stat', stat: 'speed' } } }] })
    expect(stale?.scenarios[0]?.assignments).toEqual({})
  })

  it('strictly validates single and series goal shapes and distinct frozen targets', () => {
    const created = createUmaSave(uma('u1'))
    const withJourney = (j: unknown) => ({
      ...created,
      scenarios: [{ ...created.scenarios[0]!, started: true, journey: j }],
    })
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
    expect(parseUmaSave(withJourney(journey))).not.toBeNull()
    expect(parseUmaSave(withJourney({ ...journey, goals: [{ ...journey.goals[0], series: identity.series }, identity, journey.goals[2]] }))).toBeNull()
    expect(parseUmaSave(withJourney({ ...journey, goals: [journey.goals[0], { ...identity, raceId: 'series-a' }, journey.goals[2]] }))).toBeNull()
    expect(parseUmaSave(withJourney({ ...journey, goals: [journey.goals[0], { ...identity, series: { ...identity.series, legs: [identity.series.legs[0]!] } }, journey.goals[2]] }))).toBeNull()
    expect(parseUmaSave(withJourney({ ...journey, goals: [journey.goals[0], { ...identity, series: { ...identity.series, legs: [identity.series.legs[0]!, { ...identity.series.legs[1]!, key: 'first-leg' }] } }, journey.goals[2]] }))).toBeNull()
    expect(parseUmaSave(withJourney({ ...journey, goals: [journey.goals[0], { ...identity, series: { ...identity.series, legs: [identity.series.legs[0]!, { ...identity.series.legs[1]!, raceId: 'series-a' }] } }, journey.goals[2]] }))).toBeNull()
    expect(parseUmaSave(withJourney({ ...journey, goals: [single('aptitude', 'series-a'), identity, journey.goals[2]] }))).toBeNull()
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
      entities: [{ ...duplicate, data: { ...profile, schemaVersion: 11 } }],
      logs: [],
      serverTime: 1,
    })).toThrow(/App update required/)
  })

  it('strictly validates independent badge entities and flair logs', () => {
    const state = createUmaBadgeState(createUmaSave(uma('u1')), subject(), 10)
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

describe('the migration chain', () => {
  const template = uma('u1')

  const v5Uma = () => {
    const current = createUmaSave(template)
    return { ...current, schemaVersion: 5 as const }
  }
  const v5Card = { templateId: 'c1', limitBreak: 3, maxCouponGranted: false }

  it('reads a v5 Uma, which is what broke after the card schema bump', () => {
    const migrated = migrateUmaSaveToCurrent(v5Uma())
    expect(migrated).not.toBeNull()
    expect(migrated!.schemaVersion).toBe(SAVE_SCHEMA_VERSION)
    expect(migrated!.unlockedTier).toBe(1)
  })

  it('reads a v5 card and puts its break on tier 1, as stars', () => {
    expect(migrateCardSaveToCurrent(v5Card))
      .toEqual({ templateId: 'c1', bonds: { '1': 3 }, maxCouponGranted: false })
  })

  it('turns v6 limit breaks into v7 stars at ceil(1.25 × LB), then three stars, so no card loses value (D147, D200)', () => {
    const v6 = { templateId: 'c1', limitBreaks: { '1': 1, '2': 2, '3': 3, '4': 4 }, maxCouponGranted: true }
    // LB1–LB4 were 2★–5★ in v7, and are 2★, 2★, 3★, 3★ now.
    expect(migrateCardSaveToCurrent(v6)).toEqual({ templateId: 'c1', bonds: { '1': 2, '2': 2, '3': 3, '4': 3 }, maxCouponGranted: true })
    expect(limitBreakToStars(4)).toBe(5)
    // A card above the old ceiling was never a valid v6 card.
    expect(migrateCardSaveToCurrent({ ...v6, limitBreaks: { '1': 5 } })).toBeNull()
    // Already three stars: a second pass changes nothing.
    const once = migrateCardSaveToCurrent(v6)!
    expect(migrateCardSaveToCurrent(once)).toEqual(once)
  })

  it('maps v7 stars to three at ⌈3s / 5⌉, keeping every node percent and making 4★ max (D200)', () => {
    const v7 = { templateId: 'c1', stars: { '1': 1, '2': 2, '3': 3, '4': 4, '5': 5 }, maxCouponGranted: false }
    expect(migrateCardSaveToCurrent(v7)).toEqual({ templateId: 'c1', bonds: { '1': 1, '2': 2, '3': 2, '4': 3, '5': 3 }, maxCouponGranted: false })
    // The old curve paid 60 + 8 × stars; nobody pays less on the new one.
    for (const stars of [0, 1, 2, 3, 4, 5]) expect(starNodePct(fiveStarToThree(stars))).toBeGreaterThanOrEqual(60 + 8 * stars)
    expect(fiveStarToThree(5)).toBe(MAX_STARS)
    expect(migrateCardSaveToCurrent({ ...v7, stars: { '1': 6 } })).toBeNull()
  })

  it('re-denominates a v6 profile once and stamps v6 Umas as current', () => {
    const v6Profile = { ...createPlayerProfile('v1', 1), schemaVersion: 6 as const, tickets: 444 }
    const migrated = migratePlayerProfileToCurrent(v6Profile)!
    expect(migrated).toMatchObject({ schemaVersion: SAVE_SCHEMA_VERSION, tickets: 89 })
    expect(migratePlayerProfileToCurrent(migrated)).toEqual(migrated)
    const v6Uma = { ...v5Uma(), schemaVersion: 6 as const }
    expect(migrateUmaSaveToCurrent(v6Uma)).toEqual({ ...v6Uma, schemaVersion: SAVE_SCHEMA_VERSION, racePreferences: null })
  })

  it('migrates every filled v8 Stat assignment to legacy Produce without inventing item progress', () => {
    const current = createUmaSave(template)
    const nodes = constellationTemplate(1).nodes.filter((node) => node.kind === 'stat')
    const legacy = {
      ...current,
      schemaVersion: 8 as const,
      scenarios: [{
        ...current.scenarios[0]!,
        assignments: {
          [nodes[0]!.id]: { kind: 'stat', stat: 'speed' },
          [nodes[1]!.id]: { kind: 'stat', stat: 'stamina' },
          'retired-template-node': { kind: 'retired-shape' },
        },
      }],
    }
    const migrated = migrateUmaSaveToCurrent(legacy)
    expect(migrated?.scenarios[0]?.assignments).toEqual({
      [nodes[0]!.id]: { kind: 'legacy-produce', stat: 'speed' },
      [nodes[1]!.id]: { kind: 'legacy-produce', stat: 'stamina' },
    })
    expect(JSON.stringify(migrated)).not.toContain('itemId')
    const expected = {
      ...current,
      scenarios: [{
        ...current.scenarios[0]!,
        assignments: {
          [nodes[0]!.id]: { kind: 'legacy-produce' as const, stat: 'speed' as const },
          [nodes[1]!.id]: { kind: 'legacy-produce' as const, stat: 'stamina' as const },
        },
      }],
    }
    const derive = (save: UmaSave) => deriveUma({
      uma: save,
      umaTemplate: template,
      cardSaves: new Map(),
      cardTemplates: new Map(),
      umaTemplates: new Map([[template.id, template]]),
      skillTemplates: new Map(),
    })
    // The full derived projection pins stats, SP, aptitudes, skill library/loadout and every other racing input.
    expect(derive(migrated!)).toEqual(derive(expected))
  })

  it('reads every supported profile schema', () => {
    const current = createPlayerProfile('v1', 1)
    for (const schemaVersion of [1, 2, 3, 4, 5, 6, 7, 8, 9] as const) {
      const migrated = migratePlayerProfileToCurrent({ ...current, schemaVersion })
      expect(migrated?.schemaVersion).toBe(SAVE_SCHEMA_VERSION)
    }
    expect(migratePlayerProfileToCurrent(current)?.schemaVersion).toBe(SAVE_SCHEMA_VERSION)
  })

  it('is idempotent on an already-current save', () => {
    const current = createUmaSave(template)
    expect(migrateUmaSaveToCurrent(current)).toEqual(current)
    const cardSave = createCardSave(card('c1'))
    expect(migrateCardSaveToCurrent(cardSave)).toEqual(cardSave)
  })

  it('adds nullable race preferences to v9 without changing a frozen journey', () => {
    const current = createUmaSave(template)
    const journey = { tier: 1, tracking: 'legacy-untracked' as const, state: 'completed' as const, completedAt: 7, goals: [] }
    const { racePreferences: _unused, ...v9 } = { ...current, scenarios: [{ ...current.scenarios[0]!, started: true, journey }] }
    const migrated = migrateUmaSaveToCurrent({ ...v9, schemaVersion: 9 })
    expect(migrated).toMatchObject({ schemaVersion: 10, racePreferences: null, scenarios: [{ journey }] })
    expect(parseUmaSave({ ...migrated!, racePreferences: { strategy: 'front', distance: 'long', surface: 'turf' } })).not.toBeNull()
    expect(parseUmaSave({ ...migrated!, racePreferences: { strategy: 'wrong', distance: 'long', surface: 'turf' } })).toBeNull()
  })

  it('returns null for something that is not a save, rather than inventing one', () => {
    expect(migrateUmaSaveToCurrent({ nonsense: true })).toBeNull()
    expect(migrateCardSaveToCurrent(null)).toBeNull()
    expect(migratePlayerProfileToCurrent('nope')).toBeNull()
  })

  it('accepts a v5 cloud snapshot instead of demanding an app update', () => {
    const profile = { ...createPlayerProfile('v1', 1), schemaVersion: 5 as const }
    expect(() => parseSaveSnapshotOrThrow({
      entities: [
        { kind: 'profile', id: 'main', version: 1, data: profile, deleted: false, updatedAt: 1 },
        { kind: 'umas', id: 'u1', version: 1, data: v5Uma(), deleted: false, updatedAt: 1 },
      ],
      logs: [],
      serverTime: 1,
    })).not.toThrow()
  })
})
