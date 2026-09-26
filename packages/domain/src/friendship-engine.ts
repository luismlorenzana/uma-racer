// Friendship Training's engine (M020 T063–T064): a run is `replay(setup, actions)`, a pure fold of the player's
// choices over a frozen setup, so a reload resumes exactly and a commit can check a clear by replaying it.
// docs/design/minigames.md#friendship-training holds the rules; friendship-rules.ts holds the numbers.

import type { CardEffect } from './cards'
import {
  FT_BOND_GAUGE,
  FT_CARD_POINTS,
  FT_EARNING_TARGET_MULT,
  FT_FACILITY_GRADES,
  FT_FORMATIONS,
  FT_HAND_SIZE,
  FT_MAX_REDRAW,
  FT_MAX_TRAIN,
  FT_OFFER_SIZE,
  FT_ORDER_FORMATIONS,
  FT_RACE_PAYOUT,
  FT_RACE_TARGETS,
  FT_RACE_TRAINS,
  FT_RAINBOW_MAX_EXTRA,
  FT_REDRAWS,
  FT_RIVAL_RULES,
  FT_RIVAL_RULE_IDS,
  FT_SHOP_PRICES,
  FT_SIGNATURE_MULT,
  FT_SKILL_SLOTS,
  FT_STRENGTH_PER_STAR,
  FT_TWIST_VALUES,
  FT_UNUSED_TRAIN_FANS,
  FT_UPGRADE_POINTS,
  FT_WEEKS_PER_STAGE,
  FT_WEEK_TARGETS,
  FT_WEEK_TRAINS,
  ftFavouredTypes,
  ftSkillValue,
  type FtFormationId,
  type FtRivalRuleId,
  type FtShopItem,
  type FtSkillRuleId,
} from './friendship-rules'
import { ftRng, ftShuffle, type FtCardDef, type FtSetup, type FtSkillDef } from './friendship-setup'
import { STATS, type StatKey } from './types'

export interface FtInstance {
  uid: number
  cardId: string
  /** Shop upgrades: +5 points each. */
  bonus: number
}

export type FtPhase = 'build' | 'facility' | 'encounter' | 'reward' | 'skill' | 'shop' | 'won' | 'lost'

export interface FtFacilityOffer {
  type: StatKey
  target: number
  payout: number
}

export interface FtEncounter {
  kind: 'week' | 'race'
  facility: StatKey | null
  favoured: StatKey[]
  rival: FtRivalRuleId | null
  target: number
  payout: number
  score: number
  trainsLeft: number
  trainsUsed: number
  redrawsLeft: number
  /** Draw pile, top first. */
  draw: number[]
  hand: number[]
  discard: number[]
  reshuffles: number
  /** Orders: the formation this week posts. */
  order: FtFormationId | null
  orderFilled: boolean
}

export interface FtTrainResult {
  uids: number[]
  formation: FtFormationId
  cardPoints: number
  bonusPoints: number
  formationPoints: number
  mult: number
  factor: number
  total: number
  /** What applied, in the order it did, for the readout. */
  notes: string[]
}

export interface FtTwistState {
  racesWon: number
  notes: StatKey[]
  performanceReady: boolean
  fragments: number
  fragmentsReady: boolean
  expedition: StatKey[]
  ingredients: Record<StatKey, number>
  dishTrains: number
  research: Record<StatKey, number>
  built: StatKey[]
  /** Soak: the stage whose weeks get +1 redraw. */
  soakStage: number | null
}

export interface FtShop {
  copy: string | null
  white: string | null
  gold: string | null
  bought: FtShopItem[]
  rerolls: number
}

export interface FtState {
  phase: FtPhase
  stage: number
  /** 0 and 1 are the stage's weeks; 2 is its race. */
  week: number
  deck: FtInstance[]
  nextUid: number
  skills: string[]
  seenSkills: string[]
  fans: number
  gauge: number
  bonded: boolean
  facilityOffers: FtFacilityOffer[] | null
  encounter: FtEncounter | null
  rewardOffer: string[] | null
  skillOffer: string[] | null
  shop: FtShop | null
  lastTrain: FtTrainResult | null
  /** Each week's facility, in order (Genres). */
  weeksTrained: StatKey[]
  /** Trains per facility type (Shared Light). */
  trainsByType: Record<StatKey, number>
  twist: FtTwistState
  lossReason: string | null
}

export type FtAction =
  | { type: 'build'; facilities: StatKey[] }
  | { type: 'facility'; index: number }
  | { type: 'train'; uids: number[] }
  | { type: 'redraw'; uids: number[] }
  | { type: 'reward'; cardId: string | null }
  | { type: 'skill'; skillId: string | null; replace?: number }
  | { type: 'buy'; item: FtShopItem; uid?: number; replace?: number }
  | { type: 'leave-shop' }
  | { type: 'give-up' }

