// Atomic saved-Uma Training mutations (docs/tasks/T004-saved-uma-training-loop.md).

import {
  autoTrainingDeck,
  dealTrainingCards,
  deckSlotCount,
  isLocalDay,
  parseCardSave,
  parsePlayerProfileOrThrow,
  parseUmaSave,
  resolveTrainingTurn,
  tierOfLevel,
  trainingDeckError,
  trainingTurnSeed,
  type CardSave,
  type Facility,
  type LedgerEntry,
  type PlayerProfile,
  type TrainingCardInput,
  type TrainingDeal,
  type TrainingTurnResult,
  type UmaSave,
} from '@racer/domain'
import type { LoadedContent } from '../content/runtime'
import { db } from './db'
import { queueInTransaction } from './persistence'

export interface TrainingMutationResult {
  profile: PlayerProfile
  uma: UmaSave
  cards: CardSave[]
  deal: TrainingDeal
  result: TrainingTurnResult
  ledgerIds: string[]
}

interface TrainingStateInput {
  content: LoadedContent
  profile: PlayerProfile
  uma: UmaSave
  cardsById: Readonly<Record<string, CardSave>>
  facility: Facility
  today: string
  now: number
  rewardedCardLevels?: ReadonlySet<string>
}

function requireUmaTemplate(content: LoadedContent, uma: UmaSave) {
  const template = content.umas.byId.get(uma.templateId)
  if (!template) throw new Error(`Training content is missing Uma ${uma.templateId}`)
  return template
}

function trainingCards(
  content: LoadedContent,
  uma: UmaSave,
  cardsById: Readonly<Record<string, CardSave>>,
): TrainingCardInput[] {
  return uma.deckCardIds.map((id) => {
    const save = cardsById[id]
    if (!save) throw new Error(`Training deck card is not owned: ${id}`)
    const template = content.cards.byId.get(id)
    if (!template) throw new Error(`Training content is missing card ${id}`)
    return { save, template }
  })
}

function parsedCardRow(id: string, value: unknown): CardSave {
  const card = parseCardSave(value)
  if (!card || card.templateId !== id) throw new Error(`Invalid local card save: ${id}`)
  return card
}

function parsedUmaRow(id: string, value: unknown): UmaSave {
  const uma = parseUmaSave(value)
  if (!uma || uma.templateId !== id) throw new Error(`Invalid local Uma save: ${id}`)
  return uma
}

export function ensureMemoryTrainingDeck(
  content: LoadedContent,
  uma: UmaSave,
  cardsById: Readonly<Record<string, CardSave>>,
): UmaSave {
  const template = requireUmaTemplate(content, uma)
  const tier = tierOfLevel(uma.level)
  if (uma.deckCardIds.length > 0) {
    const error = trainingDeckError(tier, trainingCards(content, uma, cardsById))
    if (error) throw new Error(error)
    return uma
  }
  const owned = Object.values(cardsById).map((save): TrainingCardInput => {
    const cardTemplate = content.cards.byId.get(save.templateId)
    if (!cardTemplate) throw new Error(`Training content is missing card ${save.templateId}`)
    return { save, template: cardTemplate }
  })
  const deckCardIds = autoTrainingDeck(template, tier, owned)
  if (deckCardIds.length !== deckSlotCount(tier)) {
    throw new Error(`Training needs ${deckSlotCount(tier)} eligible support cards at tier ${tier}`)
  }
  return { ...uma, deckCardIds }
}

export function resolveMemoryTraining(input: TrainingStateInput): TrainingMutationResult {
  if (!isLocalDay(input.today)) throw new Error(`Invalid local day: ${input.today}`)
  if (!Number.isSafeInteger(input.now) || input.now < 0) throw new Error('Invalid Training timestamp')
  if (input.profile.tickets < 1) throw new Error('You need a Training Ticket')
  const template = requireUmaTemplate(input.content, input.uma)
  const cards = trainingCards(input.content, input.uma, input.cardsById)
  const tier = tierOfLevel(input.uma.level)
  const error = trainingDeckError(tier, cards)
  if (error) throw new Error(error)
  const deal = dealTrainingCards(
    cards,
    trainingTurnSeed(input.profile.createdAt, input.uma.templateId, tier, input.uma.trainingsThisScenario),
  )
  const result = resolveTrainingTurn({
    uma: input.uma,
    template,
    cards,
    skills: input.content.skills.byId,
    deal,
    facility: input.facility,
  })
  const trainingLedgerId = `training:${input.uma.templateId}:${tier}:${input.uma.trainingsThisScenario}`
  const cardLevelIds = result.cards.flatMap((card) =>
    card.levelsGained.map((level) => `card-level-tickets:${card.card.templateId}:${level}`),
  )
  const newCardLevelIds = cardLevelIds.filter((id) => !input.rewardedCardLevels?.has(id))
  const ticketReward = newCardLevelIds.length * 2
  const adjusted = ticketReward === result.ticketReward ? result : { ...result, ticketReward }
  return {
    profile: { ...input.profile, tickets: input.profile.tickets - 1 + ticketReward },
    uma: adjusted.uma,
    cards: adjusted.cards.map((card) => card.card),
    deal,
    result: adjusted,
    ledgerIds: [trainingLedgerId, ...newCardLevelIds],
  }
}

