// Training Levels, earned by Spark Match (docs/design/minigames.md, docs/design/training.md).

import { MAX_TRAINING_LEVEL } from './constellation'

/** Every Training Level costs the same (D211): today's TL1→7 cost spread over nine levels. */
export const TRAINING_EXP_PER_LEVEL = 1250

/** TL1 → TL10. */
export const TRAINING_EXP_TO_MAX = TRAINING_EXP_PER_LEVEL * (MAX_TRAINING_LEVEL - 1)

/**
 * Spark Match score needed to leave Training Level `n`. Surplus carries over, so a run can cross more than one level and
 * a bad run is slow progress rather than wasted progress.
 */
export const trainingExpToNext = (_trainingLevel: number): number => TRAINING_EXP_PER_LEVEL

/** Retained under its old name because the legacy v4 parser pins the old tier-1 bound. */
export const EXP_TO_NEXT_TRAINING_LEVEL = 1000

export interface TrainingLevelGain {
  trainingLevel: number
  trainingExp: number
  levelsGained: number
  /** EXP past TL10, which goes to the Training EXP bank (D212). 0 below TL10. */
  overflowExp: number
}

/** Adds Training EXP, resolving levels greedily. Past TL10 it overflows instead of accumulating. */
export function addTrainingExp(trainingLevel: number, exp: number, gained: number): TrainingLevelGain {
  let level = Math.min(MAX_TRAINING_LEVEL, Math.max(1, trainingLevel))
  let total = Math.max(0, exp) + Math.max(0, gained)
  const from = level
  while (level < MAX_TRAINING_LEVEL && total >= trainingExpToNext(level)) {
    total -= trainingExpToNext(level)
    level += 1
  }
  return {
    trainingLevel: level,
    trainingExp: level === MAX_TRAINING_LEVEL ? 0 : total,
    levelsGained: level - from,
    overflowExp: level === MAX_TRAINING_LEVEL ? total : 0,
  }
}

/** Whether a stored unit fits the curve: below TL10 its EXP is short of a level, and at TL10 it is 0. */
export const fitsTrainingCurve = (trainingLevel: number, trainingExp: number): boolean =>
  trainingLevel === MAX_TRAINING_LEVEL ? trainingExp === 0 : trainingExp < TRAINING_EXP_PER_LEVEL

/** The pre-v11 curve (D211): leaving TL `n` cost `1000 + 350 × (n − 1)`. */
const legacyTrainingExpToNext = (trainingLevel: number): number => 1000 + 350 * (trainingLevel - 1)

export interface ReleveledTraining {
  trainingLevel: number
  trainingExp: number
  /** EXP past the new TL10, for the Training EXP bank (D212). */
  surplusExp: number
}

/**
 * One unit moved from the old curve to the linear one (D211), through its total earned EXP. It lands on the higher of its
 * old level and what that total buys, so it is never demoted, and keeps the remainder. Anything past TL10 is surplus.
 */
export function relevelLegacyTraining(trainingLevel: number, trainingExp: number): ReleveledTraining {
  const oldLevel = Math.min(MAX_TRAINING_LEVEL, Math.max(1, trainingLevel))
  let total = Math.max(0, trainingExp)
  for (let level = 1; level < oldLevel; level += 1) total += legacyTrainingExpToNext(level)
  const bought = Math.min(MAX_TRAINING_LEVEL, 1 + Math.floor(total / TRAINING_EXP_PER_LEVEL))
  const level = Math.max(oldLevel, bought)
  return {
    trainingLevel: level,
    trainingExp: level === MAX_TRAINING_LEVEL
      ? 0
      : Math.min(TRAINING_EXP_PER_LEVEL - 1, Math.max(0, total - TRAINING_EXP_PER_LEVEL * (level - 1))),
    surplusExp: Math.max(0, total - TRAINING_EXP_TO_MAX),
  }
}

export interface TrainingExpDeposit {
  /** The bank after converting, always below one level (0–1,249). */
  bank: number
  /** Training Level-Up Tickets the deposit completed. */
  tickets: number
}

/** Adds EXP to the Training EXP bank; every full level's worth becomes one Level-Up Ticket at once (D212). */
export function depositTrainingExp(bank: number, exp: number): TrainingExpDeposit {
  const total = Math.max(0, bank) + Math.max(0, exp)
  return { bank: total % TRAINING_EXP_PER_LEVEL, tickets: Math.floor(total / TRAINING_EXP_PER_LEVEL) }
}