export class FtActionError extends Error {}

const zeroByStat = (): Record<StatKey, number> => ({ speed: 0, stamina: 0, power: 0, guts: 0, wit: 0 })
const TYPE_ORDER = ['speed', 'stamina', 'power', 'guts', 'wit', 'friend', 'group'] as const
const roundTarget = (value: number) => Math.max(10, Math.round(value / 10) * 10)
const fail = (message: string): never => { throw new FtActionError(message) }

export const ftStageCount = (setup: FtSetup): number => setup.races.length
export const ftIsBroad = (def: Pick<FtCardDef, 'type'>): boolean => def.type === 'friend' || def.type === 'group'
const statOf = (def: FtCardDef): StatKey | null => ftIsBroad(def) ? null : def.type as StatKey

const cardOf = (setup: FtSetup, state: FtState, uid: number): { instance: FtInstance; def: FtCardDef } => {
  const instance = state.deck.find((entry) => entry.uid === uid) ?? fail(`No card ${uid} in the deck`)
  return { instance, def: setup.cards[instance.cardId] ?? fail(`Unknown card ${instance.cardId}`) }
}

const ownedSkills = (setup: FtSetup, state: FtState): FtSkillDef[] => state.skills.map((id) => setup.skills[id]!)
const skillSum = (skills: readonly FtSkillDef[], rule: FtSkillRuleId): number =>
  skills.filter((skill) => skill.rule === rule).reduce((sum, skill) => sum + ftSkillValue(rule, skill.gold), 0)
const hasGold = (skills: readonly FtSkillDef[], rule: FtSkillRuleId) => skills.some((skill) => skill.rule === rule && skill.gold)
const hasRule = (skills: readonly FtSkillDef[], rule: FtSkillRuleId) => skills.some((skill) => skill.rule === rule)

/** Whether the race's rival rule applies to the next train. Gold Pressure cancels it; white lifts per-train rules after the first train. */
export function ftRivalActive(setup: FtSetup, state: FtState, rule: FtRivalRuleId): boolean {
  const encounter = state.encounter
  if (!encounter || encounter.rival !== rule) return false
  const skills = ownedSkills(setup, state)
  if (hasGold(skills, 'pressure')) return false
  if (FT_RIVAL_RULES[rule].perTrain && hasRule(skills, 'pressure') && encounter.trainsUsed >= 1) return false
  return true
}

export function ftHandSize(setup: FtSetup, state: FtState): number {
  const skills = ownedSkills(setup, state)
  const vision = skills.filter((skill) => skill.rule === 'vision').length
  return FT_HAND_SIZE + vision - (ftRivalActive(setup, state, 'crowded-field') ? 1 : 0)
}

/** A card's strength: `1 + 0.1 × stars`, as if 5★ for the Legends card. */
export function ftStrength(setup: FtSetup, def: FtCardDef): number {
  const stars = setup.legendsCardId === def.id ? FT_TWIST_VALUES.legendsStars : def.stars
  return 1 + FT_STRENGTH_PER_STAR * stars
}

/** Whether a card counts as the encounter's type: its facility, a race's favoured types, or any type for broad cards. */
export function ftOnType(setup: FtSetup, state: FtState, instance: FtInstance, def: FtCardDef): boolean {
  const encounter = state.encounter
  if (!encounter) return false
  if (ftIsBroad(def)) return true
  if (instance.cardId === setup.mainCardId && state.bonded) return true
  const stat = statOf(def)!
  if (state.twist.expedition.includes(stat)) return true
  return encounter.kind === 'race' ? encounter.favoured.includes(stat) : encounter.facility === stat
}

/**
 * A card's own facility: its type is the week's, or one of the race's favoured types. Broad cards are home anywhere,
 * and so is the bonded main card, which counts as the facility's type everywhere.
 */
const ownFacility = (setup: FtSetup, state: FtState, instance: FtInstance, def: FtCardDef): boolean => {
  const encounter = state.encounter!
  if (ftIsBroad(def) || (instance.cardId === setup.mainCardId && state.bonded)) return true
  const stat = statOf(def)!
  return encounter.kind === 'race' ? encounter.favoured.includes(stat) : encounter.facility === stat
}

/** The traits a card plays with: its own, plus the signature at ×1.5 once the main card bonds; none while Marked. */
export function ftTraits(setup: FtSetup, state: FtState, instance: FtInstance, def: FtCardDef): { kind: CardEffect; scale: number }[] {
  const main = instance.cardId === setup.mainCardId
  if (main && ftRivalActive(setup, state, 'marked')) return []
  const traits = [{ kind: def.trait, scale: 1 }]
  if (main && state.bonded) traits.push(...def.signature.map((kind) => ({ kind, scale: FT_SIGNATURE_MULT })))
  return traits
}