export async function ensurePersistentTrainingDeck(
  content: LoadedContent,
  umaId: string,
  now: number,
): Promise<UmaSave> {
  if (!Number.isSafeInteger(now) || now < 0) throw new Error('Invalid Training timestamp')
  return db.transaction('rw', db.umas, db.cards, db.outbox, async () => {
    const row = await db.umas.get(umaId)
    if (!row) throw new Error('Training Uma is not owned')
    const uma = parsedUmaRow(umaId, row.data)
    if (uma.deckCardIds.length > 0) {
      const rows = await db.cards.bulkGet(uma.deckCardIds)
      const cardsById = Object.fromEntries(uma.deckCardIds.map((id, index) => {
        const cardRow = rows[index]
        if (!cardRow) throw new Error(`Training deck card is not owned: ${id}`)
        return [id, parsedCardRow(id, cardRow.data)]
      }))
      ensureMemoryTrainingDeck(content, uma, cardsById)
      return uma
    }
    const rows = await db.cards.toArray()
    const cardsById = Object.fromEntries(rows.map((cardRow) => [cardRow.id, parsedCardRow(cardRow.id, cardRow.data)]))
    const next = ensureMemoryTrainingDeck(content, uma, cardsById)
    await db.umas.put({ ...row, data: next })
    await queueInTransaction('umas', umaId, 'upsert', now)
    return next
  })
}

export async function persistTraining(
  content: LoadedContent,
  umaId: string,
  facility: Facility,
  today: string,
  now: number,
): Promise<TrainingMutationResult> {
  return db.transaction('rw', db.profile, db.umas, db.cards, db.ledger, db.outbox, async () => {
    const profileRow = await db.profile.get('main')
    const umaRow = await db.umas.get(umaId)
    if (!profileRow) throw new Error('Local profile is missing')
    if (!umaRow) throw new Error('Training Uma is not owned')
    const profile = parsePlayerProfileOrThrow(profileRow.data)
    const uma = parsedUmaRow(umaId, umaRow.data)
    const cardRows = await db.cards.bulkGet(uma.deckCardIds)
    const cardsById = Object.fromEntries(uma.deckCardIds.map((id, index) => {
      const row = cardRows[index]
      if (!row) throw new Error(`Training deck card is not owned: ${id}`)
      return [id, parsedCardRow(id, row.data)]
    }))
    const tier = tierOfLevel(uma.level)
    const trainingLedgerId = `training:${umaId}:${tier}:${uma.trainingsThisScenario}`
    if (await db.ledger.get(trainingLedgerId)) throw new Error('This Training turn was already recorded')

    const possibleRewardIds = uma.deckCardIds.flatMap((cardId) =>
      Array.from({ length: 25 }, (_, index) => `card-level-tickets:${cardId}:${index + 1}`),
    )
    const existingRewards = await db.ledger.bulkGet(possibleRewardIds)
    const rewardedCardLevels = new Set(
      possibleRewardIds.filter((_, index) => existingRewards[index] !== undefined),
    )
    const mutation = resolveMemoryTraining({
      content,
      profile,
      uma,
      cardsById,
      facility,
      today,
      now,
      rewardedCardLevels,
    })

    await db.profile.put({ ...profileRow, data: mutation.profile })
    await db.umas.put({ ...umaRow, data: mutation.uma })
    await queueInTransaction('profile', 'main', 'upsert', now)
    await queueInTransaction('umas', umaId, 'upsert', now)
    for (const card of mutation.cards) {
      const row = cardRows[uma.deckCardIds.indexOf(card.templateId)]
      if (!row) throw new Error(`Training deck card is not owned: ${card.templateId}`)
      if (row.data.level === card.level && row.data.exp === card.exp) continue
      await db.cards.put({ ...row, data: card })
      await queueInTransaction('cards', card.templateId, 'upsert', now)
    }

    const ledger = mutation.ledgerIds.map((id): { id: string; data: LedgerEntry } => ({
      id,
      data: id === trainingLedgerId
        ? { resource: 'tickets', delta: -1, reason: 'training', localDay: today, createdAt: now }
        : { resource: 'tickets', delta: 2, reason: 'card-level', localDay: today, createdAt: now },
    }))
    for (const entry of ledger) {
      await db.ledger.add({ id: entry.id, data: entry.data, createdAt: now })
      await queueInTransaction('ledger', entry.id, 'append', now)
    }
    return mutation
  })
}
