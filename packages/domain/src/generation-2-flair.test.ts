// Generation 2's award catalogue (T141; docs/game/04-tiers-and-promotion.md §9–§10, 06-cards-and-bonds.md §7,
// 13-removals-and-plan-changes.md §1, 05-training-hub.md §11): retired awards are absent, redefined ones read what
// generation 2 writes, the tier awards and the Trainer's bonded meters are added, and Card Partners survives a
// promotion, since the ever-bonded set is a projection of every Uma's bonds and tier histories. Synthetic content only.
import { describe, expect, it } from 'vitest'
import { subject } from './__fixtures__/subject'
import {
  BADGE_ONE_OFF_POINTS, HALL_OF_FAME_POINTS, SCENARIOS, TITLE_POINTS, buildTrainerAchievementCatalog, buildUmaFlairCatalog,
  createTrainerBadgeState, createUmaBadgeState, createUmaSave, evaluateUmaFlair, prestigeForState, projectTrainerAchievementProgress,
  reconcileTrainerState, applyScenarioCompletionFact,
  type FlairTrigger, type ScenarioCompletionFact, type SupportCardTemplate, type UmaBadgeStateV1,
} from './index'
import { devGrant, OPERATIONS } from './check-in'
import { SIM_CONTENT, SIM_RACES, SIM_UMAS } from './sim'
import { isRefusal } from './state'
import { EXPEDITION_WINS, isLastScenario, newAccount, promote, recordExpeditionRace, unlockUma } from './tiers'
import { everBondedCardIds, promotionPresetStats } from './training'
import { newWorkState, type WorkState } from './work'

const template = SIM_UMAS[0]!
const races = SIM_RACES
const NOW = Date.UTC(2026, 9, 15, 9)
const trigger: FlairTrigger = { source: { kind: 'scenario', id: 'scenario:synthetic', tier: 5 }, earnedAt: NOW, retroactive: false }

const fresh = (): UmaBadgeStateV1 => createUmaBadgeState(createUmaSave(template), subject(), NOW)

function completion(tier: number, over: Partial<ScenarioCompletionFact> = {}): ScenarioCompletionFact {
  return {
    tier, completedAt: NOW, stats: { speed: 500, stamina: 500, power: 500, guts: 500, wit: 500 },
    deckCardIds: [], deckEras: [], raceStarts: 20, completedGoalIds: [], honors: false,
    parentUmaIds: [], grandparentUmaIds: [], ...over,
  }
}

const keys = () => buildUmaFlairCatalog({ state: fresh(), races }).definitions.map((row) => row.awardKey)
const definition = (awardKey: string, state = fresh()) =>
  buildUmaFlairCatalog({ state, races }).definitions.find((row) => row.awardKey === awardKey)

