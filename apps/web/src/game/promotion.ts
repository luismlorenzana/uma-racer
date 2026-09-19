// Atomic local-first scenario start (docs/tasks/T013-parents-grandparents-and-inheritance.md).

import {
  EMPTY_SCENARIO_START_SELECTION,
  parentFingerprint,
  parseCardSave,
  parseLedgerEntry,
  parsePlayerProfileOrThrow,
  parseUmaSave,
  promoteScenario,
  sameParentFingerprint,
  startNewUmaScenario,
  tierOfLevel,
  type CardSave,
  type NewUmaScenarioStartResult,
  type PlayerProfile,
  type ScenarioPromotionResult,
  type ScenarioStartSelection,
  type BadgeStateV1,
  type UmaSave,
} from '@racer/domain'
import type { LoadedContent } from '../content/runtime'
import { db } from './db'
import { updateScenarioBadgeFacts } from './badges'
import { queueInTransaction } from './persistence'

export interface ScenarioStartMutation {
  profile: PlayerProfile
  uma: UmaSave
  result: ScenarioPromotionResult | NewUmaScenarioStartResult | null
  alreadyStarted: boolean
  /** Compatibility for T012 callers while the route moves to startScenario. */
  alreadyPromoted: boolean
  badgeStates?: Record<string, BadgeStateV1>
  earnedFlairEventIds: string[]
}

export interface ScenarioPromotionMutation extends Omit<ScenarioStartMutation, 'result'> {
  result: ScenarioPromotionResult | null
}

function resolveCards(content: LoadedContent, uma: UmaSave, cardsById: Readonly<Record<string, CardSave>>) {
  return uma.deckCardIds.map((id) => {
    const save = cardsById[id]
    if (!save) throw new Error(`Promotion deck card is not owned: ${id}`)
    const template = content.cards.byId.get(id)
    if (!template) throw new Error(`Promotion deck card content is missing: ${id}`)
    return { save, template }
  })
}

function selectionMatchesActive(uma: UmaSave, selection: ScenarioStartSelection): boolean {
  if (!uma.scenarioStarted || uma.currentParents.length !== selection.parents.length) return false
  if (!uma.currentParents.every((snapshot, index) => {
    const chosen = selection.parents[index]
    return chosen ? sameParentFingerprint(parentFingerprint(snapshot), chosen) : false
  })) return false
  const inherited = new Set(uma.skillLibrary.filter((unlock) => unlock.origin === 'inherited').map((unlock) => unlock.skillId))
  const expected = new Set([...selection.grandparentUniqueSkillIds, ...selection.grandparentWhiteSkillIds])
  for (const parent of uma.currentParents) {
    if (parent.inheritedUniqueSkillId) expected.add(parent.inheritedUniqueSkillId)
    parent.inheritableWhiteSkillIds.forEach((id) => expected.add(id))
  }
  return inherited.size === expected.size && [...expected].every((id) => inherited.has(id))
}

export function startMemoryScenario(
  content: LoadedContent,
  profile: PlayerProfile,
  uma: UmaSave,
  ownedUmas: readonly UmaSave[],
  cardsById: Readonly<Record<string, CardSave>>,
  selection: ScenarioStartSelection,
  now: number,
): ScenarioStartMutation {
  const umaTemplate = content.umas.byId.get(uma.templateId)
  if (!umaTemplate) throw new Error(`Scenario content is missing Uma ${uma.templateId}`)
  if (!uma.scenarioStarted) {
    const result = startNewUmaScenario({
      uma, umaTemplate, skills: content.skills.byId, races: content.races.items, ownedUmas, umaTemplates: content.umas.byId, selection,
    })
    return { profile, uma: result.uma, result, alreadyStarted: false, alreadyPromoted: false, earnedFlairEventIds: [] }
  }
  const result = promoteScenario({
    profile,
    uma,
    umaTemplate,
    skills: content.skills.byId,
    cards: resolveCards(content, uma, cardsById),
    races: content.races.items,
    now,
    ownedUmas,
    umaTemplates: content.umas.byId,
    selection,
  })
  return { profile: result.profile, uma: result.uma, result, alreadyStarted: false, alreadyPromoted: false, earnedFlairEventIds: [] }
}

/** T012-compatible zero-parent promotion helper. */
export function promoteMemoryUma(
  content: LoadedContent,
  profile: PlayerProfile,
  uma: UmaSave,
  cardsById: Readonly<Record<string, CardSave>>,
  now: number,
): ScenarioPromotionMutation {
  const mutation = startMemoryScenario(content, profile, uma, [uma], cardsById, EMPTY_SCENARIO_START_SELECTION, now)
  if (mutation.result && !('fromTier' in mutation.result)) throw new Error('A pending new Uma requires Scenario Start')
  return mutation as ScenarioPromotionMutation
}

