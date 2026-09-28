// A Friendship Training run's frozen setup (D168): everything the run can show, resolved from content and the save when
// the run begins, so the run replays from it exactly even if content changes mid-run.

import { CARD_EFFECTS, MAX_STARS, cardUniqueEffectKinds, type CardEffect } from '../../cards'
import type { RaceTemplate, SkillTemplate, SupportCardTemplate } from '../../content'
import {
  FT_DECK_COPIES,
  FT_SET_OTHERS,
  FT_SKILL_RULES,
  FT_STAGES,
  FT_STAGE_GRADES,
  FT_TWISTS,
  ftTwist,
  type FtCardType,
  type FtSkillRuleId,
  type FtTwistId,
} from './rules'
import { skillTags } from '../../skill-tags'
import {
  DISTANCE_CATEGORIES,
  RACE_GRADES,
  STATS,
  SURFACES,
  type DistanceCategory,
  type RaceGrade,
  type StatKey,
  type Surface,
} from '../../types'

export interface FtCardDef {
  id: string
  charaId: string
  name: string
  title: string
  type: FtCardType
  trait: CardEffect
  /** Its unique effect's kinds, played at ×1.5 once the main card bonds; its own trait when none match. */
  signature: CardEffect[]
  /** Its stars in this scenario; strength is `1 + 0.1 × stars`. */
  stars: number
}

export interface FtSkillDef {
  id: string
  name: string
  description: string
  gold: boolean
  rule: FtSkillRuleId
  /** Aptitude: the stat the green skill raises. */
  stat?: StatKey
}

export interface FtRaceDef {
  id: string
  name: string
  grade: RaceGrade
  distance: number
  distanceCategory: DistanceCategory
  surface: Surface
}

export interface FtSetup {
  version: 1
  seed: number
  tier: number
  twist: FtTwistId
  /** The star a clear grants, 1–5. */
  earning: number
  mainCardId: string
  /** The starting deck's card ids, copies included. */
  deck: string[]
  /** Every card the run can show: the deck and the reward pool. */
  cards: Record<string, FtCardDef>
  /** Owned, era-eligible cards that rewards and the shop draw from, sorted. */
  rewardPool: string[]
  skills: Record<string, FtSkillDef>
  /** Skill offers draw from the main card's hints first, then the deck's, then the pool. */
  skillSources: { main: string[]; deck: string[]; pool: string[] }
  /** One race per stage. */
  races: FtRaceDef[]
  /** Legends: the card that plays as if at 5★. */
  legendsCardId: string | null
}

/** A seeded mulberry32 stream per purpose, so no RNG state has to be carried between actions. */
export function ftRng(seed: number, purpose: string): () => number {
  let state = seed >>> 0
  for (let index = 0; index < purpose.length; index += 1) {
    state = Math.imul(state ^ purpose.charCodeAt(index), 0x01000193) >>> 0
  }
  state = (state ^ 0x9e3779b9) >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function ftShuffle<T>(items: readonly T[], random: () => number): T[] {
  const result = [...items]
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(random() * (index + 1))
    ;[result[index], result[swap]] = [result[swap]!, result[index]!]
  }
  return result
}

/** The trait from a card's strongest effect-profile weight; ties go to the earlier effect. */
export function ftTrait(template: Pick<SupportCardTemplate, 'effectProfile'>): CardEffect {
  let best: CardEffect = CARD_EFFECTS[0]
  for (const effect of CARD_EFFECTS) {
    if ((template.effectProfile[effect] ?? 0) > (template.effectProfile[best] ?? 0)) best = effect
  }
  return best
}

export function ftCardDef(template: SupportCardTemplate, stars: number): FtCardDef {
  const trait = ftTrait(template)
  const unique = CARD_EFFECTS.filter((effect) => cardUniqueEffectKinds(template).has(effect))
  return {
    id: template.id,
    charaId: template.charaId,
    name: template.charName,
    title: template.title,
    type: template.type,
    trait,
    signature: unique.length > 0 ? unique : [trait],
    stars: Math.min(MAX_STARS, Math.max(0, Math.trunc(stars))),
  }
}

const STAT_EFFECT_TYPES: Readonly<Record<number, StatKey>> = { 1: 'speed', 2: 'stamina', 3: 'power', 4: 'guts', 5: 'wit' }
const EFFECT_PRIORITY = ['start', 'recovery', 'vision', 'lane', 'acceleration', 'speed', 'stats', 'debuff'] as const

