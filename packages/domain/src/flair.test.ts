import { describe, expect, it } from 'vitest'
import {
  BADGE_TIERS,
  SCENARIOS,
  buildUmaFlairCatalog,
  createUmaBadgeState,
  createUmaSave,
  evaluateUmaFlair,
  flairContentCoverage,
  flairEventId,
  orderFlairEventsForFanfare,
  parseBadgeState,
  prestigeForState,
  prestigeFrame,
  projectFlairProgress,
  statCap,
  type FlairEventRecord,
  type RaceTemplate,
  type UmaBadgeStateV1,
  type UmaTemplate,
} from './index'

const umaTemplate: UmaTemplate = {
  id: 'synthetic-uma',
  charaId: 'synthetic-character',
  name: 'Synthetic Runner',
  outfit: null,
  jpRelease: '2000-01-01',
  globalRelease: null,
  starter: true,
  baseStats: { speed: 100, stamina: 100, power: 100, guts: 100, wit: 100 },
  growthRates: { speed: 0, stamina: 0, power: 0, guts: 0, wit: 0 },
  aptitudes: {
    surface: { turf: 'A', dirt: 'B' },
    distance: { sprint: 'A', mile: 'A', medium: 'A', long: 'A' },
    strategy: { front: 'A', pace: 'A', late: 'A', end: 'A' },
  },
  uniqueSkillId: null,
  awakeningSkillIds: [],
  realHorseSex: null,
  signatureRaceFamilyIds: [],
  imageSource: 'https://invalid.test/synthetic.png',
}

function race(index: number): RaceTemplate {
  return {
    id: `synthetic-race-${index}`,
    familyId: `synthetic-family-${index}`,
    name: `Synthetic Race ${index}`,
    grade: 'g1',
    surface: 'turf',
    distance: 2_000,
    distanceCategory: 'medium',
    direction: 'right',
    venue: `Synthetic Venue ${index}`,
    venueKey: `synthetic-venue-${index}`,
    venueTags: ['jra-main'],
    series: index < 4 ? ['triple-crown'] : [],
    seriesLegs: index < 3 ? [`triple-crown:leg-${index + 1}`] : index === 3 ? ['triple-crown:leg-1'] : [],
    courseId: `synthetic-course-${index}`,
    season: 1,
    fieldSize: 12,
  }
}

const races = Array.from({ length: 10 }, (_, index) => race(index))

