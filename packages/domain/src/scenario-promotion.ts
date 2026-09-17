// Scenario completion, parent snapshots, and promotion (docs/tasks/T012-scenario-promotion-and-save-v2.md).

import { projectedCardEffectValue } from './cards'
import type { SkillTemplate, UmaTemplate } from './content'
import { umaPromotionCost } from './economy'
import { expToNextUmaLevel, PROMOTION_BONUS_PER_STAT, UMA_LEVEL_TICKET_REWARD } from './progression'
import { LEVELS_PER_SCENARIO, SCENARIOS, isGateLevel, scenarioForTier, tierOfLevel } from './scenarios'
import {
  SAVE_ID_PATTERN,
  parsePlayerProfile,
  parseUmaSave,
  type FrozenParent,
  type LedgerEntry,
  type ParentSnapshot,
  type PlayerProfile,
  type SkillHistoryEntry,
  type SkillUnlock,
  type UmaSave,
} from './save'
import { supportDeckIssueMessage, validateEquippedSupportDeck, type SupportDeckCard } from './support-deck'
import { STATS, type StatKey, type Stats } from './types'

export interface PromotionLedgerDescriptor {
  id: string
  data: LedgerEntry
}

export interface PromotionCardBonus {
  cardId: string
  stat: StatKey
  amount: number
}

export interface ScenarioPromotionResult {
  profile: PlayerProfile
  uma: UmaSave
  fromTier: number
  toTier: number
  cost: number
  snapshot: ParentSnapshot
  baseStatBonus: Stats
  cardBonuses: PromotionCardBonus[]
  awakeningSkillId: string | null
  overflowLevel: number | null
  ledger: PromotionLedgerDescriptor[]
}

export interface ScenarioPromotionInput {
  profile: PlayerProfile
  uma: UmaSave
  umaTemplate: UmaTemplate
  skills: ReadonlyMap<string, SkillTemplate>
  cards: readonly SupportDeckCard[]
  now: number
}

export interface PromotionReadiness {
  ready: boolean
  final: boolean
  fromTier: number
  toTier: number | null
  cost: number | null
  reason: string | null
}

const cloneAptitudes = (aptitudes: UmaSave['aptitudes']): UmaSave['aptitudes'] => ({
  surface: { ...aptitudes.surface },
  distance: { ...aptitudes.distance },
  strategy: { ...aptitudes.strategy },
})

function assertTimestamp(value: number): void {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error('Promotion time is invalid')
}

function assertTemplate(input: ScenarioPromotionInput): void {
  if (input.umaTemplate.id !== input.uma.templateId || !SAVE_ID_PATTERN.test(input.umaTemplate.charaId)) {
    throw new Error('Uma content does not match the saved Uma')
  }
  const awakeningIds = input.umaTemplate.awakeningSkillIds
  if (new Set(awakeningIds).size !== awakeningIds.length || awakeningIds.some((id) => !SAVE_ID_PATTERN.test(id))) {
    throw new Error(`Uma ${input.uma.templateId} has malformed awakening references`)
  }
  for (const id of awakeningIds) {
    const skill = input.skills.get(id)
    if (!skill || skill.id !== id) throw new Error(`Awakening skill ${id} is missing from current content`)
  }
  if (input.umaTemplate.uniqueSkillId !== null) {
    const unique = input.skills.get(input.umaTemplate.uniqueSkillId)
    if (!unique || unique.kind !== 'unique') throw new Error('Uma unique skill is missing or malformed')
    if (unique.inheritedSkillId !== null) {
      const inherited = input.skills.get(unique.inheritedSkillId)
      if (!inherited || inherited.kind !== 'inherited-unique' || inherited.id === unique.id) {
        throw new Error(`Unique skill ${unique.id} has an invalid inherited counterpart`)
      }
    }
  }
}

function frozenParent(parent: FrozenParent): FrozenParent {
  return {
    ...parent,
    aptitudes: cloneAptitudes(parent.aptitudes),
    inheritableWhiteSkillIds: [...parent.inheritableWhiteSkillIds],
  }
}

