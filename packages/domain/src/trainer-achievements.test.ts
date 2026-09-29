import { subject } from './__fixtures__/subject'
import { describe, expect, it } from 'vitest'
import {
  BADGE_TIERS,
  buildTrainerAchievementCatalog,
  createTrainerBadgeState,
  createUmaBadgeState,
  parseBadgeState,
  projectTrainerAchievementProgress,
  reconcileTrainerState,
  type CardSave,
  type EarnedBadgeStage,
  type EarnedTitle,
  type RaceResultRecord,
  type RaceTemplate,
  type SupportCardTemplate,
  type UmaBadgeStateV1,
  type UmaSave,
  type UmaTemplate,
} from './index'
import { createCardSave, createUmaSave } from './save'

function umaTemplate(id: string): UmaTemplate {
  return {
    id, charaId: `chara-${id}`, name: `Synthetic ${id}`, outfit: null, jpRelease: '2000-01-01', globalRelease: null,
    starter: true, baseStats: { speed: 100, stamina: 100, power: 100, guts: 100, wit: 100 },
    growthRates: { speed: 0, stamina: 0, power: 0, guts: 0, wit: 0 },
    aptitudes: { surface: { turf: 'A', dirt: 'G' }, distance: { sprint: 'A', mile: 'A', medium: 'A', long: 'A' }, strategy: { front: 'A', pace: 'A', late: 'A', end: 'A' } },
    uniqueSkillId: null, awakeningSkillIds: [], realHorseSex: null, signatureRaceFamilyIds: [], imageSource: 'https://invalid.test/synthetic.png',
  }
}

function cardTemplate(id: string, type: SupportCardTemplate['type']): SupportCardTemplate {
  return {
    id, charaId: `chara-${id}`, charName: `Synthetic ${id}`, title: `Synthetic ${id}`, type, jpRelease: '2000-01-01',
    era: 1, obtain: 'gacha', starter: true, hintSkillIds: [], eventSkillIds: [],
    effectProfile: { trainingBonus: 0, friendshipBonus: 0, statBonus: 0, skillPointBonus: 0, specialtyPriority: 0, hintFrequency: 0, raceBonus: 0, initialStats: 0 },
    uniqueEffect: null, imageSource: 'https://invalid.test/synthetic.png',
  }
}

const source = { kind: 'collection' as const, id: 'synthetic-source', tier: null }
const award = (awardKey: string, stage: EarnedBadgeStage['stage'] = 'one-off'): EarnedBadgeStage => ({
  awardKey, stage, earnedAt: 100, history: 'exact', source, frozenKeys: [],
})