function accomplishedState(): UmaBadgeStateV1 {
  const base = createUmaBadgeState(createUmaSave(umaTemplate), 10)
  const cap = statCap(1, 10)
  const lineage = (kind: 'legacy' | 'dynasty', count: number) => Array.from({ length: count }, (_, index) => ({
    key: `${kind}:synthetic-child-${index}:1`,
    relatedUmaId: `synthetic-child-${index}`,
    tier: 1,
    createdAt: 200 + index,
  })).sort((left, right) => left.key.localeCompare(right.key))
  return {
    ...base,
    sourceWatermarks: { raceSequence: 24, trainingTurns: 50, scenarioCompletions: 1, lineageEvidence: 4 },
    history: { ...base.history, race: 'exact', training: 'since-tracking', 'scenario-completion': 'exact' },
    facts: {
      ...base.facts,
      starts: 25,
      wins: 25,
      currentWinStreak: 8,
      longestWinStreak: 8,
      gradeWins: [{ key: 'g1', count: 7 }],
      surfaceWins: [{ key: 'dirt', count: 1 }, { key: 'turf', count: 25 }],
      distanceWins: [
        { key: 'long', count: 3 }, { key: 'medium', count: 3 }, { key: 'mile', count: 3 }, { key: 'sprint', count: 3 },
      ],
      strategyWins: [
        { key: 'end', count: 3 }, { key: 'front', count: 25 }, { key: 'late', count: 3 }, { key: 'pace', count: 3 },
      ],
      venueWins: races.map((entry) => ({ key: entry.venueKey, count: 1 })),
      familyWins: [
        { key: 'synthetic-family-0', count: 3, grade: 'g1', series: ['triple-crown'] },
        { key: 'synthetic-family-1', count: 1, grade: 'g1', series: ['triple-crown'] },
        { key: 'synthetic-family-2', count: 1, grade: 'g1', series: ['triple-crown'] },
      ],
      lowAptitudeSurfaceWins: [{ key: 'dirt', count: 1 }],
      lowAptitudeDistanceWins: [{ key: 'long', count: 1 }],
      courseBests: [{ courseId: 'synthetic-course-0', finishTime: 100, resultId: 'race:synthetic-uma:24', achievedAt: 500 }],
      raceFeats: { ...base.facts.raceFeats, dominantWins: 1, impossibleGroundWins: 1, backFieldWins: 5 },
      statPeaks: { speed: 1_200, stamina: 900, power: 600, guts: 600, wit: 600 },
      balancedPeak: 600,
      levelPeak: 25,
      distinctSkillIds: Array.from({ length: 15 }, (_, index) => `synthetic-skill-${String(index).padStart(2, '0')}`),
      lifetimeTrainingTurns: 50,
      friendshipTrainings: 10,
      fullHouseCount: 1,
      trainingByTier: [{ tier: 1, turns: 50, friendshipTrainings: 10, fullHouseCount: 1, reachedTl10: true }],
      fullyTrainedTiers: [1],
      maxSkillsByTier: [{ key: '1', count: 10 }],
      goals: [0, 1, 2].map((index) => ({ goalId: `goal:synthetic-uma:1:${index}`, resultId: `race:synthetic-uma:${index}`, tier: 1, completedAt: 100 + index })),
      honorsTiers: [1],
      completedScenarioTiers: [1],
      raceStartsByTier: [{ key: '1', count: 15 }],
      completions: [{
        tier: 1,
        completedAt: 600,
        trainingLevel: 10,
        stats: { speed: cap, stamina: cap, power: cap, guts: cap, wit: cap },
        deckCardIds: ['synthetic-card'],
        deckEras: [1],
        trainingTurns: 50,
        friendshipTrainings: 10,
        raceStarts: 15,
        completedGoalIds: ['goal:synthetic-uma:1:0', 'goal:synthetic-uma:1:1', 'goal:synthetic-uma:1:2'],
        honors: true,
        parentUmaIds: [],
        grandparentUmaIds: [],
      }],
      legacyEvidence: lineage('legacy', 3),
      dynastyEvidence: lineage('dynasty', 1),
    },
  }
}

describe('Uma flair catalog v1', () => {
  it('builds every fixed family plus bounded content-backed definitions without deferred placeholders', () => {
    const state = accomplishedState()
    const catalog = buildUmaFlairCatalog({
      state,
      races,
      courseRecordIds: new Set(['synthetic-course-0']),
      courseRecordSources: new Map([['synthetic-course-0', { resultId: 'race:synthetic-uma:12', achievedAt: 450 }]]),
    })
    const keys = catalog.definitions.map((entry) => entry.awardKey)
    expect(keys).toEqual([...keys].sort((left, right) => left.localeCompare(right)))
    expect(new Set(keys).size).toBe(keys.length)
    expect(keys).toContain('badge:winner')
    expect(keys).toContain('badge:grand-tour')
    expect(keys).toContain('title:triple-crown')
    expect(keys).toContain('trophy:synthetic-family-0')
    expect(keys).toContain('title:three-time:synthetic-family-0')
    expect(keys).toContain('badge:course-record:synthetic-course-0')
    expect(keys).toContain(`badge:scenario:${SCENARIOS.length}:graduate`)
    expect(keys).toContain('ribbon:goal:synthetic-uma:1:0')
    expect(keys.some((key) => key.includes('duelist') || key.includes('upset'))).toBe(false)
    expect(catalog.mainVenueKeys).toHaveLength(10)
    expect(catalog.definitions.find((entry) => entry.awardKey === 'title:triple-crown')).toMatchObject({
      enabled: true,
      frozenKeys: ['triple-crown:leg-1', 'triple-crown:leg-2', 'triple-crown:leg-3'],
    })
    expect(flairContentCoverage(races)).toEqual({ coveredSeries: 1, totalSeries: 8, coveredLegs: 3, mainVenues: 10 })
  })

  it('disables incomplete private sets and marks unreconstructable completed snapshots untracked', () => {
    const state = accomplishedState()
    const withoutSnapshot = {
      ...state,
      history: { ...state.history, race: 'since-tracking' as const, 'scenario-completion': 'since-tracking' as const },
      facts: { ...state.facts, completions: [] },
    }
    const catalog = buildUmaFlairCatalog({ state: withoutSnapshot, races: races.slice(0, 2) })
    const grandTour = catalog.definitions.find((entry) => entry.awardKey === 'badge:grand-tour')!
    const tripleCrown = catalog.definitions.find((entry) => entry.awardKey === 'title:triple-crown')!
    expect(grandTour.enabled).toBe(false)
    expect(tripleCrown.enabled).toBe(false)
    expect(projectFlairProgress(grandTour, withoutSnapshot).progressLabel).toBe('Main-venue coverage is not published')
    expect(projectFlairProgress(tripleCrown, withoutSnapshot).progressLabel).toBe('Race-series coverage is not published')
    expect(catalog.definitions.find((entry) => entry.awardKey === 'badge:winner')?.enabled).toBe(true)
    expect(catalog.definitions.find((entry) => entry.awardKey === 'badge:scenario:1:capped')?.history).toBe('untracked')
    expect(catalog.definitions.find((entry) => entry.awardKey === 'badge:scenario:1:speedrun')?.history).toBe('untracked')
    expect(catalog.definitions.find((entry) => entry.awardKey === 'badge:scenario:1:graduate')?.history).toBe('since-tracking')
  })
})