/** The two facility types trained least, ties to the earlier stat (Shared Light). */
const leastTrained = (state: FtState): StatKey[] =>
  [...STATS].sort((left, right) => state.trainsByType[left] - state.trainsByType[right] || STATS.indexOf(left) - STATS.indexOf(right)).slice(0, 2)

/** Scores a train without playing it: the readout and the bot use this; `train` applies the same result. */
export function ftScoreTrain(setup: FtSetup, state: FtState, uids: readonly number[]): FtTrainResult {
  const encounter = state.encounter ?? fail('No encounter is running')
  const race = encounter.kind === 'race'
  const skills = ownedSkills(setup, state)
  const first = encounter.trainsUsed === 0
  const last = encounter.trainsLeft === 1
  const cards = uids.map((uid) => cardOf(setup, state, uid))
  const notes: string[] = []
  const heavy = ftRivalActive(setup, state, 'heavy-going')

  let cardPoints = 0
  let rainbowCount = 0
  let onCards = 0
  let multBonus = 0
  for (const { instance, def } of cards) {
    const onType = ftOnType(setup, state, instance, def)
    const traits = ftTraits(setup, state, instance, def)
    let points = (ftIsBroad(def) ? FT_CARD_POINTS.broad : onType ? FT_CARD_POINTS.onType : FT_CARD_POINTS.offType) * ftStrength(setup, def)
    if (heavy && def.type === 'speed') points *= 0.5
    for (const { kind, scale } of traits) {
      if (kind === 'raceBonus' && race) points *= 1 + 0.5 * scale
    }
    points += instance.bonus
    for (const { kind, scale } of traits) {
      if (kind === 'trainingBonus') points += 6 * scale
      if (kind === 'statBonus') points += (4 + (ownFacility(setup, state, instance, def) ? 2 : 0)) * scale
      if (kind === 'initialStats' && first) points += 10 * scale
      if (kind === 'friendshipBonus' && ownFacility(setup, state, instance, def)) multBonus += scale
    }
    const stat = statOf(def)
    for (const skill of skills) {
      if (skill.rule === 'aptitude' && stat !== null && skill.stat === stat) points += ftSkillValue('aptitude', skill.gold)
    }
    points += skillSum(skills, 'kick')
    if (setup.twist === 'construction' && !race && encounter.facility && state.twist.built.includes(encounter.facility)) {
      points += FT_TWIST_VALUES.constructionPoints
    }
    cardPoints += points
    if (onType) {
      onCards += 1
      rainbowCount += traits.some((trait) => trait.kind === 'specialtyPriority') ? 2 : 1
    }
  }

  let bonusPoints = skillSum(skills, 'form')
  if (cards.length >= 4) bonusPoints += skillSum(skills, 'straight')

  // The best formation the selection makes.
  const copies = Math.max(0, ...[...new Set(cards.map(({ instance }) => instance.cardId))]
    .map((id) => cards.filter(({ instance }) => instance.cardId === id).length))
  const types = new Set(cards.map(({ def }) => statOf(def)).filter((stat): stat is StatKey => stat !== null))
  const wild = cards.filter(({ def }) => ftIsBroad(def)).length
  const candidates: { id: FtFormationId; mult: number }[] = [{ id: 'solo', mult: FT_FORMATIONS.solo.mult }]
  if (copies >= 2) candidates.push({ id: 'duo', mult: FT_FORMATIONS.duo.mult })
  if (rainbowCount >= 2) candidates.push({ id: 'friendship', mult: FT_FORMATIONS.friendship.mult })
  if (copies >= 3) candidates.push({ id: 'trio', mult: FT_FORMATIONS.trio.mult })
  if (rainbowCount >= 3) candidates.push({ id: 'rainbow', mult: FT_FORMATIONS.rainbow.mult + Math.min(FT_RAINBOW_MAX_EXTRA, rainbowCount - 3) })
  if (cards.length >= 5 && types.size + wild >= 5) candidates.push({ id: 'full-team', mult: FT_FORMATIONS['full-team'].mult })
  if (onCards >= 5) candidates.push({ id: 'rainbow-team', mult: FT_FORMATIONS['rainbow-team'].mult })
  const traffic = ftRivalActive(setup, state, 'traffic')
  for (const candidate of candidates) {
    if (traffic && (candidate.id === 'rainbow' || candidate.id === 'full-team' || candidate.id === 'rainbow-team')) candidate.mult -= 1
  }

  // Mult bonuses beyond the traits.
  if (cards.some(({ def }) => def.type === 'speed')) multBonus += skillSum(skills, 'surge')
  if (last) multBonus += skillSum(skills, 'spurt')
  if (race && skills.some((skill) => skill.rule === 'positioning' && skill.gold)) multBonus += 1
  if (setup.twist === 'climax') multBonus += state.twist.racesWon
  if (setup.twist === 'team-spirit' && new Set(cards.map(({ def }) => def.charaId)).size >= 5) {
    multBonus += FT_TWIST_VALUES.teamSpiritMult
    notes.push('Team Spirit')
  }
  if (setup.twist === 'genres' && !race && encounter.facility) {
    let streak = 0
    for (let index = state.weeksTrained.length - 1; index >= 0 && state.weeksTrained[index] === encounter.facility; index -= 1) streak += 1
    if (streak > 1) {
      multBonus += streak - 1
      notes.push(`Genres ×${streak}`)
    }
  }
  if (setup.twist === 'shared-light' && !race && encounter.facility && leastTrained(state).includes(encounter.facility)) {
    multBonus += 1
    notes.push('Shared Light')
  }

  // Factors.
  let factor = 1
  const corner = skills.filter((skill) => skill.rule === 'corner')
  if (first && corner.length > 0) {
    for (const skill of corner) factor *= ftSkillValue('corner', skill.gold)
    notes.push('Corner')
  }
  const gate = skills.filter((skill) => skill.rule === 'gate')
  if (race && first && gate.length > 0) {
    for (const skill of gate) factor *= ftSkillValue('gate', skill.gold)
    notes.push('Gate')
  }
  if (first && ftRivalActive(setup, state, 'front-runner')) factor *= 0.5
  if (cards.length < 3 && ftRivalActive(setup, state, 'stamina-test')) factor *= 0.5
  if (setup.twist === 'performance' && state.twist.performanceReady) { factor *= FT_TWIST_VALUES.performanceFactor; notes.push('Performance') }
  if (setup.twist === 'fragments' && state.twist.fragmentsReady) { factor *= FT_TWIST_VALUES.fragmentsFactor; notes.push('Fragments') }
  if (setup.twist === 'cooking' && state.twist.dishTrains > 0) { factor *= FT_TWIST_VALUES.cookingFactor; notes.push('Dish') }
  if (setup.twist === 'research' && !race && encounter.facility && state.twist.research[encounter.facility] > 0) {
    factor *= 1 + FT_TWIST_VALUES.researchPerLevel * state.twist.research[encounter.facility]
    notes.push('Research')
  }

  let best: FtTrainResult | null = null
  for (const candidate of candidates) {
    const formationPoints = FT_FORMATIONS[candidate.id].points
    const mult = candidate.mult + multBonus
    const total = Math.round((cardPoints + bonusPoints + formationPoints) * mult * factor)
    if (!best || total > best.total) {
      best = { uids: [...uids], formation: candidate.id, cardPoints, bonusPoints, formationPoints, mult, factor, total, notes }
    }
  }
  return best!
}

