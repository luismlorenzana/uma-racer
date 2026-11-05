// Build fixtures (T153, D382): small synthetic cards, an Uma, careers and an operation env. Invented numbers only, chosen
// to make hand computation easy: no real card's values.
import type { SkillTemplate, SupportCardTemplate, SupportCardType, UmaTemplate } from '../content'
import type { OperationEnv } from '../save/registry'
import { careerId, type BondRecord, type CareerRecord } from '../save/records'
import type { SaveState } from '../save/state'
import type { Stats } from '../types'
import { clock } from './g3'

export const stats = (speed: number, stamina: number, power: number, guts: number, wit: number): Stats => ({ speed, stamina, power, guts, wit })
export const flat = (n: number): Stats => stats(n, n, n, n, n)

/** A synthetic SSR: every list empty and no unique unless given. */
export function testCard(id: string, type: SupportCardType, effects: Record<number, number>, extra: Partial<SupportCardTemplate> = {}): SupportCardTemplate {
  return {
    id, charaId: `chara-${id}`, charName: `Chara ${id}`, title: `[Card ${id}]`, type, jpRelease: '2021-02-24', era: 1,
    obtain: 'gacha', starter: false, hintSkillIds: [], hintOthers: [], eventSkillIds: [], effects, uniqueEffect: null, ...extra,
  }
}

/** A unique effect of one or more terms, on from level 30. */
export const unique = (...effects: { type: number; value: number; params?: number[] }[]): SupportCardTemplate['uniqueEffect'] => ({
  level: 30, description: null, effects: effects.map((effect) => ({ type: effect.type, value: effect.value, params: effect.params ?? [] })),
})

/** A synthetic Uma: base 100 in every stat, no growth unless given. */
export function testUma(id = 'uma-1', extra: Partial<UmaTemplate> = {}): UmaTemplate {
  return {
    id, charaId: `chara-${id}`, name: `Test Uma ${id}`, outfit: null, jpRelease: '2021-02-24', globalRelease: null, starter: true,
    baseStats: flat(100), growthRates: flat(0),
    aptitudes: {
      surface: { turf: 'A', dirt: 'G' },
      distance: { sprint: 'C', mile: 'A', medium: 'A', long: 'B' },
      strategy: { front: 'D', pace: 'A', late: 'B', end: 'C' },
    },
    uniqueSkillId: 'skill-unique', awakeningSkillIds: ['skill-awake-w', 'skill-awake-g', 'skill-awake-2', 'skill-awake-3'],
    innateSkillIds: [], eventSkillIds: [], realHorseSex: 'female', signatureRaceFamilyIds: [], ...extra,
  }
}

/** A white or gold skill that races: a guaranteed speed-up, `costSp` SP. */
export function testSkill(id: string, costSp: number | null, extra: Partial<SkillTemplate> = {}): SkillTemplate {
  return {
    id, kind: 'white', name: `Skill ${id}`, description: '', costSp, iconId: null, activation: 0,
    conditions: [{ precondition: null, condition: 'phase==2', baseTime: 30000, cooldown: null, effects: [{ type: 27, value: 1500 }] }],
    inheritedSkillId: null, normalSkillId: null, ...extra,
  }
}

/** An open URA Finale career with an empty tree, deck and wallet. */
export function testCareer(umaId = 'uma-1', extra: Partial<CareerRecord> = {}): CareerRecord {
  return {
    umaId, T: 1, startedAt: clock('07:00'), season: 0, objectives: [], finale: { step: 0, won: false },
    deck: [], posts: {}, pips: flat(0), camps: [null, null], skills: [], spSpent: 0,
    wallet: { drills: flat(0), bond: 0, sp: 0 }, completedAt: null, racingBuild: null, ...extra,
  }
}

export const bond = (cardId: string, value: number, hints = 0, umaId = 'uma-1'): BondRecord => ({ umaId, tier: 1, cardId, value, hints })

/** A save with these cards unlocked and this career open. */
export function testState(career: CareerRecord, cardIds: readonly string[], bonds: Readonly<Record<string, BondRecord>> = {}): SaveState {
  return {
    account: { createdAt: clock('07:00'), umaTickets: 10, cardTickets: 10 },
    umas: { [career.umaId]: { unlockedAt: clock('07:00') } },
    cards: Object.fromEntries(cardIds.map((id) => [id, { unlockedAt: clock('07:00') }])),
    careers: { [careerId(career.umaId, career.T)]: career },
    bonds,
  }
}

export function testEnv(cards: readonly SupportCardTemplate[], skills: readonly SkillTemplate[] = [], umas: readonly UmaTemplate[] = [testUma()]): OperationEnv {
  return {
    content: {
      umas: new Map(umas.map((uma) => [uma.id, uma])),
      cards: new Map(cards.map((card) => [card.id, card])),
      skills: new Map(skills.map((skill) => [skill.id, skill])),
      races: [],
      courses: new Map(),
    },
    contentVersion: 'test-content',
  }
}