describe('Uma flair evaluator', () => {
  it('accepts either family alias for a leg, requires every leg, and awards the title only once', () => {
    const state = accomplishedState()
    const aliasState: UmaBadgeStateV1 = {
      ...state,
      facts: {
        ...state.facts,
        familyWins: [
          { key: 'synthetic-family-1', count: 1, grade: 'g1', series: ['triple-crown'] },
          { key: 'synthetic-family-2', count: 1, grade: 'g1', series: ['triple-crown'] },
          { key: 'synthetic-family-3', count: 1, grade: 'g1', series: ['triple-crown'] },
        ],
      },
    }
    const first = evaluateUmaFlair(
      buildUmaFlairCatalog({ state: aliasState, races }),
      aliasState,
      { source: { kind: 'migration', id: null, tier: null }, earnedAt: 1_000, retroactive: true },
    )
    expect(first.events.filter((event) => event.data.awardKey === 'title:triple-crown')).toHaveLength(1)

    const retry = evaluateUmaFlair(
      buildUmaFlairCatalog({ state: first.state, races }),
      first.state,
      { source: { kind: 'migration', id: null, tier: null }, earnedAt: 2_000, retroactive: true },
    )
    expect(retry.events.filter((event) => event.data.awardKey === 'title:triple-crown')).toHaveLength(0)

    const missingLeg: UmaBadgeStateV1 = {
      ...aliasState,
      facts: { ...aliasState.facts, familyWins: aliasState.facts.familyWins.filter((row) => row.key !== 'synthetic-family-2') },
    }
    const incomplete = evaluateUmaFlair(
      buildUmaFlairCatalog({ state: missingLeg, races }),
      missingLeg,
      { source: { kind: 'migration', id: null, tier: null }, earnedAt: 1_000, retroactive: true },
    )
    expect(incomplete.events.some((event) => event.data.awardKey === 'title:triple-crown')).toBe(false)
  })

  it('awards crossed stages, one-offs, ribbons, Honors, titles, and first trophies exactly once', () => {
    const state = accomplishedState()
    expect(parseBadgeState(state)).toEqual(state)
    const catalog = buildUmaFlairCatalog({
      state,
      races,
      courseRecordIds: new Set(['synthetic-course-0']),
      courseRecordSources: new Map([['synthetic-course-0', { resultId: 'race:synthetic-uma:12', achievedAt: 450 }]]),
    })
    const evaluated = evaluateUmaFlair(catalog, state, {
      source: { kind: 'migration', id: null, tier: null }, earnedAt: 1_000, retroactive: true,
    })
    expect(evaluated.state.awards.badges.filter((entry) => entry.awardKey === 'badge:winner').map((entry) => entry.stage)).toEqual(['bronze', 'silver', 'gold'])
    expect(evaluated.state.awards.badges).toContainEqual(expect.objectContaining({ awardKey: 'badge:impossible-ground', stage: 'one-off' }))
    expect(evaluated.state.awards.badges).toContainEqual(expect.objectContaining({ awardKey: 'honors:1', stage: 'one-off' }))
    expect(evaluated.state.awards.badges.filter((entry) => entry.awardKey.startsWith('ribbon:'))).toHaveLength(3)
    expect(evaluated.state.awards.titles.map((entry) => entry.awardKey)).toEqual(expect.arrayContaining([
      'title:three-time:synthetic-family-0', 'title:triple-crown', 'title:two-time:synthetic-family-0',
    ]))
    expect(evaluated.state.awards.trophies).toHaveLength(3)
    expect(evaluated.state.preferences.activeTitleId).toBe(evaluated.state.awards.titles[0]?.awardKey)
    expect(new Set(evaluated.events.map((entry) => entry.id)).size).toBe(evaluated.events.length)
    expect(evaluated.events.find((entry) => entry.data.awardKey === 'ribbon:goal:synthetic-uma:1:0')?.data).toMatchObject({
      earnedAt: 100,
      source: { kind: 'goal', id: 'goal:synthetic-uma:1:0', tier: 1 },
    })
    expect(evaluated.events.find((entry) => entry.data.awardKey === 'badge:course-record:synthetic-course-0')?.data).toMatchObject({
      earnedAt: 450,
      source: { kind: 'race', id: 'race:synthetic-uma:12', tier: null },
    })
    expect(evaluated.events.find((entry) => entry.data.awardKey === 'badge:scenario:1:graduate')?.data).toMatchObject({
      earnedAt: 600,
      source: { kind: 'scenario', id: 'scenario:synthetic-uma:1', tier: 1 },
    })
    expect(evaluated.events.find((entry) => entry.data.awardKey === 'badge:legacy' && entry.data.stage === 'bronze')?.data).toMatchObject({
      earnedAt: 200,
      source: { kind: 'scenario', id: 'scenario:synthetic-child-0:1', tier: 1 },
    })
    const repeated = evaluateUmaFlair(catalog, evaluated.state, {
      source: { kind: 'migration', id: null, tier: null }, earnedAt: 2_000, retroactive: true,
    })
    expect(repeated.events).toEqual([])
    expect(repeated.state).toEqual(evaluated.state)
    expect(parseBadgeState(evaluated.state)).toEqual(evaluated.state)
  })

  it('keeps the first title active, updates trophy counts without replaying its event, and preserves record definitions', () => {
    const state = accomplishedState()
    const catalog = buildUmaFlairCatalog({ state, races, courseRecordIds: new Set(['synthetic-course-0']) })
    const first = evaluateUmaFlair(catalog, state, { source: { kind: 'race', id: 'race:synthetic-uma:24', tier: 1 }, earnedAt: 500, retroactive: false })
    const active = first.state.preferences.activeTitleId
    const incremented: UmaBadgeStateV1 = {
      ...first.state,
      facts: {
        ...first.state.facts,
        familyWins: first.state.facts.familyWins.map((entry) => entry.key === 'synthetic-family-1' ? { ...entry, count: 2 } : entry),
      },
    }
    const nextCatalog = buildUmaFlairCatalog({ state: incremented, races })
    expect(nextCatalog.definitions.some((entry) => entry.awardKey === 'badge:course-record:synthetic-course-0')).toBe(true)
    const next = evaluateUmaFlair(nextCatalog, incremented, { source: { kind: 'race', id: 'race:synthetic-uma:25', tier: 1 }, earnedAt: 700, retroactive: false })
    expect(next.state.preferences.activeTitleId).toBe(active)
    expect(next.state.awards.trophies.find((entry) => entry.familyId === 'synthetic-family-1')).toMatchObject({ count: 2, lastResultId: 'race:synthetic-uma:25' })
    expect(next.events.some((entry) => entry.data.kind === 'trophy-earned' && entry.data.awardKey === 'trophy:synthetic-family-1')).toBe(false)
    expect(next.events.some((entry) => entry.data.awardKey === 'title:two-time:synthetic-family-1')).toBe(true)
  })

  it('does not invent Perfect Journey from legacy tiers without exact completion snapshots', () => {
    const state = accomplishedState()
    const legacyHistory: UmaBadgeStateV1 = {
      ...state,
      sourceWatermarks: { ...state.sourceWatermarks, scenarioCompletions: 3 },
      facts: {
        ...state.facts,
        completedScenarioTiers: [1, 2, 3],
        honorsTiers: [1, 2, 3],
      },
    }
    const evaluated = evaluateUmaFlair(
      buildUmaFlairCatalog({ state: legacyHistory, races }),
      legacyHistory,
      { source: { kind: 'migration', id: null, tier: null }, earnedAt: 1_000, retroactive: true },
    )
    expect(evaluated.events.some((entry) => entry.data.awardKey === 'badge:perfect-journey')).toBe(false)
  })
})

