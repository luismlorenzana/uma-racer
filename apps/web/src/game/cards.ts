// Atomic support-card promotion (docs/tasks/T009-support-card-album-and-progression.md).

import {
  isLocalDay,
  parseCardSave,
  parsePlayerProfileOrThrow,
  promoteCard,
  type CardPromotionResult,
  type CardSave,
  type LedgerEntry,
  type PlayerProfile,
} from '@racer/domain'
import type { LoadedContent } from '../content/runtime'
import { db } from './db'
import { queueInTransaction } from './persistence'
import { reconcileTrainerInTransaction } from './trainer'

export interface CardPromotionMutation {
  profile: PlayerProfile
  card: CardSave
  result: CardPromotionResult
  ledgerIds: [string, string]
}

function validateInput(content: LoadedContent, profile: PlayerProfile, card: CardSave, today: string, now: number) {
  if (!content.cards.byId.has(card.templateId)) throw new Error(`Card content is missing ${card.templateId}`)
  if (!isLocalDay(today)) throw new Error(`Invalid local day: ${today}`)
  if (!Number.isSafeInteger(now) || now < 0) throw new Error('Invalid card promotion timestamp')
  const result = promoteCard(card, profile.tickets)
  const ledgerIds: [string, string] = [
    `card-limit-break:${card.templateId}:${result.toLimitBreak}`,
    `card-level-tickets:${card.templateId}:${result.levelGained}`,
  ]
  return { result, ledgerIds }
}

export function promoteMemoryCard(
  content: LoadedContent,
  profile: PlayerProfile,
  card: CardSave,
  today: string,
  now: number,
): CardPromotionMutation {
  const { result, ledgerIds } = validateInput(content, profile, card, today, now)
  return {
    profile: { ...profile, tickets: profile.tickets + result.ticketDelta },
    card: result.card,
    result,
    ledgerIds,
  }
}

export async function promotePersistentCard(
  content: LoadedContent,
  cardId: string,
  today: string,
  now: number,
): Promise<CardPromotionMutation> {
  return db.transaction('rw', [db.profile, db.umas, db.cards, db.badges, db.raceResults, db.ledger, db.flairEvents, db.outbox], async () => {
    const profileRow = await db.profile.get('main')
    const cardRow = await db.cards.get(cardId)
    if (!profileRow) throw new Error('Local profile is missing')
    if (!cardRow) throw new Error('Support card is not owned')
    const profile = parsePlayerProfileOrThrow(profileRow.data)
    const card = parseCardSave(cardRow.data)
    if (!card || card.templateId !== cardId) throw new Error(`Invalid local card save: ${cardId}`)
    const mutation = promoteMemoryCard(content, profile, card, today, now)
    const existing = await db.ledger.bulkGet(mutation.ledgerIds)
    if (existing.some(Boolean)) throw new Error('This card limit break was already recorded')

    await db.profile.put({ ...profileRow, data: mutation.profile })
    await db.cards.put({ ...cardRow, data: mutation.card })
    await queueInTransaction('profile', 'main', 'upsert', now)
    await queueInTransaction('cards', cardId, 'upsert', now)
    const entries: { id: string; data: LedgerEntry }[] = [
      {
        id: mutation.ledgerIds[0],
        data: { resource: 'tickets', delta: -mutation.result.cost, reason: 'card-limit-break', localDay: today, createdAt: now },
      },
      {
        id: mutation.ledgerIds[1],
        data: { resource: 'tickets', delta: mutation.result.ticketReward, reason: 'card-level', localDay: today, createdAt: now },
      },
    ]
    for (const entry of entries) {
      await db.ledger.add({ id: entry.id, data: entry.data, createdAt: now })
      await queueInTransaction('ledger', entry.id, 'append', now)
    }
    await reconcileTrainerInTransaction(content, now, false, mutation.ledgerIds[0])
    return mutation
  })
}