// ── Transitions ────────────────────────────────────────────────────────────────────────────────────────────────────

const cloneState = (state: FtState): FtState => ({
  ...state,
  deck: state.deck.map((entry) => ({ ...entry })),
  skills: [...state.skills],
  seenSkills: [...state.seenSkills],
  facilityOffers: state.facilityOffers ? state.facilityOffers.map((offer) => ({ ...offer })) : null,
  encounter: state.encounter
    ? { ...state.encounter, favoured: [...state.encounter.favoured], draw: [...state.encounter.draw], hand: [...state.encounter.hand], discard: [...state.encounter.discard] }
    : null,
  rewardOffer: state.rewardOffer ? [...state.rewardOffer] : null,
  skillOffer: state.skillOffer ? [...state.skillOffer] : null,
  shop: state.shop ? { ...state.shop, bought: [...state.shop.bought] } : null,
  weeksTrained: [...state.weeksTrained],
  trainsByType: { ...state.trainsByType },
  twist: {
    ...state.twist,
    notes: [...state.twist.notes],
    expedition: [...state.twist.expedition],
    ingredients: { ...state.twist.ingredients },
    research: { ...state.twist.research },
    built: [...state.twist.built],
  },
})

const sortHand = (setup: FtSetup, state: FtState, hand: number[]): number[] => [...hand].sort((left, right) => {
  const a = cardOf(setup, state, left)
  const b = cardOf(setup, state, right)
  const mainA = a.instance.cardId === setup.mainCardId ? 0 : 1
  const mainB = b.instance.cardId === setup.mainCardId ? 0 : 1
  return mainA - mainB || TYPE_ORDER.indexOf(a.def.type) - TYPE_ORDER.indexOf(b.def.type) ||
    a.instance.cardId.localeCompare(b.instance.cardId) || left - right
})