/** Freeze only direct card-origin whites (or the normal counterpart of a direct gold). */
export function buildParentSnapshot(input: {
  uma: UmaSave
  umaTemplate: UmaTemplate
  skills: ReadonlyMap<string, SkillTemplate>
  now: number
}): ParentSnapshot {
  assertTimestamp(input.now)
  if (!parseUmaSave(input.uma)) throw new Error('Uma save is malformed')
  if (input.uma.templateId !== input.umaTemplate.id || !SAVE_ID_PATTERN.test(input.umaTemplate.charaId)) {
    throw new Error('Uma content does not match the saved Uma')
  }
  const inheritable = new Set<string>()
  for (const unlock of input.uma.skillLibrary) {
    const skill = input.skills.get(unlock.skillId)
    if (!skill) throw new Error(`Skill ${unlock.skillId} is missing from current content`)
    if (skill.id !== unlock.skillId) throw new Error(`Skill ${unlock.skillId} has mismatched content`)
    if (skill.normalSkillId !== null) {
      const normal = input.skills.get(skill.normalSkillId)
      if (!normal || normal.kind !== 'white' || normal.id === skill.id) {
        throw new Error(`Skill ${skill.id} has an invalid normal counterpart`)
      }
    }
    if (unlock.origin !== 'card') continue
    if (skill.kind === 'white') inheritable.add(skill.id)
    if (skill.kind === 'gold' && skill.normalSkillId !== null) inheritable.add(skill.normalSkillId)
  }

  let inheritedUniqueSkillId: string | null = null
  if (input.umaTemplate.uniqueSkillId !== null) {
    const unique = input.skills.get(input.umaTemplate.uniqueSkillId)
    if (!unique || unique.kind !== 'unique') throw new Error('Uma unique skill is missing or malformed')
    if (unique.inheritedSkillId !== null) {
      const inherited = input.skills.get(unique.inheritedSkillId)
      if (!inherited || inherited.kind !== 'inherited-unique' || inherited.id === unique.id) {
        throw new Error(`Unique skill ${unique.id} has an invalid inherited counterpart`)
      }
      inheritedUniqueSkillId = inherited.id
    }
  }

  return {
    umaId: input.uma.templateId,
    charaId: input.umaTemplate.charaId,
    completedTier: tierOfLevel(input.uma.level),
    takenAt: input.now,
    inheritedUniqueSkillId,
    inheritableWhiteSkillIds: [...inheritable].sort((left, right) => left.localeCompare(right)),
    aptitudes: cloneAptitudes(input.uma.aptitudes),
    parents: input.uma.currentParents.map(frozenParent),
  }
}

export function promotionReadiness(profile: PlayerProfile, uma: UmaSave): PromotionReadiness {
  const fromTier = tierOfLevel(uma.level)
  const final = uma.level >= SCENARIOS.length * LEVELS_PER_SCENARIO
  const cost = !final && isGateLevel(uma.level) ? umaPromotionCost(fromTier) : null
  if (!parsePlayerProfile(profile)) return { ready: false, final, fromTier, toTier: null, cost, reason: 'Player profile is malformed' }
  if (!parseUmaSave(uma)) return { ready: false, final, fromTier, toTier: null, cost, reason: 'Uma save is malformed' }
  if (final) return { ready: false, final: true, fromTier, toTier: null, cost: null, reason: 'Latest scenario complete' }
  if (!isGateLevel(uma.level)) return { ready: false, final: false, fromTier, toTier: null, cost: null, reason: 'Reach the scenario gate first' }
  if (!scenarioForTier(fromTier + 1)) return { ready: false, final: true, fromTier, toTier: null, cost: null, reason: 'Latest scenario complete' }
  if (!uma.scenarioStarted) return { ready: false, final: false, fromTier, toTier: fromTier + 1, cost, reason: 'Finish scenario start first' }
  if (profile.tickets < cost!) return { ready: false, final: false, fromTier, toTier: fromTier + 1, cost, reason: `Need ${cost! - profile.tickets} more Training Tickets` }
  return { ready: true, final: false, fromTier, toTier: fromTier + 1, cost, reason: null }
}

function refreshedSkills(input: ScenarioPromotionInput, fromTier: number): { library: SkillUnlock[]; awakeningSkillId: string | null } {
  const library: SkillUnlock[] = []
  if (input.umaTemplate.uniqueSkillId) {
    library.push({ skillId: input.umaTemplate.uniqueSkillId, origin: 'own-unique', sourceId: input.umaTemplate.id })
  }
  const unlockedAwakenings = input.umaTemplate.awakeningSkillIds.slice(0, Math.min(fromTier, 4))
  for (const skillId of unlockedAwakenings) {
    library.push({ skillId, origin: 'awakening', sourceId: input.umaTemplate.id })
  }
  return { library, awakeningSkillId: fromTier <= 4 ? (input.umaTemplate.awakeningSkillIds[fromTier - 1] ?? null) : null }
}