function contributor(template: UmaTemplate, rich: boolean, trackingStartedAt: number): UmaBadgeStateV1 {
  const base = createUmaBadgeState(createUmaSave(template), subject(), trackingStartedAt)
  if (!rich) {
    const candidate: UmaBadgeStateV1 = {
      ...base,
      facts: { ...base.facts, wins: 10, starts: 10, longestWinStreak: 10, legacyEvidence: [{ key: 'legacy:child-b:1', relatedUmaId: 'child-b', tier: 1, createdAt: 90 }] },
      sourceWatermarks: { ...base.sourceWatermarks, raceSequence: 9, lineageEvidence: 1 },
    }
    const parsed = parseBadgeState(candidate)
    if (!parsed || parsed.scope !== 'uma') throw new Error('Synthetic contributor is invalid')
    return parsed
  }
  const statAwards = ['guts', 'power', 'speed', 'stamina', 'wit'].map((stat) => award(`badge:stat:${stat}`, 'bronze'))
  const otherAwards = Array.from({ length: 20 }, (_, index) => award(`badge:synthetic-${String(index).padStart(2, '0')}`))
  const titles: EarnedTitle[] = [{ awardKey: 'title:synthetic', earnedAt: 100, history: 'exact', source, frozenKeys: [] }]
  const parentedScenarioStarts = Array.from({ length: 5 }, (_, index) => ({ key: `start:uma-a:${index + 1}`, relatedUmaId: 'uma-a', tier: index + 1, createdAt: 100 + index }))
  const goals = Array.from({ length: 5 }, (_, index) => ({ goalId: `goal:${index + 1}:synthetic`, resultId: `race:uma-a:${index}`, tier: index + 1, completedAt: 100 + index }))
  const candidate: UmaBadgeStateV1 = {
    ...base,
    sourceWatermarks: { raceSequence: 9, trainingTurns: 0, scenarioCompletions: 5, lineageEvidence: 6 },
    facts: {
      ...base.facts,
      starts: 10,
      wins: 10,
      longestWinStreak: 10,
      gradeWins: [{ key: 'g1', count: 1 }],
      statPeaks: { speed: 2_000, stamina: 1_500, power: 1_400, guts: 1_300, wit: 1_200 },
      levelPeak: 110,
      completedScenarioTiers: [1, 2, 3, 4, 5],
      honorsTiers: [1],
      goals,
      parentedScenarioStarts,
      legacyEvidence: [{ key: 'legacy:child-a:1', relatedUmaId: 'child-a', tier: 1, createdAt: 90 }],
    },
    awards: { ...base.awards, badges: [...statAwards, ...otherAwards].sort((left, right) => left.awardKey.localeCompare(right.awardKey)), titles },
  }
  const parsed = parseBadgeState(candidate)
  if (!parsed || parsed.scope !== 'uma') throw new Error('Rich synthetic contributor is invalid')
  return parsed
}

function raceResult(): RaceResultRecord {
  return {
    engineVersion: 3, course: { distance: 1_600, surface: 'turf', season: 1 }, contentVersion: 'synthetic-v1', umaId: 'uma-a', raceId: 'race-a',
    sequence: 0, seed: 1, strategy: 'pace', startLevel: 1, startExp: 0,
    startStats: { speed: 100, stamina: 100, power: 100, guts: 100, wit: 100 }, raceBonus: 0, playerPlacement: 1,
    expGained: 0, levelsGained: [], ticketReward: 0, shardReward: 0, completedGoalIds: [],
    field: [
      { umaId: 'uma-a', isPlayer: true, strategy: 'pace', gate: 0, stats: { speed: 100, stamina: 100, power: 100, guts: 100, wit: 100 }, aptitude: { distance: 'A', surface: 'A', strategy: 'A' }, placement: 1, finishTime: 100, marginLengths: 0 },
      { umaId: 'rival-a', isPlayer: false, strategy: 'pace', gate: 1, stats: { speed: 100, stamina: 100, power: 100, guts: 100, wit: 100 }, aptitude: { distance: 'A', surface: 'A', strategy: 'A' }, placement: 2, finishTime: 101, marginLengths: 7 },
    ],
    createdAt: 200,
  }
}