describe('flair projections', () => {
  it('projects hidden and lower-bound progress honestly and derives Prestige frames', () => {
    const state = accomplishedState()
    const catalog = buildUmaFlairCatalog({ state, races, courseRecordIds: new Set(['synthetic-course-0']) })
    const hidden = catalog.definitions.find((entry) => entry.awardKey === 'badge:wire-to-wire')!
    expect(projectFlairProgress(hidden, state)).toMatchObject({ status: 'hidden', value: null, percentage: null })
    const diligent = catalog.definitions.find((entry) => entry.awardKey === 'badge:diligent')!
    expect(projectFlairProgress(diligent, state)).toMatchObject({ status: 'progress', progressLabel: 'at least 50 / 250' })

    const evaluated = evaluateUmaFlair(catalog, state, { source: { kind: 'migration', id: null, tier: null }, earnedAt: 1_000, retroactive: true })
    const winnerOnly = { ...catalog, definitions: catalog.definitions.filter((entry) => entry.awardKey === 'badge:winner') }
    const winnerState = {
      ...evaluated.state,
      awards: { badges: evaluated.state.awards.badges.filter((entry) => entry.awardKey === 'badge:winner'), titles: [], trophies: [] },
      preferences: { ...evaluated.state.preferences, activeTitleId: null },
    }
    expect(prestigeForState(winnerOnly, winnerState)).toBe(4)
    expect(prestigeFrame(4).label).toBe('Plain')
    expect(prestigeFrame(5).label).toBe('Bronze')
    expect(prestigeFrame(300).label).toBe('Legend')
  })

  it('uses safe deterministic ids and collapses fanfare to the highest tier in kind order', () => {
    const short = flairEventId('uma', 'synthetic-uma', 'badge:winner', 'bronze')
    expect(short).toBe(flairEventId('uma', 'synthetic-uma', 'badge:winner', 'bronze'))
    expect(flairEventId('uma', 'synthetic-uma', `badge:${'x'.repeat(120)}`, 'rainbow')).toHaveLength(27)
    expect(flairEventId('uma', 'u'.repeat(110), `badge:${'x'.repeat(120)}`, 'rainbow').length).toBeLessThanOrEqual(120)
    const event = (kind: FlairEventRecord['data']['kind'], awardKey: string, stage: FlairEventRecord['data']['stage']): FlairEventRecord => ({
      id: flairEventId('uma', 'synthetic-uma', awardKey, stage),
      data: { version: 1, scope: 'uma', umaId: 'synthetic-uma', kind, awardKey, stage, earnedAt: 100, source: { kind: 'race', id: 'race:synthetic-uma:0', tier: 1 }, retroactive: false },
    })
    const ordered = orderFlairEventsForFanfare([
      event('title', 'title:synthetic', 'one-off'),
      event('badge-tier', 'badge:winner', 'bronze'),
      event('trophy-earned', 'trophy:synthetic', 'one-off'),
      event('goal-ribbon', 'ribbon:synthetic', 'one-off'),
      event('badge-tier', 'badge:winner', 'gold'),
      event('badge-tier', 'badge:winner', 'silver'),
    ])
    expect(ordered.map((entry) => `${entry.data.kind}:${entry.data.stage}`)).toEqual([
      'goal-ribbon:one-off', 'badge-tier:gold', 'trophy-earned:one-off', 'title:one-off',
    ])
    expect(BADGE_TIERS).toEqual(['bronze', 'silver', 'gold', 'platinum', 'rainbow'])
  })
})