/** A skill's run rule, from its effect and where it fires (D168). */
export function ftSkillRule(skill: Pick<SkillTemplate, 'conditions'>): { rule: FtSkillRuleId; stat?: StatKey } {
  const tags = skillTags(skill)
  const effect = EFFECT_PRIORITY.find((candidate) => tags.effects.includes(candidate))
  switch (effect) {
    case 'start': return { rule: 'gate' }
    case 'recovery': return { rule: 'second-wind' }
    case 'vision': return { rule: 'vision' }
    case 'lane': return { rule: 'positioning' }
    case 'acceleration': return { rule: 'kick' }
    case 'speed':
      if (tags.places.includes('corner') || tags.places.includes('final-corner')) return { rule: 'corner' }
      if (tags.places.includes('straight') || tags.places.includes('final-straight')) return { rule: 'straight' }
      if (tags.phases.includes('late') || tags.phases.includes('spurt')) return { rule: 'spurt' }
      return { rule: 'surge' }
    case 'stats': {
      const code = skill.conditions.flatMap((group) => group.effects).map((entry) => entry.type).find((type) => type in STAT_EFFECT_TYPES)
      return { rule: 'aptitude', stat: STAT_EFFECT_TYPES[code ?? 1] }
    }
    case 'debuff': return { rule: 'pressure' }
    default: return { rule: 'form' }
  }
}

export function ftSkillDef(skill: SkillTemplate): FtSkillDef {
  const { rule, stat } = ftSkillRule(skill)
  return { id: skill.id, name: skill.name, description: skill.description, gold: skill.kind === 'gold', rule, ...(stat ? { stat } : {}) }
}

const isRunSkill = (skill: SkillTemplate | undefined): skill is SkillTemplate =>
  skill !== undefined && (skill.kind === 'white' || skill.kind === 'gold')

/** How many learnable white and gold skills beyond the deck's hints a run can offer. */
export const FT_SKILL_POOL_SIZE = 40

export interface BuildFriendshipSetupInput {
  seed: number
  tier: number
  /** The main card's stars before this run; the run earns the next one. */
  mainStars: number
  mainCard: SupportCardTemplate
  /** The set the run was launched from (may include the main card); empty when launched without an Uma. */
  setCardIds: readonly string[]
  /** Every owned card with its stars in this scenario. */
  owned: readonly { template: SupportCardTemplate; stars: number }[]
  skills: readonly SkillTemplate[]
  races: readonly RaceTemplate[]
}

export function buildFriendshipSetup(input: BuildFriendshipSetupInput): FtSetup {
  const { seed, tier, mainCard } = input
  if (!Number.isSafeInteger(input.mainStars) || input.mainStars < 0 || input.mainStars >= MAX_STARS) {
    throw new Error('Friendship Training needs a card from 0★ through 4★')
  }
  const earning = input.mainStars + 1
  const eligible = input.owned
    .filter(({ template }) => template.era <= tier)
    .sort((left, right) => left.template.id.localeCompare(right.template.id))
  const starsOf = new Map(eligible.map(({ template, stars }) => [template.id, stars]))
  const templates = new Map(eligible.map(({ template }) => [template.id, template]))
  templates.set(mainCard.id, mainCard)

  // Two of the main card, two of each other set card, topped up from owned cards by the seed.
  const others = [...new Set(input.setCardIds)].filter((id) => id !== mainCard.id && templates.has(id)).slice(0, FT_SET_OTHERS)
  const fill = ftShuffle(eligible.map(({ template }) => template.id).filter((id) => id !== mainCard.id && !others.includes(id)), ftRng(seed, 'top-up'))
  while (others.length < FT_SET_OTHERS && fill.length > 0) others.push(fill.shift()!)
  const deck = [mainCard.id, ...others].flatMap((id) => Array.from({ length: FT_DECK_COPIES }, () => id))

  const rewardPool = eligible.map(({ template }) => template.id)
  const cards: Record<string, FtCardDef> = {}
  for (const id of new Set([...deck, ...rewardPool])) {
    cards[id] = ftCardDef(templates.get(id)!, id === mainCard.id ? input.mainStars : starsOf.get(id) ?? 0)
  }

  // Skills: the main card's hints, the deck's, then a seeded slice of the learnable pool.
  const byId = new Map(input.skills.map((skill) => [skill.id, skill]))
  const hints = (id: string) => (templates.get(id)?.hintSkillIds ?? []).filter((skillId) => isRunSkill(byId.get(skillId)))
  const main = [...new Set(hints(mainCard.id))]
  const deckHints = [...new Set(others.flatMap(hints))].filter((id) => !main.includes(id))
  const learnable = input.skills.filter(isRunSkill).map((skill) => skill.id).filter((id) => !main.includes(id) && !deckHints.includes(id)).sort()
  const pool = ftShuffle(learnable, ftRng(seed, 'skill-pool')).slice(0, FT_SKILL_POOL_SIZE)
  const skills: Record<string, FtSkillDef> = {}
  for (const id of [...main, ...deckHints, ...pool]) skills[id] = ftSkillDef(byId.get(id)!)

  // One real race of each stage's grade.
  const stages = FT_STAGES[earning]!
  const races: FtRaceDef[] = []
  for (let stage = 0; stage < stages; stage += 1) {
    const grade = FT_STAGE_GRADES[stage]!
    const candidates = input.races.filter((race) => race.grade === grade).sort((left, right) => left.id.localeCompare(right.id))
    if (candidates.length === 0) throw new Error(`No ${grade.toUpperCase()} race to run`)
    const race = candidates[Math.floor(ftRng(seed, `race:${stage}`)() * candidates.length)]!
    races.push({ id: race.id, name: race.name, grade, distance: race.distance, distanceCategory: race.distanceCategory, surface: race.surface })
  }

  const twist = ftTwist(tier).id
  const legendsCandidates = others.filter((id) => cards[id]!.stars < MAX_STARS)
  const legendsCardId = twist === 'legends' && legendsCandidates.length > 0
    ? legendsCandidates[Math.floor(ftRng(seed, 'legends')() * legendsCandidates.length)]!
    : null

  return {
    version: 1,
    seed,
    tier,
    twist,
    earning,
    mainCardId: mainCard.id,
    deck,
    cards,
    rewardPool,
    skills,
    skillSources: { main, deck: deckHints, pool },
    races,
    legendsCardId,
  }
}

