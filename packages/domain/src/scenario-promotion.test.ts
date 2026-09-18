import { describe, expect, it } from 'vitest'
import type { RaceTemplate, SkillTemplate, SupportCardTemplate, UmaTemplate } from './content'
import { createCardSave, createPlayerProfile, createUmaSave } from './save'
import { parentFingerprint } from './inheritance'
import { expToNextUmaLevel, PROMOTION_BONUS_PER_STAT } from './progression'
import { buildParentSnapshot, completeFinalScenario, promoteScenario, promotionReadiness } from './scenario-promotion'

const aptitudes = {
  surface: { turf: 'A', dirt: 'G' },
  distance: { sprint: 'B', mile: 'A', medium: 'A', long: 'C' },
  strategy: { front: 'D', pace: 'A', late: 'B', end: 'C' },
} as const

const template: UmaTemplate = {
  id: 'uma-a', charaId: 'chara-a', name: 'Synthetic Runner', outfit: null,
  jpRelease: '2000-01-01', globalRelease: null, starter: true,
  baseStats: { speed: 100, stamina: 101, power: 102, guts: 103, wit: 104 },
  growthRates: { speed: 0, stamina: 0, power: 0, guts: 0, wit: 0 }, aptitudes,
  uniqueSkillId: 'unique-a', awakeningSkillIds: ['awake-1', 'awake-2', 'awake-3', 'awake-4'],
  realHorseSex: null, signatureRaceFamilyIds: [], imageSource: 'https://invalid.test/synthetic.png',
}

const parentTemplate: UmaTemplate = {
  ...template, id: 'uma-parent', charaId: 'chara-parent', name: 'Synthetic Parent', uniqueSkillId: 'unique-parent', awakeningSkillIds: [],
}

function skill(id: string, kind: SkillTemplate['kind'], options: Partial<SkillTemplate> = {}): SkillTemplate {
  return {
    id, kind, name: `Synthetic ${id}`, description: '', costSp: kind === 'unique' ? null : 100,
    iconId: null, conditions: [], inheritedSkillId: null, normalSkillId: null, ...options,
  }
}

const skillRows = [
  skill('unique-a', 'unique', { inheritedSkillId: 'unique-a-gene' }),
  skill('unique-a-gene', 'inherited-unique'),
  skill('unique-parent', 'unique', { inheritedSkillId: 'unique-parent-gene' }),
  skill('unique-parent-gene', 'inherited-unique'),
  skill('white-a', 'white'),
  skill('white-b', 'white'),
  skill('gold-a', 'gold', { normalSkillId: 'white-b' }),
  skill('inherited-a', 'white'),
  ...[1, 2, 3, 4].map((index) => skill(`awake-${index}`, 'white')),
]
const skills = new Map(skillRows.map((row) => [row.id, row]))

const cardTemplate: SupportCardTemplate = {
  id: 'card-a', charaId: 'support-a', charName: 'Synthetic Support', title: 'Measured Start', type: 'speed',
  jpRelease: '2000-01-01', era: 1, obtain: 'free', starter: true, hintSkillIds: [], eventSkillIds: [],
  effectProfile: {
    trainingBonus: 1, friendshipBonus: 1, statBonus: 1, skillPointBonus: 1,
    specialtyPriority: 1, hintFrequency: 1, raceBonus: 1, initialStats: 1.05,
  },
  uniqueEffect: null, imageSource: 'https://invalid.test/synthetic.png',
}

const races: RaceTemplate[] = [
  ['race-a', 'pre-op', '101'], ['race-b', 'op', '102'], ['race-c', 'g1', '103'],
].map(([id, grade, familyId], index) => ({
  id: id!, familyId: familyId!, name: `Synthetic Race ${index + 1}`, grade: grade as RaceTemplate['grade'],
  surface: 'turf', distance: 1600 + index * 200, distanceCategory: index < 2 ? 'mile' : 'medium',
  direction: 'left', venue: 'Synthetic', courseId: `course-${index + 1}`, season: 1, fieldSize: 8,
}))