export async function startPersistentScenario(
  content: LoadedContent,
  umaId: string,
  selection: ScenarioStartSelection,
  now: number,
): Promise<ScenarioStartMutation> {
  return db.transaction('rw', [db.profile, db.umas, db.cards, db.badges, db.ledger, db.flairEvents, db.outbox], async () => {
    const profileRow = await db.profile.get('main')
    const umaRows = await db.umas.toArray()
    const umaRow = umaRows.find((row) => row.id === umaId)
    if (!profileRow) throw new Error('Local profile is missing')
    if (!umaRow) throw new Error('Scenario Uma is not owned')
    const profile = parsePlayerProfileOrThrow(profileRow.data)
    const ownedUmas = umaRows.map((row) => {
      const saved = parseUmaSave(row.data)
      if (!saved || saved.templateId !== row.id) throw new Error(`Invalid local Uma save: ${row.id}`)
      return saved
    })
    const uma = ownedUmas.find((saved) => saved.templateId === umaId)!

    if (uma.scenarioStarted && uma.level === 1 && uma.trainingsThisScenario === 0 && uma.parentSnapshot === null) {
      if (selectionMatchesActive(uma, selection)) {
        return { profile, uma, result: null, alreadyStarted: true, alreadyPromoted: false, earnedFlairEventIds: [] }
      }
      throw new Error('This Uma already started tier 1 with a different selection')
    }

    const currentTier = tierOfLevel(uma.level)
    const previousTier = currentTier - 1
    if (previousTier > 0 && (uma.level % 10 === 1 || uma.level % 10 === 2)) {
      const priorId = `uma-promotion:${umaId}:${previousTier}`
      const prior = await db.ledger.get(priorId)
      const parsed = prior ? parseLedgerEntry(prior.data) : null
      const matchingPostState = uma.parentSnapshot?.completedTier === previousTier && selectionMatchesActive(uma, selection) &&
        uma.trainingLevel === 1 && uma.trainingExp === 0 && uma.trainingsThisScenario === 0
      if (parsed && parsed.reason === 'uma-promotion' && parsed.delta === -25 * previousTier && matchingPostState) {
        return { profile, uma, result: null, alreadyStarted: true, alreadyPromoted: true, earnedFlairEventIds: [] }
      }
      if (prior) throw new Error('Scenario promotion ledger or selection is corrupt')
    }
    if (uma.scenarioStarted && uma.level % 10 !== 0) throw new Error('This Uma already has an active scenario')

    const cardRows = await db.cards.bulkGet(uma.deckCardIds)
    const cardsById = Object.fromEntries(uma.deckCardIds.map((id, index) => {
      const row = cardRows[index]
      if (!row) throw new Error(`Promotion deck card is not owned: ${id}`)
      const card = parseCardSave(row.data)
      if (!card || card.templateId !== id) throw new Error(`Invalid local card save: ${id}`)
      return [id, card]
    }))
    const mutation = startMemoryScenario(content, profile, uma, ownedUmas, cardsById, selection, now)

    if (mutation.result && 'fromTier' in mutation.result) {
      const ledgerRows = await db.ledger.bulkGet(mutation.result.ledger.map((entry) => entry.id))
      if (ledgerRows.some((row) => row !== undefined)) throw new Error('This scenario promotion was already recorded')
      await db.profile.put({ ...profileRow, data: mutation.profile })
      await queueInTransaction('profile', 'main', 'upsert', now)
      for (const entry of mutation.result.ledger) {
        await db.ledger.add({ id: entry.id, data: entry.data, createdAt: entry.data.createdAt })
        await queueInTransaction('ledger', entry.id, 'append', now)
      }
    }
    await db.umas.put({ ...umaRow, data: mutation.uma })
    await queueInTransaction('umas', umaId, 'upsert', now)
    const completedTier = mutation.result && 'fromTier' in mutation.result ? mutation.result.fromTier : null
    const flair = await updateScenarioBadgeFacts({
      content,
      before: uma,
      after: mutation.uma,
      completedTier,
      now,
    })
    return { ...mutation, badgeStates: flair.states, earnedFlairEventIds: flair.events.map((event) => event.id) }
  })
}

/** T012-compatible zero-parent promotion helper. */
export async function promotePersistentUma(content: LoadedContent, umaId: string, now: number): Promise<ScenarioPromotionMutation> {
  const mutation = await startPersistentScenario(content, umaId, EMPTY_SCENARIO_START_SELECTION, now)
  if (mutation.result && !('fromTier' in mutation.result)) throw new Error('A pending new Uma requires Scenario Start')
  return mutation as ScenarioPromotionMutation
}