/** The stat types, for callers that iterate facilities. */
export const FT_STATS: readonly StatKey[] = STATS

type UnknownRecord = Record<string, unknown>

const FT_SETUP_TEXT_LIMIT = 1_000
const FT_SETUP_CARD_LIMIT = 512
const FT_SETUP_SKILL_LIMIT = 256
const FT_SETUP_DECK_LIMIT = 64
const FT_CARD_TYPES = [...STATS, 'friend', 'group'] as const

const isRecord = (value: unknown): value is UnknownRecord =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

function exactKeys(value: UnknownRecord, expected: readonly string[]): boolean {
  const actual = Object.keys(value).sort()
  const wanted = [...expected].sort()
  return actual.length === wanted.length && actual.every((key, index) => key === wanted[index])
}

const boundedText = (value: unknown, maximum = FT_SETUP_TEXT_LIMIT, allowEmpty = false): value is string =>
  typeof value === 'string' && (allowEmpty || value.length > 0) && value.length <= maximum

const boundedInteger = (value: unknown, minimum: number, maximum: number): value is number =>
  Number.isSafeInteger(value) && (value as number) >= minimum && (value as number) <= maximum

function stringList(value: unknown, maximum: number, allowEmpty = true): string[] | null {
  if (!Array.isArray(value) || value.length > maximum || (!allowEmpty && value.length === 0)) return null
  return value.every((entry) => boundedText(entry, 160)) ? [...value] : null
}

function parseCardDef(value: unknown): FtCardDef | null {
  if (!isRecord(value) || !exactKeys(value, ['charaId', 'id', 'name', 'signature', 'stars', 'title', 'trait', 'type']) ||
    !boundedText(value.id, 160) || !boundedText(value.charaId, 160) || !boundedText(value.name, FT_SETUP_TEXT_LIMIT, true) ||
    !boundedText(value.title, FT_SETUP_TEXT_LIMIT, true) || !FT_CARD_TYPES.includes(value.type as FtCardType) ||
    !CARD_EFFECTS.includes(value.trait as CardEffect) || !boundedInteger(value.stars, 0, MAX_STARS) ||
    !Array.isArray(value.signature) || value.signature.length < 1 || value.signature.length > CARD_EFFECTS.length ||
    !value.signature.every((entry) => CARD_EFFECTS.includes(entry as CardEffect))) return null
  return {
    id: value.id,
    charaId: value.charaId,
    name: value.name,
    title: value.title,
    type: value.type as FtCardType,
    trait: value.trait as CardEffect,
    signature: [...value.signature] as CardEffect[],
    stars: value.stars,
  }
}

function parseSkillDef(value: unknown): FtSkillDef | null {
  if (!isRecord(value) || !exactKeys(value, value.stat === undefined
    ? ['description', 'gold', 'id', 'name', 'rule']
    : ['description', 'gold', 'id', 'name', 'rule', 'stat']) ||
    !boundedText(value.id, 160) || !boundedText(value.name, FT_SETUP_TEXT_LIMIT, true) ||
    !boundedText(value.description, FT_SETUP_TEXT_LIMIT, true) ||
    typeof value.gold !== 'boolean' || typeof value.rule !== 'string' || !Object.hasOwn(FT_SKILL_RULES, value.rule) ||
    (value.stat !== undefined && !STATS.includes(value.stat as StatKey))) return null
  return {
    id: value.id,
    name: value.name,
    description: value.description,
    gold: value.gold,
    rule: value.rule as FtSkillRuleId,
    ...(value.stat === undefined ? {} : { stat: value.stat as StatKey }),
  }
}