function readyUma(exp = 0) {
  const base = createUmaSave(template)
  const added = [
    { skillId: 'white-a', origin: 'card' as const, sourceId: 'card-a' },
    { skillId: 'gold-a', origin: 'card' as const, sourceId: 'card-a' },
    { skillId: 'inherited-a', origin: 'inherited' as const, sourceId: 'parent-a' },
  ]
  return {
    ...base,
    goalPlanVersion: 0,
    scenarioStarted: true,
    level: 10,
    exp,
    trainingLevel: 7,
    trainingExp: 4,
    trainingsThisScenario: 22,
    deckCardIds: ['card-a'],
    skillLibrary: [...base.skillLibrary, ...added],
    skillHistory: [...base.skillHistory, ...added.map((unlock) => ({ ...unlock, tier: 1 }))],
    loadoutSkillIds: ['white-a'],
  }
}

describe('parent snapshot', () => {
  it('keeps direct whites, converts direct golds, and excludes inherited skills', () => {
    const snapshot = buildParentSnapshot({ uma: readyUma(), umaTemplate: template, skills, now: 123 })
    expect(snapshot).toMatchObject({
      umaId: 'uma-a', charaId: 'chara-a', completedTier: 1, takenAt: 123,
      inheritedUniqueSkillId: 'unique-a-gene', inheritableWhiteSkillIds: ['white-a', 'white-b'], parents: [],
    })
    expect(snapshot.aptitudes).not.toBe(readyUma().aptitudes)
  })

  it('blocks missing and malformed skill relationships', () => {
    const missing = new Map(skills)
    missing.delete('white-a')
    expect(() => buildParentSnapshot({ uma: readyUma(), umaTemplate: template, skills: missing, now: 1 })).toThrow(/missing/)
    const malformed = new Map(skills)
    malformed.set('gold-a', skill('gold-a', 'gold', { normalSkillId: 'awake-1' }))
    expect(() => buildParentSnapshot({ uma: readyUma(), umaTemplate: template, skills: malformed, now: 1 })).not.toThrow()
    malformed.set('awake-1', skill('awake-1', 'gold'))
    expect(() => buildParentSnapshot({ uma: readyUma(), umaTemplate: template, skills: malformed, now: 1 })).toThrow(/invalid normal/)
  })
})

