// Spending Training Level-Up Tickets on the Spark Match start screen's unit (docs/design/training.md, D213, T088).

import {
  TRAINING_EXP_PER_LEVEL,
  TRAINING_LEVEL_UP_TICKET_ID,
  addTrainingExp,
  constellationTemplate,
  nodesUnlockedBetween,
  parseInventoryStackData,
  parseItemLedgerEntry,
  parsePlayerProfileOrThrow,
  parseUmaSaveOrThrow,
  resolveTrainingLevelUp,
  trainingLevelUpMovementId,
  type PlayerProfile,
  type UmaSave,
} from '@racer/domain'
import type { LoadedContent } from '../content/runtime'
import { updateTrainingBadgeFacts } from './badges'
import { db } from './db'
import type { RunRewardNode } from './minigame-host'
import { minigameNodeLabel } from './minigame-runs'
import { queueInTransaction } from './persistence'
import { bankTrainingExpInTransaction } from './training-bank'
import { reconcileTrainerInTransaction } from './trainer'
import { locksLegacyTraining } from './puzzles/preparation-store'

export interface SpendLevelUpTicketsInput {
  umaId: string
  tier: number
  count: number
  /** Where the screen saw the unit: the spend's identity, so a retry finds itself and a stale screen spends nothing. */
  fromLevel: number
  fromExp: number
  now: number
}

/** The unit moved since the screen read it, and nothing was spent from where the screen thought it was. */
export class LevelUpTicketsStaleError extends Error {
  constructor() {
    super('This unit changed; the screen now shows its current Training Level')
    this.name = 'LevelUpTicketsStaleError'
  }
}

export interface LevelUpTicketsReceipt {
  uma: UmaSave
  profile: PlayerProfile
  ticketsSpent: number
  trainingLevelBefore: number
  trainingLevelAfter: number
  trainingExpBefore: number
  trainingExpAfter: number
  nodesUnlocked: RunRewardNode[]
  /** EXP carried past TL10 into the bank, and the tickets that paid straight back. */
  trainingExpBanked: number
  levelUpTicketsGranted: number
  alreadyCommitted: boolean
}

export interface SpendLevelUpTicketsOptions {
  /** Test-only transaction fault boundary. Throwing rolls every write back. */
  afterWrite?: (boundary: 'uma' | 'items' | 'itemLedger' | 'bank' | 'badges') => void
}

/** Tickets owned now: the stack's quantity, or none. */
export async function readLevelUpTickets(): Promise<number> {
  const row = await db.items.get(TRAINING_LEVEL_UP_TICKET_ID)
  if (!row) return 0
  const stack = parseInventoryStackData(row.data, TRAINING_LEVEL_UP_TICKET_ID)
  if (!stack) throw new Error('Local Training Level-Up Ticket stack is invalid')
  return stack.quantity
}

/**
 * One transaction re-reads the Uma, the ticket stack and the profile, refuses without writing if anything is off, then
 * writes the unit, the stack, the evidence, the bank and any regranted ticket, badges and outbox together. The evidence id
 * names where the unit started, so a retried tap finds its row and never spends twice.
 */