function parseRaceDef(value: unknown): FtRaceDef | null {
  if (!isRecord(value) || !exactKeys(value, ['distance', 'distanceCategory', 'grade', 'id', 'name', 'surface']) ||
    !boundedText(value.id, 160) || !boundedText(value.name, FT_SETUP_TEXT_LIMIT, true) ||
    !RACE_GRADES.includes(value.grade as RaceGrade) ||
    !boundedInteger(value.distance, 100, 10_000) ||
    !DISTANCE_CATEGORIES.includes(value.distanceCategory as DistanceCategory) ||
    !SURFACES.includes(value.surface as Surface)) return null
  return {
    id: value.id,
    name: value.name,
    grade: value.grade as RaceGrade,
    distance: value.distance,
    distanceCategory: value.distanceCategory as DistanceCategory,
    surface: value.surface as Surface,
  }
}

function parseRecord<T>(
  value: unknown,
  maximum: number,
  parser: (entry: unknown) => T | null,
  idOf: (entry: T) => string,
): Record<string, T> | null {
  if (!isRecord(value) || Object.keys(value).length > maximum) return null
  const result: Record<string, T> = {}
  for (const [id, raw] of Object.entries(value)) {
    if (!boundedText(id, 160)) return null
    const parsed = parser(raw)
    if (!parsed || idOf(parsed) !== id) return null
    result[id] = parsed
  }
  return result
}

/** Strict, bounded parser for the frozen Friendship Training inputs stored in a device-local journal. */
export function parseFtSetup(value: unknown): FtSetup | null {
  if (!isRecord(value) || !exactKeys(value, [
    'cards', 'deck', 'earning', 'legendsCardId', 'mainCardId', 'races', 'rewardPool', 'seed', 'skillSources',
    'skills', 'tier', 'twist', 'version',
  ]) || value.version !== 1 || !boundedInteger(value.seed, 0, 0xffff_ffff) ||
    !boundedInteger(value.tier, 1, FT_TWISTS.length) || !boundedInteger(value.earning, 1, MAX_STARS) ||
    !boundedText(value.mainCardId, 160) || !Object.hasOwn(FT_TWISTS, Number(value.tier) - 1) ||
    ftTwist(value.tier as number).id !== value.twist) return null

  const cards = parseRecord(value.cards, FT_SETUP_CARD_LIMIT, parseCardDef, (entry) => entry.id)
  const skills = parseRecord(value.skills, FT_SETUP_SKILL_LIMIT, parseSkillDef, (entry) => entry.id)
  const deck = stringList(value.deck, FT_SETUP_DECK_LIMIT, false)
  const rewardPool = stringList(value.rewardPool, FT_SETUP_CARD_LIMIT)
  if (!cards || !skills || !deck || !rewardPool || !cards[value.mainCardId]) return null
  if (deck.some((id) => !cards[id]) || rewardPool.some((id) => !cards[id])) return null

  if (!isRecord(value.skillSources) || !exactKeys(value.skillSources, ['deck', 'main', 'pool'])) return null
  const main = stringList(value.skillSources.main, FT_SETUP_SKILL_LIMIT)
  const deckSkills = stringList(value.skillSources.deck, FT_SETUP_SKILL_LIMIT)
  const pool = stringList(value.skillSources.pool, FT_SETUP_SKILL_LIMIT)
  if (!main || !deckSkills || !pool || [...main, ...deckSkills, ...pool].some((id) => !skills[id])) return null

  if (!Array.isArray(value.races) || value.races.length < 1 || value.races.length > 3) return null
  const races = value.races.map(parseRaceDef)
  if (races.some((race) => race === null)) return null
  if (value.legendsCardId !== null && (!boundedText(value.legendsCardId, 160) || !cards[value.legendsCardId])) return null

  return {
    version: 1,
    seed: value.seed,
    tier: value.tier,
    twist: value.twist as FtTwistId,
    earning: value.earning,
    mainCardId: value.mainCardId,
    deck,
    cards,
    rewardPool,
    skills,
    skillSources: { main, deck: deckSkills, pool },
    races: races as FtRaceDef[],
    legendsCardId: value.legendsCardId as string | null,
  }
}