describe("generation 2's Uma catalogue", () => {
  it('retires Diligent', () => {
    expect(keys()).not.toContain('badge:diligent')
    expect(keys()).toContain('badge:hall-of-fame')
  })

  it('redefines Fully Trained, Graduate, the level badges, Living Legend and Era Loyalist in its words', () => {
    const first = SCENARIOS[0]!.name
    expect(definition('badge:scenario:1:fully-trained')!.description).toBe(`Open every unlock of ${first}'s layer.`)
    expect(definition('badge:scenario:1:graduate')!.description).toBe(`Leave ${first} by advancing to the next scenario.`)
    expect(definition('badge:scenario:5:graduate')!.description).toBe(`Leave ${SCENARIOS[4]!.name} by promotion to the next tier.`)
    expect(definition(`badge:scenario:${SCENARIOS.length}:graduate`)!.description).toContain('Hall of Fame')
    expect(definition('badge:level')!.description).toContain('lifetime level')
    expect(definition('badge:level')!.thresholds).toEqual([10, 25, 50, 75, 100])
    expect(definition('badge:living-legend')!.description).toContain('Hall of Fame')
    expect(definition('badge:scenario:3:era-loyalist')!.description).toContain('every race she ran')
    expect(definition('badge:full-house')!.description).toBe('Fill every card node of one constellation.')
    for (const row of buildUmaFlairCatalog({ state: fresh(), races }).definitions) {
      expect(row.description, row.awardKey).not.toMatch(/Training Level|TL10|Spark Match|Produce|coupon/i)
    }
  })

  it('adds the tier awards: Promoted · Tier 2 and 3 (4 Prestige), Hall of Fame (16) and the title Hall of Famer', () => {
    expect(definition('badge:promoted:2')).toMatchObject({ kind: 'one-off', label: 'Promoted · Tier 2', points: BADGE_ONE_OFF_POINTS, criterion: { kind: 'scenario', rule: 'graduate', tier: 5 } })
    expect(definition('badge:promoted:3')).toMatchObject({ kind: 'one-off', label: 'Promoted · Tier 3', points: BADGE_ONE_OFF_POINTS, criterion: { tier: 10 } })
    expect(definition('badge:hall-of-fame')).toMatchObject({ kind: 'one-off', label: 'Hall of Fame', points: HALL_OF_FAME_POINTS, criterion: { tier: SCENARIOS.length } })
    expect(definition('title:hall-of-famer')).toMatchObject({ kind: 'title', label: 'Hall of Famer', points: TITLE_POINTS })
  })

  it('awards a promotion from the tier’s last scenario, and the Hall of Fame and Living Legend only from the last one', () => {
    let state = fresh()
    for (let tier = 1; tier <= 5; tier += 1) state = applyScenarioCompletionFact(state, completion(tier))
    const promoted = evaluateUmaFlair(buildUmaFlairCatalog({ state, races }), state, trigger)
    const earned = promoted.events.map((event) => event.data.awardKey)
    expect(earned).toContain('badge:promoted:2')
    expect(earned).toContain('badge:scenario:5:graduate')
    expect(earned).not.toContain('badge:promoted:3')
    expect(earned).not.toContain('badge:living-legend')
    let all = promoted.state
    for (let tier = 6; tier < SCENARIOS.length; tier += 1) all = applyScenarioCompletionFact(all, completion(tier))
    const beforeHall = evaluateUmaFlair(buildUmaFlairCatalog({ state: all, races }), all, trigger)
    expect(beforeHall.events.map((event) => event.data.awardKey)).toContain('badge:promoted:3')
    expect(beforeHall.events.map((event) => event.data.awardKey)).not.toContain('badge:living-legend')
    const inducted = applyScenarioCompletionFact(beforeHall.state, completion(SCENARIOS.length))
    const hall = evaluateUmaFlair(buildUmaFlairCatalog({ state: inducted, races }), inducted, trigger)
    expect(hall.events.map((event) => event.data.awardKey)).toEqual(expect.arrayContaining(['badge:hall-of-fame', 'title:hall-of-famer', 'badge:living-legend']))
    const catalog = buildUmaFlairCatalog({ state: hall.state, races })
    expect(prestigeForState(catalog, hall.state) - prestigeForState(catalog, beforeHall.state)).toBe(HALL_OF_FAME_POINTS + TITLE_POINTS + BADGE_ONE_OFF_POINTS * 2)
  })

  it('reads Era Loyalist from the completion’s deck: only era-T cards in the set of every race she ran there', () => {
    const loyal = applyScenarioCompletionFact(fresh(), completion(2, { deckCardIds: ['a', 'b'], deckEras: [2, 2] }))
    const mixed = applyScenarioCompletionFact(fresh(), completion(2, { deckCardIds: ['a', 'b'], deckEras: [2, 1] }))
    const award = (state: UmaBadgeStateV1) => evaluateUmaFlair(buildUmaFlairCatalog({ state, races }), state, trigger)
      .events.some((event) => event.data.awardKey === 'badge:scenario:2:era-loyalist')
    expect([award(loyal), award(mixed)]).toEqual([true, false])
  })

  it('takes a Full House with no training turns', () => {
    const state = { ...fresh(), facts: { ...fresh().facts, fullHouseCount: 1 } }
    const earned = evaluateUmaFlair(buildUmaFlairCatalog({ state, races }), state, trigger)
    expect(earned.events.map((event) => event.data.awardKey)).toContain('badge:full-house')
  })
})

const cards: SupportCardTemplate[] = [...SIM_CONTENT.cards.values()].slice(0, 30)

function trainerCatalogKeys(): string[] {
  return buildTrainerAchievementCatalog({ umas: SIM_UMAS, cards, races }).definitions.map((row) => row.awardKey)
}

