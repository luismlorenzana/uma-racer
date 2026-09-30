// The Training EXP bank and Training Level-Up Tickets (docs/design/training.md, D212).

import {
  TRAINING_EXP_PER_LEVEL,
  TRAINING_LEVEL_UP_TICKET_ID,
  depositTrainingExp,
  parseInventoryStackData,
  parsePlayerProfileOrThrow,
  type PlayerProfile,
  type TrainingExpBankMovement,
} from '@racer/domain'
import { db } from './db'
import { queueInTransaction } from './persistence'

export interface TrainingExpBanked {
  profile: PlayerProfile
  /** Level-Up Tickets the deposit completed. */
  tickets: number
}

/**
 * Deposits Training EXP past TL10 inside the caller's transaction (profile, items, itemLedger and outbox), paying one
 * Level-Up Ticket for every full level at once. A grant is evidence under `evidenceId`; the caller's own commit is what
 * makes a retry a read, so finding that evidence already written means the caller is broken, not retrying.
 */
export async function bankTrainingExpInTransaction(
  exp: number,
  evidenceId: string,
  source: TrainingExpBankMovement['source'],
  now: number,
): Promise<TrainingExpBanked> {
  const profileRow = await db.profile.get('main')
  if (!profileRow) throw new Error('Local profile is missing')
  const profile = parsePlayerProfileOrThrow(profileRow.data)
  const deposit = depositTrainingExp(profile.trainingExpBank, exp)
  const next: PlayerProfile = { ...profile, trainingExpBank: deposit.bank }
  await db.profile.put({ ...profileRow, data: next })
  await queueInTransaction('profile', 'main', 'upsert', now)
  if (deposit.tickets > 0) {
    if (await db.itemLedger.get(evidenceId)) throw new Error(`Training Level-Up Ticket evidence already exists: ${evidenceId}`)
    const stackRow = await db.items.get(TRAINING_LEVEL_UP_TICKET_ID)
    const stack = stackRow ? parseInventoryStackData(stackRow.data, TRAINING_LEVEL_UP_TICKET_ID) : null
    if (stackRow && !stack) throw new Error('Local Training Level-Up Ticket stack is invalid')
    const movement: TrainingExpBankMovement = {
      id: evidenceId,
      itemId: TRAINING_LEVEL_UP_TICKET_ID,
      delta: deposit.tickets,
      reason: 'exp-bank',
      source,
      createdAt: now,
    }
    await db.items.put({
      id: TRAINING_LEVEL_UP_TICKET_ID,
      data: { itemId: TRAINING_LEVEL_UP_TICKET_ID, quantity: (stack?.quantity ?? 0) + deposit.tickets, updatedAt: now },
      version: stackRow?.version ?? 0,
    })
    await db.itemLedger.add({ id: movement.id, data: movement, createdAt: now })
    await queueInTransaction('items', TRAINING_LEVEL_UP_TICKET_ID, 'upsert', now)
    await queueInTransaction('itemLedger', movement.id, 'append', now)
  }
  return { profile: next, tickets: deposit.tickets }
}

/**
 * Pays the bank's full levels as Level-Up Tickets. Commits convert as they deposit, so only the v11 migration leaves a
 * full level waiting (D212); this runs once at startup, where every path meets. Returns the tickets paid.
 */
export async function settleTrainingExpBank(now: number): Promise<TrainingExpBanked | null> {
  return db.transaction('rw', [db.profile, db.items, db.itemLedger, db.outbox], async () => {
    const profileRow = await db.profile.get('main')
    if (!profileRow) return null
    if (parsePlayerProfileOrThrow(profileRow.data).trainingExpBank < TRAINING_EXP_PER_LEVEL) return null
    return bankTrainingExpInTransaction(0, `exp-bank:settle:${now}`, { kind: 'bank-settle' }, now)
  })
}
