// Atomic per-Uma support decks (docs/design/support-cards.md#deck).

import {
  activeScenario,
  parseCardSave,
  parseUmaSave,
  supportDeckIdentityIssues,
  supportDeckIssueMessage,
  validateSupportDeck,
  withCardSet as withRunCardSet,
  type CardSave,
  type UmaSave,
} from '@racer/domain'
import type { LoadedContent } from '../content/runtime'
import { db } from './db'
import { queueInTransaction } from './persistence'

/** Card sets belong to the active scenario run now (D125), which is always the highest unlocked (D121). */
function withCardSet(uma: UmaSave, orderedCardIds: readonly string[]): UmaSave {
  return {
    ...uma,
    scenarios: uma.scenarios.map((run) => run.tier === uma.unlockedTier ? withRunCardSet(run, orderedCardIds) : run),
  }
}

export interface DeckMutationResult {
  uma: UmaSave
  changed: boolean
}

const sameOrder = (left: readonly string[], right: readonly string[]): boolean =>
  left.length === right.length && left.every((id, index) => id === right[index])

function throwFirstIssue(issues: ReturnType<typeof supportDeckIdentityIssues>): never {
  throw new Error(supportDeckIssueMessage(issues[0]!))
}

export function setMemoryUmaDeck(
  content: LoadedContent,
  uma: UmaSave,
  cardsById: Readonly<Record<string, CardSave>>,
  orderedCardIds: readonly string[],
): DeckMutationResult {
  const validation = validateSupportDeck({
    tier: uma.unlockedTier,
    orderedCardIds,
    ownedCards: Object.values(cardsById),
    templates: content.cards.byId,
  })
  if (!validation.valid) throwFirstIssue(validation.issues)
  if (sameOrder(activeScenario(uma).cardSetIds, orderedCardIds)) return { uma, changed: false }
  return { uma: withCardSet(uma, orderedCardIds), changed: true }
}

export async function setPersistentUmaDeck(
  content: LoadedContent,
  umaId: string,
  orderedCardIds: readonly string[],
  now: number,
): Promise<DeckMutationResult> {
  if (!Number.isSafeInteger(now) || now < 0) throw new Error('Invalid deck timestamp')
  const identityIssues = supportDeckIdentityIssues(1, orderedCardIds, true)
    .filter((issue) => issue.code === 'unsafe-id' || issue.code === 'duplicate-id')
  if (identityIssues.length > 0) throwFirstIssue(identityIssues)
  return db.transaction('rw', db.umas, db.cards, db.outbox, async () => {
    const umaRow = await db.umas.get(umaId)
    if (!umaRow) throw new Error('Deck Uma is not owned')
    const uma = parseUmaSave(umaRow.data)
    if (!uma || uma.templateId !== umaId) throw new Error(`Invalid local Uma save: ${umaId}`)
    const tier = uma.unlockedTier
    const slotIssues = supportDeckIdentityIssues(tier, orderedCardIds)
    if (slotIssues.length > 0) throwFirstIssue(slotIssues)
    const rows = await db.cards.bulkGet([...orderedCardIds])
    const ownedCards = rows.flatMap((row, index) => {
      if (!row) return []
      const expectedId = orderedCardIds[index]!
      const card = parseCardSave(row.data)
      if (!card || card.templateId !== expectedId) throw new Error(`Invalid local card save: ${expectedId}`)
      return [card]
    })
    const validation = validateSupportDeck({
      tier,
      orderedCardIds,
      ownedCards,
      templates: content.cards.byId,
    })
    if (!validation.valid) throwFirstIssue(validation.issues)
    if (sameOrder(activeScenario(uma).cardSetIds, orderedCardIds)) return { uma, changed: false }
    const next = withCardSet(uma, orderedCardIds)
    await db.umas.put({ ...umaRow, data: next })
    await queueInTransaction('umas', umaId, 'upsert', now)
    return { uma: next, changed: true }
  })
}