describe('scenario promotion', () => {
  it('spends once, applies base/card bonuses, refreshes skills, and resets training', () => {
    const profile = { ...createPlayerProfile('content-v1', 1), tickets: 100 }
    const result = promoteScenario({
      profile, uma: readyUma(), umaTemplate: template, skills,
      cards: [{ template: cardTemplate, save: createCardSave(cardTemplate) }], races, now: 456,
    })
    expect(result).toMatchObject({ fromTier: 1, toTier: 2, cost: 25, awakeningSkillId: 'awake-1', overflowLevel: null })
    expect(result.profile.tickets).toBe(75)
    expect(result.uma).toMatchObject({
      level: 11, exp: 0, trainingLevel: 1, trainingExp: 0, trainingsThisScenario: 0,
      skillLibrary: [
        { skillId: 'unique-a', origin: 'own-unique' },
        { skillId: 'awake-1', origin: 'awakening' },
      ],
      loadoutSkillIds: [], currentParents: [],
    })
    expect(result.uma.stats.speed).toBe(100 + PROMOTION_BONUS_PER_STAT + 11)
    expect(result.uma.stats.stamina).toBe(101 + PROMOTION_BONUS_PER_STAT)
    expect(result.uma.skillHistory).toContainEqual({ skillId: 'awake-1', origin: 'awakening', sourceId: 'uma-a', tier: 2 })
    expect(result.ledger.map((entry) => [entry.id, entry.data.delta])).toEqual([['uma-promotion:uma-a:1', -25]])
  })

  it('carries partial overflow and converts a full bank into one rewarded level', () => {
    const profile = { ...createPlayerProfile('content-v1', 1), tickets: 100 }
    const input = { profile, umaTemplate: template, skills, cards: [{ template: cardTemplate, save: createCardSave(cardTemplate) }], races, now: 2 }
    expect(promoteScenario({ ...input, uma: readyUma(17) }).uma).toMatchObject({ level: 11, exp: 17 })
    const full = promoteScenario({ ...input, uma: readyUma(expToNextUmaLevel(11)) })
    expect(full.uma).toMatchObject({ level: 12, exp: 0 })
    expect(full.profile.tickets).toBe(80)
    expect(full.ledger.map((entry) => entry.id)).toEqual(['uma-promotion:uma-a:1', 'uma-level-tickets:uma-a:12'])
  })

  it('starts the promoted tier with an exact selected frozen parent', () => {
    const profile = { ...createPlayerProfile('content-v1', 1), tickets: 100 }
    const snapshot = {
      umaId: parentTemplate.id, charaId: parentTemplate.charaId, completedTier: 1, takenAt: 9,
      inheritedUniqueSkillId: 'unique-parent-gene', inheritableWhiteSkillIds: ['white-a'], aptitudes, parents: [],
    }
    const parent = { ...createUmaSave(parentTemplate), scenarioStarted: true, parentSnapshot: snapshot }
    const result = promoteScenario({
      profile, uma: readyUma(), umaTemplate: template, skills,
      cards: [{ template: cardTemplate, save: createCardSave(cardTemplate) }], races, now: 456,
      ownedUmas: [readyUma(), parent], umaTemplates: new Map([[template.id, template], [parentTemplate.id, parentTemplate]]),
      selection: { parents: [parentFingerprint(snapshot)], grandparentUniqueSkillIds: [], grandparentWhiteSkillIds: [], pinkSparks: [null] },
    })
    expect(result.uma.currentParents).toEqual([snapshot])
    expect(result.uma.skillLibrary).toContainEqual({ skillId: 'unique-parent-gene', origin: 'inherited', sourceId: parentTemplate.id })
    expect(result.snapshot.parents).toEqual([])
  })

  it('closes old goals as missed and atomically starts a fresh tracked Journey', () => {
    const current = {
      ...readyUma(),
      goalPlanVersion: 1,
      scenarioJourneys: [{
        tier: 1, tracking: 'tracked' as const, state: 'active' as const, completedAt: null,
        goals: [
          { id: 'goal:1:aptitude', slot: 'aptitude' as const, raceId: 'race-a', kind: 'win' as const, minimumMarginLengths: 0, status: 'active' as const, completedRaceResultId: null, completedAt: null },
          { id: 'goal:1:identity', slot: 'identity' as const, raceId: 'race-b', kind: 'win' as const, minimumMarginLengths: 0, status: 'active' as const, completedRaceResultId: null, completedAt: null },
          { id: 'goal:1:challenge', slot: 'challenge' as const, raceId: 'race-c', kind: 'win-by-margin' as const, minimumMarginLengths: 5, status: 'active' as const, completedRaceResultId: null, completedAt: null },
        ],
      }],
    }
    const result = promoteScenario({
      profile: { ...createPlayerProfile('content-v1', 1), tickets: 100 }, uma: current, umaTemplate: template, skills, races,
      cards: [{ template: cardTemplate, save: createCardSave(cardTemplate) }], now: 456,
    })
    expect(result.uma.scenarioJourneys[0]).toMatchObject({ tier: 1, state: 'completed', completedAt: 456 })
    expect(result.uma.scenarioJourneys[0]?.goals.map((goal) => goal.status)).toEqual(['missed', 'missed', 'missed'])
    expect(result.uma.scenarioJourneys[1]).toMatchObject({ tier: 2, tracking: 'tracked', state: 'active' })
  })

  it('reports gate/final/ticket readiness and rejects stale decks', () => {
    const profile = { ...createPlayerProfile('content-v1', 1), tickets: 24 }
    expect(promotionReadiness(profile, readyUma())).toMatchObject({ ready: false, final: false, cost: 25 })
    expect(promotionReadiness({ ...profile, tickets: 25 }, readyUma())).toMatchObject({ ready: true, toTier: 2 })
    expect(() => promoteScenario({ profile: { ...profile, tickets: 25 }, uma: readyUma(), umaTemplate: template, skills, cards: [], races, now: 1 })).toThrow(/stale/)
  })
})

describe('final scenario completion', () => {
  it('captures once without changing progression state', () => {
    const max = { ...readyUma(), level: 110, exp: 0 }
    const first = completeFinalScenario({ uma: max, umaTemplate: template, skills, now: 10 })
    const replay = completeFinalScenario({ uma: first, umaTemplate: template, skills, now: 99 })
    expect(first.parentSnapshot).toMatchObject({ completedTier: 11, takenAt: 10 })
    expect(replay).toEqual(first)
  })
})
