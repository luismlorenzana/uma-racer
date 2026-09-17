// Atomic local-first scenario promotion (docs/tasks/T012-scenario-promotion-and-save-v2.md).

import {
  parseCardSave,
  parseLedgerEntry,
  parsePlayerProfileOrThrow,
  parseUmaSave,
  promoteScenario,
  tierOfLevel,
  type CardSave,
  type PlayerProfile,
  type ScenarioPromotionResult,
  type UmaSave,
} from '@racer/domain'
import type { LoadedContent } from '../content/runtime'
import { db } from './db'
import { queueInTransaction } from './persistence'

export interface ScenarioPromotionMutation {
  profile: PlayerProfile
  uma: UmaSave
  result: ScenarioPromotionResult | null
  alreadyPromoted: boolean
}

function resolveCards(
  content: LoadedContent,
  uma: UmaSave,
  cardsById: Readonly<Record<string, CardSave>>,
) {
  return uma.deckCardIds.map((id) => {
    const save = cardsById[id]
    if (!save) throw new Error(`Promotion deck card is not owned: ${id}`)
    const template = content.cards.byId.get(id)
    if (!template) throw new Error(`Promotion deck card content is missing: ${id}`)
    return { save, template }
  })
}

export function promoteMemoryUma(
  content: LoadedContent,
  profile: PlayerProfile,
  uma: UmaSave,
  cardsById: Readonly<Record<string, CardSave>>,
  now: number,
): ScenarioPromotionMutation {
  const umaTemplate = content.umas.byId.get(uma.templateId)
  if (!umaTemplate) throw new Error(`Promotion content is missing Uma ${uma.templateId}`)
  const result = promoteScenario({
    profile,
    uma,
    umaTemplate,
    skills: content.skills.byId,
    cards: resolveCards(content, uma, cardsById),
    now,
  })
  return { profile: result.profile, uma: result.uma, result, alreadyPromoted: false }
}

export async function promotePersistentUma(
  content: LoadedContent,
  umaId: string,
  now: number,
): Promise<ScenarioPromotionMutation> {
  return db.transaction('rw', [db.profile, db.umas, db.cards, db.ledger, db.outbox], async () => {
    const profileRow = await db.profile.get('main')
    const umaRow = await db.umas.get(umaId)
    if (!profileRow) throw new Error('Local profile is missing')
    if (!umaRow) throw new Error('Promotion Uma is not owned')
    const profile = parsePlayerProfileOrThrow(profileRow.data)
    const uma = parseUmaSave(umaRow.data)
    if (!uma || uma.templateId !== umaId) throw new Error(`Invalid local Uma save: ${umaId}`)

    const currentTier = tierOfLevel(uma.level)
    const previousTier = currentTier - 1
    if (previousTier > 0 && (uma.level % 10 === 1 || uma.level % 10 === 2)) {
      const priorId = `uma-promotion:${umaId}:${previousTier}`
      const prior = await db.ledger.get(priorId)
      const parsed = prior ? parseLedgerEntry(prior.data) : null
      const matchingPostState = uma.parentSnapshot?.completedTier === previousTier && uma.scenarioStarted &&
        uma.currentParents.length === 0 && uma.trainingLevel === 1 && uma.trainingExp === 0 && uma.trainingsThisScenario === 0
      if (parsed && parsed.reason === 'uma-promotion' && parsed.delta === -25 * previousTier && matchingPostState) {
        return { profile, uma, result: null, alreadyPromoted: true }
      }
      if (prior) throw new Error('Promotion ledger is corrupt')
    }

    const cardRows = await db.cards.bulkGet(uma.deckCardIds)
    const cardsById = Object.fromEntries(uma.deckCardIds.map((id, index) => {
      const row = cardRows[index]
      if (!row) throw new Error(`Promotion deck card is not owned: ${id}`)
      const card = parseCardSave(row.data)
      if (!card || card.templateId !== id) throw new Error(`Invalid local card save: ${id}`)
      return [id, card]
    }))
    const mutation = promoteMemoryUma(content, profile, uma, cardsById, now)
    const ledgerRows = await db.ledger.bulkGet(mutation.result!.ledger.map((entry) => entry.id))
    if (ledgerRows.some((row) => row !== undefined)) throw new Error('This scenario promotion was already recorded')

    await db.profile.put({ ...profileRow, data: mutation.profile })
    await db.umas.put({ ...umaRow, data: mutation.uma })
    await queueInTransaction('profile', 'main', 'upsert', now)
    await queueInTransaction('umas', umaId, 'upsert', now)
    for (const entry of mutation.result!.ledger) {
      await db.ledger.add({ id: entry.id, data: entry.data, createdAt: entry.data.createdAt })
      await queueInTransaction('ledger', entry.id, 'append', now)
    }
    return mutation
  })
}
