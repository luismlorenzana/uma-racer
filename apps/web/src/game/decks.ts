// Atomic per-Uma support decks (docs/tasks/T010-manual-support-decks.md).

import {
  parseCardSave,
  parseUmaSave,
  supportDeckIdentityIssues,
  supportDeckIssueMessage,
  tierOfLevel,
  validateSupportDeck,
  type CardSave,
  type UmaSave,
} from '@racer/domain'
import type { LoadedContent } from '../content/runtime'
import { db } from './db'
import { queueInTransaction } from './persistence'

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
    tier: tierOfLevel(uma.level),
    orderedCardIds,
    ownedCards: Object.values(cardsById),
    templates: content.cards.byId,
  })
  if (!validation.valid) throwFirstIssue(validation.issues)
  if (sameOrder(uma.deckCardIds, orderedCardIds)) return { uma, changed: false }
  return { uma: { ...uma, deckCardIds: [...orderedCardIds] }, changed: true }
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
    const tier = tierOfLevel(uma.level)
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
    if (sameOrder(uma.deckCardIds, orderedCardIds)) return { uma, changed: false }
    const next = { ...uma, deckCardIds: [...orderedCardIds] }
    await db.umas.put({ ...umaRow, data: next })
    await queueInTransaction('umas', umaId, 'upsert', now)
    return { uma: next, changed: true }
  })
}
