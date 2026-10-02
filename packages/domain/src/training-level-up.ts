// Spending Training Level-Up Tickets on one unit before a Spark run (docs/design/training.md, D213, T088).

import { MAX_TRAINING_LEVEL } from './constellation'
import { TRAINING_LEVEL_UP_TICKET_ID, type TrainingLevelUpMovement, type TrainingLevelUpSource } from './farm/types'
import { TRAINING_EXP_PER_LEVEL, addTrainingExp } from './training'

/** How many tickets this unit can take now: one a level up to TL10, and no more than are owned. */
export const maxLevelUpTickets = (trainingLevel: number, owned: number): number =>
  Math.max(0, Math.min(Math.trunc(owned), MAX_TRAINING_LEVEL - trainingLevel))

/** Named by where the unit started: its total EXP only rises, so each starting point is spent from once. */
export const trainingLevelUpMovementId = (umaId: string, tier: number, fromLevel: number, fromExp: number): string =>
  `level-up:${umaId}:${tier}:${fromLevel}.${fromExp}`

export interface TrainingLevelUpCommand {
  count: number
  trainingLevel: number
  trainingExp: number
  levelsGained: number
  /** EXP carried past TL10, for the Training EXP bank. */
  overflowExp: number
  movement: TrainingLevelUpMovement
  /** Evidence id for that bank deposit, when there is one. */
  bankEvidenceId: string
}

/**
 * `count` tickets are `count × 1,250` Training EXP: exactly that many levels, keeping the progress inside the current one,
 * and anything past TL10 goes back to the bank (D213).
 */
export function resolveTrainingLevelUp(input: {
  umaId: string
  tier: number
  trainingLevel: number
  trainingExp: number
  count: number
  owned: number
  now: number
}): TrainingLevelUpCommand {
  if (input.trainingLevel >= MAX_TRAINING_LEVEL) throw new Error('This unit is already at TL10')
  const max = maxLevelUpTickets(input.trainingLevel, input.owned)
  if (!Number.isSafeInteger(input.count) || input.count < 1) throw new Error('Choose at least one ticket')
  if (input.count > input.owned) throw new Error('Not enough Training Level-Up Tickets')
  if (input.count > max) throw new Error(`At most ${max} ticket${max === 1 ? '' : 's'} can be used on this unit`)
  const gain = addTrainingExp(input.trainingLevel, input.trainingExp, input.count * TRAINING_EXP_PER_LEVEL)
  const source: TrainingLevelUpSource = {
    kind: 'level-up', umaId: input.umaId, tier: input.tier, fromLevel: input.trainingLevel, fromExp: input.trainingExp,
  }
  const id = trainingLevelUpMovementId(input.umaId, input.tier, input.trainingLevel, input.trainingExp)
  return {
    count: input.count,
    trainingLevel: gain.trainingLevel,
    trainingExp: gain.trainingExp,
    levelsGained: gain.levelsGained,
    overflowExp: gain.overflowExp,
    movement: {
      id,
      itemId: TRAINING_LEVEL_UP_TICKET_ID,
      delta: -input.count,
      reason: 'training-level-up',
      source,
      createdAt: input.now,
    },
    bankEvidenceId: `exp-bank:${id}`,
  }
}