function drawCards(setup: FtSetup, state: FtState, count: number): void {
  const encounter = state.encounter!
  for (let drawn = 0; drawn < count; drawn += 1) {
    if (encounter.draw.length === 0) {
      if (encounter.discard.length === 0) break
      const random = ftRng(setup.seed, `reshuffle:${state.stage}:${state.week}:${encounter.reshuffles}`)
      encounter.reshuffles += 1
      encounter.draw = ftShuffle(encounter.discard, random)
      encounter.discard = []
    }
    encounter.hand.push(encounter.draw.shift()!)
  }
  encounter.hand = sortHand(setup, state, encounter.hand)
}

const earningMult = (setup: FtSetup) => FT_EARNING_TARGET_MULT[setup.earning] ?? 1

function openFacilities(setup: FtSetup, state: FtState): void {
  const random = ftRng(setup.seed, `facility:${state.stage}:${state.week}`)
  const types = ftShuffle(STATS, random).slice(0, 3)
  const grades = ftShuffle(FT_FACILITY_GRADES, random)
  const base = FT_WEEK_TARGETS[state.stage]![state.week]! * earningMult(setup)
  state.facilityOffers = types
    .map((type, index) => ({ type, target: roundTarget(base * grades[index]!.target), payout: grades[index]!.payout }))
    .sort((left, right) => left.target - right.target)
  state.phase = 'facility'
}

function startEncounter(setup: FtSetup, state: FtState, offer: FtFacilityOffer | null): void {
  const race = offer === null
  const raceDef = setup.races[state.stage]!
  const rival = race ? FT_RIVAL_RULE_IDS[Math.floor(ftRng(setup.seed, `rival:${state.stage}`)() * FT_RIVAL_RULE_IDS.length)]! : null
  state.encounter = {
    kind: race ? 'race' : 'week',
    facility: offer?.type ?? null,
    favoured: race ? [...ftFavouredTypes(raceDef.distanceCategory, raceDef.surface)] : [],
    rival,
    target: 0,
    payout: race ? FT_RACE_PAYOUT : offer.payout,
    score: 0,
    trainsLeft: 0,
    trainsUsed: 0,
    redrawsLeft: 0,
    draw: [],
    hand: [],
    discard: [],
    reshuffles: 0,
    order: null,
    orderFilled: false,
  }
  const encounter = state.encounter
  state.lastTrain = null
  const skills = ownedSkills(setup, state)
  const duel = ftRivalActive(setup, state, 'duel')
  encounter.target = race ? roundTarget(FT_RACE_TARGETS[state.stage]! * earningMult(setup) * (duel ? 1.25 : 1)) : offer.target
  encounter.trainsLeft = race
    ? FT_RACE_TRAINS + skills.filter((skill) => skill.rule === 'positioning').length + (duel ? 1 : 0)
    : FT_WEEK_TRAINS
  encounter.redrawsLeft = Math.max(0, FT_REDRAWS + skillSum(skills, 'second-wind') +
    skills.filter((skill) => skill.rule === 'vision' && skill.gold).length +
    (!race && setup.twist === 'soak' && state.twist.soakStage === state.stage ? 1 : 0) -
    (ftRivalActive(setup, state, 'fast-pace') ? 1 : 0))
  if (!race && setup.twist === 'orders') {
    encounter.order = FT_ORDER_FORMATIONS[Math.floor(ftRng(setup.seed, `order:${state.stage}:${state.week}`)() * FT_ORDER_FORMATIONS.length)]!
  }
  // The whole deck is shuffled, the main card goes into the hand, and the hand fills.
  const shuffled = ftShuffle(state.deck.map((entry) => entry.uid), ftRng(setup.seed, `shuffle:${state.stage}:${state.week}`))
  const main = shuffled.findIndex((uid) => cardOf(setup, state, uid).instance.cardId === setup.mainCardId)
  if (main >= 0) encounter.hand.push(...shuffled.splice(main, 1))
  encounter.draw = shuffled
  drawCards(setup, state, ftHandSize(setup, state) - encounter.hand.length)
  state.facilityOffers = null
  state.phase = 'encounter'
}

function offerCards(setup: FtSetup, state: FtState, purpose: string): string[] {
  return ftShuffle(setup.rewardPool, ftRng(setup.seed, purpose)).slice(0, FT_OFFER_SIZE)
}