describe('Trainer achievement reconciliation', () => {
  const umas = [umaTemplate('uma-a'), umaTemplate('uma-b')]
  const cards = [cardTemplate('card-a', 'speed'), cardTemplate('card-b', 'wit')]
  const ownedUmas: UmaSave[] = umas.map((template, index) => ({ ...createUmaSave(template), level: index === 0 ? 110 : 50 }))
  const ownedCards: CardSave[] = cards.map((template) => ({ templateId: template.id, bonds: { '1': 3 }, maxCouponGranted: true }))
  const contributors = [contributor(umas[0]!, true, 100), contributor(umas[1]!, false, 50)]
  const baseInput = {
    contentVersion: 'synthetic-v1', umas, cards, races: [], ownedUmas, ownedCards, contributors,
    ledger: [{ id: 'card-coupon-redeem:card-a', data: { resource: 'card-coupons' as const, delta: -1, reason: 'card-coupon-redeem' as const, localDay: '2000-01-01', createdAt: 100 } }],
    raceResults: [raceResult()], now: 500, retroactive: true,
  }

  it('builds fixed and dynamic definitions without original-game fixtures', () => {
    const catalog = buildTrainerAchievementCatalog(baseInput)
    expect(catalog.definitions.map((row) => row.awardKey)).toContain('trainer:stable-master')
    expect(catalog.definitions.map((row) => row.awardKey)).toContain('trainer:era-complete:1')
    expect(catalog.definitions.filter((row) => row.label.endsWith('Complete'))).toHaveLength(3)
  })

  it('reconciles all seven type-complete denominators, including Friend and Group, exactly once', () => {
    const allTypes = ['speed', 'stamina', 'power', 'guts', 'wit', 'friend', 'group'] as const
    const typeCards = allTypes.map((type) => cardTemplate(`card-${type}`, type))
    const typeOwned = typeCards.map((card) => ({
      ...createCardSave(card),
      level: 1,
    }))
    const input = { ...baseInput, contentVersion: 'synthetic-types-v1', cards: typeCards, ownedCards: typeOwned }
    const first = reconcileTrainerState({ ...input, state: createTrainerBadgeState(1) })
    const typeAwards = first.state.awards.achievements
      .filter((entry) => entry.awardKey.startsWith('trainer:type-complete:'))
      .map((entry) => entry.awardKey)
    expect(typeAwards).toEqual(allTypes.map((type) => `trainer:type-complete:${type}`).sort())

    const retry = reconcileTrainerState({ ...input, state: first.state, now: 501 })
    expect(retry.events).toEqual([])
    const expanded = reconcileTrainerState({
      ...input,
      contentVersion: 'synthetic-types-v2',
      cards: [...typeCards, cardTemplate('card-friend-later', 'friend')],
      state: first.state,
      now: 502,
    })
    expect(expanded.state.awards.achievements.map((entry) => entry.awardKey)).toEqual(expect.arrayContaining([
      'trainer:type-complete:friend', 'trainer:type-complete:group',
    ]))
  })

  it('counts one covered series title in the catalog even when a leg has family aliases', () => {
    const races: RaceTemplate[] = Array.from({ length: 4 }, (_, index) => ({
      id: `synthetic-race-${index}`,
      familyId: `synthetic-family-${index}`,
      name: `Synthetic Race ${index}`,
      grade: 'g1',
      surface: 'turf',
      distance: 2_000,
      distanceCategory: 'medium',
      direction: 'left',
      venue: 'Synthetic Venue',
      venueKey: 'synthetic-venue',
      venueTags: [],
      series: ['triple-crown'],
      seriesLegs: [`triple-crown:leg-${index < 3 ? index + 1 : 1}`],
      courseId: `synthetic-course-${index}`,
      season: 1,
      fieldSize: 8,
    }))
    const catalog = buildTrainerAchievementCatalog({ ...baseInput, races })
    expect(catalog.titleDenominatorKeys.filter((key) => key === 'title:triple-crown')).toHaveLength(1)
    expect(catalog.titleDenominatorKeys).not.toContain('title:triple-tiara')
  })

  it('reconciles every aggregate family, stable records, and deterministic Trainer events', () => {
    const result = reconcileTrainerState({ ...baseInput, state: createTrainerBadgeState(1) })
    expect(result.state.sourceWatermarks).toEqual({ contributors: 2, ledgerEntries: 1, contentVersion: 'synthetic-v1' })
    expect(result.state.awards.achievements).toEqual(expect.arrayContaining([
      expect.objectContaining({ awardKey: 'trainer:stable-master', stage: 'rainbow', frozenKeys: ['uma-a', 'uma-b'] }),
      expect.objectContaining({ awardKey: 'trainer:card-collector', stage: 'rainbow', frozenKeys: ['card-a', 'card-b'] }),
      expect.objectContaining({ awardKey: 'trainer:stable-wins', stage: 'bronze' }),
      expect.objectContaining({ awardKey: 'trainer:family-tree', stage: 'bronze' }),
      expect.objectContaining({ awardKey: 'trainer:era-complete:1', stage: 'one-off' }),
    ]))
    expect(result.events.every((event) => event.data.kind === 'trainer-achievement' && event.data.retroactive)).toBe(true)
    expect(result.state.records).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'most-wins', umaId: 'uma-b', value: 10 }),
      expect.objectContaining({ kind: 'highest-stat', umaId: 'uma-a', value: 2_000, stat: 'speed' }),
      expect.objectContaining({ kind: 'most-badge-stages', sourceId: 'synthetic-source', achievedAt: 100 }),
      expect.objectContaining({ kind: 'biggest-winning-margin', sourceId: 'race:uma-a:0', value: 7 }),
    ]))
    expect(parseBadgeState(result.state)).toEqual(result.state)
    expect(parseBadgeState({ ...result.state, records: [{
      kind: 'most-wins', value: 10, umaId: 'uma-a', sourceId: null, achievedAt: 1, stat: 'speed',
    }] })).toBeNull()

    const retry = reconcileTrainerState({ ...baseInput, contributors: [...contributors].reverse(), state: result.state, now: 600 })
    expect(retry.events).toEqual([])
    expect(retry.changed).toBe(false)
    expect(retry.state).toEqual(result.state)
  })

  it('preserves earned all stages and their frozen evidence after the catalog grows', () => {
    const first = reconcileTrainerState({ ...baseInput, state: createTrainerBadgeState(1) })
    const expanded = reconcileTrainerState({
      ...baseInput,
      state: first.state,
      umas: [...umas, umaTemplate('uma-c')],
      cards: [...cards, cardTemplate('card-c', 'power')],
      now: 700,
    })
    const stableMaster = expanded.state.awards.achievements.find((entry) => entry.awardKey === 'trainer:stable-master' && entry.stage === 'rainbow')
    expect(stableMaster?.frozenKeys).toEqual(['uma-a', 'uma-b'])
    const progress = projectTrainerAchievementProgress(buildTrainerAchievementCatalog({ ...baseInput, umas: [...umas, umaTemplate('uma-c')] }), expanded.state)
    expect(progress.find((row) => row.definition.awardKey === 'trainer:stable-master')).toMatchObject({ complete: true, nextThreshold: null })
  })

  it('rejects duplicate or malformed contributors instead of silently undercounting', () => {
    expect(() => reconcileTrainerState({ ...baseInput, state: createTrainerBadgeState(1), contributors: [contributors[0]!, contributors[0]!] })).toThrow(/Duplicate/)
    expect(() => reconcileTrainerState({ ...baseInput, state: createTrainerBadgeState(1), contributors: [{ ...contributors[0]!, version: 2 as 1 }, contributors[1]!] })).toThrow(/invalid/)
  })

  it('counts only target-keyed coupon spends and excludes shard exchanges or malformed lookalikes', () => {
    const state = reconcileTrainerState({
      ...baseInput,
      state: createTrainerBadgeState(1),
      ledger: [
        ...baseInput.ledger,
        { id: 'uma-coupon-redeem:uma-a', data: { resource: 'uma-coupons' as const, delta: -1, reason: 'uma-coupon-redeem' as const, localDay: '2000-01-01', createdAt: 101 } },
        { id: 'uma-shard-exchange:1:coupon', data: { resource: 'uma-coupons' as const, delta: 1, reason: 'uma-shard-exchange' as const, localDay: '2000-01-01', createdAt: 102 } },
        { id: 'synthetic-lookalike', data: { resource: 'card-coupons' as const, delta: -1, reason: 'card-coupon-redeem' as const, localDay: '2000-01-01', createdAt: 103 } },
      ],
    }).state
    expect(state.aggregates.find((row) => row.key === 'coupon-redemptions')?.count).toBe(2)
  })

  it('keeps stage ordering aligned with the shared Bronze-to-Rainbow ladder', () => {
    expect(BADGE_TIERS).toEqual(['bronze', 'silver', 'gold', 'platinum', 'rainbow'])
  })
})