export async function spendPersistentLevelUpTickets(
  content: LoadedContent,
  input: SpendLevelUpTicketsInput,
  options: SpendLevelUpTicketsOptions = {},
): Promise<LevelUpTicketsReceipt> {
  const afterWrite = options.afterWrite ?? (() => undefined)
  return db.transaction(
    'rw',
    [db.profile, db.umas, db.cards, db.badges, db.raceResults, db.ledger, db.flairEvents, db.items, db.itemLedger, db.outbox, db.minigameRuns, db.constellationBank],
    async () => {
      const umaRow = await db.umas.get(input.umaId)
      if (!umaRow) throw new Error('This Uma is not owned')
      const uma = parseUmaSaveOrThrow(umaRow.data)
      const scenario = uma.scenarios.find((run) => run.tier === input.tier)
      if (!scenario) throw new Error('That scenario has not been unlocked')
      const profileRow = await db.profile.get('main')
      if (!profileRow) throw new Error('Local profile is missing')
      const profile = parsePlayerProfileOrThrow(profileRow.data)
      if (locksLegacyTraining() || profile.schemaVersion === 16 || await db.constellationBank.get('main'))
        throw new Error('Training EXP is frozen or retired. Spend preserved universals through Constellation Levels instead.')

      // A retried tap finds the evidence of the spend it already made from the starting point it saw.
      const evidenceId = trainingLevelUpMovementId(input.umaId, input.tier, input.fromLevel, input.fromExp)
      const existing = await db.itemLedger.get(evidenceId)
      if (existing) {
        const movement = parseItemLedgerEntry(existing.data)
        if (!movement || movement.reason !== 'training-level-up' || movement.createdAt !== existing.createdAt) {
          throw new Error(`Level-Up Ticket evidence is corrupt: ${evidenceId}`)
        }
        const count = -movement.delta
        const gain = addTrainingExp(input.fromLevel, input.fromExp, count * TRAINING_EXP_PER_LEVEL)
        return {
          uma, profile, ticketsSpent: count,
          trainingLevelBefore: input.fromLevel, trainingLevelAfter: gain.trainingLevel,
          trainingExpBefore: input.fromExp, trainingExpAfter: gain.trainingExp,
          nodesUnlocked: nodesUnlockedBetween(constellationTemplate(input.tier), input.fromLevel, gain.trainingLevel)
            .map((node) => ({ id: node.id, label: minigameNodeLabel(node) })),
          trainingExpBanked: gain.overflowExp, levelUpTicketsGranted: 0, alreadyCommitted: true,
        }
      }
      if (scenario.trainingLevel !== input.fromLevel || scenario.trainingExp !== input.fromExp) throw new LevelUpTicketsStaleError()

      const open = await db.minigameRuns.where('[targetKey+status]').equals([`spark-match:${input.umaId}:${input.tier}`, 'open']).count()
      if (open > 0) throw new Error('Finish the open Spark Match first')
      const owned = await readLevelUpTickets()
      const command = resolveTrainingLevelUp({
        umaId: input.umaId, tier: input.tier, trainingLevel: scenario.trainingLevel, trainingExp: scenario.trainingExp,
        count: input.count, owned, now: input.now,
      })

      const nextUma: UmaSave = {
        ...uma,
        scenarios: uma.scenarios.map((run) => run.tier === input.tier
          ? { ...run, trainingLevel: command.trainingLevel, trainingExp: command.trainingExp }
          : run),
      }
      await db.umas.put({ ...umaRow, data: nextUma })
      await queueInTransaction('umas', input.umaId, 'upsert', input.now)
      afterWrite('uma')
      const stackRow = await db.items.get(TRAINING_LEVEL_UP_TICKET_ID)
      await db.items.put({
        id: TRAINING_LEVEL_UP_TICKET_ID,
        data: { itemId: TRAINING_LEVEL_UP_TICKET_ID, quantity: owned - command.count, updatedAt: input.now },
        version: stackRow?.version ?? 0,
      })
      await queueInTransaction('items', TRAINING_LEVEL_UP_TICKET_ID, 'upsert', input.now)
      afterWrite('items')
      await db.itemLedger.add({ id: command.movement.id, data: command.movement, createdAt: input.now })
      await queueInTransaction('itemLedger', command.movement.id, 'append', input.now)
      afterWrite('itemLedger')

      // What passes TL10 goes back to the bank, and a full level there is a ticket straight back (D212).
      let nextProfile = profile
      let granted = 0
      if (command.overflowExp > 0) {
        const banked = await bankTrainingExpInTransaction(command.overflowExp, command.bankEvidenceId, command.movement.source, input.now)
        nextProfile = banked.profile
        granted = banked.tickets
      }
      afterWrite('bank')
      // A unit this takes to TL10 is her scenario's Fully Trained, as a Spark run's would be (T056).
      await updateTrainingBadgeFacts({ content, uma: nextUma, sourceId: command.movement.id, now: input.now })
      await reconcileTrainerInTransaction(content, input.now, false, command.movement.id)
      afterWrite('badges')

      return {
        uma: nextUma,
        profile: nextProfile,
        ticketsSpent: command.count,
        trainingLevelBefore: scenario.trainingLevel,
        trainingLevelAfter: command.trainingLevel,
        trainingExpBefore: scenario.trainingExp,
        trainingExpAfter: command.trainingExp,
        nodesUnlocked: nodesUnlockedBetween(constellationTemplate(input.tier), scenario.trainingLevel, command.trainingLevel)
          .map((node) => ({ id: node.id, label: minigameNodeLabel(node) })),
        trainingExpBanked: command.overflowExp,
        levelUpTicketsGranted: granted,
        alreadyCommitted: false,
      }
    },
  )
}