function offerSkills(setup: FtSetup, state: FtState): string[] {
  const open = (ids: readonly string[]) => ids.filter((id) => !state.skills.includes(id))
  const fresh = (ids: readonly string[]) => open(ids).filter((id) => !state.seenSkills.includes(id))
  const random = ftRng(setup.seed, `skill:${state.stage}`)
  const pick = (ids: readonly string[]) => ids.length > 0 ? ids[Math.floor(random() * ids.length)]! : null
  const offer: string[] = []
  for (const source of [setup.skillSources.main, setup.skillSources.deck, setup.skillSources.pool]) {
    const chosen = pick(fresh(source).filter((id) => !offer.includes(id)))
    if (chosen) offer.push(chosen)
  }
  const rest = ftShuffle(open([...setup.skillSources.main, ...setup.skillSources.deck, ...setup.skillSources.pool]).filter((id) => !offer.includes(id)), random)
  while (offer.length < FT_OFFER_SIZE && rest.length > 0) offer.push(rest.shift()!)
  return offer
}

function stockShop(setup: FtSetup, state: FtState, rerolls: number): FtShop {
  const random = ftRng(setup.seed, `shop:${state.stage}:${rerolls}`)
  const all = [...setup.skillSources.main, ...setup.skillSources.deck, ...setup.skillSources.pool]
  const open = ftShuffle(all.filter((id) => !state.skills.includes(id)), random)
  return {
    copy: setup.rewardPool.length > 0 ? setup.rewardPool[Math.floor(random() * setup.rewardPool.length)]! : null,
    white: open.find((id) => !setup.skills[id]!.gold) ?? null,
    gold: open.find((id) => setup.skills[id]!.gold) ?? null,
    bought: [],
    rerolls,
  }
}

function addSkill(state: FtState, skillId: string, replace: number | undefined): void {
  if (state.skills.includes(skillId)) fail('That skill is already in your bar')
  if (state.skills.length < FT_SKILL_SLOTS) {
    state.skills.push(skillId)
    return
  }
  if (replace === undefined || !Number.isInteger(replace) || replace < 0 || replace >= state.skills.length) {
    fail('The skill bar is full: choose a slot to replace')
  }
  state.skills[replace!] = skillId
}

function nextAfterReward(setup: FtSetup, state: FtState): void {
  // A week's reward is chosen; the next week or the race follows.
  if (state.week + 1 < FT_WEEKS_PER_STAGE) {
    state.week += 1
    openFacilities(setup, state)
  } else {
    state.week = FT_WEEKS_PER_STAGE
    startEncounter(setup, state, null)
  }
}

function clearEncounter(setup: FtSetup, state: FtState): void {
  const encounter = state.encounter!
  state.fans += encounter.payout + FT_UNUSED_TRAIN_FANS * encounter.trainsLeft
  if (encounter.kind === 'week') {
    const facility = encounter.facility!
    if (setup.twist === 'research') state.twist.research[facility] += 1
    if (setup.twist === 'cooking') {
      state.twist.ingredients[facility] += 1
      if (state.twist.ingredients[facility] >= FT_TWIST_VALUES.cookingNeeded) {
        state.twist.ingredients[facility] -= FT_TWIST_VALUES.cookingNeeded
        state.twist.dishTrains += FT_TWIST_VALUES.cookingTrains
      }
    }
    state.encounter = null
    state.rewardOffer = offerCards(setup, state, `reward:${state.stage}:${state.week}`)
    state.phase = 'reward'
    return
  }
  state.twist.racesWon += 1
  if (setup.twist === 'expedition' && !state.twist.expedition.includes(encounter.favoured[0]!)) state.twist.expedition.push(encounter.favoured[0]!)
  if (setup.twist === 'soak') state.twist.soakStage = state.stage + 1
  state.encounter = null
  if (state.stage + 1 >= ftStageCount(setup)) {
    state.phase = 'won'
    return
  }
  state.skillOffer = offerSkills(setup, state)
  state.phase = state.skillOffer.length > 0 ? 'skill' : 'shop'
  if (state.phase === 'shop') state.shop = stockShop(setup, state, 0)
}