describe("generation 2's Trainer catalogue", () => {
  it('retires cards owned, stars, coupons and Era/Type Complete, and adds Card Partners, the Bonded one-offs, Promotions and Hall of Fame', () => {
    const g2 = trainerCatalogKeys()
    for (const key of ['trainer:card-collector', 'trainer:maxed-out', 'trainer:coupon-clipper']) expect(g2).not.toContain(key)
    expect(g2.some((key) => key.startsWith('trainer:era-complete') || key.startsWith('trainer:type-complete'))).toBe(false)
    expect(g2).toEqual(expect.arrayContaining(['trainer:card-partners', 'trainer:promotions', 'trainer:hall-of-fame', 'trainer:era-bonded:1']))
    expect(g2.some((key) => key.startsWith('trainer:type-bonded'))).toBe(true)
    const rows = buildTrainerAchievementCatalog({ umas: SIM_UMAS, cards, races }).definitions
    expect(rows.find((row) => row.awardKey === 'trainer:card-partners')!.thresholds).toEqual([10, 25, 50, 100, 200])
    expect(rows.find((row) => row.awardKey === 'trainer:promotions')!.thresholds).toEqual([1, 5, 15, 30, 50])
    expect(rows.find((row) => row.awardKey === 'trainer:hall-of-fame')!.thresholds).toEqual([1, 3, 10, 25, 50])
    expect(rows.find((row) => row.awardKey === 'trainer:veteran-stable')!.description).toContain('lifetime level')
  })

  it('reconciles the ever-bonded set', () => {
    const uma = createUmaSave(template)
    const base = {
      state: createTrainerBadgeState(NOW), contentVersion: 'synthetic', umas: SIM_UMAS, cards, races, ownedUmas: [uma],
      contributors: [fresh()], raceResults: [], now: NOW, retroactive: false,
    }
    const result = reconcileTrainerState({ ...base, bondedCardIds: cards.slice(0, 12).map((card) => card.id) })
    const aggregate = (key: string) => result.state.aggregates.find((row) => row.key === key)?.count
    expect(aggregate('bonded-cards')).toBe(12)
    expect(aggregate('owned-cards')).toBeUndefined()
    expect(result.events.map((event) => event.data.awardKey)).toContain('trainer:card-partners')
    const progress = projectTrainerAchievementProgress(buildTrainerAchievementCatalog({ umas: SIM_UMAS, cards, races }), result.state)
    expect(progress.find((row) => row.definition.awardKey === 'trainer:card-partners')).toMatchObject({ value: 12, highestStage: 'bronze', nextThreshold: 25 })
  })

  it('counts promotions and inductions from the contributors’ graduations, and an era bonded in full', () => {
    let state = fresh()
    for (const tier of [5, 10, SCENARIOS.length]) state = applyScenarioCompletionFact(state, completion(tier))
    const eraOne = cards.filter((card) => card.era === 1).map((card) => card.id)
    const result = reconcileTrainerState({
      state: createTrainerBadgeState(NOW), contentVersion: 'synthetic', umas: SIM_UMAS, cards, races, ownedUmas: [createUmaSave(template)],
      contributors: [state], raceResults: [], now: NOW, retroactive: false, bondedCardIds: eraOne,
    })
    const aggregate = (key: string) => result.state.aggregates.find((row) => row.key === key)?.count
    expect([aggregate('promotions'), aggregate('hall-of-fame')]).toEqual([2, 1])
    expect(result.events.map((event) => event.data.awardKey)).toEqual(expect.arrayContaining(['trainer:promotions', 'trainer:hall-of-fame', 'trainer:era-bonded:1']))
  })
})

describe('the ever-bonded set (06 §7, §9)', () => {
  const at = (state: WorkState, umaId: string, step: string) => {
    const granted = devGrant(state, { gate: umaId }, NOW, { content: SIM_CONTENT, dev: true }, `test-${step}`)
    if (isRefusal(granted)) throw new Error(granted.code)
    return granted.state
  }

  it('is every Uma’s bonds and every tier she left, so Card Partners survives a promotion', () => {
    const umaId = template.id
    const unlocked = unlockUma(newWorkState(newAccount(NOW)), { outfitId: umaId }, NOW, { content: SIM_CONTENT })
    if (isRefusal(unlocked)) throw new Error(unlocked.code)
    const bonds = cards.slice(0, 11).map((card) => card.id)
    const her = unlocked.state.umas[umaId]!
    let state: WorkState = { ...unlocked.state, umas: { ...unlocked.state.umas, [umaId]: { ...her, build: { ...her.build, bonds } } } }
    for (let step = 0; !isLastScenario(state.umas[umaId]!); step += 1) {
      state = at(state, umaId, `advance-${step}`)
      const advanced = OPERATIONS['advance-scenario'](state, { umaId }, NOW, { content: SIM_CONTENT })
      if (isRefusal(advanced)) throw new Error(advanced.code)
      state = advanced.state
    }
    state = at(state, umaId, 'last')
    for (let win = 0; win < EXPEDITION_WINS; win += 1) {
      const raced = recordExpeditionRace(state, { umaId, expeditionId: 'stand-in', won: true }, NOW)
      if (isRefusal(raced)) throw new Error(raced.code)
      state = raced.state
    }
    const before = everBondedCardIds(Object.values(state.umas))
    const promoted = promote(state, { umaId, presets: promotionPresetStats(state.umas[umaId]!, SIM_CONTENT) }, NOW, { content: SIM_CONTENT })
    if (isRefusal(promoted)) throw new Error(promoted.code)
    const after = promoted.state.umas[umaId]!
    expect(after.build.bonds).toEqual([])
    expect(everBondedCardIds(Object.values(promoted.state.umas))).toEqual(before)
    expect(before).toEqual([...bonds].sort())
    const reconcile = (bondedCardIds: string[]) => reconcileTrainerState({
      state: createTrainerBadgeState(NOW), contentVersion: 'synthetic', umas: SIM_UMAS, cards, races, ownedUmas: [createUmaSave(template)],
      contributors: [fresh()], raceResults: [], now: NOW, retroactive: false, bondedCardIds,
    })
    const partners = (result: ReturnType<typeof reconcile>) => result.state.awards.achievements.filter((row) => row.awardKey === 'trainer:card-partners').map((row) => row.stage)
    expect(partners(reconcile(everBondedCardIds(Object.values(promoted.state.umas))))).toEqual(partners(reconcile(before)))
    expect(partners(reconcile(before))).toEqual(['bronze'])
  })
})