/** Validate and calculate the complete, deterministic T012 promotion commit. */
export function promoteScenario(input: ScenarioPromotionInput): ScenarioPromotionResult {
  assertTimestamp(input.now)
  const parsedProfile = parsePlayerProfile(input.profile)
  const parsedUma = parseUmaSave(input.uma)
  if (!parsedProfile) throw new Error('Player profile is malformed')
  if (!parsedUma) throw new Error('Uma save is malformed')
  const readiness = promotionReadiness(parsedProfile, parsedUma)
  if (!readiness.ready || readiness.cost === null || readiness.toTier === null) throw new Error(readiness.reason ?? 'Uma is not ready to promote')
  if (parsedUma.currentParents.length !== 0) throw new Error('T012 promotion only supports starting without parents')
  assertTemplate({ ...input, profile: parsedProfile, uma: parsedUma })

  if (input.cards.length !== parsedUma.deckCardIds.length || input.cards.some((card, index) => card.save.templateId !== parsedUma.deckCardIds[index])) {
    throw new Error('Equipped support deck is stale or incomplete')
  }
  const deck = validateEquippedSupportDeck(readiness.fromTier, input.cards)
  const issue = deck.issues[0]
  if (issue) throw new Error(supportDeckIssueMessage(issue))

  const snapshot = buildParentSnapshot({ uma: parsedUma, umaTemplate: input.umaTemplate, skills: input.skills, now: input.now })
  const cardBonuses: PromotionCardBonus[] = deck.cards.map(({ save, template }) => {
    if (!STATS.includes(template.type as StatKey)) throw new Error(`Card ${template.id} has an unsupported Initial Stats type`)
    const projected = projectedCardEffectValue('initialStats', template, save)
    if (!Number.isFinite(projected) || projected < 0) throw new Error(`Card ${template.id} has invalid Initial Stats content`)
    return { cardId: template.id, stat: template.type as StatKey, amount: Math.round(projected) }
  })
  const baseStatBonus = Object.fromEntries(STATS.map((stat) => [stat, PROMOTION_BONUS_PER_STAT])) as Stats
  const stats = { ...parsedUma.stats }
  for (const stat of STATS) stats[stat] += baseStatBonus[stat]
  for (const bonus of cardBonuses) stats[bonus.stat] += bonus.amount

  const refresh = refreshedSkills({ ...input, profile: parsedProfile, uma: parsedUma }, readiness.fromTier)
  const loadoutSkillIds = parsedUma.loadoutSkillIds.filter((id) => refresh.library.some((unlock) => unlock.skillId === id && unlock.origin !== 'own-unique'))
  const skillHistory: SkillHistoryEntry[] = parsedUma.skillHistory.map((entry) => ({ ...entry }))
  for (const unlock of refresh.library) {
    if (!skillHistory.some((entry) => entry.tier === readiness.toTier && entry.skillId === unlock.skillId)) {
      skillHistory.push({ ...unlock, tier: readiness.toTier })
    }
  }

  let level = parsedUma.level + 1
  let exp = parsedUma.exp
  let overflowLevel: number | null = null
  if (exp === expToNextUmaLevel(level)) {
    level += 1
    exp = 0
    overflowLevel = level
  }
  const profile: PlayerProfile = {
    ...parsedProfile,
    tickets: parsedProfile.tickets - readiness.cost + (overflowLevel === null ? 0 : UMA_LEVEL_TICKET_REWARD),
  }
  const ledger: PromotionLedgerDescriptor[] = [{
    id: `uma-promotion:${parsedUma.templateId}:${readiness.fromTier}`,
    data: { resource: 'tickets', delta: -readiness.cost, reason: 'uma-promotion', localDay: null, createdAt: input.now },
  }]
  if (overflowLevel !== null) {
    ledger.push({
      id: `uma-level-tickets:${parsedUma.templateId}:${overflowLevel}`,
      data: { resource: 'tickets', delta: UMA_LEVEL_TICKET_REWARD, reason: 'uma-level', localDay: null, createdAt: input.now },
    })
  }

  return {
    profile,
    uma: {
      ...parsedUma,
      level,
      exp,
      trainingLevel: 1,
      trainingExp: 0,
      stats,
      skillLibrary: refresh.library,
      loadoutSkillIds,
      trainingsThisScenario: 0,
      scenarioStarted: true,
      skillHistory,
      currentParents: [],
      parentSnapshot: snapshot,
    },
    fromTier: readiness.fromTier,
    toTier: readiness.toTier,
    cost: readiness.cost,
    snapshot,
    baseStatBonus,
    cardBonuses,
    awakeningSkillId: refresh.awakeningSkillId,
    overflowLevel,
    ledger,
  }
}

/** Capture the last available tier once, in the same commit as the race that reaches max level. */
export function completeFinalScenario(input: {
  uma: UmaSave
  umaTemplate: UmaTemplate
  skills: ReadonlyMap<string, SkillTemplate>
  now: number
}): UmaSave {
  assertTimestamp(input.now)
  const parsed = parseUmaSave(input.uma)
  if (!parsed) throw new Error('Uma save is malformed')
  if (parsed.level !== SCENARIOS.length * LEVELS_PER_SCENARIO) throw new Error('Uma has not reached the latest scenario maximum')
  if (parsed.parentSnapshot?.completedTier === SCENARIOS.length) return parsed
  return { ...parsed, parentSnapshot: buildParentSnapshot({ ...input, uma: parsed }) }
}