function train(setup: FtSetup, state: FtState, uids: readonly number[]): void {
  const encounter = state.encounter!
  if (uids.length < 1 || uids.length > FT_MAX_TRAIN) fail(`Train with 1 to ${FT_MAX_TRAIN} cards`)
  if (new Set(uids).size !== uids.length || uids.some((uid) => !encounter.hand.includes(uid))) fail('Train only with cards in your hand')
  const result = ftScoreTrain(setup, state, uids)
  const cards = uids.map((uid) => cardOf(setup, state, uid))

  // Traits that act after the train, read before the gauge moves.
  let fans = 0
  let extraDraws = 0
  for (const { instance, def } of cards) {
    for (const { kind, scale } of ftTraits(setup, state, instance, def)) {
      if (kind === 'skillPointBonus') fans += scale
      if (kind === 'hintFrequency') extraDraws += Math.round(scale)
    }
  }
  state.fans += Math.round(fans)

  encounter.score += result.total
  encounter.trainsUsed += 1
  encounter.trainsLeft -= 1
  state.lastTrain = result
  if (!state.bonded && cards.some(({ instance }) => instance.cardId === setup.mainCardId)) {
    state.gauge = Math.min(FT_BOND_GAUGE, state.gauge + 1)
    if (state.gauge >= FT_BOND_GAUGE) state.bonded = true
  }
  if (encounter.kind === 'week') state.trainsByType[encounter.facility!] += 1

  // Twists that count trains.
  const twist = state.twist
  if (setup.twist === 'performance') {
    if (twist.performanceReady) twist.performanceReady = false
    else {
      for (const { def } of cards) {
        const stat = statOf(def)
        if (stat !== null && !twist.notes.includes(stat)) twist.notes.push(stat)
      }
      if (twist.notes.length >= STATS.length) {
        twist.notes = []
        twist.performanceReady = true
      }
    }
  }
  if (setup.twist === 'fragments') {
    if (twist.fragmentsReady) twist.fragmentsReady = false
    const high = cards.some(({ def }) => (setup.legendsCardId === def.id ? FT_TWIST_VALUES.legendsStars : def.stars) >= FT_TWIST_VALUES.fragmentsStars)
    twist.fragments += high ? 2 : 1
    if (twist.fragments >= FT_TWIST_VALUES.fragmentsNeeded) {
      twist.fragments -= FT_TWIST_VALUES.fragmentsNeeded
      twist.fragmentsReady = true
    }
  }
  if (setup.twist === 'cooking' && twist.dishTrains > 0) twist.dishTrains -= 1
  if (setup.twist === 'orders' && encounter.order && !encounter.orderFilled && result.formation === encounter.order) {
    encounter.orderFilled = true
    state.fans += FT_TWIST_VALUES.ordersFans
  }

  if (encounter.score >= encounter.target) {
    clearEncounter(setup, state)
    return
  }
  if (encounter.trainsLeft <= 0) {
    state.phase = 'lost'
    state.lossReason = encounter.kind === 'race' ? 'The race got away.' : 'The week missed its target.'
    return
  }
  encounter.hand = encounter.hand.filter((uid) => !uids.includes(uid))
  encounter.discard.push(...uids)
  drawCards(setup, state, Math.max(0, ftHandSize(setup, state) - encounter.hand.length) + extraDraws)
}

function redraw(setup: FtSetup, state: FtState, uids: readonly number[]): void {
  const encounter = state.encounter!
  if (encounter.redrawsLeft <= 0) fail('No redraws left')
  if (uids.length < 1 || uids.length > FT_MAX_REDRAW) fail(`Redraw 1 to ${FT_MAX_REDRAW} cards`)
  if (new Set(uids).size !== uids.length || uids.some((uid) => !encounter.hand.includes(uid))) fail('Redraw only cards in your hand')
  encounter.redrawsLeft -= 1
  encounter.hand = encounter.hand.filter((uid) => !uids.includes(uid))
  encounter.discard.push(...uids)
  drawCards(setup, state, uids.length)
}

function buy(setup: FtSetup, state: FtState, action: Extract<FtAction, { type: 'buy' }>): void {
  const shop = state.shop!
  const price = FT_SHOP_PRICES[action.item]
  if (price === undefined) fail('The shop does not sell that')
  if (state.fans < price) fail('Not enough fans')
  if (action.item !== 'reroll' && shop.bought.includes(action.item)) fail('Already bought this visit')
  switch (action.item) {
    case 'copy':
      if (!shop.copy) fail('No card to buy')
      state.deck.push({ uid: state.nextUid, cardId: shop.copy!, bonus: 0 })
      state.nextUid += 1
      break
    case 'remove': {
      const index = state.deck.findIndex((entry) => entry.uid === action.uid)
      if (index < 0) fail('Choose a card in your deck to remove')
      if (state.deck.length <= FT_HAND_SIZE + 1) fail('The deck is as small as it can be')
      state.deck.splice(index, 1)
      break
    }
    case 'upgrade': {
      const instance = state.deck.find((entry) => entry.uid === action.uid) ?? fail('Choose a card in your deck to upgrade')
      instance.bonus += FT_UPGRADE_POINTS
      break
    }
    case 'white':
    case 'gold': {
      const skillId = shop[action.item] ?? fail('No skill to buy')
      addSkill(state, skillId, action.replace)
      state.seenSkills.push(skillId)
      break
    }
    case 'reroll': {
      const next = stockShop(setup, state, shop.rerolls + 1)
      state.shop = { ...next, bought: shop.bought.filter((item) => item === 'remove' || item === 'upgrade') }
      state.fans -= price
      return
    }
  }
  state.fans -= price
  shop.bought.push(action.item)
}

/** The run's opening state. */
export function ftStart(setup: FtSetup): FtState {
  const state: FtState = {
    phase: 'facility',
    stage: 0,
    week: 0,
    deck: setup.deck.map((cardId, index) => ({ uid: index + 1, cardId, bonus: 0 })),
    nextUid: setup.deck.length + 1,
    skills: [],
    seenSkills: [],
    fans: 0,
    gauge: 0,
    bonded: false,
    facilityOffers: null,
    encounter: null,
    rewardOffer: null,
    skillOffer: null,
    shop: null,
    lastTrain: null,
    weeksTrained: [],
    trainsByType: zeroByStat(),
    twist: {
      racesWon: 0,
      notes: [],
      performanceReady: false,
      fragments: 0,
      fragmentsReady: false,
      expedition: [],
      ingredients: zeroByStat(),
      dishTrains: 0,
      research: zeroByStat(),
      built: [],
      soakStage: null,
    },
    lossReason: null,
  }
  if (setup.twist === 'construction') state.phase = 'build'
  else openFacilities(setup, state)
  return state
}

/** One choice applied to a run; throws FtActionError when the choice is not allowed now. */
export function ftApply(setup: FtSetup, current: FtState, action: FtAction): FtState {
  if (current.phase === 'won' || current.phase === 'lost') fail('The run is over')
  const state = cloneState(current)
  if (action.type === 'give-up') {
    state.phase = 'lost'
    state.lossReason = 'Gave up.'
    return state
  }
  switch (state.phase) {
    case 'build': {
      if (action.type !== 'build') fail('Build two facilities first')
      const facilities = (action as Extract<FtAction, { type: 'build' }>).facilities
      if (facilities.length !== FT_TWIST_VALUES.constructionBuilds || new Set(facilities).size !== facilities.length ||
        facilities.some((type) => !STATS.includes(type))) fail('Build two different facilities')
      state.twist.built = [...facilities]
      openFacilities(setup, state)
      return state
    }
    case 'facility': {
      if (action.type !== 'facility') fail('Choose a facility')
      const offer = state.facilityOffers?.[(action as Extract<FtAction, { type: 'facility' }>).index] ?? fail('No such facility')
      state.weeksTrained.push(offer.type)
      startEncounter(setup, state, offer)
      return state
    }
    case 'encounter':
      if (action.type === 'train') train(setup, state, action.uids)
      else if (action.type === 'redraw') redraw(setup, state, action.uids)
      else fail('Train or redraw')
      return state
    case 'reward': {
      if (action.type !== 'reward') fail('Choose a card or skip')
      const cardId = (action as Extract<FtAction, { type: 'reward' }>).cardId
      if (cardId !== null) {
        if (!state.rewardOffer?.includes(cardId)) fail('That card was not offered')
        state.deck.push({ uid: state.nextUid, cardId, bonus: 0 })
        state.nextUid += 1
      }
      state.rewardOffer = null
      nextAfterReward(setup, state)
      return state
    }
    case 'skill': {
      if (action.type !== 'skill') fail('Choose a skill or skip')
      const { skillId, replace } = action as Extract<FtAction, { type: 'skill' }>
      state.seenSkills.push(...(state.skillOffer ?? []).filter((id) => !state.seenSkills.includes(id)))
      if (skillId !== null) {
        if (!state.skillOffer?.includes(skillId)) fail('That skill was not offered')
        addSkill(state, skillId, replace)
      }
      state.skillOffer = null
      state.phase = 'shop'
      state.shop = stockShop(setup, state, 0)
      return state
    }
    case 'shop':
      if (action.type === 'buy') {
        buy(setup, state, action)
        return state
      }
      if (action.type !== 'leave-shop') fail('Buy something or leave')
      state.shop = null
      state.stage += 1
      state.week = 0
      openFacilities(setup, state)
      return state
    default:
      return fail('The run is over')
  }
}

/** A run from its setup and its choices: what a reload resumes and a commit checks. */
export function ftReplay(setup: FtSetup, actions: readonly FtAction[]): FtState {
  let state = ftStart(setup)
  for (const action of actions) state = ftApply(setup, state, action)
  return state
}

export const ftFinished = (state: FtState): boolean => state.phase === 'won' || state.phase === 'lost'
